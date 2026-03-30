import { callNative } from "@/lib/tauriApi";

export const AI_REBUILD_DISABLED_MESSAGE =
  "Legacy AI is disabled while ODETool AI is being rebuilt.";

export type AiRebuildStatus = {
  phase: "foundation";
  legacySurfaceEnabled: boolean;
  legacyBackendEnabled: boolean;
  availableWorkflows: string[];
  message: string;
};

export async function getAiRebuildStatus(): Promise<AiRebuildStatus> {
  return callNative<AiRebuildStatus>("get_ai_rebuild_status");
}
