import type { AppNode } from "@/lib/types";

type ScheduleLike = {
  startDate: string;
  endDate: string;
  mode?: string;
};

export function buildEffectiveTimelineScheduleMap<TSchedule extends ScheduleLike>(params: {
  nodes: AppNode[];
  nodeById: Map<string, AppNode>;
  byParent: Map<string, AppNode[]>;
  parseNodeTimelineSchedule: (node: AppNode) => TSchedule | null;
  shouldRespectManualSchedule?: (
    node: AppNode,
    current: TSchedule | null,
    children: AppNode[],
    childSchedules: TSchedule[]
  ) => boolean;
  compareIsoDate: (left: string, right: string) => number;
  createRollupSchedule: (
    node: AppNode,
    childSchedules: TSchedule[],
    earliestStart: string,
    latestEnd: string
  ) => TSchedule;
}): Map<string, TSchedule | null> {
  const effectiveScheduleByNodeId = new Map<string, TSchedule | null>();

  const resolveEffectiveSchedule = (nodeId: string): TSchedule | null => {
    if (effectiveScheduleByNodeId.has(nodeId)) {
      return effectiveScheduleByNodeId.get(nodeId) ?? null;
    }

    const node = params.nodeById.get(nodeId);
    if (!node) {
      effectiveScheduleByNodeId.set(nodeId, null);
      return null;
    }

    const current = params.parseNodeTimelineSchedule(node);
    const children = params.byParent.get(nodeId) ?? [];

    if (children.length === 0) {
      effectiveScheduleByNodeId.set(nodeId, current);
      return current;
    }

    const childSchedules = children
      .map((child) => resolveEffectiveSchedule(child.id))
      .filter((schedule): schedule is TSchedule => Boolean(schedule));

    const shouldRespectManualSchedule =
      current?.mode === "manual" &&
      (params.shouldRespectManualSchedule
        ? params.shouldRespectManualSchedule(node, current, children, childSchedules)
        : childSchedules.length === 0);
    if (shouldRespectManualSchedule) {
      effectiveScheduleByNodeId.set(nodeId, current);
      return current;
    }

    if (childSchedules.length === 0) {
      effectiveScheduleByNodeId.set(nodeId, null);
      return null;
    }

    let earliestStart = childSchedules[0].startDate;
    let latestEnd = childSchedules[0].endDate;
    for (let index = 1; index < childSchedules.length; index += 1) {
      const childSchedule = childSchedules[index];
      if (params.compareIsoDate(childSchedule.startDate, earliestStart) < 0) {
        earliestStart = childSchedule.startDate;
      }
      if (params.compareIsoDate(childSchedule.endDate, latestEnd) > 0) {
        latestEnd = childSchedule.endDate;
      }
    }

    const next = params.createRollupSchedule(node, childSchedules, earliestStart, latestEnd);
    effectiveScheduleByNodeId.set(nodeId, next);
    return next;
  };

  for (const node of params.nodes) {
    void resolveEffectiveSchedule(node.id);
  }

  return effectiveScheduleByNodeId;
}

export function buildAutoSchedulePropertyUpdates<TSchedule>(params: {
  nodes: AppNode[];
  byParent: Map<string, AppNode[]>;
  parseNodeTimelineSchedule: (node: AppNode) => TSchedule | null;
  effectiveScheduleByNodeId: Map<string, TSchedule | null>;
  areSchedulesEquivalent: (left: TSchedule | null, right: TSchedule | null) => boolean;
}): Array<{ id: string; nextProperties: Record<string, unknown> }> {
  const updates: Array<{ id: string; nextProperties: Record<string, unknown> }> = [];

  for (const node of params.nodes) {
    const children = params.byParent.get(node.id) ?? [];
    if (children.length === 0) continue;

    const current = params.parseNodeTimelineSchedule(node);
    const desired = params.effectiveScheduleByNodeId.get(node.id) ?? null;

    if (!desired) {
      if (current) {
        const nextProperties: Record<string, unknown> = {
          ...(node.properties ?? {})
        };
        delete nextProperties.timelineSchedule;
        updates.push({ id: node.id, nextProperties });
      }
      continue;
    }

    if (!params.areSchedulesEquivalent(current, desired)) {
      updates.push({
        id: node.id,
        nextProperties: {
          ...(node.properties ?? {}),
          timelineSchedule: desired
        }
      });
    }
  }

  return updates;
}

export function buildTimelineScheduleLookup<TSchedule extends ScheduleLike>(params: {
  nodes: AppNode[];
  projectScopedNodeIds: Set<string> | null;
  effectiveScheduleByNodeId: Map<string, TSchedule | null>;
  timelineDayIndexByDate: Map<string, number>;
  timelineDayRanges: Array<{ date: string }>;
  parseIsoDateOnly: (value: string) => Date | null;
  toIsoDateOnly: (date: Date) => string;
}): Map<
  string,
  {
    schedule: TSchedule;
    startDayIndex: number;
    endDayIndex: number;
    durationDays: number;
  }
> {
  const map = new Map<
    string,
    {
      schedule: TSchedule;
      startDayIndex: number;
      endDayIndex: number;
      durationDays: number;
    }
  >();

  const candidates = params.projectScopedNodeIds
    ? params.nodes.filter((node) => params.projectScopedNodeIds?.has(node.id))
    : params.nodes;

  const visibleStartDay = params.timelineDayRanges[0] ?? null;
  const visibleEndDay = params.timelineDayRanges[params.timelineDayRanges.length - 1] ?? null;
  const visibleStart = visibleStartDay ? params.parseIsoDateOnly(visibleStartDay.date) : null;
  const visibleEnd = visibleEndDay ? params.parseIsoDateOnly(visibleEndDay.date) : null;
  if (!visibleStart || !visibleEnd) {
    return map;
  }

  const visibleStartMs = visibleStart.getTime();
  const visibleEndMs = visibleEnd.getTime();

  for (const node of candidates) {
    if (node.type === "file") continue;
    const schedule = params.effectiveScheduleByNodeId.get(node.id) ?? null;
    if (!schedule) continue;

    const start = params.parseIsoDateOnly(schedule.startDate);
    const end = params.parseIsoDateOnly(schedule.endDate);
    if (!start || !end) continue;

    const startMsRaw = Math.min(start.getTime(), end.getTime());
    const endMsRaw = Math.max(start.getTime(), end.getTime());
    const clippedStartMs = Math.max(startMsRaw, visibleStartMs);
    const clippedEndMs = Math.min(endMsRaw, visibleEndMs);
    if (clippedStartMs > clippedEndMs) continue;

    const startDayIndex =
      params.timelineDayIndexByDate.get(params.toIsoDateOnly(new Date(clippedStartMs))) ?? -1;
    const endDayIndex =
      params.timelineDayIndexByDate.get(params.toIsoDateOnly(new Date(clippedEndMs))) ?? -1;
    if (startDayIndex < 0 || endDayIndex < 0) continue;

    map.set(node.id, {
      schedule,
      startDayIndex,
      endDayIndex,
      durationDays: Math.max(1, Math.floor((clippedEndMs - clippedStartMs) / 86400000) + 1)
    });
  }

  return map;
}
