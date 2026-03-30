import {
  type ChangeEvent,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { convertFileSrc, isTauri } from "@tauri-apps/api/core";
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
import { currentMonitor, getAllWindows, getCurrentWindow, type Window as TauriWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { readText as readClipboardText, writeText as writeClipboardText } from "@tauri-apps/plugin-clipboard-manager";
import {
  analyzeTicketWithAi,
  generateTicketReplyWithAi,
  runAiPromptAnalysis
} from "@/ai/core/aiOrchestrator";
import { callNative } from "@/lib/tauriApi";
import { I18N, translate, getLocaleForLanguage, isRtlLanguage, type LanguageCode, type TranslationParams } from "@/lib/i18n";
import { REGRESSION_CHECKLIST_ITEMS, type RegressionChecklistItem } from "@/lib/regressionChecklist";
import { getLocalizedRegressionChecklistItem } from "@/lib/regressionChecklistLocalization";
import {
  appendAiQaLearningRun,
  buildAiQaDeveloperGuidance,
  buildAiQaPlan,
  readAiQaAutoRunState,
  readAiQaLearningRuns,
  shouldAutoRunAiTester,
  writeAiQaAutoRunState,
  type AiQaAutoRunState,
  type AiQaExecutionItemReport,
  type AiQaExecutionReport,
  type AiQaLearningRun,
  type AiQaRunTrigger,
  type QaInputCategory
} from "@/lib/aiTester";
import {
  appendAiTelemetryEvent,
  buildAiActivityDetails,
  clearAiTelemetryEvents,
  readAiTelemetryEvents,
  type AiTelemetryDocumentAdvisorContext,
  type AiTelemetryEvent
} from "@/lib/aiTelemetry";
import {
  generateAiWorkBreakdown,
  generateChantierWBS,
  mapToNA,
  getWbsEstimatedEffortPoints,
  type WBSNode,
  type WBSResult
} from "@/lib/aiService";
import {
  createDefaultAiRebuildRuntime,
  type ApprovalQueuePreviewOutput,
  getAiRebuildStatus,
  type ActionPlanPreviewOutput,
  type AiRebuildStatus,
  type DocumentIngestionPreviewOutput,
  type DocumentRecordStoreOutput,
  type ExecutionPacketPreviewOutput,
  type FinalAiSolutionOutput,
  type KnowledgeRetrievalPreviewOutput,
  type KnowledgeSnapshotOutput,
  type WorkspaceKnowledgeSummaryOutput,
  type WorkspaceOverviewOutput
} from "@/ai/rebuild";
import { buildODEImportPreview } from "@/lib/odeAgentService";
import { NA_CATALOG, getNAByCode, getNAPathLabel, matchNAOutlineNode } from "@/lib/naCatalog";
import { buildODENodeProperties, getODENodeMetadata, resolveODECreationTarget } from "@/lib/odePolicy";
import {
  applyChantierProfileToProperties,
  isChantierNode,
  MANUAL_CHANTIER_PROPERTY,
  readChantierProfile
} from "@/features/ode/chantierProfile";
import { getSpellSuggestions } from "@/lib/spellcheckService";
import {
  buildAiPlannerPrompts,
  inferAiCommandArgs,
  normalizeAiCommandActionId,
  parseAiPlannerPayload,
  shouldSkipAiPlannerForCommand,
  type AiCommandActionId
} from "@/features/ai/commandPlanner";
import {
  buildAiCommandContext,
  buildInitialAiCommandAnalysis,
  finalizeAiCommandAnalysis,
  mergeAiPlannerAnalysisState
} from "@/features/ai/commandAnalysis";
import {
  buildDocumentAdvisorTranslatedReviewFallback,
  getDocumentAdvisorTranslationWarningMessage as getDocumentAdvisorTranslationWarningMessageState,
  getDocumentAdvisorTreeProposalWarningMessage as getDocumentAdvisorTreeProposalWarningMessageState,
  LANGUAGE_LABELS,
  maybeTranslateDocumentTreeResult,
  parseDocumentAdvisorTranslatedReview,
  resolveDocumentTranslationTarget,
  resolveDocumentTreeOutputLanguage,
  type DocumentTranslationMode
} from "@/features/ai/documentTranslation";
import {
  buildDocumentAdvisorActions as buildDocumentAdvisorActionsState,
  buildDocumentAdvisorTelemetryContext as buildDocumentAdvisorTelemetryContextState,
  getDocumentAdvisorActions as getDocumentAdvisorActionsState,
  getDocumentAdvisorSelectedSection as getDocumentAdvisorSelectedSectionState
} from "@/features/ai/documentAdvisorSupport";
import {
  buildOutlineWbsNode as buildOutlineWbsNodeState,
  buildPreviewLines as buildPreviewLinesState,
  extractDocumentAdvisorSectionText as extractDocumentAdvisorSectionTextState,
  extractDocumentAdvisorSections as extractDocumentAdvisorSectionsState,
  extractDocumentStructureWbsFromSources as extractDocumentStructureWbsFromSourcesState,
  extractDocumentTreeSeedFromSources as extractDocumentTreeSeedFromSourcesState,
  extractOutlineRows as extractOutlineRowsState,
  extractOutlineWbsFromSources as extractOutlineWbsFromSourcesState,
  getDocumentAdvisorLines as getDocumentAdvisorLinesState,
  parseNumberedOutlineToWbs as parseNumberedOutlineToWbsState
} from "@/features/ai/documentAdvisorParsing";
import { normalizeDocumentAdvisorTreeForCatalog } from "@/features/ai/documentAdvisorCatalog";
import {
  buildAiPlanPreview,
  parseArgsNames,
  parseArgsString
} from "@/features/ai/commandSupport";
import { formatWbsNodesForPrompt } from "@/features/ai/documentAdvisorPrompt";
import {
  executeAiCommandActionWithHandlers,
  type AiCommandExecutionHandlers
} from "@/features/ai/commandExecution";
import {
  areAllTimelinePrioritiesSelected as areAllTimelinePriorityFiltersSelected,
  areAllTimelineStatusesSelected as areAllTimelineStatusFiltersSelected,
  createAllTimelinePriorityFilters,
  createAllTimelineStatusFilters,
  TIMELINE_PRIORITY_ORDER,
  TIMELINE_STATUS_ORDER,
  toggleTimelinePrioritySelection,
  toggleTimelineStatusSelection,
  type TimelinePriority
} from "@/features/timeline/filterState";
import {
  resolveTimelineNodeFlagged,
  sortTimelineNodesByFlaggedState
} from "@/features/timeline/display";
import {
  getIsoWeekInfo,
  getWeekdayLabels,
  normalizeIsoDateOnlyInput,
  parseIsoDateOnly,
  toIsoDateOnly
} from "@/features/timeline/date";
import {
  areSchedulesEquivalent,
  getAggregateProgressFromChildren,
  getAggregateStatusFromChildren,
  normalizeTimelineSchedule,
  parseTimelineScheduleFromNode,
  type NodeTimelineSchedule
} from "@/features/timeline/model";
import {
  getTimelineStatusClass,
} from "@/features/timeline/presentation";
import {
  buildDisplayedTimelineRows,
  buildTimelineTreeRows
} from "@/features/timeline/rows";
import {
  buildAutoSchedulePropertyUpdates,
  buildEffectiveTimelineScheduleMap,
  buildTimelineScheduleLookup
} from "@/features/timeline/schedule";
import {
  getTimelineEmptyStateMessage,
  resolveTimelineMode,
  shouldShowTimelineCreateFirstNodeAction
} from "@/features/timeline/timelineMode";
import {
  areAllNodeStateFiltersSelected,
  createAllNodeStateFilters,
  deriveWorkspaceFocusMode,
  isStructureEmptyOnlyMode,
  resolveNodeStateFiltersForWorkspaceFocusMode,
  resolvePreferredViewForNodeStateFilters,
  toggleEmptyOnlyNodeStateFilters,
  toggleNodeStateFilterSelection
} from "@/features/workspace/viewMode";
import {
  buildScopedNumbering,
  canResolveInitialWorkspaceView as canResolveInitialWorkspaceViewState,
  collectProjectScopedNodeIds,
  hasLinkedWorkspaceFolder,
  isInternalWorkspaceRootPath,
  resolveActiveProject
} from "@/features/workspace/scope";
import {
  buildFilteredWorkspaceTreeRows,
  resolveWorkspaceGridNodes
} from "@/features/workspace/rows";
import {
  resolveNextVisibleActionSelectionId,
  resolveOrderedActionSelectionIds,
  resolveVisibleActionIdsForSurface
} from "@/features/workspace/actions";
import {
  buildFavoriteNodes,
  buildFavoriteGroupSelectionStateMap,
  buildQuickAccessMindMapGroups,
  filterFavoriteNodesBySelectedGroups,
  type FavoriteGroupSelectionState,
  getNodeFavoriteGroupIds,
  isNodeFavorite,
  normalizeFavoriteGroupIds,
  resolveExistingFavoriteGroupId,
  resolveFavoriteAssignDefaultGroupIds,
  resolveFavoriteMoveState,
  resolveFavoriteGroupMembershipState,
  resolveFavoriteSelectionState,
  toggleFavoriteGroupSelectionState
} from "@/features/workspace/favorites";
import {
  buildWorkspaceCreateInlineCancelState,
  buildWorkspaceCreateInlineOpenState,
  buildWorkspaceCreateInlineSubmitSuccessState,
  buildWorkspaceSettingsCloseState,
  buildWorkspaceSettingsToggleState,
  resolveWorkspaceDefaultProjectName,
  resolveWorkspaceOpenFolderPath
} from "@/features/workspace/manage";
import {
  buildSidebarSearchResults,
  buildTimelineSearchResults,
  collectAncestorNodeIds,
  resolveSearchResultNavigationParentId,
  resolveSearchResultSelectionSurface
} from "@/features/workspace/search";
import {
  applyNodeStructureLock,
  findStructureLockOwner,
  isNodeStructureLockOwner
} from "@/features/workspace/structureLock";
import {
  createContextMenuState,
  shouldRetainContextMenuSelection,
  type ContextMenuKind,
  type ContextMenuState
} from "@/features/workspace/contextMenu";
import {
  buildExecutionTaskTimelineSchedule,
  compareIsoDate,
  collectExecutionOwnerNodeIds,
  createExecutionTaskItem,
  createExecutionTaskItemId,
  getExecutionTaskMeta,
  isHiddenExecutionTaskNode,
  isRenderableExecutionProjectionNode as isRenderableExecutionProjectionNodeState,
  normalizeExecutionTaskItems,
  normalizeExecutionTaskText,
  normalizeStructuredDeliverablesForNode,
  readNodeObjectiveValue
} from "@/features/workspace/execution";
import {
  buildStructuredDeliverablesFromWorkareaNodes,
  collectWorkareaOwnerNodeIds,
  getWorkareaItemKind,
  getWorkareaOwnerNodeId,
  isDeclaredWorkareaOwnerNode,
  isWorkareaItemNode,
  resolveWorkareaItemKindForParent,
  type WorkareaItemKind
} from "@/features/workspace/workarea";
import {
  doesNodeMatchNodeStateFilters,
  getFolderNodeStateLabel,
  hasOwnNodeSchedule,
  resolveFolderNodeState,
  shouldForceTaskFilterParents
} from "@/features/workspace/nodeState";
import {
  resolveDefaultCreationParentNodeId,
  resolveEffectiveCreationSurfaceForWorkspace,
  resolveImportParentNodeId,
  resolvePostImportSelectionSurface,
  resolveStructuralCreationTargetNode,
  resolveVisibleSelectionForSurface
} from "@/features/workspace/creation";
import {
  resolveKeyboardCreationSurface,
  resolveSelectionSurfaceForKeyboardSurface
} from "@/features/workspace/keyboard";
import {
  removeProvisionalInlineCreateState,
  resolveInlineEditFallbackSelectionId,
  resolveInlineEditSurface as resolveInlineEditSurfaceState,
  setProvisionalInlineCreateState,
  type ProvisionalInlineCreateState
} from "@/features/workspace/inlineEdit";
import {
  resolveTreeMoveInPlans as resolveTreeMoveInPlansState,
  resolveMovedTreeSelectionIds,
  resolveTreeMoveOutPlans as resolveTreeMoveOutPlansState,
} from "@/features/workspace/treeMove";
import {
  buildSelectionSignature,
  normalizeSelectionState,
  resolveKeyboardSurfaceAfterProcedure,
  resolvePreferredKeyboardSurface,
  resolveProcedureSelectionSurface,
  resolveSurfaceStateForWorkspaceMode
} from "@/features/workspace/selection";
import {
  collectDocumentTreeProposalNodeKeys,
  filterDocumentTreeProposalNodes
} from "@/lib/documentTreeProposal";
import { detectDocumentLanguage, type DocumentLanguageCode } from "@/lib/documentLanguage";
import { StatusBar } from "@/components/layout/StatusBar";
import { TopBar } from "@/components/layout/TopBar";
import { NodeContextMenu } from "@/components/overlay/NodeContextMenu";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import { TextEditContextMenu, type TextEditContextMenuState } from "@/components/overlay/TextEditContextMenu";
import type {
  AiActivityItem,
  AiCommandPlan,
  AiCommandRequestOptions,
  AiNodeContext,
  AiNodeResponse
} from "@/components/overlay/AiCommandBar";
import { ModalStack } from "@/components/modals/ModalStack";
import { AiWorkspaceModal } from "@/components/modals/AiWorkspaceModal";
import { AiSettingsModal } from "@/components/modals/AiSettingsModal";
import { DeleteConfirmModal } from "@/components/modals/DeleteConfirmModal";
import type { DocumentActionModalItem } from "@/components/modals/DocumentActionModal";
import { HelpModal } from "@/components/modals/HelpModal";
import { MindMapFileReviewModal } from "@/components/modals/MindMapFileReviewModal";
import { NodeQuickAppsModal } from "@/components/modals/NodeQuickAppsModal";
import { NodeTooltipEditModal } from "@/components/modals/NodeTooltipEditModal";
import { ODEImportPreviewModal } from "@/components/modals/ODEImportPreviewModal";
import { QaChecklistModal } from "@/components/modals/QaChecklistModal";
import { ReleaseNotesModal } from "@/components/modals/ReleaseNotesModal";
import { TaskScheduleModal } from "@/components/modals/TaskScheduleModal";
import { WorkspaceSettingsModal } from "@/components/modals/WorkspaceSettingsModal";
import { DesktopView } from "@/components/views/DesktopView";
import { TimelineView } from "@/components/views/TimelineView";
import { MainPaneHeader } from "@/components/views/MainPaneHeader";
import { TimelineHeaderBar } from "@/components/views/TimelineHeaderBar";
import { DesktopContentPanel } from "@/components/views/DesktopContentPanel";
import { DesktopNodeTabBar } from "@/components/views/DesktopNodeTabBar";
import { ProcedureBuilderPanel } from "@/components/views/ProcedureBuilderPanel";
import { TimelineContentPanel } from "@/components/views/TimelineContentPanel";
import { SidebarPanel } from "@/components/views/SidebarPanel";
import { NodeGlyph, SettingsGlyphSmall } from "@/components/Icons";
import {
  getNodeMirrorFilePath,
  getNodePreferredFileLocationPath,
  getNodePreferredFileActionPath,
  buildWindowsFileIconCacheKey,
  resolveWindowsFileIcon,
  WINDOWS_FILE_ICON_SIZE,
  WINDOWS_FILE_ICON_CACHE,
  extractFileExtensionLabel,
  getDesktopMediaPreviewKind,
  resolveDesktopPreviewSrc,
  TEXT_PREVIEW_EXTENSIONS,
  type DesktopMediaPreviewKind
} from "@/lib/iconSupport";
import {
  createNode,
  detectProjectWorkspaceExternalChanges,
  deleteNode,
  extractDocumentText,
  exportNodePackage,
  exportTreeStructureExcel,
  getAllNodes,
  getChildren,
  getProjects,
  pickWindowsFilesForImport,
  pickWindowsNodePackageFile,
  pickWindowsTreeSpreadsheetFile,
  getWindowsFileIcon,
  importNodePackage,
  importFilesToNode,
  getNode,
  moveNode,
  openExternalUrl,
  openLocalPath,
  openNodeFile,
  openNodeFileLocation,
  openNodeFileWith,
  renameNode,
  runQualityGateCommand,
  exportPowerPointSlides,
  readLocalImageDataUrl,
  readTreeStructureExcel,
  probeSingleInstanceRelaunch,
  saveExportFile,
  type QualityGateResult,
  updateNodeContent,
  updateNodeDescription,
  updateNodeProperties
} from "@/lib/nodeService";
import {
  buildNodeQuickAppsProperties,
  createNodeQuickAppItem,
  getQuickAppTargetLeafName,
  getNodeQuickApps,
  normalizeNodeQuickApps,
  resolveQuickAppLaunchTarget,
  type NodeQuickAppItem
} from "@/lib/nodeQuickApps";
import {
  ODE_WORKSTREAM_WORKSPACE_PROPERTY,
  buildExecutionTasksFromProposal,
  buildWorkstreamWorkspaceFromProposal,
  upsertWorkstreamWorkspaceCollection
} from "@/lib/workstreamWorkspace";
import { generateIntegratedPlanProposal } from "@/lib/integratedPlanAi";
import { generateDeliverableProposal } from "@/lib/workstreamAi";
import {
  appendApprovedDocumentTreeMemory,
  buildApprovedDocumentTreeExamplesSummary,
  buildApprovedDocumentTreeMemoryEntry,
  findRelevantApprovedDocumentTreeMemories
} from "@/lib/aiTreeMemory";
import {
  buildTreeSpreadsheetPayloadFromAppBranch,
  normalizeTreeSpreadsheetPayload,
  parseSpreadsheetPayloadToTreeNodes,
  type SpreadsheetTreeNode
} from "@/lib/treeSpreadsheet";
import {
  buildProcedureSectionTree,
} from "@/lib/procedureDocument";
import {
  buildProcedureDocxBytes,
  buildProcedurePdfBytes
} from "@/lib/procedureExport";
import {
  ROOT_PARENT_ID,
  type AppNode,
  type ProjectSummary,
  type FolderNodeState,
  type ScheduleStatus,
  type MirrorStatus,
  type NAMatchResult,
  type ODEDeliverableProposal,
  type ODEIntegratedPlanProposal,
  type ODEImportPreview,
  type ODEChantierProfile,
  type ODEChantierStatus,
  type ODENodeKind,
  type ODEExecutionTaskItem,
  type ODENodeMetadata,
  type ODETraceMeta,
  type ODEStructuredDeliverable,
  type ODEWorkstreamSource,
  type ODEWorkstreamWorkspace,
  isFileLikeNode
} from "@/lib/types";
import { useExplorerStore } from "@/lib/useExplorerStore";
import { usePaneLayout } from "@/hooks/usePaneLayout";
import { useDraggableModalSurface } from "@/hooks/useDraggableModalSurface";
import { useDesktopMirrorSync } from "@/hooks/useDesktopMirrorSync";
import { useWorkspaceActions } from "@/hooks/useWorkspaceActions";
import { useMoveWorkspaceActions } from "@/hooks/useMoveWorkspaceActions";
import { useContextMenuActions } from "@/hooks/useContextMenuActions";
import {
  useBranchClipboardActions,
  type BranchClipboard,
  type BranchSnapshot,
  type ClipboardMutationResult,
  type ExecutionTaskClipboard,
  type ExecutionTaskClipboardItem
} from "@/hooks/useBranchClipboardActions";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import {
  QA_AUTOMATION_ITEM_IDS,
  buildOrderedQaChecklistItems,
  buildOrderedQaChecklistSections,
  buildQaChecklistAttachments,
  buildQaChecklistPdfExportData,
  clearQaChecklistProgress,
  getQaChecklistEntry,
  getReleaseCategoryLabel,
  normalizeQaFeedbackEntries,
  normalizeQaInputCategory,
  readQaChecklistProgress,
  readQaChecklistState,
  writeQaChecklistProgress,
  writeQaChecklistState,
  type QaChecklistAttachmentSource,
  type QaChecklistDisplayItem,
  type QaChecklistDisplaySection,
  type QaChecklistProgressState,
  type QaChecklistStatus,
  type QaChecklistStatusEntry
} from "@/lib/qaChecklistSupport";
import latestQaMeta from "../quality/reports/latest.json";
import releaseLogData from "../quality/release-log.json";
import qaFeedbackData from "../quality/qa-feedback.json";

type WorkspaceMode = "grid" | "timeline";
type DesktopViewMode = "grid" | "mindmap" | "details" | "procedure";
type MindMapOrientation = "horizontal" | "vertical";
type MindMapContentMode = "quick_access" | "node_tree";
type NodeStateFilter = "empty" | "filled" | "task" | "execution" | "data";
type WorkspaceFocusMode = "structure" | "data" | "execution";
type ExpansionContext = "organization" | "workarea" | "timeline";
type KeyboardSurface = "tree" | "grid" | "timeline" | "procedure";


type SelectionSurface = "tree" | "grid" | "timeline";
type WorkspaceStructureMutationScope = "organization" | "workarea" | "content";

type DesktopWindowRestoreBounds = {
  width: number;
  height: number;
  x: number;
  y: number;
  useNativeOuterBounds?: boolean;
};

type WindowsDesktopWindowBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type WindowsDesktopWindowLayoutState = {
  currentBounds: WindowsDesktopWindowBounds;
  monitorBounds: WindowsDesktopWindowBounds;
  workAreaBounds: WindowsDesktopWindowBounds;
};

type WindowsDesktopWindowFitOptions = {
  preferCenter?: boolean;
  fillWorkArea?: boolean;
  coverTaskbar?: boolean;
  margin?: number;
};

type DesktopWindowHeaderDragSession = {
  phase: "pending_restore" | "manual_move";
  startScreenX: number;
  startScreenY: number;
  latestScreenX: number;
  latestScreenY: number;
  headerOffsetY: number;
  pointerRatioX: number;
  workAreaBounds: WindowsDesktopWindowBounds | null;
  outerWidth: number;
  outerHeight: number;
  moveOffsetX: number;
  moveOffsetY: number;
  restoring: boolean;
};

type DesktopWindowWorkAreaFit = {
  currentInnerWidth: number;
  currentInnerHeight: number;
  currentOuterWidth: number;
  currentOuterHeight: number;
  currentX: number;
  currentY: number;
  targetInnerWidth: number;
  targetInnerHeight: number;
  targetOuterWidth: number;
  targetOuterHeight: number;
  targetX: number;
  targetY: number;
};

type TimelineDayRange = {
  week: number;
  weekYear: number;
  monthIndex: number;
  year: number;
  date: string;
  weekdayIndex: number;
  isWeekend: boolean;
  label: string;
};

type TreeRow = {
  id: string;
  node: AppNode;
  level: number;
  indexLabel: string;
  hasChildren: boolean;
};

type SidebarSearchResult = {
  id: string;
  node: AppNode;
  pathLabel: string;
};

type DropPosition = "before" | "inside" | "after";

type FavoriteGroup = {
  id: string;
  name: string;
};

type QuickAccessMindMapGroup = {
  id: string;
  name: string;
  nodes: AppNode[];
  synthetic?: boolean;
};

type UtilityPanelView = "release" | "help" | "qa";
type AiTesterProgressState = {
  current: number;
  total: number;
  itemId: string | null;
} | null;

type AiTesterRunSummary = {
  total: number;
  automatedCount: number;
  automatedPassed: number;
  automatedFailed: number;
  manualRemaining: number;
};

type AiTesterUiState = {
  busy: boolean;
  notice: string | null;
  error: string | null;
  progress: AiTesterProgressState;
};

type DocumentAdvisorStatus = "idle" | "analyzing" | "ready" | "error";
type DocumentAdvisorActionId =
  | "create_tree_structure"
  | "import_outline_tree"
  | "map_to_na"
  | "create_chantier_ai"
  | "wbs_from_section"
  | "wbs_from_document"
  | "document_review";
type DocumentAdvisorKind = "numbered_outline" | "structured_document" | "narrative_document" | "mixed_document";
type DocumentAdvisorAction = DocumentActionModalItem & {
  id: DocumentAdvisorActionId;
};
type DocumentAdvisorNAMatch = {
  code: string;
  label: string;
  pathLabel: string;
  confidence: number;
  candidates: Array<{
    code: string;
    label: string;
    pathLabel: string;
    score: number;
    reason: string;
  }>;
};
type WorkspaceNAAnchor = {
  code: string;
  label: string;
  path: string;
  confidence: number;
  candidates: Array<{
    code: string;
    label: string;
    path: string;
    score: number;
    reason: string;
  }>;
  target_project_id: string | null;
  target_project_name: string | null;
  target_node_id: string | null;
  target_path: string | null;
  ambiguous: boolean;
  matched_at: string;
  source: "document_advisor" | "manual";
};
type WorkspaceNATargetResolution = {
  node: AppNode | null;
  mode: "na_branch" | "workspace_root";
  pathLabel: string | null;
  ambiguous: boolean;
};
type DocumentAdvisorSection = {
  id: string;
  title: string;
  goal: string;
  level: number;
  startLineIndex: number;
  endLineIndex: number;
  lineCount: number;
  previewLines: string[];
};
type DocumentAdvisorAnalysis = {
  nodeId: string;
  nodeName: string;
  nodeType: AppNode["type"];
  documentKind: DocumentAdvisorKind;
  summary: string;
  lineCount: number;
  outlineLineCount: number;
  outlineCoverage: number;
  maxOutlineLevel: number;
  detectedLanguage: DocumentLanguageCode;
  detectedLanguageConfidence: number;
  previewLines: string[];
  sections: DocumentAdvisorSection[];
  naMatch: DocumentAdvisorNAMatch | null;
  naChantierReady: boolean;
  actions: DocumentAdvisorAction[];
};
type DocumentAdvisorTranslatedSection = {
  id: string;
  title: string;
  goal: string;
  previewLines: string[];
};
type DocumentAdvisorTranslatedReview = {
  nodeId: string;
  mode: DocumentTranslationMode;
  requestedLanguage: LanguageCode | null;
  targetLanguage: LanguageCode | null;
  applied: boolean;
  warning?: string;
  summary: string;
  previewLines: string[];
  sections: DocumentAdvisorTranslatedSection[];
};
type DocumentAdvisorTreeProposalMode = "outline" | "ai" | "fallback";
type DocumentAdvisorTreeProposalSourceMode =
  | "numbered_outline"
  | "document_structure"
  | "selected_document"
  | "selected_section"
  | "selected_sections";
type DocumentAdvisorTreeProposalSourceDocument = {
  node_id: string;
  name: string;
  type: AppNode["type"];
  section_title: string | null;
};
type DocumentAdvisorTreeProposal = {
  targetNodeId: string;
  goal: string;
  mode: DocumentAdvisorTreeProposalMode;
  baseResult: WBSResult;
  result: WBSResult;
  source: "llm" | "fallback";
  warning?: string;
  translationMode: DocumentTranslationMode;
  translationRequestedLanguage: LanguageCode | null;
  translationTargetLanguage: LanguageCode | null;
  detectedSourceLanguage: DocumentLanguageCode;
  translationApplied: boolean;
  translationWarning?: string;
  sourceMode: DocumentAdvisorTreeProposalSourceMode;
  sourceScope: "selected_document" | "selected_documents" | "selected_section" | "selected_sections";
  rootParentId: string | null;
  sourceDocuments: DocumentAdvisorTreeProposalSourceDocument[];
  sourceSelectionKey: string;
  refinementHistory: string[];
};

type ODEImportPreviewDialogState = {
  preview: ODEImportPreview;
  createAs: Extract<ODENodeKind, "chantier" | "task">;
  targetNodeName: string | null;
  targetPathLabel: string | null;
};
type MindMapTextPreviewState = {
  nodeId: string | null;
  status: "idle" | "loading" | "ready" | "error";
  text: string | null;
  error: string | null;
};
type MindMapPowerPointPreviewState = {
  nodeId: string | null;
  status: "idle" | "loading" | "ready" | "error";
  slidePaths: string[];
  error: string | null;
};

const BRANCH_CLIPBOARD_PREFIX = "ODETOOL_BRANCH_V1::";
const POWERPOINT_PREVIEW_EXTENSIONS = new Set(["ppt", "pptx", "pptm", "pps", "ppsx", "ppsm"]);
const SIDEBAR_DEFAULT_WIDTH = 410;
const SIDEBAR_COLLAPSED_WIDTH = 64;
const SIDEBAR_MIN_WIDTH = 180;
const MAIN_MIN_WIDTH = 260;
const LEGACY_MIRROR_FOLDER_NAMES = ["ODETool Box", "ODETool Business Management"] as const;
const MIRROR_FOLDER_NAME = "ODETool_Mirror";
const TIMELINE_NODE_PANEL_DEFAULT_WIDTH = 320;
const TIMELINE_NODE_PANEL_MIN_WIDTH = 210;
const TIMELINE_GRID_MIN_WIDTH = 280;
const TIMELINE_DAY_COLUMN_WIDTH = 24;
const TIMELINE_HEADER_HEIGHT = 78;
const TIMELINE_ROW_HEIGHT = 38;
const LANGUAGE_CODES: LanguageCode[] = ["FR", "EN", "DE", "ES"];
const FOLDER_NODE_STATE_ORDER: FolderNodeState[] = ["empty", "task_only", "data_only", "filled"];
const QA_FILE_OUTPUTS_ENABLED = false;
const DESKTOP_WINDOW_WORKAREA_MARGIN_PX = 10;
const DESKTOP_WINDOW_MAXIMIZE_MARGIN_PX = 0;
const DESKTOP_WINDOW_MAXIMIZED_TOLERANCE_PX = 24;
const DESKTOP_WINDOW_HEADER_DRAG_THRESHOLD_PX = 6;
const DESKTOP_WINDOW_HEADER_DRAG_DEFAULT_WIDTH_PX = 1280;
const DESKTOP_WINDOW_HEADER_DRAG_DEFAULT_HEIGHT_PX = 820;
const DESKTOP_WINDOW_HEADER_DRAG_MIN_WIDTH_PX = 960;
const DESKTOP_WINDOW_HEADER_DRAG_MIN_HEIGHT_PX = 640;
const SYSTEM_LANGUAGE_SYNC_POLL_INTERVAL_MS = 500;
const SYSTEM_LANGUAGE_SYNC_RETRY_DELAYS_MS = [0, 90, 180, 320, 520, 820] as const;

const AI_COMMAND_BAR_ENABLED = true;
const LEGACY_AI_SURFACE_ENABLED = false;
const DOCUMENT_REVIEW_SURFACE_ENABLED = true;
const AI_REBUILD_PANEL_VISIBLE = false;

function isWindowsDesktopPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    userAgentData?: {
      platform?: string;
    };
  };
  const platformHint = nav.userAgentData?.platform ?? nav.platform ?? nav.userAgent ?? "";
  return platformHint.toLowerCase().includes("win");
}

function getDesktopPointerScaleFactor(): number {
  if (typeof window === "undefined") return 1;
  return Math.max(1, window.devicePixelRatio || 1);
}

function toDesktopScreenPixels(value: number): number {
  return Math.round(value * getDesktopPointerScaleFactor());
}

function parseUtilityPanelView(value: string | null | undefined): UtilityPanelView | null {
  if (!value) return null;
  if (value === "release" || value === "help" || value === "qa") return value;
  return null;
}

function parseLanguageCodeFromQuery(value: string | null | undefined): LanguageCode | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (LANGUAGE_CODES.includes(upper)) return upper;
  try {
    const [canonical] = Intl.getCanonicalLocales(trimmed);
    return canonical || trimmed;
  } catch {
    return trimmed;
  }
}

function detectSystemLanguageCode(): LanguageCode {
  if (typeof navigator !== "undefined") {
    const navigatorLocales = Array.isArray(navigator.languages) ? navigator.languages : [];
    for (const locale of navigatorLocales) {
      const resolved = parseLanguageCodeFromQuery(locale);
      if (resolved) return resolved;
    }
    const navigatorLanguage = parseLanguageCodeFromQuery(navigator.language);
    if (navigatorLanguage) return navigatorLanguage;
  }

  try {
    const intlLocale = parseLanguageCodeFromQuery(Intl.DateTimeFormat().resolvedOptions().locale);
    if (intlLocale) return intlLocale;
  } catch {
    // Ignore locale detection issues and fall back to English.
  }

  return "EN";
}

type WindowsLanguageSnapshot = {
  inputLocale?: string | null;
  uiLocale?: string | null;
  cultureLocale?: string | null;
  preferredLocales?: string[] | null;
};

async function detectPreferredAppLanguage(): Promise<LanguageCode> {
  if (isWindowsDesktopPlatform()) {
    try {
      const snapshot = await callNative<WindowsLanguageSnapshot>("get_windows_language_snapshot");
      const candidates = [
        snapshot.inputLocale,
        ...(Array.isArray(snapshot.preferredLocales) ? snapshot.preferredLocales : []),
        snapshot.uiLocale,
        snapshot.cultureLocale
      ];
      for (const candidate of candidates) {
        const resolved = parseLanguageCodeFromQuery(candidate);
        if (resolved) return resolved;
      }
    } catch {
      // Fall back to browser locale detection when the native check is unavailable.
    }
  }

  return detectSystemLanguageCode();
}

const INTERNAL_NODE_DRAG_MIME = "application/x-odetool-node-id";
const ACTIVE_PROJECT_STORAGE_KEY = "odetool.activeProjectId.v1";
const DEFAULT_PROJECT_STORAGE_KEY = "odetool.defaultProjectId.v1";
const SIDEBAR_COLLAPSED_STORAGE_KEY = "odetool.sidebarCollapsed.v1";
const FAVORITE_GROUPS_STORAGE_KEY = "odetool.favoriteGroups.v1";
const ACTIVE_FAVORITE_GROUP_STORAGE_KEY = "odetool.favoriteGroup.active.v1";
const FAVORITE_GROUP_TREE_FILTER_STORAGE_KEY = "odetool.favoriteGroup.treeFilter.v1";
const SELECTED_FAVORITE_GROUPS_STORAGE_KEY = "odetool.favoriteGroup.selected.v1";
const WORKSPACE_ROOT_NUMBERING_STORAGE_KEY = "odetool.workspaceRootNumbering.v1";
const NODE_TOOLTIP_VISIBILITY_STORAGE_KEY = "odetool.nodeTooltips.visible.v1";
const WORKSPACE_NODE_TABS_STORAGE_KEY = "odetool.workspaceNodeTabs.v1";
const NODE_STATE_FILTER_PARENTS_STORAGE_KEY = "odetool.nodeStateFilter.parents.v1";
const TIMELINE_FILTER_PARENTS_STORAGE_KEY = "odetool.timelineFilter.parents.v1";
const FAVORITE_ALL_GROUP_ID = "__all__";
const IMAGE_PREVIEW_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg", "avif"]);
const VIDEO_PREVIEW_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "avi", "mkv"]);

type WorkspaceNodeTabEntry = {
  nodeId: string;
  lastSelectedNodeId: string | null;
};

type WorkspaceNodeTabSession = {
  openTabs: WorkspaceNodeTabEntry[];
  activeTabId: string | null;
};

type WorkspaceNodeTabSessions = Record<string, WorkspaceNodeTabSession>;

function readWorkspaceNodeTabSessions(): WorkspaceNodeTabSessions {
  try {
    const raw = localStorage.getItem(WORKSPACE_NODE_TABS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as WorkspaceNodeTabSessions;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function getPathFileName(path: string): string {
  const normalized = path.replace(/\\/g, "/").trim();
  if (!normalized) return "";
  const parts = normalized.split("/");
  return parts[parts.length - 1] ?? normalized;
}

function toAssistantActivityItems(events: AiTelemetryEvent[]): AiActivityItem[] {
  return events.map((item) => ({
    id: item.id,
    timestamp: item.timestamp,
    flow: item.flow,
    source: item.source,
    actionId: item.actionId,
    success: item.success,
    latencyMs: item.latencyMs,
    workspace: item.workspace,
    error: item.error,
    details: buildAiActivityDetails(item)
  }));
}

function serializeBranchClipboard(payload: BranchClipboard): string {
  return `${BRANCH_CLIPBOARD_PREFIX}${JSON.stringify(payload)}`;
}

function parseBranchClipboard(text: string): BranchClipboard | null {
  if (!text.startsWith(BRANCH_CLIPBOARD_PREFIX)) return null;
  const body = text.slice(BRANCH_CLIPBOARD_PREFIX.length);
  try {
    const parsed = JSON.parse(body) as Partial<BranchClipboard>;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.mode !== "copy" && parsed.mode !== "cut") return null;
    if (parsed.kind === "execution_tasks") {
      const executionClipboard = parsed as Partial<ExecutionTaskClipboard>;
      const items = Array.isArray(executionClipboard.items)
        ? executionClipboard.items.filter((item): item is ExecutionTaskClipboardItem => {
            if (!item || typeof item !== "object") return false;
            const task = item.task;
            return Boolean(
              typeof item.sourceNodeId === "string" &&
                item.sourceNodeId.trim().length > 0 &&
                typeof item.ownerNodeId === "string" &&
                item.ownerNodeId.trim().length > 0 &&
                typeof item.deliverableId === "string" &&
                item.deliverableId.trim().length > 0 &&
                typeof item.order === "number" &&
                task &&
                typeof task === "object" &&
                typeof task.id === "string" &&
                task.id.trim().length > 0 &&
                typeof task.title === "string" &&
                task.title.trim().length > 0
            );
          })
        : [];
      const sourceNodeIds = items.map((item) => item.sourceNodeId);
      if (items.length === 0 || sourceNodeIds.length === 0) return null;
      return {
        kind: "execution_tasks",
        mode: parsed.mode,
        sourceNodeId: sourceNodeIds[0],
        sourceNodeIds,
        items,
        copiedAt: typeof parsed.copiedAt === "number" ? parsed.copiedAt : Date.now(),
        sourceApp: "odetool-rebuild"
      };
    }
    const treeClipboard = parsed as Partial<BranchClipboard> & {
      root?: BranchSnapshot;
      roots?: BranchSnapshot[];
    };
    const sourceNodeIds = Array.isArray(parsed.sourceNodeIds)
      ? parsed.sourceNodeIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : typeof parsed.sourceNodeId === "string" && parsed.sourceNodeId
        ? [parsed.sourceNodeId]
        : [];
    const roots = Array.isArray(treeClipboard.roots)
      ? treeClipboard.roots.filter((item): item is BranchSnapshot => Boolean(item && typeof item === "object"))
      : treeClipboard.root && typeof treeClipboard.root === "object"
        ? [treeClipboard.root as BranchSnapshot]
        : [];
    if (sourceNodeIds.length === 0 || roots.length === 0 || sourceNodeIds.length !== roots.length) return null;
    return {
      kind: "branch",
      mode: parsed.mode,
      sourceNodeId: sourceNodeIds[0],
      sourceNodeIds,
      root: roots[0],
      roots,
      copiedAt: typeof parsed.copiedAt === "number" ? parsed.copiedAt : Date.now(),
      sourceApp: "odetool-rebuild"
    };
  } catch {
    return null;
  }
}

function normalizeFilePathToken(token: string): string | null {
  const trimmed = token.trim().replace(/^"+|"+$/g, "");
  if (!trimmed) return null;
  if (/^[a-zA-Z]:[\\/]/.test(trimmed) || /^\\\\[^\\]+\\[^\\]+/.test(trimmed)) {
    return trimmed.replace(/\//g, "\\");
  }
  if (trimmed.toLowerCase().startsWith("file:///")) {
    const decoded = decodeURIComponent(trimmed.replace(/^file:\/\/\//i, ""));
    if (/^[a-zA-Z]:[\\/]/.test(decoded)) {
      return decoded.replace(/\//g, "\\");
    }
  }
  return null;
}

function parseFilePathsFromClipboardText(text: string): string[] {
  if (!text.trim()) return [];

  const tokens: string[] = [];
  const quoted = text.match(/"([^"\r\n]+)"/g) ?? [];
  for (const match of quoted) {
    tokens.push(match);
  }
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  tokens.push(...lines);

  const dedupe = new Set<string>();
  const paths: string[] = [];
  for (const token of tokens) {
    const normalized = normalizeFilePathToken(token);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    paths.push(normalized);
  }
  return paths;
}

function isExternalFileDropData(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) return false;
  if ((dataTransfer.files?.length ?? 0) > 0) return true;
  const types = Array.from(dataTransfer.types ?? []);
  return types.includes("Files") || types.includes("text/uri-list");
}

function collectExternalFileDropPaths(dataTransfer: DataTransfer | null): string[] {
  if (!dataTransfer) return [];
  const dedupe = new Set<string>();
  const paths: string[] = [];

  const pushPath = (raw: string) => {
    const normalized = normalizeFilePathToken(raw);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (dedupe.has(key)) return;
    dedupe.add(key);
    paths.push(normalized);
  };

  for (const file of Array.from(dataTransfer.files ?? [])) {
    const maybePath = (file as File & { path?: string }).path;
    if (typeof maybePath === "string" && maybePath.trim().length > 0) {
      pushPath(maybePath);
    }
  }

  for (const item of Array.from(dataTransfer.items ?? [])) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile() as (File & { path?: string }) | null;
    const maybePath = file?.path;
    if (typeof maybePath === "string" && maybePath.trim().length > 0) {
      pushPath(maybePath);
    }
  }

  const uriList = dataTransfer.getData("text/uri-list");
  if (uriList) {
    for (const path of parseFilePathsFromClipboardText(uriList)) {
      pushPath(path);
    }
  }

  const plain = dataTransfer.getData("text/plain");
  if (plain) {
    for (const path of parseFilePathsFromClipboardText(plain)) {
      pushPath(path);
    }
  }

  return paths;
}

function buildExternalImportDedupKey(paths: string[], parentId: string | null): string {
  const dedupe = new Set<string>();
  const normalized = paths
    .map((path) => normalizeFilePathToken(path) ?? path.trim())
    .map((path) => path.trim())
    .filter((path) => path.length > 0)
    .filter((path) => {
      const key = path.toLowerCase();
      if (dedupe.has(key)) return false;
      dedupe.add(key);
      return true;
    })
    .sort((left, right) => left.localeCompare(right));

  return `${parentId ?? ROOT_PARENT_ID}::${normalized.join("|")}`;
}

function shouldIgnoreGlobalClipboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest("[data-ode-ignore-shortcuts='true']")) return true;
  if (target.isContentEditable || target.closest("[contenteditable='true']")) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function readClipboardDataPlainText(dataTransfer: DataTransfer | null | undefined): string {
  if (!dataTransfer) return "";
  const plain = dataTransfer.getData("text/plain");
  if (plain) return plain;
  const text = dataTransfer.getData("Text");
  if (text) return text;
  return "";
}

function getWbsSourceExcerptLimits(hasBaseline: boolean): {
  maxDocuments: number;
  maxTotalChars: number;
  maxExcerptChars: number;
  minExcerptChars: number;
} {
  return hasBaseline
    ? {
        maxDocuments: 4,
        maxTotalChars: 7000,
        maxExcerptChars: 1400,
        minExcerptChars: 450
      }
    : {
        maxDocuments: 5,
        maxTotalChars: 9000,
        maxExcerptChars: 1800,
        minExcerptChars: 600
      };
}

function parseNodeTimelineSchedule(node: AppNode): NodeTimelineSchedule | null {
  return parseTimelineScheduleFromNode(node, normalizeIsoDateOnlyInput);
}

function normalizeMirrorDisplayPath(path: string): string {
  if (!path) return path;
  let normalized = path;
  for (const legacyName of LEGACY_MIRROR_FOLDER_NAMES) {
    normalized = normalized.split(legacyName).join(MIRROR_FOLDER_NAME);
  }
  return normalized;
}

function buildTreeMaps(
  nodes: AppNode[],
  options?: { includeWorkspaceRootNumbering?: boolean }
): {
  byParent: Map<string, AppNode[]>;
  numbering: Map<string, string>;
} {
  const includeWorkspaceRootNumbering = options?.includeWorkspaceRootNumbering ?? false;
  const byParent = new Map<string, AppNode[]>();
  for (const node of nodes) {
    const bucket = byParent.get(node.parentId) ?? [];
    bucket.push(node);
    byParent.set(node.parentId, bucket);
  }
  for (const children of byParent.values()) {
    children.sort((a, b) => {
      const byOrder = (a.order ?? 0) - (b.order ?? 0);
      if (byOrder !== 0) return byOrder;
      return a.id.localeCompare(b.id);
    });
  }

  const numbering = new Map<string, string>();
  const consumesTreeNumbering = (node: AppNode): boolean =>
    !isFileLikeNode(node) && !isHiddenExecutionTaskNode(node);

  const walk = (parentId: string, prefix: string) => {
    const children = byParent.get(parentId) ?? [];
    let numberedIndex = 0;
    children.forEach((child) => {
      if (child.parentId === ROOT_PARENT_ID && !includeWorkspaceRootNumbering) {
        // Keep workspace roots unnumbered while still numbering descendants.
        walk(child.id, "");
      } else {
        const nextPrefix = consumesTreeNumbering(child)
          ? (() => {
              numberedIndex += 1;
              const label = prefix ? `${prefix}.${numberedIndex}` : `${numberedIndex}`;
              numbering.set(child.id, label);
              return label;
            })()
          : prefix;
        walk(child.id, nextPrefix);
      }
    });
  };

  walk(ROOT_PARENT_ID, "");
  return { byParent, numbering };
}

function extractFileExtensionLower(fileName: string): string {
  const trimmed = fileName.trim();
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot <= 0 || lastDot >= trimmed.length - 1) return "";
  return trimmed.slice(lastDot + 1).toLowerCase();
}

function normalizeProcedureExportFileName(value: string): string {
  const normalized = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.length > 0 ? normalized : "procedure";
}









function getNodeSizeBytes(node: AppNode): number | null {
  if (!isFileLikeNode(node)) return null;
  const raw = node.properties?.sizeBytes;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return raw;
  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "--";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const precision = size >= 100 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

function humanizeNodeType(nodeType: AppNode["type"]): string {
  return nodeType
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function formatNodeModified(updatedAt: number, language: LanguageCode): string {
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) return "--";
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return "--";
  try {
    return new Intl.DateTimeFormat(getLocaleForLanguage(language), {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function buildCopyNameWithSuffix(name: string, nodeType: AppNode["type"], copySuffix: string): string {
  const safeName = name.trim().length > 0 ? name.trim() : "Untitled";
  const suffix = copySuffix.trim();
  if (!suffix) return safeName;

  if (
    nodeType === "file" ||
    nodeType === "document" ||
    nodeType === "report" ||
    nodeType === "minutes"
  ) {
    const lastDot = safeName.lastIndexOf(".");
    if (lastDot > 0 && lastDot < safeName.length - 1) {
      const base = safeName.slice(0, lastDot);
      const ext = safeName.slice(lastDot);
      return `${base} ${suffix}${ext}`;
    }
  }

  return `${safeName} ${suffix}`;
}

function isSpellTokenChar(char: string): boolean {
  return /[\p{L}\p{M}'’-]/u.test(char);
}

function resolveInlineEditSpellTarget(
  value: string,
  selectionStart: number,
  selectionEnd: number
): { word: string; start: number; end: number } | null {
  if (selectionEnd > selectionStart) {
    const selectedWord = value.slice(selectionStart, selectionEnd).trim();
    if (/^[\p{L}\p{M}'’-]{2,}$/u.test(selectedWord)) {
      return {
        word: selectedWord,
        start: selectionStart,
        end: selectionEnd
      };
    }
  }

  let start = Math.max(0, selectionStart);
  let end = Math.max(start, selectionStart);
  while (start > 0 && isSpellTokenChar(value.charAt(start - 1))) {
    start -= 1;
  }
  while (end < value.length && isSpellTokenChar(value.charAt(end))) {
    end += 1;
  }

  const word = value.slice(start, end).trim();
  if (word.length < 2 || !/\p{L}/u.test(word)) return null;
  return { word, start, end };
}


export default function App() {
  const utilityPanelFromQuery = useMemo<UtilityPanelView | null>(() => {
    if (typeof window === "undefined") return null;
    return parseUtilityPanelView(new URLSearchParams(window.location.search).get("utility"));
  }, []);
  const languageFromQuery = useMemo<LanguageCode | null>(() => {
    if (typeof window === "undefined") return null;
    return parseLanguageCodeFromQuery(new URLSearchParams(window.location.search).get("lang"));
  }, []);
  const isUtilityPanelWindow = utilityPanelFromQuery !== null;
  const store = useExplorerStore();
  const [appWindow, setAppWindow] = useState<TauriWindow | null>(null);
  const [isDesktopRuntime, setIsDesktopRuntime] = useState(false);
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("grid");
  const [desktopViewMode, setDesktopViewMode] = useState<DesktopViewMode>("grid");
  const [documentationModeActive, setDocumentationModeActive] = useState(false);
  const [activeChantierStatusFilter, setActiveChantierStatusFilter] = useState<"all" | ODEChantierStatus>("all");
  const [mindMapOrientation, setMindMapOrientation] = useState<MindMapOrientation>("horizontal");
  const [mindMapContentMode, setMindMapContentMode] = useState<MindMapContentMode>("quick_access");
  const [executionQuickOpenRequestKey, setExecutionQuickOpenRequestKey] = useState(0);
  const [executionQuickOpenDeliverableId, setExecutionQuickOpenDeliverableId] = useState<string | null>(null);
  const [activeNodeStateFilters, setActiveNodeStateFilters] = useState<Set<NodeStateFilter>>(() => createAllNodeStateFilters());
  const [includeNodeStateFilterParents, setIncludeNodeStateFilterParents] = useState<boolean>(() => {
    const raw = localStorage.getItem(NODE_STATE_FILTER_PARENTS_STORAGE_KEY);
    return raw === "1";
  });
  const [activeTimelineStatusFilters, setActiveTimelineStatusFilters] = useState<Set<ScheduleStatus>>(
    () => createAllTimelineStatusFilters()
  );
  const [activeTimelinePriorityFilters, setActiveTimelinePriorityFilters] = useState<Set<TimelinePriority>>(
    () => createAllTimelinePriorityFilters()
  );
  const [prioritizeFlaggedTimelineTasks, setPrioritizeFlaggedTimelineTasks] = useState(false);
  const [includeTimelineFilterParents, setIncludeTimelineFilterParents] = useState<boolean>(() => {
    const raw = localStorage.getItem(TIMELINE_FILTER_PARENTS_STORAGE_KEY);
    return raw === "1";
  });
  const [assistantActivityItems, setAssistantActivityItems] = useState<AiActivityItem[]>(() =>
    toAssistantActivityItems(readAiTelemetryEvents(10))
  );
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [assistantDeliverableProposalState, setAssistantDeliverableProposalState] = useState<{
    targetNodeId: string;
    nodeTitle: string;
    proposal: ODEDeliverableProposal;
  } | null>(null);
  const [assistantIntegratedPlanProposalState, setAssistantIntegratedPlanProposalState] = useState<{
    targetNodeId: string;
    nodeTitle: string;
    proposal: ODEIntegratedPlanProposal;
  } | null>(null);
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false);
  const [lastQaResult, setLastQaResult] = useState<QualityGateResult | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(utilityPanelFromQuery === "release");
  const [helpOpen, setHelpOpen] = useState(utilityPanelFromQuery === "help");
  const [qaChecklistOpen, setQaChecklistOpen] = useState(utilityPanelFromQuery === "qa");
  const [qaChecklistStateById, setQaChecklistStateById] = useState<Record<string, QaChecklistStatusEntry>>(() =>
    readQaChecklistState()
  );
  const [qaLearningRuns, setQaLearningRuns] = useState<AiQaLearningRun[]>(() => readAiQaLearningRuns());
  const [qaAutoRunState, setQaAutoRunState] = useState<AiQaAutoRunState>(() => readAiQaAutoRunState());
  const [aiTesterState, setAiTesterState] = useState<AiTesterUiState>({
    busy: false,
    notice: null,
    error: null,
    progress: null
  });
  const [latestAiExecutionReport, setLatestAiExecutionReport] = useState<AiQaExecutionReport | null>(null);
  const [deleteConfirmMessage, setDeleteConfirmMessage] = useState("");
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleModalNodeId, setScheduleModalNodeId] = useState<string | null>(null);
  const [organizationExpandedIds, setOrganizationExpandedIds] = useState<Set<string>>(new Set());
  const [workareaExpandedIds, setWorkareaExpandedIds] = useState<Set<string>>(new Set());
  const [timelineExpandedIds, setTimelineExpandedIds] = useState<Set<string>>(new Set());
  const currentExpansionContext: ExpansionContext =
    workspaceMode === "timeline"
      ? "timeline"
      : deriveWorkspaceFocusMode(activeNodeStateFilters) === "execution"
        ? "workarea"
        : "organization";
  const expandedIds =
    currentExpansionContext === "timeline"
      ? timelineExpandedIds
      : currentExpansionContext === "workarea"
        ? workareaExpandedIds
        : organizationExpandedIds;
  const updateExpandedIdsForContext = useCallback(
    (context: ExpansionContext, action: SetStateAction<Set<string>>) => {
      const resolveNextExpandedIds = (current: Set<string>) =>
        typeof action === "function" ? (action as (previous: Set<string>) => Set<string>)(current) : action;

      if (context === "timeline") {
        setTimelineExpandedIds((current) => resolveNextExpandedIds(current));
        return;
      }
      if (context === "workarea") {
        setWorkareaExpandedIds((current) => resolveNextExpandedIds(current));
        return;
      }
      setOrganizationExpandedIds((current) => resolveNextExpandedIds(current));
    },
    []
  );
  const setExpandedIds = useCallback(
    (action: SetStateAction<Set<string>>) => {
      updateExpandedIdsForContext(currentExpansionContext, action);
    },
    [currentExpansionContext, updateExpandedIdsForContext]
  );
  const [timelineYear, setTimelineYear] = useState(new Date().getFullYear());
  const [language, setLanguage] = useState<LanguageCode>(() => languageFromQuery ?? detectSystemLanguageCode());
  const [mirrorStatus, setMirrorStatus] = useState<MirrorStatus>({ kind: "syncing" });
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [defaultProjectId, setDefaultProjectId] = useState<string | null>(() =>
    localStorage.getItem(DEFAULT_PROJECT_STORAGE_KEY)
  );
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() =>
    localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY) ?? localStorage.getItem(DEFAULT_PROJECT_STORAGE_KEY)
  );
  const [hasInitializedProjects, setHasInitializedProjects] = useState(false);
  const [hasResolvedInitialWorkspaceView, setHasResolvedInitialWorkspaceView] = useState(false);
  const [workspaceRootNumberingEnabled, setWorkspaceRootNumberingEnabled] = useState<boolean>(() => {
    const raw = localStorage.getItem(WORKSPACE_ROOT_NUMBERING_STORAGE_KEY);
    if (raw === null) return false;
    return raw === "1" || raw.toLowerCase() === "true";
  });
  const [nodeTooltipsEnabled, setNodeTooltipsEnabled] = useState<boolean>(() => {
    const raw = localStorage.getItem(NODE_TOOLTIP_VISIBILITY_STORAGE_KEY);
    if (raw === null) return true;
    return raw === "1" || raw.toLowerCase() === "true";
  });
  const [workspaceNodeTabSessions, setWorkspaceNodeTabSessions] = useState<WorkspaceNodeTabSessions>(() =>
    readWorkspaceNodeTabSessions()
  );
  const [favoriteGroups, setFavoriteGroups] = useState<FavoriteGroup[]>(() => {
    try {
      const raw = localStorage.getItem(FAVORITE_GROUPS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Array<Partial<FavoriteGroup>>;
      if (!Array.isArray(parsed)) return [];
      const dedupe = new Set<string>();
      const groups: FavoriteGroup[] = [];
      for (const item of parsed) {
        const id = typeof item?.id === "string" ? item.id.trim() : "";
        const name = typeof item?.name === "string" ? item.name.trim() : "";
        if (!id || !name || dedupe.has(id)) continue;
        dedupe.add(id);
        groups.push({ id, name });
      }
      return groups;
    } catch {
      return [];
    }
  });
  const [activeFavoriteGroupId, setActiveFavoriteGroupId] = useState<string>(
    () => localStorage.getItem(ACTIVE_FAVORITE_GROUP_STORAGE_KEY) ?? FAVORITE_ALL_GROUP_ID
  );
  const [selectedFavoriteGroupIds, setSelectedFavoriteGroupIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(SELECTED_FAVORITE_GROUPS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        return normalizeFavoriteGroupIds(parsed);
      }
    } catch {
      // Fall back to the legacy single-group filter state.
    }

    const rawTreeFilter = localStorage.getItem(FAVORITE_GROUP_TREE_FILTER_STORAGE_KEY);
    const favoriteTreeFilterEnabled =
      rawTreeFilter === "1" || rawTreeFilter?.toLowerCase() === "true";
    const activeGroupId =
      localStorage.getItem(ACTIVE_FAVORITE_GROUP_STORAGE_KEY) ?? FAVORITE_ALL_GROUP_ID;
    return favoriteTreeFilterEnabled && activeGroupId !== FAVORITE_ALL_GROUP_ID ? [activeGroupId] : [];
  });
  const [favoriteGroupTreeFilterEnabled, setFavoriteGroupTreeFilterEnabled] = useState<boolean>(() => {
    const raw = localStorage.getItem(FAVORITE_GROUP_TREE_FILTER_STORAGE_KEY);
    if (raw === null) return false;
    return raw === "1" || raw.toLowerCase() === "true";
  });
  const [favoriteGroupModalOpen, setFavoriteGroupModalOpen] = useState(false);
  const [favoriteGroupSettingsModalOpen, setFavoriteGroupSettingsModalOpen] = useState(false);
  const [favoriteGroupNameInput, setFavoriteGroupNameInput] = useState("");
  const [favoriteGroupEditingId, setFavoriteGroupEditingId] = useState<string | null>(null);
  const [favoriteGroupTargetNodeIds, setFavoriteGroupTargetNodeIds] = useState<string[]>([]);
  const [favoriteAssignModalOpen, setFavoriteAssignModalOpen] = useState(false);
  const [favoriteAssignNodeIds, setFavoriteAssignNodeIds] = useState<string[]>([]);
  const [favoriteAssignGroupStates, setFavoriteAssignGroupStates] = useState<
    Record<string, FavoriteGroupSelectionState>
  >({});
  const [documentAdvisorOpen, setDocumentAdvisorOpen] = useState(false);
  const [documentAdvisorStatus, setDocumentAdvisorStatus] = useState<DocumentAdvisorStatus>("idle");
  const [documentAdvisorAnalysis, setDocumentAdvisorAnalysis] = useState<DocumentAdvisorAnalysis | null>(null);
  const [documentAdvisorSelectedSectionId, setDocumentAdvisorSelectedSectionId] = useState("");
  const [documentAdvisorError, setDocumentAdvisorError] = useState<string | null>(null);
  const [documentAdvisorActionRunning, setDocumentAdvisorActionRunning] = useState(false);
  const [documentAdvisorTreeProposal, setDocumentAdvisorTreeProposal] = useState<DocumentAdvisorTreeProposal | null>(null);
  const [documentAdvisorTreeProposalBusy, setDocumentAdvisorTreeProposalBusy] = useState(false);
  const [documentAdvisorTreeProposalError, setDocumentAdvisorTreeProposalError] = useState<string | null>(null);
  const [documentAdvisorTreeProposalPrompt, setDocumentAdvisorTreeProposalPrompt] = useState("");
  const [documentAdvisorTranslatedReview, setDocumentAdvisorTranslatedReview] =
    useState<DocumentAdvisorTranslatedReview | null>(null);
  const [documentAdvisorReviewTranslationBusy, setDocumentAdvisorReviewTranslationBusy] = useState(false);
  const [documentAdvisorTranslationMode, setDocumentAdvisorTranslationMode] = useState<DocumentTranslationMode>("auto");
  const [documentAdvisorManualTranslationLanguage, setDocumentAdvisorManualTranslationLanguage] =
    useState<LanguageCode>(language);
  const [naWorkspaceModalOpen, setNaWorkspaceModalOpen] = useState(false);
  const [naWorkspaceOwnerNodeId, setNaWorkspaceOwnerNodeId] = useState<string | null>(null);
  const [naWorkspaceTargetProjectId, setNaWorkspaceTargetProjectId] = useState("");
  const [naDistributionModalOpen, setNaDistributionModalOpen] = useState(false);
  const [naDistributionOwnerNodeId, setNaDistributionOwnerNodeId] = useState<string | null>(null);
  const [naDistributionSourceNodeIds, setNaDistributionSourceNodeIds] = useState<string[]>([]);
  const [naDistributionBusy, setNaDistributionBusy] = useState(false);
  const [odeImportPreviewState, setOdeImportPreviewState] = useState<ODEImportPreviewDialogState | null>(null);
  const [mindMapTextPreviewState, setMindMapTextPreviewState] = useState<MindMapTextPreviewState>({
    nodeId: null,
    status: "idle",
    text: null,
    error: null
  });
  const [mindMapPowerPointPreviewState, setMindMapPowerPointPreviewState] = useState<MindMapPowerPointPreviewState>({
    nodeId: null,
    status: "idle",
    slidePaths: [],
    error: null
  });
  const [mindMapReviewNodeId, setMindMapReviewNodeId] = useState<string | null>(null);
  const odeImportPreviewResolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const [workspaceNameInput, setWorkspaceNameInput] = useState("");
  const [workspaceLocalPathInput, setWorkspaceLocalPathInput] = useState("");
  const [workspaceCreateInlineOpen, setWorkspaceCreateInlineOpen] = useState(false);
  const [projectPathInput, setProjectPathInput] = useState("");

  useEffect(() => {
    if (!AI_COMMAND_BAR_ENABLED) {
      if (commandBarOpen) setCommandBarOpen(false);
      if (assistantDeliverableProposalState) setAssistantDeliverableProposalState(null);
      if (assistantIntegratedPlanProposalState) setAssistantIntegratedPlanProposalState(null);
    }
    if (!LEGACY_AI_SURFACE_ENABLED && settingsOpen) setSettingsOpen(false);
    if (!DOCUMENT_REVIEW_SURFACE_ENABLED && documentAdvisorOpen) setDocumentAdvisorOpen(false);
  }, [
    assistantDeliverableProposalState,
    assistantIntegratedPlanProposalState,
    commandBarOpen,
    settingsOpen,
    documentAdvisorOpen
  ]);
  const [isWorkspaceCreating, setIsWorkspaceCreating] = useState(false);
  const [isProjectImporting, setIsProjectImporting] = useState(false);
  const [isProjectResyncing, setIsProjectResyncing] = useState(false);
  const [isWorkspaceRepairing, setIsWorkspaceRepairing] = useState(false);
  const [isProjectDeleting, setIsProjectDeleting] = useState(false);
  const [workspaceExternalChangeCount, setWorkspaceExternalChangeCount] = useState(0);
  const [isWorkspaceExternalChangeChecking, setIsWorkspaceExternalChangeChecking] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectNotice, setProjectNotice] = useState<string | null>(null);
  const [procedureBranchExportState, setProcedureBranchExportState] = useState<"idle" | "pdf" | "word">("idle");
  const [workspaceManageError, setWorkspaceManageError] = useState<string | null>(null);
  const [workspaceManageNotice, setWorkspaceManageNotice] = useState<string | null>(null);
  const [aiRebuildStatus, setAiRebuildStatus] = useState<AiRebuildStatus | null>(null);
  const [aiRebuildStatusBusy, setAiRebuildStatusBusy] = useState(false);
  const [aiRebuildWorkflowBusy, setAiRebuildWorkflowBusy] = useState(false);
  const [aiRebuildError, setAiRebuildError] = useState<string | null>(null);
  const [aiRebuildWorkspaceOverview, setAiRebuildWorkspaceOverview] = useState<WorkspaceOverviewOutput | null>(null);
  const [aiRebuildKnowledgeSnapshot, setAiRebuildKnowledgeSnapshot] = useState<KnowledgeSnapshotOutput | null>(null);
  const [aiRebuildDocumentIngestion, setAiRebuildDocumentIngestion] = useState<DocumentIngestionPreviewOutput | null>(null);
  const [aiRebuildDocumentStore, setAiRebuildDocumentStore] = useState<DocumentRecordStoreOutput | null>(null);
  const [aiRebuildWorkspaceKnowledgeSummary, setAiRebuildWorkspaceKnowledgeSummary] =
    useState<WorkspaceKnowledgeSummaryOutput | null>(null);
  const [aiRebuildKnowledgeRetrieval, setAiRebuildKnowledgeRetrieval] =
    useState<KnowledgeRetrievalPreviewOutput | null>(null);
  const [aiRebuildActionPlan, setAiRebuildActionPlan] = useState<ActionPlanPreviewOutput | null>(null);
  const [aiRebuildApprovalQueue, setAiRebuildApprovalQueue] = useState<ApprovalQueuePreviewOutput | null>(null);
  const [aiRebuildExecutionPacket, setAiRebuildExecutionPacket] = useState<ExecutionPacketPreviewOutput | null>(null);
  const [aiRebuildFinalSolution, setAiRebuildFinalSolution] = useState<FinalAiSolutionOutput | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingSurface, setEditingSurface] = useState<SelectionSurface | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [tooltipEditorNodeId, setTooltipEditorNodeId] = useState<string | null>(null);
  const [tooltipEditorValue, setTooltipEditorValue] = useState("");
  const [tooltipEditorSaving, setTooltipEditorSaving] = useState(false);
  const [quickAppsModalNodeId, setQuickAppsModalNodeId] = useState<string | null>(null);
  const [quickAppsDraftItems, setQuickAppsDraftItems] = useState<NodeQuickAppItem[]>([]);
  const [quickAppsSaving, setQuickAppsSaving] = useState(false);
  const [desktopUploadSessionActive, setDesktopUploadSessionActive] = useState(false);
  const [textEditContextMenu, setTextEditContextMenu] = useState<TextEditContextMenuState | null>(null);
  const [branchClipboard, setBranchClipboard] = useState<BranchClipboard | null>(null);
  const [canPasteBranch, setCanPasteBranch] = useState(false);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{ targetId: string; position: DropPosition } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [searchActiveIndex, setSearchActiveIndex] = useState(0);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
  const [selectionSurface, setSelectionSurface] = useState<SelectionSurface>("grid");
  const [keyboardSurface, setKeyboardSurface] = useState<KeyboardSurface>("grid");
  const [procedureFieldEditorTargetNodeId, setProcedureFieldEditorTargetNodeId] = useState<string | null>(null);
  const editActionInFlightRef = useRef(false);
  const appWindowRef = useRef<TauriWindow | null>(null);
  const desktopWindowRestoreBoundsRef = useRef<DesktopWindowRestoreBounds | null>(null);
  const desktopWindowHeaderDragRef = useRef<DesktopWindowHeaderDragSession | null>(null);
  const desktopWindowHeaderDragFrameRef = useRef<number | null>(null);
  const systemLanguageSyncTimeoutIdsRef = useRef<number[]>([]);
  const openNodeInWorkareaRef = useRef<
    ((targetNodeId?: string | null, options?: { deliverableId?: string | null; openExecution?: boolean }) => Promise<void>) | null
  >(null);
  const inlineEditInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const pendingInlineEditSelectionRef = useRef<{
    nodeId: string;
    surface: SelectionSurface;
    start: number;
    end: number;
  } | null>(null);
  const provisionalInlineCreateByNodeIdRef = useRef<Map<string, ProvisionalInlineCreateState>>(new Map());
  const branchClipboardRef = useRef<BranchClipboard | null>(branchClipboard);
  const draggingNodeIdRef = useRef<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const autoScheduleSyncInFlightRef = useRef(false);
  const workstreamProjectionRepairInFlightRef = useRef(false);
  const workstreamProjectionRepairSignatureRef = useRef<string | null>(null);
  const deleteConfirmResolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const activeExternalImportKeysRef = useRef<Set<string>>(new Set());
  const recentExternalImportRef = useRef<{ key: string; handledAt: number } | null>(null);
  const pendingDesktopUploadTargetIdRef = useRef<string | null>(null);
  const importExternalFilesToNodeRef = useRef<
    (sourcePaths: string[], targetNodeId?: string | null, surface?: SelectionSurface) => Promise<boolean>
  >(async () => false);
  const activeProjectIdRef = useRef<string | null>(activeProjectId);
  const activeProjectRootIdRef = useRef<string | null>(null);
  const currentFolderIdRef = useRef<string | null>(store.currentFolderId);
  const selectedNodeIdRef = useRef<string | null>(store.selectedNodeId);
  const favoriteGroupAssignmentSignatureRef = useRef<string | null>(null);
  const favoriteGroupAssignmentConsumedSignatureRef = useRef<string | null>(null);
  const workspaceModeRef = useRef<WorkspaceMode>(workspaceMode);
  const desktopViewModeRef = useRef<DesktopViewMode>(desktopViewMode);
  const desktopBrowseViewModeRef = useRef<DesktopViewMode>(desktopViewMode === "procedure" ? "grid" : desktopViewMode);
  const documentationPreviousNodeStateFiltersRef = useRef<Set<NodeStateFilter> | null>(null);
  const restoredWorkspaceNodeTabsRef = useRef<string | null>(null);
  const selectionSurfaceRef = useRef<SelectionSurface>(selectionSurface);
  const keyboardSurfaceRef = useRef<KeyboardSurface>(keyboardSurface);
  const lastAppliedFilterViewSignatureRef = useRef<string | null>(null);
  const editingSurfaceRef = useRef<SelectionSurface | null>(editingSurface);
  const commandBarOpenRef = useRef<boolean>(commandBarOpen);
  const procedureRootNodeIdRef = useRef<string | null>(null);
  const procedureSelectedNodeIdRef = useRef<string | null>(null);
  const editingNodeIdRef = useRef<string | null>(editingNodeId);
  const editingValueRef = useRef<string>(editingValue);
  const activeTimelineStatusFiltersRef = useRef<Set<ScheduleStatus>>(new Set(activeTimelineStatusFilters));
  const includeTimelineFilterParentsRef = useRef<boolean>(includeTimelineFilterParents);
  const displayedTimelineRowsRef = useRef<TreeRow[]>([]);
  const aiTesterBusyRef = useRef(false);
  const qaChecklistStateSnapshotRef = useRef<Record<string, QaChecklistStatusEntry>>(qaChecklistStateById);
  const qaAutomationLearningSkipRef = useRef<Set<string>>(new Set());
  const aiTesterSessionAutoRunKeyRef = useRef<string | null>(null);
  const workspaceRootSignatureRef = useRef<string | null>(null);
  const {
    isLargeLayout,
    sidebarWidth,
    setSidebarWidth,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    isResizingSidebar,
    clampSidebarWidth,
    startSidebarResize,
    nudgeSidebarWidth,
    timelineNodePanelWidth,
    setTimelineNodePanelWidth,
    isResizingTimelinePanel,
    clampTimelineNodePanelWidth,
    startTimelinePanelResize,
    nudgeTimelineNodePanelWidth,
    timelineLeftScrollRef,
    timelineRightScrollRef,
    syncTimelineVerticalScroll
  } = usePaneLayout({
    sidebarDefaultWidth: SIDEBAR_DEFAULT_WIDTH,
    sidebarCollapsedStorageKey: SIDEBAR_COLLAPSED_STORAGE_KEY,
    sidebarMinWidth: SIDEBAR_MIN_WIDTH,
    mainMinWidth: MAIN_MIN_WIDTH,
    timelineNodePanelDefaultWidth: TIMELINE_NODE_PANEL_DEFAULT_WIDTH,
    timelineNodePanelMinWidth: TIMELINE_NODE_PANEL_MIN_WIDTH,
    timelineGridMinWidth: TIMELINE_GRID_MIN_WIDTH
  });
  const t = (key: string, params?: TranslationParams) => translate(language, key, params);
  const hasBlockingOverlayOpen =
    settingsOpen ||
    workspaceSettingsOpen ||
    deleteConfirmOpen ||
    releaseNotesOpen ||
    helpOpen ||
    qaChecklistOpen ||
    scheduleModalOpen ||
    favoriteGroupModalOpen ||
    favoriteAssignModalOpen ||
    Boolean(quickAppsModalNodeId) ||
    documentAdvisorOpen ||
    naWorkspaceModalOpen ||
    naDistributionModalOpen;
  const qaChecklistSummary = useMemo(() => {
    let pending = 0;
    let passed = 0;
    let failed = 0;
    for (const item of REGRESSION_CHECKLIST_ITEMS) {
      const entry = getQaChecklistEntry(qaChecklistStateById, item.id);
      if (entry.status === "passed") {
        passed += 1;
      } else if (entry.status === "failed") {
        failed += 1;
      } else {
        pending += 1;
      }
    }
    return { total: REGRESSION_CHECKLIST_ITEMS.length, pending, passed, failed };
  }, [qaChecklistStateById]);
  const qaChecklistHealth: "pending" | "passed" | "failed" =
    qaChecklistSummary.failed > 0 ? "failed" : qaChecklistSummary.pending > 0 ? "pending" : "passed";
  const qaReleaseEntries = useMemo(() => releaseLogData.entries ?? [], []);
  const qaFeedbackEntries = useMemo(() => normalizeQaFeedbackEntries(qaFeedbackData.entries), []);
  const qaPlannerStateById = useMemo(() => {
    const next: Record<
      string,
      {
        status: QaChecklistStatus;
        checkedAt: string | null;
        failureReason: string;
        attachmentsCount: number;
      }
    > = {};
    for (const item of REGRESSION_CHECKLIST_ITEMS) {
      const entry = getQaChecklistEntry(qaChecklistStateById, item.id);
      next[item.id] = {
        status: entry.status,
        checkedAt: entry.checkedAt,
        failureReason: entry.failureReason,
        attachmentsCount: entry.attachments.length
      };
    }
    return next;
  }, [qaChecklistStateById]);
  const qaAiPlan = useMemo(
    () =>
      buildAiQaPlan({
        items: REGRESSION_CHECKLIST_ITEMS,
        checklistStateById: qaPlannerStateById,
        learningRuns: qaLearningRuns,
        releaseEntries: qaReleaseEntries,
        feedbackEntries: qaFeedbackEntries,
        latestQaMeta,
        automatableItemIds: QA_AUTOMATION_ITEM_IDS
      }),
    [qaFeedbackEntries, qaLearningRuns, qaPlannerStateById, qaReleaseEntries]
  );
  const latestAiReportItemById = useMemo(
    () => new Map((latestAiExecutionReport?.items ?? []).map((item) => [item.itemId, item])),
    [latestAiExecutionReport]
  );

  const setQaChecklistStatus = (itemId: string, status: QaChecklistStatus) => {
    setQaChecklistStateById((current) => {
      const previous = getQaChecklistEntry(current, itemId);
      const nextCheckedAt = status === "pending" ? null : new Date().toISOString();
      if (previous.status === status && previous.checkedAt === nextCheckedAt) return current;
      const next = {
        ...current,
        [itemId]: {
          ...previous,
          status,
          checkedAt: nextCheckedAt
        }
      };
      qaChecklistStateSnapshotRef.current = next;
      return next;
    });
  };

  const setQaChecklistFailureReason = (itemId: string, reason: string) => {
    setQaChecklistStateById((current) => {
      const previous = getQaChecklistEntry(current, itemId);
      if (previous.failureReason === reason) return current;
      const next = {
        ...current,
        [itemId]: {
          ...previous,
          failureReason: reason
        }
      };
      qaChecklistStateSnapshotRef.current = next;
      return next;
    });
  };

  const addQaChecklistAttachments = (
    itemId: string,
    paths: string[],
    source: QaChecklistAttachmentSource
  ) => {
    setQaChecklistStateById((current) => {
      const previous = getQaChecklistEntry(current, itemId);
      const nextAttachments = buildQaChecklistAttachments(previous.attachments, paths, source);
      if (nextAttachments === previous.attachments) return current;
      const next = {
        ...current,
        [itemId]: {
          ...previous,
          attachments: nextAttachments
        }
      };
      qaChecklistStateSnapshotRef.current = next;
      return next;
    });
  };

  const removeQaChecklistAttachment = (itemId: string, attachmentId: string) => {
    setQaChecklistStateById((current) => {
      const previous = getQaChecklistEntry(current, itemId);
      const nextAttachments = previous.attachments.filter((attachment) => attachment.id !== attachmentId);
      if (nextAttachments.length === previous.attachments.length) return current;
      const next = {
        ...current,
        [itemId]: {
          ...previous,
          attachments: nextAttachments
        }
      };
      qaChecklistStateSnapshotRef.current = next;
      return next;
    });
  };

  const resetQaChecklist = () => {
    setQaChecklistStateById({});
    qaChecklistStateSnapshotRef.current = {};
    clearQaChecklistProgress();
  };

  useEffect(() => {
    const previousState = qaChecklistStateSnapshotRef.current;
    const focusedReleaseIds = qaAiPlan.releaseEntries.map((entry) => entry.id);
    const workspaceLabel =
      projects.find((project) => project.id === activeProjectId)?.name ?? translate(language, "project.none");

    for (const item of REGRESSION_CHECKLIST_ITEMS) {
      if (qaAutomationLearningSkipRef.current.has(item.id)) {
        continue;
      }
      const previousEntry = getQaChecklistEntry(previousState, item.id);
      const nextEntry = getQaChecklistEntry(qaChecklistStateById, item.id);
      if (previousEntry.status === nextEntry.status) {
        continue;
      }
      if (nextEntry.status === "pending") {
        continue;
      }
      recordAiQaLearningEvent({
        itemId: item.id,
        status: nextEntry.status,
        source: "manual",
        workspace: workspaceLabel,
        releaseIds: focusedReleaseIds,
        attachmentsCount: nextEntry.attachments.length,
        failureReasonProvided: nextEntry.failureReason.trim().length > 0,
        latencyMs: null,
        automationId: null
      });
    }

    qaChecklistStateSnapshotRef.current = qaChecklistStateById;
  }, [activeProjectId, language, projects, qaAiPlan.releaseEntries, qaChecklistStateById]);

  const writeQaAutomationProof = async (itemId: string, status: "passed" | "failed", lines: string[]) => {
    void itemId;
    void status;
    void lines;
    return "";
  };

  const restoreQaAutomationViewState = async (
    folderId: string | null,
    selectedId: string | null,
    surface: SelectionSurface,
    mode: WorkspaceMode,
    desktopMode: DesktopViewMode
  ) => {
    setWorkspaceMode(mode);
    setDesktopViewMode(desktopMode);

    const restoreFolderId = folderId && (await getNode(folderId)) ? folderId : activeProjectRootId ?? null;
    await store.navigateTo(restoreFolderId);

    const restoreSelectedId = selectedId && (await getNode(selectedId)) ? selectedId : restoreFolderId;
    if (restoreSelectedId) {
      setPrimarySelection(restoreSelectedId, surface);
    } else {
      setPrimarySelection(null, surface);
    }
  };

  const captureQaAutomationFailureEvidence = async (): Promise<string | null> => {
    return null;
  };

  const getQaReleaseIds = () => qaAiPlan.releaseEntries.map((entry) => entry.id);

  const getQaFeedbackIds = () => qaFeedbackEntries.map((entry) => entry.id);

  const buildQaPdfLabels = () => ({
    title: t("qa.report_document_title"),
    generatedAt: t("qa.report_generated_at"),
    preparedBy: t("qa.report_field_prepared_by"),
    cycle: t("qa.report_field_cycle"),
    scope: t("qa.report_field_scope"),
    notes: t("qa.report_field_notes"),
    summaryTitle: t("qa.report_summary_title"),
    latestUpdatesTitle: t("qa.report_latest_updates"),
    currentStatusTitle: t("qa.report_current_status"),
    total: t("qa.report_total_label"),
    passed: t("qa.report_passed_label"),
    failed: t("qa.report_failed_label"),
    pending: t("qa.report_pending_label"),
    noUpdates: t("qa.report_no_updates"),
    statusPending: t("qa.status.pending"),
    statusPassed: t("qa.status.passed"),
    statusFailed: t("qa.status.failed"),
    lastCheckedNever: t("qa.last_checked_never"),
    statusLabel: t("qa.report_status_label"),
    lastCheckedLabel: t("qa.last_checked"),
    reasonLabel: t("qa.report_reason_label"),
    evidenceLabel: t("qa.report_evidence_label"),
    developerGuidanceLabel: t("qa.report_developer_guidance_label")
  });

  const waitForQaCondition = async (
    condition: () => boolean | Promise<boolean>,
    timeoutMs = 4200,
    intervalMs = 120
  ): Promise<boolean> => {
    const startedAt = Date.now();
    while (Date.now() - startedAt <= timeoutMs) {
      if (await condition()) {
        return true;
      }
      await waitForMs(intervalMs);
    }
    return false;
  };

  const dispatchQaKeyDown = (key: string, init?: Omit<KeyboardEventInit, "key">) => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        ...init
      })
    );
  };

  const escapeQaSelectorValue = (value: string) => {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(value);
    }
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  };

  const getQaInlineEditInputs = (selector: string): HTMLInputElement[] =>
    Array.from(document.querySelectorAll(selector)).filter(
      (element): element is HTMLInputElement => element instanceof HTMLInputElement
    );

  const getQaInlineEditSelector = (
    nodeId: string,
    surface: "tree" | "grid" | "mindmap" | "timeline"
  ) => {
    const safeNodeId = escapeQaSelectorValue(nodeId);
    if (surface === "tree") {
      return `.ode-tree-row[data-ode-node-id="${safeNodeId}"] input`;
    }
    if (surface === "grid") {
      return `.ode-grid-card[data-ode-node-id="${safeNodeId}"] input`;
    }
    if (surface === "mindmap") {
      return [
        `.ode-mind-node[data-ode-node-id="${safeNodeId}"] input`,
        `.ode-mind-root[data-ode-node-id="${safeNodeId}"] input`,
        `.ode-quick-mind-favorite[data-ode-node-id="${safeNodeId}"] input`
      ].join(", ");
    }
    return `[data-timeline-row="true"][data-ode-node-id="${safeNodeId}"] input`;
  };

  const waitForQaSurfaceInlineEdit = async (
    nodeId: string,
    surface: "tree" | "grid" | "mindmap" | "timeline"
  ) => {
    const targetSelector = getQaInlineEditSelector(nodeId, surface);
    const treeSelector = getQaInlineEditSelector(nodeId, "tree");
    let resolvedInput: HTMLInputElement | null = null;
    const ready = await waitForQaCondition(() => {
      const targetInputs = getQaInlineEditInputs(targetSelector);
      const treeInputs = surface === "tree" ? targetInputs : getQaInlineEditInputs(treeSelector);
      resolvedInput = targetInputs[0] ?? null;
      return (
        editingNodeIdRef.current === nodeId &&
        targetInputs.length === 1 &&
        resolvedInput === inlineEditInputRef.current &&
        (surface === "tree" || treeInputs.length === 0)
      );
    }, 2600, 70);
    if (!ready || !resolvedInput) {
      throw new Error(`Inline rename did not open on the ${surface} surface for node ${nodeId}.`);
    }
    return resolvedInput;
  };

  const setQaInlineInputValue = (input: HTMLInputElement, value: string) => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    const setter = descriptor?.set;
    if (!setter) {
      throw new Error("Inline edit value setter is unavailable in QA automation.");
    }
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const getQaProcedureSection = (nodeId: string): HTMLElement | null => {
    const safeNodeId = escapeQaSelectorValue(nodeId);
    const element = document.querySelector(
      `[data-ode-procedure-section="true"][data-ode-node-id="${safeNodeId}"]`
    );
    return element instanceof HTMLElement ? element : null;
  };

  const getQaProcedureTextarea = (): HTMLTextAreaElement | null => {
    const element = document.querySelector(".ode-procedure-editor-textarea");
    return element instanceof HTMLTextAreaElement ? element : null;
  };

  const setQaTextareaValue = (textarea: HTMLTextAreaElement, value: string) => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
    const setter = descriptor?.set;
    if (!setter) {
      throw new Error("System editor value setter is unavailable in QA automation.");
    }
    setter.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const typeQaInlineEditText = async (input: HTMLInputElement, text: string) => {
    input.focus();
    setQaInlineInputValue(input, "");
    const cleared = await waitForQaCondition(() => editingValueRef.current === "", 900, 40);
    if (!cleared) {
      throw new Error("Inline rename did not clear before QA typing started.");
    }

    let nextValue = "";
    for (const char of text) {
      nextValue += char;
      setQaInlineInputValue(input, nextValue);
      const accepted = await waitForQaCondition(() => editingValueRef.current === nextValue, 700, 35);
      if (!accepted) {
        throw new Error(`Inline rename stopped accepting characters at "${nextValue}".`);
      }
    }
  };

  const waitForQaNodeName = async (nodeId: string, expectedName: string) => {
    const renamed = await waitForQaCondition(async () => {
      const current = await getNode(nodeId);
      return current?.name === expectedName;
    }, 2600, 80);
    if (!renamed) {
      throw new Error(`Node ${nodeId} was not renamed to "${expectedName}".`);
    }
  };

  const getUtilityWindowLabel = (view: UtilityPanelView) => `odetool-panel-${view}`;

  const getUtilityWindowByView = async (view: UtilityPanelView) => WebviewWindow.getByLabel(getUtilityWindowLabel(view));

  const openDedicatedUtilityWindow = async (view: UtilityPanelView) => {
    if (!isTauri()) {
      throw new Error("Dedicated utility windows are only available in the desktop app.");
    }

    const existing = await getUtilityWindowByView(view);
    if (existing) {
      await existing.unminimize().catch(() => {});
      await existing.show().catch(() => {});
      await existing.setFocus().catch(() => {});
      return existing;
    }

    const label = getUtilityWindowLabel(view);
    const targetUrl = new URL(window.location.href);
    targetUrl.searchParams.set("utility", view);
    targetUrl.searchParams.set("lang", language);
    const panelTitle = view === "release" ? t("release.open") : view === "help" ? t("help.open") : t("qa.open");
    const panelWindow = new WebviewWindow(label, {
      title: `ODETool - ${panelTitle}`,
      url: targetUrl.toString(),
      center: true,
      width: 1280,
      height: 900,
      minWidth: 920,
      minHeight: 640,
      resizable: true,
      focus: true
    });
    void panelWindow.once("tauri://error", () => {});
    const resolvedWindow = await waitForUtilityWindow(view);
    if (!resolvedWindow) {
      throw new Error(`Utility window "${view}" did not open.`);
    }
    return resolvedWindow;
  };

  const waitForUtilityWindow = async (view: UtilityPanelView, timeoutMs = 4200) => {
    let resolvedWindow: Awaited<ReturnType<typeof getUtilityWindowByView>> = null;
    const ready = await waitForQaCondition(async () => {
      const handle = await getUtilityWindowByView(view);
      if (!handle) return false;
      resolvedWindow = handle;
      return true;
    }, timeoutMs);
    return ready ? resolvedWindow : null;
  };

  const restoreUtilityWindowsState = async (initiallyOpenViews: Set<UtilityPanelView>) => {
    if (!isTauri()) return;
    const views: UtilityPanelView[] = ["release", "help", "qa"];
    for (const view of views) {
      const handle = await getUtilityWindowByView(view);
      if (!handle) {
        if (initiallyOpenViews.has(view)) {
          await openUtilityPanel(view);
        }
        continue;
      }
      if (initiallyOpenViews.has(view)) {
        await handle.unminimize().catch(() => {});
        await handle.show().catch(() => {});
      } else {
        await handle.close().catch(() => {});
      }
    }
  };

  const buildAiTesterExecutionReport = useCallback(
    async (trigger: AiQaRunTrigger, runSummary: AiTesterRunSummary): Promise<AiQaExecutionReport> => {
      const snapshot = qaChecklistStateSnapshotRef.current;
      const learningRuns = readAiQaLearningRuns();
      const refreshedPlan = buildAiQaPlan({
        items: REGRESSION_CHECKLIST_ITEMS,
        checklistStateById: REGRESSION_CHECKLIST_ITEMS.reduce<Record<string, {
          status: QaChecklistStatus;
          checkedAt: string | null;
          failureReason: string;
          attachmentsCount: number;
        }>>((current, item) => {
          const entry = getQaChecklistEntry(snapshot, item.id);
          current[item.id] = {
            status: entry.status,
            checkedAt: entry.checkedAt,
            failureReason: entry.failureReason,
            attachmentsCount: entry.attachments.length
          };
          return current;
        }, {}),
        learningRuns,
        releaseEntries: qaReleaseEntries,
        feedbackEntries: qaFeedbackEntries,
        latestQaMeta,
        automatableItemIds: QA_AUTOMATION_ITEM_IDS
      });
      const planByItemId = new Map(refreshedPlan.items.map((item) => [item.itemId, item]));
      const orderedItems = buildOrderedQaChecklistItems(REGRESSION_CHECKLIST_ITEMS, language);
      const reportItems: AiQaExecutionItemReport[] = [];

      for (const displayItem of orderedItems) {
        const entry = getQaChecklistEntry(snapshot, displayItem.item.id);
        const planItem = planByItemId.get(displayItem.item.id);
        let firstScreenshotPreviewPath: string | null = null;
        const attachments = await Promise.all(
          entry.attachments.map(async (attachment) => {
            const shouldLoadPreview =
              attachment.source === "screenshot" &&
              firstScreenshotPreviewPath === null &&
              isTauri();
            let previewDataUrl: string | null | undefined = undefined;
            if (shouldLoadPreview) {
              firstScreenshotPreviewPath = attachment.path;
              previewDataUrl = await readLocalImageDataUrl(attachment.path).catch(() => null);
            }
            return {
              name: attachment.name,
              path: attachment.path,
              source: attachment.source,
              previewDataUrl
            };
          })
        );

        const status =
          entry.status === "passed"
            ? "passed"
            : entry.status === "failed"
              ? "failed"
              : "manual_required";
        const developerGuidance =
          status === "failed"
            ? buildAiQaDeveloperGuidance({
                item: displayItem.item,
                matchedReleaseTitles: planItem?.matchedReleaseTitles ?? [],
                matchedFeedbackTitles: planItem?.matchedFeedbackTitles ?? [],
                failureReason: entry.failureReason,
                evidencePaths: attachments.map((attachment) => attachment.path)
              })
            : status === "manual_required"
              ? `Automation gap: "${displayItem.localizedItem.title}" still needs either manual validation or a dedicated automated adapter.`
              : "";

        reportItems.push({
          itemId: displayItem.item.id,
          area: displayItem.localizedItem.area,
          title: `${displayItem.numberLabel} ${displayItem.localizedItem.title}`,
          scenario: displayItem.localizedItem.scenario,
          mode: planItem?.mode ?? (QA_AUTOMATION_ITEM_IDS.includes(displayItem.item.id) ? "automated" : "manual"),
          priority: planItem?.priority ?? (displayItem.item.aiTester?.priority ?? "normal"),
          matchedReleaseTitles: planItem?.matchedReleaseTitles ?? [],
          matchedFeedbackTitles: planItem?.matchedFeedbackTitles ?? [],
          status,
          checkedAt: entry.checkedAt,
          failureReason: entry.failureReason,
          developerGuidance,
          attachments
        });
      }

      return {
        id: `aiqa-${Date.now()}`,
        generatedAt: new Date().toISOString(),
        trigger,
        releaseIds: refreshedPlan.releaseEntries.map((entry) => entry.id),
        releaseTitles: refreshedPlan.releaseEntries.map((entry) => entry.title),
        feedbackIds: qaFeedbackEntries.map((entry) => entry.id),
        feedbackTitles: qaFeedbackEntries.map((entry) => entry.title),
        summary: {
          total: runSummary.total,
          automatedPassed: runSummary.automatedPassed,
          automatedFailed: runSummary.automatedFailed,
          manualRequired: runSummary.manualRemaining
        },
        items: reportItems
      };
    },
    [language, qaFeedbackEntries, qaReleaseEntries]
  );

  const finalizeAiTesterRun = useCallback(
    async (
      trigger: AiQaRunTrigger,
      runSummary: AiTesterRunSummary
    ): Promise<{ pdfPath: string | null; jsonPath: string | null; report: AiQaExecutionReport }> => {
      const report = await buildAiTesterExecutionReport(trigger, runSummary);
      setLatestAiExecutionReport(report);

      const categoryOrder: QaInputCategory[] = ["bug", "issue", "feature", "functionality", "general"];
      const releaseCategoryById = new Map(
        qaReleaseEntries.map((entry) => [entry.id, normalizeQaInputCategory(entry.category)])
      );
      const releaseCategoryCounts = report.releaseIds.reduce<Record<string, number>>((current, releaseId) => {
        const category = releaseCategoryById.get(releaseId) ?? "general";
        current[category] = (current[category] ?? 0) + 1;
        return current;
      }, {});
      const feedbackCategoryCounts = qaFeedbackEntries.reduce<Record<string, number>>((current, entry) => {
        const category = normalizeQaInputCategory(entry.category);
        current[category] = (current[category] ?? 0) + 1;
        return current;
      }, {});
      const categorizedInputs = categoryOrder
        .map((category) => (releaseCategoryCounts[category] ? `${category} ${releaseCategoryCounts[category]}` : null))
        .filter((value): value is string => Boolean(value))
        .join(", ");
      const categorizedFeedback = categoryOrder
        .map((category) => (feedbackCategoryCounts[category] ? `${category} ${feedbackCategoryCounts[category]}` : null))
        .filter((value): value is string => Boolean(value))
        .join(", ");
      const notes = [
        "AI tester release workflow: release notes, fixes, bugs, issues, and client feedback feed the QA checklist before post-release verification.",
        categorizedInputs ? `Categorized release inputs: ${categorizedInputs}.` : "",
        categorizedFeedback
          ? `Categorized client feedback inputs: ${categorizedFeedback}.`
          : "Categorized client feedback inputs: none configured.",
        report.releaseTitles.length > 0 ? `Current release focus: ${report.releaseTitles.join(" | ")}.` : "",
        report.feedbackTitles.length > 0 ? `Current client feedback focus: ${report.feedbackTitles.join(" | ")}.` : "",
        `Automated checks executed: ${runSummary.automatedCount}.`,
        `Automated pass: ${runSummary.automatedPassed}. Automated fail: ${runSummary.automatedFailed}.`,
        `Checklist items still manual or awaiting automation: ${runSummary.manualRemaining}.`,
        latestQaMeta.generatedAt ? `Previous repository QA baseline: ${latestQaMeta.generatedAt}.` : ""
      ]
        .filter(Boolean)
        .join("\n");

      const pdfPath: string | null = null;
      const jsonPath: string | null = null;

      const nextAutoRunState = writeAiQaAutoRunState({
        lastRunAt: report.generatedAt,
        testedReleaseIds: report.releaseIds,
        testedFeedbackIds: report.feedbackIds,
        latestReportPath: pdfPath,
        latestJsonPath: jsonPath,
        latestTrigger: trigger
      });
      setQaAutoRunState(nextAutoRunState);
      return { pdfPath, jsonPath, report };
    },
    [buildAiTesterExecutionReport, language, qaFeedbackEntries, qaReleaseEntries]
  );

  const runQaTreeEnterNewNodeAutomation = async () => {
    const itemId = "tree-enter-new-node";
    if (!activeProjectRootId || !activeProject) {
      throw new Error("Select a workspace before running Enter-create automation.");
    }

    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();
    const previousFolderId = store.currentFolderId;
    const previousSelectedId = store.selectedNodeId;
    const previousSelectionSurface = selectionSurface;
    const previousWorkspaceMode = workspaceMode;
    const previousDesktopViewMode = desktopViewMode;
    let qaRoot: AppNode | null = null;
    let anchorNode: AppNode | null = null;
    let createdNode: AppNode | null = null;

    try {
      qaAutomationLearningSkipRef.current.add(itemId);
      setProjectError(null);
      setProjectNotice("QA automation: checking Enter create flow and blank inline rename...");
      setContextMenu(null);
      setCommandBarOpen(false);
      cancelInlineEdit();
      setWorkspaceMode("grid");
      setDesktopViewMode("grid");

      await store.navigateTo(activeProjectRootId);
      qaRoot = await createNode(activeProjectRootId, `QA Enter Auto ${Date.now()}`, "folder");
      anchorNode = await createNode(qaRoot.id, "Enter Anchor", "folder");
      if (!qaRoot || !anchorNode) {
        throw new Error("QA Enter automation could not create its temporary branch.");
      }
      const resolvedQaRoot = qaRoot;
      const resolvedAnchorNode = anchorNode;
      await refreshTreeAndKeepContext(resolvedAnchorNode.id, [activeProjectRootId, resolvedQaRoot.id], "tree");
      setPrimarySelection(resolvedAnchorNode.id, "tree");
      setSelectionSurface("tree");

      const selectionReady = await waitForQaCondition(
        () => selectedNodeIdRef.current === resolvedAnchorNode.id && selectionSurfaceRef.current === "tree",
        2200,
        80
      );
      if (!selectionReady) {
        throw new Error("The QA anchor node did not become the active tree selection before Enter automation.");
      }

      const beforeChildren = await getChildren(resolvedQaRoot.id);
      const beforeIds = new Set(beforeChildren.map((child) => child.id));
      dispatchQaKeyDown("Enter", { code: "Enter" });

      const createdReady = await waitForQaCondition(async () => {
        const children = await getChildren(resolvedQaRoot.id);
        createdNode = children.find((child) => !beforeIds.has(child.id)) ?? null;
        return Boolean(createdNode && editingNodeIdRef.current === createdNode.id);
      }, 3400, 90);
      if (!createdReady) {
        throw new Error("Pressing Enter did not create a new sibling node in tree automation.");
      }
      const afterChildren = await getChildren(resolvedQaRoot.id);
      const resolvedCreatedNode = afterChildren.find((child) => !beforeIds.has(child.id)) ?? null;
      createdNode = resolvedCreatedNode;
      if (!resolvedCreatedNode) {
        throw new Error("The created node could not be resolved after Enter automation completed.");
      }
      if (resolvedCreatedNode.parentId !== resolvedQaRoot.id) {
        throw new Error(`Enter created the node under ${resolvedCreatedNode.parentId} instead of ${resolvedQaRoot.id}.`);
      }
      if (editingValueRef.current !== "") {
        throw new Error(`Inline rename started with "${editingValueRef.current}" instead of an empty field.`);
      }

      const proofLines = [
        "ODETool QA Automation Proof",
        `Scenario: ${itemId}`,
        `Started: ${startedAt}`,
        `Finished: ${new Date().toISOString()}`,
        `Workspace: ${activeProject.name}`,
        `Workspace Root Node: ${activeProjectRootId}`,
        `QA Branch: ${resolvedQaRoot.id} / ${resolvedQaRoot.name}`,
        `Anchor Node: ${resolvedAnchorNode.id} / ${resolvedAnchorNode.name}`,
        `Created Node: ${resolvedCreatedNode.id} / ${resolvedCreatedNode.name}`,
        `Created Parent: ${resolvedCreatedNode.parentId}`,
        `Inline Edit Node: ${editingNodeIdRef.current ?? "(none)"}`,
        `Inline Edit Value Length: ${editingValueRef.current.length}`,
        "RESULT: PASS"
      ];
      setQaChecklistFailureReason(itemId, "");
      setQaChecklistStatus(itemId, "passed");
      const proofPath = await writeQaAutomationProof(itemId, "passed", proofLines);
      addQaChecklistAttachments(itemId, [proofPath], "file");
      recordAiQaLearningEvent({
        itemId,
        status: "passed",
        source: "automation",
        workspace: activeProject.name,
        releaseIds: getQaReleaseIds(),
        attachmentsCount: 1,
        failureReasonProvided: false,
        latencyMs: Date.now() - startedAtMs,
        automationId: itemId
      });
      setProjectNotice("QA automation passed: Enter created a sibling node and inline rename started empty.");
      return "Tree Enter-create QA passed. Proof file attached.";
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const failureScreenshotPath = await captureQaAutomationFailureEvidence();
      const proofLines = [
        "ODETool QA Automation Proof",
        `Scenario: ${itemId}`,
        `Started: ${startedAt}`,
        `Finished: ${new Date().toISOString()}`,
        `Workspace: ${activeProject.name}`,
        `QA Branch: ${qaRoot ? `${qaRoot.id} / ${qaRoot.name}` : "(not created)"}`,
        `Anchor Node: ${anchorNode ? `${anchorNode.id} / ${anchorNode.name}` : "(not created)"}`,
        `Created Node: ${createdNode ? `${createdNode.id} / ${createdNode.name}` : "(missing)"}`,
        `Inline Edit Node: ${editingNodeIdRef.current ?? "(none)"}`,
        `Inline Edit Value: ${editingValueRef.current || "(empty)"}`,
        "RESULT: FAIL",
        `Reason: ${reason}`,
        failureScreenshotPath ? `Screenshot: ${failureScreenshotPath}` : "Screenshot: automatic capture not available"
      ];
      let attachedCount = 0;
      try {
        const proofPath = await writeQaAutomationProof(itemId, "failed", proofLines);
        addQaChecklistAttachments(itemId, [proofPath], "file");
        attachedCount += 1;
      } catch {
        // Preserve checklist failure even if proof write fails.
      }
      if (failureScreenshotPath) {
        addQaChecklistAttachments(itemId, [failureScreenshotPath], "screenshot");
        attachedCount += 1;
      }
      setQaChecklistFailureReason(itemId, reason);
      setQaChecklistStatus(itemId, "failed");
      recordAiQaLearningEvent({
        itemId,
        status: "failed",
        source: "automation",
        workspace: activeProject.name,
        releaseIds: getQaReleaseIds(),
        attachmentsCount: attachedCount,
        failureReasonProvided: true,
        latencyMs: Date.now() - startedAtMs,
        automationId: itemId
      });
      setProjectNotice(null);
      setProjectError(reason);
      throw new Error(reason);
    } finally {
      qaAutomationLearningSkipRef.current.delete(itemId);
      cancelInlineEdit();
      try {
        if (qaRoot) {
          await deleteNode(qaRoot.id, true);
        }
      } catch {
        // Cleanup is best-effort only.
      }
      try {
        await store.refreshTree();
        await restoreQaAutomationViewState(
          previousFolderId,
          previousSelectedId,
          previousSelectionSurface,
          previousWorkspaceMode,
          previousDesktopViewMode
        );
      } catch {
        // View restoration is best-effort only.
      }
    }
  };

  const runQaTreeF2RenameAutomation = async () => {
    const itemId = "tree-f2-rename";
    if (!activeProjectRootId || !activeProject) {
      throw new Error("Select a workspace before running F2 rename automation.");
    }

    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();
    const previousFolderId = store.currentFolderId;
    const previousSelectedId = store.selectedNodeId;
    const previousSelectionSurface = selectionSurface;
    const previousWorkspaceMode = workspaceMode;
    const previousDesktopViewMode = desktopViewMode;
    let qaRoot: AppNode | null = null;
    let renameTarget: AppNode | null = null;
    let treeName = "";
    let timelineName = "";

    try {
      qaAutomationLearningSkipRef.current.add(itemId);
      setProjectError(null);
      setProjectNotice("QA automation: checking F2 rename in tree and timeline...");
      setContextMenu(null);
      setCommandBarOpen(false);
      cancelInlineEdit();
      setWorkspaceMode("grid");
      setDesktopViewMode("grid");

      await store.navigateTo(activeProjectRootId);
      qaRoot = await createNode(activeProjectRootId, `QA F2 Rename ${Date.now()}`, "folder");
      renameTarget = await createNode(qaRoot.id, "Rename Anchor", "folder");

      await refreshTreeAndKeepContext(renameTarget.id, [activeProjectRootId, qaRoot.id], "tree");
      setPrimarySelection(renameTarget.id, "tree");
      setSelectionSurface("tree");
      const treeSelectionReady = await waitForQaCondition(
        () => selectedNodeIdRef.current === renameTarget?.id && selectionSurfaceRef.current === "tree",
        2200,
        80
      );
      if (!treeSelectionReady || !renameTarget) {
        throw new Error("Tree target node did not become selected before F2 rename automation.");
      }

      dispatchQaKeyDown("F2", { code: "F2" });
      const treeInput = await waitForQaSurfaceInlineEdit(renameTarget.id, "tree");
      treeName = `Tree Rename ${Date.now()}`;
      await typeQaInlineEditText(treeInput, treeName);
      await commitInlineEdit();
      await waitForQaNodeName(renameTarget.id, treeName);

      setWorkspaceMode("timeline");
      await refreshTreeAndKeepContext(renameTarget.id, [activeProjectRootId, qaRoot.id], "timeline");
      setPrimarySelection(renameTarget.id, "timeline");
      setSelectionSurface("timeline");
      const timelineSelectionReady = await waitForQaCondition(
        () =>
          selectedNodeIdRef.current === renameTarget?.id &&
          selectionSurfaceRef.current === "timeline" &&
          displayedTimelineRowsRef.current.some((row) => row.id === renameTarget?.id),
        2600,
        90
      );
      if (!timelineSelectionReady) {
        throw new Error("Timeline target row did not become selected before F2 rename automation.");
      }

      dispatchQaKeyDown("F2", { code: "F2" });
      const timelineInput = await waitForQaSurfaceInlineEdit(renameTarget.id, "timeline");
      timelineName = `Timeline Rename ${Date.now()}`;
      await typeQaInlineEditText(timelineInput, timelineName);
      await commitInlineEdit();
      await waitForQaNodeName(renameTarget.id, timelineName);

      const proofLines = [
        "ODETool QA Automation Proof",
        `Scenario: ${itemId}`,
        `Started: ${startedAt}`,
        `Finished: ${new Date().toISOString()}`,
        `Workspace: ${activeProject.name}`,
        `Workspace Root Node: ${activeProjectRootId}`,
        `QA Branch: ${qaRoot.id} / ${qaRoot.name}`,
        `Target Node: ${renameTarget.id}`,
        `Tree Rename Result: ${treeName}`,
        `Timeline Rename Result: ${timelineName}`,
        "RESULT: PASS"
      ];
      setQaChecklistFailureReason(itemId, "");
      setQaChecklistStatus(itemId, "passed");
      const proofPath = await writeQaAutomationProof(itemId, "passed", proofLines);
      addQaChecklistAttachments(itemId, [proofPath], "file");
      recordAiQaLearningEvent({
        itemId,
        status: "passed",
        source: "automation",
        workspace: activeProject.name,
        releaseIds: getQaReleaseIds(),
        attachmentsCount: 1,
        failureReasonProvided: false,
        latencyMs: Date.now() - startedAtMs,
        automationId: itemId
      });
      setProjectNotice("QA automation passed: F2 rename stayed stable in tree and timeline.");
      return "F2 rename QA passed. Proof file attached.";
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const failureScreenshotPath = await captureQaAutomationFailureEvidence();
      const proofLines = [
        "ODETool QA Automation Proof",
        `Scenario: ${itemId}`,
        `Started: ${startedAt}`,
        `Finished: ${new Date().toISOString()}`,
        `Workspace: ${activeProject.name}`,
        `QA Branch: ${qaRoot ? `${qaRoot.id} / ${qaRoot.name}` : "(not created)"}`,
        `Target Node: ${renameTarget ? `${renameTarget.id} / ${renameTarget.name}` : "(not created)"}`,
        `Tree Rename Result: ${treeName || "(not completed)"}`,
        `Timeline Rename Result: ${timelineName || "(not completed)"}`,
        `Editing Node: ${editingNodeIdRef.current ?? "(none)"}`,
        `Editing Value: ${editingValueRef.current || "(empty)"}`,
        "RESULT: FAIL",
        `Reason: ${reason}`,
        failureScreenshotPath ? `Screenshot: ${failureScreenshotPath}` : "Screenshot: automatic capture not available"
      ];
      let attachedCount = 0;
      try {
        const proofPath = await writeQaAutomationProof(itemId, "failed", proofLines);
        addQaChecklistAttachments(itemId, [proofPath], "file");
        attachedCount += 1;
      } catch {
        // Preserve checklist failure even if proof write fails.
      }
      if (failureScreenshotPath) {
        addQaChecklistAttachments(itemId, [failureScreenshotPath], "screenshot");
        attachedCount += 1;
      }
      setQaChecklistFailureReason(itemId, reason);
      setQaChecklistStatus(itemId, "failed");
      recordAiQaLearningEvent({
        itemId,
        status: "failed",
        source: "automation",
        workspace: activeProject.name,
        releaseIds: getQaReleaseIds(),
        attachmentsCount: attachedCount,
        failureReasonProvided: true,
        latencyMs: Date.now() - startedAtMs,
        automationId: itemId
      });
      setProjectNotice(null);
      setProjectError(reason);
      throw new Error(reason);
    } finally {
      qaAutomationLearningSkipRef.current.delete(itemId);
      cancelInlineEdit();
      try {
        if (qaRoot) {
          await deleteNode(qaRoot.id, true);
        }
      } catch {
        // Cleanup is best-effort only.
      }
      try {
        await store.refreshTree();
        await restoreQaAutomationViewState(
          previousFolderId,
          previousSelectedId,
          previousSelectionSurface,
          previousWorkspaceMode,
          previousDesktopViewMode
        );
      } catch {
        // View restoration is best-effort only.
      }
    }
  };

  const runQaDesktopInlineRenameSurfaceAutomation = async () => {
    const itemId = "desktop-inline-rename-stays-on-surface";
    if (!activeProjectRootId || !activeProject) {
      throw new Error("Select a workspace before running Desktop rename automation.");
    }

    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();
    const previousFolderId = store.currentFolderId;
    const previousSelectedId = store.selectedNodeId;
    const previousSelectionSurface = selectionSurface;
    const previousWorkspaceMode = workspaceMode;
    const previousDesktopViewMode = desktopViewMode;
    const previousMindMapContentMode = mindMapContentMode;
    let qaRoot: AppNode | null = null;
    let renameTarget: AppNode | null = null;
    let gridName = "";
    let mindMapName = "";

    try {
      qaAutomationLearningSkipRef.current.add(itemId);
      setProjectError(null);
      setProjectNotice("QA automation: checking Desktop Grid and Mind Map rename surface ownership...");
      setContextMenu(null);
      setCommandBarOpen(false);
      cancelInlineEdit();
      setWorkspaceMode("grid");
      setDesktopViewMode("grid");

      await store.navigateTo(activeProjectRootId);
      qaRoot = await createNode(activeProjectRootId, `QA Desktop Rename ${Date.now()}`, "folder");
      renameTarget = await createNode(qaRoot.id, "Desktop Rename Anchor", "folder");

      await store.navigateTo(qaRoot.id);
      await refreshTreeAndKeepContext(renameTarget.id, [activeProjectRootId, qaRoot.id], "grid");
      setPrimarySelection(renameTarget.id, "grid");
      setSelectionSurface("grid");
      const gridSelectionReady = await waitForQaCondition(
        () =>
          currentFolderIdRef.current === qaRoot?.id &&
          selectedNodeIdRef.current === renameTarget?.id &&
          selectionSurfaceRef.current === "grid",
        2400,
        80
      );
      if (!gridSelectionReady || !renameTarget) {
        throw new Error("Desktop Grid target did not become active before F2 rename automation.");
      }

      dispatchQaKeyDown("F2", { code: "F2" });
      const gridInput = await waitForQaSurfaceInlineEdit(renameTarget.id, "grid");
      gridName = `Grid Rename ${Date.now()}`;
      await typeQaInlineEditText(gridInput, gridName);
      await commitInlineEdit();
      await waitForQaNodeName(renameTarget.id, gridName);

      setDesktopViewMode("mindmap");
      setMindMapContentMode("node_tree");
      const mindMapVisible = await waitForQaCondition(() => {
        const selector = `.ode-mind-node[data-ode-node-id="${escapeQaSelectorValue(renameTarget!.id)}"]`;
        return Boolean(document.querySelector(selector));
      }, 2200, 70);
      if (!mindMapVisible) {
        throw new Error("Mind Map node card did not render for Desktop rename automation.");
      }

      setPrimarySelection(renameTarget.id, "grid");
      setSelectionSurface("grid");
      dispatchQaKeyDown("F2", { code: "F2" });
      const mindMapInput = await waitForQaSurfaceInlineEdit(renameTarget.id, "mindmap");
      mindMapName = `Mind Map Rename ${Date.now()}`;
      await typeQaInlineEditText(mindMapInput, mindMapName);
      await commitInlineEdit();
      await waitForQaNodeName(renameTarget.id, mindMapName);

      const proofLines = [
        "ODETool QA Automation Proof",
        `Scenario: ${itemId}`,
        `Started: ${startedAt}`,
        `Finished: ${new Date().toISOString()}`,
        `Workspace: ${activeProject.name}`,
        `Workspace Root Node: ${activeProjectRootId}`,
        `QA Branch: ${qaRoot.id} / ${qaRoot.name}`,
        `Target Node: ${renameTarget.id}`,
        `Grid Rename Result: ${gridName}`,
        `Mind Map Rename Result: ${mindMapName}`,
        "RESULT: PASS"
      ];
      setQaChecklistFailureReason(itemId, "");
      setQaChecklistStatus(itemId, "passed");
      const proofPath = await writeQaAutomationProof(itemId, "passed", proofLines);
      addQaChecklistAttachments(itemId, [proofPath], "file");
      recordAiQaLearningEvent({
        itemId,
        status: "passed",
        source: "automation",
        workspace: activeProject.name,
        releaseIds: getQaReleaseIds(),
        attachmentsCount: 1,
        failureReasonProvided: false,
        latencyMs: Date.now() - startedAtMs,
        automationId: itemId
      });
      setProjectNotice("QA automation passed: Desktop Grid and Mind Map kept rename on the clicked surface.");
      return "Desktop rename surface QA passed. Proof file attached.";
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const failureScreenshotPath = await captureQaAutomationFailureEvidence();
      const proofLines = [
        "ODETool QA Automation Proof",
        `Scenario: ${itemId}`,
        `Started: ${startedAt}`,
        `Finished: ${new Date().toISOString()}`,
        `Workspace: ${activeProject.name}`,
        `QA Branch: ${qaRoot ? `${qaRoot.id} / ${qaRoot.name}` : "(not created)"}`,
        `Target Node: ${renameTarget ? `${renameTarget.id} / ${renameTarget.name}` : "(not created)"}`,
        `Grid Rename Result: ${gridName || "(not completed)"}`,
        `Mind Map Rename Result: ${mindMapName || "(not completed)"}`,
        `Editing Node: ${editingNodeIdRef.current ?? "(none)"}`,
        `Editing Value: ${editingValueRef.current || "(empty)"}`,
        "RESULT: FAIL",
        `Reason: ${reason}`,
        failureScreenshotPath ? `Screenshot: ${failureScreenshotPath}` : "Screenshot: automatic capture not available"
      ];
      let attachedCount = 0;
      try {
        const proofPath = await writeQaAutomationProof(itemId, "failed", proofLines);
        addQaChecklistAttachments(itemId, [proofPath], "file");
        attachedCount += 1;
      } catch {
        // Preserve checklist failure even if proof write fails.
      }
      if (failureScreenshotPath) {
        addQaChecklistAttachments(itemId, [failureScreenshotPath], "screenshot");
        attachedCount += 1;
      }
      setQaChecklistFailureReason(itemId, reason);
      setQaChecklistStatus(itemId, "failed");
      recordAiQaLearningEvent({
        itemId,
        status: "failed",
        source: "automation",
        workspace: activeProject.name,
        releaseIds: getQaReleaseIds(),
        attachmentsCount: attachedCount,
        failureReasonProvided: true,
        latencyMs: Date.now() - startedAtMs,
        automationId: itemId
      });
      setProjectNotice(null);
      setProjectError(reason);
      throw new Error(reason);
    } finally {
      qaAutomationLearningSkipRef.current.delete(itemId);
      cancelInlineEdit();
      setMindMapContentMode(previousMindMapContentMode);
      try {
        if (qaRoot) {
          await deleteNode(qaRoot.id, true);
        }
      } catch {
        // Cleanup is best-effort only.
      }
      try {
        await store.refreshTree();
        await restoreQaAutomationViewState(
          previousFolderId,
          previousSelectedId,
          previousSelectionSurface,
          previousWorkspaceMode,
          previousDesktopViewMode
        );
      } catch {
        // View restoration is best-effort only.
      }
    }
  };

  const runQaProcedureSelectionAndAutosaveAutomation = async () => {
    const itemId = "desktop-procedure-selection-and-autosave";
    if (!activeProjectRootId || !activeProject) {
      throw new Error("Select a workspace before running System automation.");
    }

    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();
    const previousFolderId = store.currentFolderId;
    const previousSelectedId = store.selectedNodeId;
    const previousSelectionSurface = selectionSurface;
    const previousWorkspaceMode = workspaceMode;
    const previousDesktopViewMode = desktopViewMode;
    let qaRoot: AppNode | null = null;
    let sectionOne: AppNode | null = null;
    let sectionTwo: AppNode | null = null;
    let procedureBody = "";

    try {
      qaAutomationLearningSkipRef.current.add(itemId);
      setProjectError(null);
      setProjectNotice("QA automation: checking System section selection and autosave...");
      setContextMenu(null);
      setCommandBarOpen(false);
      cancelInlineEdit();
      setWorkspaceMode("grid");
      setDesktopViewMode("procedure");

      await store.navigateTo(activeProjectRootId);
      qaRoot = await createNode(activeProjectRootId, `QA System ${Date.now()}`, "folder");
      sectionOne = await createNode(qaRoot.id, "System Section One", "folder");
      sectionTwo = await createNode(qaRoot.id, "System Section Two", "folder");

      if (!qaRoot || !sectionOne || !sectionTwo) {
        throw new Error("System QA automation could not create its temporary branch.");
      }

      await refreshTreeAndKeepContext(sectionOne.id, [activeProjectRootId, qaRoot.id], "tree");
      setPrimarySelection(qaRoot.id, "tree");

      const sectionReady = await waitForQaCondition(() => {
        const sectionOneElement = getQaProcedureSection(sectionOne!.id);
        const sectionTwoElement = getQaProcedureSection(sectionTwo!.id);
        return Boolean(sectionOneElement && sectionTwoElement && getQaProcedureTextarea());
      }, 3200, 90);
      if (!sectionReady) {
        throw new Error("System sections did not render in Desktop > System.");
      }

      const sectionOneElement = getQaProcedureSection(sectionOne.id);
      if (!sectionOneElement) {
        throw new Error("First System section could not be located in the live preview.");
      }
      sectionOneElement.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

      const selectionReady = await waitForQaCondition(
        () => selectedNodeIdRef.current === sectionOne?.id,
        2200,
        70
      );
      if (!selectionReady) {
        throw new Error("Clicking the System section did not select that node.");
      }

      const textarea = getQaProcedureTextarea();
      if (!textarea) {
        throw new Error("System editor textarea is not available.");
      }
      procedureBody = `QA system body ${Date.now()}\n- First step\n- Expected result`;
      textarea.focus();
      setQaTextareaValue(textarea, procedureBody);

      const previewUpdated = await waitForQaCondition(() => {
        const currentSection = getQaProcedureSection(sectionOne!.id);
        return Boolean(currentSection?.textContent?.includes("QA system body"));
      }, 1800, 60);
      if (!previewUpdated) {
        throw new Error("System preview did not reflect the edited section text.");
      }

      textarea.blur();
      const saveReady = await waitForQaCondition(async () => {
        const savedNode = await getNode(sectionOne!.id);
        const savedText =
          typeof savedNode?.content === "string"
            ? savedNode.content
            : typeof savedNode?.description === "string"
              ? savedNode.description
              : "";
        return savedText === procedureBody;
      }, 3200, 90);
      if (!saveReady) {
        throw new Error("System editor did not persist the edited section text back to node content.");
      }

      const sectionTwoElement = getQaProcedureSection(sectionTwo.id);
      if (!sectionTwoElement) {
        throw new Error("Second System section could not be located in the live preview.");
      }
      sectionTwoElement.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

      const secondSelectionReady = await waitForQaCondition(() => {
        const currentTextarea = getQaProcedureTextarea();
        return selectedNodeIdRef.current === sectionTwo?.id && Boolean(currentTextarea && currentTextarea.value === "");
      }, 2200, 70);
      if (!secondSelectionReady) {
        throw new Error("Selecting another System section did not switch the editor to that section.");
      }

      const proofLines = [
        "ODETool QA Automation Proof",
        `Scenario: ${itemId}`,
        `Started: ${startedAt}`,
        `Finished: ${new Date().toISOString()}`,
        `Workspace: ${activeProject.name}`,
        `Workspace Root Node: ${activeProjectRootId}`,
        `QA Branch: ${qaRoot.id} / ${qaRoot.name}`,
        `Section One: ${sectionOne.id} / ${sectionOne.name}`,
        `Section Two: ${sectionTwo.id} / ${sectionTwo.name}`,
        `Saved Body: ${procedureBody}`,
        "RESULT: PASS"
      ];
      setQaChecklistFailureReason(itemId, "");
      setQaChecklistStatus(itemId, "passed");
      const proofPath = await writeQaAutomationProof(itemId, "passed", proofLines);
      addQaChecklistAttachments(itemId, [proofPath], "file");
      recordAiQaLearningEvent({
        itemId,
        status: "passed",
        source: "automation",
        workspace: activeProject.name,
        releaseIds: getQaReleaseIds(),
        attachmentsCount: 1,
        failureReasonProvided: false,
        latencyMs: Date.now() - startedAtMs,
        automationId: itemId
      });
      setProjectNotice("QA automation passed: System sections select directly and autosave node content.");
      return "System selection/autosave QA passed. Proof file attached.";
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const failureScreenshotPath = await captureQaAutomationFailureEvidence();
      const proofLines = [
        "ODETool QA Automation Proof",
        `Scenario: ${itemId}`,
        `Started: ${startedAt}`,
        `Finished: ${new Date().toISOString()}`,
        `Workspace: ${activeProject.name}`,
        `QA Branch: ${qaRoot ? `${qaRoot.id} / ${qaRoot.name}` : "(not created)"}`,
        `Section One: ${sectionOne ? `${sectionOne.id} / ${sectionOne.name}` : "(not created)"}`,
        `Section Two: ${sectionTwo ? `${sectionTwo.id} / ${sectionTwo.name}` : "(not created)"}`,
        `Selected Node: ${selectedNodeIdRef.current ?? "(none)"}`,
        `Draft Text: ${getQaProcedureTextarea()?.value || "(empty)"}`,
        "RESULT: FAIL",
        `Reason: ${reason}`,
        failureScreenshotPath ? `Screenshot: ${failureScreenshotPath}` : "Screenshot: automatic capture not available"
      ];
      let attachedCount = 0;
      try {
        const proofPath = await writeQaAutomationProof(itemId, "failed", proofLines);
        addQaChecklistAttachments(itemId, [proofPath], "file");
        attachedCount += 1;
      } catch {
        // Preserve checklist failure even if proof write fails.
      }
      if (failureScreenshotPath) {
        addQaChecklistAttachments(itemId, [failureScreenshotPath], "screenshot");
        attachedCount += 1;
      }
      setQaChecklistFailureReason(itemId, reason);
      setQaChecklistStatus(itemId, "failed");
      recordAiQaLearningEvent({
        itemId,
        status: "failed",
        source: "automation",
        workspace: activeProject.name,
        releaseIds: getQaReleaseIds(),
        attachmentsCount: attachedCount,
        failureReasonProvided: true,
        latencyMs: Date.now() - startedAtMs,
        automationId: itemId
      });
      setProjectNotice(null);
      setProjectError(reason);
      throw new Error(reason);
    } finally {
      qaAutomationLearningSkipRef.current.delete(itemId);
      try {
        if (qaRoot) {
          await deleteNode(qaRoot.id, true);
        }
      } catch {
        // Cleanup is best-effort only.
      }
      try {
        await store.refreshTree();
        await restoreQaAutomationViewState(
          previousFolderId,
          previousSelectedId,
          previousSelectionSurface,
          previousWorkspaceMode,
          previousDesktopViewMode
        );
      } catch {
        // View restoration is best-effort only.
      }
    }
  };

  const runQaTimelineKeyboardSurfaceAutomation = async () => {
    const itemId = "timeline-keyboard-shortcuts-stay-on-surface";
    if (!activeProjectRootId || !activeProject) {
      throw new Error("Select a workspace before running Timeline keyboard automation.");
    }

    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();
    const previousFolderId = store.currentFolderId;
    const previousSelectedId = store.selectedNodeId;
    const previousSelectionSurface = selectionSurface;
    const previousWorkspaceMode = workspaceMode;
    const previousDesktopViewMode = desktopViewMode;
    const previousBranchClipboard = branchClipboard;
    let qaRoot: AppNode | null = null;
    let timelineTarget: AppNode | null = null;
    let duplicatedNode: AppNode | null = null;
    let pastedNode: AppNode | null = null;

    try {
      qaAutomationLearningSkipRef.current.add(itemId);
      setProjectError(null);
      setProjectNotice("QA automation: checking Timeline rename, duplicate, copy, and paste shortcuts...");
      setContextMenu(null);
      setCommandBarOpen(false);
      cancelInlineEdit();
      setWorkspaceMode("timeline");

      await store.navigateTo(activeProjectRootId);
      qaRoot = await createNode(activeProjectRootId, `QA Timeline Keys ${Date.now()}`, "folder");
      timelineTarget = await createNode(qaRoot.id, "Timeline Shortcut Anchor", "folder");

      await refreshTreeAndKeepContext(timelineTarget.id, [activeProjectRootId, qaRoot.id], "timeline");
      setPrimarySelection(timelineTarget.id, "timeline");
      setSelectionSurface("timeline");
      const selectionReady = await waitForQaCondition(
        () =>
          selectedNodeIdRef.current === timelineTarget?.id &&
          selectionSurfaceRef.current === "timeline" &&
          displayedTimelineRowsRef.current.some((row) => row.id === timelineTarget?.id),
        2600,
        90
      );
      if (!selectionReady || !timelineTarget) {
        throw new Error("Timeline target row did not become active before keyboard automation.");
      }
      const resolvedQaRoot = qaRoot;
      const resolvedTarget = timelineTarget;

      const beforeDuplicateChildren = await getChildren(resolvedQaRoot.id);
      const beforeDuplicateIds = new Set(beforeDuplicateChildren.map((child) => child.id));
      dispatchQaKeyDown("d", { code: "KeyD", ctrlKey: true });
      const duplicateReady = await waitForQaCondition(async () => {
        const children = await getChildren(resolvedQaRoot.id);
        duplicatedNode = children.find((child) => !beforeDuplicateIds.has(child.id)) ?? null;
        return Boolean(duplicatedNode && editingNodeIdRef.current === duplicatedNode.id);
      }, 3400, 90);
      if (!duplicateReady || !duplicatedNode) {
        throw new Error("Ctrl+D in Timeline did not create a duplicated row with inline rename.");
      }
      const resolvedDuplicatedNode = duplicatedNode as AppNode;
      await waitForQaSurfaceInlineEdit(resolvedDuplicatedNode.id, "timeline");
      cancelInlineEdit();

      setPrimarySelection(resolvedTarget.id, "timeline");
      setSelectionSurface("timeline");
      dispatchQaKeyDown("c", { code: "KeyC", ctrlKey: true });
      const copyReady = await waitForQaCondition(() => Boolean(branchClipboardRef.current), 2200, 70);
      if (!copyReady) {
        throw new Error("Ctrl+C in Timeline did not populate the branch clipboard.");
      }

      const beforePasteChildren = await getChildren(resolvedQaRoot.id);
      const beforePasteIds = new Set(beforePasteChildren.map((child) => child.id));
      dispatchQaKeyDown("v", { code: "KeyV", ctrlKey: true });
      const pasteReady = await waitForQaCondition(async () => {
        const children = await getChildren(resolvedQaRoot.id);
        pastedNode = children.find((child) => !beforePasteIds.has(child.id)) ?? null;
        return Boolean(pastedNode && editingNodeIdRef.current === pastedNode.id);
      }, 3600, 90);
      if (!pasteReady || !pastedNode) {
        throw new Error("Ctrl+V in Timeline did not paste a copied row into the visible branch.");
      }
      const resolvedPastedNode = pastedNode as AppNode;
      await waitForQaSurfaceInlineEdit(resolvedPastedNode.id, "timeline");
      cancelInlineEdit();

      const proofLines = [
        "ODETool QA Automation Proof",
        `Scenario: ${itemId}`,
        `Started: ${startedAt}`,
        `Finished: ${new Date().toISOString()}`,
        `Workspace: ${activeProject.name}`,
        `Workspace Root Node: ${activeProjectRootId}`,
        `QA Branch: ${resolvedQaRoot.id} / ${resolvedQaRoot.name}`,
        `Target Node: ${resolvedTarget.id} / ${resolvedTarget.name}`,
        `Duplicated Node: ${resolvedDuplicatedNode.id} / ${resolvedDuplicatedNode.name}`,
        `Pasted Node: ${resolvedPastedNode.id} / ${resolvedPastedNode.name}`,
        "RESULT: PASS"
      ];
      setQaChecklistFailureReason(itemId, "");
      setQaChecklistStatus(itemId, "passed");
      const proofPath = await writeQaAutomationProof(itemId, "passed", proofLines);
      addQaChecklistAttachments(itemId, [proofPath], "file");
      recordAiQaLearningEvent({
        itemId,
        status: "passed",
        source: "automation",
        workspace: activeProject.name,
        releaseIds: getQaReleaseIds(),
        attachmentsCount: 1,
        failureReasonProvided: false,
        latencyMs: Date.now() - startedAtMs,
        automationId: itemId
      });
      setProjectNotice("QA automation passed: Timeline shortcuts stayed on the timeline surface.");
      return "Timeline keyboard surface QA passed. Proof file attached.";
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const failureScreenshotPath = await captureQaAutomationFailureEvidence();
      const proofLines = [
        "ODETool QA Automation Proof",
        `Scenario: ${itemId}`,
        `Started: ${startedAt}`,
        `Finished: ${new Date().toISOString()}`,
        `Workspace: ${activeProject.name}`,
        `QA Branch: ${qaRoot ? `${qaRoot.id} / ${qaRoot.name}` : "(not created)"}`,
        `Target Node: ${timelineTarget ? `${timelineTarget.id} / ${timelineTarget.name}` : "(not created)"}`,
        `Duplicated Node: ${duplicatedNode ? `${(duplicatedNode as AppNode).id} / ${(duplicatedNode as AppNode).name}` : "(missing)"}`,
        `Pasted Node: ${pastedNode ? `${(pastedNode as AppNode).id} / ${(pastedNode as AppNode).name}` : "(missing)"}`,
        `Editing Node: ${editingNodeIdRef.current ?? "(none)"}`,
        "RESULT: FAIL",
        `Reason: ${reason}`,
        failureScreenshotPath ? `Screenshot: ${failureScreenshotPath}` : "Screenshot: automatic capture not available"
      ];
      let attachedCount = 0;
      try {
        const proofPath = await writeQaAutomationProof(itemId, "failed", proofLines);
        addQaChecklistAttachments(itemId, [proofPath], "file");
        attachedCount += 1;
      } catch {
        // Preserve checklist failure even if proof write fails.
      }
      if (failureScreenshotPath) {
        addQaChecklistAttachments(itemId, [failureScreenshotPath], "screenshot");
        attachedCount += 1;
      }
      setQaChecklistFailureReason(itemId, reason);
      setQaChecklistStatus(itemId, "failed");
      recordAiQaLearningEvent({
        itemId,
        status: "failed",
        source: "automation",
        workspace: activeProject.name,
        releaseIds: getQaReleaseIds(),
        attachmentsCount: attachedCount,
        failureReasonProvided: true,
        latencyMs: Date.now() - startedAtMs,
        automationId: itemId
      });
      setProjectNotice(null);
      setProjectError(reason);
      throw new Error(reason);
    } finally {
      qaAutomationLearningSkipRef.current.delete(itemId);
      cancelInlineEdit();
      setBranchClipboard(previousBranchClipboard);
      try {
        if (qaRoot) {
          await deleteNode(qaRoot.id, true);
        }
      } catch {
        // Cleanup is best-effort only.
      }
      try {
        await store.refreshTree();
        await restoreQaAutomationViewState(
          previousFolderId,
          previousSelectedId,
          previousSelectionSurface,
          previousWorkspaceMode,
          previousDesktopViewMode
        );
      } catch {
        // View restoration is best-effort only.
      }
    }
  };

  const runQaTimelineFilterParentsOptionalAutomation = async () => {
    const itemId = "ui-timeline-filter-parents-optional";
    if (!activeProjectRootId || !activeProject) {
      throw new Error("Select a workspace before running timeline filter automation.");
    }

    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();
    const previousFolderId = store.currentFolderId;
    const previousSelectedId = store.selectedNodeId;
    const previousSelectionSurface = selectionSurface;
    const previousWorkspaceMode = workspaceMode;
    const previousDesktopViewMode = desktopViewMode;
    const previousNodeStateFilters = new Set(activeNodeStateFilters);
    const previousIncludeNodeStateFilterParents = includeNodeStateFilterParents;
    const previousTimelineStatusFilters = new Set(activeTimelineStatusFilters);
    const previousIncludeTimelineFilterParents = includeTimelineFilterParents;
    let qaRoot: AppNode | null = null;
    let timelineParent: AppNode | null = null;
    let timelineChild: AppNode | null = null;
    let parentsOffVisibleCount = 0;
    let parentsOnVisibleCount = 0;

    try {
      qaAutomationLearningSkipRef.current.add(itemId);
      setProjectError(null);
      setProjectNotice("QA automation: checking Timeline status filters and Parents toggle...");
      setContextMenu(null);
      setCommandBarOpen(false);
      cancelInlineEdit();
      setWorkspaceMode("timeline");

      await store.navigateTo(activeProjectRootId);
      qaRoot = await createNode(activeProjectRootId, `QA Timeline Filter ${Date.now()}`, "folder");
      timelineParent = await createNode(qaRoot.id, "Timeline Parent", "folder");
      timelineChild = await createNode(timelineParent.id, "Timeline Child", "folder");

      const today = new Date();
      const startDate = today.toISOString().slice(0, 10);
      const endDate = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      await updateNodeProperties(timelineChild.id, {
        ...(timelineChild.properties ?? {}),
        timelineSchedule: {
          title: timelineChild.name,
          status: "blocked",
          startDate,
          endDate,
          assignees: [],
          priority: "normal",
          progress: 0,
          predecessor: "",
          mode: "manual"
        }
      });

      await refreshTreeAndKeepContext(timelineChild.id, [activeProjectRootId, qaRoot.id, timelineParent.id], "timeline");
      setPrimarySelection(timelineParent.id, "timeline");
      setSelectionSurface("timeline");
      setActiveNodeStateFilters(createAllNodeStateFilters());
      setIncludeNodeStateFilterParents(true);
      setActiveTimelineStatusFilters(new Set<ScheduleStatus>(["blocked"]));
      setIncludeTimelineFilterParents(false);

      const parentsOffReady = await waitForQaCondition(() => {
        const visibleIds = new Set(displayedTimelineRowsRef.current.map((row) => row.id));
        parentsOffVisibleCount = displayedTimelineRowsRef.current.length;
        return visibleIds.has(timelineChild!.id) && !visibleIds.has(timelineParent!.id);
      }, 3600, 100);
      if (!parentsOffReady) {
        throw new Error("Timeline blocked filter with Parents off did not leave only the matching child branch visible.");
      }

      setIncludeTimelineFilterParents(true);
      const parentsOnReady = await waitForQaCondition(() => {
        const visibleIds = new Set(displayedTimelineRowsRef.current.map((row) => row.id));
        parentsOnVisibleCount = displayedTimelineRowsRef.current.length;
        return visibleIds.has(timelineChild!.id) && visibleIds.has(timelineParent!.id);
      }, 2600, 90);
      if (!parentsOnReady) {
        throw new Error("Enabling Timeline Parents did not restore the filtered ancestor row.");
      }

      const proofLines = [
        "ODETool QA Automation Proof",
        `Scenario: ${itemId}`,
        `Started: ${startedAt}`,
        `Finished: ${new Date().toISOString()}`,
        `Workspace: ${activeProject.name}`,
        `Workspace Root Node: ${activeProjectRootId}`,
        `QA Branch: ${qaRoot.id} / ${qaRoot.name}`,
        `Timeline Parent: ${timelineParent.id} / ${timelineParent.name}`,
        `Timeline Child: ${timelineChild.id} / ${timelineChild.name}`,
        `Active Status Filters: ${Array.from(activeTimelineStatusFiltersRef.current).join(", ") || "(none)"}`,
        `Parents Off Visible Count: ${parentsOffVisibleCount}`,
        `Parents On Visible Count: ${parentsOnVisibleCount}`,
        "RESULT: PASS"
      ];
      setQaChecklistFailureReason(itemId, "");
      setQaChecklistStatus(itemId, "passed");
      const proofPath = await writeQaAutomationProof(itemId, "passed", proofLines);
      addQaChecklistAttachments(itemId, [proofPath], "file");
      recordAiQaLearningEvent({
        itemId,
        status: "passed",
        source: "automation",
        workspace: activeProject.name,
        releaseIds: getQaReleaseIds(),
        attachmentsCount: 1,
        failureReasonProvided: false,
        latencyMs: Date.now() - startedAtMs,
        automationId: itemId
      });
      setProjectNotice("QA automation passed: Timeline status filters stayed visible and Parents toggled ancestors on demand.");
      return "Timeline Parents filter QA passed. Proof file attached.";
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const failureScreenshotPath = await captureQaAutomationFailureEvidence();
      const proofLines = [
        "ODETool QA Automation Proof",
        `Scenario: ${itemId}`,
        `Started: ${startedAt}`,
        `Finished: ${new Date().toISOString()}`,
        `Workspace: ${activeProject.name}`,
        `QA Branch: ${qaRoot ? `${qaRoot.id} / ${qaRoot.name}` : "(not created)"}`,
        `Timeline Parent: ${timelineParent ? `${timelineParent.id} / ${timelineParent.name}` : "(not created)"}`,
        `Timeline Child: ${timelineChild ? `${timelineChild.id} / ${timelineChild.name}` : "(not created)"}`,
        `Active Status Filters: ${Array.from(activeTimelineStatusFiltersRef.current).join(", ") || "(none)"}`,
        `Include Parents: ${includeTimelineFilterParentsRef.current ? "yes" : "no"}`,
        `Visible Timeline Rows: ${displayedTimelineRowsRef.current.length}`,
        "RESULT: FAIL",
        `Reason: ${reason}`,
        failureScreenshotPath ? `Screenshot: ${failureScreenshotPath}` : "Screenshot: automatic capture not available"
      ];
      let attachedCount = 0;
      try {
        const proofPath = await writeQaAutomationProof(itemId, "failed", proofLines);
        addQaChecklistAttachments(itemId, [proofPath], "file");
        attachedCount += 1;
      } catch {
        // Preserve checklist failure even if proof write fails.
      }
      if (failureScreenshotPath) {
        addQaChecklistAttachments(itemId, [failureScreenshotPath], "screenshot");
        attachedCount += 1;
      }
      setQaChecklistFailureReason(itemId, reason);
      setQaChecklistStatus(itemId, "failed");
      recordAiQaLearningEvent({
        itemId,
        status: "failed",
        source: "automation",
        workspace: activeProject.name,
        releaseIds: getQaReleaseIds(),
        attachmentsCount: attachedCount,
        failureReasonProvided: true,
        latencyMs: Date.now() - startedAtMs,
        automationId: itemId
      });
      setProjectNotice(null);
      setProjectError(reason);
      throw new Error(reason);
    } finally {
      qaAutomationLearningSkipRef.current.delete(itemId);
      setActiveNodeStateFilters(new Set(previousNodeStateFilters));
      setIncludeNodeStateFilterParents(previousIncludeNodeStateFilterParents);
      setActiveTimelineStatusFilters(new Set(previousTimelineStatusFilters));
      setIncludeTimelineFilterParents(previousIncludeTimelineFilterParents);
      try {
        if (qaRoot) {
          await deleteNode(qaRoot.id, true);
        }
      } catch {
        // Cleanup is best-effort only.
      }
      try {
        await store.refreshTree();
        await restoreQaAutomationViewState(
          previousFolderId,
          previousSelectedId,
          previousSelectionSurface,
          previousWorkspaceMode,
          previousDesktopViewMode
        );
      } catch {
        // View restoration is best-effort only.
      }
    }
  };

  const runQaKeyboardBackspaceNavigateUpAutomation = async () => {
    const itemId = "keyboard-backspace-navigate-up";
    if (!activeProjectRootId || !activeProject) {
      throw new Error("Select a workspace before running Backspace navigation automation.");
    }

    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();
    const previousFolderId = store.currentFolderId;
    const previousSelectedId = store.selectedNodeId;
    const previousSelectionSurface = selectionSurface;
    const previousWorkspaceMode = workspaceMode;
    const previousDesktopViewMode = desktopViewMode;
    let qaRoot: AppNode | null = null;
    let childFolder: AppNode | null = null;
    const viewResults: string[] = [];

    try {
      qaAutomationLearningSkipRef.current.add(itemId);
      setProjectError(null);
      setProjectNotice("QA automation: checking Backspace navigate-up behavior...");
      setContextMenu(null);
      setCommandBarOpen(false);
      cancelInlineEdit();
      setWorkspaceMode("grid");
      setDesktopViewMode("grid");

      await store.navigateTo(activeProjectRootId);
      qaRoot = await createNode(activeProjectRootId, `QA Backspace Auto ${Date.now()}`, "folder");
      childFolder = await createNode(qaRoot.id, "Backspace Child", "folder");
      await refreshTreeAndKeepContext(childFolder.id, [activeProjectRootId, qaRoot.id], "grid");
      const runBackspaceCheck = async (viewMode: DesktopViewMode, label: string) => {
        await store.navigateTo(childFolder!.id);
        setDesktopViewMode(viewMode);
        setPrimarySelection(childFolder!.id, "grid");
        setSelectionSurface("grid");

        const childReady = await waitForQaCondition(
          () =>
            currentFolderIdRef.current === childFolder?.id &&
            selectedNodeIdRef.current === childFolder?.id &&
            selectionSurfaceRef.current === "grid" &&
            desktopViewModeRef.current === viewMode,
          2400,
          80
        );
        if (!childReady) {
          throw new Error(`${label}: the child folder did not become the active location before Backspace automation.`);
        }

        dispatchQaKeyDown("Backspace", { code: "Backspace" });
        const navigated = await waitForQaCondition(
          () =>
            currentFolderIdRef.current === qaRoot?.id &&
            selectedNodeIdRef.current === childFolder?.id &&
            selectionSurfaceRef.current === "grid" &&
            desktopViewModeRef.current === viewMode,
          2600,
          80
        );
        if (!navigated) {
          throw new Error(
            `${label}: Backspace did not navigate to the parent folder while keeping selection and surface context.`
          );
        }

        viewResults.push(
          `${label}: folder=${currentFolderIdRef.current ?? "(none)"} | selection=${selectedNodeIdRef.current ?? "(none)"} | surface=${selectionSurfaceRef.current} | view=${desktopViewModeRef.current}`
        );
      };

      await runBackspaceCheck("grid", "Desktop Grid");
      await runBackspaceCheck("mindmap", "Mind Map");

      const proofLines = [
        "ODETool QA Automation Proof",
        `Scenario: ${itemId}`,
        `Started: ${startedAt}`,
        `Finished: ${new Date().toISOString()}`,
        `Workspace: ${activeProject.name}`,
        `Workspace Root Node: ${activeProjectRootId}`,
        `QA Parent Folder: ${qaRoot.id} / ${qaRoot.name}`,
        `Child Folder: ${childFolder.id} / ${childFolder.name}`,
        ...viewResults,
        "RESULT: PASS"
      ];
      setQaChecklistFailureReason(itemId, "");
      setQaChecklistStatus(itemId, "passed");
      const proofPath = await writeQaAutomationProof(itemId, "passed", proofLines);
      addQaChecklistAttachments(itemId, [proofPath], "file");
      recordAiQaLearningEvent({
        itemId,
        status: "passed",
        source: "automation",
        workspace: activeProject.name,
        releaseIds: getQaReleaseIds(),
        attachmentsCount: 1,
        failureReasonProvided: false,
        latencyMs: Date.now() - startedAtMs,
        automationId: itemId
      });
      setProjectNotice("QA automation passed: Backspace kept Grid and Mind Map on the same surface while navigating up.");
      return "Backspace navigation QA passed. Proof file attached.";
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const failureScreenshotPath = await captureQaAutomationFailureEvidence();
      const proofLines = [
        "ODETool QA Automation Proof",
        `Scenario: ${itemId}`,
        `Started: ${startedAt}`,
        `Finished: ${new Date().toISOString()}`,
        `Workspace: ${activeProject.name}`,
        `QA Parent Folder: ${qaRoot ? `${qaRoot.id} / ${qaRoot.name}` : "(not created)"}`,
        `Child Folder: ${childFolder ? `${childFolder.id} / ${childFolder.name}` : "(not created)"}`,
        ...viewResults,
        `Current Folder: ${currentFolderIdRef.current ?? "(none)"}`,
        `Selected Node: ${selectedNodeIdRef.current ?? "(none)"}`,
        "RESULT: FAIL",
        `Reason: ${reason}`,
        failureScreenshotPath ? `Screenshot: ${failureScreenshotPath}` : "Screenshot: automatic capture not available"
      ];
      let attachedCount = 0;
      try {
        const proofPath = await writeQaAutomationProof(itemId, "failed", proofLines);
        addQaChecklistAttachments(itemId, [proofPath], "file");
        attachedCount += 1;
      } catch {
        // Preserve checklist failure even if proof write fails.
      }
      if (failureScreenshotPath) {
        addQaChecklistAttachments(itemId, [failureScreenshotPath], "screenshot");
        attachedCount += 1;
      }
      setQaChecklistFailureReason(itemId, reason);
      setQaChecklistStatus(itemId, "failed");
      recordAiQaLearningEvent({
        itemId,
        status: "failed",
        source: "automation",
        workspace: activeProject.name,
        releaseIds: getQaReleaseIds(),
        attachmentsCount: attachedCount,
        failureReasonProvided: true,
        latencyMs: Date.now() - startedAtMs,
        automationId: itemId
      });
      setProjectNotice(null);
      setProjectError(reason);
      throw new Error(reason);
    } finally {
      qaAutomationLearningSkipRef.current.delete(itemId);
      try {
        if (qaRoot) {
          await deleteNode(qaRoot.id, true);
        }
      } catch {
        // Cleanup is best-effort only.
      }
      try {
        await store.refreshTree();
        await restoreQaAutomationViewState(
          previousFolderId,
          previousSelectedId,
          previousSelectionSurface,
          previousWorkspaceMode,
          previousDesktopViewMode
        );
      } catch {
        // View restoration is best-effort only.
      }
    }
  };

  const runQaUploadCurrentFolderAutomation = async () => {
    throw new Error("QA upload automation has been removed.");
  };

  const runQaRootEnterCreatesTopLevelBranchAutomation = async () => {
    const itemId = "ui-root-enter-creates-top-level-branch";
    if (!activeProjectRootId || !activeProject) {
      throw new Error("Select a workspace before running root-Enter automation.");
    }

    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();
    const previousFolderId = store.currentFolderId;
    const previousSelectedId = store.selectedNodeId;
    const previousSelectionSurface = selectionSurface;
    const previousWorkspaceMode = workspaceMode;
    const previousDesktopViewMode = desktopViewMode;
    let createdNode: AppNode | null = null;

    try {
      qaAutomationLearningSkipRef.current.add(itemId);
      setProjectError(null);
      setProjectNotice("QA automation: checking workspace-root Enter routing...");
      setWorkspaceMode("grid");
      await store.navigateTo(activeProjectRootId);
      setPrimarySelection(activeProjectRootId, "tree");

      const beforeChildren = await getChildren(activeProjectRootId);
      const beforeIds = new Set(beforeChildren.map((child) => child.id));
      await createSiblingNode(activeProjectRootId, false, "tree");
      const childCreated = await waitForQaCondition(async () => {
        const children = await getChildren(activeProjectRootId);
        return children.some((child) => !beforeIds.has(child.id));
      }, 3200, 100);
      if (!childCreated) {
        throw new Error("No new visible top-level child was created under the active workspace root.");
      }

      const afterChildren = await getChildren(activeProjectRootId);
      createdNode = afterChildren.find((child) => !beforeIds.has(child.id)) ?? null;
      if (!createdNode) {
        throw new Error("The created branch could not be resolved after Enter-on-root automation.");
      }
      if (createdNode.parentId !== activeProjectRootId) {
        throw new Error(`The created branch parent was ${createdNode.parentId} instead of the workspace root ${activeProjectRootId}.`);
      }

      const proofLines = [
        "ODETool QA Automation Proof",
        `Scenario: ${itemId}`,
        `Started: ${startedAt}`,
        `Finished: ${new Date().toISOString()}`,
        `Workspace: ${activeProject.name}`,
        `Workspace Root Node: ${activeProjectRootId}`,
        `Created Node: ${createdNode.id} / ${createdNode.name}`,
        `Created Parent: ${createdNode.parentId}`,
        "RESULT: PASS"
      ];
      setQaChecklistFailureReason(itemId, "");
      setQaChecklistStatus(itemId, "passed");
      const proofPath = await writeQaAutomationProof(itemId, "passed", proofLines);
      addQaChecklistAttachments(itemId, [proofPath], "file");
      recordAiQaLearningEvent({
        itemId,
        status: "passed",
        source: "automation",
        workspace: activeProject.name,
        releaseIds: getQaReleaseIds(),
        attachmentsCount: 1,
        failureReasonProvided: false,
        latencyMs: Date.now() - startedAtMs,
        automationId: itemId
      });
      setProjectNotice(`QA automation passed: Enter on ${activeProject.name} root created a visible top-level branch.`);
      return "Workspace-root Enter QA passed. Proof file attached.";
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const failureScreenshotPath = await captureQaAutomationFailureEvidence();
      const proofLines = [
        "ODETool QA Automation Proof",
        `Scenario: ${itemId}`,
        `Started: ${startedAt}`,
        `Finished: ${new Date().toISOString()}`,
        `Workspace: ${activeProject.name}`,
        `Workspace Root Node: ${activeProjectRootId}`,
        `Created Node: ${createdNode ? `${createdNode.id} / ${createdNode.name}` : "(missing)"}`,
        "RESULT: FAIL",
        `Reason: ${reason}`,
        failureScreenshotPath ? `Screenshot: ${failureScreenshotPath}` : "Screenshot: automatic capture not available"
      ];
      let attachedCount = 0;
      try {
        const proofPath = await writeQaAutomationProof(itemId, "failed", proofLines);
        addQaChecklistAttachments(itemId, [proofPath], "file");
        attachedCount += 1;
      } catch {
        // Preserve checklist failure even if proof write fails.
      }
      if (failureScreenshotPath) {
        addQaChecklistAttachments(itemId, [failureScreenshotPath], "screenshot");
        attachedCount += 1;
      }
      setQaChecklistFailureReason(itemId, reason);
      setQaChecklistStatus(itemId, "failed");
      recordAiQaLearningEvent({
        itemId,
        status: "failed",
        source: "automation",
        workspace: activeProject.name,
        releaseIds: getQaReleaseIds(),
        attachmentsCount: attachedCount,
        failureReasonProvided: true,
        latencyMs: Date.now() - startedAtMs,
        automationId: itemId
      });
      setProjectNotice(null);
      setProjectError(reason);
      throw new Error(reason);
    } finally {
      qaAutomationLearningSkipRef.current.delete(itemId);
      cancelInlineEdit();
      try {
        if (createdNode) {
          await deleteNode(createdNode.id, true);
        }
      } catch {
        // Cleanup is best-effort only.
      }
      try {
        await store.refreshTree();
        await restoreQaAutomationViewState(
          previousFolderId,
          previousSelectedId,
          previousSelectionSurface,
          previousWorkspaceMode,
          previousDesktopViewMode
        );
      } catch {
        // View restoration is best-effort only.
      }
    }
  };

  const runQaAiCommandBarAutomation = async () => {
    const itemId = "ui-ai-command-bar-ctrl-k";
    if (!activeProject) {
      throw new Error("Select a workspace before running command-bar automation.");
    }

    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();
    const previousWorkspaceMode = workspaceMode;
    const previousCommandBarOpen = commandBarOpen;

    try {
      qaAutomationLearningSkipRef.current.add(itemId);
      setProjectError(null);
      setProjectNotice("QA automation: checking command bar open, plan, and confirm flow...");
      setCommandBarOpen(true);
      const opened = await waitForQaCondition(() => commandBarOpenRef.current, 1800, 60);
      if (!opened) {
        throw new Error("The command bar did not open when requested by automation.");
      }

      const plan = await analyzeAiCommand("open timeline");
      if (plan.actionId !== "timeline_open") {
        throw new Error(`The planner returned ${plan.actionId ?? "no action"} instead of timeline_open.`);
      }

      await executeAiPlan(plan);
      const switched = await waitForQaCondition(
        () => workspaceModeRef.current === "timeline" && !commandBarOpenRef.current,
        2200,
        80
      );
      if (!switched) {
        throw new Error("The command bar plan did not switch to Timeline view and close after confirmation.");
      }

      const proofLines = [
        "ODETool QA Automation Proof",
        `Scenario: ${itemId}`,
        `Started: ${startedAt}`,
        `Finished: ${new Date().toISOString()}`,
        `Workspace: ${activeProject.name}`,
        `Planned Action: ${plan.actionId}`,
        `Planner Source: ${plan.plannerSource}`,
        `Planner Confidence: ${Math.round(plan.confidence * 100)}%`,
        `View After Execute: ${workspaceModeRef.current}`,
        "RESULT: PASS"
      ];
      setQaChecklistFailureReason(itemId, "");
      setQaChecklistStatus(itemId, "passed");
      const proofPath = await writeQaAutomationProof(itemId, "passed", proofLines);
      addQaChecklistAttachments(itemId, [proofPath], "file");
      recordAiQaLearningEvent({
        itemId,
        status: "passed",
        source: "automation",
        workspace: activeProject.name,
        releaseIds: getQaReleaseIds(),
        attachmentsCount: 1,
        failureReasonProvided: false,
        latencyMs: Date.now() - startedAtMs,
        automationId: itemId
      });
      setProjectNotice("QA automation passed: command bar opened, planned, and confirmed Timeline view successfully.");
      return "Command bar QA passed. Proof file attached.";
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const failureScreenshotPath = await captureQaAutomationFailureEvidence();
      const proofLines = [
        "ODETool QA Automation Proof",
        `Scenario: ${itemId}`,
        `Started: ${startedAt}`,
        `Finished: ${new Date().toISOString()}`,
        `Workspace: ${activeProject.name}`,
        `Command Bar Open: ${commandBarOpenRef.current ? "yes" : "no"}`,
        `Current View: ${workspaceModeRef.current}`,
        "RESULT: FAIL",
        `Reason: ${reason}`,
        failureScreenshotPath ? `Screenshot: ${failureScreenshotPath}` : "Screenshot: automatic capture not available"
      ];
      let attachedCount = 0;
      try {
        const proofPath = await writeQaAutomationProof(itemId, "failed", proofLines);
        addQaChecklistAttachments(itemId, [proofPath], "file");
        attachedCount += 1;
      } catch {
        // Preserve checklist failure even if proof write fails.
      }
      if (failureScreenshotPath) {
        addQaChecklistAttachments(itemId, [failureScreenshotPath], "screenshot");
        attachedCount += 1;
      }
      setQaChecklistFailureReason(itemId, reason);
      setQaChecklistStatus(itemId, "failed");
      recordAiQaLearningEvent({
        itemId,
        status: "failed",
        source: "automation",
        workspace: activeProject.name,
        releaseIds: getQaReleaseIds(),
        attachmentsCount: attachedCount,
        failureReasonProvided: true,
        latencyMs: Date.now() - startedAtMs,
        automationId: itemId
      });
      setProjectNotice(null);
      setProjectError(reason);
      throw new Error(reason);
    } finally {
      qaAutomationLearningSkipRef.current.delete(itemId);
      if (previousWorkspaceMode === "grid") {
        setWorkspaceMode("grid");
      }
      setCommandBarOpen(previousCommandBarOpen);
    }
  };

  const runQaUtilityWindowControlsAutomation = async () => {
    const itemId = "ui-utility-window-controls";
    if (!isTauri()) {
      throw new Error("Utility-window automation is only available in the desktop app.");
    }
    if (isUtilityPanelWindow) {
      throw new Error("Run this utility-window automation from the main app window so dedicated panels can close safely.");
    }
    if (!activeProject) {
      throw new Error("Select a workspace before running utility-window automation.");
    }

    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();
    const initialOpenViews = new Set<UtilityPanelView>();
    const views: UtilityPanelView[] = ["release", "help", "qa"];
    const detailLines: string[] = [];

    try {
      qaAutomationLearningSkipRef.current.add(itemId);
      setProjectError(null);
      setProjectNotice("QA automation: checking utility window controls...");
      for (const view of views) {
        if (await getUtilityWindowByView(view)) {
          initialOpenViews.add(view);
        }
      }

      for (const view of views) {
        const handle = await openDedicatedUtilityWindow(view);
        detailLines.push(`Window ${view}: opened (${handle.label}).`);
        if (!(await handle.isVisible().catch(() => true))) {
          throw new Error(`The ${view} utility window opened but did not report itself as visible.`);
        }

        await handle.maximize();
        if (!(await waitForQaCondition(() => handle.isMaximized(), 2400, 90))) {
          throw new Error(`The ${view} utility window did not maximize.`);
        }
        detailLines.push(`Window ${view}: maximize OK.`);

        await handle.unmaximize();
        if (!(await waitForQaCondition(async () => !(await handle.isMaximized()), 2400, 90))) {
          throw new Error(`The ${view} utility window did not restore after maximize.`);
        }
        detailLines.push(`Window ${view}: restore OK.`);

        await handle.minimize();
        if (!(await waitForQaCondition(() => handle.isMinimized(), 2400, 90))) {
          throw new Error(`The ${view} utility window did not minimize.`);
        }
        detailLines.push(`Window ${view}: minimize OK.`);

        await handle.unminimize();
        if (!(await waitForQaCondition(async () => !(await handle.isMinimized()), 2400, 90))) {
          throw new Error(`The ${view} utility window did not restore after minimize.`);
        }
        detailLines.push(`Window ${view}: restore from minimize OK.`);

        await handle.toggleMaximize();
        if (!(await waitForQaCondition(() => handle.isMaximized(), 2400, 90))) {
          throw new Error(`The ${view} utility window did not toggle into maximized state.`);
        }
        await handle.toggleMaximize();
        if (!(await waitForQaCondition(async () => !(await handle.isMaximized()), 2400, 90))) {
          throw new Error(`The ${view} utility window did not toggle back to restored state.`);
        }
        detailLines.push(`Window ${view}: maximize toggle OK.`);

        await handle.close();
        if (!(await waitForQaCondition(async () => (await getUtilityWindowByView(view)) === null, 2600, 90))) {
          throw new Error(`The ${view} utility window did not close.`);
        }
        detailLines.push(`Window ${view}: close OK.`);

        await openDedicatedUtilityWindow(view);
        detailLines.push(`Window ${view}: reopen OK.`);
      }

      const proofLines = [
        "ODETool QA Automation Proof",
        `Scenario: ${itemId}`,
        `Started: ${startedAt}`,
        `Finished: ${new Date().toISOString()}`,
        `Workspace: ${activeProject.name}`,
        ...detailLines,
        "RESULT: PASS"
      ];
      setQaChecklistFailureReason(itemId, "");
      setQaChecklistStatus(itemId, "passed");
      const proofPath = await writeQaAutomationProof(itemId, "passed", proofLines);
      addQaChecklistAttachments(itemId, [proofPath], "file");
      recordAiQaLearningEvent({
        itemId,
        status: "passed",
        source: "automation",
        workspace: activeProject.name,
        releaseIds: getQaReleaseIds(),
        attachmentsCount: 1,
        failureReasonProvided: false,
        latencyMs: Date.now() - startedAtMs,
        automationId: itemId
      });
      setProjectNotice("QA automation passed: utility windows support minimize, maximize, restore, close, and reopen.");
      return "Utility-window controls QA passed. Proof file attached.";
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const failureScreenshotPath = await captureQaAutomationFailureEvidence();
      const proofLines = [
        "ODETool QA Automation Proof",
        `Scenario: ${itemId}`,
        `Started: ${startedAt}`,
        `Finished: ${new Date().toISOString()}`,
        `Workspace: ${activeProject.name}`,
        ...detailLines,
        "RESULT: FAIL",
        `Reason: ${reason}`,
        failureScreenshotPath ? `Screenshot: ${failureScreenshotPath}` : "Screenshot: automatic capture not available"
      ];
      let attachedCount = 0;
      try {
        const proofPath = await writeQaAutomationProof(itemId, "failed", proofLines);
        addQaChecklistAttachments(itemId, [proofPath], "file");
        attachedCount += 1;
      } catch {
        // Preserve checklist failure even if proof write fails.
      }
      if (failureScreenshotPath) {
        addQaChecklistAttachments(itemId, [failureScreenshotPath], "screenshot");
        attachedCount += 1;
      }
      setQaChecklistFailureReason(itemId, reason);
      setQaChecklistStatus(itemId, "failed");
      recordAiQaLearningEvent({
        itemId,
        status: "failed",
        source: "automation",
        workspace: activeProject.name,
        releaseIds: getQaReleaseIds(),
        attachmentsCount: attachedCount,
        failureReasonProvided: true,
        latencyMs: Date.now() - startedAtMs,
        automationId: itemId
      });
      setProjectNotice(null);
      setProjectError(reason);
      throw new Error(reason);
    } finally {
      qaAutomationLearningSkipRef.current.delete(itemId);
      await restoreUtilityWindowsState(initialOpenViews);
    }
  };

  const runQaSingleInstanceAndUtilityWindowsAutomation = async () => {
    const itemId = "ui-single-instance-and-utility-windows";
    if (!isTauri()) {
      throw new Error("Single-instance automation is only available in the desktop app.");
    }
    if (isUtilityPanelWindow) {
      throw new Error("Run this single-instance automation from the main app window so utility-window reuse can be measured safely.");
    }
    if (!activeProject) {
      throw new Error("Select a workspace before running single-instance automation.");
    }

    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();
    const initialOpenViews = new Set<UtilityPanelView>();
    const views: UtilityPanelView[] = ["release", "help", "qa"];
    const detailLines: string[] = [];

    try {
      qaAutomationLearningSkipRef.current.add(itemId);
      setProjectError(null);
      setProjectNotice("QA automation: checking single-instance relaunch and utility-window reuse...");
      for (const view of views) {
        if (await getUtilityWindowByView(view)) {
          initialOpenViews.add(view);
        }
      }

      const relaunchFocusedExistingApp = await probeSingleInstanceRelaunch();
      if (!relaunchFocusedExistingApp) {
        throw new Error("Launching the EXE again did not report focus returning to the existing app instance.");
      }
      detailLines.push("Second launch: existing app instance refocused successfully.");

      for (const view of views) {
        const label = getUtilityWindowLabel(view);
        await openDedicatedUtilityWindow(view);
        const afterFirstOpen = (await getAllWindows()).filter((windowHandle) => windowHandle.label === label).length;
        if (afterFirstOpen !== 1) {
          throw new Error(`Opening ${view} did not result in exactly one dedicated utility window.`);
        }
        await openDedicatedUtilityWindow(view);
        const afterReuseOpen = (await getAllWindows()).filter((windowHandle) => windowHandle.label === label).length;
        if (afterReuseOpen !== 1) {
          throw new Error(`Reopening ${view} created an extra utility window instead of reusing the existing one.`);
        }
        detailLines.push(`Utility window ${view}: dedicated window reused correctly.`);
      }

      const proofLines = [
        "ODETool QA Automation Proof",
        `Scenario: ${itemId}`,
        `Started: ${startedAt}`,
        `Finished: ${new Date().toISOString()}`,
        `Workspace: ${activeProject.name}`,
        ...detailLines,
        "RESULT: PASS"
      ];
      setQaChecklistFailureReason(itemId, "");
      setQaChecklistStatus(itemId, "passed");
      const proofPath = await writeQaAutomationProof(itemId, "passed", proofLines);
      addQaChecklistAttachments(itemId, [proofPath], "file");
      recordAiQaLearningEvent({
        itemId,
        status: "passed",
        source: "automation",
        workspace: activeProject.name,
        releaseIds: getQaReleaseIds(),
        attachmentsCount: 1,
        failureReasonProvided: false,
        latencyMs: Date.now() - startedAtMs,
        automationId: itemId
      });
      setProjectNotice("QA automation passed: second launch reused the app and utility panels reused their dedicated windows.");
      return "Single-instance and utility-window reuse QA passed. Proof file attached.";
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const failureScreenshotPath = await captureQaAutomationFailureEvidence();
      const proofLines = [
        "ODETool QA Automation Proof",
        `Scenario: ${itemId}`,
        `Started: ${startedAt}`,
        `Finished: ${new Date().toISOString()}`,
        `Workspace: ${activeProject.name}`,
        ...detailLines,
        "RESULT: FAIL",
        `Reason: ${reason}`,
        failureScreenshotPath ? `Screenshot: ${failureScreenshotPath}` : "Screenshot: automatic capture not available"
      ];
      let attachedCount = 0;
      try {
        const proofPath = await writeQaAutomationProof(itemId, "failed", proofLines);
        addQaChecklistAttachments(itemId, [proofPath], "file");
        attachedCount += 1;
      } catch {
        // Preserve checklist failure even if proof write fails.
      }
      if (failureScreenshotPath) {
        addQaChecklistAttachments(itemId, [failureScreenshotPath], "screenshot");
        attachedCount += 1;
      }
      setQaChecklistFailureReason(itemId, reason);
      setQaChecklistStatus(itemId, "failed");
      recordAiQaLearningEvent({
        itemId,
        status: "failed",
        source: "automation",
        workspace: activeProject.name,
        releaseIds: getQaReleaseIds(),
        attachmentsCount: attachedCount,
        failureReasonProvided: true,
        latencyMs: Date.now() - startedAtMs,
        automationId: itemId
      });
      setProjectNotice(null);
      setProjectError(reason);
      throw new Error(reason);
    } finally {
      qaAutomationLearningSkipRef.current.delete(itemId);
      await restoreUtilityWindowsState(initialOpenViews);
    }
  };

  const runQaChecklistAutomation = async (itemId: string) => {
    if (itemId === "tree-f2-rename") {
      return runQaTreeF2RenameAutomation();
    }
    if (itemId === "tree-enter-new-node") {
      return runQaTreeEnterNewNodeAutomation();
    }
    if (itemId === "desktop-inline-rename-stays-on-surface") {
      return runQaDesktopInlineRenameSurfaceAutomation();
    }
    if (itemId === "desktop-procedure-selection-and-autosave") {
      return runQaProcedureSelectionAndAutosaveAutomation();
    }
    if (itemId === "keyboard-backspace-navigate-up") {
      return runQaKeyboardBackspaceNavigateUpAutomation();
    }
    if (itemId === "ui-root-enter-creates-top-level-branch") {
      return runQaRootEnterCreatesTopLevelBranchAutomation();
    }
    if (itemId === "ui-timeline-filter-parents-optional") {
      return runQaTimelineFilterParentsOptionalAutomation();
    }
    if (itemId === "timeline-keyboard-shortcuts-stay-on-surface") {
      return runQaTimelineKeyboardSurfaceAutomation();
    }
    if (itemId === "ui-ai-command-bar-ctrl-k") {
      return runQaAiCommandBarAutomation();
    }
    if (itemId === "ui-utility-window-controls") {
      return runQaUtilityWindowControlsAutomation();
    }
    if (itemId === "ui-single-instance-and-utility-windows") {
      return runQaSingleInstanceAndUtilityWindowsAutomation();
    }
    throw new Error("No automation is available for this checklist item yet.");
  };

  const runAiTester = useCallback(
    async (trigger: AiQaRunTrigger = "manual") => {
      if (aiTesterBusyRef.current) return;

      const orderedChecklistItems = buildOrderedQaChecklistItems(REGRESSION_CHECKLIST_ITEMS, language);
      const aiPlanRankByItemId = new Map(qaAiPlan.items.map((item, index) => [item.itemId, index]));
      const prioritizedChecklistItems = [...orderedChecklistItems].sort((left, right) => {
        const leftAuto = QA_AUTOMATION_ITEM_IDS.includes(left.item.id);
        const rightAuto = QA_AUTOMATION_ITEM_IDS.includes(right.item.id);
        if (leftAuto !== rightAuto) return leftAuto ? -1 : 1;
        const leftRank = aiPlanRankByItemId.get(left.item.id) ?? Number.MAX_SAFE_INTEGER;
        const rightRank = aiPlanRankByItemId.get(right.item.id) ?? Number.MAX_SAFE_INTEGER;
        if (leftRank !== rightRank) return leftRank - rightRank;
        return left.item.id.localeCompare(right.item.id);
      });
      aiTesterBusyRef.current = true;
      setAiTesterState({
        busy: true,
        notice: null,
        error: null,
        progress: {
          current: 0,
          total: prioritizedChecklistItems.length,
          itemId: null
        }
      });
      if (trigger === "automatic") {
        setProjectNotice("AI tester started automatically for new release inputs.");
      }

      let automatedPassed = 0;
      let automatedFailed = 0;
      let manualRemaining = 0;

      try {
        for (let index = 0; index < prioritizedChecklistItems.length; index += 1) {
          const itemId = prioritizedChecklistItems[index]?.item.id;
          if (!itemId) continue;
          setAiTesterState((current) => ({
            ...current,
            progress: {
              current: index + 1,
              total: prioritizedChecklistItems.length,
              itemId
            }
          }));

          if (!QA_AUTOMATION_ITEM_IDS.includes(itemId)) {
            manualRemaining += 1;
            continue;
          }

          try {
            await runQaChecklistAutomation(itemId);
            automatedPassed += 1;
          } catch {
            automatedFailed += 1;
          }
        }

        await waitForMs(80);
        const runSummary: AiTesterRunSummary = {
          total: prioritizedChecklistItems.length,
          automatedCount: automatedPassed + automatedFailed,
          automatedPassed,
          automatedFailed,
          manualRemaining
        };
        const result = await finalizeAiTesterRun(trigger, runSummary);
        const fileNotices = [
          result.pdfPath ? translate(language, "qa.report_saved_to", { path: result.pdfPath }) : null,
          result.jsonPath ? `AI JSON report saved to ${result.jsonPath}` : null
        ]
          .filter((value): value is string => Boolean(value))
          .join(" ");

        const successNotice =
          runSummary.automatedCount === 0
            ? translate(language, "qa.ai_tester_no_auto", {
                total: runSummary.total,
                manual: runSummary.manualRemaining
              })
            : translate(language, "qa.ai_tester_run_result_success", {
                total: runSummary.total,
                count: runSummary.automatedPassed,
                manual: runSummary.manualRemaining
              });
        const failureError =
          runSummary.automatedFailed > 0
            ? translate(language, "qa.ai_tester_run_result_failed", {
                total: runSummary.total,
                passed: runSummary.automatedPassed,
                failed: runSummary.automatedFailed,
                manual: runSummary.manualRemaining
              })
            : null;

        setAiTesterState({
          busy: false,
          notice: [failureError ? null : successNotice, fileNotices].filter(Boolean).join(" ") || null,
          error: failureError,
          progress: null
        });

        if (failureError) {
          setProjectNotice(fileNotices || null);
          setProjectError(failureError);
        } else {
          setProjectError(null);
          setProjectNotice([successNotice, fileNotices].filter(Boolean).join(" ") || null);
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        setAiTesterState({
          busy: false,
          notice: null,
          error: reason,
          progress: null
        });
        setProjectNotice(null);
        setProjectError(reason);
      } finally {
        aiTesterBusyRef.current = false;
      }
    },
    [finalizeAiTesterRun, language, qaAiPlan]
  );

  const refreshProjects = async (preferredProjectId?: string | null): Promise<string | null> => {
    try {
      const list = await getProjects();
      setProjects(list);
      setProjectError(null);
      if (list.length === 0) {
        setActiveProjectId(null);
        setDefaultProjectId(null);
        return null;
      }
      const preferred = preferredProjectId !== undefined ? preferredProjectId : activeProjectId;
      const resolvedDefault = defaultProjectId && list.some((project) => project.id === defaultProjectId)
        ? defaultProjectId
        : null;
      if (defaultProjectId && !resolvedDefault) {
        setDefaultProjectId(null);
      }
      const nextActive =
        preferred && list.some((project) => project.id === preferred)
          ? preferred
          : resolvedDefault ?? (preferredProjectId === undefined ? (list[0]?.id ?? null) : null);
      setActiveProjectId(nextActive);
      return nextActive;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setProjectError(t("project.load_failed_reason", { reason }));
      setProjects([]);
      setActiveProjectId(null);
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    let syncInFlight = false;
    let syncQueuedWhileInFlight = false;
    const clearScheduledLanguageSyncs = () => {
      if (systemLanguageSyncTimeoutIdsRef.current.length === 0) return;
      systemLanguageSyncTimeoutIdsRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      systemLanguageSyncTimeoutIdsRef.current = [];
    };
    const syncLanguageFromSystem = async () => {
      if (cancelled) return;
      if (syncInFlight) {
        syncQueuedWhileInFlight = true;
        return;
      }
      syncInFlight = true;
      try {
        do {
          syncQueuedWhileInFlight = false;
          const nextLanguage = await detectPreferredAppLanguage();
          if (cancelled) return;
          setLanguage((current) => (current === nextLanguage ? current : nextLanguage));
        } while (!cancelled && syncQueuedWhileInFlight);
      } finally {
        syncInFlight = false;
      }
    };

    void syncLanguageFromSystem();

    const handleWindowFocus = () => {
      clearScheduledLanguageSyncs();
      void syncLanguageFromSystem();
      scheduleLanguageSyncBurst();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        clearScheduledLanguageSyncs();
        void syncLanguageFromSystem();
        scheduleLanguageSyncBurst();
      }
    };
    const handleBrowserLanguageChange = () => {
      clearScheduledLanguageSyncs();
      void syncLanguageFromSystem();
      scheduleLanguageSyncBurst();
    };
    const scheduleLanguageSyncBurst = (
      retryDelays: readonly number[] = SYSTEM_LANGUAGE_SYNC_RETRY_DELAYS_MS
    ) => {
      clearScheduledLanguageSyncs();
      systemLanguageSyncTimeoutIdsRef.current = retryDelays.map((retryDelay) => {
        const timeoutId = window.setTimeout(() => {
          systemLanguageSyncTimeoutIdsRef.current = systemLanguageSyncTimeoutIdsRef.current.filter(
            (activeTimeoutId) => activeTimeoutId !== timeoutId
          );
          void syncLanguageFromSystem();
        }, retryDelay);
        return timeoutId;
      });
    };
    const handlePotentialKeyboardLayoutToggle = (event: KeyboardEvent) => {
      const normalizedKey = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const isShiftAltChord =
        (event.key === "Shift" && event.altKey) ||
        (event.key === "Alt" && event.shiftKey) ||
        (event.shiftKey && event.altKey);
      const isCtrlShiftChord =
        (event.key === "Shift" && event.ctrlKey) || (event.key === "Control" && event.shiftKey);
      const isWindowsSpaceChord =
        event.metaKey &&
        (event.code === "Space" || normalizedKey === " " || normalizedKey === "spacebar");
      if (!isShiftAltChord && !isCtrlShiftChord && !isWindowsSpaceChord) return;
      scheduleLanguageSyncBurst();
    };
    const pollIntervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void syncLanguageFromSystem();
    }, SYSTEM_LANGUAGE_SYNC_POLL_INTERVAL_MS);

    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("languagechange", handleBrowserLanguageChange);
    window.addEventListener("keydown", handlePotentialKeyboardLayoutToggle, true);
    window.addEventListener("keyup", handlePotentialKeyboardLayoutToggle, true);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      cancelled = true;
      window.clearInterval(pollIntervalId);
      clearScheduledLanguageSyncs();
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("languagechange", handleBrowserLanguageChange);
      window.removeEventListener("keydown", handlePotentialKeyboardLayoutToggle, true);
      window.removeEventListener("keyup", handlePotentialKeyboardLayoutToggle, true);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (documentAdvisorTranslationMode === "manual") return;
    setDocumentAdvisorManualTranslationLanguage(language);
  }, [documentAdvisorTranslationMode, language]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refreshProjects(activeProjectId);
      if (!cancelled) {
        setHasInitializedProjects(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeProjectId) {
      localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, activeProjectId);
    } else {
      localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
    }
  }, [activeProjectId]);

  useEffect(() => {
    if (defaultProjectId) {
      localStorage.setItem(DEFAULT_PROJECT_STORAGE_KEY, defaultProjectId);
    } else {
      localStorage.removeItem(DEFAULT_PROJECT_STORAGE_KEY);
    }
  }, [defaultProjectId]);

  useEffect(() => {
    localStorage.setItem(FAVORITE_GROUPS_STORAGE_KEY, JSON.stringify(favoriteGroups));
  }, [favoriteGroups]);

  useEffect(() => {
    localStorage.setItem(
      WORKSPACE_ROOT_NUMBERING_STORAGE_KEY,
      workspaceRootNumberingEnabled ? "1" : "0"
    );
  }, [workspaceRootNumberingEnabled]);

  useEffect(() => {
    localStorage.setItem(
      NODE_TOOLTIP_VISIBILITY_STORAGE_KEY,
      nodeTooltipsEnabled ? "1" : "0"
    );
  }, [nodeTooltipsEnabled]);

  useEffect(() => {
    localStorage.setItem(
      WORKSPACE_NODE_TABS_STORAGE_KEY,
      JSON.stringify(workspaceNodeTabSessions)
    );
  }, [workspaceNodeTabSessions]);

  useEffect(() => {
    localStorage.setItem(
      NODE_STATE_FILTER_PARENTS_STORAGE_KEY,
      includeNodeStateFilterParents ? "1" : "0"
    );
  }, [includeNodeStateFilterParents]);

  useEffect(() => {
    localStorage.setItem(
      TIMELINE_FILTER_PARENTS_STORAGE_KEY,
      includeTimelineFilterParents ? "1" : "0"
    );
  }, [includeTimelineFilterParents]);

  useEffect(() => {
    document.documentElement.lang = getLocaleForLanguage(language);
    document.documentElement.dir = isRtlLanguage(language) ? "rtl" : "ltr";
  }, [language]);

  useEffect(() => {
    writeQaChecklistState(qaChecklistStateById);
  }, [qaChecklistStateById]);

  useEffect(() => {
    if (favoriteGroups.length === 0) {
      if (selectedFavoriteGroupIds.length > 0) {
        setSelectedFavoriteGroupIds([]);
        return;
      }
      if (favoriteGroupTreeFilterEnabled) {
        setFavoriteGroupTreeFilterEnabled(false);
        return;
      }
      if (activeFavoriteGroupId !== FAVORITE_ALL_GROUP_ID) {
        setActiveFavoriteGroupId(FAVORITE_ALL_GROUP_ID);
        return;
      }
      localStorage.setItem(ACTIVE_FAVORITE_GROUP_STORAGE_KEY, FAVORITE_ALL_GROUP_ID);
      localStorage.setItem(SELECTED_FAVORITE_GROUPS_STORAGE_KEY, JSON.stringify([]));
      return;
    }

    const knownGroupIdSet = new Set(favoriteGroups.map((group) => group.id));
    const normalizedSelectedGroupIds = selectedFavoriteGroupIds.filter((groupId) =>
      knownGroupIdSet.has(groupId)
    );
    const normalizedFilterEnabled = normalizedSelectedGroupIds.length > 0;

    if (
      normalizedSelectedGroupIds.length !== selectedFavoriteGroupIds.length ||
      normalizedSelectedGroupIds.some((groupId, index) => groupId !== selectedFavoriteGroupIds[index])
    ) {
      setSelectedFavoriteGroupIds(normalizedSelectedGroupIds);
      return;
    }

    const hasActiveGroup = favoriteGroups.some((group) => group.id === activeFavoriteGroupId);
    if (activeFavoriteGroupId !== FAVORITE_ALL_GROUP_ID && !hasActiveGroup) {
      setActiveFavoriteGroupId(normalizedSelectedGroupIds[0] ?? FAVORITE_ALL_GROUP_ID);
      return;
    }

    if (
      normalizedFilterEnabled &&
      activeFavoriteGroupId !== FAVORITE_ALL_GROUP_ID &&
      !normalizedSelectedGroupIds.includes(activeFavoriteGroupId)
    ) {
      setActiveFavoriteGroupId(normalizedSelectedGroupIds[0] ?? FAVORITE_ALL_GROUP_ID);
      return;
    }

    if (favoriteGroupTreeFilterEnabled !== normalizedFilterEnabled) {
      setFavoriteGroupTreeFilterEnabled(normalizedFilterEnabled);
      return;
    }

    localStorage.setItem(ACTIVE_FAVORITE_GROUP_STORAGE_KEY, activeFavoriteGroupId);
    localStorage.setItem(
      SELECTED_FAVORITE_GROUPS_STORAGE_KEY,
      JSON.stringify(normalizedSelectedGroupIds)
    );
  }, [
    favoriteGroupTreeFilterEnabled,
    favoriteGroups,
    activeFavoriteGroupId,
    selectedFavoriteGroupIds
  ]);

  useEffect(() => {
    localStorage.setItem(
      FAVORITE_GROUP_TREE_FILTER_STORAGE_KEY,
      favoriteGroupTreeFilterEnabled ? "1" : "0"
    );
  }, [favoriteGroupTreeFilterEnabled]);

  useEffect(() => {
    activeProjectIdRef.current = activeProjectId;
  }, [activeProjectId]);

  useEffect(() => {
    currentFolderIdRef.current = store.currentFolderId;
  }, [store.currentFolderId]);

  useEffect(() => {
    selectedNodeIdRef.current = store.selectedNodeId;
  }, [store.selectedNodeId]);

  useEffect(() => {
    workspaceModeRef.current = workspaceMode;
  }, [workspaceMode]);

  useEffect(() => {
    selectionSurfaceRef.current = selectionSurface;
  }, [selectionSurface]);
  useEffect(() => {
    keyboardSurfaceRef.current = keyboardSurface;
  }, [keyboardSurface]);

  useEffect(() => {
    branchClipboardRef.current = branchClipboard;
  }, [branchClipboard]);

  useEffect(() => {
    commandBarOpenRef.current = commandBarOpen;
  }, [commandBarOpen]);

  useEffect(() => {
    editingNodeIdRef.current = editingNodeId;
  }, [editingNodeId]);

  useEffect(() => {
    editingSurfaceRef.current = editingSurface;
  }, [editingSurface]);

  useEffect(() => {
    editingValueRef.current = editingValue;
  }, [editingValue]);

  useEffect(() => {
    activeTimelineStatusFiltersRef.current = new Set(activeTimelineStatusFilters);
  }, [activeTimelineStatusFilters]);

  useEffect(() => {
    includeTimelineFilterParentsRef.current = includeTimelineFilterParents;
  }, [includeTimelineFilterParents]);

  useEffect(() => {
    if (isSidebarCollapsed) {
      setSearchDropdownOpen(false);
    }
  }, [isSidebarCollapsed]);

  useEffect(() => {
    return () => {
      if (deleteConfirmResolverRef.current) {
        deleteConfirmResolverRef.current(false);
        deleteConfirmResolverRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!contextMenu) return;

    const closeMenu = () => setContextMenu(null);
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".ode-context-menu")) return;
      closeMenu();
    };
    const onContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".ode-context-menu")) return;
      closeMenu();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (branchClipboard) {
          setBranchClipboard(null);
          setCanPasteBranch(false);
          void clearBranchClipboardFromSystem();
        }
        closeMenu();
      }
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("contextmenu", onContextMenu, true);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("contextmenu", onContextMenu, true);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu, branchClipboard]);

  const { byParent, numbering } = useMemo(
    () =>
      buildTreeMaps(store.allNodes, {
        includeWorkspaceRootNumbering: workspaceRootNumberingEnabled
      }),
    [store.allNodes, workspaceRootNumberingEnabled]
  );
  const workspaceRootSignature = useMemo(() => {
    const roots = store.allNodes
      .filter((node) => node.parentId === ROOT_PARENT_ID && node.type === "folder")
      .map((node) => `${node.id}:${node.name}`)
      .sort();
    return roots.join("|");
  }, [store.allNodes]);
  const activeProject = useMemo(() => resolveActiveProject(projects, activeProjectId), [projects, activeProjectId]);
  const aiRebuildRuntime = useMemo(() => createDefaultAiRebuildRuntime(), []);
  const activeProjectRootId = activeProject?.rootNodeId ?? null;
  const activeProjectHasLinkedFolder = hasLinkedWorkspaceFolder(activeProject);
  const activeWorkspaceNodeTabSession = useMemo<WorkspaceNodeTabSession>(
    () =>
      activeProjectRootId
        ? workspaceNodeTabSessions[activeProjectRootId] ?? { openTabs: [], activeTabId: null }
        : { openTabs: [], activeTabId: null },
    [activeProjectRootId, workspaceNodeTabSessions]
  );
  useEffect(() => {
    setAiRebuildWorkspaceOverview(null);
    setAiRebuildKnowledgeSnapshot(null);
    setAiRebuildDocumentIngestion(null);
    setAiRebuildDocumentStore(null);
    setAiRebuildWorkspaceKnowledgeSummary(null);
    setAiRebuildKnowledgeRetrieval(null);
    setAiRebuildActionPlan(null);
    setAiRebuildApprovalQueue(null);
    setAiRebuildExecutionPacket(null);
    setAiRebuildFinalSolution(null);
    setAiRebuildError(null);
  }, [activeProjectId]);
  const refreshAiRebuildStatus = useCallback(async () => {
    setAiRebuildStatusBusy(true);
    setAiRebuildError(null);
    try {
      const status = await getAiRebuildStatus();
      setAiRebuildStatus(status);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setAiRebuildError(reason);
    } finally {
      setAiRebuildStatusBusy(false);
    }
  }, []);
  const runAiRebuildWorkspaceOverview = useCallback(async () => {
    setAiRebuildWorkflowBusy(true);
    setAiRebuildError(null);
    try {
      const result = await aiRebuildRuntime.run({
        workflowId: "workspace_overview",
        input: {
          project: activeProject,
          allNodes: store.allNodes
        },
        context: {
          language,
          workspaceId: activeProjectId,
          selectedNodeIds: Array.from(selectedNodeIds)
        }
      });
      setAiRebuildWorkspaceOverview(result.output as WorkspaceOverviewOutput);
      const status = await getAiRebuildStatus();
      setAiRebuildStatus(status);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setAiRebuildError(reason);
    } finally {
      setAiRebuildWorkflowBusy(false);
    }
  }, [activeProject, activeProjectId, aiRebuildRuntime, language, selectedNodeIds, store.allNodes]);
  const runAiRebuildKnowledgeSnapshot = useCallback(async () => {
    setAiRebuildWorkflowBusy(true);
    setAiRebuildError(null);
    try {
      const result = await aiRebuildRuntime.run({
        workflowId: "knowledge_snapshot",
        input: {
          project: activeProject,
          allNodes: store.allNodes,
          selectedNodeIds: Array.from(selectedNodeIds)
        },
        context: {
          language,
          workspaceId: activeProjectId,
          selectedNodeIds: Array.from(selectedNodeIds)
        }
      });
      setAiRebuildKnowledgeSnapshot(result.output as KnowledgeSnapshotOutput);
      const status = await getAiRebuildStatus();
      setAiRebuildStatus(status);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setAiRebuildError(reason);
    } finally {
      setAiRebuildWorkflowBusy(false);
    }
  }, [activeProject, activeProjectId, aiRebuildRuntime, language, selectedNodeIds, store.allNodes]);
  const runAiRebuildDocumentIngestion = useCallback(async () => {
    setAiRebuildWorkflowBusy(true);
    setAiRebuildError(null);
    try {
      const result = await aiRebuildRuntime.run({
        workflowId: "document_ingestion_preview",
        input: {
          project: activeProject,
          allNodes: store.allNodes,
          selectedNodeIds: Array.from(selectedNodeIds)
        },
        context: {
          language,
          workspaceId: activeProjectId,
          selectedNodeIds: Array.from(selectedNodeIds)
        }
      });
      setAiRebuildDocumentIngestion(result.output as DocumentIngestionPreviewOutput);
      const status = await getAiRebuildStatus();
      setAiRebuildStatus(status);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setAiRebuildError(reason);
    } finally {
      setAiRebuildWorkflowBusy(false);
    }
  }, [activeProject, activeProjectId, aiRebuildRuntime, language, selectedNodeIds, store.allNodes]);
  const runAiRebuildDocumentStore = useCallback(async () => {
    setAiRebuildWorkflowBusy(true);
    setAiRebuildError(null);
    try {
      const result = await aiRebuildRuntime.run({
        workflowId: "document_record_store",
        input: {
          project: activeProject,
          allNodes: store.allNodes,
          selectedNodeIds: Array.from(selectedNodeIds)
        },
        context: {
          language,
          workspaceId: activeProjectId,
          selectedNodeIds: Array.from(selectedNodeIds)
        }
      });
      setAiRebuildDocumentStore(result.output as DocumentRecordStoreOutput);
      const status = await getAiRebuildStatus();
      setAiRebuildStatus(status);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setAiRebuildError(reason);
    } finally {
      setAiRebuildWorkflowBusy(false);
    }
  }, [activeProject, activeProjectId, aiRebuildRuntime, language, selectedNodeIds, store.allNodes]);
  const runAiRebuildWorkspaceKnowledgeSummary = useCallback(async () => {
    setAiRebuildWorkflowBusy(true);
    setAiRebuildError(null);
    try {
      const result = await aiRebuildRuntime.run({
        workflowId: "workspace_knowledge_summary",
        input: {
          project: activeProject,
          allNodes: store.allNodes,
          selectedNodeIds: Array.from(selectedNodeIds)
        },
        context: {
          language,
          workspaceId: activeProjectId,
          selectedNodeIds: Array.from(selectedNodeIds)
        }
      });
      setAiRebuildWorkspaceKnowledgeSummary(result.output as WorkspaceKnowledgeSummaryOutput);
      const status = await getAiRebuildStatus();
      setAiRebuildStatus(status);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setAiRebuildError(reason);
    } finally {
      setAiRebuildWorkflowBusy(false);
    }
  }, [activeProject, activeProjectId, aiRebuildRuntime, language, selectedNodeIds, store.allNodes]);
  const runAiRebuildKnowledgeRetrieval = useCallback(async (query: string) => {
    setAiRebuildWorkflowBusy(true);
    setAiRebuildError(null);
    try {
      const result = await aiRebuildRuntime.run({
        workflowId: "knowledge_retrieval_preview",
        input: {
          project: activeProject,
          allNodes: store.allNodes,
          selectedNodeIds: Array.from(selectedNodeIds),
          query
        },
        context: {
          language,
          workspaceId: activeProjectId,
          selectedNodeIds: Array.from(selectedNodeIds)
        }
      });
      setAiRebuildKnowledgeRetrieval(result.output as KnowledgeRetrievalPreviewOutput);
      const status = await getAiRebuildStatus();
      setAiRebuildStatus(status);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setAiRebuildError(reason);
    } finally {
      setAiRebuildWorkflowBusy(false);
    }
  }, [activeProject, activeProjectId, aiRebuildRuntime, language, selectedNodeIds, store.allNodes]);
  const runAiRebuildActionPlan = useCallback(async (focus: string) => {
    setAiRebuildWorkflowBusy(true);
    setAiRebuildError(null);
    try {
      const result = await aiRebuildRuntime.run({
        workflowId: "action_plan_preview",
        input: {
          project: activeProject,
          allNodes: store.allNodes,
          selectedNodeIds: Array.from(selectedNodeIds),
          focus
        },
        context: {
          language,
          workspaceId: activeProjectId,
          selectedNodeIds: Array.from(selectedNodeIds)
        }
      });
      setAiRebuildActionPlan(result.output as ActionPlanPreviewOutput);
      const status = await getAiRebuildStatus();
      setAiRebuildStatus(status);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setAiRebuildError(reason);
    } finally {
      setAiRebuildWorkflowBusy(false);
    }
  }, [activeProject, activeProjectId, aiRebuildRuntime, language, selectedNodeIds, store.allNodes]);
  const runAiRebuildApprovalQueue = useCallback(async (focus: string) => {
    setAiRebuildWorkflowBusy(true);
    setAiRebuildError(null);
    try {
      const result = await aiRebuildRuntime.run({
        workflowId: "approval_queue_preview",
        input: {
          project: activeProject,
          allNodes: store.allNodes,
          selectedNodeIds: Array.from(selectedNodeIds),
          focus
        },
        context: {
          language,
          workspaceId: activeProjectId,
          selectedNodeIds: Array.from(selectedNodeIds)
        }
      });
      setAiRebuildApprovalQueue(result.output as ApprovalQueuePreviewOutput);
      const status = await getAiRebuildStatus();
      setAiRebuildStatus(status);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setAiRebuildError(reason);
    } finally {
      setAiRebuildWorkflowBusy(false);
    }
  }, [activeProject, activeProjectId, aiRebuildRuntime, language, selectedNodeIds, store.allNodes]);
  const runAiRebuildExecutionPacket = useCallback(async (focus: string) => {
    setAiRebuildWorkflowBusy(true);
    setAiRebuildError(null);
    try {
      const result = await aiRebuildRuntime.run({
        workflowId: "execution_packet_preview",
        input: {
          project: activeProject,
          allNodes: store.allNodes,
          selectedNodeIds: Array.from(selectedNodeIds),
          focus
        },
        context: {
          language,
          workspaceId: activeProjectId,
          selectedNodeIds: Array.from(selectedNodeIds)
        }
      });
      setAiRebuildExecutionPacket(result.output as ExecutionPacketPreviewOutput);
      const status = await getAiRebuildStatus();
      setAiRebuildStatus(status);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setAiRebuildError(reason);
    } finally {
      setAiRebuildWorkflowBusy(false);
    }
  }, [activeProject, activeProjectId, aiRebuildRuntime, language, selectedNodeIds, store.allNodes]);
  const runAiRebuildFinalSolution = useCallback(async () => {
    setAiRebuildWorkflowBusy(true);
    setAiRebuildError(null);
    try {
      const result = await aiRebuildRuntime.run({
        workflowId: "final_ai_solution",
        input: {},
        context: {
          language,
          workspaceId: activeProjectId,
          selectedNodeIds: Array.from(selectedNodeIds)
        }
      });
      setAiRebuildFinalSolution(result.output as FinalAiSolutionOutput);
      const status = await getAiRebuildStatus();
      setAiRebuildStatus(status);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setAiRebuildError(reason);
    } finally {
      setAiRebuildWorkflowBusy(false);
    }
  }, [activeProjectId, aiRebuildRuntime, language, selectedNodeIds]);
  const refreshWorkspaceExternalChangeBadge = useCallback(
    async (projectId: string | null = activeProjectIdRef.current) => {
      const targetProject = projectId ? projects.find((project) => project.id === projectId) ?? null : null;
      if (!projectId || !targetProject || isInternalWorkspaceRootPath(targetProject.rootPath)) {
        setWorkspaceExternalChangeCount(0);
        setIsWorkspaceExternalChangeChecking(false);
        return;
      }

      setIsWorkspaceExternalChangeChecking(true);
      try {
        const pendingCount = await detectProjectWorkspaceExternalChanges(projectId);
        if (activeProjectIdRef.current !== projectId) return;
        setWorkspaceExternalChangeCount(Math.max(0, pendingCount));
      } catch {
        if (activeProjectIdRef.current !== projectId) return;
        setWorkspaceExternalChangeCount(0);
      } finally {
        if (activeProjectIdRef.current === projectId) {
          setIsWorkspaceExternalChangeChecking(false);
        }
      }
    },
    [projects]
  );
  useEffect(() => {
    if (!workspaceSettingsOpen) return;
    if (!AI_REBUILD_PANEL_VISIBLE) {
      void refreshWorkspaceExternalChangeBadge(activeProjectId);
      return;
    }

    void refreshWorkspaceExternalChangeBadge(activeProjectId);
    void refreshAiRebuildStatus();

    const onFocus = () => {
      void refreshWorkspaceExternalChangeBadge(activeProjectIdRef.current);
      void refreshAiRebuildStatus();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshWorkspaceExternalChangeBadge(activeProjectIdRef.current);
        void refreshAiRebuildStatus();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [workspaceSettingsOpen, activeProjectId, refreshAiRebuildStatus, refreshWorkspaceExternalChangeBadge]);

  useEffect(() => {
    if (activeProjectHasLinkedFolder) return;
    setWorkspaceExternalChangeCount(0);
    setIsWorkspaceExternalChangeChecking(false);
  }, [activeProjectHasLinkedFolder]);
  const workspaceRootIdSet = useMemo(() => new Set(projects.map((project) => project.rootNodeId)), [projects]);
  const projectScopedNodeIds = useMemo(
    () => collectProjectScopedNodeIds(activeProjectRootId, byParent),
    [activeProjectRootId, byParent]
  );
  const currentIso = useMemo(() => getIsoWeekInfo(new Date()), []);
  const currentUtcYear = useMemo(() => new Date().getUTCFullYear(), []);
  const currentTimelineWeekKey =
    currentUtcYear === timelineYear ? `${currentIso.year}-${currentIso.week}` : null;
  const timelineWeekdayLabels = useMemo(() => getWeekdayLabels(language), [language]);
  const timelineDayRanges = useMemo<TimelineDayRange[]>(
    () => {
      const start = new Date(Date.UTC(timelineYear, 0, 1));
      const end = new Date(Date.UTC(timelineYear, 11, 31));
      const days: TimelineDayRange[] = [];

      for (let cursor = new Date(start); cursor.getTime() <= end.getTime(); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        const date = new Date(cursor);
        const iso = getIsoWeekInfo(date);
        const weekdayIndex = (date.getUTCDay() + 6) % 7;
        days.push({
          week: iso.week,
          weekYear: iso.year,
          monthIndex: date.getUTCMonth(),
          year: date.getUTCFullYear(),
          date: toIsoDateOnly(date),
          weekdayIndex,
          isWeekend: weekdayIndex >= 5,
          label: timelineWeekdayLabels[weekdayIndex] ?? ""
        });
      }

      return days;
    },
    [timelineWeekdayLabels, timelineYear]
  );
  const timelineDayIndexByDate = useMemo(() => {
    const map = new Map<string, number>();
    timelineDayRanges.forEach((day, index) => {
      map.set(day.date, index);
    });
    return map;
  }, [timelineDayRanges]);

  useEffect(() => {
    if (!isDesktopRuntime || isUtilityPanelWindow || !activeProjectRootId) return;

    const releaseIds = qaAiPlan.releaseEntries.map((entry) => entry.id);
    const feedbackIds = qaFeedbackEntries.map((entry) => entry.id);
    if (!shouldAutoRunAiTester(releaseIds, feedbackIds, qaAutoRunState)) {
      return;
    }

    const testedReleaseIds = new Set(qaAutoRunState.testedReleaseIds);
    const testedFeedbackIds = new Set(qaAutoRunState.testedFeedbackIds);
    const autoRunKey = [
      ...releaseIds.filter((id) => !testedReleaseIds.has(id)),
      "--",
      ...feedbackIds.filter((id) => !testedFeedbackIds.has(id))
    ].join("|");
    if (!autoRunKey || aiTesterSessionAutoRunKeyRef.current === autoRunKey) {
      return;
    }

    aiTesterSessionAutoRunKeyRef.current = autoRunKey;
    const timer = window.setTimeout(() => {
      void runAiTester("automatic");
    }, 900);
    return () => {
      window.clearTimeout(timer);
    };
  }, [
    activeProjectRootId,
    isDesktopRuntime,
    isUtilityPanelWindow,
    qaAiPlan.releaseEntries,
    qaAutoRunState,
    qaFeedbackEntries,
    runAiTester
  ]);

  useEffect(() => {
    if (workspaceRootSignatureRef.current === null) {
      workspaceRootSignatureRef.current = workspaceRootSignature;
      return;
    }
    if (workspaceRootSignatureRef.current === workspaceRootSignature) return;
    workspaceRootSignatureRef.current = workspaceRootSignature;
    void refreshProjects(activeProjectIdRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceRootSignature]);

  useEffect(() => {
    if (activeProjectRootId) {
      setExpandedIds((prev) => {
        if (prev.has(activeProjectRootId)) return prev;
        const next = new Set(prev);
        next.add(activeProjectRootId);
        return next;
      });
      return;
    }
    const rootChildren = byParent.get(ROOT_PARENT_ID) ?? [];
    if (rootChildren.length === 0) return;
    setExpandedIds((prev) => {
      if (prev.size > 0) return prev;
      return new Set(rootChildren.map((node) => node.id));
    });
  }, [byParent, activeProjectRootId]);

  useEffect(() => {
    if (!isTauri()) {
      appWindowRef.current = null;
      setIsDesktopRuntime(false);
      return;
    }

    setIsDesktopRuntime(true);
    const currentWindow = getCurrentWindow();
    appWindowRef.current = currentWindow;
    setAppWindow(currentWindow);

    let mounted = true;
    let unlistenResized: (() => void) | null = null;
    let unlistenMoved: (() => void) | null = null;

    const syncWindowState = async () => {
      try {
        const maximized = await isDesktopWindowEffectivelyMaximized(currentWindow);
        if (!maximized) {
          desktopWindowRestoreBoundsRef.current = await captureDesktopWindowRestoreBounds(currentWindow);
        }
        if (mounted) {
          setIsWindowMaximized(maximized);
        }
      } catch {
        // Ignore window state read errors.
      }
    };

    void (async () => {
      await syncWindowState();

      if (!isUtilityPanelWindow) {
        const fullscreenApplied = await setDesktopWindowFullscreen(currentWindow, true);
        if (!fullscreenApplied) {
          await fitDesktopWindowToWorkArea({
            fillWorkArea: true,
            coverTaskbar: true,
            margin: DESKTOP_WINDOW_MAXIMIZE_MARGIN_PX
          });
        }
        await syncWindowState();
      }

      unlistenResized = await currentWindow.onResized(syncWindowState);
      unlistenMoved = await currentWindow.onMoved(syncWindowState);
    })();

    return () => {
      mounted = false;
      if (appWindowRef.current === currentWindow) {
        appWindowRef.current = null;
      }
      unlistenResized?.();
      unlistenMoved?.();
    };
  }, [isUtilityPanelWindow]);

  useEffect(() => {
    void (async () => {
      try {
        const mirrorPath = await callNative<string>("get_mirror_root");
        setMirrorStatus({ kind: "synced", path: normalizeMirrorDisplayPath(mirrorPath) });
      } catch {
        setMirrorStatus({ kind: "pending" });
      }
    })();
  }, []);

  useDesktopMirrorSync({
    isDesktopRuntime,
    activeProjectRootId,
    currentFolderId: store.currentFolderId,
    refreshTree: store.refreshTree,
    navigateTo: store.navigateTo,
    suspendSync: desktopUploadSessionActive
  });

  useEffect(() => {
    const query = store.searchQuery.trim();
    if (!query) {
      setSearchActiveIndex(0);
      setSearchDropdownOpen(false);
      return;
    }

    const handle = window.setTimeout(() => {
      if (workspaceMode !== "timeline") {
        void store.runSearch(query);
      }
      setSearchDropdownOpen(true);
      setSearchActiveIndex(0);
    }, 220);

    return () => {
      window.clearTimeout(handle);
    };
  }, [store.runSearch, store.searchQuery, workspaceMode]);

  const selectedNode = useMemo(
    () => store.allNodes.find((node) => node.id === store.selectedNodeId) ?? null,
    [store.allNodes, store.selectedNodeId]
  );
  const selectedFavoriteGroupFilterIds = useMemo(() => {
    if (!favoriteGroupTreeFilterEnabled) return [] as string[];
    const knownGroupIdSet = new Set(favoriteGroups.map((group) => group.id));
    return selectedFavoriteGroupIds.filter((groupId) => knownGroupIdSet.has(groupId));
  }, [favoriteGroupTreeFilterEnabled, favoriteGroups, selectedFavoriteGroupIds]);
  const hasActiveFavoriteGroupTreeFiltering = selectedFavoriteGroupFilterIds.length > 0;
  const desktopMirrorRootId = hasActiveFavoriteGroupTreeFiltering
    ? activeProjectRootId
    : store.currentFolderId;
  const desktopMirrorParentId =
    desktopMirrorRootId ?? (hasActiveFavoriteGroupTreeFiltering ? activeProjectRootId ?? ROOT_PARENT_ID : ROOT_PARENT_ID);
  const desktopMirrorChildren = useMemo(
    () => byParent.get(desktopMirrorParentId) ?? [],
    [byParent, desktopMirrorParentId]
  );
  const procedureBaseRootNode = useMemo(() => {
    const rootId = desktopMirrorRootId ?? activeProjectRootId ?? null;
    if (!rootId) return null;
    return store.allNodes.find((node) => node.id === rootId) ?? null;
  }, [activeProjectRootId, desktopMirrorRootId, store.allNodes]);
  const procedureRootNode = useMemo(() => {
    if (!procedureBaseRootNode) return null;
    const isProjectRootProcedure =
      desktopMirrorRootId !== null && activeProjectRootId !== null && desktopMirrorRootId === activeProjectRootId;
    if (!isProjectRootProcedure || !selectedNode) {
      return procedureBaseRootNode;
    }
    if (projectScopedNodeIds && !projectScopedNodeIds.has(selectedNode.id)) {
      return procedureBaseRootNode;
    }
    if (selectedNode.id === procedureBaseRootNode.id) {
      return procedureBaseRootNode;
    }

    const nodeByIdLocal = new Map(store.allNodes.map((node) => [node.id, node]));
    const path: AppNode[] = [];
    const visited = new Set<string>();
    let current: AppNode | null = selectedNode;

    while (current) {
      if (visited.has(current.id)) break;
      visited.add(current.id);
      path.unshift(current);
      if (current.id === procedureBaseRootNode.id) break;
      if (!current.parentId || current.parentId === ROOT_PARENT_ID) break;
      current = nodeByIdLocal.get(current.parentId) ?? null;
    }

    if (path.length > 1 && path[0]?.id === procedureBaseRootNode.id) {
      return path[1] ?? procedureBaseRootNode;
    }
    return procedureBaseRootNode;
  }, [activeProjectRootId, desktopMirrorRootId, procedureBaseRootNode, projectScopedNodeIds, selectedNode, store.allNodes]);
  const procedureSelectedNode = useMemo(() => {
    if (!procedureRootNode) return null;
    if (!selectedNode) return procedureRootNode;
    if (projectScopedNodeIds && !projectScopedNodeIds.has(selectedNode.id)) return procedureRootNode;
    if (selectedNode.id === procedureRootNode.id) return selectedNode;

    const nodeByIdLocal = new Map(store.allNodes.map((node) => [node.id, node]));
    const visited = new Set<string>();
    let current: AppNode | null = selectedNode;

    while (current) {
      if (current.id === procedureRootNode.id) return selectedNode;
      if (visited.has(current.id)) break;
      visited.add(current.id);
      if (!current.parentId || current.parentId === ROOT_PARENT_ID) break;
      current = nodeByIdLocal.get(current.parentId) ?? null;
    }

    return procedureRootNode;
  }, [procedureRootNode, projectScopedNodeIds, selectedNode, store.allNodes]);
  useEffect(() => {
    activeProjectRootIdRef.current = activeProjectRootId;
  }, [activeProjectRootId]);
  useEffect(() => {
    desktopViewModeRef.current = desktopViewMode;
  }, [desktopViewMode]);
  useEffect(() => {
    if (workspaceMode !== "grid") {
      if (documentationModeActive) {
        setDocumentationModeActive(false);
        const previousFilters = documentationPreviousNodeStateFiltersRef.current;
        documentationPreviousNodeStateFiltersRef.current = null;
        if (previousFilters) {
          setActiveNodeStateFilters(new Set(previousFilters));
        }
      }
      return;
    }
    if (desktopViewMode === "procedure") {
      if (!documentationModeActive) {
        setDocumentationModeActive(true);
      }
      return;
    }
    if (!documentationModeActive) return;
    setDesktopViewMode("procedure");
    if (selectionSurface !== "tree") {
      setSelectionSurface("tree");
    }
    if (keyboardSurface !== "procedure") {
      setKeyboardSurface("procedure");
    }
  }, [desktopViewMode, documentationModeActive, keyboardSurface, selectionSurface, workspaceMode]);
  useEffect(() => {
    if (desktopViewMode !== "procedure") {
      desktopBrowseViewModeRef.current = desktopViewMode;
    }
  }, [desktopViewMode]);
  useEffect(() => {
    procedureRootNodeIdRef.current = procedureRootNode?.id ?? null;
  }, [procedureRootNode?.id]);
  useEffect(() => {
    procedureSelectedNodeIdRef.current = procedureSelectedNode?.id ?? null;
  }, [procedureSelectedNode?.id]);
  const mindMapReviewNode = useMemo(
    () => store.allNodes.find((node) => node.id === mindMapReviewNodeId) ?? null,
    [store.allNodes, mindMapReviewNodeId]
  );
  const mindMapReviewMediaPreviewKind = useMemo<DesktopMediaPreviewKind | null>(
    () => (mindMapReviewNode ? getDesktopMediaPreviewKind(mindMapReviewNode) : null),
    [mindMapReviewNode]
  );
  const mindMapReviewMediaPreviewSrc = useMemo(
    () =>
      mindMapReviewNode && mindMapReviewMediaPreviewKind
        ? resolveDesktopPreviewSrc(mindMapReviewNode)
        : null,
    [mindMapReviewNode, mindMapReviewMediaPreviewKind]
  );
  const mindMapReviewIsPowerPoint = useMemo(
    () =>
      Boolean(
        mindMapReviewNode &&
          POWERPOINT_PREVIEW_EXTENSIONS.has(extractFileExtensionLower(mindMapReviewNode.name))
      ),
    [mindMapReviewNode]
  );
  const mindMapReviewIsTextPreviewCandidate = useMemo(
    () =>
      Boolean(
        mindMapReviewNode &&
          TEXT_PREVIEW_EXTENSIONS.has(extractFileExtensionLower(mindMapReviewNode.name))
      ),
    [mindMapReviewNode]
  );
  const mindMapReviewPowerPointSlideSrcs = useMemo(
    () =>
      mindMapReviewNode &&
      mindMapPowerPointPreviewState.nodeId === mindMapReviewNode.id &&
      mindMapPowerPointPreviewState.status === "ready"
        ? mindMapPowerPointPreviewState.slidePaths
            .map((path) => (typeof path === "string" ? path.trim() : ""))
            .filter((value) => value.length > 0)
        : [],
    [mindMapPowerPointPreviewState, mindMapReviewNode]
  );
  const mindMapReviewPreviewKind = useMemo<DesktopMediaPreviewKind | "text" | "powerpoint" | null>(() => {
    if (mindMapReviewMediaPreviewKind) return mindMapReviewMediaPreviewKind;
    if (mindMapReviewPowerPointSlideSrcs.length > 0) return "powerpoint";
    if (
      mindMapReviewNode &&
      mindMapTextPreviewState.nodeId === mindMapReviewNode.id &&
      mindMapTextPreviewState.status === "ready" &&
      typeof mindMapTextPreviewState.text === "string" &&
      (mindMapReviewIsTextPreviewCandidate || mindMapTextPreviewState.text.length > 0)
    ) {
      return "text";
    }
    return null;
  }, [
    mindMapReviewIsTextPreviewCandidate,
    mindMapReviewMediaPreviewKind,
    mindMapReviewNode,
    mindMapReviewPowerPointSlideSrcs,
    mindMapTextPreviewState
  ]);
  const mindMapReviewPreviewLoading =
    mindMapReviewNode !== null &&
    !mindMapReviewMediaPreviewKind &&
    ((mindMapReviewIsPowerPoint &&
      mindMapPowerPointPreviewState.nodeId === mindMapReviewNode.id &&
      mindMapPowerPointPreviewState.status === "loading") ||
      (!mindMapReviewIsPowerPoint &&
        mindMapTextPreviewState.nodeId === mindMapReviewNode.id &&
        mindMapTextPreviewState.status === "loading"));
  const mindMapReviewPreviewError =
    mindMapReviewIsPowerPoint && mindMapReviewNode
      ? mindMapPowerPointPreviewState.nodeId === mindMapReviewNode.id &&
        mindMapPowerPointPreviewState.status === "error"
          ? mindMapPowerPointPreviewState.error
          : null
      : mindMapReviewNode &&
          mindMapTextPreviewState.nodeId === mindMapReviewNode.id &&
          mindMapTextPreviewState.status === "error"
        ? mindMapTextPreviewState.error
        : null;

  useEffect(() => {
    if (workspaceMode === "grid") return;
    setMindMapReviewNodeId(null);
  }, [workspaceMode]);

  useEffect(() => {
    const nextSelectionSurface = resolveProcedureSelectionSurface({
      workspaceMode,
      desktopViewMode,
      selectionSurface
    });
    if (!nextSelectionSurface) return;
    setSelectionSurface(nextSelectionSurface);
  }, [desktopViewMode, selectionSurface, workspaceMode]);

  const getSavedMistralApiKey = (): string | null => {
    try {
      const raw = localStorage.getItem("odetool.ai.keys.v1");
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { mistralKeys?: string[] };
      if (!parsed.mistralKeys || parsed.mistralKeys.length === 0) return null;
      const key = parsed.mistralKeys.find((item) => item.trim().length > 0)?.trim();
      return key ?? null;
    } catch {
      return null;
    }
  };

  const nodeById = useMemo(() => {
    const map = new Map<string, AppNode>();
    for (const node of store.allNodes) {
      map.set(node.id, node);
    }
    return map;
  }, [store.allNodes]);
  const footerQuickAppTargetNode = useMemo(() => {
    const currentFolderNode =
      store.currentFolderId && store.currentFolderId !== ROOT_PARENT_ID
        ? nodeById.get(store.currentFolderId) ?? null
        : null;
    if (selectedNode) return selectedNode;
    if (currentFolderNode) return currentFolderNode;
    if (activeProjectRootId) return nodeById.get(activeProjectRootId) ?? null;
    return null;
  }, [activeProjectRootId, nodeById, selectedNode, store.currentFolderId]);
  const footerQuickApps = useMemo(
    () => getNodeQuickApps(footerQuickAppTargetNode),
    [footerQuickAppTargetNode]
  );
  const reorderFooterQuickApps = useCallback(
    async (nextQuickApps: NodeQuickAppItem[]) => {
      const node = footerQuickAppTargetNode;
      if (!node) return;

      const normalizedQuickApps = normalizeNodeQuickApps(nextQuickApps);
      const currentQuickApps = getNodeQuickApps(node);
      const currentOrder = currentQuickApps.map((item) => item.id).join("|");
      const nextOrder = normalizedQuickApps.map((item) => item.id).join("|");
      if (currentOrder === nextOrder) return;

      const previousProperties = node.properties;
      const nextProperties = buildNodeQuickAppsProperties(previousProperties, normalizedQuickApps);
      store.patchNode(node.id, {
        properties: nextProperties,
        updatedAt: Date.now()
      });

      try {
        await updateNodeProperties(node.id, nextProperties);
      } catch (error) {
        store.patchNode(node.id, {
          properties: previousProperties,
          updatedAt: Date.now()
        });
        setProjectError(
          t("quick_apps.launch_failed", {
            name: node.name,
            reason: error instanceof Error ? error.message : String(error)
          })
        );
      }
    },
    [footerQuickAppTargetNode, store, t]
  );
  const workspaceStructureLocked = Boolean(
    activeProjectRootId && isNodeStructureLockOwner(nodeById.get(activeProjectRootId) ?? null)
  );
  const getStructureLockOwner = useCallback(
    (nodeId: string | null | undefined) => findStructureLockOwner(nodeId, nodeById),
    [nodeById]
  );
  const ensureStructureMutationAllowed = useCallback(
    (
      nodeIds: Array<string | null | undefined>,
      options?: { scope?: WorkspaceStructureMutationScope }
    ) => {
      const resolveNodeMutationScope = (nodeId: string | null | undefined): WorkspaceStructureMutationScope => {
        const node =
          nodeId
            ? nodeById.get(nodeId) ?? store.allNodes.find((candidate) => candidate.id === nodeId) ?? null
            : null;
        if (getExecutionTaskMeta(node)) return "workarea";
        if (isWorkareaItemNode(node)) return "workarea";
        if (isFileLikeNode(node)) return "content";
        return options?.scope ?? "organization";
      };

      for (const nodeId of nodeIds) {
        const owner = getStructureLockOwner(nodeId);
        if (!owner) continue;
        const mutationScope = options?.scope ?? resolveNodeMutationScope(nodeId);
        const isWorkspaceRootLock = Boolean(activeProjectRootId && owner.id === activeProjectRootId);
        if (isWorkspaceRootLock && mutationScope !== "organization") {
          continue;
        }
        setProjectNotice(null);
        setProjectError(t("structure_lock.blocked_notice", { name: owner.name }));
        return false;
      }
      return true;
    },
    [activeProjectRootId, getStructureLockOwner, nodeById, store.allNodes, t]
  );
  const setNodeStructureLocked = useCallback(
    async (nodeId: string, locked: boolean) => {
      const node = nodeById.get(nodeId) ?? null;
      if (!node) return;
      if (!locked && node.id !== activeProjectRootId && !isNodeStructureLockOwner(node)) return;
      if (locked && node.id !== activeProjectRootId) return;
      const targetNode =
        locked && activeProjectRootId
          ? nodeById.get(activeProjectRootId) ?? node
          : node;
      const nextProperties = applyNodeStructureLock(
        targetNode.properties as Record<string, unknown> | undefined,
        locked
      );
      await updateNodeProperties(targetNode.id, nextProperties);
      store.patchNode(targetNode.id, {
        properties: Object.keys(nextProperties).length > 0 ? nextProperties : undefined,
        updatedAt: Date.now()
      });
      setProjectError(null);
      setProjectNotice(
        locked
          ? t("structure_lock.locked_notice", { name: targetNode.name })
          : t("structure_lock.unlocked_notice", { name: targetNode.name })
      );
    },
    [activeProjectRootId, nodeById, store, t]
  );
  const getNodeTypeDisplayLabel = useCallback(
    (node: AppNode): string => {
      if (isWorkareaItemNode(node)) {
        const storedKind = node.properties?.odeWorkareaItemKind;
        const workareaKind =
          storedKind === "deliverable" || storedKind === "task" || storedKind === "subtask"
            ? storedKind
            : getWorkareaItemKind(node, nodeById);
        if (workareaKind === "deliverable") return t("procedure.node_deliverable_default");
        if (workareaKind === "task") return t("procedure.node_task_default");
        if (workareaKind === "subtask") return t("procedure.node_subtask_default");
      }
      if (node.type === "folder") return t("node_type.folder");
      if (isFileLikeNode(node)) {
        const ext = extractFileExtensionLabel(node.name);
        return ext ? t("node_type.file_ext", { ext }) : t("node_type.file");
      }
      if (node.type === "ticket") return t("node_type.ticket");
      return humanizeNodeType(node.type);
    },
    [nodeById, t]
  );

  useEffect(() => {
    const nextSurfaceState = resolveSurfaceStateForWorkspaceMode({
      workspaceMode,
      keyboardSurface,
      selectionSurface
    });
    if (nextSurfaceState.selectionSurface) {
      setSelectionSurface(nextSurfaceState.selectionSurface);
    }
    if (nextSurfaceState.keyboardSurface) {
      setKeyboardSurface(nextSurfaceState.keyboardSurface);
    }
    const selectedNode = store.selectedNodeId ? nodeById.get(store.selectedNodeId) ?? null : null;
    if (selectedNode && isHiddenExecutionTaskNode(selectedNode)) {
      const ownerNodeId = getExecutionTaskMeta(selectedNode)?.ownerNodeId ?? activeProjectRootId ?? null;
      setPrimarySelection(ownerNodeId, "grid");
    }
  }, [activeProjectRootId, keyboardSurface, nodeById, selectionSurface, store.selectedNodeId, workspaceMode]);

  const canResolveInitialWorkspaceView = useMemo(
    () =>
      canResolveInitialWorkspaceViewState({
        hasInitializedProjects,
        storeStatus: store.status,
        activeProjectId,
        activeProjectRootId,
        currentFolderId: store.currentFolderId,
        nodeById,
        projectScopedNodeIds
      }),
    [
      activeProjectId,
      activeProjectRootId,
      hasInitializedProjects,
      nodeById,
      projectScopedNodeIds,
      store.currentFolderId,
      store.status
    ]
  );
  useEffect(() => {
    if (hasResolvedInitialWorkspaceView) return;
    if (!canResolveInitialWorkspaceView) return;
    setHasResolvedInitialWorkspaceView(true);
  }, [canResolveInitialWorkspaceView, hasResolvedInitialWorkspaceView]);
  const showWorkspaceEmptyState = hasResolvedInitialWorkspaceView;
  const nodeStateFilterSignature = useMemo(
    () => Array.from(activeNodeStateFilters).sort().join("|"),
    [activeNodeStateFilters]
  );

  useEffect(() => {
    if (!hasResolvedInitialWorkspaceView) return;
    if (documentationModeActive && workspaceMode === "grid") return;
    if (lastAppliedFilterViewSignatureRef.current === nodeStateFilterSignature) return;
    lastAppliedFilterViewSignatureRef.current = nodeStateFilterSignature;

    const preferredView = resolvePreferredViewForNodeStateFilters(activeNodeStateFilters);
    const preferredKeyboardSurface = resolvePreferredKeyboardSurface(preferredView);
    const canAutoAdjustCurrentSurface = workspaceMode === preferredView.workspaceMode;
    const shouldUpdateDesktopViewMode =
      canAutoAdjustCurrentSurface &&
      preferredView.desktopViewMode !== undefined &&
      desktopViewMode !== preferredView.desktopViewMode;
    const shouldUpdateSelectionSurface =
      canAutoAdjustCurrentSurface && selectionSurface !== preferredView.selectionSurface;
    const shouldUpdateKeyboardSurface =
      canAutoAdjustCurrentSurface && keyboardSurface !== preferredKeyboardSurface;

    if (
      !shouldUpdateDesktopViewMode &&
      !shouldUpdateSelectionSurface &&
      !shouldUpdateKeyboardSurface
    ) {
      return;
    }

    if (shouldUpdateDesktopViewMode && preferredView.desktopViewMode !== undefined) {
      setDesktopViewMode(preferredView.desktopViewMode);
    }
    if (shouldUpdateSelectionSurface) {
      setSelectionSurface(preferredView.selectionSurface);
    }
    if (shouldUpdateKeyboardSurface) {
      setKeyboardSurface(preferredKeyboardSurface);
    }
  }, [
    activeNodeStateFilters,
    desktopViewMode,
    documentationModeActive,
    hasResolvedInitialWorkspaceView,
    keyboardSurface,
    nodeStateFilterSignature,
    selectionSurface,
    workspaceMode
  ]);

  useEffect(() => {
    const nextKeyboardSurface = resolveKeyboardSurfaceAfterProcedure({
      desktopViewMode,
      keyboardSurface,
      selectionSurface,
      workspaceMode
    });
    if (!nextKeyboardSurface) return;
    setKeyboardSurface(nextKeyboardSurface);
  }, [desktopViewMode, keyboardSurface, selectionSurface, workspaceMode]);

  useEffect(() => {
    const nextFocusMode = deriveWorkspaceFocusMode(activeNodeStateFilters);
    if (workspaceMode !== "grid" || desktopViewMode !== "mindmap" || nextFocusMode === "structure") return;
    setDesktopViewMode("grid");
    setSelectionSurface("grid");
    setKeyboardSurface("grid");
  }, [activeNodeStateFilters, desktopViewMode, workspaceMode]);

  useEffect(() => {
    if (workspaceMode !== "grid" || desktopViewMode !== "mindmap") return;
    if (mindMapContentMode !== "node_tree") {
      setMindMapContentMode("node_tree");
    }
    if (mindMapOrientation !== "horizontal") {
      setMindMapOrientation("horizontal");
    }
  }, [desktopViewMode, mindMapContentMode, mindMapOrientation, workspaceMode]);

  const nodeLevelById = useMemo(() => {
    const map = new Map<string, number>();
    const visited = new Set<string>();

    const walk = (nodeId: string, level: number) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      map.set(nodeId, level);
      const children = byParent.get(nodeId) ?? [];
      for (const child of children) {
        walk(child.id, level + 1);
      }
    };

    const rootNodes = byParent.get(ROOT_PARENT_ID) ?? [];
    for (const rootNode of rootNodes) {
      walk(rootNode.id, 1);
    }

    for (const node of store.allNodes) {
      if (map.has(node.id)) continue;
      walk(node.id, 1);
    }

    return map;
  }, [store.allNodes, byParent]);

  const scopedNumbering = useMemo(
    () =>
      buildScopedNumbering({
        activeProjectRootId,
        numbering,
        nodeById,
        byParent,
        workspaceRootNumberingEnabled,
        consumesTreeNumbering: (node) =>
          !isFileLikeNode(node) && !isHiddenExecutionTaskNode(node)
      }),
    [activeProjectRootId, numbering, nodeById, byParent, workspaceRootNumberingEnabled]
  );
  const tooltipEditorNode = useMemo(
    () => (tooltipEditorNodeId ? nodeById.get(tooltipEditorNodeId) ?? null : null),
    [nodeById, tooltipEditorNodeId]
  );
  const openNodeTooltipEditor = useCallback(
    (nodeId: string) => {
      const node = nodeById.get(nodeId) ?? null;
      if (!node || isFileLikeNode(node)) return;
      setTooltipEditorNodeId(node.id);
      setTooltipEditorValue(typeof node.description === "string" ? node.description : "");
    },
    [nodeById]
  );
  const closeNodeTooltipEditor = useCallback(() => {
    if (tooltipEditorSaving) return;
    setTooltipEditorNodeId(null);
    setTooltipEditorValue("");
  }, [tooltipEditorSaving]);

  const quickAppsModalNode = useMemo(
    () => (quickAppsModalNodeId ? nodeById.get(quickAppsModalNodeId) ?? null : null),
    [nodeById, quickAppsModalNodeId]
  );
  const openNodeQuickAppsModal = useCallback(
    (nodeId: string) => {
      const node = nodeById.get(nodeId) ?? null;
      if (!node) return;
      const nextQuickApps = getNodeQuickApps(node);
      setQuickAppsModalNodeId(node.id);
      setQuickAppsDraftItems(
        nextQuickApps.length > 0
          ? nextQuickApps.map((item) => ({
              ...item
            }))
          : [createNodeQuickAppItem()]
      );
    },
    [nodeById]
  );
  const closeNodeQuickAppsModal = useCallback(() => {
    if (quickAppsSaving) return;
    setQuickAppsModalNodeId(null);
    setQuickAppsDraftItems([]);
  }, [quickAppsSaving]);

  useEffect(() => {
    if (!tooltipEditorNodeId || tooltipEditorNode || tooltipEditorSaving) return;
    setTooltipEditorNodeId(null);
    setTooltipEditorValue("");
  }, [tooltipEditorNode, tooltipEditorNodeId, tooltipEditorSaving]);

  useEffect(() => {
    if (!quickAppsModalNodeId || quickAppsModalNode || quickAppsSaving) return;
    setQuickAppsModalNodeId(null);
    setQuickAppsDraftItems([]);
  }, [quickAppsModalNode, quickAppsModalNodeId, quickAppsSaving]);

  const tooltipQuickEditTargetNode = useMemo(() => {
    const resolveEditableNode = (node: AppNode | null): AppNode | null => {
      if (!node) return null;

      if (isFileLikeNode(node)) {
        const parentId =
          node.parentId && node.parentId !== ROOT_PARENT_ID ? node.parentId : activeProjectRootId ?? null;
        if (!parentId) return null;
        if (projectScopedNodeIds && !projectScopedNodeIds.has(parentId)) return null;
        const parentNode = nodeById.get(parentId) ?? null;
        return parentNode && !isFileLikeNode(parentNode) ? parentNode : null;
      }

      if (projectScopedNodeIds && !projectScopedNodeIds.has(node.id)) return null;
      return node;
    };

    const currentFolderNode =
      store.currentFolderId ? nodeById.get(store.currentFolderId) ?? null : null;
    const activeProjectRootNode =
      activeProjectRootId ? nodeById.get(activeProjectRootId) ?? null : null;

    return (
      resolveEditableNode(selectedNode) ??
      resolveEditableNode(currentFolderNode) ??
      resolveEditableNode(activeProjectRootNode)
    );
  }, [activeProjectRootId, nodeById, projectScopedNodeIds, selectedNode, store.currentFolderId]);

  const openQuickEditNodeDescription = useCallback(() => {
    if (!tooltipQuickEditTargetNode) return;
    openNodeTooltipEditor(tooltipQuickEditTargetNode.id);
  }, [openNodeTooltipEditor, tooltipQuickEditTargetNode]);

  const resolveCachedNodeById = useCallback(
    (nodeId: string | null | undefined): AppNode | null => {
      if (!nodeId) return null;
      return nodeById.get(nodeId) ?? store.allNodes.find((node) => node.id === nodeId) ?? null;
    },
    [nodeById, store.allNodes]
  );

  const resolveNavigableFolderIdFromNode = useCallback(
    (node: AppNode | null): string | null => {
      if (!node) return null;
      if (isFileLikeNode(node)) {
        return node.parentId && node.parentId !== ROOT_PARENT_ID ? node.parentId : activeProjectRootId ?? null;
      }
      return node.id;
    },
    [activeProjectRootId]
  );

  const resolveNodeByIdWithFallback = useCallback(
    async (nodeId: string | null | undefined): Promise<AppNode | null> => {
      const cachedNode = resolveCachedNodeById(nodeId);
      if (cachedNode) return cachedNode;
      if (!nodeId) return null;
      return (await getNode(nodeId)) ?? null;
    },
    [resolveCachedNodeById]
  );

  const buildFolderRestoreCandidateIds = useCallback(
    (preferredFolderId: string | null | undefined, relatedNodeIds: Array<string | null | undefined> = []) => {
      const orderedIds: string[] = [];
      const seenIds = new Set<string>();

      const appendNodeAndAncestors = (nodeId: string | null | undefined) => {
        let currentId = nodeId ?? null;
        const visited = new Set<string>();
        while (currentId && !visited.has(currentId)) {
          visited.add(currentId);
          const cachedNode = resolveCachedNodeById(currentId);
          const candidateId = cachedNode ? resolveNavigableFolderIdFromNode(cachedNode) : currentId;
          if (candidateId && !seenIds.has(candidateId)) {
            seenIds.add(candidateId);
            orderedIds.push(candidateId);
          }
          if (!cachedNode || cachedNode.parentId === ROOT_PARENT_ID) {
            break;
          }
          currentId = cachedNode.parentId;
        }
      };

      appendNodeAndAncestors(preferredFolderId);
      for (const nodeId of relatedNodeIds) {
        appendNodeAndAncestors(nodeId);
      }

      if (activeProjectRootId && !seenIds.has(activeProjectRootId)) {
        orderedIds.push(activeProjectRootId);
      }

      return orderedIds;
    },
    [activeProjectRootId, resolveCachedNodeById, resolveNavigableFolderIdFromNode]
  );

  const resolveExistingFolderRestoreId = useCallback(
    async (
      preferredFolderId: string | null | undefined,
      relatedNodeIds: Array<string | null | undefined> = []
    ): Promise<string | null> => {
      const candidateIds = buildFolderRestoreCandidateIds(preferredFolderId, relatedNodeIds);
      for (const candidateId of candidateIds) {
        const candidateNode = await resolveNodeByIdWithFallback(candidateId);
        const navigableFolderId = resolveNavigableFolderIdFromNode(candidateNode);
        if (navigableFolderId) {
          return navigableFolderId;
        }
        if (candidateId && candidateId === activeProjectRootId) {
          return activeProjectRootId;
        }
      }
      return activeProjectRootId ?? null;
    },
    [activeProjectRootId, buildFolderRestoreCandidateIds, resolveNavigableFolderIdFromNode, resolveNodeByIdWithFallback]
  );

  const resolveMutationTargetNode = useCallback(
    async (targetNodeId?: string | null): Promise<AppNode | null> => {
      if (targetNodeId === undefined) {
        return selectedNode ?? (await resolveNodeByIdWithFallback(selectedNodeIdRef.current));
      }
      return resolveNodeByIdWithFallback(targetNodeId);
    },
    [resolveNodeByIdWithFallback, selectedNode]
  );

  const folderNodeStateById = useMemo(() => {
    const stateMap = new Map<string, FolderNodeState>();
    const hasDataMemo = new Map<string, boolean>();
    const hasScheduleMemo = new Map<string, boolean>();

    const resolveHasData = (nodeId: string): boolean => {
      if (hasDataMemo.has(nodeId)) return hasDataMemo.get(nodeId) ?? false;
      const children = byParent.get(nodeId) ?? [];
      let hasData = false;
      for (const child of children) {
        if (isFileLikeNode(child) || resolveHasData(child.id)) {
          hasData = true;
          break;
        }
      }
      hasDataMemo.set(nodeId, hasData);
      return hasData;
    };

    const resolveHasSchedule = (nodeId: string): boolean => {
      if (hasScheduleMemo.has(nodeId)) return hasScheduleMemo.get(nodeId) ?? false;
      const node = nodeById.get(nodeId) ?? null;
      if (!node || isFileLikeNode(node)) {
        hasScheduleMemo.set(nodeId, false);
        return false;
      }

      if (parseNodeTimelineSchedule(node)) {
        hasScheduleMemo.set(nodeId, true);
        return true;
      }

      const children = byParent.get(nodeId) ?? [];
      const hasChildSchedule = children.some((child) => !isFileLikeNode(child) && resolveHasSchedule(child.id));
      hasScheduleMemo.set(nodeId, hasChildSchedule);
      return hasChildSchedule;
    };

    for (const node of store.allNodes) {
      if (isFileLikeNode(node)) continue;
      const hasSchedule = resolveHasSchedule(node.id);
      const hasData = resolveHasData(node.id);
      stateMap.set(node.id, resolveFolderNodeState(hasSchedule, hasData));
    }
    return stateMap;
  }, [byParent, nodeById, store.allNodes]);
  const filterFolderNodeStateById = useMemo(() => {
    const stateMap = new Map<string, FolderNodeState>();
    for (const node of store.allNodes) {
      if (isFileLikeNode(node)) continue;
      const children = byParent.get(node.id) ?? [];
      const hasOwnData = children.some((child) => isFileLikeNode(child));
      const hasOwnSchedule = hasOwnNodeSchedule(node, children.length);
      stateMap.set(node.id, resolveFolderNodeState(hasOwnSchedule, hasOwnData));
    }
    return stateMap;
  }, [store.allNodes, byParent]);

  const favoriteNodesAll = useMemo(() => {
    return buildFavoriteNodes<AppNode>({
      nodes: store.allNodes,
      projectScopedNodeIds,
      isFavoriteNode: isNodeFavorite,
      primaryOrderById: scopedNumbering,
      fallbackOrderById: numbering
    });
  }, [store.allNodes, projectScopedNodeIds, scopedNumbering, numbering]);

  const favoriteNodes = useMemo(() => {
    return filterFavoriteNodesBySelectedGroups<AppNode>({
      selectedFavoriteGroupIds: selectedFavoriteGroupFilterIds,
      favoriteNodes: favoriteNodesAll,
      getNodeGroupIds: (node) => getNodeFavoriteGroupIds(node)
    });
  }, [favoriteNodesAll, selectedFavoriteGroupFilterIds]);

  const quickAccessMindMapGroups = useMemo(() => {
    return buildQuickAccessMindMapGroups<AppNode>({
      favoriteGroups,
      activeFavoriteGroupId,
      allGroupId: FAVORITE_ALL_GROUP_ID,
      favoriteNodes,
      getNodeGroupIds: (node) => getNodeFavoriteGroupIds(node),
      ungroupedId: "__ungrouped__",
      ungroupedName: t("favorites.group_ungrouped")
    });
  }, [favoriteGroups, favoriteNodes, activeFavoriteGroupId, t]);

  const quickAccessMindMapDirectFavorites = useMemo(() => {
    if (favoriteGroups.length > 0) return [] as AppNode[];
    return favoriteNodes;
  }, [favoriteGroups.length, favoriteNodes]);

  useEffect(() => {
    if (!activeProjectRootId) return;
    if (!nodeById.has(activeProjectRootId)) return;
    const currentFolderId = store.currentFolderId;
    if (currentFolderId && projectScopedNodeIds?.has(currentFolderId)) return;
    void store.navigateTo(activeProjectRootId);
    store.setSelectedNodeId(activeProjectRootId);
  }, [activeProjectRootId, nodeById, projectScopedNodeIds, store.currentFolderId, store.navigateTo, store.setSelectedNodeId]);

  const effectiveTimelineScheduleByNodeId = useMemo(() => {
    return buildEffectiveTimelineScheduleMap<NodeTimelineSchedule>({
      nodes: store.allNodes,
      nodeById,
      byParent,
      parseNodeTimelineSchedule,
      shouldRespectManualSchedule: (node, current, children, childSchedules) => {
        if (!current || current.mode !== "manual") return false;
        if (childSchedules.length === 0) return true;
        if (!isWorkareaItemNode(node)) return false;
        return !children.some((child) => isWorkareaItemNode(child));
      },
      compareIsoDate,
      createRollupSchedule: (node, childSchedules, earliestStart, latestEnd) =>
        normalizeTimelineSchedule({
          title: node.name,
          status: getAggregateStatusFromChildren(childSchedules),
          startDate: earliestStart,
          endDate: latestEnd,
          assignees: [],
          priority: "normal",
          progress: getAggregateProgressFromChildren(childSchedules),
          predecessor: "",
          mode: "auto"
        })
    });
  }, [byParent, nodeById, store.allNodes]);

  useEffect(() => {
    if (store.allNodes.length === 0) return;
    if (autoScheduleSyncInFlightRef.current) return;

    let cancelled = false;

    void (async () => {
      const updates = buildAutoSchedulePropertyUpdates({
        nodes: store.allNodes,
        byParent,
        parseNodeTimelineSchedule,
        effectiveScheduleByNodeId: effectiveTimelineScheduleByNodeId,
        areSchedulesEquivalent
      });
      if (updates.length === 0 || cancelled) return;

      autoScheduleSyncInFlightRef.current = true;
      try {
        for (const update of updates) {
          await updateNodeProperties(update.id, update.nextProperties);
        }
        if (cancelled) return;
        const currentFolderSnapshot = store.currentFolderId;
        const restoreFolderId = await resolveExistingFolderRestoreId(currentFolderSnapshot);
        await store.refreshTree();
        await store.navigateTo(restoreFolderId);
      } finally {
        autoScheduleSyncInFlightRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    store.allNodes,
    store.currentFolderId,
    store.navigateTo,
    store.refreshTree,
    byParent,
    effectiveTimelineScheduleByNodeId,
    resolveExistingFolderRestoreId
  ]);

  const scheduleModalNode = useMemo(
    () => (scheduleModalNodeId ? nodeById.get(scheduleModalNodeId) ?? null : null),
    [scheduleModalNodeId, nodeById]
  );

  useEffect(() => {
    if (!scheduleModalNodeId) return;
    if (!nodeById.has(scheduleModalNodeId)) {
      setScheduleModalOpen(false);
      setScheduleModalNodeId(null);
    }
  }, [scheduleModalNodeId, nodeById]);

  const searchFocusMode = deriveWorkspaceFocusMode(activeNodeStateFilters);
  const searchUsesNodeStateScope =
    activeNodeStateFilters.size > 0 && !areAllNodeStateFiltersSelected(activeNodeStateFilters);
  const searchResults = useMemo<SidebarSearchResult[]>(
    () =>
      buildSidebarSearchResults({
        searchQuery: store.searchQuery,
        searchResults: store.searchResults,
        nodeById,
        projectScopedNodeIds,
        searchUsesNodeStateScope,
        searchFocusMode,
        activeNodeStateFilters,
        filterFolderNodeStateById,
        doesNodeMatchNodeStateFilters
      }),
    [
      store.searchQuery,
      store.searchResults,
      nodeById,
      projectScopedNodeIds,
      searchUsesNodeStateScope,
      searchFocusMode,
      activeNodeStateFilters,
      filterFolderNodeStateById
    ]
  );

  const writeBranchClipboardToSystem = async (payload: BranchClipboard) => {
    const serialized = serializeBranchClipboard(payload);
    try {
      if (isTauri()) {
        await writeClipboardText(serialized);
      } else if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(serialized);
      }
    } catch {
      // Keep in-memory clipboard as fallback if OS clipboard write fails.
    }
  };

  const readSystemClipboardText = async (): Promise<string> => {
    let raw = "";
    try {
      if (isTauri()) {
        raw = await readClipboardText();
      } else if (navigator?.clipboard?.readText) {
        raw = await navigator.clipboard.readText();
      }
    } catch {
      return "";
    }
    return raw;
  };

  const readWindowsClipboardFilePaths = async (): Promise<string[]> => {
    if (!isDesktopRuntime) return [];
    try {
      const paths = await callNative<string[]>("get_windows_clipboard_file_paths");
      const dedupe = new Set<string>();
      return paths
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
        .filter((value) => {
          const key = value.toLowerCase();
          if (dedupe.has(key)) return false;
          dedupe.add(key);
          return true;
        });
    } catch {
      return [];
    }
  };

  const readBranchClipboardFromSystem = async (): Promise<BranchClipboard | null> => {
    const windowsClipboardFiles = await readWindowsClipboardFilePaths();
    if (windowsClipboardFiles.length > 0) return null;
    const raw = await readSystemClipboardText();
    if (!raw) return null;
    return parseBranchClipboard(raw);
  };

  const clearBranchClipboardFromSystem = async () => {
    try {
      if (isTauri()) {
        await writeClipboardText("");
      } else if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText("");
      }
    } catch {
      // Ignore clipboard clear failures.
    }
  };

  const writePlainTextToClipboard = async (text: string) => {
    if (isTauri()) {
      await writeClipboardText(text);
      return;
    }
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    throw new Error("Clipboard API unavailable.");
  };

  const closeTextEditContextMenu = () => {
    setTextEditContextMenu(null);
  };

  const focusInlineEditInputAt = (selectionStart: number, selectionEnd: number = selectionStart) => {
    window.requestAnimationFrame(() => {
      const input = inlineEditInputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(selectionStart, selectionEnd);
    });
  };

  useEffect(() => {
    const pending = pendingInlineEditSelectionRef.current;
    if (!pending) return;
    if (editingNodeId !== pending.nodeId || editingSurface !== pending.surface) return;
    focusInlineEditInputAt(pending.start, pending.end);
    pendingInlineEditSelectionRef.current = null;
  }, [editingNodeId, editingSurface, editingValue]);

  const replaceInlineEditRange = (start: number, end: number, replacement: string) => {
    const safeStart = Math.max(0, Math.min(start, editingValue.length));
    const safeEnd = Math.max(safeStart, Math.min(end, editingValue.length));
    const nextValue = `${editingValue.slice(0, safeStart)}${replacement}${editingValue.slice(safeEnd)}`;
    setEditingValue(nextValue);
    focusInlineEditInputAt(safeStart + replacement.length);
  };

  const runTextEditMenuCopy = async () => {
    if (!textEditContextMenu) return;
    const { selectionStart, selectionEnd } = textEditContextMenu;
    if (selectionEnd <= selectionStart) return;
    const selectedText = editingValue.slice(selectionStart, selectionEnd);
    if (!selectedText) return;
    await writePlainTextToClipboard(selectedText);
    focusInlineEditInputAt(selectionStart, selectionEnd);
    closeTextEditContextMenu();
  };

  const runTextEditMenuCut = async () => {
    if (!textEditContextMenu) return;
    const { selectionStart, selectionEnd } = textEditContextMenu;
    if (selectionEnd <= selectionStart) return;
    const selectedText = editingValue.slice(selectionStart, selectionEnd);
    if (!selectedText) return;
    await writePlainTextToClipboard(selectedText);
    replaceInlineEditRange(selectionStart, selectionEnd, "");
    closeTextEditContextMenu();
  };

  const runTextEditMenuPaste = async () => {
    if (!textEditContextMenu) return;
    const raw = await readSystemClipboardText();
    if (!raw) return;
    replaceInlineEditRange(textEditContextMenu.selectionStart, textEditContextMenu.selectionEnd, raw);
    closeTextEditContextMenu();
  };

  const runTextEditMenuSelectAll = () => {
    focusInlineEditInputAt(0, editingValue.length);
    closeTextEditContextMenu();
  };

  const runTextEditMenuSuggestion = (suggestion: string) => {
    if (!textEditContextMenu || !textEditContextMenu.word) return;
    const target = resolveInlineEditSpellTarget(
      editingValue,
      textEditContextMenu.selectionStart,
      textEditContextMenu.selectionEnd
    );
    const start = target?.start ?? textEditContextMenu.selectionStart;
    const end = target?.end ?? textEditContextMenu.selectionEnd;
    replaceInlineEditRange(start, end, suggestion);
    closeTextEditContextMenu();
  };

  useEffect(() => {
    let cancelled = false;

    if (!contextMenu) {
      setCanPasteBranch(Boolean(branchClipboard));
      return () => {
        cancelled = true;
      };
    }

    if (branchClipboard) {
      setCanPasteBranch(true);
      return () => {
        cancelled = true;
      };
    }

    setCanPasteBranch(false);
    void (async () => {
      if (isDesktopRuntime) {
        try {
          const windowsClipboardFiles = await callNative<string[]>("get_windows_clipboard_file_paths");
          if (cancelled) return;
          if (windowsClipboardFiles.length > 0) {
            setCanPasteBranch(true);
            return;
          }
        } catch {
          // Fall back to text clipboard parsing.
        }
      }
      const raw = await readSystemClipboardText();
      if (cancelled) return;
      const clipboard = raw ? parseBranchClipboard(raw) : null;
      if (cancelled) return;
      if (clipboard) {
        setCanPasteBranch(true);
        setBranchClipboard(clipboard);
      } else {
        const externalFiles = raw ? parseFilePathsFromClipboardText(raw) : [];
        const plainText = raw.replace(/\r\n/g, "\n").trim();
        setCanPasteBranch(externalFiles.length > 0 || plainText.length > 0);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contextMenu, branchClipboard, isDesktopRuntime]);

  const currentWorkspaceFocusModeForRows = deriveWorkspaceFocusMode(activeNodeStateFilters);
  const currentTimelineModeForRows = resolveTimelineMode(currentWorkspaceFocusModeForRows);

  const treeRows = useMemo(() => {
    const rows: TreeRow[] = [];
    const splitTreeChildrenForDisplay = (nodes: AppNode[]) =>
      nodes.filter((node) => !isFileLikeNode(node));
    const shouldHideTreeRowNode = (node: AppNode) => {
      if (isFileLikeNode(node)) {
        return true;
      }
      if (isHiddenExecutionTaskNode(node)) {
        return true;
      }
      if (isWorkareaItemNode(node) && currentWorkspaceFocusModeForRows !== "execution") {
        return true;
      }
      return false;
    };

    const visit = (parentId: string, level: number) => {
      const branchNodes = splitTreeChildrenForDisplay(byParent.get(parentId) ?? []);
      for (const child of branchNodes) {
        if (shouldHideTreeRowNode(child)) {
          continue;
        }
        const hasChildren = splitTreeChildrenForDisplay(byParent.get(child.id) ?? []).some((rowChild) => !shouldHideTreeRowNode(rowChild));
        rows.push({
          id: child.id,
          node: child,
          level,
          indexLabel: scopedNumbering.get(child.id) ?? "",
          hasChildren
        });
        if (hasChildren && expandedIds.has(child.id)) {
          visit(child.id, level + 1);
        }
      }
    };

    if (activeProjectRootId) {
      const rootNode = nodeById.get(activeProjectRootId);
      if (!rootNode) return rows;
      const rootHasChildren = splitTreeChildrenForDisplay(byParent.get(rootNode.id) ?? []).some(
        (child) => !shouldHideTreeRowNode(child)
      );
      rows.push({
        id: rootNode.id,
        node: rootNode,
        level: 0,
        indexLabel: scopedNumbering.get(rootNode.id) ?? "",
        hasChildren: rootHasChildren
      });
      if (rootHasChildren && expandedIds.has(rootNode.id)) {
        visit(rootNode.id, 1);
      }
      return rows;
    }

    visit(ROOT_PARENT_ID, 0);
    return rows;
  }, [
    activeProjectRootId,
    byParent,
    currentWorkspaceFocusModeForRows,
    expandedIds,
    nodeById,
    scopedNumbering
  ]);

  const timelineRows = useMemo(() => {
    return buildTimelineTreeRows({
      activeProjectRootId,
      nodeById,
      byParent,
      expandedIds,
      scopedNumbering,
      isHiddenExecutionTaskNode,
      isRenderableExecutionProjectionNode,
      shouldHideNode: (node) =>
        isFileLikeNode(node) || (isWorkareaItemNode(node) && currentTimelineModeForRows !== "tasks")
    });
  }, [
    activeProjectRootId,
    byParent,
    expandedIds,
    nodeById,
    scopedNumbering,
    currentTimelineModeForRows,
    isRenderableExecutionProjectionNode
  ]);
  const timelineVisibleRowIdSet = useMemo(
    () => new Set(timelineRows.map((row) => row.id)),
    [timelineRows]
  );

  const cutPendingNodeIds = useMemo(() => {
    if (!branchClipboard || branchClipboard.mode !== "cut") return new Set<string>();
    const ids = new Set<string>();
    const sourceIds = branchClipboard.sourceNodeIds.length > 0 ? branchClipboard.sourceNodeIds : [branchClipboard.sourceNodeId];
    for (const sourceId of sourceIds) {
      if (!nodeById.has(sourceId)) continue;
      const stack = [sourceId];
      while (stack.length > 0) {
        const current = stack.pop();
        if (!current || ids.has(current)) continue;
        ids.add(current);
        const children = byParent.get(current) ?? [];
        for (const child of children) {
          stack.push(child.id);
        }
      }
    }
    return ids;
  }, [branchClipboard, byParent, nodeById]);

  const timelineScheduleByNodeId = useMemo(() => {
    const baseMap = buildTimelineScheduleLookup<NodeTimelineSchedule>({
      nodes: store.allNodes,
      projectScopedNodeIds,
      effectiveScheduleByNodeId: effectiveTimelineScheduleByNodeId,
      timelineDayIndexByDate,
      timelineDayRanges,
      parseIsoDateOnly,
      toIsoDateOnly
    });
    const nextMap = new Map(baseMap);
    const fallbackMemo = new Map<
      string,
      | {
          schedule: NodeTimelineSchedule;
          startDayIndex: number;
          endDayIndex: number;
          durationDays: number;
        }
      | null
    >();

    const resolveVisibleRollup = (
      nodeId: string
    ):
      | {
          schedule: NodeTimelineSchedule;
          startDayIndex: number;
          endDayIndex: number;
          durationDays: number;
        }
      | null => {
      if (fallbackMemo.has(nodeId)) {
        return fallbackMemo.get(nodeId) ?? null;
      }

      const existing = nextMap.get(nodeId) ?? null;
      if (existing) {
        fallbackMemo.set(nodeId, existing);
        return existing;
      }

      const node = nodeById.get(nodeId) ?? null;
      if (!node || isFileLikeNode(node)) {
        fallbackMemo.set(nodeId, null);
        return null;
      }

      const childEntries = (byParent.get(nodeId) ?? [])
        .map((child) => resolveVisibleRollup(child.id))
        .filter(
          (
            entry
          ): entry is {
            schedule: NodeTimelineSchedule;
            startDayIndex: number;
            endDayIndex: number;
            durationDays: number;
          } => Boolean(entry)
        );

      if (childEntries.length === 0) {
        fallbackMemo.set(nodeId, null);
        return null;
      }

      const startDayIndex = childEntries.reduce(
        (lowest, entry) => Math.min(lowest, entry.startDayIndex),
        childEntries[0]?.startDayIndex ?? -1
      );
      const endDayIndex = childEntries.reduce(
        (highest, entry) => Math.max(highest, entry.endDayIndex),
        childEntries[0]?.endDayIndex ?? -1
      );
      const startDay = timelineDayRanges[startDayIndex] ?? null;
      const endDay = timelineDayRanges[endDayIndex] ?? null;
      if (!startDay || !endDay) {
        fallbackMemo.set(nodeId, null);
        return null;
      }

      const childSchedules = childEntries.map((entry) => entry.schedule);
      const rollupEntry = {
        schedule: normalizeTimelineSchedule({
          title: node.name,
          status: getAggregateStatusFromChildren(childSchedules),
          startDate: startDay.date,
          endDate: endDay.date,
          assignees: [],
          priority: "normal",
          progress: getAggregateProgressFromChildren(childSchedules),
          predecessor: "",
          mode: "auto"
        }),
        startDayIndex,
        endDayIndex,
        durationDays: Math.max(1, endDayIndex - startDayIndex + 1)
      };
      nextMap.set(nodeId, rollupEntry);
      fallbackMemo.set(nodeId, rollupEntry);
      return rollupEntry;
    };

    if (projectScopedNodeIds) {
      projectScopedNodeIds.forEach((nodeId) => {
        void resolveVisibleRollup(nodeId);
      });
    } else {
      store.allNodes.forEach((node) => {
        void resolveVisibleRollup(node.id);
      });
    }

    return nextMap;
  }, [
    byParent,
    effectiveTimelineScheduleByNodeId,
    nodeById,
    projectScopedNodeIds,
    store.allNodes,
    timelineDayIndexByDate,
    timelineDayRanges
  ]);
  const assistantTreeSnapshot = useMemo(() => {
    const lines: string[] = [];
    const visited = new Set<string>();
    const limit = 220;
    const appendNode = (nodeId: string, level: number) => {
      if (lines.length >= limit) return;
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      const node = nodeById.get(nodeId);
      if (
        !node ||
        isFileLikeNode(node) ||
        isHiddenExecutionTaskNode(node) ||
        (isWorkareaItemNode(node) && currentWorkspaceFocusModeForRows !== "execution")
      ) {
        return;
      }
      const children = byParent.get(nodeId) ?? [];
      const folderChildren = children.filter(
        (child) =>
          !isFileLikeNode(child) &&
          !isHiddenExecutionTaskNode(child) &&
          !(isWorkareaItemNode(child) && currentWorkspaceFocusModeForRows !== "execution")
      ).length;
      const fileChildren = children.length - folderChildren;
      const schedule = parseNodeTimelineSchedule(node);
      const scheduleText = schedule
        ? `${schedule.startDate} -> ${schedule.endDate} (${schedule.status})`
        : "none";
      const nodeState = folderNodeStateById.get(node.id) ?? "empty";
      const numberLabel = scopedNumbering.get(node.id) ?? numbering.get(node.id) ?? "?";
      const indent = "  ".repeat(Math.min(level, 8));
      lines.push(
        `${indent}- [${numberLabel}] ${node.name} | state=${getFolderNodeStateLabel(nodeState)} | schedule=${scheduleText} | childFolders=${folderChildren} | directFiles=${fileChildren}`
      );
      for (const child of children) {
        if (
          isFileLikeNode(child) ||
          isHiddenExecutionTaskNode(child) ||
          (isWorkareaItemNode(child) && currentWorkspaceFocusModeForRows !== "execution")
        ) {
          continue;
        }
        appendNode(child.id, level + 1);
      }
    };
    if (activeProjectRootId) {
      appendNode(activeProjectRootId, 0);
    } else {
      const roots = byParent.get(ROOT_PARENT_ID) ?? [];
      for (const root of roots) {
        if (isFileLikeNode(root)) continue;
        appendNode(root.id, 0);
      }
    }
    if (lines.length >= limit) {
      lines.push(`... snapshot truncated to first ${limit} folder nodes.`);
    }
    return lines.join("\n");
  }, [
    activeProjectRootId,
    byParent,
    currentWorkspaceFocusModeForRows,
    folderNodeStateById,
    nodeById,
    numbering,
    scopedNumbering
  ]);

  const hasActiveNodeStateFiltering =
    activeNodeStateFilters.size > 0 && !areAllNodeStateFiltersSelected(activeNodeStateFilters);
  const workspaceFocusMode = currentWorkspaceFocusModeForRows;
  const timelineMode = resolveTimelineMode(workspaceFocusMode);
  useEffect(() => {
    if (workspaceFocusMode !== "data") return;
    setActiveNodeStateFilters(createAllNodeStateFilters());
  }, [workspaceFocusMode]);
  const workspaceEmptyOnly = workspaceFocusMode === "structure" && isStructureEmptyOnlyMode(activeNodeStateFilters);
  const treeUsesNodeStateFiltering =
    hasActiveNodeStateFiltering && (workspaceFocusMode === "structure" || workspaceFocusMode === "execution");
  function isRenderableExecutionProjectionNode(node: AppNode | null | undefined): boolean {
    return isRenderableExecutionProjectionNodeState({
      node,
      nodeById,
      getExecutionTaskMeta,
      normalizeExecutionTaskItems
    });
  }

  const workareaOwnerNodeIds = useMemo(
    () =>
      collectWorkareaOwnerNodeIds({
        candidates: store.allNodes,
        visibleScope: projectScopedNodeIds,
        nodeById,
        byParent
      }),
    [byParent, nodeById, projectScopedNodeIds, store.allNodes]
  );
  const workareaAvailable = workareaOwnerNodeIds.size > 0;
  useEffect(() => {
    if (workareaAvailable || workspaceFocusMode !== "execution") return;
    setExecutionQuickOpenDeliverableId(null);
    setContextMenu((current) => (current?.workareaMode ? null : current));
    setActiveNodeStateFilters(createAllNodeStateFilters());
  }, [workareaAvailable, workspaceFocusMode]);
  const executionOwnerNodeIds = useMemo(() => {
    const ownerIds = collectExecutionOwnerNodeIds({
      candidates: store.allNodes,
      visibleScope: projectScopedNodeIds,
      getExecutionTaskMeta,
      isRenderableExecutionProjectionNode
    });
    workareaOwnerNodeIds.forEach((ownerId) => ownerIds.add(ownerId));
    return ownerIds;
  }, [getExecutionTaskMeta, isRenderableExecutionProjectionNode, projectScopedNodeIds, store.allNodes, workareaOwnerNodeIds]);
  const desktopWorkareaOwnerNodeId = useMemo(() => {
    if (workspaceMode !== "grid" || workspaceFocusMode !== "execution") return null;
    const selectedNodeId = store.selectedNodeId ?? null;
    if (selectedNodeId) {
      const ownerNodeId = resolveWorkareaOwnerNodeId(selectedNodeId);
      if (ownerNodeId) return ownerNodeId;
    }
    const currentFolderId = store.currentFolderId ?? null;
    if (currentFolderId) {
      const ownerNodeId = resolveWorkareaOwnerNodeId(currentFolderId);
      if (ownerNodeId) return ownerNodeId;
    }
    return Array.from(workareaOwnerNodeIds)[0] ?? null;
  }, [
    resolveWorkareaOwnerNodeId,
    workareaOwnerNodeIds,
    store.currentFolderId,
    store.selectedNodeId,
    workspaceFocusMode,
    workspaceMode
  ]);
  const desktopWorkareaOwnerNode = useMemo(
    () => (desktopWorkareaOwnerNodeId ? nodeById.get(desktopWorkareaOwnerNodeId) ?? null : null),
    [desktopWorkareaOwnerNodeId, nodeById]
  );
  const desktopWorkareaScopeNodeIds = useMemo(() => {
    if (!desktopWorkareaOwnerNodeId) return null;
    const next = new Set<string>([desktopWorkareaOwnerNodeId]);
    const stack = [...((byParent.get(desktopWorkareaOwnerNodeId) ?? []).filter((child) => isWorkareaItemNode(child)))];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || next.has(current.id)) continue;
      next.add(current.id);
      for (const child of (byParent.get(current.id) ?? []).filter((candidate) => isWorkareaItemNode(candidate))) {
        stack.push(child);
      }
    }
    return next;
  }, [byParent, desktopWorkareaOwnerNodeId]);
  const desktopWorkareaOwnerOptions = useMemo(() => {
    return Array.from(workareaOwnerNodeIds)
      .map((nodeId) => nodeById.get(nodeId) ?? null)
      .filter((node): node is AppNode => node !== null && !isFileLikeNode(node))
      .sort((left, right) => {
        const leftLabel = scopedNumbering.get(left.id) ?? left.name;
        const rightLabel = scopedNumbering.get(right.id) ?? right.name;
        return leftLabel.localeCompare(rightLabel, language, { numeric: true, sensitivity: "base" });
      });
  }, [language, nodeById, scopedNumbering, workareaOwnerNodeIds]);
  const desktopWorkareaBrowseNodeId = useMemo(() => {
    if (!desktopWorkareaOwnerNodeId) return null;
    const currentFolderId = store.currentFolderId ?? null;
    if (currentFolderId) {
      const currentFolderNode = nodeById.get(currentFolderId) ?? null;
      if (
        currentFolderNode &&
        !isFileLikeNode(currentFolderNode) &&
        (currentFolderNode.id === desktopWorkareaOwnerNodeId ||
          (isWorkareaItemNode(currentFolderNode) &&
            getWorkareaOwnerNodeId(currentFolderNode, nodeById) === desktopWorkareaOwnerNodeId))
      ) {
        return currentFolderNode.id;
      }
    }
    return desktopWorkareaOwnerNodeId;
  }, [desktopWorkareaOwnerNodeId, nodeById, store.currentFolderId]);
  const desktopWorkareaScopedTreeRows = useMemo(() => {
    if (!desktopWorkareaOwnerNode) {
      return [] as Array<{
        id: string;
        node: AppNode;
        level: number;
        indexLabel: string;
        hasChildren: boolean;
      }>;
    }
    const rows: Array<{
      id: string;
      node: AppNode;
      level: number;
      indexLabel: string;
      hasChildren: boolean;
    }> = [];
    const visitNode = (node: AppNode, level: number) => {
      const children = (byParent.get(node.id) ?? []).filter(
        (child) => !isHiddenExecutionTaskNode(child) && isWorkareaItemNode(child)
      );
      rows.push({
        id: node.id,
        node,
        level,
        indexLabel: scopedNumbering.get(node.id) ?? "",
        hasChildren: children.length > 0
      });
      if (!expandedIds.has(node.id)) return;
      for (const child of children) {
        visitNode(child, level + 1);
      }
    };
    visitNode(desktopWorkareaOwnerNode, 0);
    return rows;
  }, [byParent, desktopWorkareaOwnerNode, expandedIds, isHiddenExecutionTaskNode, scopedNumbering]);
  const desktopWorkareaScopedGridNodes = useMemo(() => {
    if (!desktopWorkareaBrowseNodeId) return [] as AppNode[];
    return (byParent.get(desktopWorkareaBrowseNodeId) ?? []).filter(
      (node) => !isHiddenExecutionTaskNode(node) && isWorkareaItemNode(node)
    );
  }, [byParent, desktopWorkareaBrowseNodeId, isHiddenExecutionTaskNode]);
  const desktopSidebarSearchResults = useMemo(() => {
    if (workspaceMode !== "grid" || workspaceFocusMode !== "execution") {
      return searchResults.filter((result) => !isFileLikeNode(result.node));
    }
    if (!desktopWorkareaScopeNodeIds) return [];
    return searchResults.filter(
      (result) => !isFileLikeNode(result.node) && desktopWorkareaScopeNodeIds.has(result.node.id)
    );
  }, [desktopWorkareaScopeNodeIds, searchResults, workspaceFocusMode, workspaceMode]);
  const favoriteGroupDisplayNodes = useMemo(() => {
    if (!hasActiveFavoriteGroupTreeFiltering) return [] as AppNode[];
    return favoriteNodes.filter((node) => {
      if (isFileLikeNode(node)) return false;
      if (isHiddenExecutionTaskNode(node)) return false;
      if (isWorkareaItemNode(node) && workspaceFocusMode !== "execution") return false;
      if (!treeUsesNodeStateFiltering) return true;
      return doesNodeMatchNodeStateFilters(
        node,
        activeNodeStateFilters,
        filterFolderNodeStateById,
        executionOwnerNodeIds
      );
    });
  }, [
    activeNodeStateFilters,
    executionOwnerNodeIds,
    favoriteNodes,
    filterFolderNodeStateById,
    hasActiveFavoriteGroupTreeFiltering,
    treeUsesNodeStateFiltering,
    workspaceFocusMode
  ]);
  const favoriteGroupDisplayRows = useMemo(
    () =>
      favoriteGroupDisplayNodes.map((node) => ({
        id: node.id,
        node,
        level: 0,
        indexLabel: scopedNumbering.get(node.id) ?? "",
        hasChildren: false
      })),
    [favoriteGroupDisplayNodes, scopedNumbering]
  );
  const isTimelineNodeFlagged = useCallback(
    (nodeId: string) => {
      return resolveTimelineNodeFlagged({
        nodeId,
        nodeById,
        timelineScheduleByNodeId
      });
    },
    [nodeById, timelineScheduleByNodeId]
  );
  const sortTimelineNodesForDisplay = useCallback(
    (nodes: AppNode[]) => {
      return sortTimelineNodesByFlaggedState({
        nodes,
        prioritizeFlagged: prioritizeFlaggedTimelineTasks,
        isTimelineNodeFlagged
      });
    },
    [isTimelineNodeFlagged, prioritizeFlaggedTimelineTasks]
  );
  const areAllTimelineStatusesSelected =
    activeTimelineStatusFilters.size > 0 &&
    areAllTimelineStatusFiltersSelected(activeTimelineStatusFilters);
  const hasActiveTimelineStatusFiltering =
    activeTimelineStatusFilters.size > 0 &&
    !areAllTimelineStatusesSelected;
  const areAllTimelinePrioritiesSelected =
    activeTimelinePriorityFilters.size > 0 &&
    areAllTimelinePriorityFiltersSelected(activeTimelinePriorityFilters);
  const hasActiveTimelinePriorityFiltering =
    activeTimelinePriorityFilters.size > 0 &&
    !areAllTimelinePrioritiesSelected;
  const hasActiveTimelineScheduleFiltering =
    hasActiveTimelineStatusFiltering || hasActiveTimelinePriorityFiltering;
  const isExecutionOnlyNodeStateFilter =
    hasActiveNodeStateFiltering &&
    activeNodeStateFilters.size === 1 &&
    activeNodeStateFilters.has("execution");
  const forceTaskFilterParents = hasActiveNodeStateFiltering && shouldForceTaskFilterParents(activeNodeStateFilters);
  const includeTimelineBranchParents =
    forceTaskFilterParents ||
    (hasActiveNodeStateFiltering && hasActiveTimelineScheduleFiltering
      ? includeNodeStateFilterParents || includeTimelineFilterParents
      : hasActiveNodeStateFiltering
        ? includeNodeStateFilterParents
        : includeTimelineFilterParents);
  const timelineSearchResults = useMemo<SidebarSearchResult[]>(() => {
    return buildTimelineSearchResults({
      searchQuery: store.searchQuery,
      nodes: store.allNodes,
      nodeById,
      projectScopedNodeIds,
      timelineScheduleByNodeId,
      hasActiveTimelineStatusFiltering,
      hasActiveTimelinePriorityFiltering,
      activeTimelineStatusFilters,
      activeTimelinePriorityFilters,
      timelineVisibleRowIdSet,
      timelineMode,
      isExecutionTaskNode: (node) => Boolean(getExecutionTaskMeta(node)) || isWorkareaItemNode(node),
      isRenderableExecutionProjectionNode,
      prioritizeFlaggedTimelineTasks,
      isTimelineNodeFlagged
    });
  }, [
    store.searchQuery,
    store.allNodes,
    nodeById,
    projectScopedNodeIds,
    timelineScheduleByNodeId,
    hasActiveTimelineStatusFiltering,
    hasActiveTimelinePriorityFiltering,
    activeTimelineStatusFilters,
    activeTimelinePriorityFilters,
    timelineVisibleRowIdSet,
    timelineMode,
    isRenderableExecutionProjectionNode,
    isTimelineNodeFlagged,
    prioritizeFlaggedTimelineTasks
  ]);
  const hasTimelineTaskSearch = workspaceMode === "timeline" && store.searchQuery.trim().length > 0;
  const desktopEmptyStateMessage =
    workspaceFocusMode === "execution"
      ? desktopWorkareaOwnerNode
        ? t("procedure.node_execution_empty")
        : t("procedure.node_execution_owner_required")
      : workspaceFocusMode === "data"
      ? t("grid.empty_documents")
      : hasActiveNodeStateFiltering
        ? t("grid.empty_filtered")
        : t("grid.empty");
  const desktopShowCreateFirstNodeAction =
    workspaceFocusMode === "execution"
      ? Boolean(desktopWorkareaOwnerNodeId)
      : workspaceFocusMode === "data"
        ? false
        : !hasActiveNodeStateFiltering;
  const timelineEmptyStateMessage = getTimelineEmptyStateMessage(
    t,
    timelineMode,
    hasTimelineTaskSearch,
    hasActiveTimelineScheduleFiltering
  );
  const timelineShowCreateFirstNodeAction = shouldShowTimelineCreateFirstNodeAction(
    timelineMode,
    hasTimelineTaskSearch,
    hasActiveTimelineScheduleFiltering
  );
  const displayedTreeRows = useMemo(() => {
    const rows = (() => {
    if (workspaceMode === "grid" && workspaceFocusMode === "execution") {
      return desktopWorkareaScopedTreeRows;
    }
    if (hasActiveFavoriteGroupTreeFiltering) return favoriteGroupDisplayRows;
    if (!treeUsesNodeStateFiltering) return treeRows;
    return buildFilteredWorkspaceTreeRows({
      activeProjectRootId,
      nodeById,
      byParent,
      matchesNodeState: (node) =>
        !treeUsesNodeStateFiltering ||
        doesNodeMatchNodeStateFilters(
          node,
          activeNodeStateFilters,
          filterFolderNodeStateById,
          executionOwnerNodeIds
        ),
      matchesFavoriteGroup: () => true,
      includeBranchParents:
        treeUsesNodeStateFiltering && (includeNodeStateFilterParents || forceTaskFilterParents),
      scopedNumbering,
      isHiddenExecutionTaskNode,
      shouldHideNode: (node) =>
        isWorkareaItemNode(node) && workspaceFocusMode !== "execution",
      forceTaskFilterParents
    });
    })();
    return rows.filter((row) => !isFileLikeNode(row.node));
  }, [
    activeNodeStateFilters,
    activeProjectRootId,
    byParent,
    favoriteGroupDisplayRows,
    filterFolderNodeStateById,
    hasActiveFavoriteGroupTreeFiltering,
    treeUsesNodeStateFiltering,
    includeNodeStateFilterParents,
    forceTaskFilterParents,
    executionOwnerNodeIds,
    nodeById,
    scopedNumbering,
    treeRows,
    desktopWorkareaOwnerNode,
    desktopWorkareaScopedTreeRows,
    workspaceMode,
    workspaceFocusMode
  ]);
  const canExpandAllTreeNodes =
    workspaceMode === "grid" && workspaceFocusMode === "execution"
      ? displayedTreeRows.some((row) => row.hasChildren && !expandedIds.has(row.id))
      : !hasActiveFavoriteGroupTreeFiltering &&
        !treeUsesNodeStateFiltering &&
        displayedTreeRows.some((row) => row.hasChildren);
  const canCollapseAllTreeNodes =
    workspaceMode === "grid" && workspaceFocusMode === "execution"
      ? displayedTreeRows.some((row) => row.hasChildren && expandedIds.has(row.id))
      : !hasActiveFavoriteGroupTreeFiltering &&
        !treeUsesNodeStateFiltering &&
        expandedIds.size > 0;
  const displayedTimelineRows = useMemo(() => {
    const matchedTimelineSearchNodeIds = hasTimelineTaskSearch
      ? new Set(timelineSearchResults.map((result) => result.node.id))
      : null;

    return buildDisplayedTimelineRows({
      timelineMode,
      hasTimelineTaskSearch,
      matchedTimelineSearchNodeIds,
      isExecutionOnlyNodeStateFilter,
      includeNodeStateFilterParents,
      hasActiveNodeStateFiltering,
      hasActiveTimelineScheduleFiltering,
      prioritizeFlaggedTimelineTasks,
      timelineRows,
      timelineVisibleRowIdSet,
      activeProjectRootId,
      nodeById,
      byParent,
      numbering,
      scopedNumbering,
      expandedIds,
      candidates: store.allNodes,
      visibleScope: projectScopedNodeIds,
      getExecutionTaskMeta,
      isRenderableExecutionProjectionNode,
      timelineScheduleByNodeId,
      filterState: {
        hasActiveTimelineStatusFiltering,
        activeTimelineStatusFilters,
        hasActiveTimelinePriorityFiltering,
        activeTimelinePriorityFilters
      },
      includeTimelineBranchParents,
      isHiddenExecutionTaskNode,
      isTimelineNodeFlagged,
      sortTimelineNodesForDisplay,
      matchesNodeState: (node) =>
        !hasActiveNodeStateFiltering ||
        doesNodeMatchNodeStateFilters(
          node,
          activeNodeStateFilters,
          filterFolderNodeStateById,
          executionOwnerNodeIds
        ),
      shouldHideNode: (node) => isFileLikeNode(node) || (isWorkareaItemNode(node) && timelineMode !== "tasks")
    });
  }, [
    hasTimelineTaskSearch,
    timelineMode,
    timelineSearchResults,
    isExecutionOnlyNodeStateFilter,
    hasActiveNodeStateFiltering,
    hasActiveTimelineStatusFiltering,
    hasActiveTimelinePriorityFiltering,
    hasActiveTimelineScheduleFiltering,
    prioritizeFlaggedTimelineTasks,
    timelineRows,
    timelineVisibleRowIdSet,
    byParent,
    nodeById,
    activeNodeStateFilters,
    filterFolderNodeStateById,
    executionOwnerNodeIds,
    numbering,
    projectScopedNodeIds,
    store.allNodes,
    timelineScheduleByNodeId,
    activeTimelineStatusFilters,
    activeTimelinePriorityFilters,
    includeTimelineBranchParents,
    includeNodeStateFilterParents,
    scopedNumbering,
    activeProjectRootId,
    isRenderableExecutionProjectionNode,
    sortTimelineNodesForDisplay,
    timelineMode
  ]);
  const canExpandAllTimelineNodes = displayedTimelineRows.some(
    (row) => row.hasChildren && !expandedIds.has(row.id)
  );
  const canCollapseAllTimelineNodes = displayedTimelineRows.some(
    (row) => row.hasChildren && expandedIds.has(row.id)
  );

  useEffect(() => {
    if (!hasActiveFavoriteGroupTreeFiltering) return;
    const visibleRowIds = new Set(displayedTreeRows.map((row) => row.id));
    if (visibleRowIds.size === 0) return;
    if (store.selectedNodeId && visibleRowIds.has(store.selectedNodeId)) return;
    const fallbackId = displayedTreeRows[0]?.id ?? null;
    if (!fallbackId) return;
    setPrimarySelection(fallbackId, "tree");
  }, [displayedTreeRows, hasActiveFavoriteGroupTreeFiltering, store.selectedNodeId]);
  displayedTimelineRowsRef.current = displayedTimelineRows;
  const displayedTreeIndexById = useMemo(() => {
    const map = new Map<string, number>();
    displayedTreeRows.forEach((row, idx) => map.set(row.id, idx));
    return map;
  }, [displayedTreeRows]);
  const displayedTimelineIndexById = useMemo(() => {
    const map = new Map<string, number>();
    displayedTimelineRows.forEach((row, idx) => map.set(row.id, idx));
    return map;
  }, [displayedTimelineRows]);

  const breadcrumbNodes = useMemo(() => {
    if (store.currentFolderId === null) return [];
    return store.breadcrumbs;
  }, [store.breadcrumbs, store.currentFolderId]);
  const desktopOpenNodeTabs = useMemo(
    () =>
      activeWorkspaceNodeTabSession.openTabs
        .map((entry) => {
          const rootNode = nodeById.get(entry.nodeId) ?? null;
          if (!rootNode) return null;
          return {
            nodeId: entry.nodeId,
            title: rootNode.name
          };
        })
        .filter(
          (
            entry
          ): entry is {
            nodeId: string;
            title: string;
          } => Boolean(entry)
        ),
    [activeWorkspaceNodeTabSession.openTabs, nodeById]
  );

  const quickAccessMindMapRootLabel = useMemo(() => {
    return activeProject?.name ?? breadcrumbNodes[0]?.name ?? t("main.desktop");
  }, [activeProject?.name, breadcrumbNodes, t]);
  const quickAccessMindMapRootNode = useMemo(
    () => (activeProjectRootId ? nodeById.get(activeProjectRootId) ?? null : breadcrumbNodes[0] ?? null),
    [activeProjectRootId, nodeById, breadcrumbNodes]
  );
  const quickAccessMindMapRootLevel = activeProjectRootId
    ? nodeLevelById.get(activeProjectRootId) ?? 1
    : 1;

  const nodeTreeMindMapRootLabel = useMemo(() => {
    if (desktopMirrorRootId) {
      return nodeById.get(desktopMirrorRootId)?.name ?? t("main.desktop");
    }
    return t("main.desktop");
  }, [desktopMirrorRootId, nodeById, t]);
  const nodeTreeMindMapRootNode = useMemo(
    () => (desktopMirrorRootId ? nodeById.get(desktopMirrorRootId) ?? null : null),
    [desktopMirrorRootId, nodeById]
  );
  const nodeTreeMindMapRootLevel = desktopMirrorRootId
    ? nodeLevelById.get(desktopMirrorRootId) ?? 1
    : 1;

  const gridNodes = useMemo(() => {
    if (workspaceMode === "grid" && workspaceFocusMode === "execution") {
      return desktopWorkareaScopedGridNodes;
    }
    return resolveWorkspaceGridNodes({
      workspaceFocusMode,
      hasActiveNodeStateFiltering,
      projectScopedNodeIds,
      currentChildren: desktopMirrorChildren,
      currentFolderId: desktopMirrorRootId,
      activeProjectRootId,
      nodeById,
      byParent,
      matchesNodeState: (node) =>
        doesNodeMatchNodeStateFilters(node, activeNodeStateFilters, filterFolderNodeStateById, executionOwnerNodeIds),
      includeNodeStateFilterParents,
      forceTaskFilterParents,
      isHiddenExecutionTaskNode,
      shouldHideNode: (node) =>
        isWorkareaItemNode(node) && workspaceFocusMode !== "execution"
    });
  }, [
    workspaceFocusMode,
    hasActiveNodeStateFiltering,
    projectScopedNodeIds,
    desktopMirrorChildren,
    desktopMirrorRootId,
    activeProjectRootId,
    nodeById,
    byParent,
    activeNodeStateFilters,
    filterFolderNodeStateById,
    includeNodeStateFilterParents,
    forceTaskFilterParents,
    executionOwnerNodeIds,
    desktopWorkareaScopedGridNodes,
    workspaceMode
  ]);
  const desktopBaseGridNodes = useMemo(() => {
    if (hasActiveFavoriteGroupTreeFiltering) {
      return favoriteGroupDisplayNodes;
    }
    return gridNodes;
  }, [favoriteGroupDisplayNodes, gridNodes, hasActiveFavoriteGroupTreeFiltering]);
  const emptyChantierStatusCounts = useMemo<Record<ODEChantierStatus, number>>(
    () => ({
      draft: 0,
      proposed: 0,
      approved: 0,
      active: 0,
      paused: 0,
      closed: 0,
      archived: 0
    }),
    []
  );
  const workspaceChantierNodes = useMemo(
    () =>
      store.allNodes.filter(
        (node) => (projectScopedNodeIds ? projectScopedNodeIds.has(node.id) : true) && !isFileLikeNode(node) && isChantierNode(node)
      ),
    [projectScopedNodeIds, store.allNodes]
  );
  const workspaceChantierStatusCounts = useMemo(() => {
    const nextCounts = { ...emptyChantierStatusCounts };
    for (const node of workspaceChantierNodes) {
      const status = readChantierProfile(node).status;
      nextCounts[status] += 1;
    }
    return nextCounts;
  }, [emptyChantierStatusCounts, workspaceChantierNodes]);
  const workspaceActiveChantierNodes = useMemo(
    () => workspaceChantierNodes.filter((node) => readChantierProfile(node).status === "active").slice(0, 6),
    [workspaceChantierNodes]
  );
  const workspaceAttentionChantierNodes = useMemo(() => {
    const nextNodes: AppNode[] = [];
    const attentionStatuses: ODEChantierStatus[] = ["paused", "proposed", "draft"];
    for (const status of attentionStatuses) {
      for (const node of workspaceChantierNodes) {
        if (readChantierProfile(node).status !== status) continue;
        nextNodes.push(node);
        if (nextNodes.length >= 6) {
          return nextNodes;
        }
      }
    }
    return nextNodes;
  }, [workspaceChantierNodes]);
  const desktopChantierNodes = useMemo(
    () => desktopBaseGridNodes.filter((node) => !isFileLikeNode(node) && isChantierNode(node)),
    [desktopBaseGridNodes]
  );
  const desktopChantierPortfolioCounts = useMemo(() => {
    const nextCounts = { ...emptyChantierStatusCounts };
    for (const node of desktopChantierNodes) {
      const status = readChantierProfile(node).status;
      nextCounts[status] += 1;
    }
    return nextCounts;
  }, [desktopChantierNodes, emptyChantierStatusCounts]);
  const desktopGridNodes = useMemo(() => {
    if (activeChantierStatusFilter === "all") {
      return desktopBaseGridNodes;
    }
    return desktopBaseGridNodes.filter(
      (node) => !isFileLikeNode(node) && isChantierNode(node) && readChantierProfile(node).status === activeChantierStatusFilter
    );
  }, [activeChantierStatusFilter, desktopBaseGridNodes]);
  const desktopGridEmptyStateMessage = hasActiveFavoriteGroupTreeFiltering
    ? t("favorites.empty_group_hint")
    : desktopEmptyStateMessage;
  const desktopGridShowCreateFirstNodeAction = hasActiveFavoriteGroupTreeFiltering
    ? false
    : desktopShowCreateFirstNodeAction;
  const desktopGridShowUploadEmptyStateAction = workspaceFocusMode !== "execution";
  const displayedGridIndexById = useMemo(() => {
    const map = new Map<string, number>();
    desktopGridNodes.forEach((node, idx) => map.set(node.id, idx));
    return map;
  }, [desktopGridNodes]);
  useEffect(() => {
    if (workspaceMode !== "grid" || workspaceFocusMode === "execution") {
      if (activeChantierStatusFilter !== "all") {
        setActiveChantierStatusFilter("all");
      }
      return;
    }
    if (desktopChantierNodes.length === 0 && activeChantierStatusFilter !== "all") {
      setActiveChantierStatusFilter("all");
      return;
    }
    if (
      activeChantierStatusFilter !== "all" &&
      desktopChantierPortfolioCounts[activeChantierStatusFilter] === 0
    ) {
      setActiveChantierStatusFilter("all");
    }
  }, [
    activeChantierStatusFilter,
    desktopChantierNodes.length,
    desktopChantierPortfolioCounts,
    workspaceFocusMode,
    workspaceMode
  ]);
  const nodeOrderIndexById = useMemo(() => {
    const map = new Map<string, number>();
    store.allNodes.forEach((node, idx) => map.set(node.id, idx));
    return map;
  }, [store.allNodes]);

  useEffect(() => {
    const selectedId = store.selectedNodeId;
    if (!selectedId) return;

    const escapeCss = (value: string): string => {
      if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
        return CSS.escape(value);
      }
      return value.replace(/["\\]/g, "\\$&");
    };

    const escapedId = escapeCss(selectedId);
    const findTarget = (surface: SelectionSurface): HTMLElement | null => {
      if (surface === "tree") {
        return document.querySelector<HTMLElement>(`.ode-tree-row[data-ode-node-id="${escapedId}"]`);
      }
      if (surface === "timeline") {
        return document.querySelector<HTMLElement>(
          `[data-timeline-row="true"][data-ode-node-id="${escapedId}"]`
        );
      }
      return document.querySelector<HTMLElement>(
        [
          `.ode-grid-card[data-ode-node-id="${escapedId}"]`,
          `.ode-details-row[data-ode-node-id="${escapedId}"]`,
          `.ode-mind-root[data-ode-node-id="${escapedId}"]`,
          `.ode-mind-node[data-ode-node-id="${escapedId}"]`,
          `.ode-quick-mind-favorite[data-ode-node-id="${escapedId}"]`
        ].join(", ")
      );
    };

    const scrollToSelection = () => {
      const surfaces: SelectionSurface[] = ["tree"];
      if (workspaceMode === "grid") {
        surfaces.push("grid");
      } else {
        surfaces.push("timeline");
      }
      if (!surfaces.includes(selectionSurface)) {
        surfaces.unshift(selectionSurface);
      }

      const targets = surfaces
        .map((surface) => findTarget(surface))
        .filter((target): target is HTMLElement => Boolean(target));
      const uniqueTargets = Array.from(new Set(targets));
      for (const target of uniqueTargets) {
        target.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    };

    const rafId = window.requestAnimationFrame(scrollToSelection);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [
    store.selectedNodeId,
    selectionSurface,
    workspaceMode,
    desktopViewMode,
    displayedTreeRows,
    displayedTimelineRows,
    desktopGridNodes
  ]);

  const setPrimarySelection = (nodeId: string | null, surface: SelectionSurface = "tree") => {
    store.setSelectedNodeId(nodeId);
    if (!nodeId) {
      setSelectedNodeIds(new Set());
      setSelectionAnchorId(null);
      setSelectionSurface(surface);
      return;
    }
    setSelectedNodeIds(new Set([nodeId]));
    setSelectionAnchorId(nodeId);
    setSelectionSurface(surface);
  };

  const setSelectionFromIds = (
    nodeIds: string[],
    focusId: string | null = null,
    surface: SelectionSurface = "tree"
  ) => {
    const normalizedSelection = normalizeSelectionState(nodeIds, focusId, nodeById);
    if (!normalizedSelection) {
      setPrimarySelection(null, surface);
      return;
    }
    store.setSelectedNodeId(normalizedSelection.focusId);
    setSelectedNodeIds(new Set(normalizedSelection.selectedIds));
    setSelectionAnchorId(normalizedSelection.focusId);
    setSelectionSurface(surface);
  };

  const isNodeWithinTabScope = useCallback(
    (tabNodeId: string, candidateNodeId: string | null | undefined): boolean => {
      if (!candidateNodeId) return false;
      if (tabNodeId === candidateNodeId) return true;

      const visited = new Set<string>();
      let current =
        nodeById.get(candidateNodeId) ?? store.allNodes.find((node) => node.id === candidateNodeId) ?? null;

      while (current) {
        if (current.id === tabNodeId) return true;
        if (!current.parentId || current.parentId === ROOT_PARENT_ID || visited.has(current.id)) break;
        visited.add(current.id);
        const parentId = current.parentId;
        current = nodeById.get(parentId) ?? store.allNodes.find((node) => node.id === parentId) ?? null;
      }

      return false;
    },
    [nodeById, store.allNodes]
  );

  const updateWorkspaceNodeTabSession = useCallback(
    (
      workspaceRootId: string | null,
      updater: (current: WorkspaceNodeTabSession) => WorkspaceNodeTabSession | null
    ) => {
      if (!workspaceRootId) return;
      setWorkspaceNodeTabSessions((prev) => {
        const current = prev[workspaceRootId] ?? { openTabs: [], activeTabId: null };
        const next = updater(current);
        if (!next || next.openTabs.length === 0) {
          if (!(workspaceRootId in prev)) return prev;
          const remaining = { ...prev };
          delete remaining[workspaceRootId];
          return remaining;
        }
        return {
          ...prev,
          [workspaceRootId]: next
        };
      });
    },
    []
  );

  const openNodeInDesktopTab = useCallback(
    async (
      nodeId: string,
      options?: {
        selectedNodeId?: string | null;
      }
    ) => {
      const node = nodeById.get(nodeId) ?? store.allNodes.find((candidate) => candidate.id === nodeId) ?? null;
      if (!node || node.type !== "folder" || isFileLikeNode(node)) return;

      const resolvedSelectedNodeId =
        options?.selectedNodeId && isNodeWithinTabScope(node.id, options.selectedNodeId)
          ? options.selectedNodeId
          : node.id;

      updateWorkspaceNodeTabSession(activeProjectRootId, (current) => {
        const existingEntry = current.openTabs.find((entry) => entry.nodeId === node.id) ?? null;
        const nextOpenTabs = existingEntry
          ? current.openTabs.map((entry) =>
              entry.nodeId === node.id
                ? {
                    ...entry,
                    lastSelectedNodeId: resolvedSelectedNodeId
                  }
                : entry
            )
          : [
              ...current.openTabs,
              {
                nodeId: node.id,
                lastSelectedNodeId: resolvedSelectedNodeId
              }
            ];
        return {
          openTabs: nextOpenTabs,
          activeTabId: node.id
        };
      });

      const nextDesktopViewMode =
        desktopViewModeRef.current === "procedure"
          ? desktopBrowseViewModeRef.current === "procedure"
            ? "grid"
            : desktopBrowseViewModeRef.current
          : desktopViewModeRef.current;

      setWorkspaceMode("grid");
      setDesktopViewMode(nextDesktopViewMode);
      setSelectionSurface("grid");
      setKeyboardSurface("grid");
      await store.navigateTo(node.id);
      updateExpandedIdsForContext("organization", (prev) => {
        const next = new Set(prev);
        next.add(node.id);
        for (const ancestorId of collectAncestorNodeIds(resolvedSelectedNodeId, nodeById)) {
          next.add(ancestorId);
        }
        return next;
      });
      setPrimarySelection(resolvedSelectedNodeId, "grid");
    },
    [
      activeProjectRootId,
      isNodeWithinTabScope,
      nodeById,
      store,
      updateExpandedIdsForContext,
      updateWorkspaceNodeTabSession
    ]
  );

  const closeDesktopNodeTab = useCallback(
    async (nodeId: string) => {
      if (!activeProjectRootId) return;
      const currentSession = workspaceNodeTabSessions[activeProjectRootId];
      if (!currentSession) return;

      const tabIndex = currentSession.openTabs.findIndex((entry) => entry.nodeId === nodeId);
      if (tabIndex === -1) return;

      const remainingTabs = currentSession.openTabs.filter((entry) => entry.nodeId !== nodeId);
      const nextActiveEntry =
        currentSession.activeTabId === nodeId
          ? remainingTabs[Math.max(0, tabIndex - 1)] ?? remainingTabs[0] ?? null
          : remainingTabs.find((entry) => entry.nodeId === currentSession.activeTabId) ?? remainingTabs[0] ?? null;

      updateWorkspaceNodeTabSession(activeProjectRootId, () =>
        remainingTabs.length > 0
          ? {
              openTabs: remainingTabs,
              activeTabId: nextActiveEntry?.nodeId ?? null
            }
          : null
      );

      if (nextActiveEntry) {
        await openNodeInDesktopTab(nextActiveEntry.nodeId, {
          selectedNodeId: nextActiveEntry.lastSelectedNodeId
        });
        return;
      }

      setDesktopViewMode(desktopBrowseViewModeRef.current === "procedure" ? "grid" : desktopBrowseViewModeRef.current);
      setSelectionSurface("grid");
      setKeyboardSurface("grid");
    },
    [activeProjectRootId, openNodeInDesktopTab, updateWorkspaceNodeTabSession, workspaceNodeTabSessions]
  );

  useEffect(() => {
    if (workspaceMode !== "grid") return;
    if (!activeProjectRootId) return;
    const activeTabId = activeWorkspaceNodeTabSession.activeTabId;
    const selectedNodeId = store.selectedNodeId ?? null;
    if (!activeTabId || !selectedNodeId) return;
    if (!isNodeWithinTabScope(activeTabId, selectedNodeId)) return;

    updateWorkspaceNodeTabSession(activeProjectRootId, (current) => {
      let changed = false;
      const nextOpenTabs = current.openTabs.map((entry) => {
        if (entry.nodeId !== activeTabId || entry.lastSelectedNodeId === selectedNodeId) return entry;
        changed = true;
        return {
          ...entry,
          lastSelectedNodeId: selectedNodeId
        };
      });
      if (!changed) return current;
      return {
        ...current,
        openTabs: nextOpenTabs
      };
    });
  }, [
    activeProjectRootId,
    activeWorkspaceNodeTabSession.activeTabId,
    isNodeWithinTabScope,
    store.selectedNodeId,
    updateWorkspaceNodeTabSession,
    workspaceMode
  ]);

  useEffect(() => {
    if (!activeProjectRootId || store.allNodes.length === 0) return;
    const currentSession = workspaceNodeTabSessions[activeProjectRootId];
    if (!currentSession || currentSession.openTabs.length === 0) return;

    const validOpenTabs: WorkspaceNodeTabEntry[] = [];
    for (const entry of currentSession.openTabs) {
      const rootNode = nodeById.get(entry.nodeId) ?? null;
      if (!rootNode || rootNode.type !== "folder" || isFileLikeNode(rootNode)) continue;
      if (projectScopedNodeIds && !projectScopedNodeIds.has(rootNode.id)) continue;

      const nextSelectedNodeId =
        entry.lastSelectedNodeId && isNodeWithinTabScope(rootNode.id, entry.lastSelectedNodeId)
          ? entry.lastSelectedNodeId
          : rootNode.id;
      validOpenTabs.push({
        nodeId: rootNode.id,
        lastSelectedNodeId: nextSelectedNodeId
      });
    }

    const nextActiveTabId =
      currentSession.activeTabId && validOpenTabs.some((entry) => entry.nodeId === currentSession.activeTabId)
        ? currentSession.activeTabId
        : validOpenTabs[0]?.nodeId ?? null;

    const changed =
      validOpenTabs.length !== currentSession.openTabs.length ||
      validOpenTabs.some((entry, index) => {
        const currentEntry = currentSession.openTabs[index];
        return (
          !currentEntry ||
          currentEntry.nodeId !== entry.nodeId ||
          currentEntry.lastSelectedNodeId !== entry.lastSelectedNodeId
        );
      }) ||
      nextActiveTabId !== currentSession.activeTabId;

    if (!changed) return;

    updateWorkspaceNodeTabSession(activeProjectRootId, () =>
      validOpenTabs.length > 0
        ? {
            openTabs: validOpenTabs,
            activeTabId: nextActiveTabId
          }
        : null
    );
  }, [
    activeProjectRootId,
    isNodeWithinTabScope,
    nodeById,
    projectScopedNodeIds,
    store.allNodes.length,
    updateWorkspaceNodeTabSession,
    workspaceNodeTabSessions
  ]);

  useEffect(() => {
    if (!activeProjectRootId || store.allNodes.length === 0) return;
    if (restoredWorkspaceNodeTabsRef.current === activeProjectRootId) return;

    const currentSession = workspaceNodeTabSessions[activeProjectRootId];
    if (!currentSession || currentSession.openTabs.length === 0) {
      restoredWorkspaceNodeTabsRef.current = activeProjectRootId;
      return;
    }

    const validOpenTabs = currentSession.openTabs.filter((entry) => {
      const rootNode = nodeById.get(entry.nodeId) ?? null;
      return Boolean(
        rootNode &&
          rootNode.type === "folder" &&
          !isFileLikeNode(rootNode) &&
          (!projectScopedNodeIds || projectScopedNodeIds.has(rootNode.id))
      );
    });

    const activeTabEntry =
      validOpenTabs.find((entry) => entry.nodeId === currentSession.activeTabId) ?? validOpenTabs[0] ?? null;
    if (!activeTabEntry || !nodeById.has(activeTabEntry.nodeId)) {
      restoredWorkspaceNodeTabsRef.current = activeProjectRootId;
      return;
    }

    restoredWorkspaceNodeTabsRef.current = activeProjectRootId;
    void openNodeInDesktopTab(activeTabEntry.nodeId, {
      selectedNodeId: activeTabEntry.lastSelectedNodeId
    });
  }, [
    activeProjectRootId,
    nodeById,
    openNodeInDesktopTab,
    projectScopedNodeIds,
    store.allNodes.length,
    workspaceNodeTabSessions
  ]);

  useEffect(() => {
    const signature = buildSelectionSignature(selectedNodeIds, selectionSurface);
    if (!signature) {
      favoriteGroupAssignmentSignatureRef.current = null;
      favoriteGroupAssignmentConsumedSignatureRef.current = null;
      return;
    }
    if (favoriteGroupAssignmentConsumedSignatureRef.current === signature) {
      favoriteGroupAssignmentSignatureRef.current = null;
      return;
    }
    favoriteGroupAssignmentSignatureRef.current = signature;
  }, [selectedNodeIds, selectionSurface]);

  const toggleNodeStateFilter = (filter: NodeStateFilter) => {
    setActiveNodeStateFilters((prev) => toggleNodeStateFilterSelection(prev, filter));
  };

  const selectAllNodeStateFilters = () => {
    setActiveNodeStateFilters(createAllNodeStateFilters());
  };

  const toggleNodeStateFilterParents = () => {
    setIncludeNodeStateFilterParents((prev) => !prev);
  };

  const restoreNodeStateFiltersAfterDocumentation = useCallback(() => {
    const previousFilters = documentationPreviousNodeStateFiltersRef.current;
    documentationPreviousNodeStateFiltersRef.current = null;
    if (!previousFilters) return;
    setActiveNodeStateFilters(new Set(previousFilters));
  }, []);

  const enterDocumentationMode = useCallback(() => {
    if (!documentationModeActive) {
      documentationPreviousNodeStateFiltersRef.current = new Set(activeNodeStateFilters);
    }
    setWorkspaceMode("grid");
    setDocumentationModeActive(true);
    setDesktopViewMode("procedure");
    setSelectionSurface("tree");
    setKeyboardSurface("procedure");
    if (!areAllNodeStateFiltersSelected(activeNodeStateFilters)) {
      setActiveNodeStateFilters(createAllNodeStateFilters());
    }
  }, [activeNodeStateFilters, documentationModeActive]);

  const exitDocumentationMode = useCallback(
    (options?: { restoreFilters?: boolean }) => {
      setDocumentationModeActive(false);
      if (options?.restoreFilters === false) {
        documentationPreviousNodeStateFiltersRef.current = null;
        return;
      }
      restoreNodeStateFiltersAfterDocumentation();
    },
    [restoreNodeStateFiltersAfterDocumentation]
  );

  function hasVisibleWorkareaForOwner(node: AppNode | null | undefined): boolean {
    if (!node || isFileLikeNode(node)) return false;
    if (isDeclaredWorkareaOwnerNode(node)) return true;
    if ((byParent.get(node.id) ?? []).some((child) => isWorkareaItemNode(child))) return true;
    if (normalizeStructuredDeliverablesForNode(node.id, node.properties?.odeStructuredDeliverables).length > 0) {
      return true;
    }
    return store.allNodes.some((candidate) => {
      const meta = getExecutionTaskMeta(candidate);
      return meta?.ownerNodeId === node.id && isRenderableExecutionProjectionNode(candidate);
    });
  }

  function resolveWorkareaOwnerNodeId(targetNodeId?: string | null): string | null {
    const requestedNodeId =
      targetNodeId === undefined
        ? store.selectedNodeId ?? selectedNode?.id ?? procedureSelectedNode?.id ?? null
        : targetNodeId;
    const targetNode =
      requestedNodeId
        ? nodeById.get(requestedNodeId) ?? store.allNodes.find((node) => node.id === requestedNodeId) ?? null
        : null;

    if (targetNode) {
      const workareaOwnerNodeId = getWorkareaOwnerNodeId(targetNode, nodeById);
      if (workareaOwnerNodeId) return workareaOwnerNodeId;
      const executionMeta = getExecutionTaskMeta(targetNode);
      if (executionMeta?.ownerNodeId) return executionMeta.ownerNodeId;
      if (isFileLikeNode(targetNode)) {
        if (!targetNode.parentId || targetNode.parentId === ROOT_PARENT_ID) return null;
        const parentNode = nodeById.get(targetNode.parentId) ?? null;
        return hasVisibleWorkareaForOwner(parentNode) ? targetNode.parentId : null;
      }
      return hasVisibleWorkareaForOwner(targetNode) ? targetNode.id : null;
    }

    const currentFolderId = store.currentFolderId ?? null;
    if (currentFolderId) {
      const currentFolderNode = nodeById.get(currentFolderId) ?? null;
      if (hasVisibleWorkareaForOwner(currentFolderNode)) {
        return currentFolderId;
      }
    }

    const firstVisibleOwnerId = Array.from(workareaOwnerNodeIds)[0] ?? null;
    return firstVisibleOwnerId;
  }

  function resolvePreferredWorkareaTargetNodeId(): string | null {
    const visibleTreeSelection = resolveVisibleSelectionForSurface({
      selectedNode,
      projectScopedNodeIds,
      surface: "tree",
      displayedTreeIndexById,
      displayedGridIndexById,
      displayedTimelineIndexById
    });
    if (visibleTreeSelection) {
      const ownerNodeId = resolveWorkareaOwnerNodeId(visibleTreeSelection.id);
      if (ownerNodeId) {
        return visibleTreeSelection.id;
      }
    }
    if (selectedNode) {
      const ownerNodeId = resolveWorkareaOwnerNodeId(selectedNode.id);
      if (ownerNodeId) {
        return selectedNode.id;
      }
    }
    return resolveWorkareaOwnerNodeId();
  }

  function resolveWorkareaCreationParentNodeId(surface: SelectionSurface): string | null {
    const selectedContextNode =
      store.selectedNodeId
        ? nodeById.get(store.selectedNodeId) ?? store.allNodes.find((node) => node.id === store.selectedNodeId) ?? null
        : null;
    if (selectedContextNode && !isFileLikeNode(selectedContextNode)) {
      if (isWorkareaItemNode(selectedContextNode)) {
        return selectedContextNode.id;
      }
      const ownerNodeId = resolveWorkareaOwnerNodeId(selectedContextNode.id);
      if (ownerNodeId) return ownerNodeId;
      return selectedContextNode.id;
    }

    if (surface === "grid" || surface === "timeline") {
      const currentFolderNode =
        store.currentFolderId
          ? nodeById.get(store.currentFolderId) ??
            store.allNodes.find((node) => node.id === store.currentFolderId) ??
            null
          : null;
      if (currentFolderNode && !isFileLikeNode(currentFolderNode)) {
        if (isWorkareaItemNode(currentFolderNode)) {
          return currentFolderNode.id;
        }
        const ownerNodeId = resolveWorkareaOwnerNodeId(currentFolderNode.id);
        if (ownerNodeId) return ownerNodeId;
        return currentFolderNode.id;
      }
    }

    return resolveWorkareaOwnerNodeId();
  }

  const selectWorkspaceFocusMode = (mode: WorkspaceFocusMode) => {
    if (mode === "execution" && !workareaAvailable) {
      setExecutionQuickOpenDeliverableId(null);
      setActiveNodeStateFilters(createAllNodeStateFilters());
      return;
    }
    setActiveNodeStateFilters(resolveNodeStateFiltersForWorkspaceFocusMode(mode));
    if (workspaceModeRef.current !== "grid") return;

    if (mode === "execution") {
      const targetNodeId = resolvePreferredWorkareaTargetNodeId();
      if (targetNodeId) {
        void openNodeInWorkarea(targetNodeId);
      }
      return;
    }

    if (desktopViewModeRef.current === "procedure") {
      if (documentationModeActive) {
        setSelectionSurface("tree");
        setKeyboardSurface("procedure");
        setExecutionQuickOpenDeliverableId(null);
        return;
      }
      const nextDesktopViewMode =
        desktopBrowseViewModeRef.current === "procedure" ? "grid" : desktopBrowseViewModeRef.current;
      setDesktopViewMode(nextDesktopViewMode);
      setSelectionSurface("grid");
      setKeyboardSurface("grid");
      setExecutionQuickOpenDeliverableId(null);
    }
  };

  const selectTimelineWorkspaceFocusMode = (mode: WorkspaceFocusMode) => {
    setDesktopViewMode("grid");
    setSelectionSurface("timeline");
    setKeyboardSurface("timeline");
    if (mode === "execution" && !workareaAvailable) {
      setExecutionQuickOpenDeliverableId(null);
      setActiveNodeStateFilters(createAllNodeStateFilters());
      return;
    }
    if (mode === "execution") {
      const ownerNodeId = resolveWorkareaOwnerNodeId();
      if (ownerNodeId) {
        void ensureLegacyWorkareaTreeForOwner(ownerNodeId);
      }
    }
    selectWorkspaceFocusMode(mode);
  };

  const openTimelinePlanView = () => {
    setWorkspaceMode("timeline");
    setDesktopViewMode("grid");
    setActiveNodeStateFilters(createAllNodeStateFilters());
    setSelectionSurface("timeline");
    setKeyboardSurface("timeline");
  };

  const toggleWorkspaceEmptyOnly = () => {
    setActiveNodeStateFilters(toggleEmptyOnlyNodeStateFilters(workspaceEmptyOnly));
  };

  const toggleTimelineStatusFilter = (status: ScheduleStatus) => {
    setActiveTimelineStatusFilters((prev) => toggleTimelineStatusSelection(prev, status));
  };

  const toggleTimelinePriorityFilter = (priority: TimelinePriority) => {
    setActiveTimelinePriorityFilters((prev) => toggleTimelinePrioritySelection(prev, priority));
  };

  const toggleTimelineFilterParents = () => {
    setIncludeTimelineFilterParents((prev) => !prev);
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const {
    handleProjectSelectionChange,
    handlePickAndImportProjectFolder,
    handlePickWorkspaceLocalFolder,
    handleCreateWorkspace,
    handleSetActiveWorkspaceLocalPath,
    handleReSyncWorkspace,
    handleDeleteProjectWorkspace
  } = useWorkspaceActions({
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
    setProjectError: setWorkspaceManageError,
    setProjectNotice: setWorkspaceManageNotice,
    setIsProjectImporting,
    setIsWorkspaceCreating,
    setIsProjectResyncing,
    setIsWorkspaceRepairing,
    setIsProjectDeleting,
    setExpandedIds,
    setPrimarySelection,
    requestDeleteConfirmation,
    refreshProjects,
    refreshTree: store.refreshTree,
    navigateTo: store.navigateTo
  });

  const openWorkspaceCreateInline = useCallback(() => {
    const nextState = buildWorkspaceCreateInlineOpenState();
    setWorkspaceManageError(nextState.workspaceManageError);
    setWorkspaceManageNotice(nextState.workspaceManageNotice);
    setWorkspaceSettingsOpen(nextState.workspaceSettingsOpen);
    setWorkspaceCreateInlineOpen(nextState.workspaceCreateInlineOpen);
    setWorkspaceLocalPathInput(nextState.workspaceLocalPathInput);
  }, []);

  const cancelWorkspaceCreateInline = useCallback(() => {
    if (isWorkspaceCreating) return;
    const nextState = buildWorkspaceCreateInlineCancelState();
    setWorkspaceCreateInlineOpen(nextState.workspaceCreateInlineOpen);
    setWorkspaceNameInput(nextState.workspaceNameInput);
    setWorkspaceLocalPathInput(nextState.workspaceLocalPathInput);
  }, [isWorkspaceCreating]);

  const submitWorkspaceCreateInline = useCallback(async () => {
    const createdWorkspace = await handleCreateWorkspace();
    if (!createdWorkspace) return;
    const nextState = buildWorkspaceCreateInlineSubmitSuccessState();
    setWorkspaceCreateInlineOpen(nextState.workspaceCreateInlineOpen);
    setWorkspaceSettingsOpen(nextState.workspaceSettingsOpen);
  }, [handleCreateWorkspace]);

  const handleCreateFirstNodeRequest = useCallback(
    async (surface: SelectionSurface) => {
      if (projects.length === 0) {
        openWorkspaceCreateInline();
        return;
      }
      if (workspaceFocusMode === "execution") {
        await createSurfaceDefaultTopic(surface);
        return;
      }
      await createChildFolder(surface);
    },
    [openWorkspaceCreateInline, projects.length, workspaceFocusMode]
  );

  const openSelectedTimelineExecutionDetails = useCallback(async () => {
    if (!selectedNode) return;
    await openNodeInWorkarea(selectedNode.id);
  }, [selectedNode]);

  const setActiveWorkspaceAsDefault = () => {
    if (!activeProjectId) return;
    const projectName = resolveWorkspaceDefaultProjectName(projects, activeProjectId);
    setDefaultProjectId(activeProjectId);
    setWorkspaceManageNotice(t("project.default_set_notice", { name: projectName ?? activeProjectId }));
    setWorkspaceManageError(null);
  };

  const openSelectedWorkspaceFolderLocation = async () => {
    try {
      const path = resolveWorkspaceOpenFolderPath(activeProject);
      if (!path) {
        setWorkspaceManageError(t("project.open_workspace_unavailable"));
        return;
      }
      await openLocalPath(path);
      setWorkspaceManageError(null);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setWorkspaceManageError(t("project.open_location_failed", { reason }));
    }
  };

  const refreshAssistantActivity = () => {
    setAssistantActivityItems(toAssistantActivityItems(readAiTelemetryEvents(10)));
  };

  const recordAiTelemetryEvent = (event: Omit<AiTelemetryEvent, "id" | "timestamp">) => {
    appendAiTelemetryEvent(event);
    refreshAssistantActivity();
  };

  const recordAiQaLearningEvent = (
    event: Omit<AiQaLearningRun, "id" | "recordedAt"> & { recordedAt?: string }
  ) => {
    appendAiQaLearningRun(event);
    setQaLearningRuns(readAiQaLearningRuns());
  };

  const clearAssistantActivity = () => {
    clearAiTelemetryEvents();
    setAssistantActivityItems([]);
    setProjectNotice(t("assistant.activity_cleared"));
  };

  useEffect(() => {
    if (!commandBarOpen) return;
    refreshAssistantActivity();
  }, [commandBarOpen]);

  const runAssistantPlanMyDay = async () => {
    const startedAt = Date.now();
    const apiKey = getSavedMistralApiKey();
    if (!apiKey) {
      throw new Error(t("assistant.mistral_missing_key"));
    }
    try {
      const selectedLabel = selectedNode
        ? `${scopedNumbering.get(selectedNode.id) ?? numbering.get(selectedNode.id) ?? "-"} ${selectedNode.name}`
        : "none";
      const systemPrompt =
        "You are ODETool assistant. Analyze the provided project tree and schedules. Be concrete, concise, and action-oriented. Do not invent nodes or dates that are not in the context.";
      const userPrompt = [
        `Date: ${toIsoDateOnly(new Date())}`,
        `Language: ${language}`,
        `Project: ${activeProject?.name ?? "All Nodes"}`,
        `Selected Node: ${selectedLabel}`,
        "",
        "Return markdown with these sections:",
        "1) Priority Focus (max 5 items)",
        "2) Risks / Blockers",
        "3) Tree Structure Actions (suggest create/move/rename with node numbers)",
        "4) Schedule Adjustments",
        "",
        "Tree Snapshot:",
        assistantTreeSnapshot
      ].join("\n");

      const response = await runAiPromptAnalysis({
        apiKey,
        systemPrompt,
        userPrompt,
        aiEngine: "cloud"
      });
      await writePlainTextToClipboard(response.trim());
      setProjectNotice(`${t("assistant.plan_my_day")} copied to clipboard.`);
      recordAiTelemetryEvent({
        flow: "plan_my_day",
        source: "assistant",
        actionId: "plan_my_day",
        success: true,
        latencyMs: Date.now() - startedAt,
        fallbackUsed: false,
        workspace: activeProject?.name ?? "All Nodes",
        selectedNodeId: selectedNode?.id ?? null
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      recordAiTelemetryEvent({
        flow: "plan_my_day",
        source: "assistant",
        actionId: "plan_my_day",
        success: false,
        latencyMs: Date.now() - startedAt,
        fallbackUsed: false,
        workspace: activeProject?.name ?? "All Nodes",
        selectedNodeId: selectedNode?.id ?? null,
        error: reason
      });
      throw new Error(t("assistant.plan_error", { reason }));
    }
  };

  const openNodeContextMenu = (
    event: ReactMouseEvent<HTMLElement>,
    nodeId: string,
    surface: SelectionSurface,
    options?: {
      workareaMode?: boolean;
      workareaOwnerNodeId?: string | null;
      workareaDeliverableId?: string | null;
      workareaDeliverableTitle?: string | null;
    }
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (shouldRetainContextMenuSelection(selectedNodeIds, nodeId)) {
      store.setSelectedNodeId(nodeId);
      setSelectionAnchorId(nodeId);
      setSelectionSurface(surface);
    } else {
      setPrimarySelection(nodeId, surface);
    }
    setKeyboardSurface(surface);
    const contextNode = nodeById.get(nodeId) ?? store.allNodes.find((node) => node.id === nodeId) ?? null;
    const isFileNode = (contextNode?.type ?? "folder") === "file";
    const executionMeta = getExecutionTaskMeta(contextNode);
    setContextMenu(
      createContextMenuState({
        clientX: event.clientX,
        clientY: event.clientY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        nodeId,
        surface,
        kind: "node",
        groupId: null,
        isFileNode,
        workareaMode: options?.workareaMode,
        workareaOwnerNodeId:
          options?.workareaOwnerNodeId ??
          (options?.workareaMode
            ? executionMeta?.ownerNodeId ??
              (isFileLikeNode(contextNode)
                ? contextNode.parentId && contextNode.parentId !== ROOT_PARENT_ID
                  ? contextNode.parentId
                  : activeProjectRootId ?? null
                : contextNode?.id ?? null)
            : null),
        workareaDeliverableId: options?.workareaDeliverableId ?? executionMeta?.deliverableId ?? null,
        workareaDeliverableTitle:
          options?.workareaDeliverableTitle ??
          (typeof contextNode?.properties?.odeExecutionDeliverableTitle === "string"
            ? contextNode.properties.odeExecutionDeliverableTitle
            : null),
        isExecutionTaskNode: Boolean(executionMeta)
      })
    );
  };

  const openSurfaceContextMenu = (
    event: ReactMouseEvent<HTMLElement>,
    surface: SelectionSurface,
    options?: {
      workareaMode?: boolean;
      workareaOwnerNodeId?: string | null;
    }
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (selectedFavoriteGroupFilterIds.length > 0) {
      setContextMenu(null);
      return;
    }
    const workareaOwnerNodeId =
      options?.workareaOwnerNodeId ??
      (options?.workareaMode ? resolveWorkareaOwnerNodeId() : null);
    if (options?.workareaMode && !workareaOwnerNodeId) {
      setContextMenu(null);
      return;
    }
    setKeyboardSurface(surface);
    setContextMenu(
      createContextMenuState({
        clientX: event.clientX,
        clientY: event.clientY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        nodeId: null,
        surface,
        kind: "surface",
        groupId: null,
        workareaMode: options?.workareaMode,
        workareaOwnerNodeId
      })
    );
  };

  const openTimelineDeliverableGroupContextMenu = (
    event: ReactMouseEvent<HTMLElement>,
    ownerNodeId: string,
    deliverableId: string,
    deliverableTitle: string
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setPrimarySelection(ownerNodeId, "timeline");
    setKeyboardSurface("timeline");
    setContextMenu(
      createContextMenuState({
        clientX: event.clientX,
        clientY: event.clientY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        nodeId: ownerNodeId,
        surface: "timeline",
        kind: "node",
        groupId: null,
        workareaMode: true,
        workareaOwnerNodeId: ownerNodeId,
        workareaDeliverableId: deliverableId,
        workareaDeliverableTitle: deliverableTitle
      })
    );
  };

  const openQuickAccessNodeContextMenu = (
    event: ReactMouseEvent<HTMLElement>,
    nodeId: string
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setPrimarySelection(nodeId, "grid");
    const isFileNode = (nodeById.get(nodeId)?.type ?? "folder") === "file";
    setContextMenu(
      createContextMenuState({
        clientX: event.clientX,
        clientY: event.clientY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        nodeId,
        surface: "grid",
        kind: "quick_access_node",
        groupId: null,
        isFileNode
      })
    );
  };

  const openQuickAccessGroupContextMenu = (
    event: ReactMouseEvent<HTMLElement>,
    groupId: string
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu(
      createContextMenuState({
        clientX: event.clientX,
        clientY: event.clientY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        nodeId: null,
        surface: "grid",
        kind: "quick_access_group",
        groupId
      })
    );
  };

  const openQuickAccessSurfaceContextMenu = (event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu(
      createContextMenuState({
        clientX: event.clientX,
        clientY: event.clientY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        nodeId: null,
        surface: "grid",
        kind: "quick_access_surface",
        groupId: null
      })
    );
  };

  const applyIndexedSelection = (
    surface: SelectionSurface,
    nodeId: string,
    orderedIds: string[],
    indexById: Map<string, number>,
    options?: { range?: boolean; toggle?: boolean }
  ) => {
    const range = options?.range ?? false;
    const toggle = options?.toggle ?? false;
    const targetIndex = indexById.get(nodeId);
    if (targetIndex === undefined) {
      setPrimarySelection(nodeId, surface);
      return;
    }

    if (range) {
      const anchorId = selectionAnchorId ?? store.selectedNodeId ?? nodeId;
      const anchorIndex = indexById.get(anchorId);
      if (anchorIndex === undefined) {
        setPrimarySelection(nodeId, surface);
        return;
      }

      const [start, end] = anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
      const rangeIds = new Set(orderedIds.slice(start, end + 1));
      store.setSelectedNodeId(nodeId);
      setSelectedNodeIds(rangeIds);
      setSelectionAnchorId(anchorId);
      setSelectionSurface(surface);
      return;
    }

    if (toggle) {
      const next = new Set(selectedNodeIds);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      if (next.size === 0) {
        next.add(nodeId);
      }

      const nextActive = next.has(nodeId) ? nodeId : Array.from(next)[next.size - 1] ?? nodeId;
      store.setSelectedNodeId(nextActive);
      setSelectedNodeIds(next);
      setSelectionAnchorId(nodeId);
      setSelectionSurface(surface);
      return;
    }

    setPrimarySelection(nodeId, surface);
  };

  const applyTreeSelection = (nodeId: string, options?: { range?: boolean; toggle?: boolean }) => {
    setKeyboardSurface("tree");
    applyIndexedSelection(
      "tree",
      nodeId,
      displayedTreeRows.map((row) => row.id),
      displayedTreeIndexById,
      options
    );
  };

  const clearActiveDesktopNodeTab = useCallback(() => {
    if (!activeProjectRootId) return;
    updateWorkspaceNodeTabSession(activeProjectRootId, (current) =>
      current.activeTabId === null
        ? current
        : {
            ...current,
            activeTabId: null
        }
    );
  }, [activeProjectRootId, updateWorkspaceNodeTabSession]);

  const activateDesktopGridBrowseSurface = useCallback(() => {
    setWorkspaceMode("grid");
    setDesktopViewMode("grid");
    setSelectionSurface("grid");
    setKeyboardSurface("grid");
  }, []);

  const browseTreeNodeInGrid = useCallback(
    async (nodeId: string) => {
      const target = nodeById.get(nodeId) ?? store.allNodes.find((node) => node.id === nodeId) ?? null;
      if (!target) return;

      clearActiveDesktopNodeTab();
      if (workspaceFocusMode === "execution") {
        await openNodeInWorkareaRef.current?.(nodeId);
        return;
      }
      activateDesktopGridBrowseSurface();
      await store.navigateTo(isFileLikeNode(target) ? resolveSearchResultNavigationParentId(target) : target.id);
      setPrimarySelection(nodeId, "grid");
    },
    [activateDesktopGridBrowseSurface, clearActiveDesktopNodeTab, nodeById, store, workspaceFocusMode]
  );
  const jumpToWorkspaceChantierNode = useCallback(
    async (nodeId: string) => {
      if (activeChantierStatusFilter !== "all") {
        setActiveChantierStatusFilter("all");
      }
      if (selectedFavoriteGroupIds.length > 0) {
        setSelectedFavoriteGroupIds([]);
      }
      if (favoriteGroupTreeFilterEnabled) {
        setFavoriteGroupTreeFilterEnabled(false);
      }
      if (activeFavoriteGroupId !== FAVORITE_ALL_GROUP_ID) {
        setActiveFavoriteGroupId(FAVORITE_ALL_GROUP_ID);
      }
      await browseTreeNodeInGrid(nodeId);
    },
    [
      activeChantierStatusFilter,
      activeFavoriteGroupId,
      browseTreeNodeInGrid,
      favoriteGroupTreeFilterEnabled,
      selectedFavoriteGroupIds
    ]
  );

  const applyGridSelection = (nodeId: string, options?: { range?: boolean; toggle?: boolean }) => {
    setKeyboardSurface("grid");
    applyIndexedSelection(
      "grid",
      nodeId,
      desktopGridNodes.map((node) => node.id),
      displayedGridIndexById,
      options
    );
  };

  const applyTimelineSelection = (nodeId: string, options?: { range?: boolean; toggle?: boolean }) => {
    setKeyboardSurface("timeline");
    applyIndexedSelection(
      "timeline",
      nodeId,
      displayedTimelineRows.map((row) => row.id),
      displayedTimelineIndexById,
      options
    );
  };

  useEffect(() => {
    if (!store.selectedNodeId) {
      if (selectedNodeIds.size !== 0) {
        setSelectedNodeIds(new Set());
      }
      if (selectionAnchorId !== null) {
        setSelectionAnchorId(null);
      }
      return;
    }

    setSelectionAnchorId((prev) => prev ?? store.selectedNodeId);
  }, [store.selectedNodeId, selectedNodeIds, selectionAnchorId]);

  const toggleExpand = (nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const expandAllTreeNodes = useCallback(() => {
    if (workspaceMode === "grid" && workspaceFocusMode === "execution" && desktopWorkareaOwnerNodeId) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        const visitNode = (nodeId: string) => {
          const children = (byParent.get(nodeId) ?? []).filter(
            (child) => !isHiddenExecutionTaskNode(child) && isWorkareaItemNode(child)
          );
          if (children.length === 0) return;
          next.add(nodeId);
          for (const child of children) {
            visitNode(child.id);
          }
        };
        visitNode(desktopWorkareaOwnerNodeId);
        return next;
      });
      return;
    }
    if (workspaceMode === "timeline") {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        const visitNode = (nodeId: string) => {
          const children = sortTimelineNodesForDisplay(byParent.get(nodeId) ?? []).filter((child) => {
            if (isFileLikeNode(child)) return false;
            if (isWorkareaItemNode(child) && timelineMode !== "tasks") return false;
            if (isHiddenExecutionTaskNode(child) && !isRenderableExecutionProjectionNode(child)) {
              return false;
            }
            return true;
          });
          if (children.length === 0) return;
          next.add(nodeId);
          for (const child of children) {
            visitNode(child.id);
          }
        };

        if (activeProjectRootId) {
          visitNode(activeProjectRootId);
        } else {
          const roots = sortTimelineNodesForDisplay(byParent.get(ROOT_PARENT_ID) ?? []);
          for (const root of roots) {
            if (isFileLikeNode(root)) continue;
            if (isWorkareaItemNode(root) && timelineMode !== "tasks") continue;
            if (isHiddenExecutionTaskNode(root) && !isRenderableExecutionProjectionNode(root)) {
              continue;
            }
            visitNode(root.id);
          }
        }

        if (prev.size === next.size && Array.from(next).every((id) => prev.has(id))) {
          return prev;
        }
        return next;
      });
      return;
    }
    if (hasActiveFavoriteGroupTreeFiltering || treeUsesNodeStateFiltering) return;
    setExpandedIds((prev) => {
      const next = new Set<string>();
      const orderChildrenForDisplay = (nodes: AppNode[]) => {
        const branchNodes: AppNode[] = [];
        const fileLikeNodes: AppNode[] = [];
        for (const node of nodes) {
          if (isFileLikeNode(node)) {
            fileLikeNodes.push(node);
            continue;
          }
          branchNodes.push(node);
        }
        return [...branchNodes, ...fileLikeNodes];
      };

      const visitNode = (nodeId: string) => {
        const children = orderChildrenForDisplay(byParent.get(nodeId) ?? []).filter((child) => {
          if (isHiddenExecutionTaskNode(child)) return false;
          if (isWorkareaItemNode(child) && workspaceFocusMode !== "execution") return false;
          return true;
        });
        if (children.length === 0) return;
        next.add(nodeId);
        for (const child of children) {
          if (isFileLikeNode(child)) continue;
          visitNode(child.id);
        }
      };

      if (activeProjectRootId) {
        visitNode(activeProjectRootId);
      } else {
        const roots = orderChildrenForDisplay(byParent.get(ROOT_PARENT_ID) ?? []);
        for (const root of roots) {
          if (isHiddenExecutionTaskNode(root)) continue;
          if (isWorkareaItemNode(root) && workspaceFocusMode !== "execution") continue;
          if (isFileLikeNode(root)) continue;
          visitNode(root.id);
        }
      }

      if (prev.size === next.size && Array.from(next).every((id) => prev.has(id))) {
        return prev;
      }
      return next;
    });
  }, [
    activeProjectRootId,
    byParent,
    desktopWorkareaOwnerNodeId,
    hasActiveFavoriteGroupTreeFiltering,
    isHiddenExecutionTaskNode,
    isRenderableExecutionProjectionNode,
    sortTimelineNodesForDisplay,
    treeUsesNodeStateFiltering,
    timelineMode,
    workspaceFocusMode,
    workspaceMode
  ]);

  const collapseAllTreeNodes = useCallback(() => {
    if (workspaceMode === "grid" && workspaceFocusMode === "execution") {
      setExpandedIds((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }
    if (workspaceMode === "timeline") {
      setExpandedIds((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }
    if (hasActiveFavoriteGroupTreeFiltering || treeUsesNodeStateFiltering) return;
    setExpandedIds((prev) => (prev.size === 0 ? prev : new Set()));
  }, [hasActiveFavoriteGroupTreeFiltering, treeUsesNodeStateFiltering, workspaceFocusMode, workspaceMode]);

  const openFolder = async (nodeId: string) => {
    const node = await getNode(nodeId);
    if (!node || node.type !== "folder") return;
    await store.navigateTo(node.id);
  };

  const openFileNode = async (nodeId: string) => {
    try {
      await openNodeFile(nodeId);
    } catch {
      // Keep UX silent if OS open fails.
    }
  };

  const openFileNodeWith = async (nodeId: string) => {
    try {
      await openNodeFileWith(nodeId);
    } catch {
      // Keep UX silent if OS open-with fails.
    }
  };

  const openFileNodeLocation = async (nodeId: string) => {
    const node = nodeById.get(nodeId);
    const filePath = node && isFileLikeNode(node) ? getNodePreferredFileLocationPath(node) : null;
    const fallbackParentPath = (() => {
      if (!filePath) return null;
      const normalized = filePath.trim();
      const separatorIndex = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
      if (separatorIndex <= 0) return null;
      return normalized.slice(0, separatorIndex);
    })();
    try {
      await openNodeFileLocation(nodeId);
    } catch {
      if (!fallbackParentPath) return;
      try {
        await openLocalPath(fallbackParentPath);
      } catch {
        // Keep UX silent if OS reveal fails completely.
      }
    }
  };

  const copyFileNodeFullPath = async (nodeId: string) => {
    const node = nodeById.get(nodeId);
    if (!node || !isFileLikeNode(node)) return;
    const fullPath = getNodePreferredFileActionPath(node);
    if (!fullPath) return;

    try {
      await writePlainTextToClipboard(fullPath);
    } catch {
      // Keep UX silent if clipboard write fails.
    }
  };

  const materializeSpreadsheetTreeNodes = async (
    parentId: string | null,
    nodes: SpreadsheetTreeNode[]
  ): Promise<AppNode[]> => {
    const createdRoots: AppNode[] = [];

    const createBranch = async (
      targetParentId: string | null,
      branch: SpreadsheetTreeNode[]
    ): Promise<AppNode[]> => {
      const createdBranch: AppNode[] = [];
      for (const item of branch) {
        const created = await createNode(targetParentId, item.title, "folder");
        const nextProperties: Record<string, unknown> = {
          ...(created.properties ?? {})
        };

        const deliverables = (item.deliverables ?? []).map((entry) => entry.trim()).filter((entry) => entry.length > 0);
        if (deliverables.length > 0) {
          nextProperties.odeExpectedDeliverables = deliverables;
          nextProperties.odeStructuredDeliverables = deliverables.map((title, index) => {
            const matchingTasks =
              (item.deliverableTasks ?? []).find(
                (entry) => entry.deliverable.trim().toLowerCase() === title.trim().toLowerCase()
              )?.tasks ?? [];
            return {
              id: `${created.id}-deliverable-${index + 1}`,
              title,
              tasks: matchingTasks
                .map((taskTitle, taskIndex) => ({
                  id: `${created.id}-deliverable-${index + 1}-task-${taskIndex + 1}`,
                  title: taskTitle.trim(),
                  status: "planned" as const,
                  flagged: false
                }))
                .filter((task) => task.title.length > 0),
              notifications: [],
              data: []
            };
          });
        }
        await updateNodeProperties(created.id, nextProperties);
        if (item.description?.trim()) {
          await updateNodeDescription(created.id, item.description.trim());
        }
        if (item.children.length > 0) {
          await createBranch(created.id, item.children);
        }
        createdBranch.push({
          ...created,
          properties: nextProperties
        });
      }
      return createdBranch;
    };

    createdRoots.push(...(await createBranch(parentId, nodes)));
    return createdRoots;
  };

  const exportNodeBranchTreeSpreadsheet = async (nodeId: string) => {
    try {
      const payload = buildTreeSpreadsheetPayloadFromAppBranch(nodeId, store.allNodes);
      const targetNode = nodeById.get(nodeId) ?? store.allNodes.find((node) => node.id === nodeId) ?? null;
      if (!payload || !targetNode) {
        throw new Error("Select a structural node to export its tree.");
      }
      const exportedPath = await exportTreeStructureExcel(
        t("tree_excel.export_dialog_title"),
        `${targetNode.name}.xlsx`,
        payload
      );
      if (!exportedPath) return;
      setProjectError(null);
      setProjectNotice(t("tree_excel.export_done", { path: exportedPath }));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setProjectNotice(null);
      setProjectError(t("tree_excel.export_failed", { reason }));
    }
  };

  const importTreeSpreadsheetBranch = async (
    targetNodeId?: string | null,
    surface: SelectionSurface = "tree"
  ) => {
    try {
      const spreadsheetPath = await pickWindowsTreeSpreadsheetFile();
      if (!spreadsheetPath) return;
      const rawPayload = await readTreeStructureExcel(spreadsheetPath);
      const payload = normalizeTreeSpreadsheetPayload(rawPayload);
      const treeNodes = parseSpreadsheetPayloadToTreeNodes(payload);
      if (treeNodes.length === 0) {
        throw new Error("The selected workbook contains no tree rows.");
      }
      const targetNode =
        surface === "grid" && targetNodeId === undefined ? null : await resolveMutationTargetNode(targetNodeId);
      const parentId = resolveImportParentNodeId({
        targetNode,
        surface,
        currentFolderId: store.currentFolderId,
        activeProjectRootId
      });
      if (!ensureStructureMutationAllowed([parentId])) return;
      const createdRoots = await materializeSpreadsheetTreeNodes(parentId, treeNodes);
      const firstCreated = createdRoots[0] ?? null;
      if (!firstCreated) {
        throw new Error("No nodes were created from the selected workbook.");
      }
      const expandIds =
        firstCreated.parentId && firstCreated.parentId !== ROOT_PARENT_ID ? [firstCreated.parentId] : [];
      const postImportSurface = resolvePostImportSelectionSurface(surface);
      const revealDesktopFolderId = postImportSurface === "grid" ? parentId : undefined;
      await refreshTreeAndKeepContext(firstCreated.id, expandIds, postImportSurface, revealDesktopFolderId);
      setPrimarySelection(firstCreated.id, postImportSurface);
      setProjectError(null);
      setProjectNotice(
        t("tree_excel.import_done", {
          count: createdRoots.length,
          name: payload.meta?.title?.trim() || firstCreated.name
        })
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setProjectNotice(null);
      setProjectError(t("tree_excel.import_failed", { reason }));
    }
  };

  const resolveTreeSpreadsheetToolbarTargetNodeId = useCallback((): string | null => {
    const resolveExportNodeId = (node: AppNode | null): string | null => {
      if (!node) return null;
      if (!isFileLikeNode(node)) return node.id;
      return node.parentId && node.parentId !== ROOT_PARENT_ID ? node.parentId : activeProjectRootId ?? null;
    };

    const currentFolderNode =
      store.currentFolderId
        ? nodeById.get(store.currentFolderId) ??
          store.allNodes.find((node) => node.id === store.currentFolderId) ??
          null
        : null;

    return (
      resolveExportNodeId(currentFolderNode) ??
      resolveExportNodeId(selectedNode) ??
      activeProjectRootId ??
      null
    );
  }, [activeProjectRootId, nodeById, selectedNode, store.allNodes, store.currentFolderId]);
  const treeSpreadsheetToolbarTargetNodeId = resolveTreeSpreadsheetToolbarTargetNodeId();
  const canImportTreeSpreadsheet = projects.length > 0 && !workspaceStructureLocked;
  const canExportTreeSpreadsheet = Boolean(treeSpreadsheetToolbarTargetNodeId);

  const runTreeSpreadsheetImportFromSurface = useCallback(
    (surface: "tree" | "grid" | "timeline") => {
      void importTreeSpreadsheetBranch(treeSpreadsheetToolbarTargetNodeId, surface);
    },
    [importTreeSpreadsheetBranch, treeSpreadsheetToolbarTargetNodeId]
  );

  const runTreeSpreadsheetExport = useCallback(() => {
    if (!treeSpreadsheetToolbarTargetNodeId) return;
    void exportNodeBranchTreeSpreadsheet(treeSpreadsheetToolbarTargetNodeId);
  }, [exportNodeBranchTreeSpreadsheet, treeSpreadsheetToolbarTargetNodeId]);

  const exportNodeBranchPackage = async (nodeId: string) => {
    try {
      const packagePath = await exportNodePackage(nodeId);
      if (isTauri()) {
        try {
          await writeClipboardText(packagePath);
        } catch {
          // Ignore clipboard write failures.
        }
      }
      setProjectError(null);
      setProjectNotice(t("share.export_done", { path: packagePath }));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setProjectNotice(null);
      setProjectError(t("share.export_failed", { reason }));
    }
  };

  const importNodeBranchPackage = async (
    targetNodeId?: string | null,
    surface: SelectionSurface = "tree"
  ) => {
    try {
      const packagePath = await pickWindowsNodePackageFile();
      if (!packagePath) return;
      const targetNode =
        surface === "grid" && targetNodeId === undefined ? null : await resolveMutationTargetNode(targetNodeId);
      const parentId = resolveImportParentNodeId({
        targetNode,
        surface,
        currentFolderId: store.currentFolderId,
        activeProjectRootId
      });
      if (!ensureStructureMutationAllowed([parentId])) return;
      const created = await importNodePackage(parentId, packagePath);
      const expandNodeIds =
        created.parentId && created.parentId !== ROOT_PARENT_ID ? [created.parentId] : [];
      const postImportSurface = resolvePostImportSelectionSurface(surface);
      const revealDesktopFolderId = postImportSurface === "grid" ? parentId : undefined;
      await refreshTreeAndKeepContext(created.id, expandNodeIds, postImportSurface, revealDesktopFolderId);
      setPrimarySelection(created.id, postImportSurface);
      setProjectError(null);
      setProjectNotice(t("share.import_done", { name: created.name }));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setProjectNotice(null);
      setProjectError(t("share.import_failed", { reason }));
    }
  };

  const importExternalFilesToNode = async (
    sourcePaths: string[],
    targetNodeId?: string | null,
    surface: SelectionSurface = "tree"
  ): Promise<boolean> => {
    if (!isDesktopRuntime) return false;
    const dedupe = new Set<string>();
    const cleaned = sourcePaths
      .map((path) => normalizeFilePathToken(path) ?? path.trim())
      .map((path) => path.trim())
      .filter((path) => path.length > 0)
      .filter((path) => {
        const key = path.toLowerCase();
        if (dedupe.has(key)) return false;
        dedupe.add(key);
        return true;
      });
    if (cleaned.length === 0) return false;

    const targetNode =
      surface === "grid" && targetNodeId === undefined ? null : await resolveMutationTargetNode(targetNodeId);
    const parentId = resolveImportParentNodeId({
      targetNode,
      surface,
      currentFolderId: store.currentFolderId,
      activeProjectRootId
    });
    if (!ensureStructureMutationAllowed([parentId], { scope: "content" })) return false;
    const revealDesktopFolderId = surface === "grid" ? parentId : undefined;
    const importKey = buildExternalImportDedupKey(cleaned, parentId);
    const recentImport = recentExternalImportRef.current;
    const now = Date.now();
    if (activeExternalImportKeysRef.current.has(importKey)) return false;
    if (recentImport && recentImport.key === importKey && now - recentImport.handledAt < 800) {
      return false;
    }

    activeExternalImportKeysRef.current.add(importKey);
    try {
      const created = await importFilesToNode(parentId, cleaned);
      if (created.length === 0) return false;

      const expandNodeIds = parentId ? [parentId] : [];
      await refreshTreeAndKeepContext(
        created[created.length - 1].id,
        expandNodeIds,
        resolvePostImportSelectionSurface(surface),
        revealDesktopFolderId
      );
      recentExternalImportRef.current = {
        key: importKey,
        handledAt: Date.now()
      };
      setProjectError(null);
      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setProjectNotice(null);
      setProjectError(t("share.import_failed", { reason }));
      return false;
    } finally {
      activeExternalImportKeysRef.current.delete(importKey);
    }
  };
  useEffect(() => {
    importExternalFilesToNodeRef.current = importExternalFilesToNode;
  }, [importExternalFilesToNode]);

  const pasteExternalFilesFromClipboard = async (
    targetNodeId?: string | null,
    surface: SelectionSurface = "tree"
  ): Promise<boolean> => {
    const windowsClipboardFiles = await readWindowsClipboardFilePaths();
    if (windowsClipboardFiles.length > 0) {
      return importExternalFilesToNode(windowsClipboardFiles, targetNodeId, surface);
    }
    const raw = await readSystemClipboardText();
    if (!raw) return false;
    const paths = parseFilePathsFromClipboardText(raw);
    if (paths.length === 0) return false;
    return importExternalFilesToNode(paths, targetNodeId, surface);
  };

  const collectFileInputPaths = (fileList: FileList | null): string[] => {
    if (!fileList || fileList.length === 0) return [];
    const paths: string[] = [];
    for (const file of Array.from(fileList)) {
      const candidate = (file as File & { path?: string }).path;
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        paths.push(candidate.trim());
      }
    }
    return paths;
  };

  const resolveDesktopUploadTargetId = useCallback((): string | null => {
    const fallbackUploadTargetId =
      workspaceMode === "grid" && workspaceFocusMode === "execution"
        ? desktopWorkareaBrowseNodeId ?? desktopWorkareaOwnerNodeId ?? activeProjectRootId ?? null
        : desktopMirrorRootId ?? activeProjectRootId ?? null;

    if (workspaceMode === "grid" && workspaceFocusMode === "execution") {
      return fallbackUploadTargetId;
    }

    const resolveUploadTargetFromNode = (node: AppNode | null): string | null => {
      if (!node) return null;
      if (isFileLikeNode(node)) {
        const parentId =
          node.parentId && node.parentId !== ROOT_PARENT_ID
            ? node.parentId
            : activeProjectRootId ?? null;
        if (!parentId) return activeProjectRootId ?? null;
        if (projectScopedNodeIds && !projectScopedNodeIds.has(parentId)) {
          return activeProjectRootId ?? null;
        }
        return parentId;
      }
      if (!projectScopedNodeIds || projectScopedNodeIds.has(node.id)) {
        return node.id;
      }
      return null;
    };

    const currentDesktopFolderNode =
      store.currentFolderId
        ? nodeById.get(store.currentFolderId) ??
          store.allNodes.find((node) => node.id === store.currentFolderId) ??
          null
        : null;
    const currentFolderTargetId = resolveUploadTargetFromNode(currentDesktopFolderNode);
    if (currentFolderTargetId) {
      return currentFolderTargetId;
    }

    if (selectedNode) {
      const selectedTargetId = resolveUploadTargetFromNode(selectedNode);
      if (selectedTargetId) return selectedTargetId;
    }

    const desktopPaneNode =
      desktopMirrorRootId
        ? nodeById.get(desktopMirrorRootId) ??
          store.allNodes.find((node) => node.id === desktopMirrorRootId) ??
          null
        : null;
    const desktopPaneTargetId = resolveUploadTargetFromNode(desktopPaneNode);
    if (desktopPaneTargetId) {
      return desktopPaneTargetId;
    }

    return fallbackUploadTargetId;
  }, [
    activeProjectRootId,
    desktopMirrorRootId,
    desktopWorkareaBrowseNodeId,
    desktopWorkareaOwnerNodeId,
    nodeById,
    projectScopedNodeIds,
    selectedNode,
    store.allNodes,
    store.currentFolderId,
    workspaceFocusMode,
    workspaceMode
  ]);

  const triggerDesktopUpload = async () => {
    const uploadTargetId = resolveDesktopUploadTargetId();
    pendingDesktopUploadTargetIdRef.current = uploadTargetId;
    if (isDesktopRuntime) {
      let shouldFallbackToHtmlInput = false;
      setDesktopUploadSessionActive(true);
      try {
        const picked = await pickWindowsFilesForImport();
        if (picked.length > 0) {
          await importExternalFilesToNode(picked, uploadTargetId, "grid");
          pendingDesktopUploadTargetIdRef.current = null;
          return;
        }
        pendingDesktopUploadTargetIdRef.current = null;
        return;
      } catch {
        // Fall back to HTML file input if native picker fails.
        shouldFallbackToHtmlInput = true;
      } finally {
        setDesktopUploadSessionActive(false);
      }
      if (!shouldFallbackToHtmlInput) {
        pendingDesktopUploadTargetIdRef.current = null;
        return;
      }
    }
    uploadInputRef.current?.click();
  };

  const onUploadInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const uploadTargetId = pendingDesktopUploadTargetIdRef.current ?? resolveDesktopUploadTargetId();
    const paths = collectFileInputPaths(event.target.files);
    pendingDesktopUploadTargetIdRef.current = null;
    event.target.value = "";
    if (paths.length === 0) return;
    void importExternalFilesToNode(paths, uploadTargetId, "grid");
  };

  const reportExecutionProjectionMoveBlocked = () => {
    setProjectError(t("project.move_execution_task_blocked"));
  };

  const resolveExecutionOwnerNode = (node: AppNode): AppNode | null => {
    const executionMeta = getExecutionTaskMeta(node);
    return executionMeta ? nodeById.get(executionMeta.ownerNodeId) ?? null : null;
  };

  function buildIndexedWorkareaTitle(baseLabel: string, existingTitles: Iterable<string>): string {
    const normalizedBase = baseLabel.trim() || "Item";
    const existing = new Set(
      Array.from(existingTitles)
        .map((title) => title.trim().toLowerCase())
        .filter((title) => title.length > 0)
    );
    let index = 1;
    let candidate = `${normalizedBase} ${index}`;
    while (existing.has(candidate.trim().toLowerCase())) {
      index += 1;
      candidate = `${normalizedBase} ${index}`;
    }
    return candidate;
  }

  const readStoredWorkareaItemKind = (node: AppNode | null | undefined): WorkareaItemKind | null => {
    const kind = node?.properties?.odeWorkareaItemKind;
    if (kind === "deliverable" || kind === "task" || kind === "subtask") {
      return kind;
    }
    return null;
  };

  const getWorkareaBaseLabel = (kind: WorkareaItemKind): string => {
    if (kind === "deliverable") return t("procedure.node_deliverable_default");
    if (kind === "subtask") return t("procedure.node_subtask_default");
    return t("procedure.node_task_default");
  };

  const createNewTopicNode = async (
    parentId: string | null,
    surface: SelectionSurface,
    options?: {
      initialText?: string;
      expandNodeIds?: string[];
      repositionAfterId?: string | null;
      reposition?: boolean;
      startInlineEdit?: boolean;
      commitInitialText?: boolean;
    }
  ) => {
    const fallbackSelectionId = store.selectedNodeId;
    const expandNodeIds = options?.expandNodeIds ?? [parentId ?? ROOT_PARENT_ID];
    const currentDesktopFolderId = store.currentFolderId ?? null;
    const revealDesktopFolderId =
      surface === "grid" && parentId !== currentDesktopFolderId ? parentId : undefined;
    const workareaParentNode =
      parentId !== null
        ? nodeById.get(parentId) ?? store.allNodes.find((node) => node.id === parentId) ?? null
        : null;
    const shouldCreateWorkareaItem = workspaceFocusMode === "execution";
    if (
      !ensureStructureMutationAllowed([parentId], {
        scope: shouldCreateWorkareaItem ? "workarea" : "organization"
      })
    ) {
      return null;
    }
    const workareaKind = shouldCreateWorkareaItem
      ? resolveWorkareaItemKindForParent(workareaParentNode, nodeById)
      : null;
    const workareaSiblingTitles =
      shouldCreateWorkareaItem && parentId !== null
        ? (byParent.get(parentId) ?? []).filter((child) => isWorkareaItemNode(child)).map((child) => child.name)
        : [];
    const nextWorkareaTitle =
      shouldCreateWorkareaItem && workareaKind
        ? buildIndexedWorkareaTitle(
            getWorkareaBaseLabel(workareaKind),
            options?.initialText?.trim().length ? [] : workareaSiblingTitles
          )
        : "";
    const requestedInitialText = options?.initialText ?? "";
    const hasRequestedInitialText = requestedInitialText.trim().length > 0;
    const shouldStartInlineEdit = options?.startInlineEdit ?? true;
    const shouldCommitInitialText = Boolean(options?.commitInitialText && hasRequestedInitialText);
    const initialInlineText =
      shouldCreateWorkareaItem && workareaKind
        ? hasRequestedInitialText
          ? requestedInitialText
          : ""
        : options?.initialText ?? "";
    const newNode = await createNode(
      parentId,
      shouldCreateWorkareaItem && workareaKind
        ? hasRequestedInitialText
          ? requestedInitialText
          : nextWorkareaTitle
        : shouldCommitInitialText
          ? requestedInitialText
          : t("node.new_topic"),
      "folder"
    );
    if (shouldCreateWorkareaItem) {
      const nextProperties: Record<string, unknown> = {
        ...(newNode.properties ?? {}),
        odeWorkareaItem: true,
        odeWorkareaItemKind: workareaKind ?? "deliverable"
      };
      await updateNodeProperties(newNode.id, nextProperties);
      store.patchNode(newNode.id, {
        properties: nextProperties,
        updatedAt: Date.now()
      });
    }
    if (shouldStartInlineEdit) {
      registerProvisionalInlineCreate(newNode.id, {
        fallbackSelectionId,
        surface,
        expandNodeIds
      });
      primeInlineEditState(newNode.id, initialInlineText, surface);
    }
    if (options?.reposition) {
      await moveNode(newNode.id, parentId, options.repositionAfterId ?? null);
    }
    if (surface === "grid" && desktopViewMode === "mindmap" && mindMapContentMode === "quick_access") {
      setMindMapContentMode("node_tree");
    }
    await refreshTreeAndKeepContext(newNode.id, expandNodeIds, surface, revealDesktopFolderId);
    return newNode.id;
  };

  const createRootFolder = async (
    surface: SelectionSurface = selectionSurface,
    initialText?: string,
    options?: {
      startInlineEdit?: boolean;
      commitInitialText?: boolean;
    }
  ) => {
    const resolvedSurface = resolveEffectiveCreationSurfaceForWorkspace(surface, workspaceMode);
    const parentId = activeProjectRootId ?? null;
    await createNewTopicNode(parentId, resolvedSurface, {
      initialText,
      expandNodeIds: parentId ? [parentId] : [],
      startInlineEdit: options?.startInlineEdit,
      commitInitialText: options?.commitInitialText
    });
  };

  const createSurfaceDefaultTopic = async (
    surface: SelectionSurface = selectionSurface,
    initialText?: string,
    options?: {
      startInlineEdit?: boolean;
      commitInitialText?: boolean;
    }
  ) => {
    const resolvedSurface = resolveEffectiveCreationSurfaceForWorkspace(surface, workspaceMode);
    if (resolvedSurface === "timeline") {
      const timelineSelection = resolveVisibleSelectionForSurface({
        selectedNode,
        projectScopedNodeIds,
        surface: "timeline",
        displayedTreeIndexById,
        displayedGridIndexById,
        displayedTimelineIndexById
      });
      if (timelineSelection && getExecutionTaskMeta(timelineSelection)) {
        await createExecutionTaskRelative(timelineSelection.id, {
          initialText,
          startInlineEdit: options?.startInlineEdit ?? true
        });
        return;
      }
      if (workspaceFocusMode === "execution") {
        const ownerNodeId = resolveWorkareaOwnerNodeId();
        const ownerNode = ownerNodeId ? nodeById.get(ownerNodeId) ?? null : null;
        const targetNode = timelineSelection ?? ownerNode;
        if (targetNode) {
          await createChildNode(targetNode.id, "timeline", initialText, options);
          return;
        }
      }
      const visibleSelection = resolveStructuralCreationTargetNode(
        timelineSelection,
        (node) => {
          const executionMeta = getExecutionTaskMeta(node);
          return executionMeta ? nodeById.get(executionMeta.ownerNodeId) ?? null : null;
        }
      );
      if (visibleSelection && !isFileLikeNode(visibleSelection)) {
        await createChildNode(visibleSelection.id, "timeline", initialText, options);
        return;
      }
      await createRootFolder("timeline", initialText, options);
      return;
    }
    if (resolvedSurface === "grid") {
      if (workspaceFocusMode === "execution") {
        const visibleSelection = resolveVisibleSelectionForSurface({
          selectedNode,
          projectScopedNodeIds,
          surface: "grid",
          displayedTreeIndexById,
          displayedGridIndexById,
          displayedTimelineIndexById
        });
        if (visibleSelection) {
          await createChildNode(visibleSelection.id, "grid", initialText, options);
          return;
        }
        const parentId = resolveWorkareaCreationParentNodeId("grid");
        if (parentId) {
          await createNewTopicNode(parentId, "grid", {
            initialText,
            expandNodeIds: [parentId],
            startInlineEdit: options?.startInlineEdit,
            commitInitialText: options?.commitInitialText
          });
          return;
        }
      }
      const parentId = store.currentFolderId ?? activeProjectRootId ?? null;
      await createNewTopicNode(parentId, "grid", {
        initialText,
        expandNodeIds: parentId ? [parentId] : [],
        startInlineEdit: options?.startInlineEdit,
        commitInitialText: options?.commitInitialText
      });
      return;
    }
    if (workspaceFocusMode === "execution") {
      const parentId = resolveWorkareaCreationParentNodeId("tree");
      if (parentId) {
        await createNewTopicNode(parentId, "tree", {
          initialText,
          expandNodeIds: [parentId],
          startInlineEdit: options?.startInlineEdit,
          commitInitialText: options?.commitInitialText
        });
        return;
      }
    }
    await createRootFolder("tree", initialText, options);
  };

  const createChildFolder = async (
    surface: SelectionSurface = selectionSurface,
    initialText?: string
  ) => {
    const resolvedSurface = resolveEffectiveCreationSurfaceForWorkspace(surface, workspaceMode);
    const visibleSelection = resolveStructuralCreationTargetNode(
      resolveVisibleSelectionForSurface({
        selectedNode,
        projectScopedNodeIds,
        surface: resolvedSurface,
        displayedTreeIndexById,
        displayedGridIndexById,
        displayedTimelineIndexById
      }),
      (node) => {
        const executionMeta = getExecutionTaskMeta(node);
        return executionMeta ? nodeById.get(executionMeta.ownerNodeId) ?? null : null;
      }
    );
    if (visibleSelection && isFileLikeNode(visibleSelection)) {
      const parentId = visibleSelection.parentId === ROOT_PARENT_ID ? null : visibleSelection.parentId;
      await createNewTopicNode(parentId, resolvedSurface, {
        initialText,
        expandNodeIds: [visibleSelection.parentId],
        repositionAfterId: visibleSelection.id,
        reposition: true
      });
      return;
    }
    if (visibleSelection) {
      await createNewTopicNode(visibleSelection.id, resolvedSurface, {
        initialText,
        expandNodeIds: [visibleSelection.id]
      });
      return;
    }
    const parentId = resolveDefaultCreationParentNodeId({
      resolvedSurface,
      currentFolderId: store.currentFolderId,
      activeProjectRootId
    });
    await createNewTopicNode(parentId, resolvedSurface, {
      initialText,
      expandNodeIds: parentId ? [parentId] : []
    });
  };

  const navigateUpOneFolder = async (surface: SelectionSurface = selectionSurface) => {
    const currentFolderId = store.currentFolderId;
    if (!currentFolderId) return;
    if (activeProjectRootId && currentFolderId === activeProjectRootId) return;
    const targetSurface: SelectionSurface = workspaceMode === "timeline" ? "timeline" : surface;

    const currentFolder = nodeById.get(currentFolderId);
    if (!currentFolder) {
      await store.navigateTo(activeProjectRootId ?? null);
      setPrimarySelection(null, targetSurface);
      return;
    }

    const parentFolderId = currentFolder.parentId === ROOT_PARENT_ID ? null : currentFolder.parentId;
    const boundedParentId =
      activeProjectRootId && (parentFolderId === null || !projectScopedNodeIds?.has(parentFolderId))
        ? activeProjectRootId
        : parentFolderId;
    await store.navigateTo(boundedParentId);
    // Keep the folder we came from selected on the same active surface,
    // so navigate-up feels identical in Grid, Mind Map, Details, and Timeline.
    setPrimarySelection(currentFolder.id, targetSurface);
  };

  const renameSelectedFolder = async () => {
    if (!selectedNode) return;
    beginInlineEdit(selectedNode.id, undefined, selectionSurface);
  };

  const openScheduleModal = (nodeId: string) => {
    if (!nodeById.has(nodeId)) return;
    setScheduleModalNodeId(nodeId);
    setScheduleModalOpen(true);
  };

  const closeScheduleModal = () => {
    setScheduleModalOpen(false);
    setScheduleModalNodeId(null);
  };

  const saveNodeSchedule = async (schedule: NodeTimelineSchedule) => {
    if (!scheduleModalNodeId) return;
    await saveNodeScheduleForNodeId(scheduleModalNodeId, schedule);
  };

  const saveNodeScheduleForNodeId = async (nodeId: string, schedule: NodeTimelineSchedule) => {
    const node = nodeById.get(nodeId);
    if (!node) return;
    const executionMeta = getExecutionTaskMeta(node);
    const refreshTargetId = executionMeta?.ownerNodeId ?? node.id;
    const normalizedSchedule = normalizeTimelineSchedule(schedule);
    const nextProperties: Record<string, unknown> = {
      ...(node.properties ?? {}),
      timelineSchedule: {
        ...normalizedSchedule,
        mode: "manual"
      }
    };
    await updateNodeProperties(node.id, nextProperties);
    store.patchNode(node.id, {
      properties: nextProperties,
      updatedAt: Date.now()
    });
    await refreshTreeAndKeepContext(refreshTargetId);
  };

  const clearNodeSchedule = async () => {
    if (!scheduleModalNodeId) return;
    const node = nodeById.get(scheduleModalNodeId);
    if (!node) return;
    const executionMeta = getExecutionTaskMeta(node);
    const refreshTargetId = executionMeta?.ownerNodeId ?? node.id;
    const nextProperties: Record<string, unknown> = {
      ...(node.properties ?? {})
    };
    delete nextProperties.timelineSchedule;
    await updateNodeProperties(node.id, nextProperties);
    store.patchNode(node.id, {
      properties: nextProperties,
      updatedAt: Date.now()
    });
    await refreshTreeAndKeepContext(refreshTargetId);
  };

  const createOrResolveFavoriteGroupId = (nameInput: string): string => {
    const normalizedName = nameInput.trim();
    if (!normalizedName) return "";
    const existingGroupId = resolveExistingFavoriteGroupId(normalizedName, favoriteGroups);
    if (existingGroupId) return existingGroupId;

    const nextId = `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setFavoriteGroups((prev) => [...prev, { id: nextId, name: normalizedName }]);
    return nextId;
  };

  const closeFavoriteGroupModal = () => {
    setFavoriteGroupModalOpen(false);
    setFavoriteGroupNameInput("");
    setFavoriteGroupEditingId(null);
    setFavoriteGroupTargetNodeIds([]);
  };

  const closeFavoriteGroupSettingsModal = () => {
    setFavoriteGroupSettingsModalOpen(false);
    setFavoriteGroupNameInput("");
  };

  const closeFavoriteAssignModal = () => {
    setFavoriteAssignModalOpen(false);
    setFavoriteAssignNodeIds([]);
    setFavoriteAssignGroupStates({});
  };

  const resolveSelectedActionNodeIds = (
    sourceNodeId?: string | null,
    surface: SelectionSurface = selectionSurface,
    options?: { filterDescendants?: boolean }
  ): string[] =>
    resolveOrderedActionSelectionIds({
      sourceNodeId,
      surface,
      selectedNodeId: store.selectedNodeId,
      selectedNodeIds,
      nodeById,
      displayedTreeIndexById,
      displayedGridIndexById,
      displayedTimelineIndexById,
      fallbackIndexById: nodeOrderIndexById,
      filterDescendants: options?.filterDescendants,
      isNodeInSubtree
    });

  const resolveFavoriteActionNodes = (
    sourceNodeId?: string | null,
    surface: SelectionSurface = selectionSurface,
    options?: { filterDescendants?: boolean }
  ): AppNode[] =>
    resolveSelectedActionNodeIds(sourceNodeId, surface, options)
      .map((nodeId) => nodeById.get(nodeId) ?? null)
      .filter((node): node is AppNode => Boolean(node));

  const resolveExplicitFavoriteActionNodeIds = (
    sourceNodeId?: string | null,
    surface: SelectionSurface = selectionSurface
  ): string[] =>
    resolveSelectedActionNodeIds(sourceNodeId, surface).filter((nodeId, index, ids) => ids.indexOf(nodeId) === index);

  const resolveExplicitFavoriteActionNodes = (
    sourceNodeId?: string | null,
    surface: SelectionSurface = selectionSurface
  ): AppNode[] =>
    resolveExplicitFavoriteActionNodeIds(sourceNodeId, surface)
      .map((nodeId) => nodeById.get(nodeId) ?? null)
      .filter((node): node is AppNode => Boolean(node));

  const updateFavoriteNodeMembership = async (
    node: AppNode,
    groupIds: string[],
    options?: {
      preserveFavoriteWhenEmpty?: boolean;
      surface?: SelectionSurface;
    }
  ) => {
    const normalizedGroupIds = normalizeFavoriteGroupIds(groupIds);
    const nextProperties: Record<string, unknown> = {
      ...(node.properties ?? {})
    };
    const shouldRemainFavorite = normalizedGroupIds.length > 0 || options?.preserveFavoriteWhenEmpty === true;

    if (shouldRemainFavorite) {
      nextProperties.favorite = true;
      delete nextProperties.isFavorite;
    } else {
      delete nextProperties.favorite;
      delete nextProperties.isFavorite;
    }

    if (normalizedGroupIds.length > 0) {
      nextProperties.favoriteGroupIds = normalizedGroupIds;
    } else {
      delete nextProperties.favoriteGroupIds;
      delete nextProperties.favoriteGroups;
    }

    const ensureExpandedParentIds =
      node.parentId !== ROOT_PARENT_ID ? [node.parentId] : [];
    await updateNodeProperties(node.id, nextProperties);
    await refreshTreeAndKeepContext(node.id, ensureExpandedParentIds, options?.surface);
  };

  const assignNodeToFavoriteGroups = async (node: AppNode, groupIds: string[]) => {
    const normalizedGroupIds = normalizeFavoriteGroupIds(groupIds);
    if (normalizedGroupIds.length === 0) return;
    const currentGroupIds = getNodeFavoriteGroupIds(node);
    const nextGroupIds = Array.from(new Set([...currentGroupIds, ...normalizedGroupIds]));
    if (
      isNodeFavorite(node) &&
      currentGroupIds.length === nextGroupIds.length &&
      currentGroupIds.every((groupId, index) => groupId === nextGroupIds[index])
    ) {
      return;
    }
    await updateFavoriteNodeMembership(node, nextGroupIds, {
      preserveFavoriteWhenEmpty: true
    });
  };

  const moveNodeToFavoriteGroup = async (nodeId: string, targetGroupId: string | null) => {
    const node = nodeById.get(nodeId);
    if (!node) return;

    const currentGroupIds = getNodeFavoriteGroupIds(node);
    const { normalizedTargetGroupId, nextGroupIds, unchanged } = resolveFavoriteMoveState({
      currentGroupIds,
      favoriteGroups,
      targetGroupId
    });
    if (unchanged) return;

    await updateFavoriteNodeMembership(node, nextGroupIds, {
      preserveFavoriteWhenEmpty: true,
      surface: "grid"
    });
    setPrimarySelection(node.id, "grid");
    setActiveFavoriteGroupId(normalizedTargetGroupId ?? FAVORITE_ALL_GROUP_ID);
    setSelectedFavoriteGroupIds(normalizedTargetGroupId ? [normalizedTargetGroupId] : []);
    setFavoriteGroupTreeFilterEnabled(Boolean(normalizedTargetGroupId));
  };

  const openFavoriteGroupCreateModal = (targetNodeIds: string[] = []) => {
    setFavoriteGroupEditingId(null);
    setFavoriteGroupNameInput("");
    setFavoriteGroupTargetNodeIds(targetNodeIds);
    setFavoriteGroupModalOpen(true);
  };

  const openFavoriteGroupSettingsModal = () => {
    setFavoriteGroupNameInput("");
    setFavoriteGroupSettingsModalOpen(true);
  };

  const openFavoriteGroupRenameModal = (groupId: string) => {
    const group = favoriteGroups.find((item) => item.id === groupId);
    if (!group) return;
    setFavoriteGroupEditingId(groupId);
    setFavoriteGroupNameInput(group.name);
    setFavoriteGroupTargetNodeIds([]);
    setFavoriteGroupModalOpen(true);
  };

  const openFavoriteAssignModal = (sourceNodeId?: string | null) => {
    const sourceNodes = resolveExplicitFavoriteActionNodes(sourceNodeId);
    if (sourceNodes.length === 0) return;
    const sourceNode = sourceNodes[0];
    const defaultGroupIds = resolveFavoriteAssignDefaultGroupIds({
      currentGroupIds: getNodeFavoriteGroupIds(sourceNode),
      favoriteGroups,
      activeFavoriteGroupId,
      allGroupId: FAVORITE_ALL_GROUP_ID
    });
    const defaultStates = buildFavoriteGroupSelectionStateMap({
      nodes: sourceNodes,
      favoriteGroups,
      getNodeGroupIds: (node) => getNodeFavoriteGroupIds(node)
    });
    const selectionState = resolveFavoriteSelectionState({
      nodes: sourceNodes,
      isFavoriteNode: (node) => isNodeFavorite(node)
    });
    const nextStates =
      selectionState === "none" && defaultGroupIds.length > 0
        ? (Object.fromEntries(
            favoriteGroups.map((group) => [
              group.id,
              defaultGroupIds.includes(group.id) ? "all" : "none"
            ])
          ) as Record<string, FavoriteGroupSelectionState>)
        : defaultStates;
    setFavoriteAssignGroupStates(nextStates);
    setFavoriteAssignNodeIds(sourceNodes.map((node) => node.id));
    setFavoriteAssignModalOpen(true);
  };

  const createFavoriteGroup = () => {
    openFavoriteGroupCreateModal();
  };

  const confirmCreateFavoriteGroupFromSettings = () => {
    const normalizedName = favoriteGroupNameInput.trim();
    if (!normalizedName) {
      setProjectError(t("favorites.group_name_required"));
      return;
    }
    const nextId = createOrResolveFavoriteGroupId(normalizedName);
    if (!nextId) {
      setProjectError(t("favorites.group_name_required"));
      return;
    }
    setFavoriteGroupNameInput("");
    setProjectError(null);
  };

  const confirmCreateFavoriteGroup = async () => {
    const normalizedName = favoriteGroupNameInput.trim();
    if (!normalizedName) {
      setProjectError(t("favorites.group_name_required"));
      return;
    }
    if (favoriteGroupEditingId) {
      setFavoriteGroups((prev) =>
        prev.map((group) =>
          group.id === favoriteGroupEditingId
            ? {
                ...group,
                name: normalizedName
              }
            : group
        )
      );
      closeFavoriteGroupModal();
      setProjectError(null);
      return;
    }
    const nextId = createOrResolveFavoriteGroupId(normalizedName);
    if (!nextId) {
      setProjectError(t("favorites.group_name_required"));
      return;
    }
    const targetNodeIds = favoriteGroupTargetNodeIds;
    closeFavoriteGroupModal();
    setProjectError(null);
    if (targetNodeIds.length === 0) {
      setActiveFavoriteGroupId(nextId);
      setSelectedFavoriteGroupIds([nextId]);
      setFavoriteGroupTreeFilterEnabled(true);
    }
    for (const targetNodeId of targetNodeIds) {
      const targetNode = nodeById.get(targetNodeId);
      if (!targetNode) continue;
      await assignNodeToFavoriteGroups(targetNode, [nextId]);
    }
  };

  const assignFavoriteNodeToGroup = async (nodeId?: string | null) => {
    openFavoriteAssignModal(nodeId);
  };

  const handleFavoriteGroupClick = async (
    groupId: string,
    sourceNodeId?: string | null,
    options?: { toggle?: boolean }
  ) => {
    const targetNodeIds = resolveExplicitFavoriteActionNodeIds(sourceNodeId, selectionSurface);
    const selectionSignature = buildSelectionSignature(new Set(targetNodeIds), selectionSurface);
    const shouldAssignSelection =
      groupId !== FAVORITE_ALL_GROUP_ID &&
      targetNodeIds.length > 0 &&
      favoriteGroupAssignmentSignatureRef.current === selectionSignature;
    const nodesToAssign = targetNodeIds
      .map((nodeId) => nodeById.get(nodeId) ?? null)
      .filter((node): node is AppNode => Boolean(node))
      .filter((node) => !getNodeFavoriteGroupIds(node).includes(groupId));

    if (shouldAssignSelection && nodesToAssign.length > 0) {
      for (const node of nodesToAssign) {
        await assignNodeToFavoriteGroups(node, [groupId]);
      }
      setSelectionFromIds(
        targetNodeIds,
        store.selectedNodeId && targetNodeIds.includes(store.selectedNodeId)
          ? store.selectedNodeId
          : targetNodeIds[0] ?? null,
        selectionSurface
      );
    }

    if (shouldAssignSelection) {
      favoriteGroupAssignmentSignatureRef.current = null;
      favoriteGroupAssignmentConsumedSignatureRef.current = selectionSignature;
    }

    if (groupId === FAVORITE_ALL_GROUP_ID) {
      setActiveFavoriteGroupId(FAVORITE_ALL_GROUP_ID);
      setSelectedFavoriteGroupIds([]);
      setFavoriteGroupTreeFilterEnabled(false);
      return;
    }

    const nextSelectedGroupIds = options?.toggle
      ? (() => {
          const next = new Set(selectedFavoriteGroupFilterIds);
          if (next.has(groupId)) {
            next.delete(groupId);
          } else {
            next.add(groupId);
          }
          return Array.from(next);
        })()
      : [groupId];

    setActiveFavoriteGroupId(nextSelectedGroupIds.length > 0 ? groupId : FAVORITE_ALL_GROUP_ID);
    setSelectedFavoriteGroupIds(nextSelectedGroupIds);
    setFavoriteGroupTreeFilterEnabled(nextSelectedGroupIds.length > 0);
  };

  const confirmAssignFavoriteGroup = async () => {
    const nodeIds = favoriteAssignNodeIds;
    const groupStates = favoriteAssignGroupStates;
    if (nodeIds.length === 0) return;
    closeFavoriteAssignModal();
    for (const nodeId of nodeIds) {
      const node = nodeById.get(nodeId);
      if (!node) continue;
      const nextGroupIds = new Set(getNodeFavoriteGroupIds(node));
      for (const group of favoriteGroups) {
        const state = groupStates[group.id] ?? "none";
        if (state === "all") {
          nextGroupIds.add(group.id);
          continue;
        }
        if (state === "none") {
          nextGroupIds.delete(group.id);
        }
      }
      await updateFavoriteNodeMembership(node, Array.from(nextGroupIds), {
        preserveFavoriteWhenEmpty: isNodeFavorite(node)
      });
    }
  };

  const favoriteAssignSelectAllState = useMemo<FavoriteGroupSelectionState>(() => {
    if (favoriteGroups.length === 0) return "none";
    const states = favoriteGroups.map((group) => favoriteAssignGroupStates[group.id] ?? "none");
    if (states.every((state) => state === "all")) return "all";
    if (states.every((state) => state === "none")) return "none";
    return "some";
  }, [favoriteAssignGroupStates, favoriteGroups]);

  useEffect(() => {
    if (!favoriteGroupModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeFavoriteGroupModal();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        void confirmCreateFavoriteGroup();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [favoriteGroupModalOpen, favoriteGroupNameInput, favoriteGroupTargetNodeIds]);

  useEffect(() => {
    if (!favoriteAssignModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeFavoriteAssignModal();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        void confirmAssignFavoriteGroup();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [favoriteAssignModalOpen, favoriteAssignNodeIds, favoriteAssignGroupStates, favoriteGroups]);

  const removeNodeFromFavoriteGroups = async (node: AppNode, groupIdsToRemove: string[]) => {
    const currentGroupIds = getNodeFavoriteGroupIds(node);
    if (currentGroupIds.length === 0) return;
    const normalizedToRemove = new Set(normalizeFavoriteGroupIds(groupIdsToRemove));
    if (normalizedToRemove.size === 0) return;

    const remainingGroups = currentGroupIds.filter((groupId) => !normalizedToRemove.has(groupId));
    await updateFavoriteNodeMembership(node, remainingGroups, {
      preserveFavoriteWhenEmpty: true
    });
  };

  const clearNodeFavoriteState = async (node: AppNode) => {
    await updateFavoriteNodeMembership(node, [], {
      preserveFavoriteWhenEmpty: false
    });
  };

  const removeNodeFromQuickAccess = async (sourceNodeId: string) => {
    const nodes = resolveFavoriteActionNodes(sourceNodeId);
    for (const node of nodes) {
      if (!isNodeFavorite(node)) continue;
      await clearNodeFavoriteState(node);
    }
  };

  const toggleFavoriteNode = async (sourceNodeId: string) => {
    const nodes = resolveFavoriteActionNodes(sourceNodeId);
    if (nodes.length === 0) return;

    const selectionState = resolveFavoriteSelectionState({
      nodes,
      isFavoriteNode: (node) => isNodeFavorite(node)
    });

    if (selectionState === "all") {
      for (const node of nodes) {
        await clearNodeFavoriteState(node);
      }
      return;
    }

    for (const node of nodes) {
      if (isNodeFavorite(node)) continue;
      await updateFavoriteNodeMembership(node, [], {
        preserveFavoriteWhenEmpty: true
      });
    }
  };

  const toggleFavoriteGroupForSelection = async (sourceNodeId: string, groupId: string) => {
    if (!favoriteGroups.some((group) => group.id === groupId)) return;
    const nodes = resolveExplicitFavoriteActionNodes(sourceNodeId, selectionSurface);
    if (nodes.length === 0) return;

    const selectionState = resolveFavoriteGroupMembershipState({
      nodes,
      groupId,
      getNodeGroupIds: (node) => getNodeFavoriteGroupIds(node)
    });

    for (const node of nodes) {
      const currentGroupIds = getNodeFavoriteGroupIds(node);
      const nextGroupIds =
        selectionState === "all"
          ? currentGroupIds.filter((currentGroupId) => currentGroupId !== groupId)
          : Array.from(new Set([...currentGroupIds, groupId]));
      await updateFavoriteNodeMembership(node, nextGroupIds, {
        preserveFavoriteWhenEmpty: true
      });
    }
  };

  function resolveDeleteConfirmation(confirmed: boolean) {
    const resolver = deleteConfirmResolverRef.current;
    deleteConfirmResolverRef.current = null;
    setDeleteConfirmOpen(false);
    setDeleteConfirmMessage("");
    resolver?.(confirmed);
  }

  function requestDeleteConfirmation(message: string): Promise<boolean> {
    setDeleteConfirmMessage(message);
    setDeleteConfirmOpen(true);
    return new Promise<boolean>((resolve) => {
      deleteConfirmResolverRef.current = resolve;
    });
  }

  const deleteFavoriteGroup = async (groupId: string) => {
    const group = favoriteGroups.find((item) => item.id === groupId);
    if (!group) return;
    const confirmed = await requestDeleteConfirmation(
      t("favorites.group_delete_confirm", { name: group.name })
    );
    if (!confirmed) return;

    const nodesToUpdate = store.allNodes.filter((node) => {
      if (!isNodeFavorite(node)) return false;
      return getNodeFavoriteGroupIds(node).includes(groupId);
    });

    for (const node of nodesToUpdate) {
      const remainingGroups = getNodeFavoriteGroupIds(node).filter((id) => id !== groupId);
      await updateFavoriteNodeMembership(node, remainingGroups, {
        preserveFavoriteWhenEmpty: true
      });
    }

    const remainingGroups = favoriteGroups.filter((item) => item.id !== groupId);
    setFavoriteGroups(remainingGroups);
    const remainingSelectedGroupIds = selectedFavoriteGroupIds.filter((id) => id !== groupId);
    setSelectedFavoriteGroupIds(remainingSelectedGroupIds);
    if (activeFavoriteGroupId === groupId) {
      setActiveFavoriteGroupId(remainingSelectedGroupIds[0] ?? FAVORITE_ALL_GROUP_ID);
    }
    setFavoriteGroupTreeFilterEnabled(remainingSelectedGroupIds.length > 0);

    await refreshTreeAndKeepContext(store.selectedNodeId ?? undefined);
    setProjectNotice(t("favorites.group_deleted_notice", { name: group.name }));
  };

  const removeSelectedNodes = async (options?: {
    confirm?: boolean;
    sourceNodeId?: string | null;
    surface?: SelectionSurface;
  }) => {
    const targetSurface = options?.surface ?? selectionSurface;
    const rootDeleteIds = resolveSelectedActionNodeIds(
      options?.sourceNodeId,
      targetSurface,
      { filterDescendants: true }
    );
    if (rootDeleteIds.length === 0) return;
    if (!ensureStructureMutationAllowed(rootDeleteIds)) return;
    const workspaceRootDeleteIds = rootDeleteIds.filter((nodeId) => workspaceRootIdSet.has(nodeId));
    const nonWorkspaceDeleteIds = rootDeleteIds.filter((nodeId) => !workspaceRootIdSet.has(nodeId));

    const shouldConfirm = options?.confirm ?? true;
    if (shouldConfirm) {
      for (const workspaceRootId of workspaceRootDeleteIds) {
        const confirmedWorkspaceDelete = await requestDeleteConfirmation(
          t("project.delete_confirm", {
            name: nodeById.get(workspaceRootId)?.name ?? workspaceRootId
          })
        );
        if (!confirmedWorkspaceDelete) return;
      }

      if (nonWorkspaceDeleteIds.length > 0) {
        const confirmMessage =
          nonWorkspaceDeleteIds.length === 1
            ? t("delete.single", {
              name: nodeById.get(nonWorkspaceDeleteIds[0])?.name ?? t("delete.item")
            })
            : t("delete.multi", {
              count: nonWorkspaceDeleteIds.length
            });
        const confirmed = await requestDeleteConfirmation(confirmMessage);
        if (!confirmed) return;
      }
    }

    const visibleIds = resolveVisibleActionIdsForSurface({
      surface: targetSurface,
      treeRowIds: displayedTreeRows.map((row) => row.id),
      gridNodeIds: gridNodes.map((node) => node.id),
      timelineRowIds: timelineRows.map((row) => row.id)
    });
    const nextCandidateId = resolveNextVisibleActionSelectionId({
      removedIds: rootDeleteIds,
      visibleIds
    });
    const affectedWorkareaOwnerIds = Array.from(
      new Set(
        rootDeleteIds
          .map((nodeId) => nodeById.get(nodeId) ?? null)
          .map((node) => (node && isWorkareaItemNode(node) ? getWorkareaOwnerNodeId(node, nodeById) : null))
          .filter((ownerId): ownerId is string => Boolean(ownerId))
      )
    );
    const currentFolderSnapshot = currentFolderIdRef.current ?? null;
    const currentFolderWillBeRemoved =
      currentFolderSnapshot !== null &&
      rootDeleteIds.some((nodeId) => isNodeInSubtree(nodeId, currentFolderSnapshot));
    const currentFolderParentId =
      currentFolderSnapshot && currentFolderWillBeRemoved
        ? (() => {
            const folderNode = resolveCachedNodeById(currentFolderSnapshot);
            if (!folderNode) return activeProjectRootId ?? null;
            return folderNode.parentId && folderNode.parentId !== ROOT_PARENT_ID
              ? folderNode.parentId
              : activeProjectRootId ?? null;
          })()
        : currentFolderSnapshot;
    const restoreFolderId = await resolveExistingFolderRestoreId(
      currentFolderParentId,
      rootDeleteIds.map((nodeId) => nodeById.get(nodeId)?.parentId ?? null)
    );

    for (let index = 0; index < rootDeleteIds.length; index += 1) {
      const nodeId = rootDeleteIds[index];
      const shouldSyncProjection = index === rootDeleteIds.length - 1;
      await deleteNodeWithExecutionSync(nodeId, shouldSyncProjection);
    }
    for (const ownerNodeId of affectedWorkareaOwnerIds) {
      await syncWorkareaOwnerMeaningFromTree(ownerNodeId, {
        refreshAfterSync: false
      });
    }

    await refreshTreeAndKeepContext(undefined, [], targetSurface, restoreFolderId);

    if (nextCandidateId) {
      const stillExists = await getNode(nextCandidateId);
      if (stillExists) {
        setPrimarySelection(nextCandidateId, targetSurface);
        return;
      }
    }

    const currentChildren = await getChildren(restoreFolderId);
    const firstVisibleChild = currentChildren.find((node) => !isHiddenExecutionTaskNode(node)) ?? currentChildren[0] ?? null;
    const fallbackSelectionId =
      targetSurface === "timeline"
        ? (restoreFolderId ?? activeProjectRootId ?? firstVisibleChild?.id ?? null)
        : firstVisibleChild?.id ?? null;
    setPrimarySelection(fallbackSelectionId, targetSurface === "timeline" ? "timeline" : targetSurface);
  };


  const getDesktopWindow = (): TauriWindow | null => {
    if (!isTauri()) return null;
    return appWindowRef.current ?? appWindow ?? getCurrentWindow();
  };

  const getWindowsDesktopWindowLayoutState = async (): Promise<WindowsDesktopWindowLayoutState | null> => {
    if (!isTauri() || !isWindowsDesktopPlatform()) return null;
    try {
      return await callNative<WindowsDesktopWindowLayoutState>("get_windows_primary_window_layout_state");
    } catch {
      return null;
    }
  };

  const setWindowsDesktopWindowBounds = async (
    bounds: WindowsDesktopWindowBounds
  ): Promise<WindowsDesktopWindowLayoutState | null> => {
    if (!isTauri() || !isWindowsDesktopPlatform()) return null;
    try {
      return await callNative<WindowsDesktopWindowLayoutState>("set_windows_primary_window_bounds", { bounds });
    } catch {
      return null;
    }
  };

  const fitWindowsDesktopWindowToWorkArea = async (
    options?: WindowsDesktopWindowFitOptions
  ): Promise<WindowsDesktopWindowLayoutState | null> => {
    if (!isTauri() || !isWindowsDesktopPlatform()) return null;
    try {
      return await callNative<WindowsDesktopWindowLayoutState>("fit_windows_primary_window_to_work_area", { options });
    } catch {
      return null;
    }
  };

  const getWindowsDesktopPrimaryWindowFullscreenState = async (win?: TauriWindow | null): Promise<boolean> => {
    if (!isTauri() || !isWindowsDesktopPlatform()) return false;
    if (isUtilityPanelWindow || (win && win.label !== "main")) {
      return win?.isFullscreen().catch(() => false) ?? false;
    }
    try {
      return await callNative<boolean>("is_windows_primary_window_fullscreen");
    } catch {
      return false;
    }
  };

  const setWindowsDesktopPrimaryWindowFullscreen = async (
    fullscreen: boolean,
    win?: TauriWindow | null
  ): Promise<boolean> => {
    if (!isTauri() || !isWindowsDesktopPlatform()) return false;
    if (isUtilityPanelWindow || (win && win.label !== "main")) {
      try {
        await win?.setFullscreen(fullscreen);
        return true;
      } catch {
        return false;
      }
    }
    try {
      await callNative<void>("set_windows_primary_window_fullscreen", { fullscreen });
      return true;
    } catch {
      return false;
    }
  };

  const minimizeWindowsDesktopPrimaryWindow = async (win: TauriWindow): Promise<boolean> => {
    if (!isTauri() || !isWindowsDesktopPlatform() || win.label !== "main") return false;
    try {
      await callNative<void>("minimize_windows_primary_window");
      return true;
    } catch {
      return false;
    }
  };

  const closeWindowsDesktopPrimaryWindow = async (win: TauriWindow): Promise<boolean> => {
    if (!isTauri() || !isWindowsDesktopPlatform() || win.label !== "main") return false;
    try {
      await callNative<void>("close_windows_primary_window");
      return true;
    } catch {
      return false;
    }
  };

  const resolveWindowsDesktopTargetBounds = (
    areaBounds: WindowsDesktopWindowBounds,
    options?: WindowsDesktopWindowFitOptions
  ): WindowsDesktopWindowBounds => {
    const margin = Math.max(0, options?.margin ?? DESKTOP_WINDOW_WORKAREA_MARGIN_PX);
    const width = Math.max(1, areaBounds.width - margin * 2);
    const height = Math.max(1, areaBounds.height - margin * 2);
    return {
      x: areaBounds.x + margin,
      y: areaBounds.y + margin,
      width,
      height
    };
  };

  const resolveDesktopWindowWorkAreaFit = async (
    win: TauriWindow,
    options?: { preferCenter?: boolean; fillWorkArea?: boolean; coverTaskbar?: boolean; margin?: number }
  ): Promise<DesktopWindowWorkAreaFit | null> => {
    if (!isTauri()) return null;

    const [monitor, outerSize, outerPosition, innerSize] = await Promise.all([
      currentMonitor(),
      win.outerSize(),
      win.outerPosition(),
      win.innerSize()
    ]);
    if (!monitor) return null;

    const margin = Math.max(0, options?.margin ?? DESKTOP_WINDOW_WORKAREA_MARGIN_PX);
    const targetArea = options?.coverTaskbar
      ? { position: monitor.position, size: monitor.size }
      : monitor.workArea;
    const workLeft = targetArea.position.x;
    const workTop = targetArea.position.y;
    const workWidth = targetArea.size.width;
    const workHeight = targetArea.size.height;
    const workRight = workLeft + workWidth;
    const workBottom = workTop + workHeight;
    const frameWidth = Math.max(0, outerSize.width - innerSize.width);
    const frameHeight = Math.max(0, outerSize.height - innerSize.height);
    const maxOuterWidth = Math.max(320, workWidth - margin * 2);
    const maxOuterHeight = Math.max(320, workHeight - margin * 2);
    const maxInnerWidth = Math.max(320, maxOuterWidth - frameWidth);
    const maxInnerHeight = Math.max(320, maxOuterHeight - frameHeight);
    const targetInnerWidth = options?.fillWorkArea ? maxInnerWidth : Math.min(innerSize.width, maxInnerWidth);
    const targetInnerHeight = options?.fillWorkArea ? maxInnerHeight : Math.min(innerSize.height, maxInnerHeight);
    const targetOuterWidth = targetInnerWidth + frameWidth;
    const targetOuterHeight = targetInnerHeight + frameHeight;

    let targetX = outerPosition.x;
    let targetY = outerPosition.y;

    if (options?.fillWorkArea) {
      targetX = workLeft + margin;
      targetY = workTop + margin;
    } else if (options?.preferCenter) {
      targetX = workLeft + Math.round((workWidth - targetOuterWidth) / 2);
      targetY = workTop + Math.round((workHeight - targetOuterHeight) / 2);
    }

    const minX = workLeft + margin;
    const minY = workTop + margin;
    const maxX = Math.max(minX, workRight - margin - targetOuterWidth);
    const maxY = Math.max(minY, workBottom - margin - targetOuterHeight);
    targetX = Math.min(Math.max(targetX, minX), maxX);
    targetY = Math.min(Math.max(targetY, minY), maxY);

    return {
      currentInnerWidth: innerSize.width,
      currentInnerHeight: innerSize.height,
      currentOuterWidth: outerSize.width,
      currentOuterHeight: outerSize.height,
      currentX: outerPosition.x,
      currentY: outerPosition.y,
      targetInnerWidth,
      targetInnerHeight,
      targetOuterWidth,
      targetOuterHeight,
      targetX,
      targetY
    };
  };

  const isDesktopWindowEffectivelyMaximized = async (win: TauriWindow): Promise<boolean> => {
    if (!isTauri()) return false;

    const fullscreen = await getWindowsDesktopPrimaryWindowFullscreenState(win);
    if (fullscreen) return true;

    const nativeMaximized = await win.isMaximized().catch(() => false);
    if (nativeMaximized) return true;

    const windowsLayoutState = await getWindowsDesktopWindowLayoutState();
    if (windowsLayoutState) {
      const targetBounds = resolveWindowsDesktopTargetBounds(windowsLayoutState.monitorBounds, {
        fillWorkArea: true,
        coverTaskbar: true,
        margin: DESKTOP_WINDOW_MAXIMIZE_MARGIN_PX
      });
      return (
        Math.abs(windowsLayoutState.currentBounds.width - targetBounds.width) <= DESKTOP_WINDOW_MAXIMIZED_TOLERANCE_PX &&
        Math.abs(windowsLayoutState.currentBounds.height - targetBounds.height) <= DESKTOP_WINDOW_MAXIMIZED_TOLERANCE_PX &&
        Math.abs(windowsLayoutState.currentBounds.x - targetBounds.x) <= DESKTOP_WINDOW_MAXIMIZED_TOLERANCE_PX &&
        Math.abs(windowsLayoutState.currentBounds.y - targetBounds.y) <= DESKTOP_WINDOW_MAXIMIZED_TOLERANCE_PX
      );
    }

    const fit = await resolveDesktopWindowWorkAreaFit(win, {
      fillWorkArea: true,
      coverTaskbar: true,
      margin: DESKTOP_WINDOW_MAXIMIZE_MARGIN_PX
    });
    if (!fit) return false;

    return (
      Math.abs(fit.currentOuterWidth - fit.targetOuterWidth) <= DESKTOP_WINDOW_MAXIMIZED_TOLERANCE_PX &&
      Math.abs(fit.currentOuterHeight - fit.targetOuterHeight) <= DESKTOP_WINDOW_MAXIMIZED_TOLERANCE_PX &&
      Math.abs(fit.currentX - fit.targetX) <= DESKTOP_WINDOW_MAXIMIZED_TOLERANCE_PX &&
      Math.abs(fit.currentY - fit.targetY) <= DESKTOP_WINDOW_MAXIMIZED_TOLERANCE_PX
    );
  };

  const captureDesktopWindowRestoreBounds = async (
    win: TauriWindow
  ): Promise<DesktopWindowRestoreBounds> => {
    const windowsLayoutState = await getWindowsDesktopWindowLayoutState();
    if (windowsLayoutState) {
      return {
        width: windowsLayoutState.currentBounds.width,
        height: windowsLayoutState.currentBounds.height,
        x: windowsLayoutState.currentBounds.x,
        y: windowsLayoutState.currentBounds.y,
        useNativeOuterBounds: true
      };
    }

    const [innerSize, outerPosition] = await Promise.all([win.innerSize(), win.outerPosition()]);
    return {
      width: innerSize.width,
      height: innerSize.height,
      x: outerPosition.x,
      y: outerPosition.y
    };
  };

  const restoreDesktopWindowBounds = async (
    win: TauriWindow,
    bounds: DesktopWindowRestoreBounds
  ) => {
    if (bounds.useNativeOuterBounds) {
      const restored = await setWindowsDesktopWindowBounds({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      });
      if (restored) return;
    }

    await win.setSize(new PhysicalSize(bounds.width, bounds.height));
    await waitForMs(16);
    await win.setPosition(new PhysicalPosition(bounds.x, bounds.y));
  };

  const fitDesktopWindowToWorkArea = async (options?: {
    preferCenter?: boolean;
    fillWorkArea?: boolean;
    coverTaskbar?: boolean;
    margin?: number;
  }) => {
    const win = getDesktopWindow();
    if (!win || !isTauri()) return false;

    try {
      const nativeFit = await fitWindowsDesktopWindowToWorkArea(options);
      if (nativeFit) {
        return true;
      }

      if (!options?.fillWorkArea) {
        const nativeMaximized = await win.isMaximized().catch(() => false);
        if (nativeMaximized) return false;
      }

      const fit = await resolveDesktopWindowWorkAreaFit(win, options);
      if (!fit) return false;

      const sizeChanged =
        fit.targetInnerWidth !== fit.currentInnerWidth || fit.targetInnerHeight !== fit.currentInnerHeight;
      const positionChanged = fit.targetX !== fit.currentX || fit.targetY !== fit.currentY;
      if (!sizeChanged && !positionChanged) return true;

      if (sizeChanged) {
        await win.setSize(new PhysicalSize(fit.targetInnerWidth, fit.targetInnerHeight));
      }
      if (
        sizeChanged ||
        positionChanged ||
        options?.preferCenter ||
        options?.fillWorkArea
      ) {
        await win.setPosition(new PhysicalPosition(fit.targetX, fit.targetY));
      }
      return true;
    } catch {
      // Window work-area fitting is best-effort only.
      return false;
    }
  };

  const setDesktopWindowFullscreen = async (win: TauriWindow, fullscreen: boolean) => {
    if (!isWindowsDesktopPlatform() || isUtilityPanelWindow || win.label !== "main") {
      return false;
    }

    return setWindowsDesktopPrimaryWindowFullscreen(fullscreen, win);
  };

  const clearDesktopWindowHeaderDragSession = () => {
    if (desktopWindowHeaderDragFrameRef.current !== null) {
      window.cancelAnimationFrame(desktopWindowHeaderDragFrameRef.current);
      desktopWindowHeaderDragFrameRef.current = null;
    }
    desktopWindowHeaderDragRef.current = null;
  };

  const clampDesktopWindowBoundsToWorkArea = (
    x: number,
    y: number,
    width: number,
    height: number,
    workAreaBounds: WindowsDesktopWindowBounds | null
  ) => {
    if (!workAreaBounds) return { x, y };
    const minX = workAreaBounds.x;
    const minY = workAreaBounds.y;
    const maxX = Math.max(minX, workAreaBounds.x + workAreaBounds.width - width);
    const maxY = Math.max(minY, workAreaBounds.y + workAreaBounds.height - height);
    return {
      x: Math.min(Math.max(x, minX), maxX),
      y: Math.min(Math.max(y, minY), maxY)
    };
  };

  const resolveDesktopWindowHeaderDragRestoreBounds = (
    workAreaBounds: WindowsDesktopWindowBounds | null,
    restoreBounds: DesktopWindowRestoreBounds | null
  ): DesktopWindowRestoreBounds => {
    if (restoreBounds) {
      return {
        ...restoreBounds,
        useNativeOuterBounds: workAreaBounds ? true : restoreBounds.useNativeOuterBounds
      };
    }

    if (workAreaBounds) {
      const width = Math.max(
        DESKTOP_WINDOW_HEADER_DRAG_MIN_WIDTH_PX,
        Math.min(
          DESKTOP_WINDOW_HEADER_DRAG_DEFAULT_WIDTH_PX,
          Math.max(DESKTOP_WINDOW_HEADER_DRAG_MIN_WIDTH_PX, workAreaBounds.width - 48)
        )
      );
      const height = Math.max(
        DESKTOP_WINDOW_HEADER_DRAG_MIN_HEIGHT_PX,
        Math.min(
          DESKTOP_WINDOW_HEADER_DRAG_DEFAULT_HEIGHT_PX,
          Math.max(DESKTOP_WINDOW_HEADER_DRAG_MIN_HEIGHT_PX, workAreaBounds.height - 48)
        )
      );
      return {
        width,
        height,
        x: workAreaBounds.x + Math.round((workAreaBounds.width - width) / 2),
        y: workAreaBounds.y + Math.max(24, Math.round((workAreaBounds.height - height) / 8)),
        useNativeOuterBounds: true
      };
    }

    return {
      width: DESKTOP_WINDOW_HEADER_DRAG_DEFAULT_WIDTH_PX,
      height: DESKTOP_WINDOW_HEADER_DRAG_DEFAULT_HEIGHT_PX,
      x: 120,
      y: 120
    };
  };

  const applyDesktopWindowHeaderManualMove = async (
    win: TauriWindow,
    session: DesktopWindowHeaderDragSession
  ) => {
    const nextX = Math.round(session.latestScreenX - session.moveOffsetX);
    const nextY = Math.round(session.latestScreenY - session.moveOffsetY);
    const clamped = clampDesktopWindowBoundsToWorkArea(
      nextX,
      nextY,
      session.outerWidth,
      session.outerHeight,
      session.workAreaBounds
    );
    if (isWindowsDesktopPlatform()) {
      const updatedLayout = await setWindowsDesktopWindowBounds({
        x: clamped.x,
        y: clamped.y,
        width: session.outerWidth,
        height: session.outerHeight
      });
      if (updatedLayout) {
        session.workAreaBounds = updatedLayout.workAreaBounds;
        session.outerWidth = updatedLayout.currentBounds.width;
        session.outerHeight = updatedLayout.currentBounds.height;
        return;
      }
    }
    await win.setPosition(new PhysicalPosition(clamped.x, clamped.y));
  };

  const beginDesktopWindowHeaderManualMove = async (
    win: TauriWindow,
    event: ReactMouseEvent<HTMLElement>
  ) => {
    const startScreenX = toDesktopScreenPixels(event.screenX);
    const startScreenY = toDesktopScreenPixels(event.screenY);
    const knownBounds = desktopWindowRestoreBoundsRef.current;

    if (knownBounds) {
      clearDesktopWindowHeaderDragSession();
      desktopWindowHeaderDragRef.current = {
        phase: "manual_move",
        startScreenX,
        startScreenY,
        latestScreenX: startScreenX,
        latestScreenY: startScreenY,
        headerOffsetY: Math.max(12, Math.min(42, toDesktopScreenPixels(event.clientY))),
        pointerRatioX: 0.5,
        workAreaBounds: null,
        outerWidth: knownBounds.width,
        outerHeight: knownBounds.height,
        moveOffsetX: startScreenX - knownBounds.x,
        moveOffsetY: startScreenY - knownBounds.y,
        restoring: false
      };
      void applyDesktopWindowHeaderManualMove(win, desktopWindowHeaderDragRef.current);
    }

    const windowsLayoutState = await getWindowsDesktopWindowLayoutState();
    const resolvedBounds =
      windowsLayoutState?.currentBounds ??
      knownBounds ??
      (await captureDesktopWindowRestoreBounds(win));

    clearDesktopWindowHeaderDragSession();
    desktopWindowHeaderDragRef.current = {
      phase: "manual_move",
      startScreenX,
      startScreenY,
      latestScreenX: startScreenX,
      latestScreenY: startScreenY,
      headerOffsetY: Math.max(12, Math.min(42, toDesktopScreenPixels(event.clientY))),
      pointerRatioX: 0.5,
      workAreaBounds: windowsLayoutState?.workAreaBounds ?? null,
      outerWidth: resolvedBounds.width,
      outerHeight: resolvedBounds.height,
      moveOffsetX: startScreenX - resolvedBounds.x,
      moveOffsetY: startScreenY - resolvedBounds.y,
      restoring: false
    };
    void applyDesktopWindowHeaderManualMove(win, desktopWindowHeaderDragRef.current);
  };

  const startDesktopWindowHeaderNativeDrag = (win: TauriWindow) => {
    // Keep the native drag call on the original mouse-down gesture so restored windows
    // move immediately instead of losing the drag after async state checks.
    void win.startDragging().catch(() => {
      // Ignore fallback drag failures for custom title bars.
    });
  };

  const handleDesktopWindowHeaderDragStart = async (event: ReactMouseEvent<HTMLElement>) => {
    const win = getDesktopWindow();
    if (!win || !isDesktopRuntime) return;

    if (isWindowsDesktopPlatform() && !isWindowMaximized) {
      await beginDesktopWindowHeaderManualMove(win, event);
      return;
    }

    if (!isWindowMaximized) {
      startDesktopWindowHeaderNativeDrag(win);
      return;
    }

    try {
      const [nativeMaximized, effectiveMaximized] = await Promise.all([
        win.isMaximized().catch(() => false),
        isDesktopWindowEffectivelyMaximized(win)
      ]);

      if (!nativeMaximized && !effectiveMaximized) {
        startDesktopWindowHeaderNativeDrag(win);
        return;
      }

      if (!isWindowsDesktopPlatform()) {
        await handleWindowToggleMaximize();
        desktopWindowRestoreBoundsRef.current = await captureDesktopWindowRestoreBounds(win);
        await win.startDragging();
        return;
      }

      clearDesktopWindowHeaderDragSession();
      desktopWindowHeaderDragRef.current = {
        phase: "pending_restore",
        startScreenX: toDesktopScreenPixels(event.screenX),
        startScreenY: toDesktopScreenPixels(event.screenY),
        latestScreenX: toDesktopScreenPixels(event.screenX),
        latestScreenY: toDesktopScreenPixels(event.screenY),
        headerOffsetY: Math.max(12, Math.min(42, toDesktopScreenPixels(event.clientY))),
        pointerRatioX: 0.5,
        workAreaBounds: null,
        outerWidth: 0,
        outerHeight: 0,
        moveOffsetX: 0,
        moveOffsetY: 0,
        restoring: false
      };
    } catch {
      await win.startDragging().catch(() => {
        // Ignore fallback drag failures for custom title bars.
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const session = desktopWindowHeaderDragRef.current;
      if (!session) return;

      session.latestScreenX = toDesktopScreenPixels(event.screenX);
      session.latestScreenY = toDesktopScreenPixels(event.screenY);

      if (session.phase === "manual_move") {
        if (desktopWindowHeaderDragFrameRef.current !== null) return;
        desktopWindowHeaderDragFrameRef.current = window.requestAnimationFrame(() => {
          desktopWindowHeaderDragFrameRef.current = null;
          const activeSession = desktopWindowHeaderDragRef.current;
          const win = getDesktopWindow();
          if (!activeSession || activeSession.phase !== "manual_move" || !win) return;
          void applyDesktopWindowHeaderManualMove(win, activeSession);
        });
        return;
      }

      const deltaX = Math.abs(session.latestScreenX - session.startScreenX);
      const deltaY = Math.abs(session.latestScreenY - session.startScreenY);
      if (Math.max(deltaX, deltaY) < DESKTOP_WINDOW_HEADER_DRAG_THRESHOLD_PX || session.restoring) {
        return;
      }

      session.restoring = true;
      void (async () => {
        const win = getDesktopWindow();
        if (!win) {
          clearDesktopWindowHeaderDragSession();
          return;
        }

        const windowsLayoutState = await getWindowsDesktopWindowLayoutState();
        const activeSession = desktopWindowHeaderDragRef.current;
        if (!activeSession) return;

        const currentBounds = windowsLayoutState?.currentBounds ?? null;
        const workAreaBounds = windowsLayoutState?.workAreaBounds ?? null;
        const restoreBounds = resolveDesktopWindowHeaderDragRestoreBounds(
          workAreaBounds,
          desktopWindowRestoreBoundsRef.current
        );
        const pointerRatioX =
          currentBounds && currentBounds.width > 0
            ? (activeSession.startScreenX - currentBounds.x) / currentBounds.width
            : 0.5;
        const clampedRatioX = Math.min(0.88, Math.max(0.12, pointerRatioX));
        const nextX = Math.round(activeSession.latestScreenX - restoreBounds.width * clampedRatioX);
        const nextY = Math.round(activeSession.latestScreenY - activeSession.headerOffsetY);
        const clampedBounds = clampDesktopWindowBoundsToWorkArea(
          nextX,
          nextY,
          restoreBounds.width,
          restoreBounds.height,
          workAreaBounds
        );

        if (await getWindowsDesktopPrimaryWindowFullscreenState(win)) {
          await setDesktopWindowFullscreen(win, false);
          await waitForMs(80);
        }

        if (await win.isMaximized().catch(() => false)) {
          await win.unmaximize().catch(() => {
            // Ignore unmaximize failures; custom restore below still attempts to recover.
          });
          await waitForMs(80);
        }

        await restoreDesktopWindowBounds(win, {
          ...restoreBounds,
          x: clampedBounds.x,
          y: clampedBounds.y
        });
        setIsWindowMaximized(false);

        const updatedSession = desktopWindowHeaderDragRef.current;
        if (!updatedSession) return;
        updatedSession.pointerRatioX = clampedRatioX;
        updatedSession.workAreaBounds = workAreaBounds;
        updatedSession.outerWidth = restoreBounds.width;
        updatedSession.outerHeight = restoreBounds.height;
        updatedSession.moveOffsetX = updatedSession.latestScreenX - clampedBounds.x;
        updatedSession.moveOffsetY = updatedSession.latestScreenY - clampedBounds.y;

        try {
          clearDesktopWindowHeaderDragSession();
          desktopWindowRestoreBoundsRef.current = {
            ...restoreBounds,
            x: clampedBounds.x,
            y: clampedBounds.y
          };
          await win.startDragging();
        } catch {
          const fallbackSession = desktopWindowHeaderDragRef.current ?? updatedSession;
          desktopWindowHeaderDragRef.current = {
            ...fallbackSession,
            phase: "manual_move",
            restoring: false
          };
          void applyDesktopWindowHeaderManualMove(win, desktopWindowHeaderDragRef.current);
        }
      })();
    };

    const handleMouseUp = () => {
      clearDesktopWindowHeaderDragSession();
    };

    const handleWindowBlur = () => {
      clearDesktopWindowHeaderDragSession();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      clearDesktopWindowHeaderDragSession();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [isDesktopRuntime]);

  const openTextEditContextMenu = async (
    event: ReactMouseEvent<HTMLInputElement | HTMLTextAreaElement>,
    surface: SelectionSurface
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu(null);

    const input = event.currentTarget;
    inlineEditInputRef.current = input;
    input.focus();

    const selectionStart = input.selectionStart ?? editingValue.length;
    const selectionEnd = input.selectionEnd ?? selectionStart;
    const spellTarget = resolveInlineEditSpellTarget(editingValue, selectionStart, selectionEnd);

    const nextMenu: TextEditContextMenuState = {
      x: event.clientX,
      y: event.clientY,
      word: spellTarget?.word ?? null,
      suggestions: [],
      loading: Boolean(spellTarget),
      selectionStart,
      selectionEnd
    };
    setTextEditContextMenu(nextMenu);
    setSelectionSurface(surface);

    if (!spellTarget) return;

    const suggestions = await getSpellSuggestions(spellTarget.word, language);
    setTextEditContextMenu((current) => {
      if (!current) return current;
      if (
        current.word !== spellTarget.word ||
        current.selectionStart !== selectionStart ||
        current.selectionEnd !== selectionEnd
      ) {
        return current;
      }
      return {
        ...current,
        suggestions,
        loading: false
      };
    });
  };

  const beginInlineEdit = (nodeId: string, initialText?: string, preferredSurface?: SelectionSurface) => {
    const node = store.allNodes.find((item) => item.id === nodeId);
    if (!node) return;
    if (!ensureStructureMutationAllowed([nodeId])) return;
    const nextValue = initialText ?? node.name;
    primeInlineEditState(nodeId, nextValue, preferredSurface, {
      selectAll: initialText === undefined
    });
  };

  const registerProvisionalInlineCreate = (
    nodeId: string,
    state: ProvisionalInlineCreateState
  ) => {
    provisionalInlineCreateByNodeIdRef.current = setProvisionalInlineCreateState(
      provisionalInlineCreateByNodeIdRef.current,
      nodeId,
      state
    );
  };

  const clearProvisionalInlineCreate = (nodeId: string) => {
    provisionalInlineCreateByNodeIdRef.current = removeProvisionalInlineCreateState(
      provisionalInlineCreateByNodeIdRef.current,
      nodeId
    );
  };

  const clearInlineEditState = () => {
    closeTextEditContextMenu();
    pendingInlineEditSelectionRef.current = null;
    setEditingNodeId(null);
    setEditingSurface(null);
    setEditingValue("");
  };

  const resolveInlineEditSurface = (surface?: SelectionSurface | null): SelectionSurface =>
    resolveInlineEditSurfaceState({
      surface,
      workspaceMode: workspaceModeRef.current,
      selectionSurface: selectionSurfaceRef.current
    });

  const discardProvisionalInlineCreate = async (
    nodeId: string,
    provisional: ProvisionalInlineCreateState,
    surface: SelectionSurface
  ) => {
    const node = store.allNodes.find((item) => item.id === nodeId) ?? (await getNode(nodeId)) ?? null;
    clearProvisionalInlineCreate(nodeId);
    if (!node) {
      await refreshTreeAndKeepContext(
        provisional.fallbackSelectionId ?? undefined,
        provisional.expandNodeIds,
        provisional.surface
      );
      return;
    }

    await deleteNodeWithExecutionSync(nodeId);
    const fallbackSelectionId = resolveInlineEditFallbackSelectionId(provisional, node, activeProjectRootId);
    await refreshTreeAndKeepContext(
      fallbackSelectionId ?? undefined,
      provisional.expandNodeIds,
      provisional.surface
    );
    setPrimarySelection(fallbackSelectionId, surface);
  };

  const primeInlineEditState = (
    nodeId: string,
    nextValue: string,
    preferredSurface?: SelectionSurface,
    options?: { selectAll?: boolean }
  ) => {
    const editSurface = resolveInlineEditSurfaceState({
      surface: preferredSurface,
      workspaceMode,
      selectionSurface
    });
    setPrimarySelection(nodeId, editSurface);
    closeTextEditContextMenu();
    setEditingNodeId(nodeId);
    setEditingSurface(editSurface);
    setEditingValue(nextValue);
    pendingInlineEditSelectionRef.current = options?.selectAll
      ? {
          nodeId,
          surface: editSurface,
          start: 0,
          end: nextValue.length
        }
      : null;
  };

  const cancelInlineEdit = () => {
    const nodeId = editingNodeIdRef.current;
    const editSurface = resolveInlineEditSurface(editingSurfaceRef.current);
    const provisional = nodeId ? provisionalInlineCreateByNodeIdRef.current.get(nodeId) ?? null : null;
    if (!nodeId || !provisional) {
      clearInlineEditState();
      return;
    }
    void (async () => {
      try {
        await discardProvisionalInlineCreate(nodeId, provisional, editSurface);
      } catch (error) {
        setProjectError(error instanceof Error ? error.message : String(error));
      } finally {
        clearInlineEditState();
      }
    })();
  };

  const refreshTreeAndKeepContext = async (
    nextSelectedNodeId?: string,
    expandNodeIds: string[] = [],
    preferredSurface?: SelectionSurface,
    nextFolderId?: string | null
  ) => {
    const currentFolderSnapshot = nextFolderId === undefined ? currentFolderIdRef.current : nextFolderId;
    const restoreFolderId = await resolveExistingFolderRestoreId(currentFolderSnapshot, [nextSelectedNodeId ?? null]);
    currentFolderIdRef.current = restoreFolderId;
    await store.refreshTree();
    await store.navigateTo(restoreFolderId);
    if (expandNodeIds.length > 0) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        for (const nodeId of expandNodeIds) {
          if (nodeId && nodeId !== ROOT_PARENT_ID) next.add(nodeId);
        }
        return next;
      });
    }
    if (nextSelectedNodeId) {
      const focusSurface: SelectionSurface =
        preferredSurface ??
        (workspaceMode === "timeline" ? "timeline" : selectionSurface === "grid" ? "grid" : "tree");
      setPrimarySelection(nextSelectedNodeId, focusSurface);
    }
  };

  const commitInlineEdit = async (): Promise<string | null> => {
    if (!editingNodeId) return null;
    const nodeId = editingNodeId;
    const node = store.allNodes.find((item) => item.id === nodeId);
    const nextName = editingValue.trim();
    const provisional = provisionalInlineCreateByNodeIdRef.current.get(nodeId) ?? null;
    const editSurface = resolveInlineEditSurfaceState({
      surface: editingSurface,
      workspaceMode,
      selectionSurface
    });

    if (!node) {
      clearProvisionalInlineCreate(nodeId);
      clearInlineEditState();
      return nodeId;
    }
    if (nextName.length === 0) {
      if (provisional) {
        try {
          await discardProvisionalInlineCreate(nodeId, provisional, editSurface);
        } finally {
          clearInlineEditState();
        }
      } else {
        clearInlineEditState();
      }
      return nodeId;
    }
    if (!provisional && nextName === node.name) {
      clearInlineEditState();
      return nodeId;
    }
    if (provisional && nextName === node.name) {
      clearProvisionalInlineCreate(nodeId);
      clearInlineEditState();
      return nodeId;
    }
    if (!ensureStructureMutationAllowed([nodeId])) {
      clearProvisionalInlineCreate(nodeId);
      clearInlineEditState();
      return nodeId;
    }

    closeTextEditContextMenu();
    if (nextName !== editingValue) {
      setEditingValue(nextName);
    }

    try {
      if (isHiddenExecutionTaskNode(node)) {
        const handled = await renameExecutionTaskProjection(nodeId, nextName, editSurface);
        if (!handled) {
          await renameNode(nodeId, nextName);
          await refreshTreeAndKeepContext(nodeId, [], editSurface);
        }
      } else {
        await renameNode(nodeId, nextName);
        await refreshTreeAndKeepContext(nodeId, [], editSurface);
      }
    } finally {
      clearProvisionalInlineCreate(nodeId);
      setEditingNodeId((current) => (current === nodeId ? null : current));
      setEditingSurface((current) => (current === editSurface ? null : current));
      setEditingValue("");
    }
    return nodeId;
  };

  const saveProcedureNodeContent = useCallback(
    async (nodeId: string, text: string) => {
      const normalizedText = text.replace(/\r\n/g, "\n");
      await updateNodeContent(nodeId, normalizedText);
      store.patchNode(nodeId, {
        content: normalizedText,
        updatedAt: Date.now()
      });
    },
    [store]
  );

  const saveProcedureNodeDescription = useCallback(
    async (nodeId: string, description: string | null) => {
      await updateNodeDescription(nodeId, description);
      store.patchNode(nodeId, {
        description,
        updatedAt: Date.now()
      });
    },
    [store]
  );
  const saveProcedureNodeProperties = useCallback(
    async (nodeId: string, properties: Record<string, unknown>) => {
      await updateNodeProperties(nodeId, properties);
      store.patchNode(nodeId, {
        properties,
        updatedAt: Date.now()
      });
    },
    [store]
  );
  const saveTooltipEditorDescription = useCallback(async () => {
    if (!tooltipEditorNodeId) return;
    const normalizedValue = tooltipEditorValue.replace(/\r\n/g, "\n");
    const nextDescription = normalizedValue.trim().length > 0 ? normalizedValue.trim() : null;
    setTooltipEditorSaving(true);
    try {
      await saveProcedureNodeDescription(tooltipEditorNodeId, nextDescription);
      setTooltipEditorNodeId(null);
      setTooltipEditorValue("");
    } finally {
      setTooltipEditorSaving(false);
    }
  }, [saveProcedureNodeDescription, tooltipEditorNodeId, tooltipEditorValue]);

  const addQuickAppDraftItem = useCallback(() => {
    setQuickAppsDraftItems((current) => [...current, createNodeQuickAppItem()]);
  }, []);

  const updateQuickAppDraftItem = useCallback((itemId: string, patch: Partial<NodeQuickAppItem>) => {
    setQuickAppsDraftItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              ...patch
            }
          : item
      )
    );
  }, []);

  const moveQuickAppDraftItem = useCallback((itemId: string, direction: "up" | "down") => {
    setQuickAppsDraftItems((current) => {
      const itemIndex = current.findIndex((item) => item.id === itemId);
      if (itemIndex < 0) return current;

      const targetIndex = direction === "up" ? itemIndex - 1 : itemIndex + 1;
      if (targetIndex < 0 || targetIndex >= current.length) return current;

      const nextItems = [...current];
      const [movedItem] = nextItems.splice(itemIndex, 1);
      nextItems.splice(targetIndex, 0, movedItem);
      return nextItems;
    });
  }, []);

  const removeQuickAppDraftItem = useCallback((itemId: string) => {
    setQuickAppsDraftItems((current) => current.filter((item) => item.id !== itemId));
  }, []);

  const saveQuickAppsModal = useCallback(async () => {
    if (!quickAppsModalNodeId) return;
    const node = nodeById.get(quickAppsModalNodeId) ?? null;
    if (!node) return;

    const nextQuickApps = normalizeNodeQuickApps(quickAppsDraftItems);
    const nextProperties = buildNodeQuickAppsProperties(node.properties, nextQuickApps);
    const localAutoQuickApps = nextQuickApps.filter(
      (item) => item.kind === "local_path" && item.iconKey === "auto" && !item.customIconDataUrl
    );
    setQuickAppsSaving(true);
    try {
      await updateNodeProperties(node.id, nextProperties);
      store.patchNode(node.id, {
        properties: nextProperties,
        updatedAt: Date.now()
      });

      if (localAutoQuickApps.length > 0) {
        const uniqueIconRequests = new Map<string, { target: string; fileName: string }>();
        for (const item of localAutoQuickApps) {
          const fileName = getQuickAppTargetLeafName(item.target) || item.label || "app";
          const cacheKey = buildWindowsFileIconCacheKey(item.target, fileName, 32);
          if (!uniqueIconRequests.has(cacheKey)) {
            uniqueIconRequests.set(cacheKey, {
              target: item.target,
              fileName
            });
          }
        }

        await Promise.allSettled(
          Array.from(uniqueIconRequests.values()).map(({ target, fileName }) =>
            resolveWindowsFileIcon(target, fileName, 32)
          )
        );
      }

      setQuickAppsModalNodeId(null);
      setQuickAppsDraftItems([]);
    } finally {
      setQuickAppsSaving(false);
    }
  }, [nodeById, quickAppsDraftItems, quickAppsModalNodeId, store]);

  const launchQuickApp = useCallback(
    async (item: NodeQuickAppItem) => {
      const target = resolveQuickAppLaunchTarget(item);
      if (!target) {
        setProjectError(t("quick_apps.target_required"));
        return;
      }

      try {
        if (item.kind === "local_path") {
          await openLocalPath(target);
        } else {
          await openExternalUrl(target);
        }
      } catch (error) {
        setProjectError(
          t("quick_apps.launch_failed", {
            name: item.label || target,
            reason: error instanceof Error ? error.message : String(error)
          })
        );
      }
    },
    [t]
  );

  const syncExecutionTaskDeletionToOwner = useCallback(
    async (deletedNode: AppNode | null) => {
      const meta = getExecutionTaskMeta(deletedNode);
      if (!meta) return;
      const ownerNode = nodeById.get(meta.ownerNodeId) ?? null;
      if (!ownerNode) return;
      const rawDeliverables = ownerNode.properties?.odeStructuredDeliverables;
      if (!Array.isArray(rawDeliverables)) return;

      let changed = false;
      const nextDeliverables = rawDeliverables
        .map((rawDeliverable, index) => {
          const record =
            rawDeliverable && typeof rawDeliverable === "object"
              ? (rawDeliverable as Record<string, unknown>)
              : null;
          const normalized = {
            id:
              typeof record?.id === "string" && record.id.trim().length > 0
                ? record.id.trim()
                : `ode-deliverable-${ownerNode.id}-${index}`,
            title: typeof record?.title === "string" ? record.title.trim() : "",
            tasks: normalizeExecutionTaskItems(record?.tasks),
            notifications: Array.isArray(record?.notifications)
              ? record.notifications
                  .map((item) => (typeof item === "string" ? item.trim() : ""))
                  .filter((item) => item.length > 0)
              : [],
            data: Array.isArray(record?.data)
              ? record.data
                  .map((item) => (typeof item === "string" ? item.trim() : ""))
                  .filter((item) => item.length > 0)
              : []
          };
          if (normalized.id !== meta.deliverableId) {
            return normalized;
          }
          const filteredTasks = normalized.tasks.filter((task) => task.id !== meta.taskId);
          if (filteredTasks.length !== normalized.tasks.length) {
            changed = true;
            return {
              ...normalized,
              tasks: filteredTasks
            };
          }
          return normalized;
        })
        .filter((deliverable) => deliverable.title.length > 0);

      if (!changed) return;

      const nextProperties: Record<string, unknown> = {
        ...(ownerNode.properties ?? {}),
        odeExpectedDeliverables: nextDeliverables.map((deliverable) => deliverable.title),
        odeStructuredDeliverables: nextDeliverables
      };
      if (nextDeliverables.length === 0) {
        delete nextProperties.odeExpectedDeliverables;
        delete nextProperties.odeStructuredDeliverables;
      }

      await updateNodeProperties(ownerNode.id, nextProperties);
      store.patchNode(ownerNode.id, {
        properties: nextProperties,
        updatedAt: Date.now()
      });
    },
    [nodeById, store]
  );

  async function syncWorkareaOwnerMeaningFromTree(
    ownerNodeId: string,
    options?: { refreshAfterSync?: boolean }
  ) {
    const allNodes = await getAllNodes();
    const ownerNode = allNodes.find((node) => node.id === ownerNodeId) ?? null;
    if (!ownerNode || isFileLikeNode(ownerNode)) return;

    const { byParent: freshByParent } = buildTreeMaps(allNodes);
    const freshNodeById = new Map(allNodes.map((node) => [node.id, node] as const));
    const deliverables = buildStructuredDeliverablesFromWorkareaNodes({
      ownerNodeId,
      byParent: freshByParent,
      nodeById: freshNodeById
    });

    const nextProperties: Record<string, unknown> = {
      ...(ownerNode.properties ?? {})
    };
    const objective = readNodeObjectiveValue(ownerNode);
    if (objective) {
      nextProperties.odeObjective = objective;
    } else {
      delete nextProperties.odeObjective;
    }
    if (deliverables.length > 0) {
      nextProperties.odeExpectedDeliverables = deliverables.map((deliverable) => deliverable.title);
      nextProperties.odeStructuredDeliverables = deliverables;
    } else {
      delete nextProperties.odeExpectedDeliverables;
      delete nextProperties.odeStructuredDeliverables;
    }

    await updateNodeProperties(ownerNodeId, nextProperties);
    store.patchNode(ownerNodeId, {
      properties: nextProperties,
      updatedAt: Date.now()
    });
    await syncExecutionTaskProjectionNodes(ownerNodeId, deliverables, {
      refreshAfterSync: options?.refreshAfterSync ?? false
    });
  }

  const deleteNodeWithExecutionSync = useCallback(
    async (nodeId: string, shouldSyncProjection?: boolean) => {
      if (!ensureStructureMutationAllowed([nodeId])) return;
      const deletedNode = nodeById.get(nodeId) ?? null;
      const deletedWorkareaOwnerId =
        deletedNode && isWorkareaItemNode(deletedNode)
          ? getWorkareaOwnerNodeId(deletedNode, nodeById)
          : null;
      await deleteNode(nodeId, shouldSyncProjection);
      if (deletedWorkareaOwnerId) {
        await syncWorkareaOwnerMeaningFromTree(deletedWorkareaOwnerId, {
          refreshAfterSync: false
        });
        return;
      }
      await syncExecutionTaskDeletionToOwner(deletedNode);
    },
    [
      ensureStructureMutationAllowed,
      nodeById,
      syncExecutionTaskDeletionToOwner,
      syncWorkareaOwnerMeaningFromTree
    ]
  );

  const syncExecutionTaskProjectionNodes = useCallback(
    async (
      nodeId: string,
      deliverables: ODEStructuredDeliverable[],
      options?: { refreshAfterSync?: boolean }
    ) => {
      const desiredTasks = deliverables.flatMap((deliverable) =>
        deliverable.tasks.map((task, taskIndex) => ({
          ...task,
          deliverableId: deliverable.id,
          deliverableTitle: deliverable.title,
          order: taskIndex
        }))
      );
      const titleCounts = new Map<string, number>();
      desiredTasks.forEach((task) => {
        const key = task.title.trim().toLowerCase();
        titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
      });
      const buildTaskNodeName = (task: (typeof desiredTasks)[number]) => {
        const count = titleCounts.get(task.title.trim().toLowerCase()) ?? 0;
        return count > 1 && task.deliverableTitle.trim().length > 0
          ? `${task.title} [${task.deliverableTitle.trim()}]`
          : task.title;
      };

      const existingExecutionTaskNodes = store.allNodes.filter((node) => {
        const meta = getExecutionTaskMeta(node);
        return Boolean(meta && meta.ownerNodeId === nodeId);
      });
      const existingByTaskId = new Map(
        existingExecutionTaskNodes.map((node) => [getExecutionTaskMeta(node)?.taskId ?? node.id, node])
      );
      const desiredTaskIds = new Set(desiredTasks.map((task) => task.id));
      let executionTasksChanged = false;

      for (const task of desiredTasks) {
        const existingTaskNode = existingByTaskId.get(task.id) ?? null;
        const nextTaskName = buildTaskNodeName(task);
        const nextTaskDescription = normalizeExecutionTaskText(task.note);
        const existingTaskSchedule = existingTaskNode ? parseNodeTimelineSchedule(existingTaskNode) : null;
        const nextTaskSchedule = buildExecutionTaskTimelineSchedule(
          task,
          nextTaskName,
          existingTaskSchedule
        );
        const effectiveTaskSchedule = nextTaskSchedule ?? existingTaskSchedule;
        const nextTaskProperties: Record<string, unknown> = {
          ...(existingTaskNode?.properties ?? {}),
          odeExecutionTask: true,
          odeExecutionTaskId: task.id,
          odeExecutionOwnerNodeId: nodeId,
          odeExecutionDeliverableId: task.deliverableId,
          odeExecutionDeliverableTitle: task.deliverableTitle,
          odeExecutionTaskTitle: task.title,
          odeExecutionTaskOrder: task.order
        };
        if (task.ownerName && task.ownerName.trim().length > 0) {
          nextTaskProperties.odeExecutionTaskOwnerName = task.ownerName.trim();
        } else {
          delete nextTaskProperties.odeExecutionTaskOwnerName;
        }
        if (task.dueDate && task.dueDate.trim().length > 0) {
          nextTaskProperties.odeExecutionTaskDueDate = task.dueDate.trim();
        } else {
          delete nextTaskProperties.odeExecutionTaskDueDate;
        }
        nextTaskProperties.odeExecutionTaskStatus = task.status ?? "planned";
        nextTaskProperties.odeExecutionTaskFlagged = task.flagged === true;
        if (nextTaskDescription) {
          nextTaskProperties.odeExecutionTaskNote = nextTaskDescription;
        } else {
          delete nextTaskProperties.odeExecutionTaskNote;
        }
        if (nextTaskSchedule) {
          nextTaskProperties.timelineSchedule = {
            ...nextTaskSchedule,
            mode: "manual"
          };
        }

        if (!existingTaskNode) {
          const createdTaskNode = await createNode(nodeId, nextTaskName, "task");
          await updateNodeProperties(createdTaskNode.id, nextTaskProperties);
          if (nextTaskDescription !== null) {
            await updateNodeDescription(createdTaskNode.id, nextTaskDescription);
          }
          executionTasksChanged = true;
          continue;
        }

        if (existingTaskNode.name !== nextTaskName) {
          await renameNode(existingTaskNode.id, nextTaskName);
          executionTasksChanged = true;
        }

        const currentTaskProperties = existingTaskNode.properties ?? {};
        const taskPropertiesChanged =
          currentTaskProperties.odeExecutionTaskId !== nextTaskProperties.odeExecutionTaskId ||
          currentTaskProperties.odeExecutionOwnerNodeId !== nextTaskProperties.odeExecutionOwnerNodeId ||
          currentTaskProperties.odeExecutionDeliverableId !== nextTaskProperties.odeExecutionDeliverableId ||
          currentTaskProperties.odeExecutionDeliverableTitle !== nextTaskProperties.odeExecutionDeliverableTitle ||
          currentTaskProperties.odeExecutionTaskTitle !== nextTaskProperties.odeExecutionTaskTitle ||
          currentTaskProperties.odeExecutionTaskOrder !== nextTaskProperties.odeExecutionTaskOrder ||
          currentTaskProperties.odeExecutionTaskOwnerName !== nextTaskProperties.odeExecutionTaskOwnerName ||
          currentTaskProperties.odeExecutionTaskDueDate !== nextTaskProperties.odeExecutionTaskDueDate ||
          currentTaskProperties.odeExecutionTaskStatus !== nextTaskProperties.odeExecutionTaskStatus ||
          currentTaskProperties.odeExecutionTaskFlagged !== nextTaskProperties.odeExecutionTaskFlagged ||
          currentTaskProperties.odeExecutionTaskNote !== nextTaskProperties.odeExecutionTaskNote ||
          !areSchedulesEquivalent(
            existingTaskSchedule,
            effectiveTaskSchedule
          ) ||
          currentTaskProperties.odeExecutionTask !== true;
        if (taskPropertiesChanged) {
          await updateNodeProperties(existingTaskNode.id, nextTaskProperties);
          executionTasksChanged = true;
        }
        if ((existingTaskNode.description ?? null) !== nextTaskDescription) {
          await updateNodeDescription(existingTaskNode.id, nextTaskDescription);
          executionTasksChanged = true;
        }
      }

      for (const existingTaskNode of existingExecutionTaskNodes) {
        const meta = getExecutionTaskMeta(existingTaskNode);
        if (!meta || desiredTaskIds.has(meta.taskId)) continue;
        await deleteNode(existingTaskNode.id);
        executionTasksChanged = true;
      }

      if (executionTasksChanged && options?.refreshAfterSync !== false) {
        await refreshTreeAndKeepContext(nodeId, [nodeId], workspaceMode === "timeline" ? "timeline" : "tree");
      }

      return executionTasksChanged;
    },
    [refreshTreeAndKeepContext, store.allNodes, workspaceMode]
  );

  const saveProcedureNodeMeaning = useCallback(
    async (
      nodeId: string,
      meaning: {
        objective: string | null;
        deliverables: ODEStructuredDeliverable[];
        chantierProfile?: ODEChantierProfile | null;
      },
      options?: { extraProperties?: Record<string, unknown> }
    ) => {
      const currentNode = store.allNodes.find((node) => node.id === nodeId);
      let nextProperties = {
        ...(currentNode?.properties ?? {}),
        ...(options?.extraProperties ?? {})
      };
      const nextDeliverables = meaning.deliverables
        .map((deliverable, index) => ({
          id:
            typeof deliverable.id === "string" && deliverable.id.trim().length > 0
              ? deliverable.id.trim()
              : `ode-deliverable-${Date.now()}-${index}`,
          title: deliverable.title.trim(),
          tasks: normalizeExecutionTaskItems(deliverable.tasks),
          notifications: deliverable.notifications.map((item) => item.trim()).filter((item) => item.length > 0),
          data: deliverable.data.map((item) => item.trim()).filter((item) => item.length > 0)
        }))
        .filter((deliverable) => deliverable.title.length > 0);
      if (meaning.objective && meaning.objective.trim().length > 0) {
        nextProperties.odeObjective = meaning.objective.trim();
      } else {
        delete nextProperties.odeObjective;
      }
      if (nextDeliverables.length > 0) {
        nextProperties.odeExpectedDeliverables = nextDeliverables.map((deliverable) => deliverable.title);
        nextProperties.odeStructuredDeliverables = nextDeliverables;
      } else {
        delete nextProperties.odeExpectedDeliverables;
        delete nextProperties.odeStructuredDeliverables;
      }
      nextProperties = applyChantierProfileToProperties(nextProperties, meaning.chantierProfile);
      await updateNodeProperties(nodeId, nextProperties);
      store.patchNode(nodeId, {
        properties: nextProperties,
        updatedAt: Date.now()
      });
      await syncExecutionTaskProjectionNodes(nodeId, nextDeliverables);
    },
    [store, syncExecutionTaskProjectionNodes]
  );
  const setProcedureNodeChantierMode = useCallback(
    async (nodeId: string, enabled: boolean) => {
      const node = store.allNodes.find((candidate) => candidate.id === nodeId) ?? null;
      if (!node || node.type !== "folder" || isFileLikeNode(node)) return;
      const metadata = getODENodeMetadata(node);
      const canEnableManually =
        metadata.level === null && metadata.naCode === null && metadata.kind === null;
      const nextProperties: Record<string, unknown> = { ...(node.properties ?? {}) };

      if (enabled) {
        if (!canEnableManually) return;
        nextProperties.ode_node_kind = "chantier";
        nextProperties[MANUAL_CHANTIER_PROPERTY] = true;
      } else {
        if (!nextProperties[MANUAL_CHANTIER_PROPERTY]) return;
        delete nextProperties[MANUAL_CHANTIER_PROPERTY];
        delete nextProperties.ode_node_kind;
      }

      const sanitizedProperties = enabled ? nextProperties : applyChantierProfileToProperties(nextProperties, null);

      await updateNodeProperties(nodeId, sanitizedProperties);
      store.patchNode(nodeId, {
        properties: sanitizedProperties,
        updatedAt: Date.now()
      });
    },
    [store]
  );

  useEffect(() => {
    if (workspaceFocusMode !== "execution" || hasTimelineTaskSearch || hasActiveTimelineScheduleFiltering) {
      workstreamProjectionRepairSignatureRef.current = null;
      return;
    }
    if (displayedTimelineRows.length > 0) {
      workstreamProjectionRepairSignatureRef.current = null;
      return;
    }

    const ownersToRepair = store.allNodes
      .filter((node) => (projectScopedNodeIds ? projectScopedNodeIds.has(node.id) : true))
      .filter((node) => !isFileLikeNode(node) && !isHiddenExecutionTaskNode(node))
      .map((node) => ({
        node,
        deliverables: normalizeStructuredDeliverablesForNode(node.id, node.properties?.odeStructuredDeliverables)
      }))
      .filter(({ deliverables }) => deliverables.some((deliverable) => deliverable.tasks.length > 0));

    if (ownersToRepair.length === 0) {
      workstreamProjectionRepairSignatureRef.current = null;
      return;
    }

    const repairSignature = ownersToRepair
      .map(
        ({ node, deliverables }) =>
          `${node.id}:${deliverables
            .map(
              (deliverable) =>
                `${deliverable.id}[${deliverable.tasks.map((task) => task.id).join(",")}]`
            )
            .join("|")}`
      )
      .join("||");

    if (
      workstreamProjectionRepairInFlightRef.current ||
      workstreamProjectionRepairSignatureRef.current === repairSignature
    ) {
      return;
    }

    workstreamProjectionRepairSignatureRef.current = repairSignature;
    workstreamProjectionRepairInFlightRef.current = true;

    let cancelled = false;
    void (async () => {
      let repaired = false;
      try {
        for (const entry of ownersToRepair) {
          repaired =
            (await syncExecutionTaskProjectionNodes(entry.node.id, entry.deliverables, {
              refreshAfterSync: false
            })) || repaired;
          if (cancelled) return;
        }
        if (repaired && !cancelled) {
          const focusId = ownersToRepair[0]?.node.id ?? null;
          const expandIds = ownersToRepair.map((entry) => entry.node.id);
          await refreshTreeAndKeepContext(focusId, expandIds, workspaceMode === "timeline" ? "timeline" : "tree");
        }
      } finally {
        workstreamProjectionRepairInFlightRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    displayedTimelineRows,
    hasActiveTimelineScheduleFiltering,
    hasTimelineTaskSearch,
    refreshTreeAndKeepContext,
    projectScopedNodeIds,
    store.allNodes,
    syncExecutionTaskProjectionNodes,
    workspaceFocusMode,
    workspaceMode
  ]);

  const resolveExecutionTaskContext = useCallback(
    (nodeId: string) => {
      const taskNode = nodeById.get(nodeId) ?? store.allNodes.find((node) => node.id === nodeId) ?? null;
      const meta = getExecutionTaskMeta(taskNode);
      if (!taskNode || !meta) return null;
      const ownerNode =
        nodeById.get(meta.ownerNodeId) ?? store.allNodes.find((node) => node.id === meta.ownerNodeId) ?? null;
      if (!ownerNode) return null;
      const deliverables = normalizeStructuredDeliverablesForNode(
        ownerNode.id,
        ownerNode.properties?.odeStructuredDeliverables
      );
      const deliverableIndex = deliverables.findIndex((deliverable) => deliverable.id === meta.deliverableId);
      if (deliverableIndex < 0) return null;
      const deliverable = deliverables[deliverableIndex];
      const taskIndex = deliverable.tasks.findIndex((task) => task.id === meta.taskId);
      if (taskIndex < 0) return null;
      return {
        taskNode,
        meta,
        ownerNode,
        deliverables,
        deliverableIndex,
        deliverable,
        taskIndex,
        task: deliverable.tasks[taskIndex]
      };
    },
    [nodeById, store.allNodes]
  );

  const saveExecutionTaskOwnerDeliverables = useCallback(
    async (ownerNodeId: string, deliverables: ODEStructuredDeliverable[]) => {
      const ownerNode =
        nodeById.get(ownerNodeId) ?? store.allNodes.find((node) => node.id === ownerNodeId) ?? null;
      if (!ownerNode) return;
      await saveProcedureNodeMeaning(ownerNodeId, {
        objective: readNodeObjectiveValue(ownerNode),
        deliverables
      });
    },
    [nodeById, saveProcedureNodeMeaning, store.allNodes]
  );

  const ensureWorkareaItemProperties = useCallback(
    async (nodeId: string, extraProperties?: Record<string, unknown>) => {
      const currentNode =
        nodeById.get(nodeId) ?? store.allNodes.find((node) => node.id === nodeId) ?? (await getNode(nodeId)) ?? null;
      if (!currentNode) return;
      const parentNode =
        currentNode.parentId && currentNode.parentId !== ROOT_PARENT_ID
          ? nodeById.get(currentNode.parentId) ??
            store.allNodes.find((node) => node.id === currentNode.parentId) ??
            (await getNode(currentNode.parentId)) ??
            null
          : null;
      const explicitKind = extraProperties?.odeWorkareaItemKind;
      const requestedKind: WorkareaItemKind | null =
        explicitKind === "deliverable" || explicitKind === "task" || explicitKind === "subtask"
          ? explicitKind
          : null;
      const nextWorkareaKind =
        requestedKind ??
        readStoredWorkareaItemKind(currentNode) ??
        getWorkareaItemKind(currentNode, nodeById) ??
        resolveWorkareaItemKindForParent(parentNode, nodeById);
      const nextProperties: Record<string, unknown> = {
        ...(currentNode.properties ?? {}),
        ...(extraProperties ?? {}),
        odeWorkareaItem: true,
        odeWorkareaItemKind: nextWorkareaKind
      };
      await updateNodeProperties(nodeId, nextProperties);
      store.patchNode(nodeId, {
        properties: nextProperties,
        updatedAt: Date.now()
      });
    },
    [nodeById, store]
  );

  useEffect(() => {
    const nodesNeedingKindSync = store.allNodes.filter((node) => {
      if (!isWorkareaItemNode(node)) return false;
      const computedKind = getWorkareaItemKind(node, nodeById);
      if (!computedKind) return false;
      return readStoredWorkareaItemKind(node) !== computedKind;
    });
    if (nodesNeedingKindSync.length === 0) return;

    let cancelled = false;

    void (async () => {
      for (const node of nodesNeedingKindSync) {
        if (cancelled) return;
        const computedKind = getWorkareaItemKind(node, nodeById);
        if (!computedKind) continue;
        const nextProperties: Record<string, unknown> = {
          ...(node.properties ?? {}),
          odeWorkareaItem: true,
          odeWorkareaItemKind: computedKind
        };
        await updateNodeProperties(node.id, nextProperties);
        if (cancelled) return;
        store.patchNode(node.id, {
          properties: nextProperties,
          updatedAt: Date.now()
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [nodeById, store.allNodes, store]);

  const ensureLegacyWorkareaTreeForOwner = useCallback(
    async (ownerNodeId: string) => {
      if (!ensureStructureMutationAllowed([ownerNodeId], { scope: "workarea" })) return;
      const ownerNode =
        nodeById.get(ownerNodeId) ?? store.allNodes.find((node) => node.id === ownerNodeId) ?? (await getNode(ownerNodeId)) ?? null;
    if (!ownerNode || isFileLikeNode(ownerNode)) return;

      const legacyDeliverables = normalizeStructuredDeliverablesForNode(
        ownerNode.id,
        ownerNode.properties?.odeStructuredDeliverables
      );
      if (legacyDeliverables.length === 0) return;

      const ownerChildren = await getChildren(ownerNode.id);
      const existingDeliverableNodes = ownerChildren.filter((child) => isWorkareaItemNode(child));

      const findExistingWorkareaNode = (
        candidates: AppNode[],
        legacyIdKey: string,
        legacyId: string,
        title: string
      ): AppNode | null => {
        const byLegacyId =
          candidates.find((candidate) => {
            const candidateLegacyId = candidate.properties?.[legacyIdKey];
            return typeof candidateLegacyId === "string" && candidateLegacyId.trim() === legacyId;
          }) ?? null;
        if (byLegacyId) return byLegacyId;
        const normalizedTitle = title.trim().toLowerCase();
        return candidates.find((candidate) => candidate.name.trim().toLowerCase() === normalizedTitle) ?? null;
      };

      for (const deliverable of legacyDeliverables) {
        let deliverableNode = findExistingWorkareaNode(
          existingDeliverableNodes,
          "odeWorkareaLegacyDeliverableId",
          deliverable.id,
          deliverable.title
        );
        if (!deliverableNode) {
          deliverableNode = await createNode(ownerNode.id, deliverable.title, "folder");
        }
        await ensureWorkareaItemProperties(deliverableNode.id, {
          odeWorkareaLegacyDeliverableId: deliverable.id,
          odeWorkareaItemKind: "deliverable"
        });

        const existingTaskNodes = (await getChildren(deliverableNode.id)).filter((child) => isWorkareaItemNode(child));
        for (const task of deliverable.tasks) {
          let taskNode = findExistingWorkareaNode(
            existingTaskNodes,
            "odeWorkareaLegacyTaskId",
            task.id,
            task.title
          );
          if (!taskNode) {
            taskNode = await createNode(deliverableNode.id, task.title, "folder");
          }
          const extraProperties: Record<string, unknown> = {
            odeWorkareaLegacyTaskId: task.id,
            odeWorkareaItemKind: "task",
            odeExecutionTaskOwnerName: task.ownerName ?? null,
            odeExecutionTaskFlagged: task.flagged === true,
            odeExecutionTaskStatus: task.status ?? "planned",
            odeExecutionTaskDueDate: task.dueDate?.trim() || null
          };
          if (task.dueDate?.trim()) {
            extraProperties.timelineSchedule = normalizeTimelineSchedule({
              title: task.title.trim() || taskNode.name,
              status:
                task.status === "active" || task.status === "blocked" || task.status === "done"
                  ? task.status
                  : "planned",
              startDate: task.dueDate.trim(),
              endDate: task.dueDate.trim(),
              assignees: [],
              priority: "normal",
              progress: task.status === "active" ? 50 : 0,
              predecessor: "",
              mode: "manual"
            });
          }
          await ensureWorkareaItemProperties(taskNode.id, extraProperties);
          if (task.note?.trim()) {
            await updateNodeDescription(taskNode.id, task.note.trim());
            store.patchNode(taskNode.id, {
              description: task.note.trim(),
              updatedAt: Date.now()
            });
          }
        }
      }
    },
    [ensureStructureMutationAllowed, ensureWorkareaItemProperties, nodeById, store]
  );

  const saveWorkareaOwnerMeaning = useCallback(
    async (
      ownerNodeId: string,
      payload: {
        objective: string | null;
        deliverables: ODEStructuredDeliverable[];
        workspaces?: ODEWorkstreamWorkspace[];
      }
    ) => {
      const ownerNode =
        nodeById.get(ownerNodeId) ?? store.allNodes.find((node) => node.id === ownerNodeId) ?? null;
      if (!ownerNode) return;

      const nextProperties: Record<string, unknown> = {
        ...(ownerNode.properties ?? {})
      };
      const nextDeliverables = payload.deliverables
        .map((deliverable, index) => ({
          id:
            typeof deliverable.id === "string" && deliverable.id.trim().length > 0
              ? deliverable.id.trim()
              : `ode-deliverable-${Date.now()}-${index}`,
          title: deliverable.title.trim(),
          tasks: normalizeExecutionTaskItems(deliverable.tasks),
          notifications: deliverable.notifications.map((item) => item.trim()).filter((item) => item.length > 0),
          data: deliverable.data.map((item) => item.trim()).filter((item) => item.length > 0)
        }))
        .filter((deliverable) => deliverable.title.length > 0);

      if (payload.objective?.trim()) {
        nextProperties.odeObjective = payload.objective.trim();
      } else {
        delete nextProperties.odeObjective;
      }

      if (nextDeliverables.length > 0) {
        nextProperties.odeExpectedDeliverables = nextDeliverables.map((deliverable) => deliverable.title);
        nextProperties.odeStructuredDeliverables = nextDeliverables;
      } else {
        delete nextProperties.odeExpectedDeliverables;
        delete nextProperties.odeStructuredDeliverables;
      }

      if (payload.workspaces && payload.workspaces.length > 0) {
        nextProperties[ODE_WORKSTREAM_WORKSPACE_PROPERTY] = payload.workspaces.reduce(
          (collection, workspace) => upsertWorkstreamWorkspaceCollection(collection, workspace),
          ownerNode.properties?.[ODE_WORKSTREAM_WORKSPACE_PROPERTY] as unknown
        );
      }

      await updateNodeProperties(ownerNodeId, nextProperties);
      store.patchNode(ownerNodeId, {
        properties: nextProperties,
        updatedAt: Date.now()
      });
    },
    [nodeById, store]
  );

  const applyStructuredDeliverablesToWorkareaTree = useCallback(
    async (
      ownerNodeId: string,
      deliverables: ODEStructuredDeliverable[],
      options?: {
        objective?: string | null;
        workspaces?: ODEWorkstreamWorkspace[];
      }
    ) => {
      const ownerNode =
        nodeById.get(ownerNodeId) ?? store.allNodes.find((node) => node.id === ownerNodeId) ?? null;
    if (!ownerNode || isFileLikeNode(ownerNode)) return;

      const ownerChildren = await getChildren(ownerNodeId);
      const existingDeliverableNodes = ownerChildren.filter((child) => isWorkareaItemNode(child));
      const usedDeliverableNodeIds = new Set<string>();

      const findMatchingWorkareaNode = (
        candidates: AppNode[],
        usedNodeIds: Set<string>,
        legacyKey: string,
        legacyId: string,
        title: string
      ): AppNode | null => {
        const normalizedLegacyId = legacyId.trim();
        if (normalizedLegacyId) {
          const byLegacyId =
            candidates.find((candidate) => {
              if (usedNodeIds.has(candidate.id)) return false;
              const candidateLegacyValue = candidate.properties?.[legacyKey];
              return typeof candidateLegacyValue === "string" && candidateLegacyValue.trim() === normalizedLegacyId;
            }) ?? null;
          if (byLegacyId) return byLegacyId;
        }
        const normalizedTitle = title.trim().toLowerCase();
        if (!normalizedTitle) return null;
        return (
          candidates.find((candidate) => {
            if (usedNodeIds.has(candidate.id)) return false;
            return candidate.name.trim().toLowerCase() === normalizedTitle;
          }) ?? null
        );
      };

      let previousDeliverableNodeId: string | null = null;
      for (const [deliverableIndex, deliverable] of deliverables.entries()) {
        const deliverableTitle =
          deliverable.title.trim() ||
          `${t("procedure.node_deliverable_default")} ${deliverableIndex + 1}`;
        let deliverableNode = findMatchingWorkareaNode(
          existingDeliverableNodes,
          usedDeliverableNodeIds,
          "odeWorkareaLegacyDeliverableId",
          deliverable.id,
          deliverableTitle
        );
        if (!deliverableNode) {
          deliverableNode = await createNode(ownerNodeId, deliverableTitle, "folder");
        }
        await ensureWorkareaItemProperties(deliverableNode.id, {
          odeWorkareaLegacyDeliverableId: deliverable.id,
          odeWorkareaItemKind: "deliverable"
        });
        if (deliverableNode.name.trim() !== deliverableTitle) {
          await renameNode(deliverableNode.id, deliverableTitle);
          store.patchNode(deliverableNode.id, {
            name: deliverableTitle,
            updatedAt: Date.now()
          });
        }
        await moveNode(deliverableNode.id, ownerNodeId, previousDeliverableNodeId);
        usedDeliverableNodeIds.add(deliverableNode.id);
        previousDeliverableNodeId = deliverableNode.id;

        const existingTaskNodes = (await getChildren(deliverableNode.id)).filter((child) => isWorkareaItemNode(child));
        const usedTaskNodeIds = new Set<string>();
        let previousTaskNodeId: string | null = null;

        for (const [taskIndex, task] of deliverable.tasks.entries()) {
          const taskTitle = task.title.trim() || `${t("procedure.node_task_default")} ${taskIndex + 1}`;
          let taskNode = findMatchingWorkareaNode(
            existingTaskNodes,
            usedTaskNodeIds,
            "odeWorkareaLegacyTaskId",
            task.id,
            taskTitle
          );
          if (!taskNode) {
            taskNode = await createNode(deliverableNode.id, taskTitle, "folder");
          }

          const nextTaskProperties: Record<string, unknown> = {
            odeWorkareaLegacyTaskId: task.id,
            odeWorkareaItemKind: "task",
            odeExecutionTaskOwnerName: task.ownerName ?? null,
            odeExecutionTaskFlagged: task.flagged === true,
            odeExecutionTaskStatus: task.status ?? "planned",
            odeExecutionTaskDueDate: task.dueDate?.trim() || null
          };
          if (task.dueDate?.trim()) {
            nextTaskProperties.timelineSchedule = normalizeTimelineSchedule({
              title: taskTitle,
              status:
                task.status === "active" || task.status === "blocked" || task.status === "done"
                  ? task.status
                  : "planned",
              startDate: task.dueDate.trim(),
              endDate: task.dueDate.trim(),
              assignees: [],
              priority: "normal",
              progress: task.status === "done" ? 100 : task.status === "active" ? 50 : 0,
              predecessor: "",
              mode: "manual"
            });
          }
          await ensureWorkareaItemProperties(taskNode.id, nextTaskProperties);
          if (taskNode.name.trim() !== taskTitle) {
            await renameNode(taskNode.id, taskTitle);
            store.patchNode(taskNode.id, {
              name: taskTitle,
              updatedAt: Date.now()
            });
          }
          await moveNode(taskNode.id, deliverableNode.id, previousTaskNodeId);
          const nextTaskDescription = task.note?.trim() || null;
          if ((taskNode.description ?? null) !== nextTaskDescription) {
            await updateNodeDescription(taskNode.id, nextTaskDescription);
            store.patchNode(taskNode.id, {
              description: nextTaskDescription,
              updatedAt: Date.now()
            });
          }
          usedTaskNodeIds.add(taskNode.id);
          previousTaskNodeId = taskNode.id;
        }
      }

      await saveWorkareaOwnerMeaning(ownerNodeId, {
        objective: options?.objective ?? readNodeObjectiveValue(ownerNode),
        deliverables,
        workspaces: options?.workspaces
      });
    },
    [ensureWorkareaItemProperties, nodeById, saveWorkareaOwnerMeaning, store, t]
  );

  const openNodeInWorkarea = async (
    targetNodeId?: string | null,
    options?: { deliverableId?: string | null; openExecution?: boolean }
  ) => {
    const targetNode =
      targetNodeId !== undefined && targetNodeId !== null
        ? nodeById.get(targetNodeId) ?? store.allNodes.find((node) => node.id === targetNodeId) ?? null
        : null;
    const ownerNodeId = resolveWorkareaOwnerNodeId(targetNodeId);
    if (!ownerNodeId) return;
    await ensureLegacyWorkareaTreeForOwner(ownerNodeId);
    const browseTargetId = targetNode && isWorkareaItemNode(targetNode) ? targetNode.id : ownerNodeId;
    setWorkspaceMode("grid");
    setDesktopViewMode(desktopBrowseViewModeRef.current === "details" ? "details" : "grid");
    setActiveNodeStateFilters(resolveNodeStateFiltersForWorkspaceFocusMode("execution"));
    setSelectionSurface("tree");
    setKeyboardSurface("tree");
    setExecutionQuickOpenDeliverableId(options?.deliverableId ?? null);
    await store.navigateTo(browseTargetId);
    updateExpandedIdsForContext("workarea", (prev) => {
      const next = new Set(prev);
      next.add(ownerNodeId);
      if (targetNode && isWorkareaItemNode(targetNode)) {
        for (const ancestorId of collectAncestorNodeIds(targetNode.id, nodeById)) {
          if (ancestorId === ownerNodeId || isWorkareaItemNode(nodeById.get(ancestorId) ?? null)) {
            next.add(ancestorId);
          }
        }
      }
      return next;
    });
    setPrimarySelection(targetNode?.id ?? browseTargetId, "tree");
    if (options?.openExecution) {
      setExecutionQuickOpenRequestKey((current) => current + 1);
    }
  };
  openNodeInWorkareaRef.current = openNodeInWorkarea;

  const setNodeWorkareaOwner = async (nodeId: string, enabled: boolean) => {
    const node = nodeById.get(nodeId) ?? store.allNodes.find((candidate) => candidate.id === nodeId) ?? null;
    if (!node || isFileLikeNode(node) || isWorkareaItemNode(node)) return;
    if (!ensureStructureMutationAllowed([node.id], { scope: "workarea" })) return;

    const nextProperties: Record<string, unknown> = {
      ...(node.properties as Record<string, unknown> | undefined)
    };
    if (enabled) {
      nextProperties.odeWorkareaOwner = true;
    } else {
      delete nextProperties.odeWorkareaOwner;
    }

    await updateNodeProperties(node.id, nextProperties);
    if (!enabled) {
      await syncWorkareaOwnerMeaningFromTree(node.id, {
        refreshAfterSync: false
      });
    }
    const ensureExpandedParentIds = [
      node.id,
      ...(node.parentId && node.parentId !== ROOT_PARENT_ID ? [node.parentId] : [])
    ];
    await refreshTreeAndKeepContext(
      node.id,
      ensureExpandedParentIds,
      workspaceModeRef.current === "timeline" ? "timeline" : "tree"
    );

    if (enabled) {
      await openNodeInWorkarea(node.id);
    }
  };

  const addWorkareaDeliverable = async (ownerNodeId: string) => {
    if (!ensureStructureMutationAllowed([ownerNodeId], { scope: "workarea" })) return;
    await ensureLegacyWorkareaTreeForOwner(ownerNodeId);
    await createNewTopicNode(ownerNodeId, workspaceModeRef.current === "timeline" ? "timeline" : "tree", {
      expandNodeIds: [ownerNodeId]
    });
  };

  const addWorkareaTask = async (ownerNodeId: string, deliverableId: string) => {
    if (!ensureStructureMutationAllowed([ownerNodeId, deliverableId], { scope: "workarea" })) return;
    await ensureLegacyWorkareaTreeForOwner(ownerNodeId);
    const deliverableNode =
      nodeById.get(deliverableId) ?? store.allNodes.find((node) => node.id === deliverableId) ?? null;
    if (!deliverableNode) return;
    await createNewTopicNode(deliverableNode.id, workspaceModeRef.current === "timeline" ? "timeline" : "tree", {
      expandNodeIds: [ownerNodeId, deliverableNode.id]
    });
  };

  const deleteWorkareaDeliverable = async (ownerNodeId: string, deliverableId: string) => {
    const deliverableNode =
      nodeById.get(deliverableId) ?? store.allNodes.find((node) => node.id === deliverableId) ?? null;
    if (!deliverableNode) return;
    if (!ensureStructureMutationAllowed([ownerNodeId, deliverableNode.id], { scope: "workarea" })) return;
    await deleteNodeWithExecutionSync(deliverableNode.id, false);
    await refreshTreeAndKeepContext(
      ownerNodeId,
      [ownerNodeId],
      workspaceModeRef.current === "timeline" ? "timeline" : "tree"
    );
  };

  const resolveExecutionTaskProjectionIds = useCallback(async (taskIds: string[]) => {
    if (taskIds.length === 0) return [];
    const taskIdSet = new Set(taskIds);
    const orderByTaskId = new Map(taskIds.map((taskId, index) => [taskId, index]));
    const allNodes = await getAllNodes();
    return allNodes
      .filter((node) => {
        const meta = getExecutionTaskMeta(node);
        return Boolean(meta && taskIdSet.has(meta.taskId));
      })
      .sort((left, right) => {
        const leftMeta = getExecutionTaskMeta(left);
        const rightMeta = getExecutionTaskMeta(right);
        const leftOrder = leftMeta ? orderByTaskId.get(leftMeta.taskId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
        const rightOrder = rightMeta ? orderByTaskId.get(rightMeta.taskId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
        return leftOrder - rightOrder;
      })
      .map((node) => node.id);
  }, []);

  const createExecutionTaskRelative = useCallback(
    async (
      sourceNodeId: string,
      options?: {
        insertBefore?: boolean;
        initialText?: string;
        startInlineEdit?: boolean;
      }
    ): Promise<ClipboardMutationResult | null> => {
      const context = resolveExecutionTaskContext(sourceNodeId);
      if (!context) return null;

      const nextTask = createExecutionTaskItem(options?.initialText ?? "");
      const nextTasks = [...context.deliverable.tasks];
      const insertIndex = context.taskIndex + (options?.insertBefore ? 0 : 1);
      nextTasks.splice(insertIndex, 0, nextTask);

      const nextDeliverables = context.deliverables.map((deliverable, deliverableIndex) =>
        deliverableIndex === context.deliverableIndex
          ? {
              ...deliverable,
              tasks: nextTasks
            }
          : deliverable
      );

      await saveExecutionTaskOwnerDeliverables(context.ownerNode.id, nextDeliverables);
      const createdNodeIds = await resolveExecutionTaskProjectionIds([nextTask.id]);
      const focusNodeId = createdNodeIds[0] ?? null;
      if (focusNodeId) {
        await refreshTreeAndKeepContext(focusNodeId, [context.ownerNode.id], "timeline");
        setSelectionFromIds(createdNodeIds, focusNodeId, "timeline");
        if (options?.startInlineEdit) {
          beginInlineEdit(focusNodeId, options?.initialText ?? "", "timeline");
        }
      }
      return {
        createdNodeIds,
        focusNodeId,
        surface: "timeline"
      };
    },
    [
      beginInlineEdit,
      refreshTreeAndKeepContext,
      resolveExecutionTaskContext,
      resolveExecutionTaskProjectionIds,
      saveExecutionTaskOwnerDeliverables
    ]
  );

  const moveExecutionTaskSelection = useCallback(
    async (sourceNodeIds: string[], direction: "up" | "down"): Promise<boolean> => {
      if (sourceNodeIds.length === 0) return false;
      const contexts = sourceNodeIds
        .map((sourceNodeId) => resolveExecutionTaskContext(sourceNodeId))
        .filter((context): context is NonNullable<typeof context> => Boolean(context));
      if (contexts.length === 0) return false;

      const firstContext = contexts[0];
      if (
        contexts.some(
          (context) =>
            context.ownerNode.id !== firstContext.ownerNode.id || context.deliverable.id !== firstContext.deliverable.id
        )
      ) {
        return false;
      }

      const selectedTaskIds = new Set(contexts.map((context) => context.task.id));
      const originalTasks = [...firstContext.deliverable.tasks];
      const selectedTasks = originalTasks.filter((task) => selectedTaskIds.has(task.id));
      if (selectedTasks.length === 0) return false;

      const firstSelectedIndex = originalTasks.findIndex((task) => selectedTaskIds.has(task.id));
      const lastSelectedIndex =
        originalTasks.length -
        1 -
        [...originalTasks].reverse().findIndex((task) => selectedTaskIds.has(task.id));
      if (firstSelectedIndex < 0 || lastSelectedIndex < 0) return false;
      if (direction === "up" && firstSelectedIndex === 0) return false;
      if (direction === "down" && lastSelectedIndex === originalTasks.length - 1) return false;

      const remainingTasks = originalTasks.filter((task) => !selectedTaskIds.has(task.id));
      let insertIndex = 0;

      if (direction === "up") {
        const previousTask = originalTasks[firstSelectedIndex - 1] ?? null;
        if (!previousTask) return false;
        insertIndex = Math.max(0, remainingTasks.findIndex((task) => task.id === previousTask.id));
      } else {
        const nextTask = originalTasks[lastSelectedIndex + 1] ?? null;
        if (!nextTask) return false;
        const nextTaskIndex = remainingTasks.findIndex((task) => task.id === nextTask.id);
        if (nextTaskIndex < 0) return false;
        insertIndex = nextTaskIndex + 1;
      }

      remainingTasks.splice(insertIndex, 0, ...selectedTasks);
      const nextDeliverables = firstContext.deliverables.map((deliverable, deliverableIndex) =>
        deliverableIndex === firstContext.deliverableIndex
          ? {
              ...deliverable,
              tasks: remainingTasks
            }
          : deliverable
      );

      await saveExecutionTaskOwnerDeliverables(firstContext.ownerNode.id, nextDeliverables);
      await refreshTreeAndKeepContext(sourceNodeIds[0], [firstContext.ownerNode.id], "timeline");
      setSelectionFromIds(sourceNodeIds, sourceNodeIds[0], "timeline");
      return true;
    },
    [refreshTreeAndKeepContext, resolveExecutionTaskContext, saveExecutionTaskOwnerDeliverables]
  );

  const renameExecutionTaskProjection = useCallback(
    async (nodeId: string, nextTitle: string, surface: SelectionSurface): Promise<boolean> => {
      const context = resolveExecutionTaskContext(nodeId);
      if (!context) return false;
      const trimmedTitle = nextTitle.trim();
      if (!trimmedTitle) return true;
      const nextDeliverables = context.deliverables.map((deliverable, deliverableIndex) =>
        deliverableIndex !== context.deliverableIndex
          ? deliverable
          : {
              ...deliverable,
              tasks: deliverable.tasks.map((task, taskIndex) =>
                taskIndex === context.taskIndex
                  ? {
                      ...task,
                      title: trimmedTitle
                    }
                  : task
              )
            }
      );
      await saveExecutionTaskOwnerDeliverables(context.ownerNode.id, nextDeliverables);
      setPrimarySelection(nodeId, surface);
      return true;
    },
    [resolveExecutionTaskContext, saveExecutionTaskOwnerDeliverables]
  );

  const buildExecutionTaskCopyTitle = useCallback(
    (baseTitle: string, existingTitles: Set<string>) => {
      let candidate = buildCopyNameWithSuffix(baseTitle, "task", t("node.copy_suffix"));
      let attempt = 1;
      while (existingTitles.has(candidate.trim().toLowerCase()) && attempt < 100) {
        candidate = buildCopyNameWithSuffix(candidate, "task", t("node.copy_suffix"));
        attempt += 1;
      }
      existingTitles.add(candidate.trim().toLowerCase());
      return candidate;
    },
    [t]
  );

  const buildExecutionTaskClipboard = useCallback(
    async (mode: "copy" | "cut", sourceNodeIds: string[]): Promise<BranchClipboard | null> => {
      if (sourceNodeIds.length === 0) return null;
      const items: ExecutionTaskClipboardItem[] = [];
      for (const sourceNodeId of sourceNodeIds) {
        const context = resolveExecutionTaskContext(sourceNodeId);
        if (!context) return null;
        items.push({
          sourceNodeId,
          ownerNodeId: context.ownerNode.id,
          deliverableId: context.deliverable.id,
          task: { ...context.task },
          order: context.taskIndex
        });
      }
      if (items.length === 0) return null;
      return {
        kind: "execution_tasks",
        mode,
        sourceNodeId: items[0].sourceNodeId,
        sourceNodeIds: items.map((item) => item.sourceNodeId),
        items,
        copiedAt: Date.now(),
        sourceApp: "odetool-rebuild"
      };
    },
    [resolveExecutionTaskContext]
  );

  const pasteExecutionTaskClipboard = useCallback(
    async (
      clipboard: ExecutionTaskClipboard,
      targetNodeId?: string | null,
      surface: SelectionSurface = "timeline"
    ): Promise<ClipboardMutationResult | null> => {
      if (clipboard.items.length === 0) return null;
      const selectedTargetNodeId =
        targetNodeId === undefined ? store.selectedNodeId ?? null : targetNodeId ?? null;
      const targetContext = selectedTargetNodeId ? resolveExecutionTaskContext(selectedTargetNodeId) : null;
      const fallbackItem = clipboard.items[clipboard.items.length - 1] ?? clipboard.items[0];
      const targetOwnerNodeId = targetContext?.ownerNode.id ?? fallbackItem.ownerNodeId;
      const targetDeliverableId = targetContext?.deliverable.id ?? fallbackItem.deliverableId;
      const insertionAfterTaskId = targetContext?.task.id ?? null;

      const affectedOwnerIds = new Set<string>([targetOwnerNodeId]);
      if (clipboard.mode === "cut") {
        clipboard.items.forEach((item) => affectedOwnerIds.add(item.ownerNodeId));
      }

      const deliverablesByOwnerId = new Map<string, ODEStructuredDeliverable[]>();
      for (const ownerNodeId of affectedOwnerIds) {
        const ownerNode =
          nodeById.get(ownerNodeId) ?? store.allNodes.find((node) => node.id === ownerNodeId) ?? null;
        if (!ownerNode) return null;
        deliverablesByOwnerId.set(
          ownerNodeId,
          normalizeStructuredDeliverablesForNode(ownerNodeId, ownerNode.properties?.odeStructuredDeliverables)
        );
      }

      if (clipboard.mode === "cut") {
        for (const item of clipboard.items) {
          const deliverables = deliverablesByOwnerId.get(item.ownerNodeId);
          if (!deliverables) continue;
          const deliverableIndex = deliverables.findIndex((deliverable) => deliverable.id === item.deliverableId);
          if (deliverableIndex < 0) continue;
          const deliverable = deliverables[deliverableIndex];
          deliverables[deliverableIndex] = {
            ...deliverable,
            tasks: deliverable.tasks.filter((task) => task.id !== item.task.id)
          };
        }
      }

      const targetDeliverables = deliverablesByOwnerId.get(targetOwnerNodeId);
      if (!targetDeliverables) return null;
      const targetDeliverableIndex = targetDeliverables.findIndex(
        (deliverable) => deliverable.id === targetDeliverableId
      );
      if (targetDeliverableIndex < 0) return null;
      const targetDeliverable = targetDeliverables[targetDeliverableIndex];
      const existingTitleKeys = new Set(
        targetDeliverable.tasks.map((task) => task.title.trim().toLowerCase()).filter((title) => title.length > 0)
      );
      const nextTasksToInsert = clipboard.items.map((item) =>
        clipboard.mode === "cut"
          ? { ...item.task }
          : {
              ...item.task,
              id: createExecutionTaskItemId(),
              title: buildExecutionTaskCopyTitle(item.task.title, existingTitleKeys)
            }
      );
      const targetTasks = [...targetDeliverable.tasks];
      const insertionIndex =
        insertionAfterTaskId === null
          ? targetTasks.length
          : Math.max(0, targetTasks.findIndex((task) => task.id === insertionAfterTaskId) + 1);
      targetTasks.splice(insertionIndex, 0, ...nextTasksToInsert);
      targetDeliverables[targetDeliverableIndex] = {
        ...targetDeliverable,
        tasks: targetTasks
      };

      for (const [ownerNodeId, deliverables] of deliverablesByOwnerId.entries()) {
        await saveExecutionTaskOwnerDeliverables(ownerNodeId, deliverables);
      }

      const taskIdsToSelect = nextTasksToInsert.map((task) => task.id);
      const createdNodeIds = await resolveExecutionTaskProjectionIds(taskIdsToSelect);
      if (createdNodeIds.length === 0) return null;
      await refreshTreeAndKeepContext(
        createdNodeIds[createdNodeIds.length - 1] ?? createdNodeIds[0],
        [targetOwnerNodeId],
        surface
      );
      return {
        createdNodeIds,
        focusNodeId: createdNodeIds[createdNodeIds.length - 1] ?? createdNodeIds[0],
        surface
      };
    },
    [
      buildExecutionTaskCopyTitle,
      nodeById,
      resolveExecutionTaskContext,
      resolveExecutionTaskProjectionIds,
      saveExecutionTaskOwnerDeliverables,
      store.allNodes,
      store.selectedNodeId
    ]
  );

  const duplicateExecutionTaskSelection = useCallback(
    async (
      sourceNodeIds: string[],
      surface: SelectionSurface = "timeline"
    ): Promise<ClipboardMutationResult | null> => {
      if (sourceNodeIds.length === 0) return null;
      const grouped = new Map<
        string,
        {
          ownerNodeId: string;
          deliverableId: string;
          deliverables: ODEStructuredDeliverable[];
          taskIndexes: number[];
        }
      >();

      for (const sourceNodeId of sourceNodeIds) {
        const context = resolveExecutionTaskContext(sourceNodeId);
        if (!context) return null;
        const key = `${context.ownerNode.id}::${context.deliverable.id}`;
        const existing = grouped.get(key);
        if (existing) {
          existing.taskIndexes.push(context.taskIndex);
          continue;
        }
        grouped.set(key, {
          ownerNodeId: context.ownerNode.id,
          deliverableId: context.deliverable.id,
          deliverables: context.deliverables.map((deliverable) => ({
            ...deliverable,
            tasks: deliverable.tasks.map((task) => ({ ...task })),
            notifications: [...deliverable.notifications],
            data: [...deliverable.data]
          })),
          taskIndexes: [context.taskIndex]
        });
      }

      const createdTaskIds: string[] = [];
      for (const entry of grouped.values()) {
        const deliverableIndex = entry.deliverables.findIndex(
          (deliverable) => deliverable.id === entry.deliverableId
        );
        if (deliverableIndex < 0) continue;
        const deliverable = entry.deliverables[deliverableIndex];
        const existingTitleKeys = new Set(
          deliverable.tasks.map((task) => task.title.trim().toLowerCase()).filter((title) => title.length > 0)
        );
        const nextTasks = [...deliverable.tasks];
        const sortedIndexes = [...entry.taskIndexes].sort((left, right) => left - right);
        let insertedCount = 0;
        for (const taskIndex of sortedIndexes) {
          const originalTask = deliverable.tasks[taskIndex];
          if (!originalTask) continue;
          const clonedTask: ODEExecutionTaskItem = {
            ...originalTask,
            id: createExecutionTaskItemId(),
            title: buildExecutionTaskCopyTitle(originalTask.title, existingTitleKeys)
          };
          const insertionIndex = Math.min(nextTasks.length, taskIndex + 1 + insertedCount);
          nextTasks.splice(insertionIndex, 0, clonedTask);
          createdTaskIds.push(clonedTask.id);
          insertedCount += 1;
        }
        entry.deliverables[deliverableIndex] = {
          ...deliverable,
          tasks: nextTasks
        };
        await saveExecutionTaskOwnerDeliverables(entry.ownerNodeId, entry.deliverables);
      }

      const createdNodeIds = await resolveExecutionTaskProjectionIds(createdTaskIds);
      if (createdNodeIds.length === 0) return null;
      const focusNodeId = createdNodeIds[createdNodeIds.length - 1] ?? createdNodeIds[0];
      const expandOwnerIds = Array.from(
        new Set(Array.from(grouped.values(), (entry) => entry.ownerNodeId))
      );
      await refreshTreeAndKeepContext(focusNodeId, expandOwnerIds, surface);
      return {
        createdNodeIds,
        focusNodeId,
        surface
      };
    },
    [
      buildExecutionTaskCopyTitle,
      refreshTreeAndKeepContext,
      resolveExecutionTaskContext,
      resolveExecutionTaskProjectionIds,
      saveExecutionTaskOwnerDeliverables
    ]
  );

  const saveProcedureNodeWorkstreamWorkspace = useCallback(
    async (
      nodeId: string,
      payload: {
        description: string | null;
        objective: string | null;
        deliverables: ODEStructuredDeliverable[];
        workspace: ODEWorkstreamWorkspace;
        workspaces?: ODEWorkstreamWorkspace[];
      }
    ) => {
      const currentNode = store.allNodes.find((node) => node.id === nodeId) ?? null;
      const nextDescription = payload.description?.trim() || null;
      const descriptionChanged = (currentNode?.description ?? null) !== nextDescription;
      const workspaceInputs = payload.workspaces && payload.workspaces.length > 0 ? payload.workspaces : [payload.workspace];
      const nextWorkspaceCollection = workspaceInputs.reduce(
        (collection, workspace) =>
          upsertWorkstreamWorkspaceCollection(
            collection,
            workspace
          ),
        currentNode?.properties?.[ODE_WORKSTREAM_WORKSPACE_PROPERTY] as unknown
      );

      const operations: Promise<void>[] = [
        saveProcedureNodeMeaning(
          nodeId,
          {
            objective: payload.objective,
            deliverables: payload.deliverables
          },
          {
            extraProperties: {
              [ODE_WORKSTREAM_WORKSPACE_PROPERTY]: nextWorkspaceCollection
            }
          }
        )
      ];

      if (descriptionChanged) {
        operations.push(saveProcedureNodeDescription(nodeId, nextDescription));
      }

      await Promise.all(operations);
    },
    [saveProcedureNodeDescription, saveProcedureNodeMeaning, store.allNodes]
  );

  const renameProcedureNodeTitle = useCallback(
    async (nodeId: string, title: string) => {
      const nextTitle = title.trim();
      if (!nextTitle) return;
      if (!ensureStructureMutationAllowed([nodeId])) return;
      await renameNode(nodeId, nextTitle);
      store.patchNode(nodeId, {
        name: nextTitle,
        updatedAt: Date.now()
      });
    },
    [ensureStructureMutationAllowed, store]
  );

  const createProcedureDocumentItem = useCallback(
    async (
      anchorNodeId: string,
      kind: "section" | "text" | "field" | "table" | "attachment",
      position: "after" | "inside"
    ) => {
      const anchor = store.allNodes.find((item) => item.id === anchorNodeId) ?? null;
      if (!anchor) return null;

      const procedureRootId = procedureRootNode?.id ?? null;
      const canInsertInside = position === "inside" && !isFileLikeNode(anchor);
      const parentId = canInsertInside
        ? anchor.id
        : anchor.id === procedureRootId
          ? anchor.id
          : anchor.parentId === ROOT_PARENT_ID
            ? null
            : anchor.parentId;
      const siblingParentKey =
        canInsertInside || anchor.id === procedureRootId ? anchor.id : anchor.parentId;
      const siblings = byParent.get(siblingParentKey) ?? [];
      const afterId = canInsertInside
        ? siblings.length > 0
          ? siblings[siblings.length - 1].id
          : null
        : anchor.id === procedureRootId
          ? siblings.length > 0
            ? siblings[siblings.length - 1].id
            : null
          : anchor.id;

      const titles: Record<typeof kind, string> = {
        section: "New Section",
        text: "New Text",
        field: "New Field",
        table: "New Table",
        attachment: "New Attachment"
      };
      const newNodeId = await createNewTopicNode(parentId, "tree", {
        initialText: titles[kind],
        expandNodeIds: [parentId ?? ROOT_PARENT_ID],
        repositionAfterId: afterId,
        reposition: Boolean(afterId) || !canInsertInside,
        startInlineEdit: false,
        commitInitialText: true
      });
      if (!newNodeId) return null;

      const nextProperties: Record<string, unknown> = {
        odeProcedureItemType: kind === "table" ? "field" : kind
      };
      if (kind === "field") {
        nextProperties.odeProcedureFieldType = "short_text";
        nextProperties.odeProcedureShowInMasterList = true;
      }
      if (kind === "table") {
        nextProperties.odeProcedureFieldType = "table";
        nextProperties.odeProcedureShowInMasterList = true;
        nextProperties.odeProcedureOptions = ["Column 1", "Column 2"];
        nextProperties.odeProcedureTableRows = [["", ""]];
      }
      await saveProcedureNodeProperties(newNodeId, nextProperties);
      setPrimarySelection(newNodeId, "tree");
      setSelectionSurface("tree");
      setKeyboardSurface("procedure");
      return newNodeId;
    },
    [byParent, createNewTopicNode, procedureRootNode?.id, saveProcedureNodeProperties, store.allNodes]
  );

  const attachPickedFilesToProcedureNode = useCallback(
    async (nodeId: string, mode: "all" | "images") => {
      if (!isDesktopRuntime) return 0;
      if (!ensureStructureMutationAllowed([nodeId], { scope: "content" })) return 0;
      const targetNode = nodeById.get(nodeId) ?? null;
      if (!targetNode || isFileLikeNode(targetNode)) return 0;

      try {
        const picked = await pickWindowsFilesForImport();
        const dedupe = new Set<string>();
        const cleaned = picked
          .map((path) => normalizeFilePathToken(path) ?? path.trim())
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
          .filter((path) => {
            const key = path.toLowerCase();
            if (dedupe.has(key)) return false;
            dedupe.add(key);
            return true;
          });
        const filtered =
          mode === "images"
            ? cleaned.filter((path) => IMAGE_PREVIEW_EXTENSIONS.has(extractFileExtensionLower(path)))
            : cleaned;
        if (filtered.length === 0) return 0;

        const created = await importFilesToNode(nodeId, filtered);
        if (created.length === 0) return 0;

        await refreshTreeAndKeepContext(nodeId, [nodeId], "tree");
        setPrimarySelection(nodeId, "tree");
        setSelectionSurface("tree");
        setKeyboardSurface("procedure");
        setProjectError(null);
        return created.length;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        setProjectNotice(null);
        setProjectError(t("share.import_failed", { reason }));
        return 0;
      }
    },
    [
      ensureStructureMutationAllowed,
      isDesktopRuntime,
      nodeById,
      refreshTreeAndKeepContext,
      t
    ]
  );

  const attachFilesToProcedureNode = useCallback(
    async (nodeId: string) => attachPickedFilesToProcedureNode(nodeId, "all"),
    [attachPickedFilesToProcedureNode]
  );

  const attachImagesToProcedureNode = useCallback(
    async (nodeId: string) => attachPickedFilesToProcedureNode(nodeId, "images"),
    [attachPickedFilesToProcedureNode]
  );

  const deleteProcedureDocumentNode = useCallback(
    async (nodeId: string) => {
      if (!ensureStructureMutationAllowed([nodeId])) return false;
      const targetNode = nodeById.get(nodeId) ?? null;
      if (!targetNode) return false;

      const fallbackFocusId = targetNode.parentId === ROOT_PARENT_ID ? null : targetNode.parentId;
      await deleteNodeWithExecutionSync(nodeId);
      await refreshTreeAndKeepContext(
        fallbackFocusId ?? undefined,
        fallbackFocusId ? [fallbackFocusId] : [],
        "tree"
      );
      if (fallbackFocusId) {
        setPrimarySelection(fallbackFocusId, "tree");
      }
      setSelectionSurface("tree");
      setKeyboardSurface("procedure");
      return true;
    },
    [deleteNodeWithExecutionSync, ensureStructureMutationAllowed, nodeById, refreshTreeAndKeepContext]
  );

  const createSiblingNode = async (
    nodeId: string,
    insertBefore: boolean,
    surface: SelectionSurface = selectionSurface
  ) => {
    const resolvedSurface = resolveEffectiveCreationSurfaceForWorkspace(surface, workspaceMode);
    const selected = store.allNodes.find((item) => item.id === nodeId);
    if (!selected) return;
    if (
      !ensureStructureMutationAllowed([selected.id], {
        scope: workspaceFocusMode === "execution" ? "workarea" : "organization"
      })
    ) {
      return;
    }
    if (resolvedSurface === "timeline" && getExecutionTaskMeta(selected)) {
      await createExecutionTaskRelative(selected.id, {
        insertBefore,
        startInlineEdit: true
      });
      return;
    }
    if (workspaceFocusMode === "execution" && !isWorkareaItemNode(selected) && !isFileLikeNode(selected)) {
      await createNewTopicNode(selected.id, resolvedSurface, {
        expandNodeIds: [selected.id]
      });
      return;
    }

    // In a scoped workspace, the visible project root has no visible siblings.
    // Treat Enter on that root as top-level branch creation inside the workspace.
    if (activeProjectRootId && selected.id === activeProjectRootId) {
      const existingChildren = byParent.get(selected.id) ?? [];
      const anchorAfterId = insertBefore
        ? null
        : existingChildren.length > 0
          ? existingChildren[existingChildren.length - 1].id
          : null;
      await createNewTopicNode(selected.id, resolvedSurface, {
        expandNodeIds: [selected.id],
        repositionAfterId: anchorAfterId,
        reposition: insertBefore || anchorAfterId !== null
      });
      return;
    }

    const parentId = selected.parentId === ROOT_PARENT_ID ? null : selected.parentId;
    const siblings = byParent.get(selected.parentId) ?? [];
    const selectedIndex = siblings.findIndex((item) => item.id === selected.id);
    const previousSiblingId = selectedIndex > 0 ? siblings[selectedIndex - 1].id : null;
    const selectedIsProcedureField =
      desktopViewModeRef.current === "procedure" &&
      (selected.properties?.odeProcedureItemType === "field" ||
        (typeof selected.properties?.odeProcedureFieldType === "string" &&
          selected.properties.odeProcedureFieldType.trim().length > 0));

    const afterId = insertBefore ? previousSiblingId : selected.id;
    const newNodeId = await createNewTopicNode(parentId, resolvedSurface, {
      expandNodeIds: [selected.parentId],
      repositionAfterId: afterId,
      reposition: true
    });
    if (selectedIsProcedureField && newNodeId) {
      await saveProcedureNodeProperties(newNodeId, {
        odeProcedureItemType: "field",
        odeProcedureFieldType: "short_text",
        odeProcedureShowInMasterList: true
      });
    }
  };

  const createChildNode = async (
    nodeId: string,
    surface: SelectionSurface = selectionSurface,
    initialText?: string,
    options?: {
      startInlineEdit?: boolean;
      commitInitialText?: boolean;
    }
  ) => {
    const resolvedSurface = resolveEffectiveCreationSurfaceForWorkspace(surface, workspaceMode);
    const selectedNode = store.allNodes.find((item) => item.id === nodeId) ?? null;
    if (
      !ensureStructureMutationAllowed([nodeId], {
        scope: workspaceFocusMode === "execution" ? "workarea" : "organization"
      })
    ) {
      return;
    }
    if (resolvedSurface === "timeline" && selectedNode && getExecutionTaskMeta(selectedNode)) {
      await createExecutionTaskRelative(selectedNode.id, {
        initialText,
        startInlineEdit: options?.startInlineEdit ?? true
      });
      return;
    }
    const selected = resolveStructuralCreationTargetNode(selectedNode, resolveExecutionOwnerNode);
    if (!selected) return;

    if (desktopViewModeRef.current === "procedure") {
      const isProcedureField =
        selected.properties?.odeProcedureItemType === "field" ||
        (typeof selected.properties?.odeProcedureFieldType === "string" &&
          selected.properties.odeProcedureFieldType.trim().length > 0);
      if (isProcedureField) {
        const parentId = selected.parentId === ROOT_PARENT_ID ? null : selected.parentId;
        const newNodeId = await createNewTopicNode(parentId, resolvedSurface, {
          initialText,
          expandNodeIds: selected.parentId ? [selected.parentId] : [],
          repositionAfterId: selected.id,
          reposition: true,
          startInlineEdit: options?.startInlineEdit,
          commitInitialText: options?.commitInitialText
        });
        if (newNodeId) {
          await saveProcedureNodeProperties(newNodeId, {
            odeProcedureItemType: "field",
            odeProcedureFieldType: "short_text",
            odeProcedureShowInMasterList: true
          });
        }
        return;
      }
    }

    if (isFileLikeNode(selected)) {
      const parentId = selected.parentId === ROOT_PARENT_ID ? null : selected.parentId;
      const newNodeId = await createNewTopicNode(parentId, resolvedSurface, {
        initialText,
        expandNodeIds: [selected.parentId],
        repositionAfterId: selected.id,
        reposition: true,
        startInlineEdit: options?.startInlineEdit,
        commitInitialText: options?.commitInitialText
      });
      if (desktopViewModeRef.current === "procedure" && newNodeId) {
        await saveProcedureNodeProperties(newNodeId, {
          odeProcedureItemType: "field",
          odeProcedureFieldType: "short_text",
          odeProcedureShowInMasterList: true
        });
      }
      return;
    }

    const newNodeId = await createNewTopicNode(selected.id, resolvedSurface, {
      initialText,
      expandNodeIds: [selected.id],
      startInlineEdit: options?.startInlineEdit,
      commitInitialText: options?.commitInitialText
    });
    if (desktopViewModeRef.current === "procedure" && newNodeId) {
      await saveProcedureNodeProperties(newNodeId, {
        odeProcedureItemType: "field",
        odeProcedureFieldType: "short_text",
        odeProcedureShowInMasterList: true
      });
    }
  };

  const createParentNode = async (nodeId: string, surface: SelectionSurface = selectionSurface) => {
    const selected = resolveStructuralCreationTargetNode(
      store.allNodes.find((item) => item.id === nodeId) ?? null,
      resolveExecutionOwnerNode
    );
    if (!selected) return;
    if (
      !ensureStructureMutationAllowed([selected.id], {
        scope: workspaceFocusMode === "execution" ? "workarea" : "organization"
      })
    ) {
      return;
    }
    if (workspaceFocusMode === "execution" && !isWorkareaItemNode(selected) && !isFileLikeNode(selected)) {
      await createNewTopicNode(selected.id, surface, {
        expandNodeIds: [selected.id]
      });
      return;
    }

    const oldParentId = selected.parentId === ROOT_PARENT_ID ? null : selected.parentId;
    const siblings = byParent.get(selected.parentId) ?? [];
    const selectedIndex = siblings.findIndex((item) => item.id === selected.id);
    const previousSiblingId = selectedIndex > 0 ? siblings[selectedIndex - 1].id : null;
    const shouldCreateWorkareaItem = workspaceFocusMode === "execution";
    const workareaParentNode =
      oldParentId !== null
        ? nodeById.get(oldParentId) ?? store.allNodes.find((node) => node.id === oldParentId) ?? null
        : null;
    const workareaKind = shouldCreateWorkareaItem
      ? resolveWorkareaItemKindForParent(workareaParentNode, nodeById)
      : null;
    const siblingTitles =
      shouldCreateWorkareaItem && oldParentId !== null
        ? siblings.filter((item) => isWorkareaItemNode(item)).map((item) => item.name)
        : [];
    const initialInlineText =
      shouldCreateWorkareaItem && workareaKind
        ? ""
        : "";
    const fallbackWorkareaTitle =
      shouldCreateWorkareaItem && workareaKind
        ? buildIndexedWorkareaTitle(getWorkareaBaseLabel(workareaKind), siblingTitles)
        : "";
    const newParent = await createNode(
      oldParentId,
      shouldCreateWorkareaItem ? fallbackWorkareaTitle : t("node.new_parent"),
      "folder"
    );
    if (shouldCreateWorkareaItem) {
      const nextProperties: Record<string, unknown> = {
        ...(newParent.properties ?? {}),
        odeWorkareaItem: true,
        odeWorkareaItemKind: workareaKind ?? "deliverable"
      };
      await updateNodeProperties(newParent.id, nextProperties);
      store.patchNode(newParent.id, {
        properties: nextProperties,
        updatedAt: Date.now()
      });
    }
    primeInlineEditState(newParent.id, initialInlineText, surface);
    await moveNode(newParent.id, oldParentId, previousSiblingId);
    await moveNode(selected.id, newParent.id, null);
    await refreshTreeAndKeepContext(newParent.id, [newParent.id, selected.parentId], surface);
  };

  const selectFromSearch = async (nodeId: string) => {
    const target = nodeById.get(nodeId);
    if (!target) return;
    if (workspaceMode === "grid" && workspaceFocusMode === "execution") {
      await openNodeInWorkarea(nodeId);
      store.setSearchQuery("");
      setSearchActiveIndex(0);
      setSearchDropdownOpen(false);
      return;
    }
    if (workspaceMode === "grid") {
      clearActiveDesktopNodeTab();
      activateDesktopGridBrowseSurface();
    }
    const browseTargetId =
      workspaceMode === "grid"
        ? isFileLikeNode(target)
          ? resolveSearchResultNavigationParentId(target)
          : target.id
        : resolveSearchResultNavigationParentId(target);
    await store.navigateTo(browseTargetId);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      for (const ancestorId of collectAncestorNodeIds(nodeId, nodeById)) {
        next.add(ancestorId);
      }
      return next;
    });
    const preferredSurface = resolveSearchResultSelectionSurface(workspaceMode, target);
    setPrimarySelection(nodeId, preferredSurface);
    store.setSearchQuery("");
    setSearchActiveIndex(0);
    setSearchDropdownOpen(false);
  };

  const openQuickAccessNode = async (nodeId: string) => {
    const node = nodeById.get(nodeId);
    if (!node) return;
    await browseTreeNodeInGrid(nodeId);
  };

  const isNodeInSubtree = (ancestorId: string, candidateId: string): boolean => {
    if (ancestorId === candidateId) return true;
    const stack = [...(byParent.get(ancestorId) ?? []).map((item) => item.id)];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;
      if (current === candidateId) return true;
      const children = byParent.get(current) ?? [];
      for (const child of children) {
        stack.push(child.id);
      }
    }
    return false;
  };

  const {
    moveWorkspaceModalOpen,
    moveWorkspaceSourceNodeIds,
    moveWorkspaceTargetProjectId,
    setMoveWorkspaceTargetProjectId,
    closeMoveWorkspaceModal,
    moveBranchToWorkspace,
    openMoveToWorkspaceModal
  } = useMoveWorkspaceActions({
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
  });
  const hasBlockingOverlayOpenWithMove = hasBlockingOverlayOpen || moveWorkspaceModalOpen;
  const moveWorkspaceTargetProjects = useMemo(
    () =>
      projects.filter(
        (project) =>
          moveWorkspaceSourceNodeIds.every((sourceId) => project.rootNodeId !== sourceId) &&
          moveWorkspaceSourceNodeIds.every((sourceId) => !isNodeInSubtree(sourceId, project.rootNodeId))
      ),
    [projects, moveWorkspaceSourceNodeIds, isNodeInSubtree]
  );
  const moveWorkspaceSourceLabel = useMemo(() => {
    if (moveWorkspaceSourceNodeIds.length === 0) return "";
    return moveWorkspaceSourceNodeIds
      .map((id) => nodeById.get(id)?.name ?? id)
      .join(", ");
  }, [moveWorkspaceSourceNodeIds, nodeById]);

  useEffect(() => {
    if (!AI_COMMAND_BAR_ENABLED) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const isToggleShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      if (!isToggleShortcut) return;
      if (hasBlockingOverlayOpenWithMove) return;
      event.preventDefault();
      setCommandBarOpen((prev) => !prev);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [hasBlockingOverlayOpenWithMove]);

  useEffect(() => {
    if (!commandBarOpen) return;
    setContextMenu(null);
    setSearchDropdownOpen(false);
  }, [commandBarOpen]);

  const {
    copySelectedBranch,
    pasteClipboardBranch,
    duplicateSelectedBranch
  } = useBranchClipboardActions({
    t,
    selectedNode,
    nodeById,
    byParent,
    currentFolderId: store.currentFolderId,
    activeProjectRootId,
    isDesktopRuntime,
    branchClipboard,
    setBranchClipboard,
    isNodeInSubtree,
    setSelectionFromIds,
    resolveBranchSourceIds: (sourceNodeId, surface) =>
      resolveSelectedActionNodeIds(sourceNodeId, surface ?? selectionSurface, { filterDescendants: true }),
    beginInlineEdit,
    refreshTreeAndKeepContext,
    writeBranchClipboardToSystem,
    readBranchClipboardFromSystem,
    clearBranchClipboardFromSystem,
    pasteExternalFilesFromClipboard,
    buildCopyNameWithSuffix,
    ensureStructureMutationAllowed,
    buildSpecialClipboard: buildExecutionTaskClipboard,
    pasteSpecialClipboard: pasteExecutionTaskClipboard,
    duplicateSpecialNodes: duplicateExecutionTaskSelection
  });

  const pasteClipboardContent = async (
    targetNodeId?: string | null,
    surface: SelectionSurface = selectionSurface,
    options?: {
      clipboardData?: DataTransfer | null;
      rawText?: string | null;
    }
  ) => {
    const clipboardData = options?.clipboardData ?? null;
    const eventFilePaths = collectExternalFileDropPaths(clipboardData);
    if (eventFilePaths.length > 0) {
      const handledEventFiles = await importExternalFilesToNode(eventFilePaths, targetNodeId, surface);
      if (handledEventFiles) return;
    }

    if (eventFilePaths.length === 0) {
      const handledExternalFiles = await pasteExternalFilesFromClipboard(targetNodeId, surface);
      if (handledExternalFiles) return;
    }

    const clipboardText =
      options?.rawText ?? readClipboardDataPlainText(clipboardData) ?? "";
    const raw = clipboardText || (await readSystemClipboardText());
    if (raw && parseBranchClipboard(raw)) {
      await pasteClipboardBranch(targetNodeId, surface);
      return;
    }

    const plainText = raw.replace(/\r\n/g, "\n").trim();
    if (plainText) {
      const resolvedTargetNodeId = targetNodeId === undefined ? store.selectedNodeId ?? null : targetNodeId;
      if (resolvedTargetNodeId) {
        await createChildNode(resolvedTargetNodeId, surface, plainText, {
          startInlineEdit: false,
          commitInitialText: true
        });
        return;
      }

      await createSurfaceDefaultTopic(surface, plainText, {
        startInlineEdit: false,
        commitInitialText: true
      });
      return;
    }

    await pasteClipboardBranch(targetNodeId, surface);
  };

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (hasBlockingOverlayOpenWithMove || commandBarOpen) return;
      if (
        shouldIgnoreGlobalClipboardTarget(event.target) ||
        shouldIgnoreGlobalClipboardTarget(document.activeElement)
      ) {
        return;
      }
      event.preventDefault();
      void pasteClipboardContent(store.selectedNodeId ?? undefined, selectionSurface, {
        clipboardData: event.clipboardData,
        rawText: readClipboardDataPlainText(event.clipboardData)
      });
    };

    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("paste", onPaste);
    };
  }, [
    commandBarOpen,
    hasBlockingOverlayOpenWithMove,
    pasteClipboardContent,
    selectionSurface,
    store.selectedNodeId
  ]);

  const createTopicFromContext = async (
    targetNodeId: string | null,
    surface: SelectionSurface
  ) => {
    const resolvedSurface = resolveEffectiveCreationSurfaceForWorkspace(surface, workspaceMode);
    if (targetNodeId) {
      await createChildNode(targetNodeId, resolvedSurface);
      return;
    }
    if (workspaceFocusMode === "execution") {
      const parentId = resolveWorkareaCreationParentNodeId(resolvedSurface);
      if (parentId) {
        await createNewTopicNode(parentId, resolvedSurface, {
          expandNodeIds: [parentId]
        });
        return;
      }
    }

    await createSurfaceDefaultTopic(resolvedSurface);
  };

  const resolveTreeMoveSelectionIds = (sourceNodeId: string) =>
    resolveSelectedActionNodeIds(sourceNodeId, "tree", { filterDescendants: true });

  const resolveTreeMoveInPlans = (sourceNodeId: string) =>
    resolveTreeMoveInPlansState({
      selectedNodeIds: resolveTreeMoveSelectionIds(sourceNodeId),
      nodeById,
      byParent,
      workspaceRootIdSet
    });

  const resolveTreeMoveOutPlans = (sourceNodeId: string) =>
    resolveTreeMoveOutPlansState({
      selectedNodeIds: resolveTreeMoveSelectionIds(sourceNodeId),
      nodeById,
      byParent,
      workspaceRootIdSet
    });

  const canMoveTreeSelectionIn = (sourceNodeId: string) =>
    resolveTreeMoveInPlans(sourceNodeId).length > 0;

  const canMoveTreeSelectionOut = (sourceNodeId: string) =>
    resolveTreeMoveOutPlans(sourceNodeId).length > 0;

  const moveTreeNodeIn = async (nodeId: string, surface: SelectionSurface = "tree") => {
    if (surface !== "tree") return;
    const plans = resolveTreeMoveInPlans(nodeId);
    if (plans.length === 0) return;
    if (
      !ensureStructureMutationAllowed(
        plans.flatMap((plan) => [plan.nodeId, plan.target.newParentId])
      )
    ) {
      return;
    }
    const movedNodeIds: string[] = [];
    const ensureExpandedIds = new Set<string>();

    for (const plan of plans) {
      await moveNode(plan.nodeId, plan.target.newParentId, plan.target.afterId);
      movedNodeIds.push(plan.nodeId);
      plan.target.ensureExpandedIds.forEach((id) => ensureExpandedIds.add(id));
      ensureExpandedIds.add(plan.target.newParentId);
    }

    if (movedNodeIds.length === 0) return;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      ensureExpandedIds.forEach((id) => next.add(id));
      return next;
    });
    await refreshTreeAndKeepContext(
      movedNodeIds[0],
      Array.from(ensureExpandedIds),
      surface
    );
    setSelectionFromIds(movedNodeIds, movedNodeIds[0], surface);
  };

  const moveTreeNodeOut = async (nodeId: string, surface: SelectionSurface = "tree") => {
    if (surface !== "tree") return;
    const sourceNodeIds = resolveTreeMoveSelectionIds(nodeId);
    if (sourceNodeIds.length === 0) return;
    const plans = resolveTreeMoveOutPlans(nodeId);
    if (plans.length === 0) return;
    if (
      !ensureStructureMutationAllowed(
        plans.flatMap((plan) => [plan.nodeId, plan.target.newParentId])
      )
    ) {
      return;
    }
    const movedNodeIds: string[] = [];
    const ensureExpandedIds = new Set<string>();

    for (const plan of plans) {
      await moveNode(plan.nodeId, plan.target.newParentId, plan.target.afterId);
      movedNodeIds.push(plan.nodeId);
      plan.target.ensureExpandedIds.forEach((id) => ensureExpandedIds.add(id));
    }

    if (movedNodeIds.length === 0) return;
    const orderedMovedIds = resolveMovedTreeSelectionIds(sourceNodeIds, movedNodeIds);
    await refreshTreeAndKeepContext(
      orderedMovedIds[0] ?? movedNodeIds[0],
      Array.from(ensureExpandedIds),
      surface
    );
    setSelectionFromIds(orderedMovedIds, orderedMovedIds[0] ?? null, surface);
  };

  const { runContextMenuAction } = useContextMenuActions({
    contextMenu,
    selectedNodeId: store.selectedNodeId,
    closeContextMenu,
    setPrimarySelection,
    openScheduleModal,
    onCreateTopicFromContext: createTopicFromContext,
    onCreateTimelineTaskRelative: async (targetNodeId, options) => {
      await createExecutionTaskRelative(targetNodeId, {
        insertBefore: options.insertBefore,
        startInlineEdit: true
      });
    },
    onMoveTimelineTask: async (targetNodeId, direction) => {
      const sourceNodeIds = resolveSelectedActionNodeIds(targetNodeId, "timeline", { filterDescendants: true });
      await moveExecutionTaskSelection(sourceNodeIds, direction);
    },
    onMoveNodeIn: moveTreeNodeIn,
    onMoveNodeOut: moveTreeNodeOut,
    onPasteBranch: pasteClipboardContent,
    onMoveToWorkspace: openMoveToWorkspaceModal,
    onDistributeToNAWorkspace: openNADistributionModal,
    onImportPackage: importNodeBranchPackage,
    onExportPackage: exportNodeBranchPackage,
    onOpenFileNode: openFileNode,
    onOpenFileNodeWith: openFileNodeWith,
    onOpenFileNodeLocation: openFileNodeLocation,
    onCopyFileNodeFullPath: copyFileNodeFullPath,
    onSetNodeWorkareaOwner: setNodeWorkareaOwner,
    onAddWorkareaDeliverable: addWorkareaDeliverable,
    onAddWorkareaTask: addWorkareaTask,
    onOpenWorkarea: async (ownerNodeId, deliverableId) => {
      await openNodeInWorkarea(ownerNodeId, {
        deliverableId,
        openExecution: Boolean(deliverableId)
      });
    },
    onDeleteWorkareaDeliverable: deleteWorkareaDeliverable,
    onOpenQuickAccessNode: openQuickAccessNode,
    onPreviewFileNode: setMindMapReviewNodeId,
    onCopySelectedBranch: copySelectedBranch,
    onDuplicateSelectedBranch: duplicateSelectedBranch,
    onToggleFavoriteNode: toggleFavoriteNode,
    onToggleFavoriteNodeGroup: toggleFavoriteGroupForSelection,
    onAssignFavoriteNodeGroup: assignFavoriteNodeToGroup,
    onRemoveQuickAccessNode: removeNodeFromQuickAccess,
    onCreateFavoriteGroup: createFavoriteGroup,
    onSelectFavoriteGroup: (groupId) => {
      void handleFavoriteGroupClick(groupId);
    },
    onDeleteFavoriteGroup: deleteFavoriteGroup,
    onDeleteSelectedNodes: async (sourceNodeId, surface) => {
      await removeSelectedNodes({ confirm: true, sourceNodeId, surface });
    },
    onSetNodeStructureLocked: setNodeStructureLocked
  });

  const activeKeyboardSelectionSurface = resolveSelectionSurfaceForKeyboardSurface(
    keyboardSurface,
    selectionSurface
  );
  const keyboardCreationSurface = resolveKeyboardCreationSurface({
    keyboardSurface,
    workspaceMode,
    selectionSurface
  });
  const assistantOverlayOpen =
    (AI_COMMAND_BAR_ENABLED && commandBarOpen) ||
    documentAdvisorOpen ||
    Boolean(assistantDeliverableProposalState) ||
    Boolean(assistantIntegratedPlanProposalState);

  useKeyboardShortcuts({
    hasBlockingOverlayOpen: hasBlockingOverlayOpenWithMove || assistantOverlayOpen,
    contextMenuOpen: Boolean(contextMenu),
    editingNodeId,
    branchClipboardPresent: Boolean(branchClipboard),
    selectedNodeId: store.selectedNodeId,
    currentFolderId: store.currentFolderId,
    displayedTreeRows,
    displayedTreeIndexById,
    timelineRows: displayedTimelineRows,
    displayedTimelineIndexById,
    displayedGridIndexById,
    gridNodes: desktopGridNodes,
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
    favoriteGroupFilteringActive: selectedFavoriteGroupFilterIds.length > 0,
    onSetBranchClipboardEmpty: () => {
      setBranchClipboard(null);
      setCanPasteBranch(false);
      void clearBranchClipboardFromSystem();
    },
    onSetSelectedNodeId: store.setSelectedNodeId,
    onSetSelectedNodeIds: setSelectedNodeIds,
    onSetSelectionAnchorId: setSelectionAnchorId,
    onSetSelectionSurface: setSelectionSurface,
    onSetExpandedIds: setExpandedIds,
    onSetPrimarySelection: setPrimarySelection,
    onCopySelectedBranch: copySelectedBranch,
    onPasteClipboardBranch: pasteClipboardContent,
    onDuplicateSelectedBranch: duplicateSelectedBranch,
    onNavigateUpOneFolder: navigateUpOneFolder,
    onOpenFolder: openFolder,
    onOpenFileNode: openFileNode,
    onBeginInlineEdit: beginInlineEdit,
    onCreateNodeWithoutSelection: async (initialText?: string) => {
      if (documentationModeActive) {
        const targetNodeId = procedureSelectedNode?.id ?? procedureRootNode?.id ?? null;
        if (targetNodeId) {
          await createChildNode(targetNodeId, activeKeyboardSelectionSurface, initialText);
          return;
        }
      }
      await createSurfaceDefaultTopic(keyboardCreationSurface, initialText);
    },
    onCreateChildNode: async (nodeId) => {
      await createChildNode(nodeId, activeKeyboardSelectionSurface);
    },
    onCreateProcedureSectionNode: async (nodeId) => {
      if (documentationModeActive) {
        await createProcedureDocumentItem(nodeId, "section", "inside");
        return;
      }
      await createSiblingNode(nodeId, false, activeKeyboardSelectionSurface);
    },
    onCreateParentNode: async (nodeId) => {
      await createParentNode(nodeId, activeKeyboardSelectionSurface);
    },
    onCreateSiblingNode: async (nodeId, insertBefore) => {
      await createSiblingNode(nodeId, insertBefore, activeKeyboardSelectionSurface);
    },
    onMoveTimelineTaskUp: async (nodeId) => {
      const sourceNodeIds = resolveSelectedActionNodeIds(nodeId, "timeline", { filterDescendants: true });
      await moveExecutionTaskSelection(sourceNodeIds, "up");
    },
    onMoveTimelineTaskDown: async (nodeId) => {
      const sourceNodeIds = resolveSelectedActionNodeIds(nodeId, "timeline", { filterDescendants: true });
      await moveExecutionTaskSelection(sourceNodeIds, "down");
    },
    onMoveNodeIn: moveTreeNodeIn,
    onMoveNodeOut: moveTreeNodeOut,
    onRemoveSelectedNodes: removeSelectedNodes,
    onMoveToWorkspace: openMoveToWorkspaceModal,
    onToggleFavoriteNode: toggleFavoriteNode,
    onOpenFavoriteGroupAssign: assignFavoriteNodeToGroup,
    onToggleFavoriteGroup: toggleFavoriteGroupForSelection
  });

  const moveNodeToParent = async (
    sourceId: string,
    newParentId: string | null,
    afterId: string | null,
    surface: SelectionSurface = "tree"
  ) => {
    const dragged = nodeById.get(sourceId);
    if (!dragged) return;
    const moveMutationScope: WorkspaceStructureMutationScope = isWorkareaItemNode(dragged)
      ? "workarea"
      : isFileLikeNode(dragged)
        ? "content"
        : "organization";
    if (!ensureStructureMutationAllowed([sourceId, newParentId], { scope: moveMutationScope })) return;
    if (isHiddenExecutionTaskNode(dragged)) {
      reportExecutionProjectionMoveBlocked();
      return;
    }
    const targetParentNode = newParentId ? nodeById.get(newParentId) ?? null : null;
    if (isHiddenExecutionTaskNode(targetParentNode)) {
      reportExecutionProjectionMoveBlocked();
      return;
    }
    const afterNode = afterId ? nodeById.get(afterId) ?? null : null;
    if (isHiddenExecutionTaskNode(afterNode)) {
      reportExecutionProjectionMoveBlocked();
      return;
    }
    if (newParentId && isNodeInSubtree(sourceId, newParentId)) return;

    await moveNode(sourceId, newParentId, afterId);
    await refreshTreeAndKeepContext(sourceId, [dragged.parentId, newParentId ?? ROOT_PARENT_ID]);
    setPrimarySelection(sourceId, surface);
  };

  const applyDropMove = async (
    sourceId: string,
    targetId: string,
    position: DropPosition,
    surface: SelectionSurface = "tree"
  ) => {
    if (sourceId === targetId && targetId !== ROOT_PARENT_ID) return;
    const sourceNode = nodeById.get(sourceId) ?? null;
    if (isHiddenExecutionTaskNode(sourceNode)) {
      reportExecutionProjectionMoveBlocked();
      return;
    }
    const targetNode = targetId === ROOT_PARENT_ID ? null : nodeById.get(targetId) ?? null;
    if (isHiddenExecutionTaskNode(targetNode)) {
      reportExecutionProjectionMoveBlocked();
      return;
    }

    if (targetId === ROOT_PARENT_ID) {
      const roots = (byParent.get(ROOT_PARENT_ID) ?? []).filter((node) => node.id !== sourceId);
      const afterRootId = roots.length > 0 ? roots[roots.length - 1].id : null;
      await moveNodeToParent(sourceId, null, afterRootId, surface);
      return;
    }

    const target = nodeById.get(targetId);
    if (!target) return;
    const normalizedPosition = position === "inside" && target.type !== "folder" ? "after" : position;

    let newParentId: string | null = null;
    let afterId: string | null = null;

    if (normalizedPosition === "inside") {
      if (isNodeInSubtree(sourceId, targetId)) return;
      newParentId = target.id;
      const children = (byParent.get(target.id) ?? []).filter((child) => child.id !== sourceId);
      afterId = children.length > 0 ? children[children.length - 1].id : null;
    } else {
      const parentKey = target.parentId;
      newParentId = parentKey === ROOT_PARENT_ID ? null : parentKey;
      if (newParentId && isNodeInSubtree(sourceId, newParentId)) return;
      const siblings = (byParent.get(parentKey) ?? []).filter((item) => item.id !== sourceId);
      const targetIndex = siblings.findIndex((item) => item.id === target.id);
      if (normalizedPosition === "before") {
        afterId = targetIndex > 0 ? siblings[targetIndex - 1].id : null;
      } else {
        afterId = target.id;
      }
    }

    await moveNodeToParent(sourceId, newParentId, afterId, surface);
  };

  const detectDropPosition = (event: DragEvent<HTMLElement>, targetNode?: AppNode): DropPosition => {
    const rect = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - rect.top;
    if (targetNode?.type === "folder" && y > rect.height * 0.28 && y < rect.height * 0.72) {
      return "inside";
    }
    return y < rect.height * 0.5 ? "before" : "after";
  };

  const resolveDragSourceId = (event: DragEvent<HTMLElement>): string | null => {
    if (draggingNodeIdRef.current && nodeById.has(draggingNodeIdRef.current)) {
      return draggingNodeIdRef.current;
    }
    if (draggingNodeId && nodeById.has(draggingNodeId)) {
      return draggingNodeId;
    }

    const fromCustom = event.dataTransfer.getData(INTERNAL_NODE_DRAG_MIME);
    const fromPlain = event.dataTransfer.getData("text/plain");
    const candidate =
      (fromCustom && fromCustom.length > 0 ? fromCustom : fromPlain && fromPlain.length > 0 ? fromPlain : null);
    if (!candidate) return null;
    const normalized = candidate.trim();
    return nodeById.has(normalized) ? normalized : null;
  };

  const hasExternalFileDrag = (event: DragEvent<HTMLElement>): boolean => {
    if (!isDesktopRuntime) return false;
    // Prioritize internal node drags so move actions are never misrouted to file import.
    if (resolveDragSourceId(event)) return false;
    return isExternalFileDropData(event.dataTransfer);
  };

  const resolveExternalDropPaths = (event: DragEvent<HTMLElement>): string[] => {
    if (!isDesktopRuntime) return [];
    if (resolveDragSourceId(event)) return [];
    return collectExternalFileDropPaths(event.dataTransfer);
  };

  useEffect(() => {
    if (!isDesktopRuntime || !isTauri()) return;

    const windowHandle = appWindow ?? getCurrentWindow();
    let unlisten: (() => void) | null = null;
    let disposed = false;

    const toClientPosition = (position: { x: number; y: number }) => {
      const scale = window.devicePixelRatio || 1;
      return {
        x: position.x / scale,
        y: position.y / scale
      };
    };

    const getElementsAtPoint = (clientX: number, clientY: number) => {
      const elements =
        typeof document.elementsFromPoint === "function"
          ? document.elementsFromPoint(clientX, clientY)
          : [document.elementFromPoint(clientX, clientY)].filter(Boolean);
      return elements.filter((element): element is HTMLElement => element instanceof HTMLElement);
    };

    const resolveNativeExternalDropContext = (clientX: number, clientY: number) => {
      const elements = getElementsAtPoint(clientX, clientY);
      if (elements.length === 0) return null;

      const surfaceElement =
        elements
          .map((element) => element.closest<HTMLElement>("[data-ode-surface]"))
          .find((element): element is HTMLElement => Boolean(element)) ?? null;
      const nodeElement =
        elements
          .map((element) => element.closest<HTMLElement>("[data-ode-node-id]"))
          .find((element): element is HTMLElement => Boolean(element)) ?? null;
      const hoveredNodeId = nodeElement?.dataset.odeNodeId?.trim() || null;
      const surface = surfaceElement?.dataset.odeSurface?.trim() || null;
      const activeProjectRootId = activeProjectRootIdRef.current;
      const currentFolderId = currentFolderIdRef.current;
      const procedureTargetId =
        hoveredNodeId ?? procedureSelectedNodeIdRef.current ?? procedureRootNodeIdRef.current ?? activeProjectRootId;

      if (surface === "tree") {
        return {
          importSurface: "tree" as const,
          targetNodeId: hoveredNodeId ?? activeProjectRootId ?? null,
          indicator: {
            targetId: hoveredNodeId ?? activeProjectRootId ?? ROOT_PARENT_ID,
            position: "inside" as const
          }
        };
      }

      if (surface === "grid") {
        return {
          importSurface: "grid" as const,
          targetNodeId: hoveredNodeId ?? currentFolderId ?? activeProjectRootId ?? null,
          indicator: {
            targetId: hoveredNodeId ?? currentFolderId ?? activeProjectRootId ?? ROOT_PARENT_ID,
            position: "inside" as const
          }
        };
      }

      if (surface === "timeline") {
        return {
          importSurface: "timeline" as const,
          targetNodeId: hoveredNodeId ?? activeProjectRootId ?? null,
          indicator: {
            targetId: hoveredNodeId ?? activeProjectRootId ?? ROOT_PARENT_ID,
            position: "inside" as const
          }
        };
      }

      if (surface === "procedure") {
        return {
          importSurface: "tree" as const,
          targetNodeId: procedureTargetId ?? null,
          indicator: hoveredNodeId
            ? {
                targetId: hoveredNodeId,
                position: "inside" as const
              }
            : null
        };
      }

      if (workspaceModeRef.current === "timeline") {
        return {
          importSurface: "timeline" as const,
          targetNodeId: activeProjectRootId ?? null,
          indicator: {
            targetId: activeProjectRootId ?? ROOT_PARENT_ID,
            position: "inside" as const
          }
        };
      }

      if (desktopViewModeRef.current === "procedure") {
        return {
          importSurface: "tree" as const,
          targetNodeId: procedureTargetId ?? null,
          indicator: null
        };
      }

      if (selectionSurfaceRef.current === "tree") {
        return {
          importSurface: "tree" as const,
          targetNodeId: activeProjectRootId ?? null,
          indicator: {
            targetId: activeProjectRootId ?? ROOT_PARENT_ID,
            position: "inside" as const
          }
        };
      }

      return {
        importSurface: "grid" as const,
        targetNodeId: currentFolderId ?? activeProjectRootId ?? null,
        indicator: {
          targetId: currentFolderId ?? activeProjectRootId ?? ROOT_PARENT_ID,
          position: "inside" as const
        }
      };
    };

    windowHandle
      .onDragDropEvent(({ payload }) => {
        if (payload.type === "leave") {
          if (!draggingNodeIdRef.current) {
            setDropIndicator(null);
          }
          return;
        }

        const { x: clientX, y: clientY } = toClientPosition(payload.position);
        const context = resolveNativeExternalDropContext(clientX, clientY);

        if (payload.type === "enter" || payload.type === "over") {
          if (draggingNodeIdRef.current) return;
          setDropIndicator(context?.indicator ?? null);
          return;
        }

        if (payload.paths.length === 0) return;
        draggingNodeIdRef.current = null;
        setDraggingNodeId(null);
        setDropIndicator(null);
        if (!context) return;
        void importExternalFilesToNodeRef.current(payload.paths, context.targetNodeId, context.importSurface);
      })
      .then((dispose) => {
        if (disposed) {
          dispose();
          return;
        }
        unlisten = dispose;
      })
      .catch(() => {
        // Native drag-drop listener is best-effort only.
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [appWindow, isDesktopRuntime]);

  const resolveSelectedSourceId = (): string | null => {
    const selected = store.selectedNodeId;
    if (!selected) return null;
    return nodeById.has(selected) ? selected : null;
  };

  const resolveActiveDragSourceId = (event: DragEvent<HTMLElement>): string | null => {
    const fromDrag = resolveDragSourceId(event);
    if (fromDrag) return fromDrag;
    return resolveSelectedSourceId();
  };

  const clearDraggingState = () => {
    draggingNodeIdRef.current = null;
    setDraggingNodeId(null);
    setDropIndicator(null);
  };

  const detectGridDropPosition = (event: DragEvent<HTMLElement>, target: AppNode): DropPosition => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const middleX = x > rect.width * 0.2 && x < rect.width * 0.8;
    const middleY = y > rect.height * 0.2 && y < rect.height * 0.8;
    if (target.type === "folder" && middleX && middleY) return "inside";
    if (y < rect.height * 0.45) return "before";
    return "after";
  };

  const detectDetailsDropPosition = (event: DragEvent<HTMLElement>, target: AppNode): DropPosition => {
    const rect = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - rect.top;
    if (target.type === "folder" && y > rect.height * 0.3 && y < rect.height * 0.7) {
      return "inside";
    }
    return y < rect.height * 0.5 ? "before" : "after";
  };

  const beginNodeDrag = (event: DragEvent<HTMLElement>, nodeId: string, surface: SelectionSurface) => {
    closeContextMenu();
    event.stopPropagation();
    if (!ensureStructureMutationAllowed([nodeId])) {
      event.preventDefault();
      draggingNodeIdRef.current = null;
      setDraggingNodeId(null);
      setDropIndicator(null);
      return;
    }
    const dragNode = nodeById.get(nodeId) ?? null;
    if (isHiddenExecutionTaskNode(dragNode)) {
      event.preventDefault();
      draggingNodeIdRef.current = null;
      setDraggingNodeId(null);
      setDropIndicator(null);
      reportExecutionProjectionMoveBlocked();
      return;
    }
    draggingNodeIdRef.current = nodeId;
    setDraggingNodeId(nodeId);
    setDropIndicator(null);
    setPrimarySelection(nodeId, surface);
    event.dataTransfer.effectAllowed = "move";
    try {
      event.dataTransfer.setData(INTERNAL_NODE_DRAG_MIME, nodeId);
      event.dataTransfer.setData("text/plain", nodeId);
    } catch {
      // Some runtimes can reject custom payloads; selection fallback handles source resolution.
    }
  };

  const applyGridDropMove = async (sourceId: string, targetId: string, position: DropPosition) => {
    if (sourceId === targetId) return;
    const target = nodeById.get(targetId);
    if (!target) return;

    if (position === "inside" && target.type === "folder") {
      const children = (byParent.get(target.id) ?? []).filter((child) => child.id !== sourceId);
      const afterId = children.length > 0 ? children[children.length - 1].id : null;
      await moveNodeToParent(sourceId, target.id, afterId, "grid");
      return;
    }

    const parentKey = target.parentId;
    const newParentId = parentKey === ROOT_PARENT_ID ? null : parentKey;
    const siblings = (byParent.get(parentKey) ?? []).filter((item) => item.id !== sourceId);
    const targetIndex = siblings.findIndex((item) => item.id === target.id);
    const afterId = position === "before" ? (targetIndex > 0 ? siblings[targetIndex - 1].id : null) : target.id;
    await moveNodeToParent(sourceId, newParentId, afterId, "grid");
  };

  const applyDropIntoCurrentGridFolder = async (sourceId: string) => {
    const parentId = store.currentFolderId;
    if (parentId && isNodeInSubtree(sourceId, parentId)) return;
    const parentKey = parentId ?? ROOT_PARENT_ID;
    const siblings = (byParent.get(parentKey) ?? []).filter((item) => item.id !== sourceId);
    const afterId = siblings.length > 0 ? siblings[siblings.length - 1].id : null;
    await moveNodeToParent(sourceId, parentId, afterId, "grid");
  };

  const handleWindowMinimize = async () => {
    const win = getDesktopWindow();
    if (!win) return;
    if (await minimizeWindowsDesktopPrimaryWindow(win)) return;
    await win.minimize();
  };

  const handleWindowToggleMaximize = async () => {
    const win = getDesktopWindow();
    if (!win) return;

    const [fullscreen, nativeMaximized, effectiveMaximized] = await Promise.all([
      getWindowsDesktopPrimaryWindowFullscreenState(win),
      win.isMaximized().catch(() => false),
      isDesktopWindowEffectivelyMaximized(win)
    ]);

    if (fullscreen || nativeMaximized || effectiveMaximized) {
      if (fullscreen) {
        await setDesktopWindowFullscreen(win, false);
        await waitForMs(80);
      }

      if (nativeMaximized) {
        await win.unmaximize();
        await waitForMs(80);
      }

      const restoreBounds = desktopWindowRestoreBoundsRef.current;
      desktopWindowRestoreBoundsRef.current = null;
      if (restoreBounds) {
        await restoreDesktopWindowBounds(win, restoreBounds);
        await fitDesktopWindowToWorkArea();
      } else {
        await fitDesktopWindowToWorkArea({ preferCenter: true });
      }

      setIsWindowMaximized(false);
    } else {
      desktopWindowRestoreBoundsRef.current = await captureDesktopWindowRestoreBounds(win);
      const fullscreenApplied = await setDesktopWindowFullscreen(win, true);
      if (!fullscreenApplied) {
        await fitDesktopWindowToWorkArea({
          fillWorkArea: true,
          coverTaskbar: true,
          margin: DESKTOP_WINDOW_MAXIMIZE_MARGIN_PX
        });
      }
      setIsWindowMaximized(await isDesktopWindowEffectivelyMaximized(win));
    }
  };

  const handleWindowClose = async () => {
    if (hasBlockingOverlayOpenWithMove) return;
    const win = getDesktopWindow();
    if (!win) return;
    if (await closeWindowsDesktopPrimaryWindow(win)) return;
    await win.close();
  };

  const expandSidebarPanel = () => {
    if (isSidebarCollapsed) setIsSidebarCollapsed(false);
  };

  const expandSidebarForSearch = () => {
    if (isSidebarCollapsed) {
      setIsSidebarCollapsed(false);
      window.setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);
      return;
    }
    searchInputRef.current?.focus();
  };

  const resolveCommandParentId = (): string | null => {
    const selectedId = store.selectedNodeId ?? store.currentFolderId ?? activeProjectRootId;
    if (!selectedId) return activeProjectRootId ?? null;
    const selected = nodeById.get(selectedId);
    if (!selected) return activeProjectRootId ?? null;
    if (selected.type === "folder") {
      if (activeProjectRootId && projectScopedNodeIds && !projectScopedNodeIds.has(selected.id)) {
        return activeProjectRootId;
      }
      return selected.id;
    }
    const parentId = selected.parentId === ROOT_PARENT_ID ? null : selected.parentId;
    if (activeProjectRootId && parentId && projectScopedNodeIds && !projectScopedNodeIds.has(parentId)) {
      return activeProjectRootId;
    }
    return parentId ?? activeProjectRootId ?? null;
  };

  const resolveNodeByCommandRef = (
    reference: string,
    options?: { folderOnly?: boolean }
  ): AppNode | null => {
    const needle = reference.trim().toLowerCase();
    if (!needle) return null;
    const requireFolder = options?.folderOnly ?? false;

    const scopedNodes = store.allNodes.filter((node) => {
      if (projectScopedNodeIds && !projectScopedNodeIds.has(node.id)) return false;
      if (requireFolder && node.type !== "folder") return false;
      return true;
    });

    const byExactId = scopedNodes.find((node) => node.id.toLowerCase() === needle);
    if (byExactId) return byExactId;

    const byNumber = scopedNodes.find((node) => {
      const label = (scopedNumbering.get(node.id) ?? numbering.get(node.id) ?? "").toLowerCase();
      return label === needle;
    });
    if (byNumber) return byNumber;

    const byExactName = scopedNodes.find((node) => node.name.trim().toLowerCase() === needle);
    if (byExactName) return byExactName;

    return scopedNodes.find((node) => node.name.toLowerCase().includes(needle)) ?? null;
  };

  const getPrimarySelectionNode = (): AppNode | null => {
    if (selectedNode) return selectedNode;
    const selectedId = store.selectedNodeId;
    if (!selectedId) return null;
    return nodeById.get(selectedId) ?? null;
  };

  const getNodeTextForAi = (node: AppNode | null | undefined): string => {
    if (!node) return "";
    if (typeof node.content === "string" && node.content.trim().length > 0) {
      return node.content.trim();
    }
    if (typeof node.description === "string" && node.description.trim().length > 0) {
      return node.description.trim();
    }
    const properties = node.properties;
    if (!properties || typeof properties !== "object") return "";
    const wbsDocument = (properties as Record<string, unknown>).wbsDocument;
    if (!wbsDocument || typeof wbsDocument !== "object") return "";
    const markdown = (wbsDocument as Record<string, unknown>).markdown;
    return typeof markdown === "string" ? markdown.trim() : "";
  };

  useEffect(() => {
    if (!mindMapReviewNode) {
      setMindMapTextPreviewState({ nodeId: null, status: "idle", text: null, error: null });
      setMindMapPowerPointPreviewState({ nodeId: null, status: "idle", slidePaths: [], error: null });
      return;
    }

    if (mindMapReviewMediaPreviewKind) {
      setMindMapTextPreviewState({
        nodeId: mindMapReviewNode.id,
        status: "idle",
        text: null,
        error: null
      });
      setMindMapPowerPointPreviewState({
        nodeId: mindMapReviewNode.id,
        status: "idle",
        slidePaths: [],
        error: null
      });
      return;
    }

    if (POWERPOINT_PREVIEW_EXTENSIONS.has(extractFileExtensionLower(mindMapReviewNode.name))) {
      setMindMapTextPreviewState({
        nodeId: mindMapReviewNode.id,
        status: "idle",
        text: null,
        error: null
      });

      const mirrorFilePath = getNodeMirrorFilePath(mindMapReviewNode);
      if (!mirrorFilePath) {
        setMindMapPowerPointPreviewState({
          nodeId: mindMapReviewNode.id,
          status: "error",
          slidePaths: [],
          error: "PowerPoint preview source file is missing."
        });
        return;
      }

      let cancelled = false;
      setMindMapPowerPointPreviewState({
        nodeId: mindMapReviewNode.id,
        status: "loading",
        slidePaths: [],
        error: null
      });

      void exportPowerPointSlides(mirrorFilePath)
        .then((slidePaths) => {
          if (cancelled) return;
          const normalized = Array.isArray(slidePaths)
            ? slidePaths.map((value) => (typeof value === "string" ? value.trim() : "")).filter((value) => value.length > 0)
            : [];
          setMindMapPowerPointPreviewState({
            nodeId: mindMapReviewNode.id,
            status: normalized.length > 0 ? "ready" : "error",
            slidePaths: normalized,
            error: normalized.length > 0 ? null : "No PowerPoint slides were available for preview."
          });
        })
        .catch((error) => {
          if (cancelled) return;
          const reason = error instanceof Error ? error.message : String(error);
          setMindMapPowerPointPreviewState({
            nodeId: mindMapReviewNode.id,
            status: "error",
            slidePaths: [],
            error: reason
          });
        });

      return () => {
        cancelled = true;
      };
    }

    setMindMapPowerPointPreviewState({
      nodeId: mindMapReviewNode.id,
      status: "idle",
      slidePaths: [],
      error: null
    });

    const seededText = getNodeTextForAi(mindMapReviewNode);
    if (seededText.length > 0) {
      setMindMapTextPreviewState({
        nodeId: mindMapReviewNode.id,
        status: "ready",
        text: seededText,
        error: null
      });
      return;
    }

    const mirrorFilePath = getNodeMirrorFilePath(mindMapReviewNode);
    if (!mirrorFilePath) {
      setMindMapTextPreviewState({
        nodeId: mindMapReviewNode.id,
        status: "error",
        text: null,
        error: "Source file is missing."
      });
      return;
    }

    let cancelled = false;
    setMindMapTextPreviewState({
      nodeId: mindMapReviewNode.id,
      status: "loading",
      text: null,
      error: null
    });

    void extractDocumentText(mirrorFilePath, {
      extension: extractFileExtensionLower(mindMapReviewNode.name),
      nodeId: mindMapReviewNode.id
    })
      .then((text) => {
        if (cancelled) return;
        const normalized = typeof text === "string" ? text.trim() : "";
        const isTextPreviewCandidate = TEXT_PREVIEW_EXTENSIONS.has(extractFileExtensionLower(mindMapReviewNode.name));
        setMindMapTextPreviewState({
          nodeId: mindMapReviewNode.id,
          status: normalized.length > 0 || isTextPreviewCandidate ? "ready" : "error",
          text: normalized.length > 0 || isTextPreviewCandidate ? normalized : null,
          error:
            normalized.length > 0
              ? null
              : isTextPreviewCandidate
                ? null
                : "No readable text was extracted from this file."
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setMindMapTextPreviewState({
          nodeId: mindMapReviewNode.id,
          status: "error",
          text: null,
          error: error instanceof Error ? error.message : String(error)
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    mindMapReviewNode,
    mindMapReviewMediaPreviewKind
  ]);

  const waitForMs = async (ms: number): Promise<void> =>
    new Promise((resolve) => window.setTimeout(resolve, ms));

  const stripFileExtension = (fileName: string): string => {
    const trimmed = fileName.trim();
    const lastDot = trimmed.lastIndexOf(".");
    if (lastDot <= 0) return trimmed;
    const baseName = trimmed.slice(0, lastDot).trim();
    return baseName.length > 0 ? baseName : trimmed;
  };

  const documentAdvisorDefaultRoleLabel = t("document_ai.tree_default_role");

  const buildPreviewLines = (lines: string[], limit = 4): string[] => buildPreviewLinesState(lines, limit);
  const DOCUMENT_ATTRIBUTION_LINE_PATTERN = /^[\[(]?\s*sources?\s*:\s*.+?(?:[\])])?[.]?$/iu;
  const isDocumentAttributionNoise = (line: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > 120) return false;
    return DOCUMENT_ATTRIBUTION_LINE_PATTERN.test(trimmed);
  };

  const getDocumentAdvisorLines = (rawText: string): string[] => getDocumentAdvisorLinesState(rawText);

  const DOCUMENT_SUMMARY_HEADING_PATTERN = /^(sommaire|summary|contents|table of contents)$/iu;
  const DOCUMENT_STRUCTURE_INLINE_MARKER_PATTERN =
    /^([\u25B7\u25BA\u25B8\u25CB\u25E6\u2022\u25AA\u25CF\u2023])\s*(.+)$/u;
  const DOCUMENT_STRUCTURE_FALLBACK_MARKER_PATTERN = /^\?\s*(.+)$/u;
  const DOCUMENT_STRUCTURE_MARKER_LEVEL = new Map<string, number>([
    ["\u25B7", 1],
    ["\u25BA", 1],
    ["\u25B8", 1],
    ["\u25CB", 2],
    ["\u25E6", 2],
    ["\u2022", 2],
    ["\u25AA", 3],
    ["\u25CF", 3],
    ["\u2023", 3]
  ]);

  const getOutlineLevelFromCode = (code: string): number => {
    const normalized = code.trim();
    if (!normalized) return 1;
    if (normalized.includes(".") || normalized.includes("-")) {
      return Math.max(1, normalized.split(/[.-]/).filter((part) => part.trim().length > 0).length);
    }
    const digitsOnly = normalized.replace(/\D/g, "");
    return Math.max(1, Math.min(6, digitsOnly.length || 1));
  };

  const OUTLINE_CELL_SPLIT_PATTERN = /\s+\|\s+/u;

  const splitOutlineRowCells = (line: string): string[] =>
    line
      .split(OUTLINE_CELL_SPLIT_PATTERN)
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);

  const parseOutlineCodeTitleCell = (value: string): { code: string; title: string } | null => {
    const match = value.match(/^(\d+(?:[.-]\d+)*)\s+(.+)$/);
    if (!match) return null;
    const [, rawCode, rawTitle] = match;
    const title = rawTitle.trim();
    if (!title) return null;
    return {
      code: rawCode.trim(),
      title
    };
  };

  const normalizeNodeDeliverables = (value: string | undefined): string[] => {
    if (!value) return [];
    return Array.from(
      new Set(
        value
          .split(/[;\n]/)
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      )
    ).slice(0, 12);
  };

  const extractObjectiveFromDescription = (description: string | undefined): string | undefined => {
    if (!description) return undefined;
    const candidate = description
      .split(/[;•]/)
      .map((chunk) => chunk.trim())
      .find((chunk) => chunk.length >= 18);
    if (!candidate) return undefined;
    return candidate.replace(/[.]+$/u, "").trim();
  };

  const formatDocumentAdvisorNAMatch = (match: NAMatchResult | null): DocumentAdvisorNAMatch | null => {
    if (!match?.recommendedCode) return null;
    const entry = getNAByCode(match.recommendedCode);
    if (!entry) return null;
    return {
      code: entry.code,
      label: entry.label,
      pathLabel: getNAPathLabel(entry.code) ?? `${entry.code} ${entry.label}`,
      confidence: match.confidence,
      candidates: match.candidates.map((candidate) => {
        const candidateEntry = getNAByCode(candidate.code);
        return {
          code: candidate.code,
          label: candidateEntry?.label ?? candidate.label,
          pathLabel: getNAPathLabel(candidate.code) ?? `${candidate.code} ${candidate.label}`,
          score: candidate.score,
          reason: candidate.reason
        };
      })
    };
  };

  const buildWorkspaceNAAnchorFromMatch = async (
    match: DocumentAdvisorNAMatch,
    originNode: AppNode | null | undefined,
    source: WorkspaceNAAnchor["source"] = "document_advisor"
  ): Promise<WorkspaceNAAnchor> => {
    const targetResolution = await resolveLevel4NATargetNode(match.code, originNode ?? null);
    const targetProject =
      targetResolution.ambiguous || !targetResolution.node
        ? null
        : projects.find((project) => project.rootNodeId && isNodeInSubtree(project.rootNodeId, targetResolution.node!.id)) ?? null;
    return {
      code: match.code,
      label: match.label,
      path: match.pathLabel,
      confidence: match.confidence,
      candidates: match.candidates.map((candidate) => ({
        code: candidate.code,
        label: candidate.label,
        path: candidate.pathLabel,
        score: candidate.score,
        reason: candidate.reason
      })),
      target_project_id: targetProject?.id ?? null,
      target_project_name: targetProject?.name ?? null,
      target_node_id: targetResolution.ambiguous ? null : targetResolution.node?.id ?? null,
      target_path: targetResolution.ambiguous
        ? null
        : targetResolution.node
          ? getNodePathLabel(targetResolution.node)
          : null,
      ambiguous: targetResolution.ambiguous,
      matched_at: new Date().toISOString(),
      source
    };
  };

  const stripODEIndexPrefix = (value: string): string =>
    value
      .replace(/^\[\s*\d+(?:[.-]\d+)*\s*\]\s*/u, "")
      .replace(/^\d+(?:[.-]\d+)*\s+/u, "")
      .trim();

  const normalizeODEName = (value: string): string =>
    stripODEIndexPrefix(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");

  const getDocumentAdvisorLineage = (node: AppNode | null | undefined): AppNode[] => {
    const lineage: AppNode[] = [];
    let cursor = node ?? null;
    while (cursor && cursor.parentId !== ROOT_PARENT_ID) {
      const parent = nodeById.get(cursor.parentId) ?? null;
      if (!parent) break;
      lineage.push(parent);
      cursor = parent;
    }
    return lineage;
  };

  const getNodeLineageFromRoot = (node: AppNode | null | undefined): AppNode[] => {
    if (!node) return [];
    return [...getDocumentAdvisorLineage(node)].reverse().concat(node);
  };

  const getNodePathLabel = (node: AppNode | null | undefined): string | null => {
    const lineage = getNodeLineageFromRoot(node);
    if (lineage.length === 0) return null;
    return lineage.map((entry) => entry.name).join(" / ");
  };

  const collectNodeAssistantCandidateNodes = (
    target: AppNode,
    maxCandidates = 24
  ): AppNode[] => {
    const ordered: AppNode[] = [];
    const queue = [target.id];
    const seen = new Set<string>();

    while (queue.length > 0 && ordered.length < maxCandidates) {
      const currentId = queue.shift();
      if (!currentId || seen.has(currentId)) continue;
      seen.add(currentId);
      const current = currentId === target.id ? target : nodeById.get(currentId) ?? null;
      if (!current) continue;
      if (current.type !== "folder" && (current.type === "file" || getNodeTextForAi(current).length > 0)) {
        ordered.push(current);
      }
      const children = byParent.get(current.id) ?? [];
      for (const child of children) {
        if (!seen.has(child.id)) {
          queue.push(child.id);
        }
      }
    }

    return ordered;
  };

  const trimAssistantExcerpt = (value: string, limit = 420): string => {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (normalized.length <= limit) return normalized;
    return `${normalized.slice(0, limit).trim()}...`;
  };

  const readWorkspaceNAAnchor = (node: AppNode | null | undefined): WorkspaceNAAnchor | null => {
    const raw = node?.properties?.odeWorkspaceNA;
    if (!raw || typeof raw !== "object") return null;
    const candidate = raw as Record<string, unknown>;
    const code = typeof candidate.code === "string" ? candidate.code.trim() : "";
    const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
    const path = typeof candidate.path === "string" ? candidate.path.trim() : "";
    if (!code || !label || !path) return null;
    const candidates = Array.isArray(candidate.candidates)
      ? candidate.candidates
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const entry = item as Record<string, unknown>;
            const candidateCode = typeof entry.code === "string" ? entry.code.trim() : "";
            const candidateLabel = typeof entry.label === "string" ? entry.label.trim() : "";
            const candidatePath = typeof entry.path === "string" ? entry.path.trim() : "";
            const candidateScore =
              typeof entry.score === "number"
                ? entry.score
                : typeof entry.score === "string"
                  ? Number(entry.score)
                  : 0;
            const candidateReason = typeof entry.reason === "string" ? entry.reason.trim() : "";
            if (!candidateCode || !candidateLabel || !candidatePath || !Number.isFinite(candidateScore)) {
              return null;
            }
            return {
              code: candidateCode,
              label: candidateLabel,
              path: candidatePath,
              score: candidateScore,
              reason: candidateReason
            };
          })
          .filter(
            (
              item
            ): item is {
              code: string;
              label: string;
              path: string;
              score: number;
              reason: string;
            } => item !== null
          )
      : [];
    const confidence =
      typeof candidate.confidence === "number"
        ? candidate.confidence
        : typeof candidate.confidence === "string"
          ? Number(candidate.confidence)
          : 0;
    return {
      code,
      label,
      path,
      confidence: Number.isFinite(confidence) ? confidence : 0,
      candidates,
      target_project_id:
        typeof candidate.target_project_id === "string" && candidate.target_project_id.trim().length > 0
          ? candidate.target_project_id.trim()
          : null,
      target_project_name:
        typeof candidate.target_project_name === "string" && candidate.target_project_name.trim().length > 0
          ? candidate.target_project_name.trim()
          : null,
      target_node_id:
        typeof candidate.target_node_id === "string" && candidate.target_node_id.trim().length > 0
          ? candidate.target_node_id.trim()
          : null,
      target_path:
        typeof candidate.target_path === "string" && candidate.target_path.trim().length > 0
          ? candidate.target_path.trim()
          : null,
      ambiguous: candidate.ambiguous === true,
      matched_at:
        typeof candidate.matched_at === "string" && candidate.matched_at.trim().length > 0
          ? candidate.matched_at.trim()
          : "",
      source: candidate.source === "manual" ? "manual" : "document_advisor"
    };
  };

  const findWorkspaceNAOwnerNode = (node: AppNode | null | undefined): AppNode | null => {
    let cursor = node ?? null;
    while (cursor) {
      if (readWorkspaceNAAnchor(cursor)) {
        return cursor;
      }
      if (!cursor.parentId || cursor.parentId === ROOT_PARENT_ID) break;
      cursor = nodeById.get(cursor.parentId) ?? null;
    }
    return null;
  };

  const collectSubtreeNodeIds = (rootId: string): Set<string> => {
    const ids = new Set<string>();
    const stack = [rootId];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || ids.has(current)) continue;
      ids.add(current);
      const children = byParent.get(current) ?? [];
      for (const child of children) {
        stack.push(child.id);
      }
    }
    return ids;
  };

  const resolveLevel4NATargetNodeInProject = (
    naCode: string,
    projectRootId: string
  ): { node: AppNode | null; ambiguous: boolean } => {
    const normalizedCode = naCode.trim();
    if (normalizedCode.length !== 4) {
      return { node: null, ambiguous: false };
    }
    const scopedIds = collectSubtreeNodeIds(projectRootId);
    const matches = store.allNodes.filter((candidate) => {
      if (!scopedIds.has(candidate.id)) return false;
      const metadata = getEffectiveODENodeMetadata(candidate);
      return metadata.level === 4 && metadata.naCode === normalizedCode;
    });
    if (matches.length === 1) {
      return { node: matches[0], ambiguous: false };
    }
    return { node: null, ambiguous: matches.length > 1 };
  };

  const resolveWorkspaceNATargetForProject = (
    project: ProjectSummary,
    naCode: string
  ): WorkspaceNATargetResolution => {
    const resolution = resolveLevel4NATargetNodeInProject(naCode, project.rootNodeId);
    if (resolution.node && !resolution.ambiguous) {
      return {
        node: resolution.node,
        mode: "na_branch",
        pathLabel: getNodePathLabel(resolution.node) ?? resolution.node.name,
        ambiguous: false
      };
    }

    const rootNode = nodeById.get(project.rootNodeId) ?? null;
    return {
      node: rootNode,
      mode: "workspace_root",
      pathLabel: rootNode ? getNodePathLabel(rootNode) ?? rootNode.name : project.name,
      ambiguous: resolution.ambiguous
    };
  };

  const buildBranchSnapshot = (rootNodeId: string): BranchSnapshot | null => {
    const source = nodeById.get(rootNodeId);
    if (!source) return null;
    if (isHiddenExecutionTaskNode(source)) return null;
    const children = byParent.get(rootNodeId) ?? [];
    return {
      name: source.name,
      type: source.type,
      properties: source.properties as Record<string, unknown> | undefined,
      children: children
        .filter((child) => !isHiddenExecutionTaskNode(child))
        .map((child) => buildBranchSnapshot(child.id))
        .filter((item): item is BranchSnapshot => item !== null)
    };
  };

  const cloneBranchSnapshot = async (
    snapshot: BranchSnapshot,
    parentId: string | null,
    afterId: string | null,
    rootPropertiesOverride?: Record<string, unknown>
  ): Promise<string> => {
    const snapshotProperties = (snapshot.properties ?? {}) as Record<string, unknown>;
    const snapshotMirrorPath =
      typeof snapshotProperties.mirrorFilePath === "string" ? snapshotProperties.mirrorFilePath.trim() : "";
    const sanitizedSnapshotProperties: Record<string, unknown> = { ...snapshotProperties };
    delete sanitizedSnapshotProperties.mirrorFilePath;
    delete sanitizedSnapshotProperties.importedFromPath;
    delete sanitizedSnapshotProperties.sizeBytes;
    delete sanitizedSnapshotProperties.odeWorkspaceNA;

    if (snapshot.type === "file" && snapshotMirrorPath.length > 0) {
      try {
        const imported = await importFilesToNode(parentId, [snapshotMirrorPath]);
        const createdFromImport = imported[0];
        if (createdFromImport) {
          await moveNode(createdFromImport.id, parentId, afterId);
          const nextProperties = {
            ...(createdFromImport.properties ?? {}),
            ...sanitizedSnapshotProperties,
            ...(rootPropertiesOverride ?? {})
          };
          if (Object.keys(nextProperties).length > 0) {
            await updateNodeProperties(createdFromImport.id, nextProperties);
          }
          return createdFromImport.id;
        }
      } catch {
        // Fall through to generic clone behavior if file import cannot be used.
      }
    }

    const created = await createNode(parentId, snapshot.name, snapshot.type);
    await moveNode(created.id, parentId, afterId);
    const fallbackProperties =
      snapshot.type === "file" ? sanitizedSnapshotProperties : { ...sanitizedSnapshotProperties };
    const nextProperties =
      Object.keys(rootPropertiesOverride ?? {}).length > 0
        ? {
            ...fallbackProperties,
            ...rootPropertiesOverride
          }
        : fallbackProperties;
    if (Object.keys(nextProperties).length > 0) {
      await updateNodeProperties(created.id, nextProperties);
    }

    let previousChildId: string | null = null;
    for (const child of snapshot.children) {
      previousChildId = await cloneBranchSnapshot(child, created.id, previousChildId);
    }
    return created.id;
  };

  const matchNAEntryByNodeName = (
    name: string,
    level: number,
    parentCode: string | null
  ) => {
    const normalizedName = normalizeODEName(name);
    if (!normalizedName) return null;
    return (
      NA_CATALOG.find((entry) => {
        if (entry.level !== level) return false;
        if (parentCode && !entry.code.startsWith(parentCode)) return false;
        const candidates = [entry.label, ...entry.aliases].map(normalizeODEName).filter((value) => value.length > 0);
        return candidates.some((candidate) => normalizedName === candidate || normalizedName.endsWith(candidate));
      }) ?? null
    );
  };

  const inferODENodeMetadataForBranch = (
    node: AppNode | null | undefined
  ): Array<{ node: AppNode; metadata: ODENodeMetadata }> => {
    const path = getNodeLineageFromRoot(node);
    if (path.length === 0) return [];

    let startIndex = -1;
    let level1Entry: (typeof NA_CATALOG)[number] | null = null;
    for (let index = 0; index < path.length; index += 1) {
      const matched = matchNAEntryByNodeName(path[index].name, 1, null);
      if (matched) {
        startIndex = index;
        level1Entry = matched;
        break;
      }
    }
    if (startIndex < 0 || !level1Entry) return [];

    const inferred: Array<{ node: AppNode; metadata: ODENodeMetadata }> = [];
    inferred.push({
      node: path[startIndex],
      metadata: {
        level: 1,
        naCode: level1Entry.code,
        locked: true,
        kind: "na_root"
      }
    });

    let currentNAEntry = level1Entry;
    let matchedLevel4Code: string | null = level1Entry.level === 4 ? level1Entry.code : null;
    let matchedLevel4Index: number | null = level1Entry.level === 4 ? startIndex : null;

    for (let index = startIndex + 1; index < path.length; index += 1) {
      const relativeLevel = index - startIndex + 1;
      const currentNode = path[index];

      if (relativeLevel <= 4) {
        const matched = matchNAEntryByNodeName(currentNode.name, relativeLevel, currentNAEntry.code);
        if (!matched) return [];
        inferred.push({
          node: currentNode,
          metadata: {
            level: matched.level,
            naCode: matched.code,
            locked: true,
            kind: matched.level === 1 ? "na_root" : "na_branch"
          }
        });
        currentNAEntry = matched;
        if (matched.level === 4) {
          matchedLevel4Code = matched.code;
          matchedLevel4Index = index;
        }
        continue;
      }

      if (!matchedLevel4Code || matchedLevel4Index === null) return [];
      const inferredLevel = 4 + (index - matchedLevel4Index);
      const inferredKind: ODENodeKind =
        inferredLevel === 5
          ? "chantier"
          : currentNode.type === "document" ||
              currentNode.type === "file" ||
              currentNode.type === "report" ||
              currentNode.type === "minutes"
            ? "document"
            : "task";
      inferred.push({
        node: currentNode,
        metadata: {
          level: inferredLevel,
          naCode: matchedLevel4Code,
          locked: inferredLevel <= 4,
          kind: inferredKind
        }
      });
    }

    const matchedCount = inferred.filter((item) => item.metadata.level !== null && item.metadata.level <= 4).length;
    if (matchedCount < 2 && inferred[inferred.length - 1]?.node.id === node?.id) {
      return [];
    }

    return inferred;
  };

  const applyODENodeMetadata = (node: AppNode, metadata: ODENodeMetadata): AppNode => ({
    ...node,
    properties: {
      ...(node.properties ?? {}),
      ...buildODENodeProperties({
        level: metadata.level,
        naCode: metadata.naCode,
        kind: metadata.kind ?? "generic"
      })
    }
  });

  const getEffectiveODENodeMetadata = (node: AppNode | null | undefined): ODENodeMetadata => {
    const explicit = getODENodeMetadata(node);
    if (explicit.level !== null || explicit.naCode !== null || explicit.kind !== null) {
      return explicit;
    }
    const inferred = inferODENodeMetadataForBranch(node).find((item) => item.node.id === node?.id)?.metadata ?? null;
    return (
      inferred ?? {
        level: null,
        naCode: null,
        locked: false,
        kind: null
      }
    );
  };

  const ensureODENodeMetadataForBranch = async (
    node: AppNode | null | undefined
  ): Promise<Map<string, AppNode>> => {
    const inferred = inferODENodeMetadataForBranch(node);
    const updated = new Map<string, AppNode>();
    for (const item of inferred) {
      const explicit = getODENodeMetadata(item.node);
      if (explicit.level !== null || explicit.naCode !== null || explicit.kind !== null) continue;
      const nextNode = applyODENodeMetadata(item.node, item.metadata);
      await updateNodeProperties(item.node.id, nextNode.properties ?? {});
      updated.set(item.node.id, nextNode);
    }
    return updated;
  };

  const resolveLevel4NATargetNode = async (
    naCode: string,
    originNode?: AppNode | null
  ): Promise<{ node: AppNode | null; ambiguous: boolean }> => {
    const normalizedCode = naCode.trim();
    if (normalizedCode.length !== 4) {
      return { node: null, ambiguous: false };
    }

    const branchBackfill = await ensureODENodeMetadataForBranch(originNode);
    const getResolvedNode = (candidate: AppNode | null | undefined) =>
      (candidate && branchBackfill.get(candidate.id)) || candidate || null;

    const lineageMatch = [originNode ?? null, ...getDocumentAdvisorLineage(originNode)].find((candidate) => {
      const metadata = getEffectiveODENodeMetadata(getResolvedNode(candidate));
      return metadata.level === 4 && metadata.naCode === normalizedCode;
    });
    if (lineageMatch) {
      return { node: getResolvedNode(lineageMatch), ambiguous: false };
    }

    const scopedMatches = store.allNodes.filter((candidate) => {
      if (projectScopedNodeIds && !projectScopedNodeIds.has(candidate.id)) return false;
      const metadata = getEffectiveODENodeMetadata(candidate);
      return metadata.level === 4 && metadata.naCode === normalizedCode;
    });

    if (scopedMatches.length === 1) {
      const backfilled = await ensureODENodeMetadataForBranch(scopedMatches[0]);
      return { node: backfilled.get(scopedMatches[0].id) ?? scopedMatches[0], ambiguous: false };
    }

    return { node: null, ambiguous: scopedMatches.length > 1 };
  };

  const extractOutlineRows = (
    lines: string[]
  ): Array<{
    code: string;
    title: string;
    level: number;
    lineIndex: number;
    description?: string;
    objective?: string;
    expectedDeliverables?: string[];
  }> => extractOutlineRowsState(lines);

  const normalizeDocumentStructureTitle = (value: string): string =>
    value
      .replace(/\s+/g, " ")
      .replace(/\s+[\u2013\u2014-]\s+/g, " - ")
      .trim();

  const normalizeDocumentStructureSearchText = (value: string): string =>
    normalizeDocumentStructureTitle(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, " ")
      .toLowerCase()
      .replace(/[^a-z0-9:? -]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const getDocumentStructureLookupKeys = (title: string): string[] => {
    const normalized = normalizeDocumentStructureSearchText(title);
    if (!normalized) return [];
    const variants = new Set<string>([normalized]);
    for (const prefix of ["les ", "des ", "vos ", "votre ", "le ", "la ", "l "]) {
      if (normalized.startsWith(prefix) && normalized.length > prefix.length + 2) {
        variants.add(normalized.slice(prefix.length).trim());
      }
    }
    return [...variants].filter((value) => value.length > 0);
  };

  const readDocumentStructureTitle = (
    lines: string[],
    startIndex: number,
    initialTitle: string
  ): { title: string; endLineIndex: number } => {
    const parts = [initialTitle.trim()];
    let cursor = startIndex;

    while (cursor + 1 < lines.length && parts.length < 4) {
      const candidate = lines[cursor + 1]?.trim() ?? "";
      if (!candidate) break;
      if (DOCUMENT_SUMMARY_HEADING_PATTERN.test(candidate)) break;
      if (DOCUMENT_STRUCTURE_MARKER_LEVEL.has(candidate)) break;
      if (/^[\u25B7\u25BA\u25B8\u25CB\u25E6\u2022\u25AA\u25CF\u2023]/u.test(candidate)) break;
      if (/^\d+$/.test(candidate)) break;
      if (candidate.length > 28 && /[.!?]$/.test(candidate)) break;
      if (
        !/^[\u2013\u2014&/+]+$/u.test(candidate) &&
        candidate.length > 22 &&
        parts[parts.length - 1] !== "-" &&
        parts[parts.length - 1] !== "&"
      ) {
        break;
      }
      parts.push(candidate);
      cursor += 1;
    }

    return {
      title: normalizeDocumentStructureTitle(parts.join(" ")),
      endLineIndex: cursor
    };
  };

  const extractDocumentStructureRows = (
    lines: string[]
  ): Array<{ marker: string; title: string; level: number; lineIndex: number }> => {
    const summaryIndex = lines.findIndex((line, index) => index < 140 && DOCUMENT_SUMMARY_HEADING_PATTERN.test(line));
    if (summaryIndex < 0) return [];

    const rows: Array<{ marker: string; title: string; level: number; lineIndex: number }> = [];
    const maxScanIndex = Math.min(lines.length, summaryIndex + 90);
    let pendingMarker: { marker: string; lineIndex: number } | null = null;
    let lastEntryIndex = summaryIndex;

    for (let index = summaryIndex + 1; index < maxScanIndex; index += 1) {
      const line = lines[index]?.trim() ?? "";
      if (!line) continue;

      const markerOnly = DOCUMENT_STRUCTURE_MARKER_LEVEL.get(line);
      if (markerOnly) {
        pendingMarker = { marker: line, lineIndex: index };
        continue;
      }

      const markerWithTitle = line.match(DOCUMENT_STRUCTURE_INLINE_MARKER_PATTERN);
      if (markerWithTitle) {
        const marker = markerWithTitle[1];
        const level = DOCUMENT_STRUCTURE_MARKER_LEVEL.get(marker);
        const inlineTitle = markerWithTitle[2]?.trim() ?? "";
        if (level && inlineTitle) {
          const { title, endLineIndex } = readDocumentStructureTitle(lines, index, inlineTitle);
          rows.push({
            marker,
            title,
            level,
            lineIndex: index
          });
          index = endLineIndex;
          lastEntryIndex = endLineIndex;
          pendingMarker = null;
          continue;
        }
      }

      if (pendingMarker) {
        const level = DOCUMENT_STRUCTURE_MARKER_LEVEL.get(pendingMarker.marker);
        if (level) {
          const { title, endLineIndex } = readDocumentStructureTitle(lines, index, line);
          rows.push({
            marker: pendingMarker.marker,
            title,
            level,
            lineIndex: pendingMarker.lineIndex
          });
          index = endLineIndex;
          lastEntryIndex = endLineIndex;
        }
        pendingMarker = null;
        continue;
      }

      if (rows.length >= 3) {
        if (/^\d+$/.test(line)) continue;
        if (line.length > 72 || /[.!?]$/.test(line) || index - lastEntryIndex >= 5) {
          break;
        }
      }
    }

    const topLevelCount = rows.filter((row) => row.level === 1).length;
    if (rows.length >= 4 && topLevelCount >= 2) {
      return rows;
    }

    const fallbackEntries: Array<{ marker: string; title: string; lineIndex: number }> = [];
    const fallbackMaxScanIndex = Math.min(lines.length, summaryIndex + 90);
    for (let index = summaryIndex + 1; index < fallbackMaxScanIndex; index += 1) {
      const line = lines[index]?.trim() ?? "";
      if (!line) continue;
      const fallbackMatch = line.match(DOCUMENT_STRUCTURE_FALLBACK_MARKER_PATTERN);
      if (fallbackMatch) {
        fallbackEntries.push({
          marker: "?",
          title: normalizeDocumentStructureTitle(fallbackMatch[1] ?? ""),
          lineIndex: index
        });
        continue;
      }
      if (fallbackEntries.length >= 4) {
        if (/^\d+$/.test(line)) continue;
        break;
      }
    }

    if (fallbackEntries.length < 4) {
      return [];
    }

    const summaryEndIndex = fallbackEntries[fallbackEntries.length - 1]?.lineIndex ?? summaryIndex;
    const normalizedLaterLines = lines
      .slice(summaryEndIndex + 1)
      .map((line) => normalizeDocumentStructureSearchText(line))
      .filter((line) => line.length > 0);

    let currentParentSeen = false;
    return fallbackEntries.map((entry) => {
      const lookupKeys = getDocumentStructureLookupKeys(entry.title);
      let prefixedHits = 0;
      for (const line of normalizedLaterLines) {
        for (const key of lookupKeys) {
          if (!key) continue;
          if (line.startsWith(`${key} :`) || line.startsWith(`${key}:`) || line.startsWith(`${key} -`)) {
            prefixedHits += 1;
          }
        }
      }
      const isContainer = prefixedHits >= 2;
      const level = isContainer || !currentParentSeen ? 1 : 2;
      if (level === 1) {
        currentParentSeen = true;
      }
      return {
        marker: entry.marker,
        title: entry.title,
        level,
        lineIndex: entry.lineIndex
      };
    });
  };

  const looksLikeStructuredHeading = (line: string): boolean => {
    const trimmed = line.trim();
    if (trimmed.length < 4 || trimmed.length > 96) return false;
    if (isDocumentAttributionNoise(trimmed)) return false;
    if (/[.!?;:]$/.test(trimmed)) return false;
    const words = trimmed.split(/\s+/).filter((word) => word.length > 0);
    if (words.length === 0 || words.length > 10) return false;

    let structuredWords = 0;
    for (const word of words) {
      const cleaned = word.replace(/^[\[\](){}\-–—\d.]+/, "").replace(/[,:;]+$/, "");
      if (!cleaned) continue;
      const first = cleaned.charAt(0);
      if (first.toLocaleUpperCase() === first && first.toLocaleLowerCase() !== first) {
        structuredWords += 1;
      }
    }

    return structuredWords >= Math.max(1, Math.ceil(words.length * 0.45));
  };

  const extractDocumentAdvisorSections = (
    lines: string[],
    outlineRows: Array<{ code: string; title: string; level: number; lineIndex: number }>
  ): DocumentAdvisorSection[] => extractDocumentAdvisorSectionsState(lines, outlineRows);

  const extractDocumentAdvisorSectionText = (
    rawText: string,
    section: DocumentAdvisorSection
  ): string => extractDocumentAdvisorSectionTextState(rawText, section);

  const parseNumberedOutlineToWbs = (
    goal: string,
    sourceName: string,
    rawText: string
  ): WBSResult | null =>
    parseNumberedOutlineToWbsState(goal, sourceName, rawText, documentAdvisorDefaultRoleLabel);

  const extractOutlineWbsFromSources = (
    goal: string,
    sources: Array<{ node: AppNode; text: string }>
  ): WBSResult | null =>
    extractOutlineWbsFromSourcesState(
      goal,
      sources.map((source) => ({ name: source.node.name, text: source.text })),
      documentAdvisorDefaultRoleLabel
    );

  const extractDocumentStructureWbsFromSources = (
    goal: string,
    sources: Array<{ node: AppNode; text: string }>
  ): WBSResult | null =>
    extractDocumentStructureWbsFromSourcesState(
      goal,
      sources.map((source) => ({ name: source.node.name, text: source.text })),
      documentAdvisorDefaultRoleLabel
    );

  const extractDocumentTreeSeedFromSources = (
    goal: string,
    sources: Array<{ node: AppNode; text: string }>
  ):
    | {
        result: WBSResult;
        sourceMode: DocumentAdvisorTreeProposalSourceMode;
        warning: "document_outline_extracted" | "document_structure_extracted";
      }
    | null =>
    extractDocumentTreeSeedFromSourcesState(
      goal,
      sources.map((source) => ({ name: source.node.name, text: source.text })),
      documentAdvisorDefaultRoleLabel
    );

  const recoverDocumentTreeResultFromAiRaw = (
    goal: string,
    raw: string,
    sourceName: string
  ): WBSResult | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const candidates = Array.from(
      new Set(
        [
          trimmed,
          trimmed.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim()
        ].filter((value) => value.length > 0)
      )
    );

    for (const candidate of candidates) {
      const recoveredSeed = extractDocumentTreeSeedFromSourcesState(
        goal,
        [{ name: sourceName, text: candidate }],
        documentAdvisorDefaultRoleLabel
      );
      if (recoveredSeed?.result) {
        return recoveredSeed.result;
      }
    }

    return null;
  };

  const maybeTranslateDocumentAdvisorAnalysis = async (
    analysis: DocumentAdvisorAnalysis,
    apiKey?: string
  ): Promise<DocumentAdvisorTranslatedReview | null> => {
    const requestedLanguage =
      documentAdvisorTranslationMode === "source"
        ? null
        : documentAdvisorTranslationMode === "auto"
          ? language
          : documentAdvisorManualTranslationLanguage;
    const targetLanguage = resolveDocumentTranslationTarget(
      documentAdvisorTranslationMode,
      analysis.detectedLanguage,
      language,
      documentAdvisorManualTranslationLanguage
      );
      if (!targetLanguage) {
        return null;
      }
      const normalizedApiKey = apiKey?.trim() ?? "";
      if (!normalizedApiKey) {
        return buildDocumentAdvisorTranslatedReviewFallback(analysis, {
          mode: documentAdvisorTranslationMode,
          requestedLanguage,
          targetLanguage,
          warning: "missing_api_key"
        });
      }

    const sourceLanguageLabel =
      analysis.detectedLanguage === "unknown" ? null : LANGUAGE_LABELS[analysis.detectedLanguage];
    const targetLanguageLabel = LANGUAGE_LABELS[targetLanguage];
    const payload = {
      summary: analysis.summary,
      preview_lines: analysis.previewLines,
      sections: analysis.sections.map((section) => ({
        id: section.id,
        title: section.title,
        goal: section.goal,
        preview_lines: section.previewLines
      }))
    };

    let raw = "";
    try {
      raw = await runAiPromptAnalysis({
        apiKey: normalizedApiKey,
        aiEngine: "cloud",
        systemPrompt: [
          "You are an expert business document review translator.",
          "Return only valid JSON with no markdown.",
          "Preserve ids, array structure, and order exactly.",
          "Translate summary, preview_lines, section title, and section goal only.",
          "Do not add or remove sections."
        ].join(" "),
        userPrompt: [
          `Translate this document review JSON into ${targetLanguageLabel}.`,
          sourceLanguageLabel ? `Source language: ${sourceLanguageLabel}.` : "",
          "",
          "JSON:",
          JSON.stringify(payload, null, 2)
        ]
          .filter((line) => line.trim().length > 0)
          .join("\n")
        });
      } catch {
        return buildDocumentAdvisorTranslatedReviewFallback(analysis, {
          mode: documentAdvisorTranslationMode,
          requestedLanguage,
          targetLanguage,
          warning: "ai_request_failed"
        });
      }

      return parseDocumentAdvisorTranslatedReview(raw, analysis, {
        mode: documentAdvisorTranslationMode,
        requestedLanguage,
        targetLanguage
      });
    };

  const getDocumentAdvisorTranslationWarningMessage = (
    translationWarning?: string,
    targetLanguage?: LanguageCode | null
  ): string | null =>
    getDocumentAdvisorTranslationWarningMessageState(t, language, translationWarning, targetLanguage);

  const getDocumentAdvisorTreeProposalWarningMessage = (proposal?: DocumentAdvisorTreeProposal | null): string | null =>
    getDocumentAdvisorTreeProposalWarningMessageState(t, language, proposal);

  const normalizeDocumentAdvisorCatalogText = (value: string): string =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/['’]/g, " ")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const buildDocumentAdvisorTreeProposal = async ({
    target,
    refinementRequest,
    currentProposal
  }: {
    target: AppNode;
    refinementRequest?: string;
    currentProposal?: DocumentAdvisorTreeProposal | null;
  }): Promise<DocumentAdvisorTreeProposal> => {
    const textBackedSources = await collectDocumentAdvisorTextSources(target);
    const detectedSourceLanguage = detectDocumentLanguage(textBackedSources.map((entry) => entry.text).join("\n\n")).language;
    const primarySource = textBackedSources[0] ?? (await readDocumentTextSource(target));
    const goal = stripFileExtension(primarySource.node.name) || primarySource.node.name || "Document Outline";
    const rootParentId = resolveCommandParentId() ?? activeProjectRootId ?? null;
    const sourceScope = textBackedSources.length > 1 ? "selected_documents" : "selected_document";
    const sourceSelectionKey = textBackedSources.map((entry) => entry.node.id).join("|");
    const sourceDocuments: DocumentAdvisorTreeProposalSourceDocument[] = textBackedSources.map((entry) => ({
      node_id: entry.node.id,
      name: entry.node.name,
      type: entry.node.type,
      section_title: null
    }));
    const preferredOutputLanguage = resolveDocumentTreeOutputLanguage(
      documentAdvisorTranslationMode,
      detectedSourceLanguage,
      language,
      documentAdvisorManualTranslationLanguage
    );
    const shouldNormalizeDocumentTreeToCatalog = detectedSourceLanguage === "FR" || preferredOutputLanguage === "FR";
    const directGenerationTargetLanguage =
      resolveDocumentTranslationTarget(
        documentAdvisorTranslationMode,
        detectedSourceLanguage,
        language,
        documentAdvisorManualTranslationLanguage
      ) === null
        ? preferredOutputLanguage
        : undefined;
    const trimmedRefinement = refinementRequest?.trim() ?? "";
    const apiKey = getSavedMistralApiKey();
    const extractedSeed = extractDocumentTreeSeedFromSources(goal, textBackedSources);
    const sectionSeed =
      !extractedSeed &&
      documentAdvisorAnalysis &&
      documentAdvisorAnalysis.nodeId === target.id &&
      documentAdvisorAnalysis.sections.length >= 2
        ? {
            result: {
              goal,
              value_summary: `Tree extracted from detected document sections in "${primarySource.node.name}".`,
              nodes: documentAdvisorAnalysis.sections
                .slice(0, 18)
                .map((section) =>
                  buildOutlineWbsNodeState(
                    section.title,
                    1,
                    undefined,
                    section.goal,
                    undefined,
                    undefined,
                    t("document_ai.tree_default_role")
                  )
                )
            },
            sourceMode: "document_structure" as DocumentAdvisorTreeProposalSourceMode,
            warning: "document_structure_extracted" as const
          }
        : null;
    const seed = extractedSeed ?? sectionSeed;
    const relevantTreeMemories = findRelevantApprovedDocumentTreeMemories({
      goal,
      documentName: primarySource.node.name,
      targetLanguage: preferredOutputLanguage,
      limit: 3
    });
    const treeMemoryContext = buildApprovedDocumentTreeExamplesSummary(relevantTreeMemories, {
      maxExamples: 3,
      maxPathsPerExample: 10,
      maxChars: 2200
    });
    const buildProposal = async (
      baseResult: WBSResult,
      mode: DocumentAdvisorTreeProposalMode,
      source: "llm" | "fallback",
      warning: string | undefined,
      sourceMode: DocumentAdvisorTreeProposalSourceMode
    ): Promise<DocumentAdvisorTreeProposal> => {
      const normalizedBaseResult = normalizeDocumentAdvisorTreeForCatalog(baseResult, {
        enabled: shouldNormalizeDocumentTreeToCatalog
      });
      const translation = await maybeTranslateDocumentTreeResult(normalizedBaseResult, {
        mode: documentAdvisorTranslationMode,
        sourceLanguage: detectedSourceLanguage,
        appLanguage: language,
        manualTargetLanguage: documentAdvisorManualTranslationLanguage,
        apiKey: apiKey ?? undefined
      });
      return {
        targetNodeId: target.id,
        goal,
        mode,
        baseResult: normalizedBaseResult,
        result: translation.result,
        source,
        warning,
        translationMode: documentAdvisorTranslationMode,
        translationRequestedLanguage:
          documentAdvisorTranslationMode === "source"
            ? null
            : documentAdvisorTranslationMode === "auto"
              ? language
              : documentAdvisorManualTranslationLanguage,
        translationTargetLanguage: translation.targetLanguage,
        detectedSourceLanguage,
        translationApplied: translation.applied,
        translationWarning: translation.warning,
        sourceMode,
        sourceScope,
        rootParentId,
        sourceDocuments,
        sourceSelectionKey,
        refinementHistory: currentProposal?.refinementHistory ?? []
      };
    };
    const buildSeedProposal = async (): Promise<DocumentAdvisorTreeProposal | null> =>
      seed ? buildProposal(seed.result, "outline", "fallback", seed.warning, seed.sourceMode) : null;

    if (!trimmedRefinement && !apiKey) {
      const seedProposal = await buildSeedProposal();
      if (seedProposal) {
        return seedProposal;
      }
    }

    const currentProposalContext =
      currentProposal && currentProposal.result.nodes.length > 0
        ? [
            "Current proposed tree:",
            ...formatWbsNodesForPrompt(currentProposal.result.nodes),
            "",
            "Current value summary:",
            currentProposal.result.value_summary.trim()
          ].join("\n")
        : "";
    const seedContext =
      seed && seed.result.nodes.length > 0
        ? [
            "Baseline extracted structure from the selected document set:",
            ...formatWbsNodesForPrompt(seed.result.nodes),
            "",
            "Use this baseline as the default hierarchy unless the source evidence clearly supports a better grouping."
          ].join("\n")
        : "";
    const refinementContext = trimmedRefinement
      ? [
          "Refinement request:",
          trimmedRefinement,
          "Update the proposed tree to satisfy this request while staying grounded in the source document.",
          "Preserve the strongest existing structure where it still makes sense."
        ].join("\n")
      : "";

    const { maxDocuments, maxTotalChars, maxExcerptChars, minExcerptChars } = getWbsSourceExcerptLimits(Boolean(seed));
    let remainingChars = maxTotalChars;
    const sourceLines: string[] = [];
    for (const entry of textBackedSources.slice(0, maxDocuments)) {
      if (remainingChars <= 0) break;
      const numberLabel = scopedNumbering.get(entry.node.id) ?? numbering.get(entry.node.id) ?? "-";
      const excerptBudget = Math.max(minExcerptChars, Math.min(maxExcerptChars, remainingChars));
      const excerpt = entry.text.slice(0, excerptBudget);
      sourceLines.push(
        `[${numberLabel}|${entry.node.name}] type=${entry.node.type}\n${excerpt}${entry.text.length > excerpt.length ? "..." : ""}`
      );
      remainingChars -= excerpt.length;
    }

    const context = [
      `Workspace: ${activeProject?.name ?? t("project.none")}`,
      `Selected node: ${target.name}`,
      `View: ${workspaceMode === "grid" ? "desktop" : "timeline"}`,
      "WBS source mode: selected_document",
      `WBS source scope: ${sourceScope}`,
      "This task is to extract the document structure, not to invent a generic delivery template.",
      "Build the tree primarily from the selected document evidence below.",
      "Prefer the document's methodology headings, sections, and subsections as node titles whenever they are clear.",
      "If multiple selected documents are provided, synthesize one coherent tree that reflects the shared methodology.",
      "If the source describes deliverables, phases, or milestones, preserve them in the breakdown.",
      "Do not invent generic phases such as success criteria, implementation, release, or rollout unless the source document explicitly contains them.",
      "When a section clearly belongs to an existing ODE capability path, place it inside that path instead of returning it as a stray standalone top-level node.",
      "Example: if the source points to GPEC, nest it under Pilotage > Gestion RH > Effectif rather than outputting GPEC as a separate parent at the root.",
      "Leave a node description empty when the source does not provide a clear explanation. Do not restate the title as filler.",
      "Leave a node objective empty when the source does not clearly state one.",
      seedContext,
      treeMemoryContext ? "Approved AI tree memory examples:" : "",
      treeMemoryContext,
      currentProposalContext,
      refinementContext,
      "",
      "Source documents:",
      sourceLines.join("\n\n")
    ]
      .filter((line) => line.trim().length > 0)
      .join("\n");

    if (!apiKey) {
      throw new Error(t("document_ai.tree_proposal_requires_ai_key"));
    }

    let generated:
      | {
          result: WBSResult;
          source: "llm" | "fallback";
          raw: string;
          warning?: string;
        }
      | null = null;
    try {
      generated = await generateAiWorkBreakdown({
        goal,
        context,
        targetLanguage: directGenerationTargetLanguage,
        apiKey,
        aiEngine: "cloud",
        promptPreset: "document_tree"
      });
    } catch (error) {
      if (!trimmedRefinement) {
        const seedProposal = await buildSeedProposal();
        if (seedProposal) {
          return seedProposal;
        }
      }
      throw error;
    }

    const { result, source: generationSource, warning, raw } = generated;

    if (generationSource === "fallback") {
      const recoveredFromRaw = recoverDocumentTreeResultFromAiRaw(goal, raw, `${primarySource.node.name} AI response`);
      if (recoveredFromRaw) {
        return buildProposal(recoveredFromRaw, "ai", "llm", warning, "selected_document");
      }
    }

    if (generationSource === "fallback") {
      if (!trimmedRefinement) {
        const seedProposal = await buildSeedProposal();
        if (seedProposal) {
          return seedProposal;
        }
      }
      throw new Error(
        t("document_ai.tree_proposal_requires_grounded_ai", {
          reason: warning ?? "fallback"
        })
      );
    }

    const proposal = await buildProposal(result, "ai", generationSource, warning, "selected_document");
    return {
      ...proposal,
      refinementHistory: trimmedRefinement
        ? [...(currentProposal?.refinementHistory ?? []), trimmedRefinement]
        : currentProposal?.refinementHistory ?? []
    };
  };

  const filterDocumentAdvisorTreeProposal = (
    proposal: DocumentAdvisorTreeProposal | null | undefined,
    selectedNodeKeys?: string[] | null
  ): DocumentAdvisorTreeProposal | null => {
    if (!proposal) return null;
    if (!selectedNodeKeys) {
      return proposal;
    }
    const allKeys = collectDocumentTreeProposalNodeKeys(proposal.result.nodes);
    if (allKeys.length === 0) {
      return proposal;
    }
    const normalizedSelectedKeys = Array.from(
      new Set((selectedNodeKeys ?? []).map((value) => value.trim()).filter((value) => value.length > 0))
    );
    if (normalizedSelectedKeys.length === 0) {
      return null;
    }
    if (normalizedSelectedKeys.length === allKeys.length && normalizedSelectedKeys.every((value, index) => value === allKeys[index])) {
      return proposal;
    }
    const selectedKeySet = new Set(normalizedSelectedKeys);
    const filteredNodes = filterDocumentTreeProposalNodes(proposal.result.nodes, selectedKeySet);
    if (filteredNodes.length === 0) {
      return null;
    }
    return {
      ...proposal,
      result: {
        ...proposal.result,
        nodes: filteredNodes
      }
    };
  };

  const executeDocumentAdvisorTreeProposal = async (
    proposal: DocumentAdvisorTreeProposal
  ): Promise<AppNode | null> => {
    const createdRoot = await materializeWbsResult(
      proposal.rootParentId,
      proposal.result,
      proposal.source,
      proposal.warning,
      {
        input_mode: "document_advisor",
        source_mode: proposal.sourceMode,
        source_scope: proposal.sourceScope,
        source_documents: proposal.sourceDocuments,
        translation: {
          mode: proposal.translationMode,
          target_language: proposal.translationTargetLanguage,
          source_language: proposal.detectedSourceLanguage,
          applied: proposal.translationApplied,
          warning: proposal.translationWarning ?? null
        }
      }
    );
    if (!createdRoot) {
      return null;
    }

    const generationTarget = await resolveOdeAwareGenerationTarget(proposal.rootParentId);
    if (proposal.mode === "outline") {
      setProjectNotice(
        proposal.warning === "document_structure_extracted"
          ? proposal.sourceScope === "selected_documents"
            ? `Tree extracted from selected documents for "${proposal.goal}".`
            : `Tree extracted from document structure for "${proposal.goal}".`
          : `Tree extracted from document outline for "${proposal.goal}".`
      );
      return createdRoot;
    }

    setProjectNotice(
      generationTarget.odeCreation.createAs === "generic"
        ? proposal.source === "llm"
          ? proposal.sourceScope === "selected_documents"
            ? `AI WBS created from selected documents for "${proposal.goal}".`
            : `AI WBS created from document context for "${proposal.goal}".`
          : proposal.sourceScope === "selected_documents"
            ? `WBS fallback template created from selected documents for "${proposal.goal}".`
            : `WBS fallback template created from document context for "${proposal.goal}".`
        : generationTarget.odeCreation.createAs === "chantier"
          ? proposal.source === "llm"
            ? proposal.sourceScope === "selected_documents"
              ? `AI chantier created from selected documents for "${proposal.goal}".`
              : `AI chantier created from document context for "${proposal.goal}".`
            : proposal.sourceScope === "selected_documents"
              ? `Chantier fallback template created from selected documents for "${proposal.goal}".`
              : `Chantier fallback template created from document context for "${proposal.goal}".`
          : proposal.source === "llm"
            ? proposal.sourceScope === "selected_documents"
              ? `AI chantier tasks created from selected documents for "${proposal.goal}".`
              : `AI chantier tasks created from document context for "${proposal.goal}".`
            : proposal.sourceScope === "selected_documents"
              ? `Chantier tasks fallback template created from selected documents for "${proposal.goal}".`
              : `Chantier tasks fallback template created from document context for "${proposal.goal}".`
    );
    return createdRoot;
  };

  const getFreshNodeForAi = async (node: AppNode): Promise<AppNode> => {
    let current = node;
    try {
      current = (await getNode(node.id)) ?? node;
    } catch {
      current = node;
    }
    if (node.type !== "file") {
      if (getNodeTextForAi(current).length > 0) {
        return current;
      }
      return current;
    }

    const mirrorFilePath = getNodeMirrorFilePath(current) ?? getNodeMirrorFilePath(node);
    if (mirrorFilePath) {
      try {
        const extractedText = await extractDocumentText(mirrorFilePath, {
          extension: extractFileExtensionLower(current.name || node.name),
          nodeId: node.id
        });
        if (typeof extractedText === "string" && extractedText.trim().length > 0) {
          return {
            ...current,
            content: extractedText
          };
        }
      } catch {
        // Fall back to cached/polled content if direct parsing cannot read the file yet.
      }
    }

    if (getNodeTextForAi(current).length > 0) {
      return current;
    }

    const retryDelays = [200, 450, 800, 1200];
    for (const delay of retryDelays) {
      await waitForMs(delay);
      try {
        const refreshed = await getNode(node.id);
        if (!refreshed) break;
        current = refreshed;
        if (getNodeTextForAi(current).length > 0) {
          return current;
        }
      } catch {
        break;
      }
    }
    return current;
  };

  const isDocumentCandidateNode = (node: AppNode | null | undefined): node is AppNode => {
    if (!node || node.type === "folder") return false;
    if (node.type === "file" || node.type === "document" || node.type === "report" || node.type === "minutes") {
      return true;
    }
    return getNodeTextForAi(node).length > 0;
  };

  const isDocumentAdvisorEligibleNode = (node: AppNode | null | undefined): node is AppNode =>
    Boolean(node && (node.type === "file" || node.type === "document" || node.type === "report" || node.type === "minutes"));

  const isTextDocumentNode = (node: AppNode | null | undefined): node is AppNode =>
    Boolean(node && node.type === "file" && TEXT_PREVIEW_EXTENSIONS.has(extractFileExtensionLower(node.name)));

  const readDocumentTextSource = async (node: AppNode): Promise<{ node: AppNode; text: string }> => {
    const freshNode = await getFreshNodeForAi(node);
    const text = getDocumentAdvisorLines(getNodeTextForAi(freshNode)).join("\n");
    if (text.length === 0) {
      throw new Error(isTextDocumentNode(freshNode) ? "Selected text file is empty." : "Selected document has no readable text yet.");
    }
    return { node: freshNode, text };
  };

  const collectDocumentAdvisorTextSources = async (
    target: AppNode,
    maxSources = 6
  ): Promise<Array<{ node: AppNode; text: string }>> => {
    const selectedIds = selectedNodeIds.size > 0 ? Array.from(selectedNodeIds) : [target.id];
    const orderedCandidateIds = [target.id, ...selectedIds.filter((id) => id !== target.id)];
    const candidateNodes = orderedCandidateIds
      .map((id) => (id === target.id ? target : nodeById.get(id) ?? null))
      .filter((node): node is AppNode => node !== null && isDocumentCandidateNode(node));

    const dedupedCandidates: AppNode[] = [];
    const seenCandidateIds = new Set<string>();
    for (const candidate of candidateNodes) {
      if (seenCandidateIds.has(candidate.id)) continue;
      seenCandidateIds.add(candidate.id);
      dedupedCandidates.push(candidate);
    }

    const textBackedSources: Array<{ node: AppNode; text: string }> = [];
    for (const candidate of dedupedCandidates.slice(0, maxSources)) {
      const freshNode = await getFreshNodeForAi(candidate);
      const text = getDocumentAdvisorLines(getNodeTextForAi(freshNode)).join("\n");
      if (text.length === 0) continue;
      textBackedSources.push({ node: freshNode, text });
    }

    if (textBackedSources.length === 0) {
      throw new Error(
        dedupedCandidates.length === 1 && isTextDocumentNode(dedupedCandidates[0])
          ? "Selected text file is empty."
          : "Selected document is still parsing or has no readable text yet. Wait a moment after import, then try again."
      );
    }

    return textBackedSources;
  };

  const collectNodeAssistantTextSources = async (
    target: AppNode,
    maxSources = 6,
    selectedDocumentIds?: string[]
  ): Promise<Array<{ node: AppNode; text: string }>> => {
    const candidates = collectNodeAssistantCandidateNodes(target, Math.max(maxSources * 3, maxSources));
    const normalizedSelectedIds = Array.from(
      new Set(
        (selectedDocumentIds ?? [])
          .map((value) => (typeof value === "string" ? value.trim() : ""))
          .filter((value) => value.length > 0)
      )
    );
    const selectedIdSet = new Set(normalizedSelectedIds);
    const hasExplicitSelection = Array.isArray(selectedDocumentIds);
    const orderedCandidates = hasExplicitSelection
      ? selectedIdSet.size > 0
        ? candidates.filter((candidate) => selectedIdSet.has(candidate.id))
        : []
      : candidates;
    const textBackedSources: Array<{ node: AppNode; text: string }> = [];
    for (const candidate of orderedCandidates) {
      if (textBackedSources.length >= maxSources) break;
      const freshNode = await getFreshNodeForAi(candidate);
      const text = getDocumentAdvisorLines(getNodeTextForAi(freshNode)).join("\n").trim();
      if (!text) continue;
      textBackedSources.push({ node: freshNode, text });
    }
    return textBackedSources;
  };

  const assistantNodeContext = useMemo<AiNodeContext | null>(() => {
    const target = getPrimarySelectionNode();
    if (!target) return null;
    const objective = readNodeObjectiveValue(target) ?? null;
    const scheduleStatus = parseNodeTimelineSchedule(target)?.status?.replace(/_/g, " ") ?? null;
    const candidateNodes = collectNodeAssistantCandidateNodes(target, 12);
    return {
      title: target.name,
      pathLabel: getNodePathLabel(target),
      objective,
      scheduleStatus,
      documentCount: candidateNodes.length,
      sourceLabels: candidateNodes.slice(0, 6).map((node) => node.name),
      documents: candidateNodes.map((node) => ({
        id: node.id,
        name: node.name,
        pathLabel: getNodePathLabel(node),
        type: node.type
      }))
    };
  }, [byParent, nodeById, selectedNode, store.selectedNodeId, store.allNodes]);

  const resolveAssistantExistingDeliverables = useCallback(
    (node: AppNode): ODEStructuredDeliverable[] => {
      const ownerNodeId = getWorkareaOwnerNodeId(node, nodeById) ?? node.id;
      const ownerNode = nodeById.get(ownerNodeId) ?? node;
      const workareaDeliverables = buildStructuredDeliverablesFromWorkareaNodes({
        ownerNodeId,
        byParent,
        nodeById
      });
      if (workareaDeliverables.length > 0) {
        return workareaDeliverables;
      }
      return normalizeStructuredDeliverablesForNode(ownerNode.id, ownerNode.properties?.odeStructuredDeliverables);
    },
    [byParent, nodeById]
  );

  const resolveAssistantPlanningTargetNode = useCallback(
    (node: AppNode): AppNode => {
      const ownerNodeId = getWorkareaOwnerNodeId(node, nodeById);
      if (!ownerNodeId) return node;
      return nodeById.get(ownerNodeId) ?? store.allNodes.find((candidate) => candidate.id === ownerNodeId) ?? node;
    },
    [nodeById, store.allNodes]
  );

  const askSelectedNodeAssistant = useCallback(
    async (requestText: string, options?: AiCommandRequestOptions): Promise<AiNodeResponse> => {
      const startedAt = Date.now();
      const apiKey = getSavedMistralApiKey();
      if (!apiKey) {
        throw new Error(t("assistant.mistral_missing_key"));
      }

      const target = getPrimarySelectionNode();
      if (!target) {
        throw new Error("Select a node first.");
      }

      const freshTarget = await getFreshNodeForAi(target);
      const pathLabel = getNodePathLabel(target) ?? target.name;
      const objective = readNodeObjectiveValue(freshTarget) ?? null;
      const scheduleStatus = parseNodeTimelineSchedule(freshTarget)?.status?.replace(/_/g, " ") ?? "none";
      const existingDeliverables = resolveAssistantExistingDeliverables(freshTarget);
      const sourceDocuments = await collectNodeAssistantTextSources(freshTarget, 6, options?.selectedDocumentIds);
      const nodeText = getNodeTextForAi(freshTarget).trim();

      const systemPrompt = [
        "You are ODETool node assistant.",
        "Use the selected node path, parent context, existing objective, existing deliverables, and readable documents.",
        "The node path changes meaning, so always respect the full hierarchy.",
        "If the user asks for deliverables or actions, return concise sections named Summary, Deliverables, and Actions.",
        "For other requests, answer directly in plain text with short sections or bullets when useful.",
        "Do not invent facts. If evidence is weak, say 'Insufficient evidence'.",
        "Do not return markdown tables."
      ].join(" ");

      const deliverableLines =
        existingDeliverables.length > 0
          ? existingDeliverables
              .slice(0, 8)
              .map(
                (deliverable) =>
                  `- ${deliverable.title || "Untitled"} | tasks=${deliverable.tasks.length} | data=${deliverable.data.length}`
              )
              .join("\n")
          : "- none";

      const documentLines =
        sourceDocuments.length > 0
          ? sourceDocuments
              .map(
                (source, index) =>
                  `[${index + 1}|${source.node.name}]\n${source.text.replace(/\s+/g, " ").trim().slice(0, 1400)}`
              )
              .join("\n\n")
          : "No readable documents were found under this node.";

      const userPrompt = [
        `Date: ${toIsoDateOnly(new Date())}`,
        `Workspace: ${activeProject?.name ?? t("project.none")}`,
        `Node: ${freshTarget.name}`,
        `Path: ${pathLabel}`,
        `Type: ${freshTarget.type}`,
        `Schedule status: ${scheduleStatus}`,
        `Objective: ${objective ?? "(none)"}`,
        "",
        `Selected files: ${sourceDocuments.map((source) => source.node.name).join(", ") || "(none)"}`,
        "",
        "Existing deliverables:",
        deliverableLines,
        "",
        "Node text:",
        nodeText ? nodeText.slice(0, 1600) : "(none)",
        "",
        `User request: ${requestText.trim()}`,
        "",
        "Readable documents in scope:",
        documentLines,
        "",
        "Return plain text only."
      ].join("\n");

      try {
        const answer = await runAiPromptAnalysis({
          apiKey,
          systemPrompt,
          userPrompt,
          aiEngine: "cloud"
        });
        recordAiTelemetryEvent({
          flow: "node_assistant",
          source: "assistant",
          actionId: "node_assistant",
          success: true,
          latencyMs: Date.now() - startedAt,
          fallbackUsed: false,
          workspace: activeProject?.name ?? t("project.none"),
          selectedNodeId: freshTarget.id
        });
        return {
          title: pathLabel,
          answer: answer.trim(),
          sourceLabels: sourceDocuments.map((source) => source.node.name)
        };
      } catch (error) {
        recordAiTelemetryEvent({
          flow: "node_assistant",
          source: "assistant",
          actionId: "node_assistant",
          success: false,
          latencyMs: Date.now() - startedAt,
          fallbackUsed: false,
          workspace: activeProject?.name ?? t("project.none"),
          selectedNodeId: freshTarget.id,
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    },
    [
      activeProject,
      byParent,
      language,
      nodeById,
      resolveAssistantExistingDeliverables,
      selectedNode,
      store.selectedNodeId,
      store.allNodes,
      t
    ]
  );

  const buildNodeAssistantPlanSources = (options: {
    target: AppNode;
    requestText: string;
    answerText: string;
    objective: string;
    textSources: Array<{ node: AppNode; text: string }>;
    deliverableTitle?: string;
  }): ODEWorkstreamSource[] => {
    const { target, requestText, answerText, objective, textSources, deliverableTitle } = options;
    const sources: ODEWorkstreamSource[] = [];

    if (objective.trim().length > 0) {
      sources.push({
        sourceId: "objective",
        label: `${target.name} objective`,
        kind: "objective",
        sourceNodeId: target.id,
        excerpt: trimAssistantExcerpt(objective)
      });
    }

    if (requestText.trim().length > 0) {
      sources.push({
        sourceId: "ai-request",
        label: "AI request",
        kind: "description",
        sourceNodeId: target.id,
        excerpt: trimAssistantExcerpt(requestText)
      });
    }

    if (answerText.trim().length > 0) {
      sources.push({
        sourceId: "ai-answer",
        label: "AI answer",
        kind: "description",
        sourceNodeId: target.id,
        excerpt: trimAssistantExcerpt(answerText, 900)
      });
    }

    const nodeBody = getNodeTextForAi(target);
    if (nodeBody.trim().length > 0) {
      sources.push({
        sourceId: "node-body",
        label: `${target.name} notes`,
        kind: "description",
        sourceNodeId: target.id,
        excerpt: trimAssistantExcerpt(nodeBody, 700)
      });
    }

    if (deliverableTitle?.trim()) {
      sources.push({
        sourceId: `deliverable-${deliverableTitle.trim().toLowerCase()}`,
        label: deliverableTitle.trim(),
        kind: "deliverable",
        sourceNodeId: target.id,
        excerpt: null
      });
    }

    for (const source of textSources) {
      sources.push({
        sourceId: `node-${source.node.id}`,
        label: source.node.name,
        kind: source.node.type === "file" ? "document" : "node",
        sourceNodeId: source.node.id,
        excerpt: trimAssistantExcerpt(source.text, 700)
      });
    }

    const deduped = new Map<string, ODEWorkstreamSource>();
    for (const source of sources) {
      if (!deduped.has(source.sourceId)) {
        deduped.set(source.sourceId, source);
      }
    }
    return Array.from(deduped.values());
  };

  const loadAssistantTargetNode = useCallback(
    async (targetNodeId: string): Promise<AppNode> => {
      const current = nodeById.get(targetNodeId) ?? null;
      if (current) {
        return getFreshNodeForAi(current);
      }
      const loaded = await getNode(targetNodeId);
      if (!loaded) {
        throw new Error("Selected node no longer exists.");
      }
      return loaded;
    },
    [nodeById]
  );

  const openNodeDeliverableProposal = useCallback(
    async (requestText: string, options?: AiCommandRequestOptions) => {
      const apiKey = getSavedMistralApiKey();
      if (!apiKey) {
        throw new Error(t("assistant.mistral_missing_key"));
      }

      const target = getPrimarySelectionNode();
      if (!target) {
        throw new Error("Select a node first.");
      }

      const planTarget = resolveAssistantPlanningTargetNode(target);
      const freshTarget = await getFreshNodeForAi(planTarget);
      const objective = readNodeObjectiveValue(freshTarget)?.trim() || freshTarget.name;
      const existingDeliverables = resolveAssistantExistingDeliverables(freshTarget);
      const textSources = await collectNodeAssistantTextSources(freshTarget, 6, options?.selectedDocumentIds);
      const description =
        [freshTarget.description?.trim(), requestText.trim()].filter((item) => Boolean(item && item.length > 0)).join("\n\n") ||
        objective;
      const sources = buildNodeAssistantPlanSources({
        target: freshTarget,
        requestText,
        answerText: "",
        objective,
        textSources
      });
      const proposal = await generateDeliverableProposal({
        apiKey,
        nodeId: freshTarget.id,
        nodeTitle: freshTarget.name,
        targetLanguage: language,
        description,
        existingDeliverables: existingDeliverables.map((deliverable) => deliverable.title.trim()).filter(Boolean),
        sources
      });

      setAssistantDeliverableProposalState({
        targetNodeId: freshTarget.id,
        nodeTitle: freshTarget.name,
        proposal
      });
      setCommandBarOpen(false);
      setDocumentAdvisorOpen(false);
    },
    [language, resolveAssistantExistingDeliverables, resolveAssistantPlanningTargetNode, t]
  );

  const openNodeIntegratedPlanProposal = useCallback(
    async (requestText: string, options?: AiCommandRequestOptions) => {
      const apiKey = getSavedMistralApiKey();
      if (!apiKey) {
        throw new Error(t("assistant.mistral_missing_key"));
      }

      const target = getPrimarySelectionNode();
      if (!target) {
        throw new Error("Select a node first.");
      }

      const planTarget = resolveAssistantPlanningTargetNode(target);
      const freshTarget = await getFreshNodeForAi(planTarget);
      const objective = readNodeObjectiveValue(freshTarget)?.trim() || freshTarget.name;
      const existingDeliverables = resolveAssistantExistingDeliverables(freshTarget);
      const textSources = await collectNodeAssistantTextSources(freshTarget, 6, options?.selectedDocumentIds);
      const description =
        [freshTarget.description?.trim(), requestText.trim()].filter((item) => Boolean(item && item.length > 0)).join("\n\n") ||
        objective;
      const deliverableSources = buildNodeAssistantPlanSources({
        target: freshTarget,
        requestText,
        answerText: "",
        objective,
        textSources
      });

      const proposal = await generateIntegratedPlanProposal({
        apiKey,
        nodeId: freshTarget.id,
        nodeTitle: freshTarget.name,
        targetLanguage: language,
        description,
        objective,
        existingDeliverables,
        deliverableSources,
        buildTaskSources: (deliverable) =>
          buildNodeAssistantPlanSources({
            target: freshTarget,
            requestText,
            answerText: "",
            objective,
            textSources,
            deliverableTitle: deliverable.title
          })
      });

      setAssistantIntegratedPlanProposalState({
        targetNodeId: freshTarget.id,
        nodeTitle: freshTarget.name,
        proposal
      });
      setCommandBarOpen(false);
      setDocumentAdvisorOpen(false);
    },
    [language, resolveAssistantExistingDeliverables, resolveAssistantPlanningTargetNode, t]
  );

  const applyNodeAssistantPlan = useCallback(
    async (requestText: string, answerText: string, options?: AiCommandRequestOptions) => {
      const apiKey = getSavedMistralApiKey();
      if (!apiKey) {
        throw new Error(t("assistant.mistral_missing_key"));
      }

      const target = getPrimarySelectionNode();
      if (!target) {
        throw new Error("Select a node first.");
      }

      const planTarget = resolveAssistantPlanningTargetNode(target);
      const freshTarget = await getFreshNodeForAi(planTarget);
      const objective = readNodeObjectiveValue(freshTarget)?.trim() || freshTarget.name;
      const existingDeliverables = resolveAssistantExistingDeliverables(freshTarget);
      const combinedDescription = [requestText.trim(), answerText.trim()].filter((item) => item.length > 0).join("\n\n");
      const textSources = await collectNodeAssistantTextSources(freshTarget, 6, options?.selectedDocumentIds);
      const deliverableSources = buildNodeAssistantPlanSources({
        target: freshTarget,
        requestText,
        answerText,
        objective,
        textSources
      });

      const proposal = await generateIntegratedPlanProposal({
        apiKey,
        nodeId: freshTarget.id,
        nodeTitle: freshTarget.name,
        targetLanguage: language,
        description: combinedDescription,
        objective,
        existingDeliverables,
        deliverableSources,
        buildTaskSources: (deliverable) =>
          buildNodeAssistantPlanSources({
            target: freshTarget,
            requestText,
            answerText,
            objective,
            textSources,
            deliverableTitle: deliverable.title
          })
      });

      setAssistantIntegratedPlanProposalState({
        targetNodeId: freshTarget.id,
        nodeTitle: freshTarget.name,
        proposal
      });
      setCommandBarOpen(false);
      setDocumentAdvisorOpen(false);
    },
    [language, resolveAssistantExistingDeliverables, resolveAssistantPlanningTargetNode, t]
  );

  const acceptAssistantDeliverableProposal = useCallback(async () => {
    const current = assistantDeliverableProposalState;
    if (!current) return;
    try {
      const freshTarget = await loadAssistantTargetNode(current.targetNodeId);
      const objective = readNodeObjectiveValue(freshTarget)?.trim() || freshTarget.name;
      const nextDeliverables: ODEStructuredDeliverable[] = current.proposal.deliverables.map((deliverable) => ({
        id: deliverable.id,
        title: deliverable.title,
        tasks: [],
        notifications: [],
        data: []
      }));
      await applyStructuredDeliverablesToWorkareaTree(freshTarget.id, nextDeliverables, {
        objective
      });
      await refreshTreeAndKeepContext(freshTarget.id, [freshTarget.id], "tree");
      await openNodeInWorkarea(freshTarget.id);
      setAssistantDeliverableProposalState(null);
      setProjectNotice(`AI applied deliverables to "${freshTarget.name}".`);
    } catch (error) {
      setProjectNotice(error instanceof Error ? error.message : String(error));
    }
  }, [
    applyStructuredDeliverablesToWorkareaTree,
    assistantDeliverableProposalState,
    loadAssistantTargetNode,
    openNodeInWorkarea,
    refreshTreeAndKeepContext
  ]);

  const acceptAssistantIntegratedPlanProposal = useCallback(async () => {
    const current = assistantIntegratedPlanProposalState;
    if (!current) return;
    try {
      const freshTarget = await loadAssistantTargetNode(current.targetNodeId);
      const objective = readNodeObjectiveValue(freshTarget)?.trim() || freshTarget.name;
      const nextDeliverables: ODEStructuredDeliverable[] = current.proposal.deliverables.map((deliverable) => ({
        id: deliverable.id,
        title: deliverable.title,
        tasks: buildExecutionTasksFromProposal(deliverable.taskProposal),
        notifications: [],
        data: []
      }));
      const nextWorkspaces = current.proposal.deliverables.map((deliverable) =>
        buildWorkstreamWorkspaceFromProposal(deliverable.taskProposal)
      );
      await applyStructuredDeliverablesToWorkareaTree(freshTarget.id, nextDeliverables, {
        objective,
        workspaces: nextWorkspaces
      });
      await refreshTreeAndKeepContext(freshTarget.id, [freshTarget.id], "tree");
      await openNodeInWorkarea(freshTarget.id);

      setAssistantIntegratedPlanProposalState(null);
      setProjectNotice(`AI applied deliverables and tasks to "${freshTarget.name}".`);
    } catch (error) {
      setProjectNotice(error instanceof Error ? error.message : String(error));
    }
  }, [
    applyStructuredDeliverablesToWorkareaTree,
    assistantIntegratedPlanProposalState,
    loadAssistantTargetNode,
    openNodeInWorkarea,
    refreshTreeAndKeepContext
  ]);

  const getDocumentAdvisorKindLabel = (kind: DocumentAdvisorKind): string => {
    if (kind === "numbered_outline") return t("document_ai.kind.numbered_outline");
    if (kind === "structured_document") return t("document_ai.kind.structured_document");
    if (kind === "narrative_document") return t("document_ai.kind.narrative_document");
    return t("document_ai.kind.mixed_document");
  };

  const buildDocumentAdvisorActions = (
    kind: DocumentAdvisorKind,
    metrics: {
      outlineLineCount: number;
      maxOutlineLevel: number;
      sectionCount: number;
      selectedSectionTitle: string | null;
      naMatch: DocumentAdvisorNAMatch | null;
      naChantierReady: boolean;
    }
  ): DocumentAdvisorAction[] => buildDocumentAdvisorActionsState(kind, metrics, t);

  const analyzeDocumentAdvisorTarget = async (node: AppNode): Promise<DocumentAdvisorAnalysis> => {
    const { node: freshNode, text } = await readDocumentTextSource(node);
    const languageDetection = detectDocumentLanguage(text);
    const lines = getDocumentAdvisorLines(text);
    const paragraphCount = text
      .split(/\n{2,}/)
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.length > 0).length;
    const outlineMatches = extractOutlineRows(lines);
    const shortStructuredLineCount = lines.filter(
      (line) => line.length >= 4 && line.length <= 96 && !/[.!?]$/.test(line)
    ).length;
    const outlineCoverage = outlineMatches.length / Math.max(1, lines.length);
    const maxOutlineLevel = outlineMatches.reduce((highest, row) => Math.max(highest, row.level), 0);
    const averageLineLength =
      lines.reduce((total, line) => total + line.length, 0) / Math.max(1, lines.length);
    const outlineCandidate = parseNumberedOutlineToWbs(stripFileExtension(freshNode.name), freshNode.name, text);
    const sections = extractDocumentAdvisorSections(lines, outlineCandidate ? outlineMatches : []);
    const naMatch = formatDocumentAdvisorNAMatch(await mapToNA(text));
    const naChantierReady = Boolean(naMatch && (await resolveLevel4NATargetNode(naMatch.code, freshNode)).node);

    let documentKind: DocumentAdvisorKind = "mixed_document";
    if (outlineCandidate) {
      documentKind = "numbered_outline";
    } else if (shortStructuredLineCount / Math.max(1, lines.length) >= 0.35) {
      documentKind = "structured_document";
    } else if (paragraphCount >= 3 || averageLineLength >= 100) {
      documentKind = "narrative_document";
    }

    const summary =
      documentKind === "numbered_outline"
        ? t("document_ai.summary_outline", {
            count: outlineMatches.length,
            levels: Math.max(2, maxOutlineLevel)
          })
        : documentKind === "structured_document"
          ? t("document_ai.summary_structured", { count: lines.length })
          : documentKind === "narrative_document"
            ? t("document_ai.summary_narrative", { count: paragraphCount })
            : t("document_ai.summary_mixed", { count: lines.length });

    return {
      nodeId: freshNode.id,
      nodeName: freshNode.name,
      nodeType: freshNode.type,
      documentKind,
      summary,
      lineCount: lines.length,
      outlineLineCount: outlineMatches.length,
      outlineCoverage,
      maxOutlineLevel,
      detectedLanguage: languageDetection.language,
      detectedLanguageConfidence: languageDetection.confidence,
      previewLines: buildPreviewLines(lines, 4),
      sections,
      naMatch,
      naChantierReady,
      actions: buildDocumentAdvisorActions(documentKind, {
        outlineLineCount: outlineMatches.length,
        maxOutlineLevel,
        sectionCount: sections.length,
        selectedSectionTitle: sections[0]?.title ?? null,
        naMatch,
        naChantierReady
      })
    };
  };

  const getDocumentAdvisorSelectedSection = (
    analysis: DocumentAdvisorAnalysis | null,
    selectedSectionId: string
  ): DocumentAdvisorSection | null => getDocumentAdvisorSelectedSectionState(analysis, selectedSectionId);

  const getDocumentAdvisorActions = (
    analysis: DocumentAdvisorAnalysis | null,
    selectedSectionId: string
  ): DocumentAdvisorAction[] => getDocumentAdvisorActionsState(analysis, selectedSectionId, t);

  const buildDocumentAdvisorTelemetryContext = (
    analysis: DocumentAdvisorAnalysis,
    selectedSectionId: string,
    actionId: DocumentAdvisorActionId
  ): AiTelemetryDocumentAdvisorContext =>
    buildDocumentAdvisorTelemetryContextState(analysis, selectedSectionId, actionId, t);

  useEffect(() => {
    return () => {
      odeImportPreviewResolverRef.current?.(false);
      odeImportPreviewResolverRef.current = null;
    };
  }, []);

  const closeOdeImportPreview = useCallback(() => {
    const resolve = odeImportPreviewResolverRef.current;
    odeImportPreviewResolverRef.current = null;
    setOdeImportPreviewState(null);
    resolve?.(false);
  }, []);

  const confirmOdeImportPreview = useCallback(() => {
    const resolve = odeImportPreviewResolverRef.current;
    odeImportPreviewResolverRef.current = null;
    setOdeImportPreviewState(null);
    resolve?.(true);
  }, []);

  const requestOdeImportConfirmation = useCallback(
    (previewState: ODEImportPreviewDialogState) =>
      new Promise<boolean>((resolve) => {
        odeImportPreviewResolverRef.current?.(false);
        odeImportPreviewResolverRef.current = resolve;
        setOdeImportPreviewState(previewState);
      }),
    []
  );

  const buildDocumentAdvisorSourceDocumentsFingerprint = (value: unknown): string => {
    if (!Array.isArray(value)) return "";
    return value
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const candidate = entry as Record<string, unknown>;
        const nodeId = typeof candidate.node_id === "string" ? candidate.node_id.trim() : "";
        const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
        const type = typeof candidate.type === "string" ? candidate.type.trim() : "";
        const sectionTitle =
          typeof candidate.section_title === "string" ? candidate.section_title.trim() : "";
        if (!nodeId && !name) return null;
        return [nodeId, name, type, sectionTitle].join("|");
      })
      .filter((entry): entry is string => Boolean(entry))
      .sort((left, right) => left.localeCompare(right))
      .join("::");
  };

  const buildDocumentAdvisorWbsFingerprint = (
    goal: string,
    wbsMeta: Record<string, unknown> | null | undefined
  ): string | null => {
    if (!wbsMeta || wbsMeta.input_mode !== "document_advisor") return null;
    const normalizedGoal = goal.trim();
    if (!normalizedGoal) return null;
    const sourceMode = typeof wbsMeta.source_mode === "string" ? wbsMeta.source_mode.trim() : "";
    const sourceScope = typeof wbsMeta.source_scope === "string" ? wbsMeta.source_scope.trim() : "";
    const sourceDocuments = buildDocumentAdvisorSourceDocumentsFingerprint(wbsMeta.source_documents);
    return [normalizedGoal, sourceMode, sourceScope, sourceDocuments].join("||");
  };

  const findDuplicateDocumentAdvisorRoots = async (
    parentId: string | null,
    goal: string,
    wbsMeta: Record<string, unknown> | null | undefined
  ): Promise<AppNode[]> => {
    const fingerprint = buildDocumentAdvisorWbsFingerprint(goal, wbsMeta);
    if (!fingerprint) return [];
    const siblings = await getChildren(parentId);
    return siblings.filter((node) => {
      if (node.type !== "folder") return false;
      const rawWbs = node.properties?.wbs;
      if (!rawWbs || typeof rawWbs !== "object") return false;
      const existingWbs = rawWbs as Record<string, unknown>;
      const existingGoal = typeof existingWbs.goal === "string" ? existingWbs.goal : "";
      return buildDocumentAdvisorWbsFingerprint(existingGoal, existingWbs) === fingerprint;
    });
  };

  const materializeWbsResult = async (
    rootParentId: string | null,
    result: WBSResult,
    source: "llm" | "fallback",
    warning?: string,
    extraWbsMeta?: Record<string, unknown>,
    odeConfidence?: number,
    extraRootProperties?: Record<string, unknown>
  ): Promise<AppNode | null> => {
    if (!ensureStructureMutationAllowed([rootParentId])) return null;
    const generationTarget = await resolveOdeAwareGenerationTarget(rootParentId);
    const parentNode = generationTarget.parentNode;
    const odeCreation = generationTarget.odeCreation;
    if (!odeCreation.allowed) {
      throw new Error(odeCreation.reason ?? "ODE structure blocks AI-generated creation at this level.");
    }
    const previewConfidence = Math.max(0, Math.min(1, odeConfidence ?? (source === "llm" ? 0.92 : 0.74)));
    if (odeCreation.createAs === "chantier" || odeCreation.createAs === "task") {
      const previewWarnings: string[] = [];
      if (warning || source === "fallback") {
        previewWarnings.push(t("ode_import_preview.warning_fallback"));
      }
      if (odeCreation.createAs === "task") {
        previewWarnings.push(t("ode_import_preview.warning_expand"));
      }
      if (previewConfidence < 0.78) {
        previewWarnings.push(
          t("ode_import_preview.warning_low_confidence", {
            percent: Math.round(previewConfidence * 100)
          })
        );
      }
      const confirmed = await requestOdeImportConfirmation({
        preview: buildODEImportPreview({
          targetNodeId: parentNode?.id ?? rootParentId,
          targetNA: odeCreation.naCode,
          targetLabel: generationTarget.naLabel,
          confidence: previewConfidence,
          warnings: previewWarnings,
          chantierTitle: result.goal,
          nodes: result.nodes
        }),
        createAs: odeCreation.createAs,
        targetNodeName: parentNode?.name ?? null,
        targetPathLabel: generationTarget.naPathLabel
      });
      if (!confirmed) {
        return null;
      }
    }
    const odeTrace: ODETraceMeta | null =
      odeCreation.createAs !== "generic"
        ? {
            sourceType: "ai_wbs",
            sourceRef: result.goal,
            confidence: previewConfidence,
            generatedAt: new Date().toISOString(),
            sourceNodeId: parentNode?.id ?? null
          }
        : null;
    const existingDocumentAdvisorRoots = await findDuplicateDocumentAdvisorRoots(
      rootParentId,
      result.goal,
      extraWbsMeta
    );
    for (const existingRoot of existingDocumentAdvisorRoots) {
      await deleteNode(existingRoot.id);
    }
    const inputMode = typeof extraWbsMeta?.input_mode === "string" ? extraWbsMeta.input_mode : null;
    const shouldUseDocumentBusinessRoot =
      odeCreation.createAs === "generic" &&
      result.nodes.length === 1 &&
      (inputMode === "document" || inputMode === "document_advisor");
    const documentBusinessRoot = shouldUseDocumentBusinessRoot ? result.nodes[0] : null;
    const rootTitle = documentBusinessRoot
      ? documentBusinessRoot.title
      : odeCreation.createAs === "generic"
        ? `WBS - ${result.goal}`
        : result.goal;
    const rootNode = await createNode(rootParentId, rootTitle, "folder");

    const { criticalPathKeys, blockerKeys } = computeWbsPathFlags(result.nodes);
    const baseRootProperties: Record<string, unknown> = {
      ...(rootNode.properties ?? {}),
      wbs: {
        schema_version: 1,
        goal: result.goal,
        value_summary: result.value_summary,
        source,
        warning: warning ?? null,
        generated_at: new Date().toISOString(),
        ...(extraWbsMeta ?? {})
      },
      odeContext: {
        persona: documentBusinessRoot?.suggested_role || "Program Manager",
        goal: documentBusinessRoot ? documentBusinessRoot.title : result.goal,
        mode: "wbs",
        node_key: documentBusinessRoot ? "1" : "root"
      }
    };
    if (documentBusinessRoot) {
      baseRootProperties.wbsMeta = {
        prerequisites: documentBusinessRoot.prerequisites,
        estimated_effort: documentBusinessRoot.estimated_effort,
        suggested_role: documentBusinessRoot.suggested_role,
        value_milestone: documentBusinessRoot.value_milestone,
        is_critical_path: criticalPathKeys.has("1"),
        is_blocker: blockerKeys.has("1")
      };
      const expectedDeliverables = Array.from(
        new Set(
          (documentBusinessRoot.expected_deliverables ?? [])
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0)
        )
      ).slice(0, 12);
      if (expectedDeliverables.length > 0) {
        baseRootProperties.odeExpectedDeliverables = expectedDeliverables;
        baseRootProperties.odeStructuredDeliverables = expectedDeliverables.map((title, deliverableIndex) => ({
          id: `${rootNode.id}-deliverable-${deliverableIndex + 1}`,
          title,
          tasks: [],
          notifications: [],
          data: []
        }));
      }
      if (documentBusinessRoot.objective?.trim()) {
        baseRootProperties.odeObjective = documentBusinessRoot.objective.trim();
      }
    }
    if (extraRootProperties) {
      Object.assign(baseRootProperties, extraRootProperties);
    }
    if (odeCreation.createAs !== "generic") {
      Object.assign(
        baseRootProperties,
        buildODENodeProperties({
          level: odeCreation.nextLevel,
          naCode: odeCreation.naCode,
          kind: odeCreation.createAs,
          trace: odeTrace
        })
      );
    }
    await updateNodeProperties(rootNode.id, baseRootProperties);
    const rootDescription = documentBusinessRoot?.description?.trim() || result.value_summary.trim();
    if (rootDescription.length > 0) {
      await updateNodeDescription(rootNode.id, rootDescription);
    }

    const createBranch = async (
      parentNodeId: string,
      branch: WBSNode[],
      parentKey = "",
      parentOdeLevel: number | null = odeCreation.nextLevel,
      inheritedNaCode: string | null = odeCreation.naCode
    ): Promise<void> => {
      for (let index = 0; index < branch.length; index += 1) {
        const item = branch[index];
        const key = parentKey ? `${parentKey}.${index + 1}` : `${index + 1}`;
        const created = await createNode(parentNodeId, item.title, "folder");
        const odeContext = {
          persona: item.suggested_role,
          goal: `${item.title} for ${result.goal}`,
          mode: "wbs",
          node_key: key
        };
        const expectedDeliverables = Array.from(
          new Set(
            (item.expected_deliverables ?? [])
              .map((entry) => entry.trim())
              .filter((entry) => entry.length > 0)
          )
        ).slice(0, 12);
        const nextProperties: Record<string, unknown> = {
          ...(created.properties ?? {}),
          wbsMeta: {
            prerequisites: item.prerequisites,
            estimated_effort: item.estimated_effort,
            suggested_role: item.suggested_role,
            value_milestone: item.value_milestone,
            is_critical_path: criticalPathKeys.has(key),
            is_blocker: blockerKeys.has(key)
          },
          odeContext
        };
        if (expectedDeliverables.length > 0) {
          nextProperties.odeExpectedDeliverables = expectedDeliverables;
          nextProperties.odeStructuredDeliverables = expectedDeliverables.map((title, deliverableIndex) => ({
            id: `${created.id}-deliverable-${deliverableIndex + 1}`,
            title,
            tasks: [],
            notifications: [],
            data: []
          }));
        }
        if (item.objective?.trim()) {
          nextProperties.odeObjective = item.objective.trim();
        }
        const matchedOutlineEntry = item.source_code ? matchNAOutlineNode(item.source_code, item.title) : null;
        if (matchedOutlineEntry) {
          Object.assign(
            nextProperties,
            buildODENodeProperties({
              level: matchedOutlineEntry.level,
              naCode: matchedOutlineEntry.code,
              kind: matchedOutlineEntry.level === 1 ? "na_root" : "na_branch"
            })
          );
        } else if (parentOdeLevel !== null && inheritedNaCode) {
          Object.assign(
            nextProperties,
            buildODENodeProperties({
              level: parentOdeLevel + 1,
              naCode: inheritedNaCode,
              kind: "task",
              trace: odeTrace
            })
          );
        }
        await updateNodeProperties(created.id, nextProperties);
        if (item.description?.trim()) {
          await updateNodeDescription(created.id, item.description.trim());
        }
        if (item.children.length > 0) {
          const createdOdeLevel = getODENodeMetadata({ ...created, properties: nextProperties }).level;
          const createdNaCode = getODENodeMetadata({ ...created, properties: nextProperties }).naCode;
          await createBranch(created.id, item.children, key, createdOdeLevel, createdNaCode);
        }
      }
    };

    await createBranch(
      rootNode.id,
      documentBusinessRoot ? documentBusinessRoot.children : result.nodes,
      documentBusinessRoot ? "1" : ""
    );

    await refreshTreeAndKeepContext(rootNode.id, [rootParentId ?? ROOT_PARENT_ID, rootNode.id], "grid");
    setPrimarySelection(rootNode.id, "grid");
    setWorkspaceMode("grid");
    setDesktopViewMode("grid");
    setSelectionSurface("grid");
    return {
      ...rootNode,
      properties: baseRootProperties
    };
  };

  const resolveOdeAwareGenerationTarget = async (rootParentId: string | null) => {
    const parentNode = rootParentId ? nodeById.get(rootParentId) ?? (await getNode(rootParentId)) ?? null : null;
    const branchBackfill = await ensureODENodeMetadataForBranch(parentNode);
    const effectiveParentNode = parentNode ? branchBackfill.get(parentNode.id) ?? parentNode : null;
    const explicit = getODENodeMetadata(effectiveParentNode);
    const effectiveMetadata = getEffectiveODENodeMetadata(effectiveParentNode);
    const effectiveParentWithMetadata =
      effectiveParentNode &&
      (explicit.level !== null || explicit.naCode !== null || explicit.kind !== null || effectiveMetadata.level === null)
        ? effectiveParentNode
        : effectiveParentNode
          ? applyODENodeMetadata(effectiveParentNode, effectiveMetadata)
          : null;
    const odeCreation = resolveODECreationTarget(effectiveParentWithMetadata);
    const naEntry = odeCreation.naCode ? getNAByCode(odeCreation.naCode) : null;
    return {
      parentNode: effectiveParentWithMetadata,
      odeCreation,
      naLabel: naEntry?.label ?? null,
      naPathLabel: odeCreation.naCode ? getNAPathLabel(odeCreation.naCode) : null
    };
  };

  const normalizeScheduleStatusArg = (value: string): ScheduleStatus => {
    const normalized = value.trim().toLowerCase();
    if (normalized === "active" || normalized === "in_progress" || normalized === "in progress") return "active";
    if (normalized === "blocked") return "blocked";
    if (normalized === "done" || normalized === "complete" || normalized === "completed") return "done";
    return "planned";
  };

  const renameSelectedNodeFromCommand = async (args?: Record<string, unknown>) => {
    const target = getPrimarySelectionNode();
    if (!target) throw new Error(t("context.new_topic"));

    const newName = parseArgsString(args, "new_name");
    if (!newName) {
      throw new Error("Missing new name for rename.");
    }
    if (!ensureStructureMutationAllowed([target.id])) return;
    await renameNode(target.id, newName);
    await refreshTreeAndKeepContext(target.id, [target.parentId]);
    setProjectNotice(`Renamed to "${newName}".`);
  };

  const moveSelectedNodeFromCommand = async (args?: Record<string, unknown>) => {
    const selectedIds = selectedNodeIds.size > 0
      ? Array.from(selectedNodeIds)
      : store.selectedNodeId
        ? [store.selectedNodeId]
        : [];
    if (selectedIds.length === 0) {
      throw new Error("Select a node first.");
    }

    const targetRef = parseArgsString(args, "target_ref");
    if (!targetRef) {
      throw new Error("Missing move target.");
    }
    const targetParent = resolveNodeByCommandRef(targetRef, { folderOnly: true });
    if (!targetParent) {
      throw new Error(`Target not found: ${targetRef}`);
    }

    const rootSelectionIds = selectedIds.filter(
      (candidate) => !selectedIds.some((other) => other !== candidate && isNodeInSubtree(other, candidate))
    );
    if (!ensureStructureMutationAllowed([...rootSelectionIds, targetParent.id])) return;

    for (const sourceId of rootSelectionIds) {
      if (sourceId === targetParent.id || isNodeInSubtree(sourceId, targetParent.id)) {
        throw new Error("Cannot move a node inside itself.");
      }
      const targetChildren = (await getChildren(targetParent.id)).filter((child) => child.id !== sourceId);
      const afterId = targetChildren.length > 0 ? targetChildren[targetChildren.length - 1].id : null;
      await moveNode(sourceId, targetParent.id, afterId);
    }

    const focusId = rootSelectionIds[0] ?? targetParent.id;
    await refreshTreeAndKeepContext(focusId, [targetParent.id]);
    setProjectNotice(`Moved ${rootSelectionIds.length} node(s) to ${targetParent.name}.`);
  };

  const bulkCreateTopicsFromCommand = async (args?: Record<string, unknown>) => {
    const names = parseArgsNames(args).slice(0, 25);
    if (names.length === 0) {
      throw new Error("No topic names provided for bulk create.");
    }
    const parentId = resolveCommandParentId();
    if (!ensureStructureMutationAllowed([parentId])) return;
    let firstCreatedId: string | null = null;
    for (const name of names) {
      const created = await createNode(parentId, name, "folder");
      if (!firstCreatedId) firstCreatedId = created.id;
    }
    if (firstCreatedId) {
      await refreshTreeAndKeepContext(firstCreatedId, parentId ? [parentId] : []);
      setProjectNotice(`Created ${names.length} topic(s).`);
    }
  };

  const setTimelineScheduleFromCommand = async (args?: Record<string, unknown>) => {
    const target = getPrimarySelectionNode();
    if (!target || target.type === "file") {
      throw new Error("Select a folder/task node first.");
    }
    const startDate = parseArgsString(args, "start_date");
    const endDate = parseArgsString(args, "end_date");
    if (!parseIsoDateOnly(startDate) || !parseIsoDateOnly(endDate)) {
      throw new Error("Schedule requires valid start_date and end_date (YYYY-MM-DD).");
    }
    const status = normalizeScheduleStatusArg(parseArgsString(args, "status"));
    const predecessor = parseArgsString(args, "predecessor");
    const title = parseArgsString(args, "title") || target.name;
    const nextSchedule = normalizeTimelineSchedule({
      title,
      status,
      startDate,
      endDate,
      assignees: [],
      priority: "normal",
      progress: 0,
      predecessor,
      mode: "manual"
    });
    const nextProperties: Record<string, unknown> = {
      ...(target.properties ?? {}),
      timelineSchedule: nextSchedule
    };
    await updateNodeProperties(target.id, nextProperties);
    setWorkspaceMode("timeline");
    await refreshTreeAndKeepContext(target.id, [target.parentId]);
    setProjectNotice(`Timeline updated for "${target.name}".`);
  };

  const clearTimelineScheduleFromCommand = async () => {
    const target = getPrimarySelectionNode();
    if (!target || target.type === "file") {
      throw new Error("Select a folder/task node first.");
    }
    const nextProperties: Record<string, unknown> = {
      ...(target.properties ?? {})
    };
    delete nextProperties.timelineSchedule;
    await updateNodeProperties(target.id, nextProperties);
    setWorkspaceMode("timeline");
    await refreshTreeAndKeepContext(target.id, [target.parentId]);
    setProjectNotice(`Timeline cleared for "${target.name}".`);
  };

  const parseSelectedDocumentIdsFromArgs = (args?: Record<string, unknown>): string[] => {
    const rawValue = args?.selected_document_ids ?? args?.selectedDocumentIds;
    const values = Array.isArray(rawValue)
      ? rawValue
      : typeof rawValue === "string"
        ? rawValue.split(/[,;\n|]/)
        : [];
    return Array.from(
      new Set(
        values
          .map((value) => (typeof value === "string" ? value.trim() : ""))
          .filter((value) => value.length > 0 && nodeById.has(value))
      )
    );
  };

  const reviewDocumentsFromCommand = async (
    args?: Record<string, unknown>,
    options?: { suppressTelemetry?: boolean }
  ) => {
    const startedAt = Date.now();
    const apiKey = getSavedMistralApiKey();
    if (!apiKey) {
      throw new Error(t("assistant.mistral_missing_key"));
    }

    const goal = parseArgsString(args, "goal") || "Summarize key findings and recommend next actions.";
    const selectedDocumentIdsFromArgs = parseSelectedDocumentIdsFromArgs(args);
    const targetId = selectedNode?.id ?? store.currentFolderId ?? activeProjectRootId;

    const collectScopeRoots = (): string[] => {
      if (targetId) return [targetId];
      const roots = byParent.get(ROOT_PARENT_ID) ?? [];
      return roots.map((node) => node.id);
    };

    const scopeIds = new Set<string>();
    const stack = [...collectScopeRoots()];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || scopeIds.has(current)) continue;
      scopeIds.add(current);
      const children = byParent.get(current) ?? [];
      for (const child of children) stack.push(child.id);
    }

    const candidateNodes = store.allNodes.filter((node) => scopeIds.has(node.id));
    const scopedDocumentNodes = candidateNodes.filter((node) => {
      const hasText =
        (typeof node.content === "string" && node.content.trim().length > 0) ||
        (typeof node.description === "string" && node.description.trim().length > 0);
      return node.type === "file" || hasText;
    });
    const documentNodes =
      selectedDocumentIdsFromArgs.length > 0
        ? selectedDocumentIdsFromArgs
            .map((id) => nodeById.get(id) ?? null)
            .filter((node): node is AppNode => node !== null)
            .filter((node) => scopedDocumentNodes.some((candidate) => candidate.id === node.id))
        : scopedDocumentNodes;

    if (documentNodes.length === 0) {
      throw new Error(t("assistant.doc_review_empty"));
    }

    const readableDocumentNodes: AppNode[] = [];
    for (const candidate of documentNodes.slice(0, 24)) {
      const freshNode = await getFreshNodeForAi(candidate);
      const contentText =
        (typeof freshNode.content === "string" ? freshNode.content : "") ||
        (typeof freshNode.description === "string" ? freshNode.description : "");
      if (contentText.trim().length === 0) continue;
      readableDocumentNodes.push(freshNode);
    }

    if (readableDocumentNodes.length === 0) {
      throw new Error(t("assistant.doc_review_empty"));
    }

    const lines = readableDocumentNodes.slice(0, 100).map((node) => {
      const numberLabel = scopedNumbering.get(node.id) ?? numbering.get(node.id) ?? "-";
      const contentText =
        (typeof node.content === "string" ? node.content : "") ||
        (typeof node.description === "string" ? node.description : "");
      const snippet = contentText.replace(/\s+/g, " ").trim().slice(0, 420);
      const modified = Number.isFinite(node.updatedAt) && node.updatedAt > 0
        ? new Date(node.updatedAt).toISOString().slice(0, 10)
        : "unknown";
      return `- [${numberLabel}|${node.name}] type=${node.type} modified=${modified} snippet=${snippet || "(none)"}`;
    });

    const selectedLabel = selectedNode
      ? `${scopedNumbering.get(selectedNode.id) ?? numbering.get(selectedNode.id) ?? "-"} ${selectedNode.name}`
      : "none";

    const systemPrompt = [
      "You are ODETool AI reviewer.",
      "Use only provided document context.",
      "Do not hallucinate missing facts.",
      "Every finding, risk, and recommendation must include one or more citations in format [number|name].",
      "If evidence is insufficient, explicitly say 'Insufficient evidence'."
    ].join(" ");
    const userPrompt = [
      `Date: ${toIsoDateOnly(new Date())}`,
      `Workspace: ${activeProject?.name ?? t("project.none")}`,
      `Selected node: ${selectedLabel}`,
      `Review goal: ${goal}`,
      "",
      "Return markdown with sections:",
      "1) Executive Summary",
      "2) Findings",
      "3) Risks / Gaps",
      "4) Recommended Actions",
      "",
      "Citation rule:",
      "- Attach citations as [number|name] for each claim.",
      "",
      "Document context:",
      lines.join("\n")
    ].join("\n");

    try {
      const response = await runAiPromptAnalysis({
        apiKey,
        systemPrompt,
        userPrompt,
        aiEngine: "cloud"
      });
      await writePlainTextToClipboard(response.trim());
      setProjectNotice("Document review copied to clipboard.");
      if (!options?.suppressTelemetry) {
        recordAiTelemetryEvent({
          flow: "document_review",
          source: "assistant",
          actionId: "document_review",
          success: true,
          latencyMs: Date.now() - startedAt,
          fallbackUsed: false,
          workspace: activeProject?.name ?? t("project.none"),
          selectedNodeId: selectedNode?.id ?? null
        });
      }
    } catch (error) {
      if (!options?.suppressTelemetry) {
        recordAiTelemetryEvent({
          flow: "document_review",
          source: "assistant",
          actionId: "document_review",
          success: false,
          latencyMs: Date.now() - startedAt,
          fallbackUsed: false,
          workspace: activeProject?.name ?? t("project.none"),
          selectedNodeId: selectedNode?.id ?? null,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      throw error;
    }
  };

  const createTicketFromCommand = async () => {
    const parentId = resolveCommandParentId();
    const ticketNode = await createNode(parentId, t("node.new_ticket_placeholder"), "ticket");
    primeInlineEditState(ticketNode.id, "");
    await refreshTreeAndKeepContext(ticketNode.id, parentId ? [parentId] : []);
    setWorkspaceMode("grid");
    setProjectNotice(`${t("command.create_ticket")} done.`);
  };

  const analyzeTicketFromCommand = async () => {
    const startedAt = Date.now();
    if (!selectedNode || selectedNode.type !== "ticket") {
      throw new Error(t("command.ticket_required"));
    }
    const apiKey = getSavedMistralApiKey();
    if (!apiKey) {
      throw new Error(t("assistant.mistral_missing_key"));
    }
    try {
      const response = await analyzeTicketWithAi({
        apiKey,
        aiEngine: "cloud",
        nodeId: selectedNode.id
      });
      await writePlainTextToClipboard(response.trim());
      setProjectNotice("Ticket analysis copied to clipboard.");
      recordAiTelemetryEvent({
        flow: "ticket_analyze",
        source: "assistant",
        actionId: "ticket_analyze",
        success: true,
        latencyMs: Date.now() - startedAt,
        fallbackUsed: false,
        workspace: activeProject?.name ?? t("project.none"),
        selectedNodeId: selectedNode.id
      });
    } catch (error) {
      recordAiTelemetryEvent({
        flow: "ticket_analyze",
        source: "assistant",
        actionId: "ticket_analyze",
        success: false,
        latencyMs: Date.now() - startedAt,
        fallbackUsed: false,
        workspace: activeProject?.name ?? t("project.none"),
        selectedNodeId: selectedNode.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  };

  const draftTicketReplyFromCommand = async (args?: Record<string, unknown>) => {
    const startedAt = Date.now();
    if (!selectedNode || selectedNode.type !== "ticket") {
      throw new Error(t("command.ticket_required"));
    }
    const apiKey = getSavedMistralApiKey();
    if (!apiKey) {
      throw new Error(t("assistant.mistral_missing_key"));
    }
    const instructions =
      parseArgsString(args, "instructions") ||
      "Be concise, professional, and empathetic.";
    try {
      const response = await generateTicketReplyWithAi({
        apiKey,
        aiEngine: "cloud",
        nodeId: selectedNode.id,
        instructions
      });
      const trimmed = response.trim();
      await writePlainTextToClipboard(trimmed);
      setProjectNotice("Ticket reply drafted and copied to clipboard.");
      recordAiTelemetryEvent({
        flow: "ticket_reply",
        source: "assistant",
        actionId: "ticket_draft_reply",
        success: true,
        latencyMs: Date.now() - startedAt,
        fallbackUsed: false,
        workspace: activeProject?.name ?? t("project.none"),
        selectedNodeId: selectedNode.id
      });
    } catch (error) {
      recordAiTelemetryEvent({
        flow: "ticket_reply",
        source: "assistant",
        actionId: "ticket_draft_reply",
        success: false,
        latencyMs: Date.now() - startedAt,
        fallbackUsed: false,
        workspace: activeProject?.name ?? t("project.none"),
        selectedNodeId: selectedNode.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  };

  const runQaFromCommand = async () => {
    const result = await runQualityGateCommand();
    setLastQaResult(result);
    const statusLine = t(result.success ? "command.qa_done" : "command.qa_failed", {
      code: result.exitCode
    });
    const output = result.output.trim();
    const checklistLine = t("qa.summary_short", {
      passed: qaChecklistSummary.passed,
      failed: qaChecklistSummary.failed,
      pending: qaChecklistSummary.pending
    });
    await writePlainTextToClipboard([statusLine, checklistLine, "", output.length > 0 ? output : "(no output)"].join("\n"));
    setProjectNotice(`${statusLine} Copied QA output to clipboard.`);
  };

  const draftReleaseNoteFromCommand = async () => {
    const today = toIsoDateOnly(new Date());
    const selectedLabel = selectedNode
      ? `${scopedNumbering.get(selectedNode.id) ?? numbering.get(selectedNode.id) ?? "-"} ${selectedNode.name}`
      : "none";
    const qaSummary = lastQaResult
      ? `${lastQaResult.success ? "PASS" : "FAIL"} (exit ${lastQaResult.exitCode})`
      : "Not run";
    const checklistSummary = `PASS ${qaChecklistSummary.passed}/${qaChecklistSummary.total}, FAIL ${qaChecklistSummary.failed}, PENDING ${qaChecklistSummary.pending}`;
    const failedChecklistItems = REGRESSION_CHECKLIST_ITEMS.filter(
      (item) => getQaChecklistEntry(qaChecklistStateById, item.id).status === "failed"
    );
    const qaOutput = lastQaResult?.output?.trim() ?? "";

    const draft = [
      `## ${today} - Release Note Draft`,
      "",
      `Workspace: ${activeProject?.name ?? t("project.none")}`,
      `Selected Node: ${selectedLabel}`,
      `QA: ${qaSummary}`,
      `Regression Checklist: ${checklistSummary}`,
      "",
      "### Regression Failures",
      failedChecklistItems.length > 0
        ? failedChecklistItems
            .map((item) => {
              const localizedItem = getLocalizedRegressionChecklistItem(item, language);
              return `- [${localizedItem.area}] ${localizedItem.title}`;
            })
            .join("\n")
        : "- None",
      "",
      "### Functionality",
      "-",
      "",
      "### Features",
      "-",
      "",
      "### General",
      "-",
      "",
      "### QA Output",
      "```text",
      qaOutput.length > 0 ? qaOutput : "(no QA output captured)",
      "```"
    ].join("\n");

    await writePlainTextToClipboard(draft);
    setProjectNotice(t("command.release_ready"));
  };

  const favoriteSelectedNodeFromCommand = async (args?: Record<string, unknown>) => {
    const target = getPrimarySelectionNode();
    if (!target) {
      throw new Error("Select a node first.");
    }
    const requestedGroup = parseArgsString(args, "group");
    const targetGroupId =
      requestedGroup
        ? createOrResolveFavoriteGroupId(requestedGroup)
        : activeFavoriteGroupId !== FAVORITE_ALL_GROUP_ID &&
          favoriteGroups.some((group) => group.id === activeFavoriteGroupId)
          ? activeFavoriteGroupId
          : favoriteGroups[0]?.id ?? "";
    if (!targetGroupId) {
      throw new Error(t("favorites.group_required"));
    }
    await assignNodeToFavoriteGroups(target, [targetGroupId]);
    setProjectNotice(`Added "${target.name}" to favorites.`);
  };

  const normalizeWbsTitleKey = (value: string): string => value.trim().toLowerCase();

  const computeWbsPathFlags = (
    nodes: WBSNode[]
  ): {
    criticalPathKeys: Set<string>;
    blockerKeys: Set<string>;
  } => {
    type IndexedWbsNode = {
      key: string;
      title: string;
      titleKey: string;
      effort: number;
      prerequisites: string[];
    };

    const indexed: IndexedWbsNode[] = [];
    const titleToNodeKey = new Map<string, string>();

    const walk = (branch: WBSNode[], parentKey = "") => {
      branch.forEach((node, index) => {
        const key = parentKey ? `${parentKey}.${index + 1}` : `${index + 1}`;
        const title = node.title.trim();
        const titleKey = normalizeWbsTitleKey(title);
        if (!titleToNodeKey.has(titleKey)) {
          titleToNodeKey.set(titleKey, key);
        }
        indexed.push({
          key,
          title,
          titleKey,
          effort: getWbsEstimatedEffortPoints(node),
          prerequisites: node.prerequisites
        });
        walk(node.children, key);
      });
    };
    walk(nodes);

    const predecessorsByNode = new Map<string, string[]>();
    const dependentsByNode = new Map<string, string[]>();

    for (const row of indexed) {
      const predecessors: string[] = [];
      for (const rawDependency of row.prerequisites) {
        const dependencyKey = titleToNodeKey.get(normalizeWbsTitleKey(rawDependency));
        if (!dependencyKey || dependencyKey === row.key) continue;
        predecessors.push(dependencyKey);
        const dependents = dependentsByNode.get(dependencyKey) ?? [];
        dependents.push(row.key);
        dependentsByNode.set(dependencyKey, dependents);
      }
      predecessorsByNode.set(row.key, predecessors);
    }

    const memoDistance = new Map<string, number>();
    const visiting = new Set<string>();
    const distanceToNode = (nodeKey: string): number => {
      if (memoDistance.has(nodeKey)) return memoDistance.get(nodeKey) ?? 0;
      if (visiting.has(nodeKey)) return 0;
      visiting.add(nodeKey);
      const row = indexed.find((item) => item.key === nodeKey);
      if (!row) {
        visiting.delete(nodeKey);
        return 0;
      }
      const predecessors = predecessorsByNode.get(nodeKey) ?? [];
      const predecessorDistance = predecessors.reduce((maxDistance, predecessorKey) => {
        const distance = distanceToNode(predecessorKey);
        return distance > maxDistance ? distance : maxDistance;
      }, 0);
      const total = predecessorDistance + Math.max(1, row.effort);
      memoDistance.set(nodeKey, total);
      visiting.delete(nodeKey);
      return total;
    };

    indexed.forEach((row) => {
      distanceToNode(row.key);
    });

    let criticalEndKey: string | null = null;
    let criticalEndDistance = 0;
    for (const row of indexed) {
      const distance = memoDistance.get(row.key) ?? 0;
      if (distance >= criticalEndDistance) {
        criticalEndDistance = distance;
        criticalEndKey = row.key;
      }
    }

    const criticalPathKeys = new Set<string>();
    let cursor = criticalEndKey;
    while (cursor) {
      criticalPathKeys.add(cursor);
      const predecessors = predecessorsByNode.get(cursor) ?? [];
      if (predecessors.length === 0) break;
      let nextPredecessor: string | null = null;
      let nextDistance = -1;
      for (const predecessor of predecessors) {
        const distance = memoDistance.get(predecessor) ?? 0;
        if (distance > nextDistance) {
          nextDistance = distance;
          nextPredecessor = predecessor;
        }
      }
      cursor = nextPredecessor;
    }

    const blockerKeys = new Set<string>();
    for (const [nodeKey, dependents] of dependentsByNode.entries()) {
      if (dependents.length > 0) blockerKeys.add(nodeKey);
    }

    return { criticalPathKeys, blockerKeys };
  };

  const applyIntegratedStructureToNode = useCallback(
    async (parentNodeId: string, result: WBSResult) => {
      if (!ensureStructureMutationAllowed([parentNodeId])) return;
      const parentNode = nodeById.get(parentNodeId) ?? store.allNodes.find((node) => node.id === parentNodeId) ?? null;
      if (!parentNode) return;

      const { criticalPathKeys, blockerKeys } = computeWbsPathFlags(result.nodes);
      const parentMetadata = getODENodeMetadata(parentNode);

      const upsertBranch = async (
        targetParentId: string,
        branch: WBSNode[],
        parentKey = "",
        inheritedOdeLevel: number | null = parentMetadata.level,
        inheritedNaCode: string | null = parentMetadata.naCode
      ): Promise<void> => {
        const existingChildren = await getChildren(targetParentId);
        for (let index = 0; index < branch.length; index += 1) {
          const item = branch[index];
          const key = parentKey ? `${parentKey}.${index + 1}` : `${index + 1}`;
          const normalizedTitleKey = item.title.trim().toLowerCase();
          const existingChild =
            existingChildren.find(
              (child) => child.type === "folder" && child.name.trim().toLowerCase() === normalizedTitleKey
            ) ?? null;
          const targetNode = existingChild ?? (await createNode(targetParentId, item.title, "folder"));

          const nextProperties: Record<string, unknown> = {
            ...(targetNode.properties ?? {}),
            wbsMeta: {
              prerequisites: item.prerequisites,
              estimated_effort: item.estimated_effort,
              suggested_role: item.suggested_role,
              value_milestone: item.value_milestone,
              is_critical_path: criticalPathKeys.has(key),
              is_blocker: blockerKeys.has(key)
            },
            odeContext: {
              persona: item.suggested_role,
              goal: `${item.title} for ${result.goal}`,
              mode: "wbs",
              node_key: key
            }
          };

          const expectedDeliverables = Array.from(
            new Set(
              (item.expected_deliverables ?? [])
                .map((entry) => entry.trim())
                .filter((entry) => entry.length > 0)
            )
          ).slice(0, 12);
          if (expectedDeliverables.length > 0) {
            nextProperties.odeExpectedDeliverables = expectedDeliverables;
            nextProperties.odeStructuredDeliverables = expectedDeliverables.map((title, deliverableIndex) => ({
              id: `${targetNode.id}-deliverable-${deliverableIndex + 1}`,
              title,
              tasks: [],
              notifications: [],
              data: []
            }));
          }
          if (item.objective?.trim()) {
            nextProperties.odeObjective = item.objective.trim();
          }

          const matchedOutlineEntry = item.source_code ? matchNAOutlineNode(item.source_code, item.title) : null;
          if (matchedOutlineEntry) {
            Object.assign(
              nextProperties,
              buildODENodeProperties({
                level: matchedOutlineEntry.level,
                naCode: matchedOutlineEntry.code,
                kind: matchedOutlineEntry.level === 1 ? "na_root" : "na_branch"
              })
            );
          } else if (inheritedOdeLevel !== null && inheritedNaCode) {
            Object.assign(
              nextProperties,
              buildODENodeProperties({
                level: inheritedOdeLevel + 1,
                naCode: inheritedNaCode,
                kind: "task"
              })
            );
          }

          await updateNodeProperties(targetNode.id, nextProperties);
          if (item.description?.trim()) {
            await updateNodeDescription(targetNode.id, item.description.trim());
          }

          if (item.children.length > 0) {
            const createdMetadata = getODENodeMetadata({ ...targetNode, properties: nextProperties });
            await upsertBranch(targetNode.id, item.children, key, createdMetadata.level, createdMetadata.naCode);
          }
        }
      };

      await upsertBranch(parentNodeId, result.nodes);
      await refreshTreeAndKeepContext(
        parentNodeId,
        [parentNodeId],
        workspaceMode === "timeline" ? "timeline" : selectionSurface === "grid" ? "grid" : "tree"
      );
    },
    [ensureStructureMutationAllowed, nodeById, selectionSurface, store.allNodes, workspaceMode]
  );

  const generateWbsFromCommand = async (args?: Record<string, unknown>) => {
    const parentId = resolveCommandParentId();
    const rootParentId = parentId ?? activeProjectRootId ?? null;
    const selected = getPrimarySelectionNode();
    const goal =
      parseArgsString(args, "goal") ||
      selected?.name.trim() ||
      activeProject?.name.trim() ||
      "New Initiative";
    const context = [
      `Workspace: ${activeProject?.name ?? t("project.none")}`,
      `Selected node: ${selected?.name ?? "none"}`,
      `View: ${workspaceMode === "grid" ? "desktop" : "timeline"}`
    ].join("\n");

    const generationTarget = await resolveOdeAwareGenerationTarget(rootParentId);
    const apiKey = getSavedMistralApiKey();
    const genericProgressMessage: Record<string, string> = {
      understand_goal: "WBS: understanding goal...",
      build_prompt: "WBS: preparing AI prompt...",
      request_ai: "WBS: generating breakdown...",
      validate_json: "WBS: validating structure...",
      normalize_tree: "WBS: optimizing dependencies...",
      fallback: "WBS: AI unavailable, using fallback template..."
    };
    const chantierProgressMessage: Record<string, string> =
      generationTarget.odeCreation.createAs === "chantier"
        ? {
            understand_goal: "Chantier: understanding goal and target NA...",
            build_prompt: "Chantier: preparing ODE chantier prompt...",
            request_ai: "Chantier: generating chantier breakdown...",
            validate_json: "Chantier: validating structure...",
            normalize_tree: "Chantier: optimizing execution packages...",
            fallback: "Chantier: AI unavailable, using chantier fallback..."
          }
        : {
            understand_goal: "Chantier: understanding selected chantier scope...",
            build_prompt: "Chantier: preparing chantier expansion prompt...",
            request_ai: "Chantier: generating chantier tasks...",
            validate_json: "Chantier: validating structure...",
            normalize_tree: "Chantier: optimizing execution packages...",
            fallback: "Chantier: AI unavailable, using chantier fallback..."
          };

    const { result, source, warning } =
      generationTarget.odeCreation.createAs !== "generic" && generationTarget.odeCreation.naCode && generationTarget.naLabel
        ? await generateChantierWBS({
            goal,
            naCode: generationTarget.odeCreation.naCode,
            naLabel: generationTarget.naLabel,
            naPathLabel: generationTarget.naPathLabel ?? undefined,
            sourceName: selected?.name ?? undefined,
            context,
            targetLanguage: language,
            apiKey: apiKey ?? undefined,
            aiEngine: apiKey ? "cloud" : "local",
            onProgress: (stage) => {
              const message = chantierProgressMessage[stage];
              if (message) setProjectNotice(message);
            }
          })
        : await generateAiWorkBreakdown({
            goal,
            context,
            targetLanguage: language,
            apiKey: apiKey ?? undefined,
            aiEngine: apiKey ? "cloud" : "local",
            onProgress: (stage) => {
              const message = genericProgressMessage[stage];
              if (message) setProjectNotice(message);
            }
          });

    const createdRoot = await materializeWbsResult(
      rootParentId,
      result,
      source,
      warning,
      generationTarget.odeCreation.createAs !== "generic"
        ? {
            generation_mode: "ode_chantier",
            target_na: {
              code: generationTarget.odeCreation.naCode,
              label: generationTarget.naLabel,
              path: generationTarget.naPathLabel
            }
          }
        : undefined
    );
    if (!createdRoot) {
      return;
    }
    setProjectNotice(
      generationTarget.odeCreation.createAs === "generic"
        ? source === "llm"
          ? `AI WBS created for "${result.goal}".`
          : `WBS created from fallback template for "${result.goal}".`
        : generationTarget.odeCreation.createAs === "chantier"
          ? source === "llm"
            ? `AI chantier created for "${result.goal}".`
            : `Chantier created from fallback template for "${result.goal}".`
          : source === "llm"
            ? `AI chantier tasks created for "${result.goal}".`
            : `Chantier tasks created from fallback template for "${result.goal}".`
    );
  };

  const generateWbsFromTextSources = async ({
    goal,
    primarySelected,
    textBackedSources,
    rootParentId,
    inputMode,
    sourceMode,
    sourceScope
  }: {
    goal: string;
    primarySelected: AppNode | null;
    textBackedSources: Array<{ node: AppNode; text: string; sectionTitle?: string | null }>;
    rootParentId: string | null;
    inputMode: "document" | "document_advisor";
    sourceMode: "numbered_outline" | "selected_document" | "selected_section" | "scope_documents";
    sourceScope: "selected_document" | "selected_documents" | "selected_section" | "scope_documents";
  }): Promise<boolean> => {
    const normalizedGoal =
      goal.trim() ||
      stripFileExtension(textBackedSources[0]?.node.name ?? primarySelected?.name ?? activeProject?.name ?? "selected documents");
    const documentGroundedMode = sourceMode !== "selected_section";
    const groundedDocumentError = t("document_ai.tree_generation_requires_grounded_document");

    const treeSeed =
      sourceMode === "selected_section"
        ? null
        : extractDocumentTreeSeedFromSources(normalizedGoal, textBackedSources);
    if (treeSeed?.warning === "document_outline_extracted") {
      setProjectNotice("WBS: extracting numbered document outline...");
    } else if (treeSeed) {
      setProjectNotice("WBS: extracting document structure...");
    }

    const apiKey = getSavedMistralApiKey();
    if (treeSeed && !apiKey && documentGroundedMode) {
      const createdRoot = await materializeWbsResult(rootParentId, treeSeed.result, "fallback", treeSeed.warning, {
        input_mode: inputMode,
        source_mode: treeSeed.sourceMode,
        source_scope: sourceScope,
        source_documents: textBackedSources.slice(0, 12).map((entry) => ({
          node_id: entry.node.id,
          name: entry.node.name,
          type: entry.node.type,
          section_title: entry.sectionTitle ?? null
        }))
      });
      if (!createdRoot) {
        return false;
      }
      setProjectNotice(
        treeSeed.warning === "document_outline_extracted"
          ? `Tree extracted from document outline for "${treeSeed.result.goal}".`
          : sourceScope === "selected_documents"
            ? `Tree extracted from selected documents for "${treeSeed.result.goal}".`
            : `Tree extracted from document structure for "${treeSeed.result.goal}".`
      );
      return true;
    }

    if (documentGroundedMode && !apiKey && !treeSeed) {
      setProjectNotice(null);
      setProjectError(groundedDocumentError);
      throw new Error(groundedDocumentError);
    }

    const { maxDocuments, maxTotalChars, maxExcerptChars, minExcerptChars } = getWbsSourceExcerptLimits(Boolean(treeSeed));
    let remainingChars = maxTotalChars;
    const sourceLines: string[] = [];

    for (const entry of textBackedSources.slice(0, maxDocuments)) {
      if (remainingChars <= 0) break;
      const numberLabel = scopedNumbering.get(entry.node.id) ?? numbering.get(entry.node.id) ?? "-";
      const excerptBudget = Math.max(minExcerptChars, Math.min(maxExcerptChars, remainingChars));
      const excerpt = entry.text.slice(0, excerptBudget);
      const sectionLine = entry.sectionTitle ? ` section=${entry.sectionTitle}` : "";
      sourceLines.push(
        `[${numberLabel}|${entry.node.name}] type=${entry.node.type}${sectionLine}\n${excerpt}${entry.text.length > excerpt.length ? "..." : ""}`
      );
      remainingChars -= excerpt.length;
    }

    const context = [
      `Workspace: ${activeProject?.name ?? t("project.none")}`,
      `Selected node: ${primarySelected?.name ?? "none"}`,
      `View: ${workspaceMode === "grid" ? "desktop" : "timeline"}`,
      `WBS source mode: ${sourceMode}`,
      `WBS source scope: ${sourceScope}`,
      `Build the WBS primarily from the source document evidence below.`,
      treeSeed ? "A baseline document structure has already been extracted; preserve it unless the evidence clearly supports a better grouping." : "",
      `If the source describes deliverables, phases, or milestones, preserve them in the breakdown.`,
      treeSeed ? "Do not invent generic implementation, rollout, or QA phases unless the source explicitly contains them." : "",
      treeSeed ? "" : "",
      treeSeed ? "Baseline document structure:" : "",
      treeSeed ? formatWbsNodesForPrompt(treeSeed.result.nodes).join("\n") : "",
      "",
      "Source documents:",
      sourceLines.join("\n\n")
    ]
      .filter((line) => line.trim().length > 0)
      .join("\n");

    const generationTarget = await resolveOdeAwareGenerationTarget(rootParentId);
    const genericProgressMessage: Record<string, string> = {
      understand_goal: sourceMode === "selected_section" ? "WBS: reading selected section..." : "WBS: reading document context...",
      build_prompt:
        sourceMode === "selected_section"
          ? "WBS: preparing selected-section AI prompt..."
          : "WBS: preparing document-based AI prompt...",
      request_ai:
        sourceMode === "selected_section"
          ? "WBS: generating breakdown from selected section..."
          : "WBS: generating breakdown from document...",
      validate_json: "WBS: validating structure...",
      normalize_tree: "WBS: optimizing dependencies...",
      fallback: documentGroundedMode
        ? "WBS: AI unavailable, keeping document-grounded structure only..."
        : "WBS: AI unavailable, using fallback template..."
    };
    const chantierProgressMessage: Record<string, string> =
      generationTarget.odeCreation.createAs === "chantier"
        ? {
            understand_goal:
              sourceMode === "selected_section"
                ? "Chantier: reading selected section and target NA..."
                : "Chantier: reading document context and target NA...",
            build_prompt:
              sourceMode === "selected_section"
                ? "Chantier: preparing selected-section chantier prompt..."
                : "Chantier: preparing document-based chantier prompt...",
            request_ai:
              sourceMode === "selected_section"
                ? "Chantier: generating chantier from selected section..."
                : "Chantier: generating chantier from document...",
            validate_json: "Chantier: validating structure...",
            normalize_tree: "Chantier: optimizing execution packages...",
            fallback: documentGroundedMode
              ? "Chantier: AI unavailable, keeping document-grounded structure only..."
              : "Chantier: AI unavailable, using chantier fallback..."
          }
        : {
            understand_goal:
              sourceMode === "selected_section"
                ? "Chantier: reading selected section for chantier expansion..."
                : "Chantier: reading document context for chantier expansion...",
            build_prompt:
              sourceMode === "selected_section"
                ? "Chantier: preparing selected-section expansion prompt..."
                : "Chantier: preparing document-based expansion prompt...",
            request_ai:
              sourceMode === "selected_section"
                ? "Chantier: generating tasks from selected section..."
                : "Chantier: generating tasks from document...",
            validate_json: "Chantier: validating structure...",
            normalize_tree: "Chantier: optimizing execution packages...",
            fallback: documentGroundedMode
              ? "Chantier: AI unavailable, keeping document-grounded structure only..."
              : "Chantier: AI unavailable, using chantier fallback..."
          };

    const { result, source, warning, raw } =
      generationTarget.odeCreation.createAs !== "generic" && generationTarget.odeCreation.naCode && generationTarget.naLabel
        ? await generateChantierWBS({
            goal: normalizedGoal,
            naCode: generationTarget.odeCreation.naCode,
            naLabel: generationTarget.naLabel,
            naPathLabel: generationTarget.naPathLabel ?? undefined,
            sourceName: textBackedSources[0]?.node.name ?? primarySelected?.name ?? undefined,
            context,
            targetLanguage: language,
            apiKey: apiKey ?? undefined,
            aiEngine: apiKey ? "cloud" : "local",
            onProgress: (stage) => {
              const message = chantierProgressMessage[stage];
              if (message) setProjectNotice(message);
            }
          })
        : await generateAiWorkBreakdown({
            goal: normalizedGoal,
            context,
            targetLanguage: language,
            apiKey: apiKey ?? undefined,
            aiEngine: apiKey ? "cloud" : "local",
            promptPreset: sourceMode === "selected_section" ? "generic" : "document_tree",
            onProgress: (stage) => {
              const message = genericProgressMessage[stage];
              if (message) setProjectNotice(message);
            }
          });

    const recoveredDocumentResult =
      documentGroundedMode && source === "fallback"
        ? recoverDocumentTreeResultFromAiRaw(
            normalizedGoal,
            raw,
            `${textBackedSources[0]?.node.name ?? primarySelected?.name ?? "AI response"} AI response`
          )
        : null;
    const recoveredDocumentSource = recoveredDocumentResult ? "llm" : source;
    const recoveredDocumentWarning = recoveredDocumentResult ? warning : warning;
    const effectiveGeneratedResult = recoveredDocumentResult ?? result;

    if (documentGroundedMode && recoveredDocumentSource === "fallback" && !treeSeed) {
      setProjectNotice(null);
      setProjectError(groundedDocumentError);
      throw new Error(groundedDocumentError);
    }

    const materializedResult =
      recoveredDocumentSource === "fallback" && treeSeed && documentGroundedMode ? treeSeed.result : effectiveGeneratedResult;
    const materializedSource =
      recoveredDocumentSource === "fallback" && treeSeed && documentGroundedMode ? "fallback" : recoveredDocumentSource;
    const materializedWarning =
      recoveredDocumentSource === "fallback" && treeSeed && documentGroundedMode ? treeSeed.warning : recoveredDocumentWarning;
    const materializedFromDocumentExtraction =
      materializedWarning === "document_outline_extracted" || materializedWarning === "document_structure_extracted";
    const materializedDocumentExtractionNotice =
      materializedWarning === "document_outline_extracted"
        ? `Tree extracted from document outline for "${materializedResult.goal}".`
        : sourceScope === "selected_documents"
          ? `Tree extracted from selected documents for "${materializedResult.goal}".`
          : `Tree extracted from document structure for "${materializedResult.goal}".`;

    const createdRoot = await materializeWbsResult(rootParentId, materializedResult, materializedSource, materializedWarning, {
      input_mode: inputMode,
      source_mode: recoveredDocumentSource === "fallback" && treeSeed && documentGroundedMode ? treeSeed.sourceMode : sourceMode,
      source_scope: sourceScope,
      generation_mode: generationTarget.odeCreation.createAs === "generic" ? "generic_wbs" : "ode_chantier",
      target_na:
        generationTarget.odeCreation.createAs === "generic"
          ? null
          : {
              code: generationTarget.odeCreation.naCode,
              label: generationTarget.naLabel,
              path: generationTarget.naPathLabel
            },
      source_documents: textBackedSources.slice(0, 12).map((entry) => ({
        node_id: entry.node.id,
        name: entry.node.name,
        type: entry.node.type,
        section_title: entry.sectionTitle ?? null
      }))
    });
    if (!createdRoot) {
      return false;
    }
    setProjectNotice(
      generationTarget.odeCreation.createAs === "generic"
        ? materializedSource === "llm"
          ? sourceMode === "selected_section"
            ? `AI WBS created from selected section for "${materializedResult.goal}".`
            : `AI WBS created from document context for "${materializedResult.goal}".`
          : materializedFromDocumentExtraction
            ? materializedDocumentExtractionNotice
            : sourceMode === "selected_section"
              ? `WBS fallback template created from selected section for "${materializedResult.goal}".`
              : `WBS fallback template created from document context for "${materializedResult.goal}".`
        : generationTarget.odeCreation.createAs === "chantier"
          ? materializedSource === "llm"
            ? sourceMode === "selected_section"
              ? `AI chantier created from selected section for "${materializedResult.goal}".`
              : `AI chantier created from document context for "${materializedResult.goal}".`
            : materializedFromDocumentExtraction
              ? materializedDocumentExtractionNotice
              : sourceMode === "selected_section"
                ? `Chantier fallback template created from selected section for "${materializedResult.goal}".`
                : `Chantier fallback template created from document context for "${materializedResult.goal}".`
          : materializedSource === "llm"
            ? sourceMode === "selected_section"
              ? `AI chantier tasks created from selected section for "${materializedResult.goal}".`
              : `AI chantier tasks created from document context for "${materializedResult.goal}".`
            : materializedFromDocumentExtraction
              ? materializedDocumentExtractionNotice
              : sourceMode === "selected_section"
                ? `Chantier tasks fallback template created from selected section for "${materializedResult.goal}".`
                : `Chantier tasks fallback template created from document context for "${materializedResult.goal}".`
    );
    return true;
  };

  const generateWbsFromDocumentCommand = async (args?: Record<string, unknown>): Promise<boolean> => {
    const primarySelected = getPrimarySelectionNode();
    const selectedIds = selectedNodeIds.size > 0
      ? Array.from(selectedNodeIds)
      : primarySelected?.id
        ? [primarySelected.id]
        : [];
    const selectedNodes = selectedIds
      .map((id) => nodeById.get(id) ?? null)
      .filter((node): node is AppNode => node !== null);

    const explicitDocumentNodes = selectedNodes.filter((node) => isDocumentCandidateNode(node));
    const scopeRootIds = explicitDocumentNodes.length > 0
      ? explicitDocumentNodes.map((node) => node.id)
      : selectedNodes.length > 0
        ? selectedNodes.map((node) => node.id)
        : [store.currentFolderId ?? activeProjectRootId].filter((value): value is string => Boolean(value));

    if (scopeRootIds.length === 0) {
      throw new Error("Select a document or folder first.");
    }

    const scopeIds = new Set<string>();
    const stack = [...scopeRootIds];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || scopeIds.has(current)) continue;
      scopeIds.add(current);
      const children = byParent.get(current) ?? [];
      for (const child of children) stack.push(child.id);
    }

    const sourceCandidates = explicitDocumentNodes.length > 0
      ? explicitDocumentNodes
      : store.allNodes.filter((node) => scopeIds.has(node.id) && isDocumentCandidateNode(node));
    const orderedCandidates = sourceCandidates.slice().sort((left, right) => {
      const leftExplicit = selectedIds.includes(left.id) ? 1 : 0;
      const rightExplicit = selectedIds.includes(right.id) ? 1 : 0;
      if (leftExplicit !== rightExplicit) return rightExplicit - leftExplicit;
      return right.updatedAt - left.updatedAt;
    });

    const textBackedSources: Array<{ node: AppNode; text: string }> = [];
    const candidateScanLimit = explicitDocumentNodes.length > 0 ? orderedCandidates.length : Math.min(orderedCandidates.length, 24);
    for (const candidate of orderedCandidates.slice(0, candidateScanLimit)) {
      const freshNode = await getFreshNodeForAi(candidate);
      const text = getDocumentAdvisorLines(getNodeTextForAi(freshNode)).join("\n");
      if (text.length === 0) continue;
      textBackedSources.push({ node: freshNode, text });
      if (textBackedSources.length >= 6) break;
    }

    if (textBackedSources.length === 0) {
      throw new Error(
        explicitDocumentNodes.length > 0
          ? explicitDocumentNodes.length === 1 && isTextDocumentNode(explicitDocumentNodes[0])
            ? "Selected text file is empty."
            : "Selected document is still parsing or has no readable text yet. Wait a moment after import, then try again."
          : "No readable document content found in the selected scope."
      );
    }

    const goal =
      parseArgsString(args, "goal") ||
      stripFileExtension(textBackedSources[0]?.node.name ?? primarySelected?.name ?? activeProject?.name ?? "selected documents");
    return generateWbsFromTextSources({
      goal,
      primarySelected,
      textBackedSources,
      rootParentId: resolveCommandParentId() ?? activeProjectRootId ?? null,
      inputMode: "document",
      sourceMode: explicitDocumentNodes.length > 0 ? "selected_document" : "scope_documents",
      sourceScope: explicitDocumentNodes.length > 0 ? "selected_documents" : "scope_documents"
    });
  };

  const openDocumentTreeReviewFromCommand = async (args?: Record<string, unknown>) => {
    const selectedDocumentIdsFromArgs = parseSelectedDocumentIdsFromArgs(args);
    if (selectedDocumentIdsFromArgs.length > 0) {
      setSelectionFromIds(selectedDocumentIdsFromArgs, selectedDocumentIdsFromArgs[0], "tree");
    }
    const resolvedTargetId = selectedDocumentIdsFromArgs[0] ?? getPrimarySelectionNode()?.id ?? null;
    const target = resolvedTargetId ? nodeById.get(resolvedTargetId) ?? null : null;
    if (!target || !isDocumentAdvisorEligibleNode(target)) {
      throw new Error(t("document_ai.selection_required"));
    }
    if (!DOCUMENT_REVIEW_SURFACE_ENABLED) {
      throw new Error("Document review is currently unavailable.");
    }

    setProjectError(null);
    setProjectNotice("Review the extracted tree before adding it to the workspace.");
    setDocumentAdvisorError(null);
    setDocumentAdvisorTreeProposal(null);
    setDocumentAdvisorTreeProposalBusy(false);
    setDocumentAdvisorTreeProposalError(null);
    setDocumentAdvisorTreeProposalPrompt("");
    setDocumentAdvisorTranslationMode("auto");
    setDocumentAdvisorManualTranslationLanguage(language);
    setDocumentAdvisorOpen(true);
  };

  const runDocumentAdvisorAction = async (
    actionId: DocumentAdvisorActionId,
    options?: { selectedNodeKeys?: string[]; editedNodes?: WBSNode[] }
  ) => {
    const startedAt = Date.now();
    const target = getPrimarySelectionNode();
    let telemetryContext: AiTelemetryDocumentAdvisorContext | undefined;
    let telemetryRecorded = false;

    const recordDocumentAdvisorTelemetry = (success: boolean, error?: string) => {
      if (telemetryRecorded) return;
      telemetryRecorded = true;
      recordAiTelemetryEvent({
        flow: "document_advisor",
        source: "document_advisor",
        actionId,
        success,
        latencyMs: Date.now() - startedAt,
        fallbackUsed: false,
        workspace: activeProject?.name ?? t("project.none"),
        selectedNodeId: target?.id ?? selectedNode?.id ?? null,
        error,
        documentAdvisor: telemetryContext
      });
    };

    setDocumentAdvisorError(null);
    setDocumentAdvisorActionRunning(true);
    try {
      if (!target || !isDocumentAdvisorEligibleNode(target)) {
        throw new Error(t("document_ai.selection_required"));
      }

      const analysis =
        documentAdvisorAnalysis && documentAdvisorAnalysis.nodeId === target.id
          ? documentAdvisorAnalysis
          : await analyzeDocumentAdvisorTarget(target);
      telemetryContext = buildDocumentAdvisorTelemetryContext(analysis, documentAdvisorSelectedSectionId, actionId);

      if (actionId === "create_tree_structure" || actionId === "import_outline_tree") {
        if (actionId === "create_tree_structure") {
          const baseProposal =
            documentAdvisorTreeProposal &&
            documentAdvisorTreeProposal.targetNodeId === target.id &&
            documentAdvisorTreeProposal.sourceSelectionKey === documentAdvisorSourceSelectionKey
              ? documentAdvisorTreeProposal
              : await buildDocumentAdvisorTreeProposal({ target });
          const editedProposal =
            options?.editedNodes && options.editedNodes.length > 0
              ? {
                  ...baseProposal,
                  result: {
                    ...baseProposal.result,
                    nodes: options.editedNodes
                  }
                }
              : baseProposal;
          const proposal = filterDocumentAdvisorTreeProposal(
            editedProposal,
            options?.selectedNodeKeys ?? null
          );
          if (!proposal) {
            throw new Error(t("document_ai.tree_proposal_selection_required"));
          }
          const created = await executeDocumentAdvisorTreeProposal(proposal);
          if (!created) {
            recordDocumentAdvisorTelemetry(false, "User canceled preview.");
            return;
          }
          appendApprovedDocumentTreeMemory(
            buildApprovedDocumentTreeMemoryEntry({
              targetNodeId: target.id,
              documentName: target.name,
              goal: proposal.goal,
              outputLanguage: resolveDocumentTreeOutputLanguage(
                proposal.translationMode,
                proposal.detectedSourceLanguage,
                language,
                proposal.translationRequestedLanguage ?? documentAdvisorManualTranslationLanguage
              ),
              sourceLabels: proposal.sourceDocuments.map((sourceDocument) => sourceDocument.name),
              nodes: proposal.result.nodes
            })
          );
        } else {
          const source = await readDocumentTextSource(target);
          const goal = stripFileExtension(source.node.name) || source.node.name || "Document Outline";
          const outlineResult = parseNumberedOutlineToWbs(goal, source.node.name, source.text);
          if (!outlineResult) {
            throw new Error(t("document_ai.outline_missing"));
          }
          const translation = await maybeTranslateDocumentTreeResult(outlineResult, {
            mode: documentAdvisorTranslationMode,
            sourceLanguage: detectDocumentLanguage(source.text).language,
            appLanguage: language,
            manualTargetLanguage: documentAdvisorManualTranslationLanguage,
            apiKey: getSavedMistralApiKey() ?? undefined
          });
          const rootParentId = resolveCommandParentId() ?? activeProjectRootId ?? null;
          const createdRoot = await materializeWbsResult(
            rootParentId,
            translation.result,
            "fallback",
            "document_outline_extracted",
            {
              input_mode: "document_advisor",
              source_mode: "numbered_outline",
              source_scope: "selected_document",
              translation: {
                mode: documentAdvisorTranslationMode,
                target_language: translation.targetLanguage,
                source_language: detectDocumentLanguage(source.text).language,
                applied: translation.applied,
                warning: translation.warning ?? null
              },
              source_documents: [
                {
                  node_id: source.node.id,
                  name: source.node.name,
                  type: source.node.type
                }
              ]
            }
          );
          if (!createdRoot) {
            recordDocumentAdvisorTelemetry(false, "User canceled preview.");
            return;
          }
          setProjectNotice(`Tree extracted from document outline for "${outlineResult.goal}".`);
        }
      } else if (actionId === "map_to_na") {
        const source = await readDocumentTextSource(target);
        const naMatch = analysis.naMatch;
        if (!naMatch) {
          throw new Error(t("document_ai.na_missing"));
        }
        const nextProperties: Record<string, unknown> = {
          ...(target.properties ?? {}),
          odeSuggestedNA: {
            code: naMatch.code,
            label: naMatch.label,
            confidence: naMatch.confidence,
            candidates: naMatch.candidates.map((candidate) => ({
              code: candidate.code,
              label: candidate.label,
              score: candidate.score,
              reason: candidate.reason
            })),
            path: naMatch.pathLabel,
            matched_at: new Date().toISOString(),
            source: "document_advisor"
          }
        };
        await updateNodeProperties(source.node.id, nextProperties);
        setProjectNotice(
          t("document_ai.na_saved_notice", {
            code: naMatch.code,
            label: naMatch.label,
            percent: Math.round(naMatch.confidence * 100)
          })
        );
      } else if (actionId === "create_chantier_ai") {
        const source = await readDocumentTextSource(target);
        const naMatch = analysis.naMatch;
        if (!naMatch) {
          throw new Error(t("document_ai.na_missing"));
        }
        const targetResolution = await resolveLevel4NATargetNode(naMatch.code, source.node);
        if (targetResolution.ambiguous) {
          throw new Error(
            t("document_ai.na_target_ambiguous", {
              code: naMatch.code,
              label: naMatch.label
            })
          );
        }
        const targetNANode = targetResolution.node;
        if (!targetNANode) {
          throw new Error(
            t("document_ai.na_target_missing", {
              code: naMatch.code,
              label: naMatch.label
            })
          );
        }

        const nextProperties: Record<string, unknown> = {
          ...(source.node.properties ?? {}),
          odeSuggestedNA: {
            code: naMatch.code,
            label: naMatch.label,
            confidence: naMatch.confidence,
            candidates: naMatch.candidates.map((candidate) => ({
              code: candidate.code,
              label: candidate.label,
              score: candidate.score,
              reason: candidate.reason
            })),
            path: naMatch.pathLabel,
            matched_at: new Date().toISOString(),
            source: "document_advisor"
          }
        };
        await updateNodeProperties(source.node.id, nextProperties);

        const goal = stripFileExtension(source.node.name) || source.node.name || `${naMatch.label} chantier`;
        const sourceExcerpt = source.text.slice(0, 14000);
        const context = [
          `Workspace: ${activeProject?.name ?? t("project.none")}`,
          `Selected document: ${source.node.name}`,
          `Target NA: ${naMatch.code} ${naMatch.label}`,
          `Target path: ${naMatch.pathLabel}`,
          `Generate a chantier breakdown grounded in the document evidence below.`,
          "",
          sourceExcerpt
        ].join("\n");
        const apiKey = getSavedMistralApiKey();
        const progressMessage: Record<string, string> = {
          understand_goal: "Chantier: analyzing document and target NA...",
          build_prompt: "Chantier: preparing ODE chantier prompt...",
          request_ai: "Chantier: generating execution breakdown...",
          validate_json: "Chantier: validating structure...",
          normalize_tree: "Chantier: optimizing dependencies...",
          fallback: "Chantier: AI unavailable, using chantier fallback..."
        };
        const { result, source: generationSource, warning } = await generateChantierWBS({
          goal,
          naCode: naMatch.code,
          naLabel: naMatch.label,
          naPathLabel: naMatch.pathLabel,
          sourceName: source.node.name,
          context,
          targetLanguage: language,
          apiKey: apiKey ?? undefined,
          aiEngine: apiKey ? "cloud" : "local",
          onProgress: (stage) => {
            const message = progressMessage[stage];
            if (message) setProjectNotice(message);
          }
        });
        const chantierNode = await materializeWbsResult(
          targetNANode.id,
          result,
          generationSource,
          warning,
          {
            input_mode: "document_advisor",
            source_mode: "na_chantier",
            source_scope: "selected_document",
            mapped_na: {
              code: naMatch.code,
              label: naMatch.label,
              path: naMatch.pathLabel,
              target_node_id: targetNANode.id
            },
            source_documents: [
              {
                node_id: source.node.id,
                name: source.node.name,
                type: source.node.type
              }
            ]
          },
          naMatch.confidence
        );
        if (!chantierNode) {
          recordDocumentAdvisorTelemetry(false, "User canceled preview.");
          return;
        }
        setProjectNotice(
          t("document_ai.chantier_created_notice", {
            title: chantierNode.name,
            code: naMatch.code,
            label: naMatch.label
          })
        );
      } else if (actionId === "wbs_from_section") {
        const source = await readDocumentTextSource(target);
        const selectedSection = getDocumentAdvisorSelectedSection(analysis, documentAdvisorSelectedSectionId);
        if (!selectedSection) {
          throw new Error(t("document_ai.section_required"));
        }
        const sectionText = extractDocumentAdvisorSectionText(source.text, selectedSection);
        if (!sectionText) {
          throw new Error(t("document_ai.section_required"));
        }
        const created = await generateWbsFromTextSources({
          goal: selectedSection.goal,
          primarySelected: target,
          textBackedSources: [
            {
              node: source.node,
              text: sectionText,
              sectionTitle: selectedSection.title
            }
          ],
          rootParentId: resolveCommandParentId() ?? activeProjectRootId ?? null,
          inputMode: "document_advisor",
          sourceMode: "selected_section",
          sourceScope: "selected_section"
        });
        if (!created) {
          recordDocumentAdvisorTelemetry(false, "User canceled preview.");
          return;
        }
      } else if (actionId === "wbs_from_document") {
        const created = await generateWbsFromDocumentCommand({
          goal: stripFileExtension(target.name) || target.name
        });
        if (!created) {
          recordDocumentAdvisorTelemetry(false, "User canceled preview.");
          return;
        }
      } else {
        const reviewGoal =
          target.type === "minutes"
            ? "Summarize decisions, open actions, risks, and recommended next steps with citations."
            : "Summarize key findings, structural signals, risks, and recommended next steps with citations.";
        await reviewDocumentsFromCommand({ goal: reviewGoal }, { suppressTelemetry: true });
      }
      recordDocumentAdvisorTelemetry(true);
      setDocumentAdvisorOpen(false);
      setCommandBarOpen(false);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      recordDocumentAdvisorTelemetry(false, reason);
      setDocumentAdvisorError(reason);
      throw error;
    } finally {
      setDocumentAdvisorActionRunning(false);
    }
  };

  const aiCommandExecutionHandlers: AiCommandExecutionHandlers = {
    workspaceImport: handlePickAndImportProjectFolder,
    workspaceResync: async () => {
      if (!activeProjectId) {
        throw new Error(t("command.workspace_required"));
      }
      if (!activeProject || isInternalWorkspaceRootPath(activeProject.rootPath)) {
        throw new Error(t("command.workspace_resync_unavailable"));
      }
      await handleReSyncWorkspace();
    },
    planMyDay: runAssistantPlanMyDay,
    wbsGenerate: (args) => generateWbsFromCommand(args),
    wbsFromDocument: (args) => openDocumentTreeReviewFromCommand(args),
    treeCreateTopic: () => createChildFolder(),
    treeRenameSelected: (args) => renameSelectedNodeFromCommand(args),
    treeMoveSelected: (args) => moveSelectedNodeFromCommand(args),
    treeBulkCreate: (args) => bulkCreateTopicsFromCommand(args),
    favoriteSelected: (args) => favoriteSelectedNodeFromCommand(args),
    desktopOpen: () => {
      setWorkspaceMode("grid");
      setDesktopViewMode("grid");
    },
    timelineOpen: () => {
      setWorkspaceMode("timeline");
    },
    timelineSetSchedule: (args) => setTimelineScheduleFromCommand(args),
    timelineClearSchedule: () => clearTimelineScheduleFromCommand(),
    documentReview: (args) => reviewDocumentsFromCommand(args),
    ticketCreate: () => createTicketFromCommand(),
    ticketAnalyze: () => analyzeTicketFromCommand(),
    ticketDraftReply: (args) => draftTicketReplyFromCommand(args),
    runQa: () => runQaFromCommand(),
    draftReleaseNote: () => draftReleaseNoteFromCommand()
  };

  const executeAiCommandAction = async (
    actionId: AiCommandActionId,
    args?: Record<string, unknown>
  ) => executeAiCommandActionWithHandlers(actionId, args, aiCommandExecutionHandlers);

  const analyzeAiCommand = async (
    commandText: string,
    options?: AiCommandRequestOptions
  ): Promise<AiCommandPlan> => {
    const startedAt = Date.now();
    const selectedLabel = selectedNode
      ? `${scopedNumbering.get(selectedNode.id) ?? numbering.get(selectedNode.id) ?? "-"} ${selectedNode.name}`
      : "none";
    const plannerSelectedNode = getPrimarySelectionNode();
    const preferDocumentWbs = Boolean(plannerSelectedNode && isDocumentCandidateNode(plannerSelectedNode));
    const forcedActionId = normalizeAiCommandActionId(options?.actionHint);
    const context = buildAiCommandContext({
      date: toIsoDateOnly(new Date()),
      workspaceName: activeProject?.name ?? t("project.none"),
      view: workspaceMode === "grid" ? "desktop" : "timeline",
      selectedLabel
    });
    if (forcedActionId) {
      const forcedArgs = {
        ...inferAiCommandArgs(commandText, forcedActionId),
        ...(options?.selectedDocumentIds?.length ? { selected_document_ids: options.selectedDocumentIds } : {})
      };
      return {
        intent: commandText.trim(),
        actionId: forcedActionId,
        args: forcedArgs,
        reason: "Used the selected AI shortcut action.",
        steps:
          forcedActionId === "wbs_from_document"
            ? ["Read the selected files.", "Prepare the tree proposal.", "Let you edit the proposal before validation."]
            : ["Use the selected files in context.", "Run the requested AI action."],
        confidence: 0.98,
        previewChanges:
          forcedActionId === "wbs_from_document"
            ? ["Open an editable tree proposal from the selected files."]
            : ["Run the selected AI action with the chosen file set."],
        plannerSource: "heuristic",
        requiresConfirmation: forcedActionId === "wbs_from_document"
      };
    }
    const {
      heuristicAction,
      wbsIntentRequested,
      state: initialAnalysis
    } = buildInitialAiCommandAnalysis(commandText, {
      preferDocumentWbs
    });
    let { actionId, args, reason, steps, confidence, plannerSource, fallbackUsed } = initialAnalysis;
    const skipPlannerLlm = shouldSkipAiPlannerForCommand(commandText, heuristicAction);

    const apiKey = getSavedMistralApiKey();
    if (apiKey && !skipPlannerLlm) {
      const { systemPrompt, userPrompt } = buildAiPlannerPrompts(commandText, context);

      try {
          const raw = await runAiPromptAnalysis({
            apiKey,
            systemPrompt,
            userPrompt,
            aiEngine: "cloud"
          });
          const parsed = parseAiPlannerPayload(raw, commandText);
          if (parsed) {
            ({ actionId, args, reason, steps, confidence, plannerSource, fallbackUsed } =
              mergeAiPlannerAnalysisState(
                {
                  actionId,
                  args,
                  reason,
                  steps,
                  confidence,
                  plannerSource,
                  fallbackUsed
                },
                parsed,
                commandText,
                {
                  heuristicAction,
                  preferDocumentWbs,
                  wbsIntentRequested
                }
              ));
          } else {
            fallbackUsed = true;
          }
        } catch {
          fallbackUsed = true;
        }
      }

    ({ actionId, args, reason, steps, confidence, plannerSource, fallbackUsed } =
      finalizeAiCommandAnalysis({
        actionId,
        args,
        reason,
        steps,
        confidence,
        plannerSource,
        fallbackUsed
      }));

    const plan: AiCommandPlan = {
      intent: commandText,
      actionId,
      args,
      reason,
      steps,
      confidence,
      previewChanges: buildAiPlanPreview(actionId, args, {
        selectedLabel,
        workspaceName: activeProject?.name ?? "current"
      }),
      plannerSource,
      // Keep explicit human confirmation hard-required for safety.
      requiresConfirmation: true
    };

    recordAiTelemetryEvent({
      flow: "command_plan",
      source: plannerSource,
      actionId: plan.actionId,
      success: Boolean(plan.actionId),
      latencyMs: Date.now() - startedAt,
      fallbackUsed,
      workspace: activeProject?.name ?? t("project.none"),
      selectedNodeId: selectedNode?.id ?? null,
      error: plan.actionId ? undefined : "No executable action identified."
    });

    return plan;
  };

  const executeAiPlan = async (plan: AiCommandPlan) => {
    const startedAt = Date.now();
    setProjectError(null);
    setProjectNotice(null);
    const normalized = normalizeAiCommandActionId(plan.actionId);
    if (!normalized) {
      throw new Error("No executable action matched this command.");
    }
    try {
      await executeAiCommandAction(normalized, plan.args);
      if (!(normalized === "wbs_from_document" && DOCUMENT_REVIEW_SURFACE_ENABLED)) {
        setCommandBarOpen(false);
      }
      recordAiTelemetryEvent({
        flow: "command_execute",
        source: plan.plannerSource,
        actionId: normalized,
        success: true,
        latencyMs: Date.now() - startedAt,
        fallbackUsed: false,
        workspace: activeProject?.name ?? t("project.none"),
        selectedNodeId: selectedNode?.id ?? null
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      recordAiTelemetryEvent({
        flow: "command_execute",
        source: plan.plannerSource,
        actionId: normalized,
        success: false,
        latencyMs: Date.now() - startedAt,
        fallbackUsed: false,
        workspace: activeProject?.name ?? t("project.none"),
        selectedNodeId: selectedNode?.id ?? null,
        error: reason
      });
      setProjectError(t("command.action_failed", { reason }));
      throw error;
    }
  };

  const documentAdvisorTarget = (() => {
    const node = getPrimarySelectionNode();
    return isDocumentAdvisorEligibleNode(node) ? node : null;
  })();

  useEffect(() => {
    if (!documentAdvisorTarget) {
      setDocumentAdvisorAnalysis(null);
      setDocumentAdvisorSelectedSectionId("");
      setDocumentAdvisorError(null);
      setDocumentAdvisorStatus("idle");
      setDocumentAdvisorOpen(false);
      return;
    }

    let cancelled = false;
    setDocumentAdvisorStatus("analyzing");
    setDocumentAdvisorError(null);
    setDocumentAdvisorAnalysis(null);
    setDocumentAdvisorSelectedSectionId("");

    void (async () => {
      try {
        const analysis = await analyzeDocumentAdvisorTarget(documentAdvisorTarget);
        if (cancelled) return;
        setDocumentAdvisorAnalysis(analysis);
        setDocumentAdvisorSelectedSectionId(analysis.sections[0]?.id ?? "");
        setDocumentAdvisorStatus("ready");
      } catch (error) {
        if (cancelled) return;
        const reason = error instanceof Error ? error.message : String(error);
        setDocumentAdvisorAnalysis(null);
        setDocumentAdvisorStatus("error");
        setDocumentAdvisorError(t("document_ai.analysis_failed", { reason }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [documentAdvisorTarget?.id, documentAdvisorTarget?.updatedAt, language]);

  const documentAdvisorActions = getDocumentAdvisorActions(
    documentAdvisorAnalysis,
    documentAdvisorSelectedSectionId
  );
  const documentAdvisorHasTreeAction = documentAdvisorActions.some((action) => action.id === "create_tree_structure");
  const documentAdvisorSourceSelectionKey = (() => {
    const ids = selectedNodeIds.size > 0
      ? Array.from(selectedNodeIds).sort()
      : documentAdvisorTarget?.id
        ? [documentAdvisorTarget.id]
        : [];
    return ids.join("|");
  })();
  const documentAdvisorResolvedTranslationTarget = resolveDocumentTranslationTarget(
    documentAdvisorTranslationMode,
    documentAdvisorAnalysis?.detectedLanguage ?? "unknown",
    language,
    documentAdvisorManualTranslationLanguage
  );
  const documentAdvisorRequestedTranslationLanguage =
    documentAdvisorTranslationMode === "source"
      ? null
      : documentAdvisorTranslationMode === "auto"
        ? language
        : documentAdvisorManualTranslationLanguage;
  const documentAdvisorDisplayedAnalysis = useMemo(() => {
    if (!documentAdvisorAnalysis) return null;
    if (
      !documentAdvisorTranslatedReview ||
      documentAdvisorTranslatedReview.nodeId !== documentAdvisorAnalysis.nodeId ||
      documentAdvisorTranslatedReview.mode !== documentAdvisorTranslationMode ||
      documentAdvisorTranslatedReview.requestedLanguage !== documentAdvisorRequestedTranslationLanguage ||
      documentAdvisorTranslatedReview.targetLanguage !== documentAdvisorResolvedTranslationTarget
    ) {
      return documentAdvisorAnalysis;
    }

    const translatedSectionById = new Map(
      documentAdvisorTranslatedReview.sections.map((section) => [section.id, section] as const)
    );
    return {
      ...documentAdvisorAnalysis,
      summary: documentAdvisorTranslatedReview.summary,
      previewLines: documentAdvisorTranslatedReview.previewLines,
      sections: documentAdvisorAnalysis.sections.map((section) => {
        const translatedSection = translatedSectionById.get(section.id);
        if (!translatedSection) return section;
        return {
          ...section,
          title: translatedSection.title,
          goal: translatedSection.goal,
          previewLines: translatedSection.previewLines
        };
      })
    };
  }, [
    documentAdvisorAnalysis,
    documentAdvisorRequestedTranslationLanguage,
    documentAdvisorResolvedTranslationTarget,
    documentAdvisorTranslatedReview,
    documentAdvisorTranslationMode
  ]);
  const documentAdvisorReviewTranslationWarningMessage = getDocumentAdvisorTranslationWarningMessage(
    documentAdvisorTranslatedReview?.warning,
    documentAdvisorTranslatedReview?.targetLanguage ?? documentAdvisorResolvedTranslationTarget
  );
  const documentAdvisorSelectedSection = getDocumentAdvisorSelectedSection(
    documentAdvisorDisplayedAnalysis,
    documentAdvisorSelectedSectionId
  );

  useEffect(() => {
    if (!documentAdvisorOpen || !documentAdvisorAnalysis) {
      setDocumentAdvisorTranslatedReview(null);
      setDocumentAdvisorReviewTranslationBusy(false);
      return;
    }
    if (!documentAdvisorResolvedTranslationTarget) {
      setDocumentAdvisorTranslatedReview(null);
      setDocumentAdvisorReviewTranslationBusy(false);
      return;
    }
    if (
      documentAdvisorTranslatedReview &&
      documentAdvisorTranslatedReview.nodeId === documentAdvisorAnalysis.nodeId &&
      documentAdvisorTranslatedReview.mode === documentAdvisorTranslationMode &&
      documentAdvisorTranslatedReview.requestedLanguage === documentAdvisorRequestedTranslationLanguage &&
      documentAdvisorTranslatedReview.targetLanguage === documentAdvisorResolvedTranslationTarget
    ) {
      return;
    }

    let cancelled = false;
    setDocumentAdvisorReviewTranslationBusy(true);
    void maybeTranslateDocumentAdvisorAnalysis(
      documentAdvisorAnalysis,
      getSavedMistralApiKey() ?? undefined
    )
      .then((translation) => {
        if (cancelled) return;
        setDocumentAdvisorTranslatedReview(translation);
      })
      .finally(() => {
        if (cancelled) return;
        setDocumentAdvisorReviewTranslationBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    documentAdvisorAnalysis,
    documentAdvisorOpen,
    documentAdvisorRequestedTranslationLanguage,
    documentAdvisorResolvedTranslationTarget,
    documentAdvisorTranslatedReview,
    documentAdvisorTranslationMode,
    language
  ]);

  useEffect(() => {
    if (
      !documentAdvisorTarget ||
      !documentAdvisorOpen ||
        (documentAdvisorTreeProposal &&
        (documentAdvisorTreeProposal.targetNodeId !== documentAdvisorTarget.id ||
          documentAdvisorTreeProposal.sourceSelectionKey !== documentAdvisorSourceSelectionKey ||
          documentAdvisorTreeProposal.translationMode !== documentAdvisorTranslationMode ||
          documentAdvisorTreeProposal.translationRequestedLanguage !== documentAdvisorRequestedTranslationLanguage))
    ) {
      setDocumentAdvisorTreeProposal(null);
      setDocumentAdvisorTreeProposalBusy(false);
      setDocumentAdvisorTreeProposalError(null);
      setDocumentAdvisorTreeProposalPrompt("");
      return;
    }
  }, [
    documentAdvisorManualTranslationLanguage,
    documentAdvisorOpen,
    documentAdvisorRequestedTranslationLanguage,
    documentAdvisorSourceSelectionKey,
    documentAdvisorTarget?.id,
    documentAdvisorTranslationMode
  ]);

  useEffect(() => {
    if (
      !documentAdvisorOpen ||
      documentAdvisorStatus !== "ready" ||
      !documentAdvisorTarget ||
      !documentAdvisorHasTreeAction ||
      documentAdvisorTreeProposalError
    ) {
      return;
    }
    if (
      (documentAdvisorTreeProposal?.targetNodeId === documentAdvisorTarget.id &&
        documentAdvisorTreeProposal.sourceSelectionKey === documentAdvisorSourceSelectionKey) ||
      documentAdvisorTreeProposalBusy
    ) {
      return;
    }

    let cancelled = false;
    setDocumentAdvisorTreeProposalBusy(true);
    setDocumentAdvisorTreeProposalError(null);
    void buildDocumentAdvisorTreeProposal({ target: documentAdvisorTarget })
      .then((proposal) => {
        if (cancelled) return;
        setDocumentAdvisorTreeProposal(proposal);
      })
      .catch((error) => {
        if (cancelled) return;
        const reason = error instanceof Error ? error.message : String(error);
        setDocumentAdvisorTreeProposal(null);
        setDocumentAdvisorTreeProposalError(reason);
      })
      .finally(() => {
        if (cancelled) return;
        setDocumentAdvisorTreeProposalBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    documentAdvisorOpen,
    documentAdvisorStatus,
    documentAdvisorTarget?.id,
    documentAdvisorTarget?.updatedAt,
    documentAdvisorTranslationMode,
    documentAdvisorManualTranslationLanguage,
    documentAdvisorResolvedTranslationTarget,
    documentAdvisorSourceSelectionKey,
    documentAdvisorHasTreeAction,
    documentAdvisorTreeProposalError,
    documentAdvisorTreeProposal?.targetNodeId,
    documentAdvisorTreeProposal?.sourceSelectionKey
  ]);

  const updateDocumentAdvisorTreeProposal = async (options?: { selectedNodeKeys?: string[] }) => {
    const target = documentAdvisorTarget;
    if (!target || !documentAdvisorHasTreeAction) return;
    const request = documentAdvisorTreeProposalPrompt.trim();
    if (!request) return;
    const filteredCurrentProposal = filterDocumentAdvisorTreeProposal(
      documentAdvisorTreeProposal,
      options?.selectedNodeKeys ?? null
    );
    if (!filteredCurrentProposal) {
      setDocumentAdvisorTreeProposalError(t("document_ai.tree_proposal_selection_required"));
      return;
    }

    setDocumentAdvisorTreeProposalBusy(true);
    setDocumentAdvisorTreeProposalError(null);
    try {
      const proposal = await buildDocumentAdvisorTreeProposal({
        target,
        refinementRequest: request,
        currentProposal: filteredCurrentProposal
      });
      setDocumentAdvisorTreeProposal(proposal);
      setDocumentAdvisorTreeProposalPrompt("");
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setDocumentAdvisorTreeProposalError(reason);
    } finally {
      setDocumentAdvisorTreeProposalBusy(false);
    }
  };

  const closeNAWorkspaceModal = () => {
    setNaWorkspaceModalOpen(false);
    setNaWorkspaceOwnerNodeId(null);
    setNaWorkspaceTargetProjectId("");
  };

  const closeNADistributionModal = () => {
    if (naDistributionBusy) return;
    setNaDistributionModalOpen(false);
    setNaDistributionOwnerNodeId(null);
    setNaDistributionSourceNodeIds([]);
  };

  const openNAWorkspaceModalForOwnerNodeId = (
    ownerNodeId: string,
    preferredTargetProjectId?: string | null
  ) => {
    setNaWorkspaceOwnerNodeId(ownerNodeId);
    setNaWorkspaceTargetProjectId(preferredTargetProjectId ?? "");
    setNaWorkspaceModalOpen(true);
    setProjectError(null);
  };

  const resolveWorkspaceNASelectedSourceIds = (sourceNodeId?: string | null): string[] => {
    const selectedIds =
      selectedNodeIds.size > 1
        ? !sourceNodeId || selectedNodeIds.has(sourceNodeId)
          ? Array.from(selectedNodeIds)
          : [sourceNodeId]
        : sourceNodeId
          ? [sourceNodeId]
          : selectedNode?.id
            ? [selectedNode.id]
            : [];
    const unique = Array.from(new Set(selectedIds)).filter((id) => nodeById.has(id));
    if (unique.length === 0) return [];
    return unique.filter((candidate) => !unique.some((other) => other !== candidate && isNodeInSubtree(other, candidate)));
  };

  const naWorkspaceOwnerNode = useMemo(
    () => (naWorkspaceOwnerNodeId ? nodeById.get(naWorkspaceOwnerNodeId) ?? null : null),
    [naWorkspaceOwnerNodeId, nodeById]
  );
  const naWorkspaceAnchor = useMemo(() => readWorkspaceNAAnchor(naWorkspaceOwnerNode), [naWorkspaceOwnerNode]);
  const naWorkspaceTargetProjects = useMemo(() => {
    if (!naWorkspaceAnchor) return [];
    return projects.map((project) => ({
      project,
      target: resolveWorkspaceNATargetForProject(project, naWorkspaceAnchor.code)
    }));
  }, [naWorkspaceAnchor, projects, byParent, nodeById, store.allNodes]);
  const naWorkspaceSelectedTarget = useMemo(
    () => naWorkspaceTargetProjects.find((entry) => entry.project.id === naWorkspaceTargetProjectId) ?? null,
    [naWorkspaceTargetProjectId, naWorkspaceTargetProjects]
  );

  useEffect(() => {
    if (!naWorkspaceModalOpen) return;
    const nextTargetId =
      naWorkspaceTargetProjects.find((entry) => entry.project.id === naWorkspaceTargetProjectId)?.project.id ??
      naWorkspaceTargetProjects.find((entry) => entry.project.id === naWorkspaceAnchor?.target_project_id)?.project.id ??
      naWorkspaceTargetProjects[0]?.project.id ??
      "";
    if (nextTargetId !== naWorkspaceTargetProjectId) {
      setNaWorkspaceTargetProjectId(nextTargetId);
    }
  }, [
    naWorkspaceModalOpen,
    naWorkspaceAnchor?.target_project_id,
    naWorkspaceTargetProjectId,
    naWorkspaceTargetProjects
  ]);

  function openNAWorkspaceModal(sourceNodeId?: string | null) {
    const sourceNode =
      sourceNodeId && nodeById.has(sourceNodeId) ? nodeById.get(sourceNodeId) ?? null : selectedNode ?? null;
    const ownerNode = findWorkspaceNAOwnerNode(sourceNode);
    if (!ownerNode) {
      setProjectError(t("na_workspace.anchor_missing"));
      return;
    }
    const anchor = readWorkspaceNAAnchor(ownerNode);
    openNAWorkspaceModalForOwnerNodeId(ownerNode.id, anchor?.target_project_id);
  }

  const saveNAWorkspaceTarget = async () => {
    if (!naWorkspaceOwnerNode || !naWorkspaceAnchor || !naWorkspaceSelectedTarget) return;
    const targetProject = naWorkspaceSelectedTarget.project;
    const targetResolution = resolveWorkspaceNATargetForProject(targetProject, naWorkspaceAnchor.code);
    if (!targetResolution.node) {
      setProjectError(
        t("na_workspace.target_unresolved", {
          code: naWorkspaceAnchor.code,
          label: naWorkspaceAnchor.label
        })
      );
      return;
    }

    const persistedTarget =
      targetResolution.mode === "na_branch"
        ? (await ensureODENodeMetadataForBranch(targetResolution.node)).get(targetResolution.node.id) ??
          targetResolution.node
        : targetResolution.node;
    const nextAnchor: WorkspaceNAAnchor = {
      ...naWorkspaceAnchor,
      target_project_id: targetProject.id,
      target_project_name: targetProject.name,
      target_node_id: persistedTarget.id,
      target_path: getNodePathLabel(persistedTarget) ?? targetResolution.pathLabel,
      ambiguous: targetResolution.ambiguous,
      matched_at: new Date().toISOString(),
      source: "manual"
    };
    await updateNodeProperties(naWorkspaceOwnerNode.id, {
      ...(naWorkspaceOwnerNode.properties ?? {}),
      odeWorkspaceNA: nextAnchor
    });
    store.patchNode(naWorkspaceOwnerNode.id, {
      properties: {
        ...(naWorkspaceOwnerNode.properties ?? {}),
        odeWorkspaceNA: nextAnchor
      },
      updatedAt: Date.now()
    });
    setProjectNotice(
      t("na_workspace.saved_notice", {
        project: targetProject.name,
        code: nextAnchor.code,
        label: nextAnchor.label
      })
    );
    closeNAWorkspaceModal();
  };

  function openNADistributionModal(sourceNodeId?: string | null) {
    const sourceIds = resolveWorkspaceNASelectedSourceIds(sourceNodeId);
    if (sourceIds.length === 0) {
      setProjectError(t("na_workspace.distribution_source_missing"));
      return;
    }
    if (sourceIds.some((id) => workspaceRootIdSet.has(id))) {
      setProjectError(t("na_workspace.distribution_root_blocked"));
      return;
    }

    const ownerNodeIds = Array.from(
      new Set(
        sourceIds
          .map((id) => findWorkspaceNAOwnerNode(nodeById.get(id) ?? null)?.id ?? null)
          .filter((value): value is string => Boolean(value))
      )
    );
    if (ownerNodeIds.length !== 1) {
      setProjectError(t("na_workspace.distribution_scope_mismatch"));
      return;
    }
    const ownerNode = nodeById.get(ownerNodeIds[0]) ?? null;
    const anchor = readWorkspaceNAAnchor(ownerNode);
    if (!ownerNode || !anchor) {
      setProjectError(t("na_workspace.anchor_missing"));
      return;
    }
    if (!anchor.target_project_id) {
      setProjectError(t("na_workspace.target_missing"));
      return;
    }
    const targetProject = projects.find((project) => project.id === anchor.target_project_id) ?? null;
    if (!targetProject) {
      setProjectError(t("na_workspace.target_missing"));
      return;
    }
    const targetResolution = resolveWorkspaceNATargetForProject(targetProject, anchor.code);
    if (!targetResolution.node) {
      setProjectError(
        t("na_workspace.target_unresolved", {
          code: anchor.code,
          label: anchor.label
        })
      );
      return;
    }

    setNaDistributionOwnerNodeId(ownerNode.id);
    setNaDistributionSourceNodeIds(sourceIds);
    setNaDistributionModalOpen(true);
    setProjectError(null);
  }

  const naDistributionOwnerNode = useMemo(
    () => (naDistributionOwnerNodeId ? nodeById.get(naDistributionOwnerNodeId) ?? null : null),
    [naDistributionOwnerNodeId, nodeById]
  );
  const naDistributionAnchor = useMemo(
    () => readWorkspaceNAAnchor(naDistributionOwnerNode),
    [naDistributionOwnerNode]
  );
  const naDistributionTargetProject = useMemo(
    () =>
      naDistributionAnchor?.target_project_id
        ? projects.find((project) => project.id === naDistributionAnchor.target_project_id) ?? null
        : null,
    [naDistributionAnchor, projects]
  );
  const naDistributionTargetResolution = useMemo(
    () =>
      naDistributionAnchor && naDistributionTargetProject
        ? resolveWorkspaceNATargetForProject(naDistributionTargetProject, naDistributionAnchor.code)
        : { node: null, mode: "workspace_root", pathLabel: null, ambiguous: false },
    [naDistributionAnchor, naDistributionTargetProject, byParent, nodeById, store.allNodes]
  );
  const naDistributionSourceLabel = useMemo(
    () =>
      naDistributionSourceNodeIds
        .map((id) => nodeById.get(id)?.name ?? id)
        .join(", "),
    [naDistributionSourceNodeIds, nodeById]
  );

  const distributeSelectedNodesToNAWorkspace = async () => {
    if (!naDistributionOwnerNode || !naDistributionAnchor || !naDistributionTargetProject) {
      setProjectError(t("na_workspace.target_missing"));
      return;
    }
    const targetResolution = resolveWorkspaceNATargetForProject(
      naDistributionTargetProject,
      naDistributionAnchor.code
    );
    if (!targetResolution.node) {
      setProjectError(
        t("na_workspace.target_unresolved", {
          code: naDistributionAnchor.code,
          label: naDistributionAnchor.label
        })
      );
      return;
    }
    if (!ensureStructureMutationAllowed([targetResolution.node.id])) {
      return;
    }

    setNaDistributionBusy(true);
    try {
      const targetNode =
        targetResolution.mode === "na_branch"
          ? (await ensureODENodeMetadataForBranch(targetResolution.node)).get(targetResolution.node.id) ??
            targetResolution.node
          : targetResolution.node;
      const refreshParents = new Set<string>([targetNode.id, naDistributionTargetProject.rootNodeId]);
      let afterId = ((byParent.get(targetNode.id) ?? []).slice(-1)[0]?.id ?? null) as string | null;
      let firstCreatedId: string | null = null;
      const distributedAt = new Date().toISOString();

      for (const sourceId of naDistributionSourceNodeIds) {
        const sourceNode = nodeById.get(sourceId);
        if (!sourceNode) continue;
        const snapshot = buildBranchSnapshot(sourceId);
        if (!snapshot) continue;
        const createdId = await cloneBranchSnapshot(snapshot, targetNode.id, afterId, {
          odeDistributedFrom: {
            source_node_id: sourceNode.id,
            source_node_name: sourceNode.name,
            source_workspace_id: activeProjectId,
            source_workspace_name: activeProject?.name ?? null,
            anchor_owner_node_id: naDistributionOwnerNode.id,
            target_project_id: naDistributionTargetProject.id,
            target_project_name: naDistributionTargetProject.name,
            target_na_code: naDistributionAnchor.code,
            target_na_label: naDistributionAnchor.label,
            distributed_at: distributedAt,
            mode: "copy"
          }
        });
        afterId = createdId;
        refreshParents.add(sourceNode.parentId);
        if (!firstCreatedId) {
          firstCreatedId = createdId;
        }
      }

      if (!firstCreatedId) {
        throw new Error(t("na_workspace.distribution_source_missing"));
      }

      const refreshedTargetProjectId =
        (await refreshProjects(naDistributionTargetProject.id)) ?? naDistributionTargetProject.id;
      await handleProjectSelectionChange(refreshedTargetProjectId);
      await refreshTreeAndKeepContext(firstCreatedId, Array.from(refreshParents), "tree");
      setPrimarySelection(firstCreatedId, "tree");
      setProjectNotice(
        t("na_workspace.distributed_notice", {
          count: naDistributionSourceNodeIds.length,
          project: naDistributionTargetProject.name,
          code: naDistributionAnchor.code,
          label: naDistributionAnchor.label
        })
      );
      closeNADistributionModal();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setProjectError(t("na_workspace.distribution_failed", { reason }));
    } finally {
      setNaDistributionBusy(false);
    }
  };

  const contextMenuNode = contextMenu?.nodeId ? nodeById.get(contextMenu.nodeId) ?? null : null;
  const contextMenuNodeIsFile = Boolean(contextMenuNode && isFileLikeNode(contextMenuNode));
  const contextMenuNodeIsExecutionTask = isHiddenExecutionTaskNode(contextMenuNode);
  const contextMenuNodeStructureLocked = isNodeStructureLockOwner(contextMenuNode);
  const contextMenuCanToggleStructureLock = Boolean(
    contextMenuNode &&
      !contextMenuNodeIsFile &&
      !contextMenuNodeIsExecutionTask &&
      ((activeProjectRootId && contextMenuNode.id === activeProjectRootId) || contextMenuNodeStructureLocked)
  );
  const contextMenuNodeWorkareaKind = getWorkareaItemKind(contextMenuNode, nodeById);
  const contextMenuNodeIsDeclaredWorkareaOwner = isDeclaredWorkareaOwnerNode(contextMenuNode);
  const contextMenuNodeCanOpenWorkarea = Boolean(
    contextMenuNode &&
      !isFileLikeNode(contextMenuNode) &&
      !isWorkareaItemNode(contextMenuNode) &&
      resolveWorkareaOwnerNodeId(contextMenuNode.id)
  );
  const contextMenuNodeFilePath =
    contextMenuNode && isFileLikeNode(contextMenuNode) ? getNodePreferredFileActionPath(contextMenuNode) : null;
  const contextMenuCanMoveNodeIn = Boolean(
    contextMenu?.kind === "node" &&
      contextMenu.surface === "tree" &&
      contextMenu.nodeId &&
      canMoveTreeSelectionIn(contextMenu.nodeId)
  );
  const contextMenuCanMoveNodeOut = Boolean(
    contextMenu?.kind === "node" &&
      contextMenu.surface === "tree" &&
      contextMenu.nodeId &&
      canMoveTreeSelectionOut(contextMenu.nodeId)
  );
  const contextMenuGroupCanDelete = Boolean(
    contextMenu?.kind === "quick_access_group" &&
    contextMenu.groupId &&
    favoriteGroups.some((group) => group.id === contextMenu.groupId)
  );
  const contextMenuWorkspaceNAOwnerNode = findWorkspaceNAOwnerNode(contextMenuNode ?? selectedNode);
  const contextMenuWorkspaceNAAnchor = readWorkspaceNAAnchor(contextMenuWorkspaceNAOwnerNode);
  const contextMenuCanDistributeToNAWorkspace = Boolean(
    contextMenu?.kind === "node" &&
      contextMenuNode &&
      !isFileLikeNode(contextMenuNode) &&
      contextMenuWorkspaceNAAnchor &&
      contextMenuWorkspaceNAAnchor?.target_project_id &&
      contextMenuWorkspaceNAAnchor.target_node_id
  );
  const scopedRootDropTargetId = activeProjectRootId ?? ROOT_PARENT_ID;
  const desktopScopedRootDropTargetId =
    workspaceMode === "grid" && workspaceFocusMode === "execution"
      ? desktopWorkareaOwnerNodeId ?? activeProjectRootId ?? ROOT_PARENT_ID
      : scopedRootDropTargetId;
  const desktopCurrentFolderDropTargetId =
    workspaceMode === "grid" && workspaceFocusMode === "execution"
      ? desktopWorkareaBrowseNodeId ?? desktopWorkareaOwnerNodeId ?? activeProjectRootId ?? null
      : desktopMirrorRootId ?? activeProjectRootId ?? null;
  const desktopWorkareaOwnerCard =
    workspaceMode === "grid" && workspaceFocusMode === "execution" && desktopWorkareaOwnerNode ? (
      <div className="mt-3 rounded-xl border border-[var(--ode-border)] bg-[rgba(5,25,42,0.72)] px-3 py-3">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg border border-[rgba(81,182,214,0.22)] bg-[rgba(9,45,68,0.54)] px-3 py-2 text-left text-[var(--ode-text)] transition hover:bg-[rgba(15,74,113,0.4)]"
          onClick={() => {
            void openNodeInWorkarea(desktopWorkareaOwnerNode.id);
          }}
        >
          <NodeGlyph
            node={desktopWorkareaOwnerNode}
            active
            folderState={folderNodeStateById.get(desktopWorkareaOwnerNode.id)}
            showExecutionOwnerGlyph={executionOwnerNodeIds.has(desktopWorkareaOwnerNode.id)}
          />
          <span className="min-w-0 flex-1 truncate text-[0.94rem] font-medium">
            {desktopWorkareaOwnerNode.name}
          </span>
        </button>
        {desktopWorkareaOwnerOptions.some((node) => node.id !== desktopWorkareaOwnerNode.id) ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {desktopWorkareaOwnerOptions
              .filter((node) => node.id !== desktopWorkareaOwnerNode.id)
              .map((node) => (
                <button
                  key={`workarea-owner-${node.id}`}
                  type="button"
                  className="rounded-md border border-[var(--ode-border)] bg-[rgba(3,18,30,0.45)] px-2 py-[5px] text-[0.76rem] text-[var(--ode-text-dim)] transition hover:border-[rgba(81,182,214,0.3)] hover:text-[var(--ode-text)]"
                  onClick={() => {
                    void openNodeInWorkarea(node.id);
                  }}
                >
                  {node.name}
                </button>
              ))}
          </div>
        ) : null}
      </div>
    ) : undefined;

  const openUtilityPanelInCurrentWindow = (view: UtilityPanelView) => {
    setReleaseNotesOpen(view === "release");
    setHelpOpen(view === "help");
    setQaChecklistOpen(view === "qa");
  };

  const closeUtilityPanelWindowIfNeeded = () => {
    if (!isUtilityPanelWindow) return false;
    if (isTauri()) {
      void getCurrentWindow().close().catch(() => {
        if (typeof window !== "undefined") {
          window.close();
        }
      });
    } else if (typeof window !== "undefined") {
      window.close();
    }
    return true;
  };

  const openUtilityPanel = async (view: UtilityPanelView) => {
    if (isUtilityPanelWindow) {
      openUtilityPanelInCurrentWindow(view);
      return;
    }

    if (!isTauri()) {
      openUtilityPanelInCurrentWindow(view);
      return;
    }

    const label = `odetool-panel-${view}`;
    try {
      const existing = await WebviewWindow.getByLabel(label);
      if (existing) {
        await existing.show();
        await existing.setFocus();
        return;
      }

      const targetUrl = new URL(window.location.href);
      targetUrl.searchParams.set("utility", view);
      targetUrl.searchParams.set("lang", language);
      const panelTitle = view === "release" ? t("release.open") : view === "help" ? t("help.open") : t("qa.open");
      const panelWindow = new WebviewWindow(label, {
        title: `ODETool - ${panelTitle}`,
        url: targetUrl.toString(),
        center: true,
        width: 1280,
        height: 900,
        minWidth: 920,
        minHeight: 640,
        resizable: true,
        focus: true
      });
      void panelWindow.once("tauri://error", () => {
        openUtilityPanelInCurrentWindow(view);
      });
    } catch {
      openUtilityPanelInCurrentWindow(view);
    }
  };

  const naWorkspaceModalDrag = useDraggableModalSurface({ open: naWorkspaceModalOpen });
  const naDistributionModalDrag = useDraggableModalSurface({ open: naDistributionModalOpen });
  const moveWorkspaceModalDrag = useDraggableModalSurface({ open: moveWorkspaceModalOpen });
  const favoriteGroupModalDrag = useDraggableModalSurface({ open: favoriteGroupModalOpen });
  const favoriteGroupSettingsModalDrag = useDraggableModalSurface({ open: favoriteGroupSettingsModalOpen });
  const favoriteAssignModalDrag = useDraggableModalSurface({ open: favoriteAssignModalOpen });

  return (
    <div
      className={`ode-root flex h-full w-full flex-col ${isResizingSidebar || isResizingTimelinePanel ? "ode-resizing" : ""
        }`}
      onContextMenu={(event) => {
        // Block default WebView/Chromium context menu globally.
        // Custom ODE context menus are opened explicitly in specific panels.
        event.preventDefault();
      }}
    >
      <ModalStack>
        {LEGACY_AI_SURFACE_ENABLED ? (
          <>
            <AiSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} language={language} />
          </>
        ) : null}
        <ODEImportPreviewModal
          open={Boolean(odeImportPreviewState)}
          t={t}
          preview={odeImportPreviewState?.preview ?? null}
          createAs={odeImportPreviewState?.createAs ?? null}
          targetNodeName={odeImportPreviewState?.targetNodeName ?? null}
          targetPathLabel={odeImportPreviewState?.targetPathLabel ?? null}
          onClose={closeOdeImportPreview}
          onConfirm={confirmOdeImportPreview}
        />
        <MindMapFileReviewModal
          open={Boolean(mindMapReviewNode)}
          t={t}
          node={mindMapReviewNode}
          previewKind={mindMapReviewPreviewKind}
          previewSrc={mindMapReviewMediaPreviewSrc}
          powerPointSlideSrcs={mindMapReviewPowerPointSlideSrcs}
          previewText={mindMapReviewPreviewKind === "text" ? mindMapTextPreviewState.text : null}
          previewLoading={mindMapReviewPreviewLoading}
          previewError={mindMapReviewPreviewError}
          nodeTypeLabel={mindMapReviewNode ? getNodeTypeDisplayLabel(mindMapReviewNode) : null}
          sizeLabel={mindMapReviewNode ? formatBytes(getNodeSizeBytes(mindMapReviewNode)) : null}
          modifiedLabel={
            mindMapReviewNode ? formatNodeModified(mindMapReviewNode.updatedAt, language) : null
          }
          onOpenExternal={() => {
            if (!mindMapReviewNode) return;
            void openFileNode(mindMapReviewNode.id);
          }}
          onClose={() => setMindMapReviewNodeId(null)}
        />
        <WorkspaceSettingsModal
          open={workspaceSettingsOpen}
          showAiRebuild={AI_REBUILD_PANEL_VISIBLE}
          t={t}
          projects={projects}
          activeProjectId={activeProjectId}
          defaultProjectId={defaultProjectId}
          workspaceNameInput={workspaceNameInput}
          workspaceLocalPathInput={workspaceLocalPathInput}
          isProjectImporting={isProjectImporting}
          isWorkspaceCreating={isWorkspaceCreating}
          isProjectResyncing={isProjectResyncing}
          isProjectDeleting={isProjectDeleting}
          workspaceCreateInlineOpen={workspaceCreateInlineOpen}
          workspaceExternalChangeCount={workspaceExternalChangeCount}
          isWorkspaceExternalChangeChecking={isWorkspaceExternalChangeChecking}
          workspaceError={workspaceManageError}
          workspaceNotice={workspaceManageNotice}
          onClose={() => {
            const nextState = buildWorkspaceSettingsCloseState();
            setWorkspaceSettingsOpen(nextState.workspaceSettingsOpen);
            setWorkspaceCreateInlineOpen(nextState.workspaceCreateInlineOpen);
            setWorkspaceNameInput(nextState.workspaceNameInput);
            setWorkspaceLocalPathInput(nextState.workspaceLocalPathInput);
            setWorkspaceManageError(nextState.workspaceManageError);
            setWorkspaceManageNotice(nextState.workspaceManageNotice);
            setAiRebuildError(nextState.aiRebuildError);
          }}
          onProjectSelectionChange={(projectId) => {
            void handleProjectSelectionChange(projectId);
          }}
          onWorkspaceNameInputChange={setWorkspaceNameInput}
          onWorkspaceLocalPathInputChange={setWorkspaceLocalPathInput}
          onOpenCreateWorkspace={openWorkspaceCreateInline}
          onCancelCreateWorkspace={cancelWorkspaceCreateInline}
          onCreateWorkspace={() => {
            void submitWorkspaceCreateInline();
          }}
          onPickAndImportProjectFolder={() => {
            void handlePickAndImportProjectFolder();
          }}
          onPickWorkspaceLocalFolder={() => {
            void handlePickWorkspaceLocalFolder();
          }}
          onSetWorkspaceLocalPath={() => {
            void handleSetActiveWorkspaceLocalPath();
          }}
          onReSyncWorkspace={() => {
            void (async () => {
              await handleReSyncWorkspace();
              await refreshWorkspaceExternalChangeBadge(activeProjectIdRef.current);
            })();
          }}
          onDeleteProjectWorkspace={() => {
            void handleDeleteProjectWorkspace();
          }}
          onSetDefaultWorkspace={setActiveWorkspaceAsDefault}
          onOpenWorkspaceFolderLocation={() => {
            void openSelectedWorkspaceFolderLocation();
          }}
          workspaceRootNumberingEnabled={workspaceRootNumberingEnabled}
          onWorkspaceRootNumberingEnabledChange={setWorkspaceRootNumberingEnabled}
          aiRebuildStatus={aiRebuildStatus}
          aiRebuildStatusBusy={aiRebuildStatusBusy}
          aiRebuildWorkflowBusy={aiRebuildWorkflowBusy}
          aiRebuildError={aiRebuildError}
          aiRebuildOverview={aiRebuildWorkspaceOverview}
          aiRebuildKnowledgeSnapshot={aiRebuildKnowledgeSnapshot}
          aiRebuildDocumentIngestion={aiRebuildDocumentIngestion}
          aiRebuildDocumentStore={aiRebuildDocumentStore}
          aiRebuildWorkspaceKnowledgeSummary={aiRebuildWorkspaceKnowledgeSummary}
          aiRebuildKnowledgeRetrieval={aiRebuildKnowledgeRetrieval}
          aiRebuildActionPlan={aiRebuildActionPlan}
          aiRebuildApprovalQueue={aiRebuildApprovalQueue}
          aiRebuildExecutionPacket={aiRebuildExecutionPacket}
          aiRebuildFinalSolution={aiRebuildFinalSolution}
          onRefreshAiRebuildStatus={() => {
            void refreshAiRebuildStatus();
          }}
          onRunAiRebuildWorkspaceOverview={() => {
            void runAiRebuildWorkspaceOverview();
          }}
          onRunAiRebuildKnowledgeSnapshot={() => {
            void runAiRebuildKnowledgeSnapshot();
          }}
          onRunAiRebuildDocumentIngestion={() => {
            void runAiRebuildDocumentIngestion();
          }}
          onRunAiRebuildDocumentStore={() => {
            void runAiRebuildDocumentStore();
          }}
          onRunAiRebuildWorkspaceKnowledgeSummary={() => {
            void runAiRebuildWorkspaceKnowledgeSummary();
          }}
          onRunAiRebuildKnowledgeRetrieval={(query) => {
            void runAiRebuildKnowledgeRetrieval(query);
          }}
          onRunAiRebuildActionPlan={(focus) => {
            void runAiRebuildActionPlan(focus);
          }}
          onRunAiRebuildApprovalQueue={(focus) => {
            void runAiRebuildApprovalQueue(focus);
          }}
          onRunAiRebuildExecutionPacket={(focus) => {
            void runAiRebuildExecutionPacket(focus);
          }}
          onRunAiRebuildFinalSolution={() => {
            void runAiRebuildFinalSolution();
          }}
        />
        {naWorkspaceModalOpen ? (
          <div
            className="ode-overlay-scrim fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target !== event.currentTarget) return;
              closeNAWorkspaceModal();
            }}
          >
            <div
              ref={naWorkspaceModalDrag.surfaceRef}
              style={naWorkspaceModalDrag.surfaceStyle}
              className="ode-modal w-full max-w-lg overflow-hidden rounded-[22px] border border-[var(--ode-border-strong)]"
            >
              <div
                className="ode-modal-drag-handle flex items-center justify-between border-b border-[var(--ode-border)] px-6 py-5"
                onPointerDown={naWorkspaceModalDrag.handlePointerDown}
              >
                <h2 className="text-[1.35rem] font-semibold tracking-tight text-[var(--ode-accent)]">
                  {t("na_workspace.modal_title")}
                </h2>
                <button type="button" className="ode-icon-btn h-10 w-10" onClick={closeNAWorkspaceModal}>
                  x
                </button>
              </div>
              <div className="space-y-4 px-6 py-5">
                <div>
                  <label className="block text-[0.8rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                    {t("na_workspace.modal_source")}
                  </label>
                  <p className="mt-1 rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.5)] px-3 py-2 text-[0.9rem] text-[var(--ode-text)]">
                    {naWorkspaceOwnerNode?.name ?? t("project.move_modal_none")}
                  </p>
                </div>
                <div>
                  <label className="block text-[0.8rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                    {t("na_workspace.modal_anchor")}
                  </label>
                  <p className="mt-1 rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.5)] px-3 py-2 text-[0.9rem] text-[var(--ode-text)]">
                    {naWorkspaceAnchor ? `${naWorkspaceAnchor.code} ${naWorkspaceAnchor.label}` : t("project.move_modal_none")}
                  </p>
                  {naWorkspaceAnchor ? (
                    <p className="mt-1 text-[0.84rem] text-[var(--ode-text-muted)]">{naWorkspaceAnchor.path}</p>
                  ) : null}
                </div>
                <div>
                  <label className="block text-[0.8rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                    {t("na_workspace.modal_target")}
                  </label>
                  <select
                    className="ode-input mt-1 h-11 w-full rounded-lg px-3"
                    value={naWorkspaceTargetProjectId}
                    onChange={(event) => setNaWorkspaceTargetProjectId(event.target.value)}
                    disabled={naWorkspaceTargetProjects.length === 0}
                  >
                    {naWorkspaceTargetProjects.length === 0 ? (
                      <option value="">{t("na_workspace.modal_none")}</option>
                    ) : null}
                    {naWorkspaceTargetProjects.map((entry) => (
                      <option key={`na-workspace-target-${entry.project.id}`} value={entry.project.id}>
                        {entry.project.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[0.8rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                    {t("na_workspace.modal_target_path")}
                  </label>
                  <p className="mt-1 rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.5)] px-3 py-2 text-[0.9rem] text-[var(--ode-text)]">
                    {naWorkspaceSelectedTarget?.target.node
                      ? naWorkspaceSelectedTarget.target.pathLabel ?? naWorkspaceSelectedTarget.target.node.name
                      : t("na_workspace.modal_none")}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-[var(--ode-border)] px-6 py-4">
                <button className="ode-text-btn h-11 px-5" onClick={closeNAWorkspaceModal}>
                  {t("project.move_modal_cancel")}
                </button>
                <button
                  className="ode-primary-btn h-11 px-6"
                  disabled={!naWorkspaceSelectedTarget?.target.node}
                  onClick={() => {
                    void saveNAWorkspaceTarget();
                  }}
                >
                  {t("na_workspace.modal_confirm")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {naDistributionModalOpen ? (
          <div
            className="ode-overlay-scrim fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target !== event.currentTarget) return;
              closeNADistributionModal();
            }}
          >
            <div
              ref={naDistributionModalDrag.surfaceRef}
              style={naDistributionModalDrag.surfaceStyle}
              className="ode-modal w-full max-w-lg overflow-hidden rounded-[22px] border border-[var(--ode-border-strong)]"
            >
              <div
                className="ode-modal-drag-handle flex items-center justify-between border-b border-[var(--ode-border)] px-6 py-5"
                onPointerDown={naDistributionModalDrag.handlePointerDown}
              >
                <h2 className="text-[1.35rem] font-semibold tracking-tight text-[var(--ode-accent)]">
                  {t("na_workspace.distribute_title")}
                </h2>
                <button
                  type="button"
                  className="ode-icon-btn h-10 w-10"
                  onClick={closeNADistributionModal}
                  disabled={naDistributionBusy}
                >
                  x
                </button>
              </div>
              <div className="space-y-4 px-6 py-5">
                <div>
                  <label className="block text-[0.8rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                    {t("na_workspace.distribute_source")}
                  </label>
                  <p className="mt-1 rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.5)] px-3 py-2 text-[0.9rem] text-[var(--ode-text)]">
                    {naDistributionSourceLabel || t("project.move_modal_none")}
                  </p>
                </div>
                <div>
                  <label className="block text-[0.8rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                    {t("na_workspace.distribute_target")}
                  </label>
                  <p className="mt-1 rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.5)] px-3 py-2 text-[0.9rem] text-[var(--ode-text)]">
                    {naDistributionTargetProject && naDistributionAnchor
                      ? `${naDistributionTargetProject.name} -> ${naDistributionAnchor.code} ${naDistributionAnchor.label}`
                      : t("na_workspace.modal_none")}
                  </p>
                  <p className="mt-1 text-[0.84rem] text-[var(--ode-text-muted)]">
                    {naDistributionTargetResolution.node
                      ? naDistributionTargetResolution.pathLabel ?? naDistributionTargetResolution.node.name
                      : t("na_workspace.modal_none")}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-[var(--ode-border)] px-6 py-4">
                <button
                  className="ode-text-btn h-11 px-5"
                  onClick={closeNADistributionModal}
                  disabled={naDistributionBusy}
                >
                  {t("project.move_modal_cancel")}
                </button>
                <button
                  className="ode-primary-btn h-11 px-6"
                  disabled={!naDistributionTargetResolution.node || naDistributionBusy}
                  onClick={() => {
                    void distributeSelectedNodesToNAWorkspace();
                  }}
                >
                  {naDistributionBusy ? t("document_ai.run_busy") : t("na_workspace.distribute_confirm")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {moveWorkspaceModalOpen ? (
          <div
            className="ode-overlay-scrim fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target !== event.currentTarget) return;
              closeMoveWorkspaceModal();
            }}
          >
            <div
              ref={moveWorkspaceModalDrag.surfaceRef}
              style={moveWorkspaceModalDrag.surfaceStyle}
              className="ode-modal w-full max-w-lg overflow-hidden rounded-[22px] border border-[var(--ode-border-strong)]"
            >
              <div
                className="ode-modal-drag-handle flex items-center justify-between border-b border-[var(--ode-border)] px-6 py-5"
                onPointerDown={moveWorkspaceModalDrag.handlePointerDown}
              >
                <h2 className="text-[1.35rem] font-semibold tracking-tight text-[var(--ode-accent)]">
                  {t("project.move_modal_title")}
                </h2>
                <button type="button" className="ode-icon-btn h-10 w-10" onClick={closeMoveWorkspaceModal}>
                  x
                </button>
              </div>
              <div className="space-y-3 px-6 py-5">
                <div>
                  <label className="block text-[0.8rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                    {t("project.move_modal_source")}
                  </label>
                  <p className="mt-1 rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.5)] px-3 py-2 text-[0.9rem] text-[var(--ode-text)]">
                    {moveWorkspaceSourceLabel || t("project.move_modal_none")}
                  </p>
                </div>
                <div>
                  <label className="block text-[0.8rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                    {t("project.move_modal_target")}
                  </label>
                  <select
                    className="ode-input mt-1 h-11 w-full rounded-lg px-3"
                    value={moveWorkspaceTargetProjectId}
                    onChange={(event) => setMoveWorkspaceTargetProjectId(event.target.value)}
                    disabled={moveWorkspaceTargetProjects.length === 0}
                  >
                    {moveWorkspaceTargetProjects.length === 0 ? (
                      <option value="">{t("project.move_modal_none")}</option>
                    ) : null}
                    {moveWorkspaceTargetProjects.map((project) => (
                      <option key={`move-workspace-target-${project.id}`} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-[var(--ode-border)] px-6 py-4">
                <button className="ode-text-btn h-11 px-5" onClick={closeMoveWorkspaceModal}>
                  {t("project.move_modal_cancel")}
                </button>
                <button
                  className="ode-primary-btn h-11 px-6"
                  disabled={
                    !moveWorkspaceTargetProjectId ||
                    !moveWorkspaceTargetProjects.some((project) => project.id === moveWorkspaceTargetProjectId)
                  }
                  onClick={() => {
                    void moveBranchToWorkspace();
                  }}
                >
                  {t("project.move_modal_confirm")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <NodeTooltipEditModal
          t={t}
          open={Boolean(tooltipEditorNode)}
          nodeLabel={tooltipEditorNode?.name ?? ""}
          value={tooltipEditorValue}
          saving={tooltipEditorSaving}
          onChange={setTooltipEditorValue}
          onClose={closeNodeTooltipEditor}
          onSave={saveTooltipEditorDescription}
        />
        <NodeQuickAppsModal
          t={t}
          open={Boolean(quickAppsModalNode)}
          nodeLabel={quickAppsModalNode?.name ?? ""}
          items={quickAppsDraftItems}
          saving={quickAppsSaving}
          onAdd={addQuickAppDraftItem}
          onRemove={removeQuickAppDraftItem}
          onMove={moveQuickAppDraftItem}
          onChange={updateQuickAppDraftItem}
          onClose={closeNodeQuickAppsModal}
          onSave={saveQuickAppsModal}
        />
        {favoriteGroupModalOpen ? (
          <div
            className="ode-overlay-scrim fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target !== event.currentTarget) return;
              closeFavoriteGroupModal();
            }}
          >
            <div
              ref={favoriteGroupModalDrag.surfaceRef}
              style={favoriteGroupModalDrag.surfaceStyle}
              className="ode-modal w-full max-w-md overflow-hidden rounded-[22px] border border-[var(--ode-border-strong)]"
            >
              <div
                className="ode-modal-drag-handle flex items-center justify-between border-b border-[var(--ode-border)] px-6 py-5"
                onPointerDown={favoriteGroupModalDrag.handlePointerDown}
              >
                <h2 className="text-[1.35rem] font-semibold tracking-tight text-[var(--ode-accent)]">
                  {favoriteGroupEditingId
                    ? favoriteGroups.find((group) => group.id === favoriteGroupEditingId)?.name ??
                      t("favorites.group_modal_title")
                    : t("favorites.group_modal_title")}
                </h2>
                <button type="button" className="ode-icon-btn h-10 w-10" onClick={closeFavoriteGroupModal}>
                  x
                </button>
              </div>
              <div className="space-y-3 px-6 py-5">
                <input
                  className="ode-input h-11 w-full rounded-lg px-3"
                  placeholder={t("favorites.group_name_placeholder")}
                  value={favoriteGroupNameInput}
                  autoFocus
                  onChange={(event) => setFavoriteGroupNameInput(event.target.value)}
                />
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-[var(--ode-border)] px-6 py-4">
                <button className="ode-text-btn h-11 px-5" onClick={closeFavoriteGroupModal}>
                  {t("delete.modal_cancel")}
                </button>
                <button
                  className="ode-primary-btn h-11 px-6"
                  disabled={favoriteGroupNameInput.trim().length === 0}
                  onClick={() => {
                    void confirmCreateFavoriteGroup();
                  }}
                >
                  {favoriteGroupEditingId ? t("settings.save") : t("favorites.group_create_btn")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {favoriteGroupSettingsModalOpen ? (
          <div
            className="ode-overlay-scrim fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target !== event.currentTarget) return;
              closeFavoriteGroupSettingsModal();
            }}
          >
            <div
              ref={favoriteGroupSettingsModalDrag.surfaceRef}
              style={favoriteGroupSettingsModalDrag.surfaceStyle}
              className="ode-modal w-full max-w-md overflow-hidden rounded-[22px] border border-[var(--ode-border-strong)]"
            >
              <div
                className="ode-modal-drag-handle flex items-center justify-between border-b border-[var(--ode-border)] px-6 py-5"
                onPointerDown={favoriteGroupSettingsModalDrag.handlePointerDown}
              >
                <h2 className="text-[1.35rem] font-semibold tracking-tight text-[var(--ode-accent)]">
                  {t("favorites.group_assign_title")}
                </h2>
                <button type="button" className="ode-icon-btn h-10 w-10" onClick={closeFavoriteGroupSettingsModal}>
                  x
                </button>
              </div>
              <div className="space-y-3 px-6 py-5">
                <div className="flex items-center gap-2">
                  <input
                    className="ode-input h-11 min-w-0 flex-1 rounded-lg px-3"
                    placeholder={t("favorites.group_name_placeholder")}
                    value={favoriteGroupNameInput}
                    autoFocus
                    onChange={(event) => setFavoriteGroupNameInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        confirmCreateFavoriteGroupFromSettings();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="ode-primary-btn h-11 w-11 px-0 text-[1.1rem]"
                    onClick={confirmCreateFavoriteGroupFromSettings}
                    disabled={favoriteGroupNameInput.trim().length === 0}
                    aria-label={t("favorites.group_new")}
                  >
                    +
                  </button>
                </div>
                <div className="max-h-64 space-y-2 overflow-auto rounded-lg border border-[var(--ode-border)] bg-[rgba(4,22,36,0.52)] p-2">
                  {favoriteGroups.map((group) => (
                    <div
                      key={`favorite-settings-${group.id}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-[rgba(84,147,194,0.16)] bg-[rgba(6,28,46,0.58)] px-3 py-2"
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left text-[0.92rem] text-[var(--ode-text)]"
                        onClick={() => {
                          closeFavoriteGroupSettingsModal();
                          openFavoriteGroupRenameModal(group.id);
                        }}
                      >
                        {group.name}
                      </button>
                      <button
                        type="button"
                        className="ode-icon-btn h-9 w-9 text-[#ffb8b8]"
                        onClick={() => {
                          void deleteFavoriteGroup(group.id);
                        }}
                        aria-label={t("favorites.group_delete")}
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-end border-t border-[var(--ode-border)] px-6 py-4">
                <button className="ode-text-btn h-11 px-5" onClick={closeFavoriteGroupSettingsModal}>
                  {t("delete.modal_cancel")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {favoriteAssignModalOpen ? (
          <div
            className="ode-overlay-scrim fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target !== event.currentTarget) return;
              closeFavoriteAssignModal();
            }}
          >
            <div
              ref={favoriteAssignModalDrag.surfaceRef}
              style={favoriteAssignModalDrag.surfaceStyle}
              className="ode-modal w-full max-w-md overflow-hidden rounded-[22px] border border-[var(--ode-border-strong)]"
            >
              <div
                className="ode-modal-drag-handle flex items-center justify-between border-b border-[var(--ode-border)] px-6 py-5"
                onPointerDown={favoriteAssignModalDrag.handlePointerDown}
              >
                <h2 className="text-[1.35rem] font-semibold tracking-tight text-[var(--ode-accent)]">
                  {t("favorites.group_assign_title")}
                </h2>
                <div className="flex items-center gap-2">
                  <OdeTooltip label={t("favorites.group_assign_title")} side="bottom">
                    <button
                      type="button"
                      className="ode-icon-btn h-10 w-10"
                      onClick={() => {
                        closeFavoriteAssignModal();
                        openFavoriteGroupSettingsModal();
                      }}
                      aria-label={t("favorites.group_assign_title")}
                    >
                      <SettingsGlyphSmall />
                    </button>
                  </OdeTooltip>
                  <button type="button" className="ode-icon-btn h-10 w-10" onClick={closeFavoriteAssignModal}>
                    x
                  </button>
                </div>
              </div>
              <div className="space-y-3 px-6 py-5">
                <label
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--ode-border)] px-3 py-2 text-[0.92rem] ${
                    favoriteAssignSelectAllState === "all"
                      ? "bg-[rgba(31,129,188,0.18)] text-[var(--ode-text)]"
                      : favoriteAssignSelectAllState === "some"
                        ? "bg-[rgba(18,92,138,0.16)] text-[var(--ode-text)]"
                        : "bg-[rgba(4,22,36,0.52)] text-[var(--ode-text-dim)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={favoriteAssignSelectAllState === "all"}
                    ref={(input) => {
                      if (input) input.indeterminate = favoriteAssignSelectAllState === "some";
                    }}
                    onChange={() => {
                      const nextState = favoriteAssignSelectAllState === "all" ? "none" : "all";
                      setFavoriteAssignGroupStates(
                        Object.fromEntries(
                          favoriteGroups.map((group) => [group.id, nextState])
                        ) as Record<string, FavoriteGroupSelectionState>
                      );
                    }}
                    className="h-3.5 w-3.5 accent-[var(--ode-accent)]"
                  />
                  <span className="font-medium">{t("favorites.favorite_label")}</span>
                </label>
                <label className="block text-[0.8rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("favorites.group_select_label")}
                </label>
                <div className="max-h-56 space-y-1 overflow-auto rounded-lg border border-[var(--ode-border)] bg-[rgba(4,22,36,0.52)] p-2">
                  {favoriteGroups.map((group) => {
                    const selectionState = favoriteAssignGroupStates[group.id] ?? "none";
                    const checked = selectionState === "all";
                    const mixed = selectionState === "some";
                    return (
                      <label
                        key={`favorite-assign-group-${group.id}`}
                        className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[0.9rem] ${
                          checked
                            ? "bg-[rgba(31,129,188,0.2)] text-[var(--ode-text)]"
                            : mixed
                              ? "bg-[rgba(18,92,138,0.18)] text-[var(--ode-text)]"
                              : "text-[var(--ode-text-dim)] hover:bg-[rgba(16,78,120,0.2)] hover:text-[var(--ode-text)]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          ref={(input) => {
                            if (input) input.indeterminate = mixed;
                          }}
                          onChange={() =>
                            setFavoriteAssignGroupStates((prev) => ({
                              ...prev,
                              [group.id]: toggleFavoriteGroupSelectionState(prev[group.id] ?? "none")
                            }))
                          }
                          className="h-3.5 w-3.5 accent-[var(--ode-accent)]"
                        />
                        <span className="truncate">{group.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-[var(--ode-border)] px-6 py-4">
                <button className="ode-text-btn h-11 px-5" onClick={closeFavoriteAssignModal}>
                  {t("delete.modal_cancel")}
                </button>
                <button
                  className="ode-primary-btn h-11 px-6"
                  onClick={() => {
                    void confirmAssignFavoriteGroup();
                  }}
                >
                  {t("favorites.group_assign_btn")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <DeleteConfirmModal
          open={deleteConfirmOpen}
          language={language}
          message={deleteConfirmMessage}
          onCancel={() => resolveDeleteConfirmation(false)}
          onConfirm={() => resolveDeleteConfirmation(true)}
        />
        <ReleaseNotesModal
          open={releaseNotesOpen}
          language={language}
          isUtilityPanelWindow={isUtilityPanelWindow}
          isWindowMaximized={isWindowMaximized}
          onWindowMinimize={() => {
            void handleWindowMinimize();
          }}
          onWindowToggleMaximize={() => {
            void handleWindowToggleMaximize();
          }}
          onClose={() => {
            if (closeUtilityPanelWindowIfNeeded()) return;
            setReleaseNotesOpen(false);
          }}
        />
        <HelpModal
          open={helpOpen}
          language={language}
          isUtilityPanelWindow={isUtilityPanelWindow}
          isWindowMaximized={isWindowMaximized}
          onWindowMinimize={() => {
            void handleWindowMinimize();
          }}
          onWindowToggleMaximize={() => {
            void handleWindowToggleMaximize();
          }}
          onClose={() => {
            if (closeUtilityPanelWindowIfNeeded()) return;
            setHelpOpen(false);
          }}
        />
        <QaChecklistModal
          open={qaChecklistOpen}
          language={language}
          isUtilityPanelWindow={isUtilityPanelWindow}
          isWindowMaximized={isWindowMaximized}
          items={REGRESSION_CHECKLIST_ITEMS}
          checklistStateById={qaChecklistStateById}
          aiReportItemById={latestAiReportItemById}
          automatableItemIds={QA_AUTOMATION_ITEM_IDS}
          onSetStatus={setQaChecklistStatus}
          onSetFailureReason={setQaChecklistFailureReason}
          onAddAttachments={addQaChecklistAttachments}
          onRemoveAttachment={removeQaChecklistAttachment}
          onRunAutomation={runQaChecklistAutomation}
          aiTesterState={aiTesterState}
          onRunAiTester={() => runAiTester("manual")}
          onReset={resetQaChecklist}
          onWindowMinimize={() => {
            void handleWindowMinimize();
          }}
          onWindowToggleMaximize={() => {
            void handleWindowToggleMaximize();
          }}
          onClose={() => {
            if (closeUtilityPanelWindowIfNeeded()) return;
            setQaChecklistOpen(false);
          }}
        />
        <TaskScheduleModal
          open={scheduleModalOpen}
          language={language}
          node={scheduleModalNode}
          initialSchedule={scheduleModalNode ? parseNodeTimelineSchedule(scheduleModalNode) : null}
          onClose={closeScheduleModal}
          onSave={saveNodeSchedule}
          onClear={clearNodeSchedule}
        />
      </ModalStack>

      {assistantDeliverableProposalState ? (
        <AiWorkspaceModal
          view="deliverable-proposal"
          open
          t={t}
          proposal={assistantDeliverableProposalState.proposal}
          nodeTitle={assistantDeliverableProposalState.nodeTitle}
          onChangeProposal={(proposal) => {
            setAssistantDeliverableProposalState((current) => (current ? { ...current, proposal } : current));
          }}
          onClose={() => {
            setAssistantDeliverableProposalState(null);
          }}
          onConfirm={() => {
            void acceptAssistantDeliverableProposal();
          }}
        />
      ) : assistantIntegratedPlanProposalState ? (
        <AiWorkspaceModal
          view="integrated-plan"
          open
          t={t}
          proposal={assistantIntegratedPlanProposalState.proposal}
          nodeTitle={assistantIntegratedPlanProposalState.nodeTitle}
          onChangeProposal={(proposal) => {
            setAssistantIntegratedPlanProposalState((current) => (current ? { ...current, proposal } : current));
          }}
          onClose={() => {
            setAssistantIntegratedPlanProposalState(null);
          }}
          onConfirm={() => {
            void acceptAssistantIntegratedPlanProposal();
          }}
        />
      ) : AI_COMMAND_BAR_ENABLED ? (
        <AiWorkspaceModal
          view="assistant"
          open={commandBarOpen || documentAdvisorOpen}
          t={t}
          language={language}
          languageCodes={LANGUAGE_CODES}
          activityItems={assistantActivityItems}
          initialSurface={
            documentAdvisorOpen
              ? "organization"
              : workspaceFocusMode === "execution"
                ? "workarea"
                : "organization"
          }
          nodeContext={assistantNodeContext}
          simpleMode
          documentReview={
            documentAdvisorOpen
              ? {
                  open: documentAdvisorOpen,
                  documentName: documentAdvisorTarget?.name ?? documentAdvisorDisplayedAnalysis?.nodeName ?? null,
                  summary: documentAdvisorDisplayedAnalysis?.summary ?? null,
                  previewLines: documentAdvisorDisplayedAnalysis?.previewLines ?? [],
                  detectedDocumentLanguage:
                    documentAdvisorTreeProposal?.detectedSourceLanguage ?? documentAdvisorDisplayedAnalysis?.detectedLanguage ?? "unknown",
                  translationMode: documentAdvisorTranslationMode,
                  manualTranslationLanguage: documentAdvisorManualTranslationLanguage,
                  resolvedTranslationLanguage:
                    documentAdvisorTreeProposal?.translationTargetLanguage ?? documentAdvisorResolvedTranslationTarget,
                  translationWarningMessage: documentAdvisorReviewTranslationWarningMessage,
                  isTranslationBusy: documentAdvisorReviewTranslationBusy,
                  confidence:
                    documentAdvisorActions.find((action) => action.id === "create_tree_structure")?.confidence ?? null,
                  treeProposal: documentAdvisorTreeProposal
                    ? {
                        warningMessage: getDocumentAdvisorTreeProposalWarningMessage(documentAdvisorTreeProposal),
                        nodes: documentAdvisorTreeProposal.result.nodes,
                        valueSummary: documentAdvisorTreeProposal.result.value_summary
                      }
                    : null,
                  isBusy: documentAdvisorStatus === "analyzing" || documentAdvisorTreeProposalBusy,
                  error: documentAdvisorTreeProposalError ?? documentAdvisorError
                }
              : null
          }
          onClose={() => {
            setCommandBarOpen(false);
            setDocumentAdvisorOpen(false);
          }}
          onDocumentTranslationModeChange={setDocumentAdvisorTranslationMode}
          onDocumentManualTranslationLanguageChange={setDocumentAdvisorManualTranslationLanguage}
          onAskNode={askSelectedNodeAssistant}
          onApplyNodePlan={applyNodeAssistantPlan}
          onOpenNodeDeliverableProposal={openNodeDeliverableProposal}
          onOpenNodeIntegratedPlanProposal={openNodeIntegratedPlanProposal}
          onAnalyze={analyzeAiCommand}
          onExecute={executeAiPlan}
          onExecuteDocumentReview={async (editedNodes) => {
            await runDocumentAdvisorAction("create_tree_structure", {
              editedNodes
            });
            setDocumentAdvisorOpen(false);
            setCommandBarOpen(false);
          }}
          onClearActivity={clearAssistantActivity}
          showWindowControls={isDesktopRuntime}
          isWindowMaximized={isWindowMaximized}
          onWindowMinimize={() => {
            void handleWindowMinimize();
          }}
          onWindowToggleMaximize={() => {
            void handleWindowToggleMaximize();
          }}
        />
      ) : null}

      <NodeContextMenu
        t={t}
        contextMenu={contextMenu}
        canPasteBranch={canPasteBranch}
        projectsCount={projects.length}
        contextMenuNodeIsFile={contextMenuNodeIsFile}
        contextMenuNodeIsExecutionTask={contextMenuNodeIsExecutionTask}
        contextMenuNodeStructureLocked={
          contextMenuNode?.id === activeProjectRootId ? workspaceStructureLocked : contextMenuNodeStructureLocked
        }
        canToggleStructureLock={contextMenuCanToggleStructureLock}
        contextMenuNodeWorkareaKind={contextMenuNodeWorkareaKind}
        contextMenuNodeIsDeclaredWorkareaOwner={contextMenuNodeIsDeclaredWorkareaOwner}
        contextMenuNodeCanOpenWorkarea={contextMenuNodeCanOpenWorkarea}
        contextMenuNodeFilePath={contextMenuNodeFilePath}
        workspaceRootIdSet={workspaceRootIdSet}
        selectedNodeId={store.selectedNodeId}
        canMoveNodeIn={contextMenuCanMoveNodeIn}
        canMoveNodeOut={contextMenuCanMoveNodeOut}
        contextMenuGroupCanDelete={contextMenuGroupCanDelete}
        canDistributeToNAWorkspace={contextMenuCanDistributeToNAWorkspace}
        restrictToFavoriteGroupsOnly={selectedFavoriteGroupFilterIds.length > 0}
        onRunAction={(action) => {
          void runContextMenuAction(action);
        }}
      />

      <TextEditContextMenu
        t={t}
        menu={textEditContextMenu}
        canCopy={(textEditContextMenu?.selectionEnd ?? 0) > (textEditContextMenu?.selectionStart ?? 0)}
        canCut={(textEditContextMenu?.selectionEnd ?? 0) > (textEditContextMenu?.selectionStart ?? 0)}
        onClose={closeTextEditContextMenu}
        onUseSuggestion={runTextEditMenuSuggestion}
        onCut={() => {
          void runTextEditMenuCut();
        }}
        onCopy={() => {
          void runTextEditMenuCopy();
        }}
        onPaste={() => {
          void runTextEditMenuPaste();
        }}
        onSelectAll={runTextEditMenuSelectAll}
      />

      <TopBar
        t={t}
        workspaceMode={workspaceMode}
        documentationModeActive={documentationModeActive}
        workspaceSettingsOpen={workspaceSettingsOpen}
        isDesktopRuntime={isDesktopRuntime}
        isWindowMaximized={isWindowMaximized}
        hasBlockingOverlayOpen={hasBlockingOverlayOpenWithMove || assistantOverlayOpen}
        onBrandClick={
          AI_COMMAND_BAR_ENABLED
            ? () => {
                if (hasBlockingOverlayOpenWithMove || assistantOverlayOpen) return;
                setCommandBarOpen(true);
              }
            : undefined
        }
        onWindowDragStart={(event) => {
          void handleDesktopWindowHeaderDragStart(event);
        }}
        onDocumentationTabClick={() => {
          enterDocumentationMode();
        }}
        onDesktopTabClick={() => {
          exitDocumentationMode();
          setWorkspaceMode("grid");
          if (documentationModeActive || desktopViewMode === "procedure") {
            setDesktopViewMode(desktopBrowseViewModeRef.current === "procedure" ? "grid" : desktopBrowseViewModeRef.current);
          }
          if (workspaceFocusMode === "execution") {
            void openNodeInWorkarea(resolvePreferredWorkareaTargetNodeId());
            return;
          }
          setSelectionSurface("grid");
          setKeyboardSurface("grid");
        }}
        onTimelineTabClick={() => {
          exitDocumentationMode();
          if (workspaceFocusMode === "data") {
            setActiveNodeStateFilters(createAllNodeStateFilters());
          }
          setWorkspaceMode("timeline");
          setDesktopViewMode("grid");
          setSelectionSurface("timeline");
          setKeyboardSurface("timeline");
        }}
        onWorkspaceSettingsClick={() =>
          setWorkspaceSettingsOpen((prev) => {
            const nextState = buildWorkspaceSettingsToggleState(prev);
            setWorkspaceCreateInlineOpen(nextState.workspaceCreateInlineOpen);
            if (nextState.workspaceNameInput !== null) {
              setWorkspaceNameInput(nextState.workspaceNameInput);
            }
            return nextState.workspaceSettingsOpen;
          })
        }
        onWindowMinimize={() => {
          void handleWindowMinimize();
        }}
        onWindowToggleMaximize={() => {
          void handleWindowToggleMaximize();
        }}
        onWindowClose={() => {
          void handleWindowClose();
        }}
      />

      <div className="relative min-h-0 flex-1 lg:flex">
        {workspaceMode === "grid" ? (
          <DesktopView>
            <SidebarPanel
              t={t}
              language={language}
              workspaceFocusMode={workspaceFocusMode}
              isLargeLayout={isLargeLayout}
              isSidebarCollapsed={isSidebarCollapsed}
              sidebarWidth={sidebarWidth}
              sidebarCollapsedWidth={SIDEBAR_COLLAPSED_WIDTH}
              searchInputRef={searchInputRef}
              searchQuery={store.searchQuery}
              searchDropdownOpen={searchDropdownOpen}
              searchResults={desktopSidebarSearchResults}
              searchActiveIndex={searchActiveIndex}
              displayedTreeRows={displayedTreeRows}
              selectedNodeId={store.selectedNodeId}
              selectedNodeIds={selectedNodeIds}
              cutPendingNodeIds={cutPendingNodeIds}
              draggingNodeId={draggingNodeId}
              dropIndicator={dropIndicator}
              scopedRootDropTargetId={desktopScopedRootDropTargetId}
              activeProjectRootId={activeProjectRootId}
              editingNodeId={editingNodeId}
              editingSurface={editingSurface}
              editingValue={editingValue}
              inlineEditInputRef={inlineEditInputRef}
              expandedIds={expandedIds}
              folderNodeStateById={folderNodeStateById}
              executionOwnerNodeIds={executionOwnerNodeIds}
              scopedNumbering={scopedNumbering}
              hideTreeNumbering={documentationModeActive}
              editActionInFlightRef={editActionInFlightRef}
              isNodeProvisionalInlineCreate={(nodeId) =>
                provisionalInlineCreateByNodeIdRef.current.has(nodeId)
              }
              workspaceManageCard={desktopWorkareaOwnerCard}
              favoriteGroups={favoriteGroups}
              activeFavoriteGroupId={activeFavoriteGroupId}
              selectedFavoriteGroupIds={selectedFavoriteGroupFilterIds}
              favoriteTreeFilterEnabled={favoriteGroupTreeFilterEnabled}
              nodeTooltipsEnabled={nodeTooltipsEnabled}
              canQuickEditNodeDescription={Boolean(tooltipQuickEditTargetNode)}
              quickEditNodeDescriptionTargetLabel={tooltipQuickEditTargetNode?.name ?? null}
              canExpandAllTreeNodes={canExpandAllTreeNodes}
              canCollapseAllTreeNodes={canCollapseAllTreeNodes}
              showEmptyState={showWorkspaceEmptyState}
              onSelectFavoriteGroup={(groupId, options) => {
                void handleFavoriteGroupClick(groupId, undefined, options);
              }}
              onEditFavoriteGroup={openFavoriteGroupRenameModal}
              onOpenFavoriteGroupAssign={() => {
                if (!store.selectedNodeId && selectedNodeIds.size === 0) return;
                openFavoriteAssignModal();
              }}
              onAssignNodesToFavoriteGroup={(groupId, sourceNodeId) => {
                void handleFavoriteGroupClick(groupId, sourceNodeId);
              }}
              onToggleFavoriteTreeFilter={() => {
                setActiveFavoriteGroupId(FAVORITE_ALL_GROUP_ID);
                setSelectedFavoriteGroupIds([]);
                setFavoriteGroupTreeFilterEnabled(false);
              }}
              onCreateFavoriteGroup={createFavoriteGroup}
              onDeleteFavoriteGroup={(groupId) => {
                void deleteFavoriteGroup(groupId);
              }}
              onToggleNodeTooltips={() => {
                setNodeTooltipsEnabled((current) => !current);
              }}
              onQuickEditNodeDescription={openQuickEditNodeDescription}
              onExpandAllTreeNodes={expandAllTreeNodes}
              onCollapseAllTreeNodes={collapseAllTreeNodes}
              onSetIsSidebarCollapsed={setIsSidebarCollapsed}
              onExpandSidebarForSearch={expandSidebarForSearch}
              onExpandSidebarPanel={expandSidebarPanel}
              onSearchDropdownOpenChange={setSearchDropdownOpen}
              onSearchActiveIndexChange={setSearchActiveIndex}
              onSelectFromSearch={(id) => {
                void selectFromSearch(id);
              }}
              onRunSearch={() => {
                void store.runSearch();
              }}
              onSearchQueryChange={store.setSearchQuery}
              onActivateTreeSurface={() => {
                setSelectionSurface("tree");
                setKeyboardSurface("tree");
              }}
              onOpenSurfaceContextMenu={(event) =>
                openSurfaceContextMenu(event, "tree", {
                  workareaMode: workspaceFocusMode === "execution",
                  workareaOwnerNodeId: desktopWorkareaOwnerNodeId
                })
              }
              onHasExternalFileDrag={hasExternalFileDrag}
              onResolveActiveDragSourceId={resolveActiveDragSourceId}
              onResolveExternalDropPaths={resolveExternalDropPaths}
              onSetDropIndicator={setDropIndicator}
              onClearDraggingState={clearDraggingState}
              onImportExternalFilesToNode={(paths, parentId, surface) => {
                void importExternalFilesToNode(paths, parentId, surface);
              }}
              onApplyDropMove={(sourceId, targetId, position, surface) => {
                void applyDropMove(sourceId, targetId, position, surface);
              }}
              onCloseContextMenu={closeContextMenu}
              onApplyTreeSelection={applyTreeSelection}
              onBrowseTreeNode={(nodeId) => {
                if (documentationModeActive) {
                  setSelectionSurface("tree");
                  setKeyboardSurface("procedure");
                  return;
                }
                void browseTreeNodeInGrid(nodeId);
              }}
              onOpenNodeContextMenu={(event, nodeId, surface) =>
                openNodeContextMenu(event, nodeId, surface, {
                  workareaMode: workspaceFocusMode === "execution",
                  workareaOwnerNodeId: desktopWorkareaOwnerNodeId
                })
              }
              onBeginNodeDrag={(event, nodeId, surface) => beginNodeDrag(event, nodeId, surface)}
              onDetectDropPosition={detectDropPosition}
              onToggleExpand={toggleExpand}
              onBeginInlineEdit={beginInlineEdit}
              onSetEditingValue={setEditingValue}
              onOpenInlineEditContextMenu={(event) => {
                void openTextEditContextMenu(event, "tree");
              }}
              onCommitInlineEdit={async () => {
                await commitInlineEdit();
              }}
              onCancelInlineEdit={cancelInlineEdit}
              onDeleteNode={deleteNode}
              onRefreshTreeAndKeepContext={(focusId, ensureExpandedParentIds) =>
                refreshTreeAndKeepContext(focusId ?? undefined, ensureExpandedParentIds)
              }
              onSetPrimarySelection={setPrimarySelection}
              onCreateParentNode={createParentNode}
              onCreateSiblingNode={createSiblingNode}
              onCreateChildNode={createChildNode}
              onCreateFirstNode={async () => {
                await handleCreateFirstNodeRequest("tree");
              }}
              onOpenNodeTab={async (nodeId) => {
                if (documentationModeActive) {
                  setPrimarySelection(nodeId, "tree");
                  setSelectionSurface("tree");
                  setKeyboardSurface("procedure");
                  setProcedureFieldEditorTargetNodeId(nodeId);
                  return;
                }
                if (workspaceFocusMode === "execution") {
                  await openNodeInWorkarea(nodeId);
                  return;
                }
                await openNodeInDesktopTab(nodeId);
              }}
              onReviewFile={setMindMapReviewNodeId}
            />

            {!isSidebarCollapsed ? (
              <OdeTooltip label={t("splitter.title")} side="bottom">
                <div
                  className={`ode-splitter hidden lg:block ${isResizingSidebar ? "ode-splitter-active" : ""}`}
                  onPointerDown={startSidebarResize}
                  onDoubleClick={() => setSidebarWidth(clampSidebarWidth(SIDEBAR_DEFAULT_WIDTH))}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowLeft") {
                      event.preventDefault();
                      nudgeSidebarWidth(event.ctrlKey ? -36 : -14);
                      return;
                    }
                    if (event.key === "ArrowRight") {
                      event.preventDefault();
                      nudgeSidebarWidth(event.ctrlKey ? 36 : 14);
                      return;
                    }
                    if (event.key === "Home") {
                      event.preventDefault();
                      setSidebarWidth(SIDEBAR_MIN_WIDTH);
                      return;
                    }
                    if (event.key === "End") {
                      event.preventDefault();
                      setSidebarWidth(clampSidebarWidth(window.innerWidth - MAIN_MIN_WIDTH));
                      return;
                    }
                    if (event.key === "Enter") {
                      event.preventDefault();
                      setSidebarWidth(clampSidebarWidth(SIDEBAR_DEFAULT_WIDTH));
                    }
                  }}
                  role="separator"
                  tabIndex={0}
                  aria-label={t("splitter.aria")}
                  aria-orientation="vertical"
                  aria-valuemin={SIDEBAR_MIN_WIDTH}
                  aria-valuenow={Math.round(sidebarWidth)}
                  aria-valuemax={Math.max(SIDEBAR_MIN_WIDTH, window.innerWidth - MAIN_MIN_WIDTH)}
                />
              </OdeTooltip>
            ) : null}
          </DesktopView>
        ) : null}

        <main className="ode-pane relative flex min-h-0 flex-col overflow-hidden lg:min-w-0 lg:flex-1">
          {workspaceMode === "grid" ? (
            <MainPaneHeader
              t={t}
              breadcrumbNodes={breadcrumbNodes}
              workspaceMode={workspaceMode}
              desktopViewMode={desktopViewMode}
              workspaceFocusMode={workspaceFocusMode}
              documentationModeActive={documentationModeActive}
              workspaceStructureLocked={workspaceStructureLocked}
              uploadInputRef={uploadInputRef}
              onUploadInputChange={onUploadInputChange}
              onTriggerDesktopUpload={() => {
                void triggerDesktopUpload();
              }}
              onSelectBreadcrumbNode={(nodeId) => {
                void (async () => {
                  clearActiveDesktopNodeTab();
                  if (workspaceFocusMode === "execution") {
                    await openNodeInWorkarea(nodeId);
                    return;
                  }
                  if (desktopViewMode === "mindmap") {
                    activateDesktopGridBrowseSurface();
                  }
                  await store.navigateTo(nodeId);
                  if (documentationModeActive) {
                    setPrimarySelection(nodeId, "tree");
                    setSelectionSurface("tree");
                    setKeyboardSurface("procedure");
                    return;
                  }
                  setPrimarySelection(nodeId, "grid");
                  setSelectionSurface("grid");
                  setKeyboardSurface("grid");
                })();
              }}
              onSetDesktopViewMode={(mode) => {
                exitDocumentationMode();
                setDesktopViewMode(mode);
                if (mode === "mindmap") {
                  setMindMapContentMode("node_tree");
                  setMindMapOrientation("horizontal");
                }
                setSelectionSurface(mode === "procedure" ? "tree" : "grid");
                setKeyboardSurface(mode === "procedure" ? "procedure" : "grid");
              }}
            />
          ) : null}

          {workspaceMode === "grid" ? (
            documentationModeActive ? (
              <ProcedureBuilderPanel
                workspaceName={activeProject?.name ?? null}
                rootNode={procedureRootNode}
                selectedNode={procedureSelectedNode}
                byParent={byParent}
                scopedNumbering={scopedNumbering}
                allNodes={store.allNodes}
                projects={projects}
                activeProjectRootId={activeProjectRootId}
                onSelectNode={(nodeId) => {
                  setPrimarySelection(nodeId, "tree");
                  setSelectionSurface("tree");
                  setKeyboardSurface("procedure");
                }}
                onOpenLinkedNode={async (nodeId) => {
                  await openNodeInDesktopTab(nodeId, {
                    selectedNodeId: nodeId
                  });
                }}
                onOpenLinkedFile={async (nodeId) => {
                  await openFileNode(nodeId);
                }}
                onOpenWebsiteLink={async (href) => {
                  await openExternalUrl(href);
                }}
                onLaunchLinkedApp={async (item) => {
                  await launchQuickApp(item);
                }}
                onCreateProcedureItem={createProcedureDocumentItem}
                onAttachImagesToNode={attachImagesToProcedureNode}
                onAttachFilesToNode={attachFilesToProcedureNode}
                onDeleteProcedureNode={deleteProcedureDocumentNode}
                onRenameNodeTitle={renameProcedureNodeTitle}
                onReviewNodeFile={(nodeId) => {
                  setMindMapReviewNodeId(nodeId);
                }}
                onSaveNodeContent={saveProcedureNodeContent}
                onSaveNodeDescription={saveProcedureNodeDescription}
                onSaveNodeProperties={saveProcedureNodeProperties}
                onActivateProcedureSurface={() => {
                  setSelectionSurface("tree");
                  setKeyboardSurface("procedure");
                }}
                onOpenSurfaceContextMenu={(event) =>
                  openSurfaceContextMenu(event, "tree", {
                    workareaMode: workspaceFocusMode === "execution",
                    workareaOwnerNodeId: resolveWorkareaOwnerNodeId(
                      procedureSelectedNode?.id ?? procedureRootNode?.id ?? null
                    )
                  })
                }
                requestedFieldEditorNodeId={procedureFieldEditorTargetNodeId}
                onFieldEditorRequestHandled={() => setProcedureFieldEditorTargetNodeId(null)}
              />
            ) : (
              <DesktopContentPanel
                t={t}
                language={language}
                showChantierInsights={false}
                desktopViewMode={desktopViewMode}
                mindMapOrientation={mindMapOrientation}
                mindMapContentMode={mindMapContentMode}
                quickAccessMindMapRootLabel={quickAccessMindMapRootLabel}
                quickAccessMindMapRootNode={quickAccessMindMapRootNode}
                quickAccessMindMapRootLevel={quickAccessMindMapRootLevel}
                nodeTreeMindMapRootLabel={nodeTreeMindMapRootLabel}
                nodeTreeMindMapRootNode={nodeTreeMindMapRootNode}
                nodeTreeMindMapRootLevel={nodeTreeMindMapRootLevel}
                quickAccessMindMapGroups={quickAccessMindMapGroups}
                quickAccessMindMapDirectFavorites={quickAccessMindMapDirectFavorites}
                activeFavoriteGroupId={activeFavoriteGroupId}
                gridNodes={desktopGridNodes}
                chantierStatusCounts={desktopChantierPortfolioCounts}
                chantierNodeCount={desktopChantierNodes.length}
                workspaceChantierStatusCounts={
                  workspaceFocusMode === "execution" ? emptyChantierStatusCounts : workspaceChantierStatusCounts
                }
                workspaceChantierNodeCount={workspaceFocusMode === "execution" ? 0 : workspaceChantierNodes.length}
                workspaceChantierNodes={workspaceFocusMode === "execution" ? [] : workspaceChantierNodes}
                workspaceActiveChantierNodes={workspaceFocusMode === "execution" ? [] : workspaceActiveChantierNodes}
                workspaceAttentionChantierNodes={workspaceFocusMode === "execution" ? [] : workspaceAttentionChantierNodes}
                activeChantierStatusFilter={activeChantierStatusFilter}
                onSetActiveChantierStatusFilter={setActiveChantierStatusFilter}
                selectedNodeId={store.selectedNodeId}
                selectedNodeIds={selectedNodeIds}
                cutPendingNodeIds={cutPendingNodeIds}
                draggingNodeId={draggingNodeId}
                editingNodeId={editingNodeId}
                editingSurface={editingSurface}
                editingValue={editingValue}
                inlineEditInputRef={inlineEditInputRef}
                dropIndicator={dropIndicator}
                scopedRootDropTargetId={desktopScopedRootDropTargetId}
                currentFolderDropTargetId={desktopCurrentFolderDropTargetId}
                folderNodeStateById={folderNodeStateById}
                executionOwnerNodeIds={executionOwnerNodeIds}
                nodeLevelById={nodeLevelById}
                scopedNumbering={scopedNumbering}
                isNodeProvisionalInlineCreate={(nodeId) =>
                  provisionalInlineCreateByNodeIdRef.current.has(nodeId)
                }
                showEmptyState={showWorkspaceEmptyState}
                emptyStateMessage={desktopGridEmptyStateMessage}
                showCreateFirstNodeAction={desktopGridShowCreateFirstNodeAction}
                showUploadEmptyStateAction={desktopGridShowUploadEmptyStateAction}
                onActivateGridSurface={() => {
                  setSelectionSurface("grid");
                  setKeyboardSurface("grid");
                }}
                onOpenSurfaceContextMenu={(event) => {
                  const targetEl = event.target as HTMLElement;
                  if (
                    targetEl.closest(
                      ".ode-grid-card, .ode-details-row, .ode-quick-mind-favorite"
                    )
                  ) {
                    return;
                  }
                  openSurfaceContextMenu(event, "grid", {
                    workareaMode: workspaceFocusMode === "execution",
                    workareaOwnerNodeId: desktopWorkareaOwnerNodeId
                  });
                }}
                onHasExternalFileDrag={hasExternalFileDrag}
                onResolveActiveDragSourceId={resolveActiveDragSourceId}
                onResolveExternalDropPaths={resolveExternalDropPaths}
                onSetDropIndicator={setDropIndicator}
                onClearDraggingState={clearDraggingState}
                onImportExternalFilesToNode={(paths, parentNodeId, surface) => {
                  void importExternalFilesToNode(paths, parentNodeId, surface);
                }}
                onApplyDropIntoCurrentGridFolder={(sourceId) => {
                  void applyDropIntoCurrentGridFolder(sourceId);
                }}
                onCloseContextMenu={closeContextMenu}
                onApplyGridSelection={applyGridSelection}
                onOpenNodeContextMenu={(event, nodeId) =>
                  openNodeContextMenu(event, nodeId, "grid", {
                    workareaMode: workspaceFocusMode === "execution",
                    workareaOwnerNodeId: desktopWorkareaOwnerNodeId
                  })
                }
                onOpenQuickAccessNodeContextMenu={(event, nodeId) => {
                  openQuickAccessNodeContextMenu(event, nodeId);
                }}
                onOpenQuickAccessGroupContextMenu={(event, groupId) => {
                  openQuickAccessGroupContextMenu(event, groupId);
                }}
                onOpenQuickAccessSurfaceContextMenu={(event) => {
                  openQuickAccessSurfaceContextMenu(event);
                }}
                onBeginNodeDrag={(event, nodeId) => beginNodeDrag(event, nodeId, "grid")}
                onDetectGridDropPosition={detectGridDropPosition}
                onApplyGridDropMove={(sourceId, targetId, position) => {
                  void applyGridDropMove(sourceId, targetId, position);
                }}
                onOpenFolder={(nodeId) => {
                  if (workspaceFocusMode === "execution") {
                    void openNodeInWorkarea(nodeId);
                    return;
                  }
                  void openNodeInDesktopTab(nodeId);
                }}
                onJumpToWorkspaceChantier={(nodeId) => {
                  void jumpToWorkspaceChantierNode(nodeId);
                }}
                onReviewMindMapFile={setMindMapReviewNodeId}
                onSelectQuickAccessGroup={(groupId) => {
                  void handleFavoriteGroupClick(groupId);
                }}
                onOpenQuickAccessNode={(nodeId) => {
                  void openQuickAccessNode(nodeId);
                }}
                onMoveNodeToQuickAccessGroup={(nodeId, groupId) => {
                  void moveNodeToFavoriteGroup(nodeId, groupId);
                }}
                onDetectDetailsDropPosition={detectDetailsDropPosition}
                onGetNodeTypeDisplayLabel={getNodeTypeDisplayLabel}
                onFormatBytes={formatBytes}
                onGetNodeSizeBytes={getNodeSizeBytes}
                onFormatNodeModified={formatNodeModified}
                onSetEditingValue={setEditingValue}
                onOpenInlineEditContextMenu={(event) => {
                  void openTextEditContextMenu(event, "grid");
                }}
                onCommitInlineEdit={async () => {
                  await commitInlineEdit();
                }}
                onCancelInlineEdit={cancelInlineEdit}
                onCreateFirstNode={() => {
                  void createSurfaceDefaultTopic("grid");
                }}
                onTriggerUpload={() => {
                  void triggerDesktopUpload();
                }}
              />
            )
          ) : documentationModeActive ? (
            <ProcedureBuilderPanel
              workspaceName={activeProject?.name ?? null}
              rootNode={procedureRootNode}
              selectedNode={procedureSelectedNode}
              byParent={byParent}
              scopedNumbering={scopedNumbering}
              allNodes={store.allNodes}
              projects={projects}
              activeProjectRootId={activeProjectRootId}
              onSelectNode={(nodeId) => {
                setPrimarySelection(nodeId, "tree");
                setSelectionSurface("tree");
                setKeyboardSurface("procedure");
              }}
              onOpenLinkedNode={async (nodeId) => {
                await openNodeInDesktopTab(nodeId, {
                  selectedNodeId: nodeId
                });
              }}
              onOpenLinkedFile={async (nodeId) => {
                await openFileNode(nodeId);
              }}
              onOpenWebsiteLink={async (href) => {
                await openExternalUrl(href);
              }}
              onLaunchLinkedApp={async (item) => {
                await launchQuickApp(item);
              }}
              onCreateProcedureItem={createProcedureDocumentItem}
              onAttachImagesToNode={attachImagesToProcedureNode}
              onAttachFilesToNode={attachFilesToProcedureNode}
              onDeleteProcedureNode={deleteProcedureDocumentNode}
              onRenameNodeTitle={renameProcedureNodeTitle}
              onReviewNodeFile={(nodeId) => {
                setMindMapReviewNodeId(nodeId);
              }}
              onSaveNodeContent={saveProcedureNodeContent}
              onSaveNodeDescription={saveProcedureNodeDescription}
              onSaveNodeProperties={saveProcedureNodeProperties}
              onActivateProcedureSurface={() => {
                setSelectionSurface("tree");
                setKeyboardSurface("procedure");
              }}
              onOpenSurfaceContextMenu={(event) =>
                openSurfaceContextMenu(event, "tree", {
                  workareaMode: workspaceFocusMode === "execution",
                  workareaOwnerNodeId: resolveWorkareaOwnerNodeId(
                    procedureSelectedNode?.id ?? procedureRootNode?.id ?? null
                  )
                })
              }
              requestedFieldEditorNodeId={procedureFieldEditorTargetNodeId}
              onFieldEditorRequestHandled={() => setProcedureFieldEditorTargetNodeId(null)}
            />
          ) : (
            <TimelineView>
              <TimelineHeaderBar
                t={t}
                timelineYear={timelineYear}
                searchInputRef={searchInputRef}
                searchQuery={store.searchQuery}
                searchDropdownOpen={searchDropdownOpen}
                searchResults={timelineSearchResults}
                searchActiveIndex={searchActiveIndex}
                statusOrder={TIMELINE_STATUS_ORDER}
                activeStatusFilters={activeTimelineStatusFilters}
                onSearchDropdownOpenChange={setSearchDropdownOpen}
                onSearchActiveIndexChange={setSearchActiveIndex}
                onSelectFromSearch={(id) => {
                  void selectFromSearch(id);
                }}
                onRunSearch={() => {
                  if (workspaceMode !== "timeline") {
                    void store.runSearch();
                  }
                }}
                onSearchQueryChange={store.setSearchQuery}
                onPreviousYear={() => setTimelineYear((year) => year - 1)}
                onNextYear={() => setTimelineYear((year) => year + 1)}
                onToggleStatusFilter={toggleTimelineStatusFilter}
                getTimelineStatusClass={getTimelineStatusClass}
              />

              <TimelineContentPanel
                t={t}
                language={language}
                timelineRows={displayedTimelineRows}
                timelineDayRanges={timelineDayRanges}
                currentTimelineWeekKey={currentTimelineWeekKey}
                timelineNodePanelWidth={timelineNodePanelWidth}
                isResizingTimelinePanel={isResizingTimelinePanel}
                timelineHeaderHeight={TIMELINE_HEADER_HEIGHT}
                timelineRowHeight={TIMELINE_ROW_HEIGHT}
                timelineDayColumnWidth={TIMELINE_DAY_COLUMN_WIDTH}
                timelineNodePanelMinWidth={TIMELINE_NODE_PANEL_MIN_WIDTH}
                timelineGridMinWidth={TIMELINE_GRID_MIN_WIDTH}
                timelineNodePanelDefaultWidth={TIMELINE_NODE_PANEL_DEFAULT_WIDTH}
                scopedRootDropTargetId={scopedRootDropTargetId}
                selectedNodeId={store.selectedNodeId}
                selectedNodeIds={selectedNodeIds}
                expandedIds={expandedIds}
                cutPendingNodeIds={cutPendingNodeIds}
                draggingNodeId={draggingNodeId}
                editingNodeId={editingNodeId}
                editingSurface={editingSurface}
                editingValue={editingValue}
                inlineEditInputRef={inlineEditInputRef}
                dropIndicator={dropIndicator}
                isNodeProvisionalInlineCreate={(nodeId) =>
                  provisionalInlineCreateByNodeIdRef.current.has(nodeId)
                }
                folderNodeStateById={folderNodeStateById}
                executionOwnerNodeIds={executionOwnerNodeIds}
                timelineScheduleByNodeId={timelineScheduleByNodeId}
                timelineLeftScrollRef={timelineLeftScrollRef}
                timelineRightScrollRef={timelineRightScrollRef}
                onSyncTimelineVerticalScroll={syncTimelineVerticalScroll}
                onActivateTimelineSurface={() => {
                  setSelectionSurface("timeline");
                  setKeyboardSurface("timeline");
                }}
                onOpenSurfaceContextMenu={(event) =>
                  openSurfaceContextMenu(event, "timeline", {
                    workareaMode: timelineMode === "tasks"
                  })
                }
                onResolveActiveDragSourceId={resolveActiveDragSourceId}
                onSetDropIndicator={setDropIndicator}
                onClearDraggingState={clearDraggingState}
                onApplyDropMove={(sourceId, targetId, position) => {
                  void applyDropMove(sourceId, targetId, position, "timeline");
                }}
                onCloseContextMenu={closeContextMenu}
                onSetPrimarySelection={(nodeId) => setPrimarySelection(nodeId, "timeline")}
                onApplyTimelineSelection={applyTimelineSelection}
                onOpenNodeContextMenu={(event, nodeId) =>
                  openNodeContextMenu(event, nodeId, "timeline", {
                    workareaMode: timelineMode === "tasks"
                  })
                }
                onOpenDeliverableGroupContextMenu={openTimelineDeliverableGroupContextMenu}
                onBeginNodeDrag={(event, nodeId) => beginNodeDrag(event, nodeId, "timeline")}
                onDetectDropPosition={detectDropPosition}
                onToggleExpand={toggleExpand}
                canExpandAllTimelineNodes={canExpandAllTimelineNodes}
                canCollapseAllTimelineNodes={canCollapseAllTimelineNodes}
                onExpandAllTimelineNodes={expandAllTreeNodes}
                onCollapseAllTimelineNodes={collapseAllTreeNodes}
                onOpenScheduleModal={openScheduleModal}
                onSaveTimelineScheduleDirect={saveNodeScheduleForNodeId}
                onStartTimelinePanelResize={startTimelinePanelResize}
                onSetTimelineNodePanelWidth={setTimelineNodePanelWidth}
                onClampTimelineNodePanelWidth={clampTimelineNodePanelWidth}
                onNudgeTimelineNodePanelWidth={nudgeTimelineNodePanelWidth}
                onGetTimelineStatusClass={getTimelineStatusClass}
                onSetEditingValue={setEditingValue}
                onOpenInlineEditContextMenu={(event) => {
                  void openTextEditContextMenu(event, "timeline");
                }}
                onCommitInlineEdit={async () => {
                  await commitInlineEdit();
                }}
                onCancelInlineEdit={cancelInlineEdit}
                emptyStateMessage={timelineEmptyStateMessage}
                showCreateFirstNodeAction={timelineShowCreateFirstNodeAction}
                onCreateFirstNode={() => {
                  void handleCreateFirstNodeRequest("timeline");
                }}
                onReviewFile={setMindMapReviewNodeId}
                prioritizeFlaggedTimelineTasks={prioritizeFlaggedTimelineTasks}
                isTimelineNodeFlagged={isTimelineNodeFlagged}
                onTogglePrioritizeFlaggedTimelineTasks={() => {
                  setPrioritizeFlaggedTimelineTasks((prev) => !prev);
                }}
              />
            </TimelineView>
          )}
          {workspaceMode === "grid" && workspaceFocusMode !== "execution" ? (
            <DesktopNodeTabBar
              t={t}
              tabs={desktopOpenNodeTabs}
              activeTabId={activeWorkspaceNodeTabSession.activeTabId}
              isSidebarCollapsed={isSidebarCollapsed}
              onActivateTab={(nodeId) => {
                const tabEntry =
                  activeWorkspaceNodeTabSession.openTabs.find((entry) => entry.nodeId === nodeId) ?? null;
                void openNodeInDesktopTab(nodeId, {
                  selectedNodeId: tabEntry?.lastSelectedNodeId ?? null
                });
              }}
              onCloseTab={(nodeId) => {
                void closeDesktopNodeTab(nodeId);
              }}
            />
          ) : null}
        </main>

      </div>
      <StatusBar
        version="v1.043"
        t={t}
        branchClipboard={branchClipboard}
        mirrorStatus={mirrorStatus}
        workspaceMode={workspaceMode}
        desktopViewMode={desktopViewMode}
        workspaceFocusMode={workspaceFocusMode}
        documentationModeActive={documentationModeActive}
        showExecutionMode={false}
        workareaAvailable={workareaAvailable}
        workspaceEmptyOnly={workspaceEmptyOnly}
        quickAppNodeLabel={footerQuickAppTargetNode?.name ?? null}
        quickApps={footerQuickApps}
        onLaunchQuickApp={(item) => {
          void launchQuickApp(item);
        }}
        onReorderQuickApps={(quickApps) => {
          void reorderFooterQuickApps(quickApps);
        }}
        onManageQuickApps={() => {
          if (!footerQuickAppTargetNode) return;
          openNodeQuickAppsModal(footerQuickAppTargetNode.id);
        }}
        onSelectWorkspaceFocusMode={workspaceMode === "timeline" ? selectTimelineWorkspaceFocusMode : selectWorkspaceFocusMode}
        onToggleWorkspaceEmptyOnly={toggleWorkspaceEmptyOnly}
        qaChecklistSummary={qaChecklistSummary}
        qaChecklistHealth={qaChecklistHealth}
        onOpenReleaseNotes={() => {
          void openUtilityPanel("release");
        }}
        onOpenHelp={() => {
          void openUtilityPanel("help");
        }}
        onOpenQaChecklist={() => {
          void openUtilityPanel("qa");
        }}
      />
    </div>
  );
}










