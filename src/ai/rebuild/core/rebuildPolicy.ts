import type { AiPolicyGate, AiWorkflowId, AiWorkflowRequest } from "./contracts";

export type RebuildPolicyStage =
  | "observe"
  | "ingest"
  | "normalize"
  | "retrieve"
  | "plan"
  | "approve"
  | "handoff"
  | "blueprint";

export type RebuildPolicyRisk = "low" | "medium" | "high";

export type RebuildWorkflowPolicy = {
  workflowId: AiWorkflowId;
  stage: RebuildPolicyStage;
  risk: RebuildPolicyRisk;
  writesToWorkspace: boolean;
  usesModel: boolean;
  requiresHumanApproval: boolean;
  enabled: boolean;
  description: string;
};

const REBUILD_WORKFLOW_POLICIES: RebuildWorkflowPolicy[] = [
  {
    workflowId: "workspace_overview",
    stage: "observe",
    risk: "low",
    writesToWorkspace: false,
    usesModel: false,
    requiresHumanApproval: false,
    enabled: true,
    description: "Inspect workspace structure without modifying anything."
  },
  {
    workflowId: "knowledge_snapshot",
    stage: "observe",
    risk: "low",
    writesToWorkspace: false,
    usesModel: false,
    requiresHumanApproval: false,
    enabled: true,
    description: "Collect deterministic workspace knowledge signals."
  },
  {
    workflowId: "document_ingestion_preview",
    stage: "ingest",
    risk: "medium",
    writesToWorkspace: false,
    usesModel: false,
    requiresHumanApproval: false,
    enabled: true,
    description: "Preview file ingestion and extraction coverage."
  },
  {
    workflowId: "document_record_store",
    stage: "normalize",
    risk: "medium",
    writesToWorkspace: false,
    usesModel: false,
    requiresHumanApproval: false,
    enabled: true,
    description: "Build normalized document records for downstream AI flows."
  },
  {
    workflowId: "workspace_knowledge_summary",
    stage: "normalize",
    risk: "low",
    writesToWorkspace: false,
    usesModel: false,
    requiresHumanApproval: false,
    enabled: true,
    description: "Summarize reusable workspace-level knowledge."
  },
  {
    workflowId: "knowledge_retrieval_preview",
    stage: "retrieve",
    risk: "low",
    writesToWorkspace: false,
    usesModel: false,
    requiresHumanApproval: false,
    enabled: true,
    description: "Rank matching records and evidence from the rebuild knowledge layer."
  },
  {
    workflowId: "action_plan_preview",
    stage: "plan",
    risk: "medium",
    writesToWorkspace: false,
    usesModel: false,
    requiresHumanApproval: true,
    enabled: true,
    description: "Turn retrieved knowledge into reviewable proposed actions."
  },
  {
    workflowId: "approval_queue_preview",
    stage: "approve",
    risk: "medium",
    writesToWorkspace: false,
    usesModel: false,
    requiresHumanApproval: true,
    enabled: true,
    description: "Classify proposals by readiness, blockers, and approval state."
  },
  {
    workflowId: "execution_packet_preview",
    stage: "handoff",
    risk: "high",
    writesToWorkspace: false,
    usesModel: false,
    requiresHumanApproval: true,
    enabled: true,
    description: "Compile approval-ready items into explicit future execution packets."
  },
  {
    workflowId: "final_ai_solution",
    stage: "blueprint",
    risk: "low",
    writesToWorkspace: false,
    usesModel: false,
    requiresHumanApproval: false,
    enabled: true,
    description: "Explain the final rebuild architecture, policies, and remaining future modules."
  }
];

const REBUILD_WORKFLOW_POLICY_MAP = new Map(
  REBUILD_WORKFLOW_POLICIES.map((entry) => [entry.workflowId, entry] as const)
);

export function listRebuildWorkflowPolicies(): RebuildWorkflowPolicy[] {
  return REBUILD_WORKFLOW_POLICIES.slice();
}

export function getRebuildWorkflowPolicy(workflowId: AiWorkflowId): RebuildWorkflowPolicy | null {
  return REBUILD_WORKFLOW_POLICY_MAP.get(workflowId) ?? null;
}

export const rebuildPolicyGate: AiPolicyGate = {
  async allow(request: AiWorkflowRequest) {
    const policy = getRebuildWorkflowPolicy(request.workflowId);
    if (!policy) {
      throw new Error(`No rebuild policy is defined for workflow: ${request.workflowId}`);
    }

    if (!policy.enabled) {
      throw new Error(`Workflow is disabled by rebuild policy: ${request.workflowId}`);
    }

    if (policy.writesToWorkspace) {
      throw new Error(`Workspace-writing workflows are not enabled in the rebuild runtime: ${request.workflowId}`);
    }
  }
};
