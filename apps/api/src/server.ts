import { loadConfig } from './config';
import { logger } from './lib/logger';
import { createDb } from './db/client';
import { createApp } from './app';
import { OctokitGitHubGateway } from './services/github';
import { RepoService } from './services/repo';
import { AnalysisService } from './services/analysis';
import { QueueService } from './services/queue';
import { startWorker } from './worker';
import { realAnalysisEngine } from './analysis/real';

async function main(): Promise<void> {
  const config = loadConfig();
  const { db, pool } = createDb(config.DATABASE_URL);

  const github = new OctokitGitHubGateway({
    token: config.GITHUB_TOKEN,
    timeoutMs: 15_000,
    maxChangedFiles: config.MAX_CHANGED_FILES,
  });
  const repo = new RepoService({
    baseDir: config.TEMP_DIR,
    timeoutMs: config.ANALYSIS_TIMEOUT_MS,
    maxRepoSizeBytes: config.MAX_REPO_SIZE_MB * 1024 * 1024,
  });
  const queue = new QueueService({ connectionString: config.DATABASE_URL, concurrency: config.QUEUE_CONCURRENCY });
  await queue.start();

  const analysis = new AnalysisService(db, github, (data) => queue.enqueueAnalysis(data));
  const app = createApp({
    deps: { db, analysis },
    rateLimit: { windowMs: config.RATE_LIMIT_WINDOW_MS, max: config.RATE_LIMIT_MAX },
  });

  if (config.WORKER_MODE === 'inline') {
    await startWorker({
      db,
      github,
      repo,
      engine: realAnalysisEngine,
      queue,
      maxChangedFiles: config.MAX_CHANGED_FILES,
      maxAnalysisFiles: config.MAX_ANALYSIS_FILES,
      analysisTimeoutMs: config.ANALYSIS_TIMEOUT_MS,
    });
  }

  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT, workerMode: config.WORKER_MODE }, 'ripple api listening');
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutting down');
    server.close();
    await queue.stop();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  // Log only the error name; configuration messages name fields, never values.
  logger.fatal({ err: error instanceof Error ? error.message : 'unknown' }, 'failed to start');
  process.exit(1);
});
