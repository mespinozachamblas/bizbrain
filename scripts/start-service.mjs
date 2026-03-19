import { spawn } from "node:child_process";

const serviceMode = process.env.SERVICE_MODE ?? "web";
const packageRunner = process.env.BIZBRAIN_PACKAGE_RUNNER ?? "corepack";

const command =
  serviceMode === "web"
    ? [packageRunner, ["pnpm", "--filter", "@bizbrain/web", "start"]]
    : serviceMode === "worker"
      ? resolveWorkerCommand(process.env.JOB_NAME)
      : undefined;

if (!command) {
  console.error(`Unsupported SERVICE_MODE: ${serviceMode}`);
  process.exit(1);
}

const child = spawn(command[0], command[1], {
  stdio: "inherit",
  env: {
    ...process.env,
    COREPACK_HOME: process.env.COREPACK_HOME ?? "/tmp/corepack"
  }
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

function resolveWorkerCommand(jobName) {
  if (!jobName) {
    console.error("JOB_NAME is required when SERVICE_MODE=worker.");
    process.exit(1);
  }

  return [packageRunner, ["pnpm", "--filter", "@bizbrain/worker", jobName]];
}
