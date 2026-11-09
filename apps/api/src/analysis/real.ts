import { readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import {
  analyzeRepository,
  detectLanguage,
  isExcludedPath,
  isSupportedFile,
} from '@ripple/core-analysis-engine';
import type { ChangedFileStatus } from '@ripple/shared';
import type {
  AffectedFile,
  AnalysisEngine,
  AnalysisOutput,
  AnalysisWarning,
  FileImpactStatus,
  GraphNode,
  RiskFactor,
} from './types';

interface RepositoryScan {
  files: string[];
  warnings: AnalysisWarning[];
}

const EXCLUDED_DIRECTORY_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
]);

export const realAnalysisEngine: AnalysisEngine = async (input): Promise<AnalysisOutput> => {
  const scan = await scanRepository(input.checkoutPath, input.limits.maxFiles, input.limits.signal);
  const result = await analyzeRepository({
    repositoryFiles: scan.files,
    changedFiles: input.changedFiles.map((file) => ({
      path: file.filePath,
      status: toEngineFileStatus(file.status),
      additions: file.additions,
      deletions: file.deletions,
      previousPath: file.previousFilePath ?? undefined,
    })),
    options: {
      rootDir: input.checkoutPath,
      signal: input.limits.signal,
    },
  });

  const changedStatusByPath = new Map(
    input.changedFiles.map((file) => [file.filePath, file.status]),
  );
  const graphNodes: GraphNode[] = result.files.map((file) => ({
    id: file.path,
    filePath: file.path,
    language: isSupportedFile(file.path) ? detectLanguage(file.path) : 'unknown',
    status: file.status,
  }));
  const affectedFiles: AffectedFile[] = result.files
    .filter((file) => file.status !== 'unaffected')
    .map((file) => ({
      filePath: file.path,
      status: file.status,
      impactDepth: file.impactDepth,
      reasons: file.reasons,
      prStatus: changedStatusByPath.get(file.path) ?? toApiFileStatus(file.prStatus),
    }));

  const warnings = [
    ...result.warnings.map(toAnalysisWarning),
    ...scan.warnings,
  ];

  return {
    graph: {
      nodes: graphNodes,
      edges: result.dependencies.map((edge) => ({
        source: edge.source,
        target: edge.target,
        importPath: edge.importPath,
      })),
    },
    affectedFiles,
    riskScore: result.riskScore,
    riskLevel: toApiRiskLevel(result.riskLevel),
    riskBreakdown: toRiskFactors(result.summary.breakdown),
    warnings,
    partial: warnings.length > 0,
  };
};

async function scanRepository(
  checkoutPath: string,
  maxFiles: number,
  signal?: AbortSignal,
): Promise<RepositoryScan> {
  const root = await realpath(checkoutPath);
  const directories = [root];
  const files: string[] = [];
  const warnings: AnalysisWarning[] = [];
  let directoryIndex = 0;
  let limitReached = false;
  let skippedSymlink = false;

  while (directoryIndex < directories.length && !limitReached) {
    throwIfAborted(signal);

    const directory = directories[directoryIndex++];
    if (directory === undefined) {
      continue;
    }
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      throwIfAborted(signal);

      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(root, absolutePath).split(path.sep).join('/');

      if (entry.isSymbolicLink()) {
        skippedSymlink = true;
        continue;
      }

      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRECTORY_NAMES.has(entry.name) && !isExcludedPath(`${relativePath}/placeholder.ts`)) {
          directories.push(absolutePath);
        }
        continue;
      }

      if (!entry.isFile() || !isSupportedFile(relativePath)) {
        continue;
      }

      if (files.length === maxFiles) {
        limitReached = true;
        break;
      }
      files.push(relativePath);
    }
  }

  if (limitReached) {
    warnings.push({
      code: 'ANALYSIS_FILE_LIMIT_REACHED',
      message: `Analysis stopped after reaching the configured limit of ${maxFiles} source files.`,
    });
  }
  if (skippedSymlink) {
    warnings.push({
      code: 'SYMLINK_SKIPPED',
      message: 'Symbolic links were skipped while scanning the repository snapshot.',
    });
  }

  return { files, warnings };
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error('Analysis was aborted');
  }
}

function toEngineFileStatus(status: ChangedFileStatus): 'added' | 'modified' | 'deleted' | 'renamed' {
  switch (status) {
    case 'added':
    case 'copied':
      return 'added';
    case 'removed':
      return 'deleted';
    case 'renamed':
      return 'renamed';
    default:
      return 'modified';
  }
}

function toApiFileStatus(status: string | undefined): ChangedFileStatus | null {
  switch (status) {
    case 'added':
      return 'added';
    case 'modified':
      return 'modified';
    case 'deleted':
      return 'removed';
    case 'renamed':
      return 'renamed';
    default:
      return null;
  }
}

function toApiRiskLevel(level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'): AnalysisOutput['riskLevel'] {
  switch (level) {
    case 'LOW':
      return 'low';
    case 'MEDIUM':
      return 'medium';
    case 'HIGH':
      return 'high';
    case 'CRITICAL':
      return 'critical';
  }
}

function toAnalysisWarning(message: string): AnalysisWarning {
  const code = message.startsWith('Unresolved local import')
    ? 'UNRESOLVED_LOCAL_IMPORT'
    : message.startsWith('Parser warning')
      ? 'PARSE_ERROR'
      : message.startsWith('Unsupported file type')
        ? 'UNSUPPORTED_FILE_TYPE'
        : message.startsWith('Changed file')
          ? 'MISSING_CHANGED_FILE'
          : 'ANALYSIS_WARNING';

  return { code, message };
}

function toRiskFactors(breakdown: {
  blastRadiusPoints: number;
  depthPoints: number;
  criticalityPoints: number;
  changeSizePoints: number;
}): RiskFactor[] {
  return [
    { name: 'blast_radius', value: breakdown.blastRadiusPoints, weight: 40 },
    { name: 'impact_depth', value: breakdown.depthPoints, weight: 20 },
    { name: 'criticality', value: breakdown.criticalityPoints, weight: 20 },
    { name: 'change_size', value: breakdown.changeSizePoints, weight: 20 },
  ];
}
