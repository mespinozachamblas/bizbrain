import { sourceConfigRecordSchema } from "@bizbrain/core";
import { db } from "@bizbrain/db";
import { getSourceAdapter } from "../../worker/src/jobs/source-adapters";

export async function runSourceHealthCheck(sourceConfigId: string) {
  const sourceConfig = await db.sourceConfig.findUnique({
    where: { id: sourceConfigId }
  });

  if (!sourceConfig) {
    throw new Error("Source config not found.");
  }

  const parsedSourceConfig = sourceConfigRecordSchema.parse({
    sourceType: sourceConfig.sourceType,
    enabled: sourceConfig.enabled,
    nicheModes: sourceConfig.nicheModes,
    configJson: sourceConfig.configJson
  });

  const adapter = getSourceAdapter(parsedSourceConfig.sourceType);
  const result = await adapter.runHealthCheck({
    sourceType: parsedSourceConfig.sourceType,
    configJson: parsedSourceConfig.configJson
  });

  await db.sourceHealthCheck.create({
    data: {
      sourceConfigId: sourceConfig.id,
      checkType: "manual-dashboard",
      checkStatus: result.status,
      responseSummary: result.summary
    }
  });

  return result;
}
