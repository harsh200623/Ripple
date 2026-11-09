import type { AnalysisEngine, AnalysisOutput } from './types';

/**
 * Deterministic stand-in for tests and explicitly selected local experiments.
 * Production server wiring uses the real dependency-analysis engine.
 */
export const fakeAnalysisEngine: AnalysisEngine = async (input): Promise<AnalysisOutput> => {
  const nodes = input.changedFiles.map((file) => ({
    id: file.filePath,
    filePath: file.filePath,
    language: (file.filePath.endsWith('.ts') || file.filePath.endsWith('.tsx')
      ? 'typescript'
      : file.filePath.endsWith('.js') || file.filePath.endsWith('.jsx')
        ? 'javascript'
        : 'unknown') as 'typescript' | 'javascript' | 'unknown',
    status: 'changed' as const,
  }));

  return {
    graph: { nodes, edges: [] },
    affectedFiles: input.changedFiles.map((file) => ({
      filePath: file.filePath,
      status: 'changed' as const,
      impactDepth: 0,
      reasons: ['Changed in this pull request'],
      prStatus: file.status,
    })),
    riskScore: 0,
    riskLevel: 'low',
    riskBreakdown: [],
    warnings: [
      {
        code: 'ENGINE_NOT_IMPLEMENTED',
        message: 'Dependency analysis is not yet available. Only changed files are listed.',
      },
    ],
    partial: true,
  };
};
