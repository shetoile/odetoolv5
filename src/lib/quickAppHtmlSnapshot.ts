import type { QuickAppScope } from "@/lib/nodeQuickApps";

export interface QuickAppHtmlStorageSnapshot {
  namespace: string;
  scope: QuickAppScope | string;
  ownerId: string | null;
  ownerLabel: string | null;
  quickAppId: string;
  title: string | null;
  currentUrl: string | null;
  entries: Record<string, string>;
  fieldEntries: Record<string, string>;
  documentText: string | null;
  updatedAt: number;
}

type QuickAppTaskSnapshot = {
  title: string;
  description: string | null;
  start: string | null;
  end: string | null;
  priority: boolean;
};

type QuickAppDocumentSnapshot = {
  name: string;
  fileName: string | null;
};

function normalizeText(value: string | null | undefined): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function truncateText(value: string, limit = 900): string {
  const normalized = normalizeText(value);
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit).trim()}...`;
}

function stripSimpleHtml(value: string | null | undefined): string {
  return normalizeText(
    (value ?? "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, "\"")
      .replace(/&#39;/gi, "'")
  );
}

function readStringEntry(
  entries: Record<string, string>,
  predicate: (key: string) => boolean
): string | null {
  for (const [key, value] of Object.entries(entries)) {
    if (!predicate(key)) continue;
    const trimmed = normalizeText(value);
    if (trimmed) return trimmed;
  }
  return null;
}

function parseJsonArray(raw: string | null | undefined): unknown[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function resolveChantierName(snapshot: QuickAppHtmlStorageSnapshot): string | null {
  const active = normalizeText(snapshot.entries["chantierName__actif"]);
  if (active) return active;
  return readStringEntry(snapshot.entries, (key) => key.startsWith("chantierName__"));
}

function findScopedEntry(
  entries: Record<string, string>,
  prefix: string,
  chantierName: string | null
): string | null {
  if (chantierName) {
    const direct = entries[`${prefix}${chantierName}`];
    if (typeof direct === "string" && direct.trim().length > 0) {
      return direct;
    }
  }
  return readStringEntry(entries, (key) => key.startsWith(prefix));
}

function parseTasks(snapshot: QuickAppHtmlStorageSnapshot, chantierName: string | null): QuickAppTaskSnapshot[] {
  const raw = findScopedEntry(snapshot.entries, "taches__", chantierName);
  return parseJsonArray(raw)
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const candidate = entry as Record<string, unknown>;
      const title = normalizeText(typeof candidate.title === "string" ? candidate.title : "");
      const description = stripSimpleHtml(typeof candidate.content === "string" ? candidate.content : "");
      const start = normalizeText(typeof candidate.start === "string" ? candidate.start : "");
      const end = normalizeText(typeof candidate.end === "string" ? candidate.end : "");
      const priority = candidate.prioritaire === true;
      if (!title && !description && !start && !end) return null;
      return {
        title: title || "Untitled task",
        description: description || null,
        start: start || null,
        end: end || null,
        priority
      } satisfies QuickAppTaskSnapshot;
    })
    .filter((entry): entry is QuickAppTaskSnapshot => entry !== null);
}

function parseResources(snapshot: QuickAppHtmlStorageSnapshot, chantierName: string | null): string[] {
  const raw = findScopedEntry(snapshot.entries, "agenda-resources__", chantierName);
  return Array.from(
    new Set(
      parseJsonArray(raw)
        .map((entry) => normalizeText(typeof entry === "string" ? entry : ""))
        .filter((entry) => entry.length > 0)
    )
  );
}

function parseDocuments(snapshot: QuickAppHtmlStorageSnapshot, chantierName: string | null): QuickAppDocumentSnapshot[] {
  const raw = findScopedEntry(snapshot.entries, "documents__", chantierName);
  return parseJsonArray(raw)
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const candidate = entry as Record<string, unknown>;
      const name = normalizeText(typeof candidate.nom === "string" ? candidate.nom : "");
      const fileName = normalizeText(typeof candidate.fichier === "string" ? candidate.fichier : "");
      if (!name && !fileName) return null;
      return {
        name: name || fileName || "Document",
        fileName: fileName || null
      } satisfies QuickAppDocumentSnapshot;
    })
    .filter((entry): entry is QuickAppDocumentSnapshot => entry !== null);
}

function formatTask(task: QuickAppTaskSnapshot): string {
  const parts = [task.title];
  if (task.priority) parts.push("priority");
  if (task.start || task.end) {
    parts.push(`window: ${task.start ?? "?"} -> ${task.end ?? "?"}`);
  }
  if (task.description) {
    parts.push(`details: ${task.description}`);
  }
  return `- ${parts.join(" | ")}`;
}

function formatDocument(document: QuickAppDocumentSnapshot): string {
  if (document.fileName && document.fileName !== document.name) {
    return `- ${document.name} | file: ${document.fileName}`;
  }
  return `- ${document.name}`;
}

function formatCapturedFields(snapshot: QuickAppHtmlStorageSnapshot): string {
  const lines = Object.entries(snapshot.fieldEntries ?? {})
    .map(([key, value]) => {
      const normalizedKey = normalizeText(key);
      const normalizedValue = normalizeText(value);
      if (!normalizedKey || !normalizedValue) return "";
      return `- ${normalizedKey}: ${normalizedValue}`;
    })
    .filter((line) => line.length > 0)
    .slice(0, 18);
  return lines.length > 0 ? ["Captured form values:", ...lines].join("\n") : "";
}

function formatGenericEntryEvidence(snapshot: QuickAppHtmlStorageSnapshot): string {
  const ignoredKeys = new Set(["chantierName__actif", "typeChantier"]);
  const lines = Object.entries(snapshot.entries)
    .filter(([key]) => !ignoredKeys.has(key))
    .map(([key, value]) => {
      const normalizedKey = normalizeText(key);
      const normalizedValue = normalizeText(value);
      if (!normalizedKey || !normalizedValue) return "";
      return `- ${normalizedKey}: ${normalizedValue}`;
    })
    .filter((line) => line.length > 0)
    .slice(0, 12);
  return lines.length > 0 ? ["Quick app stored values:", ...lines].join("\n") : "";
}

function formatVisibleText(snapshot: QuickAppHtmlStorageSnapshot): string {
  const text = truncateText(snapshot.documentText ?? "", 1100);
  return text ? `Visible page text snapshot: ${text}` : "";
}

export function formatQuickAppHtmlSnapshotEvidence(snapshot: QuickAppHtmlStorageSnapshot): string {
  const chantierName = resolveChantierName(snapshot);
  const typeChantier = normalizeText(snapshot.entries.typeChantier);
  const motif = stripSimpleHtml(findScopedEntry(snapshot.entries, "motifChantier__", chantierName));
  const objet = stripSimpleHtml(findScopedEntry(snapshot.entries, "objetChantier__", chantierName));
  const tasks = parseTasks(snapshot, chantierName);
  const resources = parseResources(snapshot, chantierName);
  const documents = parseDocuments(snapshot, chantierName);
  const capturedFields = formatCapturedFields(snapshot);
  const genericEntries = formatGenericEntryEvidence(snapshot);
  const visibleText = formatVisibleText(snapshot);

  const sections: string[] = ["Live quick-app HTML state synchronized from the rendered page."];
  if (chantierName) sections.push(`Chantier: ${chantierName}`);
  if (snapshot.ownerLabel) sections.push(`Owner scope: ${snapshot.ownerLabel}`);
  if (typeChantier) sections.push(`Type de chantier: ${typeChantier}`);
  if (motif) sections.push(`Motif: ${motif}`);
  if (objet) sections.push(`Objet / livrables / notes: ${objet}`);
  if (tasks.length > 0) {
    sections.push([`Actions / tasks (${tasks.length}):`, ...tasks.map(formatTask)].join("\n"));
  }
  if (resources.length > 0) {
    sections.push([`Teams / resources (${resources.length}):`, ...resources.map((entry) => `- ${entry}`)].join("\n"));
  }
  if (documents.length > 0) {
    sections.push([`Linked documents (${documents.length}):`, ...documents.map(formatDocument)].join("\n"));
  }
  if (capturedFields) sections.push(capturedFields);
  if (genericEntries) sections.push(genericEntries);
  if (visibleText && !(capturedFields || genericEntries || tasks.length > 0 || resources.length > 0 || documents.length > 0)) {
    sections.push(visibleText);
  }

  return sections
    .map((section) => section.trim())
    .filter((section) => section.length > 0)
    .join("\n\n")
    .trim();
}
