import type { ScheduleStatus } from "@/lib/types";

export type TimelinePriority = "very_low" | "low" | "normal" | "high" | "urgent";

export const TIMELINE_STATUS_ORDER: ScheduleStatus[] = ["planned", "active", "blocked", "done"];
export const TIMELINE_PRIORITY_ORDER: TimelinePriority[] = ["very_low", "low", "normal", "high", "urgent"];

function areAllOrderedItemsSelected<T>(selectedItems: Set<T>, orderedItems: readonly T[]): boolean {
  return orderedItems.every((item) => selectedItems.has(item));
}

function toggleOrderedFilterSelection<T>(selectedItems: Set<T>, item: T, orderedItems: readonly T[]): Set<T> {
  if (areAllOrderedItemsSelected(selectedItems, orderedItems)) {
    return new Set<T>([item]);
  }

  if (selectedItems.size === 1 && selectedItems.has(item)) {
    return new Set(orderedItems);
  }

  const next = new Set(selectedItems);
  if (next.has(item)) {
    next.delete(item);
  } else {
    next.add(item);
  }

  if (next.size === 0) {
    return new Set(orderedItems);
  }

  return next;
}

export function createAllTimelineStatusFilters(): Set<ScheduleStatus> {
  return new Set(TIMELINE_STATUS_ORDER);
}

export function createAllTimelinePriorityFilters(): Set<TimelinePriority> {
  return new Set(TIMELINE_PRIORITY_ORDER);
}

export function areAllTimelineStatusesSelected(selectedStatuses: Set<ScheduleStatus>): boolean {
  return areAllOrderedItemsSelected(selectedStatuses, TIMELINE_STATUS_ORDER);
}

export function areAllTimelinePrioritiesSelected(selectedPriorities: Set<TimelinePriority>): boolean {
  return areAllOrderedItemsSelected(selectedPriorities, TIMELINE_PRIORITY_ORDER);
}

export function toggleTimelineStatusSelection(
  selectedStatuses: Set<ScheduleStatus>,
  status: ScheduleStatus
): Set<ScheduleStatus> {
  return toggleOrderedFilterSelection(selectedStatuses, status, TIMELINE_STATUS_ORDER);
}

export function toggleTimelinePrioritySelection(
  selectedPriorities: Set<TimelinePriority>,
  priority: TimelinePriority
): Set<TimelinePriority> {
  return toggleOrderedFilterSelection(selectedPriorities, priority, TIMELINE_PRIORITY_ORDER);
}
