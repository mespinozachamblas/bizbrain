import { ServerActionForm } from "../action-forms";
import { createStyleProfile, updateStyleProfile } from "../actions";
import { formatListInput, getDashboardData } from "../dashboard-data";
import { EmptyState } from "../dashboard-ui";

export const dynamic = "force-dynamic";

export default async function StyleProfilesPage() {
  const dashboard = await getDashboardData();

  return (
    <main className="contentPage">
      <section className="hero heroCompact">
        <p className="eyebrow">BizBrain</p>
        <h1>Style Profiles</h1>
        <p className="lede">Define voice, inspiration, and guardrails for the social-media research stream and future content outputs.</p>
      </section>

      <section className="dashboardGrid dashboardGridTwoCol">
        <article className="card controlCard">
          <div className="cardHeader">
            <h2>Create style profile</h2>
            <span className="badge">Voice</span>
          </div>
          <ServerActionForm action={createStyleProfile} className="adminForm">
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
              <textarea className="fieldTextarea" name="description" placeholder="Plainspoken operator voice with clear lessons and light persuasion." rows={3} />
            </label>
            <label className="fieldLabel fieldLabelWide">
              Inspiration summary
              <textarea className="fieldTextarea" name="inspirationSummary" placeholder="Direct-response clarity mixed with practical founder education." rows={2} />
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
          </ServerActionForm>
        </article>

        <article className="card cardTall">
          <div className="cardHeader">
            <h2>All style profiles</h2>
            <span className="badge">Voice</span>
          </div>
          {dashboard.styleProfiles.length === 0 ? (
            <EmptyState message="No style profiles are configured yet." />
          ) : (
            <div className="stack">
              {dashboard.styleProfiles.map((profile) => (
                <details className="adminDisclosure" key={profile.id}>
                  <summary className="adminDisclosureSummary">
                    <div>
                      <p className="rowTitle">{profile.name}</p>
                      <p className="rowMeta">
                        {profile.slug} · {profile.enabled ? "enabled" : "disabled"} · {formatListInput(profile.styleTraitsJson)}
                      </p>
                    </div>
                    <span className="status status-skipped">Edit</span>
                  </summary>
                  <ServerActionForm action={updateStyleProfile} className="adminForm adminFormCompact">
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
                      <textarea className="fieldTextarea" defaultValue={profile.inspirationSummary ?? ""} name="inspirationSummary" rows={2} />
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
