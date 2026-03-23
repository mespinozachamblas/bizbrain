CREATE TABLE "social_research_briefs" (
  "id" TEXT NOT NULL,
  "research_stream_id" TEXT NOT NULL DEFAULT 'stream-social-media-research',
  "topic_id" TEXT NOT NULL,
  "cluster_id" TEXT,
  "title" TEXT NOT NULL,
  "framing_mode" TEXT NOT NULL DEFAULT 'commentary',
  "theme_summary" TEXT,
  "audience_insight" TEXT,
  "operator_takeaway" TEXT,
  "contrarian_angle" TEXT,
  "evidence_summary" TEXT,
  "supporting_stats_json" JSONB,
  "signal_evidence_stats_json" JSONB,
  "source_attribution_json" JSONB,
  "quality_score" DOUBLE PRECISION,
  "status" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "social_research_briefs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "social_research_briefs_topic_id_cluster_id_key"
ON "social_research_briefs"("topic_id", "cluster_id");

CREATE INDEX "social_research_briefs_research_stream_id_quality_score_updated_idx"
ON "social_research_briefs"("research_stream_id", "quality_score" DESC, "updated_at" DESC);

ALTER TABLE "content_drafts"
ADD COLUMN "source_brief_id" TEXT;

ALTER TABLE "social_research_briefs"
ADD CONSTRAINT "social_research_briefs_research_stream_id_fkey"
FOREIGN KEY ("research_stream_id") REFERENCES "research_streams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "social_research_briefs"
ADD CONSTRAINT "social_research_briefs_topic_id_fkey"
FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "social_research_briefs"
ADD CONSTRAINT "social_research_briefs_cluster_id_fkey"
FOREIGN KEY ("cluster_id") REFERENCES "trend_clusters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "content_drafts"
ADD CONSTRAINT "content_drafts_source_brief_id_fkey"
FOREIGN KEY ("source_brief_id") REFERENCES "social_research_briefs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
