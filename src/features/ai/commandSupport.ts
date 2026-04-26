import {
  buildAiCapabilityPreview,
  type AiCommandActionId
} from "@/features/ai/capabilityRegistry";

export function parseArgsString(args: Record<string, unknown> | undefined, key: string): string {
  const value = args?.[key];
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function parseArgsNames(args: Record<string, unknown> | undefined): string[] {
  const value = args?.names;
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
  }
  if (typeof value === "string") {
    return value
      .split(/[,;\n|]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
}

export function parseArgsList(args: Record<string, unknown> | undefined, key: string): string[] {
  const value = args?.[key];
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
  }
  if (typeof value === "string") {
    return value
      .split(/[,;\n|]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
}

export function buildAiPlanPreview(
  actionId: AiCommandActionId | null,
  args: Record<string, unknown>,
  context: {
    selectedLabel: string;
    workspaceName: string;
  }
): string[] {
  return buildAiCapabilityPreview(actionId, args, context);
}
