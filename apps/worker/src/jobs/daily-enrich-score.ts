import { logJobBoundary, runJobWithTracking } from "./shared";

export async function runDailyEnrichScore() {
  await runJobWithTracking({
    jobName: "daily-enrich-score",
    execute: async (context) => {
      await context.markProgress({
        recordsRead: 0,
        recordsWritten: 0,
        warnings: ["Enrichment, clustering, and scoring pipeline is not wired yet."]
      });

      logJobBoundary(
        "daily-enrich-score",
        "Placeholder enrich-and-score runner. Implement enrichment, clustering, scoring, and idea generation here."
      );
    }
  });
}
