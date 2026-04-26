import {
  getAiCapabilityHandlerKey,
  type AiCommandActionId
} from "@/features/ai/capabilityRegistry";

export interface AiCommandExecutionHandlers {
  workspaceImport: (args?: Record<string, unknown>) => Promise<void> | void;
  workspaceCreate: (args?: Record<string, unknown>) => Promise<void> | void;
  workspaceSwitch: (args?: Record<string, unknown>) => Promise<void> | void;
  workspaceRename: (args?: Record<string, unknown>) => Promise<void> | void;
  workspaceSetLocation: (args?: Record<string, unknown>) => Promise<void> | void;
  workspaceSetDefault: (args?: Record<string, unknown>) => Promise<void> | void;
  workspaceOpenFolder: (args?: Record<string, unknown>) => Promise<void> | void;
  workspaceDelete: (args?: Record<string, unknown>) => Promise<void> | void;
  workspaceResync: (args?: Record<string, unknown>) => Promise<void> | void;
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
  quickAppAdd: (args?: Record<string, unknown>) => Promise<void> | void;
  quickAppRemove: (args?: Record<string, unknown>) => Promise<void> | void;
  quickAppOpen: (args?: Record<string, unknown>) => Promise<void> | void;
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
  const handlerKey = getAiCapabilityHandlerKey(actionId);
  const handler = handlers[handlerKey] as ((args?: Record<string, unknown>) => Promise<void> | void) | undefined;
  if (!handler) throw new Error(`Unsupported action: ${actionId}`);
  await handler(args);
}
