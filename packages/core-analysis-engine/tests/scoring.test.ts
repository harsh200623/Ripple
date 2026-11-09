import { describe, expect, it } from 'vitest';
import { DependencyGraph } from '../src/domain/analysis/graph/dependency-graph.js';
import { calculateBlastRadius } from '../src/domain/analysis/blast-radius/traversal.js';
import {
  buildAnalysisFiles,
  calculateRiskScore,
} from '../src/domain/analysis/scoring/risk-scorer.js';
import { ChangedFileObject } from '../src/domain/analysis/types.js';

describe('Risk Scoring Algorithm', () => {
  it('calculates bounded risk score and generates explainable reasons', () => {
    const graph = new DependencyGraph();

    graph.addOrUpdateNode('src/auth.js', { language: 'javascript' });
    graph.addOrUpdateNode('src/users.js', { language: 'javascript' });
    graph.addOrUpdateNode('src/orders.js', { language: 'javascript' });
    graph.addOrUpdateNode('src/profile.js', { language: 'javascript' });
    graph.addOrUpdateNode('src/checkout.js', { language: 'javascript' });

    graph.addDependencyEdge('src/users.js', 'src/auth.js', './auth.js');
    graph.addDependencyEdge('src/orders.js', 'src/auth.js', './auth.js');
    graph.addDependencyEdge('src/profile.js', 'src/users.js', './users.js');
    graph.addDependencyEdge('src/checkout.js', 'src/orders.js', './orders.js');

    const traversal = calculateBlastRadius(graph, ['src/auth.js']);

    const changedMap = new Map<string, ChangedFileObject>();
    changedMap.set('src/auth.js', {
      path: 'src/auth.js',
      additions: 120,
      deletions: 30,
      status: 'modified',
    });

    const result = calculateRiskScore({
      traversal,
      graph,
      changedFileMetadata: changedMap,
    });

    // Score bounded 0 - 100
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
    expect(result.riskScore).toBeLessThanOrEqual(100);

    // Because auth is high criticality, has 4 affected files, depth 2, and 150 lines:
    expect(['HIGH', 'CRITICAL']).toContain(result.riskLevel);

    // Explanations present
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(
      result.reasons.some((r) => r.toLowerCase().includes('authentication') || r.toLowerCase().includes('security'))
    ).toBe(true);

    // Factor breakdown
    expect(result.breakdown.blastRadiusPoints).toBeGreaterThan(0);
    expect(result.breakdown.blastRadiusPoints).toBe(14);
    expect(result.breakdown.depthPoints).toBe(10);
    expect(result.breakdown.criticalityPoints).toBe(20);
    expect(result.breakdown.changeSizePoints).toBe(15);
    expect(result.breakdown.total).toBe(59);
  });

  it('produces LOW risk score for isolated non-critical changes', () => {
    const graph = new DependencyGraph();
    graph.addOrUpdateNode('src/components/button.tsx', { language: 'typescript' });

    const traversal = calculateBlastRadius(graph, ['src/components/button.tsx']);
    const changedMap = new Map<string, ChangedFileObject>();
    changedMap.set('src/components/button.tsx', {
      path: 'src/components/button.tsx',
      additions: 5,
      deletions: 2,
    });

    const result = calculateRiskScore({
      traversal,
      graph,
      changedFileMetadata: changedMap,
    });

    expect(result.riskLevel).toBe('LOW');
    expect(result.riskScore).toBeLessThan(30);
  });

  it('formats per-file risk and status for Person 3 dashboard', () => {
    const graph = new DependencyGraph();
    graph.addOrUpdateNode('src/auth.js', { language: 'javascript' });
    graph.addOrUpdateNode('src/users.js', { language: 'javascript' });

    graph.addDependencyEdge('src/users.js', 'src/auth.js', './auth.js');

    const traversal = calculateBlastRadius(graph, ['src/auth.js']);
    const changedMap = new Map<string, ChangedFileObject>();
    changedMap.set('src/auth.js', { path: 'src/auth.js' });

    const scoreResult = calculateRiskScore({
      traversal,
      graph,
      changedFileMetadata: changedMap,
    });

    const files = buildAnalysisFiles(traversal, scoreResult.fileScores, changedMap);

    const changedFile = files.find((f) => f.path === 'src/auth.js');
    const affectedFile = files.find((f) => f.path === 'src/users.js');

    expect(changedFile?.type).toBe('changed');
    expect(changedFile?.status).toBe('changed');
    expect(changedFile?.riskScore).toBeGreaterThanOrEqual(70);

    expect(affectedFile?.type).toBe('affected');
    expect(affectedFile?.status).toBe('direct_affected');
    expect(affectedFile?.impactDepth).toBe(1);
  });
});
