import { useEffect, useMemo, useState } from "react";
import {
  CalendarGlyphSmall,
  ClockGlyphSmall,
  FileGlyphSmall,
  FlagGlyphSmall
} from "@/components/Icons";
import { ThemedDatePickerInput } from "@/components/inputs/ThemedDatePickerInput";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import { useDraggableModalSurface } from "@/hooks/useDraggableModalSurface";
import { isTimelineScheduleFlagged } from "@/features/timeline/display";
import { parseIsoDateOnly, toIsoDateOnly } from "@/features/timeline/date";
import { type NodeTimelineSchedule } from "@/features/timeline/model";
import { resolveScheduleProgressFromStatus } from "@/features/timeline/presentation";
import { translate, type LanguageCode, type TranslationParams } from "@/lib/i18n";
import { type AppNode, type ScheduleStatus } from "@/lib/types";

interface TaskScheduleModalProps {
  open: boolean;
  language: LanguageCode;
  node: AppNode | null;
  initialSchedule: NodeTimelineSchedule | null;
  onClose: () => void;
  onSave: (schedule: NodeTimelineSchedule) => Promise<void> | void;
  onClear: () => Promise<void> | void;
}

export function TaskScheduleModal({
  open,
  language,
  node,
  initialSchedule,
  onClose,
  onSave,
  onClear
}: TaskScheduleModalProps) {
  const t = (key: string, params?: TranslationParams) => translate(language, key, params);
  const { surfaceRef, surfaceStyle, handlePointerDown } = useDraggableModalSurface({ open });
  const todayIso = useMemo(() => toIsoDateOnly(new Date()), []);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<ScheduleStatus>("planned");
  const [startDate, setStartDate] = useState(todayIso);
  const [endDate, setEndDate] = useState(todayIso);
  const [assigneesInput, setAssigneesInput] = useState("");
  const [flagged, setFlagged] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open || !node) return;
    setTitle(initialSchedule?.title ?? node.name);
    setStatus(initialSchedule?.status ?? "planned");
    setStartDate(initialSchedule?.startDate ?? todayIso);
    setEndDate(initialSchedule?.endDate ?? initialSchedule?.startDate ?? todayIso);
    setAssigneesInput(initialSchedule?.assignees.join(", ") ?? "");
    setFlagged(isTimelineScheduleFlagged(initialSchedule));
    setProgress(resolveScheduleProgressFromStatus(initialSchedule?.status ?? "planned", initialSchedule?.progress ?? 0));
    setIsSaving(false);
  }, [open, node, initialSchedule, todayIso]);

  useEffect(() => {
    if (!open) return;
    setProgress((current) => {
      const next = resolveScheduleProgressFromStatus(status, current);
      return current === next ? current : next;
    });
  }, [open, status]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !node) return null;

  const start = parseIsoDateOnly(startDate);
  const end = parseIsoDateOnly(endDate);
  const normalizedStart = start && end && start.getTime() > end.getTime() ? end : start;
  const normalizedEnd = start && end && start.getTime() > end.getTime() ? start : end;
  const durationDays =
    normalizedStart && normalizedEnd
      ? Math.max(1, Math.floor((normalizedEnd.getTime() - normalizedStart.getTime()) / 86400000) + 1)
      : 0;
  const hasExistingSchedule = Boolean(initialSchedule);
  const normalizedProgress = resolveScheduleProgressFromStatus(status, progress);
  const normalizedAssignees = Array.from(
    new Set(
      assigneesInput
        .split(/[;,]/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    )
  );

  const save = async () => {
    if (!normalizedStart || !normalizedEnd) return;
    setIsSaving(true);
    try {
      await onSave({
        title: title.trim() || node.name,
        status,
        startDate: toIsoDateOnly(normalizedStart),
        endDate: toIsoDateOnly(normalizedEnd),
        assignees: normalizedAssignees,
        priority: flagged ? "high" : "normal",
        progress: normalizedProgress,
        predecessor: ""
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const clear = async () => {
    setIsSaving(true);
    try {
      await onClear();
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="ode-overlay-scrim fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto p-4 backdrop-blur-sm">
      <div
        ref={surfaceRef}
        style={surfaceStyle}
        className="ode-modal w-full max-w-[920px] overflow-visible rounded-[20px] border border-[var(--ode-border-strong)]"
      >
        <div
          className="ode-modal-drag-handle flex items-center justify-between border-b border-[var(--ode-border)] px-6 py-4"
          onPointerDown={handlePointerDown}
        >
          <h2 className="flex items-center gap-2.5 text-[1.7rem] font-semibold tracking-tight text-[var(--ode-text)]">
            <span className="text-[var(--ode-accent)]">
              <CalendarGlyphSmall />
            </span>
            <span>{t("timeline.modal_title")}</span>
          </h2>
          <div className="flex items-center gap-4">
            <OdeTooltip label={t("timeline.flagged")} side="bottom">
              <label className="flex cursor-pointer items-center gap-2 text-[var(--ode-text-dim)]" aria-label={t("timeline.flagged")}>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--ode-accent)]"
                  checked={flagged}
                  onChange={(event) => setFlagged(event.target.checked)}
                />
                <span className={flagged ? "text-[var(--ode-accent)]" : "text-[var(--ode-text-dim)]"} aria-hidden="true">
                  <FlagGlyphSmall active={flagged} />
                </span>
              </label>
            </OdeTooltip>
            <button
              className="ode-icon-btn h-9 w-9 text-[1.3rem]"
              aria-label={t("timeline.modal_cancel")}
              onClick={onClose}
              disabled={isSaving}
            >
              {"\u00d7"}
            </button>
          </div>
        </div>
        <div className="space-y-5 px-6 py-5">
          <div>
            <p className="mb-2 text-[1rem] text-[var(--ode-text-dim)]">{t("timeline.modal_task_title")}</p>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ode-text-dim)]">
                <FileGlyphSmall />
              </span>
              <input
                className="ode-input h-12 w-full rounded-xl pl-11 pr-4"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-[1rem] text-[var(--ode-text-dim)]">{t("timeline.modal_status")}</p>
              <div className="relative">
                <select
                  className="ode-input h-12 w-full appearance-none rounded-xl px-4 pr-10"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as ScheduleStatus)}
                >
                  <option value="planned">{t("timeline.status.planned")}</option>
                  <option value="active">{t("timeline.status.active")}</option>
                  <option value="blocked">{t("timeline.status.blocked")}</option>
                  <option value="done">{t("timeline.status.done")}</option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ode-text-dim)]">
                  v
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
              <div>
                <p className="mb-2 text-[1rem] text-[var(--ode-text-dim)]">{t("timeline.modal_start_date")}</p>
                <ThemedDatePickerInput value={startDate} onChange={setStartDate} language={language} disabled={isSaving} />
              </div>
              <div>
                <p className="mb-2 text-[1rem] text-[var(--ode-text-dim)]">{t("timeline.modal_end_date")}</p>
                <ThemedDatePickerInput value={endDate} onChange={setEndDate} language={language} disabled={isSaving} />
              </div>
            </div>
            <div>
              <p className="mb-2 text-[1rem] text-[var(--ode-text-dim)]">{t("timeline.modal_assignees")}</p>
              <input
                className="ode-input h-12 w-full rounded-xl px-4"
                value={assigneesInput}
                onChange={(event) => setAssigneesInput(event.target.value)}
                placeholder={t("timeline.modal_assignees_placeholder")}
              />
            </div>
          </div>
          <div className="flex items-center justify-end text-sm text-[var(--ode-text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <ClockGlyphSmall />
              {durationDays === 1
                ? t("timeline.modal_duration", { count: durationDays })
                : t("timeline.modal_duration_plural", { count: durationDays })}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-[var(--ode-border)] px-6 py-4">
          {hasExistingSchedule ? (
            <button className="ode-text-btn h-11 px-4 text-[var(--ode-text-muted)]" onClick={clear} disabled={isSaving}>
              {t("timeline.modal_clear")}
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3">
            <button className="ode-text-btn h-11 px-5" onClick={onClose} disabled={isSaving}>
              {t("timeline.modal_cancel")}
            </button>
            <button
              className="ode-primary-btn h-11 px-7"
              onClick={() => void save()}
              disabled={isSaving || !normalizedStart || !normalizedEnd}
            >
              {t("timeline.modal_save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
