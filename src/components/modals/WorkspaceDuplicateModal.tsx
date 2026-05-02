import { useEffect, useRef } from "react";
import { useDraggableModalSurface } from "@/hooks/useDraggableModalSurface";
import type { TranslationParams } from "@/lib/i18n";

type TranslateFn = (key: string, params?: TranslationParams) => string;

interface WorkspaceDuplicateModalProps {
  open: boolean;
  t: TranslateFn;
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function WorkspaceDuplicateModal({
  open,
  t,
  value,
  busy,
  onChange,
  onConfirm,
  onCancel
}: WorkspaceDuplicateModalProps) {
  const { surfaceRef, surfaceStyle, handlePointerDown } = useDraggableModalSurface({ open });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!open) return;
    const focusRafId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancelRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.cancelAnimationFrame(focusRafId);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="ode-overlay-scrim fixed inset-0 z-[245] flex items-center justify-center p-4 backdrop-blur-sm">
      <div
        ref={surfaceRef}
        style={surfaceStyle}
        className="ode-modal w-full max-w-xl overflow-hidden rounded-[24px] border border-[var(--ode-border-strong)]"
        role="dialog"
        aria-modal="true"
        aria-label={t("project.duplicate_btn")}
      >
        <div className="ode-modal-drag-handle border-b border-[var(--ode-border)] px-6 py-5" onPointerDown={handlePointerDown}>
          <h2 className="mt-1 text-[1.35rem] font-semibold tracking-tight text-[var(--ode-text)]">
            {t("project.name_prompt")}
          </h2>
        </div>
        <div className="px-6 py-5">
          <label className="block" aria-label={t("project.name_prompt")}>
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
            {busy ? t("project.duplicating_short") : t("project.duplicate_btn")}
          </button>
        </div>
      </div>
    </div>
  );
}
