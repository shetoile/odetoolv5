import {
  buildProcedureDatabaseModel,
  formatProcedureRecordValue,
  type ProcedureDatabaseModel,
  type ProcedureFieldDefinition,
  type ProcedureRecord,
  type ProcedureTableDefinition
} from "@/lib/procedureDatabase";
import type { AppNode } from "@/lib/types";

export type ChantierModuleRole = "feed" | "journal" | "meeting" | "messaging" | "snapshot" | "custom";

export type ChantierFieldRole =
  | "author"
  | "message"
  | "body"
  | "title"
  | "tags"
  | "created_at"
  | "updated_at"
  | "summary"
  | "manual_summary"
  | "ai_summary"
  | "meeting_url"
  | "provider"
  | "scheduled_at"
  | "notes"
  | "transcript"
  | "actions"
  | "decisions"
  | "attendees"
  | "to"
  | "cc"
  | "bcc"
  | "subject";

export type ChantierModuleDefinition = {
  role: ChantierModuleRole;
  table: ProcedureTableDefinition;
  fieldRoles: Map<string, ChantierFieldRole | null>;
};

export type ChantierModuleCatalog = {
  model: ProcedureDatabaseModel;
  modules: ChantierModuleDefinition[];
};

const MODULE_ROLE_PROPERTY = "odeChantierModuleRole";
const FIELD_ROLE_PROPERTY = "odeChantierFieldRole";

function normalizeKey(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function collectDescendantIds(rootId: string, byParent: Map<string, AppNode[]>): Set<string> {
  const visited = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const nextId = stack.pop();
    if (!nextId || visited.has(nextId)) continue;
    visited.add(nextId);
    for (const child of byParent.get(nextId) ?? []) {
      stack.push(child.id);
    }
  }
  return visited;
}

export function readChantierModuleRole(node: AppNode | null | undefined): ChantierModuleRole | null {
  const value = node?.properties?.[MODULE_ROLE_PROPERTY];
  return value === "feed" ||
    value === "journal" ||
    value === "meeting" ||
    value === "messaging" ||
    value === "snapshot" ||
    value === "custom"
    ? value
    : null;
}

export function readChantierFieldRole(node: AppNode | null | undefined): ChantierFieldRole | null {
  const value = node?.properties?.[FIELD_ROLE_PROPERTY];
  switch (value) {
    case "author":
    case "message":
    case "body":
    case "title":
    case "tags":
    case "created_at":
    case "updated_at":
    case "summary":
    case "manual_summary":
    case "ai_summary":
    case "meeting_url":
    case "provider":
    case "scheduled_at":
    case "notes":
    case "transcript":
    case "actions":
    case "decisions":
    case "attendees":
    case "to":
    case "cc":
    case "bcc":
    case "subject":
      return value;
    default:
      return null;
  }
}

export function inferChantierFieldRole(field: ProcedureFieldDefinition): ChantierFieldRole | null {
  const normalized = normalizeKey(field.label);
  if (!normalized) return null;

  if (/\b(author|auteur|posted by|postedby|created by|createdby|owner|from|sender|user|posted)\b/.test(normalized)) {
    return "author";
  }
  if (/\b(tags|tag|labels|etiquettes|categories|category|type)\b/.test(normalized)) return "tags";
  if (/\b(subject|titre message|email subject|mail subject)\b/.test(normalized)) return "subject";
  if (/\b(title|titre|headline|entry title|meeting title)\b/.test(normalized)) return "title";
  if (/\b(message|post|update|chat|feed|comment|commentaire)\b/.test(normalized)) return "message";
  if (/\b(body|entry|journal|details|detail|contenu|content|description)\b/.test(normalized)) return "body";
  if (/\b(summary|resume)\b/.test(normalized)) return "summary";
  if (/\bmanual summary|resume manuel\b/.test(normalized)) return "manual_summary";
  if (/\bai summary|resume ia|summary ai\b/.test(normalized)) return "ai_summary";
  if (/\b(meeting url|meeting link|room link|video link|visio|visioconference|conference link|url)\b/.test(normalized)) {
    return "meeting_url";
  }
  if (/\b(provider|platform|plateforme|tool|outil)\b/.test(normalized)) return "provider";
  if (/\b(scheduled|date|time|datetime|start|meeting date|meeting time)\b/.test(normalized)) return "scheduled_at";
  if (/\b(notes|note|memo|memoire)\b/.test(normalized)) return "notes";
  if (/\b(transcript|transcription)\b/.test(normalized)) return "transcript";
  if (/\b(decisions|decision)\b/.test(normalized)) return "decisions";
  if (/\b(actions|action items|follow ups|follow up)\b/.test(normalized)) return "actions";
  if (/\b(attendees|participants|guests|invites)\b/.test(normalized)) return "attendees";
  if (/\b(to|recipient|destinataire)\b/.test(normalized)) return "to";
  if (/\b(cc)\b/.test(normalized)) return "cc";
  if (/\b(bcc)\b/.test(normalized)) return "bcc";
  if (/\b(created|created at|posted at|date created)\b/.test(normalized)) return "created_at";
  if (/\b(updated|updated at|modified)\b/.test(normalized)) return "updated_at";
  return null;
}

function inferRoleFromName(name: string): ChantierModuleRole | null {
  const normalized = normalizeKey(name);
  if (!normalized) return null;
  if (/\b(feed|chat|communication feed|team feed|mur|channel)\b/.test(normalized)) return "feed";
  if (/\b(journal|log|logbook|diary|daily log|memory)\b/.test(normalized)) return "journal";
  if (/\b(meeting|visioconference|visio|video conference|video|conference|call)\b/.test(normalized)) return "meeting";
  if (/\b(messaging|message center|email|mail|courriel)\b/.test(normalized)) return "messaging";
  if (/\b(snapshot|overview|metrics|dashboard|kpi)\b/.test(normalized)) return "snapshot";
  return null;
}

export function inferChantierModuleRole(table: ProcedureTableDefinition): ChantierModuleRole | null {
  const explicit = readChantierModuleRole(table.node);
  if (explicit) return explicit;

  const fromName = inferRoleFromName(table.node.name);
  if (fromName) return fromName;

  const roles = new Set<ChantierFieldRole>();
  for (const field of table.fields) {
    const role = inferChantierFieldRole(field);
    if (role) roles.add(role);
  }

  if (roles.has("meeting_url")) return "meeting";
  if (roles.has("to") || roles.has("subject") || roles.has("cc") || roles.has("bcc")) return "messaging";
  if (roles.has("message") && roles.has("author")) return "feed";
  if (roles.has("body") && roles.has("author")) return "journal";
  if (roles.has("summary") && !roles.has("message") && !roles.has("body")) return "snapshot";
  return "custom";
}

export function buildChantierModuleCatalog(
  nodes: AppNode[],
  chantierRootId: string,
  byParent: Map<string, AppNode[]>
): ChantierModuleCatalog {
  const descendantIds = collectDescendantIds(chantierRootId, byParent);
  const scopedNodes = nodes.filter((node) => descendantIds.has(node.id));
  const model = buildProcedureDatabaseModel(scopedNodes);
  const modules: ChantierModuleDefinition[] = model.tables
    .map((table) => {
      const role = inferChantierModuleRole(table);
      if (!role) return null;
      const fieldRoles = new Map<string, ChantierFieldRole | null>();
      for (const field of table.fields) {
        fieldRoles.set(field.nodeId, readChantierFieldRole(model.nodeById.get(field.nodeId)) ?? inferChantierFieldRole(field));
      }
      return { role, table, fieldRoles } satisfies ChantierModuleDefinition;
    })
    .filter((value): value is ChantierModuleDefinition => Boolean(value))
    .sort((left, right) => {
      const order: ChantierModuleRole[] = ["feed", "journal", "meeting", "messaging", "snapshot", "custom"];
      return order.indexOf(left.role) - order.indexOf(right.role) || left.table.node.name.localeCompare(right.table.node.name);
    });

  return { model, modules };
}

export function getModuleField(
  module: ChantierModuleDefinition,
  role: ChantierFieldRole
): ProcedureFieldDefinition | null {
  for (const field of module.table.fields) {
    if (module.fieldRoles.get(field.nodeId) === role) return field;
  }
  return null;
}

export function getModuleFields(
  module: ChantierModuleDefinition,
  role: ChantierFieldRole
): ProcedureFieldDefinition[] {
  return module.table.fields.filter((field) => module.fieldRoles.get(field.nodeId) === role);
}

export function getRecordValueAsText(
  model: ProcedureDatabaseModel,
  record: ProcedureRecord,
  field: ProcedureFieldDefinition | null
): string {
  if (!field) return "";
  return formatProcedureRecordValue(record.values[field.nodeId], field, model).trim();
}

export function getLatestModuleRecord(module: ChantierModuleDefinition): ProcedureRecord | null {
  return [...module.table.records].sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null;
}
