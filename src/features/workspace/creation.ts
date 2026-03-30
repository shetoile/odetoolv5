import type { SelectionSurface, WorkspaceMode } from "@/features/workspace/viewMode";
import { ROOT_PARENT_ID, isFileLikeNode, type AppNode } from "@/lib/types";

export function resolveImportParentNodeId(params: {
  targetNode: AppNode | null;
  surface: SelectionSurface;
  currentFolderId: string | null;
  activeProjectRootId: string | null;
}): string | null {
  if (params.targetNode) {
    if (!isFileLikeNode(params.targetNode)) return params.targetNode.id;
    return params.targetNode.parentId === ROOT_PARENT_ID ? null : params.targetNode.parentId;
  }

  return params.surface === "grid"
    ? params.currentFolderId ?? params.activeProjectRootId ?? null
    : params.activeProjectRootId ?? null;
}

export function resolvePostImportSelectionSurface(surface: SelectionSurface): SelectionSurface {
  return surface === "timeline" ? "tree" : surface;
}

export function resolveEffectiveCreationSurfaceForWorkspace(
  surface: SelectionSurface,
  workspaceMode: WorkspaceMode
): SelectionSurface {
  if (surface === "timeline") return "timeline";
  if (surface === "grid") return "grid";
  if (surface === "tree") return "tree";
  return workspaceMode === "timeline" ? "timeline" : "grid";
}

export function resolveVisibleSelectionForSurface(params: {
  selectedNode: AppNode | null;
  projectScopedNodeIds: Set<string> | null;
  surface: SelectionSurface;
  displayedTreeIndexById: Map<string, number>;
  displayedGridIndexById: Map<string, number>;
  displayedTimelineIndexById: Map<string, number>;
}): AppNode | null {
  const selectedNode = params.selectedNode;
  if (!selectedNode) return null;
  if (params.projectScopedNodeIds && !params.projectScopedNodeIds.has(selectedNode.id)) return null;
  if (params.surface === "grid") {
    return params.displayedGridIndexById.has(selectedNode.id) ? selectedNode : null;
  }
  if (params.surface === "timeline") {
    return params.displayedTimelineIndexById.has(selectedNode.id) ? selectedNode : null;
  }
  return params.displayedTreeIndexById.has(selectedNode.id) ? selectedNode : null;
}

export function resolveStructuralCreationTargetNode(
  node: AppNode | null,
  resolveExecutionOwnerNode: (node: AppNode) => AppNode | null
): AppNode | null {
  if (!node) return null;
  if (isFileLikeNode(node)) return node;
  return resolveExecutionOwnerNode(node) ?? node;
}

export function resolveDefaultCreationParentNodeId(params: {
  resolvedSurface: SelectionSurface;
  currentFolderId: string | null;
  activeProjectRootId: string | null;
}): string | null {
  return params.resolvedSurface === "grid"
    ? params.currentFolderId ?? params.activeProjectRootId ?? null
    : params.activeProjectRootId ?? null;
}
