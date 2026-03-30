import type { AppNode, ProjectSummary } from "@/lib/types";
import type { AiWorkflowDefinition, AiWorkflowRequest } from "../core/contracts";
import {
  buildWorkspaceKnowledgeSummary,
  type DocumentKnowledgeSourceMode,
  type KnowledgeSummaryStat
} from "../knowledge";

const MAX_WORKSPACE_KNOWLEDGE_RECORDS = 8;

export type WorkspaceKnowledgeSummaryInput = {
  project: ProjectSummary | null;
  allNodes: AppNode[];
  selectedNodeIds: string[];
};

export type WorkspaceKnowledgeSummaryOutput = {
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
  summary: string;
};

type WorkspaceKnowledgeSummaryPrepared = WorkspaceKnowledgeSummaryOutput;

function buildSummary(
  language: string,
  output: Omit<WorkspaceKnowledgeSummaryOutput, "summary">
): string {
  if (language === "FR") {
    return `Resume de connaissance pour "${output.scopeName}": ${output.recordCount} documents normalises, ${output.indexedReadyCount} prets, ${output.blockedCount} bloques, moyenne ${output.averageCharCount} caracteres par document.`;
  }
  if (language === "DE") {
    return `Wissensueberblick fuer "${output.scopeName}": ${output.recordCount} normalisierte Dokumente, ${output.indexedReadyCount} bereit, ${output.blockedCount} blockiert, durchschnittlich ${output.averageCharCount} Zeichen pro Dokument.`;
  }
  if (language === "ES") {
    return `Resumen de conocimiento para "${output.scopeName}": ${output.recordCount} documentos normalizados, ${output.indexedReadyCount} listos, ${output.blockedCount} bloqueados, media de ${output.averageCharCount} caracteres por documento.`;
  }
  return `Workspace knowledge summary for "${output.scopeName}": ${output.recordCount} normalized documents, ${output.indexedReadyCount} ready, ${output.blockedCount} blocked, average ${output.averageCharCount} characters per document.`;
}

async function prepareWorkspaceKnowledgeSummary(
  request: AiWorkflowRequest<WorkspaceKnowledgeSummaryInput>
): Promise<WorkspaceKnowledgeSummaryPrepared> {
  const summary = await buildWorkspaceKnowledgeSummary({
    project: request.input.project,
    allNodes: request.input.allNodes,
    selectedNodeIds: request.input.selectedNodeIds,
    language: request.context.language,
    maxRecords: MAX_WORKSPACE_KNOWLEDGE_RECORDS
  });

  const base = {
    scopeName: summary.scopeName,
    sourceMode: summary.sourceMode,
    recordCount: summary.recordCount,
    indexedReadyCount: summary.indexedReadyCount,
    blockedCount: summary.blockedCount,
    averageCharCount: summary.averageCharCount,
    topExtensions: summary.topExtensions,
    outlineTopics: summary.outlineTopics,
    recentDocumentTitles: summary.recentDocumentTitles,
    signals: summary.signals,
    generatedAt: summary.generatedAt
  };

  return {
    ...base,
    summary: buildSummary(request.context.language, base)
  };
}

export const workspaceKnowledgeSummaryWorkflow: AiWorkflowDefinition<
  WorkspaceKnowledgeSummaryInput,
  WorkspaceKnowledgeSummaryPrepared,
  WorkspaceKnowledgeSummaryOutput
> = {
  id: "workspace_knowledge_summary",
  async prepare(request) {
    return prepareWorkspaceKnowledgeSummary(request);
  },
  async execute({ prepared }) {
    return {
      workflowId: "workspace_knowledge_summary",
      output: prepared,
      warnings: [],
      requiresApproval: false
    };
  }
};
