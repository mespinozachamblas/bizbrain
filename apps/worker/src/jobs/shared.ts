import type { JobName, JobStatus, JsonValue } from "@bizbrain/core";
import { db } from "@bizbrain/db";

type PersistedJsonValue = Exclude<JsonValue, null>;

type JobRunStats = {
  recordsRead?: number;
  recordsWritten?: number;
  warnings?: PersistedJsonValue;
  errors?: PersistedJsonValue;
};

type JobExecutionOptions = {
  jobName: JobName;
  logicalDate?: Date;
  execute: (context: JobExecutionContext) => Promise<void>;
};

export type JobExecutionContext = {
  jobName: JobName;
  logicalDate: Date;
  jobRunId: string;
  markProgress: (stats: JobRunStats) => Promise<void>;
  createSourceRun: (input: SourceRunInput) => Promise<void>;
};

type SourceRunInput = {
  sourceConfigId: string;
  status: JobStatus;
  recordsRead?: number;
  recordsWritten?: number;
  warnings?: PersistedJsonValue;
  errors?: PersistedJsonValue;
  startedAt?: Date;
  finishedAt?: Date;
};

export async function runJobWithTracking(options: JobExecutionOptions) {
  const logicalDate = options.logicalDate ?? startOfUtcDay(new Date());
  const timestamp = new Date().toISOString();

  console.log(`[${timestamp}] ${options.jobName}`);

  const jobRun = await db.jobRun.create({
    data: {
      jobName: options.jobName,
      logicalDate,
      runStatus: "running",
      startedAt: new Date()
    }
  });

  const context: JobExecutionContext = {
    jobName: options.jobName,
    logicalDate,
    jobRunId: jobRun.id,
    markProgress: async (stats) => {
      await db.jobRun.update({
        where: { id: jobRun.id },
        data: {
          recordsRead: stats.recordsRead,
          recordsWritten: stats.recordsWritten,
          warningsJson: stats.warnings,
          errorsJson: stats.errors
        }
      });
    },
    createSourceRun: async (input) => {
      await db.sourceRun.create({
        data: {
          sourceConfigId: input.sourceConfigId,
          jobRunId: jobRun.id,
          logicalDate,
          runStatus: input.status,
          recordsRead: input.recordsRead ?? 0,
          recordsWritten: input.recordsWritten ?? 0,
          warningsJson: input.warnings,
          errorsJson: input.errors,
          startedAt: input.startedAt ?? new Date(),
          finishedAt: input.finishedAt ?? new Date()
        }
      });
    }
  };

  try {
    await options.execute(context);

    await db.jobRun.update({
      where: { id: jobRun.id },
      data: {
        runStatus: "succeeded",
        finishedAt: new Date()
      }
    });
  } catch (error) {
    const normalizedError = serializeError(error);

    await db.jobRun.update({
      where: { id: jobRun.id },
      data: {
        runStatus: "failed",
        finishedAt: new Date(),
        errorsJson: normalizedError
      }
    });

    throw error;
  } finally {
    await db.$disconnect();
  }
}

export function logJobBoundary(jobName: JobName, detail: string) {
  const timestamp = new Date().toISOString();

  console.log(`[${timestamp}] ${jobName}`);
  console.log(detail);
}

export function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return { message: String(error) };
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}
