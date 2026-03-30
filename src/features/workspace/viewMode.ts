export type NodeStateFilter = "empty" | "filled" | "task" | "execution" | "data";
export type WorkspaceMode = "grid" | "timeline";
export type DesktopViewMode = "grid" | "mindmap" | "details" | "procedure";
export type SelectionSurface = "tree" | "grid" | "timeline";
export type WorkspaceFocusMode = "structure" | "data" | "execution";

export const NODE_STATE_FILTER_ALL: NodeStateFilter[] = ["empty", "task", "execution", "data"];

export function createAllNodeStateFilters(): Set<NodeStateFilter> {
  return new Set(NODE_STATE_FILTER_ALL);
}

export function areAllNodeStateFiltersSelected(filters: Set<NodeStateFilter>): boolean {
  return NODE_STATE_FILTER_ALL.every((filter) => filters.has(filter));
}

export function isStructureEmptyOnlyMode(filters: Set<NodeStateFilter>): boolean {
  return filters.size === 1 && filters.has("empty");
}

export function deriveWorkspaceFocusMode(filters: Set<NodeStateFilter>): WorkspaceFocusMode {
  const allSelected = areAllNodeStateFiltersSelected(filters);
  if (filters.size === 0 || allSelected || isStructureEmptyOnlyMode(filters)) return "structure";
  if (filters.has("data") && filters.size === 1) return "data";
  if (filters.has("execution") || filters.has("task")) return "execution";
  return "structure";
}

export function resolveNodeStateFiltersForWorkspaceFocusMode(mode: WorkspaceFocusMode): Set<NodeStateFilter> {
  if (mode === "structure") return createAllNodeStateFilters();
  if (mode === "data") return new Set<NodeStateFilter>(["data"]);
  return new Set<NodeStateFilter>(["execution"]);
}

export function toggleEmptyOnlyNodeStateFilters(workspaceEmptyOnly: boolean): Set<NodeStateFilter> {
  return workspaceEmptyOnly ? createAllNodeStateFilters() : new Set<NodeStateFilter>(["empty"]);
}

export function toggleNodeStateFilterSelection(
  previousFilters: Set<NodeStateFilter>,
  filter: NodeStateFilter
): Set<NodeStateFilter> {
  if (filter === "empty") {
    if (isStructureEmptyOnlyMode(previousFilters)) {
      return createAllNodeStateFilters();
    }
    return new Set<NodeStateFilter>(["empty"]);
  }

  if (areAllNodeStateFiltersSelected(previousFilters)) {
    return new Set<NodeStateFilter>([filter]);
  }

  const next = new Set(previousFilters);
  next.delete("empty");
  if (next.has(filter)) {
    next.delete(filter);
  } else {
    next.add(filter);
  }

  if (next.size === 0) {
    return createAllNodeStateFilters();
  }

  return next;
}

export function resolvePreferredViewForNodeStateFilters(filters: Set<NodeStateFilter>): {
  workspaceMode: WorkspaceMode;
  desktopViewMode?: DesktopViewMode;
  selectionSurface: SelectionSurface;
} {
  const allSelected = areAllNodeStateFiltersSelected(filters);
  if (filters.size === 0 || allSelected || (filters.size === 1 && (filters.has("empty") || filters.has("filled")))) {
    return {
      workspaceMode: "grid",
      desktopViewMode: "grid",
      selectionSurface: "grid"
    };
  }

  if (filters.has("task") || filters.has("execution")) {
    return {
      workspaceMode: "timeline",
      selectionSurface: "timeline"
    };
  }

  if (filters.has("data")) {
    return {
      workspaceMode: "grid",
      desktopViewMode: "details",
      selectionSurface: "grid"
    };
  }

  return {
    workspaceMode: "grid",
    desktopViewMode: "grid",
    selectionSurface: "grid"
  };
}
