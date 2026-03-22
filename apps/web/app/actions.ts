"use server";

import { researchStreamIds, sourceAdapterConfigSchema, sourceTypes, type JobName } from "@bizbrain/core";
import { db } from "@bizbrain/db";
import { sendWithResend } from "@bizbrain/email";
import { revalidatePath } from "next/cache";
import { regenerateIdeaById } from "../../worker/src/jobs/daily-enrich-score";
import { workerJobs } from "../../worker/src/jobs/registry";
import { regenerateSocialDraftById } from "../../worker/src/jobs/social-content";
import { type ActionState } from "./action-forms";
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

export async function createSourceConfig(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const sourceType = readRequiredString(formData, "sourceType");
    const enabled = readBoolean(formData, "enabled", true);
    const researchStreamIds = readStringList(formData, "researchStreamIds");
    const topicIds = readStringList(formData, "topicIds");
    const nicheModes = parseCommaSeparatedString(readOptionalString(formData, "nicheModes"));
    const configJson = buildSourceConfigFromFormData(formData, sourceType);
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
    return { status: "success", message: "Source config created." };
  } catch (error) {
    return toActionErrorState(error);
  }
}

export async function updateSourceConfig(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const id = readRequiredString(formData, "id");
    const sourceType = readRequiredString(formData, "sourceType");
    const enabled = readBoolean(formData, "enabled", false);
    const researchStreamIds = readStringList(formData, "researchStreamIds");
    const topicIds = readStringList(formData, "topicIds");
    const nicheModes = parseCommaSeparatedString(readOptionalString(formData, "nicheModes"));
    const configJson = buildSourceConfigFromFormData(formData, sourceType);
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
    return { status: "success", message: "Source config saved." };
  } catch (error) {
    return toActionErrorState(error);
  }
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

export async function updateContentDraftAssetStatus(formData: FormData) {
  const id = readRequiredString(formData, "id");
  const assetStatus = readRequiredString(formData, "assetStatus");
  const allowedStatuses = new Set(["draft", "review-required", "approved", "reference-only", "rejected"]);

  if (!allowedStatuses.has(assetStatus)) {
    throw new Error(`Unsupported content draft asset status: ${assetStatus}`);
  }

  await db.contentDraft.update({
    where: { id },
    data: { assetStatus }
  });

  revalidatePath("/");
  revalidatePath("/social-drafts");
}

export async function updateContentDraftMediaCandidateStatus(formData: FormData) {
  const id = readRequiredString(formData, "id");
  const candidateIndex = Number(readRequiredString(formData, "candidateIndex"));
  const reviewStatus = readRequiredString(formData, "reviewStatus");
  const allowedStatuses = new Set(["pending", "approved", "use-with-caution", "rejected", "reference-only"]);

  if (!Number.isInteger(candidateIndex) || candidateIndex < 0) {
    throw new Error("Invalid media candidate index.");
  }

  if (!allowedStatuses.has(reviewStatus)) {
    throw new Error(`Unsupported media candidate review status: ${reviewStatus}`);
  }

  const draft = await db.contentDraft.findUnique({
    where: { id },
    select: { assetCandidatesJson: true }
  });

  if (!draft || !Array.isArray(draft.assetCandidatesJson) || !draft.assetCandidatesJson[candidateIndex] || typeof draft.assetCandidatesJson[candidateIndex] !== "object") {
    throw new Error("Media candidate not found.");
  }

  const assetCandidates = draft.assetCandidatesJson.map((entry, index) => {
    if (index !== candidateIndex || !entry || typeof entry !== "object") {
      return entry;
    }

    return {
      ...entry,
      reviewStatus
    };
  });

  await db.contentDraft.update({
    where: { id },
    data: { assetCandidatesJson: assetCandidates }
  });

  revalidatePath("/");
  revalidatePath("/social-drafts");
}

export async function updateContentDraftStatStatus(formData: FormData) {
  const id = readRequiredString(formData, "id");
  const statIndex = Number(readRequiredString(formData, "statIndex"));
  const reviewStatus = readRequiredString(formData, "reviewStatus");
  const allowedStatuses = new Set(["pending", "approved", "use-with-caution", "rejected"]);

  if (!Number.isInteger(statIndex) || statIndex < 0) {
    throw new Error("Invalid supporting stat index.");
  }

  if (!allowedStatuses.has(reviewStatus)) {
    throw new Error(`Unsupported supporting stat review status: ${reviewStatus}`);
  }

  const draft = await db.contentDraft.findUnique({
    where: { id },
    select: { supportingStatsJson: true }
  });

  if (!draft || !Array.isArray(draft.supportingStatsJson) || !draft.supportingStatsJson[statIndex] || typeof draft.supportingStatsJson[statIndex] !== "object") {
    throw new Error("Supporting stat not found.");
  }

  const supportingStats = draft.supportingStatsJson.map((entry, index) => {
    if (index !== statIndex || !entry || typeof entry !== "object") {
      return entry;
    }

    return {
      ...entry,
      reviewStatus
    };
  });

  await db.contentDraft.update({
    where: { id },
    data: { supportingStatsJson: supportingStats }
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

export async function createResearchStream(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
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
    revalidatePath("/research-streams");
    return { status: "success", message: "Research stream created." };
  } catch (error) {
    return toActionErrorState(error);
  }
}

export async function updateResearchStream(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
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
    revalidatePath("/research-streams");
    return { status: "success", message: "Research stream saved." };
  } catch (error) {
    return toActionErrorState(error);
  }
}

export async function createTopic(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
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
    revalidatePath("/topics");
    return { status: "success", message: "Topic created." };
  } catch (error) {
    return toActionErrorState(error);
  }
}

export async function updateTopic(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
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
    revalidatePath("/topics");
    return { status: "success", message: "Topic saved." };
  } catch (error) {
    return toActionErrorState(error);
  }
}

export async function createCopyFramework(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
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
    revalidatePath("/frameworks");
    return { status: "success", message: "Copy framework created." };
  } catch (error) {
    return toActionErrorState(error);
  }
}

export async function updateCopyFramework(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
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
    revalidatePath("/frameworks");
    return { status: "success", message: "Copy framework saved." };
  } catch (error) {
    return toActionErrorState(error);
  }
}

export async function createStyleProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
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
    revalidatePath("/style-profiles");
    return { status: "success", message: "Style profile created." };
  } catch (error) {
    return toActionErrorState(error);
  }
}

export async function updateStyleProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
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
    revalidatePath("/style-profiles");
    return { status: "success", message: "Style profile saved." };
  } catch (error) {
    return toActionErrorState(error);
  }
}

export async function regenerateContentDraft(formData: FormData) {
  const id = readRequiredString(formData, "id");

  await regenerateSocialDraftById(id);

  revalidatePath("/");
  revalidatePath("/ideas");
  revalidatePath("/social-drafts");
}

export async function forceSendSocialDigestReviewCopy(_: ActionState, _formData: FormData): Promise<ActionState> {
  try {
    const researchStreamId = researchStreamIds.socialMedia;
    const resendApiKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM;
    const replyTo = parseReplyTo(process.env.SOCIAL_DIGEST_REPLY_TO ?? process.env.DIGEST_REPLY_TO);

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured.");
    }

    if (!emailFrom) {
      throw new Error("EMAIL_FROM is not configured.");
    }

    const [digest, recipients] = await Promise.all([
      db.digest.findFirst({
        where: { researchStreamId },
        orderBy: [{ createdAt: "desc" }]
      }),
      db.digestRecipient.findMany({
        where: { researchStreamId, enabled: true },
        orderBy: [{ isOwnerDefault: "desc" }, { email: "asc" }]
      })
    ]);

    if (!digest) {
      throw new Error("No social digest exists yet. Run daily-social-media-digest-email first.");
    }

    if (!digest.markdownBody || !digest.htmlBody) {
      throw new Error("The latest social digest does not have a stored email body yet. Run daily-social-media-digest-email again.");
    }

    if (recipients.length === 0) {
      throw new Error("No enabled Social Media Research recipients are configured.");
    }

    let sentCount = 0;
    const failures: string[] = [];

    for (const recipient of recipients) {
      const result = await sendWithResend({
        apiKey: resendApiKey,
        from: emailFrom,
        to: recipient.email,
        subject: `${digest.subject} [Review Copy]`,
        text: digest.markdownBody,
        html: digest.htmlBody,
        replyTo
      });

      const existingDelivery = await db.emailDelivery.findFirst({
        where: {
          digestId: digest.id,
          recipientId: recipient.id
        },
        select: {
          deliveryKey: true
        }
      });

      if (existingDelivery) {
        await db.emailDelivery.update({
          where: { deliveryKey: existingDelivery.deliveryKey },
          data: {
            recipientEmail: recipient.email,
            provider: "resend",
            providerMessageId: result.id ?? null,
            sendStatus: result.error ? "failed" : "sent",
            errorText: result.error ?? null,
            attemptedAt: new Date()
          }
        });
      } else {
        await db.emailDelivery.create({
          data: {
            digestId: digest.id,
            recipientId: recipient.id,
            recipientEmail: recipient.email,
            provider: "resend",
            deliveryKey: `force:${Date.now()}:${recipient.email.toLowerCase()}:${Math.random().toString(36).slice(2, 8)}`,
            providerMessageId: result.id ?? null,
            sendStatus: result.error ? "failed" : "sent",
            errorText: result.error ?? null,
            attemptedAt: new Date()
          }
        });
      }

      if (result.error) {
        failures.push(`${recipient.email}: ${result.error}`);
      } else {
        sentCount += 1;
      }
    }

    if (sentCount > 0) {
      await db.digest.update({
        where: { id: digest.id },
        data: {
          status: "sent",
          sentAt: new Date()
        }
      });
    }

    revalidatePath("/");
    revalidatePath("/recipients");
    revalidatePath("/jobs");

    if (failures.length > 0 && sentCount === 0) {
      throw new Error(`Review copy failed: ${failures.join("; ")}`);
    }

    return {
      status: failures.length > 0 ? "success" : "success",
      message:
        failures.length > 0
          ? `Sent ${sentCount} review cop${sentCount === 1 ? "y" : "ies"} with some failures: ${failures.join("; ")}`
          : `Sent ${sentCount} social digest review cop${sentCount === 1 ? "y" : "ies"}.`
    };
  } catch (error) {
    return toActionErrorState(error);
  }
}

export async function createDigestRecipient(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
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
    return { status: "success", message: "Recipient created." };
  } catch (error) {
    return toActionErrorState(error);
  }
}

export async function updateDigestRecipient(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
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
    return { status: "success", message: "Recipient saved." };
  } catch (error) {
    return toActionErrorState(error);
  }
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

function buildSourceConfigFromFormData(formData: FormData, sourceType: string) {
  const advancedConfigJson = readOptionalString(formData, "configJson");

  if (advancedConfigJson) {
    return parseConfigJson(advancedConfigJson);
  }

  const mode = readOptionalString(formData, "mode");
  const sampleSize = readOptionalNumber(formData, "sampleSize");
  const keywords = parseCommaSeparatedString(readOptionalString(formData, "keywords"));
  const exclusions = parseCommaSeparatedString(readOptionalString(formData, "exclusions"));

  const config: Record<string, unknown> = {
    ...(mode ? { mode } : {}),
    ...(sampleSize !== null ? { sampleSize } : {}),
    ...(keywords.length > 0 ? { keywords } : {}),
    ...(exclusions.length > 0 ? { exclusions } : {})
  };

  if (sourceType === "reddit") {
    const subredditList = parseCommaSeparatedString(readOptionalString(formData, "subredditList"));
    if (subredditList.length > 0) {
      config.subredditList = subredditList;
    }
  }

  if (sourceType === "google-trends") {
    const geo = readOptionalString(formData, "geo");
    if (geo) {
      config.geo = geo;
    }
  }

  if (sourceType === "hacker-news") {
    const storyTypes = parseCommaSeparatedString(readOptionalString(formData, "storyTypes"));
    if (storyTypes.length > 0) {
      config.storyTypes = storyTypes;
    }
  }

  if (sourceType === "product-hunt") {
    const productTopics = parseCommaSeparatedString(readOptionalString(formData, "productTopics"));
    if (productTopics.length > 0) {
      config.productTopics = productTopics;
    }
  }

  return sourceAdapterConfigSchema.parse(config);
}

function readOptionalNumber(formData: FormData, key: string) {
  const value = readOptionalString(formData, key);

  if (!value) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${key} must be a valid number.`);
  }

  return parsed;
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

function toActionErrorState(error: unknown): ActionState {
  return {
    status: "error",
    message: error instanceof Error ? error.message : "Something went wrong while saving."
  };
}

function parseReplyTo(input: string | undefined) {
  const values = (input ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return values.length > 0 ? values : undefined;
}
