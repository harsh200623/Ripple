import type { ChangedFileStatus, RiskLevel } from '@ripple/shared';

/**
 * Contract between the API/worker (Part 1) and the analysis engine (Part 2).
 * The engine must be pure: no Express, no database, no network access.
 * Any change here is a shared contract change and must update docs/05-api-and-database.md.
 */

export interface AnalysisInput {
  /** Absolute path to the checked-out PR head snapshot. Read-only; never executed. */
  checkoutPath: string;
  headSha: string;
  changedFiles: ReadonlyArray<{
    filePath: string;
    status: ChangedFileStatus;
    additions?: number;
    deletions?: number;
    previousFilePath?: string | null;
  }>;
  limits: {
    maxFiles: number;
    timeoutMs: number;
    signal?: AbortSignal;
  };
}

export type FileImpactStatus = 'changed' | 'direct_affected' | 'indirect_affected' | 'unaffected';

export interface GraphNode {
  id: string;
  filePath: string;
  language: 'typescript' | 'javascript' | 'unknown';
  status: FileImpactStatus;
}

/** Edge direction: source imports target. */
export interface GraphEdge {
  source: string;
  target: string;
  importPath: string;
}

export interface AffectedFile {
  filePath: string;
  status: FileImpactStatus;
  impactDepth: number;
  reasons: string[];
  prStatus: ChangedFileStatus | null;
}

export interface RiskFactor {
  name: string;
  value: number;
  weight: number;
}

export interface AnalysisWarning {
  code: string;
  message: string;
}

export interface AnalysisOutput {
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  affectedFiles: AffectedFile[];
  riskScore: number;
  riskLevel: RiskLevel;
  riskBreakdown: RiskFactor[];
  warnings: AnalysisWarning[];
  /** True when any file, import, or limit prevented a complete analysis. */
  partial: boolean;
}

/** The engine is a function from validated input to output. It must not throw for expected failures. */
export type AnalysisEngine = (input: AnalysisInput) => Promise<AnalysisOutput>;
