import type { MouseEvent as ReactMouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { TranslationParams } from "@/lib/i18n";
import { WorkspaceRootGlyphSmall } from "@/components/Icons";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import { WindowControls } from "@/components/layout/WindowControls";
import { APP_DISPLAY_NAME } from "@/lib/appIdentity";

type TranslateFn = (key: string, params?: TranslationParams) => string;
type WorkspaceMode = "grid" | "timeline";
type WorkspaceFocusMode = "structure" | "data" | "execution";

interface TopBarProps {
  t: TranslateFn;
  workspaceMode: WorkspaceMode;
  workspaceFocusMode: WorkspaceFocusMode;
  documentationModeActive: boolean;
  libraryModeActive: boolean;
  workspaceSettingsOpen: boolean;
  isDesktopRuntime: boolean;
  isWindowMaximized: boolean;
  hasBlockingOverlayOpen: boolean;
  onBrandClick?: () => void;
  onWindowDragStart?: (event: ReactMouseEvent<HTMLElement>) => void;
  onLibraryTabClick: () => void;
  onDocumentationTabClick: () => void;
  onDesktopTabClick: () => void;
  onWorkspaceSettingsClick: () => void;
  onWindowMinimize: () => void;
  onWindowToggleMaximize: () => void;
  onWindowClose: () => void;
}

export function TopBar({
  t,
  workspaceMode,
  workspaceFocusMode,
  documentationModeActive,
  libraryModeActive,
  workspaceSettingsOpen,
  isDesktopRuntime,
  isWindowMaximized,
  hasBlockingOverlayOpen,
  onBrandClick,
  onWindowDragStart,
  onLibraryTabClick,
  onDocumentationTabClick,
  onDesktopTabClick,
  onWorkspaceSettingsClick,
  onWindowMinimize,
  onWindowToggleMaximize,
  onWindowClose
}: TopBarProps) {
  const isDocumentationActive = documentationModeActive && !workspaceSettingsOpen;
  const isLibraryActive =
    workspaceMode === "grid" &&
    libraryModeActive &&
    !documentationModeActive &&
    !workspaceSettingsOpen;
  const isDesktopActive =
    workspaceMode === "grid" &&
    workspaceFocusMode !== "execution" &&
    !libraryModeActive &&
    !documentationModeActive &&
    !workspaceSettingsOpen;
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

  return (
    <header className="ode-topbar">
      <div className="ode-brand-shell">
        {onBrandClick ? (
          <OdeTooltip
            label={`${t("command.title")} (${t("command.shortcut")})`}
            side="bottom"
            align="start"
          >
            <button
              type="button"
              className="ode-brand-launcher"
              data-ode-window-drag-ignore="true"
              onClick={onBrandClick}
              aria-label={t("command.title")}
            >
              <span className="ode-brand-badge" aria-hidden="true">
                <img src="/ode-logo-ui.png" alt="" className="ode-brand-logo" />
              </span>
            </button>
          </OdeTooltip>
        ) : (
          <div className="ode-brand-launcher" aria-hidden="true">
            <span className="ode-brand-badge">
              <img src="/ode-logo-ui.png" alt="" className="ode-brand-logo" />
            </span>
          </div>
        )}

        <div
          className="ode-brand-titlebar"
          onMouseDown={handleWindowFrameMouseDown}
          onDoubleClick={handleWindowFrameDoubleClick}
        >
          <span className="ode-brand-title">{APP_DISPLAY_NAME}</span>
        </div>
      </div>
      <div
        className="ode-title-region"
        onMouseDown={handleWindowFrameMouseDown}
        onDoubleClick={handleWindowFrameDoubleClick}
      />

      <div className="flex min-w-0 items-stretch">
        <button
          data-ode-window-drag-ignore="true"
          className={`ode-tab-btn ${isLibraryActive ? "ode-tab-btn-active" : ""}`}
          onClick={onLibraryTabClick}
        >
          {t("tabs.library")}
        </button>
        <button
          data-ode-window-drag-ignore="true"
          className={`ode-tab-btn ${isDocumentationActive ? "ode-tab-btn-active" : ""}`}
          onClick={onDocumentationTabClick}
        >
          {t("tabs.documentation")}
        </button>
        <button
          data-ode-window-drag-ignore="true"
          className={`ode-tab-btn ${isDesktopActive ? "ode-tab-btn-active" : ""}`}
          onClick={onDesktopTabClick}
        >
          {t("tabs.desktop")}
        </button>
        <OdeTooltip label={t("project.title")} side="bottom">
          <button
            data-ode-window-drag-ignore="true"
            className={`ode-tab-btn flex w-[70px] items-center justify-center px-0 ${workspaceSettingsOpen ? "ode-tab-btn-active" : ""}`}
            onClick={onWorkspaceSettingsClick}
            aria-label={t("project.title")}
          >
            <WorkspaceRootGlyphSmall />
          </button>
        </OdeTooltip>
        <div data-ode-window-drag-ignore="true" className="flex items-stretch">
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
    </header>
  );
}
