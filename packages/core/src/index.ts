import { z } from "zod";
import crypto from "node:crypto";

export const jobNames = [
  "daily-ingest",
  "daily-enrich-score",
  "daily-digest-email",
  "weekly-maintenance"
] as const;

export const jobStatuses = ["pending", "running", "succeeded", "failed", "skipped"] as const;

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
  sampleSize: z.number().int().positive().max(25).optional(),
  keywords: z.array(z.string()).optional(),
  subredditList: z.array(z.string()).optional(),
  exclusions: z.array(z.string()).optional()
});

export type JobName = (typeof jobNames)[number];
export type JobStatus = (typeof jobStatuses)[number];
export type DigestSection = z.infer<typeof digestSectionSchema>;
export type SourceSignal = z.infer<typeof sourceSignalSchema>;
export type SourceAdapterConfig = z.infer<typeof sourceAdapterConfigSchema>;
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export function buildSignalDedupeHash(sourceType: string, sourceRecordId: string) {
  return crypto.createHash("sha256").update(`${sourceType}:${sourceRecordId}`).digest("hex");
}
