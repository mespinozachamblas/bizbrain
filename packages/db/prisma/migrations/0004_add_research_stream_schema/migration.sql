CREATE TABLE "copy_frameworks" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "structure_json" JSONB,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "copy_frameworks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "copy_frameworks_slug_key" ON "copy_frameworks"("slug");

CREATE TABLE "style_profiles" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "inspiration_summary" TEXT,
  "style_traits_json" JSONB,
  "guardrails_json" JSONB,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "style_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "style_profiles_slug_key" ON "style_profiles"("slug");

CREATE TABLE "research_streams" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "enabled_channels_json" JSONB,
  "delivery_type" TEXT NOT NULL DEFAULT 'email',
  "schedule_cron" TEXT,
  "default_copy_framework_id" TEXT,
  "default_style_profile_id" TEXT,
  "default_asset_mode" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "research_streams_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "research_streams_slug_key" ON "research_streams"("slug");

CREATE TABLE "topics" (
  "id" TEXT NOT NULL,
  "research_stream_id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "enabled_channels_json" JSONB,
  "keywords_json" JSONB,
  "exclusions_json" JSONB,
  "source_preferences_json" JSONB,
  "default_copy_framework_id" TEXT,
  "default_style_profile_id" TEXT,
  "default_asset_mode" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "topics_research_stream_id_slug_key" ON "topics"("research_stream_id", "slug");
CREATE INDEX "topics_research_stream_id_enabled_idx" ON "topics"("research_stream_id", "enabled");

INSERT INTO "research_streams" (
  "id",
  "slug",
  "name",
  "description",
  "enabled",
  "enabled_channels_json",
  "delivery_type",
  "schedule_cron",
  "default_asset_mode"
)
VALUES
  (
    'stream-opportunity-research',
    'opportunity-research',
    'Opportunity Research',
    'Business opportunity discovery and validation ideas.',
    true,
    '["email"]'::jsonb,
    'email',
    '35 06 * * *',
    'none'
  ),
  (
    'stream-social-media-research',
    'social-media-research',
    'Social Media Research',
    'Research-backed social media draft ideas for LinkedIn and X.',
    true,
    '["linkedin","x"]'::jsonb,
    'email',
    '50 06 * * *',
    'stock'
  )
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "source_configs"
  ADD COLUMN "research_stream_ids_json" JSONB,
  ADD COLUMN "topic_ids_json" JSONB;

ALTER TABLE "raw_signals"
  ADD COLUMN "topic_matches_json" JSONB;

ALTER TABLE "ideas"
  ADD COLUMN "research_stream_id" TEXT NOT NULL DEFAULT 'stream-opportunity-research',
  ADD COLUMN "primary_topic_id" TEXT;

CREATE INDEX "ideas_research_stream_id_quality_score_updated_at_idx"
ON "ideas" ("research_stream_id", "quality_score" DESC, "updated_at" DESC);

ALTER TABLE "digests"
  ADD COLUMN "research_stream_id" TEXT NOT NULL DEFAULT 'stream-opportunity-research';

ALTER TABLE "digest_recipients"
  ADD COLUMN "research_stream_id" TEXT NOT NULL DEFAULT 'stream-opportunity-research';

ALTER TABLE "digest_recipients"
  DROP CONSTRAINT IF EXISTS "digest_recipients_email_key";

CREATE UNIQUE INDEX "digest_recipients_research_stream_id_email_key"
ON "digest_recipients"("research_stream_id", "email");

CREATE TABLE "content_drafts" (
  "id" TEXT NOT NULL,
  "research_stream_id" TEXT NOT NULL DEFAULT 'stream-social-media-research',
  "topic_id" TEXT,
  "source_idea_id" TEXT,
  "copy_framework_id" TEXT,
  "style_profile_id" TEXT,
  "title" TEXT NOT NULL,
  "target_channel" TEXT NOT NULL,
  "target_audience" TEXT,
  "hook" TEXT,
  "thesis" TEXT,
  "supporting_points_json" JSONB,
  "counterpoint" TEXT,
  "cta" TEXT,
  "draft_markdown" TEXT,
  "draft_html" TEXT,
  "visual_brief_json" JSONB,
  "infographic_brief_json" JSONB,
  "infographic_format" TEXT,
  "infographic_panels_json" JSONB,
  "asset_mode" TEXT,
  "asset_status" TEXT,
  "asset_candidates_json" JSONB,
  "quality_score" DOUBLE PRECISION,
  "source_attribution_json" JSONB,
  "status" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "content_drafts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "content_drafts_research_stream_id_status_updated_at_idx"
ON "content_drafts" ("research_stream_id", "status", "updated_at" DESC);

ALTER TABLE "research_streams"
  ADD CONSTRAINT "research_streams_default_copy_framework_id_fkey"
  FOREIGN KEY ("default_copy_framework_id") REFERENCES "copy_frameworks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "research_streams"
  ADD CONSTRAINT "research_streams_default_style_profile_id_fkey"
  FOREIGN KEY ("default_style_profile_id") REFERENCES "style_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "topics"
  ADD CONSTRAINT "topics_research_stream_id_fkey"
  FOREIGN KEY ("research_stream_id") REFERENCES "research_streams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "topics"
  ADD CONSTRAINT "topics_default_copy_framework_id_fkey"
  FOREIGN KEY ("default_copy_framework_id") REFERENCES "copy_frameworks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "topics"
  ADD CONSTRAINT "topics_default_style_profile_id_fkey"
  FOREIGN KEY ("default_style_profile_id") REFERENCES "style_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ideas"
  ADD CONSTRAINT "ideas_research_stream_id_fkey"
  FOREIGN KEY ("research_stream_id") REFERENCES "research_streams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ideas"
  ADD CONSTRAINT "ideas_primary_topic_id_fkey"
  FOREIGN KEY ("primary_topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "digests"
  ADD CONSTRAINT "digests_research_stream_id_fkey"
  FOREIGN KEY ("research_stream_id") REFERENCES "research_streams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "digest_recipients"
  ADD CONSTRAINT "digest_recipients_research_stream_id_fkey"
  FOREIGN KEY ("research_stream_id") REFERENCES "research_streams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "content_drafts"
  ADD CONSTRAINT "content_drafts_research_stream_id_fkey"
  FOREIGN KEY ("research_stream_id") REFERENCES "research_streams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "content_drafts"
  ADD CONSTRAINT "content_drafts_topic_id_fkey"
  FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "content_drafts"
  ADD CONSTRAINT "content_drafts_source_idea_id_fkey"
  FOREIGN KEY ("source_idea_id") REFERENCES "ideas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "content_drafts"
  ADD CONSTRAINT "content_drafts_copy_framework_id_fkey"
  FOREIGN KEY ("copy_framework_id") REFERENCES "copy_frameworks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "content_drafts"
  ADD CONSTRAINT "content_drafts_style_profile_id_fkey"
  FOREIGN KEY ("style_profile_id") REFERENCES "style_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
