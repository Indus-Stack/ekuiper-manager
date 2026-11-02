'use client';

import * as React from 'react';

import enUS from '@/locales/en-US';
import zhCN from '@/locales/zh-CN';

import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, type Locale, isLocale } from './config';
import { createCatalog, type Translate } from './translate';

const CATALOG = createCatalog({ 'en-US': enUS, 'zh-CN': zhCN });

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
}

const I18nContext = React.createContext<I18nContextValue | null>(null);

function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Always start from the default so server and first client render agree.
  // The stored preference is read in an effect to avoid a hydration mismatch.
  const [locale, setLocaleState] = React.useState<Locale>(DEFAULT_LOCALE);

  React.useEffect(() => {
    setLocaleState(readStoredLocale());
  }, []);

  React.useEffect(() => {
    document.documentElement.setAttribute('lang', locale);
  }, [locale]);

  const setLocale = React.useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable (private mode); the session still switches.
    }
  }, []);

  const value = React.useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t: CATALOG[locale] }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = React.useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside <I18nProvider>');
  return context;
}

export function useT(): Translate {
  return useI18n().t;
}
