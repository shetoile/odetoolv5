import { ROOT_PARENT_ID, type AppNode } from "@/lib/types";

export const NODE_STRUCTURE_LOCKED_PROPERTY = "odeStructureLocked";

export function isNodeStructureLockOwner(node: AppNode | null | undefined): boolean {
  return node?.properties?.[NODE_STRUCTURE_LOCKED_PROPERTY] === true;
}

export function findStructureLockOwner(
  nodeId: string | null | undefined,
  nodeById: Map<string, AppNode>
): AppNode | null {
  if (!nodeId || nodeId === ROOT_PARENT_ID) return null;
  let current = nodeById.get(nodeId) ?? null;
  while (current) {
    if (isNodeStructureLockOwner(current)) {
      return current;
    }
    if (!current.parentId || current.parentId === ROOT_PARENT_ID) break;
    current = nodeById.get(current.parentId) ?? null;
  }
  return null;
}

export function applyNodeStructureLock(
  properties: Record<string, unknown> | undefined,
  locked: boolean
): Record<string, unknown> {
  const nextProperties = { ...(properties ?? {}) };
  if (locked) {
    nextProperties[NODE_STRUCTURE_LOCKED_PROPERTY] = true;
  } else {
    delete nextProperties[NODE_STRUCTURE_LOCKED_PROPERTY];
  }
  return nextProperties;
}
