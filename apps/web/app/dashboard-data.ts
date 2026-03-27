import { db } from "@bizbrain/db";

export type DashboardData = {
  stats: {
    sourceConfigs: number;
    rawSignals: number;
    clusters: number;
    ideas: number;
    readyIdeas: number;
    ideasNeedingReview: number;
    readySocialDrafts: number;
    socialDraftsNeedingReview: number;
  };
  recentJobRuns: Array<{
    id: string;
    jobName: string;
    runStatus: string;
    startedAt: Date;
    recordsRead: number;
    recordsWritten: number;
  }>;
  topClusters: Array<{
    id: string;
    title: string;
    primaryCategory: string | null;
    signalCount: number;
    scoreTotal: number;
    summary: string | null;
  }>;
  latestIdeas: Array<{
    id: string;
    title: string;
    category: string;
    businessType: string | null;
    qualityScore: number | null;
    qualityReason: string | null;
    status: string;
    updatedAt: Date;
    evidenceSummary: string | null;
    sourceAttributionJson: unknown;
  }>;
  digestRecipients: Array<{
    id: string;
    updatedAt: Date;
    researchStream: {
      id: string;
      slug: string;
      name: string;
    };
    email: string;
    enabled: boolean;
    isOwnerDefault: boolean;
  }>;
  sourceConfigs: Array<{
    id: string;
    sourceType: string;
    enabled: boolean;
  }>;
  researchStreams: Array<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    enabled: boolean;
    deliveryType: string;
    scheduleCron: string | null;
    defaultAssetMode: string | null;
    enabledChannelsJson: unknown;
  }>;
  topics: Array<{
    id: string;
    researchStreamId: string;
    slug: string;
    name: string;
    description: string | null;
    enabled: boolean;
    topicFitThreshold: number | null;
    defaultAssetMode: string | null;
    defaultCopyFrameworkId: string | null;
    defaultStyleProfileId: string | null;
    enabledChannelsJson: unknown;
    keywordsJson: unknown;
    exclusionsJson: unknown;
    sourcePreferencesJson: unknown;
    performance: {
      totalDrafts: number;
      readyDrafts: number;
      avgQualityScore: number | null;
      avgExportReadiness: number | null;
    };
    researchStream: {
      id: string;
      name: string;
      slug: string;
    };
  }>;
  copyFrameworks: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    enabled: boolean;
    structureJson: unknown;
  }>;
  styleProfiles: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    inspirationSummary: string | null;
    enabled: boolean;
    styleTraitsJson: unknown;
    guardrailsJson: unknown;
  }>;
  visualGenerationProfiles: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    visualMode: string;
    designToolPreference: string;
    costTier: string;
    maxAssetsPerRun: number;
    reviewRequired: boolean;
    aspectRatio: string | null;
    brandTheme: string | null;
    enabled: boolean;
  }>;
  latestContentDrafts: Array<{
    id: string;
    title: string;
    targetChannel: string;
    status: string;
    qualityScore: number | null;
    hook: string | null;
    thesis: string | null;
    updatedAt: Date;
    topic: {
      name: string;
    } | null;
    copyFramework: {
      name: string;
    } | null;
    styleProfile: {
      name: string;
    } | null;
  }>;
  recentSourceRuns: Array<{
    id: string;
    runStatus: string;
    recordsRead: number;
    recordsWritten: number;
    startedAt: Date;
    sourceConfig: {
      sourceType: string;
    };
  }>;
  recentHealthChecks: Array<{
    id: string;
    checkType: string;
    checkStatus: string;
    checkedAt: Date;
    responseSummary: string | null;
    sourceConfig: {
      sourceType: string;
    };
  }>;
};

export async function getDashboardData(): Promise<DashboardData> {
  if (!process.env.DATABASE_URL) {
    return emptyDashboardData();
  }

  try {
    const [
      sourceConfigCount,
      rawSignals,
      clusters,
      ideas,
      readyIdeas,
      ideasNeedingReview,
      socialDraftSummaries,
      recentJobRuns,
      topClusters,
      latestIdeas,
      digestRecipients,
      sourceConfigs,
      researchStreams,
      topics,
      topicDraftPerformance,
      copyFrameworks,
      styleProfiles,
      visualGenerationProfiles,
      latestContentDrafts,
      recentSourceRuns,
      recentHealthChecks
    ] = await Promise.all([
      db.sourceConfig.count(),
      db.rawSignal.count(),
      db.trendCluster.count(),
      db.idea.count(),
      db.idea.count({
        where: {
          status: "promising",
          qualityScore: { gte: 7 }
        }
      }),
      db.idea.count({
        where: {
          OR: [{ status: "new" }, { status: "revisit" }, { qualityScore: { lt: 7 } }]
        }
      }),
      db.contentDraft.findMany({
        where: {
          researchStreamId: "stream-social-media-research"
        },
        select: {
          assetStatus: true,
          supportingStatsJson: true,
          assetCandidatesJson: true
        }
      }),
      db.jobRun.findMany({
        orderBy: { startedAt: "desc" },
        take: 6
      }),
      db.trendCluster.findMany({
        orderBy: [{ scoreTotal: "desc" }, { updatedAt: "desc" }],
        take: 5
      }),
      db.idea.findMany({
        orderBy: [{ qualityScore: "desc" }, { updatedAt: "desc" }],
        take: 5,
        select: {
          id: true,
          title: true,
          category: true,
          businessType: true,
          qualityScore: true,
          qualityReason: true,
          status: true,
          updatedAt: true,
          evidenceSummary: true,
          sourceAttributionJson: true
        }
      }),
      db.digestRecipient.findMany({
        orderBy: [{ researchStreamId: "asc" }, { isOwnerDefault: "desc" }, { email: "asc" }],
        include: {
          researchStream: {
            select: {
              id: true,
              slug: true,
              name: true
            }
          }
        }
      }),
      db.sourceConfig.findMany({
        orderBy: { sourceType: "asc" },
        select: {
          id: true,
          sourceType: true,
          enabled: true
        }
      }),
      db.researchStream.findMany({
        orderBy: [{ createdAt: "asc" }],
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          enabled: true,
          deliveryType: true,
          scheduleCron: true,
          defaultAssetMode: true,
          enabledChannelsJson: true
        }
      }),
      db.topic.findMany({
        orderBy: [{ researchStreamId: "asc" }, { name: "asc" }],
        select: {
          id: true,
          researchStreamId: true,
          slug: true,
          name: true,
          description: true,
          enabled: true,
          topicFitThreshold: true,
          defaultAssetMode: true,
          defaultCopyFrameworkId: true,
          defaultStyleProfileId: true,
          enabledChannelsJson: true,
          keywordsJson: true,
          exclusionsJson: true,
          sourcePreferencesJson: true,
          researchStream: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      }),
      db.contentDraft.findMany({
        where: {
          researchStreamId: "stream-social-media-research"
        },
        select: {
          topicId: true,
          qualityScore: true,
          supportingStatsJson: true,
          assetCandidatesJson: true
        }
      }),
      db.copyFramework.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          enabled: true,
          structureJson: true
        }
      }),
      db.styleProfile.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          inspirationSummary: true,
          enabled: true,
          styleTraitsJson: true,
          guardrailsJson: true
        }
      }),
      (db as any).visualGenerationProfile.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          visualMode: true,
          designToolPreference: true,
          costTier: true,
          maxAssetsPerRun: true,
          reviewRequired: true,
          aspectRatio: true,
          brandTheme: true,
          enabled: true
        }
      }),
      db.contentDraft.findMany({
        where: {
          researchStreamId: "stream-social-media-research"
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 6,
        select: {
          id: true,
          title: true,
          targetChannel: true,
          status: true,
          qualityScore: true,
          hook: true,
          thesis: true,
          updatedAt: true,
          topic: {
            select: {
              name: true
            }
          },
          copyFramework: {
            select: {
              name: true
            }
          },
          styleProfile: {
            select: {
              name: true
            }
          }
        }
      }),
      db.sourceRun.findMany({
        orderBy: { startedAt: "desc" },
        take: 6,
        include: {
          sourceConfig: {
            select: {
              sourceType: true
            }
          }
        }
      }),
      db.sourceHealthCheck.findMany({
        orderBy: { checkedAt: "desc" },
        take: 6,
        include: {
          sourceConfig: {
            select: {
              sourceType: true
            }
          }
        }
      })
    ]);

    const readySocialDrafts = socialDraftSummaries.filter((draft) => {
      const supportingStatuses = readReviewStatuses(draft.supportingStatsJson);
      const mediaStatuses = readReviewStatuses(draft.assetCandidatesJson);
      return supportingStatuses.includes("approved") || mediaStatuses.includes("approved");
    }).length;

    const socialDraftsNeedingReview = socialDraftSummaries.filter((draft) => {
      const supportingStatuses = readReviewStatuses(draft.supportingStatsJson);
      const mediaStatuses = readReviewStatuses(draft.assetCandidatesJson);
      return draft.assetStatus === "review-required" || supportingStatuses.includes("pending") || mediaStatuses.includes("pending");
    }).length;

    return {
      stats: {
        sourceConfigs: sourceConfigCount,
        rawSignals,
        clusters,
        ideas,
        readyIdeas,
        ideasNeedingReview,
        readySocialDrafts,
        socialDraftsNeedingReview
      },
      recentJobRuns,
      topClusters,
      latestIdeas,
      digestRecipients,
      sourceConfigs,
      researchStreams,
      topics: topics.map((topic) => {
        const draftRows = topicDraftPerformance.filter((draft) => draft.topicId === topic.id);
        const readyRows = draftRows.filter((draft) => {
          const supportingStatuses = readReviewStatuses(draft.supportingStatsJson);
          const mediaStatuses = readReviewStatuses(draft.assetCandidatesJson);
          return supportingStatuses.includes("approved") || mediaStatuses.includes("approved");
        });
        const qualityValues = draftRows
          .map((draft) => draft.qualityScore)
          .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
        const exportReadinessValues = draftRows.map((draft) => scoreDashboardExportReadiness(draft));

        return {
          ...topic,
          performance: {
            totalDrafts: draftRows.length,
            readyDrafts: readyRows.length,
            avgQualityScore:
              qualityValues.length > 0 ? Number((qualityValues.reduce((sum, value) => sum + value, 0) / qualityValues.length).toFixed(1)) : null,
            avgExportReadiness:
              exportReadinessValues.length > 0
                ? Number((exportReadinessValues.reduce((sum, value) => sum + value, 0) / exportReadinessValues.length).toFixed(1))
                : null
          }
        };
      }),
      copyFrameworks,
      styleProfiles,
      visualGenerationProfiles,
      latestContentDrafts,
      recentSourceRuns,
      recentHealthChecks
    };
  } catch (error) {
    console.error("Failed to load dashboard data", error);
    return {
      ...emptyDashboardData()
    };
  }
}

export function emptyDashboardData(): DashboardData {
  return {
      stats: {
        sourceConfigs: 0,
        rawSignals: 0,
        clusters: 0,
        ideas: 0,
        readyIdeas: 0,
        ideasNeedingReview: 0,
        readySocialDrafts: 0,
        socialDraftsNeedingReview: 0
      },
    recentJobRuns: [],
    topClusters: [],
    latestIdeas: [],
    digestRecipients: [],
    sourceConfigs: [],
    researchStreams: [],
    topics: [],
    copyFrameworks: [],
    styleProfiles: [],
    visualGenerationProfiles: [],
    latestContentDrafts: [],
    recentSourceRuns: [],
    recentHealthChecks: []
  };
}

function readReviewStatuses(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .map((entry) => entry.reviewStatus)
    .filter((entry): entry is string => typeof entry === "string");
}

export function formatSourceAttribution(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return "Sources: attribution pending";
  }

  const parts = value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const sourceType = "sourceType" in entry && typeof entry.sourceType === "string" ? entry.sourceType : null;
      const signalCount = "signalCount" in entry && typeof entry.signalCount === "number" ? entry.signalCount : null;

      if (!sourceType || signalCount === null) {
        return null;
      }

      return `${sourceType} (${signalCount})`;
    })
    .filter((part): part is string => Boolean(part));

  return parts.length > 0 ? `Sources: ${parts.join(", ")}` : "Sources: attribution pending";
}

function scoreDashboardExportReadiness(draft: {
  qualityScore: number | null;
  supportingStatsJson: unknown;
  assetCandidatesJson: unknown;
}) {
  const qualityScore = typeof draft.qualityScore === "number" ? draft.qualityScore : 0;
  const supportingStatuses = readReviewStatuses(draft.supportingStatsJson);
  const mediaStatuses = readReviewStatuses(draft.assetCandidatesJson);
  const approvedStats = supportingStatuses.filter((status) => status === "approved").length;
  const approvedMedia = mediaStatuses.filter((status) => status === "approved" || status === "use-with-caution").length;

  return Number((qualityScore + Math.min(approvedStats, 3) * 1.2 + Math.min(approvedMedia, 3) * 0.8).toFixed(1));
}

export function formatChannelInput(value: unknown) {
  return formatListInput(value);
}

export function formatListInput(value: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value.filter((entry): entry is string => typeof entry === "string").join(", ");
}

export function readSearchParam(searchParams: Record<string, string | string[] | undefined>, key: string) {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export function matchesStreamSearch(stream: DashboardData["researchStreams"][number], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [stream.name, stream.slug, stream.description ?? "", formatChannelInput(stream.enabledChannelsJson)]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

export function matchesTopicSearch(topic: DashboardData["topics"][number], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [
    topic.name,
    topic.slug,
    topic.description ?? "",
    topic.researchStream.name,
    formatListInput(topic.enabledChannelsJson),
    formatListInput(topic.keywordsJson),
    formatListInput(topic.exclusionsJson),
    formatListInput(topic.sourcePreferencesJson)
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

export function formatDate(value: Date) {
  const zone = isEdmontonDst(value) ? "MDT" : "MST";
  const offsetHours = zone === "MDT" ? -6 : -7;
  const local = new Date(value.getTime() + offsetHours * 60 * 60 * 1000);
  const month = EDMONTON_MONTHS[local.getUTCMonth()] ?? "Jan";
  const day = local.getUTCDate();
  const year = local.getUTCFullYear();
  const minutes = String(local.getUTCMinutes()).padStart(2, "0");
  const rawHours = local.getUTCHours();
  const hour12 = rawHours % 12 === 0 ? 12 : rawHours % 12;
  const meridiem = rawHours >= 12 ? "PM" : "AM";

  return `${month} ${day}, ${year}, ${hour12}:${minutes} ${meridiem} ${zone}`;
}

const EDMONTON_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function isEdmontonDst(value: Date) {
  const year = value.getUTCFullYear();
  const dstStartUtc = edmontonTransitionUtc(year, 2, 2, 2, 7);
  const dstEndUtc = edmontonTransitionUtc(year, 10, 1, 2, 6);
  return value.getTime() >= dstStartUtc.getTime() && value.getTime() < dstEndUtc.getTime();
}

function edmontonTransitionUtc(year: number, monthIndex: number, occurrence: number, localHour: number, utcOffsetHours: number) {
  const day = nthWeekdayOfMonth(year, monthIndex, 0, occurrence);
  return new Date(Date.UTC(year, monthIndex, day, localHour - utcOffsetHours, 0, 0));
}

function nthWeekdayOfMonth(year: number, monthIndex: number, weekday: number, occurrence: number) {
  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
  const firstWeekday = firstOfMonth.getUTCDay();
  const delta = (weekday - firstWeekday + 7) % 7;
  return 1 + delta + (occurrence - 1) * 7;
}

export function normalizeStatus(value: string) {
  if (value === "ok") {
    return "succeeded";
  }

  if (value === "error") {
    return "failed";
  }

  return value;
}
