import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { realAnalysisEngine } from '../src/analysis/real';
import type { AnalysisInput } from '../src/analysis/types';

describe('real analysis engine adapter', () => {
  let checkoutPath: string;

  beforeEach(async () => {
    checkoutPath = await mkdtemp(path.join(os.tmpdir(), 'ripple-engine-test-'));
  });

  afterEach(async () => {
    await rm(checkoutPath, { recursive: true, force: true });
  });

  it('maps dependency graph, impact results, and documented risk factors', async () => {
    await mkdir(path.join(checkoutPath, 'src'));
    await writeFile(path.join(checkoutPath, 'src/auth.ts'), 'export const auth = () => true;');
    await writeFile(
      path.join(checkoutPath, 'src/service.ts'),
      "import { auth } from './auth'; export const service = () => auth();",
    );
    await mkdir(path.join(checkoutPath, 'node_modules'));
    await writeFile(path.join(checkoutPath, 'node_modules/vendor.ts'), 'export const vendor = true;');

    const result = await realAnalysisEngine(input(checkoutPath));

    expect(result.graph.edges).toEqual([
      { source: 'src/service.ts', target: 'src/auth.ts', importPath: './auth' },
    ]);
    expect(result.graph.nodes.map((node) => node.filePath)).not.toContain('node_modules/vendor.ts');
    expect(result.affectedFiles).toEqual(expect.arrayContaining([
      expect.objectContaining({ filePath: 'src/auth.ts', status: 'changed', prStatus: 'modified' }),
      expect.objectContaining({ filePath: 'src/service.ts', status: 'direct_affected', impactDepth: 1 }),
    ]));
    expect(result.riskBreakdown.map((factor) => factor.name)).toEqual([
      'blast_radius',
      'impact_depth',
      'criticality',
      'change_size',
    ]);
    expect(result.riskLevel).toMatch(/^(low|medium|high|critical)$/);
    expect(result.partial).toBe(false);
  });

  it('marks results partial when the repository file cap is reached', async () => {
    await mkdir(path.join(checkoutPath, 'src'));
    await writeFile(path.join(checkoutPath, 'src/a.ts'), 'export const a = 1;');
    await writeFile(path.join(checkoutPath, 'src/b.ts'), 'export const b = 2;');

    const result = await realAnalysisEngine(input(checkoutPath, {
      changedFiles: [{
        filePath: 'src/a.ts',
        status: 'modified',
        additions: 1,
        deletions: 0,
      }],
      limits: { maxFiles: 1, timeoutMs: 10_000 },
    }));

    expect(result.partial).toBe(true);
    expect(result.warnings).toContainEqual(expect.objectContaining({
      code: 'ANALYSIS_FILE_LIMIT_REACHED',
    }));
    expect(result.graph.nodes).toHaveLength(1);
  });

  it('preserves deleted files and maps GitHub removed status', async () => {
    const result = await realAnalysisEngine(input(checkoutPath, {
      changedFiles: [{
        filePath: 'src/deleted.ts',
        status: 'removed',
        additions: 0,
        deletions: 12,
      }],
    }));

    expect(result.partial).toBe(true);
    expect(result.affectedFiles).toContainEqual(expect.objectContaining({
      filePath: 'src/deleted.ts',
      status: 'changed',
      prStatus: 'removed',
    }));
    expect(result.warnings).toContainEqual(expect.objectContaining({
      code: 'MISSING_CHANGED_FILE',
    }));
  });

  it('stops scanning when its timeout signal is aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(realAnalysisEngine(input(checkoutPath, {
      limits: { maxFiles: 10, timeoutMs: 10_000, signal: controller.signal },
    }))).rejects.toThrow('Analysis was aborted');
  });
});

function input(checkoutPath: string, overrides: Partial<AnalysisInput> = {}): AnalysisInput {
  return {
    checkoutPath,
    headSha: 'a'.repeat(40),
    changedFiles: [{
      filePath: 'src/auth.ts',
      status: 'modified',
      additions: 5,
      deletions: 2,
    }],
    limits: { maxFiles: 100, timeoutMs: 10_000 },
    ...overrides,
  };
}
