import { describe, expect, it } from 'vitest';
import {
  isLocalSpecifier,
  resolveModule,
} from '../src/domain/analysis/resolver/module-resolver.js';

describe('Module Resolver', () => {
  const knownFiles = new Set([
    'src/auth.js',
    'src/users.js',
    'src/services/auth.js',
    'src/services/payment/index.js',
    'src/models/user.ts',
    'src/components/button/index.tsx',
    'src/utils/math.ts',
  ]);

  it('correctly classifies local vs external imports', () => {
    expect(isLocalSpecifier('./auth.js')).toBe(true);
    expect(isLocalSpecifier('../services/auth')).toBe(true);
    expect(isLocalSpecifier('./payment/index')).toBe(true);

    expect(isLocalSpecifier('react')).toBe(false);
    expect(isLocalSpecifier('express')).toBe(false);
    expect(isLocalSpecifier('@types/node')).toBe(false);
    expect(isLocalSpecifier('node:fs')).toBe(false);
  });

  it('ignores external package imports from graph resolution', () => {
    const result = resolveModule('src/users.js', 'express', knownFiles);
    expect(result.isLocal).toBe(false);
    expect(result.success).toBe(false);
    expect(result.resolvedPath).toBeUndefined();
  });

  it('resolves direct relative imports with extensions', () => {
    const result = resolveModule('src/users.js', './auth.js', knownFiles);
    expect(result.success).toBe(true);
    expect(result.resolvedPath).toBe('src/auth.js');
  });

  it('resolves extension-less imports by probing .js and .ts', () => {
    const result = resolveModule(
      'src/controllers/user.controller.ts',
      '../models/user',
      knownFiles
    );
    expect(result.success).toBe(true);
    expect(result.resolvedPath).toBe('src/models/user.ts');
  });

  it('resolves index files inside directories', () => {
    const result = resolveModule(
      'src/app.js',
      './services/payment',
      knownFiles
    );
    expect(result.success).toBe(true);
    expect(result.resolvedPath).toBe('src/services/payment/index.js');
  });

  it('resolves TypeScript ESM imports where import specifier ends in .js but source is .ts', () => {
    const result = resolveModule('src/app.ts', './utils/math.js', knownFiles);
    expect(result.success).toBe(true);
    expect(result.resolvedPath).toBe('src/utils/math.ts');
  });

  it('returns warning for unresolved local imports without creating false paths', () => {
    const result = resolveModule(
      'src/users.js',
      './non-existent-module',
      knownFiles
    );
    expect(result.isLocal).toBe(true);
    expect(result.success).toBe(false);
    expect(result.resolvedPath).toBeUndefined();
    expect(result.warning).toContain('Unresolved local import');
  });
});
