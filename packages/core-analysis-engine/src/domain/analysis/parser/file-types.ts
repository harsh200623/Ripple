import * as path from 'node:path';
import { SupportedLanguage } from '../types.js';

export const SUPPORTED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
]);

export const EXCLUDED_DIR_PATTERNS = [
  /(?:^|\/)node_modules\//i,
  /(?:^|\/)dist\//i,
  /(?:^|\/)build\//i,
  /(?:^|\/)coverage\//i,
  /(?:^|\/)\.git\//i,
  /(?:^|\/)\.next\//i,
];

/**
 * Normalizes a file path to POSIX format with forward slashes,
 * removing leading './' and trailing slashes.
 */
export function normalizePath(filePath: string): string {
  if (!filePath) return '';
  const posixPath = filePath.replace(/\\/g, '/').trim();
  const cleaned = path.posix.normalize(posixPath);
  return cleaned.replace(/^\.\//, '').replace(/\/$/, '');
}

/**
 * Determines whether a file path has a supported extension.
 */
export function isSupportedFile(filePath: string): boolean {
  const ext = path.posix.extname(normalizePath(filePath)).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

/**
 * Determines whether a path is in an excluded directory (e.g. node_modules, dist, build).
 */
export function isExcludedPath(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  return EXCLUDED_DIR_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Detects whether a file is TypeScript or JavaScript based on extension.
 */
export function detectLanguage(filePath: string): SupportedLanguage {
  const ext = path.posix.extname(normalizePath(filePath)).toLowerCase();
  if (ext === '.ts' || ext === '.tsx') {
    return 'typescript';
  }
  return 'javascript';
}

/**
 * Checks whether a file is a test or spec file.
 */
export function isTestFile(filePath: string): boolean {
  const normalized = normalizePath(filePath).toLowerCase();
  return (
    normalized.includes('.test.') ||
    normalized.includes('.spec.') ||
    normalized.includes('__tests__/') ||
    normalized.includes('/tests/') ||
    normalized.includes('/test/')
  );
}
