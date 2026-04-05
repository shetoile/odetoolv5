import { useEffect, type Dispatch, type SetStateAction } from "react";
import {
  isTimelineKeyboardSurfaceActive,
  resolveGridNavigationColumnCount,
  resolveSelectionSurfaceForKeyboardSurface,
  type MindMapOrientation
} from "@/features/workspace/keyboard";
import type { KeyboardSurface } from "@/features/workspace/selection";
import type { DesktopViewMode, SelectionSurface, WorkspaceMode } from "@/features/workspace/viewMode";
import { ROOT_PARENT_ID, type AppNode } from "@/lib/types";

type TreeRow = {
  id: string;
  node: AppNode;
};

type UseKeyboardShortcutsParams = {
  hasBlockingOverlayOpen: boolean;
  contextMenuOpen: boolean;
  editingNodeId: string | null;
  branchClipboardPresent: boolean;
  selectedNodeId: string | null;
  currentFolderId: string | null;
  displayedTreeRows: TreeRow[];
  displayedTreeIndexById: Map<string, number>;
  timelineRows: TreeRow[];
  displayedTimelineIndexById: Map<string, number>;
  displayedGridIndexById: Map<string, number>;
  gridNodes: AppNode[];
  nodeById: Map<string, AppNode>;
  byParent: Map<string, AppNode[]>;
  selectedNodeIds: Set<string>;
  selectionAnchorId: string | null;
  selectionSurface: SelectionSurface;
  keyboardSurface: KeyboardSurface;
  expandedIds: Set<string>;
  workspaceMode: WorkspaceMode;
  desktopViewMode: DesktopViewMode;
  mindMapOrientation: MindMapOrientation;
  favoriteGroups: Array<{ id: string; name: string }>;
  favoriteGroupFilteringActive: boolean;
  onSetBranchClipboardEmpty: () => void;
  onSetSelectedNodeId: (nodeId: string | null) => void;
  onSetSelectedNodeIds: Dispatch<SetStateAction<Set<string>>>;
  onSetSelectionAnchorId: Dispatch<SetStateAction<string | null>>;
  onSetSelectionSurface: Dispatch<SetStateAction<SelectionSurface>>;
  onSetExpandedIds: Dispatch<SetStateAction<Set<string>>>;
  onSetPrimarySelection: (nodeId: string | null, surface?: SelectionSurface) => void;
  onCopySelectedBranch: (mode: "copy" | "cut", sourceNodeId?: string) => Promise<void>;
  onPasteClipboardBranch: (targetNodeId?: string | null, surface?: SelectionSurface) => Promise<void>;
  onDuplicateSelectedBranch: (sourceNodeId?: string, surface?: SelectionSurface) => Promise<void>;
  onNavigateUpOneFolder: (surface?: SelectionSurface) => Promise<void>;
  onBrowseTreeNode: (id: string) => Promise<void> | void;
  onOpenLibraryItem: (id: string) => Promise<void> | void;
  onBeginInlineEdit: (nodeId: string, initialText?: string, preferredSurface?: SelectionSurface) => void;
  onCreateNodeWithoutSelection: (initialText?: string) => Promise<void>;
  onCreateChildNode: (nodeId: string) => Promise<void>;
  onCreateProcedureSectionNode: (nodeId: string) => Promise<void>;
  onCreateProcedureFieldNode: (nodeId: string | null) => Promise<void>;
  onCreateParentNode: (nodeId: string) => Promise<void>;
  onCreateSiblingNode: (nodeId: string, insertBefore: boolean) => Promise<void>;
  onMoveTimelineTaskUp: (nodeId: string) => Promise<void>;
  onMoveTimelineTaskDown: (nodeId: string) => Promise<void>;
  onMoveNodeIn: (nodeId: string, surface?: SelectionSurface) => Promise<void>;
  onMoveNodeOut: (nodeId: string, surface?: SelectionSurface) => Promise<void>;
  onRemoveSelectedNodes: (options?: { confirm?: boolean }) => Promise<void>;
  onMoveToWorkspace: (sourceNodeId?: string | null) => void;
  onToggleFavoriteNode: (sourceNodeId: string) => Promise<void>;
  onOpenFavoriteGroupAssign: (sourceNodeId: string) => Promise<void>;
  onToggleFavoriteGroup: (sourceNodeId: string, groupId: string) => Promise<void>;
};

export function useKeyboardShortcuts({
  hasBlockingOverlayOpen,
  contextMenuOpen,
  editingNodeId,
  branchClipboardPresent,
  selectedNodeId,
  currentFolderId,
  displayedTreeRows,
  displayedTreeIndexById,
  timelineRows,
  displayedTimelineIndexById,
  displayedGridIndexById,
  gridNodes,
  nodeById,
  byParent,
  selectedNodeIds,
  selectionAnchorId,
  selectionSurface,
  keyboardSurface,
  expandedIds,
  workspaceMode,
  desktopViewMode,
  mindMapOrientation,
  favoriteGroups,
  favoriteGroupFilteringActive,
  onSetBranchClipboardEmpty,
  onSetSelectedNodeId,
  onSetSelectedNodeIds,
  onSetSelectionAnchorId,
  onSetSelectionSurface,
  onSetExpandedIds,
  onSetPrimarySelection,
  onCopySelectedBranch,
  onPasteClipboardBranch,
  onDuplicateSelectedBranch,
  onNavigateUpOneFolder,
  onBrowseTreeNode,
  onOpenLibraryItem,
  onBeginInlineEdit,
  onCreateNodeWithoutSelection,
  onCreateChildNode,
  onCreateProcedureSectionNode,
  onCreateProcedureFieldNode,
  onCreateParentNode,
  onCreateSiblingNode,
  onMoveTimelineTaskUp,
  onMoveTimelineTaskDown,
  onMoveNodeIn,
  onMoveNodeOut,
  onRemoveSelectedNodes,
  onMoveToWorkspace,
  onToggleFavoriteNode,
  onOpenFavoriteGroupAssign,
  onToggleFavoriteGroup
}: UseKeyboardShortcutsParams) {
  useEffect(() => {
    const shouldIgnoreGlobalShortcutsTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.closest("[data-ode-ignore-shortcuts='true']")) return true;
      if (target.isContentEditable || target.closest("[contenteditable='true']")) return true;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (hasBlockingOverlayOpen || contextMenuOpen) return;
      if (event.defaultPrevented) return;
      if (
        shouldIgnoreGlobalShortcutsTarget(event.target) ||
        shouldIgnoreGlobalShortcutsTarget(document.activeElement)
      ) {
        return;
      }
      if (editingNodeId && shouldIgnoreGlobalShortcutsTarget(document.activeElement)) return;

      if (event.key === "Escape") {
        if (branchClipboardPresent) {
          event.preventDefault();
          onSetBranchClipboardEmpty();
        }
        return;
      }

      const activeSelectionSurface: SelectionSurface =
        desktopViewMode === "library"
          ? "tree"
          : resolveSelectionSurfaceForKeyboardSurface(
              keyboardSurface,
              selectionSurface
            );
      const selectedId =
        (selectedNodeId && nodeById.has(selectedNodeId) ? selectedNodeId : null) ??
        Array.from(selectedNodeIds).find((id) => nodeById.has(id)) ??
        null;
      const isPrintable =
        event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
      const keyLower = event.key.toLowerCase();
      const hasModifier = event.ctrlKey || event.metaKey;
      const timelineActive = isTimelineKeyboardSurfaceActive({
        workspaceMode,
        selectionSurface: activeSelectionSurface
      });
      const linearRows = timelineActive ? timelineRows : displayedTreeRows;
      const linearSurface: SelectionSurface = timelineActive ? "timeline" : "tree";
      const selectedLinearIndex =
        selectedId !== null
          ? timelineActive
            ? (displayedTimelineIndexById.get(selectedId) ?? -1)
            : (displayedTreeIndexById.get(selectedId) ?? -1)
          : -1;
      const selectedLinearRow = selectedLinearIndex >= 0 ? linearRows[selectedLinearIndex] : null;
      const selectedTreeNode = selectedLinearRow?.node ?? (selectedId ? nodeById.get(selectedId) ?? null : null);
      const selectedProcedureField =
        desktopViewMode === "procedure" &&
        Boolean(
          selectedTreeNode &&
            (selectedTreeNode.properties?.odeProcedureItemType === "field" ||
              (typeof selectedTreeNode.properties?.odeProcedureFieldType === "string" &&
                selectedTreeNode.properties.odeProcedureFieldType.trim().length > 0))
        );
      const selectedTreeIndex =
        selectedId !== null ? (displayedTreeIndexById.get(selectedId) ?? -1) : -1;
      const selectedGridIndex =
        selectedId !== null ? (displayedGridIndexById.get(selectedId) ?? -1) : -1;
      const favoriteGroupShortcutIndex =
        event.altKey &&
        event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        event.code.startsWith("Digit")
          ? Number.parseInt(event.code.slice("Digit".length), 10) - 1
          : -1;
      const moveFocusOnly = (nodeId: string, surface: SelectionSurface) => {
        onSetSelectedNodeId(nodeId);
        onSetSelectionSurface(surface);
      };
      const resolveInlineRenameSurface = (): SelectionSurface => {
        if (!selectedId) return activeSelectionSurface;
        if (selectionSurface === "tree" && displayedTreeIndexById.has(selectedId)) return "tree";
        if (selectionSurface === "timeline" && displayedTimelineIndexById.has(selectedId)) return "timeline";
        if (selectionSurface === "grid" && displayedGridIndexById.has(selectedId)) return "grid";
        if (displayedTreeIndexById.has(selectedId)) return "tree";
        if (workspaceMode === "timeline" && displayedTimelineIndexById.has(selectedId)) return "timeline";
        if (displayedGridIndexById.has(selectedId)) return "grid";
        return activeSelectionSurface;
      };
      const syncTreeBrowseSelection = (nodeId: string) => {
        if (linearSurface !== "tree" || workspaceMode === "timeline") return;
        void onBrowseTreeNode(nodeId);
      };

      const moveLinearSelectionBy = (
        delta: number,
        options?: { extendRange?: boolean; focusOnly?: boolean }
      ) => {
        const extendRange = options?.extendRange ?? false;
        const focusOnly = options?.focusOnly ?? false;
        if (linearRows.length === 0) return;
        const start = selectedLinearIndex >= 0 ? selectedLinearIndex : 0;
        const nextIndex = Math.min(linearRows.length - 1, Math.max(0, start + delta));
        const nextId = linearRows[nextIndex].id;

        if (focusOnly) {
          moveFocusOnly(nextId, linearSurface);
          return;
        }

        if (extendRange) {
          const anchorId = selectionAnchorId ?? selectedId ?? linearRows[start].id;
          const anchorIndex =
            linearSurface === "timeline"
              ? (displayedTimelineIndexById.get(anchorId) ?? -1)
              : (displayedTreeIndexById.get(anchorId) ?? -1);
          if (anchorIndex >= 0) {
            const [rangeStart, rangeEnd] =
              anchorIndex <= nextIndex ? [anchorIndex, nextIndex] : [nextIndex, anchorIndex];
            const ids = new Set(linearRows.slice(rangeStart, rangeEnd + 1).map((row) => row.id));
            onSetSelectedNodeId(nextId);
            onSetSelectedNodeIds(ids);
            onSetSelectionAnchorId(anchorId);
            onSetSelectionSurface(linearSurface);
            return;
          }
        }

        onSetPrimarySelection(nextId, linearSurface);
        syncTreeBrowseSelection(nextId);
      };

      if (hasModifier) {
        if (keyLower === "c" && selectedId) {
          event.preventDefault();
          void onCopySelectedBranch("copy");
          return;
        }
        if (keyLower === "x" && selectedId) {
          event.preventDefault();
          void onCopySelectedBranch("cut");
          return;
        }
        if (keyLower === "d" && selectedId) {
          event.preventDefault();
          void onDuplicateSelectedBranch(undefined, activeSelectionSurface);
          return;
        }
        if (keyLower === "f" && event.shiftKey && selectedId) {
          event.preventDefault();
          void onToggleFavoriteNode(selectedId);
          return;
        }
        if (keyLower === "g" && event.shiftKey && selectedId) {
          event.preventDefault();
          void onOpenFavoriteGroupAssign(selectedId);
          return;
        }
        if (keyLower === "m" && event.shiftKey && selectedId) {
          event.preventDefault();
          onMoveToWorkspace(selectedId);
          return;
        }
        if (keyLower === "v") {
          event.preventDefault();
          void onPasteClipboardBranch(selectedId ?? undefined, activeSelectionSurface);
          return;
        }
        if (keyLower === "a") {
          if (activeSelectionSurface === "timeline" && workspaceMode === "timeline" && timelineRows.length > 0) {
            event.preventDefault();
            const allIds = new Set(timelineRows.map((row) => row.id));
            const activeId = selectedId ?? timelineRows[0].id;
            onSetSelectedNodeId(activeId);
            onSetSelectedNodeIds(allIds);
            onSetSelectionAnchorId(activeId);
            onSetSelectionSurface("timeline");
            return;
          }
          if (activeSelectionSurface === "tree" && displayedTreeRows.length > 0) {
            event.preventDefault();
            const allIds = new Set(displayedTreeRows.map((row) => row.id));
            const activeId = selectedId ?? displayedTreeRows[0].id;
            onSetSelectedNodeId(activeId);
            onSetSelectedNodeIds(allIds);
            onSetSelectionAnchorId(activeId);
            onSetSelectionSurface("tree");
            return;
          }
          if (activeSelectionSurface === "grid" && workspaceMode === "grid" && gridNodes.length > 0) {
            event.preventDefault();
            const allIds = new Set(gridNodes.map((node) => node.id));
            const activeId = selectedId ?? gridNodes[0].id;
            onSetSelectedNodeId(activeId);
            onSetSelectedNodeIds(allIds);
            onSetSelectionAnchorId(activeId);
            onSetSelectionSurface("grid");
            return;
          }
        }
        if ((event.key === " " || event.code === "Space") && selectedId) {
          event.preventDefault();
          const next = new Set(selectedNodeIds);
          if (next.has(selectedId)) next.delete(selectedId);
          else next.add(selectedId);
          onSetSelectedNodeId(selectedId);
          onSetSelectedNodeIds(next);
          onSetSelectionSurface(activeSelectionSurface);
          onSetSelectionAnchorId((prev) => prev ?? selectedId);
          return;
        }
      }

      if (selectedId && favoriteGroupShortcutIndex >= 0 && favoriteGroupShortcutIndex < favoriteGroups.length) {
        event.preventDefault();
        void onToggleFavoriteGroup(selectedId, favoriteGroups[favoriteGroupShortcutIndex].id);
        return;
      }

      if (
        timelineActive &&
        selectedId &&
        event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        event.key === "ArrowUp"
      ) {
        event.preventDefault();
        void onMoveTimelineTaskUp(selectedId);
        return;
      }

      if (
        timelineActive &&
        selectedId &&
        event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        event.key === "ArrowDown"
      ) {
        event.preventDefault();
        void onMoveTimelineTaskDown(selectedId);
        return;
      }

      const shouldNavigateUp =
        event.key === "Backspace" ||
        (event.altKey && event.key === "ArrowUp") ||
        event.key === "BrowserBack";

      if (shouldNavigateUp) {
        event.preventDefault();
        void onNavigateUpOneFolder(activeSelectionSurface);
        return;
      }

      if (
        (activeSelectionSurface === "tree" || activeSelectionSurface === "grid") &&
        selectedId &&
        event.altKey &&
        event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        event.key === "ArrowRight"
      ) {
        event.preventDefault();
        void onMoveNodeIn(selectedId, activeSelectionSurface);
        return;
      }

      if (
        (activeSelectionSurface === "tree" || activeSelectionSurface === "grid") &&
        selectedId &&
        event.altKey &&
        event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        event.key === "ArrowLeft"
      ) {
        event.preventDefault();
        void onMoveNodeOut(selectedId, activeSelectionSurface);
        return;
      }

      if (workspaceMode === "grid" && activeSelectionSurface === "grid" && gridNodes.length > 0) {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          const columns = resolveGridNavigationColumnCount({
            desktopViewMode,
            mindMapOrientation,
            viewportWidth: window.innerWidth
          });
          const startIndex = selectedGridIndex >= 0 ? selectedGridIndex : 0;
          let nextIndex = startIndex;

          if (event.key === "ArrowLeft") nextIndex = Math.max(0, startIndex - 1);
          if (event.key === "ArrowRight") nextIndex = Math.min(gridNodes.length - 1, startIndex + 1);
          if (event.key === "ArrowUp") nextIndex = Math.max(0, startIndex - columns);
          if (event.key === "ArrowDown") nextIndex = Math.min(gridNodes.length - 1, startIndex + columns);

          const nextId = gridNodes[nextIndex].id;
          if (hasModifier && !event.shiftKey) {
            moveFocusOnly(nextId, "grid");
            return;
          }
          if (event.shiftKey) {
            const anchorId = selectionAnchorId ?? selectedId ?? gridNodes[startIndex].id;
            const anchorIndex = displayedGridIndexById.get(anchorId);
            if (anchorIndex !== undefined) {
              const [rangeStart, rangeEnd] =
                anchorIndex <= nextIndex ? [anchorIndex, nextIndex] : [nextIndex, anchorIndex];
              const ids = new Set(gridNodes.slice(rangeStart, rangeEnd + 1).map((node) => node.id));
              onSetSelectedNodeId(nextId);
              onSetSelectedNodeIds(ids);
              onSetSelectionAnchorId(anchorId);
              onSetSelectionSurface("grid");
              return;
            }
          }
          onSetPrimarySelection(nextId, "grid");
          return;
        }

        if (event.key === "Home") {
          event.preventDefault();
          const nextId = gridNodes[0]?.id;
          if (!nextId) return;
          if (hasModifier && !event.shiftKey) {
            moveFocusOnly(nextId, "grid");
            return;
          }
          if (event.shiftKey) {
            const anchorId = selectionAnchorId ?? selectedId ?? nextId;
            const anchorIndex = displayedGridIndexById.get(anchorId) ?? 0;
            const [rangeStart, rangeEnd] = anchorIndex <= 0 ? [anchorIndex, 0] : [0, anchorIndex];
            onSetSelectedNodeId(nextId);
            onSetSelectedNodeIds(new Set(gridNodes.slice(rangeStart, rangeEnd + 1).map((node) => node.id)));
            onSetSelectionAnchorId(anchorId);
            onSetSelectionSurface("grid");
            return;
          }
          onSetPrimarySelection(nextId, "grid");
          return;
        }

        if (event.key === "End") {
          event.preventDefault();
          const endIndex = gridNodes.length - 1;
          const nextId = gridNodes[endIndex]?.id;
          if (!nextId) return;
          if (hasModifier && !event.shiftKey) {
            moveFocusOnly(nextId, "grid");
            return;
          }
          if (event.shiftKey) {
            const anchorId = selectionAnchorId ?? selectedId ?? nextId;
            const anchorIndex = displayedGridIndexById.get(anchorId) ?? endIndex;
            const [rangeStart, rangeEnd] =
              anchorIndex <= endIndex ? [anchorIndex, endIndex] : [endIndex, anchorIndex];
            onSetSelectedNodeId(nextId);
            onSetSelectedNodeIds(new Set(gridNodes.slice(rangeStart, rangeEnd + 1).map((node) => node.id)));
            onSetSelectionAnchorId(anchorId);
            onSetSelectionSurface("grid");
            return;
          }
          onSetPrimarySelection(nextId, "grid");
          return;
        }

      }

      if (event.key === "Home") {
        if (linearRows.length > 0) {
          event.preventDefault();
          const nextId = linearRows[0].id;
          if (hasModifier && !event.shiftKey) {
            moveFocusOnly(nextId, linearSurface);
            return;
          }
          if (event.shiftKey && selectedId) {
            const anchorId = selectionAnchorId ?? selectedId ?? nextId;
            const anchorIndex =
              linearSurface === "timeline"
                ? (displayedTimelineIndexById.get(anchorId) ?? 0)
                : (displayedTreeIndexById.get(anchorId) ?? 0);
            const [rangeStart, rangeEnd] = anchorIndex <= 0 ? [anchorIndex, 0] : [0, anchorIndex];
            onSetSelectedNodeId(nextId);
            onSetSelectedNodeIds(new Set(linearRows.slice(rangeStart, rangeEnd + 1).map((row) => row.id)));
            onSetSelectionAnchorId(anchorId);
            onSetSelectionSurface(linearSurface);
          } else {
            onSetPrimarySelection(nextId, linearSurface);
            syncTreeBrowseSelection(nextId);
          }
        }
        return;
      }

      if (event.key === "End") {
        if (linearRows.length > 0) {
          event.preventDefault();
          const nextIndex = linearRows.length - 1;
          const nextId = linearRows[nextIndex].id;
          if (hasModifier && !event.shiftKey) {
            moveFocusOnly(nextId, linearSurface);
            return;
          }
          if (event.shiftKey && selectedId) {
            const anchorId = selectionAnchorId ?? selectedId ?? nextId;
            const anchorIndex =
              linearSurface === "timeline"
                ? (displayedTimelineIndexById.get(anchorId) ?? nextIndex)
                : (displayedTreeIndexById.get(anchorId) ?? nextIndex);
            const [rangeStart, rangeEnd] =
              anchorIndex <= nextIndex ? [anchorIndex, nextIndex] : [nextIndex, anchorIndex];
            onSetSelectedNodeId(nextId);
            onSetSelectedNodeIds(new Set(linearRows.slice(rangeStart, rangeEnd + 1).map((row) => row.id)));
            onSetSelectionAnchorId(anchorId);
            onSetSelectionSurface(linearSurface);
          } else {
            onSetPrimarySelection(nextId, linearSurface);
            syncTreeBrowseSelection(nextId);
          }
        }
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveLinearSelectionBy(-1, {
          extendRange: event.shiftKey,
          focusOnly: hasModifier && !event.shiftKey
        });
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveLinearSelectionBy(1, {
          extendRange: event.shiftKey,
          focusOnly: hasModifier && !event.shiftKey
        });
        return;
      }

      if (event.key === "ArrowRight" && selectedId) {
        event.preventDefault();
        const selected = selectedLinearRow?.node ?? nodeById.get(selectedId);
        if (!selected) return;
        const children = byParent.get(selected.id) ?? [];
        if (children.length === 0) return;

        if (!expandedIds.has(selected.id)) {
          onSetExpandedIds((prev) => {
            const next = new Set(prev);
            next.add(selected.id);
            return next;
          });
        } else {
          const nextChild =
            linearSurface === "timeline"
              ? children.find((child) => displayedTimelineIndexById.has(child.id))
              : children[0];
          if (nextChild) {
            onSetPrimarySelection(nextChild.id, linearSurface);
            syncTreeBrowseSelection(nextChild.id);
          }
        }
        return;
      }

      if (event.key === "ArrowLeft" && selectedId) {
        event.preventDefault();
        const selected = selectedLinearRow?.node ?? nodeById.get(selectedId);
        if (!selected) return;
        const children = byParent.get(selected.id) ?? [];
        if (children.length > 0 && expandedIds.has(selected.id)) {
          onSetExpandedIds((prev) => {
            const next = new Set(prev);
            next.delete(selected.id);
            return next;
          });
          return;
        }

        if (selected.parentId !== ROOT_PARENT_ID) {
          onSetPrimarySelection(selected.parentId, linearSurface);
          syncTreeBrowseSelection(selected.parentId);
        }
        return;
      }

      if (event.key === "F1" && desktopViewMode === "procedure") {
        event.preventDefault();
        void onCreateProcedureFieldNode(selectedId);
        return;
      }

      if (!selectedId) {
        if (favoriteGroupFilteringActive && (event.key === "Enter" || event.key === "Tab" || isPrintable)) {
          event.preventDefault();
          return;
        }
        if (event.key === "Enter" || event.key === "Tab" || isPrintable) {
          event.preventDefault();
          void onCreateNodeWithoutSelection(isPrintable ? event.key : undefined);
        }
        return;
      }

      if (favoriteGroupFilteringActive && (event.key === "Tab" || event.key === "Enter" || isPrintable)) {
        event.preventDefault();
        return;
      }

      if (desktopViewMode === "library" && activeSelectionSurface === "tree") {
        if (event.key === "Enter" && selectedId) {
          event.preventDefault();
          void onOpenLibraryItem(selectedId);
          return;
        }
        if (event.key === "Tab") {
          event.preventDefault();
          return;
        }
      }

      if (event.key === "Tab") {
        event.preventDefault();
        void onCreateChildNode(selectedId);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (event.ctrlKey || event.metaKey) {
          void onCreateParentNode(selectedId);
        } else if (event.shiftKey) {
          void onCreateSiblingNode(selectedId, true);
        } else if (desktopViewMode === "procedure") {
          if (selectedProcedureField) {
            void onCreateChildNode(selectedId);
          } else {
            void onCreateProcedureSectionNode(selectedId);
          }
        } else {
          void onCreateSiblingNode(selectedId, false);
        }
        return;
      }

      if (event.key === "F2") {
        event.preventDefault();
        onBeginInlineEdit(selectedId, undefined, resolveInlineRenameSurface());
        return;
      }

      if (event.key === "Delete") {
        event.preventDefault();
        void onRemoveSelectedNodes({ confirm: !event.shiftKey });
        return;
      }

      if (isPrintable) {
        event.preventDefault();
        onBeginInlineEdit(selectedId, event.key, resolveInlineRenameSurface());
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    editingNodeId,
    hasBlockingOverlayOpen,
    contextMenuOpen,
    selectedNodeId,
    currentFolderId,
    byParent,
    branchClipboardPresent,
    displayedTreeRows,
    displayedTreeIndexById,
    timelineRows,
    displayedTimelineIndexById,
    displayedGridIndexById,
    expandedIds,
    gridNodes,
    nodeById,
    onBrowseTreeNode,
    onOpenLibraryItem,
    onRemoveSelectedNodes,
    selectedNodeIds,
    selectionAnchorId,
    selectionSurface,
    keyboardSurface,
    desktopViewMode,
    mindMapOrientation,
    workspaceMode,
    favoriteGroups,
    favoriteGroupFilteringActive,
    onSetBranchClipboardEmpty,
    onSetSelectedNodeId,
    onSetSelectedNodeIds,
    onSetSelectionAnchorId,
    onSetSelectionSurface,
    onSetExpandedIds,
    onSetPrimarySelection,
    onCopySelectedBranch,
    onPasteClipboardBranch,
    onDuplicateSelectedBranch,
    onNavigateUpOneFolder,
    onBeginInlineEdit,
    onCreateNodeWithoutSelection,
    onCreateChildNode,
    onCreateProcedureSectionNode,
    onCreateProcedureFieldNode,
    onCreateParentNode,
    onCreateSiblingNode,
    onMoveTimelineTaskUp,
    onMoveTimelineTaskDown,
    onMoveNodeIn,
    onMoveNodeOut,
    onMoveToWorkspace,
    onToggleFavoriteNode,
    onOpenFavoriteGroupAssign,
    onToggleFavoriteGroup
  ]);
}
