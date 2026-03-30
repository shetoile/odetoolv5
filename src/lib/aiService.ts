import {
  generateAiWorkBreakdown,
  generateChantierWBS,
  getWbsEstimatedEffortPoints,
  translateWbsResult
} from "@/ai/wbs/wbsGenerator";
import type {
  GenerateChantierWbsOptions,
  GenerateWbsOptions,
  GenerateWbsResult,
  TranslateWbsOptions,
  TranslateWbsResult,
  WBSNode,
  WBSResult,
  WbsProgressStage,
  WbsPromptPreset
} from "@/ai/wbs/wbsTypes";
import { buildNAMatchResult } from "@/lib/naCatalog";
import type { NAMatchResult } from "@/lib/types";

export type MapifySourceType = "youtube" | "pdf" | "web_article" | "whiteboard_photo";

export interface MapifySource {
  type: MapifySourceType;
  value: string;
}

export type {
  GenerateChantierWbsOptions,
  GenerateWbsOptions,
  GenerateWbsResult,
  TranslateWbsOptions,
  TranslateWbsResult,
  WBSNode,
  WBSResult,
  WbsProgressStage,
  WbsPromptPreset
};

export interface MapToNAOptions {
  topK?: number;
}

export async function mapToNA(input: string, options?: MapToNAOptions): Promise<NAMatchResult> {
  return buildNAMatchResult(input, options?.topK ?? 5);
}

export { generateAiWorkBreakdown, generateChantierWBS, getWbsEstimatedEffortPoints, translateWbsResult };
