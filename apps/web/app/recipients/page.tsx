import { ServerActionForm } from "../action-forms";
import { createDigestRecipient, updateDigestRecipient } from "../actions";
import { formatDate, getDashboardData } from "../dashboard-data";
import { EmptyState } from "../dashboard-ui";

export const dynamic = "force-dynamic";

export default async function RecipientsPage() {
  const dashboard = await getDashboardData();

  return (
    <main className="contentPage">
      <section className="hero heroCompact">
        <p className="eyebrow">BizBrain</p>
        <h1>Recipients</h1>
        <p className="lede">
          Manage digest delivery here. Recipients are stream-specific, so opportunity research and social media research can go
          to different inboxes without sharing the same recipient list.
        </p>
      </section>

      <section className="stack listPageStack">
        <article className="card controlCard listPageControlCard">
          <div className="cardHeader">
            <h2>Create recipient</h2>
            <span className="badge">Email</span>
          </div>
          <ServerActionForm action={createDigestRecipient} className="adminForm">
            <label className="fieldLabel">
              Research stream
              <select className="fieldInput" defaultValue="" name="researchStreamId" required>
                <option disabled value="">
                  Select a stream
                </option>
                {dashboard.researchStreams.map((stream) => (
                  <option key={stream.id} value={stream.id}>
                    {stream.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="fieldLabel">
              Email
              <input className="fieldInput" name="email" placeholder="name@example.com" type="email" />
            </label>
            <label className="fieldCheckbox">
              <input defaultChecked name="enabled" type="checkbox" />
              Enabled
            </label>
            <label className="fieldCheckbox">
              <input name="isOwnerDefault" type="checkbox" />
              Owner default
            </label>
            <button className="jobButton" type="submit">
              Create recipient
            </button>
          </ServerActionForm>
        </article>

        <article className="card cardTall listPageListCard">
          <div className="cardHeader">
            <h2>Digest recipients</h2>
            <span className="badge">Delivery</span>
          </div>
          {dashboard.digestRecipients.length === 0 ? (
            <EmptyState message="No digest recipients configured yet." />
          ) : (
            <div className="stack">
              {dashboard.researchStreams.map((stream) => {
                const recipients = dashboard.digestRecipients.filter((recipient) => recipient.researchStream.slug === stream.slug);

                return (
                  <section className="stack" key={stream.id}>
                    <div className="cardHeader">
                      <h2>{stream.name}</h2>
                      <span className="badge">{stream.deliveryType}</span>
                    </div>
                    {recipients.length === 0 ? (
                      <EmptyState message="No recipients configured for this stream yet." />
                    ) : (
                      recipients.map((recipient) => (
                        <details className="adminDisclosure" key={recipient.id}>
                          <summary className="adminDisclosureSummary">
                            <div>
                              <p className="rowTitle">{recipient.email}</p>
                              <p className="rowMeta">
                                {recipient.isOwnerDefault ? "Owner default" : "Additional recipient"} · updated{" "}
                                {formatDate(recipient.updatedAt)}
                              </p>
                            </div>
                            <span className={`status status-${recipient.enabled ? "enabled" : "disabled"}`}>
                              {recipient.enabled ? "enabled" : "disabled"}
                            </span>
                          </summary>
                          <ServerActionForm action={updateDigestRecipient} className="adminForm adminFormCompact">
                            <input name="id" type="hidden" value={recipient.id} />
                            <label className="fieldLabel">
                              Research stream
                              <select className="fieldInput" defaultValue={recipient.researchStream.id} name="researchStreamId">
                                {dashboard.researchStreams.map((streamOption) => (
                                  <option key={streamOption.id} value={streamOption.id}>
                                    {streamOption.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="fieldLabel">
                              Email
                              <input className="fieldInput" defaultValue={recipient.email} name="email" type="email" />
                            </label>
                            <label className="fieldCheckbox">
                              <input defaultChecked={recipient.enabled} name="enabled" type="checkbox" />
                              Enabled
                            </label>
                            <label className="fieldCheckbox">
                              <input defaultChecked={recipient.isOwnerDefault} name="isOwnerDefault" type="checkbox" />
                              Owner default
                            </label>
                            <button className="jobButton jobButtonSecondary" type="submit">
                              Save recipient
                            </button>
                          </ServerActionForm>
                        </details>
                      ))
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
