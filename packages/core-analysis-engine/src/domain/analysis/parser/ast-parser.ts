import { createRequire } from 'node:module';
import * as path from 'node:path';
import {
  ExtractedExport,
  ExtractedImport,
  ParsedModule,
} from '../types.js';
import { detectLanguage, normalizePath } from './file-types.js';

// Dynamically handle imports for web-tree-sitter
let treeSitterInitialized = false;
let ParserClass: any = null;
let jsLanguage: any = null;
let tsLanguage: any = null;
let tsxLanguage: any = null;

async function initTreeSitter(): Promise<boolean> {
  if (treeSitterInitialized && ParserClass && jsLanguage && tsLanguage) {
    return true;
  }

  try {
    const mod = await import('web-tree-sitter');
    const Parser = (mod.default || mod) as any;
    await Parser.init();
    ParserClass = Parser;

    const requireFromPackage = createRequire(
      typeof __filename === 'string' ? __filename : path.join(process.cwd(), 'package.json'),
    );
    const jsWasmPath = requireFromPackage.resolve('tree-sitter-wasms/out/tree-sitter-javascript.wasm');
    const tsWasmPath = requireFromPackage.resolve('tree-sitter-wasms/out/tree-sitter-typescript.wasm');
    const tsxWasmPath = requireFromPackage.resolve('tree-sitter-wasms/out/tree-sitter-tsx.wasm');

    [jsLanguage, tsLanguage, tsxLanguage] = await Promise.all([
      Parser.Language.load(jsWasmPath),
      Parser.Language.load(tsWasmPath),
      Parser.Language.load(tsxWasmPath),
    ]);

    treeSitterInitialized = true;
    return true;
  } catch (err) {
    // If Tree-sitter fails to initialize, regex fallback will handle extraction
    return false;
  }
}

function cleanStringLiteral(str: string): string {
  if (!str) return '';
  const trimmed = str.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('`') && trimmed.endsWith('`'))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Parses source code using Tree-sitter AST, with fallback to pattern matching
 * if Tree-sitter is unavailable or encounters syntax errors.
 */
export async function parseSourceFile(
  filePath: string,
  content: string
): Promise<ParsedModule> {
  const normalizedPath = normalizePath(filePath);
  const language = detectLanguage(normalizedPath);
  const ext = path.posix.extname(normalizedPath).toLowerCase();
  const parseErrors: string[] = [];

  const imports: ExtractedImport[] = [];
  const exports: ExtractedExport[] = [];

  const isReady = await initTreeSitter();

  if (isReady && ParserClass) {
    try {
      const parser = new ParserClass();
      if (ext === '.tsx' || ext === '.jsx') {
        parser.setLanguage(tsxLanguage || jsLanguage);
      } else if (language === 'typescript') {
        parser.setLanguage(tsLanguage);
      } else {
        parser.setLanguage(jsLanguage);
      }

      const tree = parser.parse(content);
      const rootNode = tree.rootNode;

      if (rootNode.hasError) {
        parseErrors.push(`Syntax error or incomplete syntax detected in ${normalizedPath}`);
      }

      extractFromAstNode(rootNode, imports, exports);
      parser.delete();
    } catch (err: any) {
      parseErrors.push(
        `Tree-sitter parse failure in ${normalizedPath}: ${err?.message || String(err)}`
      );
    }
  } else {
    parseErrors.push(`Tree-sitter WASM unavailable for ${normalizedPath}, used fallback parser`);
  }

  // Supplement / fallback using regex to ensure no static imports are missed
  const fallbackResults = extractWithRegexFallback(content);

  // Merge imports without duplicates
  for (const fallbackImp of fallbackResults.imports) {
    const existing = imports.find(
      (imp) => imp.source === fallbackImp.source && imp.isDynamic === fallbackImp.isDynamic
    );
    if (!existing) {
      imports.push(fallbackImp);
    } else {
      // Merge imported names if missing
      for (const name of fallbackImp.importedNames) {
        if (!existing.importedNames.includes(name)) {
          existing.importedNames.push(name);
        }
      }
    }
  }

  // Merge exports without duplicates
  for (const fallbackExp of fallbackResults.exports) {
    const existing = exports.find((exp) => exp.name === fallbackExp.name);
    if (!existing) {
      exports.push(fallbackExp);
    }
  }

  return {
    filePath: normalizedPath,
    language,
    imports,
    exports,
    parseErrors,
  };
}

function extractFromAstNode(
  node: any,
  imports: ExtractedImport[],
  exports: ExtractedExport[]
): void {
  if (!node) return;

  switch (node.type) {
    case 'import_statement': {
      const sourceNode =
        node.childForFieldName('source') ||
        findChildByType(node, 'string');
      if (sourceNode) {
        const source = cleanStringLiteral(sourceNode.text);
        const importedNames: string[] = [];
        const isTypeOnly = node.text.startsWith('import type');

        // Extract imported specifiers
        const importClause = node.childForFieldName('import_clause') || findChildByType(node, 'import_clause');
        if (importClause) {
          collectImportedNames(importClause, importedNames);
        }

        imports.push({
          source,
          importedNames,
          isTypeOnly,
          line: node.startPosition ? node.startPosition.row + 1 : undefined,
        });
      }
      break;
    }

    case 'export_statement': {
      const sourceNode =
        node.childForFieldName('source') ||
        findChildByType(node, 'string');

      if (sourceNode) {
        // This is a re-export, e.g. export { x } from './auth'; or export * from './auth';
        const source = cleanStringLiteral(sourceNode.text);
        const importedNames: string[] = [];
        const exportClause = node.childForFieldName('export_clause') || findChildByType(node, 'export_clause');
        if (exportClause) {
          collectImportedNames(exportClause, importedNames);
        }

        // Re-export creates a dependency on the source file!
        imports.push({
          source,
          importedNames,
          line: node.startPosition ? node.startPosition.row + 1 : undefined,
        });

        exports.push({
          isReExport: true,
          source,
          line: node.startPosition ? node.startPosition.row + 1 : undefined,
        });
      } else {
        // Standard export: named, default, function, class, etc.
        collectExportNames(node, exports);
      }
      break;
    }

    case 'call_expression': {
      const funcNode = node.childForFieldName('function');
      const argsNode = node.childForFieldName('arguments');

      if (funcNode && argsNode) {
        const funcText = funcNode.text;
        // CommonJS require('./...')
        if (funcText === 'require') {
          const stringArg = findChildByType(argsNode, 'string');
          if (stringArg) {
            imports.push({
              source: cleanStringLiteral(stringArg.text),
              importedNames: [],
              isCommonJs: true,
              line: node.startPosition ? node.startPosition.row + 1 : undefined,
            });
          }
        }
        // Dynamic import('./...')
        if (funcText === 'import' || funcNode.type === 'import') {
          const stringArg = findChildByType(argsNode, 'string');
          if (stringArg) {
            imports.push({
              source: cleanStringLiteral(stringArg.text),
              importedNames: [],
              isDynamic: true,
              line: node.startPosition ? node.startPosition.row + 1 : undefined,
            });
          }
        }
      }
      break;
    }
  }

  // Recurse children
  for (let i = 0; i < node.namedChildCount; i++) {
    extractFromAstNode(node.namedChild(i), imports, exports);
  }
}

function findChildByType(node: any, type: string): any {
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (child.type === type) return child;
  }
  return null;
}

function collectImportedNames(node: any, names: string[]): void {
  if (!node) return;

  if (node.type === 'identifier') {
    names.push(node.text);
    return;
  }

  if (node.type === 'import_specifier' || node.type === 'export_specifier') {
    const aliasNode = node.childForFieldName('alias');
    const nameNode = node.childForFieldName('name') || findChildByType(node, 'identifier');
    if (aliasNode) {
      names.push(aliasNode.text);
    } else if (nameNode) {
      names.push(nameNode.text);
    }
    return;
  }

  for (let i = 0; i < node.namedChildCount; i++) {
    collectImportedNames(node.namedChild(i), names);
  }
}

function collectExportNames(node: any, exports: ExtractedExport[]): void {
  const line = node.startPosition ? node.startPosition.row + 1 : undefined;

  // Check default export
  if (node.text.includes('export default')) {
    exports.push({ isDefault: true, name: 'default', line });
    return;
  }

  const decl = node.childForFieldName('declaration') || findChildByType(node, 'declaration');
  if (decl) {
    const id = decl.childForFieldName('name') || findChildByType(decl, 'identifier');
    if (id) {
      exports.push({ name: id.text, line });
      return;
    }
  }

  const exportClause = node.childForFieldName('export_clause') || findChildByType(node, 'export_clause');
  if (exportClause) {
    const names: string[] = [];
    collectImportedNames(exportClause, names);
    for (const name of names) {
      exports.push({ name, line });
    }
  }
}

/**
 * Fallback regex extractor to ensure resilient static extraction.
 */
function extractWithRegexFallback(content: string): {
  imports: ExtractedImport[];
  exports: ExtractedExport[];
} {
  const imports: ExtractedImport[] = [];
  const exports: ExtractedExport[] = [];

  // Match import statements: import ... from '...' or import '...'
  const esImportRegex =
    /import\s+(?:type\s+)?(?:([\w*\s{},$]+)\s+from\s+)?['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  while ((match = esImportRegex.exec(content)) !== null) {
    const rawNames = match[1] || '';
    const source = match[2];
    if (!source) continue;

    const importedNames: string[] = [];
    if (rawNames) {
      const cleanNames = rawNames.replace(/[{}]/g, '').split(',');
      for (const item of cleanNames) {
        const trimmed = item.trim();
        if (trimmed) {
          const parts = trimmed.split(/\s+as\s+/);
          const finalName = parts[1] || parts[0];
          if (finalName) importedNames.push(finalName);
        }
      }
    }

    imports.push({
      source,
      importedNames,
      isTypeOnly: match[0].startsWith('import type'),
    });
  }

  // Match export ... from '...' (re-exports)
  const reExportRegex =
    /export\s+(?:type\s+)?(?:([\w*\s{},$]+)\s+from\s+)?['"]([^'"]+)['"]/g;
  while ((match = reExportRegex.exec(content)) !== null) {
    const source = match[2];
    if (!source) continue;

    imports.push({
      source,
      importedNames: [],
    });
    exports.push({
      isReExport: true,
      source,
    });
  }

  // Match dynamic import('...')
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    const source = match[1];
    if (source) {
      imports.push({
        source,
        importedNames: [],
        isDynamic: true,
      });
    }
  }

  // Match require('...')
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    const source = match[1];
    if (source) {
      imports.push({
        source,
        importedNames: [],
        isCommonJs: true,
      });
    }
  }

  // Match export declarations
  const namedExportRegex =
    /export\s+(?:const|let|var|function\*?|class|interface|type|enum)\s+([a-zA-Z_$][0-9a-zA-Z_$]*)/g;
  while ((match = namedExportRegex.exec(content)) !== null) {
    if (match[1]) {
      exports.push({ name: match[1] });
    }
  }

  if (/export\s+default\s+/g.test(content)) {
    exports.push({ name: 'default', isDefault: true });
  }

  return { imports, exports };
}
