import {
  ROOT_PARENT_ID,
  isFileLikeNode,
  type AppNode,
  type ODEExecutionTaskItem,
  type ODEStructuredDeliverable
} from "@/lib/types";

export type WorkareaItemKind = "deliverable" | "task" | "subtask";

export function isWorkareaRootNode(node: AppNode | null | undefined): boolean {
  return Boolean(node && node.properties?.odeWorkareaRoot === true);
}

export function getWorkareaRootOwnerNodeId(
  node: AppNode | null | undefined,
  nodeById: Map<string, AppNode>
): string | null {
  if (!node || !isWorkareaRootNode(node)) return null;

  let current: AppNode | null = node;
  let safety = 0;
  while (current && safety < 200) {
    const parentId: string | null = current.parentId;
    if (!parentId || parentId === ROOT_PARENT_ID) return null;
    const parentNode: AppNode | null = nodeById.get(parentId) ?? null;
    if (!parentNode) return parentId;
    if (!isWorkareaRootNode(parentNode)) return parentNode.id;
    current = parentNode;
    safety += 1;
  }

  return null;
}

export function findWorkareaContainerNode(
  ownerNodeId: string,
  byParent: Map<string, AppNode[]>
): AppNode | null {
  return (byParent.get(ownerNodeId) ?? []).find((child) => isWorkareaRootNode(child)) ?? null;
}

export function getWorkareaContainerNodeId(
  ownerNodeId: string,
  byParent: Map<string, AppNode[]>
): string {
  return findWorkareaContainerNode(ownerNodeId, byParent)?.id ?? ownerNodeId;
}

export function getVisibleWorkareaChildNodes(params: {
  parentNode: AppNode | null | undefined;
  byParent: Map<string, AppNode[]>;
}): AppNode[] {
  const parentNode = params.parentNode;
  if (!parentNode) return [];

  const sourceParentId =
    isWorkareaItemNode(parentNode) || isWorkareaRootNode(parentNode)
      ? parentNode.id
      : getWorkareaContainerNodeId(parentNode.id, params.byParent);

  const results: AppNode[] = [];
  const visited = new Set<string>();

  const collectChildren = (nodeId: string) => {
    for (const child of params.byParent.get(nodeId) ?? []) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      if (isWorkareaRootNode(child)) {
        collectChildren(child.id);
        continue;
      }
      if (isWorkareaItemNode(child)) {
        results.push(child);
      }
    }
  };

  collectChildren(sourceParentId);
  return results;
}

function readTimelineScheduleRecord(node: AppNode): Record<string, unknown> | null {
  const record =
    node.properties?.timelineSchedule && typeof node.properties.timelineSchedule === "object"
      ? (node.properties.timelineSchedule as Record<string, unknown>)
      : null;
  return record;
}

function readTimelineScheduleStatus(node: AppNode): ODEExecutionTaskItem["status"] {
  const schedule = readTimelineScheduleRecord(node);
  const status = schedule?.status;
  if (status === "active" || status === "blocked" || status === "done") return status;
  const propertyStatus = node.properties?.odeExecutionTaskStatus;
  return propertyStatus === "active" || propertyStatus === "blocked" || propertyStatus === "done"
    ? propertyStatus
    : "planned";
}

function readTimelineScheduleDueDate(node: AppNode): string | null {
  const schedule = readTimelineScheduleRecord(node);
  if (typeof schedule?.endDate === "string" && schedule.endDate.trim().length > 0) {
    return schedule.endDate.trim();
  }
  if (typeof schedule?.startDate === "string" && schedule.startDate.trim().length > 0) {
    return schedule.startDate.trim();
  }
  if (
    typeof node.properties?.odeExecutionTaskDueDate === "string" &&
    node.properties.odeExecutionTaskDueDate.trim().length > 0
  ) {
    return node.properties.odeExecutionTaskDueDate.trim();
  }
  return null;
}

export function isWorkareaItemNode(node: AppNode | null | undefined): boolean {
  return Boolean(node && node.properties?.odeWorkareaItem === true);
}

export function isDeclaredWorkareaOwnerNode(node: AppNode | null | undefined): boolean {
  return Boolean(node && !isFileLikeNode(node) && node.properties?.odeWorkareaOwner === true);
}

export function getWorkareaOwnerNodeId(
  node: AppNode | null | undefined,
  nodeById: Map<string, AppNode>
): string | null {
  if (!node || !isWorkareaItemNode(node)) return null;
  let current: AppNode | null = node;
  let safety = 0;
  while (current && safety < 200) {
    const parentId: string | null = current.parentId;
    if (!parentId || parentId === ROOT_PARENT_ID) return null;
    const parentNode: AppNode | null = nodeById.get(parentId) ?? null;
    if (!parentNode) return parentId;
    if (isWorkareaRootNode(parentNode)) {
      return parentNode.parentId && parentNode.parentId !== ROOT_PARENT_ID ? parentNode.parentId : null;
    }
    if (!isWorkareaItemNode(parentNode)) return parentNode.id;
    current = parentNode;
    safety += 1;
  }
  return null;
}

export function getWorkareaItemDepth(
  node: AppNode | null | undefined,
  nodeById: Map<string, AppNode>
): number | null {
  if (!node || !isWorkareaItemNode(node)) return null;
  let depth = 0;
  let current: AppNode | null = node;
  let safety = 0;
  while (current && safety < 200) {
    const parentId: string | null = current.parentId;
    if (!parentId || parentId === ROOT_PARENT_ID) return null;
    const parentNode: AppNode | null = nodeById.get(parentId) ?? null;
    if (!parentNode || !isWorkareaItemNode(parentNode)) {
      return depth;
    }
    current = parentNode;
    depth += 1;
    safety += 1;
  }
  return depth;
}

export function getWorkareaItemKind(
  node: AppNode | null | undefined,
  nodeById: Map<string, AppNode>
): WorkareaItemKind | null {
  const depth = getWorkareaItemDepth(node, nodeById);
  if (depth === null) return null;
  if (depth <= 0) return "deliverable";
  if (depth === 1) return "task";
  return "subtask";
}

export function resolveWorkareaItemKindForParent(
  parentNode: AppNode | null | undefined,
  nodeById: Map<string, AppNode>
): WorkareaItemKind {
  if (!parentNode || !isWorkareaItemNode(parentNode)) {
    return "deliverable";
  }
  const parentKind = getWorkareaItemKind(parentNode, nodeById);
  if (parentKind === "deliverable") return "task";
  return "subtask";
}

export function collectWorkareaOwnerNodeIds(params: {
  candidates: AppNode[];
  visibleScope: Set<string> | null;
  nodeById: Map<string, AppNode>;
  byParent: Map<string, AppNode[]>;
}): Set<string> {
  const ownerIds = new Set<string>();
  for (const candidate of params.candidates) {
    if (params.visibleScope && !params.visibleScope.has(candidate.id)) continue;
    if (isFileLikeNode(candidate)) continue;
    if (isWorkareaRootNode(candidate)) {
      const hasVisibleChildren =
        getVisibleWorkareaChildNodes({
          parentNode: candidate,
          byParent: params.byParent
        }).length > 0;
      if (!hasVisibleChildren) continue;
      const ownerNodeId = getWorkareaRootOwnerNodeId(candidate, params.nodeById);
      if (ownerNodeId) ownerIds.add(ownerNodeId);
      continue;
    }
    if (isDeclaredWorkareaOwnerNode(candidate)) {
      ownerIds.add(candidate.id);
    }
    if (isWorkareaItemNode(candidate)) {
      const ownerId = getWorkareaOwnerNodeId(candidate, params.nodeById);
      if (ownerId) {
        ownerIds.add(ownerId);
      }
      continue;
    }
    const hasVisibleChildren =
      getVisibleWorkareaChildNodes({
        parentNode: candidate,
        byParent: params.byParent
      }).length > 0;
    if (hasVisibleChildren) {
      ownerIds.add(candidate.id);
    }
  }
  return ownerIds;
}

export function buildStructuredDeliverablesFromWorkareaNodes(params: {
  ownerNodeId: string;
  byParent: Map<string, AppNode[]>;
  nodeById: Map<string, AppNode>;
}): ODEStructuredDeliverable[] {
  const containerNodeId = getWorkareaContainerNodeId(params.ownerNodeId, params.byParent);
  const deliverableNodes = (params.byParent.get(containerNodeId) ?? []).filter((child) =>
    isWorkareaItemNode(child)
  );
  return deliverableNodes.map((deliverableNode, deliverableIndex) => {
    const taskNodes = (params.byParent.get(deliverableNode.id) ?? []).filter((child) => isWorkareaItemNode(child));
    return {
      id:
        typeof deliverableNode.properties?.odeWorkareaLegacyDeliverableId === "string" &&
        deliverableNode.properties.odeWorkareaLegacyDeliverableId.trim().length > 0
          ? deliverableNode.properties.odeWorkareaLegacyDeliverableId.trim()
          : `ode-deliverable-${params.ownerNodeId}-${deliverableIndex + 1}`,
      title: deliverableNode.name.trim(),
      tasks: taskNodes.map<ODEExecutionTaskItem>((taskNode) => ({
        id:
          typeof taskNode.properties?.odeWorkareaLegacyTaskId === "string" &&
          taskNode.properties.odeWorkareaLegacyTaskId.trim().length > 0
            ? taskNode.properties.odeWorkareaLegacyTaskId.trim()
            : taskNode.id,
        title: taskNode.name.trim(),
        ownerName:
          typeof taskNode.properties?.odeExecutionTaskOwnerName === "string"
            ? taskNode.properties.odeExecutionTaskOwnerName.trim() || null
            : null,
        dueDate: readTimelineScheduleDueDate(taskNode),
        status: readTimelineScheduleStatus(taskNode),
        flagged: taskNode.properties?.odeExecutionTaskFlagged === true,
        note: taskNode.description?.trim() || null
      })),
      notifications: [],
      data: []
    };
  });
}
