import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent as ReactClipboardEvent,
  type ComponentProps,
  type DragEvent,
  type FormEvent,
  type ReactNode
} from "react";
import {
  AiCommandBar,
  type AiCommandRequestOptions
} from "@/components/overlay/AiCommandBar";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import {
  ArrowRightGlyphSmall,
  CalendarGlyphSmall,
  ChecklistGlyphSmall,
  ClockGlyphSmall,
  DataFolderGlyphSmall,
  EditGlyphSmall,
  ExportGlyphSmall,
  FileGlyphSmall,
  ImageGlyphSmall,
  LinkGlyphSmall,
  OpenGlyphSmall,
  PlusGlyphSmall,
  SearchGlyphSmall,
  SparkGlyphSmall,
  TableGridGlyphSmall,
  TrashGlyphSmall,
  UploadGlyphSmall
} from "@/components/Icons";
import {
  buildDailyWorkStorageKey,
  createDailyDocumentItem,
  createDailyWorkActivity,
  createDailyWorkItem,
  readDailyWorkState,
  writeDailyWorkState
} from "@/features/daily-work/dailyWorkStore";
import {
  addDailyWorkContextToPrompt,
  buildDailyWorkAiContext
} from "@/features/daily-work/dailyWorkContext";
import {
  exportDailyWork,
  type DailyWorkExportFormat
} from "@/features/daily-work/dailyWorkExport";
import {
  extractDailyWorkWithAi,
  type DailyWorkAiExtractedItem,
  type DailyWorkAiExtraction
} from "@/features/daily-work/dailyWorkAi";
import {
  encodeAiAccessToken,
  getPrimaryStoredAiProviderKey,
  isSupportedAiProviderId
} from "@/lib/aiProviderKeys";
import type {
  DailyDocumentItem,
  DailyEvidenceRef,
  DailyWorkActivity,
  DailyWorkActivityType,
  DailyWorkItem,
  DailyWorkItemStatus,
  DailyWorkItemType,
  DailyWorkSourceType,
  DailyWorkState
} from "@/features/daily-work/dailyWorkTypes";

type AiCommandBarEmbeddedProps = ComponentProps<typeof AiCommandBar>;

type DailyWorkBoardProps = {
  aiCommandBarProps: AiCommandBarEmbeddedProps;
  contextKey?: string | null;
  currentUserLabel?: string | null;
};

type DailyStateRecord = {
  key: string;
  state: DailyWorkState;
};

type DailyWorkStateUpdater = DailyWorkState | ((current: DailyWorkState) => DailyWorkState);

type ExtractedItemDraft = {
  type: DailyWorkItemType;
  title: string;
  body: string;
};

const DOCUMENT_DRAG_MIME = "application/x-odetool-daily-document";

type DailyHubEntryKind = "note" | "meeting" | "message" | "task" | "decision" | "document";
type DailyHubAiAction = "summary" | "tasks" | "decisions" | "follow_up" | "tomorrow" | "ask";
type DailyHubChannelId = "ai" | "team" | "workspace" | "chantier" | "activity";

type DailyHubChannel = {
  id: DailyHubChannelId;
  label: string;
  detail: string;
  icon: ReactNode;
  count: number;
};

type DailyHubMessage = {
  id: string;
  channelId: DailyHubChannelId;
  role: "user" | "assistant" | "team" | "system" | "action";
  author: string;
  title: string;
  body: string;
  createdAt: string;
  item?: DailyWorkItem;
  activity?: DailyWorkActivity;
  evidenceRefs: DailyEvidenceRef[];
};

const DAILY_HUB_ENTRY_TYPES: Array<{
  id: DailyHubEntryKind;
  label: string;
  icon: ReactNode;
}> = [
  { id: "note", label: "Note", icon: <EditGlyphSmall /> },
  { id: "meeting", label: "Meeting", icon: <ClockGlyphSmall /> },
  { id: "message", label: "Message", icon: <MessageGlyphSmall /> },
  { id: "task", label: "Task", icon: <ChecklistGlyphSmall /> },
  { id: "decision", label: "Decision", icon: <CheckGlyphSmall /> },
  { id: "document", label: "Document", icon: <DataFolderGlyphSmall /> }
];

const DAILY_HUB_AI_ACTIONS: Array<{
  id: DailyHubAiAction;
  label: string;
  icon: ReactNode;
}> = [
  { id: "summary", label: "Summarize Today", icon: <SparkGlyphSmall /> },
  { id: "tasks", label: "Extract Tasks", icon: <ChecklistGlyphSmall /> },
  { id: "decisions", label: "Extract Decisions", icon: <CheckGlyphSmall /> },
  { id: "follow_up", label: "Prepare Follow-up", icon: <MessageGlyphSmall /> },
  { id: "tomorrow", label: "Plan Tomorrow", icon: <CalendarGlyphSmall /> },
  { id: "ask", label: "Ask AI", icon: <ArrowRightGlyphSmall /> }
];

const ACTION_STATUS_CONFIG: Array<{
  status: DailyWorkItemStatus;
  label: string;
  icon: ReactNode;
}> = [
  { status: "suggested", label: "Suggested", icon: <SparkGlyphSmall /> },
  { status: "approved", label: "Approved", icon: <CheckGlyphSmall /> },
  { status: "active", label: "Active", icon: <ArrowRightGlyphSmall /> },
  { status: "waiting", label: "Waiting", icon: <ClockGlyphSmall /> },
  { status: "done", label: "Done", icon: <ChecklistGlyphSmall /> },
  { status: "rejected", label: "Rejected", icon: <RejectGlyphSmall /> }
];

function CheckGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="m5.4 12.4 4.1 4.1 9.1-9.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function RejectGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M7 7l10 10M17 7 7 17"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function MessageGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M5.2 6.4h13.6a1.9 1.9 0 0 1 1.9 1.9v6.5a1.9 1.9 0 0 1-1.9 1.9h-6.4l-4.2 3v-3h-3a1.9 1.9 0 0 1-1.9-1.9V8.3a1.9 1.9 0 0 1 1.9-1.9Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M7.8 10.2h8.4M7.8 13.2h5.4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}
function MergeGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M6 5v5.2c0 2.1 1.7 3.8 3.8 3.8H18M6 19v-5.2c0-2.1 1.7-3.8 3.8-3.8H18"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path d="m15.6 7.6 2.6 2.4-2.6 2.4M15.6 11.6l2.6 2.4-2.6 2.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

function FolderUpGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M4.8 8.1h5l1.8 2h7.6v7.8a1.8 1.8 0 0 1-1.8 1.8H6.6a1.8 1.8 0 0 1-1.8-1.8Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path d="M12 15.9v-4.8M9.9 13.1 12 11l2.1 2.1" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

function nowIso() {
  return new Date().toISOString();
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric"
    });
  } catch {
    return value;
  }
}

function describeSize(size: number | null | undefined): string {
  if (!size || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function mergeEvidenceRefs(refs: DailyEvidenceRef[]): DailyEvidenceRef[] {
  const byId = new Map<string, DailyEvidenceRef>();
  for (const ref of refs) {
    byId.set(ref.id, ref);
  }
  return Array.from(byId.values());
}

function getItemKindLabel(type: DailyWorkItemType): string {
  if (type === "follow_up") return "Follow-up";
  if (type === "meeting_summary") return "Meeting";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function getStatusMeta(status: DailyWorkItemStatus) {
  return ACTION_STATUS_CONFIG.find((item) => item.status === status) ?? ACTION_STATUS_CONFIG[0];
}

function getDailyHubEntryMeta(kind: DailyHubEntryKind) {
  return DAILY_HUB_ENTRY_TYPES.find((item) => item.id === kind) ?? DAILY_HUB_ENTRY_TYPES[0];
}

function getDailyHubItemPreset(kind: DailyHubEntryKind): {
  type: DailyWorkItemType;
  status: DailyWorkItemStatus;
  sourceType: DailyWorkSourceType;
} {
  if (kind === "meeting") return { type: "meeting_summary", status: "inbox", sourceType: "meeting" };
  if (kind === "task") return { type: "action", status: "suggested", sourceType: "manual" };
  if (kind === "decision") return { type: "decision", status: "suggested", sourceType: "manual" };
  if (kind === "document") return { type: "note", status: "inbox", sourceType: "document" };
  return { type: "note", status: "inbox", sourceType: "manual" };
}

function getDailyHubItemLabel(item: DailyWorkItem): string {
  const hubLabel = item.sourceLabels.find((label) =>
    DAILY_HUB_ENTRY_TYPES.some((entryType) => entryType.label === label)
  );
  return hubLabel ?? getItemKindLabel(item.type);
}

function getDailyHubTypeClass(item: DailyWorkItem): string {
  return getDailyHubItemLabel(item).toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function formatDailyHubTime(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return new Date(value).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

function getDailyHubItemChannelId(item: DailyWorkItem): DailyHubChannelId {
  const labels = item.sourceLabels.map((label) => label.toLowerCase());
  if (item.sourceType === "ask_ai" || labels.some((label) => label.includes("ai assistant"))) return "ai";
  if (labels.some((label) => label.includes("chantier"))) return "chantier";
  if (labels.some((label) => label.includes("workspace"))) return "workspace";
  if (labels.some((label) => label.includes("team") || label.includes("message"))) return "team";
  if (item.type === "action" || item.type === "decision" || item.type === "risk" || item.type === "follow_up") {
    return "workspace";
  }
  return "team";
}

function getDailyHubMessageRole(item: DailyWorkItem): DailyHubMessage["role"] {
  const labels = item.sourceLabels.map((label) => label.toLowerCase());
  if (labels.some((label) => label.includes("ai response") || label.includes("ai assistant"))) return "assistant";
  if (item.type === "action" || item.type === "decision" || item.type === "risk" || item.type === "follow_up") {
    return "action";
  }
  if (item.sourceType === "ask_ai") return "user";
  return "team";
}

function getDailyHubMessageAuthor(item: DailyWorkItem, currentUserLabel: string): string {
  const role = getDailyHubMessageRole(item);
  if (role === "assistant") return "ODE AI";
  if (role === "action") return getDailyHubItemLabel(item);
  if (getDailyHubItemChannelId(item) === "workspace") return "Workspace";
  if (getDailyHubItemChannelId(item) === "chantier") return "Chantier";
  return currentUserLabel;
}

function createDailyHubMessages(
  items: DailyWorkItem[],
  _activities: DailyWorkActivity[],
  currentUserLabel: string
): DailyHubMessage[] {
  const itemMessages = items.map((item): DailyHubMessage => ({
    id: item.id,
    channelId: getDailyHubItemChannelId(item),
    role: getDailyHubMessageRole(item),
    author: getDailyHubMessageAuthor(item, currentUserLabel),
    title: item.title,
    body: item.body,
    createdAt: item.createdAt,
    item,
    evidenceRefs: item.evidenceRefs
  }));
  return itemMessages.sort(
    (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)
  );
}

function createNodeDocumentItem(document: NonNullable<AiCommandBarEmbeddedProps["nodeContext"]>["documents"][number]): DailyDocumentItem {
  const now = nowIso();
  return {
    id: `node:${document.id}`,
    name: document.name,
    kind: "document",
    parentId: null,
    source: "node",
    mimeType: document.type,
    size: null,
    nodeDocumentId: document.id,
    pathLabel: document.pathLabel,
    createdAt: now,
    updatedAt: now
  };
}

function documentToEvidenceRef(document: DailyDocumentItem): DailyEvidenceRef {
  return {
    id: document.id,
    label: document.name,
    kind: "document",
    source: document.source
  };
}

function extractItemsFromText(
  text: string,
  sourceType: DailyWorkSourceType,
  evidenceRefs: DailyEvidenceRef[]
): DailyWorkItem[] {
  const sourceLabel =
    sourceType === "meeting" || sourceType === "transcript"
      ? "Meeting"
      : sourceType === "note"
        ? "Note"
        : "Daily work";
  const drafts: ExtractedItemDraft[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*]\s+/, ""))
    .filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^(action|todo|task|decision|decided|risk|follow(?:\s|-)?up)[:\-\s]+(.+)$/i);
    if (!match) continue;
    const marker = match[1].toLowerCase();
    const title = match[2].trim();
    if (!title) continue;
    const type: DailyWorkItemType = marker.startsWith("decision") || marker === "decided"
      ? "decision"
      : marker.startsWith("risk")
        ? "risk"
        : marker.startsWith("follow")
          ? "follow_up"
          : "action";
    drafts.push({
      type,
      title,
      body: line
    });
  }

  if (drafts.length === 0 && text.trim().length > 0) {
    const firstLine = lines[0] ?? text.trim();
    drafts.push({
      type: "action",
      title: firstLine.slice(0, 120),
      body: text.trim()
    });
  }

  return drafts.map((draft) =>
    createDailyWorkItem({
      type: draft.type,
      title: draft.title,
      body: draft.body,
      status: "suggested",
      sourceType,
      sourceLabels: [sourceLabel],
      evidenceRefs
    })
  );
}

function createDailyItemsFromAiExtraction(
  extraction: DailyWorkAiExtraction,
  sourceType: DailyWorkSourceType,
  evidenceRefs: DailyEvidenceRef[]
): DailyWorkItem[] {
  const sourceLabel =
    sourceType === "meeting" || sourceType === "transcript"
      ? "Meeting AI"
      : sourceType === "note"
        ? "Note AI"
        : "Daily work AI";
  const usedTimelineKeys = new Set<string>();
  const buildItem = (type: DailyWorkItemType, item: DailyWorkAiExtractedItem, label = sourceLabel) =>
    createDailyWorkItem({
      type,
      title: item.title,
      body: item.detail,
      status: "suggested",
      sourceType,
      sourceLabels: [label],
      evidenceRefs,
      dueDate: item.dueDate,
      owner: item.owner
    });

  const items = [
    ...extraction.decisions.map((item) => buildItem("decision", item)),
    ...extraction.actions.map((item) => {
      const key = item.title.trim().toLowerCase();
      if (key) usedTimelineKeys.add(key);
      return buildItem("action", item);
    }),
    ...extraction.risks.map((item) => buildItem("risk", item)),
    ...extraction.followUps.map((item) => buildItem("follow_up", item))
  ];

  for (const item of extraction.timelineSuggestions) {
    const key = item.title.trim().toLowerCase();
    if (key && usedTimelineKeys.has(key)) continue;
    const action = buildItem("action", item, "Timeline suggestion");
    action.timelineLinked = false;
    items.push(action);
  }

  return items;
}

function formatAiMeetingSummary(title: string, extraction: DailyWorkAiExtraction): string {
  const section = (label: string, items: DailyWorkAiExtractedItem[]) => [
    `${label}:`,
    ...(items.length > 0 ? items.map((item) => `- ${item.title}${item.detail ? `: ${item.detail}` : ""}`) : ["- None"])
  ];
  return [
    `Summary: ${extraction.summary || title}`,
    "",
    ...section("Decisions", extraction.decisions),
    "",
    ...section("Actions", extraction.actions),
    "",
    ...section("Risks", extraction.risks),
    "",
    ...section("Follow-ups", extraction.followUps),
    "",
    ...section("Timeline suggestions", extraction.timelineSuggestions)
  ].join("\n");
}

function buildMeetingSummary(title: string, transcript: string) {
  const lines = transcript
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const preview = lines.slice(0, 3).join(" ");
  return [
    `Summary: ${preview || title}`,
    "",
    "Decisions:",
    ...lines.filter((line) => /^(decision|decided)[:\-\s]/i.test(line)).map((line) => `- ${line}`),
    "",
    "Actions:",
    ...lines.filter((line) => /^(action|todo|task)[:\-\s]/i.test(line)).map((line) => `- ${line}`),
    "",
    "Risks:",
    ...lines.filter((line) => /^risk[:\-\s]/i.test(line)).map((line) => `- ${line}`),
    "",
    "Follow-ups:",
    ...lines.filter((line) => /^follow(?:\s|-)?up[:\-\s]/i.test(line)).map((line) => `- ${line}`)
  ].join("\n");
}

function readDocumentDrag(event: DragEvent<HTMLElement>): string | null {
  const raw = event.dataTransfer.getData(DOCUMENT_DRAG_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { id?: unknown };
    return typeof parsed.id === "string" ? parsed.id : null;
  } catch {
    return null;
  }
}

function addActivityToState(
  state: DailyWorkState,
  input: {
    type: DailyWorkActivityType;
    label: string;
    detail?: string | null;
    itemId?: string | null;
    documentId?: string | null;
  }
): DailyWorkState {
  return {
    ...state,
    activities: [createDailyWorkActivity(input), ...(state.activities ?? [])].slice(0, 120),
    updatedAt: nowIso()
  };
}

function isSameCompactText(left: string, right: string): boolean {
  return left.trim().replace(/\s+/g, " ") === right.trim().replace(/\s+/g, " ");
}

function parseDateKey(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + offset);
  return copy;
}

function addDays(date: Date, count: number): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + count);
  return copy;
}

function buildGanttDays(items: DailyWorkItem[]): string[] {
  const dated = items
    .map((item) => (item.dueDate ? parseDateKey(item.dueDate) : null))
    .filter((date): date is Date => Boolean(date))
    .sort((left, right) => left.getTime() - right.getTime());
  const start = startOfWeek(dated[0] ?? new Date());
  return Array.from({ length: 14 }, (_, index) => toDateKey(addDays(start, index)));
}

function buildTeamCommunicationBrief(
  notes: DailyWorkItem[],
  meetings: DailyWorkItem[],
  actions: DailyWorkItem[],
  documents: DailyDocumentItem[]
): string {
  const openActions = actions.filter((item) => item.status !== "done" && item.status !== "rejected").slice(0, 5);
  const risks = actions.filter((item) => item.type === "risk" && item.status !== "done" && item.status !== "rejected").slice(0, 3);
  const followUps = actions.filter((item) => item.type === "follow_up" && item.status !== "done" && item.status !== "rejected").slice(0, 3);
  const latestMeeting = meetings[0]?.title ?? null;
  const latestNote = notes[0]?.title ?? null;
  const evidence = documents.filter((document) => document.kind === "document").slice(0, 4);
  return [
    "Team update",
    latestMeeting ? `Meeting: ${latestMeeting}` : null,
    latestNote ? `Context: ${latestNote}` : null,
    openActions.length ? "Actions:" : null,
    ...openActions.map((item) => `- ${item.title}${item.dueDate ? ` (${formatShortDate(item.dueDate)})` : ""}`),
    risks.length ? "Risks:" : null,
    ...risks.map((item) => `- ${item.title}`),
    followUps.length ? "Follow-ups:" : null,
    ...followUps.map((item) => `- ${item.title}`),
    evidence.length ? `Evidence: ${evidence.map((document) => document.name).join(", ")}` : null
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function getGanttColumn(dueDate: string | null | undefined, days: string[]): number | null {
  if (!dueDate) return null;
  const index = days.indexOf(dueDate);
  return index >= 0 ? index + 1 : null;
}

function EvidenceChips({
  refs,
  onRemove
}: {
  refs: DailyEvidenceRef[];
  onRemove?: (id: string) => void;
}) {
  if (refs.length === 0) return null;
  return (
    <div className="ode-daily-evidence-strip">
      {refs.map((ref) => (
        <span key={ref.id} className="ode-daily-chip">
          <LinkGlyphSmall />
          <span className="truncate">{ref.label}</span>
          {onRemove ? (
            <button type="button" onClick={() => onRemove(ref.id)} aria-label={`Remove ${ref.label}`}>
              <RejectGlyphSmall />
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function SharedFileChips({
  refs,
  onOpen
}: {
  refs: DailyEvidenceRef[];
  onOpen?: (id: string) => void;
}) {
  if (refs.length === 0) return null;

  return (
    <div className="ode-daily-chat-shared-files">
      {refs.map((ref) => {
        const isImage = /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(ref.label);
        return (
          <button
            key={ref.id}
            type="button"
            className="ode-daily-chat-shared-file"
            title={ref.label}
            onClick={() => onOpen?.(ref.id)}
          >
            {isImage ? <ImageGlyphSmall /> : <FileGlyphSmall />}
            <span>{ref.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return <div className="ode-daily-empty">{label}</div>;
}

function DailyActivityStrip({ activities }: { activities: DailyWorkActivity[] }) {
  if (activities.length === 0) return null;
  return (
    <div className="ode-daily-activity-strip" aria-label="Recent daily work changes">
      {activities.slice(0, 4).map((activity) => (
        <span key={activity.id} className="ode-daily-activity-pill" title={activity.detail ?? activity.label}>
          <SparkGlyphSmall />
          <span className="truncate">{activity.label}</span>
        </span>
      ))}
    </div>
  );
}

export function DailyWorkBoard({ aiCommandBarProps, contextKey, currentUserLabel }: DailyWorkBoardProps) {
  const dailyHubCurrentUserLabel = currentUserLabel?.trim() || "User";
  const storageKey = useMemo(() => buildDailyWorkStorageKey(contextKey), [contextKey]);
  const [stateRecord, setStateRecord] = useState<DailyStateRecord>(() => ({
    key: storageKey,
    state: readDailyWorkState(storageKey)
  }));
  const [noteDraft, setNoteDraft] = useState("");
  const [noteEvidenceIds, setNoteEvidenceIds] = useState<string[]>([]);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingTranscript, setMeetingTranscript] = useState("");
  const [meetingEvidenceIds, setMeetingEvidenceIds] = useState<string[]>([]);
  const [selectedActionIds, setSelectedActionIds] = useState<string[]>([]);
  const [documentSearch, setDocumentSearch] = useState("");
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(null);
  const [aiExtractBusy, setAiExtractBusy] = useState<DailyWorkSourceType | null>(null);
  const [dailyAiMessage, setDailyAiMessage] = useState<string | null>(null);
  const [dailyHubDraft, setDailyHubDraft] = useState("");
  const [dailyHubPendingFiles, setDailyHubPendingFiles] = useState<File[]>([]);
  const [dailyHubComposerMode, setDailyHubComposerMode] = useState<"message" | "ai">("message");
  const [dailyHubEditingMessageId, setDailyHubEditingMessageId] = useState<string | null>(null);
  const [dailyHubEditingDraft, setDailyHubEditingDraft] = useState("");
  const [dailyHubAiBusy, setDailyHubAiBusy] = useState<DailyHubAiAction | null>(null);
  const [dailyHubAiMessage, setDailyHubAiMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setStateRecord({
      key: storageKey,
      state: readDailyWorkState(storageKey)
    });
  }, [storageKey]);

  useEffect(() => {
    if (stateRecord.key !== storageKey) return;
    writeDailyWorkState(storageKey, stateRecord.state);
  }, [stateRecord, storageKey]);

  const dailyState = stateRecord.state;

  const setDailyState = useCallback((updater: DailyWorkStateUpdater) => {
    setStateRecord((current) => ({
      ...current,
      state: typeof updater === "function" ? updater(current.state) : updater
    }));
  }, []);

  const nodeDocuments = useMemo<DailyDocumentItem[]>(
    () => (aiCommandBarProps.nodeContext?.documents ?? []).map(createNodeDocumentItem),
    [aiCommandBarProps.nodeContext?.documents]
  );

  const allDocuments = useMemo<DailyDocumentItem[]>(() => {
    const byId = new Map<string, DailyDocumentItem>();
    for (const document of nodeDocuments) byId.set(document.id, document);
    for (const document of dailyState.documents) byId.set(document.id, document);
    return Array.from(byId.values());
  }, [dailyState.documents, nodeDocuments]);

  const documentById = useMemo(
    () => new Map(allDocuments.map((document) => [document.id, document])),
    [allDocuments]
  );

  const selectedEvidenceRefs = useMemo(
    () =>
      dailyState.selectedDocumentIds
        .map((id) => documentById.get(id))
        .filter((document): document is DailyDocumentItem => Boolean(document))
        .map(documentToEvidenceRef),
    [dailyState.selectedDocumentIds, documentById]
  );

  const selectedAiDocumentIds = useMemo(
    () =>
      selectedEvidenceRefs
        .filter((ref) => ref.source === "node" && ref.id.startsWith("node:"))
        .map((ref) => ref.id.slice("node:".length)),
    [selectedEvidenceRefs]
  );

  const dailyAiContext = useMemo(
    () => buildDailyWorkAiContext(dailyState, allDocuments, selectedEvidenceRefs),
    [allDocuments, dailyState, selectedEvidenceRefs]
  );

  const withDailyAiContext = useCallback(
    (requestText: string) => addDailyWorkContextToPrompt(requestText, dailyAiContext),
    [dailyAiContext]
  );

  const mergeAiOptions = useCallback(
    (options?: AiCommandRequestOptions): AiCommandRequestOptions => ({
      ...options,
      selectedDocumentIds: uniqueStrings([...(options?.selectedDocumentIds ?? []), ...selectedAiDocumentIds])
    }),
    [selectedAiDocumentIds]
  );

  const aiPropsWithEvidence = useMemo<AiCommandBarEmbeddedProps>(
    () => ({
      ...aiCommandBarProps,
      onAnalyze: (commandText, options) => aiCommandBarProps.onAnalyze(withDailyAiContext(commandText), mergeAiOptions(options)),
      onAskNode: aiCommandBarProps.onAskNode
        ? (requestText, options) => aiCommandBarProps.onAskNode!(withDailyAiContext(requestText), mergeAiOptions(options))
        : undefined,
      onApplyNodePlan: aiCommandBarProps.onApplyNodePlan
        ? (requestText, answerText, options) =>
            aiCommandBarProps.onApplyNodePlan!(withDailyAiContext(requestText), answerText, mergeAiOptions(options))
        : undefined,
      onOpenNodeDeliverableProposal: aiCommandBarProps.onOpenNodeDeliverableProposal
        ? (requestText, options) =>
            aiCommandBarProps.onOpenNodeDeliverableProposal!(withDailyAiContext(requestText), mergeAiOptions(options))
        : undefined,
      onOpenNodeIntegratedPlanProposal: aiCommandBarProps.onOpenNodeIntegratedPlanProposal
        ? (requestText, options) =>
            aiCommandBarProps.onOpenNodeIntegratedPlanProposal!(withDailyAiContext(requestText), mergeAiOptions(options))
        : undefined
    }),
    [aiCommandBarProps, mergeAiOptions, withDailyAiContext]
  );

  const actionItems = useMemo(
    () => dailyState.items.filter((item) => item.type !== "note" && item.type !== "meeting_summary"),
    [dailyState.items]
  );
  const noteItems = useMemo(
    () => dailyState.items.filter((item) => item.type === "note"),
    [dailyState.items]
  );
  const meetingItems = useMemo(
    () => dailyState.items.filter((item) => item.type === "meeting_summary"),
    [dailyState.items]
  );
  const timelineItems = useMemo(
    () =>
      actionItems
        .filter((item) => item.dueDate && (item.timelineLinked || item.status === "approved" || item.status === "active" || item.status === "done"))
        .sort((left, right) => String(left.dueDate).localeCompare(String(right.dueDate))),
    [actionItems]
  );
  const ganttDays = useMemo(() => buildGanttDays(timelineItems), [timelineItems]);
  const teamBriefText = useMemo(
    () => buildTeamCommunicationBrief(noteItems, meetingItems, actionItems, allDocuments),
    [actionItems, allDocuments, meetingItems, noteItems]
  );
  const dailyFeedItems = useMemo(
    () =>
      [...dailyState.items].sort(
        (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)
      ),
    [dailyState.items]
  );
  const openActionItems = useMemo(
    () => actionItems.filter((item) => item.status !== "done" && item.status !== "rejected"),
    [actionItems]
  );
  const recentDocumentItems = useMemo(
    () => allDocuments.filter((document) => document.kind === "document").slice(0, 5),
    [allDocuments]
  );
  const dailyHubMessages = useMemo(
    () => createDailyHubMessages(dailyState.items, dailyState.activities, dailyHubCurrentUserLabel),
    [dailyHubCurrentUserLabel, dailyState.activities, dailyState.items]
  );

  const resolveEvidenceRefs = useCallback(
    (ids: string[]) => {
      const explicitRefs = ids
        .map((id) => documentById.get(id))
        .filter((document): document is DailyDocumentItem => Boolean(document))
        .map(documentToEvidenceRef);
      return explicitRefs.length > 0 ? explicitRefs : selectedEvidenceRefs;
    },
    [documentById, selectedEvidenceRefs]
  );

  const runDailyWorkAiExtraction = useCallback(
    async (
      mode: "note" | "meeting",
      title: string | null,
      rawText: string,
      evidenceRefs: DailyEvidenceRef[]
    ): Promise<DailyWorkAiExtraction | null> => {
      const credential = getPrimaryStoredAiProviderKey();
      if (!credential) {
        setDailyAiMessage(null);
        return null;
      }

      setAiExtractBusy(mode === "meeting" ? "meeting" : "note");
      setDailyAiMessage(null);
      try {
        const extraction = await extractDailyWorkWithAi({
          apiKey: encodeAiAccessToken(credential),
          providerId: isSupportedAiProviderId(credential.providerId) ? credential.providerId : undefined,
          mode,
          targetLanguage: aiCommandBarProps.language,
          title,
          rawText,
          evidenceLabels: evidenceRefs.map((ref) => ref.label)
        });
        setDailyAiMessage(`AI created review items (${Math.round(extraction.confidence * 100)}%).`);
        return extraction;
      } catch (error) {
        const message = error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "AI unavailable; local extraction used.";
        setDailyAiMessage(message);
        return null;
      } finally {
        setAiExtractBusy(null);
      }
    },
    [aiCommandBarProps.language]
  );

  const importFiles = useCallback(
    (files: File[], parentId: string | null = dailyState.activeFolderId) => {
      if (files.length === 0) return [];
      const created = files.map((file) =>
        createDailyDocumentItem({
          name: file.name,
          kind: "document",
          parentId,
          mimeType: file.type || null,
          size: file.size
        })
      );
      setDailyState((current) => ({
        ...addActivityToState(current, {
          type: "document_imported",
          label: created.length === 1 ? "Document imported" : `${created.length} documents imported`,
          detail: created.map((document) => document.name).join(", ")
        }),
        documents: [...current.documents, ...created],
        updatedAt: nowIso()
      }));
      return created;
    },
    [dailyState.activeFolderId, setDailyState]
  );

  const addEvidenceIds = useCallback((target: "note" | "meeting", ids: string[]) => {
    if (ids.length === 0) return;
    if (target === "note") {
      setNoteEvidenceIds((current) => uniqueStrings([...current, ...ids]));
    } else {
      setMeetingEvidenceIds((current) => uniqueStrings([...current, ...ids]));
    }
  }, []);

  const handleEvidenceDrop = useCallback(
    (event: DragEvent<HTMLElement>, target: "note" | "meeting") => {
      event.preventDefault();
      const documentId = readDocumentDrag(event);
      if (documentId) {
        addEvidenceIds(target, [documentId]);
        const document = documentById.get(documentId);
        setDailyState((current) =>
          addActivityToState(current, {
            type: "document_attached",
            label: target === "note" ? "Evidence attached to note" : "Evidence attached to meeting",
            detail: document?.name ?? documentId,
            documentId
          })
        );
        return;
      }
      const files = Array.from(event.dataTransfer.files ?? []);
      const created = importFiles(files);
      addEvidenceIds(target, created.map((document) => document.id));
      if (created.length > 0) {
        setDailyState((current) =>
          addActivityToState(current, {
            type: "document_attached",
            label: target === "note" ? "Evidence attached to note" : "Evidence attached to meeting",
            detail: created.map((document) => document.name).join(", ")
          })
        );
      }
    },
    [addEvidenceIds, documentById, importFiles, setDailyState]
  );

  const toggleDocumentSelection = useCallback(
    (documentId: string) => {
      setDailyState((current) => {
        const selected = new Set(current.selectedDocumentIds);
        const wasSelected = selected.has(documentId);
        if (selected.has(documentId)) {
          selected.delete(documentId);
        } else {
          selected.add(documentId);
        }
        return addActivityToState({
          ...current,
          selectedDocumentIds: Array.from(selected),
          updatedAt: nowIso()
        }, {
          type: "document_selected",
          label: wasSelected ? "Evidence unselected" : "Evidence selected",
          detail: documentById.get(documentId)?.name ?? documentId,
          documentId
        });
      });
    },
    [documentById, setDailyState]
  );

  const saveNote = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      if (!noteDraft.trim()) return;
      const evidenceRefs = resolveEvidenceRefs(noteEvidenceIds);
      const item = createDailyWorkItem({
        type: "note",
        title: noteDraft.trim().split(/\r?\n/)[0].slice(0, 120),
        body: noteDraft,
        status: "inbox",
        sourceType: "note",
        sourceLabels: ["Note"],
        evidenceRefs
      });
      setDailyState((current) =>
        addActivityToState(
          {
            ...current,
            items: [item, ...current.items],
            updatedAt: nowIso()
          },
          {
            type: "note_saved",
            label: "Note saved",
            detail: item.title,
            itemId: item.id
          }
        )
      );
      setNoteDraft("");
      setNoteEvidenceIds([]);
    },
    [noteDraft, noteEvidenceIds, resolveEvidenceRefs, setDailyState]
  );

  const createActionsFromNote = useCallback(async () => {
    if (!noteDraft.trim()) return;
    const evidenceRefs = resolveEvidenceRefs(noteEvidenceIds);
    const extraction = await runDailyWorkAiExtraction("note", null, noteDraft, evidenceRefs);
    const items = extraction
      ? createDailyItemsFromAiExtraction(extraction, "note", evidenceRefs)
      : extractItemsFromText(noteDraft, "note", evidenceRefs);
    setDailyState((current) =>
      addActivityToState(
        {
          ...current,
          items: [...items, ...current.items],
          updatedAt: nowIso()
        },
        {
          type: "actions_created",
          label: items.length === 1 ? "Action created from note" : `${items.length} actions created from note`,
          detail: noteDraft.trim().split(/\r?\n/)[0].slice(0, 140)
        }
      )
    );
    setDailyHubAiMessage("Review items added to Daily Hub.");
  }, [noteDraft, noteEvidenceIds, resolveEvidenceRefs, runDailyWorkAiExtraction, setDailyState]);

  const saveMeetingPack = useCallback(
    async (createActions: boolean) => {
      if (!meetingTranscript.trim()) return;
      const evidenceRefs = resolveEvidenceRefs(meetingEvidenceIds);
      const title = meetingTitle.trim() || "Meeting notes";
      const extraction = createActions
        ? await runDailyWorkAiExtraction("meeting", title, meetingTranscript, evidenceRefs)
        : null;
      const summaryItem = createDailyWorkItem({
        type: "meeting_summary",
        title,
        body: extraction ? formatAiMeetingSummary(title, extraction) : buildMeetingSummary(title, meetingTranscript),
        status: "inbox",
        sourceType: "meeting",
        sourceLabels: [extraction ? "Meeting AI" : "Meeting"],
        evidenceRefs
      });
      const extracted = createActions
        ? extraction
          ? createDailyItemsFromAiExtraction(extraction, "meeting", evidenceRefs)
          : extractItemsFromText(meetingTranscript, "meeting", evidenceRefs)
        : [];
      setDailyState((current) =>
        addActivityToState(
          {
            ...current,
            items: [summaryItem, ...extracted, ...current.items],
            updatedAt: nowIso()
          },
          {
            type: createActions ? "actions_created" : "meeting_saved",
            label: createActions
              ? extracted.length === 1
                ? "Meeting review action created"
                : `${extracted.length} meeting review items created`
              : "Meeting saved",
            detail: title,
            itemId: summaryItem.id
          }
        )
      );
      if (createActions) setDailyHubAiMessage("Meeting review items added to Daily Hub.");
      setMeetingTitle("");
      setMeetingTranscript("");
      setMeetingEvidenceIds([]);
    },
    [meetingEvidenceIds, meetingTitle, meetingTranscript, resolveEvidenceRefs, runDailyWorkAiExtraction, setDailyState]
  );

  const updateItem = useCallback(
    (itemId: string, updater: (item: DailyWorkItem) => DailyWorkItem) => {
      setDailyState((current) => ({
        ...current,
        items: current.items.map((item) => (item.id === itemId ? { ...updater(item), updatedAt: nowIso() } : item)),
        updatedAt: nowIso()
      }));
    },
    [setDailyState]
  );

  const setItemStatus = useCallback(
    (itemId: string, status: DailyWorkItemStatus) => {
      setDailyState((current) => {
        const target = current.items.find((item) => item.id === itemId);
        const nextState = {
          ...current,
          items: current.items.map((item) =>
            item.id === itemId ? { ...item, status, updatedAt: nowIso() } : item
          ),
          updatedAt: nowIso()
        };
        return addActivityToState(nextState, {
          type: "action_status",
          label: `${getStatusMeta(status).label} set`,
          detail: target?.title ?? null,
          itemId
        });
      });
    },
    [setDailyState]
  );

  const sendToTimeline = useCallback(
    (itemId: string) => {
      setDailyState((current) => {
        const target = current.items.find((item) => item.id === itemId);
        const nextState = {
          ...current,
          items: current.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  status: item.status === "suggested" ? "approved" : item.status,
                  timelineLinked: Boolean(item.dueDate),
                  updatedAt: nowIso()
                }
              : item
          ),
          updatedAt: nowIso()
        };
        return addActivityToState(nextState, {
          type: "timeline_sent",
          label: "Sent to Timeline",
          detail: target?.title ?? null,
          itemId
        });
      });
    },
    [setDailyState]
  );

  const toggleActionSelected = useCallback((itemId: string) => {
    setSelectedActionIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]
    );
  }, []);

  const mergeSelectedActions = useCallback(() => {
    if (selectedActionIds.length < 2) return;
    setDailyState((current) => {
      const selected = current.items.filter((item) => selectedActionIds.includes(item.id));
      const [primary, ...rest] = selected;
      if (!primary) return current;
      const restIds = new Set(rest.map((item) => item.id));
      const merged: DailyWorkItem = {
        ...primary,
        title: primary.title,
        body: [primary.body, ...rest.map((item) => `${item.title}${item.body ? `\n${item.body}` : ""}`)]
          .filter(Boolean)
          .join("\n\n"),
        evidenceRefs: mergeEvidenceRefs([...primary.evidenceRefs, ...rest.flatMap((item) => item.evidenceRefs)]),
        sourceLabels: uniqueStrings([...primary.sourceLabels, ...rest.flatMap((item) => item.sourceLabels)]),
        updatedAt: nowIso()
      };
      return {
        ...current,
        items: current.items.map((item) => (item.id === primary.id ? merged : item)).filter((item) => !restIds.has(item.id)),
        updatedAt: nowIso()
      };
    });
    setSelectedActionIds([]);
  }, [selectedActionIds, setDailyState]);

  const deleteItem = useCallback(
    (itemId: string) => {
      setDailyState((current) => ({
        ...current,
        items: current.items.filter((item) => item.id !== itemId),
        updatedAt: nowIso()
      }));
    },
    [setDailyState]
  );

  const startDailyHubMessageEdit = useCallback((item: DailyWorkItem) => {
    setDailyHubEditingMessageId(item.id);
    setDailyHubEditingDraft(item.body || item.title);
  }, []);

  const cancelDailyHubMessageEdit = useCallback(() => {
    setDailyHubEditingMessageId(null);
    setDailyHubEditingDraft("");
  }, []);

  const saveDailyHubMessageEdit = useCallback(
    (item: DailyWorkItem) => {
      const body = dailyHubEditingDraft.trim();
      if (!body) return;
      updateItem(item.id, (current) => ({
        ...current,
        title: body.split(/\r?\n/)[0]?.trim().slice(0, 120) || current.title,
        body
      }));
      setDailyHubEditingMessageId(null);
      setDailyHubEditingDraft("");
    },
    [dailyHubEditingDraft, updateItem]
  );

  const createFolder = useCallback(() => {
    const name = window.prompt("Folder name");
    if (!name?.trim()) return;
    const folder = createDailyDocumentItem({
      name: name.trim(),
      kind: "folder",
      parentId: dailyState.activeFolderId
    });
    setDailyState((current) =>
      addActivityToState(
        {
          ...current,
          documents: [...current.documents, folder],
          updatedAt: nowIso()
        },
        {
          type: "document_changed",
          label: "Folder created",
          detail: folder.name,
          documentId: folder.id
        }
      )
    );
  }, [dailyState.activeFolderId, setDailyState]);

  const addDailyHubPendingFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    setDailyHubPendingFiles((current) => {
      const bySignature = new Map<string, File>();
      for (const file of [...current, ...files]) {
        bySignature.set(`${file.name}|${file.size}|${file.type}|${file.lastModified}`, file);
      }
      return Array.from(bySignature.values());
    });
    setDailyHubComposerMode("message");
  }, []);

  const removeDailyHubPendingFile = useCallback((index: number) => {
    setDailyHubPendingFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  }, []);

  const handleDailyHubFileSelect = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      addDailyHubPendingFiles(Array.from(event.target.files ?? []));
      event.target.value = "";
    },
    [addDailyHubPendingFiles]
  );

  const handleDailyHubPaste = useCallback(
    (event: ReactClipboardEvent<HTMLTextAreaElement>) => {
      const clipboardData = event.clipboardData;
      const filesFromList = Array.from(clipboardData.files ?? []);
      const filesFromItems = Array.from(clipboardData.items ?? [])
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file));
      const bySignature = new Map<string, File>();
      for (const file of [...filesFromList, ...filesFromItems]) {
        const fallbackName = file.type.startsWith("image/")
          ? `Pasted image ${new Date().toISOString().replace(/[:.]/g, "-")}.png`
          : `Pasted file ${new Date().toISOString().replace(/[:.]/g, "-")}`;
        const namedFile = file.name.trim().length > 0
          ? file
          : new File([file], fallbackName, {
              lastModified: file.lastModified,
              type: file.type
            });
        bySignature.set(`${namedFile.name}|${namedFile.size}|${namedFile.type}`, namedFile);
      }
      const pastedFiles = Array.from(bySignature.values());
      if (pastedFiles.length === 0) return;

      event.preventDefault();
      addDailyHubPendingFiles(pastedFiles);
    },
    [addDailyHubPendingFiles]
  );

  const moveDocument = useCallback(
    (document: DailyDocumentItem, parentId: string | null) => {
      if (document.source !== "local") return;
      setDailyState((current) =>
        addActivityToState(
          {
            ...current,
            documents: current.documents.map((item) =>
              item.id === document.id ? { ...item, parentId, updatedAt: nowIso() } : item
            ),
            updatedAt: nowIso()
          },
          {
            type: "document_changed",
            label: "Document moved",
            detail: document.name,
            documentId: document.id
          }
        )
      );
    },
    [setDailyState]
  );

  const promptMoveDocument = useCallback(
    (document: DailyDocumentItem) => {
      const folderName = window.prompt("Move to folder name. Leave blank for root.");
      if (folderName === null) return;
      const trimmed = folderName.trim();
      if (!trimmed) {
        moveDocument(document, null);
        return;
      }
      const target = dailyState.documents.find(
        (item) => item.kind === "folder" && item.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (!target) return;
      moveDocument(document, target.id);
    },
    [dailyState.documents, moveDocument]
  );

  const renameDocument = useCallback(
    (document: DailyDocumentItem) => {
      if (document.source !== "local") return;
      const name = window.prompt("Rename", document.name);
      if (!name?.trim()) return;
      setDailyState((current) =>
        addActivityToState(
          {
            ...current,
            documents: current.documents.map((item) =>
              item.id === document.id ? { ...item, name: name.trim(), updatedAt: nowIso() } : item
            ),
            updatedAt: nowIso()
          },
          {
            type: "document_changed",
            label: "Document renamed",
            detail: `${document.name} -> ${name.trim()}`,
            documentId: document.id
          }
        )
      );
    },
    [setDailyState]
  );

  const deleteDocument = useCallback(
    (document: DailyDocumentItem) => {
      if (document.source !== "local") return;
      if (!window.confirm(`Delete ${document.name}?`)) return;
      setDailyState((current) => {
        const deleteIds = new Set([document.id]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const item of current.documents) {
            if (item.parentId && deleteIds.has(item.parentId) && !deleteIds.has(item.id)) {
              deleteIds.add(item.id);
              changed = true;
            }
          }
        }
        return addActivityToState(
          {
            ...current,
            documents: current.documents.filter((item) => !deleteIds.has(item.id)),
            selectedDocumentIds: current.selectedDocumentIds.filter((id) => !deleteIds.has(id)),
            activeFolderId: deleteIds.has(current.activeFolderId ?? "") ? null : current.activeFolderId,
            updatedAt: nowIso()
          },
          {
            type: "document_changed",
            label: "Document deleted",
            detail: document.name,
            documentId: document.id
          }
        );
      });
      if (previewDocumentId === document.id) setPreviewDocumentId(null);
    },
    [previewDocumentId, setDailyState]
  );

  const handleDocumentPanelDrop = useCallback(
    (event: DragEvent<HTMLElement>, parentId: string | null = dailyState.activeFolderId) => {
      event.preventDefault();
      const documentId = readDocumentDrag(event);
      if (documentId) {
        const document = documentById.get(documentId);
        if (document && document.source === "local" && document.id !== parentId) {
          moveDocument(document, parentId);
        }
        return;
      }
      importFiles(Array.from(event.dataTransfer.files ?? []), parentId);
    },
    [dailyState.activeFolderId, documentById, importFiles, moveDocument]
  );

  const setActiveFolderId = useCallback(
    (folderId: string | null) => {
      setDailyState((current) => ({
        ...current,
        activeFolderId: folderId,
        updatedAt: nowIso()
      }));
    },
    [setDailyState]
  );

  const handleExport = useCallback(
    async (format: DailyWorkExportFormat) => {
      const title = aiCommandBarProps.nodeContext?.title
        ? `${aiCommandBarProps.nodeContext.title} Daily Work`
        : "ODETool Daily Work";
      await exportDailyWork(
        {
          title,
          generatedAt: nowIso(),
          state: dailyState,
          documents: allDocuments
        },
        format
      );
      setDailyState((current) =>
        addActivityToState(current, {
          type: "export_requested",
          label: `${format === "excel" ? "Excel" : format.toUpperCase()} export created`,
          detail: title
        })
      );
    },
    [aiCommandBarProps.nodeContext?.title, allDocuments, dailyState, setDailyState]
  );
  const handleDailyHubSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const body = dailyHubDraft.trim();
      const pendingFiles = dailyHubPendingFiles;
      if (!body && pendingFiles.length === 0) return;

      const isAiMessage = dailyHubComposerMode === "ai" && body.length > 0;
      const createdDocuments = pendingFiles.length > 0 ? importFiles(pendingFiles) : [];
      const evidenceRefs = createdDocuments.map(documentToEvidenceRef);
      const sharedFileNames = createdDocuments.map((document) => document.name).join(", ");
      const fallbackTitle = createdDocuments.length === 1
        ? createdDocuments[0].name
        : createdDocuments.length > 1
          ? `${createdDocuments.length} files`
          : isAiMessage
            ? "AI question"
            : "Team message";
      const title = body.split(/\r?\n/)[0]?.trim().slice(0, 120) || fallbackTitle;
      const item = createDailyWorkItem({
        type: "note",
        title,
        body: body || (createdDocuments.length > 0 ? sharedFileNames : title),
        status: "inbox",
        sourceType: isAiMessage ? "ask_ai" : "manual",
        sourceLabels: uniqueStrings([
          isAiMessage ? "AI Chat" : "Team Chat",
          dailyHubCurrentUserLabel,
          createdDocuments.length > 0 ? "Shared File" : "Message"
        ]),
        evidenceRefs
      });

      setDailyState((current) =>
        addActivityToState(
          {
            ...current,
            items: [item, ...current.items],
            selectedDocumentIds: uniqueStrings([
              ...current.selectedDocumentIds,
              ...createdDocuments.map((document) => document.id)
            ]),
            updatedAt: nowIso()
          },
          {
            type: createdDocuments.length > 0 ? "document_attached" : "note_saved",
            label: createdDocuments.length > 0
              ? createdDocuments.length === 1
                ? "File shared"
                : `${createdDocuments.length} files shared`
              : isAiMessage
                ? "AI question sent"
                : "Team message sent",
            detail: createdDocuments.length > 0 ? sharedFileNames : item.title,
            itemId: item.id
          }
        )
      );
      setDailyHubDraft("");
      setDailyHubPendingFiles([]);
      if (!isAiMessage) return;

      setDailyHubAiBusy("ask");
      setDailyHubAiMessage(null);
      try {
        const plan = await aiPropsWithEvidence.onAnalyze(
          [
            body,
            "",
            "Respond as the Daily Hub assistant. Use current ODETool context, selected evidence, quick apps, and daily-work history. If an app change is needed, propose the action clearly and wait for confirmation."
          ].join("\n"),
          { actionHint: "daily_hub_chat" }
        );
        const answer = plan.reason || plan.steps.join("\n") || "I reviewed the current context.";
        const responseItem = createDailyWorkItem({
          type: "note",
          title: answer.split(/\r?\n/)[0]?.trim().slice(0, 120) || "AI response",
          body: answer,
          status: plan.requiresConfirmation ? "suggested" : "inbox",
          sourceType: "ask_ai",
          sourceLabels: ["AI Assistant", "AI Response"],
          evidenceRefs: []
        });
        setDailyState((current) =>
          addActivityToState(
            {
              ...current,
              items: [...current.items, responseItem],
              updatedAt: nowIso()
            },
            {
              type: "note_saved",
              label: plan.requiresConfirmation ? "AI proposal ready" : "AI response received",
              detail: responseItem.title,
              itemId: responseItem.id
            }
          )
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setDailyHubAiMessage(message);
      } finally {
        setDailyHubAiBusy(null);
      }
    },
    [
      aiPropsWithEvidence,
      dailyHubComposerMode,
      dailyHubCurrentUserLabel,
      dailyHubDraft,
      dailyHubPendingFiles,
      importFiles,
      setDailyState
    ]
  );

  const runDailyHubAiAction = useCallback(
    async (action: DailyHubAiAction) => {
      if (dailyHubAiBusy) return;
      const actionLabel = DAILY_HUB_AI_ACTIONS.find((item) => item.id === action)?.label ?? "AI help";
      const feedLines = dailyFeedItems
        .slice(0, 80)
        .map((item) => {
          const detail = item.body && !isSameCompactText(item.title, item.body) ? `: ${item.body}` : "";
          return `- [${getDailyHubItemLabel(item)}] ${item.title}${detail}`;
        })
        .join("\n");
      const documentLines = allDocuments
        .filter((document) => document.kind === "document")
        .slice(0, 20)
        .map((document) => `- ${document.name}`)
        .join("\n");
      const askDraft = dailyHubDraft.trim();
      const prompts: Record<DailyHubAiAction, string> = {
        summary: "Summarize today from the Daily Hub feed. Keep it practical and concise.",
        tasks: "Extract task candidates from the Daily Hub feed. Do not create or automate anything.",
        decisions: "Extract the decisions captured in the Daily Hub feed. Include only decisions supported by the entries.",
        follow_up: "Prepare a short follow-up message from the Daily Hub feed. Keep it ready to review before sending.",
        tomorrow: "Plan tomorrow from the Daily Hub feed. Focus on priorities, blockers, and next actions.",
        ask: askDraft
          ? `Answer this Daily Hub question or note: ${askDraft}`
          : "Review the Daily Hub feed and suggest what needs attention."
      };

      setDailyHubAiBusy(action);
      setDailyHubAiMessage(null);
      try {
        const plan = await aiPropsWithEvidence.onAnalyze(
          [
            prompts[action],
            "",
            "Daily Hub feed:",
            feedLines || "No saved entries yet.",
            "",
            "Supporting documents:",
            documentLines || "No documents attached."
          ].join("\n"),
          { actionHint: `daily_hub_${action}` }
        );
        const answer = plan.reason || plan.steps[0] || `${actionLabel} prepared.`;
        const responseItem = createDailyWorkItem({
          type: action === "tasks" || action === "decisions" ? "action" : "note",
          title: answer.split(/\r?\n/)[0]?.trim().slice(0, 120) || actionLabel,
          body: answer,
          status: plan.requiresConfirmation ? "suggested" : "inbox",
          sourceType: "ask_ai",
          sourceLabels: ["AI Assistant", "AI Response", actionLabel],
          evidenceRefs: []
        });
        setDailyState((current) =>
          addActivityToState(
            {
              ...current,
              items: [...current.items, responseItem],
              updatedAt: nowIso()
            },
            {
              type: "note_saved",
              label: `${actionLabel} ready`,
              detail: responseItem.title,
              itemId: responseItem.id
            }
          )
        );
        setDailyHubComposerMode("ai");
        setDailyHubAiMessage(answer);
      } catch (error) {
        setDailyHubAiMessage(error instanceof Error ? error.message : String(error));
      } finally {
        setDailyHubAiBusy(null);
      }
    },
    [aiPropsWithEvidence, allDocuments, dailyFeedItems, dailyHubAiBusy, dailyHubDraft, setDailyState]
  );

  return (
    <section className="ode-daily-board ode-daily-hub ode-daily-chat" aria-label="Daily Hub">
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleDailyHubFileSelect} />

      <div className="ode-daily-chat-shell ode-daily-chat-shell-simple">
        <main className="ode-daily-chat-panel">
          <section className="ode-daily-chat-thread" aria-label="Activity messages">
            {dailyHubMessages.length === 0 ? (
              <div className="ode-daily-chat-empty">
                <MessageGlyphSmall />
                <span>No activity yet.</span>
              </div>
            ) : null}

            {dailyHubMessages.map((message) => {
              const ownMessage = message.role === "user" || message.author === dailyHubCurrentUserLabel;
              const canEditMessage = Boolean(message.item && ownMessage);
              const isSharedFileMessage =
                message.evidenceRefs.length > 0 &&
                message.item?.sourceLabels.some((label) => {
                  const normalized = label.toLowerCase();
                  return normalized.includes("clipboard") || normalized.includes("shared file");
                }) === true;
              const messageText =
                message.body && !isSameCompactText(message.title, message.body) ? message.body : message.title;
              const editingMessage = message.item?.id === dailyHubEditingMessageId;
              return (
                <article
                  key={message.id}
                  className={`ode-daily-chat-message ode-daily-chat-message-${message.role} ${
                    ownMessage ? "ode-daily-chat-message-own" : ""
                  }`}
                >
                  <div className="ode-daily-chat-bubble">
                    <div className="ode-daily-chat-message-meta">
                      <strong>{message.author}</strong>
                      <time>{formatDailyHubTime(message.createdAt)}</time>
                    </div>
                    {editingMessage && message.item ? (
                      <div className="ode-daily-chat-edit-form">
                        <textarea
                          value={dailyHubEditingDraft}
                          onChange={(event) => setDailyHubEditingDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              event.preventDefault();
                              cancelDailyHubMessageEdit();
                            }
                            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                              event.preventDefault();
                              saveDailyHubMessageEdit(message.item!);
                            }
                          }}
                          autoFocus
                          aria-label="Edit message"
                        />
                        <div className="ode-daily-chat-message-tools">
                          <button type="button" onClick={cancelDailyHubMessageEdit}>Cancel</button>
                          <button
                            type="button"
                            onClick={() => saveDailyHubMessageEdit(message.item!)}
                            disabled={!dailyHubEditingDraft.trim()}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p>{messageText}</p>
                    )}
                    {isSharedFileMessage ? (
                      <SharedFileChips refs={message.evidenceRefs} onOpen={setPreviewDocumentId} />
                    ) : null}
                    {canEditMessage && message.item ? (
                      <div className="ode-daily-chat-message-tools">
                        <button type="button" onClick={() => startDailyHubMessageEdit(message.item!)} disabled={editingMessage}>
                          <EditGlyphSmall />
                          <span>Edit</span>
                        </button>
                        <button type="button" onClick={() => deleteItem(message.item!.id)}>
                          <TrashGlyphSmall />
                          <span>Delete</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>

          <form className="ode-daily-chat-composer" onSubmit={(event) => void handleDailyHubSubmit(event)}>
            <div className="ode-daily-chat-quick-row">
              <button
                type="button"
                className={dailyHubComposerMode === "message" ? "ode-daily-chat-chip-active" : ""}
                onClick={() => setDailyHubComposerMode("message")}
                aria-pressed={dailyHubComposerMode === "message"}
              >
                <MessageGlyphSmall />
                <span>Message</span>
              </button>
              <button
                type="button"
                className={dailyHubComposerMode === "ai" ? "ode-daily-chat-chip-active" : ""}
                onClick={() => setDailyHubComposerMode("ai")}
                aria-pressed={dailyHubComposerMode === "ai"}
              >
                <SparkGlyphSmall />
                <span>Ask AI</span>
              </button>
            </div>

            {dailyHubPendingFiles.length > 0 ? (
              <div className="ode-daily-chat-pending-files" aria-label="Files ready to send">
                {dailyHubPendingFiles.map((file, index) => {
                  const isImage = file.type.startsWith("image/") || /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(file.name);
                  return (
                    <span key={`${file.name}-${file.size}-${file.lastModified}`} className="ode-daily-chat-pending-file">
                      {isImage ? <ImageGlyphSmall /> : <FileGlyphSmall />}
                      <span>{file.name}</span>
                      <button type="button" onClick={() => removeDailyHubPendingFile(index)} aria-label={`Remove ${file.name}`}>
                        x
                      </button>
                    </span>
                  );
                })}
              </div>
            ) : null}

            <div className="ode-daily-chat-compose-row">
              <button
                type="button"
                className="ode-daily-chat-round-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={dailyHubAiBusy !== null}
                aria-label="Attach files"
              >
                <UploadGlyphSmall />
              </button>
              <textarea
                value={dailyHubDraft}
                onChange={(event) => setDailyHubDraft(event.target.value)}
                onPaste={handleDailyHubPaste}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={
                  dailyHubComposerMode === "ai"
                    ? "Ask AI..."
                    : "Message..."
                }
                disabled={dailyHubAiBusy !== null}
                aria-label={dailyHubComposerMode === "ai" ? "Ask AI" : "Write team message"}
              />
              <button
                type="submit"
                className="ode-daily-chat-send-btn"
                disabled={(!dailyHubDraft.trim() && dailyHubPendingFiles.length === 0) || dailyHubAiBusy !== null}
                aria-label={dailyHubComposerMode === "ai" ? "Ask AI" : "Send message"}
              >
                <ArrowRightGlyphSmall />
              </button>
            </div>
          </form>
        </main>
      </div>
    </section>
  );
}
