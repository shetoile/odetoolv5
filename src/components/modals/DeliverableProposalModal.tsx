import { useEffect, useRef, useState } from "react";
import { useDraggableModalSurface } from "@/hooks/useDraggableModalSurface";
import type { TranslationParams } from "@/lib/i18n";
import type { ODEDeliverableProposal, ODEDeliverableProposalItem } from "@/lib/types";

type TranslateFn = (key: string, params?: TranslationParams) => string;

interface DeliverableProposalModalProps {
  open: boolean;
  t: TranslateFn;
  proposal: ODEDeliverableProposal | null;
  nodeTitle: string | null;
  onClose: () => void;
  onConfirm: () => void;
  onChangeProposal: (proposal: ODEDeliverableProposal) => void;
}

type DeliverableProposalClipboard =
  | {
      mode: "copy" | "cut";
      sourceId: string;
      payload: ODEDeliverableProposalItem;
    }
  | null;

function createProposalId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `deliverable-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneDeliverableItem(item: ODEDeliverableProposalItem): ODEDeliverableProposalItem {
  return {
    ...item,
    id: createProposalId()
  };
}

export function DeliverableProposalModal({
  open,
  t,
  proposal,
  nodeTitle,
  onClose,
  onConfirm,
  onChangeProposal
}: DeliverableProposalModalProps) {
  const { surfaceRef, surfaceStyle, handlePointerDown } = useDraggableModalSurface({ open });
  const [selectedDeliverableId, setSelectedDeliverableId] = useState<string | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const clipboardRef = useRef<DeliverableProposalClipboard>(null);

  useEffect(() => {
    if (!open || !proposal) {
      setSelectedDeliverableId(null);
      clipboardRef.current = null;
      return;
    }
    setSelectedDeliverableId((current) =>
      current && proposal.deliverables.some((deliverable) => deliverable.id === current)
        ? current
        : (proposal.deliverables[0]?.id ?? null)
    );
  }, [open, proposal]);

  useEffect(() => {
    if (!open || !selectedDeliverableId) return;
    const row = itemRefs.current.get(selectedDeliverableId);
    if (!row) return;
    const rafId = window.requestAnimationFrame(() => {
      row.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [open, selectedDeliverableId]);

  useEffect(() => {
    if (!open || !proposal) return;
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable || target.closest("[contenteditable='true']")) return true;
      return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    };

    const focusSelectedInput = () => {
      if (!selectedDeliverableId) return;
      window.requestAnimationFrame(() => {
        const input = inputRefs.current.get(selectedDeliverableId);
        if (!input) return;
        input.focus();
        input.select();
      });
    };

    const insertItem = (index: number, seed?: ODEDeliverableProposalItem) => {
      const nextItem =
        seed ??
        ({
          id: createProposalId(),
          title: "",
          rationale: null
        } satisfies ODEDeliverableProposalItem);
      const nextDeliverables = [...proposal.deliverables];
      const safeIndex = Math.max(0, Math.min(index, nextDeliverables.length));
      nextDeliverables.splice(safeIndex, 0, nextItem);
      onChangeProposal({ ...proposal, deliverables: nextDeliverables });
      setSelectedDeliverableId(nextItem.id);
      window.requestAnimationFrame(focusSelectedInput);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (isEditableTarget(event.target)) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      const deliverables = proposal.deliverables;
      if (deliverables.length === 0) {
        if (event.key === "Enter" || event.key === "Insert") {
          event.preventDefault();
          insertItem(0);
        }
        return;
      }

      const selectedIndex = selectedDeliverableId
        ? deliverables.findIndex((deliverable) => deliverable.id === selectedDeliverableId)
        : -1;
      const hasModifier = event.ctrlKey || event.metaKey;
      const keyLower = event.key.toLowerCase();

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedDeliverableId(deliverables[Math.max(0, selectedIndex > 0 ? selectedIndex - 1 : 0)]?.id ?? null);
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const startIndex = selectedIndex >= 0 ? selectedIndex : 0;
        setSelectedDeliverableId(deliverables[Math.min(deliverables.length - 1, startIndex + 1)]?.id ?? null);
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        setSelectedDeliverableId(deliverables[0]?.id ?? null);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        setSelectedDeliverableId(deliverables[deliverables.length - 1]?.id ?? null);
        return;
      }

      if (!selectedDeliverableId || selectedIndex < 0) return;

      if (hasModifier && keyLower === "c") {
        event.preventDefault();
        clipboardRef.current = {
          mode: "copy",
          sourceId: selectedDeliverableId,
          payload: cloneDeliverableItem(deliverables[selectedIndex])
        };
        return;
      }

      if (hasModifier && keyLower === "x") {
        event.preventDefault();
        clipboardRef.current = {
          mode: "cut",
          sourceId: selectedDeliverableId,
          payload: cloneDeliverableItem(deliverables[selectedIndex])
        };
        return;
      }

      if (hasModifier && keyLower === "v") {
        event.preventDefault();
        const clipboard = clipboardRef.current;
        if (!clipboard) return;
        if (clipboard.mode === "cut") {
          const sourceIndex = deliverables.findIndex((deliverable) => deliverable.id === clipboard.sourceId);
          if (sourceIndex < 0) {
            clipboardRef.current = null;
            return;
          }
          const movingItem = deliverables[sourceIndex];
          const remaining = deliverables.filter((deliverable) => deliverable.id !== clipboard.sourceId);
          const adjustedInsertIndex = sourceIndex < selectedIndex + 1 ? selectedIndex : selectedIndex + 1;
          const nextDeliverables = [...remaining];
          nextDeliverables.splice(Math.max(0, Math.min(adjustedInsertIndex, nextDeliverables.length)), 0, movingItem);
          onChangeProposal({ ...proposal, deliverables: nextDeliverables });
          setSelectedDeliverableId(movingItem.id);
          clipboardRef.current = null;
          return;
        }
        insertItem(selectedIndex + 1, cloneDeliverableItem(clipboard.payload));
        return;
      }

      if (hasModifier && keyLower === "d") {
        event.preventDefault();
        insertItem(selectedIndex + 1, cloneDeliverableItem(deliverables[selectedIndex]));
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        const nextDeliverables = deliverables.filter((deliverable) => deliverable.id !== selectedDeliverableId);
        onChangeProposal({ ...proposal, deliverables: nextDeliverables });
        const fallback = nextDeliverables[selectedIndex] ?? nextDeliverables[Math.max(0, selectedIndex - 1)] ?? null;
        setSelectedDeliverableId(fallback?.id ?? null);
        return;
      }

      if (event.key === "F2") {
        event.preventDefault();
        focusSelectedInput();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const insertIndex = event.shiftKey ? selectedIndex : selectedIndex + 1;
        insertItem(insertIndex);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onChangeProposal, onClose, open, proposal, selectedDeliverableId]);

  if (!open || !proposal) return null;

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
        className="ode-modal flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] border border-[var(--ode-border-strong)]"
      >
        <div
          className="ode-modal-drag-handle flex items-start justify-between gap-4 border-b border-[var(--ode-border)] px-6 py-5"
          onPointerDown={handlePointerDown}
        >
          <div className="min-w-0">
            <h2 className="text-[1.2rem] font-semibold tracking-tight text-[var(--ode-accent)]">
              {t("procedure.deliverable_ai_preview_title")}
            </h2>
            <p className="mt-1 text-[0.92rem] text-[var(--ode-text-muted)]">{nodeTitle || "-"}</p>
            <p className="mt-3 text-[0.96rem] leading-6 text-[var(--ode-text)]">{proposal.summary}</p>
          </div>
          <button type="button" className="ode-icon-btn h-10 w-10" onClick={onClose} aria-label={t("settings.cancel")}>
            x
          </button>
        </div>

        <div className="grid gap-4 overflow-y-auto px-6 py-5 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4">
            <div className="ode-surface-muted rounded-[20px] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[0.8rem] uppercase tracking-[0.12em] text-[var(--ode-accent)]">
                  {t("procedure.deliverable_ai_deliverables")}
                </p>
                <p className="text-[0.9rem] text-[var(--ode-text-muted)]">
                  {t("procedure.deliverable_ai_confidence")}: {Math.round(proposal.confidence * 100)}%
                </p>
              </div>
              <div className="mt-4 space-y-3">
                {proposal.deliverables.map((deliverable) => {
                  const isSelected = deliverable.id === selectedDeliverableId;
                  return (
                    <div
                      key={deliverable.id}
                      ref={(element) => {
                        if (element) {
                          itemRefs.current.set(deliverable.id, element);
                        } else {
                          itemRefs.current.delete(deliverable.id);
                        }
                      }}
                      className={`rounded-[16px] border px-4 py-3 transition ${
                        isSelected
                          ? "border-[var(--ode-accent)] bg-[rgba(38,157,214,0.14)]"
                          : "border-[rgba(110,211,255,0.14)] bg-[rgba(4,24,39,0.6)]"
                      }`}
                      onMouseDown={() => {
                        setSelectedDeliverableId(deliverable.id);
                      }}
                    >
                      <input
                        ref={(element) => {
                          if (element) {
                            inputRefs.current.set(deliverable.id, element);
                          } else {
                            inputRefs.current.delete(deliverable.id);
                          }
                        }}
                        className="ode-input h-11 w-full rounded-[14px] px-3 text-[0.95rem]"
                        value={deliverable.title}
                        onFocus={() => {
                          setSelectedDeliverableId(deliverable.id);
                        }}
                        onChange={(event) => {
                          onChangeProposal({
                            ...proposal,
                            deliverables: proposal.deliverables.map((item) =>
                              item.id === deliverable.id ? { ...item, title: event.target.value } : item
                            )
                          });
                        }}
                        placeholder={t("procedure.node_deliverable_placeholder")}
                      />
                      {deliverable.rationale ? (
                        <p className="mt-2 text-[0.88rem] leading-6 text-[var(--ode-text-dim)]">{deliverable.rationale}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="ode-surface-muted rounded-[20px] px-4 py-4">
              <p className="text-[0.8rem] uppercase tracking-[0.12em] text-[var(--ode-accent)]">
                {t("procedure.deliverable_ai_sources")}
              </p>
              <div className="mt-4 space-y-3 text-[0.9rem] leading-6 text-[var(--ode-text)]">
                {proposal.sources.map((source) => (
                  <div key={source.sourceId} className="rounded-[14px] border border-[rgba(110,211,255,0.12)] px-3 py-3">
                    <div className="text-[0.8rem] uppercase tracking-[0.12em] text-[var(--ode-text-muted)]">
                      {source.kind}
                    </div>
                    <div className="ode-wrap-text mt-1 text-[0.94rem] text-[var(--ode-text)]">{source.label}</div>
                    {source.excerpt ? (
                      <div className="mt-2 text-[0.84rem] leading-6 text-[var(--ode-text-dim)]">{source.excerpt}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--ode-border)] px-6 py-4">
          <button type="button" className="ode-text-btn h-11 px-5" onClick={onClose}>
            {t("procedure.ai_reject")}
          </button>
          <button type="button" className="ode-primary-btn h-11 px-5" onClick={onConfirm}>
            {t("procedure.ai_accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
