import { researchStreamChannels, researchStreamIds, socialDraftSchema, type SocialDraft, type SupportingStat } from "@bizbrain/core";
import { db } from "@bizbrain/db";
import { buildSocialDraftPrompt } from "@bizbrain/prompts";

type SocialBriefWithCluster = {
  id: string;
  topicId?: string;
  clusterId: string;
  title: string;
  category: string;
  subcategory: string | null;
  businessType: string | null;
  targetCustomer: string | null;
  problemSummary: string | null;
  solutionConcept: string | null;
  monetizationAngle: string | null;
  evidenceSummary: string | null;
  qualityScore: number | null;
  sourceAttributionJson: unknown;
  cluster: {
    title: string;
    summary: string | null;
  } | null;
  supportingStatsJson?: unknown;
  signalEvidenceStatsJson?: unknown;
};

type IdeaWithCluster = SocialBriefWithCluster;

type TopicRecord = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  enabledChannelsJson: unknown;
  keywordsJson: unknown;
  exclusionsJson: unknown;
  sourcePreferencesJson: unknown;
  topicFitThreshold: number | null;
  defaultAssetMode: string | null;
  defaultCopyFramework: {
    id: string;
    name: string;
    description: string | null;
    structureJson: unknown;
  } | null;
  defaultStyleProfile: {
    id: string;
    name: string;
    description: string | null;
    inspirationSummary: string | null;
    styleTraitsJson: unknown;
    guardrailsJson: unknown;
  } | null;
};

type SocialDraftContext = {
  topics: TopicRecord[];
  recordsWritten: number;
  warnings: string[];
};

type ContentDraftCreateData = Parameters<typeof db.contentDraft.create>[0]["data"];
type ContentDraftUpdateData = Parameters<typeof db.contentDraft.update>[0]["data"];

async function syncSocialResearchBriefs() {
  const socialTopics = await db.topic.findMany({
    where: {
      researchStreamId: researchStreamIds.socialMedia,
      enabled: true
    },
    orderBy: { name: "asc" }
  });

  if (socialTopics.length === 0) {
    return [] as SocialBriefWithCluster[];
  }

  const clusters = await db.trendCluster.findMany({
    where: {
      status: "open"
    },
    orderBy: [{ scoreTotal: "desc" }, { updatedAt: "desc" }],
    take: 24,
    include: {
      memberships: {
        take: 6,
        include: {
          rawSignal: {
            select: {
              sourceType: true,
              title: true,
              body: true,
              sourceUrl: true,
              authorName: true
            }
          }
        }
      }
    }
  });

  const synced: SocialBriefWithCluster[] = [];

  for (const topic of socialTopics) {
    const matchedClusters = clusters
      .map((cluster) => ({
        cluster,
        fitScore: scoreClusterForTopic(cluster, topic)
      }))
      .filter((entry) => entry.fitScore >= resolveTopicFitThreshold(topic))
      .sort((left, right) => right.fitScore - left.fitScore || right.cluster.scoreTotal - left.cluster.scoreTotal)
      .slice(0, 3);

    for (const { cluster, fitScore } of matchedClusters) {
      const sourceAttribution = buildClusterSourceAttribution(cluster);
      const briefData = {
        researchStreamId: researchStreamIds.socialMedia,
        topicId: topic.id,
        clusterId: cluster.id,
        title: cluster.title,
        framingMode: resolveSocialDraftMode(topic),
        themeSummary: cluster.summary ?? buildThemeSummary(cluster, topic),
        audienceInsight: buildAudienceInsight(cluster, topic),
        operatorTakeaway: buildOperatorTakeaway(cluster, topic),
        contrarianAngle: buildContrarianAngle(cluster, topic),
        evidenceSummary: buildClusterEvidenceSummary(cluster),
        supportingStatsJson: [],
        signalEvidenceStatsJson: [],
        sourceAttributionJson: sourceAttribution,
        qualityScore: Math.min(9.4, Math.max(5.8, fitScore + Math.min(2.4, (cluster.scoreTotal ?? 0) * 0.15))),
        status: "ready"
      };

      const brief = await (db as any).socialResearchBrief.upsert({
        where: {
          topicId_clusterId: {
            topicId: topic.id,
            clusterId: cluster.id
          }
        },
        update: briefData,
        create: briefData
      });

      const briefSource = mapStoredBriefToDraftSource({
        ...brief,
        cluster: {
          title: cluster.title,
          summary: cluster.summary
        }
      });
      const signalEvidenceStats = await buildSignalEvidenceStatsResearch(briefSource, topic, "linkedin");
      const externalInsightStats = await buildExternalInsightStatsResearch({ idea: briefSource, topic, channel: "linkedin" });

      const updatedBrief = await (db as any).socialResearchBrief.update({
        where: { id: brief.id },
        data: {
          signalEvidenceStatsJson: signalEvidenceStats,
          supportingStatsJson: externalInsightStats
        }
      });

      synced.push(
        mapStoredBriefToDraftSource({
          ...updatedBrief,
          cluster: {
            title: cluster.title,
            summary: cluster.summary
          }
        })
      );
    }
  }

  return synced;
}

export async function syncSocialContentDrafts() {
  const socialStream = await db.researchStream.findUnique({
    where: { id: researchStreamIds.socialMedia },
    include: {
      defaultCopyFramework: true,
      defaultStyleProfile: true
    }
  });

  if (!socialStream) {
    return { recordsWritten: 0, warnings: ["Social media research stream is not configured."] };
  }

  const [topics, briefs] = await Promise.all([
    db.topic.findMany({
      where: {
        researchStreamId: socialStream.id,
        enabled: true
      },
      include: {
        defaultCopyFramework: true,
        defaultStyleProfile: true
      },
      orderBy: { name: "asc" }
    }),
    syncSocialResearchBriefs()
  ]);

  if (topics.length === 0 || briefs.length === 0) {
    return { recordsWritten: 0, warnings: [] };
  }

  const result: SocialDraftContext = {
    topics,
    recordsWritten: 0,
    warnings: []
  };

  for (const topic of topics) {
    const matchedBriefs = briefs
      .filter((brief) => brief.topicId === topic.id)
      .map((brief) => ({
        brief,
        score: brief.qualityScore ?? 0
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || (right.brief.qualityScore ?? 0) - (left.brief.qualityScore ?? 0))
      .slice(0, 2);

    for (const { brief } of matchedBriefs) {
      const channels = resolveTopicChannels(topic.enabledChannelsJson);

      for (const channel of channels) {
        try {
          const framework = topic.defaultCopyFramework ?? socialStream.defaultCopyFramework ?? null;
          const styleProfile = topic.defaultStyleProfile ?? socialStream.defaultStyleProfile ?? null;
          const assetMode = topic.defaultAssetMode ?? socialStream.defaultAssetMode ?? "none";
          const signalEvidenceStats = readStatArray(brief.signalEvidenceStatsJson);
          const externalInsightStats = readStatArray(brief.supportingStatsJson);
          const fallbackDraft = buildFallbackSocialDraft({
            channel,
            idea: brief,
            topic,
            frameworkName: framework?.name ?? "custom",
            styleName: styleProfile?.name ?? "founder educator",
            assetMode,
            externalInsightStats
          });
          let generated = fallbackDraft;

          try {
            generated = (await generateSocialDraft({
              channel,
              idea: brief,
              topic,
              framework,
              styleProfile,
              assetMode,
              externalInsightStats
            })) ?? fallbackDraft;
          } catch (error) {
            result.warnings.push(`${topic.slug}/${channel}: ${error instanceof Error ? error.message : String(error)}`);
          }

          const existingDraft = await db.contentDraft.findFirst({
            where: {
              researchStreamId: socialStream.id,
              topicId: topic.id,
              sourceBriefId: brief.id,
              targetChannel: channel
            },
            select: { id: true }
          });

          const createData: ContentDraftCreateData = {
            researchStreamId: socialStream.id,
            topicId: topic.id,
            sourceBriefId: brief.id,
            sourceIdeaId: null,
            copyFrameworkId: framework?.id ?? null,
            styleProfileId: styleProfile?.id ?? null,
            title: generated.title,
            targetChannel: channel,
            targetAudience: generated.targetAudience,
            hook: generated.hook,
            thesis: generated.thesis,
            supportingPointsJson: generated.supportingPoints,
            counterpoint: generated.counterpoint,
            cta: generated.cta,
            draftMarkdown: generated.draftMarkdown,
            visualBriefJson: generated.visualBrief,
            supportingStatsJson: generated.supportingStats,
            signalEvidenceStatsJson: signalEvidenceStats,
            infographicBriefJson: generated.infographicBrief,
            infographicFormat: generated.infographicBrief.format,
            infographicPanelsJson: generated.infographicBrief.panels,
            assetMode,
            assetStatus: generated.mediaCandidates.some((candidate) => candidate.usageStatus === "reference-only")
              ? "review-required"
              : generated.mediaCandidates.length > 0
                ? "review-required"
                : "draft",
            assetCandidatesJson: generated.mediaCandidates,
            mediaPolicyJson: generated.mediaPolicy,
            qualityScore: generated.qualityScore,
            sourceAttributionJson: brief.sourceAttributionJson ?? undefined,
            status: "draft"
          };

          const updateData: ContentDraftUpdateData = {
            copyFrameworkId: framework?.id ?? null,
            styleProfileId: styleProfile?.id ?? null,
            title: generated.title,
            targetAudience: generated.targetAudience,
            hook: generated.hook,
            thesis: generated.thesis,
            supportingPointsJson: generated.supportingPoints,
            counterpoint: generated.counterpoint,
            cta: generated.cta,
            draftMarkdown: generated.draftMarkdown,
            visualBriefJson: generated.visualBrief,
            supportingStatsJson: generated.supportingStats,
            signalEvidenceStatsJson: signalEvidenceStats,
            infographicBriefJson: generated.infographicBrief,
            infographicFormat: generated.infographicBrief.format,
            infographicPanelsJson: generated.infographicBrief.panels,
            assetMode,
            assetStatus: generated.mediaCandidates.some((candidate) => candidate.usageStatus === "reference-only")
              ? "review-required"
              : generated.mediaCandidates.length > 0
                ? "review-required"
                : "draft",
            assetCandidatesJson: generated.mediaCandidates,
            mediaPolicyJson: generated.mediaPolicy,
            qualityScore: generated.qualityScore,
            sourceAttributionJson: brief.sourceAttributionJson ?? undefined,
            status: "draft"
          };

          (createData as any).infographicCreativeBriefJson = generated.infographicCreativeBrief;
          (updateData as any).infographicCreativeBriefJson = generated.infographicCreativeBrief;

          if (existingDraft) {
            await db.contentDraft.update({
              where: { id: existingDraft.id },
              data: updateData
            });
          } else {
            await db.contentDraft.create({
              data: createData
            });
          }

          result.recordsWritten += 1;
        } catch (error) {
          result.warnings.push(`${topic.slug}/${channel}: failed to persist draft: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  return result;
}

export async function regenerateSocialDraftById(draftId: string) {
  const draft = await (db as any).contentDraft.findUnique({
    where: { id: draftId },
    include: {
      researchStream: {
        include: {
          defaultCopyFramework: true,
          defaultStyleProfile: true
        }
      },
      topic: {
        include: {
          defaultCopyFramework: true,
          defaultStyleProfile: true
        }
      },
      sourceIdea: { include: { cluster: true } },
      sourceBrief: true
    }
  });

  if (!draft) {
    throw new Error("Social draft not found.");
  }

  if (!draft.topic || (!draft.sourceBrief && !draft.sourceIdea)) {
    throw new Error("Social draft is missing its topic or source brief.");
  }

  const framework = draft.topic.defaultCopyFramework ?? draft.researchStream.defaultCopyFramework ?? null;
  const styleProfile = draft.topic.defaultStyleProfile ?? draft.researchStream.defaultStyleProfile ?? null;
  const assetMode = draft.topic.defaultAssetMode ?? draft.researchStream.defaultAssetMode ?? "none";
  const sourceBrief = draft.sourceBrief
    ? mapStoredBriefToDraftSource(draft.sourceBrief)
    : mapIdeaToDraftSource(draft.sourceIdea!);
  const signalEvidenceStats = draft.sourceBrief
    ? readStatArray(draft.sourceBrief.signalEvidenceStatsJson)
    : await buildSignalEvidenceStatsResearch(
        draft.sourceIdea!,
        draft.topic,
        draft.targetChannel as (typeof researchStreamChannels)[number]
      );
  const externalInsightStats = draft.sourceBrief
    ? readStatArray(draft.sourceBrief.supportingStatsJson)
    : await buildExternalInsightStatsResearch({
        idea: draft.sourceIdea!,
        topic: draft.topic,
        channel: draft.targetChannel as (typeof researchStreamChannels)[number]
      });
  const fallbackDraft = buildFallbackSocialDraft({
    channel: draft.targetChannel as (typeof researchStreamChannels)[number],
    idea: sourceBrief,
    topic: draft.topic,
    frameworkName: framework?.name ?? "custom",
    styleName: styleProfile?.name ?? "founder educator",
    assetMode,
    externalInsightStats
  });

  let generated = fallbackDraft;
  const warnings: string[] = [];

  try {
    generated =
      (await generateSocialDraft({
        channel: draft.targetChannel as (typeof researchStreamChannels)[number],
        idea: sourceBrief,
        topic: draft.topic,
        framework,
        styleProfile,
        assetMode,
        externalInsightStats
      })) ?? fallbackDraft;
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : String(error));
  }

  const updateData: Record<string, unknown> = {
    copyFrameworkId: framework?.id ?? null,
    styleProfileId: styleProfile?.id ?? null,
    title: generated.title,
    targetAudience: generated.targetAudience,
    hook: generated.hook,
    thesis: generated.thesis,
    supportingPointsJson: generated.supportingPoints,
    counterpoint: generated.counterpoint,
    cta: generated.cta,
    draftMarkdown: generated.draftMarkdown,
    visualBriefJson: generated.visualBrief,
    supportingStatsJson: generated.supportingStats,
    signalEvidenceStatsJson: signalEvidenceStats,
    infographicBriefJson: generated.infographicBrief,
    infographicCreativeBriefJson: generated.infographicCreativeBrief,
    infographicFormat: generated.infographicBrief.format,
    infographicPanelsJson: generated.infographicBrief.panels,
    assetMode,
    assetStatus: generated.mediaCandidates.some((candidate) => candidate.usageStatus === "reference-only")
      ? "review-required"
      : generated.mediaCandidates.length > 0
        ? "review-required"
        : "draft",
    assetCandidatesJson: generated.mediaCandidates,
    mediaPolicyJson: generated.mediaPolicy,
    qualityScore: generated.qualityScore,
    sourceAttributionJson: sourceBrief.sourceAttributionJson ?? undefined,
    status: "draft"
  };

  await db.contentDraft.update({
    where: { id: draft.id },
    data: updateData as any
  });

  return {
    warnings
  };
}

function resolveTopicChannels(value: unknown) {
  if (!Array.isArray(value)) {
    return [...researchStreamChannels];
  }

  const channels = value
    .filter((entry): entry is string => typeof entry === "string")
    .filter((entry): entry is (typeof researchStreamChannels)[number] =>
      researchStreamChannels.includes(entry as (typeof researchStreamChannels)[number])
    );

  return channels.length > 0 ? channels : [...researchStreamChannels];
}

function scoreClusterForTopic(
  cluster: any,
  topic: Pick<TopicRecord, "keywordsJson" | "exclusionsJson" | "slug" | "name" | "description">
) {
  const keywords = Array.isArray(topic.keywordsJson)
    ? topic.keywordsJson.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.toLowerCase())
    : [];
  const exclusions = Array.isArray(topic.exclusionsJson)
    ? topic.exclusionsJson.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.toLowerCase())
    : [];
  const haystack = [
    cluster.title,
    cluster.primaryCategory,
    cluster.summary,
    ...(Array.isArray(cluster.tagsJson) ? cluster.tagsJson.filter((entry: unknown): entry is string => typeof entry === "string") : []),
    ...cluster.memberships.flatMap((membership: any) => [membership.rawSignal.title, membership.rawSignal.body])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (exclusions.some((term) => haystack.includes(term))) {
    return 0;
  }

  const topicalTerms = new Set<string>();

  for (const keyword of keywords) {
    topicalTerms.add(keyword);
    for (const token of tokenizeTopicText(keyword)) {
      topicalTerms.add(token);
    }
  }

  for (const token of tokenizeTopicText([topic.slug, topic.name, topic.description ?? ""].filter(Boolean).join(" "))) {
    topicalTerms.add(token);
  }

  let score = 0;
  let matchedTerms = 0;

  for (const keyword of keywords) {
    if (haystack.includes(keyword)) {
      score += 3.5;
      matchedTerms += 1;
    }
  }

  for (const term of topicalTerms) {
    if (term.length < 4) {
      continue;
    }

    if (new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(haystack)) {
      score += 1.25;
      matchedTerms += 1;
    }
  }

  if (matchedTerms > 0) {
    score += 1;
  }

  if (topic.name && new RegExp(`\\b${escapeRegExp(topic.name.toLowerCase())}\\b`, "i").test(haystack)) {
    score += 2;
  }

  if (topic.slug.includes("linkedin") && /(founder|operator|team|startup)/.test(haystack)) {
    score += 2;
  }

  if (topic.slug.includes("x") && /(trend|automation|distribution|fintech)/.test(haystack)) {
    score += 2;
  }

  return score;
}

function resolveTopicFitThreshold(topic: Pick<TopicRecord, "topicFitThreshold">) {
  return typeof topic.topicFitThreshold === "number" && Number.isFinite(topic.topicFitThreshold) ? topic.topicFitThreshold : 6;
}

function tokenizeTopicText(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !TOPIC_STOPWORDS.has(token));
}

const TOPIC_STOPWORDS = new Set([
  "with",
  "from",
  "into",
  "that",
  "this",
  "your",
  "have",
  "about",
  "around",
  "quick",
  "build",
  "public",
  "content",
  "research",
  "social",
  "media",
  "weekly"
]);

function buildClusterSourceAttribution(cluster: any) {
  const sourceGroups = new Map<string, { count: number; titles: string[]; urls: string[] }>();

  for (const membership of cluster.memberships as Array<any>) {
    const sourceType = membership.rawSignal.sourceType;
    const group = sourceGroups.get(sourceType) ?? { count: 0, titles: [], urls: [] };
    group.count += 1;
    if (membership.rawSignal.title && group.titles.length < 3) {
      group.titles.push(membership.rawSignal.title);
    }
    if (membership.rawSignal.sourceUrl && group.urls.length < 3) {
      group.urls.push(membership.rawSignal.sourceUrl);
    }
    sourceGroups.set(sourceType, group);
  }

  return [...sourceGroups.entries()].map(([sourceType, group]) => ({
    sourceType,
    signalCount: group.count,
    sampleTitles: group.titles,
    sampleUrls: group.urls
  }));
}

function buildThemeSummary(cluster: any, topic: Pick<TopicRecord, "name">) {
  const sampleTitle = cluster.memberships.find((membership: any) => membership.rawSignal.title)?.rawSignal.title;
  return `Signals relevant to ${topic.name} keep clustering around ${cluster.title.toLowerCase()}${sampleTitle ? `, including examples like "${sampleTitle}".` : "."}`;
}

function buildClusterEvidenceSummary(cluster: any) {
  const titles = cluster.memberships
    .map((membership: any) => membership.rawSignal.title)
    .filter((title: unknown): title is string => Boolean(title))
    .slice(0, 3);

  if (titles.length === 0) {
    return cluster.summary ?? "Repeated discussion signals support this topic.";
  }

  return `Repeated examples include ${titles.map((title: string) => `"${title}"`).join(", ")}.`;
}

function buildAudienceInsight(cluster: any, topic: Pick<TopicRecord, "name">) {
  return `People following ${topic.name} are responding to repeated workflow friction around ${cluster.title.toLowerCase()}.`;
}

function buildOperatorTakeaway(cluster: any, topic: Pick<TopicRecord, "name">) {
  return `The operational lesson for ${topic.name} is that the process around ${cluster.title.toLowerCase()} is breaking before people even start looking for a tool.`;
}

function buildContrarianAngle(cluster: any, topic: Pick<TopicRecord, "name">) {
  return `The interesting part for ${topic.name} is not the software category itself, but the repeated friction pattern hidden inside ${cluster.title.toLowerCase()}.`;
}

function mapStoredBriefToDraftSource(
  brief: {
    id: string;
    topicId?: string | null;
    clusterId: string | null;
    title: string;
    themeSummary: string | null;
    audienceInsight: string | null;
    operatorTakeaway: string | null;
    evidenceSummary: string | null;
    qualityScore: number | null;
    sourceAttributionJson: unknown;
    supportingStatsJson?: unknown;
    signalEvidenceStatsJson?: unknown;
    cluster?: { title: string; summary: string | null } | null;
  }
): SocialBriefWithCluster {
  return {
    id: brief.id,
    topicId: brief.topicId ?? undefined,
    clusterId: brief.clusterId ?? "",
    title: brief.title,
    category: "social-research",
    subcategory: null,
    businessType: null,
    targetCustomer: brief.audienceInsight,
    problemSummary: brief.themeSummary,
    solutionConcept: brief.operatorTakeaway,
    monetizationAngle: null,
    evidenceSummary: brief.evidenceSummary,
    qualityScore: brief.qualityScore,
    sourceAttributionJson: brief.sourceAttributionJson,
    cluster: brief.cluster ?? null,
    supportingStatsJson: brief.supportingStatsJson,
    signalEvidenceStatsJson: brief.signalEvidenceStatsJson
  };
}

function mapIdeaToDraftSource(idea: {
  id: string;
  clusterId: string;
  title: string;
  category: string;
  subcategory: string | null;
  businessType: string | null;
  targetCustomer: string | null;
  problemSummary: string | null;
  solutionConcept: string | null;
  monetizationAngle: string | null;
  evidenceSummary: string | null;
  qualityScore: number | null;
  sourceAttributionJson: unknown;
  cluster?: { title: string } | null;
}): SocialBriefWithCluster {
  return {
    id: idea.id,
    clusterId: idea.clusterId,
    title: idea.title,
    category: idea.category,
    subcategory: idea.subcategory,
    businessType: idea.businessType,
    targetCustomer: idea.targetCustomer,
    problemSummary: idea.problemSummary,
    solutionConcept: idea.solutionConcept,
    monetizationAngle: idea.monetizationAngle,
    evidenceSummary: idea.evidenceSummary,
    qualityScore: idea.qualityScore,
    sourceAttributionJson: idea.sourceAttributionJson,
    cluster: idea.cluster ? { title: idea.cluster.title, summary: null } : null
  };
}

function readStatArray(value: unknown): SupportingStat[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && typeof entry.claim === "string")
    .map((entry) => normalizeSupportingStat(entry))
    .filter((entry): entry is SupportingStat => Boolean(entry));
}

function resolveSocialDraftMode(topic: Pick<TopicRecord, "slug" | "name" | "keywordsJson" | "description">) {
  const haystack = [
    topic.slug,
    topic.name,
    topic.description,
    Array.isArray(topic.keywordsJson) ? topic.keywordsJson.join(" ") : ""
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/(build in public|build-in-public|ship|launch|offer|productized|opportunity-derived)/.test(haystack)) {
    return "opportunity-derived";
  }

  return "commentary";
}

async function generateSocialDraft(input: {
  channel: (typeof researchStreamChannels)[number];
  idea: IdeaWithCluster;
  topic: TopicRecord;
  framework: { name: string; description: string | null; structureJson: unknown } | null;
  styleProfile: { name: string; description: string | null; inspirationSummary: string | null; styleTraitsJson: unknown; guardrailsJson: unknown } | null;
  assetMode: string;
  externalInsightStats: SupportingStat[];
}) {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), resolveSocialDraftTimeoutMs());

  let response: Response;

  try {
    const socialDraftMode = resolveSocialDraftMode(input.topic);
    const promptProblem = truncateAtWordBoundary(buildConciseProblemStatement(input.idea.problemSummary ?? input.idea.title), 140);
    const promptEvidence = truncateAtWordBoundary(buildConciseEvidenceLine(input.idea.evidenceSummary, input.externalInsightStats), 180);
    const promptSourceAttribution = summarizeSourceAttributionForPrompt(input.idea.sourceAttributionJson);
    const promptStats = summarizeStatsForPrompt(input.externalInsightStats);
    const promptLines = [
      `CHANNEL: ${input.channel}`,
      `TOPIC: ${input.topic.name}`,
      `TOPIC_DESCRIPTION: ${input.topic.description ?? "(none)"}`,
      `COPY_FRAMEWORK: ${input.framework?.name ?? "Use the topic/stream default persuasion structure."}`,
      `COPY_FRAMEWORK_DETAILS: ${JSON.stringify(input.framework?.structureJson ?? [])}`,
      `STYLE_PROFILE: ${input.styleProfile?.name ?? "Founder educator"}`,
      `STYLE_DESCRIPTION: ${input.styleProfile?.description ?? "(none)"}`,
      `STYLE_INSPIRATION: ${input.styleProfile?.inspirationSummary ?? "(none)"}`,
      `STYLE_TRAITS: ${formatPromptList(input.styleProfile?.styleTraitsJson, 4)}`,
      `STYLE_GUARDRAILS: ${formatPromptList(input.styleProfile?.guardrailsJson, 4)}`,
      `ASSET_MODE: ${input.assetMode}`,
      `SOCIAL_DRAFT_MODE: ${socialDraftMode}`,
      `SOURCE_RESEARCH_TITLE: ${truncateAtWordBoundary(input.idea.title, 100)}`,
      `SOURCE_RESEARCH_CATEGORY: ${input.idea.category}`,
      `TARGET_CUSTOMER: ${truncateAtWordBoundary(input.idea.targetCustomer ?? "(none)", 80)}`,
      `PROBLEM: ${promptProblem}`,
      `EVIDENCE: ${promptEvidence}`,
      `SOURCE_ATTRIBUTION_SUMMARY: ${promptSourceAttribution}`,
      `EXTERNAL_INSIGHT_STATS_RESEARCH: ${promptStats}`
    ];

    if (socialDraftMode === "opportunity-derived") {
      promptLines.splice(
        14,
        0,
        `BUSINESS_TYPE: ${input.idea.businessType ?? "(none)"}`,
        `SOLUTION: ${truncateAtWordBoundary(input.idea.solutionConcept ?? "(none)", 100)}`,
        `MONETIZATION: ${truncateAtWordBoundary(input.idea.monetizationAngle ?? "(none)", 80)}`
      );
    }

    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.OPENAI_ENRICH_MODEL ?? "gpt-5-mini",
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: buildSocialDraftPrompt() }]
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: promptLines.join("\n")
              }
            ]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "social_media_draft",
            strict: true,
            schema: socialDraftJsonSchema
          }
        }
      })
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("OpenAI social draft request timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI social draft request failed with ${response.status}: ${errorBody.slice(0, 600)}`);
  }

  const payload = (await response.json()) as {
    output?: Array<{ content?: Array<{ type: string; text?: string }> }>;
  };
  const textOutput =
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((contentItem) => contentItem.type === "output_text")
      ?.text ?? null;

  if (!textOutput) {
    throw new Error("OpenAI social draft response did not include output_text.");
  }

  const parsed = socialDraftSchema.parse(JSON.parse(textOutput));
  return {
    ...parsed,
    supportingStats: parsed.supportingStats.map((stat) => normalizeSupportingStat(stat)).filter((stat): stat is SupportingStat => Boolean(stat))
  };
}

function resolveSocialDraftTimeoutMs() {
  const parsed = Number(process.env.OPENAI_SOCIAL_DRAFT_TIMEOUT_MS ?? "45000");

  if (!Number.isFinite(parsed) || parsed < 5000) {
    return 45000;
  }

  return parsed;
}

function buildFallbackSocialDraft(input: {
  channel: (typeof researchStreamChannels)[number];
  idea: IdeaWithCluster;
  topic: TopicRecord;
  frameworkName: string;
  styleName: string;
  assetMode: string;
  externalInsightStats: SupportingStat[];
}): SocialDraft {
  const mode = resolveSocialDraftMode(input.topic);
  const audience = input.channel === "linkedin" ? "Founders and operators on LinkedIn" : "Operators and builders on X";
  const conciseTitle = buildConciseDraftTitle(input.idea, input.topic);
  const conciseProblem = buildConciseProblemStatement(input.idea.problemSummary ?? input.idea.title);
  const conciseEvidence = buildConciseEvidenceLine(input.idea.evidenceSummary, input.externalInsightStats);
  const strongestExternalStat = input.externalInsightStats[0]?.claim ?? null;
  const infographicHeadline =
    input.channel === "linkedin"
      ? truncateAtWordBoundary(`${input.topic.name}: ${conciseTitle}`, 72)
      : truncateAtWordBoundary(conciseTitle, 56);
  const hook =
    mode === "opportunity-derived"
      ? input.channel === "linkedin"
        ? `The interesting part isn’t the tool idea. It’s the workflow friction behind ${conciseTitle.toLowerCase()}.`
        : `${conciseTitle} is really a workflow lesson hiding inside a market signal.`
      : input.channel === "linkedin"
        ? `A pattern I’d pay attention to: ${conciseProblem}`
        : `${conciseProblem} keeps showing up in operator conversations.`;
  const thesis =
    mode === "opportunity-derived"
      ? input.channel === "linkedin"
        ? `The opportunity is less about inventing a new app and more about fixing the decision process around ${conciseTitle.toLowerCase()}.`
        : `The signal matters because it exposes where the current workflow is failing before software even enters the picture.`
      : input.channel === "linkedin"
        ? `The real story is the repeated workflow friction behind ${conciseTitle.toLowerCase()}, not just the surface request.`
        : `This is a repeated workflow problem, not a one-off edge case.`;
  const supportingPoints =
    mode === "opportunity-derived"
      ? [
          conciseProblem,
          input.idea.solutionConcept ?? "There is a clearer operating fix here than most teams realize.",
          conciseEvidence
        ].slice(0, 3)
      : [
          conciseProblem,
          conciseEvidence,
          strongestExternalStat ?? "There is enough outside evidence to turn the pattern into a stronger public-facing insight."
        ].slice(0, 3);
  const cta =
    mode === "opportunity-derived"
      ? input.channel === "linkedin"
        ? "If you were fixing this tomorrow, would you start with process, service, or software?"
        : "Process fix first, or would you still try to productize it?"
      : input.channel === "linkedin"
        ? "Have you seen this same workflow friction in your business or clients?"
        : "Seen this pattern too, or is it still early where you sit?";
  const xTakeaway = mode === "opportunity-derived"
    ? input.idea.solutionConcept ?? "The workflow is the wedge before the product."
    : strongestExternalStat ?? conciseEvidence;
  const infographicPanels =
    input.channel === "linkedin"
      ? [
          `Slide 1 headline: ${hook}`,
          `Slide 2 pattern: ${conciseProblem}`,
          `Slide 3 proof: ${strongestExternalStat ?? conciseEvidence}`,
          `Slide 4 takeaway: ${thesis}`
        ]
      : [
          `Headline: ${hook}`,
          `Proof point: ${strongestExternalStat ?? conciseEvidence}`,
          `Takeaway: ${thesis}`
        ];
  const draftMarkdown =
    mode === "opportunity-derived"
      ? input.channel === "linkedin"
        ? `${hook}\n\n${thesis}\n\n1. ${supportingPoints[0]}\n2. ${supportingPoints[1]}\n3. ${supportingPoints[2]}\n\nMy take: fix the operating motion before jumping to tooling.\n\n${cta}`
        : `${hook}\n\n${thesis}\n\n${xTakeaway}\n\n${cta}`
      : input.channel === "linkedin"
        ? `${hook}\n\n${thesis}\n\n1. ${supportingPoints[0]}\n2. ${supportingPoints[1]}\n3. ${supportingPoints[2]}\n\nThe better conversation is what this says about the workflow, not just the tool.\n\n${cta}`
        : `${hook}\n\n${thesis}\n\n${xTakeaway}\n\n${cta}`;

  return socialDraftSchema.parse({
    title:
      mode === "opportunity-derived"
        ? `${conciseTitle} (${input.channel.toUpperCase()})`
        : `${input.topic.name}: ${conciseTitle} (${input.channel.toUpperCase()})`,
    targetAudience: audience,
    hook,
    thesis,
    supportingPoints: input.channel === "linkedin" ? supportingPoints : supportingPoints.slice(0, 2),
    counterpoint:
      input.channel === "linkedin"
        ? "This only matters if the pain shows up repeatedly beyond a single anecdote."
        : "This breaks if the pattern is still too isolated.",
    cta,
    draftMarkdown,
    visualBrief: {
      concept: `${input.topic.name} operator insight with a concrete business angle.`,
      format: input.assetMode === "ai-generated" ? "editorial illustration" : "stock-led social card",
      headlineText: infographicHeadline,
      captionText: `${input.frameworkName} structure in a ${input.styleName} voice.`,
      ctaText: cta
    },
    infographicBrief: {
      summary:
        input.channel === "linkedin"
          ? `Turn this operator insight into a 4-panel carousel that starts with the pain pattern, explains the workflow lesson, and lands on a practical takeaway.`
          : `Turn this into a single-image infographic with one bold claim, one supporting proof point, and one practical takeaway.`,
      format: input.channel === "linkedin" ? "carousel" : "single-image infographic",
      panels: infographicPanels
    },
    infographicCreativeBrief: buildFallbackInfographicCreativeBrief({
      channel: input.channel,
      topicName: input.topic.name,
      conciseTitle,
      hook,
      thesis,
      conciseProblem,
      conciseEvidence,
      strongestExternalStat,
      panels: infographicPanels,
      assetMode: input.assetMode
    }),
    mediaCandidates: buildFallbackMediaCandidates(input),
    mediaPolicy: buildFallbackMediaPolicy(input.assetMode),
    supportingStats: input.externalInsightStats,
    qualityScore: Math.min(9.2, Math.max(6.4, input.idea.qualityScore ?? 7))
  });
}

function buildFallbackInfographicCreativeBrief(input: {
  channel: (typeof researchStreamChannels)[number];
  topicName: string;
  conciseTitle: string;
  hook: string;
  thesis: string;
  conciseProblem: string;
  conciseEvidence: string;
  strongestExternalStat: string | null;
  panels: string[];
  assetMode: string;
}) {
  const chartOrDiagramType =
    input.strongestExternalStat || /\d/.test(input.conciseEvidence) ? "hero statistic with supporting callout" : "process flow with editorial callout";
  const visualStyle =
    input.channel === "linkedin"
      ? "Clean editorial carousel with bold business typography, restrained dashboards, and strong whitespace."
      : "High-contrast single-slide social graphic with one dominant claim and minimal supporting clutter.";
  const layoutStrategy =
    input.channel === "linkedin"
      ? "Use a 4-slide narrative arc: hook, pattern, proof, takeaway. Keep each slide focused on one idea."
      : "Use a single poster-style composition with a dominant headline, one proof point, and a compact takeaway footer.";
  const imageSourceStrategy =
    input.assetMode === "ai-generated"
      ? "Use first-party AI-generated visuals anchored by simple workflow or dashboard references. Optionally blend one licensed stock or first-party image for realism."
      : "Lead with licensed stock, open-license, or first-party images, then add clean AI-assisted overlays or diagram elements only if they improve clarity.";
  const aiImagePrompt =
    input.channel === "linkedin"
      ? `Create a polished LinkedIn carousel cover and supporting slides for "${input.topicName}". Editorial business design, bold condensed headline typography, warm neutral background, charcoal text, deep blue accent, subtle workflow arrows, abstract dashboard fragments, no cartoon characters, no generic startup illustrations, no app mockup sales pitch. Core message: ${input.hook} Proof point: ${input.strongestExternalStat ?? input.conciseEvidence} Takeaway: ${input.thesis}`
      : `Create a high-contrast X graphic for "${input.topicName}" with one marketable editorial composition. Large headline, one proof-point callout, compact takeaway footer, sharp business-journal feel, warm neutrals with dark ink contrast, minimal dashboard or workflow motif, no cartoon AI art, no cheesy growth-hack visuals. Core message: ${input.hook} Proof point: ${input.strongestExternalStat ?? input.conciseEvidence}`;

  return {
    creativeDirection: `Turn "${input.conciseTitle}" into a marketable operator-insight visual that feels publishable, modern, and grounded in real workflow pain.`,
    objective: input.channel === "linkedin" ? "Stop the scroll, teach one practical pattern, and make the audience want to swipe through the full carousel." : "Deliver one sharp, credible visual claim that reinforces the post without looking like an ad.",
    visualStyle,
    layoutStrategy,
    compositionPrompt: input.channel === "linkedin"
      ? `Design a carousel that opens with a bold hook, moves into the repeated pain pattern, lands a proof point, and closes with a practical takeaway. Use editorial hierarchy, simple diagrams, and a restrained business aesthetic.`
      : `Design a single-image social graphic that puts the claim first, supports it with one proof point, and closes with a crisp takeaway. Keep the composition bold, minimal, and legible on mobile.`,
    textHierarchy: input.channel === "linkedin"
      ? ["Primary headline", "Pattern subhead", "Proof-point callout", "Takeaway footer"]
      : ["Primary headline", "Proof-point callout", "Takeaway footer"],
    chartOrDiagramType,
    imageSourceStrategy,
    aiImagePrompt,
    panelPrompts: input.panels.map((panel, index) =>
      input.channel === "linkedin"
        ? `Slide ${index + 1}: ${panel}. Create a distinct visual treatment for this slide while preserving one shared editorial style across the carousel.`
        : `Single-image layer ${index + 1}: ${panel}. Make the layout readable at phone size and keep the visual hierarchy obvious.`
    ),
    avoidNotes: [
      "Avoid generic SaaS hero art, placeholder app mockups, and cartoon robot imagery.",
      "Avoid cramming multiple unrelated ideas onto one slide or visual.",
      "Avoid unverified numbers, logos, trademarks, or identifiable people without rights review.",
      "Avoid making the visual feel like a sales page instead of a research-backed social post."
    ]
  };
}

function buildConciseDraftTitle(idea: Pick<IdeaWithCluster, "title" | "problemSummary">, topic: Pick<TopicRecord, "name">) {
  const raw = firstMeaningfulSentence(idea.title) || firstMeaningfulSentence(idea.problemSummary) || topic.name;
  return truncateAtWordBoundary(raw, 72);
}

function buildConciseProblemStatement(value: string) {
  const sentence = firstMeaningfulSentence(value);
  return truncateAtWordBoundary(sentence || "The same workflow friction keeps resurfacing.", 160);
}

function buildConciseEvidenceLine(evidenceSummary: string | null | undefined, stats: SupportingStat[]) {
  const evidence = firstMeaningfulSentence(evidenceSummary);
  if (evidence) {
    return truncateAtWordBoundary(evidence, 160);
  }

  const statClaim = firstMeaningfulSentence(stats[0]?.claim);
  if (statClaim) {
    return truncateAtWordBoundary(statClaim, 160);
  }

  return "The same friction appears repeatedly across the available evidence.";
}

function firstMeaningfulSentence(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  const sentence = normalized.split(/(?<=[.!?])\s+/)[0] ?? normalized;
  return sentence
    .replace(/^the poster is actively seeking recommendations for /i, "")
    .replace(/^founders want /i, "Teams want ")
    .replace(/^a young entrepreneur runs /i, "A small operator runs ")
    .trim();
}

function truncateAtWordBoundary(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  const truncated = value.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return `${(lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated).trim()}.`;
}

function formatPromptList(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) {
    return "(none)";
  }

  const items = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => truncateAtWordBoundary(entry, 60))
    .slice(0, maxItems);

  return items.length > 0 ? items.join(" | ") : "(none)";
}

function summarizeSourceAttributionForPrompt(value: unknown) {
  if (!Array.isArray(value)) {
    return "(none)";
  }

  const summary = value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .slice(0, 3)
    .map((entry) => {
      const sourceType = typeof entry.sourceType === "string" ? entry.sourceType : "source";
      const signalCount = typeof entry.signalCount === "number" ? entry.signalCount : null;
      const title = Array.isArray(entry.sampleTitles)
        ? entry.sampleTitles.find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0)
        : null;
      return `${sourceType}${signalCount ? ` (${signalCount})` : ""}${title ? `: ${truncateAtWordBoundary(title, 70)}` : ""}`;
    });

  return summary.length > 0 ? summary.join(" | ") : "(none)";
}

function summarizeStatsForPrompt(stats: SupportingStat[]) {
  const trimmed = stats.slice(0, 2).map((stat) => ({
    claim: truncateAtWordBoundary(stat.claim, 140),
    sourceName: stat.sourceName,
    sourceDate: stat.sourceDate,
    recommendedUsage: truncateAtWordBoundary(stat.recommendedUsage, 120)
  }));

  return trimmed.length > 0 ? JSON.stringify(trimmed) : "[]";
}

async function buildSignalEvidenceStatsResearch(
  idea: Pick<IdeaWithCluster, "clusterId" | "title" | "category" | "problemSummary" | "sourceAttributionJson">,
  topic: Pick<TopicRecord, "name" | "slug" | "keywordsJson" | "sourcePreferencesJson">,
  channel: (typeof researchStreamChannels)[number]
) {
  const [cluster, membershipStats] = await Promise.all([
    db.trendCluster.findUnique({
      where: { id: idea.clusterId },
      select: {
        signalCount: true,
        firstSeenAt: true,
        lastSeenAt: true
      }
    }),
    db.clusterMembership.findMany({
      where: { clusterId: idea.clusterId },
      select: {
        rawSignal: {
          select: {
            sourceType: true,
            sourceUrl: true,
            occurredAt: true,
            ingestedAt: true
          }
        }
      }
    })
  ]);

  const sourceCounts = new Map<string, number>();
  const sourceUrls = new Map<string, string>();
  const preferredStatSources = Array.isArray(topic.sourcePreferencesJson)
    ? topic.sourcePreferencesJson.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.toLowerCase())
    : [];

  for (const membership of membershipStats) {
    const sourceType = membership.rawSignal.sourceType;
    sourceCounts.set(sourceType, (sourceCounts.get(sourceType) ?? 0) + 1);
    if (!sourceUrls.has(sourceType) && membership.rawSignal.sourceUrl) {
      sourceUrls.set(sourceType, membership.rawSignal.sourceUrl);
    }
  }

  const sortedSources = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]);
  const totalSignals = cluster?.signalCount ?? membershipStats.length;
  const sourceDiversity = sortedSources.length;
  const stats: SupportingStat[] = [];

  if (totalSignals > 0) {
    stats.push({
      claim: `${totalSignals} matched signal${totalSignals === 1 ? "" : "s"} currently support the opportunity behind ${idea.title}.`,
      plainLanguageAngle:
        channel === "linkedin"
          ? "Use this to establish that the insight is pattern-based, not a one-off anecdote."
          : "Use this as a concise pattern signal before the sharper take.",
      sourceName: "BizBrain cluster evidence",
      sourceUrl: normalizePublicUrl(sourceUrls.get(sortedSources[0]?.[0] ?? "") ?? null),
      sourceDate: cluster?.lastSeenAt?.toISOString().slice(0, 10) ?? null,
      freshnessNote:
        cluster?.lastSeenAt
          ? `Latest matched evidence was seen on ${cluster.lastSeenAt.toISOString().slice(0, 10)}.`
          : "Latest evidence date is not stored.",
      confidenceNote: totalSignals >= 4 ? "Moderate confidence from repeated signal clustering." : "Early signal; useful, but still light on repeated evidence.",
      recommendedUsage: `Lead with the pattern, then connect it to ${topic.name}.${renderPreferredStatSourceHint(preferredStatSources)}`
      ,
      reviewStatus: "pending"
    });
  }

  if (sourceDiversity > 1) {
    stats.push({
      claim: `${sourceDiversity} distinct source types contributed evidence to this idea.`,
      plainLanguageAngle:
        channel === "linkedin"
          ? "Use this to show the theme is showing up across different contexts, not just one community."
          : "Use this as a short cross-source validation point.",
      sourceName: "BizBrain source attribution",
      sourceUrl: normalizePublicUrl(sourceUrls.get(sortedSources[0]?.[0] ?? "") ?? null),
      sourceDate: cluster?.lastSeenAt?.toISOString().slice(0, 10) ?? null,
      freshnessNote: "This is based on the current cluster membership and source attribution, not a market-size estimate.",
      confidenceNote: sourceDiversity >= 3 ? "Higher confidence because multiple source classes contributed." : "Moderate confidence with limited source diversity.",
      recommendedUsage: `Use when you want to emphasize cross-source validation in ${topic.slug}.${renderPreferredStatSourceHint(preferredStatSources)}`
      ,
      reviewStatus: "pending"
    });
  }

  const dominantSource = sortedSources[0];
  if (dominantSource && totalSignals > 0) {
    const [sourceType, count] = dominantSource;
    const percentage = Math.round((count / totalSignals) * 100);

    stats.push({
      claim: `${percentage}% of the matched signals in this cluster came from ${sourceType}.`,
      plainLanguageAngle:
        channel === "linkedin"
          ? "Use this to explain where the strongest current proof is concentrated."
          : "Use this only if the source concentration sharpens the take rather than narrowing it too much.",
      sourceName: sourceType,
      sourceUrl: normalizePublicUrl(sourceUrls.get(sourceType) ?? null),
      sourceDate: cluster?.lastSeenAt?.toISOString().slice(0, 10) ?? null,
      freshnessNote: "Source concentration can shift as new signals arrive; treat this as a current snapshot.",
      confidenceNote: percentage >= 60 ? "Moderate confidence for a source-concentration stat." : "Use cautiously; the mix is still fairly distributed.",
      recommendedUsage: `Use sparingly as a supporting stat, not as the main headline claim.${renderPreferredStatSourceHint(preferredStatSources)}`
      ,
      reviewStatus: "pending"
    });
  }

  try {
    const platformEvidenceStats = await fetchPlatformSignalEvidenceStats({ idea, topic, channel });
    stats.push(...platformEvidenceStats);
  } catch {
    // Keep signal-evidence enrichment non-blocking.
  }

  return stats.slice(0, 5);
}

function renderPreferredStatSourceHint(preferredStatSources: string[]) {
  const statsHints = preferredStatSources.filter((entry) =>
    ["google-trends", "government-data", "industry-report", "marketplace-data", "benchmark-report", "public-company", "census"].includes(entry)
  );

  if (statsHints.length === 0) {
    return "";
  }

  return ` Prefer validating with ${statsHints.join(", ")} when stronger external numbers are available.`;
}

async function buildExternalInsightStatsResearch(input: {
  idea: Pick<IdeaWithCluster, "title" | "category" | "problemSummary">;
  topic: Pick<TopicRecord, "name" | "slug" | "keywordsJson" | "sourcePreferencesJson">;
  channel: (typeof researchStreamChannels)[number];
}) {
  const preferredStatSources = Array.isArray(input.topic.sourcePreferencesJson)
    ? input.topic.sourcePreferencesJson.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.toLowerCase())
    : [];
  const searchTerms = buildStatResearchTerms(input.topic.keywordsJson, input.idea);
  const newsQueries = buildExternalInsightQueries({
    topicName: input.topic.name,
    ideaTitle: input.idea.title,
    category: input.idea.category,
    searchTerms
  });
  const stats: SupportingStat[] = [];

  for (const query of newsQueries) {
    try {
      const response = await fetchWithTimeout(
        `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`,
        {
          headers: {
            Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8"
          }
        }
      );

      if (!response.ok) {
        continue;
      }

      const xml = await response.text();
      const matches = parseExternalInsightMatches(xml, searchTerms).filter(
        (match) => !stats.some((stat) => normalizeComparableStatClaim(stat.claim) === normalizeComparableStatClaim(match.claim))
      );

      stats.push(
        ...matches.map((match) => ({
          claim: match.claim,
          plainLanguageAngle:
            input.channel === "linkedin"
              ? `Use this to anchor the post in outside evidence about ${input.topic.name}, then translate the number into an operator implication.`
              : `Use this as a sharp external fact that makes the ${input.topic.name} angle feel timely and concrete.`,
          sourceName: match.sourceName,
          sourceUrl: normalizePublicUrl(match.sourceUrl),
          sourceDate: match.sourceDate,
          freshnessNote: match.sourceDate
            ? `This statistic was cited in a source dated ${match.sourceDate}. Verify the underlying article before publishing.`
            : "Publication date was not parsed from the feed item. Verify freshness before publishing.",
          confidenceNote: buildExternalInsightConfidenceNote(match.sourceUrl, preferredStatSources),
          recommendedUsage: `Use this as a publishable hook or infographic callout for ${input.topic.name}. Verify the original article or report before publication.${renderPreferredStatSourceHint(preferredStatSources)}`,
          reviewStatus: "pending" as const
        }))
      );
    } catch {
      // Keep external insight research non-blocking.
    }

    if (stats.length >= 5) {
      break;
    }
  }

  return stats.slice(0, 5);
}

async function fetchPlatformSignalEvidenceStats(input: {
  idea: Pick<IdeaWithCluster, "title" | "category" | "problemSummary">;
  topic: Pick<TopicRecord, "name" | "slug" | "keywordsJson" | "sourcePreferencesJson">;
  channel: (typeof researchStreamChannels)[number];
}) {
  const preferredStatSources = Array.isArray(input.topic.sourcePreferencesJson)
    ? input.topic.sourcePreferencesJson.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.toLowerCase())
    : [];
  const stats: SupportingStat[] = [];

  if (preferredStatSources.includes("google-trends")) {
    try {
      const googleTrendStats = await fetchGoogleTrendsSupportingStats(input);
      stats.push(...googleTrendStats);
    } catch {
      // Keep external statistics enrichment non-blocking.
    }
  }

  if (preferredStatSources.includes("marketplace-data") || preferredStatSources.includes("product-hunt")) {
    try {
      const productHuntStats = await fetchProductHuntSupportingStats(input);
      stats.push(...productHuntStats);
    } catch {
      // Keep external statistics enrichment non-blocking.
    }
  }

  return stats.slice(0, 2);
}

async function fetchGoogleTrendsSupportingStats(input: {
  idea: Pick<IdeaWithCluster, "title" | "category" | "problemSummary">;
  topic: Pick<TopicRecord, "name" | "slug" | "keywordsJson" | "sourcePreferencesJson">;
  channel: (typeof researchStreamChannels)[number];
}) {
  const geo = (process.env.SOCIAL_STATS_TRENDS_GEO ?? "US").toUpperCase();
  const response = await fetchWithTimeout(`https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`, {
    headers: {
      Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8"
    }
  });

  if (!response.ok) {
    throw new Error(`Google Trends RSS fetch failed for geo=${geo} with ${response.status}.`);
  }

  const xml = await response.text();
  const trendMatches = parseGoogleTrendMatches(xml, geo, buildStatResearchTerms(input.topic.keywordsJson, input.idea));

  if (trendMatches.length === 0) {
    return [];
  }

  const topMatch = trendMatches[0];
  const mostRecentDate = trendMatches
    .map((match) => match.sourceDate)
    .filter((value): value is string => Boolean(value))
    .sort()
    .reverse()[0] ?? null;
  const stats: SupportingStat[] = [
    {
      claim:
        trendMatches.length === 1
          ? `Google Trends surfaced 1 currently trending query relevant to ${input.topic.name}.`
          : `Google Trends surfaced ${trendMatches.length} currently trending queries relevant to ${input.topic.name}.`,
      plainLanguageAngle:
        input.channel === "linkedin"
          ? "Use this to show the topic is colliding with live search interest, not just discussion chatter."
          : "Use this as a quick proof that the theme is showing up in live search behavior too.",
      sourceName: "Google Trends",
      sourceUrl: normalizePublicUrl(topMatch.sourceUrl),
      sourceDate: mostRecentDate,
      freshnessNote: mostRecentDate
        ? `The latest matching Google Trends item in this pass was dated ${mostRecentDate}.`
        : "Google Trends dates were not available on the matching items.",
      confidenceNote: trendMatches.length >= 2 ? "Moderate confidence from multiple matching trending queries." : "Early external signal from a single matching trending query.",
      recommendedUsage: `Use this as external momentum validation for ${input.topic.slug}, then connect it back to the operator pain or workflow opportunity.`
      ,
      reviewStatus: "pending"
    }
  ];

  if (topMatch.approxTraffic) {
    stats.push({
      claim: `The strongest matching Google Trends item reported approximate traffic of ${topMatch.approxTraffic}.`,
      plainLanguageAngle:
        input.channel === "linkedin"
          ? "Use this as a punchy quantitative anchor, but keep the claim tied to search attention rather than market size."
          : "Use this as a short wow-factor stat without overstating what search volume means commercially.",
      sourceName: "Google Trends",
      sourceUrl: normalizePublicUrl(topMatch.sourceUrl),
      sourceDate: topMatch.sourceDate,
      freshnessNote: "Approximate traffic comes from the Google Trends trending feed and reflects search attention, not customer count or revenue.",
      confidenceNote: "Use with caution; this is a platform-reported approximate traffic label, not a precise benchmark.",
      recommendedUsage: `Use this as a supporting statistic for ${input.topic.name} when you want a stronger external number in the hook or infographic.`
      ,
      reviewStatus: "pending"
    });
  }

  return stats;
}

async function fetchProductHuntSupportingStats(input: {
  idea: Pick<IdeaWithCluster, "title" | "category" | "problemSummary">;
  topic: Pick<TopicRecord, "name" | "slug" | "keywordsJson" | "sourcePreferencesJson">;
  channel: (typeof researchStreamChannels)[number];
}) {
  const accessToken = process.env.PRODUCT_HUNT_ACCESS_TOKEN?.trim();

  if (!accessToken) {
    return [];
  }

  const response = await fetchWithTimeout("https://api.producthunt.com/v2/api/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      query: `
        query BizBrainProductHuntStats($first: Int!) {
          posts(first: $first) {
            edges {
              node {
                id
                name
                tagline
                url
                votesCount
                commentsCount
                createdAt
                topics(first: 10) {
                  edges {
                    node {
                      name
                      slug
                    }
                  }
                }
              }
            }
          }
        }
      `,
      variables: { first: 12 }
    })
  });

  if (!response.ok) {
    throw new Error(`Product Hunt GraphQL fetch failed with ${response.status}.`);
  }

  const payload = (await response.json()) as {
    data?: {
      posts?: {
        edges?: Array<{
          node?: {
            id: string;
            name?: string | null;
            tagline?: string | null;
            url?: string | null;
            votesCount?: number | null;
            commentsCount?: number | null;
            createdAt?: string | null;
            topics?: {
              edges?: Array<{
                node?: {
                  name?: string | null;
                  slug?: string | null;
                } | null;
              }>;
            } | null;
          } | null;
        }>;
      };
    };
    errors?: Array<{ message?: string }>;
  };

  if (payload.errors?.length) {
    throw new Error(`Product Hunt GraphQL returned ${payload.errors[0]?.message ?? "an unknown error"}.`);
  }

  const researchTerms = buildStatResearchTerms(input.topic.keywordsJson, input.idea);
  const matches = (payload.data?.posts?.edges ?? [])
    .map((edge) => edge.node)
    .filter((node): node is NonNullable<typeof node> => Boolean(node?.id))
    .map((post) => {
      const title = [post.name, post.tagline].filter(Boolean).join(" ").toLowerCase();
      const topicLabels = (post.topics?.edges ?? [])
        .map((edge) => edge?.node?.name || edge?.node?.slug)
        .filter((value): value is string => typeof value === "string")
        .join(" ")
        .toLowerCase();
      const haystack = `${title} ${topicLabels}`;
      const matchedTerms = researchTerms.filter((term) => keywordMatchesHaystack(term, haystack));

      return {
        post,
        matchedTermsCount: matchedTerms.length
      };
    })
    .filter((entry) => entry.matchedTermsCount > 0)
    .sort((left, right) => {
      const voteDelta = (right.post.votesCount ?? 0) - (left.post.votesCount ?? 0);

      if (voteDelta !== 0) {
        return voteDelta;
      }

      return right.matchedTermsCount - left.matchedTermsCount;
    });

  if (matches.length === 0) {
    return [];
  }

  const topMatch = matches[0].post;
  const stats: SupportingStat[] = [
    {
      claim:
        matches.length === 1
          ? `Product Hunt surfaced 1 recent launch relevant to ${input.topic.name}.`
          : `Product Hunt surfaced ${matches.length} recent launches relevant to ${input.topic.name}.`,
      plainLanguageAngle:
        input.channel === "linkedin"
          ? "Use this to show that the topic has visible launch and product activity, not just discussion volume."
          : "Use this as a quick proof that builders are already shipping into this space.",
      sourceName: "Product Hunt",
      sourceUrl: normalizePublicUrl(topMatch.url) ?? "https://www.producthunt.com/",
      sourceDate: topMatch.createdAt ? new Date(topMatch.createdAt).toISOString().slice(0, 10) : null,
      freshnessNote: "This reflects a recent Product Hunt launch snapshot, not a comprehensive market count.",
      confidenceNote: matches.length >= 2 ? "Moderate confidence from multiple relevant launches." : "Early external signal from a single relevant launch.",
      recommendedUsage: `Use this as marketplace validation for ${input.topic.slug}, then connect it to the practical wedge or positioning angle.`
      ,
      reviewStatus: "pending"
    }
  ];

  if (typeof topMatch.votesCount === "number") {
    stats.push({
      claim: `The strongest matching Product Hunt launch drew ${topMatch.votesCount} vote${topMatch.votesCount === 1 ? "" : "s"}${typeof topMatch.commentsCount === "number" ? ` and ${topMatch.commentsCount} comment${topMatch.commentsCount === 1 ? "" : "s"}` : ""}.`,
      plainLanguageAngle:
        input.channel === "linkedin"
          ? "Use this as an interest signal for visible launch traction, not as proof of revenue or retention."
          : "Use this as a short traction stat when you want to show builders are paying attention.",
      sourceName: "Product Hunt",
      sourceUrl: normalizePublicUrl(topMatch.url) ?? "https://www.producthunt.com/",
      sourceDate: topMatch.createdAt ? new Date(topMatch.createdAt).toISOString().slice(0, 10) : null,
      freshnessNote: "Votes and comments reflect Product Hunt engagement on a specific launch day or period.",
      confidenceNote: "Use with caution; marketplace engagement is directional traction, not commercial proof.",
      recommendedUsage: `Use this as a supporting marketplace-data stat for ${input.topic.name}, especially in social hooks or infographic callouts.`
      ,
      reviewStatus: "pending"
    });
  }

  return stats;
}

function buildStatResearchTerms(
  topicKeywordsJson: unknown,
  idea: Pick<IdeaWithCluster, "title" | "category" | "problemSummary">
) {
  const topicKeywords = Array.isArray(topicKeywordsJson)
    ? topicKeywordsJson.filter((entry): entry is string => typeof entry === "string")
    : [];
  const ideaTerms = `${idea.title} ${idea.category} ${idea.problemSummary ?? ""}`
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((term) => term.length >= 4)
    .filter((term) => !STAT_RESEARCH_STOP_WORDS.has(term));

  return [...new Set([...topicKeywords.map((entry) => entry.toLowerCase()), ...ideaTerms])].slice(0, 12);
}

function buildExternalInsightQueries(input: {
  topicName: string;
  ideaTitle: string;
  category: string;
  searchTerms: string[];
}) {
  const querySeeds = [
    [input.topicName, input.category].filter(Boolean).join(" "),
    input.ideaTitle,
    input.searchTerms.slice(0, 3).join(" ")
  ]
    .map((entry) => entry.trim())
    .filter(Boolean);

  return querySeeds.map((seed) => `${seed} (survey OR report OR study OR benchmark OR poll OR research OR data)`);
}

function parseExternalInsightMatches(xml: string, keywords: string[]) {
  const items = extractXmlTagBlocks(xml, "item");
  const matches: Array<{
    claim: string;
    sourceName: string;
    sourceUrl: string;
    sourceDate: string | null;
    relevanceScore: number;
  }> = [];

  for (const item of items) {
    const rawTitle = decodeXmlEntities(extractXmlTagText(item, "title") ?? "").trim();
    const rawDescription = decodeXmlEntities(extractXmlTagText(item, "description") ?? "").trim();
    const sourceUrl = decodeXmlEntities(extractXmlTagText(item, "link") ?? "").trim();

    if (!rawTitle || !sourceUrl) {
      continue;
    }

    const pubDate = extractXmlTagText(item, "pubDate");
    const sourceDate = pubDate ? new Date(pubDate).toISOString().slice(0, 10) : null;
    const sourceName = extractSourceNameFromNewsTitle(rawTitle, sourceUrl);
    const titleWithoutSource = rawTitle.replace(/\s+-\s+[^-]+$/, "").trim();
    const candidateText = [titleWithoutSource, stripHtml(rawDescription)].filter(Boolean).join(" ");
    const matchedKeywords = keywords.filter((keyword) => keywordMatchesHaystack(keyword, candidateText.toLowerCase()));

    if (matchedKeywords.length === 0) {
      continue;
    }

    const claim = extractNumericClaim(candidateText);

    if (!claim) {
      continue;
    }

    matches.push({
      claim,
      sourceName,
      sourceUrl,
      sourceDate,
      relevanceScore: matchedKeywords.length + scoreExternalSourceDomain(sourceUrl)
    });
  }

  return matches
    .sort((left, right) => right.relevanceScore - left.relevanceScore)
    .filter((match, index, all) => {
      const normalized = normalizeComparableStatClaim(match.claim);
      return all.findIndex((candidate) => normalizeComparableStatClaim(candidate.claim) === normalized) === index;
    })
    .slice(0, 3);
}

function extractSourceNameFromNewsTitle(title: string, sourceUrl: string) {
  const suffixMatch = title.match(/\s+-\s+([^-]+)$/);

  if (suffixMatch?.[1]) {
    return suffixMatch[1].trim();
  }

  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return "External source";
  }
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractNumericClaim(value: string) {
  const sentences = value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  for (const sentence of sentences) {
    if (/\d/.test(sentence) && sentence.length >= 24) {
      return ensureTrailingPeriod(sentence);
    }
  }

  const match = value.match(/[^.?!]*\d[^.?!]*[.?!]?/);
  return match ? ensureTrailingPeriod(match[0].trim()) : null;
}

function ensureTrailingPeriod(value: string) {
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function buildExternalInsightConfidenceNote(sourceUrl: string, preferredStatSources: string[]) {
  const domainScore = scoreExternalSourceDomain(sourceUrl);

  if (domainScore >= 3) {
    return "Higher confidence because the source domain looks like a more established news, research, or benchmark publisher. Verify the underlying article before publishing.";
  }

  if (preferredStatSources.length > 0) {
    return `Moderate confidence. Prefer validating against a stronger source class such as ${preferredStatSources.join(", ")} before publishing.`;
  }

  return "Moderate confidence. Verify the underlying article or report before using this as a public-facing hook.";
}

function scoreExternalSourceDomain(sourceUrl: string) {
  const domain = safeHostname(sourceUrl);

  if (!domain) {
    return 0;
  }

  const strongerDomains = [
    "forbes.com",
    "mckinsey.com",
    "gartner.com",
    "statista.com",
    "census.gov",
    "bls.gov",
    "worldbank.org",
    "oecd.org",
    "cnbc.com",
    "reuters.com",
    "bloomberg.com"
  ];

  if (strongerDomains.some((entry) => domain.endsWith(entry))) {
    return 3;
  }

  if (domain.endsWith(".gov") || domain.endsWith(".edu") || domain.endsWith(".org")) {
    return 2;
  }

  return 1;
}

function safeHostname(sourceUrl: string) {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function normalizeComparableStatClaim(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parseGoogleTrendMatches(xml: string, geo: string, keywords: string[]) {
  if (keywords.length === 0) {
    return [];
  }

  const items = extractXmlTagBlocks(xml, "item");
  const matches: Array<{
    title: string;
    sourceUrl: string;
    sourceDate: string | null;
    approxTraffic: string | null;
    matchScore: number;
  }> = [];

  for (const item of items) {
    const title = decodeXmlEntities(extractXmlTagText(item, "title") ?? "").trim();

    if (!title) {
      continue;
    }

    const pubDate = extractXmlTagText(item, "pubDate");
    const articleTitles = extractXmlTagBlocks(item, "ht:news_item")
      .map((newsItem) => decodeXmlEntities(extractXmlTagText(newsItem, "ht:news_item_title") ?? "").trim())
      .filter(Boolean);
    const approxTraffic = decodeXmlEntities(extractXmlTagText(item, "ht:approx_traffic") ?? "").trim() || null;
    const filterCorpus = [title, ...articleTitles].join(" ").toLowerCase();
    const matchedKeywords = keywords.filter((keyword) => keywordMatchesHaystack(keyword, filterCorpus));

    if (matchedKeywords.length === 0) {
      continue;
    }

    const articleUrls = extractXmlTagBlocks(item, "ht:news_item")
      .map((newsItem) => decodeXmlEntities(extractXmlTagText(newsItem, "ht:news_item_url") ?? "").trim())
      .filter(Boolean);

    matches.push({
      title,
      sourceUrl:
        articleUrls[0] || `https://trends.google.com/trends/explore?geo=${encodeURIComponent(geo)}&q=${encodeURIComponent(title)}`,
      sourceDate: pubDate ? new Date(pubDate).toISOString().slice(0, 10) : null,
      approxTraffic,
      matchScore: matchedKeywords.length
    });
  }

  return matches.sort((left, right) => {
    const trafficDelta = parseApproximateTraffic(right.approxTraffic) - parseApproximateTraffic(left.approxTraffic);

    if (trafficDelta !== 0) {
      return trafficDelta;
    }

    return right.matchScore - left.matchScore;
  });
}

function keywordMatchesHaystack(keyword: string, haystack: string) {
  const escapedKeyword = escapeRegExp(keyword.trim().toLowerCase());

  if (!escapedKeyword) {
    return false;
  }

  const pattern = escapedKeyword.includes("\\ ")
    ? new RegExp(`(^|[^a-z0-9])${escapedKeyword}([^a-z0-9]|$)`, "i")
    : new RegExp(`\\b${escapedKeyword}\\b`, "i");

  return pattern.test(haystack);
}

function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  return fetch(url, {
    ...init,
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));
}

function extractXmlTagBlocks(xml: string, tagName: string) {
  const matches = xml.matchAll(new RegExp(`<${escapeRegExp(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegExp(tagName)}>`, "gi"));
  return [...matches].map((match) => match[1]);
}

function extractXmlTagText(xml: string, tagName: string) {
  const match = xml.match(new RegExp(`<${escapeRegExp(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegExp(tagName)}>`, "i"));
  return match?.[1] ?? null;
}

function decodeXmlEntities(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseApproximateTraffic(value: string | null) {
  if (!value) {
    return 0;
  }

  const normalized = value.replaceAll(",", "").trim().toUpperCase();
  const match = normalized.match(/(\d+(?:\.\d+)?)([KMB])?\+?/);

  if (!match) {
    return 0;
  }

  const base = Number(match[1]);
  const multiplier =
    match[2] === "B" ? 1_000_000_000 : match[2] === "M" ? 1_000_000 : match[2] === "K" ? 1_000 : 1;

  return base * multiplier;
}

const STAT_RESEARCH_STOP_WORDS = new Set([
  "about",
  "behind",
  "business",
  "current",
  "their",
  "there",
  "these",
  "this",
  "with",
  "from",
  "that",
  "where",
  "would",
  "into",
  "operator",
  "operators"
]);

function buildFallbackSupportingStats(input: {
  channel: (typeof researchStreamChannels)[number];
  idea: IdeaWithCluster;
  topic: TopicRecord;
  frameworkName: string;
  styleName: string;
  assetMode: string;
}) {
  const attributions = Array.isArray(input.idea.sourceAttributionJson)
    ? input.idea.sourceAttributionJson.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    : [];

  return attributions.slice(0, 2).map((entry) => {
    const sourceType = typeof entry.sourceType === "string" ? entry.sourceType : "source";
    const signalCount = typeof entry.signalCount === "number" ? entry.signalCount : null;
    const sampleUrl = Array.isArray(entry.sampleUrls)
      ? entry.sampleUrls.find((candidate): candidate is string => typeof candidate === "string" && candidate.startsWith("http"))
      : null;

    return {
      claim:
        signalCount && signalCount > 1
          ? `${signalCount} recent ${sourceType} signals pointed at the same pain pattern behind ${input.idea.title}.`
          : `Recent ${sourceType} evidence reinforced the core pain pattern behind ${input.idea.title}.`,
      plainLanguageAngle:
        input.channel === "linkedin"
          ? "Use this as a credibility anchor before explaining the business implication."
          : "Use this as a quick proof point before the sharper opinion.",
      sourceName: sourceType,
      sourceUrl: normalizePublicUrl(sampleUrl ?? null),
      sourceDate: null,
      freshnessNote: "This stat is derived from the latest matched source evidence in BizBrain, not a third-party benchmark report.",
      confidenceNote: signalCount && signalCount > 1 ? "Moderate confidence from repeated source matches." : "Low-to-moderate confidence; based on limited source evidence.",
      recommendedUsage: `Use as a supporting stat in a ${input.frameworkName} draft with ${input.styleName} framing.`
      ,
      reviewStatus: "pending"
    };
  });
}

function normalizeSupportingStat(value: Record<string, unknown> | SupportingStat): SupportingStat | null {
  if (typeof value.claim !== "string" || typeof value.plainLanguageAngle !== "string" || typeof value.sourceName !== "string") {
    return null;
  }

  return {
    claim: value.claim,
    plainLanguageAngle: value.plainLanguageAngle,
    sourceName: value.sourceName,
    sourceUrl: normalizePublicUrl(typeof value.sourceUrl === "string" ? value.sourceUrl : null),
    sourceDate: typeof value.sourceDate === "string" ? value.sourceDate : null,
    freshnessNote: typeof value.freshnessNote === "string" ? value.freshnessNote : "No freshness note recorded.",
    confidenceNote: typeof value.confidenceNote === "string" ? value.confidenceNote : "No confidence note recorded.",
    recommendedUsage: typeof value.recommendedUsage === "string" ? value.recommendedUsage : "No usage guidance recorded.",
    reviewStatus:
      typeof value.reviewStatus === "string" && ["pending", "approved", "use-with-caution", "rejected"].includes(value.reviewStatus)
        ? (value.reviewStatus as SupportingStat["reviewStatus"])
        : "pending"
  };
}

function normalizePublicUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function buildFallbackMediaCandidates(input: {
  channel: (typeof researchStreamChannels)[number];
  idea: IdeaWithCluster;
  topic: TopicRecord;
  frameworkName: string;
  styleName: string;
  assetMode: string;
}) {
  if (input.assetMode === "none") {
    return [];
  }

  const concept = `${input.topic.name}: ${input.idea.title}`;
  const candidates = [];

  if (input.assetMode === "stock") {
    candidates.push(
      {
        label: `${concept} using licensed stock photo search`,
        sourceType: "licensed-stock" as const,
        originUrl: "https://www.pexels.com/",
        originDomain: "pexels.com",
        candidateUrl: null,
        licenseLabel: "Pexels License",
        licenseUrl: "https://www.pexels.com/license/",
        attributionText: null,
        usageStatus: "review-required" as const,
        reviewStatus: "pending" as const,
        requiresHumanReview: true,
        referenceOnly: false,
        rightsNotes: ["Confirm the specific asset license and whether identifiable people, logos, or property releases affect use."]
      },
      {
        label: `${concept} using open-license search`,
        sourceType: "open-license" as const,
        originUrl: "https://openverse.org/",
        originDomain: "openverse.org",
        candidateUrl: null,
        licenseLabel: "Openverse / source-specific open license",
        licenseUrl: null,
        attributionText: "Check the original asset page for attribution requirements.",
        usageStatus: "review-required" as const,
        reviewStatus: "pending" as const,
        requiresHumanReview: true,
        referenceOnly: false,
        rightsNotes: ["Verify the underlying asset license and attribution terms on the original source page before publication."]
      }
    );
  }

  if (input.assetMode === "ai-generated") {
    candidates.push({
      label: `${concept} as a first-party AI-generated visual`,
      sourceType: "ai-generated" as const,
      originUrl: null,
      originDomain: "first-party",
      candidateUrl: null,
      licenseLabel: "First-party generated asset",
      licenseUrl: null,
      attributionText: null,
      usageStatus: "review-required" as const,
      reviewStatus: "pending" as const,
      requiresHumanReview: true,
      referenceOnly: false,
      rightsNotes: [
        "Review for trademark, likeness, and implied-endorsement issues before posting.",
        `Use ${input.styleName} traits and ${input.frameworkName} framing without copying protected branding or living-artist style.`
      ]
    });
  }

  candidates.push(
    {
      label: `${concept} inspiration board from Google Images`,
      sourceType: "discovery-reference" as const,
      originUrl: "https://images.google.com/",
      originDomain: "google.com",
      candidateUrl: null,
      licenseLabel: null,
      licenseUrl: null,
      attributionText: null,
      usageStatus: "reference-only" as const,
      reviewStatus: "reference-only" as const,
      requiresHumanReview: true,
      referenceOnly: true,
      rightsNotes: ["Use only for inspiration or origin discovery. Do not publish a Google Images result directly without verifying rights from the original source page."]
    },
    {
      label: `${concept} inspiration board from Pinterest`,
      sourceType: "discovery-reference" as const,
      originUrl: "https://www.pinterest.com/",
      originDomain: "pinterest.com",
      candidateUrl: null,
      licenseLabel: null,
      licenseUrl: null,
      attributionText: null,
      usageStatus: "reference-only" as const,
      reviewStatus: "reference-only" as const,
      requiresHumanReview: true,
      referenceOnly: true,
      rightsNotes: ["Treat Pins as references only unless the original asset owner and license are independently verified."]
    }
  );

  return candidates;
}

function buildFallbackMediaPolicy(assetMode: string) {
  return {
    preferredSourceClasses:
      assetMode === "ai-generated"
        ? ["first-party", "ai-generated", "licensed-stock", "open-license"]
        : ["first-party", "licensed-stock", "open-license", "ai-generated"],
    prohibitedDirectUseSources: ["google-images", "pinterest"],
    humanReviewRequired: true,
    publishingNotes: [
      "Do not publish third-party discovery-source imagery without verifying the original asset rights.",
      "Keep attribution and release checks with the final selected asset.",
      "Escalate trademarks, logos, celebrity likenesses, and identifiable people for manual review."
    ]
  };
}

const socialDraftJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    targetAudience: { type: "string" },
    hook: { type: "string" },
    thesis: { type: "string" },
    supportingPoints: {
      type: "array",
      items: { type: "string" },
      minItems: 2,
      maxItems: 4
    },
    counterpoint: { type: "string" },
    cta: { type: "string" },
    draftMarkdown: { type: "string" },
    visualBrief: {
      type: "object",
      additionalProperties: false,
      properties: {
        concept: { type: "string" },
        format: { type: "string" },
        headlineText: { type: "string" },
        captionText: { type: "string" },
        ctaText: { type: "string" }
      },
      required: ["concept", "format", "headlineText", "captionText", "ctaText"]
    },
    infographicBrief: {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: { type: "string" },
        format: { type: "string" },
        panels: {
          type: "array",
          items: { type: "string" },
          minItems: 3,
          maxItems: 6
        }
      },
      required: ["summary", "format", "panels"]
    },
    infographicCreativeBrief: {
      type: "object",
      additionalProperties: false,
      properties: {
        creativeDirection: { type: "string" },
        objective: { type: "string" },
        visualStyle: { type: "string" },
        layoutStrategy: { type: "string" },
        compositionPrompt: { type: "string" },
        textHierarchy: {
          type: "array",
          items: { type: "string" },
          minItems: 3,
          maxItems: 6
        },
        chartOrDiagramType: { type: "string" },
        imageSourceStrategy: { type: "string" },
        aiImagePrompt: { type: "string" },
        panelPrompts: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 6
        },
        avoidNotes: {
          type: "array",
          items: { type: "string" },
          minItems: 2,
          maxItems: 6
        }
      },
      required: [
        "creativeDirection",
        "objective",
        "visualStyle",
        "layoutStrategy",
        "compositionPrompt",
        "textHierarchy",
        "chartOrDiagramType",
        "imageSourceStrategy",
        "aiImagePrompt",
        "panelPrompts",
        "avoidNotes"
      ]
    },
    mediaCandidates: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          sourceType: { type: "string", enum: ["first-party", "licensed-stock", "open-license", "ai-generated", "discovery-reference"] },
          originUrl: { type: ["string", "null"] },
          originDomain: { type: ["string", "null"] },
          candidateUrl: { type: ["string", "null"] },
          licenseLabel: { type: ["string", "null"] },
          licenseUrl: { type: ["string", "null"] },
          attributionText: { type: ["string", "null"] },
          usageStatus: { type: "string", enum: ["publishable", "review-required", "reference-only"] },
          reviewStatus: { type: "string", enum: ["pending", "approved", "use-with-caution", "rejected", "reference-only"] },
          requiresHumanReview: { type: "boolean" },
          referenceOnly: { type: "boolean" },
          rightsNotes: {
            type: "array",
            items: { type: "string" },
            maxItems: 5
          }
        },
        required: [
          "label",
          "sourceType",
          "originUrl",
          "originDomain",
          "candidateUrl",
          "licenseLabel",
          "licenseUrl",
          "attributionText",
          "usageStatus",
          "reviewStatus",
          "requiresHumanReview",
          "referenceOnly",
          "rightsNotes"
        ]
      }
    },
    mediaPolicy: {
      type: "object",
      additionalProperties: false,
      properties: {
        preferredSourceClasses: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 6
        },
        prohibitedDirectUseSources: {
          type: "array",
          items: { type: "string" },
          maxItems: 6
        },
        humanReviewRequired: { type: "boolean" },
        publishingNotes: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 6
        }
      },
      required: ["preferredSourceClasses", "prohibitedDirectUseSources", "humanReviewRequired", "publishingNotes"]
    },
    supportingStats: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          claim: { type: "string" },
          plainLanguageAngle: { type: "string" },
          sourceName: { type: "string" },
          sourceUrl: { type: ["string", "null"] },
          sourceDate: { type: ["string", "null"] },
          freshnessNote: { type: "string" },
          confidenceNote: { type: "string" },
          recommendedUsage: { type: "string" },
          reviewStatus: { type: "string", enum: ["pending", "approved", "use-with-caution", "rejected"] }
        },
        required: [
          "claim",
          "plainLanguageAngle",
          "sourceName",
          "sourceUrl",
          "sourceDate",
          "freshnessNote",
          "confidenceNote",
          "recommendedUsage",
          "reviewStatus"
        ]
      }
    },
    qualityScore: { type: "number", minimum: 0, maximum: 10 }
  },
  required: [
    "title",
    "targetAudience",
    "hook",
    "thesis",
    "supportingPoints",
    "counterpoint",
    "cta",
    "draftMarkdown",
    "visualBrief",
    "supportingStats",
    "infographicBrief",
    "infographicCreativeBrief",
    "mediaCandidates",
    "mediaPolicy",
    "qualityScore"
  ]
} as const;
