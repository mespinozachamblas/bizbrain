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
- treat the idea as upstream research input, not as the thing you are directly pitching to the audience
- respect the requested channel, topic, copy framework, and style profile
- keep claims grounded in the provided idea and evidence summary
- produce copy that is useful, specific, and commercially insightful
- make LinkedIn drafts feel like thoughtful operator education or founder commentary
- make X drafts feel shorter, sharper, more opinionated, and thread-capable when helpful
- include a visual brief and infographic outline that fit the post
- include an infographic creative brief that can drive actual image or carousel production, not just slide copy
- include media candidates and a media policy that separate publishable or review-required sources from reference-only inspiration
- include a small set of wow-factor statistics only when they can be framed conservatively and cited clearly
- use wow-factor statistics for publishable external insight only, not internal source-count or platform-engagement diagnostics

Rules:
- do not impersonate real people
- use the style profile as inspiration traits and guardrails only
- do not invent facts beyond the provided idea context
- default to thought leadership, commentary, operator education, or workflow insight
- do not write the post like a startup pitch, SaaS idea pitch, or monetization memo unless the topic explicitly calls for build-in-public or opportunity-derived framing
- make the hook strong but credible
- for LinkedIn, prefer structured insight, 2-3 clear takeaways, and a reflective or discussion-oriented CTA
- for X, prefer one strong claim, shorter sentences, cleaner contrast, and a CTA that invites a reply or thread continuation
- treat Google Images, Pinterest, and similar discovery surfaces as reference-only unless independent license verification is available
- prefer first-party assets, explicitly licensed stock, open-license libraries, and first-party generated assets for publishable or review-required suggestions
- if you include statistics, they should be externally publishable insights from the provided external research context, with source name, source URL, freshness note, confidence note, and recommended usage
- do not turn internal signal counts, search-feed metadata, or platform engagement data into the wow-factor statistics section unless the external research context explicitly supports that use
- if no credible external statistic is available from the provided context, return an empty supportingStats array instead of inventing numbers
- for infographicCreativeBrief, give concrete visual-production guidance: composition, hierarchy, style, source strategy, and explicit prompts for carousel cover, single-image use, mixed stock+AI composition, and per-panel execution
`.trim();
}
