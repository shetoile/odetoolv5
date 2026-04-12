import type { AppNode, NodeType, ProjectSummary } from "@/lib/types";

export function createAppNode(overrides: Partial<AppNode> & Pick<AppNode, "id" | "name">): AppNode {
  return {
    id: overrides.id,
    parentId: overrides.parentId ?? "__ROOT__",
    name: overrides.name,
    type: overrides.type ?? ("folder" satisfies NodeType),
    properties: overrides.properties ?? {},
    description: overrides.description ?? null,
    order: overrides.order ?? 0,
    createdAt: overrides.createdAt ?? 0,
    updatedAt: overrides.updatedAt ?? 0,
    contentType: overrides.contentType,
    aiDraft: overrides.aiDraft,
    content: overrides.content ?? null
  };
}

export function createProjectSummary(
  overrides: Partial<ProjectSummary> & Pick<ProjectSummary, "id" | "name" | "rootNodeId">
): ProjectSummary {
  return {
    id: overrides.id,
    name: overrides.name,
    rootNodeId: overrides.rootNodeId,
    rootPath: overrides.rootPath ?? "workspace://internal/test",
    createdAt: overrides.createdAt ?? 0,
    updatedAt: overrides.updatedAt ?? 0
  };
}
