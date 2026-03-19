import { runDailyDigestEmail } from "./jobs/daily-digest-email";
import { runDailyEnrichScore } from "./jobs/daily-enrich-score";
import { runDailyIngest } from "./jobs/daily-ingest";

const jobName = process.argv[2];

const jobs: Record<string, () => Promise<void>> = {
  "daily-digest-email": runDailyDigestEmail,
  "daily-enrich-score": runDailyEnrichScore,
  "daily-ingest": runDailyIngest
};

async function main() {
  if (!jobName) {
    console.log("BizBrain worker scaffold");
    console.log(`Available jobs: ${Object.keys(jobs).join(", ")}`);
    return;
  }

  const job = jobs[jobName];

  if (!job) {
    throw new Error(`Unknown job: ${jobName}`);
  }

  await job();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
