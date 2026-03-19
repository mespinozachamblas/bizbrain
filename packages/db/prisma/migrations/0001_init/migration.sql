-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_configs" (
    "id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "niche_modes" JSONB,
    "config_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_config_versions" (
    "id" TEXT NOT NULL,
    "source_config_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "config_json" JSONB NOT NULL,
    "changed_by_user_id" TEXT,
    "change_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_config_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_signals" (
    "id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_record_id" TEXT NOT NULL,
    "source_url" TEXT,
    "title" TEXT,
    "body" TEXT,
    "author_name" TEXT,
    "occurred_at" TIMESTAMP(3),
    "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dedupe_hash" TEXT NOT NULL,

    CONSTRAINT "raw_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_health_checks" (
    "id" TEXT NOT NULL,
    "source_config_id" TEXT NOT NULL,
    "check_type" TEXT NOT NULL,
    "check_status" TEXT NOT NULL,
    "response_summary" TEXT,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_health_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_runs" (
    "id" TEXT NOT NULL,
    "source_config_id" TEXT NOT NULL,
    "job_run_id" TEXT NOT NULL,
    "logical_date" TIMESTAMP(3) NOT NULL,
    "run_status" TEXT NOT NULL,
    "records_read" INTEGER NOT NULL DEFAULT 0,
    "records_written" INTEGER NOT NULL DEFAULT 0,
    "warnings_json" JSONB,
    "errors_json" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "source_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enriched_signals" (
    "id" TEXT NOT NULL,
    "raw_signal_id" TEXT NOT NULL,
    "normalized_text" TEXT NOT NULL,
    "keywords_json" JSONB,
    "entities_json" JSONB,
    "pain_points_json" JSONB,
    "intent_phrases_json" JSONB,
    "category_tags_json" JSONB,
    "confidence_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enriched_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trend_clusters" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "primary_category" TEXT,
    "tags_json" JSONB,
    "first_seen_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),
    "signal_count" INTEGER NOT NULL DEFAULT 0,
    "score_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score_frequency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score_momentum" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score_intent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score_whitespace" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score_fit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score_complexity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score_feasibility" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trend_clusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cluster_memberships" (
    "id" TEXT NOT NULL,
    "cluster_id" TEXT NOT NULL,
    "raw_signal_id" TEXT NOT NULL,
    "enriched_signal_id" TEXT,
    "membership_reason" TEXT,
    "similarity_score" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cluster_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ideas" (
    "id" TEXT NOT NULL,
    "cluster_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "target_customer" TEXT,
    "problem_summary" TEXT,
    "solution_concept" TEXT,
    "monetization_angle" TEXT,
    "gtm_json" JSONB,
    "validation_questions_json" JSONB,
    "evidence_summary" TEXT,
    "risk_notes" TEXT,
    "score_snapshot" JSONB,
    "status" TEXT NOT NULL,
    "notes_markdown" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ideas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digests" (
    "id" TEXT NOT NULL,
    "digest_date" TIMESTAMP(3) NOT NULL,
    "digest_key" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "markdown_body" TEXT,
    "html_body" TEXT,
    "selection_json" JSONB,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "digests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digest_recipients" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_owner_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "digest_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_deliveries" (
    "id" TEXT NOT NULL,
    "digest_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "delivery_key" TEXT NOT NULL,
    "provider_message_id" TEXT,
    "send_status" TEXT NOT NULL,
    "error_text" TEXT,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retry_records" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "retry_key" TEXT NOT NULL,
    "retry_reason" TEXT,
    "forced" BOOLEAN NOT NULL DEFAULT false,
    "requested_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retry_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" TEXT NOT NULL,
    "job_name" TEXT NOT NULL,
    "logical_date" TIMESTAMP(3) NOT NULL,
    "run_status" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "records_read" INTEGER NOT NULL DEFAULT 0,
    "records_written" INTEGER NOT NULL DEFAULT 0,
    "warnings_json" JSONB,
    "errors_json" JSONB,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "source_configs_source_type_idx" ON "source_configs"("source_type");

-- CreateIndex
CREATE UNIQUE INDEX "source_config_versions_source_config_id_version_number_key" ON "source_config_versions"("source_config_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "raw_signals_source_type_source_record_id_key" ON "raw_signals"("source_type", "source_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "raw_signals_dedupe_hash_key" ON "raw_signals"("dedupe_hash");

-- CreateIndex
CREATE INDEX "source_health_checks_source_config_id_checked_at_idx" ON "source_health_checks"("source_config_id", "checked_at" DESC);

-- CreateIndex
CREATE INDEX "source_runs_source_config_id_logical_date_idx" ON "source_runs"("source_config_id", "logical_date");

-- CreateIndex
CREATE INDEX "source_runs_job_run_id_idx" ON "source_runs"("job_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "enriched_signals_raw_signal_id_key" ON "enriched_signals"("raw_signal_id");

-- CreateIndex
CREATE UNIQUE INDEX "trend_clusters_slug_key" ON "trend_clusters"("slug");

-- CreateIndex
CREATE INDEX "trend_clusters_score_total_idx" ON "trend_clusters"("score_total" DESC);

-- CreateIndex
CREATE INDEX "trend_clusters_primary_category_score_total_idx" ON "trend_clusters"("primary_category", "score_total" DESC);

-- CreateIndex
CREATE INDEX "cluster_memberships_enriched_signal_id_idx" ON "cluster_memberships"("enriched_signal_id");

-- CreateIndex
CREATE UNIQUE INDEX "cluster_memberships_cluster_id_raw_signal_id_key" ON "cluster_memberships"("cluster_id", "raw_signal_id");

-- CreateIndex
CREATE INDEX "ideas_status_category_updated_at_idx" ON "ideas"("status", "category", "updated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "digests_digest_key_key" ON "digests"("digest_key");

-- CreateIndex
CREATE INDEX "digests_digest_date_idx" ON "digests"("digest_date");

-- CreateIndex
CREATE UNIQUE INDEX "digest_recipients_email_key" ON "digest_recipients"("email");

-- CreateIndex
CREATE UNIQUE INDEX "email_deliveries_delivery_key_key" ON "email_deliveries"("delivery_key");

-- CreateIndex
CREATE UNIQUE INDEX "email_deliveries_digest_id_recipient_id_key" ON "email_deliveries"("digest_id", "recipient_id");

-- CreateIndex
CREATE UNIQUE INDEX "retry_records_retry_key_key" ON "retry_records"("retry_key");

-- CreateIndex
CREATE INDEX "job_runs_job_name_logical_date_idx" ON "job_runs"("job_name", "logical_date");

-- AddForeignKey
ALTER TABLE "source_config_versions" ADD CONSTRAINT "source_config_versions_source_config_id_fkey" FOREIGN KEY ("source_config_id") REFERENCES "source_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_config_versions" ADD CONSTRAINT "source_config_versions_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_health_checks" ADD CONSTRAINT "source_health_checks_source_config_id_fkey" FOREIGN KEY ("source_config_id") REFERENCES "source_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_runs" ADD CONSTRAINT "source_runs_source_config_id_fkey" FOREIGN KEY ("source_config_id") REFERENCES "source_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_runs" ADD CONSTRAINT "source_runs_job_run_id_fkey" FOREIGN KEY ("job_run_id") REFERENCES "job_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enriched_signals" ADD CONSTRAINT "enriched_signals_raw_signal_id_fkey" FOREIGN KEY ("raw_signal_id") REFERENCES "raw_signals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cluster_memberships" ADD CONSTRAINT "cluster_memberships_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "trend_clusters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cluster_memberships" ADD CONSTRAINT "cluster_memberships_raw_signal_id_fkey" FOREIGN KEY ("raw_signal_id") REFERENCES "raw_signals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cluster_memberships" ADD CONSTRAINT "cluster_memberships_enriched_signal_id_fkey" FOREIGN KEY ("enriched_signal_id") REFERENCES "enriched_signals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "trend_clusters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_digest_id_fkey" FOREIGN KEY ("digest_id") REFERENCES "digests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "digest_recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retry_records" ADD CONSTRAINT "retry_records_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
