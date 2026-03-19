import type { DigestSection } from "@bizbrain/core";

export type DigestRenderInput = {
  digestDate: string;
  generatedAt: string;
  sections: DigestSection[];
};

export function renderDigestMarkdown(input: DigestRenderInput) {
  const sectionText = input.sections
    .map((section) => `## ${section.sectionTitle}\n${section.items.map((item) => `- ${item}`).join("\n")}`)
    .join("\n\n");

  return `# Opportunity Digest\n\nDate: ${input.digestDate}\nGenerated: ${input.generatedAt}\n\n${sectionText}`;
}
