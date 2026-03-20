import {
  resolveSourceMode,
  sourceAdapterConfigSchema,
  sourceSignalSchema,
  type JsonValue,
  type SourceAdapterConfig,
  type SourceMode,
  type SourceType,
  type SourceSignal
} from "@bizbrain/core";

type SourceAdapterContext = {
  sourceType: SourceType;
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
  "google-trends": [
    {
      sourceRecordId: "google-trends-us-rent-payment-apps-001",
      sourceUrl: "https://trends.google.com/trends/explore?geo=US&q=rent%20payment%20app",
      title: "Rent payment app",
      body: "Google Trends sample signal showing increased interest in rent payment apps, landlord software, and tenant payment workflows in the US.",
      authorName: "google-trends",
      occurredAt: new Date("2026-03-18T09:00:00.000Z")
    },
    {
      sourceRecordId: "google-trends-us-cash-flow-forecasting-002",
      sourceUrl: "https://trends.google.com/trends/explore?geo=US&q=cash%20flow%20forecasting",
      title: "Cash flow forecasting",
      body: "Google Trends sample signal showing rising search interest around cash flow forecasting, reserve planning, and small business finance dashboards.",
      authorName: "google-trends",
      occurredAt: new Date("2026-03-18T11:00:00.000Z")
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
  },
  "google-trends": {
    sourceType: "google-trends",
    supportsLiveMode: true,
    parseConfig: parseSourceConfig,
    getMode: (configJson) => resolveSourceMode(parseSourceConfig(configJson)),
    fetchSignals: async (context) => {
      const parsedConfig = parseSourceConfig(context.configJson);

      if (resolveSourceMode(parsedConfig) === "live") {
        return fetchGoogleTrendSignals(parsedConfig);
      }

      return getSampleSignals("google-trends", parsedConfig);
    },
    runHealthCheck: async (context) => {
      const parsedConfig = parseSourceConfig(context.configJson);

      if (resolveSourceMode(parsedConfig) === "live") {
        return runGoogleTrendsHealthCheck(parsedConfig);
      }

      const sampleSignals = sampleSignalsBySource["google-trends"];

      return {
        status: "ok",
        summary: `Sample Google Trends adapter ready. ${sampleSignals.length} sample signal(s) available. sampleSize=${parsedConfig.sampleSize ?? sampleSignals.length}.`
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

async function fetchGoogleTrendSignals(config: SourceAdapterConfig) {
  const geo = (config.geo ?? "US").toUpperCase();
  const response = await fetchWithTimeout(`https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`, {
    headers: {
      Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8"
    }
  });

  if (!response.ok) {
    throw new Error(`Google Trends RSS fetch failed for geo=${geo} with ${response.status}.`);
  }

  const xml = await response.text();
  const parsedSignals = parseGoogleTrendsRss(xml, geo, config.keywords);
  const limitedSignals = parsedSignals.slice(0, config.sampleSize ?? 10);

  return limitedSignals.map((signal) => sourceSignalSchema.parse(signal));
}

async function runGoogleTrendsHealthCheck(config: SourceAdapterConfig) {
  try {
    const signals = await fetchGoogleTrendSignals({
      ...config,
      sampleSize: Math.min(config.sampleSize ?? 3, 3)
    });

    return {
      status: "ok" as const,
      summary: `Live Google Trends adapter fetched ${signals.length} signal(s) successfully.`
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

function parseGoogleTrendsRss(xml: string, geo: string, keywords?: string[]) {
  const items = extractXmlTagBlocks(xml, "item");
  const normalizedKeywords = (keywords ?? []).map((keyword) => keyword.trim().toLowerCase()).filter(Boolean);
  const parsedSignals: SourceSignal[] = [];

  for (const item of items) {
    const title = decodeXmlEntities(extractXmlTagText(item, "title") ?? "").trim();

    if (!title) {
      continue;
    }

    const pubDate = extractXmlTagText(item, "pubDate");
    const approximateTraffic = decodeXmlEntities(extractXmlTagText(item, "ht:approx_traffic") ?? "").trim();
    const articleTitles = extractXmlTagBlocks(item, "ht:news_item")
      .map((newsItem) => decodeXmlEntities(extractXmlTagText(newsItem, "ht:news_item_title") ?? "").trim())
      .filter(Boolean)
      .slice(0, 3);
    const articleUrls = extractXmlTagBlocks(item, "ht:news_item")
      .map((newsItem) => decodeXmlEntities(extractXmlTagText(newsItem, "ht:news_item_url") ?? "").trim())
      .filter(Boolean);
    const articleSnippets = articleTitles.length > 0 ? `Related coverage: ${articleTitles.join("; ")}.` : "";
    const body = [approximateTraffic ? `Approximate traffic: ${approximateTraffic}.` : "", articleSnippets]
      .filter(Boolean)
      .join(" ");
    const haystack = `${title} ${body}`.toLowerCase();
    const occurredAt = pubDate ? new Date(pubDate) : undefined;
    const sourceUrl =
      articleUrls[0] || `https://trends.google.com/trends/explore?geo=${encodeURIComponent(geo)}&q=${encodeURIComponent(title)}`;

    if (normalizedKeywords.length > 0 && !normalizedKeywords.some((keyword) => haystack.includes(keyword))) {
      continue;
    }

    parsedSignals.push(
      sourceSignalSchema.parse({
        sourceRecordId: buildGoogleTrendRecordId(geo, title, pubDate),
        sourceUrl,
        title,
        body: body || undefined,
        authorName: "google-trends",
        occurredAt
      })
    );
  }

  return dedupeSignals(parsedSignals);
}

function extractXmlTagBlocks(xml: string, tagName: string) {
  const matches = xml.matchAll(new RegExp(`<${escapeRegExp(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegExp(tagName)}>`, "gi"));
  return [...matches].map((match) => match[1]);
}

function extractXmlTagText(xml: string, tagName: string) {
  const match = xml.match(new RegExp(`<${escapeRegExp(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegExp(tagName)}>`, "i"));
  return match?.[1] ?? null;
}

function buildGoogleTrendRecordId(geo: string, title: string, pubDate: string | null) {
  const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const normalizedDate = pubDate ? new Date(pubDate).toISOString().slice(0, 10) : "undated";
  return `google-trends-${geo.toLowerCase()}-${normalizedTitle}-${normalizedDate}`.slice(0, 120);
}

function decodeXmlEntities(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
