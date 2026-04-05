import type { WBSNode } from "@/lib/aiService";
import type { LanguageCode } from "@/lib/i18n";
import { buildAppStorageKey } from "@/lib/appIdentity";

const APPROVED_DOCUMENT_TREE_MEMORY_KEY = buildAppStorageKey("ai.memory.document-trees.v1");
const MAX_APPROVED_DOCUMENT_TREE_MEMORIES = 48;

export interface ApprovedDocumentTreeMemoryEntry {
  id: string;
  approvedAt: string;
  targetNodeId: string;
  documentName: string;
  goal: string;
  outputLanguage: LanguageCode;
  sourceLabels: string[];
  notes: string;
  nodes: WBSNode[];
}

interface BuildApprovedDocumentTreeMemoryEntryInput {
  targetNodeId: string;
  documentName: string;
  goal: string;
  outputLanguage: LanguageCode;
  sourceLabels: string[];
  notes?: string;
  nodes: WBSNode[];
}

interface FindApprovedDocumentTreeMemoriesInput {
  goal: string;
  documentName?: string;
  targetLanguage?: LanguageCode;
  limit?: number;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLanguage(value: unknown): LanguageCode {
  return value === "FR" || value === "DE" || value === "ES" ? value : "EN";
}

function normalizeWbsNode(value: unknown): WBSNode | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const title = normalizeText(record.title);
  if (!title) return null;
  return {
    title,
    description: normalizeText(record.description) || undefined,
    objective: normalizeText(record.objective) || undefined,
    expected_deliverables: Array.isArray(record.expected_deliverables)
      ? record.expected_deliverables.map((item) => normalizeText(item)).filter((item) => item.length > 0).slice(0, 12)
      : [],
    prerequisites: Array.isArray(record.prerequisites)
      ? record.prerequisites.map((item) => normalizeText(item)).filter((item) => item.length > 0).slice(0, 20)
      : [],
    estimated_effort: normalizeText(record.estimated_effort) || "S",
    suggested_role: normalizeText(record.suggested_role) || "Owner",
    value_milestone: record.value_milestone === true,
    source_code: normalizeText(record.source_code) || undefined,
    children: Array.isArray(record.children)
      ? record.children.map((item) => normalizeWbsNode(item)).filter((item): item is WBSNode => Boolean(item)).slice(0, 20)
      : []
  };
}

function normalizeWbsNodes(values: unknown): WBSNode[] {
  if (!Array.isArray(values)) return [];
  return values.map((item) => normalizeWbsNode(item)).filter((item): item is WBSNode => Boolean(item)).slice(0, 24);
}

function normalizeEntry(value: unknown): ApprovedDocumentTreeMemoryEntry | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const targetNodeId = normalizeText(record.targetNodeId);
  const documentName = normalizeText(record.documentName);
  const goal = normalizeText(record.goal);
  const nodes = normalizeWbsNodes(record.nodes);
  if (!targetNodeId || !documentName || !goal || nodes.length === 0) return null;
  return {
    id: normalizeText(record.id) || `tree-memory-${targetNodeId}`,
    approvedAt: normalizeText(record.approvedAt) || new Date().toISOString(),
    targetNodeId,
    documentName,
    goal,
    outputLanguage: normalizeLanguage(record.outputLanguage),
    sourceLabels: Array.isArray(record.sourceLabels)
      ? record.sourceLabels.map((item) => normalizeText(item)).filter((item) => item.length > 0)
      : [],
    notes: normalizeText(record.notes),
    nodes
  };
}

function readRawApprovedDocumentTreeMemories(): ApprovedDocumentTreeMemoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(APPROVED_DOCUMENT_TREE_MEMORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => normalizeEntry(entry)).filter((entry): entry is ApprovedDocumentTreeMemoryEntry => Boolean(entry));
  } catch {
    return [];
  }
}

function writeApprovedDocumentTreeMemories(entries: ApprovedDocumentTreeMemoryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(APPROVED_DOCUMENT_TREE_MEMORY_KEY, JSON.stringify(entries));
  } catch {
    // Local AI memory is best-effort only.
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

function collectTreePaths(nodes: WBSNode[], prefix: string[] = [], lines: string[] = []): string[] {
  for (const node of nodes) {
    const path = [...prefix, node.title.trim()].filter((part) => part.length > 0);
    if (path.length > 0) {
      lines.push(path.join(" > "));
    }
    if (node.children.length > 0) {
      collectTreePaths(node.children, path, lines);
    }
  }
  return lines;
}

function buildEntrySearchText(entry: ApprovedDocumentTreeMemoryEntry): string {
  return [
    entry.documentName,
    entry.goal,
    entry.notes,
    entry.sourceLabels.join(" "),
    collectTreePaths(entry.nodes).join(" ")
  ]
    .join(" ")
    .trim();
}

function trimForPrompt(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit).trim()}...`;
}

export function buildApprovedDocumentTreeMemoryEntry(
  input: BuildApprovedDocumentTreeMemoryEntryInput
): ApprovedDocumentTreeMemoryEntry {
  return {
    id: `tree-memory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    approvedAt: new Date().toISOString(),
    targetNodeId: input.targetNodeId,
    documentName: input.documentName.trim(),
    goal: input.goal.trim(),
    outputLanguage: input.outputLanguage,
    sourceLabels: input.sourceLabels.map((item) => item.trim()).filter((item) => item.length > 0),
    notes: input.notes?.trim() ?? "",
    nodes: normalizeWbsNodes(input.nodes)
  };
}

export function readApprovedDocumentTreeMemories(): ApprovedDocumentTreeMemoryEntry[] {
  return readRawApprovedDocumentTreeMemories().sort((left, right) => right.approvedAt.localeCompare(left.approvedAt));
}

export function appendApprovedDocumentTreeMemory(entry: ApprovedDocumentTreeMemoryEntry) {
  const nextEntries = [entry, ...readRawApprovedDocumentTreeMemories()]
    .sort((left, right) => right.approvedAt.localeCompare(left.approvedAt))
    .slice(0, MAX_APPROVED_DOCUMENT_TREE_MEMORIES);
  writeApprovedDocumentTreeMemories(nextEntries);
}

export function updateApprovedDocumentTreeMemory(updatedEntry: ApprovedDocumentTreeMemoryEntry) {
  const existingEntries = readRawApprovedDocumentTreeMemories();
  const hasExisting = existingEntries.some((entry) => entry.id === updatedEntry.id);
  const nextEntries = (hasExisting
    ? existingEntries.map((entry) => (entry.id === updatedEntry.id ? updatedEntry : entry))
    : [updatedEntry, ...existingEntries])
    .sort((left, right) => right.approvedAt.localeCompare(left.approvedAt))
    .slice(0, MAX_APPROVED_DOCUMENT_TREE_MEMORIES);
  writeApprovedDocumentTreeMemories(nextEntries);
}

export function removeApprovedDocumentTreeMemory(entryId: string) {
  writeApprovedDocumentTreeMemories(readRawApprovedDocumentTreeMemories().filter((entry) => entry.id !== entryId));
}

export function clearApprovedDocumentTreeMemories() {
  writeApprovedDocumentTreeMemories([]);
}

export function findRelevantApprovedDocumentTreeMemories(
  input: FindApprovedDocumentTreeMemoriesInput
): ApprovedDocumentTreeMemoryEntry[] {
  const limit = Math.max(1, input.limit ?? 3);
  const query = [input.goal, input.documentName ?? ""].join(" ").trim();
  return readApprovedDocumentTreeMemories()
    .map((entry) => ({
      entry,
      score: computeTokenOverlapScore(query, buildEntrySearchText(entry))
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      const rightLanguageBoost = input.targetLanguage && right.entry.outputLanguage === input.targetLanguage ? 1 : 0;
      const leftLanguageBoost = input.targetLanguage && left.entry.outputLanguage === input.targetLanguage ? 1 : 0;
      if (rightLanguageBoost !== leftLanguageBoost) return rightLanguageBoost - leftLanguageBoost;
      if (right.score !== left.score) return right.score - left.score;
      return right.entry.approvedAt.localeCompare(left.entry.approvedAt);
    })
    .slice(0, limit)
    .map((item) => item.entry);
}

export function buildApprovedDocumentTreeExamplesSummary(
  entries: ApprovedDocumentTreeMemoryEntry[],
  options: { maxExamples?: number; maxPathsPerExample?: number; maxChars?: number } = {}
): string {
  if (entries.length === 0) return "";
  const maxExamples = Math.max(1, options.maxExamples ?? 3);
  const maxPathsPerExample = Math.max(3, options.maxPathsPerExample ?? 10);
  const maxChars = Math.max(600, options.maxChars ?? 2600);
  const blocks: string[] = [];

  for (const [index, entry] of entries.slice(0, maxExamples).entries()) {
    const paths = collectTreePaths(entry.nodes).slice(0, maxPathsPerExample);
    const lines = [`Approved tree memory ${index + 1} [${entry.outputLanguage}]: ${entry.goal}`];
    if (entry.notes) {
      lines.push(`Guidance: ${trimForPrompt(entry.notes, 260)}`);
    }
    if (paths.length > 0) {
      lines.push("Structure:");
      for (const path of paths) {
        lines.push(`- ${trimForPrompt(path, 220)}`);
      }
    }
    blocks.push(lines.join("\n"));
  }

  const combined = blocks.join("\n\n");
  return combined.length <= maxChars ? combined : `${combined.slice(0, maxChars).trim()}...`;
}
