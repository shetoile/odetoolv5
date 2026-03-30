import { useEffect, useRef, useState } from "react";
import { useDraggableModalSurface } from "@/hooks/useDraggableModalSurface";
import type { TranslationParams } from "@/lib/i18n";
import type { ODEWorkstreamTaskItem, ODEWorkstreamWorkspaceProposal } from "@/lib/types";

type TranslateFn = (key: string, params?: TranslationParams) => string;

interface WorkstreamWorkspacePreviewModalProps {
  open: boolean;
  t: TranslateFn;
  proposal: ODEWorkstreamWorkspaceProposal | null;
  nodeTitle: string | null;
  deliverableTitle: string | null;
  onClose: () => void;
  onConfirm: () => void;
  onChangeProposal: (proposal: ODEWorkstreamWorkspaceProposal) => void;
}

type TaskClipboard =
  | {
      mode: "copy" | "cut";
      sourceId: string;
      payload: ODEWorkstreamTaskItem;
    }
  | null;

function createTaskId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneTaskItem(task: ODEWorkstreamTaskItem): ODEWorkstreamTaskItem {
  return {
    ...task,
    id: createTaskId()
  };
}

export function WorkstreamWorkspacePreviewModal({
  open,
  t,
  proposal,
  nodeTitle,
  deliverableTitle,
  onClose,
  onConfirm,
  onChangeProposal
}: WorkstreamWorkspacePreviewModalProps) {
  const { surfaceRef, surfaceStyle, handlePointerDown } = useDraggableModalSurface({ open });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const clipboardRef = useRef<TaskClipboard>(null);

  const taskSection = proposal?.sections.find((section) => section.type === "tasks");
  const tasks = taskSection?.items ?? [];

  useEffect(() => {
    if (!open) {
      setSelectedTaskId(null);
      clipboardRef.current = null;
      return;
    }
    setSelectedTaskId((current) => (current && tasks.some((task) => task.id === current) ? current : (tasks[0]?.id ?? null)));
  }, [open, tasks]);

  useEffect(() => {
    if (!open || !selectedTaskId) return;
    const row = rowRefs.current.get(selectedTaskId);
    if (!row) return;
    const rafId = window.requestAnimationFrame(() => {
      row.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [open, selectedTaskId]);

  useEffect(() => {
    if (!open || !proposal || !taskSection) return;

    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable || target.closest("[contenteditable='true']")) return true;
      return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    };

    const updateTasks = (nextItems: ODEWorkstreamTaskItem[]) => {
      onChangeProposal({
        ...proposal,
        sections: proposal.sections.map((section) =>
          section.type === "tasks"
            ? {
                ...section,
                items: nextItems
              }
            : section
        )
      });
    };

    const focusSelectedInput = () => {
      if (!selectedTaskId) return;
      window.requestAnimationFrame(() => {
        const input = inputRefs.current.get(selectedTaskId);
        if (!input) return;
        input.focus();
        input.select();
      });
    };

    const insertTask = (index: number, seed?: ODEWorkstreamTaskItem) => {
      const nextTask =
        seed ??
        ({
          id: createTaskId(),
          title: "",
          status: "planned",
          flagged: false,
          ownerName: null,
          dueDate: null,
          note: null
        } satisfies ODEWorkstreamTaskItem);
      const nextItems = [...tasks];
      const safeIndex = Math.max(0, Math.min(index, nextItems.length));
      nextItems.splice(safeIndex, 0, nextTask);
      updateTasks(nextItems);
      setSelectedTaskId(nextTask.id);
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

      if (tasks.length === 0) {
        if (event.key === "Enter" || event.key === "Insert") {
          event.preventDefault();
          insertTask(0);
        }
        return;
      }

      const selectedIndex = selectedTaskId ? tasks.findIndex((task) => task.id === selectedTaskId) : -1;
      const hasModifier = event.ctrlKey || event.metaKey;
      const keyLower = event.key.toLowerCase();

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedTaskId(tasks[Math.max(0, selectedIndex > 0 ? selectedIndex - 1 : 0)]?.id ?? null);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        const startIndex = selectedIndex >= 0 ? selectedIndex : 0;
        setSelectedTaskId(tasks[Math.min(tasks.length - 1, startIndex + 1)]?.id ?? null);
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        setSelectedTaskId(tasks[0]?.id ?? null);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        setSelectedTaskId(tasks[tasks.length - 1]?.id ?? null);
        return;
      }

      if (!selectedTaskId || selectedIndex < 0) return;

      if (hasModifier && keyLower === "c") {
        event.preventDefault();
        clipboardRef.current = { mode: "copy", sourceId: selectedTaskId, payload: cloneTaskItem(tasks[selectedIndex]) };
        return;
      }
      if (hasModifier && keyLower === "x") {
        event.preventDefault();
        clipboardRef.current = { mode: "cut", sourceId: selectedTaskId, payload: cloneTaskItem(tasks[selectedIndex]) };
        return;
      }
      if (hasModifier && keyLower === "v") {
        event.preventDefault();
        const clipboard = clipboardRef.current;
        if (!clipboard) return;
        if (clipboard.mode === "cut") {
          const sourceIndex = tasks.findIndex((task) => task.id === clipboard.sourceId);
          if (sourceIndex < 0) {
            clipboardRef.current = null;
            return;
          }
          const movingTask = tasks[sourceIndex];
          const remaining = tasks.filter((task) => task.id !== clipboard.sourceId);
          const adjustedInsertIndex = sourceIndex < selectedIndex + 1 ? selectedIndex : selectedIndex + 1;
          const nextItems = [...remaining];
          nextItems.splice(Math.max(0, Math.min(adjustedInsertIndex, nextItems.length)), 0, movingTask);
          updateTasks(nextItems);
          setSelectedTaskId(movingTask.id);
          clipboardRef.current = null;
          return;
        }
        insertTask(selectedIndex + 1, cloneTaskItem(clipboard.payload));
        return;
      }
      if (hasModifier && keyLower === "d") {
        event.preventDefault();
        insertTask(selectedIndex + 1, cloneTaskItem(tasks[selectedIndex]));
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        const nextItems = tasks.filter((task) => task.id !== selectedTaskId);
        updateTasks(nextItems);
        const fallback = nextItems[selectedIndex] ?? nextItems[Math.max(0, selectedIndex - 1)] ?? null;
        setSelectedTaskId(fallback?.id ?? null);
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
        insertTask(insertIndex);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onChangeProposal, onClose, open, proposal, selectedTaskId, taskSection, tasks]);

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
              {t("procedure.workstream_ai_preview_title")}
            </h2>
            <p className="mt-1 text-[0.92rem] text-[var(--ode-text-muted)]">
              {nodeTitle || "-"}
              {deliverableTitle ? ` / ${deliverableTitle}` : ""}
            </p>
          </div>
          <button type="button" className="ode-icon-btn h-10 w-10" onClick={onClose} aria-label={t("settings.cancel")}>
            x
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <div className="ode-surface-muted rounded-[20px] px-4 py-4">
            <p className="text-[0.8rem] uppercase tracking-[0.12em] text-[var(--ode-accent)]">
              {t("procedure.workstream_ai_tasks")}
            </p>
              <div className="mt-4 space-y-3">
                {tasks.map((task) => {
                  const isSelected = task.id === selectedTaskId;
                  return (
                    <div
                      key={task.id}
                      ref={(element) => {
                        if (element) {
                          rowRefs.current.set(task.id, element);
                        } else {
                          rowRefs.current.delete(task.id);
                        }
                      }}
                      className={`rounded-[16px] border px-4 py-3 transition ${
                        isSelected
                          ? "border-[var(--ode-accent)] bg-[rgba(38,157,214,0.14)]"
                          : "border-[rgba(110,211,255,0.14)] bg-[rgba(4,24,39,0.6)]"
                      }`}
                      onMouseDown={() => {
                        setSelectedTaskId(task.id);
                      }}
                    >
                      <input
                        ref={(element) => {
                          if (element) {
                            inputRefs.current.set(task.id, element);
                          } else {
                            inputRefs.current.delete(task.id);
                          }
                        }}
                        className="ode-input h-11 min-w-0 w-full rounded-[14px] px-3 text-[0.95rem]"
                        value={task.title}
                        onFocus={() => {
                          setSelectedTaskId(task.id);
                        }}
                        onChange={(event) => {
                          onChangeProposal({
                            ...proposal,
                            sections: proposal.sections.map((section) =>
                              section.type === "tasks"
                                ? {
                                    ...section,
                                    items: section.items.map((item) =>
                                      item.id === task.id ? { ...item, title: event.target.value } : item
                                    )
                                  }
                                : section
                            )
                          });
                        }}
                        placeholder={t("procedure.node_task_placeholder")}
                      />
                    </div>
                  );
                })}
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
