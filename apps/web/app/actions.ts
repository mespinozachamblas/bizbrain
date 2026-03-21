"use server";

import type { JobName } from "@bizbrain/core";
import { db } from "@bizbrain/db";
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

export async function createResearchStream(formData: FormData) {
  const name = readRequiredString(formData, "name");
  const slugInput = readOptionalString(formData, "slug");
  const description = readOptionalString(formData, "description");
  const scheduleCron = readOptionalString(formData, "scheduleCron");
  const deliveryType = readOptionalString(formData, "deliveryType") ?? "email";
  const defaultAssetMode = readOptionalString(formData, "defaultAssetMode") ?? "none";
  const enabled = readBoolean(formData, "enabled", true);
  const enabledChannels = parseChannels(formData.get("enabledChannels"));
  const slug = slugify(slugInput ?? name);

  if (!slug) {
    throw new Error("Research stream slug is required.");
  }

  const existing = await db.researchStream.findUnique({ where: { slug } });

  if (existing) {
    throw new Error(`Research stream slug "${slug}" already exists.`);
  }

  await db.researchStream.create({
    data: {
      id: `stream-${slug}`,
      name,
      slug,
      description,
      enabled,
      enabledChannelsJson: enabledChannels,
      deliveryType,
      scheduleCron,
      defaultAssetMode
    }
  });

  revalidatePath("/");
}

export async function updateResearchStream(formData: FormData) {
  const id = readRequiredString(formData, "id");
  const name = readRequiredString(formData, "name");
  const slugInput = readRequiredString(formData, "slug");
  const description = readOptionalString(formData, "description");
  const scheduleCron = readOptionalString(formData, "scheduleCron");
  const deliveryType = readOptionalString(formData, "deliveryType") ?? "email";
  const defaultAssetMode = readOptionalString(formData, "defaultAssetMode") ?? "none";
  const enabled = readBoolean(formData, "enabled", false);
  const enabledChannels = parseChannels(formData.get("enabledChannels"));
  const slug = slugify(slugInput);

  if (!slug) {
    throw new Error("Research stream slug is required.");
  }

  const conflicting = await db.researchStream.findFirst({
    where: {
      slug,
      id: { not: id }
    },
    select: { id: true }
  });

  if (conflicting) {
    throw new Error(`Research stream slug "${slug}" already exists.`);
  }

  await db.researchStream.update({
    where: { id },
    data: {
      name,
      slug,
      description,
      enabled,
      enabledChannelsJson: enabledChannels,
      deliveryType,
      scheduleCron,
      defaultAssetMode
    }
  });

  revalidatePath("/");
}

function readRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} is required.`);
  }

  return value.trim();
}

function readOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readBoolean(formData: FormData, key: string, defaultValue: boolean) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return defaultValue;
  }

  return value === "on" || value === "true" || value === "1";
}

function parseChannels(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return [];
  }

  return [...new Set(value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean))];
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
