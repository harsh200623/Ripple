import * as path from 'node:path';
import { normalizePath } from '../parser/file-types.js';

export interface ResolveResult {
  resolvedPath?: string;
  rawSpecifier: string;
  isLocal: boolean;
  success: boolean;
  warning?: string;
}

const EXTENSIONS_TO_PROBE = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
];

const INDEX_FILENAMES = [
  'index.ts',
  'index.tsx',
  'index.js',
  'index.jsx',
];

/**
 * Checks whether an import specifier is a relative or local file reference.
 */
export function isLocalSpecifier(specifier: string): boolean {
  if (!specifier) return false;
  const trimmed = specifier.trim();
  return (
    trimmed.startsWith('./') ||
    trimmed.startsWith('../') ||
    trimmed === '.' ||
    trimmed === '..' ||
    trimmed.startsWith('/')
  );
}

/**
 * Resolves an import specifier from an importer file path against the set of repository files.
 *
 * Supports:
 * - Relative imports (./, ../)
 * - Extension-less imports
 * - TypeScript ESM .js -> .ts mapping
 * - Index file resolution (e.g. dir/ -> dir/index.ts)
 */
export function resolveModule(
  importerFilePath: string,
  importSpecifier: string,
  knownFiles: Set<string>
): ResolveResult {
  const rawSpecifier = importSpecifier.trim();

  // If not a local relative import, it's an external module (e.g. 'react', 'express', 'node:fs')
  if (!isLocalSpecifier(rawSpecifier)) {
    return {
      rawSpecifier,
      isLocal: false,
      success: false,
    };
  }

  const importerDir = path.posix.dirname(normalizePath(importerFilePath));
  // Join directory with import specifier and normalize
  const joined = path.posix.join(importerDir, rawSpecifier);
  const candidate = normalizePath(joined);

  // 1. Exact match
  if (knownFiles.has(candidate)) {
    return {
      resolvedPath: candidate,
      rawSpecifier,
      isLocal: true,
      success: true,
    };
  }

  // 2. Extension probing (if specifier didn't include extension or file isn't found directly)
  for (const ext of EXTENSIONS_TO_PROBE) {
    const withExt = candidate + ext;
    if (knownFiles.has(withExt)) {
      return {
        resolvedPath: withExt,
        rawSpecifier,
        isLocal: true,
        success: true,
      };
    }
  }

  // 3. TypeScript ESM mapping: import from './foo.js' where file on disk is 'foo.ts' or 'foo.tsx'
  if (candidate.endsWith('.js') || candidate.endsWith('.jsx')) {
    const baseWithoutJs = candidate.slice(0, candidate.lastIndexOf('.'));
    for (const ext of ['.ts', '.tsx']) {
      const tsCandidate = baseWithoutJs + ext;
      if (knownFiles.has(tsCandidate)) {
        return {
          resolvedPath: tsCandidate,
          rawSpecifier,
          isLocal: true,
          success: true,
        };
      }
    }
  }

  // 4. Index file resolution (e.g. './services/auth' -> 'services/auth/index.js' or 'index.ts')
  for (const indexName of INDEX_FILENAMES) {
    const withIndex = path.posix.join(candidate, indexName);
    if (knownFiles.has(withIndex)) {
      return {
        resolvedPath: withIndex,
        rawSpecifier,
        isLocal: true,
        success: true,
      };
    }
  }

  // Local import that could not be resolved
  return {
    rawSpecifier,
    isLocal: true,
    success: false,
    warning: `Unresolved local import "${rawSpecifier}" in ${normalizePath(importerFilePath)}`,
  };
}
