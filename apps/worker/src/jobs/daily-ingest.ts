import { buildSignalDedupeHash } from "@bizbrain/core";
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

      for (const sourceConfig of sourceConfigs) {
        const adapter = getSourceAdapter(sourceConfig.sourceType);
        const startedAt = new Date();
        const signals = await adapter.fetchSignals({
          sourceType: sourceConfig.sourceType,
          configJson: sourceConfig.configJson as never
        });

        for (const signal of signals) {
          await db.rawSignal.upsert({
            where: {
              sourceType_sourceRecordId: {
                sourceType: sourceConfig.sourceType,
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
              dedupeHash: buildSignalDedupeHash(sourceConfig.sourceType, signal.sourceRecordId)
            }
          });
        }

        await context.createSourceRun({
          sourceConfigId: sourceConfig.id,
          status: "succeeded",
          recordsRead: signals.length,
          recordsWritten: signals.length,
          warnings: {
            sourceType: sourceConfig.sourceType,
            mode: "sample-adapter",
            note: "Using deterministic local sample signals until external adapters are wired."
          },
          startedAt,
          finishedAt: new Date()
        });

        rawSignalsWritten += signals.length;
      }

      await context.markProgress({
        recordsRead: sourceConfigs.length,
        recordsWritten: rawSignalsWritten
      });

      logJobBoundary(
        "daily-ingest",
        `Ingested ${rawSignalsWritten} raw signal(s) across ${sourceConfigs.length} source configuration(s).`
      );
    }
  });
}
