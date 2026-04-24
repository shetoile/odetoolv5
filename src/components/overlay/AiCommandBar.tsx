import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent
} from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AI_SPEECH_LOCALES } from "@/ai/planning/outputLanguage";
import {
  ArrowUpGlyphSmall,
  ClockGlyphSmall,
  DatabaseRootGlyph,
  FileGlyphSmall,
  FolderGlyph,
  ImageGlyphSmall,
  PlusGlyphSmall,
  SparkGlyphSmall,
  TrashGlyphSmall,
  UploadGlyphSmall
} from "@/components/Icons";
import { WindowControls } from "@/components/layout/WindowControls";
import { AiSettingsModal } from "@/components/modals/AiSettingsModal";
import { OdeAiMark } from "@/components/OdeAiMark";
import { DocumentTreeProposalEditor } from "@/components/overlay/DocumentTreeProposalEditor";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import { buildAppStorageKey } from "@/lib/appIdentity";
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
  extractDocumentText,
  extractDocumentTextFromPayload,
  exportTreeStructureExcel,
  getWindowsClipboardFilePaths,
  pickWindowsTreeSpreadsheetFile,
  pickWindowsFilesForImport,
  readClipboardImageDataUrl,
  readLocalImageDataUrl,
  readTreeStructureExcel
} from "@/lib/nodeService";
import {
  AI_COMMAND_MAX_ATTACHMENTS,
  AI_COMMAND_MAX_TOTAL_BYTES,
  buildAiCommandAttachmentId,
  formatAiCommandAttachmentSize,
  hasReadyAiCommandAttachments,
  inferAiCommandAttachmentKind,
  snapshotAiCommandAttachment,
  type AiCommandAttachment,
  type AiConversationAttachment
} from "@/lib/aiCommandAttachments";
import {
  buildDocumentTreeMemoryEntryFromSpreadsheetPayload,
  buildTreeSpreadsheetPayloadFromDocumentTreeMemory,
  buildTreeSpreadsheetPayloadFromWbsNodes,
  normalizeTreeSpreadsheetPayload,
  parseSpreadsheetPayloadToWbsNodes
} from "@/lib/treeSpreadsheet";
import type { QuickAppScope } from "@/lib/nodeQuickApps";
import {
  createEmptyStoredAiProviderKey,
  detectAndNormalizeAiProviderKeys,
  ensureAiProviderKeyDrafts,
  readStoredAiProviderKeys,
  writeStoredAiProviderKeys,
  type StoredAiProviderKey
} from "@/lib/aiProviderKeys";

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

export type { AiCommandAttachment } from "@/lib/aiCommandAttachments";

type AiConversationRole = "user" | "assistant" | "insight" | "error";

type AiConversationEntry = {
  id: string;
  role: AiConversationRole;
  title: string | null;
  text: string;
  detailLines: string[];
  sourceLabels: string[];
  attachments: AiConversationAttachment[];
  pending: boolean;
  createdAt: string;
};

export type AiQuickAppScopeSummary = {
  scope: QuickAppScope;
  label: string;
  ownerLabel: string;
  itemCount: number;
  readableCount: number;
  previewableCount: number;
  groundedCount: number;
  metadataOnlyCount: number;
  itemLabels: string[];
};

export type AiCommandRequestOptions = {
  selectedDocumentIds?: string[];
  actionHint?: string | null;
  attachments?: AiCommandAttachment[];
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
  layout?: "modal" | "embedded";
  chrome?: "default" | "minimal";
  focusRequestKey?: number;
  historyStorageKey?: string | null;
  initialSurface?: AssistantSurface;
  onTriggerUpload?: (() => void) | null;
  t: TranslateFn;
  language: LanguageCode;
  languageCodes: LanguageCode[];
  activityItems: AiActivityItem[];
  nodeContext?: AiNodeContext | null;
  quickAppScopes?: AiQuickAppScopeSummary[];
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
const MAX_CONVERSATION_ENTRIES = 60;
const AI_ATTACHMENT_FILE_ACCEPT =
  ".png,.jpg,.jpeg,.webp,.gif,.bmp,.svg,.pdf,.docx,.xlsx,.xls,.html,.htm,.txt,.md,.csv";

function encodeBytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, Math.min(bytes.length, index + chunkSize));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function dataTransferIncludesFiles(dataTransfer: DataTransfer | null | undefined): boolean {
  if (!dataTransfer) return false;
  if ((dataTransfer.files?.length ?? 0) > 0) return true;
  return Array.from(dataTransfer.items ?? []).some((item) => item.kind === "file");
}

function inferMimeTypeFromName(name: string): string {
  const extension = name.trim().split(".").pop()?.toLowerCase() ?? "";
  switch (extension) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "bmp":
      return "image/bmp";
    case "svg":
      return "image/svg+xml";
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "xls":
      return "application/vnd.ms-excel";
    case "csv":
      return "text/csv";
    case "md":
      return "text/markdown";
    case "html":
    case "htm":
      return "text/html";
    case "txt":
      return "text/plain";
    default:
      return "application/octet-stream";
  }
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Failed to read ${file.name || "image"} as data URL.`));
    reader.onload = () => {
      if (typeof reader.result === "string" && reader.result.trim().length > 0) {
        resolve(reader.result);
        return;
      }
      reject(new Error(`Failed to read ${file.name || "image"} as data URL.`));
    };
    reader.readAsDataURL(file);
  });
}

function readStoredAiProviderKeyDrafts(): StoredAiProviderKey[] {
  return ensureAiProviderKeyDrafts(readStoredAiProviderKeys());
}

function readRecentCommands(storageKey: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey);
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

function createConversationEntryId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readConversationEntries(storageKey: string): AiConversationEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const next: AiConversationEntry[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const candidate = item as Record<string, unknown>;
      const role = candidate.role;
      if (role !== "user" && role !== "assistant" && role !== "insight" && role !== "error") {
        continue;
      }
      const text = typeof candidate.text === "string" ? candidate.text.trim() : "";
      if (!text) continue;
      next.push({
        id:
          typeof candidate.id === "string" && candidate.id.trim().length > 0
            ? candidate.id
            : createConversationEntryId(role),
        role,
        title:
          typeof candidate.title === "string" && candidate.title.trim().length > 0
            ? candidate.title.trim()
            : null,
        text,
        detailLines: Array.isArray(candidate.detailLines)
          ? candidate.detailLines.filter((line): line is string => typeof line === "string" && line.trim().length > 0)
          : [],
        sourceLabels: Array.isArray(candidate.sourceLabels)
          ? candidate.sourceLabels.filter(
              (label): label is string => typeof label === "string" && label.trim().length > 0
            )
          : [],
        attachments: [],
        pending: candidate.pending === true,
        createdAt:
          typeof candidate.createdAt === "string" && candidate.createdAt.trim().length > 0
            ? candidate.createdAt
            : new Date().toISOString()
      });
      if (next.length >= MAX_CONVERSATION_ENTRIES) {
        break;
      }
    }
    return next;
  } catch {
    return [];
  }
}

function writeConversationEntries(storageKey: string, entries: AiConversationEntry[]) {
  if (typeof window === "undefined") return;
  try {
    if (entries.length === 0) {
      localStorage.removeItem(storageKey);
      return;
    }
    localStorage.setItem(
      storageKey,
      JSON.stringify(
        entries.slice(-MAX_CONVERSATION_ENTRIES).map((entry) => ({
          ...entry,
          attachments: []
        }))
      )
    );
  } catch {
    // Conversation history is best-effort only.
  }
}

export function AiCommandBar({
  open,
  simpleMode = false,
  layout = "modal",
  chrome = "default",
  focusRequestKey = 0,
  historyStorageKey = null,
  initialSurface = "organization",
  onTriggerUpload = null,
  t,
  language,
  languageCodes,
  activityItems,
  nodeContext = null,
  quickAppScopes = [],
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
  const resolvedHistoryStorageKey = historyStorageKey?.trim() || AI_COMMAND_HISTORY_STORAGE_KEY;
  const resolvedConversationStorageKey = `${resolvedHistoryStorageKey}.conversation`;
  const [activeTab, setActiveTab] = useState<CommandBarTab>("command");
  const [assistantMode, setAssistantMode] = useState<AssistantMode>("command");
  const [activeSurface, setActiveSurface] = useState<AssistantSurface>(initialSurface);
  const [commandText, setCommandText] = useState("");
  const [lastSubmittedCommandText, setLastSubmittedCommandText] = useState("");
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
  const [recentCommands, setRecentCommands] = useState<string[]>(() =>
    readRecentCommands(resolvedHistoryStorageKey)
  );
  const [conversationEntries, setConversationEntries] = useState<AiConversationEntry[]>(() =>
    readConversationEntries(resolvedConversationStorageKey)
  );
  const [providerKeys, setProviderKeys] = useState<StoredAiProviderKey[]>(() => readStoredAiProviderKeyDrafts());
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [isTestingKeys, setIsTestingKeys] = useState(false);
  const [isSavingKeys, setIsSavingKeys] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedHistoryCommands, setSelectedHistoryCommands] = useState<string[]>([]);
  const [highlightedHistoryIndex, setHighlightedHistoryIndex] = useState(-1);
  const [isDocumentPickerOpen, setIsDocumentPickerOpen] = useState(false);
  const [apiSetupOpen, setApiSetupOpen] = useState(false);
  const [attachmentPanelOpen, setAttachmentPanelOpen] = useState(false);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [activeQuickActionId, setActiveQuickActionId] = useState<string | null>(null);
  const [draftAttachments, setDraftAttachments] = useState<AiCommandAttachment[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [isAttachPickerBusy, setIsAttachPickerBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const attachInputRef = useRef<HTMLInputElement | null>(null);
  const compactComposerRef = useRef<HTMLDivElement | null>(null);
  const conversationScrollRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollConversationRef = useRef(true);
  const dragDepthRef = useRef(0);
  const blurTimerRef = useRef<number | null>(null);
  const activePendingConversationIdRef = useRef<string | null>(null);
  const [compactComposerHeight, setCompactComposerHeight] = useState(108);
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
      setDraftAttachments([]);
      setDragActive(false);
      dragDepthRef.current = 0;
      setHistoryOpen(false);
      setSelectedHistoryCommands([]);
      setHighlightedHistoryIndex(-1);
      setSelectedTreeMemoryEntryId(null);
      setDraftTreeMemoryEntry(null);
      setTreeMemoryActionMessage(null);
      setTreeMemoryActionError(null);
      setNodeResponse(null);
      activePendingConversationIdRef.current = null;
      return;
    }
    setActiveTab("command");
    setAssistantMode(nodeContext ? "ask" : "command");
    setActiveSurface(initialSurface);
    setIsDocumentPickerOpen(false);
    setActiveQuickActionId(null);
    setSelectedDocumentIds([]);
    setDraftAttachments([]);
    setDragActive(false);
    dragDepthRef.current = 0;
    setLastSubmittedCommandText("");
    setProviderKeys(readStoredAiProviderKeyDrafts());
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
    if (activeTab !== "command" && !(canKeepMemoryTab && activeTab === "memory")) {
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
    // In the embedded workspace chat, only focus when explicitly requested.
    // This keeps the organisation tree in keyboard control after opening AI tabs from the tree.
    if (!open || activeTab !== "command" || (layout === "embedded" && simpleMode && !documentReview?.open)) return;
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }, [activeTab, documentReview?.open, layout, open, simpleMode]);

  useEffect(() => {
    if (!open || activeTab !== "command" || focusRequestKey <= 0) return;
    window.setTimeout(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      const cursorPosition = input.value.length;
      input.setSelectionRange(cursorPosition, cursorPosition);
    }, 0);
  }, [activeTab, focusRequestKey, open]);

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
        localStorage.removeItem(resolvedHistoryStorageKey);
        return;
      }
      localStorage.setItem(resolvedHistoryStorageKey, JSON.stringify(recentCommands));
    } catch {
      // Command history is best-effort only.
    }
  }, [recentCommands, resolvedHistoryStorageKey]);

  useEffect(() => {
    if (!open) return;
    setRecentCommands(readRecentCommands(resolvedHistoryStorageKey));
  }, [open, resolvedHistoryStorageKey]);

  useEffect(() => {
    if (!open) return;
    setConversationEntries(readConversationEntries(resolvedConversationStorageKey));
    activePendingConversationIdRef.current = null;
  }, [open, resolvedConversationStorageKey]);

  useEffect(() => {
    writeConversationEntries(resolvedConversationStorageKey, conversationEntries);
  }, [conversationEntries, resolvedConversationStorageKey]);

  useEffect(() => {
    if (!historyOpen || filteredRecentCommands.length === 0) {
      setHighlightedHistoryIndex(-1);
      return;
    }
    setHighlightedHistoryIndex((current) =>
      current >= 0 && current < filteredRecentCommands.length ? current : -1
    );
  }, [historyOpen, filteredRecentCommands]);

  useEffect(() => {
    setSelectedHistoryCommands((current) => current.filter((command) => recentCommands.includes(command)));
  }, [recentCommands]);

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

  const appendConversationEntries = (entries: AiConversationEntry[]) => {
    setConversationEntries((current) => [...current, ...entries].slice(-MAX_CONVERSATION_ENTRIES));
  };

  const beginConversationTurn = (
    requestText: string,
    pendingText: string,
    detailLines: string[] = [],
    attachments: AiConversationAttachment[] = []
  ) => {
    if (!(simpleMode && layout === "embedded" && !documentReview?.open)) return null;
    shouldAutoScrollConversationRef.current = true;
    const createdAt = new Date().toISOString();
    const pendingId = createConversationEntryId("assistant");
    appendConversationEntries([
      {
        id: createConversationEntryId("user"),
        role: "user",
        title: null,
        text: requestText,
        detailLines: [],
        sourceLabels: [],
        attachments,
        pending: false,
        createdAt
      },
      {
        id: pendingId,
        role: "assistant",
        title: null,
        text: pendingText,
        detailLines,
        sourceLabels: [],
        attachments: [],
        pending: true,
        createdAt
      }
    ]);
    activePendingConversationIdRef.current = pendingId;
    return pendingId;
  };

  const appendConversationStatus = (
    text: string,
    detailLines: string[] = [],
    role: AiConversationRole = "assistant"
  ) => {
    if (!(simpleMode && layout === "embedded" && !documentReview?.open)) return null;
    const entryId = createConversationEntryId(role);
    appendConversationEntries([
      {
        id: entryId,
        role,
        title: null,
        text,
        detailLines,
        sourceLabels: [],
        attachments: [],
        pending: true,
        createdAt: new Date().toISOString()
      }
    ]);
    activePendingConversationIdRef.current = entryId;
    return entryId;
  };

  const finalizeConversationEntry = (
    entryId: string | null,
    next: {
      role?: AiConversationRole;
      title?: string | null;
      text: string;
      detailLines?: string[];
      sourceLabels?: string[];
    }
  ) => {
    if (!entryId) return;
    setConversationEntries((current) =>
      current.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              role: next.role ?? entry.role,
              title: next.title ?? null,
              text: next.text,
              detailLines: next.detailLines ?? [],
              sourceLabels: next.sourceLabels ?? [],
              pending: false
            }
          : entry
      )
    );
    if (activePendingConversationIdRef.current === entryId) {
      activePendingConversationIdRef.current = null;
    }
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

  const startNewChat = () => {
    if (isAnalyzing || isExecuting) return;
    recognitionRef.current?.stop();
    setIsListening(false);
    setConversationEntries([]);
    activePendingConversationIdRef.current = null;
    setCommandText("");
    setLastSubmittedCommandText("");
    setActiveQuickActionId(null);
    setDraftAttachments([]);
    setAttachmentPanelOpen(false);
    setSelectedDocumentIds([]);
    setIsDocumentPickerOpen(false);
    setDragActive(false);
    dragDepthRef.current = 0;
    closeHistoryPicker();
    clearPlanPreview();
    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
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

  const isEmbedded = layout === "embedded";
  const minimalChrome = chrome === "minimal" && isEmbedded;
  const compactEmbeddedMode = simpleMode && isEmbedded && !documentReview?.open;
  const compactConversationMode = compactEmbeddedMode && activeTab === "command";
  const showEmbeddedHeader = !(minimalChrome && compactEmbeddedMode);
  const activeSurfaceMeta = surfaceTabs.find((surface) => surface.id === activeSurface) ?? surfaceTabs[0];
  const showHistorySuggestions = historyOpen && filteredRecentCommands.length > 0;
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
  const readyDraftAttachments = draftAttachments.filter((attachment) => attachment.status === "ready");
  const sendableDraftAttachments = readyDraftAttachments;
  const draftAttachmentCount = draftAttachments.length;
  const canSubmitPrompt = commandText.trim().length > 0 || hasReadyAiCommandAttachments(draftAttachments);
  const compactAttachmentButtonLabel = t("command.ai_attachment_files_empty");
  const compactUtilityButtonClass =
    "inline-flex h-10 items-center justify-center rounded-full bg-[rgba(5,28,46,0.72)] text-[var(--ode-accent)] shadow-[inset_0_1px_0_rgba(128,226,255,0.04)] transition hover:bg-[rgba(8,43,67,0.9)] disabled:cursor-not-allowed disabled:opacity-55";
  const compactUtilityIconButtonClass = `${compactUtilityButtonClass} w-10`;
  const selectedHistoryCommandSet = useMemo(() => new Set(selectedHistoryCommands), [selectedHistoryCommands]);
  const selectedFilteredHistoryCount = filteredRecentCommands.filter((command) =>
    selectedHistoryCommandSet.has(command)
  ).length;
  const allFilteredHistorySelected =
    filteredRecentCommands.length > 0 && selectedFilteredHistoryCount === filteredRecentCommands.length;
  const describeHistoryCommand = (value: string) => {
    const lines = value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (lines.length === 0) {
      return {
        title: t("command.ai_history_request_fallback"),
        detail: ""
      };
    }
    return {
      title: lines[0],
      detail: lines.slice(1).join(" ")
    };
  };
  const canStartNewChat =
    !isAnalyzing &&
    !isExecuting &&
    (conversationEntries.length > 0 ||
      commandText.trim().length > 0 ||
      draftAttachments.length > 0 ||
      progressLines.length > 0 ||
      Boolean(error) ||
      Boolean(plan) ||
      Boolean(nodeResponse));

  useEffect(() => {
    if (draftAttachments.length > 0) return;
    setAttachmentPanelOpen(false);
  }, [draftAttachments.length]);

  const shouldAutoExecuteSimplePlan = (candidatePlan: AiCommandPlan | null): boolean => {
    if (!simpleMode || !candidatePlan?.actionId) return false;
    if (compactEmbeddedMode) return false;
    return (
      candidatePlan.actionId === "desktop_open" ||
      candidatePlan.actionId === "timeline_open" ||
      candidatePlan.actionId === "document_review" ||
      candidatePlan.actionId === "wbs_from_document" ||
      candidatePlan.actionId === "plan_my_day" ||
      candidatePlan.actionId === "ticket_analyze"
    );
  };

  useEffect(() => {
    if (!compactConversationMode) return;
    const pendingId = activePendingConversationIdRef.current;
    if (!pendingId) return;
    setConversationEntries((current) =>
      current.map((entry) =>
        entry.id === pendingId
          ? {
              ...entry,
              detailLines: progressLines
            }
          : entry
      )
    );
  }, [compactConversationMode, progressLines]);

  useEffect(() => {
    if (!compactConversationMode) return;
    if (!shouldAutoScrollConversationRef.current) return;
    const frameId = window.requestAnimationFrame(() => {
      const container = conversationScrollRef.current;
      if (!container) return;
      container.scrollTop = container.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [compactComposerHeight, compactConversationMode, conversationEntries]);

  useEffect(() => {
    if (!compactConversationMode) return;
    shouldAutoScrollConversationRef.current = true;
  }, [compactConversationMode]);

  useEffect(() => {
    if (!compactConversationMode) return;
    const composer = compactComposerRef.current;
    if (!composer) return;

    const syncComposerHeight = () => {
      const nextHeight = composer.offsetHeight;
      if (nextHeight > 0) {
        setCompactComposerHeight(nextHeight);
      }
    };

    syncComposerHeight();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      syncComposerHeight();
    });
    observer.observe(composer);
    return () => observer.disconnect();
  }, [compactConversationMode]);

  const handleConversationScroll = () => {
    const container = conversationScrollRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldAutoScrollConversationRef.current = distanceFromBottom <= 72;
  };

  const compactConversationBottomStyle = useMemo<CSSProperties>(
    () => ({
      paddingBottom: `${compactComposerHeight + 12}px`
    }),
    [compactComposerHeight]
  );

  const syncTextareaHeight = () => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "0px";
    const computed = window.getComputedStyle(input);
    const lineHeight = Number.parseFloat(computed.lineHeight || "24") || 24;
    const paddingTop = Number.parseFloat(computed.paddingTop || "0") || 0;
    const paddingBottom = Number.parseFloat(computed.paddingBottom || "0") || 0;
    const borderTop = Number.parseFloat(computed.borderTopWidth || "0") || 0;
    const borderBottom = Number.parseFloat(computed.borderBottomWidth || "0") || 0;
    const minHeight = lineHeight * 2 + paddingTop + paddingBottom + borderTop + borderBottom;
    const maxHeight = lineHeight * 6 + paddingTop + paddingBottom + borderTop + borderBottom;
    const nextHeight = Math.max(minHeight, Math.min(maxHeight, input.scrollHeight));
    input.style.height = `${nextHeight}px`;
    input.style.overflowY = input.scrollHeight > maxHeight ? "auto" : "hidden";
  };

  useEffect(() => {
    if (!open) return;
    syncTextareaHeight();
  }, [commandText, draftAttachments, open]);

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

  const updateKeyList = (next: StoredAiProviderKey[]) => {
    setProviderKeys(ensureAiProviderKeyDrafts(next));
  };

  const updateProviderKeyDraft = (index: number, apiKey: string) => {
    setProviderKeys((current) =>
      ensureAiProviderKeyDrafts(
        current.map((entry, entryIndex) =>
          entryIndex === index
            ? {
                providerId: "unknown",
                providerLabel: "Auto-detect",
                apiKey
              }
            : entry
        )
      )
    );
  };

  const formatDetectedProviderMessage = (entries: StoredAiProviderKey[]): string => {
    const known = entries.filter((entry) => entry.providerId !== "unknown");
    if (known.length === 0) {
      return t("settings.msg_no_keys");
    }
    const labels = Array.from(new Set(known.map((entry) => entry.providerLabel)));
    const unknownCount = entries.filter((entry) => entry.providerId === "unknown").length;
    return unknownCount > 0
      ? `Detected ${known.length} key(s): ${labels.join(", ")}. ${unknownCount} key(s) could not be identified.`
      : `Detected ${known.length} key(s): ${labels.join(", ")}.`;
  };

  const saveProviderKeys = async () => {
    setIsSavingKeys(true);
    try {
      const detected = await detectAndNormalizeAiProviderKeys(providerKeys);
      writeStoredAiProviderKeys(detected);
      setProviderKeys(ensureAiProviderKeyDrafts(detected));
      setSettingsMessage(t("settings.msg_saved_local"));
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      setSettingsMessage(reason);
    } finally {
      setIsSavingKeys(false);
    }
  };

  const runKeyCheck = async () => {
    setSettingsMessage(null);
    setIsTestingKeys(true);
    try {
      const detected = await detectAndNormalizeAiProviderKeys(providerKeys);
      if (detected.length === 0) {
        setProviderKeys([createEmptyStoredAiProviderKey()]);
        setSettingsMessage(t("settings.msg_no_keys"));
      } else {
        updateKeyList(detected);
        setSettingsMessage(formatDetectedProviderMessage(detected));
      }
    } finally {
      setIsTestingKeys(false);
    }
  };

  const closeHistoryPicker = () => {
    setHistoryOpen(false);
    setSelectedHistoryCommands([]);
    setHighlightedHistoryIndex(-1);
  };

  const openHistoryPicker = () => {
    cancelHistoryClose();
    setHistoryOpen(true);
    setHighlightedHistoryIndex(filteredRecentCommands.length > 0 ? 0 : -1);
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

  const toggleHistoryCommandSelection = (value: string) => {
    setSelectedHistoryCommands((current) => {
      const next = new Set(current);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return recentCommands.filter((command) => next.has(command));
    });
  };

  const toggleSelectAllFilteredHistory = () => {
    setSelectedHistoryCommands((current) => {
      const next = new Set(current);
      if (allFilteredHistorySelected) {
        filteredRecentCommands.forEach((command) => next.delete(command));
      } else {
        filteredRecentCommands.forEach((command) => next.add(command));
      }
      return recentCommands.filter((command) => next.has(command));
    });
  };

  const deleteHistoryCommand = (value: string) => {
    setRecentCommands((current) => current.filter((command) => command !== value));
    setSelectedHistoryCommands((current) => current.filter((command) => command !== value));
  };

  const deleteSelectedHistoryCommands = () => {
    if (selectedHistoryCommands.length === 0) return;
    const selectedSet = new Set(selectedHistoryCommands);
    setRecentCommands((current) => current.filter((command) => !selectedSet.has(command)));
    setSelectedHistoryCommands([]);
  };

  const updateDraftAttachment = (attachmentId: string, next: Partial<AiCommandAttachment>) => {
    setDraftAttachments((current) =>
      current.map((attachment) =>
        attachment.id === attachmentId
          ? {
              ...attachment,
              ...next
            }
          : attachment
      )
    );
  };

  const removeDraftAttachment = (attachmentId: string) => {
    setDraftAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
  };

  const buildRejectedAttachment = (
    name: string,
    source: AiCommandAttachment["source"],
    sizeBytes: number,
    mimeType: string,
    reason: string,
    status: "unsupported" | "error" = "error"
  ): AiCommandAttachment => ({
    id: buildAiCommandAttachmentId(status),
    name,
    kind: "document",
    source,
    mimeType,
    sizeBytes,
    status,
    error: reason,
    extractedText: null,
    dataUrl: null
  });

  const resolveCurrentDraftUsage = () => {
    const attachable = draftAttachments.filter(
      (attachment) => attachment.status === "loading" || attachment.status === "ready"
    );
    return {
      count: attachable.length,
      totalBytes: attachable.reduce((sum, attachment) => sum + Math.max(0, attachment.sizeBytes), 0)
    };
  };

  const createLoadingAttachment = (
    name: string,
    kind: AiCommandAttachment["kind"],
    source: AiCommandAttachment["source"],
    mimeType: string,
    sizeBytes: number
  ): AiCommandAttachment => ({
    id: buildAiCommandAttachmentId("draft"),
    name,
    kind,
    source,
    mimeType,
    sizeBytes,
    status: "loading",
    error: null,
    extractedText: null,
    dataUrl: null
  });

  const resolvePathAttachment = async (
    filePath: string,
    source: AiCommandAttachment["source"],
    attachmentId: string,
    fallbackSizeBytes = 0
  ) => {
    const normalizedPath = filePath.trim().replace(/^"(.*)"$/, "$1");
    const name = normalizedPath.split(/[/\\]/).pop()?.trim() || "Attachment";
    const mimeType = inferMimeTypeFromName(name);
    const kind = inferAiCommandAttachmentKind(name, mimeType);
    if (!kind) {
      updateDraftAttachment(attachmentId, {
        status: "unsupported",
        error: t("command.ai_attachment_unsupported")
      });
      return;
    }

    try {
      if (kind === "image") {
        const dataUrl = await readLocalImageDataUrl(normalizedPath);
        if (!dataUrl) {
          throw new Error(t("command.ai_attachment_unreadable"));
        }
        updateDraftAttachment(attachmentId, {
          name,
          kind,
          source,
          mimeType,
          sizeBytes: fallbackSizeBytes,
          dataUrl,
          status: "ready",
          error: null
        });
        return;
      }

      const extractedText = await extractDocumentText(normalizedPath);
      if (typeof extractedText !== "string" || extractedText.trim().length === 0) {
        throw new Error(t("command.ai_attachment_unreadable"));
      }
      updateDraftAttachment(attachmentId, {
        name,
        kind,
        source,
        mimeType,
        sizeBytes: fallbackSizeBytes,
        extractedText,
        status: "ready",
        error: null
      });
    } catch (error) {
      updateDraftAttachment(attachmentId, {
        status: "error",
        error: error instanceof Error ? error.message : t("command.ai_attachment_unreadable")
      });
    }
  };

  const resolveFileAttachment = async (
    file: File,
    source: AiCommandAttachment["source"],
    attachmentId: string
  ) => {
    const name = file.name.trim() || "Attachment";
    const mimeType = file.type.trim() || inferMimeTypeFromName(name);
    const kind = inferAiCommandAttachmentKind(name, mimeType);
    if (!kind) {
      updateDraftAttachment(attachmentId, {
        status: "unsupported",
        error: t("command.ai_attachment_unsupported")
      });
      return;
    }

    const candidatePath = (file as File & { path?: string }).path?.trim();
    if (candidatePath) {
      await resolvePathAttachment(candidatePath, source, attachmentId, file.size);
      return;
    }

    try {
      if (kind === "image") {
        const dataUrl = await readFileAsDataUrl(file);
        updateDraftAttachment(attachmentId, {
          kind,
          mimeType,
          sizeBytes: file.size,
          dataUrl,
          status: "ready",
          error: null
        });
        return;
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      const extractedText = await extractDocumentTextFromPayload(name, encodeBytesToBase64(bytes));
      if (typeof extractedText !== "string" || extractedText.trim().length === 0) {
        throw new Error(t("command.ai_attachment_unreadable"));
      }
      updateDraftAttachment(attachmentId, {
        kind,
        mimeType,
        sizeBytes: file.size,
        extractedText,
        status: "ready",
        error: null
      });
    } catch (error) {
      updateDraftAttachment(attachmentId, {
        status: "error",
        error: error instanceof Error ? error.message : t("command.ai_attachment_unreadable")
      });
    }
  };

  const addFilesAsDraftAttachments = async (
    files: File[],
    source: AiCommandAttachment["source"]
  ) => {
    if (files.length === 0) return;

    const currentUsage = resolveCurrentDraftUsage();
    let usedCount = currentUsage.count;
    let usedBytes = currentUsage.totalBytes;
    const nextDraftEntries: AiCommandAttachment[] = [];
    const loadingEntries: Array<{ attachmentId: string; file: File }> = [];

    for (const file of files) {
      const name = file.name.trim() || "Attachment";
      const mimeType = file.type.trim() || inferMimeTypeFromName(name);
      const kind = inferAiCommandAttachmentKind(name, mimeType);
      if (!kind) {
        nextDraftEntries.push(
          buildRejectedAttachment(name, source, file.size, mimeType, t("command.ai_attachment_unsupported"), "unsupported")
        );
        continue;
      }
      if (usedCount >= AI_COMMAND_MAX_ATTACHMENTS) {
        nextDraftEntries.push(
          buildRejectedAttachment(name, source, file.size, mimeType, t("command.ai_attachment_limit_count"))
        );
        continue;
      }
      if (file.size > 0 && usedBytes + file.size > AI_COMMAND_MAX_TOTAL_BYTES) {
        nextDraftEntries.push(
          buildRejectedAttachment(name, source, file.size, mimeType, t("command.ai_attachment_limit_size"))
        );
        continue;
      }

      const loadingAttachment = createLoadingAttachment(name, kind, source, mimeType, file.size);
      nextDraftEntries.push(loadingAttachment);
      loadingEntries.push({ attachmentId: loadingAttachment.id, file });
      usedCount += 1;
      usedBytes += Math.max(0, file.size);
    }

    if (nextDraftEntries.length > 0) {
      setAttachmentPanelOpen(true);
      setDraftAttachments((current) => [...current, ...nextDraftEntries]);
    }

    for (const entry of loadingEntries) {
      await resolveFileAttachment(entry.file, source, entry.attachmentId);
    }

    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const addFilePathsAsDraftAttachments = async (
    paths: string[],
    source: AiCommandAttachment["source"]
  ) => {
    const normalizedPaths = Array.from(
      new Set(paths.map((path) => path.trim().replace(/^"(.*)"$/, "$1")).filter((path) => path.length > 0))
    );
    if (normalizedPaths.length === 0) return;

    const currentUsage = resolveCurrentDraftUsage();
    let usedCount = currentUsage.count;
    const nextDraftEntries: AiCommandAttachment[] = [];
    const loadingEntries: Array<{ attachmentId: string; path: string }> = [];

    for (const path of normalizedPaths) {
      const name = path.split(/[/\\]/).pop()?.trim() || "Attachment";
      const mimeType = inferMimeTypeFromName(name);
      const kind = inferAiCommandAttachmentKind(name, mimeType);
      if (!kind) {
        nextDraftEntries.push(
          buildRejectedAttachment(name, source, 0, mimeType, t("command.ai_attachment_unsupported"), "unsupported")
        );
        continue;
      }
      if (usedCount >= AI_COMMAND_MAX_ATTACHMENTS) {
        nextDraftEntries.push(buildRejectedAttachment(name, source, 0, mimeType, t("command.ai_attachment_limit_count")));
        continue;
      }

      const loadingAttachment = createLoadingAttachment(name, kind, source, mimeType, 0);
      nextDraftEntries.push(loadingAttachment);
      loadingEntries.push({ attachmentId: loadingAttachment.id, path });
      usedCount += 1;
    }

    if (nextDraftEntries.length > 0) {
      setAttachmentPanelOpen(true);
      setDraftAttachments((current) => [...current, ...nextDraftEntries]);
    }

    for (const entry of loadingEntries) {
      await resolvePathAttachment(entry.path, source, entry.attachmentId);
    }

    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const addClipboardImageAttachment = async () => {
    const currentUsage = resolveCurrentDraftUsage();
    if (currentUsage.count >= AI_COMMAND_MAX_ATTACHMENTS) {
      setAttachmentPanelOpen(true);
      setDraftAttachments((current) => [
        ...current,
        buildRejectedAttachment(
          t("command.ai_attachment_clipboard_image"),
          "clipboard-image",
          0,
          "image/png",
          t("command.ai_attachment_limit_count")
        )
      ]);
      return;
    }

    const dataUrl = await readClipboardImageDataUrl();
    if (!dataUrl) return;
    const encodedPayload = dataUrl.split(",")[1] ?? "";
    const sizeBytes = Math.floor((encodedPayload.length * 3) / 4);
    if (sizeBytes > 0 && currentUsage.totalBytes + sizeBytes > AI_COMMAND_MAX_TOTAL_BYTES) {
      setAttachmentPanelOpen(true);
      setDraftAttachments((current) => [
        ...current,
        buildRejectedAttachment(
          t("command.ai_attachment_clipboard_image"),
          "clipboard-image",
          sizeBytes,
          "image/png",
          t("command.ai_attachment_limit_size")
        )
      ]);
      return;
    }

    setDraftAttachments((current) => [
      ...current,
      {
        id: buildAiCommandAttachmentId("clipboard"),
        name: t("command.ai_attachment_clipboard_image"),
        kind: "image",
        source: "clipboard-image",
        mimeType: "image/png",
        sizeBytes,
        dataUrl,
        status: "ready",
        error: null,
        extractedText: null
      }
    ]);
    setAttachmentPanelOpen(true);
    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleAttachButton = () => {
    if (isAttachPickerBusy) return;
    setIsAttachPickerBusy(true);
    void (async () => {
      try {
        const pickedPaths = await pickWindowsFilesForImport();
        if (pickedPaths.length > 0) {
          await addFilePathsAsDraftAttachments(pickedPaths, "picker");
        }
        return;
      } catch {
        attachInputRef.current?.click();
      } finally {
        setIsAttachPickerBusy(false);
      }
    })();
  };

  const handleAttachInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selectedFiles.length === 0) return;
    setAttachmentPanelOpen(true);
    void addFilesAsDraftAttachments(selectedFiles, "picker");
  };

  const handleAttachmentSummaryButton = () => {
    setAttachmentPanelOpen((current) => !current);
  };

  const handleTextareaPaste = (event: ReactClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardData = event.clipboardData;
    const pastedFiles = Array.from(clipboardData.files ?? []);
    const imageItem = Array.from(clipboardData.items ?? []).find(
      (item) => item.kind === "file" && item.type.startsWith("image/")
    );
    if (pastedFiles.length > 0 || imageItem) {
      event.preventDefault();
      void addFilesAsDraftAttachments(pastedFiles, imageItem ? "clipboard-image" : "clipboard-file");
      return;
    }

    if (clipboardData.getData("text/plain").trim().length > 0) {
      return;
    }

    event.preventDefault();
    void (async () => {
      const clipboardPaths = await getWindowsClipboardFilePaths().catch(() => []);
      if (clipboardPaths.length > 0) {
        await addFilePathsAsDraftAttachments(clipboardPaths, "clipboard-file");
        return;
      }
      await addClipboardImageAttachment();
    })();
  };

  const handleComposerDragEnter = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!dataTransferIncludesFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    setDragActive(true);
  };

  const handleComposerDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!dataTransferIncludesFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    if (!dragActive) {
      setDragActive(true);
    }
  };

  const handleComposerDragLeave = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!dataTransferIncludesFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setDragActive(false);
    }
  };

  const handleComposerDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!dataTransferIncludesFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setDragActive(false);
    const droppedFiles = Array.from(event.dataTransfer.files ?? []);
    if (droppedFiles.length === 0) return;
    void addFilesAsDraftAttachments(droppedFiles, "drop");
  };

  const runAnalyze = async () => {
    const clean = commandText.trim();
    const requestText = clean || t("command.ai_attachment_default_prompt");
    if ((!clean && sendableDraftAttachments.length === 0) || isAnalyzing || isExecuting) return;
    const resolvedAssistantMode = resolveAssistantMode(requestText);
    const requestOptions: AiCommandRequestOptions = {
      selectedDocumentIds: normalizedSelectedDocumentIds,
      actionHint: activeQuickAction?.actionHint ?? null,
      attachments: sendableDraftAttachments
    };
    setAssistantMode(resolvedAssistantMode);
    setLastSubmittedCommandText(requestText);
    if (clean) {
      rememberCommand(clean);
    }
    setError(null);
    setPlan(null);
    setNodeResponse(null);
    if (compactEmbeddedMode) {
      setCommandText("");
      setHistoryOpen(false);
      setHighlightedHistoryIndex(-1);
      window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(0, 0);
      }, 0);
    }
    if (activeQuickAction?.proposalKind === "deliverables" && onOpenNodeDeliverableProposal) {
      const progress = [
        t("command.ai_progress_understand"),
        t("command.ai_progress_scan"),
        t("command.ai_progress_plan")
      ];
      const pendingConversationId = beginConversationTurn(
        requestText,
        primaryBusyLabel,
        progress,
        sendableDraftAttachments.map(snapshotAiCommandAttachment)
      );
      setProgressLines(progress);
      setIsAnalyzing(true);
      try {
        await onOpenNodeDeliverableProposal(requestText, requestOptions);
        const readyProgress = [...progress, t("command.ai_progress_ready")];
        setProgressLines(readyProgress);
        finalizeConversationEntry(pendingConversationId, {
          role: "assistant",
          title: t("command.ai_open_proposal"),
          text: t("command.ai_progress_ready"),
          detailLines: readyProgress
        });
      } catch (err) {
        const reason = (err instanceof Error ? err.message : String(err)).trim() || "Unknown error";
        const errorMessage = t("command.action_failed").replace("{reason}", reason);
        setError(errorMessage);
        setProgressLines([]);
        finalizeConversationEntry(pendingConversationId, {
          role: "error",
          text: errorMessage
        });
      } finally {
        setIsAnalyzing(false);
      }
      return;
    }
    if (activeQuickAction?.proposalKind === "integrated" && onOpenNodeIntegratedPlanProposal) {
      const progress = [
        t("command.ai_progress_understand"),
        t("command.ai_progress_scan"),
        t("command.ai_progress_plan")
      ];
      const pendingConversationId = beginConversationTurn(
        requestText,
        primaryBusyLabel,
        progress,
        sendableDraftAttachments.map(snapshotAiCommandAttachment)
      );
      setProgressLines(progress);
      setIsAnalyzing(true);
      try {
        await onOpenNodeIntegratedPlanProposal(requestText, requestOptions);
        const readyProgress = [...progress, t("command.ai_progress_ready")];
        setProgressLines(readyProgress);
        finalizeConversationEntry(pendingConversationId, {
          role: "assistant",
          title: t("command.ai_open_proposal"),
          text: t("command.ai_progress_ready"),
          detailLines: readyProgress
        });
      } catch (err) {
        const reason = (err instanceof Error ? err.message : String(err)).trim() || "Unknown error";
        const errorMessage = t("command.action_failed").replace("{reason}", reason);
        setError(errorMessage);
        setProgressLines([]);
        finalizeConversationEntry(pendingConversationId, {
          role: "error",
          text: errorMessage
        });
      } finally {
        setIsAnalyzing(false);
      }
      return;
    }
    if (resolvedAssistantMode === "ask" && onAskNode) {
      const progress = [
        "Understanding request",
        "Reading node context",
        "Preparing answer"
      ];
      const pendingConversationId = beginConversationTurn(
        requestText,
        primaryBusyLabel,
        progress,
        sendableDraftAttachments.map(snapshotAiCommandAttachment)
      );
      setProgressLines(progress);
      setIsAnalyzing(true);
      try {
        const response = await onAskNode(requestText, requestOptions);
        setNodeResponse(response);
        const readyProgress = [...progress, "Answer ready"];
        setProgressLines(readyProgress);
        finalizeConversationEntry(pendingConversationId, {
          role: "assistant",
          title: response.title ?? t("command.ai_answer_title"),
          text: response.answer.trim() || t("command.ai_progress_ready"),
          sourceLabels: response.sourceLabels
        });
      } catch (err) {
        const reason = (err instanceof Error ? err.message : String(err)).trim() || "Unknown error";
        const errorMessage = t("command.action_failed").replace("{reason}", reason);
        setError(errorMessage);
        setProgressLines([]);
        finalizeConversationEntry(pendingConversationId, {
          role: "error",
          text: errorMessage
        });
      } finally {
        setIsAnalyzing(false);
      }
      return;
    }
    const progress = [
      t("command.ai_progress_understand"),
      t("command.ai_progress_scan"),
      documentReview?.open ? t("command.ai_progress_review_plan") : t("command.ai_progress_plan")
    ];
    const pendingConversationId = beginConversationTurn(
      requestText,
      primaryBusyLabel,
      progress,
      sendableDraftAttachments.map(snapshotAiCommandAttachment)
    );
    setProgressLines(progress);
    setIsAnalyzing(true);
    try {
      const analyzedPlan = await onAnalyze(requestText, requestOptions);
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
      if (shouldAutoExecuteSimplePlan(nextPlan)) {
        setError(null);
        setIsExecuting(true);
        const executionProgress = [
          ...progress,
          nextPlan.actionId === "wbs_from_document" ? t("command.ai_progress_review") : t("command.ai_progress_execute")
        ];
        setProgressLines(executionProgress);
        try {
          await onExecute(nextPlan);
          const finishedProgress = [
            ...executionProgress,
            nextPlan.actionId === "wbs_from_document" ? t("command.ai_progress_review_ready") : t("command.ai_progress_done")
          ];
          setProgressLines(finishedProgress);
          finalizeConversationEntry(pendingConversationId, {
            role: "assistant",
            title: nextPlan.actionId === "wbs_from_document" ? t("command.ai_review_title") : t("command.ai_plan_title"),
            text: nextPlan.reason || finishedProgress[finishedProgress.length - 1] || t("command.ai_progress_done"),
            detailLines:
              nextPlan.steps.length > 0 || nextPlan.previewChanges.length > 0
                ? [...nextPlan.steps, ...nextPlan.previewChanges]
                : finishedProgress
          });
        } catch (err) {
          const reason = (err instanceof Error ? err.message : String(err)).trim() || "Unknown error";
          const errorMessage = t("command.action_failed").replace("{reason}", reason);
          setError(errorMessage);
          finalizeConversationEntry(pendingConversationId, {
            role: "error",
            text: errorMessage
          });
        } finally {
          setIsExecuting(false);
        }
      } else if (simpleMode && !nextPlan.actionId) {
        const errorMessage = nextPlan.reason || t("command.ai_no_confirm");
        setError(errorMessage);
        finalizeConversationEntry(pendingConversationId, {
          role: "error",
          text: errorMessage,
          detailLines: nextPlan.steps
        });
      } else {
        const readyProgress = [...progress, t("command.ai_progress_ready")];
        setProgressLines(readyProgress);
        finalizeConversationEntry(pendingConversationId, {
          role: "insight",
          title: t("command.ai_plan_title"),
          text: nextPlan.reason || t("command.ai_progress_ready"),
          detailLines:
            nextPlan.steps.length > 0 || nextPlan.previewChanges.length > 0
              ? [...nextPlan.steps, ...nextPlan.previewChanges]
              : readyProgress
        });
      }
    } catch (err) {
      const reason = (err instanceof Error ? err.message : String(err)).trim() || "Unknown error";
      const errorMessage = t("command.action_failed").replace("{reason}", reason);
      setError(errorMessage);
      setProgressLines([]);
      finalizeConversationEntry(pendingConversationId, {
        role: "error",
        text: errorMessage
      });
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
    const pendingConversationId = appendConversationStatus(t("command.ai_progress_execute"), plan.steps, "insight");
    setError(null);
    setIsExecuting(true);
    setProgressLines((prev) => [...prev, t("command.ai_progress_execute")]);
    try {
      await onExecute(plan);
      setProgressLines((prev) => [...prev, t("command.ai_progress_done")]);
      finalizeConversationEntry(pendingConversationId, {
        role: "assistant",
        title: t("command.ai_plan_title"),
        text: plan.reason || t("command.ai_progress_done"),
        detailLines: plan.steps.length > 0 || plan.previewChanges.length > 0 ? [...plan.steps, ...plan.previewChanges] : [t("command.ai_progress_done")]
      });
    } catch (err) {
      const reason = (err instanceof Error ? err.message : String(err)).trim() || "Unknown error";
      const errorMessage = t("command.action_failed").replace("{reason}", reason);
      setError(errorMessage);
      finalizeConversationEntry(pendingConversationId, {
        role: "error",
        text: errorMessage
      });
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
    const clean = commandText.trim() || lastSubmittedCommandText.trim();
    if (!clean || !nodeResponse || isExecuting || isAnalyzing) return;
    const answerText = nodeResponseDraft.trim().length > 0 ? nodeResponseDraft : nodeResponse.answer;
    if (!answerText.trim()) return;
    const pendingConversationId = appendConversationStatus(t("command.ai_progress_plan"), [t("command.ai_progress_plan")], "insight");
    setError(null);
    setIsExecuting(true);
    setProgressLines((prev) => [...prev, t("command.ai_progress_plan")]);
    try {
      if (activeSurface === "workarea" && onApplyNodePlan) {
        await onApplyNodePlan(clean, answerText, {
          selectedDocumentIds: normalizedSelectedDocumentIds,
          actionHint: activeQuickAction?.actionHint ?? null,
          attachments: sendableDraftAttachments
        });
        setProgressLines((prev) => [...prev, t("command.ai_progress_ready")]);
        finalizeConversationEntry(pendingConversationId, {
          role: "assistant",
          title: t("command.ai_answer_title"),
          text: t("command.ai_progress_ready")
        });
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
        actionHint: activeQuickAction?.actionHint ?? null,
        attachments: sendableDraftAttachments
      });
      setPlan(nextPlan);
      if (simpleMode && nextPlan.actionId) {
        setProgressLines((prev) => [...prev, t("command.ai_progress_execute")]);
        await onExecute(nextPlan);
        setProgressLines((prev) => [...prev, t("command.ai_progress_done")]);
        finalizeConversationEntry(pendingConversationId, {
          role: "assistant",
          title: t("command.ai_plan_title"),
          text: nextPlan.reason || t("command.ai_progress_done"),
          detailLines: nextPlan.steps.length > 0 || nextPlan.previewChanges.length > 0 ? [...nextPlan.steps, ...nextPlan.previewChanges] : [t("command.ai_progress_done")]
        });
      } else if (simpleMode && !nextPlan.actionId) {
        const errorMessage = nextPlan.reason || t("command.ai_no_confirm");
        setError(errorMessage);
        finalizeConversationEntry(pendingConversationId, {
          role: "error",
          text: errorMessage
        });
      } else {
        setProgressLines((prev) => [...prev, t("command.ai_progress_ready")]);
        finalizeConversationEntry(pendingConversationId, {
          role: "insight",
          title: t("command.ai_plan_title"),
          text: nextPlan.reason || t("command.ai_progress_ready"),
          detailLines: nextPlan.steps.length > 0 || nextPlan.previewChanges.length > 0 ? [...nextPlan.steps, ...nextPlan.previewChanges] : [t("command.ai_progress_ready")]
        });
      }
    } catch (err) {
      const reason = (err instanceof Error ? err.message : String(err)).trim() || "Unknown error";
      const errorMessage = t("command.action_failed").replace("{reason}", reason);
      setError(errorMessage);
      finalizeConversationEntry(pendingConversationId, {
        role: "error",
        text: errorMessage
      });
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
    const canNavigateHistory = filteredRecentCommands.length > 0;
    if (canNavigateHistory && event.key === "ArrowDown") {
      event.preventDefault();
      setHistoryOpen(true);
      setHighlightedHistoryIndex((current) =>
        current < 0 ? 0 : (current + 1) % filteredRecentCommands.length
      );
      return;
    }
    if (canNavigateHistory && event.key === "ArrowUp") {
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
      if (showHistorySuggestions && highlightedHistoryIndex >= 0 && filteredRecentCommands[highlightedHistoryIndex]) {
        selectRecentCommand(filteredRecentCommands[highlightedHistoryIndex]);
        return;
      }
      void runAnalyze();
      return;
    }
    if (event.key === "Escape" && historyOpen) {
      event.preventDefault();
      event.stopPropagation();
      closeHistoryPicker();
    }
  };

  const handleEmbeddedContextMenuCapture = (event: ReactMouseEvent<HTMLElement>) => {
    if (!compactEmbeddedMode) return;
    event.stopPropagation();
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      event.preventDefault();
      return;
    }
    if (target.closest("textarea, input, select, [contenteditable='true']")) {
      return;
    }
    event.preventDefault();
  };

  return (
    <div
      onContextMenuCapture={handleEmbeddedContextMenuCapture}
      className={
        isEmbedded
          ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,rgba(2,18,31,0.98),rgba(1,13,23,0.98))]"
          : "fixed inset-0 z-[175] flex items-start justify-center overflow-y-auto bg-[rgba(2,13,25,0.75)] px-3 py-3 backdrop-blur-sm sm:px-5 sm:py-5"
      }
    >
      <section
        className={
          isEmbedded
            ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden"
            : "ode-modal my-auto flex h-[min(54rem,calc(100vh-1.5rem))] w-full max-w-[min(88rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[28px] border border-[var(--ode-border-strong)]"
        }
      >
        {showEmbeddedHeader ? (
          <header
            className={`flex shrink-0 items-start justify-between gap-4 ${isEmbedded ? "px-5 py-4" : "border-b border-[var(--ode-border)] px-6 py-5"}`}
            onMouseDown={handleWindowHeaderMouseDown}
            onDoubleClick={handleWindowHeaderDoubleClick}
          >
            {compactEmbeddedMode ? (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <OdeTooltip label={t("command.title")} side="bottom" align="start">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(6,29,47,0.96)]">
                    <img src="/ode-logo-ui.png" alt="" className="h-5 w-5 object-contain" />
                  </span>
                </OdeTooltip>
                {nodeContext ? (
                  <OdeTooltip
                    label={
                      nodeContext.pathLabel && nodeContext.pathLabel !== nodeContext.title
                        ? `${nodeContext.title} - ${nodeContext.pathLabel}`
                        : nodeContext.title
                    }
                    side="bottom"
                    align="start"
                  >
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(7,36,57,0.4)] text-[var(--ode-text-dim)]">
                      <FolderGlyph state="filled" active />
                    </span>
                  </OdeTooltip>
                ) : null}
              </div>
            ) : (
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
            )}
            <div className="flex shrink-0 items-center gap-3" data-ode-window-drag-ignore="true">
              {showWindowControls ? (
                <WindowControls
                  t={t}
                  variant="utility"
                  isWindowMaximized={isWindowMaximized}
                  onWindowMinimize={onWindowMinimize}
                  onWindowToggleMaximize={onWindowToggleMaximize}
                  onWindowClose={onClose}
                />
              ) : minimalChrome ? null : compactEmbeddedMode ? (
                <OdeTooltip label={t("settings.cancel")} side="bottom" align="end">
                  <button type="button" className="ode-icon-btn h-9 w-9" onClick={onClose} aria-label={t("settings.cancel")}>
                    {isEmbedded ? "<" : "x"}
                  </button>
                </OdeTooltip>
              ) : (
                <button type="button" className="ode-icon-btn h-9 w-9" onClick={onClose} aria-label={t("settings.cancel")}>
                  {isEmbedded ? "<" : "x"}
                </button>
              )}
            </div>
          </header>
        ) : null}

        {simpleMode && !documentReview?.open ? null : (
          <div className={`flex shrink-0 items-center gap-2 ${isEmbedded ? "px-5 py-3" : "border-b border-[var(--ode-border)] px-6 py-4"}`}>
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
                <button
                  type="button"
                  className={`rounded-full border px-4 py-2 text-[0.78rem] uppercase tracking-[0.12em] transition ${
                    activeTab === "settings"
                      ? "border-[var(--ode-border-strong)] bg-[rgba(12,77,117,0.34)] text-[var(--ode-accent)]"
                      : "border-[var(--ode-border)] bg-[rgba(7,36,57,0.4)] text-[var(--ode-text-dim)]"
                  }`}
                  onClick={() => setActiveTab("settings")}
                >
                  {t("settings.ai_title_short")}
                </button>
              </>
            ) : null}
          </div>
        )}

        <div
          className={
            compactConversationMode
              ? `flex min-h-0 flex-1 flex-col ${isEmbedded ? "px-4 py-3" : "px-6 py-6"}`
              : `min-h-0 flex-1 overflow-y-auto ${isEmbedded ? "px-5 py-5" : "px-6 py-6"}`
          }
        >
          {activeTab === "command" ? (
            <div
              className={
                compactConversationMode
                  ? "relative min-h-0 flex-1 overflow-hidden"
                  : "space-y-4"
              }
            >
              {!compactEmbeddedMode && nodeContext && !documentReview?.open ? (
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

                  {quickAppScopes.length > 0 ? (
                    <div className="rounded-xl border border-[var(--ode-border)] bg-[rgba(5,28,46,0.52)] px-4 py-4">
                      <p className="text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                        {t("quick_apps.studio_title")}
                      </p>
                      <div className="mt-3 grid gap-3 xl:grid-cols-3">
                        {quickAppScopes.map((scope) => (
                          <div
                            key={`ai-quick-scope-${scope.scope}`}
                            className="rounded-xl border border-[rgba(73,140,184,0.24)] bg-[rgba(4,23,38,0.62)] px-4 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-[0.9rem] font-medium text-[var(--ode-text)]">{scope.label}</p>
                                <p className="mt-1 truncate text-[0.78rem] text-[var(--ode-text-dim)]">{scope.ownerLabel}</p>
                              </div>
                              <span className="rounded-full border border-[var(--ode-border)] px-2.5 py-1 text-[0.72rem] text-[var(--ode-text-dim)]">
                                {scope.itemCount}
                              </span>
                            </div>
                            <p className="mt-3 text-[0.8rem] text-[var(--ode-text-muted)]">
                                {scope.groundedCount > 0
                                  ? t("quick_apps.ai_grounded_count", {
                                      count: scope.groundedCount
                                    })
                                  : t("quick_apps.ai_metadata_only")}
                            </p>
                            {scope.itemLabels.length > 0 ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {scope.itemLabels.slice(0, 4).map((label) => (
                                  <span
                                    key={`${scope.scope}-${label}`}
                                    className="rounded-full border border-[rgba(73,140,184,0.24)] bg-[rgba(7,33,52,0.8)] px-2.5 py-1 text-[0.74rem] text-[var(--ode-text-dim)]"
                                  >
                                    {label}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}

              {compactConversationMode ? (
                <div
                  ref={conversationScrollRef}
                  className="h-full min-h-0 overflow-y-auto overscroll-contain pr-1"
                  onScroll={handleConversationScroll}
                >
                  <div className="flex min-h-full flex-col justify-end">
                    {conversationEntries.length > 0 ? (
                      <div className="flex flex-col gap-2 pt-1" style={compactConversationBottomStyle}>
                        {conversationEntries.map((entry) => {
                          const isUser = entry.role === "user";
                          const isErrorEntry = entry.role === "error";
                          const isInsightEntry = entry.role === "insight";
                          const bubbleClass = isUser
                            ? "border-[rgba(68,162,214,0.34)] bg-[linear-gradient(180deg,rgba(9,60,92,0.9),rgba(6,37,58,0.96))] text-[var(--ode-text)]"
                            : isErrorEntry
                              ? "border-[rgba(255,145,145,0.24)] bg-[rgba(66,20,25,0.72)] text-[var(--ode-text)]"
                              : isInsightEntry
                                ? "border-[rgba(73,140,184,0.24)] bg-[rgba(5,28,46,0.62)] text-[var(--ode-text)]"
                                : "border-[rgba(73,140,184,0.26)] bg-[rgba(4,24,40,0.72)] text-[var(--ode-text)]";

                          return (
                            <div key={entry.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                              <article className={`max-w-[90%] rounded-[20px] border px-3.5 py-2 shadow-[0_10px_22px_rgba(0,0,0,0.14)] ${bubbleClass}`}>
                                {entry.title && !compactConversationMode ? (
                                  <p className="mb-1 text-[0.76rem] font-semibold uppercase tracking-[0.12em] text-[var(--ode-text-dim)]">
                                    {entry.title}
                                  </p>
                                ) : null}
                                <div className="flex items-start gap-2">
                                  {entry.pending ? (
                                    <span className="mt-1 inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" />
                                  ) : null}
                              <p className="min-w-0 whitespace-pre-wrap text-[0.95rem] leading-[1.5]">{entry.text}</p>
                                </div>
                                {entry.attachments.length > 0 ? (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {entry.attachments.map((attachment) => (
                                      <span
                                        key={`${entry.id}-attachment-${attachment.id}`}
                                        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--ode-border)] bg-[rgba(4,24,40,0.52)] px-2.5 py-1 text-[0.72rem] text-[var(--ode-text-dim)]"
                                      >
                                        {attachment.kind === "image" ? <ImageGlyphSmall /> : <FileGlyphSmall />}
                                        <span className="max-w-[10rem] truncate">{attachment.name}</span>
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                                {entry.detailLines.length > 0 ? (
                                  entry.pending ? (
                                    <p className="mt-2 max-w-[44rem] text-[0.82rem] leading-[1.5] text-[var(--ode-text-dim)]">
                                      {entry.detailLines.join(" / ")}
                                    </p>
                                  ) : (
                                    <ul className="mt-2 space-y-1 text-[0.82rem] text-[var(--ode-text-dim)]">
                                      {entry.detailLines.map((line, index) => (
                                        <li key={`${entry.id}-detail-${index}`}>{line}</li>
                                      ))}
                                    </ul>
                                  )
                                ) : null}
                                {entry.sourceLabels.length > 0 ? (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {entry.sourceLabels.map((label) => (
                                      <span
                                        key={`${entry.id}-source-${label}`}
                                        className="rounded-full border border-[var(--ode-border)] bg-[rgba(4,24,40,0.52)] px-2.5 py-1 text-[0.72rem] text-[var(--ode-text-dim)]"
                                      >
                                        {label}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </article>
                            </div>
                          );
                        })}

                        {nodeResponse && activeSurface === "workarea" && onApplyNodePlan ? (
                          <div className="flex justify-start">
                            <div className="max-w-[90%] rounded-[20px] border border-[rgba(73,140,184,0.24)] bg-[rgba(5,28,46,0.62)] px-3.5 py-2">
                              <div className="flex flex-wrap items-center gap-2">
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
                                    (commandText.trim().length === 0 && lastSubmittedCommandText.trim().length === 0) ||
                                    nodeResponseDraft.trim().length === 0
                                  }
                                >
                                  {isExecuting ? t("command.ai_implementing_answer") : t("command.ai_implement_answer")}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {plan && simpleMode && plan.actionId && !shouldAutoExecuteSimplePlan(plan) ? (
                          <div className="flex justify-start">
                            <div className="max-w-[90%] rounded-[20px] border border-[rgba(73,140,184,0.24)] bg-[rgba(5,28,46,0.62)] px-3.5 py-2">
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="text-[0.84rem] text-[var(--ode-text-dim)]">
                                  {plan.requiresConfirmation ? t("command.ai_confirm_needed") : t("command.ai_no_confirm")}
                                </span>
                                <button
                                  type="button"
                                  className="ode-primary-btn h-10 px-4"
                                  onClick={() => {
                                    void runExecute();
                                  }}
                                  disabled={!plan.actionId || isExecuting || isAnalyzing}
                                >
                                  {isExecuting
                                    ? reviewFirstMode
                                      ? t("command.ai_opening_review")
                                      : t("command.ai_executing")
                                    : reviewFirstMode
                                      ? t("command.ai_open_review")
                                      : t("command.ai_execute")}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div
                ref={compactEmbeddedMode ? compactComposerRef : undefined}
                onDragEnter={handleComposerDragEnter}
                onDragOver={handleComposerDragOver}
                onDragLeave={handleComposerDragLeave}
                onDrop={handleComposerDrop}
                className={
                  compactEmbeddedMode
                    ? `absolute inset-x-0 bottom-0 z-[2] -mx-4 px-4 pb-3 pt-2 backdrop-blur-[10px] ${
                        dragActive
                          ? "bg-[rgba(4,24,40,0.98)] shadow-[0_-18px_34px_rgba(0,0,0,0.22)]"
                          : "bg-[rgba(1,13,23,0.98)]"
                      }`
                    : ""
                }
              >
                <input
                  ref={attachInputRef}
                  type="file"
                  className="hidden"
                  accept={AI_ATTACHMENT_FILE_ACCEPT}
                  multiple
                  onChange={handleAttachInputChange}
                />
                {compactEmbeddedMode && attachmentPanelOpen ? (
                  <div className="mb-2 max-h-[10rem] space-y-2 overflow-y-auto rounded-[18px] bg-[rgba(4,24,40,0.62)] p-2 shadow-[inset_0_1px_0_rgba(128,226,255,0.03)]">
                    {draftAttachments.length > 0 ? (
                      draftAttachments.map((attachment) => {
                        const attachmentErrored =
                          attachment.status === "error" || attachment.status === "unsupported";
                        const attachmentBusy = attachment.status === "loading";
                        return (
                          <div
                            key={attachment.id}
                            className={`flex items-center gap-2 rounded-[14px] px-2.5 py-2 ${
                              attachmentErrored
                                ? "bg-[rgba(66,20,25,0.4)]"
                                : "bg-[rgba(6,31,49,0.56)]"
                            }`}
                          >
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(7,36,57,0.58)] text-[var(--ode-accent)]">
                              {attachmentBusy ? (
                                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              ) : attachment.kind === "image" ? (
                                <ImageGlyphSmall />
                              ) : (
                                <FileGlyphSmall />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[0.82rem] font-medium text-[var(--ode-text)]">
                                {attachment.name}
                              </span>
                              <span
                                className={`block truncate text-[0.72rem] ${
                                  attachmentErrored ? "text-[#ffb8b8]" : "text-[var(--ode-text-dim)]"
                                }`}
                              >
                                {attachmentErrored
                                  ? (attachment.error ?? t("command.ai_attachment_unreadable"))
                                  : formatAiCommandAttachmentSize(attachment.sizeBytes)}
                              </span>
                            </span>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(4,24,40,0.52)] text-[var(--ode-text-dim)] transition hover:bg-[rgba(8,43,67,0.82)] hover:text-[var(--ode-text)]"
                              onClick={() => removeDraftAttachment(attachment.id)}
                              aria-label={t("command.ai_attachment_remove")}
                            >
                              <TrashGlyphSmall />
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-[14px] bg-[rgba(6,31,49,0.56)] px-3 py-3 text-[0.82rem] text-[var(--ode-text-dim)]">
                        {t("command.ai_attachment_empty_state")}
                      </div>
                    )}
                  </div>
                ) : null}
                <div className={`flex ${compactEmbeddedMode ? "flex-col gap-1.5" : "flex-wrap items-center gap-2"}`}>
                  <div className="relative min-w-[220px] flex-1">
                    <textarea
                      ref={inputRef}
                      className={`ode-input w-full rounded-xl px-4 py-3 text-[1rem] leading-6 ${
                        compactEmbeddedMode
                          ? "min-h-[4.35rem] max-h-[10rem] resize-none overflow-y-auto rounded-[20px] bg-[rgba(5,28,46,0.58)] shadow-[inset_0_1px_0_rgba(128,226,255,0.04)] focus:shadow-[0_0_0_1px_rgba(95,220,255,0.2)]"
                          : "min-h-[3.9rem] resize-y"
                      }`}
                      value={commandText}
                      placeholder={commandInputPlaceholder}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setCommandText(nextValue);
                        clearPlanPreview();
                      }}
                      onFocus={() => {
                        cancelHistoryClose();
                      }}
                      onBlur={scheduleHistoryClose}
                      onKeyDown={onInputKeyDown}
                      onPaste={handleTextareaPaste}
                    />
                    {!compactEmbeddedMode && (
                      <>
                        <div className="mt-2 flex items-center justify-start">
                          <button
                            type="button"
                            className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${
                              historyOpen
                                ? "border-[var(--ode-border-strong)] bg-[rgba(8,43,67,0.92)] text-[var(--ode-text)]"
                                : "border-[var(--ode-border)] bg-[rgba(5,28,46,0.58)] text-[var(--ode-text-dim)] hover:border-[var(--ode-border-strong)] hover:bg-[rgba(8,43,67,0.72)] hover:text-[var(--ode-text)]"
                            }`}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              cancelHistoryClose();
                            }}
                            onClick={() => {
                              if (historyOpen) {
                                closeHistoryPicker();
                                return;
                              }
                              openHistoryPicker();
                            }}
                            aria-label={t("command.ai_history")}
                            aria-expanded={historyOpen}
                          >
                            <ClockGlyphSmall />
                            {recentCommands.length > 0 ? (
                              <span className="absolute -right-1 -top-1 inline-flex min-h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-[var(--ode-accent)] px-1 text-[0.65rem] font-semibold leading-none text-[rgba(2,18,31,0.95)]">
                                {recentCommands.length}
                              </span>
                            ) : null}
                          </button>
                        </div>
                        {historyOpen ? (
                          <div
                            className="absolute left-0 top-[calc(100%+0.45rem)] z-[4] w-full max-w-[34rem] rounded-xl border border-[var(--ode-border-strong)] bg-[rgba(4,24,40,0.98)] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.35)]"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              cancelHistoryClose();
                            }}
                          >
                            <div className="mb-2 flex items-center gap-2 px-1">
                              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(7,36,57,0.4)] text-[var(--ode-text-dim)]">
                                <ClockGlyphSmall />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="text-[0.74rem] uppercase tracking-[0.12em] text-[var(--ode-text-dim)]">
                                  {t("command.ai_history")}
                                </div>
                                <div className="text-[0.74rem] text-[var(--ode-text-muted)]">
                                  {selectedHistoryCommands.length > 0
                                    ? t("command.ai_history_selected_count", { count: selectedHistoryCommands.length })
                                    : t("command.ai_recent_hint")}
                                </div>
                              </div>
                              {filteredRecentCommands.length > 0 ? (
                                <button
                                  type="button"
                                  className="rounded-md px-2 py-1 text-[0.72rem] font-medium text-[var(--ode-text-dim)] transition hover:bg-[rgba(8,43,67,0.42)] hover:text-[var(--ode-text)]"
                                  onClick={toggleSelectAllFilteredHistory}
                                >
                                  {allFilteredHistorySelected
                                    ? t("command.ai_history_clear_selection")
                                    : t("command.ai_history_select_all")}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(5,28,46,0.58)] text-[var(--ode-text-dim)] transition hover:bg-[rgba(66,20,25,0.42)] hover:text-[#ffd5d5] disabled:cursor-not-allowed disabled:opacity-40"
                                onClick={deleteSelectedHistoryCommands}
                                disabled={selectedHistoryCommands.length === 0}
                                aria-label={t("command.ai_history_delete_selected")}
                              >
                                <TrashGlyphSmall />
                              </button>
                            </div>
                            {filteredRecentCommands.length > 0 ? (
                              <div className="max-h-[16rem] space-y-1 overflow-y-auto pr-1">
                                {filteredRecentCommands.map((recentCommand, index) => {
                                  const isSelected = selectedHistoryCommandSet.has(recentCommand);
                                  const historyEntry = describeHistoryCommand(recentCommand);
                                  return (
                                    <div
                                      key={`recent-command-${recentCommand}`}
                                      className={`flex items-start gap-2 rounded-lg border px-2 py-2 transition ${
                                        index === highlightedHistoryIndex
                                          ? "border-[var(--ode-border-strong)] bg-[rgba(12,77,117,0.34)]"
                                          : isSelected
                                            ? "border-[rgba(73,140,184,0.34)] bg-[rgba(8,43,67,0.34)]"
                                            : "border-transparent bg-[rgba(6,31,49,0.42)]"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[var(--ode-accent)]"
                                        checked={isSelected}
                                        onChange={() => toggleHistoryCommandSelection(recentCommand)}
                                        aria-label={t("command.ai_history_select_item")}
                                      />
                                      <button
                                        type="button"
                                        className="min-w-0 flex-1 text-left transition hover:text-[var(--ode-text)]"
                                        onMouseEnter={() => setHighlightedHistoryIndex(index)}
                                        onClick={() => selectRecentCommand(recentCommand)}
                                      >
                                        <p className="whitespace-pre-wrap break-words text-[0.92rem] font-medium leading-5 text-[var(--ode-text)]">
                                          {historyEntry.title}
                                        </p>
                                        {historyEntry.detail ? (
                                          <p className="mt-1 whitespace-pre-wrap break-words text-[0.8rem] leading-5 text-[var(--ode-text-dim)]">
                                            {historyEntry.detail}
                                          </p>
                                        ) : null}
                                      </button>
                                      <button
                                        type="button"
                                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(5,28,46,0.52)] text-[var(--ode-text-dim)] transition hover:bg-[rgba(66,20,25,0.42)] hover:text-[#ffd5d5]"
                                        onClick={() => deleteHistoryCommand(recentCommand)}
                                        aria-label={t("command.ai_history_delete_one")}
                                      >
                                        <TrashGlyphSmall />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="rounded-lg bg-[rgba(6,31,49,0.42)] px-3 py-3 text-[0.9rem] text-[var(--ode-text-muted)]">
                                {t("command.ai_history_empty")}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </>
                    )}
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
                {compactEmbeddedMode ? (
                  <div className="relative flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className={`${compactUtilityIconButtonClass} relative ${
                          historyOpen ? "bg-[rgba(8,43,67,0.92)] text-[var(--ode-text)]" : ""
                        }`}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          cancelHistoryClose();
                        }}
                        onClick={() => {
                          if (historyOpen) {
                            closeHistoryPicker();
                            return;
                          }
                          openHistoryPicker();
                        }}
                        aria-label={t("command.ai_history")}
                        aria-expanded={historyOpen}
                      >
                        <ClockGlyphSmall />
                        {recentCommands.length > 0 ? (
                          <span className="absolute -right-1 -top-1 inline-flex min-h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-[var(--ode-accent)] px-1 text-[0.65rem] font-semibold leading-none text-[rgba(2,18,31,0.95)]">
                            {recentCommands.length}
                          </span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        className={`${compactUtilityButtonClass} gap-1.5 px-3 text-[0.8rem] font-medium ${
                          canStartNewChat ? "text-[var(--ode-text)]" : "text-[var(--ode-text-dim)]"
                        }`}
                        onMouseDown={(event) => {
                          event.preventDefault();
                        }}
                        onClick={startNewChat}
                        disabled={!canStartNewChat}
                        aria-label={t("command.ai_new_chat")}
                      >
                        <PlusGlyphSmall />
                        <span>{t("command.ai_new_chat")}</span>
                      </button>
                    </div>
                    <div className="ml-auto flex items-center gap-1.5">
                      <OdeTooltip label={t("settings.api_setup")} side="top" align="end">
                        <button
                          type="button"
                          className={compactUtilityIconButtonClass}
                          onMouseDown={(event) => {
                            event.preventDefault();
                          }}
                          onClick={() => setApiSetupOpen(true)}
                          aria-label={t("settings.api_setup")}
                        >
                          <SparkGlyphSmall />
                        </button>
                      </OdeTooltip>
                      <OdeTooltip label={compactAttachmentButtonLabel} side="top" align="end">
                        <button
                          type="button"
                          className={`${compactUtilityIconButtonClass} relative ${
                            attachmentPanelOpen || draftAttachmentCount > 0
                              ? "bg-[rgba(8,43,67,0.92)] text-[var(--ode-text)]"
                              : ""
                          }`}
                          onMouseDown={(event) => {
                            event.preventDefault();
                          }}
                          onClick={handleAttachmentSummaryButton}
                          aria-label={compactAttachmentButtonLabel}
                        >
                          <FileGlyphSmall />
                          {draftAttachmentCount > 0 ? (
                            <span className="absolute -right-1 -top-1 inline-flex min-h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-[var(--ode-accent)] px-1 text-[0.65rem] font-semibold leading-none text-[rgba(2,18,31,0.95)]">
                              {draftAttachmentCount}
                            </span>
                          ) : null}
                        </button>
                      </OdeTooltip>
                      <OdeTooltip label={t("command.ai_attachment_upload")} side="top" align="end">
                        <button
                          type="button"
                          className={compactUtilityIconButtonClass}
                          onMouseDown={(event) => {
                            event.preventDefault();
                          }}
                          onClick={handleAttachButton}
                          disabled={isAttachPickerBusy}
                          aria-label={t("command.ai_attachment_upload")}
                        >
                          {isAttachPickerBusy ? (
                            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          ) : (
                            <UploadGlyphSmall />
                          )}
                        </button>
                      </OdeTooltip>
                      <OdeTooltip label={isAnalyzing ? primaryBusyLabel : primaryActionLabel} side="top" align="end">
                        <button
                          type="button"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(180deg,rgba(18,113,164,0.98),rgba(7,59,90,0.98))] text-white shadow-[0_12px_28px_rgba(9,69,105,0.34)] transition hover:-translate-y-[1px] hover:brightness-[1.04] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:brightness-100"
                          onMouseDown={(event) => {
                            event.preventDefault();
                          }}
                          onClick={() => {
                            void runAnalyze();
                          }}
                          disabled={isAnalyzing || isExecuting || !canSubmitPrompt}
                          aria-label={isAnalyzing ? primaryBusyLabel : primaryActionLabel}
                        >
                          {isAnalyzing ? (
                            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          ) : (
                            <ArrowUpGlyphSmall />
                          )}
                        </button>
                      </OdeTooltip>
                    </div>
                    {historyOpen ? (
                      <div
                        className="absolute bottom-[calc(100%+0.55rem)] left-0 z-[4] w-full max-w-[34rem] rounded-xl border border-[var(--ode-border-strong)] bg-[rgba(4,24,40,0.98)] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.35)]"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          cancelHistoryClose();
                        }}
                      >
                        <div className="mb-2 flex items-start gap-2 px-1">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(7,36,57,0.4)] text-[var(--ode-text-dim)]">
                            <ClockGlyphSmall />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-[0.74rem] uppercase tracking-[0.12em] text-[var(--ode-text-dim)]">
                              {t("command.ai_history")}
                            </div>
                            <div className="text-[0.74rem] text-[var(--ode-text-muted)]">
                              {selectedHistoryCommands.length > 0
                                ? t("command.ai_history_selected_count", { count: selectedHistoryCommands.length })
                                : t("command.ai_recent_hint")}
                            </div>
                          </div>
                          {filteredRecentCommands.length > 0 ? (
                            <button
                              type="button"
                              className="rounded-md px-2 py-1 text-[0.72rem] font-medium text-[var(--ode-text-dim)] transition hover:bg-[rgba(8,43,67,0.42)] hover:text-[var(--ode-text)]"
                              onClick={toggleSelectAllFilteredHistory}
                            >
                              {allFilteredHistorySelected
                                ? t("command.ai_history_clear_selection")
                                : t("command.ai_history_select_all")}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.72rem] font-medium text-[var(--ode-text-dim)] transition hover:bg-[rgba(66,20,25,0.42)] hover:text-[#ffd5d5] disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={deleteSelectedHistoryCommands}
                            disabled={selectedHistoryCommands.length === 0}
                          >
                            <TrashGlyphSmall />
                            <span>{t("command.ai_history_delete_selected")}</span>
                          </button>
                        </div>
                        {filteredRecentCommands.length > 0 ? (
                          <div className="max-h-[16rem] space-y-1 overflow-y-auto pr-1">
                            {filteredRecentCommands.map((recentCommand, index) => {
                              const isSelected = selectedHistoryCommandSet.has(recentCommand);
                              const historyEntry = describeHistoryCommand(recentCommand);
                              return (
                                <div
                                  key={`recent-command-${recentCommand}`}
                                  className={`flex items-start gap-2 rounded-lg border px-2 py-2 transition ${
                                    index === highlightedHistoryIndex
                                      ? "border-[var(--ode-border-strong)] bg-[rgba(12,77,117,0.34)]"
                                      : isSelected
                                        ? "border-[rgba(73,140,184,0.34)] bg-[rgba(8,43,67,0.34)]"
                                        : "border-transparent bg-[rgba(6,31,49,0.42)]"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[var(--ode-accent)]"
                                    checked={isSelected}
                                    onChange={() => toggleHistoryCommandSelection(recentCommand)}
                                    aria-label={t("command.ai_history_select_item")}
                                  />
                                  <button
                                    type="button"
                                    className="min-w-0 flex-1 text-left transition hover:text-[var(--ode-text)]"
                                    onMouseEnter={() => setHighlightedHistoryIndex(index)}
                                    onClick={() => selectRecentCommand(recentCommand)}
                                  >
                                    <p className="whitespace-pre-wrap break-words text-[0.92rem] font-medium leading-5 text-[var(--ode-text)]">
                                      {historyEntry.title}
                                    </p>
                                    {historyEntry.detail ? (
                                      <p className="mt-1 whitespace-pre-wrap break-words text-[0.8rem] leading-5 text-[var(--ode-text-dim)]">
                                        {historyEntry.detail}
                                      </p>
                                    ) : null}
                                  </button>
                                  <button
                                    type="button"
                                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(5,28,46,0.52)] text-[var(--ode-text-dim)] transition hover:bg-[rgba(66,20,25,0.42)] hover:text-[#ffd5d5]"
                                    onClick={() => deleteHistoryCommand(recentCommand)}
                                    aria-label={t("command.ai_history_delete_one")}
                                  >
                                    <TrashGlyphSmall />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-lg bg-[rgba(6,31,49,0.42)] px-3 py-3 text-[0.9rem] text-[var(--ode-text-muted)]">
                            {t("command.ai_history_empty")}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="ode-primary-btn h-12 px-5"
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                    onClick={() => {
                      void runAnalyze();
                    }}
                    disabled={isAnalyzing || isExecuting || !canSubmitPrompt}
                  >
                    {isAnalyzing
                      ? primaryBusyLabel
                      : primaryActionLabel}
                  </button>
                )}
                </div>
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
              ) : error && !compactEmbeddedMode ? (
                <p className="text-[0.92rem] text-[#ffb8b8]">{error}</p>
              ) : null}

              {nodeResponse && !compactEmbeddedMode ? (
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
                          (commandText.trim().length === 0 && lastSubmittedCommandText.trim().length === 0) ||
                          nodeResponseDraft.trim().length === 0
                        }
                      >
                        {isExecuting ? t("command.ai_implementing_answer") : t("command.ai_implement_answer")}
                      </button>
                    </div>
                  </div>
                ) : null}

              {plan && !compactEmbeddedMode ? (
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
                  {simpleMode && plan.actionId && !shouldAutoExecuteSimplePlan(plan) ? (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="ode-primary-btn h-10 px-4"
                        onClick={() => {
                          void runExecute();
                        }}
                        disabled={!plan.actionId || isExecuting || isAnalyzing}
                      >
                        {isExecuting
                          ? reviewFirstMode
                            ? t("command.ai_opening_review")
                            : t("command.ai_executing")
                          : reviewFirstMode
                            ? t("command.ai_open_review")
                            : t("command.ai_execute")}
                      </button>
                    </div>
                  ) : null}
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
                  {t("settings.ai_provider_keys_title")}
                </p>
              </div>

              <div className="space-y-3">
                {providerKeys.map((entry, idx) => (
                  <div key={`command-bar-provider-${idx}`} className="flex items-center gap-2">
                    <span className="min-w-[9rem] rounded-lg border border-[var(--ode-border)] bg-[rgba(7,36,57,0.32)] px-3 py-3 text-center text-[0.78rem] font-medium text-[var(--ode-text-dim)]">
                      {entry.providerLabel}
                    </span>
                    <input
                      type="password"
                      value={entry.apiKey}
                      onChange={(event) => {
                        updateProviderKeyDraft(idx, event.target.value);
                        setSettingsMessage(null);
                      }}
                      className="ode-input h-12 w-full rounded-lg px-4 text-[0.98rem]"
                      placeholder={t("settings.ai_provider_placeholder").replace("{index}", String(idx + 1))}
                    />
                    <button
                      type="button"
                      className="ode-icon-btn h-12 w-12"
                      onClick={() => {
                        updateKeyList(providerKeys.filter((_, itemIdx) => itemIdx !== idx));
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
                  updateKeyList([...providerKeys, createEmptyStoredAiProviderKey()]);
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
                  disabled={isTestingKeys || isSavingKeys}
                >
                  {isTestingKeys ? t("settings.testing") : t("settings.test_keys")}
                </button>
                <button
                  type="button"
                  className="ode-primary-btn h-11 px-6"
                  onClick={() => {
                    void saveProviderKeys();
                  }}
                  disabled={isSavingKeys || isTestingKeys}
                >
                  {isSavingKeys ? t("settings.saving_keys") : t("settings.save")}
                </button>
              </div>
            </div>
          )}
        </div>

        {minimalChrome && compactEmbeddedMode ? null : (
          <footer className={`flex shrink-0 items-center justify-between ${isEmbedded ? "px-5 py-4" : "border-t border-[var(--ode-border)] px-6 py-5"}`}>
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
        )}
        <AiSettingsModal open={apiSetupOpen} onClose={() => setApiSetupOpen(false)} language={language} />
      </section>
    </div>
  );
}
