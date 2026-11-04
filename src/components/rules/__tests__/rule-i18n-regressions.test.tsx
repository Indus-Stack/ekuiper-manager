/**
 * @jest-environment jsdom
 */
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { I18nProvider, LOCALE_STORAGE_KEY, useI18n, type Locale } from '@/lib/i18n';
import { ekuiperClient } from '@/lib/ekuiper/client';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MOCK_ROUTER = {
  push: jest.fn(),
  replace: jest.fn(),
};
const MOCK_SEARCH_PARAMS = new URLSearchParams();
const MOCK_SERVERS = [{ id: 'node-1', name: 'Primary Node' }];
const MOCK_SERVER_STORE = {
  servers: MOCK_SERVERS,
  activeServerId: 'node-1',
};

jest.mock('next/navigation', () => ({
  useRouter: () => MOCK_ROUTER,
  useSearchParams: () => MOCK_SEARCH_PARAMS,
}));

jest.mock('@/components/layout', () => ({
  AppLayout: ({ title, children }: { title?: string; children: React.ReactNode }) => (
    <div data-testid="app-layout" data-layout-title={title}>
      <span data-testid="app-layout-title">{title}</span>
      {children}
    </div>
  ),
}));

jest.mock('@/stores/server-store', () => ({
  useServerStore: () => MOCK_SERVER_STORE,
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import { RuleWorkspace } from '../rule-manager';
import { RuleDesigner } from '../rule-designer';
import { ConfKeyModal } from '@/components/connectors/conf-key-modal';

const mounted: Array<{ container: HTMLElement; root: Root }> = [];

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function LocaleHarness({ children }: { children: React.ReactNode }) {
  const { locale, setLocale } = useI18n();
  return (
    <div>
      <button
        type="button"
        data-testid="test-switch-locale"
        onClick={() => setLocale(locale === 'en-US' ? 'zh-CN' : 'en-US')}
      >
        {locale}
      </button>
      {children}
    </div>
  );
}

async function renderWithLocale(element: React.ReactElement, locale: Locale = 'en-US') {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <I18nProvider>
        <LocaleHarness>{element}</LocaleHarness>
      </I18nProvider>,
    );
  });
  await flushPromises();
  mounted.push({ container, root });
  return {
    container,
    switchLocale: async () => {
      const btn = container.querySelector('[data-testid="test-switch-locale"]') as HTMLButtonElement | null;
      await act(async () => {
        btn?.click();
      });
      await flushPromises();
    },
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('Rule & Connector i18n regression tests', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  afterEach(async () => {
    while (mounted.length > 0) {
      const entry = mounted.pop();
      if (entry) {
        await act(async () => {
          entry.root.unmount();
        });
        entry.container.remove();
      }
    }
  });

  test('RuleWorkspace preserves diagnostic status suffixes and unfamiliar nonempty statuses in en-US and zh-CN', async () => {
    jest.spyOn(ekuiperClient, 'getRule').mockResolvedValue({
      id: 'rule_diag',
      sql: 'SELECT * FROM demo',
      actions: [{ log: {} }],
    });
    const statusSpy = jest
      .spyOn(ekuiperClient, 'getRuleStatus')
      .mockResolvedValue({ status: 'stopped: canceled manually' } as any);

    const enView = await renderWithLocale(<RuleWorkspace id="rule_diag" />, 'en-US');
    expect(enView.container.textContent).toContain('Stopped: canceled manually');
    await enView.unmount();

    const zhView = await renderWithLocale(<RuleWorkspace id="rule_diag" />, 'zh-CN');
    expect(zhView.container.textContent).toContain('已停止：canceled manually');
    await zhView.unmount();

    statusSpy.mockResolvedValue({ status: 'an unfamiliar engine state' } as any);
    const rawView = await renderWithLocale(<RuleWorkspace id="rule_diag" />, 'zh-CN');
    expect(rawView.container.textContent).toContain('an unfamiliar engine state');
    await rawView.unmount();
  });

  test('RuleDesigner in edit mode interpolates {id} in both header and page title without leaving raw {id}', async () => {
    jest.spyOn(ekuiperClient, 'getRule').mockResolvedValue({
      id: 'rule_alpha',
      sql: 'SELECT * FROM demo',
      actions: [{ log: {} }],
    });
    jest.spyOn(ekuiperClient, 'listStreams').mockResolvedValue([]);
    jest.spyOn(ekuiperClient, 'listTables').mockResolvedValue([]);
    jest.spyOn(ekuiperClient, 'listSinkMetadata').mockResolvedValue([]);
    jest.spyOn(ekuiperClient, 'listConnections').mockResolvedValue([]);
    jest.spyOn(ekuiperClient, 'listSchemas').mockResolvedValue([]);
    jest.spyOn(ekuiperClient, 'getSinkMetadata').mockResolvedValue({ about: {}, properties: [] } as any);
    jest.spyOn(ekuiperClient, 'getSinkConfig').mockResolvedValue({});

    const enView = await renderWithLocale(<RuleDesigner id="rule_alpha" />, 'en-US');
    const enTitle = enView.container.querySelector('[data-testid="app-layout-title"]');
    expect(enTitle?.textContent).toBe('Edit rule_alpha');
    expect(enView.container.textContent).toContain('Edit rule_alpha');
    expect(enView.container.textContent).not.toContain('{id}');
    await enView.unmount();

    const zhView = await renderWithLocale(<RuleDesigner id="rule_alpha" />, 'zh-CN');
    const zhTitle = zhView.container.querySelector('[data-testid="app-layout-title"]');
    expect(zhTitle?.textContent).toBe('编辑 rule_alpha');
    expect(zhView.container.textContent).toContain('编辑 rule_alpha');
    expect(zhView.container.textContent).not.toContain('{id}');
    await zhView.unmount();
  });

  test('ConfKeyModal connection test failure uses translated generic fallback or backend message and never exposes {id} or {error}', async () => {
    jest.spyOn(ekuiperClient, 'listSourceMetadata').mockResolvedValue([{ name: 'mqtt', about: {} } as any]);
    jest.spyOn(ekuiperClient, 'listConnections').mockResolvedValue([]);
    jest.spyOn(ekuiperClient, 'listSchemas').mockResolvedValue([]);
    jest.spyOn(ekuiperClient, 'getSourceMetadata').mockResolvedValue({ about: {}, properties: [] } as any);

    const testConnSpy = jest
      .spyOn(ekuiperClient, 'testConnection')
      .mockResolvedValue({ success: false });

    const enView = await renderWithLocale(
      <ConfKeyModal
        open={true}
        onOpenChange={jest.fn()}
        category="sources"
        initialType="mqtt"
        initialName="factory_mqtt"
      />,
      'en-US',
    );

    const testBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Test Connection'),
    );
    expect(testBtn).toBeTruthy();

    await act(async () => {
      testBtn?.click();
    });
    await flushPromises();

    expect(document.body.textContent).toContain('Connection test failed');
    expect(document.body.textContent).not.toContain('{id}');
    expect(document.body.textContent).not.toContain('{error}');
    await enView.unmount();

    // Backend provides explicit error string in zh-CN
    testConnSpy.mockResolvedValue({
      success: false,
      error: 'dial tcp 127.0.0.1:1883: connection refused',
    });

    const zhView = await renderWithLocale(
      <ConfKeyModal
        open={true}
        onOpenChange={jest.fn()}
        category="sources"
        initialType="mqtt"
        initialName="factory_mqtt"
      />,
      'zh-CN',
    );

    const zhTestBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Test Connection') || b.textContent?.includes('测试连接'),
    );
    expect(zhTestBtn).toBeTruthy();

    await act(async () => {
      zhTestBtn?.click();
    });
    await flushPromises();

    expect(document.body.textContent).toContain('dial tcp 127.0.0.1:1883: connection refused');
    expect(document.body.textContent).not.toContain('{id}');
    expect(document.body.textContent).not.toContain('{error}');

    // Empty failure in zh-CN uses generic Chinese message without placeholders
    testConnSpy.mockResolvedValue({ success: false });
    await act(async () => {
      zhTestBtn?.click();
    });
    await flushPromises();

    expect(document.body.textContent).toContain('连接测试失败');
    expect(document.body.textContent).not.toContain('{id}');
    expect(document.body.textContent).not.toContain('{error}');
    await zhView.unmount();
  });
});

