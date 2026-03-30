import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarGlyphSmall } from "@/components/Icons";
import {
  buildDatePickerCells,
  formatMonthYearLabel,
  getWeekdayLabels,
  parseIsoDateOnly,
  toIsoDateOnly
} from "@/features/timeline/date";
import {
  getLocaleForLanguage,
  translate,
  type LanguageCode,
  type TranslationParams
} from "@/lib/i18n";

interface ThemedDatePickerInputProps {
  value: string;
  onChange: (next: string) => void;
  language: LanguageCode;
  disabled?: boolean;
}

export function ThemedDatePickerInput({
  value,
  onChange,
  language,
  disabled = false
}: ThemedDatePickerInputProps) {
  const todayIso = useMemo(() => toIsoDateOnly(new Date()), []);
  const selectedDate = useMemo(() => parseIsoDateOnly(value), [value]);
  const todayDate = useMemo(
    () => parseIsoDateOnly(todayIso) ?? new Date(Date.UTC(2026, 0, 1)),
    [todayIso]
  );
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [viewYear, setViewYear] = useState(
    selectedDate?.getUTCFullYear() ?? todayDate.getUTCFullYear()
  );
  const [viewMonth, setViewMonth] = useState(
    selectedDate?.getUTCMonth() ?? todayDate.getUTCMonth()
  );
  const rootRef = useRef<HTMLDivElement | null>(null);
  const t = (key: string, params?: TranslationParams) => translate(language, key, params);
  const locale = getLocaleForLanguage(language);
  const weekdayLabels = useMemo(() => getWeekdayLabels(language), [language]);

  useEffect(() => {
    if (!open) return;
    const focusDate = selectedDate ?? todayDate;
    setViewYear(focusDate.getUTCFullYear());
    setViewMonth(focusDate.getUTCMonth());
  }, [open, value, todayIso, selectedDate, todayDate]);

  useEffect(() => {
    if (!open) return;
    const updatePanelDirection = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const estimatedPanelHeight = 360;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setOpenUpward(spaceBelow < estimatedPanelHeight && spaceAbove > spaceBelow);
    };
    updatePanelDirection();
    window.addEventListener("resize", updatePanelDirection);
    window.addEventListener("scroll", updatePanelDirection, true);
    return () => {
      window.removeEventListener("resize", updatePanelDirection);
      window.removeEventListener("scroll", updatePanelDirection, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (rootRef.current?.contains(target ?? null)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const cells = useMemo(() => buildDatePickerCells(viewYear, viewMonth), [viewYear, viewMonth]);
  const monthLabel = useMemo(
    () => formatMonthYearLabel(viewYear, viewMonth, locale),
    [viewYear, viewMonth, locale]
  );

  const selectIso = (iso: string) => {
    onChange(iso);
    setOpen(false);
  };

  const moveMonth = (delta: number) => {
    const raw = viewMonth + delta;
    const nextYear = viewYear + Math.floor(raw / 12);
    const nextMonth = ((raw % 12) + 12) % 12;
    setViewYear(nextYear);
    setViewMonth(nextMonth);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="ode-input relative h-12 w-full rounded-xl px-4 pr-11 text-left"
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        disabled={disabled}
      >
        <span className={value ? "text-[var(--ode-text)]" : "text-[var(--ode-text-muted)]"}>
          {value || "YYYY-MM-DD"}
        </span>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ode-text-dim)]">
          <CalendarGlyphSmall />
        </span>
      </button>

      {open ? (
        <div
          className={`absolute left-0 right-0 z-[190] rounded-xl border border-[var(--ode-border-strong)] bg-[rgba(4,24,40,0.99)] p-3 shadow-[0_16px_30px_rgba(0,0,0,0.45)] ${
            openUpward ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"
          }`}
        >
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-[1rem] font-semibold capitalize text-[var(--ode-text)]">
              {monthLabel}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="ode-icon-btn h-8 w-8 text-[1.1rem]"
                onClick={() => moveMonth(-1)}
              >
                {"<"}
              </button>
              <button
                type="button"
                className="ode-icon-btn h-8 w-8 text-[1.1rem]"
                onClick={() => moveMonth(1)}
              >
                {">"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-[0.76rem] uppercase tracking-[0.08em] text-[var(--ode-text-dim)]">
            {weekdayLabels.map((label) => (
              <span key={`weekday-${label}`}>{label}</span>
            ))}
          </div>

          <div className="mt-1.5 grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              const isSelected = cell.iso === value;
              const isToday = cell.iso === todayIso;
              return (
                <button
                  type="button"
                  key={cell.iso}
                  className={`h-8 rounded-md border text-[0.9rem] transition-colors ${
                    isSelected
                      ? "border-[var(--ode-accent)] bg-[rgba(34,136,196,0.32)] text-white"
                      : isToday
                        ? "border-[var(--ode-border-strong)] bg-[rgba(8,42,67,0.5)] text-[var(--ode-text)]"
                        : cell.inCurrentMonth
                          ? "border-transparent text-[var(--ode-text)] hover:border-[var(--ode-border)] hover:bg-[rgba(10,58,89,0.28)]"
                          : "border-transparent text-[var(--ode-text-muted)] hover:border-[var(--ode-border)] hover:bg-[rgba(8,42,67,0.24)]"
                  }`}
                  onClick={() => selectIso(cell.iso)}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          <div className="mt-2.5 flex items-center justify-between border-t border-[var(--ode-border)] pt-2">
            <button
              type="button"
              className="ode-text-btn h-9 px-3 text-[0.9rem]"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              {t("datepicker.clear")}
            </button>
            <button
              type="button"
              className="ode-text-btn h-9 px-3 text-[0.9rem]"
              onClick={() => selectIso(todayIso)}
            >
              {t("datepicker.today")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
