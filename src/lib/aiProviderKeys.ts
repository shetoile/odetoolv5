import { AI_KEYS_STORAGE_KEY } from "@/lib/appIdentity";
import { callNative } from "@/lib/tauriApi";

export type SupportedAiProviderId =
  | "anthropic"
  | "deepseek"
  | "gemini"
  | "groq"
  | "mistral"
  | "openai"
  | "openrouter"
  | "xai"
  | "zai";

export type StoredAiProviderId = SupportedAiProviderId | "unknown";

export interface StoredAiProviderKey {
  providerId: StoredAiProviderId;
  providerLabel: string;
  apiKey: string;
}

type StoredAiKeysPayload = {
  providerKeys?: StoredAiProviderKey[];
  mistralKeys?: string[];
  groqKeys?: string[];
  perplexityKeys?: string[];
};

export interface DetectedAiProviderSource {
  providerId: SupportedAiProviderId;
  displayName: string;
}

export const AI_PROVIDER_DISPLAY_NAMES: Record<SupportedAiProviderId, string> = {
  anthropic: "Anthropic Claude",
  deepseek: "DeepSeek",
  gemini: "Google Gemini",
  groq: "Groq",
  mistral: "Mistral",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  xai: "xAI Grok",
  zai: "Z.AI"
};

const UNKNOWN_PROVIDER_LABEL = "Unknown";
const AI_ACCESS_TOKEN_PREFIX = "odeai";
const AI_ACCESS_TOKEN_SEPARATOR = "::";
const AUTO_DETECT_PROVIDER_LABEL = "Auto-detect";

function normalizeStoredKey(entry: StoredAiProviderKey | null | undefined): StoredAiProviderKey | null {
  if (!entry) return null;
  const apiKey = typeof entry.apiKey === "string" ? entry.apiKey.trim() : "";
  if (!apiKey) return null;
  const providerId = isSupportedAiProviderId(entry.providerId)
    ? entry.providerId
    : entry.providerId === "unknown"
      ? "unknown"
      : "unknown";
  const providerLabel =
    typeof entry.providerLabel === "string" && entry.providerLabel.trim().length > 0
      ? entry.providerLabel.trim()
      : providerId === "unknown"
        ? UNKNOWN_PROVIDER_LABEL
        : AI_PROVIDER_DISPLAY_NAMES[providerId];
  return {
    providerId,
    providerLabel,
    apiKey
  };
}

function buildLegacyKeys(keys: string[] | undefined, providerId: StoredAiProviderId, providerLabel: string): StoredAiProviderKey[] {
  return (keys ?? [])
    .map((apiKey) => normalizeStoredKey({ providerId, providerLabel, apiKey }))
    .filter((entry): entry is StoredAiProviderKey => Boolean(entry));
}

export function isSupportedAiProviderId(value: unknown): value is SupportedAiProviderId {
  return (
    value === "anthropic" ||
    value === "deepseek" ||
    value === "gemini" ||
    value === "groq" ||
    value === "mistral" ||
    value === "openai" ||
    value === "openrouter" ||
    value === "xai" ||
    value === "zai"
  );
}

export function readStoredAiProviderKeys(): StoredAiProviderKey[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(AI_KEYS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredAiKeysPayload;
    const providerKeys = Array.isArray(parsed.providerKeys)
      ? parsed.providerKeys
          .map((entry) => normalizeStoredKey(entry))
          .filter((entry): entry is StoredAiProviderKey => Boolean(entry))
      : [];
    const legacyKeys = providerKeys.length > 0
      ? []
      : [
          ...buildLegacyKeys(parsed.mistralKeys, "mistral", AI_PROVIDER_DISPLAY_NAMES.mistral),
          ...buildLegacyKeys(parsed.groqKeys, "groq", AI_PROVIDER_DISPLAY_NAMES.groq),
          ...buildLegacyKeys(parsed.perplexityKeys, "unknown", "Perplexity")
        ];
    const dedupe = new Set<string>();
    return [...providerKeys, ...legacyKeys].filter((entry) => {
      const dedupeKey = `${entry.providerId}:${entry.apiKey}`;
      if (dedupe.has(dedupeKey)) return false;
      dedupe.add(dedupeKey);
      return true;
    });
  } catch {
    return [];
  }
}

export function writeStoredAiProviderKeys(entries: StoredAiProviderKey[]) {
  if (typeof window === "undefined") return;
  const normalized = entries
    .map((entry) => normalizeStoredKey(entry))
    .filter((entry): entry is StoredAiProviderKey => Boolean(entry));
  localStorage.setItem(
    AI_KEYS_STORAGE_KEY,
    JSON.stringify({
      providerKeys: normalized
    } satisfies StoredAiKeysPayload)
  );
}

export function getPrimaryStoredAiProviderKey(): StoredAiProviderKey | null {
  const keys = readStoredAiProviderKeys();
  return keys.find((entry) => entry.providerId !== "unknown") ?? keys[0] ?? null;
}

export function createEmptyStoredAiProviderKey(): StoredAiProviderKey {
  return {
    providerId: "unknown",
    providerLabel: AUTO_DETECT_PROVIDER_LABEL,
    apiKey: ""
  };
}

export function ensureAiProviderKeyDrafts(entries: StoredAiProviderKey[]): StoredAiProviderKey[] {
  const normalized = entries
    .map((entry) =>
      entry.apiKey.trim().length > 0
        ? normalizeStoredKey(entry)
        : {
            providerId: entry.providerId === "unknown" ? "unknown" : entry.providerId,
            providerLabel: entry.providerLabel.trim().length > 0 ? entry.providerLabel.trim() : AUTO_DETECT_PROVIDER_LABEL,
            apiKey: entry.apiKey
          }
    )
    .filter((entry): entry is StoredAiProviderKey => Boolean(entry));
  return normalized.length > 0 ? normalized : [createEmptyStoredAiProviderKey()];
}

export function getStoredAiProviderDisplayName(providerId: StoredAiProviderId, fallbackLabel?: string | null): string {
  if (providerId === "unknown") {
    return fallbackLabel?.trim() || UNKNOWN_PROVIDER_LABEL;
  }
  return AI_PROVIDER_DISPLAY_NAMES[providerId] ?? fallbackLabel?.trim() ?? UNKNOWN_PROVIDER_LABEL;
}

export function encodeAiAccessToken(entry: Pick<StoredAiProviderKey, "providerId" | "apiKey">): string {
  if (!isSupportedAiProviderId(entry.providerId)) {
    return entry.apiKey;
  }
  return [
    AI_ACCESS_TOKEN_PREFIX,
    entry.providerId,
    encodeURIComponent(entry.apiKey)
  ].join(AI_ACCESS_TOKEN_SEPARATOR);
}

export function decodeAiAccessToken(token: string): {
  providerId?: SupportedAiProviderId;
  apiKey: string;
} {
  const trimmed = token.trim();
  const parts = trimmed.split(AI_ACCESS_TOKEN_SEPARATOR);
  if (parts.length >= 3 && parts[0] === AI_ACCESS_TOKEN_PREFIX && isSupportedAiProviderId(parts[1])) {
    return {
      providerId: parts[1],
      apiKey: decodeURIComponent(parts.slice(2).join(AI_ACCESS_TOKEN_SEPARATOR))
    };
  }
  return {
    apiKey: trimmed
  };
}

export async function detectAiProviderSource(apiKey: string): Promise<DetectedAiProviderSource> {
  return callNative<DetectedAiProviderSource>("detect_ai_api_source", {
    apiKey
  });
}

export async function detectAndNormalizeAiProviderKeys(entries: StoredAiProviderKey[]): Promise<StoredAiProviderKey[]> {
  const normalized: StoredAiProviderKey[] = [];
  for (const entry of entries) {
    const apiKey = entry.apiKey.trim();
    if (!apiKey) continue;
    try {
      const detected = await detectAiProviderSource(apiKey);
      normalized.push({
        providerId: detected.providerId,
        providerLabel: detected.displayName,
        apiKey
      });
    } catch {
      normalized.push({
        providerId: "unknown",
        providerLabel: UNKNOWN_PROVIDER_LABEL,
        apiKey
      });
    }
  }
  return normalized;
}
