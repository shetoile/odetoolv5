import { type AiCommandActionId } from "@/features/ai/commandPlanner";

export interface AiCommandExecutionHandlers {
  workspaceImport: () => Promise<void> | void;
  workspaceResync: () => Promise<void> | void;
  planMyDay: () => Promise<void> | void;
  wbsGenerate: (args?: Record<string, unknown>) => Promise<void> | void;
  wbsFromDocument: (args?: Record<string, unknown>) => Promise<void> | void;
  databaseCreateSection: (args?: Record<string, unknown>) => Promise<void> | void;
  treeCreateTopic: () => Promise<void> | void;
  treeRenameSelected: (args?: Record<string, unknown>) => Promise<void> | void;
  treeMoveSelected: (args?: Record<string, unknown>) => Promise<void> | void;
  treeBulkCreate: (args?: Record<string, unknown>) => Promise<void> | void;
  favoriteSelected: (args?: Record<string, unknown>) => Promise<void> | void;
  desktopOpen: () => Promise<void> | void;
  timelineOpen: () => Promise<void> | void;
  timelineSetSchedule: (args?: Record<string, unknown>) => Promise<void> | void;
  timelineClearSchedule: () => Promise<void> | void;
  documentReview: (args?: Record<string, unknown>) => Promise<void> | void;
  ticketCreate: () => Promise<void> | void;
  ticketAnalyze: () => Promise<void> | void;
  ticketDraftReply: (args?: Record<string, unknown>) => Promise<void> | void;
  runQa: () => Promise<void> | void;
  draftReleaseNote: () => Promise<void> | void;
}

export async function executeAiCommandActionWithHandlers(
  actionId: AiCommandActionId,
  args: Record<string, unknown> | undefined,
  handlers: AiCommandExecutionHandlers
): Promise<void> {
  if (actionId === "workspace_import") {
    await handlers.workspaceImport();
    return;
  }
  if (actionId === "workspace_resync") {
    await handlers.workspaceResync();
    return;
  }
  if (actionId === "plan_my_day") {
    await handlers.planMyDay();
    return;
  }
  if (actionId === "wbs_generate") {
    await handlers.wbsGenerate(args);
    return;
  }
  if (actionId === "wbs_from_document") {
    await handlers.wbsFromDocument(args);
    return;
  }
  if (actionId === "database_create_section") {
    await handlers.databaseCreateSection(args);
    return;
  }
  if (actionId === "tree_create_topic") {
    await handlers.treeCreateTopic();
    return;
  }
  if (actionId === "tree_rename_selected") {
    await handlers.treeRenameSelected(args);
    return;
  }
  if (actionId === "tree_move_selected") {
    await handlers.treeMoveSelected(args);
    return;
  }
  if (actionId === "tree_bulk_create") {
    await handlers.treeBulkCreate(args);
    return;
  }
  if (actionId === "favorite_selected") {
    await handlers.favoriteSelected(args);
    return;
  }
  if (actionId === "desktop_open") {
    await handlers.desktopOpen();
    return;
  }
  if (actionId === "timeline_open") {
    await handlers.timelineOpen();
    return;
  }
  if (actionId === "timeline_set_schedule") {
    await handlers.timelineSetSchedule(args);
    return;
  }
  if (actionId === "timeline_clear_schedule") {
    await handlers.timelineClearSchedule();
    return;
  }
  if (actionId === "document_review") {
    await handlers.documentReview(args);
    return;
  }
  if (actionId === "ticket_create") {
    await handlers.ticketCreate();
    return;
  }
  if (actionId === "ticket_analyze") {
    await handlers.ticketAnalyze();
    return;
  }
  if (actionId === "ticket_draft_reply") {
    await handlers.ticketDraftReply(args);
    return;
  }
  if (actionId === "run_qa") {
    await handlers.runQa();
    return;
  }
  if (actionId === "draft_release_note") {
    await handlers.draftReleaseNote();
    return;
  }
  throw new Error(`Unsupported action: ${actionId}`);
}
