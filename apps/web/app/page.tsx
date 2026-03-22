import { jobNames } from "@bizbrain/core";

import { runPipelineJob } from "./actions";
import { getDashboardData, formatDate, formatSourceAttribution } from "./dashboard-data";
import { EmptyState, StatCard } from "./dashboard-ui";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const dashboard = await getDashboardData();

  return (
    <main className="contentPage">
      <section className="hero">
        <p className="eyebrow">BizBrain</p>
        <h1>Operations</h1>
        <p className="lede">
          This screen is for the shared pipeline jobs and operational checks. The business-idea digest and the social-media
          digest both depend on these upstream jobs, while stream/topic configuration lives on the dedicated admin screens.
        </p>
      </section>

      <section className="statsGrid">
        <StatCard label="Source Configs" value={dashboard.stats.sourceConfigs} />
        <StatCard label="Raw Signals" value={dashboard.stats.rawSignals} />
        <StatCard label="Clusters" value={dashboard.stats.clusters} />
        <StatCard label="Ideas" value={dashboard.stats.ideas} />
      </section>

      <section className="dashboardGrid">
        <article className="card controlCard">
          <div className="cardHeader">
            <h2>Run pipeline jobs</h2>
            <span className="badge">Admin</span>
          </div>
          <div className="jobButtons">
            {jobNames.map((jobName) => (
              <form action={runPipelineJob} key={jobName}>
                <input name="jobName" type="hidden" value={jobName} />
                <button className="jobButton" type="submit">
                  Run {jobName}
                </button>
              </form>
            ))}
          </div>
          <p className="helperText">
            These are the shared operational jobs: ingest and enrich feed both research streams, while the two digest-email
            jobs send the business-opportunity and social-media outputs separately.
          </p>
        </article>

        <article className="card controlCard">
          <div className="cardHeader">
            <h2>Recent job runs</h2>
            <span className="badge">Pipeline</span>
          </div>
          {dashboard.recentJobRuns.length === 0 ? (
            <EmptyState message="No job runs yet. Seed a source config and run the worker jobs to populate this view." />
          ) : (
            <div className="stack">
              {dashboard.recentJobRuns.map((run) => (
                <div className="listRow" key={run.id}>
                  <div>
                    <p className="rowTitle">{run.jobName}</p>
                    <p className="rowMeta">
                      {formatDate(run.startedAt)} · read {run.recordsRead} · wrote {run.recordsWritten}
                    </p>
                  </div>
                  <span className={`status status-${run.runStatus}`}>{run.runStatus}</span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="card cardTall">
          <div className="cardHeader">
            <h2>Top ideas</h2>
            <span className="badge">Review</span>
          </div>
          {dashboard.latestIdeas.length === 0 ? (
            <EmptyState message="Ideas are created when clusters reach the enrich-score stage." />
          ) : (
            <div className="stack">
              {dashboard.latestIdeas.map((idea) => (
                <div className="listRow listRowBlock" key={idea.id}>
                  <div>
                    <p className="rowTitle">{idea.title}</p>
                    <p className="rowMeta">
                      {idea.businessType ?? "Business type pending"} · {idea.category} · quality {idea.qualityScore?.toFixed(1) ?? "n/a"} ·{" "}
                      {idea.status} · updated {formatDate(idea.updatedAt)}
                    </p>
                    <p className="rowBody">{idea.evidenceSummary ?? "No evidence summary yet."}</p>
                    <p className="rowMeta">{idea.qualityReason ?? "Quality explanation pending."}</p>
                    <p className="rowMeta">{formatSourceAttribution(idea.sourceAttributionJson)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="card cardTall">
          <div className="cardHeader">
            <h2>Social drafts</h2>
            <span className="badge">Social</span>
          </div>
          {dashboard.latestContentDrafts.length === 0 ? (
            <EmptyState message="Social drafts will appear after the enrich pipeline syncs content_drafts." />
          ) : (
            <div className="stack">
              {dashboard.latestContentDrafts.map((draft) => (
                <div className="listRow listRowBlock" key={draft.id}>
                  <div>
                    <p className="rowTitle">{draft.title}</p>
                    <p className="rowMeta">
                      {draft.targetChannel} · {draft.topic?.name ?? "No topic"} · {draft.copyFramework?.name ?? "No framework"} ·{" "}
                      {draft.styleProfile?.name ?? "No style"} · quality {draft.qualityScore?.toFixed(1) ?? "n/a"} · {draft.status}
                    </p>
                    <p className="rowBody">{draft.hook ?? draft.thesis ?? "Draft body pending."}</p>
                    <p className="rowMeta">Updated {formatDate(draft.updatedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="card">
          <div className="cardHeader">
            <h2>Digest recipients</h2>
            <span className="badge">Email</span>
          </div>
          {dashboard.digestRecipients.length === 0 ? (
            <EmptyState message="No digest recipients configured yet." />
          ) : (
            <div className="stack">
              {dashboard.digestRecipients.map((recipient) => (
                <div className="listRow" key={recipient.id}>
                  <div>
                    <p className="rowTitle">{recipient.email}</p>
                    <p className="rowMeta">
                      {recipient.researchStream.name} · {recipient.isOwnerDefault ? "Owner default" : "Additional recipient"}
                    </p>
                  </div>
                  <span className={`status status-${recipient.enabled ? "enabled" : "disabled"}`}>
                    {recipient.enabled ? "enabled" : "disabled"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
