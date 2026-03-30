
import {
  AppNode,
  DesktopStateFilter,
  FolderNodeState,
  ScheduleStatus,
  DailyBriefingBucket,
  DailyBriefingActivity,
  AssistantAnalysisToken,
  isFileLikeNode
} from "./types";
import { convertFileSrc, isTauri } from "@tauri-apps/api/core";
import { getWindowsFileIcon } from "./nodeService";
import { callNative } from "./tauriApi";
import { LanguageCode, TranslationParams, translate, getLocaleForLanguage } from "./i18n";

export type DesktopMediaPreviewKind = "image" | "video" | "pdf";

export const WINDOWS_FILE_ICON_SIZE = 48;
export const WINDOWS_FILE_ICON_CACHE = new Map<string, string>();
const WINDOWS_FILE_ICON_PENDING = new Map<string, Promise<string | null>>();
const PERSISTED_WINDOWS_FILE_ICON_CACHE_KEY = "ode.quickAppLocalIconCache.v1";
const PERSISTED_WINDOWS_FILE_ICON_CACHE_LIMIT = 48;
let persistedWindowsFileIconCacheHydrated = false;

export const IMAGE_PREVIEW_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"]);
export const VIDEO_PREVIEW_EXTENSIONS = new Set(["mp4", "webm", "ogg", "mov"]);
export const TEXT_PREVIEW_EXTENSIONS = new Set(["txt", "md", "csv", "json", "xml", "yml", "yaml", "log"]);

export const DAILY_BRIEFING_SNIPPET_MAX = 120;
export const DAILY_BRIEFING_FIX_KEYWORDS = /fix|bug|issue|resolve|close|error|mismatch|broken|repair/i;
export const DAILY_BRIEFING_DOC_EXTENSIONS = new Set(["pdf", "doc", "docx", "xlsx", "xls", "txt", "md"]);
const ASSISTANT_NODE_LINK_REGEX = /\[(.*?)\]\(ode:\/\/node\/(.*?)\)/g;

export function extractFileExtensionLower(fileName: string): string {
  const trimmed = fileName.trim();
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot <= 0 || lastDot >= trimmed.length - 1) return "";
  return trimmed.slice(lastDot + 1).toLowerCase();
}

export function extractFileExtensionLabel(fileName: string): string {
  const trimmed = fileName.trim();
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot <= 0 || lastDot >= trimmed.length - 1) return "";
  return trimmed
    .slice(lastDot + 1)
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 5)
    .toUpperCase();
}

export function getNodeMirrorFilePath(node: AppNode): string | null {
  const raw = node.properties?.mirrorFilePath;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getNodeImportedFilePath(node: AppNode): string | null {
  const raw = node.properties?.importedFromPath;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return null;
  return trimmed.length > 0 ? trimmed : null;
}

export function getNodePreferredFileActionPath(node: AppNode): string | null {
  return getNodeImportedFilePath(node) ?? getNodeMirrorFilePath(node);
}

export function getNodePreferredFileLocationPath(node: AppNode): string | null {
  return getNodeMirrorFilePath(node) ?? getNodeImportedFilePath(node);
}

export function getDesktopMediaPreviewKind(node: AppNode): DesktopMediaPreviewKind | null {
  if (!isFileLikeNode(node)) return null;
  const ext = extractFileExtensionLower(node.name);
  if (!ext) return null;
  if (IMAGE_PREVIEW_EXTENSIONS.has(ext)) return "image";
  if (VIDEO_PREVIEW_EXTENSIONS.has(ext)) return "video";
  if (ext === "pdf") return "pdf";
  return null;
}

export function resolveDesktopPreviewSrc(node: AppNode): string | null {
  if (!isTauri()) return null;
  if (!isFileLikeNode(node)) return null;
  const filePath = getNodeMirrorFilePath(node);
  if (!filePath) return null;
  try {
    return convertFileSrc(filePath);
  } catch {
    return null;
  }
}

export function buildWindowsFileIconCacheKey(filePath: string | null, fileName: string, size: number): string {
  const ext = extractFileExtensionLower(fileName);
  if (filePath) {
    const lowerPath = filePath.toLowerCase();
    if (ext === "exe" || ext === "lnk" || ext === "url" || ext === "ico") {
      return `path:${lowerPath}:${size}`;
    }
  }
  if (ext) return `ext:${ext}:${size}`;
  if (filePath) return `path:${filePath.toLowerCase()}:${size}`;
  return `name:${fileName.toLowerCase()}:${size}`;
}

function readPersistedWindowsFileIconCache(): Record<string, string> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(PERSISTED_WINDOWS_FILE_ICON_CACHE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    return Object.entries(parsed).reduce<Record<string, string>>((acc, [key, value]) => {
      if (typeof key === "string" && typeof value === "string" && value.startsWith("data:image/")) {
        acc[key] = value;
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
}

export function hydratePersistedWindowsFileIconCache(): void {
  if (persistedWindowsFileIconCacheHydrated || typeof window === "undefined") return;
  persistedWindowsFileIconCacheHydrated = true;

  for (const [key, value] of Object.entries(readPersistedWindowsFileIconCache())) {
    WINDOWS_FILE_ICON_CACHE.set(key, value);
  }
}

export function persistWindowsFileIconCacheEntry(key: string, iconDataUrl: string): void {
  if (typeof window === "undefined" || !iconDataUrl.startsWith("data:image/")) return;
  hydratePersistedWindowsFileIconCache();

  try {
    const parsed = readPersistedWindowsFileIconCache();
    delete parsed[key];
    parsed[key] = iconDataUrl;

    const keys = Object.keys(parsed);
    while (keys.length > PERSISTED_WINDOWS_FILE_ICON_CACHE_LIMIT) {
      const oldestKey = keys.shift();
      if (!oldestKey) break;
      delete parsed[oldestKey];
    }

    window.localStorage.setItem(PERSISTED_WINDOWS_FILE_ICON_CACHE_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore local storage write failures.
  }
}

export async function resolveWindowsFileIcon(filePath: string | null, fileName: string, size: number): Promise<string | null> {
  if (!isTauri()) return null;
  hydratePersistedWindowsFileIconCache();
  const key = buildWindowsFileIconCacheKey(filePath, fileName, size);
  const cached = WINDOWS_FILE_ICON_CACHE.get(key);
  if (cached) return cached;

  const existingPending = WINDOWS_FILE_ICON_PENDING.get(key);
  if (existingPending) return existingPending;

  const request = getWindowsFileIcon(filePath, fileName, size)
    .then((iconDataUrl) => {
      if (iconDataUrl) {
        WINDOWS_FILE_ICON_CACHE.set(key, iconDataUrl);
        persistWindowsFileIconCacheEntry(key, iconDataUrl);
      }
      return iconDataUrl ?? null;
    })
    .catch(() => null)
    .finally(() => {
      WINDOWS_FILE_ICON_PENDING.delete(key);
    });

  WINDOWS_FILE_ICON_PENDING.set(key, request);
  return request;
}

export function parseAssistantAnalysisLineTokens(line: string): AssistantAnalysisToken[] {
  const tokens: AssistantAnalysisToken[] = [];
  let cursor = 0;
  ASSISTANT_NODE_LINK_REGEX.lastIndex = 0;
  let match = ASSISTANT_NODE_LINK_REGEX.exec(line);
  while (match) {
    const index = match.index;
    if (index > cursor) {
      tokens.push({ kind: "text", value: line.slice(cursor, index) });
    }
    const rawLabel = match[1] ?? "";
    const rawNodeId = match[2] ?? "";
    let decodedNodeId = rawNodeId.trim();
    if (decodedNodeId) {
      try {
        decodedNodeId = decodeURIComponent(decodedNodeId);
      } catch {
        // Keep original id if malformed encoding.
      }
    }
    if (decodedNodeId.length > 0) {
      tokens.push({ kind: "node_link", label: rawLabel || decodedNodeId, nodeId: decodedNodeId });
    } else {
      tokens.push({ kind: "text", value: match[0] });
    }
    cursor = index + match[0].length;
    match = ASSISTANT_NODE_LINK_REGEX.exec(line);
  }
  if (cursor < line.length) {
    tokens.push({ kind: "text", value: line.slice(cursor) });
  }
  if (tokens.length === 0) {
    tokens.push({ kind: "text", value: line });
  }
  return tokens;
}
