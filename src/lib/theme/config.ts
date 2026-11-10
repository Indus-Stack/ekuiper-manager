export const THEMES = ['light', 'dark', 'system'] as const;

export type Theme = (typeof THEMES)[number];

export type ResolvedTheme = 'light' | 'dark';

/** Dark stays the default, also when the OS prefers light. */
export const DEFAULT_THEME: Theme = 'dark';

export const THEME_STORAGE_KEY = 'ekuiper.theme';

/** v1.3.0 persisted `'light'` or `'dark'` under the bare `'theme'` key. */
export const LEGACY_THEME_STORAGE_KEY = 'theme';

export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}')||localStorage.getItem('${LEGACY_THEME_STORAGE_KEY}');var d=t==='light'?false:t==='system'?window.matchMedia('(prefers-color-scheme: dark)').matches:true;var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(_){}})();`;

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

