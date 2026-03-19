export const operationalTables = [
  "users",
  "source_configs",
  "source_config_versions",
  "raw_signals",
  "source_health_checks",
  "source_runs",
  "enriched_signals",
  "trend_clusters",
  "cluster_memberships",
  "ideas",
  "digests",
  "digest_recipients",
  "email_deliveries",
  "retry_records",
  "job_runs"
] as const;

export type OperationalTable = (typeof operationalTables)[number];
