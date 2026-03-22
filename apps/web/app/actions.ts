"use server";

import { sourceAdapterConfigSchema, sourceTypes, type JobName } from "@bizbrain/core";
import { db } from "@bizbrain/db";
import { revalidatePath } from "next/cache";
import { regenerateIdeaById } from "../../worker/src/jobs/daily-enrich-score";
import { workerJobs } from "../../worker/src/jobs/registry";
import { regenerateSocialDraftById } from "../../worker/src/jobs/social-content";
import { runSourceHealthCheck } from "./source-health";

export async function runPipelineJob(formData: FormData) {
  const jobName = formData.get("jobName");

  if (typeof jobName !== "string" || !(jobName in workerJobs)) {
    throw new Error("Unknown job requested.");
  }

  await workerJobs[jobName as JobName]();
  revalidatePath("/");
  revalidatePath("/recipients");
  revalidatePath("/sources");
  revalidatePath("/ideas");
  revalidatePath("/social-drafts");
}

export async function runSourceCheck(formData: FormData) {
  const sourceConfigId = formData.get("sourceConfigId");

  if (typeof sourceConfigId !== "string" || sourceConfigId.length === 0) {
    throw new Error("Unknown source config requested.");
  }

  await runSourceHealthCheck(sourceConfigId);
  revalidatePath("/");
  revalidatePath("/sources");
}

export async function createSourceConfig(formData: FormData) {
  const sourceType = readRequiredString(formData, "sourceType");
  const enabled = readBoolean(formData, "enabled", true);
  const researchStreamIds = readStringList(formData, "researchStreamIds");
  const topicIds = readStringList(formData, "topicIds");
  const nicheModes = parseCommaSeparatedString(readOptionalString(formData, "nicheModes"));
  const configJson = parseConfigJson(readRequiredString(formData, "configJson"));
  const changeReason = readOptionalString(formData, "changeReason") ?? "Initial source config creation";

  if (!sourceTypes.includes(sourceType as (typeof sourceTypes)[number])) {
    throw new Error(`Unsupported source type: ${sourceType}`);
  }

  await validateSourceRelations({ researchStreamIds, topicIds });

  await db.$transaction(async (tx) => {
    const sourceConfig = await tx.sourceConfig.create({
      data: {
        sourceType,
        enabled,
        researchStreamIdsJson: researchStreamIds,
        topicIdsJson: topicIds,
        nicheModes,
        configJson
      }
    });

    await tx.sourceConfigVersion.create({
      data: {
        sourceConfigId: sourceConfig.id,
        versionNumber: 1,
        configJson: {
          sourceType,
          enabled,
          researchStreamIds,
          topicIds,
          nicheModes,
          configJson
        },
        changeReason
      }
    });
  });

  revalidatePath("/");
  revalidatePath("/sources");
}

export async function updateSourceConfig(formData: FormData) {
  const id = readRequiredString(formData, "id");
  const sourceType = readRequiredString(formData, "sourceType");
  const enabled = readBoolean(formData, "enabled", false);
  const researchStreamIds = readStringList(formData, "researchStreamIds");
  const topicIds = readStringList(formData, "topicIds");
  const nicheModes = parseCommaSeparatedString(readOptionalString(formData, "nicheModes"));
  const configJson = parseConfigJson(readRequiredString(formData, "configJson"));
  const changeReason = readOptionalString(formData, "changeReason") ?? "Updated source config from dashboard";

  if (!sourceTypes.includes(sourceType as (typeof sourceTypes)[number])) {
    throw new Error(`Unsupported source type: ${sourceType}`);
  }

  await validateSourceRelations({ researchStreamIds, topicIds });

  await db.$transaction(async (tx) => {
    const latestVersion = await tx.sourceConfigVersion.findFirst({
      where: { sourceConfigId: id },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true }
    });

    await tx.sourceConfig.update({
      where: { id },
      data: {
        sourceType,
        enabled,
        researchStreamIdsJson: researchStreamIds,
        topicIdsJson: topicIds,
        nicheModes,
        configJson
      }
    });

    await tx.sourceConfigVersion.create({
      data: {
        sourceConfigId: id,
        versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
        configJson: {
          sourceType,
          enabled,
          researchStreamIds,
          topicIds,
          nicheModes,
          configJson
        },
        changeReason
      }
    });
  });

  revalidatePath("/");
  revalidatePath("/sources");
}

export async function updateContentDraftStatus(formData: FormData) {
  const id = readRequiredString(formData, "id");
  const status = readRequiredString(formData, "status");
  const allowedStatuses = new Set(["draft", "promising", "revisit", "ignore", "publish-later"]);

  if (!allowedStatuses.has(status)) {
    throw new Error(`Unsupported content draft status: ${status}`);
  }

  await db.contentDraft.update({
    where: { id },
    data: { status }
  });

  revalidatePath("/");
  revalidatePath("/social-drafts");
}

export async function updateIdeaStatus(formData: FormData) {
  const id = readRequiredString(formData, "id");
  const status = readRequiredString(formData, "status");
  const allowedStatuses = new Set(["new", "promising", "revisit", "ignore"]);

  if (!allowedStatuses.has(status)) {
    throw new Error(`Unsupported idea status: ${status}`);
  }

  await db.idea.update({
    where: { id },
    data: { status }
  });

  revalidatePath("/");
  revalidatePath("/ideas");
}

export async function regenerateIdea(formData: FormData) {
  const id = readRequiredString(formData, "id");

  await regenerateIdeaById(id);

  revalidatePath("/");
  revalidatePath("/ideas");
  revalidatePath("/social-drafts");
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

export async function createTopic(formData: FormData) {
  const researchStreamId = readRequiredString(formData, "researchStreamId");
  const name = readRequiredString(formData, "name");
  const slugInput = readOptionalString(formData, "slug");
  const description = readOptionalString(formData, "description");
  const defaultAssetMode = readOptionalString(formData, "defaultAssetMode");
  const defaultCopyFrameworkId = readOptionalString(formData, "defaultCopyFrameworkId");
  const defaultStyleProfileId = readOptionalString(formData, "defaultStyleProfileId");
  const enabled = readBoolean(formData, "enabled", true);
  const enabledChannels = parseChannels(formData.get("enabledChannels"));
  const keywords = parseList(formData.get("keywords"));
  const exclusions = parseList(formData.get("exclusions"));
  const sourcePreferences = parseList(formData.get("sourcePreferences"));
  const slug = slugify(slugInput ?? name);

  if (!slug) {
    throw new Error("Topic slug is required.");
  }

  const stream = await db.researchStream.findUnique({
    where: { id: researchStreamId },
    select: { id: true }
  });

  if (!stream) {
    throw new Error("Unknown research stream requested.");
  }

  const existing = await db.topic.findFirst({
    where: {
      researchStreamId,
      slug
    },
    select: { id: true }
  });

  if (existing) {
    throw new Error(`Topic slug "${slug}" already exists in this research stream.`);
  }

  await db.topic.create({
    data: {
      id: `topic-${researchStreamId.replace(/^stream-/, "")}-${slug}`,
      researchStreamId,
      name,
      slug,
      description,
      enabled,
      enabledChannelsJson: enabledChannels,
      keywordsJson: keywords,
      exclusionsJson: exclusions,
      sourcePreferencesJson: sourcePreferences,
      defaultAssetMode,
      defaultCopyFrameworkId,
      defaultStyleProfileId
    }
  });

  revalidatePath("/");
}

export async function updateTopic(formData: FormData) {
  const id = readRequiredString(formData, "id");
  const researchStreamId = readRequiredString(formData, "researchStreamId");
  const name = readRequiredString(formData, "name");
  const slugInput = readRequiredString(formData, "slug");
  const description = readOptionalString(formData, "description");
  const defaultAssetMode = readOptionalString(formData, "defaultAssetMode");
  const defaultCopyFrameworkId = readOptionalString(formData, "defaultCopyFrameworkId");
  const defaultStyleProfileId = readOptionalString(formData, "defaultStyleProfileId");
  const enabled = readBoolean(formData, "enabled", false);
  const enabledChannels = parseChannels(formData.get("enabledChannels"));
  const keywords = parseList(formData.get("keywords"));
  const exclusions = parseList(formData.get("exclusions"));
  const sourcePreferences = parseList(formData.get("sourcePreferences"));
  const slug = slugify(slugInput);

  if (!slug) {
    throw new Error("Topic slug is required.");
  }

  const stream = await db.researchStream.findUnique({
    where: { id: researchStreamId },
    select: { id: true }
  });

  if (!stream) {
    throw new Error("Unknown research stream requested.");
  }

  const conflicting = await db.topic.findFirst({
    where: {
      researchStreamId,
      slug,
      id: { not: id }
    },
    select: { id: true }
  });

  if (conflicting) {
    throw new Error(`Topic slug "${slug}" already exists in this research stream.`);
  }

  await db.topic.update({
    where: { id },
    data: {
      researchStreamId,
      name,
      slug,
      description,
      enabled,
      enabledChannelsJson: enabledChannels,
      keywordsJson: keywords,
      exclusionsJson: exclusions,
      sourcePreferencesJson: sourcePreferences,
      defaultAssetMode,
      defaultCopyFrameworkId,
      defaultStyleProfileId
    }
  });

  revalidatePath("/");
}

export async function createCopyFramework(formData: FormData) {
  const name = readRequiredString(formData, "name");
  const slugInput = readOptionalString(formData, "slug");
  const description = readOptionalString(formData, "description");
  const enabled = readBoolean(formData, "enabled", true);
  const structure = parseList(formData.get("structure"));
  const slug = slugify(slugInput ?? name);

  if (!slug) {
    throw new Error("Copy framework slug is required.");
  }

  const existing = await db.copyFramework.findUnique({
    where: { slug },
    select: { id: true }
  });

  if (existing) {
    throw new Error(`Copy framework slug "${slug}" already exists.`);
  }

  await db.copyFramework.create({
    data: {
      id: `framework-${slug}`,
      name,
      slug,
      description,
      enabled,
      structureJson: structure
    }
  });

  revalidatePath("/");
}

export async function updateCopyFramework(formData: FormData) {
  const id = readRequiredString(formData, "id");
  const name = readRequiredString(formData, "name");
  const slugInput = readRequiredString(formData, "slug");
  const description = readOptionalString(formData, "description");
  const enabled = readBoolean(formData, "enabled", false);
  const structure = parseList(formData.get("structure"));
  const slug = slugify(slugInput);

  if (!slug) {
    throw new Error("Copy framework slug is required.");
  }

  const conflicting = await db.copyFramework.findFirst({
    where: {
      slug,
      id: { not: id }
    },
    select: { id: true }
  });

  if (conflicting) {
    throw new Error(`Copy framework slug "${slug}" already exists.`);
  }

  await db.copyFramework.update({
    where: { id },
    data: {
      name,
      slug,
      description,
      enabled,
      structureJson: structure
    }
  });

  revalidatePath("/");
}

export async function createStyleProfile(formData: FormData) {
  const name = readRequiredString(formData, "name");
  const slugInput = readOptionalString(formData, "slug");
  const description = readOptionalString(formData, "description");
  const inspirationSummary = readOptionalString(formData, "inspirationSummary");
  const enabled = readBoolean(formData, "enabled", true);
  const styleTraits = parseList(formData.get("styleTraits"));
  const guardrails = parseList(formData.get("guardrails"));
  const slug = slugify(slugInput ?? name);

  if (!slug) {
    throw new Error("Style profile slug is required.");
  }

  const existing = await db.styleProfile.findUnique({
    where: { slug },
    select: { id: true }
  });

  if (existing) {
    throw new Error(`Style profile slug "${slug}" already exists.`);
  }

  await db.styleProfile.create({
    data: {
      id: `style-${slug}`,
      name,
      slug,
      description,
      inspirationSummary,
      enabled,
      styleTraitsJson: styleTraits,
      guardrailsJson: guardrails
    }
  });

  revalidatePath("/");
}

export async function updateStyleProfile(formData: FormData) {
  const id = readRequiredString(formData, "id");
  const name = readRequiredString(formData, "name");
  const slugInput = readRequiredString(formData, "slug");
  const description = readOptionalString(formData, "description");
  const inspirationSummary = readOptionalString(formData, "inspirationSummary");
  const enabled = readBoolean(formData, "enabled", false);
  const styleTraits = parseList(formData.get("styleTraits"));
  const guardrails = parseList(formData.get("guardrails"));
  const slug = slugify(slugInput);

  if (!slug) {
    throw new Error("Style profile slug is required.");
  }

  const conflicting = await db.styleProfile.findFirst({
    where: {
      slug,
      id: { not: id }
    },
    select: { id: true }
  });

  if (conflicting) {
    throw new Error(`Style profile slug "${slug}" already exists.`);
  }

  await db.styleProfile.update({
    where: { id },
    data: {
      name,
      slug,
      description,
      inspirationSummary,
      enabled,
      styleTraitsJson: styleTraits,
      guardrailsJson: guardrails
    }
  });

  revalidatePath("/");
}

export async function regenerateContentDraft(formData: FormData) {
  const id = readRequiredString(formData, "id");

  await regenerateSocialDraftById(id);

  revalidatePath("/");
  revalidatePath("/ideas");
  revalidatePath("/social-drafts");
}

export async function createDigestRecipient(formData: FormData) {
  const researchStreamId = readRequiredString(formData, "researchStreamId");
  const email = readRequiredString(formData, "email").toLowerCase();
  const enabled = readBoolean(formData, "enabled", true);
  const isOwnerDefault = readBoolean(formData, "isOwnerDefault", false);

  const stream = await db.researchStream.findUnique({
    where: { id: researchStreamId },
    select: { id: true }
  });

  if (!stream) {
    throw new Error("Unknown research stream requested.");
  }

  const existing = await db.digestRecipient.findFirst({
    where: {
      researchStreamId,
      email
    },
    select: { id: true }
  });

  if (existing) {
    throw new Error(`Recipient "${email}" already exists for this research stream.`);
  }

  await db.$transaction(async (tx) => {
    if (isOwnerDefault) {
      await tx.digestRecipient.updateMany({
        where: { researchStreamId },
        data: { isOwnerDefault: false }
      });
    }

    await tx.digestRecipient.create({
      data: {
        researchStreamId,
        email,
        enabled,
        isOwnerDefault
      }
    });
  });

  revalidatePath("/");
  revalidatePath("/recipients");
}

export async function updateDigestRecipient(formData: FormData) {
  const id = readRequiredString(formData, "id");
  const researchStreamId = readRequiredString(formData, "researchStreamId");
  const email = readRequiredString(formData, "email").toLowerCase();
  const enabled = readBoolean(formData, "enabled", false);
  const isOwnerDefault = readBoolean(formData, "isOwnerDefault", false);

  const stream = await db.researchStream.findUnique({
    where: { id: researchStreamId },
    select: { id: true }
  });

  if (!stream) {
    throw new Error("Unknown research stream requested.");
  }

  const conflicting = await db.digestRecipient.findFirst({
    where: {
      researchStreamId,
      email,
      id: { not: id }
    },
    select: { id: true }
  });

  if (conflicting) {
    throw new Error(`Recipient "${email}" already exists for this research stream.`);
  }

  await db.$transaction(async (tx) => {
    if (isOwnerDefault) {
      await tx.digestRecipient.updateMany({
        where: { researchStreamId },
        data: { isOwnerDefault: false }
      });
    }

    await tx.digestRecipient.update({
      where: { id },
      data: {
        researchStreamId,
        email,
        enabled,
        isOwnerDefault
      }
    });
  });

  revalidatePath("/");
  revalidatePath("/recipients");
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

function readStringList(formData: FormData, key: string) {
  return [...new Set(formData
    .getAll(key)
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean))];
}

function parseChannels(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return [];
  }

  return parseList(value).map((entry) => entry.toLowerCase());
}

function parseList(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return [];
  }

  return [...new Set(value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean))];
}

function parseCommaSeparatedString(value: string | null) {
  if (!value) {
    return [];
  }

  return [...new Set(value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean))];
}

function parseConfigJson(value: string) {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("configJson must be valid JSON.");
  }

  return sourceAdapterConfigSchema.parse(parsed);
}

async function validateSourceRelations(input: { researchStreamIds: string[]; topicIds: string[] }) {
  if (input.researchStreamIds.length > 0) {
    const count = await db.researchStream.count({
      where: {
        id: { in: input.researchStreamIds }
      }
    });

    if (count !== input.researchStreamIds.length) {
      throw new Error("One or more selected research streams do not exist.");
    }
  }

  if (input.topicIds.length > 0) {
    const count = await db.topic.count({
      where: {
        id: { in: input.topicIds }
      }
    });

    if (count !== input.topicIds.length) {
      throw new Error("One or more selected topics do not exist.");
    }
  }
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
