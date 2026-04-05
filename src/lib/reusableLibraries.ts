import { isWorkareaRootNode } from "@/features/workspace/workarea";
import { isFileLikeNode, type AppNode } from "@/lib/types";

// Minimal shared V1 foundation:
// - the UX stays split into Database Templates and Organisation Models
// - library roots live as normal workspace children
// - reusable items are ordinary copied branches marked by lightweight node properties
// - search / preview / import-export all build on those same properties and branch snapshots
export type ODELibraryKind = "database_template" | "organisation_model";
export type ODELibraryItemType = "section" | "table" | "field" | "branch" | "node";

export type ReusableLibrarySnapshot = {
  name: string;
  type: AppNode["type"];
  description: string | null;
  content: string | null;
  properties?: Record<string, unknown>;
  children: ReusableLibrarySnapshot[];
};

export type ReusableLibraryExportPayload = {
  odeLibraryKind: ODELibraryKind;
  odeLibraryItemType: ODELibraryItemType;
  odeLibraryExportVersion: 1;
  name: string;
  summary: string | null;
  categoryPath: string[];
  exportedAt: string;
  root: ReusableLibrarySnapshot;
};

export type ReusableLibraryIndexItem = {
  node: AppNode;
  kind: ODELibraryKind;
  itemType: ODELibraryItemType;
  summary: string | null;
  categoryPath: string[];
  searchText: string;
  previewLines: string[];
  nodeCount: number;
};

export const DATABASE_TEMPLATE_LIBRARY_ROOT_NAME = "Database Templates";
export const ORGANISATION_MODEL_LIBRARY_ROOT_NAME = "Organisation Models";
export const ODE_LIBRARY_EXPORT_VERSION = 1;

function normalizeSearchValue(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function countSnapshotNodes(snapshot: ReusableLibrarySnapshot): number {
  return 1 + snapshot.children.reduce((total, child) => total + countSnapshotNodes(child), 0);
}

function shouldSkipLibrarySnapshotNode(node: AppNode): boolean {
  return node.properties?.odeExecutionTask === true;
}

function buildReusableLibraryChildSnapshots(
  parentId: string,
  nodeById: Map<string, AppNode>,
  byParent: Map<string, AppNode[]>,
  options?: { includeFiles?: boolean }
): ReusableLibrarySnapshot[] {
  const snapshots: ReusableLibrarySnapshot[] = [];
  for (const child of byParent.get(parentId) ?? []) {
    if (shouldSkipLibrarySnapshotNode(child)) continue;
    if (isWorkareaRootNode(child)) {
      snapshots.push(...buildReusableLibraryChildSnapshots(child.id, nodeById, byParent, options));
      continue;
    }
    const snapshot = buildReusableLibrarySnapshot(child.id, nodeById, byParent, options);
    if (snapshot) {
      snapshots.push(snapshot);
    }
  }
  return snapshots;
}

export function getLibraryRootName(kind: ODELibraryKind): string {
  return kind === "database_template"
    ? DATABASE_TEMPLATE_LIBRARY_ROOT_NAME
    : ORGANISATION_MODEL_LIBRARY_ROOT_NAME;
}

export function getNodeLibraryKind(node: AppNode | null | undefined): ODELibraryKind | null {
  if (!node) return null;
  const value = node.properties?.odeLibraryKind;
  return value === "database_template" || value === "organisation_model" ? value : null;
}

export function getNodeLibraryItemType(node: AppNode | null | undefined): ODELibraryItemType | null {
  if (!node) return null;
  const value = node.properties?.odeLibraryItemType;
  return value === "section" ||
    value === "table" ||
    value === "field" ||
    value === "branch" ||
    value === "node"
    ? value
    : null;
}

export function isLibraryRootNode(node: AppNode | null | undefined): boolean {
  return Boolean(node && node.properties?.odeLibraryRoot === true && getNodeLibraryKind(node));
}

export function isReusableLibraryItemNode(node: AppNode | null | undefined): boolean {
  return Boolean(node && getNodeLibraryKind(node) && getNodeLibraryItemType(node));
}

export function isNodeInsideLibrary(
  node: AppNode | null | undefined,
  nodeById: Map<string, AppNode>
): boolean {
  let current = node ?? null;
  while (current) {
    if (isLibraryRootNode(current)) {
      return true;
    }
    current = current.parentId ? nodeById.get(current.parentId) ?? null : null;
  }
  return false;
}

export function buildReusableLibrarySummary(
  node: AppNode | null | undefined
): string | null {
  if (!node) return null;
  const summaryProperty = typeof node.properties?.odeLibrarySummary === "string" ? node.properties.odeLibrarySummary : "";
  const summaryFromProperty = summaryProperty.trim();
  if (summaryFromProperty.length > 0) {
    return summaryFromProperty;
  }
  const description = (node.description ?? "").trim();
  if (!description) return null;
  const firstLine = description
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return firstLine ?? null;
}

export function inferDatabaseTemplateItemType(
  node: AppNode | null | undefined,
  byParent: Map<string, AppNode[]>
): Extract<ODELibraryItemType, "section" | "table" | "field"> | null {
  if (!node || isFileLikeNode(node)) return null;
  const explicitItemType = node.properties?.odeProcedureItemType;
  const explicitFieldType =
    typeof node.properties?.odeProcedureFieldType === "string"
      ? node.properties.odeProcedureFieldType.trim()
      : "";

  if (explicitItemType === "field") {
    return explicitFieldType === "table" ? "table" : "field";
  }
  if (explicitItemType === "section") {
    return "section";
  }

  const children = byParent.get(node.id) ?? [];
  if (
    children.some(
      (child) =>
        child.properties?.odeProcedureItemType === "field" ||
        typeof child.properties?.odeProcedureFieldType === "string"
    )
  ) {
    return "section";
  }

  if ((node.description ?? "").trim().length > 0 || (node.content ?? "").trim().length > 0) {
    return "section";
  }

  return null;
}

export function inferOrganisationModelItemType(
  node: AppNode | null | undefined,
  byParent: Map<string, AppNode[]>
): Extract<ODELibraryItemType, "branch" | "node"> | null {
  if (!node || isFileLikeNode(node)) return null;
  const children = (byParent.get(node.id) ?? []).filter((child) => !shouldSkipLibrarySnapshotNode(child));
  return children.length > 0 ? "branch" : "node";
}

export function findReusableLibraryRoot(
  kind: ODELibraryKind,
  workspaceRootId: string | null | undefined,
  byParent: Map<string, AppNode[]>
): AppNode | null {
  if (!workspaceRootId) return null;
  const children = byParent.get(workspaceRootId) ?? [];
  return children.find((child) => child.properties?.odeLibraryRoot === true && getNodeLibraryKind(child) === kind) ?? null;
}

export function buildReusableLibrarySnapshot(
  rootNodeId: string,
  nodeById: Map<string, AppNode>,
  byParent: Map<string, AppNode[]>,
  options?: { includeFiles?: boolean }
): ReusableLibrarySnapshot | null {
  const source = nodeById.get(rootNodeId) ?? null;
  if (!source || shouldSkipLibrarySnapshotNode(source)) return null;
  if (options?.includeFiles === false && isFileLikeNode(source)) {
    return null;
  }
  return {
    name: source.name,
    type: source.type,
    description: source.description ?? null,
    content: source.content ?? null,
    properties: source.properties ? { ...(source.properties as Record<string, unknown>) } : undefined,
    children: buildReusableLibraryChildSnapshots(rootNodeId, nodeById, byParent, options)
  };
}

export function buildReusableLibraryCategoryPath(
  node: AppNode,
  rootNodeId: string,
  nodeById: Map<string, AppNode>
): string[] {
  const segments: string[] = [];
  let currentParentId = node.parentId;
  while (currentParentId && currentParentId !== rootNodeId) {
    const currentParent = nodeById.get(currentParentId) ?? null;
    if (!currentParent) break;
    segments.unshift(currentParent.name);
    currentParentId = currentParent.parentId;
  }
  return segments;
}

export function buildReusableLibraryPreviewLines(
  nodeId: string,
  nodeById: Map<string, AppNode>,
  byParent: Map<string, AppNode[]>,
  options?: { maxLines?: number; depth?: number }
): string[] {
  const maxLines = options?.maxLines ?? 10;
  const depth = options?.depth ?? 0;
  const node = nodeById.get(nodeId) ?? null;
  if (!node || shouldSkipLibrarySnapshotNode(node) || maxLines <= 0) return [];
  const label = `${"  ".repeat(depth)}${node.name}`;
  const lines = [label];
  if (lines.length >= maxLines) return lines;
  const children = byParent.get(nodeId) ?? [];
  for (const child of children) {
    const remaining = maxLines - lines.length;
    if (remaining <= 0) break;
    if (shouldSkipLibrarySnapshotNode(child)) {
      continue;
    }
    if (isWorkareaRootNode(child)) {
      for (const workareaChild of byParent.get(child.id) ?? []) {
        const nextRemaining = maxLines - lines.length;
        if (nextRemaining <= 0) break;
        lines.push(
          ...buildReusableLibraryPreviewLines(workareaChild.id, nodeById, byParent, {
            maxLines: nextRemaining,
            depth: depth + 1
          })
        );
      }
      continue;
    }
    lines.push(...buildReusableLibraryPreviewLines(child.id, nodeById, byParent, { maxLines: remaining, depth: depth + 1 }));
  }
  return lines.slice(0, maxLines);
}

export function buildReusableLibraryIndexItems(params: {
  kind: ODELibraryKind;
  rootNodeId: string | null;
  nodeById: Map<string, AppNode>;
  byParent: Map<string, AppNode[]>;
}): ReusableLibraryIndexItem[] {
  const { kind, rootNodeId, nodeById, byParent } = params;
  if (!rootNodeId) return [];
  const rootChildren = byParent.get(rootNodeId) ?? [];
  const items: ReusableLibraryIndexItem[] = [];

  const walk = (node: AppNode) => {
    if (isReusableLibraryItemNode(node) && getNodeLibraryKind(node) === kind) {
      const itemType = getNodeLibraryItemType(node);
      if (!itemType) return;
      const snapshot = buildReusableLibrarySnapshot(node.id, nodeById, byParent, { includeFiles: true });
      items.push({
        node,
        kind,
        itemType,
        summary: buildReusableLibrarySummary(node),
        categoryPath: buildReusableLibraryCategoryPath(node, rootNodeId, nodeById),
        previewLines: buildReusableLibraryPreviewLines(node.id, nodeById, byParent, { maxLines: 12 }),
        nodeCount: snapshot ? countSnapshotNodes(snapshot) : 1,
        searchText: [
          node.name,
          node.description ?? "",
          typeof node.properties?.odeLibrarySummary === "string" ? node.properties.odeLibrarySummary : "",
          itemType,
          buildReusableLibraryCategoryPath(node, rootNodeId, nodeById).join(" / ")
        ]
          .join(" ")
          .trim()
          .toLowerCase()
      });
      return;
    }
    const children = byParent.get(node.id) ?? [];
    children.forEach(walk);
  };

  rootChildren.forEach(walk);
  return items.sort((left, right) => left.node.name.localeCompare(right.node.name, undefined, { sensitivity: "base" }));
}

export function buildReusableLibraryExportPayload(params: {
  kind: ODELibraryKind;
  itemType: ODELibraryItemType;
  node: AppNode;
  rootNodeId: string;
  nodeById: Map<string, AppNode>;
  byParent: Map<string, AppNode[]>;
}): ReusableLibraryExportPayload | null {
  const snapshot = buildReusableLibrarySnapshot(params.node.id, params.nodeById, params.byParent, {
    includeFiles: false
  });
  if (!snapshot) return null;
  return {
    odeLibraryKind: params.kind,
    odeLibraryItemType: params.itemType,
    odeLibraryExportVersion: ODE_LIBRARY_EXPORT_VERSION,
    name: params.node.name,
    summary: buildReusableLibrarySummary(params.node),
    categoryPath: buildReusableLibraryCategoryPath(params.node, params.rootNodeId, params.nodeById),
    exportedAt: new Date().toISOString(),
    root: snapshot
  };
}

function isReusableLibrarySnapshot(value: unknown): value is ReusableLibrarySnapshot {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (typeof record.name !== "string" || typeof record.type !== "string") return false;
  if (!Array.isArray(record.children)) return false;
  return record.children.every((child) => isReusableLibrarySnapshot(child));
}

export function parseReusableLibraryImportPayload(text: string): ReusableLibraryExportPayload | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    const kind =
      record.odeLibraryKind === "database_template" || record.odeLibraryKind === "organisation_model"
        ? record.odeLibraryKind
        : null;
    const itemType =
      record.odeLibraryItemType === "section" ||
      record.odeLibraryItemType === "table" ||
      record.odeLibraryItemType === "field" ||
      record.odeLibraryItemType === "branch" ||
      record.odeLibraryItemType === "node"
        ? record.odeLibraryItemType
        : null;
    const version = record.odeLibraryExportVersion;
    const root = isReusableLibrarySnapshot(record.root) ? record.root : null;
    if (!kind || !itemType || version !== ODE_LIBRARY_EXPORT_VERSION || !root) {
      return null;
    }
    return {
      odeLibraryKind: kind,
      odeLibraryItemType: itemType,
      odeLibraryExportVersion: ODE_LIBRARY_EXPORT_VERSION,
      name: typeof record.name === "string" ? record.name : root.name,
      summary: typeof record.summary === "string" ? record.summary : null,
      categoryPath: Array.isArray(record.categoryPath)
        ? record.categoryPath.filter((item): item is string => typeof item === "string")
        : [],
      exportedAt: typeof record.exportedAt === "string" ? record.exportedAt : new Date().toISOString(),
      root
    };
  } catch {
    return null;
  }
}

export function buildCopiedFromLibraryRootProperties(params: {
  sourceNodeId: string;
  kind: ODELibraryKind;
  itemType: ODELibraryItemType;
  sourceProperties?: Record<string, unknown>;
}): Record<string, unknown> {
  const nextProperties: Record<string, unknown> = {
    ...(params.sourceProperties ?? {})
  };
  delete nextProperties.odeLibraryRoot;
  delete nextProperties.odeLibraryKind;
  delete nextProperties.odeLibraryItemType;
  delete nextProperties.odeLibraryExportVersion;
  delete nextProperties.odeLibrarySummary;
  delete nextProperties.odeLibraryCategory;
  delete nextProperties.odeLibrarySourceNodeId;
  nextProperties.odeCopiedFromLibraryKind = params.kind;
  nextProperties.odeCopiedFromLibraryItemType = params.itemType;
  nextProperties.odeLibrarySourceNodeId = params.sourceNodeId;
  nextProperties.odeLibraryCopiedAt = new Date().toISOString();
  return nextProperties;
}

export function buildSavedLibraryRootProperties(params: {
  kind: ODELibraryKind;
  itemType: ODELibraryItemType;
  sourceNodeId: string;
  summary: string | null;
}): Record<string, unknown> {
  const nextProperties: Record<string, unknown> = {
    odeLibraryKind: params.kind,
    odeLibraryItemType: params.itemType,
    odeLibraryExportVersion: ODE_LIBRARY_EXPORT_VERSION,
    odeLibrarySummary: params.summary
  };
  if (params.sourceNodeId.trim().length > 0) {
    nextProperties.odeLibrarySourceNodeId = params.sourceNodeId;
  }
  return nextProperties;
}
