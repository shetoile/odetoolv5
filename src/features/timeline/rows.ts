import { ROOT_PARENT_ID, isFileLikeNode, type ScheduleStatus, type AppNode } from "@/lib/types";
import type { TimelinePriority } from "@/features/timeline/filterState";

export type TimelineTreeRow = {
  id: string;
  node: AppNode;
  level: number;
  indexLabel: string;
  hasChildren: boolean;
  groupKind?: "deliverable";
};

type ExecutionTaskMeta = {
  ownerNodeId: string;
};

type DeliverableGroup = {
  id: string;
  title: string;
  tasks: AppNode[];
  order: number;
};

type TimelineScheduleLookupEntry = {
  schedule: {
    status: ScheduleStatus;
    priority: TimelinePriority;
  };
};

export type TimelineScheduleFilterState = {
  hasActiveTimelineStatusFiltering: boolean;
  activeTimelineStatusFilters: Set<ScheduleStatus>;
  hasActiveTimelinePriorityFiltering: boolean;
  activeTimelinePriorityFilters: Set<TimelinePriority>;
};

function matchesTimelineScheduleFilters(
  timelineScheduleEntry: TimelineScheduleLookupEntry | null | undefined,
  filterState: TimelineScheduleFilterState
): boolean {
  const timelineSchedule = timelineScheduleEntry?.schedule ?? null;
  const status = timelineSchedule?.status ?? "planned";
  const priority = timelineSchedule?.priority ?? "normal";
  const matchesTimelineStatus =
    !filterState.hasActiveTimelineStatusFiltering ||
    (timelineSchedule !== null && filterState.activeTimelineStatusFilters.has(status));
  const matchesTimelinePriority =
    !filterState.hasActiveTimelinePriorityFiltering ||
    (timelineSchedule !== null && filterState.activeTimelinePriorityFilters.has(priority));
  return matchesTimelineStatus && matchesTimelinePriority;
}

export function collectGroupedExecutionTimelineTasksByOwner(params: {
  candidates: AppNode[];
  visibleScope: Set<string> | null;
  matchedTaskIds?: Set<string> | null;
  getExecutionTaskMeta: (node: AppNode) => ExecutionTaskMeta | null;
  isRenderableExecutionProjectionNode: (node: AppNode) => boolean;
  timelineScheduleByNodeId: Map<string, TimelineScheduleLookupEntry>;
  filterState: TimelineScheduleFilterState;
}): Map<string, AppNode[]> {
  const groupedTasksByOwner = new Map<string, AppNode[]>();

  for (const candidate of params.candidates) {
    if (params.visibleScope && !params.visibleScope.has(candidate.id)) continue;
    if (params.matchedTaskIds && !params.matchedTaskIds.has(candidate.id)) continue;

    const meta = params.getExecutionTaskMeta(candidate);
    if (!meta) continue;
    if (!params.isRenderableExecutionProjectionNode(candidate)) continue;
    if (
      !matchesTimelineScheduleFilters(
        params.timelineScheduleByNodeId.get(candidate.id),
        params.filterState
      )
    ) {
      continue;
    }

    const current = groupedTasksByOwner.get(meta.ownerNodeId) ?? [];
    current.push(candidate);
    groupedTasksByOwner.set(meta.ownerNodeId, current);
  }

  return groupedTasksByOwner;
}

export function buildTimelineTreeRows(params: {
  activeProjectRootId: string | null;
  nodeById: Map<string, AppNode>;
  byParent: Map<string, AppNode[]>;
  expandedIds: Set<string>;
  scopedNumbering: Map<string, string>;
  isHiddenExecutionTaskNode: (node: AppNode | null | undefined) => boolean;
  isRenderableExecutionProjectionNode: (node: AppNode | null | undefined) => boolean;
  shouldHideNode?: (node: AppNode) => boolean;
  shouldFlattenNode?: (node: AppNode) => boolean;
}): TimelineTreeRow[] {
  const rows: TimelineTreeRow[] = [];

  const hasVisibleChildren = (parentId: string): boolean => {
    const children = params.byParent.get(parentId) ?? [];
    for (const child of children) {
      if (isFileLikeNode(child)) continue;
      if (params.shouldHideNode?.(child)) {
        if (params.shouldFlattenNode?.(child) && hasVisibleChildren(child.id)) {
          return true;
        }
        continue;
      }
      if (
        params.isHiddenExecutionTaskNode(child) &&
        !params.isRenderableExecutionProjectionNode(child)
      ) {
        continue;
      }
      return true;
    }
    return false;
  };

  const visit = (parentId: string, level: number) => {
    const children = params.byParent.get(parentId) ?? [];
    for (const child of children) {
      if (isFileLikeNode(child)) continue;
      if (params.shouldHideNode?.(child)) {
        if (params.shouldFlattenNode?.(child)) {
          visit(child.id, level);
        }
        continue;
      }
      if (
        params.isHiddenExecutionTaskNode(child) &&
        !params.isRenderableExecutionProjectionNode(child)
      ) {
        continue;
      }

      const hasChildren = params.isHiddenExecutionTaskNode(child) ? false : hasVisibleChildren(child.id);
      rows.push({
        id: child.id,
        node: child,
        level,
        indexLabel: params.scopedNumbering.get(child.id) ?? "",
        hasChildren
      });
      if (hasChildren && params.expandedIds.has(child.id)) {
        visit(child.id, level + 1);
      }
    }
  };

  if (params.activeProjectRootId) {
    const rootNode = params.nodeById.get(params.activeProjectRootId);
    if (!rootNode || isFileLikeNode(rootNode)) return rows;
    const rootHasChildren = hasVisibleChildren(rootNode.id);
    rows.push({
      id: rootNode.id,
      node: rootNode,
      level: 0,
      indexLabel: params.scopedNumbering.get(rootNode.id) ?? "",
      hasChildren: rootHasChildren
    });
    if (rootHasChildren && params.expandedIds.has(rootNode.id)) {
      visit(rootNode.id, 1);
    }
    return rows;
  }

  visit(ROOT_PARENT_ID, 0);
  return rows;
}

export function buildGroupedExecutionTimelineRows(params: {
  groupedTasksByOwner: Map<string, AppNode[]>;
  ownerNodeIds?: Iterable<string>;
  nodeById: Map<string, AppNode>;
  numbering: Map<string, string>;
  scopedNumbering: Map<string, string>;
  expandedIds: Set<string>;
  prioritizeFlaggedTimelineTasks: boolean;
  isTimelineNodeFlagged: (nodeId: string) => boolean;
  alwaysExpandChildren?: boolean;
}): TimelineTreeRow[] {
  const readOwnerDeliverableOrder = (ownerNode: AppNode) => {
    const rawDeliverables = ownerNode.properties?.odeStructuredDeliverables;
    if (!Array.isArray(rawDeliverables)) return new Map<string, { order: number; title: string }>();
    return new Map(
      rawDeliverables.flatMap((rawDeliverable, index) => {
        if (!rawDeliverable || typeof rawDeliverable !== "object") return [];
        const record = rawDeliverable as Record<string, unknown>;
        const deliverableId =
          typeof record.id === "string" && record.id.trim().length > 0
            ? record.id.trim()
            : "";
        if (!deliverableId) return [];
        const title =
          typeof record.title === "string" && record.title.trim().length > 0
            ? record.title.trim()
            : "Deliverable";
        return [[deliverableId, { order: index, title }]] as const;
      })
    );
  };

  const createDeliverableGroupNode = (ownerNode: AppNode, deliverableId: string, title: string): AppNode => ({
    id: `ode-timeline-deliverable-group:${ownerNode.id}:${deliverableId}`,
    parentId: ownerNode.id,
    name: title,
    type: "folder",
    properties: {
      odeTimelineGroup: "deliverable",
      odeTimelineOwnerNodeId: ownerNode.id,
      odeTimelineDeliverableId: deliverableId
    },
    description: null,
    order: 0,
    createdAt: ownerNode.createdAt,
    updatedAt: ownerNode.updatedAt
  });

  const ownerIdSet = new Set<string>(params.groupedTasksByOwner.keys());
  for (const ownerNodeId of params.ownerNodeIds ?? []) {
    ownerIdSet.add(ownerNodeId);
  }

  const ownerNodes = Array.from(ownerIdSet)
    .map((ownerId) => params.nodeById.get(ownerId) ?? null)
    .filter((node): node is AppNode => Boolean(node && !isFileLikeNode(node)))
    .sort((a, b) => {
      if (params.prioritizeFlaggedTimelineTasks) {
        const aFlagged = (params.groupedTasksByOwner.get(a.id) ?? []).some((taskNode) =>
          params.isTimelineNodeFlagged(taskNode.id)
        );
        const bFlagged = (params.groupedTasksByOwner.get(b.id) ?? []).some((taskNode) =>
          params.isTimelineNodeFlagged(taskNode.id)
        );
        if (aFlagged !== bFlagged) {
          return aFlagged ? -1 : 1;
        }
      }

      const aOrder = params.scopedNumbering.get(a.id) ?? params.numbering.get(a.id) ?? "";
      const bOrder = params.scopedNumbering.get(b.id) ?? params.numbering.get(b.id) ?? "";
      const orderCmp = aOrder.localeCompare(bOrder, undefined, { numeric: true });
      if (orderCmp !== 0) return orderCmp;
      return a.name.localeCompare(b.name);
    });

  const rows: TimelineTreeRow[] = [];
  for (const ownerNode of ownerNodes) {
    const taskNodes = (params.groupedTasksByOwner.get(ownerNode.id) ?? []).sort((a, b) => {
      if (params.prioritizeFlaggedTimelineTasks) {
        const aFlagged = params.isTimelineNodeFlagged(a.id);
        const bFlagged = params.isTimelineNodeFlagged(b.id);
        if (aFlagged !== bFlagged) {
          return aFlagged ? -1 : 1;
        }
      }

      const aOrder = Number(a.properties?.odeExecutionTaskOrder ?? 0);
      const bOrder = Number(b.properties?.odeExecutionTaskOrder ?? 0);
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.name.localeCompare(b.name);
    });

    const ownerDeliverableOrder = readOwnerDeliverableOrder(ownerNode);
    const groupedByDeliverable = new Map<string, DeliverableGroup>();
    ownerDeliverableOrder.forEach((config, deliverableId) => {
      groupedByDeliverable.set(deliverableId, {
        id: deliverableId,
        title: config.title,
        tasks: [],
        order: config.order
      });
    });
    taskNodes.forEach((taskNode) => {
      const deliverableId =
        typeof taskNode.properties?.odeExecutionDeliverableId === "string" &&
        taskNode.properties.odeExecutionDeliverableId.trim().length > 0
          ? taskNode.properties.odeExecutionDeliverableId.trim()
          : "__ungrouped__";
      const configuredDeliverable = ownerDeliverableOrder.get(deliverableId);
      const fallbackTitle =
        typeof taskNode.properties?.odeExecutionDeliverableTitle === "string" &&
        taskNode.properties.odeExecutionDeliverableTitle.trim().length > 0
          ? taskNode.properties.odeExecutionDeliverableTitle.trim()
          : configuredDeliverable?.title ?? "Deliverable";
      const current = groupedByDeliverable.get(deliverableId);
      if (current) {
        current.tasks.push(taskNode);
        return;
      }
      groupedByDeliverable.set(deliverableId, {
        id: deliverableId,
        title: fallbackTitle,
        tasks: [taskNode],
        order: configuredDeliverable?.order ?? Number.MAX_SAFE_INTEGER
      });
    });
    const deliverableGroups = Array.from(groupedByDeliverable.values()).sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true });
    });

    if (deliverableGroups.length === 0) continue;

    rows.push({
      id: ownerNode.id,
      node: ownerNode,
      level: 0,
      indexLabel: params.scopedNumbering.get(ownerNode.id) ?? "",
      hasChildren: deliverableGroups.length > 0
    });

    if (params.alwaysExpandChildren || params.expandedIds.has(ownerNode.id)) {
      for (const deliverableGroup of deliverableGroups) {
        rows.push({
          id: `ode-timeline-deliverable-group-row:${ownerNode.id}:${deliverableGroup.id}`,
          node: createDeliverableGroupNode(ownerNode, deliverableGroup.id, deliverableGroup.title),
          level: 1,
          indexLabel: "",
          hasChildren: false,
          groupKind: "deliverable"
        });
        rows.push(
          ...deliverableGroup.tasks.map((taskNode) => ({
            id: taskNode.id,
            node: taskNode,
            level: 2,
            indexLabel: "",
            hasChildren: false
          }))
        );
      }
    }
  }

  return rows;
}

export function buildDisplayedTimelineRows(params: {
  timelineMode: "schedule" | "tasks";
  hasTimelineTaskSearch: boolean;
  matchedTimelineSearchNodeIds: Set<string> | null;
  isExecutionOnlyNodeStateFilter: boolean;
  includeNodeStateFilterParents: boolean;
  hasActiveNodeStateFiltering: boolean;
  hasActiveTimelineScheduleFiltering: boolean;
  prioritizeFlaggedTimelineTasks: boolean;
  timelineRows: TimelineTreeRow[];
  timelineVisibleRowIdSet: Set<string>;
  activeProjectRootId: string | null;
  nodeById: Map<string, AppNode>;
  byParent: Map<string, AppNode[]>;
  numbering: Map<string, string>;
  scopedNumbering: Map<string, string>;
  expandedIds: Set<string>;
  candidates: AppNode[];
  visibleScope: Set<string> | null;
  getExecutionTaskMeta: (node: AppNode) => ExecutionTaskMeta | null;
  isRenderableExecutionProjectionNode: (node: AppNode) => boolean;
  timelineScheduleByNodeId: Map<string, TimelineScheduleLookupEntry>;
  filterState: TimelineScheduleFilterState;
  includeTimelineBranchParents: boolean;
  isHiddenExecutionTaskNode: (node: AppNode) => boolean;
  isTimelineNodeFlagged: (nodeId: string) => boolean;
  sortTimelineNodesForDisplay: (nodes: AppNode[]) => AppNode[];
  matchesNodeState: (node: AppNode) => boolean;
  shouldHideNode?: (node: AppNode) => boolean;
  shouldFlattenNode?: (node: AppNode) => boolean;
}): TimelineTreeRow[] {
  const configuredExecutionOwnerNodeIds =
    !params.hasTimelineTaskSearch && !params.hasActiveTimelineScheduleFiltering
      ? new Set(
          params.candidates
            .filter((candidate) => (params.visibleScope ? params.visibleScope.has(candidate.id) : true))
            .filter((candidate) => !isFileLikeNode(candidate) && !params.isHiddenExecutionTaskNode(candidate))
            .filter((candidate) => {
              const rawDeliverables = candidate.properties?.odeStructuredDeliverables;
              return (
                Array.isArray(rawDeliverables) &&
                rawDeliverables.some((rawDeliverable) => {
                  if (!rawDeliverable || typeof rawDeliverable !== "object") return false;
                  const record = rawDeliverable as Record<string, unknown>;
                  return typeof record.title === "string" && record.title.trim().length > 0;
                })
              );
            })
            .map((candidate) => candidate.id)
        )
      : new Set<string>();

  if (params.timelineMode === "tasks") {
    return buildFilteredScheduleTimelineRows({
      activeProjectRootId: params.activeProjectRootId,
      nodeById: params.nodeById,
      byParent: params.byParent,
      matchesNodeState: (node) => !params.isHiddenExecutionTaskNode(node) && params.matchesNodeState(node),
      timelineScheduleByNodeId: params.timelineScheduleByNodeId,
      filterState: params.filterState,
      includeBranchParents: true,
      expandedIds: params.expandedIds,
      scopedNumbering: params.scopedNumbering,
      isHiddenExecutionTaskNode: params.isHiddenExecutionTaskNode,
      isRenderableExecutionProjectionNode: params.isRenderableExecutionProjectionNode,
      sortTimelineNodesForDisplay: params.sortTimelineNodesForDisplay,
      shouldHideNode: params.shouldHideNode,
      shouldFlattenNode: params.shouldFlattenNode
    });
  }

  if (params.hasTimelineTaskSearch && params.matchedTimelineSearchNodeIds) {
    return filterTimelineRowsByMatchedBranches({
      matchedNodeIds: params.matchedTimelineSearchNodeIds,
      timelineVisibleRowIdSet: params.timelineVisibleRowIdSet,
      timelineRows: params.timelineRows,
      nodeById: params.nodeById
    });
  }

  if (params.isExecutionOnlyNodeStateFilter && !params.includeNodeStateFilterParents) {
    const groupedTasksByOwner = collectGroupedExecutionTimelineTasksByOwner({
      candidates: params.candidates,
      visibleScope: params.visibleScope,
      getExecutionTaskMeta: params.getExecutionTaskMeta,
      isRenderableExecutionProjectionNode: params.isRenderableExecutionProjectionNode,
      timelineScheduleByNodeId: params.timelineScheduleByNodeId,
      filterState: params.filterState
    });
    return buildGroupedExecutionTimelineRows({
      groupedTasksByOwner,
      ownerNodeIds: configuredExecutionOwnerNodeIds,
      nodeById: params.nodeById,
      numbering: params.numbering,
      scopedNumbering: params.scopedNumbering,
      expandedIds: params.expandedIds,
      prioritizeFlaggedTimelineTasks: params.prioritizeFlaggedTimelineTasks,
      isTimelineNodeFlagged: params.isTimelineNodeFlagged,
      alwaysExpandChildren: params.hasActiveTimelineScheduleFiltering
    });
  }

  if (
    !params.hasActiveNodeStateFiltering &&
    !params.hasActiveTimelineScheduleFiltering &&
    !params.prioritizeFlaggedTimelineTasks
  ) {
    return params.timelineRows;
  }

  return buildFilteredScheduleTimelineRows({
    activeProjectRootId: params.activeProjectRootId,
    nodeById: params.nodeById,
    byParent: params.byParent,
    matchesNodeState: params.matchesNodeState,
    timelineScheduleByNodeId: params.timelineScheduleByNodeId,
    filterState: params.filterState,
    includeBranchParents: params.includeTimelineBranchParents,
    scopedNumbering: params.scopedNumbering,
    isHiddenExecutionTaskNode: params.isHiddenExecutionTaskNode,
    isRenderableExecutionProjectionNode: params.isRenderableExecutionProjectionNode,
    sortTimelineNodesForDisplay: params.sortTimelineNodesForDisplay,
    shouldHideNode: params.shouldHideNode,
    shouldFlattenNode: params.shouldFlattenNode
  });
}

export function filterTimelineRowsByMatchedBranches(params: {
  matchedNodeIds: Set<string>;
  timelineVisibleRowIdSet: Set<string>;
  timelineRows: TimelineTreeRow[];
  nodeById: Map<string, AppNode>;
}): TimelineTreeRow[] {
  const matchedVisibleBranchIds = new Set<string>();

  for (const matchId of params.matchedNodeIds) {
    if (!params.timelineVisibleRowIdSet.has(matchId)) continue;

    let current = params.nodeById.get(matchId) ?? null;
    while (current) {
      if (params.timelineVisibleRowIdSet.has(current.id)) {
        matchedVisibleBranchIds.add(current.id);
      }
      if (!current.parentId || current.parentId === ROOT_PARENT_ID) {
        break;
      }
      current = params.nodeById.get(current.parentId) ?? null;
    }
  }

  return matchedVisibleBranchIds.size > 0
    ? params.timelineRows.filter((row) => matchedVisibleBranchIds.has(row.id))
    : [];
}

function resolveFilteredBranchVisibility(
  selfVisible: boolean,
  hasVisibleChild: boolean,
  includeParents: boolean
): { branchVisible: boolean; includeSelf: boolean } {
  const branchVisible = selfVisible || hasVisibleChild;
  const includeSelf = includeParents ? branchVisible : selfVisible && !hasVisibleChild;
  return { branchVisible, includeSelf };
}

function promoteFilteredRows(rows: TimelineTreeRow[]): TimelineTreeRow[] {
  return rows.map((row) => ({
    ...row,
    level: Math.max(0, row.level - 1)
  }));
}

export function buildFilteredScheduleTimelineRows(params: {
  activeProjectRootId: string | null;
  nodeById: Map<string, AppNode>;
  byParent: Map<string, AppNode[]>;
  matchesNodeState: (node: AppNode) => boolean;
  timelineScheduleByNodeId: Map<string, TimelineScheduleLookupEntry>;
  filterState: TimelineScheduleFilterState;
  includeBranchParents: boolean;
  expandedIds?: Set<string>;
  scopedNumbering: Map<string, string>;
  isHiddenExecutionTaskNode: (node: AppNode) => boolean;
  isRenderableExecutionProjectionNode: (node: AppNode) => boolean;
  sortTimelineNodesForDisplay: (nodes: AppNode[]) => AppNode[];
  shouldHideNode?: (node: AppNode) => boolean;
  shouldFlattenNode?: (node: AppNode) => boolean;
}): TimelineTreeRow[] {
  const visitChildren = (
    parentId: string,
    level: number
  ): { branchVisible: boolean; rows: TimelineTreeRow[] } => {
    const rows: TimelineTreeRow[] = [];
    let hasVisibleBranch = false;
    const children = params.sortTimelineNodesForDisplay(params.byParent.get(parentId) ?? []);
    for (const child of children) {
      if (isFileLikeNode(child)) continue;
      if (params.shouldHideNode?.(child)) {
        if (params.shouldFlattenNode?.(child)) {
          const nestedResult = visitChildren(child.id, level);
          if (nestedResult.branchVisible) {
            hasVisibleBranch = true;
            rows.push(...nestedResult.rows);
          }
        }
        continue;
      }
      const result = visitNode(child.id, level);
      if (result.branchVisible) {
        hasVisibleBranch = true;
        rows.push(...result.rows);
      }
    }
    return { branchVisible: hasVisibleBranch, rows };
  };

  const visitNode = (nodeId: string, level: number): { branchVisible: boolean; rows: TimelineTreeRow[] } => {
    const node = params.nodeById.get(nodeId);
    if (!node || isFileLikeNode(node)) return { branchVisible: false, rows: [] };
    if (params.shouldHideNode?.(node)) {
      if (params.shouldFlattenNode?.(node)) {
        return visitChildren(node.id, level);
      }
      return { branchVisible: false, rows: [] };
    }
    if (params.isHiddenExecutionTaskNode(node) && !params.isRenderableExecutionProjectionNode(node)) {
      return { branchVisible: false, rows: [] };
    }

    const childResult = params.isHiddenExecutionTaskNode(node)
      ? { branchVisible: false, rows: [] as TimelineTreeRow[] }
      : visitChildren(node.id, level + 1);
    const hasVisibleChild = childResult.branchVisible;
    const childRows = childResult.rows;

    const selfVisible =
      params.matchesNodeState(node) &&
      matchesTimelineScheduleFilters(params.timelineScheduleByNodeId.get(node.id), params.filterState);
    const { branchVisible, includeSelf } = resolveFilteredBranchVisibility(
      selfVisible,
      hasVisibleChild,
      params.includeBranchParents
    );

    const rows: TimelineTreeRow[] = [];
    if (includeSelf) {
      const hasChildren = childRows.length > 0;
      rows.push({
        id: node.id,
        node,
        level,
        indexLabel: params.scopedNumbering.get(node.id) ?? "",
        hasChildren
      });
      if (!hasChildren || !params.expandedIds || params.expandedIds.has(node.id)) {
        rows.push(...childRows);
      }
    } else {
      rows.push(...promoteFilteredRows(childRows));
    }
    return { branchVisible, rows };
  };

  if (params.activeProjectRootId) {
    const rootResult = visitNode(params.activeProjectRootId, 0);
    if (rootResult.rows.length > 0 && rootResult.rows[0]?.id === params.activeProjectRootId) {
      return rootResult.rows;
    }
    return visitChildren(params.activeProjectRootId, 0).rows;
  }

  return visitChildren(ROOT_PARENT_ID, 0).rows;
}
