import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  ChecklistGlyphSmall,
  FileGlyphSmall,
  InfoGlyphSmall,
  QuestionMarkGlyphSmall
} from "@/components/Icons";
import { NodeQuickAppDock } from "@/components/layout/NodeQuickAppDock";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import { buildAppStorageKey } from "@/lib/appIdentity";
import type { TranslationParams } from "@/lib/i18n";
import type { MirrorStatus } from "@/lib/types";
import type { NodeQuickAppItem } from "@/lib/nodeQuickApps";
import { deriveUserProfileInitials } from "@/lib/userProfile";

type TranslateFn = (key: string, params?: TranslationParams) => string;

type BranchClipboardLike = { mode: "copy" | "cut" };
type WorkspaceMode = "grid" | "timeline";
type DesktopViewMode = "grid" | "mindmap" | "details" | "dashboard" | "library" | "procedure";
type WorkspaceFocusMode = "structure" | "data" | "execution";
type QaChecklistHealth = "pending" | "passed" | "failed";
type QaChecklistSummary = {
  total: number;
  pending: number;
  passed: number;
  failed: number;
};

interface StatusBarProps {
  version: string;
  t: TranslateFn;
  branchClipboard: BranchClipboardLike | null;
  mirrorStatus: MirrorStatus;
  workspaceMode: WorkspaceMode;
  desktopViewMode: DesktopViewMode;
  workspaceFocusMode: WorkspaceFocusMode;
  documentationModeActive: boolean;
  showExecutionMode?: boolean;
  workareaAvailable: boolean;
  workspaceEmptyOnly: boolean;
  onSelectWorkspaceFocusMode: (mode: WorkspaceFocusMode) => void;
  onToggleWorkspaceEmptyOnly: () => void;
  qaChecklistSummary: QaChecklistSummary;
  qaChecklistHealth: QaChecklistHealth;
  quickAppNodeLabel: string | null;
  quickApps: NodeQuickAppItem[];
  onLaunchQuickApp: (item: NodeQuickAppItem) => void;
  onReorderQuickApps: (quickApps: NodeQuickAppItem[]) => void;
  onManageQuickApps: () => void;
  onOpenReleaseNotes: () => void;
  onOpenHelp: () => void;
  onOpenQaChecklist: () => void;
  onOpenAssistant?: () => void;
  currentUserLabel?: string | null;
  currentUserPhotoDataUrl?: string | null;
  currentUserRole?: string | null;
  currentUserIsAdmin?: boolean;
  onOpenUserProfile?: () => void;
  onOpenUserAccounts?: () => void;
  onSignOut?: () => void;
}

type AiDockPosition = {
  left: number;
  top: number;
};

type StoredAiDockState = {
  mode: "custom";
  left: number;
  top: number;
};

type ViewportMetrics = {
  width: number;
  height: number;
  footerHeight: number;
};

const AI_DOCK_STATE_STORAGE_KEY = buildAppStorageKey("aiDockState.v2");
const AI_DOCK_SIZE_PX = 56;
const AI_DOCK_MARGIN_PX = 10;
const AI_DOCK_DEFAULT_RIGHT_PX = 15;
const AI_DOCK_DEFAULT_BOTTOM_GAP_PX = 12;
const AI_DOCK_FOOTER_FALLBACK_HEIGHT_PX = 34;
const AI_DOCK_DRAG_THRESHOLD_PX = 6;
const AI_DOCK_DOCK_SNAP_PX = 48;
const AI_DOCK_MAXIMIZED_TOLERANCE_PX = 24;

function clampAiDockPositionForViewport(
  position: AiDockPosition,
  viewportWidth: number,
  viewportHeight: number,
  footerHeight: number
): AiDockPosition {
  const maxLeft = Math.max(AI_DOCK_MARGIN_PX, viewportWidth - AI_DOCK_SIZE_PX - AI_DOCK_DEFAULT_RIGHT_PX);
  const maxTop = Math.max(
    AI_DOCK_MARGIN_PX,
    viewportHeight - AI_DOCK_SIZE_PX - footerHeight - AI_DOCK_DEFAULT_BOTTOM_GAP_PX
  );
  return {
    left: Math.min(Math.max(position.left, AI_DOCK_MARGIN_PX), maxLeft),
    top: Math.min(Math.max(position.top, AI_DOCK_MARGIN_PX), maxTop)
  };
}

function clampAiDockPosition(position: AiDockPosition, footerHeight = AI_DOCK_FOOTER_FALLBACK_HEIGHT_PX): AiDockPosition {
  if (typeof window === "undefined") return position;
  return clampAiDockPositionForViewport(position, window.innerWidth, window.innerHeight, footerHeight);
}

function getDefaultAiDockPositionForViewport(
  viewportWidth: number,
  viewportHeight: number,
  footerHeight: number
): AiDockPosition {
  return clampAiDockPositionForViewport(
    {
      left: viewportWidth - AI_DOCK_SIZE_PX - AI_DOCK_DEFAULT_RIGHT_PX,
      top: viewportHeight - AI_DOCK_SIZE_PX - footerHeight - AI_DOCK_DEFAULT_BOTTOM_GAP_PX
    },
    viewportWidth,
    viewportHeight,
    footerHeight
  );
}

function getDefaultAiDockPosition(footerHeight = AI_DOCK_FOOTER_FALLBACK_HEIGHT_PX): AiDockPosition {
  if (typeof window === "undefined") {
    return { left: AI_DOCK_MARGIN_PX, top: AI_DOCK_MARGIN_PX };
  }
  return getDefaultAiDockPositionForViewport(window.innerWidth, window.innerHeight, footerHeight);
}

function isNearDockedCorner(position: AiDockPosition, metrics: ViewportMetrics): boolean {
  const docked = getDefaultAiDockPositionForViewport(metrics.width, metrics.height, metrics.footerHeight);
  return (
    Math.abs(position.left - docked.left) <= AI_DOCK_DOCK_SNAP_PX &&
    Math.abs(position.top - docked.top) <= AI_DOCK_DOCK_SNAP_PX
  );
}

function isLikelyMaximizedViewport(width: number, height: number): boolean {
  if (typeof window === "undefined") return false;
  return (
    Math.abs(width - window.screen.availWidth) <= AI_DOCK_MAXIMIZED_TOLERANCE_PX &&
    Math.abs(height - window.screen.availHeight) <= AI_DOCK_MAXIMIZED_TOLERANCE_PX
  );
}

function readStoredAiDockPosition(): AiDockPosition | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AI_DOCK_STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredAiDockState>;
    if (parsed?.mode !== "custom" || typeof parsed.left !== "number" || typeof parsed.top !== "number") {
      return null;
    }
    const position = clampAiDockPosition({
      left: parsed.left,
      top: parsed.top
    });
    return isNearDockedCorner(position, {
      width: window.innerWidth,
      height: window.innerHeight,
      footerHeight: AI_DOCK_FOOTER_FALLBACK_HEIGHT_PX
    })
      ? null
      : position;
  } catch {
    return null;
  }
}

export function StatusBar({
  version,
  t,
  qaChecklistSummary,
  qaChecklistHealth,
  quickAppNodeLabel,
  quickApps,
  onLaunchQuickApp,
  onReorderQuickApps,
  onManageQuickApps,
  onOpenReleaseNotes,
  onOpenHelp,
  onOpenQaChecklist,
  onOpenAssistant,
  currentUserLabel,
  currentUserPhotoDataUrl,
  currentUserRole,
  currentUserIsAdmin = false,
  onOpenUserProfile,
  onOpenUserAccounts,
  onSignOut
}: StatusBarProps) {
  const [infoMenuOpen, setInfoMenuOpen] = useState(false);
  const [userProfileMenuOpen, setUserProfileMenuOpen] = useState(false);
  const [aiDockPosition, setAiDockPosition] = useState<AiDockPosition | null>(() => readStoredAiDockPosition());
  const [footerHeight, setFooterHeight] = useState(AI_DOCK_FOOTER_FALLBACK_HEIGHT_PX);
  const [isAiDockDragging, setIsAiDockDragging] = useState(false);
  const infoMenuRef = useRef<HTMLDivElement | null>(null);
  const userProfileMenuRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLElement | null>(null);
  const aiDockButtonRef = useRef<HTMLButtonElement | null>(null);
  const viewportMetricsRef = useRef<ViewportMetrics>({
    width: typeof window === "undefined" ? 0 : window.innerWidth,
    height: typeof window === "undefined" ? 0 : window.innerHeight,
    footerHeight: AI_DOCK_FOOTER_FALLBACK_HEIGHT_PX
  });
  const aiDockDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
    moved: boolean;
  } | null>(null);
  const suppressAiDockClickRef = useRef(false);
  const qaHealthClass =
    qaChecklistHealth === "failed"
      ? "ode-qa-btn-failed"
      : qaChecklistHealth === "passed"
        ? "ode-qa-btn-passed"
        : "ode-qa-btn-pending";
  const currentUserInitials = currentUserLabel ? deriveUserProfileInitials(currentUserLabel) : null;
  const userProfileTooltipLabel = currentUserRole
    ? `${currentUserLabel ?? "User"} (${currentUserRole})`
    : currentUserLabel ?? "User profile";
  const renderUserAvatar = (sizeClassName: string, textClassName: string) =>
    currentUserPhotoDataUrl ? (
      <img
        src={currentUserPhotoDataUrl}
        alt={currentUserLabel ?? "User profile"}
        className={`${sizeClassName} rounded-full object-cover`}
      />
    ) : (
      <span className={textClassName}>{currentUserInitials}</span>
    );

  const infoMenu = (
    <div className="relative flex items-center gap-2" ref={infoMenuRef}>
      <OdeTooltip label={t("footer.info")} side="top">
        <button
          type="button"
          className={`ode-statusbar-info-btn ${infoMenuOpen ? "ode-statusbar-info-btn-open" : ""}`}
          onClick={() => {
            setUserProfileMenuOpen(false);
            setInfoMenuOpen((prev) => !prev);
          }}
          aria-label={t("footer.info")}
          aria-expanded={infoMenuOpen}
        >
          <InfoGlyphSmall />
        </button>
      </OdeTooltip>
      {infoMenuOpen ? (
        <div className="ode-statusbar-info-menu">
          <div className="ode-statusbar-info-meta">
            <span className="ode-statusbar-info-version">{version}</span>
            <span>{t("footer.released")}</span>
          </div>
          <button
            type="button"
            className="ode-statusbar-info-action"
            onClick={() => {
              setInfoMenuOpen(false);
              onOpenReleaseNotes();
            }}
          >
            <FileGlyphSmall />
            <span>{t("release.open")}</span>
          </button>
          <button
            type="button"
            className="ode-statusbar-info-action"
            onClick={() => {
              setInfoMenuOpen(false);
              onOpenHelp();
            }}
          >
            <QuestionMarkGlyphSmall />
            <span>{t("help.open")}</span>
          </button>
          <OdeTooltip
            label={t("qa.summary_short", {
              passed: qaChecklistSummary.passed,
              failed: qaChecklistSummary.failed,
              pending: qaChecklistSummary.pending
            })}
            side="top"
          >
            <button
              type="button"
              className={`ode-statusbar-info-action ode-qa-btn ${qaHealthClass}`}
              onClick={() => {
                setInfoMenuOpen(false);
                onOpenQaChecklist();
              }}
            >
              <ChecklistGlyphSmall />
              <span>{t("qa.open")}</span>
              <span className="ode-qa-pill">
                {qaChecklistSummary.passed}/{qaChecklistSummary.total}
              </span>
              {qaChecklistSummary.failed > 0 ? (
                <span className="ode-qa-pill ode-qa-pill-failed">{qaChecklistSummary.failed}</span>
              ) : null}
            </button>
          </OdeTooltip>
        </div>
      ) : null}
    </div>
  );

  const userProfileMenu =
    currentUserLabel && currentUserInitials ? (
      <div className="relative inline-flex" ref={userProfileMenuRef}>
        <OdeTooltip label="Open profile settings" side="top" align="start">
          <button
            type="button"
            className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-[var(--ode-border-strong)] bg-[rgba(12,63,96,0.55)] text-[0.82rem] font-semibold tracking-[0.08em] text-[var(--ode-text)] transition hover:border-[var(--ode-border-accent)] hover:text-[var(--ode-text)] ${
              userProfileMenuOpen ? "border-[var(--ode-border-accent)] shadow-[0_0_0_4px_rgba(9,52,79,0.36)]" : ""
            }`}
            onClick={() => {
              setInfoMenuOpen(false);
              setUserProfileMenuOpen((prev) => !prev);
            }}
            aria-label={userProfileTooltipLabel}
            aria-expanded={userProfileMenuOpen}
          >
            {renderUserAvatar("h-full w-full", "text-[0.82rem] font-semibold tracking-[0.08em]")}
          </button>
        </OdeTooltip>
        {userProfileMenuOpen ? (
          <div className="absolute bottom-[calc(100%+0.45rem)] left-0 z-40 w-[min(300px,calc(100vw-1.5rem))] rounded-[22px] border border-[var(--ode-border-strong)] bg-[linear-gradient(180deg,rgba(7,34,54,0.98),rgba(4,18,30,0.98))] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.38)] backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--ode-border-strong)] bg-[rgba(12,63,96,0.55)] text-[0.84rem] font-semibold tracking-[0.08em] text-[var(--ode-text)]">
                {renderUserAvatar("h-full w-full", "text-[0.84rem] font-semibold tracking-[0.08em]")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[0.68rem] uppercase tracking-[0.18em] text-[var(--ode-text-muted)]">
                  User Profile
                </div>
                <div className="mt-1 truncate text-[1rem] font-medium text-[var(--ode-text)]">{currentUserLabel}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {currentUserRole ? (
                    <span className="rounded-full border border-[var(--ode-border)] px-2 py-0.5 text-[0.72rem] uppercase tracking-[0.12em] text-[var(--ode-text-muted)]">
                      {currentUserRole}
                    </span>
                  ) : null}
                  {currentUserIsAdmin ? (
                    <span className="rounded-full border border-[rgba(148,203,183,0.32)] px-2 py-0.5 text-[0.68rem] uppercase tracking-[0.12em] text-[#bcefd8]">
                      Admin
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {onOpenUserProfile || currentUserIsAdmin || onSignOut ? (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-[rgba(110,211,255,0.12)] pt-4">
                {onOpenUserProfile ? (
                  <button
                    type="button"
                    className="rounded-[12px] border border-[var(--ode-border)] px-3 py-2 text-[0.72rem] uppercase tracking-[0.12em] text-[var(--ode-text-muted)] transition hover:border-[var(--ode-border-accent)] hover:text-[var(--ode-text)]"
                    onClick={() => {
                      setUserProfileMenuOpen(false);
                      onOpenUserProfile();
                    }}
                  >
                    Profile
                  </button>
                ) : null}
                {currentUserIsAdmin && onOpenUserAccounts ? (
                  <button
                    type="button"
                    className="rounded-[12px] border border-[var(--ode-border)] px-3 py-2 text-[0.72rem] uppercase tracking-[0.12em] text-[var(--ode-text-muted)] transition hover:border-[var(--ode-border-accent)] hover:text-[var(--ode-text)]"
                    onClick={() => {
                      setUserProfileMenuOpen(false);
                      onOpenUserAccounts();
                    }}
                  >
                    Users
                  </button>
                ) : null}
                {onSignOut ? (
                  <button
                    type="button"
                    className="rounded-[12px] border border-[var(--ode-border)] px-3 py-2 text-[0.72rem] uppercase tracking-[0.12em] text-[var(--ode-text-muted)] transition hover:border-[var(--ode-border-accent)] hover:text-[var(--ode-text)]"
                    onClick={() => {
                      setUserProfileMenuOpen(false);
                      onSignOut();
                    }}
                  >
                    Sign Out
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    ) : null;

  useEffect(() => {
    if (!infoMenuOpen && !userProfileMenuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      if (infoMenuRef.current?.contains(event.target)) return;
      if (userProfileMenuRef.current?.contains(event.target)) return;
      setInfoMenuOpen(false);
      setUserProfileMenuOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setInfoMenuOpen(false);
        setUserProfileMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [infoMenuOpen, userProfileMenuOpen]);

  useEffect(() => {
    if (!currentUserLabel && userProfileMenuOpen) {
      setUserProfileMenuOpen(false);
    }
  }, [currentUserLabel, userProfileMenuOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!aiDockPosition) {
        localStorage.removeItem(AI_DOCK_STATE_STORAGE_KEY);
        return;
      }
      localStorage.setItem(
        AI_DOCK_STATE_STORAGE_KEY,
        JSON.stringify({
          mode: "custom",
          left: aiDockPosition.left,
          top: aiDockPosition.top
        } satisfies StoredAiDockState)
      );
    } catch {
      // Floating dock position is best-effort only.
    }
  }, [aiDockPosition]);

  useEffect(() => {
    const syncFooterMetrics = () => {
      const previousMetrics = viewportMetricsRef.current;
      const nextWidth = typeof window === "undefined" ? previousMetrics.width : window.innerWidth;
      const nextHeight = typeof window === "undefined" ? previousMetrics.height : window.innerHeight;
      const nextFooterHeight = Math.ceil(
        footerRef.current?.getBoundingClientRect().height ?? AI_DOCK_FOOTER_FALLBACK_HEIGHT_PX
      );
      setFooterHeight(nextFooterHeight);
      setAiDockPosition((current) => {
        if (!current) {
          return null;
        }
        if (isLikelyMaximizedViewport(nextWidth, nextHeight)) {
          return null;
        }
        if (isNearDockedCorner(current, previousMetrics)) {
          return null;
        }
        return clampAiDockPositionForViewport(current, nextWidth, nextHeight, nextFooterHeight);
      });
      viewportMetricsRef.current = {
        width: nextWidth,
        height: nextHeight,
        footerHeight: nextFooterHeight
      };
    };

    syncFooterMetrics();
    window.addEventListener("resize", syncFooterMetrics);

    const observer =
      typeof ResizeObserver !== "undefined" && footerRef.current
        ? new ResizeObserver(() => {
            syncFooterMetrics();
          })
        : null;
    if (observer && footerRef.current) {
      observer.observe(footerRef.current);
    }

    return () => {
      window.removeEventListener("resize", syncFooterMetrics);
      observer?.disconnect();
    };
  }, []);

  const resolvedAiDockPosition = aiDockPosition ?? getDefaultAiDockPosition(footerHeight);

  const clearAiDockDrag = (pointerId?: number) => {
    const dragState = aiDockDragRef.current;
    if (!dragState) return;
    if (pointerId !== undefined && dragState.pointerId !== pointerId) return;

    try {
      aiDockButtonRef.current?.releasePointerCapture(dragState.pointerId);
    } catch {
      // Capture release is best-effort only.
    }

    suppressAiDockClickRef.current = dragState.moved;
    aiDockDragRef.current = null;
    setIsAiDockDragging(false);
    if (dragState.moved) {
      setAiDockPosition((current) => {
        if (!current) return null;
        return isNearDockedCorner(current, viewportMetricsRef.current) ? null : current;
      });
    }
  };

  const handleAiDockPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const buttonRect = event.currentTarget.getBoundingClientRect();
    suppressAiDockClickRef.current = false;
    aiDockDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: buttonRect.left,
      originTop: buttonRect.top,
      moved: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleAiDockPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = aiDockDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    const distance = Math.hypot(deltaX, deltaY);

    if (!dragState.moved && distance < AI_DOCK_DRAG_THRESHOLD_PX) {
      return;
    }

    if (!dragState.moved) {
      dragState.moved = true;
      setIsAiDockDragging(true);
    }

    event.preventDefault();
    setAiDockPosition(
      clampAiDockPosition({
        left: dragState.originLeft + deltaX,
        top: dragState.originTop + deltaY
      }, footerHeight)
    );
  };

  return (
    <>
      {onOpenAssistant ? (
        <OdeTooltip label={t("assistant.fab_hint")} side="top">
          <button
            ref={aiDockButtonRef}
            type="button"
            className={`ode-ai-dock-btn ${isAiDockDragging ? "ode-ai-dock-btn-dragging" : ""}`}
            onPointerDown={handleAiDockPointerDown}
            onPointerMove={handleAiDockPointerMove}
            onPointerUp={(event) => {
              clearAiDockDrag(event.pointerId);
            }}
            onPointerCancel={(event) => {
              clearAiDockDrag(event.pointerId);
            }}
            onLostPointerCapture={(event) => {
              clearAiDockDrag(event.pointerId);
            }}
            onClick={(event) => {
              if (suppressAiDockClickRef.current) {
                suppressAiDockClickRef.current = false;
                event.preventDefault();
                return;
              }
              onOpenAssistant();
            }}
            aria-label={t("assistant.fab_open")}
            style={{
              left: `${resolvedAiDockPosition.left}px`,
              top: `${resolvedAiDockPosition.top}px`
            }}
          >
            <span className="ode-ai-dock-glow" />
            <span className="ode-ai-dock-orbit" />
            <span className="ode-ai-dock-core">
              <img src="/ode-logo-ui.png" alt="" className="ode-ai-dock-logo" />
            </span>
          </button>
        </OdeTooltip>
      ) : null}

      <footer ref={footerRef} className="ode-statusbar">
        <NodeQuickAppDock
          t={t}
          nodeLabel={quickAppNodeLabel}
          quickApps={quickApps}
          onLaunchQuickApp={onLaunchQuickApp}
          onReorderQuickApps={onReorderQuickApps}
          onManageQuickApps={onManageQuickApps}
          leadingSlot={userProfileMenu}
        />

        <div className="flex items-center gap-3 px-3">{infoMenu}</div>
      </footer>
    </>
  );
}
