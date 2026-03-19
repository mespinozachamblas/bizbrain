import {
  sourceAdapterConfigSchema,
  sourceSignalSchema,
  type JsonValue,
  type SourceAdapterConfig,
  type SourceSignal
} from "@bizbrain/core";

type SourceAdapterContext = {
  sourceType: string;
  configJson: JsonValue;
};

export type SourceAdapter = {
  fetchSignals: (context: SourceAdapterContext) => Promise<SourceSignal[]>;
  runHealthCheck: (context: SourceAdapterContext) => Promise<{
    status: "ok" | "error";
    summary: string;
  }>;
};

const sampleSignalsBySource: Record<string, SourceSignal[]> = {
  reddit: [
    {
      sourceRecordId: "reddit-landlord-maintenance-001",
      sourceUrl: "https://example.com/reddit/landlord-maintenance-001",
      title: "Landlords keep missing repeat maintenance follow-ups",
      body: "Operators want a lightweight way to track tenant issues, vendor updates, and reserve impacts in one place.",
      authorName: "sample-user-1",
      occurredAt: new Date("2026-03-18T15:00:00.000Z")
    },
    {
      sourceRecordId: "reddit-cashflow-reserves-002",
      sourceUrl: "https://example.com/reddit/cashflow-reserves-002",
      title: "Small landlords want clearer reserve planning",
      body: "People are asking for a simpler reserve planner tied to rent roll changes and maintenance volatility.",
      authorName: "sample-user-2",
      occurredAt: new Date("2026-03-18T18:30:00.000Z")
    }
  ],
  default: [
    {
      sourceRecordId: "sample-generic-opportunity-001",
      sourceUrl: "https://example.com/signals/sample-generic-opportunity-001",
      title: "Founders want better trend capture from fragmented public signals",
      body: "A repeatable pipeline could normalize posts, reviews, and search signals into one searchable opportunity database.",
      authorName: "system-sample",
      occurredAt: new Date("2026-03-18T12:00:00.000Z")
    }
  ]
};

export function getSourceAdapter(sourceType: string): SourceAdapter {
  return {
    fetchSignals: async (context) => {
      const parsedConfig = parseSourceConfig(context.configJson);
      const sampleSignals = sampleSignalsBySource[sourceType] ?? sampleSignalsBySource.default;
      const limitedSignals = sampleSignals.slice(0, parsedConfig.sampleSize ?? sampleSignals.length);

      return limitedSignals.map((signal) => sourceSignalSchema.parse(signal));
    },
    runHealthCheck: async (context) => {
      const parsedConfig = parseSourceConfig(context.configJson);
      const sampleSignals = sampleSignalsBySource[sourceType] ?? sampleSignalsBySource.default;

      return {
        status: "ok",
        summary: `Sample adapter ready. ${sampleSignals.length} sample signal(s) available. sampleSize=${parsedConfig.sampleSize ?? sampleSignals.length}.`
      };
    }
  };
}

function parseSourceConfig(configJson: JsonValue): SourceAdapterConfig {
  return sourceAdapterConfigSchema.parse(isJsonObject(configJson) ? configJson : {});
}

function isJsonObject(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
