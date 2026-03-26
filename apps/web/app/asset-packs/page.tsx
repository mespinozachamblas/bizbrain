import { db } from "@bizbrain/db";
import { formatDate, formatListInput, readSearchParam } from "../dashboard-data";
import { EmptyState } from "../dashboard-ui";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AssetPacksPage({ searchParams }: PageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const drafts = (await getAssetPackDrafts()) as any[];
  const query = readSearchParam(resolvedSearchParams, "q");
  const channel = readSearchParam(resolvedSearchParams, "channel");
  const topicId = readSearchParam(resolvedSearchParams, "topicId");

  const evaluatedDrafts = drafts.map((draft) => {
    const supportingStats = readSupportingStats(draft.supportingStatsJson);
    const mediaCandidates = readMediaCandidates(draft.assetCandidatesJson);
    const approvedStats = supportingStats.filter((stat) => stat.reviewStatus === "approved");
    const reviewedMedia = mediaCandidates.filter(
      (candidate) => candidate.reviewStatus === "approved" || candidate.reviewStatus === "use-with-caution"
    );
    const readiness = scoreAssetPackReadiness(draft, approvedStats, reviewedMedia);

    return {
      draft,
      approvedStats,
      reviewedMedia,
      readiness
    };
  });

  const readyDrafts = evaluatedDrafts
    .filter(({ draft, approvedStats, reviewedMedia }) => {
      const hasReadyEvidence = approvedStats.length > 0;
      const hasReadyMedia = reviewedMedia.length > 0;

      if (!hasReadyEvidence && !hasReadyMedia) {
        return false;
      }

      const matchesQuery =
        !query ||
        [
          draft.title,
          draft.topic?.name ?? "",
          draft.hook ?? "",
          draft.thesis ?? "",
          draft.copyFramework?.name ?? "",
          draft.styleProfile?.name ?? ""
        ]
          .join(" ")
          .toLowerCase()
          .includes(query.trim().toLowerCase());

      const matchesChannel = !channel || draft.targetChannel === channel;
      const matchesTopic = !topicId || draft.topicId === topicId;

      return matchesQuery && matchesChannel && matchesTopic;
    })
    .sort((left, right) => {
      if (right.readiness.score !== left.readiness.score) {
        return right.readiness.score - left.readiness.score;
      }

      const rightQuality = right.draft.qualityScore ?? 0;
      const leftQuality = left.draft.qualityScore ?? 0;
      if (rightQuality !== leftQuality) {
        return rightQuality - leftQuality;
      }

      return new Date(right.draft.updatedAt).getTime() - new Date(left.draft.updatedAt).getTime();
    });

  const socialTopics = drafts
    .map((draft) => draft.topic)
    .filter((topic): topic is NonNullable<(typeof drafts)[number]["topic"]> => Boolean(topic))
    .filter((topic, index, all) => all.findIndex((candidate) => candidate.id === topic.id) === index)
    .sort((left, right) => left.name.localeCompare(right.name));

  const bulkPromptPack = buildBulkExportPack("prompt-pack", readyDrafts);
  const bulkCarouselPack = buildBulkExportPack("carousel", readyDrafts);
  const bulkSingleImagePack = buildBulkExportPack("single-image", readyDrafts);
  const bulkDesignerBriefPack = buildBulkExportPack("designer-brief", readyDrafts);

  return (
    <main className="contentPage assetPacksPage">
      <section className="hero heroCompact">
        <p className="eyebrow">BizBrain</p>
        <h1>Asset Packs</h1>
        <p className="lede">
          Work from a single export queue for social drafts that already have approved evidence or reviewed media. Use this
          screen when you want production-ready handoffs instead of full editorial review.
        </p>
      </section>

      <section className="dashboardGrid">
        <article className="card cardTall">
          <div className="cardHeader">
            <h2>Ready export queue</h2>
            <span className="badge">{readyDrafts.length}</span>
          </div>
          <form className="filterForm filterFormAssetPacks" method="get">
            <label className="fieldLabel">
              Search drafts
              <input className="fieldInput" defaultValue={query} name="q" placeholder="Search title, hook, topic, framework" type="text" />
            </label>
            <label className="fieldLabel">
              Channel
              <select className="fieldInput" defaultValue={channel} name="channel">
                <option value="">All channels</option>
                <option value="linkedin">LinkedIn</option>
                <option value="x">X</option>
              </select>
            </label>
            <label className="fieldLabel">
              Topic
              <select className="fieldInput" defaultValue={topicId} name="topicId">
                <option value="">All topics</option>
                {socialTopics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="jobButton jobButtonSecondary" type="submit">
              Filter queue
            </button>
          </form>
          <p className="helperText">
            Showing {readyDrafts.length} export-ready draft(s) out of {drafts.length} social draft(s).
          </p>
          {readyDrafts.length === 0 ? (
            <EmptyState message="No export-ready drafts yet. Approve some supporting stats or media candidates in Social Drafts first." />
          ) : (
            <div className="stack">
              <div className="card">
                <div className="cardHeader">
                  <h2>Bulk exports</h2>
                  <span className="badge">{readyDrafts.length} ready</span>
                </div>
                <p className="helperText">
                  Download one combined file for the current filtered queue when you want to batch handoffs. Drafts below are ranked by
                  export readiness, approved evidence, and current quality score.
                </p>
                <div className="jobButtons">
                  <a className="jobButton jobButtonSecondary" download={buildPromptPackFilename("bulk prompt-pack export")} href={buildPromptPackHref(bulkPromptPack)}>
                    All prompt packs
                  </a>
                  <a className="jobButton jobButtonSecondary" download={buildPromptPackFilename("bulk carousel export")} href={buildPromptPackHref(bulkCarouselPack)}>
                    All carousel packs
                  </a>
                  <a className="jobButton jobButtonSecondary" download={buildPromptPackFilename("bulk single-image export")} href={buildPromptPackHref(bulkSingleImagePack)}>
                    All single-image packs
                  </a>
                  <a className="jobButton jobButtonSecondary" download={buildPromptPackFilename("bulk designer-brief export")} href={buildPromptPackHref(bulkDesignerBriefPack)}>
                    All designer briefs
                  </a>
                </div>
              </div>
              {readyDrafts.map(({ draft, approvedStats: supportingStats, reviewedMedia: mediaCandidates, readiness }) => {
                const promptPack = buildPromptPack(draft, supportingStats, mediaCandidates);
                const carouselPack = buildPromptVariantPack("carousel", draft, supportingStats, mediaCandidates);
                const singleImagePack = buildPromptVariantPack("single-image", draft, supportingStats, mediaCandidates);
                const mixedMediaPack = buildPromptVariantPack("mixed-media", draft, supportingStats, mediaCandidates);
                const designerBrief = buildDesignerBrief(draft, supportingStats, mediaCandidates);

                return (
                  <article className="card" key={draft.id}>
                    <div className="cardHeader">
                      <div>
                        <h2>{draft.title}</h2>
                        <p className="helperText">
                          {draft.targetChannel} · {draft.topic?.name ?? "No topic"} · updated {formatDate(draft.updatedAt)}
                        </p>
                        <p className="helperText">Export readiness {readiness.score.toFixed(1)} · {readiness.label}</p>
                      </div>
                      <span className={`status status-${normalizeDraftStatus(draft.status)}`}>{draft.status}</span>
                    </div>
                    <p className="rowBody"><strong>Hook:</strong> {draft.hook ?? "No hook yet."}</p>
                    <p className="rowBody"><strong>Thesis:</strong> {draft.thesis ?? "No thesis yet."}</p>
                    <p className="rowMeta">
                      Approved stats: {supportingStats.length} · Reviewed media: {mediaCandidates.length} · Format: {draft.infographicFormat ?? "not set"}
                    </p>
                    <p className="rowMeta">
                      Ready because: {buildReadyReasonLabel(supportingStats.length, mediaCandidates.length)}
                    </p>
                    <div className="jobButtons">
                      <a className="jobButton jobButtonSecondary" download={buildPromptPackFilename(draft.title ?? "social-draft")} href={buildPromptPackHref(promptPack)}>
                        Prompt pack
                      </a>
                      <a className="jobButton jobButtonSecondary" download={buildPromptPackFilename(`${draft.title ?? "social-draft"} carousel`)} href={buildPromptPackHref(carouselPack)}>
                        Carousel pack
                      </a>
                      <a className="jobButton jobButtonSecondary" download={buildPromptPackFilename(`${draft.title ?? "social-draft"} single-image`)} href={buildPromptPackHref(singleImagePack)}>
                        Single-image pack
                      </a>
                      <a className="jobButton jobButtonSecondary" download={buildPromptPackFilename(`${draft.title ?? "social-draft"} mixed-media`)} href={buildPromptPackHref(mixedMediaPack)}>
                        Mixed-media pack
                      </a>
                      <a className="jobButton jobButtonSecondary" download={buildPromptPackFilename(`${draft.title ?? "social-draft"} designer-brief`)} href={buildPromptPackHref(designerBrief)}>
                        Designer brief
                      </a>
                    </div>
                    <details className="adminDisclosure">
                      <summary className="adminDisclosureSummary">
                        <div>
                          <p className="rowTitle">Reviewed inputs</p>
                          <p className="rowMeta">Shows only the approved or review-safe inputs currently feeding these exports</p>
                        </div>
                      </summary>
                      <div className="stack">
                        {supportingStats.length > 0 ? (
                          <div className="evidenceSection">
                            <p className="rowBody"><strong>Approved supporting stats:</strong></p>
                            <div className="stack">
                              {supportingStats.map((stat, index) => (
                                <div className="evidenceCard" key={`${draft.id}-approved-stat-${index}`}>
                                  <p className="rowTitle">{stat.claim}</p>
                                  <p className="rowBody"><strong>Angle:</strong> {stat.plainLanguageAngle}</p>
                                  <p className="rowMeta">
                                    {stat.sourceName}
                                    {stat.sourceUrl ? ` — ${stat.sourceUrl}` : ""}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {mediaCandidates.length > 0 ? (
                          <div className="evidenceSection">
                            <p className="rowBody"><strong>Reviewed media references:</strong></p>
                            <div className="stack">
                              {mediaCandidates.map((candidate, index) => (
                                <div className="evidenceCard" key={`${draft.id}-approved-media-${index}`}>
                                  <p className="rowTitle">{candidate.label}</p>
                                  <p className="rowMeta">
                                    {candidate.sourceType} · {candidate.reviewStatus} · {candidate.usageStatus}
                                  </p>
                                  <p className="rowBody"><strong>License:</strong> {candidate.licenseLabel ?? "Verify on origin site"}</p>
                                  <p className="rowMeta">{candidate.originUrl ?? "No origin URL stored."}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </details>
                  </article>
                );
              })}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}

async function getAssetPackDrafts() {
  return (db as any).contentDraft.findMany({
    where: {
      researchStreamId: "stream-social-media-research"
    },
    orderBy: [{ updatedAt: "desc" }, { qualityScore: "desc" }],
    include: {
      topic: true,
      copyFramework: true,
      styleProfile: true
    }
  });
}

function readObjectField(value: unknown, key: string) {
  if (!value || typeof value !== "object" || !(key in value)) {
    return null;
  }

  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" ? candidate : null;
}

function readObjectArrayField(value: unknown, key: string) {
  if (!value || typeof value !== "object" || !(key in value)) {
    return [];
  }

  const candidate = (value as Record<string, unknown>)[key];
  return Array.isArray(candidate) ? candidate.filter((entry): entry is string => typeof entry === "string") : [];
}

function readMediaCandidates(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .map((entry) => ({
      label: typeof entry.label === "string" ? entry.label : "Untitled candidate",
      sourceType: typeof entry.sourceType === "string" ? entry.sourceType : "unknown",
      originUrl: typeof entry.originUrl === "string" && entry.originUrl.trim().length > 0 ? entry.originUrl : null,
      usageStatus:
        typeof entry.usageStatus === "string" &&
        ["publishable", "review-required", "reference-only"].includes(entry.usageStatus)
          ? entry.usageStatus
          : "review-required",
      reviewStatus:
        typeof entry.reviewStatus === "string" &&
        ["pending", "approved", "use-with-caution", "rejected", "reference-only"].includes(entry.reviewStatus)
          ? entry.reviewStatus
          : typeof entry.usageStatus === "string" && entry.usageStatus === "reference-only"
            ? "reference-only"
            : "pending",
      licenseLabel: typeof entry.licenseLabel === "string" ? entry.licenseLabel : null,
      attributionText: typeof entry.attributionText === "string" ? entry.attributionText : null
    }));
}

function readSupportingStats(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .map((entry) => ({
      claim: typeof entry.claim === "string" ? entry.claim : "No claim recorded.",
      plainLanguageAngle: typeof entry.plainLanguageAngle === "string" ? entry.plainLanguageAngle : "No angle recorded.",
      sourceName: typeof entry.sourceName === "string" ? entry.sourceName : "Unknown source",
      sourceUrl: typeof entry.sourceUrl === "string" && entry.sourceUrl.trim().length > 0 ? entry.sourceUrl : null,
      reviewStatus:
        typeof entry.reviewStatus === "string" && ["pending", "approved", "use-with-caution", "rejected"].includes(entry.reviewStatus)
          ? entry.reviewStatus
          : "pending"
    }));
}

function buildPromptPack(
  draft: any,
  supportingStats: Array<{ claim: string; sourceName: string; sourceUrl: string | null; reviewStatus: string }>,
  mediaCandidates: Array<{ label: string; sourceType: string; originUrl: string | null; reviewStatus: string; usageStatus: string }>
) {
  const creativeBrief = draft.infographicCreativeBriefJson;
  const lines = [
    `TITLE: ${draft.title ?? "Untitled social draft"}`,
    `CHANNEL: ${draft.targetChannel ?? "unknown"}`,
    `TOPIC: ${draft.topic?.name ?? "Unassigned"}`,
    `HOOK: ${draft.hook ?? "No hook recorded."}`,
    `THESIS: ${draft.thesis ?? "No thesis recorded."}`,
    `CTA: ${draft.cta ?? "No CTA recorded."}`,
    "",
    "INFOGRAPHIC CREATIVE DIRECTION",
    `Creative direction: ${readObjectField(creativeBrief, "creativeDirection") ?? "No creative direction recorded."}`,
    `Objective: ${readObjectField(creativeBrief, "objective") ?? "No objective recorded."}`,
    `Visual style: ${readObjectField(creativeBrief, "visualStyle") ?? "No visual style recorded."}`,
    `Layout strategy: ${readObjectField(creativeBrief, "layoutStrategy") ?? "No layout strategy recorded."}`,
    `Chart/diagram: ${readObjectField(creativeBrief, "chartOrDiagramType") ?? "No chart direction recorded."}`,
    `Image source strategy: ${readObjectField(creativeBrief, "imageSourceStrategy") ?? "No image-source strategy recorded."}`,
    "",
    "PRODUCTION PROMPTS",
    `Carousel cover prompt: ${readObjectField(creativeBrief, "carouselCoverPrompt") ?? "No carousel cover prompt recorded."}`,
    `Single-image prompt: ${readObjectField(creativeBrief, "singleImagePrompt") ?? "No single-image prompt recorded."}`,
    `Mixed stock + AI prompt: ${readObjectField(creativeBrief, "mixedMediaCompositionPrompt") ?? "No mixed-media prompt recorded."}`,
    `Master AI image prompt: ${readObjectField(creativeBrief, "aiImagePrompt") ?? "No AI image prompt recorded."}`,
    "",
    "PANEL PROMPTS",
    ...readObjectArrayField(creativeBrief, "panelPrompts").map((prompt, index) => `${index + 1}. ${prompt}`),
    "",
    "TEXT HIERARCHY",
    ...readObjectArrayField(creativeBrief, "textHierarchy").map((item, index) => `${index + 1}. ${item}`),
    "",
    "AVOID NOTES",
    ...readObjectArrayField(creativeBrief, "avoidNotes").map((item, index) => `${index + 1}. ${item}`),
    "",
    "APPROVED SUPPORTING STATS",
    ...(supportingStats.length > 0
      ? supportingStats.map(
          (stat, index) =>
            `${index + 1}. ${stat.claim} (${stat.sourceName}${stat.sourceUrl ? ` — ${stat.sourceUrl}` : ""})`
        )
      : ["No approved supporting stats yet."]),
    "",
    "REVIEWED MEDIA REFERENCES",
    ...(mediaCandidates.length > 0
      ? mediaCandidates.map(
          (candidate, index) =>
            `${index + 1}. ${candidate.label} [${candidate.sourceType} / ${candidate.reviewStatus} / ${candidate.usageStatus}]${candidate.originUrl ? ` — ${candidate.originUrl}` : ""}`
        )
      : ["No reviewed media suggestions yet."])
  ];

  return lines.join("\n");
}

function buildBulkExportPack(
  variant: "prompt-pack" | "carousel" | "single-image" | "designer-brief",
  drafts: Array<{
    draft: any;
    approvedStats: Array<{ claim: string; sourceName: string; sourceUrl: string | null; reviewStatus: string }>;
    reviewedMedia: Array<{ label: string; sourceType: string; originUrl: string | null; reviewStatus: string; usageStatus: string }>;
  }>
) {
  const sections = drafts.map(({ draft, approvedStats: supportingStats, reviewedMedia: mediaCandidates }, index) => {

    const body =
      variant === "prompt-pack"
        ? buildPromptPack(draft, supportingStats, mediaCandidates)
        : variant === "carousel"
          ? buildPromptVariantPack("carousel", draft, supportingStats, mediaCandidates)
          : variant === "single-image"
            ? buildPromptVariantPack("single-image", draft, supportingStats, mediaCandidates)
            : buildDesignerBrief(draft, supportingStats, mediaCandidates);

    return [`===== ${index + 1}. ${draft.title ?? "Untitled social draft"} =====`, body].join("\n");
  });

  return sections.join("\n\n");
}

function scoreAssetPackReadiness(
  draft: any,
  approvedStats: Array<{ reviewStatus: string }>,
  reviewedMedia: Array<{ reviewStatus: string }>,
) {
  const qualityScore = typeof draft.qualityScore === "number" ? draft.qualityScore : 0;
  const statusBonus =
    draft.status === "publish-later" ? 2.5 : draft.status === "promising" ? 1.5 : draft.status === "revisit" ? 0.5 : 0;
  const formatBonus = draft.infographicFormat ? 1 : 0;
  const approvedStatBonus = Math.min(approvedStats.length, 3) * 1.2;
  const reviewedMediaBonus = Math.min(reviewedMedia.length, 3) * 0.8;

  const score = Number((qualityScore + statusBonus + formatBonus + approvedStatBonus + reviewedMediaBonus).toFixed(1));

  if (approvedStats.length >= 2 && reviewedMedia.length >= 1 && qualityScore >= 7.5) {
    return { score, label: "strong evidence and media coverage" };
  }

  if (approvedStats.length >= 1 && qualityScore >= 7) {
    return { score, label: "good export candidate" };
  }

  if (reviewedMedia.length >= 1) {
    return { score, label: "media-ready but evidence-light" };
  }

  return { score, label: "evidence-ready" };
}

function buildReadyReasonLabel(approvedStatCount: number, reviewedMediaCount: number) {
  if (approvedStatCount > 0 && reviewedMediaCount > 0) {
    return "approved stats and reviewed media";
  }

  if (approvedStatCount > 0) {
    return "approved stats";
  }

  if (reviewedMediaCount > 0) {
    return "reviewed media";
  }

  return "manual review pending";
}

function buildPromptVariantPack(
  variant: "carousel" | "single-image" | "mixed-media",
  draft: any,
  supportingStats: Array<{ claim: string; sourceName: string; sourceUrl: string | null; reviewStatus: string }>,
  mediaCandidates: Array<{ label: string; sourceType: string; originUrl: string | null; reviewStatus: string; usageStatus: string }>
) {
  const creativeBrief = draft.infographicCreativeBriefJson;
  const promptLabel =
    variant === "carousel"
      ? "Carousel cover prompt"
      : variant === "single-image"
        ? "Single-image prompt"
        : "Mixed stock + AI prompt";
  const promptValue =
    variant === "carousel"
      ? readObjectField(creativeBrief, "carouselCoverPrompt")
      : variant === "single-image"
        ? readObjectField(creativeBrief, "singleImagePrompt")
        : readObjectField(creativeBrief, "mixedMediaCompositionPrompt");

  const lines = [
    `TITLE: ${draft.title ?? "Untitled social draft"}`,
    `CHANNEL: ${draft.targetChannel ?? "unknown"}`,
    `TOPIC: ${draft.topic?.name ?? "Unassigned"}`,
    `VARIANT: ${variant}`,
    `HOOK: ${draft.hook ?? "No hook recorded."}`,
    `THESIS: ${draft.thesis ?? "No thesis recorded."}`,
    `CTA: ${draft.cta ?? "No CTA recorded."}`,
    "",
    "CREATIVE DIRECTION",
    `Creative direction: ${readObjectField(creativeBrief, "creativeDirection") ?? "No creative direction recorded."}`,
    `Objective: ${readObjectField(creativeBrief, "objective") ?? "No objective recorded."}`,
    `Visual style: ${readObjectField(creativeBrief, "visualStyle") ?? "No visual style recorded."}`,
    `Layout strategy: ${readObjectField(creativeBrief, "layoutStrategy") ?? "No layout strategy recorded."}`,
    `Chart/diagram: ${readObjectField(creativeBrief, "chartOrDiagramType") ?? "No chart direction recorded."}`,
    `Image source strategy: ${readObjectField(creativeBrief, "imageSourceStrategy") ?? "No image-source strategy recorded."}`,
    "",
    "PRIMARY PRODUCTION PROMPT",
    `${promptLabel}: ${promptValue ?? "No dedicated prompt recorded."}`,
    `Master AI image prompt: ${readObjectField(creativeBrief, "aiImagePrompt") ?? "No AI image prompt recorded."}`,
    "",
    variant === "carousel" ? "PANEL PROMPTS" : variant === "single-image" ? "SINGLE-IMAGE SUPPORTING LAYERS" : "MIXED-MEDIA SUPPORTING LAYERS",
    ...readObjectArrayField(creativeBrief, "panelPrompts").map((prompt, index) => `${index + 1}. ${prompt}`),
    "",
    "TEXT HIERARCHY",
    ...readObjectArrayField(creativeBrief, "textHierarchy").map((item, index) => `${index + 1}. ${item}`),
    "",
    "AVOID NOTES",
    ...readObjectArrayField(creativeBrief, "avoidNotes").map((item, index) => `${index + 1}. ${item}`),
    "",
    "APPROVED SUPPORTING STATS",
    ...(supportingStats.length > 0
      ? supportingStats.map(
          (stat, index) =>
            `${index + 1}. ${stat.claim} (${stat.sourceName}${stat.sourceUrl ? ` — ${stat.sourceUrl}` : ""})`
        )
      : ["No approved supporting stats yet."]),
    "",
    "REVIEWED MEDIA REFERENCES",
    ...(mediaCandidates.length > 0
      ? mediaCandidates.map(
          (candidate, index) =>
            `${index + 1}. ${candidate.label} [${candidate.sourceType} / ${candidate.reviewStatus} / ${candidate.usageStatus}]${candidate.originUrl ? ` — ${candidate.originUrl}` : ""}`
        )
      : ["No reviewed media suggestions yet."])
  ];

  return lines.join("\n");
}

function buildDesignerBrief(
  draft: any,
  supportingStats: Array<{ claim: string; sourceName: string; sourceUrl: string | null; reviewStatus: string; plainLanguageAngle?: string }>,
  mediaCandidates: Array<{
    label: string;
    sourceType: string;
    originUrl: string | null;
    reviewStatus: string;
    usageStatus: string;
    licenseLabel?: string | null;
    attributionText?: string | null;
  }>
) {
  const creativeBrief = draft.infographicCreativeBriefJson;
  const lines = [
    `TITLE: ${draft.title ?? "Untitled social draft"}`,
    `CHANNEL: ${draft.targetChannel ?? "unknown"}`,
    `TOPIC: ${draft.topic?.name ?? "Unassigned"}`,
    `FORMAT: ${draft.infographicFormat ?? "Not set"}`,
    `AUDIENCE: ${draft.targetAudience ?? "No audience recorded."}`,
    "",
    "EDITORIAL DIRECTION",
    `Hook: ${draft.hook ?? "No hook recorded."}`,
    `Thesis: ${draft.thesis ?? "No thesis recorded."}`,
    `CTA: ${draft.cta ?? "No CTA recorded."}`,
    `Supporting points: ${formatListInput(draft.supportingPointsJson) || "No supporting points yet."}`,
    "",
    "DESIGN BRIEF",
    `Objective: ${readObjectField(creativeBrief, "objective") ?? "No objective recorded."}`,
    `Creative direction: ${readObjectField(creativeBrief, "creativeDirection") ?? "No creative direction recorded."}`,
    `Visual style: ${readObjectField(creativeBrief, "visualStyle") ?? "No visual style recorded."}`,
    `Layout strategy: ${readObjectField(creativeBrief, "layoutStrategy") ?? "No layout strategy recorded."}`,
    `Chart/diagram: ${readObjectField(creativeBrief, "chartOrDiagramType") ?? "No chart direction recorded."}`,
    `Text hierarchy: ${formatListInput(readObjectArrayField(creativeBrief, "textHierarchy")) || "No hierarchy recorded."}`,
    `Image source strategy: ${readObjectField(creativeBrief, "imageSourceStrategy") ?? "No image-source strategy recorded."}`,
    `Avoid notes: ${formatListInput(readObjectArrayField(creativeBrief, "avoidNotes")) || "No avoid notes recorded."}`,
    "",
    "PANEL / LAYOUT OUTLINE",
    ...readObjectArrayField(creativeBrief, "panelPrompts").map((prompt, index) => `${index + 1}. ${prompt}`),
    ...(readObjectArrayField(creativeBrief, "panelPrompts").length === 0 ? ["No panel prompts recorded."] : []),
    "",
    "APPROVED SUPPORTING STATS",
    ...(supportingStats.length > 0
      ? supportingStats.map(
          (stat, index) =>
            `${index + 1}. ${stat.claim}${stat.plainLanguageAngle ? ` | Angle: ${stat.plainLanguageAngle}` : ""} (${stat.sourceName}${stat.sourceUrl ? ` — ${stat.sourceUrl}` : ""})`
        )
      : ["No approved supporting stats yet."]),
    "",
    "REVIEWED MEDIA REFERENCES",
    ...(mediaCandidates.length > 0
      ? mediaCandidates.map(
          (candidate, index) =>
            `${index + 1}. ${candidate.label} [${candidate.sourceType} / ${candidate.reviewStatus} / ${candidate.usageStatus}]${candidate.licenseLabel ? ` | License: ${candidate.licenseLabel}` : ""}${candidate.attributionText ? ` | Attribution: ${candidate.attributionText}` : ""}${candidate.originUrl ? ` — ${candidate.originUrl}` : ""}`
        )
      : ["No reviewed media suggestions yet."])
  ];

  return lines.join("\n");
}

function buildPromptPackHref(promptPack: string) {
  return `data:text/plain;charset=utf-8,${encodeURIComponent(promptPack)}`;
}

function buildPromptPackFilename(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${slug || "social-draft"}-prompt-pack.txt`;
}

function normalizeDraftStatus(status: string) {
  if (status === "promising" || status === "publish-later") {
    return "enabled";
  }

  if (status === "revisit") {
    return "running";
  }

  if (status === "ignore") {
    return "failed";
  }

  return "idle";
}
