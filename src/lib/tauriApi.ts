import { invoke } from "@tauri-apps/api/core";

function isTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window;
  return Boolean(w.__TAURI__ || w.__TAURI_INTERNALS__);
}

export async function callNative<T>(command: string, payload?: Record<string, unknown>): Promise<T> {
  if (!isTauriRuntime()) {
    throw new Error("Tauri runtime not detected. Use `npm run tauri:dev` for desktop mode.");
  }
  return invoke<T>(command, payload);
}
