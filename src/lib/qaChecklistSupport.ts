import { type LanguageCode } from "@/lib/i18n";
import { REGRESSION_CHECKLIST_ITEMS, type RegressionChecklistItem } from "@/lib/regressionChecklist";
import { getLocalizedRegressionChecklistItem } from "@/lib/regressionChecklistLocalization";
import type { AiQaExecutionItemReport, AiQaFeedbackEntry, QaInputCategory } from "@/lib/aiTester";

const QA_CHECKLIST_STORAGE_KEY = "odetool.qaChecklist.v1";
const QA_CHECKLIST_PROGRESS_STORAGE_KEY = "odetool.qaChecklist.progress.v1";
const QA_CHECKLIST_AREA_ORDER: RegressionChecklistItem["area"][] = [
  "Tree",
  "Desktop",
  "Timeline",
  "Workspace",
  "Favorites",
  "Keyboard",
  "UI"
];

export const QA_AUTOMATION_UPLOAD_ITEM_ID = "desktop-upload-targets-current-folder";
export const QA_AUTOMATION_ITEM_IDS = REGRESSION_CHECKLIST_ITEMS.filter(
  (item) => Boolean(item.aiTester?.automationId) && item.id !== QA_AUTOMATION_UPLOAD_ITEM_ID
).map((item) => item.id);

export type QaChecklistStatus = "pending" | "passed" | "failed";
export type QaChecklistAttachmentSource = "file" | "screenshot";

export type QaChecklistAttachment = {
  id: string;
  name: string;
  path: string;
  source: QaChecklistAttachmentSource;
  addedAt: string;
};

export type QaChecklistStatusEntry = {
  status: QaChecklistStatus;
  checkedAt: string | null;
  failureReason: string;
  attachments: QaChecklistAttachment[];
};

export type QaChecklistProgressState = {
  scrollTop: number;
  lastItemId: string | null;
};

export type QaChecklistDisplayItem = {
  item: RegressionChecklistItem;
  localizedItem: { area: string; title: string; scenario: string };
  numberLabel: string;
  sectionNumber: number;
  itemNumber: number;
};

export type QaChecklistDisplaySection = {
  area: RegressionChecklistItem["area"];
  localizedArea: string;
  sectionNumber: number;
  items: QaChecklistDisplayItem[];
};

export function normalizeQaInputCategory(value: string): QaInputCategory {
  const normalized = value.trim().toLowerCase();
  if (normalized === "bug" || normalized === "bugs" || normalized === "error" || normalized === "errors") {
    return "bug";
  }
  if (normalized === "issue" || normalized === "issues") {
    return "issue";
  }
  if (normalized === "feature" || normalized === "features") {
    return "feature";
  }
  if (normalized === "functionality" || normalized === "fix" || normalized === "fixes") {
    return "functionality";
  }
  return "general";
}

export function getReleaseCategoryLabel(category: string, translateLabel: (key: string) => string): string {
  return translateLabel(`release.category.${normalizeQaInputCategory(category)}`);
}

export function normalizeQaFeedbackEntries(entries: unknown): AiQaFeedbackEntry[] {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .map((entry, index) => {
      const title =
        typeof entry.title === "string" && entry.title.trim().length > 0
          ? entry.title.trim()
          : `Feedback ${index + 1}`;
      const id =
        typeof entry.id === "string" && entry.id.trim().length > 0 ? entry.id.trim() : `feedback-${index + 1}`;
      return {
        id,
        date: typeof entry.date === "string" ? entry.date : undefined,
        category: normalizeQaInputCategory(typeof entry.category === "string" ? entry.category : "general"),
        title,
        details: typeof entry.details === "string" ? entry.details : undefined,
        source: typeof entry.source === "string" ? entry.source : undefined,
        comments: typeof entry.comments === "string" ? entry.comments : undefined
      };
    });
}

export function buildOrderedQaChecklistSections(
  items: RegressionChecklistItem[],
  language: LanguageCode
): QaChecklistDisplaySection[] {
  const areaOrderIndex = new Map(QA_CHECKLIST_AREA_ORDER.map((area, index) => [area, index]));
  const sortedItems = items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftOrder = areaOrderIndex.get(left.item.area) ?? QA_CHECKLIST_AREA_ORDER.length;
      const rightOrder = areaOrderIndex.get(right.item.area) ?? QA_CHECKLIST_AREA_ORDER.length;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.index - right.index;
    });

  const sections: QaChecklistDisplaySection[] = [];
  for (const { item } of sortedItems) {
    const localizedItem = getLocalizedRegressionChecklistItem(item, language);
    let section = sections[sections.length - 1];
    if (!section || section.area !== item.area) {
      section = {
        area: item.area,
        localizedArea: localizedItem.area,
        sectionNumber: sections.length + 1,
        items: []
      };
      sections.push(section);
    }

    const itemNumber = section.items.length + 1;
    section.items.push({
      item,
      localizedItem,
      numberLabel: `${section.sectionNumber}.${itemNumber}`,
      sectionNumber: section.sectionNumber,
      itemNumber
    });
  }

  return sections;
}

export function buildOrderedQaChecklistItems(
  items: RegressionChecklistItem[],
  language: LanguageCode
): QaChecklistDisplayItem[] {
  return buildOrderedQaChecklistSections(items, language).flatMap((section) => section.items);
}

function normalizeQaChecklistStatus(raw: unknown): QaChecklistStatus {
  if (raw === "passed" || raw === "failed" || raw === "pending") return raw;
  return "pending";
}

function normalizeQaChecklistText(raw: unknown): string {
  return typeof raw === "string" ? raw : "";
}

function getFileNameFromPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "Attachment";
  const parts = trimmed.split(/[\\/]/);
  return parts[parts.length - 1] || trimmed;
}

function normalizeQaChecklistAttachments(raw: unknown): QaChecklistAttachment[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const next: QaChecklistAttachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as {
      id?: unknown;
      name?: unknown;
      path?: unknown;
      source?: unknown;
      addedAt?: unknown;
    };
    const path = typeof candidate.path === "string" ? candidate.path.trim() : "";
    if (!path) continue;
    const dedupeKey = path.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const source: QaChecklistAttachmentSource = candidate.source === "screenshot" ? "screenshot" : "file";
    const name =
      typeof candidate.name === "string" && candidate.name.trim().length > 0
        ? candidate.name.trim()
        : getFileNameFromPath(path);
    const addedAt =
      typeof candidate.addedAt === "string" && candidate.addedAt.trim().length > 0
        ? candidate.addedAt
        : new Date().toISOString();
    const id =
      typeof candidate.id === "string" && candidate.id.trim().length > 0
        ? candidate.id
        : `qaatt_${addedAt}_${next.length}`;
    next.push({
      id,
      name,
      path,
      source,
      addedAt
    });
  }
  return next;
}

export function buildQaChecklistAttachments(
  current: QaChecklistAttachment[],
  paths: string[],
  source: QaChecklistAttachmentSource
): QaChecklistAttachment[] {
  const seen = new Set(current.map((item) => item.path.toLowerCase()));
  const additions: QaChecklistAttachment[] = [];
  for (const rawPath of paths) {
    const path = rawPath.trim();
    if (!path) continue;
    const dedupeKey = path.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    additions.push({
      id: `qaatt_${Date.now()}_${Math.floor(Math.random() * 100000)}_${additions.length}`,
      name: getFileNameFromPath(path),
      path,
      source,
      addedAt: new Date().toISOString()
    });
  }
  return additions.length > 0 ? [...current, ...additions] : current;
}

export function readQaChecklistState(): Record<string, QaChecklistStatusEntry> {
  if (typeof window === "undefined") return {};
  const validIds = new Set(REGRESSION_CHECKLIST_ITEMS.map((item) => item.id));
  try {
    const raw = localStorage.getItem(QA_CHECKLIST_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};

    const next: Record<string, QaChecklistStatusEntry> = {};
    for (const [id, entry] of Object.entries(parsed)) {
      if (!validIds.has(id) || !entry || typeof entry !== "object") continue;
      const parsedEntry = entry as {
        status?: unknown;
        checkedAt?: unknown;
        failureReason?: unknown;
        attachments?: unknown;
      };
      const checkedAt =
        typeof parsedEntry.checkedAt === "string" && parsedEntry.checkedAt.trim().length > 0
          ? parsedEntry.checkedAt
          : null;
      next[id] = {
        status: normalizeQaChecklistStatus(parsedEntry.status),
        checkedAt,
        failureReason: normalizeQaChecklistText(parsedEntry.failureReason),
        attachments: normalizeQaChecklistAttachments(parsedEntry.attachments)
      };
    }
    return next;
  } catch {
    return {};
  }
}

export function readQaChecklistProgress(): QaChecklistProgressState {
  if (typeof window === "undefined") {
    return { scrollTop: 0, lastItemId: null };
  }

  const validIds = new Set(REGRESSION_CHECKLIST_ITEMS.map((item) => item.id));
  try {
    const raw = localStorage.getItem(QA_CHECKLIST_PROGRESS_STORAGE_KEY);
    if (!raw) return { scrollTop: 0, lastItemId: null };
    const parsed = JSON.parse(raw) as { scrollTop?: unknown; lastItemId?: unknown };
    const scrollTop =
      typeof parsed?.scrollTop === "number" && Number.isFinite(parsed.scrollTop) && parsed.scrollTop > 0
        ? parsed.scrollTop
        : 0;
    const lastItemId =
      typeof parsed?.lastItemId === "string" && validIds.has(parsed.lastItemId) ? parsed.lastItemId : null;
    return { scrollTop, lastItemId };
  } catch {
    return { scrollTop: 0, lastItemId: null };
  }
}

export function writeQaChecklistProgress(state: QaChecklistProgressState) {
  if (typeof window === "undefined") return;
  try {
    if (state.scrollTop <= 0 && !state.lastItemId) {
      localStorage.removeItem(QA_CHECKLIST_PROGRESS_STORAGE_KEY);
      return;
    }
    localStorage.setItem(QA_CHECKLIST_PROGRESS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Checklist resume state is best-effort only.
  }
}

export function clearQaChecklistProgress() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(QA_CHECKLIST_PROGRESS_STORAGE_KEY);
  } catch {
    // Checklist resume state is best-effort only.
  }
}

export function writeQaChecklistState(state: Record<string, QaChecklistStatusEntry>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(QA_CHECKLIST_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Checklist persistence is best-effort only.
  }
}

export function getQaChecklistEntry(
  stateById: Record<string, QaChecklistStatusEntry>,
  itemId: string
): QaChecklistStatusEntry {
  return stateById[itemId] ?? { status: "pending", checkedAt: null, failureReason: "", attachments: [] };
}

export function buildQaChecklistPdfExportData(
  orderedChecklistItems: QaChecklistDisplayItem[],
  checklistStateById: Record<string, QaChecklistStatusEntry>,
  aiReportItemById?: Map<string, AiQaExecutionItemReport>
) {
  let pending = 0;
  let passed = 0;
  let failed = 0;

  const reportItems = orderedChecklistItems.map((displayItem) => {
    const entry = getQaChecklistEntry(checklistStateById, displayItem.item.id);
    const aiReportItem = aiReportItemById?.get(displayItem.item.id);
    if (entry.status === "passed") {
      passed += 1;
    } else if (entry.status === "failed") {
      failed += 1;
    } else {
      pending += 1;
    }

    return {
      area: displayItem.localizedItem.area,
      title: `${displayItem.numberLabel} ${displayItem.localizedItem.title}`,
      scenario: displayItem.localizedItem.scenario,
      status: entry.status,
      checkedAt: entry.checkedAt,
      failureReason: entry.failureReason,
      developerGuidance: aiReportItem?.developerGuidance ?? "",
      screenshotPreviewDataUrl:
        aiReportItem?.attachments.find(
          (attachment) => attachment.source === "screenshot" && attachment.previewDataUrl
        )?.previewDataUrl ?? null,
      attachments: entry.attachments.map((attachment) => ({
        name: attachment.name,
        path: attachment.path,
        source: attachment.source
      }))
    };
  });

  return {
    summary: {
      total: orderedChecklistItems.length,
      pending,
      passed,
      failed
    },
    reportItems
  };
}
