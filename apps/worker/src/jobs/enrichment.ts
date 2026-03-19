import type { JsonValue } from "@bizbrain/core";

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "have",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "there",
  "they",
  "this",
  "to",
  "want",
  "with"
]);

const CATEGORY_RULES = [
  { tag: "finance-product", terms: ["cashflow", "reserve", "debt", "loan", "mortgage", "treasury", "liquidity"] },
  { tag: "fintech", terms: ["payment", "reconciliation", "collections", "reporting", "planner", "finance"] },
  { tag: "property-management", terms: ["landlord", "tenant", "maintenance", "rent", "property", "vendor"] },
  { tag: "automation", terms: ["automation", "workflow", "manual", "follow-up", "pipeline", "process"] },
  { tag: "wellness", terms: ["wellness", "health", "fitness", "therapy", "sleep"] },
  { tag: "saas", terms: ["dashboard", "tool", "software", "platform", "operator"] }
] as const;

type EnrichmentInput = {
  title?: string | null;
  body?: string | null;
};

export type DeterministicEnrichment = {
  normalizedText: string;
  keywords: string[];
  entities: string[];
  painPoints: string[];
  intentPhrases: string[];
  categoryTags: string[];
  confidence: Record<string, JsonValue>;
  primaryCategory: string;
  clusterSeed: string;
  summary: string;
};

export function enrichSignal(input: EnrichmentInput): DeterministicEnrichment {
  const combinedText = [input.title, input.body].filter(Boolean).join(". ").trim();
  const normalizedText = normalizeText(combinedText);
  const keywords = extractKeywords(normalizedText);
  const painPoints = extractPainPoints(combinedText);
  const intentPhrases = extractIntentPhrases(combinedText);
  const categoryTags = detectCategoryTags(normalizedText, keywords);
  const primaryCategory = categoryTags[0] ?? "general";
  const clusterSeed = keywords[0] ?? primaryCategory;
  const entities = keywords.filter((keyword) => keyword.length > 7).slice(0, 3);

  return {
    normalizedText,
    keywords,
    entities,
    painPoints,
    intentPhrases,
    categoryTags,
    confidence: {
      mode: "deterministic",
      score: keywords.length > 0 ? 0.62 : 0.4
    },
    primaryCategory,
    clusterSeed,
    summary: buildSummary(primaryCategory, painPoints, keywords)
  };
}

export function buildClusterSlug(primaryCategory: string, clusterSeed: string) {
  return `${primaryCategory}-${clusterSeed}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function buildClusterTitle(primaryCategory: string, clusterSeed: string) {
  return `${toTitleCase(primaryCategory.replace(/-/g, " "))}: ${toTitleCase(clusterSeed.replace(/-/g, " "))}`;
}

export function buildIdeaTitle(clusterTitle: string) {
  return `${clusterTitle} Opportunity`;
}

function normalizeText(input: string) {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

function extractKeywords(normalizedText: string) {
  const counts = new Map<string, number>();

  for (const token of normalizedText.split(/[^a-z0-9]+/)) {
    if (token.length < 4 || STOPWORDS.has(token)) {
      continue;
    }

    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([token]) => token);
}

function extractPainPoints(input: string) {
  return input
    .split(/[.!?]/)
    .map((part) => part.trim())
    .filter((part) => /(missing|problem|issue|struggle|want|need)/i.test(part))
    .slice(0, 3);
}

function extractIntentPhrases(input: string) {
  return input
    .split(/[.!?]/)
    .map((part) => part.trim())
    .filter((part) => /(want|need|looking for|trying to)/i.test(part))
    .slice(0, 3);
}

function detectCategoryTags(normalizedText: string, keywords: string[]) {
  const haystack = `${normalizedText} ${keywords.join(" ")}`;

  return CATEGORY_RULES.filter((rule) => rule.terms.some((term) => haystack.includes(term))).map((rule) => rule.tag);
}

function buildSummary(primaryCategory: string, painPoints: string[], keywords: string[]) {
  if (painPoints.length > 0) {
    return painPoints[0];
  }

  if (keywords.length > 0) {
    return `Recurring ${primaryCategory} discussion around ${keywords.slice(0, 2).join(" and ")}.`;
  }

  return `Recurring ${primaryCategory} discussion detected from public signals.`;
}

function toTitleCase(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}
