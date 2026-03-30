import { useEffect, useMemo, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { ChecklistGlyphSmall } from "@/components/Icons";
import { OdeAiMark } from "@/components/OdeAiMark";
import { QaChecklistReportFormModal } from "@/components/modals/QaChecklistReportFormModal";
import { UtilityModalShell } from "@/components/modals/UtilityModalShell";
import { QaChecklistItemCard } from "@/components/qa/QaChecklistItemCard";
import { getLocaleForLanguage, translate, type LanguageCode, type TranslationParams } from "@/lib/i18n";
import { openLocalPath, pickQaEvidenceFiles } from "@/lib/nodeService";
import {
  buildOrderedQaChecklistSections,
  buildQaChecklistPdfExportData,
  getQaChecklistEntry,
  readQaChecklistProgress,
  writeQaChecklistProgress,
  type QaChecklistAttachmentSource,
  type QaChecklistProgressState,
  type QaChecklistStatus,
  type QaChecklistStatusEntry
} from "@/lib/qaChecklistSupport";
import { type RegressionChecklistItem } from "@/lib/regressionChecklist";
import { type AiQaExecutionItemReport } from "@/lib/aiTester";

const QA_FILE_OUTPUTS_ENABLED = false;

type AiTesterUiState = {
  busy: boolean;
  notice: string | null;
  error: string | null;
  progress: { current: number; total: number; itemId: string | null } | null;
};

interface QaChecklistModalProps {
  open: boolean;
  language: LanguageCode;
  isUtilityPanelWindow: boolean;
  isWindowMaximized: boolean;
  items: RegressionChecklistItem[];
  checklistStateById: Record<string, QaChecklistStatusEntry>;
  aiReportItemById?: Map<string, AiQaExecutionItemReport>;
  automatableItemIds: string[];
  onSetStatus: (itemId: string, status: QaChecklistStatus) => void;
  onSetFailureReason: (itemId: string, reason: string) => void;
  onAddAttachments: (itemId: string, paths: string[], source: QaChecklistAttachmentSource) => void;
  onRemoveAttachment: (itemId: string, attachmentId: string) => void;
  onRunAutomation: (itemId: string) => Promise<string>;
  aiTesterState: AiTesterUiState;
  onRunAiTester: () => Promise<void>;
  onReset: () => void;
  onWindowMinimize: () => void;
  onWindowToggleMaximize: () => void;
  onClose: () => void;
}

export function QaChecklistModal({
  open,
  language,
  isUtilityPanelWindow,
  isWindowMaximized,
  items,
  checklistStateById,
  aiReportItemById,
  automatableItemIds,
  onSetStatus,
  onSetFailureReason,
  onAddAttachments,
  onRemoveAttachment,
  onRunAutomation,
  aiTesterState,
  onRunAiTester,
  onReset,
  onWindowMinimize,
  onWindowToggleMaximize,
  onClose
}: QaChecklistModalProps) {
  const t = (key: string, params?: TranslationParams) => translate(language, key, params);
  const showWindowControls = isTauri();
  const locale = getLocaleForLanguage(language);
  const qaFileCreationEnabled = QA_FILE_OUTPUTS_ENABLED;
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const itemElementByIdRef = useRef<Record<string, HTMLElement | null>>({});
  const hasRestoredChecklistScrollRef = useRef(false);
  const [reportFormOpen, setReportFormOpen] = useState(false);
  const [reportPreparedBy, setReportPreparedBy] = useState("");
  const [reportCycle, setReportCycle] = useState("");
  const [reportScope, setReportScope] = useState("");
  const [reportNotes, setReportNotes] = useState("");
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportNotice, setReportNotice] = useState<string | null>(null);
  const [reportBusy] = useState(false);
  const [evidenceBusyItemId, setEvidenceBusyItemId] = useState<string | null>(null);
  const [evidenceNoticeById, setEvidenceNoticeById] = useState<Record<string, string>>({});
  const [evidenceErrorById, setEvidenceErrorById] = useState<Record<string, string>>({});
  const [automationBusyItemId, setAutomationBusyItemId] = useState<string | null>(null);
  const [automationNoticeById, setAutomationNoticeById] = useState<Record<string, string>>({});
  const [automationErrorById, setAutomationErrorById] = useState<Record<string, string>>({});
  const [resumeState, setResumeState] = useState<QaChecklistProgressState>(() => readQaChecklistProgress());
  const [statusFilter, setStatusFilter] = useState<QaChecklistStatus | "all">("all");
  const automatableItemIdSet = useMemo(() => new Set(automatableItemIds), [automatableItemIds]);
  const orderedChecklistSections = useMemo(() => buildOrderedQaChecklistSections(items, language), [items, language]);
  const orderedChecklistItems = useMemo(() => orderedChecklistSections.flatMap((section) => section.items), [orderedChecklistSections]);
  const orderedChecklistItemById = useMemo(() => new Map(orderedChecklistItems.map((item) => [item.item.id, item])), [orderedChecklistItems]);
  const filteredChecklistSections = useMemo(
    () =>
      orderedChecklistSections
        .map((section) => ({
          ...section,
          items: statusFilter === "all" ? section.items : section.items.filter((item) => getQaChecklistEntry(checklistStateById, item.item.id).status === statusFilter)
        }))
        .filter((section) => section.items.length > 0),
    [checklistStateById, orderedChecklistSections, statusFilter]
  );
  const filteredChecklistItemCount = useMemo(() => filteredChecklistSections.reduce((total, section) => total + section.items.length, 0), [filteredChecklistSections]);
  const summary = useMemo(
    () => buildQaChecklistPdfExportData(orderedChecklistItems, checklistStateById, aiReportItemById).summary,
    [aiReportItemById, checklistStateById, orderedChecklistItems]
  );
  const aiTesterProgressItem = aiTesterState.progress?.itemId ? orderedChecklistItemById.get(aiTesterState.progress.itemId) ?? null : null;

  useEffect(() => {
    if (!open) {
      hasRestoredChecklistScrollRef.current = false;
      setReportFormOpen(false);
      setEvidenceBusyItemId(null);
      setEvidenceNoticeById({});
      setEvidenceErrorById({});
      setAutomationBusyItemId(null);
      setAutomationNoticeById({});
      setAutomationErrorById({});
      return;
    }
    if (!reportCycle) setReportCycle(new Date().toISOString().slice(0, 10));
  }, [open, reportCycle]);

  useEffect(() => {
    if (!open) return;
    listContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [open, statusFilter]);

  useEffect(() => {
    writeQaChecklistProgress(resumeState);
  }, [resumeState]);

  useEffect(() => {
    if (!open || hasRestoredChecklistScrollRef.current) return;
    hasRestoredChecklistScrollRef.current = true;
    const frame = window.requestAnimationFrame(() => {
      const container = listContainerRef.current;
      if (!container) return;
      if (resumeState.scrollTop > 0) {
        container.scrollTop = Math.max(0, resumeState.scrollTop);
        return;
      }
      if (resumeState.lastItemId) itemElementByIdRef.current[resumeState.lastItemId]?.scrollIntoView({ block: "start", behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, resumeState.scrollTop, resumeState.lastItemId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (reportFormOpen) {
        if (!reportBusy) {
          setReportFormOpen(false);
          setReportError(null);
        }
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, reportBusy, reportFormOpen]);

  if (!open) return null;

  const rememberChecklistProgress = (itemId?: string | null) => {
    const currentScrollTop = listContainerRef.current?.scrollTop ?? 0;
    setResumeState((current) => {
      const nextLastItemId = itemId === undefined ? current.lastItemId : itemId;
      if (current.scrollTop === currentScrollTop && current.lastItemId === nextLastItemId) return current;
      return { scrollTop: currentScrollTop, lastItemId: nextLastItemId };
    });
  };
  const resetChecklistProgress = () => {
    setResumeState({ scrollTop: 0, lastItemId: null });
    if (listContainerRef.current) listContainerRef.current.scrollTop = 0;
  };
  const setNoticeById = (setter: React.Dispatch<React.SetStateAction<Record<string, string>>>, itemId: string, message: string | null) =>
    setter((current) => {
      if (!message) {
        if (!(itemId in current)) return current;
        const next = { ...current };
        delete next[itemId];
        return next;
      }
      return { ...current, [itemId]: message };
    });
  const handleRunAutomation = async (itemId: string) => {
    rememberChecklistProgress(itemId);
    setAutomationBusyItemId(itemId);
    setNoticeById(setAutomationNoticeById, itemId, null);
    setNoticeById(setAutomationErrorById, itemId, null);
    try {
      setNoticeById(setAutomationNoticeById, itemId, await onRunAutomation(itemId));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setNoticeById(setAutomationErrorById, itemId, reason);
    } finally {
      setAutomationBusyItemId(null);
    }
  };
  const handleAddEvidenceFiles = async (itemId: string) => {
    rememberChecklistProgress(itemId);
    setEvidenceBusyItemId(itemId);
    setNoticeById(setEvidenceNoticeById, itemId, null);
    setNoticeById(setEvidenceErrorById, itemId, null);
    try {
      const paths = await pickQaEvidenceFiles();
      if (paths.length === 0) return;
      onAddAttachments(itemId, paths, "file");
      setNoticeById(setEvidenceNoticeById, itemId, t("qa.evidence_added", { count: paths.length }));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setNoticeById(setEvidenceErrorById, itemId, t("qa.evidence_error", { reason }));
    } finally {
      setEvidenceBusyItemId(null);
    }
  };
  const handleAddClipboardEvidence = async (itemId: string) => {
    rememberChecklistProgress(itemId);
    setEvidenceBusyItemId(itemId);
    setNoticeById(setEvidenceNoticeById, itemId, null);
    setNoticeById(setEvidenceErrorById, itemId, null);
    setNoticeById(setEvidenceErrorById, itemId, t("qa.evidence_error", { reason: "QA file creation is disabled." }));
    setEvidenceBusyItemId(null);
  };
  const handleOpenAttachment = async (itemId: string, path: string) => {
    rememberChecklistProgress(itemId);
    try {
      setNoticeById(setEvidenceErrorById, itemId, null);
      await openLocalPath(path);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setNoticeById(setEvidenceErrorById, itemId, t("qa.evidence_error", { reason }));
    }
  };

  return (
    <>
      <UtilityModalShell t={t} title={t("qa.modal_title")} icon={<ChecklistGlyphSmall />} isUtilityPanelWindow={isUtilityPanelWindow} showWindowControls={showWindowControls} isWindowMaximized={isWindowMaximized} onWindowMinimize={onWindowMinimize} onWindowToggleMaximize={onWindowToggleMaximize} onClose={onClose} closeOnBackdrop>
        <div className="ode-surface-panel flex flex-wrap items-center gap-2 rounded-xl px-3 py-2">
          <button type="button" className={`ode-qa-summary-pill ode-qa-summary-pill-btn ${statusFilter === "all" ? "ode-qa-summary-pill-active" : ""}`} aria-pressed={statusFilter === "all"} onClick={() => setStatusFilter("all")}>{t("qa.summary_total", { count: summary.total })}</button>
          <button type="button" className={`ode-qa-summary-pill ode-qa-summary-pill-btn ode-qa-summary-pill-pass ${statusFilter === "passed" ? "ode-qa-summary-pill-active" : ""}`} aria-pressed={statusFilter === "passed"} onClick={() => setStatusFilter((current) => (current === "passed" ? "all" : "passed"))}>{t("qa.summary_passed", { count: summary.passed })}</button>
          <button type="button" className={`ode-qa-summary-pill ode-qa-summary-pill-btn ode-qa-summary-pill-fail ${statusFilter === "failed" ? "ode-qa-summary-pill-active" : ""}`} aria-pressed={statusFilter === "failed"} onClick={() => setStatusFilter((current) => (current === "failed" ? "all" : "failed"))}>{t("qa.summary_failed", { count: summary.failed })}</button>
          <button type="button" className={`ode-qa-summary-pill ode-qa-summary-pill-btn ode-qa-summary-pill-pending ${statusFilter === "pending" ? "ode-qa-summary-pill-active" : ""}`} aria-pressed={statusFilter === "pending"} onClick={() => setStatusFilter((current) => (current === "pending" ? "all" : "pending"))}>{t("qa.summary_pending", { count: summary.pending })}</button>
          <div className="ml-auto flex items-center gap-2">
            <button className="ode-ai-access-btn h-9 px-3 text-[0.82rem]" onClick={() => { void onRunAiTester(); }} disabled={aiTesterState.busy}>
              <OdeAiMark compact />
              <span className="truncate">{aiTesterState.busy ? t("qa.ai_tester_run_auto_busy", { current: aiTesterState.progress?.current ?? 0, total: aiTesterState.progress?.total ?? summary.total }) : t("qa.ai_tester_run_auto", { count: summary.total })}</span>
            </button>
            {qaFileCreationEnabled ? <button className="ode-text-btn h-9 px-3 text-[0.82rem]" onClick={() => { rememberChecklistProgress(); setReportFormOpen(true); setReportError(null); setReportNotice(null); }} disabled={aiTesterState.busy}>{t("qa.report_export_btn")}</button> : null}
            <button className="ode-text-btn h-9 px-3 text-[0.82rem]" onClick={() => { onReset(); resetChecklistProgress(); }} disabled={aiTesterState.busy}>{t("qa.reset")}</button>
          </div>
        </div>
        {aiTesterState.busy && aiTesterProgressItem ? (
          <div className="rounded-lg border border-[rgba(54,140,198,0.24)] bg-[rgba(4,28,44,0.28)] px-3 py-2 text-[0.82rem] text-[var(--ode-text-dim)]">
            {t("qa.ai_tester_progress", { index: aiTesterState.progress?.current ?? 0, total: aiTesterState.progress?.total ?? summary.total, item: `${aiTesterProgressItem.numberLabel} ${aiTesterProgressItem.localizedItem.title}` })}
          </div>
        ) : null}
        {aiTesterState.notice ? <div className="rounded-lg border border-[rgba(39,146,202,0.4)] bg-[rgba(4,39,60,0.4)] px-3 py-2 text-[0.86rem] text-[var(--ode-accent)]">{aiTesterState.notice}</div> : null}
        {aiTesterState.error ? <div className="rounded-lg border border-[rgba(167,82,82,0.38)] bg-[rgba(42,14,14,0.22)] px-3 py-2 text-[0.86rem] text-[#ff9f9f]">{aiTesterState.error}</div> : null}
        {reportNotice ? <div className="rounded-lg border border-[rgba(39,146,202,0.4)] bg-[rgba(4,39,60,0.4)] px-3 py-2 text-[0.86rem] text-[var(--ode-accent)]">{reportNotice}</div> : null}
        <div ref={listContainerRef} className="ode-surface-panel min-h-0 flex-1 overflow-auto rounded-xl p-3" onScroll={() => rememberChecklistProgress()}>
          <div className="space-y-2">
            {filteredChecklistSections.map((section) => (
              <section key={`qa-section-${section.area}`} className="space-y-2">
                <div className="sticky top-0 z-[1] flex items-center gap-2 rounded-lg border border-[var(--ode-border)] bg-[rgba(2,20,33,0.92)] px-3 py-2 backdrop-blur-sm">
                  <span className="rounded-md border border-[var(--ode-border-strong)] bg-[rgba(7,48,75,0.5)] px-2 py-0.5 text-[0.76rem] font-semibold text-[var(--ode-accent)]">{section.sectionNumber}</span>
                  <span className="text-[0.82rem] uppercase tracking-[0.12em] text-[var(--ode-accent)]">{section.localizedArea}</span>
                  <span className="text-[0.76rem] text-[var(--ode-text-dim)]">{t("footer.items", { count: section.items.length })}</span>
                </div>
                {section.items.map((displayItem) => {
                  const entry = getQaChecklistEntry(checklistStateById, displayItem.item.id);
                  return <QaChecklistItemCard key={`qa-check-${displayItem.item.id}`} language={language} locale={locale} displayItem={displayItem} entry={entry} supportsAutomation={automatableItemIdSet.has(displayItem.item.id)} qaFileCreationEnabled={qaFileCreationEnabled} evidenceBusy={evidenceBusyItemId === displayItem.item.id} automationBusy={automationBusyItemId === displayItem.item.id} evidenceNotice={evidenceNoticeById[displayItem.item.id] ?? null} evidenceError={evidenceErrorById[displayItem.item.id] ?? null} automationNotice={automationNoticeById[displayItem.item.id] ?? null} automationError={automationErrorById[displayItem.item.id] ?? null} registerItemRef={(node) => { itemElementByIdRef.current[displayItem.item.id] = node; }} onRememberProgress={() => rememberChecklistProgress(displayItem.item.id)} onSetStatus={(status) => onSetStatus(displayItem.item.id, status)} onSetFailureReason={(reason) => onSetFailureReason(displayItem.item.id, reason)} onRunAutomation={() => { void handleRunAutomation(displayItem.item.id); }} onAddClipboardEvidence={() => { void handleAddClipboardEvidence(displayItem.item.id); }} onAddEvidenceFiles={() => { void handleAddEvidenceFiles(displayItem.item.id); }} onOpenAttachment={(path) => { void handleOpenAttachment(displayItem.item.id, path); }} onRemoveAttachment={(attachmentId) => { onRemoveAttachment(displayItem.item.id, attachmentId); }} />;
                })}
              </section>
            ))}
            {filteredChecklistItemCount === 0 ? <div className="rounded-xl border border-dashed border-[var(--ode-border-strong)] bg-[rgba(3,20,33,0.36)] px-4 py-8 text-center text-[0.9rem] text-[var(--ode-text-muted)]">{t("qa.filter_no_matches")}</div> : null}
          </div>
        </div>
      </UtilityModalShell>
      <QaChecklistReportFormModal open={qaFileCreationEnabled && reportFormOpen} language={language} preparedBy={reportPreparedBy} cycle={reportCycle} scope={reportScope} notes={reportNotes} error={reportError} busy={reportBusy} onPreparedByChange={setReportPreparedBy} onCycleChange={setReportCycle} onScopeChange={setReportScope} onNotesChange={setReportNotes} onClose={() => { if (reportBusy) return; setReportFormOpen(false); setReportError(null); }} onSubmit={() => setReportError("QA report export has been removed.")} />
    </>
  );
}
