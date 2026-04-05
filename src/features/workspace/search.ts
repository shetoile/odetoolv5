import type { TimelinePriority } from "@/features/timeline/filterState";
import { compareTimelineNodeFlaggedState } from "@/features/timeline/display";
import type {
  NodeStateFilter,
  SelectionSurface,
  WorkspaceFocusMode,
  WorkspaceMode
} from "@/features/workspace/viewMode";
import {
  ROOT_PARENT_ID,
  type AppNode,
  type FolderNodeState,
  type ScheduleStatus,
  isFileLikeNode
} from "@/lib/types";
import { getNodeDisplayName, shouldHideNodeFromGenericUi } from "@/lib/nodeDisplay";

export function buildNodeSearchPathLabel(node: AppNode, nodeById: Map<string, AppNode>): string {
  const fullPathNames: string[] = [];
  const visited = new Set<string>();
  let current: AppNode | null = node;

  while (current) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    if (!shouldHideNodeFromGenericUi(current)) {
      fullPathNames.push(getNodeDisplayName(current));
    }
    if (!current.parentId || current.parentId === ROOT_PARENT_ID) break;
    current = nodeById.get(current.parentId) ?? null;
  }

  const orderedPathNames = fullPathNames.reverse();
  if (orderedPathNames.length <= 1) {
    return orderedPathNames[0] ?? "";
  }
  return orderedPathNames.slice(0, -1).join(" / ");
}

export function scoreTimelineSearchResult(
  node: AppNode,
  pathLabel: string,
  normalizedQuery: string,
  queryTerms: string[]
): number | null {
  if (!normalizedQuery || queryTerms.length === 0) return null;

  const name = node.name.toLowerCase();
  const path = pathLabel.toLowerCase();
  const searchableText = `${name}\n${path}`;
  const fullQueryMatch = searchableText.includes(normalizedQuery);
  const allTermsMatch = queryTerms.every((term) => searchableText.includes(term));

  if (!fullQueryMatch && !allTermsMatch) {
    return null;
  }

  let score = 0;

  if (name === normalizedQuery) {
    score += 1000;
  } else if (name.startsWith(normalizedQuery)) {
    score += 700;
  } else if (name.includes(normalizedQuery)) {
    score += 450;
  }

  if (path === normalizedQuery) {
    score += 400;
  } else if (path.startsWith(normalizedQuery)) {
    score += 220;
  } else if (path.includes(normalizedQuery)) {
    score += 120;
  }

  queryTerms.forEach((term) => {
    if (name.includes(term)) score += 90;
    if (path.includes(term)) score += 35;
  });

  return score;
}

export function buildSidebarSearchResults(params: {
  searchQuery: string;
  searchResults: AppNode[];
  nodeById: Map<string, AppNode>;
  projectScopedNodeIds: Set<string> | null;
  searchUsesNodeStateScope: boolean;
  searchFocusMode: WorkspaceFocusMode;
  activeNodeStateFilters: Set<NodeStateFilter>;
  filterFolderNodeStateById: Map<string, FolderNodeState>;
  doesNodeMatchNodeStateFilters: (
    node: AppNode,
    filters: Set<NodeStateFilter>,
    folderStateById: Map<string, FolderNodeState>,
    executionOwnerNodeIds: Set<string>
  ) => boolean;
  limit?: number;
}): Array<{ id: string; node: AppNode; pathLabel: string }> {
  const normalizedQuery = params.searchQuery.trim().toLowerCase();
  const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);
  if (!normalizedQuery || queryTerms.length === 0) return [];

  const matchedResults = params.searchResults
    .filter((item) => params.nodeById.has(item.id))
    .filter((item) => !shouldHideNodeFromGenericUi(item))
    .filter((item) => (params.projectScopedNodeIds ? params.projectScopedNodeIds.has(item.id) : true))
    .filter((item) => {
      if (!params.searchUsesNodeStateScope || params.searchFocusMode === "execution") return true;
      return params.doesNodeMatchNodeStateFilters(
        item,
        params.activeNodeStateFilters,
        params.filterFolderNodeStateById,
        new Set<string>()
      );
    })
    .map((item) => {
      const pathLabel = buildNodeSearchPathLabel(item, params.nodeById);
      const displayName = getNodeDisplayName(item);
      const name = displayName.toLowerCase();
      const path = pathLabel.toLowerCase();
      const nameMatch =
        name.includes(normalizedQuery) || queryTerms.every((term) => name.includes(term));
      const pathMatch =
        path.includes(normalizedQuery) || queryTerms.every((term) => path.includes(term));

      if (!nameMatch && !pathMatch) {
        return null;
      }

      let score = 0;
      if (name === normalizedQuery) {
        score += 1000;
      } else if (name.startsWith(normalizedQuery)) {
        score += 700;
      } else if (name.includes(normalizedQuery)) {
        score += 450;
      }

      if (!nameMatch) {
        if (path === normalizedQuery) {
          score += 180;
        } else if (path.startsWith(normalizedQuery)) {
          score += 120;
        } else if (path.includes(normalizedQuery)) {
          score += 60;
        }
      }

      queryTerms.forEach((term) => {
        if (name.includes(term)) score += 90;
        if (!nameMatch && path.includes(term)) score += 18;
      });

      return {
        id: item.id,
        node: item,
        pathLabel,
        displayName,
        score,
        nameMatch
      };
    })
    .filter(
      (
        item
      ): item is {
        id: string;
        node: AppNode;
        pathLabel: string;
        displayName: string;
        score: number;
        nameMatch: boolean;
      } => item !== null
    );

  const hasNameMatch = matchedResults.some((item) => item.nameMatch);

  return matchedResults
    .filter((item) => !hasNameMatch || item.nameMatch)
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      if (left.node.updatedAt !== right.node.updatedAt) {
        return right.node.updatedAt - left.node.updatedAt;
      }
      if (left.node.order !== right.node.order) return left.node.order - right.node.order;
      return left.displayName.localeCompare(right.displayName);
    })
    .slice(0, params.limit ?? 24)
    .map(({ score: _score, nameMatch: _nameMatch, displayName: _displayName, ...item }) => item);
}

export function buildTimelineSearchResults(params: {
  searchQuery: string;
  nodes: AppNode[];
  nodeById: Map<string, AppNode>;
  projectScopedNodeIds: Set<string> | null;
  timelineScheduleByNodeId: Map<
    string,
    | {
        schedule: {
          status?: ScheduleStatus;
          priority?: TimelinePriority;
        };
      }
    | null
  >;
  hasActiveTimelineStatusFiltering: boolean;
  hasActiveTimelinePriorityFiltering: boolean;
  activeTimelineStatusFilters: Set<ScheduleStatus>;
  activeTimelinePriorityFilters: Set<TimelinePriority>;
  timelineVisibleRowIdSet: Set<string>;
  timelineMode: "schedule" | "tasks";
  isExecutionTaskNode: (node: AppNode) => boolean;
  isRenderableExecutionProjectionNode: (node: AppNode) => boolean;
  prioritizeFlaggedTimelineTasks: boolean;
  isTimelineNodeFlagged: (nodeId: string) => boolean;
  limit?: number;
}): Array<{ id: string; node: AppNode; pathLabel: string }> {
  const normalizedQuery = params.searchQuery.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);
  if (queryTerms.length === 0) return [];

  const matchedResults = params.nodes
    .filter((node) => params.nodeById.has(node.id))
    .filter((node) => !shouldHideNodeFromGenericUi(node))
    .filter((node) => (params.projectScopedNodeIds ? params.projectScopedNodeIds.has(node.id) : true))
    .map((node) => {
      const isExecutionTaskNode = params.isExecutionTaskNode(node);
      const isVisibleTimelineNode = params.timelineVisibleRowIdSet.has(node.id);
      const timelineEntry = params.timelineScheduleByNodeId.get(node.id) ?? null;

      if (params.timelineMode === "tasks") {
        if (!isVisibleTimelineNode && !isExecutionTaskNode) return null;
        if (isExecutionTaskNode && !isVisibleTimelineNode && !params.isRenderableExecutionProjectionNode(node)) {
          return null;
        }
        if (timelineEntry) {
          const scheduleStatus = timelineEntry.schedule.status ?? "planned";
          const schedulePriority = timelineEntry.schedule.priority ?? "normal";
          if (
            params.hasActiveTimelineStatusFiltering &&
            !params.activeTimelineStatusFilters.has(scheduleStatus)
          ) {
            return null;
          }
          if (
            params.hasActiveTimelinePriorityFiltering &&
            !params.activeTimelinePriorityFilters.has(schedulePriority)
          ) {
            return null;
          }
        }
      } else {
        if (isExecutionTaskNode) return null;
        if (!isVisibleTimelineNode) return null;
        if (timelineEntry) {
          const scheduleStatus = timelineEntry.schedule.status ?? "planned";
          const schedulePriority = timelineEntry.schedule.priority ?? "normal";
          if (
            params.hasActiveTimelineStatusFiltering &&
            !params.activeTimelineStatusFilters.has(scheduleStatus)
          ) {
            return null;
          }
          if (
            params.hasActiveTimelinePriorityFiltering &&
            !params.activeTimelinePriorityFilters.has(schedulePriority)
          ) {
            return null;
          }
        }
      }

      if (params.timelineMode !== "tasks" && !isVisibleTimelineNode) {
        return null;
      }

      const pathLabel = buildNodeSearchPathLabel(node, params.nodeById);
      const displayName = getNodeDisplayName(node);
      const name = displayName.toLowerCase();
      const path = pathLabel.toLowerCase();
      const nameMatch =
        name.includes(normalizedQuery) || queryTerms.every((term) => name.includes(term));
      const pathMatch =
        path.includes(normalizedQuery) || queryTerms.every((term) => path.includes(term));

      if (!nameMatch && !pathMatch) {
        return null;
      }

      const score = scoreTimelineSearchResult(node, pathLabel, normalizedQuery, queryTerms);
      if (score === null) return null;

      return {
        id: node.id,
        node,
        pathLabel,
        displayName,
        score,
        nameMatch
      };
    })
    .filter(
      (
        entry
      ): entry is {
        id: string;
        node: AppNode;
        pathLabel: string;
        displayName: string;
        score: number;
        nameMatch: boolean;
      } => entry !== null && typeof entry.score === "number"
    );

  const hasNameMatch = matchedResults.some((entry) => entry.nameMatch);

  return matchedResults
    .filter((entry) => !hasNameMatch || entry.nameMatch)
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      const flaggedCompare = compareTimelineNodeFlaggedState({
        leftNodeId: left.node.id,
        rightNodeId: right.node.id,
        prioritizeFlagged: params.prioritizeFlaggedTimelineTasks,
        isTimelineNodeFlagged: params.isTimelineNodeFlagged
      });
      if (flaggedCompare !== 0) {
        return flaggedCompare;
      }
      if (left.node.updatedAt !== right.node.updatedAt) {
        return right.node.updatedAt - left.node.updatedAt;
      }
      if (left.node.order !== right.node.order) return left.node.order - right.node.order;
      return left.displayName.localeCompare(right.displayName);
    })
    .slice(0, params.limit ?? 24)
    .map(({ score: _score, nameMatch: _nameMatch, displayName: _displayName, ...result }) => result);
}

export function collectAncestorNodeIds(nodeId: string, nodeById: Map<string, AppNode>): string[] {
  const ids: string[] = [];
  let current = nodeById.get(nodeId);
  while (current && current.parentId !== ROOT_PARENT_ID) {
    ids.push(current.parentId);
    current = nodeById.get(current.parentId);
  }
  return ids;
}

export function resolveSearchResultNavigationParentId(target: AppNode): string | null {
  return target.parentId === ROOT_PARENT_ID ? null : target.parentId;
}

export function resolveSearchResultSelectionSurface(
  workspaceMode: WorkspaceMode,
  target: AppNode
): SelectionSurface {
  if (workspaceMode === "timeline" && !isFileLikeNode(target)) {
    return "timeline";
  }
  if (workspaceMode === "grid") {
    return "grid";
  }
  return "tree";
}
