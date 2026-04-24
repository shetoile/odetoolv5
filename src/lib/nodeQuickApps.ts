import { buildAppStorageKey } from "@/lib/appIdentity";
import type { AppNode } from "@/lib/types";

export const NODE_QUICK_APPS_PROPERTY = "odeQuickApps";
export const FUNCTION_QUICK_APPS_PROPERTY = "odeFunctionQuickApps";
export const GENERAL_QUICK_APPS_STORAGE_KEY = buildAppStorageKey("quickApps.general.v1");
export const QUICK_APP_LIBRARY_STORAGE_KEY = buildAppStorageKey("quickApps.library.v1");

export type QuickAppScope = "general" | "function" | "tab";

export interface QuickAppLaunchContext {
  scope?: QuickAppScope | null;
  ownerId?: string | null;
  ownerLabel?: string | null;
}

export type NodeQuickAppKind = "url" | "local_path";
export type NodeQuickAppType = "link" | "local_app" | "html";

export const QUICK_APP_HTML_EXTENSIONS = new Set(["html", "htm"]);

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
  type?: NodeQuickAppType;
  target: string;
  iconKey: NodeQuickAppIconKey;
  customIconDataUrl?: string | null;
  openInOdeBrowser?: boolean;
}

export interface QuickAppLibraryItem {
  id: string;
  label: string;
  kind: NodeQuickAppKind;
  type?: NodeQuickAppType;
  target: string;
  iconKey: NodeQuickAppIconKey;
  customIconDataUrl?: string | null;
  openInOdeBrowser?: boolean;
  addedAt: number;
  lastUsedAt: number;
}

export interface ScopedQuickAppRecord extends NodeQuickAppItem {
  scope: QuickAppScope;
  ownerId: string | null;
  ownerLabel: string;
  launchTarget: string;
  readabilityStatus:
    | "metadata_only"
    | "previewable_url"
    | "readable_local_file"
    | "unreadable_local_target";
}

export interface ScopedQuickAppCollection {
  general: ScopedQuickAppRecord[];
  function: ScopedQuickAppRecord[];
  tab: ScopedQuickAppRecord[];
  ordered: ScopedQuickAppRecord[];
}

export interface TabAiSessionState {
  tabNodeId: string | null;
  historyStorageKey: string;
  quickApps: ScopedQuickAppCollection;
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

function createQuickAppLibraryId() {
  return `quick-app-library-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isQuickAppKind(value: unknown): value is NodeQuickAppKind {
  return value === "url" || value === "local_path";
}

function isQuickAppType(value: unknown): value is NodeQuickAppType {
  return value === "link" || value === "local_app" || value === "html";
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

function normalizeTimestamp(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function stripWrappingQuotes(value: string): string {
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
    return value.slice(1, -1).trim();
  }
  return value;
}

function getQuickAppPathExtension(path: string): string {
  const leaf = getQuickAppTargetLeafName(path);
  const lastDot = leaf.lastIndexOf(".");
  if (lastDot <= 0 || lastDot >= leaf.length - 1) return "";
  return leaf.slice(lastDot + 1).toLowerCase();
}

function getQuickAppTargetStemName(target: string): string {
  const leaf = getQuickAppTargetLeafName(target);
  const lastDot = leaf.lastIndexOf(".");
  if (lastDot <= 0) return leaf;
  return leaf.slice(0, lastDot);
}

function slugifyQuickAppInstanceToken(value: string, fallback: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return normalized || fallback;
}

function mapQuickAppScopeToInstanceToken(scope?: QuickAppScope | null): string {
  if (scope === "function") return "workspace";
  if (scope === "tab") return "chantier";
  return "general";
}

function looksLikeBareDomain(value: string): boolean {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#].*)?$/i.test(value);
}

function mapQuickAppTypeToKind(type: NodeQuickAppType): NodeQuickAppKind {
  return type === "link" ? "url" : "local_path";
}

function buildQuickAppLibraryFingerprint(item: Pick<NodeQuickAppItem, "type" | "kind" | "target">): string {
  const type = resolveQuickAppTypeCandidate(item);
  const target = normalizeQuickAppTarget(mapQuickAppTypeToKind(type), trimString(item.target));
  if (!target) return `${type}|`;

  if (type === "link") {
    try {
      const url = new URL(target);
      return `${type}|${url.protocol.toLowerCase()}//${url.host.toLowerCase()}${url.pathname}${url.search}${url.hash}`;
    } catch {
      return `${type}|${target.toLowerCase()}`;
    }
  }

  const localPath = resolveQuickAppLocalPath(target) ?? stripWrappingQuotes(target).replace(/\//g, "\\");
  return `${type}|${localPath.toLowerCase()}`;
}

function resolveQuickAppTypeCandidate(candidate: Partial<Pick<NodeQuickAppItem, "type" | "kind" | "target">>): NodeQuickAppType {
  if (isQuickAppType(candidate.type)) return candidate.type;
  const kind = isQuickAppKind(candidate.kind) ? candidate.kind : "url";
  if (kind === "url") return "link";
  const target = normalizeQuickAppTarget(kind, trimString(candidate.target));
  const localPath = resolveQuickAppLocalPath(target);
  return isQuickAppHtmlLocalPath(localPath ?? target) ? "html" : "local_app";
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

function deriveQuickAppLabel(type: NodeQuickAppType, target: string): string {
  if (!target) {
    if (type === "html") return "HTML";
    return type === "local_app" ? "App" : "Link";
  }
  if (type === "link") {
    try {
      const url = new URL(target);
      const hostname = url.hostname.replace(/^www\./i, "");
      return hostname || "Link";
    } catch {
      return "Link";
    }
  }
  const localPath = resolveQuickAppLocalPath(target);
  const stem = getQuickAppTargetStemName(localPath ?? target);
  if (stem) return stem;
  return type === "html" ? "HTML" : "App";
}

function normalizeQuickAppOpenInOdeBrowser(type: NodeQuickAppType, value: unknown): boolean {
  if (type === "html") return true;
  if (type !== "link") return false;
  return value === true;
}

export function resolveQuickAppItemType(item: Pick<NodeQuickAppItem, "type" | "kind" | "target">): NodeQuickAppType {
  return resolveQuickAppTypeCandidate(item);
}

export function shouldOpenQuickAppInsideOdeBrowser(
  item: Pick<NodeQuickAppItem, "type" | "kind" | "target" | "openInOdeBrowser">
): boolean {
  return normalizeQuickAppOpenInOdeBrowser(resolveQuickAppItemType(item), item.openInOdeBrowser);
}

export function createNodeQuickAppItem(seed?: Partial<NodeQuickAppItem>): NodeQuickAppItem {
  const type = resolveQuickAppTypeCandidate({
    type: seed?.type,
    kind: seed?.kind,
    target: typeof seed?.target === "string" ? seed.target : ""
  });
  const kind = mapQuickAppTypeToKind(type);
  const rawTarget = trimString(seed?.target);
  const target = normalizeQuickAppTarget(kind, rawTarget);
  const label = trimString(seed?.label) || deriveQuickAppLabel(type, target);
  return {
    id: trimString(seed?.id) || createQuickAppId(),
    label,
    kind,
    type,
    target,
    iconKey: isQuickAppIconKey(seed?.iconKey) ? seed.iconKey : "auto",
    customIconDataUrl: normalizeQuickAppCustomIconDataUrl(seed?.customIconDataUrl),
    openInOdeBrowser: normalizeQuickAppOpenInOdeBrowser(type, seed?.openInOdeBrowser)
  };
}

export function createQuickAppItemFromLibraryItem(item: QuickAppLibraryItem): NodeQuickAppItem {
  return createNodeQuickAppItem({
    label: item.label,
    kind: item.kind,
    type: item.type,
    target: item.target,
    iconKey: item.iconKey,
    customIconDataUrl: item.customIconDataUrl,
    openInOdeBrowser: item.openInOdeBrowser
  });
}

export function applyQuickAppItemPatch(
  item: NodeQuickAppItem,
  patch: Partial<NodeQuickAppItem>
): NodeQuickAppItem {
  const currentType = resolveQuickAppItemType(item);
  const nextType = resolveQuickAppTypeCandidate({
    type: patch.type !== undefined ? patch.type : item.type ?? currentType,
    kind: patch.kind !== undefined ? patch.kind : item.kind,
    target: patch.target !== undefined ? patch.target : item.target
  });
  const nextKind = mapQuickAppTypeToKind(nextType);
  const nextTarget =
    patch.target !== undefined && typeof patch.target === "string" ? patch.target : item.target;
  const nextLabel =
    patch.label !== undefined && typeof patch.label === "string" ? patch.label : item.label;
  const currentAutoLabel = deriveQuickAppLabel(
    currentType,
    normalizeQuickAppTarget(item.kind, item.target)
  );
  const trimmedCurrentLabel = trimString(item.label);
  const shouldRefreshLabel =
    patch.label === undefined &&
    (patch.target !== undefined || patch.kind !== undefined || patch.type !== undefined) &&
    (
      !trimmedCurrentLabel ||
      trimmedCurrentLabel === currentAutoLabel ||
      trimmedCurrentLabel.toLowerCase() === "link" ||
      trimmedCurrentLabel.toLowerCase() === "app" ||
      trimmedCurrentLabel.toLowerCase() === "html"
    );

  return {
    id: item.id,
    label: shouldRefreshLabel
      ? deriveQuickAppLabel(nextType, normalizeQuickAppTarget(nextKind, nextTarget))
      : nextLabel,
    kind: nextKind,
    type: nextType,
    target: nextTarget,
    iconKey:
      patch.iconKey !== undefined && isQuickAppIconKey(patch.iconKey) ? patch.iconKey : item.iconKey,
    customIconDataUrl:
      patch.customIconDataUrl !== undefined
        ? normalizeQuickAppCustomIconDataUrl(patch.customIconDataUrl)
        : item.customIconDataUrl,
    openInOdeBrowser:
      patch.openInOdeBrowser !== undefined || patch.type !== undefined || patch.kind !== undefined
        ? normalizeQuickAppOpenInOdeBrowser(
            nextType,
            patch.openInOdeBrowser !== undefined ? patch.openInOdeBrowser : item.openInOdeBrowser
          )
        : normalizeQuickAppOpenInOdeBrowser(nextType, item.openInOdeBrowser)
  };
}

export function normalizeNodeQuickApps(raw: unknown): NodeQuickAppItem[] {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set<string>();
  const items: NodeQuickAppItem[] = [];
  for (const candidate of raw) {
    if (!candidate || typeof candidate !== "object") continue;
    const partial = candidate as Partial<NodeQuickAppItem>;
    const type = resolveQuickAppTypeCandidate(partial);
    const kind = mapQuickAppTypeToKind(type);
    const target = normalizeQuickAppTarget(kind, trimString(partial.target));
    if (!target) continue;
    const next = createNodeQuickAppItem({
      ...partial,
      type,
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

export function getFunctionQuickApps(node: AppNode | null | undefined): NodeQuickAppItem[] {
  return normalizeNodeQuickApps(node?.properties?.[FUNCTION_QUICK_APPS_PROPERTY]);
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

export function buildFunctionQuickAppsProperties(
  properties: Record<string, unknown> | undefined,
  quickApps: NodeQuickAppItem[]
): Record<string, unknown> {
  const nextProperties: Record<string, unknown> = {
    ...(properties ?? {})
  };
  const normalized = normalizeNodeQuickApps(quickApps);
  if (normalized.length > 0) {
    nextProperties[FUNCTION_QUICK_APPS_PROPERTY] = normalized;
  } else {
    delete nextProperties[FUNCTION_QUICK_APPS_PROPERTY];
  }
  return nextProperties;
}

export function readStoredGeneralQuickApps(): NodeQuickAppItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GENERAL_QUICK_APPS_STORAGE_KEY);
    if (!raw) return [];
    return normalizeNodeQuickApps(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeStoredGeneralQuickApps(quickApps: NodeQuickAppItem[]): void {
  if (typeof window === "undefined") return;
  try {
    const normalized = normalizeNodeQuickApps(quickApps);
    if (normalized.length === 0) {
      localStorage.removeItem(GENERAL_QUICK_APPS_STORAGE_KEY);
      return;
    }
    localStorage.setItem(GENERAL_QUICK_APPS_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Persisting quick apps is best-effort only.
  }
}

function normalizeQuickAppLibrary(raw: unknown): QuickAppLibraryItem[] {
  if (!Array.isArray(raw)) return [];
  const seenFingerprints = new Set<string>();
  const items: QuickAppLibraryItem[] = [];
  for (const candidate of raw) {
    if (!candidate || typeof candidate !== "object") continue;
    const partial = candidate as Partial<QuickAppLibraryItem>;
    const item = createNodeQuickAppItem(partial);
    if (!item.target) continue;
    const fingerprint = buildQuickAppLibraryFingerprint(item);
    if (!fingerprint || seenFingerprints.has(fingerprint)) continue;
    seenFingerprints.add(fingerprint);
    const fallbackTimestamp = Date.now();
    const addedAt = normalizeTimestamp(partial.addedAt, fallbackTimestamp);
    const lastUsedAt = normalizeTimestamp(partial.lastUsedAt, addedAt);
    items.push({
      id: trimString(partial.id) || createQuickAppLibraryId(),
      label: item.label,
      kind: item.kind,
      type: item.type,
      target: item.target,
      iconKey: item.iconKey,
      customIconDataUrl: item.customIconDataUrl,
      openInOdeBrowser: item.openInOdeBrowser,
      addedAt,
      lastUsedAt
    });
  }
  items.sort((left, right) => right.lastUsedAt - left.lastUsedAt || right.addedAt - left.addedAt);
  return items;
}

export function readStoredQuickAppLibrary(): QuickAppLibraryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUICK_APP_LIBRARY_STORAGE_KEY);
    if (!raw) return [];
    return normalizeQuickAppLibrary(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeStoredQuickAppLibrary(items: QuickAppLibraryItem[]): void {
  if (typeof window === "undefined") return;
  try {
    const normalized = normalizeQuickAppLibrary(items);
    if (normalized.length === 0) {
      localStorage.removeItem(QUICK_APP_LIBRARY_STORAGE_KEY);
      return;
    }
    localStorage.setItem(QUICK_APP_LIBRARY_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Persisting the quick-app library is best-effort only.
  }
}

export function upsertQuickAppLibraryItems(
  library: QuickAppLibraryItem[],
  quickApps: readonly NodeQuickAppItem[],
  timestamp = Date.now()
): QuickAppLibraryItem[] {
  const nextByFingerprint = new Map<string, QuickAppLibraryItem>();
  for (const item of library) {
    const normalized = createNodeQuickAppItem(item);
    const fingerprint = buildQuickAppLibraryFingerprint(normalized);
    if (!fingerprint) continue;
    nextByFingerprint.set(fingerprint, {
      ...item,
      label: normalized.label,
      kind: normalized.kind,
      type: normalized.type,
      target: normalized.target,
      iconKey: normalized.iconKey,
      customIconDataUrl: normalized.customIconDataUrl,
      openInOdeBrowser: normalized.openInOdeBrowser,
      addedAt: normalizeTimestamp(item.addedAt, timestamp),
      lastUsedAt: normalizeTimestamp(item.lastUsedAt, normalizeTimestamp(item.addedAt, timestamp))
    });
  }

  for (const quickApp of quickApps) {
    const normalized = createNodeQuickAppItem(quickApp);
    if (!normalized.target) continue;
    const fingerprint = buildQuickAppLibraryFingerprint(normalized);
    if (!fingerprint) continue;
    const current = nextByFingerprint.get(fingerprint);
    nextByFingerprint.set(fingerprint, {
      id: current?.id ?? createQuickAppLibraryId(),
      label: trimString(normalized.label),
      kind: normalized.kind,
      type: normalized.type,
      target: normalized.target,
      iconKey: normalized.iconKey,
      customIconDataUrl: normalized.customIconDataUrl,
      openInOdeBrowser: normalized.openInOdeBrowser,
      addedAt: current?.addedAt ?? timestamp,
      lastUsedAt: timestamp
    });
  }

  return normalizeQuickAppLibrary(Array.from(nextByFingerprint.values()));
}

export function touchQuickAppLibraryItem(
  library: QuickAppLibraryItem[],
  libraryItemId: string,
  timestamp = Date.now()
): QuickAppLibraryItem[] {
  return normalizeQuickAppLibrary(
    library.map((item) =>
      item.id === libraryItemId
        ? {
            ...item,
            lastUsedAt: timestamp
          }
        : item
    )
  );
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

export function resolveQuickAppSuggestedIconKey(
  item: Pick<NodeQuickAppItem, "type" | "kind" | "label" | "target">
): Exclude<NodeQuickAppIconKey, "auto"> {
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
  if (resolveQuickAppItemType(item) === "html") {
    return "link";
  }
  if (item.kind === "local_path") {
    const normalized = item.target.replace(/[\\/]+$/, "");
    const leaf = normalized.split(/[\\/]/).filter(Boolean).pop() ?? "";
    if (QUICK_APP_HTML_EXTENSIONS.has(getQuickAppPathExtension(leaf))) return "link";
    if (leaf && !leaf.includes(".")) return "folder";
    return "app";
  }
  return "link";
}

export function resolveQuickAppPreferredIconKey(
  item: Pick<NodeQuickAppItem, "type" | "kind" | "label" | "target" | "iconKey">
): Exclude<NodeQuickAppIconKey, "auto"> {
  return item.iconKey !== "auto" ? item.iconKey : resolveQuickAppSuggestedIconKey(item);
}

export function resolveQuickAppLaunchTarget(item: Pick<NodeQuickAppItem, "kind" | "target">): string {
  return normalizeQuickAppTarget(item.kind, item.target);
}

export function resolveQuickAppLocalPath(target: string): string | null {
  const trimmed = stripWrappingQuotes(target.trim());
  if (!trimmed) return null;

  if (/^[a-z]:[\\/]/i.test(trimmed) || /^\\\\/.test(trimmed)) {
    return trimmed.replace(/\//g, "\\");
  }

  if (!/^file:/i.test(trimmed)) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "file:") return null;
    let nextPath = decodeURIComponent(url.pathname);
    if (/^\/[a-z]:/i.test(nextPath)) {
      nextPath = nextPath.slice(1);
    }
    return nextPath.replace(/\//g, "\\");
  } catch {
    return null;
  }
}

export function isQuickAppHtmlLocalPath(path: string | null | undefined): boolean {
  if (!path) return false;
  return QUICK_APP_HTML_EXTENSIONS.has(getQuickAppPathExtension(path));
}

export function isQuickAppHtmlItem(item: Pick<NodeQuickAppItem, "type" | "kind" | "target">): boolean {
  if (resolveQuickAppItemType(item) === "html") {
    return true;
  }
  if (item.kind !== "local_path") return false;
  return isQuickAppHtmlLocalPath(resolveQuickAppLocalPath(resolveQuickAppLaunchTarget(item)));
}

export function buildQuickAppHtmlInstanceFileName(
  item: Pick<NodeQuickAppItem, "id" | "label" | "kind" | "target">,
  context?: QuickAppLaunchContext | null
): string {
  const launchTarget = resolveQuickAppLaunchTarget(item);
  const localPath = resolveQuickAppLocalPath(launchTarget);
  const leafName = getQuickAppTargetLeafName(localPath ?? launchTarget);
  const extension = getQuickAppPathExtension(localPath ?? launchTarget) || "html";
  const stem = leafName.endsWith(`.${extension}`) ? leafName.slice(0, -(extension.length + 1)) : leafName;
  const templateToken = slugifyQuickAppInstanceToken(stem || item.label || "template", "template");
  const scopeToken = mapQuickAppScopeToInstanceToken(context?.scope);
  const ownerTokenSource = context?.ownerId ?? context?.ownerLabel ?? "";
  const ownerToken = ownerTokenSource ? slugifyQuickAppInstanceToken(ownerTokenSource, "owner") : "";
  const appToken = slugifyQuickAppInstanceToken(item.label || stem || "app", "app");
  const idToken = slugifyQuickAppInstanceToken(item.id, "quick-app").slice(-8);
  const segments = [templateToken, scopeToken, ownerToken, appToken, idToken].filter(Boolean);
  return `${segments.join("--")}.${extension}`;
}

export function getQuickAppTargetLeafName(target: string): string {
  const normalized = stripWrappingQuotes(target.trim()).replace(/[\\/]+$/, "");
  const segments = normalized.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? (normalized || "app");
}
