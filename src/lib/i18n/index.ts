export { LOCALES, DEFAULT_LOCALE, LOCALE_STORAGE_KEY, LOCALE_LABELS, isLocale, toShortLang } from './config';
export type { Locale } from './config';
export { I18nProvider, useI18n, useT } from './provider';
export type { Translate, MessageKey } from './translate';
export { createTranslator, resolveMessage, ruleStatusKey, formatRuleStatus } from './translate';
