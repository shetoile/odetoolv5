import { useEffect, useMemo, useState } from "react";
import { DocumentTreeProposalEditor } from "@/components/overlay/DocumentTreeProposalEditor";
import { useDraggableModalSurface } from "@/hooks/useDraggableModalSurface";
import type { ApprovedDocumentTreeMemoryEntry } from "@/lib/aiTreeMemory";
import type { TranslationParams } from "@/lib/i18n";
import {
  exportTreeStructureExcel,
  pickWindowsTreeSpreadsheetFile,
  readTreeStructureExcel
} from "@/lib/nodeService";
import {
  buildDocumentTreeMemoryEntryFromSpreadsheetPayload,
  buildTreeSpreadsheetPayloadFromDocumentTreeMemory,
  normalizeTreeSpreadsheetPayload
} from "@/lib/treeSpreadsheet";

type TranslateFn = (key: string, params?: TranslationParams) => string;

interface AiTreeMemoryModalProps {
  open: boolean;
  t: TranslateFn;
  entries: ApprovedDocumentTreeMemoryEntry[];
  onClose: () => void;
  onRemove: (entryId: string) => void;
  onClearAll: () => void;
  onSave: (entry: ApprovedDocumentTreeMemoryEntry) => void;
}

function formatApprovedAt(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export function AiTreeMemoryModal({
  open,
  t,
  entries,
  onClose,
  onRemove,
  onClearAll,
  onSave
}: AiTreeMemoryModalProps) {
  const { surfaceRef, surfaceStyle, handlePointerDown } = useDraggableModalSurface({ open });
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [draftEntry, setDraftEntry] = useState<ApprovedDocumentTreeMemoryEntry | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedEntryId(null);
      setDraftEntry(null);
      setActionMessage(null);
      setActionError(null);
      return;
    }
    setSelectedEntryId((current) => current && entries.some((entry) => entry.id === current) ? current : (entries[0]?.id ?? null));
  }, [entries, open]);

  useEffect(() => {
    if (!open || !selectedEntryId) {
      setDraftEntry(null);
      return;
    }
    const entry = entries.find((item) => item.id === selectedEntryId) ?? null;
    setDraftEntry(entry ? JSON.parse(JSON.stringify(entry)) as ApprovedDocumentTreeMemoryEntry : null);
  }, [entries, open, selectedEntryId]);

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedEntryId) ?? null,
    [entries, selectedEntryId]
  );
  const hasUnsavedChanges =
    draftEntry && selectedEntry ? JSON.stringify(draftEntry) !== JSON.stringify(selectedEntry) : false;

  const importWorkbook = async () => {
    try {
      const filePath = await pickWindowsTreeSpreadsheetFile();
      if (!filePath) return;
      const payload = normalizeTreeSpreadsheetPayload(await readTreeStructureExcel(filePath));
      const importedEntry = buildDocumentTreeMemoryEntryFromSpreadsheetPayload(payload, {
        id: `tree-memory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        approvedAt: new Date().toISOString(),
        targetNodeId: selectedEntry?.targetNodeId ?? "__ROOT__",
        documentName: selectedEntry?.documentName ?? payload.meta?.documentName?.trim() ?? "Imported template",
        goal: selectedEntry?.goal ?? payload.meta?.goal?.trim() ?? payload.meta?.title?.trim() ?? "Imported tree template",
        outputLanguage: selectedEntry?.outputLanguage ?? payload.meta?.outputLanguage ?? "EN",
        sourceLabels: selectedEntry?.sourceLabels ?? [],
        notes: selectedEntry?.notes ?? ""
      });
      onSave(importedEntry);
      setSelectedEntryId(importedEntry.id);
      setActionError(null);
      setActionMessage(t("tree_excel.memory_import_done"));
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      setActionMessage(null);
      setActionError(reason);
    }
  };

  const exportWorkbook = async () => {
    try {
      if (!draftEntry) {
        throw new Error(t("tree_excel.memory_select_first"));
      }
      const savedPath = await exportTreeStructureExcel(
        t("tree_excel.memory_export_dialog_title"),
        `${draftEntry.goal || draftEntry.documentName || "ai-tree-memory"}.xlsx`,
        buildTreeSpreadsheetPayloadFromDocumentTreeMemory(draftEntry)
      );
      if (!savedPath) return;
      setActionError(null);
      setActionMessage(t("tree_excel.memory_export_done"));
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      setActionMessage(null);
      setActionError(reason);
    }
  };

  if (!open) return null;

  return (
    <div
      className="ode-overlay-scrim fixed inset-0 z-[172] flex items-center justify-center p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return;
        onClose();
      }}
    >
        <div
          ref={surfaceRef}
          style={surfaceStyle}
          className="ode-modal flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-[24px] border border-[var(--ode-border-strong)]"
        >
          <div
            className="ode-modal-drag-handle flex items-start justify-between gap-4 border-b border-[var(--ode-border)] px-6 py-5"
            onPointerDown={handlePointerDown}
          >
            <div className="min-w-0">
              <h2 className="text-[1.2rem] font-semibold tracking-tight text-[var(--ode-accent)]">
                {t("document_ai.tree_memory_title")}
              </h2>
            </div>
            <button type="button" className="ode-icon-btn h-10 w-10" onClick={onClose} aria-label={t("settings.cancel")}>
              x
            </button>
          </div>

          {actionMessage || actionError ? (
            <div className="border-b border-[var(--ode-border)] px-6 py-3">
              {actionMessage ? <p className="text-[0.9rem] text-[var(--ode-accent)]">{actionMessage}</p> : null}
              {actionError ? <p className="text-[0.9rem] text-[#ffb8b8]">{actionError}</p> : null}
            </div>
          ) : null}

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="overflow-y-auto border-r border-[var(--ode-border)] px-5 py-5">
            {entries.length === 0 ? (
              <div className="rounded-[18px] border border-[rgba(110,211,255,0.14)] bg-[rgba(4,24,39,0.5)] px-4 py-4 text-[0.94rem] text-[var(--ode-text-muted)]">
                {t("document_ai.tree_memory_empty")}
              </div>
            ) : (
              <div className="space-y-3">
                {entries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={`w-full rounded-[18px] border px-4 py-4 text-left transition ${
                      entry.id === selectedEntryId
                        ? "border-[var(--ode-accent)] bg-[rgba(38,157,214,0.14)]"
                        : "border-[rgba(110,211,255,0.14)] bg-[rgba(4,24,39,0.6)]"
                    }`}
                    onClick={() => {
                      setSelectedEntryId(entry.id);
                    }}
                  >
                    <div className="ode-wrap-text text-[0.98rem] font-medium text-[var(--ode-text)]">{entry.goal}</div>
                    <div className="mt-1 text-[0.8rem] text-[var(--ode-text-muted)]">
                      {t("document_ai.tree_memory_saved_at")}: {formatApprovedAt(entry.approvedAt)}
                    </div>
                    <div className="mt-2 text-[0.76rem] uppercase tracking-[0.12em] text-[var(--ode-accent)]">
                      {entry.outputLanguage}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="min-h-0 overflow-y-auto px-6 py-5">
            {!draftEntry ? (
              <div className="rounded-[20px] border border-[rgba(110,211,255,0.14)] bg-[rgba(4,24,39,0.5)] px-5 py-5 text-[0.94rem] text-[var(--ode-text-muted)]">
                {t("document_ai.tree_memory_pick")}
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-[18px] border border-[rgba(110,211,255,0.14)] bg-[rgba(4,24,39,0.46)] px-4 py-4">
                  <div className="ode-wrap-text text-[1rem] font-medium text-[var(--ode-text)]">{draftEntry.goal}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[0.8rem] text-[var(--ode-text-muted)]">
                    <span>{t("document_ai.tree_memory_saved_at")}: {formatApprovedAt(draftEntry.approvedAt)}</span>
                    <span className="rounded-full border border-[rgba(110,211,255,0.18)] px-2.5 py-1 text-[0.74rem] uppercase tracking-[0.11em] text-[var(--ode-accent)]">
                      {draftEntry.outputLanguage}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="mb-3 text-[0.76rem] uppercase tracking-[0.11em] text-[var(--ode-accent)]">
                    {t("document_ai.tree_memory_structure")}
                  </div>
                  <DocumentTreeProposalEditor
                    nodes={draftEntry.nodes}
                    t={t}
                    onChange={(nextNodes) => {
                      setDraftEntry((current) => (current ? { ...current, nodes: nextNodes } : current));
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--ode-border)] px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="ode-text-btn h-11 px-5"
              onClick={() => {
                void importWorkbook();
              }}
            >
              {t("tree_excel.import_ai_template")}
            </button>
            <button
              type="button"
              className="ode-text-btn h-11 px-5"
              onClick={() => {
                void exportWorkbook();
              }}
              disabled={!draftEntry}
            >
              {t("tree_excel.export_ai_template")}
            </button>
            <button
              type="button"
              className="ode-text-btn h-11 px-5"
              onClick={onClearAll}
              disabled={entries.length === 0}
            >
              {t("document_ai.tree_memory_clear")}
            </button>
            <button
              type="button"
              className="ode-text-btn h-11 px-5"
              onClick={() => {
                if (!selectedEntryId) return;
                onRemove(selectedEntryId);
              }}
              disabled={!selectedEntryId}
            >
              {t("document_ai.tree_memory_delete")}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" className="ode-text-btn h-11 px-5" onClick={onClose}>
              {t("window.close")}
            </button>
            <button
              type="button"
              className="ode-primary-btn h-11 px-5"
              onClick={() => {
                if (!draftEntry) return;
                onSave(draftEntry);
              }}
              disabled={!draftEntry || !hasUnsavedChanges}
            >
              {t("settings.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
