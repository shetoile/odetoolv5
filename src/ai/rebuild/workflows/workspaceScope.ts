import { ROOT_PARENT_ID, type AppNode, type ProjectSummary } from "@/lib/types";

export function buildScopedNodeList(project: ProjectSummary | null, allNodes: AppNode[]): AppNode[] {
  if (!project) {
    return allNodes.filter((node) => node.parentId !== ROOT_PARENT_ID || node.type === "folder");
  }

  const byParent = new Map<string, AppNode[]>();
  for (const node of allNodes) {
    const siblings = byParent.get(node.parentId) ?? [];
    siblings.push(node);
    byParent.set(node.parentId, siblings);
  }

  const scopedIds = new Set<string>();
  const stack = [project.rootNodeId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || scopedIds.has(current)) continue;
    scopedIds.add(current);
    const children = byParent.get(current) ?? [];
    for (const child of children) {
      stack.push(child.id);
    }
  }

  return allNodes.filter((node) => scopedIds.has(node.id));
}
