import { APP_DISPLAY_NAME } from "@/lib/appIdentity";
import type { TranslationParams } from "@/lib/i18n";
import { callNative } from "@/lib/tauriApi";

export const APP_UPDATER_EVENT = "odetool://updater";

export type AppUpdaterStage =
  | "checking"
  | "available"
  | "downloading"
  | "installing"
  | "installed"
  | "up_to_date"
  | "error";

export interface AppUpdaterStatusPayload {
  stage: AppUpdaterStage;
  message: string;
  version?: string | null;
  currentVersion?: string | null;
  downloadedBytes?: number | null;
  contentLength?: number | null;
}

const ACTIVE_UPDATER_STAGES = new Set<AppUpdaterStage>(["checking", "available", "downloading", "installing", "installed"]);
const BLOCKING_UPDATER_STAGES = new Set<AppUpdaterStage>(["available", "downloading", "installing", "installed"]);

type TranslateFn = (key: string, params?: TranslationParams) => string;

export function normalizeUpdaterVersion(version?: string | null): string | null {
  if (typeof version !== "string") return null;
  const trimmed = version.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("v") || trimmed.startsWith("V") ? trimmed : `v${trimmed}`;
}

export function resolveUpdaterProgressPercent(
  downloadedBytes?: number | null,
  contentLength?: number | null
): number | null {
  if (
    typeof downloadedBytes !== "number" ||
    typeof contentLength !== "number" ||
    !Number.isFinite(downloadedBytes) ||
    !Number.isFinite(contentLength) ||
    contentLength <= 0
  ) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round((downloadedBytes / contentLength) * 100)));
}

function formatProgressPercent(downloadedBytes?: number | null, contentLength?: number | null): string | null {
  const percent = resolveUpdaterProgressPercent(downloadedBytes, contentLength);
  return percent === null ? null : `${percent}%`;
}

export function resolveUpdaterStatusLabel(
  payload: AppUpdaterStatusPayload | null | undefined,
  t: TranslateFn
): string | null {
  if (!payload) return null;

  const version = normalizeUpdaterVersion(payload.version);

  if (payload.stage === "checking") {
    return t("updater.status.checking");
  }

  if (payload.stage === "available") {
    return version ? t("updater.status.updating_to", { version }) : t("updater.status.available");
  }

  if (payload.stage === "downloading") {
    const percent = formatProgressPercent(payload.downloadedBytes, payload.contentLength);
    return percent ? t("updater.status.downloading_percent", { percent }) : t("updater.status.downloading");
  }

  if (payload.stage === "installing") {
    return t("updater.status.installing");
  }

  if (payload.stage === "installed") {
    return t("updater.status.restarting");
  }

  if (payload.stage === "up_to_date") {
    return t("updater.status.up_to_date");
  }

  if (payload.stage === "error") {
    return t("updater.status.error");
  }

  return null;
}

export function resolveUpdaterStatusTone(
  payload: AppUpdaterStatusPayload | null | undefined
): "info" | "success" | "error" {
  if (!payload) return "info";
  if (payload.stage === "error") return "error";
  if (payload.stage === "up_to_date" || payload.stage === "installed") return "success";
  return "info";
}

export function resolveUpdaterToastTitle(payload: AppUpdaterStatusPayload | null | undefined, t: TranslateFn): string {
  if (!payload) return t("updater.card_title");

  const version = normalizeUpdaterVersion(payload.version);

  if (payload.stage === "checking") {
    return t("updater.title.checking");
  }

  if (payload.stage === "available" || payload.stage === "downloading" || payload.stage === "installing") {
    return version
      ? t("updater.title.updating_version", { appName: APP_DISPLAY_NAME, version })
      : t("updater.title.updating", { appName: APP_DISPLAY_NAME });
  }

  if (payload.stage === "installed") {
    return t("updater.title.restarting", { appName: APP_DISPLAY_NAME });
  }

  if (payload.stage === "up_to_date") {
    return t("updater.title.up_to_date");
  }

  return t("updater.title.error");
}

export function resolveUpdaterStatusMessage(
  payload: AppUpdaterStatusPayload | null | undefined,
  t: TranslateFn
): string | null {
  if (!payload) return null;

  if (payload.stage === "checking") {
    return t("updater.message.checking");
  }

  if (payload.stage === "available") {
    return t("updater.message.available");
  }

  if (payload.stage === "downloading") {
    return t("updater.message.downloading");
  }

  if (payload.stage === "installing") {
    return t("updater.message.installing");
  }

  if (payload.stage === "installed") {
    return t("updater.message.installed");
  }

  if (payload.stage === "up_to_date") {
    return t("updater.message.up_to_date");
  }

  if (payload.stage === "error") {
    return t("updater.message.error");
  }

  return null;
}

export function resolveUpdaterProgressLabel(
  payload: AppUpdaterStatusPayload | null | undefined,
  t: TranslateFn
): string | null {
  if (!payload) return null;

  const percent = resolveUpdaterProgressPercent(payload.downloadedBytes, payload.contentLength);
  if (percent !== null) {
    return t("updater.progress.percent", { percent });
  }

  if (payload.stage === "available" || payload.stage === "downloading") {
    return t("updater.progress.preparing");
  }

  if (payload.stage === "installing") {
    return t("updater.progress.installing");
  }

  if (payload.stage === "installed") {
    return t("updater.progress.restarting");
  }

  return null;
}

export function resolveUpdaterTechnicalDetail(payload: AppUpdaterStatusPayload | null | undefined): string | null {
  if (!payload || payload.stage !== "error") return null;
  const detail = payload.message?.trim();
  return detail ? detail : null;
}

export function isUpdaterBlocking(payload: AppUpdaterStatusPayload | null | undefined): boolean {
  return payload ? BLOCKING_UPDATER_STAGES.has(payload.stage) : false;
}

export function isUpdaterBusy(payload: AppUpdaterStatusPayload | null | undefined): boolean {
  return payload ? ACTIVE_UPDATER_STAGES.has(payload.stage) : false;
}

export async function checkForAppUpdates(): Promise<void> {
  await callNative<void>("check_for_app_updates");
}
