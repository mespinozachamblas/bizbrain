import { db } from "@bizbrain/db";
import { getSourceAdapter } from "../../worker/src/jobs/source-adapters";

export async function runSourceHealthCheck(sourceConfigId: string) {
  const sourceConfig = await db.sourceConfig.findUnique({
    where: { id: sourceConfigId }
  });

  if (!sourceConfig) {
    throw new Error("Source config not found.");
  }

  const adapter = getSourceAdapter(sourceConfig.sourceType);
  const result = await adapter.runHealthCheck({
    sourceType: sourceConfig.sourceType,
    configJson: sourceConfig.configJson as never
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
