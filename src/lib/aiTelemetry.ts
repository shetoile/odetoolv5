import type { AppNode } from "@/lib/types";
import { buildAppStorageKey } from "@/lib/appIdentity";

const AI_TELEMETRY_STORAGE_KEY = buildAppStorageKey("ai.telemetry.v1");

export type AiTelemetryDocumentAdvisorContext = {
  nodeId: string;
  nodeName: string;
  nodeType: AppNode["type"];
  documentKind: string;
  lineCount: number;
  outlineLineCount: number;
  outlineCoverage: number;
  sectionCount: number;
  selectedSectionId: string | null;
  selectedSectionTitle: string | null;
  recommendedActionId: string | null;
  usedRecommendedAction: boolean;
  naCode: string | null;
  naConfidence: number | null;
};

export type AiTelemetryEvent = {
  id: string;
  timestamp: string;
  flow:
    | "command_plan"
    | "command_execute"
    | "plan_my_day"
    | "node_assistant"
    | "document_advisor"
    | "document_review"
    | "ticket_analyze"
    | "ticket_reply";
  source: "heuristic" | "llm" | "llm+heuristic" | "assistant" | "document_advisor";
  actionId: string | null;
  success: boolean;
  latencyMs: number;
  fallbackUsed: boolean;
  workspace: string;
  selectedNodeId: string | null;
  error?: string;
  documentAdvisor?: AiTelemetryDocumentAdvisorContext;
};

export function appendAiTelemetryEvent(event: Omit<AiTelemetryEvent, "id" | "timestamp">) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(AI_TELEMETRY_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as AiTelemetryEvent[]) : [];
    const safeList = Array.isArray(parsed) ? parsed : [];
    safeList.push({
      id: `ai_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
      timestamp: new Date().toISOString(),
      ...event
    });
    localStorage.setItem(AI_TELEMETRY_STORAGE_KEY, JSON.stringify(safeList.slice(-400)));
  } catch {
    // Telemetry is best-effort only.
  }
}

export function readAiTelemetryEvents(limit = 10): AiTelemetryEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(AI_TELEMETRY_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as AiTelemetryEvent[]) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object")
      .slice(-Math.max(1, limit))
      .reverse();
  } catch {
    return [];
  }
}

export function clearAiTelemetryEvents() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(AI_TELEMETRY_STORAGE_KEY);
  } catch {
    // Telemetry is best-effort only.
  }
}

function humanizeAiTelemetryToken(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

export function buildAiActivityDetails(event: AiTelemetryEvent): string[] {
  const details: string[] = [];
  const advisor = event.documentAdvisor;
  if (!advisor) return details;

  details.push(
    ["AI Options", advisor.nodeName, humanizeAiTelemetryToken(advisor.documentKind)]
      .filter((part) => part.length > 0)
      .join(" | ")
  );

  const metrics = [`lines ${advisor.lineCount}`, `sections ${advisor.sectionCount}`];
  if (advisor.outlineLineCount > 0) {
    metrics.push(`outline ${Math.round(advisor.outlineCoverage * 100)}%`);
  }
  if (advisor.selectedSectionTitle) {
    metrics.push(`section ${advisor.selectedSectionTitle}`);
  }
  if (advisor.recommendedActionId) {
    metrics.push(`recommended ${advisor.recommendedActionId}${advisor.usedRecommendedAction ? " (used)" : ""}`);
  }
  if (advisor.naCode) {
    const confidenceSuffix =
      typeof advisor.naConfidence === "number" ? ` ${Math.round(advisor.naConfidence * 100)}%` : "";
    metrics.push(`NA ${advisor.naCode}${confidenceSuffix}`);
  }
  details.push(metrics.join(" | "));

  return details;
}
