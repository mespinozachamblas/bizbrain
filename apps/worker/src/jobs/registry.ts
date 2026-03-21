import type { JobName } from "@bizbrain/core";
import { runDailyDigestEmail } from "./daily-digest-email";
import { runDailyEnrichScore } from "./daily-enrich-score";
import { runDailyIngest } from "./daily-ingest";
import { runDailySocialMediaDigestEmail } from "./daily-social-media-digest-email";
import { runWeeklyMaintenance } from "./weekly-maintenance";

export const workerJobs: Record<JobName, () => Promise<void>> = {
  "daily-digest-email": runDailyDigestEmail,
  "daily-enrich-score": runDailyEnrichScore,
  "daily-ingest": runDailyIngest,
  "daily-social-media-digest-email": runDailySocialMediaDigestEmail,
  "weekly-maintenance": runWeeklyMaintenance
};
