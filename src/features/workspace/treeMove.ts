import { ROOT_PARENT_ID, isFileLikeNode, type AppNode } from "@/lib/types";

export type TreeMoveTarget = {
  newParentId: string;
  afterId: string | null;
  ensureExpandedIds: string[];
};

export type TreeMovePlan = {
  nodeId: string;
  target: TreeMoveTarget;
};

export function resolveTreeMoveInTarget(params: {
  nodeId: string;
  nodeById: Map<string, AppNode>;
  byParent: Map<string, AppNode[]>;
  workspaceRootIdSet: Set<string>;
}): TreeMoveTarget | null {
  const node = params.nodeById.get(params.nodeId);
  if (!node || params.workspaceRootIdSet.has(node.id)) return null;

  const siblings = params.byParent.get(node.parentId) ?? [];
  const nodeIndex = siblings.findIndex((item) => item.id === node.id);
  if (nodeIndex <= 0) return null;

  const previousSibling = siblings[nodeIndex - 1];
  if (!previousSibling || isFileLikeNode(previousSibling)) return null;

  const targetChildren = params.byParent.get(previousSibling.id) ?? [];
  return {
    newParentId: previousSibling.id,
    afterId: targetChildren.length > 0 ? targetChildren[targetChildren.length - 1].id : null,
    ensureExpandedIds: [node.parentId, previousSibling.id]
  };
}

export function resolveTreeMoveOutTarget(params: {
  nodeId: string;
  nodeById: Map<string, AppNode>;
  workspaceRootIdSet: Set<string>;
}): TreeMoveTarget | null {
  const node = params.nodeById.get(params.nodeId);
  if (!node || params.workspaceRootIdSet.has(node.id)) return null;

  const parent = params.nodeById.get(node.parentId);
  if (!parent) return null;
  if (params.workspaceRootIdSet.has(parent.id) || parent.parentId === ROOT_PARENT_ID) return null;

  return {
    newParentId: parent.parentId,
    afterId: parent.id,
    ensureExpandedIds: [node.parentId, parent.parentId]
  };
}

export function resolveTreeMoveInPlans(params: {
  selectedNodeIds: string[];
  nodeById: Map<string, AppNode>;
  byParent: Map<string, AppNode[]>;
  workspaceRootIdSet: Set<string>;
}): TreeMovePlan[] {
  const selectedIdSet = new Set(params.selectedNodeIds);
  const plans: TreeMovePlan[] = [];

  for (const [parentId, siblings] of params.byParent.entries()) {
    if (siblings.length === 0) continue;

    let index = 0;
    while (index < siblings.length) {
      if (!selectedIdSet.has(siblings[index]?.id ?? "")) {
        index += 1;
        continue;
      }

      const runStart = index;
      while (index + 1 < siblings.length && selectedIdSet.has(siblings[index + 1].id)) {
        index += 1;
      }
      const runEnd = index;
      const runNodes = siblings.slice(runStart, runEnd + 1);

      let anchorNode: AppNode | null = null;
      let nodesToMove: AppNode[] = [];

      if (runStart > 0) {
        anchorNode = siblings[runStart - 1] ?? null;
        nodesToMove = runNodes;
      } else {
        anchorNode = runNodes[0] ?? null;
        nodesToMove = runNodes.slice(1);
      }

      if (
        !anchorNode ||
        isFileLikeNode(anchorNode) ||
        params.workspaceRootIdSet.has(anchorNode.id) ||
        nodesToMove.length === 0
      ) {
        index += 1;
        continue;
      }

      const targetChildren = params.byParent.get(anchorNode.id) ?? [];
      let afterId = targetChildren.length > 0 ? targetChildren[targetChildren.length - 1].id : null;
      for (const node of nodesToMove) {
        const resolvedNode = params.nodeById.get(node.id) ?? null;
        if (!resolvedNode || params.workspaceRootIdSet.has(resolvedNode.id)) continue;
        plans.push({
          nodeId: resolvedNode.id,
          target: {
            newParentId: anchorNode.id,
            afterId,
            ensureExpandedIds: [parentId, anchorNode.id]
          }
        });
        afterId = resolvedNode.id;
      }

      index += 1;
    }
  }

  const planByNodeId = new Map(plans.map((plan) => [plan.nodeId, plan] as const));
  return params.selectedNodeIds
    .map((nodeId) => planByNodeId.get(nodeId) ?? null)
    .filter((plan): plan is TreeMovePlan => Boolean(plan));
}

export function resolveTreeMoveOutPlans(params: {
  selectedNodeIds: string[];
  nodeById: Map<string, AppNode>;
  byParent: Map<string, AppNode[]>;
  workspaceRootIdSet: Set<string>;
}): TreeMovePlan[] {
  const selectedIdSet = new Set(params.selectedNodeIds);
  const plans: TreeMovePlan[] = [];

  for (const [parentId, siblings] of params.byParent.entries()) {
    const parent = params.nodeById.get(parentId) ?? null;
    if (!parent || params.workspaceRootIdSet.has(parent.id) || parent.parentId === ROOT_PARENT_ID) {
      continue;
    }

    const selectedSiblings = siblings.filter((node) => selectedIdSet.has(node.id));
    if (selectedSiblings.length === 0) continue;

    let afterId: string | null = parent.id;
    for (const node of selectedSiblings) {
      const resolvedNode = params.nodeById.get(node.id) ?? null;
      if (!resolvedNode || params.workspaceRootIdSet.has(resolvedNode.id)) continue;
      plans.push({
        nodeId: resolvedNode.id,
        target: {
          newParentId: parent.parentId,
          afterId,
          ensureExpandedIds: [parent.id, parent.parentId]
        }
      });
      afterId = resolvedNode.id;
    }
  }

  const planByNodeId = new Map(plans.map((plan) => [plan.nodeId, plan] as const));
  return params.selectedNodeIds
    .map((nodeId) => planByNodeId.get(nodeId) ?? null)
    .filter((plan): plan is TreeMovePlan => Boolean(plan));
}

export function hasResolvableTreeMoveTarget(
  nodeIds: string[],
  resolveTarget: (nodeId: string) => TreeMoveTarget | null
): boolean {
  return nodeIds.some((nodeId) => Boolean(resolveTarget(nodeId)));
}

export function resolveMovedTreeSelectionIds(
  sourceNodeIds: string[],
  movedNodeIds: string[]
): string[] {
  if (movedNodeIds.length === 0) return [];
  const movedNodeIdSet = new Set(movedNodeIds);
  return sourceNodeIds.filter((sourceNodeId) => movedNodeIdSet.has(sourceNodeId));
}
