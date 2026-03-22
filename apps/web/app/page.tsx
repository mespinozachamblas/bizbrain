import { jobNames } from "@bizbrain/core";
import { db } from "@bizbrain/db";
export const dynamic = "force-dynamic";

import {
  createCopyFramework,
  createResearchStream,
  createStyleProfile,
  createTopic,
  runPipelineJob,
  runSourceCheck,
  updateCopyFramework,
  updateResearchStream,
  updateStyleProfile,
  updateTopic
} from "./actions";

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
    businessType: string | null;
    qualityScore: number | null;
    qualityReason: string | null;
    status: string;
    updatedAt: Date;
    evidenceSummary: string | null;
    sourceAttributionJson: unknown;
  }>;
  digestRecipients: Array<{
    id: string;
    researchStream: {
      slug: string;
      name: string;
    };
    email: string;
    enabled: boolean;
    isOwnerDefault: boolean;
  }>;
  sourceConfigs: Array<{
    id: string;
    sourceType: string;
    enabled: boolean;
  }>;
  researchStreams: Array<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    enabled: boolean;
    deliveryType: string;
    scheduleCron: string | null;
    defaultAssetMode: string | null;
    enabledChannelsJson: unknown;
  }>;
  topics: Array<{
    id: string;
    researchStreamId: string;
    slug: string;
    name: string;
    description: string | null;
    enabled: boolean;
    defaultAssetMode: string | null;
    defaultCopyFrameworkId: string | null;
    defaultStyleProfileId: string | null;
    enabledChannelsJson: unknown;
    keywordsJson: unknown;
    exclusionsJson: unknown;
    sourcePreferencesJson: unknown;
    researchStream: {
      id: string;
      name: string;
      slug: string;
    };
  }>;
  copyFrameworks: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    enabled: boolean;
    structureJson: unknown;
  }>;
  styleProfiles: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    inspirationSummary: string | null;
    enabled: boolean;
    styleTraitsJson: unknown;
    guardrailsJson: unknown;
  }>;
  latestContentDrafts: Array<{
    id: string;
    title: string;
    targetChannel: string;
    status: string;
    qualityScore: number | null;
    hook: string | null;
    thesis: string | null;
    updatedAt: Date;
    topic: {
      name: string;
    } | null;
    copyFramework: {
      name: string;
    } | null;
    styleProfile: {
      name: string;
    } | null;
  }>;
  recentSourceRuns: Array<{
    id: string;
    runStatus: string;
    recordsRead: number;
    recordsWritten: number;
    startedAt: Date;
    sourceConfig: {
      sourceType: string;
    };
  }>;
  recentHealthChecks: Array<{
    id: string;
    checkType: string;
    checkStatus: string;
    checkedAt: Date;
    responseSummary: string | null;
    sourceConfig: {
      sourceType: string;
    };
  }>;
};

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const dashboard = await getDashboardData();
  const streamQuery = readSearchParam(resolvedSearchParams, "streamQuery");
  const topicQuery = readSearchParam(resolvedSearchParams, "topicQuery");
  const topicStreamId = readSearchParam(resolvedSearchParams, "topicStreamId");
  const filteredResearchStreams = dashboard.researchStreams.filter((stream) => matchesStreamSearch(stream, streamQuery));
  const filteredTopics = dashboard.topics.filter(
    (topic) => matchesTopicSearch(topic, topicQuery) && (!topicStreamId || topic.researchStreamId === topicStreamId)
  );

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

      <section className="controlStrip">
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
            Jobs run in-process from the web app for local development. Production should still execute them via
            Railway cron.
          </p>
        </article>

        <article className="card controlCard">
          <div className="cardHeader">
            <h2>Test source health</h2>
            <span className="badge">Checks</span>
          </div>
          {dashboard.sourceConfigs.length === 0 ? (
            <EmptyState message="No source configs available to test yet." />
          ) : (
            <div className="jobButtons">
              {dashboard.sourceConfigs.map((sourceConfig) => (
                <form action={runSourceCheck} key={sourceConfig.id}>
                  <input name="sourceConfigId" type="hidden" value={sourceConfig.id} />
                  <button className="jobButton jobButtonSecondary" type="submit">
                    Test {sourceConfig.sourceType}
                  </button>
                </form>
              ))}
            </div>
          )}
          <p className="helperText">Each test writes a `source_health_checks` record for later review.</p>
        </article>

        <article className="card controlCard">
          <div className="cardHeader">
            <h2>Create research stream</h2>
            <span className="badge">Config</span>
          </div>
          <form action={createResearchStream} className="adminForm">
            <label className="fieldLabel">
              Name
              <input className="fieldInput" name="name" placeholder="Social Media Research" required type="text" />
            </label>
            <label className="fieldLabel">
              Slug
              <input className="fieldInput" name="slug" placeholder="social-media-research" type="text" />
            </label>
            <label className="fieldLabel fieldLabelWide">
              Description
              <textarea
                className="fieldTextarea"
                name="description"
                placeholder="Research-backed drafts for social channels."
                rows={3}
              />
            </label>
            <label className="fieldLabel">
              Channels
              <input className="fieldInput" defaultValue="email" name="enabledChannels" placeholder="email, linkedin, x" type="text" />
            </label>
            <label className="fieldLabel">
              Schedule
              <input className="fieldInput" name="scheduleCron" placeholder="50 06 * * *" type="text" />
            </label>
            <label className="fieldLabel">
              Asset mode
              <input className="fieldInput" defaultValue="none" name="defaultAssetMode" placeholder="none" type="text" />
            </label>
            <label className="fieldLabel">
              Delivery type
              <input className="fieldInput" defaultValue="email" name="deliveryType" placeholder="email" type="text" />
            </label>
            <label className="fieldCheckbox">
              <input defaultChecked name="enabled" type="checkbox" />
              Enabled
            </label>
            <button className="jobButton" type="submit">
              Create stream
            </button>
          </form>
        </article>

        <article className="card controlCard">
          <div className="cardHeader">
            <h2>Create topic</h2>
            <span className="badge">Topics</span>
          </div>
          <form action={createTopic} className="adminForm">
            <label className="fieldLabel">
              Research stream
              <select className="fieldInput" defaultValue={dashboard.researchStreams[0]?.id ?? ""} name="researchStreamId" required>
                {dashboard.researchStreams.map((stream) => (
                  <option key={stream.id} value={stream.id}>
                    {stream.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="fieldLabel">
              Name
              <input className="fieldInput" name="name" placeholder="Mortgage underwriting friction" required type="text" />
            </label>
            <label className="fieldLabel">
              Slug
              <input className="fieldInput" name="slug" placeholder="mortgage-underwriting-friction" type="text" />
            </label>
            <label className="fieldLabel">
              Channels
              <input className="fieldInput" defaultValue="email" name="enabledChannels" placeholder="email, linkedin, x" type="text" />
            </label>
            <label className="fieldLabel fieldLabelWide">
              Description
              <textarea
                className="fieldTextarea"
                name="description"
                placeholder="Signals and content angles around underwriting delays, occupancy rules, and borrower confusion."
                rows={3}
              />
            </label>
            <label className="fieldLabel fieldLabelWide">
              Keywords
              <input className="fieldInput" name="keywords" placeholder="mortgage, underwriting, occupancy, seasoning" type="text" />
            </label>
            <label className="fieldLabel fieldLabelWide">
              Exclusions
              <input className="fieldInput" name="exclusions" placeholder="job post, giveaway, promo" type="text" />
            </label>
            <label className="fieldLabel fieldLabelWide">
              Source preferences
              <input className="fieldInput" name="sourcePreferences" placeholder="reddit, hacker-news, product-hunt" type="text" />
            </label>
            <label className="fieldLabel">
              Default framework
              <select className="fieldInput" defaultValue="" name="defaultCopyFrameworkId">
                <option value="">Use stream default</option>
                {dashboard.copyFrameworks.map((framework) => (
                  <option key={framework.id} value={framework.id}>
                    {framework.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="fieldLabel">
              Default style
              <select className="fieldInput" defaultValue="" name="defaultStyleProfileId">
                <option value="">Use stream default</option>
                {dashboard.styleProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="fieldLabel">
              Asset mode
              <input className="fieldInput" defaultValue="none" name="defaultAssetMode" placeholder="none" type="text" />
            </label>
            <label className="fieldCheckbox">
              <input defaultChecked name="enabled" type="checkbox" />
              Enabled
            </label>
            <button className="jobButton" disabled={dashboard.researchStreams.length === 0} type="submit">
              Create topic
            </button>
          </form>
          <p className="helperText">
            Topics steer source matching, social outputs, and future draft generation. Configure them before adding more
            stream-specific automation.
          </p>
        </article>

        <article className="card controlCard">
          <div className="cardHeader">
            <h2>Create copy framework</h2>
            <span className="badge">Messaging</span>
          </div>
          <form action={createCopyFramework} className="adminForm">
            <label className="fieldLabel">
              Name
              <input className="fieldInput" name="name" placeholder="AIDA" required type="text" />
            </label>
            <label className="fieldLabel">
              Slug
              <input className="fieldInput" name="slug" placeholder="aida" type="text" />
            </label>
            <label className="fieldLabel fieldLabelWide">
              Description
              <textarea
                className="fieldTextarea"
                name="description"
                placeholder="Attention, interest, desire, action sequence for social and email hooks."
                rows={3}
              />
            </label>
            <label className="fieldLabel fieldLabelWide">
              Structure
              <input className="fieldInput" name="structure" placeholder="attention, interest, desire, action" type="text" />
            </label>
            <label className="fieldCheckbox">
              <input defaultChecked name="enabled" type="checkbox" />
              Enabled
            </label>
            <button className="jobButton" type="submit">
              Create framework
            </button>
          </form>
        </article>

        <article className="card controlCard">
          <div className="cardHeader">
            <h2>Create style profile</h2>
            <span className="badge">Voice</span>
          </div>
          <form action={createStyleProfile} className="adminForm">
            <label className="fieldLabel">
              Name
              <input className="fieldInput" name="name" placeholder="Founder educator" required type="text" />
            </label>
            <label className="fieldLabel">
              Slug
              <input className="fieldInput" name="slug" placeholder="founder-educator" type="text" />
            </label>
            <label className="fieldLabel fieldLabelWide">
              Description
              <textarea
                className="fieldTextarea"
                name="description"
                placeholder="Plainspoken operator voice with clear lessons and light persuasion."
                rows={3}
              />
            </label>
            <label className="fieldLabel fieldLabelWide">
              Inspiration summary
              <textarea
                className="fieldTextarea"
                name="inspirationSummary"
                placeholder="Direct-response clarity mixed with practical founder education."
                rows={2}
              />
            </label>
            <label className="fieldLabel fieldLabelWide">
              Style traits
              <input className="fieldInput" name="styleTraits" placeholder="direct, concrete, story-led, persuasive" type="text" />
            </label>
            <label className="fieldLabel fieldLabelWide">
              Guardrails
              <input className="fieldInput" name="guardrails" placeholder="no hype, no fake urgency, no impersonation" type="text" />
            </label>
            <label className="fieldCheckbox">
              <input defaultChecked name="enabled" type="checkbox" />
              Enabled
            </label>
            <button className="jobButton" type="submit">
              Create style
            </button>
          </form>
        </article>
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
                      {idea.businessType ?? "Business type pending"} · {idea.category} · quality{" "}
                      {idea.qualityScore?.toFixed(1) ?? "n/a"} · {idea.status} · updated {formatDate(idea.updatedAt)}
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
            <h2>Recent source runs</h2>
            <span className="badge">Sources</span>
          </div>
          {dashboard.recentSourceRuns.length === 0 ? (
            <EmptyState message="Per-source run results will appear after you run `daily-ingest`." />
          ) : (
            <div className="stack">
              {dashboard.recentSourceRuns.map((run) => (
                <div className="listRow" key={run.id}>
                  <div>
                    <p className="rowTitle">{run.sourceConfig.sourceType}</p>
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

        <article className="card">
          <div className="cardHeader">
            <h2>Recent source health</h2>
            <span className="badge">Checks</span>
          </div>
          {dashboard.recentHealthChecks.length === 0 ? (
            <EmptyState message="Health checks will appear once source validation is wired." />
          ) : (
            <div className="stack">
              {dashboard.recentHealthChecks.map((check) => (
                <div className="listRow listRowBlock" key={check.id}>
                  <div>
                    <p className="rowTitle">
                      {check.sourceConfig.sourceType} · {check.checkType}
                    </p>
                    <p className="rowMeta">{formatDate(check.checkedAt)}</p>
                    <p className="rowBody">{check.responseSummary ?? "No response summary captured."}</p>
                  </div>
                  <span className={`status status-${normalizeStatus(check.checkStatus)}`}>{check.checkStatus}</span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="card">
          <div className="cardHeader">
            <h2>Research streams</h2>
            <span className="badge">Admin</span>
          </div>
          <form className="filterForm" method="get">
            <label className="fieldLabel">
              Search streams
              <input className="fieldInput" defaultValue={streamQuery} name="streamQuery" placeholder="Search by name, slug, or description" type="text" />
            </label>
            <button className="jobButton jobButtonSecondary" type="submit">
              Filter streams
            </button>
          </form>
          <p className="helperText">
            Showing {filteredResearchStreams.length} of {dashboard.researchStreams.length} research stream(s).
          </p>
          {dashboard.researchStreams.length === 0 ? (
            <EmptyState message="No research streams are configured yet." />
          ) : filteredResearchStreams.length === 0 ? (
            <EmptyState message="No research streams matched the current filter." />
          ) : (
            <div className="stack">
              {filteredResearchStreams.map((stream) => (
                <details className="adminDisclosure" key={stream.id}>
                  <summary className="adminDisclosureSummary">
                    <div>
                      <p className="rowTitle">{stream.name}</p>
                      <p className="rowMeta">
                        {stream.slug} · {formatChannelInput(stream.enabledChannelsJson)} · {stream.scheduleCron ?? "No schedule"} ·{" "}
                        {stream.enabled ? "enabled" : "disabled"}
                      </p>
                    </div>
                    <span className="status status-skipped">Edit</span>
                  </summary>
                  <form action={updateResearchStream} className="adminForm adminFormCompact">
                    <input name="id" type="hidden" value={stream.id} />
                    <label className="fieldLabel">
                      Name
                      <input className="fieldInput" defaultValue={stream.name} name="name" required type="text" />
                    </label>
                    <label className="fieldLabel">
                      Slug
                      <input className="fieldInput" defaultValue={stream.slug} name="slug" required type="text" />
                    </label>
                    <label className="fieldLabel fieldLabelWide">
                      Description
                      <textarea className="fieldTextarea" defaultValue={stream.description ?? ""} name="description" rows={2} />
                    </label>
                    <label className="fieldLabel">
                      Channels
                      <input
                        className="fieldInput"
                        defaultValue={formatChannelInput(stream.enabledChannelsJson)}
                        name="enabledChannels"
                        type="text"
                      />
                    </label>
                    <label className="fieldLabel">
                      Schedule
                      <input className="fieldInput" defaultValue={stream.scheduleCron ?? ""} name="scheduleCron" type="text" />
                    </label>
                    <label className="fieldLabel">
                      Asset mode
                      <input className="fieldInput" defaultValue={stream.defaultAssetMode ?? ""} name="defaultAssetMode" type="text" />
                    </label>
                    <label className="fieldLabel">
                      Delivery type
                      <input className="fieldInput" defaultValue={stream.deliveryType} name="deliveryType" type="text" />
                    </label>
                    <label className="fieldCheckbox">
                      <input defaultChecked={stream.enabled} name="enabled" type="checkbox" />
                      Enabled
                    </label>
                    <button className="jobButton jobButtonSecondary" type="submit">
                      Save stream
                    </button>
                  </form>
                </details>
              ))}
            </div>
          )}
        </article>

        <article className="card cardTall">
          <div className="cardHeader">
            <h2>Topics</h2>
            <span className="badge">Config</span>
          </div>
          <form className="filterForm filterFormWide" method="get">
            <label className="fieldLabel">
              Search topics
              <input className="fieldInput" defaultValue={topicQuery} name="topicQuery" placeholder="Search topic name, slug, keywords, or description" type="text" />
            </label>
            <label className="fieldLabel">
              Filter by stream
              <select className="fieldInput" defaultValue={topicStreamId} name="topicStreamId">
                <option value="">All streams</option>
                {dashboard.researchStreams.map((stream) => (
                  <option key={stream.id} value={stream.id}>
                    {stream.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="jobButton jobButtonSecondary" type="submit">
              Filter topics
            </button>
          </form>
          <p className="helperText">
            Showing {filteredTopics.length} of {dashboard.topics.length} topic(s).
          </p>
          {dashboard.topics.length === 0 ? (
            <EmptyState message="No topics are configured yet." />
          ) : filteredTopics.length === 0 ? (
            <EmptyState message="No topics matched the current filters." />
          ) : (
            <div className="stack">
              {filteredTopics.map((topic) => (
                <details className="adminDisclosure" key={topic.id}>
                  <summary className="adminDisclosureSummary">
                    <div>
                      <p className="rowTitle">{topic.name}</p>
                      <p className="rowMeta">
                        {topic.researchStream.name} · {topic.slug} · {formatListInput(topic.enabledChannelsJson) || "No channels"} ·{" "}
                        {topic.enabled ? "enabled" : "disabled"}
                      </p>
                    </div>
                    <span className="status status-skipped">Edit</span>
                  </summary>
                  <form action={updateTopic} className="adminForm adminFormCompact">
                    <input name="id" type="hidden" value={topic.id} />
                    <label className="fieldLabel">
                      Research stream
                      <select className="fieldInput" defaultValue={topic.researchStreamId} name="researchStreamId" required>
                        {dashboard.researchStreams.map((stream) => (
                          <option key={stream.id} value={stream.id}>
                            {stream.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="fieldLabel">
                      Name
                      <input className="fieldInput" defaultValue={topic.name} name="name" required type="text" />
                    </label>
                    <label className="fieldLabel">
                      Slug
                      <input className="fieldInput" defaultValue={topic.slug} name="slug" required type="text" />
                    </label>
                    <label className="fieldLabel">
                      Channels
                      <input className="fieldInput" defaultValue={formatListInput(topic.enabledChannelsJson)} name="enabledChannels" type="text" />
                    </label>
                    <label className="fieldLabel fieldLabelWide">
                      Description
                      <textarea className="fieldTextarea" defaultValue={topic.description ?? ""} name="description" rows={2} />
                    </label>
                    <label className="fieldLabel fieldLabelWide">
                      Keywords
                      <input className="fieldInput" defaultValue={formatListInput(topic.keywordsJson)} name="keywords" type="text" />
                    </label>
                    <label className="fieldLabel fieldLabelWide">
                      Exclusions
                      <input className="fieldInput" defaultValue={formatListInput(topic.exclusionsJson)} name="exclusions" type="text" />
                    </label>
                    <label className="fieldLabel fieldLabelWide">
                      Source preferences
                      <input
                        className="fieldInput"
                        defaultValue={formatListInput(topic.sourcePreferencesJson)}
                        name="sourcePreferences"
                        type="text"
                      />
                    </label>
                    <label className="fieldLabel">
                      Default framework
                      <select className="fieldInput" defaultValue={topic.defaultCopyFrameworkId ?? ""} name="defaultCopyFrameworkId">
                        <option value="">Use stream default</option>
                        {dashboard.copyFrameworks.map((framework) => (
                          <option key={framework.id} value={framework.id}>
                            {framework.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="fieldLabel">
                      Default style
                      <select className="fieldInput" defaultValue={topic.defaultStyleProfileId ?? ""} name="defaultStyleProfileId">
                        <option value="">Use stream default</option>
                        {dashboard.styleProfiles.map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {profile.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="fieldLabel">
                      Asset mode
                      <input className="fieldInput" defaultValue={topic.defaultAssetMode ?? ""} name="defaultAssetMode" type="text" />
                    </label>
                    <label className="fieldCheckbox">
                      <input defaultChecked={topic.enabled} name="enabled" type="checkbox" />
                      Enabled
                    </label>
                    <p className="rowMeta topicMeta">
                      Stream: {topic.researchStream.name} ({topic.researchStream.slug})
                    </p>
                    <button className="jobButton jobButtonSecondary" type="submit">
                      Save topic
                    </button>
                  </form>
                </details>
              ))}
            </div>
          )}
        </article>

        <article className="card cardTall">
          <div className="cardHeader">
            <h2>Copy frameworks</h2>
            <span className="badge">Messaging</span>
          </div>
          {dashboard.copyFrameworks.length === 0 ? (
            <EmptyState message="No copy frameworks are configured yet." />
          ) : (
            <div className="stack">
              {dashboard.copyFrameworks.map((framework) => (
                <form action={updateCopyFramework} className="adminForm adminFormCompact" key={framework.id}>
                  <input name="id" type="hidden" value={framework.id} />
                  <label className="fieldLabel">
                    Name
                    <input className="fieldInput" defaultValue={framework.name} name="name" required type="text" />
                  </label>
                  <label className="fieldLabel">
                    Slug
                    <input className="fieldInput" defaultValue={framework.slug} name="slug" required type="text" />
                  </label>
                  <label className="fieldLabel fieldLabelWide">
                    Description
                    <textarea className="fieldTextarea" defaultValue={framework.description ?? ""} name="description" rows={2} />
                  </label>
                  <label className="fieldLabel fieldLabelWide">
                    Structure
                    <input className="fieldInput" defaultValue={formatListInput(framework.structureJson)} name="structure" type="text" />
                  </label>
                  <label className="fieldCheckbox">
                    <input defaultChecked={framework.enabled} name="enabled" type="checkbox" />
                    Enabled
                  </label>
                  <button className="jobButton jobButtonSecondary" type="submit">
                    Save framework
                  </button>
                </form>
              ))}
            </div>
          )}
        </article>

        <article className="card cardTall">
          <div className="cardHeader">
            <h2>Style profiles</h2>
            <span className="badge">Voice</span>
          </div>
          {dashboard.styleProfiles.length === 0 ? (
            <EmptyState message="No style profiles are configured yet." />
          ) : (
            <div className="stack">
              {dashboard.styleProfiles.map((profile) => (
                <form action={updateStyleProfile} className="adminForm adminFormCompact" key={profile.id}>
                  <input name="id" type="hidden" value={profile.id} />
                  <label className="fieldLabel">
                    Name
                    <input className="fieldInput" defaultValue={profile.name} name="name" required type="text" />
                  </label>
                  <label className="fieldLabel">
                    Slug
                    <input className="fieldInput" defaultValue={profile.slug} name="slug" required type="text" />
                  </label>
                  <label className="fieldLabel fieldLabelWide">
                    Description
                    <textarea className="fieldTextarea" defaultValue={profile.description ?? ""} name="description" rows={2} />
                  </label>
                  <label className="fieldLabel fieldLabelWide">
                    Inspiration summary
                    <textarea
                      className="fieldTextarea"
                      defaultValue={profile.inspirationSummary ?? ""}
                      name="inspirationSummary"
                      rows={2}
                    />
                  </label>
                  <label className="fieldLabel fieldLabelWide">
                    Style traits
                    <input className="fieldInput" defaultValue={formatListInput(profile.styleTraitsJson)} name="styleTraits" type="text" />
                  </label>
                  <label className="fieldLabel fieldLabelWide">
                    Guardrails
                    <input className="fieldInput" defaultValue={formatListInput(profile.guardrailsJson)} name="guardrails" type="text" />
                  </label>
                  <label className="fieldCheckbox">
                    <input defaultChecked={profile.enabled} name="enabled" type="checkbox" />
                    Enabled
                  </label>
                  <button className="jobButton jobButtonSecondary" type="submit">
                    Save style
                  </button>
                </form>
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
    const [
      sourceConfigCount,
      rawSignals,
      clusters,
      ideas,
      recentJobRuns,
      topClusters,
      latestIdeas,
      digestRecipients,
      sourceConfigs,
      researchStreams,
      topics,
      copyFrameworks,
      styleProfiles,
      latestContentDrafts,
      recentSourceRuns,
      recentHealthChecks
    ] = await Promise.all([
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
          orderBy: [{ qualityScore: "desc" }, { updatedAt: "desc" }],
          take: 5,
          select: {
            id: true,
            title: true,
            category: true,
            businessType: true,
            qualityScore: true,
            qualityReason: true,
            status: true,
            updatedAt: true,
            evidenceSummary: true,
            sourceAttributionJson: true
          }
        }),
        db.digestRecipient.findMany({
          orderBy: [{ researchStreamId: "asc" }, { isOwnerDefault: "desc" }, { email: "asc" }],
          include: {
            researchStream: {
              select: {
                slug: true,
                name: true
              }
            }
          }
        }),
        db.sourceConfig.findMany({
          orderBy: { sourceType: "asc" },
          select: {
            id: true,
            sourceType: true,
            enabled: true
          }
        }),
        db.researchStream.findMany({
          orderBy: [{ createdAt: "asc" }],
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            enabled: true,
            deliveryType: true,
            scheduleCron: true,
            defaultAssetMode: true,
            enabledChannelsJson: true
          }
        }),
        db.topic.findMany({
          orderBy: [{ researchStreamId: "asc" }, { name: "asc" }],
          select: {
            id: true,
            researchStreamId: true,
            slug: true,
            name: true,
            description: true,
            enabled: true,
            defaultAssetMode: true,
            defaultCopyFrameworkId: true,
            defaultStyleProfileId: true,
            enabledChannelsJson: true,
            keywordsJson: true,
            exclusionsJson: true,
            sourcePreferencesJson: true,
            researchStream: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            }
          }
        }),
        db.copyFramework.findMany({
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            enabled: true,
            structureJson: true
          }
        }),
        db.styleProfile.findMany({
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            inspirationSummary: true,
            enabled: true,
            styleTraitsJson: true,
            guardrailsJson: true
          }
        }),
        db.contentDraft.findMany({
          where: {
            researchStreamId: "stream-social-media-research"
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 6,
          select: {
            id: true,
            title: true,
            targetChannel: true,
            status: true,
            qualityScore: true,
            hook: true,
            thesis: true,
            updatedAt: true,
            topic: {
              select: {
                name: true
              }
            },
            copyFramework: {
              select: {
                name: true
              }
            },
            styleProfile: {
              select: {
                name: true
              }
            }
          }
        }),
        db.sourceRun.findMany({
          orderBy: { startedAt: "desc" },
          take: 6,
          include: {
            sourceConfig: {
              select: {
                sourceType: true
              }
            }
          }
        }),
        db.sourceHealthCheck.findMany({
          orderBy: { checkedAt: "desc" },
          take: 6,
          include: {
            sourceConfig: {
              select: {
                sourceType: true
              }
            }
          }
        })
      ]);

    return {
      stats: {
        sourceConfigs: sourceConfigCount,
        rawSignals,
        clusters,
        ideas
      },
      recentJobRuns,
      topClusters,
      latestIdeas,
      digestRecipients,
      sourceConfigs,
      researchStreams,
      topics,
      copyFrameworks,
      styleProfiles,
      latestContentDrafts,
      recentSourceRuns,
      recentHealthChecks
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
    digestRecipients: [],
    sourceConfigs: [],
    researchStreams: [],
    topics: [],
    copyFrameworks: [],
    styleProfiles: [],
    latestContentDrafts: [],
    recentSourceRuns: [],
    recentHealthChecks: []
  };
}

function formatSourceAttribution(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return "Sources: attribution pending";
  }

  const parts = value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const sourceType = "sourceType" in entry && typeof entry.sourceType === "string" ? entry.sourceType : null;
      const signalCount = "signalCount" in entry && typeof entry.signalCount === "number" ? entry.signalCount : null;

      if (!sourceType || signalCount === null) {
        return null;
      }

      return `${sourceType} (${signalCount})`;
    })
    .filter((part): part is string => Boolean(part));

  return parts.length > 0 ? `Sources: ${parts.join(", ")}` : "Sources: attribution pending";
}

function formatChannelInput(value: unknown) {
  return formatListInput(value);
}

function formatListInput(value: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value.filter((entry): entry is string => typeof entry === "string").join(", ");
}

function readSearchParam(searchParams: Record<string, string | string[] | undefined>, key: string) {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function matchesStreamSearch(stream: DashboardData["researchStreams"][number], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [stream.name, stream.slug, stream.description ?? "", formatChannelInput(stream.enabledChannelsJson)]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

function matchesTopicSearch(topic: DashboardData["topics"][number], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [
    topic.name,
    topic.slug,
    topic.description ?? "",
    topic.researchStream.name,
    formatListInput(topic.enabledChannelsJson),
    formatListInput(topic.keywordsJson),
    formatListInput(topic.exclusionsJson),
    formatListInput(topic.sourcePreferencesJson)
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
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

function normalizeStatus(value: string) {
  if (value === "ok") {
    return "succeeded";
  }

  if (value === "error") {
    return "failed";
  }

  return value;
}
