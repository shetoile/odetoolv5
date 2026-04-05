import type { Paragraph, ParagraphChild, Table } from "docx";
import type { jsPDF } from "jspdf";
import type { ProcedureSectionData } from "@/lib/procedureDocument";
import {
  buildProcedureStatusSummary,
  getProcedureConnectionLabel,
  getProcedureInsightDomainLabel,
  inlineTokensToPlainText,
  parseProcedureBlocks,
  parseProcedureInlineTokens,
  readProcedureConnections
} from "@/lib/procedureDocument";
import {
  readProcedureRichTextBlocks,
  resolveProcedureRichTextColorRgb,
  type ProcedureRichTextBlock,
  type ProcedureRichTextListItem,
  type ProcedureRichTextParagraph,
  type ProcedureRichTextRun
} from "@/lib/procedureRichText";
import { ROOT_PARENT_ID } from "@/lib/types";

const PAGE_MARGIN_X = 42;
const PAGE_MARGIN_TOP = 42;
const PAGE_MARGIN_BOTTOM = 42;

type JsPdfDocument = InstanceType<typeof jsPDF>;
type DocxModule = typeof import("docx");
type PdfTextStyle = "normal" | "bold" | "italic" | "bolditalic";
type PdfRenderableRun = {
  text: string;
  color: [number, number, number];
  fontStyle: PdfTextStyle;
};

const PDF_DEFAULT_TEXT_COLOR: [number, number, number] = [17, 24, 39];
const PDF_PAGE_BREAK_SENTINEL = "__ODE_PDF_PAGE_BREAK__";

export interface ProcedureExportInput {
  rootSection: ProcedureSectionData;
  coverImageDataUrl?: string | null;
  locale: string;
  labels?: Partial<ProcedureExportLabels>;
}

export interface ProcedureExportLabels {
  generatedPrefix: string;
  reportWorkspace: string;
  reportNode: string;
  statusOverview: string;
  sections: string;
  documented: string;
  references: string;
  connections: string;
  linkedNodes: string;
  externalLinks: string;
  scheduled: string;
  planned: string;
  active: string;
  blocked: string;
  done: string;
}

const DEFAULT_PROCEDURE_EXPORT_LABELS: ProcedureExportLabels = {
  generatedPrefix: "Generated",
  reportWorkspace: "Workspace report",
  reportNode: "Node report",
  statusOverview: "Status overview",
  sections: "Sections",
  documented: "With text",
  references: "Files",
  connections: "Connections",
  linkedNodes: "Linked nodes",
  externalLinks: "External links",
  scheduled: "Scheduled",
  planned: "Planned",
  active: "Active",
  blocked: "Blocked",
  done: "Done"
};

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; extension: "png" | "jpg" | "gif" | "bmp" } | null {
  const match = /^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  const base64 = match[2];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  if (mimeType === "jpeg" || mimeType === "jpg") {
    return { bytes, extension: "jpg" };
  }
  if (mimeType === "gif") {
    return { bytes, extension: "gif" };
  }
  if (mimeType === "bmp") {
    return { bytes, extension: "bmp" };
  }
  if (mimeType === "svg+xml" || mimeType === "svg") return null;
  return { bytes, extension: "png" };
}

function getPdfImageFormat(dataUrl: string): "PNG" | "JPEG" | "WEBP" {
  if (dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")) return "JPEG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "PNG";
}

function getPdfImageSize(doc: JsPdfDocument, dataUrl: string, maxWidth: number): { width: number; height: number } | null {
  try {
    const properties = doc.getImageProperties(dataUrl);
    const sourceWidth = Number(properties.width) || maxWidth;
    const sourceHeight = Number(properties.height) || Math.round(maxWidth * 0.56);
    const width = Math.min(maxWidth, sourceWidth);
    const height = Math.max(96, sourceHeight * (width / sourceWidth));
    return { width, height };
  } catch {
    return null;
  }
}

function resolveProcedureExportLabels(labels?: Partial<ProcedureExportLabels>): ProcedureExportLabels {
  return {
    ...DEFAULT_PROCEDURE_EXPORT_LABELS,
    ...(labels ?? {})
  };
}

function isWorkspaceProcedureReport(section: ProcedureSectionData): boolean {
  return !section.node.parentId || section.node.parentId === ROOT_PARENT_ID;
}

function buildProcedureStatusOverviewLines(section: ProcedureSectionData, labels: ProcedureExportLabels): string[] {
  const summary = buildProcedureStatusSummary(section);
  return [
    labels.statusOverview,
    `${labels.sections}: ${summary.sectionCount}`,
    `${labels.documented}: ${summary.documentedSectionCount}`,
    `${labels.references}: ${summary.referenceCount}`,
    `${labels.connections}: ${summary.connectionCount}`,
    `${labels.linkedNodes}: ${summary.linkedNodeCount}`,
    `${labels.externalLinks}: ${summary.externalLinkCount}`,
    `${labels.scheduled}: ${summary.scheduledCount}`,
    `${labels.planned}: ${summary.scheduleCounts.planned}  ${labels.active}: ${summary.scheduleCounts.active}  ${labels.blocked}: ${summary.scheduleCounts.blocked}  ${labels.done}: ${summary.scheduleCounts.done}`
  ];
}

function ensurePdfSpace(
  doc: JsPdfDocument,
  bounds: { pageWidth: number; pageHeight: number },
  cursor: { y: number },
  requiredHeight: number
) {
  if (cursor.y + requiredHeight <= bounds.pageHeight - PAGE_MARGIN_BOTTOM) return;
  doc.addPage();
  cursor.y = PAGE_MARGIN_TOP;
}

function decoratePdfDocument(
  doc: JsPdfDocument,
  bounds: { pageWidth: number; pageHeight: number },
  documentTitle: string
) {
  const pageCount = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(documentTitle, PAGE_MARGIN_X, 24, {
      maxWidth: bounds.pageWidth - PAGE_MARGIN_X * 2
    });
    doc.setDrawColor(226, 232, 240);
    doc.line(PAGE_MARGIN_X, 30, bounds.pageWidth - PAGE_MARGIN_X, 30);
    doc.line(PAGE_MARGIN_X, bounds.pageHeight - 28, bounds.pageWidth - PAGE_MARGIN_X, bounds.pageHeight - 28);
    doc.text(`Page ${pageNumber} / ${pageCount}`, bounds.pageWidth - PAGE_MARGIN_X, bounds.pageHeight - 14, {
      align: "right"
    });
  }
}

function resolvePdfRunFontStyle(
  run: ProcedureRichTextRun,
  options?: { defaultBold?: boolean; defaultItalic?: boolean }
): PdfTextStyle {
  const isBold = Boolean(options?.defaultBold || run.bold);
  const isItalic = Boolean(options?.defaultItalic || run.italic);
  if (isBold && isItalic) return "bolditalic";
  if (isBold) return "bold";
  if (isItalic) return "italic";
  return "normal";
}

function resolvePdfTextColor(value: string | null | undefined): [number, number, number] {
  return resolveProcedureRichTextColorRgb(value) ?? PDF_DEFAULT_TEXT_COLOR;
}

function normalizeRichTextFontFamilyName(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const [firstFamily = ""] = trimmed.split(",");
  const normalized = firstFamily.trim().replace(/^['"]+|['"]+$/g, "");
  return normalized || null;
}

function parseRichTextCssSizeToPt(value: string | null | undefined, basePt = 12): number | null {
  const trimmed = value?.trim().toLowerCase() ?? "";
  if (!trimmed) return null;
  const match = /^(-?\d+(?:\.\d+)?)(px|pt|rem|em|%)?$/.exec(trimmed);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = match[2] ?? "pt";
  if (unit === "pt") return amount;
  if (unit === "px") return amount * (72 / 96);
  if (unit === "rem" || unit === "em") return amount * basePt;
  if (unit === "%") return (amount / 100) * basePt;
  return null;
}

function parseRichTextLineHeightMultiplier(value: string | null | undefined, basePt: number): number | null {
  const trimmed = value?.trim().toLowerCase() ?? "";
  if (!trimmed || trimmed === "normal") return null;
  const match = /^(\d+(?:\.\d+)?)(px|pt|rem|em|%)?$/.exec(trimmed);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = match[2] ?? "";
  if (!unit) return amount;
  if (unit === "%") return amount / 100;
  const absolutePt = parseRichTextCssSizeToPt(`${amount}${unit}`, basePt);
  if (!absolutePt || basePt <= 0) return null;
  return absolutePt / basePt;
}

function resolvePdfFontFamily(value: string | null | undefined): "helvetica" | "courier" | "times" {
  const normalized = normalizeRichTextFontFamilyName(value)?.toLowerCase() ?? "";
  if (!normalized) return "helvetica";
  if (
    normalized.includes("consolas") ||
    normalized.includes("courier") ||
    normalized.includes("mono")
  ) {
    return "courier";
  }
  if (
    normalized.includes("cambria") ||
    normalized.includes("georgia") ||
    normalized.includes("times") ||
    normalized.includes("serif")
  ) {
    return "times";
  }
  return "helvetica";
}

function resolvePdfParagraphFontSize(paragraph: ProcedureRichTextParagraph, fallback = 10.5): number {
  const resolved = paragraph.runs
    .map((run) => parseRichTextCssSizeToPt(run.fontSize))
    .find((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!resolved) return fallback;
  return Math.max(8, Math.min(24, resolved));
}

function resolvePdfParagraphIndent(paragraph: ProcedureRichTextParagraph): number {
  const resolved = parseRichTextCssSizeToPt(paragraph.marginLeft, 12);
  if (!resolved) return 0;
  return Math.max(0, Math.min(180, Math.round(resolved)));
}

function resolvePdfParagraphLineHeight(paragraph: ProcedureRichTextParagraph, fontSize: number): number {
  const multiplier = parseRichTextLineHeightMultiplier(paragraph.lineHeight, fontSize) ?? 1.45;
  return Math.max(12, Math.round(fontSize * Math.max(1, multiplier) + 2));
}

function resolvePdfParagraphAlignment(value: ProcedureRichTextParagraph["textAlign"]): "left" | "center" | "right" | "justify" {
  return value === "center" || value === "right" || value === "justify" ? value : "left";
}

function richParagraphToPlainText(paragraph: ProcedureRichTextParagraph): string {
  return paragraph.runs.map((run) => run.text).join("").replace(/\n{3,}/g, "\n\n").trim();
}

type PdfMeasuredLineSegment = PdfRenderableRun & {
  width: number;
  isWhitespace: boolean;
};

function splitPdfTextSegments(text: string): string[] {
  return text.split(/(\n|\s+)/).filter((segment) => segment.length > 0);
}

function renderPdfWrappedRuns(
  doc: JsPdfDocument,
  bounds: { pageWidth: number; pageHeight: number },
  cursor: { y: number },
  runs: PdfRenderableRun[],
  options?: {
    fontSize?: number;
    indent?: number;
    firstLineIndent?: number;
    spacingBefore?: number;
    spacingAfter?: number;
    fontFamily?: "helvetica" | "courier" | "times";
    alignment?: "left" | "center" | "right" | "justify";
    lineHeight?: number;
  }
) {
  const fontSize = options?.fontSize ?? 10;
  const indent = options?.indent ?? 0;
  const firstLineIndent = options?.firstLineIndent ?? 0;
  const spacingBefore = options?.spacingBefore ?? 0;
  const spacingAfter = options?.spacingAfter ?? 6;
  const fontFamily = options?.fontFamily ?? "helvetica";
  const alignment = options?.alignment ?? "left";
  const startX = PAGE_MARGIN_X + indent;
  const maxWidth = Math.max(48, bounds.pageWidth - PAGE_MARGIN_X - startX);
  const lineHeight = options?.lineHeight ?? Math.max(14, Math.round(fontSize * 1.45));
  cursor.y += spacingBefore;
  ensurePdfSpace(doc, bounds, cursor, lineHeight);
  const lines: PdfMeasuredLineSegment[][] = [[]];
  let lineWidth = 0;
  let lineHasText = false;
  const resolveCurrentLineMaxWidth = () =>
    Math.max(24, maxWidth - (lines.length === 1 ? Math.max(0, firstLineIndent) : 0));

  const measureSegment = (segment: string, run: PdfRenderableRun) => {
    doc.setFont(fontFamily, run.fontStyle);
    doc.setFontSize(fontSize);
    return doc.getTextWidth(segment);
  };

  const startNewLine = () => {
    if (lines[lines.length - 1].length === 0) return;
    lines.push([]);
    lineWidth = 0;
    lineHasText = false;
  };

  const appendSegmentToCurrentLine = (segment: string, run: PdfRenderableRun) => {
    if (!segment) return;
    const isWhitespace = /^\s+$/.test(segment);
    const width = measureSegment(segment, run);
    lines[lines.length - 1].push({
      ...run,
      text: segment,
      width,
      isWhitespace
    });
    lineWidth += width;
    if (!isWhitespace) {
      lineHasText = true;
    }
  };

  for (const run of runs) {
    for (const segment of splitPdfTextSegments(run.text)) {
      if (segment === "\n") {
        startNewLine();
        continue;
      }
      const isWhitespace = /^\s+$/.test(segment);
      if (isWhitespace && !lineHasText) {
        continue;
      }
      const width = measureSegment(segment, run);
      let currentLineMaxWidth = resolveCurrentLineMaxWidth();
      if (!isWhitespace && lineHasText && lineWidth + width > currentLineMaxWidth) {
        startNewLine();
        currentLineMaxWidth = resolveCurrentLineMaxWidth();
      }
      if (isWhitespace && lineWidth + width > currentLineMaxWidth) {
        startNewLine();
        continue;
      }
      if (!isWhitespace && width > currentLineMaxWidth) {
        const wrapped = doc.splitTextToSize(segment, currentLineMaxWidth) as string[];
        wrapped.forEach((piece, pieceIndex) => {
          if (pieceIndex > 0) {
            startNewLine();
          }
          appendSegmentToCurrentLine(piece, run);
        });
        continue;
      }
      appendSegmentToCurrentLine(segment, run);
    }
  }

  const effectiveLines = lines.filter(
    (line, lineIndex) =>
      line.length > 0 || (lineIndex === 0 && runs.some((run) => run.text.trim().length > 0))
  );
  effectiveLines.forEach((line, lineIndex) => {
    ensurePdfSpace(doc, bounds, cursor, lineHeight);
    const totalWidth = line.reduce((sum, segment) => sum + segment.width, 0);
    const whitespaceSegments = line.filter((segment) => segment.isWhitespace);
    const lineIndent = lineIndex === 0 ? Math.max(0, firstLineIndent) : 0;
    const lineStartX = startX + lineIndent;
    const lineMaxWidth = Math.max(24, maxWidth - lineIndent);
    const extraJustifySpace =
      alignment === "justify" && lineIndex < effectiveLines.length - 1 && whitespaceSegments.length > 0
        ? Math.max(0, (lineMaxWidth - totalWidth) / whitespaceSegments.length)
        : 0;
    let x =
      alignment === "center"
        ? lineStartX + Math.max(0, (lineMaxWidth - totalWidth) / 2)
        : alignment === "right"
          ? lineStartX + Math.max(0, lineMaxWidth - totalWidth)
          : lineStartX;
    line.forEach((segment) => {
      doc.setFont(fontFamily, segment.fontStyle);
      doc.setFontSize(fontSize);
      doc.setTextColor(segment.color[0], segment.color[1], segment.color[2]);
      doc.text(segment.text, x, cursor.y);
      x += segment.width + (segment.isWhitespace ? extraJustifySpace : 0);
    });
    cursor.y += lineHeight;
  });
  cursor.y += spacingAfter;
}

function buildPdfRunsFromRichParagraph(
  paragraph: ProcedureRichTextParagraph,
  options?: { defaultBold?: boolean; defaultItalic?: boolean; prefix?: string }
): PdfRenderableRun[] {
  const runs: PdfRenderableRun[] = [];
  if (options?.prefix) {
    runs.push({
      text: options.prefix,
      color: PDF_DEFAULT_TEXT_COLOR,
      fontStyle: "normal"
    });
  }
  for (const run of paragraph.runs) {
    if (!run.text) continue;
    runs.push({
      text: run.text,
      color: resolvePdfTextColor(run.color),
      fontStyle: resolvePdfRunFontStyle(run, options)
    });
  }
  return runs;
}

function countRichTextTableColumns(block: Extract<ProcedureRichTextBlock, { type: "table" }>): number {
  return Math.max(
    1,
    ...block.rows.map((row) =>
      row.cells.reduce((total, cell) => total + Math.max(1, cell.colSpan ?? 1), 0)
    )
  );
}

function renderPdfRichTable(
  doc: JsPdfDocument,
  bounds: { pageWidth: number; pageHeight: number },
  cursor: { y: number },
  block: Extract<ProcedureRichTextBlock, { type: "table" }>
) {
  const columnCount = countRichTextTableColumns(block);
  const tableWidth = bounds.pageWidth - PAGE_MARGIN_X * 2;
  const columnWidth = tableWidth / columnCount;
  const defaultFontSize = 10;

  block.rows.forEach((row) => {
    const layouts: Array<{
      x: number;
      width: number;
      lines: string[];
      header: boolean;
    }> = [];
    let x = PAGE_MARGIN_X;
    let rowHeight = 24;
    row.cells.forEach((cell) => {
      const span = Math.max(1, cell.colSpan ?? 1);
      const width = columnWidth * span;
      const paragraphs = cell.paragraphs.length > 0 ? cell.paragraphs : [{ runs: [] } satisfies ProcedureRichTextParagraph];
      const lines = paragraphs.flatMap((paragraph, index) => {
        const text = richParagraphToPlainText(paragraph);
        const wrapped = text
          ? (doc.splitTextToSize(text, Math.max(24, width - 14)) as string[])
          : [""];
        return index > 0 ? ["", ...wrapped] : wrapped;
      });
      rowHeight = Math.max(rowHeight, 12 + lines.length * 12);
      layouts.push({
        x,
        width,
        lines,
        header: Boolean(cell.header)
      });
      x += width;
    });

    ensurePdfSpace(doc, bounds, cursor, rowHeight + 2);
    layouts.forEach((layout) => {
      if (layout.header) {
        doc.setFillColor(226, 232, 240);
        doc.rect(layout.x, cursor.y, layout.width, rowHeight, "F");
      }
      doc.setDrawColor(203, 213, 225);
      doc.rect(layout.x, cursor.y, layout.width, rowHeight);
      doc.setFont("helvetica", layout.header ? "bold" : "normal");
      doc.setFontSize(defaultFontSize);
      doc.setTextColor(PDF_DEFAULT_TEXT_COLOR[0], PDF_DEFAULT_TEXT_COLOR[1], PDF_DEFAULT_TEXT_COLOR[2]);
      doc.text(layout.lines, layout.x + 7, cursor.y + 14);
    });
    cursor.y += rowHeight;
  });

  cursor.y += 8;
}

function appendPdfRichSectionBody(
  doc: JsPdfDocument,
  section: ProcedureSectionData,
  bounds: { pageWidth: number; pageHeight: number },
  cursor: { y: number },
  labels: ProcedureExportLabels
) {
  const richBlocks = readProcedureRichTextBlocks(section.bodyHtml);
  for (const block of richBlocks) {
    if (block.type === "heading") {
      renderPdfWrappedRuns(
        doc,
        bounds,
        cursor,
        block.runs.map((run) => ({
          text: run.text,
          color: resolvePdfTextColor(run.color),
          fontStyle: resolvePdfRunFontStyle(run, { defaultBold: true })
        })),
        {
          fontSize: Math.max(
            block.level === 1
              ? 18
              : block.level === 2
                ? 16
                : block.level === 3
                  ? 14
                  : block.level === 4
                    ? 12
                    : block.level === 5
                      ? 11
                      : 10,
            resolvePdfParagraphFontSize(block, 10.5)
          ),
          spacingBefore: 2,
          spacingAfter: 6,
          firstLineIndent: resolvePdfParagraphIndent(block),
          alignment: resolvePdfParagraphAlignment(block.textAlign),
          lineHeight: resolvePdfParagraphLineHeight(block, resolvePdfParagraphFontSize(block, 10.5)),
          fontFamily: resolvePdfFontFamily(block.runs[0]?.fontFamily)
        }
      );
      continue;
    }
    if (block.type === "paragraph") {
      renderPdfWrappedRuns(doc, bounds, cursor, buildPdfRunsFromRichParagraph(block), {
        fontSize: resolvePdfParagraphFontSize(block, 10.5),
        spacingAfter: 6,
        firstLineIndent: resolvePdfParagraphIndent(block),
        alignment: resolvePdfParagraphAlignment(block.textAlign),
        lineHeight: resolvePdfParagraphLineHeight(block, resolvePdfParagraphFontSize(block, 10.5)),
        fontFamily: resolvePdfFontFamily(block.runs[0]?.fontFamily)
      });
      continue;
    }
    if (block.type === "list") {
      block.items.forEach((item) => {
        const fontSize = resolvePdfParagraphFontSize(item, 10.5);
        renderPdfWrappedRuns(
          doc,
          bounds,
          cursor,
          buildPdfRunsFromRichParagraph(item, {
            prefix: item.ordered ? `${item.start ?? 1}. ` : "\u2022 "
          }),
          {
            fontSize,
            indent: 16 + item.level * 18,
            firstLineIndent: resolvePdfParagraphIndent(item),
            spacingAfter: 4,
            alignment: resolvePdfParagraphAlignment(item.textAlign),
            lineHeight: resolvePdfParagraphLineHeight(item, fontSize),
            fontFamily: resolvePdfFontFamily(item.runs[0]?.fontFamily)
          }
        );
      });
      cursor.y += 2;
      continue;
    }
    if (block.type === "quote") {
      block.paragraphs.forEach((paragraph) => {
        const fontSize = resolvePdfParagraphFontSize(paragraph, 10.5);
        renderPdfWrappedRuns(
          doc,
          bounds,
          cursor,
          buildPdfRunsFromRichParagraph(paragraph, { defaultItalic: true }),
          {
            fontSize,
            indent: 18,
            firstLineIndent: resolvePdfParagraphIndent(paragraph),
            spacingAfter: 4,
            alignment: resolvePdfParagraphAlignment(paragraph.textAlign),
            lineHeight: resolvePdfParagraphLineHeight(paragraph, fontSize),
            fontFamily: resolvePdfFontFamily(paragraph.runs[0]?.fontFamily)
          }
        );
      });
      cursor.y += 2;
      continue;
    }
    if (block.type === "code") {
      renderPdfWrappedRuns(
        doc,
        bounds,
        cursor,
        [
          {
            text: block.code,
            color: PDF_DEFAULT_TEXT_COLOR,
            fontStyle: "normal"
          }
        ],
        {
          fontSize: 9,
          indent: 12,
          spacingAfter: 8,
          fontFamily: "courier"
        }
      );
      continue;
    }
    if (block.type === "divider") {
      ensurePdfSpace(doc, bounds, cursor, 12);
      doc.setDrawColor(203, 213, 225);
      doc.line(PAGE_MARGIN_X, cursor.y + 3, bounds.pageWidth - PAGE_MARGIN_X, cursor.y + 3);
      cursor.y += 12;
      continue;
    }
    if (block.type === "page_break") {
      doc.addPage();
      cursor.y = PAGE_MARGIN_TOP;
      continue;
    }
    if (block.type === "table") {
      renderPdfRichTable(doc, bounds, cursor, block);
      continue;
    }
    if (block.type === "image") {
      if (!decodeDataUrl(block.src)) continue;
      const maxImageWidth = bounds.pageWidth - PAGE_MARGIN_X * 2;
      const size = getPdfImageSize(doc, block.src, maxImageWidth);
      if (!size) continue;
      ensurePdfSpace(doc, bounds, cursor, size.height + 8);
      doc.addImage(block.src, getPdfImageFormat(block.src), PAGE_MARGIN_X, cursor.y, size.width, size.height);
      cursor.y += size.height + 8;
    }
  }

  if (section.references.length > 0) {
    renderPdfWrappedRuns(
      doc,
      bounds,
      cursor,
      [
        {
          text: `${labels.references}: ${section.references.map((reference) => reference.name).join(", ")}`,
          color: PDF_DEFAULT_TEXT_COLOR,
          fontStyle: "normal"
        }
      ],
      { fontSize: 10, spacingAfter: 6 }
    );
  }

  const connections = readProcedureConnections(section.node);
  if (connections.length > 0) {
    renderPdfWrappedRuns(
      doc,
      bounds,
      cursor,
      [
        {
          text: `${labels.connections}:`,
          color: PDF_DEFAULT_TEXT_COLOR,
          fontStyle: "bold"
        }
      ],
      { fontSize: 10, spacingAfter: 2 }
    );
    connections.forEach((connection) => {
      renderPdfWrappedRuns(
        doc,
        bounds,
        cursor,
        [
          {
            text: `- ${getProcedureConnectionLabel(connection.type)}: ${connection.nodeName ?? connection.nodeId}`,
            color: PDF_DEFAULT_TEXT_COLOR,
            fontStyle: "normal"
          }
        ],
        { fontSize: 10, indent: 12, spacingAfter: 2 }
      );
    });
    cursor.y += 4;
  }
}

function buildPdfBlockLines(section: ProcedureSectionData, labels: ProcedureExportLabels): string[] {
  const lines: string[] = [];
  const blocks = parseProcedureBlocks(section.body);
  const connections = readProcedureConnections(section.node);
  for (const block of blocks) {
    if (block.type === "heading") {
      lines.push(block.text);
      lines.push("");
      continue;
    }
    if (block.type === "paragraph") {
      for (const line of block.lines) {
        lines.push(inlineTokensToPlainText(line));
      }
      lines.push("");
      continue;
    }
    if (block.type === "bullets") {
      for (const item of block.items) {
        lines.push(`- ${inlineTokensToPlainText(item)}`);
      }
      lines.push("");
      continue;
    }
    if (block.type === "numbers") {
      block.items.forEach((item, index) => {
        lines.push(`${index + 1}. ${inlineTokensToPlainText(item)}`);
      });
      lines.push("");
      continue;
    }
    if (block.type === "quote") {
      for (const line of block.lines) {
        lines.push(`"${inlineTokensToPlainText(line)}"`);
      }
      lines.push("");
      continue;
    }
    if (block.type === "code") {
      lines.push(block.language ? `[${block.language}]` : "[code]");
      lines.push(...block.code.split("\n"));
      lines.push("");
      continue;
    }
    if (block.type === "divider") {
      lines.push("------------------------------------------------------------");
      lines.push("");
      continue;
    }
    if (block.type === "page_break") {
      lines.push(PDF_PAGE_BREAK_SENTINEL);
      lines.push("");
      continue;
    }
    lines.push(`[${getProcedureInsightDomainLabel(block.domain)}]`);
    for (const line of block.lines) {
      lines.push(inlineTokensToPlainText(line));
    }
    lines.push("");
  }
  if (section.references.length > 0) {
    lines.push(`${labels.references}: ${section.references.map((reference) => reference.name).join(", ")}`);
    lines.push("");
  }
  if (connections.length > 0) {
    lines.push(`${labels.connections}:`);
    for (const connection of connections) {
      lines.push(`- ${getProcedureConnectionLabel(connection.type)}: ${connection.nodeName ?? connection.nodeId}`);
    }
    lines.push("");
  }
  return lines;
}

function appendPdfSection(
  doc: JsPdfDocument,
  section: ProcedureSectionData,
  bounds: { pageWidth: number; pageHeight: number },
  cursor: { y: number },
  labels: ProcedureExportLabels
) {
  const contentWidth = bounds.pageWidth - PAGE_MARGIN_X * 2;

  const headingText = `${section.headingNumber ? `${section.headingNumber} ` : ""}${section.node.name}`.trim();
  const headingFontSize = Math.max(13, 20 - section.depth * 1.8);
  ensurePdfSpace(doc, bounds, cursor, headingFontSize + 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(headingFontSize);
  doc.setTextColor(PDF_DEFAULT_TEXT_COLOR[0], PDF_DEFAULT_TEXT_COLOR[1], PDF_DEFAULT_TEXT_COLOR[2]);
  doc.text(headingText, PAGE_MARGIN_X, cursor.y);
  cursor.y += headingFontSize + 6;

  const richBlocks = readProcedureRichTextBlocks(section.bodyHtml);
  if (richBlocks.length > 0) {
    appendPdfRichSectionBody(doc, section, bounds, cursor, labels);
  } else {
    const blockLines = buildPdfBlockLines(section, labels);
    for (const line of blockLines) {
      if (line === PDF_PAGE_BREAK_SENTINEL) {
        doc.addPage();
        cursor.y = PAGE_MARGIN_TOP;
        continue;
      }
      if (!line) {
        cursor.y += 8;
        continue;
      }
      const wrapped = doc.splitTextToSize(line, contentWidth) as string[];
      ensurePdfSpace(doc, bounds, cursor, wrapped.length * 13 + 4);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(PDF_DEFAULT_TEXT_COLOR[0], PDF_DEFAULT_TEXT_COLOR[1], PDF_DEFAULT_TEXT_COLOR[2]);
      doc.text(wrapped, PAGE_MARGIN_X, cursor.y);
      cursor.y += wrapped.length * 13 + 2;
    }
  }
  cursor.y += 10;

  for (const child of section.children) {
    appendPdfSection(doc, child, bounds, cursor, labels);
  }
}

export async function buildProcedurePdfBytes(input: ProcedureExportInput): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const labels = resolveProcedureExportLabels(input.labels);
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PAGE_MARGIN_X * 2;
  const cursor = { y: PAGE_MARGIN_TOP };
  const documentTitle = `${input.rootSection.headingNumber ? `${input.rootSection.headingNumber} ` : ""}${input.rootSection.node.name}`.trim();

  if (input.coverImageDataUrl) {
    const coverSize = getPdfImageSize(doc, input.coverImageDataUrl, contentWidth);
    if (coverSize) {
      doc.addImage(input.coverImageDataUrl, getPdfImageFormat(input.coverImageDataUrl), PAGE_MARGIN_X, cursor.y, coverSize.width, coverSize.height);
      cursor.y += coverSize.height + 20;
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text(documentTitle, PAGE_MARGIN_X, cursor.y);
  cursor.y += 24;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${labels.generatedPrefix} ${new Date().toLocaleString(input.locale)}`, PAGE_MARGIN_X, cursor.y);
  cursor.y += 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(isWorkspaceProcedureReport(input.rootSection) ? labels.reportWorkspace : labels.reportNode, PAGE_MARGIN_X, cursor.y);
  cursor.y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const line of buildProcedureStatusOverviewLines(input.rootSection, labels)) {
    const wrapped = doc.splitTextToSize(line, contentWidth) as string[];
    ensurePdfSpace(doc, { pageWidth, pageHeight }, cursor, wrapped.length * 13 + 4);
    doc.text(wrapped, PAGE_MARGIN_X, cursor.y);
    cursor.y += wrapped.length * 13 + 2;
  }
  cursor.y += 8;

  const introSection = {
    ...input.rootSection,
    references: [],
    children: []
  };
  if (readProcedureRichTextBlocks(introSection.bodyHtml).length > 0) {
    appendPdfRichSectionBody(doc, introSection, { pageWidth, pageHeight }, cursor, labels);
  } else {
    const introLines = buildPdfBlockLines(introSection, labels);
    for (const line of introLines) {
      if (line === PDF_PAGE_BREAK_SENTINEL) {
        doc.addPage();
        cursor.y = PAGE_MARGIN_TOP;
        continue;
      }
      if (!line) {
        cursor.y += 8;
        continue;
      }
      const wrapped = doc.splitTextToSize(line, contentWidth) as string[];
      ensurePdfSpace(doc, { pageWidth, pageHeight }, cursor, wrapped.length * 13 + 4);
      doc.text(wrapped, PAGE_MARGIN_X, cursor.y);
      cursor.y += wrapped.length * 13 + 2;
    }
  }
  cursor.y += 12;

  for (const child of input.rootSection.children) {
    appendPdfSection(doc, child, { pageWidth, pageHeight }, cursor, labels);
  }

  decoratePdfDocument(doc, { pageWidth, pageHeight }, documentTitle);
  return new Uint8Array(doc.output("arraybuffer"));
}

function buildDocxRuns(text: string, docx: DocxModule): ParagraphChild[] {
  const { ExternalHyperlink, TextRun, UnderlineType } = docx;
  return parseProcedureInlineTokens(text).map((token) => {
    if (token.type === "text") {
      return new TextRun({ text: token.value });
    }
    if (token.type === "bold") {
      return new TextRun({ text: token.value, bold: true });
    }
    if (token.type === "italic") {
      return new TextRun({ text: token.value, italics: true });
    }
    if (token.type === "external_link") {
      return new ExternalHyperlink({
        link: token.href,
        children: [
          new TextRun({
            text: token.label,
            color: "2B7FFF",
            underline: { type: UnderlineType.SINGLE }
          })
        ]
      });
    }
    if (token.type === "app_link") {
      return new TextRun({
        text: token.label || token.appName || "App",
        color: "2B7FFF",
        italics: true,
        underline: { type: UnderlineType.SINGLE }
      });
    }
    return new TextRun({
      text:
        token.type === "image_link"
          ? `${token.alt || "Image"} [${token.nodeId}]`
          : token.type === "record_link"
            ? `${token.label || "Record"} [${token.recordId}]`
            : `${token.label} [${token.nodeId}]`,
      color: "55C7FF",
      underline: { type: UnderlineType.SINGLE }
    });
  });
}

function resolveDocxHeadingLevel(level: number, headingLevel: DocxModule["HeadingLevel"]) {
  if (level <= 1) return headingLevel.HEADING_1;
  if (level === 2) return headingLevel.HEADING_2;
  if (level === 3) return headingLevel.HEADING_3;
  if (level === 4) return headingLevel.HEADING_4;
  if (level === 5) return headingLevel.HEADING_5;
  return headingLevel.HEADING_6;
}

function resolveDocxTextColor(value: string | null | undefined): string | undefined {
  const rgb = resolveProcedureRichTextColorRgb(value);
  if (!rgb) return undefined;
  return rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function resolveDocxAlignment(
  value: ProcedureRichTextParagraph["textAlign"],
  alignmentType: DocxModule["AlignmentType"]
) {
  if (value === "center") return alignmentType.CENTER;
  if (value === "right") return alignmentType.RIGHT;
  if (value === "justify") return alignmentType.JUSTIFIED;
  return alignmentType.LEFT;
}

function resolveDocxIndentTwip(value: string | null | undefined): number | undefined {
  const points = parseRichTextCssSizeToPt(value, 12);
  if (!points) return undefined;
  return Math.max(0, Math.round(points * 20));
}

function resolveDocxParagraphFontSize(paragraph: ProcedureRichTextParagraph, fallback = 12): number {
  const resolved = paragraph.runs
    .map((run) => parseRichTextCssSizeToPt(run.fontSize))
    .find((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!resolved) return fallback;
  return Math.max(8, Math.min(28, resolved));
}

function buildDocxRichRunChildren(
  runs: ProcedureRichTextRun[],
  docx: DocxModule,
  options?: { defaultBold?: boolean; defaultItalic?: boolean }
): ParagraphChild[] {
  const { ExternalHyperlink, TextRun, UnderlineType } = docx;
  const children: ParagraphChild[] = [];
  runs.forEach((run) => {
    if (!run.text) return;
    const textRun = new TextRun({
      text: run.text,
      bold: Boolean(options?.defaultBold || run.bold),
      italics: Boolean(options?.defaultItalic || run.italic),
      underline: run.underline || run.href ? { type: UnderlineType.SINGLE } : undefined,
      color: resolveDocxTextColor(run.color),
      font: normalizeRichTextFontFamilyName(run.fontFamily) ?? undefined,
      size: (() => {
        const points = parseRichTextCssSizeToPt(run.fontSize);
        return points ? Math.round(points * 2) : undefined;
      })()
    });
    if (run.href && /^(https?:|mailto:|tel:)/i.test(run.href)) {
      children.push(
        new ExternalHyperlink({
          link: run.href,
          children: [textRun]
        })
      );
      return;
    }
    children.push(textRun);
  });
  return children;
}

function buildDocxRichParagraphNode(
  paragraph: ProcedureRichTextParagraph,
  docx: DocxModule,
  options?: {
    heading?: ReturnType<typeof resolveDocxHeadingLevel>;
    prefix?: string;
    defaultBold?: boolean;
    defaultItalic?: boolean;
    spacingAfter?: number;
    spacingBefore?: number;
    indentLeft?: number;
    hanging?: number;
    borderLeftColor?: string;
    shadedFill?: string;
  }
): Paragraph {
  const { AlignmentType, BorderStyle, LineRuleType, Paragraph, ShadingType, TextRun } = docx;
  const fontSize = resolveDocxParagraphFontSize(paragraph, 12);
  const lineMultiplier = parseRichTextLineHeightMultiplier(paragraph.lineHeight, fontSize) ?? 1.15;
  const indentLeft = options?.indentLeft ?? 0;
  const firstLineIndent = resolveDocxIndentTwip(paragraph.marginLeft) ?? 0;
  const children: ParagraphChild[] = [];
  if (options?.prefix) {
    children.push(new TextRun({ text: options.prefix }));
  }
  children.push(...buildDocxRichRunChildren(paragraph.runs, docx, options));
  if (children.length === 0) {
    children.push(new TextRun({ text: "" }));
  }
  return new Paragraph({
    heading: options?.heading,
    alignment: resolveDocxAlignment(paragraph.textAlign, AlignmentType),
    indent:
      indentLeft || options?.hanging || firstLineIndent
        ? {
            left: indentLeft || undefined,
            hanging: options?.hanging,
            firstLine: options?.hanging ? undefined : firstLineIndent || undefined
          }
        : undefined,
    spacing: {
      before: options?.spacingBefore,
      after: options?.spacingAfter ?? 120,
      line: Math.round(fontSize * Math.max(1, lineMultiplier) * 20),
      lineRule: LineRuleType.AUTO
    },
    border: options?.borderLeftColor
      ? {
          left: { color: options.borderLeftColor, style: BorderStyle.SINGLE, size: 10 }
        }
      : undefined,
    shading: options?.shadedFill
      ? { type: ShadingType.CLEAR, fill: options.shadedFill, color: "auto" }
      : undefined,
    children
  });
}

function buildDocxRichTableNode(
  block: Extract<ProcedureRichTextBlock, { type: "table" }>,
  docx: DocxModule
): Table {
  const { BorderStyle, Paragraph, Table, TableCell, TableRow, WidthType } = docx;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: block.rows.map(
      (row) =>
        new TableRow({
          children: row.cells.map(
            (cell) =>
              new TableCell({
                columnSpan: cell.colSpan,
                rowSpan: cell.rowSpan,
                shading: cell.header ? { fill: "E2E8F0", color: "auto" } : undefined,
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 2, color: "CBD5E1" },
                  right: { style: BorderStyle.SINGLE, size: 2, color: "CBD5E1" },
                  bottom: { style: BorderStyle.SINGLE, size: 2, color: "CBD5E1" },
                  left: { style: BorderStyle.SINGLE, size: 2, color: "CBD5E1" }
                },
                children:
                  cell.paragraphs.length > 0
                    ? cell.paragraphs.map((paragraph) =>
                        buildDocxRichParagraphNode(paragraph, docx, {
                          spacingAfter: 80
                        })
                      )
                    : [new Paragraph({ children: [] })]
              })
          )
        })
    )
  });
}

function buildDocxRichBlockChildren(
  blocks: ProcedureRichTextBlock[],
  docx: DocxModule
): Array<Paragraph | Table> {
  const { HeadingLevel, ImageRun, PageBreak, Paragraph } = docx;
  const children: Array<Paragraph | Table> = [];

  blocks.forEach((block) => {
    if (block.type === "heading") {
      children.push(
        buildDocxRichParagraphNode(block, docx, {
          heading: resolveDocxHeadingLevel(block.level, HeadingLevel),
          defaultBold: true,
          spacingBefore: 80,
          spacingAfter: 120
        })
      );
      return;
    }
    if (block.type === "paragraph") {
      children.push(buildDocxRichParagraphNode(block, docx));
      return;
    }
    if (block.type === "list") {
      block.items.forEach((item) => {
        children.push(
          buildDocxRichParagraphNode(item, docx, {
            prefix: item.ordered ? `${item.start ?? 1}. ` : "\u2022 ",
            indentLeft: 360 + item.level * 240,
            hanging: 180,
            spacingAfter: 80
          })
        );
      });
      return;
    }
    if (block.type === "quote") {
      block.paragraphs.forEach((paragraph) => {
        children.push(
          buildDocxRichParagraphNode(paragraph, docx, {
            defaultItalic: true,
            indentLeft: 320,
            borderLeftColor: "55C7FF",
            spacingAfter: 80
          })
        );
      });
      return;
    }
    if (block.type === "code") {
      children.push(
        new Paragraph({
          shading: { type: docx.ShadingType.CLEAR, fill: "16263B", color: "auto" },
          spacing: { before: 120, after: 120 },
          children: [
            new docx.TextRun({
              text: block.code,
              font: "Courier New",
              size: 18
            })
          ]
        })
      );
      return;
    }
    if (block.type === "divider") {
      children.push(
        new Paragraph({
          thematicBreak: true,
          spacing: { before: 120, after: 120 }
        })
      );
      return;
    }
    if (block.type === "page_break") {
      children.push(
        new Paragraph({
          children: [new PageBreak()]
        })
      );
      return;
    }
    if (block.type === "table") {
      children.push(buildDocxRichTableNode(block, docx));
      return;
    }
    if (block.type === "image") {
      const decoded = decodeDataUrl(block.src);
      if (!decoded) return;
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: decoded.bytes,
              transformation: { width: 420, height: 236 },
              type: decoded.extension
            })
          ]
        })
      );
    }
  });

  return children;
}

function buildDocxSectionParagraphs(
  section: ProcedureSectionData,
  labels: ProcedureExportLabels,
  docx: DocxModule,
  isRoot = false
): Array<Paragraph | Table> {
  const { BorderStyle, HeadingLevel, Paragraph, ShadingType, TextRun } = docx;
  const paragraphs: Array<Paragraph | Table> = [];
  const connections = readProcedureConnections(section.node);

  if (!isRoot) {
    paragraphs.push(
      new Paragraph({
        heading: resolveDocxHeadingLevel(section.depth + 1, HeadingLevel),
        children: [
          new TextRun({
            text: `${section.headingNumber ? `${section.headingNumber} ` : ""}${section.node.name}`.trim()
          })
        ]
      })
    );
  }

  const richBlocks = readProcedureRichTextBlocks(section.bodyHtml);
  if (richBlocks.length > 0) {
    paragraphs.push(...buildDocxRichBlockChildren(richBlocks, docx));
  } else {
    for (const block of parseProcedureBlocks(section.body)) {
      if (block.type === "heading") {
        paragraphs.push(
          new Paragraph({
            heading: resolveDocxHeadingLevel(block.level, HeadingLevel),
            children: buildDocxRuns(block.text, docx)
          })
        );
        continue;
      }
      if (block.type === "paragraph") {
        for (const line of block.lines) {
          paragraphs.push(new Paragraph({ children: buildDocxRuns(line, docx) }));
        }
        continue;
      }
      if (block.type === "bullets") {
        for (const item of block.items) {
          paragraphs.push(
            new Paragraph({
              bullet: { level: 0 },
              children: buildDocxRuns(item, docx)
            })
          );
        }
        continue;
      }
      if (block.type === "numbers") {
        block.items.forEach((item, index) => {
          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: `${index + 1}. ` }), ...buildDocxRuns(item, docx)]
            })
          );
        });
        continue;
      }
      if (block.type === "quote") {
        for (const line of block.lines) {
          paragraphs.push(
            new Paragraph({
              border: {
                left: { color: "55C7FF", style: BorderStyle.SINGLE, size: 12 }
              },
              indent: { left: 320 },
              spacing: { before: 80, after: 80 },
              children: buildDocxRuns(line, docx)
            })
          );
        }
        continue;
      }
      if (block.type === "code") {
        const codeLines = block.code.split("\n");
        paragraphs.push(
          new Paragraph({
            shading: { type: ShadingType.CLEAR, fill: "16263B", color: "auto" },
            spacing: { before: 120, after: 120 },
            children: [
              new TextRun({
                text: codeLines.join("\n"),
                font: "Courier New",
                size: 18
              })
            ]
          })
        );
        continue;
      }
      if (block.type === "divider") {
        paragraphs.push(
          new Paragraph({
            border: {
              bottom: { color: "55C7FF", style: BorderStyle.SINGLE, size: 6 }
            },
            spacing: { before: 120, after: 120 }
          })
        );
        continue;
      }
      if (block.type === "page_break") {
        paragraphs.push(new Paragraph({ children: [new docx.PageBreak()] }));
        continue;
      }
      paragraphs.push(
        new Paragraph({
          shading: { type: ShadingType.CLEAR, fill: "10253A", color: "auto" },
          spacing: { before: 120, after: 120 },
          children: [
            new TextRun({
              text: `${getProcedureInsightDomainLabel(block.domain)}\n${block.lines.map((line) => inlineTokensToPlainText(line)).join("\n")}`,
              color: "D7F7FF"
            })
          ]
        })
      );
    }
  }

  if (section.references.length > 0) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${labels.references}: `, bold: true }),
          new TextRun({ text: section.references.map((reference) => reference.name).join(", ") })
        ]
      })
    );
  }
  if (connections.length > 0) {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: `${labels.connections}:`, bold: true })]
      })
    );
    for (const connection of connections) {
      paragraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [
            new TextRun({
              text: `${getProcedureConnectionLabel(connection.type)}: ${connection.nodeName ?? connection.nodeId}`
            })
          ]
        })
      );
    }
  }

  for (const child of section.children) {
    paragraphs.push(...buildDocxSectionParagraphs(child, labels, docx));
  }

  return paragraphs;
}

export async function buildProcedureDocxBytes(input: ProcedureExportInput): Promise<Uint8Array> {
  const docx = await import("docx");
  const { AlignmentType, Document, Footer, Header, HeadingLevel, ImageRun, Packer, Paragraph, PageNumber, TextRun } = docx;
  const labels = resolveProcedureExportLabels(input.labels);
  const children: Array<Paragraph | Table> = [];
  const documentTitle = `${input.rootSection.headingNumber ? `${input.rootSection.headingNumber} ` : ""}${input.rootSection.node.name}`.trim();

  if (input.coverImageDataUrl) {
    const decodedCover = decodeDataUrl(input.coverImageDataUrl);
    if (decodedCover) {
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: decodedCover.bytes,
              transformation: { width: 520, height: 220 },
              type: decodedCover.extension
            })
          ]
        })
      );
    }
  }

  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [
        new TextRun({
          text: documentTitle
        })
      ]
    })
  );
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${labels.generatedPrefix} ${new Date().toLocaleString(input.locale)}`,
          italics: true,
          color: "666666"
        })
      ]
    })
  );
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: isWorkspaceProcedureReport(input.rootSection) ? labels.reportWorkspace : labels.reportNode,
          bold: true
        })
      ]
    })
  );
  children.push(
    new Paragraph({
      children: [new TextRun({ text: labels.statusOverview, bold: true })]
    })
  );
  for (const line of buildProcedureStatusOverviewLines(input.rootSection, labels).slice(1)) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: line })]
      })
    );
  }
  children.push(...buildDocxSectionParagraphs(input.rootSection, labels, docx, true));

  const document = new Document({
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: documentTitle,
                    italics: true,
                    color: "64748B"
                  })
                ]
              })
            ]
          })
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: "Page " }),
                  new TextRun({ children: [PageNumber.CURRENT] }),
                  new TextRun({ text: " / " }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES] })
                ]
              })
            ]
          })
        },
        children
      }
    ]
  });

  const blob = await Packer.toBlob(document);
  return new Uint8Array(await blob.arrayBuffer());
}
