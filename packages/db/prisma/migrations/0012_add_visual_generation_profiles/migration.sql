ALTER TABLE "research_streams"
ADD COLUMN "default_visual_generation_profile_id" TEXT;

ALTER TABLE "topics"
ADD COLUMN "default_visual_generation_profile_id" TEXT;

ALTER TABLE "content_drafts"
ADD COLUMN "visual_generation_profile_id" TEXT;

CREATE TABLE "visual_generation_profiles" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "visual_mode" TEXT NOT NULL,
  "design_tool_preference" TEXT NOT NULL DEFAULT 'none',
  "cost_tier" TEXT NOT NULL DEFAULT 'low',
  "max_assets_per_run" INTEGER NOT NULL DEFAULT 1,
  "review_required" BOOLEAN NOT NULL DEFAULT true,
  "aspect_ratio" TEXT,
  "brand_theme" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "visual_generation_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "visual_generation_profiles_slug_key" ON "visual_generation_profiles"("slug");

CREATE TABLE "generated_assets" (
  "id" TEXT NOT NULL,
  "research_stream_id" TEXT NOT NULL,
  "topic_id" TEXT,
  "content_draft_id" TEXT,
  "style_profile_id" TEXT,
  "visual_generation_profile_id" TEXT,
  "asset_type" TEXT NOT NULL,
  "visual_mode" TEXT NOT NULL,
  "tool_used" TEXT NOT NULL,
  "prompt_or_spec" TEXT,
  "output_url" TEXT,
  "render_status" TEXT NOT NULL,
  "approval_status" TEXT NOT NULL,
  "estimated_cost" DOUBLE PRECISION,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "generated_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "generated_assets_research_stream_id_created_at_idx" ON "generated_assets"("research_stream_id", "created_at" DESC);
CREATE INDEX "generated_assets_content_draft_id_idx" ON "generated_assets"("content_draft_id");

ALTER TABLE "research_streams"
ADD CONSTRAINT "research_streams_default_visual_generation_profile_id_fkey"
FOREIGN KEY ("default_visual_generation_profile_id") REFERENCES "visual_generation_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "topics"
ADD CONSTRAINT "topics_default_visual_generation_profile_id_fkey"
FOREIGN KEY ("default_visual_generation_profile_id") REFERENCES "visual_generation_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "content_drafts"
ADD CONSTRAINT "content_drafts_visual_generation_profile_id_fkey"
FOREIGN KEY ("visual_generation_profile_id") REFERENCES "visual_generation_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "generated_assets"
ADD CONSTRAINT "generated_assets_research_stream_id_fkey"
FOREIGN KEY ("research_stream_id") REFERENCES "research_streams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "generated_assets"
ADD CONSTRAINT "generated_assets_topic_id_fkey"
FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "generated_assets"
ADD CONSTRAINT "generated_assets_content_draft_id_fkey"
FOREIGN KEY ("content_draft_id") REFERENCES "content_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "generated_assets"
ADD CONSTRAINT "generated_assets_style_profile_id_fkey"
FOREIGN KEY ("style_profile_id") REFERENCES "style_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "generated_assets"
ADD CONSTRAINT "generated_assets_visual_generation_profile_id_fkey"
FOREIGN KEY ("visual_generation_profile_id") REFERENCES "visual_generation_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
