import { db } from "@bizbrain/db";
import { sourceTypes, type SourceType } from "@bizbrain/core";
import { ServerActionForm } from "../action-forms";
import { createSourceConfig, runPipelineJob, runSourceCheck, updateSourceConfig } from "../actions";
import {
  formatDate,
  formatListInput,
  getDashboardData,
  normalizeStatus,
  readSearchParam
} from "../dashboard-data";
import { EmptyState, StatCard } from "../dashboard-ui";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SourcesPage({ searchParams }: PageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const dashboard = await getDashboardData();
  const sources = await getSources();
  const query = readSearchParam(resolvedSearchParams, "q");
  const status = readSearchParam(resolvedSearchParams, "status");

  const streamLookup = new Map(dashboard.researchStreams.map((stream) => [stream.id, stream.name]));
  const topicLookup = new Map(dashboard.topics.map((topic) => [topic.id, topic.name]));

  const filteredSources = sources.filter((source) => {
    const linkedStreamNames = mapLinkedNames(source.researchStreamIdsJson, streamLookup).join(" ");
    const linkedTopicNames = mapLinkedNames(source.topicIdsJson, topicLookup).join(" ");
    const mode = readObjectField(source.configJson, "mode") ?? "";
    const matchesQuery =
      !query ||
      [source.sourceType, source.id, mode, linkedStreamNames, linkedTopicNames]
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase());
    const matchesStatus =
      !status ||
      (status === "enabled" && source.enabled) ||
      (status === "disabled" && !source.enabled);

    return matchesQuery && matchesStatus;
  });

  return (
    <main className="contentPage">
      <section className="hero heroCompact">
        <p className="eyebrow">BizBrain</p>
        <h1>Sources</h1>
        <p className="lede">
          Manage the raw-input layer here. This screen is for source configs, source health, and recent source-level runs so the
          operations page can stay focused on pipeline jobs.
        </p>
      </section>

      <section className="statsGrid">
        <StatCard label="Source Configs" value={dashboard.stats.sourceConfigs} />
        <StatCard label="Recent Source Runs" value={dashboard.recentSourceRuns.length} />
        <StatCard label="Recent Health Checks" value={dashboard.recentHealthChecks.length} />
        <StatCard label="Raw Signals" value={dashboard.stats.rawSignals} />
      </section>

      <section className="dashboardGrid dashboardGridTwoCol">
        <article className="card controlCard">
          <div className="cardHeader">
            <h2>Source controls</h2>
            <span className="badge">Inputs</span>
          </div>
          <div className="jobButtons">
            <form action={runPipelineJob}>
              <input name="jobName" type="hidden" value="daily-ingest" />
              <button className="jobButton" type="submit">
                Run daily-ingest
              </button>
            </form>
            {sources.map((source) => (
              <form action={runSourceCheck} key={source.id}>
                <input name="sourceConfigId" type="hidden" value={source.id} />
                <button className="jobButton jobButtonSecondary" type="submit">
                  Test {source.sourceType}
                </button>
              </form>
            ))}
          </div>
          <p className="helperText">
            `daily-ingest` refreshes raw signals. Per-source checks validate readiness without forcing a full ingest run.
          </p>
        </article>

        <article className="card cardTall">
          <div className="cardHeader">
            <h2>Create source config</h2>
            <span className="badge">Create</span>
          </div>
          <ServerActionForm action={createSourceConfig} className="adminForm">
            <label className="fieldLabel">
              Source type
              <select className="fieldInput" defaultValue={sourceTypes[0]} name="sourceType">
                {sourceTypes.map((sourceType) => (
                  <option key={sourceType} value={sourceType}>
                    {sourceType}
                  </option>
                ))}
              </select>
            </label>
            <label className="fieldCheckbox">
              <input defaultChecked name="enabled" type="checkbox" />
              Enabled
            </label>
            <label className="fieldLabel">
              Niche modes
              <input className="fieldInput" name="nicheModes" placeholder="pain, trends, validation" type="text" />
            </label>
            {renderSourceSpecificFields("reddit", {})}
            <label className="fieldLabel fieldLabelWide">
              Linked research streams
              <select className="fieldInput" multiple name="researchStreamIds" size={Math.min(6, Math.max(2, dashboard.researchStreams.length))}>
                {dashboard.researchStreams.map((stream) => (
                  <option key={stream.id} value={stream.id}>
                    {stream.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="fieldLabel fieldLabelWide">
              Linked topics
              <select className="fieldInput" multiple name="topicIds" size={Math.min(8, Math.max(3, dashboard.topics.length))}>
                {dashboard.topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.researchStream.name} · {topic.name}
                  </option>
                ))}
              </select>
            </label>
            <details className="adminDisclosure">
              <summary className="adminDisclosureSummary">
                <div>
                  <p className="rowTitle">Advanced JSON override</p>
                  <p className="rowMeta">Leave blank to use the friendly fields above.</p>
                </div>
              </summary>
              <label className="fieldLabel fieldLabelWide">
                Config JSON
                <textarea className="fieldTextarea" name="configJson" placeholder='{"mode":"sample","sampleSize":5}' />
              </label>
            </details>
            <label className="fieldLabel fieldLabelWide">
              Change reason
              <input className="fieldInput" name="changeReason" placeholder="Why this source config exists" type="text" />
            </label>
            <button className="jobButton" type="submit">
              Create source config
            </button>
          </ServerActionForm>
        </article>

        <article className="card cardTall">
          <div className="cardHeader">
            <h2>Source configs</h2>
            <span className="badge">Config</span>
          </div>
          <form className="filterForm filterFormWide" method="get">
            <label className="fieldLabel">
              Search sources
              <input
                className="fieldInput"
                defaultValue={query}
                name="q"
                placeholder="Search source type, mode, stream, topic"
                type="text"
              />
            </label>
            <label className="fieldLabel">
              Status
              <select className="fieldInput" defaultValue={status} name="status">
                <option value="">All statuses</option>
                <option value="enabled">enabled</option>
                <option value="disabled">disabled</option>
              </select>
            </label>
            <button className="jobButton jobButtonSecondary" type="submit">
              Filter sources
            </button>
          </form>
          <p className="helperText">
            Showing {filteredSources.length} of {sources.length} source config(s).
          </p>
          {sources.length === 0 ? (
            <EmptyState message="No source configs exist yet." />
          ) : filteredSources.length === 0 ? (
            <EmptyState message="No source configs matched the current filters." />
          ) : (
            <div className="stack">
              {filteredSources.map((source) => {
                const latestRun = source.sourceRuns[0] ?? null;
                const latestCheck = source.healthChecks[0] ?? null;
                const linkedStreams = mapLinkedNames(source.researchStreamIdsJson, streamLookup);
                const linkedTopics = mapLinkedNames(source.topicIdsJson, topicLookup);
                const selectedStreamIds = mapSelectedIds(source.researchStreamIdsJson);
                const selectedTopicIds = mapSelectedIds(source.topicIdsJson);
                const mode = readObjectField(source.configJson, "mode") ?? "unknown";
                const normalizedSourceType = normalizeSourceType(source.sourceType);
                const preview = buildTopicAwarePreview(source, dashboard.topics, dashboard.researchStreams);

                return (
                  <details className="adminDisclosure" key={source.id}>
                    <summary className="adminDisclosureSummary">
                      <div>
                        <p className="rowTitle">{source.sourceType}</p>
                        <p className="rowMeta">
                          {mode} mode · {source.enabled ? "enabled" : "disabled"} · {source.id}
                        </p>
                        <p className="rowMeta">
                          Streams: {linkedStreams.join(", ") || "none"} · Topics: {linkedTopics.join(", ") || "none"}
                        </p>
                      </div>
                      <span className={`status status-${source.enabled ? "enabled" : "disabled"}`}>
                        {source.enabled ? "enabled" : "disabled"}
                      </span>
                    </summary>
                    <div className="draftDetailGrid">
                      <div className="draftPrimary">
                        <ServerActionForm action={updateSourceConfig} className="adminForm adminFormCompact">
                          <input name="id" type="hidden" value={source.id} />
                          <label className="fieldLabel">
                            Source type
                            <select className="fieldInput" defaultValue={source.sourceType} name="sourceType">
                              {sourceTypes.map((entry) => (
                                <option key={entry} value={entry}>
                                  {entry}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="fieldCheckbox">
                            <input defaultChecked={source.enabled} name="enabled" type="checkbox" />
                            Enabled
                          </label>
                          <label className="fieldLabel">
                            Niche modes
                            <input
                              className="fieldInput"
                              defaultValue={formatListInput(source.nicheModes)}
                              name="nicheModes"
                              type="text"
                            />
                          </label>
                          {renderSourceSpecificFields(normalizedSourceType, source.configJson)}
                          <label className="fieldLabel fieldLabelWide">
                            Linked research streams
                            <select
                              className="fieldInput"
                              defaultValue={selectedStreamIds}
                              multiple
                              name="researchStreamIds"
                              size={Math.min(6, Math.max(2, dashboard.researchStreams.length))}
                            >
                              {dashboard.researchStreams.map((stream) => (
                                <option key={stream.id} value={stream.id}>
                                  {stream.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="fieldLabel fieldLabelWide">
                            Linked topics
                            <select
                              className="fieldInput"
                              defaultValue={selectedTopicIds}
                              multiple
                              name="topicIds"
                              size={Math.min(8, Math.max(3, dashboard.topics.length))}
                            >
                              {dashboard.topics.map((topic) => (
                                <option key={topic.id} value={topic.id}>
                                  {topic.researchStream.name} · {topic.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <details className="adminDisclosure fieldLabelWide">
                            <summary className="adminDisclosureSummary">
                              <div>
                                <p className="rowTitle">Advanced JSON override</p>
                                <p className="rowMeta">Leave blank to use the friendly fields above.</p>
                              </div>
                            </summary>
                            <label className="fieldLabel fieldLabelWide">
                              Config JSON
                              <textarea className="fieldTextarea" defaultValue="" name="configJson" placeholder={JSON.stringify(source.configJson, null, 2)} />
                            </label>
                          </details>
                          <label className="fieldLabel fieldLabelWide">
                            Change reason
                            <input
                              className="fieldInput"
                              defaultValue={source.versions[0]?.changeReason ?? ""}
                              name="changeReason"
                              placeholder="What changed and why"
                              type="text"
                            />
                          </label>
                          <button className="jobButton jobButtonSecondary" type="submit">
                            Save source config
                          </button>
                        </ServerActionForm>
                        <div className="stackCompact">
                          <p className="rowBody">
                            <strong>Latest run:</strong>{" "}
                            {latestRun
                              ? `${formatDate(latestRun.startedAt)} · ${latestRun.runStatus} · read ${latestRun.recordsRead} · wrote ${latestRun.recordsWritten}`
                              : "No source runs yet."}
                          </p>
                          <p className="rowBody">
                            <strong>Latest run warnings:</strong> {formatUnknownList(latestRun?.warningsJson) || "None"}
                          </p>
                          <p className="rowBody">
                            <strong>Latest run errors:</strong> {formatUnknownList(latestRun?.errorsJson) || "None"}
                          </p>
                        </div>
                        <div className="evidenceSection">
                          <p className="rowBody">
                            <strong>Recent config versions:</strong>
                          </p>
                          {source.versions.length === 0 ? (
                            <p className="rowMeta">No config versions recorded yet.</p>
                          ) : (
                            <div className="stack">
                              {source.versions.map((version) => (
                                <div className="evidenceCard" key={version.id}>
                                  <p className="rowTitle">v{version.versionNumber}</p>
                                  <p className="rowMeta">{formatDate(version.createdAt)}</p>
                                  <p className="rowBody">{version.changeReason ?? "No change reason captured."}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="evidenceSection">
                          <p className="rowBody">
                            <strong>Likely topic / stream feeds:</strong>
                          </p>
                          {preview.matches.length === 0 ? (
                            <p className="rowMeta">No likely topic matches yet. Link a stream/topic or add more source keywords.</p>
                          ) : (
                            <div className="stack">
                              {preview.matches.map((match) => (
                                <div className="evidenceCard" key={match.topicId}>
                                  <p className="rowTitle">{match.topicName}</p>
                                  <p className="rowMeta">
                                    {match.streamName} · channels {match.channels || "none"} · {match.reason}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                          <p className="rowMeta">
                            Preview terms: {preview.terms.join(", ") || "none"}
                          </p>
                        </div>
                      </div>
                      <div className="draftSidebar">
                        <div className="stackCompact">
                          <p className="rowMeta">
                            <strong>Latest health check:</strong>{" "}
                            {latestCheck
                              ? `${latestCheck.checkType} · ${latestCheck.checkStatus} · ${formatDate(latestCheck.checkedAt)}`
                              : "No health check yet."}
                          </p>
                          <p className="rowMeta">
                            <strong>Health summary:</strong> {latestCheck?.responseSummary ?? "No response summary yet."}
                          </p>
                        </div>
                        <form action={runSourceCheck}>
                          <input name="sourceConfigId" type="hidden" value={source.id} />
                          <button className="jobButton jobButtonSecondary" type="submit">
                            Test {source.sourceType}
                          </button>
                        </form>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </article>

        <article className="card">
          <div className="cardHeader">
            <h2>Recent source runs</h2>
            <span className="badge">Runs</span>
          </div>
          {dashboard.recentSourceRuns.length === 0 ? (
            <EmptyState message="Source runs will appear after ingest starts writing per-source records." />
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
            <h2>Recent health checks</h2>
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
      </section>
    </main>
  );
}

async function getSources() {
  return db.sourceConfig.findMany({
    orderBy: [{ sourceType: "asc" }, { createdAt: "asc" }],
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 3
      },
      sourceRuns: {
        orderBy: { startedAt: "desc" },
        take: 1
      },
      healthChecks: {
        orderBy: { checkedAt: "desc" },
        take: 1
      }
    }
  });
}

function mapLinkedNames(value: unknown, lookup: Map<string, string>) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => lookup.get(entry) ?? entry);
}

function mapSelectedIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function readObjectField(value: unknown, key: string) {
  if (!value || typeof value !== "object" || !(key in value)) {
    return null;
  }

  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" ? candidate : null;
}

function formatUnknownList(value: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value.filter((entry): entry is string => typeof entry === "string").join(", ");
}

function normalizeSourceType(value: string): SourceType {
  return sourceTypes.includes(value as SourceType) ? (value as SourceType) : "reddit";
}

function buildTopicAwarePreview(
  source: Awaited<ReturnType<typeof getSources>>[number],
  topics: Awaited<ReturnType<typeof getDashboardData>>["topics"],
  streams: Awaited<ReturnType<typeof getDashboardData>>["researchStreams"]
) {
  const selectedStreamIds = new Set(mapSelectedIds(source.researchStreamIdsJson));
  const selectedTopicIds = new Set(mapSelectedIds(source.topicIdsJson));
  const streamNameLookup = new Map(streams.map((stream) => [stream.id, stream.name]));
  const terms = collectSourceTerms(source);

  const matches = topics
    .map((topic) => {
      const directTopic = selectedTopicIds.has(topic.id);
      const viaStream = selectedStreamIds.has(topic.researchStreamId);
      const overlap = countTopicOverlap(terms, topic);
      const score = (directTopic ? 100 : 0) + (viaStream ? 40 : 0) + overlap * 10;

      if (score === 0) {
        return null;
      }

      const reasons = [
        directTopic ? "direct topic link" : null,
        viaStream ? "stream link" : null,
        overlap > 0 ? `${overlap} keyword match${overlap > 1 ? "es" : ""}` : null
      ].filter((reason): reason is string => Boolean(reason));

      return {
        topicId: topic.id,
        topicName: topic.name,
        streamName: streamNameLookup.get(topic.researchStreamId) ?? topic.researchStream.name,
        channels: formatListInput(topic.enabledChannelsJson),
        reason: reasons.join(" + "),
        score
      };
    })
    .filter((match): match is NonNullable<typeof match> => Boolean(match))
    .sort((left, right) => right.score - left.score || left.topicName.localeCompare(right.topicName))
    .slice(0, 5);

  return { matches, terms };
}

function collectSourceTerms(source: Awaited<ReturnType<typeof getSources>>[number]) {
  const config = isObject(source.configJson) ? source.configJson : {};
  const terms = [
    source.sourceType,
    ...mapSelectedIds(source.nicheModes),
    ...readConfigStringArray(config, "keywords"),
    ...readConfigStringArray(config, "exclusions"),
    ...readConfigStringArray(config, "subredditList"),
    ...readConfigStringArray(config, "productTopics"),
    ...readConfigStringArray(config, "storyTypes"),
    readStringConfig(config, "geo")
  ].filter((term): term is string => typeof term === "string" && term.trim().length > 0);

  return [...new Set(terms.map((term) => term.trim().toLowerCase()))];
}

function countTopicOverlap(
  sourceTerms: string[],
  topic: Awaited<ReturnType<typeof getDashboardData>>["topics"][number]
) {
  if (sourceTerms.length === 0) {
    return 0;
  }

  const topicCorpus = [
    topic.name,
    topic.slug,
    topic.description ?? "",
    formatListInput(topic.keywordsJson),
    formatListInput(topic.sourcePreferencesJson)
  ]
    .join(" ")
    .toLowerCase();

  return sourceTerms.filter((term) => topicCorpus.includes(term)).length;
}

function readConfigStringArray(config: Record<string, unknown>, key: string) {
  const value = config[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function renderSourceSpecificFields(sourceType: SourceType, configJson: unknown) {
  const config = isObject(configJson) ? configJson : {};
  const commonProps = {
    mode: readStringConfig(config, "mode") ?? "sample",
    sampleSize: readNumberConfig(config, "sampleSize") ?? 5,
    keywords: readArrayConfig(config, "keywords"),
    exclusions: readArrayConfig(config, "exclusions")
  };

  return (
    <>
      <label className="fieldLabel">
        Mode
        <select className="fieldInput" defaultValue={commonProps.mode} name="mode">
          <option value="sample">sample</option>
          <option value="live">live</option>
        </select>
      </label>
      <label className="fieldLabel">
        Sample size
        <input className="fieldInput" defaultValue={String(commonProps.sampleSize)} min="1" name="sampleSize" type="number" />
      </label>
      <label className="fieldLabel fieldLabelWide">
        Keywords
        <input className="fieldInput" defaultValue={commonProps.keywords} name="keywords" placeholder="automation, landlord, fintech" type="text" />
      </label>
      <label className="fieldLabel fieldLabelWide">
        Exclusions
        <input className="fieldInput" defaultValue={commonProps.exclusions} name="exclusions" placeholder="job post, promo" type="text" />
      </label>
      {sourceType === "reddit" ? (
        <label className="fieldLabel fieldLabelWide">
          Subreddits
          <input
            className="fieldInput"
            defaultValue={readArrayConfig(config, "subredditList")}
            name="subredditList"
            placeholder="landlord, realestateinvesting, smallbusiness"
            type="text"
          />
        </label>
      ) : null}
      {sourceType === "google-trends" ? (
        <label className="fieldLabel">
          Geo
          <input className="fieldInput" defaultValue={readStringConfig(config, "geo") ?? "US"} name="geo" placeholder="US" type="text" />
        </label>
      ) : null}
      {sourceType === "hacker-news" ? (
        <label className="fieldLabel fieldLabelWide">
          Story types
          <input
            className="fieldInput"
            defaultValue={readArrayConfig(config, "storyTypes")}
            name="storyTypes"
            placeholder="askstories, showstories, topstories"
            type="text"
          />
        </label>
      ) : null}
      {sourceType === "product-hunt" ? (
        <label className="fieldLabel fieldLabelWide">
          Product topics
          <input
            className="fieldInput"
            defaultValue={readArrayConfig(config, "productTopics")}
            name="productTopics"
            placeholder="automation, workflows, landlord"
            type="text"
          />
        </label>
      ) : null}
    </>
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringConfig(config: Record<string, unknown>, key: string) {
  const value = config[key];
  return typeof value === "string" ? value : null;
}

function readNumberConfig(config: Record<string, unknown>, key: string) {
  const value = config[key];
  return typeof value === "number" ? value : null;
}

function readArrayConfig(config: Record<string, unknown>, key: string) {
  const value = config[key];

  if (!Array.isArray(value)) {
    return "";
  }

  return value.filter((entry): entry is string => typeof entry === "string").join(", ");
}
