import { z } from "zod";

export const jobNames = [
  "daily-ingest",
  "daily-enrich-score",
  "daily-digest-email",
  "weekly-maintenance"
] as const;

export const digestSectionSchema = z.object({
  sectionTitle: z.string(),
  items: z.array(z.string()),
  alerts: z.array(z.string()),
  plainLanguageSummary: z.string()
});

export type JobName = (typeof jobNames)[number];
export type DigestSection = z.infer<typeof digestSectionSchema>;
