import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MainPaneHeader } from "@/components/views/MainPaneHeader";
import { createAppNode } from "@/test/factories";

describe("MainPaneHeader", () => {
  it("renders from controller props and routes breadcrumb and node-view actions through navigation actions", () => {
    const root = createAppNode({ id: "root", name: "Workspace" });
    const child = createAppNode({ id: "child", name: "Operations", parentId: "root" });
    const selectBreadcrumbNode = vi.fn();
    const openNodeHome = vi.fn();
    const openNodeExecution = vi.fn();
    const openNodeTimeline = vi.fn();

    render(
      <MainPaneHeader
        t={(key) =>
          ({
            "desktop.view_home": "Home",
            "tabs.execution": "Execution",
            "tabs.timeline": "Timeline",
            "structure_lock.locked_badge": "Locked"
          })[key] ?? key
        }
        navigationState={{
          breadcrumbNodes: [root, child],
          workspaceMode: "grid",
          desktopViewMode: "dashboard",
          workspaceFocusMode: "structure",
          mainPaneTargetNode: child
        }}
        scopeContext={{
          documentationModeActive: false,
          libraryModeActive: false
        }}
        navigationActions={{
          selectBreadcrumbNode,
          openNodeHome,
          openNodeExecution,
          openNodeTimeline
        }}
        workspaceTitle="Workspace"
        workspaceStructureLocked={false}
        workspaceQuickApps={[]}
        uploadInputRef={createRef<HTMLInputElement>()}
        onUploadInputChange={() => {}}
        onLaunchWorkspaceQuickApp={() => {}}
        onManageWorkspaceQuickApps={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Operations" }));
    expect(selectBreadcrumbNode).toHaveBeenCalledWith("child");

    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(openNodeHome).toHaveBeenCalledWith("child");

    fireEvent.click(screen.getByRole("button", { name: "Execution" }));
    expect(openNodeExecution).toHaveBeenCalledWith("child");

    fireEvent.click(screen.getByRole("button", { name: "Timeline" }));
    expect(openNodeTimeline).toHaveBeenCalledWith("child");
  });
});
