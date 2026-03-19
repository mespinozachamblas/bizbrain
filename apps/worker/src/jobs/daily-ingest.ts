import { logJobBoundary, runJobWithTracking } from "./shared";

export async function runDailyIngest() {
  await runJobWithTracking({
    jobName: "daily-ingest",
    execute: async (context) => {
      const sourceConfigs = await import("@bizbrain/db").then(({ db }) =>
        db.sourceConfig.findMany({
          where: { enabled: true },
          orderBy: { sourceType: "asc" }
        })
      );

      await context.markProgress({
        recordsRead: sourceConfigs.length,
        recordsWritten: 0,
        warnings: sourceConfigs.length === 0 ? ["No enabled source configs found for ingest."] : []
      });

      if (sourceConfigs.length === 0) {
        logJobBoundary("daily-ingest", "No enabled source configs found. Job completed without ingest work.");
        return;
      }

      for (const sourceConfig of sourceConfigs) {
        await context.createSourceRun({
          sourceConfigId: sourceConfig.id,
          status: "skipped",
          warnings: {
            reason: "Source adapter implementation not wired yet.",
            sourceType: sourceConfig.sourceType
          }
        });
      }

      logJobBoundary(
        "daily-ingest",
        `Prepared ingest fanout for ${sourceConfigs.length} source configuration(s). Source adapters are still placeholders.`
      );
    }
  });
}
