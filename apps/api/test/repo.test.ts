import { execFileSync } from 'node:child_process';
import { access, mkdtemp, readdir, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { directorySizeBytes, createWorkspace, removeWorkspace } from '../src/lib/storage';
import { runGit } from '../src/lib/git';

/** Builds a local bare-like repo that stands in for GitHub; no network is used. */
async function makeLocalRepo(root: string): Promise<{ dir: string; headSha: string }> {
  const dir = path.join(root, 'upstream');
  await mkdir(dir, { recursive: true });
  execFileSync('git', ['init', '--quiet', dir]);
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'test']);
  await writeFile(path.join(dir, 'a.ts'), 'export const a = 1;\n');
  execFileSync('git', ['-C', dir, 'add', '.']);
  execFileSync('git', ['-C', dir, 'commit', '--quiet', '-m', 'init']);
  const headSha = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD']).toString().trim();
  return { dir, headSha };
}

describe('storage and git helpers (local, no network)', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'ripple-test-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('creates and removes a workspace inside the base dir', async () => {
    const base = path.join(root, 'base');
    const ws = await createWorkspace(base);
    await access(ws);
    await removeWorkspace(base, ws);
    await expect(access(ws)).rejects.toThrow();
  });

  it('refuses to remove a path outside the base directory', async () => {
    const base = path.join(root, 'base');
    await mkdir(base, { recursive: true });
    await expect(removeWorkspace(base, path.join(root, 'elsewhere'))).rejects.toThrow(/outside/);
  });

  it('computes directory size and ignores symlinks', async () => {
    await writeFile(path.join(root, 'one.txt'), 'x'.repeat(10));
    await mkdir(path.join(root, 'sub'));
    await writeFile(path.join(root, 'sub', 'two.txt'), 'y'.repeat(5));
    expect(await directorySizeBytes(root)).toBe(15);
  });

  it('fetches a single commit at an exact SHA using argument-array git calls', async () => {
    const { dir, headSha } = await makeLocalRepo(root);
    const target = path.join(root, 'checkout');
    await runGit(['init', '--quiet', target], { timeoutMs: 20_000 });
    await runGit(['-C', target, 'remote', 'add', 'origin', dir], { timeoutMs: 20_000 });
    await runGit(['-C', target, 'fetch', '--depth', '1', '--no-tags', '--quiet', 'origin', headSha], {
      timeoutMs: 20_000,
    });
    await runGit(['-C', target, 'checkout', '--quiet', '--detach', 'FETCH_HEAD'], { timeoutMs: 20_000 });
    const resolved = (await runGit(['-C', target, 'rev-parse', 'HEAD'], { timeoutMs: 20_000 })).trim();
    expect(resolved).toBe(headSha);
    expect(await readdir(target)).toContain('a.ts');
  });
});
