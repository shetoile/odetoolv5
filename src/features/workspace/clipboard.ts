import type { SelectionSurface } from "@/features/workspace/viewMode";
import { ROOT_PARENT_ID, type AppNode } from "@/lib/types";

export function resolveClipboardPasteLocation(params: {
  targetNode: AppNode | null;
  surface: SelectionSurface;
  currentFolderId: string | null;
  activeProjectRootId: string | null;
  byParent: Map<string, AppNode[]>;
  excludedNodeIds: Set<string>;
}): {
  parentId: string | null;
  targetParentKey: string;
  afterId: string | null;
} {
  if (params.targetNode) {
    if (params.targetNode.type === "folder") {
      const children = (params.byParent.get(params.targetNode.id) ?? []).filter(
        (child) => !params.excludedNodeIds.has(child.id)
      );
      return {
        parentId: params.targetNode.id,
        targetParentKey: params.targetNode.id,
        afterId: children.length > 0 ? children[children.length - 1].id : null
      };
    }

    return {
      parentId: params.targetNode.parentId === ROOT_PARENT_ID ? null : params.targetNode.parentId,
      targetParentKey: params.targetNode.parentId,
      afterId: params.targetNode.id
    };
  }

  const parentId =
    params.surface === "grid"
      ? (params.currentFolderId ?? params.activeProjectRootId ?? null)
      : (params.activeProjectRootId ?? null);
  const targetParentKey = parentId ?? ROOT_PARENT_ID;
  const siblings = (params.byParent.get(targetParentKey) ?? []).filter(
    (item) => !params.excludedNodeIds.has(item.id)
  );

  return {
    parentId,
    targetParentKey,
    afterId: siblings.length > 0 ? siblings[siblings.length - 1].id : null
  };
}

export function resolveMovableClipboardSourceIds(params: {
  sourceNodeIds: string[];
  targetNode: AppNode | null;
  parentId: string | null;
  nodeById: Map<string, AppNode>;
  isNodeInSubtree: (ancestorId: string, candidateId: string) => boolean;
}): string[] {
  return params.sourceNodeIds.filter((sourceId) => {
    if (!params.nodeById.has(sourceId)) return false;
    if (params.targetNode && sourceId === params.targetNode.id) return false;
    if (params.parentId && params.isNodeInSubtree(sourceId, params.parentId)) return false;
    return true;
  });
}

export function resolveClipboardFocusId(nodeIds: string[]): string | null {
  return nodeIds[nodeIds.length - 1] ?? nodeIds[0] ?? null;
}

export function resolveDuplicatePlacement(params: {
  sourceNode: AppNode;
  activeProjectRootId: string | null;
  byParent: Map<string, AppNode[]>;
}): {
  parentId: string | null;
  afterId: string | null;
  refreshParentKey: string;
} {
  const isWorkspaceRoot =
    Boolean(params.activeProjectRootId) && params.sourceNode.id === params.activeProjectRootId;
  const parentId = isWorkspaceRoot
    ? params.sourceNode.id
    : params.sourceNode.parentId === ROOT_PARENT_ID
      ? null
      : params.sourceNode.parentId;
  const afterId = isWorkspaceRoot
    ? ((params.byParent.get(params.sourceNode.id) ?? []).slice(-1)[0]?.id ?? null)
    : params.sourceNode.id;

  return {
    parentId,
    afterId,
    refreshParentKey: parentId ?? ROOT_PARENT_ID
  };
}

export function shouldBeginInlineEditAfterClipboardMutation(
  createdNodeIds: string[],
  surface: SelectionSurface
): boolean {
  return createdNodeIds.length === 1 && surface !== "timeline";
}
