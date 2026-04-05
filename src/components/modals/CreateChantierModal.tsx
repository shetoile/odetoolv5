import { useEffect, useState } from "react";
import { useDraggableModalSurface } from "@/hooks/useDraggableModalSurface";
import type { TranslationParams } from "@/lib/i18n";

type TranslateFn = (key: string, params?: TranslationParams) => string;

export type ChantierLibraryModelOption = {
  id: string;
  name: string;
  summary: string | null;
  naCode: string | null;
  sourceKind: "organisation_model" | "database_template";
};

interface CreateChantierModalProps {
  t: TranslateFn;
  open: boolean;
  targetNodeLabel: string;
  libraryModels: ChantierLibraryModelOption[];
  busy?: boolean;
  onClose: () => void;
  onSubmit: (input: {
    libraryModelId: string | null;
  }) => Promise<void> | void;
}

export function CreateChantierModal({
  t,
  open,
  targetNodeLabel,
  libraryModels,
  busy = false,
  onClose,
  onSubmit
}: CreateChantierModalProps) {
  const { surfaceRef, surfaceStyle, handlePointerDown } = useDraggableModalSurface({ open });
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedModelId((current) =>
      current && libraryModels.some((model) => model.id === current) ? current : libraryModels[0]?.id ?? null
    );
  }, [libraryModels, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [onClose, open]);

  if (!open) return null;

  const canSubmit = !busy && selectedModelId !== null;

  return (
    <div
      className="ode-overlay-scrim fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return;
        onClose();
      }}
    >
      <div
        ref={surfaceRef}
        style={surfaceStyle}
        className="ode-modal flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] border border-[var(--ode-border-strong)]"
      >
        <div
          className="ode-modal-drag-handle flex shrink-0 items-center justify-between border-b border-[var(--ode-border)] px-6 py-5"
          onPointerDown={handlePointerDown}
        >
          <div>
            <h2 className="text-[1.45rem] font-semibold tracking-tight text-[var(--ode-accent)]">
              {t("context.create_chantier_library")}
            </h2>
            <p className="mt-1 text-[0.92rem] text-[var(--ode-text-muted)]">
              {t("chantier.create_modal_target", { target: targetNodeLabel })}
            </p>
          </div>
          <button type="button" className="ode-icon-btn h-10 w-10" onClick={onClose} disabled={busy}>
            x
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="rounded-[20px] border border-[var(--ode-border)] bg-[rgba(5,29,46,0.56)] px-5 py-4">
            <div className="text-[0.78rem] uppercase tracking-[0.18em] text-[var(--ode-text-muted)]">
              {t("library.templates")}
            </div>
            {libraryModels.length > 0 ? (
              <div className="mt-4 max-h-[460px] space-y-3 overflow-y-auto pr-1">
                {libraryModels.map((model) => {
                  const selected = model.id === selectedModelId;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      className={`w-full rounded-[18px] border px-4 py-4 text-left transition ${
                        selected
                          ? "border-[rgba(95,220,255,0.48)] bg-[rgba(17,88,129,0.34)]"
                          : "border-[var(--ode-border)] bg-[rgba(4,22,36,0.52)] hover:border-[var(--ode-border-strong)]"
                      }`}
                      disabled={busy}
                      onClick={() => setSelectedModelId(model.id)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[1rem] font-semibold text-[var(--ode-text)]">{model.name}</div>
                        <span className="rounded-full border border-[rgba(95,220,255,0.18)] bg-[rgba(14,60,88,0.3)] px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.14em] text-[var(--ode-text-muted)]">
                          {t("chantier.create_modal_library_kind_template")}
                        </span>
                      </div>
                      <div className="mt-2 text-[0.88rem] leading-6 text-[var(--ode-text-muted)]">
                        {model.summary?.trim() || t("chantier.create_modal_library_summary_empty")}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-[18px] border border-dashed border-[var(--ode-border)] bg-[rgba(4,22,36,0.42)] px-4 py-5 text-[0.92rem] leading-7 text-[var(--ode-text-muted)]">
                {t("chantier.create_modal_library_empty")}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[var(--ode-border)] px-6 py-5">
          <button type="button" className="ode-text-btn" onClick={onClose} disabled={busy}>
            {t("chantier.create_modal_cancel")}
          </button>
          <button
            type="button"
            className="ode-text-btn-primary"
            disabled={!canSubmit}
            onClick={() => {
              if (!canSubmit) return;
              void onSubmit({
                libraryModelId: selectedModelId
              });
            }}
          >
            {busy ? t("chantier.create_modal_creating") : t("context.create_chantier_library")}
          </button>
        </div>
      </div>
    </div>
  );
}
