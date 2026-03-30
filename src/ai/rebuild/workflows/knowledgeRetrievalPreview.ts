import type { AppNode, ProjectSummary } from "@/lib/types";
import type { AiWorkflowDefinition, AiWorkflowRequest } from "../core/contracts";
import { buildKnowledgeRetrievalPreview, type KnowledgeRetrievalPreview } from "../knowledge";

const MAX_RETRIEVAL_RECORDS = 12;

export type KnowledgeRetrievalPreviewInput = {
  project: ProjectSummary | null;
  allNodes: AppNode[];
  selectedNodeIds: string[];
  query: string;
};

export type KnowledgeRetrievalPreviewOutput = {
  scopeName: string;
  sourceMode: KnowledgeRetrievalPreview["sourceMode"];
  query: string;
  querySource: KnowledgeRetrievalPreview["querySource"];
  matchedDocumentCount: number;
  matchedSignalCount: number;
  matchedOutlineTopicCount: number;
  matchedExtensionCount: number;
  documentMatches: KnowledgeRetrievalPreview["documentMatches"];
  matchedOutlineTopics: string[];
  matchedExtensions: string[];
  matchedSignals: string[];
  generatedAt: string | null;
  summary: string;
};

type KnowledgeRetrievalPreviewPrepared = KnowledgeRetrievalPreviewOutput;

function buildSummary(
  language: string,
  output: Omit<KnowledgeRetrievalPreviewOutput, "summary">
): string {
  if (language === "FR") {
    return `Recherche de connaissance pour "${output.scopeName}" avec "${output.query}": ${output.matchedDocumentCount} documents, ${output.matchedOutlineTopicCount} themes, ${output.matchedSignalCount} signaux.`; 
  }
  if (language === "DE") {
    return `Wissensabfrage fuer "${output.scopeName}" mit "${output.query}": ${output.matchedDocumentCount} Dokumente, ${output.matchedOutlineTopicCount} Themen, ${output.matchedSignalCount} Signale.`;
  }
  if (language === "ES") {
    return `Consulta de conocimiento para "${output.scopeName}" con "${output.query}": ${output.matchedDocumentCount} documentos, ${output.matchedOutlineTopicCount} temas, ${output.matchedSignalCount} senales.`;
  }
  return `Knowledge retrieval for "${output.scopeName}" using "${output.query}": ${output.matchedDocumentCount} documents, ${output.matchedOutlineTopicCount} topics, ${output.matchedSignalCount} signals.`;
}

async function prepareKnowledgeRetrievalPreview(
  request: AiWorkflowRequest<KnowledgeRetrievalPreviewInput>
): Promise<KnowledgeRetrievalPreviewPrepared> {
  const preview = await buildKnowledgeRetrievalPreview({
    project: request.input.project,
    allNodes: request.input.allNodes,
    selectedNodeIds: request.input.selectedNodeIds,
    language: request.context.language,
    query: request.input.query,
    maxRecords: MAX_RETRIEVAL_RECORDS
  });

  const base = {
    scopeName: preview.scopeName,
    sourceMode: preview.sourceMode,
    query: preview.query,
    querySource: preview.querySource,
    matchedDocumentCount: preview.documentMatches.length,
    matchedSignalCount: preview.matchedSignals.length,
    matchedOutlineTopicCount: preview.matchedOutlineTopics.length,
    matchedExtensionCount: preview.matchedExtensions.length,
    documentMatches: preview.documentMatches,
    matchedOutlineTopics: preview.matchedOutlineTopics,
    matchedExtensions: preview.matchedExtensions,
    matchedSignals: preview.matchedSignals,
    generatedAt: preview.generatedAt
  };

  return {
    ...base,
    summary: buildSummary(request.context.language, base)
  };
}

export const knowledgeRetrievalPreviewWorkflow: AiWorkflowDefinition<
  KnowledgeRetrievalPreviewInput,
  KnowledgeRetrievalPreviewPrepared,
  KnowledgeRetrievalPreviewOutput
> = {
  id: "knowledge_retrieval_preview",
  async prepare(request) {
    return prepareKnowledgeRetrievalPreview(request);
  },
  async execute({ prepared }) {
    return {
      workflowId: "knowledge_retrieval_preview",
      output: prepared,
      warnings: [],
      requiresApproval: false
    };
  }
};
