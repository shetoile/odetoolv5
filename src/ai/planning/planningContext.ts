import type { ODEExecutionTaskItem, ODEWorkstreamSource } from "@/lib/types";
import type { LanguageCode } from "@/lib/i18n";
import type { AiKnowledgePack, AiPlanningContext, AiStructurePlanningContext } from "@/ai/planning/planningTypes";

type DeliverablePlanningContextInput = {
  nodeId: string;
  nodeTitle: string;
  description: string;
  targetLanguage: LanguageCode;
  existingDeliverables: string[];
  sources: ODEWorkstreamSource[];
};

type TaskPlanningContextInput = {
  nodeId: string;
  nodeTitle: string;
  deliverableId: string;
  deliverableTitle: string;
  objective: string;
  description: string;
  targetLanguage: LanguageCode;
  existingTasks: ODEExecutionTaskItem[];
  sources: ODEWorkstreamSource[];
};

type StructurePlanningContextInput = {
  goal: string;
  context?: string;
  targetLanguage?: LanguageCode;
  promptPreset?: string | null;
  maxDepth: number;
  maxChildrenPerNode: number;
};

export function buildDeliverablePlanningContext(input: DeliverablePlanningContextInput): AiPlanningContext {
  return {
    nodeId: input.nodeId,
    nodeTitle: input.nodeTitle,
    description: input.description,
    targetLanguage: input.targetLanguage,
    existingDeliverables: input.existingDeliverables,
    sources: input.sources
  };
}

export function buildTaskPlanningContext(input: TaskPlanningContextInput): AiPlanningContext {
  return {
    nodeId: input.nodeId,
    nodeTitle: input.nodeTitle,
    deliverableId: input.deliverableId,
    deliverableTitle: input.deliverableTitle,
    objective: input.objective,
    description: input.description,
    targetLanguage: input.targetLanguage,
    existingTasks: input.existingTasks,
    sources: input.sources
  };
}

export function buildStructurePlanningContext(input: StructurePlanningContextInput): AiStructurePlanningContext {
  return {
    goal: input.goal.trim(),
    context: input.context?.trim() ?? "",
    targetLanguage: input.targetLanguage,
    promptPreset: input.promptPreset ?? null,
    maxDepth: input.maxDepth,
    maxChildrenPerNode: input.maxChildrenPerNode
  };
}

export function buildAiKnowledgePack(context: Pick<AiPlanningContext, "sources">): AiKnowledgePack {
  const sourceLines = context.sources
    .map((source) => {
      const excerpt =
        typeof source.excerpt === "string" && source.excerpt.trim().length > 0 ? `\n${source.excerpt.trim()}` : "";
      return `[${source.sourceId}] kind=${source.kind} label=${source.label}${excerpt}`;
    })
    .join("\n\n");

  return {
    sources: context.sources,
    sourceLines,
    sourceCount: context.sources.length
  };
}

export function formatExistingDeliverables(existingDeliverables: string[]): string {
  return existingDeliverables.length > 0 ? existingDeliverables.map((item) => `- ${item}`).join("\n") : "(none)";
}

export function formatExistingTasks(existingTasks: ODEExecutionTaskItem[]): string {
  return existingTasks.length > 0
    ? existingTasks.map((task) => `- ${task.title.trim()}`).join("\n")
    : "(none)";
}

export function formatStructurePlanningContext(context: Pick<AiStructurePlanningContext, "context">): string {
  return context.context.trim() || "(none)";
}
