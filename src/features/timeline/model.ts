import type { TimelinePriority } from "@/features/timeline/filterState";
import { resolveScheduleProgressFromStatus } from "@/features/timeline/presentation";
import type { AppNode, ScheduleStatus } from "@/lib/types";

export type ScheduleMode = "manual" | "auto";

export type NodeTimelineSchedule = {
  title: string;
  status: ScheduleStatus;
  startDate: string;
  endDate: string;
  assignees: string[];
  priority: TimelinePriority;
  progress: number;
  predecessor: string;
  mode?: ScheduleMode;
};

export function parseTimelineScheduleFromNode(
  node: AppNode,
  normalizeIsoDateOnlyInput: (raw: unknown) => string
): NodeTimelineSchedule | null {
  const raw = node.properties?.timelineSchedule;
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const title = typeof obj.title === "string" && obj.title.trim().length > 0 ? obj.title : node.name;
  const statusRaw = typeof obj.status === "string" ? obj.status : "planned";
  const status: ScheduleStatus =
    statusRaw === "active" || statusRaw === "blocked" || statusRaw === "done" ? statusRaw : "planned";
  const startDate = normalizeIsoDateOnlyInput(obj.startDate);
  const endDate = normalizeIsoDateOnlyInput(obj.endDate);
  const assignees = Array.isArray(obj.assignees)
    ? obj.assignees
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry): entry is string => entry.length > 0)
    : typeof obj.assignees === "string"
      ? obj.assignees
          .split(/[;,]/)
          .map((entry) => entry.trim())
          .filter((entry): entry is string => entry.length > 0)
      : typeof obj.owner === "string"
        ? obj.owner
            .split(/[;,]/)
            .map((entry) => entry.trim())
            .filter((entry): entry is string => entry.length > 0)
        : [];
  const priorityRaw = typeof obj.priority === "string" ? obj.priority.trim().toLowerCase() : "normal";
  const priority: TimelinePriority =
    priorityRaw === "very_low" || priorityRaw === "low" || priorityRaw === "high" || priorityRaw === "urgent"
      ? priorityRaw
      : "normal";
  const parsedProgress = typeof obj.progress === "number" ? obj.progress : Number(obj.progress);
  const progress = resolveScheduleProgressFromStatus(status, Number.isFinite(parsedProgress) ? parsedProgress : 0);
  const predecessor = typeof obj.predecessor === "string" ? obj.predecessor : "";
  const mode: ScheduleMode = obj.mode === "manual" ? "manual" : "auto";
  if (!startDate || !endDate) return null;

  return {
    title,
    status,
    startDate,
    endDate,
    assignees,
    priority,
    progress,
    predecessor,
    mode
  };
}

export function normalizeTimelineSchedule(schedule: NodeTimelineSchedule): NodeTimelineSchedule {
  const nextProgress = resolveScheduleProgressFromStatus(schedule.status, schedule.progress);
  if (nextProgress === schedule.progress) {
    return schedule;
  }

  return {
    ...schedule,
    progress: nextProgress
  };
}

export function getAggregateStatusFromChildren(children: NodeTimelineSchedule[]): ScheduleStatus {
  if (children.length === 0) return "planned";
  if (children.every((schedule) => schedule.status === "done")) return "done";
  if (children.some((schedule) => schedule.status === "blocked")) return "blocked";
  if (children.some((schedule) => schedule.status === "active")) return "active";
  return "planned";
}

export function getAggregateProgressFromChildren(children: NodeTimelineSchedule[]): number {
  if (children.length === 0) return 0;
  const total = children.reduce(
    (sum, schedule) => sum + Math.max(0, Math.min(100, schedule.progress ?? 0)),
    0
  );
  return Math.round(total / children.length);
}

export function areSchedulesEquivalent(
  a: NodeTimelineSchedule | null,
  b: NodeTimelineSchedule | null
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  const modeA: ScheduleMode = a.mode === "auto" ? "auto" : "manual";
  const modeB: ScheduleMode = b.mode === "auto" ? "auto" : "manual";

  return (
    a.title === b.title &&
    a.status === b.status &&
    a.startDate === b.startDate &&
    a.endDate === b.endDate &&
    a.priority === b.priority &&
    a.progress === b.progress &&
    a.assignees.join("|") === b.assignees.join("|") &&
    a.predecessor === b.predecessor &&
    modeA === modeB
  );
}
