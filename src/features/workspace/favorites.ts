import type { AppNode } from "@/lib/types";

export type FavoriteGroupOption = {
  id: string;
  name: string;
};

export type FavoriteQuickAccessState = {
  hasFavoriteQuickAccess: boolean;
  desktopUsesFavoriteQuickAccess: boolean;
  desktopGridEmptyStateMessage: string;
  desktopGridShowCreateFirstNodeAction: boolean;
};

export type FavoriteGroupSelectionState = "none" | "some" | "all";

export type FavoriteToggleIntent =
  | {
      kind: "active_group";
      groupId: string;
      shouldRemove: boolean;
    }
  | {
      kind: "known_group";
      groupId: string;
      shouldRemove: boolean;
    }
  | {
      kind: "remove_all";
    }
  | {
      kind: "open_assign";
    };

export function isNodeFavorite(node: AppNode | null | undefined): boolean {
  if (!node) return false;
  const raw = node.properties?.favorite;
  return raw === true || raw === "true" || raw === 1;
}

export function normalizeFavoriteGroupIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const dedupe = new Set<string>();
  const ids: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const normalized = item.trim();
    if (!normalized || dedupe.has(normalized)) continue;
    dedupe.add(normalized);
    ids.push(normalized);
  }
  return ids;
}

export function getNodeFavoriteGroupIds(node: AppNode | null | undefined): string[] {
  if (!node || !isNodeFavorite(node)) return [];
  const rawGroupIds = node.properties?.favoriteGroupIds ?? node.properties?.favoriteGroups;
  return normalizeFavoriteGroupIds(rawGroupIds);
}

export function resolveExistingFavoriteGroupId(
  nameInput: string,
  favoriteGroups: FavoriteGroupOption[]
): string | null {
  const normalizedName = nameInput.trim().toLowerCase();
  if (!normalizedName) return null;
  const existing = favoriteGroups.find(
    (group) => group.name.trim().toLowerCase() === normalizedName
  );
  return existing?.id ?? null;
}

export function resolveFavoriteAssignDefaultGroupIds(params: {
  currentGroupIds: string[];
  favoriteGroups: FavoriteGroupOption[];
  activeFavoriteGroupId: string;
  allGroupId: string;
}): string[] {
  const knownFavoriteGroupIds = new Set(params.favoriteGroups.map((group) => group.id));
  const currentKnownGroupIds = params.currentGroupIds.filter((groupId) =>
    knownFavoriteGroupIds.has(groupId)
  );
  const fallbackGroupId =
    params.activeFavoriteGroupId !== params.allGroupId &&
    knownFavoriteGroupIds.has(params.activeFavoriteGroupId)
      ? params.activeFavoriteGroupId
      : params.favoriteGroups[0]?.id ?? "";
  return currentKnownGroupIds.length > 0
    ? currentKnownGroupIds
    : fallbackGroupId
      ? [fallbackGroupId]
      : [];
}

function resolveSelectionState(matchCount: number, totalCount: number): FavoriteGroupSelectionState {
  if (totalCount <= 0 || matchCount <= 0) return "none";
  if (matchCount >= totalCount) return "all";
  return "some";
}

export function resolveFavoriteSelectionState<TNode>(params: {
  nodes: TNode[];
  isFavoriteNode: (node: TNode) => boolean;
}): FavoriteGroupSelectionState {
  const totalCount = params.nodes.length;
  const matchCount = params.nodes.reduce(
    (count, node) => count + (params.isFavoriteNode(node) ? 1 : 0),
    0
  );
  return resolveSelectionState(matchCount, totalCount);
}

export function resolveFavoriteGroupMembershipState<TNode>(params: {
  nodes: TNode[];
  groupId: string;
  getNodeGroupIds: (node: TNode) => string[];
}): FavoriteGroupSelectionState {
  const totalCount = params.nodes.length;
  const matchCount = params.nodes.reduce(
    (count, node) => count + (params.getNodeGroupIds(node).includes(params.groupId) ? 1 : 0),
    0
  );
  return resolveSelectionState(matchCount, totalCount);
}

export function buildFavoriteGroupSelectionStateMap<TNode>(params: {
  nodes: TNode[];
  favoriteGroups: FavoriteGroupOption[];
  getNodeGroupIds: (node: TNode) => string[];
}): Record<string, FavoriteGroupSelectionState> {
  const states: Record<string, FavoriteGroupSelectionState> = {};
  for (const group of params.favoriteGroups) {
    states[group.id] = resolveFavoriteGroupMembershipState({
      nodes: params.nodes,
      groupId: group.id,
      getNodeGroupIds: params.getNodeGroupIds
    });
  }
  return states;
}

export function toggleFavoriteGroupSelectionState(
  currentState: FavoriteGroupSelectionState
): FavoriteGroupSelectionState {
  return currentState === "all" ? "none" : "all";
}

export function resolveFavoriteMoveState(params: {
  currentGroupIds: string[];
  favoriteGroups: FavoriteGroupOption[];
  targetGroupId: string | null;
}): {
  normalizedTargetGroupId: string | null;
  currentKnownGroupIds: string[];
  nextGroupIds: string[];
  unchanged: boolean;
} {
  const knownFavoriteGroupIds = new Set(params.favoriteGroups.map((group) => group.id));
  const currentKnownGroupIds = params.currentGroupIds.filter((groupId) =>
    knownFavoriteGroupIds.has(groupId)
  );
  const preservedUnknownGroupIds = params.currentGroupIds.filter(
    (groupId) => !knownFavoriteGroupIds.has(groupId)
  );
  const normalizedTargetGroupId =
    params.targetGroupId && knownFavoriteGroupIds.has(params.targetGroupId)
      ? params.targetGroupId
      : null;
  const nextGroupIds = normalizedTargetGroupId
    ? Array.from(new Set([...preservedUnknownGroupIds, normalizedTargetGroupId]))
    : preservedUnknownGroupIds;
  const unchanged =
    currentKnownGroupIds.length === (normalizedTargetGroupId ? 1 : 0) &&
    (normalizedTargetGroupId === null || currentKnownGroupIds[0] === normalizedTargetGroupId);

  return {
    normalizedTargetGroupId,
    currentKnownGroupIds,
    nextGroupIds,
    unchanged
  };
}

export function resolveFavoriteToggleIntent(params: {
  activeFavoriteGroupId: string;
  favoriteGroups: FavoriteGroupOption[];
  currentGroupIds: string[];
  sourceNodeIsFavorite: boolean;
  allGroupId: string;
}): FavoriteToggleIntent {
  const hasActiveGroupContext =
    params.activeFavoriteGroupId !== params.allGroupId &&
    params.favoriteGroups.some((group) => group.id === params.activeFavoriteGroupId);
  if (hasActiveGroupContext) {
    return {
      kind: "active_group",
      groupId: params.activeFavoriteGroupId,
      shouldRemove: params.currentGroupIds.includes(params.activeFavoriteGroupId)
    };
  }

  if (params.favoriteGroups.length > 0) {
    const knownFavoriteGroupIds = new Set(params.favoriteGroups.map((group) => group.id));
    const knownCurrentGroupIds = params.currentGroupIds.filter((groupId) =>
      knownFavoriteGroupIds.has(groupId)
    );
    const groupId = knownCurrentGroupIds[0] ?? params.favoriteGroups[0].id;
    return {
      kind: "known_group",
      groupId,
      shouldRemove: knownCurrentGroupIds.includes(groupId)
    };
  }

  return params.sourceNodeIsFavorite ? { kind: "remove_all" } : { kind: "open_assign" };
}

export function buildQuickAccessMindMapGroups<TNode>(params: {
  favoriteGroups: FavoriteGroupOption[];
  activeFavoriteGroupId: string;
  allGroupId: string;
  favoriteNodes: TNode[];
  getNodeGroupIds: (node: TNode) => string[];
  ungroupedId: string;
  ungroupedName: string;
}): Array<{ id: string; name: string; nodes: TNode[]; synthetic?: boolean }> {
  if (params.favoriteGroups.length === 0) return [];

  const hasFocusedFavoriteGroup =
    params.activeFavoriteGroupId !== params.allGroupId &&
    params.favoriteGroups.some((group) => group.id === params.activeFavoriteGroupId);
  const visibleGroups = hasFocusedFavoriteGroup
    ? params.favoriteGroups.filter((group) => group.id === params.activeFavoriteGroupId)
    : params.favoriteGroups;

  const favoriteGroupMap = new Map(
    visibleGroups.map((group) => [group.id, { ...group, nodes: [] as TNode[] }])
  );
  const ungroupedNodes: TNode[] = [];

  params.favoriteNodes.forEach((node) => {
    const groupIds = params.getNodeGroupIds(node).filter((groupId) =>
      favoriteGroupMap.has(groupId)
    );
    if (groupIds.length === 0) {
      if (!hasFocusedFavoriteGroup) {
        ungroupedNodes.push(node);
      }
      return;
    }
    groupIds.forEach((groupId) => {
      favoriteGroupMap.get(groupId)?.nodes.push(node);
    });
  });

  const grouped = visibleGroups
    .map((group) => favoriteGroupMap.get(group.id))
    .filter(
      (
        group
      ): group is {
        id: string;
        name: string;
        nodes: TNode[];
        synthetic?: boolean;
      } => Boolean(group && group.nodes.length > 0)
    );

  if (!hasFocusedFavoriteGroup && ungroupedNodes.length > 0) {
    grouped.push({
      id: params.ungroupedId,
      name: params.ungroupedName,
      nodes: ungroupedNodes,
      synthetic: true
    });
  }

  return grouped;
}

export function buildFavoriteNodes<TNode extends { id: string; name: string }>(params: {
  nodes: TNode[];
  projectScopedNodeIds: Set<string> | null;
  isFavoriteNode: (node: TNode) => boolean;
  primaryOrderById: Map<string, string>;
  fallbackOrderById: Map<string, string>;
}): TNode[] {
  const filteredNodes = params.nodes.filter((node) => {
    if (!params.isFavoriteNode(node)) return false;
    return params.projectScopedNodeIds ? params.projectScopedNodeIds.has(node.id) : true;
  });

  filteredNodes.sort((left, right) => {
    const leftOrder = params.primaryOrderById.get(left.id) ?? params.fallbackOrderById.get(left.id) ?? "";
    const rightOrder =
      params.primaryOrderById.get(right.id) ?? params.fallbackOrderById.get(right.id) ?? "";
    const orderComparison = leftOrder.localeCompare(rightOrder, undefined, { numeric: true });
    if (orderComparison !== 0) return orderComparison;
    return left.name.localeCompare(right.name);
  });

  return filteredNodes;
}

export function filterFavoriteNodesByActiveGroup<TNode>(params: {
  activeFavoriteGroupId: string;
  allGroupId: string;
  favoriteNodes: TNode[];
  getNodeGroupIds: (node: TNode) => string[];
}): TNode[] {
  if (params.activeFavoriteGroupId === params.allGroupId) {
    return params.favoriteNodes;
  }

  return params.favoriteNodes.filter((node) =>
    params.getNodeGroupIds(node).includes(params.activeFavoriteGroupId)
  );
}

export function filterFavoriteNodesBySelectedGroups<TNode>(params: {
  selectedFavoriteGroupIds: string[];
  favoriteNodes: TNode[];
  getNodeGroupIds: (node: TNode) => string[];
}): TNode[] {
  if (params.selectedFavoriteGroupIds.length === 0) {
    return params.favoriteNodes;
  }

  const selectedGroupIdSet = new Set(params.selectedFavoriteGroupIds);
  return params.favoriteNodes.filter((node) =>
    params.getNodeGroupIds(node).some((groupId) => selectedGroupIdSet.has(groupId))
  );
}

export function buildFavoriteTreeFilterNodeIds<TNode extends { id: string; type: string }>(params: {
  hasActiveFavoriteGroupTreeFiltering: boolean;
  selectedFavoriteGroupIds: string[];
  favoriteNodes: TNode[];
  getNodeGroupIds: (node: TNode) => string[];
  byParent: Map<string, Array<{ id: string }>>;
  nodeById: Map<string, { id: string; parentId: string }>;
}): Set<string> | null {
  if (!params.hasActiveFavoriteGroupTreeFiltering) return null;

  const matchingFavoriteNodes = filterFavoriteNodesBySelectedGroups({
    selectedFavoriteGroupIds: params.selectedFavoriteGroupIds,
    favoriteNodes: params.favoriteNodes,
    getNodeGroupIds: params.getNodeGroupIds
  });
  const visibleIds = new Set<string>();

  const addAncestors = (nodeId: string) => {
    let current = params.nodeById.get(nodeId) ?? null;
    while (current) {
      if (visibleIds.has(current.id)) break;
      visibleIds.add(current.id);
      current = params.nodeById.get(current.parentId) ?? null;
    }
  };

  const addDescendants = (nodeId: string) => {
    const stack = [nodeId];
    while (stack.length > 0) {
      const currentId = stack.pop();
      if (!currentId || visibleIds.has(currentId)) continue;
      visibleIds.add(currentId);
      const children = params.byParent.get(currentId) ?? [];
      for (const child of children) {
        stack.push(child.id);
      }
    }
  };

  for (const node of matchingFavoriteNodes) {
    addAncestors(node.id);
    if (node.type !== "file") {
      addDescendants(node.id);
    } else {
      visibleIds.add(node.id);
    }
  }

  return visibleIds;
}

export function resolveDesktopFavoriteQuickAccessState(params: {
  workspaceMode: "grid" | "timeline";
  desktopViewMode: "grid" | "mindmap" | "details" | "procedure";
  workspaceFocusMode: "structure" | "data" | "execution";
  favoriteGroupTreeFilterEnabled: boolean;
  favoriteNodeCount: number;
  favoriteGroupCount: number;
  activeFavoriteGroupId: string;
  allGroupId: string;
  desktopEmptyStateMessage: string;
  desktopShowCreateFirstNodeAction: boolean;
  favoriteEmptyHint: string;
  favoriteEmptyGroupHint: string;
}): FavoriteQuickAccessState {
  const hasFavoriteQuickAccess =
    params.favoriteNodeCount > 0 || params.favoriteGroupCount > 0;
  const desktopUsesFavoriteQuickAccess =
    params.workspaceMode === "grid" &&
    params.desktopViewMode === "grid" &&
    params.workspaceFocusMode === "structure" &&
    hasFavoriteQuickAccess &&
    params.favoriteGroupTreeFilterEnabled;

  return {
    hasFavoriteQuickAccess,
    desktopUsesFavoriteQuickAccess,
    desktopGridEmptyStateMessage: desktopUsesFavoriteQuickAccess
      ? params.activeFavoriteGroupId === params.allGroupId
        ? params.favoriteEmptyHint
        : params.favoriteEmptyGroupHint
      : params.desktopEmptyStateMessage,
    desktopGridShowCreateFirstNodeAction: desktopUsesFavoriteQuickAccess
      ? false
      : params.desktopShowCreateFirstNodeAction
  };
}
