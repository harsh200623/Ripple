/**
 * Idempotent demo seed. Inserts one repository, one pull request, and one completed
 * analysis with a deterministic ID, so re-running does not create duplicates.
 * Requires DATABASE_URL. Intended for local and staging only.
 */
import { createDb } from '../src/db/client';
import { analyses, analysisResults, pullRequests, repositories } from '../src/db/schema';
import { eq } from 'drizzle-orm';

const DEMO_ANALYSIS_ID = 'analysis_demo_0000001';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }
  const { db, pool } = createDb(url);
  try {
    await db.transaction(async (tx) => {
      const [repo] = await tx
        .insert(repositories)
        .values({ owner: 'demo', name: 'sample', fullName: 'demo/sample', htmlUrl: 'https://github.com/demo/sample' })
        .onConflictDoNothing({ target: repositories.fullName })
        .returning({ id: repositories.id });
      const repoId = repo?.id ?? (await tx.select({ id: repositories.id }).from(repositories).where(eq(repositories.fullName, 'demo/sample')))[0]!.id;

      const [pr] = await tx
        .insert(pullRequests)
        .values({
          repositoryId: repoId,
          prNumber: 1,
          title: 'Demo pull request',
          htmlUrl: 'https://github.com/demo/sample/pull/1',
          baseSha: 'a'.repeat(40),
          headSha: 'b'.repeat(40),
        })
        .onConflictDoNothing()
        .returning({ id: pullRequests.id });
      const prId = pr?.id ?? (await tx.select({ id: pullRequests.id }).from(pullRequests).where(eq(pullRequests.prNumber, 1)))[0]!.id;

      await tx
        .insert(analyses)
        .values({ id: DEMO_ANALYSIS_ID, pullRequestId: prId, status: 'completed', riskScore: 0, riskLevel: 'low', completedAt: new Date() })
        .onConflictDoNothing();

      await tx
        .insert(analysisResults)
        .values({ analysisId: DEMO_ANALYSIS_ID, warnings: [{ code: 'DEMO_DATA', message: 'Demo data only.' }] })
        .onConflictDoNothing();
    });
    console.log(`Seeded demo analysis ${DEMO_ANALYSIS_ID}`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error instanceof Error ? error.name : 'unknown');
  process.exit(1);
});
