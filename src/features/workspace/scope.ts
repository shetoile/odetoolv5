import {
  createNodeNumberingLevelState,
  readNodeNumberHidden,
  readNodeNumberSeparator,
  resolveNodeTreeNumbering
} from "@/lib/nodeNumbering";
import type { AppNode, ProjectSummary } from "@/lib/types";
import type { DesktopViewMode, WorkspaceFocusMode, WorkspaceMode } from "@/features/workspace/viewMode";

export const INTERNAL_WORKSPACE_ROOT_PREFIX = "workspace://internal/";

export type WorkspaceScopeContext = {
  activeProject: ProjectSummary | null;
  activeProjectId: string | null;
  activeProjectRootId: string | null;
  activeWorkspaceRootId: string | null;
  documentationModeActive: boolean;
  documentationWorkspaceRootId: string | null;
  fullProjectScopedNodeIds: Set<string> | null;
  documentationScopedNodeIds: Set<string> | null;
  projectScopedNodeIds: Set<string> | null;
  workspaceMode: WorkspaceMode;
  desktopViewMode: DesktopViewMode;
  workspaceFocusMode: WorkspaceFocusMode;
  libraryModeActive: boolean;
  executionModeActive: boolean;
};

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

export function resolveActiveWorkspaceRootId(params: {
  documentationModeActive: boolean;
  documentationWorkspaceRootId: string | null;
  activeProjectRootId: string | null;
}): string | null {
  return params.documentationModeActive
    ? params.documentationWorkspaceRootId ?? params.activeProjectRootId
    : params.activeProjectRootId;
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

export function resolveProjectScopedNodeIdsForView(params: {
  documentationModeActive: boolean;
  documentationWorkspaceRootId: string | null;
  fullProjectScopedNodeIds: Set<string> | null;
  documentationScopedNodeIds: Set<string> | null;
}): Set<string> | null {
  if (!params.fullProjectScopedNodeIds) return null;
  if (params.documentationModeActive) {
    if (!params.documentationWorkspaceRootId || !params.documentationScopedNodeIds) {
      return new Set<string>();
    }
    return params.documentationScopedNodeIds;
  }
  if (!params.documentationWorkspaceRootId || !params.documentationScopedNodeIds) {
    return params.fullProjectScopedNodeIds;
  }

  const visibleIds = new Set(params.fullProjectScopedNodeIds);
  params.documentationScopedNodeIds.forEach((nodeId) => {
    visibleIds.delete(nodeId);
  });
  return visibleIds;
}

export function createWorkspaceScopeContext(params: {
  activeProject: ProjectSummary | null;
  activeProjectId: string | null;
  activeProjectRootId: string | null;
  documentationModeActive: boolean;
  documentationWorkspaceRootId: string | null;
  fullProjectScopedNodeIds: Set<string> | null;
  documentationScopedNodeIds: Set<string> | null;
  workspaceMode: WorkspaceMode;
  desktopViewMode: DesktopViewMode;
  workspaceFocusMode: WorkspaceFocusMode;
}): WorkspaceScopeContext {
  const activeWorkspaceRootId = resolveActiveWorkspaceRootId({
    documentationModeActive: params.documentationModeActive,
    documentationWorkspaceRootId: params.documentationWorkspaceRootId,
    activeProjectRootId: params.activeProjectRootId
  });

  return {
    activeProject: params.activeProject,
    activeProjectId: params.activeProjectId,
    activeProjectRootId: params.activeProjectRootId,
    activeWorkspaceRootId,
    documentationModeActive: params.documentationModeActive,
    documentationWorkspaceRootId: params.documentationWorkspaceRootId,
    fullProjectScopedNodeIds: params.fullProjectScopedNodeIds,
    documentationScopedNodeIds: params.documentationScopedNodeIds,
    projectScopedNodeIds: resolveProjectScopedNodeIdsForView({
      documentationModeActive: params.documentationModeActive,
      documentationWorkspaceRootId: params.documentationWorkspaceRootId,
      fullProjectScopedNodeIds: params.fullProjectScopedNodeIds,
      documentationScopedNodeIds: params.documentationScopedNodeIds
    }),
    workspaceMode: params.workspaceMode,
    desktopViewMode: params.desktopViewMode,
    workspaceFocusMode: params.workspaceFocusMode,
    libraryModeActive: params.desktopViewMode === "library",
    executionModeActive: params.workspaceMode === "grid" && params.workspaceFocusMode === "execution"
  };
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
  numberingMode?: "legacy" | "tree_headings";
};

export function buildScopedNumbering({
  activeProjectRootId,
  numbering,
  nodeById,
  byParent,
  workspaceRootNumberingEnabled,
  consumesTreeNumbering,
  numberingMode = "legacy"
}: BuildScopedNumberingParams): Map<string, string> {
  if (!activeProjectRootId) return numbering;

  const rootNode = nodeById.get(activeProjectRootId);
  if (!rootNode) return new Map<string, string>();

  if (numberingMode === "tree_headings") {
    const map = new Map<string, string>();
    const resolvedRoot = resolveNodeTreeNumbering(rootNode, {
      parentLabel: "",
      siblingState: createNodeNumberingLevelState(),
      ignoreLabelOverride: true,
      ignoreFormatOverride: true,
      ignoreSeparatorOverride: true
    });

    if (!readNodeNumberHidden(rootNode)) {
      map.set(rootNode.id, resolvedRoot.label);
    }

    const walk = (parentId: string, parentLabel: string, inheritedSeparator: "." | "-" = ".") => {
      const children = byParent.get(parentId) ?? [];
      let siblingState = createNodeNumberingLevelState({ separator: inheritedSeparator });

      children.forEach((child) => {
        if (consumesTreeNumbering(child)) {
          const resolved = resolveNodeTreeNumbering(child, {
            parentLabel,
            siblingState,
            ignoreLabelOverride: true,
            ignoreFormatOverride: true,
            ignoreSeparatorOverride: true
          });
          siblingState = resolved.nextLevelState;
          if (!readNodeNumberHidden(child)) {
            map.set(child.id, resolved.label);
          }
          walk(child.id, resolved.descendantPrefix, resolved.childSeparator);
          return;
        }

        walk(child.id, parentLabel, siblingState.separator);
      });
    };

    walk(rootNode.id, resolvedRoot.descendantPrefix, resolvedRoot.childSeparator);
    return map;
  }

  const map = new Map<string, string>();
  let rootPrefix = "";
  let rootSeparator = readNodeNumberSeparator(rootNode) ?? ".";
  if (workspaceRootNumberingEnabled) {
    const resolvedRoot = resolveNodeTreeNumbering(rootNode, {
      parentLabel: "",
      siblingState: createNodeNumberingLevelState()
    });
    rootPrefix = resolvedRoot.label;
    rootSeparator = resolvedRoot.childSeparator;
    map.set(rootNode.id, rootPrefix);
  }

  const walk = (parentId: string, prefix: string, inheritedSeparator?: "." | "-") => {
    const children = byParent.get(parentId) ?? [];
    let siblingState = createNodeNumberingLevelState(
      inheritedSeparator ? { separator: inheritedSeparator } : undefined
    );
    children.forEach((child) => {
      if (consumesTreeNumbering(child)) {
        const resolved = resolveNodeTreeNumbering(child, {
          parentLabel: prefix,
          siblingState
        });
        siblingState = resolved.nextLevelState;
        map.set(child.id, resolved.label);
        walk(child.id, resolved.descendantPrefix, resolved.childSeparator);
      } else {
        walk(child.id, prefix, siblingState.separator);
      }
    });
  };

  walk(rootNode.id, rootPrefix, rootSeparator);
  return map;
}
