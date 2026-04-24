import {
  inferAiCommandActionId,
  inferAiCommandArgs,
  resolveDocumentAwareAiCommandAction,
  sanitizeAiCommandArgs,
  type AiCommandActionId,
  type AiPlannerParseResult
} from "@/features/ai/commandPlanner";

export type AiCommandPlannerSource = "heuristic" | "llm" | "llm+heuristic";

export type AiCommandAnalysisState = {
  actionId: AiCommandActionId | null;
  args: Record<string, unknown>;
  reason: string;
  steps: string[];
  confidence: number;
  plannerSource: AiCommandPlannerSource;
  fallbackUsed: boolean;
};

export type InitialAiCommandAnalysis = {
  heuristicAction: AiCommandActionId | null;
  wbsIntentRequested: boolean;
  state: AiCommandAnalysisState;
};

export function buildAiCommandContext(options: {
  date: string;
  workspaceName: string;
  view: "desktop" | "timeline";
  selectedLabel: string;
  selectedPathLabel?: string | null;
  documentScopeLabel?: string | null;
  objective?: string | null;
  scheduleStatus?: string | null;
  documentLabels?: string[];
  quickAppCatalogLines?: string | null;
  groundedQuickAppEvidenceLines?: string | null;
}): string {
  return [
    `Date: ${options.date}`,
    `Workspace: ${options.workspaceName}`,
    `View: ${options.view}`,
    `Selected node: ${options.selectedLabel}`,
    `Selected path: ${options.selectedPathLabel?.trim() || "(none)"}`,
    `Document scope: ${options.documentScopeLabel?.trim() || "node"}`,
    `Objective: ${options.objective?.trim() || "(none)"}`,
    `Schedule status: ${options.scheduleStatus?.trim() || "(none)"}`,
    `Document sources: ${options.documentLabels?.join(", ") || "(none)"}`,
    "Quick apps:",
    options.quickAppCatalogLines?.trim() || "- none",
    "Grounded quick-app evidence:",
    options.groundedQuickAppEvidenceLines?.trim() || "- none"
  ].join("\n");
}

export function isWbsIntentRequested(commandText: string): boolean {
  const text = commandText.toLowerCase();
  return (
    text.includes("wbs") ||
    text.includes("work breakdown") ||
    text.includes("break down") ||
    text.includes("breakdown")
  );
}

export function buildInitialAiCommandAnalysis(
  commandText: string,
  options: { preferDocumentWbs: boolean; }
): InitialAiCommandAnalysis {
  const wbsIntentRequested = isWbsIntentRequested(commandText);
  const heuristicAction = resolveDocumentAwareAiCommandAction(inferAiCommandActionId(commandText), {
    preferDocumentWbs: options.preferDocumentWbs,
    wbsIntentRequested
  });
  const args = heuristicAction
    ? sanitizeAiCommandArgs(heuristicAction, inferAiCommandArgs(commandText, heuristicAction), commandText)
    : {};

  return {
    heuristicAction,
    wbsIntentRequested,
    state: {
      actionId: heuristicAction,
      args,
      reason: "Heuristic command interpretation.",
      steps: [
        "Interpret the command intent.",
        "Pick the safest matching internal action.",
        "Show execution preview and wait for confirmation.",
        "Execute and report progress."
      ],
      confidence: heuristicAction ? 0.55 : 0.18,
      plannerSource: "heuristic",
      fallbackUsed: false
    }
  };
}

export function mergeAiPlannerAnalysisState(
  current: AiCommandAnalysisState,
  parsed: AiPlannerParseResult,
  commandText: string,
  options: {
    heuristicAction: AiCommandActionId | null;
    preferDocumentWbs: boolean;
    wbsIntentRequested: boolean;
  }
): AiCommandAnalysisState {
  const next: AiCommandAnalysisState = {
    ...current,
    reason: parsed.reason ?? current.reason,
    steps: parsed.steps.length > 0 ? parsed.steps : current.steps,
    confidence: parsed.confidence
  };
  const normalizedActionId = resolveDocumentAwareAiCommandAction(parsed.actionId, {
    preferDocumentWbs: options.preferDocumentWbs,
    wbsIntentRequested: options.wbsIntentRequested
  });
  if (!normalizedActionId) {
    return {
      ...next,
      fallbackUsed: true
    };
  }
  return {
    ...next,
    actionId: normalizedActionId,
    args: sanitizeAiCommandArgs(normalizedActionId, parsed.args, commandText),
    plannerSource: options.heuristicAction ? "llm+heuristic" : "llm"
  };
}

export function finalizeAiCommandAnalysis(current: AiCommandAnalysisState): AiCommandAnalysisState {
  if (current.actionId !== "wbs_from_document") {
    return current;
  }
  return {
    ...current,
    reason:
      !current.reason || current.reason === "Heuristic command interpretation."
        ? "Document-grounded tree review."
        : current.reason,
    steps: [
      "Read the selected document or document scope.",
      "Extract the strongest structure supported by the content.",
      "Open the review before adding anything to the workspace."
    ]
  };
}
