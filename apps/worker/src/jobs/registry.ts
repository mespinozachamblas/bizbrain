import type { JobName } from "@bizbrain/core";
import { runDailyDigestEmail } from "./daily-digest-email";
import { runDailyEnrichScore } from "./daily-enrich-score";
import { runDailyIngest } from "./daily-ingest";
import { runWeeklyMaintenance } from "./weekly-maintenance";

export const workerJobs: Record<JobName, () => Promise<void>> = {
  "daily-digest-email": runDailyDigestEmail,
  "daily-enrich-score": runDailyEnrichScore,
  "daily-ingest": runDailyIngest,
  "weekly-maintenance": runWeeklyMaintenance
};
