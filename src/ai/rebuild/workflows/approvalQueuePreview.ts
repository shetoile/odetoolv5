import type { AppNode, ProjectSummary } from "@/lib/types";
import type { AiWorkflowDefinition, AiWorkflowRequest } from "../core/contracts";
import {
  buildWorkspaceApprovalQueue,
  type ApprovalQueueItem,
  type WorkspaceApprovalQueue
} from "../knowledge";

const MAX_APPROVAL_QUEUE_RECORDS = 12;

export type ApprovalQueuePreviewInput = {
  project: ProjectSummary | null;
  allNodes: AppNode[];
  selectedNodeIds: string[];
  focus: string;
};

export type ApprovalQueuePreviewOutput = {
  scopeName: string;
  focus: string;
  focusSource: WorkspaceApprovalQueue["focusSource"];
  itemCount: number;
  readyForHandoffCount: number;
  holdCount: number;
  items: ApprovalQueueItem[];
  generatedAt: string | null;
  summary: string;
};

type ApprovalQueuePreviewPrepared = ApprovalQueuePreviewOutput;

function buildSummary(
  language: string,
  output: Omit<ApprovalQueuePreviewOutput, "summary">
): string {
  if (language === "FR") {
    return `File d'approbation preparee pour "${output.scopeName}" autour de "${output.focus}": ${output.itemCount} propositions, ${output.readyForHandoffCount} pretes pour transfert, ${output.holdCount} a garder en revue.`;
  }
  if (language === "DE") {
    return `Freigabe-Queue fuer "${output.scopeName}" zu "${output.focus}": ${output.itemCount} Vorschlaege, ${output.readyForHandoffCount} fuer Handoff bereit, ${output.holdCount} weiter in Pruefung.`;
  }
  if (language === "ES") {
    return `Cola de aprobacion preparada para "${output.scopeName}" sobre "${output.focus}": ${output.itemCount} propuestas, ${output.readyForHandoffCount} listas para traspaso, ${output.holdCount} para mantener en revision.`;
  }
  return `Approval queue prepared for "${output.scopeName}" around "${output.focus}": ${output.itemCount} proposals, ${output.readyForHandoffCount} ready for handoff, ${output.holdCount} kept in review.`;
}

async function prepareApprovalQueuePreview(
  request: AiWorkflowRequest<ApprovalQueuePreviewInput>
): Promise<ApprovalQueuePreviewPrepared> {
  const queue = await buildWorkspaceApprovalQueue({
    project: request.input.project,
    allNodes: request.input.allNodes,
    selectedNodeIds: request.input.selectedNodeIds,
    language: request.context.language,
    focus: request.input.focus,
    maxRecords: MAX_APPROVAL_QUEUE_RECORDS
  });

  const base = {
    scopeName: queue.scopeName,
    focus: queue.focus,
    focusSource: queue.focusSource,
    itemCount: queue.itemCount,
    readyForHandoffCount: queue.readyForHandoffCount,
    holdCount: queue.holdCount,
    items: queue.items,
    generatedAt: queue.generatedAt
  };

  return {
    ...base,
    summary: buildSummary(request.context.language, base)
  };
}

export const approvalQueuePreviewWorkflow: AiWorkflowDefinition<
  ApprovalQueuePreviewInput,
  ApprovalQueuePreviewPrepared,
  ApprovalQueuePreviewOutput
> = {
  id: "approval_queue_preview",
  async prepare(request) {
    return prepareApprovalQueuePreview(request);
  },
  async execute({ prepared }) {
    return {
      workflowId: "approval_queue_preview",
      output: prepared,
      warnings: [],
      requiresApproval: false
    };
  }
};
