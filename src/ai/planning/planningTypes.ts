import type { LanguageCode } from "@/lib/i18n";
import type { ODEExecutionTaskItem, ODEWorkstreamSource } from "@/lib/types";

export interface AiPlanningContext {
  nodeId: string;
  nodeTitle: string;
  description: string;
  targetLanguage: LanguageCode;
  objective?: string;
  deliverableId?: string | null;
  deliverableTitle?: string | null;
  existingDeliverables?: string[];
  existingTasks?: ODEExecutionTaskItem[];
  sources: ODEWorkstreamSource[];
}

export interface AiKnowledgePack {
  sources: ODEWorkstreamSource[];
  sourceLines: string;
  sourceCount: number;
}

export interface AiStructurePlanningContext {
  goal: string;
  context: string;
  targetLanguage?: LanguageCode;
  promptPreset?: string | null;
  maxDepth: number;
  maxChildrenPerNode: number;
}
