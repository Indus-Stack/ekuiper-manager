/**
 * Locale identifiers are BCP-47 (hyphenated) so they feed `Intl.*` directly.
 * The gateway project used both `zh_CN` and `zh-CN`; we standardise on one form.
 */
export const LOCALES = ['en-US', 'zh-CN'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en-US';

export const LOCALE_STORAGE_KEY = 'ekuiper.locale';

/** Labels are always rendered in their own language, never translated. */
export const LOCALE_LABELS: Record<Locale, string> = {
  'en-US': 'English',
  'zh-CN': '简体中文',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Metadata labels carry a two-letter `en` / `zh` key (not BCP-47), so the
 * Translator locale has to be mapped down before lookup.
 */
export function toShortLang(locale: Locale): 'en' | 'zh' {
  return locale === 'zh-CN' ? 'zh' : 'en';
}
