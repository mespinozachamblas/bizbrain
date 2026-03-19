import { db } from "@bizbrain/db";
import { buildClusterSlug, buildClusterTitle, buildIdeaTitle, enrichSignal } from "./enrichment";
import { logJobBoundary, runJobWithTracking } from "./shared";

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
        logJobBoundary("daily-enrich-score", "No pending raw signals found. Job completed without enrichment work.");
        return;
      }

      let recordsWritten = 0;

      for (const rawSignal of pendingSignals) {
        const enrichment = enrichSignal({
          title: rawSignal.title,
          body: rawSignal.body
        });

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

        if (!existingIdea) {
          await db.idea.create({
            data: {
              clusterId: cluster.id,
              title: buildIdeaTitle(cluster.title),
              category: enrichment.primaryCategory,
              subcategory: enrichment.categoryTags[1] ?? null,
              targetCustomer: "Founder / operator",
              problemSummary: enrichment.summary,
              solutionConcept: `Build a lightweight ${enrichment.primaryCategory} workflow tool around ${enrichment.clusterSeed}.`,
              monetizationAngle: "Subscription SaaS with premium workflow automation.",
              gtmJson: ["Founder communities", "Direct outreach", "Content-driven validation"],
              validationQuestionsJson: [
                `How often does the ${enrichment.clusterSeed} problem recur?`,
                "Will operators pay for a narrower workflow-specific tool?"
              ],
              evidenceSummary: enrichment.summary,
              riskNotes: "Deterministic baseline only. Requires manual validation and later model-assisted refinement.",
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
            }
          });
        }

        recordsWritten += existingIdea ? 3 : 4;
      }

      await context.markProgress({
        recordsRead: pendingSignals.length,
        recordsWritten
      });

      logJobBoundary(
        "daily-enrich-score",
        `Enriched ${pendingSignals.length} raw signal(s), updated clusters, and refreshed deterministic scores.`
      );
    }
  });
}
