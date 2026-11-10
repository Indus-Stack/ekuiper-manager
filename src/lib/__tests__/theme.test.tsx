/**
 * @jest-environment jsdom
 */
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  DEFAULT_THEME,
  LEGACY_THEME_STORAGE_KEY,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  ThemeProvider,
  isTheme,
  useTheme,
} from '@/lib/theme';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let prefersDark = true;
let listeners: Array<() => void> = [];

function mockMatchMedia() {
  window.matchMedia = ((query: string) => ({
    get matches() {
      return prefersDark;
    },
    media: query,
    addEventListener: (_event: string, listener: () => void) => listeners.push(listener),
    removeEventListener: (_event: string, listener: () => void) => {
      listeners = listeners.filter((item) => item !== listener);
    },
  })) as unknown as typeof window.matchMedia;
}

let api: ReturnType<typeof useTheme>;
function Probe() {
  api = useTheme();
  return null;
}

let container: HTMLDivElement;
let root: Root;

async function mount(withProvider = true) {
  await act(async () => {
    root.render(withProvider ? <ThemeProvider><Probe /></ThemeProvider> : <Probe />);
  });
}

beforeEach(() => {
  prefersDark = true;
  listeners = [];
  mockMatchMedia();
  window.localStorage.clear();
  document.documentElement.className = 'dark';
  document.documentElement.style.colorScheme = '';
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('theme', () => {
  it('validates theme values', () => {
    expect(isTheme('light')).toBe(true);
    expect(isTheme('dark')).toBe(true);
    expect(isTheme('system')).toBe(true);
    expect(isTheme('blue')).toBe(false);
    expect(isTheme(null)).toBe(false);
  });

  it('defaults to dark when nothing is stored', async () => {
    await mount();
    expect(api.theme).toBe(DEFAULT_THEME);
    expect(api.resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('stays dark when the OS prefers light and no choice is stored', async () => {
    prefersDark = false;
    await mount();
    expect(api.resolvedTheme).toBe('dark');
  });

  it('restores a stored light theme', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    await mount();
    expect(api.theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('ignores an invalid stored value', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    await mount();
    expect(api.theme).toBe('dark');
  });

  it('setTheme updates the class and persists the choice', async () => {
    await mount();
    await act(async () => api.setTheme('light'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    await act(async () => api.setTheme('dark'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('system follows the OS preference live', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'system');
    prefersDark = false;
    await mount();
    expect(api.resolvedTheme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    prefersDark = true;
    await act(async () => listeners.forEach((listener) => listener()));
    expect(api.resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('returns safe defaults without a provider', async () => {
    await mount(false);
    expect(api.theme).toBe('dark');
    expect(api.resolvedTheme).toBe('dark');
    expect(() => api.setTheme('light')).not.toThrow();
  });

  it('falls back to legacy theme key when ekuiper.theme is absent', async () => {
    window.localStorage.setItem(LEGACY_THEME_STORAGE_KEY, 'light');
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');

    await mount();
    expect(api.theme).toBe('light');
    expect(api.resolvedTheme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('prefers ekuiper.theme over legacy theme key in startup script and provider', async () => {
    window.localStorage.setItem(LEGACY_THEME_STORAGE_KEY, 'light');
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    document.documentElement.classList.remove('dark');

    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');

    await mount();
    expect(api.theme).toBe('dark');
    expect(api.resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('ignores invalid legacy theme values and respects invalid ekuiper.theme', async () => {
    window.localStorage.setItem(LEGACY_THEME_STORAGE_KEY, 'purple');
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    await mount();
    expect(api.theme).toBe('dark');

    window.localStorage.setItem(LEGACY_THEME_STORAGE_KEY, 'light');
    window.localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    await mount();
    expect(api.theme).toBe('dark');
  });
});

