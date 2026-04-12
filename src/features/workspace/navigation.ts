import type { AppNode, ProjectSummary } from "@/lib/types";
import { isFileLikeNode } from "@/lib/types";
import {
  collectAncestorNodeIds,
  resolveSearchResultNavigationParentId,
  resolveSearchResultSelectionSurface
} from "@/features/workspace/search";
import type { WorkspaceScopeContext } from "@/features/workspace/scope";
import type {
  DesktopViewMode,
  SelectionSurface,
  WorkspaceFocusMode,
  WorkspaceMode
} from "@/features/workspace/viewMode";

export type WorkspaceTabEntry = {
  nodeId: string;
  lastSelectedNodeId: string | null;
};

export type WorkspaceTabSession = {
  openTabs: WorkspaceTabEntry[];
  activeTabId: string | null;
};

export type WorkspaceTabSessions = Record<string, WorkspaceTabSession>;

export type WorkspaceActivePane =
  | "grid"
  | "details"
  | "dashboard"
  | "library"
  | "mindmap"
  | "procedure"
  | "execution"
  | "timeline";

export type WorkspaceSearchNavigationPlan =
  | {
      mode: "library";
    }
  | {
      mode: "workarea";
    }
  | {
      mode: "browse";
      browseTargetId: string | null;
      preferredSurface: SelectionSurface;
      ancestorNodeIds: string[];
      shouldClearActiveTab: boolean;
      shouldActivateBrowseSurface: boolean;
    };

export type WorkspaceBreadcrumbNavigationTarget = "home" | "execution" | "timeline";

export interface WorkspaceNavigationState {
  activeProject: ProjectSummary | null;
  activeProjectId: string | null;
  activeProjectRootId: string | null;
  activeWorkspaceRootId: string | null;
  workspaceMode: WorkspaceMode;
  desktopViewMode: DesktopViewMode;
  workspaceFocusMode: WorkspaceFocusMode;
  selectionSurface: SelectionSurface;
  currentFolderId: string | null;
  currentFolderNode: AppNode | null;
  mainPaneTargetNode: AppNode | null;
  selectedNodeId: string | null;
  selectedNodeIds: Set<string>;
  treeSelectedNodeId: string | null;
  treeSelectedNodeIds: Set<string>;
  breadcrumbNodes: AppNode[];
  tabSession: WorkspaceTabSession;
  activePane: WorkspaceActivePane;
}

export interface WorkspaceNavigationActions {
  activateBrowseSurface: (options?: { preserveTreeSurface?: boolean }) => void;
  browseNode: (nodeId: string, options?: { preserveTreeSurface?: boolean }) => Promise<void> | void;
  clearActiveTab: () => void;
  openNodeExecution: (nodeId: string | null) => Promise<void> | void;
  openNodeHome: (nodeId: string | null) => Promise<void> | void;
  openNodeTab: (nodeId: string, options?: { selectedNodeId?: string | null }) => Promise<void> | void;
  openNodeTimeline: (nodeId: string | null) => Promise<void> | void;
  selectBreadcrumbNode: (nodeId: string) => Promise<void> | void;
  selectFromSearch: (nodeId: string) => Promise<void> | void;
}

export interface WorkspaceNavigationController {
  scope: WorkspaceScopeContext;
  state: WorkspaceNavigationState;
  actions: WorkspaceNavigationActions;
}

export function createEmptyWorkspaceTabSession(): WorkspaceTabSession {
  return {
    openTabs: [],
    activeTabId: null
  };
}

export function readWorkspaceTabSessions(storageKey: string): WorkspaceTabSessions {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as WorkspaceTabSessions;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

export function canOpenNodeInDesktopTab(node: AppNode | null | undefined): node is AppNode {
  if (!node) return false;
  const isHtmlFile =
    isFileLikeNode(node) && ["html", "htm"].includes(node.name.trim().split(".").pop()?.toLowerCase() ?? "");
  if (isHtmlFile) return true;
  return node.type === "folder" && !isFileLikeNode(node);
}

export function upsertWorkspaceTabEntry(
  session: WorkspaceTabSession,
  nodeId: string,
  selectedNodeId: string | null
): WorkspaceTabSession {
  const existingEntry = session.openTabs.find((entry) => entry.nodeId === nodeId) ?? null;
  const nextOpenTabs = existingEntry
    ? session.openTabs.map((entry) =>
        entry.nodeId === nodeId
          ? {
              ...entry,
              lastSelectedNodeId: selectedNodeId
            }
          : entry
      )
    : [
        ...session.openTabs,
        {
          nodeId,
          lastSelectedNodeId: selectedNodeId
        }
      ];

  return {
    openTabs: nextOpenTabs,
    activeTabId: nodeId
  };
}

export function closeWorkspaceTabEntry(
  session: WorkspaceTabSession,
  nodeId: string
): { session: WorkspaceTabSession | null; nextActiveEntry: WorkspaceTabEntry | null } {
  const tabIndex = session.openTabs.findIndex((entry) => entry.nodeId === nodeId);
  if (tabIndex === -1) {
    return {
      session,
      nextActiveEntry:
        session.openTabs.find((entry) => entry.nodeId === session.activeTabId) ?? session.openTabs[0] ?? null
    };
  }

  const remainingTabs = session.openTabs.filter((entry) => entry.nodeId !== nodeId);
  const nextActiveEntry =
    session.activeTabId === nodeId
      ? remainingTabs[Math.max(0, tabIndex - 1)] ?? remainingTabs[0] ?? null
      : remainingTabs.find((entry) => entry.nodeId === session.activeTabId) ?? remainingTabs[0] ?? null;

  if (remainingTabs.length === 0) {
    return {
      session: null,
      nextActiveEntry: null
    };
  }

  return {
    session: {
      openTabs: remainingTabs,
      activeTabId: nextActiveEntry?.nodeId ?? null
    },
    nextActiveEntry
  };
}

export function sanitizeWorkspaceTabSession(params: {
  session: WorkspaceTabSession;
  nodeById: Map<string, AppNode>;
  projectScopedNodeIds: Set<string> | null;
  isNodeWithinTabScope: (rootNodeId: string, candidateNodeId: string) => boolean;
}): WorkspaceTabSession | null {
  const validOpenTabs: WorkspaceTabEntry[] = [];

  for (const entry of params.session.openTabs) {
    const rootNode = params.nodeById.get(entry.nodeId) ?? null;
    if (!canOpenNodeInDesktopTab(rootNode)) continue;
    if (params.projectScopedNodeIds && !params.projectScopedNodeIds.has(rootNode.id)) continue;

    const nextSelectedNodeId =
      entry.lastSelectedNodeId && params.isNodeWithinTabScope(rootNode.id, entry.lastSelectedNodeId)
        ? entry.lastSelectedNodeId
        : rootNode.id;

    validOpenTabs.push({
      nodeId: rootNode.id,
      lastSelectedNodeId: nextSelectedNodeId
    });
  }

  if (validOpenTabs.length === 0) return null;

  return {
    openTabs: validOpenTabs,
    activeTabId:
      params.session.activeTabId && validOpenTabs.some((entry) => entry.nodeId === params.session.activeTabId)
        ? params.session.activeTabId
        : validOpenTabs[0]?.nodeId ?? null
  };
}

export function resolveRestorableWorkspaceTabEntry(params: {
  session: WorkspaceTabSession | null | undefined;
  nodeById: Map<string, AppNode>;
  projectScopedNodeIds: Set<string> | null;
}): WorkspaceTabEntry | null {
  if (!params.session || params.session.openTabs.length === 0) return null;

  const validOpenTabs = params.session.openTabs.filter((entry) => {
    const rootNode = params.nodeById.get(entry.nodeId) ?? null;
    return Boolean(
      rootNode &&
        canOpenNodeInDesktopTab(rootNode) &&
        (!params.projectScopedNodeIds || params.projectScopedNodeIds.has(rootNode.id))
    );
  });

  if (validOpenTabs.length === 0) return null;

  return validOpenTabs.find((entry) => entry.nodeId === params.session?.activeTabId) ?? validOpenTabs[0] ?? null;
}

export function resolveWorkspaceActivePane(params: {
  workspaceMode: WorkspaceMode;
  desktopViewMode: DesktopViewMode;
  workspaceFocusMode: WorkspaceFocusMode;
}): WorkspaceActivePane {
  if (params.workspaceMode === "timeline") return "timeline";
  if (params.desktopViewMode === "library") return "library";
  if (params.desktopViewMode === "procedure") return "procedure";
  if (params.workspaceFocusMode === "execution" && params.desktopViewMode !== "dashboard") return "execution";
  return params.desktopViewMode;
}

export function resolveBreadcrumbNavigationTarget(params: {
  workspaceMode: WorkspaceMode;
  desktopViewMode: DesktopViewMode;
  workspaceFocusMode: WorkspaceFocusMode;
}): WorkspaceBreadcrumbNavigationTarget {
  if (params.workspaceMode === "timeline") return "timeline";
  if (params.workspaceFocusMode === "execution" && params.desktopViewMode !== "dashboard") return "execution";
  return "home";
}

export function resolveWorkspaceSearchNavigationPlan(params: {
  desktopViewMode: DesktopViewMode;
  workspaceMode: WorkspaceMode;
  workspaceFocusMode: WorkspaceFocusMode;
  target: AppNode;
  nodeById: Map<string, AppNode>;
}): WorkspaceSearchNavigationPlan {
  if (params.desktopViewMode === "library") {
    return {
      mode: "library"
    };
  }

  if (params.workspaceMode === "grid" && params.workspaceFocusMode === "execution") {
    return {
      mode: "workarea"
    };
  }

  const browseTargetId =
    params.workspaceMode === "grid"
      ? isFileLikeNode(params.target)
        ? resolveSearchResultNavigationParentId(params.target)
        : params.target.id
      : resolveSearchResultNavigationParentId(params.target);

  return {
    mode: "browse",
    browseTargetId,
    preferredSurface: resolveSearchResultSelectionSurface(params.workspaceMode, params.target),
    ancestorNodeIds: collectAncestorNodeIds(params.target.id, params.nodeById),
    shouldClearActiveTab: params.workspaceMode === "grid",
    shouldActivateBrowseSurface: params.workspaceMode === "grid"
  };
}

export function buildWorkspaceNavigationState(params: {
  activeProject: ProjectSummary | null;
  activeProjectId: string | null;
  activeProjectRootId: string | null;
  activeWorkspaceRootId: string | null;
  workspaceMode: WorkspaceMode;
  desktopViewMode: DesktopViewMode;
  workspaceFocusMode: WorkspaceFocusMode;
  selectionSurface: SelectionSurface;
  currentFolderId: string | null;
  currentFolderNode: AppNode | null;
  mainPaneTargetNode: AppNode | null;
  selectedNodeId: string | null;
  selectedNodeIds: Set<string>;
  treeSelectedNodeId: string | null;
  treeSelectedNodeIds: Set<string>;
  breadcrumbNodes: AppNode[];
  tabSession: WorkspaceTabSession;
}): WorkspaceNavigationState {
  return {
    activeProject: params.activeProject,
    activeProjectId: params.activeProjectId,
    activeProjectRootId: params.activeProjectRootId,
    activeWorkspaceRootId: params.activeWorkspaceRootId,
    workspaceMode: params.workspaceMode,
    desktopViewMode: params.desktopViewMode,
    workspaceFocusMode: params.workspaceFocusMode,
    selectionSurface: params.selectionSurface,
    currentFolderId: params.currentFolderId,
    currentFolderNode: params.currentFolderNode,
    mainPaneTargetNode: params.mainPaneTargetNode,
    selectedNodeId: params.selectedNodeId,
    selectedNodeIds: params.selectedNodeIds,
    treeSelectedNodeId: params.treeSelectedNodeId,
    treeSelectedNodeIds: params.treeSelectedNodeIds,
    breadcrumbNodes: params.breadcrumbNodes,
    tabSession: params.tabSession,
    activePane: resolveWorkspaceActivePane({
      workspaceMode: params.workspaceMode,
      desktopViewMode: params.desktopViewMode,
      workspaceFocusMode: params.workspaceFocusMode
    })
  };
}
