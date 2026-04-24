import type { AiEngine } from "@/ai/core/aiContracts";
import { runAiPromptAnalysis } from "@/ai/core/aiOrchestrator";
import type { AiPromptMessageContentPart } from "@/lib/aiCommandAttachments";
import type { SupportedAiProviderId } from "@/lib/aiProviderKeys";

export type StructuredAiPromptIntent =
  | "planning_deliverables"
  | "planning_tasks"
  | "planning_structure"
  | "translate_structure";

export type StructuredAiPromptErrorCode =
  | "ai_request_failed"
  | "json_not_found"
  | "json_invalid"
  | "schema_invalid"
  | "shape_changed"
  | "parse_failed";

export class StructuredAiPromptError extends Error {
  code: StructuredAiPromptErrorCode;
  raw: string;

  constructor(code: StructuredAiPromptErrorCode, message: string, raw = "") {
    super(message);
    this.name = "StructuredAiPromptError";
    this.code = code;
    this.raw = raw;
  }
}

export interface StructuredAiPromptRequest<T> {
  apiKey: string;
  providerId?: SupportedAiProviderId;
  intent: StructuredAiPromptIntent;
  systemPrompt: string;
  userPrompt: string;
  userContent?: AiPromptMessageContentPart[];
  invalidJsonMessage: string;
  malformedJsonMessage: string;
  aiEngine?: AiEngine;
  parse: (parsed: Record<string, unknown>) => T;
}

const DEFAULT_ENGINE_BY_INTENT: Record<StructuredAiPromptIntent, AiEngine> = {
  planning_deliverables: "cloud",
  planning_tasks: "cloud",
  planning_structure: "cloud",
  translate_structure: "cloud"
};

function extractFirstJsonObject(raw: string): string | null {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = raw.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") {
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return raw.slice(start, index + 1);
    }
  }

  return null;
}

function parseStructuredJsonPayload<T>(
  raw: string,
  request: StructuredAiPromptRequest<T>
): Record<string, unknown> {
  const jsonPayload = extractFirstJsonObject(raw);
  if (!jsonPayload) {
    throw new StructuredAiPromptError("json_not_found", request.invalidJsonMessage, raw);
  }

  try {
    return JSON.parse(jsonPayload) as Record<string, unknown>;
  } catch {
    throw new StructuredAiPromptError("json_invalid", request.malformedJsonMessage, raw);
  }
}

export function clampStructuredConfidence(value: unknown, fallback = 0.72): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

export async function runStructuredAiPromptWithRaw<T>(
  request: StructuredAiPromptRequest<T>
): Promise<{ result: T; raw: string }> {
  let raw = "";
  try {
    raw = await runAiPromptAnalysis({
      apiKey: request.apiKey,
      providerId: request.providerId,
      systemPrompt: request.systemPrompt,
      userPrompt: request.userPrompt,
      userContent: request.userContent,
      aiEngine: request.aiEngine ?? DEFAULT_ENGINE_BY_INTENT[request.intent]
    });
  } catch {
    throw new StructuredAiPromptError("ai_request_failed", "AI request failed.", raw);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = parseStructuredJsonPayload(raw, request);
  } catch (error) {
    const structuredError = error instanceof StructuredAiPromptError ? error : null;
    const shouldAttemptRepair =
      structuredError &&
      (structuredError.code === "json_not_found" || structuredError.code === "json_invalid") &&
      raw.trim().length > 0;

    if (!shouldAttemptRepair) {
      throw error;
    }

    let repairedRaw = "";
    try {
      repairedRaw = await runAiPromptAnalysis({
        apiKey: request.apiKey,
        providerId: request.providerId,
        systemPrompt: [
          "You repair AI answers into valid JSON.",
          "Return only one valid JSON object with no markdown or commentary.",
          "Do not omit required fields from the requested schema."
        ].join(" "),
        userPrompt: [
          "Repair this answer into the required JSON schema.",
          "",
          "Original task and schema:",
          request.userPrompt,
          "",
          "Original AI answer:",
          raw,
          "",
          "Return only the repaired JSON object."
        ].join("\n"),
        aiEngine: request.aiEngine ?? DEFAULT_ENGINE_BY_INTENT[request.intent]
      });
    } catch {
      throw error;
    }

    try {
      parsed = parseStructuredJsonPayload(repairedRaw, request);
      raw = repairedRaw;
    } catch {
      throw error;
    }
  }

  try {
    return {
      result: request.parse(parsed),
      raw
    };
  } catch (error) {
    if (error instanceof StructuredAiPromptError) {
      if (!error.raw) {
        error.raw = raw;
      }
      throw error;
    }
    const message = error instanceof Error && error.message.trim().length > 0 ? error.message : request.invalidJsonMessage;
    throw new StructuredAiPromptError("parse_failed", message, raw);
  }
}

export async function runStructuredAiPrompt<T>(request: StructuredAiPromptRequest<T>): Promise<T> {
  const response = await runStructuredAiPromptWithRaw(request);
  return response.result;
}
