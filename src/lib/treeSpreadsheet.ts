import type { WBSNode } from "@/lib/aiService";
import type { ApprovedDocumentTreeMemoryEntry } from "@/lib/aiTreeMemory";
import type { LanguageCode } from "@/lib/i18n";
import type { AppNode, NodeType, ODEExecutionTaskItem, ODEStructuredDeliverable } from "@/lib/types";

export type TreeSpreadsheetCompatibleNodeType = Exclude<NodeType, "file">;

export interface TreeSpreadsheetMeta {
  title?: string | null;
  goal?: string | null;
  documentName?: string | null;
  outputLanguage?: LanguageCode | null;
  notes?: string | null;
  sourceLabels?: string[];
}

export interface TreeSpreadsheetRow {
  number?: string | null;
  level?: number | null;
  title: string;
  description?: string | null;
  deliverables?: string[];
  deliverableTasks?: Array<{
    deliverable: string;
    tasks: string[];
  }>;
}

export interface TreeSpreadsheetPayload {
  meta?: TreeSpreadsheetMeta | null;
  rows: TreeSpreadsheetRow[];
}

export interface SpreadsheetTreeNode {
  title: string;
  description?: string | null;
  deliverables?: string[];
  deliverableTasks?: Array<{
    deliverable: string;
    tasks: string[];
  }>;
  children: SpreadsheetTreeNode[];
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLanguage(value: unknown): LanguageCode | null {
  return value === "EN" || value === "FR" || value === "DE" || value === "ES" ? value : null;
}

function normalizeDeliverables(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter((item) => item.length > 0).slice(0, 32);
  }
  if (typeof value !== "string") return [];
  return value
    .split(/\r?\n|[|;]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 32);
}

function normalizeLevel(value: unknown, numberLabel?: string | null): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 1) {
    return Math.max(1, Math.floor(value));
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed) && parsed >= 1) {
      return parsed;
    }
  }
  if (typeof numberLabel === "string" && numberLabel.trim().length > 0) {
    return numberLabel
      .split(".")
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0).length;
  }
  return 1;
}

function readStructuredDeliverables(node: AppNode): Array<{ deliverable: string; tasks: string[] }> {
  const structured = node.properties?.odeStructuredDeliverables;
  if (Array.isArray(structured)) {
    const deliverables = structured
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const record = item as ODEStructuredDeliverable;
        const deliverable = normalizeText(record.title);
        if (!deliverable) return null;
        const tasks = Array.isArray(record.tasks)
          ? record.tasks
              .map((task) => {
                if (!task || typeof task !== "object") return "";
                return normalizeText((task as ODEExecutionTaskItem).title);
              })
              .filter((taskTitle) => taskTitle.length > 0)
              .slice(0, 64)
          : [];
        return { deliverable, tasks };
      })
      .filter((entry): entry is { deliverable: string; tasks: string[] } => Boolean(entry))
      .slice(0, 32);
    if (deliverables.length > 0) return deliverables;
  }
  const expected = node.properties?.odeExpectedDeliverables;
  return normalizeDeliverables(expected).map((deliverable) => ({ deliverable, tasks: [] }));
}

function buildChildrenMap(nodes: AppNode[]): Map<string, AppNode[]> {
  const childrenByParent = new Map<string, AppNode[]>();
  for (const node of nodes) {
    const current = childrenByParent.get(node.parentId) ?? [];
    current.push(node);
    childrenByParent.set(node.parentId, current);
  }
  for (const children of childrenByParent.values()) {
    children.sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
  }
  return childrenByParent;
}

function buildSpreadsheetTreeFromAppNode(
  node: AppNode,
  childrenByParent: Map<string, AppNode[]>
): SpreadsheetTreeNode {
  const children = (childrenByParent.get(node.id) ?? [])
    .filter((child) => child.type !== "file")
    .map((child) => buildSpreadsheetTreeFromAppNode(child, childrenByParent));

  return {
    title: node.name.trim(),
    description: node.description?.trim() || null,
    deliverables: readStructuredDeliverables(node).map((entry) => entry.deliverable),
    deliverableTasks: readStructuredDeliverables(node),
    children
  };
}

function buildSpreadsheetRow(node: SpreadsheetTreeNode, level: number, numberLabel: string): TreeSpreadsheetRow {
  return {
    number: numberLabel,
    level,
    title: node.title.trim(),
    description: node.description?.trim() || null,
    deliverables: (node.deliverables ?? []).map((item) => item.trim()).filter((item) => item.length > 0),
    deliverableTasks: (node.deliverableTasks ?? [])
      .map((entry) => ({
        deliverable: entry.deliverable.trim(),
        tasks: entry.tasks.map((task) => task.trim()).filter((task) => task.length > 0)
      }))
      .filter((entry) => entry.deliverable.length > 0)
  };
}

function flattenSpreadsheetTreeNodes(
  nodes: SpreadsheetTreeNode[],
  parentNumber = "",
  level = 1,
  rows: TreeSpreadsheetRow[] = []
): TreeSpreadsheetRow[] {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const numberLabel = parentNumber ? `${parentNumber}.${index + 1}` : `${index + 1}`;
    rows.push(buildSpreadsheetRow(node, level, numberLabel));
    if (node.children.length > 0) {
      flattenSpreadsheetTreeNodes(node.children, numberLabel, level + 1, rows);
    }
  }
  return rows;
}

function normalizeMeta(meta: unknown): TreeSpreadsheetMeta | null {
  if (!meta || typeof meta !== "object") return null;
  const record = meta as Record<string, unknown>;
  const sourceLabels = Array.isArray(record.sourceLabels)
    ? record.sourceLabels.map((item) => normalizeText(item)).filter((item) => item.length > 0)
    : [];
  return {
    title: normalizeText(record.title) || null,
    goal: normalizeText(record.goal) || null,
    documentName: normalizeText(record.documentName) || null,
    outputLanguage: normalizeLanguage(record.outputLanguage),
    notes: normalizeText(record.notes) || null,
    sourceLabels
  };
}

function normalizeRow(row: unknown): TreeSpreadsheetRow | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const title = normalizeText(record.title);
  if (!title) return null;
  const number = normalizeText(record.number) || null;
  const deliverables = normalizeDeliverables(record.deliverables);
  const deliverableTasks = Array.isArray(record.deliverableTasks)
    ? record.deliverableTasks
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;
          const taskRecord = entry as Record<string, unknown>;
          const deliverable = normalizeText(taskRecord.deliverable);
          if (!deliverable) return null;
          return {
            deliverable,
            tasks: normalizeDeliverables(taskRecord.tasks)
          };
        })
        .filter((entry): entry is { deliverable: string; tasks: string[] } => Boolean(entry))
    : [];
  return {
    number,
    level: normalizeLevel(record.level, number),
    title,
    description: normalizeText(record.description) || null,
    deliverables,
    deliverableTasks
  };
}

function cloneSpreadsheetNode(node: SpreadsheetTreeNode): SpreadsheetTreeNode {
  return {
    ...node,
    deliverables: [...(node.deliverables ?? [])],
    deliverableTasks: (node.deliverableTasks ?? []).map((entry) => ({
      deliverable: entry.deliverable,
      tasks: [...entry.tasks]
    })),
    children: node.children.map(cloneSpreadsheetNode)
  };
}

export function normalizeTreeSpreadsheetPayload(value: unknown): TreeSpreadsheetPayload {
  if (!value || typeof value !== "object") {
    return { meta: null, rows: [] };
  }
  const record = value as Record<string, unknown>;
  const rows = Array.isArray(record.rows)
    ? record.rows.map((row) => normalizeRow(row)).filter((row): row is TreeSpreadsheetRow => Boolean(row))
    : [];
  return {
    meta: normalizeMeta(record.meta),
    rows
  };
}

export function buildSpreadsheetTreeNodesFromRows(rows: TreeSpreadsheetRow[]): SpreadsheetTreeNode[] {
  const rootNodes: SpreadsheetTreeNode[] = [];
  const stack: Array<{ level: number; node: SpreadsheetTreeNode }> = [];

  for (const row of rows) {
    const level = normalizeLevel(row.level, row.number);
    const node: SpreadsheetTreeNode = {
      title: row.title.trim(),
      description: row.description?.trim() || null,
      deliverables: (row.deliverables ?? []).map((item) => item.trim()).filter((item) => item.length > 0),
      deliverableTasks: (row.deliverableTasks ?? [])
        .map((entry) => ({
          deliverable: entry.deliverable.trim(),
          tasks: entry.tasks.map((task) => task.trim()).filter((task) => task.length > 0)
        }))
        .filter((entry) => entry.deliverable.length > 0),
      children: []
    };

    while (stack.length > 0 && stack[stack.length - 1]!.level >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      rootNodes.push(node);
    } else {
      stack[stack.length - 1]!.node.children.push(node);
    }

    stack.push({ level, node });
  }

  return rootNodes;
}

export function spreadsheetTreeNodesToWbsNodes(nodes: SpreadsheetTreeNode[]): WBSNode[] {
  return nodes.map((node) => ({
    title: node.title.trim(),
    description: node.description?.trim() || undefined,
    expected_deliverables: (node.deliverables ?? []).map((item) => item.trim()).filter((item) => item.length > 0),
    prerequisites: [],
    estimated_effort: "S",
    suggested_role: "Owner",
    value_milestone: false,
    children: spreadsheetTreeNodesToWbsNodes(node.children)
  }));
}

export function wbsNodesToSpreadsheetTreeNodes(nodes: WBSNode[]): SpreadsheetTreeNode[] {
  return nodes.map((node) => ({
    title: node.title.trim(),
    description: node.description?.trim() || null,
    deliverables: (node.expected_deliverables ?? []).map((item) => item.trim()).filter((item) => item.length > 0),
    deliverableTasks: [],
    children: wbsNodesToSpreadsheetTreeNodes(node.children)
  }));
}

export function buildTreeSpreadsheetPayloadFromWbsNodes(
  nodes: WBSNode[],
  meta?: TreeSpreadsheetMeta | null
): TreeSpreadsheetPayload {
  return {
    meta: meta ? { ...meta, sourceLabels: [...(meta.sourceLabels ?? [])] } : null,
    rows: flattenSpreadsheetTreeNodes(wbsNodesToSpreadsheetTreeNodes(nodes))
  };
}

export function buildTreeSpreadsheetPayloadFromDocumentTreeMemory(
  entry: ApprovedDocumentTreeMemoryEntry
): TreeSpreadsheetPayload {
  return buildTreeSpreadsheetPayloadFromWbsNodes(entry.nodes, {
    title: entry.goal,
    goal: entry.goal,
    documentName: entry.documentName,
    outputLanguage: entry.outputLanguage,
    notes: entry.notes,
    sourceLabels: [...entry.sourceLabels]
  });
}

export function buildDocumentTreeMemoryEntryFromSpreadsheetPayload(
  payload: TreeSpreadsheetPayload,
  fallback: Pick<ApprovedDocumentTreeMemoryEntry, "id" | "approvedAt" | "targetNodeId" | "documentName" | "goal" | "outputLanguage" | "sourceLabels" | "notes">
): ApprovedDocumentTreeMemoryEntry {
  const nodes = spreadsheetTreeNodesToWbsNodes(buildSpreadsheetTreeNodesFromRows(payload.rows));
  const taskGuidance = payload.rows
    .flatMap((row) =>
      (row.deliverableTasks ?? []).map((entry) => {
        const tasks = entry.tasks.filter((task) => task.trim().length > 0);
        if (entry.deliverable.trim().length === 0 || tasks.length === 0) return "";
        return `${row.title.trim()} :: ${entry.deliverable.trim()} => ${tasks.join(" | ")}`;
      })
    )
    .filter((line) => line.length > 0);
  const mergedNotes = [payload.meta?.notes?.trim() || "", fallback.notes, taskGuidance.length > 0 ? `Deliverable tasks:\n${taskGuidance.join("\n")}` : ""]
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join("\n\n");
  return {
    id: fallback.id,
    approvedAt: fallback.approvedAt,
    targetNodeId: fallback.targetNodeId,
    documentName: payload.meta?.documentName?.trim() || fallback.documentName,
    goal: payload.meta?.goal?.trim() || payload.meta?.title?.trim() || fallback.goal,
    outputLanguage: payload.meta?.outputLanguage ?? fallback.outputLanguage,
    sourceLabels: payload.meta?.sourceLabels?.filter((item) => item.trim().length > 0) ?? fallback.sourceLabels,
    notes: mergedNotes,
    nodes
  };
}

export function buildTreeSpreadsheetPayloadFromAppBranch(
  rootNodeId: string,
  allNodes: AppNode[]
): TreeSpreadsheetPayload | null {
  const rootNode = allNodes.find((node) => node.id === rootNodeId) ?? null;
  if (!rootNode || rootNode.type === "file") return null;
  const childrenByParent = buildChildrenMap(allNodes);
  const tree = buildSpreadsheetTreeFromAppNode(rootNode, childrenByParent);
  return {
    meta: {
      title: rootNode.name,
      goal: rootNode.name
    },
    rows: flattenSpreadsheetTreeNodes([tree])
  };
}

export function parseSpreadsheetPayloadToWbsNodes(payload: TreeSpreadsheetPayload): WBSNode[] {
  return spreadsheetTreeNodesToWbsNodes(buildSpreadsheetTreeNodesFromRows(payload.rows));
}

export function parseSpreadsheetPayloadToTreeNodes(payload: TreeSpreadsheetPayload): SpreadsheetTreeNode[] {
  return buildSpreadsheetTreeNodesFromRows(payload.rows).map(cloneSpreadsheetNode);
}

export function buildTaskListText(tasks: ODEExecutionTaskItem[]): string[] {
  return tasks
    .map((task) => normalizeText(task.title))
    .filter((title) => title.length > 0)
    .slice(0, 32);
}
