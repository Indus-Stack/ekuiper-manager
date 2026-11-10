/**
 * @jest-environment jsdom
 */
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { I18nProvider, LOCALE_STORAGE_KEY } from '@/lib/i18n';
import { THEME_STORAGE_KEY, ThemeProvider } from '@/lib/theme';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockRouter = { push: jest.fn(), replace: jest.fn(), refresh: jest.fn() };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/settings',
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock('@/components/layout', () => ({
  AppLayout: ({ title, children }: { title?: string; children: React.ReactNode }) => (
    <div data-testid="app-layout" data-title={title}>
      {children}
    </div>
  ),
}));

jest.mock('../server-selector', () => ({
  ServerSelector: () => <div data-testid="server-selector" />,
}));

jest.mock('../mobile-nav', () => ({
  MobileNav: () => <div data-testid="mobile-nav" />,
}));

import SettingsPage from '@/app/settings/page';
import { Header } from '../header';

const mounted: { container: HTMLElement; root: Root }[] = [];

function setupMatchMedia(prefersDark = true) {
  window.matchMedia = ((query: string) => ({
    matches: prefersDark,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })) as unknown as typeof window.matchMedia;
}

async function mountUi(ui: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ container, root });
  await act(async () => {
    root.render(
      <ThemeProvider>
        <I18nProvider>{ui}</I18nProvider>
      </ThemeProvider>,
    );
  });
  return container;
}

beforeEach(() => {
  setupMatchMedia(true);
  window.localStorage.clear();
  document.documentElement.className = 'dark';
  document.documentElement.style.colorScheme = '';
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ user: { username: 'admin', role: 'OWNER' } }),
    } as Response),
  );
});

afterEach(async () => {
  await act(async () => {
    for (const entry of mounted.splice(0)) {
      entry.root.unmount();
      entry.container.remove();
    }
  });
  jest.restoreAllMocks();
});

describe('Theme UI controls', () => {
  it('switches theme from SettingsPage and updates aria-pressed and storage', async () => {
    const container = await mountUi(<SettingsPage />);
    const group = container.querySelector('[role="group"][aria-label="Theme"]');
    expect(group).not.toBeNull();

    const buttons = Array.from(group!.querySelectorAll('button'));
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Light', 'Dark', 'System']);
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      buttons[0].click();
    });

    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('renders localized theme labels in zh-CN', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'zh-CN');
    const container = await mountUi(<SettingsPage />);
    const group = container.querySelector('[role="group"][aria-label="主题"]');
    expect(group).not.toBeNull();

    const labels = Array.from(group!.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(labels).toEqual(['浅色', '深色', '跟随系统']);
  });

  it('renders the Header theme trigger and stays synchronized with SettingsPage', async () => {
    const container = await mountUi(
      <>
        <Header title="Settings" />
        <SettingsPage />
      </>,
    );

    const headerButton = container.querySelector('header button[aria-label="Theme"]');
    expect(headerButton).not.toBeNull();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(headerButton?.querySelector('svg.lucide-moon')).not.toBeNull();
    expect(headerButton?.querySelector('svg.lucide-sun')).toBeNull();

    const lightBtn = Array.from(
      container.querySelectorAll('[role="group"][aria-label="Theme"] button'),
    )[0] as HTMLButtonElement;

    await act(async () => {
      lightBtn.click();
    });

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(headerButton?.querySelector('svg.lucide-sun')).not.toBeNull();
    expect(headerButton?.querySelector('svg.lucide-moon')).toBeNull();
  });
});

