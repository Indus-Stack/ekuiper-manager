/**
 * @jest-environment jsdom
 */
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { I18nProvider, LOCALE_STORAGE_KEY } from '@/lib/i18n';
import { ekuiperClient } from '@/lib/ekuiper/client';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

if (typeof window !== 'undefined') {
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {};
  }
  if (!window.HTMLElement.prototype.hasPointerCapture) {
    window.HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!window.HTMLElement.prototype.releasePointerCapture) {
    window.HTMLElement.prototype.releasePointerCapture = () => {};
  }
}

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  refresh: jest.fn(),
};
let mockSearchParams = new URLSearchParams();
let mockServerState: {
  servers: Array<{ id: string; name: string; version?: string }>;
  activeServerId: string | null;
} = {
  servers: [{ id: 'node-1', name: 'Primary Node', version: '2.4.2' }],
  activeServerId: 'node-1',
};

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
}));

jest.mock('@/components/layout', () => ({
  AppLayout: ({ title, children }: { title?: string; children: React.ReactNode }) => (
    <div data-testid="app-layout" data-layout-title={title}>
      {children}
    </div>
  ),
}));

jest.mock('@/stores/server-store', () => ({
  useServerStore: () => mockServerState,
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import { RuleDesigner } from '../rule-designer';
import { RuleWorkspace } from '../rule-manager';
import { StreamVisualEditor } from '@/components/resources/stream-visual-editor';
import { SinkBaseForm } from '@/components/connectors/sink-base-form';
import ApiDocsPage from '@/app/api-docs/page';
import ConnectionsPage from '@/app/connections/page';

const mounted: Array<{ container: HTMLElement; root: Root }> = [];

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function renderEl(element: React.ReactElement) {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en-US');
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<I18nProvider>{element}</I18nProvider>);
  });
  await flushPromises();
  mounted.push({ container, root });
  return {
    container,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function setReactInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('eKuiper 2.4.2 & 2.5 preview version-aware UI gates', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockSearchParams = new URLSearchParams();
    mockServerState = {
      servers: [{ id: 'node-1', name: 'Primary Node', version: '2.4.2' }],
      activeServerId: 'node-1',
    };
    jest.restoreAllMocks();
    jest.spyOn(ekuiperClient, 'listStreams').mockResolvedValue([]);
    jest.spyOn(ekuiperClient, 'listTables').mockResolvedValue([]);
    jest.spyOn(ekuiperClient, 'listSinkMetadata').mockResolvedValue([]);
    jest.spyOn(ekuiperClient, 'listSourceMetadata').mockResolvedValue([]);
    jest.spyOn(ekuiperClient, 'listConnections').mockResolvedValue([]);
    jest.spyOn(ekuiperClient, 'listSchemas').mockResolvedValue([]);
    jest.spyOn(ekuiperClient, 'getSinkMetadata').mockResolvedValue({ about: {}, properties: [] } as any);
    jest.spyOn(ekuiperClient, 'getSinkConfig').mockResolvedValue({});
    jest.spyOn(ekuiperClient, 'getSourceMetadata').mockResolvedValue({ about: {}, properties: [] } as any);
    jest.spyOn(ekuiperClient, 'getSourceConfig').mockResolvedValue({});
    jest.spyOn(ekuiperClient, 'getConfigKeyResources').mockResolvedValue({});
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

  it('shows 2.4.2 SQL helpers in RuleDesigner on 2.4.2, hides them on 2.4.1, and unlocks 2.5 Kafka meta helpers on 2.5.0-alpha.5', async () => {
    mockServerState = {
      servers: [{ id: 'node-1', name: 'Node 241', version: '2.4.1' }],
      activeServerId: 'node-1',
    };
    const v241 = await renderEl(<RuleDesigner />);
    expect(v241.container.querySelector('[data-testid="sql-fn-array_avg"]')).toBeNull();
    expect(v241.container.querySelector('[data-testid="sql-fn-acc_max_by"]')).toBeNull();
    expect(v241.container.querySelector('[data-testid="sql-fn-meta_topic"]')).toBeNull();
    await v241.unmount();

    mockServerState = {
      servers: [{ id: 'node-1', name: 'Node 242', version: '2.4.2' }],
      activeServerId: 'node-1',
    };
    const v242 = await renderEl(<RuleDesigner />);
    const arrayAvgBtn = v242.container.querySelector('[data-testid="sql-fn-array_avg"]') as HTMLButtonElement | null;
    const maxByBtn = v242.container.querySelector('[data-testid="sql-fn-acc_max_by"]') as HTMLButtonElement | null;
    expect(arrayAvgBtn).not.toBeNull();
    expect(maxByBtn).not.toBeNull();
    expect(v242.container.querySelector('[data-testid="sql-fn-meta_partition"]')).toBeNull();

    await act(async () => {
      arrayAvgBtn?.click();
    });
    await act(async () => {
      maxByBtn?.click();
    });
    const fieldsInput = v242.container.querySelector('#query-fields') as HTMLTextAreaElement | null;
    expect(fieldsInput?.value).toBe('array_avg(arr), acc_max_by(value, compare_value)');

    const fnSearch = v242.container.querySelector('[data-testid="rule-function-search"]') as HTMLInputElement;
    await act(async () => {
      setReactInputValue(fnSearch, 'does_not_exist_anywhere');
    });
    expect(v242.container.querySelector('[data-testid="rule-function-helper"]')?.textContent).toContain(
      'No functions match for this node version.',
    );
    await v242.unmount();

    mockServerState = {
      servers: [{ id: 'node-1', name: 'Node 250', version: '2.5.0-alpha.5' }],
      activeServerId: 'node-1',
    };
    const v250 = await renderEl(<RuleDesigner />);
    expect(v250.container.querySelector('[data-testid="sql-fn-meta_partition"]')).not.toBeNull();
    expect(v250.container.querySelector('[data-testid="sql-fn-array_avg"]')).not.toBeNull();
    await v250.unmount();
  });

  it('gates Scan tables tab on 2.5 preview and handles empty join/tuple errors gracefully', async () => {
    jest.spyOn(ekuiperClient, 'getRule').mockResolvedValue({
      id: 'rule_join',
      sql: 'SELECT * FROM a',
      actions: [{ log: {} }],
    });
    jest.spyOn(ekuiperClient, 'getRuleStatus').mockResolvedValue({ status: 'running' } as any);
    const scanSpy = jest.spyOn(ekuiperClient, 'getRuleScanTables').mockResolvedValue([
      { emitter: 'stream_a', content: { temp: 42 } },
    ]);

    mockSearchParams = new URLSearchParams('tab=scantables');
    mockServerState = {
      servers: [{ id: 'node-1', name: 'Node 242', version: '2.4.2' }],
      activeServerId: 'node-1',
    };
    const v242 = await renderEl(<RuleWorkspace id="rule_join" />);
    expect(v242.container.querySelector('[data-testid="rule-tab-scantables"]')).toBeNull();
    expect(scanSpy).not.toHaveBeenCalled();
    await v242.unmount();

    mockServerState = {
      servers: [{ id: 'node-1', name: 'Node 250', version: '2.5.0-alpha.5' }],
      activeServerId: 'node-1',
    };
    const v250 = await renderEl(<RuleWorkspace id="rule_join" />);
    expect(v250.container.querySelector('[data-testid="rule-tab-scantables"]')).not.toBeNull();
    expect(scanSpy).toHaveBeenCalledWith('rule_join');
    expect(v250.container.textContent).toContain('stream_a');
    await v250.unmount();

    scanSpy.mockRejectedValueOnce(new Error('unable to find tuples for the given scan table'));
    const v250Empty = await renderEl(<RuleWorkspace id="rule_join" />);
    expect(v250Empty.container.querySelector('[data-testid="scan-tables-empty"]')?.textContent).toContain(
      'No scan table snapshots available for this rule.',
    );
    await v250Empty.unmount();
  });

  it('gates Stream BUFFER_FULL_POLICY and SinkBaseForm jsonl by target version while preserving existing values on edit', async () => {
    mockServerState = {
      servers: [{ id: 'node-1', name: 'Node 242', version: '2.4.2' }],
      activeServerId: 'node-1',
    };
    const stream242 = await renderEl(<StreamVisualEditor kind="stream" />);
    expect(stream242.container.querySelector('#res-buffer-full-policy')).toBeNull();
    await stream242.unmount();

    jest.spyOn(ekuiperClient, 'getStream').mockResolvedValue({
      Name: 'legacy_buffered',
      Statement: 'CREATE STREAM legacy_buffered () WITH (TYPE="memory", FORMAT="jsonl", BUFFER_FULL_POLICY="block");',
      Options: {
        TYPE: 'memory',
        FORMAT: 'jsonl',
        BUFFER_FULL_POLICY: 'block',
      },
    } as any);
    const editStream242 = await renderEl(<StreamVisualEditor kind="stream" name="legacy_buffered" />);
    expect(editStream242.container.querySelector('#res-buffer-full-policy')).not.toBeNull();
    expect(editStream242.container.textContent).toContain('BUFFER_FULL_POLICY="block"');
    expect(editStream242.container.textContent).toContain('FORMAT="jsonl"');
    await editStream242.unmount();

    mockServerState = {
      servers: [{ id: 'node-1', name: 'Node 250', version: '2.5.0-alpha.5' }],
      activeServerId: 'node-1',
    };
    const stream250 = await renderEl(<StreamVisualEditor kind="stream" />);
    expect(stream250.container.querySelector('#res-buffer-full-policy')).not.toBeNull();
    await stream250.unmount();

    const sinkForm = await renderEl(
      <SinkBaseForm values={{ format: 'jsonl' }} onChange={jest.fn()} supportsJsonl={false} />,
    );
    expect(sinkForm.container.querySelector('#sink-format')?.textContent).toContain('JSON Lines');
    await sinkForm.unmount();
  });

  it('switches /api-docs between 2.4.2 GA and 2.5 Preview and renders SQL connection recovery status on /connections', async () => {
    const apiDocs = await renderEl(<ApiDocsPage />);
    expect(apiDocs.container.querySelector('[data-testid="api-docs-version-badge"]')?.textContent).toContain('2.4.2');
    const previewBtn = apiDocs.container.querySelector('[data-testid="api-docs-spec-preview"]') as HTMLButtonElement;
    await act(async () => {
      previewBtn.click();
    });
    expect(apiDocs.container.querySelector('[data-testid="api-docs-version-badge"]')?.textContent).toContain(
      '2.5.0-alpha.5 Preview',
    );
    expect(apiDocs.container.querySelector('iframe')?.getAttribute('src')).toBe('/api-docs/index.html?spec=2.5-preview');
    await apiDocs.unmount();

    const connSpy = jest.spyOn(ekuiperClient, 'listConnections').mockResolvedValue([
      {
        id: 'sql_conn_1',
        typ: 'sql',
        props: { dburl: 'sqlite:/tmp/test.db' },
        status: 'failed',
        err: 'connection refused',
      },
    ]);
    const conns = await renderEl(<ConnectionsPage />);
    expect(conns.container.textContent).toContain('sql_conn_1');
    expect(conns.container.textContent).toContain('failed');
    expect(conns.container.textContent).toContain('connection refused');

    connSpy.mockResolvedValueOnce([
      {
        id: 'sql_conn_1',
        typ: 'sql',
        props: { dburl: 'sqlite:/tmp/test.db' },
        status: 'connected',
      },
    ]);
    const refreshBtn = Array.from(conns.container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Refresh'),
    );
    await act(async () => {
      refreshBtn?.click();
    });
    await flushPromises();
    expect(conns.container.textContent).toContain('connected');
    await conns.unmount();
  });
});

