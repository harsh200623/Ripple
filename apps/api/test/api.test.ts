import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Db } from '../src/db/client';
import { createApp } from '../src/app';
import { AnalysisService } from '../src/services/analysis';
import type { GitHubGateway, PullRequestMetadata } from '../src/services/github';

/**
 * API contract tests. The database is replaced by a fake that records calls, and
 * GitHub is a stub gateway, so no network or Postgres is required here.
 * Real Postgres constraints are covered in db.test.ts.
 */

const META: PullRequestMetadata = {
  owner: 'owner',
  repo: 'repository',
  fullName: 'owner/repository',
  number: 123,
  title: 'Add user service',
  htmlUrl: 'https://github.com/owner/repository/pull/123',
  baseSha: 'a'.repeat(40),
  headSha: 'b'.repeat(40),
  headRef: 'feature',
  cloneUrl: 'https://github.com/owner/repository.git',
  state: 'open',
};

function fakeGithub(overrides: Partial<GitHubGateway> = {}): GitHubGateway {
  return {
    getPullRequest: vi.fn(async () => META),
    listPullRequestFiles: vi.fn(async () => []),
    ...overrides,
  };
}

/** In-memory stand-in for the subset of Drizzle used by AnalysisService and routes. */
function fakeDb(): Db {
  const store = {
    analyses: new Map<string, { id: string; pullRequestId: number; status: string }>(),
  };
  const chain = (rows: unknown[]) => {
    const builder: Record<string, unknown> = {};
    for (const key of ['from', 'innerJoin', 'where', 'limit', 'set', 'values', 'onConflictDoUpdate', 'onConflictDoNothing']) {
      builder[key] = () => builder;
    }
    builder.returning = async () => rows;
    builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(rows).then(resolve);
    return builder;
  };
  const db = {
    insert: () => chain([{ id: 1 }]),
    update: () => chain([]),
    select: () => chain([...store.analyses.values()]),
    transaction: async (fn: (tx: unknown) => Promise<void>) => fn(db),
  };
  return db as unknown as Db;
}

function buildApp(overrides: { github?: GitHubGateway; enqueue?: (d: { analysisId: string }) => Promise<string> } = {}) {
  const github = overrides.github ?? fakeGithub();
  const enqueue = overrides.enqueue ?? (async () => 'job-1');
  const analysis = new AnalysisService(fakeDb(), github, enqueue);
  const app = createApp({
    deps: { db: fakeDb(), analysis },
    rateLimit: { windowMs: 60_000, max: 1000 },
  });
  return { app, github, enqueue };
}

describe('POST /api/v1/analyses', () => {
  it('returns 202 with analysisId and queued status for a valid PR URL', async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post('/api/v1/analyses')
      .send({ pullRequestUrl: 'https://github.com/owner/repository/pull/123' });
    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('queued');
    expect(res.body.data.analysisId).toMatch(/^analysis_/);
  });

  it('rejects an invalid PR URL with a safe 400 envelope and does not call GitHub', async () => {
    const github = fakeGithub();
    const { app } = buildApp({ github });
    const res = await request(app)
      .post('/api/v1/analyses')
      .send({ pullRequestUrl: 'https://evil.example.com/owner/repo/pull/1' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'INVALID_REQUEST', message: 'The request is invalid.' },
    });
    expect(github.getPullRequest).not.toHaveBeenCalled();
  });

  it('rejects unknown body fields', async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post('/api/v1/analyses')
      .send({ pullRequestUrl: 'https://github.com/owner/repository/pull/123', extra: true });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('maps a missing GitHub PR to a 404 PULL_REQUEST_NOT_FOUND envelope', async () => {
    const github = fakeGithub({
      getPullRequest: vi.fn(async () => {
        const { AppError, ERROR_CODES, SAFE_MESSAGES } = await import('@ripple/shared');
        throw new AppError(ERROR_CODES.PULL_REQUEST_NOT_FOUND, SAFE_MESSAGES.PULL_REQUEST_NOT_FOUND, 404);
      }),
    });
    const { app } = buildApp({ github });
    const res = await request(app)
      .post('/api/v1/analyses')
      .send({ pullRequestUrl: 'https://github.com/owner/repository/pull/999' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PULL_REQUEST_NOT_FOUND');
  });

  it('returns a generic 500 envelope for unexpected errors without leaking internals', async () => {
    const github = fakeGithub({
      getPullRequest: vi.fn(async () => {
        throw new Error('database password is hunter2');
      }),
    });
    const { app } = buildApp({ github });
    const res = await request(app)
      .post('/api/v1/analyses')
      .send({ pullRequestUrl: 'https://github.com/owner/repository/pull/123' });
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
  });
});

describe('GET /api/v1/health', () => {
  it('returns ok', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: 'ok' } });
  });
});

describe('GET /api/v1/analyses/:analysisId validation', () => {
  it('rejects malformed analysis IDs with 400 before touching the database', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/v1/analyses/not-valid!');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });
});
