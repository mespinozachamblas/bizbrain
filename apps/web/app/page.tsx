import { db } from "@bizbrain/db";

type DashboardData = {
  stats: {
    sourceConfigs: number;
    rawSignals: number;
    clusters: number;
    ideas: number;
  };
  recentJobRuns: Array<{
    id: string;
    jobName: string;
    runStatus: string;
    startedAt: Date;
    recordsRead: number;
    recordsWritten: number;
  }>;
  topClusters: Array<{
    id: string;
    title: string;
    primaryCategory: string | null;
    signalCount: number;
    scoreTotal: number;
    summary: string | null;
  }>;
  latestIdeas: Array<{
    id: string;
    title: string;
    category: string;
    status: string;
    updatedAt: Date;
    evidenceSummary: string | null;
  }>;
  digestRecipients: Array<{
    id: string;
    email: string;
    enabled: boolean;
    isOwnerDefault: boolean;
  }>;
};

export default async function HomePage() {
  const dashboard = await getDashboardData();

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">BizBrain</p>
        <h1>Opportunity discovery dashboard</h1>
        <p className="lede">
          The pipeline is now wired through Postgres-backed workers. This dashboard surfaces the current
          ingest, enrichment, clustering, and idea state.
        </p>
      </section>

      <section className="statsGrid">
        <StatCard label="Source Configs" value={dashboard.stats.sourceConfigs} />
        <StatCard label="Raw Signals" value={dashboard.stats.rawSignals} />
        <StatCard label="Clusters" value={dashboard.stats.clusters} />
        <StatCard label="Ideas" value={dashboard.stats.ideas} />
      </section>

      <section className="dashboardGrid">
        <article className="card cardTall">
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
            <h2>Top clusters</h2>
            <span className="badge">Discovery</span>
          </div>
          {dashboard.topClusters.length === 0 ? (
            <EmptyState message="Clusters will appear after `daily-enrich-score` processes ingested signals." />
          ) : (
            <div className="stack">
              {dashboard.topClusters.map((cluster) => (
                <div className="listRow listRowBlock" key={cluster.id}>
                  <div>
                    <p className="rowTitle">{cluster.title}</p>
                    <p className="rowMeta">
                      {cluster.primaryCategory ?? "general"} · {cluster.signalCount} signal(s) · score{" "}
                      {cluster.scoreTotal.toFixed(1)}
                    </p>
                    <p className="rowBody">{cluster.summary ?? "No summary yet."}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="card cardTall">
          <div className="cardHeader">
            <h2>Latest ideas</h2>
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
                      {idea.category} · {idea.status} · updated {formatDate(idea.updatedAt)}
                    </p>
                    <p className="rowBody">{idea.evidenceSummary ?? "No evidence summary yet."}</p>
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
                    <p className="rowMeta">{recipient.isOwnerDefault ? "Owner default" : "Additional recipient"}</p>
                  </div>
                  <span className={`status status-${recipient.enabled ? "enabled" : "disabled"}`}>
                    {recipient.enabled ? "enabled" : "disabled"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="card">
          <div className="cardHeader">
            <h2>Next build steps</h2>
            <span className="badge">Roadmap</span>
          </div>
          <ul className="roadmap">
            <li>Seed at least one `source_config` so the ingest worker has a target.</li>
            <li>Replace sample adapters with real source integrations.</li>
            <li>Expose job re-run and source health actions through admin routes.</li>
            <li>Swap deterministic idea generation for schema-validated model output.</li>
          </ul>
        </article>
      </section>
    </main>
  );
}

async function getDashboardData(): Promise<DashboardData> {
  if (!process.env.DATABASE_URL) {
    return emptyDashboardData();
  }

  try {
    const [sourceConfigs, rawSignals, clusters, ideas, recentJobRuns, topClusters, latestIdeas, digestRecipients] =
      await Promise.all([
        db.sourceConfig.count(),
        db.rawSignal.count(),
        db.trendCluster.count(),
        db.idea.count(),
        db.jobRun.findMany({
          orderBy: { startedAt: "desc" },
          take: 6
        }),
        db.trendCluster.findMany({
          orderBy: [{ scoreTotal: "desc" }, { updatedAt: "desc" }],
          take: 5
        }),
        db.idea.findMany({
          orderBy: { updatedAt: "desc" },
          take: 5
        }),
        db.digestRecipient.findMany({
          orderBy: [{ isOwnerDefault: "desc" }, { email: "asc" }]
        })
      ]);

    return {
      stats: {
        sourceConfigs,
        rawSignals,
        clusters,
        ideas
      },
      recentJobRuns,
      topClusters,
      latestIdeas,
      digestRecipients
    };
  } catch (error) {
    console.error("Failed to load dashboard data", error);

    return {
      ...emptyDashboardData()
    };
  }
}

function emptyDashboardData(): DashboardData {
  return {
    stats: {
      sourceConfigs: 0,
      rawSignals: 0,
      clusters: 0,
      ideas: 0
    },
    recentJobRuns: [],
    topClusters: [],
    latestIdeas: [],
    digestRecipients: []
  };
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="statCard">
      <p className="statLabel">{label}</p>
      <p className="statValue">{value}</p>
    </article>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="emptyState">{message}</p>;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}
