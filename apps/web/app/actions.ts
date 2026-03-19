"use server";

import type { JobName } from "@bizbrain/core";
import { revalidatePath } from "next/cache";
import { workerJobs } from "../../worker/src/jobs/registry";
import { runSourceHealthCheck } from "./source-health";

export async function runPipelineJob(formData: FormData) {
  const jobName = formData.get("jobName");

  if (typeof jobName !== "string" || !(jobName in workerJobs)) {
    throw new Error("Unknown job requested.");
  }

  await workerJobs[jobName as JobName]();
  revalidatePath("/");
}

export async function runSourceCheck(formData: FormData) {
  const sourceConfigId = formData.get("sourceConfigId");

  if (typeof sourceConfigId !== "string" || sourceConfigId.length === 0) {
    throw new Error("Unknown source config requested.");
  }

  await runSourceHealthCheck(sourceConfigId);
  revalidatePath("/");
}
