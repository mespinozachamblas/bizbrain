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

export function buildSocialDraftPrompt() {
  return `
You are generating research-backed social media drafts for BizBrain.
Return strict JSON only.

Goals:
- turn one evidence-backed business idea into a usable social post draft
- respect the requested channel, topic, copy framework, and style profile
- keep claims grounded in the provided idea and evidence summary
- produce copy that is useful, specific, and commercially insightful
- include a visual brief and infographic outline that fit the post
- include media candidates and a media policy that separate publishable or review-required sources from reference-only inspiration

Rules:
- do not impersonate real people
- use the style profile as inspiration traits and guardrails only
- do not invent facts beyond the provided idea context
- make the hook strong but credible
- keep X content tighter and punchier than LinkedIn
- treat Google Images, Pinterest, and similar discovery surfaces as reference-only unless independent license verification is available
- prefer first-party assets, explicitly licensed stock, open-license libraries, and first-party generated assets for publishable or review-required suggestions
`.trim();
}
