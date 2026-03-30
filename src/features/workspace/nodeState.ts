import { normalizeIsoDateOnlyInput } from "@/features/timeline/date";
import { parseTimelineScheduleFromNode } from "@/features/timeline/model";
import {
  areAllNodeStateFiltersSelected,
  type NodeStateFilter
} from "@/features/workspace/viewMode";
import { isHiddenExecutionTaskNode } from "@/features/workspace/execution";
import { isWorkareaItemNode } from "@/features/workspace/workarea";
import { isFileLikeNode, type AppNode, type FolderNodeState } from "@/lib/types";

export function resolveFolderNodeState(
  hasSchedule: boolean,
  hasData: boolean
): FolderNodeState {
  if (hasSchedule && hasData) return "filled";
  if (hasSchedule) return "task_only";
  if (hasData) return "data_only";
  return "empty";
}

export function hasOwnNodeSchedule(node: AppNode, childCount: number): boolean {
  const schedule = parseTimelineScheduleFromNode(node, normalizeIsoDateOnlyInput);
  if (!schedule) return false;
  if (schedule.mode === "manual") return true;
  return childCount === 0;
}

export function getFolderNodeStateLabel(state: FolderNodeState): string {
  if (state === "task_only") return "TASK_ONLY";
  if (state === "data_only") return "DATA_ONLY";
  if (state === "filled") return "FILLED";
  return "EMPTY";
}

export function doesNodeMatchNodeStateFilters(
  node: AppNode,
  filters: Set<NodeStateFilter>,
  folderStateById: Map<string, FolderNodeState>,
  executionOwnerNodeIds: Set<string>
): boolean {
  const allSelected = areAllNodeStateFiltersSelected(filters);
  if (filters.size === 0 || allSelected) return true;

  const taskFocusedOnlyFilter =
    filters.size === 1 && (filters.has("task") || filters.has("execution"));

  if (isFileLikeNode(node)) {
    return filters.has("data");
  }

  if (node.type === "task") {
    return isHiddenExecutionTaskNode(node)
      ? filters.has("execution")
      : filters.has("task");
  }

  if (isWorkareaItemNode(node)) {
    return filters.has("execution");
  }

  if (executionOwnerNodeIds.has(node.id) && filters.has("execution")) {
    return true;
  }

  if (taskFocusedOnlyFilter) {
    return false;
  }

  const state = folderStateById.get(node.id) ?? "empty";
  if (state === "empty") return filters.has("empty");
  if (state === "filled") return filters.has("task") && filters.has("data");
  if (state === "task_only") return filters.has("task");
  return filters.has("data");
}

export function shouldForceTaskFilterParents(filters: Set<NodeStateFilter>): boolean {
  return filters.has("task") || filters.has("execution");
}
