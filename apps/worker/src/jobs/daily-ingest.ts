import { buildSignalDedupeHash, sourceConfigRecordSchema } from "@bizbrain/core";
import { db } from "@bizbrain/db";
import { getSourceAdapter } from "./source-adapters";
import { logJobBoundary, runJobWithTracking } from "./shared";

export async function runDailyIngest() {
  await runJobWithTracking({
    jobName: "daily-ingest",
    execute: async (context) => {
      const sourceConfigs = await db.sourceConfig.findMany({
        where: { enabled: true },
        orderBy: { sourceType: "asc" }
      });

      await context.markProgress({
        recordsRead: sourceConfigs.length,
        recordsWritten: 0,
        warnings: sourceConfigs.length === 0 ? ["No enabled source configs found for ingest."] : []
      });

      if (sourceConfigs.length === 0) {
        logJobBoundary("daily-ingest", "No enabled source configs found. Job completed without ingest work.");
        return;
      }

      let rawSignalsWritten = 0;
      const warnings: string[] = [];

      for (const sourceConfig of sourceConfigs) {
        const parsedSourceConfig = sourceConfigRecordSchema.parse({
          sourceType: sourceConfig.sourceType,
          enabled: sourceConfig.enabled,
          nicheModes: sourceConfig.nicheModes,
          configJson: sourceConfig.configJson
        });
        const adapter = getSourceAdapter(parsedSourceConfig.sourceType);
        const startedAt = new Date();
        const resolvedMode = adapter.getMode(parsedSourceConfig.configJson);

        try {
          const signals = await adapter.fetchSignals({
            sourceType: parsedSourceConfig.sourceType,
            configJson: parsedSourceConfig.configJson as never
          });

          for (const signal of signals) {
            await db.rawSignal.upsert({
              where: {
                sourceType_sourceRecordId: {
                  sourceType: parsedSourceConfig.sourceType,
                  sourceRecordId: signal.sourceRecordId
                }
              },
              update: {
                sourceUrl: signal.sourceUrl,
                title: signal.title,
                body: signal.body,
                authorName: signal.authorName,
                occurredAt: signal.occurredAt
              },
              create: {
                sourceType: sourceConfig.sourceType,
                sourceRecordId: signal.sourceRecordId,
                sourceUrl: signal.sourceUrl,
                title: signal.title,
                body: signal.body,
                authorName: signal.authorName,
                occurredAt: signal.occurredAt,
                dedupeHash: buildSignalDedupeHash(parsedSourceConfig.sourceType, signal.sourceRecordId)
              }
            });
          }

          await context.createSourceRun({
            sourceConfigId: sourceConfig.id,
            status: "succeeded",
            recordsRead: signals.length,
            recordsWritten: signals.length,
            warnings: {
              sourceType: parsedSourceConfig.sourceType,
              mode: resolvedMode,
              note:
                resolvedMode === "live"
                  ? "Pulled live source data through the configured adapter."
                  : "Using deterministic sample signals for this source."
            },
            startedAt,
            finishedAt: new Date()
          });

          rawSignalsWritten += signals.length;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);

          warnings.push(`${parsedSourceConfig.sourceType}: ${message}`);

          await context.createSourceRun({
            sourceConfigId: sourceConfig.id,
            status: "failed",
            recordsRead: 0,
            recordsWritten: 0,
            warnings: {
              sourceType: parsedSourceConfig.sourceType,
              mode: resolvedMode,
              note: "Source ingest failed. Other sources continued."
            },
            errors: {
              sourceType: parsedSourceConfig.sourceType,
              mode: resolvedMode,
              message
            },
            startedAt,
            finishedAt: new Date()
          });
        }
      }

      await context.markProgress({
        recordsRead: sourceConfigs.length,
        recordsWritten: rawSignalsWritten,
        warnings
      });

      logJobBoundary(
        "daily-ingest",
        `Ingested ${rawSignalsWritten} raw signal(s) across ${sourceConfigs.length} source configuration(s).`
      );
    }
  });
}
