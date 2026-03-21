import { z } from "zod";
import crypto from "node:crypto";

export const jobNames = [
  "daily-ingest",
  "daily-enrich-score",
  "daily-digest-email",
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
export type DigestSection = z.infer<typeof digestSectionSchema>;
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
