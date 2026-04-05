import { normalizeIsoDateOnlyInput } from "@/features/timeline/date";
import { parseTimelineScheduleFromNode } from "@/features/timeline/model";
import {
  isDeclaredWorkareaOwnerNode,
  isWorkareaItemNode,
  isWorkareaRootNode
} from "@/features/workspace/workarea";
import {
  buildProcedureDatabaseModel,
  isProcedureFieldNode,
  PROCEDURE_RECORDS_PROPERTY_KEY
} from "@/lib/procedureDatabase";
import { isFileLikeNode, type AppNode } from "@/lib/types";

export const META_CAPABILITY_VALUES = ["structure", "data", "work", "time", "insight"] as const;
export type MetaCapability = (typeof META_CAPABILITY_VALUES)[number];

export const META_VIEW_VALUES = ["organisation", "database", "execution", "timeline", "dashboard"] as const;
export type MetaViewKind = (typeof META_VIEW_VALUES)[number];

export const META_ROLE_VALUES = [
  "workspace_root",
  "table",
  "field",
  "record_source",
  "execution_owner",
  "execution_item",
  "timeline_item",
  "dashboard_root",
  "dashboard_widget",
  "file",
  "generic"
] as const;
export type MetaNodeRole = (typeof META_ROLE_VALUES)[number];

export type MetaDataSourceSummary = {
  nodeId: string;
  label: string;
  fieldCount: number;
  recordCount: number;
};

export type MetaNodeProfile = {
  nodeId: string;
  roles: MetaNodeRole[];
  explicitCapabilities: MetaCapability[];
  inferredCapabilities: MetaCapability[];
  capabilities: MetaCapability[];
  views: MetaViewKind[];
};

export type WorkspaceMetaModel = {
  profiles: MetaNodeProfile[];
  profilesByNodeId: Map<string, MetaNodeProfile>;
  capabilityCounts: Record<MetaCapability, number>;
  viewCounts: Record<MetaViewKind, number>;
  viewAvailability: Record<MetaViewKind, boolean>;
  dataSources: MetaDataSourceSummary[];
  meaningfulNodeCount: number;
  emptyWorkspace: boolean;
  tableCount: number;
  fieldCount: number;
  executionOwnerCount: number;
  executionItemCount: number;
  scheduledNodeCount: number;
  dashboardCount: number;
  dashboardWidgetCount: number;
};

function createCapabilityCounter(): Record<MetaCapability, number> {
  return {
    structure: 0,
    data: 0,
    work: 0,
    time: 0,
    insight: 0
  };
}

function createViewCounter(): Record<MetaViewKind, number> {
  return {
    organisation: 0,
    database: 0,
    execution: 0,
    timeline: 0,
    dashboard: 0
  };
}

function normalizeMetaCapability(value: unknown): MetaCapability | null {
  return typeof value === "string" && META_CAPABILITY_VALUES.includes(value as MetaCapability)
    ? (value as MetaCapability)
    : null;
}

export function readExplicitMetaCapabilities(properties: Record<string, unknown> | undefined): MetaCapability[] {
  const raw = properties?.odeMetaCapabilities;
  if (!Array.isArray(raw)) return [];
  const seen = new Set<MetaCapability>();
  const next: MetaCapability[] = [];
  for (const entry of raw) {
    const normalized = normalizeMetaCapability(entry);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    next.push(normalized);
  }
  return next;
}

export function mergeNodeMetaCapabilities(
  properties: Record<string, unknown> | undefined,
  capabilities: MetaCapability[]
): Record<string, unknown> {
  const next = { ...(properties ?? {}) };
  const normalized = capabilities
    .map((capability) => normalizeMetaCapability(capability))
    .filter((capability): capability is MetaCapability => capability !== null);
  if (normalized.length === 0) {
    delete next.odeMetaCapabilities;
    return next;
  }
  next.odeMetaCapabilities = Array.from(new Set(normalized));
  return next;
}

function hasProcedureRecords(node: AppNode): boolean {
  return Array.isArray(node.properties?.[PROCEDURE_RECORDS_PROPERTY_KEY]);
}

function hasStructuredDeliverables(node: AppNode): boolean {
  return Array.isArray(node.properties?.odeStructuredDeliverables) && node.properties.odeStructuredDeliverables.length > 0;
}

function isDashboardRootNode(node: AppNode): boolean {
  return node.properties?.odeDashboard === true;
}

function isDashboardWidgetNode(node: AppNode): boolean {
  return node.properties?.odeDashboardWidget === true;
}

function deriveViewsFromCapabilities(capabilities: Iterable<MetaCapability>): MetaViewKind[] {
  const next = new Set<MetaViewKind>();
  for (const capability of capabilities) {
    if (capability === "structure") next.add("organisation");
    if (capability === "data") next.add("database");
    if (capability === "work") next.add("execution");
    if (capability === "time") next.add("timeline");
    if (capability === "insight") next.add("dashboard");
  }
  return META_VIEW_VALUES.filter((view) => next.has(view));
}

export function buildWorkspaceMetaModel(params: {
  nodes: AppNode[];
  activeProjectRootId?: string | null;
}): WorkspaceMetaModel {
  const procedureModel = buildProcedureDatabaseModel(params.nodes);
  const tableIds = new Set(procedureModel.tables.map((table) => table.node.id));
  const fieldIds = new Set(
    params.nodes.filter((node) => isProcedureFieldNode(node)).map((node) => node.id)
  );
  const dataSources = procedureModel.tables.map((table) => ({
    nodeId: table.node.id,
    label: table.node.name,
    fieldCount: table.fields.length,
    recordCount: table.records.length
  }));

  const profiles: MetaNodeProfile[] = params.nodes.map((node) => {
    const roles = new Set<MetaNodeRole>();
    if (node.id === params.activeProjectRootId) {
      roles.add("workspace_root");
    }
    if (isFileLikeNode(node)) {
      roles.add("file");
    }
    if (tableIds.has(node.id)) {
      roles.add("table");
      roles.add("record_source");
    }
    if (fieldIds.has(node.id)) {
      roles.add("field");
    }
    if (isDeclaredWorkareaOwnerNode(node) || hasStructuredDeliverables(node)) {
      roles.add("execution_owner");
    }
    if (isWorkareaItemNode(node)) {
      roles.add("execution_item");
    }
    if (parseTimelineScheduleFromNode(node, normalizeIsoDateOnlyInput)) {
      roles.add("timeline_item");
    }
    if (isDashboardRootNode(node)) {
      roles.add("dashboard_root");
    }
    if (isDashboardWidgetNode(node)) {
      roles.add("dashboard_widget");
    }
    if (roles.size === 0) {
      roles.add("generic");
    }

    const explicitCapabilities = readExplicitMetaCapabilities(node.properties);
    const inferred = new Set<MetaCapability>();
    if (!isFileLikeNode(node) && !isWorkareaRootNode(node)) {
      inferred.add("structure");
    }
    if (tableIds.has(node.id) || fieldIds.has(node.id) || hasProcedureRecords(node)) {
      inferred.add("data");
    }
    if (roles.has("execution_owner") || roles.has("execution_item")) {
      inferred.add("work");
      inferred.add("time");
    }
    if (roles.has("timeline_item")) {
      inferred.add("time");
    }
    if (roles.has("dashboard_root") || roles.has("dashboard_widget")) {
      inferred.add("insight");
    }

    const capabilities = Array.from(new Set<MetaCapability>([...explicitCapabilities, ...inferred]));
    const views = deriveViewsFromCapabilities(capabilities);

    return {
      nodeId: node.id,
      roles: META_ROLE_VALUES.filter((role) => roles.has(role)),
      explicitCapabilities,
      inferredCapabilities: META_CAPABILITY_VALUES.filter((capability) => inferred.has(capability)),
      capabilities: META_CAPABILITY_VALUES.filter((capability) => capabilities.includes(capability)),
      views
    };
  });

  const profilesByNodeId = new Map(profiles.map((profile) => [profile.nodeId, profile] as const));
  const capabilityCounts = createCapabilityCounter();
  const viewCounts = createViewCounter();
  let meaningfulNodeCount = 0;
  let tableCount = 0;
  let fieldCount = 0;
  let executionOwnerCount = 0;
  let executionItemCount = 0;
  let scheduledNodeCount = 0;
  let dashboardCount = 0;
  let dashboardWidgetCount = 0;

  for (const profile of profiles) {
    const isWorkspaceRoot = profile.roles.includes("workspace_root");
    if (!isWorkspaceRoot) {
      meaningfulNodeCount += 1;
    }
    if (profile.roles.includes("table")) tableCount += 1;
    if (profile.roles.includes("field")) fieldCount += 1;
    if (profile.roles.includes("execution_owner")) executionOwnerCount += 1;
    if (profile.roles.includes("execution_item")) executionItemCount += 1;
    if (profile.roles.includes("timeline_item")) scheduledNodeCount += 1;
    if (profile.roles.includes("dashboard_root")) dashboardCount += 1;
    if (profile.roles.includes("dashboard_widget")) dashboardWidgetCount += 1;

    if (isWorkspaceRoot) continue;
    for (const capability of profile.capabilities) {
      capabilityCounts[capability] += 1;
    }
    for (const view of profile.views) {
      viewCounts[view] += 1;
    }
  }

  const viewAvailability: Record<MetaViewKind, boolean> = {
    organisation: viewCounts.organisation > 0,
    database: tableCount > 0 || viewCounts.database > 0,
    execution: executionOwnerCount > 0 || executionItemCount > 0 || viewCounts.execution > 0,
    timeline: scheduledNodeCount > 0 || viewCounts.timeline > 0,
    dashboard: dashboardCount > 0 || dashboardWidgetCount > 0 || viewCounts.dashboard > 0
  };

  return {
    profiles,
    profilesByNodeId,
    capabilityCounts,
    viewCounts,
    viewAvailability,
    dataSources,
    meaningfulNodeCount,
    emptyWorkspace: meaningfulNodeCount === 0,
    tableCount,
    fieldCount,
    executionOwnerCount,
    executionItemCount,
    scheduledNodeCount,
    dashboardCount,
    dashboardWidgetCount
  };
}
