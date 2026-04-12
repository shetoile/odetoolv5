import { describe, expect, it } from "vitest";
import {
  buildWorkspaceNavigationState,
  closeWorkspaceTabEntry,
  createEmptyWorkspaceTabSession,
  resolveWorkspaceSearchNavigationPlan,
  sanitizeWorkspaceTabSession,
  upsertWorkspaceTabEntry
} from "@/features/workspace/navigation";
import { createAppNode, createProjectSummary } from "@/test/factories";

describe("workspace navigation helpers", () => {
  it("upserts, sanitizes, and closes desktop tab sessions deterministically", () => {
    const root = createAppNode({ id: "root", name: "Root" });
    const child = createAppNode({ id: "child", name: "Child", parentId: "root" });
    const stray = createAppNode({ id: "stray", name: "Stray" });
    const nodeById = new Map([
      [root.id, root],
      [child.id, child],
      [stray.id, stray]
    ]);

    const seeded = upsertWorkspaceTabEntry(createEmptyWorkspaceTabSession(), root.id, child.id);
    const withSecondTab = upsertWorkspaceTabEntry(seeded, stray.id, stray.id);

    const sanitized = sanitizeWorkspaceTabSession({
      session: withSecondTab,
      nodeById,
      projectScopedNodeIds: new Set([root.id, child.id]),
      isNodeWithinTabScope: (rootNodeId, candidateNodeId) =>
        rootNodeId === root.id ? candidateNodeId === root.id || candidateNodeId === child.id : candidateNodeId === rootNodeId
    });

    expect(sanitized).toEqual({
      openTabs: [
        {
          nodeId: "root",
          lastSelectedNodeId: "child"
        }
      ],
      activeTabId: "root"
    });

    const closed = closeWorkspaceTabEntry(sanitized!, "root");
    expect(closed.session).toBeNull();
    expect(closed.nextActiveEntry).toBeNull();
  });

  it("resolves search navigation plans for library, execution, and browse modes", () => {
    const folder = createAppNode({ id: "folder", name: "Folder" });
    const file = createAppNode({ id: "file", name: "spec.docx", type: "document", parentId: "folder" });
    const nodeById = new Map([
      [folder.id, folder],
      [file.id, file]
    ]);

    expect(
      resolveWorkspaceSearchNavigationPlan({
        desktopViewMode: "library",
        workspaceMode: "grid",
        workspaceFocusMode: "structure",
        target: folder,
        nodeById
      })
    ).toEqual({ mode: "library" });

    expect(
      resolveWorkspaceSearchNavigationPlan({
        desktopViewMode: "dashboard",
        workspaceMode: "grid",
        workspaceFocusMode: "execution",
        target: folder,
        nodeById
      })
    ).toEqual({ mode: "workarea" });

    expect(
      resolveWorkspaceSearchNavigationPlan({
        desktopViewMode: "dashboard",
        workspaceMode: "grid",
        workspaceFocusMode: "structure",
        target: file,
        nodeById
      })
    ).toMatchObject({
      mode: "browse",
      browseTargetId: "folder",
      shouldClearActiveTab: true,
      shouldActivateBrowseSurface: true
    });
  });

  it("builds navigation state from the single source-of-truth chain", () => {
    const project = createProjectSummary({
      id: "project-1",
      name: "Workspace A",
      rootNodeId: "root"
    });
    const root = createAppNode({ id: "root", name: "Root" });
    const child = createAppNode({ id: "child", name: "Child", parentId: "root" });

    const state = buildWorkspaceNavigationState({
      activeProject: project,
      activeProjectId: project.id,
      activeProjectRootId: root.id,
      activeWorkspaceRootId: root.id,
      workspaceMode: "grid",
      desktopViewMode: "dashboard",
      workspaceFocusMode: "structure",
      selectionSurface: "grid",
      currentFolderId: root.id,
      currentFolderNode: root,
      mainPaneTargetNode: child,
      selectedNodeId: child.id,
      selectedNodeIds: new Set([child.id]),
      treeSelectedNodeId: root.id,
      treeSelectedNodeIds: new Set([root.id]),
      breadcrumbNodes: [root, child],
      tabSession: {
        openTabs: [],
        activeTabId: null
      }
    });

    expect(state.activePane).toBe("dashboard");
    expect(state.breadcrumbNodes.map((node) => node.id)).toEqual(["root", "child"]);
    expect(Array.from(state.treeSelectedNodeIds)).toEqual(["root"]);
  });
});
