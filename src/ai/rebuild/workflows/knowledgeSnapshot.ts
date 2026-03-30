import type { AppNode, ProjectSummary } from "@/lib/types";
import type { AiWorkflowDefinition, AiWorkflowRequest } from "../core/contracts";
import { buildScopedNodeList } from "./workspaceScope";

export type KnowledgeSnapshotInput = {
  project: ProjectSummary | null;
  allNodes: AppNode[];
  selectedNodeIds: string[];
};

export type KnowledgeDocumentSample = {
  nodeId: string;
  name: string;
  type: AppNode["type"];
  excerpt: string;
  hasContent: boolean;
};

export type KnowledgeSnapshotOutput = {
  scopeName: string;
  selectedNodeCount: number;
  selectedNodeNames: string[];
  documentLikeCount: number;
  contentBackedDocumentCount: number;
  taskLikeCount: number;
  ticketCount: number;
  recentNodeNames: string[];
  documentSamples: KnowledgeDocumentSample[];
  summary: string;
};

type KnowledgeSnapshotPrepared = KnowledgeSnapshotOutput;

const DOCUMENT_LIKE_TYPES = new Set<AppNode["type"]>(["document", "report", "minutes", "file"]);
const TASK_LIKE_TYPES = new Set<AppNode["type"]>(["task", "flow_step"]);

function getDefaultScopeName(language: string): string {
  if (language === "FR") return "Tous les espaces";
  if (language === "DE") return "Alle Arbeitsbereiche";
  if (language === "ES") return "Todos los espacios";
  return "All Workspaces";
}

function normalizeExcerpt(node: AppNode): string {
  const source = (node.content ?? node.description ?? "").replace(/\s+/g, " ").trim();
  if (!source) return "No indexed content yet.";
  return source.slice(0, 160);
}

function buildSummary(language: string, output: Omit<KnowledgeSnapshotOutput, "summary">): string {
  if (language === "FR") {
    const selectedPart =
      output.selectedNodeCount > 0
        ? `${output.selectedNodeCount} noeud(s) selectionne(s)`
        : "aucun noeud selectionne";
    return `Instantane de connaissance pour "${output.scopeName}": ${output.contentBackedDocumentCount}/${output.documentLikeCount} documents avec contenu, ${output.taskLikeCount} noeuds tache, ${output.ticketCount} tickets, ${selectedPart}.`;
  }
  if (language === "DE") {
    const selectedPart =
      output.selectedNodeCount > 0
        ? `${output.selectedNodeCount} ausgewaehlte Knoten`
        : "keine ausgewaehlten Knoten";
    return `Wissenssnapshot fuer "${output.scopeName}": ${output.contentBackedDocumentCount}/${output.documentLikeCount} Dokumente mit Inhalt, ${output.taskLikeCount} Aufgabenknoten, ${output.ticketCount} Tickets, ${selectedPart}.`;
  }
  if (language === "ES") {
    const selectedPart =
      output.selectedNodeCount > 0
        ? `${output.selectedNodeCount} nodo(s) seleccionado(s)`
        : "ningun nodo seleccionado";
    return `Instantanea de conocimiento para "${output.scopeName}": ${output.contentBackedDocumentCount}/${output.documentLikeCount} documentos con contenido, ${output.taskLikeCount} nodos de tarea, ${output.ticketCount} tickets, ${selectedPart}.`;
  }
  const selectedPart =
    output.selectedNodeCount > 0 ? `${output.selectedNodeCount} selected node(s)` : "no selected nodes";
  return `Knowledge snapshot for "${output.scopeName}": ${output.contentBackedDocumentCount}/${output.documentLikeCount} documents with content, ${output.taskLikeCount} task nodes, ${output.ticketCount} tickets, ${selectedPart}.`;
}

function prepareKnowledgeSnapshot(
  request: AiWorkflowRequest<KnowledgeSnapshotInput>
): KnowledgeSnapshotPrepared {
  const scopedNodes = buildScopedNodeList(request.input.project, request.input.allNodes);
  const nodeById = new Map(request.input.allNodes.map((node) => [node.id, node]));
  const documentLikeNodes = scopedNodes.filter((node) => DOCUMENT_LIKE_TYPES.has(node.type));
  const contentBackedDocumentNodes = documentLikeNodes.filter((node) => Boolean((node.content ?? node.description ?? "").trim()));
  const selectedNodes = request.input.selectedNodeIds
    .map((nodeId) => nodeById.get(nodeId) ?? null)
    .filter((node): node is AppNode => Boolean(node));
  const documentSamples = documentLikeNodes
    .slice()
    .sort((left, right) => {
      const leftHasContent = Boolean((left.content ?? left.description ?? "").trim());
      const rightHasContent = Boolean((right.content ?? right.description ?? "").trim());
      if (leftHasContent !== rightHasContent) return rightHasContent ? 1 : -1;
      return right.updatedAt - left.updatedAt;
    })
    .slice(0, 5)
    .map((node) => ({
      nodeId: node.id,
      name: node.name,
      type: node.type,
      excerpt: normalizeExcerpt(node),
      hasContent: Boolean((node.content ?? node.description ?? "").trim())
    }));
  const recentNodeNames = scopedNodes
    .slice()
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, 5)
    .map((node) => node.name);

  const base = {
    scopeName: request.input.project?.name ?? getDefaultScopeName(request.context.language),
    selectedNodeCount: selectedNodes.length,
    selectedNodeNames: selectedNodes.map((node) => node.name),
    documentLikeCount: documentLikeNodes.length,
    contentBackedDocumentCount: contentBackedDocumentNodes.length,
    taskLikeCount: scopedNodes.filter((node) => TASK_LIKE_TYPES.has(node.type)).length,
    ticketCount: scopedNodes.filter((node) => node.type === "ticket").length,
    recentNodeNames,
    documentSamples
  };

  return {
    ...base,
    summary: buildSummary(request.context.language, base)
  };
}

export const knowledgeSnapshotWorkflow: AiWorkflowDefinition<
  KnowledgeSnapshotInput,
  KnowledgeSnapshotPrepared,
  KnowledgeSnapshotOutput
> = {
  id: "knowledge_snapshot",
  prepare(request) {
    return prepareKnowledgeSnapshot(request);
  },
  async execute({ prepared }) {
    return {
      workflowId: "knowledge_snapshot",
      output: prepared,
      warnings: [],
      requiresApproval: false
    };
  }
};
