import { useEffect } from "react";
import { useDraggableModalSurface } from "@/hooks/useDraggableModalSurface";
import type { TranslationParams } from "@/lib/i18n";
import type { ODEImportPreview, ODENodeKind } from "@/lib/types";

type TranslateFn = (key: string, params?: TranslationParams) => string;

interface ODEImportPreviewModalProps {
  open: boolean;
  t: TranslateFn;
  preview: ODEImportPreview | null;
  createAs: Extract<ODENodeKind, "chantier" | "task"> | null;
  targetNodeName: string | null;
  targetPathLabel: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function ODEImportPreviewModal({
  open,
  t,
  preview,
  createAs,
  targetNodeName,
  targetPathLabel,
  onClose,
  onConfirm
}: ODEImportPreviewModalProps) {
  const { surfaceRef, surfaceStyle, handlePointerDown } = useDraggableModalSurface({ open });

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !preview || !createAs) return null;

  const confirmKey =
    createAs === "chantier"
      ? "ode_import_preview.confirm_chantier"
      : "ode_import_preview.confirm_task";

  return (
    <div
      className="ode-overlay-scrim fixed inset-0 z-[170] flex items-center justify-center p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return;
        onClose();
      }}
    >
      <div
        ref={surfaceRef}
        style={surfaceStyle}
        className="ode-modal flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] border border-[var(--ode-border-strong)]"
      >
        <div
          className="ode-modal-drag-handle flex items-center justify-between border-b border-[var(--ode-border)] px-6 py-5"
          onPointerDown={handlePointerDown}
        >
          <div>
            <h2 className="text-[1.2rem] font-semibold tracking-tight text-[var(--ode-accent)]">
              {t("ode_import_preview.title")}
            </h2>
          </div>
          <button type="button" className="ode-icon-btn h-10 w-10" onClick={onClose} aria-label={t("settings.cancel")}>
            x
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="ode-surface-muted rounded-xl px-4 py-4">
              <p className="text-[0.8rem] uppercase tracking-[0.12em] text-[var(--ode-accent)]">
                {t("ode_import_preview.target_title")}
              </p>
              <p className="mt-3 text-[0.96rem] text-[var(--ode-text)]">
                <span className="block text-[0.82rem] text-[var(--ode-text-muted)]">
                  {t("ode_import_preview.target_parent")}
                </span>
                {targetNodeName || t("ode_import_preview.target_parent_unknown")}
              </p>
              <p className="mt-3 text-[0.96rem] text-[var(--ode-text)]">
                <span className="block text-[0.82rem] text-[var(--ode-text-muted)]">
                  {t("ode_import_preview.target_na")}
                </span>
                {preview.targetNA && preview.targetLabel
                  ? `${preview.targetNA} ${preview.targetLabel}`
                  : t("ode_import_preview.target_parent_unknown")}
              </p>
              {targetPathLabel ? (
                <p className="mt-3 text-[0.9rem] leading-6 text-[var(--ode-text-dim)]">
                  <span className="block text-[0.82rem] text-[var(--ode-text-muted)]">
                    {t("ode_import_preview.target_path")}
                  </span>
                  {targetPathLabel}
                </p>
              ) : null}
            </div>

            <div className="ode-surface-muted rounded-xl px-4 py-4">
              <p className="text-[0.8rem] uppercase tracking-[0.12em] text-[var(--ode-accent)]">
                {t("ode_import_preview.plan_title")}
              </p>
              <p className="mt-3 text-[0.96rem] text-[var(--ode-text)]">
                <span className="block text-[0.82rem] text-[var(--ode-text-muted)]">
                  {t("ode_import_preview.chantier_title")}
                </span>
                {preview.chantierTitle || "-"}
              </p>
              <p className="mt-3 text-[0.96rem] text-[var(--ode-text)]">
                <span className="block text-[0.82rem] text-[var(--ode-text-muted)]">
                  {t("ode_import_preview.estimated_nodes")}
                </span>
                {preview.estimatedNodeCount}
              </p>
              <p className="mt-3 text-[0.96rem] text-[var(--ode-text)]">
                <span className="block text-[0.82rem] text-[var(--ode-text-muted)]">
                  {t("ode_import_preview.confidence")}
                </span>
                {Math.round(preview.confidence * 100)}%
              </p>
            </div>
          </div>

          {preview.warnings.length > 0 ? (
            <div className="rounded-xl border border-[rgba(255,191,107,0.35)] bg-[rgba(67,40,10,0.35)] px-4 py-4">
              <p className="text-[0.8rem] uppercase tracking-[0.12em] text-[#ffd18e]">
                {t("ode_import_preview.warnings")}
              </p>
              <ul className="mt-3 space-y-2 text-[0.94rem] leading-6 text-[var(--ode-text)]">
                {preview.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--ode-border)] px-6 py-4">
          <button type="button" className="ode-text-btn h-11 px-5" onClick={onClose}>
            {t("settings.cancel")}
          </button>
          <button type="button" className="ode-primary-btn h-11 px-5" onClick={onConfirm}>
            {t(confirmKey)}
          </button>
        </div>
      </div>
    </div>
  );
}
