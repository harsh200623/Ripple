/**
 * Manual verification: clones a real public PR head snapshot and lists changed files.
 * Usage: GITHUB_TOKEN=... npm run ingest:pr -- https://github.com/owner/repo/pull/1
 * Does not run any repository code. Removes the checkout on exit.
 */
import { parsePrUrl } from '@ripple/shared';
import { loadConfig } from '../src/config';
import { OctokitGitHubGateway } from '../src/services/github';
import { RepoService } from '../src/services/repo';

async function main(): Promise<void> {
  const input = process.argv[2];
  const parsed = parsePrUrl(input);
  if (!parsed) {
    console.error('Usage: npm run ingest:pr -- https://github.com/owner/repo/pull/N');
    process.exit(1);
  }

  const config = loadConfig({ ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://unused' });
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

  const meta = await github.getPullRequest(parsed.owner, parsed.repo, parsed.pullNumber);
  const files = await github.listPullRequestFiles(parsed.owner, parsed.repo, parsed.pullNumber);
  const snapshot = await repo.checkoutAtSha(meta.cloneUrl, meta.headSha, 'ingest-script');
  try {
    console.log(JSON.stringify({
      repository: meta.fullName,
      number: meta.number,
      title: meta.title,
      baseSha: meta.baseSha,
      headSha: meta.headSha,
      changedFiles: files.map((f) => ({ filePath: f.filePath, status: f.status })),
      snapshotReady: true,
    }, null, 2));
  } finally {
    await snapshot.cleanup();
  }
}

main().catch((error: unknown) => {
  console.error('Ingestion failed:', error instanceof Error ? error.name : 'unknown');
  process.exit(1);
});
