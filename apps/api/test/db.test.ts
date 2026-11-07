import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { createDb, type DbHandle } from '../src/db/client';
import { analyses, pullRequests, repositories } from '../src/db/schema';

/**
 * Real-Postgres constraint tests. Skipped unless TEST_DATABASE_URL is set,
 * so local runs without a database still pass; CI must set it.
 */
const url = process.env.TEST_DATABASE_URL;
const describeIfDb = url ? describe : describe.skip;

describeIfDb('database constraints (real Postgres)', () => {
  let handle: DbHandle;

  beforeAll(async () => {
    handle = createDb(url as string);
    const dir = path.join(__dirname, '..', 'drizzle');
    const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
    await handle.pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    for (const file of files) {
      const statements = (await readFile(path.join(dir, file), 'utf8'))
        .split('--> statement-breakpoint')
        .join('\n');
      await handle.pool.query(statements);
    }
  });

  afterAll(async () => {
    await handle.pool.end();
  });

  async function seedPr(suffix: string): Promise<number> {
    const [repo] = await handle.db
      .insert(repositories)
      .values({ owner: 'owner', name: `repo${suffix}`, fullName: `owner/repo${suffix}`, htmlUrl: 'https://github.com/owner/repo' })
      .returning({ id: repositories.id });
    const [pr] = await handle.db
      .insert(pullRequests)
      .values({
        repositoryId: repo!.id,
        prNumber: 1,
        title: 't',
        htmlUrl: 'https://github.com/owner/repo/pull/1',
        baseSha: 'a'.repeat(40),
        headSha: 'b'.repeat(40),
      })
      .returning({ id: pullRequests.id });
    return pr!.id;
  }

  it('rejects an invalid analysis status', async () => {
    const prId = await seedPr('-status');
    await expect(
      handle.db.insert(analyses).values({ id: 'analysis_status_bad', pullRequestId: prId, status: 'bogus' }),
    ).rejects.toThrow(/analyses_status_check/);
  });

  it('rejects a risk score outside 0-100', async () => {
    const prId = await seedPr('-score');
    await expect(
      handle.db.insert(analyses).values({ id: 'analysis_score_bad', pullRequestId: prId, status: 'completed', riskScore: 101, riskLevel: 'low' }),
    ).rejects.toThrow(/analyses_risk_score_range_check/);
  });

  it('rejects a completed analysis without a risk score', async () => {
    const prId = await seedPr('-completed');
    await expect(
      handle.db.insert(analyses).values({ id: 'analysis_completed_bad', pullRequestId: prId, status: 'completed' }),
    ).rejects.toThrow(/analyses_completed_requires_risk_check/);
  });

  it('rejects a failed analysis without an error code', async () => {
    const prId = await seedPr('-failed');
    await expect(
      handle.db.insert(analyses).values({ id: 'analysis_failed_bad', pullRequestId: prId, status: 'failed' }),
    ).rejects.toThrow(/analyses_failed_requires_error_check/);
  });

  it('rejects a head SHA that is not 40 lowercase hex characters', async () => {
    await expect(
      handle.db.insert(pullRequests).values({
        repositoryId: (await handle.db.select({ id: repositories.id }).from(repositories).limit(1))[0]!.id,
        prNumber: 2,
        title: 't',
        htmlUrl: 'https://github.com/owner/repo/pull/2',
        baseSha: 'a'.repeat(40),
        headSha: 'NOT-A-SHA',
      }),
    ).rejects.toThrow(/pull_requests_head_sha_format_check/);
  });

  it('enforces uniqueness of repository full_name', async () => {
    await seedPr('-unique');
    await expect(
      handle.db.insert(repositories).values({ owner: 'owner', name: 'repo-unique', fullName: 'owner/repo-unique', htmlUrl: 'https://github.com/owner/repo-unique' }),
    ).rejects.toThrow(/repositories_full_name_uq/);
  });

  it('cascades analysis deletion when the pull request is removed', async () => {
    const prId = await seedPr('-cascade');
    await handle.db.insert(analyses).values({ id: 'analysis_cascade_1', pullRequestId: prId, status: 'queued' });
    await handle.db.execute(sql`DELETE FROM pull_requests WHERE id = ${prId}`);
    const remaining = await handle.db.select({ id: analyses.id }).from(analyses).where(sql`id = 'analysis_cascade_1'`);
    expect(remaining).toHaveLength(0);
  });
});
