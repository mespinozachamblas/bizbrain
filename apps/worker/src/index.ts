import type { JobName } from "@bizbrain/core";
import { workerJobs } from "./jobs/registry";

const jobName = process.argv[2];

async function main() {
  if (!jobName) {
    console.log("BizBrain worker scaffold");
    console.log(`Available jobs: ${Object.keys(workerJobs).join(", ")}`);
    return;
  }

  const job = workerJobs[jobName as JobName];

  if (!job) {
    throw new Error(`Unknown job: ${jobName}`);
  }

  await job();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
