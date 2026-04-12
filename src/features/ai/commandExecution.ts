import { type AiCommandActionId } from "@/features/ai/commandPlanner";

export type AiCommandExecutionResult = {
  createdSectionName?: string | null;
  createdSectionNodeId?: string | null;
  databaseRootNodeId?: string | null;
  createdWidgetNodeId?: string | null;
  widgetHostNodeId?: string | null;
  executionOwnerNodeId?: string | null;
  createdTaskNodeIds?: string[];
};

export interface AiCommandExecutionHandlers {
  workspaceImport: () => Promise<AiCommandExecutionResult | void> | AiCommandExecutionResult | void;
  workspaceResync: () => Promise<AiCommandExecutionResult | void> | AiCommandExecutionResult | void;
  planMyDay: () => Promise<AiCommandExecutionResult | void> | AiCommandExecutionResult | void;
  wbsGenerate: (args?: Record<string, unknown>) => Promise<AiCommandExecutionResult | void> | AiCommandExecutionResult | void;
  wbsFromDocument: (args?: Record<string, unknown>) => Promise<AiCommandExecutionResult | void> | AiCommandExecutionResult | void;
  databaseCreateSection: (args?: Record<string, unknown>) => Promise<AiCommandExecutionResult | void> | AiCommandExecutionResult | void;
  databaseSeedExamples: (args?: Record<string, unknown>) => Promise<AiCommandExecutionResult | void> | AiCommandExecutionResult | void;
  dashboardWidgetCreate: (args?: Record<string, unknown>) => Promise<AiCommandExecutionResult | void> | AiCommandExecutionResult | void;
  governanceFrameworkGenerate: (args?: Record<string, unknown>) => Promise<AiCommandExecutionResult | void> | AiCommandExecutionResult | void;
  executionTaskCreate: (args?: Record<string, unknown>) => Promise<AiCommandExecutionResult | void> | AiCommandExecutionResult | void;
  treeCreateTopic: () => Promise<AiCommandExecutionResult | void> | AiCommandExecutionResult | void;
  treeRenameSelected: (args?: Record<string, unknown>) => Promise<AiCommandExecutionResult | void> | AiCommandExecutionResult | void;
  treeMoveSelected: (args?: Record<string, unknown>) => Promise<AiCommandExecutionResult | void> | AiCommandExecutionResult | void;
  treeBulkCreate: (args?: Record<string, unknown>) => Promise<AiCommandExecutionResult | void> | AiCommandExecutionResult | void;
  favoriteSelected: (args?: Record<string, unknown>) => Promise<AiCommandExecutionResult | void> | AiCommandExecutionResult | void;
  desktopOpen: () => Promise<AiCommandExecutionResult | void> | AiCommandExecutionResult | void;
  timelineOpen: () => Promise<AiCommandExecutionResult | void> | AiCommandExecutionResult | void;
  timelineSetSchedule: (args?: Record<string, unknown>) => Promise<AiCommandExecutionResult | void> | AiCommandExecutionResult | void;
  timelineClearSchedule: () => Promise<AiCommandExecutionResult | void> | AiCommandExecutionResult | void;
  documentReview: (args?: Record<string, unknown>) => Promise<AiCommandExecutionResult | void> | AiCommandExecutionResult | void;
  ticketCreate: () => Promise<AiCommandExecutionResult | void> | AiCommandExecutionResult | void;
  ticketAnalyze: () => Promise<AiCommandExecutionResult | void> | AiCommandExecutionResult | void;
  ticketDraftReply: (args?: Record<string, unknown>) => Promise<AiCommandExecutionResult | void> | AiCommandExecutionResult | void;
  runQa: () => Promise<AiCommandExecutionResult | void> | AiCommandExecutionResult | void;
  draftReleaseNote: () => Promise<AiCommandExecutionResult | void> | AiCommandExecutionResult | void;
}

export async function executeAiCommandActionWithHandlers(
  actionId: AiCommandActionId,
  args: Record<string, unknown> | undefined,
  handlers: AiCommandExecutionHandlers
): Promise<AiCommandExecutionResult | void> {
  if (actionId === "workspace_import") {
    return handlers.workspaceImport();
  }
  if (actionId === "workspace_resync") {
    return handlers.workspaceResync();
  }
  if (actionId === "plan_my_day") {
    return handlers.planMyDay();
  }
  if (actionId === "wbs_generate") {
    return handlers.wbsGenerate(args);
  }
  if (actionId === "wbs_from_document") {
    return handlers.wbsFromDocument(args);
  }
  if (actionId === "database_create_section") {
    return handlers.databaseCreateSection(args);
  }
  if (actionId === "database_seed_examples") {
    return handlers.databaseSeedExamples(args);
  }
  if (actionId === "dashboard_widget_create") {
    return handlers.dashboardWidgetCreate(args);
  }
  if (actionId === "governance_framework_generate") {
    return handlers.governanceFrameworkGenerate(args);
  }
  if (actionId === "execution_task_create") {
    return handlers.executionTaskCreate(args);
  }
  if (actionId === "tree_create_topic") {
    return handlers.treeCreateTopic();
  }
  if (actionId === "tree_rename_selected") {
    return handlers.treeRenameSelected(args);
  }
  if (actionId === "tree_move_selected") {
    return handlers.treeMoveSelected(args);
  }
  if (actionId === "tree_bulk_create") {
    return handlers.treeBulkCreate(args);
  }
  if (actionId === "favorite_selected") {
    return handlers.favoriteSelected(args);
  }
  if (actionId === "desktop_open") {
    return handlers.desktopOpen();
  }
  if (actionId === "timeline_open") {
    return handlers.timelineOpen();
  }
  if (actionId === "timeline_set_schedule") {
    return handlers.timelineSetSchedule(args);
  }
  if (actionId === "timeline_clear_schedule") {
    return handlers.timelineClearSchedule();
  }
  if (actionId === "document_review") {
    return handlers.documentReview(args);
  }
  if (actionId === "ticket_create") {
    return handlers.ticketCreate();
  }
  if (actionId === "ticket_analyze") {
    return handlers.ticketAnalyze();
  }
  if (actionId === "ticket_draft_reply") {
    return handlers.ticketDraftReply(args);
  }
  if (actionId === "run_qa") {
    return handlers.runQa();
  }
  if (actionId === "draft_release_note") {
    return handlers.draftReleaseNote();
  }
  throw new Error(`Unsupported action: ${actionId}`);
}
