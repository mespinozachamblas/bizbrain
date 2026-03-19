export function logJobBoundary(jobName: string, detail: string) {
  const timestamp = new Date().toISOString();

  console.log(`[${timestamp}] ${jobName}`);
  console.log(detail);
}
