import { ServerActionForm } from "../action-forms";
import { createCopyFramework, updateCopyFramework } from "../actions";
import { formatListInput, getDashboardData } from "../dashboard-data";
import { EmptyState } from "../dashboard-ui";

export const dynamic = "force-dynamic";

export default async function FrameworksPage() {
  const dashboard = await getDashboardData();

  return (
    <main className="contentPage">
      <section className="hero heroCompact">
        <p className="eyebrow">BizBrain</p>
        <h1>Frameworks</h1>
        <p className="lede">Manage reusable copy structures like AIDA, PAS, and BAB for social and research outputs.</p>
      </section>

      <section className="stack listPageStack">
        <article className="card controlCard listPageControlCard">
          <div className="cardHeader">
            <h2>Create copy framework</h2>
            <span className="badge">Messaging</span>
          </div>
          <ServerActionForm action={createCopyFramework} className="adminForm">
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
              <textarea className="fieldTextarea" name="description" placeholder="Attention, interest, desire, action sequence for social and email hooks." rows={3} />
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
          </ServerActionForm>
        </article>

        <article className="card cardTall listPageListCard">
          <div className="cardHeader">
            <h2>All frameworks</h2>
            <span className="badge">Messaging</span>
          </div>
          {dashboard.copyFrameworks.length === 0 ? (
            <EmptyState message="No copy frameworks are configured yet." />
          ) : (
            <div className="stack">
              {dashboard.copyFrameworks.map((framework) => (
                <details className="adminDisclosure" key={framework.id}>
                  <summary className="adminDisclosureSummary">
                    <div>
                      <p className="rowTitle">{framework.name}</p>
                      <p className="rowMeta">
                        {framework.slug} · {framework.enabled ? "enabled" : "disabled"} · {formatListInput(framework.structureJson)}
                      </p>
                    </div>
                    <span className="status status-skipped">Edit</span>
                  </summary>
                  <ServerActionForm action={updateCopyFramework} className="adminForm adminFormCompact">
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
