import { llmEnrichmentSchema, type JsonValue, type LlmEnrichment } from "@bizbrain/core";
import { buildSignalResearchPrompt } from "@bizbrain/prompts";

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
  rawSignalId?: string;
  title?: string | null;
  body?: string | null;
};

const batchedLlmEnrichmentSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          rawSignalId: { type: "string" },
          normalizedText: { type: "string" },
          keywords: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 8
          },
          entities: {
            type: "array",
            items: { type: "string" },
            maxItems: 6
          },
          painPoints: {
            type: "array",
            items: { type: "string" },
            maxItems: 5
          },
          intentPhrases: {
            type: "array",
            items: { type: "string" },
            maxItems: 5
          },
          categoryTags: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 6
          },
          confidence: {
            type: "object",
            additionalProperties: false,
            properties: {
              mode: { type: "string", enum: ["llm"] },
              score: { type: "number", minimum: 0, maximum: 1 },
              rationale: { type: "string" }
            },
            required: ["mode", "score", "rationale"]
          },
          primaryCategory: { type: "string" },
          clusterSeed: { type: "string" },
          summary: { type: "string" },
          idea: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              businessType: { type: "string" },
              targetCustomer: { type: "string" },
              problemSummary: { type: "string" },
              solutionConcept: { type: "string" },
              monetizationAngle: { type: "string" },
              qualityScore: { type: "number", minimum: 0, maximum: 10 },
              qualityReason: { type: "string" },
              validationQuestions: {
                type: "array",
                items: { type: "string" },
                minItems: 2,
                maxItems: 5
              },
              riskNotes: { type: "string" },
              evidenceSummary: { type: "string" }
            },
            required: [
              "title",
              "businessType",
              "targetCustomer",
              "problemSummary",
              "solutionConcept",
              "monetizationAngle",
              "qualityScore",
              "qualityReason",
              "validationQuestions",
              "riskNotes",
              "evidenceSummary"
            ]
          }
        },
        required: [
          "rawSignalId",
          "normalizedText",
          "keywords",
          "entities",
          "painPoints",
          "intentPhrases",
          "categoryTags",
          "confidence",
          "primaryCategory",
          "clusterSeed",
          "summary",
          "idea"
        ]
      }
    }
  },
  required: ["items"]
} as const;

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

export async function enrichSignalWithModel(input: EnrichmentInput) {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const content = [input.title, input.body].filter(Boolean).join("\n\n").trim();

  if (!content) {
    return null;
  }

  const response = await postOpenAiResponse({
    model: resolveEnrichmentModel(),
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: buildSignalResearchPrompt()
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `TITLE:\n${input.title ?? "(none)"}\n\nBODY:\n${input.body ?? "(none)"}`
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "signal_research_enrichment",
        strict: true,
        schema: llmEnrichmentSchemaToJsonSchema()
      }
    }
  });

  if (!response.ok) {
    throw new Error(`OpenAI enrichment request failed with ${response.status}.`);
  }

  const payload = (await response.json()) as OpenAIResponsePayload;
  const textOutput =
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((contentItem) => contentItem.type === "output_text")
      ?.text ?? null;

  if (!textOutput) {
    throw new Error("OpenAI enrichment response did not include output_text.");
  }

  return llmEnrichmentSchema.parse(JSON.parse(textOutput));
}

export async function enrichSignalBatchWithModel(inputs: EnrichmentInput[]) {
  if (!process.env.OPENAI_API_KEY || inputs.length === 0) {
    return new Map<string, LlmEnrichment>();
  }

  const validInputs = inputs.filter((input): input is EnrichmentInput & { rawSignalId: string } => {
    const content = [input.title, input.body].filter(Boolean).join("\n\n").trim();
    return Boolean(input.rawSignalId && content);
  });

  if (validInputs.length === 0) {
    return new Map<string, LlmEnrichment>();
  }

  const response = await postOpenAiResponse({
    model: resolveEnrichmentModel(),
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: `${buildSignalResearchPrompt()}

You will receive multiple signals.
Return one result for every provided rawSignalId.
Preserve each rawSignalId exactly in the output.
Do not omit items unless the corresponding input text is empty.`
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: validInputs
              .map(
                (input) =>
                  `RAW_SIGNAL_ID: ${input.rawSignalId}\nTITLE:\n${input.title ?? "(none)"}\n\nBODY:\n${input.body ?? "(none)"}`
              )
              .join("\n\n---\n\n")
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "signal_research_batch_enrichment",
        strict: true,
        schema: batchedLlmEnrichmentSchema
      }
    }
  });

  if (!response.ok) {
    throw new Error(`OpenAI batch enrichment request failed with ${response.status}.`);
  }

  const payload = (await response.json()) as OpenAIResponsePayload;
  const textOutput =
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((contentItem) => contentItem.type === "output_text")
      ?.text ?? null;

  if (!textOutput) {
    throw new Error("OpenAI batch enrichment response did not include output_text.");
  }

  const parsed = JSON.parse(textOutput) as {
    items: Array<{ rawSignalId: string } & LlmEnrichment>;
  };
  const results = new Map<string, LlmEnrichment>();

  for (const item of parsed.items) {
    const enrichment = llmEnrichmentSchema.parse(item);
    results.set(item.rawSignalId, enrichment);
  }

  return results;
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

type OpenAIResponsePayload = {
  output?: Array<{
    content?: Array<{
      type: string;
      text?: string;
    }>;
  }>;
};

type OpenAIRequestBody = {
  model: string;
  input: Array<{
    role: string;
    content: Array<{
      type: string;
      text: string;
    }>;
  }>;
  text: {
    format: {
      type: "json_schema";
      name: string;
      strict: true;
      schema: unknown;
    };
  };
};

function llmEnrichmentSchemaToJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      normalizedText: { type: "string" },
      keywords: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 8
      },
      entities: {
        type: "array",
        items: { type: "string" },
        maxItems: 6
      },
      painPoints: {
        type: "array",
        items: { type: "string" },
        maxItems: 5
      },
      intentPhrases: {
        type: "array",
        items: { type: "string" },
        maxItems: 5
      },
      categoryTags: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 6
      },
      confidence: {
        type: "object",
        additionalProperties: false,
        properties: {
          mode: { type: "string", enum: ["llm"] },
          score: { type: "number", minimum: 0, maximum: 1 },
          rationale: { type: "string" }
        },
        required: ["mode", "score", "rationale"]
      },
      primaryCategory: { type: "string" },
      clusterSeed: { type: "string" },
      summary: { type: "string" },
      idea: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          businessType: { type: "string" },
          targetCustomer: { type: "string" },
          problemSummary: { type: "string" },
          solutionConcept: { type: "string" },
          monetizationAngle: { type: "string" },
          validationQuestions: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 5
          },
          riskNotes: { type: "string" },
          evidenceSummary: { type: "string" }
        },
        required: [
          "title",
          "businessType",
          "targetCustomer",
          "problemSummary",
          "solutionConcept",
          "monetizationAngle",
          "validationQuestions",
          "riskNotes",
          "evidenceSummary"
        ]
      }
    },
    required: [
      "normalizedText",
      "keywords",
      "entities",
      "painPoints",
      "intentPhrases",
      "categoryTags",
      "confidence",
      "primaryCategory",
      "clusterSeed",
      "summary",
      "idea"
    ]
  } as const;
}

async function postOpenAiResponse(body: OpenAIRequestBody) {
  const maxRetries = resolveOpenAiRetryCount();
  let lastResponse: Response | null = null;
  let lastErrorText = "";

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (response.ok) {
      return response;
    }

    lastErrorText = await safeReadResponseText(response);
    lastResponse = response;

    if (!shouldRetryOpenAiResponse(response.status) || attempt === maxRetries) {
      throw buildOpenAiResponseError(response.status, lastErrorText);
    }

    await sleep(resolveRetryDelayMs(response, attempt));
  }

  if (!lastResponse) {
    throw new Error("OpenAI enrichment request did not return a response.");
  }

  throw buildOpenAiResponseError(lastResponse.status, lastErrorText);
}

function resolveEnrichmentModel() {
  return process.env.OPENAI_ENRICH_MODEL ?? "gpt-5-mini";
}

function resolveOpenAiRetryCount() {
  const parsed = Number(process.env.OPENAI_ENRICH_MAX_RETRIES ?? "3");

  if (!Number.isInteger(parsed) || parsed < 0) {
    return 3;
  }

  return Math.min(parsed, 6);
}

function shouldRetryOpenAiResponse(status: number) {
  return status === 429 || status >= 500;
}

function resolveRetryDelayMs(response: Response, attempt: number) {
  const retryAfterSeconds = Number(response.headers.get("retry-after"));

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }

  const baseDelayMs = resolveOpenAiRetryBaseDelayMs();
  const exponentialDelay = baseDelayMs * 2 ** attempt;
  const cappedDelay = Math.min(exponentialDelay, 20_000);

  return cappedDelay + randomJitterMs(250);
}

function resolveOpenAiRetryBaseDelayMs() {
  const parsed = Number(process.env.OPENAI_ENRICH_RETRY_BASE_DELAY_MS ?? "2000");

  if (!Number.isFinite(parsed) || parsed < 250) {
    return 2000;
  }

  return parsed;
}

function randomJitterMs(maxJitterMs: number) {
  return Math.floor(Math.random() * maxJitterMs);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeReadResponseText(response: Response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function buildOpenAiResponseError(status: number, responseText: string) {
  const detail = extractOpenAiErrorDetail(responseText);

  if (!detail) {
    return new Error(`OpenAI enrichment request failed with ${status}.`);
  }

  return new Error(`OpenAI enrichment request failed with ${status}: ${detail}`);
}

function extractOpenAiErrorDetail(responseText: string) {
  if (!responseText.trim()) {
    return "";
  }

  try {
    const parsed = JSON.parse(responseText) as {
      error?: {
        type?: string;
        code?: string;
        message?: string;
      };
    };

    const parts = [parsed.error?.type, parsed.error?.code, parsed.error?.message].filter(Boolean);
    return parts.join(" | ").slice(0, 300);
  } catch {
    return responseText.trim().slice(0, 300);
  }
}
