import { ROOT_PARENT_ID, type AppNode, type ProjectSummary } from "@/lib/types";
import type { AiWorkflowDefinition, AiWorkflowRequest } from "../core/contracts";
import { buildScopedNodeList } from "./workspaceScope";

export type WorkspaceOverviewInput = {
  project: ProjectSummary | null;
  allNodes: AppNode[];
};

export type WorkspaceOverviewOutput = {
  scopeName: string;
  totalNodes: number;
  folderCount: number;
  documentCount: number;
  fileCount: number;
  taskCount: number;
  ticketCount: number;
  maxDepth: number;
  summary: string;
};

type WorkspaceOverviewPrepared = WorkspaceOverviewOutput;

function getDefaultScopeName(language: string): string {
  if (language === "FR") return "Tous les espaces";
  if (language === "DE") return "Alle Arbeitsbereiche";
  if (language === "ES") return "Todos los espacios";
  return "All Workspaces";
}

function countByType(nodes: AppNode[], type: AppNode["type"]): number {
  return nodes.filter((node) => node.type === type).length;
}

function computeMaxDepth(nodes: AppNode[]): number {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const depthMemo = new Map<string, number>();

  const getDepth = (node: AppNode): number => {
    const memoized = depthMemo.get(node.id);
    if (memoized) return memoized;
    if (node.parentId === ROOT_PARENT_ID || !nodeById.has(node.parentId)) {
      depthMemo.set(node.id, 1);
      return 1;
    }
    const parent = nodeById.get(node.parentId);
    const depth = parent ? getDepth(parent) + 1 : 1;
    depthMemo.set(node.id, depth);
    return depth;
  };

  return nodes.reduce((maxDepth, node) => Math.max(maxDepth, getDepth(node)), 0);
}

function buildSummary(language: string, output: Omit<WorkspaceOverviewOutput, "summary">): string {
  const base = {
    name: output.scopeName,
    total: output.totalNodes,
    depth: output.maxDepth,
    folders: output.folderCount,
    documents: output.documentCount,
    files: output.fileCount,
    tasks: output.taskCount,
    tickets: output.ticketCount
  };

  if (language === "FR") {
    return `L'espace "${base.name}" contient actuellement ${base.total} noeuds sur ${base.depth} niveaux. Dossiers: ${base.folders}, documents: ${base.documents}, fichiers: ${base.files}, taches: ${base.tasks}, tickets: ${base.tickets}.`;
  }
  if (language === "DE") {
    return `Der Bereich "${base.name}" enthaelt aktuell ${base.total} Knoten ueber ${base.depth} Ebenen. Ordner: ${base.folders}, Dokumente: ${base.documents}, Dateien: ${base.files}, Aufgaben: ${base.tasks}, Tickets: ${base.tickets}.`;
  }
  if (language === "ES") {
    return `El espacio "${base.name}" contiene actualmente ${base.total} nodos en ${base.depth} niveles. Carpetas: ${base.folders}, documentos: ${base.documents}, archivos: ${base.files}, tareas: ${base.tasks}, tickets: ${base.tickets}.`;
  }
  return `Workspace "${base.name}" currently contains ${base.total} nodes across ${base.depth} levels. Folders: ${base.folders}, documents: ${base.documents}, files: ${base.files}, tasks: ${base.tasks}, tickets: ${base.tickets}.`;
}

function prepareWorkspaceOverview(
  request: AiWorkflowRequest<WorkspaceOverviewInput>
): WorkspaceOverviewPrepared {
  const scopedNodes = buildScopedNodeList(request.input.project, request.input.allNodes);
  const base = {
    scopeName: request.input.project?.name ?? getDefaultScopeName(request.context.language),
    totalNodes: scopedNodes.length,
    folderCount: countByType(scopedNodes, "folder"),
    documentCount: scopedNodes.filter((node) =>
      node.type === "document" || node.type === "report" || node.type === "minutes"
    ).length,
    fileCount: countByType(scopedNodes, "file"),
    taskCount: countByType(scopedNodes, "task") + countByType(scopedNodes, "flow_step"),
    ticketCount: countByType(scopedNodes, "ticket"),
    maxDepth: computeMaxDepth(scopedNodes)
  };

  return {
    ...base,
    summary: buildSummary(request.context.language, base)
  };
}

export const workspaceOverviewWorkflow: AiWorkflowDefinition<
  WorkspaceOverviewInput,
  WorkspaceOverviewPrepared,
  WorkspaceOverviewOutput
> = {
  id: "workspace_overview",
  prepare(request) {
    return prepareWorkspaceOverview(request);
  },
  async execute({ prepared }) {
    return {
      workflowId: "workspace_overview",
      output: prepared,
      warnings: [],
      requiresApproval: false
    };
  }
};
