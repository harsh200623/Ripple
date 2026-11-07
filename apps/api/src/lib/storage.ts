import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * Creates a server-generated working directory under TEMP_DIR. Callers must
 * remove it in a finally block via removeWorkspace().
 */
export async function createWorkspace(baseDir: string): Promise<string> {
  await mkdir(baseDir, { recursive: true, mode: 0o700 });
  const prefix = path.join(baseDir, `analysis-${randomBytes(6).toString('hex')}-`);
  return mkdtemp(prefix);
}

/** Removes a workspace. Refuses to delete anything outside the configured base directory. */
export async function removeWorkspace(baseDir: string, workspacePath: string): Promise<void> {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(workspacePath);
  if (!resolvedTarget.startsWith(resolvedBase + path.sep)) {
    throw new Error('Refusing to remove a path outside the analysis workspace.');
  }
  await rm(resolvedTarget, { recursive: true, force: true });
}

/** Total size in bytes of a directory tree, used to enforce MAX_REPO_SIZE_MB. */
export async function directorySizeBytes(dir: string): Promise<number> {
  let total = 0;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      total += await directorySizeBytes(full);
    } else if (entry.isFile()) {
      total += (await stat(full)).size;
    }
  }
  return total;
}
