import type {
  DailyDocumentItem,
  DailyEvidenceRef,
  DailyWorkActivity,
  DailyWorkItem,
  DailyWorkState
} from "./dailyWorkTypes";

const MAX_SECTION_ITEMS = 18;
const MAX_TEXT_LENGTH = 420;

function compactText(value: string | null | undefined, maxLength = MAX_TEXT_LENGTH): string {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}...`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "no date";
  return value.slice(0, 10);
}

function formatEvidence(refs: DailyEvidenceRef[]): string {
  if (refs.length === 0) return "no evidence";
  return refs.map((ref) => ref.label).join(", ");
}

function formatItems(items: DailyWorkItem[]): string[] {
  return items.slice(0, MAX_SECTION_ITEMS).map((item) => {
    const parts = [
      item.title,
      `status: ${item.status}`,
      `date: ${formatDate(item.dueDate)}`,
      `source: ${item.sourceLabels.join(", ") || item.sourceType}`,
      `evidence: ${formatEvidence(item.evidenceRefs)}`
    ];
    const body = compactText(item.body);
    if (body && body !== item.title) parts.push(`detail: ${body}`);
    return `- ${parts.join(" | ")}`;
  });
}

function formatDocuments(documents: DailyDocumentItem[], selectedIds: string[]): string[] {
  const selected = new Set(selectedIds);
  return documents.slice(0, MAX_SECTION_ITEMS).map((document) => {
    const flags = [
      document.kind,
      document.source,
      selected.has(document.id) ? "selected evidence" : ""
    ].filter(Boolean);
    return `- ${document.name} | ${flags.join(", ")}${document.pathLabel ? ` | ${document.pathLabel}` : ""}`;
  });
}

function formatActivities(activities: DailyWorkActivity[]): string[] {
  return activities.slice(0, 14).map((activity) => {
    const detail = compactText(activity.detail, 180);
    return `- ${activity.createdAt.slice(0, 16).replace("T", " ")} | ${activity.label}${detail ? ` | ${detail}` : ""}`;
  });
}

export function buildDailyWorkAiContext(
  state: DailyWorkState,
  documents: DailyDocumentItem[],
  selectedEvidenceRefs: DailyEvidenceRef[]
): string {
  const notes = state.items.filter((item) => item.type === "note");
  const meetings = state.items.filter((item) => item.type === "meeting_summary");
  const workItems = state.items.filter((item) => item.type !== "note" && item.type !== "meeting_summary");
  const timelineItems = workItems.filter((item) => item.dueDate && (item.timelineLinked || item.status === "approved" || item.status === "active" || item.status === "done"));

  return [
    "Daily work board context for the active node/workspace.",
    `Counts: ${notes.length} notes, ${meetings.length} meetings, ${workItems.length} actions/decisions/risks/follow-ups, ${documents.length} documents, ${timelineItems.length} dated timeline items.`,
    `Currently selected evidence: ${selectedEvidenceRefs.length ? selectedEvidenceRefs.map((ref) => ref.label).join(", ") : "none"}.`,
    "",
    "Notes:",
    ...(notes.length ? formatItems(notes) : ["- none"]),
    "",
    "Meetings:",
    ...(meetings.length ? formatItems(meetings) : ["- none"]),
    "",
    "Actions, decisions, risks, follow-ups:",
    ...(workItems.length ? formatItems(workItems) : ["- none"]),
    "",
    "Timeline/Gantt dated items:",
    ...(timelineItems.length ? formatItems(timelineItems) : ["- none"]),
    "",
    "Documents/evidence:",
    ...(documents.length ? formatDocuments(documents, state.selectedDocumentIds) : ["- none"]),
    "",
    "Recent board changes:",
    ...(state.activities.length ? formatActivities(state.activities) : ["- none"]),
    "",
    "Rules: use this context as evidence; do not approve, reject, delete, or send timeline items unless the user explicitly asks."
  ].join("\n");
}

export function addDailyWorkContextToPrompt(requestText: string, contextText: string): string {
  if (!contextText.trim()) return requestText;
  return [
    "User request:",
    requestText,
    "",
    "Available ODETool daily work context:",
    contextText
  ].join("\n");
}
