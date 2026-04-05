import type { AppNode } from "@/lib/types";

export const PROCEDURE_RICH_TEXT_HTML_PROPERTY = "odeProcedureRichTextHtml";

type ProcedureRichTextTextAlign = "left" | "center" | "right" | "justify";

export type ProcedureRichTextRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string | null;
  fontFamily?: string | null;
  fontSize?: string | null;
  href?: string | null;
  linkType?: string | null;
  nodeId?: string | null;
  tableNodeId?: string | null;
  recordId?: string | null;
  title?: string | null;
};

export type ProcedureRichTextParagraph = {
  runs: ProcedureRichTextRun[];
  textAlign?: ProcedureRichTextTextAlign;
  lineHeight?: string;
  marginLeft?: string;
};

export type ProcedureRichTextListItem = ProcedureRichTextParagraph & {
  level: number;
  ordered: boolean;
  start?: number;
};

export type ProcedureRichTextTableCell = {
  header?: boolean;
  colSpan?: number;
  rowSpan?: number;
  width?: string;
  paragraphs: ProcedureRichTextParagraph[];
};

export type ProcedureRichTextTableRow = {
  cells: ProcedureRichTextTableCell[];
};

export type ProcedureRichTextBlock =
  | {
      type: "heading";
      level: 1 | 2 | 3 | 4 | 5 | 6;
      runs: ProcedureRichTextRun[];
      textAlign?: ProcedureRichTextTextAlign;
      lineHeight?: string;
      marginLeft?: string;
    }
  | { type: "paragraph"; runs: ProcedureRichTextRun[]; textAlign?: ProcedureRichTextTextAlign; lineHeight?: string; marginLeft?: string }
  | { type: "list"; items: ProcedureRichTextListItem[] }
  | { type: "quote"; paragraphs: ProcedureRichTextParagraph[] }
  | { type: "code"; code: string }
  | { type: "divider" }
  | { type: "page_break" }
  | { type: "table"; rows: ProcedureRichTextTableRow[] }
  | { type: "image"; src: string; alt: string };

const ALLOWED_BLOCK_TAGS = new Set([
  "p",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "hr",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td"
]);
const ALLOWED_INLINE_TAGS = new Set(["span", "strong", "b", "em", "i", "a", "br", "img", "code", "font"]);
const LINKABLE_PROTOCOL_PATTERN = /^(https?:|mailto:|tel:|ode:\/\/)/i;
const DATA_IMAGE_PATTERN = /^data:image\/(?:png|jpe?g|gif|bmp|webp);base64,[a-z0-9+/=]+$/i;
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNCTION_COLOR_PATTERN = /^(?:rgb|rgba|hsl|hsla)\((?:[^()]+)\)$/i;
const NAMED_COLOR_PATTERN = /^[a-z]+$/i;
const FONT_SIZE_PATTERN = /^(\d+(?:\.\d+)?)(px|pt|rem|em|%)$/i;
const CSS_LENGTH_PATTERN = /^(-?\d+(?:\.\d+)?)(px|pt|rem|em|%)$/i;
const LINE_HEIGHT_PATTERN = /^(\d+(?:\.\d+)?)(px|pt|rem|em|%)?$/i;
const HTML_FONT_SIZE_TO_PT: Record<string, string> = {
  "1": "8pt",
  "2": "10pt",
  "3": "12pt",
  "4": "14pt",
  "5": "18pt",
  "6": "24pt",
  "7": "36pt"
};

function isAllowedRichTextColor(value: string): boolean {
  const trimmed = value.trim();
  return HEX_COLOR_PATTERN.test(trimmed) || FUNCTION_COLOR_PATTERN.test(trimmed) || NAMED_COLOR_PATTERN.test(trimmed);
}

function normalizeRichTextColor(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  return isAllowedRichTextColor(trimmed) ? trimmed : null;
}

function normalizeRichTextFontFamily(value: string | null | undefined): string | null {
  const trimmed = value?.trim().replace(/\s+/g, " ") ?? "";
  if (!trimmed || trimmed.length > 160) return null;
  if (/[;{}<>`\n\r]/.test(trimmed)) return null;
  if (/url\s*\(|expression\s*\(/i.test(trimmed)) return null;
  return trimmed;
}

function normalizeRichTextFontSize(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase() ?? "";
  if (!trimmed) return null;
  const match = FONT_SIZE_PATTERN.exec(trimmed);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount < 6 || amount > 144) return null;
  const rounded = Number.isInteger(amount) ? `${amount}` : `${Number(amount.toFixed(2))}`;
  return `${rounded}${match[2]}`;
}

function normalizeRichTextCssLength(
  value: string | null | undefined,
  options?: { min?: number; max?: number; allowNegative?: boolean; allowUnitlessZero?: boolean }
): string | null {
  const trimmed = value?.trim().toLowerCase() ?? "";
  if (!trimmed) return null;
  if (options?.allowUnitlessZero && trimmed === "0") {
    return "0px";
  }
  const match = CSS_LENGTH_PATTERN.exec(trimmed);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  if (!options?.allowNegative && amount < 0) return null;
  if (typeof options?.min === "number" && amount < options.min) return null;
  if (typeof options?.max === "number" && amount > options.max) return null;
  const rounded = Number.isInteger(amount) ? `${amount}` : `${Number(amount.toFixed(2))}`;
  return `${rounded}${match[2]}`;
}

function normalizeRichTextLineHeight(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase() ?? "";
  if (!trimmed || trimmed === "normal") return null;
  const match = LINE_HEIGHT_PATTERN.exec(trimmed);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount < 0.8) return null;
  const rounded = Number.isInteger(amount) ? `${amount}` : `${Number(amount.toFixed(2))}`;
  const unit = match[2]?.toLowerCase() ?? "";
  if (!unit) {
    return amount > 4 ? null : rounded;
  }
  if (unit === "%") {
    return amount > 400 ? null : `${rounded}%`;
  }
  return amount > 160 ? null : `${rounded}${unit}`;
}

function normalizeRichTextMarginLeft(value: string | null | undefined): string | null {
  return normalizeRichTextCssLength(value, {
    min: 0,
    max: 240,
    allowUnitlessZero: true
  });
}

function normalizeRichTextWidth(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase() ?? "";
  if (!trimmed) return null;
  const percentMatch = /^(\d+(?:\.\d+)?)%$/.exec(trimmed);
  if (percentMatch) {
    const amount = Number(percentMatch[1]);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100) return null;
    const rounded = Number.isInteger(amount) ? `${amount}` : `${Number(amount.toFixed(2))}`;
    return `${rounded}%`;
  }
  return normalizeRichTextCssLength(value, {
    min: 0,
    max: 1600,
    allowUnitlessZero: true
  });
}

function normalizeRichTextTextAlign(value: string | null | undefined): ProcedureRichTextTextAlign | null {
  const trimmed = value?.trim().toLowerCase() ?? "";
  if (trimmed === "center" || trimmed === "right" || trimmed === "justify") return trimmed;
  if (trimmed === "left") return "left";
  return null;
}

function readInlineStyleValue(element: Element, property: string): string {
  if (!(element instanceof HTMLElement)) return "";
  const directValue = element.style.getPropertyValue(property);
  if (directValue.trim()) return directValue.trim();
  const style = element.getAttribute("style") ?? "";
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escapedProperty}\\s*:\\s*([^;]+)`, "i").exec(style);
  return match?.[1]?.trim() ?? "";
}

function sanitizeProcedureRichTextUrl(rawValue: string, allowImageDataUrl = false): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  if (allowImageDataUrl && DATA_IMAGE_PATTERN.test(trimmed)) return trimmed;
  return LINKABLE_PROTOCOL_PATTERN.test(trimmed) ? trimmed : null;
}

function readSanitizedColorFromElement(element: Element): string | null {
  const htmlElement = element instanceof HTMLElement ? element : null;
  const fontColor = htmlElement?.getAttribute("color") ?? "";
  const directColor = htmlElement?.style.color ?? "";
  return (
    normalizeRichTextColor(directColor) ??
    normalizeRichTextColor(readInlineStyleValue(element, "color")) ??
    normalizeRichTextColor(fontColor)
  );
}

function readSanitizedFontFamilyFromElement(element: Element): string | null {
  const htmlElement = element instanceof HTMLElement ? element : null;
  const directFamily = htmlElement?.style.fontFamily ?? "";
  const inlineFamily = readInlineStyleValue(element, "font-family");
  const fontFace = htmlElement?.getAttribute("face") ?? "";
  return (
    normalizeRichTextFontFamily(directFamily) ??
    normalizeRichTextFontFamily(inlineFamily) ??
    normalizeRichTextFontFamily(fontFace)
  );
}

function readSanitizedFontSizeFromElement(element: Element): string | null {
  const htmlElement = element instanceof HTMLElement ? element : null;
  const directSize = htmlElement?.style.fontSize ?? "";
  const inlineSize = readInlineStyleValue(element, "font-size");
  const fontSizeAttr = (htmlElement?.getAttribute("size") ?? "").trim();
  return (
    normalizeRichTextFontSize(directSize) ??
    normalizeRichTextFontSize(inlineSize) ??
    normalizeRichTextFontSize(HTML_FONT_SIZE_TO_PT[fontSizeAttr] ?? null)
  );
}

function normalizeRichTextFontWeight(value: string | null | undefined): "400" | "700" | null {
  const trimmed = value?.trim().toLowerCase() ?? "";
  if (!trimmed) return null;
  if (trimmed === "normal") return "400";
  if (trimmed === "bold" || trimmed === "bolder") return "700";
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed >= 600 ? "700" : "400";
}

function readSanitizedFontWeightFromElement(element: Element): "400" | "700" | null {
  const htmlElement = element instanceof HTMLElement ? element : null;
  const directWeight = htmlElement?.style.fontWeight ?? "";
  return normalizeRichTextFontWeight(directWeight) ?? normalizeRichTextFontWeight(readInlineStyleValue(element, "font-weight"));
}

function normalizeRichTextFontStyle(value: string | null | undefined): "normal" | "italic" | null {
  const trimmed = value?.trim().toLowerCase() ?? "";
  if (!trimmed) return null;
  if (trimmed.includes("italic")) return "italic";
  if (trimmed === "normal") return "normal";
  return null;
}

function readSanitizedFontStyleFromElement(element: Element): "normal" | "italic" | null {
  const htmlElement = element instanceof HTMLElement ? element : null;
  const directStyle = htmlElement?.style.fontStyle ?? "";
  return normalizeRichTextFontStyle(directStyle) ?? normalizeRichTextFontStyle(readInlineStyleValue(element, "font-style"));
}

function readSanitizedLineHeightFromElement(element: Element): string | null {
  const htmlElement = element instanceof HTMLElement ? element : null;
  const directValue = htmlElement?.style.lineHeight ?? "";
  return normalizeRichTextLineHeight(directValue) ?? normalizeRichTextLineHeight(readInlineStyleValue(element, "line-height"));
}

function readSanitizedMarginLeftFromElement(element: Element): string | null {
  const htmlElement = element instanceof HTMLElement ? element : null;
  const directValue = htmlElement?.style.textIndent ?? "";
  return (
    normalizeRichTextMarginLeft(directValue) ??
    normalizeRichTextMarginLeft(readInlineStyleValue(element, "text-indent")) ??
    normalizeRichTextMarginLeft(htmlElement?.style.marginLeft ?? "") ??
    normalizeRichTextMarginLeft(readInlineStyleValue(element, "margin-left")) ??
    normalizeRichTextMarginLeft(htmlElement?.style.paddingLeft ?? "") ??
    normalizeRichTextMarginLeft(readInlineStyleValue(element, "padding-left"))
  );
}

function buildSanitizedStyleAttribute(element: Element): string | null {
  const color = readSanitizedColorFromElement(element);
  const fontFamily = readSanitizedFontFamilyFromElement(element);
  const fontSize = readSanitizedFontSizeFromElement(element);
  const fontWeight = readSanitizedFontWeightFromElement(element);
  const fontStyle = readSanitizedFontStyleFromElement(element);
  const lineHeight = readSanitizedLineHeightFromElement(element);
  const marginLeft = readSanitizedMarginLeftFromElement(element);
  const width =
    normalizeRichTextWidth(element instanceof HTMLElement ? element.style.width : "") ??
    normalizeRichTextWidth(readInlineStyleValue(element, "width"));
  const textAlign =
    normalizeRichTextTextAlign(element instanceof HTMLElement ? element.style.textAlign : "") ??
    normalizeRichTextTextAlign(readInlineStyleValue(element, "text-align"));
  const declarations: string[] = [];
  if (color) declarations.push(`color:${color}`);
  if (fontFamily) declarations.push(`font-family:${fontFamily}`);
  if (fontSize) declarations.push(`font-size:${fontSize}`);
  if (fontWeight) declarations.push(`font-weight:${fontWeight}`);
  if (fontStyle) declarations.push(`font-style:${fontStyle}`);
  if (lineHeight) declarations.push(`line-height:${lineHeight}`);
  if (marginLeft) declarations.push(`text-indent:${marginLeft}`);
  if (width) declarations.push(`width:${width}`);
  if (textAlign) declarations.push(`text-align:${textAlign}`);
  return declarations.length > 0 ? declarations.join(";") : null;
}

function sanitizeProcedureRichTextNode(node: Node, documentRef: Document): Node[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const value = node.textContent ?? "";
    return value.length > 0 ? [documentRef.createTextNode(value)] : [];
  }

  if (!(node instanceof HTMLElement)) return [];

  const tagName = node.tagName.toLowerCase();
  if (tagName === "script" || tagName === "style" || tagName === "iframe") {
    return [];
  }

  if (tagName === "font") {
    const span = documentRef.createElement("span");
    const style = buildSanitizedStyleAttribute(node);
    if (style) span.setAttribute("style", style);
    for (const child of Array.from(node.childNodes)) {
      sanitizeProcedureRichTextNode(child, documentRef).forEach((sanitizedChild) => span.appendChild(sanitizedChild));
    }
    return span.childNodes.length > 0 ? [span] : [];
  }

  const isAllowedTag = ALLOWED_BLOCK_TAGS.has(tagName) || ALLOWED_INLINE_TAGS.has(tagName);
  if (!isAllowedTag) {
    return Array.from(node.childNodes).flatMap((child) => sanitizeProcedureRichTextNode(child, documentRef));
  }

  const nextElement = documentRef.createElement(tagName === "font" ? "span" : tagName);
  const style = buildSanitizedStyleAttribute(node);
  if (style) nextElement.setAttribute("style", style);

  if (tagName === "a") {
    const href = sanitizeProcedureRichTextUrl(node.getAttribute("href") ?? "");
    if (href) {
      nextElement.setAttribute("href", href);
      const linkType = (node.getAttribute("data-ode-link-type") ?? "").trim();
      if (linkType) nextElement.setAttribute("data-ode-link-type", linkType);
      const nodeId = (node.getAttribute("data-node-id") ?? "").trim();
      if (nodeId) nextElement.setAttribute("data-node-id", nodeId);
      const tableNodeId = (node.getAttribute("data-table-node-id") ?? "").trim();
      if (tableNodeId) nextElement.setAttribute("data-table-node-id", tableNodeId);
      const recordId = (node.getAttribute("data-record-id") ?? "").trim();
      if (recordId) nextElement.setAttribute("data-record-id", recordId);
      const linkLabel = (node.getAttribute("data-link-label") ?? "").trim();
      if (linkLabel) nextElement.setAttribute("data-link-label", linkLabel);
      const title = (node.getAttribute("title") ?? "").trim();
      if (title) nextElement.setAttribute("title", title);
      if (/^https?:/i.test(href)) {
        nextElement.setAttribute("target", "_blank");
        nextElement.setAttribute("rel", "noreferrer");
      }
    }
  }

  if (tagName === "img") {
    const src = sanitizeProcedureRichTextUrl(node.getAttribute("src") ?? "", true);
    const nodeId = (node.getAttribute("data-node-id") ?? "").trim();
    const linkType = (node.getAttribute("data-ode-link-type") ?? "").trim();
    if (src) nextElement.setAttribute("src", src);
    if (nodeId) nextElement.setAttribute("data-node-id", nodeId);
    if (linkType) nextElement.setAttribute("data-ode-link-type", linkType);
    const alt = (node.getAttribute("alt") ?? "").trim();
    if (alt) nextElement.setAttribute("alt", alt);
    const imageAlt = (node.getAttribute("data-image-alt") ?? "").trim();
    if (imageAlt) nextElement.setAttribute("data-image-alt", imageAlt);
    const width = Number.parseInt(node.getAttribute("width") ?? "", 10);
    if (Number.isFinite(width) && width > 0) {
      nextElement.setAttribute("width", `${Math.max(40, Math.min(1600, width))}`);
    }
    const height = Number.parseInt(node.getAttribute("height") ?? "", 10);
    if (Number.isFinite(height) && height > 0) {
      nextElement.setAttribute("height", `${Math.max(40, Math.min(1600, height))}`);
    }
    return src || nodeId ? [nextElement] : [];
  }

  if (tagName === "hr") {
    if ((node.getAttribute("data-ode-page-break") ?? "").trim().toLowerCase() === "true") {
      nextElement.setAttribute("data-ode-page-break", "true");
    }
    return [nextElement];
  }

  if (tagName === "ol") {
    const start = Number.parseInt(node.getAttribute("start") ?? "", 10);
    if (Number.isFinite(start) && start > 1) {
      nextElement.setAttribute("start", `${Math.round(start)}`);
    }
  }

  if (tagName === "th" || tagName === "td") {
    const colSpan = Number.parseInt(node.getAttribute("colspan") ?? "", 10);
    if (Number.isFinite(colSpan) && colSpan > 1 && colSpan <= 24) {
      nextElement.setAttribute("colspan", `${Math.round(colSpan)}`);
    }
    const rowSpan = Number.parseInt(node.getAttribute("rowspan") ?? "", 10);
    if (Number.isFinite(rowSpan) && rowSpan > 1 && rowSpan <= 24) {
      nextElement.setAttribute("rowspan", `${Math.round(rowSpan)}`);
    }
  }

  if (tagName === "div") {
    const insightDomain = (node.getAttribute("data-insight-domain") ?? "").trim().toLowerCase();
    if (insightDomain === "business" || insightDomain === "operations" || insightDomain === "ux" || insightDomain === "ai") {
      nextElement.setAttribute("data-insight-domain", insightDomain);
    }
  }

  if (tagName === "br") {
    return [nextElement];
  }

  for (const child of Array.from(node.childNodes)) {
    sanitizeProcedureRichTextNode(child, documentRef).forEach((sanitizedChild) => nextElement.appendChild(sanitizedChild));
  }

  if (tagName === "a" && !nextElement.getAttribute("href")) {
    return Array.from(nextElement.childNodes);
  }

  if (nextElement.childNodes.length === 0 && tagName !== "img") {
    return [];
  }

  return [nextElement];
}

export function sanitizeProcedureRichTextHtml(rawHtml: string | null | undefined): string {
  const html = rawHtml?.trim() ?? "";
  if (!html || typeof DOMParser === "undefined") return "";
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const container = parsed.createElement("div");
  for (const child of Array.from(parsed.body.childNodes)) {
    sanitizeProcedureRichTextNode(child, parsed).forEach((sanitizedChild) => container.appendChild(sanitizedChild));
  }
  return container.innerHTML.trim();
}

export function readProcedureRichTextHtml(node: AppNode | null | undefined): string | null {
  const rawValue = node?.properties?.[PROCEDURE_RICH_TEXT_HTML_PROPERTY];
  if (typeof rawValue !== "string") return null;
  const sanitized = sanitizeProcedureRichTextHtml(rawValue);
  return sanitized || null;
}

export function readProcedureRichTextBlocks(html: string | null | undefined): ProcedureRichTextBlock[] {
  const sanitizedHtml = sanitizeProcedureRichTextHtml(html);
  if (!sanitizedHtml || typeof DOMParser === "undefined") return [];

  const parsed = new DOMParser().parseFromString(sanitizedHtml, "text/html");
  type RunContext = {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    color?: string | null;
    fontFamily?: string | null;
    fontSize?: string | null;
    href?: string | null;
    linkType?: string | null;
    nodeId?: string | null;
    tableNodeId?: string | null;
    recordId?: string | null;
    title?: string | null;
  };

  const pushRun = (runs: ProcedureRichTextRun[], nextRun: ProcedureRichTextRun) => {
    if (!nextRun.text) return;
    const lastRun = runs[runs.length - 1];
    if (
      lastRun &&
      (lastRun.bold ?? false) === (nextRun.bold ?? false) &&
      (lastRun.italic ?? false) === (nextRun.italic ?? false) &&
      (lastRun.underline ?? false) === (nextRun.underline ?? false) &&
      (lastRun.color ?? null) === (nextRun.color ?? null) &&
      (lastRun.fontFamily ?? null) === (nextRun.fontFamily ?? null) &&
      (lastRun.fontSize ?? null) === (nextRun.fontSize ?? null) &&
      (lastRun.href ?? null) === (nextRun.href ?? null) &&
      (lastRun.linkType ?? null) === (nextRun.linkType ?? null) &&
      (lastRun.nodeId ?? null) === (nextRun.nodeId ?? null) &&
      (lastRun.tableNodeId ?? null) === (nextRun.tableNodeId ?? null) &&
      (lastRun.recordId ?? null) === (nextRun.recordId ?? null) &&
      (lastRun.title ?? null) === (nextRun.title ?? null)
    ) {
      lastRun.text += nextRun.text;
      return;
    }
    runs.push(nextRun);
  };

  const collectRuns = (nodes: ArrayLike<ChildNode>, context: RunContext = {}): ProcedureRichTextRun[] => {
    const runs: ProcedureRichTextRun[] = [];
    for (const node of Array.from(nodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        pushRun(runs, {
          text: node.textContent ?? "",
          bold: context.bold,
          italic: context.italic,
          underline: context.underline,
          color: context.color ?? null,
          fontFamily: context.fontFamily ?? null,
          fontSize: context.fontSize ?? null,
          href: context.href ?? null,
          linkType: context.linkType ?? null,
          nodeId: context.nodeId ?? null,
          tableNodeId: context.tableNodeId ?? null,
          recordId: context.recordId ?? null,
          title: context.title ?? null
        });
        continue;
      }
      if (!(node instanceof HTMLElement)) continue;
      const tagName = node.tagName.toLowerCase();
      if (tagName === "br") {
        pushRun(runs, {
          text: "\n",
          color: context.color ?? null,
          fontFamily: context.fontFamily ?? null,
          fontSize: context.fontSize ?? null,
          href: context.href ?? null,
          linkType: context.linkType ?? null,
          nodeId: context.nodeId ?? null,
          tableNodeId: context.tableNodeId ?? null,
          recordId: context.recordId ?? null,
          title: context.title ?? null
        });
        continue;
      }
      if (tagName === "img") continue;
      const href =
        tagName === "a"
          ? sanitizeProcedureRichTextUrl(node.getAttribute("href") ?? "") ?? context.href ?? null
          : context.href ?? null;
      const explicitBold = readSanitizedFontWeightFromElement(node);
      const explicitItalic = readSanitizedFontStyleFromElement(node);
      const nextContext = {
        bold:
          explicitBold === "700"
            ? true
            : explicitBold === "400"
              ? false
              : context.bold || tagName === "strong" || tagName === "b",
        italic:
          explicitItalic === "italic"
            ? true
            : explicitItalic === "normal"
              ? false
              : context.italic || tagName === "em" || tagName === "i",
        underline: context.underline || tagName === "a",
        color: readSanitizedColorFromElement(node) ?? context.color ?? null,
        fontFamily: readSanitizedFontFamilyFromElement(node) ?? context.fontFamily ?? null,
        fontSize: readSanitizedFontSizeFromElement(node) ?? context.fontSize ?? null,
        href,
        linkType:
          tagName === "a" ? (node.getAttribute("data-ode-link-type") ?? "").trim() || null : context.linkType ?? null,
        nodeId: tagName === "a" ? (node.getAttribute("data-node-id") ?? "").trim() || null : context.nodeId ?? null,
        tableNodeId:
          tagName === "a" ? (node.getAttribute("data-table-node-id") ?? "").trim() || null : context.tableNodeId ?? null,
        recordId:
          tagName === "a" ? (node.getAttribute("data-record-id") ?? "").trim() || null : context.recordId ?? null,
        title: tagName === "a" ? (node.getAttribute("title") ?? "").trim() || null : context.title ?? null
      };
      collectRuns(node.childNodes, nextContext).forEach((run) => pushRun(runs, run));
    }
    return runs;
  };

  const buildParagraphFromNodes = (
    nodes: ArrayLike<ChildNode>,
    styleElement?: HTMLElement | null
  ): ProcedureRichTextParagraph => ({
    runs: collectRuns(nodes),
    textAlign:
      normalizeRichTextTextAlign(styleElement?.style.textAlign ?? "") ??
      normalizeRichTextTextAlign(styleElement ? readInlineStyleValue(styleElement, "text-align") : "") ??
      undefined,
    lineHeight: styleElement ? readSanitizedLineHeightFromElement(styleElement) ?? undefined : undefined,
    marginLeft: styleElement ? readSanitizedMarginLeftFromElement(styleElement) ?? undefined : undefined
  });

  const buildParagraph = (element: HTMLElement): ProcedureRichTextParagraph => ({
    ...buildParagraphFromNodes(element.childNodes, element)
  });

  const hasVisibleParagraphContent = (paragraph: ProcedureRichTextParagraph): boolean =>
    paragraph.runs.some((run) => run.text.replace(/\n/g, "").trim().length > 0);

  const findStandaloneImageElement = (element: HTMLElement): HTMLImageElement | null => {
    if (element instanceof HTMLImageElement) return element;

    const meaningfulChildren = Array.from(element.childNodes).filter((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        return (child.textContent ?? "").trim().length > 0;
      }
      if (!(child instanceof HTMLElement)) return false;
      return child.tagName.toLowerCase() !== "br";
    });

    if (meaningfulChildren.length !== 1) return null;
    const onlyChild = meaningfulChildren[0];
    if (onlyChild instanceof HTMLImageElement) return onlyChild;
    if (!(onlyChild instanceof HTMLElement) || onlyChild.tagName.toLowerCase() !== "a") return null;

    const anchorChildren = Array.from(onlyChild.childNodes).filter((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        return (child.textContent ?? "").trim().length > 0;
      }
      if (!(child instanceof HTMLElement)) return false;
      return child.tagName.toLowerCase() !== "br";
    });

    return anchorChildren.length === 1 && anchorChildren[0] instanceof HTMLImageElement ? anchorChildren[0] : null;
  };

  const buildImageBlock = (element: HTMLElement): Extract<ProcedureRichTextBlock, { type: "image" }> | null => {
    const imageElement = findStandaloneImageElement(element);
    if (!imageElement) return null;
    const src = sanitizeProcedureRichTextUrl(imageElement.getAttribute("src") ?? "", true);
    if (!src) return null;
    return {
      type: "image",
      src,
      alt: (imageElement.getAttribute("alt") ?? "").trim() || (imageElement.getAttribute("data-image-alt") ?? "").trim() || "Image"
    };
  };

  const readOrderedListStart = (element: HTMLElement): number => {
    const value = Number.parseInt(element.getAttribute("start") ?? "", 10);
    return Number.isFinite(value) && value > 0 ? Math.round(value) : 1;
  };

  const collectListItems = (listElement: HTMLElement, level: number): ProcedureRichTextListItem[] => {
    const ordered = listElement.tagName.toLowerCase() === "ol";
    const items: ProcedureRichTextListItem[] = [];
    let orderedIndex = readOrderedListStart(listElement);
    for (const child of Array.from(listElement.children)) {
      if (!(child instanceof HTMLElement) || child.tagName.toLowerCase() !== "li") continue;
      const contentNodes = Array.from(child.childNodes).filter((node) => {
        return !(node instanceof HTMLElement && (node.tagName.toLowerCase() === "ul" || node.tagName.toLowerCase() === "ol"));
      });
      const paragraph = buildParagraphFromNodes(contentNodes, child);
      if (hasVisibleParagraphContent(paragraph)) {
        items.push({
          ...paragraph,
          level,
          ordered,
          start: ordered ? orderedIndex : undefined
        });
      }
      if (ordered) {
        orderedIndex += 1;
      }
      Array.from(child.children)
        .filter(
          (nestedChild): nestedChild is HTMLElement =>
            nestedChild instanceof HTMLElement &&
            (nestedChild.tagName.toLowerCase() === "ul" || nestedChild.tagName.toLowerCase() === "ol")
        )
        .forEach((nestedChild) => {
          items.push(...collectListItems(nestedChild, level + 1));
        });
    }
    return items;
  };

  const buildCellParagraphs = (cell: HTMLElement): ProcedureRichTextParagraph[] => {
    const directParagraphChildren = Array.from(cell.children).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement &&
        ["p", "div", "blockquote", "pre", "h1", "h2", "h3", "h4", "h5", "h6"].includes(child.tagName.toLowerCase())
    );
    if (directParagraphChildren.length > 0) {
      return directParagraphChildren
        .map((child) => buildParagraph(child))
        .filter((paragraph) => hasVisibleParagraphContent(paragraph));
    }
    const fallbackParagraph = buildParagraphFromNodes(cell.childNodes, cell);
    return hasVisibleParagraphContent(fallbackParagraph) ? [fallbackParagraph] : [];
  };

  const buildTableRows = (tableElement: HTMLElement): ProcedureRichTextTableRow[] => {
    const rowParents = Array.from(tableElement.children).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && ["thead", "tbody", "tfoot"].includes(child.tagName.toLowerCase())
    );
    const rowElements =
      rowParents.length > 0
        ? rowParents.flatMap((section) =>
            Array.from(section.children).filter(
              (child): child is HTMLElement => child instanceof HTMLElement && child.tagName.toLowerCase() === "tr"
            )
          )
        : Array.from(tableElement.children).filter(
            (child): child is HTMLElement => child instanceof HTMLElement && child.tagName.toLowerCase() === "tr"
          );
    const rows: ProcedureRichTextTableRow[] = [];
    rowElements.forEach((row) => {
      const cells: ProcedureRichTextTableCell[] = Array.from(row.children)
        .filter(
          (child): child is HTMLElement =>
            child instanceof HTMLElement && (child.tagName.toLowerCase() === "th" || child.tagName.toLowerCase() === "td")
        )
        .map((cell) => {
          const colSpan = Number.parseInt(cell.getAttribute("colspan") ?? "", 10);
          const rowSpan = Number.parseInt(cell.getAttribute("rowspan") ?? "", 10);
          const width =
            normalizeRichTextWidth(cell.style.width) ?? normalizeRichTextWidth(readInlineStyleValue(cell, "width")) ?? undefined;
          return {
            header: cell.tagName.toLowerCase() === "th" ? true : undefined,
            colSpan: Number.isFinite(colSpan) && colSpan > 1 ? Math.round(colSpan) : undefined,
            rowSpan: Number.isFinite(rowSpan) && rowSpan > 1 ? Math.round(rowSpan) : undefined,
            width,
            paragraphs: buildCellParagraphs(cell)
          };
        });
      if (cells.length > 0) {
        rows.push({ cells });
      }
    });
    return rows;
  };

  const blocks: ProcedureRichTextBlock[] = [];
  const appendBlocksFromNodes = (nodes: ChildNode[]) => {
    for (const node of nodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim() ?? "";
        if (text) {
          blocks.push({ type: "paragraph", runs: [{ text }] });
        }
        continue;
      }
      if (!(node instanceof HTMLElement)) continue;
      const standaloneImage = buildImageBlock(node);
      if (standaloneImage) {
        blocks.push(standaloneImage);
        continue;
      }
      const tagName = node.tagName.toLowerCase();
      if (tagName === "h1" || tagName === "h2" || tagName === "h3" || tagName === "h4" || tagName === "h5" || tagName === "h6") {
        blocks.push({
          type: "heading",
          level:
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
                      : 6,
          runs: collectRuns(node.childNodes),
          textAlign:
            normalizeRichTextTextAlign(node.style.textAlign) ??
            normalizeRichTextTextAlign(readInlineStyleValue(node, "text-align")) ??
            undefined,
          lineHeight: readSanitizedLineHeightFromElement(node) ?? undefined,
          marginLeft: readSanitizedMarginLeftFromElement(node) ?? undefined
        });
        continue;
      }
      if (tagName === "p") {
        blocks.push({ type: "paragraph", ...buildParagraph(node) });
        continue;
      }
      if (tagName === "ul" || tagName === "ol") {
        const items = collectListItems(node, 0);
        if (items.length > 0) {
          blocks.push({ type: "list", items });
        }
        continue;
      }
      if (tagName === "blockquote") {
        const paragraphs = Array.from(node.children)
          .filter((child): child is HTMLElement => child instanceof HTMLElement)
          .flatMap((child) => {
            const childTag = child.tagName.toLowerCase();
            if (childTag === "p" || childTag === "div") {
              return [buildParagraph(child)];
            }
            const runs = collectRuns([child]);
            return runs.length > 0 ? [{ runs }] : [];
          });
        if (paragraphs.length > 0) {
          blocks.push({ type: "quote", paragraphs });
        }
        continue;
      }
      if (tagName === "pre") {
        blocks.push({ type: "code", code: node.textContent?.replace(/\r\n/g, "\n") ?? "" });
        continue;
      }
      if (tagName === "hr") {
        blocks.push(
          (node.getAttribute("data-ode-page-break") ?? "").trim().toLowerCase() === "true"
            ? { type: "page_break" }
            : { type: "divider" }
        );
        continue;
      }
      if (tagName === "table") {
        const rows = buildTableRows(node);
        if (rows.length > 0) {
          blocks.push({ type: "table", rows });
        }
        continue;
      }
      appendBlocksFromNodes(Array.from(node.childNodes));
    }
  };

  appendBlocksFromNodes(Array.from(parsed.body.childNodes));
  return blocks;
}

export function readProcedureRichTextBlocksFromNode(node: AppNode | null | undefined): ProcedureRichTextBlock[] {
  return readProcedureRichTextBlocks(readProcedureRichTextHtml(node));
}

export function resolveProcedureRichTextColorRgb(value: string | null | undefined): [number, number, number] | null {
  const normalized = normalizeRichTextColor(value);
  if (!normalized || typeof document === "undefined") return null;
  const probe = document.createElement("span");
  probe.style.color = normalized;
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(computed);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
