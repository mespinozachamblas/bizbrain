import { logJobBoundary, runJobWithTracking } from "./shared";

export async function runDailyDigestEmail() {
  await runJobWithTracking({
    jobName: "daily-digest-email",
    execute: async (context) => {
      await context.markProgress({
        recordsRead: 0,
        recordsWritten: 0,
        warnings: ["Digest selection, rendering, and delivery are not wired yet."]
      });

      logJobBoundary(
        "daily-digest-email",
        "Placeholder digest runner. Implement selection, rendering, per-recipient delivery, and delivery logging here."
      );
    }
  });
}
