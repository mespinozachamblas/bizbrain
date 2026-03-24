import { digestSectionSchema, researchStreamIds } from "@bizbrain/core";
import { db } from "@bizbrain/db";
import { buildDigestSubject, renderDigestHtml, renderDigestMarkdown, sendWithResend } from "@bizbrain/email";
import { logJobBoundary, runJobWithTracking } from "./shared";

const SOCIAL_DIGEST_TITLE = "Social Media Research Digest";

export async function runDailySocialMediaDigestEmail() {
  await runJobWithTracking({
    jobName: "daily-social-media-digest-email",
    execute: async (context) => {
      const digestDate = context.logicalDate.toISOString().slice(0, 10);
      const digestKey = `digest:${digestDate}:social-media-research`;
      const generatedAt = new Date().toISOString();
      const appBaseUrl = resolveAppBaseUrl();
      const ownerEmail = process.env.OWNER_EMAIL;
      const researchStreamId = researchStreamIds.socialMedia;

      if (ownerEmail) {
        const recipients = parseDigestRecipients(process.env.SOCIAL_DIGEST_RECIPIENTS, ownerEmail);
        await syncDigestRecipients({
          researchStreamId,
          ownerEmail,
          recipients
        });
      }

      const [drafts, failedJobs, failedSourceChecks, recipients, existingDigest, previousDigest] = await Promise.all([
        getSocialDigestDrafts(researchStreamId),
        db.jobRun.findMany({
          where: {
            OR: [{ jobName: "daily-enrich-score" }, { jobName: "daily-social-media-digest-email" }],
            runStatus: "failed"
          },
          orderBy: { startedAt: "desc" },
          take: 5
        }),
        db.sourceHealthCheck.findMany({
          where: { checkStatus: "failed" },
          orderBy: { checkedAt: "desc" },
          take: 5
        }),
        db.digestRecipient.findMany({
          where: { enabled: true, researchStreamId },
          orderBy: [{ isOwnerDefault: "desc" }, { email: "asc" }]
        }),
        db.digest.findUnique({
          where: { digestKey },
          select: {
            selectionJson: true,
            sentAt: true,
            createdAt: true
          }
        }),
        db.digest.findFirst({
          where: {
            researchStreamId,
            sentAt: { not: null },
            digestKey: { not: digestKey }
          },
          orderBy: [{ sentAt: "desc" }],
          select: {
            selectionJson: true,
            sentAt: true,
            createdAt: true
          }
        })
      ]);

      const comparisonDigest = existingDigest ?? previousDigest;
      const priorDraftTitles = extractDigestDraftTitles(comparisonDigest?.selectionJson);
      const freshnessBaseline = comparisonDigest?.sentAt ?? comparisonDigest?.createdAt ?? null;
      const sections = buildSocialDigestSections({
        drafts,
        failedJobs,
        failedSourceChecks,
        priorDraftTitles,
        freshnessBaseline
      });
      const subject = buildDigestSubject(digestDate, SOCIAL_DIGEST_TITLE);
      const markdownBody = renderDigestMarkdown({
        digestDate,
        generatedAt,
        sections,
        appBaseUrl,
        digestTitle: SOCIAL_DIGEST_TITLE,
        reviewLinkLabel: "Review social drafts in BizBrain"
      });
      const htmlBody = renderDigestHtml({
        digestDate,
        generatedAt,
        sections,
        appBaseUrl,
        digestTitle: SOCIAL_DIGEST_TITLE,
        reviewLinkLabel: "Open BizBrain social drafts"
      });

      const digest = await db.digest.upsert({
        where: { digestKey },
        update: {
          researchStreamId,
          subject,
          markdownBody,
          htmlBody,
          selectionJson: sections,
          status: recipients.length > 0 ? "ready" : "skipped"
        },
        create: {
          researchStreamId,
          digestDate: context.logicalDate,
          digestKey,
          subject,
          markdownBody,
          htmlBody,
          selectionJson: sections,
          status: recipients.length > 0 ? "ready" : "skipped"
        }
      });

      const warnings: string[] = [];

      if (recipients.length === 0) {
        warnings.push("No enabled social-media digest recipients are configured.");
      }

      const resendApiKey = process.env.RESEND_API_KEY;
      const emailFrom = process.env.EMAIL_FROM;
      const replyTo = parseReplyTo(process.env.SOCIAL_DIGEST_REPLY_TO ?? process.env.DIGEST_REPLY_TO);

      if (!resendApiKey) {
        warnings.push("RESEND_API_KEY is not configured. Social digest content was stored but no email was sent.");
      }

      if (!emailFrom) {
        warnings.push("EMAIL_FROM is not configured. Social digest content was stored but no email was sent.");
      }

      let deliveryAttempts = 0;
      let deliveryWrites = 1;

      for (const recipient of recipients) {
        const deliveryKey = `digest:${digestDate}:social-media-research:${recipient.email.toLowerCase()}`;
        const existingDelivery = await db.emailDelivery.findUnique({ where: { deliveryKey } });

        if (existingDelivery?.sendStatus === "sent") {
          continue;
        }

        deliveryAttempts += 1;

        if (!resendApiKey || !emailFrom) {
          await db.emailDelivery.upsert({
            where: { deliveryKey },
            update: {
              digestId: digest.id,
              recipientId: recipient.id,
              recipientEmail: recipient.email,
              provider: "resend",
              sendStatus: "failed",
              errorText: !resendApiKey ? "Missing RESEND_API_KEY" : "Missing EMAIL_FROM",
              attemptedAt: new Date()
            },
            create: {
              digestId: digest.id,
              recipientId: recipient.id,
              recipientEmail: recipient.email,
              provider: "resend",
              deliveryKey,
              sendStatus: "failed",
              errorText: !resendApiKey ? "Missing RESEND_API_KEY" : "Missing EMAIL_FROM"
            }
          });
          deliveryWrites += 1;
          continue;
        }

        const result = await sendWithResend({
          apiKey: resendApiKey,
          from: emailFrom,
          to: recipient.email,
          subject,
          text: markdownBody,
          html: htmlBody,
          replyTo
        });

        await db.emailDelivery.upsert({
          where: { deliveryKey },
          update: {
            digestId: digest.id,
            recipientId: recipient.id,
            recipientEmail: recipient.email,
            provider: "resend",
            providerMessageId: result.id ?? null,
            sendStatus: result.error ? "failed" : "sent",
            errorText: result.error ?? null,
            attemptedAt: new Date()
          },
          create: {
            digestId: digest.id,
            recipientId: recipient.id,
            recipientEmail: recipient.email,
            provider: "resend",
            deliveryKey,
            providerMessageId: result.id ?? null,
            sendStatus: result.error ? "failed" : "sent",
            errorText: result.error ?? null
          }
        });

        if (result.error) {
          warnings.push(`Delivery to ${recipient.email} failed: ${result.error}`);
        }

        deliveryWrites += 1;
      }

      const successfulSendCount = await db.emailDelivery.count({
        where: {
          digestId: digest.id,
          sendStatus: "sent"
        }
      });

      if (recipients.length > 0 && deliveryAttempts === 0 && successfulSendCount > 0) {
        warnings.push("Social digest was already sent today. Use the force-send control to send another review copy.");
      }

      await db.digest.update({
        where: { id: digest.id },
        data: {
          status: recipients.length === 0 ? "skipped" : successfulSendCount > 0 ? "sent" : "failed",
          sentAt: successfulSendCount > 0 ? new Date() : null
        }
      });

      await context.markProgress({
        recordsRead: drafts.length + failedJobs.length + failedSourceChecks.length + recipients.length,
        recordsWritten: deliveryWrites,
        warnings
      });

      logJobBoundary(
        "daily-social-media-digest-email",
        `Prepared social digest ${digestKey} and processed ${deliveryAttempts} delivery attempt(s).`
      );
    }
  });
}

type SocialDigestInputs = {
  drafts: SocialDigestDraft[];
  failedJobs: Awaited<ReturnType<typeof db.jobRun.findMany>>;
  failedSourceChecks: Awaited<ReturnType<typeof db.sourceHealthCheck.findMany>>;
  priorDraftTitles: Set<string>;
  freshnessBaseline: Date | null;
};

type SocialDigestDraft = Awaited<ReturnType<typeof getSocialDigestDrafts>>[number];

type SupportingStat = {
  claim: string;
  plainLanguageAngle: string;
  sourceName: string;
  sourceUrl: string | null;
  sourceDate: string | null;
  freshnessNote: string;
  confidenceNote: string;
  recommendedUsage: string;
  reviewStatus: string;
};

async function getSocialDigestDrafts(researchStreamId: string) {
  return db.contentDraft.findMany({
    where: {
      researchStreamId,
      status: "draft"
    },
    orderBy: [{ qualityScore: "desc" }, { updatedAt: "desc" }],
    take: 24,
    include: {
      topic: true,
      copyFramework: true,
      styleProfile: true,
      sourceIdea: true,
      sourceBrief: {
        select: {
          id: true,
          topicId: true,
          framingMode: true,
          title: true,
          themeSummary: true,
          operatorTakeaway: true
        }
      }
    }
  });
}

function buildSocialDigestSections(input: SocialDigestInputs) {
  const rankedDrafts = rankSocialDigestDrafts(input.drafts, input.priorDraftTitles, input.freshnessBaseline);
  const linkedinDrafts = rankedDrafts.filter((draft) => draft.targetChannel === "linkedin").slice(0, 3);
  const xDrafts = rankedDrafts.filter((draft) => draft.targetChannel === "x").slice(0, 3);
  const infographicDrafts = rankedDrafts.filter((draft) => hasInfographicPanels(draft.infographicPanelsJson)).slice(0, 3);
  const topStats = collectTopSupportingStats(rankedDrafts).slice(0, 6);
  const groupedSignalEvidenceSections = buildSignalEvidenceSections(collectSignalEvidenceStats(rankedDrafts).slice(0, 8));
  const reviewedMedia = collectReviewedMediaCandidates(rankedDrafts).slice(0, 4);
  const healthAlerts = [
    ...input.failedJobs.map((job) => `Job ${job.jobName} failed at ${job.startedAt.toISOString()}.`),
    ...input.failedSourceChecks.map(
      (check) => `Source check failed for ${check.sourceConfigId}: ${check.responseSummary ?? "No summary provided"}.`
    )
  ].slice(0, 5);

  return [
    {
      sectionTitle: "Top LinkedIn Drafts",
      items:
        linkedinDrafts.length > 0
          ? linkedinDrafts.map((draft) => formatSocialDraftLine(draft))
          : ["No LinkedIn drafts are ready yet."],
      alerts: [],
      plainLanguageSummary:
        linkedinDrafts.length > 0
          ? "These are the highest-quality LinkedIn-ready angles in the queue, weighted toward drafts that are new or materially updated since the last sent social digest."
          : "LinkedIn drafts will appear after the social-media stream has matched topics and generated content."
    },
    {
      sectionTitle: "Top X Drafts",
      items: xDrafts.length > 0 ? xDrafts.map((draft) => formatSocialDraftLine(draft)) : ["No X drafts are ready yet."],
      alerts: [],
      plainLanguageSummary:
        xDrafts.length > 0
          ? "These are the strongest short-form X angles currently in the queue, weighted toward fresher drafts that were not already sent."
          : "X drafts will appear after the social-media stream has matched topics and generated content."
    },
    {
      sectionTitle: "Infographic Angles",
      items:
        infographicDrafts.length > 0
          ? infographicDrafts.map((draft) => formatInfographicLine(draft))
          : ["No infographic-ready concepts are available yet."],
      alerts: [],
      plainLanguageSummary:
        infographicDrafts.length > 0
          ? "These concepts already have panel-ready structures for carousels or infographic-style posts."
          : "Infographic concepts will show up once draft generation creates visual and panel outlines."
    },
    ...(topStats.length > 0
      ? [
          {
            sectionTitle: "Wow Factor Statistics",
            items: topStats.map((stat) => formatSupportingStatLine(stat)),
            alerts: [],
            plainLanguageSummary:
              "These are the strongest publishable external statistics currently attached to the social drafts. Use them for hooks, emphasis, and infographic callouts after review."
          }
        ]
      : [
          {
            sectionTitle: "Wow Factor Statistics",
            items: ["No publishable external insight statistics are available yet."],
            alerts: [],
            plainLanguageSummary:
              "Wow-factor statistics will appear here once the social generator captures externally sourced, reviewable quantitative claims relevant to the post topic."
          }
        ]),
    ...(groupedSignalEvidenceSections.length > 0
      ? groupedSignalEvidenceSections
      : [
          {
            sectionTitle: "Signal Evidence",
            items: ["No signal-evidence statistics are available yet."],
            alerts: [],
            plainLanguageSummary:
              "Signal evidence includes platform, marketplace, and cluster-validation proof points that help explain why a topic is showing up, but are not the main publishable wow-factor claims."
          }
        ]),
    {
      sectionTitle: "Reviewed Media Suggestions",
      items:
        reviewedMedia.length > 0
          ? reviewedMedia.map((candidate) => formatMediaCandidateLine(candidate))
          : ["No approved or review-safe media suggestions are available yet."],
      alerts: [],
      plainLanguageSummary:
        reviewedMedia.length > 0
          ? "These media suggestions are the highest-ranked reviewed candidates attached to the current social drafts."
          : "Media suggestions will appear here after you review candidate assets on the Social Drafts screen."
    },
    {
      sectionTitle: "Pipeline Health Notes",
      items:
        healthAlerts.length > 0
          ? healthAlerts
          : ["No failed social-media or source-health events were recorded in the latest checks."],
      alerts: [],
      plainLanguageSummary:
        healthAlerts.length > 0
          ? "These operational notes may affect how much trust to place in the current social draft set."
          : "No blocking health issues were recorded for the latest social-media digest run."
    }
  ].map((section) => digestSectionSchema.parse(section));
}

function formatSocialDraftLine(draft: SocialDigestDraft) {
  const freshnessLabel = summarizeDraftFreshnessLabel(draft);
  const parts = [
    `${freshnessLabel ? `${freshnessLabel} ` : ""}${draft.title}`,
    `Topic: ${draft.topic?.name ?? "Unassigned"}`,
    `Framework: ${draft.copyFramework?.name ?? "Stream default"}`,
    `Style: ${draft.styleProfile?.name ?? "Stream default"}`,
    `Hook: ${ensureSentence(draft.hook ?? draft.thesis ?? "No hook recorded yet.")}`,
    `Angle: ${ensureSentence(draft.thesis ?? draft.hook ?? "No thesis recorded yet.")}`,
    `CTA: ${ensureSentence(draft.cta ?? "Add a clearer CTA before publishing.")}`
  ];

  return parts.join(" | ");
}

function formatInfographicLine(draft: SocialDigestDraft) {
  const panels = toStringArray(draft.infographicPanelsJson).slice(0, 3);
  const panelSummary =
    panels.length > 0 ? panels.map((panel) => ensureSentence(panel)).join(" / ") : "Panel outline pending.";
  const creativeDirection = readObjectField((draft as any).infographicCreativeBriefJson, "creativeDirection");
  const freshnessLabel = summarizeDraftFreshnessLabel(draft);

  return [
    `${freshnessLabel ? `${freshnessLabel} ` : ""}${draft.title}`,
    `Format: ${draft.infographicFormat ?? "visual brief"}`,
    `Topic: ${draft.topic?.name ?? "Unassigned"}`,
    `Creative: ${ensureSentence(creativeDirection ?? "Creative-production brief pending.")}`,
    `Asset prompt: ${ensureSentence(readObjectField((draft as any).infographicCreativeBriefJson, "singleImagePrompt") ?? readObjectField((draft as any).infographicCreativeBriefJson, "carouselCoverPrompt") ?? "Asset-production prompt pending.")}`,
    `Panels: ${panelSummary}`
  ].join(" | ");
}

function hasInfographicPanels(value: unknown) {
  return toStringArray(value).length >= 3;
}

function readObjectField(value: unknown, key: string) {
  if (!value || typeof value !== "object" || !(key in value)) {
    return null;
  }

  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" ? candidate : null;
}

function readSupportingStats(value: unknown): SupportingStat[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .map((entry) => ({
      claim: typeof entry.claim === "string" ? entry.claim : "No claim recorded.",
      plainLanguageAngle: typeof entry.plainLanguageAngle === "string" ? entry.plainLanguageAngle : "No angle recorded.",
      sourceName: typeof entry.sourceName === "string" ? entry.sourceName : "Unknown source",
      sourceUrl: typeof entry.sourceUrl === "string" && /^https?:\/\//i.test(entry.sourceUrl) ? entry.sourceUrl : null,
      sourceDate: typeof entry.sourceDate === "string" ? entry.sourceDate : null,
      freshnessNote: typeof entry.freshnessNote === "string" ? entry.freshnessNote : "No freshness note recorded.",
      confidenceNote: typeof entry.confidenceNote === "string" ? entry.confidenceNote : "No confidence note recorded.",
      recommendedUsage: typeof entry.recommendedUsage === "string" ? entry.recommendedUsage : "No usage guidance recorded.",
      reviewStatus:
        typeof entry.reviewStatus === "string" && ["pending", "approved", "use-with-caution", "rejected"].includes(entry.reviewStatus)
          ? entry.reviewStatus
          : "pending"
    }));
}

function collectTopSupportingStats(drafts: Array<SocialDigestDraft & { freshnessTag?: string | null }>) {
  return drafts
    .flatMap((draft) =>
      readSupportingStats(draft.supportingStatsJson).map((stat) => ({
        ...stat,
        sourceClass: inferSupportingStatSourceClass(stat),
        draftTitle: draft.title,
        topicName: draft.topic?.name ?? "Unassigned",
        draftQualityScore: draft.qualityScore ?? 0,
        statScore: scoreSupportingStat(stat, draft)
      }))
    )
    .filter((stat) => stat.reviewStatus !== "rejected")
    .sort((left, right) => right.statScore - left.statScore || right.draftQualityScore - left.draftQualityScore)
    .filter((stat, index, all) => {
      const normalizedClaim = normalizeComparableText(stat.claim);
      return all.findIndex((candidate) => normalizeComparableText(candidate.claim) === normalizedClaim) === index;
    });
}

function collectSignalEvidenceStats(drafts: Array<SocialDigestDraft & { freshnessTag?: string | null }>) {
  return drafts
    .flatMap((draft) =>
      readSupportingStats((draft as { signalEvidenceStatsJson?: unknown }).signalEvidenceStatsJson).map((stat) => ({
        ...stat,
        sourceClass: inferSupportingStatSourceClass(stat),
        draftTitle: draft.title,
        topicName: draft.topic?.name ?? "Unassigned",
        draftQualityScore: draft.qualityScore ?? 0,
        statScore: scoreSupportingStat(stat, draft)
      }))
    )
    .filter((stat) => stat.reviewStatus !== "rejected")
    .sort((left, right) => right.statScore - left.statScore || right.draftQualityScore - left.draftQualityScore)
    .filter((stat, index, all) => {
      const normalizedClaim = normalizeComparableText(stat.claim);
      return all.findIndex((candidate) => normalizeComparableText(candidate.claim) === normalizedClaim) === index;
    });
}

function formatSupportingStatLine(
  stat: SupportingStat & {
    sourceClass: string;
    draftTitle: string;
    topicName: string;
  }
) {
  return [
    stat.claim,
    `Topic: ${stat.topicName}`,
    `Draft: ${stat.draftTitle}`,
    `Source class: ${stat.sourceClass}`,
    `Review: ${stat.reviewStatus}`,
    `Source: ${stat.sourceName}${stat.sourceUrl ? ` (${stat.sourceUrl})` : ""}`,
    `Freshness: ${ensureSentence(stat.freshnessNote)}`,
    `Confidence: ${ensureSentence(stat.confidenceNote)}`
  ].join(" | ");
}

function buildSignalEvidenceSections(
  stats: Array<
    SupportingStat & {
      sourceClass: string;
      draftTitle: string;
      topicName: string;
      draftQualityScore: number;
      statScore: number;
    }
  >
) {
  const sectionOrder = ["Google Trends", "Product Hunt", "Cluster Evidence", "External Evidence"] as const;
  const sectionMeta: Record<(typeof sectionOrder)[number], { title: string; summary: string }> = {
    "Google Trends": {
      title: "Momentum Statistics",
      summary: "These are signal-evidence statistics showing live search-attention or trend momentum relevant to the current social topics."
    },
    "Product Hunt": {
      title: "Marketplace Statistics",
      summary: "These are signal-evidence statistics showing visible launch and engagement activity from product-marketplace signals."
    },
    "Cluster Evidence": {
      title: "Internal Evidence Statistics",
      summary: "These statistics come from BizBrain's clustered source evidence and are useful as internal proof points when external data is limited."
    },
    "External Evidence": {
      title: "Additional External Statistics",
      summary: "These statistics come from external evidence sources that do not fit the primary momentum or marketplace buckets."
    }
  };

  return sectionOrder
    .map((sourceClass) => {
      const grouped = stats.filter((stat) => stat.sourceClass === sourceClass).slice(0, 2);

      if (grouped.length === 0) {
        return null;
      }

      return {
        sectionTitle: sectionMeta[sourceClass].title,
        items: grouped.map((stat) => formatSupportingStatLine(stat)),
        alerts: [],
        plainLanguageSummary: sectionMeta[sourceClass].summary
      };
    })
    .filter((section): section is NonNullable<typeof section> => Boolean(section));
}

function inferSupportingStatSourceClass(stat: SupportingStat) {
  const sourceName = stat.sourceName.toLowerCase();
  const sourceUrl = (stat.sourceUrl ?? "").toLowerCase();

  if (sourceName.includes("google trends") || sourceUrl.includes("trends.google.com")) {
    return "Google Trends";
  }

  if (sourceName.includes("product hunt") || sourceUrl.includes("producthunt.com")) {
    return "Product Hunt";
  }

  if (sourceName.includes("bizbrain") || sourceUrl.includes("app.bizbrain.local")) {
    return "Cluster Evidence";
  }

  return "External Evidence";
}

function scoreSupportingStat(
  stat: SupportingStat,
  draft: SocialDigestDraft & { freshnessTag?: string | null }
) {
  let score = draft.qualityScore ?? 0;
  const sourceUrl = (stat.sourceUrl ?? "").toLowerCase();
  const freshnessText = `${stat.freshnessNote} ${stat.sourceDate ?? ""}`.toLowerCase();
  const confidenceText = stat.confidenceNote.toLowerCase();
  const claimText = stat.claim.toLowerCase();

  if (sourceUrl && !sourceUrl.includes("app.bizbrain.local")) {
    score += 3;
  }

  if (stat.reviewStatus === "approved") {
    score += 3;
  } else if (stat.reviewStatus === "use-with-caution") {
    score -= 1;
  }

  if (confidenceText.includes("higher confidence")) {
    score += 3;
  } else if (confidenceText.includes("moderate confidence")) {
    score += 2;
  } else if (confidenceText.includes("low-to-moderate")) {
    score += 1;
  }

  if (freshnessText.includes("latest") || freshnessText.includes("current") || freshnessText.includes("snapshot")) {
    score += 1;
  }

  if (/\d/.test(claimText)) {
    score += 2;
  }

  if (draft.freshnessTag) {
    score += draft.freshnessTag.includes("New") ? 2 : 1;
  }

  return score;
}

type ReviewedMediaCandidate = {
  label: string;
  sourceType: string;
  usageStatus: string;
  reviewStatus: string;
  originUrl: string | null;
  originDomain: string | null;
  licenseLabel: string | null;
  draftTitle: string;
  topicName: string;
  draftQualityScore: number;
  mediaScore: number;
};

function collectReviewedMediaCandidates(drafts: Array<SocialDigestDraft & { freshnessTag?: string | null }>) {
  return drafts
    .flatMap((draft) =>
      readMediaCandidates(draft.assetCandidatesJson)
        .filter((candidate) => candidate.reviewStatus === "approved" || candidate.reviewStatus === "use-with-caution")
        .map((candidate) => ({
          ...candidate,
          draftTitle: draft.title,
          topicName: draft.topic?.name ?? "Unassigned",
          draftQualityScore: draft.qualityScore ?? 0,
          mediaScore: scoreMediaCandidate(candidate, draft)
        }))
    )
    .sort((left, right) => right.mediaScore - left.mediaScore || right.draftQualityScore - left.draftQualityScore)
    .filter((candidate, index, all) => {
      const normalizedLabel = normalizeComparableText(candidate.label);
      return all.findIndex((other) => normalizeComparableText(other.label) === normalizedLabel) === index;
    });
}

function readMediaCandidates(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .map((entry) => ({
      label: typeof entry.label === "string" ? entry.label : "Untitled candidate",
      sourceType: typeof entry.sourceType === "string" ? entry.sourceType : "unknown",
      usageStatus: typeof entry.usageStatus === "string" ? entry.usageStatus : "review-required",
      reviewStatus:
        typeof entry.reviewStatus === "string" && ["pending", "approved", "use-with-caution", "rejected", "reference-only"].includes(entry.reviewStatus)
          ? entry.reviewStatus
          : typeof entry.usageStatus === "string" && entry.usageStatus === "reference-only"
            ? "reference-only"
            : "pending",
      originUrl: typeof entry.originUrl === "string" ? entry.originUrl : null,
      originDomain: typeof entry.originDomain === "string" ? entry.originDomain : null,
      licenseLabel: typeof entry.licenseLabel === "string" ? entry.licenseLabel : null
    }));
}

function scoreMediaCandidate(
  candidate: ReturnType<typeof readMediaCandidates>[number],
  draft: SocialDigestDraft & { freshnessTag?: string | null }
) {
  let score = draft.qualityScore ?? 0;

  if (candidate.reviewStatus === "approved") {
    score += 4;
  } else if (candidate.reviewStatus === "use-with-caution") {
    score += 1;
  }

  if (candidate.sourceType === "first-party" || candidate.sourceType === "ai-generated") {
    score += 2;
  }

  if (candidate.usageStatus === "publishable") {
    score += 2;
  } else if (candidate.usageStatus === "review-required") {
    score += 1;
  }

  if (draft.freshnessTag) {
    score += draft.freshnessTag.includes("New") ? 2 : 1;
  }

  return score;
}

function formatMediaCandidateLine(candidate: ReviewedMediaCandidate) {
  return [
    candidate.label,
    `Topic: ${candidate.topicName}`,
    `Draft: ${candidate.draftTitle}`,
    `Review: ${candidate.reviewStatus}`,
    `Source type: ${candidate.sourceType}`,
    `License: ${candidate.licenseLabel ?? "Verify on origin site"}`,
    `Origin: ${candidate.originUrl ?? candidate.originDomain ?? "No origin URL stored"}`
  ].join(" | ");
}

function normalizeComparableText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0) : [];
}

function ensureSentence(value: string) {
  const trimmed = value.trim().replace(/\s+/g, " ");

  if (trimmed.length === 0) {
    return "No summary available.";
  }

  if (/[.!?]$/.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed}.`;
}

function rankSocialDigestDrafts(
  drafts: SocialDigestDraft[],
  priorDraftTitles: Set<string>,
  freshnessBaseline: Date | null
) {
  return drafts
    .map((draft) => ({
      draft,
      quality: draft.qualityScore ?? 0,
      freshness: scoreDraftFreshness(draft, priorDraftTitles, freshnessBaseline),
      relevance: scoreDraftRelevance(draft),
      freshnessLabel: buildDraftFreshnessLabel(draft, priorDraftTitles, freshnessBaseline)
    }))
    .filter(({ quality, relevance }) => quality >= 6 && relevance >= 0)
    .sort(
      (left, right) =>
        right.relevance - left.relevance ||
        right.freshness - left.freshness ||
        right.quality - left.quality ||
        right.draft.updatedAt.getTime() - left.draft.updatedAt.getTime()
    )
    .map(({ draft, freshnessLabel }) => ({
      ...draft,
      freshnessTag: freshnessLabel
    }));
}

function scoreDraftRelevance(draft: SocialDigestDraft) {
  let score = 0;
  const topicKeywords = Array.isArray(draft.topic?.keywordsJson)
    ? draft.topic.keywordsJson.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.toLowerCase())
    : [];
  const haystack = [
    draft.title,
    draft.hook,
    draft.thesis,
    draft.sourceBrief?.title,
    draft.sourceBrief?.themeSummary,
    draft.sourceBrief?.operatorTakeaway,
    draft.sourceIdea?.title,
    draft.sourceIdea?.problemSummary,
    draft.sourceIdea?.solutionConcept
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();

  if (draft.sourceBriefId) {
    score += 5;
  } else if (draft.sourceIdeaId) {
    score -= 3;
  }

  if (draft.sourceBrief && draft.topicId && draft.sourceBrief.topicId === draft.topicId) {
    score += 4;
  }

  const overlap = topicKeywords.filter((keyword) => keywordMatchesHaystack(keyword, haystack)).length;
  if (overlap > 0) {
    score += Math.min(6, overlap * 2);
  } else if (!isBroadSocialTopic(draft.topic?.slug)) {
    score -= 6;
  }

  if (/would you build this as software|would you ship this as saas|practical wedge|demand is getting sharper/i.test(`${draft.hook ?? ""} ${draft.thesis ?? ""} ${draft.cta ?? ""}`)) {
    score -= 4;
  }

  if (draft.sourceBrief?.framingMode === "commentary") {
    score += 2;
  }

  return score;
}

function scoreDraftFreshness(
  draft: SocialDigestDraft,
  priorDraftTitles: Set<string>,
  freshnessBaseline: Date | null
) {
  let score = 0;
  const createdAt = "createdAt" in draft && draft.createdAt instanceof Date ? draft.createdAt : null;
  const titleKey = normalizeDraftTitle(draft.title);

  if (freshnessBaseline) {
    if (createdAt && createdAt.getTime() > freshnessBaseline.getTime()) {
      score += 8;
    } else if (draft.updatedAt.getTime() > freshnessBaseline.getTime()) {
      score += 5;
    }
  } else {
    score += 2;
  }

  if (priorDraftTitles.has(titleKey)) {
    score -= 6;
  } else {
    score += 2;
  }

  return score;
}

function summarizeDraftFreshnessLabel(draft: SocialDigestDraft) {
  const freshness = "freshnessTag" in draft ? draft.freshnessTag : undefined;
  return typeof freshness === "string" && freshness.length > 0 ? freshness : "";
}

function buildDraftFreshnessLabel(
  draft: SocialDigestDraft,
  priorDraftTitles: Set<string>,
  freshnessBaseline: Date | null
) {
  const createdAt = "createdAt" in draft && draft.createdAt instanceof Date ? draft.createdAt : null;
  const titleKey = normalizeDraftTitle(draft.title);

  if (freshnessBaseline) {
    if (createdAt && createdAt.getTime() > freshnessBaseline.getTime()) {
      return "[New]";
    }

    if (!priorDraftTitles.has(titleKey) || draft.updatedAt.getTime() > freshnessBaseline.getTime()) {
      return "[Updated]";
    }

    return "";
  }

  return "[New]";
}

function normalizeDraftTitle(value: string) {
  return value.trim().toLowerCase();
}

function isBroadSocialTopic(slug: string | null | undefined) {
  return slug === "linkedin-founder-content" || slug === "x-operator-content";
}

function keywordMatchesHaystack(keyword: string, haystack: string) {
  const escapedKeyword = escapeRegExp(keyword.trim().toLowerCase());

  if (!escapedKeyword) {
    return false;
  }

  const pattern = escapedKeyword.includes("\\ ")
    ? new RegExp(`(^|[^a-z0-9])${escapedKeyword}([^a-z0-9]|$)`, "i")
    : new RegExp(`\\b${escapedKeyword}\\b`, "i");

  return pattern.test(haystack);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractDigestDraftTitles(selectionJson: unknown) {
  if (!Array.isArray(selectionJson)) {
    return new Set<string>();
  }

  const titles = selectionJson
    .flatMap((section): string[] => {
      if (!section || typeof section !== "object" || !("items" in section) || !Array.isArray(section.items)) {
        return [];
      }

      const items = section.items as unknown[];

      return items
        .filter((item): item is string => typeof item === "string")
        .map((item: string) => {
          const firstSegment = item.split("|")[0]?.trim() ?? "";
          return normalizeDraftTitle(firstSegment.replace(/^\[(new|updated)\]\s*/i, ""));
        });
    })
    .filter(Boolean);

  return new Set(titles);
}

function resolveAppBaseUrl() {
  return process.env.APP_BASE_URL?.trim() || undefined;
}

function parseReplyTo(input: string | undefined) {
  return (input ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseDigestRecipients(input: string | undefined, ownerEmail: string) {
  const normalizedOwner = ownerEmail.trim().toLowerCase();
  const recipients = (input ?? normalizedOwner)
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return [...new Set([normalizedOwner, ...recipients])];
}

async function syncDigestRecipients(input: {
  researchStreamId: string;
  ownerEmail: string;
  recipients: string[];
}) {
  const normalizedOwnerEmail = input.ownerEmail.trim().toLowerCase();

  await db.digestRecipient.updateMany({
    where: {
      researchStreamId: input.researchStreamId,
      isOwnerDefault: true,
      email: { not: normalizedOwnerEmail }
    },
    data: {
      isOwnerDefault: false
    }
  });

  for (const recipient of input.recipients) {
    const normalizedRecipient = recipient.trim().toLowerCase();

    await db.digestRecipient.upsert({
      where: {
        researchStreamId_email: {
          researchStreamId: input.researchStreamId,
          email: normalizedRecipient
        }
      },
      update: {
        enabled: true,
        isOwnerDefault: normalizedRecipient === normalizedOwnerEmail
      },
      create: {
        researchStreamId: input.researchStreamId,
        email: normalizedRecipient,
        enabled: true,
        isOwnerDefault: normalizedRecipient === normalizedOwnerEmail
      }
    });
  }

  if (normalizedOwnerEmail !== "owner@example.com") {
    await db.digestRecipient.updateMany({
      where: {
        researchStreamId: input.researchStreamId,
        email: "owner@example.com"
      },
      data: {
        enabled: false,
        isOwnerDefault: false
      }
    });
  }
}
