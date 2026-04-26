import { jsPDF } from "jspdf";

export interface AiReviewPdfInput {
  title: string;
  locale: string;
  workspaceName: string;
  selectedLabel: string;
  goal: string;
  sourceLabels: string[];
  reviewText: string;
}

const PAGE_MARGIN_X = 42;
const PAGE_MARGIN_TOP = 42;
const PAGE_MARGIN_BOTTOM = 42;
const BODY_FONT_SIZE = 10;
const SMALL_FONT_SIZE = 9;
const TITLE_FONT_SIZE = 16;

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function cleanReportLine(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^#{1,6}\s+/.test(trimmed)) {
    return trimmed.replace(/^#{1,6}\s+/, "").trim();
  }
  return trimmed;
}

export function buildAiReviewPdfBytes(input: AiReviewPdfInput): Uint8Array {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PAGE_MARGIN_X * 2;
  let y = PAGE_MARGIN_TOP;

  const ensureSpace = (requiredHeight: number) => {
    if (y + requiredHeight <= pageHeight - PAGE_MARGIN_BOTTOM) return;
    doc.addPage();
    y = PAGE_MARGIN_TOP;
  };

  const drawWrappedText = (
    text: string,
    options?: {
      fontStyle?: "normal" | "bold";
      fontSize?: number;
      gapAfter?: number;
    }
  ) => {
    const normalized = cleanReportLine(text);
    if (!normalized) {
      y += options?.gapAfter ?? 8;
      return;
    }
    const fontStyle = options?.fontStyle ?? "normal";
    const fontSize = options?.fontSize ?? BODY_FONT_SIZE;
    doc.setFont("helvetica", fontStyle);
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(normalized, contentWidth) as string[];
    const lineHeight = fontSize <= SMALL_FONT_SIZE ? 11 : 13;
    const blockHeight = lines.length * lineHeight + (options?.gapAfter ?? 6);
    ensureSpace(blockHeight);
    doc.text(lines, PAGE_MARGIN_X, y);
    y += lines.length * lineHeight + (options?.gapAfter ?? 6);
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(TITLE_FONT_SIZE);
  doc.text(normalizeLine(input.title), PAGE_MARGIN_X, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(SMALL_FONT_SIZE);
  doc.text(`Generated: ${new Date().toLocaleString(input.locale)}`, PAGE_MARGIN_X, y);
  y += 18;

  drawWrappedText(`Workspace: ${input.workspaceName || "-"}`, { fontSize: BODY_FONT_SIZE, gapAfter: 4 });
  drawWrappedText(`Selected context: ${input.selectedLabel || "-"}`, { fontSize: BODY_FONT_SIZE, gapAfter: 4 });
  drawWrappedText(`Review goal: ${input.goal || "-"}`, { fontSize: BODY_FONT_SIZE, gapAfter: 10 });

  if (input.sourceLabels.length > 0) {
    drawWrappedText("Sources", { fontStyle: "bold", fontSize: 12, gapAfter: 6 });
    drawWrappedText(input.sourceLabels.join(", "), { fontSize: SMALL_FONT_SIZE, gapAfter: 12 });
  }

  drawWrappedText("AI Review", { fontStyle: "bold", fontSize: 12, gapAfter: 8 });
  const rawLines = input.reviewText.split(/\r?\n/);
  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      y += 6;
      continue;
    }
    const isHeading = /^#{1,6}\s+/.test(trimmed) || /^[A-Z][A-Za-z /-]+:$/.test(trimmed);
    drawWrappedText(trimmed, {
      fontStyle: isHeading ? "bold" : "normal",
      fontSize: isHeading ? 11 : BODY_FONT_SIZE,
      gapAfter: isHeading ? 6 : 4
    });
  }

  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
}
