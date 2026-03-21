import { db } from "@bizbrain/db";
import { buildClusterSlug, buildClusterTitle, buildIdeaTitle, enrichSignal, enrichSignalBatchWithModel } from "./enrichment";
import { buildSourceAttribution, inferFallbackQuality } from "./idea-quality";
import { logJobBoundary, runJobWithTracking } from "./shared";
import { syncSocialContentDrafts } from "./social-content";

export async function runDailyEnrichScore() {
  await runJobWithTracking({
    jobName: "daily-enrich-score",
    execute: async (context) => {
      const pendingSignals = await db.rawSignal.findMany({
        where: { enrichment: null },
        orderBy: { ingestedAt: "asc" }
      });

      await context.markProgress({
        recordsRead: pendingSignals.length,
        recordsWritten: 0,
        warnings: pendingSignals.length === 0 ? ["No raw signals require enrichment."] : []
      });

      if (pendingSignals.length === 0) {
        const socialDraftSync = await syncSocialContentDrafts();

        await context.markProgress({
          recordsRead: 0,
          recordsWritten: socialDraftSync.recordsWritten,
          warnings: [
            "No raw signals require enrichment.",
            ...socialDraftSync.warnings
          ]
        });

        logJobBoundary(
          "daily-enrich-score",
          `No pending raw signals found. Refreshed ${socialDraftSync.recordsWritten} social content draft(s).`
        );
        return;
      }

      let recordsWritten = 0;
      const warnings: string[] = [];
      const llmBatchSize = resolveEnrichmentBatchSize();
      const llmBatchDelayMs = resolveEnrichmentBatchDelayMs();
      const llmResults = new Map<string, Awaited<ReturnType<typeof enrichSignalBatchWithModel>> extends Map<string, infer TValue> ? TValue : never>();

      if (process.env.OPENAI_API_KEY) {
        const batches = chunkSignals(pendingSignals, llmBatchSize);

        for (let index = 0; index < batches.length; index += 1) {
          const batch = batches[index];

          try {
            const batchResults = await enrichSignalBatchWithModel(
              batch.map((rawSignal) => ({
                rawSignalId: rawSignal.id,
                title: rawSignal.title,
                body: rawSignal.body
              }))
            );

            for (const [rawSignalId, enrichment] of batchResults.entries()) {
              llmResults.set(rawSignalId, enrichment);
            }
          } catch (error) {
            warnings.push(error instanceof Error ? error.message : String(error));
          }

          if (index < batches.length - 1 && llmBatchDelayMs > 0) {
            await sleep(llmBatchDelayMs);
          }
        }
      }

      for (const rawSignal of pendingSignals) {
        const fallbackEnrichment = enrichSignal({
          title: rawSignal.title,
          body: rawSignal.body
        });
        const llmEnrichment = llmResults.get(rawSignal.id) ?? null;
        const enrichment = llmEnrichment ?? fallbackEnrichment;

        const enrichedSignal = await db.enrichedSignal.upsert({
          where: { rawSignalId: rawSignal.id },
          update: {
            normalizedText: enrichment.normalizedText,
            keywordsJson: enrichment.keywords,
            entitiesJson: enrichment.entities,
            painPointsJson: enrichment.painPoints,
            intentPhrasesJson: enrichment.intentPhrases,
            categoryTagsJson: enrichment.categoryTags,
            confidenceJson: enrichment.confidence
          },
          create: {
            rawSignalId: rawSignal.id,
            normalizedText: enrichment.normalizedText,
            keywordsJson: enrichment.keywords,
            entitiesJson: enrichment.entities,
            painPointsJson: enrichment.painPoints,
            intentPhrasesJson: enrichment.intentPhrases,
            categoryTagsJson: enrichment.categoryTags,
            confidenceJson: enrichment.confidence
          }
        });

        const clusterSlug = buildClusterSlug(enrichment.primaryCategory, enrichment.clusterSeed);
        const existingMembership = await db.clusterMembership.findFirst({
          where: { rawSignalId: rawSignal.id }
        });

        const cluster = await db.trendCluster.upsert({
          where: { slug: clusterSlug },
          update: {
            title: buildClusterTitle(enrichment.primaryCategory, enrichment.clusterSeed),
            summary: enrichment.summary,
            primaryCategory: enrichment.primaryCategory,
            tagsJson: enrichment.categoryTags,
            lastSeenAt: rawSignal.occurredAt ?? rawSignal.ingestedAt,
            status: "open"
          },
          create: {
            slug: clusterSlug,
            title: buildClusterTitle(enrichment.primaryCategory, enrichment.clusterSeed),
            summary: enrichment.summary,
            primaryCategory: enrichment.primaryCategory,
            tagsJson: enrichment.categoryTags,
            firstSeenAt: rawSignal.occurredAt ?? rawSignal.ingestedAt,
            lastSeenAt: rawSignal.occurredAt ?? rawSignal.ingestedAt,
            status: "open"
          }
        });

        if (!existingMembership) {
          await db.clusterMembership.create({
            data: {
              clusterId: cluster.id,
              rawSignalId: rawSignal.id,
              enrichedSignalId: enrichedSignal.id,
              membershipReason: `Grouped by deterministic category ${enrichment.primaryCategory} and seed ${enrichment.clusterSeed}.`,
              similarityScore: 0.8
            }
          });
        }

        const clusterSignalCount = await db.clusterMembership.count({
          where: { clusterId: cluster.id }
        });

        const clusterMemberships = await db.clusterMembership.findMany({
          where: { clusterId: cluster.id },
          include: {
            rawSignal: {
              select: {
                sourceType: true,
                title: true,
                sourceUrl: true
              }
            }
          }
        });

        const scoreFrequency = clusterSignalCount;
        const scoreMomentum = Math.min(clusterSignalCount * 0.4, 5);
        const scoreIntent = enrichment.intentPhrases.length > 0 ? 2 : 1;
        const scoreWhitespace = 1.5;
        const scoreFit = enrichment.categoryTags.length > 0 ? 2 : 1;
        const scoreComplexity = /finance|fintech/.test(enrichment.primaryCategory) ? 3 : 1;
        const scoreFeasibility = 3;
        const scoreTotal =
          scoreFrequency + scoreMomentum + scoreIntent + scoreWhitespace + scoreFit + scoreFeasibility - scoreComplexity;

        await db.trendCluster.update({
          where: { id: cluster.id },
          data: {
            signalCount: clusterSignalCount,
            scoreTotal,
            scoreFrequency,
            scoreMomentum,
            scoreIntent,
            scoreWhitespace,
            scoreFit,
            scoreComplexity,
            scoreFeasibility
          }
        });

        const existingIdea = await db.idea.findFirst({
          where: { clusterId: cluster.id }
        });

        const sourceAttribution = buildSourceAttribution(clusterMemberships);
        const fallbackQuality = inferFallbackQuality({
          category: enrichment.primaryCategory,
          businessType: llmEnrichment?.idea.businessType ?? inferFallbackBusinessType(enrichment.primaryCategory, enrichment.clusterSeed),
          targetCustomer: llmEnrichment?.idea.targetCustomer ?? "Founder / operator",
          problemSummary: llmEnrichment?.idea.problemSummary ?? enrichment.summary,
          solutionConcept:
            llmEnrichment?.idea.solutionConcept ??
            `Build a lightweight ${enrichment.primaryCategory} workflow tool around ${enrichment.clusterSeed}.`,
          monetizationAngle:
            llmEnrichment?.idea.monetizationAngle ?? "Subscription SaaS with premium workflow automation.",
          signalCount: clusterSignalCount,
          sourceAttribution
        });

        const ideaData = {
          title: llmEnrichment?.idea.title ?? buildIdeaTitle(cluster.title),
          category: enrichment.primaryCategory,
          subcategory: enrichment.categoryTags[1] ?? null,
          businessType:
            llmEnrichment?.idea.businessType ?? inferFallbackBusinessType(enrichment.primaryCategory, enrichment.clusterSeed),
          targetCustomer: llmEnrichment?.idea.targetCustomer ?? "Founder / operator",
          problemSummary: llmEnrichment?.idea.problemSummary ?? enrichment.summary,
          solutionConcept:
            llmEnrichment?.idea.solutionConcept ??
            `Build a lightweight ${enrichment.primaryCategory} workflow tool around ${enrichment.clusterSeed}.`,
          monetizationAngle:
            llmEnrichment?.idea.monetizationAngle ?? "Subscription SaaS with premium workflow automation.",
          gtmJson: ["Founder communities", "Direct outreach", "Content-driven validation"],
          validationQuestionsJson:
            llmEnrichment?.idea.validationQuestions ?? [
              `How often does the ${enrichment.clusterSeed} problem recur?`,
              "Will operators pay for a narrower workflow-specific tool?"
            ],
          evidenceSummary: llmEnrichment?.idea.evidenceSummary ?? enrichment.summary,
          riskNotes:
            llmEnrichment?.idea.riskNotes ??
            "Deterministic baseline only. Requires manual validation and later model-assisted refinement.",
          qualityScore: llmEnrichment?.idea.qualityScore ?? fallbackQuality.qualityScore,
          qualityReason: llmEnrichment?.idea.qualityReason ?? fallbackQuality.qualityReason,
          sourceAttributionJson: sourceAttribution,
          scoreSnapshot: {
            scoreTotal,
            scoreFrequency,
            scoreMomentum,
            scoreIntent,
            scoreWhitespace,
            scoreFit,
            scoreComplexity,
            scoreFeasibility
          },
          status: "new"
        } as const;

        if (!existingIdea) {
          await db.idea.create({
            data: {
              clusterId: cluster.id,
              ...ideaData
            }
          });
        } else {
          await db.idea.update({
            where: { id: existingIdea.id },
            data: ideaData
          });
        }

        recordsWritten += existingIdea ? 3 : 4;
      }

      const socialDraftSync = await syncSocialContentDrafts();
      recordsWritten += socialDraftSync.recordsWritten;
      warnings.push(...socialDraftSync.warnings);

      await context.markProgress({
        recordsRead: pendingSignals.length,
        recordsWritten,
        warnings
      });

      logJobBoundary(
        "daily-enrich-score",
        `Enriched ${pendingSignals.length} raw signal(s), updated clusters, and refreshed scores.`
      );
    }
  });
}

function chunkSignals<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function resolveEnrichmentBatchSize() {
  const parsed = Number(process.env.OPENAI_ENRICH_BATCH_SIZE ?? "3");

  if (!Number.isInteger(parsed) || parsed < 1) {
    return 3;
  }

  return Math.min(parsed, 5);
}

function resolveEnrichmentBatchDelayMs() {
  const parsed = Number(process.env.OPENAI_ENRICH_BATCH_DELAY_MS ?? "1500");

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 1500;
  }

  return parsed;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


function inferFallbackBusinessType(primaryCategory: string, clusterSeed: string) {
  const haystack = `${primaryCategory} ${clusterSeed}`.toLowerCase();

  if (/(marketplace|directory|agency)/.test(haystack)) {
    return "Service business";
  }

  if (/(finance|fintech|automation|saas|workflow|software)/.test(haystack)) {
    return "Software app / SaaS";
  }

  return "Digital product";
}
