import { ROOT_PARENT_ID, type AppNode, type ProjectSummary } from "@/lib/types";
import { buildWorkspaceMetaModel, type MetaCapability, type MetaViewKind } from "@/lib/metaEngine";
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
  emptyWorkspace: boolean;
  meaningfulNodeCount: number;
  tableCount: number;
  fieldCount: number;
  executionOwnerCount: number;
  executionItemCount: number;
  scheduledNodeCount: number;
  dashboardCount: number;
  dashboardWidgetCount: number;
  capabilityCounts: Record<MetaCapability, number>;
  activeViews: MetaViewKind[];
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
    tickets: output.ticketCount,
    meaningful: output.meaningfulNodeCount,
    views: output.activeViews
  };

  const viewLabel = base.views.length > 0 ? base.views.join(", ") : "none";

  if (output.emptyWorkspace) {
    if (language === "FR") {
      return `L'espace "${base.name}" est vide. Aucun objet admin n'est encore defini. Le meta-engine est pret pour que l'administrateur cree les premieres racines, modeles, vues, et automatisations.`;
    }
    if (language === "DE") {
      return `Der Bereich "${base.name}" ist leer. Es wurden noch keine Admin-Objekte definiert. Die Meta-Engine ist bereit, damit der Administrator erste Wurzeln, Modelle, Ansichten und Automationen anlegt.`;
    }
    if (language === "ES") {
      return `El espacio "${base.name}" esta vacio. Aun no hay objetos definidos por el administrador. El meta-motor esta listo para que el administrador cree las primeras raices, modelos, vistas y automatizaciones.`;
    }
    return `Workspace "${base.name}" is empty. No admin-defined objects exist yet. The meta-engine is ready for the administrator to create the first roots, models, views, and automations.`;
  }

  if (language === "FR") {
    return `L'espace "${base.name}" contient ${base.meaningful} objets admin sur ${base.depth} niveaux (${base.total} noeuds au total). Dossiers: ${base.folders}, documents: ${base.documents}, fichiers: ${base.files}, taches: ${base.tasks}, tickets: ${base.tickets}. Vues actives: ${viewLabel}.`;
  }
  if (language === "DE") {
    return `Der Bereich "${base.name}" enthaelt ${base.meaningful} Admin-Objekte ueber ${base.depth} Ebenen (${base.total} Knoten insgesamt). Ordner: ${base.folders}, Dokumente: ${base.documents}, Dateien: ${base.files}, Aufgaben: ${base.tasks}, Tickets: ${base.tickets}. Aktive Ansichten: ${viewLabel}.`;
  }
  if (language === "ES") {
    return `El espacio "${base.name}" contiene ${base.meaningful} objetos definidos por el administrador en ${base.depth} niveles (${base.total} nodos en total). Carpetas: ${base.folders}, documentos: ${base.documents}, archivos: ${base.files}, tareas: ${base.tasks}, tickets: ${base.tickets}. Vistas activas: ${viewLabel}.`;
  }
  return `Workspace "${base.name}" contains ${base.meaningful} admin-defined objects across ${base.depth} levels (${base.total} total nodes). Folders: ${base.folders}, documents: ${base.documents}, files: ${base.files}, tasks: ${base.tasks}, tickets: ${base.tickets}. Active views: ${viewLabel}.`;
}

function prepareWorkspaceOverview(
  request: AiWorkflowRequest<WorkspaceOverviewInput>
): WorkspaceOverviewPrepared {
  const scopedNodes = buildScopedNodeList(request.input.project, request.input.allNodes);
  const meta = buildWorkspaceMetaModel({
    nodes: scopedNodes,
    activeProjectRootId: request.input.project?.rootNodeId ?? null
  });
  const activeViews = (Object.entries(meta.viewAvailability) as Array<[MetaViewKind, boolean]>)
    .filter(([, enabled]) => enabled)
    .map(([view]) => view);
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
    maxDepth: computeMaxDepth(scopedNodes),
    emptyWorkspace: meta.emptyWorkspace,
    meaningfulNodeCount: meta.meaningfulNodeCount,
    tableCount: meta.tableCount,
    fieldCount: meta.fieldCount,
    executionOwnerCount: meta.executionOwnerCount,
    executionItemCount: meta.executionItemCount,
    scheduledNodeCount: meta.scheduledNodeCount,
    dashboardCount: meta.dashboardCount,
    dashboardWidgetCount: meta.dashboardWidgetCount,
    capabilityCounts: meta.capabilityCounts,
    activeViews
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
