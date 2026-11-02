#!/usr/bin/env node
/**
 * Verifies the locale catalogs stay structurally in sync and that every
 * literal `t('ns.key')` call site resolves to a message in both languages.
 *
 * Exit code 1 on any problem so it can gate CI.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const LOCALE_DIR = join(ROOT, 'src/locales');
const SRC_DIR = join(ROOT, 'src');

const problems = [];

/** Flatten `{ common: { save: 'x' } }` into `['common.save']`. */
function flatten(node, prefix = '', out = []) {
  for (const [key, value] of Object.entries(node)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') flatten(value, full, out);
    else out.push(full);
  }
  return out;
}

/** Load a catalog without a bundler: extract the object literal and eval it. */
async function loadCatalog(locale) {
  const dir = join(LOCALE_DIR, locale);
  const tree = {};
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.ts') || file === 'index.ts') continue;
    const source = readFileSync(join(dir, file), 'utf8');
    const namespace = file.replace(/\.ts$/, '');
    // Two export forms are supported:
    //   export default { ... }      (bare object literal)
    //   export default identifier;  (identifier bound to an object literal above)
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
      problems.push(`${relative(ROOT, file)}: 找不到对象字面量导出`);
      continue;
    }
    let depth = 0;
    let end = -1;
    for (let i = start; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') {
        depth -= 1;
        if (depth === 0) { end = i; break; }
      }
    }
    const body = source.slice(start, end + 1).replace(/\s+as const/g, '');
    const parsed = new Function(`return (${body});`)();
    // zh-CN exports `{ nav }` rather than the bare map; unwrap when unambiguous.
    const keys = Object.keys(parsed);
    tree[namespace] = keys.length === 1 && parsed[namespace] ? parsed[namespace] : parsed;
  }
  return flatten(tree);
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

const en = await loadCatalog('en-US');
const zh = await loadCatalog('zh-CN');

const missingInZh = en.filter((key) => !zh.includes(key));
const extraInZh = zh.filter((key) => !en.includes(key));

for (const key of missingInZh) problems.push(`zh-CN 缺少词条: ${key}`);
for (const key of extraInZh) problems.push(`zh-CN 多余词条（en-US 无对应）: ${key}`);

// Check every literal t('ns.key') call site.
const KEY_CALL = /\bt\(\s*['"]([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+)['"]/g;
let callSites = 0;
for (const file of walk(SRC_DIR)) {
  const source = readFileSync(file, 'utf8');
  let match;
  while ((match = KEY_CALL.exec(source))) {
    callSites += 1;
    const key = match[1];
    if (!en.includes(key)) {
      problems.push(`${relative(ROOT, file)}: 使用了未定义的词条 "${key}"`);
    }
  }
}

console.log(`词条数: en-US=${en.length} zh-CN=${zh.length}`);
console.log(`扫描到 t() 字面量调用: ${callSites} 处`);

if (problems.length) {
  console.error(`\n发现 ${problems.length} 个问题:`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}

console.log('i18n 校验通过');
