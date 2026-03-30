import type { AppNode, ProjectSummary } from "@/lib/types";
import type { AiWorkflowDefinition, AiWorkflowRequest } from "../core/contracts";
import {
  buildDocumentKnowledgeStore,
  type DocumentKnowledgeSourceMode,
  type KnowledgeSnapshot
} from "../knowledge";

const MAX_DOCUMENT_STORE_RECORDS = 8;

export type DocumentRecordStoreInput = {
  project: ProjectSummary | null;
  allNodes: AppNode[];
  selectedNodeIds: string[];
};

export type DocumentRecordStoreOutput = {
  scopeName: string;
  sourceMode: DocumentKnowledgeSourceMode;
  recordCount: number;
  indexedCount: number;
  extractedCount: number;
  blockedCount: number;
  outlineReadyCount: number;
  snapshot: KnowledgeSnapshot;
  summary: string;
};

type DocumentRecordStorePrepared = DocumentRecordStoreOutput;

function buildSummary(
  language: string,
  output: Omit<DocumentRecordStoreOutput, "summary">
): string {
  if (language === "FR") {
    return `Magasin de documents pour "${output.scopeName}": ${output.recordCount} enregistrements normalises, ${output.indexedCount} indexes, ${output.extractedCount} extraits maintenant, ${output.outlineReadyCount} avec lignes de structure, ${output.blockedCount} bloques.`;
  }
  if (language === "DE") {
    return `Dokumentenspeicher fuer "${output.scopeName}": ${output.recordCount} normalisierte Eintraege, ${output.indexedCount} indiziert, ${output.extractedCount} jetzt extrahiert, ${output.outlineReadyCount} mit Gliederungszeilen, ${output.blockedCount} blockiert.`;
  }
  if (language === "ES") {
    return `Almacen documental para "${output.scopeName}": ${output.recordCount} registros normalizados, ${output.indexedCount} indexados, ${output.extractedCount} extraidos ahora, ${output.outlineReadyCount} con lineas de estructura, ${output.blockedCount} bloqueados.`;
  }
  return `Document record store for "${output.scopeName}": ${output.recordCount} normalized records, ${output.indexedCount} indexed, ${output.extractedCount} extracted now, ${output.outlineReadyCount} with outline lines, ${output.blockedCount} blocked.`;
}

async function prepareDocumentRecordStore(
  request: AiWorkflowRequest<DocumentRecordStoreInput>
): Promise<DocumentRecordStorePrepared> {
  const store = await buildDocumentKnowledgeStore({
    project: request.input.project,
    allNodes: request.input.allNodes,
    selectedNodeIds: request.input.selectedNodeIds,
    language: request.context.language,
    maxRecords: MAX_DOCUMENT_STORE_RECORDS
  });

  const records = store.snapshot.documents;
  const base = {
    scopeName: store.scopeName,
    sourceMode: store.sourceMode,
    recordCount: records.length,
    indexedCount: records.filter((record) => record.ingestionState === "indexed").length,
    extractedCount: records.filter((record) => record.ingestionState === "extracted_now").length,
    blockedCount: records.filter(
      (record) => record.ingestionState === "no_file_path" || record.ingestionState === "unreadable"
    ).length,
    outlineReadyCount: records.filter((record) => record.outlineLines.length > 0).length,
    snapshot: store.snapshot
  };

  return {
    ...base,
    summary: buildSummary(request.context.language, base)
  };
}

export const documentRecordStoreWorkflow: AiWorkflowDefinition<
  DocumentRecordStoreInput,
  DocumentRecordStorePrepared,
  DocumentRecordStoreOutput
> = {
  id: "document_record_store",
  async prepare(request) {
    return prepareDocumentRecordStore(request);
  },
  async execute({ prepared }) {
    return {
      workflowId: "document_record_store",
      output: prepared,
      warnings: [],
      requiresApproval: false
    };
  }
};
