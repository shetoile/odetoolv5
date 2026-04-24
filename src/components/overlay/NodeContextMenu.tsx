import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from "react";
import type { ContextMenuState } from "@/features/workspace/contextMenu";
import type { ContextMenuAction } from "@/hooks/useContextMenuActions";
import type { TranslationParams } from "@/lib/i18n";

type TranslateFn = (key: string, params?: TranslationParams) => string;

interface NodeContextMenuProps {
  t: TranslateFn;
  contextMenu: ContextMenuState | null;
  canPasteBranch: boolean;
  projectsCount: number;
  contextMenuNodeIsFile: boolean;
  contextMenuNodeIsExecutionTask: boolean;
  contextMenuNodeStructureLocked: boolean;
  canToggleStructureLock: boolean;
  canEditAccessPolicy: boolean;
  contextMenuNodeWorkareaKind: "deliverable" | "task" | "subtask" | null;
  contextMenuNodeIsDeclaredWorkareaOwner: boolean;
  contextMenuNodeCanOpenWorkarea: boolean;
  contextMenuNodeFilePath: string | null;
  workspaceRootIdSet: Set<string>;
  selectedNodeId: string | null;
  canMoveNodeIn: boolean;
  canMoveNodeOut: boolean;
  contextMenuGroupCanDelete: boolean;
  canDistributeToNAWorkspace: boolean;
  canCreateChantier: boolean;
  canSaveAsOrganisationModel: boolean;
  canSaveAsDatabaseTemplate: boolean;
  restrictToFavoriteGroupsOnly: boolean;
  onRunAction: (action: ContextMenuAction) => void;
}

function ContextMenuItem(props: {
  label: string;
  action: ContextMenuAction;
  onRunAction: (action: ContextMenuAction) => void;
  disabled?: boolean;
  danger?: boolean;
  autoFocus?: boolean;
  shortcutLabel?: string | null;
  runOnMouseDown?: boolean;
}) {
  return (
    <button
      className={`ode-context-item${props.danger ? " ode-context-item-danger" : ""}`}
      autoFocus={props.autoFocus}
      disabled={props.disabled}
      onMouseDown={(event) => {
        if (!props.runOnMouseDown || props.disabled) return;
        event.preventDefault();
        props.onRunAction(props.action);
      }}
      onClick={() => {
        if (props.runOnMouseDown) return;
        props.onRunAction(props.action);
      }}
    >
      <span className="ode-context-item-main">
        <span>{props.label}</span>
      </span>
      {props.shortcutLabel ? (
        <span className="ode-context-item-shortcut" aria-hidden="true">
          {props.shortcutLabel}
        </span>
      ) : null}
    </button>
  );
}

export function NodeContextMenu({
  t,
  contextMenu,
  canPasteBranch,
  projectsCount,
  contextMenuNodeIsFile,
  contextMenuNodeIsExecutionTask,
  contextMenuNodeStructureLocked,
  canToggleStructureLock,
  canEditAccessPolicy,
  contextMenuNodeWorkareaKind,
  contextMenuNodeCanOpenWorkarea,
  contextMenuNodeFilePath,
  workspaceRootIdSet,
  selectedNodeId,
  canMoveNodeIn,
  canMoveNodeOut,
  contextMenuGroupCanDelete,
  canDistributeToNAWorkspace,
  canCreateChantier,
  canSaveAsOrganisationModel,
  canSaveAsDatabaseTemplate,
  restrictToFavoriteGroupsOnly,
  onRunAction
}: NodeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPlacement, setMenuPlacement] = useState<{ left: number; top: number; maxHeight: number } | null>(null);
  const selectedOrContextNodeId = contextMenu?.nodeId ?? selectedNodeId;
  const contextNodeIsWorkspaceRoot = Boolean(contextMenu?.nodeId && workspaceRootIdSet.has(contextMenu.nodeId));
  const contextMenuIsWorkarea = contextMenu?.workareaMode === true;
  const contextMenuHasWorkareaOwner = Boolean(contextMenu?.workareaOwnerNodeId);
  const workareaCreateLabel = (() => {
    if (!contextMenuIsWorkarea) return t("context.new_topic");
    if (!contextMenu?.nodeId || contextMenuNodeIsFile || !contextMenuNodeWorkareaKind) {
      return t("context.add");
    }
    if (contextMenuNodeWorkareaKind === "deliverable") {
      return t("procedure.node_task_add");
    }
    return t("procedure.node_subtask_add");
  })();
  const workareaRemoveLabel = (() => {
    if (contextMenuNodeIsFile || !contextMenuNodeWorkareaKind) return t("context.delete");
    if (contextMenuNodeWorkareaKind === "deliverable") {
      return t("procedure.node_deliverable_remove");
    }
    if (contextMenuNodeWorkareaKind === "task") {
      return t("procedure.node_task_remove");
    }
    return t("procedure.node_subtask_remove");
  })();
  const isTimelineWorkareaMenu = contextMenuIsWorkarea && contextMenu?.surface === "timeline";
  const showTimelineWorkareaAdd = isTimelineWorkareaMenu && (!contextMenuNodeWorkareaKind || contextMenuNodeWorkareaKind === "deliverable");
  const showTimelineWorkareaSchedule =
    isTimelineWorkareaMenu &&
    (contextMenuNodeWorkareaKind === "task" || contextMenuNodeWorkareaKind === "subtask");
  const showTimelineWorkareaRemove = isTimelineWorkareaMenu && contextMenuNodeWorkareaKind !== null;
  const showStructureLockAction = canToggleStructureLock;
  const showAccessPolicyAction = canEditAccessPolicy;
  void canCreateChantier;
  void canSaveAsOrganisationModel;
  const structureLockLabel = contextMenuNodeStructureLocked
    ? t("context.unlock_structure")
    : t("context.lock_structure");

  const getEnabledButtons = () =>
    Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>("button.ode-context-item:not(:disabled)") ?? []
    );

  const focusButtonAt = (index: number) => {
    const buttons = getEnabledButtons();
    if (buttons.length === 0) return;
    const normalizedIndex = ((index % buttons.length) + buttons.length) % buttons.length;
    buttons[normalizedIndex]?.focus();
  };

  useEffect(() => {
    if (!contextMenu) return;
    const frame = window.requestAnimationFrame(() => {
      focusButtonAt(0);
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [contextMenu]);

  useLayoutEffect(() => {
    if (!contextMenu) {
      setMenuPlacement(null);
      return;
    }
    const updatePlacement = () => {
      const menu = menuRef.current;
      if (!menu) return;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const viewportMargin = 8;
      const maxHeight = Math.max(160, Math.min(576, viewportHeight - viewportMargin * 2));
      const menuWidth = Math.ceil(menu.getBoundingClientRect().width) || menu.offsetWidth || 320;
      const menuHeight = Math.min(menu.scrollHeight, maxHeight);
      const left = Math.max(
        viewportMargin,
        Math.min(contextMenu.x, viewportWidth - viewportMargin - menuWidth)
      );
      const top = Math.max(
        viewportMargin,
        Math.min(contextMenu.y, viewportHeight - viewportMargin - menuHeight)
      );
      setMenuPlacement((current) => {
        if (
          current &&
          current.left === left &&
          current.top === top &&
          current.maxHeight === maxHeight
        ) {
          return current;
        }
        return { left, top, maxHeight };
      });
    };
    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    return () => {
      window.removeEventListener("resize", updatePlacement);
    };
  }, [contextMenu]);

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const buttons = getEnabledButtons();
    if (buttons.length === 0) return;
    const activeIndex = buttons.findIndex((button) => button === document.activeElement);
    if (event.key === "ArrowDown" || (event.key === "Tab" && !event.shiftKey)) {
      event.preventDefault();
      focusButtonAt(activeIndex < 0 ? 0 : activeIndex + 1);
      return;
    }
    if (event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey)) {
      event.preventDefault();
      focusButtonAt(activeIndex <= 0 ? buttons.length - 1 : activeIndex - 1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusButtonAt(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      focusButtonAt(buttons.length - 1);
    }
  };

  if (!contextMenu) return null;
  if (contextMenuIsWorkarea && !contextMenu.nodeId && !contextMenuHasWorkareaOwner) return null;
  const menuLeft = menuPlacement?.left ?? contextMenu.x;
  const menuTop = menuPlacement?.top ?? contextMenu.y;
  const menuMaxHeight = `${menuPlacement?.maxHeight ?? 576}px`;

  return (
    <>
      <div
        ref={menuRef}
        className="ode-context-menu"
        style={{ left: `${menuLeft}px`, top: `${menuTop}px`, maxHeight: menuMaxHeight }}
        role="menu"
        aria-label="Node actions"
        onKeyDown={handleMenuKeyDown}
      >
      {contextMenu.kind === "quick_access_node" && contextMenu.nodeId ? (
        <>
          <ContextMenuItem
            autoFocus
            label={t("context.open_in_workspace")}
            action="open_in_workspace"
            onRunAction={onRunAction}
          />
          {contextMenuNodeIsFile ? (
            <ContextMenuItem
              label={t("context.preview_file")}
              action="preview_file"
              onRunAction={onRunAction}
            />
          ) : null}
          <div className="ode-context-separator" />
          <ContextMenuItem
            label={t("context.assign_favorite_group")}
            action="assign_favorite_group"
            onRunAction={onRunAction}
            shortcutLabel="Ctrl+Shift+G"
          />
        </>
      ) : contextMenu.kind === "quick_access_group" ? (
        <>
          <ContextMenuItem
            autoFocus
            label={t("context.show_group")}
            action="show_favorite_group"
            onRunAction={onRunAction}
          />
          <div className="ode-context-separator" />
          <ContextMenuItem
            label={t("favorites.group_delete")}
            action="delete_favorite_group"
            onRunAction={onRunAction}
            disabled={!contextMenuGroupCanDelete}
            danger
          />
        </>
      ) : contextMenu.kind === "quick_access_surface" ? (
        <ContextMenuItem
          autoFocus
          label={t("favorites.group_new")}
          action="new_favorite_group"
          onRunAction={onRunAction}
        />
      ) : contextMenu.nodeId && restrictToFavoriteGroupsOnly ? (
        <ContextMenuItem
          autoFocus
          label={t("context.assign_favorite_group")}
          action="assign_favorite_group"
          onRunAction={onRunAction}
          shortcutLabel="Ctrl+Shift+G"
        />
      ) : contextMenu.nodeId ? (
        contextMenuIsWorkarea ? (
          <>
            {contextMenuNodeIsFile ? (
              <>
                <ContextMenuItem
                  autoFocus
                  label={t("context.open")}
                  action="open"
                  onRunAction={onRunAction}
                />
                <ContextMenuItem
                  label={t("context.open_with")}
                  action="open_with"
                  onRunAction={onRunAction}
                />
                <ContextMenuItem
                  label={t("context.open_location")}
                  action="open_file_location"
                  onRunAction={onRunAction}
                  disabled={!contextMenuNodeFilePath}
                />
                <ContextMenuItem
                  label={t("context.copy_full_path")}
                  action="copy_full_path"
                  onRunAction={onRunAction}
                  disabled={!contextMenuNodeFilePath}
                />
                {showAccessPolicyAction ? <div className="ode-context-separator" /> : null}
                {showAccessPolicyAction ? (
                  <ContextMenuItem
                    label={t("context.access_policy")}
                    action="edit_access_policy"
                    onRunAction={onRunAction}
                  />
                ) : null}
                <div className="ode-context-separator" />
                <ContextMenuItem
                  label={workareaRemoveLabel}
                  action="delete"
                  onRunAction={onRunAction}
                  danger
                  shortcutLabel="Del"
                />
              </>
            ) : (
              <>
                {isTimelineWorkareaMenu ? (
                  <>
                    {showTimelineWorkareaAdd ? (
                      <ContextMenuItem
                        autoFocus
                        label={workareaCreateLabel}
                        action="new_topic"
                        onRunAction={onRunAction}
                      />
                    ) : null}
                    {showTimelineWorkareaSchedule ? (
                      <ContextMenuItem
                        autoFocus={!showTimelineWorkareaAdd}
                        label={t("timeline.open_schedule")}
                        action="set_schedule"
                        onRunAction={onRunAction}
                        disabled={!selectedOrContextNodeId}
                      />
                    ) : null}
                    {showTimelineWorkareaRemove ? (
                      <>
                        {(showTimelineWorkareaAdd || showTimelineWorkareaSchedule) ? (
                          <div className="ode-context-separator" />
                        ) : null}
                        <ContextMenuItem
                          label={workareaRemoveLabel}
                          action="delete"
                          onRunAction={onRunAction}
                          danger
                          shortcutLabel="Del"
                        />
                      </>
                    ) : null}
                  </>
                ) : null}
                {!isTimelineWorkareaMenu ? (
                  <>
                    <ContextMenuItem
                      autoFocus
                      label={workareaCreateLabel}
                      action="new_topic"
                      onRunAction={onRunAction}
                    />
                    {contextMenu.surface === "timeline" ? (
                      <ContextMenuItem
                        label={t("timeline.open_schedule")}
                        action="set_schedule"
                        onRunAction={onRunAction}
                        disabled={!selectedOrContextNodeId}
                      />
                    ) : null}
                    {showStructureLockAction ? (
                      <ContextMenuItem
                        label={structureLockLabel}
                        action={contextMenuNodeStructureLocked ? "unlock_structure" : "lock_structure"}
                        onRunAction={onRunAction}
                      />
                    ) : null}
                    {showAccessPolicyAction ? (
                      <ContextMenuItem
                        label={t("context.access_policy")}
                        action="edit_access_policy"
                        onRunAction={onRunAction}
                      />
                    ) : null}
                    <div className="ode-context-separator" />
                    {contextMenu.surface === "tree" ? (
                      <>
                        <ContextMenuItem
                          label={t("context.move_in")}
                          action="move_in"
                          onRunAction={onRunAction}
                          disabled={!canMoveNodeIn}
                        />
                        <ContextMenuItem
                          label={t("context.move_out")}
                          action="move_out"
                          onRunAction={onRunAction}
                          disabled={!canMoveNodeOut}
                        />
                        <div className="ode-context-separator" />
                      </>
                    ) : null}
                    <ContextMenuItem
                      label={t("context.copy")}
                      action="copy"
                      onRunAction={onRunAction}
                      shortcutLabel="Ctrl+C"
                    />
                    <ContextMenuItem
                      label={t("context.cut")}
                      action="cut"
                      onRunAction={onRunAction}
                      disabled={contextNodeIsWorkspaceRoot}
                      shortcutLabel="Ctrl+X"
                    />
                    <ContextMenuItem
                      label={t("context.paste")}
                      action="paste"
                      onRunAction={onRunAction}
                      disabled={!canPasteBranch}
                      shortcutLabel="Ctrl+V"
                    />
                    <ContextMenuItem
                      label={t("context.duplicate")}
                      action="duplicate"
                      onRunAction={onRunAction}
                      shortcutLabel="Ctrl+D"
                    />
                    <div className="ode-context-separator" />
                    <ContextMenuItem
                      label={workareaRemoveLabel}
                      action="delete"
                      onRunAction={onRunAction}
                      danger
                      shortcutLabel="Del"
                    />
                  </>
                ) : null}
              </>
            )}
          </>
        ) : (
          <>
            {contextMenu.surface === "timeline" && contextMenuNodeIsExecutionTask ? (
              <>
                <ContextMenuItem
                  autoFocus
                  label={t("timeline.new_task_above")}
                  action="new_task_above"
                  onRunAction={onRunAction}
                />
                <ContextMenuItem
                  label={t("timeline.new_task_below")}
                  action="new_task_below"
                  onRunAction={onRunAction}
                />
                <ContextMenuItem
                  label={t("timeline.move_task_up")}
                  action="move_task_up"
                  onRunAction={onRunAction}
                />
                <ContextMenuItem
                  label={t("timeline.move_task_down")}
                  action="move_task_down"
                  onRunAction={onRunAction}
                />
                <div className="ode-context-separator" />
              </>
            ) : !contextMenuNodeIsFile ? (
              <ContextMenuItem
                autoFocus
                label={t("context.new_topic")}
                action="new_topic"
                onRunAction={onRunAction}
              />
            ) : null}
            {contextMenu.surface === "timeline" && !contextMenuNodeIsFile ? (
              <>
                <ContextMenuItem
                  label={t("timeline.open_schedule")}
                  action="set_schedule"
                  onRunAction={onRunAction}
                  disabled={!selectedOrContextNodeId}
                />
                <div className="ode-context-separator" />
              </>
            ) : null}
            {showStructureLockAction ? (
              <>
                {showStructureLockAction ? (
                  <ContextMenuItem
                    label={structureLockLabel}
                    action={contextMenuNodeStructureLocked ? "unlock_structure" : "lock_structure"}
                    onRunAction={onRunAction}
                  />
                ) : null}
                <div className="ode-context-separator" />
              </>
            ) : null}
            {!contextMenuNodeIsFile && !contextMenuNodeWorkareaKind ? (
              <>
                {contextMenuNodeCanOpenWorkarea ? (
                  <ContextMenuItem
                    label={t("context.open_workarea")}
                    action="open_workarea"
                    onRunAction={onRunAction}
                  />
                ) : null}
                {contextMenuNodeCanOpenWorkarea ? <div className="ode-context-separator" /> : null}
              </>
            ) : null}
            {contextMenuNodeIsFile ? (
              <>
                <ContextMenuItem
                  autoFocus
                  label={t("context.open")}
                  action="open"
                  onRunAction={onRunAction}
                />
                <ContextMenuItem
                  label={t("context.open_with")}
                  action="open_with"
                  onRunAction={onRunAction}
                />
                <ContextMenuItem
                  label={t("context.open_location")}
                  action="open_file_location"
                  onRunAction={onRunAction}
                  disabled={!contextMenuNodeFilePath}
                />
                <ContextMenuItem
                  label={t("context.copy_full_path")}
                  action="copy_full_path"
                  onRunAction={onRunAction}
                  disabled={!contextMenuNodeFilePath}
                />
                <div className="ode-context-separator" />
              </>
            ) : null}
            {contextMenu.surface === "tree" ? (
              <>
                <ContextMenuItem
                  label={t("context.move_in")}
                  action="move_in"
                  onRunAction={onRunAction}
                  disabled={!canMoveNodeIn}
                />
                <ContextMenuItem
                  label={t("context.move_out")}
                  action="move_out"
                  onRunAction={onRunAction}
                  disabled={!canMoveNodeOut}
                />
                <div className="ode-context-separator" />
              </>
            ) : null}
            <ContextMenuItem
              label={t("context.copy")}
              action="copy"
              onRunAction={onRunAction}
              shortcutLabel="Ctrl+C"
            />
            <ContextMenuItem
              label={t("context.cut")}
              action="cut"
              onRunAction={onRunAction}
              disabled={contextNodeIsWorkspaceRoot}
              shortcutLabel="Ctrl+X"
            />
            <ContextMenuItem
              label={t("context.paste")}
              action="paste"
              onRunAction={onRunAction}
              disabled={!canPasteBranch}
              shortcutLabel="Ctrl+V"
            />
            <ContextMenuItem
              label={t("context.duplicate")}
              action="duplicate"
              onRunAction={onRunAction}
              shortcutLabel="Ctrl+D"
            />
            {canSaveAsDatabaseTemplate ? <div className="ode-context-separator" /> : null}
            {canSaveAsDatabaseTemplate ? (
              <ContextMenuItem
                label={t("context.save_as_database_template")}
                action="save_as_database_template"
                onRunAction={onRunAction}
              />
            ) : null}
            <div className="ode-context-separator" />
            {contextMenu.surface !== "timeline" ? (
              <ContextMenuItem
                label={t("context.assign_favorite_group")}
                action="assign_favorite_group"
                onRunAction={onRunAction}
                shortcutLabel="Ctrl+Shift+G"
              />
            ) : null}
            <ContextMenuItem
              label={t("context.move_to_workspace")}
              action="move_to_workspace"
              onRunAction={onRunAction}
              disabled={!contextMenu.nodeId || projectsCount === 0 || workspaceRootIdSet.has(contextMenu.nodeId)}
              shortcutLabel="Ctrl+Shift+M"
            />
            {canDistributeToNAWorkspace ? (
              <ContextMenuItem
                label={t("context.distribute_to_na_workspace")}
                action="distribute_to_na_workspace"
                onRunAction={onRunAction}
              />
            ) : null}
            <div className="ode-context-separator" />
            <ContextMenuItem
              label={contextMenuNodeWorkareaKind ? workareaRemoveLabel : t("context.delete")}
              action="delete"
              onRunAction={onRunAction}
              danger
              shortcutLabel="Del"
            />
          </>
        )
      ) : (
        contextMenuIsWorkarea ? (
          <>
            <ContextMenuItem
              autoFocus
              label={t("context.add")}
              action="new_topic"
              onRunAction={onRunAction}
            />
            <ContextMenuItem
              label={t("context.paste")}
              action="paste"
              onRunAction={onRunAction}
              disabled={!canPasteBranch}
              shortcutLabel="Ctrl+V"
            />
          </>
        ) : (
          <>
            {contextMenu.surface === "tree" || contextMenu.surface === "grid" || contextMenu.surface === "timeline" ? (
              <ContextMenuItem
                autoFocus
                label={t("context.new_topic")}
                action="new_topic"
                onRunAction={onRunAction}
              />
            ) : null}
            <ContextMenuItem
              label={t("context.paste")}
              action="paste"
              onRunAction={onRunAction}
              disabled={!canPasteBranch}
              shortcutLabel="Ctrl+V"
            />
          </>
        )
      )}
      </div>
    </>
  );
}
