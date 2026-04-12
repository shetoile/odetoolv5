import {
  inferAiCommandActionId,
  inferAiCommandActionSequence,
  inferAiCommandArgs,
  resolveDocumentAwareAiCommandAction,
  sanitizeAiCommandArgs,
  type AiCommandActionId,
  type AiPlannerActionStep,
  type AiPlannerParseResult
} from "@/features/ai/commandPlanner";

export type AiCommandPlannerSource = "heuristic" | "llm" | "llm+heuristic";

export type AiCommandAnalysisState = {
  actionId: AiCommandActionId | null;
  args: Record<string, unknown>;
  actionSequence: AiPlannerActionStep[];
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
}): string {
  return [
    `Date: ${options.date}`,
    `Workspace: ${options.workspaceName}`,
    `View: ${options.view}`,
    `Selected node: ${options.selectedLabel}`
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
  const heuristicSequence = inferAiCommandActionSequence(commandText, heuristicAction).map((step) => ({
    ...step,
    actionId: resolveDocumentAwareAiCommandAction(step.actionId, {
      preferDocumentWbs: options.preferDocumentWbs,
      wbsIntentRequested
    }) ?? step.actionId
  }));
  const primaryStep = heuristicSequence[0] ?? null;
  const args = primaryStep
    ? primaryStep.args
    : heuristicAction
      ? sanitizeAiCommandArgs(heuristicAction, inferAiCommandArgs(commandText, heuristicAction), commandText)
      : {};

  return {
    heuristicAction,
    wbsIntentRequested,
    state: {
      actionId: primaryStep?.actionId ?? heuristicAction,
      args,
      actionSequence: heuristicSequence,
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
  let actionSequence: AiPlannerActionStep[] =
    parsed.actionSequence.length > 0
      ? parsed.actionSequence
          .map((step) => {
            const normalizedActionId = resolveDocumentAwareAiCommandAction(step.actionId, {
              preferDocumentWbs: options.preferDocumentWbs,
              wbsIntentRequested: options.wbsIntentRequested
            });
            if (!normalizedActionId) return null;
            return {
              actionId: normalizedActionId,
              args: sanitizeAiCommandArgs(normalizedActionId, step.args, commandText)
            };
          })
          .filter((step): step is AiPlannerActionStep => Boolean(step))
      : [];
  const normalizedActionId = resolveDocumentAwareAiCommandAction(parsed.actionId, {
    preferDocumentWbs: options.preferDocumentWbs,
    wbsIntentRequested: options.wbsIntentRequested
  });
  if (current.actionSequence.length > 1 && actionSequence.length <= 1) {
    const parsedPrimaryActionId = actionSequence[0]?.actionId ?? normalizedActionId;
    if (parsedPrimaryActionId === current.actionSequence[0]?.actionId) {
      actionSequence = current.actionSequence;
    }
  }
  if (actionSequence.length === 0 && normalizedActionId) {
    actionSequence = [
      {
        actionId: normalizedActionId,
        args: sanitizeAiCommandArgs(normalizedActionId, parsed.args, commandText)
      }
    ];
  }
  if (!normalizedActionId) {
    return {
      ...next,
      fallbackUsed: true
    };
  }
  const primaryStep = actionSequence[0];
  return {
    ...next,
    actionId: primaryStep?.actionId ?? normalizedActionId,
    args: primaryStep?.args ?? sanitizeAiCommandArgs(normalizedActionId, parsed.args, commandText),
    actionSequence,
    plannerSource: options.heuristicAction ? "llm+heuristic" : "llm"
  };
}

export function finalizeAiCommandAnalysis(current: AiCommandAnalysisState): AiCommandAnalysisState {
  if (current.actionSequence.length > 1) {
    return {
      ...current,
      actionId: current.actionSequence[0]?.actionId ?? current.actionId,
      args: current.actionSequence[0]?.args ?? current.args,
      reason:
        !current.reason || current.reason === "Heuristic command interpretation."
          ? "Run one ordered AI workflow that chains the requested ODE actions in sequence."
          : current.reason,
      steps: current.actionSequence.map((step, index) => `Step ${index + 1}: ${step.actionId.replace(/_/g, " ")}.`)
    };
  }
  if (current.actionId === "governance_framework_generate") {
    return {
      ...current,
      reason:
        !current.reason || current.reason === "Heuristic command interpretation."
          ? "Generate a dynamic governance framework definition, then create the framework branch and widgets from that config."
          : current.reason,
      steps: [
        "Generate a governance framework definition from the request.",
        "Validate modules, fields, scoring, and widget config.",
        "Create the framework branch, tables, and widgets in ODE."
      ]
    };
  }
  if (current.actionId === "wbs_from_document") {
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
  return current;
}
