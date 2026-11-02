"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { FlowDocument, FlowRuleOptions } from "@/lib/flows/model/flow-document";
import { FLOW_EDITOR_HISTORY_LIMIT, useFlowEditorStore } from "@/stores/flow-editor-store";

import { useT } from '@/lib/i18n';
/**
 * Flow-level rule options panel (FS-0152).
 *
 * Edits the v1alpha1 `spec.options` subset (the owner-approved eKuiper
 * `RuleOptions`: concurrency, bufferLength, qos, checkpointInterval,
 * isEventTime, lateTolerance, sendMetaToSink, sendError) as advanced flow
 * settings. This is flow-level state, never node state: it reads and
 * writes `document.spec.options` only and never touches node config.
 *
 * Semantics follow the store's node-config conventions:
 * - clearing a field unsets the key (never stores `undefined` or `""`,
 *   which would break canonical serialization);
 * - clearing the last key removes `spec.options` entirely, so the flow
 *   compiles back to a rule with NO `options` key;
 * - every committed change is one undoable history entry (mirroring the
 *   store's history cap), so options edits participate in undo/redo,
 *   dirty-state comparison, and autosave exactly like semantic node edits.
 */
export function FlowSettingsPanel({ className }: { className?: string }) {
  const t = useT();
  const document = useFlowEditorStore((state) => state.document);
  const options = document?.spec.options;

  if (!document) {
    return (
      <section
        aria-label={t('flow.flowSettingsPanel')}
        className={cn("flex flex-col", className)}
        data-testid="flow-settings-panel"
      >
        <div className="shrink-0 border-b px-4 py-3">
          <h2 className="text-sm font-semibold leading-tight">{}</h2>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-muted-foreground">{}</p>
        </div>
      </section>
    );
  }

  const hasOptions = options !== undefined && Object.keys(options).length > 0;

  return (
    <section
      aria-label={t('flow.flowSettingsPanel')}
      className={cn("flex flex-col", className)}
      data-testid="flow-settings-panel"
    >
      <div className="shrink-0 border-b px-4 py-3">
        <h2 className="text-sm font-semibold leading-tight">{}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{}</p>
      </div>
      <div className="flex flex-col gap-4 px-4 py-3">
        <NumberOptionRow
          label={t('flow.concurrency')}
          description={t('flow.concurrencyHint')}
          testId="flow-settings-concurrency"
          value={options?.concurrency}
          min={1}
          placeholder="1"
          optionKey="concurrency"
        />
        <NumberOptionRow
          label={t('flow.bufferLength')}
          description={t('flow.bufferLengthHint')}
          testId="flow-settings-buffer-length"
          value={options?.bufferLength}
          min={1}
          placeholder="1024"
          optionKey="bufferLength"
        />
        <QosOptionRow value={options?.qos} />
        <TextOptionRow
          label={t('flow.checkpointInterval')}
          description="State checkpoint interval in milliseconds or as a duration (e.g. 5000 or 5s)."
          testId="flow-settings-checkpoint-interval"
          value={options?.checkpointInterval}
          placeholder="5000 or 5s"
          optionKey="checkpointInterval"
        />
        <BooleanOptionRow
          label={t('flow.eventTime')}
          description={t('flow.eventTimeHint')}
          testId="flow-settings-event-time"
          value={options?.isEventTime}
          optionKey="isEventTime"
        />
        <TextOptionRow
          label={t('flow.lateTolerance')}
          description="Tolerance for late out-of-order events in milliseconds or as a duration."
          testId="flow-settings-late-tolerance"
          value={options?.lateTolerance}
          placeholder="1000 or 1s"
          optionKey="lateTolerance"
        />
        <BooleanOptionRow
          label={t('flow.sendMeta')}
          description={t('flow.sendMetaHint')}
          testId="flow-settings-send-meta"
          value={options?.sendMetaToSink}
          optionKey="sendMetaToSink"
        />
        <BooleanOptionRow
          label={t('flow.sendErrors')}
          description={t('flow.sendErrorsHint')}
          testId="flow-settings-send-error"
          value={options?.sendError}
          optionKey="sendError"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasOptions}
          onClick={() => {
            commitOptionsUpdate(undefined);
          }}
          data-testid="flow-settings-reset"
        >{}</Button>
      </div>
    </section>
  );
}

/**
 * Merge one patch into `spec.options` and commit it as a single undoable
 * history entry. Keys set to `undefined` (or cleared to `""`) are deleted;
 * an emptied options object removes `spec.options` entirely so the flow
 * compiles with NO `options` key. No-ops leave history untouched.
 */
function patchFlowOptions(patch: Record<string, unknown>): void {
  const current = useFlowEditorStore.getState().document?.spec.options;
  const merged: Record<string, unknown> = { ...(current ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === "") {
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }
  commitOptionsUpdate(
    Object.keys(merged).length === 0 ? undefined : (merged as FlowRuleOptions),
  );
}

function commitOptionsUpdate(next: FlowRuleOptions | undefined): void {
  useFlowEditorStore.setState((state) => {
    const current = state.document;
    if (!current) {
      return state;
    }
    const previous: FlowDocument = JSON.parse(JSON.stringify(current)) as FlowDocument;
    const previousJson = JSON.stringify(previous.spec.options ?? null);
    const nextJson = JSON.stringify(next ?? null);
    if (previousJson === nextJson) {
      return state;
    }
    const nextPast =
      state.past.length >= FLOW_EDITOR_HISTORY_LIMIT
        ? [...state.past.slice(state.past.length - (FLOW_EDITOR_HISTORY_LIMIT - 1)), previous]
        : [...state.past, previous];
    return {
      document: {
        ...current,
        spec:
          next === undefined
            ? { nodes: current.spec.nodes, edges: current.spec.edges }
            : { ...current.spec, options: next },
      },
      past: nextPast,
      future: [],
      canUndo: true,
      canRedo: false,
    };
  });
}

/**
 * Parse a free-text numeric input the same way node number controls do:
 * empty clears, finite numbers store as numbers, anything else stores as
 * the raw string so typing is never clobbered and validation (not the
 * control) reports the mismatch as a structured diagnostic.
 */
function parseNumericText(raw: string): number | string | undefined {
  if (raw === "") {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : raw;
}

function NumberOptionRow({
  label,
  description,
  testId,
  value,
  min,
  placeholder,
  optionKey,
}: {
  label: string;
  description: string;
  testId: string;
  value: unknown;
  min: number;
  placeholder: string;
  optionKey: keyof FlowRuleOptions;
}) {
  const fieldId = React.useId();
  const descriptionId = `${fieldId}-description`;
  // false/0 must be preserved: only null/undefined/empty render blank.
  const text =
    typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : value === undefined || value === null || value === ""
        ? ""
        : String(value);
  return (
    <div className="flex flex-col gap-1.5" data-testid={testId}>
      <Label htmlFor={fieldId}>{label}</Label>
      <Input
        id={fieldId}
        aria-describedby={descriptionId}
        type="number"
        value={text}
        min={min}
        placeholder={placeholder}
        onChange={(event) => {
          patchFlowOptions({ [optionKey]: parseNumericText(event.target.value) });
        }}
      />
      <p id={descriptionId} className="text-xs text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function TextOptionRow({
  label,
  description,
  testId,
  value,
  placeholder,
  optionKey,
}: {
  label: string;
  description: string;
  testId: string;
  value: unknown;
  placeholder: string;
  optionKey: keyof FlowRuleOptions;
}) {
  const fieldId = React.useId();
  const descriptionId = `${fieldId}-description`;
  const text =
    typeof value === "string" || (typeof value === "number" && Number.isFinite(value))
      ? String(value)
      : value === undefined || value === null
        ? ""
        : String(value);
  return (
    <div className="flex flex-col gap-1.5" data-testid={testId}>
      <Label htmlFor={fieldId}>{label}</Label>
      <Input
        id={fieldId}
        aria-describedby={descriptionId}
        type="text"
        value={text}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(event) => {
          patchFlowOptions({ [optionKey]: parseNumericText(event.target.value) });
        }}
      />
      <p id={descriptionId} className="text-xs text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function BooleanOptionRow({
  label,
  description,
  testId,
  value,
  optionKey,
}: {
  label: string;
  description: string;
  testId: string;
  value: unknown;
  optionKey: keyof FlowRuleOptions;
}) {
  const fieldId = React.useId();
  const descriptionId = `${fieldId}-description`;
  // Strict comparison so false is never coerced into an uncontrolled state.
  const checked = value === true;
  return (
    <div className="flex flex-col gap-1.5" data-testid={testId}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={fieldId}>{label}</Label>
        <Switch
          id={fieldId}
          aria-describedby={descriptionId}
          checked={checked}
          onCheckedChange={(next) => {
            patchFlowOptions({ [optionKey]: next });
          }}
        />
      </div>
      <p id={descriptionId} className="text-xs text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function QosOptionRow({ value }: { value: unknown }) {
  const t = useT();
  const fieldId = React.useId();
  const descriptionId = `${fieldId}-description`;
  const options = [
    { label: "0 · at most once (default)", value: 0 },
    { label: "1 · at least once", value: 1 },
    { label: "2 · exactly once", value: 2 },
  ];
  const matched = options.find((option) => Object.is(option.value, value));
  const domValue = matched ? String(matched.value) : "";
  return (
    <div className="flex flex-col gap-1.5" data-testid="flow-settings-qos">
      <Label htmlFor={fieldId}>{}</Label>
      <select
        id={fieldId}
        aria-describedby={descriptionId}
        aria-label={t('flow.qos')}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-beautiful-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        )}
        value={domValue}
        onChange={(event) => {
          const raw = event.target.value;
          patchFlowOptions({ qos: raw === "" ? undefined : Number(raw) });
        }}
      >
        <option value="">{}</option>
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
      <p id={descriptionId} className="text-xs text-muted-foreground">{}</p>
    </div>
  );
}
