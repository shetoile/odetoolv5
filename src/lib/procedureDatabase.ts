import { normalizeIsoDateOnlyInput } from "@/features/timeline/date";
import { ROOT_PARENT_ID, isFileLikeNode, type AppNode, type ScheduleStatus } from "@/lib/types";

export const PROCEDURE_RECORDS_PROPERTY_KEY = "odeProcedureRecords";
export const PROCEDURE_NODE_LINK_PREFIX = "ode://node/";
export const PROCEDURE_RECORD_LINK_PREFIX = "ode://record/";

export type ProcedureFieldType =
  | "short_text"
  | "long_text"
  | "rich_text"
  | "message"
  | "number"
  | "year"
  | "month"
  | "day"
  | "decimal"
  | "percentage"
  | "currency"
  | "date"
  | "time"
  | "datetime"
  | "duration"
  | "priority"
  | "single_select"
  | "multi_select"
  | "tags"
  | "yes_no"
  | "email"
  | "phone"
  | "url"
  | "user_ref"
  | "user_list"
  | "identifier"
  | "attachment"
  | "table"
  | "node_link"
  | "organization_link"
  | "relation"
  | "relation_list"
  | "formula";

export type ProcedureRecordValue = string | string[] | Record<string, string>;

export type ProcedureRecord = {
  id: string;
  createdAt: number;
  updatedAt: number;
  values: Record<string, ProcedureRecordValue>;
};

export type ProcedureAutomationRole =
  | "none"
  | "execution_owner_node"
  | "execution_deliverable"
  | "execution_task"
  | "execution_subtask"
  | "execution_status"
  | "execution_due_date"
  | "execution_note";

export type ProcedureFieldAutoValue = "none" | "current_user" | "today" | "now";

export type ProcedurePriorityOption = {
  value: string;
  icon: string;
  color: string;
  rank: number;
  score: number;
  tooltip: string;
  reviewDays: number | null;
  escalate: boolean;
};

export type ProcedureFieldDefinition = {
  nodeId: string;
  label: string;
  type: ProcedureFieldType;
  placeholder: string;
  required: boolean;
  options: string[];
  showInMasterList: boolean;
  visibilitySourceFieldId: string | null;
  visibilityEqualsValue: string;
  organizationRootNodeId: string | null;
  relationTargetNodeId: string | null;
  relationDisplayFieldIds: string[];
  formulaExpression: string;
  priorityOptions: ProcedurePriorityOption[];
  priorityDefaultValue: string;
  priorityTooltip: string;
  automationRole: ProcedureAutomationRole;
  autoValue: ProcedureFieldAutoValue;
};

export type ProcedureTableDefinition = {
  node: AppNode;
  fields: ProcedureFieldDefinition[];
  fieldsById: Map<string, ProcedureFieldDefinition>;
  fieldsByLabel: Map<string, ProcedureFieldDefinition>;
  records: ProcedureRecord[];
};

export type ProcedureDatabaseModel = {
  nodes: AppNode[];
  nodeById: Map<string, AppNode>;
  byParent: Map<string, AppNode[]>;
  tables: ProcedureTableDefinition[];
  tablesById: Map<string, ProcedureTableDefinition>;
};

export type ProcedureFormulaUpdate = {
  tableNodeId: string;
  records: ProcedureRecord[];
};

export type ProcedureExecutionAutomationItem = {
  sourceTableNodeId: string;
  sourceRecordId: string;
  ownerNodeId: string;
  deliverableTitle: string;
  taskTitle: string;
  subtaskTitle: string | null;
  status: ScheduleStatus;
  dueDate: string | null;
  note: string | null;
};

export type ProcedureExecutionAutomationPlan = {
  ownerNodeId: string;
  items: ProcedureExecutionAutomationItem[];
};

type ProcedureRuntimeModel = {
  base: ProcedureDatabaseModel;
  mutableTablesById: Map<string, ProcedureTableDefinition>;
};

function readStringProperty(properties: Record<string, unknown> | undefined, key: string): string {
  const value = properties?.[key];
  return typeof value === "string" ? value : "";
}

function readNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBooleanProperty(properties: Record<string, unknown> | undefined, key: string): boolean {
  return properties?.[key] === true;
}

function readStringArrayProperty(properties: Record<string, unknown> | undefined, key: string): string[] {
  const value = properties?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeOptionLines(value: string, fallback: string[]): string[] {
  const cleaned = value
    .split(/\r?\n/g)
    .map((item) => item.trim())
    .filter(Boolean);
  return cleaned.length > 0 ? cleaned : fallback;
}

const DEFAULT_PRIORITY_COLOR_BY_INDEX = ["#5dc2ff", "#66d4a3", "#ffcb5c", "#ff7f6e"];
const DEFAULT_PROCEDURE_PRIORITY_VALUES = ["Low", "Medium", "High", "Critical"];

export function buildDefaultProcedurePriorityOptions(labels?: string[]): ProcedurePriorityOption[] {
  const values = labels && labels.length > 0 ? labels : DEFAULT_PROCEDURE_PRIORITY_VALUES;
  return values.map((value, index) => ({
    value,
    icon: "",
    color: DEFAULT_PRIORITY_COLOR_BY_INDEX[Math.min(index, DEFAULT_PRIORITY_COLOR_BY_INDEX.length - 1)] ?? "#5dc2ff",
    rank: index + 1,
    score: index + 1,
    tooltip: "",
    reviewDays: null,
    escalate: index >= values.length - 1
  }));
}

function normalizeProcedurePriorityOptions(value: unknown, fallbackLabels: string[]): ProcedurePriorityOption[] {
  if (!Array.isArray(value)) {
    return buildDefaultProcedurePriorityOptions(fallbackLabels);
  }

  const parsed = value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const candidateValue = typeof record.value === "string" ? record.value.trim() : "";
      if (!candidateValue) return null;
      return {
        value: candidateValue,
        icon: typeof record.icon === "string" ? record.icon.trim() : "",
        color:
          typeof record.color === "string" && record.color.trim().length > 0
            ? record.color.trim()
            : DEFAULT_PRIORITY_COLOR_BY_INDEX[Math.min(index, DEFAULT_PRIORITY_COLOR_BY_INDEX.length - 1)] ?? "#5dc2ff",
        rank: readNullableNumber(record.rank) ?? index + 1,
        score: readNullableNumber(record.score) ?? index + 1,
        tooltip: typeof record.tooltip === "string" ? record.tooltip.trim() : "",
        reviewDays: readNullableNumber(record.reviewDays),
        escalate: record.escalate === true
      } satisfies ProcedurePriorityOption;
    })
    .filter((item): item is ProcedurePriorityOption => item !== null)
    .sort((left, right) => left.rank - right.rank || left.value.localeCompare(right.value));

  return parsed.length > 0 ? parsed : buildDefaultProcedurePriorityOptions(fallbackLabels);
}

export function encodeProcedureNodeToken(nodeId: string): string {
  return `${PROCEDURE_NODE_LINK_PREFIX}${encodeURIComponent(nodeId)}`;
}

export function decodeProcedureNodeToken(value: string): string | null {
  if (!value.startsWith(PROCEDURE_NODE_LINK_PREFIX)) return null;
  const encoded = value.slice(PROCEDURE_NODE_LINK_PREFIX.length).trim();
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

export function encodeProcedureRecordToken(tableNodeId: string, recordId: string): string {
  return `${PROCEDURE_RECORD_LINK_PREFIX}${encodeURIComponent(tableNodeId)}/${encodeURIComponent(recordId)}`;
}

export function decodeProcedureRecordToken(
  value: string
): { tableNodeId: string; recordId: string } | null {
  if (!value.startsWith(PROCEDURE_RECORD_LINK_PREFIX)) return null;
  const raw = value.slice(PROCEDURE_RECORD_LINK_PREFIX.length).trim();
  if (!raw) return null;
  const slashIndex = raw.indexOf("/");
  if (slashIndex < 0) return null;
  const left = raw.slice(0, slashIndex);
  const right = raw.slice(slashIndex + 1);
  if (!left || !right) return null;
  try {
    return {
      tableNodeId: decodeURIComponent(left),
      recordId: decodeURIComponent(right)
    };
  } catch {
    return {
      tableNodeId: left,
      recordId: right
    };
  }
}

export function normalizeProcedureFieldType(value: unknown): ProcedureFieldType {
  switch (value) {
    case "message":
    case "long_text":
    case "rich_text":
    case "number":
    case "year":
    case "month":
    case "day":
    case "decimal":
    case "percentage":
    case "currency":
    case "date":
    case "time":
    case "datetime":
    case "duration":
    case "priority":
    case "single_select":
    case "multi_select":
    case "tags":
    case "yes_no":
    case "email":
    case "phone":
    case "url":
    case "user_ref":
    case "user_list":
    case "identifier":
    case "attachment":
    case "table":
    case "node_link":
    case "organization_link":
    case "relation":
    case "relation_list":
    case "formula":
      return value;
    case "text":
      return "long_text";
    default:
      return "short_text";
  }
}

export function normalizeProcedureFieldAutoValue(value: unknown): ProcedureFieldAutoValue {
  switch (value) {
    case "current_user":
    case "today":
    case "now":
      return value;
    default:
      return "none";
  }
}

function normalizeProcedureFieldInferenceKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function inferProcedureFieldTypeFromLabel(label: string): ProcedureFieldType {
  const normalized = normalizeProcedureFieldInferenceKey(label);
  if (!normalized) return "short_text";

  if (
    /\b(priority|priorite|severity|criticality|risk level|impact level|likelihood level|likelihood|impact|residual score|residual severity|control effectiveness|appetite)\b/.test(
      normalized
    )
  ) {
    return "priority";
  }
  if (
    /\b(created at|logged at|reported at|submitted at|posted at|updated at|scheduled at|started at|ended at|timestamp|time stamp|date time|datetime)\b/.test(
      normalized
    )
  ) {
    return "datetime";
  }
  if (
    /\b(created on|logged on|reported on|submitted on|entry date|review date|meeting date|scheduled on|start date|end date)\b/.test(
      normalized
    )
  ) {
    return "date";
  }
  if (/\b(start time|end time|meeting time|scheduled time)\b/.test(normalized)) return "time";
  if (
    /\b(meeting url|meeting link|join url|join link|website|web site|webpage|web page|url|uri|link)\b/.test(
      normalized
    )
  ) {
    return "url";
  }
  if (/\b(email|e mail|mail|courriel|recipient|recipients|to|cc|bcc|email to|email cc|email bcc)\b/.test(normalized)) {
    return "email";
  }
  if (/\b(phone|telephone|tel|mobile|cell|gsm|whatsapp)\b/.test(normalized)) return "phone";
  if (
    /\b(attendee|attendees|participant|participants|member|members|reviewer|reviewers|approver|approvers|assignee|assignees|users|team members|owners)\b/.test(
      normalized
    )
  ) {
    return "user_list";
  }
  if (
    /\b(author|created by|reported by|submitted by|requested by|prepared by|assignee|owner|reviewer|approver|host)\b/.test(
      normalized
    )
  ) {
    return "user_ref";
  }
  if (/\b(date|deadline|due|birthday|birth|hire|join|start|end|echeance)\b/.test(normalized)) {
    return "date";
  }
  if (/\b(time|heure)\b/.test(normalized)) return "time";
  if (/\b(duration|duree)\b/.test(normalized)) return "duration";
  if (/\b(percent|percentage|pourcentage|ratio|rate|taux)\b/.test(normalized)) return "percentage";
  if (/\b(budget|cost|price|salary|amount|montant|cout|tarif)\b/.test(normalized)) return "currency";
  if (/\b(number|count|qty|quantity|age|nombre)\b/.test(normalized)) return "number";
  if (/\b(status|state|statut|category|classification|domain|type)\b/.test(normalized)) return "single_select";
  if (/\b(tag|tags|label|labels|keyword|keywords)\b/.test(normalized)) return "tags";
  if (/\b(active|enabled|approved|verified|archived|confirmed|present)\b/.test(normalized)) return "yes_no";
  if (/\b(id|identifier|identifiant|matricule|reference|numero)\b/.test(normalized)) return "identifier";
  if (/\b(message|messages|post|posts|chat|thread|body|contenu)\b/.test(normalized)) return "message";
  if (
    /\b(note|notes|comment|commentaire|description|details|detail|summary|resume|observation|action items|actions|next steps)\b/.test(
      normalized
    )
  ) {
    return "long_text";
  }
  if (/\b(file|files|attachment|attachments|piece jointe)\b/.test(normalized)) return "attachment";
  return "short_text";
}

export function inferProcedureFieldAutoValueFromLabel(
  label: string,
  type?: ProcedureFieldType | null
): ProcedureFieldAutoValue {
  const normalized = normalizeProcedureFieldInferenceKey(label);
  const resolvedType = type ?? inferProcedureFieldTypeFromLabel(label);
  if (!normalized) return "none";

  if (
    resolvedType === "user_ref" &&
    /\b(author|created by|reported by|submitted by|requested by|prepared by|posted by)\b/.test(normalized)
  ) {
    return "current_user";
  }
  if (
    (resolvedType === "date" || resolvedType === "datetime" || resolvedType === "time") &&
    /\b(created at|logged at|reported at|submitted at|posted at|updated at|timestamp|time stamp)\b/.test(normalized)
  ) {
    return "now";
  }
  if (resolvedType === "date" && /\b(entry date|log date|created on|reported on|submitted on|today)\b/.test(normalized)) {
    return "today";
  }
  return "none";
}

export function inferProcedureAutomationRoleFromLabel(
  label: string,
  type?: ProcedureFieldType | null
): ProcedureAutomationRole {
  const normalized = normalizeProcedureFieldInferenceKey(label);
  const resolvedType = type ?? inferProcedureFieldTypeFromLabel(label);
  if (!normalized) return "none";

  if (
    (resolvedType === "user_ref" ||
      resolvedType === "node_link" ||
      resolvedType === "relation" ||
      resolvedType === "organization_link") &&
    /\b(owner|responsible|assignee|assigned owner|owner node)\b/.test(normalized)
  ) {
    return "execution_owner_node";
  }
  if (/\b(deliverable|output|work package|milestone)\b/.test(normalized)) {
    return "execution_deliverable";
  }
  if (/\b(task|action item|follow up|follow-up|todo|to do)\b/.test(normalized)) {
    return "execution_task";
  }
  if (/\b(subtask|sub task|sub action)\b/.test(normalized)) {
    return "execution_subtask";
  }
  if (/\b(action status|task status|execution status|delivery status|work status)\b/.test(normalized)) {
    return "execution_status";
  }
  if (/\b(due date|deadline|target date|next review|review date)\b/.test(normalized)) {
    return "execution_due_date";
  }
  if (/\b(note|notes|comment|comments|details|follow up note|follow-up note)\b/.test(normalized)) {
    return "execution_note";
  }
  return "none";
}

function normalizeAutomationRole(value: unknown): ProcedureAutomationRole {
  switch (value) {
    case "execution_owner_node":
    case "execution_deliverable":
    case "execution_task":
    case "execution_subtask":
    case "execution_status":
    case "execution_due_date":
    case "execution_note":
      return value;
    default:
      return "none";
  }
}

export function isProcedureFieldNode(node: AppNode | null | undefined): boolean {
  if (!node) return false;
  if (node.properties?.odeProcedureItemType === "field") return true;
  const fieldType = node.properties?.odeProcedureFieldType;
  return typeof fieldType === "string" && fieldType.trim().length > 0;
}

export function isProcedureRelationFieldType(type: ProcedureFieldType): boolean {
  return type === "relation" || type === "relation_list";
}

export function isProcedureFormulaFieldType(type: ProcedureFieldType): boolean {
  return type === "formula";
}

export function isProcedureNodeLinkFieldType(type: ProcedureFieldType): boolean {
  return type === "node_link";
}

export function isProcedureOrganizationLinkFieldType(type: ProcedureFieldType): boolean {
  return type === "organization_link";
}

export function isProcedureUserFieldType(type: ProcedureFieldType): boolean {
  return type === "user_ref" || type === "user_list";
}

export function buildProcedureFieldDefinition(node: AppNode): ProcedureFieldDefinition {
  const type = normalizeProcedureFieldType(node.properties?.odeProcedureFieldType);
  const autoValue =
    node.properties?.odeProcedureAutoValue === undefined
      ? inferProcedureFieldAutoValueFromLabel(node.name, type)
      : normalizeProcedureFieldAutoValue(node.properties?.odeProcedureAutoValue);
  const legacyRelationDisplayFieldId =
    typeof node.properties?.odeProcedureRelationDisplayFieldId === "string" &&
    node.properties.odeProcedureRelationDisplayFieldId.trim().length > 0
      ? node.properties.odeProcedureRelationDisplayFieldId.trim()
      : null;
  const relationDisplayFieldIds = readStringArrayProperty(node.properties, "odeProcedureRelationDisplayFieldIds");
  const priorityOptions =
    type === "priority"
      ? normalizeProcedurePriorityOptions(
          node.properties?.odeProcedurePriorityOptions,
          readStringArrayProperty(node.properties, "odeProcedureOptions")
        )
      : [];
  return {
    nodeId: node.id,
    label: node.name,
    type,
    placeholder: readStringProperty(node.properties, "odeProcedurePlaceholder"),
    required: readBooleanProperty(node.properties, "odeProcedureRequired"),
    options:
      type === "single_select" || type === "multi_select" || type === "table" || type === "tags" || type === "priority"
        ? normalizeOptionLines(
            readStringArrayProperty(node.properties, "odeProcedureOptions").join("\n"),
            type === "table"
              ? ["Column 1", "Column 2"]
              : type === "tags"
                ? []
                : type === "priority"
                  ? priorityOptions.map((option) => option.value)
                  : ["Option 1", "Option 2"]
          )
        : [],
    showInMasterList: node.properties?.odeProcedureShowInMasterList === false ? false : true,
    visibilitySourceFieldId:
      typeof node.properties?.odeProcedureVisibilitySourceFieldId === "string" &&
      node.properties.odeProcedureVisibilitySourceFieldId.trim().length > 0
        ? node.properties.odeProcedureVisibilitySourceFieldId.trim()
        : null,
    visibilityEqualsValue: readStringProperty(node.properties, "odeProcedureVisibilityEqualsValue"),
    organizationRootNodeId:
      typeof node.properties?.odeProcedureOrganizationRootNodeId === "string" &&
      node.properties.odeProcedureOrganizationRootNodeId.trim().length > 0
        ? node.properties.odeProcedureOrganizationRootNodeId.trim()
        : null,
    relationTargetNodeId:
      typeof node.properties?.odeProcedureRelationTargetNodeId === "string" &&
      node.properties.odeProcedureRelationTargetNodeId.trim().length > 0
        ? node.properties.odeProcedureRelationTargetNodeId.trim()
        : null,
    relationDisplayFieldIds:
      relationDisplayFieldIds.length > 0
        ? relationDisplayFieldIds
        : legacyRelationDisplayFieldId
          ? [legacyRelationDisplayFieldId]
          : [],
    formulaExpression: readStringProperty(node.properties, "odeProcedureFormulaExpression"),
    priorityOptions,
    priorityDefaultValue:
      type === "priority" ? readStringProperty(node.properties, "odeProcedurePriorityDefaultValue") : "",
    priorityTooltip: type === "priority" ? readStringProperty(node.properties, "odeProcedurePriorityTooltip") : "",
    automationRole: normalizeAutomationRole(node.properties?.odeProcedureAutomationRole),
    autoValue
  };
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((entry) => typeof entry === "string");
}

export function normalizeProcedureRecordValue(value: unknown): ProcedureRecordValue | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) return value;
  if (isStringRecord(value)) return value;
  return null;
}

export function readProcedureRecords(node: AppNode | null): ProcedureRecord[] {
  const rawValue = node?.properties?.[PROCEDURE_RECORDS_PROPERTY_KEY];
  if (!Array.isArray(rawValue)) return [];
  return rawValue.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<ProcedureRecord>;
    if (typeof candidate.id !== "string") return [];
    if (typeof candidate.createdAt !== "number" || typeof candidate.updatedAt !== "number") return [];
    const values: Record<string, ProcedureRecordValue> = {};
    if (candidate.values && typeof candidate.values === "object" && !Array.isArray(candidate.values)) {
      for (const [key, value] of Object.entries(candidate.values)) {
        const normalizedValue = normalizeProcedureRecordValue(value);
        if (normalizedValue !== null) {
          values[key] = normalizedValue;
        }
      }
    }
    return [
      {
        id: candidate.id,
        createdAt: candidate.createdAt,
        updatedAt: candidate.updatedAt,
        values
      }
    ];
  });
}

export function buildProcedureDatabaseModel(nodes: AppNode[]): ProcedureDatabaseModel {
  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
  const byParent = new Map<string, AppNode[]>();
  for (const node of nodes) {
    const list = byParent.get(node.parentId) ?? [];
    list.push(node);
    byParent.set(node.parentId, list);
  }

  const tables: ProcedureTableDefinition[] = [];
  for (const node of nodes) {
    if (isFileLikeNode(node) || isProcedureFieldNode(node)) continue;
    const fields = (byParent.get(node.id) ?? []).filter(isProcedureFieldNode).map(buildProcedureFieldDefinition);
    if (fields.length === 0) continue;
    const fieldsById = new Map(fields.map((field) => [field.nodeId, field] as const));
    const fieldsByLabel = new Map(fields.map((field) => [field.label.trim().toLowerCase(), field] as const));
    tables.push({
      node,
      fields,
      fieldsById,
      fieldsByLabel,
      records: readProcedureRecords(node)
    });
  }

  return {
    nodes,
    nodeById,
    byParent,
    tables,
    tablesById: new Map(tables.map((table) => [table.node.id, table] as const))
  };
}

function cloneProcedureRecord(record: ProcedureRecord): ProcedureRecord {
  return {
    ...record,
    values: Object.fromEntries(
      Object.entries(record.values).map(([key, value]) => {
        if (typeof value === "string") return [key, value] as const;
        if (Array.isArray(value)) return [key, [...value]] as const;
        return [key, { ...value }] as const;
      })
    )
  };
}

function cloneProcedureTable(table: ProcedureTableDefinition, records: ProcedureRecord[]): ProcedureTableDefinition {
  return {
    ...table,
    records,
    fields: table.fields,
    fieldsById: table.fieldsById,
    fieldsByLabel: table.fieldsByLabel
  };
}

function createRuntimeModel(base: ProcedureDatabaseModel, recordsByTableId: Map<string, ProcedureRecord[]>): ProcedureRuntimeModel {
  const mutableTablesById = new Map<string, ProcedureTableDefinition>();
  for (const table of base.tables) {
    const mutableRecords = recordsByTableId.get(table.node.id) ?? table.records.map(cloneProcedureRecord);
    mutableTablesById.set(table.node.id, cloneProcedureTable(table, mutableRecords));
  }
  return {
    base,
    mutableTablesById
  };
}

function getRuntimeTable(runtime: ProcedureRuntimeModel, tableNodeId: string): ProcedureTableDefinition | null {
  return runtime.mutableTablesById.get(tableNodeId) ?? runtime.base.tablesById.get(tableNodeId) ?? null;
}

function resolveFieldByReference(table: ProcedureTableDefinition | null, ref: string): ProcedureFieldDefinition | null {
  if (!table) return null;
  const trimmed = ref.trim();
  if (!trimmed) return null;
  return table.fieldsById.get(trimmed) ?? table.fieldsByLabel.get(trimmed.toLowerCase()) ?? null;
}

function resolvePrimaryField(table: ProcedureTableDefinition | null): ProcedureFieldDefinition | null {
  if (!table) return null;
  return table.fields.find((field) => !isProcedureFormulaFieldType(field.type)) ?? table.fields[0] ?? null;
}

function resolveRelationDisplayFields(
  table: ProcedureTableDefinition | null,
  field: ProcedureFieldDefinition | null
): ProcedureFieldDefinition[] {
  if (!table) return [];
  const selectedFields: ProcedureFieldDefinition[] = [];
  const seenNodeIds = new Set<string>();
  for (const reference of field?.relationDisplayFieldIds ?? []) {
    const resolved = resolveFieldByReference(table, reference);
    if (!resolved || seenNodeIds.has(resolved.nodeId)) continue;
    seenNodeIds.add(resolved.nodeId);
    selectedFields.push(resolved);
  }
  if (selectedFields.length > 0) return selectedFields;
  const fallback = resolvePrimaryField(table);
  return fallback ? [fallback] : [];
}

function findRuntimeRecord(
  runtime: ProcedureRuntimeModel,
  tableNodeId: string,
  recordId: string
): ProcedureRecord | null {
  const table = getRuntimeTable(runtime, tableNodeId);
  if (!table) return null;
  return table.records.find((record) => record.id === recordId) ?? null;
}

function normalizeValueToArray(value: ProcedureRecordValue | undefined): string[] {
  if (typeof value === "string") return value.trim().length > 0 ? [value] : [];
  if (Array.isArray(value)) return value.filter((item) => item.trim().length > 0);
  return Object.values(value ?? {}).filter((item) => item.trim().length > 0);
}

function isRecordValueEmpty(value: ProcedureRecordValue | undefined): boolean {
  if (value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return Object.values(value).every((item) => item.trim().length === 0);
}

function compareRecordValues(left: ProcedureRecordValue | undefined, right: ProcedureRecordValue | undefined): boolean {
  if (left === right) return true;
  if (typeof left === "string" || typeof right === "string") {
    return typeof left === "string" && typeof right === "string" && left === right;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => item === right[index])
    );
  }
  if (!left || !right) return !left && !right;
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);
  if (leftEntries.length !== rightEntries.length) return false;
  return leftEntries.every(([key, value]) => right[key] === value);
}

function normalizeStatus(value: string | null | undefined): ScheduleStatus {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "active" || normalized === "blocked" || normalized === "done") return normalized;
  return "planned";
}

function rawValueToDisplayText(
  value: ProcedureRecordValue | undefined,
  field: ProcedureFieldDefinition | null,
  runtime: ProcedureRuntimeModel
): string {
  if (!value || isRecordValueEmpty(value)) return "";
  if (typeof value === "string") {
    const nodeId = decodeProcedureNodeToken(value);
    if (nodeId) {
      return runtime.base.nodeById.get(nodeId)?.name ?? nodeId;
    }
    const recordRef = decodeProcedureRecordToken(value);
    if (recordRef) {
      const targetTable = getRuntimeTable(runtime, recordRef.tableNodeId);
      const targetRecord = findRuntimeRecord(runtime, recordRef.tableNodeId, recordRef.recordId);
      if (!targetRecord) return recordRef.recordId;
      const displayFields = resolveRelationDisplayFields(targetTable, field);
      const displayParts = displayFields
        .map((displayField) =>
          rawValueToDisplayText(targetRecord.values[displayField.nodeId], displayField, runtime)
        )
        .filter((part) => part.trim().length > 0);
      return displayParts.length > 0 ? displayParts.join(" | ") : targetRecord.id;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => rawValueToDisplayText(item, field, runtime))
      .filter((item) => item.trim().length > 0)
      .join(", ");
  }
  return Object.entries(value)
    .filter(([, item]) => item.trim().length > 0)
    .map(([key, item]) => `${key}: ${item}`)
    .join(" | ");
}

export function formatProcedureRecordValue(
  value: ProcedureRecordValue | undefined,
  field: ProcedureFieldDefinition | null,
  model: ProcedureDatabaseModel
): string {
  const recordsByTableId = new Map(
    model.tables.map((table) => [table.node.id, table.records.map((record) => cloneProcedureRecord(record))] as const)
  );
  const runtime = createRuntimeModel(model, recordsByTableId);
  return rawValueToDisplayText(value, field, runtime);
}

function normalizeFormulaResult(result: unknown): ProcedureRecordValue {
  if (typeof result === "string") return result;
  if (typeof result === "number" || typeof result === "bigint") return String(result);
  if (typeof result === "boolean") return result ? "true" : "false";
  if (Array.isArray(result)) {
    return result
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item === "number" || typeof item === "bigint") return String(item);
        if (typeof item === "boolean") return item ? "true" : "false";
        return "";
      })
      .filter((item) => item.trim().length > 0);
  }
  if (result && typeof result === "object" && isStringRecord(result)) {
    return result;
  }
  return "";
}

function resolveNodePath(nodeId: string, runtime: ProcedureRuntimeModel): string {
  const path: string[] = [];
  const visited = new Set<string>();
  let current = runtime.base.nodeById.get(nodeId) ?? null;
  while (current) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    path.unshift(current.name);
    if (!current.parentId || current.parentId === ROOT_PARENT_ID) break;
    current = runtime.base.nodeById.get(current.parentId) ?? null;
  }
  return path.join(" / ");
}

function resolveRelatedValues(value: unknown, runtime: ProcedureRuntimeModel): Array<{
  table: ProcedureTableDefinition;
  record: ProcedureRecord;
}> {
  const rawValues: string[] =
    typeof value === "string"
      ? [value]
      : Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];

  const resolved: Array<{ table: ProcedureTableDefinition; record: ProcedureRecord }> = [];
  for (const raw of rawValues) {
    const recordRef = decodeProcedureRecordToken(raw);
    if (!recordRef) continue;
    const table = getRuntimeTable(runtime, recordRef.tableNodeId);
    const record = findRuntimeRecord(runtime, recordRef.tableNodeId, recordRef.recordId);
    if (!table || !record) continue;
    resolved.push({ table, record });
  }
  return resolved;
}

function coerceToNumber(value: unknown, runtime: ProcedureRuntimeModel, field: ProcedureFieldDefinition | null): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = typeof value === "string" ? value : rawValueToDisplayText(value as ProcedureRecordValue, field, runtime);
  const normalized = text.replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildFormulaHelpers(
  table: ProcedureTableDefinition,
  record: ProcedureRecord,
  runtime: ProcedureRuntimeModel
): Record<string, unknown> {
  const fieldValue = (ref: string): ProcedureRecordValue => {
    const field = resolveFieldByReference(table, ref);
    if (!field) return "";
    return record.values[field.nodeId] ?? "";
  };

  const helperFieldDefinition = (ref: string): ProcedureFieldDefinition | null => resolveFieldByReference(table, ref);

  const helperText = (value: unknown, ref?: string): string =>
    rawValueToDisplayText(
      normalizeFormulaResult(value),
      ref ? helperFieldDefinition(ref) : null,
      runtime
    );

  const helperLookup = (source: unknown, targetFieldRef: string): ProcedureRecordValue => {
    const relatedValues = resolveRelatedValues(source, runtime);
    const first = relatedValues[0];
    if (!first) return "";
    const targetField = resolveFieldByReference(first.table, targetFieldRef);
    if (!targetField) return "";
    return first.record.values[targetField.nodeId] ?? "";
  };

  const helperRollup = (
    source: unknown,
    targetFieldRef: string,
    operation: string = "count",
    separator = ", "
  ): ProcedureRecordValue => {
    const relatedValues = resolveRelatedValues(source, runtime);
    if (operation === "count") return String(relatedValues.length);
    const extracted = relatedValues
      .map(({ table: relatedTable, record: relatedRecord }) => {
        const targetField = resolveFieldByReference(relatedTable, targetFieldRef);
        if (!targetField) return "";
        return relatedRecord.values[targetField.nodeId] ?? "";
      })
      .filter((value) => !isRecordValueEmpty(value));

    if (operation === "join") {
      return extracted.map((value) => helperText(value)).filter(Boolean).join(separator);
    }
    if (operation === "unique_join") {
      return Array.from(new Set(extracted.map((value) => helperText(value)).filter(Boolean))).join(separator);
    }

    const numbers = extracted.map((value) => coerceToNumber(value, runtime, null));
    if (numbers.length === 0) return "";
    if (operation === "sum") return String(numbers.reduce((sum, item) => sum + item, 0));
    if (operation === "avg") return String(numbers.reduce((sum, item) => sum + item, 0) / numbers.length);
    if (operation === "min") return String(Math.min(...numbers));
    if (operation === "max") return String(Math.max(...numbers));
    return String(extracted.length);
  };

  return {
    field: fieldValue,
    value: fieldValue,
    text: helperText,
    number: (value: unknown) => coerceToNumber(value, runtime, null),
    empty: (value: unknown) => {
      const normalized = normalizeFormulaResult(value);
      return isRecordValueEmpty(normalized);
    },
    count: (value: unknown) => {
      const normalized = normalizeFormulaResult(value);
      if (typeof normalized === "string") return normalized.trim().length > 0 ? 1 : 0;
      if (Array.isArray(normalized)) return normalized.length;
      return Object.values(normalized).filter((item) => item.trim().length > 0).length;
    },
    concat: (...values: unknown[]) =>
      values
        .map((item) => helperText(item))
        .filter((item) => item.trim().length > 0)
        .join(""),
    join: (value: unknown, separator = ", ") => {
      const normalized = normalizeFormulaResult(value);
      return Array.isArray(normalized)
        ? normalized.map((item) => helperText(item)).filter(Boolean).join(separator)
        : helperText(normalized);
    },
    coalesce: (...values: unknown[]) => {
      for (const candidate of values) {
        const normalized = normalizeFormulaResult(candidate);
        if (!isRecordValueEmpty(normalized)) return normalized;
      }
      return "";
    },
    iif: (condition: unknown, whenTrue: unknown, whenFalse: unknown) => (condition ? whenTrue : whenFalse),
    lookup: helperLookup,
    rollup: helperRollup,
    nodeName: (value: unknown) => {
      const normalized = normalizeFormulaResult(value);
      const first = normalizeValueToArray(normalized)[0] ?? "";
      const nodeId = decodeProcedureNodeToken(first);
      if (!nodeId) return helperText(normalized);
      return runtime.base.nodeById.get(nodeId)?.name ?? nodeId;
    },
    nodePath: (value: unknown) => {
      const normalized = normalizeFormulaResult(value);
      const first = normalizeValueToArray(normalized)[0] ?? "";
      const nodeId = decodeProcedureNodeToken(first);
      if (!nodeId) return helperText(normalized);
      return resolveNodePath(nodeId, runtime);
    },
    recordId: () => record.id,
    tableName: () => table.node.name,
    today: () => new Date().toISOString().slice(0, 10)
  };
}

function prepareFormulaExpression(expression: string): string {
  return expression.replace(/\{([^}]+)\}/g, (_, ref) => `field(${JSON.stringify(String(ref).trim())})`);
}

function evaluateFormulaExpression(
  expression: string,
  table: ProcedureTableDefinition,
  record: ProcedureRecord,
  runtime: ProcedureRuntimeModel
): ProcedureRecordValue {
  const trimmed = expression.trim();
  if (!trimmed) return "";
  const prepared = prepareFormulaExpression(trimmed);
  const helpers = buildFormulaHelpers(table, record, runtime);
  try {
    const evaluator = new Function(
      "helpers",
      `const { field, value, text, number, empty, count, concat, join, coalesce, iif, lookup, rollup, nodeName, nodePath, recordId, tableName, today } = helpers; return (${prepared});`
    ) as (helpers: Record<string, unknown>) => unknown;
    return normalizeFormulaResult(evaluator(helpers));
  } catch {
    return "";
  }
}

export function computeProcedureFormulaUpdates(nodes: AppNode[]): ProcedureFormulaUpdate[] {
  const baseModel = buildProcedureDatabaseModel(nodes);
  const recordsByTableId = new Map(
    baseModel.tables.map((table) => [table.node.id, table.records.map(cloneProcedureRecord)] as const)
  );

  for (let pass = 0; pass < 6; pass += 1) {
    const runtime = createRuntimeModel(baseModel, recordsByTableId);
    let changed = false;

    for (const table of baseModel.tables) {
      const mutableTable = getRuntimeTable(runtime, table.node.id);
      if (!mutableTable) continue;
      const formulaFields = mutableTable.fields.filter(
        (field) => isProcedureFormulaFieldType(field.type) && field.formulaExpression.trim().length > 0
      );
      if (formulaFields.length === 0) continue;

      for (const record of mutableTable.records) {
        for (const field of formulaFields) {
          const nextValue = evaluateFormulaExpression(field.formulaExpression, mutableTable, record, runtime);
          const currentValue = record.values[field.nodeId];
          if (!compareRecordValues(currentValue, nextValue)) {
            record.values[field.nodeId] = nextValue;
            record.updatedAt = Date.now();
            changed = true;
          }
        }
      }
    }

    if (!changed) break;
  }

  return baseModel.tables
    .map((table) => {
      const nextRecords = recordsByTableId.get(table.node.id) ?? [];
      const hasChanged =
        nextRecords.length !== table.records.length ||
        nextRecords.some((record, index) => {
          const current = table.records[index];
          if (!current) return true;
          const keys = new Set([...Object.keys(current.values), ...Object.keys(record.values)]);
          for (const key of keys) {
            if (!compareRecordValues(current.values[key], record.values[key])) {
              return true;
            }
          }
          return false;
        });
      return hasChanged
        ? {
            tableNodeId: table.node.id,
            records: nextRecords
          }
        : null;
    })
    .filter((item): item is ProcedureFormulaUpdate => item !== null);
}

export function computeProcedurePreviewRecordValues(params: {
  nodes: AppNode[];
  tableNodeId: string;
  recordId?: string | null;
  values: Record<string, ProcedureRecordValue>;
}): Record<string, ProcedureRecordValue> {
  const baseModel = buildProcedureDatabaseModel(params.nodes);
  const targetTable = baseModel.tablesById.get(params.tableNodeId) ?? null;
  if (!targetTable) {
    return { ...params.values };
  }

  const recordsByTableId = new Map(
    baseModel.tables.map((table) => [table.node.id, table.records.map(cloneProcedureRecord)] as const)
  );
  const targetRecords = recordsByTableId.get(params.tableNodeId) ?? [];
  const targetRecordId = params.recordId?.trim() || "__ode_preview_record__";
  const existingIndex = targetRecords.findIndex((record) => record.id === targetRecordId);
  const existingRecord = existingIndex >= 0 ? targetRecords[existingIndex] : null;

  const previewRecord: ProcedureRecord = {
    id: targetRecordId,
    createdAt: existingRecord?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
    values: {
      ...(existingRecord?.values ?? {}),
      ...params.values
    }
  };

  if (existingIndex >= 0) {
    targetRecords[existingIndex] = previewRecord;
  } else {
    targetRecords.unshift(previewRecord);
  }
  recordsByTableId.set(params.tableNodeId, targetRecords);

  for (let pass = 0; pass < 6; pass += 1) {
    const runtime = createRuntimeModel(baseModel, recordsByTableId);
    let changed = false;

    for (const table of baseModel.tables) {
      const mutableTable = getRuntimeTable(runtime, table.node.id);
      if (!mutableTable) continue;
      const formulaFields = mutableTable.fields.filter(
        (field) => isProcedureFormulaFieldType(field.type) && field.formulaExpression.trim().length > 0
      );
      if (formulaFields.length === 0) continue;

      for (const record of mutableTable.records) {
        for (const field of formulaFields) {
          const nextValue = evaluateFormulaExpression(field.formulaExpression, mutableTable, record, runtime);
          const currentValue = record.values[field.nodeId];
          if (!compareRecordValues(currentValue, nextValue)) {
            record.values[field.nodeId] = nextValue;
            record.updatedAt = Date.now();
            changed = true;
          }
        }
      }
    }

    if (!changed) break;
  }

  return (
    recordsByTableId.get(params.tableNodeId)?.find((record) => record.id === targetRecordId)?.values ?? {
      ...params.values
    }
  );
}

export function buildProcedureExecutionAutomationPlans(nodes: AppNode[]): ProcedureExecutionAutomationPlan[] {
  const baseModel = buildProcedureDatabaseModel(nodes);
  const recordsByTableId = new Map(
    baseModel.tables.map((table) => [table.node.id, table.records.map(cloneProcedureRecord)] as const)
  );
  const runtime = createRuntimeModel(baseModel, recordsByTableId);

  const plansByOwner = new Map<string, ProcedureExecutionAutomationItem[]>();

  for (const table of baseModel.tables) {
    const ownerField = table.fields.find((field) => field.automationRole === "execution_owner_node") ?? null;
    const taskField = table.fields.find((field) => field.automationRole === "execution_task") ?? null;
    if (!ownerField || !taskField) continue;

    const deliverableField = table.fields.find((field) => field.automationRole === "execution_deliverable") ?? null;
    const subtaskField = table.fields.find((field) => field.automationRole === "execution_subtask") ?? null;
    const statusField = table.fields.find((field) => field.automationRole === "execution_status") ?? null;
    const dueDateField = table.fields.find((field) => field.automationRole === "execution_due_date") ?? null;
    const noteField = table.fields.find((field) => field.automationRole === "execution_note") ?? null;

    const runtimeTable = getRuntimeTable(runtime, table.node.id);
    if (!runtimeTable) continue;

    for (const record of runtimeTable.records) {
      const ownerValue = record.values[ownerField.nodeId];
      const ownerToken = normalizeValueToArray(ownerValue)[0] ?? "";
      const ownerNodeId = decodeProcedureNodeToken(ownerToken);
      const taskTitle = rawValueToDisplayText(record.values[taskField.nodeId], taskField, runtime).trim();
      if (!ownerNodeId || !taskTitle) continue;

      const deliverableTitle = (
        deliverableField
          ? rawValueToDisplayText(record.values[deliverableField.nodeId], deliverableField, runtime)
          : table.node.name
      ).trim();
      const subtaskTitle = subtaskField
        ? rawValueToDisplayText(record.values[subtaskField.nodeId], subtaskField, runtime).trim() || null
        : null;
      const status = normalizeStatus(
        statusField ? rawValueToDisplayText(record.values[statusField.nodeId], statusField, runtime) : "planned"
      );
      const dueDate = normalizeIsoDateOnlyInput(
        dueDateField ? rawValueToDisplayText(record.values[dueDateField.nodeId], dueDateField, runtime) : ""
      );
      const note = noteField
        ? rawValueToDisplayText(record.values[noteField.nodeId], noteField, runtime).trim() || null
        : null;

      const item: ProcedureExecutionAutomationItem = {
        sourceTableNodeId: table.node.id,
        sourceRecordId: record.id,
        ownerNodeId,
        deliverableTitle: deliverableTitle || table.node.name,
        taskTitle,
        subtaskTitle,
        status,
        dueDate: dueDate || null,
        note
      };

      const list = plansByOwner.get(ownerNodeId) ?? [];
      list.push(item);
      plansByOwner.set(ownerNodeId, list);
    }
  }

  return Array.from(plansByOwner.entries()).map(([ownerNodeId, items]) => ({
    ownerNodeId,
    items
  }));
}
