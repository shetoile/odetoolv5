import {
  buildProcedureDatabaseModel,
  formatProcedureRecordValue,
  type ProcedureFieldDefinition,
  type ProcedureRecordValue
} from "@/lib/procedureDatabase";
import { getWorkareaItemKind, getWorkareaOwnerNodeId, isWorkareaItemNode } from "@/features/workspace/workarea";
import { isFileLikeNode, type AppNode } from "@/lib/types";

export type DashboardWidgetType = "metric" | "distribution" | "table" | "matrix";
export type DashboardSourceKind = "database_records" | "execution_items";
export type DashboardAggregation = "count" | "sum" | "avg" | "min" | "max";
export type DashboardFilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "gt"
  | "gte"
  | "lt"
  | "lte";
export type DashboardFieldValueType = "text" | "number" | "date" | "status" | "boolean" | "node" | "relation";

export type DashboardFieldOption = {
  id: string;
  label: string;
  valueType: DashboardFieldValueType;
};

export type DashboardWidgetDefinition = {
  nodeId: string;
  title: string;
  widgetType: DashboardWidgetType;
  sourceKind: DashboardSourceKind;
  sourceNodeId: string | null;
  aggregation: DashboardAggregation;
  measureFieldId: string | null;
  groupFieldId: string | null;
  secondaryGroupFieldId: string | null;
  displayFieldIds: string[];
  filterFieldId: string | null;
  filterOperator: DashboardFilterOperator;
  filterValue: string;
  limit: number;
};

export type DashboardSourceOption = {
  id: string;
  label: string;
  sourceKind: DashboardSourceKind;
};

type DashboardDataRow = {
  id: string;
  values: Record<string, string>;
};

export type DashboardDrilldownRow = DashboardDataRow;

export type DashboardWidgetResult =
  | {
      kind: "metric";
      title: string;
      value: string;
      subtitle: string;
      rowCount: number;
      fieldOptions: DashboardFieldOption[];
      rows: DashboardDrilldownRow[];
      sourceKind: DashboardSourceKind;
      sourceNodeId: string | null;
    }
  | {
      kind: "distribution";
      title: string;
      items: Array<{ label: string; value: number; rows: DashboardDrilldownRow[] }>;
      rowCount: number;
      fieldOptions: DashboardFieldOption[];
      sourceKind: DashboardSourceKind;
      sourceNodeId: string | null;
    }
  | {
      kind: "table";
      title: string;
      columns: string[];
      rows: Array<{ id: string; cells: string[]; values: Record<string, string> }>;
      rowCount: number;
      fieldOptions: DashboardFieldOption[];
      sourceKind: DashboardSourceKind;
      sourceNodeId: string | null;
    }
  | {
      kind: "matrix";
      title: string;
      rowFieldLabel: string;
      columnFieldLabel: string;
      columns: string[];
      rows: Array<{
        label: string;
        cells: Array<{
          key: string;
          label: string;
          value: number;
          displayValue: string;
          rows: DashboardDrilldownRow[];
        }>;
      }>;
      rowCount: number;
      fieldOptions: DashboardFieldOption[];
      sourceKind: DashboardSourceKind;
      sourceNodeId: string | null;
    };

const EXECUTION_SOURCE_ALL_ID = "__ode_dashboard_execution_all__";

const EXECUTION_FIELD_OPTIONS: DashboardFieldOption[] = [
  { id: "title", label: "Title", valueType: "text" },
  { id: "kind", label: "Kind", valueType: "text" },
  { id: "owner_node", label: "Owner Node", valueType: "node" },
  { id: "owner_name", label: "Owner Name", valueType: "text" },
  { id: "status", label: "Status", valueType: "status" },
  { id: "due_date", label: "Due Date", valueType: "date" },
  { id: "flagged", label: "Flagged", valueType: "boolean" },
  { id: "note", label: "Note", valueType: "text" }
];

function readStringProperty(properties: Record<string, unknown> | undefined, key: string): string {
  const value = properties?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function readStringArrayProperty(properties: Record<string, unknown> | undefined, key: string): string[] {
  const value = properties?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeWidgetType(value: unknown): DashboardWidgetType {
  switch (value) {
    case "distribution":
    case "table":
    case "matrix":
      return value;
    default:
      return "metric";
  }
}

function normalizeSourceKind(value: unknown): DashboardSourceKind {
  switch (value) {
    case "execution_items":
      return value;
    default:
      return "database_records";
  }
}

function normalizeAggregation(value: unknown): DashboardAggregation {
  switch (value) {
    case "sum":
    case "avg":
    case "min":
    case "max":
      return value;
    default:
      return "count";
  }
}

function normalizeFilterOperator(value: unknown): DashboardFilterOperator {
  switch (value) {
    case "not_equals":
    case "contains":
    case "gt":
    case "gte":
    case "lt":
    case "lte":
      return value;
    default:
      return "equals";
  }
}

function coerceNumber(value: string): number | null {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMetricValue(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.00$/, "");
}

function mapProcedureFieldValueType(field: ProcedureFieldDefinition): DashboardFieldValueType {
  switch (field.type) {
    case "number":
    case "decimal":
    case "percentage":
    case "currency":
    case "formula":
      return "number";
    case "date":
    case "datetime":
      return "date";
    case "yes_no":
      return "boolean";
    case "priority":
      return "status";
    case "node_link":
      return "node";
    case "relation":
    case "relation_list":
      return "relation";
    default:
      return "text";
  }
}

export function isDashboardNode(node: AppNode | null | undefined): boolean {
  return Boolean(node && !isFileLikeNode(node) && node.properties?.odeDashboard === true);
}

export function isDashboardWidgetNode(node: AppNode | null | undefined): boolean {
  return Boolean(node && !isFileLikeNode(node) && node.properties?.odeDashboardWidget === true);
}

export function buildDashboardWidgetDefinition(node: AppNode): DashboardWidgetDefinition {
  const rawLimit = Number(node.properties?.odeDashboardLimit);
  return {
    nodeId: node.id,
    title: node.name,
    widgetType: normalizeWidgetType(node.properties?.odeDashboardWidgetType),
    sourceKind: normalizeSourceKind(node.properties?.odeDashboardSourceKind),
    sourceNodeId: readStringProperty(node.properties, "odeDashboardSourceNodeId") || null,
    aggregation: normalizeAggregation(node.properties?.odeDashboardAggregation),
    measureFieldId: readStringProperty(node.properties, "odeDashboardMeasureFieldId") || null,
    groupFieldId: readStringProperty(node.properties, "odeDashboardGroupFieldId") || null,
    secondaryGroupFieldId: readStringProperty(node.properties, "odeDashboardSecondaryGroupFieldId") || null,
    displayFieldIds: readStringArrayProperty(node.properties, "odeDashboardDisplayFieldIds"),
    filterFieldId: readStringProperty(node.properties, "odeDashboardFilterFieldId") || null,
    filterOperator: normalizeFilterOperator(node.properties?.odeDashboardFilterOperator),
    filterValue: readStringProperty(node.properties, "odeDashboardFilterValue"),
    limit: Number.isFinite(rawLimit) && rawLimit > 0 ? Math.max(1, Math.floor(rawLimit)) : 6
  };
}

export function buildDashboardSourceOptions(nodes: AppNode[]): DashboardSourceOption[] {
  const model = buildProcedureDatabaseModel(nodes);
  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
  const byParent = new Map<string, AppNode[]>();
  for (const node of nodes) {
    const list = byParent.get(node.parentId) ?? [];
    list.push(node);
    byParent.set(node.parentId, list);
  }

  const executionOwnerIds = new Set<string>();
  for (const node of nodes) {
    if (isFileLikeNode(node)) continue;
    const children = byParent.get(node.id) ?? [];
    if (children.some((child) => child.properties?.odeWorkareaRoot === true || isWorkareaItemNode(child))) {
      executionOwnerIds.add(node.id);
    }
  }

  return [
    ...model.tables.map((table) => ({
      id: table.node.id,
      label: table.node.name,
      sourceKind: "database_records" as const
    })),
    {
      id: EXECUTION_SOURCE_ALL_ID,
      label: "Execution: All Items",
      sourceKind: "execution_items" as const
    },
    ...Array.from(executionOwnerIds)
      .map((ownerNodeId) => nodeById.get(ownerNodeId) ?? null)
      .filter((node): node is AppNode => node !== null)
      .map((node) => ({
        id: node.id,
        label: `Execution: ${node.name}`,
        sourceKind: "execution_items" as const
      }))
  ];
}

export function resolveDashboardFieldOptions(
  nodes: AppNode[],
  sourceKind: DashboardSourceKind,
  sourceNodeId: string | null
): DashboardFieldOption[] {
  if (sourceKind === "execution_items") {
    return EXECUTION_FIELD_OPTIONS;
  }

  if (!sourceNodeId) return [];
  const model = buildProcedureDatabaseModel(nodes);
  const table = model.tablesById.get(sourceNodeId) ?? null;
  if (!table) return [];
  return table.fields.map((field) => ({
    id: field.nodeId,
    label: field.label,
    valueType: mapProcedureFieldValueType(field)
  }));
}

function resolveDatabaseRows(
  nodes: AppNode[],
  sourceNodeId: string | null
): { rows: DashboardDataRow[]; fieldOptions: DashboardFieldOption[] } {
  if (!sourceNodeId) {
    return { rows: [], fieldOptions: [] };
  }

  const model = buildProcedureDatabaseModel(nodes);
  const table = model.tablesById.get(sourceNodeId) ?? null;
  if (!table) {
    return { rows: [], fieldOptions: [] };
  }

  return {
    rows: table.records.map((record) => ({
      id: record.id,
      values: Object.fromEntries(
        table.fields.map((field) => [
          field.nodeId,
          formatProcedureRecordValue(record.values[field.nodeId], field, model)
        ])
      )
    })),
    fieldOptions: table.fields.map((field) => ({
      id: field.nodeId,
      label: field.label,
      valueType: mapProcedureFieldValueType(field)
    }))
  };
}

function resolveExecutionRows(
  nodes: AppNode[],
  sourceNodeId: string | null
): { rows: DashboardDataRow[]; fieldOptions: DashboardFieldOption[] } {
  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
  const rows = nodes
    .filter((node) => isWorkareaItemNode(node))
    .map<DashboardDataRow | null>((node) => {
      const ownerNodeId = getWorkareaOwnerNodeId(node, nodeById);
      if (sourceNodeId && sourceNodeId !== EXECUTION_SOURCE_ALL_ID && ownerNodeId !== sourceNodeId) {
        return null;
      }
      const ownerNode = ownerNodeId ? nodeById.get(ownerNodeId) ?? null : null;
      return {
        id: node.id,
        values: {
          title: node.name.trim(),
          kind: getWorkareaItemKind(node, nodeById) ?? "task",
          owner_node: ownerNodeId ?? "",
          owner_name: ownerNode?.name ?? "",
          status: readStringProperty(node.properties, "odeExecutionTaskStatus") || "planned",
          due_date: readStringProperty(node.properties, "odeExecutionTaskDueDate"),
          flagged: node.properties?.odeExecutionTaskFlagged === true ? "Yes" : "No",
          note: typeof node.description === "string" ? node.description.trim() : ""
        }
      };
    })
    .filter((row): row is DashboardDataRow => row !== null);

  return {
    rows,
    fieldOptions: EXECUTION_FIELD_OPTIONS
  };
}

function applyWidgetFilter(rows: DashboardDataRow[], widget: DashboardWidgetDefinition): DashboardDataRow[] {
  if (!widget.filterFieldId || !widget.filterValue.trim()) return rows;

  const filterValue = widget.filterValue.trim().toLowerCase();
  return rows.filter((row) => {
    const candidate = row.values[widget.filterFieldId ?? ""] ?? "";
    const normalizedCandidate = candidate.toLowerCase();
    const candidateNumber = coerceNumber(candidate);
    const filterNumber = coerceNumber(widget.filterValue);

    switch (widget.filterOperator) {
      case "not_equals":
        return normalizedCandidate !== filterValue;
      case "contains":
        return normalizedCandidate.includes(filterValue);
      case "gt":
        return candidateNumber !== null && filterNumber !== null && candidateNumber > filterNumber;
      case "gte":
        return candidateNumber !== null && filterNumber !== null && candidateNumber >= filterNumber;
      case "lt":
        return candidateNumber !== null && filterNumber !== null && candidateNumber < filterNumber;
      case "lte":
        return candidateNumber !== null && filterNumber !== null && candidateNumber <= filterNumber;
      default:
        return normalizedCandidate === filterValue;
    }
  });
}

function aggregateMetric(rows: DashboardDataRow[], widget: DashboardWidgetDefinition): number {
  if (widget.aggregation === "count" || !widget.measureFieldId) {
    return rows.length;
  }

  const values = rows
    .map((row) => coerceNumber(row.values[widget.measureFieldId ?? ""]))
    .filter((value): value is number => value !== null);
  return aggregateNumericValues(values, widget.aggregation);
}

function aggregateNumericValues(values: number[], aggregation: Exclude<DashboardAggregation, "count">): number {
  if (values.length === 0) return 0;

  switch (aggregation) {
    case "avg":
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    default:
      return values.reduce((sum, value) => sum + value, 0);
  }
}

function resolveFieldLabel(fieldOptions: DashboardFieldOption[], fieldId: string | null): string {
  if (!fieldId) return "";
  return fieldOptions.find((field) => field.id === fieldId)?.label ?? fieldId;
}

function sortDashboardGroupLabels(labels: Iterable<string>): string[] {
  return Array.from(new Set(labels)).sort((left, right) => {
    const leftNumber = coerceNumber(left);
    const rightNumber = coerceNumber(right);
    if (leftNumber !== null && rightNumber !== null) {
      return leftNumber - rightNumber;
    }
    return left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });
  });
}

export function evaluateDashboardWidget(
  widget: DashboardWidgetDefinition,
  nodes: AppNode[]
): DashboardWidgetResult {
  const source =
    widget.sourceKind === "execution_items"
      ? resolveExecutionRows(nodes, widget.sourceNodeId)
      : resolveDatabaseRows(nodes, widget.sourceNodeId);
  const filteredRows = applyWidgetFilter(source.rows, widget);

  if (widget.widgetType === "matrix") {
    const columnFieldId = widget.groupFieldId ?? source.fieldOptions[0]?.id ?? "";
    const rowFieldId = widget.secondaryGroupFieldId ?? source.fieldOptions[1]?.id ?? source.fieldOptions[0]?.id ?? "";
    const rowLabels = new Set<string>();
    const columnLabels = new Set<string>();
    const groups = new Map<string, { rows: DashboardDrilldownRow[]; values: number[] }>();

    for (const row of filteredRows) {
      const rowLabel = row.values[rowFieldId] || "Empty";
      const columnLabel = row.values[columnFieldId] || "Empty";
      const groupKey = `${rowLabel}\u001f${columnLabel}`;
      const current = groups.get(groupKey) ?? { rows: [], values: [] };
      current.rows.push(row);
      current.values.push(
        widget.aggregation === "count" || !widget.measureFieldId
          ? 1
          : coerceNumber(row.values[widget.measureFieldId] ?? "") ?? 0
      );
      groups.set(groupKey, current);
      rowLabels.add(rowLabel);
      columnLabels.add(columnLabel);
    }

    const sortedColumnLabels = sortDashboardGroupLabels(columnLabels);
    const sortedRowLabels = sortDashboardGroupLabels(rowLabels);
    return {
      kind: "matrix",
      title: widget.title,
      rowFieldLabel: resolveFieldLabel(source.fieldOptions, rowFieldId) || "Rows",
      columnFieldLabel: resolveFieldLabel(source.fieldOptions, columnFieldId) || "Columns",
      columns: sortedColumnLabels,
      rows: sortedRowLabels.map((rowLabel) => ({
        label: rowLabel,
        cells: sortedColumnLabels.map((columnLabel) => {
          const group = groups.get(`${rowLabel}\u001f${columnLabel}`) ?? { rows: [], values: [] };
          const value =
            widget.aggregation === "count" || !widget.measureFieldId
              ? group.rows.length
              : aggregateNumericValues(group.values, widget.aggregation);
          return {
            key: `${rowLabel}\u001f${columnLabel}`,
            label: columnLabel,
            value,
            displayValue: formatMetricValue(value),
            rows: group.rows
          };
        })
      })),
      rowCount: filteredRows.length,
      fieldOptions: source.fieldOptions,
      sourceKind: widget.sourceKind,
      sourceNodeId: widget.sourceNodeId
    };
  }

  if (widget.widgetType === "table") {
    const defaultFields = source.fieldOptions.slice(0, 3).map((field) => field.id);
    const displayFieldIds = widget.displayFieldIds.length > 0 ? widget.displayFieldIds : defaultFields;
    const columns = displayFieldIds.map((fieldId) => resolveFieldLabel(source.fieldOptions, fieldId));
    return {
      kind: "table",
      title: widget.title,
      columns,
      rows: filteredRows.slice(0, widget.limit).map((row) => ({
        id: row.id,
        cells: displayFieldIds.map((fieldId) => row.values[fieldId] ?? ""),
        values: row.values
      })),
      rowCount: filteredRows.length,
      fieldOptions: source.fieldOptions,
      sourceKind: widget.sourceKind,
      sourceNodeId: widget.sourceNodeId
    };
  }

  if (widget.widgetType === "distribution") {
    const groupFieldId = widget.groupFieldId ?? source.fieldOptions[0]?.id ?? "";
    const groups = new Map<string, { rows: DashboardDrilldownRow[]; values: number[] }>();
    for (const row of filteredRows) {
      const label = row.values[groupFieldId] || "Empty";
      const current = groups.get(label) ?? { rows: [], values: [] };
      if (widget.aggregation === "count" || !widget.measureFieldId) {
        current.values.push(1);
      } else {
        current.values.push(coerceNumber(row.values[widget.measureFieldId]) ?? 0);
      }
      current.rows.push(row);
      groups.set(label, current);
    }
    return {
      kind: "distribution",
      title: widget.title,
      items: Array.from(groups.entries())
        .map(([label, group]) => ({
          label,
          value:
            widget.aggregation === "count"
              ? group.values.length
              : aggregateNumericValues(group.values, widget.aggregation),
          rows: group.rows
        }))
        .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label))
        .slice(0, widget.limit),
      rowCount: filteredRows.length,
      fieldOptions: source.fieldOptions,
      sourceKind: widget.sourceKind,
      sourceNodeId: widget.sourceNodeId
    };
  }

  const metricValue = aggregateMetric(filteredRows, widget);
  const subtitle =
    widget.aggregation === "count"
      ? `${filteredRows.length} row${filteredRows.length === 1 ? "" : "s"}`
      : `${widget.aggregation.toUpperCase()} of ${resolveFieldLabel(source.fieldOptions, widget.measureFieldId)}`;
  return {
    kind: "metric",
    title: widget.title,
    value: formatMetricValue(metricValue),
    subtitle,
    rowCount: filteredRows.length,
    fieldOptions: source.fieldOptions,
    rows: filteredRows,
    sourceKind: widget.sourceKind,
    sourceNodeId: widget.sourceNodeId
  };
}
