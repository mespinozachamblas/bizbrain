import { jobNames } from "@bizbrain/core";
import Link from "next/link";
import { formatChannelInput, formatDate, getDashboardData } from "../dashboard-data";
import { EmptyState, StatCard } from "../dashboard-ui";

export const dynamic = "force-dynamic";

const jobDefinitions: Record<
  string,
  {
    role: string;
    scope: string;
    output: string;
    scheduleOwner: string;
  }
> = {
  "daily-ingest": {
    role: "Shared upstream job",
    scope: "Reads enabled source configs and writes raw signals plus per-source run records.",
    output: "Feeds both opportunity and social-media research.",
    scheduleOwner: "Railway cron service"
  },
  "daily-enrich-score": {
    role: "Shared upstream job",
    scope: "Enriches raw signals, updates clusters, ideas, and social content drafts.",
    output: "Feeds both downstream digest jobs.",
    scheduleOwner: "Railway cron service"
  },
  "daily-digest-email": {
    role: "Output job",
    scope: "Builds and sends the opportunity-research digest.",
    output: "Business opportunity email stream.",
    scheduleOwner: "Railway cron service"
  },
  "daily-social-media-digest-email": {
    role: "Output job",
    scope: "Builds and sends the social-media-research digest.",
    output: "LinkedIn/X research email stream.",
    scheduleOwner: "Railway cron service"
  },
  "weekly-maintenance": {
    role: "Maintenance job",
    scope: "Runs periodic cleanup and maintenance tasks.",
    output: "Operational hygiene only.",
    scheduleOwner: "Railway cron service"
  }
};

export default async function JobsPage() {
  const dashboard = await getDashboardData();
  const primaryStreams = dashboard.researchStreams.filter(
    (stream) => stream.slug === "opportunity-research" || stream.slug === "social-media-research"
  );

  return (
    <main className="contentPage">
      <section className="hero heroCompact">
        <p className="eyebrow">BizBrain</p>
        <h1>Jobs</h1>
        <p className="lede">
          This screen explains the job model. Jobs are the runnable pipeline units. Research streams and topics are configuration
          lanes that shape what those jobs produce, but they are not separate cron jobs by themselves.
        </p>
      </section>

      <section className="statsGrid">
        <StatCard label="Defined Jobs" value={jobNames.length} />
        <StatCard label="Recent Job Runs" value={dashboard.recentJobRuns.length} />
        <StatCard label="Research Streams" value={dashboard.researchStreams.length} />
        <StatCard label="Configured Topics" value={dashboard.topics.length} />
      </section>

      <section className="dashboardGrid dashboardGridTwoCol">
        <article className="card controlCard">
          <div className="cardHeader">
            <h2>How to read this</h2>
            <span className="badge">Model</span>
          </div>
          <div className="stack">
            <p className="rowBody">
              <strong>Operations</strong> is the execution console. Use it when you want to manually run a job or inspect recent
              pipeline activity.
            </p>
            <p className="rowBody">
              <strong>Jobs</strong> explains what each runnable job does and which stream it feeds.
            </p>
            <p className="rowBody">
              <strong>Research Streams</strong> and <strong>Topics</strong> only shape output selection, framing, channels, and
              recipients. They do not create their own cron jobs automatically.
            </p>
            <p className="rowBody">
              The actual schedule source of truth for job execution is Railway. Stream-level schedule fields are planning metadata
              unless a matching cron service exists.
            </p>
            <p className="rowMeta">
              Need to run something now? Go back to <Link href="/">Operations</Link>.
            </p>
          </div>
        </article>

        <article className="card cardTall">
          <div className="cardHeader">
            <h2>Runnable jobs</h2>
            <span className="badge">Execution</span>
          </div>
          <div className="stack">
            {jobNames.map((jobName) => {
              const definition = jobDefinitions[jobName];
              const latestRun = dashboard.recentJobRuns.find((run) => run.jobName === jobName) ?? null;

              return (
                <div className="evidenceCard" key={jobName}>
                  <p className="rowTitle">{jobName}</p>
                  <p className="rowMeta">
                    {definition?.role ?? "Pipeline job"} · schedule owner {definition?.scheduleOwner ?? "Railway cron service"}
                  </p>
                  <p className="rowBody">
                    <strong>Scope:</strong> {definition?.scope ?? "No scope description yet."}
                  </p>
                  <p className="rowBody">
                    <strong>Feeds:</strong> {definition?.output ?? "No output mapping yet."}
                  </p>
                  <p className="rowMeta">
                    {latestRun
                      ? `Latest run: ${formatDate(latestRun.startedAt)} · ${latestRun.runStatus} · read ${latestRun.recordsRead} · wrote ${latestRun.recordsWritten}`
                      : "No recorded run yet."}
                  </p>
                </div>
              );
            })}
          </div>
        </article>

        <article className="card cardTall">
          <div className="cardHeader">
            <h2>Primary output streams</h2>
            <span className="badge">Routing</span>
          </div>
          {primaryStreams.length === 0 ? (
            <EmptyState message="Primary research streams are not configured yet." />
          ) : (
            <div className="stack">
              {primaryStreams.map((stream) => (
                <div className="evidenceCard" key={stream.id}>
                  <p className="rowTitle">{stream.name}</p>
                  <p className="rowMeta">
                    {stream.slug} · {formatChannelInput(stream.enabledChannelsJson) || "no channels"} · {stream.deliveryType}
                  </p>
                  <p className="rowBody">{stream.description ?? "No description yet."}</p>
                  <p className="rowBody">
                    <strong>Configured cadence:</strong> {stream.scheduleCron ?? "No cadence set in stream metadata."}
                  </p>
                  <p className="rowMeta">
                    {stream.slug === "opportunity-research"
                      ? "Executed by `daily-digest-email` after the shared ingest/enrich pipeline."
                      : "Executed by `daily-social-media-digest-email` after the shared ingest/enrich pipeline."}
                  </p>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="card">
          <div className="cardHeader">
            <h2>Recent pipeline history</h2>
            <span className="badge">Runs</span>
          </div>
          {dashboard.recentJobRuns.length === 0 ? (
            <EmptyState message="No job runs have been recorded yet." />
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
      </section>
    </main>
  );
}
