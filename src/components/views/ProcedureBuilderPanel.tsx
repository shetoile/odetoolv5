import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode
} from "react";
import { readText as readClipboardText, writeText as writeClipboardText } from "@tauri-apps/plugin-clipboard-manager";
import { ThemedDatePickerInput } from "@/components/inputs/ThemedDatePickerInput";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import { QuickAppIcon } from "@/components/quick-apps/QuickAppIcon";
import {
  ArrowLeftGlyphSmall,
  ArrowRightGlyphSmall,
  ArrowDownGlyphSmall,
  ArrowUpGlyphSmall,
  DatabaseFieldGlyph,
  DatabaseSectionGlyph,
  DividerGlyphSmall,
  EditGlyphSmall,
  ExportGlyphSmall,
  FileGlyphSmall,
  IndentDecreaseGlyphSmall,
  IndentIncreaseGlyphSmall,
  HeadingStyleGlyphSmall,
  ImageGlyphSmall,
  ImportGlyphSmall,
  LineSpacingGlyphSmall,
  LinkGlyphSmall,
  ListBulletsGlyphSmall,
  ListNumbersGlyphSmall,
  NodeLinkGlyphSmall,
  OpenGlyphSmall,
  PageBreakGlyphSmall,
  PlusGlyphSmall,
  QuoteGlyphSmall,
  TableGridGlyphSmall,
  TrashGlyphSmall,
  TextBoldGlyphSmall,
  TextItalicGlyphSmall,
  TextAlignCenterGlyphSmall,
  TextAlignJustifyGlyphSmall,
  TextAlignLeftGlyphSmall,
  TextAlignRightGlyphSmall
} from "@/components/Icons";
import {
  getDesktopMediaPreviewKind,
  getNodePreferredFileLocationPath,
  resolveDesktopPreviewSrc,
  resolveWindowsFileIcon
} from "@/lib/iconSupport";
import {
  NODE_NUMBER_FORMAT_PROPERTY,
  NODE_NUMBER_HIDDEN_PROPERTY,
  NODE_NUMBER_OVERRIDE_PROPERTY,
  NODE_NUMBER_SEPARATOR_PROPERTY,
  NODE_NUMBER_START_AT_PROPERTY,
  readNodeNumberHidden,
  readNodeNumberStartAt,
  type NodeNumberFormat
} from "@/lib/nodeNumbering";
import { buildScopedNumbering } from "@/features/workspace/scope";
import {
  exportProcedureTableExcel,
  getWindowsInstalledFontFamilies,
  pickWindowsProcedureTableSpreadsheetFile,
  readLocalImageDataUrl,
  readProcedureTableExcel,
  type ProcedureTableSpreadsheetPayload
} from "@/lib/nodeService";
import {
  decodeProcedureAppLinkPayload,
  encodeProcedureAppLinkPayload,
  findProcedureWorkspaceRootId,
  parseProcedureBlocks,
  parseProcedureInlineTokens
} from "@/lib/procedureDocument";
import {
  PROCEDURE_RICH_TEXT_HTML_PROPERTY,
  readProcedureRichTextHtml,
  sanitizeProcedureRichTextHtml
} from "@/lib/procedureRichText";
import { getNodeDisplayName, shouldHideNodeFromGenericUi } from "@/lib/nodeDisplay";
import {
  computeProcedurePreviewRecordValues,
  PROCEDURE_RECORDS_PROPERTY_KEY,
  buildProcedureDatabaseModel,
  buildProcedureFieldDefinition as buildSharedProcedureFieldDefinition,
  decodeProcedureRecordToken,
  decodeProcedureNodeToken,
  encodeProcedureNodeToken,
  encodeProcedureRecordToken,
  formatProcedureRecordValue as formatSharedProcedureRecordValue,
  isProcedureFieldNode as isSharedProcedureFieldNode,
  isProcedureFormulaFieldType,
  isProcedureNodeLinkFieldType,
  isProcedureOrganizationLinkFieldType,
  isProcedureRelationFieldType,
  normalizeProcedureFieldType as normalizeSharedFieldType,
  readProcedureRecords as readSharedProcedureRecords,
  type ProcedureAutomationRole,
  type ProcedureFieldDefinition,
  type ProcedureFieldType,
  type ProcedureRecord,
  type ProcedureRecordValue,
  type ProcedureTableDefinition
} from "@/lib/procedureDatabase";
import {
  getQuickAppTargetLeafName,
  getNodeQuickApps,
  resolveQuickAppLaunchTarget,
  resolveQuickAppPreferredIconKey,
  type NodeQuickAppIconKey,
  type NodeQuickAppItem
} from "@/lib/nodeQuickApps";
import { ROOT_PARENT_ID, isFileLikeNode, type AppNode, type ProjectSummary } from "@/lib/types";
import type { LanguageCode } from "@/lib/i18n";

type ProcedureFieldEntry = ProcedureFieldDefinition & {
  node: AppNode;
};

const DEFAULT_PROCEDURE_ROOT_NAMES = new Set(["database", "documentation"]);

type FieldEditorDraft = {
  label: string;
  type: ProcedureFieldType;
  placeholder: string;
  required: boolean;
  showInMasterList: boolean;
  visibilitySourceFieldId: string;
  visibilityEqualsValue: string;
  optionsText: string;
  organizationRootNodeId: string;
  relationTargetNodeId: string;
  relationDisplayFieldIds: string[];
  formulaExpression: string;
  automationRole: ProcedureAutomationRole;
};

type SectionTextAlignment = "left" | "center" | "right" | "justify";
type SectionEditorLineSpacingValue = "default" | string;

type SectionEditorCustomColorState = {
  hex: string;
  red: string;
  green: string;
  blue: string;
};

type SectionEditorTitleStyle = {
  color?: string | null;
  fontFamily?: string | null;
  fontSizePt?: number | null;
  bold?: boolean | null;
  italic?: boolean | null;
  textAlignment?: SectionTextAlignment | null;
};

type SectionEditorFormattingDefaults = {
  fontFamily: string;
  fontSizePt: number;
  textColor: string;
  bold: boolean;
  italic: boolean;
  lineSpacing: SectionEditorLineSpacingValue;
};

type SectionEditorTitleDefaults = {
  fontFamily: string;
  fontSizePt: number;
  textColor: string;
  bold: boolean;
  italic: boolean;
  textAlignment: SectionTextAlignment;
};

type SectionEditorTitleLevelDefaults = Record<ProcedureHeadingLevel, SectionEditorTitleDefaults>;
type SectionEditorHeadingStyleDefaults = Record<ProcedureHeadingLevel, SectionEditorFormattingDefaults>;

type SectionEditorActiveTableState = {
  rowIndex: number;
  rowCount: number;
  columnIndex: number;
  columnCount: number;
};

type SectionEditorDraft = {
  label: string;
  titleStyle: SectionEditorTitleStyle | null;
  numberingHidden: boolean;
  numberingFormat: NodeNumberFormat | null;
  numberingStartAt: number | null;
  textAlignment: SectionTextAlignment;
  content: string;
  richTextHtml: string | null;
};

type SectionEditorHistorySnapshot = {
  label: string;
  titleStyle: SectionEditorTitleStyle | null;
  numberingHidden: boolean;
  numberingFormat: NodeNumberFormat | null;
  numberingStartAt: number | null;
  textAlignment: SectionTextAlignment;
  content: string;
  richTextHtml: string | null;
};

type ProcedureTableViewMode = "list" | "matrix" | "pivot";

type ProcedureTableViewDraft = {
  viewMode: ProcedureTableViewMode;
  groupByFieldId: string;
  infoFieldIds: string[];
  matrixRowFieldId: string;
  matrixColumnFieldIds: string[];
  matrixColumnGroupLabel: string;
  pivotColumnFieldId: string;
};

type ProcedureNodeLinkCandidate = {
  node: AppNode;
  workspaceRootId: string | null;
  workspaceName: string;
  pathLabel: string;
  isCurrentWorkspace: boolean;
  searchText: string;
};

type ProcedureAppLinkCandidate = {
  item: NodeQuickAppItem;
  sourceNode: AppNode;
  workspaceRootId: string | null;
  workspaceName: string;
  isCurrentWorkspace: boolean;
  searchText: string;
};

type SectionWebsiteLinkState = {
  selectionStart: number;
  selectionEnd: number;
  label: string;
  href: string;
};

type SectionEditorImageOverlayState = {
  top: number;
  left: number;
  width: number;
  height: number;
  maxWidth: number;
};

type SectionEditorImageResizeSession = {
  onMouseMove: (event: MouseEvent) => void;
  onMouseUp: (event: MouseEvent) => void;
  previousCursor: string;
  previousUserSelect: string;
};

type SectionEditorFocusTarget = "label" | "content" | "panel";
type SectionEditorListKind = "unordered" | "ordered" | null;

type SerializedSectionEditorPoint = {
  path: number[];
  offset: number;
};

type SerializedSectionEditorRange = {
  start: SerializedSectionEditorPoint;
  end: SerializedSectionEditorPoint;
};

type ProcedureHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type SectionEditorBlockStyle =
  | "normal"
  | "heading1"
  | "heading2"
  | "heading3"
  | "heading4"
  | "heading5"
  | "heading6";

type SectionEditorContextMenuState =
  | {
      x: number;
      y: number;
      target: "label";
      selectionStart: number;
      selectionEnd: number;
      hasSelection: boolean;
    }
  | {
      x: number;
      y: number;
      target: "content";
      selection: SerializedSectionEditorRange | null;
      hasSelection: boolean;
      insideLink: boolean;
      insideTable: boolean;
      quoteActive: boolean;
      listKind: SectionEditorListKind;
    };

type SectionEditorContextMenuItem =
  | {
      kind: "action";
      key: string;
      label: string;
      onSelect: () => void;
      disabled?: boolean;
      danger?: boolean;
      shortcutLabel?: string | null;
    }
  | {
      kind: "separator";
      key: string;
    };

interface ProcedureBuilderPanelProps {
  language: LanguageCode;
  workspaceName: string | null;
  rootNode: AppNode | null;
  selectedNode: AppNode | null;
  canReadNode?: (nodeId: string) => boolean;
  canWriteNode?: (nodeId: string) => boolean;
  getNodeDisplayLabel?: (node: AppNode) => string;
  byParent: Map<string | null, AppNode[]>;
  scopedNumbering: Map<string, string>;
  allNodes: AppNode[];
  projects: ProjectSummary[];
  activeProjectRootId: string | null;
  onSelectNode: (nodeId: string) => void;
  onOpenLinkedNode: (nodeId: string) => Promise<void> | void;
  onOpenLinkedFile: (nodeId: string) => Promise<void> | void;
  onOpenWebsiteLink: (href: string) => Promise<void> | void;
  onLaunchLinkedApp: (item: NodeQuickAppItem) => Promise<void> | void;
  onCreateProcedureItem: (
    anchorNodeId: string,
    kind: "section" | "text" | "field" | "table" | "attachment",
    position: "after" | "inside"
  ) => Promise<string | null> | string | null;
  onAttachImagesToNode: (nodeId: string) => Promise<AppNode[]> | AppNode[];
  onAttachFilesToNode: (nodeId: string) => Promise<number> | number;
  onDeleteProcedureNode: (nodeId: string) => Promise<boolean> | boolean;
  onRenameNodeTitle: (nodeId: string, title: string) => Promise<void> | void;
  onReviewNodeFile: (nodeId: string) => void;
  onSaveNodeContent: (nodeId: string, text: string) => Promise<void> | void;
  onSaveNodeDescription: (nodeId: string, description: string | null) => Promise<void> | void;
  onSaveNodeProperties: (nodeId: string, properties: Record<string, unknown>) => Promise<void> | void;
  onMoveProcedureNode?: (nodeId: string, direction: "up" | "down") => Promise<void> | void;
  onActivateProcedureSurface: () => void;
  onOpenSurfaceContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  onOpenFieldOrderWindow?: (nodeId: string) => Promise<void> | void;
  onCloseFieldOrderWindow?: () => Promise<void> | void;
  requestedFieldEditorNodeId?: string | null;
  requestedFieldOrderNodeId?: string | null;
  requestedBlankSectionEditorNodeId?: string | null;
  onFieldEditorRequestHandled?: () => void;
  onFieldOrderRequestHandled?: () => void;
  isDedicatedFieldOrderWindow?: boolean;
}

const DEFAULT_SELECT_OPTIONS = ["Option 1", "Option 2"];
const DEFAULT_TABLE_COLUMNS = ["Column 1", "Column 2"];
const SECTION_TEXT_ALIGNMENT_PROPERTY = "odeSectionTextAlignment";
const SECTION_TITLE_COLOR_PROPERTY = "odeProcedureTitleColor";
const SECTION_TITLE_FONT_FAMILY_PROPERTY = "odeProcedureTitleFontFamily";
const SECTION_TITLE_FONT_SIZE_PT_PROPERTY = "odeProcedureTitleFontSizePt";
const SECTION_TITLE_BOLD_PROPERTY = "odeProcedureTitleBold";
const SECTION_TITLE_ITALIC_PROPERTY = "odeProcedureTitleItalic";
const SECTION_TITLE_ALIGNMENT_PROPERTY = "odeProcedureTitleTextAlignment";
const SECTION_TITLE_STYLES_PROPERTY = "odeProcedureSectionTitleStyles";
const SECTION_BODY_STYLE_PROPERTY = "odeProcedureBodyStyle";
const SECTION_BODY_HEADING_STYLES_PROPERTY = "odeProcedureBodyHeadingStyles";
const SECTION_EDITOR_LAST_TEXT_COLOR_PROPERTY = "odeProcedureEditorLastTextColor";
const PROCEDURE_MODAL_OVERLAY_CLASS =
  "fixed inset-0 z-50 flex items-center justify-center bg-[rgba(12,23,38,0.4)] px-4";
const PROCEDURE_MODAL_PANEL_CLASS =
  "ode-modal ode-document-action-modal w-full rounded-[30px] border border-[rgba(69,182,233,0.42)] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.4)]";
const PROCEDURE_MODAL_CLOSE_BUTTON_CLASS =
  "inline-flex items-center justify-center leading-none rounded-full border border-[var(--ode-border-strong)] bg-[rgba(6,34,53,0.42)] px-3 py-2 text-[0.78rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)] transition hover:border-[var(--ode-border-accent)] hover:text-[var(--ode-text)]";
const PROCEDURE_MODAL_SECONDARY_BUTTON_CLASS =
  "inline-flex items-center justify-center leading-none rounded-[18px] border border-[var(--ode-border-strong)] bg-[rgba(6,34,53,0.42)] px-4 py-3 text-[0.78rem] uppercase tracking-[0.18em] text-[var(--ode-text-dim)] transition hover:border-[var(--ode-border-accent)] hover:text-[var(--ode-text)]";
const PROCEDURE_MODAL_PRIMARY_BUTTON_CLASS =
  "ode-primary-btn inline-flex h-11 items-center justify-center leading-none px-5 text-[0.78rem] uppercase tracking-[0.18em]";
const PROCEDURE_MODAL_DANGER_BUTTON_CLASS =
  "inline-flex items-center justify-center leading-none rounded-[18px] border border-[rgba(211,127,127,0.52)] bg-[rgba(83,26,26,0.26)] px-4 py-3 text-[0.78rem] uppercase tracking-[0.18em] text-[#ffc7c7] transition hover:border-[rgba(244,157,157,0.72)] hover:text-[#fff0f0]";
const SECTION_EDITOR_MODAL_PANEL_CLASS =
  `${PROCEDURE_MODAL_PANEL_CLASS} flex w-full max-h-[min(94vh,calc(100dvh-2rem))] max-w-[min(97vw,1600px)] flex-col overflow-hidden rounded-[22px] border-[rgba(126,154,176,0.22)] bg-[linear-gradient(180deg,#102434,#0b1b29)] p-0 shadow-[0_28px_90px_rgba(0,0,0,0.42)]`;
const SECTION_EDITOR_PANEL_CARD_CLASS =
  "rounded-[16px] border border-[rgba(126,154,176,0.16)] bg-[rgba(8,27,40,0.84)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]";
const SECTION_EDITOR_INSET_PANEL_CLASS =
  "rounded-[12px] border border-[rgba(126,154,176,0.14)] bg-[rgba(7,22,34,0.88)] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]";
const SECTION_EDITOR_SECTION_LABEL_CLASS = "text-[0.62rem] uppercase tracking-[0.16em] text-[#8cb4cf]";
const SECTION_EDITOR_FIELD_LABEL_CLASS = "mb-1 text-[0.58rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]";
const SECTION_EDITOR_INPUT_CLASS =
  "h-10 w-full rounded-[12px] border border-[#d6dde6] bg-white px-3 text-[0.92rem] !text-[#0f172a] outline-none transition placeholder:text-[#64748b] focus:border-[#7dd3fc] focus:ring-2 focus:ring-[rgba(56,189,248,0.18)]";
const SECTION_EDITOR_INPUT_STYLE = {
  color: "#0f172a",
  WebkitTextFillColor: "#0f172a",
  caretColor: "#0f172a",
  opacity: 1
};
const SECTION_EDITOR_TOOLBAR_SELECT_CLASS =
  "h-9 rounded-[10px] border border-[rgba(126,154,176,0.18)] bg-[rgba(8,24,37,0.96)] px-3 text-[0.82rem] font-medium text-[#f8fafc] outline-none transition hover:border-[rgba(95,220,255,0.28)] hover:bg-[rgba(14,38,56,0.96)] focus:border-[rgba(95,220,255,0.42)] focus:ring-2 focus:ring-[rgba(95,220,255,0.22)]";
const SECTION_EDITOR_TOOLBAR_SELECT_STYLE = {
  color: "#f8fafc",
  WebkitTextFillColor: "#f8fafc",
  caretColor: "#f8fafc"
};
const SECTION_EDITOR_TOOLBAR_BUTTON_CLASS =
  "flex h-9 w-9 items-center justify-center overflow-hidden rounded-[10px] border border-[rgba(126,154,176,0.18)] bg-[rgba(8,24,37,0.96)] text-[0] text-[var(--ode-text)] shadow-none transition duration-150 hover:border-[rgba(95,220,255,0.28)] hover:bg-[rgba(14,38,56,0.96)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(95,220,255,0.22)] disabled:cursor-not-allowed disabled:opacity-60 [&>span]:sr-only [&_svg]:!h-4 [&_svg]:!w-4";
const SECTION_EDITOR_TOOLBAR_BUTTON_SMALL_CLASS =
  "flex h-8 w-8 items-center justify-center overflow-hidden rounded-[9px] border border-[rgba(126,154,176,0.18)] bg-[rgba(8,24,37,0.96)] text-[0] text-[var(--ode-text)] shadow-none transition duration-150 hover:border-[rgba(95,220,255,0.28)] hover:bg-[rgba(14,38,56,0.96)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(95,220,255,0.22)] disabled:cursor-not-allowed disabled:opacity-60 [&>span]:sr-only [&_svg]:!h-4 [&_svg]:!w-4";
const SECTION_EDITOR_DEFAULT_TEXT_COLOR = "#111827";
const SECTION_EDITOR_DEFAULT_TITLE_TEXT_COLOR = "#29afe3";
const SECTION_EDITOR_DEFAULT_PICKER_TEXT_COLOR = "#29afe3";
const SECTION_EDITOR_DEFAULT_TITLE_FONT_SIZE_PT = 24;
const SECTION_EDITOR_RECENT_TEXT_COLOR_STORAGE_KEY = "odetool.procedureEditor.recentTextColors.v1";
const SECTION_EDITOR_HISTORY_LIMIT = 150;
const SECTION_EDITOR_MAX_RECENT_TEXT_COLORS = 10;
const SECTION_EDITOR_THEME_TEXT_COLORS: Array<{ label: string; value: string }> = [
  { label: "ODE Ink", value: "#051622" },
  { label: "Midnight Harbor", value: "#0a2438" },
  { label: "Deep Channel", value: "#0f3550" },
  { label: "Steel Current", value: "#174b6d" },
  { label: "Brand Blue", value: "#29afe3" },
  { label: "Signal Blue", value: "#177fb0" },
  { label: "Slate Mist", value: "#4a6c82" },
  { label: "Calm Steel", value: "#6b879c" }
];
const SECTION_EDITOR_SOLID_TEXT_COLORS: Array<{ label: string; value: string }> = [
  { label: "Black", value: "#111827" },
  { label: "Slate", value: "#475569" },
  { label: "Gray", value: "#6b7280" },
  { label: "Brown", value: "#7c5a3c" },
  { label: "Red", value: "#dc2626" },
  { label: "Rose", value: "#e11d48" },
  { label: "Orange", value: "#ea580c" },
  { label: "Amber", value: "#d97706" },
  { label: "Yellow", value: "#ca8a04" },
  { label: "Lime", value: "#65a30d" },
  { label: "Green", value: "#16a34a" },
  { label: "Emerald", value: "#059669" },
  { label: "Teal", value: "#0f766e" },
  { label: "Cyan", value: "#0891b2" },
  { label: "Blue", value: "#2563eb" },
  { label: "Indigo", value: "#4f46e5" },
  { label: "Violet", value: "#7c3aed" },
  { label: "Pink", value: "#db2777" }
];
const SECTION_EDITOR_DEFAULT_FONT_FAMILY = "Calibri";
const SECTION_EDITOR_DEFAULT_FONT_STACK = `"${SECTION_EDITOR_DEFAULT_FONT_FAMILY}", "Segoe UI", Arial, sans-serif`;
const SECTION_EDITOR_DEFAULT_FONT_SIZE_PT = 12;
const SECTION_EDITOR_FONT_SIZE_OPTIONS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];
const SECTION_EDITOR_LINE_SPACING_PRESET_OPTIONS: Array<{
  value: SectionEditorLineSpacingValue;
  label: string;
}> = [
  { value: "default", label: "1" },
  { value: "1.15", label: "1.15" },
  { value: "1.5", label: "1.5" },
  { value: "2", label: "2" }
];
const SECTION_EDITOR_INDENT_STEP_PX = 24;
const SECTION_EDITOR_MAX_INDENT_PX = 240;
const SECTION_EDITOR_INSERT_TABLE_GRID_ROWS = 8;
const SECTION_EDITOR_INSERT_TABLE_GRID_COLUMNS = 10;
const SECTION_EDITOR_PREFERRED_FONT_FAMILIES = [
  SECTION_EDITOR_DEFAULT_FONT_FAMILY,
  "Arial",
  "Cambria",
  "Consolas",
  "Georgia",
  "Segoe UI",
  "Tahoma",
  "Times New Roman",
  "Trebuchet MS",
  "Verdana"
];
const SECTION_EDITOR_DOCUMENT_SURFACE_CLASS =
  "min-h-[clamp(320px,48vh,640px)] w-full max-w-none rounded-[4px] border border-[#d6dde6] bg-white px-5 py-7 shadow-[0_18px_46px_rgba(15,23,42,0.16)] outline-none md:px-8 md:py-10 xl:px-10 [font-family:var(--ode-procedure-body-font-family)] [font-size:var(--ode-procedure-body-font-size)] [line-height:var(--ode-procedure-body-line-height)] [color:var(--ode-procedure-body-color)] [font-weight:var(--ode-procedure-body-font-weight)] [font-style:var(--ode-procedure-body-font-style)] [&_a]:text-[#2563eb] [&_a]:underline [&_a]:decoration-[rgba(37,99,235,0.36)] [&_blockquote]:my-5 [&_blockquote]:rounded-[4px] [&_blockquote]:border-l-4 [&_blockquote]:border-[#cbd5e1] [&_blockquote]:bg-[#f8fafc] [&_blockquote]:px-5 [&_blockquote]:py-4 [&_blockquote]:text-[#334155] [&_h1]:my-4 [&_h1]:tracking-[-0.04em] [&_h1]:[font-family:var(--ode-procedure-heading-1-font-family)] [&_h1]:[font-size:var(--ode-procedure-heading-1-font-size)] [&_h1]:[line-height:var(--ode-procedure-heading-1-line-height)] [&_h1]:[color:var(--ode-procedure-heading-1-color)] [&_h1]:[font-weight:var(--ode-procedure-heading-1-font-weight)] [&_h1]:[font-style:var(--ode-procedure-heading-1-font-style)] [&_h2]:my-4 [&_h2]:tracking-[-0.03em] [&_h2]:[font-family:var(--ode-procedure-heading-2-font-family)] [&_h2]:[font-size:var(--ode-procedure-heading-2-font-size)] [&_h2]:[line-height:var(--ode-procedure-heading-2-line-height)] [&_h2]:[color:var(--ode-procedure-heading-2-color)] [&_h2]:[font-weight:var(--ode-procedure-heading-2-font-weight)] [&_h2]:[font-style:var(--ode-procedure-heading-2-font-style)] [&_h3]:my-3 [&_h3]:tracking-[-0.02em] [&_h3]:[font-family:var(--ode-procedure-heading-3-font-family)] [&_h3]:[font-size:var(--ode-procedure-heading-3-font-size)] [&_h3]:[line-height:var(--ode-procedure-heading-3-line-height)] [&_h3]:[color:var(--ode-procedure-heading-3-color)] [&_h3]:[font-weight:var(--ode-procedure-heading-3-font-weight)] [&_h3]:[font-style:var(--ode-procedure-heading-3-font-style)] [&_h4]:my-3 [&_h4]:tracking-[-0.01em] [&_h4]:[font-family:var(--ode-procedure-heading-4-font-family)] [&_h4]:[font-size:var(--ode-procedure-heading-4-font-size)] [&_h4]:[line-height:var(--ode-procedure-heading-4-line-height)] [&_h4]:[color:var(--ode-procedure-heading-4-color)] [&_h4]:[font-weight:var(--ode-procedure-heading-4-font-weight)] [&_h4]:[font-style:var(--ode-procedure-heading-4-font-style)] [&_h5]:my-2 [&_h5]:uppercase [&_h5]:tracking-[0.05em] [&_h5]:[font-family:var(--ode-procedure-heading-5-font-family)] [&_h5]:[font-size:var(--ode-procedure-heading-5-font-size)] [&_h5]:[line-height:var(--ode-procedure-heading-5-line-height)] [&_h5]:[color:var(--ode-procedure-heading-5-color)] [&_h5]:[font-weight:var(--ode-procedure-heading-5-font-weight)] [&_h5]:[font-style:var(--ode-procedure-heading-5-font-style)] [&_h6]:my-2 [&_h6]:uppercase [&_h6]:tracking-[0.08em] [&_h6]:[font-family:var(--ode-procedure-heading-6-font-family)] [&_h6]:[font-size:var(--ode-procedure-heading-6-font-size)] [&_h6]:[line-height:var(--ode-procedure-heading-6-line-height)] [&_h6]:[color:var(--ode-procedure-heading-6-color)] [&_h6]:[font-weight:var(--ode-procedure-heading-6-font-weight)] [&_h6]:[font-style:var(--ode-procedure-heading-6-font-style)] [&_hr]:my-6 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-[#d6dde6] [&_hr[data-ode-page-break='true']]:my-10 [&_hr[data-ode-page-break='true']]:border-t-2 [&_hr[data-ode-page-break='true']]:border-dashed [&_hr[data-ode-page-break='true']]:border-[#38bdf8] [&_img[data-ode-link-type='image']]:my-3 [&_img[data-ode-link-type='image']]:inline-block [&_img[data-ode-link-type='image']]:h-auto [&_img[data-ode-link-type='image']]:max-h-none [&_img[data-ode-link-type='image']]:max-w-full [&_img[data-ode-link-type='image']]:rounded-[6px] [&_img[data-ode-link-type='image']]:border [&_img[data-ode-link-type='image']]:border-[#d6dde6] [&_img[data-ode-link-type='image']]:object-cover [&_img[data-ode-link-type='image']]:transition-shadow [&_img[data-ode-link-type='image'][data-ode-selected='true']]:ring-2 [&_img[data-ode-link-type='image'][data-ode-selected='true']]:ring-[#38bdf8] [&_img[data-ode-link-type='image'][data-ode-selected='true']]:ring-offset-2 [&_img[data-ode-link-type='image'][data-ode-selected='true']]:ring-offset-white [&_ol]:ml-6 [&_ol]:list-decimal [&_ol]:space-y-2 [&_p]:min-h-[1em] [&_pre]:my-5 [&_pre]:overflow-x-auto [&_pre]:rounded-[8px] [&_pre]:border [&_pre]:border-[#cbd5e1] [&_pre]:bg-[#0f172a] [&_pre]:px-4 [&_pre]:py-3 [&_pre]:font-mono [&_pre]:text-[0.84rem] [&_pre]:leading-6 [&_pre]:text-[#e2e8f0] [&_table]:my-6 [&_table]:w-full [&_table]:border-collapse [&_table]:table-fixed [&_table]:overflow-hidden [&_table]:rounded-[6px] [&_table]:border [&_table]:border-[#cbd5e1] [&_td]:border [&_td]:border-[#cbd5e1] [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_th]:border [&_th]:border-[#cbd5e1] [&_th]:bg-[#e2e8f0] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_ul]:ml-6 [&_ul]:list-disc [&_ul]:space-y-2";
const PROCEDURE_RICH_DOCUMENT_CLASS =
  "space-y-4 break-words rounded-[8px] border border-[#d6dde6] bg-white px-5 py-5 shadow-[0_14px_32px_rgba(15,23,42,0.08)] [font-family:var(--ode-procedure-body-font-family)] [font-size:var(--ode-procedure-body-font-size)] [line-height:var(--ode-procedure-body-line-height)] [color:var(--ode-procedure-body-color)] [font-weight:var(--ode-procedure-body-font-weight)] [font-style:var(--ode-procedure-body-font-style)] [&_a]:cursor-pointer [&_a]:text-[#2563eb] [&_a]:underline [&_a]:decoration-[rgba(37,99,235,0.36)] [&_blockquote]:my-5 [&_blockquote]:rounded-[4px] [&_blockquote]:border-l-4 [&_blockquote]:border-[#cbd5e1] [&_blockquote]:bg-[#f8fafc] [&_blockquote]:px-5 [&_blockquote]:py-4 [&_blockquote]:text-[#334155] [&_h1]:my-4 [&_h1]:tracking-[-0.04em] [&_h1]:[font-family:var(--ode-procedure-heading-1-font-family)] [&_h1]:[font-size:var(--ode-procedure-heading-1-font-size)] [&_h1]:[line-height:var(--ode-procedure-heading-1-line-height)] [&_h1]:[color:var(--ode-procedure-heading-1-color)] [&_h1]:[font-weight:var(--ode-procedure-heading-1-font-weight)] [&_h1]:[font-style:var(--ode-procedure-heading-1-font-style)] [&_h2]:my-4 [&_h2]:tracking-[-0.03em] [&_h2]:[font-family:var(--ode-procedure-heading-2-font-family)] [&_h2]:[font-size:var(--ode-procedure-heading-2-font-size)] [&_h2]:[line-height:var(--ode-procedure-heading-2-line-height)] [&_h2]:[color:var(--ode-procedure-heading-2-color)] [&_h2]:[font-weight:var(--ode-procedure-heading-2-font-weight)] [&_h2]:[font-style:var(--ode-procedure-heading-2-font-style)] [&_h3]:my-3 [&_h3]:tracking-[-0.02em] [&_h3]:[font-family:var(--ode-procedure-heading-3-font-family)] [&_h3]:[font-size:var(--ode-procedure-heading-3-font-size)] [&_h3]:[line-height:var(--ode-procedure-heading-3-line-height)] [&_h3]:[color:var(--ode-procedure-heading-3-color)] [&_h3]:[font-weight:var(--ode-procedure-heading-3-font-weight)] [&_h3]:[font-style:var(--ode-procedure-heading-3-font-style)] [&_h4]:my-3 [&_h4]:tracking-[-0.01em] [&_h4]:[font-family:var(--ode-procedure-heading-4-font-family)] [&_h4]:[font-size:var(--ode-procedure-heading-4-font-size)] [&_h4]:[line-height:var(--ode-procedure-heading-4-line-height)] [&_h4]:[color:var(--ode-procedure-heading-4-color)] [&_h4]:[font-weight:var(--ode-procedure-heading-4-font-weight)] [&_h4]:[font-style:var(--ode-procedure-heading-4-font-style)] [&_h5]:my-2 [&_h5]:uppercase [&_h5]:tracking-[0.05em] [&_h5]:[font-family:var(--ode-procedure-heading-5-font-family)] [&_h5]:[font-size:var(--ode-procedure-heading-5-font-size)] [&_h5]:[line-height:var(--ode-procedure-heading-5-line-height)] [&_h5]:[color:var(--ode-procedure-heading-5-color)] [&_h5]:[font-weight:var(--ode-procedure-heading-5-font-weight)] [&_h5]:[font-style:var(--ode-procedure-heading-5-font-style)] [&_h6]:my-2 [&_h6]:uppercase [&_h6]:tracking-[0.08em] [&_h6]:[font-family:var(--ode-procedure-heading-6-font-family)] [&_h6]:[font-size:var(--ode-procedure-heading-6-font-size)] [&_h6]:[line-height:var(--ode-procedure-heading-6-line-height)] [&_h6]:[color:var(--ode-procedure-heading-6-color)] [&_h6]:[font-weight:var(--ode-procedure-heading-6-font-weight)] [&_h6]:[font-style:var(--ode-procedure-heading-6-font-style)] [&_hr]:my-6 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-[#d6dde6] [&_hr[data-ode-page-break='true']]:my-10 [&_hr[data-ode-page-break='true']]:border-t-2 [&_hr[data-ode-page-break='true']]:border-dashed [&_hr[data-ode-page-break='true']]:border-[#38bdf8] [&_img[data-ode-link-type='image']]:my-3 [&_img[data-ode-link-type='image']]:inline-block [&_img[data-ode-link-type='image']]:h-auto [&_img[data-ode-link-type='image']]:max-h-none [&_img[data-ode-link-type='image']]:max-w-full [&_img[data-ode-link-type='image']]:rounded-[6px] [&_img[data-ode-link-type='image']]:border [&_img[data-ode-link-type='image']]:border-[#d6dde6] [&_img[data-ode-link-type='image']]:object-cover [&_ol]:ml-6 [&_ol]:list-decimal [&_ol]:space-y-2 [&_pre]:my-5 [&_pre]:overflow-x-auto [&_pre]:rounded-[8px] [&_pre]:border [&_pre]:border-[#cbd5e1] [&_pre]:bg-[#0f172a] [&_pre]:px-4 [&_pre]:py-3 [&_pre]:font-mono [&_pre]:text-[0.84rem] [&_pre]:leading-6 [&_pre]:text-[#e2e8f0] [&_table]:my-6 [&_table]:w-full [&_table]:border-collapse [&_table]:table-fixed [&_table]:overflow-hidden [&_table]:rounded-[6px] [&_table]:border [&_table]:border-[#cbd5e1] [&_td]:border [&_td]:border-[#cbd5e1] [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_th]:border [&_th]:border-[#cbd5e1] [&_th]:bg-[#e2e8f0] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_ul]:ml-6 [&_ul]:list-disc [&_ul]:space-y-2";
const PROCEDURE_SURFACE_SHELL_CLASS =
  "overflow-hidden rounded-[36px] border border-[var(--ode-border-strong)] bg-[linear-gradient(180deg,rgba(4,24,40,0.98),rgba(2,18,30,0.98))] shadow-[0_28px_80px_rgba(0,0,0,0.34)]";
const PROCEDURE_ICON_BUTTON_CLASS =
  "flex items-center justify-center rounded-[16px] border border-[var(--ode-border-strong)] bg-[rgba(6,37,61,0.78)] text-[var(--ode-accent)] shadow-[0_12px_26px_rgba(0,0,0,0.26)] transition hover:border-[var(--ode-border-accent)] hover:bg-[rgba(12,73,110,0.68)] hover:text-[var(--ode-text)]";
const PROCEDURE_ICON_BUTTON_SMALL_CLASS =
  "flex items-center justify-center rounded-[14px] border border-[var(--ode-border)] bg-[rgba(6,34,53,0.7)] text-[var(--ode-accent)] transition hover:border-[var(--ode-border-accent)] hover:bg-[rgba(10,66,100,0.62)] hover:text-[var(--ode-text)]";
const PROCEDURE_MUTED_CARD_CLASS =
  "rounded-[22px] border border-[var(--ode-border)] bg-[rgba(4,23,39,0.62)] text-[var(--ode-text-muted)]";
const PROCEDURE_TABLE_SHELL_CLASS =
  "overflow-hidden rounded-[24px] border border-[var(--ode-border)] bg-[rgba(3,20,33,0.74)]";
const PROCEDURE_FILE_ROW_CLASS =
  "flex flex-wrap items-center gap-3 rounded-[16px] border border-[var(--ode-border)] bg-[rgba(5,29,46,0.6)] px-4 py-3";
const PROCEDURE_FILE_ICON_CLASS =
  "flex h-10 w-10 flex-none items-center justify-center rounded-[14px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.72)] text-[var(--ode-accent)]";
const PROCEDURE_SECONDARY_TEXT_BUTTON_CLASS =
  "rounded-[14px] border border-[var(--ode-border)] bg-[rgba(5,29,46,0.58)] px-3 py-1.5 text-[0.74rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)] transition hover:border-[var(--ode-border-accent)] hover:text-[var(--ode-text)]";
const SECTION_EDITOR_TOOLBAR_BUTTON_ACTIVE_CLASS =
  "border-[rgba(95,220,255,0.38)] bg-[rgba(19,58,84,0.96)] text-[var(--ode-text)]";

type SectionEditorToolbarIconButtonProps = {
  label: string;
  ariaLabel?: string;
  buttonClassName?: string;
  disabled?: boolean;
  onMouseDown?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onClick?: () => void;
  children: ReactNode;
};

function SectionEditorToolbarIconButton({
  label,
  ariaLabel,
  buttonClassName = SECTION_EDITOR_TOOLBAR_BUTTON_CLASS,
  disabled = false,
  onMouseDown,
  onClick,
  children
}: SectionEditorToolbarIconButtonProps) {
  return (
    <OdeTooltip label={label}>
      <button
        type="button"
        className={buttonClassName}
        aria-label={ariaLabel ?? label}
        disabled={disabled}
        onMouseDown={onMouseDown}
        onClick={onClick}
      >
        {children}
      </button>
    </OdeTooltip>
  );
}

function SectionEditorContextMenu({
  menu,
  items,
  onClose
}: {
  menu: SectionEditorContextMenuState | null;
  items: SectionEditorContextMenuItem[];
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPlacement, setMenuPlacement] = useState<{ left: number; top: number; maxHeight: number } | null>(null);

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
    if (!menu) return;
    const frame = window.requestAnimationFrame(() => {
      focusButtonAt(0);
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [menu, items.length]);

  useLayoutEffect(() => {
    if (!menu) {
      setMenuPlacement(null);
      return;
    }
    const updatePlacement = () => {
      const menuElement = menuRef.current;
      if (!menuElement) return;
      const viewportMargin = 8;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const maxHeight = Math.max(180, Math.min(560, viewportHeight - viewportMargin * 2));
      const menuWidth = Math.ceil(menuElement.getBoundingClientRect().width) || menuElement.offsetWidth || 280;
      const menuHeight = Math.min(menuElement.scrollHeight, maxHeight);
      const left = Math.max(viewportMargin, Math.min(menu.x, viewportWidth - viewportMargin - menuWidth));
      const top = Math.max(viewportMargin, Math.min(menu.y, viewportHeight - viewportMargin - menuHeight));
      setMenuPlacement((current) => {
        if (current && current.left === left && current.top === top && current.maxHeight === maxHeight) {
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
  }, [items.length, menu]);

  useEffect(() => {
    if (!menu) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".ode-section-editor-context-menu")) return;
      onClose();
    };
    const handleContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".ode-section-editor-context-menu")) return;
      onClose();
    };
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("contextmenu", handleContextMenu, true);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    window.addEventListener("keydown", handleWindowKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("contextmenu", handleContextMenu, true);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [menu, onClose]);

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

  if (!menu) return null;

  return (
    <div
      ref={menuRef}
      className="ode-context-menu ode-section-editor-context-menu"
      style={{
        left: `${menuPlacement?.left ?? menu.x}px`,
        top: `${menuPlacement?.top ?? menu.y}px`,
        maxHeight: `${menuPlacement?.maxHeight ?? 420}px`
      }}
      role="menu"
      aria-label={menu.target === "label" ? "Title menu" : "Text menu"}
      onMouseDown={(event) => event.preventDefault()}
      onKeyDown={handleMenuKeyDown}
    >
      {items.map((item) =>
        item.kind === "separator" ? (
          <div key={item.key} className="ode-context-separator" />
        ) : (
          <button
            key={item.key}
            type="button"
            className={`ode-context-item${item.danger ? " ode-context-item-danger" : ""}`}
            disabled={item.disabled}
            onClick={item.onSelect}
          >
            <span className="ode-context-item-main">
              <span>{item.label}</span>
            </span>
            {item.shortcutLabel ? (
              <span className="ode-context-item-shortcut" aria-hidden="true">
                {item.shortcutLabel}
              </span>
            ) : null}
          </button>
        )
      )}
    </div>
  );
}

const FIELD_TYPE_OPTIONS: Array<{ value: ProcedureFieldType; label: string }> = [
  { value: "short_text", label: "Short Text" },
  { value: "long_text", label: "Long Text" },
  { value: "rich_text", label: "Rich Text" },
  { value: "number", label: "Number" },
  { value: "year", label: "Year" },
  { value: "month", label: "Month" },
  { value: "day", label: "Day" },
  { value: "decimal", label: "Decimal" },
  { value: "percentage", label: "Percentage" },
  { value: "currency", label: "Currency" },
  { value: "date", label: "Date" },
  { value: "time", label: "Time" },
  { value: "datetime", label: "Date and Time" },
  { value: "duration", label: "Duration" },
  { value: "single_select", label: "Select" },
  { value: "multi_select", label: "Multi Select" },
  { value: "yes_no", label: "Yes / No" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "identifier", label: "Identifier" },
  { value: "attachment", label: "Attachment" },
  { value: "table", label: "Table" },
  { value: "node_link", label: "Node Link" },
  { value: "organization_link", label: "Organisation Link" },
  { value: "relation", label: "Relation" },
  { value: "relation_list", label: "Relation List" },
  { value: "formula", label: "Formula" }
];

function getProcedureFieldTypeLabel(type: ProcedureFieldType): string {
  return FIELD_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? "Field";
}

const AUTOMATION_ROLE_OPTIONS: Array<{ value: ProcedureAutomationRole; label: string }> = [
  { value: "none", label: "None" },
  { value: "execution_owner_node", label: "Execution Owner Node" },
  { value: "execution_deliverable", label: "Execution Deliverable" },
  { value: "execution_task", label: "Execution Task" },
  { value: "execution_subtask", label: "Execution Sub-task" },
  { value: "execution_status", label: "Execution Status" },
  { value: "execution_due_date", label: "Execution Due Date" },
  { value: "execution_note", label: "Execution Note" }
];

const SECTION_EDITOR_STYLE_OPTIONS: Array<{
  value: SectionEditorBlockStyle;
  label: string;
  blockTag: "<p>" | "<h1>" | "<h2>" | "<h3>" | "<h4>" | "<h5>" | "<h6>";
  buttonClassName: string;
}> = [
  {
    value: "normal",
    label: "Normal",
    blockTag: "<p>",
    buttonClassName: "text-[0.92rem] text-[var(--ode-text)]"
  },
  {
    value: "heading1",
    label: "Heading 1",
    blockTag: "<h1>",
    buttonClassName: "text-[1.08rem] font-semibold text-[var(--ode-text)]"
  },
  {
    value: "heading2",
    label: "Heading 2",
    blockTag: "<h2>",
    buttonClassName: "text-[1rem] font-semibold text-[var(--ode-text)]"
  },
  {
    value: "heading3",
    label: "Heading 3",
    blockTag: "<h3>",
    buttonClassName: "text-[0.94rem] font-semibold text-[var(--ode-text)]"
  },
  {
    value: "heading4",
    label: "Heading 4",
    blockTag: "<h4>",
    buttonClassName: "text-[0.88rem] font-semibold text-[var(--ode-text)]"
  },
  {
    value: "heading5",
    label: "Heading 5",
    blockTag: "<h5>",
    buttonClassName: "text-[0.84rem] font-semibold text-[var(--ode-text-dim)]"
  },
  {
    value: "heading6",
    label: "Heading 6",
    blockTag: "<h6>",
    buttonClassName: "text-[0.8rem] font-semibold uppercase tracking-[0.08em] text-[var(--ode-text-dim)]"
  }
];

function createProcedureId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeFieldType(value: unknown): ProcedureFieldType {
  return normalizeSharedFieldType(value);
}

function fieldTypeSupportsOptions(type: ProcedureFieldType): boolean {
  return type === "single_select" || type === "multi_select" || type === "table";
}

function fieldTypeUsesTextarea(type: ProcedureFieldType): boolean {
  return type === "long_text" || type === "rich_text" || type === "duration";
}

function fieldTypeUsesNumericInput(type: ProcedureFieldType): boolean {
  return (
    type === "number" ||
    type === "year" ||
    type === "day" ||
    type === "decimal" ||
    type === "percentage" ||
    type === "currency"
  );
}

function normalizeOptionLines(value: string, fallback: string[]): string[] {
  const cleaned = value
    .split(/\r?\n/g)
    .map((item) => item.trim())
    .filter(Boolean);
  return cleaned.length > 0 ? cleaned : fallback;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((entry) => typeof entry === "string");
}

function readNodeStringProperty(properties: Record<string, unknown> | undefined, key: string): string {
  const value = properties?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function readNodeStringArrayProperty(properties: Record<string, unknown> | undefined, key: string): string[] {
  const value = properties?.[key];
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isProcedureFieldNode(node: AppNode | null | undefined): boolean {
  return isSharedProcedureFieldNode(node);
}

function buildProcedureFieldEntry(node: AppNode): ProcedureFieldEntry {
  const shared = buildSharedProcedureFieldDefinition(node);
  return {
    node,
    ...shared
  };
}

function readRecords(node: AppNode | null): ProcedureRecord[] {
  return readSharedProcedureRecords(node);
}

function createEmptyTableValue(columns: string[], currentValue?: ProcedureRecordValue): Record<string, string> {
  const base: Record<string, string> = {};
  const currentRecord = isStringRecord(currentValue) ? currentValue : {};
  for (const column of columns) {
    base[column] = currentRecord[column] ?? "";
  }
  return base;
}

function getTableFieldColumns(entry: Pick<ProcedureFieldDefinition, "options">): string[] {
  return entry.options.length > 0 ? entry.options : DEFAULT_TABLE_COLUMNS;
}

function getFilledTableFieldEntries(
  value: ProcedureRecordValue | undefined,
  columns: string[]
): Array<{ column: string; value: string }> {
  const tableValue = createEmptyTableValue(columns, value);
  return columns
    .map((column) => ({
      column,
      value: tableValue[column] ?? ""
    }))
    .filter((entry) => entry.value.trim().length > 0);
}

function normalizeDraftValueForField(
  entry: Pick<ProcedureFieldDefinition, "type" | "options">,
  currentValue: ProcedureRecordValue | undefined
): ProcedureRecordValue {
  if (entry.type === "multi_select" || entry.type === "relation_list" || isProcedureOrganizationLinkFieldType(entry.type)) {
    return Array.isArray(currentValue)
      ? currentValue.filter((item): item is string => typeof item === "string")
      : typeof currentValue === "string" && currentValue.trim().length > 0
        ? [currentValue]
        : [];
  }
  if (entry.type === "attachment") {
    return Array.isArray(currentValue)
      ? currentValue.filter((item): item is string => typeof item === "string")
      : typeof currentValue === "string" && currentValue.trim().length > 0
        ? [currentValue]
        : [];
  }
  if (entry.type === "table") {
    const columns = entry.options.length > 0 ? entry.options : DEFAULT_TABLE_COLUMNS;
    return createEmptyTableValue(columns, currentValue);
  }
  if (typeof currentValue !== "string") return "";
  if (entry.type === "date") return normalizeProcedureImportedDate(currentValue);
  if (entry.type === "year") return normalizeProcedureImportedYear(currentValue);
  if (entry.type === "month") return normalizeProcedureImportedMonth(currentValue);
  if (entry.type === "day") return normalizeProcedureImportedDay(currentValue);
  return currentValue;
}

function mergeDraftValues(
  entries: ProcedureFieldEntry[],
  currentValues: Record<string, ProcedureRecordValue>
): Record<string, ProcedureRecordValue> {
  const nextValues: Record<string, ProcedureRecordValue> = {};
  for (const entry of entries) {
    nextValues[entry.node.id] = normalizeDraftValueForField(entry, currentValues[entry.node.id]);
  }
  return nextValues;
}

function isEmptyRecordValue(value: ProcedureRecordValue | undefined): boolean {
  if (value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return Object.values(value).every((item) => item.trim().length === 0);
}

function formatRecordValue(
  value: ProcedureRecordValue | undefined,
  entry: ProcedureFieldEntry,
  model: ReturnType<typeof buildProcedureDatabaseModel>
): string {
  if (isEmptyRecordValue(value)) return "Not answered";
  return formatSharedProcedureRecordValue(value, entry, model);
}

function formatProcedureExportCellValue(
  value: ProcedureRecordValue | undefined,
  entry: ProcedureFieldEntry,
  model: ReturnType<typeof buildProcedureDatabaseModel>
): string {
  if (isEmptyRecordValue(value)) return "";
  return formatSharedProcedureRecordValue(value, entry, model);
}

function serializeRecordValueForGrouping(value: ProcedureRecordValue | undefined): string {
  if (value === undefined) return "";
  if (typeof value === "string") return `s:${value}`;
  if (Array.isArray(value)) return `a:${value.join("\u001f")}`;
  return `o:${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right, undefined, { sensitivity: "base" }))
    .map(([key, entry]) => `${key}:${entry}`)
    .join("\u001f")}`;
}

type ProcedureDisplayRecordRow = {
  id: string;
  sourceRecord: ProcedureRecord;
  values: Record<string, ProcedureRecordValue>;
};

type ProcedureDisplayRecordGroup = {
  id: string;
  displayIndex: number;
  representativeRow: ProcedureDisplayRecordRow;
  rows: ProcedureDisplayRecordRow[];
};

function normalizeProcedureDisplayRowTokens(value: ProcedureRecordValue | undefined): string[] {
  if (typeof value === "string") return value.trim().length > 0 ? [value] : [];
  if (Array.isArray(value)) {
    return value.filter((item) => item.trim().length > 0);
  }
  return [];
}

function collectProcedureFieldEntries(
  entries: Array<ProcedureFieldEntry | null | undefined>
): ProcedureFieldEntry[] {
  const resolved = new Map<string, ProcedureFieldEntry>();
  for (const entry of entries) {
    if (!entry || resolved.has(entry.node.id)) continue;
    resolved.set(entry.node.id, entry);
  }
  return Array.from(resolved.values());
}

function resolveProcedureDisplayExpansionField(
  records: ProcedureRecord[],
  fields: ProcedureFieldEntry[]
): ProcedureFieldEntry | null {
  if (records.length === 0) return null;
  for (const entry of fields) {
    if (!isProcedureOrganizationLinkFieldType(entry.type)) continue;
    return entry;
  }
  return null;
}

function serializeProcedureDisplayVisibleRowSignature(
  row: ProcedureDisplayRecordRow,
  fields: ProcedureFieldEntry[]
): string {
  return fields
    .map((entry) => `${entry.node.id}:${serializeRecordValueForGrouping(row.values[entry.node.id])}`)
    .join("|");
}

function buildProcedureDisplayRows(
  records: ProcedureRecord[],
  expandedField: ProcedureFieldEntry | null
): ProcedureDisplayRecordRow[] {
  if (!expandedField) {
    return records.map((record) => ({
      id: record.id,
      sourceRecord: record,
      values: record.values
    }));
  }

  return records.flatMap((record) => {
    const selectedTokens = normalizeProcedureDisplayRowTokens(record.values[expandedField.node.id]);
    const rowTokens = selectedTokens.length > 0 ? selectedTokens : [""];
    return rowTokens.map((token, index) => ({
      id: index === 0 ? record.id : `${record.id}::${expandedField.node.id}::${index}`,
      sourceRecord: record,
      values: {
        ...record.values,
        [expandedField.node.id]: token
      }
    }));
  });
}

function buildProcedurePivotDisplayRows(
  records: ProcedureRecord[],
  rowField: ProcedureFieldEntry | null,
  columnField: ProcedureFieldEntry | null
): ProcedureDisplayRecordRow[] {
  if (!rowField || !columnField) return [];

  return records.flatMap((record) => {
    const rowTokens = normalizeProcedureDisplayRowTokens(record.values[rowField.node.id]);
    const columnTokens = normalizeProcedureDisplayRowTokens(record.values[columnField.node.id]);
    const nextRowTokens =
      rowTokens.length > 0
        ? rowTokens
        : [typeof record.values[rowField.node.id] === "string" ? record.values[rowField.node.id] : ""];
    const nextColumnTokens =
      columnTokens.length > 0
        ? columnTokens
        : [typeof record.values[columnField.node.id] === "string" ? record.values[columnField.node.id] : ""];

    return nextRowTokens.flatMap((rowToken, rowIndex) =>
      nextColumnTokens.map((columnToken, columnIndex) => ({
        id: `${record.id}::pivot::${rowIndex}::${columnIndex}`,
        sourceRecord: record,
        values: {
          ...record.values,
          [rowField.node.id]: rowToken,
          [columnField.node.id]: columnToken
        }
      }))
    );
  });
}

function buildProcedureDisplayRecordGroups(params: {
  displayRows: ProcedureDisplayRecordRow[];
  visibleFields: ProcedureFieldEntry[];
  expandedField: ProcedureFieldEntry | null;
}): ProcedureDisplayRecordGroup[] {
  const { displayRows, visibleFields, expandedField } = params;
  if (!expandedField) {
    return displayRows.map((row, index) => ({
      id: row.sourceRecord.id,
      displayIndex: index + 1,
      representativeRow: row,
      rows: [row]
    }));
  }

  const groupingFields = visibleFields.filter((entry) => entry.node.id !== expandedField.node.id);
  if (groupingFields.length === 0) {
    return displayRows.map((row, index) => ({
      id: row.sourceRecord.id,
      displayIndex: index + 1,
      representativeRow: row,
      rows: [row]
    }));
  }

  const groups = new Map<string, ProcedureDisplayRecordGroup>();
  const orderedGroups: ProcedureDisplayRecordGroup[] = [];
  for (const row of displayRows) {
    const key = groupingFields
      .map((entry) => `${entry.node.id}:${serializeRecordValueForGrouping(row.values[entry.node.id])}`)
      .join("|");
    const existing = groups.get(key);
    if (existing) {
      const rowSignature = serializeProcedureDisplayVisibleRowSignature(row, visibleFields);
      const hasMatchingVisibleRow = existing.rows.some(
        (existingRow) => serializeProcedureDisplayVisibleRowSignature(existingRow, visibleFields) === rowSignature
      );
      if (hasMatchingVisibleRow) {
        continue;
      }
      existing.rows.push(row);
      continue;
    }
    const nextGroup: ProcedureDisplayRecordGroup = {
      id: key || row.sourceRecord.id,
      displayIndex: orderedGroups.length + 1,
      representativeRow: row,
      rows: [row]
    };
    groups.set(key, nextGroup);
    orderedGroups.push(nextGroup);
  }
  return orderedGroups;
}

function buildExpandedProcedureRecordValueRows(
  fields: ProcedureFieldEntry[],
  values: Record<string, ProcedureRecordValue>
): Array<Record<string, ProcedureRecordValue>> {
  const organizationFields = fields.filter((entry) => isProcedureOrganizationLinkFieldType(entry.type));
  if (organizationFields.length === 0) {
    return [{ ...values }];
  }

  let expandedRows: Array<Record<string, ProcedureRecordValue>> = [{ ...values }];
  for (const entry of organizationFields) {
    const normalizedTokens = Array.from(new Set(normalizeProcedureDisplayRowTokens(values[entry.node.id])));
    const rowTokens = normalizedTokens.length > 0 ? normalizedTokens : [""];
    expandedRows = expandedRows.flatMap((rowValues) =>
      rowTokens.map((token) => ({
        ...rowValues,
        [entry.node.id]: token
      }))
    );
  }

  const dedupedRows = new Map<string, Record<string, ProcedureRecordValue>>();
  for (const rowValues of expandedRows) {
    const signature = fields
      .map((entry) => `${entry.node.id}:${serializeRecordValueForGrouping(rowValues[entry.node.id])}`)
      .join("|");
    if (!dedupedRows.has(signature)) {
      dedupedRows.set(signature, rowValues);
    }
  }
  return Array.from(dedupedRows.values());
}

function isLikelyMatrixColumnField(entry: Pick<ProcedureFieldDefinition, "label">): boolean {
  const normalized = entry.label.trim();
  return (
    /^\d{4}$/.test(normalized) ||
    /^q[1-4]\s+\d{4}$/i.test(normalized) ||
    /^s[1-2]\s+\d{4}$/i.test(normalized) ||
    /^n\+\d+$/i.test(normalized)
  );
}

function compareProcedureDisplayLabels(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });
}

function buildDefaultMatrixColumnFieldIds(
  fields: ProcedureFieldEntry[],
  rowFieldId: string,
  groupByFieldId: string,
  infoFieldIds: string[]
): string[] {
  const excluded = new Set([rowFieldId, groupByFieldId, ...infoFieldIds].filter((value) => value.trim().length > 0));
  const likelyMatrixFields = fields.filter(
    (entry) => !excluded.has(entry.node.id) && isLikelyMatrixColumnField(entry)
  );
  if (likelyMatrixFields.length > 0) {
    return likelyMatrixFields.map((entry) => entry.node.id);
  }
  return fields.filter((entry) => !excluded.has(entry.node.id)).map((entry) => entry.node.id);
}

function resolveDefaultMatrixRowFieldId(
  fields: ProcedureFieldEntry[],
  groupByFieldId: string,
  infoFieldIds: string[]
): string {
  const excluded = new Set([groupByFieldId, ...infoFieldIds].filter((value) => value.trim().length > 0));
  const preferred =
    fields.find((entry) => !excluded.has(entry.node.id) && !isLikelyMatrixColumnField(entry)) ??
    fields.find((entry) => !excluded.has(entry.node.id)) ??
    fields[0] ??
    null;
  return preferred?.node.id ?? "";
}

function resolveProcedureTableViewMode(value: unknown): ProcedureTableViewMode {
  return value === "matrix" || value === "pivot" ? value : "list";
}

function resolveDefaultPivotColumnFieldId(
  fields: ProcedureFieldEntry[],
  rowFieldId: string,
  groupByFieldId: string,
  infoFieldIds: string[]
): string {
  const excluded = new Set([rowFieldId, groupByFieldId, ...infoFieldIds].filter((value) => value.trim().length > 0));
  return fields.find((entry) => !excluded.has(entry.node.id))?.node.id ?? "";
}

function buildProcedureTableViewDraft(node: AppNode, fields: ProcedureFieldEntry[]): ProcedureTableViewDraft {
  const properties = node.properties as Record<string, unknown> | undefined;
  const fieldIds = new Set(fields.map((entry) => entry.node.id));
  const viewMode = resolveProcedureTableViewMode(properties?.odeProcedureTableViewMode);
  const configuredGroupByFieldId = readNodeStringProperty(properties, "odeProcedureTableGroupByFieldId");
  const groupByFieldId = fieldIds.has(configuredGroupByFieldId) ? configuredGroupByFieldId : "";
  const configuredInfoFieldIds = readNodeStringArrayProperty(properties, "odeProcedureTableInfoFieldIds").filter((fieldId) =>
    fieldIds.has(fieldId)
  );
  const infoFieldIds = Array.from(new Set(configuredInfoFieldIds)).filter((fieldId) => fieldId !== groupByFieldId);
  const configuredRowFieldId = readNodeStringProperty(properties, "odeProcedureTableMatrixRowFieldId");
  const matrixRowFieldId = fieldIds.has(configuredRowFieldId)
    ? configuredRowFieldId
    : resolveDefaultMatrixRowFieldId(fields, groupByFieldId, infoFieldIds);
  const configuredMatrixColumnFieldIds = readNodeStringArrayProperty(
    properties,
    "odeProcedureTableMatrixColumnFieldIds"
  ).filter((fieldId) => fieldIds.has(fieldId) && fieldId !== matrixRowFieldId);
  const matrixColumnFieldIds =
    configuredMatrixColumnFieldIds.length > 0
      ? Array.from(new Set(configuredMatrixColumnFieldIds))
      : buildDefaultMatrixColumnFieldIds(fields, matrixRowFieldId, groupByFieldId, infoFieldIds);
  const configuredPivotColumnFieldId = readNodeStringProperty(properties, "odeProcedureTablePivotColumnFieldId");
  const pivotColumnFieldId =
    fieldIds.has(configuredPivotColumnFieldId) && configuredPivotColumnFieldId !== matrixRowFieldId
      ? configuredPivotColumnFieldId
      : resolveDefaultPivotColumnFieldId(fields, matrixRowFieldId, groupByFieldId, infoFieldIds);
  return {
    viewMode,
    groupByFieldId,
    infoFieldIds,
    matrixRowFieldId,
    matrixColumnFieldIds,
    matrixColumnGroupLabel: readNodeStringProperty(properties, "odeProcedureTableMatrixColumnGroupLabel") || "Columns",
    pivotColumnFieldId
  };
}

function normalizeProcedureExportFileName(value: string): string {
  const normalized = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.length > 0 ? normalized : "procedure-table";
}

function formatProcedureExportTimestamp(value: number): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function buildProcedureTableSpreadsheetPayload(params: {
  tableNode: AppNode;
  fields: ProcedureFieldEntry[];
  model: ReturnType<typeof buildProcedureDatabaseModel>;
}): ProcedureTableSpreadsheetPayload {
  const { tableNode, fields, model } = params;
  const records = readRecords(tableNode);
  const masterListFields = fields.filter((entry) => entry.showInMasterList);
  const visibleFields = masterListFields.length > 0 ? masterListFields : fields;
  const buildRows = (entries: ProcedureFieldEntry[]) =>
    records.map((record, index) => [
      String(index + 1),
      ...entries.map((entry) => formatProcedureExportCellValue(record.values[entry.node.id], entry, model))
    ]);

  const sheets: ProcedureTableSpreadsheetPayload["sheets"] = [
    {
      name: "Master List",
      headers: ["Row", ...visibleFields.map((entry) => entry.node.name)],
      rows: buildRows(visibleFields)
    }
  ];

  const hiddenFieldCount = fields.length - visibleFields.length;
  if (hiddenFieldCount > 0) {
    sheets.push({
      name: "All Fields",
      headers: ["Row", ...fields.map((entry) => entry.node.name)],
      rows: buildRows(fields)
    });
  }

  sheets.push({
    name: "Audit",
    headers: ["Row", "Record ID", "Created At", "Updated At"],
    rows: records.map((record, index) => [
      String(index + 1),
      record.id,
      formatProcedureExportTimestamp(record.createdAt),
      formatProcedureExportTimestamp(record.updatedAt)
    ])
  });

  return {
    tableName: tableNode.name,
    meta: [
      { label: "Table", value: tableNode.name },
      { label: "Exported At", value: new Date().toISOString() },
      { label: "Record Count", value: String(records.length) },
      { label: "Master List Columns", value: String(visibleFields.length) },
      { label: "All Fields Columns", value: String(fields.length) },
      { label: "Hidden Columns", value: String(hiddenFieldCount) }
    ],
    sheets
  };
}

type ProcedureImportChoice = {
  token: string;
  label: string;
};

type ProcedureOrganizationChoice = ProcedureImportChoice & {
  node: AppNode;
  depth: number;
  pathLabel: string;
};

function normalizeProcedureImportKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function splitProcedureImportValues(value: string): string[] {
  const normalized = value.trim();
  if (!normalized) return [];
  return normalized
    .split(/\r?\n|;|\||,/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeProcedureImportedDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
  }
  const europeanMatch = trimmed.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (europeanMatch) {
    return `${europeanMatch[3]}-${europeanMatch[2].padStart(2, "0")}-${europeanMatch[1].padStart(2, "0")}`;
  }
  return trimmed;
}

const MONTH_FIELD_OPTIONS = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12"
] as const;

function normalizeProcedureImportedYear(value: string): string {
  const digits = value.replace(/[^\d]/g, "").slice(0, 4);
  return digits;
}

function normalizeProcedureImportedMonth(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const monthNames = new Map<string, string>([
    ["jan", "01"],
    ["january", "01"],
    ["feb", "02"],
    ["february", "02"],
    ["mar", "03"],
    ["march", "03"],
    ["apr", "04"],
    ["april", "04"],
    ["may", "05"],
    ["jun", "06"],
    ["june", "06"],
    ["jul", "07"],
    ["july", "07"],
    ["aug", "08"],
    ["august", "08"],
    ["sep", "09"],
    ["sept", "09"],
    ["september", "09"],
    ["oct", "10"],
    ["october", "10"],
    ["nov", "11"],
    ["november", "11"],
    ["dec", "12"],
    ["december", "12"]
  ]);
  const normalizedKey = normalizeProcedureImportKey(trimmed);
  const namedMonth = monthNames.get(normalizedKey);
  if (namedMonth) return namedMonth;
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return "";
  const parsed = Number(digits);
  if (!Number.isFinite(parsed)) return "";
  return parsed >= 1 && parsed <= 12 ? String(parsed).padStart(2, "0") : "";
}

function normalizeProcedureImportedDay(value: string): string {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return "";
  const parsed = Number(digits);
  if (!Number.isFinite(parsed)) return "";
  return parsed >= 1 && parsed <= 31 ? String(parsed).padStart(2, "0") : "";
}

function resolveProcedureImportChoiceToken(value: string, choices: ProcedureImportChoice[]): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const normalizedValue = normalizeProcedureImportKey(trimmed);
  const directMatch =
    choices.find((choice) => choice.token === trimmed) ??
    choices.find((choice) => normalizeProcedureImportKey(choice.label) === normalizedValue) ??
    choices.find((choice) => normalizeProcedureImportKey(choice.token) === normalizedValue);
  return directMatch?.token ?? "";
}

function selectProcedureImportSheet(params: {
  tableName: string;
  fields: ProcedureFieldEntry[];
  payload: ProcedureTableSpreadsheetPayload;
}): ProcedureTableSpreadsheetPayload["sheets"][number] | null {
  const { tableName, fields, payload } = params;
  if (payload.sheets.length === 0) return null;
  const fieldKeys = new Set(fields.map((entry) => normalizeProcedureImportKey(entry.node.name)));
  const scoredSheets = payload.sheets.map((sheet) => {
    const score = sheet.headers.reduce((total, header) => {
      const normalizedHeader = normalizeProcedureImportKey(header);
      return fieldKeys.has(normalizedHeader) ? total + 1 : total;
    }, 0);
    const normalizedSheetName = normalizeProcedureImportKey(sheet.name);
    return {
      sheet,
      score,
      normalizedSheetName,
      allFieldsBonus: normalizedSheetName === "all fields" ? 1000 : 0,
      tableNameBonus:
        normalizedSheetName === normalizeProcedureImportKey(tableName) ||
        normalizedSheetName === normalizeProcedureImportKey(payload.tableName)
          ? 100
          : 0
    };
  });
  scoredSheets.sort(
    (left, right) =>
      right.allFieldsBonus +
      right.tableNameBonus +
      right.score -
      (left.allFieldsBonus + left.tableNameBonus + left.score)
  );
  return scoredSheets[0]?.sheet ?? payload.sheets[0] ?? null;
}

function buildFieldEditorDraft(entry: ProcedureFieldEntry): FieldEditorDraft {
  return {
    label: entry.node.name,
    type: entry.type,
    placeholder: entry.placeholder,
    required: entry.required,
    showInMasterList: entry.showInMasterList,
    visibilitySourceFieldId: entry.visibilitySourceFieldId ?? "",
    visibilityEqualsValue: entry.visibilityEqualsValue ?? "",
    optionsText: (
      entry.options.length > 0
        ? entry.options
        : entry.type === "table"
        ? DEFAULT_TABLE_COLUMNS
        : DEFAULT_SELECT_OPTIONS
    ).join("\n"),
    organizationRootNodeId: entry.organizationRootNodeId ?? "",
    relationTargetNodeId: entry.relationTargetNodeId ?? "",
    relationDisplayFieldIds: entry.relationDisplayFieldIds ?? [],
    formulaExpression: entry.formulaExpression,
    automationRole: entry.automationRole
  };
}

function getProcedureConditionalVisibilityOptions(entry: Pick<ProcedureFieldDefinition, "type" | "options">): string[] {
  if (entry.type === "yes_no") {
    return ["Yes", "No"];
  }
  if (entry.type === "month") {
    return [...MONTH_FIELD_OPTIONS];
  }
  if (entry.type === "single_select" || entry.type === "multi_select") {
    return entry.options.length > 0 ? entry.options : DEFAULT_SELECT_OPTIONS;
  }
  return [];
}

function isProcedureFieldVisibleInRecordEditor(
  entry: Pick<ProcedureFieldDefinition, "visibilitySourceFieldId" | "visibilityEqualsValue">,
  values: Record<string, ProcedureRecordValue>,
  fieldsById: Map<string, ProcedureFieldEntry>
): boolean {
  const sourceFieldId = entry.visibilitySourceFieldId?.trim() ?? "";
  const expectedValue = entry.visibilityEqualsValue.trim();
  if (!sourceFieldId || !expectedValue) return true;
  if (!fieldsById.has(sourceFieldId)) return true;
  const normalizedExpectedValue = normalizeProcedureImportKey(expectedValue);
  const currentValue = values[sourceFieldId];
  if (typeof currentValue === "string") {
    return normalizeProcedureImportKey(currentValue) === normalizedExpectedValue;
  }
  if (Array.isArray(currentValue)) {
    return currentValue.some((item) => normalizeProcedureImportKey(item) === normalizedExpectedValue);
  }
  return false;
}

function isProcedureFieldCompatibleForAutofill(
  targetField: Pick<ProcedureFieldDefinition, "type" | "relationTargetNodeId">,
  sourceField: Pick<ProcedureFieldDefinition, "type" | "relationTargetNodeId">
): boolean {
  if (targetField.type === sourceField.type) {
    if (isProcedureRelationFieldType(targetField.type)) {
      return targetField.relationTargetNodeId === sourceField.relationTargetNodeId;
    }
    return true;
  }

  const stringLikeFieldTypes = new Set<ProcedureFieldType>([
    "short_text",
    "long_text",
    "rich_text",
    "number",
    "year",
    "month",
    "day",
    "decimal",
    "percentage",
    "currency",
    "date",
    "time",
    "datetime",
    "duration",
    "single_select",
    "yes_no",
    "email",
    "phone",
    "identifier",
    "node_link"
  ]);
  return stringLikeFieldTypes.has(targetField.type) && stringLikeFieldTypes.has(sourceField.type);
}

function buildRelationAutofillValues(params: {
  sourceFieldId: string;
  sourceValue: ProcedureRecordValue;
  recordFields: ProcedureFieldEntry[];
  fieldById: Map<string, ProcedureFieldEntry>;
  model: ReturnType<typeof buildProcedureDatabaseModel>;
}): Record<string, ProcedureRecordValue> {
  const { sourceFieldId, sourceValue, recordFields, fieldById, model } = params;
  const sourceField = fieldById.get(sourceFieldId) ?? null;
  if (!sourceField || sourceField.type !== "relation" || !sourceField.relationTargetNodeId) {
    return {};
  }

  const targetTable = model.tablesById.get(sourceField.relationTargetNodeId) ?? null;
  if (!targetTable) return {};

  const sourceFieldByLabel = new Map(
    targetTable.fields.map((field) => [normalizeProcedureImportKey(field.label), field] as const)
  );
  const sourceRecordRef = typeof sourceValue === "string" ? decodeProcedureRecordToken(sourceValue) : null;
  const sourceRecord =
    sourceRecordRef && sourceRecordRef.tableNodeId === targetTable.node.id
      ? targetTable.records.find((record) => record.id === sourceRecordRef.recordId) ?? null
      : null;

  const nextValues: Record<string, ProcedureRecordValue> = {};
  for (const entry of recordFields) {
    if (entry.node.id === sourceFieldId || isProcedureFormulaFieldType(entry.type)) continue;
    const matchingSourceField = sourceFieldByLabel.get(normalizeProcedureImportKey(entry.label)) ?? null;
    if (!matchingSourceField) continue;
    if (!isProcedureFieldCompatibleForAutofill(entry, matchingSourceField)) continue;
    nextValues[entry.node.id] = normalizeDraftValueForField(
      entry,
      sourceRecord ? sourceRecord.values[matchingSourceField.nodeId] : undefined
    );
  }
  return nextValues;
}

function isNodeWithinProcedureScope(
  nodeId: string,
  scopeRootNodeId: string,
  nodeById: Map<string, AppNode>
): boolean {
  const visited = new Set<string>();
  let current = nodeById.get(nodeId) ?? null;
  while (current) {
    if (current.id === scopeRootNodeId) return true;
    if (visited.has(current.id) || !current.parentId || current.parentId === ROOT_PARENT_ID) break;
    visited.add(current.id);
    current = nodeById.get(current.parentId) ?? null;
  }
  return false;
}

function formatProcedureRelationRecordLabel(params: {
  record: ProcedureRecord;
  entry: ProcedureFieldDefinition;
  targetTable: ProcedureTableDefinition | null;
  model: ReturnType<typeof buildProcedureDatabaseModel>;
}): string {
  const { record, entry, targetTable, model } = params;
  if (!targetTable) return record.id;
  const formattedLabel = formatSharedProcedureRecordValue(
    encodeProcedureRecordToken(targetTable.node.id, record.id),
    entry,
    model
  ).trim();
  return formattedLabel.length > 0 && formattedLabel !== "Not answered" ? formattedLabel : record.id;
}

function resolveSectionEditorCurrentStyle(block: HTMLElement | null): SectionEditorBlockStyle {
  if (!block) return "normal";
  const tagName = block.tagName.toUpperCase();
  if (tagName === "H1") return "heading1";
  if (tagName === "H2") return "heading2";
  if (tagName === "H3") return "heading3";
  if (tagName === "H4") return "heading4";
  if (tagName === "H5") return "heading5";
  if (tagName === "H6") return "heading6";
  return "normal";
}

function readSectionTextAlignment(node: AppNode | null | undefined): SectionTextAlignment {
  const value = typeof node?.properties?.[SECTION_TEXT_ALIGNMENT_PROPERTY] === "string"
    ? node.properties?.[SECTION_TEXT_ALIGNMENT_PROPERTY]
    : "";
  return value === "center" || value === "right" || value === "justify" ? value : "left";
}

function normalizeSectionEditorTitleTextAlignment(value: unknown): SectionTextAlignment {
  return value === "center" || value === "right" ? value : "left";
}

function resolveSectionTextAlignmentStyle(alignment: SectionTextAlignment) {
  return alignment === "left" ? undefined : { textAlign: alignment };
}

function serializeProcedureEditorRichText(root: HTMLElement): { content: string; richTextHtml: string | null } {
  const content = serializeProcedureEditorHtmlToText(root);
  const richTextHtml = sanitizeProcedureRichTextHtml(root.innerHTML);
  return {
    content,
    richTextHtml: richTextHtml || null
  };
}

function buildSectionEditorDraft(node: AppNode): SectionEditorDraft {
  return {
    label: node.name,
    titleStyle: readSectionEditorTitleStyle(node),
    numberingHidden: readNodeNumberHidden(node),
    numberingFormat: null,
    numberingStartAt: readNodeNumberStartAt(node),
    textAlignment: readSectionTextAlignment(node),
    content: node.content ?? "",
    richTextHtml: readProcedureRichTextHtml(node)
  };
}

function cloneSectionEditorTitleStyle(
  titleStyle: SectionEditorTitleStyle | null | undefined
): SectionEditorTitleStyle | null {
  return titleStyle ? { ...titleStyle } : null;
}

function buildSectionEditorHistorySnapshot(draft: SectionEditorDraft): SectionEditorHistorySnapshot {
  return {
    label: draft.label,
    titleStyle: cloneSectionEditorTitleStyle(draft.titleStyle),
    numberingHidden: draft.numberingHidden,
    numberingFormat: draft.numberingFormat,
    numberingStartAt: draft.numberingStartAt,
    textAlignment: draft.textAlignment,
    content: draft.content,
    richTextHtml: draft.richTextHtml
  };
}

function areSectionEditorHistorySnapshotsEqual(
  left: SectionEditorHistorySnapshot | null,
  right: SectionEditorHistorySnapshot | null
): boolean {
  if (!left || !right) return left === right;
  return JSON.stringify(left) === JSON.stringify(right);
}

function applySectionEditorHistorySnapshot(
  draft: SectionEditorDraft,
  snapshot: SectionEditorHistorySnapshot
): SectionEditorDraft {
  return {
    ...draft,
    label: snapshot.label,
    titleStyle: cloneSectionEditorTitleStyle(snapshot.titleStyle),
    numberingHidden: snapshot.numberingHidden,
    numberingFormat: snapshot.numberingFormat,
    numberingStartAt: snapshot.numberingStartAt,
    textAlignment: snapshot.textAlignment,
    content: snapshot.content,
    richTextHtml: snapshot.richTextHtml
  };
}

function sanitizeSectionLinkLabel(value: string, fallback: string): string {
  const normalized = value
    .replace(/[\r\n]+/g, " ")
    .replace(/[\[\]\(\)]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized) return normalized;
  return fallback
    .replace(/[\r\n]+/g, " ")
    .replace(/[\[\]\(\)]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripProcedureFileExtension(fileName: string): string {
  const trimmed = fileName.trim();
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot <= 0) return trimmed;
  const baseName = trimmed.slice(0, lastDot).trim();
  return baseName.length > 0 ? baseName : trimmed;
}

function getProcedureFileDisplayTitle(fileName: string): string {
  const stripped = stripProcedureFileExtension(fileName);
  return stripped || fileName.trim() || "File";
}

function resolveProcedureFileLinkLabel(label: string | null | undefined, fileName: string): string {
  const fallback = getProcedureFileDisplayTitle(fileName);
  const candidate = sanitizeSectionLinkLabel(label ?? "", fallback);
  if (!candidate) return fallback;
  const normalizedCandidate = candidate.toLowerCase();
  const normalizedFileName = fileName.trim().toLowerCase();
  if (
    normalizedCandidate === normalizedFileName ||
    normalizedCandidate.includes(`${normalizedFileName}/`) ||
    normalizedCandidate.includes(`${normalizedFileName}\\`) ||
    normalizedCandidate.includes(`/${normalizedFileName}`) ||
    normalizedCandidate.includes(`\\${normalizedFileName}`)
  ) {
    return fallback;
  }
  return candidate;
}

function collectReferencedInlineImageNodeIds(text: string): Set<string> {
  const ids = new Set<string>();
  for (const token of parseProcedureInlineTokens(text)) {
    if (token.type === "image_link" && token.nodeId.trim().length > 0) {
      ids.add(token.nodeId);
    }
  }
  return ids;
}

function isProcedureInlineAssetNode(node: AppNode | null | undefined): boolean {
  return node?.properties?.odeProcedureInlineAsset === true;
}

function resolveNearestProcedureEditableSectionNode(
  node: AppNode | null,
  nodeById: Map<string, AppNode>
): AppNode | null {
  const visited = new Set<string>();
  let current = node;
  while (current) {
    if (!isFileLikeNode(current) && !isProcedureInlineAssetNode(current) && !isProcedureFieldNode(current)) {
      return current;
    }
    if (visited.has(current.id)) break;
    visited.add(current.id);
    if (!current.parentId || current.parentId === ROOT_PARENT_ID) break;
    current = nodeById.get(current.parentId) ?? null;
  }
  return null;
}

function normalizeSectionExternalHref(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return "";
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

function buildProcedureNodePathLabel(
  nodeId: string,
  nodeById: Map<string, AppNode>,
  workspaceRootId: string | null
): string {
  const path: string[] = [];
  const visited = new Set<string>();
  let current = nodeById.get(nodeId) ?? null;
  while (current) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    if (!shouldHideNodeFromGenericUi(current)) {
      path.unshift(getNodeDisplayName(current));
    }
    if ((workspaceRootId && current.id === workspaceRootId) || !current.parentId || current.parentId === ROOT_PARENT_ID) {
      break;
    }
    current = nodeById.get(current.parentId) ?? null;
  }
  if (workspaceRootId && path[0] && getNodeDisplayName(nodeById.get(workspaceRootId) ?? null) === path[0]) {
    path.shift();
  }
  return path.join(" / ");
}

function resolveWorkspaceDisplayName(
  workspaceRootId: string | null,
  projectByRootId: Map<string, ProjectSummary>,
  nodeById: Map<string, AppNode>,
  fallbackName: string | null
): string {
  if (workspaceRootId) {
    return projectByRootId.get(workspaceRootId)?.name || getNodeDisplayName(nodeById.get(workspaceRootId) ?? null) || "Workspace";
  }
  return fallbackName || "Workspace";
}

function escapeProcedureEditorHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeProcedureEditorText(value: string): string {
  return value.replace(/\u00a0/g, " ");
}

function normalizeSectionEditorFontFamilyName(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  const [firstFamily = ""] = trimmed.split(",");
  return firstFamily.trim().replace(/^['"]+|['"]+$/g, "");
}

function buildSectionEditorFontFamilyCssValue(value: string): string {
  const normalized = normalizeSectionEditorFontFamilyName(value);
  if (!normalized) return SECTION_EDITOR_DEFAULT_FONT_STACK;
  return /\s/.test(normalized) ? `"${normalized.replace(/"/g, '\\"')}"` : normalized;
}

function clampSectionEditorFontSizePt(value: number): number {
  return Math.max(8, Math.min(96, Math.round(value)));
}

function normalizeSectionEditorNumberStartAtValue(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function convertSectionEditorPxToPt(value: number): number {
  return (value * 72) / 96;
}

function convertSectionEditorPtToPx(value: number): number {
  return (value * 96) / 72;
}

function parseSectionEditorFontSizePt(value: string | null | undefined): number | null {
  const trimmed = value?.trim().toLowerCase() ?? "";
  if (!trimmed) return null;
  const match = /^(\d+(?:\.\d+)?)(px|pt|rem|em)?$/i.exec(trimmed);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  const unit = (match[2] ?? "pt").toLowerCase();
  if (unit === "pt") return clampSectionEditorFontSizePt(amount);
  if (unit === "px") return clampSectionEditorFontSizePt(convertSectionEditorPxToPt(amount));
  return clampSectionEditorFontSizePt(convertSectionEditorPxToPt(amount * 16));
}

function resolveSectionEditorColorHex(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || typeof document === "undefined") return null;
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
    if (trimmed.length === 4) {
      return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
    }
    return trimmed.toLowerCase();
  }
  const probe = document.createElement("span");
  probe.style.color = trimmed;
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(computed);
  if (!match) return null;
  return `#${[match[1], match[2], match[3]]
    .map((channel) => Number(channel).toString(16).padStart(2, "0"))
    .join("")}`.toLowerCase();
}

function readSectionEditorRecentTextColors(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SECTION_EDITOR_RECENT_TEXT_COLOR_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => (typeof value === "string" ? resolveSectionEditorColorHex(value) : null))
      .filter((value): value is string => Boolean(value))
      .slice(0, SECTION_EDITOR_MAX_RECENT_TEXT_COLORS);
  } catch {
    return [];
  }
}

function mergeSectionEditorRecentTextColors(colors: string[], nextColor: string): string[] {
  const normalized = resolveSectionEditorColorHex(nextColor);
  if (!normalized) return colors;
  return [normalized, ...colors.filter((color) => color !== normalized)].slice(0, SECTION_EDITOR_MAX_RECENT_TEXT_COLORS);
}

function clampSectionEditorColorChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseSectionEditorColorChannelInput(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 255) return null;
  return parsed;
}

function buildSectionEditorColorHexFromChannels(red: number, green: number, blue: number): string {
  return `#${[red, green, blue]
    .map((channel) => clampSectionEditorColorChannel(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

function buildSectionEditorToolbarColorButtonStyle(color: string | null | undefined): {
  backgroundColor: string;
  borderColor: string;
  boxShadow: string;
} {
  const normalized = resolveSectionEditorColorHex(color) ?? SECTION_EDITOR_DEFAULT_PICKER_TEXT_COLOR;
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  return {
    backgroundColor: `rgba(${red}, ${green}, ${blue}, 0.24)`,
    borderColor: `rgba(${red}, ${green}, ${blue}, 0.52)`,
    boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.04), 0 0 0 1px rgba(${red}, ${green}, ${blue}, 0.12)`
  };
}

function buildSectionEditorCustomColorState(
  color: string | null | undefined
): SectionEditorCustomColorState {
  const normalized = resolveSectionEditorColorHex(color) ?? SECTION_EDITOR_DEFAULT_PICKER_TEXT_COLOR;
  return {
    hex: normalized,
    red: `${Number.parseInt(normalized.slice(1, 3), 16)}`,
    green: `${Number.parseInt(normalized.slice(3, 5), 16)}`,
    blue: `${Number.parseInt(normalized.slice(5, 7), 16)}`
  };
}

function readSectionEditorLastTextColor(node: AppNode | null | undefined): string {
  const rawValue = node?.properties?.[SECTION_EDITOR_LAST_TEXT_COLOR_PROPERTY];
  return (
    resolveSectionEditorColorHex(typeof rawValue === "string" ? rawValue : null) ?? SECTION_EDITOR_DEFAULT_PICKER_TEXT_COLOR
  );
}

function buildDefaultSectionEditorFormattingDefaults(): SectionEditorFormattingDefaults {
  return {
    fontFamily: SECTION_EDITOR_DEFAULT_FONT_FAMILY,
    fontSizePt: SECTION_EDITOR_DEFAULT_FONT_SIZE_PT,
    textColor: SECTION_EDITOR_DEFAULT_TEXT_COLOR,
    bold: false,
    italic: false,
    lineSpacing: "default"
  };
}

function buildDefaultSectionEditorTitleDefaults(level: ProcedureHeadingLevel = 1): SectionEditorTitleDefaults {
  const fontSizeByLevel: Record<ProcedureHeadingLevel, number> = {
    1: SECTION_EDITOR_DEFAULT_TITLE_FONT_SIZE_PT,
    2: 20,
    3: 17,
    4: 15,
    5: 13,
    6: 12
  };
  return {
    fontFamily: SECTION_EDITOR_DEFAULT_FONT_FAMILY,
    fontSizePt: fontSizeByLevel[level],
    textColor: SECTION_EDITOR_DEFAULT_TITLE_TEXT_COLOR,
    bold: true,
    italic: false,
    textAlignment: "left"
  };
}

function buildDefaultSectionEditorTitleLevelDefaults(): SectionEditorTitleLevelDefaults {
  return {
    1: buildDefaultSectionEditorTitleDefaults(1),
    2: buildDefaultSectionEditorTitleDefaults(2),
    3: buildDefaultSectionEditorTitleDefaults(3),
    4: buildDefaultSectionEditorTitleDefaults(4),
    5: buildDefaultSectionEditorTitleDefaults(5),
    6: buildDefaultSectionEditorTitleDefaults(6)
  };
}

function buildSectionEditorTitleStyleFromDefaults(
  defaults: SectionEditorTitleDefaults
): SectionEditorTitleStyle {
  return {
    color: defaults.textColor,
    fontFamily: defaults.fontFamily,
    fontSizePt: defaults.fontSizePt,
    bold: defaults.bold,
    italic: defaults.italic,
    textAlignment: defaults.textAlignment
  };
}

function readSectionEditorTitleStyle(node: AppNode | null | undefined): SectionEditorTitleStyle | null {
  const properties = node?.properties;
  if (!properties) return null;
  const color = resolveSectionEditorColorHex(readNodeStringProperty(properties, SECTION_TITLE_COLOR_PROPERTY));
  const fontFamily = normalizeSectionEditorFontFamilyName(
    readNodeStringProperty(properties, SECTION_TITLE_FONT_FAMILY_PROPERTY)
  );
  const rawFontSize = properties[SECTION_TITLE_FONT_SIZE_PT_PROPERTY];
  const fontSizePt =
    typeof rawFontSize === "number" && Number.isFinite(rawFontSize)
      ? clampSectionEditorFontSizePt(rawFontSize)
      : typeof rawFontSize === "string" && rawFontSize.trim().length > 0
        ? parseSectionEditorFontSizePt(rawFontSize)
        : null;
  const rawAlignment =
    typeof properties[SECTION_TITLE_ALIGNMENT_PROPERTY] === "string" ? properties[SECTION_TITLE_ALIGNMENT_PROPERTY] : "";
  const alignment = normalizeSectionEditorTitleTextAlignment(rawAlignment);
  const hasAlignment = typeof properties[SECTION_TITLE_ALIGNMENT_PROPERTY] === "string";
  const bold = typeof properties[SECTION_TITLE_BOLD_PROPERTY] === "boolean" ? properties[SECTION_TITLE_BOLD_PROPERTY] : null;
  const italic =
    typeof properties[SECTION_TITLE_ITALIC_PROPERTY] === "boolean" ? properties[SECTION_TITLE_ITALIC_PROPERTY] : null;
  const nextStyle: SectionEditorTitleStyle = {};
  if (color) nextStyle.color = color;
  if (fontFamily) nextStyle.fontFamily = fontFamily;
  if (fontSizePt !== null) nextStyle.fontSizePt = fontSizePt;
  if (bold !== null) nextStyle.bold = bold;
  if (italic !== null) nextStyle.italic = italic;
  if (hasAlignment) nextStyle.textAlignment = alignment;
  return Object.keys(nextStyle).length > 0 ? nextStyle : null;
}

function buildDefaultSectionEditorHeadingStyle(level: ProcedureHeadingLevel): SectionEditorFormattingDefaults {
  const fontSizeByLevel: Record<ProcedureHeadingLevel, number> = {
    1: 23,
    2: 19,
    3: 14,
    4: 12,
    5: 11,
    6: 10
  };
  const lineSpacingByLevel: Record<ProcedureHeadingLevel, SectionEditorLineSpacingValue> = {
    1: "1.2",
    2: "1.25",
    3: "1.3",
    4: "1.35",
    5: "1.35",
    6: "1.35"
  };
  return {
    fontFamily: SECTION_EDITOR_DEFAULT_FONT_FAMILY,
    fontSizePt: fontSizeByLevel[level],
    textColor: SECTION_EDITOR_DEFAULT_TEXT_COLOR,
    bold: true,
    italic: false,
    lineSpacing: lineSpacingByLevel[level]
  };
}

function buildDefaultSectionEditorHeadingStyleDefaults(): SectionEditorHeadingStyleDefaults {
  return {
    1: buildDefaultSectionEditorHeadingStyle(1),
    2: buildDefaultSectionEditorHeadingStyle(2),
    3: buildDefaultSectionEditorHeadingStyle(3),
    4: buildDefaultSectionEditorHeadingStyle(4),
    5: buildDefaultSectionEditorHeadingStyle(5),
    6: buildDefaultSectionEditorHeadingStyle(6)
  };
}

function readSectionEditorWorkspaceFormattingDefaults(
  node: AppNode | null | undefined
): SectionEditorFormattingDefaults {
  const fallback = buildDefaultSectionEditorFormattingDefaults();
  const rawValue = node?.properties?.[SECTION_BODY_STYLE_PROPERTY];
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return fallback;
  }
  const parsed = rawValue as Record<string, unknown>;
  const fontFamily = normalizeSectionEditorFontFamilyName(typeof parsed.fontFamily === "string" ? parsed.fontFamily : "");
  const parsedFontSize =
    typeof parsed.fontSizePt === "number" && Number.isFinite(parsed.fontSizePt)
      ? parsed.fontSizePt
      : typeof parsed.fontSizePt === "string" && parsed.fontSizePt.trim().length > 0
        ? parseSectionEditorFontSizePt(parsed.fontSizePt)
        : fallback.fontSizePt;
  const fontSizePt = clampSectionEditorFontSizePt(parsedFontSize ?? fallback.fontSizePt);
  const textColor =
    resolveSectionEditorColorHex(typeof parsed.textColor === "string" ? parsed.textColor : "") ?? fallback.textColor;
  const lineSpacing = normalizeSectionEditorLineSpacingValue(parsed.lineSpacing) ?? fallback.lineSpacing;
  return {
    fontFamily: fontFamily || fallback.fontFamily,
    fontSizePt,
    textColor,
    bold: parsed.bold === true,
    italic: parsed.italic === true,
    lineSpacing
  };
}

function readSectionEditorWorkspaceTitleLevelDefaults(
  node: AppNode | null | undefined
): SectionEditorTitleLevelDefaults {
  const fallback = buildDefaultSectionEditorTitleLevelDefaults();
  const rawValue = node?.properties?.[SECTION_TITLE_STYLES_PROPERTY];
  const next = { ...fallback };
  if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)) {
    const parsed = rawValue as Record<string, unknown>;
    for (const level of [1, 2, 3, 4, 5, 6] as const) {
      const rawStyle = parsed[String(level)];
      if (!rawStyle || typeof rawStyle !== "object" || Array.isArray(rawStyle)) continue;
      const entry = rawStyle as Record<string, unknown>;
      const defaultStyle = fallback[level];
      const fontFamily = normalizeSectionEditorFontFamilyName(typeof entry.fontFamily === "string" ? entry.fontFamily : "");
      const parsedFontSize =
        typeof entry.fontSizePt === "number" && Number.isFinite(entry.fontSizePt)
          ? entry.fontSizePt
          : typeof entry.fontSizePt === "string" && entry.fontSizePt.trim().length > 0
            ? parseSectionEditorFontSizePt(entry.fontSizePt)
            : defaultStyle.fontSizePt;
      const rawAlignment = typeof entry.textAlignment === "string" ? entry.textAlignment.trim().toLowerCase() : "";
      const textAlignment = normalizeSectionEditorTitleTextAlignment(rawAlignment);
      next[level] = {
        fontFamily: fontFamily || defaultStyle.fontFamily,
        fontSizePt: clampSectionEditorFontSizePt(parsedFontSize ?? defaultStyle.fontSizePt),
        textColor:
          resolveSectionEditorColorHex(typeof entry.textColor === "string" ? entry.textColor : "") ?? defaultStyle.textColor,
        bold: typeof entry.bold === "boolean" ? entry.bold : defaultStyle.bold,
        italic: typeof entry.italic === "boolean" ? entry.italic : defaultStyle.italic,
        textAlignment
      };
    }
    return next;
  }
  const legacyTitleStyle = readSectionEditorTitleStyle(node);
  if (!legacyTitleStyle) return next;
  for (const level of [1, 2, 3, 4, 5, 6] as const) {
    next[level] = {
      ...next[level],
      fontFamily: legacyTitleStyle.fontFamily ?? next[level].fontFamily,
      fontSizePt: level === 1 && typeof legacyTitleStyle.fontSizePt === "number" ? legacyTitleStyle.fontSizePt : next[level].fontSizePt,
      textColor: legacyTitleStyle.color ?? next[level].textColor,
      bold: typeof legacyTitleStyle.bold === "boolean" ? legacyTitleStyle.bold : next[level].bold,
      italic: typeof legacyTitleStyle.italic === "boolean" ? legacyTitleStyle.italic : next[level].italic,
      textAlignment: normalizeSectionEditorTitleTextAlignment(legacyTitleStyle.textAlignment ?? next[level].textAlignment)
    };
  }
  return next;
}

function readSectionEditorWorkspaceHeadingStyleDefaults(
  node: AppNode | null | undefined
): SectionEditorHeadingStyleDefaults {
  const fallback = buildDefaultSectionEditorHeadingStyleDefaults();
  const rawValue = node?.properties?.[SECTION_BODY_HEADING_STYLES_PROPERTY];
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return fallback;
  }
  const parsed = rawValue as Record<string, unknown>;
  const next = { ...fallback };
  for (const level of [1, 2, 3, 4, 5, 6] as const) {
    const rawStyle = parsed[String(level)];
    if (!rawStyle || typeof rawStyle !== "object" || Array.isArray(rawStyle)) {
      continue;
    }
    const entry = rawStyle as Record<string, unknown>;
    const defaultStyle = fallback[level];
    const fontFamily = normalizeSectionEditorFontFamilyName(typeof entry.fontFamily === "string" ? entry.fontFamily : "");
    const parsedFontSize =
      typeof entry.fontSizePt === "number" && Number.isFinite(entry.fontSizePt)
        ? entry.fontSizePt
        : typeof entry.fontSizePt === "string" && entry.fontSizePt.trim().length > 0
          ? parseSectionEditorFontSizePt(entry.fontSizePt)
          : defaultStyle.fontSizePt;
    next[level] = {
      fontFamily: fontFamily || defaultStyle.fontFamily,
      fontSizePt: clampSectionEditorFontSizePt(parsedFontSize ?? defaultStyle.fontSizePt),
      textColor: resolveSectionEditorColorHex(typeof entry.textColor === "string" ? entry.textColor : "") ?? defaultStyle.textColor,
      bold: typeof entry.bold === "boolean" ? entry.bold : defaultStyle.bold,
      italic: typeof entry.italic === "boolean" ? entry.italic : defaultStyle.italic,
      lineSpacing: normalizeSectionEditorLineSpacingValue(entry.lineSpacing) ?? defaultStyle.lineSpacing
    };
  }
  return next;
}

function areSectionEditorFormattingDefaultsEqual(
  left: SectionEditorFormattingDefaults,
  right: SectionEditorFormattingDefaults
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function areSectionEditorTitleDefaultsEqual(left: SectionEditorTitleDefaults, right: SectionEditorTitleDefaults): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function areSectionEditorTitleLevelDefaultsEqual(
  left: SectionEditorTitleLevelDefaults,
  right: SectionEditorTitleLevelDefaults
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function areSectionEditorHeadingStyleDefaultsEqual(
  left: SectionEditorHeadingStyleDefaults,
  right: SectionEditorHeadingStyleDefaults
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function resolveSectionEditorLineSpacingCssValue(
  value: SectionEditorLineSpacingValue,
  fallback: string
): string {
  return value === "default" ? fallback : normalizeSectionEditorLineSpacingValue(value) ?? fallback;
}

function buildSectionEditorRichDocumentStyle(
  bodyStyle: SectionEditorFormattingDefaults,
  headingStyles: SectionEditorHeadingStyleDefaults
): CSSProperties {
  const style: Record<string, string | number> = {
    "--ode-procedure-body-font-family": buildSectionEditorFontFamilyCssValue(bodyStyle.fontFamily),
    "--ode-procedure-body-font-size": `${clampSectionEditorFontSizePt(bodyStyle.fontSizePt)}pt`,
    "--ode-procedure-body-line-height": resolveSectionEditorLineSpacingCssValue(bodyStyle.lineSpacing, "1"),
    "--ode-procedure-body-color": bodyStyle.textColor,
    "--ode-procedure-body-font-weight": bodyStyle.bold ? 700 : 400,
    "--ode-procedure-body-font-style": bodyStyle.italic ? "italic" : "normal"
  };
  for (const level of [1, 2, 3, 4, 5, 6] as const) {
    const headingStyle = headingStyles[level];
    style[`--ode-procedure-heading-${level}-font-family`] = buildSectionEditorFontFamilyCssValue(
      headingStyle.fontFamily
    );
    style[`--ode-procedure-heading-${level}-font-size`] = `${clampSectionEditorFontSizePt(headingStyle.fontSizePt)}pt`;
    style[`--ode-procedure-heading-${level}-line-height`] = resolveSectionEditorLineSpacingCssValue(
      headingStyle.lineSpacing,
      level <= 2 ? "1.25" : "1.35"
    );
    style[`--ode-procedure-heading-${level}-color`] = headingStyle.textColor;
    style[`--ode-procedure-heading-${level}-font-weight`] = headingStyle.bold ? 700 : 400;
    style[`--ode-procedure-heading-${level}-font-style`] = headingStyle.italic ? "italic" : "normal";
  }
  return style as CSSProperties;
}

function resolveSectionEditorHeadingLevel(style: SectionEditorBlockStyle): ProcedureHeadingLevel | null {
  if (style === "heading1") return 1;
  if (style === "heading2") return 2;
  if (style === "heading3") return 3;
  if (style === "heading4") return 4;
  if (style === "heading5") return 5;
  if (style === "heading6") return 6;
  return null;
}

function resolveSectionEditorStyleOption(
  style: SectionEditorBlockStyle
): (typeof SECTION_EDITOR_STYLE_OPTIONS)[number] | null {
  return SECTION_EDITOR_STYLE_OPTIONS.find((option) => option.value === style) ?? null;
}

function collectSectionEditorHeadingLevelsFromHtml(
  richTextHtml: string | null | undefined,
  levels: Set<ProcedureHeadingLevel>
) {
  const html = richTextHtml?.trim() ?? "";
  if (!html) return;
  const matcher = /<h([1-6])\b/gi;
  let match: RegExpExecArray | null = null;
  while ((match = matcher.exec(html)) !== null) {
    const parsedLevel = Number.parseInt(match[1] ?? "", 10);
    if (parsedLevel >= 1 && parsedLevel <= 6) {
      levels.add(parsedLevel as ProcedureHeadingLevel);
    }
  }
}

function collectSectionEditorHeadingLevelsFromContent(
  content: string | null | undefined,
  levels: Set<ProcedureHeadingLevel>
) {
  const text = content?.trim() ?? "";
  if (!text) return;
  const matcher = /^(#{1,6})\s+\S/gm;
  let match: RegExpExecArray | null = null;
  while ((match = matcher.exec(text)) !== null) {
    const parsedLevel = match[1]?.length ?? 0;
    if (parsedLevel >= 1 && parsedLevel <= 6) {
      levels.add(parsedLevel as ProcedureHeadingLevel);
    }
  }
}

function resolveProcedureSectionTitleLevel(
  nodeId: string | null | undefined,
  visibleRootId: string | null | undefined,
  nodeById: Map<string, AppNode>
): ProcedureHeadingLevel {
  if (!nodeId || !visibleRootId) return 1;
  let level = 1;
  let current = nodeById.get(nodeId) ?? null;
  const visited = new Set<string>();
  while (current && current.id !== visibleRootId) {
    if (visited.has(current.id) || !current.parentId || current.parentId === ROOT_PARENT_ID) break;
    visited.add(current.id);
    current = nodeById.get(current.parentId) ?? null;
    level += 1;
  }
  return Math.max(1, Math.min(6, level)) as ProcedureHeadingLevel;
}

function resolveSectionEditorEffectiveTitleStyle(
  titleStyle: SectionEditorTitleStyle | null | undefined,
  defaults: SectionEditorTitleDefaults
) {
  return {
    color: titleStyle?.color ?? defaults.textColor,
    fontFamily: titleStyle?.fontFamily ?? defaults.fontFamily,
    fontSizePt: titleStyle?.fontSizePt ?? defaults.fontSizePt,
    bold: typeof titleStyle?.bold === "boolean" ? titleStyle.bold : defaults.bold,
    italic: typeof titleStyle?.italic === "boolean" ? titleStyle.italic : defaults.italic,
    textAlignment: titleStyle?.textAlignment ?? defaults.textAlignment
  };
}

function buildSectionEditorTitleTextStyle(titleStyle: SectionEditorTitleStyle | null | undefined): CSSProperties | undefined {
  if (!titleStyle) return undefined;
  const style: CSSProperties = {};
  if (titleStyle.color) {
    style.color = titleStyle.color;
    style.WebkitTextFillColor = titleStyle.color;
  }
  if (titleStyle.fontFamily) {
    style.fontFamily = buildSectionEditorFontFamilyCssValue(titleStyle.fontFamily);
  }
  if (typeof titleStyle.fontSizePt === "number") {
    style.fontSize = `${clampSectionEditorFontSizePt(titleStyle.fontSizePt)}pt`;
  }
  if (typeof titleStyle.bold === "boolean") {
    style.fontWeight = titleStyle.bold ? 700 : 400;
  }
  if (typeof titleStyle.italic === "boolean") {
    style.fontStyle = titleStyle.italic ? "italic" : "normal";
  }
  if (titleStyle.textAlignment && titleStyle.textAlignment !== "left") {
    style.textAlign = titleStyle.textAlignment;
  }
  return Object.keys(style).length > 0 ? style : undefined;
}

function parseSectionEditorCssLengthPx(value: string | null | undefined): number | null {
  const trimmed = value?.trim().toLowerCase() ?? "";
  if (!trimmed) return null;
  if (trimmed === "0") return 0;
  const match = /^(-?\d+(?:\.\d+)?)(px|pt|rem|em)$/.exec(trimmed);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  const unit = match[2];
  if (unit === "px") return amount;
  if (unit === "pt") return amount * (96 / 72);
  return amount * 16;
}

function clampSectionEditorIndentPx(value: number): number {
  return Math.max(0, Math.min(SECTION_EDITOR_MAX_INDENT_PX, Math.round(value)));
}

function formatSectionEditorLineSpacingNumber(value: number): string {
  return `${Number(value.toFixed(2))}`;
}

function normalizeSectionEditorLineSpacingValue(value: unknown): SectionEditorLineSpacingValue | null {
  if (value === "default") return "default";
  if (typeof value === "string") {
    const trimmed = value.trim().replace(",", ".");
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0.8 || parsed > 4) return null;
    return Math.abs(parsed - 1) <= 0.02 ? "default" : formatSectionEditorLineSpacingNumber(parsed);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0.8 || value > 4) return null;
    return Math.abs(value - 1) <= 0.02 ? "default" : formatSectionEditorLineSpacingNumber(value);
  }
  return null;
}

function parseSectionEditorLineHeightMultiplier(value: string | null | undefined, fontSizePx: number): number | null {
  const trimmed = value?.trim().toLowerCase() ?? "";
  if (!trimmed || trimmed === "normal") return null;
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const amount = Number(trimmed);
    if (!Number.isFinite(amount) || amount < 0.8 || amount > 4) return null;
    return Number(amount.toFixed(2));
  }
  const percentageMatch = /^(\d+(?:\.\d+)?)%$/.exec(trimmed);
  if (percentageMatch) {
    const amount = Number(percentageMatch[1]) / 100;
    if (!Number.isFinite(amount) || amount < 0.8 || amount > 4) return null;
    return Number(amount.toFixed(2));
  }
  if (fontSizePx <= 0) return null;
  const absoluteValuePx = parseSectionEditorCssLengthPx(trimmed);
  if (absoluteValuePx === null) return null;
  const amount = absoluteValuePx / fontSizePx;
  if (!Number.isFinite(amount) || amount < 0.8 || amount > 4) return null;
  return Number(amount.toFixed(2));
}

function resolveSectionEditorLineSpacingValue(multiplier: number | null): SectionEditorLineSpacingValue {
  if (multiplier === null) return "default";
  return normalizeSectionEditorLineSpacingValue(multiplier) ?? "default";
}

function getSectionEditorLineSpacingDisplayValue(value: SectionEditorLineSpacingValue): string {
  return value === "default" ? "1" : normalizeSectionEditorLineSpacingValue(value) ?? "1";
}

function mergeSectionEditorFontFamilies(fonts: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const font of fonts) {
    const normalized = normalizeSectionEditorFontFamilyName(font);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function normalizeProcedurePastedPlainText(value: string): string {
  return normalizeProcedureEditorText(value)
    .replace(/\r\n/g, "\n")
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeSectionEditorTitleClipboardText(value: string): string {
  return normalizeProcedureEditorText(value)
    .replace(/\r\n/g, "\n")
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ");
}

async function writeSectionEditorClipboardText(value: string): Promise<boolean> {
  try {
    await writeClipboardText(value);
    return true;
  } catch {
    // Fall through to browser clipboard support.
  }
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Ignore and report failure.
    }
  }
  return false;
}

async function readSectionEditorClipboardText(): Promise<string> {
  try {
    return await readClipboardText();
  } catch {
    // Fall through to browser clipboard support.
  }
  if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
    try {
      return await navigator.clipboard.readText();
    } catch {
      // Ignore and report empty clipboard text.
    }
  }
  return "";
}

async function readSectionEditorClipboardPayload(): Promise<{ html: string; text: string }> {
  let html = "";
  let text = "";
  if (typeof navigator !== "undefined" && navigator.clipboard?.read) {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (!html && item.types.includes("text/html")) {
          html = await (await item.getType("text/html")).text();
        }
        if (!text && item.types.includes("text/plain")) {
          text = await (await item.getType("text/plain")).text();
        }
        if (html && text) break;
      }
    } catch {
      // Fall back to plain-text clipboard access below.
    }
  }
  if (!text) {
    text = await readSectionEditorClipboardText();
  }
  return { html, text };
}

function buildProcedureEditorLinkStyle(): string {
  return [
    "color:#2d7ebe",
    "font-style:italic",
    "text-decoration:underline",
    "text-decoration-color:rgba(45,126,190,0.42)"
  ].join(";");
}

function buildProcedureEditorAppLinkStyle(): string {
  return [
    "display:inline-flex",
    "align-items:center",
    "justify-content:center",
    "vertical-align:middle",
    "margin:0 0.18rem",
    "text-decoration:none",
    "font-style:normal"
  ].join(";");
}

function buildProcedureEditorImageStyle(): string {
  return [
    "display:inline-block",
    "vertical-align:middle",
    "width:320px",
    "max-width:100%",
    "height:auto",
    "margin:0.35rem 0.25rem",
    "border-radius:14px",
    "border:1px solid rgba(110,211,255,0.2)",
    "object-fit:cover",
    "cursor:pointer"
  ].join(";");
}

function buildProcedureEditorTableCellStyle(header = false): string {
  return [
    "border:1px solid #cbd5e1",
    "padding:8px 10px",
    "vertical-align:top",
    header ? "background:#e2e8f0" : "background:#ffffff",
    header ? "font-weight:700" : ""
  ]
    .filter(Boolean)
    .join(";");
}

function buildProcedureEditorTableHtml(rows = 3, columns = 3, markerId?: string): string {
  const normalizedRows = Math.max(1, Math.min(SECTION_EDITOR_INSERT_TABLE_GRID_ROWS, Math.round(rows)));
  const normalizedColumns = Math.max(1, Math.min(SECTION_EDITOR_INSERT_TABLE_GRID_COLUMNS, Math.round(columns)));
  const bodyRows = Array.from({ length: normalizedRows }, () => {
    return `<tr>${Array.from({ length: normalizedColumns }, () => `<td style="${buildProcedureEditorTableCellStyle()}"><br></td>`).join("")}</tr>`;
  }).join("");
  const markerAttribute =
    markerId && markerId.trim().length > 0
      ? ` data-ode-editor-table-id="${escapeProcedureEditorHtml(markerId.trim())}"`
      : "";
  return [
    `<table${markerAttribute} style="width:100%;border-collapse:collapse;table-layout:fixed;margin:0.5rem 0 1rem 0;">`,
    "<tbody>",
    bodyRows,
    "</tbody>",
    "</table>",
    "<p><br></p>"
  ].join("");
}

function deriveProcedureAppBadgeText(label: string): string {
  const parts = label.match(/[A-Za-z0-9]+/g) ?? [];
  if (parts.length === 0) return "A";
  const first = parts[0] ?? "";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase() || "A";
  const second = parts[1] ?? "";
  return `${first.slice(0, 1)}${second.slice(0, 1)}`.toUpperCase() || "A";
}

function resolveProcedureAppBadgeVisual(item: {
  label: string;
  kind: NodeQuickAppItem["kind"];
  target: string;
  iconKey?: NodeQuickAppIconKey | null;
  customIconDataUrl?: string | null;
}) {
  const preferredIconKey = resolveQuickAppPreferredIconKey({
    kind: item.kind,
    label: item.label,
    target: item.target,
    iconKey: item.iconKey ?? "auto"
  });
  const palette = (() => {
    switch (preferredIconKey) {
      case "teams":
        return { bg: "rgba(98,111,255,0.18)", border: "rgba(122,141,255,0.42)", text: "#d7deff", badge: "T" };
      case "whatsapp":
        return { bg: "rgba(49,181,112,0.18)", border: "rgba(92,215,143,0.42)", text: "#d4ffe5", badge: "WA" };
      case "telegram":
        return { bg: "rgba(53,156,237,0.18)", border: "rgba(98,186,255,0.44)", text: "#d9f1ff", badge: "TG" };
      case "outlook":
        return { bg: "rgba(43,134,255,0.18)", border: "rgba(93,170,255,0.42)", text: "#d8ecff", badge: "O" };
      case "sharepoint":
        return { bg: "rgba(16,137,126,0.18)", border: "rgba(74,193,178,0.42)", text: "#d6fff9", badge: "SP" };
      case "excel":
        return { bg: "rgba(33,145,88,0.18)", border: "rgba(83,205,136,0.42)", text: "#dbffea", badge: "X" };
      case "word":
        return { bg: "rgba(53,112,255,0.18)", border: "rgba(106,154,255,0.44)", text: "#dbe9ff", badge: "W" };
      case "powerpoint":
        return { bg: "rgba(229,109,52,0.18)", border: "rgba(255,146,94,0.42)", text: "#ffe6da", badge: "P" };
      case "drive":
        return { bg: "rgba(54,176,102,0.16)", border: "rgba(108,216,149,0.4)", text: "#e0ffe8", badge: "D" };
      case "notion":
        return { bg: "rgba(255,255,255,0.08)", border: "rgba(255,255,255,0.22)", text: "#f4f7fb", badge: "N" };
      case "jira":
        return { bg: "rgba(38,132,255,0.18)", border: "rgba(93,168,255,0.44)", text: "#ddeeff", badge: "J" };
      case "chat":
        return { bg: "rgba(131,104,255,0.18)", border: "rgba(166,146,255,0.42)", text: "#e5ddff", badge: "C" };
      case "mail":
        return { bg: "rgba(93,164,255,0.16)", border: "rgba(126,189,255,0.38)", text: "#dcebff", badge: "M" };
      case "folder":
        return { bg: "rgba(255,214,84,0.18)", border: "rgba(255,227,131,0.42)", text: "#fff1bf", badge: "F" };
      case "office":
        return { bg: "rgba(255,126,74,0.18)", border: "rgba(255,161,118,0.42)", text: "#ffe2d3", badge: "O" };
      case "link":
        return { bg: "rgba(69,182,233,0.16)", border: "rgba(110,211,255,0.36)", text: "#d7f5ff", badge: deriveProcedureAppBadgeText(item.label) };
      case "app":
      default:
        return { bg: "rgba(69,182,233,0.16)", border: "rgba(110,211,255,0.36)", text: "#d7f5ff", badge: deriveProcedureAppBadgeText(item.label) };
    }
  })();

  return {
    ...palette,
    preferredIconKey,
    customIconDataUrl: item.customIconDataUrl ?? null
  };
}

function buildProcedureAppLinkBadgeHtml(item: {
  label: string;
  kind: NodeQuickAppItem["kind"];
  target: string;
  iconKey?: NodeQuickAppIconKey | null;
  customIconDataUrl?: string | null;
}) {
  const visual = resolveProcedureAppBadgeVisual(item);
  if (visual.customIconDataUrl) {
    return `<span contenteditable="false" style="display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;"><img src="${escapeProcedureEditorHtml(visual.customIconDataUrl)}" alt="" draggable="false" style="display:block;height:20px;width:20px;object-fit:contain;" /></span>`;
  }
  return `<span contenteditable="false" style="display:inline-flex;min-width:24px;height:24px;align-items:center;justify-content:center;border-radius:8px;border:1px solid ${visual.border};background:${visual.bg};padding:0 6px;"><span style="font-size:0.68rem;font-weight:700;letter-spacing:0.02em;line-height:1;text-transform:uppercase;color:${visual.text};">${escapeProcedureEditorHtml(visual.badge)}</span></span>`;
}

function renderProcedureAppLinkBadgeNode(item: {
  label: string;
  kind: NodeQuickAppItem["kind"];
  target: string;
  iconKey?: NodeQuickAppIconKey | null;
  customIconDataUrl?: string | null;
}) {
  return (
    <QuickAppIcon
      item={{
        id: `procedure-app-${item.kind}-${item.target}`,
        label: item.label,
        kind: item.kind,
        target: item.target,
        iconKey: item.iconKey ?? "auto",
        customIconDataUrl: item.customIconDataUrl ?? null
      }}
      variant="dock"
    />
  );
}

function inlineProcedureTextToEditorHtml(
  text: string,
  nodeById?: Map<string, AppNode>,
  imagePreviewSrcByNodeId?: Record<string, string>
): string {
  return parseProcedureInlineTokens(text)
    .map((token) => {
      if (token.type === "text") {
        return escapeProcedureEditorHtml(token.value).replace(/\n/g, "<br>");
      }
      if (token.type === "bold") {
        return `<strong>${escapeProcedureEditorHtml(token.value)}</strong>`;
      }
      if (token.type === "italic") {
        return `<em>${escapeProcedureEditorHtml(token.value)}</em>`;
      }
      if (token.type === "node_link") {
        const linkedNode = nodeById?.get(token.nodeId) ?? null;
        const label = escapeProcedureEditorHtml(
          linkedNode?.type === "file"
            ? resolveProcedureFileLinkLabel(token.label, linkedNode.name)
            : token.label || linkedNode?.name || "Node"
        );
        const href = `ode://node/${encodeURIComponent(token.nodeId)}`;
        return `<a href="${escapeProcedureEditorHtml(href)}" data-ode-link-type="node" data-node-id="${escapeProcedureEditorHtml(token.nodeId)}" style="${buildProcedureEditorLinkStyle()}">${label}</a>`;
      }
      if (token.type === "record_link") {
        const href = encodeProcedureRecordToken(token.tableNodeId, token.recordId);
        const label = escapeProcedureEditorHtml(token.label || "Record");
        return `<a href="${escapeProcedureEditorHtml(href)}" data-ode-link-type="record" data-table-node-id="${escapeProcedureEditorHtml(token.tableNodeId)}" data-record-id="${escapeProcedureEditorHtml(token.recordId)}" style="${buildProcedureEditorLinkStyle()}">${label}</a>`;
      }
      if (token.type === "image_link") {
        const linkedNode = nodeById?.get(token.nodeId) ?? null;
        const previewSrc =
          linkedNode ? imagePreviewSrcByNodeId?.[linkedNode.id] ?? resolveDesktopPreviewSrc(linkedNode) : null;
        const alt = escapeProcedureEditorHtml(
          sanitizeSectionLinkLabel(
            token.alt,
            linkedNode ? getProcedureFileDisplayTitle(linkedNode.name) : "Image"
          )
        );
        if (!linkedNode || !previewSrc) {
          const href = `ode://node/${encodeURIComponent(token.nodeId)}`;
          return `<a href="${escapeProcedureEditorHtml(href)}" data-ode-link-type="node" data-node-id="${escapeProcedureEditorHtml(token.nodeId)}" style="${buildProcedureEditorLinkStyle()}">${alt}</a>`;
        }
        return `<img src="${escapeProcedureEditorHtml(previewSrc)}" alt="${alt}" data-ode-link-type="image" data-node-id="${escapeProcedureEditorHtml(token.nodeId)}" data-image-alt="${alt}" contenteditable="false" draggable="false" style="${buildProcedureEditorImageStyle()}" />`;
      }
      if (token.type === "app_link") {
        const appLabel = token.appName || token.label || "App";
        const href = encodeProcedureAppLinkPayload({
          appId: token.appId ?? null,
          appName: token.appName ?? token.label ?? null,
          kind: token.kind,
          target: token.target,
          iconKey: token.iconKey ?? null,
          customIconDataUrl: token.customIconDataUrl ?? null,
          sourceNodeId: token.sourceNodeId ?? null,
          sourceNodeName: token.sourceNodeName ?? null,
          workspaceName: token.workspaceName ?? null
        });
      return `<a href="${escapeProcedureEditorHtml(href)}" data-ode-link-type="app" data-link-label="${escapeProcedureEditorHtml(appLabel)}" aria-label="${escapeProcedureEditorHtml(appLabel)}" contenteditable="false" draggable="false" style="${buildProcedureEditorAppLinkStyle()}">${buildProcedureAppLinkBadgeHtml({
          label: appLabel,
          kind: token.kind,
          target: token.target,
          iconKey: token.iconKey ?? null,
          customIconDataUrl: token.customIconDataUrl ?? null
        })}</a>`;
      }
      return `<a href="${escapeProcedureEditorHtml(token.href)}" data-ode-link-type="website" target="_blank" rel="noreferrer" style="${buildProcedureEditorLinkStyle()}">${escapeProcedureEditorHtml(token.label)}</a>`;
    })
    .join("");
}

function procedureTextToEditorHtml(
  text: string,
  nodeById?: Map<string, AppNode>,
  imagePreviewSrcByNodeId?: Record<string, string>
): string {
  const trimmed = text.trim();
  if (!trimmed) return "<p><br></p>";
  return parseProcedureBlocks(text)
    .map((block) => {
      if (block.type === "heading") {
        const tagName = `h${block.level}`;
        return `<${tagName}>${inlineProcedureTextToEditorHtml(block.text, nodeById, imagePreviewSrcByNodeId)}</${tagName}>`;
      }
      if (block.type === "paragraph") {
        return `<p>${block.lines
          .map((line) => inlineProcedureTextToEditorHtml(line, nodeById, imagePreviewSrcByNodeId))
          .join("<br>")}</p>`;
      }
      if (block.type === "bullets") {
        return `<ul>${block.items
          .map((item) => `<li>${inlineProcedureTextToEditorHtml(item, nodeById, imagePreviewSrcByNodeId)}</li>`)
          .join("")}</ul>`;
      }
      if (block.type === "numbers") {
        return `<ol>${block.items
          .map((item) => `<li>${inlineProcedureTextToEditorHtml(item, nodeById, imagePreviewSrcByNodeId)}</li>`)
          .join("")}</ol>`;
      }
      if (block.type === "quote") {
        return `<blockquote>${block.lines
          .map((line) => `<p>${inlineProcedureTextToEditorHtml(line, nodeById, imagePreviewSrcByNodeId)}</p>`)
          .join("")}</blockquote>`;
      }
      if (block.type === "code") {
        return `<pre data-language="${escapeProcedureEditorHtml(block.language)}"><code>${escapeProcedureEditorHtml(block.code)}</code></pre>`;
      }
      if (block.type === "divider") {
        return "<hr>";
      }
      if (block.type === "page_break") {
        return '<hr data-ode-page-break="true">';
      }
      return `<div data-insight-domain="${escapeProcedureEditorHtml(block.domain)}">${block.lines
        .map((line) => `<p>${inlineProcedureTextToEditorHtml(line, nodeById, imagePreviewSrcByNodeId)}</p>`)
        .join("")}</div>`;
    })
    .join("");
}

function isProcedureEditorBlockTag(tagName: string): boolean {
  return (
    tagName === "p" ||
    tagName === "div" ||
    tagName === "h1" ||
    tagName === "h2" ||
    tagName === "h3" ||
    tagName === "h4" ||
    tagName === "h5" ||
    tagName === "h6" ||
    tagName === "ul" ||
    tagName === "ol" ||
    tagName === "blockquote" ||
    tagName === "pre" ||
    tagName === "hr" ||
    tagName === "table"
  );
}

function isProcedureEditorIgnoredElement(element: HTMLElement): boolean {
  const tagName = element.tagName.toLowerCase();
  if (
    tagName === "button" ||
    tagName === "input" ||
    tagName === "select" ||
    tagName === "textarea" ||
    tagName === "option" ||
    tagName === "label" ||
    tagName === "svg" ||
    tagName === "path" ||
    tagName === "style" ||
    tagName === "script"
  ) {
    return true;
  }
  return element.getAttribute("data-ode-editor-ui") === "true";
}

function isProcedurePasteBlockTag(tagName: string): boolean {
  return (
    tagName === "p" ||
    tagName === "div" ||
    tagName === "section" ||
    tagName === "article" ||
    tagName === "header" ||
    tagName === "footer" ||
    tagName === "main" ||
    tagName === "aside" ||
    tagName === "h1" ||
    tagName === "h2" ||
    tagName === "h3" ||
    tagName === "h4" ||
    tagName === "h5" ||
    tagName === "h6" ||
    tagName === "ul" ||
    tagName === "ol" ||
    tagName === "li" ||
    tagName === "blockquote" ||
    tagName === "pre" ||
    tagName === "hr" ||
    tagName === "table" ||
    tagName === "thead" ||
    tagName === "tbody" ||
    tagName === "tfoot" ||
    tagName === "tr"
  );
}

function readProcedurePasteStyleValue(element: HTMLElement, property: string): string {
  const style = element.getAttribute("style") ?? "";
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escapedProperty}\\s*:\\s*([^;]+)`, "i").exec(style);
  return match?.[1]?.trim() ?? "";
}

function parseProcedurePastePixelSize(value: string): number | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  const match = /^(-?\d+(?:\.\d+)?)(px|pt|rem|em)$/.exec(trimmed);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  const unit = match[2];
  if (unit === "px") return amount;
  if (unit === "pt") return amount * (96 / 72);
  return amount * 16;
}

function parseProcedurePasteFontWeight(value: string): number | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed === "bold") return 700;
  if (trimmed === "normal") return 400;
  const amount = Number(trimmed);
  return Number.isFinite(amount) ? amount : null;
}

function collectProcedurePasteTypographySignals(element: HTMLElement): {
  maxFontSize: number | null;
  maxFontWeight: number;
} {
  let maxFontSize: number | null = null;
  let maxFontWeight = 0;

  const visit = (node: Node) => {
    if (!(node instanceof HTMLElement)) return;
    const tagName = node.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tagName) || tagName === "strong" || tagName === "b") {
      maxFontWeight = Math.max(maxFontWeight, 700);
    }
    const fontSize = parseProcedurePastePixelSize(readProcedurePasteStyleValue(node, "font-size"));
    if (fontSize !== null) {
      maxFontSize = maxFontSize === null ? fontSize : Math.max(maxFontSize, fontSize);
    }
    const fontWeight = parseProcedurePasteFontWeight(readProcedurePasteStyleValue(node, "font-weight"));
    if (fontWeight !== null) {
      maxFontWeight = Math.max(maxFontWeight, fontWeight);
    }
    Array.from(node.childNodes).forEach(visit);
  };

  visit(element);
  return { maxFontSize, maxFontWeight };
}

function inferProcedurePasteHeadingLevel(element: HTMLElement, text: string): ProcedureHeadingLevel | null {
  const tagName = element.tagName.toLowerCase();
  if (tagName === "h1") return 1;
  if (tagName === "h2") return 2;
  if (tagName === "h3") return 3;
  if (tagName === "h4") return 4;
  if (tagName === "h5") return 5;
  if (tagName === "h6") return 6;

  const role = (element.getAttribute("role") ?? "").trim().toLowerCase();
  const ariaLevel = Number.parseInt((element.getAttribute("aria-level") ?? "").trim(), 10);
  if (role === "heading" && Number.isFinite(ariaLevel) && ariaLevel > 0) {
    return Math.max(1, Math.min(6, ariaLevel)) as ProcedureHeadingLevel;
  }

  const normalizedText = text.replace(/\s+/g, " ").trim();
  if (!normalizedText) return null;
  if (normalizedText.length > 140) return null;
  if (normalizedText.includes("\n")) return null;
  if (/^\s*[-*•]\s+/.test(normalizedText) || /^\s*\d+\.\s+/.test(normalizedText)) return null;
  if (/[.!?;:]$/.test(normalizedText) && normalizedText.length > 60) return null;

  const { maxFontSize, maxFontWeight } = collectProcedurePasteTypographySignals(element);
  if (maxFontSize !== null) {
    if (maxFontSize >= 30) return 1;
    if (maxFontSize >= 24) return 2;
    if (maxFontSize >= 18) return 3;
    if (maxFontSize >= 16 && maxFontWeight >= 600) return 4;
    if (maxFontSize >= 14 && maxFontWeight >= 600) return 5;
    if (maxFontSize >= 13 && maxFontWeight >= 600) return 6;
  }
  if (maxFontWeight >= 700 && normalizedText.length <= 80) return 4;
  return null;
}

function sanitizeProcedurePasteHref(rawHref: string): string | null {
  const href = rawHref.trim();
  if (!href) return null;
  if (/^\/\//.test(href)) return `https:${href}`;
  if (/^(https?:|mailto:|tel:|ode:\/\/)/i.test(href)) return href;
  return null;
}

function serializeProcedurePasteInline(nodes: ArrayLike<ChildNode>): string {
  let result = "";
  for (const node of Array.from(nodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += normalizeProcedureEditorText(node.textContent ?? "");
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();
    if (tagName === "br") {
      result += "\n";
      continue;
    }
    if (tagName === "img") {
      const alt = normalizeProcedureEditorText(element.getAttribute("alt") ?? "").trim();
      if (alt) {
        result += alt;
      }
      continue;
    }

    const childText = serializeProcedurePasteInline(element.childNodes);
    const fontWeight = parseProcedurePasteFontWeight(readProcedurePasteStyleValue(element, "font-weight"));
    const isBold = tagName === "strong" || tagName === "b" || (fontWeight !== null && fontWeight >= 600);
    if (isBold) {
      result += childText.trim().length > 0 ? `**${childText}**` : childText;
      continue;
    }

    const isItalic =
      tagName === "em" ||
      tagName === "i" ||
      readProcedurePasteStyleValue(element, "font-style").toLowerCase() === "italic";
    if (isItalic) {
      result += childText.trim().length > 0 ? `*${childText}*` : childText;
      continue;
    }

    if (tagName === "a") {
      const href = sanitizeProcedurePasteHref(element.getAttribute("href") ?? "");
      const label = sanitizeSectionLinkLabel(
        childText.trim() || normalizeProcedureEditorText(element.textContent ?? "").trim(),
        "Link"
      );
      result += href ? `[${label}](${href})` : childText;
      continue;
    }

    result += childText;
  }
  return result;
}

function collectProcedurePasteSegmentsFromChildren(parent: ParentNode): string[] {
  const segments: string[] = [];
  let inlineNodes: ChildNode[] = [];

  const flushInlineNodes = () => {
    if (inlineNodes.length === 0) return;
    const inlineText = serializeProcedurePasteInline(inlineNodes).trim();
    if (inlineText) {
      segments.push(inlineText);
    }
    inlineNodes = [];
  };

  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (normalizeProcedureEditorText(child.textContent ?? "").trim().length === 0) continue;
      inlineNodes.push(child);
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const element = child as HTMLElement;
    const tagName = element.tagName.toLowerCase();
    if (!isProcedurePasteBlockTag(tagName)) {
      inlineNodes.push(child);
      continue;
    }
    flushInlineNodes();
    segments.push(...collectProcedurePasteSegmentsFromElement(element));
  }

  flushInlineNodes();
  return segments;
}

function collectProcedurePasteSegmentsFromElement(element: HTMLElement): string[] {
  const tagName = element.tagName.toLowerCase();
  if (tagName === "h1" || tagName === "h2" || tagName === "h3" || tagName === "h4" || tagName === "h5" || tagName === "h6") {
    const level =
      tagName === "h1"
        ? 1
        : tagName === "h2"
          ? 2
          : tagName === "h3"
            ? 3
            : tagName === "h4"
              ? 4
              : tagName === "h5"
                ? 5
                : 6;
    const text = serializeProcedurePasteInline(element.childNodes).replace(/\n+/g, " ").trim();
    return text ? [`${"#".repeat(level)} ${text}`] : [];
  }

  if (tagName === "ul" || tagName === "ol") {
    const items = Array.from(element.children)
      .filter((child) => child instanceof HTMLElement && child.tagName.toLowerCase() === "li")
      .map((child) => serializeProcedurePasteInline(child.childNodes).replace(/\n+/g, " ").trim())
      .filter(Boolean);
    if (items.length === 0) return [];
    return [
      items
        .map((item, index) => (tagName === "ol" ? `${index + 1}. ${item}` : `- ${item}`))
        .join("\n")
    ];
  }

  if (tagName === "blockquote") {
    const quoteLines = collectProcedurePasteSegmentsFromChildren(element)
      .flatMap((segment) => segment.split(/\n+/))
      .map((line) => line.trim())
      .filter(Boolean);
    return quoteLines.length > 0 ? [quoteLines.map((line) => `> ${line}`).join("\n")] : [];
  }

  if (tagName === "pre") {
    const code = normalizeProcedureEditorText(element.textContent ?? "").replace(/\r\n/g, "\n").trimEnd();
    return code ? [`\`\`\`\n${code}\n\`\`\``] : [];
  }

  if (tagName === "hr") {
    return ["---"];
  }

  if (tagName === "table") {
    const rows = Array.from(element.querySelectorAll("tr"))
      .map((row) =>
        Array.from(row.children)
          .map((cell) => serializeProcedurePasteInline(cell.childNodes).replace(/\n+/g, " ").trim())
          .filter(Boolean)
          .join(" | ")
      )
      .filter(Boolean);
    return rows.length > 0 ? [rows.join("\n")] : [];
  }

  const hasNestedBlocks = Array.from(element.childNodes).some(
    (child) => child.nodeType === Node.ELEMENT_NODE && isProcedurePasteBlockTag((child as HTMLElement).tagName.toLowerCase())
  );
  if (
    hasNestedBlocks &&
    tagName !== "p" &&
    tagName !== "li"
  ) {
    return collectProcedurePasteSegmentsFromChildren(element);
  }

  const text = serializeProcedurePasteInline(element.childNodes).trim();
  if (!text) return [];
  const headingLevel = inferProcedurePasteHeadingLevel(element, text);
  if (headingLevel) {
    return [`${"#".repeat(headingLevel)} ${text.replace(/\n+/g, " ").trim()}`];
  }
  return [text];
}

function serializeProcedurePastedHtmlToText(html: string): string {
  if (typeof DOMParser === "undefined") {
    return normalizeProcedurePastedPlainText(html);
  }
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const segments = collectProcedurePasteSegmentsFromChildren(parsed.body);
  const nextText = segments.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  const fallbackText = normalizeProcedurePastedPlainText(parsed.body.textContent ?? "");
  return nextText || fallbackText;
}

function serializeProcedureEditorInline(nodes: ArrayLike<ChildNode>): string {
  let result = "";
  for (const node of Array.from(nodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += normalizeProcedureEditorText(node.textContent ?? "");
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const element = node as HTMLElement;
    if (isProcedureEditorIgnoredElement(element)) {
      continue;
    }
    const tagName = element.tagName.toLowerCase();
    if (tagName === "br") {
      result += "\n";
      continue;
    }
    if (tagName === "img" && (element.getAttribute("data-ode-link-type") ?? "").trim() === "image") {
      const nodeId = (element.getAttribute("data-node-id") ?? "").trim();
      if (nodeId) {
        const alt =
          sanitizeSectionLinkLabel(
            (element.getAttribute("data-image-alt") ?? "").trim() || (element.getAttribute("alt") ?? "").trim(),
            "Image"
          ) || "Image";
        result += `![${alt}](ode://node/${encodeURIComponent(nodeId)})`;
      }
      continue;
    }
    const childText = serializeProcedureEditorInline(element.childNodes);
    const style = (element.getAttribute("style") ?? "").toLowerCase();
    if (tagName === "strong" || tagName === "b" || style.includes("font-weight: bold")) {
      result += childText.trim().length > 0 ? `**${childText}**` : childText;
      continue;
    }
    if (tagName === "em" || tagName === "i" || style.includes("font-style: italic")) {
      result += childText.trim().length > 0 ? `*${childText}*` : childText;
      continue;
    }
    if (tagName === "a") {
      const href = (element.getAttribute("href") ?? "").trim();
      const linkType = (element.getAttribute("data-ode-link-type") ?? "").trim();
      const appPayload = linkType === "app" ? decodeProcedureAppLinkPayload(href) : null;
      const label =
        linkType === "app"
          ? (element.getAttribute("data-link-label") ?? "").trim() ||
            appPayload?.appName?.trim() ||
            childText.trim() ||
            normalizeProcedureEditorText(element.textContent ?? "").trim() ||
            "App"
          : childText.trim() || normalizeProcedureEditorText(element.textContent ?? "").trim() || "Link";
      result += `[${sanitizeSectionLinkLabel(label, "Link")}](${href})`;
      continue;
    }
    result += childText;
  }
  return result;
}

function serializeProcedureEditorBlock(element: HTMLElement): string[] {
  const tagName = element.tagName.toLowerCase();
  if (tagName === "h1") {
    const text = serializeProcedureEditorInline(element.childNodes).trim();
    return text ? [`# ${text}`] : [];
  }
  if (tagName === "h2") {
    const text = serializeProcedureEditorInline(element.childNodes).trim();
    return text ? [`## ${text}`] : [];
  }
  if (tagName === "h3") {
    const text = serializeProcedureEditorInline(element.childNodes).trim();
    return text ? [`### ${text}`] : [];
  }
  if (tagName === "h4") {
    const text = serializeProcedureEditorInline(element.childNodes).trim();
    return text ? [`#### ${text}`] : [];
  }
  if (tagName === "h5") {
    const text = serializeProcedureEditorInline(element.childNodes).trim();
    return text ? [`##### ${text}`] : [];
  }
  if (tagName === "h6") {
    const text = serializeProcedureEditorInline(element.childNodes).trim();
    return text ? [`###### ${text}`] : [];
  }
  if (tagName === "ul") {
    return Array.from(element.children)
      .map((child) => serializeProcedureEditorInline(child.childNodes).trim())
      .filter(Boolean)
      .map((item) => `- ${item}`);
  }
  if (tagName === "ol") {
    return Array.from(element.children)
      .map((child) => serializeProcedureEditorInline(child.childNodes).trim())
      .filter(Boolean)
      .map((item, index) => `${index + 1}. ${item}`);
  }
  if (tagName === "blockquote") {
    const lines = Array.from(element.childNodes)
      .flatMap((child) => {
        if (child.nodeType === Node.ELEMENT_NODE && (child as HTMLElement).tagName.toLowerCase() === "p") {
          return serializeProcedureEditorInline(child.childNodes).split(/\n+/);
        }
        return serializeProcedureEditorInline([child as ChildNode]).split(/\n+/);
      })
      .map((line) => line.trim())
      .filter(Boolean);
    return lines.map((line) => `> ${line}`);
  }
  if (tagName === "pre") {
    const code = normalizeProcedureEditorText(element.textContent ?? "").replace(/\r\n/g, "\n").trimEnd();
    return [`\`\`\`\n${code}\n\`\`\``];
  }
  if (tagName === "hr") {
    return (element.getAttribute("data-ode-page-break") ?? "").trim().toLowerCase() === "true"
      ? ["[page-break]"]
      : ["---"];
  }
  if (tagName === "table") {
    const rowElements = Array.from(element.querySelectorAll(":scope > tbody > tr, :scope > thead > tr, :scope > tfoot > tr, :scope > tr"));
    const rows = rowElements
      .map((row) =>
        Array.from(row.children)
          .filter((cell) => cell instanceof HTMLElement && ["th", "td"].includes(cell.tagName.toLowerCase()))
          .map((cell) => serializeProcedureEditorInline(cell.childNodes).replace(/\n+/g, " ").trim())
      )
      .filter((row) => row.length > 0);
    return rows.map((row) => `| ${row.join(" | ")} |`);
  }
  if (tagName === "div" && element.dataset.insightDomain) {
    const lines = Array.from(element.children)
      .map((child) => serializeProcedureEditorInline(child.childNodes).trim())
      .filter(Boolean);
    return [`[insight:${element.dataset.insightDomain}]`, ...lines];
  }
  const text = serializeProcedureEditorInline(element.childNodes).trim();
  return text ? [text] : [];
}

function serializeProcedureEditorHtmlToText(root: HTMLElement): string {
  const blocks: string[] = [];
  let inlineNodes: ChildNode[] = [];

  const flushInlineNodes = () => {
    if (inlineNodes.length === 0) return;
    const text = serializeProcedureEditorInline(inlineNodes).trim();
    if (text) blocks.push(text);
    inlineNodes = [];
  };

  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (normalizeProcedureEditorText(child.textContent ?? "").trim().length === 0) continue;
      inlineNodes.push(child);
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const element = child as HTMLElement;
    if (isProcedureEditorIgnoredElement(element)) {
      continue;
    }
    const tagName = element.tagName.toLowerCase();
    if (!isProcedureEditorBlockTag(tagName)) {
      inlineNodes.push(child);
      continue;
    }
    flushInlineNodes();
    blocks.push(...serializeProcedureEditorBlock(element));
  }

  flushInlineNodes();
  return blocks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

function renderInputType(fieldType: ProcedureFieldType): HTMLInputElement["type"] {
  if (fieldType === "date") return "date";
  if (fieldType === "time") return "time";
  if (fieldType === "datetime") return "datetime-local";
  if (fieldType === "email") return "email";
  if (fieldType === "phone") return "tel";
  if (fieldTypeUsesNumericInput(fieldType)) return "number";
  return "text";
}

function resolveHeadingClasses(depth: number): string {
  if (depth <= 0) return "text-[2.3rem] font-semibold tracking-[-0.04em] text-[var(--ode-text)]";
  if (depth === 1) return "text-[1.7rem] font-semibold tracking-[-0.03em] text-[var(--ode-text)]";
  if (depth === 2) return "text-[1.28rem] font-semibold tracking-[-0.02em] text-[var(--ode-text)]";
  return "text-[1.05rem] font-semibold tracking-[-0.01em] text-[var(--ode-text-dim)]";
}

function resolveProcedureContentHeadingClasses(level: ProcedureHeadingLevel): string {
  if (level === 1) return "text-[1.48rem] font-semibold tracking-[-0.035em] text-[#0f172a]";
  if (level === 2) return "text-[1.34rem] font-semibold tracking-[-0.03em] text-[#0f172a]";
  if (level === 3) return "text-[1.08rem] font-semibold tracking-[-0.02em] text-[#111827]";
  if (level === 4) return "text-[0.98rem] font-semibold tracking-[-0.01em] text-[#1f2937]";
  if (level === 5) return "text-[0.92rem] font-semibold tracking-[0.01em] uppercase text-[#334155]";
  return "text-[0.86rem] font-semibold tracking-[0.08em] uppercase text-[#475569]";
}

function resolveSectionShellClasses(depth: number): string {
  return depth <= 1
    ? "border-t border-[var(--ode-border)] pt-8"
    : "border-t border-[var(--ode-border)] pt-6 pl-4";
}

function resolveSectionTreeIndent(depth: number): number {
  if (depth <= 0) return 0;
  if (depth === 1) return 28;
  if (depth === 2) return 50;
  if (depth === 3) return 68;
  return 68 + (depth - 3) * 12;
}

function resolveSectionCardClasses(selected: boolean): string {
  return selected
    ? "rounded-[22px] border border-[var(--ode-border-accent)] bg-[rgba(8,47,72,0.46)] px-5 py-5 shadow-[0_16px_34px_rgba(0,0,0,0.22)]"
    : "rounded-[22px] border border-transparent bg-transparent px-5 py-5 transition hover:bg-[rgba(6,31,49,0.22)]";
}

function resolveSectionNumberBadgeClasses(selected: boolean): string {
  return selected
    ? "inline-flex min-w-[2.35rem] items-center justify-center rounded-full border border-[var(--ode-border-accent)] bg-[rgba(18,112,166,0.4)] px-2 py-1 text-[0.72rem] font-semibold tracking-[0.08em] text-[var(--ode-text)]"
    : "inline-flex min-w-[2.35rem] items-center justify-center rounded-full border border-[var(--ode-border)] bg-[rgba(5,29,46,0.8)] px-2 py-1 text-[0.72rem] font-semibold tracking-[0.08em] text-[var(--ode-accent)]";
}

function collectSubtreeNodeMap(
  rootNode: AppNode | null,
  byParent: Map<string | null, AppNode[]>
): Map<string, AppNode> {
  const map = new Map<string, AppNode>();
  if (!rootNode) return map;
  const visit = (node: AppNode) => {
    if (map.has(node.id)) return;
    map.set(node.id, node);
    const children = byParent.get(node.id) ?? [];
    children.forEach(visit);
  };
  visit(rootNode);
  return map;
}

function getDirectFieldEntries(node: AppNode, byParent: Map<string | null, AppNode[]>): ProcedureFieldEntry[] {
  return (byParent.get(node.id) ?? []).filter(isProcedureFieldNode).map(buildProcedureFieldEntry);
}

function getDirectFileChildren(node: AppNode, byParent: Map<string | null, AppNode[]>): AppNode[] {
  return (byParent.get(node.id) ?? []).filter((child) => child.type === "file");
}

function getDirectSectionChildren(node: AppNode, byParent: Map<string | null, AppNode[]>): AppNode[] {
  return (byParent.get(node.id) ?? []).filter((child) => child.type !== "file" && !isProcedureFieldNode(child));
}

export function ProcedureBuilderPanel({
  language,
  workspaceName,
  rootNode,
  selectedNode,
  canReadNode,
  canWriteNode,
  getNodeDisplayLabel,
  byParent,
  scopedNumbering,
  allNodes,
  projects,
  activeProjectRootId,
  onSelectNode,
  onOpenLinkedNode,
  onOpenLinkedFile,
  onOpenWebsiteLink,
  onLaunchLinkedApp,
  onCreateProcedureItem,
  onAttachImagesToNode,
  onAttachFilesToNode,
  onDeleteProcedureNode,
  onRenameNodeTitle,
  onReviewNodeFile,
  onSaveNodeContent,
  onSaveNodeDescription,
  onSaveNodeProperties,
  onMoveProcedureNode,
  onActivateProcedureSurface,
  onOpenSurfaceContextMenu,
  onOpenFieldOrderWindow,
  onCloseFieldOrderWindow,
  requestedFieldEditorNodeId,
  requestedFieldOrderNodeId,
  requestedBlankSectionEditorNodeId,
  onFieldEditorRequestHandled,
  onFieldOrderRequestHandled,
  isDedicatedFieldOrderWindow = false
}: ProcedureBuilderPanelProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldEditorNodeId, setFieldEditorNodeId] = useState<string | null>(null);
  const [fieldEditorDraft, setFieldEditorDraft] = useState<FieldEditorDraft | null>(null);
  const [fieldEditorSaving, setFieldEditorSaving] = useState(false);
  const [fieldOrderEditorNodeId, setFieldOrderEditorNodeId] = useState<string | null>(null);
  const [tableViewEditorNodeId, setTableViewEditorNodeId] = useState<string | null>(null);
  const [tableViewEditorDraft, setTableViewEditorDraft] = useState<ProcedureTableViewDraft | null>(null);
  const [tableViewEditorSaving, setTableViewEditorSaving] = useState(false);
  const [sectionEditorNodeId, setSectionEditorNodeId] = useState<string | null>(null);
  const [sectionEditorDraft, setSectionEditorDraft] = useState<SectionEditorDraft | null>(null);
  const [sectionEditorSaving, setSectionEditorSaving] = useState(false);
  const [sectionNodeLinkPickerOpen, setSectionNodeLinkPickerOpen] = useState(false);
  const [sectionNodeLinkQuery, setSectionNodeLinkQuery] = useState("");
  const [sectionAppPickerOpen, setSectionAppPickerOpen] = useState(false);
  const [sectionAppQuery, setSectionAppQuery] = useState("");
  const [sectionWebsiteLinkState, setSectionWebsiteLinkState] = useState<SectionWebsiteLinkState | null>(null);
  const [sectionEditorStyleMenuOpen, setSectionEditorStyleMenuOpen] = useState(false);
  const [sectionNumberingPanelOpen, setSectionNumberingPanelOpen] = useState(false);
  const [sectionEditorFontMenuOpen, setSectionEditorFontMenuOpen] = useState(false);
  const [sectionEditorFontQuery, setSectionEditorFontQuery] = useState("");
  const [sectionEditorFontSizeMenuOpen, setSectionEditorFontSizeMenuOpen] = useState(false);
  const [sectionEditorFontSizeInput, setSectionEditorFontSizeInput] = useState(
    `${SECTION_EDITOR_DEFAULT_FONT_SIZE_PT}`
  );
  const [sectionEditorColorPickerOpen, setSectionEditorColorPickerOpen] = useState(false);
  const [sectionEditorCustomColorPanelOpen, setSectionEditorCustomColorPanelOpen] = useState(false);
  const [sectionEditorCustomColorState, setSectionEditorCustomColorState] = useState<SectionEditorCustomColorState>(() =>
    buildSectionEditorCustomColorState(SECTION_EDITOR_DEFAULT_PICKER_TEXT_COLOR)
  );
  const [sectionEditorTableMenuOpen, setSectionEditorTableMenuOpen] = useState(false);
  const [sectionEditorCurrentStyle, setSectionEditorCurrentStyle] = useState<SectionEditorBlockStyle>("normal");
  const [sectionEditorCurrentAlignment, setSectionEditorCurrentAlignment] = useState<SectionTextAlignment>("left");
  const [sectionEditorTextColor, setSectionEditorTextColor] = useState(SECTION_EDITOR_DEFAULT_PICKER_TEXT_COLOR);
  const [sectionEditorRecentTextColors, setSectionEditorRecentTextColors] = useState<string[]>(
    () => readSectionEditorRecentTextColors()
  );
  const [sectionEditorTitleLevelDefaults, setSectionEditorTitleLevelDefaults] =
    useState<SectionEditorTitleLevelDefaults>(() => buildDefaultSectionEditorTitleLevelDefaults());
  const [sectionEditorFormattingDefaults, setSectionEditorFormattingDefaults] = useState<SectionEditorFormattingDefaults>(
    () => buildDefaultSectionEditorFormattingDefaults()
  );
  const [sectionEditorTitleDefaults, setSectionEditorTitleDefaults] = useState<SectionEditorTitleDefaults>(
    () => buildDefaultSectionEditorTitleDefaults()
  );
  const [sectionEditorHeadingStyleDefaults, setSectionEditorHeadingStyleDefaults] =
    useState<SectionEditorHeadingStyleDefaults>(() => buildDefaultSectionEditorHeadingStyleDefaults());
  const [sectionEditorCurrentFontFamily, setSectionEditorCurrentFontFamily] = useState(SECTION_EDITOR_DEFAULT_FONT_FAMILY);
  const [sectionEditorCurrentFontSizePt, setSectionEditorCurrentFontSizePt] = useState(SECTION_EDITOR_DEFAULT_FONT_SIZE_PT);
  const [sectionEditorCurrentBold, setSectionEditorCurrentBold] = useState(false);
  const [sectionEditorCurrentItalic, setSectionEditorCurrentItalic] = useState(false);
  const [sectionEditorCurrentLineSpacing, setSectionEditorCurrentLineSpacing] =
    useState<SectionEditorLineSpacingValue>("default");
  const [sectionEditorLineSpacingInput, setSectionEditorLineSpacingInput] = useState("1");
  const [sectionEditorLineSpacingMenuOpen, setSectionEditorLineSpacingMenuOpen] = useState(false);
  const [sectionEditorCurrentListKind, setSectionEditorCurrentListKind] = useState<SectionEditorListKind>(null);
  const [sectionEditorCurrentQuoteActive, setSectionEditorCurrentQuoteActive] = useState(false);
  const [sectionEditorCurrentIndentPx, setSectionEditorCurrentIndentPx] = useState(0);
  const [sectionEditorCanUndo, setSectionEditorCanUndo] = useState(false);
  const [sectionEditorCanRedo, setSectionEditorCanRedo] = useState(false);
  const [sectionEditorContextMenu, setSectionEditorContextMenu] = useState<SectionEditorContextMenuState | null>(null);
  const [sectionEditorInsertTableRows, setSectionEditorInsertTableRows] = useState(3);
  const [sectionEditorInsertTableColumns, setSectionEditorInsertTableColumns] = useState(3);
  const [sectionEditorActiveTableState, setSectionEditorActiveTableState] = useState<SectionEditorActiveTableState | null>(null);
  const [sectionEditorAvailableFonts, setSectionEditorAvailableFonts] = useState<string[]>(
    SECTION_EDITOR_PREFERRED_FONT_FAMILIES
  );
  const [sectionEditorFocusTarget, setSectionEditorFocusTarget] = useState<SectionEditorFocusTarget>("content");
  const [sectionEditorSelectedImageId, setSectionEditorSelectedImageId] = useState<string | null>(null);
  const [sectionEditorSelectedImageWidth, setSectionEditorSelectedImageWidth] = useState<number>(320);
  const [sectionEditorSelectedImageAlignment, setSectionEditorSelectedImageAlignment] = useState<SectionTextAlignment | null>(null);
  const [sectionEditorSelectedImageOverlay, setSectionEditorSelectedImageOverlay] = useState<SectionEditorImageOverlayState | null>(null);
  const [pendingNewSectionNodeId, setPendingNewSectionNodeId] = useState<string | null>(null);
  const [sectionPhotoAdding, setSectionPhotoAdding] = useState(false);
  const [sectionAttachmentAdding, setSectionAttachmentAdding] = useState(false);
  const [sectionAttachmentDeletingId, setSectionAttachmentDeletingId] = useState<string | null>(null);
  const [attachmentDeleteState, setAttachmentDeleteState] = useState<{
    nodeId: string;
    nodeName: string;
  } | null>(null);
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    nodeId: string;
    nodeName: string;
    recordId: string;
  } | null>(null);
  const [recordEditorParentNodeId, setRecordEditorParentNodeId] = useState<string | null>(null);
  const [recordEditorRecordId, setRecordEditorRecordId] = useState<string | null>(null);

  const resolveNodeTitle = (node: AppNode): string => {
    const label = getNodeDisplayLabel ? getNodeDisplayLabel(node) : node.name;
    return label === "\u00A0" ? "" : label;
  };
  const canReadProcedureNode = (nodeId: string): boolean => (canReadNode ? canReadNode(nodeId) : true);
  const canWriteProcedureNode = (nodeId: string): boolean => (canWriteNode ? canWriteNode(nodeId) : true);
  const [recordEditorOpen, setRecordEditorOpen] = useState(false);
  const [recordSaving, setRecordSaving] = useState(false);
  const [recordExportingNodeId, setRecordExportingNodeId] = useState<string | null>(null);
  const [recordImportingNodeId, setRecordImportingNodeId] = useState<string | null>(null);
  const [recordAttachmentAddingFieldId, setRecordAttachmentAddingFieldId] = useState<string | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, ProcedureRecordValue>>({});
  const procedureSurfaceContentRef = useRef<HTMLDivElement | null>(null);
  const sectionEditorDocumentViewportRef = useRef<HTMLDivElement | null>(null);
  const sectionEditorSurfaceRef = useRef<HTMLDivElement | null>(null);
  const sectionEditorTitleInputRef = useRef<HTMLInputElement | null>(null);
  const sectionEditorContextMenuStateRef = useRef<SectionEditorContextMenuState | null>(null);
  const sectionNumberingStartAtInputRef = useRef<HTMLInputElement | null>(null);
  const sectionEditorColorPickerRef = useRef<HTMLDivElement | null>(null);
  const sectionEditorTableMenuRef = useRef<HTMLDivElement | null>(null);
  const sectionEditorAutoOpenedTableMenuRef = useRef(false);
  const sectionEditorStyleMenuRef = useRef<HTMLDivElement | null>(null);
  const sectionEditorFontMenuRef = useRef<HTMLDivElement | null>(null);
  const sectionEditorFontSearchInputRef = useRef<HTMLInputElement | null>(null);
  const sectionEditorFontSizeMenuRef = useRef<HTMLDivElement | null>(null);
  const sectionEditorLineSpacingMenuRef = useRef<HTMLDivElement | null>(null);
  const sectionWebsiteLinkLabelInputRef = useRef<HTMLInputElement | null>(null);
  const sectionWebsiteLinkUrlInputRef = useRef<HTMLInputElement | null>(null);
  const sectionEditorImageResizeSessionRef = useRef<SectionEditorImageResizeSession | null>(null);
  const sectionEditorSelectionRef = useRef<Range | null>(null);
  const sectionEditorFormattingTargetRef = useRef<"label" | "content">("content");
  const sectionEditorFontsRequestedRef = useRef(false);
  const sectionEditorPendingFontSizePtRef = useRef<number | null>(null);
  const sectionEditorInsertRangeRef = useRef<Range | null>(null);
  const sectionEditorInsertSerializedRangeRef = useRef<SerializedSectionEditorRange | null>(null);
  const sectionWebsiteLinkRangeRef = useRef<Range | null>(null);
  const sectionWebsiteLinkSerializedRangeRef = useRef<SerializedSectionEditorRange | null>(null);
  const sectionWebsiteLinkStartMarkerRef = useRef<HTMLSpanElement | null>(null);
  const sectionWebsiteLinkEndMarkerRef = useRef<HTMLSpanElement | null>(null);
  const sectionEditorUndoStackRef = useRef<SectionEditorHistorySnapshot[]>([]);
  const sectionEditorRedoStackRef = useRef<SectionEditorHistorySnapshot[]>([]);
  const sectionEditorHistoryCurrentRef = useRef<SectionEditorHistorySnapshot | null>(null);
  const sectionEditorHistoryNodeIdRef = useRef<string | null>(null);
  const sectionEditorHistoryApplyingRef = useRef(false);

  useEffect(() => {
    sectionEditorContextMenuStateRef.current = sectionEditorContextMenu;
  }, [sectionEditorContextMenu]);

  const syncSectionEditorHistoryAvailability = () => {
    const nextCanUndo = sectionEditorUndoStackRef.current.length > 0;
    const nextCanRedo = sectionEditorRedoStackRef.current.length > 0;
    setSectionEditorCanUndo((current) => (current === nextCanUndo ? current : nextCanUndo));
    setSectionEditorCanRedo((current) => (current === nextCanRedo ? current : nextCanRedo));
  };

  const subtreeNodeMap = useMemo(() => collectSubtreeNodeMap(rootNode, byParent), [rootNode, byParent]);
  const globalNodeById = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const projectByRootId = useMemo(() => new Map(projects.map((project) => [project.rootNodeId, project])), [projects]);
  const workspaceRootIdSet = useMemo(() => new Set(projects.map((project) => project.rootNodeId)), [projects]);
  const procedureWorkspaceRootId = useMemo(() => {
    if (!rootNode) return activeProjectRootId;
    return findProcedureWorkspaceRootId(rootNode.id, globalNodeById, workspaceRootIdSet) ?? activeProjectRootId;
  }, [activeProjectRootId, globalNodeById, rootNode, workspaceRootIdSet]);
  const procedureWorkspaceRootNode = useMemo(
    () => (procedureWorkspaceRootId ? globalNodeById.get(procedureWorkspaceRootId) ?? null : null),
    [globalNodeById, procedureWorkspaceRootId]
  );
  const procedureWorkspaceNodeMap = useMemo(
    () => collectSubtreeNodeMap(procedureWorkspaceRootNode ?? rootNode, byParent),
    [byParent, procedureWorkspaceRootNode, rootNode]
  );
  const procedureWorkspaceFormattingDefaults = useMemo(
    () => readSectionEditorWorkspaceFormattingDefaults(procedureWorkspaceRootNode),
    [procedureWorkspaceRootNode]
  );
  const procedureWorkspaceTitleLevelDefaults = useMemo(
    () => readSectionEditorWorkspaceTitleLevelDefaults(procedureWorkspaceRootNode),
    [procedureWorkspaceRootNode]
  );
  const procedureWorkspaceHeadingStyleDefaults = useMemo(
    () => readSectionEditorWorkspaceHeadingStyleDefaults(procedureWorkspaceRootNode),
    [procedureWorkspaceRootNode]
  );
  const procedureWorkspaceRichDocumentStyle = useMemo(
    () => buildSectionEditorRichDocumentStyle(sectionEditorFormattingDefaults, sectionEditorHeadingStyleDefaults),
    [sectionEditorFormattingDefaults, sectionEditorHeadingStyleDefaults]
  );
  const procedureDatabaseModel = useMemo(() => buildProcedureDatabaseModel(allNodes), [allNodes]);
  const procedureDatabaseTables = useMemo(() => procedureDatabaseModel.tables, [procedureDatabaseModel]);
  const procedureNodeLinkCandidates = useMemo(
    () =>
      allNodes
        .filter((node) => node.type !== "file" && !isProcedureFieldNode(node) && !shouldHideNodeFromGenericUi(node))
        .map((node) => {
          const workspaceRootId = findProcedureWorkspaceRootId(node.id, globalNodeById, workspaceRootIdSet);
          const candidateWorkspaceName = resolveWorkspaceDisplayName(
            workspaceRootId,
            projectByRootId,
            globalNodeById,
            workspaceName
          );
          const label = getNodeDisplayName(node);
          return {
            node,
            label,
            pathLabel: buildProcedureNodePathLabel(node.id, globalNodeById, workspaceRootId),
            workspaceName: candidateWorkspaceName
          };
        })
        .sort((left, right) => left.pathLabel.localeCompare(right.pathLabel, undefined, { sensitivity: "base" })),
    [allNodes, globalNodeById, projectByRootId, workspaceName, workspaceRootIdSet]
  );
  const [imagePreviewSrcByNodeId, setImagePreviewSrcByNodeId] = useState<Record<string, string>>({});
  const subtreeImageNodes = useMemo(
    () =>
      Array.from(subtreeNodeMap.values()).filter(
        (node) => canReadProcedureNode(node.id) && getDesktopMediaPreviewKind(node) === "image"
      ),
    [canReadProcedureNode, subtreeNodeMap]
  );
  const recordEditorParentNode = useMemo(
    () =>
      recordEditorParentNodeId
        ? subtreeNodeMap.get(recordEditorParentNodeId) ?? globalNodeById.get(recordEditorParentNodeId) ?? null
        : null,
    [globalNodeById, recordEditorParentNodeId, subtreeNodeMap]
  );
  const fieldEditorWritable = fieldEditorNodeId ? canWriteProcedureNode(fieldEditorNodeId) : false;
  const sectionEditorWritable = sectionEditorNodeId ? canWriteProcedureNode(sectionEditorNodeId) : false;
  const recordEditorWritable = recordEditorParentNodeId ? canWriteProcedureNode(recordEditorParentNodeId) : false;
  const recordEditorFields = useMemo(
    () =>
      recordEditorParentNode
        ? getDirectFieldEntries(recordEditorParentNode, byParent).filter((entry) => canReadProcedureNode(entry.node.id))
        : [],
    [byParent, canReadProcedureNode, recordEditorParentNode]
  );
  const recordEditorFieldById = useMemo(
    () => new Map(recordEditorFields.map((entry) => [entry.node.id, entry] as const)),
    [recordEditorFields]
  );
  const normalizedRecordEditorDraftValues = useMemo(
    () => mergeDraftValues(recordEditorFields, draftValues),
    [draftValues, recordEditorFields]
  );
  const recordEditorPreviewValues = useMemo(() => {
    if (!recordEditorParentNode) return normalizedRecordEditorDraftValues;
    return computeProcedurePreviewRecordValues({
      nodes: allNodes,
      tableNodeId: recordEditorParentNode.id,
      recordId: recordEditorRecordId,
      values: normalizedRecordEditorDraftValues
    });
  }, [allNodes, normalizedRecordEditorDraftValues, recordEditorParentNode, recordEditorRecordId]);
  const recordRelationChoicesByFieldId = useMemo(() => {
    const optionsByFieldId = new Map<
      string,
      Array<{
        token: string;
        label: string;
      }>
    >();
    for (const entry of recordEditorFields) {
      if (!isProcedureRelationFieldType(entry.type) || !entry.relationTargetNodeId) continue;
      const targetTable = procedureDatabaseModel.tablesById.get(entry.relationTargetNodeId) ?? null;
      if (!targetTable || !canReadProcedureNode(targetTable.node.id)) continue;
      const choices = targetTable.records.map((record) => ({
        token: encodeProcedureRecordToken(targetTable.node.id, record.id),
        label: formatProcedureRelationRecordLabel({
          record,
          entry,
          targetTable,
          model: procedureDatabaseModel
        })
      }));
      optionsByFieldId.set(entry.node.id, choices);
    }
    return optionsByFieldId;
  }, [canReadProcedureNode, procedureDatabaseModel, recordEditorFields]);
  const recordAttachmentChoicesByFieldId = useMemo(() => {
    const optionsByFieldId = new Map<
      string,
      Array<{
        token: string;
        label: string;
        node: AppNode;
      }>
    >();
    if (!recordEditorParentNode) return optionsByFieldId;
    const attachmentChoices = getDirectFileChildren(recordEditorParentNode, byParent)
      .filter((node) => canReadProcedureNode(node.id))
      .map((node) => ({
        token: encodeProcedureNodeToken(node.id),
        label: getProcedureFileDisplayTitle(node.name),
        node
      }));
    for (const entry of recordEditorFields) {
      if (entry.type !== "attachment") continue;
      optionsByFieldId.set(entry.node.id, attachmentChoices);
    }
    return optionsByFieldId;
  }, [byParent, canReadProcedureNode, recordEditorFields, recordEditorParentNode]);
  const visibleRecordEditorFields = useMemo(
    () =>
      recordEditorFields.filter((entry) =>
        isProcedureFieldVisibleInRecordEditor(entry, recordEditorPreviewValues, recordEditorFieldById)
      ),
    [recordEditorFieldById, recordEditorFields, recordEditorPreviewValues]
  );
  const getProcedureRelationChoices = (entry: ProcedureFieldEntry): ProcedureImportChoice[] => {
    if (!isProcedureRelationFieldType(entry.type) || !entry.relationTargetNodeId) return [];
    const targetTable = procedureDatabaseModel.tablesById.get(entry.relationTargetNodeId) ?? null;
    if (!targetTable || !canReadProcedureNode(targetTable.node.id)) return [];
    return targetTable.records.map((record) => ({
      token: encodeProcedureRecordToken(targetTable.node.id, record.id),
      label: formatProcedureRelationRecordLabel({
        record,
        entry,
        targetTable,
        model: procedureDatabaseModel
        })
      }));
  };
  const getProcedureOrganizationTreeChoices = (entry: ProcedureFieldEntry): ProcedureOrganizationChoice[] => {
    if (!isProcedureOrganizationLinkFieldType(entry.type) || !entry.organizationRootNodeId) return [];
    const scopeRootNode = globalNodeById.get(entry.organizationRootNodeId) ?? null;
    if (!scopeRootNode || !canReadProcedureNode(scopeRootNode.id)) return [];

    const choices: ProcedureOrganizationChoice[] = [];
    const walk = (node: AppNode, depth: number) => {
      if (node.type === "file" || isProcedureFieldNode(node) || shouldHideNodeFromGenericUi(node)) return;
      if (!canReadProcedureNode(node.id)) return;
      if (!isNodeWithinProcedureScope(node.id, scopeRootNode.id, globalNodeById)) return;

      const label = getNodeDisplayName(node) || node.name || "Node";
      choices.push({
        token: encodeProcedureNodeToken(node.id),
        label,
        node,
        depth,
        pathLabel: buildProcedureNodePathLabel(node.id, globalNodeById, scopeRootNode.id) || label
      });

      for (const child of byParent.get(node.id) ?? []) {
        walk(child, depth + 1);
      }
    };

    walk(scopeRootNode, 0);
    return choices;
  };
  const getProcedureOrganizationChoices = (entry: ProcedureFieldEntry): ProcedureImportChoice[] => {
    return getProcedureOrganizationTreeChoices(entry).map((choice) => ({
      token: choice.token,
      label: choice.pathLabel || choice.label
    }));
  };
  const resolveImportedRecordValue = (
    entry: ProcedureFieldEntry,
    rawValue: string
  ): ProcedureRecordValue | undefined => {
    const trimmed = rawValue.trim();
    if (isProcedureFormulaFieldType(entry.type) || entry.type === "attachment") return undefined;

    if (entry.type === "table") {
      if (!trimmed) return createEmptyTableValue(entry.options.length > 0 ? entry.options : DEFAULT_TABLE_COLUMNS);
      const columns = entry.options.length > 0 ? entry.options : DEFAULT_TABLE_COLUMNS;
      const parts = splitProcedureImportValues(trimmed);
      const nextValue = createEmptyTableValue(columns);
      columns.forEach((column, index) => {
        nextValue[column] = parts[index] ?? (index === 0 ? trimmed : "");
      });
      return nextValue;
    }

    if (entry.type === "multi_select") {
      const options = entry.options.length > 0 ? entry.options : DEFAULT_SELECT_OPTIONS;
      return splitProcedureImportValues(trimmed).map((item) => {
        const normalizedItem = normalizeProcedureImportKey(item);
        return (
          options.find((option) => normalizeProcedureImportKey(option) === normalizedItem) ?? item
        );
      });
    }

    if (entry.type === "yes_no") {
      if (!trimmed) return "";
      const normalized = normalizeProcedureImportKey(trimmed);
      if (["yes", "y", "true", "1", "oui"].includes(normalized)) return "Yes";
      if (["no", "n", "false", "0", "non"].includes(normalized)) return "No";
      return trimmed;
    }

    if (entry.type === "single_select") {
      if (!trimmed) return "";
      const normalized = normalizeProcedureImportKey(trimmed);
      return entry.options.find((option) => normalizeProcedureImportKey(option) === normalized) ?? trimmed;
    }

    if (isProcedureNodeLinkFieldType(entry.type)) {
      if (!trimmed) return "";
      const directTokenNodeId = decodeProcedureNodeToken(trimmed);
      if (directTokenNodeId) return trimmed;
      const normalized = normalizeProcedureImportKey(trimmed);
      const match = procedureNodeLinkCandidates.find((candidate) => {
        const searchPool = [
          getNodeDisplayName(candidate.node),
          candidate.pathLabel,
          candidate.workspaceName,
          `${candidate.workspaceName} ${candidate.pathLabel}`
        ];
        return searchPool.some((value) => normalizeProcedureImportKey(value) === normalized);
      });
      return match ? encodeProcedureNodeToken(match.node.id) : "";
    }

    if (isProcedureOrganizationLinkFieldType(entry.type)) {
      const tokens = splitProcedureImportValues(trimmed)
        .map((item) => resolveProcedureImportChoiceToken(item, getProcedureOrganizationChoices(entry)))
        .filter(Boolean);
      return Array.from(new Set(tokens));
    }

    if (entry.type === "relation") {
      return resolveProcedureImportChoiceToken(trimmed, getProcedureRelationChoices(entry));
    }

    if (entry.type === "relation_list") {
      const tokens = splitProcedureImportValues(trimmed)
        .map((item) => resolveProcedureImportChoiceToken(item, getProcedureRelationChoices(entry)))
        .filter(Boolean);
      return Array.from(new Set(tokens));
    }

    if (entry.type === "date") {
      return normalizeProcedureImportedDate(trimmed);
    }

    if (entry.type === "year") {
      return normalizeProcedureImportedYear(trimmed);
    }

    if (entry.type === "month") {
      return normalizeProcedureImportedMonth(trimmed);
    }

    if (entry.type === "day") {
      return normalizeProcedureImportedDay(trimmed);
    }

    return trimmed;
  };
  const fieldEditorTargetTable = useMemo(() => {
    if (!fieldEditorDraft?.relationTargetNodeId) return null;
    return procedureDatabaseModel.tablesById.get(fieldEditorDraft.relationTargetNodeId) ?? null;
  }, [fieldEditorDraft?.relationTargetNodeId, procedureDatabaseModel]);
  const fieldEditorNode = useMemo(
    () =>
      fieldEditorNodeId
        ? subtreeNodeMap.get(fieldEditorNodeId) ?? globalNodeById.get(fieldEditorNodeId) ?? null
        : null,
    [fieldEditorNodeId, globalNodeById, subtreeNodeMap]
  );
  const fieldEditorSiblingFields = useMemo(() => {
    if (!fieldEditorNode?.parentId) return [];
    const parentNode =
      subtreeNodeMap.get(fieldEditorNode.parentId) ?? globalNodeById.get(fieldEditorNode.parentId) ?? null;
    if (!parentNode) return [];
    return getDirectFieldEntries(parentNode, byParent).filter((entry) => entry.node.id !== fieldEditorNode.id);
  }, [byParent, fieldEditorNode, globalNodeById, subtreeNodeMap]);
  const fieldEditorVisibilitySourceField = useMemo(
    () =>
      fieldEditorDraft?.visibilitySourceFieldId
        ? fieldEditorSiblingFields.find((entry) => entry.node.id === fieldEditorDraft.visibilitySourceFieldId) ?? null
        : null,
    [fieldEditorDraft?.visibilitySourceFieldId, fieldEditorSiblingFields]
  );
  const fieldEditorVisibilityOptions = useMemo(
    () =>
      fieldEditorVisibilitySourceField ? getProcedureConditionalVisibilityOptions(fieldEditorVisibilitySourceField) : [],
    [fieldEditorVisibilitySourceField]
  );
  const fieldOrderEditorNode = useMemo(
    () =>
      fieldOrderEditorNodeId
        ? subtreeNodeMap.get(fieldOrderEditorNodeId) ?? (rootNode && rootNode.id === fieldOrderEditorNodeId ? rootNode : null)
        : null,
    [fieldOrderEditorNodeId, rootNode, subtreeNodeMap]
  );
  const fieldOrderEditorFields = useMemo(
    () =>
      fieldOrderEditorNode
        ? getDirectFieldEntries(fieldOrderEditorNode, byParent).filter((entry) => canReadProcedureNode(entry.node.id))
        : [],
    [byParent, fieldOrderEditorNode]
  );
  const fieldOrderEditorWritable = fieldOrderEditorNode ? canWriteProcedureNode(fieldOrderEditorNode.id) : false;
  const tableViewEditorNode = useMemo(
    () =>
      tableViewEditorNodeId
        ? subtreeNodeMap.get(tableViewEditorNodeId) ?? (rootNode && rootNode.id === tableViewEditorNodeId ? rootNode : null)
        : null,
    [rootNode, subtreeNodeMap, tableViewEditorNodeId]
  );
  const tableViewEditorFields = useMemo(
    () =>
      tableViewEditorNode
        ? getDirectFieldEntries(tableViewEditorNode, byParent).filter((entry) => canReadProcedureNode(entry.node.id))
        : [],
    [byParent, canReadProcedureNode, tableViewEditorNode]
  );
  const tableViewEditorWritable = tableViewEditorNode ? canWriteProcedureNode(tableViewEditorNode.id) : false;
  const sectionEditorNode = useMemo(() => {
    if (!sectionEditorNodeId) return null;
    return subtreeNodeMap.get(sectionEditorNodeId) ?? (rootNode && rootNode.id === sectionEditorNodeId ? rootNode : null);
  }, [rootNode, sectionEditorNodeId, subtreeNodeMap]);
  const sectionEditorReferences = useMemo(
    () =>
      sectionEditorNode
        ? (byParent.get(sectionEditorNode.id) ?? []).filter(
            (child) => child.type === "file" && canReadProcedureNode(child.id)
          )
        : [],
    [byParent, canReadProcedureNode, sectionEditorNode]
  );
  const sectionEditorFileReferences = useMemo(
    () => sectionEditorReferences.filter((reference) => getDesktopMediaPreviewKind(reference) !== "image"),
    [sectionEditorReferences]
  );
  const procedureScopedNumbering = useMemo(() => {
    if (!rootNode) return scopedNumbering;
    return buildScopedNumbering({
      activeProjectRootId: rootNode.id,
      numbering: scopedNumbering,
      nodeById: globalNodeById,
      byParent: byParent as Map<string, AppNode[]>,
      workspaceRootNumberingEnabled: true,
      numberingMode: "tree_headings",
      consumesTreeNumbering: (node) =>
        !isFileLikeNode(node) && !isProcedureFieldNode(node) && !shouldHideNodeFromGenericUi(node)
    });
  }, [byParent, globalNodeById, rootNode, scopedNumbering]);
  const sectionEditorWorkspaceRootId = useMemo(() => {
    if (!sectionEditorNode) return activeProjectRootId;
    return findProcedureWorkspaceRootId(sectionEditorNode.id, globalNodeById, workspaceRootIdSet) ?? activeProjectRootId;
  }, [activeProjectRootId, globalNodeById, sectionEditorNode, workspaceRootIdSet]);
  const sectionEditorVisibleRootId = rootNode?.id ?? sectionEditorWorkspaceRootId ?? null;
  const sectionEditorCurrentTitleLevel = useMemo(
    () =>
      resolveProcedureSectionTitleLevel(
        sectionEditorNode?.id ?? rootNode?.id ?? null,
        sectionEditorVisibleRootId,
        globalNodeById
      ),
    [globalNodeById, rootNode?.id, sectionEditorNode?.id, sectionEditorVisibleRootId]
  );
  const sectionEditorCurrentStyleLabel = useMemo(
    () => resolveSectionEditorStyleOption(sectionEditorCurrentStyle)?.label ?? "Normal",
    [sectionEditorCurrentStyle]
  );
  const sectionEditorVisibleStyleOptions = useMemo(() => {
    const visibleHeadingLevels = new Set<ProcedureHeadingLevel>();
    for (const node of procedureWorkspaceNodeMap.values()) {
      if (isFileLikeNode(node) || isProcedureFieldNode(node) || shouldHideNodeFromGenericUi(node)) continue;
      const richTextHtml =
        node.id === sectionEditorNodeId ? sectionEditorDraft?.richTextHtml ?? readProcedureRichTextHtml(node) : readProcedureRichTextHtml(node);
      const content = node.id === sectionEditorNodeId ? sectionEditorDraft?.content ?? node.content ?? "" : node.content ?? "";
      collectSectionEditorHeadingLevelsFromHtml(richTextHtml, visibleHeadingLevels);
      collectSectionEditorHeadingLevelsFromContent(content, visibleHeadingLevels);
    }
    const currentHeadingLevel = resolveSectionEditorHeadingLevel(sectionEditorCurrentStyle);
    if (currentHeadingLevel !== null) {
      visibleHeadingLevels.add(currentHeadingLevel);
    }
    const highestVisibleHeadingLevel = visibleHeadingLevels.size > 0 ? Math.max(...visibleHeadingLevels) : 0;
    const maxVisibleHeadingLevel = Math.min(
      6,
      Math.max(3, highestVisibleHeadingLevel + 1, currentHeadingLevel ?? 0)
    ) as ProcedureHeadingLevel;
    return SECTION_EDITOR_STYLE_OPTIONS.filter((option) => {
      if (option.value === "normal") return true;
      const headingLevel = resolveSectionEditorHeadingLevel(option.value);
      return headingLevel !== null && headingLevel <= maxVisibleHeadingLevel;
    });
  }, [
    procedureWorkspaceNodeMap,
    sectionEditorCurrentStyle,
    sectionEditorDraft?.content,
    sectionEditorDraft?.richTextHtml,
    sectionEditorNodeId
  ]);
  const sectionEditorFontFamilyOptions = useMemo(
    () =>
      mergeSectionEditorFontFamilies([
        sectionEditorCurrentFontFamily,
        ...SECTION_EDITOR_PREFERRED_FONT_FAMILIES,
        ...sectionEditorAvailableFonts
      ]),
    [sectionEditorAvailableFonts, sectionEditorCurrentFontFamily]
  );
  const sectionEditorFilteredFontFamilyOptions = useMemo(() => {
    const query = sectionEditorFontQuery.trim().toLowerCase();
    if (!query) return sectionEditorFontFamilyOptions;
    return sectionEditorFontFamilyOptions.filter((fontFamily) => fontFamily.toLowerCase().includes(query));
  }, [sectionEditorFontFamilyOptions, sectionEditorFontQuery]);
  const sectionEditorFontSizeOptions = useMemo(() => {
    const merged = new Set<number>([
      ...SECTION_EDITOR_FONT_SIZE_OPTIONS,
      clampSectionEditorFontSizePt(sectionEditorCurrentFontSizePt)
    ]);
    return Array.from(merged).sort((left, right) => left - right);
  }, [sectionEditorCurrentFontSizePt]);
  const sectionEditorCustomColorPreview = useMemo(() => {
    const hexColor = resolveSectionEditorColorHex(sectionEditorCustomColorState.hex);
    if (hexColor) return hexColor;
    const red = parseSectionEditorColorChannelInput(sectionEditorCustomColorState.red);
    const green = parseSectionEditorColorChannelInput(sectionEditorCustomColorState.green);
    const blue = parseSectionEditorColorChannelInput(sectionEditorCustomColorState.blue);
    if (red === null || green === null || blue === null) {
      return resolveSectionEditorColorHex(sectionEditorTextColor) ?? SECTION_EDITOR_DEFAULT_PICKER_TEXT_COLOR;
    }
    return buildSectionEditorColorHexFromChannels(red, green, blue);
  }, [sectionEditorCustomColorState, sectionEditorTextColor]);
  const sectionEditorResolvedTextColor = useMemo(
    () => resolveSectionEditorColorHex(sectionEditorTextColor) ?? SECTION_EDITOR_DEFAULT_PICKER_TEXT_COLOR,
    [sectionEditorTextColor]
  );
  const sectionEditorColorButtonStyle = useMemo(
    () => buildSectionEditorToolbarColorButtonStyle(sectionEditorResolvedTextColor),
    [sectionEditorResolvedTextColor]
  );
  const sectionEditorPreviewScopedNumbering = useMemo(() => {
    const numberingRootId = rootNode?.id ?? sectionEditorWorkspaceRootId;
    if (!sectionEditorNode || !sectionEditorDraft || !numberingRootId) {
      return procedureScopedNumbering;
    }
    const previewNodeById = new Map(globalNodeById);
    const nextProperties = { ...(sectionEditorNode.properties ?? {}) };
    if (sectionEditorDraft.numberingHidden) {
      nextProperties[NODE_NUMBER_HIDDEN_PROPERTY] = true;
    } else {
      delete nextProperties[NODE_NUMBER_HIDDEN_PROPERTY];
    }
    if (sectionEditorDraft.numberingStartAt !== null) {
      nextProperties[NODE_NUMBER_START_AT_PROPERTY] = sectionEditorDraft.numberingStartAt;
    } else {
      delete nextProperties[NODE_NUMBER_START_AT_PROPERTY];
    }
    delete nextProperties[NODE_NUMBER_OVERRIDE_PROPERTY];
    delete nextProperties[NODE_NUMBER_SEPARATOR_PROPERTY];
    previewNodeById.set(sectionEditorNode.id, {
      ...sectionEditorNode,
      properties: nextProperties
    });
    return buildScopedNumbering({
      activeProjectRootId: numberingRootId,
      numbering: procedureScopedNumbering,
      nodeById: previewNodeById,
      byParent: byParent as Map<string, AppNode[]>,
      workspaceRootNumberingEnabled: true,
      numberingMode: "tree_headings",
      consumesTreeNumbering: (node) =>
        !isFileLikeNode(node) && !isProcedureFieldNode(node) && !shouldHideNodeFromGenericUi(node)
    });
  }, [
    byParent,
    globalNodeById,
    procedureScopedNumbering,
    rootNode,
    sectionEditorDraft,
    sectionEditorNode,
    sectionEditorWorkspaceRootId
  ]);
  const sectionEditorHeadingPreview = useMemo(() => {
    if (!sectionEditorNode || !sectionEditorDraft) return "";
    if (sectionEditorDraft.numberingHidden) return "";
    return sectionEditorPreviewScopedNumbering.get(sectionEditorNode.id) ?? "";
  }, [sectionEditorDraft, sectionEditorNode, sectionEditorPreviewScopedNumbering]);
  const sectionEditorEffectiveTitleStyle = useMemo(
    () => resolveSectionEditorEffectiveTitleStyle(sectionEditorDraft?.titleStyle ?? null, sectionEditorTitleDefaults),
    [sectionEditorDraft?.titleStyle, sectionEditorTitleDefaults]
  );
  const sectionEditorTitleInputMetrics = useMemo(() => {
    const fontSizePx = convertSectionEditorPtToPx(sectionEditorEffectiveTitleStyle.fontSizePt);
    const lineHeightPx = Math.max(24, Math.ceil(fontSizePx * 1.16));
    const heightPx = Math.max(44, lineHeightPx + 18);
    return {
      heightPx,
      lineHeightPx
    };
  }, [sectionEditorEffectiveTitleStyle.fontSizePt]);
  const filteredSectionNodeLinkCandidates = useMemo(() => {
    if (!sectionEditorNode) return [] as ProcedureNodeLinkCandidate[];
    const normalizedQuery = sectionNodeLinkQuery.trim().toLowerCase();
    return allNodes
      .filter(
        (node) =>
          node.id !== sectionEditorNode.id &&
          node.type !== "file" &&
          canReadProcedureNode(node.id) &&
          !shouldHideNodeFromGenericUi(node)
      )
      .map((node) => {
        const workspaceRootId = findProcedureWorkspaceRootId(node.id, globalNodeById, workspaceRootIdSet);
        const label = getNodeDisplayName(node);
        const candidateWorkspaceName = workspaceRootId
          ? (
              projectByRootId.get(workspaceRootId)?.name ??
              getNodeDisplayName(globalNodeById.get(workspaceRootId) ?? null) ??
              label
            )
          : workspaceName || "Workspace";
        const pathLabel = buildProcedureNodePathLabel(node.id, globalNodeById, workspaceRootId);
        return {
          node,
          workspaceRootId,
          workspaceName: candidateWorkspaceName,
          pathLabel,
          isCurrentWorkspace: workspaceRootId === sectionEditorWorkspaceRootId,
          searchText: `${label} ${pathLabel} ${candidateWorkspaceName} ${node.type}`.toLowerCase()
        };
      })
      .filter((candidate) => (normalizedQuery.length > 0 ? candidate.searchText.includes(normalizedQuery) : true))
      .sort((left, right) => {
        if (left.isCurrentWorkspace !== right.isCurrentWorkspace) {
          return left.isCurrentWorkspace ? -1 : 1;
        }
        const workspaceCompare = left.workspaceName.localeCompare(right.workspaceName, undefined, { sensitivity: "base" });
        if (workspaceCompare !== 0) return workspaceCompare;
        return left.pathLabel.localeCompare(right.pathLabel, undefined, { sensitivity: "base" });
      });
  }, [
    allNodes,
    globalNodeById,
    projectByRootId,
    canReadProcedureNode,
    sectionEditorNode,
    sectionEditorWorkspaceRootId,
    sectionNodeLinkQuery,
    workspaceName,
    workspaceRootIdSet
  ]);
  const currentWorkspaceSectionNodeLinkCandidates = useMemo(
    () => filteredSectionNodeLinkCandidates.filter((candidate) => candidate.isCurrentWorkspace).slice(0, 10),
    [filteredSectionNodeLinkCandidates]
  );
  const otherWorkspaceSectionNodeLinkCandidates = useMemo(
    () => filteredSectionNodeLinkCandidates.filter((candidate) => !candidate.isCurrentWorkspace).slice(0, 10),
    [filteredSectionNodeLinkCandidates]
  );
  const filteredSectionAppLinkCandidates = useMemo(() => {
    const normalizedQuery = sectionAppQuery.trim().toLowerCase();
    const rawCandidates: ProcedureAppLinkCandidate[] = [];

    for (const node of allNodes) {
      if (shouldHideNodeFromGenericUi(node)) continue;
      const workspaceRootId = findProcedureWorkspaceRootId(node.id, globalNodeById, workspaceRootIdSet);
      const candidateWorkspaceName = resolveWorkspaceDisplayName(
        workspaceRootId,
        projectByRootId,
        globalNodeById,
        workspaceName
      );
      const sourceNodeLabel = getNodeDisplayName(node);
      for (const item of getNodeQuickApps(node)) {
        if (item.kind !== "local_path") continue;
        const target = resolveQuickAppLaunchTarget(item);
        if (!target) continue;
        rawCandidates.push({
          item: {
            ...item,
            target
          },
          sourceNode: node,
          workspaceRootId,
          workspaceName: candidateWorkspaceName,
          isCurrentWorkspace: workspaceRootId === sectionEditorWorkspaceRootId,
          searchText: `${item.label} ${target} ${sourceNodeLabel} ${candidateWorkspaceName}`.toLowerCase()
        });
      }
    }

    rawCandidates.sort((left, right) => {
      if (left.isCurrentWorkspace !== right.isCurrentWorkspace) {
        return left.isCurrentWorkspace ? -1 : 1;
      }
      const labelCompare = left.item.label.localeCompare(right.item.label, undefined, { sensitivity: "base" });
      if (labelCompare !== 0) return labelCompare;
      return left.workspaceName.localeCompare(right.workspaceName, undefined, { sensitivity: "base" });
    });

    const seenTargets = new Set<string>();
    return rawCandidates.filter((candidate) => {
      if (normalizedQuery.length > 0 && !candidate.searchText.includes(normalizedQuery)) {
        return false;
      }
      const dedupeKey = `${candidate.item.kind}:${candidate.item.target.trim().toLowerCase()}`;
      if (seenTargets.has(dedupeKey)) {
        return false;
      }
      seenTargets.add(dedupeKey);
      return true;
    });
  }, [
    allNodes,
    globalNodeById,
    projectByRootId,
    sectionAppQuery,
    sectionEditorWorkspaceRootId,
    workspaceName,
    workspaceRootIdSet
  ]);
  const currentWorkspaceSectionAppLinkCandidates = useMemo(
    () => filteredSectionAppLinkCandidates.filter((candidate) => candidate.isCurrentWorkspace).slice(0, 10),
    [filteredSectionAppLinkCandidates]
  );
  const otherWorkspaceSectionAppLinkCandidates = useMemo(
    () => filteredSectionAppLinkCandidates.filter((candidate) => !candidate.isCurrentWorkspace).slice(0, 10),
    [filteredSectionAppLinkCandidates]
  );

  const clearSectionWebsiteLinkBookmark = () => {
    sectionWebsiteLinkStartMarkerRef.current?.remove();
    sectionWebsiteLinkEndMarkerRef.current?.remove();
    sectionWebsiteLinkStartMarkerRef.current = null;
    sectionWebsiteLinkEndMarkerRef.current = null;
  };

  const dismissSectionWebsiteLinkDialog = () => {
    clearSectionWebsiteLinkBookmark();
    sectionWebsiteLinkRangeRef.current = null;
    sectionWebsiteLinkSerializedRangeRef.current = null;
    setSectionWebsiteLinkState(null);
    setSectionEditorFocusTarget("content");
  };

  const openFieldEditor = (entry: ProcedureFieldEntry) => {
    if (!canWriteProcedureNode(entry.node.id)) {
      setNotice("The active role cannot edit this field.");
      return;
    }
    setFieldEditorNodeId(entry.node.id);
    setFieldEditorDraft(buildFieldEditorDraft(entry));
    setNotice(null);
  };

  const openFieldOrderEditor = (node: AppNode) => {
    setFieldOrderEditorNodeId(node.id);
    setNotice(null);
  };

  const openTableViewEditor = (node: AppNode) => {
    const fields = getDirectFieldEntries(node, byParent).filter((entry) => canReadProcedureNode(entry.node.id));
    if (fields.length === 0) {
      setNotice("Add fields to this table before configuring the layout.");
      return;
    }
    setTableViewEditorNodeId(node.id);
    setTableViewEditorDraft(buildProcedureTableViewDraft(node, fields));
    setNotice(null);
  };

  useEffect(() => {
    const targetNodes = subtreeImageNodes.filter((node) => !imagePreviewSrcByNodeId[node.id]);
    if (targetNodes.length === 0) return;
    let cancelled = false;
    void (async () => {
      const nextEntries: Record<string, string> = {};
      for (const node of targetNodes) {
        const filePath = getNodePreferredFileLocationPath(node);
        if (!filePath) continue;
        const dataUrl = await readLocalImageDataUrl(filePath).catch(() => null);
        if (cancelled || !dataUrl) continue;
        nextEntries[node.id] = dataUrl;
      }
      if (cancelled || Object.keys(nextEntries).length === 0) return;
      setImagePreviewSrcByNodeId((current) => ({ ...current, ...nextEntries }));
    })();
    return () => {
      cancelled = true;
    };
  }, [imagePreviewSrcByNodeId, subtreeImageNodes]);

  const resolveProcedureImagePreviewSrc = (node: AppNode | null | undefined) => {
    if (!node) return null;
    return imagePreviewSrcByNodeId[node.id] ?? resolveDesktopPreviewSrc(node);
  };

  const ensureProcedureImagePreviewSrc = async (node: AppNode) => {
    const cached = imagePreviewSrcByNodeId[node.id];
    if (cached) return cached;
    const filePath = getNodePreferredFileLocationPath(node);
    if (filePath) {
      const dataUrl = await readLocalImageDataUrl(filePath).catch(() => null);
      if (dataUrl) {
        setImagePreviewSrcByNodeId((current) => (current[node.id] ? current : { ...current, [node.id]: dataUrl }));
        return dataUrl;
      }
    }
    return resolveDesktopPreviewSrc(node);
  };

  const closeFieldEditor = () => {
    setFieldEditorNodeId(null);
    setFieldEditorDraft(null);
    setFieldEditorSaving(false);
  };

  const closeFieldOrderEditor = () => {
    if (isDedicatedFieldOrderWindow && onCloseFieldOrderWindow) {
      void onCloseFieldOrderWindow();
      return;
    }
    setFieldOrderEditorNodeId(null);
  };

  const handleAddFieldFromFieldSettings = async () => {
    if (!fieldOrderEditorNode) return;
    if (!fieldOrderEditorWritable) {
      setNotice("The active role cannot add fields to this table.");
      return;
    }
    await onCreateProcedureItem(fieldOrderEditorNode.id, "field", "inside");
  };

  const handleDeleteField = async (entry: ProcedureFieldEntry) => {
    if (!canWriteProcedureNode(entry.node.id)) {
      setNotice("The active role cannot delete this field.");
      return;
    }
    const confirmed = window.confirm(`Delete field "${entry.node.name}"?`);
    if (!confirmed) return;
    const deleted = await onDeleteProcedureNode(entry.node.id);
    if (!deleted) return;
    if (fieldEditorNodeId === entry.node.id) {
      closeFieldEditor();
    }
    setNotice(`${entry.node.name} deleted.`);
  };

  const handleDeleteCurrentField = async () => {
    if (!fieldEditorNodeId) return;
    const targetNode = subtreeNodeMap.get(fieldEditorNodeId) ?? null;
    if (!targetNode) return;
    await handleDeleteField(buildProcedureFieldEntry(targetNode));
  };

  const closeTableViewEditor = () => {
    setTableViewEditorNodeId(null);
    setTableViewEditorDraft(null);
    setTableViewEditorSaving(false);
  };

  const handleFieldEditorKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest("textarea, select, button")) {
      return;
    }
    event.preventDefault();
    if (fieldEditorSaving) return;
    void handleSaveField();
  };

  const openSectionEditor = (
    node: AppNode,
    options?: {
      initialLabel?: string;
      focusTarget?: "label" | "content";
      deleteIfCancelled?: boolean;
    }
  ) => {
    const editableNode = resolveNearestProcedureEditableSectionNode(node, globalNodeById);
    if (!editableNode) {
      if (isFileLikeNode(node)) {
        onReviewNodeFile(node.id);
      }
      return;
    }
    if (!canWriteProcedureNode(editableNode.id)) {
      setNotice("The active role cannot edit this section.");
      return;
    }
    if (editableNode.id !== node.id) {
      setNotice(`Opened ${editableNode.name} because files cannot be edited as sections.`);
    } else {
      setNotice(null);
    }
    const editableNodeTitleLevel = resolveProcedureSectionTitleLevel(
      editableNode.id,
      rootNode?.id ?? procedureWorkspaceRootId ?? null,
      globalNodeById
    );
    const editableNodeLastTextColor = readSectionEditorLastTextColor(editableNode);
    const editableNodeTitleDefaults =
      sectionEditorTitleLevelDefaults[editableNodeTitleLevel] ??
      buildDefaultSectionEditorTitleDefaults(editableNodeTitleLevel);
    setSectionEditorNodeId(editableNode.id);
    const nextDraft = buildSectionEditorDraft(editableNode);
    setSectionEditorTitleDefaults(editableNodeTitleDefaults);
    setSectionEditorDraft({
      ...nextDraft,
      titleStyle: buildSectionEditorTitleStyleFromDefaults(editableNodeTitleDefaults),
      label: options?.initialLabel ?? nextDraft.label
    });
    setSectionEditorFocusTarget(options?.focusTarget ?? "content");
    setPendingNewSectionNodeId(options?.deleteIfCancelled ? editableNode.id : null);
    setSectionNodeLinkPickerOpen(false);
    setSectionNodeLinkQuery("");
    setSectionAppPickerOpen(false);
    setSectionAppQuery("");
    setSectionWebsiteLinkState(null);
    setSectionEditorContextMenu(null);
    clearSectionWebsiteLinkBookmark();
    clearSectionEditorInsertRange();
    sectionWebsiteLinkRangeRef.current = null;
    sectionWebsiteLinkSerializedRangeRef.current = null;
    setSectionEditorStyleMenuOpen(false);
    setSectionEditorColorPickerOpen(false);
    setSectionEditorCustomColorPanelOpen(false);
    setSectionEditorTableMenuOpen(false);
    setSectionEditorLineSpacingMenuOpen(false);
    setSectionPhotoAdding(false);
    setSectionEditorCurrentStyle("normal");
    setSectionEditorCurrentAlignment(nextDraft.textAlignment);
    setSectionEditorTextColor(editableNodeLastTextColor);
    setSectionEditorCustomColorState(buildSectionEditorCustomColorState(editableNodeLastTextColor));
    setSectionEditorCurrentFontFamily(sectionEditorFormattingDefaults.fontFamily);
    setSectionEditorCurrentFontSizePt(sectionEditorFormattingDefaults.fontSizePt);
    setSectionEditorCurrentBold(sectionEditorFormattingDefaults.bold);
    setSectionEditorCurrentItalic(sectionEditorFormattingDefaults.italic);
    setSectionEditorCurrentLineSpacing(sectionEditorFormattingDefaults.lineSpacing);
    setSectionEditorCurrentIndentPx(0);
    sectionEditorPendingFontSizePtRef.current = null;
    setSectionNumberingPanelOpen(false);
    setSectionEditorActiveTableState(null);
    setSectionEditorSelectedImageId(null);
    setSectionEditorSelectedImageWidth(320);
    setSectionEditorSelectedImageAlignment(null);
    setSectionAttachmentAdding(false);
    setSectionAttachmentDeletingId(null);
    setAttachmentDeleteState(null);
  };

  const closeSectionEditor = (options?: { deletePendingNewSection?: boolean }) => {
    const shouldDeletePendingNewSection =
      options?.deletePendingNewSection !== false &&
      pendingNewSectionNodeId !== null &&
      sectionEditorNodeId === pendingNewSectionNodeId;
    const pendingSectionNodeId = shouldDeletePendingNewSection ? pendingNewSectionNodeId : null;
    setSectionEditorNodeId(null);
    setSectionEditorDraft(null);
    setSectionEditorSaving(false);
    setSectionEditorFocusTarget("content");
    setSectionEditorCurrentAlignment("left");
    setPendingNewSectionNodeId(null);
    setSectionNodeLinkPickerOpen(false);
    setSectionNodeLinkQuery("");
    setSectionAppPickerOpen(false);
    setSectionAppQuery("");
    setSectionWebsiteLinkState(null);
    setSectionEditorContextMenu(null);
    clearSectionWebsiteLinkBookmark();
    clearSectionEditorInsertRange();
    sectionWebsiteLinkRangeRef.current = null;
    sectionWebsiteLinkSerializedRangeRef.current = null;
    setSectionEditorStyleMenuOpen(false);
    setSectionEditorColorPickerOpen(false);
    setSectionEditorCustomColorPanelOpen(false);
    setSectionEditorTableMenuOpen(false);
    setSectionEditorLineSpacingMenuOpen(false);
    setSectionPhotoAdding(false);
    setSectionEditorCurrentStyle("normal");
    setSectionEditorTextColor(SECTION_EDITOR_DEFAULT_PICKER_TEXT_COLOR);
    setSectionEditorCustomColorState(buildSectionEditorCustomColorState(SECTION_EDITOR_DEFAULT_PICKER_TEXT_COLOR));
    setSectionEditorCurrentFontFamily(sectionEditorFormattingDefaults.fontFamily);
    setSectionEditorCurrentFontSizePt(sectionEditorFormattingDefaults.fontSizePt);
    setSectionEditorCurrentBold(sectionEditorFormattingDefaults.bold);
    setSectionEditorCurrentItalic(sectionEditorFormattingDefaults.italic);
    setSectionEditorCurrentLineSpacing(sectionEditorFormattingDefaults.lineSpacing);
    setSectionEditorCurrentIndentPx(0);
    sectionEditorPendingFontSizePtRef.current = null;
    setSectionNumberingPanelOpen(false);
    setSectionEditorActiveTableState(null);
    setSectionEditorSelectedImageId(null);
    setSectionEditorSelectedImageWidth(320);
    setSectionEditorSelectedImageAlignment(null);
    setSectionAttachmentAdding(false);
    setSectionAttachmentDeletingId(null);
    setAttachmentDeleteState(null);
    if (pendingSectionNodeId) {
      void onDeleteProcedureNode(pendingSectionNodeId);
    }
  };

  const openNewRecordEditor = (node: AppNode) => {
    if (!canWriteProcedureNode(node.id)) {
      setNotice("The active role cannot edit records in this table.");
      return;
    }
    const fields = getDirectFieldEntries(node, byParent).filter((entry) => canReadProcedureNode(entry.node.id));
    setRecordEditorParentNodeId(node.id);
    setRecordEditorRecordId(null);
    setDraftValues(mergeDraftValues(fields, {}));
    setRecordEditorOpen(true);
    setNotice(null);
  };

  const openExistingRecordEditor = (node: AppNode, record: ProcedureRecord) => {
    if (!canWriteProcedureNode(node.id)) {
      setNotice("The active role cannot edit records in this table.");
      return;
    }
    const fields = getDirectFieldEntries(node, byParent).filter((entry) => canReadProcedureNode(entry.node.id));
    setRecordEditorParentNodeId(node.id);
    setRecordEditorRecordId(record.id);
    setDraftValues(mergeDraftValues(fields, record.values));
    setRecordEditorOpen(true);
    setNotice(null);
  };

  const openLinkedRecord = (tableNodeId: string, recordId: string) => {
    const targetTable = procedureDatabaseModel.tablesById.get(tableNodeId) ?? null;
    if (!targetTable || !canReadProcedureNode(targetTable.node.id)) {
      setNotice("The linked record could not be opened.");
      return;
    }
    const targetRecord = targetTable.records.find((record) => record.id === recordId) ?? null;
    if (!targetRecord) {
      setNotice("The linked record could not be found.");
      return;
    }
    onActivateProcedureSurface();
    openExistingRecordEditor(targetTable.node, targetRecord);
  };

  const closeRecordEditor = () => {
    setRecordEditorOpen(false);
    setRecordEditorParentNodeId(null);
    setRecordEditorRecordId(null);
    setDraftValues({});
    setRecordSaving(false);
    setRecordAttachmentAddingFieldId(null);
  };

  useEffect(() => {
    if (!recordEditorOpen || recordEditorFields.length === 0) return;
    setDraftValues((current) => mergeDraftValues(recordEditorFields, current));
  }, [recordEditorFields, recordEditorOpen]);

  useEffect(() => {
    if (!requestedFieldOrderNodeId || !rootNode) return;
    const targetNode =
      subtreeNodeMap.get(requestedFieldOrderNodeId) ??
      (rootNode.id === requestedFieldOrderNodeId ? rootNode : null);
    if (!targetNode || isFileLikeNode(targetNode) || isProcedureInlineAssetNode(targetNode)) {
      onFieldOrderRequestHandled?.();
      return;
    }
    openFieldOrderEditor(targetNode);
    onFieldOrderRequestHandled?.();
  }, [
    onFieldOrderRequestHandled,
    requestedFieldOrderNodeId,
    rootNode,
    subtreeNodeMap
  ]);

  useEffect(() => {
    if (!requestedFieldEditorNodeId) return;
    const targetNode =
      subtreeNodeMap.get(requestedFieldEditorNodeId) ??
      (rootNode && rootNode.id === requestedFieldEditorNodeId ? rootNode : null);
    if (!targetNode) {
      onFieldEditorRequestHandled?.();
      return;
    }
    const targetNodeIsField =
      targetNode.properties?.odeProcedureItemType === "field" ||
      (typeof targetNode.properties?.odeProcedureFieldType === "string" &&
        targetNode.properties.odeProcedureFieldType.trim().length > 0);
    if (targetNodeIsField) {
      openFieldEditor(buildProcedureFieldEntry(targetNode));
    } else if (isFileLikeNode(targetNode) || isProcedureInlineAssetNode(targetNode)) {
      onReviewNodeFile(targetNode.id);
    } else {
      openSectionEditor(targetNode, {
        initialLabel: requestedBlankSectionEditorNodeId === targetNode.id ? "" : undefined,
        focusTarget: requestedBlankSectionEditorNodeId === targetNode.id ? "label" : "content",
        deleteIfCancelled: requestedBlankSectionEditorNodeId === targetNode.id
      });
    }
    onFieldEditorRequestHandled?.();
  }, [
    onFieldEditorRequestHandled,
    onReviewNodeFile,
    requestedBlankSectionEditorNodeId,
    requestedFieldEditorNodeId,
    rootNode,
    subtreeNodeMap
  ]);

  useEffect(() => {
    if (!fieldOrderEditorNodeId) return;
    if (fieldOrderEditorNode) return;
    setFieldOrderEditorNodeId(null);
  }, [fieldOrderEditorNode, fieldOrderEditorNodeId]);

  useEffect(() => {
    if (!tableViewEditorNodeId) return;
    if (tableViewEditorNode) return;
    closeTableViewEditor();
  }, [tableViewEditorNode, tableViewEditorNodeId]);

  useEffect(() => {
    if (!sectionEditorNodeId || !sectionEditorDraft) return;
    const frame = window.requestAnimationFrame(() => {
      const surface = sectionEditorSurfaceRef.current;
      if (!surface) return;
      const nextRichTextHtml =
        sectionEditorDraft.richTextHtml && sectionEditorDraft.richTextHtml.trim().length > 0
          ? sanitizeProcedureRichTextHtml(sectionEditorDraft.richTextHtml)
          : "";
      const nextSurfaceHtml =
        nextRichTextHtml || procedureTextToEditorHtml(sectionEditorDraft.content, globalNodeById, imagePreviewSrcByNodeId);
      const currentSerialized = serializeProcedureEditorRichText(surface);
      const currentRichTextHtml = currentSerialized.richTextHtml ? sanitizeProcedureRichTextHtml(currentSerialized.richTextHtml) : "";
      const shouldRefreshSurface =
        currentSerialized.content !== sectionEditorDraft.content || currentRichTextHtml !== nextRichTextHtml;

      if (!shouldRefreshSurface) {
        if (!surface.firstElementChild) {
          surface.innerHTML = nextSurfaceHtml;
          normalizeSectionEditorSurfaceStructure(surface);
        }
        return;
      }

      surface.innerHTML = nextSurfaceHtml;
      normalizeSectionEditorSurfaceStructure(surface);
      if (!sectionEditorDraft.richTextHtml && !sectionEditorDraft.content.trim()) {
        const firstBlock =
          surface.firstElementChild instanceof HTMLElement &&
          isProcedureEditorBlockTag(surface.firstElementChild.tagName.toLowerCase())
            ? surface.firstElementChild
            : null;
        if (firstBlock) {
          applySectionEditorFormattingDefaultsToBlock(firstBlock);
        }
      }
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [
    globalNodeById,
    imagePreviewSrcByNodeId,
    sectionEditorFormattingDefaults.bold,
    sectionEditorFormattingDefaults.fontFamily,
    sectionEditorFormattingDefaults.fontSizePt,
    sectionEditorFormattingDefaults.italic,
    sectionEditorFormattingDefaults.lineSpacing,
    sectionEditorFormattingDefaults.textColor,
    sectionEditorDraft,
    sectionEditorNodeId
  ]);

  useEffect(() => {
    if (!sectionEditorNodeId || !sectionEditorDraft) {
      sectionEditorUndoStackRef.current = [];
      sectionEditorRedoStackRef.current = [];
      sectionEditorHistoryCurrentRef.current = null;
      sectionEditorHistoryNodeIdRef.current = null;
      sectionEditorHistoryApplyingRef.current = false;
      syncSectionEditorHistoryAvailability();
      return;
    }

    const nextSnapshot = buildSectionEditorHistorySnapshot(sectionEditorDraft);
    if (sectionEditorHistoryNodeIdRef.current !== sectionEditorNodeId) {
      sectionEditorUndoStackRef.current = [];
      sectionEditorRedoStackRef.current = [];
      sectionEditorHistoryCurrentRef.current = nextSnapshot;
      sectionEditorHistoryNodeIdRef.current = sectionEditorNodeId;
      sectionEditorHistoryApplyingRef.current = false;
      syncSectionEditorHistoryAvailability();
      return;
    }

    const currentSnapshot = sectionEditorHistoryCurrentRef.current;
    if (areSectionEditorHistorySnapshotsEqual(currentSnapshot, nextSnapshot)) {
      return;
    }

    if (sectionEditorHistoryApplyingRef.current) {
      sectionEditorHistoryCurrentRef.current = nextSnapshot;
      sectionEditorHistoryApplyingRef.current = false;
      syncSectionEditorHistoryAvailability();
      return;
    }

    if (currentSnapshot) {
      sectionEditorUndoStackRef.current = [...sectionEditorUndoStackRef.current, currentSnapshot].slice(
        -SECTION_EDITOR_HISTORY_LIMIT
      );
    }
    sectionEditorRedoStackRef.current = [];
    sectionEditorHistoryCurrentRef.current = nextSnapshot;
    syncSectionEditorHistoryAvailability();
  }, [sectionEditorDraft, sectionEditorNodeId]);

  useEffect(() => {
    const surface = sectionEditorSurfaceRef.current;
    if (!surface) return;
    const imageElements = surface.querySelectorAll('img[data-ode-link-type="image"][data-node-id]');
    imageElements.forEach((element) => {
      const nodeId = element.getAttribute("data-node-id")?.trim() || "";
      const nextSrc = imagePreviewSrcByNodeId[nodeId];
      if (nextSrc && element.getAttribute("src") !== nextSrc) {
        element.setAttribute("src", nextSrc);
      }
    });
  }, [imagePreviewSrcByNodeId, sectionEditorNodeId]);

  useEffect(() => {
    syncSectionEditorSelectedImageStyles();
  }, [sectionEditorSelectedImageId, sectionEditorNodeId]);

  useEffect(() => {
    if (!sectionEditorSelectedImageId) {
      setSectionEditorSelectedImageOverlay(null);
      stopSectionEditorImageResize();
      return;
    }
    const viewport = sectionEditorDocumentViewportRef.current;
    if (!viewport) return;
    let frame = window.requestAnimationFrame(() => {
      syncSectionEditorSelectedImageOverlay();
    });
    const scheduleOverlaySync = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        syncSectionEditorSelectedImageOverlay();
      });
    };
    viewport.addEventListener("scroll", scheduleOverlaySync, { passive: true });
    window.addEventListener("resize", scheduleOverlaySync);
    return () => {
      window.cancelAnimationFrame(frame);
      viewport.removeEventListener("scroll", scheduleOverlaySync);
      window.removeEventListener("resize", scheduleOverlaySync);
    };
  }, [sectionEditorSelectedImageAlignment, sectionEditorSelectedImageId, sectionEditorSelectedImageWidth, sectionEditorNodeId]);

  useEffect(() => {
    return () => {
      stopSectionEditorImageResize();
    };
  }, []);

  useEffect(() => {
    if (!sectionEditorNodeId) return;
    const frame = window.requestAnimationFrame(() => {
      if (sectionEditorFocusTarget === "label") {
        const input = sectionEditorTitleInputRef.current;
        if (!input) return;
        syncSectionEditorTitleFormattingState();
        input.focus();
        const caretPosition = input.value.length;
        input.setSelectionRange(caretPosition, caretPosition);
        return;
      }
      if (sectionEditorFocusTarget === "panel") {
        return;
      }

      const surface = sectionEditorSurfaceRef.current;
      if (!surface) return;
      focusSectionEditorSurface();
      const range = restoreSectionEditorSelection();
      if (!range) return;
      sectionEditorSelectionRef.current = range.cloneRange();
      setSectionEditorCurrentStyle(resolveSectionEditorCurrentStyle(findSectionEditorBlockElement(range.startContainer, surface)));
      setSectionEditorCurrentAlignment(
        resolveSectionEditorBlockAlignment(findSectionEditorTopLevelBlockElement(range.startContainer, surface))
      );
      syncSectionEditorSelectionFormattingState(range.startContainer, surface);
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [sectionEditorFocusTarget, sectionEditorNodeId]);

  useEffect(() => {
    if (
      !sectionNumberingPanelOpen ||
      sectionEditorDraft?.numberingHidden ||
      sectionEditorDraft?.numberingStartAt === null
    ) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const input = sectionNumberingStartAtInputRef.current;
      if (!input) return;
      input.focus();
      input.select();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [sectionNumberingPanelOpen, sectionEditorDraft?.numberingHidden, sectionEditorDraft?.numberingStartAt]);

  useEffect(() => {
    if (sectionEditorFocusTarget === "label" || sectionEditorFocusTarget === "content") {
      sectionEditorFormattingTargetRef.current = sectionEditorFocusTarget;
    }
  }, [sectionEditorFocusTarget]);

  useEffect(() => {
    setSectionEditorLineSpacingInput(getSectionEditorLineSpacingDisplayValue(sectionEditorCurrentLineSpacing));
  }, [sectionEditorCurrentLineSpacing]);

  useEffect(() => {
    setSectionEditorFontSizeInput(`${clampSectionEditorFontSizePt(sectionEditorCurrentFontSizePt)}`);
  }, [sectionEditorCurrentFontSizePt]);

  useEffect(() => {
    if (!sectionEditorColorPickerOpen) {
      setSectionEditorCustomColorPanelOpen(false);
    }
  }, [sectionEditorColorPickerOpen]);

  useEffect(() => {
    if (!sectionEditorCustomColorPanelOpen) return;
    setSectionEditorCustomColorState(buildSectionEditorCustomColorState(sectionEditorTextColor));
  }, [sectionEditorCustomColorPanelOpen, sectionEditorTextColor]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        SECTION_EDITOR_RECENT_TEXT_COLOR_STORAGE_KEY,
        JSON.stringify(sectionEditorRecentTextColors)
      );
    } catch {
      // Ignore persistence failures and keep the in-memory list.
    }
  }, [sectionEditorRecentTextColors]);

  useEffect(() => {
    setSectionEditorFormattingDefaults((current) =>
      areSectionEditorFormattingDefaultsEqual(current, procedureWorkspaceFormattingDefaults)
        ? current
        : procedureWorkspaceFormattingDefaults
    );
  }, [procedureWorkspaceFormattingDefaults]);

  useEffect(() => {
    setSectionEditorTitleLevelDefaults((current) =>
      areSectionEditorTitleLevelDefaultsEqual(current, procedureWorkspaceTitleLevelDefaults)
        ? current
        : procedureWorkspaceTitleLevelDefaults
    );
  }, [procedureWorkspaceTitleLevelDefaults]);

  useEffect(() => {
    const nextDefaults =
      sectionEditorTitleLevelDefaults[sectionEditorCurrentTitleLevel] ??
      buildDefaultSectionEditorTitleDefaults(sectionEditorCurrentTitleLevel);
    setSectionEditorTitleDefaults((current) =>
      areSectionEditorTitleDefaultsEqual(current, nextDefaults) ? current : nextDefaults
    );
  }, [sectionEditorCurrentTitleLevel, sectionEditorTitleLevelDefaults]);

  useEffect(() => {
    setSectionEditorHeadingStyleDefaults((current) =>
      areSectionEditorHeadingStyleDefaultsEqual(current, procedureWorkspaceHeadingStyleDefaults)
        ? current
        : procedureWorkspaceHeadingStyleDefaults
    );
  }, [procedureWorkspaceHeadingStyleDefaults]);

  useEffect(() => {
    if (!sectionEditorStyleMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (sectionEditorStyleMenuRef.current?.contains(target)) return;
      setSectionEditorStyleMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSectionEditorStyleMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [sectionEditorStyleMenuOpen]);

  useEffect(() => {
    if (!sectionEditorFontMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (sectionEditorFontMenuRef.current?.contains(target)) return;
      setSectionEditorFontMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSectionEditorFontMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [sectionEditorFontMenuOpen]);

  useEffect(() => {
    if (!sectionEditorFontMenuOpen) return;
    const frame = window.requestAnimationFrame(() => {
      sectionEditorFontSearchInputRef.current?.focus();
      sectionEditorFontSearchInputRef.current?.select();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [sectionEditorFontMenuOpen]);

  useEffect(() => {
    if (!sectionEditorFontSizeMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (sectionEditorFontSizeMenuRef.current?.contains(target)) return;
      setSectionEditorFontSizeMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSectionEditorFontSizeMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [sectionEditorFontSizeMenuOpen]);

  useEffect(() => {
    if (!sectionEditorLineSpacingMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (sectionEditorLineSpacingMenuRef.current?.contains(target)) return;
      setSectionEditorLineSpacingMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSectionEditorLineSpacingMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [sectionEditorLineSpacingMenuOpen]);

  useEffect(() => {
    if (!sectionEditorColorPickerOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (sectionEditorColorPickerRef.current?.contains(target)) return;
      setSectionEditorColorPickerOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSectionEditorColorPickerOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [sectionEditorColorPickerOpen]);

  useEffect(() => {
    if (!sectionEditorTableMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (sectionEditorTableMenuRef.current?.contains(target)) return;
      setSectionEditorTableMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSectionEditorTableMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [sectionEditorTableMenuOpen]);

  useEffect(() => {
    const hasActiveTable = Boolean(sectionEditorActiveTableState);
    if (sectionEditorContextMenu?.target === "content") {
      return;
    }
    if (hasActiveTable) {
      if (!sectionEditorTableMenuOpen) {
        setSectionEditorTableMenuOpen(true);
        sectionEditorAutoOpenedTableMenuRef.current = true;
      }
      return;
    }
    if (sectionEditorAutoOpenedTableMenuRef.current) {
      sectionEditorAutoOpenedTableMenuRef.current = false;
      setSectionEditorTableMenuOpen(false);
    }
  }, [sectionEditorActiveTableState, sectionEditorContextMenu, sectionEditorTableMenuOpen]);

  useEffect(() => {
    if (!sectionWebsiteLinkState) return;
    const frame = window.requestAnimationFrame(() => {
      const targetInput =
        sectionWebsiteLinkState.label.trim().length > 0
          ? sectionWebsiteLinkUrlInputRef.current
          : sectionWebsiteLinkLabelInputRef.current;
      if (!targetInput) return;
      targetInput.focus();
      const caretPosition = targetInput.value.length;
      targetInput.setSelectionRange(caretPosition, caretPosition);
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [Boolean(sectionWebsiteLinkState)]);

  useEffect(() => {
    if (!sectionEditorNodeId || sectionEditorFontsRequestedRef.current) return;
    sectionEditorFontsRequestedRef.current = true;
    let cancelled = false;
    void getWindowsInstalledFontFamilies()
      .then((fonts) => {
        if (cancelled || fonts.length === 0) return;
        setSectionEditorAvailableFonts((current) =>
          mergeSectionEditorFontFamilies([...current, ...fonts])
        );
      })
      .catch(() => {
        // Keep the preferred fallback list when font enumeration is unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, [sectionEditorNodeId]);

  const ensureSectionEditorSurfaceHasContent = (surface: HTMLElement) => {
    const hasMeaningfulContent = Array.from(surface.childNodes).some((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        return normalizeProcedureEditorText(child.textContent ?? "").trim().length > 0;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) {
        return false;
      }
      const element = child as HTMLElement;
      if (isProcedureEditorIgnoredElement(element)) {
        return false;
      }
      const tagName = element.tagName.toLowerCase();
      if (tagName === "hr") return true;
      if (tagName === "img") return true;
      return normalizeProcedureEditorText(element.textContent ?? "").trim().length > 0 || element.querySelector("br, img");
    });
    if (hasMeaningfulContent) return;
    surface.innerHTML = "<p><br></p>";
  };

  const normalizeSectionEditorImages = (surface: HTMLElement) => {
    const imageElements = surface.querySelectorAll('img[data-ode-link-type="image"]');
    imageElements.forEach((element, index) => {
      if (!element.getAttribute("data-ode-image-instance-id")) {
        element.setAttribute("data-ode-image-instance-id", `img-${Date.now()}-${index}`);
      }
      const widthValue = Number.parseInt(element.getAttribute("width") ?? "", 10);
      if (!Number.isFinite(widthValue) || widthValue <= 0) {
        element.setAttribute("width", "320");
      }
      element.setAttribute("contenteditable", "false");
      element.setAttribute("draggable", "false");
    });
  };

  const normalizeSectionEditorInlineTypography = (surface: HTMLElement) => {
    const browserGeneratedFontSizes = new Set([
      "xx-small",
      "x-small",
      "small",
      "medium",
      "large",
      "x-large",
      "xx-large",
      "xxx-large",
      "-webkit-xxx-large"
    ]);
    const legacyHtmlFontSizeMap: Record<string, number> = {
      "1": 8,
      "2": 10,
      "3": 12,
      "4": 14,
      "5": 18,
      "6": 24,
      "7": 36
    };
    let appliedPendingFontSize = false;

    Array.from(surface.querySelectorAll("font")).forEach((fontNode) => {
      const span = document.createElement("span");
      const color = fontNode.getAttribute("color")?.trim() ?? "";
      const fontFamily = normalizeSectionEditorFontFamilyName(fontNode.getAttribute("face") ?? fontNode.style.fontFamily);
      const inlineSize = parseSectionEditorFontSizePt(fontNode.style.fontSize);
      const legacySize = legacyHtmlFontSizeMap[(fontNode.getAttribute("size") ?? "").trim()] ?? null;
      const nextFontSize =
        inlineSize ??
        (sectionEditorPendingFontSizePtRef.current !== null
          ? (appliedPendingFontSize = true, sectionEditorPendingFontSizePtRef.current)
          : legacySize);
      if (color) span.style.color = color;
      if (fontFamily) {
        span.style.fontFamily = buildSectionEditorFontFamilyCssValue(fontFamily);
      }
      if (nextFontSize !== null) {
        span.style.fontSize = `${clampSectionEditorFontSizePt(nextFontSize)}pt`;
      }
      if (fontNode.style.fontWeight) span.style.fontWeight = fontNode.style.fontWeight;
      if (fontNode.style.fontStyle) span.style.fontStyle = fontNode.style.fontStyle;
      if (fontNode.style.textDecoration) span.style.textDecoration = fontNode.style.textDecoration;
      while (fontNode.firstChild) {
        span.appendChild(fontNode.firstChild);
      }
      fontNode.replaceWith(span);
    });

    Array.from(surface.querySelectorAll<HTMLElement>("[style*='font-family']")).forEach((element) => {
      const normalizedFamily = normalizeSectionEditorFontFamilyName(element.style.fontFamily);
      if (!normalizedFamily) {
        element.style.removeProperty("font-family");
        return;
      }
      element.style.fontFamily = buildSectionEditorFontFamilyCssValue(normalizedFamily);
    });

    Array.from(surface.querySelectorAll<HTMLElement>("[style*='font-size']")).forEach((element) => {
      const rawFontSize = element.style.fontSize.trim().toLowerCase();
      if (!rawFontSize) {
        element.style.removeProperty("font-size");
        return;
      }
      if (browserGeneratedFontSizes.has(rawFontSize)) {
        const nextFontSize = sectionEditorPendingFontSizePtRef.current ?? sectionEditorCurrentFontSizePt;
        element.style.fontSize = `${clampSectionEditorFontSizePt(nextFontSize)}pt`;
        appliedPendingFontSize = true;
        return;
      }
      const parsedFontSize = parseSectionEditorFontSizePt(rawFontSize);
      if (parsedFontSize === null) {
        element.style.removeProperty("font-size");
        return;
      }
      element.style.fontSize = `${parsedFontSize}pt`;
    });

    if (appliedPendingFontSize) {
      sectionEditorPendingFontSizePtRef.current = null;
    }
  };

  const resolveSectionEditorComputedTypography = (node: Node | null, surface: HTMLElement) => {
    const target =
      node instanceof HTMLElement ? node : node?.parentElement instanceof HTMLElement ? node.parentElement : surface;
    const computed = window.getComputedStyle(target);
    const fontWeightValue = target.style.fontWeight || computed.fontWeight;
    const parsedFontWeight = Number(fontWeightValue);
    const bold =
      fontWeightValue.trim().toLowerCase() === "bold" ||
      (Number.isFinite(parsedFontWeight) && parsedFontWeight >= 600);
    const fontStyleValue = (target.style.fontStyle || computed.fontStyle).trim().toLowerCase();
    return {
      color: resolveSectionEditorColorHex(computed.color) ?? SECTION_EDITOR_DEFAULT_TEXT_COLOR,
      fontFamily:
        normalizeSectionEditorFontFamilyName(target.style.fontFamily) ||
        normalizeSectionEditorFontFamilyName(computed.fontFamily) ||
        SECTION_EDITOR_DEFAULT_FONT_FAMILY,
      fontSizePt:
        parseSectionEditorFontSizePt(target.style.fontSize) ??
        parseSectionEditorFontSizePt(computed.fontSize) ??
        SECTION_EDITOR_DEFAULT_FONT_SIZE_PT,
      bold,
      italic: fontStyleValue.includes("italic")
    };
  };

  const persistSectionEditorWorkspaceFormattingDefaults = (nextDefaults: SectionEditorFormattingDefaults) => {
    if (!procedureWorkspaceRootNode) return;
    void onSaveNodeProperties(procedureWorkspaceRootNode.id, {
      ...(procedureWorkspaceRootNode.properties ?? {}),
      [SECTION_BODY_STYLE_PROPERTY]: {
        fontFamily: nextDefaults.fontFamily,
        fontSizePt: clampSectionEditorFontSizePt(nextDefaults.fontSizePt),
        textColor: nextDefaults.textColor,
        bold: nextDefaults.bold,
        italic: nextDefaults.italic,
        lineSpacing: nextDefaults.lineSpacing
      }
    });
  };

  const persistSectionEditorWorkspaceTitleDefaults = (nextDefaults: SectionEditorTitleLevelDefaults) => {
    if (!procedureWorkspaceRootNode) return;
    const nextProperties = { ...(procedureWorkspaceRootNode.properties ?? {}) } as Record<string, unknown>;
    nextProperties[SECTION_TITLE_STYLES_PROPERTY] = Object.fromEntries(
      (Object.entries(nextDefaults) as Array<[string, SectionEditorTitleDefaults]>).map(([level, value]) => [
        level,
        {
          fontFamily: value.fontFamily,
          fontSizePt: clampSectionEditorFontSizePt(value.fontSizePt),
          textColor: value.textColor,
          bold: value.bold,
          italic: value.italic,
          textAlignment: value.textAlignment
        }
      ])
    );
    delete nextProperties[SECTION_TITLE_COLOR_PROPERTY];
    delete nextProperties[SECTION_TITLE_FONT_FAMILY_PROPERTY];
    delete nextProperties[SECTION_TITLE_FONT_SIZE_PT_PROPERTY];
    delete nextProperties[SECTION_TITLE_BOLD_PROPERTY];
    delete nextProperties[SECTION_TITLE_ITALIC_PROPERTY];
    delete nextProperties[SECTION_TITLE_ALIGNMENT_PROPERTY];
    void onSaveNodeProperties(procedureWorkspaceRootNode.id, nextProperties);
  };

  const persistSectionEditorWorkspaceHeadingStyleDefaults = (
    nextDefaults: SectionEditorHeadingStyleDefaults
  ) => {
    if (!procedureWorkspaceRootNode) return;
    const serialized = Object.fromEntries(
      (Object.entries(nextDefaults) as Array<[string, SectionEditorFormattingDefaults]>).map(([level, value]) => [
        level,
        {
          fontFamily: value.fontFamily,
          fontSizePt: clampSectionEditorFontSizePt(value.fontSizePt),
          textColor: value.textColor,
          bold: value.bold,
          italic: value.italic,
          lineSpacing: value.lineSpacing
        }
      ])
    );
    void onSaveNodeProperties(procedureWorkspaceRootNode.id, {
      ...(procedureWorkspaceRootNode.properties ?? {}),
      [SECTION_BODY_HEADING_STYLES_PROPERTY]: serialized
    });
  };

  const updateSectionEditorFormattingDefaults = (patch: Partial<SectionEditorFormattingDefaults>) => {
    setSectionEditorFormattingDefaults((current) => {
      const next = {
        ...current,
        ...patch
      };
      if (!areSectionEditorFormattingDefaultsEqual(current, next)) {
        persistSectionEditorWorkspaceFormattingDefaults(next);
      }
      return next;
    });
  };

  const updateSectionEditorTitleDefaults = (patch: Partial<SectionEditorTitleDefaults>) => {
    setSectionEditorTitleDefaults((current) => {
      const next = {
        ...current,
        ...patch
      };
      setSectionEditorTitleLevelDefaults((currentLevelDefaults) => {
        const nextLevelDefaults = {
          ...currentLevelDefaults,
          [sectionEditorCurrentTitleLevel]: {
            ...currentLevelDefaults[sectionEditorCurrentTitleLevel],
            ...patch
          }
        };
        if (!areSectionEditorTitleLevelDefaultsEqual(currentLevelDefaults, nextLevelDefaults)) {
          persistSectionEditorWorkspaceTitleDefaults(nextLevelDefaults);
        }
        return nextLevelDefaults;
      });
      return next;
    });
  };

  const updateSectionEditorHeadingStyleDefaults = (
    level: ProcedureHeadingLevel,
    patch: Partial<SectionEditorFormattingDefaults>
  ) => {
    setSectionEditorHeadingStyleDefaults((current) => {
      const next = {
        ...current,
        [level]: {
          ...current[level],
          ...patch
        }
      };
      if (!areSectionEditorHeadingStyleDefaultsEqual(current, next)) {
        persistSectionEditorWorkspaceHeadingStyleDefaults(next);
      }
      return next;
    });
  };

  const syncSectionEditorTitleFormattingState = () => {
    setSectionEditorCurrentStyle("normal");
    setSectionEditorCurrentFontFamily(sectionEditorEffectiveTitleStyle.fontFamily);
    setSectionEditorCurrentFontSizePt(sectionEditorEffectiveTitleStyle.fontSizePt);
    setSectionEditorCurrentBold(sectionEditorEffectiveTitleStyle.bold);
    setSectionEditorCurrentItalic(sectionEditorEffectiveTitleStyle.italic);
    setSectionEditorCurrentAlignment(sectionEditorEffectiveTitleStyle.textAlignment);
    setSectionEditorCurrentLineSpacing("default");
    setSectionEditorCurrentListKind(null);
    setSectionEditorCurrentQuoteActive(false);
    setSectionEditorCurrentIndentPx(0);
    setSectionEditorActiveTableState(null);
  };

  const updateSectionEditorTitleStyle = (patch: Partial<SectionEditorTitleStyle>) => {
    setSectionEditorDraft((current) =>
      current
        ? {
            ...current,
            titleStyle: {
              ...(current.titleStyle ?? {}),
              ...patch
            }
          }
        : current
    );
    setSectionEditorFocusTarget("label");
  };

  const activateSectionEditorContentTarget = () => {
    sectionEditorFormattingTargetRef.current = "content";
    setSectionEditorFocusTarget("content");
  };

  const applySectionEditorFormattingDefaultsToBlock = (block: HTMLElement) => {
    block.style.removeProperty("font-family");
    block.style.removeProperty("font-size");
    block.style.removeProperty("color");
    block.style.removeProperty("line-height");
    block.style.removeProperty("font-weight");
    block.style.removeProperty("font-style");
  };

  const resolveSectionEditorBlockIndentPx = (block: HTMLElement | null, surface: HTMLElement) => {
    const target = block ?? surface;
    const computed = window.getComputedStyle(target);
    return clampSectionEditorIndentPx(
      parseSectionEditorCssLengthPx(target.style.textIndent || computed.textIndent) ??
        parseSectionEditorCssLengthPx(target.style.marginLeft || computed.marginLeft) ??
        0
    );
  };

  const applySectionEditorBlockFirstLineIndent = (block: HTMLElement, indentPx: number) => {
    if (indentPx <= 0) {
      block.style.removeProperty("text-indent");
    } else {
      block.style.textIndent = `${indentPx}px`;
    }
    block.style.removeProperty("margin-left");
    block.style.removeProperty("padding-left");
  };

  const clearSectionEditorSelectedHeadingOverrides = (headingLevel: ProcedureHeadingLevel) => {
    const surface = sectionEditorSurfaceRef.current;
    if (!surface) return;
    const range = restoreSectionEditorSelection();
    if (!range) return;
    const targetTagName = `H${headingLevel}`;
    const targetBlocks = resolveSelectedSectionEditorFormattableBlocks(range, surface).filter(
      (block) => block.tagName.toUpperCase() === targetTagName
    );
    if (targetBlocks.length === 0) return;
    targetBlocks.forEach((block) => {
      block.style.removeProperty("font-family");
      block.style.removeProperty("font-size");
      block.style.removeProperty("color");
      block.style.removeProperty("font-weight");
      block.style.removeProperty("font-style");
      block.style.removeProperty("line-height");
    });
    syncSectionEditorContentFromDom();
  };

  const resolveSectionEditorBlockMetrics = (block: HTMLElement | null, surface: HTMLElement) => {
    const target = block ?? surface;
    const computed = window.getComputedStyle(target);
    const fontSizePx = parseSectionEditorCssLengthPx(target.style.fontSize) ?? parseSectionEditorCssLengthPx(computed.fontSize) ?? 16;
    const hasExplicitLineHeight = target.style.lineHeight.trim().length > 0;
    return {
      indentPx: resolveSectionEditorBlockIndentPx(block, surface),
      lineSpacing: hasExplicitLineHeight
        ? resolveSectionEditorLineSpacingValue(parseSectionEditorLineHeightMultiplier(target.style.lineHeight, fontSizePx))
        : ("default" as SectionEditorLineSpacingValue)
    };
  };

  const resolveSectionEditorTableColumnCount = (table: HTMLTableElement) =>
    Math.max(
      1,
      ...Array.from(table.rows).map((row) => Math.max(1, row.cells.length))
    );

  const resolveSectionEditorActiveTableStateFromNode = (
    node: Node | null,
    surface: HTMLElement
  ): SectionEditorActiveTableState | null => {
    const cell = findSectionEditorTableCellElement(node, surface);
    if (!cell) return null;
    const table = findSectionEditorTableElement(cell, surface);
    const row = cell.parentElement;
    if (!table || !(row instanceof HTMLTableRowElement)) return null;
    const rows = Array.from(table.rows);
    const rowIndex = rows.indexOf(row);
    if (rowIndex < 0) return null;
    return {
      rowIndex,
      rowCount: rows.length,
      columnIndex: Math.max(0, cell.cellIndex),
      columnCount: resolveSectionEditorTableColumnCount(table)
    };
  };

  const syncSectionEditorSelectionFormattingState = (node: Node | null, surface: HTMLElement) => {
    const typography = resolveSectionEditorComputedTypography(node, surface);
    const blockMetrics = resolveSectionEditorBlockMetrics(findSectionEditorTopLevelBlockElement(node, surface), surface);
    const listLevel = resolveSectionEditorListLevel(findSectionEditorListItemElement(node, surface), surface);
    const listKind = resolveSectionEditorListKind(node, surface);
    const quoteActive = Boolean(findSectionEditorQuoteElement(node, surface));
    setSectionEditorCurrentFontFamily(typography.fontFamily);
    setSectionEditorCurrentFontSizePt(typography.fontSizePt);
    setSectionEditorCurrentBold(typography.bold);
    setSectionEditorCurrentItalic(typography.italic);
    setSectionEditorCurrentLineSpacing(blockMetrics.lineSpacing);
    setSectionEditorCurrentListKind(listKind);
    setSectionEditorCurrentQuoteActive(quoteActive);
    setSectionEditorCurrentIndentPx(Math.max(blockMetrics.indentPx, listLevel * SECTION_EDITOR_INDENT_STEP_PX));
    setSectionEditorActiveTableState(resolveSectionEditorActiveTableStateFromNode(node, surface));
  };

  const resolveSectionEditorBlockAlignment = (block: HTMLElement | null): SectionTextAlignment => {
    const textAlign = block?.style.textAlign?.trim().toLowerCase() ?? "";
    if (textAlign === "left" || textAlign === "center" || textAlign === "right" || textAlign === "justify") {
      return textAlign;
    }
    return sectionEditorDraft?.textAlignment ?? "left";
  };

  const syncSectionEditorSelectedImageStyles = () => {
    const surface = sectionEditorSurfaceRef.current;
    if (!surface) return;
    const imageElements = surface.querySelectorAll('img[data-ode-link-type="image"]');
    imageElements.forEach((element) => {
      const imageId = element.getAttribute("data-ode-image-instance-id");
      if (imageId && imageId === sectionEditorSelectedImageId) {
        element.setAttribute("data-ode-selected", "true");
      } else {
        element.removeAttribute("data-ode-selected");
      }
    });
    window.requestAnimationFrame(() => {
      syncSectionEditorSelectedImageOverlay();
    });
  };

  const getSelectedSectionEditorImageElement = () => {
    const surface = sectionEditorSurfaceRef.current;
    if (!surface || !sectionEditorSelectedImageId) return null;
    return surface.querySelector(
      `img[data-ode-link-type="image"][data-ode-image-instance-id="${sectionEditorSelectedImageId}"]`
    ) as HTMLImageElement | null;
  };

  const getSectionEditorSelectedImageMaxWidth = (image?: HTMLImageElement | null) => {
    const selectedImage = image ?? getSelectedSectionEditorImageElement();
    const surface = sectionEditorSurfaceRef.current;
    if (!selectedImage || !surface) return 120;
    const blockElement = findSectionEditorBlockElement(selectedImage, surface) ?? selectedImage.parentElement;
    const containerWidth =
      blockElement instanceof HTMLElement
        ? blockElement.clientWidth
        : selectedImage.parentElement instanceof HTMLElement
          ? selectedImage.parentElement.clientWidth
          : surface.clientWidth;
    return Math.max(120, Math.round(containerWidth || surface.clientWidth || 120));
  };

  const syncSectionEditorSelectedImageOverlay = () => {
    const viewport = sectionEditorDocumentViewportRef.current;
    const selectedImage = getSelectedSectionEditorImageElement();
    if (!viewport || !selectedImage || !selectedImage.isConnected) {
      setSectionEditorSelectedImageOverlay(null);
      return;
    }
    const viewportRect = viewport.getBoundingClientRect();
    const imageRect = selectedImage.getBoundingClientRect();
    setSectionEditorSelectedImageOverlay({
      top: imageRect.top - viewportRect.top + viewport.scrollTop,
      left: imageRect.left - viewportRect.left + viewport.scrollLeft,
      width: imageRect.width,
      height: imageRect.height,
      maxWidth: getSectionEditorSelectedImageMaxWidth(selectedImage)
    });
  };

  const stopSectionEditorImageResize = () => {
    const activeSession = sectionEditorImageResizeSessionRef.current;
    if (!activeSession) return;
    window.removeEventListener("mousemove", activeSession.onMouseMove);
    window.removeEventListener("mouseup", activeSession.onMouseUp);
    document.body.style.cursor = activeSession.previousCursor;
    document.body.style.userSelect = activeSession.previousUserSelect;
    sectionEditorImageResizeSessionRef.current = null;
  };

  const selectSectionEditorImageElement = (element: HTMLImageElement | null) => {
    if (!element) {
      stopSectionEditorImageResize();
      setSectionEditorSelectedImageId(null);
      setSectionEditorSelectedImageAlignment(null);
      setSectionEditorSelectedImageOverlay(null);
      syncSectionEditorSelectedImageStyles();
      return;
    }
    const nextId =
      element.getAttribute("data-ode-image-instance-id") ??
      `img-${Date.now()}-${Math.round(Math.random() * 10000)}`;
    element.setAttribute("data-ode-image-instance-id", nextId);
    const widthValue =
      Number.parseInt(element.getAttribute("width") ?? "", 10) ||
      Math.round(element.getBoundingClientRect().width) ||
      320;
    const surface = sectionEditorSurfaceRef.current;
    const blockElement = surface ? findSectionEditorBlockElement(element, surface) : null;
    const maxWidth = getSectionEditorSelectedImageMaxWidth(element);
    const blockMetrics = surface ? resolveSectionEditorBlockMetrics(blockElement, surface) : null;
    setSectionEditorSelectedImageId(nextId);
    setSectionEditorSelectedImageWidth(Math.max(120, Math.min(maxWidth, widthValue)));
    setSectionEditorSelectedImageAlignment(resolveSectionEditorBlockAlignment(blockElement));
    setSectionEditorCurrentLineSpacing(blockMetrics?.lineSpacing ?? "default");
    setSectionEditorCurrentListKind(null);
    setSectionEditorCurrentQuoteActive(false);
    setSectionEditorCurrentIndentPx(blockMetrics?.indentPx ?? 0);
    window.requestAnimationFrame(() => {
      syncSectionEditorSelectedImageStyles();
      syncSectionEditorSelectedImageOverlay();
    });
  };

  const applySectionEditorSelectedImageWidth = (nextWidth: number, options?: { syncContent?: boolean }) => {
    const selectedImage = getSelectedSectionEditorImageElement();
    if (!selectedImage) return;
    const clampedWidth = Math.max(120, Math.min(getSectionEditorSelectedImageMaxWidth(selectedImage), Math.round(nextWidth)));
    selectedImage.setAttribute("width", `${clampedWidth}`);
    selectedImage.style.width = `${clampedWidth}px`;
    selectedImage.style.maxWidth = "100%";
    selectedImage.style.height = "auto";
    setSectionEditorSelectedImageWidth(clampedWidth);
    if (options?.syncContent === false) {
      window.requestAnimationFrame(() => {
        syncSectionEditorSelectedImageOverlay();
      });
      return;
    }
    syncSectionEditorContentFromDom();
  };

  const fitSectionEditorSelectedImageToViewport = () => {
    const selectedImage = getSelectedSectionEditorImageElement();
    if (!selectedImage) return;
    applySectionEditorSelectedImageWidth(getSectionEditorSelectedImageMaxWidth(selectedImage));
  };

  const removeSelectedSectionEditorImage = () => {
    const selectedImage = getSelectedSectionEditorImageElement();
    const surface = sectionEditorSurfaceRef.current;
    const selection = window.getSelection();
    if (!selectedImage || !surface || !selection) return false;

    const blockElement = findSectionEditorBlockElement(selectedImage, surface) ?? selectedImage.parentElement;
    const nextBlock =
      blockElement?.nextElementSibling instanceof HTMLElement &&
      isProcedureEditorBlockTag(blockElement.nextElementSibling.tagName.toLowerCase())
        ? blockElement.nextElementSibling
        : null;
    const previousBlock =
      blockElement?.previousElementSibling instanceof HTMLElement &&
      isProcedureEditorBlockTag(blockElement.previousElementSibling.tagName.toLowerCase())
        ? blockElement.previousElementSibling
        : null;

    selectedImage.remove();
    selectSectionEditorImageElement(null);

    let targetBlock: HTMLElement | null =
      blockElement instanceof HTMLElement ? blockElement : null;
    let collapseToEnd = false;

    if (
      targetBlock &&
      !normalizeProcedureEditorText(targetBlock.textContent ?? "").trim() &&
      !targetBlock.querySelector("br, img")
    ) {
      if (nextBlock) {
        targetBlock.remove();
        targetBlock = nextBlock;
      } else if (previousBlock) {
        targetBlock.remove();
        targetBlock = previousBlock;
        collapseToEnd = true;
      } else {
        targetBlock.appendChild(document.createElement("br"));
      }
    } else if (!targetBlock) {
      targetBlock = document.createElement("p");
      targetBlock.appendChild(document.createElement("br"));
      surface.appendChild(targetBlock);
    } else {
      collapseToEnd = true;
    }

    const nextRange = document.createRange();
    nextRange.selectNodeContents(targetBlock);
    nextRange.collapse(!collapseToEnd);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    sectionEditorSelectionRef.current = nextRange.cloneRange();
    syncSectionEditorContentFromDom();
    return true;
  };

  const handleSectionEditorSelectedImageResizeStart = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const selectedImage = getSelectedSectionEditorImageElement();
    if (!selectedImage) return;
    stopSectionEditorImageResize();
    const startWidth = Math.round(selectedImage.getBoundingClientRect().width) || sectionEditorSelectedImageWidth;
    const startX = event.clientX;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "nwse-resize";
    document.body.style.userSelect = "none";
    const onMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      applySectionEditorSelectedImageWidth(startWidth + (moveEvent.clientX - startX), { syncContent: false });
    };
    const onMouseUp = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      stopSectionEditorImageResize();
      syncSectionEditorContentFromDom();
    };
    sectionEditorImageResizeSessionRef.current = {
      onMouseMove,
      onMouseUp,
      previousCursor,
      previousUserSelect
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const findSectionEditorListItemElement = (node: Node | null, surface: HTMLElement): HTMLLIElement | null => {
    let current: Node | null = node;
    while (current && current !== surface) {
      if (current instanceof HTMLLIElement) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  };

  const resolveSectionEditorListKind = (node: Node | null, surface: HTMLElement): SectionEditorListKind => {
    let current: Node | null = node;
    while (current && current !== surface) {
      if (current instanceof HTMLOListElement) {
        return "ordered";
      }
      if (current instanceof HTMLUListElement) {
        return "unordered";
      }
      current = current.parentNode;
    }
    return null;
  };

  const findSectionEditorListContainerElement = (node: Node | null, surface: HTMLElement): HTMLElement | null => {
    let current: Node | null = node;
    let currentList: HTMLElement | null = null;
    while (current && current !== surface) {
      if (current instanceof HTMLUListElement || current instanceof HTMLOListElement) {
        currentList = current;
      }
      current = current.parentNode;
    }
    if (!currentList) return null;
    let topLevelList = currentList;
    while (
      topLevelList.parentElement instanceof HTMLLIElement &&
      topLevelList.parentElement.parentElement instanceof HTMLElement &&
      (topLevelList.parentElement.parentElement instanceof HTMLUListElement ||
        topLevelList.parentElement.parentElement instanceof HTMLOListElement)
    ) {
      topLevelList = topLevelList.parentElement.parentElement;
    }
    return topLevelList;
  };

  const findSectionEditorQuoteElement = (node: Node | null, surface: HTMLElement): HTMLElement | null => {
    let current: Node | null = node;
    while (current && current !== surface) {
      if (current instanceof HTMLElement && current.tagName.toUpperCase() === "BLOCKQUOTE") {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  };

  const resolveSectionEditorListLevel = (listItem: HTMLLIElement | null, surface: HTMLElement): number => {
    if (!listItem) return 0;
    let level = 0;
    let current: HTMLElement | null = listItem.parentElement;
    while (current && current !== surface) {
      const tagName = current.tagName.toLowerCase();
      if (tagName === "ul" || tagName === "ol") {
        const parentListItem = current.parentElement;
        if (parentListItem instanceof HTMLLIElement) {
          level += 1;
          current = parentListItem.parentElement;
          continue;
        }
      }
      current = current.parentElement;
    }
    return level;
  };

  const findSectionEditorTableCellElement = (node: Node | null, surface: HTMLElement): HTMLTableCellElement | null => {
    let current: Node | null = node;
    while (current && current !== surface) {
      if (current instanceof HTMLTableCellElement) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  };

  const findSectionEditorTableElement = (node: Node | null, surface: HTMLElement): HTMLTableElement | null => {
    let current: Node | null = node;
    while (current && current !== surface) {
      if (current instanceof HTMLTableElement) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  };

  const ensureSectionEditorTableCellHasContent = (cell: HTMLTableCellElement) => {
    if (!normalizeProcedureEditorText(cell.textContent ?? "").trim() && !cell.querySelector("br, img, table")) {
      cell.appendChild(document.createElement("br"));
    }
  };

  const focusSectionEditorNodeContents = (element: HTMLElement, options?: { collapseToEnd?: boolean }) => {
    const selection = window.getSelection();
    if (!selection) return;
    ensureSectionEditorTableCellHasContent(element as HTMLTableCellElement);
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(Boolean(options?.collapseToEnd));
    selection.removeAllRanges();
    selection.addRange(range);
    sectionEditorSelectionRef.current = range.cloneRange();
    setSectionEditorFocusTarget("content");
    focusSectionEditorSurface();
    syncSectionEditorSelection();
  };

  const revealSectionEditorElement = (element: HTMLElement | null, behavior: ScrollBehavior = "smooth") => {
    if (!element) return;
    window.requestAnimationFrame(() => {
      try {
        element.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior
        });
      } catch {
        element.scrollIntoView();
      }
    });
  };

  const unwrapSectionEditorQuote = (quote: HTMLElement) => {
    const parent = quote.parentElement;
    if (!parent) return null;

    const fragment = document.createDocumentFragment();
    const insertedBlocks: HTMLElement[] = [];
    let inlineBuffer: ChildNode[] = [];

    const flushInlineBuffer = () => {
      if (inlineBuffer.length === 0) return;
      const paragraph = document.createElement("p");
      inlineBuffer.forEach((node) => paragraph.appendChild(node));
      if (!normalizeProcedureEditorText(paragraph.textContent ?? "").trim() && !paragraph.querySelector("br, img, table, hr")) {
        paragraph.appendChild(document.createElement("br"));
      }
      applySectionEditorFormattingDefaultsToBlock(paragraph);
      fragment.appendChild(paragraph);
      insertedBlocks.push(paragraph);
      inlineBuffer = [];
    };

    for (const child of Array.from(quote.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const textNode = child as Text;
        if (!normalizeProcedureEditorText(textNode.textContent ?? "").trim()) {
          textNode.remove();
          continue;
        }
        inlineBuffer.push(textNode);
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.parentNode?.removeChild(child);
        continue;
      }

      const element = child as HTMLElement;
      if (isProcedureEditorIgnoredElement(element)) {
        element.remove();
        continue;
      }

      const tagName = element.tagName.toLowerCase();
      if (tagName === "br") {
        inlineBuffer.push(element);
        continue;
      }
      if (!isProcedureEditorBlockTag(tagName) || tagName === "blockquote") {
        inlineBuffer.push(element);
        continue;
      }

      flushInlineBuffer();
      if (
        (tagName === "p" ||
          tagName === "h1" ||
          tagName === "h2" ||
          tagName === "h3" ||
          tagName === "h4" ||
          tagName === "h5" ||
          tagName === "h6") &&
        !normalizeProcedureEditorText(element.textContent ?? "").trim() &&
        !element.querySelector("br, img, table, hr")
      ) {
        element.appendChild(document.createElement("br"));
      }
      fragment.appendChild(element);
      insertedBlocks.push(element);
    }

    flushInlineBuffer();

    if (insertedBlocks.length === 0) {
      const paragraph = document.createElement("p");
      paragraph.appendChild(document.createElement("br"));
      applySectionEditorFormattingDefaultsToBlock(paragraph);
      fragment.appendChild(paragraph);
      insertedBlocks.push(paragraph);
    }

    parent.insertBefore(fragment, quote);
    quote.remove();
    return insertedBlocks[0] ?? null;
  };

  const appendSectionEditorTableRow = (table: HTMLTableElement) => {
    const existingRows = Array.from(table.querySelectorAll("tr"));
    const fallbackColumnCount =
      Math.max(
        1,
        ...existingRows.map((row) =>
          Array.from(row.children).reduce((total, cell) => {
            const span = Number.parseInt((cell as HTMLElement).getAttribute("colspan") ?? "", 10);
            return total + (Number.isFinite(span) && span > 0 ? span : 1);
          }, 0)
        )
      ) || 1;
    const targetBody =
      table.tBodies[0] ??
      (() => {
        const nextBody = document.createElement("tbody");
        table.appendChild(nextBody);
        return nextBody;
      })();
    const row = document.createElement("tr");
    for (let index = 0; index < fallbackColumnCount; index += 1) {
      const cell = document.createElement("td");
      cell.setAttribute("style", buildProcedureEditorTableCellStyle());
      cell.appendChild(document.createElement("br"));
      row.appendChild(cell);
    }
    targetBody.appendChild(row);
    return row.cells[0] ?? null;
  };

  const moveSectionEditorTableSelection = (direction: 1 | -1) => {
    const surface = sectionEditorSurfaceRef.current;
    const range = restoreSectionEditorSelection();
    if (!surface || !range) return false;
    const currentCell = findSectionEditorTableCellElement(range.startContainer, surface);
    if (!currentCell) return false;
    const table = findSectionEditorTableElement(currentCell, surface);
    if (!table) return false;
    const cells = Array.from(table.querySelectorAll("th, td")).filter(
      (cell): cell is HTMLTableCellElement => cell instanceof HTMLTableCellElement
    );
    const currentIndex = cells.indexOf(currentCell);
    if (currentIndex < 0) return false;
    let targetCell: HTMLTableCellElement | null = null;
    const nextIndex = currentIndex + direction;
    if (nextIndex >= 0 && nextIndex < cells.length) {
      targetCell = cells[nextIndex] ?? null;
    } else if (direction > 0) {
      targetCell = appendSectionEditorTableRow(table);
      syncSectionEditorContentFromDom(false);
    }
    if (!targetCell) return false;
    focusSectionEditorNodeContents(targetCell);
    return true;
  };

  const createSectionEditorTableCellElement = (header = false) => {
    const cell = document.createElement(header ? "th" : "td");
    cell.setAttribute("style", buildProcedureEditorTableCellStyle(header));
    cell.appendChild(document.createElement("br"));
    return cell;
  };

  const getSectionEditorActiveTableContext = () => {
    const surface = sectionEditorSurfaceRef.current;
    const range = restoreSectionEditorSelection();
    if (!surface || !range) return null;
    const cell = findSectionEditorTableCellElement(range.startContainer, surface);
    if (!cell) return null;
    const table = findSectionEditorTableElement(cell, surface);
    const row = cell.parentElement;
    if (!table || !(row instanceof HTMLTableRowElement)) return null;
    const rows = Array.from(table.rows);
    const rowIndex = rows.indexOf(row);
    if (rowIndex < 0) return null;
    return {
      surface,
      table,
      row,
      cell,
      rows,
      rowIndex,
      rowCount: rows.length,
      columnIndex: Math.max(0, cell.cellIndex),
      columnCount: resolveSectionEditorTableColumnCount(table)
    };
  };

  const insertSectionEditorTableRowAtSelection = (position: "above" | "below") => {
    if (!sectionEditorWritable) return;
    const context = getSectionEditorActiveTableContext();
    if (!context) return;
    const rowIsHeader = Array.from(context.row.cells).every((entry) => entry.tagName.toUpperCase() === "TH");
    const nextRow = document.createElement("tr");
    const nextColumnCount = Math.max(1, context.columnCount);
    for (let index = 0; index < nextColumnCount; index += 1) {
      nextRow.appendChild(createSectionEditorTableCellElement(rowIsHeader));
    }
    context.row.parentElement?.insertBefore(nextRow, position === "above" ? context.row : context.row.nextSibling);
    const focusCell =
      (nextRow.cells.item(Math.min(context.columnIndex, Math.max(0, nextRow.cells.length - 1))) as HTMLTableCellElement | null) ??
      (nextRow.cells.item(0) as HTMLTableCellElement | null);
    if (focusCell) {
      focusSectionEditorNodeContents(focusCell);
    }
    syncSectionEditorContentFromDom();
  };

  const insertSectionEditorTableColumnAtSelection = (position: "left" | "right") => {
    if (!sectionEditorWritable) return;
    const context = getSectionEditorActiveTableContext();
    if (!context) return;
    const insertionIndex = position === "left" ? context.columnIndex : context.columnIndex + 1;
    let focusCell: HTMLTableCellElement | null = null;
    context.rows.forEach((row) => {
      const rowIsHeader = Array.from(row.cells).every((entry) => entry.tagName.toUpperCase() === "TH");
      const nextCell = createSectionEditorTableCellElement(rowIsHeader);
      const referenceCell = row.cells.item(Math.min(insertionIndex, row.cells.length)) as HTMLTableCellElement | null;
      if (referenceCell) {
        row.insertBefore(nextCell, referenceCell);
      } else {
        row.appendChild(nextCell);
      }
      if (row === context.row) {
        focusCell = nextCell;
      }
    });
    if (focusCell) {
      focusSectionEditorNodeContents(focusCell);
    }
    syncSectionEditorContentFromDom();
  };

  const removeSectionEditorCurrentTable = () => {
    if (!sectionEditorWritable) return;
    const context = getSectionEditorActiveTableContext();
    if (!context) return;
    const nextSibling = context.table.nextElementSibling;
    const fallbackParagraph = document.createElement("p");
    fallbackParagraph.appendChild(document.createElement("br"));
    const shouldInsertFallback =
      !(nextSibling instanceof HTMLElement) ||
      nextSibling.tagName.toLowerCase() === "table" ||
      !isProcedureEditorBlockTag(nextSibling.tagName.toLowerCase());
    if (shouldInsertFallback) {
      context.table.parentElement?.insertBefore(fallbackParagraph, context.table.nextSibling);
    }
    context.table.remove();
    const focusTarget =
      shouldInsertFallback
        ? fallbackParagraph
        : nextSibling instanceof HTMLElement
          ? nextSibling
          : fallbackParagraph;
    focusSectionEditorNodeContents(focusTarget);
    syncSectionEditorContentFromDom();
  };

  const removeSectionEditorTableRowAtSelection = () => {
    if (!sectionEditorWritable) return;
    const context = getSectionEditorActiveTableContext();
    if (!context) return;
    if (context.rowCount <= 1) {
      removeSectionEditorCurrentTable();
      return;
    }
    const targetRowIndex = context.rowIndex < context.rowCount - 1 ? context.rowIndex + 1 : context.rowIndex - 1;
    const focusRow = context.rows[targetRowIndex] ?? null;
    context.row.remove();
    const focusCell =
      (focusRow?.cells.item(Math.min(context.columnIndex, Math.max(0, (focusRow?.cells.length ?? 1) - 1))) as HTMLTableCellElement | null) ??
      (focusRow?.cells.item(0) as HTMLTableCellElement | null);
    if (focusCell) {
      focusSectionEditorNodeContents(focusCell);
    }
    syncSectionEditorContentFromDom();
  };

  const removeSectionEditorTableColumnAtSelection = () => {
    if (!sectionEditorWritable) return;
    const context = getSectionEditorActiveTableContext();
    if (!context) return;
    if (context.columnCount <= 1) {
      removeSectionEditorCurrentTable();
      return;
    }
    let focusCell: HTMLTableCellElement | null = null;
    context.rows.forEach((row) => {
      const targetCell = row.cells.item(Math.min(context.columnIndex, Math.max(0, row.cells.length - 1))) as HTMLTableCellElement | null;
      if (!targetCell) return;
      if (row === context.row) {
        const nextSibling = targetCell.nextElementSibling;
        const previousSibling = targetCell.previousElementSibling;
        focusCell =
          (nextSibling instanceof HTMLTableCellElement ? nextSibling : null) ??
          (previousSibling instanceof HTMLTableCellElement ? previousSibling : null);
      }
      targetCell.remove();
    });
    if (focusCell) {
      focusSectionEditorNodeContents(focusCell);
    }
    syncSectionEditorContentFromDom();
  };

  const runSectionEditorTableAction = (action: () => void) => {
    action();
    setSectionEditorTableMenuOpen(false);
  };

  const findSectionEditorTopLevelBlockElement = (node: Node | null, surface: HTMLElement): HTMLElement | null => {
    let current: Node | null = node;
    while (current && current !== surface) {
      if (current instanceof HTMLElement && current.parentElement === surface && isProcedureEditorBlockTag(current.tagName.toLowerCase())) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  };

  const resolveSelectedSectionEditorBlocks = (range: Range, surface: HTMLElement): HTMLElement[] => {
    const blocks = Array.from(surface.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement && isProcedureEditorBlockTag(child.tagName.toLowerCase())
    );
    if (range.collapsed) {
      const currentBlock = findSectionEditorTopLevelBlockElement(range.startContainer, surface);
      return currentBlock ? [currentBlock] : [];
    }
    return blocks.filter((block) => {
      if (block.tagName.toUpperCase() === "HR") return false;
      try {
        return range.intersectsNode(block);
      } catch {
        const blockRange = document.createRange();
        blockRange.selectNodeContents(block);
        return !(
          range.compareBoundaryPoints(Range.END_TO_START, blockRange) <= 0 ||
          range.compareBoundaryPoints(Range.START_TO_END, blockRange) >= 0
        );
      }
    });
  };

  const resolveSelectedSectionEditorFormattableBlocks = (range: Range, surface: HTMLElement): HTMLElement[] =>
    resolveSelectedSectionEditorBlocks(range, surface).filter((block) => block.tagName.toUpperCase() !== "HR");

  const applySectionEditorTextAlignment = (nextAlignment: SectionTextAlignment) => {
    if (sectionEditorFormattingTargetRef.current === "label") {
      if (nextAlignment === "justify") return;
      setSectionEditorCurrentAlignment(nextAlignment);
      updateSectionEditorTitleDefaults({ textAlignment: nextAlignment });
      updateSectionEditorTitleStyle({ textAlignment: nextAlignment });
      return;
    }
    const selectedImage = getSelectedSectionEditorImageElement();
    if (selectedImage && nextAlignment === "justify") {
      return;
    }
    const surface = sectionEditorSurfaceRef.current;
    if (selectedImage && surface) {
      const blockElement = findSectionEditorBlockElement(selectedImage, surface) ?? selectedImage.parentElement;
      if (blockElement instanceof HTMLElement) {
        blockElement.style.textAlign = nextAlignment;
        setSectionEditorSelectedImageAlignment(nextAlignment);
        syncSectionEditorContentFromDom();
        return;
      }
    }

    focusSectionEditorSurface();
    const restoredRange = restoreSectionEditorSelection();
    if (!surface || !restoredRange) return;
    const targetBlocks = resolveSelectedSectionEditorBlocks(restoredRange, surface);
    if (targetBlocks.length === 0) {
      setSectionEditorDraft((current) => (current ? { ...current, textAlignment: nextAlignment } : current));
      setSectionEditorCurrentAlignment(nextAlignment);
      return;
    }
    targetBlocks.forEach((block) => {
      block.style.textAlign = nextAlignment;
    });
    setSectionEditorCurrentAlignment(nextAlignment);
    syncSectionEditorContentFromDom();
  };

  const handleSectionEditorAlignmentShortcut = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (
      !(event.ctrlKey || event.metaKey) ||
      event.shiftKey ||
      event.altKey ||
      event.nativeEvent.isComposing
    ) {
      return false;
    }
    const normalizedKey = event.key.toLowerCase();
    const nextAlignment: SectionTextAlignment | null =
      normalizedKey === "l"
        ? "left"
        : normalizedKey === "e"
          ? "center"
          : normalizedKey === "r"
            ? "right"
            : normalizedKey === "j"
              ? "justify"
              : null;
    if (!nextAlignment) return false;
    event.preventDefault();
    applySectionEditorTextAlignment(nextAlignment);
    return true;
  };

  const toggleSectionEditorQuoteBlock = () => {
    if (
      !sectionEditorWritable ||
      sectionEditorFormattingTargetRef.current === "label" ||
      sectionEditorSelectedImageId
    ) {
      return;
    }
    focusSectionEditorSurface();
    const restoredRange = restoreSectionEditorSelection();
    const surface = sectionEditorSurfaceRef.current;
    if (!surface || !restoredRange) return;
    const activeQuote = findSectionEditorQuoteElement(restoredRange.startContainer, surface);
    if (activeQuote) {
      const focusTarget = unwrapSectionEditorQuote(activeQuote);
      if (focusTarget) {
        focusSectionEditorNodeContents(focusTarget);
      }
    } else {
      document.execCommand("formatBlock", false, "<blockquote>");
    }
    syncSectionEditorContentFromDom();
    setSectionEditorStyleMenuOpen(false);
  };

  const applySectionEditorBlockIndentDelta = (delta: number) => {
    if (!sectionEditorWritable || delta === 0) return;
    if (sectionEditorFormattingTargetRef.current === "label") {
      return;
    }
    const selectedImage = getSelectedSectionEditorImageElement();
    const surface = sectionEditorSurfaceRef.current;
    if (selectedImage && surface) {
      const blockElement = findSectionEditorBlockElement(selectedImage, surface) ?? selectedImage.parentElement;
      if (blockElement instanceof HTMLElement) {
        const nextIndentPx = clampSectionEditorIndentPx(resolveSectionEditorBlockIndentPx(blockElement, surface) + delta);
        applySectionEditorBlockFirstLineIndent(blockElement, nextIndentPx);
        setSectionEditorCurrentIndentPx(nextIndentPx);
        syncSectionEditorContentFromDom();
        return;
      }
    }

    focusSectionEditorSurface();
    const restoredRange = restoreSectionEditorSelection();
    if (!surface || !restoredRange) return;
    const currentListItem = findSectionEditorListItemElement(restoredRange.startContainer, surface);
    if (currentListItem) {
      document.execCommand(delta > 0 ? "indent" : "outdent", false);
      syncSectionEditorContentFromDom();
      return;
    }
    const targetBlocks = resolveSelectedSectionEditorFormattableBlocks(restoredRange, surface);
    if (targetBlocks.length === 0) return;
    let nextActiveIndentPx = 0;
    targetBlocks.forEach((block, index) => {
      const nextIndentPx = clampSectionEditorIndentPx(resolveSectionEditorBlockIndentPx(block, surface) + delta);
      applySectionEditorBlockFirstLineIndent(block, nextIndentPx);
      if (index === 0) {
        nextActiveIndentPx = nextIndentPx;
      }
    });
    setSectionEditorCurrentIndentPx(nextActiveIndentPx);
    syncSectionEditorContentFromDom();
  };

  const applySectionEditorLineSpacing = (nextLineSpacing: SectionEditorLineSpacingValue) => {
    if (!sectionEditorWritable) return;
    setSectionEditorLineSpacingMenuOpen(false);
    if (sectionEditorFormattingTargetRef.current === "label") {
      setSectionEditorCurrentLineSpacing("default");
      return;
    }
    const headingLevel = resolveSectionEditorHeadingLevel(sectionEditorCurrentStyle);
    if (headingLevel !== null) {
      setSectionEditorCurrentLineSpacing(nextLineSpacing);
      updateSectionEditorHeadingStyleDefaults(headingLevel, { lineSpacing: nextLineSpacing });
      clearSectionEditorSelectedHeadingOverrides(headingLevel);
      return;
    }
    updateSectionEditorFormattingDefaults({ lineSpacing: nextLineSpacing });
    const selectedImage = getSelectedSectionEditorImageElement();
    const surface = sectionEditorSurfaceRef.current;
    if (selectedImage && surface) {
      const blockElement = findSectionEditorBlockElement(selectedImage, surface) ?? selectedImage.parentElement;
      if (blockElement instanceof HTMLElement) {
        if (nextLineSpacing === "default") {
          blockElement.style.removeProperty("line-height");
        } else {
          blockElement.style.lineHeight = nextLineSpacing;
        }
        setSectionEditorCurrentLineSpacing(nextLineSpacing);
        syncSectionEditorContentFromDom();
        return;
      }
    }

    focusSectionEditorSurface();
    const restoredRange = restoreSectionEditorSelection();
    if (!surface || !restoredRange) return;
    const targetBlocks = resolveSelectedSectionEditorFormattableBlocks(restoredRange, surface);
    if (targetBlocks.length === 0) return;
    targetBlocks.forEach((block) => {
      if (nextLineSpacing === "default") {
        block.style.removeProperty("line-height");
      } else {
        block.style.lineHeight = nextLineSpacing;
      }
    });
    setSectionEditorCurrentLineSpacing(nextLineSpacing);
    syncSectionEditorContentFromDom();
  };

  const commitSectionEditorLineSpacingInput = () => {
    const normalized = normalizeSectionEditorLineSpacingValue(sectionEditorLineSpacingInput);
    if (!normalized) {
      setSectionEditorLineSpacingInput(getSectionEditorLineSpacingDisplayValue(sectionEditorCurrentLineSpacing));
      return;
    }
    applySectionEditorLineSpacing(normalized);
    setSectionEditorLineSpacingInput(getSectionEditorLineSpacingDisplayValue(normalized));
  };

  const commitSectionEditorFontSizeInput = () => {
    const normalizedFontSizePt = parseSectionEditorFontSizePt(sectionEditorFontSizeInput);
    if (normalizedFontSizePt === null) {
      setSectionEditorFontSizeInput(`${clampSectionEditorFontSizePt(sectionEditorCurrentFontSizePt)}`);
      return;
    }
    applySectionEditorFontSize(normalizedFontSizePt);
  };

  const normalizeSectionEditorSurfaceStructure = (surface: HTMLElement) => {
    normalizeSectionEditorInlineTypography(surface);
    const childNodes = Array.from(surface.childNodes);
    let inlineBuffer: ChildNode[] = [];

    const flushInlineBuffer = (beforeNode: ChildNode | null) => {
      if (inlineBuffer.length === 0) return;
      const paragraph = document.createElement("p");
      inlineBuffer.forEach((node) => paragraph.appendChild(node));
      if (!normalizeProcedureEditorText(paragraph.textContent ?? "").trim() && !paragraph.querySelector("br, img")) {
        paragraph.appendChild(document.createElement("br"));
      }
      surface.insertBefore(paragraph, beforeNode);
      inlineBuffer = [];
    };

    for (const child of childNodes) {
      if (!child.parentNode || child.parentNode !== surface) continue;
      if (child.nodeType === Node.TEXT_NODE) {
        const textNode = child as Text;
        if (!normalizeProcedureEditorText(textNode.textContent ?? "").trim()) {
          textNode.remove();
          continue;
        }
        inlineBuffer.push(textNode);
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.parentNode?.removeChild(child);
        continue;
      }

      const element = child as HTMLElement;
      if (isProcedureEditorIgnoredElement(element)) {
        element.remove();
        continue;
      }

      const tagName = element.tagName.toLowerCase();
      if (tagName === "br") {
        inlineBuffer.push(element);
        continue;
      }

      if (!isProcedureEditorBlockTag(tagName)) {
        inlineBuffer.push(element);
        continue;
      }

      flushInlineBuffer(element);

      if (tagName === "div" && !element.dataset.insightDomain) {
        const paragraph = document.createElement("p");
        while (element.firstChild) {
          paragraph.appendChild(element.firstChild);
        }
        if (!normalizeProcedureEditorText(paragraph.textContent ?? "").trim() && !paragraph.querySelector("br, img")) {
          paragraph.appendChild(document.createElement("br"));
        }
        surface.insertBefore(paragraph, element);
        element.remove();
        continue;
      }

      if (
        (
          tagName === "p" ||
          tagName === "h1" ||
          tagName === "h2" ||
          tagName === "h3" ||
          tagName === "h4" ||
          tagName === "h5" ||
          tagName === "h6"
        ) &&
        !normalizeProcedureEditorText(element.textContent ?? "").trim() &&
        !element.querySelector("br, img")
      ) {
        element.appendChild(document.createElement("br"));
      }
    }

    flushInlineBuffer(null);
    ensureSectionEditorSurfaceHasContent(surface);
    normalizeSectionEditorImages(surface);
  };

  const normalizeSectionEditorSurface = (preserveSelection = false) => {
    const surface = sectionEditorSurfaceRef.current;
    if (!surface) return;

    const selection = preserveSelection ? window.getSelection() : null;
    const activeRange =
      preserveSelection && selection && selection.rangeCount > 0 && surface.contains(selection.getRangeAt(0).commonAncestorContainer)
        ? selection.getRangeAt(0).cloneRange()
        : preserveSelection &&
            sectionEditorSelectionRef.current &&
            surface.contains(sectionEditorSelectionRef.current.commonAncestorContainer)
          ? sectionEditorSelectionRef.current.cloneRange()
          : null;

    normalizeSectionEditorSurfaceStructure(surface);

    if (!preserveSelection || !selection) return;

    selection.removeAllRanges();
    if (activeRange && surface.contains(activeRange.commonAncestorContainer)) {
      selection.addRange(activeRange);
      sectionEditorSelectionRef.current = activeRange.cloneRange();
      setSectionEditorCurrentStyle(resolveSectionEditorCurrentStyle(findSectionEditorBlockElement(activeRange.startContainer, surface)));
      setSectionEditorCurrentAlignment(
        resolveSectionEditorBlockAlignment(findSectionEditorTopLevelBlockElement(activeRange.startContainer, surface))
      );
      syncSectionEditorSelectionFormattingState(activeRange.startContainer, surface);
      return;
    }

    const fallbackRange = document.createRange();
    fallbackRange.selectNodeContents(surface);
    fallbackRange.collapse(false);
    selection.addRange(fallbackRange);
    sectionEditorSelectionRef.current = fallbackRange.cloneRange();
    setSectionEditorCurrentStyle(resolveSectionEditorCurrentStyle(findSectionEditorBlockElement(fallbackRange.startContainer, surface)));
    setSectionEditorCurrentAlignment(
      resolveSectionEditorBlockAlignment(findSectionEditorTopLevelBlockElement(fallbackRange.startContainer, surface))
    );
    syncSectionEditorSelectionFormattingState(fallbackRange.startContainer, surface);
  };

  const syncSectionEditorSelection = () => {
    const surface = sectionEditorSurfaceRef.current;
    const selection = window.getSelection();
    if (!surface || !selection || selection.rangeCount === 0) {
      setSectionEditorCurrentStyle("normal");
      setSectionEditorCurrentAlignment(sectionEditorDraft?.textAlignment ?? "left");
      setSectionEditorCurrentFontFamily(sectionEditorFormattingDefaults.fontFamily);
      setSectionEditorCurrentFontSizePt(sectionEditorFormattingDefaults.fontSizePt);
      setSectionEditorCurrentBold(sectionEditorFormattingDefaults.bold);
      setSectionEditorCurrentItalic(sectionEditorFormattingDefaults.italic);
      setSectionEditorCurrentLineSpacing(sectionEditorFormattingDefaults.lineSpacing);
      setSectionEditorCurrentListKind(null);
      setSectionEditorCurrentQuoteActive(false);
      setSectionEditorCurrentIndentPx(0);
      setSectionEditorActiveTableState(null);
      return;
    }
    const range = selection.getRangeAt(0);
    if (!surface.contains(range.commonAncestorContainer)) {
      setSectionEditorCurrentStyle("normal");
      setSectionEditorCurrentAlignment(sectionEditorDraft?.textAlignment ?? "left");
      setSectionEditorCurrentFontFamily(sectionEditorFormattingDefaults.fontFamily);
      setSectionEditorCurrentFontSizePt(sectionEditorFormattingDefaults.fontSizePt);
      setSectionEditorCurrentBold(sectionEditorFormattingDefaults.bold);
      setSectionEditorCurrentItalic(sectionEditorFormattingDefaults.italic);
      setSectionEditorCurrentLineSpacing(sectionEditorFormattingDefaults.lineSpacing);
      setSectionEditorCurrentListKind(null);
      setSectionEditorCurrentQuoteActive(false);
      setSectionEditorCurrentIndentPx(0);
      setSectionEditorActiveTableState(null);
      return;
    }
    sectionEditorSelectionRef.current = range.cloneRange();
    setSectionEditorCurrentStyle(resolveSectionEditorCurrentStyle(findSectionEditorBlockElement(range.startContainer, surface)));
    setSectionEditorCurrentAlignment(
      resolveSectionEditorBlockAlignment(findSectionEditorTopLevelBlockElement(range.startContainer, surface))
    );
    syncSectionEditorSelectionFormattingState(range.startContainer, surface);
  };

  const syncSectionEditorContentFromDom = (preserveSelection = true) => {
    const surface = sectionEditorSurfaceRef.current;
    if (!surface) return;
    normalizeSectionEditorSurface(preserveSelection);
    const nextSerialized = serializeProcedureEditorRichText(surface);
    setSectionEditorDraft((current) => {
      if (
        !current ||
        (current.content === nextSerialized.content && current.richTextHtml === nextSerialized.richTextHtml)
      ) {
        return current;
      }
      return {
        ...current,
        content: nextSerialized.content,
        richTextHtml: nextSerialized.richTextHtml
      };
    });
    syncSectionEditorSelection();
    syncSectionEditorSelectedImageOverlay();
  };

  const restoreSectionEditorSelection = () => {
    const surface = sectionEditorSurfaceRef.current;
    const savedRange = sectionEditorSelectionRef.current;
    if (!surface) return null;
    const selection = window.getSelection();
    if (!selection) return null;
    selection.removeAllRanges();
    if (savedRange && surface.contains(savedRange.commonAncestorContainer)) {
      selection.addRange(savedRange);
      return savedRange;
    }
    const fallbackRange = document.createRange();
    fallbackRange.selectNodeContents(surface);
    fallbackRange.collapse(false);
    selection.addRange(fallbackRange);
    sectionEditorSelectionRef.current = fallbackRange.cloneRange();
    return fallbackRange;
  };

  const focusSectionEditorSurface = () => {
    const surface = sectionEditorSurfaceRef.current;
    if (!surface) return;
    const viewport = sectionEditorDocumentViewportRef.current;
    const previousScrollTop = viewport?.scrollTop ?? null;
    const previousScrollLeft = viewport?.scrollLeft ?? null;
    try {
      surface.focus({ preventScroll: true });
    } catch {
      surface.focus();
    }
    if (viewport && previousScrollTop !== null && previousScrollLeft !== null) {
      viewport.scrollTop = previousScrollTop;
      viewport.scrollLeft = previousScrollLeft;
    }
  };

  const preserveSectionEditorSelection = (event?: ReactMouseEvent<HTMLElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (sectionEditorFormattingTargetRef.current === "label") {
      syncSectionEditorTitleFormattingState();
      return;
    }
    syncSectionEditorSelection();
  };

  const preserveSectionEditorPanelFocus = (event?: ReactMouseEvent<HTMLElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    setSectionEditorFocusTarget("panel");
  };

  const preserveSectionEditorColorPickerSelection = (event?: ReactMouseEvent<HTMLElement>) => {
    preserveSectionEditorSelection(event);
    setSectionEditorFocusTarget("panel");
  };

  const findSectionEditorBlockElement = (node: Node | null, surface: HTMLElement): HTMLElement | null => {
    let current: Node | null = node;
    while (current && current !== surface) {
      if (
        current instanceof HTMLElement &&
        (current.tagName === "H1" ||
          current.tagName === "H2" ||
          current.tagName === "H3" ||
          current.tagName === "H4" ||
          current.tagName === "H5" ||
          current.tagName === "H6" ||
          current.tagName === "P" ||
          current.tagName === "BLOCKQUOTE")
      ) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  };

  const findSectionEditorExitBlockElement = (node: Node | null, surface: HTMLElement): HTMLElement | null => {
    let current: Node | null = node;
    while (current && current !== surface) {
      if (
        current instanceof HTMLElement &&
        ["H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "PRE"].includes(current.tagName.toUpperCase())
      ) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  };

  const isSectionEditorRangeAtBlockEnd = (range: Range, block: HTMLElement): boolean => {
    const blockEndRange = document.createRange();
    blockEndRange.selectNodeContents(block);
    blockEndRange.collapse(false);
    return range.compareBoundaryPoints(Range.END_TO_END, blockEndRange) === 0;
  };

  const applySectionEditorHistoryStep = (direction: "undo" | "redo") => {
    const currentDraft = sectionEditorDraft;
    if (!currentDraft) return false;

    const currentSnapshot = sectionEditorHistoryCurrentRef.current ?? buildSectionEditorHistorySnapshot(currentDraft);
    if (direction === "undo") {
      const nextSnapshot = sectionEditorUndoStackRef.current.pop();
      if (!nextSnapshot) return false;
      sectionEditorRedoStackRef.current = [...sectionEditorRedoStackRef.current, currentSnapshot].slice(
        -SECTION_EDITOR_HISTORY_LIMIT
      );
      sectionEditorHistoryApplyingRef.current = true;
      setSectionEditorDraft((current) =>
        current ? applySectionEditorHistorySnapshot(current, nextSnapshot) : current
      );
    } else {
      const nextSnapshot = sectionEditorRedoStackRef.current.pop();
      if (!nextSnapshot) return false;
      sectionEditorUndoStackRef.current = [...sectionEditorUndoStackRef.current, currentSnapshot].slice(
        -SECTION_EDITOR_HISTORY_LIMIT
      );
      sectionEditorHistoryApplyingRef.current = true;
      setSectionEditorDraft((current) =>
        current ? applySectionEditorHistorySnapshot(current, nextSnapshot) : current
      );
    }

    syncSectionEditorHistoryAvailability();

    setSectionEditorStyleMenuOpen(false);
    setSectionEditorColorPickerOpen(false);
    setSectionNumberingPanelOpen(false);
    setSectionEditorTableMenuOpen(false);
    return true;
  };

  const sectionEditorHasExpandedSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      return !selection.getRangeAt(0).collapsed;
    }
    return Boolean(sectionEditorSelectionRef.current && !sectionEditorSelectionRef.current.collapsed);
  };

  const handleSectionEditorKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.nativeEvent.isComposing) {
      const normalizedKey = event.key.toLowerCase();
      if (event.shiftKey && normalizedKey === "v") {
        event.preventDefault();
        void pasteSectionEditorContentClipboard({ plainTextOnly: true });
        return;
      }
      if (normalizedKey === "z") {
        event.preventDefault();
        applySectionEditorHistoryStep(event.shiftKey ? "redo" : "undo");
        return;
      }
      if (normalizedKey === "y") {
        event.preventDefault();
        applySectionEditorHistoryStep("redo");
        return;
      }
    }

    if (handleSectionEditorAlignmentShortcut(event)) {
      return;
    }

    if (
      sectionEditorSelectedImageId &&
      (event.key === "Backspace" || event.key === "Delete") &&
      !event.shiftKey &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      if (removeSelectedSectionEditorImage()) {
        return;
      }
    }

    if (event.key === "Tab" && !event.altKey && !event.ctrlKey && !event.metaKey && !event.nativeEvent.isComposing) {
      const surface = sectionEditorSurfaceRef.current;
      const selection = window.getSelection();
      if (!surface || !selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      if (!surface.contains(range.commonAncestorContainer)) return;
      if (findSectionEditorTableCellElement(range.startContainer, surface)) {
        event.preventDefault();
        moveSectionEditorTableSelection(event.shiftKey ? -1 : 1);
        return;
      }
      if (findSectionEditorListItemElement(range.startContainer, surface)) {
        event.preventDefault();
        applySectionEditorBlockIndentDelta(event.shiftKey ? -SECTION_EDITOR_INDENT_STEP_PX : SECTION_EDITOR_INDENT_STEP_PX);
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey && !event.nativeEvent.isComposing) {
      const surface = sectionEditorSurfaceRef.current;
      const selection = window.getSelection();
      if (surface && selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (range.collapsed && surface.contains(range.commonAncestorContainer)) {
          const currentListItem = findSectionEditorListItemElement(range.startContainer, surface);
          if (currentListItem) {
            const listItemText = normalizeProcedureEditorText(currentListItem.textContent ?? "").trim();
            const hasEmbeddedContent = Boolean(currentListItem.querySelector("img, table, hr"));
            if (!listItemText && !hasEmbeddedContent) {
              event.preventDefault();
              document.execCommand("outdent", false);
              syncSectionEditorContentFromDom();
              return;
            }
          }
          const currentQuote = findSectionEditorQuoteElement(range.startContainer, surface);
          if (currentQuote) {
            const quoteText = normalizeProcedureEditorText(currentQuote.textContent ?? "").trim();
            const hasEmbeddedContent = Boolean(currentQuote.querySelector("img, table, hr"));
            if (!quoteText && !hasEmbeddedContent) {
              event.preventDefault();
              const paragraph = document.createElement("p");
              paragraph.appendChild(document.createElement("br"));
              applySectionEditorFormattingDefaultsToBlock(paragraph);
              currentQuote.parentNode?.insertBefore(paragraph, currentQuote.nextSibling);
              currentQuote.remove();
              const nextRange = document.createRange();
              nextRange.setStart(paragraph, 0);
              nextRange.collapse(true);
              selection.removeAllRanges();
              selection.addRange(nextRange);
              sectionEditorSelectionRef.current = nextRange.cloneRange();
              syncSectionEditorContentFromDom();
              return;
            }
          }
        }
      }
    }

    if (event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) {
      return;
    }
    const surface = sectionEditorSurfaceRef.current;
    const selection = window.getSelection();
    if (!surface || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!range.collapsed || !surface.contains(range.commonAncestorContainer)) return;
    const block = findSectionEditorExitBlockElement(range.startContainer, surface);
    if (!block || !isSectionEditorRangeAtBlockEnd(range, block)) {
      return;
    }
    if (block.tagName.toUpperCase() === "BLOCKQUOTE") {
      return;
    }

    event.preventDefault();
    const paragraph = document.createElement("p");
    const breakNode = document.createElement("br");
    paragraph.appendChild(breakNode);
    applySectionEditorFormattingDefaultsToBlock(paragraph);
    block.parentNode?.insertBefore(paragraph, block.nextSibling);

    const nextRange = document.createRange();
    nextRange.setStart(paragraph, 0);
    nextRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    sectionEditorSelectionRef.current = nextRange.cloneRange();
    syncSectionEditorContentFromDom();
  };

  const applySectionEditorCommand = (command: string, value?: string) => {
    if (command === "undo" || command === "redo") {
      applySectionEditorHistoryStep(command);
      return;
    }
    if (sectionEditorFormattingTargetRef.current === "label") {
      if (command === "bold") {
        const nextBold = !sectionEditorEffectiveTitleStyle.bold;
        setSectionEditorCurrentBold(nextBold);
        updateSectionEditorTitleDefaults({ bold: nextBold });
        updateSectionEditorTitleStyle({ bold: nextBold });
        setSectionEditorStyleMenuOpen(false);
        return;
      } else if (command === "italic") {
        const nextItalic = !sectionEditorEffectiveTitleStyle.italic;
        setSectionEditorCurrentItalic(nextItalic);
        updateSectionEditorTitleDefaults({ italic: nextItalic });
        updateSectionEditorTitleStyle({ italic: nextItalic });
        setSectionEditorStyleMenuOpen(false);
        return;
      }
      return;
    }
    const headingLevel = resolveSectionEditorHeadingLevel(sectionEditorCurrentStyle);
    const hasExpandedSelection = sectionEditorHasExpandedSelection();
    const executesWithCollapsedSelection =
      command === "insertUnorderedList" || command === "insertOrderedList" || command === "formatBlock" || command === "insertHorizontalRule";
    if (headingLevel !== null) {
      if (command === "bold") {
        const nextBold = !sectionEditorCurrentBold;
        setSectionEditorCurrentBold(nextBold);
        updateSectionEditorHeadingStyleDefaults(headingLevel, { bold: nextBold });
      } else if (command === "italic") {
        const nextItalic = !sectionEditorCurrentItalic;
        setSectionEditorCurrentItalic(nextItalic);
        updateSectionEditorHeadingStyleDefaults(headingLevel, { italic: nextItalic });
      }
      clearSectionEditorSelectedHeadingOverrides(headingLevel);
      setSectionEditorStyleMenuOpen(false);
      return;
    }
    focusSectionEditorSurface();
    restoreSectionEditorSelection();
    if (hasExpandedSelection || executesWithCollapsedSelection) {
      document.execCommand(command, false, value);
    }
    if (command === "bold") {
      const nextBold = !sectionEditorCurrentBold;
      setSectionEditorCurrentBold(nextBold);
      updateSectionEditorFormattingDefaults({ bold: nextBold });
    } else if (command === "italic") {
      const nextItalic = !sectionEditorCurrentItalic;
      setSectionEditorCurrentItalic(nextItalic);
      updateSectionEditorFormattingDefaults({ italic: nextItalic });
    }
    if (hasExpandedSelection || executesWithCollapsedSelection) {
      syncSectionEditorContentFromDom();
    }
    setSectionEditorStyleMenuOpen(false);
  };

  const applySectionEditorBlockStyle = (nextStyle: SectionEditorBlockStyle) => {
    if (!sectionEditorWritable) return;
    if (sectionEditorFormattingTargetRef.current === "label") {
      setSectionEditorCurrentStyle("normal");
      setSectionEditorStyleMenuOpen(false);
      return;
    }
    const option = SECTION_EDITOR_STYLE_OPTIONS.find((entry) => entry.value === nextStyle);
    if (!option) return;
    setSectionEditorCurrentStyle(nextStyle);
    focusSectionEditorSurface();
    restoreSectionEditorSelection();
    document.execCommand("formatBlock", false, option.blockTag);
    syncSectionEditorContentFromDom();
    setSectionEditorStyleMenuOpen(false);
  };

  const applySectionEditorTextColor = (
    nextColor: string,
    options?: {
      keepPickerOpen?: boolean;
    }
  ) => {
    if (!sectionEditorWritable) return;
    const normalizedColor = resolveSectionEditorColorHex(nextColor) ?? nextColor;
    setSectionEditorTextColor(normalizedColor);
    setSectionEditorRecentTextColors((current) => mergeSectionEditorRecentTextColors(current, normalizedColor));
    if (sectionEditorFormattingTargetRef.current === "label") {
      updateSectionEditorTitleDefaults({ textColor: normalizedColor });
      updateSectionEditorTitleStyle({ color: normalizedColor });
      setSectionEditorStyleMenuOpen(false);
      setSectionEditorColorPickerOpen(Boolean(options?.keepPickerOpen));
      return;
    }
    const headingLevel = resolveSectionEditorHeadingLevel(sectionEditorCurrentStyle);
    const hasExpandedSelection = sectionEditorHasExpandedSelection();
    if (headingLevel !== null) {
      updateSectionEditorHeadingStyleDefaults(headingLevel, { textColor: normalizedColor });
      clearSectionEditorSelectedHeadingOverrides(headingLevel);
      setSectionEditorStyleMenuOpen(false);
      setSectionEditorColorPickerOpen(Boolean(options?.keepPickerOpen));
      return;
    }
    updateSectionEditorFormattingDefaults({ textColor: normalizedColor });
    if (hasExpandedSelection) {
      focusSectionEditorSurface();
      restoreSectionEditorSelection();
      document.execCommand("styleWithCSS", false, "true");
      document.execCommand("foreColor", false, normalizedColor);
      syncSectionEditorContentFromDom();
    }
    setSectionEditorStyleMenuOpen(false);
    setSectionEditorColorPickerOpen(Boolean(options?.keepPickerOpen));
  };

  const applySectionEditorCustomColorHex = () => {
    const normalizedColor = resolveSectionEditorColorHex(sectionEditorCustomColorState.hex);
    if (!normalizedColor) {
      setSectionEditorCustomColorState(buildSectionEditorCustomColorState(sectionEditorTextColor));
      return;
    }
    setSectionEditorCustomColorState(buildSectionEditorCustomColorState(normalizedColor));
    applySectionEditorTextColor(normalizedColor, { keepPickerOpen: true });
  };

  const applySectionEditorCustomColorRgb = () => {
    const red = parseSectionEditorColorChannelInput(sectionEditorCustomColorState.red);
    const green = parseSectionEditorColorChannelInput(sectionEditorCustomColorState.green);
    const blue = parseSectionEditorColorChannelInput(sectionEditorCustomColorState.blue);
    if (red === null || green === null || blue === null) {
      setSectionEditorCustomColorState(buildSectionEditorCustomColorState(sectionEditorTextColor));
      return;
    }
    const normalizedColor = buildSectionEditorColorHexFromChannels(red, green, blue);
    setSectionEditorCustomColorState(buildSectionEditorCustomColorState(normalizedColor));
    applySectionEditorTextColor(normalizedColor, { keepPickerOpen: true });
  };

  const setSectionEditorCurrentTextColorAsDefault = () => {
    const normalizedColor = resolveSectionEditorColorHex(sectionEditorTextColor) ?? sectionEditorTextColor;
    if (sectionEditorFormattingTargetRef.current === "label") {
      updateSectionEditorTitleDefaults({ textColor: normalizedColor });
      return;
    }
    const headingLevel = resolveSectionEditorHeadingLevel(sectionEditorCurrentStyle);
    if (headingLevel !== null) {
      updateSectionEditorHeadingStyleDefaults(headingLevel, { textColor: normalizedColor });
      clearSectionEditorSelectedHeadingOverrides(headingLevel);
      return;
    }
    updateSectionEditorFormattingDefaults({ textColor: normalizedColor });
  };

  const setSectionEditorNumberingHidden = (hidden: boolean) => {
    setSectionEditorDraft((current) => (current ? { ...current, numberingHidden: hidden } : current));
  };

  const setSectionEditorNumberingRestartEnabled = (enabled: boolean) => {
    setSectionEditorDraft((current) =>
      current
        ? {
            ...current,
            numberingStartAt: enabled ? current.numberingStartAt ?? 1 : null
          }
        : current
    );
  };

  const setSectionEditorNumberingStartAt = (value: string) => {
    const normalizedValue = normalizeSectionEditorNumberStartAtValue(value) ?? 1;
    setSectionEditorDraft((current) =>
      current
        ? {
            ...current,
            numberingStartAt: normalizedValue
          }
        : current
    );
  };

  const applySectionEditorFontFamily = (nextFontFamily: string) => {
    if (!sectionEditorWritable) return;
    const normalizedFontFamily = normalizeSectionEditorFontFamilyName(nextFontFamily);
    if (!normalizedFontFamily) return;
    setSectionEditorCurrentFontFamily(normalizedFontFamily);
    setSectionEditorFontQuery("");
    setSectionEditorFontMenuOpen(false);
    if (sectionEditorFormattingTargetRef.current === "label") {
      updateSectionEditorTitleDefaults({ fontFamily: normalizedFontFamily });
      updateSectionEditorTitleStyle({ fontFamily: normalizedFontFamily });
      setSectionEditorStyleMenuOpen(false);
      return;
    }
    const headingLevel = resolveSectionEditorHeadingLevel(sectionEditorCurrentStyle);
    const hasExpandedSelection = sectionEditorHasExpandedSelection();
    if (headingLevel !== null) {
      updateSectionEditorHeadingStyleDefaults(headingLevel, { fontFamily: normalizedFontFamily });
      clearSectionEditorSelectedHeadingOverrides(headingLevel);
      setSectionEditorStyleMenuOpen(false);
      return;
    }
    updateSectionEditorFormattingDefaults({ fontFamily: normalizedFontFamily });
    if (hasExpandedSelection) {
      focusSectionEditorSurface();
      restoreSectionEditorSelection();
      document.execCommand("styleWithCSS", false, "true");
      document.execCommand("fontName", false, normalizedFontFamily);
      syncSectionEditorContentFromDom();
    }
    setSectionEditorStyleMenuOpen(false);
  };

  const applySectionEditorFontSize = (nextFontSizePt: number) => {
    if (!sectionEditorWritable) return;
    const normalizedFontSizePt = clampSectionEditorFontSizePt(nextFontSizePt);
    setSectionEditorCurrentFontSizePt(normalizedFontSizePt);
    setSectionEditorFontSizeInput(`${normalizedFontSizePt}`);
    setSectionEditorFontSizeMenuOpen(false);
    if (sectionEditorFormattingTargetRef.current === "label") {
      updateSectionEditorTitleDefaults({ fontSizePt: normalizedFontSizePt });
      updateSectionEditorTitleStyle({ fontSizePt: normalizedFontSizePt });
      setSectionEditorStyleMenuOpen(false);
      return;
    }
    const headingLevel = resolveSectionEditorHeadingLevel(sectionEditorCurrentStyle);
    const hasExpandedSelection = sectionEditorHasExpandedSelection();
    if (headingLevel !== null) {
      updateSectionEditorHeadingStyleDefaults(headingLevel, { fontSizePt: normalizedFontSizePt });
      clearSectionEditorSelectedHeadingOverrides(headingLevel);
      setSectionEditorStyleMenuOpen(false);
      return;
    }
    updateSectionEditorFormattingDefaults({ fontSizePt: normalizedFontSizePt });
    if (hasExpandedSelection) {
      sectionEditorPendingFontSizePtRef.current = normalizedFontSizePt;
      focusSectionEditorSurface();
      restoreSectionEditorSelection();
      document.execCommand("styleWithCSS", false, "true");
      document.execCommand("fontSize", false, "7");
      syncSectionEditorContentFromDom();
    }
    setSectionEditorStyleMenuOpen(false);
  };

  const insertSectionEditorHtml = (html: string) => {
    if (!html.trim()) return;
    focusSectionEditorSurface();
    restoreSectionEditorSelection();
    document.execCommand("insertHTML", false, html);
    syncSectionEditorContentFromDom();
  };

  const insertSectionEditorTable = (
    requestedRows = sectionEditorInsertTableRows,
    requestedColumns = sectionEditorInsertTableColumns
  ) => {
    if (!sectionEditorWritable) return;
    if (sectionEditorFormattingTargetRef.current === "label") {
      activateSectionEditorContentTarget();
    }
    const markerId = `ode-table-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    focusSectionEditorSurface();
    const selection = window.getSelection();
    const restoredRange = restoreSectionEditorInsertRange() ?? restoreSectionEditorSelection();
    if (selection && restoredRange) {
      selection.removeAllRanges();
      selection.addRange(restoredRange);
      sectionEditorSelectionRef.current = restoredRange.cloneRange();
    }
    document.execCommand("insertHTML", false, buildProcedureEditorTableHtml(requestedRows, requestedColumns, markerId));
    const insertedTable = sectionEditorSurfaceRef.current?.querySelector(
      `table[data-ode-editor-table-id="${markerId}"]`
    ) as HTMLTableElement | null;
    const focusCell = insertedTable?.querySelector("td, th") as HTMLTableCellElement | null;
    insertedTable?.removeAttribute("data-ode-editor-table-id");
    if (focusCell) {
      focusSectionEditorNodeContents(focusCell);
    }
    syncSectionEditorContentFromDom();
    clearSectionEditorInsertRange();
    setSectionEditorTableMenuOpen(false);
  };

  const insertSectionEditorStructuralRule = (type: "divider" | "page-break") => {
    if (
      !sectionEditorWritable ||
      sectionEditorFormattingTargetRef.current === "label" ||
      sectionEditorSelectedImageId
    ) {
      return;
    }
    focusSectionEditorSurface();
    const surface = sectionEditorSurfaceRef.current;
    const selection = window.getSelection();
    const range = restoreSectionEditorSelection();
    if (!surface || !selection || !range) return;

    const listContainer = findSectionEditorListContainerElement(range.startContainer, surface);
    const quoteElement = listContainer ? null : findSectionEditorQuoteElement(range.startContainer, surface);
    const currentBlock =
      listContainer || quoteElement
        ? null
        : findSectionEditorBlockElement(range.startContainer, surface);
    const anchor =
      listContainer ??
      quoteElement ??
      currentBlock ??
      (range.startContainer instanceof HTMLElement ? range.startContainer : range.startContainer.parentElement);

    const divider = document.createElement("hr");
    if (type === "page-break") {
      divider.setAttribute("data-ode-page-break", "true");
    }
    const trailingParagraph = document.createElement("p");
    trailingParagraph.appendChild(document.createElement("br"));
    applySectionEditorFormattingDefaultsToBlock(trailingParagraph);

    if (anchor?.parentNode) {
      anchor.parentNode.insertBefore(divider, anchor.nextSibling);
      divider.parentNode?.insertBefore(trailingParagraph, divider.nextSibling);
    } else {
      range.deleteContents();
      range.insertNode(trailingParagraph);
      range.insertNode(divider);
    }

    const nextRange = document.createRange();
    nextRange.setStart(trailingParagraph, 0);
    nextRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    sectionEditorSelectionRef.current = nextRange.cloneRange();
    syncSectionEditorContentFromDom();
    revealSectionEditorElement(trailingParagraph);
  };

  const insertSectionEditorPageBreak = () => {
    insertSectionEditorStructuralRule("page-break");
  };

  const insertSectionEditorDivider = () => {
    insertSectionEditorStructuralRule("divider");
  };

  const insertSectionEditorElement = (element: HTMLElement, explicitRange?: Range | null) => {
    focusSectionEditorSurface();
    const range = explicitRange ?? restoreSectionEditorSelection();
    const selection = window.getSelection();
    if (!selection || !range) return;
    selection.removeAllRanges();
    selection.addRange(range);
    range.deleteContents();
    range.insertNode(element);
    const nextRange = document.createRange();
    nextRange.setStartAfter(element);
    nextRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    sectionEditorSelectionRef.current = nextRange.cloneRange();
    syncSectionEditorContentFromDom();
  };

  const handleSectionEditorPaste = (event: ReactClipboardEvent<HTMLDivElement>) => {
    const html = event.clipboardData.getData("text/html");
    const plainText = event.clipboardData.getData("text/plain");
    const sanitizedHtml = html ? sanitizeProcedureRichTextHtml(html) : "";
    if (sanitizedHtml) {
      event.preventDefault();
      insertSectionEditorHtml(sanitizedHtml);
      return;
    }
    const nextContent = normalizeProcedurePastedPlainText(plainText);
    if (!nextContent) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    insertSectionEditorHtml(procedureTextToEditorHtml(nextContent, globalNodeById, imagePreviewSrcByNodeId));
  };

  const insertSectionEditorPhotoElement = (image: HTMLImageElement) => {
    focusSectionEditorSurface();
    const surface = sectionEditorSurfaceRef.current;
    const range = restoreSectionEditorSelection();
    const selection = window.getSelection();
    if (!surface || !selection || !range) return;

    const imageParagraph = document.createElement("p");
    imageParagraph.appendChild(image);
    const trailingParagraph = document.createElement("p");
    trailingParagraph.appendChild(document.createElement("br"));
    const currentBlock = findSectionEditorBlockElement(range.startContainer, surface);

    if (currentBlock?.parentNode) {
      currentBlock.parentNode.insertBefore(imageParagraph, currentBlock.nextSibling);
      imageParagraph.parentNode?.insertBefore(trailingParagraph, imageParagraph.nextSibling);
    } else {
      range.deleteContents();
      range.insertNode(imageParagraph);
      imageParagraph.parentNode?.insertBefore(trailingParagraph, imageParagraph.nextSibling);
    }

    const nextRange = document.createRange();
    nextRange.setStart(trailingParagraph, 0);
    nextRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    sectionEditorSelectionRef.current = nextRange.cloneRange();
    syncSectionEditorContentFromDom();
  };

  const buildSectionEditorLinkElement = (
    label: string,
    href: string,
    linkType: "node" | "website" | "app",
    extraAttributes?: Record<string, string>
  ) => {
    const anchor = document.createElement("a");
    anchor.textContent = label;
    anchor.setAttribute("href", href);
    anchor.setAttribute("data-ode-link-type", linkType);
    anchor.setAttribute("style", linkType === "app" ? buildProcedureEditorAppLinkStyle() : buildProcedureEditorLinkStyle());
    if (linkType === "website") {
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noreferrer");
    }
    if (extraAttributes) {
      for (const [key, value] of Object.entries(extraAttributes)) {
        anchor.setAttribute(key, value);
      }
    }
    return anchor;
  };

  const buildSectionEditorImageElement = async (node: AppNode) => {
    const previewSrc = await ensureProcedureImagePreviewSrc(node);
    if (!previewSrc) return null;
    const image = document.createElement("img");
    const alt = getProcedureFileDisplayTitle(node.name) || "Image";
    image.setAttribute("src", previewSrc);
    image.setAttribute("alt", alt);
    image.setAttribute("data-ode-link-type", "image");
    image.setAttribute("data-node-id", node.id);
    image.setAttribute("data-image-alt", alt);
    image.setAttribute("contenteditable", "false");
    image.setAttribute("draggable", "false");
    image.setAttribute("width", "320");
    image.setAttribute("style", buildProcedureEditorImageStyle());
    return image;
  };

  const resolveSectionAppLinkIconDataUrl = async (item: NodeQuickAppItem) => {
    const explicitIcon = item.customIconDataUrl?.trim() || null;
    if (explicitIcon) return explicitIcon;
    if (item.kind !== "local_path" || item.iconKey !== "auto") return null;
    const fileName = getQuickAppTargetLeafName(item.target) || item.label || "app";
    return await resolveWindowsFileIcon(item.target, fileName, 32);
  };

  const buildSectionEditorAppLinkElement = async (candidate: ProcedureAppLinkCandidate) => {
    const label = candidate.item.label.trim() || "App";
    const resolvedCustomIconDataUrl =
      (await resolveSectionAppLinkIconDataUrl(candidate.item)) ?? candidate.item.customIconDataUrl ?? null;
    const href = encodeProcedureAppLinkPayload({
      appId: candidate.item.id,
      appName: candidate.item.label,
      kind: candidate.item.kind,
      target: candidate.item.target,
      iconKey: candidate.item.iconKey,
      customIconDataUrl: resolvedCustomIconDataUrl,
      sourceNodeId: candidate.sourceNode.id,
      sourceNodeName: getNodeDisplayName(candidate.sourceNode),
      workspaceName: candidate.workspaceName
    });
    const anchor = buildSectionEditorLinkElement(label, href, "app", {
      "data-link-label": label,
      title: label
    });
    anchor.setAttribute("contenteditable", "false");
    anchor.setAttribute("draggable", "false");
    anchor.textContent = "";
    anchor.appendChild(
      document
        .createRange()
        .createContextualFragment(
          buildProcedureAppLinkBadgeHtml({
            label,
            kind: candidate.item.kind,
            target: candidate.item.target,
            iconKey: candidate.item.iconKey,
            customIconDataUrl: resolvedCustomIconDataUrl
          })
        )
    );
    return anchor;
  };

  const getSectionEditorTextFromRange = (range: Range | null) => {
    if (!range) return "";
    return normalizeProcedureEditorText(range.cloneContents().textContent ?? "").trim();
  };

  const getSectionEditorSelectedText = () => getSectionEditorTextFromRange(sectionEditorSelectionRef.current);

  const closeSectionEditorContextMenu = () => {
    setSectionEditorContextMenu(null);
  };

  const closeSectionEditorFloatingMenus = () => {
    setSectionEditorContextMenu(null);
    setSectionEditorStyleMenuOpen(false);
    setSectionEditorColorPickerOpen(false);
    setSectionEditorCustomColorPanelOpen(false);
    setSectionEditorTableMenuOpen(false);
    setSectionEditorLineSpacingMenuOpen(false);
    setSectionEditorFontMenuOpen(false);
    setSectionEditorFontSizeMenuOpen(false);
    setSectionNumberingPanelOpen(false);
    setSectionNodeLinkPickerOpen(false);
    setSectionAppPickerOpen(false);
  };

  const resolveSectionEditorRangeFromPoint = (clientX: number, clientY: number): Range | null => {
    const documentWithCaretApi = document as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
      caretPositionFromPoint?: (x: number, y: number) => CaretPosition | null;
    };
    if (documentWithCaretApi.caretRangeFromPoint) {
      return documentWithCaretApi.caretRangeFromPoint(clientX, clientY);
    }
    if (documentWithCaretApi.caretPositionFromPoint) {
      const caretPosition = documentWithCaretApi.caretPositionFromPoint(clientX, clientY);
      if (!caretPosition) return null;
      const range = document.createRange();
      range.setStart(caretPosition.offsetNode, caretPosition.offset);
      range.collapse(true);
      return range;
    }
    return null;
  };

  const placeSectionEditorSelectionFromPoint = (
    clientX: number,
    clientY: number,
    eventTarget: EventTarget | null
  ): Range | null => {
    const surface = sectionEditorSurfaceRef.current;
    const selection = window.getSelection();
    if (!surface || !selection) return null;

    const activeRange = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const clickedNode = eventTarget instanceof Node ? eventTarget : null;
    const clickedWithinSelection =
      activeRange &&
      !activeRange.collapsed &&
      clickedNode &&
      surface.contains(clickedNode) &&
      (() => {
        try {
          return activeRange.intersectsNode(clickedNode);
        } catch {
          return false;
        }
      })();

    const nextRange =
      clickedWithinSelection && activeRange && surface.contains(activeRange.commonAncestorContainer)
        ? activeRange
        : resolveSectionEditorRangeFromPoint(clientX, clientY);

    if (nextRange && surface.contains(nextRange.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(nextRange);
      sectionEditorSelectionRef.current = nextRange.cloneRange();
      syncSectionEditorSelectionFormattingState(nextRange.startContainer, surface);
      return nextRange;
    }

    const restoredRange = restoreSectionEditorSelection();
    if (restoredRange && surface.contains(restoredRange.commonAncestorContainer)) {
      syncSectionEditorSelectionFormattingState(restoredRange.startContainer, surface);
    }
    return restoredRange;
  };

  const findSectionEditorLinkElement = (node: Node | null, surface: HTMLElement): HTMLAnchorElement | null => {
    let current: Node | null = node;
    while (current && current !== surface) {
      if (current instanceof HTMLAnchorElement && Boolean(current.dataset.odeLinkType)) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  };

  const unwrapSectionEditorLink = (link: HTMLAnchorElement) => {
    const fragment = document.createDocumentFragment();
    while (link.firstChild) {
      fragment.appendChild(link.firstChild);
    }
    link.replaceWith(fragment);
  };

  const restoreSectionEditorContextMenuTitleSelection = (
    menuState: SectionEditorContextMenuState | null = sectionEditorContextMenuStateRef.current
  ) => {
    if (!menuState || menuState.target !== "label") return null;
    const input = sectionEditorTitleInputRef.current;
    if (!input) return null;
    try {
      input.focus({ preventScroll: true });
    } catch {
      input.focus();
    }
    const selectionStart = Math.max(0, Math.min(menuState.selectionStart, input.value.length));
    const selectionEnd = Math.max(selectionStart, Math.min(menuState.selectionEnd, input.value.length));
    input.setSelectionRange(selectionStart, selectionEnd);
    return {
      input,
      selectionStart,
      selectionEnd
    };
  };

  const restoreSectionEditorContextMenuContentSelection = (
    menuState: SectionEditorContextMenuState | null = sectionEditorContextMenuStateRef.current
  ) => {
    if (!menuState || menuState.target !== "content") {
      return restoreSectionEditorSelection();
    }
    focusSectionEditorSurface();
    const surface = sectionEditorSurfaceRef.current;
    const selection = window.getSelection();
    const restoredRange =
      restoreSerializedSectionEditorRange(menuState.selection) ??
      (sectionEditorSelectionRef.current ? sectionEditorSelectionRef.current.cloneRange() : null);
    if (!surface || !selection || !restoredRange || !surface.contains(restoredRange.commonAncestorContainer)) {
      return restoreSectionEditorSelection();
    }
    selection.removeAllRanges();
    selection.addRange(restoredRange);
    sectionEditorSelectionRef.current = restoredRange.cloneRange();
    syncSectionEditorSelectionFormattingState(restoredRange.startContainer, surface);
    return restoredRange;
  };

  const replaceSectionEditorTitleSelection = (
    text: string,
    menuState: SectionEditorContextMenuState | null = sectionEditorContextMenuStateRef.current
  ) => {
    if (!sectionEditorDraft) return false;
    const restoredSelection = restoreSectionEditorContextMenuTitleSelection(menuState);
    if (!restoredSelection) return false;
    const replacementText = normalizeSectionEditorTitleClipboardText(text);
    const nextLabel =
      sectionEditorDraft.label.slice(0, restoredSelection.selectionStart) +
      replacementText +
      sectionEditorDraft.label.slice(restoredSelection.selectionEnd);
    const nextCaretPosition = restoredSelection.selectionStart + replacementText.length;
    setSectionEditorDraft((current) => (current ? { ...current, label: nextLabel } : current));
    window.requestAnimationFrame(() => {
      const input = sectionEditorTitleInputRef.current;
      if (!input) return;
      try {
        input.focus({ preventScroll: true });
      } catch {
        input.focus();
      }
      input.setSelectionRange(nextCaretPosition, nextCaretPosition);
    });
    return true;
  };

  const copySectionEditorTitleSelection = async (
    menuState: SectionEditorContextMenuState | null = sectionEditorContextMenuStateRef.current
  ) => {
    if (!sectionEditorDraft) return false;
    const restoredSelection = restoreSectionEditorContextMenuTitleSelection(menuState);
    if (!restoredSelection || restoredSelection.selectionStart === restoredSelection.selectionEnd) {
      return false;
    }
    const selectedText = sectionEditorDraft.label.slice(
      restoredSelection.selectionStart,
      restoredSelection.selectionEnd
    );
    return writeSectionEditorClipboardText(selectedText);
  };

  const cutSectionEditorTitleSelection = async (
    menuState: SectionEditorContextMenuState | null = sectionEditorContextMenuStateRef.current
  ) => {
    if (!sectionEditorWritable) return false;
    const copied = await copySectionEditorTitleSelection(menuState);
    if (!copied) return false;
    return replaceSectionEditorTitleSelection("", menuState);
  };

  const pasteSectionEditorTitleClipboard = async (
    menuState: SectionEditorContextMenuState | null = sectionEditorContextMenuStateRef.current
  ) => {
    if (!sectionEditorWritable) return false;
    const clipboardText = await readSectionEditorClipboardText();
    if (!clipboardText) return false;
    return replaceSectionEditorTitleSelection(clipboardText, menuState);
  };

  const selectAllSectionEditorTitle = () => {
    const input = sectionEditorTitleInputRef.current;
    if (!input) return false;
    setSectionEditorFocusTarget("label");
    try {
      input.focus({ preventScroll: true });
    } catch {
      input.focus();
    }
    input.setSelectionRange(0, input.value.length);
    return true;
  };

  const selectAllSectionEditorContent = () => {
    const surface = sectionEditorSurfaceRef.current;
    const selection = window.getSelection();
    if (!surface || !selection) return false;
    focusSectionEditorSurface();
    const range = document.createRange();
    range.selectNodeContents(surface);
    selection.removeAllRanges();
    selection.addRange(range);
    sectionEditorSelectionRef.current = range.cloneRange();
    syncSectionEditorSelectionFormattingState(range.startContainer, surface);
    return true;
  };

  const copySectionEditorContentSelection = async (
    menuState: SectionEditorContextMenuState | null = sectionEditorContextMenuStateRef.current
  ) => {
    const restoredRange = restoreSectionEditorContextMenuContentSelection(menuState);
    if (!restoredRange || restoredRange.collapsed) {
      return false;
    }
    const copied = document.execCommand("copy", false);
    if (copied) return true;
    const selectedText = getSectionEditorTextFromRange(restoredRange);
    if (!selectedText) return false;
    return writeSectionEditorClipboardText(selectedText);
  };

  const cutSectionEditorContentSelection = async (
    menuState: SectionEditorContextMenuState | null = sectionEditorContextMenuStateRef.current
  ) => {
    if (!sectionEditorWritable) return false;
    const restoredRange = restoreSectionEditorContextMenuContentSelection(menuState);
    if (!restoredRange || restoredRange.collapsed) {
      return false;
    }
    const cut = document.execCommand("cut", false);
    if (cut) {
      syncSectionEditorContentFromDom();
      return true;
    }
    const selectedText = getSectionEditorTextFromRange(restoredRange);
    if (!selectedText) return false;
    await writeSectionEditorClipboardText(selectedText);
    restoredRange.deleteContents();
    syncSectionEditorContentFromDom();
    return true;
  };

  const pasteSectionEditorContentClipboard = async (
    options?: {
      plainTextOnly?: boolean;
      menuState?: SectionEditorContextMenuState | null;
    }
  ) => {
    if (!sectionEditorWritable) return false;
    const restoredRange = restoreSectionEditorContextMenuContentSelection(options?.menuState);
    if (!restoredRange) return false;
    const { html, text } = options?.plainTextOnly ? { html: "", text: await readSectionEditorClipboardText() } : await readSectionEditorClipboardPayload();
    const sanitizedHtml = !options?.plainTextOnly ? sanitizeProcedureRichTextHtml(html) : "";
    if (sanitizedHtml.trim()) {
      insertSectionEditorHtml(sanitizedHtml);
      return true;
    }
    const nextContent = normalizeProcedurePastedPlainText(text);
    if (!nextContent) return false;
    insertSectionEditorHtml(procedureTextToEditorHtml(nextContent, globalNodeById, imagePreviewSrcByNodeId));
    return true;
  };

  const clearSectionEditorFormattingAtSelection = (
    menuState: SectionEditorContextMenuState | null = sectionEditorContextMenuStateRef.current
  ) => {
    if (!sectionEditorWritable) return false;
    const restoredRange = restoreSectionEditorContextMenuContentSelection(menuState);
    if (!restoredRange) return false;
    document.execCommand("removeFormat", false);
    document.execCommand("unlink", false);
    syncSectionEditorContentFromDom();
    return true;
  };

  const removeSectionEditorLinkAtSelection = (
    menuState: SectionEditorContextMenuState | null = sectionEditorContextMenuStateRef.current
  ) => {
    if (!sectionEditorWritable) return false;
    const surface = sectionEditorSurfaceRef.current;
    const restoredRange = restoreSectionEditorContextMenuContentSelection(menuState);
    if (!surface || !restoredRange) return false;
    const link = findSectionEditorLinkElement(restoredRange.startContainer, surface);
    if (!link) return false;
    const focusTarget = link.parentElement ?? surface;
    unwrapSectionEditorLink(link);
    focusSectionEditorNodeContents(focusTarget, { collapseToEnd: true });
    syncSectionEditorContentFromDom();
    return true;
  };

  const openSectionEditorTitleContextMenu = (event: ReactMouseEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();
    closeSectionEditorFloatingMenus();
    setSectionEditorFocusTarget("label");
    syncSectionEditorTitleFormattingState();
    setSectionEditorSelectedImageId(null);
    setSectionEditorSelectedImageAlignment(null);
    const input = event.currentTarget;
    const selectionStart = input.selectionStart ?? input.value.length;
    const selectionEnd = input.selectionEnd ?? selectionStart;
    setSectionEditorContextMenu({
      x: event.clientX,
      y: event.clientY,
      target: "label",
      selectionStart,
      selectionEnd,
      hasSelection: selectionEnd > selectionStart
    });
  };

  const openSectionEditorContentContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    closeSectionEditorFloatingMenus();
    setSectionEditorFocusTarget("content");
    setSectionEditorSelectedImageId(null);
    setSectionEditorSelectedImageAlignment(null);
    const surface = sectionEditorSurfaceRef.current;
    if (!surface) return;
    const restoredRange = placeSectionEditorSelectionFromPoint(event.clientX, event.clientY, event.target);
    const nextRange =
      restoredRange && surface.contains(restoredRange.commonAncestorContainer) ? restoredRange : restoreSectionEditorSelection();
    const serializedSelection = nextRange ? serializeSectionEditorRange(nextRange, surface) : null;
    const quoteActive = Boolean(nextRange && findSectionEditorQuoteElement(nextRange.startContainer, surface));
    const listKind = nextRange ? resolveSectionEditorListKind(nextRange.startContainer, surface) : null;
    setSectionEditorContextMenu({
      x: event.clientX,
      y: event.clientY,
      target: "content",
      selection: serializedSelection,
      hasSelection: Boolean(nextRange && !nextRange.collapsed && getSectionEditorTextFromRange(nextRange).length > 0),
      insideLink: Boolean(nextRange && findSectionEditorLinkElement(nextRange.startContainer, surface)),
      insideTable: Boolean(nextRange && findSectionEditorTableCellElement(nextRange.startContainer, surface)),
      quoteActive,
      listKind
    });
  };

  const buildSectionEditorNodePath = (node: Node, root: Node): number[] | null => {
    const path: number[] = [];
    let current: Node | null = node;
    while (current && current !== root) {
      const parent: Node | null = current.parentNode;
      if (!parent) return null;
      const index = Array.prototype.indexOf.call(parent.childNodes, current);
      if (index < 0) return null;
      path.unshift(index);
      current = parent;
    }
    return current === root ? path : null;
  };

  const resolveSectionEditorNodePath = (root: Node, path: number[]): Node | null => {
    let current: Node | null = root;
    for (const index of path) {
      current = current?.childNodes.item(index) ?? null;
      if (!current) return null;
    }
    return current;
  };

  const serializeSectionEditorRange = (
    range: Range | null,
    surface: HTMLElement
  ): SerializedSectionEditorRange | null => {
    if (!range || !surface.contains(range.commonAncestorContainer)) return null;
    const startPath = buildSectionEditorNodePath(range.startContainer, surface);
    const endPath = buildSectionEditorNodePath(range.endContainer, surface);
    if (!startPath || !endPath) return null;
    return {
      start: {
        path: startPath,
        offset: range.startOffset
      },
      end: {
        path: endPath,
        offset: range.endOffset
      }
    };
  };

  const restoreSerializedSectionEditorRange = (serialized: SerializedSectionEditorRange | null): Range | null => {
    const surface = sectionEditorSurfaceRef.current;
    if (!surface || !serialized) return null;
    const startNode = resolveSectionEditorNodePath(surface, serialized.start.path);
    const endNode = resolveSectionEditorNodePath(surface, serialized.end.path);
    if (!startNode || !endNode) return null;
    const range = document.createRange();
    range.setStart(startNode, Math.min(serialized.start.offset, startNode.childNodes.length || startNode.textContent?.length || 0));
    range.setEnd(endNode, Math.min(serialized.end.offset, endNode.childNodes.length || endNode.textContent?.length || 0));
    return range;
  };

  const captureSectionEditorInsertRange = () => {
    syncSectionEditorSelection();
    const surface = sectionEditorSurfaceRef.current;
    const savedRange = sectionEditorSelectionRef.current;
    sectionEditorInsertRangeRef.current = savedRange ? savedRange.cloneRange() : null;
    sectionEditorInsertSerializedRangeRef.current =
      surface && savedRange ? serializeSectionEditorRange(savedRange, surface) : null;
  };

  const clearSectionEditorInsertRange = () => {
    sectionEditorInsertRangeRef.current = null;
    sectionEditorInsertSerializedRangeRef.current = null;
  };

  const restoreSectionEditorInsertRange = () =>
    restoreSerializedSectionEditorRange(sectionEditorInsertSerializedRangeRef.current) ??
    (sectionEditorInsertRangeRef.current ? sectionEditorInsertRangeRef.current.cloneRange() : null);

  const captureSectionWebsiteLinkBookmark = () => {
    clearSectionWebsiteLinkBookmark();
    const surface = sectionEditorSurfaceRef.current;
    const baseRange =
      sectionEditorInsertRangeRef.current?.cloneRange() ??
      sectionEditorSelectionRef.current?.cloneRange() ??
      null;
    if (!surface || !baseRange || !surface.contains(baseRange.commonAncestorContainer)) {
      return null;
    }

    const selectedText = getSectionEditorTextFromRange(baseRange);
    const startMarker = document.createElement("span");
    const endMarker = document.createElement("span");
    startMarker.setAttribute("data-ode-link-bookmark", "start");
    endMarker.setAttribute("data-ode-link-bookmark", "end");
    startMarker.setAttribute("contenteditable", "false");
    endMarker.setAttribute("contenteditable", "false");

    const endRange = baseRange.cloneRange();
    endRange.collapse(false);
    endRange.insertNode(endMarker);

    const startRange = baseRange.cloneRange();
    startRange.collapse(true);
    startRange.insertNode(startMarker);

    sectionWebsiteLinkStartMarkerRef.current = startMarker;
    sectionWebsiteLinkEndMarkerRef.current = endMarker;
    return {
      selectedText,
      range: baseRange
    };
  };

  const restoreSectionWebsiteLinkRangeFromBookmark = () => {
    const startMarker = sectionWebsiteLinkStartMarkerRef.current;
    const endMarker = sectionWebsiteLinkEndMarkerRef.current;
    if (startMarker?.isConnected && endMarker?.isConnected) {
      const range = document.createRange();
      range.setStartAfter(startMarker);
      range.setEndBefore(endMarker);
      return range;
    }
    if (startMarker?.isConnected) {
      const range = document.createRange();
      range.setStartAfter(startMarker);
      range.collapse(true);
      return range;
    }
    return null;
  };

  const insertSectionNodeLink = (node: AppNode) => {
    const restoredRange = restoreSectionEditorInsertRange();
    const fallbackLabel = node.type === "file" ? getProcedureFileDisplayTitle(node.name) : getNodeDisplayName(node);
    const label = sanitizeSectionLinkLabel(fallbackLabel, "Linked node") || fallbackLabel;
    const href = `ode://node/${encodeURIComponent(node.id)}`;
    const anchor = buildSectionEditorLinkElement(label, href, "node", {
      "data-node-id": node.id
    });
    insertSectionEditorElement(anchor, restoredRange);
    clearSectionEditorInsertRange();
    setSectionNodeLinkPickerOpen(false);
    setSectionNodeLinkQuery("");
  };

  const insertSectionAppLink = async (candidate: ProcedureAppLinkCandidate) => {
    const restoredRange = restoreSectionEditorInsertRange();
    const anchor = await buildSectionEditorAppLinkElement(candidate);
    insertSectionEditorElement(anchor, restoredRange);
    clearSectionEditorInsertRange();
    setSectionAppPickerOpen(false);
    setSectionAppQuery("");
  };

  const insertSectionReferenceLink = (node: AppNode) => {
    const restoredRange = restoreSectionEditorInsertRange();
    const fallbackLabel = node.type === "file" ? getProcedureFileDisplayTitle(node.name) : node.name;
    const label = sanitizeSectionLinkLabel(getSectionEditorSelectedText(), fallbackLabel) || fallbackLabel;
    const href = `ode://node/${encodeURIComponent(node.id)}`;
    const anchor = buildSectionEditorLinkElement(label, href, "node", {
      "data-node-id": node.id
    });
    insertSectionEditorElement(anchor, restoredRange);
    clearSectionEditorInsertRange();
  };

  const openSectionWebsiteLinkDialog = () => {
    captureSectionEditorInsertRange();
    clearSectionWebsiteLinkBookmark();
    const surface = sectionEditorSurfaceRef.current;
    const savedRange = sectionEditorInsertRangeRef.current ? sectionEditorInsertRangeRef.current.cloneRange() : null;
    const bookmark = captureSectionWebsiteLinkBookmark();
    const selectedText = bookmark?.selectedText ?? getSectionEditorTextFromRange(savedRange);
    sectionWebsiteLinkRangeRef.current = savedRange ? savedRange.cloneRange() : null;
    sectionWebsiteLinkSerializedRangeRef.current =
      surface && savedRange ? serializeSectionEditorRange(savedRange, surface) : null;
    setSectionNodeLinkPickerOpen(false);
    setSectionNodeLinkQuery("");
    setSectionAppPickerOpen(false);
    setSectionAppQuery("");
    setSectionEditorStyleMenuOpen(false);
    setSectionEditorFocusTarget("panel");
    setSectionWebsiteLinkState({
      selectionStart: 0,
      selectionEnd: 0,
      label: sanitizeSectionLinkLabel(selectedText, "Website"),
      href: "https://"
    });
  };

  const confirmSectionWebsiteLink = () => {
    if (!sectionWebsiteLinkState) return;
    const href = normalizeSectionExternalHref(sectionWebsiteLinkState.href);
    if (!href) {
      setNotice("Website links need an http or https address.");
      return;
    }
    const fallbackLabel = sanitizeSectionLinkLabel(sectionWebsiteLinkState.href, "Website");
    const label = sanitizeSectionLinkLabel(sectionWebsiteLinkState.label, fallbackLabel);
    const restoredRange =
      restoreSectionWebsiteLinkRangeFromBookmark() ??
      restoreSerializedSectionEditorRange(sectionWebsiteLinkSerializedRangeRef.current) ??
      (sectionWebsiteLinkRangeRef.current ? sectionWebsiteLinkRangeRef.current.cloneRange() : null);
    const anchor = buildSectionEditorLinkElement(label, href, "website");
    focusSectionEditorSurface();
    const selection = window.getSelection();
    if (!selection || !restoredRange) {
      clearSectionWebsiteLinkBookmark();
      clearSectionEditorInsertRange();
      sectionWebsiteLinkRangeRef.current = null;
      sectionWebsiteLinkSerializedRangeRef.current = null;
      setSectionWebsiteLinkState(null);
      setSectionEditorFocusTarget("content");
      return;
    }
    selection.removeAllRanges();
    selection.addRange(restoredRange);
    restoredRange.deleteContents();
    restoredRange.insertNode(anchor);
    clearSectionWebsiteLinkBookmark();
    const nextRange = document.createRange();
    nextRange.setStartAfter(anchor);
    nextRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    sectionEditorSelectionRef.current = nextRange.cloneRange();
    syncSectionEditorContentFromDom();
    clearSectionWebsiteLinkBookmark();
    clearSectionEditorInsertRange();
    sectionWebsiteLinkRangeRef.current = null;
    sectionWebsiteLinkSerializedRangeRef.current = null;
    setSectionWebsiteLinkState(null);
    setSectionEditorFocusTarget("content");
  };

  const revealProcedureSectionNode = (nodeId: string) => {
    const surface = procedureSurfaceContentRef.current;
    if (!surface) return;
    const sectionElements = surface.querySelectorAll<HTMLElement>("[data-procedure-node-id]");
    const target = Array.from(sectionElements).find((element) => element.dataset.procedureNodeId === nodeId) ?? null;
    if (!target) return;
    target.scrollIntoView({
      block: "center",
      behavior: "smooth"
    });
  };

  const openLinkedProcedureNode = (linkedNode: AppNode, source: "editor" | "saved") => {
    if (!canReadProcedureNode(linkedNode.id)) return;
    const editableNode = resolveNearestProcedureEditableSectionNode(linkedNode, globalNodeById) ?? linkedNode;
    const isCurrentProcedureNode = subtreeNodeMap.has(linkedNode.id) || subtreeNodeMap.has(editableNode.id);
    if (!isCurrentProcedureNode) {
      void onOpenLinkedNode(editableNode.id);
      return;
    }

    onSelectNode(editableNode.id);
    window.requestAnimationFrame(() => {
      revealProcedureSectionNode(editableNode.id);
    });

    if (source === "saved") {
      return;
    }

    if (!canWriteProcedureNode(editableNode.id)) {
      setNotice(`Selected ${editableNode.name}. The active role cannot edit this section.`);
      return;
    }

    if (sectionEditorNodeId === editableNode.id) {
      setSectionEditorFocusTarget("content");
      focusSectionEditorSurface();
      return;
    }

    openSectionEditor(editableNode, {
      focusTarget: "content"
    });
  };

  const handleSectionEditorSurfaceClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    const isEditorOpenGesture = event.ctrlKey || event.metaKey;
    const clickedImage = target?.closest('img[data-ode-link-type="image"]') as HTMLImageElement | null;
    if (clickedImage) {
      event.preventDefault();
      event.stopPropagation();
      setSectionEditorFocusTarget("content");
      focusSectionEditorSurface();
      selectSectionEditorImageElement(clickedImage);
      return;
    }
    setSectionEditorSelectedImageId(null);
    setSectionEditorSelectedImageAlignment(null);
    const linkedNodeElement = target?.closest('[data-ode-link-type="node"]') as HTMLElement | null;
    if (linkedNodeElement) {
      event.preventDefault();
      event.stopPropagation();
      if (!isEditorOpenGesture) {
        setSectionEditorFocusTarget("content");
        syncSectionEditorSelection();
        return;
      }
      const nodeId = linkedNodeElement.dataset.nodeId?.trim() || "";
      const linkedNode = nodeId ? globalNodeById.get(nodeId) ?? null : null;
      if (linkedNode) {
        if (linkedNode.type === "file") {
          void onOpenLinkedFile(linkedNode.id);
        } else {
          openLinkedProcedureNode(linkedNode, "editor");
        }
      }
      return;
    }
    const linkedRecordElement = target?.closest('[data-ode-link-type="record"]') as HTMLAnchorElement | null;
    if (linkedRecordElement) {
      event.preventDefault();
      event.stopPropagation();
      if (!isEditorOpenGesture) {
        setSectionEditorFocusTarget("content");
        syncSectionEditorSelection();
        return;
      }
      const recordRef =
        decodeProcedureRecordToken(linkedRecordElement.getAttribute("href") ?? "") ?? {
          tableNodeId: linkedRecordElement.dataset.tableNodeId?.trim() || "",
          recordId: linkedRecordElement.dataset.recordId?.trim() || ""
        };
      if (recordRef.tableNodeId && recordRef.recordId) {
        openLinkedRecord(recordRef.tableNodeId, recordRef.recordId);
      }
      return;
    }
    const appLink = target?.closest('a[data-ode-link-type="app"]') as HTMLAnchorElement | null;
    if (appLink) {
      event.preventDefault();
      event.stopPropagation();
      if (!isEditorOpenGesture) {
        setSectionEditorFocusTarget("content");
        syncSectionEditorSelection();
        return;
      }
      const payload = decodeProcedureAppLinkPayload(appLink.getAttribute("href") ?? "");
      if (payload) {
        void onLaunchLinkedApp({
          id: payload.appId ?? `procedure-app-${Date.now()}`,
          label: payload.appName?.trim() || "App",
          kind: payload.kind,
          target: payload.target,
          iconKey: payload.iconKey ?? "auto",
          customIconDataUrl: payload.customIconDataUrl ?? null
        });
      }
      return;
    }
    const websiteLink = target?.closest('a[data-ode-link-type="website"]') as HTMLAnchorElement | null;
    if (websiteLink) {
      event.preventDefault();
      event.stopPropagation();
      if (!isEditorOpenGesture) {
        setSectionEditorFocusTarget("content");
        syncSectionEditorSelection();
        return;
      }
      const href = normalizeSectionExternalHref(websiteLink.getAttribute("href") ?? "");
      if (href) {
        void onOpenWebsiteLink(href);
      }
      return;
    }
    syncSectionEditorSelection();
  };

  const handleSavedSectionDocumentClick = (event: ReactMouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    const linkedNodeElement = target?.closest('[data-ode-link-type="node"]') as HTMLElement | null;
    if (linkedNodeElement) {
      event.preventDefault();
      event.stopPropagation();
      const nodeId = linkedNodeElement.dataset.nodeId?.trim() || "";
      const linkedNode = nodeId ? globalNodeById.get(nodeId) ?? null : null;
      if (!linkedNode || !canReadProcedureNode(linkedNode.id)) return;
      if (linkedNode.type === "file") {
        void onOpenLinkedFile(linkedNode.id);
        return;
      }
      openLinkedProcedureNode(linkedNode, "saved");
      return;
    }

    const linkedRecordElement = target?.closest('[data-ode-link-type="record"]') as HTMLAnchorElement | null;
    if (linkedRecordElement) {
      event.preventDefault();
      event.stopPropagation();
      const recordRef =
        decodeProcedureRecordToken(linkedRecordElement.getAttribute("href") ?? "") ?? {
          tableNodeId: linkedRecordElement.dataset.tableNodeId?.trim() || "",
          recordId: linkedRecordElement.dataset.recordId?.trim() || ""
        };
      if (recordRef.tableNodeId && recordRef.recordId) {
        openLinkedRecord(recordRef.tableNodeId, recordRef.recordId);
      }
      return;
    }

    const linkedImageElement = target?.closest('[data-ode-link-type="image"]') as HTMLElement | null;
    if (linkedImageElement) {
      event.preventDefault();
      event.stopPropagation();
      const nodeId = linkedImageElement.dataset.nodeId?.trim() || "";
      if (nodeId) {
        onReviewNodeFile(nodeId);
      }
      return;
    }

    const appLink = target?.closest('a[data-ode-link-type="app"]') as HTMLAnchorElement | null;
    if (appLink) {
      event.preventDefault();
      event.stopPropagation();
      const payload = decodeProcedureAppLinkPayload(appLink.getAttribute("href") ?? "");
      if (!payload) return;
      void onLaunchLinkedApp({
        id: payload.appId ?? `procedure-app-${Date.now()}`,
        label: payload.appName?.trim() || "App",
        kind: payload.kind,
        target: payload.target,
        iconKey: payload.iconKey ?? "auto",
        customIconDataUrl: payload.customIconDataUrl ?? null
      });
      return;
    }

    const websiteLink = target?.closest('a[data-ode-link-type="website"]') as HTMLAnchorElement | null;
    if (websiteLink) {
      event.preventDefault();
      event.stopPropagation();
      const href = normalizeSectionExternalHref(websiteLink.getAttribute("href") ?? "");
      if (href) {
        void onOpenWebsiteLink(href);
      }
    }
  };

  const handleSaveField = async () => {
    if (!fieldEditorNodeId || !fieldEditorDraft) return;
    if (!canWriteProcedureNode(fieldEditorNodeId)) {
      setNotice("The active role cannot edit this field.");
      return;
    }
    const currentNode = subtreeNodeMap.get(fieldEditorNodeId) ?? null;
    const trimmedLabel = fieldEditorDraft.label.trim() || "New Field";
    const nextType = fieldEditorDraft.type;
    const nextOptions = fieldTypeSupportsOptions(nextType)
      ? normalizeOptionLines(
          fieldEditorDraft.optionsText,
          nextType === "table" ? DEFAULT_TABLE_COLUMNS : DEFAULT_SELECT_OPTIONS
        )
      : [];
    setFieldEditorSaving(true);
    try {
      await onRenameNodeTitle(fieldEditorNodeId, trimmedLabel);
      await onSaveNodeProperties(fieldEditorNodeId, {
        ...(currentNode?.properties ?? {}),
        odeProcedureItemType: "field",
        odeProcedureFieldType: nextType,
        odeProcedurePlaceholder: fieldEditorDraft.placeholder.trim(),
        odeProcedureRequired: fieldEditorDraft.required,
        odeProcedureShowInMasterList: fieldEditorDraft.showInMasterList,
        odeProcedureVisibilitySourceFieldId:
          fieldEditorDraft.visibilitySourceFieldId.trim().length > 0 &&
          fieldEditorDraft.visibilityEqualsValue.trim().length > 0
            ? fieldEditorDraft.visibilitySourceFieldId.trim()
            : null,
        odeProcedureVisibilityEqualsValue:
          fieldEditorDraft.visibilitySourceFieldId.trim().length > 0 &&
          fieldEditorDraft.visibilityEqualsValue.trim().length > 0
            ? fieldEditorDraft.visibilityEqualsValue.trim()
            : "",
        odeProcedureOptions: nextOptions,
        odeProcedureOrganizationRootNodeId:
          isProcedureOrganizationLinkFieldType(nextType) && fieldEditorDraft.organizationRootNodeId.trim().length > 0
            ? fieldEditorDraft.organizationRootNodeId.trim()
            : null,
        odeProcedureRelationTargetNodeId:
          isProcedureRelationFieldType(nextType) && fieldEditorDraft.relationTargetNodeId.trim().length > 0
            ? fieldEditorDraft.relationTargetNodeId.trim()
            : null,
        odeProcedureRelationDisplayFieldIds:
          isProcedureRelationFieldType(nextType) && fieldEditorDraft.relationDisplayFieldIds.length > 0
            ? fieldEditorDraft.relationDisplayFieldIds
            : [],
        odeProcedureRelationDisplayFieldId:
          isProcedureRelationFieldType(nextType) && fieldEditorDraft.relationDisplayFieldIds.length > 0
            ? fieldEditorDraft.relationDisplayFieldIds[0] ?? null
            : null,
        odeProcedureFormulaExpression:
          isProcedureFormulaFieldType(nextType) && fieldEditorDraft.formulaExpression.trim().length > 0
            ? fieldEditorDraft.formulaExpression.trim()
            : "",
        odeProcedureAutomationRole: fieldEditorDraft.automationRole,
        odeProcedureTableRows:
          nextType === "table"
            ? Array.isArray(currentNode?.properties?.odeProcedureTableRows)
              ? currentNode?.properties?.odeProcedureTableRows
              : [["", ""]]
            : []
      });
      setNotice(`${trimmedLabel} updated.`);
      closeFieldEditor();
    } finally {
      setFieldEditorSaving(false);
    }
  };

  const handleSaveTableView = async () => {
    if (!tableViewEditorNode || !tableViewEditorDraft) return;
    if (!canWriteProcedureNode(tableViewEditorNode.id)) {
      setNotice("The active role cannot edit this table layout.");
      return;
    }
    const availableFieldIds = new Set(tableViewEditorFields.map((entry) => entry.node.id));
    const nextGroupByFieldId =
      tableViewEditorDraft.viewMode === "matrix" && availableFieldIds.has(tableViewEditorDraft.groupByFieldId)
        ? tableViewEditorDraft.groupByFieldId
        : "";
    const nextInfoFieldIds =
      tableViewEditorDraft.viewMode === "matrix"
        ? Array.from(
            new Set(
              tableViewEditorDraft.infoFieldIds.filter(
                (fieldId) => availableFieldIds.has(fieldId) && fieldId !== nextGroupByFieldId
              )
            )
          )
        : [];
    const nextMatrixRowFieldId =
      (tableViewEditorDraft.viewMode === "matrix" || tableViewEditorDraft.viewMode === "pivot") &&
      availableFieldIds.has(tableViewEditorDraft.matrixRowFieldId)
        ? tableViewEditorDraft.matrixRowFieldId
        : "";
    const nextMatrixColumnFieldIds =
      tableViewEditorDraft.viewMode === "matrix"
        ? Array.from(
            new Set(
              tableViewEditorDraft.matrixColumnFieldIds.filter(
                (fieldId) => availableFieldIds.has(fieldId) && fieldId !== nextMatrixRowFieldId
              )
            )
          )
        : [];
    const nextPivotColumnFieldId =
      tableViewEditorDraft.viewMode === "pivot" &&
      availableFieldIds.has(tableViewEditorDraft.pivotColumnFieldId) &&
      tableViewEditorDraft.pivotColumnFieldId !== nextMatrixRowFieldId
        ? tableViewEditorDraft.pivotColumnFieldId
        : "";
    if (tableViewEditorDraft.viewMode === "matrix" && !nextMatrixRowFieldId) {
      setNotice("Pick a row field for the matrix view.");
      return;
    }
    if (tableViewEditorDraft.viewMode === "matrix" && nextMatrixColumnFieldIds.length === 0) {
      setNotice("Pick at least one matrix column.");
      return;
    }
    if (tableViewEditorDraft.viewMode === "pivot" && !nextMatrixRowFieldId) {
      setNotice("Pick a row field for the pivot view.");
      return;
    }
    if (tableViewEditorDraft.viewMode === "pivot" && !nextPivotColumnFieldId) {
      setNotice("Pick the field that should generate pivot columns.");
      return;
    }
    setTableViewEditorSaving(true);
    try {
      await onSaveNodeProperties(tableViewEditorNode.id, {
        ...(tableViewEditorNode.properties ?? {}),
        odeProcedureTableViewMode: tableViewEditorDraft.viewMode,
        odeProcedureTableGroupByFieldId: nextGroupByFieldId || null,
        odeProcedureTableInfoFieldIds: nextInfoFieldIds,
        odeProcedureTableMatrixRowFieldId: nextMatrixRowFieldId || null,
        odeProcedureTableMatrixColumnFieldIds: nextMatrixColumnFieldIds,
        odeProcedureTablePivotColumnFieldId: nextPivotColumnFieldId || null,
        odeProcedureTableMatrixColumnGroupLabel:
          tableViewEditorDraft.viewMode === "matrix" || tableViewEditorDraft.viewMode === "pivot"
            ? tableViewEditorDraft.matrixColumnGroupLabel.trim() || "Columns"
            : ""
      });
      setNotice(
        tableViewEditorDraft.viewMode === "matrix"
          ? `${tableViewEditorNode.name} now uses the advanced matrix view.`
          : tableViewEditorDraft.viewMode === "pivot"
          ? `${tableViewEditorNode.name} now uses the pivot count view.`
          : `${tableViewEditorNode.name} now uses the standard list view.`
      );
      closeTableViewEditor();
    } finally {
      setTableViewEditorSaving(false);
    }
  };

  const handleSaveSection = async () => {
    if (!sectionEditorNodeId || !sectionEditorDraft) return;
    if (!canWriteProcedureNode(sectionEditorNodeId)) {
      setNotice("The active role cannot edit this section.");
      return;
    }
    const trimmedLabel = sectionEditorDraft.label.trim() || "Untitled Section";
    const nextSerialized = sectionEditorSurfaceRef.current
      ? serializeProcedureEditorRichText(sectionEditorSurfaceRef.current)
      : { content: sectionEditorDraft.content, richTextHtml: sectionEditorDraft.richTextHtml };
    const nextContent = nextSerialized.content;
    const nextProperties = { ...(sectionEditorNode?.properties ?? {}) };
    if (sectionEditorDraft.numberingHidden) {
      nextProperties[NODE_NUMBER_HIDDEN_PROPERTY] = true;
    } else {
      delete nextProperties[NODE_NUMBER_HIDDEN_PROPERTY];
    }
    delete nextProperties[NODE_NUMBER_OVERRIDE_PROPERTY];
    delete nextProperties[NODE_NUMBER_SEPARATOR_PROPERTY];
    if (sectionEditorDraft.numberingStartAt !== null) {
      nextProperties[NODE_NUMBER_START_AT_PROPERTY] = sectionEditorDraft.numberingStartAt;
    } else {
      delete nextProperties[NODE_NUMBER_START_AT_PROPERTY];
    }
    delete nextProperties[NODE_NUMBER_FORMAT_PROPERTY];
    if (sectionEditorDraft.textAlignment !== "left") {
      nextProperties[SECTION_TEXT_ALIGNMENT_PROPERTY] = sectionEditorDraft.textAlignment;
    } else {
      delete nextProperties[SECTION_TEXT_ALIGNMENT_PROPERTY];
    }
    nextProperties[SECTION_EDITOR_LAST_TEXT_COLOR_PROPERTY] =
      resolveSectionEditorColorHex(sectionEditorTextColor) ?? SECTION_EDITOR_DEFAULT_PICKER_TEXT_COLOR;
    delete nextProperties[SECTION_TITLE_COLOR_PROPERTY];
    delete nextProperties[SECTION_TITLE_FONT_FAMILY_PROPERTY];
    delete nextProperties[SECTION_TITLE_FONT_SIZE_PT_PROPERTY];
    delete nextProperties[SECTION_TITLE_BOLD_PROPERTY];
    delete nextProperties[SECTION_TITLE_ITALIC_PROPERTY];
    delete nextProperties[SECTION_TITLE_ALIGNMENT_PROPERTY];
    if (nextSerialized.richTextHtml) {
      nextProperties[PROCEDURE_RICH_TEXT_HTML_PROPERTY] = nextSerialized.richTextHtml;
    } else {
      delete nextProperties[PROCEDURE_RICH_TEXT_HTML_PROPERTY];
    }
    const referencedInlineImageIds = collectReferencedInlineImageNodeIds(nextContent);
    const staleInlineImageReferenceIds = sectionEditorReferences
      .filter((reference) => getDesktopMediaPreviewKind(reference) === "image")
      .filter((reference) => isProcedureInlineAssetNode(reference))
      .filter((reference) => !referencedInlineImageIds.has(reference.id))
      .map((reference) => reference.id);
    setSectionEditorSaving(true);
    try {
      await onRenameNodeTitle(sectionEditorNodeId, trimmedLabel);
      await onSaveNodeDescription(sectionEditorNodeId, null);
      await onSaveNodeContent(sectionEditorNodeId, nextContent);
      await onSaveNodeProperties(sectionEditorNodeId, nextProperties);
      setPendingNewSectionNodeId((current) => (current === sectionEditorNodeId ? null : current));
      for (const referenceId of staleInlineImageReferenceIds) {
        await onDeleteProcedureNode(referenceId);
      }
      setNotice(`${trimmedLabel} updated.`);
      closeSectionEditor({ deletePendingNewSection: false });
    } finally {
      setSectionEditorSaving(false);
    }
  };

  const handleAddSectionPhotos = async () => {
    if (!sectionEditorNodeId || sectionPhotoAdding) return;
    if (!canWriteProcedureNode(sectionEditorNodeId)) {
      setNotice("The active role cannot edit this section.");
      return;
    }
    captureSectionEditorInsertRange();
    setSectionPhotoAdding(true);
    try {
      const createdNodes = await onAttachImagesToNode(sectionEditorNodeId);
      const imageNodes = createdNodes.filter((node) => getDesktopMediaPreviewKind(node) === "image");
      if (sectionEditorInsertRangeRef.current) {
        sectionEditorSelectionRef.current = sectionEditorInsertRangeRef.current.cloneRange();
      }
      let insertedCount = 0;
      for (const imageNode of imageNodes) {
        const imageElement = await buildSectionEditorImageElement(imageNode);
        if (!imageElement) continue;
        insertSectionEditorPhotoElement(imageElement);
        insertedCount += 1;
      }
      clearSectionEditorInsertRange();
      if (insertedCount > 0) {
        setNotice(insertedCount === 1 ? "1 photo added." : `${insertedCount} photos added.`);
      }
    } finally {
      setSectionPhotoAdding(false);
    }
  };

  const handleAddSectionAttachments = async () => {
    if (!sectionEditorNodeId || sectionAttachmentAdding) return;
    if (!canWriteProcedureNode(sectionEditorNodeId)) {
      setNotice("The active role cannot edit this section.");
      return;
    }
    setSectionAttachmentAdding(true);
    try {
      const addedCount = await onAttachFilesToNode(sectionEditorNodeId);
      if (addedCount > 0) {
        setNotice(addedCount === 1 ? "1 attachment added." : `${addedCount} attachments added.`);
      }
    } finally {
      setSectionAttachmentAdding(false);
    }
  };

  const requestDeleteAttachment = (reference: AppNode) => {
    setAttachmentDeleteState({
      nodeId: reference.id,
      nodeName: getProcedureFileDisplayTitle(reference.name)
    });
  };

  const confirmDeleteAttachment = async () => {
    if (!attachmentDeleteState) return;
    setSectionAttachmentDeletingId(attachmentDeleteState.nodeId);
    try {
      const deleted = await onDeleteProcedureNode(attachmentDeleteState.nodeId);
      if (deleted) {
        setNotice(`${attachmentDeleteState.nodeName} removed.`);
      }
      setAttachmentDeleteState(null);
    } finally {
      setSectionAttachmentDeletingId(null);
    }
  };

  const buildPersistedProcedureRecords = (
    tableNodeId: string,
    fields: ProcedureFieldEntry[],
    values: Record<string, ProcedureRecordValue>,
    existingRecord?: ProcedureRecord | null
  ): ProcedureRecord[] => {
    const expandedRows = buildExpandedProcedureRecordValueRows(fields, values);
    const formulaFields = fields.filter((entry) => isProcedureFormulaFieldType(entry.type));
    const timestamp = Date.now();
    const createdAt = existingRecord?.createdAt ?? timestamp;

    return expandedRows.map((rowValues, index) => {
      const nextRecordId = existingRecord && index === 0 ? existingRecord.id : createProcedureId("record");
      const previewValues =
        formulaFields.length > 0
          ? computeProcedurePreviewRecordValues({
              nodes: allNodes,
              tableNodeId,
              recordId: existingRecord?.id ?? nextRecordId,
              values: rowValues
            })
          : rowValues;
      const nextValues = { ...rowValues };
      for (const entry of formulaFields) {
        nextValues[entry.node.id] = previewValues[entry.node.id] ?? "";
      }
      return {
        id: nextRecordId,
        createdAt,
        updatedAt: timestamp,
        values: nextValues
      };
    });
  };

  const saveRecords = async (node: AppNode, nextRecords: ProcedureRecord[]) => {
    await onSaveNodeProperties(node.id, {
      ...(node.properties ?? {}),
      [PROCEDURE_RECORDS_PROPERTY_KEY]: nextRecords
    });
  };

  const handleSaveRecord = async () => {
    if (!recordEditorParentNode || recordEditorFields.length === 0) return;
    if (!canWriteProcedureNode(recordEditorParentNode.id)) {
      setNotice("The active role cannot edit records in this table.");
      return;
    }
    const missingRequiredField = visibleRecordEditorFields.find(
      (entry) => entry.required && !isProcedureFormulaFieldType(entry.type) && isEmptyRecordValue(draftValues[entry.node.id])
    );
    if (missingRequiredField) {
      setNotice(`${missingRequiredField.node.name} is required.`);
      return;
    }
    const currentRecords = readRecords(recordEditorParentNode);
    const existingRecord =
      recordEditorRecordId !== null
        ? currentRecords.find((record) => record.id === recordEditorRecordId) ?? null
        : null;
    const nextValues = { ...normalizedRecordEditorDraftValues };
    const persistedRecords = buildPersistedProcedureRecords(
      recordEditorParentNode.id,
      recordEditorFields,
      nextValues,
      existingRecord
    );
    const nextRecords =
      recordEditorRecordId === null
        ? [...persistedRecords, ...currentRecords]
        : (() => {
            const existingIndex = currentRecords.findIndex((record) => record.id === recordEditorRecordId);
            if (existingIndex < 0) {
              return [...persistedRecords, ...currentRecords];
            }
            return [
              ...currentRecords.slice(0, existingIndex),
              ...persistedRecords,
              ...currentRecords.slice(existingIndex + 1)
            ];
          })();
    setRecordSaving(true);
    try {
      await saveRecords(recordEditorParentNode, nextRecords);
      setNotice(
        persistedRecords.length > 1
          ? `Record saved as ${persistedRecords.length} organisation rows.`
          : "Record saved."
      );
      closeRecordEditor();
    } finally {
      setRecordSaving(false);
    }
  };

  const requestDeleteRecord = (node: AppNode, recordId: string) => {
    setDeleteConfirmState({
      nodeId: node.id,
      nodeName: node.name,
      recordId
    });
  };

  const handleDeleteRecord = async (node: AppNode, recordId: string) => {
    const nextRecords = readRecords(node).filter((record) => record.id !== recordId);
    setRecordSaving(true);
    try {
      await saveRecords(node, nextRecords);
      if (recordEditorRecordId === recordId) {
        closeRecordEditor();
      }
      setNotice("Record deleted.");
    } finally {
      setRecordSaving(false);
    }
  };

  const confirmDeleteRecord = async () => {
    if (!deleteConfirmState) return;
    const targetNode =
      subtreeNodeMap.get(deleteConfirmState.nodeId) ??
      (rootNode && rootNode.id === deleteConfirmState.nodeId ? rootNode : null);
    if (!targetNode) {
      setDeleteConfirmState(null);
      return;
    }
    await handleDeleteRecord(targetNode, deleteConfirmState.recordId);
    setDeleteConfirmState(null);
  };

  const handleFieldValueChange = (fieldId: string, value: ProcedureRecordValue) => {
    setDraftValues((current) => {
      const nextValues = {
        ...current,
        [fieldId]: value
      };
      const autofillValues = buildRelationAutofillValues({
        sourceFieldId: fieldId,
        sourceValue: value,
        recordFields: recordEditorFields,
        fieldById: recordEditorFieldById,
        model: procedureDatabaseModel
      });
      return {
        ...nextValues,
        ...autofillValues
      };
    });
  };

  const handleAddRecordAttachments = async (fieldId: string) => {
    if (!recordEditorParentNode || recordAttachmentAddingFieldId) return;
    if (!canWriteProcedureNode(recordEditorParentNode.id)) {
      setNotice("The active role cannot edit records in this table.");
      return;
    }
    setRecordAttachmentAddingFieldId(fieldId);
    try {
      const addedCount = await onAttachFilesToNode(recordEditorParentNode.id);
      if (addedCount > 0) {
        setNotice(addedCount === 1 ? "1 annex file added." : `${addedCount} annex files added.`);
      }
    } finally {
      setRecordAttachmentAddingFieldId(null);
    }
  };

  const handleExportRecordTable = async (node: AppNode) => {
    const fields = getDirectFieldEntries(node, byParent);
    const records = readRecords(node);
    if (fields.length === 0) {
      setNotice("Add fields to this table before exporting a template.");
      return;
    }
    const payload = buildProcedureTableSpreadsheetPayload({
      tableNode: node,
      fields,
      model: procedureDatabaseModel
    });
    setRecordExportingNodeId(node.id);
    try {
      const exportedPath = await exportProcedureTableExcel(
        `Export ${node.name}`,
        `${normalizeProcedureExportFileName(node.name)}.xlsx`,
        payload
      );
      if (!exportedPath) return;
      setNotice(
        records.length === 0
          ? `Template workbook exported to ${exportedPath}.`
          : `Workbook exported to ${exportedPath}.`
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setNotice(`Export failed: ${reason}`);
    } finally {
      setRecordExportingNodeId(null);
    }
  };

  const handleImportRecordTable = async (node: AppNode) => {
    if (!canWriteProcedureNode(node.id)) {
      setNotice("The active role cannot edit records in this table.");
      return;
    }
    const fields = getDirectFieldEntries(node, byParent).filter((entry) => canReadProcedureNode(entry.node.id));
    if (fields.length === 0) {
      setNotice("Add fields to this table before importing.");
      return;
    }

    setRecordImportingNodeId(node.id);
    try {
      const pickedPath = await pickWindowsProcedureTableSpreadsheetFile();
      if (!pickedPath) return;
      const payload = await readProcedureTableExcel(pickedPath);
      const selectedSheet = selectProcedureImportSheet({
        tableName: node.name,
        fields,
        payload
      });
      if (!selectedSheet) {
        setNotice("The workbook does not contain a readable worksheet for this table.");
        return;
      }

      const fieldByHeaderKey = new Map(
        fields.map((entry) => [normalizeProcedureImportKey(entry.node.name), entry] as const)
      );
      const importedColumns = selectedSheet.headers
        .map((header, index) => ({
          header,
          index,
          entry: fieldByHeaderKey.get(normalizeProcedureImportKey(header)) ?? null
        }))
        .filter((column) => column.entry !== null);

      if (importedColumns.length === 0) {
        setNotice(`No matching columns were found in ${selectedSheet.name}.`);
        return;
      }

      const existingRecords = readRecords(node);
      const importedRecords: ProcedureRecord[] = [];
      let skippedRows = 0;

      for (const row of selectedSheet.rows) {
        const values: Record<string, ProcedureRecordValue> = {};
        let hasValue = false;

        for (const column of importedColumns) {
          const entry = column.entry;
          if (!entry) continue;
          const nextValue = resolveImportedRecordValue(entry, row[column.index] ?? "");
          if (typeof nextValue === "undefined") continue;
          values[entry.node.id] = nextValue;
          if (!isEmptyRecordValue(nextValue)) {
            hasValue = true;
          }
        }

        if (!hasValue) {
          skippedRows += 1;
          continue;
        }

        importedRecords.push(...buildPersistedProcedureRecords(node.id, fields, values));
      }

      if (importedRecords.length === 0) {
        setNotice(
          skippedRows > 0
            ? "No non-empty rows could be imported from the selected worksheet."
            : "Nothing was imported from the selected worksheet."
        );
        return;
      }

      await saveRecords(node, [...existingRecords, ...importedRecords]);
      setNotice(
        skippedRows > 0
          ? `Imported ${importedRecords.length} row${importedRecords.length === 1 ? "" : "s"} from ${
              selectedSheet.name
            }. Skipped ${skippedRows} empty row${skippedRows === 1 ? "" : "s"}.`
          : `Imported ${importedRecords.length} row${importedRecords.length === 1 ? "" : "s"} from ${
              selectedSheet.name
            }.`
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setNotice(`Import failed: ${reason}`);
    } finally {
      setRecordImportingNodeId(null);
    }
  };

  const createRootProcedureItem = async (kind: "section" | "field") => {
    if (!rootNode) return;
    if (!canWriteProcedureNode(rootNode.id)) {
      setNotice("The active role cannot edit this section.");
      return;
    }
    await onCreateProcedureItem(rootNode.id, kind, "inside");
  };

  const createSectionField = async (sectionNodeId: string) => {
    if (!canWriteProcedureNode(sectionNodeId)) {
      setNotice("The active role cannot edit this section.");
      return;
    }
    await onCreateProcedureItem(sectionNodeId, "field", "inside");
  };

  const renderRecordField = (entry: ProcedureFieldEntry) => {
    const fieldId = entry.node.id;
    const value = draftValues[fieldId];
    const relationChoices = recordRelationChoicesByFieldId.get(fieldId) ?? [];
    const previewValue = isProcedureFormulaFieldType(entry.type) ? recordEditorPreviewValues[fieldId] : value;
    const commonLabel = (
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[0.86rem] font-medium text-[var(--ode-text)]">{entry.node.name}</span>
        {entry.required ? (
          <span className="rounded-full border border-[rgba(95,220,255,0.28)] px-2 py-0.5 text-[0.68rem] uppercase tracking-[0.14em] text-[var(--ode-accent)]">
            Required
          </span>
        ) : null}
      </div>
    );

    if (entry.type === "multi_select") {
      const selectedValues = Array.isArray(value) ? value : [];
      const options = entry.options.length > 0 ? entry.options : DEFAULT_SELECT_OPTIONS;
      return (
        <label
          key={fieldId}
          className="block rounded-[24px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] px-4 py-4"
        >
          {commonLabel}
          <div className="flex flex-wrap gap-2">
            {options.map((option) => {
              const checked = selectedValues.includes(option);
              return (
                <button
                  key={`${fieldId}-${option}`}
                  type="button"
                  className={`rounded-full border px-3 py-1.5 text-[0.82rem] transition ${
                    checked
                      ? "border-[var(--ode-border-accent)] bg-[rgba(21,111,156,0.32)] text-[var(--ode-text)]"
                      : "border-[var(--ode-border)] bg-[rgba(4,27,43,0.42)] text-[var(--ode-text-muted)]"
                  }`}
                  onClick={() => {
                    const nextValue = checked
                      ? selectedValues.filter((item) => item !== option)
                      : [...selectedValues, option];
                    handleFieldValueChange(fieldId, nextValue);
                  }}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </label>
      );
    }

    if (entry.type === "single_select" || entry.type === "yes_no") {
      const options =
        entry.type === "yes_no"
          ? ["Yes", "No"]
          : entry.options.length > 0
            ? entry.options
            : DEFAULT_SELECT_OPTIONS;
      return (
        <label
          key={fieldId}
          className="block rounded-[24px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] px-4 py-4"
        >
          {commonLabel}
          <select
            className="ode-input h-11 w-full rounded-[16px] px-4"
            value={typeof value === "string" ? value : ""}
            onChange={(event) => handleFieldValueChange(fieldId, event.target.value)}
          >
            <option value="">Select</option>
            {options.map((option) => (
              <option key={`${fieldId}-${option}`} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (isProcedureNodeLinkFieldType(entry.type)) {
      const selectedToken = typeof value === "string" ? value : "";
      const selectedNodeId = decodeProcedureNodeToken(selectedToken);
      return (
        <label
          key={fieldId}
          className="block rounded-[24px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] px-4 py-4"
        >
          {commonLabel}
          <select
            className="ode-input h-11 w-full rounded-[16px] px-4"
            value={selectedToken}
            onChange={(event) => handleFieldValueChange(fieldId, event.target.value)}
          >
            <option value="">Select a node</option>
            {procedureNodeLinkCandidates.map((candidate) => (
              <option key={`${fieldId}-${candidate.node.id}`} value={encodeProcedureNodeToken(candidate.node.id)}>
                {candidate.pathLabel || candidate.label}
              </option>
            ))}
          </select>
          <div className="mt-2 text-[0.76rem] text-[var(--ode-text-muted)]">
            {selectedNodeId
              ? procedureNodeLinkCandidates.find((candidate) => candidate.node.id === selectedNodeId)?.workspaceName ??
                "Linked node"
              : entry.placeholder || "Link this record to an organisation or workspace node."}
          </div>
        </label>
      );
    }

    if (isProcedureOrganizationLinkFieldType(entry.type)) {
      const selectedValues = Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : typeof value === "string" && value.trim().length > 0
          ? [value]
          : [];
      const organizationChoices = getProcedureOrganizationTreeChoices(entry);
      return (
        <div
          key={fieldId}
          className="rounded-[24px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] px-4 py-4"
        >
          {commonLabel}
          {entry.organizationRootNodeId ? (
            <>
              <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                {organizationChoices.map((choice) => {
                  const checked = selectedValues.includes(choice.token);
                  return (
                    <label
                      key={`${fieldId}-${choice.token}`}
                      className={`flex items-center gap-3 rounded-[16px] border px-3 py-2.5 transition ${
                        checked
                          ? "border-[var(--ode-border-accent)] bg-[rgba(21,111,156,0.28)]"
                          : "border-[var(--ode-border)] bg-[rgba(4,27,43,0.42)]"
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3" style={{ paddingLeft: `${choice.depth * 18}px` }}>
                        {choice.depth > 0 ? (
                          <span className="h-px w-3 shrink-0 rounded-full bg-[rgba(110,211,255,0.22)]" aria-hidden />
                        ) : null}
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            const nextValue = event.target.checked
                              ? [...selectedValues, choice.token]
                              : selectedValues.filter((item) => item !== choice.token);
                            handleFieldValueChange(fieldId, Array.from(new Set(nextValue)));
                          }}
                        />
                        <span className="min-w-0 flex-1 text-[0.88rem] text-[var(--ode-text)]">{choice.label}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
              <div className="mt-2 text-[0.76rem] text-[var(--ode-text-muted)]">
                {selectedValues.length > 0
                  ? `${selectedValues.length} organisation node${selectedValues.length === 1 ? "" : "s"} selected.`
                  : entry.placeholder || "Select one or more organisation nodes from this branch."}
              </div>
            </>
          ) : (
            <div className="text-[0.82rem] text-[var(--ode-text-muted)]">
              Choose an organisation root in field settings first.
            </div>
          )}
        </div>
      );
    }

    if (entry.type === "relation") {
      return (
        <label
          key={fieldId}
          className="block rounded-[24px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] px-4 py-4"
        >
          {commonLabel}
          <select
            className="ode-input h-11 w-full rounded-[16px] px-4"
            value={typeof value === "string" ? value : ""}
            onChange={(event) => handleFieldValueChange(fieldId, event.target.value)}
          >
            <option value="">Select a related record</option>
            {relationChoices.map((choice) => (
              <option key={`${fieldId}-${choice.token}`} value={choice.token}>
                {choice.label}
              </option>
            ))}
          </select>
          <div className="mt-2 text-[0.76rem] text-[var(--ode-text-muted)]">
            {entry.placeholder || "Pick a record from the linked database."}
          </div>
        </label>
      );
    }

    if (entry.type === "relation_list") {
      const selectedValues = Array.isArray(value) ? value : [];
      return (
        <label
          key={fieldId}
          className="block rounded-[24px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] px-4 py-4"
        >
          {commonLabel}
          <select
            multiple
            className="ode-input min-h-[180px] w-full rounded-[18px] px-4 py-3"
            value={selectedValues}
            onChange={(event) =>
              handleFieldValueChange(
                fieldId,
                Array.from(event.target.selectedOptions).map((option) => option.value)
              )
            }
          >
            {relationChoices.map((choice) => (
              <option key={`${fieldId}-${choice.token}`} value={choice.token}>
                {choice.label}
              </option>
            ))}
          </select>
          <div className="mt-2 text-[0.76rem] text-[var(--ode-text-muted)]">
            {entry.placeholder || "Use Ctrl/Cmd click to select multiple related records."}
          </div>
        </label>
      );
    }

    if (entry.type === "attachment") {
      const selectedValues = Array.isArray(value)
        ? value
        : typeof value === "string" && value.trim().length > 0
          ? [value]
          : [];
      const attachmentChoices = recordAttachmentChoicesByFieldId.get(fieldId) ?? [];
      const selectedAttachmentChoices = selectedValues.map((token) => {
        const match = attachmentChoices.find((choice) => choice.token === token);
        if (match) return match;
        const linkedNodeId = decodeProcedureNodeToken(token);
        return {
          token,
          label: linkedNodeId ? globalNodeById.get(linkedNodeId)?.name ?? linkedNodeId : token,
          node: linkedNodeId ? globalNodeById.get(linkedNodeId) ?? null : null
        };
      });
      return (
        <div
          key={fieldId}
          className="rounded-[24px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] px-4 py-4"
        >
          {commonLabel}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[0.78rem] text-[var(--ode-text-muted)]">
              Link one or more annex files to this record.
            </div>
            <button
              type="button"
              className={`${PROCEDURE_SECONDARY_TEXT_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
              disabled={recordAttachmentAddingFieldId === fieldId}
              onClick={() => {
                void handleAddRecordAttachments(fieldId);
              }}
            >
              {recordAttachmentAddingFieldId === fieldId ? "Adding..." : "Add File"}
            </button>
          </div>
          <select
            multiple
            className="ode-input min-h-[180px] w-full rounded-[18px] px-4 py-3"
            value={selectedValues}
            onChange={(event) =>
              handleFieldValueChange(
                fieldId,
                Array.from(event.target.selectedOptions).map((option) => option.value)
              )
            }
          >
            {attachmentChoices.map((choice) => (
              <option key={`${fieldId}-${choice.token}`} value={choice.token}>
                {choice.label}
              </option>
            ))}
          </select>
          <div className="mt-2 text-[0.76rem] text-[var(--ode-text-muted)]">
            {attachmentChoices.length > 0
              ? "Files are stored on the table and linked dynamically to this record."
              : "No annex files are available yet. Use Add File to import them under this table."}
          </div>
          {selectedAttachmentChoices.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedAttachmentChoices.map((choice) => {
                const linkedNodeId = choice.node?.id ?? decodeProcedureNodeToken(choice.token);
                return (
                  <button
                    key={`${fieldId}-${choice.token}-chip`}
                    type="button"
                    className={`${PROCEDURE_SECONDARY_TEXT_BUTTON_CLASS} max-w-full truncate`}
                    disabled={!linkedNodeId}
                    onClick={() => {
                      if (!linkedNodeId) return;
                      void onOpenLinkedFile(linkedNodeId);
                    }}
                  >
                    {choice.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      );
    }

    if (entry.type === "table") {
      const columns = getTableFieldColumns(entry);
      const tableValue = createEmptyTableValue(columns, value);
      const filledEntries = getFilledTableFieldEntries(value, columns);
      const tableGridTemplate = `repeat(auto-fit, minmax(${columns.length > 2 ? 210 : 240}px, 1fr))`;
      return (
        <div
          key={fieldId}
          className="block rounded-[24px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] px-4 py-4 md:col-span-2"
        >
          {commonLabel}
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-[640px] text-[0.8rem] leading-6 text-[var(--ode-text-muted)]">
              {entry.placeholder || "Keep this structured row clean. Each configured column gets its own focused input."}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(95,220,255,0.24)] bg-[rgba(5,29,46,0.76)] px-3 py-1.5 text-[0.72rem] uppercase tracking-[0.14em] text-[var(--ode-accent)]">
              <span className="font-semibold text-[var(--ode-text)]">{filledEntries.length}</span>
              <span>/ {columns.length} filled</span>
            </div>
          </div>
          <div className="overflow-hidden rounded-[22px] border border-[rgba(95,220,255,0.18)] bg-[linear-gradient(180deg,rgba(4,26,41,0.9),rgba(2,18,31,0.96))] shadow-[inset_0_1px_0_rgba(138,219,255,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(95,220,255,0.14)] bg-[rgba(5,31,49,0.72)] px-4 py-3">
              <div className="text-[0.72rem] uppercase tracking-[0.18em] text-[var(--ode-text-dim)]">Structured Row</div>
              <div className="text-[0.72rem] uppercase tracking-[0.14em] text-[var(--ode-text-muted)]">
                {columns.length} column{columns.length === 1 ? "" : "s"}
              </div>
            </div>
            <div className="grid gap-px bg-[rgba(95,220,255,0.12)]" style={{ gridTemplateColumns: tableGridTemplate }}>
              {columns.map((column, index) => (
                <label key={`${fieldId}-${column}`} className="min-w-0 bg-[rgba(3,19,32,0.96)] px-4 py-4">
                  <div className="mb-3 flex items-start gap-3">
                    <span className="inline-flex h-6 min-w-[1.8rem] items-center justify-center rounded-full border border-[rgba(95,220,255,0.2)] bg-[rgba(8,44,69,0.82)] px-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--ode-accent)]">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1 text-[0.72rem] uppercase tracking-[0.14em] leading-5 text-[var(--ode-text-muted)] break-words">
                      {column}
                    </div>
                  </div>
                  <input
                    type="text"
                    className="ode-input h-12 w-full rounded-[16px] px-4 text-[0.95rem]"
                    value={tableValue[column] ?? ""}
                    onChange={(event) =>
                      handleFieldValueChange(fieldId, {
                        ...tableValue,
                        [column]: event.target.value
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (isProcedureFormulaFieldType(entry.type)) {
      return (
        <div
          key={fieldId}
          className="rounded-[24px] border border-[rgba(95,220,255,0.22)] bg-[rgba(7,39,61,0.4)] px-4 py-4"
        >
          {commonLabel}
          <div className="rounded-[18px] border border-[var(--ode-border)] bg-[rgba(4,24,38,0.58)] px-4 py-3 text-[0.94rem] text-[var(--ode-text)]">
            {formatRecordValue(previewValue, entry, procedureDatabaseModel)}
          </div>
          <div className="mt-2 text-[0.76rem] text-[var(--ode-text-muted)]">
            Calculated automatically from the formula expression.
          </div>
        </div>
      );
    }

    if (fieldTypeUsesTextarea(entry.type)) {
      return (
        <label
          key={fieldId}
          className="block rounded-[24px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] px-4 py-4"
        >
          {commonLabel}
          <textarea
            className="ode-input min-h-[128px] w-full rounded-[18px] px-4 py-3"
            placeholder={entry.placeholder}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => handleFieldValueChange(fieldId, event.target.value)}
          />
        </label>
      );
    }

    if (entry.type === "date") {
      return (
        <label
          key={fieldId}
          className="block rounded-[24px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] px-4 py-4"
        >
          {commonLabel}
          <ThemedDatePickerInput
            value={typeof value === "string" ? value : ""}
            onChange={(next) => handleFieldValueChange(fieldId, next)}
            language={language}
          />
        </label>
      );
    }

    if (entry.type === "month") {
      return (
        <label
          key={fieldId}
          className="block rounded-[24px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] px-4 py-4"
        >
          {commonLabel}
          <select
            className="ode-input h-11 w-full rounded-[16px] px-4"
            value={typeof value === "string" ? normalizeProcedureImportedMonth(value) : ""}
            onChange={(event) => handleFieldValueChange(fieldId, normalizeProcedureImportedMonth(event.target.value))}
          >
            <option value="">{entry.placeholder || "Select month"}</option>
            {MONTH_FIELD_OPTIONS.map((option) => (
              <option key={`${fieldId}-${option}`} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      );
    }

    return (
      <label
        key={fieldId}
        className="block rounded-[24px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] px-4 py-4"
      >
        {commonLabel}
        <input
          type={renderInputType(entry.type)}
          step={
            entry.type === "decimal" || entry.type === "currency" || entry.type === "percentage"
              ? "0.01"
              : entry.type === "number" || entry.type === "year" || entry.type === "day"
                ? "1"
                : undefined
          }
          min={entry.type === "day" ? "1" : undefined}
          max={entry.type === "day" ? "31" : entry.type === "year" ? "9999" : undefined}
          className="ode-input h-11 w-full rounded-[16px] px-4"
          placeholder={
            entry.placeholder || (entry.type === "year" ? "YYYY" : entry.type === "day" ? "DD" : "")
          }
          value={
            typeof value === "string"
              ? entry.type === "year"
                ? normalizeProcedureImportedYear(value)
                : entry.type === "day"
                  ? normalizeProcedureImportedDay(value)
                  : value
              : ""
          }
          onChange={(event) =>
            handleFieldValueChange(
              fieldId,
              entry.type === "year"
                ? normalizeProcedureImportedYear(event.target.value)
                : entry.type === "day"
                  ? normalizeProcedureImportedDay(event.target.value)
                  : event.target.value
            )
          }
        />
      </label>
    );
  };

  const renderRecordList = (node: AppNode, depth: number) => {
    const tableWritable = canWriteProcedureNode(node.id);
    const fields = getDirectFieldEntries(node, byParent).filter((entry) => canReadProcedureNode(entry.node.id));
    const visibleFields = fields.filter((entry) => entry.showInMasterList);
    const records = readRecords(node);
    const exportDisabled = fields.length === 0 || recordExportingNodeId === node.id;
    const importDisabled = !tableWritable || recordImportingNodeId === node.id;
    const tableViewConfig = buildProcedureTableViewDraft(node, fields);
    const fieldById = new Map(fields.map((entry) => [entry.node.id, entry] as const));
    const groupByField =
      tableViewConfig.groupByFieldId.trim().length > 0
        ? fieldById.get(tableViewConfig.groupByFieldId) ?? null
        : null;
    const infoFields = tableViewConfig.infoFieldIds
      .map((fieldId) => fieldById.get(fieldId) ?? null)
      .filter((entry): entry is ProcedureFieldEntry => entry !== null);
    const matrixRowField =
      tableViewConfig.matrixRowFieldId.trim().length > 0
        ? fieldById.get(tableViewConfig.matrixRowFieldId) ?? null
        : null;
    const matrixColumnFields = tableViewConfig.matrixColumnFieldIds
      .map((fieldId) => fieldById.get(fieldId) ?? null)
      .filter((entry): entry is ProcedureFieldEntry => entry !== null);
    const pivotColumnField =
      tableViewConfig.pivotColumnFieldId.trim().length > 0
        ? fieldById.get(tableViewConfig.pivotColumnFieldId) ?? null
        : null;
    const listExpandedField = resolveProcedureDisplayExpansionField(records, visibleFields.length > 0 ? visibleFields : fields);
    const listDisplayRecords = buildProcedureDisplayRows(records, listExpandedField);
    const listDisplayGroups = buildProcedureDisplayRecordGroups({
      displayRows: listDisplayRecords,
      visibleFields,
      expandedField: listExpandedField
    });
    const matrixDisplayRecords = buildProcedureDisplayRows(
      records,
      resolveProcedureDisplayExpansionField(
        records,
        collectProcedureFieldEntries([groupByField, ...infoFields, matrixRowField, ...matrixColumnFields])
      )
    );
    const pivotDisplayRecords = buildProcedurePivotDisplayRows(records, matrixRowField, pivotColumnField);
    const renderRecordCellContent = (
      entry: ProcedureFieldEntry,
      value: ProcedureRecordValue | undefined,
      options?: {
        compact?: boolean;
        center?: boolean;
        emptyText?: string;
      }
    ) => {
      const compact = options?.compact === true;
      const center = options?.center === true;
      const emptyText = options?.emptyText ?? "Not answered";
      if (entry.type !== "table") {
        if (isEmptyRecordValue(value)) {
          return (
            <div className={`text-[0.84rem] text-[var(--ode-text-muted)] ${center ? "text-center" : ""}`}>
              {emptyText === "" ? "\u00A0" : emptyText}
            </div>
          );
        }
        return (
          <div className={`truncate text-[0.92rem] ${center ? "text-center" : ""}`}>
            {formatSharedProcedureRecordValue(value, entry, procedureDatabaseModel)}
          </div>
        );
      }

      const columns = getTableFieldColumns(entry);
      const filledEntries = getFilledTableFieldEntries(value, columns);
      if (filledEntries.length === 0) {
        return (
          <div className={`text-[0.84rem] text-[var(--ode-text-muted)] ${center ? "text-center" : ""}`}>
            {emptyText === "" ? "\u00A0" : emptyText}
          </div>
        );
      }

      const visibleEntries = filledEntries.slice(0, compact ? 3 : 4);
      return (
        <div className={`flex flex-wrap gap-2 ${center ? "justify-center" : ""}`}>
          {visibleEntries.map((item) => (
            <div
              key={`${entry.node.id}-${item.column}`}
              className={`rounded-[14px] border border-[rgba(95,220,255,0.16)] bg-[rgba(7,39,61,0.46)] px-3 py-2 ${
                compact ? "max-w-[180px] min-w-[112px]" : "max-w-[220px] min-w-[132px]"
              }`}
            >
              <div className="truncate text-[0.64rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                {item.column}
              </div>
              <div className="mt-1 truncate text-[0.88rem] text-[var(--ode-text)]">{item.value}</div>
            </div>
          ))}
          {filledEntries.length > visibleEntries.length ? (
            <div className="inline-flex items-center rounded-[14px] border border-[rgba(95,220,255,0.18)] bg-[rgba(5,29,46,0.7)] px-3 py-2 text-[0.74rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
              +{filledEntries.length - visibleEntries.length}
            </div>
          ) : null}
        </div>
      );
    };
    const renderAdvancedTableView = () => {
      if (!matrixRowField || matrixColumnFields.length === 0) {
        return (
          <div className={`${PROCEDURE_MUTED_CARD_CLASS} border-dashed px-6 py-6 text-[0.94rem]`}>
            Configure a row field and at least one matrix column to use the advanced table layout.
          </div>
        );
      }
      if (matrixDisplayRecords.length === 0) {
        return (
          <div className={`${PROCEDURE_MUTED_CARD_CLASS} border-dashed px-6 py-10 text-center`}>
            No records yet.
          </div>
        );
      }

      const groups = new Map<
        string,
        {
          label: string;
          records: ProcedureDisplayRecordRow[];
          firstRecord: ProcedureDisplayRecordRow;
        }
      >();
      for (const displayRecord of matrixDisplayRecords) {
        const rawGroupValue = groupByField ? displayRecord.values[groupByField.node.id] : undefined;
        const groupKey = groupByField ? serializeRecordValueForGrouping(rawGroupValue) || "__empty__" : "__all__";
        const groupLabel = groupByField
          ? formatProcedureExportCellValue(rawGroupValue, groupByField, procedureDatabaseModel) || "Ungrouped"
          : "";
        const existing = groups.get(groupKey);
        if (existing) {
          existing.records.push(displayRecord);
          continue;
        }
        groups.set(groupKey, {
          label: groupLabel,
          records: [displayRecord],
          firstRecord: displayRecord
        });
      }

      const displayGroups = Array.from(groups.values());
      const sharedInfoFields = infoFields.filter((entry) => entry.node.id !== groupByField?.node.id);

      return (
        <div className="space-y-5">
          {displayGroups.map((group, groupIndex) => (
            <div
              key={`${node.id}-matrix-group-${groupIndex}`}
              className="overflow-hidden rounded-[24px] border border-[var(--ode-border)] bg-[linear-gradient(180deg,rgba(4,26,41,0.9),rgba(2,18,31,0.96))] shadow-[0_18px_48px_rgba(0,0,0,0.26)]"
            >
              {groupByField || sharedInfoFields.length > 0 ? (
                <div className="border-b border-[rgba(95,220,255,0.14)] bg-[rgba(5,31,49,0.72)] px-5 py-4">
                  {groupByField ? (
                    <div className="mb-4">
                      <div className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
                        {groupByField.node.name}
                      </div>
                      <div className="mt-2 text-[1.08rem] font-semibold text-[var(--ode-text)]">
                        {group.label || "Ungrouped"}
                      </div>
                    </div>
                  ) : null}
                  {sharedInfoFields.length > 0 ? (
                    <div className="flex flex-wrap gap-px overflow-hidden rounded-[18px] border border-[rgba(95,220,255,0.14)] bg-[rgba(95,220,255,0.12)]">
                      {sharedInfoFields.map((entry) => (
                        <div
                          key={`${node.id}-${groupIndex}-info-${entry.node.id}`}
                          className="min-w-[180px] flex-1 bg-[rgba(4,24,38,0.84)] px-4 py-3"
                        >
                          <div className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                            {entry.node.name}
                          </div>
                          <div className="mt-2 text-[0.96rem] text-[var(--ode-text)]">
                            {renderRecordCellContent(entry, group.firstRecord.values[entry.node.id], {
                              emptyText: "Not answered"
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[var(--ode-border)] bg-[rgba(7,39,61,0.72)] text-[0.74rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
                      <th rowSpan={2} className="min-w-[280px] px-4 py-3 align-middle">
                        {matrixRowField.node.name}
                      </th>
                      <th colSpan={matrixColumnFields.length} className="px-4 py-3 text-center align-middle">
                        {tableViewConfig.matrixColumnGroupLabel.trim() || "Columns"}
                      </th>
                    </tr>
                    <tr className="border-b border-[var(--ode-border)] bg-[rgba(7,39,61,0.62)] text-[0.74rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
                      {matrixColumnFields.map((entry) => (
                        <th key={`${node.id}-matrix-head-${entry.node.id}`} className="min-w-[120px] px-4 py-3 text-center">
                          {entry.node.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.records.map((displayRecord, index) => {
                      const isSectionRow = matrixColumnFields.every((entry) =>
                        isEmptyRecordValue(displayRecord.values[entry.node.id])
                      );
                      return (
                        <tr
                          key={displayRecord.id}
                          className={`border-b border-[var(--ode-border)] text-[var(--ode-text)] transition ${
                            tableWritable ? "cursor-pointer hover:bg-[rgba(10,58,89,0.28)]" : ""
                          } ${isSectionRow ? "bg-[rgba(8,39,61,0.38)]" : ""}`}
                          role={tableWritable ? "button" : undefined}
                          tabIndex={tableWritable ? 0 : undefined}
                          onClick={() => {
                            if (!tableWritable) return;
                            openExistingRecordEditor(node, displayRecord.sourceRecord);
                          }}
                          onKeyDown={(event) => {
                            if (!tableWritable) return;
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openExistingRecordEditor(node, displayRecord.sourceRecord);
                            }
                          }}
                        >
                          <td
                            className={`px-4 py-3 ${
                              isSectionRow ? "text-[1rem] font-semibold text-[var(--ode-text)]" : "text-[0.94rem]"
                            }`}
                          >
                            {formatProcedureExportCellValue(
                              displayRecord.values[matrixRowField.node.id],
                              matrixRowField,
                              procedureDatabaseModel
                            ) || `Row ${index + 1}`}
                          </td>
                          {isSectionRow ? (
                            <td
                              colSpan={matrixColumnFields.length}
                              className="px-4 py-3 text-[0.84rem] text-[var(--ode-text-muted)]"
                            >
                              &nbsp;
                            </td>
                          ) : (
                            matrixColumnFields.map((entry) => (
                              <td
                                key={`${displayRecord.id}-${entry.node.id}`}
                                className={`px-4 py-3 align-top ${
                                  entry.type === "table" ? "min-w-[220px]" : "min-w-[120px]"
                                }`}
                              >
                                <div className="min-w-0">
                                  {renderRecordCellContent(entry, displayRecord.values[entry.node.id], {
                                    compact: true,
                                    center: entry.type !== "table",
                                    emptyText: ""
                                  })}
                                </div>
                              </td>
                            ))
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      );
    };
    const renderPivotTableView = () => {
      if (!matrixRowField || !pivotColumnField) {
        return (
          <div className={`${PROCEDURE_MUTED_CARD_CLASS} border-dashed px-6 py-6 text-[0.94rem]`}>
            Configure a row field and one source field to build pivot columns.
          </div>
        );
      }
      if (records.length === 0) {
        return (
          <div className={`${PROCEDURE_MUTED_CARD_CLASS} border-dashed px-6 py-10 text-center`}>
            No records yet.
          </div>
        );
      }

      const rowsByKey = new Map<string, { key: string; label: string }>();
      const columnsByKey = new Map<string, { key: string; label: string }>();
      const cellCounts = new Map<string, number>();
      const seenCells = new Set<string>();

      for (const displayRecord of pivotDisplayRecords) {
        const rowLabel =
          formatProcedureExportCellValue(
            displayRecord.values[matrixRowField.node.id],
            matrixRowField,
            procedureDatabaseModel
          ) || "Not answered";
        const rowKey = normalizeProcedureImportKey(rowLabel) || "__empty_row__";
        if (!rowsByKey.has(rowKey)) {
          rowsByKey.set(rowKey, { key: rowKey, label: rowLabel });
        }

        const columnLabel = formatProcedureExportCellValue(
          displayRecord.values[pivotColumnField.node.id],
          pivotColumnField,
          procedureDatabaseModel
        );
        if (!columnLabel) continue;
        const columnKey = normalizeProcedureImportKey(columnLabel);
        if (!columnsByKey.has(columnKey)) {
          columnsByKey.set(columnKey, { key: columnKey, label: columnLabel });
        }

        const seenKey = `${displayRecord.sourceRecord.id}::${rowKey}::${columnKey}`;
        if (seenCells.has(seenKey)) continue;
        seenCells.add(seenKey);

        const countKey = `${rowKey}::${columnKey}`;
        cellCounts.set(countKey, (cellCounts.get(countKey) ?? 0) + 1);
      }

      const orderedRows = Array.from(rowsByKey.values()).sort((left, right) =>
        compareProcedureDisplayLabels(left.label, right.label)
      );
      const orderedColumns = Array.from(columnsByKey.values()).sort((left, right) =>
        compareProcedureDisplayLabels(left.label, right.label)
      );

      if (orderedRows.length === 0 || orderedColumns.length === 0) {
        return (
          <div className={`${PROCEDURE_MUTED_CARD_CLASS} border-dashed px-6 py-10 text-center`}>
            No pivot values found yet.
          </div>
        );
      }

      return (
        <div className={PROCEDURE_TABLE_SHELL_CLASS}>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--ode-border)] bg-[rgba(7,39,61,0.72)] text-[0.74rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
                  <th rowSpan={2} className="min-w-[280px] px-4 py-3 align-middle">
                    {matrixRowField.node.name}
                  </th>
                  <th colSpan={orderedColumns.length} className="px-4 py-3 text-center align-middle">
                    {tableViewConfig.matrixColumnGroupLabel.trim() || "Columns"}
                  </th>
                </tr>
                <tr className="border-b border-[var(--ode-border)] bg-[rgba(7,39,61,0.62)] text-[0.74rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
                  {orderedColumns.map((column) => (
                    <th key={`${node.id}-pivot-head-${column.key}`} className="min-w-[120px] px-4 py-3 text-center">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orderedRows.map((row) => (
                  <tr key={`${node.id}-pivot-row-${row.key}`} className="border-b border-[var(--ode-border)] text-[var(--ode-text)]">
                    <td className="px-4 py-3 text-[0.94rem]">{row.label}</td>
                    {orderedColumns.map((column) => {
                      const count = cellCounts.get(`${row.key}::${column.key}`) ?? 0;
                      return (
                        <td
                          key={`${node.id}-pivot-cell-${row.key}-${column.key}`}
                          className="min-w-[120px] px-4 py-3 text-center text-[0.94rem]"
                        >
                          {count > 0 ? count : "\u00A0"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    };
    return (
      <div className={depth === 0 ? "space-y-4" : "mt-5 space-y-4"}>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <OdeTooltip
            label={tableWritable ? `Import ${node.name} from Excel` : "The active role cannot edit this table"}
          >
            <button
              type="button"
              className={`${PROCEDURE_ICON_BUTTON_CLASS} h-11 w-11 rounded-[18px] disabled:cursor-not-allowed disabled:opacity-60`}
              disabled={importDisabled}
              onClick={() => {
                void handleImportRecordTable(node);
              }}
              aria-label={`Import ${node.name} from Excel`}
            >
              <ImportGlyphSmall />
            </button>
          </OdeTooltip>
          <OdeTooltip
            label={
              fields.length > 0
                ? records.length > 0
                  ? `Export ${node.name} to Excel`
                  : `Export an empty template for ${node.name}`
                : `Add fields to ${node.name} before exporting`
            }
          >
            <button
              type="button"
              className={`${PROCEDURE_ICON_BUTTON_CLASS} h-11 w-11 rounded-[18px] disabled:cursor-not-allowed disabled:opacity-60`}
              disabled={exportDisabled}
              onClick={() => {
                void handleExportRecordTable(node);
              }}
              aria-label={`Export ${node.name} to Excel`}
            >
              <ExportGlyphSmall />
            </button>
          </OdeTooltip>
          <OdeTooltip
            label={
              fields.length > 0
                ? `Configure the table layout for ${node.name}`
                : `Add fields to ${node.name} before configuring the layout`
            }
          >
            <button
              type="button"
              className={`${PROCEDURE_ICON_BUTTON_CLASS} h-11 w-11 rounded-[18px] disabled:cursor-not-allowed disabled:opacity-60`}
              disabled={fields.length === 0}
              onClick={() => {
                openTableViewEditor(node);
              }}
              aria-label={`Configure the table layout for ${node.name}`}
            >
              <EditGlyphSmall />
            </button>
          </OdeTooltip>
          <OdeTooltip
            label={
              fields.length > 0
                ? `Open field settings for ${node.name}`
                : `Open field settings for ${node.name}`
            }
          >
            <button
              type="button"
              className={`${PROCEDURE_ICON_BUTTON_CLASS} h-11 w-11 rounded-[18px]`}
              onClick={() => {
                if (onOpenFieldOrderWindow) {
                  void onOpenFieldOrderWindow(node.id);
                  return;
                }
                openFieldOrderEditor(node);
              }}
              aria-label={`Open field settings for ${node.name}`}
            >
              <ListBulletsGlyphSmall />
            </button>
          </OdeTooltip>
          <OdeTooltip
            label={tableWritable ? `Add a record to ${node.name}` : "The active role cannot edit this table"}
          >
            <button
              type="button"
              className={`${PROCEDURE_ICON_BUTTON_CLASS} h-11 w-11 rounded-[18px] disabled:cursor-not-allowed disabled:opacity-60`}
              disabled={!tableWritable}
              onClick={() => openNewRecordEditor(node)}
              aria-label={`Add a record to ${node.name}`}
            >
              <PlusGlyphSmall />
            </button>
          </OdeTooltip>
        </div>

        {tableViewConfig.viewMode === "matrix" ? (
          renderAdvancedTableView()
        ) : tableViewConfig.viewMode === "pivot" ? (
          renderPivotTableView()
        ) : (
          <>
            {visibleFields.length === 0 ? (
              <div className={`${PROCEDURE_MUTED_CARD_CLASS} border-dashed px-5 py-4 text-[0.94rem]`}>
                All fields are hidden from the master list. Records still open from the row.
              </div>
            ) : null}

            {listDisplayRecords.length === 0 ? (
              <div className={`${PROCEDURE_MUTED_CARD_CLASS} border-dashed px-6 py-10 text-center`}>
                No records yet.
              </div>
            ) : (
              <div className={PROCEDURE_TABLE_SHELL_CLASS}>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-[var(--ode-border)] bg-[rgba(7,39,61,0.72)] text-[0.74rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
                        <th className="px-4 py-3">Row</th>
                        {visibleFields.map((entry) => (
                          <th key={`head-${node.id}-${entry.node.id}`} className="px-4 py-3 whitespace-nowrap">
                            {entry.node.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {listDisplayGroups.flatMap((group) =>
                        group.rows.map((displayRecord, rowIndex) => {
                          const rowSpan = group.rows.length;
                          const isGroupStartRow = rowIndex === 0;
                          const showMergedCells = Boolean(listExpandedField) && rowSpan > 1;
                          return (
                            <tr
                              key={displayRecord.id}
                              className={`border-b border-[var(--ode-border)] text-[var(--ode-text)] transition ${
                                tableWritable ? "cursor-pointer hover:bg-[rgba(10,58,89,0.3)]" : ""
                              }`}
                              role={tableWritable ? "button" : undefined}
                              tabIndex={tableWritable ? 0 : undefined}
                              onClick={() => {
                                if (!tableWritable) return;
                                openExistingRecordEditor(node, displayRecord.sourceRecord);
                              }}
                              onKeyDown={(event) => {
                                if (!tableWritable) return;
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  openExistingRecordEditor(node, displayRecord.sourceRecord);
                                }
                              }}
                            >
                              {showMergedCells && !isGroupStartRow ? null : (
                                <td
                                  rowSpan={showMergedCells ? rowSpan : undefined}
                                  className="whitespace-nowrap px-4 py-3 align-top text-[0.84rem] font-medium text-[var(--ode-text-muted)]"
                                >
                                  {group.displayIndex}
                                </td>
                              )}
                              {visibleFields.map((entry) => {
                                const mergeFieldCell =
                                  showMergedCells && listExpandedField !== null && entry.node.id !== listExpandedField.node.id;
                                if (mergeFieldCell && !isGroupStartRow) {
                                  return null;
                                }
                                const cellValue = mergeFieldCell
                                  ? group.representativeRow.values[entry.node.id]
                                  : displayRecord.values[entry.node.id];
                                return (
                                  <td
                                    key={`${displayRecord.id}-${entry.node.id}`}
                                    rowSpan={mergeFieldCell ? rowSpan : undefined}
                                    className={`px-4 py-3 align-top ${
                                      entry.type === "table" ? "min-w-[320px]" : "max-w-[240px]"
                                    }`}
                                  >
                                    <div className="min-w-0">{renderRecordCellContent(entry, cellValue)}</div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const connectedTextClass =
    "inline border-none bg-transparent p-0 align-baseline text-left text-[0.98em] italic text-[#2563eb] underline decoration-[rgba(37,99,235,0.35)] underline-offset-4 transition hover:text-[#1d4ed8]";

  const renderSectionInlineTokens = (text: string, keyPrefix: string): ReactNode[] => {
    return parseProcedureInlineTokens(text).map((token, tokenIndex) => {
      const tokenKey = `${keyPrefix}-${tokenIndex}`;
      if (token.type === "text") {
        return <Fragment key={tokenKey}>{token.value}</Fragment>;
      }
      if (token.type === "bold") {
        return (
          <strong key={tokenKey} className="font-semibold text-[#111827]">
            {token.value}
          </strong>
        );
      }
      if (token.type === "italic") {
        return (
          <em key={tokenKey} className="italic text-[#111827]">
            {token.value}
          </em>
        );
      }
      if (token.type === "node_link") {
        const linkedNode = globalNodeById.get(token.nodeId) ?? null;
        const linkedNodeReadable = linkedNode ? canReadProcedureNode(linkedNode.id) : false;
        const workspaceRootId = linkedNode ? findProcedureWorkspaceRootId(linkedNode.id, globalNodeById, workspaceRootIdSet) : null;
        const linkedWorkspaceName = resolveWorkspaceDisplayName(
          workspaceRootId,
          projectByRootId,
          globalNodeById,
          workspaceName
        );
        const label =
          linkedNode?.type === "file"
            ? resolveProcedureFileLinkLabel(token.label, linkedNode.name)
            : token.label || linkedNode?.name || "Linked node";
        return (
          <OdeTooltip key={tokenKey} label={linkedWorkspaceName}>
            <button
              type="button"
              className={`${connectedTextClass} ${
                linkedNode && linkedNodeReadable
                  ? ""
                  : "cursor-not-allowed text-[#b98585] decoration-[rgba(185,133,133,0.42)]"
              }`}
              disabled={!linkedNode || !linkedNodeReadable}
              onClick={(event) => {
                event.stopPropagation();
                if (!linkedNode || !linkedNodeReadable) return;
                if (linkedNode.type === "file") {
                  void onOpenLinkedFile(linkedNode.id);
                  return;
                }
                openLinkedProcedureNode(linkedNode, "saved");
              }}
            >
              {label}
            </button>
          </OdeTooltip>
        );
      }
      if (token.type === "record_link") {
        const targetTable = procedureDatabaseModel.tablesById.get(token.tableNodeId) ?? null;
        const targetRecord = targetTable?.records.find((record) => record.id === token.recordId) ?? null;
        const linkedRecordReadable = Boolean(targetTable && targetRecord && canReadProcedureNode(targetTable.node.id));
        const workspaceRootId = targetTable
          ? findProcedureWorkspaceRootId(targetTable.node.id, globalNodeById, workspaceRootIdSet)
          : null;
        const linkedWorkspaceName = resolveWorkspaceDisplayName(
          workspaceRootId,
          projectByRootId,
          globalNodeById,
          workspaceName
        );
        const label = token.label || targetRecord?.id || "Linked record";
        return (
          <OdeTooltip key={tokenKey} label={linkedWorkspaceName}>
            <button
              type="button"
              className={`${connectedTextClass} ${
                linkedRecordReadable
                  ? ""
                  : "cursor-not-allowed text-[#b98585] decoration-[rgba(185,133,133,0.42)]"
              }`}
              disabled={!linkedRecordReadable}
              onClick={(event) => {
                event.stopPropagation();
                if (!targetTable || !targetRecord || !linkedRecordReadable) return;
                openLinkedRecord(targetTable.node.id, targetRecord.id);
              }}
            >
              {label}
            </button>
          </OdeTooltip>
        );
      }
      if (token.type === "image_link") {
        const linkedNode = globalNodeById.get(token.nodeId) ?? null;
        const linkedNodeReadable = linkedNode ? canReadProcedureNode(linkedNode.id) : false;
        const previewSrc = resolveProcedureImagePreviewSrc(linkedNode);
        const imageLabel =
          token.alt ||
          (linkedNode ? getProcedureFileDisplayTitle(linkedNode.name) : "Image");
        if (!linkedNode || !previewSrc || !linkedNodeReadable) {
          return (
            <OdeTooltip key={tokenKey} label={imageLabel}>
              <button
                type="button"
                className={`${connectedTextClass} ${
                  linkedNode && linkedNodeReadable
                    ? ""
                    : "cursor-not-allowed text-[#b98585] decoration-[rgba(185,133,133,0.42)]"
                }`}
                disabled={!linkedNode || !linkedNodeReadable}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!linkedNode || !linkedNodeReadable) return;
                  void onOpenLinkedFile(linkedNode.id);
                }}
              >
                {imageLabel}
              </button>
            </OdeTooltip>
          );
        }
        return (
          <OdeTooltip key={tokenKey} label={imageLabel}>
            <button
              type="button"
              className="my-1 inline-flex align-middle"
              onClick={(event) => {
                event.stopPropagation();
                void onReviewNodeFile(linkedNode.id);
              }}
            >
              <img
                src={previewSrc}
                alt={imageLabel}
                className="inline-block max-h-[160px] max-w-[220px] rounded-[14px] border border-[#d6dde6] object-cover shadow-[0_12px_28px_rgba(15,23,42,0.16)]"
                draggable={false}
              />
            </button>
          </OdeTooltip>
        );
      }
      if (token.type === "app_link") {
        const label = token.label || token.appName || "App";
        return (
          <OdeTooltip key={tokenKey} label={token.appName || label}>
            <button
              type="button"
              className="inline-flex items-center align-middle"
              onClick={(event) => {
                event.stopPropagation();
                void onLaunchLinkedApp({
                  id: token.appId ?? `procedure-app-${tokenIndex}`,
                  label: token.appName || label,
                  kind: token.kind,
                  target: token.target,
                  iconKey: token.iconKey ?? "auto",
                  customIconDataUrl: token.customIconDataUrl ?? null
                });
              }}
            >
              {renderProcedureAppLinkBadgeNode({
                label: token.appName || label,
                kind: token.kind,
                target: token.target,
                iconKey: token.iconKey ?? null,
                customIconDataUrl: token.customIconDataUrl ?? null
              })}
            </button>
          </OdeTooltip>
        );
      }
      return (
        <OdeTooltip key={tokenKey} label={token.href}>
          <button
            type="button"
            className={connectedTextClass}
            onClick={(event) => {
              event.stopPropagation();
              void onOpenWebsiteLink(token.href);
            }}
          >
            {token.label}
          </button>
        </OdeTooltip>
      );
    });
  };

  const renderSectionContent = (text: string, keyPrefix: string): ReactNode => {
    return parseProcedureBlocks(text).map((block, blockIndex) => {
      const blockKey = `${keyPrefix}-block-${blockIndex}`;
      if (block.type === "heading") {
        return (
          <div key={blockKey} className={resolveProcedureContentHeadingClasses(block.level)}>
            {renderSectionInlineTokens(block.text, `${blockKey}-heading`)}
          </div>
        );
      }
      if (block.type === "bullets") {
        return (
          <ul key={blockKey} className="ml-5 list-disc space-y-1 text-[0.98rem] leading-7 text-[#334155]">
            {block.items.map((item, itemIndex) => (
              <li key={`${blockKey}-bullet-${itemIndex}`}>
                {renderSectionInlineTokens(item, `${blockKey}-bullet-${itemIndex}`)}
              </li>
            ))}
          </ul>
        );
      }
      if (block.type === "numbers") {
        return (
          <ol key={blockKey} className="ml-5 list-decimal space-y-1 text-[0.98rem] leading-7 text-[#334155]">
            {block.items.map((item, itemIndex) => (
              <li key={`${blockKey}-number-${itemIndex}`}>
                {renderSectionInlineTokens(item, `${blockKey}-number-${itemIndex}`)}
              </li>
            ))}
          </ol>
        );
      }
      if (block.type === "quote") {
        return (
          <blockquote
            key={blockKey}
            className="rounded-[16px] border border-[#d6dde6] bg-[#f8fafc] px-5 py-4 italic text-[#334155]"
          >
            {block.lines.map((line, lineIndex) => (
              <Fragment key={`${blockKey}-quote-${lineIndex}`}>
                {lineIndex > 0 ? <br /> : null}
                {renderSectionInlineTokens(line, `${blockKey}-quote-${lineIndex}`)}
              </Fragment>
            ))}
          </blockquote>
        );
      }
      if (block.type === "code") {
        return (
          <pre
            key={blockKey}
            className="overflow-x-auto rounded-[14px] border border-[#cbd5e1] bg-[#0f172a] px-4 py-3 font-mono text-[0.84rem] leading-6 text-[#e2e8f0]"
          >
            <code>{block.code}</code>
          </pre>
        );
      }
      if (block.type === "divider") {
        return <div key={blockKey} className="h-px bg-[#d6dde6]" />;
      }
      if (block.type === "page_break") {
        return <div key={blockKey} className="my-10 border-t-2 border-dashed border-[#38bdf8]" />;
      }
      if (block.type === "insight") {
        return (
          <div
            key={blockKey}
            className="rounded-[16px] border border-[#d6dde6] bg-[#f8fafc] px-5 py-4 text-[#334155]"
          >
            {block.lines.map((line, lineIndex) => (
              <p key={`${blockKey}-insight-${lineIndex}`} className={lineIndex > 0 ? "mt-2" : ""}>
                {renderSectionInlineTokens(line, `${blockKey}-insight-${lineIndex}`)}
              </p>
            ))}
          </div>
        );
      }
      return (
        <p key={blockKey} className="text-[0.98rem] leading-7 text-[#334155]">
          {block.lines.map((line, lineIndex) => (
            <Fragment key={`${blockKey}-paragraph-${lineIndex}`}>
              {lineIndex > 0 ? <br /> : null}
              {renderSectionInlineTokens(line, `${blockKey}-paragraph-${lineIndex}`)}
            </Fragment>
          ))}
        </p>
      );
    });
  };

  const renderSectionDocumentBody = (node: AppNode, keyPrefix: string): ReactNode => {
    const richTextHtml = readProcedureRichTextHtml(node);
    const hasPlainContent = Boolean((node.content ?? "").trim());
    if (!richTextHtml && !hasPlainContent) return null;

    return (
      <div
        className={PROCEDURE_RICH_DOCUMENT_CLASS}
        style={{
          ...procedureWorkspaceRichDocumentStyle,
          ...resolveSectionTextAlignmentStyle(readSectionTextAlignment(node)),
          caretColor: sectionEditorFormattingDefaults.textColor
        }}
        onClick={handleSavedSectionDocumentClick}
      >
        {richTextHtml ? (
          <div dangerouslySetInnerHTML={{ __html: richTextHtml }} />
        ) : (
          <div className="space-y-4">{renderSectionContent(node.content ?? "", keyPrefix)}</div>
        )}
      </div>
    );
  };

  const renderSectionNode = (node: AppNode, depth: number) => {
    const nodeReadable = canReadProcedureNode(node.id);
    const nodeWritable = canWriteProcedureNode(node.id);
    const sectionChildren = getDirectSectionChildren(node, byParent);
    const annexFiles = nodeReadable
      ? getDirectFileChildren(node, byParent)
          .filter((reference) => canReadProcedureNode(reference.id))
          .filter((reference) => getDesktopMediaPreviewKind(reference) !== "image")
      : [];
    const directFields = nodeReadable
      ? getDirectFieldEntries(node, byParent).filter((entry) => canReadProcedureNode(entry.node.id))
      : [];
    const hasText =
      nodeReadable && Boolean((node.description ?? "").trim().length > 0 || (node.content ?? "").trim().length > 0);
    const sectionNumber = procedureScopedNumbering.get(node.id) ?? "";
    const sectionSelected = selectedNode?.id === node.id;
    const treeIndent = resolveSectionTreeIndent(depth);
    const treeConnectorLeft = Math.max(12, treeIndent - 16);
    const sectionTitle = resolveNodeTitle(node);
    const sectionTitleLevel = resolveProcedureSectionTitleLevel(node.id, rootNode?.id ?? null, globalNodeById);
    const sectionTitleStyle = buildSectionEditorTitleTextStyle(
      buildSectionEditorTitleStyleFromDefaults(
        sectionEditorTitleLevelDefaults[sectionTitleLevel] ?? buildDefaultSectionEditorTitleDefaults(sectionTitleLevel)
      )
    );
    const siblingSections =
      node.parentId && node.parentId !== ROOT_PARENT_ID
        ? (byParent.get(node.parentId) ?? []).filter((child) => child.type !== "file" && !isProcedureFieldNode(child))
        : [];
    const sectionSiblingIndex = siblingSections.findIndex((child) => child.id === node.id);
    const canMoveSectionUp = nodeWritable && sectionSiblingIndex > 0;
    const canMoveSectionDown =
      nodeWritable && sectionSiblingIndex >= 0 && sectionSiblingIndex < siblingSections.length - 1;
    const sectionDocumentBody = renderSectionDocumentBody(node, `section-${node.id}`);

    const annexBlock =
      nodeReadable && annexFiles.length > 0 ? (
        <div
          className={
            depth === 0
              ? "rounded-[24px] border border-[var(--ode-border)] bg-[rgba(5,29,46,0.6)] px-6 py-5 shadow-[0_14px_36px_rgba(0,0,0,0.18)]"
              : "mt-5 rounded-[20px] border border-[var(--ode-border)] bg-[rgba(5,29,46,0.56)] px-5 py-4"
          }
        >
          <div className="text-[0.74rem] uppercase tracking-[0.18em] text-[var(--ode-text-muted)]">
            {annexFiles.length === 1 ? "Annex" : "Annexes"}
          </div>
          <div className="mt-3 space-y-3">
            {annexFiles.map((reference) => {
              const referenceWorkspaceRootId = findProcedureWorkspaceRootId(reference.id, globalNodeById, workspaceRootIdSet);
              const referenceWorkspaceName = resolveWorkspaceDisplayName(
                referenceWorkspaceRootId,
                projectByRootId,
                globalNodeById,
                workspaceName
              );
              const attachmentTitle = getProcedureFileDisplayTitle(reference.name);
              return (
                <div
                  key={reference.id}
                  className={PROCEDURE_FILE_ROW_CLASS}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className={PROCEDURE_FILE_ICON_CLASS}>
                      <FileGlyphSmall />
                    </div>
                    <div className="min-w-0">
                      <OdeTooltip label={referenceWorkspaceName}>
                        <button
                          type="button"
                          className="ode-wrap-text text-left text-[0.98rem] font-medium text-[var(--ode-text)] transition hover:text-[var(--ode-accent)]"
                          onClick={() => {
                            onReviewNodeFile(reference.id);
                          }}
                        >
                          {attachmentTitle}
                        </button>
                      </OdeTooltip>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={PROCEDURE_SECONDARY_TEXT_BUTTON_CLASS}
                    onClick={() => {
                      void onOpenLinkedFile(reference.id);
                    }}
                  >
                    Open
                    </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null;

    if (!nodeReadable) {
      const restrictedContent = (
        <div className="rounded-[20px] border border-dashed border-[rgba(217,179,96,0.42)] bg-[rgba(87,58,19,0.18)] px-5 py-4 text-[0.94rem] text-[rgba(255,224,168,0.92)]">
          Restricted for the active role.
        </div>
      );

      if (depth === 0) {
        return (
          <div key={node.id} className="space-y-8">
            {restrictedContent}
            {sectionChildren.length > 0 ? (
              <div className="space-y-0">{sectionChildren.map((child) => renderSectionNode(child, depth + 1))}</div>
            ) : null}
          </div>
        );
      }

      return (
        <section
          key={node.id}
          className="relative pt-6"
          style={depth > 0 ? { paddingLeft: `${treeIndent}px` } : undefined}
        >
          {depth > 0 ? (
            <>
              <div
                className="pointer-events-none absolute bottom-0 top-0 w-px bg-[var(--ode-border)]"
                style={{ left: `${treeConnectorLeft}px` }}
              />
              <div
                className="pointer-events-none absolute h-px bg-[var(--ode-border-strong)]"
                style={{ left: `${treeConnectorLeft}px`, top: "2.35rem", width: "15px" }}
              />
              <div
                className="pointer-events-none absolute h-2.5 w-2.5 rounded-full border border-[rgba(217,179,96,0.55)] bg-[rgba(183,132,49,0.85)] shadow-[0_0_0_4px_rgba(4,23,39,0.88)]"
                style={{ left: `${treeConnectorLeft - 4}px`, top: "2.05rem" }}
              />
            </>
          ) : null}
          <div className={resolveSectionCardClasses(sectionSelected)}>
              <div className="flex min-w-0 items-center gap-3">
                {sectionNumber ? <span className={resolveSectionNumberBadgeClasses(sectionSelected)}>{sectionNumber}</span> : null}
              <div className={`${resolveHeadingClasses(depth)} min-w-0 flex-1 truncate`} style={sectionTitleStyle}>{sectionTitle || "\u00A0"}</div>
              <span className="rounded-full border border-[rgba(217,179,96,0.42)] bg-[rgba(87,58,19,0.22)] px-2.5 py-0.5 text-[0.72rem] uppercase tracking-[0.08em] text-[rgba(255,224,168,0.92)]">
                Restricted
              </span>
            </div>
            <div className="mt-4">{restrictedContent}</div>
            {sectionChildren.length > 0 ? (
              <div className="mt-6 space-y-0">{sectionChildren.map((child) => renderSectionNode(child, depth + 1))}</div>
            ) : null}
          </div>
        </section>
      );
    }

    if (depth === 0) {
      return (
        <div key={node.id} className="space-y-8">
          {hasText ? (
            <div className="px-2 pb-2">
              {node.description ? <div className="text-[1rem] text-[var(--ode-text-muted)]">{node.description}</div> : null}
              {sectionDocumentBody ? <div className="mt-4">{sectionDocumentBody}</div> : null}
            </div>
          ) : null}

          {annexBlock}

          {directFields.length > 0 ? renderRecordList(node, depth) : null}

          {sectionChildren.length > 0 ? (
            <div className="space-y-0">{sectionChildren.map((child) => renderSectionNode(child, depth + 1))}</div>
          ) : null}
        </div>
      );
    }

    return (
      <section
        key={node.id}
        data-procedure-node-id={node.id}
        className="relative pt-6"
        style={depth > 0 ? { paddingLeft: `${treeIndent}px` } : undefined}
      >
        {depth > 0 ? (
          <>
            <div
              className="pointer-events-none absolute bottom-0 top-0 w-px bg-[var(--ode-border)]"
              style={{ left: `${treeConnectorLeft}px` }}
            />
            <div
              className="pointer-events-none absolute h-px bg-[var(--ode-border-strong)]"
              style={{ left: `${treeConnectorLeft}px`, top: "2.35rem", width: "15px" }}
            />
            <div
              className="pointer-events-none absolute h-2.5 w-2.5 rounded-full border border-[var(--ode-border-accent)] bg-[rgba(17,118,174,0.82)] shadow-[0_0_0_4px_rgba(4,23,39,0.88)]"
              style={{ left: `${treeConnectorLeft - 4}px`, top: "2.05rem" }}
            />
          </>
        ) : null}
        <div className={resolveSectionCardClasses(sectionSelected)}>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => onSelectNode(node.id)}
              onDoubleClick={() => {
                if (!nodeWritable) return;
                openSectionEditor(node, {
                  focusTarget: "label"
                });
              }}
              aria-label={`Select ${node.name}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                {sectionNumber ? <span className={resolveSectionNumberBadgeClasses(sectionSelected)}>{sectionNumber}</span> : null}
                <div className={`${resolveHeadingClasses(depth)} min-w-0 flex-1 truncate`} style={sectionTitleStyle}>{sectionTitle || "\u00A0"}</div>
              </div>
            </button>
            <OdeTooltip label="Add field">
              <button
                type="button"
                className={`${PROCEDURE_ICON_BUTTON_SMALL_CLASS} h-9 w-9 disabled:cursor-not-allowed disabled:opacity-60`}
                disabled={!nodeWritable}
                onClick={() => {
                  void createSectionField(node.id);
                }}
                aria-label="Add field"
              >
                <DatabaseFieldGlyph />
              </button>
            </OdeTooltip>
            {siblingSections.length > 1 ? (
              <>
                <OdeTooltip label={`Move ${sectionTitle || "section"} up`}>
                  <button
                    type="button"
                    className={`${PROCEDURE_ICON_BUTTON_SMALL_CLASS} h-9 w-9 disabled:cursor-not-allowed disabled:opacity-50`}
                    disabled={!canMoveSectionUp}
                    onClick={() => {
                      if (!canMoveSectionUp || !onMoveProcedureNode) return;
                      void onMoveProcedureNode(node.id, "up");
                    }}
                    aria-label={`Move ${sectionTitle || "section"} up`}
                  >
                    <ArrowUpGlyphSmall />
                  </button>
                </OdeTooltip>
                <OdeTooltip label={`Move ${sectionTitle || "section"} down`}>
                  <button
                    type="button"
                    className={`${PROCEDURE_ICON_BUTTON_SMALL_CLASS} h-9 w-9 disabled:cursor-not-allowed disabled:opacity-50`}
                    disabled={!canMoveSectionDown}
                    onClick={() => {
                      if (!canMoveSectionDown || !onMoveProcedureNode) return;
                      void onMoveProcedureNode(node.id, "down");
                    }}
                    aria-label={`Move ${sectionTitle || "section"} down`}
                  >
                    <ArrowDownGlyphSmall />
                  </button>
                </OdeTooltip>
              </>
            ) : null}
          </div>
          {node.description ? <div className="mt-3 text-[0.98rem] text-[var(--ode-text-muted)]">{node.description}</div> : null}
          {sectionDocumentBody ? <div className="mt-4">{sectionDocumentBody}</div> : null}
          {annexBlock}
          {directFields.length > 0 ? renderRecordList(node, depth) : null}
          {sectionChildren.length > 0 ? (
            <div className="mt-6 space-y-0">{sectionChildren.map((child) => renderSectionNode(child, depth + 1))}</div>
          ) : null}
        </div>
      </section>
    );
  };

  if (!rootNode) {
    return (
      <section className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div className="rounded-[28px] border border-[var(--ode-border)] bg-[rgba(4,23,39,0.74)] px-6 py-8 text-center text-[var(--ode-text-muted)] shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
          Select a folder to build a procedure.
        </div>
      </section>
    );
  }

  const runSectionEditorContextMenuAction = (
    action: (
      menuState: SectionEditorContextMenuState | null
    ) => void | boolean | Promise<void> | Promise<boolean>
  ) => {
    const menuState = sectionEditorContextMenuStateRef.current;
    if (menuState?.target === "label") {
      restoreSectionEditorContextMenuTitleSelection(menuState);
    } else if (menuState?.target === "content") {
      restoreSectionEditorContextMenuContentSelection(menuState);
    }
    closeSectionEditorContextMenu();
    void Promise.resolve(action(menuState)).catch(() => {
      setNotice("The editor action could not be completed.");
    });
  };

  const sectionEditorContextMenuItems: SectionEditorContextMenuItem[] = (() => {
    if (!sectionEditorContextMenu) return [];
    if (sectionEditorContextMenu.target === "label") {
      return [
        {
          kind: "action",
          key: "label-undo",
          label: "Undo",
          disabled: !sectionEditorWritable || !sectionEditorCanUndo,
          shortcutLabel: "Ctrl+Z",
          onSelect: () => runSectionEditorContextMenuAction(() => applySectionEditorHistoryStep("undo"))
        },
        {
          kind: "action",
          key: "label-redo",
          label: "Redo",
          disabled: !sectionEditorWritable || !sectionEditorCanRedo,
          shortcutLabel: "Ctrl+Y",
          onSelect: () => runSectionEditorContextMenuAction(() => applySectionEditorHistoryStep("redo"))
        },
        { kind: "separator", key: "label-edit-separator" },
        {
          kind: "action",
          key: "label-cut",
          label: "Cut",
          disabled: !sectionEditorWritable || !sectionEditorContextMenu.hasSelection,
          shortcutLabel: "Ctrl+X",
          onSelect: () => {
            runSectionEditorContextMenuAction(async (menuState) => {
              if (!(await cutSectionEditorTitleSelection(menuState))) {
                setNotice("Select title text to cut.");
              }
            });
          }
        },
        {
          kind: "action",
          key: "label-copy",
          label: "Copy",
          disabled: !sectionEditorContextMenu.hasSelection,
          shortcutLabel: "Ctrl+C",
          onSelect: () => {
            runSectionEditorContextMenuAction(async (menuState) => {
              if (!(await copySectionEditorTitleSelection(menuState))) {
                setNotice("Select title text to copy.");
              }
            });
          }
        },
        {
          kind: "action",
          key: "label-paste",
          label: "Paste",
          disabled: !sectionEditorWritable,
          shortcutLabel: "Ctrl+V",
          onSelect: () => {
            runSectionEditorContextMenuAction(async (menuState) => {
              if (!(await pasteSectionEditorTitleClipboard(menuState))) {
                setNotice("Clipboard text is not available.");
              }
            });
          }
        },
        {
          kind: "action",
          key: "label-paste-plain",
          label: "Paste as plain text",
          disabled: !sectionEditorWritable,
          shortcutLabel: "Ctrl+Shift+V",
          onSelect: () => {
            runSectionEditorContextMenuAction(async (menuState) => {
              if (!(await pasteSectionEditorTitleClipboard(menuState))) {
                setNotice("Clipboard text is not available.");
              }
            });
          }
        },
        { kind: "separator", key: "label-selection-separator" },
        {
          kind: "action",
          key: "label-select-all",
          label: "Select all",
          shortcutLabel: "Ctrl+A",
          onSelect: () => runSectionEditorContextMenuAction(() => selectAllSectionEditorTitle())
        }
      ];
    }

    const items: SectionEditorContextMenuItem[] = [
      {
        kind: "action",
        key: "content-undo",
        label: "Undo",
        disabled: !sectionEditorWritable || !sectionEditorCanUndo,
        shortcutLabel: "Ctrl+Z",
        onSelect: () => runSectionEditorContextMenuAction(() => applySectionEditorHistoryStep("undo"))
      },
      {
        kind: "action",
        key: "content-redo",
        label: "Redo",
        disabled: !sectionEditorWritable || !sectionEditorCanRedo,
        shortcutLabel: "Ctrl+Y",
        onSelect: () => runSectionEditorContextMenuAction(() => applySectionEditorHistoryStep("redo"))
      },
      { kind: "separator", key: "content-edit-separator" },
      {
        kind: "action",
        key: "content-cut",
        label: "Cut",
        disabled: !sectionEditorWritable || !sectionEditorContextMenu.hasSelection,
        shortcutLabel: "Ctrl+X",
        onSelect: () => {
          runSectionEditorContextMenuAction(async (menuState) => {
            if (!(await cutSectionEditorContentSelection(menuState))) {
              setNotice("Select text to cut.");
            }
          });
        }
      },
      {
        kind: "action",
        key: "content-copy",
        label: "Copy",
        disabled: !sectionEditorContextMenu.hasSelection,
        shortcutLabel: "Ctrl+C",
        onSelect: () => {
          runSectionEditorContextMenuAction(async (menuState) => {
            if (!(await copySectionEditorContentSelection(menuState))) {
              setNotice("Select text to copy.");
            }
          });
        }
      },
      {
        kind: "action",
        key: "content-paste",
        label: "Paste",
        disabled: !sectionEditorWritable,
        shortcutLabel: "Ctrl+V",
        onSelect: () => {
          runSectionEditorContextMenuAction(async (menuState) => {
            if (!(await pasteSectionEditorContentClipboard({ menuState }))) {
              setNotice("Clipboard content is not available.");
            }
          });
        }
      },
      {
        kind: "action",
        key: "content-paste-plain",
        label: "Paste as plain text",
        disabled: !sectionEditorWritable,
        shortcutLabel: "Ctrl+Shift+V",
        onSelect: () => {
          runSectionEditorContextMenuAction(async (menuState) => {
            if (!(await pasteSectionEditorContentClipboard({ menuState, plainTextOnly: true }))) {
              setNotice("Clipboard text is not available.");
            }
          });
        }
      },
      { kind: "separator", key: "content-format-separator" },
      {
        kind: "action",
        key: "content-bold",
        label: "Bold",
        disabled: !sectionEditorWritable,
        shortcutLabel: "Ctrl+B",
        onSelect: () => runSectionEditorContextMenuAction(() => applySectionEditorCommand("bold"))
      },
      {
        kind: "action",
        key: "content-italic",
        label: "Italic",
        disabled: !sectionEditorWritable,
        shortcutLabel: "Ctrl+I",
        onSelect: () => runSectionEditorContextMenuAction(() => applySectionEditorCommand("italic"))
      },
      {
        kind: "action",
        key: "content-clear-formatting",
        label: "Clear formatting",
        disabled:
          !sectionEditorWritable ||
          (!sectionEditorContextMenu.hasSelection && !sectionEditorContextMenu.insideLink),
        onSelect: () => runSectionEditorContextMenuAction((menuState) => clearSectionEditorFormattingAtSelection(menuState))
      },
      { kind: "separator", key: "content-structure-separator" },
      {
        kind: "action",
        key: "content-quote",
        label: "Quote on/off",
        disabled: !sectionEditorWritable,
        onSelect: () => runSectionEditorContextMenuAction(() => toggleSectionEditorQuoteBlock())
      },
      {
        kind: "action",
        key: "content-bullets",
        label: "Bulleted list",
        disabled: !sectionEditorWritable,
        onSelect: () => runSectionEditorContextMenuAction(() => applySectionEditorCommand("insertUnorderedList"))
      },
      {
        kind: "action",
        key: "content-numbers",
        label: "Numbered list",
        disabled: !sectionEditorWritable,
        onSelect: () => runSectionEditorContextMenuAction(() => applySectionEditorCommand("insertOrderedList"))
      }
    ];

    if (sectionEditorContextMenu.insideLink) {
      items.push({ kind: "separator", key: "content-link-separator" });
      items.push({
        kind: "action",
        key: "content-remove-link",
        label: "Remove link",
        disabled: !sectionEditorWritable,
        onSelect: () => runSectionEditorContextMenuAction((menuState) => removeSectionEditorLinkAtSelection(menuState))
      });
    }

    if (sectionEditorContextMenu.insideTable) {
      items.push({ kind: "separator", key: "content-table-separator" });
      items.push(
        {
          kind: "action",
          key: "content-table-row-above",
          label: "Add row above",
          disabled: !sectionEditorWritable,
          onSelect: () => runSectionEditorContextMenuAction(() => insertSectionEditorTableRowAtSelection("above"))
        },
        {
          kind: "action",
          key: "content-table-row-below",
          label: "Add row below",
          disabled: !sectionEditorWritable,
          onSelect: () => runSectionEditorContextMenuAction(() => insertSectionEditorTableRowAtSelection("below"))
        },
        {
          kind: "action",
          key: "content-table-column-left",
          label: "Add column left",
          disabled: !sectionEditorWritable,
          onSelect: () => runSectionEditorContextMenuAction(() => insertSectionEditorTableColumnAtSelection("left"))
        },
        {
          kind: "action",
          key: "content-table-column-right",
          label: "Add column right",
          disabled: !sectionEditorWritable,
          onSelect: () => runSectionEditorContextMenuAction(() => insertSectionEditorTableColumnAtSelection("right"))
        },
        {
          kind: "action",
          key: "content-table-delete-row",
          label: "Delete row",
          disabled: !sectionEditorWritable,
          onSelect: () => runSectionEditorContextMenuAction(() => removeSectionEditorTableRowAtSelection())
        },
        {
          kind: "action",
          key: "content-table-delete-column",
          label: "Delete column",
          disabled: !sectionEditorWritable,
          onSelect: () => runSectionEditorContextMenuAction(() => removeSectionEditorTableColumnAtSelection())
        },
        {
          kind: "action",
          key: "content-table-delete-table",
          label: "Delete table",
          disabled: !sectionEditorWritable,
          danger: true,
          onSelect: () => runSectionEditorContextMenuAction(() => removeSectionEditorCurrentTable())
        }
      );
    }

    items.push({ kind: "separator", key: "content-selection-separator" });
    items.push({
      kind: "action",
      key: "content-select-all",
      label: "Select all",
      shortcutLabel: "Ctrl+A",
      onSelect: () => runSectionEditorContextMenuAction(() => selectAllSectionEditorContent())
    });

    return items;
  })();

  const rootReadable = canReadProcedureNode(rootNode.id);
  const rootWritable = canWriteProcedureNode(rootNode.id);
  const rootSectionChildren = getDirectSectionChildren(rootNode, byParent);
  const rootDirectFields = rootReadable
    ? getDirectFieldEntries(rootNode, byParent).filter((entry) => canReadProcedureNode(entry.node.id))
    : [];
  const rootAnnexFiles = rootReadable
    ? getDirectFileChildren(rootNode, byParent).filter((node) => canReadProcedureNode(node.id))
    : [];
  const rootHasVisibleContent =
    (rootReadable && Boolean((rootNode.description ?? "").trim().length > 0 || (rootNode.content ?? "").trim().length > 0)) ||
    rootSectionChildren.length > 0 ||
    rootDirectFields.length > 0 ||
    rootAnnexFiles.length > 0;
  const rootSectionNumber = procedureScopedNumbering.get(rootNode.id) ?? "";
  const rootTitle = resolveNodeTitle(rootNode);
  const rootTitleLevel = resolveProcedureSectionTitleLevel(rootNode.id, rootNode.id, globalNodeById);
  const rootTitleStyle = buildSectionEditorTitleTextStyle(
    buildSectionEditorTitleStyleFromDefaults(
      sectionEditorTitleLevelDefaults[rootTitleLevel] ?? buildDefaultSectionEditorTitleDefaults(rootTitleLevel)
    )
  );
  const hideDefaultRootTitle =
    !rootTitle || (!rootHasVisibleContent && DEFAULT_PROCEDURE_ROOT_NAMES.has(rootNode.name.trim().toLowerCase()));

  return (
    <section
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      onMouseDown={() => {
        onActivateProcedureSurface();
      }}
      onKeyDownCapture={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("input, textarea, select, [contenteditable='true']")) {
          event.stopPropagation();
        }
      }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          ref={procedureSurfaceContentRef}
          className="mx-auto flex max-w-[1320px] flex-col gap-5 px-4 py-5 lg:px-6"
          onContextMenu={(event) => {
            const target = event.target as HTMLElement;
            if (target.closest("input, textarea, select, button, label, [contenteditable='true']")) return;
            onOpenSurfaceContextMenu(event);
          }}
        >
          <section className={PROCEDURE_SURFACE_SHELL_CLASS} data-procedure-node-id={rootNode.id}>
            <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-6">
              <div className="flex items-center gap-3">
                {rootSectionNumber && !hideDefaultRootTitle ? (
                  <span className={resolveSectionNumberBadgeClasses(selectedNode?.id === rootNode.id)}>
                    {rootSectionNumber}
                  </span>
                ) : null}
                {!hideDefaultRootTitle ? (
                  <button
                    type="button"
                    className={`${resolveHeadingClasses(0)} text-left transition ${
                      rootWritable ? "cursor-text hover:text-[var(--ode-accent)]" : ""
                    }`}
                    style={rootTitleStyle}
                    disabled={!rootWritable}
                    onClick={() => onSelectNode(rootNode.id)}
                    onDoubleClick={() => {
                      if (!rootWritable) return;
                      openSectionEditor(rootNode, {
                        focusTarget: "label"
                      });
                    }}
                    aria-label={rootWritable ? `Select ${rootNode.name}. Double-click to rename.` : `Select ${rootNode.name}`}
                  >
                    {rootTitle}
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <OdeTooltip label="Add section">
                  <button
                    type="button"
                    className={`${PROCEDURE_ICON_BUTTON_CLASS} h-11 w-11 disabled:cursor-not-allowed disabled:opacity-60`}
                    disabled={!rootWritable}
                    onClick={() => {
                      void createRootProcedureItem("section");
                    }}
                    aria-label="Add section"
                  >
                    <DatabaseSectionGlyph />
                  </button>
                </OdeTooltip>
                <OdeTooltip label="Add field">
                  <button
                    type="button"
                    className={`${PROCEDURE_ICON_BUTTON_CLASS} h-11 w-11 disabled:cursor-not-allowed disabled:opacity-60`}
                    disabled={!rootWritable}
                    onClick={() => {
                      void createRootProcedureItem("field");
                    }}
                    aria-label="Add field"
                  >
                    <DatabaseFieldGlyph />
                  </button>
                </OdeTooltip>
              </div>
            </div>
            <div className="px-4 py-5 md:px-6">
              {renderSectionNode(rootNode, 0)}
            </div>
          </section>
        </div>
      </div>

      {recordEditorOpen && recordEditorParentNode ? (
        <div className={PROCEDURE_MODAL_OVERLAY_CLASS}>
          <div className={`${PROCEDURE_MODAL_PANEL_CLASS} max-w-[1120px]`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[0.78rem] uppercase tracking-[0.18em] text-[var(--ode-accent)]">Record</div>
                <div className="mt-2 text-[1.4rem] font-semibold text-[var(--ode-text)]">
                  {recordEditorRecordId ? "Edit Record" : "New Record"}
                </div>
                <div className="mt-1 text-[0.95rem] text-[var(--ode-text-muted)]">{recordEditorParentNode.name}</div>
              </div>
              <OdeTooltip label="Close record editor">
                <button type="button" className={PROCEDURE_MODAL_CLOSE_BUTTON_CLASS} onClick={closeRecordEditor}>
                  Close
                </button>
              </OdeTooltip>
            </div>

            <div className="mt-6 max-h-[68vh] overflow-y-auto pr-1">
              {visibleRecordEditorFields.length > 0 ? (
                <div className="grid gap-5 md:grid-cols-2">
                  {visibleRecordEditorFields.map((entry) => renderRecordField(entry))}
                </div>
              ) : (
                <div className={`${PROCEDURE_MUTED_CARD_CLASS} border-dashed px-6 py-10 text-center`}>
                  No visible fields right now.
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              {recordEditorRecordId ? (
                <OdeTooltip label="Delete this record">
                  <button
                    type="button"
                    className={PROCEDURE_MODAL_DANGER_BUTTON_CLASS}
                    disabled={!recordEditorWritable}
                    onClick={() => {
                      if (!recordEditorWritable) return;
                      requestDeleteRecord(recordEditorParentNode, recordEditorRecordId);
                    }}
                  >
                    Delete
                  </button>
                </OdeTooltip>
              ) : null}
              <button type="button" className={PROCEDURE_MODAL_SECONDARY_BUTTON_CLASS} onClick={closeRecordEditor}>
                Cancel
              </button>
              <button
                type="button"
                className={`${PROCEDURE_MODAL_PRIMARY_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
                disabled={recordSaving || !recordEditorWritable}
                onClick={() => {
                  void handleSaveRecord();
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteConfirmState ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(12,23,38,0.48)] px-4">
          <div className={`${PROCEDURE_MODAL_PANEL_CLASS} max-w-[520px]`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[0.78rem] uppercase tracking-[0.18em] text-[var(--ode-accent)]">Delete</div>
                <div className="mt-2 text-[1.4rem] font-semibold text-[var(--ode-text)]">Delete Record</div>
              </div>
              <OdeTooltip label="Close delete confirmation">
                <button
                  type="button"
                  className={PROCEDURE_MODAL_CLOSE_BUTTON_CLASS}
                  onClick={() => setDeleteConfirmState(null)}
                >
                  Close
                </button>
              </OdeTooltip>
            </div>

            <div className="mt-5 space-y-3 text-[0.95rem] leading-7 text-[var(--ode-text-muted)]">
              <p>
                This will remove the selected record from{" "}
                <span className="font-medium text-[var(--ode-text)]">{deleteConfirmState.nodeName}</span>.
              </p>
              <p>The row will disappear from the master list and this action cannot be undone.</p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className={PROCEDURE_MODAL_SECONDARY_BUTTON_CLASS}
                onClick={() => setDeleteConfirmState(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${PROCEDURE_MODAL_DANGER_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
                disabled={recordSaving || !recordEditorWritable}
                onClick={() => {
                  void confirmDeleteRecord();
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {attachmentDeleteState ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(12,23,38,0.48)] px-4">
          <div className={`${PROCEDURE_MODAL_PANEL_CLASS} max-w-[520px]`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[0.78rem] uppercase tracking-[0.18em] text-[var(--ode-accent)]">Delete</div>
                <div className="mt-2 text-[1.4rem] font-semibold text-[var(--ode-text)]">Remove File</div>
              </div>
              <OdeTooltip label="Close delete confirmation">
                <button
                  type="button"
                  className={PROCEDURE_MODAL_CLOSE_BUTTON_CLASS}
                  onClick={() => setAttachmentDeleteState(null)}
                >
                  Close
                </button>
              </OdeTooltip>
            </div>

            <div className="mt-5 text-[0.98rem] leading-7 text-[var(--ode-text-muted)]">
              Remove <span className="font-medium text-[var(--ode-text)]">{attachmentDeleteState.nodeName}</span>?
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className={PROCEDURE_MODAL_SECONDARY_BUTTON_CLASS}
                onClick={() => setAttachmentDeleteState(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${PROCEDURE_MODAL_DANGER_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
                disabled={sectionAttachmentDeletingId === attachmentDeleteState.nodeId}
                onClick={() => {
                  void confirmDeleteAttachment();
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {sectionEditorNodeId && sectionEditorDraft ? (
        <div className={`${PROCEDURE_MODAL_OVERLAY_CLASS} py-6 md:py-8`}>
          <div className={SECTION_EDITOR_MODAL_PANEL_CLASS}>
            <div className="min-h-0 flex flex-1 flex-col overflow-y-auto">
              <div className="shrink-0 border-b border-[rgba(126,154,176,0.16)] bg-[linear-gradient(180deg,rgba(10,24,36,0.96),rgba(8,21,33,0.94))] px-4 py-4 md:px-5">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        {sectionEditorHeadingPreview ? (
                          <div className="inline-flex h-11 shrink-0 items-center rounded-[12px] border border-[rgba(125,211,252,0.34)] bg-[rgba(14,56,81,0.92)] px-4 text-[0.86rem] font-semibold tracking-[0.08em] text-[#d7f3ff]">
                            {sectionEditorHeadingPreview}
                          </div>
                        ) : null}
                        <input
                          ref={sectionEditorTitleInputRef}
                          type="text"
                          className="min-w-0 w-full rounded-[12px] border border-[#d6dde6] bg-white px-4 text-[1rem] font-semibold tracking-[-0.02em] text-[#0f172a] placeholder:text-[#64748b] shadow-[0_10px_28px_rgba(15,23,42,0.08)] outline-none transition focus:border-[#7dd3fc] focus:ring-2 focus:ring-[rgba(56,189,248,0.18)]"
                          style={{
                            color: sectionEditorEffectiveTitleStyle.color,
                            WebkitTextFillColor: sectionEditorEffectiveTitleStyle.color,
                            fontFamily: buildSectionEditorFontFamilyCssValue(sectionEditorEffectiveTitleStyle.fontFamily),
                            fontSize: `${sectionEditorEffectiveTitleStyle.fontSizePt}pt`,
                            fontWeight: sectionEditorEffectiveTitleStyle.bold ? 700 : 400,
                            fontStyle: sectionEditorEffectiveTitleStyle.italic ? "italic" : "normal",
                            textAlign: sectionEditorEffectiveTitleStyle.textAlignment,
                            height: `${sectionEditorTitleInputMetrics.heightPx}px`,
                            lineHeight: `${sectionEditorTitleInputMetrics.lineHeightPx}px`,
                            opacity: 1
                          }}
                          placeholder="Untitled section"
                          value={sectionEditorDraft.label}
                          spellCheck
                          onMouseDown={(event) => {
                            event.stopPropagation();
                            setSectionEditorFocusTarget("label");
                            syncSectionEditorTitleFormattingState();
                            setSectionEditorSelectedImageId(null);
                            setSectionEditorSelectedImageAlignment(null);
                            setSectionNumberingPanelOpen(false);
                            setSectionEditorColorPickerOpen(false);
                            setSectionEditorTableMenuOpen(false);
                            setSectionEditorLineSpacingMenuOpen(false);
                          }}
                          onFocus={() => {
                            setSectionEditorFocusTarget("label");
                            syncSectionEditorTitleFormattingState();
                            setSectionEditorSelectedImageId(null);
                            setSectionEditorSelectedImageAlignment(null);
                            setSectionNumberingPanelOpen(false);
                            setSectionEditorColorPickerOpen(false);
                            setSectionEditorTableMenuOpen(false);
                            setSectionEditorLineSpacingMenuOpen(false);
                          }}
                          onChange={(event) =>
                            setSectionEditorDraft((current) =>
                              current ? { ...current, label: event.target.value } : current
                            )
                          }
                          onKeyDown={(event) => {
                            if (
                              (event.ctrlKey || event.metaKey) &&
                              event.shiftKey &&
                              !event.altKey &&
                              !event.nativeEvent.isComposing &&
                              event.key.toLowerCase() === "v"
                            ) {
                              event.preventDefault();
                              void pasteSectionEditorTitleClipboard();
                              return;
                            }
                            void handleSectionEditorAlignmentShortcut(event);
                          }}
                          onContextMenu={openSectionEditorTitleContextMenu}
                        />
                      </div>
                    </div>

                  </div>

                  <div className={`${SECTION_EDITOR_PANEL_CARD_CLASS} p-2.5 md:p-3`}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <div className="relative">
                        <SectionEditorToolbarIconButton
                          label="Numbering"
                          buttonClassName={`${SECTION_EDITOR_TOOLBAR_BUTTON_CLASS} ${
                            sectionNumberingPanelOpen ? SECTION_EDITOR_TOOLBAR_BUTTON_ACTIVE_CLASS : ""
                          }`}
                          onMouseDown={preserveSectionEditorSelection}
                          onClick={() => {
                            setSectionEditorFocusTarget("panel");
                            setSectionEditorColorPickerOpen(false);
                            setSectionEditorTableMenuOpen(false);
                            setSectionNumberingPanelOpen((current) => !current);
                          }}
                        >
                          <ListNumbersGlyphSmall />
                        </SectionEditorToolbarIconButton>
                        {sectionNumberingPanelOpen ? (
                          <div
                            className="absolute left-0 top-full z-20 mt-2 w-[min(92vw,320px)] rounded-[14px] border border-[rgba(126,154,176,0.18)] bg-[rgba(7,20,31,0.98)] p-3 shadow-[0_24px_48px_rgba(0,0,0,0.36)]"
                            onMouseDown={preserveSectionEditorPanelFocus}
                          >
                            <div className="space-y-2">
                              <label className="inline-flex h-10 w-full cursor-pointer items-center justify-start gap-2 rounded-[12px] border border-[rgba(126,154,176,0.16)] bg-[rgba(8,24,37,0.7)] px-3 text-[0.8rem] font-medium text-[var(--ode-text)]">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border border-[rgba(126,154,176,0.28)] accent-[#38bdf8]"
                                  checked={!sectionEditorDraft.numberingHidden}
                                  onFocus={() => {
                                    setSectionEditorFocusTarget("panel");
                                  }}
                                  onChange={(event) => {
                                    setSectionEditorNumberingHidden(!event.target.checked);
                                  }}
                                />
                                <span>Numbering</span>
                                <span className="ml-auto rounded-full border border-[rgba(126,154,176,0.16)] bg-[rgba(5,29,46,0.76)] px-2 py-0.5 text-[0.68rem] uppercase tracking-[0.12em] text-[var(--ode-text-dim)]">
                                  {sectionEditorDraft.numberingHidden ? "Off" : "On"}
                                </span>
                              </label>

                              {!sectionEditorDraft.numberingHidden ? (
                                <label className="inline-flex h-10 cursor-pointer items-center justify-start gap-2 rounded-[12px] border border-[rgba(126,154,176,0.16)] bg-[rgba(8,24,37,0.7)] px-3 text-[0.8rem] font-medium text-[var(--ode-text)]">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border border-[rgba(126,154,176,0.28)] accent-[#38bdf8]"
                                    checked={sectionEditorDraft.numberingStartAt !== null}
                                    onFocus={() => {
                                      setSectionEditorFocusTarget("panel");
                                    }}
                                    onChange={(event) => {
                                      setSectionEditorNumberingRestartEnabled(event.target.checked);
                                    }}
                                  />
                                  <span>Restart numbering</span>
                                  <span className="ml-auto rounded-full border border-[rgba(126,154,176,0.16)] bg-[rgba(5,29,46,0.76)] px-2 py-0.5 text-[0.68rem] uppercase tracking-[0.12em] text-[var(--ode-text-dim)]">
                                    {sectionEditorDraft.numberingStartAt !== null ? "On" : "Off"}
                                  </span>
                                </label>
                              ) : null}

                              {!sectionEditorDraft.numberingHidden && sectionEditorDraft.numberingStartAt !== null ? (
                                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_88px]">
                                  <div className="inline-flex h-10 items-center justify-start rounded-[12px] border border-[rgba(126,154,176,0.16)] bg-[rgba(8,24,37,0.7)] px-3 text-[0.8rem] font-medium text-[var(--ode-text)]">
                                    Start at
                                  </div>
                                  <input
                                    ref={sectionNumberingStartAtInputRef}
                                    type="number"
                                    min={1}
                                    step={1}
                                    className={`${SECTION_EDITOR_INPUT_CLASS} text-center`}
                                    style={SECTION_EDITOR_INPUT_STYLE}
                                    value={`${sectionEditorDraft.numberingStartAt}`}
                                    onFocus={() => {
                                      setSectionEditorFocusTarget("panel");
                                    }}
                                    onChange={(event) => {
                                      setSectionEditorNumberingStartAt(event.target.value);
                                    }}
                                  />
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <SectionEditorToolbarIconButton
                        label="Undo"
                        disabled={!sectionEditorWritable || !sectionEditorCanUndo}
                        onMouseDown={preserveSectionEditorSelection}
                        onClick={() => applySectionEditorCommand("undo")}
                      >
                        <ArrowLeftGlyphSmall />
                      </SectionEditorToolbarIconButton>
                      <SectionEditorToolbarIconButton
                        label="Redo"
                        disabled={!sectionEditorWritable || !sectionEditorCanRedo}
                        onMouseDown={preserveSectionEditorSelection}
                        onClick={() => applySectionEditorCommand("redo")}
                      >
                        <ArrowRightGlyphSmall />
                      </SectionEditorToolbarIconButton>
                      <div className="relative" ref={sectionEditorStyleMenuRef}>
                        <OdeTooltip
                          label={
                            sectionEditorFormattingTargetRef.current === "label"
                              ? "Section title level is automatic from the tree"
                              : `Body heading style: ${sectionEditorCurrentStyleLabel}`
                          }
                        >
                          <div>
                            <button
                              type="button"
                              className={`${SECTION_EDITOR_TOOLBAR_BUTTON_CLASS} h-9 w-[3.4rem] justify-between gap-1 px-2 ${
                                sectionEditorStyleMenuOpen ? SECTION_EDITOR_TOOLBAR_BUTTON_ACTIVE_CLASS : ""
                              }`}
                              style={SECTION_EDITOR_TOOLBAR_SELECT_STYLE}
                              disabled={!sectionEditorWritable || sectionEditorFormattingTargetRef.current === "label"}
                              aria-label="Body style"
                              onMouseDown={(event) => {
                                event.stopPropagation();
                                preserveSectionEditorSelection(event);
                                if (sectionEditorFormattingTargetRef.current === "label") {
                                  syncSectionEditorTitleFormattingState();
                                  return;
                                }
                                syncSectionEditorSelection();
                              }}
                              onClick={() => {
                                if (!sectionEditorWritable || sectionEditorFormattingTargetRef.current === "label") {
                                  return;
                                }
                                setSectionEditorFocusTarget("panel");
                                setSectionNumberingPanelOpen(false);
                                setSectionEditorColorPickerOpen(false);
                                setSectionEditorTableMenuOpen(false);
                                setSectionEditorStyleMenuOpen((current) => !current);
                              }}
                            >
                              <HeadingStyleGlyphSmall />
                              <span className="pointer-events-none shrink-0 text-[var(--ode-text-dim)]">
                                <ArrowDownGlyphSmall />
                              </span>
                            </button>
                          </div>
                        </OdeTooltip>
                        {sectionEditorStyleMenuOpen ? (
                          <div
                            className="absolute left-0 top-full z-20 mt-2 min-w-[190px] rounded-[14px] border border-[rgba(126,154,176,0.18)] bg-[rgba(7,20,31,0.98)] p-2 shadow-[0_24px_48px_rgba(0,0,0,0.36)]"
                            onMouseDown={preserveSectionEditorPanelFocus}
                          >
                            <div className="space-y-1">
                              {sectionEditorVisibleStyleOptions.map((option) => {
                                const selected = option.value === sectionEditorCurrentStyle;
                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    className={`flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left transition ${
                                      selected
                                        ? "bg-[rgba(18,56,81,0.92)] text-[var(--ode-text)]"
                                        : "text-[var(--ode-text)] hover:bg-[rgba(12,34,50,0.88)]"
                                    }`}
                                    onMouseDown={preserveSectionEditorPanelFocus}
                                    onClick={() => {
                                      applySectionEditorBlockStyle(option.value);
                                    }}
                                  >
                                    <span className={`truncate ${option.buttonClassName}`}>{option.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className="relative min-w-[180px] max-w-[260px] flex-1" ref={sectionEditorFontMenuRef}>
                        <OdeTooltip label={`Font family: ${sectionEditorCurrentFontFamily}`}>
                          <button
                            type="button"
                            aria-label="Font family"
                            disabled={!sectionEditorWritable}
                            className={`${SECTION_EDITOR_TOOLBAR_SELECT_CLASS} flex w-full items-center justify-between gap-3 pr-2.5 text-left ${
                              sectionEditorFontMenuOpen ? "border-[rgba(95,220,255,0.42)] bg-[rgba(14,38,56,0.96)]" : ""
                            }`}
                            style={SECTION_EDITOR_TOOLBAR_SELECT_STYLE}
                            onMouseDown={preserveSectionEditorSelection}
                            onClick={() => {
                              setSectionEditorFocusTarget("panel");
                              setSectionEditorStyleMenuOpen(false);
                              setSectionNumberingPanelOpen(false);
                              setSectionEditorColorPickerOpen(false);
                              setSectionEditorTableMenuOpen(false);
                              setSectionEditorFontSizeMenuOpen(false);
                              setSectionEditorFontQuery("");
                              setSectionEditorFontMenuOpen((current) => !current);
                            }}
                          >
                            <span
                              className="min-w-0 flex-1 truncate"
                              style={{ fontFamily: buildSectionEditorFontFamilyCssValue(sectionEditorCurrentFontFamily) }}
                            >
                              {sectionEditorCurrentFontFamily}
                            </span>
                            <span className="pointer-events-none shrink-0 text-[var(--ode-text-dim)]">
                              <ArrowDownGlyphSmall />
                            </span>
                          </button>
                        </OdeTooltip>
                        {sectionEditorFontMenuOpen ? (
                          <div className="absolute left-0 top-full z-20 mt-2 w-[min(92vw,260px)] rounded-[16px] border border-[rgba(126,154,176,0.2)] bg-[rgba(7,20,31,0.98)] p-3 shadow-[0_24px_48px_rgba(0,0,0,0.36)]">
                            <div className="rounded-[12px] border border-[rgba(126,154,176,0.16)] bg-[rgba(8,24,37,0.72)] px-3 py-2">
                              <span className="sr-only">Search fonts</span>
                              <input
                                ref={sectionEditorFontSearchInputRef}
                                type="text"
                                value={sectionEditorFontQuery}
                                placeholder="Search fonts"
                                className="w-full border-none bg-transparent p-0 text-[0.82rem] text-[var(--ode-text)] outline-none placeholder:text-[var(--ode-text-dim)]"
                                onMouseDown={(event) => {
                                  event.stopPropagation();
                                }}
                                onFocus={() => {
                                  setSectionEditorFocusTarget("panel");
                                }}
                                onChange={(event) => {
                                  setSectionEditorFontQuery(event.target.value);
                                }}
                              />
                            </div>
                            <div className="mt-2 max-h-[260px] overflow-y-auto rounded-[12px] border border-[rgba(126,154,176,0.14)] bg-[rgba(8,24,37,0.52)] p-1">
                              {sectionEditorFilteredFontFamilyOptions.length > 0 ? (
                                <div className="space-y-1">
                                  {sectionEditorFilteredFontFamilyOptions.map((fontFamily) => {
                                    const selected = fontFamily === sectionEditorCurrentFontFamily;
                                    return (
                                      <button
                                        key={fontFamily}
                                        type="button"
                                        className={`flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left transition ${
                                          selected
                                            ? "bg-[rgba(18,56,81,0.92)] text-[var(--ode-text)]"
                                            : "text-[var(--ode-text)] hover:bg-[rgba(12,34,50,0.88)]"
                                        }`}
                                        onMouseDown={preserveSectionEditorPanelFocus}
                                        onClick={() => {
                                          applySectionEditorFontFamily(fontFamily);
                                        }}
                                      >
                                        <span
                                          className="min-w-0 flex-1 truncate"
                                          style={{ fontFamily: buildSectionEditorFontFamilyCssValue(fontFamily) }}
                                        >
                                          {fontFamily}
                                        </span>
                                        {selected ? (
                                          <span className="shrink-0 rounded-full border border-[rgba(95,220,255,0.22)] bg-[rgba(5,29,46,0.78)] px-2 py-0.5 text-[0.64rem] uppercase tracking-[0.12em] text-[var(--ode-accent)]">
                                            Current
                                          </span>
                                        ) : null}
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="rounded-[10px] border border-dashed border-[rgba(126,154,176,0.18)] bg-[rgba(8,24,37,0.48)] px-3 py-5 text-center text-[0.78rem] text-[var(--ode-text-dim)]">
                                  No fonts match this search.
                                </div>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className="relative w-[92px] shrink-0" ref={sectionEditorFontSizeMenuRef}>
                        <OdeTooltip label={`Font size: ${clampSectionEditorFontSizePt(sectionEditorCurrentFontSizePt)} pt`}>
                          <div className="flex h-9 w-full items-center overflow-hidden rounded-[10px] border border-[rgba(126,154,176,0.18)] bg-[rgba(8,24,37,0.96)] text-[#f8fafc] transition hover:border-[rgba(95,220,255,0.28)] hover:bg-[rgba(14,38,56,0.96)] focus-within:border-[rgba(95,220,255,0.42)] focus-within:ring-2 focus-within:ring-[rgba(95,220,255,0.22)]">
                            <span className="sr-only">Font size</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={sectionEditorFontSizeInput}
                              disabled={!sectionEditorWritable}
                              className="min-w-0 flex-1 border-none bg-transparent px-3 text-center text-[0.82rem] font-medium text-[#f8fafc] outline-none placeholder:text-[var(--ode-text-dim)]"
                              onMouseDown={(event) => {
                                event.stopPropagation();
                                if (sectionEditorFormattingTargetRef.current === "label") {
                                  syncSectionEditorTitleFormattingState();
                                  return;
                                }
                                syncSectionEditorSelection();
                              }}
                              onFocus={() => {
                                setSectionEditorFocusTarget("panel");
                              }}
                              onChange={(event) => {
                                setSectionEditorFontSizeInput(event.target.value.replace(",", "."));
                              }}
                              onBlur={() => {
                                commitSectionEditorFontSizeInput();
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  commitSectionEditorFontSizeInput();
                                } else if (event.key === "Escape") {
                                  event.preventDefault();
                                  setSectionEditorFontSizeInput(`${clampSectionEditorFontSizePt(sectionEditorCurrentFontSizePt)}`);
                                  setSectionEditorFontSizeMenuOpen(false);
                                  (event.target as HTMLInputElement).blur();
                                }
                              }}
                            />
                            <button
                              type="button"
                              aria-label="Font size presets"
                              disabled={!sectionEditorWritable}
                              className="flex h-full w-8 shrink-0 items-center justify-center border-l border-[rgba(126,154,176,0.16)] text-[var(--ode-text-dim)] transition hover:bg-[rgba(14,38,56,0.96)] hover:text-[var(--ode-text)]"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setSectionEditorFocusTarget("panel");
                              }}
                              onClick={() => {
                                setSectionEditorStyleMenuOpen(false);
                                setSectionNumberingPanelOpen(false);
                                setSectionEditorColorPickerOpen(false);
                                setSectionEditorTableMenuOpen(false);
                                setSectionEditorFontMenuOpen(false);
                                setSectionEditorFontSizeMenuOpen((current) => !current);
                              }}
                            >
                              <ArrowDownGlyphSmall />
                            </button>
                          </div>
                        </OdeTooltip>
                        {sectionEditorFontSizeMenuOpen ? (
                          <div className="absolute left-0 top-full z-20 mt-2 w-full min-w-[88px] rounded-[14px] border border-[rgba(126,154,176,0.18)] bg-[rgba(7,20,31,0.98)] p-2 shadow-[0_24px_48px_rgba(0,0,0,0.36)]">
                            <div className="space-y-1">
                              {sectionEditorFontSizeOptions.map((fontSize) => {
                                const selected = fontSize === clampSectionEditorFontSizePt(sectionEditorCurrentFontSizePt);
                                return (
                                  <button
                                    key={fontSize}
                                    type="button"
                                    className={`flex w-full items-center justify-center rounded-[10px] px-2 py-2 text-center text-[0.82rem] font-medium transition ${
                                      selected
                                        ? "bg-[rgba(18,56,81,0.92)] text-[var(--ode-text)]"
                                        : "text-[var(--ode-text)] hover:bg-[rgba(12,34,50,0.88)]"
                                    }`}
                                    onMouseDown={preserveSectionEditorPanelFocus}
                                    onClick={() => {
                                      applySectionEditorFontSize(fontSize);
                                    }}
                                  >
                                    {fontSize}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <SectionEditorToolbarIconButton
                        label="Bold"
                        buttonClassName={`${SECTION_EDITOR_TOOLBAR_BUTTON_CLASS} ${
                          sectionEditorCurrentBold ? SECTION_EDITOR_TOOLBAR_BUTTON_ACTIVE_CLASS : ""
                        }`}
                        onMouseDown={preserveSectionEditorSelection}
                        onClick={() => applySectionEditorCommand("bold")}
                      >
                        <TextBoldGlyphSmall />
                      </SectionEditorToolbarIconButton>
                      <SectionEditorToolbarIconButton
                        label="Italic"
                        buttonClassName={`${SECTION_EDITOR_TOOLBAR_BUTTON_CLASS} ${
                          sectionEditorCurrentItalic ? SECTION_EDITOR_TOOLBAR_BUTTON_ACTIVE_CLASS : ""
                        }`}
                        onMouseDown={preserveSectionEditorSelection}
                        onClick={() => applySectionEditorCommand("italic")}
                      >
                        <TextItalicGlyphSmall />
                      </SectionEditorToolbarIconButton>
                      <div className="relative" ref={sectionEditorColorPickerRef}>
                        <OdeTooltip label="Text color">
                          <button
                            type="button"
                            aria-label="Text color"
                            disabled={!sectionEditorWritable}
                            className={`${SECTION_EDITOR_TOOLBAR_BUTTON_CLASS} relative ${
                              sectionEditorColorPickerOpen ? SECTION_EDITOR_TOOLBAR_BUTTON_ACTIVE_CLASS : ""
                            }`}
                            style={sectionEditorColorButtonStyle}
                            onMouseDown={preserveSectionEditorColorPickerSelection}
                            onClick={() => {
                              setSectionEditorFocusTarget("panel");
                              setSectionNumberingPanelOpen(false);
                              setSectionEditorTableMenuOpen(false);
                              setSectionEditorColorPickerOpen((current) => !current);
                            }}
                          >
                            <span
                              aria-hidden="true"
                              className="h-[18px] w-[18px] rounded-[6px] border border-[rgba(255,255,255,0.16)] shadow-[inset_0_0_0_1px_rgba(7,20,31,0.08),0_0_0_1px_rgba(7,20,31,0.28)]"
                              style={{
                                backgroundColor: sectionEditorResolvedTextColor
                              }}
                            />
                          </button>
                        </OdeTooltip>
                        {sectionEditorColorPickerOpen ? (
                          <div
                            className="absolute left-0 top-full z-20 mt-2 w-[min(92vw,320px)] rounded-[16px] border border-[rgba(126,154,176,0.2)] bg-[rgba(7,20,31,0.98)] p-3 shadow-[0_24px_48px_rgba(0,0,0,0.36)]"
                            onMouseDown={preserveSectionEditorPanelFocus}
                          >
                            <div className="mb-3 flex items-center gap-2 rounded-[12px] border border-[rgba(126,154,176,0.16)] bg-[rgba(8,24,37,0.68)] px-3 py-2">
                              <div className="rounded-[10px] border border-[rgba(126,154,176,0.18)] bg-[rgba(8,24,37,0.92)] p-1.5">
                                <span
                                  aria-hidden="true"
                                  className="block h-7 w-7 rounded-[8px] border border-[rgba(255,255,255,0.14)] shadow-[inset_0_0_0_1px_rgba(7,20,31,0.08),0_0_0_1px_rgba(7,20,31,0.28)]"
                                  style={{ backgroundColor: sectionEditorResolvedTextColor }}
                                />
                              </div>
                              <div className="ml-auto flex items-center gap-2">
                              <button
                                type="button"
                                className="rounded-[10px] border border-[rgba(126,154,176,0.2)] bg-[rgba(8,24,37,0.96)] px-3 py-1.5 text-[0.74rem] font-medium text-[var(--ode-text)] transition hover:border-[rgba(95,220,255,0.32)] hover:bg-[rgba(13,37,55,0.98)]"
                                onMouseDown={preserveSectionEditorColorPickerSelection}
                                onClick={() => {
                                  setSectionEditorCurrentTextColorAsDefault();
                                }}
                              >
                                Set default
                              </button>
                              <button
                                type="button"
                                className={`rounded-[10px] border px-3 py-1.5 text-[0.74rem] font-medium transition ${
                                  sectionEditorCustomColorPanelOpen
                                    ? "border-[rgba(95,220,255,0.34)] bg-[rgba(18,56,81,0.92)] text-[var(--ode-text)]"
                                    : "border-[rgba(126,154,176,0.2)] bg-[rgba(8,24,37,0.96)] text-[var(--ode-text)] hover:border-[rgba(95,220,255,0.32)] hover:bg-[rgba(13,37,55,0.98)]"
                                }`}
                                onMouseDown={preserveSectionEditorColorPickerSelection}
                                onClick={() => {
                                  setSectionEditorCustomColorPanelOpen((current) => !current);
                                }}
                              >
                                Custom
                              </button>
                              </div>
                            </div>

                            {sectionEditorCustomColorPanelOpen ? (
                              <div className="mb-3 rounded-[14px] border border-[rgba(126,154,176,0.18)] bg-[linear-gradient(180deg,rgba(9,26,40,0.96),rgba(7,20,31,0.94))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="h-11 w-11 shrink-0 rounded-[12px] border border-[rgba(255,255,255,0.12)] shadow-[inset_0_0_0_1px_rgba(7,20,31,0.12),0_10px_24px_rgba(0,0,0,0.22)]"
                                    style={{ backgroundColor: sectionEditorCustomColorPreview }}
                                  />
                                  <input
                                    type="text"
                                    value={sectionEditorCustomColorState.hex}
                                    placeholder="#29afe3"
                                    className="h-10 min-w-0 flex-1 rounded-[10px] border border-[rgba(126,154,176,0.18)] bg-[rgba(8,24,37,0.9)] px-3 text-[0.8rem] font-medium uppercase tracking-[0.08em] text-[var(--ode-text)] outline-none transition placeholder:text-[var(--ode-text-dim)] focus:border-[rgba(95,220,255,0.34)] focus:ring-2 focus:ring-[rgba(95,220,255,0.18)]"
                                    onMouseDown={(event) => {
                                      event.stopPropagation();
                                    }}
                                    onFocus={() => {
                                      setSectionEditorFocusTarget("panel");
                                    }}
                                    onChange={(event) => {
                                      const nextValue = event.target.value.trim();
                                      const normalizedColor = resolveSectionEditorColorHex(nextValue);
                                      if (normalizedColor) {
                                        setSectionEditorCustomColorState(buildSectionEditorCustomColorState(normalizedColor));
                                        return;
                                      }
                                      setSectionEditorCustomColorState((current) => ({
                                        ...current,
                                        hex: nextValue
                                      }));
                                    }}
                                    onBlur={() => {
                                      applySectionEditorCustomColorHex();
                                    }}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        event.preventDefault();
                                        applySectionEditorCustomColorHex();
                                      } else if (event.key === "Escape") {
                                        event.preventDefault();
                                        setSectionEditorCustomColorState(buildSectionEditorCustomColorState(sectionEditorTextColor));
                                        (event.target as HTMLInputElement).blur();
                                      }
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className="rounded-[10px] border border-[rgba(95,220,255,0.24)] bg-[rgba(18,56,81,0.92)] px-3 py-2 text-[0.72rem] font-medium uppercase tracking-[0.12em] text-[var(--ode-text)] transition hover:border-[rgba(95,220,255,0.42)] hover:bg-[rgba(22,67,96,0.96)]"
                                    onMouseDown={preserveSectionEditorColorPickerSelection}
                                    onClick={() => {
                                      applySectionEditorCustomColorHex();
                                    }}
                                  >
                                    Apply
                                  </button>
                                </div>
                                <div className="mt-3 grid grid-cols-3 gap-2">
                                  {(
                                    [
                                      ["red", "R"],
                                      ["green", "G"],
                                      ["blue", "B"]
                                    ] as const
                                  ).map(([channel, placeholder]) => (
                                    <input
                                      key={channel}
                                      type="text"
                                      inputMode="numeric"
                                      value={sectionEditorCustomColorState[channel]}
                                      placeholder={placeholder}
                                      className="h-10 rounded-[10px] border border-[rgba(126,154,176,0.18)] bg-[rgba(8,24,37,0.9)] px-3 text-center text-[0.8rem] font-medium text-[var(--ode-text)] outline-none transition placeholder:text-[var(--ode-text-dim)] focus:border-[rgba(95,220,255,0.34)] focus:ring-2 focus:ring-[rgba(95,220,255,0.18)]"
                                      onMouseDown={(event) => {
                                        event.stopPropagation();
                                      }}
                                      onFocus={() => {
                                        setSectionEditorFocusTarget("panel");
                                      }}
                                      onChange={(event) => {
                                        const nextValue = event.target.value.replace(/[^\d]/g, "").slice(0, 3);
                                        setSectionEditorCustomColorState((current) => {
                                          const nextState = {
                                            ...current,
                                            [channel]: nextValue
                                          };
                                          const red = parseSectionEditorColorChannelInput(nextState.red);
                                          const green = parseSectionEditorColorChannelInput(nextState.green);
                                          const blue = parseSectionEditorColorChannelInput(nextState.blue);
                                          if (red === null || green === null || blue === null) {
                                            return nextState;
                                          }
                                          return buildSectionEditorCustomColorState(
                                            buildSectionEditorColorHexFromChannels(red, green, blue)
                                          );
                                        });
                                      }}
                                      onBlur={() => {
                                        applySectionEditorCustomColorRgb();
                                      }}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                          event.preventDefault();
                                          applySectionEditorCustomColorRgb();
                                        } else if (event.key === "Escape") {
                                          event.preventDefault();
                                          setSectionEditorCustomColorState(buildSectionEditorCustomColorState(sectionEditorTextColor));
                                          (event.target as HTMLInputElement).blur();
                                        }
                                      }}
                                    />
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            <div className="space-y-3">
                              <div>
                                <div className="mb-2 text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-muted)]">
                                  Recent
                                </div>
                                {sectionEditorRecentTextColors.length > 0 ? (
                                  <div className="grid grid-cols-8 gap-2">
                                    {sectionEditorRecentTextColors.map((color) => (
                                      <button
                                        key={`recent-${color}`}
                                        type="button"
                                        aria-label={`Recent color ${color.toUpperCase()}`}
                                        className={`h-8 w-8 rounded-[10px] border transition hover:scale-[1.03] ${
                                          sectionEditorTextColor === color
                                            ? "border-white shadow-[0_0_0_1px_rgba(255,255,255,0.72)]"
                                            : "border-[rgba(255,255,255,0.14)]"
                                        }`}
                                        style={{ backgroundColor: color }}
                                        onMouseDown={preserveSectionEditorColorPickerSelection}
                                        onClick={() => {
                                          applySectionEditorTextColor(color);
                                        }}
                                      />
                                    ))}
                                  </div>
                                ) : (
                                  <div className="rounded-[12px] border border-dashed border-[rgba(126,154,176,0.18)] bg-[rgba(8,24,37,0.48)] px-3 py-2 text-[0.78rem] text-[var(--ode-text-dim)]">
                                    Recent colors will appear here after you use them.
                                  </div>
                                )}
                              </div>

                              <div>
                                <div className="mb-2 text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-muted)]">
                                  ODE Theme
                                </div>
                                <div className="grid grid-cols-8 gap-2">
                                  {SECTION_EDITOR_THEME_TEXT_COLORS.map((color) => (
                                    <button
                                      key={`theme-${color.value}`}
                                      type="button"
                                      aria-label={`${color.label} ${color.value.toUpperCase()}`}
                                      className={`h-8 w-8 rounded-[10px] border transition hover:scale-[1.03] ${
                                        sectionEditorTextColor === color.value
                                          ? "border-white shadow-[0_0_0_1px_rgba(255,255,255,0.72)]"
                                          : "border-[rgba(255,255,255,0.14)]"
                                      }`}
                                      style={{ backgroundColor: color.value }}
                                      onMouseDown={preserveSectionEditorColorPickerSelection}
                                      onClick={() => {
                                        applySectionEditorTextColor(color.value);
                                      }}
                                    />
                                  ))}
                                </div>
                              </div>

                              <div>
                                <div className="mb-2 text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-muted)]">
                                  Solid Colors
                                </div>
                                <div className="grid grid-cols-6 gap-2">
                                  {SECTION_EDITOR_SOLID_TEXT_COLORS.map((color) => (
                                    <button
                                      key={`solid-${color.value}`}
                                      type="button"
                                      aria-label={`${color.label} ${color.value.toUpperCase()}`}
                                      className={`h-8 w-8 rounded-[10px] border transition hover:scale-[1.03] ${
                                        sectionEditorTextColor === color.value
                                          ? "border-white shadow-[0_0_0_1px_rgba(255,255,255,0.72)]"
                                          : "border-[rgba(255,255,255,0.14)]"
                                      }`}
                                      style={{ backgroundColor: color.value }}
                                      onMouseDown={preserveSectionEditorColorPickerSelection}
                                      onClick={() => {
                                        applySectionEditorTextColor(color.value);
                                      }}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <SectionEditorToolbarIconButton
                        label="Align left (Ctrl/Cmd+L)"
                        ariaLabel="Align left"
                        buttonClassName={`${SECTION_EDITOR_TOOLBAR_BUTTON_CLASS} ${
                          (sectionEditorSelectedImageId
                            ? sectionEditorSelectedImageAlignment === "left"
                            : sectionEditorCurrentAlignment === "left")
                            ? SECTION_EDITOR_TOOLBAR_BUTTON_ACTIVE_CLASS
                            : ""
                        }`}
                        onMouseDown={preserveSectionEditorSelection}
                        onClick={() => applySectionEditorTextAlignment("left")}
                      >
                        <TextAlignLeftGlyphSmall />
                      </SectionEditorToolbarIconButton>
                      <SectionEditorToolbarIconButton
                        label="Align center (Ctrl/Cmd+E)"
                        ariaLabel="Align center"
                        buttonClassName={`${SECTION_EDITOR_TOOLBAR_BUTTON_CLASS} ${
                          (sectionEditorSelectedImageId
                            ? sectionEditorSelectedImageAlignment === "center"
                            : sectionEditorCurrentAlignment === "center")
                            ? SECTION_EDITOR_TOOLBAR_BUTTON_ACTIVE_CLASS
                            : ""
                        }`}
                        onMouseDown={preserveSectionEditorSelection}
                        onClick={() => applySectionEditorTextAlignment("center")}
                      >
                        <TextAlignCenterGlyphSmall />
                      </SectionEditorToolbarIconButton>
                      <SectionEditorToolbarIconButton
                        label="Align right (Ctrl/Cmd+R)"
                        ariaLabel="Align right"
                        buttonClassName={`${SECTION_EDITOR_TOOLBAR_BUTTON_CLASS} ${
                          (sectionEditorSelectedImageId
                            ? sectionEditorSelectedImageAlignment === "right"
                            : sectionEditorCurrentAlignment === "right")
                            ? SECTION_EDITOR_TOOLBAR_BUTTON_ACTIVE_CLASS
                            : ""
                        }`}
                        onMouseDown={preserveSectionEditorSelection}
                        onClick={() => applySectionEditorTextAlignment("right")}
                      >
                        <TextAlignRightGlyphSmall />
                      </SectionEditorToolbarIconButton>
                      {sectionEditorFormattingTargetRef.current !== "label" && !sectionEditorSelectedImageId ? (
                        <SectionEditorToolbarIconButton
                          label="Justify (Ctrl/Cmd+J)"
                          ariaLabel="Justify"
                          buttonClassName={`${SECTION_EDITOR_TOOLBAR_BUTTON_CLASS} ${
                            sectionEditorCurrentAlignment === "justify" ? SECTION_EDITOR_TOOLBAR_BUTTON_ACTIVE_CLASS : ""
                          }`}
                          onMouseDown={preserveSectionEditorSelection}
                          onClick={() => applySectionEditorTextAlignment("justify")}
                        >
                          <TextAlignJustifyGlyphSmall />
                        </SectionEditorToolbarIconButton>
                      ) : null}
                      <SectionEditorToolbarIconButton
                        label="Decrease indent"
                        disabled={!sectionEditorWritable || sectionEditorCurrentIndentPx <= 0}
                        onMouseDown={preserveSectionEditorSelection}
                        onClick={() => applySectionEditorBlockIndentDelta(-SECTION_EDITOR_INDENT_STEP_PX)}
                      >
                        <IndentDecreaseGlyphSmall />
                      </SectionEditorToolbarIconButton>
                      <SectionEditorToolbarIconButton
                        label="Increase indent"
                        disabled={!sectionEditorWritable}
                        onMouseDown={preserveSectionEditorSelection}
                        onClick={() => applySectionEditorBlockIndentDelta(SECTION_EDITOR_INDENT_STEP_PX)}
                      >
                        <IndentIncreaseGlyphSmall />
                      </SectionEditorToolbarIconButton>
                      <div className="relative w-[96px] shrink-0" ref={sectionEditorLineSpacingMenuRef}>
                        <OdeTooltip
                          label={`Line spacing: ${getSectionEditorLineSpacingDisplayValue(sectionEditorCurrentLineSpacing)}`}
                        >
                          <div className="flex h-10 w-full items-center overflow-hidden rounded-[12px] border border-[rgba(126,154,176,0.2)] bg-[rgba(7,20,31,0.72)]">
                            <span className="pointer-events-none ml-2.5 mr-1.5 shrink-0 text-[var(--ode-text)]">
                              <LineSpacingGlyphSmall />
                            </span>
                            <span className="sr-only">Line spacing</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="min-w-0 flex-1 border-none bg-transparent p-0 text-center text-[0.84rem] font-medium text-[var(--ode-text)] outline-none placeholder:text-[var(--ode-text-dim)]"
                              value={sectionEditorLineSpacingInput}
                              disabled={!sectionEditorWritable || sectionEditorFormattingTargetRef.current === "label"}
                              onMouseDown={(event) => {
                                event.stopPropagation();
                                if (sectionEditorFormattingTargetRef.current === "label") {
                                  syncSectionEditorTitleFormattingState();
                                  return;
                                }
                                syncSectionEditorSelection();
                              }}
                              onFocus={() => {
                                setSectionEditorFocusTarget("panel");
                                setSectionEditorLineSpacingMenuOpen(false);
                              }}
                              onChange={(event) => {
                                setSectionEditorLineSpacingInput(event.target.value.replace(",", "."));
                              }}
                              onBlur={() => {
                                commitSectionEditorLineSpacingInput();
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  commitSectionEditorLineSpacingInput();
                                } else if (event.key === "Escape") {
                                  event.preventDefault();
                                  setSectionEditorLineSpacingInput(
                                    getSectionEditorLineSpacingDisplayValue(sectionEditorCurrentLineSpacing)
                                  );
                                  setSectionEditorLineSpacingMenuOpen(false);
                                  (event.target as HTMLInputElement).blur();
                                }
                              }}
                            />
                            <button
                              type="button"
                              aria-label="Line spacing presets"
                              disabled={!sectionEditorWritable || sectionEditorFormattingTargetRef.current === "label"}
                              className="flex h-full w-8 shrink-0 items-center justify-center border-l border-[rgba(126,154,176,0.16)] text-[var(--ode-text-dim)] transition hover:bg-[rgba(14,38,56,0.96)] hover:text-[var(--ode-text)] disabled:cursor-not-allowed disabled:opacity-60"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setSectionEditorFocusTarget("panel");
                              }}
                              onClick={() => {
                                if (!sectionEditorWritable || sectionEditorFormattingTargetRef.current === "label") {
                                  return;
                                }
                                setSectionEditorStyleMenuOpen(false);
                                setSectionNumberingPanelOpen(false);
                                setSectionEditorColorPickerOpen(false);
                                setSectionEditorTableMenuOpen(false);
                                setSectionEditorFontMenuOpen(false);
                                setSectionEditorFontSizeMenuOpen(false);
                                setSectionEditorLineSpacingMenuOpen((current) => !current);
                              }}
                            >
                              <ArrowDownGlyphSmall />
                            </button>
                          </div>
                        </OdeTooltip>
                        {sectionEditorLineSpacingMenuOpen ? (
                          <div className="absolute left-0 top-full z-20 mt-2 w-full min-w-[88px] rounded-[14px] border border-[rgba(126,154,176,0.18)] bg-[rgba(7,20,31,0.98)] p-2 shadow-[0_24px_48px_rgba(0,0,0,0.36)]">
                            <div className="space-y-1">
                              {SECTION_EDITOR_LINE_SPACING_PRESET_OPTIONS.map((option) => {
                                const selected =
                                  getSectionEditorLineSpacingDisplayValue(sectionEditorCurrentLineSpacing) === option.label;
                                return (
                                  <button
                                    key={option.label}
                                    type="button"
                                    className={`flex w-full items-center justify-center rounded-[10px] px-2 py-2 text-center text-[0.82rem] font-medium transition ${
                                      selected
                                        ? "bg-[rgba(18,56,81,0.92)] text-[var(--ode-text)]"
                                        : "text-[var(--ode-text)] hover:bg-[rgba(12,34,50,0.88)]"
                                    }`}
                                    onMouseDown={preserveSectionEditorPanelFocus}
                                    onClick={() => {
                                      applySectionEditorLineSpacing(option.value);
                                      setSectionEditorLineSpacingInput(option.label);
                                    }}
                                  >
                                    {option.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <SectionEditorToolbarIconButton
                        label="Bulleted list"
                        buttonClassName={`${SECTION_EDITOR_TOOLBAR_BUTTON_CLASS} ${
                          sectionEditorCurrentListKind === "unordered" ? SECTION_EDITOR_TOOLBAR_BUTTON_ACTIVE_CLASS : ""
                        }`}
                        disabled={!sectionEditorWritable || sectionEditorFormattingTargetRef.current === "label" || Boolean(sectionEditorSelectedImageId)}
                        onMouseDown={preserveSectionEditorSelection}
                        onClick={() => applySectionEditorCommand("insertUnorderedList")}
                      >
                        <ListBulletsGlyphSmall />
                      </SectionEditorToolbarIconButton>
                      <SectionEditorToolbarIconButton
                        label="Numbered list"
                        buttonClassName={`${SECTION_EDITOR_TOOLBAR_BUTTON_CLASS} ${
                          sectionEditorCurrentListKind === "ordered" ? SECTION_EDITOR_TOOLBAR_BUTTON_ACTIVE_CLASS : ""
                        }`}
                        disabled={!sectionEditorWritable || sectionEditorFormattingTargetRef.current === "label" || Boolean(sectionEditorSelectedImageId)}
                        onMouseDown={preserveSectionEditorSelection}
                        onClick={() => applySectionEditorCommand("insertOrderedList")}
                      >
                        <ListNumbersGlyphSmall />
                      </SectionEditorToolbarIconButton>
                      <SectionEditorToolbarIconButton
                        label="Quote on/off"
                        buttonClassName={`${SECTION_EDITOR_TOOLBAR_BUTTON_CLASS} ${
                          sectionEditorCurrentQuoteActive ? SECTION_EDITOR_TOOLBAR_BUTTON_ACTIVE_CLASS : ""
                        }`}
                        disabled={!sectionEditorWritable || sectionEditorFormattingTargetRef.current === "label" || Boolean(sectionEditorSelectedImageId)}
                        onMouseDown={preserveSectionEditorSelection}
                        onClick={() => toggleSectionEditorQuoteBlock()}
                      >
                        <QuoteGlyphSmall />
                      </SectionEditorToolbarIconButton>
                      <SectionEditorToolbarIconButton
                        label="Divider"
                        disabled={!sectionEditorWritable || sectionEditorFormattingTargetRef.current === "label" || Boolean(sectionEditorSelectedImageId)}
                        onMouseDown={preserveSectionEditorSelection}
                        onClick={() => insertSectionEditorDivider()}
                      >
                        <DividerGlyphSmall />
                        <span>Divider</span>
                      </SectionEditorToolbarIconButton>
                      <SectionEditorToolbarIconButton
                        label="Page break"
                        disabled={!sectionEditorWritable || sectionEditorFormattingTargetRef.current === "label" || Boolean(sectionEditorSelectedImageId)}
                        onMouseDown={preserveSectionEditorSelection}
                        onClick={() => insertSectionEditorPageBreak()}
                      >
                        <PageBreakGlyphSmall />
                        <span>Page break</span>
                      </SectionEditorToolbarIconButton>
                      <div className="relative" ref={sectionEditorTableMenuRef}>
                        <SectionEditorToolbarIconButton
                          label={sectionEditorActiveTableState ? "Table tools" : "Table"}
                          disabled={!sectionEditorWritable || sectionEditorFormattingTargetRef.current === "label" || Boolean(sectionEditorSelectedImageId)}
                          buttonClassName={`${SECTION_EDITOR_TOOLBAR_BUTTON_CLASS} ${
                            sectionEditorTableMenuOpen || sectionEditorActiveTableState
                              ? SECTION_EDITOR_TOOLBAR_BUTTON_ACTIVE_CLASS
                              : ""
                          }`}
                          onMouseDown={preserveSectionEditorSelection}
                          onClick={() => {
                            setSectionEditorFocusTarget("panel");
                            setSectionNumberingPanelOpen(false);
                            setSectionEditorColorPickerOpen(false);
                            setSectionEditorTableMenuOpen((current) => {
                              if (!current && !sectionEditorActiveTableState) {
                                captureSectionEditorInsertRange();
                              }
                              return !current;
                            });
                          }}
                        >
                          <TableGridGlyphSmall />
                        </SectionEditorToolbarIconButton>
                        {sectionEditorTableMenuOpen ? (
                          <div
                            className="absolute right-0 top-full z-20 mt-2 w-[min(92vw,272px)] max-w-[calc(100vw-2rem)] rounded-[16px] border border-[rgba(126,154,176,0.2)] bg-[rgba(7,20,31,0.98)] p-3 shadow-[0_24px_48px_rgba(0,0,0,0.36)]"
                            onMouseDown={preserveSectionEditorPanelFocus}
                          >
                            {sectionEditorActiveTableState ? (
                              <div className="space-y-3 rounded-[14px] border border-[rgba(126,154,176,0.16)] bg-[rgba(7,22,34,0.82)] p-3">
                                <div className="flex items-center justify-between rounded-[12px] border border-[rgba(126,154,176,0.14)] bg-[rgba(8,24,37,0.74)] px-3 py-2">
                                  <div className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                                    Table
                                  </div>
                                  <div className="rounded-full border border-[rgba(95,220,255,0.18)] bg-[rgba(18,56,81,0.58)] px-2.5 py-1 text-[0.74rem] font-semibold tabular-nums text-[#d7f3ff]">
                                    {sectionEditorActiveTableState.columnCount} x {sectionEditorActiveTableState.rowCount}
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    className="flex items-center gap-2 rounded-[11px] border border-[rgba(126,154,176,0.16)] bg-[rgba(8,24,37,0.84)] px-3 py-2 text-left text-[0.78rem] font-medium text-[var(--ode-text)] transition hover:border-[rgba(95,220,255,0.28)] hover:bg-[rgba(14,38,56,0.96)]"
                                    onMouseDown={preserveSectionEditorPanelFocus}
                                    onClick={() => {
                                      runSectionEditorTableAction(() => insertSectionEditorTableRowAtSelection("above"));
                                    }}
                                  >
                                    <ArrowUpGlyphSmall />
                                    <span>Add row above</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="flex items-center gap-2 rounded-[11px] border border-[rgba(126,154,176,0.16)] bg-[rgba(8,24,37,0.84)] px-3 py-2 text-left text-[0.78rem] font-medium text-[var(--ode-text)] transition hover:border-[rgba(95,220,255,0.28)] hover:bg-[rgba(14,38,56,0.96)]"
                                    onMouseDown={preserveSectionEditorPanelFocus}
                                    onClick={() => {
                                      runSectionEditorTableAction(() => insertSectionEditorTableRowAtSelection("below"));
                                    }}
                                  >
                                    <ArrowDownGlyphSmall />
                                    <span>Add row below</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="flex items-center gap-2 rounded-[11px] border border-[rgba(126,154,176,0.16)] bg-[rgba(8,24,37,0.84)] px-3 py-2 text-left text-[0.78rem] font-medium text-[var(--ode-text)] transition hover:border-[rgba(95,220,255,0.28)] hover:bg-[rgba(14,38,56,0.96)]"
                                    onMouseDown={preserveSectionEditorPanelFocus}
                                    onClick={() => {
                                      runSectionEditorTableAction(() => insertSectionEditorTableColumnAtSelection("left"));
                                    }}
                                  >
                                    <ArrowLeftGlyphSmall />
                                    <span>Add column left</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="flex items-center gap-2 rounded-[11px] border border-[rgba(126,154,176,0.16)] bg-[rgba(8,24,37,0.84)] px-3 py-2 text-left text-[0.78rem] font-medium text-[var(--ode-text)] transition hover:border-[rgba(95,220,255,0.28)] hover:bg-[rgba(14,38,56,0.96)]"
                                    onMouseDown={preserveSectionEditorPanelFocus}
                                    onClick={() => {
                                      runSectionEditorTableAction(() => insertSectionEditorTableColumnAtSelection("right"));
                                    }}
                                  >
                                    <ArrowRightGlyphSmall />
                                    <span>Add column right</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="flex items-center gap-2 rounded-[11px] border border-[rgba(255,143,143,0.18)] bg-[rgba(67,24,24,0.4)] px-3 py-2 text-left text-[0.78rem] font-medium text-[#ffd5d5] transition hover:border-[rgba(255,167,167,0.28)] hover:bg-[rgba(92,31,31,0.52)]"
                                    onMouseDown={preserveSectionEditorPanelFocus}
                                    onClick={() => {
                                      runSectionEditorTableAction(() => removeSectionEditorTableRowAtSelection());
                                    }}
                                  >
                                    <TrashGlyphSmall />
                                    <span>Delete row</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="flex items-center gap-2 rounded-[11px] border border-[rgba(255,143,143,0.18)] bg-[rgba(67,24,24,0.4)] px-3 py-2 text-left text-[0.78rem] font-medium text-[#ffd5d5] transition hover:border-[rgba(255,167,167,0.28)] hover:bg-[rgba(92,31,31,0.52)]"
                                    onMouseDown={preserveSectionEditorPanelFocus}
                                    onClick={() => {
                                      runSectionEditorTableAction(() => removeSectionEditorTableColumnAtSelection());
                                    }}
                                  >
                                    <TrashGlyphSmall />
                                    <span>Delete column</span>
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  className="flex w-full items-center justify-center gap-2 rounded-[11px] border border-[rgba(255,143,143,0.24)] bg-[rgba(88,26,26,0.5)] px-3 py-2.5 text-[0.8rem] font-semibold text-[#ffe2e2] transition hover:border-[rgba(255,167,167,0.32)] hover:bg-[rgba(110,34,34,0.64)]"
                                  onMouseDown={preserveSectionEditorPanelFocus}
                                  onClick={() => {
                                    runSectionEditorTableAction(() => removeSectionEditorCurrentTable());
                                  }}
                                >
                                  <TrashGlyphSmall />
                                  <span>Delete table</span>
                                </button>
                              </div>
                            ) : (
                              <div className="rounded-[14px] border border-[rgba(126,154,176,0.16)] bg-[rgba(7,22,34,0.82)] p-3">
                                <div
                                  className="grid gap-[3px]"
                                  style={{
                                    gridTemplateColumns: `repeat(${SECTION_EDITOR_INSERT_TABLE_GRID_COLUMNS}, minmax(0, 1fr))`
                                  }}
                                >
                                  {Array.from({ length: SECTION_EDITOR_INSERT_TABLE_GRID_ROWS }, (_, rowIndex) =>
                                    Array.from({ length: SECTION_EDITOR_INSERT_TABLE_GRID_COLUMNS }, (_, columnIndex) => {
                                      const nextRows = rowIndex + 1;
                                      const nextColumns = columnIndex + 1;
                                      const selected =
                                        nextRows <= sectionEditorInsertTableRows &&
                                        nextColumns <= sectionEditorInsertTableColumns;
                                      return (
                                        <button
                                          key={`table-grid-${nextRows}-${nextColumns}`}
                                          type="button"
                                          aria-label={`Insert ${nextColumns} by ${nextRows} table`}
                                          className={`h-4 w-4 rounded-[3px] border transition ${
                                            selected
                                              ? "border-[rgba(95,220,255,0.7)] bg-[rgba(56,189,248,0.9)] shadow-[0_0_0_1px_rgba(186,230,253,0.18)_inset]"
                                              : "border-[rgba(126,154,176,0.22)] bg-[rgba(9,28,42,0.9)] hover:border-[rgba(95,220,255,0.36)] hover:bg-[rgba(17,46,67,0.96)]"
                                          }`}
                                          onMouseDown={preserveSectionEditorPanelFocus}
                                          onMouseEnter={() => {
                                            setSectionEditorFocusTarget("panel");
                                            setSectionEditorInsertTableRows(nextRows);
                                            setSectionEditorInsertTableColumns(nextColumns);
                                          }}
                                          onFocus={() => {
                                            setSectionEditorFocusTarget("panel");
                                            setSectionEditorInsertTableRows(nextRows);
                                            setSectionEditorInsertTableColumns(nextColumns);
                                          }}
                                          onClick={() => {
                                            setSectionEditorInsertTableRows(nextRows);
                                            setSectionEditorInsertTableColumns(nextColumns);
                                            insertSectionEditorTable(nextRows, nextColumns);
                                          }}
                                        >
                                          <span className="sr-only">{`${nextColumns} x ${nextRows}`}</span>
                                        </button>
                                      );
                                    })
                                  )}
                                </div>
                                <div className="mt-3 text-center text-[0.74rem] font-semibold tabular-nums tracking-[0.08em] text-[#d7f3ff]">
                                  {sectionEditorInsertTableColumns} x {sectionEditorInsertTableRows}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                      <SectionEditorToolbarIconButton
                        label="Node link"
                        disabled={!sectionEditorWritable || sectionEditorFormattingTargetRef.current === "label" || Boolean(sectionEditorSelectedImageId)}
                        buttonClassName={`${SECTION_EDITOR_TOOLBAR_BUTTON_CLASS} ${
                          sectionNodeLinkPickerOpen ? SECTION_EDITOR_TOOLBAR_BUTTON_ACTIVE_CLASS : ""
                        }`}
                        onMouseDown={preserveSectionEditorSelection}
                        onClick={() => {
                          setSectionEditorStyleMenuOpen(false);
                          setSectionNumberingPanelOpen(false);
                          setSectionEditorColorPickerOpen(false);
                          setSectionEditorTableMenuOpen(false);
                          setSectionAppPickerOpen(false);
                          setSectionAppQuery("");
                          clearSectionWebsiteLinkBookmark();
                          setSectionWebsiteLinkState(null);
                          captureSectionEditorInsertRange();
                          sectionWebsiteLinkRangeRef.current = null;
                          sectionWebsiteLinkSerializedRangeRef.current = null;
                          setSectionNodeLinkPickerOpen((current) => !current);
                        }}
                      >
                        <NodeLinkGlyphSmall />
                        <span>Link Node</span>
                      </SectionEditorToolbarIconButton>
                      <SectionEditorToolbarIconButton
                        label="Web link"
                        disabled={!sectionEditorWritable || sectionEditorFormattingTargetRef.current === "label" || Boolean(sectionEditorSelectedImageId)}
                        buttonClassName={`${SECTION_EDITOR_TOOLBAR_BUTTON_CLASS} ${
                          sectionWebsiteLinkState ? SECTION_EDITOR_TOOLBAR_BUTTON_ACTIVE_CLASS : ""
                        }`}
                        onMouseDown={preserveSectionEditorSelection}
                        onClick={openSectionWebsiteLinkDialog}
                      >
                        <LinkGlyphSmall />
                        <span>Link Website</span>
                      </SectionEditorToolbarIconButton>
                      <SectionEditorToolbarIconButton
                        label="App link"
                        disabled={!sectionEditorWritable || sectionEditorFormattingTargetRef.current === "label" || Boolean(sectionEditorSelectedImageId)}
                        buttonClassName={`${SECTION_EDITOR_TOOLBAR_BUTTON_CLASS} ${
                          sectionAppPickerOpen ? SECTION_EDITOR_TOOLBAR_BUTTON_ACTIVE_CLASS : ""
                        }`}
                        onMouseDown={preserveSectionEditorSelection}
                        onClick={() => {
                          setSectionEditorStyleMenuOpen(false);
                          setSectionNumberingPanelOpen(false);
                          setSectionEditorColorPickerOpen(false);
                          setSectionEditorTableMenuOpen(false);
                          setSectionNodeLinkPickerOpen(false);
                          setSectionNodeLinkQuery("");
                          clearSectionWebsiteLinkBookmark();
                          setSectionWebsiteLinkState(null);
                          captureSectionEditorInsertRange();
                          sectionWebsiteLinkRangeRef.current = null;
                          sectionWebsiteLinkSerializedRangeRef.current = null;
                          setSectionAppPickerOpen((current) => !current);
                        }}
                      >
                        <OpenGlyphSmall />
                        <span>Link App</span>
                      </SectionEditorToolbarIconButton>
                      <SectionEditorToolbarIconButton
                        label={sectionPhotoAdding ? "Adding photo..." : "Photo"}
                        disabled={
                          sectionPhotoAdding ||
                          !sectionEditorWritable ||
                          sectionEditorFormattingTargetRef.current === "label" ||
                          Boolean(sectionEditorSelectedImageId)
                        }
                        buttonClassName={`${SECTION_EDITOR_TOOLBAR_BUTTON_CLASS} ${
                          sectionPhotoAdding ? SECTION_EDITOR_TOOLBAR_BUTTON_ACTIVE_CLASS : ""
                        }`}
                        onMouseDown={preserveSectionEditorSelection}
                        onClick={() => {
                          setSectionEditorStyleMenuOpen(false);
                          setSectionNumberingPanelOpen(false);
                          setSectionEditorColorPickerOpen(false);
                          setSectionEditorTableMenuOpen(false);
                          void handleAddSectionPhotos();
                        }}
                      >
                        <ImageGlyphSmall />
                        <span>{sectionPhotoAdding ? "Inserting photo..." : "Insert Photo"}</span>
                      </SectionEditorToolbarIconButton>
                    </div>
                  </div>
                </div>
              </div>
            {sectionNodeLinkPickerOpen ? (
              <div className="shrink-0 px-5 pt-4 md:px-7">
                <div className={`${SECTION_EDITOR_PANEL_CARD_CLASS} max-h-[min(50vh,540px)] overflow-hidden p-4 md:p-5`}>
                  <div className={SECTION_EDITOR_SECTION_LABEL_CLASS}>Node Link</div>
                  <input
                    className={`${SECTION_EDITOR_INPUT_CLASS} mt-4 h-11 rounded-[14px] px-4`}
                    style={SECTION_EDITOR_INPUT_STYLE}
                    value={sectionNodeLinkQuery}
                    onChange={(event) => setSectionNodeLinkQuery(event.target.value)}
                    placeholder="Search nodes"
                  />
                  <div className="mt-4 grid min-h-0 gap-4 xl:grid-cols-2">
                    <div className="min-h-0">
                      <div className="mb-2 text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
                        This Workspace
                      </div>
                      <div className="max-h-[min(34vh,360px)] space-y-2 overflow-y-auto pr-1">
                        {currentWorkspaceSectionNodeLinkCandidates.length > 0 ? (
                          currentWorkspaceSectionNodeLinkCandidates.map((candidate) => (
                            <button
                              key={candidate.node.id}
                              type="button"
                              className="flex w-full flex-col rounded-[18px] border border-[var(--ode-border)] bg-[rgba(5,29,46,0.76)] px-4 py-3 text-left transition hover:border-[var(--ode-border-strong)] hover:bg-[rgba(7,37,58,0.84)]"
                              onMouseDown={preserveSectionEditorSelection}
                              onClick={() => insertSectionNodeLink(candidate.node)}
                            >
                              <span className="ode-wrap-text text-[0.92rem] font-medium text-[var(--ode-text)]">
                                {getNodeDisplayName(candidate.node)}
                              </span>
                              <span className="ode-wrap-text mt-1 text-[0.8rem] leading-5 text-[var(--ode-text-muted)]">
                                {candidate.pathLabel}
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="rounded-[18px] border border-dashed border-[var(--ode-border)] px-4 py-3 text-[0.84rem] text-[var(--ode-text-muted)]">
                            No matches here.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="min-h-0">
                      <div className="mb-2 text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
                        Other Workspaces
                      </div>
                      <div className="max-h-[min(34vh,360px)] space-y-2 overflow-y-auto pr-1">
                        {otherWorkspaceSectionNodeLinkCandidates.length > 0 ? (
                          otherWorkspaceSectionNodeLinkCandidates.map((candidate) => (
                            <button
                              key={candidate.node.id}
                              type="button"
                              className="flex w-full flex-col rounded-[18px] border border-[var(--ode-border)] bg-[rgba(5,29,46,0.76)] px-4 py-3 text-left transition hover:border-[var(--ode-border-strong)] hover:bg-[rgba(7,37,58,0.84)]"
                              onMouseDown={preserveSectionEditorSelection}
                              onClick={() => insertSectionNodeLink(candidate.node)}
                            >
                              <span className="ode-wrap-text text-[0.92rem] font-medium text-[var(--ode-text)]">
                                {getNodeDisplayName(candidate.node)}
                                <span className="ml-2 text-[0.74rem] uppercase tracking-[0.14em] text-[var(--ode-text-muted)]">
                                  {candidate.workspaceName}
                                </span>
                              </span>
                              <span className="ode-wrap-text mt-1 text-[0.8rem] leading-5 text-[var(--ode-text-muted)]">
                                {candidate.pathLabel}
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="rounded-[18px] border border-dashed border-[var(--ode-border)] px-4 py-3 text-[0.84rem] text-[var(--ode-text-muted)]">
                            No matches elsewhere.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {sectionAppPickerOpen ? (
              <div className="shrink-0 px-5 pt-4 md:px-7">
                <div className={`${SECTION_EDITOR_PANEL_CARD_CLASS} p-4 md:p-5`}>
                  <div className={SECTION_EDITOR_SECTION_LABEL_CLASS}>App Link</div>
                  <input
                    className={`${SECTION_EDITOR_INPUT_CLASS} mt-4 h-11 rounded-[14px] px-4`}
                    style={SECTION_EDITOR_INPUT_STYLE}
                    value={sectionAppQuery}
                    onChange={(event) => setSectionAppQuery(event.target.value)}
                    placeholder="Search apps"
                  />
                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <div>
                      <div className="mb-2 text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
                        This Workspace
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {currentWorkspaceSectionAppLinkCandidates.length > 0 ? (
                          currentWorkspaceSectionAppLinkCandidates.map((candidate) => (
                            <OdeTooltip
                              key={`${candidate.item.id}-${candidate.item.target}`}
                              label={candidate.item.label || "App"}
                              side="top"
                            >
                              <button
                                type="button"
                                className="group inline-flex h-11 w-11 items-center justify-center rounded-[12px] bg-transparent transition duration-150 hover:-translate-y-[1px] hover:bg-[rgba(18,75,108,0.22)]"
                                onMouseDown={preserveSectionEditorSelection}
                                onClick={() => {
                                  void insertSectionAppLink(candidate);
                                }}
                                aria-label={candidate.item.label || "App"}
                              >
                                <QuickAppIcon item={candidate.item} variant="dock" />
                              </button>
                            </OdeTooltip>
                          ))
                        ) : (
                          <div className="w-full rounded-[18px] border border-dashed border-[var(--ode-border)] px-4 py-3 text-[0.84rem] text-[var(--ode-text-muted)]">
                            No apps here.
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
                        Other Workspaces
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {otherWorkspaceSectionAppLinkCandidates.length > 0 ? (
                          otherWorkspaceSectionAppLinkCandidates.map((candidate) => (
                            <OdeTooltip
                              key={`${candidate.item.id}-${candidate.item.target}`}
                              label={candidate.item.label || "App"}
                              side="top"
                            >
                              <button
                                type="button"
                                className="group inline-flex h-11 w-11 items-center justify-center rounded-[12px] bg-transparent transition duration-150 hover:-translate-y-[1px] hover:bg-[rgba(18,75,108,0.22)]"
                                onMouseDown={preserveSectionEditorSelection}
                                onClick={() => {
                                  void insertSectionAppLink(candidate);
                                }}
                                aria-label={candidate.item.label || "App"}
                              >
                                <QuickAppIcon item={candidate.item} variant="dock" />
                              </button>
                            </OdeTooltip>
                          ))
                        ) : (
                          <div className="w-full rounded-[18px] border border-dashed border-[var(--ode-border)] px-4 py-3 text-[0.84rem] text-[var(--ode-text-muted)]">
                            No apps elsewhere.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3 md:px-5 md:pb-5">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] border border-[rgba(126,154,176,0.16)] bg-[rgba(232,238,244,0.06)]">
                <div
                  ref={sectionEditorDocumentViewportRef}
                  className="relative min-h-0 flex-1 overflow-auto bg-[linear-gradient(180deg,#cfd8e3,#e7edf3)] px-1.5 py-2 md:px-2 md:py-3"
                >
                  {sectionEditorSelectedImageId && sectionEditorSelectedImageOverlay ? (
                    <div
                      className="pointer-events-none absolute z-20"
                      style={{
                        top: sectionEditorSelectedImageOverlay.top,
                        left: sectionEditorSelectedImageOverlay.left,
                        width: sectionEditorSelectedImageOverlay.width,
                        height: sectionEditorSelectedImageOverlay.height
                      }}
                    >
                      <div className="absolute inset-0 rounded-[8px] border-2 border-[#38bdf8] shadow-[0_0_0_1px_rgba(255,255,255,0.88)]" />
                      <div className="pointer-events-auto absolute left-2 top-2 flex items-center gap-2">
                        <div className="rounded-full border border-[rgba(126,154,176,0.22)] bg-[rgba(7,22,34,0.86)] px-2.5 py-1 text-[0.68rem] text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)]">
                          {Math.round(sectionEditorSelectedImageOverlay.width)}px
                        </div>
                        <button
                          type="button"
                          className="rounded-full border border-[rgba(126,154,176,0.22)] bg-[rgba(7,22,34,0.92)] px-3 py-1 text-[0.68rem] uppercase tracking-[0.14em] text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)] transition hover:border-[rgba(95,220,255,0.4)] hover:bg-[rgba(13,39,58,0.96)]"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            fitSectionEditorSelectedImageToViewport();
                          }}
                        >
                          Fit width
                        </button>
                      </div>
                      <button
                        type="button"
                        aria-label="Resize photo"
                        className="pointer-events-auto absolute bottom-[-8px] right-[-8px] flex h-5 w-5 items-center justify-center rounded-full border border-white bg-[#38bdf8] shadow-[0_10px_24px_rgba(14,165,233,0.34)]"
                        onMouseDown={handleSectionEditorSelectedImageResizeStart}
                      >
                        <span className="sr-only">Resize photo</span>
                        <span
                          aria-hidden="true"
                          className="absolute inset-[4px] rounded-[2px] border-b-2 border-r-2 border-white"
                        />
                      </button>
                    </div>
                  ) : null}
                    <div
                      ref={sectionEditorSurfaceRef}
                      contentEditable
                      suppressContentEditableWarning
                      className={SECTION_EDITOR_DOCUMENT_SURFACE_CLASS}
                      style={{
                        ...procedureWorkspaceRichDocumentStyle,
                        ...resolveSectionTextAlignmentStyle(sectionEditorDraft.textAlignment),
                        caretColor: sectionEditorFormattingDefaults.textColor
                      }}
                     onMouseDown={() => {
                       setSectionEditorStyleMenuOpen(false);
                       setSectionEditorFocusTarget("content");
                       setSectionNumberingPanelOpen(false);
                       setSectionEditorColorPickerOpen(false);
                       setSectionEditorTableMenuOpen(false);
                       setSectionEditorLineSpacingMenuOpen(false);
                     }}
                    onKeyDown={handleSectionEditorKeyDown}
                    onPaste={handleSectionEditorPaste}
                    onInput={() => syncSectionEditorContentFromDom()}
                    onMouseUp={() => syncSectionEditorSelection()}
                     onFocus={() => {
                       setSectionEditorStyleMenuOpen(false);
                       setSectionEditorFocusTarget("content");
                       setSectionEditorColorPickerOpen(false);
                       setSectionEditorTableMenuOpen(false);
                       setSectionEditorLineSpacingMenuOpen(false);
                       syncSectionEditorSelection();
                     }}
                    onKeyUp={() => syncSectionEditorSelection()}
                    onBlur={() => syncSectionEditorContentFromDom(false)}
                    onClick={handleSectionEditorSurfaceClick}
                    onContextMenu={openSectionEditorContentContextMenu}
                    data-placeholder="Start writing here. Keep scrolling to build a longer working document."
                  />
                </div>
              </div>
            </div>

            </div>

            <div className="shrink-0 border-t border-[rgba(126,154,176,0.16)] bg-[rgba(9,23,34,0.96)] px-4 py-3 md:px-5">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className={SECTION_EDITOR_SECTION_LABEL_CLASS}>Attachments</div>
                    <div className="rounded-full border border-[rgba(126,154,176,0.16)] bg-[rgba(7,22,34,0.56)] px-2.5 py-1 text-[0.66rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                      {sectionEditorFileReferences.length}
                    </div>
                    <button
                      type="button"
                      className={`${PROCEDURE_MODAL_SECONDARY_BUTTON_CLASS} inline-flex h-8 items-center gap-2 rounded-[10px] px-3 py-0 text-[0.64rem] tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60`}
                      disabled={sectionAttachmentAdding || !sectionEditorWritable}
                      onClick={() => {
                        void handleAddSectionAttachments();
                      }}
                    >
                      <FileGlyphSmall />
                      <span>{sectionAttachmentAdding ? "Adding..." : "Add file"}</span>
                    </button>
                  </div>
                  {sectionEditorFileReferences.length > 0 ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {sectionEditorFileReferences.map((reference) => {
                        const referenceWorkspaceRootId = findProcedureWorkspaceRootId(
                          reference.id,
                          globalNodeById,
                          workspaceRootIdSet
                        );
                        const referenceWorkspaceName = resolveWorkspaceDisplayName(
                          referenceWorkspaceRootId,
                          projectByRootId,
                          globalNodeById,
                          workspaceName
                        );
                        const attachmentTitle = getProcedureFileDisplayTitle(reference.name);
                        return (
                          <div
                            key={reference.id}
                            className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-[10px] border border-[rgba(126,154,176,0.16)] bg-[rgba(7,22,34,0.58)] px-2.5 py-1.5"
                          >
                            <OdeTooltip label={referenceWorkspaceName}>
                              <button
                                type="button"
                                className="max-w-[280px] truncate text-left text-[0.8rem] font-medium text-[var(--ode-text)] transition hover:text-[var(--ode-accent)]"
                                onClick={() => {
                                  void onOpenLinkedFile(reference.id);
                                }}
                              >
                                {attachmentTitle}
                              </button>
                            </OdeTooltip>
                            <SectionEditorToolbarIconButton
                              label="Link"
                              ariaLabel={`Insert ${attachmentTitle} link`}
                              buttonClassName={SECTION_EDITOR_TOOLBAR_BUTTON_SMALL_CLASS}
                              onMouseDown={preserveSectionEditorSelection}
                              onClick={() => insertSectionReferenceLink(reference)}
                            >
                              <NodeLinkGlyphSmall />
                            </SectionEditorToolbarIconButton>
                            <SectionEditorToolbarIconButton
                              label="Open"
                              ariaLabel={`Open ${attachmentTitle}`}
                              buttonClassName={SECTION_EDITOR_TOOLBAR_BUTTON_SMALL_CLASS}
                              onClick={() => {
                                void onOpenLinkedFile(reference.id);
                              }}
                            >
                              <OpenGlyphSmall />
                            </SectionEditorToolbarIconButton>
                            <SectionEditorToolbarIconButton
                              label="Remove"
                              ariaLabel={`Delete ${attachmentTitle}`}
                              buttonClassName={`${SECTION_EDITOR_TOOLBAR_BUTTON_SMALL_CLASS} border-[rgba(211,127,127,0.34)] bg-[rgba(83,26,26,0.16)] text-[#ffc7c7] hover:border-[rgba(244,157,157,0.68)] hover:bg-[rgba(104,35,35,0.28)] hover:text-[#fff0f0]`}
                              disabled={sectionAttachmentDeletingId === reference.id}
                              onClick={() => requestDeleteAttachment(reference)}
                            >
                              <TrashGlyphSmall />
                            </SectionEditorToolbarIconButton>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-2 text-[0.82rem] text-[var(--ode-text-muted)]">
                      No attachments yet.
                    </div>
                  )}
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    className={`${PROCEDURE_MODAL_SECONDARY_BUTTON_CLASS} h-10 w-full rounded-[12px] px-4 py-0 text-[0.68rem] sm:w-auto`}
                    onClick={() => closeSectionEditor()}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={`${PROCEDURE_MODAL_PRIMARY_BUTTON_CLASS} h-10 w-full rounded-[12px] px-4 py-0 text-[0.68rem] sm:w-auto disabled:cursor-not-allowed disabled:opacity-60`}
                    disabled={sectionEditorSaving || !sectionEditorWritable}
                    onClick={() => {
                      void handleSaveSection();
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <SectionEditorContextMenu
        menu={sectionEditorContextMenu}
        items={sectionEditorContextMenuItems}
        onClose={closeSectionEditorContextMenu}
      />

      {sectionWebsiteLinkState ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(12,23,38,0.48)] px-4">
          <div
            className={`${PROCEDURE_MODAL_PANEL_CLASS} max-w-[540px]`}
            onMouseDown={(event) => {
              event.stopPropagation();
              setSectionEditorFocusTarget("panel");
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="text-[1.4rem] font-semibold text-[var(--ode-text)]">Web Link</div>
              <OdeTooltip label="Close link dialog">
                <button
                  type="button"
                  className={PROCEDURE_MODAL_CLOSE_BUTTON_CLASS}
                  onClick={dismissSectionWebsiteLinkDialog}
                >
                  Close
                </button>
              </OdeTooltip>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block">
                <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">Text</div>
                <input
                  ref={sectionWebsiteLinkLabelInputRef}
                  type="text"
                  className={`${SECTION_EDITOR_INPUT_CLASS} h-11 rounded-[14px] px-4`}
                  style={SECTION_EDITOR_INPUT_STYLE}
                  value={sectionWebsiteLinkState.label}
                  onFocus={() => {
                    setSectionEditorFocusTarget("panel");
                  }}
                  onChange={(event) =>
                    setSectionWebsiteLinkState((current) => (current ? { ...current, label: event.target.value } : current))
                  }
                />
              </label>

              <label className="block">
                <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">Address</div>
                <input
                  ref={sectionWebsiteLinkUrlInputRef}
                  type="url"
                  className={`${SECTION_EDITOR_INPUT_CLASS} h-11 rounded-[14px] px-4`}
                  style={SECTION_EDITOR_INPUT_STYLE}
                  value={sectionWebsiteLinkState.href}
                  onFocus={() => {
                    setSectionEditorFocusTarget("panel");
                  }}
                  onChange={(event) =>
                    setSectionWebsiteLinkState((current) => (current ? { ...current, href: event.target.value } : current))
                  }
                  placeholder="https://example.com"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className={PROCEDURE_MODAL_SECONDARY_BUTTON_CLASS}
                onClick={dismissSectionWebsiteLinkDialog}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${PROCEDURE_MODAL_PRIMARY_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
                disabled={sectionEditorSaving || !sectionEditorWritable}
                onClick={() => {
                  confirmSectionWebsiteLink();
                }}
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {tableViewEditorNode && tableViewEditorDraft ? (
        <div className={PROCEDURE_MODAL_OVERLAY_CLASS}>
          <div className={`${PROCEDURE_MODAL_PANEL_CLASS} flex max-h-[94vh] max-w-[760px] flex-col overflow-hidden`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[0.78rem] uppercase tracking-[0.18em] text-[var(--ode-accent)]">Table View</div>
                <div className="mt-2 text-[1.4rem] font-semibold text-[var(--ode-text)]">{tableViewEditorNode.name}</div>
                <div className="mt-1 text-[0.95rem] text-[var(--ode-text-muted)]">
                  Build a richer table layout with grouped records, merged column headers, and shared info blocks.
                </div>
              </div>
              <OdeTooltip label="Close table view editor">
                <button type="button" className={PROCEDURE_MODAL_CLOSE_BUTTON_CLASS} onClick={closeTableViewEditor}>
                  Close
                </button>
              </OdeTooltip>
            </div>

            <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-2">
              <div className="space-y-5">
                <label className="block">
                  <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">Display Mode</div>
                  <select
                    className="ode-input h-11 w-full rounded-[16px] px-4"
                    value={tableViewEditorDraft.viewMode}
                    onChange={(event) =>
                      setTableViewEditorDraft((current) =>
                        current
                          ? {
                              ...current,
                              viewMode:
                                event.target.value === "matrix"
                                  ? "matrix"
                                  : event.target.value === "pivot"
                                  ? "pivot"
                                  : "list"
                            }
                          : current
                      )
                    }
                  >
                    <option value="list">Standard List</option>
                    <option value="matrix">Advanced Matrix</option>
                    <option value="pivot">Pivot Count</option>
                  </select>
                </label>

                {tableViewEditorDraft.viewMode === "matrix" ? (
                  <>
                    <label className="block">
                      <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">Group Records By</div>
                      <select
                        className="ode-input h-11 w-full rounded-[16px] px-4"
                        value={tableViewEditorDraft.groupByFieldId}
                        onChange={(event) =>
                          setTableViewEditorDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  groupByFieldId: event.target.value,
                                  infoFieldIds: current.infoFieldIds.filter((fieldId) => fieldId !== event.target.value)
                                }
                              : current
                          )
                        }
                      >
                        <option value="">Do not group</option>
                        {tableViewEditorFields.map((entry) => (
                          <option key={`${tableViewEditorNode.id}-group-${entry.node.id}`} value={entry.node.id}>
                            {entry.node.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="rounded-[22px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.42)] px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[0.82rem] text-[var(--ode-text-muted)]">Merged Info Fields</div>
                          <div className="mt-1 text-[0.76rem] text-[var(--ode-text-muted)]">
                            These fields appear above each matrix group as shared information.
                          </div>
                        </div>
                        <div className="text-[0.72rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                          {tableViewEditorDraft.infoFieldIds.length} selected
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2 md:grid-cols-2">
                        {tableViewEditorFields.map((entry) => {
                          const disabled = entry.node.id === tableViewEditorDraft.groupByFieldId;
                          const checked = tableViewEditorDraft.infoFieldIds.includes(entry.node.id);
                          return (
                            <label
                              key={`${tableViewEditorNode.id}-info-${entry.node.id}`}
                              className={`flex items-center gap-3 rounded-[16px] border px-3 py-3 text-[0.92rem] ${
                                disabled
                                  ? "cursor-not-allowed border-[var(--ode-border)] bg-[rgba(6,24,40,0.42)] text-[var(--ode-text-muted)] opacity-60"
                                  : "border-[var(--ode-border)] bg-[rgba(4,24,38,0.62)] text-[var(--ode-text)]"
                              }`}
                            >
                              <input
                                type="checkbox"
                                disabled={disabled}
                                checked={checked}
                                onChange={(event) =>
                                  setTableViewEditorDraft((current) => {
                                    if (!current) return current;
                                    const nextSelected = event.target.checked
                                      ? [...current.infoFieldIds, entry.node.id]
                                      : current.infoFieldIds.filter((fieldId) => fieldId !== entry.node.id);
                                    return {
                                      ...current,
                                      infoFieldIds: Array.from(new Set(nextSelected))
                                    };
                                  })
                                }
                              />
                              <span>{entry.node.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <label className="block">
                      <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">Matrix Row Field</div>
                      <select
                        className="ode-input h-11 w-full rounded-[16px] px-4"
                        value={tableViewEditorDraft.matrixRowFieldId}
                        onChange={(event) =>
                          setTableViewEditorDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  matrixRowFieldId: event.target.value,
                                  matrixColumnFieldIds: current.matrixColumnFieldIds.filter(
                                    (fieldId) => fieldId !== event.target.value
                                  )
                                }
                              : current
                          )
                        }
                      >
                        <option value="">Select a row field</option>
                        {tableViewEditorFields.map((entry) => (
                          <option key={`${tableViewEditorNode.id}-row-${entry.node.id}`} value={entry.node.id}>
                            {entry.node.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">Merged Header Label</div>
                      <input
                        type="text"
                        className="ode-input h-11 w-full rounded-[16px] px-4"
                        value={tableViewEditorDraft.matrixColumnGroupLabel}
                        onChange={(event) =>
                          setTableViewEditorDraft((current) =>
                            current ? { ...current, matrixColumnGroupLabel: event.target.value } : current
                          )
                        }
                        placeholder="Roles par defaut?"
                      />
                    </label>

                    <div className="rounded-[22px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.42)] px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[0.82rem] text-[var(--ode-text-muted)]">Matrix Columns</div>
                          <div className="mt-1 text-[0.76rem] text-[var(--ode-text-muted)]">
                            Pick the fields that should sit under the merged header. Any row with empty matrix cells is rendered as a section row.
                          </div>
                        </div>
                        <div className="text-[0.72rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                          {tableViewEditorDraft.matrixColumnFieldIds.length} selected
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2 md:grid-cols-2">
                        {tableViewEditorFields.map((entry) => {
                          const disabled = entry.node.id === tableViewEditorDraft.matrixRowFieldId;
                          const checked = tableViewEditorDraft.matrixColumnFieldIds.includes(entry.node.id);
                          return (
                            <label
                              key={`${tableViewEditorNode.id}-column-${entry.node.id}`}
                              className={`flex items-center gap-3 rounded-[16px] border px-3 py-3 text-[0.92rem] ${
                                disabled
                                  ? "cursor-not-allowed border-[var(--ode-border)] bg-[rgba(6,24,40,0.42)] text-[var(--ode-text-muted)] opacity-60"
                                  : "border-[var(--ode-border)] bg-[rgba(4,24,38,0.62)] text-[var(--ode-text)]"
                              }`}
                            >
                              <input
                                type="checkbox"
                                disabled={disabled}
                                checked={checked}
                                onChange={(event) =>
                                  setTableViewEditorDraft((current) => {
                                    if (!current) return current;
                                    const nextSelected = event.target.checked
                                      ? [...current.matrixColumnFieldIds, entry.node.id]
                                      : current.matrixColumnFieldIds.filter((fieldId) => fieldId !== entry.node.id);
                                    return {
                                      ...current,
                                      matrixColumnFieldIds: Array.from(new Set(nextSelected))
                                    };
                                  })
                                }
                              />
                              <span>{entry.node.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : tableViewEditorDraft.viewMode === "pivot" ? (
                  <>
                    <label className="block">
                      <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">Pivot Row Field</div>
                      <select
                        className="ode-input h-11 w-full rounded-[16px] px-4"
                        value={tableViewEditorDraft.matrixRowFieldId}
                        onChange={(event) =>
                          setTableViewEditorDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  matrixRowFieldId: event.target.value,
                                  pivotColumnFieldId:
                                    current.pivotColumnFieldId === event.target.value
                                      ? ""
                                      : current.pivotColumnFieldId
                                }
                              : current
                          )
                        }
                      >
                        <option value="">Select a row field</option>
                        {tableViewEditorFields.map((entry) => (
                          <option key={`${tableViewEditorNode.id}-pivot-row-${entry.node.id}`} value={entry.node.id}>
                            {entry.node.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">Merged Header Label</div>
                      <input
                        type="text"
                        className="ode-input h-11 w-full rounded-[16px] px-4"
                        value={tableViewEditorDraft.matrixColumnGroupLabel}
                        onChange={(event) =>
                          setTableViewEditorDraft((current) =>
                            current ? { ...current, matrixColumnGroupLabel: event.target.value } : current
                          )
                        }
                        placeholder="Roles"
                      />
                    </label>

                    <label className="block">
                      <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">Generate Columns From</div>
                      <select
                        className="ode-input h-11 w-full rounded-[16px] px-4"
                        value={tableViewEditorDraft.pivotColumnFieldId}
                        onChange={(event) =>
                          setTableViewEditorDraft((current) =>
                            current ? { ...current, pivotColumnFieldId: event.target.value } : current
                          )
                        }
                      >
                        <option value="">Select a source field</option>
                        {tableViewEditorFields
                          .filter((entry) => entry.node.id !== tableViewEditorDraft.matrixRowFieldId)
                          .map((entry) => (
                            <option key={`${tableViewEditorNode.id}-pivot-column-${entry.node.id}`} value={entry.node.id}>
                              {entry.node.name}
                            </option>
                          ))}
                      </select>
                    </label>

                    <div className={`${PROCEDURE_MUTED_CARD_CLASS} px-5 py-4 text-[0.92rem]`}>
                      Each distinct value in the selected source field becomes a column, and each cell shows the
                      number of matching records for that row and column.
                    </div>
                  </>
                ) : (
                  <div className={`${PROCEDURE_MUTED_CARD_CLASS} px-5 py-4 text-[0.92rem]`}>
                    Standard List keeps the classic row/column table. Switch to Advanced Matrix for field-based columns,
                    or Pivot Count when you want dynamic columns built from record values like roles.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className={PROCEDURE_MODAL_SECONDARY_BUTTON_CLASS} onClick={closeTableViewEditor}>
                Cancel
              </button>
              <button
                type="button"
                className={`${PROCEDURE_MODAL_PRIMARY_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
                disabled={tableViewEditorSaving || !tableViewEditorWritable}
                onClick={() => {
                  void handleSaveTableView();
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {fieldOrderEditorNode ? (
        <div className={PROCEDURE_MODAL_OVERLAY_CLASS}>
          <div className={`${PROCEDURE_MODAL_PANEL_CLASS} flex max-h-[94vh] max-w-[1040px] flex-col overflow-hidden`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[0.78rem] uppercase tracking-[0.18em] text-[var(--ode-accent)]">Field Settings</div>
                <div className="mt-2 text-[1.4rem] font-semibold text-[var(--ode-text)]">{fieldOrderEditorNode.name}</div>
                <div className="mt-2 max-w-[760px] text-[0.92rem] leading-6 text-[var(--ode-text-muted)]">
                  Add new fields, open field settings, reorder them, and delete the ones you no longer need.
                </div>
              </div>
              <OdeTooltip label={isDedicatedFieldOrderWindow ? "Close field settings window" : "Close field settings"}>
                <button type="button" className={PROCEDURE_MODAL_CLOSE_BUTTON_CLASS} onClick={closeFieldOrderEditor}>
                  Close
                </button>
              </OdeTooltip>
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-2">
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-full border border-[var(--ode-border)] bg-[rgba(7,39,61,0.42)] px-3 py-1 text-[0.68rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
                    {fieldOrderEditorWritable ? "Editable settings" : "View only"}
                  </div>
                  <div className="rounded-full border border-[rgba(95,220,255,0.18)] bg-[rgba(5,29,46,0.68)] px-3 py-1 text-[0.68rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
                    {fieldOrderEditorFields.length} {fieldOrderEditorFields.length === 1 ? "field" : "fields"}
                  </div>
                  {fieldOrderEditorWritable ? (
                    <button
                      type="button"
                      className="inline-flex h-11 items-center gap-2 rounded-[16px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] px-4 text-[0.74rem] uppercase tracking-[0.16em] text-[var(--ode-text)] transition hover:border-[var(--ode-border-accent)] hover:bg-[rgba(10,66,100,0.58)]"
                      onClick={() => {
                        void handleAddFieldFromFieldSettings();
                      }}
                    >
                      <PlusGlyphSmall />
                      <span>Add Field</span>
                    </button>
                  ) : null}
                </div>

                {fieldOrderEditorFields.length > 0 ? (
                  <div className="space-y-3 pr-3">
                    {fieldOrderEditorFields.map((entry, index) => {
                      const canMoveUp = fieldOrderEditorWritable && index > 0;
                      const canMoveDown = fieldOrderEditorWritable && index < fieldOrderEditorFields.length - 1;
                      const fieldTypeLabel = getProcedureFieldTypeLabel(entry.type);
                      return (
                        <div key={`field-order-modal-${fieldOrderEditorNode.id}-${entry.node.id}`} className="relative pl-12">
                          {index < fieldOrderEditorFields.length - 1 ? (
                            <div className="pointer-events-none absolute bottom-[-14px] left-[18px] top-[38px] w-px bg-[rgba(78,183,236,0.26)]" />
                          ) : null}
                          <div className="pointer-events-none absolute left-0 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ode-border-accent)] bg-[rgba(13,73,110,0.52)] text-[0.72rem] font-semibold tracking-[0.08em] text-[var(--ode-text)] shadow-[0_0_0_4px_rgba(4,23,39,0.9)]">
                            {String(index + 1).padStart(2, "0")}
                          </div>
                          <div
                            className="flex flex-col gap-3 rounded-[20px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.62)] px-4 py-4 md:flex-row md:items-center md:justify-between"
                            onDoubleClick={() => {
                              openFieldEditor(entry);
                            }}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[0.98rem] font-medium text-[var(--ode-text)]">{entry.node.name}</div>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.7rem] uppercase tracking-[0.14em]">
                                <span className="rounded-full border border-[var(--ode-border)] bg-[rgba(4,27,43,0.46)] px-2.5 py-1 text-[var(--ode-text-dim)]">
                                  {fieldTypeLabel}
                                </span>
                                <span
                                  className={`rounded-full border px-2.5 py-1 ${
                                    entry.showInMasterList
                                      ? "border-[rgba(91,196,238,0.26)] bg-[rgba(8,55,86,0.34)] text-[var(--ode-accent)]"
                                      : "border-[rgba(140,156,176,0.22)] bg-[rgba(6,24,40,0.42)] text-[var(--ode-text-muted)]"
                                  }`}
                                >
                                  {entry.showInMasterList ? "Visible in list" : "Hidden in list"}
                                </span>
                                {entry.required ? (
                                  <span className="rounded-full border border-[rgba(103,216,166,0.28)] bg-[rgba(24,87,64,0.32)] px-2.5 py-1 text-[#bcefd8]">
                                    Required
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 self-end md:self-center">
                              <OdeTooltip label={`Open settings for ${entry.node.name}`}>
                                <button
                                  type="button"
                                  className={`${PROCEDURE_ICON_BUTTON_SMALL_CLASS} h-10 w-10 disabled:cursor-not-allowed disabled:opacity-50`}
                                  disabled={!fieldOrderEditorWritable}
                                  onClick={() => {
                                    openFieldEditor(entry);
                                  }}
                                  aria-label={`Open settings for ${entry.node.name}`}
                                >
                                  <EditGlyphSmall />
                                </button>
                              </OdeTooltip>
                              <OdeTooltip label={`Move ${entry.node.name} up`}>
                                <button
                                  type="button"
                                  className={`${PROCEDURE_ICON_BUTTON_SMALL_CLASS} h-10 w-10 disabled:cursor-not-allowed disabled:opacity-50`}
                                  disabled={!canMoveUp}
                                  onClick={() => {
                                    if (!canMoveUp || !onMoveProcedureNode) return;
                                    void onMoveProcedureNode(entry.node.id, "up");
                                  }}
                                  aria-label={`Move ${entry.node.name} up`}
                                >
                                  <ArrowUpGlyphSmall />
                                </button>
                              </OdeTooltip>
                              <OdeTooltip label={`Move ${entry.node.name} down`}>
                                <button
                                  type="button"
                                  className={`${PROCEDURE_ICON_BUTTON_SMALL_CLASS} h-10 w-10 disabled:cursor-not-allowed disabled:opacity-50`}
                                  disabled={!canMoveDown}
                                  onClick={() => {
                                    if (!canMoveDown || !onMoveProcedureNode) return;
                                    void onMoveProcedureNode(entry.node.id, "down");
                                  }}
                                  aria-label={`Move ${entry.node.name} down`}
                                >
                                  <ArrowDownGlyphSmall />
                                </button>
                              </OdeTooltip>
                              <OdeTooltip label={`Delete ${entry.node.name}`}>
                                <button
                                  type="button"
                                  className={`${PROCEDURE_ICON_BUTTON_SMALL_CLASS} h-10 w-10 disabled:cursor-not-allowed disabled:opacity-50`}
                                  disabled={!fieldOrderEditorWritable}
                                  onClick={() => {
                                    void handleDeleteField(entry);
                                  }}
                                  aria-label={`Delete ${entry.node.name}`}
                                >
                                  <TrashGlyphSmall />
                                </button>
                              </OdeTooltip>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={`${PROCEDURE_MUTED_CARD_CLASS} border-dashed px-6 py-10 text-center`}>
                    <div className="text-[1rem] text-[var(--ode-text)]">No fields yet.</div>
                    <div className="mt-2 text-[0.9rem] text-[var(--ode-text-muted)]">
                      Create the first field here, then open each one to adjust its settings.
                    </div>
                    {fieldOrderEditorWritable ? (
                      <div className="mt-5">
                        <button
                          type="button"
                          className="inline-flex h-11 items-center gap-2 rounded-[16px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] px-4 text-[0.74rem] uppercase tracking-[0.16em] text-[var(--ode-text)] transition hover:border-[var(--ode-border-accent)] hover:bg-[rgba(10,66,100,0.58)]"
                          onClick={() => {
                            void handleAddFieldFromFieldSettings();
                          }}
                        >
                          <PlusGlyphSmall />
                          <span>Add Field</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {fieldEditorNodeId && fieldEditorDraft ? (
        <div className={PROCEDURE_MODAL_OVERLAY_CLASS}>
          <div
            className={`${PROCEDURE_MODAL_PANEL_CLASS} flex max-h-[94vh] max-w-[640px] flex-col overflow-hidden`}
            onKeyDown={handleFieldEditorKeyDown}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[0.78rem] uppercase tracking-[0.18em] text-[var(--ode-accent)]">Field</div>
                <div className="mt-2 text-[1.4rem] font-semibold text-[var(--ode-text)]">Field Settings</div>
              </div>
              <OdeTooltip label="Close field editor">
                <button type="button" className={PROCEDURE_MODAL_CLOSE_BUTTON_CLASS} onClick={closeFieldEditor}>
                  Close
                </button>
              </OdeTooltip>
            </div>

            <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-2">
              <div className="space-y-4">
                <label className="block">
                  <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">Field Label</div>
                  <input
                    type="text"
                    className="ode-input h-11 w-full rounded-[16px] px-4"
                    autoFocus
                    value={fieldEditorDraft.label}
                    onChange={(event) =>
                      setFieldEditorDraft((current) => (current ? { ...current, label: event.target.value } : current))
                    }
                  />
                </label>

                <label className="block">
                  <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">Field Type</div>
                  <select
                    className="ode-input h-11 w-full rounded-[16px] px-4"
                    value={fieldEditorDraft.type}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                      const nextType = normalizeFieldType(event.target.value);
                      setFieldEditorDraft((current) =>
                        current
                          ? {
                              ...current,
                              type: nextType,
                              optionsText: fieldTypeSupportsOptions(nextType)
                                ? current.optionsText.trim().length > 0
                                  ? current.optionsText
                                  : (nextType === "table" ? DEFAULT_TABLE_COLUMNS : DEFAULT_SELECT_OPTIONS).join("\n")
                                : ""
                            }
                          : current
                      );
                    }}
                  >
                    {FIELD_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">Placeholder</div>
                  <input
                    type="text"
                    className="ode-input h-11 w-full rounded-[16px] px-4"
                    value={fieldEditorDraft.placeholder}
                    onChange={(event) =>
                      setFieldEditorDraft((current) =>
                        current ? { ...current, placeholder: event.target.value } : current
                      )
                    }
                  />
                </label>

                <label className="flex items-center gap-3 rounded-[18px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] px-4 py-3">
                  <input
                    type="checkbox"
                    checked={fieldEditorDraft.required}
                    onChange={(event) =>
                      setFieldEditorDraft((current) =>
                        current ? { ...current, required: event.target.checked } : current
                      )
                    }
                  />
                  <span className="text-[0.92rem] text-[var(--ode-text)]">Required field</span>
                </label>

                <label className="flex items-center gap-3 rounded-[18px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] px-4 py-3">
                  <input
                    type="checkbox"
                    checked={fieldEditorDraft.showInMasterList}
                    onChange={(event) =>
                      setFieldEditorDraft((current) =>
                        current ? { ...current, showInMasterList: event.target.checked } : current
                      )
                    }
                  />
                  <span className="text-[0.92rem] text-[var(--ode-text)]">Show on master list</span>
                </label>

                <div className="rounded-[22px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.42)] px-4 py-4">
                  <div className="text-[0.82rem] text-[var(--ode-text-muted)]">Conditional Visibility</div>
                  <div className="mt-1 text-[0.76rem] leading-6 text-[var(--ode-text-muted)]">
                    Show this field only when another field has a specific value.
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <div className="mb-2 text-[0.78rem] uppercase tracking-[0.12em] text-[var(--ode-text-muted)]">
                        Depends On Field
                      </div>
                      <select
                        className="ode-input h-11 w-full rounded-[16px] px-4"
                        value={fieldEditorDraft.visibilitySourceFieldId}
                        onChange={(event) =>
                          setFieldEditorDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  visibilitySourceFieldId: event.target.value,
                                  visibilityEqualsValue: event.target.value ? current.visibilityEqualsValue : ""
                                }
                              : current
                          )
                        }
                      >
                        <option value="">Always visible</option>
                        {fieldEditorSiblingFields.map((entry) => (
                          <option key={`${fieldEditorNodeId}-visibility-source-${entry.node.id}`} value={entry.node.id}>
                            {entry.node.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <div className="mb-2 text-[0.78rem] uppercase tracking-[0.12em] text-[var(--ode-text-muted)]">
                        Show When Value Is
                      </div>
                      {fieldEditorVisibilityOptions.length > 0 ? (
                        <select
                          className="ode-input h-11 w-full rounded-[16px] px-4"
                          value={fieldEditorDraft.visibilityEqualsValue}
                          onChange={(event) =>
                            setFieldEditorDraft((current) =>
                              current ? { ...current, visibilityEqualsValue: event.target.value } : current
                            )
                          }
                          disabled={!fieldEditorDraft.visibilitySourceFieldId}
                        >
                          <option value="">Select a value</option>
                          {fieldEditorVisibilityOptions.map((option) => (
                            <option key={`${fieldEditorNodeId}-visibility-value-${option}`} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          className="ode-input h-11 w-full rounded-[16px] px-4"
                          value={fieldEditorDraft.visibilityEqualsValue}
                          onChange={(event) =>
                            setFieldEditorDraft((current) =>
                              current ? { ...current, visibilityEqualsValue: event.target.value } : current
                            )
                          }
                          placeholder="Example: Yes"
                          disabled={!fieldEditorDraft.visibilitySourceFieldId}
                        />
                      )}
                    </label>
                  </div>
                </div>

                {fieldTypeSupportsOptions(fieldEditorDraft.type) ? (
                  <label className="block">
                    <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">
                      {fieldEditorDraft.type === "table" ? "Columns" : "Options"}
                    </div>
                    <textarea
                      className="ode-input min-h-[120px] w-full rounded-[18px] px-4 py-3"
                      value={fieldEditorDraft.optionsText}
                      onChange={(event) =>
                        setFieldEditorDraft((current) =>
                          current ? { ...current, optionsText: event.target.value } : current
                        )
                      }
                    />
                  </label>
                ) : null}

                {isProcedureOrganizationLinkFieldType(fieldEditorDraft.type) ? (
                  <label className="block">
                    <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">Organisation Root</div>
                    <select
                      className="ode-input h-11 w-full rounded-[16px] px-4"
                      value={fieldEditorDraft.organizationRootNodeId}
                      onChange={(event) =>
                        setFieldEditorDraft((current) =>
                          current ? { ...current, organizationRootNodeId: event.target.value } : current
                        )
                      }
                    >
                      <option value="">Select an organisation branch</option>
                      {procedureNodeLinkCandidates.map((candidate) => (
                      <option key={`organisation-root-${candidate.node.id}`} value={candidate.node.id}>
                          {candidate.pathLabel || getNodeDisplayName(candidate.node)}
                        </option>
                      ))}
                    </select>
                    <div className="mt-2 text-[0.76rem] text-[var(--ode-text-muted)]">
                      Records will show this branch as a multi-select list so you can pick several organisation nodes.
                    </div>
                  </label>
                ) : null}

                {isProcedureRelationFieldType(fieldEditorDraft.type) ? (
                  <>
                  <label className="block">
                    <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">Related Database</div>
                    <select
                      className="ode-input h-11 w-full rounded-[16px] px-4"
                      value={fieldEditorDraft.relationTargetNodeId}
                      onChange={(event) =>
                        setFieldEditorDraft((current) =>
                          current
                            ? {
                                ...current,
                                relationTargetNodeId: event.target.value,
                                relationDisplayFieldIds: []
                              }
                            : current
                        )
                      }
                    >
                      <option value="">Select a database</option>
                      {procedureDatabaseTables.map((table) => (
                        <option key={table.node.id} value={table.node.id}>
                          {table.node.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="block">
                    <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">Display Fields</div>
                    <div className="rounded-[18px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-[0.84rem] text-[var(--ode-text-muted)]">
                          {fieldEditorDraft.relationDisplayFieldIds.length > 0
                            ? `Selected: ${fieldEditorDraft.relationDisplayFieldIds.length} field${fieldEditorDraft.relationDisplayFieldIds.length === 1 ? "" : "s"}`
                            : "No specific fields selected. The first visible field will be used."}
                        </div>
                        <button
                          type="button"
                          className="rounded-full border border-[var(--ode-border)] px-3 py-1.5 text-[0.7rem] uppercase tracking-[0.14em] text-[var(--ode-text-muted)] transition hover:border-[var(--ode-border-accent)] hover:text-[var(--ode-text)]"
                          onClick={() =>
                            setFieldEditorDraft((current) =>
                              current ? { ...current, relationDisplayFieldIds: [] } : current
                            )
                          }
                        >
                          Use first visible field
                        </button>
                      </div>

                      {fieldEditorTargetTable ? (
                        <div className="mt-4 grid gap-2">
                          {fieldEditorTargetTable.fields.map((field) => {
                            const checked = fieldEditorDraft.relationDisplayFieldIds.includes(field.nodeId);
                            return (
                              <label
                                key={field.nodeId}
                                className={`flex items-center gap-3 rounded-[16px] border px-3 py-2.5 transition ${
                                  checked
                                    ? "border-[rgba(95,220,255,0.36)] bg-[rgba(8,55,86,0.34)]"
                                    : "border-[rgba(95,220,255,0.14)] bg-[rgba(5,24,39,0.42)] hover:border-[rgba(95,220,255,0.24)]"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(event) =>
                                    setFieldEditorDraft((current) => {
                                      if (!current) return current;
                                      const nextSelectedSet = new Set(current.relationDisplayFieldIds);
                                      if (event.target.checked) {
                                        nextSelectedSet.add(field.nodeId);
                                      } else {
                                        nextSelectedSet.delete(field.nodeId);
                                      }
                                      const nextSelected = (fieldEditorTargetTable?.fields ?? [])
                                        .map((entry) => entry.nodeId)
                                        .filter((nodeId) => nextSelectedSet.has(nodeId));
                                      return {
                                        ...current,
                                        relationDisplayFieldIds: nextSelected
                                      };
                                    })
                                  }
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-[0.92rem] text-[var(--ode-text)]">{field.label}</div>
                                  <div className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                                    {getProcedureFieldTypeLabel(field.type)}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="mt-4 text-[0.84rem] text-[var(--ode-text-muted)]">
                          Choose a related database first.
                        </div>
                      )}
                    </div>
                  </div>
                  </>
                ) : null}

                {isProcedureFormulaFieldType(fieldEditorDraft.type) ? (
                  <label className="block">
                    <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">Formula Expression</div>
                    <textarea
                      className="ode-input min-h-[140px] w-full rounded-[18px] px-4 py-3 font-mono text-[0.88rem]"
                      placeholder='Example: number({Required level}) - number({Current level})'
                      value={fieldEditorDraft.formulaExpression}
                      onChange={(event) =>
                        setFieldEditorDraft((current) =>
                          current ? { ...current, formulaExpression: event.target.value } : current
                        )
                      }
                    />
                    <div className="mt-2 text-[0.76rem] text-[var(--ode-text-muted)]">
                      Use field labels in braces. Helpers: `number`, `text`, `lookup`, `rollup`, `iif`, `today`.
                    </div>
                  </label>
                ) : null}

                <label className="block">
                  <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">Execution Automation Role</div>
                  <select
                    className="ode-input h-11 w-full rounded-[16px] px-4"
                    value={fieldEditorDraft.automationRole}
                    onChange={(event) =>
                      setFieldEditorDraft((current) =>
                        current
                          ? {
                              ...current,
                              automationRole: (event.target.value as ProcedureAutomationRole) || "none"
                            }
                          : current
                      )
                    }
                  >
                    {AUTOMATION_ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-between gap-3">
              <div>
                {fieldEditorWritable ? (
                  <button
                    type="button"
                    className={PROCEDURE_MODAL_DANGER_BUTTON_CLASS}
                    onClick={() => {
                      void handleDeleteCurrentField();
                    }}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
              <div className="flex gap-3">
                <button type="button" className={PROCEDURE_MODAL_SECONDARY_BUTTON_CLASS} onClick={closeFieldEditor}>
                Cancel
                </button>
                <button
                  type="button"
                  className={`${PROCEDURE_MODAL_PRIMARY_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
                  disabled={fieldEditorSaving || !fieldEditorWritable}
                  onClick={() => {
                    void handleSaveField();
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}






