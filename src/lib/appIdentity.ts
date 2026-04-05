export const APP_DISPLAY_NAME = "ODETool Pro";
export const APP_SOURCE_ID = "odetool-pro";
export const APP_STORAGE_NAMESPACE = "odetool.pro";
export const APP_MIRROR_FOLDER_NAME = "ODETool_Pro_Mirror";

export function buildAppStorageKey(suffix: string): string {
  return `${APP_STORAGE_NAMESPACE}.${suffix.trim().replace(/^\.+/, "")}`;
}

export const AI_KEYS_STORAGE_KEY = buildAppStorageKey("ai.keys.v1");
