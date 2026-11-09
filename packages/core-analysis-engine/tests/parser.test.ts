import { describe, expect, it } from 'vitest';
import { parseSourceFile } from '../src/domain/analysis/parser/ast-parser.js';
import {
  detectLanguage,
  isExcludedPath,
  isSupportedFile,
  normalizePath,
} from '../src/domain/analysis/parser/file-types.js';

describe('File types and path normalization', () => {
  it('normalizes paths with forward slashes and strips leading ./', () => {
    expect(normalizePath('.\\src\\auth.js')).toBe('src/auth.js');
    expect(normalizePath('src/controllers/user.controller.ts')).toBe(
      'src/controllers/user.controller.ts'
    );
    expect(normalizePath('./src/services/')).toBe('src/services');
  });

  it('detects supported file extensions and ignores unsupported', () => {
    expect(isSupportedFile('src/auth.js')).toBe(true);
    expect(isSupportedFile('src/auth.ts')).toBe(true);
    expect(isSupportedFile('src/component.tsx')).toBe(true);
    expect(isSupportedFile('src/component.jsx')).toBe(true);
    expect(isSupportedFile('src/module.mjs')).toBe(false);
    expect(isSupportedFile('src/module.cjs')).toBe(false);

    expect(isSupportedFile('README.md')).toBe(false);
    expect(isSupportedFile('package.json')).toBe(false);
    expect(isSupportedFile('logo.png')).toBe(false);
    expect(isSupportedFile('styles.css')).toBe(false);
  });

  it('detects excluded directories', () => {
    expect(isExcludedPath('node_modules/lodash/index.js')).toBe(true);
    expect(isExcludedPath('dist/bundle.js')).toBe(true);
    expect(isExcludedPath('build/app.js')).toBe(true);
    expect(isExcludedPath('.next/server/page.js')).toBe(true);
    expect(isExcludedPath('src/services/auth.ts')).toBe(false);
  });

  it('detects language accurately', () => {
    expect(detectLanguage('src/app.ts')).toBe('typescript');
    expect(detectLanguage('src/app.tsx')).toBe('typescript');
    expect(detectLanguage('src/app.js')).toBe('javascript');
    expect(detectLanguage('src/app.jsx')).toBe('javascript');
  });
});

describe('AST Code Parsing (Tree-sitter)', () => {
  it('parses JavaScript import and export declarations', async () => {
    const code = `
      import { authenticate } from "./auth.js";
      import User from "./models/user";

      export function getUser(user) {
        return authenticate(user);
      }

      export default class UserService {}
    `;

    const parsed = await parseSourceFile('src/users.js', code);

    expect(parsed.language).toBe('javascript');
    expect(parsed.imports.some((i) => i.source === './auth.js')).toBe(true);
    expect(parsed.imports.some((i) => i.source === './models/user')).toBe(true);

    const authImport = parsed.imports.find((i) => i.source === './auth.js');
    expect(authImport?.importedNames).toContain('authenticate');

    expect(parsed.exports.some((e) => e.name === 'getUser')).toBe(true);
    expect(parsed.exports.some((e) => e.isDefault)).toBe(true);
  });

  it('parses TypeScript import declarations with type annotations', async () => {
    const code = `
      import type { UserProfile } from "./types";
      import { authenticate } from "./auth";

      export interface ServiceResponse {
        success: boolean;
        profile: UserProfile;
      }

      export const fetchProfile = async (id: string): Promise<UserProfile> => {
        return { id } as any;
      };
    `;

    const parsed = await parseSourceFile('src/profile.ts', code);

    expect(parsed.language).toBe('typescript');
    expect(parsed.imports.some((i) => i.source === './types')).toBe(true);
    expect(parsed.imports.some((i) => i.source === './auth')).toBe(true);
    expect(parsed.exports.some((e) => e.name === 'fetchProfile')).toBe(true);
  });

  it('identifies re-exports as dependencies', async () => {
    const code = `
      export { authenticate } from "./auth.js";
      export * from "./utils";
    `;

    const parsed = await parseSourceFile('src/index.js', code);

    expect(parsed.imports.some((i) => i.source === './auth.js')).toBe(true);
    expect(parsed.imports.some((i) => i.source === './utils')).toBe(true);
    expect(parsed.exports.some((e) => e.isReExport)).toBe(true);
  });

  it('identifies dynamic imports and CommonJS requires', async () => {
    const code = `
      const config = require("./config.json");
      async function load() {
        const helper = await import("./helpers");
        return helper;
      }
    `;

    const parsed = await parseSourceFile('src/loader.js', code);

    expect(parsed.imports.some((i) => i.source === './config.json' && i.isCommonJs)).toBe(
      true
    );
    expect(parsed.imports.some((i) => i.source === './helpers' && i.isDynamic)).toBe(
      true
    );
  });
});
