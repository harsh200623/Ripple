import path from 'node:path';
import { ERROR_CODES } from '@ripple/shared';
import { appError } from '../lib/errors';
import { runGit, GitCommandError } from '../lib/git';
import { logger } from '../lib/logger';
import { createWorkspace, directorySizeBytes, removeWorkspace } from '../lib/storage';

export interface RepoServiceOptions {
  baseDir: string;
  timeoutMs: number;
  maxRepoSizeBytes: number;
}

export interface CheckedOutSnapshot {
  /** Absolute path to the temporary checkout. Removed by cleanup(). */
  checkoutPath: string;
  headSha: string;
  cleanup: () => Promise<void>;
}

/**
 * Clones a repository at an exact commit SHA into a temporary workspace.
 * Only HTTPS GitHub clone URLs produced by the GitHub service are accepted.
 * No repository scripts, hooks, or submodules are executed or initialized.
 */
export class RepoService {
  constructor(private readonly options: RepoServiceOptions) {}

  async checkoutAtSha(cloneUrl: string, headSha: string, analysisId: string): Promise<CheckedOutSnapshot> {
    if (!/^https:\/\/github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\.git$/.test(cloneUrl)) {
      throw appError(ERROR_CODES.INVALID_REQUEST, 400);
    }
    if (!/^[0-9a-f]{40}$/.test(headSha)) {
      throw appError(ERROR_CODES.INVALID_REQUEST, 400);
    }

    const workspace = await createWorkspace(this.options.baseDir);
    const checkoutPath = path.join(workspace, 'repo');
    const log = logger.child({ analysisId });

    const cleanup = async (): Promise<void> => {
      try {
        await removeWorkspace(this.options.baseDir, workspace);
      } catch (error) {
        log.error({ err: error instanceof Error ? error.name : 'unknown' }, 'failed to remove workspace');
      }
    };

    try {
      // Fetch only the target commit, not branch history, to minimize transfer and time.
      await runGit(['init', '--quiet', checkoutPath], { timeoutMs: this.options.timeoutMs });
      await runGit(['-C', checkoutPath, 'remote', 'add', 'origin', cloneUrl], { timeoutMs: this.options.timeoutMs });
      await runGit(
        ['-C', checkoutPath, '-c', 'protocol.version=2', 'fetch', '--depth', '1', '--no-tags', '--quiet', 'origin', headSha],
        { timeoutMs: this.options.timeoutMs },
      );
      await runGit(['-C', checkoutPath, 'checkout', '--quiet', '--detach', 'FETCH_HEAD'], {
        timeoutMs: this.options.timeoutMs,
      });

      const resolved = (await runGit(['-C', checkoutPath, 'rev-parse', 'HEAD'], { timeoutMs: this.options.timeoutMs })).trim();
      if (resolved !== headSha) {
        throw appError(ERROR_CODES.ANALYSIS_FAILED, 500);
      }

      const sizeBytes = await directorySizeBytes(checkoutPath);
      if (sizeBytes > this.options.maxRepoSizeBytes) {
        throw appError(ERROR_CODES.REPOSITORY_TOO_LARGE, 422);
      }

      log.info({ headSha }, 'repository snapshot ready');
      return { checkoutPath, headSha, cleanup };
    } catch (error) {
      await cleanup();
      if (error instanceof GitCommandError && error.timedOut) {
        throw appError(ERROR_CODES.ANALYSIS_TIMEOUT, 504, { cause: error });
      }
      if (error instanceof Error && error.name === 'AppError') throw error;
      log.warn({ exitCode: error instanceof GitCommandError ? error.exitCode : null }, 'repository checkout failed');
      throw appError(ERROR_CODES.UPSTREAM_UNAVAILABLE, 502, { cause: error });
    }
  }
}
