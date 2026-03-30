import { useEffect, useRef, useState } from "react";
import { useDraggableModalSurface } from "@/hooks/useDraggableModalSurface";
import type { ApprovedIntegratedPlanMemoryEntry } from "@/lib/aiMemory";
import type { TranslationParams } from "@/lib/i18n";

type TranslateFn = (key: string, params?: TranslationParams) => string;

interface AiMemoryReviewModalProps {
  open: boolean;
  t: TranslateFn;
  entries: ApprovedIntegratedPlanMemoryEntry[];
  onClose: () => void;
  onRemove: (entryId: string) => void;
  onClearAll: () => void;
}

function formatApprovedAt(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export function AiMemoryReviewModal({
  open,
  t,
  entries,
  onClose,
  onRemove,
  onClearAll
}: AiMemoryReviewModalProps) {
  const { surfaceRef, surfaceStyle, handlePointerDown } = useDraggableModalSurface({ open });
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const entryRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!open) {
      setSelectedEntryId(null);
      return;
    }
    setSelectedEntryId((current) =>
      current && entries.some((entry) => entry.id === current) ? current : (entries[0]?.id ?? null)
    );
  }, [entries, open]);

  useEffect(() => {
    if (!open || !selectedEntryId) return;
    const row = entryRefs.current.get(selectedEntryId);
    if (!row) return;
    const rafId = window.requestAnimationFrame(() => {
      row.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [open, selectedEntryId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const isEditableTarget =
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          Boolean(event.target.closest("[contenteditable='true']")) ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName));
      if (isEditableTarget) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (entries.length === 0) return;
      const selectedIndex = selectedEntryId ? entries.findIndex((entry) => entry.id === selectedEntryId) : -1;

      if (event.key === "ArrowUp") {
        event.preventDefault();
        const nextIndex = selectedIndex > 0 ? selectedIndex - 1 : 0;
        setSelectedEntryId(entries[nextIndex]?.id ?? null);
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const startIndex = selectedIndex >= 0 ? selectedIndex : 0;
        const nextIndex = Math.min(entries.length - 1, startIndex + 1);
        setSelectedEntryId(entries[nextIndex]?.id ?? null);
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        setSelectedEntryId(entries[0]?.id ?? null);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        setSelectedEntryId(entries[entries.length - 1]?.id ?? null);
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && selectedEntryId) {
        event.preventDefault();
        onRemove(selectedEntryId);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [entries, onClose, onRemove, open, selectedEntryId]);

  if (!open) return null;

  return (
    <div
      className="ode-overlay-scrim fixed inset-0 z-[171] flex items-center justify-center p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return;
        onClose();
      }}
    >
      <div
        ref={surfaceRef}
        style={surfaceStyle}
        className="ode-modal flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] border border-[var(--ode-border-strong)]"
      >
        <div
          className="ode-modal-drag-handle flex items-start justify-between gap-4 border-b border-[var(--ode-border)] px-6 py-5"
          onPointerDown={handlePointerDown}
        >
          <div className="min-w-0">
            <h2 className="text-[1.2rem] font-semibold tracking-tight text-[var(--ode-accent)]">
              {t("procedure.ai_memory_title")}
            </h2>
          </div>
          <button type="button" className="ode-icon-btn h-10 w-10" onClick={onClose} aria-label={t("settings.cancel")}>
            x
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {entries.length === 0 ? (
            <div className="rounded-[20px] border border-[rgba(110,211,255,0.14)] bg-[rgba(4,24,39,0.5)] px-5 py-5 text-[0.94rem] text-[var(--ode-text-muted)]">
              {t("procedure.ai_memory_empty")}
            </div>
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  ref={(element) => {
                    if (element) {
                      entryRefs.current.set(entry.id, element);
                    } else {
                      entryRefs.current.delete(entry.id);
                    }
                  }}
                  className={`rounded-[18px] border px-4 py-4 transition ${
                    entry.id === selectedEntryId
                      ? "border-[var(--ode-accent)] bg-[rgba(38,157,214,0.14)]"
                      : "border-[rgba(110,211,255,0.14)] bg-[rgba(4,24,39,0.6)]"
                  }`}
                  onMouseDown={() => {
                    setSelectedEntryId(entry.id);
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="ode-wrap-text text-[1rem] font-medium text-[var(--ode-text)]">{entry.nodeTitle}</div>
                      <div className="mt-1 text-[0.82rem] text-[var(--ode-text-muted)]">
                        {t("procedure.ai_memory_saved_at")}: {formatApprovedAt(entry.approvedAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="rounded-full border border-[var(--ode-border)] bg-[rgba(5,29,46,0.82)] px-4 py-2 text-[0.8rem] text-[var(--ode-text-muted)] transition hover:border-[var(--ode-border-strong)] hover:text-[var(--ode-text)]"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemove(entry.id);
                      }}
                    >
                      {t("procedure.ai_memory_delete")}
                    </button>
                  </div>

                  {entry.description ? (
                    <p className="ode-wrap-text mt-3 text-[0.9rem] leading-6 text-[var(--ode-text-dim)]">{entry.description}</p>
                  ) : null}

                  {entry.structureTitles.length > 0 ? (
                    <div className="mt-4">
                      <div className="text-[0.78rem] uppercase tracking-[0.12em] text-[var(--ode-accent)]">
                        {t("procedure.integrated_ai_tab_structure")}
                      </div>
                      <div className="ode-wrap-text mt-2 text-[0.88rem] leading-6 text-[var(--ode-text)]">
                        {entry.structureTitles.slice(0, 10).join(" > ")}
                      </div>
                    </div>
                  ) : null}

                  {entry.deliverables.length > 0 ? (
                    <div className="mt-4">
                      <div className="text-[0.78rem] uppercase tracking-[0.12em] text-[var(--ode-accent)]">
                        {t("procedure.integrated_ai_tab_deliverables")}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {entry.deliverables.slice(0, 8).map((deliverable) => (
                          <span
                            key={`${entry.id}-${deliverable.title}`}
                            className="rounded-full border border-[rgba(110,211,255,0.18)] bg-[rgba(7,33,51,0.72)] px-3 py-1.5 text-[0.8rem] text-[var(--ode-text)]"
                          >
                            {deliverable.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--ode-border)] px-6 py-4">
          <button
            type="button"
            className="ode-text-btn h-11 px-5"
            onClick={onClearAll}
            disabled={entries.length === 0}
          >
            {t("procedure.ai_memory_clear")}
          </button>
          <button type="button" className="ode-primary-btn h-11 px-5" onClick={onClose}>
            {t("window.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
