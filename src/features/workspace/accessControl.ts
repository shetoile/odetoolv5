import { ROOT_PARENT_ID, type AppNode } from "@/lib/types";

export const NODE_ACCESS_POLICY_PROPERTY = "odeAccessPolicy";
export const ACCESS_ROLE_VALUES = ["R0", "R1", "R2", "R3", "R4", "R5", "R6"] as const;

export type NodeAccessRole = (typeof ACCESS_ROLE_VALUES)[number];
export type NodeAccessPermission = "read" | "write" | "manage";

export interface ExplicitNodeAccessPolicy {
  readRoles?: NodeAccessRole[];
  writeRoles?: NodeAccessRole[];
  manageRoles?: NodeAccessRole[];
}

export interface ResolvedNodeAccessPolicy {
  readRoles: NodeAccessRole[];
  writeRoles: NodeAccessRole[];
  manageRoles: NodeAccessRole[];
}

const DEFAULT_NODE_ACCESS_POLICY: ResolvedNodeAccessPolicy = {
  readRoles: [...ACCESS_ROLE_VALUES],
  writeRoles: [...ACCESS_ROLE_VALUES],
  manageRoles: [...ACCESS_ROLE_VALUES]
};

function isNodeAccessRole(value: unknown): value is NodeAccessRole {
  return typeof value === "string" && ACCESS_ROLE_VALUES.includes(value as NodeAccessRole);
}

export function normalizeNodeAccessRoles(value: unknown): NodeAccessRole[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const uniqueRoles = new Set<NodeAccessRole>();
  for (const entry of value) {
    if (isNodeAccessRole(entry)) {
      uniqueRoles.add(entry);
    }
  }
  return ACCESS_ROLE_VALUES.filter((role) => uniqueRoles.has(role));
}

export function readExplicitNodeAccessPolicy(
  node: AppNode | null | undefined
): ExplicitNodeAccessPolicy | null {
  const rawPolicy = node?.properties?.[NODE_ACCESS_POLICY_PROPERTY];
  if (!rawPolicy || typeof rawPolicy !== "object") return null;
  const policyRecord = rawPolicy as Record<string, unknown>;
  const readRoles = normalizeNodeAccessRoles(policyRecord.readRoles);
  const writeRoles = normalizeNodeAccessRoles(policyRecord.writeRoles);
  const manageRoles = normalizeNodeAccessRoles(policyRecord.manageRoles);
  if (readRoles === undefined && writeRoles === undefined && manageRoles === undefined) {
    return null;
  }
  return {
    ...(readRoles !== undefined ? { readRoles } : {}),
    ...(writeRoles !== undefined ? { writeRoles } : {}),
    ...(manageRoles !== undefined ? { manageRoles } : {})
  };
}

export function hasExplicitNodeAccessPolicy(node: AppNode | null | undefined): boolean {
  return readExplicitNodeAccessPolicy(node) !== null;
}

export function applyNodeAccessPolicy(
  properties: Record<string, unknown> | undefined,
  policy: ExplicitNodeAccessPolicy | null
): Record<string, unknown> {
  const nextProperties = { ...(properties ?? {}) };
  const normalizedPolicy = policy
    ? {
        ...(policy.readRoles !== undefined ? { readRoles: normalizeNodeAccessRoles(policy.readRoles) ?? [] } : {}),
        ...(policy.writeRoles !== undefined ? { writeRoles: normalizeNodeAccessRoles(policy.writeRoles) ?? [] } : {}),
        ...(policy.manageRoles !== undefined ? { manageRoles: normalizeNodeAccessRoles(policy.manageRoles) ?? [] } : {})
      }
    : null;
  if (
    !normalizedPolicy ||
    (normalizedPolicy.readRoles === undefined &&
      normalizedPolicy.writeRoles === undefined &&
      normalizedPolicy.manageRoles === undefined)
  ) {
    delete nextProperties[NODE_ACCESS_POLICY_PROPERTY];
    return nextProperties;
  }
  nextProperties[NODE_ACCESS_POLICY_PROPERTY] = normalizedPolicy;
  return nextProperties;
}

export function resolveNodeAccessPolicy(
  nodeId: string | null | undefined,
  nodeById: Map<string, AppNode>
): ResolvedNodeAccessPolicy {
  let readRoles: NodeAccessRole[] | undefined;
  let writeRoles: NodeAccessRole[] | undefined;
  let manageRoles: NodeAccessRole[] | undefined;

  let current = nodeId ? nodeById.get(nodeId) ?? null : null;
  while (current) {
    const explicitPolicy = readExplicitNodeAccessPolicy(current);
    if (explicitPolicy) {
      if (readRoles === undefined && explicitPolicy.readRoles !== undefined) {
        readRoles = explicitPolicy.readRoles;
      }
      if (writeRoles === undefined && explicitPolicy.writeRoles !== undefined) {
        writeRoles = explicitPolicy.writeRoles;
      }
      if (manageRoles === undefined && explicitPolicy.manageRoles !== undefined) {
        manageRoles = explicitPolicy.manageRoles;
      }
      if (readRoles !== undefined && writeRoles !== undefined && manageRoles !== undefined) {
        break;
      }
    }
    if (!current.parentId || current.parentId === ROOT_PARENT_ID) break;
    current = nodeById.get(current.parentId) ?? null;
  }

  return {
    readRoles: readRoles ?? [...DEFAULT_NODE_ACCESS_POLICY.readRoles],
    writeRoles: writeRoles ?? [...DEFAULT_NODE_ACCESS_POLICY.writeRoles],
    manageRoles: manageRoles ?? [...DEFAULT_NODE_ACCESS_POLICY.manageRoles]
  };
}

export function canRoleReadNode(
  role: NodeAccessRole,
  nodeId: string | null | undefined,
  nodeById: Map<string, AppNode>
): boolean {
  return resolveNodeAccessPolicy(nodeId, nodeById).readRoles.includes(role);
}

export function canRoleWriteNode(
  role: NodeAccessRole,
  nodeId: string | null | undefined,
  nodeById: Map<string, AppNode>
): boolean {
  return resolveNodeAccessPolicy(nodeId, nodeById).writeRoles.includes(role);
}

export function canRoleManageNode(
  role: NodeAccessRole,
  nodeId: string | null | undefined,
  nodeById: Map<string, AppNode>
): boolean {
  return resolveNodeAccessPolicy(nodeId, nodeById).manageRoles.includes(role);
}
