import type { SelectionSurface, WorkspaceMode } from "@/features/workspace/viewMode";
import { ROOT_PARENT_ID, type AppNode } from "@/lib/types";

export type ProvisionalInlineCreateState = {
  fallbackSelectionId: string | null;
  surface: SelectionSurface;
  expandNodeIds: string[];
};

export function resolveInlineEditSurface(params: {
  surface?: SelectionSurface | null;
  workspaceMode: WorkspaceMode;
  selectionSurface: SelectionSurface;
}): SelectionSurface {
  if (params.surface === "timeline" || params.surface === "grid" || params.surface === "tree") {
    return params.surface;
  }
  if (params.workspaceMode === "timeline") return "timeline";
  return params.selectionSurface === "grid" ? "grid" : "tree";
}

export function setProvisionalInlineCreateState(
  currentMap: Map<string, ProvisionalInlineCreateState>,
  nodeId: string,
  state: ProvisionalInlineCreateState
): Map<string, ProvisionalInlineCreateState> {
  const next = new Map(currentMap);
  next.set(nodeId, state);
  return next;
}

export function removeProvisionalInlineCreateState(
  currentMap: Map<string, ProvisionalInlineCreateState>,
  nodeId: string
): Map<string, ProvisionalInlineCreateState> {
  if (!currentMap.has(nodeId)) return currentMap;
  const next = new Map(currentMap);
  next.delete(nodeId);
  return next;
}

export function resolveInlineEditFallbackSelectionId(
  provisional: ProvisionalInlineCreateState,
  node: AppNode | null,
  activeProjectRootId: string | null
): string | null {
  if (provisional.fallbackSelectionId) return provisional.fallbackSelectionId;
  if (!node) return activeProjectRootId ?? null;
  return node.parentId !== ROOT_PARENT_ID ? node.parentId : activeProjectRootId ?? null;
}
