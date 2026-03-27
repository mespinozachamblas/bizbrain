import { visualCostTiers, visualDesignTools, visualModes } from "@bizbrain/core";
import { ServerActionForm } from "../action-forms";
import { createVisualGenerationProfile, updateVisualGenerationProfile } from "../actions";
import { getDashboardData } from "../dashboard-data";
import { EmptyState } from "../dashboard-ui";

export const dynamic = "force-dynamic";

export default async function VisualGenerationProfilesPage() {
  const dashboard = await getDashboardData();

  return (
    <main className="contentPage">
      <section className="hero heroCompact">
        <p className="eyebrow">BizBrain</p>
        <h1>Visual Profiles</h1>
        <p className="lede">
          Manage reusable visual-generation defaults for hero images, workflow diagrams, infographics, and broader asset packs.
        </p>
      </section>

      <section className="stack listPageStack">
        <article className="card controlCard listPageControlCard">
          <div className="cardHeader">
            <h2>Create visual profile</h2>
            <span className="badge">Visuals</span>
          </div>
          <ServerActionForm action={createVisualGenerationProfile} className="adminForm">
            <label className="fieldLabel">
              Name
              <input className="fieldInput" name="name" placeholder="LinkedIn infographic default" required type="text" />
            </label>
            <label className="fieldLabel">
              Slug
              <input className="fieldInput" name="slug" placeholder="linkedin-infographic-default" type="text" />
            </label>
            <label className="fieldLabel">
              Visual mode
              <select className="fieldInput" defaultValue="infographic" name="visualMode">
                {visualModes.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>
            <label className="fieldLabel">
              Design tool
              <select className="fieldInput" defaultValue="canva" name="designToolPreference">
                {visualDesignTools.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>
            <label className="fieldLabel">
              Cost tier
              <select className="fieldInput" defaultValue="medium" name="costTier">
                {visualCostTiers.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>
            <label className="fieldLabel">
              Max assets per run
              <input className="fieldInput" defaultValue="1" max="12" min="1" name="maxAssetsPerRun" type="number" />
            </label>
            <label className="fieldLabel">
              Aspect ratio
              <input className="fieldInput" name="aspectRatio" placeholder="4:5 or 1080x1350" type="text" />
            </label>
            <label className="fieldLabel">
              Brand theme
              <input className="fieldInput" name="brandTheme" placeholder="Founder editorial / clean benchmark" type="text" />
            </label>
            <label className="fieldLabel fieldLabelWide">
              Description
              <textarea className="fieldTextarea" name="description" placeholder="Default profile for editable infographic outputs with review required and moderate cost." rows={3} />
            </label>
            <label className="fieldCheckbox">
              <input defaultChecked name="reviewRequired" type="checkbox" />
              Review required
            </label>
            <label className="fieldCheckbox">
              <input defaultChecked name="enabled" type="checkbox" />
              Enabled
            </label>
            <button className="jobButton" type="submit">
              Create visual profile
            </button>
          </ServerActionForm>
        </article>

        <article className="card cardTall listPageListCard">
          <div className="cardHeader">
            <h2>All visual profiles</h2>
            <span className="badge">Visuals</span>
          </div>
          {dashboard.visualGenerationProfiles.length === 0 ? (
            <EmptyState message="No visual generation profiles are configured yet." />
          ) : (
            <div className="stack">
              {dashboard.visualGenerationProfiles.map((profile) => (
                <details className="adminDisclosure" key={profile.id}>
                  <summary className="adminDisclosureSummary">
                    <div>
                      <p className="rowTitle">{profile.name}</p>
                      <p className="rowMeta">
                        {profile.slug} · {profile.visualMode} · {profile.designToolPreference} · {profile.costTier} ·{" "}
                        {profile.enabled ? "enabled" : "disabled"}
                      </p>
                      <p className="rowMeta">
                        Max assets {profile.maxAssetsPerRun} · {profile.reviewRequired ? "review required" : "review optional"}
                        {profile.aspectRatio ? ` · ${profile.aspectRatio}` : ""}
                        {profile.brandTheme ? ` · ${profile.brandTheme}` : ""}
                      </p>
                    </div>
                    <span className="status status-skipped">Edit</span>
                  </summary>
                  <ServerActionForm action={updateVisualGenerationProfile} className="adminForm adminFormCompact">
                    <input name="id" type="hidden" value={profile.id} />
                    <label className="fieldLabel">
                      Name
                      <input className="fieldInput" defaultValue={profile.name} name="name" required type="text" />
                    </label>
                    <label className="fieldLabel">
                      Slug
                      <input className="fieldInput" defaultValue={profile.slug} name="slug" required type="text" />
                    </label>
                    <label className="fieldLabel">
                      Visual mode
                      <select className="fieldInput" defaultValue={profile.visualMode} name="visualMode">
                        {visualModes.map((entry) => (
                          <option key={entry} value={entry}>
                            {entry}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="fieldLabel">
                      Design tool
                      <select className="fieldInput" defaultValue={profile.designToolPreference} name="designToolPreference">
                        {visualDesignTools.map((entry) => (
                          <option key={entry} value={entry}>
                            {entry}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="fieldLabel">
                      Cost tier
                      <select className="fieldInput" defaultValue={profile.costTier} name="costTier">
                        {visualCostTiers.map((entry) => (
                          <option key={entry} value={entry}>
                            {entry}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="fieldLabel">
                      Max assets per run
                      <input className="fieldInput" defaultValue={String(profile.maxAssetsPerRun)} max="12" min="1" name="maxAssetsPerRun" type="number" />
                    </label>
                    <label className="fieldLabel">
                      Aspect ratio
                      <input className="fieldInput" defaultValue={profile.aspectRatio ?? ""} name="aspectRatio" type="text" />
                    </label>
                    <label className="fieldLabel">
                      Brand theme
                      <input className="fieldInput" defaultValue={profile.brandTheme ?? ""} name="brandTheme" type="text" />
                    </label>
                    <label className="fieldLabel fieldLabelWide">
                      Description
                      <textarea className="fieldTextarea" defaultValue={profile.description ?? ""} name="description" rows={2} />
                    </label>
                    <label className="fieldCheckbox">
                      <input defaultChecked={profile.reviewRequired} name="reviewRequired" type="checkbox" />
                      Review required
                    </label>
                    <label className="fieldCheckbox">
                      <input defaultChecked={profile.enabled} name="enabled" type="checkbox" />
                      Enabled
                    </label>
                    <button className="jobButton jobButtonSecondary" type="submit">
                      Save visual profile
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
