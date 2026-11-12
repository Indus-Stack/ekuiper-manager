/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { I18nProvider, useI18n } from '@/lib/i18n';
import { LOCALE_STORAGE_KEY, type Locale } from '@/lib/i18n/config';
import { useFlowEditorStore } from '@/stores/flow-editor-store';
import { FlowCommandPalette } from '../command/flow-command-palette';
import { FlowDeployDialog } from '../deploy/deploy-dialog';
import { RevisionDiff } from '../history/revision-diff';
import { FlowSettingsPanel } from '../inspector/flow-settings-panel';
import { FlowBottomPanel } from '../panels/flow-bottom-panel';
import { RuntimePanel } from '../panels/runtime-panel';
import { ValidationPanel } from '../panels/validation-panel';
import { FlowStudioHeader } from '../shell/flow-studio-header';

if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
}
// Load NodeInspector after structuredClone is defined in JSDOM.
const { NodeInspector } = require('../inspector/node-inspector') as typeof import('../inspector/node-inspector');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// cmdk relies on ResizeObserver and Element.prototype.scrollIntoView in JSDOM.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}

const mounted: { container: HTMLElement; root: Root }[] = [];

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

async function renderWithLocale(
  element: React.ReactElement,
  initialLocale: Locale = 'en-US',
): Promise<HTMLElement> {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, initialLocale);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ container, root });
  await act(async () => {
    root.render(
      <I18nProvider>
        <LocaleHarness>{element}</LocaleHarness>
      </I18nProvider>,
    );
  });
  return container;
}

afterEach(async () => {
  await act(async () => {
    for (const entry of mounted.splice(0)) {
      entry.root.unmount();
      entry.container.remove();
    }
  });
  window.localStorage.removeItem(LOCALE_STORAGE_KEY);
  useFlowEditorStore.setState({ document: null, selectedNodeIds: [], selectedEdgeIds: [] });
  jest.restoreAllMocks();
});

describe('Flow Studio localized visible labels and controls', () => {
  it('renders visible Deploy button text (not just aria-label) in both locales and updates when switching locale', async () => {
    const container = await renderWithLocale(
      <FlowStudioHeader
        flowName="Demo Flow"
        saveState="Saved"
        deployDisabled={true}
      />,
      'en-US',
    );

    const header = container.querySelector('[data-testid="flow-studio-header"]')!;
    const deployBtn = header.querySelector('button') as HTMLButtonElement;
    expect(deployBtn).not.toBeNull();
    expect(deployBtn.disabled).toBe(true);
    expect(deployBtn.getAttribute('aria-label')).toBe('Deploy flow');
    expect(deployBtn.textContent?.trim()).toBe('Deploy');

    const switchBtn = container.querySelector('[data-testid="test-switch-locale"]') as HTMLButtonElement;
    await act(async () => {
      switchBtn.click();
    });

    expect(deployBtn.getAttribute('aria-label')).toBe('部署流程');
    expect(deployBtn.textContent?.trim()).toBe('部署');
  });

  it('renders visible Definition/Test Output tabs, Hide/Show panel actions, and validation headings in both locales', async () => {
    const container = await renderWithLocale(
      <FlowBottomPanel flowId="flow-1" clientDiagnostics={[]} ruleTestSupported={false} defaultOpen />,
      'en-US',
    );

    const defTab = container.querySelector('[data-testid="flow-bottom-panel-tab-definition"]')!;
    const testTab = container.querySelector('[data-testid="flow-bottom-panel-tab-test"]')!;
    const collapseBtn = container.querySelector('[data-testid="flow-bottom-panel-collapse"]')!;

    expect(defTab.textContent?.trim()).toBe('Definition');
    expect(testTab.textContent?.trim()).toBe('Test Output');
    expect(collapseBtn.textContent?.trim()).toBe('Hide');
    expect(container.textContent).toContain('Client checks');
    expect(container.textContent).toContain('Server validation');
    expect(container.textContent).toContain('No issues found.');

    const switchBtn = container.querySelector('[data-testid="test-switch-locale"]') as HTMLButtonElement;
    await act(async () => {
      switchBtn.click();
    });

    expect(defTab.textContent?.trim()).toBe('定义');
    expect(testTab.textContent?.trim()).toBe('测试输出');
    expect(collapseBtn.textContent?.trim()).toBe('隐藏');
    expect(container.textContent).toContain('客户端检查');
    expect(container.textContent).toContain('服务端校验');
    expect(container.textContent).toContain('未发现问题。');

    await act(async () => {
      (collapseBtn as HTMLButtonElement).click();
    });
    const expandBtn = container.querySelector('[data-testid="flow-bottom-panel-expand"]')!;
    expect(expandBtn.textContent?.trim()).toBe('显示面板');
  });

  it('renders NodeInspector headings, field labels, and delete button in both locales while preserving state', async () => {
    useFlowEditorStore.getState().loadDocument({
      apiVersion: 'flow.ekuiper-manager.io/v1alpha1',
      metadata: {
        id: 'flow-1',
        name: 'Flow 1',
      },
      spec: {
        nodes: [
          {
            id: 'node-1',
            type: 'memory-source',
            typeVersion: 1,
            name: 'Source A',
            config: { topic: 'events/raw' },
          },
        ],
        edges: [],
      },
      layout: {
        nodes: { 'node-1': { x: 10, y: 20 } },
      },
    });
    useFlowEditorStore.getState().setSelection({ nodeIds: ['node-1'], edgeIds: [] });

    const container = await renderWithLocale(<NodeInspector />, 'en-US');
    const inspector = container.querySelector('[data-testid="node-inspector"]')!;
    const deleteBtn = container.querySelector('[data-testid="node-inspector-delete"]')!;
    const nameInput = container.querySelector('[data-testid="node-inspector-name-input"]') as HTMLInputElement;

    expect(inspector.querySelector('h2')?.textContent?.trim()).toBe('Inspector');
    expect(inspector.textContent).toContain('Display name');
    expect(deleteBtn.textContent?.trim()).toBe('Delete node');
    expect(nameInput.value).toBe('Source A');

    const switchBtn = container.querySelector('[data-testid="test-switch-locale"]') as HTMLButtonElement;
    await act(async () => {
      switchBtn.click();
    });

    expect(inspector.querySelector('h2')?.textContent?.trim()).toBe('检查器');
    expect(inspector.textContent).toContain('显示名称');
    expect(deleteBtn.textContent?.trim()).toBe('删除节点');
    expect(nameInput.value).toBe('Source A');
  });

  it('renders FlowDeployDialog headings and summary labels in both locales', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ valid: true, diagnostics: [] }),
    }) as unknown as typeof fetch;

    try {
      await renderWithLocale(
        <FlowDeployDialog
          open={true}
          flowId="flow-1"
          flowName="Telemetry Flow"
          targetName="Edge-01"
          targetNodeId="node-1"
          semanticHash="abcdef1234567890"
          semanticDirty={false}
          layoutDirty={false}
          onClose={() => {}}
        />,
        'zh-CN',
      );

      const dialog = document.body.querySelector('[data-testid="flow-deploy-dialog"]')!;
      expect(dialog).not.toBeNull();
      expect(dialog.textContent).toContain('部署流程');
      expect(dialog.textContent).toContain('目标');
      expect(dialog.textContent).toContain('语义哈希');
      expect(dialog.textContent).toContain('语义');
      expect(dialog.textContent).toContain('布局');
      expect(dialog.textContent).toContain('仅布局变更不会影响已部署的运行时。');
      expect(dialog.textContent).toContain('服务端校验');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('renders RuntimePanel empty, error, and no-message states in both locales', async () => {
    const emptyContainer = await renderWithLocale(
      <RuntimePanel runtime={null} hasDeployment={false} isLoading={false} isError={false} />,
      'en-US',
    );
    expect(emptyContainer.querySelector('h3')?.textContent?.trim()).toBe('Runtime');
    expect(
      emptyContainer.querySelector('[data-testid="flow-runtime-panel-empty"]')?.textContent?.trim(),
    ).toBe('Deploy the flow to see live runtime status.');

    const errorContainer = await renderWithLocale(
      <RuntimePanel runtime={null} hasDeployment={true} isLoading={false} isError={true} />,
      'zh-CN',
    );
    expect(errorContainer.querySelector('h3')?.textContent?.trim()).toBe('运行状态');
    expect(
      errorContainer.querySelector('[data-testid="flow-runtime-panel-error"]')?.textContent?.trim(),
    ).toBe('无法读取运行状态。');

    const noMsgContainer = await renderWithLocale(
      <RuntimePanel
        runtime={{
          flowId: 'flow-1',
          targetNodeId: 'node-1',
          ruleId: 'rule-1',
          deploymentId: 'dep-1',
          deployed: true,
          desiredState: 'running',
          actualState: 'running',
          message: null,
          checkedAt: '2026-01-01T00:00:00Z',
        }}
        hasDeployment={true}
        isLoading={false}
        isError={false}
      />,
      'zh-CN',
    );
    expect(
      noMsgContainer.querySelector('[data-testid="flow-runtime-panel-message-empty"]')?.textContent?.trim(),
    ).toBe('没有运行消息。');
  });

  it('allows searching and invoking the Deploy command in both English and Chinese in FlowCommandPalette', async () => {
    const onDeploy = jest.fn();
    const onOpenChange = jest.fn();
    const container = await renderWithLocale(
      <FlowCommandPalette
        open={true}
        onOpenChange={onOpenChange}
        canAddNode={true}
        onAddNode={() => {}}
        canDeploy={true}
        onDeploy={onDeploy}
        panelsAvailable={true}
        onShowValidation={() => {}}
        onShowDefinition={() => {}}
        onShowTestOutput={() => {}}
        historyOpen={false}
        onToggleHistory={() => {}}
        canFitView={true}
        onFitView={() => {}}
      />,
      'en-US',
    );

    const input = document.body.querySelector(
      '[data-testid="flow-command-palette-input"]',
    ) as HTMLInputElement;
    expect(input).not.toBeNull();

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'Deploy flow');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const deployItemEn = document.body.querySelector(
      '[data-testid="flow-command-deploy"]',
    ) as HTMLElement | null;
    expect(deployItemEn).not.toBeNull();
    expect(deployItemEn?.textContent?.trim()).toBe('Deploy flow');

    // Switch to zh-CN and search by Chinese label
    const switchBtn = container.querySelector('[data-testid="test-switch-locale"]') as HTMLButtonElement;
    await act(async () => {
      switchBtn.click();
    });

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, '部署流程');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const deployItemZh = document.body.querySelector(
      '[data-testid="flow-command-deploy"]',
    ) as HTMLElement | null;
    expect(deployItemZh).not.toBeNull();
    expect(deployItemZh?.textContent?.trim()).toBe('部署流程');

    await act(async () => {
      deployItemZh!.click();
    });
    expect(onDeploy).toHaveBeenCalledTimes(1);
  });

  it('renders RevisionDiff and FlowSettingsPanel labels in both locales', async () => {
    const container = await renderWithLocale(
      <div>
        <FlowSettingsPanel />
        <RevisionDiff
          changes={[
            {
              kind: 'options-changed',
              changes: [
                {
                  path: 'qos',
                  before: 0,
                  after: 'x'.repeat(120),
                },
              ],
            },
          ]}
        />
      </div>,
      'zh-CN',
    );

    expect(container.textContent).toContain('流程设置');
    expect(container.textContent).toContain('未加载流程。');
    expect(container.textContent).toContain('流程规则选项已变更');
    expect(container.textContent).toContain('显示完整值');
  });

  it('renders FLOW_SOURCENAME_DECODE_WARNING as non-blocking amber warning across NodeInspector, ValidationPanel, and FlowDeployDialog', async () => {
    const warning = {
      code: 'FLOW_SOURCENAME_DECODE_WARNING',
      severity: 'warning' as const,
      nodeId: 'node-source-1',
      propertyPath: 'stream',
      message: 'eKuiper 2.4.2 graph rules referencing saved streams via sourceName may emit empty objects `{}`.',
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/flows/options/')) {
        return {
          ok: true,
          json: async () => ({ options: [] }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ valid: true, diagnostics: [warning] }),
      } as Response;
    }) as unknown as typeof fetch;

    try {
      useFlowEditorStore.getState().loadDocument({
        apiVersion: 'flow.ekuiper-manager.io/v1alpha1',
        metadata: { id: 'flow-warn', name: 'Warn Flow' },
        spec: {
          nodes: [
            {
              id: 'node-source-1',
              type: 'stream-source',
              typeVersion: 1,
              name: 'Saved Stream',
              config: { stream: 'telemetry_stream', connector: 'memory' },
            },
          ],
          edges: [],
        },
        layout: { nodes: { 'node-source-1': { x: 0, y: 0 } } },
      });
      useFlowEditorStore.getState().setSelection({ nodeIds: ['node-source-1'], edgeIds: [] });

      const inspectorContainer = await renderWithLocale(<NodeInspector diagnostics={[warning]} />, 'en-US');
      const inspectorDiag = inspectorContainer.querySelector('[data-testid="node-inspector-diagnostic"]');
      expect(inspectorDiag?.getAttribute('data-severity')).toBe('warning');
      expect(inspectorDiag?.className).toContain('amber');
      expect(inspectorDiag?.textContent).toContain('FLOW_SOURCENAME_DECODE_WARNING');

      const panelContainer = await renderWithLocale(
        <ValidationPanel flowId="flow-warn" clientDiagnostics={[warning]} />,
        'en-US',
      );
      const panelDiag = panelContainer.querySelector('[data-testid="flow-validation-client-diagnostic"]');
      expect(panelDiag?.getAttribute('data-severity')).toBe('warning');
      expect(panelDiag?.className).toContain('amber');
      expect(panelContainer.querySelector('[data-testid="flow-validation-client-summary"]')?.textContent).toContain(
        '0 error(s)',
      );

      await renderWithLocale(
        <FlowDeployDialog
          open={true}
          flowId="flow-warn"
          flowName="Warn Flow"
          targetName="Edge-242"
          targetNodeId="node-1"
          semanticHash="abcdef1234567890"
          semanticDirty={false}
          layoutDirty={false}
          onClose={() => {}}
        />,
        'en-US',
      );
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      const deployDiag = document.body.querySelector('[data-testid="flow-deploy-validation-diagnostic"]');
      expect(deployDiag?.getAttribute('data-severity')).toBe('warning');
      expect(deployDiag?.className).toContain('amber');
      const confirmBtn = document.body.querySelector('[data-testid="flow-deploy-confirm"]') as HTMLButtonElement | null;
      expect(confirmBtn?.disabled).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
