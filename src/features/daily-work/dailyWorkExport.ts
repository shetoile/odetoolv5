import type {
  DailyDocumentItem,
  DailyWorkActivity,
  DailyWorkItem,
  DailyWorkState
} from "./dailyWorkTypes";

export type DailyWorkExportFormat = "pdf" | "excel" | "word";

export type DailyWorkExportPayload = {
  title: string;
  generatedAt: string;
  state: DailyWorkState;
  documents: DailyDocumentItem[];
};

function text(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function dateOnly(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "";
}

function describeItem(item: DailyWorkItem): string {
  const parts = [
    item.type,
    item.status,
    dateOnly(item.dueDate),
    item.sourceLabels.join(", "),
    item.evidenceRefs.map((ref) => ref.label).join(", ")
  ].filter(Boolean);
  return `${item.title}${parts.length ? ` (${parts.join(" | ")})` : ""}${item.body ? `\n${item.body}` : ""}`;
}

function buildSectionLines(title: string, lines: string[]): string[] {
  return [title, ...lines.map((line) => `- ${line}`), ""];
}

function buildPlainText(payload: DailyWorkExportPayload): string {
  const notes = payload.state.items.filter((item) => item.type === "note");
  const meetings = payload.state.items.filter((item) => item.type === "meeting_summary");
  const workItems = payload.state.items.filter((item) => item.type !== "note" && item.type !== "meeting_summary");
  const timeline = workItems.filter((item) => item.dueDate && (item.timelineLinked || item.status === "approved" || item.status === "active" || item.status === "done"));

  return [
    payload.title,
    `Generated: ${payload.generatedAt}`,
    "",
    ...buildSectionLines("Notes", notes.length ? notes.map(describeItem) : ["None"]),
    ...buildSectionLines("Meetings", meetings.length ? meetings.map(describeItem) : ["None"]),
    ...buildSectionLines("Actions / Decisions / Risks / Follow-ups", workItems.length ? workItems.map(describeItem) : ["None"]),
    ...buildSectionLines("Timeline / Gantt", timeline.length ? timeline.map(describeItem) : ["None"]),
    ...buildSectionLines(
      "Documents",
      payload.documents.length
        ? payload.documents.map((document) => `${document.name} (${document.kind}, ${document.source})${document.pathLabel ? ` ${document.pathLabel}` : ""}`)
        : ["None"]
    ),
    ...buildSectionLines(
      "Recent Changes",
      payload.state.activities.length ? payload.state.activities.slice(0, 30).map(describeActivity) : ["None"]
    )
  ].join("\n");
}

function describeActivity(activity: DailyWorkActivity): string {
  return `${activity.createdAt.slice(0, 16).replace("T", " ")} ${activity.label}${activity.detail ? ` - ${activity.detail}` : ""}`;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 800);
}

function sanitizeFileName(value: string): string {
  const clean = value.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ");
  return clean || "ODETool Daily Work";
}

function buildBaseFileName(payload: DailyWorkExportPayload): string {
  return `${sanitizeFileName(payload.title)} ${payload.generatedAt.slice(0, 10)}`;
}

function csvValue(value: string | null | undefined): string {
  const safe = text(value).replace(/"/g, '""');
  return `"${safe}"`;
}

function buildCsv(payload: DailyWorkExportPayload): string {
  const rows = [
    ["section", "type", "status", "date", "title", "detail", "evidence"].map(csvValue).join(",")
  ];

  for (const item of payload.state.items) {
    const section = item.type === "note" ? "Notes" : item.type === "meeting_summary" ? "Meetings" : "Actions";
    rows.push([
      section,
      item.type,
      item.status,
      dateOnly(item.dueDate),
      item.title,
      item.body,
      item.evidenceRefs.map((ref) => ref.label).join("; ")
    ].map(csvValue).join(","));
  }

  for (const document of payload.documents) {
    rows.push([
      "Documents",
      document.kind,
      document.source,
      dateOnly(document.createdAt),
      document.name,
      document.pathLabel ?? "",
      document.id
    ].map(csvValue).join(","));
  }

  for (const activity of payload.state.activities) {
    rows.push([
      "Recent Changes",
      activity.type,
      "",
      dateOnly(activity.createdAt),
      activity.label,
      activity.detail ?? "",
      activity.documentId ?? activity.itemId ?? ""
    ].map(csvValue).join(","));
  }

  return rows.join("\r\n");
}

export async function exportDailyWork(payload: DailyWorkExportPayload, format: DailyWorkExportFormat): Promise<void> {
  const baseName = buildBaseFileName(payload);
  if (format === "excel") {
    downloadBlob(new Blob([buildCsv(payload)], { type: "text/csv;charset=utf-8" }), `${baseName}.csv`);
    return;
  }

  if (format === "pdf") {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const lines = pdf.splitTextToSize(buildPlainText(payload), 520) as string[];
    let y = 44;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    for (const line of lines) {
      if (y > 780) {
        pdf.addPage();
        y = 44;
      }
      pdf.text(line, 38, y);
      y += 14;
    }
    pdf.save(`${baseName}.pdf`);
    return;
  }

  const docx = await import("docx");
  const children = buildPlainText(payload).split(/\r?\n/).map((line) =>
    new docx.Paragraph({
      children: [
        new docx.TextRun({
          text: line || " ",
          bold: /^[A-Z][A-Za-z /-]+$/.test(line)
        })
      ]
    })
  );
  const document = new docx.Document({
    sections: [{ children }]
  });
  const blob = await docx.Packer.toBlob(document);
  downloadBlob(blob, `${baseName}.docx`);
}
