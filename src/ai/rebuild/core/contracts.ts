export type AiWorkflowId =
  | "approval_queue_preview"
  | "action_plan_preview"
  | "document_ingestion_preview"
  | "document_record_store"
  | "execution_packet_preview"
  | "final_ai_solution"
  | "knowledge_snapshot"
  | "knowledge_retrieval_preview"
  | "workspace_knowledge_summary"
  | "workspace_overview"
  | "document_review"
  | "tree_generation"
  | "na_mapping"
  | "ticket_analysis"
  | "ticket_reply";

export type AiRuntimeContext = {
  language: string;
  workspaceId: string | null;
  selectedNodeIds: string[];
};

export type AiWorkflowRequest<TInput = unknown> = {
  workflowId: AiWorkflowId;
  input: TInput;
  context: AiRuntimeContext;
};

export type AiWorkflowResult<TOutput = unknown> = {
  workflowId: AiWorkflowId;
  output: TOutput;
  warnings: string[];
  requiresApproval: boolean;
};

export type AiModelMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiModelGatewayRequest = {
  workflowId: AiWorkflowId;
  messages: AiModelMessage[];
  schemaName: string;
};

export type AiModelGatewayResponse = {
  rawText: string;
  model: string;
};

export interface AiModelGateway {
  run(request: AiModelGatewayRequest): Promise<AiModelGatewayResponse>;
}

export interface AiTelemetrySink {
  record(event: {
    workflowId: AiWorkflowId;
    stage: "start" | "success" | "failure";
    detail?: string;
  }): void;
}

export interface AiWorkflowDefinition<TInput = unknown, TPrepared = unknown, TOutput = unknown> {
  id: AiWorkflowId;
  prepare(request: AiWorkflowRequest<TInput>): Promise<TPrepared> | TPrepared;
  execute(args: {
    request: AiWorkflowRequest<TInput>;
    prepared: TPrepared;
    gateway: AiModelGateway;
  }): Promise<AiWorkflowResult<TOutput>>;
}

export interface AiPolicyGate {
  allow(request: AiWorkflowRequest): Promise<void> | void;
}
