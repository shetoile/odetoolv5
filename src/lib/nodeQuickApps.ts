import type { AppNode } from "@/lib/types";

export const NODE_QUICK_APPS_PROPERTY = "odeQuickApps";

export type NodeQuickAppKind = "url" | "local_path";

export type NodeQuickAppIconKey =
  | "auto"
  | "office"
  | "teams"
  | "whatsapp"
  | "telegram"
  | "outlook"
  | "sharepoint"
  | "excel"
  | "word"
  | "powerpoint"
  | "drive"
  | "notion"
  | "jira"
  | "chat"
  | "mail"
  | "link"
  | "app"
  | "folder";

export interface NodeQuickAppItem {
  id: string;
  label: string;
  kind: NodeQuickAppKind;
  target: string;
  iconKey: NodeQuickAppIconKey;
  customIconDataUrl?: string | null;
}

export interface NodeQuickAppIconOption {
  key: NodeQuickAppIconKey;
  label: string;
}

export const QUICK_APP_ICON_OPTIONS: NodeQuickAppIconOption[] = [
  { key: "auto", label: "Auto" },
  { key: "office", label: "Office 365" },
  { key: "teams", label: "Teams" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "telegram", label: "Telegram" },
  { key: "outlook", label: "Outlook" },
  { key: "sharepoint", label: "SharePoint" },
  { key: "excel", label: "Excel" },
  { key: "word", label: "Word" },
  { key: "powerpoint", label: "PowerPoint" },
  { key: "drive", label: "Drive" },
  { key: "notion", label: "Notion" },
  { key: "jira", label: "Jira" },
  { key: "chat", label: "Chat" },
  { key: "mail", label: "Mail" },
  { key: "link", label: "Link" },
  { key: "app", label: "App" },
  { key: "folder", label: "Folder" }
];

function createQuickAppId() {
  return `quick-app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isQuickAppKind(value: unknown): value is NodeQuickAppKind {
  return value === "url" || value === "local_path";
}

function isQuickAppIconKey(value: unknown): value is NodeQuickAppIconKey {
  return QUICK_APP_ICON_OPTIONS.some((option) => option.key === value);
}

function trimString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeQuickAppCustomIconDataUrl(value: unknown): string | null {
  const trimmed = trimString(value);
  if (!trimmed) return null;
  if (!/^data:image\//i.test(trimmed)) return null;
  return trimmed;
}

function stripWrappingQuotes(value: string): string {
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
    return value.slice(1, -1).trim();
  }
  return value;
}

function looksLikeBareDomain(value: string): boolean {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#].*)?$/i.test(value);
}

export function normalizeQuickAppTarget(kind: NodeQuickAppKind, value: string): string {
  const trimmed = stripWrappingQuotes(value.trim());
  if (!trimmed) return "";
  if (kind === "url") {
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
    if (looksLikeBareDomain(trimmed)) return `https://${trimmed}`;
  }
  return trimmed;
}

function deriveQuickAppLabel(kind: NodeQuickAppKind, target: string): string {
  if (!target) return kind === "local_path" ? "App" : "Link";
  if (kind === "url") {
    try {
      const url = new URL(target);
      const hostname = url.hostname.replace(/^www\./i, "");
      return hostname || "Link";
    } catch {
      return "Link";
    }
  }
  const normalized = target.replace(/[\\/]+$/, "");
  const segments = normalized.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? "App";
}

export function createNodeQuickAppItem(seed?: Partial<NodeQuickAppItem>): NodeQuickAppItem {
  const kind = isQuickAppKind(seed?.kind) ? seed.kind : "url";
  const rawTarget = trimString(seed?.target);
  const target = normalizeQuickAppTarget(kind, rawTarget);
  const label = trimString(seed?.label) || deriveQuickAppLabel(kind, target);
  return {
    id: trimString(seed?.id) || createQuickAppId(),
    label,
    kind,
    target,
    iconKey: isQuickAppIconKey(seed?.iconKey) ? seed.iconKey : "auto",
    customIconDataUrl: normalizeQuickAppCustomIconDataUrl(seed?.customIconDataUrl)
  };
}

export function normalizeNodeQuickApps(raw: unknown): NodeQuickAppItem[] {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set<string>();
  const items: NodeQuickAppItem[] = [];
  for (const candidate of raw) {
    if (!candidate || typeof candidate !== "object") continue;
    const partial = candidate as Partial<NodeQuickAppItem>;
    const kind = isQuickAppKind(partial.kind) ? partial.kind : "url";
    const target = normalizeQuickAppTarget(kind, trimString(partial.target));
    if (!target) continue;
    const next = createNodeQuickAppItem({
      ...partial,
      kind,
      target,
      customIconDataUrl: normalizeQuickAppCustomIconDataUrl(partial.customIconDataUrl)
    });
    if (seenIds.has(next.id)) {
      next.id = createQuickAppId();
    }
    seenIds.add(next.id);
    items.push(next);
  }
  return items;
}

export function getNodeQuickApps(node: AppNode | null | undefined): NodeQuickAppItem[] {
  return normalizeNodeQuickApps(node?.properties?.[NODE_QUICK_APPS_PROPERTY]);
}

export function buildNodeQuickAppsProperties(
  properties: Record<string, unknown> | undefined,
  quickApps: NodeQuickAppItem[]
): Record<string, unknown> {
  const nextProperties: Record<string, unknown> = {
    ...(properties ?? {})
  };
  const normalized = normalizeNodeQuickApps(quickApps);
  if (normalized.length > 0) {
    nextProperties[NODE_QUICK_APPS_PROPERTY] = normalized;
  } else {
    delete nextProperties[NODE_QUICK_APPS_PROPERTY];
  }
  return nextProperties;
}

export function resolveQuickAppFaviconUrl(target: string): string | null {
  const normalized = normalizeQuickAppTarget("url", target);
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return `${url.origin}/favicon.ico`;
  } catch {
    return null;
  }
}

export function resolveQuickAppSuggestedIconKey(item: Pick<NodeQuickAppItem, "kind" | "label" | "target">): Exclude<NodeQuickAppIconKey, "auto"> {
  const haystack = `${item.label} ${item.target}`.toLowerCase();
  if (haystack.includes("teams")) return "teams";
  if (haystack.includes("whatsapp") || haystack.includes("wa.me")) return "whatsapp";
  if (haystack.includes("telegram") || haystack.includes("t.me") || haystack.includes("tg:")) return "telegram";
  if (haystack.includes("outlook")) return "outlook";
  if (haystack.includes("office") || haystack.includes("microsoft365") || haystack.includes("office365")) return "office";
  if (haystack.includes("sharepoint")) return "sharepoint";
  if (haystack.includes("excel")) return "excel";
  if (haystack.includes("word")) return "word";
  if (haystack.includes("powerpoint") || haystack.includes("ppt")) return "powerpoint";
  if (haystack.includes("drive") || haystack.includes("google drive")) return "drive";
  if (haystack.includes("notion")) return "notion";
  if (haystack.includes("jira") || haystack.includes("atlassian")) return "jira";
  if (haystack.includes("mail")) return "mail";
  if (haystack.includes("chat") || haystack.includes("message")) return "chat";
  if (item.kind === "local_path") {
    const normalized = item.target.replace(/[\\/]+$/, "");
    const leaf = normalized.split(/[\\/]/).filter(Boolean).pop() ?? "";
    if (leaf && !leaf.includes(".")) return "folder";
    return "app";
  }
  return "link";
}

export function resolveQuickAppPreferredIconKey(item: Pick<NodeQuickAppItem, "kind" | "label" | "target" | "iconKey">): Exclude<NodeQuickAppIconKey, "auto"> {
  return item.iconKey !== "auto" ? item.iconKey : resolveQuickAppSuggestedIconKey(item);
}

export function resolveQuickAppLaunchTarget(item: Pick<NodeQuickAppItem, "kind" | "target">): string {
  return normalizeQuickAppTarget(item.kind, item.target);
}

export function getQuickAppTargetLeafName(target: string): string {
  const normalized = stripWrappingQuotes(target.trim()).replace(/[\\/]+$/, "");
  const segments = normalized.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? (normalized || "app");
}
