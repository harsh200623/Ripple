import { eq } from 'drizzle-orm';
import { ERROR_CODES, AppError } from '@ripple/shared';
import type { Db } from './db/client';
import { analyses, analysisResults, pullRequests, repositories } from './db/schema';
import { logger } from './lib/logger';
import { removeWorkspace } from './lib/storage';
import { appError } from './lib/errors';
import type { AnalysisEngine } from './analysis/types';
import type { GitHubGateway } from './services/github';
import type { RepoService } from './services/repo';
import type { AnalysisJobData, QueueService } from './services/queue';

export interface WorkerDeps {
  db: Db;
  github: GitHubGateway;
  repo: RepoService;
  engine: AnalysisEngine;
  queue: QueueService;
  maxChangedFiles: number;
  maxAnalysisFiles: number;
  analysisTimeoutMs: number;
}

/**
 * Runs one analysis end-to-end. Idempotent: a job for an analysis that is already
 * completed is skipped. Every exit path updates status and removes the checkout.
 */
export async function runAnalysis(deps: WorkerDeps, data: AnalysisJobData): Promise<void> {
  const log = logger.child({ analysisId: data.analysisId });

  const [row] = await deps.db
    .select({
      status: analyses.status,
      owner: repositories.owner,
      repo: repositories.name,
      prNumber: pullRequests.prNumber,
      headSha: pullRequests.headSha,
      pullRequestId: pullRequests.id,
    })
    .from(analyses)
    .innerJoin(pullRequests, eq(analyses.pullRequestId, pullRequests.id))
    .innerJoin(repositories, eq(pullRequests.repositoryId, repositories.id))
    .where(eq(analyses.id, data.analysisId))
    .limit(1);

  if (!row) {
    log.warn('analysis record not found; skipping job');
    return;
  }
  if (row.status === 'completed' || row.status === 'failed') {
    log.info({ status: row.status }, 'analysis already finished; skipping job');
    return;
  }

  await deps.db
    .update(analyses)
    .set({ status: 'running', startedAt: new Date() })
    .where(eq(analyses.id, data.analysisId));

  let checkoutCleanup: (() => Promise<void>) | null = null;
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), deps.analysisTimeoutMs);

  try {
    const meta = await deps.github.getPullRequest(row.owner, row.repo, row.prNumber);
    const files = await deps.github.listPullRequestFiles(row.owner, row.repo, row.prNumber);

    const snapshot = await deps.repo.checkoutAtSha(meta.cloneUrl, meta.headSha, data.analysisId);
    checkoutCleanup = snapshot.cleanup;

    const output = await raceWithTimeout(
      deps.engine({
        checkoutPath: snapshot.checkoutPath,
        headSha: snapshot.headSha,
        changedFiles: files.map((file) => ({
          filePath: file.filePath,
          status: file.status,
          additions: file.additions,
          deletions: file.deletions,
          previousFilePath: file.previousFilePath,
        })),
        limits: {
          maxFiles: deps.maxAnalysisFiles,
          timeoutMs: deps.analysisTimeoutMs,
          signal: timeout.signal,
        },
      }),
      timeout.signal,
    );

    await deps.db.transaction(async (tx) => {
      await tx
        .insert(analysisResults)
        .values({
          analysisId: data.analysisId,
          graphData: output.graph,
          changedFiles: files,
          affectedFiles: output.affectedFiles,
          riskBreakdown: { factors: output.riskBreakdown, partial: output.partial },
          warnings: output.warnings,
        })
        .onConflictDoNothing();

      await tx
        .update(analyses)
        .set({
          status: 'completed',
          riskScore: output.riskScore,
          riskLevel: output.riskLevel,
          completedAt: new Date(),
        })
        .where(eq(analyses.id, data.analysisId));
    });

    log.info({ changedFiles: files.length, partial: output.partial }, 'analysis completed');
  } catch (error: unknown) {
    const safe = error instanceof AppError
      ? { code: error.code, message: error.message }
      : { code: ERROR_CODES.ANALYSIS_FAILED, message: appError(ERROR_CODES.ANALYSIS_FAILED, 500).message };

    log.error({ errorCode: safe.code }, 'analysis failed');
    await deps.db
      .update(analyses)
      .set({ status: 'failed', errorCode: safe.code, errorMessage: safe.message, completedAt: new Date() })
      .where(eq(analyses.id, data.analysisId));
  } finally {
    clearTimeout(timer);
    if (checkoutCleanup) await checkoutCleanup();
  }
}

/** Rejects with ANALYSIS_TIMEOUT if the engine does not finish before the abort signal fires. */
function raceWithTimeout<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(appError(ERROR_CODES.ANALYSIS_TIMEOUT, 504));
    if (signal.aborted) return onAbort();
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

/** Registers the queue consumer. Called from server.ts in inline or separate worker mode. */
export async function startWorker(deps: WorkerDeps): Promise<void> {
  await deps.queue.subscribe((data) => runAnalysis(deps, data));
  logger.info('analysis worker subscribed');
}

export { removeWorkspace };
