import { PrismaClient } from "@prisma/client";

export const operationalTables = [
  "users",
  "source_configs",
  "source_config_versions",
  "research_streams",
  "topics",
  "copy_frameworks",
  "style_profiles",
  "raw_signals",
  "source_health_checks",
  "source_runs",
  "enriched_signals",
  "trend_clusters",
  "cluster_memberships",
  "ideas",
  "content_drafts",
  "digests",
  "digest_recipients",
  "email_deliveries",
  "retry_records",
  "job_runs"
] as const;

export type OperationalTable = (typeof operationalTables)[number];

declare global {
  var __bizbrainPrisma: PrismaClient | undefined;
}

export const db =
  globalThis.__bizbrainPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__bizbrainPrisma = db;
}
