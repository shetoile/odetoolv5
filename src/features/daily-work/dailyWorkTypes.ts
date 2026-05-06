export type DailyWorkTabId =
  | "ask"
  | "communication"
  | "notes"
  | "meetings"
  | "actions"
  | "documents"
  | "timeline"
  | "gantt"
  | "export";

export type DailyWorkSourceType =
  | "manual"
  | "ask_ai"
  | "note"
  | "meeting"
  | "transcript"
  | "document"
  | "quick_app"
  | "html"
  | "linked_app";

export type DailyWorkItemType =
  | "note"
  | "meeting_summary"
  | "action"
  | "decision"
  | "risk"
  | "follow_up";

export type DailyWorkItemStatus =
  | "inbox"
  | "suggested"
  | "approved"
  | "active"
  | "waiting"
  | "done"
  | "rejected";

export type DailyEvidenceKind = "document" | "html" | "quick_app" | "app" | "node" | "manual";

export type DailyEvidenceRef = {
  id: string;
  label: string;
  kind: DailyEvidenceKind;
  source?: "node" | "local" | "external";
};

export type DailyWorkItem = {
  id: string;
  type: DailyWorkItemType;
  title: string;
  body: string;
  status: DailyWorkItemStatus;
  sourceType: DailyWorkSourceType;
  sourceLabels: string[];
  evidenceRefs: DailyEvidenceRef[];
  createdAt: string;
  updatedAt: string;
  dueDate?: string | null;
  owner?: string | null;
  linkedNodeId?: string | null;
  linkedWorkspaceId?: string | null;
  linkedDeliverableId?: string | null;
  aiConfidence?: number | null;
  timelineLinked?: boolean;
};

export type DailyDocumentItem = {
  id: string;
  name: string;
  kind: "folder" | "document";
  parentId: string | null;
  source: "local" | "node";
  mimeType?: string | null;
  size?: number | null;
  nodeDocumentId?: string | null;
  pathLabel?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DailyWorkActivityType =
  | "note_saved"
  | "meeting_saved"
  | "actions_created"
  | "document_imported"
  | "document_selected"
  | "document_attached"
  | "action_status"
  | "timeline_sent"
  | "document_changed"
  | "export_requested";

export type DailyWorkActivity = {
  id: string;
  type: DailyWorkActivityType;
  label: string;
  detail?: string | null;
  createdAt: string;
  itemId?: string | null;
  documentId?: string | null;
};

export type DailyWorkState = {
  items: DailyWorkItem[];
  documents: DailyDocumentItem[];
  selectedDocumentIds: string[];
  activeFolderId: string | null;
  activities: DailyWorkActivity[];
  updatedAt: string;
};
