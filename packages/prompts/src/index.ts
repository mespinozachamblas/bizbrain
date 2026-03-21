export const clusterSummaryPrompt = `
Summarize a trend cluster using only evidence-backed claims.
Return strict JSON matching the cluster summary schema.
`.trim();

export const ideaGenerationPrompt = `
Generate a structured idea from an evidence-backed cluster.
Return strict JSON matching the idea schema.
`.trim();

export function buildSignalResearchPrompt() {
  return `
You are analyzing raw public discussion signals for BizBrain.
Return strict JSON only.

Goals:
- identify the strongest practical pain points
- extract buying or intent language if present
- classify the signal into one primary category and several category tags
- produce a concise evidence-grounded summary
- draft one credible software idea that fits the evidence
- assign a 0-10 quality score for the idea based on specificity, commercial clarity, and evidence strength
- explain the quality score briefly and concretely

Rules:
- do not invent facts not grounded in the provided text
- keep category names short and reusable
- choose a clusterSeed that is stable and reusable across similar posts
- if the text is weak, still return your best structured assessment with conservative confidence
`.trim();
}
