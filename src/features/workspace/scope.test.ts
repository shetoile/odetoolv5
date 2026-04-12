import { describe, expect, it } from "vitest";
import { createWorkspaceScopeContext } from "@/features/workspace/scope";
import { createProjectSummary } from "@/test/factories";

describe("createWorkspaceScopeContext", () => {
  const project = createProjectSummary({
    id: "project-1",
    name: "Workspace A",
    rootNodeId: "root"
  });

  it("keeps organization scope isolated from the documentation subtree", () => {
    const context = createWorkspaceScopeContext({
      activeProject: project,
      activeProjectId: project.id,
      activeProjectRootId: "root",
      documentationModeActive: false,
      documentationWorkspaceRootId: "database",
      fullProjectScopedNodeIds: new Set(["root", "ops", "database", "record-1"]),
      documentationScopedNodeIds: new Set(["database", "record-1"]),
      workspaceMode: "grid",
      desktopViewMode: "dashboard",
      workspaceFocusMode: "structure"
    });

    expect(context.activeWorkspaceRootId).toBe("root");
    expect(Array.from(context.projectScopedNodeIds ?? []).sort()).toEqual(["ops", "root"]);
    expect(context.libraryModeActive).toBe(false);
    expect(context.executionModeActive).toBe(false);
  });

  it("switches the visible scope to the documentation root when documentation mode is active", () => {
    const context = createWorkspaceScopeContext({
      activeProject: project,
      activeProjectId: project.id,
      activeProjectRootId: "root",
      documentationModeActive: true,
      documentationWorkspaceRootId: "database",
      fullProjectScopedNodeIds: new Set(["root", "ops", "database", "record-1"]),
      documentationScopedNodeIds: new Set(["database", "record-1"]),
      workspaceMode: "grid",
      desktopViewMode: "procedure",
      workspaceFocusMode: "data"
    });

    expect(context.activeWorkspaceRootId).toBe("database");
    expect(Array.from(context.projectScopedNodeIds ?? []).sort()).toEqual(["database", "record-1"]);
  });

  it("exposes execution mode from the same scope context used by the shell", () => {
    const context = createWorkspaceScopeContext({
      activeProject: project,
      activeProjectId: project.id,
      activeProjectRootId: "root",
      documentationModeActive: false,
      documentationWorkspaceRootId: null,
      fullProjectScopedNodeIds: new Set(["root", "deliverable"]),
      documentationScopedNodeIds: null,
      workspaceMode: "grid",
      desktopViewMode: "grid",
      workspaceFocusMode: "execution"
    });

    expect(context.executionModeActive).toBe(true);
  });
});
