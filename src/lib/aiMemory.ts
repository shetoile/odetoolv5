import type {
  ODEIntegratedPlanProposal,
  ODEIntegratedPlanStructureNode,
  ScheduleStatus
} from "@/lib/types";
import type { LanguageCode } from "@/lib/i18n";
import { buildAppStorageKey } from "@/lib/appIdentity";

const APPROVED_INTEGRATED_PLAN_MEMORY_KEY = buildAppStorageKey("ai.memory.integrated-plans.v1");
const MAX_APPROVED_INTEGRATED_PLAN_MEMORIES = 48;

export interface ApprovedIntegratedPlanMemoryTask {
  title: string;
  ownerName?: string | null;
  dueDate?: string | null;
  status: ScheduleStatus;
  flagged: boolean;
  note?: string | null;
}

export interface ApprovedIntegratedPlanMemoryDeliverable {
  title: string;
  rationale?: string | null;
  tasks: ApprovedIntegratedPlanMemoryTask[];
}

export interface ApprovedIntegratedPlanMemoryEntry {
  id: string;
  approvedAt: string;
  nodeId: string;
  nodeTitle: string;
  outputLanguage: LanguageCode;
  description: string;
  objective: string;
  structureTitles: string[];
  deliverables: ApprovedIntegratedPlanMemoryDeliverable[];
  sourceLabels: string[];
}

interface BuildApprovedIntegratedPlanMemoryEntryInput {
  nodeId: string;
  nodeTitle: string;
  description: string;
  objective: string;
  proposal: ODEIntegratedPlanProposal;
}

interface FindApprovedIntegratedPlanMemoryInput {
  nodeTitle: string;
  description: string;
  objective?: string;
  targetLanguage?: LanguageCode;
  limit?: number;
}

interface BuildApprovedIntegratedPlanExamplesSummaryOptions {
  deliverableTitle?: string;
  maxExamples?: number;
  maxDeliverablesPerExample?: number;
  maxTasksPerDeliverable?: number;
  maxChars?: number;
}

function flattenStructureTitles(nodes: ODEIntegratedPlanStructureNode[], titles: string[] = []): string[] {
  for (const node of nodes) {
    const title = node.title.trim();
    if (title) {
      titles.push(title);
    }
    if (node.children.length > 0) {
      flattenStructureTitles(node.children, titles);
    }
  }
  return titles;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeScheduleStatus(value: unknown): ScheduleStatus {
  if (value === "active" || value === "blocked" || value === "done") return value;
  return "planned";
}

function normalizeMemoryTask(value: unknown): ApprovedIntegratedPlanMemoryTask | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const title = normalizeText(record.title);
  if (!title) return null;
  return {
    title,
    ownerName: normalizeText(record.ownerName) || null,
    dueDate: normalizeText(record.dueDate) || null,
    status: normalizeScheduleStatus(record.status),
    flagged: record.flagged === true,
    note: normalizeText(record.note) || null
  };
}

function normalizeMemoryDeliverable(value: unknown): ApprovedIntegratedPlanMemoryDeliverable | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const title = normalizeText(record.title);
  if (!title) return null;
  const tasks = Array.isArray(record.tasks)
    ? record.tasks.map((item) => normalizeMemoryTask(item)).filter((item): item is ApprovedIntegratedPlanMemoryTask => Boolean(item))
    : [];
  return {
    title,
    rationale: normalizeText(record.rationale) || null,
    tasks
  };
}

function normalizeMemoryEntry(value: unknown): ApprovedIntegratedPlanMemoryEntry | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const nodeId = normalizeText(record.nodeId);
  const nodeTitle = normalizeText(record.nodeTitle);
  if (!nodeId || !nodeTitle) return null;
  const deliverables = Array.isArray(record.deliverables)
    ? record.deliverables
        .map((item) => normalizeMemoryDeliverable(item))
        .filter((item): item is ApprovedIntegratedPlanMemoryDeliverable => Boolean(item))
    : [];
  return {
    id: normalizeText(record.id) || `approved-plan-${nodeId}`,
    approvedAt: normalizeText(record.approvedAt) || new Date().toISOString(),
    nodeId,
    nodeTitle,
    outputLanguage:
      record.outputLanguage === "FR" || record.outputLanguage === "EN" || record.outputLanguage === "DE" || record.outputLanguage === "ES"
        ? record.outputLanguage
        : "EN",
    description: normalizeText(record.description),
    objective: normalizeText(record.objective),
    structureTitles: Array.isArray(record.structureTitles)
      ? record.structureTitles.map((item) => normalizeText(item)).filter((item) => item.length > 0)
      : [],
    deliverables,
    sourceLabels: Array.isArray(record.sourceLabels)
      ? record.sourceLabels.map((item) => normalizeText(item)).filter((item) => item.length > 0)
      : []
  };
}

function readRawApprovedIntegratedPlanMemories(): ApprovedIntegratedPlanMemoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(APPROVED_INTEGRATED_PLAN_MEMORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => normalizeMemoryEntry(entry))
      .filter((entry): entry is ApprovedIntegratedPlanMemoryEntry => Boolean(entry));
  } catch {
    return [];
  }
}

function writeApprovedIntegratedPlanMemories(entries: ApprovedIntegratedPlanMemoryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(APPROVED_INTEGRATED_PLAN_MEMORY_KEY, JSON.stringify(entries));
  } catch {
    // Memory persistence is best-effort only.
  }
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9\u00c0-\u024f]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function computeTokenOverlapScore(left: string, right: string): number {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }
  return overlap / Math.max(1, Math.min(leftTokens.size, rightTokens.size));
}

function buildEntrySearchText(entry: ApprovedIntegratedPlanMemoryEntry): string {
  const deliverableTitles = entry.deliverables.map((deliverable) => deliverable.title).join(" ");
  const taskTitles = entry.deliverables
    .flatMap((deliverable) => deliverable.tasks.map((task) => task.title))
    .join(" ");
  return [
    entry.nodeTitle,
    entry.description,
    entry.objective,
    entry.structureTitles.join(" "),
    deliverableTitles,
    taskTitles,
    entry.sourceLabels.join(" ")
  ]
    .join(" ")
    .trim();
}

function trimForPrompt(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit).trim()}...`;
}

export function buildApprovedIntegratedPlanMemoryEntry(
  input: BuildApprovedIntegratedPlanMemoryEntryInput
): ApprovedIntegratedPlanMemoryEntry {
  return {
    id: `approved-plan-${input.nodeId}`,
    approvedAt: new Date().toISOString(),
    nodeId: input.nodeId,
    nodeTitle: input.nodeTitle.trim(),
    outputLanguage: input.proposal.outputLanguage,
    description: input.description.trim(),
    objective: input.objective.trim(),
    structureTitles: flattenStructureTitles(input.proposal.structure.nodes),
    deliverables: input.proposal.deliverables.map((deliverable) => {
      const tasksSection = deliverable.taskProposal.sections.find((section) => section.type === "tasks");
      const tasks = tasksSection?.items ?? [];
      return {
        title: deliverable.title.trim(),
        rationale: deliverable.rationale?.trim() || null,
        tasks: tasks.map((task) => ({
          title: task.title.trim(),
          ownerName: task.ownerName?.trim() || null,
          dueDate: task.dueDate?.trim() || null,
          status: task.status,
          flagged: task.flagged,
          note: task.note?.trim() || null
        }))
      };
    }),
    sourceLabels: input.proposal.sources
      .map((source) => source.label.trim())
      .filter((label) => label.length > 0)
  };
}

export function readApprovedIntegratedPlanMemories(): ApprovedIntegratedPlanMemoryEntry[] {
  return readRawApprovedIntegratedPlanMemories()
    .sort((left, right) => right.approvedAt.localeCompare(left.approvedAt));
}

export function appendApprovedIntegratedPlanMemory(entry: ApprovedIntegratedPlanMemoryEntry) {
  const existing = readRawApprovedIntegratedPlanMemories().filter((item) => item.nodeId !== entry.nodeId);
  existing.push(entry);
  const nextEntries = existing
    .sort((left, right) => right.approvedAt.localeCompare(left.approvedAt))
    .slice(0, MAX_APPROVED_INTEGRATED_PLAN_MEMORIES);
  writeApprovedIntegratedPlanMemories(nextEntries);
}

export function removeApprovedIntegratedPlanMemory(entryId: string) {
  const existing = readRawApprovedIntegratedPlanMemories();
  const nextEntries = existing.filter((entry) => entry.id !== entryId);
  writeApprovedIntegratedPlanMemories(nextEntries);
}

export function clearApprovedIntegratedPlanMemories() {
  writeApprovedIntegratedPlanMemories([]);
}

export function findRelevantApprovedIntegratedPlans(
  input: FindApprovedIntegratedPlanMemoryInput
): ApprovedIntegratedPlanMemoryEntry[] {
  const query = [input.nodeTitle, input.description, input.objective ?? ""].join(" ").trim();
  const limit = Math.max(1, input.limit ?? 3);
  return readApprovedIntegratedPlanMemories()
    .map((entry) => ({
      entry,
      score: computeTokenOverlapScore(query, buildEntrySearchText(entry))
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      const rightLanguageBoost =
        input.targetLanguage && right.entry.outputLanguage === input.targetLanguage ? 1 : 0;
      const leftLanguageBoost =
        input.targetLanguage && left.entry.outputLanguage === input.targetLanguage ? 1 : 0;
      if (rightLanguageBoost !== leftLanguageBoost) return rightLanguageBoost - leftLanguageBoost;
      if (right.score !== left.score) return right.score - left.score;
      return right.entry.approvedAt.localeCompare(left.entry.approvedAt);
    })
    .slice(0, limit)
    .map((item) => item.entry);
}

export function buildApprovedIntegratedPlanExamplesSummary(
  entries: ApprovedIntegratedPlanMemoryEntry[],
  options: BuildApprovedIntegratedPlanExamplesSummaryOptions = {}
): string {
  if (entries.length === 0) return "";

  const maxExamples = Math.max(1, options.maxExamples ?? 3);
  const maxDeliverablesPerExample = Math.max(1, options.maxDeliverablesPerExample ?? 3);
  const maxTasksPerDeliverable = Math.max(1, options.maxTasksPerDeliverable ?? 4);
  const maxChars = Math.max(500, options.maxChars ?? 2600);
  const targetDeliverableTitle = options.deliverableTitle?.trim() ?? "";
  const blocks: string[] = [];

  for (const [index, entry] of entries.slice(0, maxExamples).entries()) {
    const lines: string[] = [`Approved example ${index + 1} [${entry.outputLanguage}]: ${entry.nodeTitle}`];

    if (entry.description) {
      lines.push(`Brief: ${trimForPrompt(entry.description, 220)}`);
    }

    if (!targetDeliverableTitle) {
      if (entry.structureTitles.length > 0) {
        lines.push(`Structure: ${entry.structureTitles.slice(0, 8).join(" > ")}`);
      }
      if (entry.deliverables.length > 0) {
        lines.push("Deliverables:");
        for (const deliverable of entry.deliverables.slice(0, maxDeliverablesPerExample)) {
          const taskTitles = deliverable.tasks.slice(0, maxTasksPerDeliverable).map((task) => task.title);
          lines.push(`- ${deliverable.title}`);
          if (taskTitles.length > 0) {
            lines.push(`  Starter tasks: ${taskTitles.join("; ")}`);
          }
        }
      }
    } else {
      const rankedDeliverables = [...entry.deliverables]
        .map((deliverable) => ({
          deliverable,
          score: computeTokenOverlapScore(targetDeliverableTitle, deliverable.title)
        }))
        .sort((left, right) => right.score - left.score);
      const matchingDeliverables = rankedDeliverables
        .filter((item) => item.score > 0)
        .slice(0, maxDeliverablesPerExample)
        .map((item) => item.deliverable);
      const deliverablesToUse =
        matchingDeliverables.length > 0
          ? matchingDeliverables
          : entry.deliverables.slice(0, Math.min(1, maxDeliverablesPerExample));

      if (deliverablesToUse.length > 0) {
        lines.push("Relevant deliverable patterns:");
        for (const deliverable of deliverablesToUse) {
          lines.push(`- ${deliverable.title}`);
          const taskTitles = deliverable.tasks.slice(0, maxTasksPerDeliverable).map((task) => task.title);
          if (taskTitles.length > 0) {
            lines.push(`  Tasks: ${taskTitles.join("; ")}`);
          }
        }
      }
    }

    const block = lines.join("\n");
    const nextValue = blocks.length > 0 ? `${blocks.join("\n\n")}\n\n${block}` : block;
    if (nextValue.length > maxChars) break;
    blocks.push(block);
  }

  return blocks.join("\n\n");
}
