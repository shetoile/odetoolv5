import type { AppNode, ProjectSummary } from "@/lib/types";
import type { AiWorkflowDefinition, AiWorkflowRequest } from "../core/contracts";
import {
  buildDocumentKnowledgeExcerpt,
  ingestDocumentKnowledge,
  type DocumentIngestionState
} from "../knowledge/documents";
import { selectDocumentKnowledgeCandidates } from "../knowledge";

const MAX_DOCUMENT_INGESTION_ITEMS = 5;

export type DocumentIngestionPreviewInput = {
  project: ProjectSummary | null;
  allNodes: AppNode[];
  selectedNodeIds: string[];
};

export type DocumentIngestionPreviewItem = {
  nodeId: string;
  name: string;
  type: AppNode["type"];
  extension: string;
  hasFilePath: boolean;
  ingestionState: DocumentIngestionState;
  charCount: number;
  lineCount: number;
  excerpt: string;
};

export type DocumentIngestionPreviewOutput = {
  scopeName: string;
  sourceMode: "selected_documents" | "recent_documents";
  candidateCount: number;
  inspectedCount: number;
  indexedCount: number;
  descriptionCount: number;
  extractedCount: number;
  blockedCount: number;
  items: DocumentIngestionPreviewItem[];
  summary: string;
};

type DocumentIngestionPreviewPrepared = DocumentIngestionPreviewOutput;

function buildSummary(
  language: string,
  output: Omit<DocumentIngestionPreviewOutput, "summary">
): string {
  const modeLabel =
    output.sourceMode === "selected_documents"
      ? language === "FR"
        ? "documents selectionnes"
        : language === "DE"
          ? "ausgewaehlte Dokumente"
          : language === "ES"
            ? "documentos seleccionados"
            : "selected documents"
      : language === "FR"
        ? "documents recents"
        : language === "DE"
          ? "aktuelle Dokumente"
          : language === "ES"
            ? "documentos recientes"
            : "recent documents";

  if (language === "FR") {
    return `Apercu d'ingestion pour "${output.scopeName}": ${output.inspectedCount}/${output.candidateCount} ${modeLabel} inspectes, ${output.indexedCount} deja indexes, ${output.descriptionCount} via description, ${output.extractedCount} extraits maintenant, ${output.blockedCount} bloques.`;
  }
  if (language === "DE") {
    return `Ingestionsvorschau fuer "${output.scopeName}": ${output.inspectedCount}/${output.candidateCount} ${modeLabel} geprueft, ${output.indexedCount} bereits indiziert, ${output.descriptionCount} ueber Beschreibung, ${output.extractedCount} jetzt extrahiert, ${output.blockedCount} blockiert.`;
  }
  if (language === "ES") {
    return `Vista previa de ingesta para "${output.scopeName}": ${output.inspectedCount}/${output.candidateCount} ${modeLabel} inspeccionados, ${output.indexedCount} ya indexados, ${output.descriptionCount} por descripcion, ${output.extractedCount} extraidos ahora, ${output.blockedCount} bloqueados.`;
  }
  return `Document ingestion preview for "${output.scopeName}": inspected ${output.inspectedCount}/${output.candidateCount} ${modeLabel}, ${output.indexedCount} already indexed, ${output.descriptionCount} description-backed, ${output.extractedCount} extracted now, ${output.blockedCount} blocked.`;
}

function selectDocumentCandidates(
  request: AiWorkflowRequest<DocumentIngestionPreviewInput>
): {
  scopeName: string;
  sourceMode: DocumentIngestionPreviewOutput["sourceMode"];
  candidateNodes: AppNode[];
} {
  const selection = selectDocumentKnowledgeCandidates({
    project: request.input.project,
    allNodes: request.input.allNodes,
    selectedNodeIds: request.input.selectedNodeIds,
    language: request.context.language
  });
  return {
    scopeName: selection.scopeName,
    sourceMode: selection.sourceMode,
    candidateNodes: selection.candidateNodes
  };
}

async function prepareDocumentIngestionPreview(
  request: AiWorkflowRequest<DocumentIngestionPreviewInput>
): Promise<DocumentIngestionPreviewPrepared> {
  const { scopeName, sourceMode, candidateNodes } = selectDocumentCandidates(request);
  const inspectedNodes = candidateNodes.slice(0, MAX_DOCUMENT_INGESTION_ITEMS);
  const ingested = await Promise.all(inspectedNodes.map((node) => ingestDocumentKnowledge(node)));

  const items = ingested.map((entry) => ({
    nodeId: entry.nodeId,
    name: entry.name,
    type: entry.type,
    extension: entry.extension,
    hasFilePath: Boolean(entry.mirrorFilePath),
    ingestionState: entry.ingestionState,
    charCount: entry.charCount,
    lineCount: entry.lineCount,
    excerpt: buildDocumentKnowledgeExcerpt(entry.text)
  }));

  const base = {
    scopeName,
    sourceMode,
    candidateCount: candidateNodes.length,
    inspectedCount: items.length,
    indexedCount: items.filter((item) => item.ingestionState === "indexed").length,
    descriptionCount: items.filter((item) => item.ingestionState === "description_only").length,
    extractedCount: items.filter((item) => item.ingestionState === "extracted_now").length,
    blockedCount: items.filter((item) => item.ingestionState === "no_file_path" || item.ingestionState === "unreadable").length,
    items
  };

  return {
    ...base,
    summary: buildSummary(request.context.language, base)
  };
}

export const documentIngestionPreviewWorkflow: AiWorkflowDefinition<
  DocumentIngestionPreviewInput,
  DocumentIngestionPreviewPrepared,
  DocumentIngestionPreviewOutput
> = {
  id: "document_ingestion_preview",
  async prepare(request) {
    return prepareDocumentIngestionPreview(request);
  },
  async execute({ prepared }) {
    return {
      workflowId: "document_ingestion_preview",
      output: prepared,
      warnings: [],
      requiresApproval: false
    };
  }
};
