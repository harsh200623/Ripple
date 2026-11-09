import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  AnalysisFileResult,
  AnalysisResult,
  AnalysisSummary,
  AnalyzeRepositoryParams,
  ChangedFileObject,
  DependencyEdge,
  ParsedModule,
  RepositoryFileObject,
} from './types.js';
import {
  isExcludedPath,
  isSupportedFile,
  normalizePath,
} from './parser/file-types.js';
import { parseSourceFile } from './parser/ast-parser.js';
import { resolveModule } from './resolver/module-resolver.js';
import { DependencyGraph } from './graph/dependency-graph.js';
import { calculateBlastRadius } from './blast-radius/traversal.js';
import {
  buildAnalysisFiles,
  calculateRiskScore,
} from './scoring/risk-scorer.js';
import { WarningCollector } from './warnings/warning-collector.js';

/**
 * Normalizes input repository file entries into a consistent object structure.
 */
function normalizeRepositoryFiles(
  files: (string | RepositoryFileObject)[]
): RepositoryFileObject[] {
  return files.map((item) => {
    if (typeof item === 'string') {
      return { path: normalizePath(item) };
    }
    return {
      path: normalizePath(item.path),
      content: item.content,
    };
  });
}

/**
 * Normalizes input changed file entries into a consistent object structure.
 */
function normalizeChangedFiles(
  changed: (string | ChangedFileObject)[]
): ChangedFileObject[] {
  return changed.map((item) => {
    if (typeof item === 'string') {
      return {
        path: normalizePath(item),
        status: 'modified',
      };
    }
    return {
      ...item,
      path: normalizePath(item.path),
      status: item.status || 'modified',
    };
  });
}

/**
 * Reads file content from filesystem if not already provided in memory.
 */
async function loadFileContent(
  file: RepositoryFileObject,
  rootDir?: string
): Promise<string> {
  if (file.content !== undefined) {
    return file.content;
  }

  if (rootDir) {
    const fullPath = path.resolve(rootDir, file.path);
    try {
      return await fs.promises.readFile(fullPath, 'utf-8');
    } catch {
      throw new Error(`Unable to read repository file ${file.path}`);
    }
  }

  return '';
}

/**
 * Standalone repository impact analysis function (Person 2 Deliverable).
 *
 * Given repository source files and PR changed files, builds an AST-backed
 * dependency graph, traverses downstream blast radius using reverse BFS,
 * calculates heuristic risk, and formats structured output for Person 3's dashboard.
 */
export async function analyzeRepository(
  params: AnalyzeRepositoryParams
): Promise<AnalysisResult> {
  const { repositoryFiles, changedFiles, options } = params;
  const warnings = new WarningCollector();

  const normalizedRepoFiles = normalizeRepositoryFiles(repositoryFiles);
  const normalizedChangedFiles = normalizeChangedFiles(changedFiles);

  const changedFilesMap = new Map<string, ChangedFileObject>();
  for (const changed of normalizedChangedFiles) {
    changedFilesMap.set(changed.path, changed);
  }

  // 1. Identify valid and supported repository files
  const supportedRepoFiles: RepositoryFileObject[] = [];
  const knownFilesSet = new Set<string>();

  for (const file of normalizedRepoFiles) {
    if (isExcludedPath(file.path)) {
      continue;
    }

    if (!isSupportedFile(file.path)) {
      // If a changed file is unsupported (e.g. .md, .json), record a warning
      if (changedFilesMap.has(file.path)) {
        warnings.addUnsupportedFile(file.path);
      }
      continue;
    }

    supportedRepoFiles.push(file);
    knownFilesSet.add(file.path);
  }

  // Also verify whether all changed files exist in the repository
  const existingChangedFiles: string[] = [];
  for (const changed of normalizedChangedFiles) {
    if (isSupportedFile(changed.path)) {
      if (knownFilesSet.has(changed.path)) {
        existingChangedFiles.push(changed.path);
      } else {
        warnings.addMissingChangedFile(changed.path, changed.status);
      }
    } else {
      warnings.addUnsupportedFile(changed.path);
    }
  }

  // 2. Parse all supported source files to extract imports and exports
  const parsedModules: ParsedModule[] = [];

  for (const file of supportedRepoFiles) {
    if (options?.signal?.aborted) {
      throw new Error('Analysis was aborted');
    }

    try {
      const content = await loadFileContent(file, options?.rootDir);
      const parsed = await parseSourceFile(file.path, content);

      for (const err of parsed.parseErrors) {
        warnings.addParseError(file.path, err);
      }

      parsedModules.push(parsed);
    } catch (err: any) {
      warnings.addParseError(file.path, err?.message || String(err));
    }
  }

  // 3. Build the Dependency Graph using Graphology
  const graph = new DependencyGraph();

  // Add all files as graph nodes
  for (const parsed of parsedModules) {
    graph.addOrUpdateNode(parsed.filePath, {
      language: parsed.language,
      exports: parsed.exports.map((e) => e.name || 'default'),
      imports: parsed.imports.map((i) => i.source),
    });
  }

  // 4. Resolve module imports and add directed edges
  const dependencyEdges: DependencyEdge[] = [];

  for (const parsed of parsedModules) {
    if (options?.signal?.aborted) {
      throw new Error('Analysis was aborted');
    }

    const importerPath = parsed.filePath;

    for (const imp of parsed.imports) {
      const resolution = resolveModule(importerPath, imp.source, knownFilesSet);

      if (resolution.success && resolution.resolvedPath) {
        // Direct dependency edge: importer -> target
        graph.addDependencyEdge(importerPath, resolution.resolvedPath, imp.source);
        dependencyEdges.push({
          source: importerPath,
          target: resolution.resolvedPath,
          importPath: imp.source,
        });
      } else if (resolution.isLocal && resolution.warning) {
        // Unresolved local import: log warning and do NOT guess edge
        warnings.add(resolution.warning);
      }
    }
  }

  // 5. Blast-Radius Calculation via reverse BFS graph traversal
  const traversal = calculateBlastRadius(graph, existingChangedFiles, {
    maxDepth: options?.maxTraversalDepth,
  });

  // 6. Risk Scoring Algorithm
  const scoreResult = calculateRiskScore({
    traversal,
    graph,
    changedFileMetadata: changedFilesMap,
  });

  // 7. Format structured output for Person 3 and API contracts
  const structuredFiles: AnalysisFileResult[] = buildAnalysisFiles(
    traversal,
    scoreResult.fileScores,
    changedFilesMap
  );

  // If any changed files were not in the graph (e.g. deleted or unsupported), include them
  for (const changed of normalizedChangedFiles) {
    const alreadyIncluded = structuredFiles.some((f) => f.path === changed.path);
    if (!alreadyIncluded) {
      structuredFiles.unshift({
        path: changed.path,
        type: 'changed',
        status: 'changed',
        riskScore: isSupportedFile(changed.path) ? 75 : 20,
        impactDepth: 0,
        reasons: [
          changed.status === 'deleted'
            ? 'Deleted file in PR (not present in current repository snapshot)'
            : 'Non-source file changed in PR',
        ],
        prStatus: changed.status || 'modified',
      });
    }
  }

  // Deduplicate dependencies list
  const uniqueEdges: DependencyEdge[] = [];
  const edgeSet = new Set<string>();

  for (const edge of dependencyEdges) {
    const key = `${edge.source}->${edge.target}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      uniqueEdges.push(edge);
    }
  }

  const directAffectedCount = traversal.directAffected.length;
  const indirectAffectedCount = traversal.indirectAffected.length;
  const totalAffectedCount = directAffectedCount + indirectAffectedCount;

  const summary: AnalysisSummary = {
    riskScore: scoreResult.riskScore,
    riskLevel: scoreResult.riskLevel,
    changedFileCount: normalizedChangedFiles.length,
    directAffectedCount,
    indirectAffectedCount,
    totalAffectedCount,
    maxImpactDepth: traversal.maxImpactDepth,
    breakdown: scoreResult.breakdown,
    warnings: warnings.getAll(),
  };

  return {
    riskScore: scoreResult.riskScore,
    riskLevel: scoreResult.riskLevel,
    changedFiles: normalizedChangedFiles.length,
    affectedFiles: totalAffectedCount,
    files: structuredFiles,
    dependencies: uniqueEdges,
    reasons: scoreResult.reasons,
    summary,
    warnings: warnings.getAll(),
  };
}
