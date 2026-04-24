import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import {
  createProjectFromPath,
  createWorkspace,
  deleteProjectWorkspace,
  pickWindowsProjectFolder,
  repairWorkspaceIndex,
  reSyncProjectWorkspace,
  setProjectWorkspacePath
} from "@/lib/nodeService";
import type { ProjectSummary } from "@/lib/types";
import type { TranslationParams } from "@/lib/i18n";

type TranslateFn = (key: string, params?: TranslationParams) => string;
type SelectionSurface = "tree" | "grid" | "timeline";

type UseWorkspaceActionsParams = {
  t: TranslateFn;
  projects: ProjectSummary[];
  activeProjectId: string | null;
  activeProjectIdRef: MutableRefObject<string | null>;
  projectPathInput: string;
  workspaceNameInput: string;
  workspaceLocalPathInput: string;
  isProjectImporting: boolean;
  isWorkspaceCreating: boolean;
  isProjectResyncing: boolean;
  isWorkspaceRepairing: boolean;
  isProjectDeleting: boolean;
  setActiveProjectId: Dispatch<SetStateAction<string | null>>;
  setProjectPathInput: Dispatch<SetStateAction<string>>;
  setWorkspaceNameInput: Dispatch<SetStateAction<string>>;
  setWorkspaceLocalPathInput: Dispatch<SetStateAction<string>>;
  setProjectError: Dispatch<SetStateAction<string | null>>;
  setProjectNotice: Dispatch<SetStateAction<string | null>>;
  setIsProjectImporting: Dispatch<SetStateAction<boolean>>;
  setIsWorkspaceCreating: Dispatch<SetStateAction<boolean>>;
  setIsProjectResyncing: Dispatch<SetStateAction<boolean>>;
  setIsWorkspaceRepairing: Dispatch<SetStateAction<boolean>>;
  setIsProjectDeleting: Dispatch<SetStateAction<boolean>>;
  setExpandedIds: Dispatch<SetStateAction<Set<string>>>;
  setPrimarySelection: (nodeId: string | null, surface?: SelectionSurface) => void;
  requestDeleteConfirmation: (message: string) => Promise<boolean>;
  refreshProjects: (preferredProjectId?: string | null) => Promise<string | null>;
  refreshTree: () => Promise<void>;
  navigateTo: (folderId: string | null) => Promise<void>;
};

function ensureExpandedRoot(setExpandedIds: Dispatch<SetStateAction<Set<string>>>, rootNodeId: string) {
  setExpandedIds((prev) => {
    if (prev.has(rootNodeId)) return prev;
    const next = new Set(prev);
    next.add(rootNodeId);
    return next;
  });
}

export function useWorkspaceActions({
  t,
  projects,
  activeProjectId,
  activeProjectIdRef,
  projectPathInput,
  workspaceNameInput,
  workspaceLocalPathInput,
  isProjectImporting,
  isWorkspaceCreating,
  isProjectResyncing,
  isWorkspaceRepairing,
  isProjectDeleting,
  setActiveProjectId,
  setProjectPathInput,
  setWorkspaceNameInput,
  setWorkspaceLocalPathInput,
  setProjectError,
  setProjectNotice,
  setIsProjectImporting,
  setIsWorkspaceCreating,
  setIsProjectResyncing,
  setIsWorkspaceRepairing,
  setIsProjectDeleting,
  setExpandedIds,
  setPrimarySelection,
  requestDeleteConfirmation,
  refreshProjects,
  refreshTree,
  navigateTo
}: UseWorkspaceActionsParams) {
  const buildWorkspaceLinkedPath = (parentPath: string, workspaceName: string) => {
    const trimmedParent = parentPath.trim().replace(/[\\/]+$/, "");
    if (!trimmedParent) return "";
    return `${trimmedParent}\\${workspaceName}`;
  };

  const handleProjectSelectionChange = async (nextProjectId: string) => {
    const normalized = nextProjectId.trim().length > 0 ? nextProjectId : null;
    setActiveProjectId(normalized);
    activeProjectIdRef.current = normalized;
    setProjectError(null);
    setProjectNotice(null);
    if (!normalized) {
      await navigateTo(null);
      setPrimarySelection(null, "tree");
      return;
    }
    const targetProject = projects.find((project) => project.id === normalized);
    if (!targetProject) return;
    await navigateTo(targetProject.rootNodeId);
    ensureExpandedRoot(setExpandedIds, targetProject.rootNodeId);
    setPrimarySelection(targetProject.rootNodeId, "tree");
  };

  const handleImportProjectPath = async () => {
    const trimmedPath = projectPathInput.trim();
    if (!trimmedPath || isProjectImporting) return;
    setProjectError(null);
    setProjectNotice(null);
    setIsProjectImporting(true);
    try {
      const project = await createProjectFromPath(trimmedPath);
      setActiveProjectId(project.id);
      activeProjectIdRef.current = project.id;
      setProjectPathInput("");
      await refreshTree();
      await refreshProjects(project.id);
      await navigateTo(project.rootNodeId);
      ensureExpandedRoot(setExpandedIds, project.rootNodeId);
      setPrimarySelection(project.rootNodeId, "tree");
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setProjectError(t("project.import_failed", { reason }));
    } finally {
      setIsProjectImporting(false);
    }
  };

  const handlePickAndImportProjectFolder = async () => {
    if (isProjectImporting) return;
    setProjectError(null);
    setProjectNotice(null);
    setIsProjectImporting(true);
    try {
      const pickedPath = await pickWindowsProjectFolder();
      const trimmedPath = pickedPath?.trim() ?? "";
      if (!trimmedPath) return;
      const project = await createProjectFromPath(trimmedPath);
      setActiveProjectId(project.id);
      activeProjectIdRef.current = project.id;
      await refreshTree();
      await refreshProjects(project.id);
      await navigateTo(project.rootNodeId);
      ensureExpandedRoot(setExpandedIds, project.rootNodeId);
      setPrimarySelection(project.rootNodeId, "tree");
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setProjectError(t("project.import_failed", { reason }));
    } finally {
      setIsProjectImporting(false);
    }
  };

  const handlePickWorkspaceLocalFolder = async () => {
    if (isWorkspaceCreating || isProjectImporting) return;
    try {
      const pickedPath = await pickWindowsProjectFolder();
      setWorkspaceLocalPathInput(pickedPath?.trim() ?? "");
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setProjectError(t("project.local_path_failed", { reason }));
    }
  };

  const handleCreateWorkspace = async (): Promise<ProjectSummary | null> => {
    const trimmedName = workspaceNameInput.trim();
    if (!trimmedName || isWorkspaceCreating) return null;
    setProjectError(null);
    setProjectNotice(null);
    setIsWorkspaceCreating(true);
    try {
      const createdWorkspace = await createWorkspace(trimmedName);
      let workspace = createdWorkspace;
      const trimmedLocalParentPath = workspaceLocalPathInput.trim();
      if (trimmedLocalParentPath) {
        const linkedPath = buildWorkspaceLinkedPath(trimmedLocalParentPath, createdWorkspace.name);
        try {
          workspace = await setProjectWorkspacePath(createdWorkspace.id, linkedPath);
          setProjectNotice(t("project.local_path_set_notice", { path: linkedPath }));
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          setProjectError(t("project.local_path_failed", { reason }));
        }
      }
      setActiveProjectId(workspace.id);
      activeProjectIdRef.current = workspace.id;
      setWorkspaceNameInput("");
      setWorkspaceLocalPathInput("");
      await refreshTree();
      await refreshProjects(workspace.id);
      await navigateTo(workspace.rootNodeId);
      ensureExpandedRoot(setExpandedIds, workspace.rootNodeId);
      setPrimarySelection(workspace.rootNodeId, "tree");
      return workspace;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setProjectError(t("project.create_failed", { reason }));
      return null;
    } finally {
      setIsWorkspaceCreating(false);
    }
  };

  const handleSetActiveWorkspaceLocalPath = async () => {
    if (!activeProjectId || isWorkspaceCreating || isProjectImporting || isProjectDeleting) return null;
    const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;
    if (!activeProject) return null;
    setProjectError(null);
    setProjectNotice(null);
    try {
      const pickedParentPath = await pickWindowsProjectFolder();
      const trimmedParentPath = pickedParentPath?.trim() ?? "";
      if (!trimmedParentPath) return null;
      const linkedPath = buildWorkspaceLinkedPath(trimmedParentPath, activeProject.name);
      const workspace = await setProjectWorkspacePath(activeProject.id, linkedPath);
      setActiveProjectId(workspace.id);
      activeProjectIdRef.current = workspace.id;
      await refreshTree();
      await refreshProjects(workspace.id);
      await navigateTo(workspace.rootNodeId);
      ensureExpandedRoot(setExpandedIds, workspace.rootNodeId);
      setPrimarySelection(workspace.rootNodeId, "tree");
      setProjectNotice(t("project.local_path_set_notice", { path: linkedPath }));
      return workspace;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setProjectError(t("project.local_path_failed", { reason }));
      return null;
    }
  };

  const handleReSyncWorkspace = async () => {
    const projectId = activeProjectId;
    if (!projectId || isProjectResyncing) return null;
    setProjectError(null);
    setProjectNotice(null);
    setIsProjectResyncing(true);
    try {
      const importedCount = await reSyncProjectWorkspace(projectId);
      await refreshTree();
      await refreshProjects(projectId);
      setProjectNotice(
        importedCount > 0
          ? t("project.resync_done", { count: importedCount })
          : t("project.resync_done_no_changes")
      );
      return importedCount;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setProjectError(t("project.resync_failed", { reason }));
      return null;
    } finally {
      setIsProjectResyncing(false);
    }
  };

  const handleRepairWorkspaceIndex = async () => {
    if (isWorkspaceRepairing) return;
    setProjectError(null);
    setProjectNotice(null);
    setIsWorkspaceRepairing(true);
    try {
      const summary = await repairWorkspaceIndex();
      await refreshTree();
      await refreshProjects(activeProjectIdRef.current);
      setProjectNotice(
        t("project.repair_done", {
          added: summary.recoveredCount,
          updated: summary.updatedCount,
          removed: summary.removedStaleCount
        })
      );
      if (summary.warning) {
        setProjectError(summary.warning);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setProjectError(t("project.repair_failed", { reason }));
    } finally {
      setIsWorkspaceRepairing(false);
    }
  };

  const handleDeleteProjectWorkspace = async () => {
    const projectId = activeProjectId;
    if (!projectId || isProjectDeleting) return;
    const project = projects.find((item) => item.id === projectId);
    const projectName = project?.name ?? projectId;
    const confirmed = await requestDeleteConfirmation(t("project.delete_confirm", { name: projectName }));
    if (!confirmed) return;

    setProjectError(null);
    setProjectNotice(null);
    setIsProjectDeleting(true);
    try {
      await deleteProjectWorkspace(projectId);
      await refreshTree();
      const nextProjectId = await refreshProjects();
      setActiveProjectId(nextProjectId);
      activeProjectIdRef.current = nextProjectId;
      if (!nextProjectId) {
        await navigateTo(null);
        setPrimarySelection(null, "tree");
        return;
      }
      const nextProject = projects.find((item) => item.id === nextProjectId) ?? null;
      if (!nextProject) return;
      await navigateTo(nextProject.rootNodeId);
      ensureExpandedRoot(setExpandedIds, nextProject.rootNodeId);
      setPrimarySelection(nextProject.rootNodeId, "tree");
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setProjectError(t("project.delete_failed", { reason }));
    } finally {
      setIsProjectDeleting(false);
    }
  };

  return {
    handleProjectSelectionChange,
    handleImportProjectPath,
    handlePickAndImportProjectFolder,
    handlePickWorkspaceLocalFolder,
    handleCreateWorkspace,
    handleSetActiveWorkspaceLocalPath,
    handleReSyncWorkspace,
    handleRepairWorkspaceIndex,
    handleDeleteProjectWorkspace
  };
}
