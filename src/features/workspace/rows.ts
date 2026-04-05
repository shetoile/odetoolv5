import { ROOT_PARENT_ID, isFileLikeNode, type AppNode } from "@/lib/types";
import type { WorkspaceFocusMode } from "@/features/workspace/viewMode";

export type WorkspaceTreeRow = {
  id: string;
  node: AppNode;
  level: number;
  indexLabel: string;
  hasChildren: boolean;
};

function orderWorkspaceNodesForDisplay(nodes: AppNode[]): AppNode[] {
  const branchNodes: AppNode[] = [];
  const fileLikeNodes: AppNode[] = [];
  for (const node of nodes) {
    if (isFileLikeNode(node)) {
      fileLikeNodes.push(node);
      continue;
    }
    branchNodes.push(node);
  }
  return [...branchNodes, ...fileLikeNodes];
}

function splitWorkspaceNodesForTree(nodes: AppNode[]): {
  branchNodes: AppNode[];
} {
  const branchNodes: AppNode[] = [];
  for (const node of nodes) {
    if (isFileLikeNode(node)) continue;
    branchNodes.push(node);
  }
  return { branchNodes };
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

function promoteFilteredRows(rows: WorkspaceTreeRow[]): WorkspaceTreeRow[] {
  return rows.map((row) => ({
    ...row,
    level: Math.max(0, row.level - 1)
  }));
}

export function buildFilteredWorkspaceTreeRows(params: {
  activeProjectRootId: string | null;
  nodeById: Map<string, AppNode>;
  byParent: Map<string, AppNode[]>;
  matchesNodeState: (node: AppNode) => boolean;
  matchesFavoriteGroup: (node: AppNode) => boolean;
  includeBranchParents: boolean;
  scopedNumbering: Map<string, string>;
  isHiddenExecutionTaskNode: (node: AppNode) => boolean;
  shouldHideNode?: (node: AppNode) => boolean;
  forceTaskFilterParents: boolean;
  hideProjectRootRow?: boolean;
}): WorkspaceTreeRow[] {
  const visitNode = (nodeId: string, level: number): { branchVisible: boolean; rows: WorkspaceTreeRow[] } => {
    const node = params.nodeById.get(nodeId);
    if (!node || isFileLikeNode(node) || params.isHiddenExecutionTaskNode(node) || params.shouldHideNode?.(node)) {
      return { branchVisible: false, rows: [] };
    }

    const children = isFileLikeNode(node)
      ? []
      : params.byParent.get(nodeId) ?? [];
    const { branchNodes } = splitWorkspaceNodesForTree(children);
    let hasVisibleChild = false;
    const childRows: WorkspaceTreeRow[] = [];
    for (const child of branchNodes) {
      if (params.isHiddenExecutionTaskNode(child) || params.shouldHideNode?.(child)) {
        if (params.forceTaskFilterParents) {
          hasVisibleChild = true;
        }
        continue;
      }
      const result = visitNode(child.id, level + 1);
      if (result.branchVisible) hasVisibleChild = true;
      childRows.push(...result.rows);
    }

    const selfVisible = params.matchesNodeState(node) && params.matchesFavoriteGroup(node);
    const { branchVisible, includeSelf } = resolveFilteredBranchVisibility(
      selfVisible,
      hasVisibleChild,
      params.includeBranchParents
    );

    const rows: WorkspaceTreeRow[] = [];
    if (includeSelf) {
      rows.push({
        id: node.id,
        node,
        level,
        indexLabel: params.scopedNumbering.get(node.id) ?? "",
        hasChildren: childRows.length > 0
      });
    }
    rows.push(...(includeSelf ? childRows : promoteFilteredRows(childRows)));
    return { branchVisible, rows };
  };

  const visitChildren = (parentId: string, level: number): WorkspaceTreeRow[] => {
    const rows: WorkspaceTreeRow[] = [];
    const { branchNodes } = splitWorkspaceNodesForTree(params.byParent.get(parentId) ?? []);
    for (const child of branchNodes) {
      const result = visitNode(child.id, level);
      if (result.branchVisible) {
        rows.push(...result.rows);
      }
    }
    return rows;
  };

  if (params.activeProjectRootId) {
    const rootResult = visitNode(params.activeProjectRootId, 0);
    if (params.hideProjectRootRow) {
      return visitChildren(params.activeProjectRootId, 0);
    }
    if (rootResult.rows.length > 0 && rootResult.rows[0]?.id === params.activeProjectRootId) {
      return rootResult.rows;
    }
    return visitChildren(params.activeProjectRootId, 0);
  }

  return visitChildren(ROOT_PARENT_ID, 0);
}

export function resolveWorkspaceGridNodes(params: {
  workspaceFocusMode: WorkspaceFocusMode;
  hasActiveNodeStateFiltering: boolean;
  projectScopedNodeIds: Set<string> | null;
  currentChildren: AppNode[];
  currentFolderId: string | null;
  activeProjectRootId: string | null;
  nodeById: Map<string, AppNode>;
  byParent: Map<string, AppNode[]>;
  matchesNodeState: (node: AppNode) => boolean;
  includeNodeStateFilterParents: boolean;
  forceTaskFilterParents: boolean;
  isHiddenExecutionTaskNode: (node: AppNode) => boolean;
  shouldHideNode?: (node: AppNode) => boolean;
}): AppNode[] {
  if (params.workspaceFocusMode === "data") {
    const baseNodes = params.projectScopedNodeIds
      ? params.currentChildren.filter((node) => params.projectScopedNodeIds?.has(node.id))
      : params.currentChildren;
    return orderWorkspaceNodesForDisplay(
      baseNodes.filter((node) => isFileLikeNode(node) && !params.shouldHideNode?.(node))
    );
  }

  if (!params.hasActiveNodeStateFiltering) {
    const nodes = params.projectScopedNodeIds
      ? params.currentChildren.filter(
          (node) =>
            params.projectScopedNodeIds?.has(node.id) &&
            !params.isHiddenExecutionTaskNode(node) &&
            !params.shouldHideNode?.(node)
        )
      : params.currentChildren.filter(
          (node) => !params.isHiddenExecutionTaskNode(node) && !params.shouldHideNode?.(node)
        );
    return orderWorkspaceNodesForDisplay(nodes);
  }

  const startParentId = params.currentFolderId ?? params.activeProjectRootId ?? ROOT_PARENT_ID;
  const visibleNodes: AppNode[] = [];

  const visitNode = (nodeId: string): boolean => {
    const node = params.nodeById.get(nodeId);
    if (!node || params.isHiddenExecutionTaskNode(node) || params.shouldHideNode?.(node)) return false;

    const children = isFileLikeNode(node)
      ? []
      : orderWorkspaceNodesForDisplay(params.byParent.get(nodeId) ?? []);
    let hasVisibleChild = false;
    for (const child of children) {
      if (params.isHiddenExecutionTaskNode(child) || params.shouldHideNode?.(child)) {
        if (params.forceTaskFilterParents) {
          hasVisibleChild = true;
        }
        continue;
      }
      if (visitNode(child.id)) {
        hasVisibleChild = true;
      }
    }

    const selfVisible = params.matchesNodeState(node);
    const { branchVisible, includeSelf } = resolveFilteredBranchVisibility(
      selfVisible,
      hasVisibleChild,
      params.includeNodeStateFilterParents || params.forceTaskFilterParents
    );
    if (includeSelf) {
      visibleNodes.push(node);
    }
    return branchVisible;
  };

  const children = orderWorkspaceNodesForDisplay(params.byParent.get(startParentId) ?? []);
  for (const child of children) {
    visitNode(child.id);
  }

  return orderWorkspaceNodesForDisplay(visibleNodes);
}
