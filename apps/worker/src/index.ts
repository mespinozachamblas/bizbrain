import type { JobName } from "@bizbrain/core";
import { runDailyDigestEmail } from "./jobs/daily-digest-email";
import { runDailyEnrichScore } from "./jobs/daily-enrich-score";
import { runDailyIngest } from "./jobs/daily-ingest";
import { runWeeklyMaintenance } from "./jobs/weekly-maintenance";

const jobName = process.argv[2];

const jobs: Record<JobName, () => Promise<void>> = {
  "daily-digest-email": runDailyDigestEmail,
  "daily-enrich-score": runDailyEnrichScore,
  "daily-ingest": runDailyIngest,
  "weekly-maintenance": runWeeklyMaintenance
};

async function main() {
  if (!jobName) {
    console.log("BizBrain worker scaffold");
    console.log(`Available jobs: ${Object.keys(jobs).join(", ")}`);
    return;
  }

  const job = jobs[jobName as JobName];

  if (!job) {
    throw new Error(`Unknown job: ${jobName}`);
  }

  await job();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
