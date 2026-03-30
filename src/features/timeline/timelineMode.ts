export type WorkspaceFocusMode = "structure" | "data" | "execution";
export type TimelineMode = "schedule" | "tasks";

type TranslateFn = (key: string) => string;

export function resolveTimelineMode(workspaceFocusMode: WorkspaceFocusMode): TimelineMode {
  return workspaceFocusMode === "execution" ? "tasks" : "schedule";
}

export function getTimelineModeHint(t: TranslateFn, timelineMode: TimelineMode): string {
  return timelineMode === "tasks" ? t("timeline.mode_tasks_hint") : t("timeline.mode_schedule_hint");
}

export function getTimelineEmptyStateMessage(
  t: TranslateFn,
  timelineMode: TimelineMode,
  hasTimelineTaskSearch: boolean,
  hasActiveTimelineScheduleFiltering: boolean
): string {
  const hasFilters = hasTimelineTaskSearch || hasActiveTimelineScheduleFiltering;
  if (timelineMode === "tasks") {
    return hasFilters ? t("timeline.empty_tasks_filtered") : t("timeline.empty_tasks");
  }
  return hasFilters ? t("timeline.empty_schedule_filtered") : t("timeline.empty_schedule");
}

export function shouldShowTimelineCreateFirstNodeAction(
  timelineMode: TimelineMode,
  hasTimelineTaskSearch: boolean,
  hasActiveTimelineScheduleFiltering: boolean
): boolean {
  return timelineMode === "schedule" && !(hasTimelineTaskSearch || hasActiveTimelineScheduleFiltering);
}
