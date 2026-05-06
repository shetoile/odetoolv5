import {
  StructuredAiPromptError,
  clampStructuredConfidence,
  runStructuredAiPrompt
} from "@/ai/core/runStructuredPrompt";
import { buildAiOutputLanguageInstruction } from "@/ai/planning/outputLanguage";
import type { LanguageCode } from "@/lib/i18n";
import type { SupportedAiProviderId } from "@/lib/aiProviderKeys";

export type DailyWorkAiInputMode = "note" | "meeting";

export type DailyWorkAiExtractedItem = {
  title: string;
  detail: string;
  dueDate: string | null;
  owner: string | null;
};

export type DailyWorkAiExtraction = {
  summary: string;
  decisions: DailyWorkAiExtractedItem[];
  actions: DailyWorkAiExtractedItem[];
  risks: DailyWorkAiExtractedItem[];
  followUps: DailyWorkAiExtractedItem[];
  timelineSuggestions: DailyWorkAiExtractedItem[];
  confidence: number;
};

export type DailyWorkAiExtractionInput = {
  apiKey: string;
  providerId?: SupportedAiProviderId;
  mode: DailyWorkAiInputMode;
  targetLanguage: LanguageCode;
  title?: string | null;
  rawText: string;
  evidenceLabels?: string[];
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalText(value: unknown): string | null {
  const text = asText(value);
  return text.length > 0 ? text : null;
}

function normalizeDate(value: unknown): string | null {
  const text = asText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function parseItems(value: unknown): DailyWorkAiExtractedItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const title = asText(record.title);
      if (!title) return null;
      return {
        title,
        detail: asText(record.detail),
        dueDate: normalizeDate(record.due_date),
        owner: normalizeOptionalText(record.owner)
      };
    })
    .filter((item): item is DailyWorkAiExtractedItem => Boolean(item))
    .slice(0, 18);
}

export function createEmptyDailyWorkAiExtraction(summary = ""): DailyWorkAiExtraction {
  return {
    summary,
    decisions: [],
    actions: [],
    risks: [],
    followUps: [],
    timelineSuggestions: [],
    confidence: 0.42
  };
}

export function isDailyWorkAiUnavailableError(error: unknown): boolean {
  return error instanceof StructuredAiPromptError && error.code === "ai_request_failed";
}

export async function extractDailyWorkWithAi(input: DailyWorkAiExtractionInput): Promise<DailyWorkAiExtraction> {
  const text = input.rawText.trim();
  if (!text) return createEmptyDailyWorkAiExtraction();

  const sourceLabel = input.mode === "meeting" ? "meeting transcript" : "quick note";
  const systemPrompt = [
    "You are ODETool Daily Work AI.",
    "Extract only operational daily work from the user's source.",
    "Return exactly one JSON object and no markdown.",
    "Never approve actions and never send anything to a timeline.",
    "Keep every item short, concrete, and reviewable by a human.",
    "Use null for unknown due dates and owners.",
    "Use ISO date format YYYY-MM-DD only when the source clearly gives a date.",
    buildAiOutputLanguageInstruction(input.targetLanguage)
  ].join(" ");

  const userPrompt = [
    `Source type: ${sourceLabel}`,
    `Title: ${input.title?.trim() || "(none)"}`,
    "",
    "Evidence labels:",
    input.evidenceLabels?.length ? input.evidenceLabels.map((label) => `- ${label}`).join("\n") : "(none)",
    "",
    "Source text:",
    text,
    "",
    "Return JSON with this exact schema:",
    "{",
    '  "summary": "string",',
    '  "confidence": 0.0,',
    '  "decisions": [{ "title": "string", "detail": "string", "due_date": "YYYY-MM-DD | null", "owner": "string | null" }],',
    '  "actions": [{ "title": "string", "detail": "string", "due_date": "YYYY-MM-DD | null", "owner": "string | null" }],',
    '  "risks": [{ "title": "string", "detail": "string", "due_date": "YYYY-MM-DD | null", "owner": "string | null" }],',
    '  "follow_ups": [{ "title": "string", "detail": "string", "due_date": "YYYY-MM-DD | null", "owner": "string | null" }],',
    '  "timeline_suggestions": [{ "title": "string", "detail": "string", "due_date": "YYYY-MM-DD | null", "owner": "string | null" }]',
    "}",
    "Rules:",
    "- Return empty arrays when the source does not support a category.",
    "- Do not create deliverables, tasks, subtasks, or hierarchy.",
    "- Do not invent dates, owners, decisions, or risks.",
    "- Put items that need user approval in actions, risks, decisions, or follow_ups.",
    "- timeline_suggestions are only review suggestions, not approved timeline entries.",
    "- No extra keys. No markdown."
  ].join("\n");

  return runStructuredAiPrompt({
    apiKey: input.apiKey,
    providerId: input.providerId,
    intent: "daily_work_extract",
    systemPrompt,
    userPrompt,
    invalidJsonMessage: "AI returned an invalid daily work extraction.",
    malformedJsonMessage: "AI returned malformed daily work JSON.",
    aiEngine: "cloud",
    parse: (parsed) => ({
      summary: asText(parsed.summary),
      decisions: parseItems(parsed.decisions),
      actions: parseItems(parsed.actions),
      risks: parseItems(parsed.risks),
      followUps: parseItems(parsed.follow_ups),
      timelineSuggestions: parseItems(parsed.timeline_suggestions),
      confidence: clampStructuredConfidence(parsed.confidence, 0.72)
    })
  });
}
