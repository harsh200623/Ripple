/**
 * Domain types for Ripple Core Analysis Engine (PR Weather Radar).
 *
 * Adheres to specifications in:
 * - docs/04-dependency-analysis.md
 * - docs/05-api-and-database.md
 * - docs/03-system-architecture.md
 */

export type SupportedLanguage = 'typescript' | 'javascript';

export type FileImpactStatus =
  | 'changed'
  | 'direct_affected'
  | 'indirect_affected'
  | 'unaffected';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RepositoryFileObject {
  path: string;
  content?: string;
}

export type RepositoryFileInput = string | RepositoryFileObject;

export interface ChangedFileObject {
  path: string;
  additions?: number;
  deletions?: number;
  status?: 'added' | 'modified' | 'deleted' | 'renamed';
  previousPath?: string;
}

export type ChangedFileInput = string | ChangedFileObject;

export interface AnalysisOptions {
  rootDir?: string;
  maxTraversalDepth?: number;
  signal?: AbortSignal;
}

export interface ExtractedImport {
  source: string; // The import path specifier, e.g. "./auth.js"
  importedNames: string[]; // e.g. ["authenticate", "User"]
  isTypeOnly?: boolean;
  isDynamic?: boolean;
  isCommonJs?: boolean;
  line?: number;
}

export interface ExtractedExport {
  name?: string;
  isDefault?: boolean;
  isReExport?: boolean;
  source?: string; // If re-exporting from another module, e.g. export { x } from './y'
  line?: number;
}

export interface ParsedModule {
  filePath: string;
  language: SupportedLanguage;
  imports: ExtractedImport[];
  exports: ExtractedExport[];
  parseErrors: string[];
}

export interface DependencyNode {
  id: string; // Normalized file path
  filePath: string;
  language: SupportedLanguage;
  status: FileImpactStatus;
  impactDepth?: number;
  exports: string[];
  imports: string[];
}

export interface DependencyEdge {
  source: string; // Importer file path
  target: string; // Imported file path
  importPath: string; // Raw import specifier
}

export interface RiskScoreBreakdown {
  blastRadiusPoints: number;
  depthPoints: number;
  criticalityPoints: number;
  changeSizePoints: number;
  total: number;
}

export interface AnalysisSummary {
  riskScore: number;
  riskLevel: RiskLevel;
  changedFileCount: number;
  directAffectedCount: number;
  indirectAffectedCount: number;
  totalAffectedCount: number;
  maxImpactDepth: number;
  breakdown: RiskScoreBreakdown;
  warnings: string[];
}

export interface AnalysisFileResult {
  path: string;
  type: 'changed' | 'affected' | 'unaffected';
  status: FileImpactStatus;
  riskScore: number;
  impactDepth: number;
  reasons: string[];
  prStatus?: string;
}

export interface AnalyzeRepositoryParams {
  repositoryFiles: RepositoryFileInput[];
  changedFiles: ChangedFileInput[];
  options?: AnalysisOptions;
}

export interface AnalysisResult {
  riskScore: number;
  riskLevel: RiskLevel;
  changedFiles: number;
  affectedFiles: number;
  files: AnalysisFileResult[];
  dependencies: DependencyEdge[];
  reasons: string[];
  summary: AnalysisSummary;
  warnings: string[];
}
