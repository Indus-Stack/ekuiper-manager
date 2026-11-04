#!/usr/bin/env node
/**
 * Verifies the locale catalogs stay structurally in sync, share identical
 * `{placeholder}` sets across locales, and that every statically analyzable
 * `t('ns.key', ...)` call site in `src/` resolves to a defined key and passes
 * all required interpolation variables.
 *
 * Note: Dynamic translation keys and spread/variable interpolation objects
 * cannot be proven statically by this script and must be covered by rendered
 * component/browser tests.
 *
 * Exit code 1 on any problem so it can gate CI.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LOCALE_DIR = join(ROOT, 'src', 'locales');
const SRC_DIR = join(ROOT, 'src');

const PLACEHOLDER_RE = /\{(\w+)\}/g;

/** Extract sorted unique `{name}` placeholder names from a template string. */
export function extractPlaceholders(template) {
  const names = new Set();
  for (const match of String(template).matchAll(PLACEHOLDER_RE)) {
    names.add(match[1]);
  }
  return [...names].sort();
}

/** Flatten `{ common: { save: 'x' } }` into a `Map<'common.save', 'x'>`. */
export function flattenCatalog(node, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(node)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') {
      flattenCatalog(value, full, out);
    } else {
      out.set(full, String(value));
    }
  }
  return out;
}

/** Load a locale directory without a bundler by extracting each namespace object literal. */
export function loadCatalog(locale, localeDir = LOCALE_DIR, rootDir = ROOT, problems = []) {
  const dir = join(localeDir, locale);
  const tree = {};
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.ts') || file === 'index.ts') continue;
    const fullPath = join(dir, file);
    const source = readFileSync(fullPath, 'utf8');
    const namespace = file.replace(/\.ts$/, '');
    let start = -1;
    const literal = /export default\s*\{/.exec(source);
    if (literal) {
      start = source.indexOf('{', literal.index);
    } else {
      const ref = /export default\s+([A-Za-z_$][\w$]*)\s*;/.exec(source);
      if (ref) {
        const decl = new RegExp(`(?:const|let|var)\\s+${ref[1]}\\b[^=]*=\\s*\\{`).exec(source);
        if (decl) start = source.indexOf('{', decl.index);
      }
    }
    if (start < 0) {
      problems.push(`${relative(rootDir, fullPath)}: unable to locate exported catalog object literal`);
      continue;
    }
    let depth = 0;
    let end = -1;
    for (let i = start; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const body = source.slice(start, end + 1).replace(/\s+as const/g, '');
    const parsed = new Function(`return (${body});`)();
    const keys = Object.keys(parsed);
    tree[namespace] = keys.length === 1 && parsed[namespace] ? parsed[namespace] : parsed;
  }
  return flattenCatalog(tree);
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      walk(full, files);
    } else if (/\.tsx?$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

function getStringLiteralValue(node) {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
}

/**
 * Extract statically known translation keys from a `t(...)` first argument.
 * Supports direct string literals (`t('ns.key')`), `byKind(cond, 'ns.k1', 'ns.k2')`,
 * and ternary expressions (`cond ? 'ns.k1' : 'ns.k2'`).
 */
function extractStaticKeys(expr) {
  if (!expr) return [];
  const direct = getStringLiteralValue(expr);
  if (direct) return [direct];

  if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression) && expr.expression.text === 'byKind') {
    const k1 = getStringLiteralValue(expr.arguments[1]);
    const k2 = getStringLiteralValue(expr.arguments[2]);
    return [k1, k2].filter(Boolean);
  }

  if (ts.isConditionalExpression(expr)) {
    return [
      ...extractStaticKeys(expr.whenTrue),
      ...extractStaticKeys(expr.whenFalse),
    ];
  }

  return [];
}

/**
 * Validate catalog parity (keys + `{placeholder}` sets) and scan TypeScript/JSX
 * source files for unknown keys, statically missing interpolation arguments, and
 * empty `{}` JSX expressions.
 *
 * @param {{
 *   enCatalog: Map<string, string>,
 *   zhCatalog: Map<string, string>,
 *   sources: Array<{ filePath: string, content: string }>,
 *   rootDir?: string,
 * }} options
 */
export function validateCatalogsAndSources({ enCatalog, zhCatalog, sources, rootDir = ROOT }) {
  const problems = [];
  let callSites = 0;

  for (const [key, enVal] of enCatalog.entries()) {
    if (!zhCatalog.has(key)) {
      problems.push(`zh-CN missing key: ${key}`);
      continue;
    }
    const zhVal = zhCatalog.get(key);
    if (typeof zhVal === 'string' && zhVal.trim().length === 0) {
      problems.push(`zh-CN has empty translation for key: ${key}`);
    }
    const enVars = extractPlaceholders(enVal);
    const zhVars = extractPlaceholders(zhVal);
    if (enVars.join(',') !== zhVars.join(',')) {
      problems.push(
        `Placeholder mismatch for key "${key}": en-US has {${enVars.join(', ') || 'none'}} vs zh-CN {${zhVars.join(', ') || 'none'}}`,
      );
    }
  }

  for (const key of zhCatalog.keys()) {
    if (!enCatalog.has(key)) {
      problems.push(`zh-CN has extra key not in en-US: ${key}`);
    }
  }

  for (const { filePath, content } of sources) {
    const relPath = relative(rootDir, filePath).replace(/\\/g, '/');
    const scriptKind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, scriptKind);

    const visit = (node) => {
      // Detect empty `{}` JSX expressions inside JSX elements (e.g. `<Button>{}</Button>`).
      if (
        ts.isJsxExpression(node) &&
        !node.expression &&
        node.parent &&
        (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
      ) {
        const rawText = node.getText(sourceFile);
        if (/^\{\s*\}$/.test(rawText)) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          problems.push(`${relPath}:${line + 1} Empty JSX expression "{}" renders blank UI content`);
        }
      }

      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 't' &&
        node.arguments.length >= 1
      ) {
        const candidateKeys = extractStaticKeys(node.arguments[0]).filter((k) =>
          /^[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+$/.test(k),
        );

        if (candidateKeys.length > 0) {
          callSites += candidateKeys.length;
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          const varsArg = node.arguments[1];

          for (const key of candidateKeys) {
            if (!enCatalog.has(key)) {
              problems.push(`${relPath}:${line + 1} Unknown translation key "${key}"`);
              continue;
            }
            const requiredVars = extractPlaceholders(enCatalog.get(key));
            if (requiredVars.length === 0) continue;

            if (
              !varsArg ||
              (ts.isIdentifier(varsArg) && varsArg.text === 'undefined')
            ) {
              problems.push(
                `${relPath}:${line + 1} Key "${key}" requires interpolation variable(s) ${requiredVars.map((v) => `{${v}}`).join(', ')}, but none were passed`,
              );
              continue;
            }

            if (ts.isObjectLiteralExpression(varsArg)) {
              const hasSpread = varsArg.properties.some((prop) => ts.isSpreadAssignment(prop));
              if (!hasSpread) {
                const provided = new Set();
                for (const prop of varsArg.properties) {
                  if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
                    const nameNode = prop.name;
                    if (ts.isIdentifier(nameNode) || ts.isStringLiteral(nameNode)) {
                      provided.add(nameNode.text);
                    }
                  }
                }
                const missing = requiredVars.filter((v) => !provided.has(v));
                if (missing.length > 0) {
                  problems.push(
                    `${relPath}:${line + 1} Key "${key}" is missing required interpolation variable(s): ${missing.map((v) => `{${v}}`).join(', ')}`,
                  );
                }
              }
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  return { problems, callSites };
}

export function runCli(rootDir = ROOT) {
  const localeDir = join(rootDir, 'src', 'locales');
  const srcDir = join(rootDir, 'src');
  const loadProblems = [];
  const enCatalog = loadCatalog('en-US', localeDir, rootDir, loadProblems);
  const zhCatalog = loadCatalog('zh-CN', localeDir, rootDir, loadProblems);
  const sources = walk(srcDir).map((filePath) => ({
    filePath,
    content: readFileSync(filePath, 'utf8'),
  }));

  const { problems: validationProblems, callSites } = validateCatalogsAndSources({
    enCatalog,
    zhCatalog,
    sources,
    rootDir,
  });

  const allProblems = [...loadProblems, ...validationProblems];
  console.log(`Catalog keys: en-US=${enCatalog.size} zh-CN=${zhCatalog.size}`);
  console.log(`Static t() call sites checked: ${callSites}`);

  if (allProblems.length > 0) {
    console.error(`\nFound ${allProblems.length} i18n problem(s):`);
    for (const p of allProblems) console.error('  - ' + p);
    return 1;
  }

  console.log('i18n check passed');
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(runCli());
}
