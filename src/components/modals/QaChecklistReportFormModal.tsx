import { useDraggableModalSurface } from "@/hooks/useDraggableModalSurface";
import { translate, type LanguageCode, type TranslationParams } from "@/lib/i18n";

interface QaChecklistReportFormModalProps {
  open: boolean;
  language: LanguageCode;
  preparedBy: string;
  cycle: string;
  scope: string;
  notes: string;
  error: string | null;
  busy: boolean;
  onPreparedByChange: (value: string) => void;
  onCycleChange: (value: string) => void;
  onScopeChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function QaChecklistReportFormModal({
  open,
  language,
  preparedBy,
  cycle,
  scope,
  notes,
  error,
  busy,
  onPreparedByChange,
  onCycleChange,
  onScopeChange,
  onNotesChange,
  onClose,
  onSubmit
}: QaChecklistReportFormModalProps) {
  const t = (key: string, params?: TranslationParams) => translate(language, key, params);
  const { surfaceRef, surfaceStyle, handlePointerDown } = useDraggableModalSurface({ open });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-[#03101be0] p-3 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return;
        onClose();
      }}
    >
      <div
        ref={surfaceRef}
        style={surfaceStyle}
        className="ode-modal w-full max-w-[640px] rounded-2xl border border-[var(--ode-border-strong)] bg-[rgba(2,21,34,0.96)]"
      >
        <div
          className="ode-modal-drag-handle flex items-center justify-between border-b border-[var(--ode-border)] px-5 py-4"
          onPointerDown={handlePointerDown}
        >
          <h3 className="text-[1.2rem] font-semibold text-[var(--ode-text)]">{t("qa.report_modal_title")}</h3>
          <button className="ode-icon-btn h-8 w-8 text-[1.15rem]" onClick={onClose} disabled={busy}>
            x
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <label className="block space-y-1">
            <span className="text-[0.8rem] uppercase tracking-[0.08em] text-[var(--ode-text-dim)]">
              {t("qa.report_field_prepared_by")}
            </span>
            <input
              value={preparedBy}
              onChange={(event) => onPreparedByChange(event.target.value)}
              placeholder={t("qa.report_field_prepared_by_placeholder")}
              className="ode-input h-11 w-full rounded-lg px-3 text-[0.96rem] text-[var(--ode-text)] placeholder:text-[var(--ode-text-dim)]"
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-[0.8rem] uppercase tracking-[0.08em] text-[var(--ode-text-dim)]">
                {t("qa.report_field_cycle")}
              </span>
              <input
                value={cycle}
                onChange={(event) => onCycleChange(event.target.value)}
                placeholder={t("qa.report_field_cycle_placeholder")}
                className="ode-input h-11 w-full rounded-lg px-3 text-[0.96rem] text-[var(--ode-text)] placeholder:text-[var(--ode-text-dim)]"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[0.8rem] uppercase tracking-[0.08em] text-[var(--ode-text-dim)]">
                {t("qa.report_field_scope")}
              </span>
              <input
                value={scope}
                onChange={(event) => onScopeChange(event.target.value)}
                placeholder={t("qa.report_field_scope_placeholder")}
                className="ode-input h-11 w-full rounded-lg px-3 text-[0.96rem] text-[var(--ode-text)] placeholder:text-[var(--ode-text-dim)]"
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-[0.8rem] uppercase tracking-[0.08em] text-[var(--ode-text-dim)]">
              {t("qa.report_field_notes")}
            </span>
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder={t("qa.report_field_notes_placeholder")}
              className="ode-input w-full resize-y rounded-lg px-3 py-2 text-[0.92rem] text-[var(--ode-text)] placeholder:text-[var(--ode-text-dim)]"
            />
          </label>
          {error ? <p className="text-[0.86rem] text-[#ff9f9f]">{error}</p> : null}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[var(--ode-border)] px-5 py-4">
          <button className="ode-text-btn h-10 px-4" onClick={onClose} disabled={busy}>
            {t("qa.report_cancel_btn")}
          </button>
          <button className="ode-primary-btn h-10 px-5" onClick={onSubmit} disabled={busy}>
            {busy ? t("qa.report_generating_btn") : t("qa.report_generate_btn")}
          </button>
        </div>
      </div>
    </div>
  );
}
