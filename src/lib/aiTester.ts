import type {
  QaTesterMode,
  QaTesterPriority,
  RegressionChecklistItem
} from "@/lib/regressionChecklist";
import { buildAppStorageKey } from "@/lib/appIdentity";

export type QaChecklistPlanStatus = "pending" | "passed" | "failed";
export type AiQaLearningSource = "manual" | "automation";
export type AiQaRunTrigger = "manual" | "automatic";
export type AiQaExecutionStatus = "passed" | "failed" | "manual_required";
export type QaInputCategory = "bug" | "issue" | "feature" | "functionality" | "general";

export interface QaChecklistPlanStateEntry {
  status: QaChecklistPlanStatus;
  checkedAt: string | null;
  failureReason: string;
  attachmentsCount: number;
}

export interface QaReleaseEntry {
  id: string;
  date: string;
  category: string;
  title: string;
  details: string;
  qaReport?: string;
}

export interface QaLatestReportMeta {
  generatedAt?: string;
  reportPath?: string;
}

export interface AiQaFeedbackEntry {
  id: string;
  date?: string;
  category: string;
  title: string;
  details?: string;
  source?: string;
  comments?: string;
}

export interface AiQaLearningRun {
  id: string;
  recordedAt: string;
  itemId: string;
  status: QaChecklistPlanStatus;
  source: AiQaLearningSource;
  workspace: string;
  releaseIds: string[];
  attachmentsCount: number;
  failureReasonProvided: boolean;
  latencyMs: number | null;
  automationId: string | null;
}

export interface AiQaItemHistory {
  runCount: number;
  passCount: number;
  failureCount: number;
  failureRate: number;
  lastStatus: QaChecklistPlanStatus | null;
  lastRecordedAt: string | null;
  automationCount: number;
}

export interface AiQaPlanItem {
  itemId: string;
  mode: QaTesterMode;
  priority: QaTesterPriority;
  score: number;
  confidence: number;
  status: QaChecklistPlanStatus;
  hasAutomation: boolean;
  matchedReleaseIds: string[];
  matchedReleaseTitles: string[];
  matchedFeedbackIds: string[];
  matchedFeedbackTitles: string[];
  history: AiQaItemHistory;
  signals: {
    releaseMatch: boolean;
    feedbackMatch: boolean;
    currentFailure: boolean;
    historicalRisk: boolean;
    automationAvailable: boolean;
    recentPass: boolean;
  };
}

export interface AiQaPlan {
  generatedAt: string;
  releaseEntries: QaReleaseEntry[];
  latestQaGeneratedAt: string | null;
  carryOverFailedCount: number;
  learningRunCount: number;
  autoRunnableItemIds: string[];
  items: AiQaPlanItem[];
}

export interface AiQaReportAttachment {
  name: string;
  path: string;
  source: "file" | "screenshot";
  previewDataUrl?: string | null;
}

export interface AiQaExecutionItemReport {
  itemId: string;
  area: string;
  title: string;
  scenario: string;
  mode: QaTesterMode;
  priority: QaTesterPriority;
  matchedReleaseTitles: string[];
  matchedFeedbackTitles: string[];
  status: AiQaExecutionStatus;
  checkedAt: string | null;
  failureReason: string;
  developerGuidance: string;
  attachments: AiQaReportAttachment[];
}

export interface AiQaExecutionReport {
  id: string;
  generatedAt: string;
  trigger: AiQaRunTrigger;
  releaseIds: string[];
  releaseTitles: string[];
  feedbackIds: string[];
  feedbackTitles: string[];
  summary: {
    total: number;
    automatedPassed: number;
    automatedFailed: number;
    manualRequired: number;
  };
  items: AiQaExecutionItemReport[];
}

export interface AiQaAutoRunState {
  lastRunAt: string | null;
  testedReleaseIds: string[];
  testedFeedbackIds: string[];
  latestReportPath: string | null;
  latestJsonPath: string | null;
  latestTrigger: AiQaRunTrigger | null;
}

const AI_QA_LEARNING_STORAGE_KEY = buildAppStorageKey("ai.qa.learning.v1");
const AI_QA_AUTORUN_STORAGE_KEY = buildAppStorageKey("ai.qa.autorun.v1");
const MAX_LEARNING_RUNS = 600;
const SEARCH_STOPWORDS = new Set([
  "a",
  "all",
  "and",
  "are",
  "as",
  "before",
  "by",
  "de",
  "des",
  "du",
  "et",
  "for",
  "from",
  "inside",
  "into",
  "is",
  "la",
  "le",
  "les",
  "no",
  "of",
  "on",
  "or",
  "stay",
  "the",
  "to",
  "with"
]);

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokenizeText(...parts: string[]): string[] {
  const joined = parts.join(" ");
  if (!joined.trim()) return [];
  return Array.from(
    new Set(
      normalizeText(joined)
        .split(/[^a-z0-9]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3 && !SEARCH_STOPWORDS.has(token))
    )
  );
}

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function buildReleaseWindow(entries: QaReleaseEntry[], latestQaGeneratedAt: string | null): QaReleaseEntry[] {
  const sorted = [...entries].sort((left, right) => {
    const rightTs = parseTimestamp(right.date) ?? 0;
    const leftTs = parseTimestamp(left.date) ?? 0;
    return rightTs - leftTs;
  });

  const latestQaTs = parseTimestamp(latestQaGeneratedAt);
  if (latestQaTs !== null) {
    const newerThanQa = sorted.filter((entry) => {
      const entryTs = parseTimestamp(entry.date);
      return entryTs !== null && entryTs > latestQaTs;
    });
    if (newerThanQa.length > 0) {
      return newerThanQa.slice(0, 4);
    }
  }

  return sorted.slice(0, 3);
}

function getDefaultPriority(item: RegressionChecklistItem): QaTesterPriority {
  return item.aiTester?.priority ?? (item.area === "UI" || item.area === "Workspace" || item.area === "Keyboard" ? "high" : "normal");
}

function getPriorityWeight(priority: QaTesterPriority): number {
  if (priority === "critical") return 4.4;
  if (priority === "high") return 2.8;
  return 1.5;
}

function buildItemHistory(runs: AiQaLearningRun[]): AiQaItemHistory {
  const relevantRuns = [...runs].sort((left, right) => {
    const rightTs = parseTimestamp(right.recordedAt) ?? 0;
    const leftTs = parseTimestamp(left.recordedAt) ?? 0;
    return rightTs - leftTs;
  });
  const passCount = relevantRuns.filter((run) => run.status === "passed").length;
  const failureCount = relevantRuns.filter((run) => run.status === "failed").length;
  const completedRuns = passCount + failureCount;
  return {
    runCount: relevantRuns.length,
    passCount,
    failureCount,
    failureRate:
      completedRuns > 0 ? Number((failureCount / completedRuns).toFixed(2)) : 0,
    lastStatus: relevantRuns[0]?.status ?? null,
    lastRecordedAt: relevantRuns[0]?.recordedAt ?? null,
    automationCount: relevantRuns.filter((run) => run.source === "automation").length
  };
}

function buildReleaseMatchScore(item: RegressionChecklistItem, releaseEntries: QaReleaseEntry[]): {
  score: number;
  matchedReleaseIds: string[];
  matchedReleaseTitles: string[];
} {
  const itemTokens = new Set(
    tokenizeText(
      item.area,
      item.title,
      item.scenario,
      ...(item.aiTester?.tags ?? []),
      ...(item.aiTester?.hints ?? [])
    )
  );
  if (itemTokens.size === 0 || releaseEntries.length === 0) {
    return { score: 0, matchedReleaseIds: [], matchedReleaseTitles: [] };
  }

  const rankedMatches = releaseEntries
    .map((entry) => {
      const releaseText = `${entry.category} ${entry.title} ${entry.details}`;
      const normalizedReleaseText = normalizeText(releaseText);
      const releaseTokens = new Set(tokenizeText(releaseText));
      const sharedTokens = [...itemTokens].filter((token) => releaseTokens.has(token));
      const hintBoost = (item.aiTester?.hints ?? []).reduce((total, hint) => {
        const normalizedHint = normalizeText(hint).trim();
        if (!normalizedHint) return total;
        return normalizedReleaseText.includes(normalizedHint) ? total + 1.8 : total;
      }, 0);
      const tagBoost = (item.aiTester?.tags ?? []).reduce((total, tag) => {
        const normalizedTag = normalizeText(tag).trim();
        if (!normalizedTag) return total;
        return normalizedReleaseText.includes(normalizedTag) ? total + 1.2 : total;
      }, 0);
      return {
        entry,
        score: sharedTokens.length * 0.72 + hintBoost + tagBoost
      };
    })
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score);

  return {
    score: Number(rankedMatches.slice(0, 2).reduce((total, match) => total + match.score, 0).toFixed(2)),
    matchedReleaseIds: rankedMatches.slice(0, 2).map((match) => match.entry.id),
    matchedReleaseTitles: rankedMatches.slice(0, 2).map((match) => match.entry.title)
  };
}

function buildFeedbackMatchScore(item: RegressionChecklistItem, feedbackEntries: AiQaFeedbackEntry[]): {
  score: number;
  matchedFeedbackIds: string[];
  matchedFeedbackTitles: string[];
} {
  const itemTokens = new Set(
    tokenizeText(
      item.area,
      item.title,
      item.scenario,
      ...(item.aiTester?.tags ?? []),
      ...(item.aiTester?.hints ?? [])
    )
  );
  if (itemTokens.size === 0 || feedbackEntries.length === 0) {
    return { score: 0, matchedFeedbackIds: [], matchedFeedbackTitles: [] };
  }

  const rankedMatches = feedbackEntries
    .map((entry) => {
      const feedbackText = `${entry.category} ${entry.title} ${entry.details ?? ""} ${entry.comments ?? ""}`;
      const normalizedFeedbackText = normalizeText(feedbackText);
      const feedbackTokens = new Set(tokenizeText(feedbackText));
      const sharedTokens = [...itemTokens].filter((token) => feedbackTokens.has(token));
      const hintBoost = (item.aiTester?.hints ?? []).reduce((total, hint) => {
        const normalizedHint = normalizeText(hint).trim();
        if (!normalizedHint) return total;
        return normalizedFeedbackText.includes(normalizedHint) ? total + 1.4 : total;
      }, 0);
      const tagBoost = (item.aiTester?.tags ?? []).reduce((total, tag) => {
        const normalizedTag = normalizeText(tag).trim();
        if (!normalizedTag) return total;
        return normalizedFeedbackText.includes(normalizedTag) ? total + 1.1 : total;
      }, 0);
      return {
        entry,
        score: sharedTokens.length * 0.64 + hintBoost + tagBoost
      };
    })
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score);

  return {
    score: Number(rankedMatches.slice(0, 2).reduce((total, match) => total + match.score, 0).toFixed(2)),
    matchedFeedbackIds: rankedMatches.slice(0, 2).map((match) => match.entry.id),
    matchedFeedbackTitles: rankedMatches.slice(0, 2).map((match) => match.entry.title)
  };
}

function getAreaFixFocus(item: RegressionChecklistItem): string {
  if (item.area === "Tree") {
    return "Inspect tree keyboard handlers, parent/child routing, numbering refresh, and selection restoration.";
  }
  if (item.area === "Desktop") {
    return "Inspect current-folder routing, grid/details/mind-map state sync, and desktop drop/import target resolution.";
  }
  if (item.area === "Timeline") {
    return "Inspect visible timeline-parent routing, row selection state, schedule persistence, and scroll stability.";
  }
  if (item.area === "Workspace") {
    return "Inspect workspace scoping, root-node guards, workspace switching, and linked-folder synchronization.";
  }
  if (item.area === "Favorites") {
    return "Inspect favorite group persistence, tab rendering, and selection mapping updates.";
  }
  if (item.area === "Keyboard") {
    return "Inspect keydown handlers, focus anchors, range-selection math, active-surface routing, inline-edit ownership, and native Windows-like text-input behavior.";
  }
  return "Inspect modal/window lifecycle, command routing, event listeners, and UI state synchronization.";
}

function hasWindowsInteractionSignal(item: RegressionChecklistItem): boolean {
  if (item.area === "Keyboard") return true;
  const source = normalizeText(
    [item.area, item.title, item.scenario, ...(item.aiTester?.tags ?? []), ...(item.aiTester?.hints ?? [])].join(" ")
  );
  return [
    "windows behavior",
    "keyboard",
    "selection",
    "surface routing",
    "surface ownership",
    "clipboard",
    "multi-select",
    "f2",
    "rename"
  ].some((token) => source.includes(token));
}

export function buildAiQaDeveloperGuidance(input: {
  item: RegressionChecklistItem;
  matchedReleaseTitles?: string[];
  matchedFeedbackTitles?: string[];
  failureReason?: string;
  evidencePaths?: string[];
}): string {
  const releaseContext =
    input.matchedReleaseTitles && input.matchedReleaseTitles.length > 0
      ? `Release context: ${input.matchedReleaseTitles.join("; ")}.`
      : "";
  const feedbackContext =
    input.matchedFeedbackTitles && input.matchedFeedbackTitles.length > 0
      ? `Client feedback context: ${input.matchedFeedbackTitles.join("; ")}.`
      : "";
  const evidenceContext =
    input.evidencePaths && input.evidencePaths.length > 0
      ? `Evidence: ${input.evidencePaths.join("; ")}.`
      : "";
  const failureContext = input.failureReason?.trim()
    ? `Observed failure: ${input.failureReason.trim()}.`
    : "Observed failure: reproduce the scenario and confirm the break before changing code.";
  return [
    `Fix checklist item "${input.item.title}".`,
    `Expected behavior: ${input.item.scenario}`,
    releaseContext,
    feedbackContext,
    failureContext,
    getAreaFixFocus(input.item),
    "Update or add automation for this checklist item after the fix so the next release can verify it automatically.",
    evidenceContext
  ]
    .filter(Boolean)
    .join(" ");
}

export function readAiQaAutoRunState(): AiQaAutoRunState {
  if (typeof window === "undefined") {
    return {
      lastRunAt: null,
      testedReleaseIds: [],
      testedFeedbackIds: [],
      latestReportPath: null,
      latestJsonPath: null,
      latestTrigger: null
    };
  }
  try {
    const raw = window.localStorage.getItem(AI_QA_AUTORUN_STORAGE_KEY);
    if (!raw) {
      return {
        lastRunAt: null,
        testedReleaseIds: [],
        testedFeedbackIds: [],
        latestReportPath: null,
        latestJsonPath: null,
        latestTrigger: null
      };
    }
    const parsed = JSON.parse(raw) as Partial<AiQaAutoRunState>;
    return {
      lastRunAt: typeof parsed.lastRunAt === "string" ? parsed.lastRunAt : null,
      testedReleaseIds: Array.isArray(parsed.testedReleaseIds)
        ? parsed.testedReleaseIds.filter((value): value is string => typeof value === "string")
        : [],
      testedFeedbackIds: Array.isArray(parsed.testedFeedbackIds)
        ? parsed.testedFeedbackIds.filter((value): value is string => typeof value === "string")
        : [],
      latestReportPath: typeof parsed.latestReportPath === "string" ? parsed.latestReportPath : null,
      latestJsonPath: typeof parsed.latestJsonPath === "string" ? parsed.latestJsonPath : null,
      latestTrigger:
        parsed.latestTrigger === "manual" || parsed.latestTrigger === "automatic" ? parsed.latestTrigger : null
    };
  } catch {
    return {
      lastRunAt: null,
      testedReleaseIds: [],
      testedFeedbackIds: [],
      latestReportPath: null,
      latestJsonPath: null,
      latestTrigger: null
    };
  }
}

export function writeAiQaAutoRunState(nextState: AiQaAutoRunState): AiQaAutoRunState {
  if (typeof window === "undefined") return nextState;
  try {
    window.localStorage.setItem(AI_QA_AUTORUN_STORAGE_KEY, JSON.stringify(nextState));
  } catch {
    // Auto-run state persistence is best-effort only.
  }
  return nextState;
}

export function shouldAutoRunAiTester(
  releaseIds: string[],
  feedbackIds: string[],
  state: AiQaAutoRunState
): boolean {
  if (releaseIds.length === 0 && feedbackIds.length === 0) return false;
  const testedReleaseIds = new Set(state.testedReleaseIds);
  const testedFeedbackIds = new Set(state.testedFeedbackIds);
  return (
    releaseIds.some((releaseId) => !testedReleaseIds.has(releaseId)) ||
    feedbackIds.some((feedbackId) => !testedFeedbackIds.has(feedbackId))
  );
}

export function readAiQaLearningRuns(): AiQaLearningRun[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(AI_QA_LEARNING_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is AiQaLearningRun => Boolean(entry) && typeof entry === "object")
      .slice(-MAX_LEARNING_RUNS);
  } catch {
    return [];
  }
}

export function appendAiQaLearningRun(
  run: Omit<AiQaLearningRun, "id" | "recordedAt"> & { recordedAt?: string }
): AiQaLearningRun {
  const nextRun: AiQaLearningRun = {
    id: `aiqatest_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
    recordedAt: run.recordedAt ?? new Date().toISOString(),
    ...run
  };

  if (typeof window === "undefined") {
    return nextRun;
  }

  try {
    const current = readAiQaLearningRuns();
    const next = [...current, nextRun].slice(-MAX_LEARNING_RUNS);
    window.localStorage.setItem(AI_QA_LEARNING_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Learning traces are best-effort only.
  }

  return nextRun;
}

export function buildAiQaPlan(input: {
  items: RegressionChecklistItem[];
  checklistStateById: Record<string, QaChecklistPlanStateEntry>;
  learningRuns: AiQaLearningRun[];
  releaseEntries: QaReleaseEntry[];
  feedbackEntries?: AiQaFeedbackEntry[];
  latestQaMeta?: QaLatestReportMeta | null;
  automatableItemIds: string[];
}): AiQaPlan {
  const releaseEntries = buildReleaseWindow(input.releaseEntries, input.latestQaMeta?.generatedAt ?? null);
  const feedbackEntries = Array.isArray(input.feedbackEntries) ? input.feedbackEntries : [];
  const learningRunMap = new Map<string, AiQaLearningRun[]>();
  for (const run of input.learningRuns) {
    const current = learningRunMap.get(run.itemId);
    if (current) {
      current.push(run);
    } else {
      learningRunMap.set(run.itemId, [run]);
    }
  }

  const autoIdSet = new Set(input.automatableItemIds);
  const planItems = input.items
    .map((item) => {
      const statusEntry = input.checklistStateById[item.id];
      const status = statusEntry?.status ?? "pending";
      const history = buildItemHistory(learningRunMap.get(item.id) ?? []);
      const releaseMatch = buildReleaseMatchScore(item, releaseEntries);
      const feedbackMatch = buildFeedbackMatchScore(item, feedbackEntries);
      const hasAutomation = autoIdSet.has(item.id) || item.aiTester?.mode === "automated";
      const mode = item.aiTester?.mode ?? (hasAutomation ? "automated" : "manual");
      const priority = getDefaultPriority(item);

      let score = getPriorityWeight(priority);
      score += releaseMatch.score;
      score += feedbackMatch.score;
      if (hasWindowsInteractionSignal(item)) score += 0.85;
      if (status === "failed") score += 3.2;
      else if (status === "pending") score += 0.9;
      else score += 0.3;
      if (hasAutomation) score += 1.1;
      if (history.failureCount > 0) {
        score += Math.min(2.8, history.failureRate * 3.1 + Math.min(1.2, history.failureCount * 0.3));
      }
      if (history.lastStatus === "passed" && releaseMatch.score === 0 && history.failureRate === 0) {
        score -= 0.5;
      }

      const confidence = Number(
        Math.max(
          0.2,
          Math.min(
            0.98,
            0.28 +
              Math.min(0.28, releaseMatch.score / 7) +
              Math.min(0.12, feedbackMatch.score / 5) +
              Math.min(0.16, history.runCount / 12) +
              (hasAutomation ? 0.1 : 0) +
              (status === "failed" ? 0.1 : 0)
          )
        ).toFixed(2)
      );

      return {
        itemId: item.id,
        mode,
        priority,
        score: Number(score.toFixed(2)),
        confidence,
        status,
        hasAutomation,
        matchedReleaseIds: releaseMatch.matchedReleaseIds,
        matchedReleaseTitles: releaseMatch.matchedReleaseTitles,
        matchedFeedbackIds: feedbackMatch.matchedFeedbackIds,
        matchedFeedbackTitles: feedbackMatch.matchedFeedbackTitles,
        history,
        signals: {
          releaseMatch: releaseMatch.matchedReleaseIds.length > 0,
          feedbackMatch: feedbackMatch.matchedFeedbackIds.length > 0,
          currentFailure: status === "failed",
          historicalRisk: history.failureRate >= 0.34 || history.failureCount >= 2,
          automationAvailable: hasAutomation,
          recentPass: history.lastStatus === "passed"
        }
      } satisfies AiQaPlanItem;
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.itemId.localeCompare(right.itemId);
    });

  return {
    generatedAt: new Date().toISOString(),
    releaseEntries,
    latestQaGeneratedAt: input.latestQaMeta?.generatedAt ?? null,
    carryOverFailedCount: input.items.filter(
      (item) => (input.checklistStateById[item.id]?.status ?? "pending") === "failed"
    ).length,
    learningRunCount: input.learningRuns.length,
    autoRunnableItemIds: planItems
      .filter((item) => item.hasAutomation && item.score >= 4.2)
      .map((item) => item.itemId),
    items: planItems
  };
}
