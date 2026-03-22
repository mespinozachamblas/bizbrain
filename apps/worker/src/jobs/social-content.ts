import { researchStreamChannels, researchStreamIds, socialDraftSchema, type SocialDraft } from "@bizbrain/core";
import { db } from "@bizbrain/db";
import { buildSocialDraftPrompt } from "@bizbrain/prompts";

type IdeaWithCluster = {
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
  cluster: {
    title: string;
    summary: string | null;
  } | null;
};

type TopicRecord = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  enabledChannelsJson: unknown;
  keywordsJson: unknown;
  exclusionsJson: unknown;
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

  const [topics, ideas] = await Promise.all([
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
    db.idea.findMany({
      where: {
        researchStreamId: researchStreamIds.opportunity
      },
      orderBy: [{ qualityScore: "desc" }, { updatedAt: "desc" }],
      take: 12,
      include: {
        cluster: true
      }
    })
  ]);

  if (topics.length === 0 || ideas.length === 0) {
    return { recordsWritten: 0, warnings: [] };
  }

  const result: SocialDraftContext = {
    topics,
    recordsWritten: 0,
    warnings: []
  };

  for (const topic of topics) {
    const matchedIdeas = ideas
      .map((idea) => ({
        idea,
        score: scoreIdeaForTopic(idea, topic)
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || (right.idea.qualityScore ?? 0) - (left.idea.qualityScore ?? 0))
      .slice(0, 2);

    for (const { idea } of matchedIdeas) {
      const channels = resolveTopicChannels(topic.enabledChannelsJson);

      for (const channel of channels) {
        try {
          const framework = topic.defaultCopyFramework ?? socialStream.defaultCopyFramework ?? null;
          const styleProfile = topic.defaultStyleProfile ?? socialStream.defaultStyleProfile ?? null;
          const assetMode = topic.defaultAssetMode ?? socialStream.defaultAssetMode ?? "none";
          const statsResearch = await buildSupportingStatsResearch(idea, topic, channel);
          const fallbackDraft = buildFallbackSocialDraft({
            channel,
            idea,
            topic,
            frameworkName: framework?.name ?? "custom",
            styleName: styleProfile?.name ?? "founder educator",
            assetMode,
            statsResearch
          });
          let generated = fallbackDraft;

          try {
            generated = (await generateSocialDraft({
              channel,
              idea,
              topic,
              framework,
              styleProfile,
              assetMode,
              statsResearch
            })) ?? fallbackDraft;
          } catch (error) {
            result.warnings.push(`${topic.slug}/${channel}: ${error instanceof Error ? error.message : String(error)}`);
          }

          const existingDraft = await db.contentDraft.findFirst({
            where: {
              researchStreamId: socialStream.id,
              topicId: topic.id,
              sourceIdeaId: idea.id,
              targetChannel: channel
            },
            select: { id: true }
          });

          const data = {
            researchStreamId: socialStream.id,
            topicId: topic.id,
            sourceIdeaId: idea.id,
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
            sourceAttributionJson: idea.sourceAttributionJson ?? undefined,
            status: "draft"
          };

          if (existingDraft) {
            await db.contentDraft.update({
              where: { id: existingDraft.id },
              data
            });
          } else {
            await db.contentDraft.create({
              data
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
  const draft = await db.contentDraft.findUnique({
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
      sourceIdea: {
        include: {
          cluster: true
        }
      }
    }
  });

  if (!draft) {
    throw new Error("Social draft not found.");
  }

  if (!draft.topic || !draft.sourceIdea) {
    throw new Error("Social draft is missing its topic or source idea.");
  }

  const framework = draft.topic.defaultCopyFramework ?? draft.researchStream.defaultCopyFramework ?? null;
  const styleProfile = draft.topic.defaultStyleProfile ?? draft.researchStream.defaultStyleProfile ?? null;
  const assetMode = draft.topic.defaultAssetMode ?? draft.researchStream.defaultAssetMode ?? "none";
  const statsResearch = await buildSupportingStatsResearch(draft.sourceIdea, draft.topic, draft.targetChannel as (typeof researchStreamChannels)[number]);
  const fallbackDraft = buildFallbackSocialDraft({
    channel: draft.targetChannel as (typeof researchStreamChannels)[number],
    idea: draft.sourceIdea,
    topic: draft.topic,
    frameworkName: framework?.name ?? "custom",
    styleName: styleProfile?.name ?? "founder educator",
    assetMode,
    statsResearch
  });

  let generated = fallbackDraft;
  const warnings: string[] = [];

  try {
    generated =
      (await generateSocialDraft({
        channel: draft.targetChannel as (typeof researchStreamChannels)[number],
        idea: draft.sourceIdea,
        topic: draft.topic,
        framework,
        styleProfile,
        assetMode,
        statsResearch
      })) ?? fallbackDraft;
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : String(error));
  }

  await db.contentDraft.update({
    where: { id: draft.id },
    data: {
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
      sourceAttributionJson: draft.sourceIdea.sourceAttributionJson ?? undefined,
      status: "draft"
    }
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

function scoreIdeaForTopic(idea: IdeaWithCluster, topic: TopicRecord) {
  const keywords = Array.isArray(topic.keywordsJson)
    ? topic.keywordsJson.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.toLowerCase())
    : [];
  const exclusions = Array.isArray(topic.exclusionsJson)
    ? topic.exclusionsJson.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.toLowerCase())
    : [];
  const haystack = [
    idea.title,
    idea.category,
    idea.subcategory,
    idea.targetCustomer,
    idea.problemSummary,
    idea.solutionConcept,
    idea.evidenceSummary,
    idea.cluster?.summary,
    idea.cluster?.title
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (exclusions.some((term) => haystack.includes(term))) {
    return 0;
  }

  let score = idea.qualityScore ?? 0;

  for (const keyword of keywords) {
    if (haystack.includes(keyword)) {
      score += 3;
    }
  }

  if (topic.slug.includes("linkedin") && /(founder|operator|team|startup)/.test(haystack)) {
    score += 2;
  }

  if (topic.slug.includes("x") && /(trend|automation|distribution|fintech)/.test(haystack)) {
    score += 2;
  }

  return score;
}

async function generateSocialDraft(input: {
  channel: (typeof researchStreamChannels)[number];
  idea: IdeaWithCluster;
  topic: TopicRecord;
  framework: { name: string; description: string | null; structureJson: unknown } | null;
  styleProfile: { name: string; description: string | null; inspirationSummary: string | null; styleTraitsJson: unknown; guardrailsJson: unknown } | null;
  assetMode: string;
  statsResearch: Array<{
    claim: string;
    plainLanguageAngle: string;
    sourceName: string;
    sourceUrl: string;
    sourceDate: string | null;
    freshnessNote: string;
    confidenceNote: string;
    recommendedUsage: string;
  }>;
}) {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), resolveSocialDraftTimeoutMs());

  let response: Response;

  try {
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
                text: [
                  `CHANNEL: ${input.channel}`,
                  `TOPIC: ${input.topic.name}`,
                  `TOPIC_DESCRIPTION: ${input.topic.description ?? "(none)"}`,
                  `COPY_FRAMEWORK: ${input.framework?.name ?? "Use the topic/stream default persuasion structure."}`,
                  `COPY_FRAMEWORK_DETAILS: ${JSON.stringify(input.framework?.structureJson ?? [])}`,
                  `STYLE_PROFILE: ${input.styleProfile?.name ?? "Founder educator"}`,
                  `STYLE_DESCRIPTION: ${input.styleProfile?.description ?? "(none)"}`,
                  `STYLE_INSPIRATION: ${input.styleProfile?.inspirationSummary ?? "(none)"}`,
                  `STYLE_TRAITS: ${JSON.stringify(input.styleProfile?.styleTraitsJson ?? [])}`,
                  `STYLE_GUARDRAILS: ${JSON.stringify(input.styleProfile?.guardrailsJson ?? [])}`,
                  `ASSET_MODE: ${input.assetMode}`,
                  `IDEA_TITLE: ${input.idea.title}`,
                  `IDEA_CATEGORY: ${input.idea.category}`,
                  `BUSINESS_TYPE: ${input.idea.businessType ?? "(none)"}`,
                  `TARGET_CUSTOMER: ${input.idea.targetCustomer ?? "(none)"}`,
                  `PROBLEM: ${input.idea.problemSummary ?? "(none)"}`,
                  `SOLUTION: ${input.idea.solutionConcept ?? "(none)"}`,
                  `MONETIZATION: ${input.idea.monetizationAngle ?? "(none)"}`,
                  `EVIDENCE: ${input.idea.evidenceSummary ?? "(none)"}`,
                  `SOURCE_ATTRIBUTION: ${JSON.stringify(input.idea.sourceAttributionJson ?? [])}`,
                  `SUPPORTING_STATS_RESEARCH: ${JSON.stringify(input.statsResearch)}`
                ].join("\n")
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
    throw new Error(`OpenAI social draft request failed with ${response.status}.`);
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

  return socialDraftSchema.parse(JSON.parse(textOutput));
}

function resolveSocialDraftTimeoutMs() {
  const parsed = Number(process.env.OPENAI_SOCIAL_DRAFT_TIMEOUT_MS ?? "20000");

  if (!Number.isFinite(parsed) || parsed < 5000) {
    return 20000;
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
  statsResearch: Array<{
    claim: string;
    plainLanguageAngle: string;
    sourceName: string;
    sourceUrl: string;
    sourceDate: string | null;
    freshnessNote: string;
    confidenceNote: string;
    recommendedUsage: string;
  }>;
}): SocialDraft {
  const audience = input.channel === "linkedin" ? "Founders and operators on LinkedIn" : "Operators and builders on X";
  const hook =
    input.channel === "linkedin"
      ? `Most founders miss this signal: ${input.idea.problemSummary ?? input.idea.title}`
      : `${input.idea.title} is a stronger business signal than it looks.`;
  const thesis =
    input.channel === "linkedin"
      ? `${input.idea.title} points to a practical wedge in ${input.idea.category} that operators would understand immediately.`
      : `${input.idea.title} shows where ${input.idea.category} demand is getting sharper.`;
  const supportingPoints = [
    input.idea.problemSummary ?? "The source material showed concrete operator pain.",
    input.idea.solutionConcept ?? "There is a clear product angle, not just a generic trend.",
    input.idea.monetizationAngle ?? "There is an identifiable way to make money from the opportunity."
  ].slice(0, 3);
  const cta =
    input.channel === "linkedin"
      ? "Would you build this as software, a service, or a marketplace?"
      : "Would you ship this as SaaS, service, or workflow tooling?";
  const draftMarkdown =
    input.channel === "linkedin"
      ? `${hook}\n\n${thesis}\n\n1. ${supportingPoints[0]}\n2. ${supportingPoints[1]}\n3. ${supportingPoints[2]}\n\nMy take: ${input.idea.solutionConcept ?? input.idea.title}\n\n${cta}`
      : `${hook}\n\n${thesis}\n\n- ${supportingPoints[0]}\n- ${supportingPoints[1]}\n- ${supportingPoints[2]}\n\n${cta}`;

  return socialDraftSchema.parse({
    title: `${input.idea.title} (${input.channel.toUpperCase()})`,
    targetAudience: audience,
    hook,
    thesis,
    supportingPoints,
    counterpoint: "This only matters if the pain shows up repeatedly beyond a single anecdote.",
    cta,
    draftMarkdown,
    visualBrief: {
      concept: `${input.topic.name} operator insight with a concrete business angle.`,
      format: input.assetMode === "ai-generated" ? "editorial illustration" : "stock-led social card",
      headlineText: input.idea.title,
      captionText: `${input.frameworkName} structure in a ${input.styleName} voice.`,
      ctaText: cta
    },
    infographicBrief: {
      summary: `Break down the opportunity behind ${input.idea.title}.`,
      format: input.channel === "linkedin" ? "carousel" : "single-image infographic",
      panels: [
        `Signal: ${input.idea.problemSummary ?? input.idea.title}`,
        `Opportunity: ${input.idea.solutionConcept ?? "Product angle to validate."}`,
        `Business model: ${input.idea.monetizationAngle ?? "Revenue model to test."}`
      ]
    },
    mediaCandidates: buildFallbackMediaCandidates(input),
    mediaPolicy: buildFallbackMediaPolicy(input.assetMode),
    supportingStats: input.statsResearch.length > 0 ? input.statsResearch : buildFallbackSupportingStats(input),
    qualityScore: Math.min(9.2, Math.max(6.4, input.idea.qualityScore ?? 7))
  });
}

async function buildSupportingStatsResearch(
  idea: Pick<IdeaWithCluster, "clusterId" | "title" | "category" | "problemSummary" | "sourceAttributionJson">,
  topic: Pick<TopicRecord, "name" | "slug">,
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
  const stats: Array<{
    claim: string;
    plainLanguageAngle: string;
    sourceName: string;
    sourceUrl: string;
    sourceDate: string | null;
    freshnessNote: string;
    confidenceNote: string;
    recommendedUsage: string;
  }> = [];

  if (totalSignals > 0) {
    stats.push({
      claim: `${totalSignals} matched signal${totalSignals === 1 ? "" : "s"} currently support the opportunity behind ${idea.title}.`,
      plainLanguageAngle:
        channel === "linkedin"
          ? "Use this to establish that the insight is pattern-based, not a one-off anecdote."
          : "Use this as a concise pattern signal before the sharper take.",
      sourceName: "BizBrain cluster evidence",
      sourceUrl: sourceUrls.get(sortedSources[0]?.[0] ?? "") ?? "https://app.bizbrain.local/source-evidence",
      sourceDate: cluster?.lastSeenAt?.toISOString().slice(0, 10) ?? null,
      freshnessNote:
        cluster?.lastSeenAt
          ? `Latest matched evidence was seen on ${cluster.lastSeenAt.toISOString().slice(0, 10)}.`
          : "Latest evidence date is not stored.",
      confidenceNote: totalSignals >= 4 ? "Moderate confidence from repeated signal clustering." : "Early signal; useful, but still light on repeated evidence.",
      recommendedUsage: `Lead with the pattern, then connect it to ${topic.name}.`
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
      sourceUrl: sourceUrls.get(sortedSources[0]?.[0] ?? "") ?? "https://app.bizbrain.local/source-evidence",
      sourceDate: cluster?.lastSeenAt?.toISOString().slice(0, 10) ?? null,
      freshnessNote: "This is based on the current cluster membership and source attribution, not a market-size estimate.",
      confidenceNote: sourceDiversity >= 3 ? "Higher confidence because multiple source classes contributed." : "Moderate confidence with limited source diversity.",
      recommendedUsage: `Use when you want to emphasize cross-source validation in ${topic.slug}.`
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
      sourceUrl: sourceUrls.get(sourceType) ?? "https://app.bizbrain.local/source-evidence",
      sourceDate: cluster?.lastSeenAt?.toISOString().slice(0, 10) ?? null,
      freshnessNote: "Source concentration can shift as new signals arrive; treat this as a current snapshot.",
      confidenceNote: percentage >= 60 ? "Moderate confidence for a source-concentration stat." : "Use cautiously; the mix is still fairly distributed.",
      recommendedUsage: `Use sparingly as a supporting stat, not as the main headline claim.`
    });
  }

  return stats.slice(0, 3);
}

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
      sourceUrl: sampleUrl ?? "https://app.bizbrain.local/source-evidence",
      sourceDate: null,
      freshnessNote: "This stat is derived from the latest matched source evidence in BizBrain, not a third-party benchmark report.",
      confidenceNote: signalCount && signalCount > 1 ? "Moderate confidence from repeated source matches." : "Low-to-moderate confidence; based on limited source evidence.",
      recommendedUsage: `Use as a supporting stat in a ${input.frameworkName} draft with ${input.styleName} framing.`
    };
  });
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
    mediaCandidates: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          sourceType: { type: "string", enum: ["first-party", "licensed-stock", "open-license", "ai-generated", "discovery-reference"] },
          originUrl: { type: ["string", "null"], format: "uri" },
          originDomain: { type: ["string", "null"] },
          candidateUrl: { type: ["string", "null"], format: "uri" },
          licenseLabel: { type: ["string", "null"] },
          licenseUrl: { type: ["string", "null"], format: "uri" },
          attributionText: { type: ["string", "null"] },
          usageStatus: { type: "string", enum: ["publishable", "review-required", "reference-only"] },
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
          sourceUrl: { type: "string", format: "uri" },
          sourceDate: { type: ["string", "null"] },
          freshnessNote: { type: "string" },
          confidenceNote: { type: "string" },
          recommendedUsage: { type: "string" }
        },
        required: [
          "claim",
          "plainLanguageAngle",
          "sourceName",
          "sourceUrl",
          "sourceDate",
          "freshnessNote",
          "confidenceNote",
          "recommendedUsage"
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
    "mediaCandidates",
    "mediaPolicy",
    "qualityScore"
  ]
} as const;
