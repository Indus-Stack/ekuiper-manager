import type { Messages } from '@/locales/en-US';

import { DEFAULT_LOCALE, type Locale } from './config';

type Catalog = Record<Locale, Messages>;

/**
 * Dotted key into the message tree, e.g. `common.save`.
 * Typed against the en-US catalog so a typo fails `tsc`, not the user's screen.
 */
export type MessageKey = {
  [NS in keyof Messages]: `${NS & string}.${keyof Messages[NS] & string}`;
}[keyof Messages];

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

const KEY_PATTERN = /^([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)$/;

function getByPath(messages: Messages, key: string): string | undefined {
  const match = KEY_PATTERN.exec(key);
  if (!match) return undefined;

  const [, namespace, leaf] = match;
  const group = (messages as unknown as Record<string, Record<string, string> | undefined>)[namespace];
  return group?.[leaf];
}

/**
 * Interpolates `{name}` placeholders. Missing variables are left verbatim so a
 * broken call is visible in the UI rather than silently rendering "undefined".
 */
export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

export function resolveMessage(messages: Messages, key: string): string | undefined {
  return getByPath(messages, key);
}

export function createTranslator(messages: Messages, fallback: Messages): Translate {
  return (key, vars) => {
    const template = resolveMessage(messages, key) ?? resolveMessage(fallback, key) ?? key;
    return interpolate(template, vars);
  };
}

export function createCatalog(locales: Record<Locale, Messages>): Record<Locale, Translate> {
  const fallback = locales[DEFAULT_LOCALE];
  return {
    'en-US': createTranslator(locales['en-US'], fallback),
    'zh-CN': createTranslator(locales['zh-CN'], fallback),
  };
}

/**
 * Picks one of two locale keys by a resource discriminator.
 * Some screens share a single component across two resource kinds
 * (stream/table), so the key itself has to be selected at the call site.
 */
export function byKind<T extends MessageKey>(kind: 'stream' | 'table', streamKey: T, tableKey: T): T {
  return kind === 'stream' ? streamKey : tableKey;
}

/** eKuiper reports rule status as a raw string; map it to a locale key. */
export function ruleStatusKey(status: string | undefined): MessageKey {
  switch ((status ?? '').toLowerCase()) {
    case 'running':
      return 'layout.statusRunning';
    case 'stopped':
      return 'layout.statusStopped';
    case 'starting':
      return 'common.statusStarting';
    case 'stopping':
      return 'common.statusStopping';
    case 'error':
      return 'layout.statusError';
    default:
      return 'common.statusUnknown';
  }
}

const RULE_STATUS_PREFIX_PATTERN = /^(running|stopped|starting|stopping|error)(?:(\s*:\s*|\s+)([\s\S]+))?$/i;

/**
 * Formats an eKuiper rule status string for UI display while preserving diagnostic suffixes.
 * - Recognized prefixes (`running`, `stopped`, `starting`, `stopping`, `error`) are translated.
 * - Any diagnostic suffix after `:` or whitespace is preserved verbatim.
 * - Unfamiliar nonempty status strings are returned verbatim.
 * - Missing or blank values return the translated "Unknown" label.
 */
export function formatRuleStatus(status: string | null | undefined, t: Translate): string {
  if (typeof status !== 'string' || status.trim().length === 0) {
    return t('common.statusUnknown');
  }
  const trimmed = status.trim();
  const match = RULE_STATUS_PREFIX_PATTERN.exec(trimmed);
  if (!match) {
    return trimmed;
  }
  const [, prefix, sep, suffix] = match;
  const label = t(ruleStatusKey(prefix));
  if (!suffix) {
    return label;
  }
  const normalizedSep = sep.includes(':') ? (/[\u4e00-\u9fff]/.test(label) ? '：' : ': ') : ' ';
  return `${label}${normalizedSep}${suffix}`;
}
