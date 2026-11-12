"use client";

import * as React from "react";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useT } from '@/lib/i18n';
export interface FlowStudioShellProps {
  header?: React.ReactNode;
  palette?: React.ReactNode;
  canvas?: React.ReactNode;
  inspector?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Collapse state, remembered per browser.
 *
 * Flow Studio's chrome is fixed-width: a 256px palette plus a 320px inspector, on top of the
 * application sidebar. At a 1280px viewport that leaves the canvas around 400px wide - narrower
 * than two 208px nodes side by side - which is why nodes overlap, why panels sit on top of
 * them, and why a node placed near an edge cannot be reached. Node-RED solves this by letting
 * every panel get out of the way; so does this.
 */
const STORAGE_KEY = "flow-studio:panels";

interface PanelState {
  palette: boolean;
  inspector: boolean;
}

function readStoredState(): PanelState {
  if (typeof window === "undefined") return { palette: true, inspector: true };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { palette: true, inspector: true };
    const parsed = JSON.parse(raw) as Partial<PanelState>;
    return {
      palette: parsed.palette !== false,
      inspector: parsed.inspector !== false,
    };
  } catch {
    // A blocked or corrupt store must never stop the editor from rendering.
    return { palette: true, inspector: true };
  }
}

export function FlowStudioShell({
  header,
  palette,
  canvas,
  inspector,
  children,
  className,
}: FlowStudioShellProps) {
  const t = useT();
  const canvasContent = canvas ?? children;

  // Start collapsed on the server and on first paint so the canvas has maximum room,
  // then adopt the stored preference while keeping hydration stable.
  const [collapsed, setCollapsed] = React.useState<PanelState>({
    palette: true,
    inspector: true,
  });
  React.useEffect(() => {
    setCollapsed(readStoredState());
  }, []);

  const toggle = React.useCallback((panel: keyof PanelState) => {
    setCollapsed((current) => {
      const next = { ...current, [panel]: !current[panel] };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Preference is a convenience; failing to persist it must not break the toggle.
      }
      return next;
    });
  }, []);

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col flow-studio-shell",
        className,
      )}
      data-testid="flow-studio-shell"
    >
      <header
        aria-label={t('flow.flowStudioHeader')}
        className="flex h-14 shrink-0 items-center border-b flow-studio-panel px-4"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">{header}</div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {collapsed.palette ? (
          <div className="hidden w-10 shrink-0 flex-col items-center border-r flow-studio-panel py-2 md:flex">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => toggle("palette")}
              aria-expanded={false}
              aria-controls="flow-studio-palette"
              aria-label={t('flow.showNodePalette')}
              title={t('flow.showNodePalette')}
              data-testid="flow-studio-palette-toggle"
            >
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <aside
            id="flow-studio-palette"
            aria-label={t('flow.nodePalette')}
            className="hidden w-64 shrink-0 flex-col overflow-hidden border-r flow-studio-panel md:flex"
          >
            <div className="flex shrink-0 items-center justify-end px-1 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => toggle("palette")}
                aria-expanded
                aria-controls="flow-studio-palette"
                aria-label={t('flow.hideNodePalette')}
                title={t('flow.hideNodePalette')}
                data-testid="flow-studio-palette-toggle"
              >
                <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{palette}</div>
          </aside>
        )}

        <main
          aria-label={t('flow.flowCanvas')}
          className="relative min-w-0 flex-1 overflow-hidden flow-studio-canvas"
        >
          {canvasContent}
        </main>

        {collapsed.inspector ? (
          <div className="hidden w-10 shrink-0 flex-col items-center border-l flow-studio-panel py-2 lg:flex">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => toggle("inspector")}
              aria-expanded={false}
              aria-controls="flow-studio-inspector"
              aria-label={t('flow.showNodeInspector')}
              title={t('flow.showNodeInspector')}
              data-testid="flow-studio-inspector-toggle"
            >
              <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <aside
            id="flow-studio-inspector"
            aria-label={t('flow.nodeInspector')}
            className="hidden w-80 shrink-0 flex-col overflow-hidden border-l flow-studio-panel lg:flex"
          >
            <div className="flex shrink-0 items-center px-1 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => toggle("inspector")}
                aria-expanded
                aria-controls="flow-studio-inspector"
                aria-label={t('flow.hideNodeInspector')}
                title={t('flow.hideNodeInspector')}
                data-testid="flow-studio-inspector-toggle"
              >
                <PanelRightClose className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{inspector}</div>
          </aside>
        )}
      </div>
    </div>
  );
}
