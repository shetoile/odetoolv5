import { type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useDraggableModalSurface } from "@/hooks/useDraggableModalSurface";
import type { TranslationParams } from "@/lib/i18n";

type TranslateFn = (key: string, params?: TranslationParams) => string;

interface NodeTooltipEditModalProps {
  t: TranslateFn;
  open: boolean;
  nodeLabel: string;
  value: string;
  saving?: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void | Promise<void>;
}

export function NodeTooltipEditModal({
  t,
  open,
  nodeLabel,
  value,
  saving = false,
  onChange,
  onClose,
  onSave
}: NodeTooltipEditModalProps) {
  const { surfaceRef, surfaceStyle, handlePointerDown } = useDraggableModalSurface({ open });

  if (!open) return null;

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!saving) onClose();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (!saving) void onSave();
    }
  };

  return (
    <div
      className="ode-overlay-scrim fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget || saving) return;
        onClose();
      }}
    >
      <div
        ref={surfaceRef}
        style={surfaceStyle}
        className="ode-modal w-full max-w-lg overflow-hidden rounded-[22px] border border-[var(--ode-border-strong)]"
        onKeyDown={handleKeyDown}
      >
        <div
          className="ode-modal-drag-handle flex items-center justify-between border-b border-[var(--ode-border)] px-6 py-5"
          onPointerDown={handlePointerDown}
        >
          <div className="min-w-0">
            <h2 className="text-[1.35rem] font-semibold tracking-tight text-[var(--ode-accent)]">
              {t("sidebar.tooltip_editor_title")}
            </h2>
            <p className="mt-1 truncate text-[0.9rem] text-[var(--ode-text-dim)]">{nodeLabel}</p>
          </div>
          <button
            type="button"
            className="ode-icon-btn h-10 w-10"
            onClick={onClose}
            disabled={saving}
            aria-label={t("delete.modal_cancel")}
          >
            x
          </button>
        </div>

        <div className="px-6 py-5">
          <textarea
            className="ode-input min-h-[10rem] max-h-[50vh] w-full resize-y rounded-lg px-3 py-3 text-[0.96rem] leading-6 text-[var(--ode-text)] placeholder:text-[var(--ode-text-dim)]"
            placeholder={t("sidebar.tooltip_editor_placeholder")}
            value={value}
            autoFocus
            onChange={(event) => onChange(event.target.value)}
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--ode-border)] px-6 py-4">
          <button className="ode-text-btn h-11 px-5" onClick={onClose} disabled={saving}>
            {t("delete.modal_cancel")}
          </button>
          <button className="ode-primary-btn h-11 px-6" onClick={() => void onSave()} disabled={saving}>
            {saving ? t("sidebar.tooltip_editor_saving") : t("settings.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
