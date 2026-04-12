import type { AppNode } from "@/lib/types";

export type ChantierFeedEntryKind = "update" | "decision" | "blocker" | "question";

export interface ChantierFeedEntry {
  id: string;
  kind: ChantierFeedEntryKind;
  author: string;
  message: string;
  createdAt: number;
  updatedAt?: number | null;
}

export interface ChantierJournalEntry {
  id: string;
  title: string;
  body: string;
  author: string;
  createdAt: number;
  updatedAt?: number | null;
}

export interface ChantierWorkspaceSettings {
  meetingUrl: string | null;
  mailTo: string | null;
  mailCc: string | null;
  mailSubject: string | null;
}

const CHANTIER_MEETING_URL_PROPERTY = "odeChantierMeetingUrl";
const CHANTIER_MAIL_TO_PROPERTY = "odeChantierMailTo";
const CHANTIER_MAIL_CC_PROPERTY = "odeChantierMailCc";
const CHANTIER_MAIL_SUBJECT_PROPERTY = "odeChantierMailSubject";
const CHANTIER_FEED_PROPERTY = "odeChantierTeamFeed";
const CHANTIER_JOURNAL_PROPERTY = "odeChantierJournal";

function readOptionalText(properties: Record<string, unknown> | undefined, key: string): string | null {
  const value = properties?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\r\n/g, "\n").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTimestamp(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Date.now();
}

function normalizeFeedKind(value: unknown): ChantierFeedEntryKind {
  if (value === "decision" || value === "blocker" || value === "question") return value;
  return "update";
}

export function createChantierWorkspaceEntryId(prefix: "feed" | "journal"): string {
  return `ode-chantier-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function readChantierWorkspaceSettings(node: AppNode | null | undefined): ChantierWorkspaceSettings {
  return {
    meetingUrl: readOptionalText(node?.properties, CHANTIER_MEETING_URL_PROPERTY),
    mailTo: readOptionalText(node?.properties, CHANTIER_MAIL_TO_PROPERTY),
    mailCc: readOptionalText(node?.properties, CHANTIER_MAIL_CC_PROPERTY),
    mailSubject: readOptionalText(node?.properties, CHANTIER_MAIL_SUBJECT_PROPERTY)
  };
}

export function normalizeChantierWorkspaceSettings(
  settings: Partial<ChantierWorkspaceSettings> | ChantierWorkspaceSettings | null | undefined
): ChantierWorkspaceSettings {
  return {
    meetingUrl: normalizeText(settings?.meetingUrl),
    mailTo: normalizeText(settings?.mailTo),
    mailCc: normalizeText(settings?.mailCc),
    mailSubject: normalizeText(settings?.mailSubject)
  };
}

export function readChantierFeedEntries(node: AppNode | null | undefined): ChantierFeedEntry[] {
  const raw = node?.properties?.[CHANTIER_FEED_PROPERTY];
  if (!Array.isArray(raw)) return [];
  const entries: ChantierFeedEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const id = normalizeText(record.id);
    const author = normalizeText(record.author);
    const message = normalizeText(record.message);
    if (!id || !author || !message) continue;
    entries.push({
      id,
      kind: normalizeFeedKind(record.kind),
      author,
      message,
      createdAt: normalizeTimestamp(record.createdAt),
      updatedAt:
        typeof record.updatedAt === "number" && Number.isFinite(record.updatedAt) ? record.updatedAt : null
    });
  }
  return entries.sort((left, right) => right.createdAt - left.createdAt);
}

export function readChantierJournalEntries(node: AppNode | null | undefined): ChantierJournalEntry[] {
  const raw = node?.properties?.[CHANTIER_JOURNAL_PROPERTY];
  if (!Array.isArray(raw)) return [];
  const entries: ChantierJournalEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const id = normalizeText(record.id);
    const title = normalizeText(record.title);
    const body = normalizeText(record.body);
    const author = normalizeText(record.author);
    if (!id || !title || !body || !author) continue;
    entries.push({
      id,
      title,
      body,
      author,
      createdAt: normalizeTimestamp(record.createdAt),
      updatedAt:
        typeof record.updatedAt === "number" && Number.isFinite(record.updatedAt) ? record.updatedAt : null
    });
  }
  return entries.sort((left, right) => right.createdAt - left.createdAt);
}

export function buildChantierWorkspaceProperties(params: {
  properties: Record<string, unknown> | undefined;
  settings?: Partial<ChantierWorkspaceSettings> | ChantierWorkspaceSettings | null;
  feedEntries?: ChantierFeedEntry[];
  journalEntries?: ChantierJournalEntry[];
}): Record<string, unknown> {
  const nextProperties: Record<string, unknown> = { ...(params.properties ?? {}) };

  if (params.settings !== undefined) {
    const settings = normalizeChantierWorkspaceSettings(params.settings);
    if (settings.meetingUrl) {
      nextProperties[CHANTIER_MEETING_URL_PROPERTY] = settings.meetingUrl;
    } else {
      delete nextProperties[CHANTIER_MEETING_URL_PROPERTY];
    }
    if (settings.mailTo) {
      nextProperties[CHANTIER_MAIL_TO_PROPERTY] = settings.mailTo;
    } else {
      delete nextProperties[CHANTIER_MAIL_TO_PROPERTY];
    }
    if (settings.mailCc) {
      nextProperties[CHANTIER_MAIL_CC_PROPERTY] = settings.mailCc;
    } else {
      delete nextProperties[CHANTIER_MAIL_CC_PROPERTY];
    }
    if (settings.mailSubject) {
      nextProperties[CHANTIER_MAIL_SUBJECT_PROPERTY] = settings.mailSubject;
    } else {
      delete nextProperties[CHANTIER_MAIL_SUBJECT_PROPERTY];
    }
  }

  if (params.feedEntries !== undefined) {
    if (params.feedEntries.length > 0) {
      nextProperties[CHANTIER_FEED_PROPERTY] = params.feedEntries.map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        author: entry.author,
        message: entry.message,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt ?? undefined
      }));
    } else {
      delete nextProperties[CHANTIER_FEED_PROPERTY];
    }
  }

  if (params.journalEntries !== undefined) {
    if (params.journalEntries.length > 0) {
      nextProperties[CHANTIER_JOURNAL_PROPERTY] = params.journalEntries.map((entry) => ({
        id: entry.id,
        title: entry.title,
        body: entry.body,
        author: entry.author,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt ?? undefined
      }));
    } else {
      delete nextProperties[CHANTIER_JOURNAL_PROPERTY];
    }
  }

  return nextProperties;
}
