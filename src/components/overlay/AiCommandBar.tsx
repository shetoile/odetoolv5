import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent
} from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AI_SPEECH_LOCALES } from "@/ai/planning/outputLanguage";
import { DatabaseRootGlyph, FolderGlyph, SettingsGlyphSmall } from "@/components/Icons";
import { WindowControls } from "@/components/layout/WindowControls";
import { OdeAiMark } from "@/components/OdeAiMark";
import { DocumentTreeProposalEditor } from "@/components/overlay/DocumentTreeProposalEditor";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import { AI_KEYS_STORAGE_KEY, buildAppStorageKey } from "@/lib/appIdentity";
import {
  clearApprovedDocumentTreeMemories,
  readApprovedDocumentTreeMemories,
  removeApprovedDocumentTreeMemory,
  updateApprovedDocumentTreeMemory,
  type ApprovedDocumentTreeMemoryEntry
} from "@/lib/aiTreeMemory";
import type { WBSNode } from "@/lib/aiService";
import type { LanguageCode, TranslationParams } from "@/lib/i18n";
import type { DocumentLanguageCode } from "@/lib/documentLanguage";
import {
  exportTreeStructureExcel,
  pickWindowsTreeSpreadsheetFile,
  readTreeStructureExcel
} from "@/lib/nodeService";
import {
  buildDocumentTreeMemoryEntryFromSpreadsheetPayload,
  buildTreeSpreadsheetPayloadFromDocumentTreeMemory,
  buildTreeSpreadsheetPayloadFromWbsNodes,
  normalizeTreeSpreadsheetPayload,
  parseSpreadsheetPayloadToWbsNodes
} from "@/lib/treeSpreadsheet";

export type AiCommandPlan = {
  intent: string;
  actionId: string | null;
  args?: Record<string, unknown>;
  reason: string;
  steps: string[];
  confidence: number;
  previewChanges: string[];
  plannerSource: "heuristic" | "llm" | "llm+heuristic";
  requiresConfirmation: boolean;
};

export type AiActivityItem = {
  id: string;
  timestamp: string;
  flow: string;
  source: string;
  actionId: string | null;
  success: boolean;
  latencyMs: number;
  workspace: string;
  error?: string;
  details?: string[];
};

export type AiNodeContext = {
  title: string;
  pathLabel: string | null;
  objective: string | null;
  scheduleStatus: string | null;
  documentCount: number;
  sourceLabels: string[];
  documents: AiNodeDocument[];
};

export type AiNodeResponse = {
  title: string | null;
  answer: string;
  sourceLabels: string[];
};

export type AiNodeDocument = {
  id: string;
  name: string;
  pathLabel: string | null;
  type: string;
};

export type AiCommandRequestOptions = {
  selectedDocumentIds?: string[];
  actionHint?: string | null;
};

type TranslateFn = (key: string, params?: TranslationParams) => string;
type CommandBarTab = "command" | "memory" | "activity" | "settings";
type AssistantMode = "ask" | "command";
type ProposalKind = "deliverables" | "integrated";
export type AssistantSurface = "organization" | "workarea";
type QuickActionItem = {
  id: string;
  label: string;
  value: string;
  surface: AssistantSurface;
  mode: AssistantMode;
  actionHint?: string | null;
  proposalKind?: ProposalKind | null;
  helpDetailKey: string;
};

interface AiCommandBarProps {
  open: boolean;
  simpleMode?: boolean;
  initialSurface?: AssistantSurface;
  t: TranslateFn;
  language: LanguageCode;
  languageCodes: LanguageCode[];
  activityItems: AiActivityItem[];
  nodeContext?: AiNodeContext | null;
  documentReview?: {
    open: boolean;
    documentName: string | null;
    summary: string | null;
    previewLines: string[];
    detectedDocumentLanguage: DocumentLanguageCode;
    translationMode: "source" | "auto" | "manual";
    manualTranslationLanguage: LanguageCode;
    resolvedTranslationLanguage: LanguageCode | null;
    translationWarningMessage?: string | null;
    isTranslationBusy?: boolean;
    confidence: number | null;
    treeProposal: {
      warningMessage: string | null;
      nodes: WBSNode[];
      valueSummary: string;
    } | null;
    isBusy: boolean;
    error: string | null;
  } | null;
  onClose: () => void;
  onDocumentTranslationModeChange: (mode: "source" | "auto" | "manual") => void;
  onDocumentManualTranslationLanguageChange: (language: LanguageCode) => void;
  onAskNode?: (requestText: string, options?: AiCommandRequestOptions) => Promise<AiNodeResponse>;
  onApplyNodePlan?: (
    requestText: string,
    answerText: string,
    options?: AiCommandRequestOptions
  ) => Promise<void>;
  onOpenNodeDeliverableProposal?: (requestText: string, options?: AiCommandRequestOptions) => Promise<void>;
  onOpenNodeIntegratedPlanProposal?: (requestText: string, options?: AiCommandRequestOptions) => Promise<void>;
  onAnalyze: (commandText: string, options?: AiCommandRequestOptions) => Promise<AiCommandPlan>;
  onExecute: (plan: AiCommandPlan) => Promise<void>;
  onExecuteDocumentReview?: (editedNodes: WBSNode[]) => Promise<void>;
  onClearActivity: () => void;
  showWindowControls?: boolean;
  isWindowMaximized?: boolean;
  onWindowMinimize?: () => void;
  onWindowToggleMaximize?: () => void;
}

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: new () => {
    lang: string;
    interimResults: boolean;
    maxAlternatives: number;
    onresult: ((event: any) => void) | null;
    onerror: ((event: any) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
  };
  webkitSpeechRecognition?: new () => {
    lang: string;
    interimResults: boolean;
    maxAlternatives: number;
    onresult: ((event: any) => void) | null;
    onerror: ((event: any) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
  };
};

const AI_COMMAND_HISTORY_STORAGE_KEY = buildAppStorageKey("ai.commandHistory.v1");
const MAX_RECENT_COMMANDS = 10;

function readStoredMistralKeys(): string[] {
  if (typeof window === "undefined") return [""];
  try {
    const raw = localStorage.getItem(AI_KEYS_STORAGE_KEY);
    if (!raw) return [""];
    const parsed = JSON.parse(raw) as {
      mistralKeys?: string[];
      groqKeys?: string[];
      perplexityKeys?: string[];
    };
    if (Array.isArray(parsed.mistralKeys) && parsed.mistralKeys.length > 0) {
      return parsed.mistralKeys;
    }
    const legacy = [...(parsed.groqKeys ?? []), ...(parsed.perplexityKeys ?? [])].filter(
      (key) => key.trim().length > 0
    );
    return legacy.length > 0 ? [legacy[0]] : [""];
  } catch {
    return [""];
  }
}

function readRecentCommands(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(AI_COMMAND_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const next: string[] = [];
    for (const item of parsed) {
      if (typeof item !== "string") continue;
      const trimmed = item.trim();
      if (!trimmed) continue;
      const dedupeKey = trimmed.toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      next.push(trimmed);
      if (next.length >= MAX_RECENT_COMMANDS) break;
    }
    return next;
  } catch {
    return [];
  }
}

export function AiCommandBar({
  open,
  simpleMode = false,
  initialSurface = "organization",
  t,
  language,
  languageCodes,
  activityItems,
  nodeContext = null,
  documentReview = null,
  onClose,
  onDocumentTranslationModeChange,
  onDocumentManualTranslationLanguageChange,
  onAskNode,
  onApplyNodePlan,
  onOpenNodeDeliverableProposal,
  onOpenNodeIntegratedPlanProposal,
  onAnalyze,
  onExecute,
  onExecuteDocumentReview,
  onClearActivity,
  showWindowControls = false,
  isWindowMaximized = false,
  onWindowMinimize,
  onWindowToggleMaximize
}: AiCommandBarProps) {
  const [activeTab, setActiveTab] = useState<CommandBarTab>("command");
  const [assistantMode, setAssistantMode] = useState<AssistantMode>("command");
  const [activeSurface, setActiveSurface] = useState<AssistantSurface>(initialSurface);
  const [commandText, setCommandText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<AiCommandPlan | null>(null);
  const [progressLines, setProgressLines] = useState<string[]>([]);
  const [nodeResponse, setNodeResponse] = useState<AiNodeResponse | null>(null);
  const [nodeResponseDraft, setNodeResponseDraft] = useState("");
  const [documentReviewDraftNodes, setDocumentReviewDraftNodes] = useState<WBSNode[] | null>(null);
  const [treeMemoryEntries, setTreeMemoryEntries] = useState<ApprovedDocumentTreeMemoryEntry[]>(() =>
    readApprovedDocumentTreeMemories()
  );
  const [selectedTreeMemoryEntryId, setSelectedTreeMemoryEntryId] = useState<string | null>(null);
  const [draftTreeMemoryEntry, setDraftTreeMemoryEntry] = useState<ApprovedDocumentTreeMemoryEntry | null>(null);
  const [treeMemoryActionMessage, setTreeMemoryActionMessage] = useState<string | null>(null);
  const [treeMemoryActionError, setTreeMemoryActionError] = useState<string | null>(null);
  const [treeTemplateStatus, setTreeTemplateStatus] = useState<string | null>(null);
  const [treeTemplateError, setTreeTemplateError] = useState<string | null>(null);
  const [recentCommands, setRecentCommands] = useState<string[]>(() => readRecentCommands());
  const [mistralKeys, setMistralKeys] = useState<string[]>(() => readStoredMistralKeys());
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [isTestingKeys, setIsTestingKeys] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [highlightedHistoryIndex, setHighlightedHistoryIndex] = useState(-1);
  const [isDocumentPickerOpen, setIsDocumentPickerOpen] = useState(false);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [activeQuickActionId, setActiveQuickActionId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const blurTimerRef = useRef<number | null>(null);
  const recognitionRef = useRef<{
    stop: () => void;
  } | null>(null);
  const filteredRecentCommands = useMemo(() => {
    const query = commandText.trim().toLowerCase();
    if (query.length === 0) return recentCommands;
    const exact = recentCommands.find((item) => item.toLowerCase() === query);
    const startsWithMatches = recentCommands.filter(
      (item) => item.toLowerCase() !== query && item.toLowerCase().startsWith(query)
    );
    const containsMatches = recentCommands.filter((item) => {
      const lower = item.toLowerCase();
      return lower !== query && !lower.startsWith(query) && lower.includes(query);
    });
    return exact ? [exact, ...startsWithMatches, ...containsMatches] : [...startsWithMatches, ...containsMatches];
  }, [recentCommands, commandText]);

  const shouldIgnoreWindowDragTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest(
        "button, input, textarea, select, a, [role='button'], [data-ode-window-drag-ignore='true']"
      )
    );
  };
  const handleWindowHeaderMouseDown = (event: ReactMouseEvent<HTMLElement>) => {
    if (!showWindowControls) return;
    if (event.button !== 0) return;
    if (event.detail > 1) return;
    if (shouldIgnoreWindowDragTarget(event.target)) return;
    event.preventDefault();
    void getCurrentWindow().startDragging().catch(() => {
      // Fall back to passive drag-region handling when native dragging is unavailable.
    });
  };
  const handleWindowHeaderDoubleClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (!showWindowControls) return;
    if (shouldIgnoreWindowDragTarget(event.target)) return;
    onWindowToggleMaximize?.();
  };

  useEffect(() => {
    if (!open) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setIsDocumentPickerOpen(false);
      setActiveQuickActionId(null);
      setHistoryOpen(false);
      setHighlightedHistoryIndex(-1);
      setSelectedTreeMemoryEntryId(null);
      setDraftTreeMemoryEntry(null);
      setTreeMemoryActionMessage(null);
      setTreeMemoryActionError(null);
      setNodeResponse(null);
      return;
    }
    setActiveTab("command");
    setAssistantMode(nodeContext ? "ask" : "command");
    setActiveSurface(initialSurface);
    setIsDocumentPickerOpen(false);
    setActiveQuickActionId(null);
    setSelectedDocumentIds([]);
    setMistralKeys(readStoredMistralKeys());
    setSettingsMessage(null);
  }, [open, nodeContext, initialSurface]);

  useEffect(() => {
    if (!documentReview?.treeProposal?.nodes) {
      setDocumentReviewDraftNodes(null);
      setTreeTemplateStatus(null);
      setTreeTemplateError(null);
      return;
    }
    setDocumentReviewDraftNodes(documentReview.treeProposal.nodes);
    setTreeTemplateStatus(null);
    setTreeTemplateError(null);
  }, [documentReview?.treeProposal?.nodes]);

  useEffect(() => {
    if (!open) return;
    setTreeMemoryEntries(readApprovedDocumentTreeMemories());
  }, [open]);

  useEffect(() => {
    setNodeResponseDraft(nodeResponse?.answer ?? "");
  }, [nodeResponse]);

  useEffect(() => {
    if (!simpleMode) return;
    const canKeepMemoryTab = Boolean(documentReview?.open);
    const canKeepSettingsTab = activeTab === "settings";
    if (activeTab !== "command" && !canKeepSettingsTab && !(canKeepMemoryTab && activeTab === "memory")) {
      setActiveTab("command");
    }
  }, [simpleMode, activeTab, documentReview?.open]);

  useEffect(() => {
    if (!open) return;
    setSelectedTreeMemoryEntryId((current) =>
      current && treeMemoryEntries.some((entry) => entry.id === current) ? current : (treeMemoryEntries[0]?.id ?? null)
    );
  }, [open, treeMemoryEntries]);

  useEffect(() => {
    if (!open || !selectedTreeMemoryEntryId) {
      setDraftTreeMemoryEntry(null);
      return;
    }
    const selectedEntry = treeMemoryEntries.find((entry) => entry.id === selectedTreeMemoryEntryId) ?? null;
    setDraftTreeMemoryEntry(
      selectedEntry ? (JSON.parse(JSON.stringify(selectedEntry)) as ApprovedDocumentTreeMemoryEntry) : null
    );
  }, [open, selectedTreeMemoryEntryId, treeMemoryEntries]);

  useEffect(() => {
    if (!open || activeTab !== "command") return;
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }, [open, activeTab]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current !== null) {
        window.clearTimeout(blurTimerRef.current);
        blurTimerRef.current = null;
      }
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (recentCommands.length === 0) {
        localStorage.removeItem(AI_COMMAND_HISTORY_STORAGE_KEY);
        return;
      }
      localStorage.setItem(AI_COMMAND_HISTORY_STORAGE_KEY, JSON.stringify(recentCommands));
    } catch {
      // Command history is best-effort only.
    }
  }, [recentCommands]);

  useEffect(() => {
    if (!historyOpen || filteredRecentCommands.length === 0) {
      setHighlightedHistoryIndex(-1);
      return;
    }
    setHighlightedHistoryIndex((current) =>
      current >= 0 && current < filteredRecentCommands.length ? current : -1
    );
  }, [historyOpen, filteredRecentCommands]);

  if (!open) return null;

  const rememberCommand = (command: string) => {
    const trimmed = command.trim();
    if (!trimmed) return;
    setRecentCommands((current) => {
      const normalized = trimmed.toLowerCase();
      const next = [trimmed, ...current.filter((item) => item.toLowerCase() !== normalized)];
      return next.slice(0, MAX_RECENT_COMMANDS);
    });
  };

  const refreshTreeMemoryEntries = () => {
    setTreeMemoryEntries(readApprovedDocumentTreeMemories());
  };

  const activeDocumentReviewNodes = documentReviewDraftNodes ?? documentReview?.treeProposal?.nodes ?? [];
  const selectedTreeMemoryEntry = treeMemoryEntries.find((entry) => entry.id === selectedTreeMemoryEntryId) ?? null;
  const hasTreeMemoryUnsavedChanges =
    draftTreeMemoryEntry && selectedTreeMemoryEntry
      ? JSON.stringify(draftTreeMemoryEntry) !== JSON.stringify(selectedTreeMemoryEntry)
      : false;

  const importTreeTemplateWorkbook = async () => {
    try {
      const filePath = await pickWindowsTreeSpreadsheetFile();
      if (!filePath) return;
      const payload = normalizeTreeSpreadsheetPayload(await readTreeStructureExcel(filePath));
      const nodes = parseSpreadsheetPayloadToWbsNodes(payload);
      if (nodes.length === 0) {
        throw new Error(t("tree_excel.template_empty"));
      }
      setDocumentReviewDraftNodes(nodes);
      setTreeTemplateError(null);
      setTreeTemplateStatus(t("tree_excel.template_import_done"));
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      setTreeTemplateStatus(null);
      setTreeTemplateError(reason);
    }
  };

  const exportTreeTemplateWorkbook = async () => {
    try {
      const nodes = documentReviewDraftNodes ?? documentReview?.treeProposal?.nodes ?? [];
      if (nodes.length === 0) {
        throw new Error(t("tree_excel.template_empty"));
      }
      const savedPath = await exportTreeStructureExcel(
        t("tree_excel.template_export_dialog_title"),
        `${documentReview?.documentName ?? "ai-tree-template"}.xlsx`,
        buildTreeSpreadsheetPayloadFromWbsNodes(nodes, {
          title: documentReview?.documentName ?? "AI Tree Template",
          goal: documentReview?.documentName ?? "AI Tree Template",
          outputLanguage: language
        })
      );
      if (!savedPath) return;
      setTreeTemplateError(null);
      setTreeTemplateStatus(t("tree_excel.template_export_done"));
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      setTreeTemplateStatus(null);
      setTreeTemplateError(reason);
    }
  };

  const importTreeMemoryWorkbook = async () => {
    try {
      const filePath = await pickWindowsTreeSpreadsheetFile();
      if (!filePath) return;
      const payload = normalizeTreeSpreadsheetPayload(await readTreeStructureExcel(filePath));
      const importedEntry = buildDocumentTreeMemoryEntryFromSpreadsheetPayload(payload, {
        id: `tree-memory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        approvedAt: new Date().toISOString(),
        targetNodeId: selectedTreeMemoryEntry?.targetNodeId ?? "__ROOT__",
        documentName: selectedTreeMemoryEntry?.documentName ?? payload.meta?.documentName?.trim() ?? "Imported template",
        goal:
          selectedTreeMemoryEntry?.goal ??
          payload.meta?.goal?.trim() ??
          payload.meta?.title?.trim() ??
          "Imported tree template",
        outputLanguage: selectedTreeMemoryEntry?.outputLanguage ?? payload.meta?.outputLanguage ?? "EN",
        sourceLabels: selectedTreeMemoryEntry?.sourceLabels ?? [],
        notes: selectedTreeMemoryEntry?.notes ?? ""
      });
      updateApprovedDocumentTreeMemory(importedEntry);
      refreshTreeMemoryEntries();
      setSelectedTreeMemoryEntryId(importedEntry.id);
      setTreeMemoryActionError(null);
      setTreeMemoryActionMessage(t("tree_excel.memory_import_done"));
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      setTreeMemoryActionMessage(null);
      setTreeMemoryActionError(reason);
    }
  };

  const exportTreeMemoryWorkbook = async () => {
    try {
      if (!draftTreeMemoryEntry) {
        throw new Error(t("tree_excel.memory_select_first"));
      }
      const savedPath = await exportTreeStructureExcel(
        t("tree_excel.memory_export_dialog_title"),
        `${draftTreeMemoryEntry.goal || draftTreeMemoryEntry.documentName || "ai-tree-memory"}.xlsx`,
        buildTreeSpreadsheetPayloadFromDocumentTreeMemory(draftTreeMemoryEntry)
      );
      if (!savedPath) return;
      setTreeMemoryActionError(null);
      setTreeMemoryActionMessage(t("tree_excel.memory_export_done"));
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      setTreeMemoryActionMessage(null);
      setTreeMemoryActionError(reason);
    }
  };

  const saveTreeMemoryDraft = () => {
    if (!draftTreeMemoryEntry) return;
    updateApprovedDocumentTreeMemory(draftTreeMemoryEntry);
    refreshTreeMemoryEntries();
    setTreeMemoryActionError(null);
    setTreeMemoryActionMessage(t("settings.msg_saved_local"));
  };

  const clearPlanPreview = () => {
    setPlan(null);
    setNodeResponse(null);
    setNodeResponseDraft("");
    setError(null);
    setProgressLines([]);
  };

  const quickActionItems: QuickActionItem[] = [
    {
      id: "organization_review",
      surface: "organization",
      label: t("command.ai_quick_review"),
      value: t("command.ai_prompt_review_selected_files"),
      mode: "ask",
      helpDetailKey: "command.ai_guide_help_hint"
    },
    {
      id: "organization_build",
      surface: "organization",
      label: t("command.ai_quick_tree"),
      value: t("command.ai_prompt_tree_from_selected_files"),
      mode: "command",
      actionHint: nodeContext?.documents.length ? "wbs_from_document" : "wbs_generate",
      helpDetailKey: "command.ai_guide_tree_hint"
    },
    {
      id: "organization_update",
      surface: "organization",
      label: t("command.ai_action_update_structure"),
      value: t("command.ai_prompt_update_structure_selected_files"),
      mode: "command",
      actionHint: nodeContext?.documents.length ? "wbs_from_document" : "wbs_generate",
      helpDetailKey: "command.ai_guide_structure_update_hint"
    },
    {
      id: "workarea_review",
      surface: "workarea",
      label: t("command.ai_review"),
      value: t("command.ai_prompt_workarea_review_selected_files"),
      mode: "ask",
      helpDetailKey: "command.ai_guide_workarea_review_hint"
    },
    {
      id: "workarea_deliverables",
      surface: "workarea",
      label: t("procedure.node_deliverables"),
      value: t("command.ai_prompt_deliverables_selected_files"),
      mode: "ask",
      proposalKind: "deliverables",
      helpDetailKey: "command.ai_guide_deliverables_hint"
    },
    {
      id: "workarea_tasks",
      surface: "workarea",
      label: t("procedure.node_tasks"),
      value: t("command.ai_prompt_plan_selected_files"),
      mode: "ask",
      proposalKind: "integrated",
      helpDetailKey: "command.ai_guide_workarea_tasks_hint"
    }
  ];

  const activeQuickAction = quickActionItems.find((item) => item.id === activeQuickActionId) ?? null;
  const activeSurfaceActionItems = quickActionItems.filter((item) => item.surface === activeSurface);
  const surfaceTabs: Array<{ id: AssistantSurface; label: string; detail: string }> = [
    {
      id: "organization",
      label: t("desktop.mindmap_node_tree"),
      detail: t("command.ai_surface_hint_organization")
    },
    {
      id: "workarea",
      label: t("desktop.view_procedure"),
      detail: t("command.ai_surface_hint_workarea")
    }
  ];
  const availableDocuments = nodeContext?.documents ?? [];
  const availableDocumentIdSet = new Set(availableDocuments.map((document) => document.id));
  const normalizedSelectedDocumentIds = selectedDocumentIds.filter((documentId) => availableDocumentIdSet.has(documentId));
  const selectedDocumentIdSet = new Set(normalizedSelectedDocumentIds);
  const hasSelectableDocuments = availableDocuments.length > 0;

  const applySuggestedPrompt = (item: QuickActionItem) => {
    setActiveSurface(item.surface);
    setAssistantMode(item.mode);
    setCommandText(item.value);
    setActiveQuickActionId(item.id);
    clearPlanPreview();
    closeHistoryPicker();
    setHistoryOpen(false);
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(item.value.length, item.value.length);
    }, 0);
  };

  const activeSurfaceMeta = surfaceTabs.find((surface) => surface.id === activeSurface) ?? surfaceTabs[0];
  const commandInputPlaceholder =
    activeQuickAction?.proposalKind === "deliverables"
      ? t("command.ai_placeholder_deliverables")
      : activeQuickAction?.proposalKind === "integrated"
        ? t("command.ai_placeholder_plan")
        : activeSurface === "organization"
          ? t("command.ai_placeholder_organization")
          : activeSurface === "workarea"
            ? t("command.ai_placeholder_workarea")
            : nodeContext
              ? t("command.ai_placeholder_simple_context")
              : t("command.ai_placeholder");
  const proposalActionOpen =
    activeQuickAction?.proposalKind === "deliverables" ||
    activeQuickAction?.proposalKind === "integrated" ||
    activeQuickAction?.actionHint === "wbs_from_document" ||
    activeQuickAction?.actionHint === "wbs_generate";
  const primaryActionLabel = proposalActionOpen ? t("command.ai_open_proposal") : t("command.ai_run");
  const primaryBusyLabel = proposalActionOpen ? t("command.ai_drafting_proposal") : t("command.ai_running");
  const activeQuickActionValue = activeQuickAction?.value ?? null;
  const selectedDocumentSummaryLabel = hasSelectableDocuments
    ? t("command.ai_files_selected_count", {
        selected: normalizedSelectedDocumentIds.length,
        total: availableDocuments.length
      })
    : t("command.ai_files_none");

  const setSurfaceSelection = (surface: AssistantSurface) => {
    setActiveSurface(surface);
    if (activeQuickAction?.surface !== surface) {
      setActiveQuickActionId(null);
    }
  };

  const resolveAssistantMode = (value: string): AssistantMode => {
    const clean = value.trim();
    if (!clean) {
      return activeQuickAction?.mode ?? assistantMode;
    }
    if (activeQuickAction && clean === activeQuickAction.value) {
      return activeQuickAction.mode;
    }
    if (!nodeContext || !onAskNode) {
      return "command";
    }
    const normalized = clean.toLowerCase();
    const looksLikeCommand =
      /^(build|create|open|set|clear|move|rename|import|export|sync)\b/.test(normalized) ||
      /\b(timeline|schedule|tree structure|work breakdown|wbs)\b/.test(normalized);
    return looksLikeCommand ? "command" : "ask";
  };

  const updateKeyList = (next: string[]) => {
    setMistralKeys(next.length > 0 ? next : [""]);
  };

  const saveMistralKeys = () => {
    try {
      const trimmed = mistralKeys.map((key) => key.trim()).filter((key) => key.length > 0);
      localStorage.setItem(
        AI_KEYS_STORAGE_KEY,
        JSON.stringify({
          mistralKeys: trimmed
        })
      );
      setMistralKeys(trimmed.length > 0 ? trimmed : [""]);
      setSettingsMessage(t("settings.msg_saved_local"));
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      setSettingsMessage(reason);
    }
  };

  const runKeyCheck = async () => {
    setSettingsMessage(null);
    setIsTestingKeys(true);
    await new Promise((resolve) => window.setTimeout(resolve, 550));
    const hasKey = mistralKeys.some((key) => key.trim().length > 0);
    setSettingsMessage(hasKey ? t("settings.msg_key_check_complete") : t("settings.msg_no_keys"));
    setIsTestingKeys(false);
  };

  const closeHistoryPicker = () => {
    setHistoryOpen(false);
    setHighlightedHistoryIndex(-1);
  };

  const scheduleHistoryClose = () => {
    if (blurTimerRef.current !== null) {
      window.clearTimeout(blurTimerRef.current);
    }
    blurTimerRef.current = window.setTimeout(() => {
      closeHistoryPicker();
      blurTimerRef.current = null;
    }, 120);
  };

  const cancelHistoryClose = () => {
    if (blurTimerRef.current !== null) {
      window.clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
  };

  const selectRecentCommand = (value: string) => {
    setCommandText(value);
    setActiveQuickActionId(null);
    clearPlanPreview();
    closeHistoryPicker();
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(value.length, value.length);
    }, 0);
  };

  const runAnalyze = async () => {
    const clean = commandText.trim();
    if (!clean || isAnalyzing || isExecuting) return;
    const resolvedAssistantMode = resolveAssistantMode(clean);
    const requestOptions: AiCommandRequestOptions = {
      selectedDocumentIds: normalizedSelectedDocumentIds,
      actionHint: activeQuickAction?.actionHint ?? null
    };
    setAssistantMode(resolvedAssistantMode);
    rememberCommand(clean);
    setError(null);
    setPlan(null);
    setNodeResponse(null);
    if (activeQuickAction?.proposalKind === "deliverables" && onOpenNodeDeliverableProposal) {
      setProgressLines([
        t("command.ai_progress_understand"),
        t("command.ai_progress_scan"),
        t("command.ai_progress_plan")
      ]);
      setIsAnalyzing(true);
      try {
        await onOpenNodeDeliverableProposal(clean, requestOptions);
        setProgressLines((prev) => [...prev, t("command.ai_progress_ready")]);
      } catch (err) {
        const reason = (err instanceof Error ? err.message : String(err)).trim() || "Unknown error";
        setError(t("command.action_failed").replace("{reason}", reason));
        setProgressLines([]);
      } finally {
        setIsAnalyzing(false);
      }
      return;
    }
    if (activeQuickAction?.proposalKind === "integrated" && onOpenNodeIntegratedPlanProposal) {
      setProgressLines([
        t("command.ai_progress_understand"),
        t("command.ai_progress_scan"),
        t("command.ai_progress_plan")
      ]);
      setIsAnalyzing(true);
      try {
        await onOpenNodeIntegratedPlanProposal(clean, requestOptions);
        setProgressLines((prev) => [...prev, t("command.ai_progress_ready")]);
      } catch (err) {
        const reason = (err instanceof Error ? err.message : String(err)).trim() || "Unknown error";
        setError(t("command.action_failed").replace("{reason}", reason));
        setProgressLines([]);
      } finally {
        setIsAnalyzing(false);
      }
      return;
    }
    if (resolvedAssistantMode === "ask" && onAskNode) {
      setProgressLines([
        "Understanding request",
        "Reading node context",
        "Preparing answer"
      ]);
      setIsAnalyzing(true);
      try {
        const response = await onAskNode(clean, requestOptions);
        setNodeResponse(response);
        setProgressLines((prev) => [...prev, "Answer ready"]);
      } catch (err) {
        const reason = (err instanceof Error ? err.message : String(err)).trim() || "Unknown error";
        setError(t("command.action_failed").replace("{reason}", reason));
        setProgressLines([]);
      } finally {
        setIsAnalyzing(false);
      }
      return;
    }
    setProgressLines([
      t("command.ai_progress_understand"),
      t("command.ai_progress_scan"),
      documentReview?.open ? t("command.ai_progress_review_plan") : t("command.ai_progress_plan")
    ]);
    setIsAnalyzing(true);
    try {
      const analyzedPlan = await onAnalyze(clean, requestOptions);
      const nextPlan =
        normalizedSelectedDocumentIds.length > 0
          ? {
              ...analyzedPlan,
              args: {
                ...(analyzedPlan.args ?? {}),
                selected_document_ids: normalizedSelectedDocumentIds
              }
            }
          : analyzedPlan;
      setPlan(nextPlan);
      if (simpleMode && nextPlan.actionId) {
        setError(null);
        setIsExecuting(true);
        setProgressLines((prev) => [
          ...prev,
          nextPlan.actionId === "wbs_from_document" ? t("command.ai_progress_review") : t("command.ai_progress_execute")
        ]);
        try {
          await onExecute(nextPlan);
          setProgressLines((prev) => [
            ...prev,
            nextPlan.actionId === "wbs_from_document" ? t("command.ai_progress_review_ready") : t("command.ai_progress_done")
          ]);
        } catch (err) {
          const reason = (err instanceof Error ? err.message : String(err)).trim() || "Unknown error";
          setError(t("command.action_failed").replace("{reason}", reason));
        } finally {
          setIsExecuting(false);
        }
      } else if (simpleMode && !nextPlan.actionId) {
        setError(nextPlan.reason || t("command.ai_no_confirm"));
      } else {
        setProgressLines((prev) => [...prev, t("command.ai_progress_ready")]);
      }
    } catch (err) {
      const reason = (err instanceof Error ? err.message : String(err)).trim() || "Unknown error";
      setError(t("command.action_failed").replace("{reason}", reason));
      setProgressLines([]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reviewFirstMode = simpleMode && plan?.actionId === "wbs_from_document";
  const reviewConfidencePercent =
    documentReview?.confidence !== null && Number.isFinite(documentReview?.confidence)
      ? Math.round((documentReview?.confidence ?? 0) * 100)
      : null;

  const runExecute = async () => {
    if (!plan || !plan.actionId || isExecuting || isAnalyzing) return;
    setError(null);
    setIsExecuting(true);
    setProgressLines((prev) => [...prev, t("command.ai_progress_execute")]);
    try {
      await onExecute(plan);
      setProgressLines((prev) => [...prev, t("command.ai_progress_done")]);
    } catch (err) {
      const reason = (err instanceof Error ? err.message : String(err)).trim() || "Unknown error";
      setError(t("command.action_failed").replace("{reason}", reason));
    } finally {
      setIsExecuting(false);
    }
  };

  const runExecuteDocumentReview = async () => {
    if (!documentReview?.treeProposal || documentReview.isBusy || isExecuting || isAnalyzing) return;
    if (!onExecuteDocumentReview) return;
    setError(null);
    setIsExecuting(true);
    try {
      await onExecuteDocumentReview(documentReviewDraftNodes ?? documentReview.treeProposal.nodes ?? []);
      refreshTreeMemoryEntries();
    } catch (err) {
      const reason = (err instanceof Error ? err.message : String(err)).trim() || "Unknown error";
      setError(t("command.action_failed").replace("{reason}", reason));
    } finally {
      setIsExecuting(false);
    }
  };

  const runImplementNodeResponse = async () => {
    const clean = commandText.trim();
    if (!clean || !nodeResponse || isExecuting || isAnalyzing) return;
    const answerText = nodeResponseDraft.trim().length > 0 ? nodeResponseDraft : nodeResponse.answer;
    if (!answerText.trim()) return;
    setError(null);
    setIsExecuting(true);
    setProgressLines((prev) => [...prev, t("command.ai_progress_plan")]);
    try {
      if (activeSurface === "workarea" && onApplyNodePlan) {
        await onApplyNodePlan(clean, answerText, {
          selectedDocumentIds: normalizedSelectedDocumentIds,
          actionHint: activeQuickAction?.actionHint ?? null
        });
        setProgressLines((prev) => [...prev, t("command.ai_progress_ready")]);
        return;
      }

      const implementationPrompt = [
        clean,
        "",
        "Implement the approved answer for the current node.",
        "Approved answer:",
        answerText
      ].join("\n");
      const nextPlan = await onAnalyze(implementationPrompt, {
        selectedDocumentIds: normalizedSelectedDocumentIds,
        actionHint: activeQuickAction?.actionHint ?? null
      });
      setPlan(nextPlan);
      if (simpleMode && nextPlan.actionId) {
        setProgressLines((prev) => [...prev, t("command.ai_progress_execute")]);
        await onExecute(nextPlan);
        setProgressLines((prev) => [...prev, t("command.ai_progress_done")]);
      } else if (simpleMode && !nextPlan.actionId) {
        setError(nextPlan.reason || t("command.ai_no_confirm"));
      } else {
        setProgressLines((prev) => [...prev, t("command.ai_progress_ready")]);
      }
    } catch (err) {
      const reason = (err instanceof Error ? err.message : String(err)).trim() || "Unknown error";
      setError(t("command.action_failed").replace("{reason}", reason));
    } finally {
      setIsExecuting(false);
    }
  };

  const handleNodeResponseKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void runImplementNodeResponse();
    }
  };

  const toggleVoice = () => {
    if (isAnalyzing || isExecuting) return;
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const speechWindow = window as SpeechRecognitionWindow;
    const RecognitionCtor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!RecognitionCtor) {
      setError(t("command.ai_voice_unavailable"));
      return;
    }

    setError(null);
    const recognition = new RecognitionCtor();
    recognition.lang = AI_SPEECH_LOCALES[language];
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      const transcript = event?.results?.[0]?.[0]?.transcript;
      if (typeof transcript === "string" && transcript.trim().length > 0) {
        setCommandText((prev) => `${prev} ${transcript}`.trim());
      }
    };
    recognition.onerror = () => {
      setError(t("command.ai_voice_unavailable"));
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (!simpleMode && event.key === "ArrowDown" && filteredRecentCommands.length > 0) {
      event.preventDefault();
      setHistoryOpen(true);
      setHighlightedHistoryIndex((current) =>
        current < 0 ? 0 : (current + 1) % filteredRecentCommands.length
      );
      return;
    }
    if (!simpleMode && event.key === "ArrowUp" && filteredRecentCommands.length > 0) {
      event.preventDefault();
      setHistoryOpen(true);
      setHighlightedHistoryIndex((current) =>
        current < 0 ? filteredRecentCommands.length - 1 : (current - 1 + filteredRecentCommands.length) % filteredRecentCommands.length
      );
      return;
    }
    if (event.key === "Enter") {
      if (event.shiftKey) {
        return;
      }
      event.preventDefault();
      if (!simpleMode && historyOpen && highlightedHistoryIndex >= 0 && filteredRecentCommands[highlightedHistoryIndex]) {
        selectRecentCommand(filteredRecentCommands[highlightedHistoryIndex]);
        return;
      }
      void runAnalyze();
      return;
    }
    if (!simpleMode && event.key === "Escape" && historyOpen) {
      event.preventDefault();
      event.stopPropagation();
      closeHistoryPicker();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[175] flex items-start justify-center overflow-y-auto bg-[rgba(2,13,25,0.75)] px-3 py-3 backdrop-blur-sm sm:px-5 sm:py-5"
    >
      <section className="ode-modal my-auto flex h-[min(54rem,calc(100vh-1.5rem))] w-full max-w-[min(88rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[28px] border border-[var(--ode-border-strong)]">
        <header
          className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--ode-border)] px-6 py-5"
          onMouseDown={handleWindowHeaderMouseDown}
          onDoubleClick={handleWindowHeaderDoubleClick}
        >
          <div className="flex min-w-0 flex-1 items-start gap-5">
            <div className="shrink-0">
              <OdeAiMark />
              <p className="text-[0.78rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">{t("command.shortcut")}</p>
            </div>
            {nodeContext && !documentReview?.open ? (
              <div className="min-w-0 flex-1 pt-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[1rem] font-medium text-[var(--ode-text)]">{nodeContext.title}</div>
                    {nodeContext.pathLabel && nodeContext.pathLabel !== nodeContext.title ? (
                      <div className="mt-1 truncate text-[0.82rem] text-[var(--ode-text-dim)]">{nodeContext.pathLabel}</div>
                    ) : null}
                  </div>
                  {hasSelectableDocuments ? (
                    <button
                      type="button"
                      data-ode-window-drag-ignore="true"
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-[0.76rem] transition ${
                        isDocumentPickerOpen
                          ? "border-[var(--ode-border-strong)] bg-[rgba(12,77,117,0.28)] text-[var(--ode-accent)]"
                          : "border-[var(--ode-border)] bg-[rgba(7,36,57,0.32)] text-[var(--ode-text-muted)]"
                      }`}
                      onClick={() => setIsDocumentPickerOpen((current) => !current)}
                    >
                      {selectedDocumentSummaryLabel}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-3" data-ode-window-drag-ignore="true">
            <OdeTooltip label={t("settings.ai_title")} side="bottom">
              <button
                type="button"
                className={`ode-utility-window-btn ode-ai-command-settings-btn ${
                  activeTab === "settings" ? "ode-ai-command-settings-btn-active" : ""
                }`}
                onClick={() => setActiveTab((current) => (current === "settings" ? "command" : "settings"))}
                aria-label={t("settings.ai_title")}
                data-ode-window-drag-ignore="true"
                data-tauri-drag-region="false"
              >
                <span className="ode-window-icon-shell ode-ai-command-settings-icon-shell" aria-hidden="true">
                  <SettingsGlyphSmall />
                </span>
              </button>
            </OdeTooltip>
            {showWindowControls ? (
              <WindowControls
                t={t}
                variant="utility"
                isWindowMaximized={isWindowMaximized}
                onWindowMinimize={onWindowMinimize}
                onWindowToggleMaximize={onWindowToggleMaximize}
                onWindowClose={onClose}
              />
            ) : (
              <button type="button" className="ode-icon-btn h-9 w-9" onClick={onClose} aria-label={t("settings.cancel")}>
                x
              </button>
            )}
          </div>
        </header>

        {simpleMode && !documentReview?.open ? null : (
          <div className="flex shrink-0 items-center gap-2 border-b border-[var(--ode-border)] px-6 py-4">
            <button
              type="button"
              className={`rounded-full border px-4 py-2 text-[0.78rem] uppercase tracking-[0.12em] transition ${
                activeTab === "command"
                  ? "border-[var(--ode-border-strong)] bg-[rgba(12,77,117,0.34)] text-[var(--ode-accent)]"
                  : "border-[var(--ode-border)] bg-[rgba(7,36,57,0.4)] text-[var(--ode-text-dim)]"
              }`}
              onClick={() => setActiveTab("command")}
            >
              {simpleMode ? t("command.ai_review") : t("command.title")}
            </button>
            {documentReview?.open ? (
              <button
                type="button"
                className={`rounded-full border px-4 py-2 text-[0.78rem] uppercase tracking-[0.12em] transition ${
                  activeTab === "memory"
                    ? "border-[var(--ode-border-strong)] bg-[rgba(12,77,117,0.34)] text-[var(--ode-accent)]"
                    : "border-[var(--ode-border)] bg-[rgba(7,36,57,0.4)] text-[var(--ode-text-dim)]"
                }`}
                onClick={() => {
                  refreshTreeMemoryEntries();
                  setActiveTab("memory");
                }}
              >
                {t("document_ai.tree_memory_title")}
              </button>
            ) : null}
            {!simpleMode ? (
              <>
                <button
                  type="button"
                  className={`rounded-full border px-4 py-2 text-[0.78rem] uppercase tracking-[0.12em] transition ${
                    activeTab === "activity"
                      ? "border-[var(--ode-border-strong)] bg-[rgba(12,77,117,0.34)] text-[var(--ode-accent)]"
                      : "border-[var(--ode-border)] bg-[rgba(7,36,57,0.4)] text-[var(--ode-text-dim)]"
                  }`}
                  onClick={() => setActiveTab("activity")}
                >
                  {t("assistant.activity_title")}
                </button>
              </>
            ) : null}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {activeTab === "command" ? (
            <div className="space-y-4">
              {nodeContext && !documentReview?.open ? (
                <>
                  {hasSelectableDocuments && isDocumentPickerOpen ? (
                    <div className="rounded-xl border border-[var(--ode-border)] bg-[rgba(5,28,46,0.52)] px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                          {t("command.ai_files_title")}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="ode-mini-btn h-8 rounded-lg border border-[var(--ode-border)] px-3 text-[0.76rem]"
                            onClick={() => {
                              setSelectedDocumentIds(availableDocuments.map((document) => document.id));
                              clearPlanPreview();
                            }}
                          >
                            {t("command.ai_files_all")}
                          </button>
                          <button
                            type="button"
                            className="ode-mini-btn h-8 rounded-lg border border-[var(--ode-border)] px-3 text-[0.76rem]"
                            onClick={() => {
                              setSelectedDocumentIds([]);
                              clearPlanPreview();
                            }}
                          >
                            {t("command.ai_files_clear")}
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 max-h-[15rem] space-y-2 overflow-y-auto pr-1">
                        {availableDocuments.map((document) => {
                          const selected = selectedDocumentIdSet.has(document.id);
                          return (
                            <button
                              key={`ai-document-${document.id}`}
                              type="button"
                              className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
                                selected
                                  ? "border-[var(--ode-border-strong)] bg-[rgba(12,77,117,0.24)]"
                                  : "border-[var(--ode-border)] bg-[rgba(7,36,57,0.28)] hover:border-[var(--ode-border-strong)] hover:bg-[rgba(8,43,67,0.34)]"
                              }`}
                              onClick={() => {
                                setSelectedDocumentIds((current) =>
                                  current.includes(document.id)
                                    ? current.filter((documentId) => documentId !== document.id)
                                    : [...current, document.id]
                                );
                                clearPlanPreview();
                              }}
                            >
                              <span
                                className={`mt-0.5 h-4 w-4 rounded-sm border ${
                                  selected
                                    ? "border-[var(--ode-border-strong)] bg-[rgba(37,170,227,0.78)]"
                                    : "border-[var(--ode-border)] bg-transparent"
                                }`}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[0.92rem] font-medium text-[var(--ode-text)]">
                                  {document.name}
                                </span>
                                {document.pathLabel && document.pathLabel !== nodeContext.title ? (
                                  <span className="mt-1 block truncate text-[0.76rem] text-[var(--ode-text-dim)]">
                                    {document.pathLabel}
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-[var(--ode-border)] bg-[rgba(3,18,30,0.5)] p-1">
                      {surfaceTabs.map((surface) => {
                        const active = activeSurface === surface.id;
                        return (
                          <button
                            key={`surface-${surface.id}`}
                            type="button"
                            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[0.92rem] transition ${
                              active
                                ? "bg-[rgba(31,129,188,0.22)] text-[var(--ode-text)]"
                                : "text-[var(--ode-text-dim)] hover:bg-[rgba(9,62,98,0.3)] hover:text-[var(--ode-text)]"
                            }`}
                            onClick={() => setSurfaceSelection(surface.id)}
                            aria-pressed={active}
                          >
                            {surface.id === "organization" ? (
                              <FolderGlyph state="filled" active={active} />
                            ) : (
                              <DatabaseRootGlyph active={active} />
                            )}
                            <span>{surface.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <p className="text-[0.9rem] text-[var(--ode-text-dim)]">{activeSurfaceMeta.detail}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {activeSurfaceActionItems.map((item) => (
                      <button
                        key={`quick-action-${item.id}`}
                        type="button"
                        className={`h-9 rounded-lg border px-3.5 text-[0.8rem] whitespace-nowrap transition ${
                          activeQuickActionId === item.id || activeQuickActionValue === item.value
                            ? "border-[var(--ode-border-strong)] bg-[rgba(12,77,117,0.28)] text-[var(--ode-accent)]"
                            : "border-[var(--ode-border)] bg-[rgba(7,36,57,0.3)] text-[var(--ode-text-dim)] hover:border-[var(--ode-border-strong)] hover:text-[var(--ode-text)]"
                        }`}
                        onClick={() => applySuggestedPrompt(item)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[220px] flex-1">
                  <textarea
                    ref={inputRef}
                    className="ode-input min-h-[3.9rem] w-full resize-y rounded-xl px-4 py-3 text-[1rem] leading-6"
                    value={commandText}
                    placeholder={commandInputPlaceholder}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setCommandText(nextValue);
                      clearPlanPreview();
                      if (!simpleMode) {
                        setHistoryOpen(true);
                      }
                    }}
                    onFocus={() => {
                      cancelHistoryClose();
                      if (!simpleMode && recentCommands.length > 0) {
                        setHistoryOpen(true);
                      }
                    }}
                    onBlur={() => {
                      scheduleHistoryClose();
                    }}
                    onKeyDown={onInputKeyDown}
                    disabled={isAnalyzing || isExecuting}
                  />
                  {!simpleMode && historyOpen && filteredRecentCommands.length > 0 ? (
                    <div
                      className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-[2] rounded-xl border border-[var(--ode-border-strong)] bg-[rgba(4,24,40,0.98)] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.35)]"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        cancelHistoryClose();
                      }}
                    >
                      <div className="px-2 pb-2 text-[0.74rem] uppercase tracking-[0.12em] text-[var(--ode-text-dim)]">
                        {t("command.ai_recent")}
                      </div>
                      <div className="space-y-1">
                        {filteredRecentCommands.map((recentCommand, index) => (
                          <button
                            key={`recent-command-${recentCommand}`}
                            type="button"
                            className={`w-full rounded-lg px-3 py-2 text-left text-[0.92rem] transition ${
                              index === highlightedHistoryIndex
                                ? "border border-[var(--ode-border-strong)] bg-[rgba(12,77,117,0.34)] text-[var(--ode-text)]"
                                : "border border-transparent bg-[rgba(6,31,49,0.42)] text-[var(--ode-text-dim)] hover:border-[var(--ode-border)] hover:bg-[rgba(8,43,67,0.42)] hover:text-[var(--ode-text)]"
                            }`}
                            onMouseEnter={() => setHighlightedHistoryIndex(index)}
                            onClick={() => selectRecentCommand(recentCommand)}
                          >
                            {recentCommand}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
                {!simpleMode ? (
                  <OdeTooltip label={t("command.ai_voice")} side="top">
                    <button
                      type="button"
                      className={`ode-mini-btn h-12 px-4 ${isListening ? "border-[rgba(86,210,255,0.95)] text-[var(--ode-accent)]" : ""}`}
                      onClick={toggleVoice}
                      disabled={isAnalyzing || isExecuting}
                    >
                      {isListening ? t("command.ai_listening") : t("command.ai_voice")}
                    </button>
                  </OdeTooltip>
                ) : null}
                <button
                  type="button"
                  className="ode-primary-btn h-12 px-5"
                  onClick={() => {
                    void runAnalyze();
                  }}
                  disabled={isAnalyzing || isExecuting || commandText.trim().length === 0}
                >
                  {isAnalyzing
                    ? primaryBusyLabel
                    : primaryActionLabel}
                </button>
              </div>

              {!simpleMode ? (
                <div className="rounded-xl border border-[var(--ode-border)] bg-[rgba(5,28,46,0.58)] px-4 py-3">
                  <p className="mb-2 text-[0.82rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                    {t("command.ai_progress")}
                  </p>
                  {progressLines.length > 0 ? (
                    <ul className="space-y-1.5">
                      {progressLines.map((line, idx) => (
                        <li key={`progress-${idx}`} className="text-[0.95rem] text-[var(--ode-text-dim)]">
                          {line}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[0.95rem] text-[var(--ode-text-muted)]">{t("command.ai_progress_idle")}</p>
                  )}
                  {error ? <p className="mt-2 text-[0.92rem] text-[#ffb8b8]">{error}</p> : null}
                </div>
              ) : error ? (
                <p className="text-[0.92rem] text-[#ffb8b8]">{error}</p>
              ) : null}

              {nodeResponse ? (
                <div className="rounded-xl border border-[var(--ode-border-strong)] bg-[rgba(5,35,57,0.62)] px-4 py-4">
                  <p className="text-[0.86rem] uppercase tracking-[0.12em] text-[var(--ode-accent)]">
                    {nodeResponse.title ?? t("command.ai_answer_title")}
                  </p>
                  <textarea
                    className="ode-input mt-3 min-h-[12rem] w-full resize-y rounded-xl px-4 py-3 text-[0.96rem] leading-7"
                    value={nodeResponseDraft}
                    onChange={(event) => {
                      setNodeResponseDraft(event.target.value);
                    }}
                    onKeyDown={handleNodeResponseKeyDown}
                    disabled={isExecuting || isAnalyzing}
                  />
                  {nodeResponse.sourceLabels.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {nodeResponse.sourceLabels.map((label) => (
                        <span
                          key={`answer-source-${label}`}
                          className="rounded-full border border-[var(--ode-border)] bg-[rgba(4,24,40,0.52)] px-3 py-1 text-[0.76rem] text-[var(--ode-text-dim)]"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="ode-mini-btn h-10 px-4"
                        onClick={() => {
                          setNodeResponseDraft(nodeResponse.answer);
                        }}
                        disabled={isExecuting || isAnalyzing || nodeResponseDraft === nodeResponse.answer}
                      >
                        {t("command.ai_answer_reset")}
                      </button>
                      <button
                        type="button"
                        className="ode-primary-btn h-10 px-4"
                        onClick={() => {
                          void runImplementNodeResponse();
                        }}
                        disabled={
                          (activeSurface === "workarea" && !onApplyNodePlan) ||
                          isExecuting ||
                          isAnalyzing ||
                          commandText.trim().length === 0 ||
                          nodeResponseDraft.trim().length === 0
                        }
                      >
                        {isExecuting ? t("command.ai_implementing_answer") : t("command.ai_implement_answer")}
                      </button>
                    </div>
                  </div>
                ) : null}

              {!simpleMode && plan ? (
                <div className="rounded-xl border border-[var(--ode-border-strong)] bg-[rgba(5,35,57,0.62)] px-4 py-3">
                  <p className="text-[0.86rem] uppercase tracking-[0.12em] text-[var(--ode-accent)]">{t("command.ai_plan_title")}</p>
                  <p className="mt-1 text-[1rem] text-[var(--ode-text)]">{plan.reason}</p>
                  <p className="mt-1 text-[0.84rem] text-[var(--ode-text-muted)]">
                    {t("command.ai_planner_source_label")}:{" "}
                    <span className="text-[var(--ode-text)]">{plan.plannerSource}</span> | {t("command.ai_confidence_label")}:{" "}
                    <span className="text-[var(--ode-text)]">{Math.round(plan.confidence * 100)}%</span>
                  </p>
                  {plan.steps.length > 0 ? (
                    <ol className="mt-2 list-decimal space-y-1 pl-4 text-[0.95rem] text-[var(--ode-text-dim)]">
                      {plan.steps.map((step, idx) => (
                        <li key={`ai-step-${idx}`}>{step}</li>
                      ))}
                    </ol>
                  ) : null}
                  {plan.previewChanges.length > 0 ? (
                    <div className="mt-3 rounded-lg border border-[var(--ode-border)] bg-[rgba(4,24,40,0.52)] px-3 py-2">
                      <p className="text-[0.8rem] uppercase tracking-[0.11em] text-[var(--ode-accent)]">
                        Execution Preview
                      </p>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-[0.92rem] text-[var(--ode-text-dim)]">
                        {plan.previewChanges.map((change, idx) => (
                          <li key={`plan-preview-${idx}`}>{change}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <p className="mt-3 text-[0.86rem] text-[var(--ode-text-muted)]">
                    {plan.requiresConfirmation ? t("command.ai_confirm_needed") : t("command.ai_no_confirm")}
                  </p>
                </div>
              ) : null}

              {simpleMode && documentReview?.open ? (
                <div className="rounded-xl border border-[var(--ode-border)] bg-[rgba(4,24,40,0.52)] px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.8rem] uppercase tracking-[0.12em] text-[var(--ode-accent)]">
                        {t("document_ai.tree_proposal_title")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="ode-mini-btn h-9 px-4"
                        onClick={() => {
                          void importTreeTemplateWorkbook();
                        }}
                      >
                        {t("tree_excel.import_ai_template")}
                      </button>
                      <button
                        type="button"
                        className="ode-mini-btn h-9 px-4"
                        onClick={() => {
                          void exportTreeTemplateWorkbook();
                        }}
                        disabled={!documentReview.treeProposal}
                      >
                        {t("tree_excel.export_ai_template")}
                      </button>
                      <button
                        type="button"
                        className="ode-mini-btn h-9 px-4"
                        onClick={() => {
                          refreshTreeMemoryEntries();
                          setActiveTab("memory");
                        }}
                      >
                        {t("document_ai.tree_memory_button")}
                      </button>
                      {reviewConfidencePercent !== null ? (
                        <span className="rounded-full border border-[rgba(63,118,154,0.22)] px-3 py-1 text-[0.76rem] text-[var(--ode-text-muted)]">
                          {t("document_ai.confidence", { percent: reviewConfidencePercent })}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {documentReview.error && !documentReview.treeProposal ? (
                    <p className="mt-4 text-[0.92rem] text-[#ffb8b8]">{documentReview.error}</p>
                  ) : null}
                  {documentReview.treeProposal?.warningMessage ? (
                    <p className="mt-4 text-[0.9rem] text-[var(--ode-text-muted)]">
                      {documentReview.treeProposal.warningMessage}
                    </p>
                  ) : null}
                  {treeTemplateStatus ? (
                    <p className="mt-4 text-[0.9rem] text-[var(--ode-accent)]">{treeTemplateStatus}</p>
                  ) : null}
                  {treeTemplateError ? (
                    <p className="mt-4 text-[0.9rem] text-[#ffb8b8]">{treeTemplateError}</p>
                  ) : null}
                  {isExecuting ? (
                    <div className="mt-4 rounded-xl border border-[var(--ode-border-strong)] bg-[rgba(8,44,70,0.52)] px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--ode-accent)] border-t-transparent" />
                        <p className="text-[0.95rem] font-medium text-[var(--ode-text)]">
                          {t("document_ai.run_busy")}
                        </p>
                      </div>
                    </div>
                  ) : null}
                  {documentReview.isBusy && !documentReview.treeProposal ? (
                    <p className="mt-4 text-[0.92rem] text-[var(--ode-text-muted)]">
                      {t("document_ai.tree_proposal_loading")}
                    </p>
                  ) : null}
                  {documentReview.treeProposal || documentReviewDraftNodes ? (
                    <div className="mt-4">
                      <DocumentTreeProposalEditor
                        nodes={activeDocumentReviewNodes}
                        t={t}
                        disabled={documentReview.isBusy || isExecuting}
                        onChange={(nextNodes) => {
                          setDocumentReviewDraftNodes(nextNodes);
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : activeTab === "memory" ? (
            <div className="space-y-5">
              {treeMemoryActionMessage || treeMemoryActionError ? (
                <div className="rounded-xl border border-[var(--ode-border)] bg-[rgba(5,28,46,0.58)] px-4 py-3">
                  {treeMemoryActionMessage ? (
                    <p className="text-[0.9rem] text-[var(--ode-accent)]">{treeMemoryActionMessage}</p>
                  ) : null}
                  {treeMemoryActionError ? (
                    <p className="text-[0.9rem] text-[#ffb8b8]">{treeMemoryActionError}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="grid min-h-0 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                <div className="space-y-3">
                  <div className="rounded-xl border border-[var(--ode-border)] bg-[rgba(5,28,46,0.58)] px-4 py-4">
                    <p className="text-[0.84rem] uppercase tracking-[0.12em] text-[var(--ode-accent)]">
                      {t("document_ai.tree_memory_title")}
                    </p>
                  </div>

                  {treeMemoryEntries.length === 0 ? (
                    <div className="rounded-xl border border-[var(--ode-border)] bg-[rgba(5,28,46,0.58)] px-4 py-4 text-[0.94rem] text-[var(--ode-text-muted)]">
                      {t("document_ai.tree_memory_empty")}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {treeMemoryEntries.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          className={`w-full rounded-xl border px-4 py-4 text-left transition ${
                            entry.id === selectedTreeMemoryEntryId
                              ? "border-[var(--ode-accent)] bg-[rgba(38,157,214,0.14)]"
                              : "border-[var(--ode-border)] bg-[rgba(5,28,46,0.58)] hover:border-[var(--ode-border-strong)]"
                          }`}
                          onClick={() => {
                            setSelectedTreeMemoryEntryId(entry.id);
                            setTreeMemoryActionMessage(null);
                            setTreeMemoryActionError(null);
                          }}
                        >
                          <div className="text-[0.98rem] font-medium text-[var(--ode-text)]">{entry.goal}</div>
                          <div className="mt-1 text-[0.8rem] text-[var(--ode-text-muted)]">{entry.outputLanguage}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="ode-mini-btn h-10 px-4"
                      onClick={() => {
                        void importTreeMemoryWorkbook();
                      }}
                    >
                      {t("tree_excel.import_ai_template")}
                    </button>
                    <button
                      type="button"
                      className="ode-mini-btn h-10 px-4"
                      onClick={() => {
                        void exportTreeMemoryWorkbook();
                      }}
                      disabled={!draftTreeMemoryEntry}
                    >
                      {t("tree_excel.export_ai_template")}
                    </button>
                    <button
                      type="button"
                      className="ode-mini-btn h-10 px-4"
                      onClick={() => {
                        clearApprovedDocumentTreeMemories();
                        refreshTreeMemoryEntries();
                        setSelectedTreeMemoryEntryId(null);
                        setDraftTreeMemoryEntry(null);
                      }}
                      disabled={treeMemoryEntries.length === 0}
                    >
                      {t("document_ai.tree_memory_clear")}
                    </button>
                    <button
                      type="button"
                      className="ode-mini-btn h-10 px-4"
                      onClick={() => {
                        if (!selectedTreeMemoryEntryId) return;
                        removeApprovedDocumentTreeMemory(selectedTreeMemoryEntryId);
                        refreshTreeMemoryEntries();
                      }}
                      disabled={!selectedTreeMemoryEntryId}
                    >
                      {t("document_ai.tree_memory_delete")}
                    </button>
                  </div>

                  {!draftTreeMemoryEntry ? (
                    <div className="rounded-xl border border-[var(--ode-border)] bg-[rgba(5,28,46,0.58)] px-4 py-6 text-[0.94rem] text-[var(--ode-text-muted)]">
                      {t("document_ai.tree_memory_pick")}
                    </div>
                  ) : (
                    <>
                      <div className="rounded-xl border border-[var(--ode-border)] bg-[rgba(5,28,46,0.58)] px-4 py-4">
                        <div className="text-[1rem] font-medium text-[var(--ode-text)]">{draftTreeMemoryEntry.goal}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[0.8rem] text-[var(--ode-text-muted)]">
                          <span>{new Date(draftTreeMemoryEntry.approvedAt).toLocaleString()}</span>
                          <span className="rounded-full border border-[var(--ode-border)] px-2.5 py-1 text-[0.74rem] uppercase tracking-[0.11em] text-[var(--ode-accent)]">
                            {draftTreeMemoryEntry.outputLanguage}
                          </span>
                        </div>
                      </div>
                      <DocumentTreeProposalEditor
                        nodes={draftTreeMemoryEntry.nodes}
                        t={t}
                        onChange={(nextNodes) => {
                          setDraftTreeMemoryEntry((current) => (current ? { ...current, nodes: nextNodes } : current));
                        }}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === "activity" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[1rem] font-semibold uppercase tracking-[0.1em] text-[var(--ode-accent)]">
                    {t("assistant.activity_title")}
                  </p>
                  <p className="mt-1 text-[0.92rem] text-[var(--ode-text-dim)]">
                    {activityItems.length > 0 ? `${activityItems.length} item(s)` : t("assistant.activity_empty")}
                  </p>
                </div>
                <button
                  type="button"
                  className="ode-mini-btn h-10 px-4"
                  onClick={onClearActivity}
                  disabled={activityItems.length === 0}
                >
                  {t("assistant.activity_clear")}
                </button>
              </div>

              {activityItems.length > 0 ? (
                <div className="space-y-2">
                  {activityItems.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-xl border border-[var(--ode-border)] bg-[rgba(5,28,46,0.56)] px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className={`text-[0.92rem] font-medium ${item.success ? "text-[var(--ode-accent)]" : "text-[#ffb8b8]"}`}>
                          {item.success ? t("assistant.activity_ok") : t("assistant.activity_failed")}
                        </p>
                        <p className="text-[0.8rem] text-[var(--ode-text-muted)]">
                          {Math.max(0, Math.round(item.latencyMs))} ms
                        </p>
                      </div>
                      <p className="mt-2 text-[0.96rem] text-[var(--ode-text)]">
                        {item.flow} {item.actionId ? `| ${item.actionId}` : ""}
                      </p>
                      <p className="mt-1 text-[0.86rem] text-[var(--ode-text-dim)]">
                        {new Date(item.timestamp).toLocaleString()} | {item.workspace}
                      </p>
                      {item.details?.map((detail, index) => (
                        <p key={`${item.id}-detail-${index}`} className="mt-1 text-[0.84rem] text-[var(--ode-text-muted)]">
                          {detail}
                        </p>
                      ))}
                      {item.error ? <p className="mt-2 text-[0.86rem] text-[#ffb8b8]">{item.error}</p> : null}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-[var(--ode-border)] bg-[rgba(5,28,46,0.58)] px-4 py-6">
                  <p className="text-[0.95rem] text-[var(--ode-text-muted)]">{t("assistant.activity_empty")}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-xl border border-[var(--ode-border)] bg-[rgba(5,28,46,0.58)] px-4 py-4">
                <p className="text-[1rem] font-semibold uppercase tracking-[0.1em] text-[var(--ode-accent)]">
                  {t("settings.mistral_title")}
                </p>
              </div>

              <div className="space-y-3">
                {mistralKeys.map((key, idx) => (
                  <div key={`command-bar-mistral-${idx}`} className="flex items-center gap-2">
                    <input
                      type="password"
                      value={key}
                      onChange={(event) => {
                        const next = [...mistralKeys];
                        next[idx] = event.target.value;
                        setMistralKeys(next);
                        setSettingsMessage(null);
                      }}
                      className="ode-input h-12 w-full rounded-lg px-4 text-[0.98rem]"
                      placeholder={t("settings.mistral_placeholder").replace("{index}", String(idx + 1))}
                    />
                    <button
                      type="button"
                      className="ode-icon-btn h-12 w-12"
                      onClick={() => {
                        updateKeyList(mistralKeys.filter((_, itemIdx) => itemIdx !== idx));
                        setSettingsMessage(null);
                      }}
                    >
                      -
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="ode-action-btn h-12 w-full rounded-xl border border-dashed border-[var(--ode-border-accent)] text-[var(--ode-text-dim)]"
                onClick={() => {
                  setMistralKeys((prev) => [...prev, ""]);
                  setSettingsMessage(null);
                }}
              >
                {t("settings.add_key")}
              </button>

              {settingsMessage ? (
                <p className="rounded-xl border border-[var(--ode-border)] bg-[rgba(7,40,66,0.45)] px-4 py-2.5 text-sm text-[var(--ode-accent)]">
                  {settingsMessage}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ode-border)] pt-5">
                <button
                  type="button"
                  className="ode-mini-btn h-11 px-4"
                  onClick={() => {
                    void runKeyCheck();
                  }}
                  disabled={isTestingKeys}
                >
                  {isTestingKeys ? t("settings.testing") : t("settings.test_keys")}
                </button>
                <button type="button" className="ode-primary-btn h-11 px-6" onClick={saveMistralKeys}>
                  {t("settings.save")}
                </button>
              </div>
            </div>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-between border-t border-[var(--ode-border)] px-6 py-5">
          <button type="button" className="ode-text-btn h-11 px-4" onClick={onClose} disabled={isExecuting}>
            {t("settings.cancel")}
          </button>
          {activeTab === "memory" ? (
            <button
              type="button"
              className="ode-primary-btn h-11 px-6"
              onClick={saveTreeMemoryDraft}
              disabled={!draftTreeMemoryEntry || !hasTreeMemoryUnsavedChanges}
            >
              {t("settings.save")}
            </button>
          ) : activeTab === "command" && simpleMode && documentReview?.open ? (
            <button
              type="button"
              className={`ode-primary-btn h-11 px-6 transition-all ${
                isExecuting ? "translate-y-px cursor-wait opacity-90 saturate-75" : ""
              }`}
              onClick={() => {
                void runExecuteDocumentReview();
              }}
              disabled={!documentReview.treeProposal || documentReview.isBusy || isExecuting}
            >
              {documentReview.isBusy || isExecuting ? t("document_ai.run_busy") : t("document_ai.run_action")}
            </button>
          ) : activeTab === "command" && !simpleMode ? (
            <button
              type="button"
              className="ode-primary-btn h-11 px-6"
              onClick={() => {
                void runExecute();
              }}
              disabled={!plan?.actionId || isExecuting || isAnalyzing}
            >
              {isExecuting
                ? reviewFirstMode
                  ? t("command.ai_opening_review")
                  : t("command.ai_executing")
                : reviewFirstMode
                  ? t("command.ai_open_review")
                  : simpleMode
                    ? t("command.ai_review")
                    : t("command.ai_execute")}
            </button>
          ) : (
            <span />
          )}
        </footer>
      </section>
    </div>
  );
}
