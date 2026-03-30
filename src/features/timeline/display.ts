import type { TimelinePriority } from "@/features/timeline/filterState";
import type { AppNode } from "@/lib/types";

type TimelinePriorityLike = {
  priority?: TimelinePriority | null;
};

type TimelineScheduleLookupEntryLike = {
  schedule: TimelinePriorityLike | null | undefined;
};

export function isTimelinePriorityFlagged(priority: TimelinePriority): boolean {
  return priority === "high" || priority === "urgent";
}

export function isTimelineScheduleFlagged(
  schedule: TimelinePriorityLike | null | undefined
): boolean {
  return Boolean(schedule && isTimelinePriorityFlagged(schedule.priority ?? "normal"));
}

export function resolveTimelineNodeFlagged(params: {
  nodeId: string;
  nodeById: Map<string, AppNode>;
  timelineScheduleByNodeId: Map<string, TimelineScheduleLookupEntryLike>;
}): boolean {
  const node = params.nodeById.get(params.nodeId) ?? null;
  if (typeof node?.properties?.odeExecutionTaskFlagged === "boolean") {
    return node.properties.odeExecutionTaskFlagged;
  }
  return isTimelineScheduleFlagged(params.timelineScheduleByNodeId.get(params.nodeId)?.schedule);
}

export function compareTimelineNodeFlaggedState(params: {
  leftNodeId: string;
  rightNodeId: string;
  prioritizeFlagged: boolean;
  isTimelineNodeFlagged: (nodeId: string) => boolean;
}): number {
  if (!params.prioritizeFlagged) return 0;

  const leftFlagged = params.isTimelineNodeFlagged(params.leftNodeId);
  const rightFlagged = params.isTimelineNodeFlagged(params.rightNodeId);
  if (leftFlagged === rightFlagged) {
    return 0;
  }

  return leftFlagged ? -1 : 1;
}

export function sortTimelineNodesByFlaggedState<TNode extends { id: string }>(params: {
  nodes: TNode[];
  prioritizeFlagged: boolean;
  isTimelineNodeFlagged: (nodeId: string) => boolean;
}): TNode[] {
  if (!params.prioritizeFlagged || params.nodes.length < 2) {
    return params.nodes;
  }

  return params.nodes
    .map((node, index) => ({ node, index }))
    .sort((left, right) => {
      const flaggedCompare = compareTimelineNodeFlaggedState({
        leftNodeId: left.node.id,
        rightNodeId: right.node.id,
        prioritizeFlagged: params.prioritizeFlagged,
        isTimelineNodeFlagged: params.isTimelineNodeFlagged
      });
      if (flaggedCompare !== 0) {
        return flaggedCompare;
      }
      return left.index - right.index;
    })
    .map((entry) => entry.node);
}
