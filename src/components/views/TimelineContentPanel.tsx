import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import {
  CalendarGlyphSmall,
  CollapseAllGlyphSmall,
  ExpandAllGlyphSmall,
  FlagGlyphSmall,
  NodeGlyph
} from "@/components/Icons";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import { getLocaleForLanguage, type LanguageCode, type TranslationParams } from "@/lib/i18n";
import type { AppNode, FolderNodeState, ScheduleStatus } from "@/lib/types";

type TranslateFn = (key: string, params?: TranslationParams) => string;
type DropPosition = "before" | "inside" | "after";
type SelectionSurface = "tree" | "grid" | "timeline";
type TreeRow = {
  id: string;
  node: AppNode;
  level: number;
  indexLabel: string;
  hasChildren: boolean;
  groupKind?: "deliverable";
};

type TimelineScheduleMeta = {
  schedule: {
    status: ScheduleStatus;
    startDate: string;
    endDate: string;
    title: string;
    assignees: string[];
    priority: "very_low" | "low" | "normal" | "high" | "urgent";
    progress: number;
    predecessor: string;
  };
  startDayIndex: number;
  endDayIndex: number;
};

type TimelineDayRange = {
  week: number;
  weekYear: number;
  monthIndex: number;
  year: number;
  date: string;
  weekdayIndex: number;
  isWeekend: boolean;
  label: string;
};

type TimelineDragMode = "move" | "resize-start" | "resize-end" | "create";

type TimelineDragState = {
  nodeId: string;
  mode: TimelineDragMode;
  originX: number;
  originScrollLeft: number;
  originStartDayIndex: number;
  originEndDayIndex: number;
  previewStartDayIndex: number;
  previewEndDayIndex: number;
  schedule: TimelineScheduleMeta["schedule"];
};

type DropIndicator = { targetId: string; position: DropPosition } | null;
const TIMELINE_TRANSPARENT = "rgba(0, 0, 0, 0)";
const TIMELINE_MONTH_DIVIDER_COLOR = "rgba(255, 142, 72, 0.64)";
const TIMELINE_WEEK_DIVIDER_COLOR = "rgba(46, 132, 191, 0.06)";
const TIMELINE_WEEKEND_HEADER_FILL =
  "linear-gradient(180deg, rgba(123, 33, 49, 0.3), rgba(70, 22, 33, 0.2))";
const TIMELINE_WEEKEND_BODY_FILL =
  "linear-gradient(180deg, rgba(132, 41, 57, 0.045), rgba(70, 22, 33, 0.03))";
const TIMELINE_WEEKEND_EDGE_COLOR = "rgba(226, 108, 129, 0.24)";
const TIMELINE_WEEKEND_BODY_EDGE_COLOR = "rgba(226, 108, 129, 0.06)";
const TIMELINE_TODAY_HEADER_FILL =
  "linear-gradient(180deg, rgba(30, 151, 160, 0.14), rgba(14, 91, 110, 0.1))";
const TIMELINE_TODAY_BODY_FILL =
  "linear-gradient(180deg, rgba(28, 168, 134, 0.04), rgba(8, 92, 87, 0.025))";
const TIMELINE_TODAY_EDGE_COLOR = "rgba(123, 240, 151, 0.42)";
const TIMELINE_TODAY_BODY_EDGE_COLOR = "rgba(123, 240, 151, 0.22)";
const TIMELINE_TODAY_HEADER_SHADOW =
  "inset 1px 0 0 rgba(123, 240, 151, 0.44), inset -1px 0 0 rgba(123, 240, 151, 0.44)";
const TIMELINE_TODAY_BODY_SHADOW =
  "inset 1px 0 0 rgba(123, 240, 151, 0.24), inset -1px 0 0 rgba(123, 240, 151, 0.24)";
const TIMELINE_EDGE_AUTOSCROLL_THRESHOLD = 88;
const TIMELINE_EDGE_AUTOSCROLL_EPSILON = 1;

type TimelineBoundaryLine = {
  key: string;
  left: number;
  width: number;
  color: string;
  kind: "month" | "week";
};

type TimelineHighlightColumn = {
  key: string;
  left: number;
  width: number;
};

type TimelineRowMetric = {
  row: TreeRow;
  height: number;
  lineCount: number;
  offsetTop: number;
};

const TIMELINE_ROW_EXTRA_LINE_HEIGHT = 18;
const TIMELINE_ROW_MAX_TEXT_LINES = 6;
const TIMELINE_ROW_AVERAGE_CHAR_WIDTH = 7.4;
const TIMELINE_ROW_CHROME_WIDTH = 124;
const TIMELINE_ROW_FLAG_WIDTH = 28;

function buildTimelineBandGradient(
  timelineDayRanges: TimelineDayRange[],
  timelineDayColumnWidth: number,
  resolveColor: (day: TimelineDayRange) => string
): string | null {
  if (timelineDayRanges.length === 0) return null;

  const totalWidth = timelineDayRanges.length * timelineDayColumnWidth;
  let currentColor = resolveColor(timelineDayRanges[0]);
  let segmentStart = 0;
  const stops: string[] = [];

  for (let index = 1; index < timelineDayRanges.length; index += 1) {
    const nextColor = resolveColor(timelineDayRanges[index]);
    if (nextColor === currentColor) continue;
    const offset = index * timelineDayColumnWidth;
    stops.push(`${currentColor} ${segmentStart}px`, `${currentColor} ${offset}px`);
    currentColor = nextColor;
    segmentStart = offset;
  }

  stops.push(`${currentColor} ${segmentStart}px`, `${currentColor} ${totalWidth}px`);
  return currentColor === TIMELINE_TRANSPARENT && stops.length === 2
    ? null
    : `linear-gradient(to right, ${stops.join(", ")})`;
}

function buildTimelineDayGridGradient(timelineDayColumnWidth: number): string | null {
  if (timelineDayColumnWidth <= 1) return null;
  return `repeating-linear-gradient(to right, rgba(122, 162, 189, 0.018) 0px, rgba(122, 162, 189, 0.018) 1px, ${TIMELINE_TRANSPARENT} 1px, ${TIMELINE_TRANSPARENT} ${timelineDayColumnWidth}px)`;
}

function buildTimelineLaneBackgroundStyle(
  timelineDayRanges: TimelineDayRange[],
  currentTimelineWeekKey: string | null,
  timelineDayColumnWidth: number
): CSSProperties {
  const fillGradient = buildTimelineBandGradient(
    timelineDayRanges,
    timelineDayColumnWidth,
    (day) => {
      if (day.isWeekend) return "rgba(62, 24, 33, 0.10)";
      if (currentTimelineWeekKey === `${day.weekYear}-${day.week}`) {
        return "rgba(10, 79, 125, 0.018)";
      }
      return TIMELINE_TRANSPARENT;
    }
  );
  const dayGridGradient = buildTimelineDayGridGradient(timelineDayColumnWidth);
  const layers = [dayGridGradient, fillGradient].filter((layer): layer is string => Boolean(layer));

  if (layers.length === 0) {
    return {};
  }

  return {
    backgroundImage: layers.join(", "),
    backgroundPosition: layers.map(() => "0 0").join(", "),
    backgroundRepeat: layers.map(() => "no-repeat").join(", "),
    backgroundSize: layers.map(() => "100% 100%").join(", ")
  };
}

function estimateWrappedLineCount(text: string, charsPerLine: number): number {
  const normalized = text.trim();
  if (!normalized) return 1;
  if (charsPerLine <= 1) return normalized.length;

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;

  let lines = 1;
  let currentLength = 0;

  for (const word of words) {
    const wordLength = word.length;
    if (wordLength > charsPerLine) {
      if (currentLength > 0) {
        lines += 1;
        currentLength = 0;
      }
      lines += Math.floor((wordLength - 1) / charsPerLine);
      currentLength = wordLength % charsPerLine;
      if (currentLength === 0) {
        currentLength = charsPerLine;
      }
      continue;
    }

    if (currentLength === 0) {
      currentLength = wordLength;
      continue;
    }

    if (currentLength + 1 + wordLength <= charsPerLine) {
      currentLength += 1 + wordLength;
      continue;
    }

    lines += 1;
    currentLength = wordLength;
  }

  return Math.max(1, lines);
}

function findTimelineRowIndexAtOffset(metrics: TimelineRowMetric[], offset: number): number {
  if (metrics.length === 0) return -1;
  let low = 0;
  let high = metrics.length - 1;
  let result = metrics.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const entry = metrics[mid];
    if (offset < entry.offsetTop + entry.height) {
      result = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return result;
}

interface TimelineContentPanelProps {
  t: TranslateFn;
  language: LanguageCode;
  timelineRows: TreeRow[];
  timelineDayRanges: TimelineDayRange[];
  currentTimelineWeekKey: string | null;
  timelineNodePanelWidth: number;
  isResizingTimelinePanel: boolean;
  timelineHeaderHeight: number;
  timelineRowHeight: number;
  timelineDayColumnWidth: number;
  timelineNodePanelMinWidth: number;
  timelineGridMinWidth: number;
  timelineNodePanelDefaultWidth: number;
  scopedRootDropTargetId: string;
  selectedNodeId: string | null;
  selectedNodeIds: Set<string>;
  expandedIds: Set<string>;
  cutPendingNodeIds: Set<string>;
  draggingNodeId: string | null;
  editingNodeId: string | null;
  editingSurface: SelectionSurface | null;
  editingValue: string;
  inlineEditInputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  dropIndicator: DropIndicator;
  isNodeProvisionalInlineCreate: (nodeId: string) => boolean;
  folderNodeStateById: Map<string, FolderNodeState>;
  executionOwnerNodeIds: Set<string>;
  timelineScheduleByNodeId: Map<string, TimelineScheduleMeta>;
  timelineLeftScrollRef: RefObject<HTMLDivElement | null>;
  timelineRightScrollRef: RefObject<HTMLDivElement | null>;
  onSyncTimelineVerticalScroll: (source: "left" | "right") => void;
  onActivateTimelineSurface: () => void;
  onOpenSurfaceContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  onResolveActiveDragSourceId: (event: DragEvent<HTMLElement>) => string | null;
  onSetDropIndicator: (next: DropIndicator) => void;
  onClearDraggingState: () => void;
  onApplyDropMove: (sourceId: string, targetId: string, position: DropPosition) => void;
  onCloseContextMenu: () => void;
  onSetPrimarySelection: (nodeId: string) => void;
  onApplyTimelineSelection: (nodeId: string, options: { range: boolean; toggle: boolean }) => void;
  onOpenNodeContextMenu: (event: ReactMouseEvent<HTMLElement>, nodeId: string) => void;
  onOpenDeliverableGroupContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    ownerNodeId: string,
    deliverableId: string,
    deliverableTitle: string
  ) => void;
  onBeginNodeDrag: (event: DragEvent<HTMLElement>, nodeId: string) => void;
  onDetectDropPosition: (event: DragEvent<HTMLElement>, targetNode?: AppNode) => DropPosition;
  onToggleExpand: (nodeId: string) => void;
  canExpandAllTimelineNodes: boolean;
  canCollapseAllTimelineNodes: boolean;
  onExpandAllTimelineNodes: () => void;
  onCollapseAllTimelineNodes: () => void;
  onOpenScheduleModal: (nodeId: string) => void;
  onSaveTimelineScheduleDirect: (nodeId: string, schedule: TimelineScheduleMeta["schedule"]) => Promise<void> | void;
  onStartTimelinePanelResize: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onSetTimelineNodePanelWidth: (next: number) => void;
  onClampTimelineNodePanelWidth: (next: number) => number;
  onNudgeTimelineNodePanelWidth: (delta: number) => void;
  onGetTimelineStatusClass: (status: ScheduleStatus) => string;
  onSetEditingValue: (value: string) => void;
  onOpenInlineEditContextMenu: (event: ReactMouseEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onCommitInlineEdit: () => Promise<void>;
  onCancelInlineEdit: () => void;
  emptyStateMessage: string;
  showCreateFirstNodeAction: boolean;
  onCreateFirstNode: () => void;
  onReviewFile: (nodeId: string) => void;
  prioritizeFlaggedTimelineTasks: boolean;
  isTimelineNodeFlagged: (nodeId: string) => boolean;
  onTogglePrioritizeFlaggedTimelineTasks: () => void;
}

export function TimelineContentPanel({
  t,
  language,
  timelineRows,
  timelineDayRanges,
  currentTimelineWeekKey,
  timelineNodePanelWidth,
  isResizingTimelinePanel,
  timelineHeaderHeight,
  timelineRowHeight,
  timelineDayColumnWidth,
  timelineNodePanelMinWidth,
  timelineGridMinWidth,
  timelineNodePanelDefaultWidth,
  scopedRootDropTargetId,
  selectedNodeId,
  selectedNodeIds,
  expandedIds,
  cutPendingNodeIds,
  draggingNodeId,
  editingNodeId,
  editingSurface,
  editingValue,
  inlineEditInputRef,
  dropIndicator,
  isNodeProvisionalInlineCreate,
  folderNodeStateById,
  executionOwnerNodeIds,
  timelineScheduleByNodeId,
  timelineLeftScrollRef,
  timelineRightScrollRef,
  onSyncTimelineVerticalScroll,
  onActivateTimelineSurface,
  onOpenSurfaceContextMenu,
  onResolveActiveDragSourceId,
  onSetDropIndicator,
  onClearDraggingState,
  onApplyDropMove,
  onCloseContextMenu,
  onSetPrimarySelection,
  onApplyTimelineSelection,
  onOpenNodeContextMenu,
  onOpenDeliverableGroupContextMenu,
  onBeginNodeDrag,
  onDetectDropPosition,
  onToggleExpand,
  canExpandAllTimelineNodes,
  canCollapseAllTimelineNodes,
  onExpandAllTimelineNodes,
  onCollapseAllTimelineNodes,
  onOpenScheduleModal,
  onSaveTimelineScheduleDirect,
  onStartTimelinePanelResize,
  onSetTimelineNodePanelWidth,
  onClampTimelineNodePanelWidth,
  onNudgeTimelineNodePanelWidth,
  onGetTimelineStatusClass,
  onSetEditingValue,
  onOpenInlineEditContextMenu,
  onCommitInlineEdit,
  onCancelInlineEdit,
  emptyStateMessage,
  showCreateFirstNodeAction,
  onCreateFirstNode,
  onReviewFile,
  prioritizeFlaggedTimelineTasks,
  isTimelineNodeFlagged,
  onTogglePrioritizeFlaggedTimelineTasks
}: TimelineContentPanelProps) {
  const [timelineScrollTop, setTimelineScrollTop] = useState(0);
  const [timelineViewportHeight, setTimelineViewportHeight] = useState(0);
  const [timelineDragState, setTimelineDragState] = useState<TimelineDragState | null>(null);
  const [timelineSavingNodeId, setTimelineSavingNodeId] = useState<string | null>(null);
  const timelineDragStateRef = useRef<TimelineDragState | null>(null);
  const autoAlignedTimelineDateRef = useRef<string | null>(null);
  const weekPrefix = t("timeline.week_prefix");
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const timelineMonthHeaderRowHeight = Math.max(22, Math.floor(timelineHeaderHeight * 0.3));
  const remainingHeaderHeight = Math.max(36, timelineHeaderHeight - timelineMonthHeaderRowHeight);
  const timelineWeekHeaderRowHeight = Math.max(24, Math.floor(remainingHeaderHeight * 0.52));
  const timelineDayHeaderRowHeight = Math.max(12, remainingHeaderHeight - timelineWeekHeaderRowHeight);
  const isTimelineDragActive = Boolean(timelineDragState);
  const locale = getLocaleForLanguage(language);
  const timelineGridWidth = useMemo(
    () => timelineDayRanges.length * timelineDayColumnWidth,
    [timelineDayColumnWidth, timelineDayRanges.length]
  );
  const timelineLaneBackgroundStyle = useMemo(
    () => buildTimelineLaneBackgroundStyle(timelineDayRanges, currentTimelineWeekKey, timelineDayColumnWidth),
    [currentTimelineWeekKey, timelineDayColumnWidth, timelineDayRanges]
  );
  const timelineFocusNodeId =
    editingSurface === "timeline" && editingNodeId ? editingNodeId : selectedNodeId;
  const hasExpandableVisibleTimelineRows = timelineRows.some((row) => row.hasChildren);
  const hasCollapsedVisibleTimelineRows = timelineRows.some(
    (row) => row.hasChildren && !expandedIds.has(row.id)
  );
  const canToggleAllTimelineNodes = canExpandAllTimelineNodes || canCollapseAllTimelineNodes;
  const shouldCollapseAllTimelineNodes =
    hasExpandableVisibleTimelineRows &&
    !hasCollapsedVisibleTimelineRows &&
    canCollapseAllTimelineNodes;
  const timelineToggleLabel = shouldCollapseAllTimelineNodes
    ? t("document_ai.tree_editor_collapse_all")
    : t("document_ai.tree_editor_expand_all");

  const syncScrollTopState = (next: number) => {
    setTimelineScrollTop((prev) => (prev === next ? prev : next));
  };

  const clampDayIndex = (index: number) => Math.max(0, Math.min(timelineDayRanges.length - 1, index));
  const snapDayIndexToWorkingDay = (index: number) => {
    let next = clampDayIndex(index);
    while (next < timelineDayRanges.length - 1 && timelineDayRanges[next]?.isWeekend) {
      next += 1;
    }
    while (next > 0 && timelineDayRanges[next]?.isWeekend) {
      next -= 1;
    }
    return next;
  };

  const timelineMonthGroups = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" });
    const groups: Array<{ key: string; label: string; startIndex: number; dayCount: number }> = [];
    timelineDayRanges.forEach((day, index) => {
      const key = `${day.year}-${day.monthIndex}`;
      const label = formatter.format(new Date(Date.UTC(day.year, day.monthIndex, 1)));
      const current = groups[groups.length - 1];
      if (current && current.key === key) {
        current.dayCount += 1;
        return;
      }
      groups.push({ key, label, startIndex: index, dayCount: 1 });
    });
    return groups;
  }, [locale, timelineDayRanges]);

  const timelineWeekGroups = useMemo(() => {
    const groups: Array<{ key: string; label: string; startIndex: number; dayCount: number; isCurrent: boolean }> = [];
    timelineDayRanges.forEach((day, index) => {
      const key = `${day.weekYear}-${day.week}`;
      const current = groups[groups.length - 1];
      if (current && current.key === key) {
        current.dayCount += 1;
        return;
      }
      groups.push({
        key,
        label: `${weekPrefix}${day.week}`,
        startIndex: index,
        dayCount: 1,
        isCurrent: currentTimelineWeekKey === key
      });
    });
    return groups;
  }, [currentTimelineWeekKey, timelineDayRanges, weekPrefix]);
  const currentTimelineWeekGroup = useMemo(
    () => timelineWeekGroups.find((group) => group.key === currentTimelineWeekKey) ?? null,
    [currentTimelineWeekKey, timelineWeekGroups]
  );
  const currentTimelineDayColumn = useMemo<TimelineHighlightColumn | null>(() => {
    const todayIndex = timelineDayRanges.findIndex((day) => day.date === todayIso);
    if (todayIndex < 0) return null;
    return {
      key: `today-${todayIso}`,
      left: todayIndex * timelineDayColumnWidth,
      width: timelineDayColumnWidth
    };
  }, [timelineDayColumnWidth, timelineDayRanges, todayIso]);
  const timelineDayBoundaries = useMemo(
    () =>
      timelineDayRanges.map((day, index) => {
        if (index === 0) {
          return { isWeekBoundary: false, isMonthBoundary: false };
        }
        const previousDay = timelineDayRanges[index - 1];
        return {
          isWeekBoundary:
            previousDay.week !== day.week || previousDay.weekYear !== day.weekYear,
          isMonthBoundary:
            previousDay.monthIndex !== day.monthIndex || previousDay.year !== day.year
        };
      }),
    [timelineDayRanges]
  );
  const timelineBoundaryLines = useMemo<TimelineBoundaryLine[]>(
    () =>
      timelineDayBoundaries.flatMap<TimelineBoundaryLine>((boundary, index) => {
        if (index === 0) return [];
        if (boundary.isMonthBoundary) {
          return [
            {
              key: `month-${index}`,
              left: index * timelineDayColumnWidth,
              width: 2,
              color: TIMELINE_MONTH_DIVIDER_COLOR,
              kind: "month"
            }
          ];
        }
        if (boundary.isWeekBoundary) {
          return [
            {
              key: `week-${index}`,
              left: index * timelineDayColumnWidth,
              width: 1,
              color: TIMELINE_WEEK_DIVIDER_COLOR,
              kind: "week"
            }
          ];
        }
        return [];
      }),
    [timelineDayBoundaries, timelineDayColumnWidth]
  );
  const timelineWeekendColumns = useMemo<TimelineHighlightColumn[]>(
    () =>
      timelineDayRanges.flatMap((day, index) =>
        day.isWeekend
          ? [
              {
                key: `weekend-${day.date}`,
                left: index * timelineDayColumnWidth,
                width: timelineDayColumnWidth
              }
            ]
          : []
      ),
    [timelineDayColumnWidth, timelineDayRanges]
  );

  useEffect(() => {
    timelineDragStateRef.current = timelineDragState;
  }, [timelineDragState]);

  const rowOverscan = 6;
  const visibleTimelineHeight = Math.max(0, timelineViewportHeight - timelineHeaderHeight);
  const timelineRowMetrics = useMemo(() => {
    let offsetTop = 0;
    const entries: TimelineRowMetric[] = timelineRows.map((row) => {
      const labelText = editingNodeId === row.id && editingSurface === "timeline" ? editingValue : row.node.name;
      const indentWidth = Math.min(row.level, 7) * 14;
      const indexWidth =
        row.node.type !== "file" && row.indexLabel
          ? Math.max(28, row.indexLabel.length * 8 + 16)
          : 0;
      const availableLabelWidth = Math.max(
        64,
        timelineNodePanelWidth -
          TIMELINE_ROW_CHROME_WIDTH -
          indentWidth -
          indexWidth -
          (isTimelineNodeFlagged(row.id) ? TIMELINE_ROW_FLAG_WIDTH : 0)
      );
      const charsPerLine = Math.max(6, Math.floor(availableLabelWidth / TIMELINE_ROW_AVERAGE_CHAR_WIDTH));
      const estimatedLines = Math.min(
        TIMELINE_ROW_MAX_TEXT_LINES,
        estimateWrappedLineCount(labelText, charsPerLine)
      );
      const minimumLines = 1;
      const lineCount = Math.max(minimumLines, estimatedLines);
      const height = timelineRowHeight + (lineCount - 1) * TIMELINE_ROW_EXTRA_LINE_HEIGHT;
      const metric: TimelineRowMetric = {
        row,
        height,
        lineCount,
        offsetTop
      };
      offsetTop += height;
      return metric;
    });

    return {
      entries,
      totalHeight: offsetTop,
      byId: new Map(entries.map((entry) => [entry.row.id, entry]))
    };
  }, [
    editingValue,
    editingNodeId,
    editingSurface,
    isTimelineNodeFlagged,
    timelineNodePanelWidth,
    timelineRowHeight,
    timelineRows
  ]);
  const timelineBodyHeight = Math.max(
    timelineRowMetrics.totalHeight,
    visibleTimelineHeight > 0 ? visibleTimelineHeight : timelineRowHeight * 12
  );
  const virtualWindow = useMemo(() => {
    const total = timelineRowMetrics.entries.length;
    if (total === 0) {
      return {
        startIndex: 0,
        endIndex: -1,
        rows: [] as TimelineRowMetric[],
        topSpacer: 0,
        bottomSpacer: 0
      };
    }

    const viewport = visibleTimelineHeight > 0 ? visibleTimelineHeight : timelineRowHeight * 12;
    const overscanPx = timelineRowHeight * rowOverscan;
    const startOffset = Math.max(0, timelineScrollTop - overscanPx);
    const endOffset = Math.max(0, timelineScrollTop + viewport + overscanPx - 1);
    const startIndex = Math.max(0, findTimelineRowIndexAtOffset(timelineRowMetrics.entries, startOffset));
    const endIndex = Math.min(total - 1, findTimelineRowIndexAtOffset(timelineRowMetrics.entries, endOffset));
    const rows = timelineRowMetrics.entries.slice(startIndex, endIndex + 1);
    const topSpacer = timelineRowMetrics.entries[startIndex]?.offsetTop ?? 0;
    const consumedHeight = rows.reduce((sum, entry) => sum + entry.height, 0);
    const bottomSpacer = Math.max(0, timelineRowMetrics.totalHeight - topSpacer - consumedHeight);

    return {
      startIndex,
      endIndex,
      rows,
      topSpacer,
      bottomSpacer
    };
  }, [timelineRowHeight, timelineRowMetrics.entries, timelineRowMetrics.totalHeight, timelineScrollTop, visibleTimelineHeight]);

  useEffect(() => {
    if (!currentTimelineDayColumn) {
      autoAlignedTimelineDateRef.current = null;
      return;
    }
    if (autoAlignedTimelineDateRef.current === currentTimelineDayColumn.key) return;

    let frameId = 0;
    let retryCount = 0;

    const alignToToday = () => {
      const right = timelineRightScrollRef.current;
      if (!right) return;

      const viewportWidth = right.clientWidth;
      const scrollableWidth = right.scrollWidth;
      if (viewportWidth <= 0 || scrollableWidth <= 0) {
        if (retryCount < 4) {
          retryCount += 1;
          frameId = window.requestAnimationFrame(alignToToday);
        }
        return;
      }

      const dayCenter = currentTimelineDayColumn.left + currentTimelineDayColumn.width / 2;
      const centeredScrollLeft = dayCenter - viewportWidth / 2;
      const maxScrollLeft = Math.max(0, scrollableWidth - viewportWidth);
      right.scrollLeft = Math.max(0, Math.min(maxScrollLeft, centeredScrollLeft));
      autoAlignedTimelineDateRef.current = currentTimelineDayColumn.key;
    };

    frameId = window.requestAnimationFrame(alignToToday);
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [currentTimelineDayColumn, timelineRightScrollRef]);

  useEffect(() => {
    const left = timelineLeftScrollRef.current;
    if (!left) return;

    const updateViewport = () => {
      setTimelineViewportHeight(left.clientHeight);
    };
    updateViewport();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateViewport);
      observer.observe(left);
      return () => {
        observer.disconnect();
      };
    }

    window.addEventListener("resize", updateViewport);
    return () => {
      window.removeEventListener("resize", updateViewport);
    };
  }, [timelineLeftScrollRef]);

  useEffect(() => {
    if (!timelineFocusNodeId || timelineRows.length === 0 || visibleTimelineHeight <= 0) return;
    const focusedMetric = timelineRowMetrics.byId.get(timelineFocusNodeId);
    if (!focusedMetric) return;

    const rowTop = focusedMetric.offsetTop;
    const rowBottom = rowTop + focusedMetric.height;
    const viewportTop = timelineScrollTop;
    const viewportBottom = timelineScrollTop + visibleTimelineHeight;
    let nextScrollTop: number | null = null;

    if (rowTop < viewportTop) {
      nextScrollTop = rowTop;
    } else if (rowBottom > viewportBottom) {
      nextScrollTop = rowBottom - visibleTimelineHeight;
    }

    if (nextScrollTop === null) return;
    const clamped = Math.max(0, nextScrollTop);
    const left = timelineLeftScrollRef.current;
    const right = timelineRightScrollRef.current;
    if (left) left.scrollTop = clamped;
    if (right) right.scrollTop = clamped;
    setTimelineScrollTop((prev) => (prev === clamped ? prev : clamped));
  }, [
    timelineFocusNodeId,
    timelineRowMetrics.byId,
    timelineRows,
    timelineLeftScrollRef,
    timelineRightScrollRef,
    visibleTimelineHeight
  ]);

  useEffect(() => {
    if (!timelineDragState) return;

    let autoScrollRafId: number | null = null;
    let latestPointerX = timelineDragState.originX;

    const stopAutoScroll = () => {
      if (autoScrollRafId === null) return;
      window.cancelAnimationFrame(autoScrollRafId);
      autoScrollRafId = null;
    };

    const updateTimelineDragPreview = (pointerClientX: number) => {
      latestPointerX = pointerClientX;
      const latest = timelineDragStateRef.current;
      if (!latest) return;
      const right = timelineRightScrollRef.current;
      const scrollDelta = right ? right.scrollLeft - latest.originScrollLeft : 0;
      const deltaDays = Math.round(
        (pointerClientX - latest.originX + scrollDelta) / timelineDayColumnWidth
      );
      setTimelineDragState((current) => {
        if (!current) return current;
        let nextStart = current.originStartDayIndex;
        let nextEnd = current.originEndDayIndex;
        if (current.mode === "move") {
          const duration = current.originEndDayIndex - current.originStartDayIndex;
          const maxStart = Math.max(0, timelineDayRanges.length - 1 - duration);
          nextStart = Math.max(0, Math.min(maxStart, current.originStartDayIndex + deltaDays));
          nextStart = snapDayIndexToWorkingDay(nextStart);
          nextStart = Math.max(0, Math.min(maxStart, nextStart));
          nextEnd = nextStart + duration;
        } else if (current.mode === "resize-start") {
          nextStart = clampDayIndex(current.originStartDayIndex + deltaDays);
          nextStart = snapDayIndexToWorkingDay(nextStart);
          nextStart = Math.min(nextStart, current.originEndDayIndex);
        } else if (current.mode === "resize-end") {
          nextEnd = clampDayIndex(current.originEndDayIndex + deltaDays);
          nextEnd = snapDayIndexToWorkingDay(nextEnd);
          nextEnd = Math.max(nextEnd, current.originStartDayIndex);
        } else {
          const nextPoint = snapDayIndexToWorkingDay(current.originStartDayIndex + deltaDays);
          nextStart = Math.min(current.originStartDayIndex, nextPoint);
          nextEnd = Math.max(current.originStartDayIndex, nextPoint);
        }
        if (
          nextStart === current.previewStartDayIndex &&
          nextEnd === current.previewEndDayIndex
        ) {
          return current;
        }
        return {
          ...current,
          previewStartDayIndex: nextStart,
          previewEndDayIndex: nextEnd
        };
      });
    };

    const stepAutoScroll = () => {
      const latest = timelineDragStateRef.current;
      const right = timelineRightScrollRef.current;
      if (!latest || !right) {
        stopAutoScroll();
        return;
      }

      const rect = right.getBoundingClientRect();
      const edgeThreshold = TIMELINE_EDGE_AUTOSCROLL_THRESHOLD;
      let velocity = 0;
      if (latestPointerX > rect.right - edgeThreshold) {
        const pressure = Math.min(1.6, (latestPointerX - (rect.right - edgeThreshold)) / edgeThreshold);
        velocity = Math.max(10, pressure * pressure * timelineDayColumnWidth * 0.95);
      } else if (latestPointerX < rect.left + edgeThreshold) {
        const pressure = Math.min(1.6, ((rect.left + edgeThreshold) - latestPointerX) / edgeThreshold);
        velocity = -Math.max(10, pressure * pressure * timelineDayColumnWidth * 0.95);
      }

      if (velocity === 0) {
        stopAutoScroll();
        return;
      }

      const maxScrollLeft = Math.max(0, right.scrollWidth - right.clientWidth);
      const nextScrollLeft = Math.max(0, Math.min(maxScrollLeft, right.scrollLeft + velocity));
      if (Math.abs(nextScrollLeft - right.scrollLeft) <= TIMELINE_EDGE_AUTOSCROLL_EPSILON) {
        stopAutoScroll();
        return;
      }

      right.scrollLeft = nextScrollLeft;
      updateTimelineDragPreview(latestPointerX);
      autoScrollRafId = window.requestAnimationFrame(stepAutoScroll);
    };

    const syncAutoScroll = () => {
      const right = timelineRightScrollRef.current;
      if (!right) {
        stopAutoScroll();
        return;
      }
      const rect = right.getBoundingClientRect();
      const edgeThreshold = TIMELINE_EDGE_AUTOSCROLL_THRESHOLD;
      const nearLeftEdge = latestPointerX < rect.left + edgeThreshold;
      const nearRightEdge = latestPointerX > rect.right - edgeThreshold;
      const maxScrollLeft = Math.max(0, right.scrollWidth - right.clientWidth);
      const canScrollLeft = right.scrollLeft > TIMELINE_EDGE_AUTOSCROLL_EPSILON;
      const canScrollRight = right.scrollLeft < maxScrollLeft - TIMELINE_EDGE_AUTOSCROLL_EPSILON;
      const shouldAutoScroll = (nearLeftEdge && canScrollLeft) || (nearRightEdge && canScrollRight);
      if (!shouldAutoScroll) {
        stopAutoScroll();
        return;
      }
      if (autoScrollRafId === null) {
        autoScrollRafId = window.requestAnimationFrame(stepAutoScroll);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      updateTimelineDragPreview(event.clientX);
      syncAutoScroll();
    };

    const clearDrag = () => {
      stopAutoScroll();
      setTimelineDragState(null);
    };

    const handlePointerUp = () => {
      const latest = timelineDragStateRef.current;
      clearDrag();
      if (!latest) return;
      if (
        latest.previewStartDayIndex === latest.originStartDayIndex &&
        latest.previewEndDayIndex === latest.originEndDayIndex
      ) {
        return;
      }
      const nextStart = timelineDayRanges[latest.previewStartDayIndex];
      const nextEnd = timelineDayRanges[latest.previewEndDayIndex];
      if (!nextStart || !nextEnd) return;
      setTimelineSavingNodeId(latest.nodeId);
      void Promise.resolve(
        onSaveTimelineScheduleDirect(latest.nodeId, {
          ...latest.schedule,
          startDate: nextStart.date,
          endDate: nextEnd.date
        })
      ).finally(() => {
        setTimelineSavingNodeId((current) => (current === latest.nodeId ? null : current));
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      clearDrag();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", clearDrag);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      stopAutoScroll();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", clearDrag);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    timelineDayColumnWidth,
    timelineDayRanges,
    timelineDragState,
    timelineRightScrollRef,
    onSaveTimelineScheduleDirect
  ]);

  const beginTimelineBarDrag = (
    event: ReactPointerEvent<HTMLElement>,
    rowId: string,
    scheduleMeta: TimelineScheduleMeta,
    mode: TimelineDragMode
  ) => {
    if (timelineSavingNodeId === rowId) return;
    event.preventDefault();
    event.stopPropagation();
    onCloseContextMenu();
    onSetPrimarySelection(rowId);
    setTimelineDragState({
      nodeId: rowId,
      mode,
      originX: event.clientX,
      originScrollLeft: timelineRightScrollRef.current?.scrollLeft ?? 0,
      originStartDayIndex: scheduleMeta.startDayIndex,
      originEndDayIndex: scheduleMeta.endDayIndex,
      previewStartDayIndex: scheduleMeta.startDayIndex,
      previewEndDayIndex: scheduleMeta.endDayIndex,
      schedule: scheduleMeta.schedule
    });
  };

  const beginTimelineLaneDrag = (
    event: ReactPointerEvent<HTMLElement>,
    rowId: string,
    rowName: string,
    dayIndex: number
  ) => {
    if (event.button !== 0 || timelineSavingNodeId === rowId) return;
    if (timelineScheduleByNodeId.has(rowId)) return;
    const snappedDayIndex = snapDayIndexToWorkingDay(dayIndex);
    const day = timelineDayRanges[snappedDayIndex];
    if (!day) return;
    event.preventDefault();
    event.stopPropagation();
    onCloseContextMenu();
    onSetPrimarySelection(rowId);
    setTimelineDragState({
      nodeId: rowId,
      mode: "create",
      originX: event.clientX,
      originScrollLeft: timelineRightScrollRef.current?.scrollLeft ?? 0,
      originStartDayIndex: snappedDayIndex,
      originEndDayIndex: snappedDayIndex,
      previewStartDayIndex: snappedDayIndex,
      previewEndDayIndex: snappedDayIndex,
      schedule: {
        status: "planned",
        startDate: day.date,
        endDate: day.date,
        title: rowName.trim() || "Untitled",
        assignees: [],
        priority: "normal",
        progress: 0,
        predecessor: ""
      }
    });
  };

  const resolveRenderedScheduleMeta = (rowId: string): TimelineScheduleMeta | null => {
    const base = timelineScheduleByNodeId.get(rowId) ?? null;
    if (!timelineDragState || timelineDragState.nodeId !== rowId) return base;
    const nextStart = timelineDayRanges[timelineDragState.previewStartDayIndex];
    const nextEnd = timelineDayRanges[timelineDragState.previewEndDayIndex];
    if (!nextStart || !nextEnd) return base;
    return {
      schedule: {
        ...timelineDragState.schedule,
        startDate: nextStart.date,
        endDate: nextEnd.date
      },
      startDayIndex: timelineDragState.previewStartDayIndex,
      endDayIndex: timelineDragState.previewEndDayIndex
    };
  };
  const resolveTimelineDayIndexFromPointer = (event: ReactPointerEvent<HTMLElement>) => {
    if (timelineDayRanges.length === 0) return 0;
    const rect = event.currentTarget.getBoundingClientRect();
    const offset = Math.max(0, event.clientX - rect.left);
    return clampDayIndex(Math.floor(offset / timelineDayColumnWidth));
  };

  return (
    <div
      className="grid min-h-0 flex-1"
      data-ode-surface="timeline"
      style={{ gridTemplateColumns: `${timelineNodePanelWidth}px 10px minmax(0, 1fr)` }}
      onMouseDownCapture={() => onActivateTimelineSurface()}
    >
      <div
        ref={timelineLeftScrollRef}
        className="ode-timeline-left-scroll overflow-hidden border-r border-[var(--ode-border)]"
        onWheel={(event) => {
          const right = timelineRightScrollRef.current;
          if (!right) return;
          if (event.deltaY === 0 && event.deltaX === 0) return;
          event.preventDefault();
          if (event.deltaY !== 0) {
            right.scrollTop += event.deltaY;
          }
          if (event.deltaX !== 0) {
            right.scrollLeft += event.deltaX;
          }
        }}
        onContextMenu={(event) => {
          const targetEl = event.target as HTMLElement;
          if (targetEl.closest("[data-timeline-row='true']")) return;
          onOpenSurfaceContextMenu(event);
        }}
        onDragOver={(event) => {
          const sourceId = onResolveActiveDragSourceId(event);
          if (!sourceId) return;
          const targetEl = event.target as HTMLElement;
          if (targetEl.closest("[data-timeline-row='true']")) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          onSetDropIndicator({ targetId: scopedRootDropTargetId, position: "inside" });
        }}
        onDrop={(event) => {
          const sourceId = onResolveActiveDragSourceId(event);
          if (!sourceId) return;
          const targetEl = event.target as HTMLElement;
          if (targetEl.closest("[data-timeline-row='true']")) return;
          event.preventDefault();
          onClearDraggingState();
          onApplyDropMove(sourceId, scopedRootDropTargetId, "inside");
        }}
      >
        {dropIndicator?.targetId === scopedRootDropTargetId ? (
          <div className="ode-root-drop-hint">{t("tree.drop_to_root")}</div>
        ) : null}
        <div
          className="sticky top-0 z-20 flex items-center border-b border-[var(--ode-border)] bg-[rgba(1,16,30,0.96)] px-4 text-xs uppercase tracking-[0.13em] text-[var(--ode-text-dim)]"
          style={{ height: `${timelineHeaderHeight}px` }}
        >
          <div className="flex items-center gap-2">
            <OdeTooltip label={t("timeline.flagged_first")} side="bottom">
              <button
                type="button"
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${
                  prioritizeFlaggedTimelineTasks
                    ? "border-[rgba(231,102,102,0.6)] bg-[rgba(109,24,24,0.34)] text-[#ff7f7f] hover:border-[rgba(255,146,146,0.82)] hover:text-[#ffd7d7]"
                    : "border-[rgba(110,211,255,0.18)] bg-[rgba(5,29,46,0.55)] text-[var(--ode-text-dim)] hover:border-[rgba(231,102,102,0.42)] hover:text-[#ff9898]"
                }`}
                onClick={onTogglePrioritizeFlaggedTimelineTasks}
                aria-label={t("timeline.flagged_first")}
                aria-pressed={prioritizeFlaggedTimelineTasks}
              >
                <FlagGlyphSmall active={prioritizeFlaggedTimelineTasks} />
              </button>
            </OdeTooltip>
            <OdeTooltip label={timelineToggleLabel} side="bottom">
              <button
                type="button"
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${
                  canToggleAllTimelineNodes
                    ? "border-[rgba(110,211,255,0.18)] bg-[rgba(5,29,46,0.55)] text-[var(--ode-text-dim)] hover:border-[rgba(90,192,232,0.44)] hover:text-[var(--ode-text)]"
                    : "border-[rgba(110,211,255,0.12)] bg-[rgba(5,29,46,0.34)] text-[var(--ode-text-subtle)] opacity-45 cursor-not-allowed"
                }`}
                onClick={() => {
                  if (!canToggleAllTimelineNodes) return;
                  if (shouldCollapseAllTimelineNodes) {
                    onCollapseAllTimelineNodes();
                    return;
                  }
                  onExpandAllTimelineNodes();
                }}
                aria-label={timelineToggleLabel}
                disabled={!canToggleAllTimelineNodes}
              >
                {shouldCollapseAllTimelineNodes ? <CollapseAllGlyphSmall /> : <ExpandAllGlyphSmall />}
              </button>
            </OdeTooltip>
          </div>
        </div>
        {virtualWindow.topSpacer > 0 ? <div style={{ height: `${virtualWindow.topSpacer}px` }} /> : null}
        {virtualWindow.rows.map((entry) => (
          (() => {
            const { row, height, lineCount } = entry;
            const rowIsTimelineGroup = row.groupKind === "deliverable";
            const selected = !rowIsTimelineGroup && selectedNodeIds.has(row.id);
            const focused = !rowIsTimelineGroup && selectedNodeId === row.id;
            const rowIsExecutionProjection = row.node.properties?.odeExecutionTask === true;
            const isFlagged = !rowIsTimelineGroup && !row.hasChildren && isTimelineNodeFlagged(row.id);
            const deliverableOwnerNodeId =
              typeof row.node.properties?.odeTimelineOwnerNodeId === "string"
                ? row.node.properties.odeTimelineOwnerNodeId
                : null;
            const deliverableId =
              typeof row.node.properties?.odeTimelineDeliverableId === "string"
                ? row.node.properties.odeTimelineDeliverableId
                : null;
            return (
          <div
            key={`timeline-row-${row.id}`}
            data-timeline-row="true"
            data-ode-node-id={row.id}
            className={`relative flex w-full items-center border-b border-[var(--ode-border)] px-4 text-left ${selected
              ? "bg-[rgba(18,78,121,0.25)]"
              : rowIsTimelineGroup
                ? "bg-[rgba(10,40,61,0.36)]"
                : "hover:bg-[rgba(8,47,74,0.23)]"
              } ${focused ? "ode-timeline-row-active" : ""} ${cutPendingNodeIds.has(row.id) ? "ode-cut-pending" : ""} ${draggingNodeId === row.id ? "ode-tree-row-dragging" : ""
              } ${dropIndicator?.targetId === row.id
                ? dropIndicator.position === "before"
                  ? "ode-drop-before"
                  : dropIndicator.position === "after"
                    ? "ode-drop-after"
                    : "ode-drop-inside"
                : ""
              }`}
            style={{ minHeight: `${height}px` }}
            draggable={!rowIsTimelineGroup && !rowIsExecutionProjection && editingNodeId !== row.id}
            onClick={(event) => {
              if (rowIsTimelineGroup) {
                onCloseContextMenu();
                return;
              }
              onCloseContextMenu();
              onApplyTimelineSelection(row.id, {
                range: event.shiftKey,
                toggle: event.ctrlKey || event.metaKey
              });
            }}
            onContextMenu={(event) => {
              if (rowIsTimelineGroup) {
                event.preventDefault();
                if (deliverableOwnerNodeId && deliverableId) {
                  onOpenDeliverableGroupContextMenu(event, deliverableOwnerNodeId, deliverableId, row.node.name);
                }
                return;
              }
              onOpenNodeContextMenu(event, row.id);
            }}
            onDragStart={(event) => {
              if (rowIsTimelineGroup || rowIsExecutionProjection) {
                event.preventDefault();
                return;
              }
              onBeginNodeDrag(event, row.id);
            }}
            onDragOver={(event) => {
              if (rowIsTimelineGroup || rowIsExecutionProjection) return;
              const sourceId = onResolveActiveDragSourceId(event);
              if (!sourceId) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              onSetDropIndicator({ targetId: row.id, position: onDetectDropPosition(event, row.node) });
            }}
            onDrop={(event) => {
              if (rowIsTimelineGroup || rowIsExecutionProjection) return;
              event.preventDefault();
              const sourceId = onResolveActiveDragSourceId(event);
              if (!sourceId) return;
              const position =
                dropIndicator?.targetId === row.id ? dropIndicator.position : onDetectDropPosition(event, row.node);
              onClearDraggingState();
              onApplyDropMove(sourceId, row.id, position);
            }}
            onDragEnd={onClearDraggingState}
            onDoubleClick={(event) => {
              const target = event.target as HTMLElement;
              if (target.closest("input")) return;
              if (target.closest(".ode-timeline-schedule-btn")) return;
              if (rowIsTimelineGroup) return;
              if (row.node.type === "file") {
                onReviewFile(row.id);
                return;
              }
              if (row.hasChildren) onToggleExpand(row.id);
            }}
          >
            <span className="ode-timeline-node-cell" style={{ paddingLeft: `${Math.min(row.level, 7) * 14}px` }}>
              {row.hasChildren ? (
                <OdeTooltip label={expandedIds.has(row.id) ? "Collapse" : "Expand"} side="bottom">
                  <span
                    className="ode-timeline-caret ode-timeline-caret-toggle"
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onToggleExpand(row.id);
                    }}
                  >
                    {expandedIds.has(row.id) ? "v" : ">"}
                  </span>
                </OdeTooltip>
              ) : (
                <span className="ode-timeline-caret ode-timeline-caret-placeholder" />
              )}
              {row.node.type !== "file" && row.indexLabel ? (
                <span className="rounded-sm bg-[rgba(36,133,202,0.16)] px-1.5 py-[1px] text-[0.72rem] text-[var(--ode-text-dim)]">
                  {row.indexLabel}
                </span>
              ) : null}
              {rowIsTimelineGroup ? null : (
                <OdeTooltip label={t("timeline.open_schedule")} side="bottom">
                  <button
                    type="button"
                    className="ode-timeline-schedule-btn"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onSetPrimarySelection(row.id);
                      onOpenScheduleModal(row.id);
                    }}
                    aria-label={t("timeline.open_schedule")}
                  >
                    <CalendarGlyphSmall />
                  </button>
                </OdeTooltip>
              )}
              <span className={`ode-timeline-label text-[1.02rem] ${rowIsTimelineGroup ? "text-[var(--ode-accent-soft)]" : ""}`}>
                <NodeGlyph
                  node={row.node}
                  active={selected || focused}
                  folderState={row.node.type !== "file" ? folderNodeStateById.get(row.id) : undefined}
                  showExecutionOwnerGlyph={executionOwnerNodeIds.has(row.id)}
                />
                {editingNodeId === row.id && editingSurface === "timeline" ? (
                  <textarea
                    ref={inlineEditInputRef as RefObject<HTMLTextAreaElement | null>}
                    autoFocus
                    value={editingValue}
                    spellCheck
                    autoCorrect="on"
                    autoCapitalize="off"
                    rows={Math.max(1, lineCount)}
                    lang={getLocaleForLanguage(language)}
                    onChange={(event) => onSetEditingValue(event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    onDoubleClick={(event) => event.stopPropagation()}
                    onContextMenu={onOpenInlineEditContextMenu}
                    onBlur={() => {
                      void onCommitInlineEdit();
                    }}
                    onKeyDown={(event) => {
                      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
                        event.preventDefault();
                        event.stopPropagation();
                        event.currentTarget.blur();
                        return;
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        event.stopPropagation();
                        onCancelInlineEdit();
                        return;
                      }
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.stopPropagation();
                        event.currentTarget.blur();
                      }
                    }}
                    className="ode-input ode-timeline-inline-editor min-w-0 flex-1 rounded px-3 py-2 text-[1rem]"
                  />
                ) : (
                  <span className="ode-timeline-label-text">
                    {isNodeProvisionalInlineCreate(row.id) ? "\u00A0" : row.node.name}
                  </span>
                )}
                {isFlagged ? (
                  <OdeTooltip label={t("timeline.flagged")} side="bottom">
                    <span
                      className={`ode-timeline-flag-indicator ${
                        selected || focused ? "ode-timeline-flag-indicator-active" : ""
                      }`}
                      aria-label={t("timeline.flagged")}
                    >
                      <FlagGlyphSmall active />
                    </span>
                  </OdeTooltip>
                ) : null}
              </span>
            </span>
          </div>
            );
          })()
        ))}
        {virtualWindow.bottomSpacer > 0 ? <div style={{ height: `${virtualWindow.bottomSpacer}px` }} /> : null}
        {timelineRows.length === 0 ? (
          <div className="px-4 py-4">
            {showCreateFirstNodeAction ? (
              <OdeTooltip label={t("tree.add_first_node")} side="bottom">
                <button
                  type="button"
                  className="ode-text-btn h-9 w-9 px-0 text-[1.15rem] font-semibold"
                  onClick={onCreateFirstNode}
                  aria-label={t("tree.add_first_node")}
                >
                  +
                </button>
              </OdeTooltip>
            ) : null}
          </div>
        ) : null}
      </div>

      <OdeTooltip label={t("splitter.title")} side="bottom">
        <div
          className={`ode-splitter ${isResizingTimelinePanel ? "ode-splitter-active" : ""}`}
          onPointerDown={onStartTimelinePanelResize}
          onDoubleClick={() => onSetTimelineNodePanelWidth(onClampTimelineNodePanelWidth(timelineNodePanelDefaultWidth))}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              onNudgeTimelineNodePanelWidth(event.ctrlKey ? -36 : -14);
              return;
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              onNudgeTimelineNodePanelWidth(event.ctrlKey ? 36 : 14);
              return;
            }
            if (event.key === "Home") {
              event.preventDefault();
              onSetTimelineNodePanelWidth(timelineNodePanelMinWidth);
              return;
            }
            if (event.key === "End") {
              event.preventDefault();
              onSetTimelineNodePanelWidth(
                onClampTimelineNodePanelWidth(window.innerWidth - timelineGridMinWidth)
              );
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              onSetTimelineNodePanelWidth(onClampTimelineNodePanelWidth(timelineNodePanelDefaultWidth));
            }
          }}
          role="separator"
          tabIndex={0}
          aria-label={t("splitter.aria")}
          aria-orientation="vertical"
          aria-valuemin={timelineNodePanelMinWidth}
          aria-valuenow={Math.round(timelineNodePanelWidth)}
          aria-valuemax={Math.max(timelineNodePanelMinWidth, window.innerWidth - timelineGridMinWidth)}
        />
      </OdeTooltip>

      <div
        ref={timelineRightScrollRef}
        className="ode-timeline-right-scroll overflow-auto"
        onScroll={(event) => {
          syncScrollTopState(event.currentTarget.scrollTop);
          onSyncTimelineVerticalScroll("right");
        }}
        onContextMenu={(event) => {
          const targetEl = event.target as HTMLElement;
          if (targetEl.closest("[data-timeline-week-cell='true']")) return;
          onOpenSurfaceContextMenu(event);
        }}
      >
        <div
          className="sticky top-0 z-20 bg-[rgba(1,16,30,0.96)]"
          style={{ height: `${timelineHeaderHeight}px` }}
        >
          <div
            className="relative"
            style={{ height: `${timelineHeaderHeight}px`, width: `${timelineGridWidth}px` }}
          >
            <div
              className="grid"
              style={{
                height: `${timelineMonthHeaderRowHeight}px`,
                gridTemplateColumns: `repeat(${timelineDayRanges.length}, ${timelineDayColumnWidth}px)`
              }}
            >
              {timelineMonthGroups.map((monthGroup) => (
                <div
                  key={`timeline-month-${monthGroup.key}`}
                  className="flex items-center justify-center border-b border-[rgba(57,141,202,0.22)] bg-[linear-gradient(180deg,rgba(7,30,49,0.96),rgba(5,23,39,0.98))] px-3 text-center text-[0.82rem] font-medium tracking-[0.04em] text-[var(--ode-accent-soft)]"
                  style={{
                    gridColumn: `${monthGroup.startIndex + 1} / span ${monthGroup.dayCount}`
                  }}
                >
                  {monthGroup.label}
                </div>
              ))}
            </div>
            <div className="pointer-events-none absolute inset-0 z-10">
              {timelineBoundaryLines
                .filter((line) => line.kind === "month")
                .map((line) => (
                  <div
                    key={`header-divider-${line.key}`}
                    className="absolute top-0"
                    style={{
                      left: `${line.left}px`,
                      width: `${line.width}px`,
                      height: "100%",
                      backgroundColor: line.color
                    }}
                  />
                ))}
            </div>
            <div
              className="pointer-events-none absolute"
              style={{
                top: `${timelineMonthHeaderRowHeight}px`,
                height: `${timelineHeaderHeight - timelineMonthHeaderRowHeight}px`,
                width: `${timelineGridWidth}px`
              }}
            >
              {timelineWeekendColumns.map((column) => (
                <div
                  key={`header-${column.key}`}
                  className="absolute top-0 bottom-0 border-x"
                  style={{
                    left: `${column.left}px`,
                    width: `${column.width}px`,
                    borderColor: TIMELINE_WEEKEND_EDGE_COLOR,
                    background: TIMELINE_WEEKEND_HEADER_FILL
                  }}
                />
              ))}
              {currentTimelineDayColumn ? (
                <div
                  className="absolute top-0 bottom-0 border-x"
                  style={{
                    left: `${currentTimelineDayColumn.left}px`,
                    width: `${currentTimelineDayColumn.width}px`,
                    borderColor: TIMELINE_TODAY_EDGE_COLOR,
                    background: TIMELINE_TODAY_HEADER_FILL,
                    boxShadow: TIMELINE_TODAY_HEADER_SHADOW
                  }}
                />
              ) : null}
            </div>
            <div
              className="grid"
              style={{
                height: `${timelineWeekHeaderRowHeight}px`,
                gridTemplateColumns: `repeat(${timelineDayRanges.length}, ${timelineDayColumnWidth}px)`
              }}
            >
              {timelineWeekGroups.map((group) => (
                (() => {
                  const groupDays = timelineDayRanges.slice(group.startIndex, group.startIndex + group.dayCount);
                  const workdayIndices = groupDays.reduce<number[]>((indices, day, localIndex) => {
                    if (!day.isWeekend) {
                      indices.push(localIndex);
                    }
                    return indices;
                  }, []);
                  const labelStartIndex = workdayIndices[0] ?? 0;
                  const labelEndIndex = workdayIndices[workdayIndices.length - 1] ?? Math.max(0, group.dayCount - 1);
                  const labelCenterPx =
                    ((labelStartIndex + labelEndIndex + 1) / 2) * timelineDayColumnWidth;

                  return (
                    <div
                      key={`week-${group.key}`}
                      data-timeline-week-cell="true"
                      className={`relative border-b text-[0.72rem] font-medium tracking-[0.08em] ${
                        group.isCurrent
                          ? "border-[rgba(53,147,207,0.26)] bg-[rgba(16,88,136,0.22)] text-[var(--ode-accent-soft)]"
                          : "border-[rgba(19,60,88,0.32)] bg-[rgba(4,21,35,0.22)] text-[var(--ode-text-dim)]"
                      }`}
                      style={{
                        gridColumn: `${group.startIndex + 1} / span ${group.dayCount}`,
                        height: `${timelineWeekHeaderRowHeight}px`
                      }}
                    >
                      <span
                        className="absolute top-1/2 z-20 inline-flex whitespace-nowrap rounded-sm px-1.5"
                        style={{
                          left: `${labelCenterPx}px`,
                          transform: "translate(-50%, -50%)",
                          backgroundColor: group.isCurrent ? "rgba(7, 43, 68, 0.98)" : "rgba(4, 21, 35, 0.98)"
                        }}
                      >
                        {group.label}
                      </span>
                    </div>
                  );
                })()
              ))}
            </div>
            <div
              className="grid"
              style={{
                height: `${timelineDayHeaderRowHeight}px`,
                gridTemplateColumns: `repeat(${timelineDayRanges.length}, ${timelineDayColumnWidth}px)`
              }}
            >
              {timelineDayRanges.map((day) => (
                <OdeTooltip key={`timeline-day-tip-${day.date}`} label={`${day.label} ${day.date}`} side="bottom">
                  <div
                    data-timeline-week-cell="true"
                    className={`flex items-center justify-center border-b text-[0.68rem] uppercase tracking-[0.08em] ${
                      day.date === todayIso
                        ? "border-[rgba(123,240,151,0.34)] bg-[rgba(18,97,96,0.16)] text-[rgba(236,255,242,0.96)]"
                        : day.isWeekend
                        ? "border-[rgba(124,43,60,0.48)] bg-[rgba(76,24,36,0.52)] text-[rgba(255,218,225,0.96)]"
                        : currentTimelineWeekKey === `${day.weekYear}-${day.week}`
                          ? "border-[rgba(26,76,113,0.28)] bg-[rgba(12,79,125,0.11)] text-[var(--ode-text-muted)]"
                          : "border-[rgba(19,60,88,0.24)] text-[var(--ode-text-dim)]"
                    }`}
                    style={{
                      height: `${timelineDayHeaderRowHeight}px`,
                      boxShadow:
                        day.date === todayIso
                          ? "inset 1px 0 0 rgba(123,240,151,0.38), inset -1px 0 0 rgba(123,240,151,0.38)"
                          : undefined
                    }}
                    aria-label={`${day.label} ${day.date}`}
                  />
                </OdeTooltip>
              ))}
            </div>
          </div>
        </div>

        <div
          className="relative"
          style={{
            height: `${timelineBodyHeight}px`,
            width: `${timelineGridWidth}px`,
            ...timelineLaneBackgroundStyle
          }}
        >
          <div className="pointer-events-none absolute inset-0 z-0">
            {timelineWeekendColumns.map((column) => (
              <div
                key={`body-${column.key}`}
                className="absolute top-0 bottom-0 border-x"
                style={{
                  left: `${column.left}px`,
                  width: `${column.width}px`,
                  borderColor: TIMELINE_WEEKEND_BODY_EDGE_COLOR,
                  background: TIMELINE_WEEKEND_BODY_FILL
                }}
                />
              ))}
            {currentTimelineDayColumn ? (
              <div
                key={`body-${currentTimelineDayColumn.key}`}
                className="absolute top-0 bottom-0 border-x"
                style={{
                  left: `${currentTimelineDayColumn.left}px`,
                  width: `${currentTimelineDayColumn.width}px`,
                  borderColor: TIMELINE_TODAY_BODY_EDGE_COLOR,
                  background: TIMELINE_TODAY_BODY_FILL,
                  boxShadow: TIMELINE_TODAY_BODY_SHADOW
                }}
              />
            ) : null}
          </div>
          <div className="pointer-events-none absolute inset-0 z-0">
            {timelineBoundaryLines.map((line) => (
              <div
                key={`body-divider-${line.key}`}
                className="absolute top-0"
                style={{
                  left: `${line.left}px`,
                  width: `${line.width}px`,
                  height: "100%",
                  backgroundColor: line.color
                }}
              />
            ))}
          </div>
          <div className="absolute inset-0">
            {virtualWindow.rows.map((entry) => (
              (() => {
                const { row, height, offsetTop } = entry;
                const rowIsTimelineGroup = row.groupKind === "deliverable";
                const deliverableOwnerNodeId =
                  typeof row.node.properties?.odeTimelineOwnerNodeId === "string"
                    ? row.node.properties.odeTimelineOwnerNodeId
                    : null;
                const deliverableId =
                  typeof row.node.properties?.odeTimelineDeliverableId === "string"
                    ? row.node.properties.odeTimelineDeliverableId
                    : null;
                return (
              <div
                key={`lane-${row.id}`}
                data-timeline-week-cell="true"
                className="absolute left-0 border-b border-[rgba(19,60,88,0.05)]"
                style={{
                  top: `${offsetTop}px`,
                  height: `${height}px`,
                  width: `${timelineGridWidth}px`
                }}
                onClick={() => {
                  if (rowIsTimelineGroup) return;
                  onCloseContextMenu();
                  onSetPrimarySelection(row.id);
                }}
                onPointerDown={(event) => {
                  if (rowIsTimelineGroup) return;
                  beginTimelineLaneDrag(
                    event,
                    row.id,
                    row.node.name,
                    resolveTimelineDayIndexFromPointer(event)
                  );
                }}
                onContextMenu={(event) => {
                  if (rowIsTimelineGroup) {
                    event.preventDefault();
                    if (deliverableOwnerNodeId && deliverableId) {
                      onOpenDeliverableGroupContextMenu(event, deliverableOwnerNodeId, deliverableId, row.node.name);
                    }
                    return;
                  }
                  onOpenNodeContextMenu(event, row.id);
                }}
              />
                  );
                })()
            ))}
          </div>
          <div className="pointer-events-none absolute inset-0 z-10">
            {virtualWindow.rows.map((entry) => {
              const { row, height, offsetTop } = entry;
              const scheduleMeta = resolveRenderedScheduleMeta(row.id);
              if (
                !scheduleMeta ||
                scheduleMeta.startDayIndex < 0 ||
                scheduleMeta.endDayIndex < scheduleMeta.startDayIndex
              ) {
                return null;
              }
              const left = scheduleMeta.startDayIndex * timelineDayColumnWidth + 2;
              const width = Math.max(
                16,
                (scheduleMeta.endDayIndex - scheduleMeta.startDayIndex + 1) * timelineDayColumnWidth - 4
              );
              const rowTop = offsetTop;
              const barOffsetTop = Math.max(8, Math.floor((height - 18) / 2));
              const tooltipTitle = scheduleMeta.schedule.title?.trim() || row.node.name;
              const isSaving = timelineSavingNodeId === row.id;
              const isDragging = timelineDragState?.nodeId === row.id;
              const passiveDuringDragClass =
                isTimelineDragActive && !isDragging ? "ode-timeline-range-bar-passive-during-drag" : "";
              const rowLayer = isDragging ? 50 : 5;

              return (
                <div
                  key={`bar-${row.id}`}
                  className="absolute left-0 right-0"
                  style={{ top: `${rowTop}px`, height: `${height}px`, zIndex: rowLayer }}
                >
                  <div
                    className={`ode-timeline-range-bar pointer-events-auto ${onGetTimelineStatusClass(scheduleMeta.schedule.status)} ${isSaving ? "ode-timeline-range-bar-saving" : ""} ${isDragging ? "ode-timeline-range-bar-dragging" : ""} ${passiveDuringDragClass}`}
                    style={{ left: `${left}px`, width: `${width}px`, top: `${barOffsetTop}px` }}
                    aria-label={`${tooltipTitle}. ${t(`timeline.status.${scheduleMeta.schedule.status}`)}. ${scheduleMeta.schedule.startDate} to ${scheduleMeta.schedule.endDate}.`}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onCloseContextMenu();
                      onSetPrimarySelection(row.id);
                    }}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onSetPrimarySelection(row.id);
                      onOpenScheduleModal(row.id);
                    }}
                    onPointerDown={(event) => beginTimelineBarDrag(event, row.id, scheduleMeta, "move")}
                  >
                    <span
                      className="ode-timeline-range-handle ode-timeline-range-handle-start"
                      onPointerDown={(event) => beginTimelineBarDrag(event, row.id, scheduleMeta, "resize-start")}
                    />
                    <span
                      className="ode-timeline-range-handle ode-timeline-range-handle-end"
                      onPointerDown={(event) => beginTimelineBarDrag(event, row.id, scheduleMeta, "resize-end")}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
