import type { AppNode, ProjectSummary } from "@/lib/types";

export const INTERNAL_WORKSPACE_ROOT_PREFIX = "workspace://internal/";

export function isInternalWorkspaceRootPath(path: string | null | undefined): boolean {
  const normalizedPath = path?.trim() ?? "";
  return normalizedPath.startsWith(INTERNAL_WORKSPACE_ROOT_PREFIX);
}

export function resolveActiveProject(
  projects: ProjectSummary[],
  activeProjectId: string | null
): ProjectSummary | null {
  return activeProjectId ? projects.find((project) => project.id === activeProjectId) ?? null : null;
}

export function hasLinkedWorkspaceFolder(project: ProjectSummary | null): boolean {
  return Boolean(project && !isInternalWorkspaceRootPath(project.rootPath));
}

export function collectProjectScopedNodeIds(
  activeProjectRootId: string | null,
  byParent: Map<string, AppNode[]>
): Set<string> | null {
  if (!activeProjectRootId) return null;

  const scoped = new Set<string>();
  const stack: string[] = [activeProjectRootId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || scoped.has(current)) continue;
    scoped.add(current);
    const children = byParent.get(current) ?? [];
    for (const child of children) {
      stack.push(child.id);
    }
  }

  return scoped;
}

type WorkspaceViewResolutionParams = {
  hasInitializedProjects: boolean;
  storeStatus: string;
  activeProjectId: string | null;
  activeProjectRootId: string | null;
  currentFolderId: string | null;
  nodeById: Map<string, AppNode>;
  projectScopedNodeIds: Set<string> | null;
};

export function canResolveInitialWorkspaceView({
  hasInitializedProjects,
  storeStatus,
  activeProjectId,
  activeProjectRootId,
  currentFolderId,
  nodeById,
  projectScopedNodeIds
}: WorkspaceViewResolutionParams): boolean {
  if (!hasInitializedProjects) return false;
  if (storeStatus === "error") return true;
  if (storeStatus !== "ready") return false;
  if (!activeProjectId) return true;
  if (!activeProjectRootId) return false;
  if (!nodeById.has(activeProjectRootId)) return false;
  if (currentFolderId === activeProjectRootId) return true;
  return currentFolderId !== null && projectScopedNodeIds?.has(currentFolderId) === true;
}

type BuildScopedNumberingParams = {
  activeProjectRootId: string | null;
  numbering: Map<string, string>;
  nodeById: Map<string, AppNode>;
  byParent: Map<string, AppNode[]>;
  workspaceRootNumberingEnabled: boolean;
  consumesTreeNumbering: (node: AppNode) => boolean;
};

export function buildScopedNumbering({
  activeProjectRootId,
  numbering,
  nodeById,
  byParent,
  workspaceRootNumberingEnabled,
  consumesTreeNumbering
}: BuildScopedNumberingParams): Map<string, string> {
  if (!activeProjectRootId) return numbering;

  const rootNode = nodeById.get(activeProjectRootId);
  if (!rootNode) return new Map<string, string>();

  const map = new Map<string, string>();
  const rootPrefix = workspaceRootNumberingEnabled ? "1" : "";
  if (workspaceRootNumberingEnabled) {
    map.set(rootNode.id, "1");
  }

  const walk = (parentId: string, prefix: string) => {
    const children = byParent.get(parentId) ?? [];
    let numberedIndex = 0;
    children.forEach((child) => {
      const nextPrefix = consumesTreeNumbering(child)
        ? (() => {
            numberedIndex += 1;
            const label = prefix ? `${prefix}.${numberedIndex}` : `${numberedIndex}`;
            map.set(child.id, label);
            return label;
          })()
        : prefix;
      walk(child.id, nextPrefix);
    });
  };

  walk(rootNode.id, rootPrefix);
  return map;
}
