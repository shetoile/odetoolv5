import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { resolveActionSelectionIds } from "@/features/workspace/actions";
import { moveNode } from "@/lib/nodeService";
import { ROOT_PARENT_ID, type AppNode, type ProjectSummary } from "@/lib/types";
import type { TranslationParams } from "@/lib/i18n";

type TranslateFn = (key: string, params?: TranslationParams) => string;
type SelectionSurface = "tree" | "grid" | "timeline";

type UseMoveWorkspaceActionsParams = {
  t: TranslateFn;
  projects: ProjectSummary[];
  selectedNodeIds: Set<string>;
  selectedNode: AppNode | null;
  nodeById: Map<string, AppNode>;
  byParent: Map<string, AppNode[]>;
  workspaceRootIdSet: Set<string>;
  isNodeInSubtree: (sourceId: string, targetId: string) => boolean;
  ensureStructureMutationAllowed: (
    nodeIds: Array<string | null | undefined>,
    options?: { scope?: "organization" | "workarea" | "content" }
  ) => boolean;
  setProjectError: Dispatch<SetStateAction<string | null>>;
  setPrimarySelection: (nodeId: string | null, surface?: SelectionSurface) => void;
  refreshTreeAndKeepContext: (
    nextSelectedNodeId?: string,
    expandNodeIds?: string[],
    preferredSurface?: SelectionSurface
  ) => Promise<void>;
  refreshProjects: (preferredProjectId?: string | null) => Promise<string | null>;
  handleProjectSelectionChange: (nextProjectId: string) => Promise<void>;
};

export function useMoveWorkspaceActions({
  t,
  projects,
  selectedNodeIds,
  selectedNode,
  nodeById,
  byParent,
  workspaceRootIdSet,
  isNodeInSubtree,
  ensureStructureMutationAllowed,
  setProjectError,
  setPrimarySelection,
  refreshTreeAndKeepContext,
  refreshProjects,
  handleProjectSelectionChange
}: UseMoveWorkspaceActionsParams) {
  const [moveWorkspaceModalOpen, setMoveWorkspaceModalOpen] = useState(false);
  const [moveWorkspaceSourceNodeIds, setMoveWorkspaceSourceNodeIds] = useState<string[]>([]);
  const [moveWorkspaceTargetProjectId, setMoveWorkspaceTargetProjectId] = useState("");

  const closeMoveWorkspaceModal = () => {
    setMoveWorkspaceModalOpen(false);
    setMoveWorkspaceSourceNodeIds([]);
    setMoveWorkspaceTargetProjectId("");
  };

  const resolveMoveWorkspaceSourceIds = (sourceNodeId?: string | null): string[] => {
    return resolveActionSelectionIds({
      sourceNodeId,
      selectedNodeId: selectedNode?.id ?? null,
      selectedNodeIds,
      nodeById,
      filterDescendants: true,
      isNodeInSubtree
    });
  };

  const openMoveToWorkspaceModal = (sourceNodeId?: string | null) => {
    const sourceIds = resolveMoveWorkspaceSourceIds(sourceNodeId);
    if (sourceIds.length === 0) return;
    if (!ensureStructureMutationAllowed(sourceIds)) {
      return;
    }
    if (sourceIds.some((sourceId) => nodeById.get(sourceId)?.properties?.odeExecutionTask === true)) {
      setProjectError(t("project.move_execution_task_blocked"));
      return;
    }
    if (sourceIds.some((sourceId) => workspaceRootIdSet.has(sourceId))) {
      setProjectError(t("project.move_root_blocked"));
      return;
    }
    const firstSourceId = sourceIds[0];
    const defaultTargetProject =
      projects.find((project) => !isNodeInSubtree(project.rootNodeId, firstSourceId) && project.rootNodeId !== firstSourceId) ??
      null;
    setMoveWorkspaceSourceNodeIds(sourceIds);
    setMoveWorkspaceTargetProjectId(defaultTargetProject?.id ?? "");
    setMoveWorkspaceModalOpen(true);
    setProjectError(null);
  };

  const moveBranchToWorkspace = async () => {
    const targetProject = projects.find((project) => project.id === moveWorkspaceTargetProjectId);
    if (!targetProject || moveWorkspaceSourceNodeIds.length === 0) return;
    if (!ensureStructureMutationAllowed([...moveWorkspaceSourceNodeIds, targetProject.rootNodeId])) {
      closeMoveWorkspaceModal();
      return;
    }
    if (moveWorkspaceSourceNodeIds.some((sourceId) => nodeById.get(sourceId)?.properties?.odeExecutionTask === true)) {
      setProjectError(t("project.move_execution_task_blocked"));
      closeMoveWorkspaceModal();
      return;
    }

    try {
      const targetRootId = targetProject.rootNodeId;
      const sourceIdSet = new Set(moveWorkspaceSourceNodeIds);
      const targetChildren = (byParent.get(targetRootId) ?? []).filter((child) => !sourceIdSet.has(child.id));
      let afterId = targetChildren.length > 0 ? targetChildren[targetChildren.length - 1].id : null;
      const refreshParents = new Set<string>([targetRootId, ROOT_PARENT_ID]);
      const movableSourceIds = moveWorkspaceSourceNodeIds.filter((sourceId) => {
        const sourceNode = nodeById.get(sourceId);
        if (!sourceNode) return false;
        if (sourceId === targetRootId) return false;
        if (isNodeInSubtree(sourceId, targetRootId)) return false;
        return true;
      });

      for (let index = 0; index < movableSourceIds.length; index += 1) {
        const sourceId = movableSourceIds[index];
        const sourceNode = nodeById.get(sourceId);
        if (!sourceNode) continue;
        refreshParents.add(sourceNode.parentId);
        const shouldSyncProjection = index === movableSourceIds.length - 1;
        await moveNode(sourceId, targetRootId, afterId, shouldSyncProjection);
        afterId = sourceId;
      }
      const focusId = moveWorkspaceSourceNodeIds[0];
      const refreshedTargetProjectId = (await refreshProjects(targetProject.id)) ?? targetProject.id;
      await handleProjectSelectionChange(refreshedTargetProjectId);
      await refreshTreeAndKeepContext(focusId, Array.from(refreshParents), "tree");
      setPrimarySelection(focusId, "tree");
      closeMoveWorkspaceModal();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setProjectError(t("project.move_failed", { reason }));
    }
  };

  useEffect(() => {
    if (!moveWorkspaceModalOpen) return;
    const isValidTarget = (project: ProjectSummary) =>
      moveWorkspaceSourceNodeIds.every((sourceId) => project.rootNodeId !== sourceId) &&
      moveWorkspaceSourceNodeIds.every((sourceId) => !isNodeInSubtree(sourceId, project.rootNodeId));
    const nextTargetProject =
      projects.find((project) => project.id === moveWorkspaceTargetProjectId && isValidTarget(project)) ??
      projects.find((project) => isValidTarget(project)) ??
      null;
    const nextTargetId = nextTargetProject?.id ?? "";
    if (nextTargetId !== moveWorkspaceTargetProjectId) {
      setMoveWorkspaceTargetProjectId(nextTargetId);
    }
  }, [
    moveWorkspaceModalOpen,
    projects,
    moveWorkspaceSourceNodeIds,
    moveWorkspaceTargetProjectId,
    isNodeInSubtree
  ]);

  useEffect(() => {
    if (!moveWorkspaceModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMoveWorkspaceModal();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [moveWorkspaceModalOpen]);

  return {
    moveWorkspaceModalOpen,
    moveWorkspaceSourceNodeIds,
    moveWorkspaceTargetProjectId,
    setMoveWorkspaceTargetProjectId,
    closeMoveWorkspaceModal,
    openMoveToWorkspaceModal,
    moveBranchToWorkspace
  };
}
