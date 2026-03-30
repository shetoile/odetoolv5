import { ROOT_PARENT_ID, type AppNode, type ProjectSummary } from "@/lib/types";
import { buildScopedNodeList } from "../workflows/workspaceScope";
import {
  buildDocumentKnowledgeExcerpt,
  hasStoredDocumentKnowledge,
  ingestDocumentKnowledge,
  isDocumentKnowledgeCandidate,
  type DocumentIngestionState
} from "./documents";

const OUTLINE_HINT_PATTERN =
  /^(?:\d+(?:\.\d+)*[\])\.\-:]?\s+|[ivxlcdm]+[\])\.\-:]\s+|[A-Z][A-Za-z0-9][^.!?]{0,120}:$|[-*•]\s+|[A-Z][A-Z0-9\s]{4,})/i;

export type DocumentKnowledgeSourceMode = "selected_documents" | "recent_documents";

export type KnowledgeDocumentRecord = {
  nodeId: string;
  title: string;
  kind: AppNode["type"];
  extension: string;
  sourcePath: string | null;
  ingestionState: DocumentIngestionState;
  text: string;
  excerpt: string;
  charCount: number;
  lineCount: number;
  outlineLines: string[];
  updatedAt: string;
};

export type WorkspaceSummaryRecord = {
  workspaceId: string;
  name: string;
  rootNodeIds: string[];
  selectedNodeIds: string[];
  sourceMode: DocumentKnowledgeSourceMode;
  generatedAt: string;
};

export type KnowledgeSnapshot = {
  documents: KnowledgeDocumentRecord[];
  workspace: WorkspaceSummaryRecord | null;
};

export type DocumentKnowledgeStore = {
  scopeName: string;
  sourceMode: DocumentKnowledgeSourceMode;
  snapshot: KnowledgeSnapshot;
};

export type DocumentKnowledgeSelection = {
  scopeName: string;
  sourceMode: DocumentKnowledgeSourceMode;
  scopedNodes: AppNode[];
  candidateNodes: AppNode[];
};

export function getDocumentKnowledgeScopeName(
  project: ProjectSummary | null,
  language: string
): string {
  if (project?.name) return project.name;
  if (language === "FR") return "Tous les espaces";
  if (language === "DE") return "Alle Arbeitsbereiche";
  if (language === "ES") return "Todos los espacios";
  return "All Workspaces";
}

function getDocumentKnowledgeRootNodeIds(project: ProjectSummary | null, scopedNodes: AppNode[]): string[] {
  if (project?.rootNodeId) return [project.rootNodeId];
  return scopedNodes
    .filter((node) => node.parentId === ROOT_PARENT_ID && node.type === "folder")
    .map((node) => node.id);
}

function extractOutlineLines(text: string, limit: number = 6): string[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return [];

  const preferred = lines.filter((line) => OUTLINE_HINT_PATTERN.test(line)).slice(0, limit);
  if (preferred.length > 0) return preferred;
  return lines.slice(0, limit);
}

function sortDocumentCandidates(left: AppNode, right: AppNode): number {
  const leftStored = hasStoredDocumentKnowledge(left);
  const rightStored = hasStoredDocumentKnowledge(right);
  if (leftStored !== rightStored) {
    return leftStored ? -1 : 1;
  }
  return right.updatedAt - left.updatedAt;
}

export function selectDocumentKnowledgeCandidates(args: {
  project: ProjectSummary | null;
  allNodes: AppNode[];
  selectedNodeIds: string[];
  language: string;
}): DocumentKnowledgeSelection {
  const scopedNodes = buildScopedNodeList(args.project, args.allNodes);
  const scopedNodeIdSet = new Set(scopedNodes.map((node) => node.id));
  const nodeById = new Map(args.allNodes.map((node) => [node.id, node]));
  const scopeName = getDocumentKnowledgeScopeName(args.project, args.language);

  const selectedDocumentNodes = args.selectedNodeIds
    .map((nodeId) => nodeById.get(nodeId) ?? null)
    .filter((node): node is AppNode => Boolean(node && scopedNodeIdSet.has(node.id) && isDocumentKnowledgeCandidate(node)));

  if (selectedDocumentNodes.length > 0) {
    return {
      scopeName,
      sourceMode: "selected_documents",
      scopedNodes,
      candidateNodes: selectedDocumentNodes.slice().sort(sortDocumentCandidates)
    };
  }

  return {
    scopeName,
    sourceMode: "recent_documents",
    scopedNodes,
    candidateNodes: scopedNodes.filter((node) => isDocumentKnowledgeCandidate(node)).slice().sort(sortDocumentCandidates)
  };
}

export async function buildDocumentKnowledgeStore(args: {
  project: ProjectSummary | null;
  allNodes: AppNode[];
  selectedNodeIds: string[];
  language: string;
  maxRecords?: number;
}): Promise<DocumentKnowledgeStore> {
  const selection = selectDocumentKnowledgeCandidates(args);
  const maxRecords = Math.max(1, args.maxRecords ?? 8);
  const generatedAt = new Date().toISOString();
  const selectedNodeIdSet = new Set(selection.scopedNodes.map((node) => node.id));
  const selectedNodeIds = args.selectedNodeIds.filter((nodeId) => selectedNodeIdSet.has(nodeId));

  const documents = await Promise.all(
    selection.candidateNodes.slice(0, maxRecords).map(async (node) => {
      const ingested = await ingestDocumentKnowledge(node);
      return {
        nodeId: node.id,
        title: node.name,
        kind: node.type,
        extension: ingested.extension,
        sourcePath: ingested.mirrorFilePath,
        ingestionState: ingested.ingestionState,
        text: ingested.text,
        excerpt: buildDocumentKnowledgeExcerpt(ingested.text),
        charCount: ingested.charCount,
        lineCount: ingested.lineCount,
        outlineLines: extractOutlineLines(ingested.text),
        updatedAt: new Date(node.updatedAt).toISOString()
      } satisfies KnowledgeDocumentRecord;
    })
  );

  return {
    scopeName: selection.scopeName,
    sourceMode: selection.sourceMode,
    snapshot: {
      documents,
      workspace: {
        workspaceId: args.project?.id ?? "all-workspaces",
        name: selection.scopeName,
        rootNodeIds: getDocumentKnowledgeRootNodeIds(args.project, selection.scopedNodes),
        selectedNodeIds,
        sourceMode: selection.sourceMode,
        generatedAt
      }
    }
  };
}
