import { useEffect, useRef } from "react";
import { useDraggableModalSurface } from "@/hooks/useDraggableModalSurface";
import type { TranslationParams } from "@/lib/i18n";

type TranslateFn = (key: string, params?: TranslationParams) => string;

interface WorkspaceCreateModalProps {
  open: boolean;
  t: TranslateFn;
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function WorkspaceCreateModal({
  open,
  t,
  value,
  busy,
  onChange,
  onConfirm,
  onCancel
}: WorkspaceCreateModalProps) {
  const { surfaceRef, surfaceStyle, handlePointerDown } = useDraggableModalSurface({ open });
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const focusRafId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.cancelAnimationFrame(focusRafId);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="ode-overlay-scrim fixed inset-0 z-[246] flex items-center justify-center p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget || busy) return;
        onCancel();
      }}
    >
      <div
        ref={surfaceRef}
        style={surfaceStyle}
        className="ode-modal w-full max-w-lg overflow-hidden rounded-[24px] border border-[var(--ode-border-strong)]"
        role="dialog"
        aria-modal="true"
        aria-label={t("project.name_modal_title")}
      >
        <div
          className="ode-modal-drag-handle border-b border-[var(--ode-border)] px-6 py-5"
          onPointerDown={handlePointerDown}
        >
          <div className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--ode-accent)]">
            {t("project.create_btn")}
          </div>
          <h2 className="mt-1 text-[1.35rem] font-semibold tracking-tight text-[var(--ode-text)]">
            {t("project.name_modal_title")}
          </h2>
          <p className="mt-2 text-[0.86rem] text-[var(--ode-text-dim)]">
            {t("project.name_modal_hint")}
          </p>
        </div>
        <div className="px-6 py-5">
          <label className="block">
            <span className="mb-2 block text-[0.78rem] font-medium text-[var(--ode-text-dim)]">
              {t("project.name_prompt")}
            </span>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onConfirm();
                }
              }}
              className="ode-input h-12 w-full rounded-[16px] border-transparent bg-[rgba(8,40,61,0.34)] px-4 text-[1rem]"
              placeholder={t("project.name_prompt")}
              disabled={busy}
            />
          </label>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-[var(--ode-border)] px-6 py-4">
          <button type="button" className="ode-text-btn h-11 px-5" onClick={onCancel} disabled={busy}>
            {t("project.name_modal_cancel")}
          </button>
          <button
            type="button"
            className="ode-primary-btn h-11 px-6"
            onClick={onConfirm}
            disabled={busy || !value.trim()}
          >
            {busy ? t("project.creating") : t("project.name_modal_confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
