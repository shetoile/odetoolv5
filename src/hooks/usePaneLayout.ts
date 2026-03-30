import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";

type UsePaneLayoutParams = {
  sidebarDefaultWidth: number;
  sidebarCollapsedStorageKey: string;
  sidebarMinWidth: number;
  mainMinWidth: number;
  timelineNodePanelDefaultWidth: number;
  timelineNodePanelMinWidth: number;
  timelineGridMinWidth: number;
};

type TimelineScrollSource = "left" | "right";

export function usePaneLayout({
  sidebarDefaultWidth,
  sidebarCollapsedStorageKey,
  sidebarMinWidth,
  mainMinWidth,
  timelineNodePanelDefaultWidth,
  timelineNodePanelMinWidth,
  timelineGridMinWidth
}: UsePaneLayoutParams) {
  const [sidebarWidth, setSidebarWidth] = useState(sidebarDefaultWidth);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => localStorage.getItem(sidebarCollapsedStorageKey) === "1"
  );
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [timelineNodePanelWidth, setTimelineNodePanelWidth] = useState(timelineNodePanelDefaultWidth);
  const [isResizingTimelinePanel, setIsResizingTimelinePanel] = useState(false);
  const [isLargeLayout, setIsLargeLayout] = useState(true);

  const timelineLeftScrollRef = useRef<HTMLDivElement | null>(null);
  const timelineRightScrollRef = useRef<HTMLDivElement | null>(null);
  const timelineScrollSyncSourceRef = useRef<TimelineScrollSource | null>(null);
  const sidebarResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const timelinePanelResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const clampSidebarWidth = (next: number) => {
    const maxWidth = Math.max(sidebarMinWidth, window.innerWidth - mainMinWidth);
    return Math.max(sidebarMinWidth, Math.min(maxWidth, next));
  };

  const clampTimelineNodePanelWidth = (next: number) => {
    const maxWidth = Math.max(timelineNodePanelMinWidth, window.innerWidth - timelineGridMinWidth);
    return Math.max(timelineNodePanelMinWidth, Math.min(maxWidth, next));
  };

  const startSidebarResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isLargeLayout || isSidebarCollapsed) return;
    event.preventDefault();
    sidebarResizeRef.current = {
      startX: event.clientX,
      startWidth: sidebarWidth
    };
    setIsResizingSidebar(true);
  };

  const nudgeSidebarWidth = (delta: number) => {
    setSidebarWidth((prev) => clampSidebarWidth(prev + delta));
  };

  const startTimelinePanelResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isLargeLayout) return;
    event.preventDefault();
    timelinePanelResizeRef.current = {
      startX: event.clientX,
      startWidth: timelineNodePanelWidth
    };
    setIsResizingTimelinePanel(true);
  };

  const nudgeTimelineNodePanelWidth = (delta: number) => {
    setTimelineNodePanelWidth((prev) => clampTimelineNodePanelWidth(prev + delta));
  };

  const syncTimelineVerticalScroll = (source: TimelineScrollSource) => {
    const left = timelineLeftScrollRef.current;
    const right = timelineRightScrollRef.current;
    if (!left || !right) return;

    if (timelineScrollSyncSourceRef.current && timelineScrollSyncSourceRef.current !== source) return;
    timelineScrollSyncSourceRef.current = source;

    if (source === "left") {
      if (Math.abs(right.scrollTop - left.scrollTop) > 0.5) {
        right.scrollTop = left.scrollTop;
      }
    } else if (Math.abs(left.scrollTop - right.scrollTop) > 0.5) {
      left.scrollTop = right.scrollTop;
    }

    window.requestAnimationFrame(() => {
      timelineScrollSyncSourceRef.current = null;
    });
  };

  useEffect(() => {
    const syncLayoutMode = () => {
      const large = window.innerWidth >= 1024;
      setIsLargeLayout(large);
      setSidebarWidth((prev) => clampSidebarWidth(prev));
      setTimelineNodePanelWidth((prev) => clampTimelineNodePanelWidth(prev));
      if (!large) {
        setIsResizingSidebar(false);
        sidebarResizeRef.current = null;
        setIsResizingTimelinePanel(false);
        timelinePanelResizeRef.current = null;
      }
    };
    syncLayoutMode();
    window.addEventListener("resize", syncLayoutMode);
    return () => {
      window.removeEventListener("resize", syncLayoutMode);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(sidebarCollapsedStorageKey, isSidebarCollapsed ? "1" : "0");
    if (isSidebarCollapsed) {
      setIsResizingSidebar(false);
      sidebarResizeRef.current = null;
    }
  }, [isSidebarCollapsed, sidebarCollapsedStorageKey]);

  useEffect(() => {
    if (!isResizingSidebar) return;

    const onMove = (event: PointerEvent) => {
      const state = sidebarResizeRef.current;
      if (!state) return;
      const delta = event.clientX - state.startX;
      setSidebarWidth(clampSidebarWidth(state.startWidth + delta));
    };

    const stop = () => {
      setIsResizingSidebar(false);
      sidebarResizeRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [isResizingSidebar]);

  useEffect(() => {
    if (!isResizingTimelinePanel) return;

    const onMove = (event: PointerEvent) => {
      const state = timelinePanelResizeRef.current;
      if (!state) return;
      const delta = event.clientX - state.startX;
      setTimelineNodePanelWidth(clampTimelineNodePanelWidth(state.startWidth + delta));
    };

    const stop = () => {
      setIsResizingTimelinePanel(false);
      timelinePanelResizeRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [isResizingTimelinePanel]);

  return {
    isLargeLayout,
    sidebarWidth,
    setSidebarWidth,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    isResizingSidebar,
    clampSidebarWidth,
    startSidebarResize,
    nudgeSidebarWidth,
    timelineNodePanelWidth,
    setTimelineNodePanelWidth,
    isResizingTimelinePanel,
    clampTimelineNodePanelWidth,
    startTimelinePanelResize,
    nudgeTimelineNodePanelWidth,
    timelineLeftScrollRef,
    timelineRightScrollRef,
    syncTimelineVerticalScroll
  };
}
