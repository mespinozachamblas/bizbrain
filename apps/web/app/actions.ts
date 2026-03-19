"use server";

import type { JobName } from "@bizbrain/core";
import { revalidatePath } from "next/cache";
import { workerJobs } from "../../worker/src/jobs/registry";

export async function runPipelineJob(formData: FormData) {
  const jobName = formData.get("jobName");

  if (typeof jobName !== "string" || !(jobName in workerJobs)) {
    throw new Error("Unknown job requested.");
  }

  await workerJobs[jobName as JobName]();
  revalidatePath("/");
}
