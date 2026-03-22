import { db } from "@bizbrain/db";
import { regenerateIdea, runPipelineJob, updateIdeaStatus } from "../actions";
import {
  formatDate,
  formatListInput,
  formatSourceAttribution,
  getDashboardData,
  readSearchParam
} from "../dashboard-data";
import { EmptyState } from "../dashboard-ui";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function IdeasPage({ searchParams }: PageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const dashboard = await getDashboardData();
  const ideas = await getIdeas();
  const query = readSearchParam(resolvedSearchParams, "q");
  const category = readSearchParam(resolvedSearchParams, "category");
  const status = readSearchParam(resolvedSearchParams, "status");
  const streamId = readSearchParam(resolvedSearchParams, "streamId");
  const topicId = readSearchParam(resolvedSearchParams, "topicId");

  const filteredIdeas = ideas.filter((idea) => {
    const matchesQuery =
      !query ||
      [
        idea.title,
        idea.category,
        idea.subcategory ?? "",
        idea.businessType ?? "",
        idea.targetCustomer ?? "",
        idea.problemSummary ?? "",
        idea.solutionConcept ?? "",
        idea.monetizationAngle ?? "",
        idea.evidenceSummary ?? "",
        idea.riskNotes ?? "",
        idea.primaryTopic?.name ?? "",
        idea.researchStream?.name ?? "",
        idea.cluster.title,
        ...idea.cluster.memberships.flatMap((membership) => [
          membership.rawSignal.title ?? "",
          membership.rawSignal.body ?? "",
          membership.rawSignal.authorName ?? "",
          membership.rawSignal.sourceType
        ])
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase());
    const matchesCategory = !category || idea.category === category;
    const matchesStatus = !status || idea.status === status;
    const matchesStream = !streamId || idea.researchStreamId === streamId;
    const matchesTopic = !topicId || idea.primaryTopicId === topicId;

    return matchesQuery && matchesCategory && matchesStatus && matchesStream && matchesTopic;
  });

  const categories = [...new Set(ideas.map((idea) => idea.category).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );
  const streams = dashboard.researchStreams.filter((stream) => stream.slug.includes("research"));

  return (
    <main className="contentPage">
      <section className="hero heroCompact">
        <p className="eyebrow">BizBrain</p>
        <h1>Ideas</h1>
        <p className="lede">
          Review business opportunities here instead of inside the operations page. Filter by stream, topic, category, and
          status, then triage ideas into `promising`, `revisit`, or `ignore`.
        </p>
      </section>

      <section className="dashboardGrid dashboardGridTwoCol">
        <article className="card controlCard">
          <div className="cardHeader">
            <h2>Refresh opportunity ideas</h2>
            <span className="badge">Opportunity</span>
          </div>
          <form action={runPipelineJob}>
            <input name="jobName" type="hidden" value="daily-enrich-score" />
            <button className="jobButton" type="submit">
              Run daily-enrich-score
            </button>
          </form>
          <p className="helperText">
            Opportunity ideas are refreshed by the shared enrich pipeline. Run `daily-enrich-score` after new ingest data or
            topic/config changes.
          </p>
        </article>

        <article className="card cardTall">
          <div className="cardHeader">
            <h2>All ideas</h2>
            <span className="badge">Review</span>
          </div>
          <form className="filterForm filterFormDrafts" method="get">
            <label className="fieldLabel">
              Search ideas
              <input
                className="fieldInput"
                defaultValue={query}
                name="q"
                placeholder="Search title, customer, problem, solution, stream, topic"
                type="text"
              />
            </label>
            <label className="fieldLabel">
              Category
              <select className="fieldInput" defaultValue={category} name="category">
                <option value="">All categories</option>
                {categories.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>
            <label className="fieldLabel">
              Stream
              <select className="fieldInput" defaultValue={streamId} name="streamId">
                <option value="">All streams</option>
                {streams.map((stream) => (
                  <option key={stream.id} value={stream.id}>
                    {stream.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="fieldLabel">
              Topic
              <select className="fieldInput" defaultValue={topicId} name="topicId">
                <option value="">All topics</option>
                {dashboard.topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="fieldLabel">
              Status
              <select className="fieldInput" defaultValue={status} name="status">
                <option value="">All statuses</option>
                <option value="new">new</option>
                <option value="promising">promising</option>
                <option value="revisit">revisit</option>
                <option value="ignore">ignore</option>
              </select>
            </label>
            <button className="jobButton jobButtonSecondary" type="submit">
              Filter ideas
            </button>
          </form>
          <p className="helperText">
            Showing {filteredIdeas.length} of {ideas.length} idea(s).
          </p>
          {ideas.length === 0 ? (
            <EmptyState message="No opportunity ideas exist yet. Run `daily-enrich-score` to generate them." />
          ) : filteredIdeas.length === 0 ? (
            <EmptyState message="No ideas matched the current filters." />
          ) : (
            <div className="stack">
              {filteredIdeas.map((idea) => (
                <details className="adminDisclosure" key={idea.id}>
                  <summary className="adminDisclosureSummary">
                    <div>
                      <p className="rowTitle">{idea.title}</p>
                      <p className="rowMeta">
                        {idea.category}
                        {idea.subcategory ? ` · ${idea.subcategory}` : ""}
                        {idea.businessType ? ` · ${idea.businessType}` : ""}
                        {idea.primaryTopic ? ` · ${idea.primaryTopic.name}` : ""}
                        {idea.researchStream ? ` · ${idea.researchStream.name}` : ""}
                        {idea.qualityScore !== null ? ` · quality ${idea.qualityScore.toFixed(1)}` : ""}
                      </p>
                      <p className="rowMeta">Updated {formatDate(idea.updatedAt)}</p>
                    </div>
                    <span className={`status status-${normalizeIdeaStatus(idea.status)}`}>{idea.status}</span>
                  </summary>
                  <div className="draftDetailGrid">
                    <div className="draftPrimary">
                      <p className="rowBody">
                        <strong>Target customer:</strong> {idea.targetCustomer ?? "No target customer yet."}
                      </p>
                      <p className="rowBody">
                        <strong>Problem:</strong> {idea.problemSummary ?? "No problem summary yet."}
                      </p>
                      <p className="rowBody">
                        <strong>Solution:</strong> {idea.solutionConcept ?? "No solution concept yet."}
                      </p>
                      <p className="rowBody">
                        <strong>Monetization:</strong> {idea.monetizationAngle ?? "No monetization angle yet."}
                      </p>
                      <p className="rowBody">
                        <strong>Evidence:</strong> {idea.evidenceSummary ?? "No evidence summary yet."}
                      </p>
                      <p className="rowBody">
                        <strong>Risks:</strong> {idea.riskNotes ?? "No risk notes yet."}
                      </p>
                      <p className="rowBody">
                        <strong>Validation questions:</strong> {formatListInput(idea.validationQuestionsJson) || "No validation questions yet."}
                      </p>
                      <p className="rowBody">
                        <strong>Cluster:</strong> {idea.cluster.title}
                      </p>
                      <p className="rowBody">
                        <strong>Cluster summary:</strong> {idea.cluster.summary ?? "No cluster summary yet."}
                      </p>
                      <div className="evidenceSection">
                        <p className="rowBody">
                          <strong>Underlying signals:</strong>
                        </p>
                        {idea.cluster.memberships.length === 0 ? (
                          <p className="rowMeta">No raw signals are linked to this cluster yet.</p>
                        ) : (
                          <div className="stack">
                            {idea.cluster.memberships.map((membership) => (
                              <div className="evidenceCard" key={membership.id}>
                                <p className="rowTitle">{membership.rawSignal.title ?? "Untitled signal"}</p>
                                <p className="rowMeta">
                                  {membership.rawSignal.sourceType}
                                  {membership.rawSignal.authorName ? ` · ${membership.rawSignal.authorName}` : ""}
                                  {membership.rawSignal.occurredAt ? ` · ${formatDate(membership.rawSignal.occurredAt)}` : ""}
                                </p>
                                <p className="rowBody">
                                  {summarizeEvidenceText(membership.rawSignal.body ?? "No body text captured.", 220)}
                                </p>
                                {membership.rawSignal.sourceUrl ? (
                                  <p className="rowMeta">
                                    <a href={membership.rawSignal.sourceUrl} rel="noreferrer" target="_blank">
                                      Open source link
                                    </a>
                                  </p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="draftSidebar">
                      <div className="stackCompact">
                        <p className="rowMeta">
                          <strong>Quality reason:</strong> {idea.qualityReason ?? "No quality rationale yet."}
                        </p>
                        <p className="rowMeta">
                          <strong>Source attribution:</strong> {formatSourceAttribution(idea.sourceAttributionJson)}
                        </p>
                        <p className="rowMeta">
                          <strong>Score snapshot:</strong> {formatScoreSnapshot(idea.scoreSnapshot)}
                        </p>
                      </div>
                      <div className="jobButtons">
                        <form action={regenerateIdea}>
                          <input name="id" type="hidden" value={idea.id} />
                          <button className="jobButton" type="submit">
                            Regenerate
                          </button>
                        </form>
                        {[
                          ["promising", "Promising"],
                          ["revisit", "Revisit"],
                          ["ignore", "Ignore"],
                          ["new", "Reset"]
                        ].map(([nextStatus, label]) => (
                          <form action={updateIdeaStatus} key={nextStatus}>
                            <input name="id" type="hidden" value={idea.id} />
                            <input name="status" type="hidden" value={nextStatus} />
                            <button className="jobButton jobButtonSecondary" type="submit">
                              {label}
                            </button>
                          </form>
                        ))}
                      </div>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}

async function getIdeas() {
  return db.idea.findMany({
    orderBy: [{ qualityScore: "desc" }, { updatedAt: "desc" }],
    include: {
      researchStream: true,
      primaryTopic: true,
      cluster: {
        include: {
          memberships: {
            orderBy: { createdAt: "desc" },
            take: 4,
            include: {
              rawSignal: {
                select: {
                  id: true,
                  sourceType: true,
                  sourceUrl: true,
                  title: true,
                  body: true,
                  authorName: true,
                  occurredAt: true
                }
              }
            }
          }
        }
      }
    }
  });
}

function formatScoreSnapshot(value: unknown) {
  if (!value || typeof value !== "object") {
    return "No score snapshot yet.";
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => typeof entry === "number")
    .map(([key, entry]) => `${key}: ${Number(entry).toFixed(2)}`);

  return entries.length > 0 ? entries.join(" · ") : "No score snapshot yet.";
}

function normalizeIdeaStatus(status: string) {
  if (status === "ignore") {
    return "failed";
  }

  if (status === "promising") {
    return "enabled";
  }

  if (status === "revisit") {
    return "running";
  }

  return "skipped";
}

function summarizeEvidenceText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const clipped = normalized.slice(0, maxLength);
  const boundary = Math.max(clipped.lastIndexOf(". "), clipped.lastIndexOf("; "), clipped.lastIndexOf(", "));
  return `${(boundary > 80 ? clipped.slice(0, boundary) : clipped).trim()}...`;
}
