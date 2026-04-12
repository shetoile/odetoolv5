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

export function resolveUpdaterStatusLabel(payload: AppUpdaterStatusPayload | null | undefined): string | null {
  if (!payload) return null;

  if (payload.stage === "checking") {
    return "Checking updates";
  }

  if (payload.stage === "available") {
    return payload.version ? `Updating to ${payload.version}` : "Update found";
  }

  if (payload.stage === "downloading") {
    const percent = formatProgressPercent(payload.downloadedBytes, payload.contentLength);
    return percent ? `Downloading update ${percent}` : "Downloading update";
  }

  if (payload.stage === "installing") {
    return "Installing update";
  }

  if (payload.stage === "installed") {
    return "Restarting to finish update";
  }

  if (payload.stage === "error") {
    return "Update issue";
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

export function resolveUpdaterToastTitle(payload: AppUpdaterStatusPayload | null | undefined): string {
  if (!payload) return "Automatic update";

  if (payload.stage === "checking") {
    return "Checking for updates";
  }

  if (payload.stage === "available") {
    return payload.version ? `Update ${payload.version} available` : "Update available";
  }

  if (payload.stage === "downloading") {
    return payload.version ? `Downloading ${payload.version}` : "Downloading update";
  }

  if (payload.stage === "installing") {
    return payload.version ? `Installing ${payload.version}` : "Installing update";
  }

  if (payload.stage === "installed") {
    return "Restarting ODETool Pro";
  }

  if (payload.stage === "up_to_date") {
    return "You already have the latest version";
  }

  return "Automatic update needs attention";
}

export function isUpdaterBusy(payload: AppUpdaterStatusPayload | null | undefined): boolean {
  return payload ? ACTIVE_UPDATER_STAGES.has(payload.stage) : false;
}

export async function checkForAppUpdates(): Promise<void> {
  await callNative<void>("check_for_app_updates");
}
