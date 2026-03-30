import { useEffect, useRef } from "react";
import { useDraggableModalSurface } from "@/hooks/useDraggableModalSurface";
import { translate, type LanguageCode, type TranslationParams } from "@/lib/i18n";

interface DeleteConfirmModalProps {
  open: boolean;
  language: LanguageCode;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmModal({
  open,
  language,
  message,
  onConfirm,
  onCancel
}: DeleteConfirmModalProps) {
  const t = (key: string, params?: TranslationParams) => translate(language, key, params);
  const { surfaceRef, surfaceStyle, handlePointerDown } = useDraggableModalSurface({ open });
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const focusRafId = window.requestAnimationFrame(() => {
      confirmButtonRef.current?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.cancelAnimationFrame(focusRafId);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div className="ode-overlay-scrim fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-sm">
      <div
        ref={surfaceRef}
        style={surfaceStyle}
        className="ode-modal w-full max-w-xl overflow-hidden rounded-[22px] border border-[var(--ode-border-strong)]"
      >
        <div className="ode-modal-drag-handle border-b border-[var(--ode-border)] px-6 py-5" onPointerDown={handlePointerDown}>
          <h2 className="text-[1.5rem] font-semibold tracking-tight text-[var(--ode-accent)]">
            {t("delete.modal_title")}
          </h2>
        </div>
        <div className="px-6 py-5">
          <p className="text-[1.08rem] leading-relaxed text-[var(--ode-text)]">{message}</p>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-[var(--ode-border)] px-6 py-4">
          <button className="ode-text-btn h-11 px-5" onClick={onCancel}>
            {t("delete.modal_cancel")}
          </button>
          <button ref={confirmButtonRef} type="button" className="ode-danger-btn h-11 px-6" onClick={onConfirm}>
            {t("delete.modal_confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
