import { runStructuredAiPrompt, clampStructuredConfidence } from "@/ai/core/runStructuredPrompt";
import { buildAiOutputLanguageInstruction } from "@/ai/planning/outputLanguage";
import {
  buildAiKnowledgePack,
  buildDeliverablePlanningContext,
  buildTaskPlanningContext,
  formatExistingDeliverables,
  formatExistingTasks
} from "@/ai/planning/planningContext";
import type { LanguageCode } from "@/lib/i18n";
import type {
  ODEDeliverableProposal,
  ODEExecutionTaskItem,
  ODEWorkstreamSource,
  ODEWorkstreamWorkspaceProposal,
  ScheduleStatus
} from "@/lib/types";

export interface GenerateWorkstreamTaskProposalInput {
  apiKey: string;
  nodeId: string;
  nodeTitle: string;
  targetLanguage: LanguageCode;
  deliverableId: string;
  deliverableTitle: string;
  objective: string;
  description: string;
  existingTasks: ODEExecutionTaskItem[];
  sources: ODEWorkstreamSource[];
  approvedExamplesSummary?: string;
  capabilityGuidanceSummary?: string;
}

export interface GenerateDeliverableProposalInput {
  apiKey: string;
  nodeId: string;
  nodeTitle: string;
  targetLanguage: LanguageCode;
  description: string;
  existingDeliverables: string[];
  sources: ODEWorkstreamSource[];
  approvedExamplesSummary?: string;
  capabilityGuidanceSummary?: string;
}

function normalizeStatus(value: unknown): ScheduleStatus {
  if (value === "active" || value === "blocked" || value === "done") return value;
  return "planned";
}

function buildTaskId(deliverableId: string, index: number): string {
  return `ode-workstream-task-${deliverableId}-${Date.now()}-${index}`;
}

function buildDeliverableId(index: number): string {
  return `ode-deliverable-proposal-${Date.now()}-${index}`;
}

export async function generateDeliverableProposal(
  input: GenerateDeliverableProposalInput
): Promise<ODEDeliverableProposal> {
  const context = buildDeliverablePlanningContext(input);
  const knowledgePack = buildAiKnowledgePack(context);
  const existingDeliverableLines = formatExistingDeliverables(input.existingDeliverables);

  const systemPrompt = [
    "You are ODETool AI deliverable planner.",
    "Return exactly one JSON object and no markdown.",
    "Create only a concise deliverable proposal for the described node.",
    "Use only the provided source evidence.",
    "Keep the output lean, strategic, and business-meaningful.",
    buildAiOutputLanguageInstruction(input.targetLanguage)
  ].join(" ");

  const userPrompt = [
    `Node title: ${input.nodeTitle}`,
    `Description: ${input.description || "(none)"}`,
    "",
    "Existing deliverables:",
    existingDeliverableLines,
    input.capabilityGuidanceSummary?.trim()
      ? ["", input.capabilityGuidanceSummary.trim()].join("\n")
      : "",
    input.approvedExamplesSummary?.trim()
      ? ["", "Approved examples from past accepted plans:", input.approvedExamplesSummary.trim()].join("\n")
      : "",
    "",
    "Available evidence sources:",
    knowledgePack.sourceLines || "(none)",
    "",
    "Return JSON with this exact schema:",
    "{",
    '  "title": "string",',
    '  "summary": "string",',
    '  "confidence": 0.0,',
    '  "source_ids": ["string"],',
    '  "deliverables": [',
    "    {",
    '      "title": "string",',
    '      "rationale": "string | null"',
    "    }",
    "  ]",
    "}",
    "Rules:",
    "- Propose between 3 and 8 deliverables when evidence supports it.",
    "- Keep titles short, clear, and outcome-oriented.",
    "- Do not create tasks, teams, or notifications here.",
    "- Use only source_ids from the provided evidence list.",
    "- No extra keys. No markdown."
  ].join("\n");

  return runStructuredAiPrompt({
    apiKey: input.apiKey,
    intent: "planning_deliverables",
    systemPrompt,
    userPrompt,
    invalidJsonMessage: "AI returned an invalid deliverable proposal.",
    malformedJsonMessage: "AI returned malformed deliverable proposal JSON.",
    parse: (parsed) => {
      const deliverableRecords = Array.isArray(parsed.deliverables) ? parsed.deliverables : [];
      const deliverables = deliverableRecords
        .map((entry, index) => {
          if (!entry || typeof entry !== "object") return null;
          const record = entry as Record<string, unknown>;
          const title = typeof record.title === "string" ? record.title.trim() : "";
          if (!title) return null;
          return {
            id: buildDeliverableId(index),
            title,
            rationale:
              typeof record.rationale === "string" && record.rationale.trim().length > 0 ? record.rationale.trim() : null
          };
        })
        .filter((deliverable): deliverable is NonNullable<typeof deliverable> => Boolean(deliverable));

      if (deliverables.length === 0) {
        throw new Error("AI did not return any usable deliverables.");
      }

      const sourceIds = new Set(
        Array.isArray(parsed.source_ids)
          ? parsed.source_ids
              .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
              .filter((entry) => entry.length > 0)
          : []
      );
      const resolvedSources = context.sources.filter(
        (source) => sourceIds.size === 0 || sourceIds.has(source.sourceId)
      );

      return {
        version: 1,
        nodeId: context.nodeId,
        outputLanguage: context.targetLanguage,
        title:
          typeof parsed.title === "string" && parsed.title.trim().length > 0 ? parsed.title.trim() : context.nodeTitle,
        summary:
          typeof parsed.summary === "string" && parsed.summary.trim().length > 0
            ? parsed.summary.trim()
            : `AI proposed ${deliverables.length} deliverables for ${context.nodeTitle}.`,
        confidence: clampStructuredConfidence(parsed.confidence),
        sources: resolvedSources.length > 0 ? resolvedSources : context.sources,
        deliverables
      };
    }
  });
}

export async function generateWorkstreamTaskProposal(
  input: GenerateWorkstreamTaskProposalInput
): Promise<ODEWorkstreamWorkspaceProposal> {
  const context = buildTaskPlanningContext(input);
  const knowledgePack = buildAiKnowledgePack(context);
  const existingTaskLines = formatExistingTasks(input.existingTasks);

  const systemPrompt = [
    "You are ODETool AI workstream planner.",
    "Return exactly one JSON object and no markdown.",
    "Create only a tasks proposal for the requested deliverable.",
    "Use only the provided source evidence.",
    "Do not invent teams, documents, or sections outside tasks.",
    "Keep the output lean, practical, and execution-focused.",
    buildAiOutputLanguageInstruction(input.targetLanguage)
  ].join(" ");

  const userPrompt = [
    `Node title: ${input.nodeTitle}`,
    `Deliverable: ${input.deliverableTitle}`,
    `Objective: ${input.objective || "(none)"}`,
    `Description: ${input.description || "(none)"}`,
    "",
    "Existing tasks:",
    existingTaskLines,
    input.capabilityGuidanceSummary?.trim()
      ? ["", input.capabilityGuidanceSummary.trim()].join("\n")
      : "",
    input.approvedExamplesSummary?.trim()
      ? ["", "Approved examples from past accepted plans:", input.approvedExamplesSummary.trim()].join("\n")
      : "",
    "",
    "Available evidence sources:",
    knowledgePack.sourceLines || "(none)",
    "",
    "Return JSON with this exact schema:",
    "{",
    '  "title": "string",',
    '  "summary": "string",',
    '  "confidence": 0.0,',
    '  "source_ids": ["string"],',
    '  "tasks": [',
    "    {",
    '      "title": "string",',
    '      "status": "planned | active | blocked | done",',
    '      "flagged": true,',
    '      "owner_name": "string | null",',
    '      "due_date": "YYYY-MM-DD | null",',
    '      "note": "string | null"',
    "    }",
    "  ]",
    "}",
    "Rules:",
    "- Propose between 3 and 10 tasks when evidence supports it.",
    "- Flag only truly critical or sequencing-sensitive tasks.",
    "- Prefer planned unless the evidence clearly says work is already active, blocked, or done.",
    "- Keep titles short and operational.",
    "- Use only source_ids from the provided evidence list.",
    "- No extra keys. No markdown."
  ].join("\n");

  return runStructuredAiPrompt({
    apiKey: input.apiKey,
    intent: "planning_tasks",
    systemPrompt,
    userPrompt,
    invalidJsonMessage: "AI returned an invalid workstream proposal.",
    malformedJsonMessage: "AI returned malformed workstream proposal JSON.",
    parse: (parsed) => {
      const taskRecords = Array.isArray(parsed.tasks) ? parsed.tasks : [];
      const tasks = taskRecords
        .map((entry, index) => {
          if (!entry || typeof entry !== "object") return null;
          const record = entry as Record<string, unknown>;
          const title = typeof record.title === "string" ? record.title.trim() : "";
          if (!title) return null;
          return {
            id: buildTaskId(context.deliverableId ?? input.deliverableId, index),
            title,
            ownerName:
              typeof record.owner_name === "string" && record.owner_name.trim().length > 0
                ? record.owner_name.trim()
                : null,
            dueDate:
              typeof record.due_date === "string" && record.due_date.trim().length > 0 ? record.due_date.trim() : null,
            status: normalizeStatus(record.status),
            flagged: record.flagged === true,
            note: typeof record.note === "string" && record.note.trim().length > 0 ? record.note.trim() : null
          };
        })
        .filter((task): task is NonNullable<typeof task> => Boolean(task));

      if (tasks.length === 0) {
        throw new Error("AI did not return any usable tasks.");
      }

      const sourceIds = new Set(
        Array.isArray(parsed.source_ids)
          ? parsed.source_ids
              .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
              .filter((entry) => entry.length > 0)
          : []
      );
      const resolvedSources = context.sources.filter(
        (source) => sourceIds.size === 0 || sourceIds.has(source.sourceId)
      );

      return {
        version: 1,
        nodeId: context.nodeId,
        deliverableId: context.deliverableId ?? input.deliverableId,
        outputLanguage: context.targetLanguage,
        title:
          typeof parsed.title === "string" && parsed.title.trim().length > 0
            ? parsed.title.trim()
            : context.deliverableTitle || input.deliverableTitle,
        summary:
          typeof parsed.summary === "string" && parsed.summary.trim().length > 0
            ? parsed.summary.trim()
            : `AI prepared ${tasks.length} execution tasks for ${context.deliverableTitle || input.deliverableTitle}.`,
        confidence: clampStructuredConfidence(parsed.confidence),
        sources: resolvedSources.length > 0 ? resolvedSources : context.sources,
        sections: [
          {
            id: `ode-workstream-tasks-${context.deliverableId ?? input.deliverableId}`,
            type: "tasks",
            title: "Tasks",
            collapsed: false,
            reasoning: `AI-generated from ${Math.max(1, resolvedSources.length || context.sources.length)} evidence source(s).`,
            items: tasks
          }
        ]
      };
    }
  });
}
