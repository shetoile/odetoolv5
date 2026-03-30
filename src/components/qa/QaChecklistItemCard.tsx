import { translate, type LanguageCode, type TranslationParams } from "@/lib/i18n";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import {
  type QaChecklistDisplayItem,
  type QaChecklistStatusEntry
} from "@/lib/qaChecklistSupport";

interface QaChecklistItemCardProps {
  language: LanguageCode;
  locale: string;
  displayItem: QaChecklistDisplayItem;
  entry: QaChecklistStatusEntry;
  supportsAutomation: boolean;
  qaFileCreationEnabled: boolean;
  evidenceBusy: boolean;
  automationBusy: boolean;
  evidenceNotice: string | null;
  evidenceError: string | null;
  automationNotice: string | null;
  automationError: string | null;
  registerItemRef: (node: HTMLElement | null) => void;
  onRememberProgress: () => void;
  onSetStatus: (status: QaChecklistStatusEntry["status"]) => void;
  onSetFailureReason: (reason: string) => void;
  onRunAutomation: () => void;
  onAddClipboardEvidence: () => void;
  onAddEvidenceFiles: () => void;
  onOpenAttachment: (path: string) => void;
  onRemoveAttachment: (attachmentId: string) => void;
}

export function QaChecklistItemCard({
  language,
  locale,
  displayItem,
  entry,
  supportsAutomation,
  qaFileCreationEnabled,
  evidenceBusy,
  automationBusy,
  evidenceNotice,
  evidenceError,
  automationNotice,
  automationError,
  registerItemRef,
  onRememberProgress,
  onSetStatus,
  onSetFailureReason,
  onRunAutomation,
  onAddClipboardEvidence,
  onAddEvidenceFiles,
  onOpenAttachment,
  onRemoveAttachment
}: QaChecklistItemCardProps) {
  const t = (key: string, params?: TranslationParams) => translate(language, key, params);
  const statusClass =
    entry.status === "passed"
      ? "ode-qa-item-pass"
      : entry.status === "failed"
        ? "ode-qa-item-fail"
        : "ode-qa-item-pending";
  const showProofPanel =
    supportsAutomation ||
    entry.status === "failed" ||
    entry.attachments.length > 0 ||
    Boolean(evidenceNotice) ||
    Boolean(evidenceError) ||
    Boolean(automationNotice) ||
    Boolean(automationError);
  const checkedLabel = entry.checkedAt
    ? new Date(entry.checkedAt).toLocaleString(locale)
    : t("qa.last_checked_never");

  return (
    <article
      key={`qa-check-${displayItem.item.id}`}
      ref={registerItemRef}
      className="rounded-xl border border-[var(--ode-border)] bg-[rgba(5,29,46,0.48)] p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-[240px] flex-1">
          <div className="flex items-center gap-2 text-[0.74rem] uppercase tracking-[0.12em] text-[var(--ode-accent)]">
            <span className={`ode-qa-dot ${statusClass}`} />
            <span>{displayItem.localizedItem.area}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-[var(--ode-border-strong)] bg-[rgba(7,48,75,0.5)] px-2 py-0.5 text-[0.76rem] font-semibold text-[var(--ode-accent)]">
              {displayItem.numberLabel}
            </span>
            <h4 className="text-[0.98rem] font-semibold text-[var(--ode-text)]">
              {displayItem.localizedItem.title}
            </h4>
          </div>
          <p className="mt-1 text-[0.84rem] text-[var(--ode-text-muted)]">
            {displayItem.localizedItem.scenario}
          </p>
          <p className="mt-2 text-[0.76rem] text-[var(--ode-text-dim)]">
            {t("qa.last_checked")}: {checkedLabel}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            className={`ode-qa-action-btn ${entry.status === "pending" ? "ode-qa-action-btn-active" : ""}`}
            onClick={() => {
              onRememberProgress();
              onSetStatus("pending");
            }}
          >
            {t("qa.status.pending")}
          </button>
          <button
            className={`ode-qa-action-btn ${entry.status === "passed" ? "ode-qa-action-btn-active ode-qa-action-btn-pass" : ""}`}
            onClick={() => {
              onRememberProgress();
              onSetStatus("passed");
            }}
          >
            {t("qa.status.passed")}
          </button>
          <button
            className={`ode-qa-action-btn ${entry.status === "failed" ? "ode-qa-action-btn-active ode-qa-action-btn-fail" : ""}`}
            onClick={() => {
              onRememberProgress();
              onSetStatus("failed");
            }}
          >
            {t("qa.status.failed")}
          </button>
        </div>
      </div>
      {showProofPanel ? (
        <div
          className={`mt-3 space-y-3 rounded-xl border p-3 ${
            entry.status === "failed"
              ? "border-[rgba(167,82,82,0.38)] bg-[rgba(42,14,14,0.22)]"
              : "border-[var(--ode-border)] bg-[rgba(4,24,38,0.42)]"
          }`}
        >
          {entry.status === "failed" ? (
            <label className="block space-y-1.5">
              <span className="text-[0.76rem] uppercase tracking-[0.08em] text-[var(--ode-text-dim)]">
                {t("qa.failure_reason_label")}
              </span>
              <textarea
                rows={3}
                value={entry.failureReason}
                onChange={(event) => {
                  onRememberProgress();
                  onSetFailureReason(event.target.value);
                }}
                placeholder={t("qa.failure_reason_placeholder")}
                className="ode-input w-full resize-y rounded-lg px-3 py-2 text-[0.92rem] text-[var(--ode-text)] placeholder:text-[var(--ode-text-dim)]"
              />
            </label>
          ) : null}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[0.76rem] uppercase tracking-[0.08em] text-[var(--ode-text-dim)]">
                {t("qa.evidence_section_label")}
              </span>
              {supportsAutomation ? (
                <button
                  className="ode-text-btn h-8 px-3 text-[0.74rem]"
                  onClick={onRunAutomation}
                  disabled={automationBusy || evidenceBusy}
                >
                  {automationBusy ? t("qa.auto_running") : t("qa.auto_run")}
                </button>
              ) : null}
              {entry.status === "failed" ? (
                <>
                  {qaFileCreationEnabled ? (
                    <button
                      className="ode-text-btn h-8 px-3 text-[0.74rem]"
                      onClick={onAddClipboardEvidence}
                      disabled={evidenceBusy}
                    >
                      {t("qa.evidence_clipboard")}
                    </button>
                  ) : null}
                  <button
                    className="ode-text-btn h-8 px-3 text-[0.74rem]"
                    onClick={onAddEvidenceFiles}
                    disabled={evidenceBusy}
                  >
                    {t("qa.evidence_add_files")}
                  </button>
                </>
              ) : null}
            </div>
            {entry.attachments.length > 0 ? (
              <div className="space-y-2">
                {entry.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--ode-border)] bg-[rgba(4,24,38,0.52)] px-3 py-2"
                  >
                    <button
                      type="button"
                      className="min-w-[220px] flex-1 cursor-pointer rounded-md text-left transition hover:bg-[rgba(39,147,210,0.08)] focus:outline-none"
                      onClick={() => onOpenAttachment(attachment.path)}
                    >
                      <div className="flex items-center gap-2 text-[0.82rem] text-[var(--ode-text)]">
                        <span className="rounded-md border border-[var(--ode-border)] px-1.5 py-0.5 text-[0.68rem] uppercase tracking-[0.08em] text-[var(--ode-accent)]">
                          {attachment.source === "screenshot"
                            ? t("qa.evidence_source_screenshot")
                            : t("qa.evidence_source_file")}
                        </span>
                        <span className="font-medium">{attachment.name}</span>
                      </div>
                      <OdeTooltip label={attachment.path} side="top">
                        <p className="mt-1 break-all text-[0.74rem] text-[var(--ode-text-dim)]">
                          {attachment.path}
                        </p>
                      </OdeTooltip>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        className="ode-text-btn h-8 px-3 text-[0.72rem]"
                        onClick={() => onOpenAttachment(attachment.path)}
                      >
                        {t("qa.evidence_open")}
                      </button>
                      <button
                        className="ode-text-btn h-8 px-3 text-[0.72rem]"
                        onClick={() => {
                          onRememberProgress();
                          onRemoveAttachment(attachment.id);
                        }}
                      >
                        {t("qa.evidence_remove")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[0.8rem] text-[var(--ode-text-dim)]">{t("qa.evidence_none")}</p>
            )}
            {automationNotice ? <p className="text-[0.8rem] text-[var(--ode-accent)]">{automationNotice}</p> : null}
            {automationError ? <p className="text-[0.8rem] text-[#ff9f9f]">{automationError}</p> : null}
            {evidenceNotice ? <p className="text-[0.8rem] text-[var(--ode-accent)]">{evidenceNotice}</p> : null}
            {evidenceError ? <p className="text-[0.8rem] text-[#ff9f9f]">{evidenceError}</p> : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
