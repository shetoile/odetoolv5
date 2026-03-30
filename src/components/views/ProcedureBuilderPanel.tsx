import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode
} from "react";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import { FileGlyphSmall, ImageGlyphSmall, NodeLinkGlyphSmall, OpenGlyphSmall, PlusGlyphSmall } from "@/components/Icons";
import { getDesktopMediaPreviewKind } from "@/lib/iconSupport";
import {
  encodeProcedureAppLinkPayload,
  findProcedureWorkspaceRootId,
  parseProcedureBlocks,
  parseProcedureInlineTokens
} from "@/lib/procedureDocument";
import { getNodeQuickApps, resolveQuickAppLaunchTarget, type NodeQuickAppItem } from "@/lib/nodeQuickApps";
import { ROOT_PARENT_ID, type AppNode, type ProjectSummary } from "@/lib/types";

type ProcedureFieldType =
  | "short_text"
  | "long_text"
  | "rich_text"
  | "number"
  | "decimal"
  | "percentage"
  | "currency"
  | "date"
  | "time"
  | "datetime"
  | "duration"
  | "single_select"
  | "multi_select"
  | "yes_no"
  | "email"
  | "phone"
  | "identifier"
  | "attachment"
  | "table";

type ProcedureRecordValue = string | string[] | Record<string, string>;

type ProcedureRecord = {
  id: string;
  createdAt: number;
  updatedAt: number;
  values: Record<string, ProcedureRecordValue>;
};

type ProcedureFieldEntry = {
  node: AppNode;
  type: ProcedureFieldType;
  placeholder: string;
  required: boolean;
  options: string[];
  showInMasterList: boolean;
};

type FieldEditorDraft = {
  label: string;
  type: ProcedureFieldType;
  placeholder: string;
  required: boolean;
  showInMasterList: boolean;
  optionsText: string;
};

type SectionEditorDraft = {
  label: string;
  content: string;
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

type SectionEditorBlockStyle = "normal" | "heading1" | "heading2" | "heading3" | "heading4";

interface ProcedureBuilderPanelProps {
  workspaceName: string | null;
  rootNode: AppNode | null;
  selectedNode: AppNode | null;
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
  onAttachImagesToNode: (nodeId: string) => Promise<number> | number;
  onAttachFilesToNode: (nodeId: string) => Promise<number> | number;
  onDeleteProcedureNode: (nodeId: string) => Promise<boolean> | boolean;
  onRenameNodeTitle: (nodeId: string, title: string) => Promise<void> | void;
  onReviewNodeFile: (nodeId: string) => void;
  onSaveNodeContent: (nodeId: string, text: string) => Promise<void> | void;
  onSaveNodeDescription: (nodeId: string, description: string | null) => Promise<void> | void;
  onSaveNodeProperties: (nodeId: string, properties: Record<string, unknown>) => Promise<void> | void;
  onActivateProcedureSurface: () => void;
  onOpenSurfaceContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  requestedFieldEditorNodeId?: string | null;
  onFieldEditorRequestHandled?: () => void;
}

const RECORDS_PROPERTY_KEY = "odeProcedureRecords";
const DEFAULT_SELECT_OPTIONS = ["Option 1", "Option 2"];
const DEFAULT_TABLE_COLUMNS = ["Column 1", "Column 2"];
const PROCEDURE_MODAL_OVERLAY_CLASS =
  "fixed inset-0 z-50 flex items-center justify-center bg-[rgba(12,23,38,0.4)] px-4";
const PROCEDURE_MODAL_PANEL_CLASS =
  "ode-modal ode-document-action-modal w-full rounded-[30px] border border-[rgba(69,182,233,0.42)] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.4)]";
const PROCEDURE_MODAL_CLOSE_BUTTON_CLASS =
  "rounded-full border border-[var(--ode-border-strong)] bg-[rgba(6,34,53,0.42)] px-3 py-2 text-[0.78rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)] transition hover:border-[var(--ode-border-accent)] hover:text-[var(--ode-text)]";
const PROCEDURE_MODAL_SECONDARY_BUTTON_CLASS =
  "rounded-[18px] border border-[var(--ode-border-strong)] bg-[rgba(6,34,53,0.42)] px-4 py-3 text-[0.78rem] uppercase tracking-[0.18em] text-[var(--ode-text-dim)] transition hover:border-[var(--ode-border-accent)] hover:text-[var(--ode-text)]";
const PROCEDURE_MODAL_PRIMARY_BUTTON_CLASS = "ode-primary-btn h-11 px-5 text-[0.78rem] uppercase tracking-[0.18em]";
const PROCEDURE_MODAL_DANGER_BUTTON_CLASS =
  "rounded-[18px] border border-[rgba(211,127,127,0.52)] bg-[rgba(83,26,26,0.26)] px-4 py-3 text-[0.78rem] uppercase tracking-[0.18em] text-[#ffc7c7] transition hover:border-[rgba(244,157,157,0.72)] hover:text-[#fff0f0]";

const FIELD_TYPE_OPTIONS: Array<{ value: ProcedureFieldType; label: string }> = [
  { value: "short_text", label: "Short Text" },
  { value: "long_text", label: "Long Text" },
  { value: "rich_text", label: "Rich Text" },
  { value: "number", label: "Number" },
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
  { value: "table", label: "Table" }
];

const SECTION_EDITOR_STYLE_OPTIONS: Array<{
  value: SectionEditorBlockStyle;
  label: string;
  blockTag: "<p>" | "<h1>" | "<h2>" | "<h3>" | "<h4>";
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
  }
];

function createProcedureId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeFieldType(value: unknown): ProcedureFieldType {
  switch (value) {
    case "long_text":
    case "rich_text":
    case "number":
    case "decimal":
    case "percentage":
    case "currency":
    case "date":
    case "time":
    case "datetime":
    case "duration":
    case "single_select":
    case "multi_select":
    case "yes_no":
    case "email":
    case "phone":
    case "identifier":
    case "attachment":
    case "table":
      return value;
    case "text":
      return "long_text";
    default:
      return "short_text";
  }
}

function fieldTypeSupportsOptions(type: ProcedureFieldType): boolean {
  return type === "single_select" || type === "multi_select" || type === "table";
}

function fieldTypeUsesTextarea(type: ProcedureFieldType): boolean {
  return type === "long_text" || type === "rich_text" || type === "duration";
}

function fieldTypeUsesNumericInput(type: ProcedureFieldType): boolean {
  return type === "number" || type === "decimal" || type === "percentage" || type === "currency";
}

function readStringProperty(properties: Record<string, unknown> | undefined, key: string): string {
  const value = properties?.[key];
  return typeof value === "string" ? value : "";
}

function readBooleanProperty(properties: Record<string, unknown> | undefined, key: string): boolean {
  return properties?.[key] === true;
}

function readStringArrayProperty(properties: Record<string, unknown> | undefined, key: string): string[] {
  const value = properties?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
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

function normalizeRecordValue(value: unknown): ProcedureRecordValue | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) return value;
  if (isStringRecord(value)) return value;
  return null;
}

function isProcedureFieldNode(node: AppNode | null | undefined): node is AppNode {
  if (!node) return false;
  if (node.properties?.odeProcedureItemType === "field") return true;
  const fieldType = node.properties?.odeProcedureFieldType;
  return typeof fieldType === "string" && fieldType.trim().length > 0;
}

function buildProcedureFieldEntry(node: AppNode): ProcedureFieldEntry {
  return {
    node,
    type: normalizeFieldType(node.properties?.odeProcedureFieldType),
    placeholder: readStringProperty(node.properties, "odeProcedurePlaceholder"),
    required: readBooleanProperty(node.properties, "odeProcedureRequired"),
    options: readStringArrayProperty(node.properties, "odeProcedureOptions"),
    showInMasterList:
      node.properties?.odeProcedureShowInMasterList === false ? false : true
  };
}

function readRecords(node: AppNode | null): ProcedureRecord[] {
  const rawValue = node?.properties?.[RECORDS_PROPERTY_KEY];
  if (!Array.isArray(rawValue)) return [];
  return rawValue.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<ProcedureRecord>;
    if (typeof candidate.id !== "string") return [];
    if (typeof candidate.createdAt !== "number" || typeof candidate.updatedAt !== "number") return [];
    const values: Record<string, ProcedureRecordValue> = {};
    if (candidate.values && typeof candidate.values === "object" && !Array.isArray(candidate.values)) {
      for (const [key, value] of Object.entries(candidate.values)) {
        const normalizedValue = normalizeRecordValue(value);
        if (normalizedValue !== null) {
          values[key] = normalizedValue;
        }
      }
    }
    return [
      {
        id: candidate.id,
        createdAt: candidate.createdAt,
        updatedAt: candidate.updatedAt,
        values
      }
    ];
  });
}

function createEmptyTableValue(columns: string[], currentValue?: ProcedureRecordValue): Record<string, string> {
  const base: Record<string, string> = {};
  const currentRecord = isStringRecord(currentValue) ? currentValue : {};
  for (const column of columns) {
    base[column] = currentRecord[column] ?? "";
  }
  return base;
}

function mergeDraftValues(
  entries: ProcedureFieldEntry[],
  currentValues: Record<string, ProcedureRecordValue>
): Record<string, ProcedureRecordValue> {
  const nextValues: Record<string, ProcedureRecordValue> = {};
  for (const entry of entries) {
    const currentValue = currentValues[entry.node.id];
    if (entry.type === "multi_select") {
      nextValues[entry.node.id] = Array.isArray(currentValue)
        ? currentValue.filter((item): item is string => typeof item === "string")
        : [];
      continue;
    }
    if (entry.type === "table") {
      const columns = entry.options.length > 0 ? entry.options : DEFAULT_TABLE_COLUMNS;
      nextValues[entry.node.id] = createEmptyTableValue(columns, currentValue);
      continue;
    }
    nextValues[entry.node.id] = typeof currentValue === "string" ? currentValue : "";
  }
  return nextValues;
}

function isEmptyRecordValue(value: ProcedureRecordValue | undefined): boolean {
  if (value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return Object.values(value).every((item) => item.trim().length === 0);
}

function formatRecordValue(value: ProcedureRecordValue | undefined): string {
  if (isEmptyRecordValue(value)) return "Not answered";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.join(", ");
  const recordValue = isStringRecord(value) ? value : {};
  return Object.entries(recordValue)
    .filter(([, entry]) => entry.trim().length > 0)
    .map(([key, entry]) => `${key}: ${entry}`)
    .join(" | ");
}

function buildFieldEditorDraft(entry: ProcedureFieldEntry): FieldEditorDraft {
  return {
    label: entry.node.name,
    type: entry.type,
    placeholder: entry.placeholder,
    required: entry.required,
    showInMasterList: entry.showInMasterList,
    optionsText: (
      entry.options.length > 0
        ? entry.options
        : entry.type === "table"
          ? DEFAULT_TABLE_COLUMNS
          : DEFAULT_SELECT_OPTIONS
    ).join("\n")
  };
}

function resolveSectionEditorCurrentStyle(block: HTMLElement | null): SectionEditorBlockStyle {
  if (!block) return "normal";
  const tagName = block.tagName.toUpperCase();
  if (tagName === "H1") return "heading1";
  if (tagName === "H2") return "heading2";
  if (tagName === "H3") return "heading3";
  if (tagName === "H4") return "heading4";
  return "normal";
}

function buildSectionEditorDraft(node: AppNode): SectionEditorDraft {
  return {
    label: node.name,
    content: node.content ?? ""
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
    path.unshift(current.name);
    if ((workspaceRootId && current.id === workspaceRootId) || !current.parentId || current.parentId === ROOT_PARENT_ID) {
      break;
    }
    current = nodeById.get(current.parentId) ?? null;
  }
  if (workspaceRootId && path[0] && nodeById.get(workspaceRootId)?.name === path[0]) {
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
    return projectByRootId.get(workspaceRootId)?.name ?? nodeById.get(workspaceRootId)?.name ?? "Workspace";
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

function buildProcedureEditorLinkStyle(): string {
  return [
    "color:#2d7ebe",
    "font-style:italic",
    "text-decoration:underline",
    "text-decoration-color:rgba(45,126,190,0.42)"
  ].join(";");
}

function inlineProcedureTextToEditorHtml(text: string, nodeById?: Map<string, AppNode>): string {
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
      if (token.type === "app_link") {
        const label = escapeProcedureEditorHtml(token.label || token.appName || "App");
        const href = encodeProcedureAppLinkPayload({
          appId: token.appId ?? null,
          appName: token.appName ?? token.label ?? null,
          kind: token.kind,
          target: token.target,
          sourceNodeId: token.sourceNodeId ?? null,
          sourceNodeName: token.sourceNodeName ?? null,
          workspaceName: token.workspaceName ?? null
        });
        return `<a href="${escapeProcedureEditorHtml(href)}" data-ode-link-type="app" style="${buildProcedureEditorLinkStyle()}">${label}</a>`;
      }
      return `<a href="${escapeProcedureEditorHtml(token.href)}" data-ode-link-type="website" target="_blank" rel="noreferrer" style="${buildProcedureEditorLinkStyle()}">${escapeProcedureEditorHtml(token.label)}</a>`;
    })
    .join("");
}

function procedureTextToEditorHtml(text: string, nodeById?: Map<string, AppNode>): string {
  const trimmed = text.trim();
  if (!trimmed) return "<p><br></p>";
  return parseProcedureBlocks(text)
    .map((block) => {
      if (block.type === "heading") {
        const tagName = `h${block.level}`;
        return `<${tagName}>${inlineProcedureTextToEditorHtml(block.text, nodeById)}</${tagName}>`;
      }
      if (block.type === "paragraph") {
        return `<p>${block.lines.map((line) => inlineProcedureTextToEditorHtml(line, nodeById)).join("<br>")}</p>`;
      }
      if (block.type === "bullets") {
        return `<ul>${block.items.map((item) => `<li>${inlineProcedureTextToEditorHtml(item, nodeById)}</li>`).join("")}</ul>`;
      }
      if (block.type === "numbers") {
        return `<ol>${block.items.map((item) => `<li>${inlineProcedureTextToEditorHtml(item, nodeById)}</li>`).join("")}</ol>`;
      }
      if (block.type === "quote") {
        return `<blockquote>${block.lines.map((line) => `<p>${inlineProcedureTextToEditorHtml(line, nodeById)}</p>`).join("")}</blockquote>`;
      }
      if (block.type === "code") {
        return `<pre data-language="${escapeProcedureEditorHtml(block.language)}"><code>${escapeProcedureEditorHtml(block.code)}</code></pre>`;
      }
      if (block.type === "divider") {
        return "<hr>";
      }
      return `<div data-insight-domain="${escapeProcedureEditorHtml(block.domain)}">${block.lines.map((line) => `<p>${inlineProcedureTextToEditorHtml(line, nodeById)}</p>`).join("")}</div>`;
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
    tagName === "ul" ||
    tagName === "ol" ||
    tagName === "blockquote" ||
    tagName === "pre" ||
    tagName === "hr"
  );
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
    const tagName = element.tagName.toLowerCase();
    if (tagName === "br") {
      result += "\n";
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
      const label = childText.trim() || normalizeProcedureEditorText(element.textContent ?? "").trim() || "Link";
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
    return ["---"];
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
  if (depth <= 0) return "text-[2.3rem] font-semibold tracking-[-0.04em] text-[#22364d]";
  if (depth === 1) return "text-[1.7rem] font-semibold tracking-[-0.03em] text-[#28415d]";
  if (depth === 2) return "text-[1.28rem] font-semibold tracking-[-0.02em] text-[#2b4866]";
  return "text-[1.05rem] font-semibold tracking-[-0.01em] text-[#31506f]";
}

function resolveProcedureContentHeadingClasses(level: 1 | 2 | 3 | 4): string {
  if (level === 1) return "text-[1.48rem] font-semibold tracking-[-0.035em] text-[#24384f]";
  if (level === 2) return "text-[1.34rem] font-semibold tracking-[-0.03em] text-[#28415d]";
  if (level === 3) return "text-[1.08rem] font-semibold tracking-[-0.02em] text-[#31506f]";
  return "text-[0.98rem] font-semibold tracking-[-0.01em] text-[#44627f]";
}

function resolveSectionShellClasses(depth: number): string {
  return depth === 1
    ? "rounded-[30px] border border-[rgba(190,205,227,0.82)] bg-white/74 px-6 py-6 shadow-[0_16px_44px_rgba(19,55,93,0.08)]"
    : "rounded-[26px] border border-[rgba(190,205,227,0.74)] bg-white/64 px-5 py-5";
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
  workspaceName,
  rootNode,
  selectedNode,
  byParent,
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
  onActivateProcedureSurface,
  onOpenSurfaceContextMenu,
  requestedFieldEditorNodeId,
  onFieldEditorRequestHandled
}: ProcedureBuilderPanelProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldEditorNodeId, setFieldEditorNodeId] = useState<string | null>(null);
  const [fieldEditorDraft, setFieldEditorDraft] = useState<FieldEditorDraft | null>(null);
  const [fieldEditorSaving, setFieldEditorSaving] = useState(false);
  const [sectionEditorNodeId, setSectionEditorNodeId] = useState<string | null>(null);
  const [sectionEditorDraft, setSectionEditorDraft] = useState<SectionEditorDraft | null>(null);
  const [sectionEditorSaving, setSectionEditorSaving] = useState(false);
  const [sectionNodeLinkPickerOpen, setSectionNodeLinkPickerOpen] = useState(false);
  const [sectionNodeLinkQuery, setSectionNodeLinkQuery] = useState("");
  const [sectionAppPickerOpen, setSectionAppPickerOpen] = useState(false);
  const [sectionAppQuery, setSectionAppQuery] = useState("");
  const [sectionWebsiteLinkState, setSectionWebsiteLinkState] = useState<SectionWebsiteLinkState | null>(null);
  const [sectionEditorStyleMenuOpen, setSectionEditorStyleMenuOpen] = useState(false);
  const [sectionEditorCurrentStyle, setSectionEditorCurrentStyle] = useState<SectionEditorBlockStyle>("normal");
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
  const [recordEditorOpen, setRecordEditorOpen] = useState(false);
  const [recordSaving, setRecordSaving] = useState(false);
  const [draftValues, setDraftValues] = useState<Record<string, ProcedureRecordValue>>({});
  const sectionEditorSurfaceRef = useRef<HTMLDivElement | null>(null);
  const sectionEditorSelectionRef = useRef<Range | null>(null);
  const sectionEditorInsertRangeRef = useRef<Range | null>(null);
  const sectionWebsiteLinkRangeRef = useRef<Range | null>(null);

  const subtreeNodeMap = useMemo(() => collectSubtreeNodeMap(rootNode, byParent), [rootNode, byParent]);
  const globalNodeById = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const projectByRootId = useMemo(() => new Map(projects.map((project) => [project.rootNodeId, project])), [projects]);
  const workspaceRootIdSet = useMemo(() => new Set(projects.map((project) => project.rootNodeId)), [projects]);
  const recordEditorParentNode = useMemo(
    () => (recordEditorParentNodeId ? subtreeNodeMap.get(recordEditorParentNodeId) ?? null : null),
    [recordEditorParentNodeId, subtreeNodeMap]
  );
  const recordEditorFields = useMemo(
    () => (recordEditorParentNode ? getDirectFieldEntries(recordEditorParentNode, byParent) : []),
    [byParent, recordEditorParentNode]
  );
  const sectionEditorNode = useMemo(() => {
    if (!sectionEditorNodeId) return null;
    return subtreeNodeMap.get(sectionEditorNodeId) ?? (rootNode && rootNode.id === sectionEditorNodeId ? rootNode : null);
  }, [rootNode, sectionEditorNodeId, subtreeNodeMap]);
  const sectionEditorReferences = useMemo(
    () => (sectionEditorNode ? (byParent.get(sectionEditorNode.id) ?? []).filter((child) => child.type === "file") : []),
    [byParent, sectionEditorNode]
  );
  const sectionEditorFileReferences = useMemo(
    () => sectionEditorReferences.filter((reference) => getDesktopMediaPreviewKind(reference) !== "image"),
    [sectionEditorReferences]
  );
  const sectionEditorWorkspaceRootId = useMemo(() => {
    if (!sectionEditorNode) return activeProjectRootId;
    return findProcedureWorkspaceRootId(sectionEditorNode.id, globalNodeById, workspaceRootIdSet) ?? activeProjectRootId;
  }, [activeProjectRootId, globalNodeById, sectionEditorNode, workspaceRootIdSet]);
  const filteredSectionNodeLinkCandidates = useMemo(() => {
    if (!sectionEditorNode) return [] as ProcedureNodeLinkCandidate[];
    const normalizedQuery = sectionNodeLinkQuery.trim().toLowerCase();
    return allNodes
      .filter((node) => node.id !== sectionEditorNode.id && node.type !== "file")
      .map((node) => {
        const workspaceRootId = findProcedureWorkspaceRootId(node.id, globalNodeById, workspaceRootIdSet);
        const candidateWorkspaceName = workspaceRootId
          ? (projectByRootId.get(workspaceRootId)?.name ?? globalNodeById.get(workspaceRootId)?.name ?? node.name)
          : workspaceName || "Workspace";
        const pathLabel = buildProcedureNodePathLabel(node.id, globalNodeById, workspaceRootId);
        return {
          node,
          workspaceRootId,
          workspaceName: candidateWorkspaceName,
          pathLabel,
          isCurrentWorkspace: workspaceRootId === sectionEditorWorkspaceRootId,
          searchText: `${node.name} ${pathLabel} ${candidateWorkspaceName} ${node.type}`.toLowerCase()
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
      const workspaceRootId = findProcedureWorkspaceRootId(node.id, globalNodeById, workspaceRootIdSet);
      const candidateWorkspaceName = resolveWorkspaceDisplayName(
        workspaceRootId,
        projectByRootId,
        globalNodeById,
        workspaceName
      );
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
          searchText: `${item.label} ${target} ${node.name} ${candidateWorkspaceName}`.toLowerCase()
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

  const openFieldEditor = (entry: ProcedureFieldEntry) => {
    setFieldEditorNodeId(entry.node.id);
    setFieldEditorDraft(buildFieldEditorDraft(entry));
    setNotice(null);
  };

  const closeFieldEditor = () => {
    setFieldEditorNodeId(null);
    setFieldEditorDraft(null);
    setFieldEditorSaving(false);
  };

  const openSectionEditor = (node: AppNode) => {
    setSectionEditorNodeId(node.id);
    setSectionEditorDraft(buildSectionEditorDraft(node));
    setSectionNodeLinkPickerOpen(false);
    setSectionNodeLinkQuery("");
    setSectionAppPickerOpen(false);
    setSectionAppQuery("");
    setSectionWebsiteLinkState(null);
    sectionEditorInsertRangeRef.current = null;
    sectionWebsiteLinkRangeRef.current = null;
    setSectionEditorStyleMenuOpen(false);
    setSectionPhotoAdding(false);
    setSectionEditorCurrentStyle("normal");
    setSectionAttachmentAdding(false);
    setSectionAttachmentDeletingId(null);
    setAttachmentDeleteState(null);
    setNotice(null);
  };

  const closeSectionEditor = () => {
    setSectionEditorNodeId(null);
    setSectionEditorDraft(null);
    setSectionEditorSaving(false);
    setSectionNodeLinkPickerOpen(false);
    setSectionNodeLinkQuery("");
    setSectionAppPickerOpen(false);
    setSectionAppQuery("");
    setSectionWebsiteLinkState(null);
    sectionEditorInsertRangeRef.current = null;
    sectionWebsiteLinkRangeRef.current = null;
    setSectionEditorStyleMenuOpen(false);
    setSectionPhotoAdding(false);
    setSectionEditorCurrentStyle("normal");
    setSectionAttachmentAdding(false);
    setSectionAttachmentDeletingId(null);
    setAttachmentDeleteState(null);
  };

  const openNewRecordEditor = (node: AppNode) => {
    const fields = getDirectFieldEntries(node, byParent);
    setRecordEditorParentNodeId(node.id);
    setRecordEditorRecordId(null);
    setDraftValues(mergeDraftValues(fields, {}));
    setRecordEditorOpen(true);
    setNotice(null);
  };

  const openExistingRecordEditor = (node: AppNode, record: ProcedureRecord) => {
    const fields = getDirectFieldEntries(node, byParent);
    setRecordEditorParentNodeId(node.id);
    setRecordEditorRecordId(record.id);
    setDraftValues(mergeDraftValues(fields, record.values));
    setRecordEditorOpen(true);
    setNotice(null);
  };

  const closeRecordEditor = () => {
    setRecordEditorOpen(false);
    setRecordEditorParentNodeId(null);
    setRecordEditorRecordId(null);
    setDraftValues({});
    setRecordSaving(false);
  };

  useEffect(() => {
    if (!recordEditorOpen || recordEditorFields.length === 0) return;
    setDraftValues((current) => mergeDraftValues(recordEditorFields, current));
  }, [recordEditorFields, recordEditorOpen]);

  useEffect(() => {
    if (!requestedFieldEditorNodeId) return;
    const targetNode =
      subtreeNodeMap.get(requestedFieldEditorNodeId) ??
      (rootNode && rootNode.id === requestedFieldEditorNodeId ? rootNode : null);
    if (!targetNode) {
      onFieldEditorRequestHandled?.();
      return;
    }
    if (isProcedureFieldNode(targetNode)) {
      openFieldEditor(buildProcedureFieldEntry(targetNode));
    } else {
      openSectionEditor(targetNode);
    }
    onFieldEditorRequestHandled?.();
  }, [onFieldEditorRequestHandled, requestedFieldEditorNodeId, rootNode, subtreeNodeMap]);

  useEffect(() => {
    if (!sectionEditorNodeId || !sectionEditorDraft) return;
    const frame = window.requestAnimationFrame(() => {
      const surface = sectionEditorSurfaceRef.current;
      if (!surface) return;
      surface.innerHTML = procedureTextToEditorHtml(sectionEditorDraft.content, globalNodeById);
      surface.focus();
      const selection = window.getSelection();
      if (!selection) return;
      const range = document.createRange();
      range.selectNodeContents(surface);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      sectionEditorSelectionRef.current = range.cloneRange();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [sectionEditorNodeId]);

  const syncSectionEditorSelection = () => {
    const surface = sectionEditorSurfaceRef.current;
    const selection = window.getSelection();
    if (!surface || !selection || selection.rangeCount === 0) {
      setSectionEditorCurrentStyle("normal");
      return;
    }
    const range = selection.getRangeAt(0);
    if (!surface.contains(range.commonAncestorContainer)) {
      setSectionEditorCurrentStyle("normal");
      return;
    }
    sectionEditorSelectionRef.current = range.cloneRange();
    setSectionEditorCurrentStyle(resolveSectionEditorCurrentStyle(findSectionEditorBlockElement(range.startContainer, surface)));
  };

  const syncSectionEditorContentFromDom = () => {
    const surface = sectionEditorSurfaceRef.current;
    if (!surface) return;
    const nextContent = serializeProcedureEditorHtmlToText(surface);
    setSectionEditorDraft((current) => {
      if (!current || current.content === nextContent) return current;
      return {
        ...current,
        content: nextContent
      };
    });
    syncSectionEditorSelection();
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
    surface.focus();
  };

  const preserveSectionEditorSelection = (event?: ReactMouseEvent<HTMLElement>) => {
    event?.preventDefault();
    syncSectionEditorSelection();
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
          current.tagName === "P")
      ) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  };

  const handleSectionEditorKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) {
      return;
    }
    const surface = sectionEditorSurfaceRef.current;
    const selection = window.getSelection();
    if (!surface || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!range.collapsed || !surface.contains(range.commonAncestorContainer)) return;
    const block = findSectionEditorBlockElement(range.startContainer, surface);
    if (!block || !["H1", "H2", "H3", "H4"].includes(block.tagName)) return;

    const blockEndRange = document.createRange();
    blockEndRange.selectNodeContents(block);
    blockEndRange.collapse(false);
    if (range.compareBoundaryPoints(Range.END_TO_END, blockEndRange) !== 0) {
      return;
    }

    event.preventDefault();
    const paragraph = document.createElement("p");
    const breakNode = document.createElement("br");
    paragraph.appendChild(breakNode);
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
    focusSectionEditorSurface();
    restoreSectionEditorSelection();
    document.execCommand(command, false, value);
    syncSectionEditorContentFromDom();
    setSectionEditorStyleMenuOpen(false);
  };

  const insertSectionEditorElement = (element: HTMLElement) => {
    focusSectionEditorSurface();
    const range = restoreSectionEditorSelection();
    const selection = window.getSelection();
    if (!selection || !range) return;
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
    anchor.setAttribute("style", buildProcedureEditorLinkStyle());
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

  const getSectionEditorSelectedText = () => {
    const range = sectionEditorSelectionRef.current;
    if (!range) return "";
    return normalizeProcedureEditorText(range.cloneContents().textContent ?? "").trim();
  };

  const captureSectionEditorInsertRange = () => {
    syncSectionEditorSelection();
    const savedRange = sectionEditorSelectionRef.current;
    sectionEditorInsertRangeRef.current = savedRange ? savedRange.cloneRange() : null;
  };

  const insertSectionNodeLink = (node: AppNode) => {
    if (sectionEditorInsertRangeRef.current) {
      sectionEditorSelectionRef.current = sectionEditorInsertRangeRef.current.cloneRange();
    }
    const fallbackLabel = node.type === "file" ? getProcedureFileDisplayTitle(node.name) : node.name;
    const label = sanitizeSectionLinkLabel(getSectionEditorSelectedText(), fallbackLabel) || fallbackLabel;
    const href = `ode://node/${encodeURIComponent(node.id)}`;
    const anchor = buildSectionEditorLinkElement(label, href, "node", {
      "data-node-id": node.id
    });
    insertSectionEditorElement(anchor);
    sectionEditorInsertRangeRef.current = null;
    setSectionNodeLinkPickerOpen(false);
    setSectionNodeLinkQuery("");
  };

  const insertSectionAppLink = (candidate: ProcedureAppLinkCandidate) => {
    if (sectionEditorInsertRangeRef.current) {
      sectionEditorSelectionRef.current = sectionEditorInsertRangeRef.current.cloneRange();
    }
    const label = sanitizeSectionLinkLabel(getSectionEditorSelectedText(), candidate.item.label || "App");
    const href = encodeProcedureAppLinkPayload({
      appId: candidate.item.id,
      appName: candidate.item.label,
      kind: candidate.item.kind,
      target: candidate.item.target,
      sourceNodeId: candidate.sourceNode.id,
      sourceNodeName: candidate.sourceNode.name,
      workspaceName: candidate.workspaceName
    });
    const anchor = buildSectionEditorLinkElement(label, href, "app");
    insertSectionEditorElement(anchor);
    sectionEditorInsertRangeRef.current = null;
    setSectionAppPickerOpen(false);
    setSectionAppQuery("");
  };

  const insertSectionReferenceLink = (node: AppNode) => {
    const fallbackLabel = node.type === "file" ? getProcedureFileDisplayTitle(node.name) : node.name;
    const label = sanitizeSectionLinkLabel(getSectionEditorSelectedText(), fallbackLabel) || fallbackLabel;
    const href = `ode://node/${encodeURIComponent(node.id)}`;
    const anchor = buildSectionEditorLinkElement(label, href, "node", {
      "data-node-id": node.id
    });
    insertSectionEditorElement(anchor);
  };

  const openSectionWebsiteLinkDialog = () => {
    syncSectionEditorSelection();
    const selectedText = getSectionEditorSelectedText();
    const savedRange = sectionEditorSelectionRef.current;
    sectionEditorInsertRangeRef.current = null;
    sectionWebsiteLinkRangeRef.current = savedRange ? savedRange.cloneRange() : null;
    setSectionNodeLinkPickerOpen(false);
    setSectionNodeLinkQuery("");
    setSectionAppPickerOpen(false);
    setSectionAppQuery("");
    setSectionEditorStyleMenuOpen(false);
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
    if (sectionWebsiteLinkRangeRef.current) {
      sectionEditorSelectionRef.current = sectionWebsiteLinkRangeRef.current.cloneRange();
    }
    const anchor = buildSectionEditorLinkElement(label, href, "website");
    insertSectionEditorElement(anchor);
    sectionWebsiteLinkRangeRef.current = null;
    setSectionWebsiteLinkState(null);
  };

  const handleSaveField = async () => {
    if (!fieldEditorNodeId || !fieldEditorDraft) return;
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
        odeProcedureOptions: nextOptions,
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

  const handleSaveSection = async () => {
    if (!sectionEditorNodeId || !sectionEditorDraft) return;
    const trimmedLabel = sectionEditorDraft.label.trim() || "Untitled Section";
    const nextContent = sectionEditorSurfaceRef.current
      ? serializeProcedureEditorHtmlToText(sectionEditorSurfaceRef.current)
      : sectionEditorDraft.content;
    setSectionEditorSaving(true);
    try {
      await onRenameNodeTitle(sectionEditorNodeId, trimmedLabel);
      await onSaveNodeDescription(sectionEditorNodeId, null);
      await onSaveNodeContent(sectionEditorNodeId, nextContent);
      setNotice(`${trimmedLabel} updated.`);
      closeSectionEditor();
    } finally {
      setSectionEditorSaving(false);
    }
  };

  const handleAddSectionPhotos = async () => {
    if (!sectionEditorNodeId || sectionPhotoAdding) return;
    setSectionPhotoAdding(true);
    try {
      const addedCount = await onAttachImagesToNode(sectionEditorNodeId);
      if (addedCount > 0) {
        setNotice(addedCount === 1 ? "1 photo added." : `${addedCount} photos added.`);
      }
    } finally {
      setSectionPhotoAdding(false);
    }
  };

  const handleAddSectionAttachments = async () => {
    if (!sectionEditorNodeId || sectionAttachmentAdding) return;
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

  const saveRecords = async (node: AppNode, nextRecords: ProcedureRecord[]) => {
    await onSaveNodeProperties(node.id, {
      ...(node.properties ?? {}),
      [RECORDS_PROPERTY_KEY]: nextRecords
    });
  };

  const handleSaveRecord = async () => {
    if (!recordEditorParentNode || recordEditorFields.length === 0) return;
    const missingRequiredField = recordEditorFields.find(
      (entry) => entry.required && isEmptyRecordValue(draftValues[entry.node.id])
    );
    if (missingRequiredField) {
      setNotice(`${missingRequiredField.node.name} is required.`);
      return;
    }
    const nextValues = mergeDraftValues(recordEditorFields, draftValues);
    const currentRecords = readRecords(recordEditorParentNode);
    const nextRecords =
      recordEditorRecordId === null
        ? [
            {
              id: createProcedureId("record"),
              createdAt: Date.now(),
              updatedAt: Date.now(),
              values: nextValues
            },
            ...currentRecords
          ]
        : currentRecords.map((record) =>
            record.id === recordEditorRecordId
              ? {
                  ...record,
                  updatedAt: Date.now(),
                  values: nextValues
                }
              : record
          );
    setRecordSaving(true);
    try {
      await saveRecords(recordEditorParentNode, nextRecords);
      setNotice("Record saved.");
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
    setDraftValues((current) => ({
      ...current,
      [fieldId]: value
    }));
  };

  const renderRecordField = (entry: ProcedureFieldEntry) => {
    const fieldId = entry.node.id;
    const value = draftValues[fieldId];
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

    if (entry.type === "table") {
      const columns = entry.options.length > 0 ? entry.options : DEFAULT_TABLE_COLUMNS;
      const tableValue = isStringRecord(value) ? value : createEmptyTableValue(columns);
      return (
        <div
          key={fieldId}
          className="rounded-[24px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] px-4 py-4"
        >
          {commonLabel}
          <div className="grid gap-3 md:grid-cols-2">
            {columns.map((column) => (
              <label key={`${fieldId}-${column}`} className="block">
                <div className="mb-2 text-[0.76rem] uppercase tracking-[0.14em] text-[var(--ode-text-muted)]">
                  {column}
                </div>
                <input
                  type="text"
                  className="ode-input h-11 w-full rounded-[16px] px-4"
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
              : entry.type === "number"
                ? "1"
                : undefined
          }
          className="ode-input h-11 w-full rounded-[16px] px-4"
          placeholder={entry.placeholder}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => handleFieldValueChange(fieldId, event.target.value)}
        />
      </label>
    );
  };

  const renderRecordList = (node: AppNode, depth: number) => {
    const fields = getDirectFieldEntries(node, byParent);
    const visibleFields = fields.filter((entry) => entry.showInMasterList);
    const records = readRecords(node);
    return (
        <div className={depth === 0 ? "space-y-4" : "mt-5 space-y-4"}>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <OdeTooltip label={`Add a record to ${node.name}`}>
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-[18px] border border-[rgba(173,193,220,0.95)] bg-white text-[#42658e] shadow-[0_8px_24px_rgba(21,55,92,0.08)] transition hover:border-[#92b2db]"
                onClick={() => openNewRecordEditor(node)}
                aria-label={`Add a record to ${node.name}`}
              >
                <PlusGlyphSmall />
              </button>
            </OdeTooltip>
          </div>

        {visibleFields.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-[rgba(174,194,218,0.92)] bg-white/72 px-5 py-4 text-[0.94rem] text-[#5b728b]">
            All fields are hidden from the master list. Records still open on double-click.
          </div>
        ) : null}

        {records.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[rgba(174,194,218,0.92)] bg-white/70 px-6 py-10 text-center text-[#5b728b]">
            No records yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-[24px] border border-[rgba(190,205,227,0.84)] bg-white/88">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[rgba(190,205,227,0.72)] bg-[#f7faff] text-[0.74rem] uppercase tracking-[0.16em] text-[#6b8096]">
                    <th className="px-4 py-3">Row</th>
                    {visibleFields.map((entry) => (
                      <th key={`head-${node.id}-${entry.node.id}`} className="px-4 py-3 whitespace-nowrap">
                        {entry.node.name}
                      </th>
                    ))}
                    <th className="px-4 py-3 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record, index) => (
                    <tr
                      key={record.id}
                      className="cursor-pointer border-b border-[rgba(190,205,227,0.52)] text-[#294056] transition hover:bg-[#f8fbff]"
                      onDoubleClick={() => openExistingRecordEditor(node, record)}
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-[0.84rem] font-medium text-[#5c728a]">
                        {index + 1}
                      </td>
                      {visibleFields.map((entry) => (
                        <td key={`${record.id}-${entry.node.id}`} className="max-w-[240px] px-4 py-3">
                          <div className="truncate text-[0.92rem]">
                            {formatRecordValue(record.values[entry.node.id])}
                          </div>
                        </td>
                      ))}
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-2">
                          <OdeTooltip label="Edit this record">
                            <button
                              type="button"
                              className="rounded-[14px] border border-[rgba(173,193,220,0.95)] px-3 py-1.5 text-[0.74rem] uppercase tracking-[0.14em] text-[#42658e]"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                openExistingRecordEditor(node, record);
                              }}
                            >
                              Edit
                            </button>
                          </OdeTooltip>
                          <OdeTooltip label="Delete this record">
                            <button
                              type="button"
                              className="rounded-[14px] border border-[rgba(205,184,184,0.9)] px-3 py-1.5 text-[0.74rem] uppercase tracking-[0.14em] text-[#99686a]"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                requestDeleteRecord(node, record.id);
                              }}
                            >
                              Delete
                            </button>
                          </OdeTooltip>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const connectedTextClass =
    "inline border-none bg-transparent p-0 align-baseline text-left text-[0.98em] italic text-[#2d7ebe] underline decoration-[rgba(45,126,190,0.42)] underline-offset-4 transition hover:text-[#184c75]";

  const renderSectionInlineTokens = (text: string, keyPrefix: string): ReactNode[] => {
    return parseProcedureInlineTokens(text).map((token, tokenIndex) => {
      const tokenKey = `${keyPrefix}-${tokenIndex}`;
      if (token.type === "text") {
        return <Fragment key={tokenKey}>{token.value}</Fragment>;
      }
      if (token.type === "bold") {
        return (
          <strong key={tokenKey} className="font-semibold text-[#22364d]">
            {token.value}
          </strong>
        );
      }
      if (token.type === "italic") {
        return (
          <em key={tokenKey} className="italic text-[#294056]">
            {token.value}
          </em>
        );
      }
      if (token.type === "node_link") {
        const linkedNode = globalNodeById.get(token.nodeId) ?? null;
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
              className={`${connectedTextClass} ${linkedNode ? "" : "cursor-not-allowed text-[#b98585] decoration-[rgba(185,133,133,0.42)]"}`}
              disabled={!linkedNode}
              onClick={(event) => {
                event.stopPropagation();
                if (!linkedNode) return;
                if (linkedNode.type === "file") {
                  void onOpenLinkedFile(linkedNode.id);
                  return;
                }
                void onOpenLinkedNode(linkedNode.id);
              }}
            >
              {label}
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
              className={connectedTextClass}
              onClick={(event) => {
                event.stopPropagation();
                void onLaunchLinkedApp({
                  id: token.appId ?? `procedure-app-${tokenIndex}`,
                  label: token.appName || label,
                  kind: token.kind,
                  target: token.target,
                  iconKey: "app"
                });
              }}
            >
              {label}
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
          <ul key={blockKey} className="ml-5 list-disc space-y-1 text-[0.98rem] leading-7 text-[#2d4763]">
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
          <ol key={blockKey} className="ml-5 list-decimal space-y-1 text-[0.98rem] leading-7 text-[#2d4763]">
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
            className="rounded-[20px] border border-[rgba(173,193,220,0.62)] bg-[#f7fbff] px-5 py-4 italic text-[#31506f]"
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
            className="overflow-x-auto rounded-[18px] border border-[rgba(173,193,220,0.72)] bg-[#f5f8fc] px-4 py-3 font-mono text-[0.84rem] leading-6 text-[#294056]"
          >
            <code>{block.code}</code>
          </pre>
        );
      }
      if (block.type === "divider") {
        return <div key={blockKey} className="h-px bg-[rgba(190,205,227,0.92)]" />;
      }
      if (block.type === "insight") {
        return (
          <div
            key={blockKey}
            className="rounded-[20px] border border-[rgba(173,193,220,0.7)] bg-[#f8fbff] px-5 py-4 text-[#2d4763]"
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
        <p key={blockKey} className="text-[0.98rem] leading-7 text-[#2d4763]">
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

  const renderSectionNode = (node: AppNode, depth: number) => {
    const sectionChildren = getDirectSectionChildren(node, byParent);
    const annexFiles = getDirectFileChildren(node, byParent).filter(
      (reference) => getDesktopMediaPreviewKind(reference) !== "image"
    );
    const directFields = getDirectFieldEntries(node, byParent);
    const hasText = Boolean((node.description ?? "").trim().length > 0 || (node.content ?? "").trim().length > 0);
    const showEmptyHint =
      !hasText && directFields.length === 0 && sectionChildren.length === 0 && annexFiles.length === 0;

    const annexBlock =
      annexFiles.length > 0 ? (
        <div
          className={
            depth === 0
              ? "rounded-[24px] border border-[rgba(190,205,227,0.78)] bg-white/72 px-6 py-5 shadow-[0_14px_36px_rgba(19,55,93,0.08)]"
              : "mt-5 rounded-[20px] border border-[rgba(190,205,227,0.72)] bg-white/70 px-5 py-4"
          }
        >
          <div className="text-[0.74rem] uppercase tracking-[0.18em] text-[#6c84a2]">
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
                  className="flex flex-wrap items-center gap-3 rounded-[16px] border border-[rgba(190,205,227,0.68)] bg-white/78 px-4 py-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-10 w-10 flex-none items-center justify-center rounded-[14px] border border-[rgba(190,205,227,0.76)] bg-[#f6f9fd] text-[#42658e]">
                      <FileGlyphSmall />
                    </div>
                    <div className="min-w-0">
                      <OdeTooltip label={referenceWorkspaceName}>
                        <button
                          type="button"
                          className="ode-wrap-text text-left text-[0.98rem] font-medium text-[#28415d] transition hover:text-[#2d7ebe]"
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
                    className="rounded-[14px] border border-[rgba(173,193,220,0.92)] px-3 py-1.5 text-[0.74rem] uppercase tracking-[0.14em] text-[#42658e] transition hover:border-[#92b2db]"
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

    if (depth === 0) {
      return (
        <div key={node.id} className="space-y-8">
          {hasText ? (
            <div className="rounded-[28px] border border-[rgba(190,205,227,0.82)] bg-white/72 px-6 py-6 shadow-[0_16px_44px_rgba(19,55,93,0.08)]">
              {node.description ? <div className="text-[1rem] text-[#627a92]">{node.description}</div> : null}
              {node.content ? (
                <div className="mt-4 space-y-4 break-words text-[1rem] leading-7 text-[#2d4763]">
                  {renderSectionContent(node.content, `section-${node.id}`)}
                </div>
              ) : null}
            </div>
          ) : null}

          {annexBlock}

          {directFields.length > 0 ? renderRecordList(node, depth) : null}

          {showEmptyHint ? (
            <div className="rounded-[24px] border border-dashed border-[rgba(174,194,218,0.92)] bg-white/66 px-6 py-6 text-[#5b728b]">
              Double-click this heading in the tree to add notes, links, comments, or rich text details.
            </div>
          ) : null}

          {sectionChildren.length > 0 ? (
            <div className="space-y-6">{sectionChildren.map((child) => renderSectionNode(child, depth + 1))}</div>
          ) : null}
        </div>
      );
    }

    return (
      <section key={node.id} className={resolveSectionShellClasses(depth)}>
        <div className={resolveHeadingClasses(depth)}>{node.name}</div>
        {node.description ? <div className="mt-3 text-[0.98rem] text-[#627a92]">{node.description}</div> : null}
        {node.content ? (
          <div className="mt-4 space-y-4 break-words text-[0.98rem] leading-7 text-[#2d4763]">
            {renderSectionContent(node.content, `section-${node.id}`)}
          </div>
        ) : null}
        {annexBlock}
        {directFields.length > 0 ? renderRecordList(node, depth) : null}
        {showEmptyHint ? (
          <div className="mt-4 text-[0.94rem] text-[#6a8097]">
            Double-click this heading in the tree to add notes, links, comments, or rich text details.
          </div>
        ) : null}
        {sectionChildren.length > 0 ? (
          <div className="mt-6 space-y-5">{sectionChildren.map((child) => renderSectionNode(child, depth + 1))}</div>
        ) : null}
      </section>
    );
  };

  if (!rootNode) {
    return (
      <section className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div className="rounded-[28px] border border-[rgba(186,201,223,0.65)] bg-white/90 px-6 py-8 text-center text-[#4f647c] shadow-[0_20px_60px_rgba(21,55,92,0.12)]">
          Select a folder to build a procedure.
        </div>
      </section>
    );
  }

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
          className="mx-auto flex max-w-[1320px] flex-col gap-5 px-4 py-5 lg:px-6"
          onContextMenu={(event) => {
            const target = event.target as HTMLElement;
            if (target.closest("input, textarea, select, button, label, [contenteditable='true']")) return;
            onOpenSurfaceContextMenu(event);
          }}
        >
          <section className="overflow-hidden rounded-[36px] border border-[rgba(190,205,227,0.86)] bg-[linear-gradient(180deg,#ffffff,#f4f7fb)] shadow-[0_24px_72px_rgba(19,55,93,0.14)]">
            <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-6">
              <div>
                <div className="text-[0.8rem] uppercase tracking-[0.22em] text-[#6c84a2]">
                  {workspaceName || "Procedure"}
                </div>
                <h2 className={resolveHeadingClasses(0)}>{rootNode.name}</h2>
                {notice ? <div className="mt-3 text-[0.92rem] text-[#3f648d]">{notice}</div> : null}
              </div>
            </div>
            <div className="border-t border-[rgba(190,205,227,0.7)] px-4 py-5 md:px-6">
              {renderSectionNode(rootNode, 0)}
            </div>
          </section>
        </div>
      </div>

      {recordEditorOpen && recordEditorParentNode ? (
        <div className={PROCEDURE_MODAL_OVERLAY_CLASS}>
          <div className={`${PROCEDURE_MODAL_PANEL_CLASS} max-w-[980px]`}>
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
              <div className="grid gap-4 md:grid-cols-2">{recordEditorFields.map((entry) => renderRecordField(entry))}</div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              {recordEditorRecordId ? (
                <OdeTooltip label="Delete this record">
                  <button
                    type="button"
                    className={PROCEDURE_MODAL_DANGER_BUTTON_CLASS}
                    onClick={() => {
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
                disabled={recordSaving}
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
                disabled={recordSaving}
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
                <div className="mt-2 text-[1.4rem] font-semibold text-[var(--ode-text)]">Delete File</div>
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

            <div className="mt-5 space-y-3 text-[0.95rem] leading-7 text-[var(--ode-text-muted)]">
              <p>
                This will remove{" "}
                <span className="font-medium text-[var(--ode-text)]">{attachmentDeleteState.nodeName}</span> from this
                section.
              </p>
              <p>The file node will be deleted from the tree and this action cannot be undone.</p>
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
        <div className={PROCEDURE_MODAL_OVERLAY_CLASS}>
          <div
            className={`${PROCEDURE_MODAL_PANEL_CLASS} flex h-[min(94vh,1020px)] max-w-[min(96vw,1680px)] flex-col overflow-hidden p-0`}
          >
            <div className="border-b border-[rgba(110,211,255,0.14)] px-6 py-5">
              <div className="flex items-center justify-between gap-4">
                <input
                  type="text"
                  className="ode-input h-14 min-w-0 flex-1 rounded-[18px] px-5 text-[1.35rem] font-semibold tracking-[-0.03em]"
                  placeholder="Untitled section"
                  value={sectionEditorDraft.label}
                  onChange={(event) =>
                    setSectionEditorDraft((current) => (current ? { ...current, label: event.target.value } : current))
                  }
                />
                <OdeTooltip label="Close section editor">
                  <button type="button" className={PROCEDURE_MODAL_CLOSE_BUTTON_CLASS} onClick={closeSectionEditor}>
                    Close
                  </button>
                </OdeTooltip>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="relative">
                  <button
                    type="button"
                    className="flex h-10 items-center gap-2 rounded-[16px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] px-4 text-[0.8rem] text-[var(--ode-text)] transition hover:border-[var(--ode-border-strong)]"
                    onMouseDown={preserveSectionEditorSelection}
                    onClick={() => {
                      setSectionNodeLinkPickerOpen(false);
                      setSectionNodeLinkQuery("");
                      setSectionAppPickerOpen(false);
                      setSectionAppQuery("");
                      setSectionWebsiteLinkState(null);
                      sectionWebsiteLinkRangeRef.current = null;
                      setSectionEditorStyleMenuOpen((current) => !current);
                    }}
                  >
                    <span>Style</span>
                    <span className="text-[0.64rem]">▼</span>
                  </button>
                  {sectionEditorStyleMenuOpen ? (
                    <div className="absolute left-0 top-[calc(100%+10px)] z-10 min-w-[210px] rounded-[20px] border border-[var(--ode-border)] bg-[rgba(5,29,46,0.96)] p-2 shadow-[0_24px_48px_rgba(0,0,0,0.28)]">
                      {SECTION_EDITOR_STYLE_OPTIONS.map((option) => {
                        const selected = sectionEditorCurrentStyle === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            className={`flex w-full rounded-[14px] px-4 py-3 text-left transition hover:bg-[rgba(12,52,79,0.7)] ${
                              selected ? "bg-[rgba(69,182,233,0.16)]" : ""
                            } ${option.buttonClassName}`}
                            onMouseDown={preserveSectionEditorSelection}
                            onClick={() => applySectionEditorCommand("formatBlock", option.blockTag)}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="flex h-10 items-center justify-center rounded-[16px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] px-4 text-[1.05rem] font-bold text-[var(--ode-text)] transition hover:border-[var(--ode-border-strong)]"
                  onMouseDown={preserveSectionEditorSelection}
                  onClick={() => applySectionEditorCommand("bold")}
                  aria-label="Bold"
                >
                  B
                </button>
                <button
                  type="button"
                  className="flex h-10 items-center justify-center rounded-[16px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] px-4 text-[1.05rem] italic text-[var(--ode-text)] transition hover:border-[var(--ode-border-strong)]"
                  onMouseDown={preserveSectionEditorSelection}
                  onClick={() => applySectionEditorCommand("italic")}
                  aria-label="Italic"
                >
                  I
                </button>
                <button
                  type="button"
                  className="flex h-10 items-center justify-center rounded-[16px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] px-4 text-[0.9rem] text-[var(--ode-text)] transition hover:border-[var(--ode-border-strong)]"
                  onMouseDown={preserveSectionEditorSelection}
                  onClick={() => applySectionEditorCommand("insertUnorderedList")}
                >
                  • List
                </button>
                <button
                  type="button"
                  className="flex h-10 items-center justify-center rounded-[16px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] px-4 text-[0.9rem] text-[var(--ode-text)] transition hover:border-[var(--ode-border-strong)]"
                  onMouseDown={preserveSectionEditorSelection}
                  onClick={() => applySectionEditorCommand("insertOrderedList")}
                >
                  1. List
                </button>
                <button
                  type="button"
                  className="flex h-10 items-center justify-center rounded-[16px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] px-4 text-[0.9rem] text-[var(--ode-text)] transition hover:border-[var(--ode-border-strong)]"
                  onMouseDown={preserveSectionEditorSelection}
                  onClick={() => applySectionEditorCommand("formatBlock", "<blockquote>")}
                >
                  Quote
                </button>
                <button
                  type="button"
                  className="flex h-10 items-center justify-center rounded-[16px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] px-4 font-mono text-[0.9rem] text-[var(--ode-text)] transition hover:border-[var(--ode-border-strong)]"
                  onMouseDown={preserveSectionEditorSelection}
                  onClick={() => applySectionEditorCommand("formatBlock", "<pre>")}
                >
                  {"</>"}
                </button>
                <button
                  type="button"
                  className="flex h-10 items-center justify-center rounded-[16px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] px-4 text-[1rem] text-[var(--ode-text)] transition hover:border-[var(--ode-border-strong)]"
                  onMouseDown={preserveSectionEditorSelection}
                  onClick={() => applySectionEditorCommand("insertHorizontalRule")}
                >
                  —
                </button>
                <button
                  type="button"
                  className="flex h-10 items-center gap-2 rounded-[16px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] px-4 text-[0.8rem] text-[var(--ode-text)] transition hover:border-[var(--ode-border-strong)]"
                  onMouseDown={preserveSectionEditorSelection}
                  onClick={() => {
                    setSectionEditorStyleMenuOpen(false);
                    setSectionAppPickerOpen(false);
                    setSectionAppQuery("");
                    setSectionWebsiteLinkState(null);
                    captureSectionEditorInsertRange();
                    sectionWebsiteLinkRangeRef.current = null;
                    setSectionNodeLinkPickerOpen((current) => !current);
                  }}
                >
                  <NodeLinkGlyphSmall />
                  <span>Link Node</span>
                </button>
                <button
                  type="button"
                  className="flex h-10 items-center gap-2 rounded-[16px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] px-4 text-[0.8rem] text-[var(--ode-text)] transition hover:border-[var(--ode-border-strong)]"
                  onMouseDown={preserveSectionEditorSelection}
                  onClick={openSectionWebsiteLinkDialog}
                >
                  <OpenGlyphSmall />
                  <span>Link Website</span>
                </button>
                <button
                  type="button"
                  className="flex h-10 items-center gap-2 rounded-[16px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] px-4 text-[0.8rem] text-[var(--ode-text)] transition hover:border-[var(--ode-border-strong)]"
                  onMouseDown={preserveSectionEditorSelection}
                  onClick={() => {
                    setSectionEditorStyleMenuOpen(false);
                    setSectionNodeLinkPickerOpen(false);
                    setSectionNodeLinkQuery("");
                    setSectionWebsiteLinkState(null);
                    captureSectionEditorInsertRange();
                    sectionWebsiteLinkRangeRef.current = null;
                    setSectionAppPickerOpen((current) => !current);
                  }}
                >
                  <OpenGlyphSmall />
                  <span>Link App</span>
                </button>
                <button
                  type="button"
                  className="flex h-10 items-center gap-2 rounded-[16px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] px-4 text-[0.8rem] text-[var(--ode-text)] transition hover:border-[var(--ode-border-strong)]"
                  onMouseDown={preserveSectionEditorSelection}
                  onClick={() => {
                    void handleAddSectionPhotos();
                  }}
                >
                  <ImageGlyphSmall />
                  <span>{sectionPhotoAdding ? "Adding..." : "Upload Photos"}</span>
                </button>
              </div>

              {sectionNodeLinkPickerOpen ? (
                <div className="mt-4 rounded-[20px] border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-4 py-4">
                  <input
                    className="ode-input h-11 w-full rounded-[16px] px-4"
                    value={sectionNodeLinkQuery}
                    onChange={(event) => setSectionNodeLinkQuery(event.target.value)}
                    placeholder="Search nodes and workspaces"
                  />
                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <div>
                      <div className="mb-2 text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
                        Current Workspace
                      </div>
                      <div className="space-y-2">
                        {currentWorkspaceSectionNodeLinkCandidates.length > 0 ? (
                          currentWorkspaceSectionNodeLinkCandidates.map((candidate) => (
                            <button
                              key={candidate.node.id}
                              type="button"
                              className="flex w-full flex-col rounded-[18px] border border-[var(--ode-border)] bg-[rgba(5,29,46,0.76)] px-4 py-3 text-left transition hover:border-[var(--ode-border-strong)] hover:bg-[rgba(7,37,58,0.84)]"
                              onMouseDown={preserveSectionEditorSelection}
                              onClick={() => insertSectionNodeLink(candidate.node)}
                            >
                              <span className="ode-wrap-text text-[0.92rem] font-medium text-[var(--ode-text)]">{candidate.node.name}</span>
                              <span className="ode-wrap-text mt-1 text-[0.8rem] leading-5 text-[var(--ode-text-muted)]">{candidate.pathLabel}</span>
                            </button>
                          ))
                        ) : (
                          <div className="rounded-[18px] border border-dashed border-[var(--ode-border)] px-4 py-3 text-[0.84rem] text-[var(--ode-text-muted)]">
                            No matching nodes in this workspace.
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
                        Other Workspaces
                      </div>
                      <div className="space-y-2">
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
                                {candidate.node.name}
                                <span className="ml-2 text-[0.74rem] uppercase tracking-[0.14em] text-[var(--ode-text-muted)]">
                                  {candidate.workspaceName}
                                </span>
                              </span>
                              <span className="ode-wrap-text mt-1 text-[0.8rem] leading-5 text-[var(--ode-text-muted)]">{candidate.pathLabel}</span>
                            </button>
                          ))
                        ) : (
                          <div className="rounded-[18px] border border-dashed border-[var(--ode-border)] px-4 py-3 text-[0.84rem] text-[var(--ode-text-muted)]">
                            No matching nodes in other workspaces.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {sectionAppPickerOpen ? (
                <div className="mt-4 rounded-[20px] border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-4 py-4">
                  <input
                    className="ode-input h-11 w-full rounded-[16px] px-4"
                    value={sectionAppQuery}
                    onChange={(event) => setSectionAppQuery(event.target.value)}
                    placeholder="Search connected apps"
                  />
                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <div>
                      <div className="mb-2 text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
                        Current Workspace
                      </div>
                      <div className="space-y-2">
                        {currentWorkspaceSectionAppLinkCandidates.length > 0 ? (
                          currentWorkspaceSectionAppLinkCandidates.map((candidate) => (
                            <button
                              key={`${candidate.item.id}-${candidate.item.target}`}
                              type="button"
                              className="flex w-full flex-col rounded-[18px] border border-[var(--ode-border)] bg-[rgba(5,29,46,0.76)] px-4 py-3 text-left transition hover:border-[var(--ode-border-strong)] hover:bg-[rgba(7,37,58,0.84)]"
                              onMouseDown={preserveSectionEditorSelection}
                              onClick={() => insertSectionAppLink(candidate)}
                            >
                              <span className="ode-wrap-text text-[0.92rem] font-medium text-[var(--ode-text)]">
                                {candidate.item.label}
                              </span>
                              <span className="ode-wrap-text mt-1 text-[0.8rem] leading-5 text-[var(--ode-text-muted)]">
                                Connected from {candidate.sourceNode.name}
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="rounded-[18px] border border-dashed border-[var(--ode-border)] px-4 py-3 text-[0.84rem] text-[var(--ode-text-muted)]">
                            No connected apps in this workspace yet.
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
                        Other Workspaces
                      </div>
                      <div className="space-y-2">
                        {otherWorkspaceSectionAppLinkCandidates.length > 0 ? (
                          otherWorkspaceSectionAppLinkCandidates.map((candidate) => (
                            <button
                              key={`${candidate.item.id}-${candidate.item.target}`}
                              type="button"
                              className="flex w-full flex-col rounded-[18px] border border-[var(--ode-border)] bg-[rgba(5,29,46,0.76)] px-4 py-3 text-left transition hover:border-[var(--ode-border-strong)] hover:bg-[rgba(7,37,58,0.84)]"
                              onMouseDown={preserveSectionEditorSelection}
                              onClick={() => insertSectionAppLink(candidate)}
                            >
                              <span className="ode-wrap-text text-[0.92rem] font-medium text-[var(--ode-text)]">
                                {candidate.item.label}
                                <span className="ml-2 text-[0.74rem] uppercase tracking-[0.14em] text-[var(--ode-text-muted)]">
                                  {candidate.workspaceName}
                                </span>
                              </span>
                              <span className="ode-wrap-text mt-1 text-[0.8rem] leading-5 text-[var(--ode-text-muted)]">
                                Connected from {candidate.sourceNode.name}
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="rounded-[18px] border border-dashed border-[var(--ode-border)] px-4 py-3 text-[0.84rem] text-[var(--ode-text-muted)]">
                            No connected apps in other workspaces.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="px-6 pt-5">
                <div className="rounded-[20px] border border-[var(--ode-border)] bg-[rgba(5,29,46,0.52)] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">Files</div>
                    <button
                      type="button"
                      className="rounded-[14px] border border-[var(--ode-border)] px-3 py-1.5 text-[0.74rem] uppercase tracking-[0.14em] text-[var(--ode-text)] transition hover:border-[var(--ode-border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={sectionAttachmentAdding}
                      onClick={() => {
                        void handleAddSectionAttachments();
                      }}
                    >
                      {sectionAttachmentAdding ? "Adding..." : "Upload Files"}
                    </button>
                  </div>
                  {sectionEditorFileReferences.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {sectionEditorFileReferences.map((reference) => {
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
                            className="flex flex-wrap items-center gap-3 rounded-[16px] border border-[var(--ode-border)] bg-[rgba(5,29,46,0.76)] px-4 py-3"
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.58)] text-[var(--ode-accent)]">
                                <FileGlyphSmall />
                              </div>
                              <div className="min-w-0 flex-1">
                                <OdeTooltip label={referenceWorkspaceName}>
                                  <button
                                    type="button"
                                    className="ode-wrap-text text-left text-[0.9rem] font-medium text-[var(--ode-text)] transition hover:text-[var(--ode-accent)]"
                                    onClick={() => {
                                      void onOpenLinkedFile(reference.id);
                                    }}
                                  >
                                    {attachmentTitle}
                                  </button>
                                </OdeTooltip>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="rounded-[14px] border border-[var(--ode-border)] px-3 py-1.5 text-[0.74rem] uppercase tracking-[0.14em] text-[var(--ode-text)]"
                                onMouseDown={preserveSectionEditorSelection}
                                onClick={() => insertSectionReferenceLink(reference)}
                              >
                                Insert Link
                              </button>
                              <button
                                type="button"
                                className="rounded-[14px] border border-[var(--ode-border)] px-3 py-1.5 text-[0.74rem] uppercase tracking-[0.14em] text-[var(--ode-text)]"
                                onClick={() => {
                                  void onOpenLinkedFile(reference.id);
                                }}
                              >
                                Open
                              </button>
                              <button
                                type="button"
                                className="rounded-[14px] border border-[rgba(211,127,127,0.52)] px-3 py-1.5 text-[0.74rem] uppercase tracking-[0.14em] text-[#ffc7c7] transition hover:border-[rgba(244,157,157,0.72)] hover:text-[#fff0f0] disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={sectionAttachmentDeletingId === reference.id}
                                onClick={() => requestDeleteAttachment(reference)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-3 text-[0.84rem] leading-6 text-[var(--ode-text-muted)]">No files attached yet.</div>
                  )}
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-6 pt-4">
                <div className="mb-3 flex flex-wrap items-center gap-3 text-[0.8rem] text-[var(--ode-text-muted)]">
                  <span>LinkedIn-style notes editor</span>
                  <span>Use the toolbar to structure the section before saving.</span>
                </div>
                <div
                  ref={sectionEditorSurfaceRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="ode-input min-h-[420px] flex-1 overflow-y-auto rounded-[24px] px-5 py-4 text-[1rem] leading-8 text-[var(--ode-text)] outline-none overscroll-contain [&_a]:text-[#2d7ebe] [&_a]:italic [&_a]:underline [&_a]:decoration-[rgba(45,126,190,0.42)] [&_blockquote]:my-4 [&_blockquote]:rounded-[18px] [&_blockquote]:border [&_blockquote]:border-[rgba(110,211,255,0.18)] [&_blockquote]:bg-[rgba(7,39,61,0.42)] [&_blockquote]:px-4 [&_blockquote]:py-3 [&_blockquote]:text-[var(--ode-text)] [&_h1]:my-3 [&_h1]:text-[1.72rem] [&_h1]:font-semibold [&_h1]:tracking-[-0.04em] [&_h2]:my-3 [&_h2]:text-[1.45rem] [&_h2]:font-semibold [&_h2]:tracking-[-0.03em] [&_h3]:my-3 [&_h3]:text-[1.12rem] [&_h3]:font-semibold [&_h3]:tracking-[-0.02em] [&_h4]:my-2 [&_h4]:text-[1rem] [&_h4]:font-semibold [&_h4]:tracking-[-0.01em] [&_ol]:ml-6 [&_ol]:list-decimal [&_ol]:space-y-1 [&_p]:min-h-[1.8rem] [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-[18px] [&_pre]:border [&_pre]:border-[rgba(110,211,255,0.18)] [&_pre]:bg-[rgba(8,19,31,0.92)] [&_pre]:px-4 [&_pre]:py-3 [&_pre]:font-mono [&_pre]:text-[0.84rem] [&_pre]:leading-6 [&_pre]:text-[#cfeaff] [&_ul]:ml-6 [&_ul]:list-disc [&_ul]:space-y-1"
                  onKeyDown={handleSectionEditorKeyDown}
                  onInput={() => syncSectionEditorContentFromDom()}
                  onMouseUp={() => syncSectionEditorSelection()}
                  onFocus={() => {
                    setSectionEditorStyleMenuOpen(false);
                    syncSectionEditorSelection();
                  }}
                  onKeyUp={() => syncSectionEditorSelection()}
                  onBlur={() => syncSectionEditorContentFromDom()}
                  onClick={() => syncSectionEditorSelection()}
                  data-placeholder="Write notes, decisions, links, connected apps, websites, and attached-file context here."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-[rgba(110,211,255,0.14)] px-6 py-4">
              <button type="button" className={PROCEDURE_MODAL_SECONDARY_BUTTON_CLASS} onClick={closeSectionEditor}>
                Cancel
              </button>
              <button
                type="button"
                className={`${PROCEDURE_MODAL_PRIMARY_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
                disabled={sectionEditorSaving}
                onClick={() => {
                  void handleSaveSection();
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {sectionWebsiteLinkState ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(12,23,38,0.48)] px-4">
          <div className={`${PROCEDURE_MODAL_PANEL_CLASS} max-w-[540px]`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[0.78rem] uppercase tracking-[0.18em] text-[var(--ode-accent)]">Link</div>
                <div className="mt-2 text-[1.4rem] font-semibold text-[var(--ode-text)]">Website Link</div>
              </div>
              <OdeTooltip label="Close link dialog">
                <button
                  type="button"
                  className={PROCEDURE_MODAL_CLOSE_BUTTON_CLASS}
                  onClick={() => {
                    sectionWebsiteLinkRangeRef.current = null;
                    setSectionWebsiteLinkState(null);
                  }}
                >
                  Close
                </button>
              </OdeTooltip>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block">
                <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">Label</div>
                <input
                  type="text"
                  className="ode-input h-11 w-full rounded-[16px] px-4"
                  value={sectionWebsiteLinkState.label}
                  onChange={(event) =>
                    setSectionWebsiteLinkState((current) => (current ? { ...current, label: event.target.value } : current))
                  }
                />
              </label>

              <label className="block">
                <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">Website URL</div>
                <input
                  type="text"
                  className="ode-input h-11 w-full rounded-[16px] px-4"
                  value={sectionWebsiteLinkState.href}
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
                onClick={() => {
                  sectionWebsiteLinkRangeRef.current = null;
                  setSectionWebsiteLinkState(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${PROCEDURE_MODAL_PRIMARY_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
                disabled={sectionEditorSaving}
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

      {fieldEditorNodeId && fieldEditorDraft ? (
        <div className={PROCEDURE_MODAL_OVERLAY_CLASS}>
          <div className={`${PROCEDURE_MODAL_PANEL_CLASS} max-w-[640px]`}>
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

            <div className="mt-6 space-y-4">
              <label className="block">
                <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">Field Label</div>
                <input
                  type="text"
                  className="ode-input h-11 w-full rounded-[16px] px-4"
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
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className={PROCEDURE_MODAL_SECONDARY_BUTTON_CLASS} onClick={closeFieldEditor}>
                Cancel
              </button>
              <button
                type="button"
                className={`${PROCEDURE_MODAL_PRIMARY_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
                disabled={fieldEditorSaving}
                onClick={() => {
                  void handleSaveField();
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
