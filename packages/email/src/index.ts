import type { DigestSection } from "@bizbrain/core";

export type DigestRenderInput = {
  digestDate: string;
  generatedAt: string;
  sections: DigestSection[];
  appBaseUrl?: string;
};

export function renderDigestMarkdown(input: DigestRenderInput) {
  const sectionText = input.sections
    .map((section) =>
      [
        `## ${section.sectionTitle}`,
        section.plainLanguageSummary,
        "",
        ...section.items.map((item) => `- ${item}`),
        ...(section.alerts.length > 0 ? ["", ...section.alerts.map((alert) => `- Note: ${alert}`)] : [])
      ].join("\n")
    )
    .join("\n\n");

  const reviewLink = input.appBaseUrl ? `\n\nReview full pipeline state: ${input.appBaseUrl}` : "";

  return `# Opportunity Digest\n\nDate: ${input.digestDate}\nGenerated: ${input.generatedAt}\n\n${sectionText}${reviewLink}`;
}

export function renderDigestHtml(input: DigestRenderInput) {
  const sections = input.sections
    .map((section) => {
      const items = section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
      const alerts =
        section.alerts.length > 0
          ? `<div style="margin-top:12px;padding:12px;border-radius:12px;background:#fff7ed;border:1px solid #fdba74;"><strong>Notes</strong><ul>${section.alerts
              .map((alert) => `<li>${escapeHtml(alert)}</li>`)
              .join("")}</ul></div>`
          : "";

      return `<section style="margin:0 0 24px;">
        <h2 style="margin:0 0 8px;font-size:18px;line-height:1.3;color:#111827;">${escapeHtml(section.sectionTitle)}</h2>
        <p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.6;">${escapeHtml(section.plainLanguageSummary)}</p>
        <ul style="margin:0;padding-left:20px;color:#111827;font-size:14px;line-height:1.7;">${items}</ul>
        ${alerts}
      </section>`;
    })
    .join("");

  const reviewLink = input.appBaseUrl
    ? `<p style="margin:24px 0 0;font-size:14px;"><a href="${escapeHtml(input.appBaseUrl)}" style="color:#0f766e;text-decoration:none;">Open BizBrain dashboard</a></p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#111827;">
    <main style="max-width:640px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:20px;padding:28px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0f766e;">BizBrain</p>
        <h1 style="margin:0 0 8px;font-size:28px;line-height:1.2;">Opportunity Digest</h1>
        <p style="margin:0;color:#4b5563;font-size:14px;line-height:1.6;">Date: ${escapeHtml(input.digestDate)}<br/>Generated: ${escapeHtml(input.generatedAt)}</p>
        <div style="margin-top:28px;">${sections}</div>
        ${reviewLink}
      </div>
    </main>
  </body>
</html>`;
}

export function buildDigestSubject(digestDate: string) {
  return `Opportunity Digest — ${digestDate}`;
}

type SendResendEmailInput = {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string[];
};

export type ResendSendResult = {
  id?: string;
  error?: string;
};

export async function sendWithResend(input: SendResendEmailInput): Promise<ResendSendResult> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
      ...(input.replyTo && input.replyTo.length > 0 ? { reply_to: input.replyTo } : {})
    })
  });

  const payload = (await response.json()) as { id?: string; message?: string; name?: string };

  if (!response.ok) {
    return {
      error: payload.message ?? payload.name ?? `Resend request failed with HTTP ${response.status}`
    };
  }

  return { id: payload.id };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
