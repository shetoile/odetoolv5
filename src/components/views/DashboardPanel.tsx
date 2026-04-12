import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDownGlyphSmall,
  ArrowLeftGlyphSmall,
  ArrowRightGlyphSmall,
  ArrowUpGlyphSmall,
  EditGlyphSmall,
  PlusGlyphSmall,
  TrashGlyphSmall
} from "@/components/Icons";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import { buildAppStorageKey } from "@/lib/appIdentity";
import {
  buildDashboardSourceOptions,
  buildDashboardWidgetDefinition,
  evaluateDashboardWidget,
  isDashboardWidgetNode,
  resolveDashboardFieldOptions,
  type DashboardAggregation,
  type DashboardDrilldownRow,
  type DashboardFieldOption,
  type DashboardFilterOperator,
  type DashboardSourceKind,
  type DashboardWidgetDefinition,
  type DashboardWidgetResult,
  type DashboardWidgetType
} from "@/lib/dashboard";
import type { AppNode } from "@/lib/types";

type DashboardPanelProps = {
  rootNode: AppNode;
  childNodes: AppNode[];
  allNodes: AppNode[];
  onCreateWidget: (parentNodeId: string) => Promise<string | null>;
  onRenameWidget: (nodeId: string, title: string) => Promise<void> | void;
  onSaveWidgetProperties: (nodeId: string, properties: Record<string, unknown>) => Promise<void> | void;
  onMoveWidget: (nodeId: string, direction: "up" | "down" | "left" | "right") => Promise<void> | void;
  onDeleteWidget: (nodeId: string) => Promise<void> | void;
};

type DashboardWidgetDraft = {
  title: string;
  widgetType: DashboardWidgetType;
  sourceKind: DashboardSourceKind;
  sourceNodeId: string;
  aggregation: DashboardAggregation;
  measureFieldId: string;
  groupFieldId: string;
  secondaryGroupFieldId: string;
  displayFieldIds: string[];
  filterFieldId: string;
  filterOperator: DashboardFilterOperator;
  filterValue: string;
  limit: string;
};

type DashboardRecordWindowSpec =
  | {
      id: string;
      key: string;
      widgetNodeId: string;
      kind: "metric";
    }
  | {
      id: string;
      key: string;
      widgetNodeId: string;
      kind: "distribution";
      label: string;
    }
  | {
      id: string;
      key: string;
      widgetNodeId: string;
      kind: "table_row";
      rowId: string;
    }
  | {
      id: string;
      key: string;
      widgetNodeId: string;
      kind: "matrix_cell";
      rowLabel: string;
      columnLabel: string;
    };

type DashboardRecordWindowSeed =
  | {
      key: string;
      widgetNodeId: string;
      kind: "metric";
    }
  | {
      key: string;
      widgetNodeId: string;
      kind: "distribution";
      label: string;
    }
  | {
      key: string;
      widgetNodeId: string;
      kind: "table_row";
      rowId: string;
    }
  | {
      key: string;
      widgetNodeId: string;
      kind: "matrix_cell";
      rowLabel: string;
      columnLabel: string;
    };

type DashboardRecordWindow = {
  id: string;
  key: string;
  title: string;
  subtitle: string;
  columns: string[];
  rows: Array<{ id: string; cells: string[] }>;
  sourceLabel: string;
};

const MAX_RECORD_WINDOWS = 12;

const WIDGET_TYPE_OPTIONS: Array<{ value: DashboardWidgetType; label: string }> = [
  { value: "metric", label: "Metric" },
  { value: "distribution", label: "Distribution" },
  { value: "table", label: "Table" },
  { value: "matrix", label: "Matrix" }
];

const AGGREGATION_OPTIONS: Array<{ value: DashboardAggregation; label: string }> = [
  { value: "count", label: "Count" },
  { value: "sum", label: "Sum" },
  { value: "avg", label: "Average" },
  { value: "min", label: "Minimum" },
  { value: "max", label: "Maximum" }
];

const FILTER_OPERATOR_OPTIONS: Array<{ value: DashboardFilterOperator; label: string }> = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not equals" },
  { value: "contains", label: "Contains" },
  { value: "gt", label: "Greater than" },
  { value: "gte", label: "Greater or equal" },
  { value: "lt", label: "Less than" },
  { value: "lte", label: "Less or equal" }
];

function buildWidgetDraft(widget: DashboardWidgetDefinition): DashboardWidgetDraft {
  return {
    title: widget.title,
    widgetType: widget.widgetType,
    sourceKind: widget.sourceKind,
    sourceNodeId: widget.sourceNodeId ?? "",
    aggregation: widget.aggregation,
    measureFieldId: widget.measureFieldId ?? "",
    groupFieldId: widget.groupFieldId ?? "",
    secondaryGroupFieldId: widget.secondaryGroupFieldId ?? "",
    displayFieldIds: widget.displayFieldIds,
    filterFieldId: widget.filterFieldId ?? "",
    filterOperator: widget.filterOperator,
    filterValue: widget.filterValue,
    limit: String(widget.limit)
  };
}

function sanitizeLimit(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 6;
  return Math.max(1, Math.floor(parsed));
}

function buildWidgetProperties(draft: DashboardWidgetDraft): Record<string, unknown> {
  return {
    odeDashboardWidget: true,
    odeDashboardWidgetType: draft.widgetType,
    odeDashboardSourceKind: draft.sourceKind,
    odeDashboardSourceNodeId: draft.sourceNodeId.trim(),
    odeDashboardAggregation: draft.aggregation,
    odeDashboardMeasureFieldId: draft.measureFieldId.trim(),
    odeDashboardGroupFieldId: draft.groupFieldId.trim(),
    odeDashboardSecondaryGroupFieldId: draft.secondaryGroupFieldId.trim(),
    odeDashboardDisplayFieldIds: draft.displayFieldIds,
    odeDashboardFilterFieldId: draft.filterFieldId.trim(),
    odeDashboardFilterOperator: draft.filterOperator,
    odeDashboardFilterValue: draft.filterValue.trim(),
    odeDashboardLimit: sanitizeLimit(draft.limit)
  };
}

function createDashboardRecordWindowId(): string {
  return `dashboard-window-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildDashboardRecordWindowStorageKey(rootNodeId: string): string {
  return buildAppStorageKey(`dashboard.recordWindows.${rootNodeId}.v1`);
}

function normalizeRecordWindowSpec(value: unknown): DashboardRecordWindowSpec | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const key = typeof record.key === "string" ? record.key.trim() : "";
  const widgetNodeId = typeof record.widgetNodeId === "string" ? record.widgetNodeId.trim() : "";
  const kind = record.kind;
  if (!id || !key || !widgetNodeId) return null;
  if (kind === "metric") {
    return { id, key, widgetNodeId, kind };
  }
  if (kind === "distribution") {
    const label = typeof record.label === "string" ? record.label.trim() : "";
    return label ? { id, key, widgetNodeId, kind, label } : null;
  }
  if (kind === "table_row") {
    const rowId = typeof record.rowId === "string" ? record.rowId.trim() : "";
    return rowId ? { id, key, widgetNodeId, kind, rowId } : null;
  }
  if (kind === "matrix_cell") {
    const rowLabel = typeof record.rowLabel === "string" ? record.rowLabel.trim() : "";
    const columnLabel = typeof record.columnLabel === "string" ? record.columnLabel.trim() : "";
    return rowLabel || columnLabel ? { id, key, widgetNodeId, kind, rowLabel, columnLabel } : null;
  }
  return null;
}

function readDashboardRecordWindowSpecs(rootNodeId: string): DashboardRecordWindowSpec[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(buildDashboardRecordWindowStorageKey(rootNodeId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeRecordWindowSpec(item))
      .filter((item): item is DashboardRecordWindowSpec => item !== null)
      .slice(-MAX_RECORD_WINDOWS);
  } catch {
    return [];
  }
}

function writeDashboardRecordWindowSpecs(rootNodeId: string, specs: DashboardRecordWindowSpec[]) {
  if (typeof window === "undefined") return;
  try {
    if (specs.length === 0) {
      window.localStorage.removeItem(buildDashboardRecordWindowStorageKey(rootNodeId));
      return;
    }
    window.localStorage.setItem(
      buildDashboardRecordWindowStorageKey(rootNodeId),
      JSON.stringify(specs.slice(-MAX_RECORD_WINDOWS))
    );
  } catch {
    // Dashboard drilldown persistence is best-effort only.
  }
}

function buildRecordCountLabel(count: number): string {
  return `${count} record${count === 1 ? "" : "s"}`;
}

function resolveDrilldownColumns(fieldOptions: DashboardFieldOption[], rows: DashboardDrilldownRow[]): string[] {
  if (fieldOptions.length > 0) {
    return fieldOptions.map((field) => field.label);
  }
  if (rows.length === 0) {
    return ["Record"];
  }
  return Object.keys(rows[0].values);
}

function resolveDrilldownCells(
  row: DashboardDrilldownRow,
  fieldOptions: DashboardFieldOption[],
  columns: string[]
): string[] {
  if (fieldOptions.length > 0) {
    return fieldOptions.map((field) => row.values[field.id] || "—");
  }
  return columns.map((column) => row.values[column] || "—");
}

function buildRecordWindowFromRows(options: {
  spec: DashboardRecordWindowSpec;
  title: string;
  subtitle: string;
  rows: DashboardDrilldownRow[];
  fieldOptions: DashboardFieldOption[];
  sourceLabel: string;
}): DashboardRecordWindow {
  const columns = resolveDrilldownColumns(options.fieldOptions, options.rows);
  return {
    id: options.spec.id,
    key: options.spec.key,
    title: options.title,
    subtitle: options.subtitle,
    columns,
    rows: options.rows.map((row) => ({
      id: row.id,
      cells: resolveDrilldownCells(row, options.fieldOptions, columns)
    })),
    sourceLabel: options.sourceLabel
  };
}

function resolveRecordWindowFromSpec(
  spec: DashboardRecordWindowSpec,
  widget: DashboardWidgetDefinition | null,
  result: DashboardWidgetResult | null,
  sourceLabel: string
): DashboardRecordWindow | null {
  if (!widget || !result) return null;

  if (spec.kind === "metric" && result.kind === "metric") {
    return buildRecordWindowFromRows({
      spec,
      title: widget.title,
      subtitle: `${result.rows.length} record${result.rows.length === 1 ? "" : "s"}`,
      rows: result.rows,
      fieldOptions: result.fieldOptions,
      sourceLabel
    });
  }

  if (spec.kind === "distribution" && result.kind === "distribution") {
    const item = result.items.find((entry) => entry.label === spec.label) ?? null;
    if (!item) return null;
    return buildRecordWindowFromRows({
      spec,
      title: `${widget.title} · ${item.label}`,
      subtitle: `${item.rows.length} record${item.rows.length === 1 ? "" : "s"}`,
      rows: item.rows,
      fieldOptions: result.fieldOptions,
      sourceLabel
    });
  }

  if (spec.kind === "table_row" && result.kind === "table") {
    const row = result.rows.find((entry) => entry.id === spec.rowId) ?? null;
    if (!row) return null;
    const bestLabel = row.cells.find((cell) => cell.trim().length > 0) ?? row.id;
    const drilldownRow: DashboardDrilldownRow = {
      id: row.id,
      values: row.values
    };
    return buildRecordWindowFromRows({
      spec,
      title: `${widget.title} · ${bestLabel}`,
      subtitle: "1 record",
      rows: [drilldownRow],
      fieldOptions: result.fieldOptions,
      sourceLabel
    });
  }

  if (spec.kind === "matrix_cell" && result.kind === "matrix") {
    const row = result.rows.find((entry) => entry.label === spec.rowLabel) ?? null;
    const cell = row?.cells.find((entry) => entry.label === spec.columnLabel) ?? null;
    if (!cell) return null;
    return buildRecordWindowFromRows({
      spec,
      title: `${widget.title} · ${spec.rowLabel} / ${spec.columnLabel}`,
      subtitle: `${cell.rows.length} record${cell.rows.length === 1 ? "" : "s"}`,
      rows: cell.rows,
      fieldOptions: result.fieldOptions,
      sourceLabel
    });
  }

  return null;
}

function DashboardIconButton({
  label,
  danger = false,
  disabled = false,
  onClick,
  children
}: {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <OdeTooltip label={label} side="bottom">
      <button
        type="button"
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition ${
          disabled
            ? "cursor-not-allowed border-[rgba(120,196,255,0.12)] text-[rgba(163,220,255,0.32)]"
            : danger
              ? "border-[rgba(255,132,132,0.28)] text-[#ffcaca] hover:border-[rgba(255,132,132,0.52)] hover:text-white"
              : "border-[rgba(120,196,255,0.22)] text-[#d8f2ff] hover:border-[#66c6ff] hover:text-white"
        }`}
        onClick={onClick}
        aria-label={label}
        disabled={disabled}
      >
        {children}
      </button>
    </OdeTooltip>
  );
}

function renderWidgetResult(result: DashboardWidgetResult) {
  if (result.kind === "metric") {
    return (
      <div className="flex min-h-[180px] items-end rounded-[24px] border border-[rgba(66,178,255,0.24)] bg-[rgba(7,33,52,0.82)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.22)]">
        <div className="text-5xl font-semibold text-[#f3fbff]">{result.value}</div>
      </div>
    );
  }

  if (result.kind === "distribution") {
    const maxValue = result.items.reduce((highest, item) => Math.max(highest, item.value), 0);
    return (
      <div className="min-h-[180px] rounded-[24px] border border-[rgba(66,178,255,0.24)] bg-[rgba(7,33,52,0.82)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.22)]">
        <div className="space-y-3">
          {result.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[rgba(120,196,255,0.22)] px-4 py-5 text-sm text-[rgba(188,225,255,0.72)]">
              No grouped values yet.
            </div>
          ) : (
            result.items.map((item) => {
              const width = maxValue > 0 ? `${Math.max(10, (item.value / maxValue) * 100)}%` : "10%";
              return (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm text-[#d9f2ff]">
                    <span className="truncate">{item.label}</span>
                    <span className="font-medium text-[#8ad3ff]">{item.value}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[rgba(10,23,39,0.75)]">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#2fa9ff,#6be2ff)]"
                      style={{ width }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  if (result.kind === "matrix") {
    return (
      <div className="min-h-[180px] rounded-[24px] border border-[rgba(66,178,255,0.24)] bg-[rgba(7,33,52,0.82)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.22)]">
        <div className="overflow-x-auto">
          <div className="overflow-hidden rounded-2xl border border-[rgba(120,196,255,0.2)]">
            <div
              className="grid border-b border-[rgba(120,196,255,0.12)] bg-[rgba(9,26,43,0.92)] px-3 py-2 text-[0.72rem] font-medium uppercase tracking-[0.14em] text-[rgba(169,224,255,0.7)]"
              style={{ gridTemplateColumns: `minmax(140px,1.1fr) repeat(${Math.max(result.columns.length, 1)}, minmax(100px, 1fr))` }}
            >
              <span className="truncate">{result.rowFieldLabel}</span>
              {(result.columns.length > 0 ? result.columns : [result.columnFieldLabel || "Column"]).map((column) => (
                <span key={column} className="truncate text-center">
                  {column}
                </span>
              ))}
            </div>
            <div className="divide-y divide-[rgba(120,196,255,0.08)]">
              {result.rows.length === 0 ? (
                <div className="px-3 py-5 text-sm text-[rgba(188,225,255,0.72)]">No grouped rows yet.</div>
              ) : (
                result.rows.map((row) => (
                  <div
                    key={row.label}
                    className="grid px-3 py-2 text-sm text-[#e8f7ff]"
                    style={{ gridTemplateColumns: `minmax(140px,1.1fr) repeat(${Math.max(row.cells.length, 1)}, minmax(100px, 1fr))` }}
                  >
                    <span className="truncate font-medium text-[#dff4ff]">{row.label}</span>
                    {row.cells.map((cell) => (
                      <span key={cell.key} className="truncate text-center text-[#8ad3ff]">
                        {cell.displayValue}
                      </span>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[180px] rounded-[24px] border border-[rgba(66,178,255,0.24)] bg-[rgba(7,33,52,0.82)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.22)]">
      <div className="overflow-hidden rounded-2xl border border-[rgba(120,196,255,0.2)]">
        <div
          className="grid border-b border-[rgba(120,196,255,0.12)] bg-[rgba(9,26,43,0.92)] px-3 py-2 text-[0.72rem] font-medium uppercase tracking-[0.14em] text-[rgba(169,224,255,0.7)]"
          style={{ gridTemplateColumns: `repeat(${Math.max(result.columns.length, 1)}, minmax(0, 1fr))` }}
        >
          {(result.columns.length > 0 ? result.columns : ["No fields"]).map((column) => (
            <span key={column} className="truncate">
              {column}
            </span>
          ))}
        </div>
        <div className="divide-y divide-[rgba(120,196,255,0.08)]">
          {result.rows.length === 0 ? (
            <div className="px-3 py-5 text-sm text-[rgba(188,225,255,0.72)]">No rows yet.</div>
          ) : (
            result.rows.map((row) => (
              <div
                key={row.id}
                className="grid px-3 py-2 text-sm text-[#e8f7ff]"
                style={{ gridTemplateColumns: `repeat(${Math.max(row.cells.length, 1)}, minmax(0, 1fr))` }}
              >
                {(row.cells.length > 0 ? row.cells : [""]).map((cell, index) => (
                  <span key={`${row.id}-${index}`} className="truncate">
                    {cell || "—"}
                  </span>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function resolveDrilldownCellsSafe(
  row: DashboardDrilldownRow,
  fieldOptions: DashboardFieldOption[],
  columns: string[]
): string[] {
  if (fieldOptions.length > 0) {
    return fieldOptions.map((field) => row.values[field.id] || "-");
  }
  return columns.map((column) => row.values[column] || "-");
}

function buildRecordWindowFromRowsSafe(options: {
  spec: DashboardRecordWindowSpec;
  title: string;
  subtitle: string;
  rows: DashboardDrilldownRow[];
  fieldOptions: DashboardFieldOption[];
  sourceLabel: string;
}): DashboardRecordWindow {
  const columns = resolveDrilldownColumns(options.fieldOptions, options.rows);
  return {
    id: options.spec.id,
    key: options.spec.key,
    title: options.title,
    subtitle: options.subtitle,
    columns,
    rows: options.rows.map((row) => ({
      id: row.id,
      cells: resolveDrilldownCellsSafe(row, options.fieldOptions, columns)
    })),
    sourceLabel: options.sourceLabel
  };
}

function resolveRecordWindowFromSpecSafe(
  spec: DashboardRecordWindowSpec,
  widget: DashboardWidgetDefinition | null,
  result: DashboardWidgetResult | null,
  sourceLabel: string
): DashboardRecordWindow | null {
  if (!widget || !result) return null;

  if (spec.kind === "metric" && result.kind === "metric") {
    return buildRecordWindowFromRowsSafe({
      spec,
      title: widget.title,
      subtitle: buildRecordCountLabel(result.rows.length),
      rows: result.rows,
      fieldOptions: result.fieldOptions,
      sourceLabel
    });
  }

  if (spec.kind === "distribution" && result.kind === "distribution") {
    const item = result.items.find((entry) => entry.label === spec.label) ?? null;
    if (!item) return null;
    return buildRecordWindowFromRowsSafe({
      spec,
      title: `${widget.title} - ${item.label}`,
      subtitle: buildRecordCountLabel(item.rows.length),
      rows: item.rows,
      fieldOptions: result.fieldOptions,
      sourceLabel
    });
  }

  if (spec.kind === "table_row" && result.kind === "table") {
    const row = result.rows.find((entry) => entry.id === spec.rowId) ?? null;
    if (!row) return null;
    const bestLabel = row.cells.find((cell) => cell.trim().length > 0) ?? row.id;
    return buildRecordWindowFromRowsSafe({
      spec,
      title: `${widget.title} - ${bestLabel}`,
      subtitle: "1 record",
      rows: [
        {
          id: row.id,
          values: row.values
        }
      ],
      fieldOptions: result.fieldOptions,
      sourceLabel
    });
  }

  if (spec.kind === "matrix_cell" && result.kind === "matrix") {
    const row = result.rows.find((entry) => entry.label === spec.rowLabel) ?? null;
    const cell = row?.cells.find((entry) => entry.label === spec.columnLabel) ?? null;
    if (!cell) return null;
    return buildRecordWindowFromRowsSafe({
      spec,
      title: `${widget.title} - ${spec.rowLabel} / ${spec.columnLabel}`,
      subtitle: buildRecordCountLabel(cell.rows.length),
      rows: cell.rows,
      fieldOptions: result.fieldOptions,
      sourceLabel
    });
  }

  return null;
}

function renderInteractiveWidgetResult(options: {
  widget: DashboardWidgetDefinition;
  result: DashboardWidgetResult;
  onOpenRecordWindow: (spec: DashboardRecordWindowSeed) => void;
}) {
  const { widget, result, onOpenRecordWindow } = options;

  if (result.kind === "metric") {
    return (
      <button
        type="button"
        className="flex min-h-[180px] w-full items-end rounded-[24px] border border-[rgba(66,178,255,0.24)] bg-[rgba(7,33,52,0.82)] p-5 text-left shadow-[0_24px_60px_rgba(0,0,0,0.22)] transition hover:border-[#66c6ff] hover:bg-[rgba(9,37,58,0.9)]"
        onClick={() => {
          onOpenRecordWindow({
            key: `metric:${widget.nodeId}`,
            widgetNodeId: widget.nodeId,
            kind: "metric"
          });
        }}
      >
        <div className="text-5xl font-semibold text-[#f3fbff]">{result.value}</div>
      </button>
    );
  }

  if (result.kind === "distribution") {
    const maxValue = result.items.reduce((highest, item) => Math.max(highest, item.value), 0);
    return (
      <div className="min-h-[180px] rounded-[24px] border border-[rgba(66,178,255,0.24)] bg-[rgba(7,33,52,0.82)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.22)]">
        <div className="space-y-3">
          {result.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[rgba(120,196,255,0.22)] px-4 py-5 text-sm text-[rgba(188,225,255,0.72)]">
              No grouped values yet for this widget.
            </div>
          ) : (
            result.items.map((item) => {
              const width = maxValue > 0 ? `${Math.max(10, (item.value / maxValue) * 100)}%` : "10%";
              return (
                <button
                  key={item.label}
                  type="button"
                  className="block w-full rounded-2xl border border-transparent px-2 py-2 text-left transition hover:border-[rgba(102,198,255,0.34)] hover:bg-[rgba(11,35,55,0.78)]"
                  onClick={() => {
                    onOpenRecordWindow({
                      key: `distribution:${widget.nodeId}:${item.label}`,
                      widgetNodeId: widget.nodeId,
                      kind: "distribution",
                      label: item.label
                    });
                  }}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm text-[#d9f2ff]">
                      <span className="truncate">{item.label}</span>
                      <span className="font-medium text-[#8ad3ff]">{item.value}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[rgba(10,23,39,0.75)]">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#2fa9ff,#6be2ff)]"
                        style={{ width }}
                      />
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  }

  if (result.kind === "matrix") {
    return (
      <div className="min-h-[180px] rounded-[24px] border border-[rgba(66,178,255,0.24)] bg-[rgba(7,33,52,0.82)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.22)]">
        <div className="overflow-x-auto">
          <div className="overflow-hidden rounded-2xl border border-[rgba(120,196,255,0.2)]">
            <div
              className="grid border-b border-[rgba(120,196,255,0.12)] bg-[rgba(9,26,43,0.92)] px-3 py-2 text-[0.72rem] font-medium uppercase tracking-[0.14em] text-[rgba(169,224,255,0.7)]"
              style={{ gridTemplateColumns: `minmax(140px,1.1fr) repeat(${Math.max(result.columns.length, 1)}, minmax(100px, 1fr))` }}
            >
              <span className="truncate">{result.rowFieldLabel}</span>
              {(result.columns.length > 0 ? result.columns : [result.columnFieldLabel || "Column"]).map((column) => (
                <span key={column} className="truncate text-center">
                  {column}
                </span>
              ))}
            </div>
            <div className="divide-y divide-[rgba(120,196,255,0.08)]">
              {result.rows.length === 0 ? (
                <div className="px-3 py-5 text-sm text-[rgba(188,225,255,0.72)]">No grouped rows yet for this widget.</div>
              ) : (
                result.rows.map((row) => (
                  <div
                    key={row.label}
                    className="grid px-3 py-2 text-sm text-[#e8f7ff]"
                    style={{ gridTemplateColumns: `minmax(140px,1.1fr) repeat(${Math.max(row.cells.length, 1)}, minmax(100px, 1fr))` }}
                  >
                    <span className="truncate font-medium text-[#dff4ff]">{row.label}</span>
                    {row.cells.map((cell) => (
                      <button
                        key={cell.key}
                        type="button"
                        className="rounded-lg px-2 py-1 text-center text-[#8ad3ff] transition hover:bg-[rgba(11,35,55,0.78)] hover:text-white"
                        onClick={() => {
                          onOpenRecordWindow({
                            key: `matrix:${widget.nodeId}:${row.label}:${cell.label}`,
                            widgetNodeId: widget.nodeId,
                            kind: "matrix_cell",
                            rowLabel: row.label,
                            columnLabel: cell.label
                          });
                        }}
                      >
                        {cell.displayValue}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[180px] rounded-[24px] border border-[rgba(66,178,255,0.24)] bg-[rgba(7,33,52,0.82)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.22)]">
      <div className="overflow-hidden rounded-2xl border border-[rgba(120,196,255,0.2)]">
        <div
          className="grid border-b border-[rgba(120,196,255,0.12)] bg-[rgba(9,26,43,0.92)] px-3 py-2 text-[0.72rem] font-medium uppercase tracking-[0.14em] text-[rgba(169,224,255,0.7)]"
          style={{ gridTemplateColumns: `repeat(${Math.max(result.columns.length, 1)}, minmax(0, 1fr))` }}
        >
          {(result.columns.length > 0 ? result.columns : ["No fields"]).map((column) => (
            <span key={column} className="truncate">
              {column}
            </span>
          ))}
        </div>
        <div className="divide-y divide-[rgba(120,196,255,0.08)]">
          {result.rows.length === 0 ? (
            <div className="px-3 py-5 text-sm text-[rgba(188,225,255,0.72)]">No rows available for this widget.</div>
          ) : (
            result.rows.map((row) => (
              <button
                key={row.id}
                type="button"
                className="grid w-full px-3 py-2 text-left text-sm text-[#e8f7ff] transition hover:bg-[rgba(11,35,55,0.82)]"
                style={{ gridTemplateColumns: `repeat(${Math.max(row.cells.length, 1)}, minmax(0, 1fr))` }}
                onClick={() => {
                  onOpenRecordWindow({
                    key: `table:${widget.nodeId}:${row.id}`,
                    widgetNodeId: widget.nodeId,
                    kind: "table_row",
                    rowId: row.id
                  });
                }}
              >
                {(row.cells.length > 0 ? row.cells : [""]).map((cell, index) => (
                  <span key={`${row.id}-${index}`} className="truncate">
                    {cell || "-"}
                  </span>
                ))}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function DashboardPanel({
  rootNode,
  childNodes,
  allNodes,
  onCreateWidget,
  onRenameWidget,
  onSaveWidgetProperties,
  onMoveWidget,
  onDeleteWidget
}: DashboardPanelProps) {
  const widgetNodes = useMemo(
    () => childNodes.filter((node) => isDashboardWidgetNode(node)),
    [childNodes]
  );
  const sourceOptions = useMemo(() => buildDashboardSourceOptions(allNodes), [allNodes]);
  const widgetDefinitions = useMemo(
    () => widgetNodes.map((node) => buildDashboardWidgetDefinition(node)),
    [widgetNodes]
  );
  const widgetById = useMemo(
    () => new Map(widgetDefinitions.map((widget) => [widget.nodeId, widget] as const)),
    [widgetDefinitions]
  );
  const sourceLabelById = useMemo(
    () => new Map(sourceOptions.map((option) => [option.id, option.label] as const)),
    [sourceOptions]
  );
  const widgetResultsById = useMemo(
    () =>
      new Map(widgetDefinitions.map((widget) => [widget.nodeId, evaluateDashboardWidget(widget, allNodes)] as const)),
    [allNodes, widgetDefinitions]
  );
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DashboardWidgetDraft | null>(null);
  const [pendingCreate, setPendingCreate] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [recordWindowState, setRecordWindowState] = useState<{
    rootNodeId: string;
    specs: DashboardRecordWindowSpec[];
    activeId: string | null;
  }>(() => {
    const specs = readDashboardRecordWindowSpecs(rootNode.id);
    return {
      rootNodeId: rootNode.id,
      specs,
      activeId: specs.length > 0 ? specs[specs.length - 1]?.id ?? null : null
    };
  });
  const initializedDraftWidgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!editingWidgetId) {
      initializedDraftWidgetIdRef.current = null;
      setDraft(null);
      return;
    }
    const widget = widgetById.get(editingWidgetId) ?? null;
    if (!widget) {
      initializedDraftWidgetIdRef.current = null;
      setEditingWidgetId(null);
      setDraft(null);
      return;
    }
    if (initializedDraftWidgetIdRef.current !== editingWidgetId || draft === null) {
      initializedDraftWidgetIdRef.current = editingWidgetId;
      setDraft(buildWidgetDraft(widget));
    }
  }, [draft, editingWidgetId, widgetById]);

  useEffect(() => {
    setRecordWindowState((current) => {
      if (current.rootNodeId === rootNode.id) return current;
      const specs = readDashboardRecordWindowSpecs(rootNode.id);
      return {
        rootNodeId: rootNode.id,
        specs,
        activeId: specs.length > 0 ? specs[specs.length - 1]?.id ?? null : null
      };
    });
  }, [rootNode.id]);

  useEffect(() => {
    writeDashboardRecordWindowSpecs(recordWindowState.rootNodeId, recordWindowState.specs);
  }, [recordWindowState.rootNodeId, recordWindowState.specs]);

  const activeRecordWindowSpecs = useMemo(
    () => (recordWindowState.rootNodeId === rootNode.id ? recordWindowState.specs : []),
    [recordWindowState.rootNodeId, recordWindowState.specs, rootNode.id]
  );

  const resolvedRecordWindows = useMemo(() => {
    return activeRecordWindowSpecs
      .map((spec) => {
        const widget = widgetById.get(spec.widgetNodeId) ?? null;
        const result = widgetResultsById.get(spec.widgetNodeId) ?? null;
        const sourceLabel = widget?.sourceNodeId
          ? sourceLabelById.get(widget.sourceNodeId) ?? widget.sourceNodeId
          : widget?.sourceKind === "execution_items"
            ? "Execution items"
            : "Database records";
        return resolveRecordWindowFromSpecSafe(spec, widget, result, sourceLabel);
      })
      .filter((window): window is DashboardRecordWindow => window !== null);
  }, [activeRecordWindowSpecs, sourceLabelById, widgetById, widgetResultsById]);

  useEffect(() => {
    const validIds = new Set(resolvedRecordWindows.map((window) => window.id));
    setRecordWindowState((current) => {
      if (current.rootNodeId !== rootNode.id) return current;
      const nextSpecs = current.specs.filter((spec) => validIds.has(spec.id));
      const nextActiveId =
        current.activeId && validIds.has(current.activeId)
          ? current.activeId
          : nextSpecs.length > 0
            ? nextSpecs[nextSpecs.length - 1]?.id ?? null
            : null;
      if (nextSpecs.length === current.specs.length && nextActiveId === current.activeId) {
        return current;
      }
      return {
        ...current,
        specs: nextSpecs,
        activeId: nextActiveId
      };
    });
  }, [resolvedRecordWindows, rootNode.id]);

  const activeRecordWindow =
    resolvedRecordWindows.find((window) => window.id === recordWindowState.activeId) ??
    (resolvedRecordWindows.length > 0 ? resolvedRecordWindows[resolvedRecordWindows.length - 1] ?? null : null);

  const activeSourceOptions = useMemo(
    () => sourceOptions.filter((option) => option.sourceKind === (draft?.sourceKind ?? "database_records")),
    [draft?.sourceKind, sourceOptions]
  );

  const activeFieldOptions = useMemo<DashboardFieldOption[]>(
    () =>
      resolveDashboardFieldOptions(
        allNodes,
        draft?.sourceKind ?? "database_records",
        draft?.sourceNodeId?.trim() || null
      ),
    [allNodes, draft?.sourceKind, draft?.sourceNodeId]
  );

  const previewResult = useMemo(() => {
    if (!draft || !editingWidgetId) return null;
    return evaluateDashboardWidget(
      {
        nodeId: editingWidgetId,
        title: draft.title.trim() || "Untitled Widget",
        widgetType: draft.widgetType,
        sourceKind: draft.sourceKind,
        sourceNodeId: draft.sourceNodeId.trim() || null,
        aggregation: draft.aggregation,
        measureFieldId: draft.measureFieldId.trim() || null,
        groupFieldId: draft.groupFieldId.trim() || null,
        secondaryGroupFieldId: draft.secondaryGroupFieldId.trim() || null,
        displayFieldIds: draft.displayFieldIds,
        filterFieldId: draft.filterFieldId.trim() || null,
        filterOperator: draft.filterOperator,
        filterValue: draft.filterValue,
        limit: sanitizeLimit(draft.limit)
      },
      allNodes
    );
  }, [allNodes, draft, editingWidgetId]);

  const handleAddWidget = async () => {
    if (pendingCreate) return;
    setPendingCreate(true);
    try {
      const createdWidgetId = await onCreateWidget(rootNode.id);
      if (createdWidgetId) {
        setEditingWidgetId(createdWidgetId);
      }
    } finally {
      setPendingCreate(false);
    }
  };

  const handleSaveWidget = async () => {
    if (!draft || !editingWidgetId || pendingSave) return;
    const currentWidget = widgetById.get(editingWidgetId) ?? null;
    if (!currentWidget) return;

    setPendingSave(true);
    try {
      const normalizedTitle = draft.title.trim() || "Untitled Widget";
      const nextProperties = buildWidgetProperties(draft);
      const operations: Array<Promise<void> | void> = [onSaveWidgetProperties(editingWidgetId, nextProperties)];
      if (normalizedTitle !== currentWidget.title) {
        operations.push(onRenameWidget(editingWidgetId, normalizedTitle));
      }
      await Promise.all(operations);
      setEditingWidgetId(null);
    } finally {
      setPendingSave(false);
    }
  };

  const handleDeleteWidget = async (widgetId: string) => {
    if (pendingDeleteId) return;
    setPendingDeleteId(widgetId);
    try {
      await onDeleteWidget(widgetId);
      if (editingWidgetId === widgetId) {
        setEditingWidgetId(null);
      }
    } finally {
      setPendingDeleteId(null);
    }
  };

  const openRecordWindow = (seed: DashboardRecordWindowSeed) => {
    setRecordWindowState((current) => {
      const currentSpecs = current.rootNodeId === rootNode.id ? current.specs : [];
      const existing = currentSpecs.find((spec) => spec.key === seed.key) ?? null;
      if (existing) {
        return {
          rootNodeId: rootNode.id,
          specs: currentSpecs,
          activeId: existing.id
        };
      }
      const nextSpec = {
        ...seed,
        id: createDashboardRecordWindowId()
      } as DashboardRecordWindowSpec;
      const nextSpecs = [...currentSpecs, nextSpec].slice(-MAX_RECORD_WINDOWS);
      return {
        rootNodeId: rootNode.id,
        specs: nextSpecs,
        activeId: nextSpec.id
      };
    });
  };

  const closeRecordWindow = (windowId: string) => {
    setRecordWindowState((current) => {
      if (current.rootNodeId !== rootNode.id) return current;
      const nextSpecs = current.specs.filter((spec) => spec.id !== windowId);
      const nextActiveId =
        current.activeId === windowId
          ? nextSpecs.length > 0
            ? nextSpecs[nextSpecs.length - 1]?.id ?? null
            : null
          : current.activeId;
      return {
        ...current,
        specs: nextSpecs,
        activeId: nextActiveId
      };
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[rgba(76,184,255,0.16)] bg-[rgba(4,21,34,0.58)] px-5 py-4 shadow-[0_22px_62px_rgba(0,0,0,0.18)]">
        <div className="flex items-center justify-end">
          <DashboardIconButton
            label={pendingCreate ? "Creating widget" : "Add Widget"}
            onClick={() => {
              void handleAddWidget();
            }}
          >
            <PlusGlyphSmall />
          </DashboardIconButton>
        </div>
      </section>

      {resolvedRecordWindows.length > 0 && activeRecordWindow ? (
        <section className="rounded-[28px] border border-[rgba(76,184,255,0.18)] bg-[rgba(4,18,31,0.82)] px-5 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
          <div className="flex gap-2 overflow-x-auto pb-3">
            {resolvedRecordWindows.map((window) => {
              const isActive = activeRecordWindow.id === window.id;
              return (
                <div
                  key={window.id}
                  className={`flex min-w-0 items-center gap-2 rounded-full border px-3 py-2 ${
                    isActive
                      ? "border-[#66c6ff] bg-[rgba(20,68,102,0.72)]"
                      : "border-[rgba(120,196,255,0.18)] bg-[rgba(8,26,42,0.7)]"
                  }`}
                >
                  <button
                    type="button"
                    className={`min-w-0 truncate text-sm ${
                      isActive ? "text-white" : "text-[rgba(216,242,255,0.82)]"
                    }`}
                    onClick={() => {
                      setRecordWindowState((current) =>
                        current.rootNodeId === rootNode.id ? { ...current, activeId: window.id } : current
                      );
                    }}
                  >
                    {window.title}
                  </button>
                  <button
                    type="button"
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[0.95rem] leading-none text-[rgba(216,242,255,0.72)] transition hover:bg-[rgba(255,255,255,0.08)] hover:text-white"
                    onClick={() => {
                      closeRecordWindow(window.id);
                    }}
                    aria-label={`Close ${window.title}`}
                  >
                    x
                  </button>
                </div>
              );
            })}
          </div>

          <div className="rounded-[24px] border border-[rgba(120,196,255,0.18)] bg-[rgba(7,28,44,0.88)]">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[rgba(120,196,255,0.12)] px-5 py-4">
              <div>
                <div className="text-xl font-semibold text-[#f4fbff]">{activeRecordWindow.title}</div>
                <div className="mt-1 text-sm text-[rgba(192,229,255,0.78)]">
                  {activeRecordWindow.subtitle} · {activeRecordWindow.sourceLabel}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div
                className="grid min-w-full border-b border-[rgba(120,196,255,0.12)] bg-[rgba(9,26,43,0.92)] px-4 py-3 text-[0.72rem] font-medium uppercase tracking-[0.14em] text-[rgba(169,224,255,0.7)]"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(activeRecordWindow.columns.length, 1)}, minmax(180px, 1fr))`
                }}
              >
                {(activeRecordWindow.columns.length > 0 ? activeRecordWindow.columns : ["Record"]).map((column) => (
                  <span key={column} className="truncate pr-3">
                    {column}
                  </span>
                ))}
              </div>
              <div className="divide-y divide-[rgba(120,196,255,0.08)]">
                {activeRecordWindow.rows.length === 0 ? (
                  <div className="px-4 py-5 text-sm text-[rgba(188,225,255,0.72)]">No records in this selection.</div>
                ) : (
                  activeRecordWindow.rows.map((row) => (
                    <div
                      key={row.id}
                      className="grid min-w-full px-4 py-3 text-sm text-[#e8f7ff]"
                      style={{
                        gridTemplateColumns: `repeat(${Math.max(row.cells.length, 1)}, minmax(180px, 1fr))`
                      }}
                    >
                      {(row.cells.length > 0 ? row.cells : ["-"]).map((cell, index) => (
                        <span key={`${row.id}-${index}`} className="truncate pr-3">
                          {cell || "-"}
                        </span>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {widgetNodes.length > 0 ? (
        <section className="grid gap-5 xl:grid-cols-2">
          {widgetDefinitions.map((widget, index) => {
            const result = widgetResultsById.get(widget.nodeId) ?? evaluateDashboardWidget(widget, allNodes);
            const isEditing = editingWidgetId === widget.nodeId;
            const canMoveLeft = index > 0;
            const canMoveRight = index < widgetDefinitions.length - 1;
            const canMoveUp = index >= 2;
            const canMoveDown = index + 2 < widgetDefinitions.length;
            return (
              <article
                key={widget.nodeId}
                className={`overflow-hidden rounded-[28px] border transition ${
                  isEditing
                    ? "border-[#5bc0ff] bg-[rgba(4,22,36,0.92)] shadow-[0_28px_80px_rgba(0,0,0,0.34)]"
                    : "border-[rgba(76,184,255,0.18)] bg-[rgba(4,18,31,0.82)] shadow-[0_20px_60px_rgba(0,0,0,0.2)]"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4 px-5 pb-4 pt-5">
                  <div className="text-xl font-semibold text-[#f2fbff]">{widget.title}</div>
                  <div className="flex items-center gap-2">
                    <DashboardIconButton
                      label="Move Widget Up"
                      disabled={!canMoveUp}
                      onClick={() => {
                        void onMoveWidget(widget.nodeId, "up");
                      }}
                    >
                      <ArrowUpGlyphSmall />
                    </DashboardIconButton>
                    <DashboardIconButton
                      label="Move Widget Left"
                      disabled={!canMoveLeft}
                      onClick={() => {
                        void onMoveWidget(widget.nodeId, "left");
                      }}
                    >
                      <ArrowLeftGlyphSmall />
                    </DashboardIconButton>
                    <DashboardIconButton
                      label="Move Widget Right"
                      disabled={!canMoveRight}
                      onClick={() => {
                        void onMoveWidget(widget.nodeId, "right");
                      }}
                    >
                      <ArrowRightGlyphSmall />
                    </DashboardIconButton>
                    <DashboardIconButton
                      label="Move Widget Down"
                      disabled={!canMoveDown}
                      onClick={() => {
                        void onMoveWidget(widget.nodeId, "down");
                      }}
                    >
                      <ArrowDownGlyphSmall />
                    </DashboardIconButton>
                    <DashboardIconButton
                      label="Edit Widget"
                      onClick={() => {
                        setEditingWidgetId(widget.nodeId);
                      }}
                    >
                      <EditGlyphSmall />
                    </DashboardIconButton>
                    <DashboardIconButton
                      label={pendingDeleteId === widget.nodeId ? "Deleting widget" : "Delete Widget"}
                      danger
                      onClick={() => {
                        void handleDeleteWidget(widget.nodeId);
                      }}
                    >
                      <TrashGlyphSmall />
                    </DashboardIconButton>
                  </div>
                </div>
                <div className="px-5 pb-5">
                  {renderInteractiveWidgetResult({
                    widget,
                    result,
                    onOpenRecordWindow: openRecordWindow
                  })}
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      {draft && editingWidgetId ? (
        <section
          data-ode-dashboard-editor="true"
          className="rounded-[28px] border border-[rgba(76,184,255,0.24)] bg-[rgba(4,21,34,0.92)] px-6 py-6 shadow-[0_28px_80px_rgba(0,0,0,0.3)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[0.78rem] uppercase tracking-[0.24em] text-[#69cbff]">Widget Editor</div>
              <div className="mt-2 text-2xl font-semibold text-[#f4fbff]">{draft.title.trim() || "Untitled Widget"}</div>
              <div className="mt-2 max-w-3xl text-sm leading-6 text-[rgba(199,233,255,0.76)]">
                Configure the widget and review the result live.
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-full border border-[rgba(120,196,255,0.22)] px-4 py-2 text-sm font-medium text-[#d8f2ff] transition hover:border-[#66c6ff] hover:text-white"
                onClick={() => {
                  setEditingWidgetId(null);
                }}
              >
                Close
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-[#dbf3ff]">Widget title</span>
              <input
                value={draft.title}
                onChange={(event) => {
                  const value = event.target.value;
                  setDraft((current) => (current ? { ...current, title: value } : current));
                }}
                className="ode-input w-full rounded-2xl px-4 py-3"
                placeholder="Critical gaps by department"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-[#dbf3ff]">Widget type</span>
              <select
                value={draft.widgetType}
                onChange={(event) => {
                  const widgetType = event.target.value as DashboardWidgetType;
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          widgetType,
                          secondaryGroupFieldId: widgetType === "matrix" ? current.secondaryGroupFieldId : ""
                        }
                      : current
                  );
                }}
                className="ode-input w-full rounded-2xl px-4 py-3"
              >
                {WIDGET_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-[#dbf3ff]">Source kind</span>
              <select
                value={draft.sourceKind}
                onChange={(event) => {
                  const sourceKind = event.target.value as DashboardSourceKind;
                  const nextSource = sourceOptions.find((option) => option.sourceKind === sourceKind)?.id ?? "";
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          sourceKind,
                          sourceNodeId: nextSource,
                          measureFieldId: "",
                          groupFieldId: "",
                          secondaryGroupFieldId: "",
                          displayFieldIds: [],
                          filterFieldId: ""
                        }
                      : current
                  );
                }}
                className="ode-input w-full rounded-2xl px-4 py-3"
              >
                <option value="database_records">Database records</option>
                <option value="execution_items">Execution items</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-[#dbf3ff]">Source</span>
              <select
                value={draft.sourceNodeId}
                onChange={(event) => {
                  const sourceNodeId = event.target.value;
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          sourceNodeId,
                          measureFieldId: "",
                          groupFieldId: "",
                          secondaryGroupFieldId: "",
                          displayFieldIds: [],
                          filterFieldId: ""
                        }
                      : current
                  );
                }}
                className="ode-input w-full rounded-2xl px-4 py-3"
              >
                <option value="">Select a source</option>
                {activeSourceOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {draft.widgetType !== "table" ? (
              <label className="space-y-2">
                <span className="text-sm font-medium text-[#dbf3ff]">Aggregation</span>
                <select
                  value={draft.aggregation}
                  onChange={(event) => {
                    const aggregation = event.target.value as DashboardAggregation;
                    setDraft((current) => (current ? { ...current, aggregation } : current));
                  }}
                  className="ode-input w-full rounded-2xl px-4 py-3"
                >
                  {AGGREGATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="space-y-2">
                <span className="text-sm font-medium text-[#dbf3ff]">Limit</span>
                <input
                  type="number"
                  min={1}
                  value={draft.limit}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDraft((current) => (current ? { ...current, limit: value } : current));
                  }}
                  className="ode-input w-full rounded-2xl px-4 py-3"
                />
              </label>
            )}

            {draft.widgetType !== "metric" ? (
              <label className="space-y-2">
                <span className="text-sm font-medium text-[#dbf3ff]">
                  {draft.widgetType === "distribution"
                    ? "Group field"
                    : draft.widgetType === "matrix"
                      ? "Column field"
                      : "Primary grouping field"}
                </span>
                <select
                  value={draft.groupFieldId}
                  onChange={(event) => {
                    const groupFieldId = event.target.value;
                    setDraft((current) => (current ? { ...current, groupFieldId } : current));
                  }}
                  className="ode-input w-full rounded-2xl px-4 py-3"
                >
                  <option value="">Select a field</option>
                  {activeFieldOptions.map((field) => (
                    <option key={field.id} value={field.id}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="space-y-2">
                <span className="text-sm font-medium text-[#dbf3ff]">Limit</span>
                <input
                  type="number"
                  min={1}
                  value={draft.limit}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDraft((current) => (current ? { ...current, limit: value } : current));
                  }}
                  className="ode-input w-full rounded-2xl px-4 py-3"
                />
              </label>
            )}

            {draft.widgetType === "matrix" ? (
              <label className="space-y-2">
                <span className="text-sm font-medium text-[#dbf3ff]">Row field</span>
                <select
                  value={draft.secondaryGroupFieldId}
                  onChange={(event) => {
                    const secondaryGroupFieldId = event.target.value;
                    setDraft((current) => (current ? { ...current, secondaryGroupFieldId } : current));
                  }}
                  className="ode-input w-full rounded-2xl px-4 py-3"
                >
                  <option value="">Select a field</option>
                  {activeFieldOptions.map((field) => (
                    <option key={`${field.id}-secondary`} value={field.id}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {draft.widgetType !== "table" || draft.aggregation !== "count" ? (
              <label className="space-y-2">
                <span className="text-sm font-medium text-[#dbf3ff]">
                  {draft.widgetType === "matrix" ? "Cell value field" : "Measure field"}
                </span>
                <select
                  value={draft.measureFieldId}
                  onChange={(event) => {
                    const measureFieldId = event.target.value;
                    setDraft((current) => (current ? { ...current, measureFieldId } : current));
                  }}
                  className="ode-input w-full rounded-2xl px-4 py-3"
                >
                  <option value="">None</option>
                  {activeFieldOptions.map((field) => (
                    <option key={field.id} value={field.id}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {draft.widgetType !== "table" ? null : (
              <div className="space-y-2">
                <span className="text-sm font-medium text-[#dbf3ff]">Display fields</span>
                <div className="grid gap-2 rounded-2xl border border-[rgba(120,196,255,0.2)] bg-[rgba(8,27,42,0.72)] p-4 sm:grid-cols-2">
                  {activeFieldOptions.length === 0 ? (
                    <div className="text-sm text-[rgba(188,225,255,0.72)]">Choose a source to pick fields.</div>
                  ) : (
                    activeFieldOptions.map((field) => {
                      const checked = draft.displayFieldIds.includes(field.id);
                      return (
                        <label key={field.id} className="flex items-center gap-3 text-sm text-[#ddf3ff]">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              const nextChecked = event.target.checked;
                              setDraft((current) => {
                                if (!current) return current;
                                const displayFieldIds = nextChecked
                                  ? Array.from(new Set([...current.displayFieldIds, field.id]))
                                  : current.displayFieldIds.filter((fieldId) => fieldId !== field.id);
                                return {
                                  ...current,
                                  displayFieldIds
                                };
                              });
                            }}
                          />
                          <span>{field.label}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <label className="space-y-2">
              <span className="text-sm font-medium text-[#dbf3ff]">Filter field</span>
              <select
                value={draft.filterFieldId}
                onChange={(event) => {
                  const filterFieldId = event.target.value;
                  setDraft((current) => (current ? { ...current, filterFieldId } : current));
                }}
                className="ode-input w-full rounded-2xl px-4 py-3"
              >
                <option value="">No filter</option>
                {activeFieldOptions.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-[#dbf3ff]">Filter operator</span>
              <select
                value={draft.filterOperator}
                onChange={(event) => {
                  const filterOperator = event.target.value as DashboardFilterOperator;
                  setDraft((current) => (current ? { ...current, filterOperator } : current));
                }}
                className="ode-input w-full rounded-2xl px-4 py-3"
              >
                {FILTER_OPERATOR_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 lg:col-span-2">
              <span className="text-sm font-medium text-[#dbf3ff]">Filter value</span>
              <input
                value={draft.filterValue}
                onChange={(event) => {
                  const filterValue = event.target.value;
                  setDraft((current) => (current ? { ...current, filterValue } : current));
                }}
                className="ode-input w-full rounded-2xl px-4 py-3"
                placeholder="Critical"
              />
            </label>
          </div>

          <div className="mt-6 rounded-[24px] border border-[rgba(120,196,255,0.18)] bg-[rgba(5,18,30,0.86)] p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[0.76rem] uppercase tracking-[0.22em] text-[#69cbff]">Live Preview</div>
                <div className="mt-1 text-sm text-[rgba(199,233,255,0.76)]">Updates live from the current draft.</div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="rounded-full border border-[rgba(120,196,255,0.22)] px-4 py-2 text-sm font-medium text-[#d8f2ff] transition hover:border-[#66c6ff] hover:text-white"
                  onClick={() => {
                    setEditingWidgetId(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-full border border-[rgba(65,186,255,0.34)] bg-[linear-gradient(135deg,#2297ff,#57d2ff)] px-4 py-2 text-sm font-medium text-white shadow-[0_14px_36px_rgba(36,152,255,0.32)] transition hover:brightness-110"
                  onClick={() => {
                    void handleSaveWidget();
                  }}
                >
                  {pendingSave ? "Saving..." : "Save widget"}
                </button>
              </div>
            </div>
            {previewResult ? renderWidgetResult(previewResult) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
