import type { AnalysisEngine, AnalysisOutput } from './types';

/**
 * Deterministic stand-in engine used until Part 2 lands. It reports every changed
 * file as "changed", emits no dependency edges, and marks the result as partial so
 * the UI can never present it as a complete impact analysis.
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
