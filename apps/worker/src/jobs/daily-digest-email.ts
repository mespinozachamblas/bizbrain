import { digestSectionSchema } from "@bizbrain/core";
import { db } from "@bizbrain/db";
import { buildDigestSubject, renderDigestHtml, renderDigestMarkdown, sendWithResend } from "@bizbrain/email";
import { logJobBoundary, runJobWithTracking } from "./shared";

export async function runDailyDigestEmail() {
  await runJobWithTracking({
    jobName: "daily-digest-email",
    execute: async (context) => {
      const digestDate = context.logicalDate.toISOString().slice(0, 10);
      const generatedAt = new Date().toISOString();
      const appBaseUrl = resolveAppBaseUrl();
      const ownerEmail = process.env.OWNER_EMAIL;

      if (ownerEmail) {
        await syncOwnerRecipient(ownerEmail);
      }

      const [ideas, clusters, failedJobs, failedSourceChecks, recipients] = await Promise.all([
        db.idea.findMany({
          orderBy: { updatedAt: "desc" },
          take: 50,
          include: { cluster: true }
        }),
        db.trendCluster.findMany({
          orderBy: [{ scoreTotal: "desc" }, { updatedAt: "desc" }],
          take: 20
        }),
        db.jobRun.findMany({
          where: { runStatus: "failed" },
          orderBy: { startedAt: "desc" },
          take: 5
        }),
        db.sourceHealthCheck.findMany({
          where: { checkStatus: "failed" },
          orderBy: { checkedAt: "desc" },
          take: 5
        }),
        db.digestRecipient.findMany({
          where: { enabled: true },
          orderBy: [{ isOwnerDefault: "desc" }, { email: "asc" }]
        })
      ]);

      const sections = buildDigestSections({ ideas, clusters, failedJobs, failedSourceChecks });
      const subject = buildDigestSubject(digestDate);
      const markdownBody = renderDigestMarkdown({ digestDate, generatedAt, sections, appBaseUrl });
      const htmlBody = renderDigestHtml({ digestDate, generatedAt, sections, appBaseUrl });
      const digestKey = `digest:${digestDate}`;

      const digest = await db.digest.upsert({
        where: { digestKey },
        update: {
          subject,
          markdownBody,
          htmlBody,
          selectionJson: sections,
          status: recipients.length > 0 ? "ready" : "skipped"
        },
        create: {
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
        warnings.push("No enabled digest recipients are configured.");
      }

      const resendApiKey = process.env.RESEND_API_KEY;
      const emailFrom = process.env.EMAIL_FROM;
      const replyTo = parseReplyTo(process.env.DIGEST_REPLY_TO);

      if (!resendApiKey) {
        warnings.push("RESEND_API_KEY is not configured. Digest content was stored but no email was sent.");
      }

      if (!emailFrom) {
        warnings.push("EMAIL_FROM is not configured. Digest content was stored but no email was sent.");
      }

      let deliveryAttempts = 0;
      let deliveryWrites = 1;

      for (const recipient of recipients) {
        const deliveryKey = `digest:${digestDate}:${recipient.email.toLowerCase()}`;
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

      await db.digest.update({
        where: { id: digest.id },
        data: {
          status: recipients.length === 0 ? "skipped" : successfulSendCount > 0 ? "sent" : "failed",
          sentAt: successfulSendCount > 0 ? new Date() : null
        }
      });

      await context.markProgress({
        recordsRead: ideas.length + clusters.length + failedJobs.length + failedSourceChecks.length + recipients.length,
        recordsWritten: deliveryWrites,
        warnings
      });

      logJobBoundary("daily-digest-email", `Prepared digest ${digestKey} and processed ${deliveryAttempts} delivery attempt(s).`);
    }
  });
}

type DigestInputs = {
  ideas: Awaited<ReturnType<typeof db.idea.findMany>>;
  clusters: Awaited<ReturnType<typeof db.trendCluster.findMany>>;
  failedJobs: Awaited<ReturnType<typeof db.jobRun.findMany>>;
  failedSourceChecks: Awaited<ReturnType<typeof db.sourceHealthCheck.findMany>>;
};

type DigestIdeaRecord = DigestInputs["ideas"][number] & {
  businessType?: string | null;
  cluster?: {
    id: string;
    title: string;
    summary: string | null;
    primaryCategory: string;
    scoreTotal: number;
    signalCount: number;
  } | null;
};

function buildDigestSections(input: DigestInputs) {
  const rankedIdeas = rankDigestIdeas(input.ideas);
  const topIdeas = rankedIdeas.slice(0, 3);
  const curatedClusters = collectClustersFromIdeas(topIdeas.length > 0 ? topIdeas : rankedIdeas.slice(0, 3));
  const risingClusters = curatedClusters.length > 0 ? curatedClusters : rankDigestClusters(input.clusters).slice(0, 3);
  const fintechIdeas = rankedIdeas.filter((idea) => idea.category.includes("fintech")).slice(0, 3);
  const financeProductIdeas = rankedIdeas.filter((idea) => idea.category.includes("finance-product")).slice(0, 3);
  const healthAlerts = [
    ...input.failedJobs.map((job) => `Job ${job.jobName} failed at ${job.startedAt.toISOString()}.`),
    ...input.failedSourceChecks.map(
      (check) => `Source check failed for source config ${check.sourceConfigId}: ${check.responseSummary ?? "No summary provided"}.`
    )
  ].slice(0, 5);

  return [
    {
      sectionTitle: "Top New Opportunities",
      items:
        topIdeas.length > 0
          ? topIdeas.map((idea) => formatIdeaDigestLine(idea))
          : ["No new ideas were available when this digest was generated."],
      alerts: [],
      plainLanguageSummary:
        topIdeas.length > 0
          ? "These are the newest idea records, with the business type and product shape called out more explicitly."
          : "The pipeline did not have any new idea records ready yet."
    },
    {
      sectionTitle: "Fastest-Rising Clusters",
      items:
        risingClusters.length > 0
          ? risingClusters.map(
              (cluster) =>
                `${cluster.title} — score ${cluster.scoreTotal.toFixed(1)}, ${cluster.signalCount} signals, ${summarizeDigestText(cluster.summary ?? "No summary yet.", 220)}`
            )
          : ["No clusters are available yet."],
      alerts: [],
      plainLanguageSummary:
        risingClusters.length > 0
          ? "These clusters currently rank highest by the deterministic score baseline."
          : "Clusters will appear after ingest and enrich-score have both run."
    },
    {
      sectionTitle: "Top Fintech Ideas",
      items:
        fintechIdeas.length > 0
          ? fintechIdeas.map((idea) => formatIdeaDigestLine(idea))
          : ["No fintech-specific ideas are available yet."],
      alerts: [],
      plainLanguageSummary:
        fintechIdeas.length > 0
          ? "This is the current fintech subset from the idea backlog, with the likely business model made explicit."
          : "No ideas currently classify into the fintech category."
    },
    {
      sectionTitle: "Top Finance Product Concepts",
      items:
        financeProductIdeas.length > 0
          ? financeProductIdeas.map((idea) => formatIdeaDigestLine(idea))
          : ["No finance product concepts are available yet."],
      alerts: [],
      plainLanguageSummary:
        financeProductIdeas.length > 0
          ? "These ideas are tagged most closely to finance product demand signals, with a clearer read on what kind of business each one is."
          : "No ideas currently classify into the finance-product category."
    },
    {
      sectionTitle: "Pipeline Health Notes",
      items:
        healthAlerts.length > 0
          ? healthAlerts
          : ["No failed jobs or failed source health checks were found in the latest review window."],
      alerts:
        healthAlerts.length > 0
          ? ["Investigate failed jobs or source checks before trusting the digest as complete."]
          : [],
      plainLanguageSummary:
        healthAlerts.length > 0
          ? "These notes capture recent operational issues that may affect digest completeness."
          : "No recent operational issues were detected across jobs or source checks."
    }
  ].map((section) => digestSectionSchema.parse(section));
}

function parseReplyTo(input: string | undefined) {
  if (!input) {
    return undefined;
  }

  const values = input
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return values.length > 0 ? values : undefined;
}

function resolveAppBaseUrl() {
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL;
  }

  if (process.env.RAILWAY_SERVICE_WEB_URL) {
    return `https://${process.env.RAILWAY_SERVICE_WEB_URL}`;
  }

  return undefined;
}

function formatIdeaDigestLine(idea: DigestIdeaRecord) {
  const businessType = inferBusinessType(idea);
  const targetCustomer = idea.targetCustomer?.trim() || "Unclear buyer";
  const problemSummary = summarizeDigestText(idea.problemSummary ?? idea.evidenceSummary ?? "Needs manual review.", 220);
  const solutionConcept = summarizeDigestText(idea.solutionConcept ?? "Solution shape still needs refinement.", 220);
  const monetization = summarizeDigestText(idea.monetizationAngle ?? "Revenue model still needs validation.", 180);

  return [
    `${idea.title} [${businessType}]`,
    `Customer: ${targetCustomer}`,
    `Problem: ${problemSummary}`,
    `Business: ${solutionConcept}`,
    `Monetization: ${monetization}`
  ].join(" | ");
}

function inferBusinessType(idea: DigestIdeaRecord) {
  if (idea.businessType?.trim()) {
    return idea.businessType.trim();
  }

  const haystack = [idea.title, idea.category, idea.solutionConcept, idea.monetizationAngle]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/(marketplace|directory|matching|lead marketplace)/.test(haystack)) {
    return "Online marketplace";
  }

  if (/(platform|web app|app|dashboard|workflow tool|software|saas|crm|toolkit)/.test(haystack)) {
    return "Software app / SaaS";
  }

  if (/(service|agency|managed outreach|done-for-you|consulting)/.test(haystack)) {
    return "Service business";
  }

  if (/(community|newsletter|media|content)/.test(haystack)) {
    return "Media / community product";
  }

  if (/(device|hardware|physical|consumer product|inventory)/.test(haystack)) {
    return "Physical product";
  }

  return "Digital product";
}

function compressSentence(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function summarizeDigestText(input: string, maxLength: number) {
  const normalized = compressSentence(input)
    .replace(/\\-\s*/g, "")
    .replace(/\s*\|\s*/g, ", ")
    .trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const truncated = normalized.slice(0, maxLength);
  const boundary = Math.max(truncated.lastIndexOf(". "), truncated.lastIndexOf(", "), truncated.lastIndexOf(" "));
  const safeCutoff = boundary > maxLength * 0.6 ? boundary : maxLength;

  return `${truncated.slice(0, safeCutoff).trimEnd()}...`;
}

function rankDigestIdeas(ideas: DigestIdeaRecord[]) {
  return ideas
    .map((idea) => ({
      idea,
      quality: scoreDigestIdea(idea)
    }))
    .filter(({ quality }) => quality >= 6)
    .sort((left, right) => right.quality - left.quality || right.idea.updatedAt.getTime() - left.idea.updatedAt.getTime())
    .map(({ idea }) => idea);
}

function scoreDigestIdea(idea: DigestIdeaRecord) {
  let score = 0;

  if (idea.businessType?.trim()) {
    score += 3;
  }

  if (idea.targetCustomer && idea.targetCustomer !== "Founder / operator") {
    score += 2;
  }

  if (isSpecificDigestText(idea.problemSummary)) {
    score += 3;
  }

  if (isSpecificDigestText(idea.solutionConcept) && !/build a lightweight/i.test(idea.solutionConcept ?? "")) {
    score += 4;
  }

  if (isSpecificDigestText(idea.monetizationAngle) && !/subscription saas with premium workflow automation/i.test(idea.monetizationAngle ?? "")) {
    score += 3;
  }

  if (idea.category !== "general") {
    score += 1;
  }

  if (!/\bopportunity\b/i.test(idea.title)) {
    score += 1;
  }

  return score;
}

function isSpecificDigestText(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const normalized = compressSentence(value);

  if (normalized.length < 40) {
    return false;
  }

  if (/^recurring\s+/i.test(normalized)) {
    return false;
  }

  if (/around\s+[a-z]{2,12}\.?$/i.test(normalized)) {
    return false;
  }

  return true;
}

function collectClustersFromIdeas(ideas: DigestIdeaRecord[]) {
  const seen = new Set<string>();

  return ideas
    .map((idea) => idea.cluster)
    .filter(
      (
        cluster
      ): cluster is NonNullable<
        NonNullable<DigestIdeaRecord["cluster"]>
      > => Boolean(cluster)
    )
    .filter((cluster) => {
      if (seen.has(cluster.id)) {
        return false;
      }

      seen.add(cluster.id);
      return true;
    })
    .slice(0, 3);
}

function rankDigestClusters(clusters: DigestInputs["clusters"]) {
  return clusters.filter((cluster) => {
    if (cluster.primaryCategory === "general") {
      return false;
    }

    return isSpecificDigestText(cluster.summary);
  });
}

async function syncOwnerRecipient(ownerEmail: string) {
  const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();

  await db.digestRecipient.updateMany({
    where: {
      isOwnerDefault: true,
      email: { not: normalizedOwnerEmail }
    },
    data: {
      isOwnerDefault: false
    }
  });

  await db.digestRecipient.upsert({
    where: { email: normalizedOwnerEmail },
    update: {
      enabled: true,
      isOwnerDefault: true
    },
    create: {
      email: normalizedOwnerEmail,
      enabled: true,
      isOwnerDefault: true
    }
  });

  if (normalizedOwnerEmail !== "owner@example.com") {
    await db.digestRecipient.updateMany({
      where: { email: "owner@example.com" },
      data: {
        enabled: false,
        isOwnerDefault: false
      }
    });
  }
}
