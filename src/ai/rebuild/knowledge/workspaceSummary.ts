import { buildDocumentKnowledgeStore, type DocumentKnowledgeSourceMode } from "./documentStore";

export type KnowledgeSummaryStat = {
  label: string;
  count: number;
};

export type WorkspaceKnowledgeSummary = {
  scopeName: string;
  sourceMode: DocumentKnowledgeSourceMode;
  recordCount: number;
  indexedReadyCount: number;
  blockedCount: number;
  averageCharCount: number;
  topExtensions: KnowledgeSummaryStat[];
  outlineTopics: string[];
  recentDocumentTitles: string[];
  signals: string[];
  generatedAt: string | null;
};

function trimNumberingPrefix(value: string): string {
  return value
    .replace(/^\d+(?:\.\d+)*[\])\.\-:]?\s*/u, "")
    .replace(/^[ivxlcdm]+[\])\.\-:]\s*/iu, "")
    .replace(/^[-*]\s+/u, "")
    .trim();
}

function countTopExtensions(values: string[]): KnowledgeSummaryStat[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value.trim().toLowerCase() || "none";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return left[0].localeCompare(right[0]);
    })
    .slice(0, 5)
    .map(([label, count]) => ({ label: label === "none" ? "-" : label.toUpperCase(), count }));
}

function collectTopOutlineTopics(lines: string[]): string[] {
  const counts = new Map<string, number>();
  for (const line of lines) {
    const topic = trimNumberingPrefix(line).replace(/\s+/g, " ").trim();
    if (!topic) continue;
    counts.set(topic, (counts.get(topic) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return left[0].localeCompare(right[0]);
    })
    .slice(0, 6)
    .map(([topic]) => topic);
}

function buildSignals(args: {
  language: string;
  recordCount: number;
  indexedReadyCount: number;
  blockedCount: number;
  averageCharCount: number;
  extensionCount: number;
  outlineTopicCount: number;
}): string[] {
  const signals: string[] = [];
  if (args.recordCount === 0) {
    if (args.language === "FR") return ["Aucun document normalise n'est encore disponible."];
    if (args.language === "DE") return ["Noch keine normalisierten Dokumente verfuegbar."];
    if (args.language === "ES") return ["Todavia no hay documentos normalizados disponibles."];
    return ["No normalized documents are available yet."];
  }

  if (args.indexedReadyCount >= Math.max(1, Math.ceil(args.recordCount * 0.7))) {
    if (args.language === "FR") {
      signals.push("La plupart des documents visibles sont prets pour les prochains workflows.");
    } else if (args.language === "DE") {
      signals.push("Die meisten sichtbaren Dokumente sind fuer Folge-Workflows bereit.");
    } else if (args.language === "ES") {
      signals.push("La mayoria de los documentos visibles ya esta lista para los siguientes flujos.");
    } else {
      signals.push("Most visible documents are ready for downstream workflows.");
    }
  }

  if (args.blockedCount > 0) {
    if (args.language === "FR") {
      signals.push("Certains documents restent bloques et auront besoin d'une extraction fiable.");
    } else if (args.language === "DE") {
      signals.push("Einige Dokumente sind noch blockiert und brauchen eine verlaessliche Extraktion.");
    } else if (args.language === "ES") {
      signals.push("Algunos documentos siguen bloqueados y necesitaran una extraccion fiable.");
    } else {
      signals.push("Some documents are still blocked and need reliable extraction.");
    }
  }

  if (args.outlineTopicCount >= 3) {
    if (args.language === "FR") {
      signals.push("La structure documentaire est assez riche pour produire des resumes thematiques.");
    } else if (args.language === "DE") {
      signals.push("Die Dokumentstruktur ist reich genug fuer thematische Zusammenfassungen.");
    } else if (args.language === "ES") {
      signals.push("La estructura documental es lo bastante rica para generar resumenes tematicos.");
    } else {
      signals.push("Document structure is rich enough for thematic summaries.");
    }
  }

  if (args.extensionCount >= 3) {
    if (args.language === "FR") {
      signals.push("Le savoir vient de plusieurs formats de fichiers, pas d'une seule source.");
    } else if (args.language === "DE") {
      signals.push("Das Wissen kommt aus mehreren Dateiformaten statt aus nur einer Quelle.");
    } else if (args.language === "ES") {
      signals.push("El conocimiento proviene de varios formatos de archivo, no de una sola fuente.");
    } else {
      signals.push("Knowledge comes from multiple file formats, not a single source.");
    }
  }

  if (args.averageCharCount >= 2500) {
    if (args.language === "FR") {
      signals.push("Le corpus actuel contient deja des documents de reference assez longs.");
    } else if (args.language === "DE") {
      signals.push("Der aktuelle Bestand enthaelt bereits laengere Referenzdokumente.");
    } else if (args.language === "ES") {
      signals.push("El corpus actual ya contiene documentos de referencia relativamente largos.");
    } else {
      signals.push("The current corpus already contains fairly long reference documents.");
    }
  }

  return signals;
}

export async function buildWorkspaceKnowledgeSummary(args: {
  project: Parameters<typeof buildDocumentKnowledgeStore>[0]["project"];
  allNodes: Parameters<typeof buildDocumentKnowledgeStore>[0]["allNodes"];
  selectedNodeIds: Parameters<typeof buildDocumentKnowledgeStore>[0]["selectedNodeIds"];
  language: string;
  maxRecords?: number;
}): Promise<WorkspaceKnowledgeSummary> {
  const store = await buildDocumentKnowledgeStore(args);
  const records = store.snapshot.documents;
  const indexedReadyCount = records.filter(
    (record) => record.ingestionState === "indexed" || record.ingestionState === "extracted_now"
  ).length;
  const blockedCount = records.filter(
    (record) => record.ingestionState === "no_file_path" || record.ingestionState === "unreadable"
  ).length;
  const totalChars = records.reduce((sum, record) => sum + record.charCount, 0);
  const averageCharCount = records.length > 0 ? Math.round(totalChars / records.length) : 0;
  const topExtensions = countTopExtensions(records.map((record) => record.extension));
  const outlineTopics = collectTopOutlineTopics(records.flatMap((record) => record.outlineLines));
  const recentDocumentTitles = records
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 5)
    .map((record) => record.title);

  return {
    scopeName: store.scopeName,
    sourceMode: store.sourceMode,
    recordCount: records.length,
    indexedReadyCount,
    blockedCount,
    averageCharCount,
    topExtensions,
    outlineTopics,
    recentDocumentTitles,
    signals: buildSignals({
      language: args.language,
      recordCount: records.length,
      indexedReadyCount,
      blockedCount,
      averageCharCount,
      extensionCount: topExtensions.length,
      outlineTopicCount: outlineTopics.length
    }),
    generatedAt: store.snapshot.workspace?.generatedAt ?? null
  };
}
