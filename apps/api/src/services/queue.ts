import PgBoss from 'pg-boss';
import { logger } from '../lib/logger';

export const ANALYSIS_QUEUE = 'analysis.run';

/** Job payload: contains only the server-generated analysis ID. No tokens or URLs. */
export interface AnalysisJobData {
  analysisId: string;
}

export interface QueueOptions {
  connectionString: string;
  concurrency: number;
}

/** Thin wrapper over pg-boss so the rest of the app never imports pg-boss directly. */
export class QueueService {
  private boss: PgBoss | null = null;

  constructor(private readonly options: QueueOptions) {}

  async start(): Promise<void> {
    this.boss = new PgBoss({
      connectionString: this.options.connectionString,
      retryLimit: 2,
      retryDelay: 5,
      retryBackoff: true,
      expireInSeconds: 60 * 60,
      deleteAfterSeconds: 7 * 24 * 60 * 60,
    });
    this.boss.on('error', (error: Error) => {
      logger.error({ err: error.name }, 'queue error');
    });
    await this.boss.start();
    await this.boss.createQueue(ANALYSIS_QUEUE);
  }

  /** Enqueues an analysis run and returns the job ID. Caller persists it on the analyses row. */
  async enqueueAnalysis(data: AnalysisJobData): Promise<string> {
    const boss = this.requireBoss();
    // singletonKey makes enqueue idempotent per analysis ID (re-queue safe).
    const jobId = await boss.send(ANALYSIS_QUEUE, data, { singletonKey: data.analysisId });
    if (jobId === null) {
      throw new Error('Job was not enqueued because an identical job is already active.');
    }
    return jobId;
  }

  async subscribe(handler: (data: AnalysisJobData) => Promise<void>): Promise<void> {
    const boss = this.requireBoss();
    // batchSize bounds how many jobs one poll may claim; jobs in a batch run sequentially.
    await boss.work<AnalysisJobData>(ANALYSIS_QUEUE, { batchSize: this.options.concurrency }, async (jobs) => {
      for (const job of jobs) {
        await handler(job.data);
      }
    });
  }

  async stop(): Promise<void> {
    if (this.boss) {
      await this.boss.stop({ graceful: true, timeout: 10_000 });
      this.boss = null;
    }
  }

  private requireBoss(): PgBoss {
    if (!this.boss) throw new Error('Queue is not started.');
    return this.boss;
  }
}
