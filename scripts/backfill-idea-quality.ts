import { db } from "../packages/db/src";
import { buildSourceAttribution, inferFallbackQuality } from "../apps/worker/src/jobs/idea-quality";

async function main() {
  const ideas = await db.idea.findMany({
    include: {
      cluster: {
        include: {
          memberships: {
            include: {
              rawSignal: {
                select: {
                  sourceType: true,
                  title: true,
                  sourceUrl: true
                }
              }
            }
          }
        }
      }
    }
  });

  let updated = 0;

  for (const idea of ideas) {
    const sourceAttribution = buildSourceAttribution(idea.cluster.memberships);
    const fallbackQuality = inferFallbackQuality({
      category: idea.category,
      businessType: idea.businessType ?? "Unknown business type",
      targetCustomer: idea.targetCustomer ?? "Founder / operator",
      problemSummary: idea.problemSummary ?? idea.evidenceSummary ?? "Needs manual review.",
      solutionConcept: idea.solutionConcept ?? "Solution shape still needs refinement.",
      monetizationAngle: idea.monetizationAngle ?? "Revenue model still needs validation.",
      signalCount: idea.cluster.signalCount,
      sourceAttribution
    });

    await db.idea.update({
      where: { id: idea.id },
      data: {
        qualityScore: fallbackQuality.qualityScore,
        qualityReason: fallbackQuality.qualityReason,
        sourceAttributionJson: sourceAttribution
      }
    });

    updated += 1;
  }

  console.log(`Backfilled quality and source attribution for ${updated} idea(s).`);
}

main()
  .catch((error) => {
    console.error("Failed to backfill idea quality", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
