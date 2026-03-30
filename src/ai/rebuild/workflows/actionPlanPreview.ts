import type { AppNode, ProjectSummary } from "@/lib/types";
import type { AiWorkflowDefinition, AiWorkflowRequest } from "../core/contracts";
import { buildWorkspaceActionPlan, type ActionPlanProposal, type WorkspaceActionPlan } from "../knowledge";

const MAX_ACTION_PLAN_RECORDS = 12;

export type ActionPlanPreviewInput = {
  project: ProjectSummary | null;
  allNodes: AppNode[];
  selectedNodeIds: string[];
  focus: string;
};

export type ActionPlanPreviewOutput = {
  scopeName: string;
  focus: string;
  focusSource: WorkspaceActionPlan["focusSource"];
  proposalCount: number;
  highConfidenceCount: number;
  proposals: ActionPlanProposal[];
  generatedAt: string | null;
  summary: string;
};

type ActionPlanPreviewPrepared = ActionPlanPreviewOutput;

function buildSummary(
  language: string,
  output: Omit<ActionPlanPreviewOutput, "summary">
): string {
  if (language === "FR") {
    return `Plan d'action propose pour "${output.scopeName}" autour de "${output.focus}": ${output.proposalCount} propositions, ${output.highConfidenceCount} a forte confiance, execution toujours manuelle.`; 
  }
  if (language === "DE") {
    return `Vorgeschlagener Aktionsplan fuer "${output.scopeName}" zu "${output.focus}": ${output.proposalCount} Vorschlaege, ${output.highConfidenceCount} mit hoher Sicherheit, Ausfuehrung weiterhin manuell.`;
  }
  if (language === "ES") {
    return `Plan de accion propuesto para "${output.scopeName}" sobre "${output.focus}": ${output.proposalCount} propuestas, ${output.highConfidenceCount} de alta confianza, ejecucion siempre manual.`;
  }
  return `Proposed action plan for "${output.scopeName}" around "${output.focus}": ${output.proposalCount} proposals, ${output.highConfidenceCount} high-confidence, execution still manual.`;
}

async function prepareActionPlanPreview(
  request: AiWorkflowRequest<ActionPlanPreviewInput>
): Promise<ActionPlanPreviewPrepared> {
  const plan = await buildWorkspaceActionPlan({
    project: request.input.project,
    allNodes: request.input.allNodes,
    selectedNodeIds: request.input.selectedNodeIds,
    language: request.context.language,
    focus: request.input.focus,
    maxRecords: MAX_ACTION_PLAN_RECORDS
  });

  const base = {
    scopeName: plan.scopeName,
    focus: plan.focus,
    focusSource: plan.focusSource,
    proposalCount: plan.proposals.length,
    highConfidenceCount: plan.proposals.filter((proposal) => proposal.confidence >= 0.75).length,
    proposals: plan.proposals,
    generatedAt: plan.generatedAt
  };

  return {
    ...base,
    summary: buildSummary(request.context.language, base)
  };
}

export const actionPlanPreviewWorkflow: AiWorkflowDefinition<
  ActionPlanPreviewInput,
  ActionPlanPreviewPrepared,
  ActionPlanPreviewOutput
> = {
  id: "action_plan_preview",
  async prepare(request) {
    return prepareActionPlanPreview(request);
  },
  async execute({ prepared }) {
    return {
      workflowId: "action_plan_preview",
      output: prepared,
      warnings: [],
      requiresApproval: false
    };
  }
};
