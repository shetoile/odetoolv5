import type { MouseEvent as ReactMouseEvent } from "react";
import type { TranslationParams } from "@/lib/i18n";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";

type TranslateFn = (key: string, params?: TranslationParams) => string;

type WindowControlsVariant = "topbar" | "utility" | "icon";

interface WindowControlsProps {
  t: TranslateFn;
  variant: WindowControlsVariant;
  isWindowMaximized: boolean;
  disabled?: boolean;
  onWindowMinimize?: () => void;
  onWindowToggleMaximize?: () => void;
  onWindowClose: () => void;
}

export function WindowControls({
  t,
  variant,
  isWindowMaximized,
  disabled = false,
  onWindowMinimize,
  onWindowToggleMaximize,
  onWindowClose
}: WindowControlsProps) {
  const suppressWindowDrag = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };
  const sharedButtonProps = {
    "data-ode-window-drag-ignore": "true",
    "data-tauri-drag-region": "false"
  } as const;

  const minimizeButton = (
    <OdeTooltip label={t("window.minimize")} side="bottom">
      <button
        type="button"
        className={variant === "topbar" ? "ode-window-btn" : "ode-utility-window-btn"}
        onClick={onWindowMinimize}
        onMouseDown={suppressWindowDrag}
        onDoubleClick={suppressWindowDrag}
        aria-label={t("window.minimize")}
        data-window-control="minimize"
        disabled={disabled}
        {...sharedButtonProps}
      >
        <span className="ode-window-icon-shell" aria-hidden="true">
          <span className="ode-window-icon ode-window-icon-min" />
        </span>
      </button>
    </OdeTooltip>
  );

  const maximizeButton = (
    <OdeTooltip
      label={isWindowMaximized ? t("window.restore") : t("window.maximize")}
      side="bottom"
    >
      <button
        type="button"
        className={variant === "topbar" ? "ode-window-btn" : "ode-utility-window-btn"}
        onClick={onWindowToggleMaximize}
        onMouseDown={suppressWindowDrag}
        onDoubleClick={suppressWindowDrag}
        aria-label={isWindowMaximized ? t("window.restore") : t("window.maximize")}
        aria-pressed={isWindowMaximized}
        data-window-control={isWindowMaximized ? "restore" : "maximize"}
        disabled={disabled}
        {...sharedButtonProps}
      >
        <span className="ode-window-icon-shell" aria-hidden="true">
          <span
            className={`ode-window-icon ${isWindowMaximized ? "ode-window-icon-restore" : "ode-window-icon-max"}`}
          />
        </span>
      </button>
    </OdeTooltip>
  );

  const closeButton = (
    <OdeTooltip label={t("window.close")} side="bottom">
      <button
        type="button"
        className={
          variant === "topbar"
            ? "ode-window-btn ode-window-btn-close"
            : "ode-utility-window-btn ode-utility-window-btn-close"
        }
        onClick={onWindowClose}
        onMouseDown={suppressWindowDrag}
        onDoubleClick={suppressWindowDrag}
        aria-label={t("window.close")}
        data-window-control="close"
        disabled={disabled}
        {...sharedButtonProps}
      >
        <span className="ode-window-icon-shell" aria-hidden="true">
          <span className="ode-window-icon ode-window-icon-close" />
        </span>
      </button>
    </OdeTooltip>
  );

  if (variant === "icon") {
    return (
      <OdeTooltip label={t("window.close")} side="bottom">
        <button
          type="button"
          className="ode-icon-btn h-9 w-9 text-[1.3rem]"
          onClick={onWindowClose}
          onMouseDown={suppressWindowDrag}
          onDoubleClick={suppressWindowDrag}
          aria-label={t("window.close")}
          disabled={disabled}
          {...sharedButtonProps}
        >
          <span className="ode-window-icon-shell" aria-hidden="true">
            <span className="ode-window-icon ode-window-icon-close" />
          </span>
        </button>
      </OdeTooltip>
    );
  }

  if (variant === "topbar") {
    return (
      <div className="ode-window-controls">
        {minimizeButton}
        {maximizeButton}
        {closeButton}
      </div>
    );
  }

  return (
    <div className="ode-window-controls ode-window-controls-utility">
      {minimizeButton}
      {maximizeButton}
      {closeButton}
    </div>
  );
}
