import type { LanguageCode } from "@/lib/i18n";

export interface WBSNode {
  title: string;
  description?: string;
  objective?: string;
  expected_deliverables?: string[];
  prerequisites: string[];
  estimated_effort: string;
  suggested_role: string;
  value_milestone: boolean;
  source_code?: string;
  children: WBSNode[];
}

export interface WBSResult {
  goal: string;
  value_summary: string;
  nodes: WBSNode[];
}

export type WbsProgressStage =
  | "understand_goal"
  | "build_prompt"
  | "request_ai"
  | "validate_json"
  | "normalize_tree"
  | "fallback";

export type WbsPromptPreset = "generic" | "chantier" | "document_tree";

export interface GenerateWbsOptions {
  goal: string;
  context?: string;
  targetLanguage?: LanguageCode;
  apiKey?: string;
  aiEngine?: "cloud" | "local";
  maxDepth?: number;
  maxChildrenPerNode?: number;
  promptPreset?: WbsPromptPreset;
  fallbackResult?: WBSResult;
  onProgress?: (stage: WbsProgressStage) => void;
}

export interface GenerateWbsResult {
  result: WBSResult;
  source: "llm" | "fallback";
  raw: string;
  warning?: string;
}

export interface GenerateChantierWbsOptions {
  goal: string;
  naCode: string;
  naLabel: string;
  naPathLabel?: string;
  sourceName?: string;
  context?: string;
  targetLanguage?: LanguageCode;
  apiKey?: string;
  aiEngine?: "cloud" | "local";
  maxDepth?: number;
  maxChildrenPerNode?: number;
  onProgress?: (stage: WbsProgressStage) => void;
}

export interface TranslateWbsOptions {
  result: WBSResult;
  targetLanguage: LanguageCode;
  sourceLanguage?: LanguageCode;
  apiKey?: string;
  aiEngine?: "cloud" | "local";
}

export interface TranslateWbsResult {
  result: WBSResult;
  source: "llm" | "original";
  raw: string;
  warning?: string;
  targetLanguage: LanguageCode;
}
