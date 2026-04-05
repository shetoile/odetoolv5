import type { ContextMenuState } from "@/features/workspace/contextMenu";

type SelectionSurface = "tree" | "grid" | "timeline";

export type ContextMenuAction =
  | "create_chantier"
  | "new_topic"
  | "new_task_above"
  | "new_task_below"
  | "move_task_up"
  | "move_task_down"
  | "move_in"
  | "move_out"
  | "copy"
  | "cut"
  | "paste"
  | "move_to_workspace"
  | "distribute_to_na_workspace"
  | "save_as_organisation_model"
  | "save_as_database_template"
  | "duplicate"
  | "toggle_favorite"
  | "assign_favorite_group"
  | "delete"
  | "set_schedule"
  | "open"
  | "open_with"
  | "open_file_location"
  | "copy_full_path"
  | "declare_workarea"
  | "remove_workarea"
  | "add_deliverable"
  | "add_task"
  | "open_workarea"
  | "delete_deliverable"
  | "open_in_workspace"
  | "preview_file"
  | "remove_from_quick_access"
  | "show_favorite_group"
  | "new_favorite_group"
  | "delete_favorite_group"
  | "export_package"
  | "import_package"
  | "lock_structure"
  | "unlock_structure"
  | "edit_access_policy"
  | `toggle_favorite_group:${string}`;

type UseContextMenuActionsParams = {
  contextMenu: ContextMenuState | null;
  selectedNodeId: string | null;
  closeContextMenu: () => void;
  setPrimarySelection: (nodeId: string | null, surface?: SelectionSurface) => void;
  openScheduleModal: (nodeId: string) => void;
  onCreateTopicFromContext: (targetNodeId: string | null, surface: SelectionSurface) => Promise<void>;
  onCreateChantier: (
    targetNodeId?: string | null
  ) => Promise<void>;
  onCreateTimelineTaskRelative: (
    targetNodeId: string,
    options: { insertBefore: boolean }
  ) => Promise<void>;
  onMoveTimelineTask: (targetNodeId: string, direction: "up" | "down") => Promise<void>;
  onMoveNodeIn: (nodeId: string, surface?: SelectionSurface) => Promise<void>;
  onMoveNodeOut: (nodeId: string, surface?: SelectionSurface) => Promise<void>;
  onPasteBranch: (targetNodeId?: string | null, surface?: SelectionSurface) => Promise<void>;
  onMoveToWorkspace: (sourceNodeId?: string | null) => void;
  onDistributeToNAWorkspace: (sourceNodeId?: string | null) => void;
  onSaveAsOrganisationModel: (sourceNodeId?: string | null) => Promise<void>;
  onSaveAsDatabaseTemplate: (sourceNodeId?: string | null) => Promise<void>;
  onImportPackage: (targetNodeId?: string | null, surface?: SelectionSurface) => Promise<void>;
  onExportPackage: (nodeId: string) => Promise<void>;
  onOpenFileNode: (nodeId: string) => Promise<void>;
  onOpenFileNodeWith: (nodeId: string) => Promise<void>;
  onOpenFileNodeLocation: (nodeId: string) => Promise<void>;
  onCopyFileNodeFullPath: (nodeId: string) => Promise<void>;
  onSetNodeWorkareaOwner: (nodeId: string, enabled: boolean) => Promise<void>;
  onAddWorkareaDeliverable: (ownerNodeId: string) => Promise<void>;
  onAddWorkareaTask: (ownerNodeId: string, deliverableId: string) => Promise<void>;
  onOpenWorkarea: (ownerNodeId: string, deliverableId?: string | null) => Promise<void>;
  onDeleteWorkareaDeliverable: (ownerNodeId: string, deliverableId: string) => Promise<void>;
  onOpenQuickAccessNode: (nodeId: string) => Promise<void>;
  onPreviewFileNode: (nodeId: string) => void;
  onCopySelectedBranch: (mode: "copy" | "cut", sourceNodeId?: string) => Promise<void>;
  onDuplicateSelectedBranch: (sourceNodeId?: string, surface?: SelectionSurface) => Promise<void>;
  onToggleFavoriteNode: (nodeId: string) => Promise<void>;
  onToggleFavoriteNodeGroup: (nodeId: string, groupId: string) => Promise<void>;
  onAssignFavoriteNodeGroup: (nodeId: string) => Promise<void>;
  onRemoveQuickAccessNode: (nodeId: string) => Promise<void>;
  onCreateFavoriteGroup: () => void;
  onSelectFavoriteGroup: (groupId: string) => void;
  onDeleteFavoriteGroup: (groupId: string) => Promise<void>;
  onDeleteSelectedNodes: (sourceNodeId?: string | null, surface?: SelectionSurface) => Promise<void>;
  onSetNodeStructureLocked: (nodeId: string, locked: boolean) => Promise<void>;
  onEditNodeAccessPolicy: (nodeId: string) => void;
};

export function useContextMenuActions({
  contextMenu,
  selectedNodeId,
  closeContextMenu,
  setPrimarySelection,
  openScheduleModal,
  onCreateTopicFromContext,
  onCreateChantier,
  onCreateTimelineTaskRelative,
  onMoveTimelineTask,
  onMoveNodeIn,
  onMoveNodeOut,
  onPasteBranch,
  onMoveToWorkspace,
  onDistributeToNAWorkspace,
  onSaveAsOrganisationModel,
  onSaveAsDatabaseTemplate,
  onImportPackage,
  onExportPackage,
  onOpenFileNode,
  onOpenFileNodeWith,
  onOpenFileNodeLocation,
  onCopyFileNodeFullPath,
  onSetNodeWorkareaOwner,
  onAddWorkareaDeliverable,
  onAddWorkareaTask,
  onOpenWorkarea,
  onDeleteWorkareaDeliverable,
  onOpenQuickAccessNode,
  onPreviewFileNode,
  onCopySelectedBranch,
  onDuplicateSelectedBranch,
  onToggleFavoriteNode,
  onToggleFavoriteNodeGroup,
  onAssignFavoriteNodeGroup,
  onRemoveQuickAccessNode,
  onCreateFavoriteGroup,
  onSelectFavoriteGroup,
  onDeleteFavoriteGroup,
  onDeleteSelectedNodes,
  onSetNodeStructureLocked,
  onEditNodeAccessPolicy
}: UseContextMenuActionsParams) {
  const runContextMenuAction = async (action: ContextMenuAction) => {
    const currentContext = contextMenu;
    closeContextMenu();
    const contextNodeId = currentContext?.nodeId ?? null;
    const contextSurface = currentContext?.surface ?? "tree";
    const contextGroupId = currentContext?.groupId ?? null;
    const workareaOwnerNodeId =
      currentContext?.workareaOwnerNodeId ?? contextNodeId ?? selectedNodeId ?? null;
    const workareaDeliverableId = currentContext?.workareaDeliverableId ?? null;

    if (action === "set_schedule") {
      const targetNodeId = contextNodeId ?? selectedNodeId;
      if (!targetNodeId) return;
      setPrimarySelection(targetNodeId, "timeline");
      openScheduleModal(targetNodeId);
      return;
    }

    if (action === "new_favorite_group") {
      onCreateFavoriteGroup();
      return;
    }
    if (action === "show_favorite_group") {
      if (!contextGroupId) return;
      onSelectFavoriteGroup(contextGroupId);
      return;
    }
    if (action === "delete_favorite_group") {
      if (!contextGroupId) return;
      await onDeleteFavoriteGroup(contextGroupId);
      return;
    }
    if (action === "lock_structure" || action === "unlock_structure") {
      const targetNodeId = contextNodeId ?? selectedNodeId;
      if (!targetNodeId) return;
      await onSetNodeStructureLocked(targetNodeId, action === "lock_structure");
      return;
    }
    if (action === "edit_access_policy") {
      const targetNodeId = contextNodeId ?? selectedNodeId;
      if (!targetNodeId) return;
      onEditNodeAccessPolicy(targetNodeId);
      return;
    }

    if (action === "new_topic") {
      await onCreateTopicFromContext(contextNodeId, contextSurface);
      return;
    }
    if (action === "create_chantier") {
      await onCreateChantier(contextNodeId);
      return;
    }
    if (action === "new_task_above") {
      if (!contextNodeId) return;
      await onCreateTimelineTaskRelative(contextNodeId, { insertBefore: true });
      return;
    }
    if (action === "new_task_below") {
      if (!contextNodeId) return;
      await onCreateTimelineTaskRelative(contextNodeId, { insertBefore: false });
      return;
    }
    if (action === "move_task_up") {
      if (!contextNodeId) return;
      await onMoveTimelineTask(contextNodeId, "up");
      return;
    }
    if (action === "move_task_down") {
      if (!contextNodeId) return;
      await onMoveTimelineTask(contextNodeId, "down");
      return;
    }
    if (action === "move_in") {
      if (!contextNodeId) return;
      await onMoveNodeIn(contextNodeId, contextSurface);
      return;
    }
    if (action === "move_out") {
      if (!contextNodeId) return;
      await onMoveNodeOut(contextNodeId, contextSurface);
      return;
    }
    if (action === "paste") {
      await onPasteBranch(contextNodeId, contextSurface);
      return;
    }
    if (action === "move_to_workspace") {
      onMoveToWorkspace(contextNodeId);
      return;
    }
    if (action === "distribute_to_na_workspace") {
      onDistributeToNAWorkspace(contextNodeId);
      return;
    }
    if (action === "save_as_organisation_model") {
      await onSaveAsOrganisationModel(contextNodeId);
      return;
    }
    if (action === "save_as_database_template") {
      await onSaveAsDatabaseTemplate(contextNodeId);
      return;
    }
    if (action === "add_deliverable") {
      if (!workareaOwnerNodeId) return;
      await onAddWorkareaDeliverable(workareaOwnerNodeId);
      return;
    }
    if (action === "add_task") {
      if (!workareaOwnerNodeId || !workareaDeliverableId) return;
      await onAddWorkareaTask(workareaOwnerNodeId, workareaDeliverableId);
      return;
    }
    if (action === "open_workarea") {
      if (!workareaOwnerNodeId) return;
      await onOpenWorkarea(workareaOwnerNodeId, workareaDeliverableId);
      return;
    }
    if (action === "delete_deliverable") {
      if (!workareaOwnerNodeId || !workareaDeliverableId) return;
      await onDeleteWorkareaDeliverable(workareaOwnerNodeId, workareaDeliverableId);
      return;
    }
    if (action === "import_package") {
      await onImportPackage(contextNodeId, contextSurface);
      return;
    }

    if (!contextNodeId) return;

    if (action === "open_in_workspace") {
      await onOpenQuickAccessNode(contextNodeId);
      return;
    }
    if (action === "preview_file") {
      onPreviewFileNode(contextNodeId);
      return;
    }
    if (action === "remove_from_quick_access") {
      await onRemoveQuickAccessNode(contextNodeId);
      return;
    }
    if (action === "export_package") {
      await onExportPackage(contextNodeId);
      return;
    }
    if (action === "open") {
      await onOpenFileNode(contextNodeId);
      return;
    }
    if (action === "open_with") {
      await onOpenFileNodeWith(contextNodeId);
      return;
    }
    if (action === "open_file_location") {
      await onOpenFileNodeLocation(contextNodeId);
      return;
    }
    if (action === "copy_full_path") {
      await onCopyFileNodeFullPath(contextNodeId);
      return;
    }
    if (action === "declare_workarea") {
      await onSetNodeWorkareaOwner(contextNodeId, true);
      return;
    }
    if (action === "remove_workarea") {
      await onSetNodeWorkareaOwner(contextNodeId, false);
      return;
    }
    if (action === "copy") {
      await onCopySelectedBranch("copy", contextNodeId);
      return;
    }
    if (action === "cut") {
      await onCopySelectedBranch("cut", contextNodeId);
      return;
    }
    if (action === "duplicate") {
      await onDuplicateSelectedBranch(contextNodeId, contextSurface);
      return;
    }
    if (action === "toggle_favorite") {
      await onToggleFavoriteNode(contextNodeId);
      return;
    }
    if (action.startsWith("toggle_favorite_group:")) {
      const groupId = action.slice("toggle_favorite_group:".length).trim();
      if (!groupId) return;
      await onToggleFavoriteNodeGroup(contextNodeId, groupId);
      return;
    }
    if (action === "assign_favorite_group") {
      await onAssignFavoriteNodeGroup(contextNodeId);
      return;
    }
    if (action === "delete") {
      await onDeleteSelectedNodes(contextNodeId, contextSurface);
    }
  };

  return { runContextMenuAction };
}
