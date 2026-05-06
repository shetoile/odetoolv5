import { buildAppStorageKey } from "@/lib/appIdentity";
import type {
  DailyDocumentItem,
  DailyEvidenceKind,
  DailyEvidenceRef,
  DailyWorkActivity,
  DailyWorkActivityType,
  DailyWorkItem,
  DailyWorkItemStatus,
  DailyWorkItemType,
  DailyWorkSourceType,
  DailyWorkState
} from "./dailyWorkTypes";

const DAILY_WORK_STORAGE_PREFIX = buildAppStorageKey("dailyWorkBoard.v1");

export const EMPTY_DAILY_WORK_STATE: DailyWorkState = {
  items: [],
  documents: [],
  selectedDocumentIds: [],
  activeFolderId: null,
  activities: [],
  updatedAt: ""
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeEvidenceRefs(value: unknown): DailyEvidenceRef[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): DailyEvidenceRef | null => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Partial<DailyEvidenceRef>;
      const id = asString(candidate.id).trim();
      const label = asString(candidate.label).trim();
      if (!id || !label) return null;
      const kind: DailyEvidenceKind = candidate.kind === "html" ||
        candidate.kind === "quick_app" ||
        candidate.kind === "app" ||
        candidate.kind === "node" ||
        candidate.kind === "manual"
        ? candidate.kind
        : "document";
      const source =
        candidate.source === "node" || candidate.source === "local" || candidate.source === "external"
          ? candidate.source
          : undefined;
      const ref: DailyEvidenceRef = { id, label, kind };
      if (source) ref.source = source;
      return ref;
    })
    .filter((item): item is DailyEvidenceRef => Boolean(item));
}

function normalizeItemType(value: unknown): DailyWorkItemType {
  return value === "note" ||
    value === "meeting_summary" ||
    value === "decision" ||
    value === "risk" ||
    value === "follow_up"
    ? value
    : "action";
}

function normalizeStatus(value: unknown): DailyWorkItemStatus {
  return value === "inbox" ||
    value === "approved" ||
    value === "active" ||
    value === "waiting" ||
    value === "done" ||
    value === "rejected"
    ? value
    : "suggested";
}

function normalizeSourceType(value: unknown): DailyWorkSourceType {
  return value === "ask_ai" ||
    value === "note" ||
    value === "meeting" ||
    value === "transcript" ||
    value === "document" ||
    value === "quick_app" ||
    value === "html" ||
    value === "linked_app"
    ? value
    : "manual";
}

function normalizeDailyItem(value: unknown): DailyWorkItem | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<DailyWorkItem>;
  const id = asString(candidate.id).trim();
  const title = asString(candidate.title).trim();
  if (!id || !title) return null;
  const createdAt = asString(candidate.createdAt, new Date().toISOString());
  const updatedAt = asString(candidate.updatedAt, createdAt);
  return {
    id,
    type: normalizeItemType(candidate.type),
    title,
    body: asString(candidate.body),
    status: normalizeStatus(candidate.status),
    sourceType: normalizeSourceType(candidate.sourceType),
    sourceLabels: normalizeStringArray(candidate.sourceLabels),
    evidenceRefs: normalizeEvidenceRefs(candidate.evidenceRefs),
    createdAt,
    updatedAt,
    dueDate: asNullableString(candidate.dueDate),
    owner: asNullableString(candidate.owner),
    linkedNodeId: asNullableString(candidate.linkedNodeId),
    linkedWorkspaceId: asNullableString(candidate.linkedWorkspaceId),
    linkedDeliverableId: asNullableString(candidate.linkedDeliverableId),
    aiConfidence: asNumberOrNull(candidate.aiConfidence),
    timelineLinked: Boolean(candidate.timelineLinked)
  };
}

function normalizeDailyDocument(value: unknown): DailyDocumentItem | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<DailyDocumentItem>;
  const id = asString(candidate.id).trim();
  const name = asString(candidate.name).trim();
  if (!id || !name) return null;
  const createdAt = asString(candidate.createdAt, new Date().toISOString());
  const updatedAt = asString(candidate.updatedAt, createdAt);
  return {
    id,
    name,
    kind: candidate.kind === "folder" ? "folder" : "document",
    parentId: asNullableString(candidate.parentId),
    source: candidate.source === "node" ? "node" : "local",
    mimeType: asNullableString(candidate.mimeType),
    size: asNumberOrNull(candidate.size),
    localPath: asNullableString(candidate.localPath),
    nodeDocumentId: asNullableString(candidate.nodeDocumentId),
    pathLabel: asNullableString(candidate.pathLabel),
    createdAt,
    updatedAt
  };
}

function normalizeActivityType(value: unknown): DailyWorkActivityType {
  return value === "meeting_saved" ||
    value === "actions_created" ||
    value === "document_imported" ||
    value === "document_selected" ||
    value === "document_attached" ||
    value === "action_status" ||
    value === "timeline_sent" ||
    value === "document_changed" ||
    value === "export_requested"
    ? value
    : "note_saved";
}

function normalizeDailyActivity(value: unknown): DailyWorkActivity | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<DailyWorkActivity>;
  const id = asString(candidate.id).trim();
  const label = asString(candidate.label).trim();
  if (!id || !label) return null;
  return {
    id,
    type: normalizeActivityType(candidate.type),
    label,
    detail: asNullableString(candidate.detail),
    createdAt: asString(candidate.createdAt, new Date().toISOString()),
    itemId: asNullableString(candidate.itemId),
    documentId: asNullableString(candidate.documentId)
  };
}

export function buildDailyWorkStorageKey(contextKey: string | null | undefined): string {
  const normalized = (contextKey ?? "global")
    .trim()
    .replace(/[^a-zA-Z0-9._:-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${DAILY_WORK_STORAGE_PREFIX}:${normalized || "global"}`;
}

export function createDailyWorkId(prefix: string): string {
  const cryptoApi = typeof crypto !== "undefined" ? crypto : null;
  if (cryptoApi?.randomUUID) {
    return `${prefix}_${cryptoApi.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function readDailyWorkState(storageKey: string): DailyWorkState {
  if (typeof localStorage === "undefined") {
    return { ...EMPTY_DAILY_WORK_STATE, updatedAt: new Date().toISOString() };
  }
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { ...EMPTY_DAILY_WORK_STATE, updatedAt: new Date().toISOString() };
    const parsed = JSON.parse(raw) as Partial<DailyWorkState>;
    const items = Array.isArray(parsed.items)
      ? parsed.items.map(normalizeDailyItem).filter((item): item is DailyWorkItem => Boolean(item))
      : [];
    const documents = Array.isArray(parsed.documents)
      ? parsed.documents
          .map(normalizeDailyDocument)
          .filter((document): document is DailyDocumentItem => Boolean(document))
      : [];
    const activities = Array.isArray(parsed.activities)
      ? parsed.activities
          .map(normalizeDailyActivity)
          .filter((activity): activity is DailyWorkActivity => Boolean(activity))
          .slice(0, 120)
      : [];
    const documentIds = new Set(documents.map((document) => document.id));
    return {
      items,
      documents,
      selectedDocumentIds: normalizeStringArray(parsed.selectedDocumentIds).filter((id) => documentIds.has(id) || id.startsWith("node:")),
      activeFolderId: asNullableString(parsed.activeFolderId),
      activities,
      updatedAt: asString(parsed.updatedAt, new Date().toISOString())
    };
  } catch {
    return { ...EMPTY_DAILY_WORK_STATE, updatedAt: new Date().toISOString() };
  }
}

export function writeDailyWorkState(storageKey: string, state: DailyWorkState): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        ...state,
        updatedAt: new Date().toISOString()
      })
    );
  } catch {
    // Local persistence is best-effort so the board stays usable if storage is full.
  }
}

type NewDailyWorkItemInput = {
  type: DailyWorkItemType;
  title: string;
  body?: string;
  status?: DailyWorkItemStatus;
  sourceType?: DailyWorkSourceType;
  sourceLabels?: string[];
  evidenceRefs?: DailyEvidenceRef[];
  dueDate?: string | null;
  owner?: string | null;
};

export function createDailyWorkItem(input: NewDailyWorkItemInput): DailyWorkItem {
  const now = new Date().toISOString();
  return {
    id: createDailyWorkId("work"),
    type: input.type,
    title: input.title.trim(),
    body: input.body?.trim() ?? "",
    status: input.status ?? "suggested",
    sourceType: input.sourceType ?? "manual",
    sourceLabels: input.sourceLabels ?? [],
    evidenceRefs: input.evidenceRefs ?? [],
    createdAt: now,
    updatedAt: now,
    dueDate: input.dueDate ?? null,
    owner: input.owner ?? null,
    linkedNodeId: null,
    linkedWorkspaceId: null,
    linkedDeliverableId: null,
    aiConfidence: null,
    timelineLinked: false
  };
}

type NewDailyWorkActivityInput = {
  type: DailyWorkActivityType;
  label: string;
  detail?: string | null;
  itemId?: string | null;
  documentId?: string | null;
};

export function createDailyWorkActivity(input: NewDailyWorkActivityInput): DailyWorkActivity {
  const now = new Date().toISOString();
  return {
    id: createDailyWorkId("activity"),
    type: input.type,
    label: input.label.trim(),
    detail: input.detail?.trim() || null,
    createdAt: now,
    itemId: input.itemId ?? null,
    documentId: input.documentId ?? null
  };
}

type NewDailyDocumentInput = {
  name: string;
  kind: "folder" | "document";
  parentId?: string | null;
  mimeType?: string | null;
  size?: number | null;
  localPath?: string | null;
};

export function createDailyDocumentItem(input: NewDailyDocumentInput): DailyDocumentItem {
  const now = new Date().toISOString();
  return {
    id: createDailyWorkId(input.kind === "folder" ? "folder" : "doc"),
    name: input.name.trim(),
    kind: input.kind,
    parentId: input.parentId ?? null,
    source: "local",
    mimeType: input.mimeType ?? null,
    size: input.size ?? null,
    localPath: input.localPath ?? null,
    nodeDocumentId: null,
    pathLabel: null,
    createdAt: now,
    updatedAt: now
  };
}
