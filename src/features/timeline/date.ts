import { getLocaleForLanguage, type LanguageCode } from "@/lib/i18n";

export type DatePickerCell = {
  iso: string;
  day: number;
  inCurrentMonth: boolean;
};

export function getIsoWeekInfo(date: Date): { year: number; week: number } {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utcDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: utcDate.getUTCFullYear(), week };
}

export function toIsoDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [yearStr, monthStr, dayStr] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function normalizeIsoDateOnlyInput(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const head = trimmed.includes("T") ? trimmed.slice(0, 10) : trimmed;
  const match = head.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return "";
  const normalized = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  return parseIsoDateOnly(normalized) ? normalized : "";
}

export function formatMonthYearLabel(year: number, month: number, locale: string): string {
  const date = new Date(Date.UTC(year, month, 1));
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

export function getWeekdayLabels(language: LanguageCode): string[] {
  const locale = getLocaleForLanguage(language);
  const formatter = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const monday = new Date(Date.UTC(2026, 0, 5));
  return Array.from({ length: 7 }, (_, idx) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + idx);
    return formatter.format(date).replace(".", "");
  });
}

export function buildDatePickerCells(year: number, month: number): DatePickerCell[] {
  const first = new Date(Date.UTC(year, month, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const gridStart = new Date(Date.UTC(year, month, 1 - mondayOffset));
  return Array.from({ length: 42 }, (_, idx) => {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + idx);
    return {
      iso: toIsoDateOnly(date),
      day: date.getUTCDate(),
      inCurrentMonth: date.getUTCMonth() === month
    };
  });
}
