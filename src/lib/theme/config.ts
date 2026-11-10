export const THEMES = ['light', 'dark', 'system'] as const;

export type Theme = (typeof THEMES)[number];

export type ResolvedTheme = 'light' | 'dark';

/** Dark stays the default, also when the OS prefers light. */
export const DEFAULT_THEME: Theme = 'dark';

export const THEME_STORAGE_KEY = 'ekuiper.theme';

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

