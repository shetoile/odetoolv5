import type { AiWorkflowId } from "../core/contracts";

export type AiEvalStatus = "pending" | "passed" | "failed";

export type AiEvalCase = {
  id: string;
  workflowId: AiWorkflowId;
  description: string;
  expectedSignals: string[];
};

export type AiEvalRun = {
  caseId: string;
  workflowId: AiWorkflowId;
  status: AiEvalStatus;
  notes: string[];
};

export * from "./rebuildScorecard";
