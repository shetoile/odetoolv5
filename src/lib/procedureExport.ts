import { jsPDF } from "jspdf";
import {
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  TextRun,
  UnderlineType,
  type ParagraphChild
} from "docx";
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
import { ROOT_PARENT_ID } from "@/lib/types";

const PAGE_MARGIN_X = 42;
const PAGE_MARGIN_TOP = 42;
const PAGE_MARGIN_BOTTOM = 42;

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

function getPdfImageSize(doc: jsPDF, dataUrl: string, maxWidth: number): { width: number; height: number } | null {
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
  doc: jsPDF,
  section: ProcedureSectionData,
  bounds: { pageWidth: number; pageHeight: number },
  cursor: { y: number },
  labels: ProcedureExportLabels
) {
  const contentWidth = bounds.pageWidth - PAGE_MARGIN_X * 2;
  const ensureSpace = (requiredHeight: number) => {
    if (cursor.y + requiredHeight <= bounds.pageHeight - PAGE_MARGIN_BOTTOM) return;
    doc.addPage();
    cursor.y = PAGE_MARGIN_TOP;
  };

  const headingText = `${section.headingNumber ? `${section.headingNumber} ` : ""}${section.node.name}`.trim();
  const headingFontSize = Math.max(13, 20 - section.depth * 1.8);
  ensureSpace(headingFontSize + 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(headingFontSize);
  doc.text(headingText, PAGE_MARGIN_X, cursor.y);
  cursor.y += headingFontSize + 6;

  const blockLines = buildPdfBlockLines(section, labels);
  for (const line of blockLines) {
    if (!line) {
      cursor.y += 8;
      continue;
    }
    const wrapped = doc.splitTextToSize(line, contentWidth) as string[];
    ensureSpace(wrapped.length * 13 + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(wrapped, PAGE_MARGIN_X, cursor.y);
    cursor.y += wrapped.length * 13 + 2;
  }
  cursor.y += 10;

  for (const child of section.children) {
    appendPdfSection(doc, child, bounds, cursor, labels);
  }
}

export function buildProcedurePdfBytes(input: ProcedureExportInput): Uint8Array {
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

  if (input.coverImageDataUrl) {
    const coverSize = getPdfImageSize(doc, input.coverImageDataUrl, contentWidth);
    if (coverSize) {
      doc.addImage(input.coverImageDataUrl, getPdfImageFormat(input.coverImageDataUrl), PAGE_MARGIN_X, cursor.y, coverSize.width, coverSize.height);
      cursor.y += coverSize.height + 20;
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text(input.rootSection.node.name, PAGE_MARGIN_X, cursor.y);
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
    if (cursor.y + wrapped.length * 13 + 4 > pageHeight - PAGE_MARGIN_BOTTOM) {
      doc.addPage();
      cursor.y = PAGE_MARGIN_TOP;
    }
    doc.text(wrapped, PAGE_MARGIN_X, cursor.y);
    cursor.y += wrapped.length * 13 + 2;
  }
  cursor.y += 8;

  const introLines = buildPdfBlockLines({
    ...input.rootSection,
    references: [],
    children: []
  }, labels);
  for (const line of introLines) {
    if (!line) {
      cursor.y += 8;
      continue;
    }
    const wrapped = doc.splitTextToSize(line, contentWidth) as string[];
    if (cursor.y + wrapped.length * 13 + 4 > pageHeight - PAGE_MARGIN_BOTTOM) {
      doc.addPage();
      cursor.y = PAGE_MARGIN_TOP;
    }
    doc.text(wrapped, PAGE_MARGIN_X, cursor.y);
    cursor.y += wrapped.length * 13 + 2;
  }
  cursor.y += 12;

  for (const child of input.rootSection.children) {
    appendPdfSection(doc, child, { pageWidth, pageHeight }, cursor, labels);
  }

  return new Uint8Array(doc.output("arraybuffer"));
}

function buildDocxRuns(text: string): ParagraphChild[] {
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
      text: `${token.label} [${token.nodeId}]`,
      color: "55C7FF",
      underline: { type: UnderlineType.SINGLE }
    });
  });
}

function buildDocxSectionParagraphs(section: ProcedureSectionData, labels: ProcedureExportLabels, isRoot = false): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const connections = readProcedureConnections(section.node);

  if (!isRoot) {
    const headingLevel =
      section.depth <= 1
        ? HeadingLevel.HEADING_1
        : section.depth === 2
          ? HeadingLevel.HEADING_2
          : section.depth === 3
            ? HeadingLevel.HEADING_3
            : HeadingLevel.HEADING_4;
    paragraphs.push(
      new Paragraph({
        heading: headingLevel,
        children: [
          new TextRun({
            text: `${section.headingNumber ? `${section.headingNumber} ` : ""}${section.node.name}`.trim()
          })
        ]
      })
    );
  }

  for (const block of parseProcedureBlocks(section.body)) {
    if (block.type === "heading") {
      paragraphs.push(
        new Paragraph({
          heading: block.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
          children: buildDocxRuns(block.text)
        })
      );
      continue;
    }
    if (block.type === "paragraph") {
      for (const line of block.lines) {
        paragraphs.push(new Paragraph({ children: buildDocxRuns(line) }));
      }
      continue;
    }
    if (block.type === "bullets") {
      for (const item of block.items) {
        paragraphs.push(
          new Paragraph({
            bullet: { level: 0 },
            children: buildDocxRuns(item)
          })
        );
      }
      continue;
    }
    if (block.type === "numbers") {
      block.items.forEach((item, index) => {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: `${index + 1}. ` }), ...buildDocxRuns(item)]
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
            children: buildDocxRuns(line)
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
    paragraphs.push(...buildDocxSectionParagraphs(child, labels));
  }

  return paragraphs;
}

export async function buildProcedureDocxBytes(input: ProcedureExportInput): Promise<Uint8Array> {
  const labels = resolveProcedureExportLabels(input.labels);
  const children: Paragraph[] = [];

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
      children: [new TextRun({ text: input.rootSection.node.name })]
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
  children.push(...buildDocxSectionParagraphs(input.rootSection, labels, true));

  const document = new Document({
    sections: [
      {
        children
      }
    ]
  });

  const blob = await Packer.toBlob(document);
  return new Uint8Array(await blob.arrayBuffer());
}
