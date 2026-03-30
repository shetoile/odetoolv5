import type { SelectionSurface } from "@/features/workspace/viewMode";
import type { AppNode } from "@/lib/types";

type ActionSelectionBaseParams = {
  sourceNodeId?: string | null;
  selectedNodeId: string | null;
  selectedNodeIds: Set<string>;
  nodeById: Map<string, AppNode>;
  filterDescendants?: boolean;
  isNodeInSubtree?: (ancestorId: string, candidateId: string) => boolean;
};

export function resolveActionSelectionIds(params: ActionSelectionBaseParams): string[] {
  const selectedIds = params.selectedNodeIds.size > 1 ? Array.from(params.selectedNodeIds) : [];
  const fallbackSelectedNodeId =
    params.selectedNodeId && params.nodeById.has(params.selectedNodeId) ? params.selectedNodeId : null;
  const candidateIds =
    selectedIds.length > 1
      ? !params.sourceNodeId || selectedIds.includes(params.sourceNodeId)
        ? selectedIds
        : [params.sourceNodeId]
      : params.sourceNodeId
        ? [params.sourceNodeId]
        : fallbackSelectedNodeId
          ? [fallbackSelectedNodeId]
          : Array.from(params.selectedNodeIds);

  const unique = Array.from(new Set(candidateIds)).filter((id) => params.nodeById.has(id));
  if (!params.filterDescendants || !params.isNodeInSubtree) {
    return unique;
  }

  return unique.filter(
    (candidate) => !unique.some((other) => other !== candidate && params.isNodeInSubtree?.(other, candidate))
  );
}

export function resolveOrderedActionSelectionIds(
  params: ActionSelectionBaseParams & {
    surface: SelectionSurface;
    displayedTreeIndexById: Map<string, number>;
    displayedGridIndexById: Map<string, number>;
    displayedTimelineIndexById: Map<string, number>;
    fallbackIndexById: Map<string, number>;
  }
): string[] {
  const unique = resolveActionSelectionIds(params);
  const orderIndexById =
    params.surface === "grid"
      ? params.displayedGridIndexById
      : params.surface === "timeline"
        ? params.displayedTimelineIndexById
        : params.displayedTreeIndexById;

  return unique.sort((left, right) => {
    const leftIndex =
      orderIndexById.get(left) ?? params.fallbackIndexById.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex =
      orderIndexById.get(right) ?? params.fallbackIndexById.get(right) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  });
}

export function resolveVisibleActionIdsForSurface(params: {
  surface: SelectionSurface;
  treeRowIds: string[];
  gridNodeIds: string[];
  timelineRowIds: string[];
}): string[] {
  if (params.surface === "timeline") return params.timelineRowIds;
  if (params.surface === "grid") return params.gridNodeIds;
  return params.treeRowIds;
}

export function resolveNextVisibleActionSelectionId(params: {
  removedIds: string[];
  visibleIds: string[];
}): string | null {
  if (params.removedIds.length === 0 || params.visibleIds.length === 0) return null;
  const removedIdSet = new Set(params.removedIds);
  const selectedVisibleIndexes = params.visibleIds
    .map((id, index) => (removedIdSet.has(id) ? index : -1))
    .filter((index) => index >= 0);

  if (selectedVisibleIndexes.length === 0) return null;

  const firstIndex = Math.min(...selectedVisibleIndexes);
  const lastIndex = Math.max(...selectedVisibleIndexes);

  for (let index = lastIndex + 1; index < params.visibleIds.length; index += 1) {
    if (!removedIdSet.has(params.visibleIds[index])) {
      return params.visibleIds[index];
    }
  }

  for (let index = firstIndex - 1; index >= 0; index -= 1) {
    if (!removedIdSet.has(params.visibleIds[index])) {
      return params.visibleIds[index];
    }
  }

  return null;
}
