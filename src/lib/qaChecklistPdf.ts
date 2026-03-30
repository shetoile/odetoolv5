import { jsPDF } from "jspdf";

export type QaPdfStatus = "pending" | "passed" | "failed";
export type QaPdfAttachmentSource = "file" | "screenshot";

export interface QaPdfReportAttachment {
  name: string;
  path: string;
  source: QaPdfAttachmentSource;
}

export interface QaPdfReportItem {
  area: string;
  title: string;
  scenario: string;
  status: QaPdfStatus;
  checkedAt: string | null;
  failureReason: string;
  developerGuidance?: string;
  screenshotPreviewDataUrl?: string | null;
  attachments: QaPdfReportAttachment[];
}

export interface QaPdfReportInput {
  fileName: string;
  locale: string;
  labels: {
    title: string;
    generatedAt: string;
    preparedBy: string;
    cycle: string;
    scope: string;
    notes: string;
    summaryTitle: string;
    latestUpdatesTitle: string;
    currentStatusTitle: string;
    total: string;
    passed: string;
    failed: string;
    pending: string;
    noUpdates: string;
    statusPending: string;
    statusPassed: string;
    statusFailed: string;
    lastCheckedNever: string;
    statusLabel: string;
    lastCheckedLabel: string;
    reasonLabel: string;
    evidenceLabel: string;
    developerGuidanceLabel: string;
  };
  preparedBy: string;
  cycle: string;
  scope: string;
  notes: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    pending: number;
  };
  items: QaPdfReportItem[];
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

function formatDate(value: string, locale: string): string {
  try {
    return new Date(value).toLocaleString(locale);
  } catch {
    return value;
  }
}

function statusText(status: QaPdfStatus, labels: QaPdfReportInput["labels"]): string {
  if (status === "passed") return labels.statusPassed;
  if (status === "failed") return labels.statusFailed;
  return labels.statusPending;
}

function buildItemBlockLines(
  item: QaPdfReportItem,
  labels: QaPdfReportInput["labels"],
  locale: string
): string[] {
  const checkedText = item.checkedAt ? formatDate(item.checkedAt, locale) : labels.lastCheckedNever;
  const lines = [
    `[${item.area}] ${normalizeLine(item.title)}`,
    `${labels.statusLabel}: ${statusText(item.status, labels)}   ${labels.lastCheckedLabel}: ${checkedText}`,
    normalizeLine(item.scenario)
  ];

  if (item.status === "failed" && item.failureReason.trim()) {
    lines.push(`${labels.reasonLabel}: ${normalizeLine(item.failureReason)}`);
  }

  if (item.status === "failed" && item.developerGuidance?.trim()) {
    lines.push(`${labels.developerGuidanceLabel}: ${normalizeLine(item.developerGuidance)}`);
  }

  if (item.status === "failed") {
    if (item.attachments.length === 0) {
      lines.push(`${labels.evidenceLabel}: -`);
    } else {
      lines.push(`${labels.evidenceLabel}:`);
      for (const attachment of item.attachments) {
        lines.push(`- ${normalizeLine(attachment.name)} | ${normalizeLine(attachment.path)}`);
      }
    }
  }

  return lines;
}

function getPreviewImageSize(doc: jsPDF, dataUrl: string, maxWidth: number): { width: number; height: number } | null {
  try {
    const properties = doc.getImageProperties(dataUrl);
    const sourceWidth = Number(properties.width) || maxWidth;
    const sourceHeight = Number(properties.height) || Math.round(maxWidth * 0.56);
    const width = Math.min(maxWidth, sourceWidth);
    const height = Math.max(72, sourceHeight * (width / sourceWidth));
    return { width, height };
  } catch {
    return null;
  }
}

export function buildQaChecklistPdfReportBytes(input: QaPdfReportInput): Uint8Array {
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

  const drawLabelValue = (label: string, value: string) => {
    const text = `${label}: ${normalizeLine(value)}`;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(BODY_FONT_SIZE);
    const lines = doc.splitTextToSize(text, contentWidth) as string[];
    const blockHeight = lines.length * 13 + 4;
    ensureSpace(blockHeight);
    doc.text(lines, PAGE_MARGIN_X, y);
    y += blockHeight;
  };

  const drawSectionTitle = (title: string) => {
    ensureSpace(22);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, PAGE_MARGIN_X, y);
    y += 16;
  };

  const now = new Date().toLocaleString(input.locale);
  const latestUpdates = [...input.items]
    .filter((item) => item.checkedAt)
    .sort((a, b) => {
      const aValue = a.checkedAt ? new Date(a.checkedAt).getTime() : 0;
      const bValue = b.checkedAt ? new Date(b.checkedAt).getTime() : 0;
      return bValue - aValue;
    });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(TITLE_FONT_SIZE);
  doc.text(normalizeLine(input.labels.title), PAGE_MARGIN_X, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(SMALL_FONT_SIZE);
  doc.text(`${input.labels.generatedAt}: ${now}`, PAGE_MARGIN_X, y);
  y += 18;

  drawLabelValue(input.labels.preparedBy, input.preparedBy);
  drawLabelValue(input.labels.cycle, input.cycle);
  drawLabelValue(input.labels.scope, input.scope || "-");
  drawLabelValue(input.labels.notes, input.notes || "-");

  y += 4;
  drawSectionTitle(input.labels.summaryTitle);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(BODY_FONT_SIZE);
  const summaryLine = [
    `${input.labels.total}: ${input.summary.total}`,
    `${input.labels.passed}: ${input.summary.passed}`,
    `${input.labels.failed}: ${input.summary.failed}`,
    `${input.labels.pending}: ${input.summary.pending}`
  ].join("    ");
  const summaryLines = doc.splitTextToSize(summaryLine, contentWidth) as string[];
  ensureSpace(summaryLines.length * 13 + 6);
  doc.text(summaryLines, PAGE_MARGIN_X, y);
  y += summaryLines.length * 13 + 10;

  drawSectionTitle(input.labels.latestUpdatesTitle);
  if (latestUpdates.length === 0) {
    ensureSpace(16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(BODY_FONT_SIZE);
    doc.text(input.labels.noUpdates, PAGE_MARGIN_X, y);
    y += 16;
  } else {
    for (const item of latestUpdates) {
      const blockLines = buildItemBlockLines(item, input.labels, input.locale);
      const wrapped = blockLines.flatMap((line) => doc.splitTextToSize(line, contentWidth) as string[]);
      const blockHeight = wrapped.length * 12 + 8;
      ensureSpace(blockHeight + 2);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(BODY_FONT_SIZE);
      doc.text(wrapped[0] ?? "", PAGE_MARGIN_X, y);
      y += 12;
      if (wrapped.length > 1) {
        doc.setFont("helvetica", "normal");
        doc.text(wrapped.slice(1), PAGE_MARGIN_X, y);
        y += (wrapped.length - 1) * 12;
      }
      y += 8;
    }
  }

  drawSectionTitle(input.labels.currentStatusTitle);
  for (const item of input.items) {
    const blockLines = buildItemBlockLines(item, input.labels, input.locale);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(SMALL_FONT_SIZE);
    const lines = blockLines.flatMap((line) => doc.splitTextToSize(line, contentWidth) as string[]);
    const previewSize =
      item.status === "failed" && item.screenshotPreviewDataUrl
        ? getPreviewImageSize(doc, item.screenshotPreviewDataUrl, Math.min(220, contentWidth))
        : null;
    const blockHeight = lines.length * 11 + 4 + (previewSize ? previewSize.height + 10 : 0);
    ensureSpace(blockHeight);
    doc.text(lines, PAGE_MARGIN_X, y);
    y += lines.length * 11 + 4;
    if (previewSize && item.screenshotPreviewDataUrl) {
      doc.addImage(
        item.screenshotPreviewDataUrl,
        "PNG",
        PAGE_MARGIN_X,
        y,
        previewSize.width,
        previewSize.height
      );
      y += previewSize.height + 10;
    }
  }

  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
}
