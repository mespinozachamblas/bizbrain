import { ServerActionForm } from "../action-forms";
import { createTopic, updateTopic } from "../actions";
import { formatListInput, getDashboardData, matchesTopicSearch, readSearchParam } from "../dashboard-data";
import { EmptyState } from "../dashboard-ui";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TopicsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const topicQuery = readSearchParam(resolvedSearchParams, "topicQuery");
  const topicStreamId = readSearchParam(resolvedSearchParams, "topicStreamId");
  const dashboard = await getDashboardData();
  const filteredTopics = dashboard.topics.filter(
    (topic) => matchesTopicSearch(topic, topicQuery) && (!topicStreamId || topic.researchStreamId === topicStreamId)
  );

  return (
    <main className="contentPage">
      <section className="hero heroCompact">
        <p className="eyebrow">BizBrain</p>
        <h1>Topics</h1>
        <p className="lede">
          Topics steer source matching and output selection within each research stream. For social-media topics, content
          channels like LinkedIn and X control draft generation.
        </p>
      </section>

      <section className="dashboardGrid dashboardGridTwoCol">
        <article className="card controlCard">
          <div className="cardHeader">
            <h2>Create topic</h2>
            <span className="badge">Topics</span>
          </div>
          <ServerActionForm action={createTopic} className="adminForm">
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
              Content channels
              <input className="fieldInput" defaultValue="email" name="enabledChannels" placeholder="linkedin, x" type="text" />
            </label>
            <label className="fieldLabel fieldLabelWide">
              Description
              <textarea className="fieldTextarea" name="description" placeholder="Signals and content angles around underwriting delays, occupancy rules, and borrower confusion." rows={3} />
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
            <p className="helperText">
              Include stats preferences here too when useful, for example `google-trends, government-data, industry-report`.
            </p>
            <label className="fieldLabel">
              Topic fit threshold
              <input className="fieldInput" defaultValue="6" max="20" min="0" name="topicFitThreshold" placeholder="6" step="0.5" type="number" />
            </label>
            <p className="helperText">
              Higher values make this topic stricter. Social topics around `6-8` usually block weak matches without starving draft generation.
            </p>
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
          </ServerActionForm>
        </article>

        <article className="card cardTall">
          <div className="cardHeader">
            <h2>All topics</h2>
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
                  <ServerActionForm action={updateTopic} className="adminForm adminFormCompact">
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
                      Content channels
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
                      <input className="fieldInput" defaultValue={formatListInput(topic.sourcePreferencesJson)} name="sourcePreferences" type="text" />
                    </label>
                    <p className="helperText">
                      Use source preferences to guide both signal matching and preferred stats-source classes such as `google-trends`,
                      `government-data`, `industry-report`, or `marketplace-data`.
                    </p>
                    <label className="fieldLabel">
                      Topic fit threshold
                      <input
                        className="fieldInput"
                        defaultValue={topic.topicFitThreshold ?? 6}
                        max="20"
                        min="0"
                        name="topicFitThreshold"
                        step="0.5"
                        type="number"
                      />
                    </label>
                    <p className="helperText">
                      Raise this to demand tighter topic overlap before the worker creates a social brief and downstream drafts.
                    </p>
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
                  </ServerActionForm>
                </details>
              ))}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
