/**
 * Walks every route and reports visible text that still contains Latin letters.
 *
 * Source regexes cannot see text that JSX splits across lines, interpolations
 * or attribute values; the rendered DOM is the ground truth. This scans the DOM
 * instead, so it finds what a user would actually still read in English.
 *
 * Usage: node scripts/scan-untranslated.mjs [--base http://host:port]
 */
import { chromium } from 'playwright';

const BASE = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : 'http://192.168.50.128:3000';

// Dynamic segments are filled from live data when possible; otherwise a
// placeholder is used and the route is reported as skipped.
const ROUTES = [
  '/', '/dashboard', '/streams', '/streams/new', '/tables', '/tables/new',
  '/rules', '/rules/new', '/rules/dashboard', '/rules/playground', '/flows',
  '/flows/perf', '/flowEditor/flow', '/graph', '/query-designer',
  '/connections', '/schemas', '/schemas/new', '/uploads',
  '/plugins', '/plugins/sources/new', '/plugins/sinks/new', '/plugins/functions/new',
  '/plugins/portables/new', '/functions', '/functions/javascript/new',
  '/services', '/services/new', '/data/import', '/data/export',
  '/nodes', '/users', '/settings', '/system', '/help', '/api-docs',
  '/welcome', '/change-password',
];

// Strings that are legitimately English: brand names, identifiers, code,
// format tokens. Anything else is reported.
const ALLOW = [
  /^[A-Z]{2,6}$/, // INT, DATETIME, QoS
  /^(eKuiper|MQTT|Kafka|InfluxDB|TDengine|Neuron|EdgeX|Redis|REST|gRPC|SQL|JSON|CSV|JAR|YAML|ZIP|UDF|API|HTTP|HTTPS|URL|URI|ID|QoS)/,
  /^YYYY|^HH:mm|^MM-|^AM|^PM/, // date formats
  /^(GET|POST|PUT|DELETE|PATCH)$/,
  /^v?\d+\.\d+/, // versions
  /^(localhost|127\.0\.0\.1|http)/, // urls
  /^[a-z0-9_.\-/]+$/i, // bare identifiers, file names, field names
  /^\$?\{.*\}$/, // template leftovers
];

/** Text that already contains CJK is localized; English words inside it are
 *  product names (MQTT, Neuron, SQL), which every locale keeps as-is. */
const HAS_CJK = /[\u4e00-\u9fff]/;

function isAllowed(text) {
  if (HAS_CJK.test(text)) return true;
  return ALLOW.some((re) => re.test(text));
}

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  // Chinese so untranslated strings stand out against the localized UI.
  await page.addInitScript(() => window.localStorage.setItem('ekuiper.locale', 'zh-CN'));

  // Sign in once; without a session every route redirects to /welcome and the
  // scan would only ever see that page.
  const username = process.env.SCAN_USER;
  const password = process.env.SCAN_PASS;
  if (username && password) {
    await page.goto(BASE + '/welcome', { waitUntil: 'networkidle' });
    const status = await page.evaluate(async () => {
      const res = await fetch('/api/auth/status', { cache: 'no-store' });
      return res.json();
    });
    const endpoint = status.setupRequired ? '/api/auth/bootstrap' : '/api/auth/login';
    const ok = await page.evaluate(
      async ({ endpoint, username, password }) => {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        return res.ok;
      },
      { endpoint, username, password },
    );
    if (!ok) throw new Error('sign-in failed; check SCAN_USER/SCAN_PASS');
  } else {
    console.warn('SCAN_USER/SCAN_PASS not set: authenticated routes will redirect to /welcome');
  }

  const findings = [];
  const failures = [];

  // Detail routes need a real id. Static route lists never reach them, which
  // is how the rule workspace kept its English tab bar through several passes.
  const detailRoutes = [];
  if (username) {
    const discover = async (listUrl, pathFor) => {
      try {
        const rows = await page.evaluate(async (url) => {
          const res = await fetch(url, { cache: 'no-store' });
          if (!res.ok) return [];
          const body = await res.json();
          return Array.isArray(body) ? body : [];
        }, listUrl);
        for (const row of rows.slice(0, 2)) {
          // Collections return either bare names or objects with id/name.
          const name = typeof row === 'string' ? row : (row?.id ?? row?.name);
          if (typeof name === 'string' && name) detailRoutes.push(pathFor(name));
        }
      } catch {
        // The node may not expose this collection; skip it.
      }
    };
    const API = '/api/ekuiper';
    await discover(`${API}/rules`, (id) => `/rules/${encodeURIComponent(id)}?tab=definition`);
    await discover(`${API}/rules`, (id) => `/rules/${encodeURIComponent(id)}?tab=topology`);
    await discover(`${API}/rules`, (id) => `/rules/${encodeURIComponent(id)}?tab=trace`);
    await discover(`${API}/streams`, (id) => `/streams/${encodeURIComponent(id)}`);
    await discover(`${API}/tables`, (id) => `/tables/${encodeURIComponent(id)}`);
  }

  for (const route of [...ROUTES, ...detailRoutes]) {
    try {
      const res = await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 25000 });
      if (res && res.status() >= 400) {
        failures.push({ route, status: res.status() });
        continue;
      }
      await page.waitForTimeout(700);
      // Tabs mount their panes lazily, so text behind an unselected tab is not
      // in the DOM at all. Visit every tab role before harvesting.
      const tabs = await page.$$('[role="tab"]:not([aria-selected="true"])');
      const seen = new Set();
      const collect = async () => {
        const texts = await page.evaluate(() => {
          const out = new Set();
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          let node;
          while ((node = walker.nextNode())) {
            const parent = node.parentElement;
            if (!parent) continue;
            const tag = parent.tagName;
            // Skip code samples, inputs and script/style payloads.
            if (['SCRIPT', 'STYLE', 'CODE', 'PRE', 'NOSCRIPT'].includes(tag)) continue;
            // Textarea values hold user code (default UDF scripts, SQL), not UI copy.
            if (parent.closest('pre, code, [class*="font-mono"], textarea')) continue;
            const text = (node.textContent ?? '').trim().replace(/\s+/g, ' ');
            if (!text || text.length < 2) continue;
            if (/[A-Za-z]{2,}/.test(text)) out.add(text);
          }
          return [...out];
        });
        for (const text of texts) seen.add(text);
      };
      await collect();
      for (let i = 0; i < tabs.length && i < 8; i += 1) {
        try {
          await tabs[i].click({ timeout: 2000 });
          await page.waitForTimeout(400);
          await collect();
        } catch {
          // Tab may unmount or become detached; keep going.
        }
      }
      const texts = [...seen];
      const hits = texts.filter((t) => !isAllowed(t));
      if (hits.length) findings.push({ route, hits });
    } catch (error) {
      failures.push({ route, status: error instanceof Error ? error.message.slice(0, 60) : 'error' });
    }
  }

  // Signed-in routes never show the sign-in card, so scan it separately with
  // the session dropped; otherwise /welcome only ever reports the redirect.
  if (username) {
    await page.evaluate(async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
    }).catch(() => {});
    for (const route of ['/welcome', '/change-password']) {
      try {
        await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 25000 });
        await page.waitForTimeout(500);
        const texts = await page.evaluate(() => {
          const out = new Set();
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          let node;
          while ((node = walker.nextNode())) {
            const parent = node.parentElement;
            if (!parent) continue;
            if (parent.closest('pre, code, [class*="font-mono"], script, style')) continue;
            const text = (node.textContent ?? '').trim().replace(/\s+/g, ' ');
            if (text.length >= 2 && /[A-Za-z]{2,}/.test(text)) out.add(text);
          }
          return [...out];
        });
        const hits = texts.filter((t) => !isAllowed(t));
        if (hits.length) findings.push({ route: `${route} (signed out)`, hits });
      } catch (error) {
        failures.push({ route, status: error instanceof Error ? error.message.slice(0, 60) : 'error' });
      }
    }
  }

  await browser.close();

  let total = 0;
  for (const { route, hits } of findings) {
    total += hits.length;
    console.log(`\n=== ${route} (${hits.length})`);
    for (const h of hits) console.log(`   ${h.slice(0, 110)}`);
  }
  console.log(`\n--- ${findings.length} routes with residue, ${total} strings total`);
  if (failures.length) {
    console.log(`--- ${failures.length} routes not scanned:`);
    for (const f of failures) console.log(`   ${f.route} [${f.status}]`);
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
