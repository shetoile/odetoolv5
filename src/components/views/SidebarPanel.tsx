import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type ReactNode,
  type RefObject
} from "react";
import {
  CollapseAllGlyphSmall,
  EditGlyphSmall,
  ExpandAllGlyphSmall,
  FolderGlyph,
  InfoGlyphSmall,
  LockGlyphSmall,
  NodeGlyph,
  QuickAccessGlyphSmall,
  SearchGlyph,
  SidebarMenuGlyphSmall,
  TrashGlyphSmall,
} from "@/components/Icons";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import { getLocaleForLanguage, type LanguageCode, type TranslationParams } from "@/lib/i18n";
import { getNodeDisplayName } from "@/lib/nodeDisplay";
import { getNodeTooltipLabel } from "@/lib/nodeTooltipCatalog";
import { isNodeStructureLockOwner } from "@/features/workspace/structureLock";
import { ROOT_PARENT_ID, isFileLikeNode, type AppNode, type FolderNodeState } from "@/lib/types";

type TranslateFn = (key: string, params?: TranslationParams) => string;
type SelectionSurface = "tree" | "grid" | "timeline";
type DropPosition = "before" | "inside" | "after";

type TreeRow = {
  id: string;
  node: AppNode;
  level: number;
  indexLabel: string;
  hasChildren: boolean;
};

type FavoriteGroupOption = {
  id: string;
  name: string;
};

type SearchResultItem = {
  id: string;
  node: AppNode;
  pathLabel: string;
};

type DropIndicator = { targetId: string; position: DropPosition } | null;
const TREE_VIRTUAL_ROW_HEIGHT = 54;
const TREE_VIRTUAL_OVERSCAN = 10;
const TREE_VIRTUALIZE_MIN_ROWS = 180;
const FAVORITE_GROUP_DRAG_MIME = "application/x-odetool-favorite-group-id";
const SIDEBAR_SURFACE_PANEL_CLASS =
  "rounded-[24px] bg-[linear-gradient(180deg,rgba(4,24,39,0.92),rgba(3,18,30,0.98))]";
const TREE_ROW_LABEL_CLAMP_STYLE = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical" as const,
  WebkitLineClamp: 2,
  overflow: "hidden"
};

function resolveSidebarTreeIndent(level: number): number {
  if (level <= 0) return 12;
  if (level === 1) return 30;
  if (level === 2) return 48;
  if (level === 3) return 62;
  return 62 + (level - 3) * 8;
}

interface SidebarPanelProps {
  t: TranslateFn;
  language: LanguageCode;
  workspaceFocusMode: "structure" | "data" | "execution";
  documentationModeActive: boolean;
  libraryModeActive: boolean;
  quickAccessScopeLabel: string;
  isLargeLayout: boolean;
  isSidebarCollapsed: boolean;
  sidebarWidth: number;
  sidebarCollapsedWidth: number;
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  searchDropdownOpen: boolean;
  searchResults: SearchResultItem[];
  searchActiveIndex: number;
  displayedTreeRows: TreeRow[];
  treeSelectionRevealRequestKey?: number;
  selectedNodeId: string | null;
  selectedNodeIds: Set<string>;
  cutPendingNodeIds: Set<string>;
  draggingNodeId: string | null;
  dropIndicator: DropIndicator;
  scopedRootDropTargetId: string;
  activeProjectRootId: string | null;
  editingNodeId: string | null;
  editingSurface: SelectionSurface | null;
  editingValue: string;
  inlineEditInputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  expandedIds: Set<string>;
  folderNodeStateById: Map<string, FolderNodeState>;
  executionOwnerNodeIds: Set<string>;
  scopedNumbering: Map<string, string>;
  hideTreeNumbering: boolean;
  editActionInFlightRef: MutableRefObject<boolean>;
  isNodeProvisionalInlineCreate: (id: string) => boolean;
  workspaceManageCard?: ReactNode;
  favoriteGroups: FavoriteGroupOption[];
  activeFavoriteGroupId: string;
  selectedFavoriteGroupIds: string[];
  favoriteTreeFilterEnabled: boolean;
  nodeTooltipsEnabled: boolean;
  canQuickEditNodeDescription: boolean;
  quickEditNodeDescriptionTargetLabel: string | null;
  canExpandAllTreeNodes: boolean;
  canCollapseAllTreeNodes: boolean;
  showEmptyState: boolean;
  onSelectFavoriteGroup: (groupId: string, options?: { toggle?: boolean }) => void;
  onEditFavoriteGroup: (groupId: string) => void;
  onOpenFavoriteGroupAssign: () => void;
  onAssignNodesToFavoriteGroup: (groupId: string, sourceNodeId?: string | null) => void;
  onToggleFavoriteTreeFilter: () => void;
  onCreateFavoriteGroup: () => void;
  onDeleteFavoriteGroup: (groupId: string) => void;
  onToggleNodeTooltips: () => void;
  onQuickEditNodeDescription: () => void;
  onExpandAllTreeNodes: () => void;
  onCollapseAllTreeNodes: () => void;
  onSetIsSidebarCollapsed: (collapsed: boolean) => void;
  onExpandSidebarForSearch: () => void;
  onExpandSidebarPanel: () => void;
  onSearchDropdownOpenChange: (open: boolean) => void;
  onSearchActiveIndexChange: (index: number) => void;
  onSelectFromSearch: (id: string) => void;
  onRunSearch: () => void;
  onSearchQueryChange: (value: string) => void;
  onActivateTreeSurface: () => void;
  onOpenSurfaceContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  onHasExternalFileDrag: (event: DragEvent<HTMLElement>) => boolean;
  onResolveActiveDragSourceId: (event: DragEvent<HTMLElement>) => string | null;
  onResolveExternalDropPaths: (event: DragEvent<HTMLElement>) => string[];
  onSetDropIndicator: (indicator: DropIndicator) => void;
  onClearDraggingState: () => void;
  onImportExternalFilesToNode: (paths: string[], parentId: string | null, surface: SelectionSurface) => Promise<void> | void;
  onApplyDropMove: (sourceId: string, targetId: string, position: DropPosition, surface: SelectionSurface) => Promise<void> | void;
  onCloseContextMenu: () => void;
  onApplyTreeSelection: (id: string, options: { range: boolean; toggle: boolean }) => void;
  onBrowseTreeNode: (id: string) => Promise<void> | void;
  onOpenNodeContextMenu: (event: ReactMouseEvent<HTMLElement>, nodeId: string, surface: SelectionSurface) => void;
  onBeginNodeDrag: (event: DragEvent<HTMLElement>, nodeId: string, surface: SelectionSurface) => void;
  onDetectDropPosition: (event: DragEvent<HTMLElement>, targetNode?: AppNode) => DropPosition;
  onToggleExpand: (id: string) => void;
  onBeginInlineEdit: (id: string, initialText?: string, preferredSurface?: SelectionSurface) => void;
  onSetEditingValue: (value: string) => void;
  onOpenInlineEditContextMenu: (event: ReactMouseEvent<HTMLInputElement>) => void;
  onCommitInlineEdit: () => Promise<void> | void;
  onCancelInlineEdit: () => void;
  onDeleteNode: (id: string) => Promise<void> | void;
  onRefreshTreeAndKeepContext: (focusId?: string | null, ensureExpandedParentIds?: string[]) => Promise<void> | void;
  onSetPrimarySelection: (id: string | null, surface: SelectionSurface) => void;
  onCreateParentNode: (id: string) => Promise<void> | void;
  onCreateSiblingNode: (id: string, before: boolean) => Promise<void> | void;
  onCreateChildNode: (id: string) => Promise<void> | void;
  onCreateFirstNode: () => Promise<void> | void;
  onOpenNodeTab: (id: string, options?: { preserveTreeFocus?: boolean }) => Promise<void> | void;
  onReviewFile: (id: string) => void;
}

export function SidebarPanel({
  t,
  language,
  workspaceFocusMode,
  libraryModeActive,
  quickAccessScopeLabel,
  isLargeLayout,
  isSidebarCollapsed,
  sidebarWidth,
  sidebarCollapsedWidth,
  searchInputRef,
  searchQuery,
  searchDropdownOpen,
  searchResults,
  searchActiveIndex,
  displayedTreeRows,
  treeSelectionRevealRequestKey = 0,
  selectedNodeId,
  selectedNodeIds,
  cutPendingNodeIds,
  draggingNodeId,
  dropIndicator,
  scopedRootDropTargetId,
  activeProjectRootId,
  editingNodeId,
  editingSurface,
  editingValue,
  inlineEditInputRef,
  expandedIds,
  folderNodeStateById,
  executionOwnerNodeIds,
  scopedNumbering,
  hideTreeNumbering,
  editActionInFlightRef,
  isNodeProvisionalInlineCreate,
  workspaceManageCard,
  favoriteGroups,
  activeFavoriteGroupId,
  selectedFavoriteGroupIds,
  favoriteTreeFilterEnabled,
  nodeTooltipsEnabled,
  canQuickEditNodeDescription,
  quickEditNodeDescriptionTargetLabel,
  canExpandAllTreeNodes,
  canCollapseAllTreeNodes,
  showEmptyState,
  onSelectFavoriteGroup,
  onEditFavoriteGroup,
  onOpenFavoriteGroupAssign,
  onAssignNodesToFavoriteGroup,
  onToggleFavoriteTreeFilter,
  onCreateFavoriteGroup,
  onDeleteFavoriteGroup,
  onToggleNodeTooltips,
  onQuickEditNodeDescription,
  onExpandAllTreeNodes,
  onCollapseAllTreeNodes,
  onSetIsSidebarCollapsed,
  onExpandSidebarForSearch,
  onExpandSidebarPanel,
  onSearchDropdownOpenChange,
  onSearchActiveIndexChange,
  onSelectFromSearch,
  onRunSearch,
  onSearchQueryChange,
  onActivateTreeSurface,
  onOpenSurfaceContextMenu,
  onHasExternalFileDrag,
  onResolveActiveDragSourceId,
  onResolveExternalDropPaths,
  onSetDropIndicator,
  onClearDraggingState,
  onImportExternalFilesToNode,
  onApplyDropMove,
  onCloseContextMenu,
  onApplyTreeSelection,
  onBrowseTreeNode,
  onOpenNodeContextMenu,
  onBeginNodeDrag,
  onDetectDropPosition,
  onToggleExpand,
  onBeginInlineEdit,
  onSetEditingValue,
  onOpenInlineEditContextMenu,
  onCommitInlineEdit,
  onCancelInlineEdit,
  onDeleteNode,
  onRefreshTreeAndKeepContext,
  onSetPrimarySelection,
  onCreateParentNode,
  onCreateSiblingNode,
  onCreateChildNode,
  onCreateFirstNode,
  onOpenNodeTab,
  onReviewFile
}: SidebarPanelProps) {
  void quickAccessScopeLabel;
  const treeScrollRef = useRef<HTMLDivElement | null>(null);
  const [treeScrollTop, setTreeScrollTop] = useState(0);
  const [treeViewportHeight, setTreeViewportHeight] = useState(0);
  const [draggingFavoriteGroupId, setDraggingFavoriteGroupId] = useState<string | null>(null);
  const [favoriteGroupDropTargetId, setFavoriteGroupDropTargetId] = useState<string | null>(null);
  const draggingFavoriteGroupIdRef = useRef<string | null>(null);
  const focusTreeKeyboardSurface = () => {
    onActivateTreeSurface();
    treeScrollRef.current?.focus({ preventScroll: true });
  };
  const activateTreeKeyboardSurface = () => {
    focusTreeKeyboardSurface();
  };
  const restoreTreeKeyboardSurfaceAfterInlineEdit = () => {
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        focusTreeKeyboardSurface();
      });
      return;
    }
    focusTreeKeyboardSurface();
  };
  const hasSelectedNodes = selectedNodeIds.size > 0 || Boolean(selectedNodeId);
  const hasExpandableVisibleTreeRows = displayedTreeRows.some((row) => row.hasChildren);
  const hasCollapsedVisibleTreeRows = displayedTreeRows.some(
    (row) => row.hasChildren && !expandedIds.has(row.id)
  );
  const canToggleAllTreeNodes = canExpandAllTreeNodes || canCollapseAllTreeNodes;
  const shouldCollapseAllTreeNodes =
    hasExpandableVisibleTreeRows && !hasCollapsedVisibleTreeRows && canCollapseAllTreeNodes;
  const treeToggleLabel = shouldCollapseAllTreeNodes
    ? t("document_ai.tree_editor_collapse_all")
    : t("document_ai.tree_editor_expand_all");
  const nodeTooltipToggleLabel = nodeTooltipsEnabled
    ? t("sidebar.node_tooltips_hide")
    : t("sidebar.node_tooltips_show");
  const quickEditNodeDescriptionLabel = quickEditNodeDescriptionTargetLabel
    ? t("sidebar.edit_node_description_for", { node: quickEditNodeDescriptionTargetLabel })
    : t("sidebar.edit_node_description");
  const showFavoriteQuickAccess = true;
  const effectiveFavoriteTreeFilterEnabled =
    showFavoriteQuickAccess && favoriteTreeFilterEnabled;
  const effectiveFavoriteGroups = showFavoriteQuickAccess ? favoriteGroups : [];
  const effectiveSelectedFavoriteGroupIds = showFavoriteQuickAccess
    ? selectedFavoriteGroupIds
    : [];
  const effectiveSelectedFavoriteGroupIdSet = useMemo(
    () => new Set(effectiveSelectedFavoriteGroupIds),
    [effectiveSelectedFavoriteGroupIds]
  );
  const getNodeDisplayLabel = (node: AppNode) => {
    if (editingNodeId === node.id) {
      return editingValue.length > 0 ? editingValue : "\u00A0";
    }
    return isNodeProvisionalInlineCreate(node.id) ? "\u00A0" : getNodeDisplayName(node);
  };
  const getNodeDisplayText = (node: AppNode) => {
    const label = getNodeDisplayLabel(node);
    return label === "\u00A0" ? "" : label;
  };
  const deleteTargetFavoriteGroupId =
    effectiveSelectedFavoriteGroupIds[effectiveSelectedFavoriteGroupIds.length - 1] ??
    (effectiveFavoriteGroups.some((group) => group.id === activeFavoriteGroupId)
      ? activeFavoriteGroupId
      : null);
  const hasSelectedFavoriteGroup = Boolean(deleteTargetFavoriteGroupId);
  const shouldVirtualizeTree = displayedTreeRows.length >= TREE_VIRTUALIZE_MIN_ROWS;
  const treeRowIndexById = useMemo(() => {
    const map = new Map<string, number>();
    displayedTreeRows.forEach((row, idx) => map.set(row.id, idx));
    return map;
  }, [displayedTreeRows]);
  const virtualTreeWindow = useMemo(() => {
    if (!shouldVirtualizeTree) {
      return {
        rows: displayedTreeRows,
        topSpacer: 0,
        bottomSpacer: 0
      };
    }

    const total = displayedTreeRows.length;
    if (total === 0) {
      return {
        rows: [] as TreeRow[],
        topSpacer: 0,
        bottomSpacer: 0
      };
    }

    const viewport = treeViewportHeight > 0 ? treeViewportHeight : TREE_VIRTUAL_ROW_HEIGHT * 14;
    const unclampedStart = Math.floor(treeScrollTop / TREE_VIRTUAL_ROW_HEIGHT) - TREE_VIRTUAL_OVERSCAN;
    const startIndex = Math.max(0, unclampedStart);
    const unclampedEnd =
      Math.ceil((treeScrollTop + viewport) / TREE_VIRTUAL_ROW_HEIGHT) + TREE_VIRTUAL_OVERSCAN;
    const endIndex = Math.min(total - 1, unclampedEnd);
    return {
      rows: displayedTreeRows.slice(startIndex, endIndex + 1),
      topSpacer: startIndex * TREE_VIRTUAL_ROW_HEIGHT,
      bottomSpacer: Math.max(0, (total - endIndex - 1) * TREE_VIRTUAL_ROW_HEIGHT)
    };
  }, [displayedTreeRows, shouldVirtualizeTree, treeScrollTop, treeViewportHeight]);
  const visibleTreeRows = useMemo(
    () => virtualTreeWindow.rows.filter((row) => !isFileLikeNode(row.node)),
    [virtualTreeWindow.rows]
  );

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onSearchDropdownOpenChange(false);
      return;
    }

    if (event.key === "ArrowDown" && searchResults.length > 0) {
      event.preventDefault();
      onSearchDropdownOpenChange(true);
      onSearchActiveIndexChange(Math.min(searchActiveIndex + 1, searchResults.length - 1));
      return;
    }

    if (event.key === "ArrowUp" && searchResults.length > 0) {
      event.preventDefault();
      onSearchActiveIndexChange(Math.max(searchActiveIndex - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (searchDropdownOpen && searchResults[searchActiveIndex]) {
        onSelectFromSearch(searchResults[searchActiveIndex].node.id);
      } else {
        onRunSearch();
        onSearchDropdownOpenChange(true);
      }
    }
  };

  useEffect(() => {
    const treeEl = treeScrollRef.current;
    if (!treeEl) return;

    const updateViewport = () => {
      setTreeViewportHeight(treeEl.clientHeight);
    };
    updateViewport();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateViewport);
      observer.observe(treeEl);
      return () => {
        observer.disconnect();
      };
    }

    window.addEventListener("resize", updateViewport);
    return () => {
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  useEffect(() => {
    if (!shouldVirtualizeTree) return;
    const treeEl = treeScrollRef.current;
    if (!treeEl) return;
    const maxScrollTop = Math.max(
      0,
      displayedTreeRows.length * TREE_VIRTUAL_ROW_HEIGHT - treeViewportHeight
    );
    if (treeScrollTop <= maxScrollTop) return;
    treeEl.scrollTop = maxScrollTop;
    setTreeScrollTop(maxScrollTop);
  }, [shouldVirtualizeTree, displayedTreeRows.length, treeViewportHeight, treeScrollTop]);

  useEffect(() => {
    if (!shouldVirtualizeTree || !selectedNodeId || treeViewportHeight <= 0) return;
    const selectedIndex = treeRowIndexById.get(selectedNodeId);
    if (selectedIndex === undefined) return;
    const rowTop = selectedIndex * TREE_VIRTUAL_ROW_HEIGHT;
    const rowBottom = rowTop + TREE_VIRTUAL_ROW_HEIGHT;
    const viewportTop = treeScrollTop;
    const viewportBottom = treeScrollTop + treeViewportHeight;
    let nextScrollTop: number | null = null;

    if (rowTop < viewportTop) {
      nextScrollTop = rowTop;
    } else if (rowBottom > viewportBottom) {
      nextScrollTop = rowBottom - treeViewportHeight;
    }

    if (nextScrollTop === null) return;
    const clamped = Math.max(0, nextScrollTop);
    const treeEl = treeScrollRef.current;
    if (treeEl) treeEl.scrollTop = clamped;
    setTreeScrollTop((prev) => (prev === clamped ? prev : clamped));
  }, [
    shouldVirtualizeTree,
    selectedNodeId,
    treeRowIndexById,
    treeViewportHeight
  ]);

  useEffect(() => {
    if (!shouldVirtualizeTree || !selectedNodeId || treeViewportHeight <= 0 || treeSelectionRevealRequestKey <= 0) {
      return;
    }
    const selectedIndex = treeRowIndexById.get(selectedNodeId);
    if (selectedIndex === undefined) return;
    const centeredScrollTop =
      selectedIndex * TREE_VIRTUAL_ROW_HEIGHT - Math.max(0, (treeViewportHeight - TREE_VIRTUAL_ROW_HEIGHT) / 2);
    const maxScrollTop = Math.max(
      0,
      displayedTreeRows.length * TREE_VIRTUAL_ROW_HEIGHT - treeViewportHeight
    );
    const clamped = Math.min(Math.max(0, centeredScrollTop), maxScrollTop);
    const treeEl = treeScrollRef.current;
    if (treeEl) treeEl.scrollTop = clamped;
    setTreeScrollTop((prev) => (prev === clamped ? prev : clamped));
  }, [
    displayedTreeRows.length,
    selectedNodeId,
    shouldVirtualizeTree,
    treeRowIndexById,
    treeSelectionRevealRequestKey,
    treeViewportHeight
  ]);

  const handleFavoriteUiKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === "Tab" || event.key === " ") {
      event.stopPropagation();
    }
  };

  const handleFavoriteUiKeyDownCapture = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === "Tab" || event.key === " ") {
      event.stopPropagation();
    }
  };

  const handleFavoriteGroupKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, groupId: string) => {
    handleFavoriteUiKeyDown(event);
    if (event.key !== "Delete" && event.key !== "Backspace") return;
    event.preventDefault();
    event.stopPropagation();
    onDeleteFavoriteGroup(groupId);
  };

  const resolveDraggedFavoriteGroupId = (event: DragEvent<HTMLElement>): string | null => {
    if (draggingFavoriteGroupIdRef.current) return draggingFavoriteGroupIdRef.current;
    if (draggingFavoriteGroupId) return draggingFavoriteGroupId;
    const fromCustom = event.dataTransfer.getData(FAVORITE_GROUP_DRAG_MIME)?.trim();
    if (fromCustom) return fromCustom;
    const fromPlain = event.dataTransfer.getData("text/plain")?.trim();
    if (fromPlain && favoriteGroups.some((group) => group.id === fromPlain)) return fromPlain;
    return null;
  };

  const renderTooltipControlButtons = () => (
    <>
      <OdeTooltip label={nodeTooltipToggleLabel} side="bottom">
        <button
          type="button"
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition ${
            nodeTooltipsEnabled
              ? "border-[var(--ode-border-accent)] bg-[rgba(31,129,188,0.22)] text-[var(--ode-text)]"
              : "border-[var(--ode-border)] text-[var(--ode-text-dim)] hover:border-[var(--ode-border-accent)] hover:text-[var(--ode-text)]"
          }`}
          onClick={onToggleNodeTooltips}
          onKeyDown={handleFavoriteUiKeyDown}
          aria-label={nodeTooltipToggleLabel}
          aria-pressed={nodeTooltipsEnabled}
        >
          <InfoGlyphSmall />
        </button>
      </OdeTooltip>

      <OdeTooltip label={quickEditNodeDescriptionLabel} side="bottom">
        <button
          type="button"
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition ${
            canQuickEditNodeDescription
              ? "border-[var(--ode-border)] text-[var(--ode-text-dim)] hover:border-[var(--ode-border-accent)] hover:text-[var(--ode-text)]"
              : "cursor-not-allowed border-[var(--ode-border)] text-[var(--ode-text-subtle)] opacity-45"
          }`}
          onClick={onQuickEditNodeDescription}
          onKeyDown={handleFavoriteUiKeyDown}
          aria-label={quickEditNodeDescriptionLabel}
          aria-disabled={!canQuickEditNodeDescription}
          disabled={!canQuickEditNodeDescription}
        >
          <EditGlyphSmall />
        </button>
      </OdeTooltip>
    </>
  );

  const renderTreeToggleButton = () => (
    <OdeTooltip label={treeToggleLabel} side="bottom">
      <button
        type="button"
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition ${
          canToggleAllTreeNodes
            ? "border-[var(--ode-border)] text-[var(--ode-text-dim)] hover:border-[var(--ode-border-accent)] hover:text-[var(--ode-text)]"
            : "border-[var(--ode-border)] text-[var(--ode-text-subtle)] opacity-45 cursor-not-allowed"
        }`}
        onClick={() => {
          if (!canToggleAllTreeNodes) return;
          if (shouldCollapseAllTreeNodes) {
            onCollapseAllTreeNodes();
            return;
          }
          onExpandAllTreeNodes();
        }}
        onKeyDown={handleFavoriteUiKeyDown}
        aria-label={treeToggleLabel}
        aria-disabled={!canToggleAllTreeNodes}
      >
        {shouldCollapseAllTreeNodes ? <CollapseAllGlyphSmall /> : <ExpandAllGlyphSmall />}
      </button>
    </OdeTooltip>
  );

  const renderOrganizationTreeButton = () => (
    <OdeTooltip label={t("tabs.desktop")} side="bottom">
      <button
        type="button"
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition ${
          effectiveFavoriteTreeFilterEnabled
            ? "border-[var(--ode-border)] text-[var(--ode-text-dim)] hover:border-[var(--ode-border-accent)] hover:text-[var(--ode-text)]"
            : "border-[var(--ode-border-accent)] bg-[rgba(31,129,188,0.22)] text-[var(--ode-text)]"
        }`}
        onClick={() => {
          onToggleFavoriteTreeFilter();
          focusTreeKeyboardSurface();
        }}
        onKeyDown={handleFavoriteUiKeyDown}
        aria-label={t("tabs.desktop")}
        aria-pressed={!effectiveFavoriteTreeFilterEnabled}
      >
        <FolderGlyph active={!effectiveFavoriteTreeFilterEnabled} state="filled" />
      </button>
    </OdeTooltip>
  );

  return (
    <aside
      className="ode-pane flex min-h-0 flex-col bg-[linear-gradient(180deg,rgba(3,20,33,0.98),rgba(2,15,26,1))] lg:shrink-0"
      style={{
        width: isLargeLayout ? `${isSidebarCollapsed ? sidebarCollapsedWidth : sidebarWidth}px` : undefined
      }}
    >
      {isLargeLayout && isSidebarCollapsed ? (
        <div className="ode-sidebar-rail">
          <OdeTooltip label={t("sidebar.expand")} side="bottom" align="start">
            <button
              className="ode-sidebar-rail-btn ode-sidebar-rail-btn-primary"
              onClick={() => onSetIsSidebarCollapsed(false)}
              aria-label={t("sidebar.expand")}
            >
              <SidebarMenuGlyphSmall />
            </button>
          </OdeTooltip>
          <OdeTooltip label="Search" side="bottom" align="start">
            <button
              className="ode-sidebar-rail-btn"
              onClick={onExpandSidebarForSearch}
              aria-label="Search"
            >
              <SearchGlyph />
            </button>
          </OdeTooltip>
          <OdeTooltip label="Tree" side="bottom" align="start">
            <button
              className="ode-sidebar-rail-btn"
              onClick={onExpandSidebarPanel}
              aria-label="Tree"
            >
              <FolderGlyph active state="filled" />
            </button>
          </OdeTooltip>
        </div>
      ) : (
        <>
          <div className="px-3 py-3">
            <div className="relative">
              {isLargeLayout ? (
                <OdeTooltip label={t("sidebar.collapse")} side="bottom" align="end">
                  <button
                    className="ode-sidebar-collapse-btn ode-sidebar-search-collapse-btn"
                    onClick={() => onSetIsSidebarCollapsed(true)}
                    aria-label={t("sidebar.collapse")}
                  >
                    <SidebarMenuGlyphSmall />
                  </button>
                </OdeTooltip>
              ) : null}
              <div className={`${SIDEBAR_SURFACE_PANEL_CLASS} px-3 py-3`}>
                <div className="flex items-center gap-2 rounded-[18px] py-2.5 pl-3 pr-10">
                  <span className="ode-sidebar-search-accent text-[0.95rem]">
                    <SearchGlyph />
                  </span>
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-gramm="false"
                    onFocus={() => {
                      if (searchQuery.trim().length > 0) onSearchDropdownOpenChange(true);
                    }}
                    onChange={(event) => onSearchQueryChange(event.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="ode-search-input ode-sidebar-search-input"
                    placeholder={t("search.placeholder")}
                  />
                </div>
              </div>

              {!showFavoriteQuickAccess ? (
                <div
                  className="mt-3 flex items-center gap-2"
                  data-ode-ignore-shortcuts="true"
                  onKeyDownCapture={handleFavoriteUiKeyDownCapture}
                >
                  {renderOrganizationTreeButton()}
                  {renderTreeToggleButton()}
                  {renderTooltipControlButtons()}
                </div>
              ) : null}

              {showFavoriteQuickAccess ? (
                <div className={`mt-3 overflow-hidden ${SIDEBAR_SURFACE_PANEL_CLASS}`}>
                    <div
                      className="px-3 py-3"
                      data-ode-ignore-shortcuts="true"
                      onKeyDownCapture={handleFavoriteUiKeyDownCapture}
                    >
                    <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto">
                      {renderOrganizationTreeButton()}
                      {renderTreeToggleButton()}
                      {renderTooltipControlButtons()}
                      {!libraryModeActive ? (
                        <>
                          <OdeTooltip label={t("favorites.group_new")} side="bottom">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--ode-border)] text-[0.95rem] text-[var(--ode-text-dim)] transition hover:border-[var(--ode-border-accent)] hover:text-[var(--ode-text)]"
                              onClick={onCreateFavoriteGroup}
                              onKeyDown={handleFavoriteUiKeyDown}
                              aria-label={t("favorites.group_new")}
                            >
                              +
                            </button>
                          </OdeTooltip>
                          <OdeTooltip label={t("context.assign_favorite_group")} side="bottom">
                            <button
                              type="button"
                              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition ${
                                hasSelectedNodes
                                  ? "border-[var(--ode-border)] text-[var(--ode-text-dim)] hover:border-[var(--ode-border-accent)] hover:text-[var(--ode-text)]"
                                  : "border-[var(--ode-border)] text-[var(--ode-text-subtle)] opacity-45 cursor-not-allowed"
                              }`}
                              onClick={() => {
                                if (!hasSelectedNodes) return;
                                onOpenFavoriteGroupAssign();
                              }}
                              onKeyDown={handleFavoriteUiKeyDown}
                              aria-label={t("context.assign_favorite_group")}
                              aria-disabled={!hasSelectedNodes}
                            >
                              <QuickAccessGlyphSmall />
                            </button>
                          </OdeTooltip>
                          {effectiveFavoriteGroups.length > 0 ? (
                            <OdeTooltip label={t("favorites.group_delete")} side="bottom">
                              <button
                                type="button"
                                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition ${
                                  draggingFavoriteGroupId
                                    ? "border-[var(--ode-danger)] bg-[rgba(118,29,36,0.35)] text-[var(--ode-danger)]"
                                    : hasSelectedFavoriteGroup
                                    ? "border-[var(--ode-border)] text-[var(--ode-text-dim)] hover:border-[var(--ode-danger)] hover:text-[var(--ode-danger)]"
                                    : "border-[var(--ode-border)] text-[var(--ode-text-subtle)] opacity-45 cursor-not-allowed"
                                }`}
                                onClick={() => {
                                  if (draggingFavoriteGroupId) {
                                    onDeleteFavoriteGroup(draggingFavoriteGroupId);
                                    draggingFavoriteGroupIdRef.current = null;
                                    setDraggingFavoriteGroupId(null);
                                    return;
                                  }
                                  if (!deleteTargetFavoriteGroupId) return;
                                  onDeleteFavoriteGroup(deleteTargetFavoriteGroupId);
                                }}
                                onKeyDown={handleFavoriteUiKeyDown}
                                onDragOver={(event) => {
                                  if (!resolveDraggedFavoriteGroupId(event)) return;
                                  event.preventDefault();
                                  event.stopPropagation();
                                  event.dataTransfer.dropEffect = "move";
                                }}
                                onDrop={(event) => {
                                  const groupId = resolveDraggedFavoriteGroupId(event);
                                  if (!groupId) return;
                                  event.preventDefault();
                                  event.stopPropagation();
                                  onDeleteFavoriteGroup(groupId);
                                  draggingFavoriteGroupIdRef.current = null;
                                  setDraggingFavoriteGroupId(null);
                                  setFavoriteGroupDropTargetId(null);
                                }}
                                aria-label={t("favorites.group_delete")}
                                aria-disabled={!draggingFavoriteGroupId && !deleteTargetFavoriteGroupId}
                              >
                                <TrashGlyphSmall />
                              </button>
                            </OdeTooltip>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                    {effectiveFavoriteGroups.length > 0 ? (
                        <div
                          className="mt-3 border-t border-dashed border-[rgba(74,165,212,0.4)] pt-3"
                          data-ode-ignore-shortcuts="true"
                          onKeyDownCapture={handleFavoriteUiKeyDownCapture}
                        >
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {effectiveFavoriteGroups.map((group) => (
                      <button
                        key={`sidebar-favorite-group-${group.id}`}
                        type="button"
                        draggable
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-[0.72rem] ${
                          effectiveSelectedFavoriteGroupIdSet.has(group.id)
                            ? "border-[var(--ode-border-accent)] bg-[rgba(31,129,188,0.22)] text-[var(--ode-text)]"
                            : "border-[var(--ode-border)] text-[var(--ode-text-dim)] hover:border-[var(--ode-border-accent)] hover:text-[var(--ode-text)]"
                        }`}
                        onClick={(event) =>
                          {
                            event.currentTarget.focus();
                            onSelectFavoriteGroup(group.id, {
                              toggle: event.ctrlKey || event.metaKey
                            });
                          }
                        }
                        onDoubleClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onEditFavoriteGroup(group.id);
                        }}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData(FAVORITE_GROUP_DRAG_MIME, group.id);
                          event.dataTransfer.setData("text/plain", group.id);
                          draggingFavoriteGroupIdRef.current = group.id;
                          setDraggingFavoriteGroupId(group.id);
                        }}
                        onDragEnd={() => {
                          draggingFavoriteGroupIdRef.current = null;
                          setDraggingFavoriteGroupId(null);
                          setFavoriteGroupDropTargetId(null);
                        }}
                        onDragOver={(event) => {
                          if (resolveDraggedFavoriteGroupId(event)) return;
                          const sourceNodeId = onResolveActiveDragSourceId(event);
                          if (!sourceNodeId) return;
                          event.preventDefault();
                          event.stopPropagation();
                          event.dataTransfer.dropEffect = "move";
                          if (favoriteGroupDropTargetId !== group.id) {
                            setFavoriteGroupDropTargetId(group.id);
                          }
                        }}
                        onDragLeave={(event) => {
                          if (favoriteGroupDropTargetId !== group.id) return;
                          event.stopPropagation();
                          const relatedTarget = event.relatedTarget as Node | null;
                          if (relatedTarget && event.currentTarget.contains(relatedTarget)) return;
                          setFavoriteGroupDropTargetId(null);
                        }}
                        onDrop={(event) => {
                          if (resolveDraggedFavoriteGroupId(event)) {
                            event.preventDefault();
                            event.stopPropagation();
                            setFavoriteGroupDropTargetId(null);
                            return;
                          }
                          const sourceNodeId = onResolveActiveDragSourceId(event);
                          if (!sourceNodeId) return;
                          event.preventDefault();
                          event.stopPropagation();
                          setFavoriteGroupDropTargetId(null);
                          onAssignNodesToFavoriteGroup(group.id, sourceNodeId);
                        }}
                        onKeyDown={(event) => handleFavoriteGroupKeyDown(event, group.id)}
                        aria-label={`${group.name} - ${t("favorites.panel_title")}`}
                        aria-pressed={effectiveSelectedFavoriteGroupIdSet.has(group.id)}
                        style={
                          favoriteGroupDropTargetId === group.id
                            ? {
                                borderColor: "var(--ode-border-accent)",
                                background: "rgba(31,129,188,0.22)",
                                color: "var(--ode-text)"
                              }
                            : undefined
                        }
                      >
                        {group.name}
                      </button>
                    ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {workspaceFocusMode === "execution" ? null : workspaceManageCard ?? null}

              {searchDropdownOpen && searchResults.length > 0 ? (
                <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-30 max-h-80 overflow-auto rounded-[22px] border border-[rgba(108,211,255,0.26)] bg-[linear-gradient(180deg,rgba(4,25,42,0.98),rgba(2,17,29,0.98))] p-2 shadow-[0_24px_48px_rgba(0,0,0,0.46)]">
                  {searchResults.map((result, idx) => (
                    <button
                      key={`search-${result.node.id}`}
                      className={`flex w-full items-start gap-2 rounded-[16px] border px-3 py-3 text-left transition ${idx === searchActiveIndex
                        ? "border-[rgba(108,211,255,0.3)] bg-[rgba(19,82,122,0.34)] text-white"
                        : "border-transparent text-[var(--ode-text-dim)] hover:border-[rgba(108,211,255,0.16)] hover:bg-[rgba(8,42,65,0.52)]"
                        }`}
                      onMouseEnter={() => onSearchActiveIndexChange(idx)}
                      onClick={() => onSelectFromSearch(result.node.id)}
                    >
                      <span className="mt-[1px] shrink-0">
                        <NodeGlyph
                          node={result.node}
                          active={idx === searchActiveIndex}
                          folderState={!isFileLikeNode(result.node) ? folderNodeStateById.get(result.node.id) : undefined}
                          showExecutionOwnerGlyph={executionOwnerNodeIds.has(result.node.id)}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block whitespace-normal break-words text-[0.96rem] leading-[1.2]">
                          {result.node.name}
                        </span>
                        {result.pathLabel && result.pathLabel !== result.node.name ? (
                          <span className="mt-1 block whitespace-normal break-words text-[0.76rem] leading-5 text-[var(--ode-text-muted)]">
                            {result.pathLabel}
                          </span>
                        ) : null}
                      </span>
                      {!hideTreeNumbering && !isFileLikeNode(result.node) ? (
                        <span className="ml-auto shrink-0 self-start rounded bg-[rgba(36,133,202,0.14)] px-1.5 py-[1px] text-[0.68rem] text-[var(--ode-text-muted)]">
                          {scopedNumbering.get(result.node.id) ?? "-"}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div
            ref={treeScrollRef}
            className="flex-1 overflow-auto px-3 pb-4 pt-3 focus:outline-none"
            data-ode-surface="tree"
            tabIndex={0}
            onMouseDownCapture={activateTreeKeyboardSurface}
            onFocusCapture={onActivateTreeSurface}
            onScroll={(event) => {
              if (!shouldVirtualizeTree) return;
              const next = event.currentTarget.scrollTop;
              setTreeScrollTop((prev) => (prev === next ? prev : next));
            }}
            onContextMenu={(event) => {
              const targetEl = event.target as HTMLElement;
              if (targetEl.closest(".ode-tree-row")) return;
              onOpenSurfaceContextMenu(event);
            }}
            onDragOver={(event) => {
              if (onHasExternalFileDrag(event)) {
                const targetEl = event.target as HTMLElement;
                if (targetEl.closest(".ode-tree-row")) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
                onSetDropIndicator({ targetId: scopedRootDropTargetId, position: "inside" });
                return;
              }
              const sourceId = onResolveActiveDragSourceId(event);
              if (!sourceId) return;
              const targetEl = event.target as HTMLElement;
              if (targetEl.closest(".ode-tree-row")) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              onSetDropIndicator({ targetId: scopedRootDropTargetId, position: "inside" });
            }}
            onDrop={(event) => {
              const externalPaths = onResolveExternalDropPaths(event);
              if (externalPaths.length > 0) {
                const targetEl = event.target as HTMLElement;
                if (targetEl.closest(".ode-tree-row")) return;
                event.preventDefault();
                onClearDraggingState();
                void onImportExternalFilesToNode(externalPaths, activeProjectRootId ?? null, "tree");
                return;
              }
              const sourceId = onResolveActiveDragSourceId(event);
              if (!sourceId) return;
              const targetEl = event.target as HTMLElement;
              if (targetEl.closest(".ode-tree-row")) return;
              event.preventDefault();
              onClearDraggingState();
              void onApplyDropMove(sourceId, scopedRootDropTargetId, "inside", "tree");
            }}
          >
            {dropIndicator?.targetId === scopedRootDropTargetId ? (
              <div className="mb-3 rounded-[18px] border border-dashed border-[rgba(108,211,255,0.26)] bg-[rgba(7,35,55,0.58)] px-4 py-3 text-[0.8rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                {t("tree.drop_to_root")}
              </div>
            ) : null}
            {shouldVirtualizeTree && virtualTreeWindow.topSpacer > 0 ? (
              <div style={{ height: `${virtualTreeWindow.topSpacer}px` }} />
            ) : null}
            {visibleTreeRows.map((row) => (
              // Render the inline editor only on the surface where rename started.
              // This avoids duplicate inputs fighting for focus across tree/desktop/timeline.
              (() => {
                const isEditingHere = editingNodeId === row.id && editingSurface === "tree";
                const selected = selectedNodeIds.has(row.id);
                const focused = selectedNodeId === row.id;
                const isFileNode = isFileLikeNode(row.node);
                const isMajorNode = !isFileNode && row.level <= 1;
                const nodeTooltipLabel =
                  nodeTooltipsEnabled && editingNodeId !== row.id && !isFileNode
                    ? getNodeTooltipLabel({
                        title: getNodeDisplayText(row.node),
                        description: row.node.description,
                        numberLabel: hideTreeNumbering ? "" : row.indexLabel
                      })
                    : null;
                const nodeHasStructureLock = isNodeStructureLockOwner(row.node);
                const rowContent = (
              <div
                key={row.id}
                data-ode-node-id={row.id}
                className={`ode-tree-row group relative mb-1.5 flex items-start gap-2 overflow-hidden rounded-[22px] border border-transparent pr-2 transition-[background,border-color,box-shadow,transform] duration-150 ${selected ? "ode-tree-row-selected border-[rgba(108,211,255,0.36)] bg-[linear-gradient(135deg,rgba(13,61,92,0.68),rgba(6,31,49,0.92))] shadow-[0_12px_32px_rgba(0,0,0,0.2)]" : "bg-[rgba(4,23,37,0.16)] hover:border-[rgba(108,211,255,0.16)] hover:bg-[rgba(7,34,53,0.52)]"} ${focused ? "ode-tree-row-active shadow-[0_0_0_1px_rgba(122,224,255,0.24),0_16px_36px_rgba(0,0,0,0.24)]" : ""} ${cutPendingNodeIds.has(row.id) ? "ode-cut-pending" : ""
                  } ${draggingNodeId === row.id ? "ode-tree-row-dragging opacity-70" : ""
                  } ${dropIndicator?.targetId === row.id
                    ? dropIndicator.position === "before"
                      ? "ode-drop-before"
                      : dropIndicator.position === "after"
                        ? "ode-drop-after"
                        : "ode-drop-inside"
                    : ""
                  }`}
                style={{ paddingLeft: `${resolveSidebarTreeIndent(row.level)}px` }}
                draggable={editingNodeId !== row.id}
                onMouseDown={() => {
                  if (editingNodeId === row.id) return;
                  activateTreeKeyboardSurface();
                }}
                onClick={(event) => {
                  if (editingNodeId === row.id) return;
                  onCloseContextMenu();
                  const target = event.target as HTMLElement;
                  if (target.closest("input")) return;
                  if (target.closest(".ode-caret-btn")) return;
                  const range = event.shiftKey;
                  const toggle = event.ctrlKey || event.metaKey;
                  onApplyTreeSelection(row.id, {
                    range,
                    toggle
                  });
                  if (!range && !toggle) {
                    void onBrowseTreeNode(row.id);
                  }
                }}
                onContextMenu={(event) => {
                  if (editingNodeId === row.id) return;
                  onOpenNodeContextMenu(event, row.id, "tree");
                }}
                onDragStart={(event) => {
                  onBeginNodeDrag(event, row.id, "tree");
                }}
                onDragOver={(event) => {
                  if (onHasExternalFileDrag(event)) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "copy";
                    onSetDropIndicator({ targetId: row.id, position: "inside" });
                    return;
                  }
                  const sourceId = onResolveActiveDragSourceId(event);
                  if (!sourceId) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  onSetDropIndicator({ targetId: row.id, position: onDetectDropPosition(event, row.node) });
                }}
                onDrop={(event) => {
                  const externalPaths = onResolveExternalDropPaths(event);
                  if (externalPaths.length > 0) {
                    event.preventDefault();
                    onClearDraggingState();
                    void onImportExternalFilesToNode(externalPaths, row.id, "tree");
                    return;
                  }
                  event.preventDefault();
                  const sourceId = onResolveActiveDragSourceId(event);
                  if (!sourceId) return;
                  const position =
                    dropIndicator?.targetId === row.id ? dropIndicator.position : onDetectDropPosition(event, row.node);
                  onClearDraggingState();
                  void onApplyDropMove(sourceId, row.id, position, "tree");
                }}
                onDragEnd={onClearDraggingState}
                onDoubleClick={(event) => {
                  const target = event.target as HTMLElement;
                  if (target.closest("input")) return;
                  if (target.closest(".ode-caret-btn")) return;
                  if (isFileNode) {
                    onReviewFile(row.id);
                  } else {
                    void (async () => {
                      focusTreeKeyboardSurface();
                      await onOpenNodeTab(row.id, {
                        preserveTreeFocus: true
                      });
                      restoreTreeKeyboardSurfaceAfterInlineEdit();
                    })();
                  }
                }}
              >
                {row.level > 0 ? (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute bottom-2 top-2 w-px rounded-full bg-[linear-gradient(180deg,rgba(117,224,255,0),rgba(117,224,255,0.22),rgba(117,224,255,0))]"
                    style={{ left: `${15 + (row.level - 1) * 18}px` }}
                  />
                ) : null}
                <button
                  className={`ode-caret-btn mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] border border-transparent text-[0.82rem] transition ${
                    row.hasChildren
                      ? "text-[var(--ode-text-muted)] hover:border-[rgba(108,211,255,0.16)] hover:bg-[rgba(10,41,63,0.72)] hover:text-[var(--ode-text)]"
                      : "text-[var(--ode-text-subtle)] opacity-60"
                  }`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (row.hasChildren) onToggleExpand(row.id);
                  }}
                >
                  {row.hasChildren ? (expandedIds.has(row.id) ? "v" : ">") : ""}
                </button>

                <div className="ode-tree-row-main min-w-0 flex-1 items-start gap-3 rounded-[18px] px-2.5 py-2.5">
                  <NodeGlyph
                    node={row.node}
                    active={selected || focused}
                    folderState={!isFileLikeNode(row.node) ? folderNodeStateById.get(row.id) : undefined}
                    showExecutionOwnerGlyph={executionOwnerNodeIds.has(row.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start gap-2">
                      {isEditingHere ? (
                        <input
                          ref={inlineEditInputRef as RefObject<HTMLInputElement | null>}
                          autoFocus
                          value={editingValue}
                          spellCheck
                          autoCorrect="on"
                          autoCapitalize="off"
                          lang={getLocaleForLanguage(language)}
                          onChange={(event) => onSetEditingValue(event.target.value)}
                          onContextMenu={onOpenInlineEditContextMenu}
                          onBlur={() => {
                            if (editActionInFlightRef.current) return;
                            void onCommitInlineEdit();
                          }}
                          onKeyDown={(event) => {
                            // Keep inline edit keyboard handling local to the input.
                            // This prevents global shortcuts from firing while renaming.
                            event.stopPropagation();
                            const saveAndRestoreTreeSurface = () => {
                              editActionInFlightRef.current = true;
                              void (async () => {
                                await onCommitInlineEdit();
                              })().finally(() => {
                                editActionInFlightRef.current = false;
                                restoreTreeKeyboardSurfaceAfterInlineEdit();
                              });
                            };
                            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
                              event.preventDefault();
                              saveAndRestoreTreeSurface();
                              return;
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              onCancelInlineEdit();
                              return;
                            }
                            if (event.key === "Enter" || event.key === "Tab") {
                              event.preventDefault();
                              // Match Windows-style rename flow: save first, then let the next keypress
                              // decide whether to create a sibling/child from the now-selected node.
                              saveAndRestoreTreeSurface();
                            }
                          }}
                          className="ode-input h-9 w-full rounded-[12px] border-[rgba(122,224,255,0.22)] bg-[rgba(3,18,30,0.86)] px-3 text-[0.98rem]"
                        />
                      ) : (
                        <span
                          className={`ode-node-label min-w-0 flex-1 whitespace-normal break-words leading-[1.24] ${
                            isMajorNode
                              ? "text-[1.01rem] font-semibold tracking-[-0.02em] text-[var(--ode-text)]"
                              : "text-[0.96rem] font-medium text-[var(--ode-text-dim)]"
                          }`}
                          style={TREE_ROW_LABEL_CLAMP_STYLE}
                        >
                          {getNodeDisplayLabel(row.node)}
                        </span>
                      )}
                      <div className="flex shrink-0 items-start gap-2">
                        {!hideTreeNumbering && !isFileNode && row.indexLabel ? (
                          <span className={`rounded-full border px-2.5 py-1 text-[0.68rem] font-medium tracking-[0.12em] ${
                            selected || focused
                              ? "border-[rgba(130,229,255,0.34)] bg-[rgba(23,90,132,0.34)] text-[var(--ode-text)]"
                              : "border-[rgba(83,181,223,0.18)] bg-[rgba(18,65,95,0.22)] text-[var(--ode-text-muted)]"
                          }`}>
                            {row.indexLabel}
                          </span>
                        ) : null}
                        {nodeHasStructureLock ? (
                          <OdeTooltip label={t("structure_lock.locked_badge")} side="bottom">
                            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[rgba(223,198,119,0.42)] bg-[rgba(108,88,34,0.28)] text-[#f3d98a]">
                              <LockGlyphSmall />
                            </span>
                          </OdeTooltip>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
                );
                return nodeTooltipLabel ? (
                  <OdeTooltip
                    key={row.id}
                    label={nodeTooltipLabel}
                    side="bottom"
                    align="start"
                    tooltipClassName="ode-node-tooltip-popup"
                  >
                    {rowContent}
                  </OdeTooltip>
                ) : rowContent;
              })()
            ))}
            {shouldVirtualizeTree && virtualTreeWindow.bottomSpacer > 0 ? (
              <div style={{ height: `${virtualTreeWindow.bottomSpacer}px` }} />
            ) : null}
            {showEmptyState && displayedTreeRows.length === 0 ? (
              <div className="px-2 py-3">
                {searchQuery.trim().length === 0 && !effectiveFavoriteTreeFilterEnabled ? (
                  <OdeTooltip label={t("tree.add_first_node")} side="bottom">
                    <button
                      type="button"
                      className="ode-text-btn h-9 w-9 px-0 text-[1.15rem] font-semibold"
                      onClick={() => {
                        void onCreateFirstNode();
                      }}
                      aria-label={t("tree.add_first_node")}
                    >
                      +
                    </button>
                  </OdeTooltip>
                ) : null}
              </div>
            ) : null}
          </div>
        </>
      )}
    </aside>
  );
}
