import type {
  AppNode,
  ODEExecutionTaskItem,
  ODEWorkstreamCollaborationItem,
  ODEWorkstreamWorkspaceCollection,
  ODEWorkstreamSection,
  ODEWorkstreamSource,
  ODEWorkstreamTaskItem,
  ODEWorkstreamTeamItem,
  ODEWorkstreamWorkspace,
  ODEWorkstreamWorkspaceProposal,
  ScheduleStatus
} from "@/lib/types";

export const ODE_WORKSTREAM_WORKSPACE_PROPERTY = "odeWorkstreamWorkspace";

let workstreamIdCounter = 0;

function createWorkstreamItemId(prefix: string): string {
  workstreamIdCounter += 1;
  return `ode-${prefix}-${Date.now()}-${workstreamIdCounter}`;
}

function normalizeScheduleStatus(value: unknown): ScheduleStatus {
  if (value === "active" || value === "blocked" || value === "done") return value;
  return "planned";
}

function normalizeSource(source: unknown, index: number): ODEWorkstreamSource | null {
  if (!source || typeof source !== "object") return null;
  const record = source as Record<string, unknown>;
  const label = typeof record.label === "string" ? record.label.trim() : "";
  if (!label) return null;
  const kind =
    record.kind === "objective" ||
    record.kind === "description" ||
    record.kind === "deliverable" ||
    record.kind === "document" ||
    record.kind === "node"
      ? record.kind
      : "node";
  return {
    sourceId:
      typeof record.sourceId === "string" && record.sourceId.trim().length > 0
        ? record.sourceId.trim()
        : createWorkstreamItemId(`source-${index}`),
    label,
    kind,
    sourceNodeId:
      typeof record.sourceNodeId === "string" && record.sourceNodeId.trim().length > 0
        ? record.sourceNodeId.trim()
        : null,
    excerpt: typeof record.excerpt === "string" && record.excerpt.trim().length > 0 ? record.excerpt.trim() : null
  };
}

function normalizeTaskItem(item: unknown, index: number): ODEWorkstreamTaskItem | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title.trim() : "";
  if (!title) return null;
  return {
    id:
      typeof record.id === "string" && record.id.trim().length > 0
        ? record.id.trim()
        : createWorkstreamItemId(`task-${index}`),
    title,
    ownerName: typeof record.ownerName === "string" && record.ownerName.trim().length > 0 ? record.ownerName.trim() : null,
    dueDate: typeof record.dueDate === "string" && record.dueDate.trim().length > 0 ? record.dueDate.trim() : null,
    status: normalizeScheduleStatus(record.status),
    flagged: record.flagged === true,
    note: typeof record.note === "string" && record.note.trim().length > 0 ? record.note.trim() : null
  };
}

function normalizeTeamItem(item: unknown, index: number): ODEWorkstreamTeamItem | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const role = typeof record.role === "string" ? record.role.trim() : "";
  if (!name || !role) return null;
  return {
    id:
      typeof record.id === "string" && record.id.trim().length > 0
        ? record.id.trim()
        : createWorkstreamItemId(`team-${index}`),
    name,
    role,
    company: typeof record.company === "string" && record.company.trim().length > 0 ? record.company.trim() : null,
    email: typeof record.email === "string" && record.email.trim().length > 0 ? record.email.trim() : null,
    phone: typeof record.phone === "string" && record.phone.trim().length > 0 ? record.phone.trim() : null,
    responsibility:
      typeof record.responsibility === "string" && record.responsibility.trim().length > 0
        ? record.responsibility.trim()
        : null
  };
}

function normalizeCollaborationItem(item: unknown, index: number): ODEWorkstreamCollaborationItem | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title.trim() : "";
  if (!title) return null;
  const kind =
    record.kind === "decision" || record.kind === "blocker" || record.kind === "question" ? record.kind : "update";
  return {
    id:
      typeof record.id === "string" && record.id.trim().length > 0
        ? record.id.trim()
        : createWorkstreamItemId(`collaboration-${index}`),
    kind,
    title,
    body: typeof record.body === "string" && record.body.trim().length > 0 ? record.body.trim() : null,
    authorName:
      typeof record.authorName === "string" && record.authorName.trim().length > 0 ? record.authorName.trim() : null,
    linkedTaskId:
      typeof record.linkedTaskId === "string" && record.linkedTaskId.trim().length > 0
        ? record.linkedTaskId.trim()
        : null
  };
}

function normalizeSection(section: unknown, index: number): ODEWorkstreamSection | null {
  if (!section || typeof section !== "object") return null;
  const record = section as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title.trim() : "";
  const id =
    typeof record.id === "string" && record.id.trim().length > 0
      ? record.id.trim()
      : createWorkstreamItemId(`section-${index}`);
  const collapsed = record.collapsed === true;
  const reasoning =
    typeof record.reasoning === "string" && record.reasoning.trim().length > 0 ? record.reasoning.trim() : null;

  if (record.type === "team") {
    const items = Array.isArray(record.items)
      ? record.items.map((item, itemIndex) => normalizeTeamItem(item, itemIndex)).filter((item): item is ODEWorkstreamTeamItem => Boolean(item))
      : [];
    return { id, type: "team", title: title || "Team", collapsed, reasoning, items };
  }

  if (record.type === "collaboration") {
    const items = Array.isArray(record.items)
      ? record.items
          .map((item, itemIndex) => normalizeCollaborationItem(item, itemIndex))
          .filter((item): item is ODEWorkstreamCollaborationItem => Boolean(item))
      : [];
    return { id, type: "collaboration", title: title || "Collaboration", collapsed, reasoning, items };
  }

  const items = Array.isArray(record.items)
    ? record.items.map((item, itemIndex) => normalizeTaskItem(item, itemIndex)).filter((item): item is ODEWorkstreamTaskItem => Boolean(item))
    : [];
  return { id, type: "tasks", title: title || "Tasks", collapsed, reasoning, items };
}

function normalizeWorkspace(
  raw: unknown,
  fallbackSourceNodeId: string
): ODEWorkstreamWorkspace | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const sections = Array.isArray(record.sections)
    ? record.sections.map((section, index) => normalizeSection(section, index)).filter((section): section is ODEWorkstreamSection => Boolean(section))
    : [];
  if (sections.length === 0) return null;
  const sources = Array.isArray(record.sources)
    ? record.sources.map((source, index) => normalizeSource(source, index)).filter((source): source is ODEWorkstreamSource => Boolean(source))
    : [];
  return {
    version: 1,
    sourceNodeId:
      typeof record.sourceNodeId === "string" && record.sourceNodeId.trim().length > 0
        ? record.sourceNodeId.trim()
        : fallbackSourceNodeId,
    deliverableId:
      typeof record.deliverableId === "string" && record.deliverableId.trim().length > 0 ? record.deliverableId.trim() : null,
    generatedBy: record.generatedBy === "manual" ? "manual" : "ai",
    generatedAt:
      typeof record.generatedAt === "string" && record.generatedAt.trim().length > 0
        ? record.generatedAt.trim()
        : new Date().toISOString(),
    summary: typeof record.summary === "string" ? record.summary.trim() : "",
    confidence: typeof record.confidence === "number" && Number.isFinite(record.confidence) ? record.confidence : 0,
    sources,
    sections
  };
}

function normalizeWorkspaceCollectionValue(
  raw: unknown,
  fallbackSourceNodeId: string
): ODEWorkstreamWorkspaceCollection | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (Array.isArray(record.workspaces)) {
    const workspaces = record.workspaces
      .map((workspace) => normalizeWorkspace(workspace, fallbackSourceNodeId))
      .filter((workspace): workspace is ODEWorkstreamWorkspace => Boolean(workspace));
    if (workspaces.length === 0) return null;
    return {
      version: 1,
      workspaces
    };
  }

  const legacyWorkspace = normalizeWorkspace(raw, fallbackSourceNodeId);
  if (!legacyWorkspace) return null;
  return {
    version: 1,
    workspaces: [legacyWorkspace]
  };
}

export function readWorkstreamWorkspaceCollection(node: AppNode | null): ODEWorkstreamWorkspaceCollection | null {
  const raw = node?.properties?.[ODE_WORKSTREAM_WORKSPACE_PROPERTY];
  return normalizeWorkspaceCollectionValue(raw, node?.id ?? "");
}

export function readWorkstreamWorkspace(node: AppNode | null, deliverableId?: string | null): ODEWorkstreamWorkspace | null {
  const collection = readWorkstreamWorkspaceCollection(node);
  if (!collection) return null;
  if (deliverableId === undefined) {
    return collection.workspaces[0] ?? null;
  }
  return collection.workspaces.find((workspace) => workspace.deliverableId === deliverableId) ?? null;
}

export function buildWorkstreamWorkspaceFromProposal(
  proposal: ODEWorkstreamWorkspaceProposal
): ODEWorkstreamWorkspace {
  return {
    version: 1,
    sourceNodeId: proposal.nodeId,
    deliverableId: proposal.deliverableId,
    generatedBy: "ai",
    generatedAt: new Date().toISOString(),
    summary: proposal.summary,
    confidence: proposal.confidence,
    sources: proposal.sources,
    sections: proposal.sections.map((section, index) => normalizeSection(section, index)).filter((section): section is ODEWorkstreamSection => Boolean(section))
  };
}

export function upsertWorkstreamWorkspaceCollection(
  existingValue: unknown,
  workspace: ODEWorkstreamWorkspace
): ODEWorkstreamWorkspaceCollection {
  const existing = normalizeWorkspaceCollectionValue(existingValue, workspace.sourceNodeId) ?? {
    version: 1 as const,
    workspaces: []
  };
  const nextWorkspaces = [...existing.workspaces];
  const existingIndex = nextWorkspaces.findIndex(
    (candidate) =>
      candidate.sourceNodeId === workspace.sourceNodeId &&
      candidate.deliverableId === workspace.deliverableId
  );
  if (existingIndex >= 0) {
    nextWorkspaces[existingIndex] = workspace;
  } else {
    nextWorkspaces.push(workspace);
  }
  return {
    version: 1,
    workspaces: nextWorkspaces
  };
}

export function buildExecutionTasksFromProposal(proposal: ODEWorkstreamWorkspaceProposal): ODEExecutionTaskItem[] {
  const section = proposal.sections.find((entry) => entry.type === "tasks");
  if (!section) return [];
  return section.items.map((item) => ({
    id: item.id,
    title: item.title.trim(),
    ownerName: item.ownerName ?? null,
    dueDate: item.dueDate ?? null,
    status: item.status,
    flagged: item.flagged,
    note: item.note ?? null
  }));
}
