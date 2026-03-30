import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WindowControls } from "@/components/layout/WindowControls";
import { useDraggableModalSurface } from "@/hooks/useDraggableModalSurface";
import type { TranslationParams } from "@/lib/i18n";

type TranslateFn = (key: string, params?: TranslationParams) => string;

interface UtilityModalShellProps {
  t: TranslateFn;
  title: string;
  icon: ReactNode;
  isUtilityPanelWindow?: boolean;
  showWindowControls: boolean;
  isWindowMaximized: boolean;
  onWindowMinimize: () => void;
  onWindowToggleMaximize: () => void;
  onClose: () => void;
  closeOnBackdrop?: boolean;
  headerAside?: ReactNode;
  children: ReactNode;
}

export function UtilityModalShell({
  t,
  title,
  icon,
  isUtilityPanelWindow = false,
  showWindowControls,
  isWindowMaximized,
  onWindowMinimize,
  onWindowToggleMaximize,
  onClose,
  closeOnBackdrop = false,
  headerAside,
  children
}: UtilityModalShellProps) {
  const {
    surfaceRef,
    surfaceStyle,
    handlePointerDown,
    resetPosition
  } = useDraggableModalSurface({
    open: true,
    enabled: !isUtilityPanelWindow,
    viewportPadding: 16
  });

  const shouldIgnoreWindowDragTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest(
        "button, input, textarea, select, a, [role='button'], [data-ode-window-drag-ignore='true']"
      )
    );
  };
  const handleHeaderMouseDown = (event: ReactMouseEvent<HTMLElement>) => {
    if (!showWindowControls || !isUtilityPanelWindow) return;
    if (event.button !== 0) return;
    if (event.detail > 1) return;
    if (shouldIgnoreWindowDragTarget(event.target)) return;
    event.preventDefault();
    void getCurrentWindow().startDragging().catch(() => {
      // Fall back to passive drag region handling when native dragging is unavailable.
    });
  };
  const handleHeaderDoubleClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (shouldIgnoreWindowDragTarget(event.target)) return;
    if (!isUtilityPanelWindow) {
      resetPosition();
      return;
    }
    if (!showWindowControls) return;
    onWindowToggleMaximize();
  };

  return (
    <div
      className="ode-overlay-scrim fixed inset-0 z-[130] flex items-center justify-center p-2 backdrop-blur-sm sm:p-4"
      onMouseDown={
        closeOnBackdrop
          ? (event) => {
              if (event.target !== event.currentTarget) return;
              onClose();
            }
          : undefined
      }
    >
      <div
        ref={surfaceRef}
        style={surfaceStyle}
        className={`ode-modal flex flex-col overflow-hidden rounded-[20px] border border-[var(--ode-border-strong)] ${
          isUtilityPanelWindow
            ? "h-full w-full max-w-none"
            : "max-h-[94vh] w-full max-w-[1440px]"
        }`}
      >
        <div
          className={`flex items-center justify-between border-b border-[var(--ode-border)] px-6 py-4 ${
            isUtilityPanelWindow ? "" : "ode-modal-drag-handle"
          }`}
          onPointerDown={handlePointerDown}
          onMouseDown={handleHeaderMouseDown}
          onDoubleClick={handleHeaderDoubleClick}
        >
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2.5 text-[1.55rem] font-semibold tracking-tight text-[var(--ode-text)]">
              <span className="text-[var(--ode-accent)]">{icon}</span>
              <span>{title}</span>
            </h2>
          </div>
          <div className="flex items-center gap-3" data-ode-window-drag-ignore="true">
            {headerAside}
            <WindowControls
              t={t}
              variant={showWindowControls ? "utility" : "icon"}
              isWindowMaximized={isWindowMaximized}
              onWindowMinimize={onWindowMinimize}
              onWindowToggleMaximize={onWindowToggleMaximize}
              onWindowClose={onClose}
            />
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
