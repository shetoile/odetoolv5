import {
  createNodeNumberingLevelState,
  readNodeNumberHidden,
  readNodeNumberSeparator,
  resolveNodeTreeNumbering
} from "@/lib/nodeNumbering";
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
