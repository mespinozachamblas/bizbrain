const jobs = [
  "daily-ingest",
  "daily-enrich-score",
  "daily-digest-email",
  "weekly-maintenance"
];

export default function HomePage() {
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">BizBrain</p>
        <h1>Opportunity discovery workspace</h1>
        <p className="lede">
          This scaffold wires the dashboard, worker, and shared package boundaries described in the
          requirements set.
        </p>
      </section>

      <section className="grid">
        <article className="card">
          <h2>Apps</h2>
          <ul>
            <li>`apps/web` for the dashboard and admin UI</li>
            <li>`apps/worker` for scheduled runtime and local job runners</li>
          </ul>
        </article>

        <article className="card">
          <h2>Shared packages</h2>
          <ul>
            <li>`packages/db` for schema and DB access</li>
            <li>`packages/core` for domain logic and types</li>
            <li>`packages/email` for digest rendering</li>
            <li>`packages/prompts` for structured prompt assets</li>
            <li>`packages/agents` for workflow metadata</li>
          </ul>
        </article>

        <article className="card">
          <h2>Scheduled jobs</h2>
          <ul>
            {jobs.map((job) => (
              <li key={job}>{job}</li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
