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

      const [drafts, failedJobs, failedSourceChecks, recipients] = await Promise.all([
        db.contentDraft.findMany({
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
            sourceIdea: true
          }
        }),
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
        })
      ]);

      const sections = buildSocialDigestSections({
        drafts,
        failedJobs,
        failedSourceChecks
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
};

type SocialDigestDraft = Awaited<ReturnType<typeof db.contentDraft.findMany<{
  include: {
    topic: true;
    copyFramework: true;
    styleProfile: true;
    sourceIdea: true;
  };
}>>>[number];

function buildSocialDigestSections(input: SocialDigestInputs) {
  const linkedinDrafts = input.drafts.filter((draft) => draft.targetChannel === "linkedin").slice(0, 3);
  const xDrafts = input.drafts.filter((draft) => draft.targetChannel === "x").slice(0, 3);
  const infographicDrafts = input.drafts.filter((draft) => hasInfographicPanels(draft.infographicPanelsJson)).slice(0, 3);
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
          ? "These are the highest-quality LinkedIn-ready angles in the current social research queue."
          : "LinkedIn drafts will appear after the social-media stream has matched topics and generated content."
    },
    {
      sectionTitle: "Top X Drafts",
      items: xDrafts.length > 0 ? xDrafts.map((draft) => formatSocialDraftLine(draft)) : ["No X drafts are ready yet."],
      alerts: [],
      plainLanguageSummary:
        xDrafts.length > 0
          ? "These are the strongest short-form X angles currently in the draft queue."
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
  const parts = [
    `${draft.title}`,
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

  return [
    `${draft.title}`,
    `Format: ${draft.infographicFormat ?? "visual brief"}`,
    `Topic: ${draft.topic?.name ?? "Unassigned"}`,
    `Panels: ${panelSummary}`
  ].join(" | ");
}

function hasInfographicPanels(value: unknown) {
  return toStringArray(value).length >= 3;
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
