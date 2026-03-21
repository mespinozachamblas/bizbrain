ALTER TABLE "ideas"
ADD COLUMN "quality_score" DOUBLE PRECISION,
ADD COLUMN "quality_reason" TEXT,
ADD COLUMN "source_attribution_json" JSONB;

CREATE INDEX "ideas_quality_score_updated_at_idx"
ON "ideas" ("quality_score" DESC, "updated_at" DESC);
