import {
  normalizeIsoDateOnlyInput,
  parseIsoDateOnly
} from "@/features/timeline/date";
import {
  normalizeTimelineSchedule,
  type NodeTimelineSchedule
} from "@/features/timeline/model";
import type {
  AppNode,
  ODEExecutionTaskItem,
  ODEStructuredDeliverable,
  ScheduleStatus
} from "@/lib/types";

export type ExecutionProjectionMeta = {
  taskId: string;
  deliverableId: string;
  ownerNodeId: string;
};

let executionTaskItemIdCounter = 0;

export function isHiddenExecutionTaskNode(node: AppNode | null | undefined): boolean {
  return Boolean(node && node.type === "task" && node.properties?.odeExecutionTask === true);
}

export function getExecutionTaskMeta(
  node: AppNode | null | undefined
): ExecutionProjectionMeta | null {
  if (!node || !isHiddenExecutionTaskNode(node)) return null;
  const taskId =
    typeof node.properties?.odeExecutionTaskId === "string"
      ? node.properties.odeExecutionTaskId.trim()
      : "";
  const deliverableId =
    typeof node.properties?.odeExecutionDeliverableId === "string"
      ? node.properties.odeExecutionDeliverableId.trim()
      : "";
  const ownerNodeId =
    typeof node.properties?.odeExecutionOwnerNodeId === "string"
      ? node.properties.odeExecutionOwnerNodeId.trim()
      : "";
  if (!taskId || !deliverableId || !ownerNodeId) return null;
  return { taskId, deliverableId, ownerNodeId };
}

export function normalizeExecutionTaskText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeExecutionTaskDueDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = normalizeIsoDateOnlyInput(value);
  return normalized || null;
}

export function splitExecutionTaskAssignees(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function buildExecutionTaskTimelineSchedule(
  task: ODEExecutionTaskItem,
  fallbackTitle: string,
  existingSchedule: NodeTimelineSchedule | null
): NodeTimelineSchedule | null {
  const dueDate = normalizeExecutionTaskDueDate(task.dueDate);
  if (dueDate) {
    return normalizeTimelineSchedule({
      title: task.title.trim() || fallbackTitle,
      status:
        task.status === "active" || task.status === "blocked" || task.status === "done"
          ? task.status
          : "planned",
      startDate: dueDate,
      endDate: dueDate,
      assignees: splitExecutionTaskAssignees(task.ownerName ?? null),
      priority: existingSchedule?.priority ?? "normal",
      progress: task.status === "active" ? 50 : 0,
      predecessor: "",
      mode: "manual"
    });
  }

  if (!existingSchedule) return null;

  return normalizeTimelineSchedule({
    ...existingSchedule,
    title: task.title.trim() || fallbackTitle
  });
}

export function normalizeExecutionTaskItems(tasks: unknown): ODEExecutionTaskItem[] {
  if (!Array.isArray(tasks)) return [];

  return tasks
    .map<ODEExecutionTaskItem | null>((item, index) => {
      if (typeof item === "string") {
        const title = item.trim();
        return title
          ? {
              id: `ode-task-${Date.now()}-${index}`,
              title,
              ownerName: null,
              dueDate: null,
              status: "planned",
              flagged: false,
              note: null
            }
          : null;
      }

      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const title = typeof record.title === "string" ? record.title.trim() : "";
      if (!title) return null;
      const status: ScheduleStatus =
        record.status === "active" || record.status === "blocked" || record.status === "done"
          ? record.status
          : "planned";

      return {
        id:
          typeof record.id === "string" && record.id.trim().length > 0
            ? record.id.trim()
            : `ode-task-${Date.now()}-${index}`,
        title,
        ownerName: normalizeExecutionTaskText(record.ownerName),
        dueDate: normalizeExecutionTaskDueDate(record.dueDate),
        status,
        flagged: record.flagged === true,
        note: normalizeExecutionTaskText(record.note)
      };
    })
    .filter((item): item is ODEExecutionTaskItem => item !== null);
}

export function createExecutionTaskItemId(): string {
  executionTaskItemIdCounter += 1;
  return `ode-task-${Date.now()}-${executionTaskItemIdCounter}`;
}

export function createExecutionTaskItem(initialTitle = ""): ODEExecutionTaskItem {
  return {
    id: createExecutionTaskItemId(),
    title: initialTitle,
    ownerName: null,
    dueDate: null,
    status: "planned",
    flagged: false,
    note: null
  };
}

export function normalizeStructuredDeliverablesForNode(
  ownerNodeId: string,
  rawDeliverables: unknown
): ODEStructuredDeliverable[] {
  if (!Array.isArray(rawDeliverables)) return [];

  return rawDeliverables
    .map((rawDeliverable, index) => {
      const record =
        rawDeliverable && typeof rawDeliverable === "object"
          ? (rawDeliverable as Record<string, unknown>)
          : null;
      const title = typeof record?.title === "string" ? record.title.trim() : "";
      return {
        id:
          typeof record?.id === "string" && record.id.trim().length > 0
            ? record.id.trim()
            : `ode-deliverable-${ownerNodeId}-${index}`,
        title,
        tasks: normalizeExecutionTaskItems(record?.tasks),
        notifications: Array.isArray(record?.notifications)
          ? record.notifications
              .map((item) => (typeof item === "string" ? item.trim() : ""))
              .filter((item) => item.length > 0)
          : [],
        data: Array.isArray(record?.data)
          ? record.data
              .map((item) => (typeof item === "string" ? item.trim() : ""))
              .filter((item) => item.length > 0)
          : []
      };
    })
    .filter((deliverable) => deliverable.title.length > 0);
}

export function readNodeObjectiveValue(node: AppNode | null | undefined): string | null {
  if (!node) return null;
  const objective =
    typeof node.properties?.odeObjective === "string" ? node.properties.odeObjective.trim() : "";
  return objective.length > 0 ? objective : null;
}

export function compareIsoDate(a: string, b: string): number {
  const left = parseIsoDateOnly(a);
  const right = parseIsoDateOnly(b);
  if (!left || !right) return 0;
  return left.getTime() - right.getTime();
}

function resolveDeliverableId(
  ownerNodeId: string,
  rawDeliverable: unknown,
  index: number
): string {
  const record =
    rawDeliverable && typeof rawDeliverable === "object"
      ? (rawDeliverable as Record<string, unknown>)
      : null;
  return typeof record?.id === "string" && record.id.trim().length > 0
    ? record.id.trim()
    : `ode-deliverable-${ownerNodeId}-${index}`;
}

export function isRenderableExecutionProjectionNode(params: {
  node: AppNode | null | undefined;
  nodeById: Map<string, AppNode>;
  getExecutionTaskMeta: (node: AppNode | null | undefined) => ExecutionProjectionMeta | null;
  normalizeExecutionTaskItems: (tasks: unknown) => Array<{ id: string }>;
}): boolean {
  const meta = params.getExecutionTaskMeta(params.node);
  if (!params.node || !meta) return false;
  if (params.node.parentId !== meta.ownerNodeId) return false;

  const ownerNode = params.nodeById.get(meta.ownerNodeId) ?? null;
  if (!ownerNode) return false;

  const rawDeliverables = ownerNode.properties?.odeStructuredDeliverables;
  if (!Array.isArray(rawDeliverables)) {
    return true;
  }

  return rawDeliverables.some((rawDeliverable, index) => {
    const deliverableId = resolveDeliverableId(ownerNode.id, rawDeliverable, index);
    if (deliverableId !== meta.deliverableId) return false;
    const record =
      rawDeliverable && typeof rawDeliverable === "object"
        ? (rawDeliverable as Record<string, unknown>)
        : null;
    const tasks = params.normalizeExecutionTaskItems(record?.tasks);
    return tasks.some((task) => task.id === meta.taskId);
  });
}

export function collectExecutionOwnerNodeIds(params: {
  candidates: AppNode[];
  visibleScope: Set<string> | null;
  getExecutionTaskMeta: (node: AppNode | null | undefined) => ExecutionProjectionMeta | null;
  isRenderableExecutionProjectionNode: (node: AppNode | null | undefined) => boolean;
}): Set<string> {
  const ownerIds = new Set<string>();

  for (const candidate of params.candidates) {
    if (params.visibleScope && !params.visibleScope.has(candidate.id)) continue;
    if (
      candidate.type !== "file" &&
      !isHiddenExecutionTaskNode(candidate) &&
      normalizeStructuredDeliverablesForNode(candidate.id, candidate.properties?.odeStructuredDeliverables).length > 0
    ) {
      ownerIds.add(candidate.id);
    }
    if (!params.isRenderableExecutionProjectionNode(candidate)) continue;
    const meta = params.getExecutionTaskMeta(candidate);
    if (!meta) continue;
    ownerIds.add(meta.ownerNodeId);
  }

  return ownerIds;
}
