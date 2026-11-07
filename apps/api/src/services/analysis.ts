import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { ERROR_CODES, type AnalysisStatus } from '@ripple/shared';
import type { Db } from '../db/client';
import { analyses, analysisResults, pullRequests, repositories } from '../db/schema';
import { appError } from '../lib/errors';
import type { GitHubGateway } from './github';
import type { AnalysisJobData } from './queue';
import { parsePrUrl } from '@ripple/shared';

export interface CreateAnalysisInput {
  pullRequestUrl: string;
}

export interface CreateAnalysisResult {
  analysisId: string;
  status: AnalysisStatus;
  /** True when an existing completed analysis for the same head SHA was returned. */
  reused: boolean;
}

export interface EnqueueFn {
  (data: AnalysisJobData): Promise<string>;
}

export function newAnalysisId(): string {
  return `analysis_${randomBytes(12).toString('base64url')}`;
}

/**
 * Orchestrates analysis creation. Resolves PR metadata once, reuses a completed
 * analysis for the same exact head SHA, and otherwise creates a queued record and enqueues it.
 */
export class AnalysisService {
  constructor(
    private readonly db: Db,
    private readonly github: GitHubGateway,
    private readonly enqueue: EnqueueFn,
  ) {}

  async createAnalysis(input: CreateAnalysisInput): Promise<CreateAnalysisResult> {
    const parsed = parsePrUrl(input.pullRequestUrl);
    if (!parsed) throw appError(ERROR_CODES.INVALID_PULL_REQUEST_URL, 400);

    const meta = await this.github.getPullRequest(parsed.owner, parsed.repo, parsed.pullNumber);

    const repoId = await this.upsertRepository(meta.owner, meta.repo, meta.fullName, `https://github.com/${meta.fullName}`);
    const prId = await this.upsertPullRequest(repoId, meta);

    const existing = await this.db
      .select({ id: analyses.id, status: analyses.status })
      .from(analyses)
      .where(and(eq(analyses.pullRequestId, prId), eq(analyses.status, 'completed')))
      .limit(1);
    if (existing[0]) {
      return { analysisId: existing[0].id, status: 'completed', reused: true };
    }

    const analysisId = newAnalysisId();
    await this.db.insert(analyses).values({ id: analysisId, pullRequestId: prId, status: 'queued' });

    const jobId = await this.enqueue({ analysisId });
    await this.db.update(analyses).set({ queueJobId: jobId }).where(eq(analyses.id, analysisId));

    return { analysisId, status: 'queued', reused: false };
  }

  private async upsertRepository(owner: string, name: string, fullName: string, htmlUrl: string): Promise<number> {
    const [row] = await this.db
      .insert(repositories)
      .values({ owner, name, fullName, htmlUrl })
      .onConflictDoUpdate({ target: repositories.fullName, set: { htmlUrl } })
      .returning({ id: repositories.id });
    if (!row) throw appError(ERROR_CODES.INTERNAL_ERROR, 500);
    return row.id;
  }

  private async upsertPullRequest(
    repositoryId: number,
    meta: { number: number; title: string; htmlUrl: string; baseSha: string; headSha: string },
  ): Promise<number> {
    const [row] = await this.db
      .insert(pullRequests)
      .values({
        repositoryId,
        prNumber: meta.number,
        title: meta.title,
        htmlUrl: meta.htmlUrl,
        baseSha: meta.baseSha,
        headSha: meta.headSha,
      })
      .onConflictDoUpdate({
        target: [pullRequests.repositoryId, pullRequests.prNumber, pullRequests.headSha],
        set: { title: meta.title, htmlUrl: meta.htmlUrl, baseSha: meta.baseSha, updatedAt: new Date() },
      })
      .returning({ id: pullRequests.id });
    if (!row) throw appError(ERROR_CODES.INTERNAL_ERROR, 500);
    return row.id;
  }
}

/** Reads a stored analysis with its PR/repository context. Returns null when absent. */
export async function getAnalysisRecord(db: Db, analysisId: string) {
  const rows = await db
    .select({
      id: analyses.id,
      status: analyses.status,
      riskScore: analyses.riskScore,
      riskLevel: analyses.riskLevel,
      errorCode: analyses.errorCode,
      errorMessage: analyses.errorMessage,
      repository: repositories.fullName,
      prNumber: pullRequests.prNumber,
      prTitle: pullRequests.title,
      prUrl: pullRequests.htmlUrl,
      baseSha: pullRequests.baseSha,
      headSha: pullRequests.headSha,
    })
    .from(analyses)
    .innerJoin(pullRequests, eq(analyses.pullRequestId, pullRequests.id))
    .innerJoin(repositories, eq(pullRequests.repositoryId, repositories.id))
    .where(eq(analyses.id, analysisId))
    .limit(1);
  return rows[0] ?? null;
}

/** Reads the persisted result payload for a completed analysis. */
export async function getAnalysisResult(db: Db, analysisId: string) {
  const rows = await db.select().from(analysisResults).where(eq(analysisResults.analysisId, analysisId)).limit(1);
  return rows[0] ?? null;
}
