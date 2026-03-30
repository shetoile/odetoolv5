import { approvalQueuePreviewWorkflow } from "../workflows/approvalQueuePreview";
import { rebuildPolicyGate } from "../core/rebuildPolicy";
import { createAiRuntime } from "../core/runtime";
import { rebuildGateway } from "../core/rebuildGateway";
import { actionPlanPreviewWorkflow } from "../workflows/actionPlanPreview";
import { documentIngestionPreviewWorkflow } from "../workflows/documentIngestionPreview";
import { documentRecordStoreWorkflow } from "../workflows/documentRecordStore";
import { executionPacketPreviewWorkflow } from "../workflows/executionPacketPreview";
import { finalAiSolutionWorkflow } from "../workflows/finalAiSolution";
import { knowledgeRetrievalPreviewWorkflow } from "../workflows/knowledgeRetrievalPreview";
import { createWorkflowRegistry } from "../workflows/registry";
import { knowledgeSnapshotWorkflow } from "../workflows/knowledgeSnapshot";
import { workspaceKnowledgeSummaryWorkflow } from "../workflows/workspaceKnowledgeSummary";
import { workspaceOverviewWorkflow } from "../workflows/workspaceOverview";

export function createDefaultAiRebuildRuntime() {
  return createAiRuntime({
    registry: createWorkflowRegistry([
      approvalQueuePreviewWorkflow,
      actionPlanPreviewWorkflow,
      workspaceOverviewWorkflow,
      knowledgeSnapshotWorkflow,
      documentIngestionPreviewWorkflow,
      documentRecordStoreWorkflow,
      executionPacketPreviewWorkflow,
      finalAiSolutionWorkflow,
      knowledgeRetrievalPreviewWorkflow,
      workspaceKnowledgeSummaryWorkflow
    ]),
    gateway: rebuildGateway,
    policy: rebuildPolicyGate
  });
}
