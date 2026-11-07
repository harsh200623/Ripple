import { Octokit } from '@octokit/rest';
import { ERROR_CODES, type ChangedFileStatus } from '@ripple/shared';
import { appError } from '../lib/errors';
import { logger } from '../lib/logger';

export interface PullRequestMetadata {
  owner: string;
  repo: string;
  fullName: string;
  number: number;
  title: string;
  htmlUrl: string;
  baseSha: string;
  headSha: string;
  headRef: string;
  cloneUrl: string;
  state: 'open' | 'closed';
}

export interface PullRequestFile {
  filePath: string;
  status: ChangedFileStatus;
  additions: number;
  deletions: number;
  previousFilePath: string | null;
}

export interface GitHubClientOptions {
  token: string;
  timeoutMs: number;
  /** Hard cap on changed files fetched; exceeding it fails the analysis explicitly. */
  maxChangedFiles: number;
  baseUrl?: string;
}

/** Narrow interface so tests can substitute a fake without touching Octokit. */
export interface GitHubGateway {
  getPullRequest(owner: string, repo: string, pullNumber: number): Promise<PullRequestMetadata>;
  listPullRequestFiles(owner: string, repo: string, pullNumber: number): Promise<PullRequestFile[]>;
}

const CHANGED_FILE_STATUSES: ReadonlySet<ChangedFileStatus> = new Set([
  'added',
  'modified',
  'removed',
  'renamed',
  'copied',
  'changed',
  'unchanged',
]);

function normalizeFileStatus(value: string): ChangedFileStatus {
  // GitHub returns an open set of strings; unknown values degrade to 'changed' rather than failing.
  return CHANGED_FILE_STATUSES.has(value as ChangedFileStatus) ? (value as ChangedFileStatus) : 'changed';
}

/** Maps Octokit/HTTP failures to stable application errors without leaking upstream details. */
export function mapGitHubError(error: unknown): never {
  const status = typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status: unknown }).status)
    : 0;

  if (status === 404) throw appError(ERROR_CODES.PULL_REQUEST_NOT_FOUND, 404, { cause: error });
  if (status === 403 || status === 429) throw appError(ERROR_CODES.RATE_LIMITED, 429, { cause: error });
  throw appError(ERROR_CODES.UPSTREAM_UNAVAILABLE, 502, { cause: error });
}

export class OctokitGitHubGateway implements GitHubGateway {
  private readonly octokit: Octokit;
  private readonly maxChangedFiles: number;

  constructor(options: GitHubClientOptions) {
    this.maxChangedFiles = options.maxChangedFiles;
    this.octokit = new Octokit({
      auth: options.token === '' ? undefined : options.token,
      baseUrl: options.baseUrl ?? 'https://api.github.com',
      request: { timeout: options.timeoutMs },
      userAgent: 'ripple-api',
    });
  }

  async getPullRequest(owner: string, repo: string, pullNumber: number): Promise<PullRequestMetadata> {
    try {
      const { data } = await this.octokit.pulls.get({ owner, repo, pull_number: pullNumber });
      return {
        owner,
        repo,
        fullName: `${owner}/${repo}`,
        number: data.number,
        title: data.title,
        htmlUrl: data.html_url,
        baseSha: data.base.sha,
        headSha: data.head.sha,
        headRef: data.head.ref,
        cloneUrl: `https://github.com/${owner}/${repo}.git`,
        state: data.state === 'closed' ? 'closed' : 'open',
      };
    } catch (error) {
      logger.warn({ owner, repo, pullNumber, reason: 'pulls.get failed' }, 'github request failed');
      mapGitHubError(error);
    }
  }

  async listPullRequestFiles(owner: string, repo: string, pullNumber: number): Promise<PullRequestFile[]> {
    const files: PullRequestFile[] = [];
    try {
      // paginate.iterator keeps memory bounded and lets us stop at the configured cap.
      for await (const response of this.octokit.paginate.iterator(this.octokit.pulls.listFiles, {
        owner,
        repo,
        pull_number: pullNumber,
        per_page: 100,
      })) {
        for (const file of response.data) {
          files.push({
            filePath: file.filename,
            status: normalizeFileStatus(file.status),
            additions: file.additions,
            deletions: file.deletions,
            previousFilePath: file.previous_filename ?? null,
          });
          if (files.length > this.maxChangedFiles) {
            throw appError(ERROR_CODES.TOO_MANY_CHANGED_FILES, 422);
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AppError') throw error;
      mapGitHubError(error);
    }
    return files;
  }
}
