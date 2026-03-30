import type { AppNode, ProjectSummary } from "@/lib/types";
import type { AiWorkflowDefinition, AiWorkflowRequest } from "../core/contracts";
import {
  buildWorkspaceExecutionPacketPreview,
  type DeferredExecutionItem,
  type ExecutionPacket,
  type WorkspaceExecutionPacketPreview
} from "../knowledge";

const MAX_EXECUTION_PACKET_RECORDS = 12;

export type ExecutionPacketPreviewInput = {
  project: ProjectSummary | null;
  allNodes: AppNode[];
  selectedNodeIds: string[];
  focus: string;
};

export type ExecutionPacketPreviewOutput = {
  scopeName: string;
  focus: string;
  focusSource: WorkspaceExecutionPacketPreview["focusSource"];
  packetCount: number;
  draftPacketCount: number;
  deferredCount: number;
  requiresExplicitApprovalCount: number;
  packets: ExecutionPacket[];
  deferredItems: DeferredExecutionItem[];
  generatedAt: string | null;
  summary: string;
};

type ExecutionPacketPreviewPrepared = ExecutionPacketPreviewOutput;

function buildSummary(
  language: string,
  output: Omit<ExecutionPacketPreviewOutput, "summary">
): string {
  if (language === "FR") {
    return `Paquet d'execution prepare pour "${output.scopeName}" autour de "${output.focus}": ${output.packetCount} paquets compilables, ${output.deferredCount} en attente, toujours sans execution automatique.`;
  }
  if (language === "DE") {
    return `Ausfuehrungspaket fuer "${output.scopeName}" zu "${output.focus}": ${output.packetCount} kompilierbare Pakete, ${output.deferredCount} zurueckgestellt, weiterhin ohne automatische Ausfuehrung.`;
  }
  if (language === "ES") {
    return `Paquete de ejecucion preparado para "${output.scopeName}" sobre "${output.focus}": ${output.packetCount} paquetes compilables, ${output.deferredCount} diferidos, todavia sin ejecucion automatica.`;
  }
  return `Execution packet prepared for "${output.scopeName}" around "${output.focus}": ${output.packetCount} compilable packets, ${output.deferredCount} deferred, still with no automatic execution.`;
}

async function prepareExecutionPacketPreview(
  request: AiWorkflowRequest<ExecutionPacketPreviewInput>
): Promise<ExecutionPacketPreviewPrepared> {
  const preview = await buildWorkspaceExecutionPacketPreview({
    project: request.input.project,
    allNodes: request.input.allNodes,
    selectedNodeIds: request.input.selectedNodeIds,
    language: request.context.language,
    focus: request.input.focus,
    maxRecords: MAX_EXECUTION_PACKET_RECORDS
  });

  const base = {
    scopeName: preview.scopeName,
    focus: preview.focus,
    focusSource: preview.focusSource,
    packetCount: preview.packetCount,
    draftPacketCount: preview.draftPacketCount,
    deferredCount: preview.deferredCount,
    requiresExplicitApprovalCount: preview.requiresExplicitApprovalCount,
    packets: preview.packets,
    deferredItems: preview.deferredItems,
    generatedAt: preview.generatedAt
  };

  return {
    ...base,
    summary: buildSummary(request.context.language, base)
  };
}

export const executionPacketPreviewWorkflow: AiWorkflowDefinition<
  ExecutionPacketPreviewInput,
  ExecutionPacketPreviewPrepared,
  ExecutionPacketPreviewOutput
> = {
  id: "execution_packet_preview",
  async prepare(request) {
    return prepareExecutionPacketPreview(request);
  },
  async execute({ prepared }) {
    return {
      workflowId: "execution_packet_preview",
      output: prepared,
      warnings: [],
      requiresApproval: false
    };
  }
};
