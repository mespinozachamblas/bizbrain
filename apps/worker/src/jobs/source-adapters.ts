import {
  resolveSourceMode,
  sourceAdapterConfigSchema,
  sourceSignalSchema,
  type JsonValue,
  type SourceAdapterConfig,
  type SourceMode,
  type SourceSignal
} from "@bizbrain/core";

type SourceAdapterContext = {
  sourceType: "reddit";
  configJson: JsonValue;
};

export type SourceAdapter = {
  sourceType: SourceAdapterContext["sourceType"];
  supportsLiveMode: boolean;
  parseConfig: (configJson: JsonValue) => SourceAdapterConfig;
  getMode: (configJson: JsonValue) => SourceMode;
  fetchSignals: (context: SourceAdapterContext) => Promise<SourceSignal[]>;
  runHealthCheck: (context: SourceAdapterContext) => Promise<{
    status: "ok" | "error";
    summary: string;
  }>;
};

const sampleSignalsBySource: Record<SourceAdapterContext["sourceType"] | "default", SourceSignal[]> = {
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

const adapterRegistry: Record<SourceAdapterContext["sourceType"], SourceAdapter> = {
  reddit: {
    sourceType: "reddit",
    supportsLiveMode: true,
    parseConfig: parseSourceConfig,
    getMode: (configJson) => resolveSourceMode(parseSourceConfig(configJson)),
    fetchSignals: async (context) => {
      const parsedConfig = parseSourceConfig(context.configJson);
      if (resolveSourceMode(parsedConfig) === "live") {
        return fetchRedditSignals(parsedConfig);
      }

      return getSampleSignals("reddit", parsedConfig);
    },
    runHealthCheck: async (context) => {
      const parsedConfig = parseSourceConfig(context.configJson);

      if (resolveSourceMode(parsedConfig) === "live") {
        return runRedditHealthCheck(parsedConfig);
      }

      const sampleSignals = sampleSignalsBySource.reddit;

      return {
        status: "ok",
        summary: `Sample adapter ready. ${sampleSignals.length} sample signal(s) available. sampleSize=${parsedConfig.sampleSize ?? sampleSignals.length}.`
      };
    }
  }
};

export function getSourceAdapter(sourceType: SourceAdapterContext["sourceType"]): SourceAdapter {
  return adapterRegistry[sourceType];
}

function parseSourceConfig(configJson: JsonValue): SourceAdapterConfig {
  return sourceAdapterConfigSchema.parse(isJsonObject(configJson) ? configJson : {});
}

function getSampleSignals(sourceType: SourceAdapterContext["sourceType"], config: SourceAdapterConfig) {
  const sampleSignals = sampleSignalsBySource[sourceType] ?? sampleSignalsBySource.default;
  const limitedSignals = sampleSignals.slice(0, config.sampleSize ?? sampleSignals.length);

  return limitedSignals.map((signal) => sourceSignalSchema.parse(signal));
}

async function fetchRedditSignals(config: SourceAdapterConfig) {
  const subredditList = config.subredditList?.length ? config.subredditList : ["smallbusiness", "fintech"];
  const limit = Math.min(config.sampleSize ?? 5, 10);
  const userAgent = process.env.SOURCE_HTTP_USER_AGENT;

  if (!userAgent) {
    throw new Error("SOURCE_HTTP_USER_AGENT is required for live reddit mode.");
  }

  const requests = subredditList.map(async (subreddit) => {
    const response = await fetchWithTimeout(
      `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/new.json?limit=${limit}`,
      {
        headers: {
          "User-Agent": userAgent,
          Accept: "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Reddit fetch failed for r/${subreddit} with ${response.status}.`);
    }

    const payload = (await response.json()) as RedditListingResponse;

    return payload.data.children.map((child) =>
      sourceSignalSchema.parse({
        sourceRecordId: child.data.id,
        sourceUrl: child.data.url ? normalizeRedditUrl(child.data.url) : `https://www.reddit.com${child.data.permalink}`,
        title: child.data.title,
        body: child.data.selftext || undefined,
        authorName: child.data.author || undefined,
        occurredAt: new Date(child.data.created_utc * 1000)
      })
    );
  });

  const signals = (await Promise.all(requests)).flat();

  return dedupeSignals(signals).slice(0, limit * subredditList.length);
}

async function runRedditHealthCheck(config: SourceAdapterConfig) {
  try {
    const signals = await fetchRedditSignals({
      ...config,
      sampleSize: Math.min(config.sampleSize ?? 3, 3)
    });

    return {
      status: "ok" as const,
      summary: `Live reddit adapter fetched ${signals.length} signal(s) successfully.`
    };
  } catch (error) {
    return {
      status: "error" as const,
      summary: error instanceof Error ? error.message : String(error)
    };
  }
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function dedupeSignals(signals: SourceSignal[]) {
  const seen = new Set<string>();

  return signals.filter((signal) => {
    if (seen.has(signal.sourceRecordId)) {
      return false;
    }

    seen.add(signal.sourceRecordId);
    return true;
  });
}

function normalizeRedditUrl(url: string) {
  if (url.startsWith("/")) {
    return `https://www.reddit.com${url}`;
  }

  return url;
}

function isJsonObject(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type RedditListingResponse = {
  data: {
    children: Array<{
      data: {
        id: string;
        title: string;
        selftext: string;
        author: string;
        permalink: string;
        url?: string;
        created_utc: number;
      };
    }>;
  };
};
