import { logJobBoundary } from "./shared";

export async function runDailyIngest() {
  logJobBoundary("daily-ingest", "Placeholder ingest runner. Implement source fanout, dedupe, and raw signal writes here.");
}
