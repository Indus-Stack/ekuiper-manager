'use client';

import * as React from 'react';

import { DEFAULT_THEME, THEME_STORAGE_KEY, isTheme, type ResolvedTheme, type Theme } from './config';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

/**
 * The default value lets components that use `useTheme` render without a
 * provider (for example in unit tests). It matches the dark default.
 */
const ThemeContext = React.createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  resolvedTheme: 'dark',
  setTheme: () => {},
});

const DARK_QUERY = '(prefers-color-scheme: dark)';

function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start from the default so server and first client render agree.
  const [theme, setThemeState] = React.useState<Theme>(DEFAULT_THEME);
  const [systemDark, setSystemDark] = React.useState(true);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    setThemeState(readStoredTheme());
    if (typeof window.matchMedia !== 'function') {
      setReady(true);
      return;
    }
    const query = window.matchMedia(DARK_QUERY);
    const update = () => setSystemDark(query.matches);
    update();
    setReady(true);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const resolvedTheme: ResolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  React.useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.style.colorScheme = resolvedTheme;
  }, [ready, resolvedTheme]);

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable (private mode); the session still switches.
    }
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return React.useContext(ThemeContext);
}

