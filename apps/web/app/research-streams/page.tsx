import { createResearchStream, updateResearchStream } from "../actions";
import { getDashboardData, matchesStreamSearch, readSearchParam, formatChannelInput } from "../dashboard-data";
import { EmptyState } from "../dashboard-ui";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ResearchStreamsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const streamQuery = readSearchParam(resolvedSearchParams, "streamQuery");
  const dashboard = await getDashboardData();
  const filteredResearchStreams = dashboard.researchStreams.filter((stream) => matchesStreamSearch(stream, streamQuery));

  return (
    <main className="contentPage">
      <section className="hero heroCompact">
        <p className="eyebrow">BizBrain</p>
        <h1>Research Streams</h1>
        <p className="lede">Create and maintain the top-level research lanes that drive topics, outputs, scheduling, and delivery.</p>
      </section>

      <section className="dashboardGrid dashboardGridTwoCol">
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
              <textarea className="fieldTextarea" name="description" placeholder="Research-backed drafts for social channels." rows={3} />
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

        <article className="card cardTall">
          <div className="cardHeader">
            <h2>All research streams</h2>
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
                      <input className="fieldInput" defaultValue={formatChannelInput(stream.enabledChannelsJson)} name="enabledChannels" type="text" />
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
      </section>
    </main>
  );
}
