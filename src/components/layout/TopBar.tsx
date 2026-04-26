import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent
} from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { TranslationParams } from "@/lib/i18n";
import { EditGlyphSmall, PlusGlyphSmall, SettingsGlyphSmall } from "@/components/Icons";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import { QuickAppIcon } from "@/components/quick-apps/QuickAppIcon";
import { WindowControls } from "@/components/layout/WindowControls";
import type { NodeQuickAppItem } from "@/lib/nodeQuickApps";

type TranslateFn = (key: string, params?: TranslationParams) => string;
type WorkspaceMode = "grid" | "timeline";
type WorkspaceFocusMode = "structure" | "data" | "execution";

interface TopBarProps {
  t: TranslateFn;
  hidden?: boolean;
  activeWorkspaceLabel?: string | null;
  workspaceToolsInsetLeft?: number;
  workspaceMode: WorkspaceMode;
  workspaceFocusMode: WorkspaceFocusMode;
  documentationModeActive: boolean;
  libraryModeActive: boolean;
  isDesktopRuntime: boolean;
  isWindowMaximized: boolean;
  hasBlockingOverlayOpen: boolean;
  workspaceSettingsEnabled?: boolean;
  onOpenWorkspaceSettings?: () => void;
  workspaceQuickAppsEnabled?: boolean;
  workspaceQuickApps?: NodeQuickAppItem[];
  onLaunchWorkspaceQuickApp?: (item: NodeQuickAppItem) => void;
  onManageWorkspaceQuickApps?: () => void;
  onBrandClick?: () => void;
  onWindowDragStart?: (event: ReactMouseEvent<HTMLElement>) => void;
  onLibraryTabClick: () => void;
  onDocumentationTabClick: () => void;
  onDesktopTabClick: () => void;
  onWindowMinimize: () => void;
  onWindowToggleMaximize: () => void;
  onWindowClose: () => void;
}

export function TopBar({
  t,
  hidden = false,
  activeWorkspaceLabel = null,
  workspaceToolsInsetLeft = 180,
  workspaceMode,
  workspaceFocusMode,
  documentationModeActive,
  libraryModeActive,
  isDesktopRuntime,
  isWindowMaximized,
  hasBlockingOverlayOpen,
  workspaceSettingsEnabled = false,
  onOpenWorkspaceSettings,
  workspaceQuickAppsEnabled = false,
  workspaceQuickApps = [],
  onLaunchWorkspaceQuickApp,
  onManageWorkspaceQuickApps,
  onBrandClick,
  onWindowDragStart,
  onLibraryTabClick,
  onDocumentationTabClick,
  onDesktopTabClick,
  onWindowMinimize,
  onWindowToggleMaximize,
  onWindowClose
}: TopBarProps) {
  void workspaceMode;
  void workspaceFocusMode;
  void documentationModeActive;
  void libraryModeActive;
  void onLibraryTabClick;
  void onDocumentationTabClick;
  void onDesktopTabClick;
  const brandTitle = activeWorkspaceLabel?.trim()
    ? `ODETool Pro - ${activeWorkspaceLabel.trim()}`
    : "ODETool Pro";
  const brandClickable = Boolean(onBrandClick) && !hasBlockingOverlayOpen;
  const workspaceLabel = activeWorkspaceLabel?.trim() ?? "";
  const showWorkspaceTools = workspaceSettingsEnabled || workspaceQuickAppsEnabled;
  const workspaceQuickAppsLabel = t("quick_apps.scope_function");
  const workspaceToolsLeft = Math.max(168, Math.round(workspaceToolsInsetLeft));
  const workspaceToolsRightInset = 176;

  const handleWindowFrameMouseDown = (event: ReactMouseEvent<HTMLElement>) => {
    if (!isDesktopRuntime) return;
    if (event.button !== 0) return;
    if (event.detail > 1) return;
    event.preventDefault();
    if (onWindowDragStart) {
      onWindowDragStart(event);
      return;
    }
    void getCurrentWindow().startDragging().catch(() => {
      // Fall back to the passive drag region when the native drag call is unavailable.
    });
  };
  const handleWindowFrameDoubleClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (!isDesktopRuntime) return;
    event.preventDefault();
    onWindowToggleMaximize();
  };
  const openWorkspaceSwitcher = () => {
    if (!workspaceSettingsEnabled || hasBlockingOverlayOpen) return;
    onOpenWorkspaceSettings?.();
  };
  const handleWorkspaceLabelKeyDown = (event: ReactKeyboardEvent<HTMLSpanElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openWorkspaceSwitcher();
  };

  if (!isDesktopRuntime || hidden) return null;

  return (
    <>
      <div
        className="fixed inset-x-0 top-0 z-[210] h-14"
        onMouseDown={handleWindowFrameMouseDown}
        onDoubleClick={handleWindowFrameDoubleClick}
      />

      <div className="pointer-events-none fixed inset-x-0 top-0 z-[211] h-14">
        <button
          type="button"
          data-ode-window-drag-ignore="true"
          data-tauri-drag-region="false"
          className={`pointer-events-auto absolute left-4 top-1/2 inline-flex -translate-y-1/2 items-center gap-3 rounded-full px-2 py-1.5 text-left transition ${
            brandClickable
              ? "cursor-pointer hover:bg-[rgba(7,36,57,0.42)]"
              : "cursor-default"
          }`}
          onClick={() => {
            if (!brandClickable) return;
            onBrandClick?.();
          }}
          title={brandTitle}
          aria-label={brandTitle}
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(6,29,47,0.9)] shadow-[inset_0_1px_0_rgba(121,219,255,0.06)]">
            <img src="/ode-logo-ui.png" alt="" className="h-7 w-7 object-contain" />
          </span>
          <span className="text-[1.08rem] font-semibold tracking-[0.01em] text-[var(--ode-text)]">ODETool Pro</span>
        </button>

        {showWorkspaceTools ? (
          <div
            className="pointer-events-auto absolute top-1/2 flex min-w-0 -translate-y-1/2 items-center gap-2.5"
            data-ode-window-drag-ignore="true"
            style={{ left: `${workspaceToolsLeft}px`, right: `${workspaceToolsRightInset}px` }}
          >
            {workspaceLabel ? (
              <span
                role={workspaceSettingsEnabled ? "button" : undefined}
                tabIndex={workspaceSettingsEnabled ? 0 : undefined}
                className={`inline-flex max-w-[220px] shrink-0 items-center truncate rounded-full px-3 py-1.5 text-[0.96rem] font-medium text-[var(--ode-text)] ${
                  workspaceSettingsEnabled
                    ? "cursor-pointer bg-[rgba(7,36,57,0.28)] transition hover:bg-[rgba(10,50,77,0.38)]"
                    : ""
                }`}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openWorkspaceSwitcher();
                }}
                onKeyDown={handleWorkspaceLabelKeyDown}
                aria-label={workspaceLabel}
              >
                {workspaceLabel}
              </span>
            ) : null}

            {workspaceSettingsEnabled ? (
              <OdeTooltip label={t("project.settings_title")} side="bottom" align="start">
                <button
                  type="button"
                  data-ode-window-drag-ignore="true"
                  data-tauri-drag-region="false"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[rgba(90,162,204,0.24)] bg-[rgba(7,36,57,0.32)] text-[var(--ode-text-dim)] transition hover:bg-[rgba(10,50,77,0.42)] hover:text-[var(--ode-text)]"
                  onClick={openWorkspaceSwitcher}
                  aria-label={t("project.settings_title")}
                  disabled={hasBlockingOverlayOpen}
                >
                  <SettingsGlyphSmall />
                </button>
              </OdeTooltip>
            ) : null}

            {workspaceQuickAppsEnabled ? (
              <div className="flex max-w-[320px] min-w-0 items-center gap-1.5 overflow-x-auto rounded-[14px] bg-[rgba(4,24,39,0.42)] px-1 py-1">
                {workspaceQuickApps.map((item) => (
                  <OdeTooltip key={item.id} label={item.label || workspaceQuickAppsLabel} side="bottom">
                    <button
                      type="button"
                      data-ode-window-drag-ignore="true"
                      data-tauri-drag-region="false"
                      className="group inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-transparent p-0 text-[var(--ode-text)] transition duration-150 hover:-translate-y-[1px] hover:bg-[rgba(18,75,108,0.26)]"
                      onClick={() => onLaunchWorkspaceQuickApp?.(item)}
                      aria-label={t("quick_apps.open_item", { name: item.label })}
                      disabled={hasBlockingOverlayOpen}
                    >
                      <QuickAppIcon item={item} variant="dock" />
                    </button>
                  </OdeTooltip>
                ))}
                <OdeTooltip
                  label={workspaceQuickApps.length > 0 ? t("quick_apps.manage") : workspaceQuickAppsLabel}
                  side="bottom"
                  align="start"
                >
                  <button
                    type="button"
                    data-ode-window-drag-ignore="true"
                    data-tauri-drag-region="false"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-transparent bg-[rgba(7,36,57,0.28)] text-[var(--ode-text-dim)] transition hover:bg-[rgba(10,50,77,0.38)] hover:text-[var(--ode-text)]"
                    onClick={() => onManageWorkspaceQuickApps?.()}
                    aria-label={workspaceQuickApps.length > 0 ? t("quick_apps.manage") : workspaceQuickAppsLabel}
                    disabled={hasBlockingOverlayOpen}
                  >
                    {workspaceQuickApps.length > 0 ? <EditGlyphSmall /> : <PlusGlyphSmall />}
                  </button>
                </OdeTooltip>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="pointer-events-auto absolute right-4 top-0 flex h-14 items-center" data-ode-window-drag-ignore="true">
          <div
            data-ode-window-drag-ignore="true"
            className="pointer-events-auto flex items-stretch overflow-hidden rounded-bl-[16px] border border-t-0 border-r-0 border-[rgba(67,142,188,0.26)] bg-[linear-gradient(180deg,rgba(5,25,44,0.84),rgba(2,15,28,0.74))] shadow-[0_14px_32px_rgba(0,0,0,0.26)] backdrop-blur-[14px]"
          >
            <WindowControls
              t={t}
              variant="topbar"
              isWindowMaximized={isWindowMaximized}
              disabled={hasBlockingOverlayOpen}
              onWindowMinimize={onWindowMinimize}
              onWindowToggleMaximize={onWindowToggleMaximize}
              onWindowClose={onWindowClose}
            />
          </div>
        </div>
      </div>
    </>
  );
}
