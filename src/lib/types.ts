
import type { LanguageCode } from "@/lib/i18n";

export type DesktopStateFilter = "all" | "empty" | "task" | "data";
export type FolderNodeState = "empty" | "task_only" | "data_only" | "filled";

export type ScheduleStatus = "planned" | "active" | "blocked" | "done";

export type MirrorStatus =
  | { kind: "syncing" }
  | { kind: "pending" }
  | { kind: "synced"; path: string };

export type AssistantAnalysisToken =
  | { kind: "text"; value: string }
  | { kind: "node_link"; label: string; nodeId: string };

export type ODENodeKind = "na_root" | "na_branch" | "chantier" | "task" | "document" | "generic";

export interface NAMatchCandidate {
  code: string;
  label: string;
  score: number;
  reason: string;
}

export interface NAMatchResult {
  recommendedCode: string | null;
  confidence: number;
  extractedIntent: string;
  candidates: NAMatchCandidate[];
}

export interface ODETraceMeta {
  sourceType: string;
  sourceRef: string;
  confidence: number;
  generatedAt: string;
  sourceNodeId?: string | null;
}

export interface ODEImportPreview {
  targetNodeId: string | null;
  targetNA: string | null;
  targetLabel: string | null;
  confidence: number;
  warnings: string[];
  chantierTitle: string | null;
  estimatedNodeCount: number;
}

export interface ODENodeMetadata {
  level: number | null;
  naCode: string | null;
  locked: boolean;
  kind: ODENodeKind | null;
}

export type DailyBriefingBucket = "critical_fix" | "feature_velocity" | "document_knowledge";

export type DailyBriefingActivity = {
  nodeId: string;
  numberLabel: string;
  name: string;
  type: NodeType;
  createdAt: number;
  updatedAt: number;
  lastTouchedAt: number;
  isNew: boolean;
  scheduleStatus: ScheduleStatus | null;
  snippet: string;
};

export type NodeType =

  | "folder"
  | "document"
  | "task"
  | "flow_step"
  | "file"
  | "report"
  | "minutes"
  | "ticket";

export type FileLikeNodeType = "file" | "document" | "report" | "minutes";

export const ROOT_PARENT_ID = "__ROOT__";

export interface AppNode {
  id: string;
  parentId: string;
  name: string;
  type: NodeType;
  properties?: Record<string, unknown>;
  description: string | null;
  order: number;
  createdAt: number;
  updatedAt: number;
  contentType?: "empty" | "files" | "tasks" | "all";
  aiDraft?: Record<string, unknown>;
  content?: string | null;
}

export type FileLikeAppNode = AppNode & { type: FileLikeNodeType };

export function isFileLikeNodeType(type: NodeType): type is FileLikeNodeType {
  return type === "file" || type === "document" || type === "report" || type === "minutes";
}

export function isFileLikeNode(node: AppNode | null | undefined): node is FileLikeAppNode {
  return Boolean(node && isFileLikeNodeType(node.type));
}

export interface ODEExecutionTaskItem {
  id: string;
  title: string;
  ownerName?: string | null;
  dueDate?: string | null;
  status?: ScheduleStatus;
  flagged?: boolean;
  note?: string | null;
}

export interface ODEStructuredDeliverable {
  id: string;
  title: string;
  tasks: ODEExecutionTaskItem[];
  notifications: string[];
  data: string[];
}

export type ODEWorkstreamSectionType = "tasks" | "team" | "collaboration";
export type ODEWorkstreamCollaborationKind = "update" | "decision" | "blocker" | "question";
export type ODEWorkstreamSourceKind = "objective" | "description" | "deliverable" | "document" | "node";

export interface ODEWorkstreamSource {
  sourceId: string;
  label: string;
  kind: ODEWorkstreamSourceKind;
  sourceNodeId?: string | null;
  excerpt?: string | null;
}

export interface ODEWorkstreamTaskItem {
  id: string;
  title: string;
  ownerName?: string | null;
  dueDate?: string | null;
  status: ScheduleStatus;
  flagged: boolean;
  note?: string | null;
}

export interface ODEWorkstreamTeamItem {
  id: string;
  name: string;
  role: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  responsibility?: string | null;
}

export interface ODEWorkstreamCollaborationItem {
  id: string;
  kind: ODEWorkstreamCollaborationKind;
  title: string;
  body?: string | null;
  authorName?: string | null;
  linkedTaskId?: string | null;
}

export interface ODEWorkstreamTasksSection {
  id: string;
  type: "tasks";
  title: string;
  collapsed: boolean;
  reasoning?: string | null;
  items: ODEWorkstreamTaskItem[];
}

export interface ODEWorkstreamTeamSection {
  id: string;
  type: "team";
  title: string;
  collapsed: boolean;
  reasoning?: string | null;
  items: ODEWorkstreamTeamItem[];
}

export interface ODEWorkstreamCollaborationSection {
  id: string;
  type: "collaboration";
  title: string;
  collapsed: boolean;
  reasoning?: string | null;
  items: ODEWorkstreamCollaborationItem[];
}

export type ODEWorkstreamSection =
  | ODEWorkstreamTasksSection
  | ODEWorkstreamTeamSection
  | ODEWorkstreamCollaborationSection;

export interface ODEWorkstreamWorkspace {
  version: 1;
  sourceNodeId: string;
  deliverableId: string | null;
  generatedBy: "ai" | "manual";
  generatedAt: string;
  summary: string;
  confidence: number;
  sources: ODEWorkstreamSource[];
  sections: ODEWorkstreamSection[];
}

export interface ODEWorkstreamWorkspaceCollection {
  version: 1;
  workspaces: ODEWorkstreamWorkspace[];
}

export type ODEChantierStatus = "draft" | "proposed" | "approved" | "active" | "paused" | "closed" | "archived";
export type ODEChantierSignoffState = "not_started" | "in_review" | "signed";
export type ODEChantierMaturityLevel = "emerging" | "stabilizing" | "scaling" | "institutionalized";

export interface ODEChantierProfile {
  status: ODEChantierStatus;
  activity: string | null;
  qualityTarget: string | null;
  costTarget: string | null;
  delayTarget: string | null;
  owner: string | null;
  planningWindow: string | null;
  reviewCadence: string | null;
  quarterFocus: string | null;
  cadenceMilestones: string | null;
  capacityPlan: string | null;
  dependencies: string | null;
  resources: string | null;
  roleModel: string | null;
  requiredSkills: string | null;
  peoplePlan: string | null;
  indicators: string | null;
  evidencePlan: string | null;
  signoffOwner: string | null;
  signoffState: ODEChantierSignoffState | null;
  acceptancePlan: string | null;
  closurePack: string | null;
  decisionLog: string | null;
  approvalComment: string | null;
  maturityLevel: ODEChantierMaturityLevel | null;
  transformationImpact: string | null;
  adoptionNotes: string | null;
  closureSummary: string | null;
  retex: string | null;
}

export interface ODEWorkstreamWorkspaceProposal {
  version: 1;
  nodeId: string;
  deliverableId: string;
  outputLanguage: LanguageCode;
  title: string;
  summary: string;
  confidence: number;
  sources: ODEWorkstreamSource[];
  sections: ODEWorkstreamSection[];
}

export interface ODEDeliverableProposalItem {
  id: string;
  title: string;
  rationale?: string | null;
}

export interface ODEDeliverableProposal {
  version: 1;
  nodeId: string;
  outputLanguage: LanguageCode;
  title: string;
  summary: string;
  confidence: number;
  sources: ODEWorkstreamSource[];
  deliverables: ODEDeliverableProposalItem[];
}

export interface ODEIntegratedPlanProposalItem {
  id: string;
  title: string;
  rationale?: string | null;
  taskProposal: ODEWorkstreamWorkspaceProposal;
}

export interface ODEIntegratedPlanApprovedExampleSummary {
  id: string;
  nodeTitle: string;
  approvedAt: string;
  structureTitles: string[];
  deliverableTitles: string[];
}

export interface ODEIntegratedPlanStructureNode {
  title: string;
  description?: string;
  objective?: string;
  expected_deliverables?: string[];
  prerequisites: string[];
  estimated_effort: string;
  suggested_role: string;
  value_milestone: boolean;
  source_code?: string;
  children: ODEIntegratedPlanStructureNode[];
}

export interface ODEIntegratedPlanProposal {
  version: 1;
  nodeId: string;
  outputLanguage: LanguageCode;
  title: string;
  summary: string;
  confidence: number;
  sources: ODEWorkstreamSource[];
  capabilityMatch?: NAMatchResult | null;
  approvedExamplesUsed?: ODEIntegratedPlanApprovedExampleSummary[];
  structure: {
    goal: string;
    summary: string;
    source: "llm" | "fallback";
    warning?: string;
    nodes: ODEIntegratedPlanStructureNode[];
  };
  deliverables: ODEIntegratedPlanProposalItem[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  rootPath: string;
  rootNodeId: string;
  createdAt: number;
  updatedAt: number;
}

export type TaskStatus = "todo" | "in_progress" | "review" | "done" | "blocked";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskType = "task" | "milestone" | "bug" | "story";
export type DependencyType = "FS" | "SS" | "FF" | "SF";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  tags: string[];
  assignees: string[];
  watchers: string[];
  owner: string;
  startDate: number | null;
  dueDate: number | null;
  duration: number | null;
  effortEstimate: number | null;
  progress: number;
  isMilestone: boolean;
  companyId: string;
  projectId: string;
  createdAt: number;
  updatedAt: number;
  customFields?: Record<string, unknown>;
  externalUrl?: string | null;
  provider?: "google" | "microsoft" | "jira" | "monday" | "other" | null;
}

export interface TaskNodeLink {
  id: string;
  taskId: string;
  nodeId: string;
  isPrimary: boolean;
}

export interface TaskFilterOptions {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  assignee?: string;
  nodeId?: string;
  includeSubnodes?: boolean;
  search?: string;
}

export interface TaskMetadata {
  counts: Record<string, number>;
  blockedNodeIds: string[];
}
