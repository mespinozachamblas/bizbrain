import { z } from "zod";
import crypto from "node:crypto";

export const jobNames = [
  "daily-ingest",
  "daily-enrich-score",
  "daily-digest-email",
  "daily-social-media-digest-email",
  "weekly-maintenance"
] as const;

export const jobStatuses = ["pending", "running", "succeeded", "failed", "skipped"] as const;
export const sourceTypes = ["reddit", "google-trends", "hacker-news", "product-hunt"] as const;
export const sourceModes = ["sample", "live"] as const;
export const researchStreamSlugs = ["opportunity-research", "social-media-research"] as const;
export const researchStreamIds = {
  opportunity: "stream-opportunity-research",
  socialMedia: "stream-social-media-research"
} as const;
export const researchStreamChannels = ["linkedin", "x"] as const;
export const mediaCandidateSourceTypes = [
  "first-party",
  "licensed-stock",
  "open-license",
  "ai-generated",
  "discovery-reference"
] as const;
export const mediaCandidateUsageStatuses = ["publishable", "review-required", "reference-only"] as const;
export const mediaCandidateReviewStatuses = ["pending", "approved", "use-with-caution", "rejected", "reference-only"] as const;
export const supportingStatReviewStatuses = ["pending", "approved", "use-with-caution", "rejected"] as const;

export const supportingStatSchema = z.object({
  claim: z.string(),
  plainLanguageAngle: z.string(),
  sourceName: z.string(),
  sourceUrl: z.string().url().nullable().optional(),
  sourceDate: z.string().nullable().optional(),
  freshnessNote: z.string(),
  confidenceNote: z.string(),
  recommendedUsage: z.string(),
  reviewStatus: z.enum(supportingStatReviewStatuses)
});

export const digestSectionSchema = z.object({
  sectionTitle: z.string(),
  items: z.array(z.string()),
  alerts: z.array(z.string()),
  plainLanguageSummary: z.string()
});

export const sourceSignalSchema = z.object({
  sourceRecordId: z.string(),
  sourceUrl: z.string().url().optional(),
  title: z.string().optional(),
  body: z.string().optional(),
  authorName: z.string().optional(),
  occurredAt: z.date().optional()
});

export const sourceAdapterConfigSchema = z.object({
  mode: z.enum(sourceModes).optional(),
  sampleSize: z.number().int().positive().max(25).optional(),
  keywords: z.array(z.string()).optional(),
  subredditList: z.array(z.string()).optional(),
  storyTypes: z.array(z.string()).optional(),
  productTopics: z.array(z.string()).optional(),
  geo: z.string().min(2).max(8).optional(),
  exclusions: z.array(z.string()).optional()
});

export const sourceConfigRecordSchema = z.object({
  sourceType: z.enum(sourceTypes),
  enabled: z.boolean(),
  nicheModes: z.unknown().optional(),
  configJson: sourceAdapterConfigSchema
});

export const llmEnrichmentSchema = z.object({
  normalizedText: z.string(),
  keywords: z.array(z.string()).min(1).max(8),
  entities: z.array(z.string()).max(6),
  painPoints: z.array(z.string()).max(5),
  intentPhrases: z.array(z.string()).max(5),
  categoryTags: z.array(z.string()).min(1).max(6),
  confidence: z.object({
    mode: z.literal("llm"),
    score: z.number().min(0).max(1),
    rationale: z.string()
  }),
  primaryCategory: z.string(),
  clusterSeed: z.string(),
  summary: z.string(),
  idea: z.object({
    title: z.string(),
    businessType: z.string(),
    targetCustomer: z.string(),
    problemSummary: z.string(),
    solutionConcept: z.string(),
    monetizationAngle: z.string(),
    qualityScore: z.number().min(0).max(10),
    qualityReason: z.string(),
    validationQuestions: z.array(z.string()).min(2).max(5),
    riskNotes: z.string(),
    evidenceSummary: z.string()
  })
});

export const socialDraftSchema = z.object({
  title: z.string(),
  targetAudience: z.string(),
  hook: z.string(),
  thesis: z.string(),
  supportingPoints: z.array(z.string()).min(2).max(4),
  counterpoint: z.string(),
  cta: z.string(),
  draftMarkdown: z.string(),
  visualBrief: z.object({
    concept: z.string(),
    format: z.string(),
    headlineText: z.string(),
    captionText: z.string(),
    ctaText: z.string()
  }),
  infographicBrief: z.object({
    summary: z.string(),
    format: z.string(),
    panels: z.array(z.string()).min(3).max(6)
  }),
  infographicCreativeBrief: z.object({
    creativeDirection: z.string(),
    objective: z.string(),
    visualStyle: z.string(),
    layoutStrategy: z.string(),
    compositionPrompt: z.string(),
    textHierarchy: z.array(z.string()).min(3).max(6),
    chartOrDiagramType: z.string(),
    imageSourceStrategy: z.string(),
    aiImagePrompt: z.string(),
    panelPrompts: z.array(z.string()).min(1).max(6),
    avoidNotes: z.array(z.string()).min(2).max(6)
  }),
  mediaCandidates: z.array(
    z.object({
      label: z.string(),
      sourceType: z.enum(mediaCandidateSourceTypes),
      originUrl: z.string().url().nullable().optional(),
      originDomain: z.string().nullable().optional(),
      candidateUrl: z.string().url().nullable().optional(),
      licenseLabel: z.string().nullable().optional(),
      licenseUrl: z.string().url().nullable().optional(),
      attributionText: z.string().nullable().optional(),
      usageStatus: z.enum(mediaCandidateUsageStatuses),
      reviewStatus: z.enum(mediaCandidateReviewStatuses),
      requiresHumanReview: z.boolean(),
      referenceOnly: z.boolean(),
      rightsNotes: z.array(z.string()).max(5)
    })
  ).max(6),
  mediaPolicy: z.object({
    preferredSourceClasses: z.array(z.string()).min(1).max(6),
    prohibitedDirectUseSources: z.array(z.string()).max(6),
    humanReviewRequired: z.boolean(),
    publishingNotes: z.array(z.string()).min(1).max(6)
  }),
  supportingStats: z.array(supportingStatSchema).max(5),
  qualityScore: z.number().min(0).max(10)
});

export const sourceAttributionEntrySchema = z.object({
  sourceType: z.string(),
  signalCount: z.number().int().nonnegative(),
  sampleTitles: z.array(z.string()).max(3),
  sampleUrls: z.array(z.string().url()).max(3)
});

export type JobName = (typeof jobNames)[number];
export type JobStatus = (typeof jobStatuses)[number];
export type SourceType = (typeof sourceTypes)[number];
export type SourceMode = (typeof sourceModes)[number];
export type ResearchStreamSlug = (typeof researchStreamSlugs)[number];
export type MediaCandidateSourceType = (typeof mediaCandidateSourceTypes)[number];
export type MediaCandidateUsageStatus = (typeof mediaCandidateUsageStatuses)[number];
export type MediaCandidateReviewStatus = (typeof mediaCandidateReviewStatuses)[number];
export type SupportingStatReviewStatus = (typeof supportingStatReviewStatuses)[number];
export type DigestSection = z.infer<typeof digestSectionSchema>;
export type SupportingStat = z.infer<typeof supportingStatSchema>;
export type SourceSignal = z.infer<typeof sourceSignalSchema>;
export type SourceAdapterConfig = z.infer<typeof sourceAdapterConfigSchema>;
export type SourceConfigRecord = z.infer<typeof sourceConfigRecordSchema>;
export type LlmEnrichment = z.infer<typeof llmEnrichmentSchema>;
export type SocialDraft = z.infer<typeof socialDraftSchema>;
export type SourceAttributionEntry = z.infer<typeof sourceAttributionEntrySchema>;
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export function buildSignalDedupeHash(sourceType: string, sourceRecordId: string) {
  return crypto.createHash("sha256").update(`${sourceType}:${sourceRecordId}`).digest("hex");
}

export function resolveSourceMode(config: SourceAdapterConfig): SourceMode {
  return config.mode ?? (process.env.SOURCE_DEFAULT_MODE === "live" ? "live" : "sample");
}
