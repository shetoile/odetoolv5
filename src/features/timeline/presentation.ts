import type { ScheduleStatus } from "@/lib/types";
import type { TimelinePriority } from "@/features/timeline/filterState";

function clampTimelineProgress(progress: number): number {
  return Math.max(0, Math.min(100, Math.round(progress)));
}

export function resolveScheduleProgressFromStatus(
  status: ScheduleStatus,
  progress: number
): number {
  if (status === "planned") return 0;
  if (status === "done") return 100;
  return clampTimelineProgress(progress);
}

export function getTimelineStatusClass(status: ScheduleStatus): string {
  if (status === "active") return "ode-timeline-status-active";
  if (status === "blocked") return "ode-timeline-status-blocked";
  if (status === "done") return "ode-timeline-status-done";
  return "ode-timeline-status-planned";
}

export function getTimelinePriorityClass(priority: TimelinePriority): string {
  if (priority === "very_low") return "ode-timeline-priority-very-low";
  if (priority === "low") return "ode-timeline-priority-low";
  if (priority === "high") return "ode-timeline-priority-high";
  if (priority === "urgent") return "ode-timeline-priority-urgent";
  return "ode-timeline-priority-normal";
}
