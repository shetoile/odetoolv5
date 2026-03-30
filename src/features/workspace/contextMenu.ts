import type { SelectionSurface } from "@/features/workspace/viewMode";

export type ContextMenuKind =
  | "node"
  | "surface"
  | "quick_access_node"
  | "quick_access_group"
  | "quick_access_surface";

export type ContextMenuState = {
  x: number;
  y: number;
  nodeId: string | null;
  surface: SelectionSurface;
  kind: ContextMenuKind;
  groupId: string | null;
  workareaMode?: boolean;
  workareaOwnerNodeId?: string | null;
  workareaDeliverableId?: string | null;
  workareaDeliverableTitle?: string | null;
};

type ContextMenuDimensions = {
  width: number;
  height: number;
};

export function shouldRetainContextMenuSelection(selectedNodeIds: Set<string>, nodeId: string): boolean {
  return selectedNodeIds.size > 1 && selectedNodeIds.has(nodeId);
}

export function resolveContextMenuDimensions(params: {
  kind: ContextMenuKind;
  surface: SelectionSurface;
  isFileNode?: boolean;
  workareaMode?: boolean;
  workareaDeliverableId?: string | null;
  isExecutionTaskNode?: boolean;
}): ContextMenuDimensions {
  if (params.kind === "node") {
    if (params.workareaMode) {
      if (params.isFileNode) {
        return { width: 240, height: 220 };
      }
      if (params.surface === "timeline") {
        return { width: 240, height: 330 };
      }
      return { width: 240, height: params.surface === "tree" ? 390 : 300 };
    }
    return {
      width: 240,
      height: params.isFileNode ? 540 : params.surface === "timeline" ? 430 : 360
    };
  }

  if (params.kind === "quick_access_node") {
    return {
      width: 260,
      height: params.isFileNode ? 220 : 180
    };
  }

  if (params.kind === "quick_access_group") {
    return { width: 240, height: 130 };
  }

  if (params.kind === "quick_access_surface") {
    return { width: 240, height: 84 };
  }

  if (params.workareaMode) {
    return { width: 240, height: 130 };
  }

  return { width: 240, height: 120 };
}

export function resolveContextMenuPosition(params: {
  clientX: number;
  clientY: number;
  viewportWidth: number;
  viewportHeight: number;
  menuWidth: number;
  menuHeight: number;
}): { x: number; y: number } {
  return {
    x: Math.max(8, Math.min(params.clientX, params.viewportWidth - params.menuWidth - 8)),
    y: Math.max(8, Math.min(params.clientY, params.viewportHeight - params.menuHeight - 8))
  };
}

export function createContextMenuState(params: {
  clientX: number;
  clientY: number;
  viewportWidth: number;
  viewportHeight: number;
  kind: ContextMenuKind;
  surface: SelectionSurface;
  nodeId: string | null;
  groupId: string | null;
  isFileNode?: boolean;
  workareaMode?: boolean;
  workareaOwnerNodeId?: string | null;
  workareaDeliverableId?: string | null;
  workareaDeliverableTitle?: string | null;
  isExecutionTaskNode?: boolean;
}): ContextMenuState {
  const dimensions = resolveContextMenuDimensions({
    kind: params.kind,
    surface: params.surface,
    isFileNode: params.isFileNode,
    workareaMode: params.workareaMode,
    workareaDeliverableId: params.workareaDeliverableId,
    isExecutionTaskNode: params.isExecutionTaskNode
  });
  const position = resolveContextMenuPosition({
    clientX: params.clientX,
    clientY: params.clientY,
    viewportWidth: params.viewportWidth,
    viewportHeight: params.viewportHeight,
    menuWidth: dimensions.width,
    menuHeight: dimensions.height
  });

  return {
    x: position.x,
    y: position.y,
    nodeId: params.nodeId,
    surface: params.surface,
    kind: params.kind,
    groupId: params.groupId,
    workareaMode: params.workareaMode,
    workareaOwnerNodeId: params.workareaOwnerNodeId,
    workareaDeliverableId: params.workareaDeliverableId,
    workareaDeliverableTitle: params.workareaDeliverableTitle
  };
}
