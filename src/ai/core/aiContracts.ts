export type AiEngine = "cloud" | "local";

import type { AiPromptMessageContentPart } from "@/lib/aiCommandAttachments";
import type { SupportedAiProviderId } from "@/lib/aiProviderKeys";

export interface AiPromptAnalysisRequest {
  apiKey: string;
  providerId?: SupportedAiProviderId;
  systemPrompt: string;
  userPrompt: string;
  userContent?: AiPromptMessageContentPart[];
  aiEngine?: AiEngine;
}

export interface AiTicketAnalysisRequest {
  apiKey: string;
  providerId?: SupportedAiProviderId;
  nodeId: string;
  aiEngine?: AiEngine;
}

export interface AiTicketReplyRequest {
  apiKey: string;
  providerId?: SupportedAiProviderId;
  nodeId: string;
  instructions: string;
  aiEngine?: AiEngine;
}

export interface AiProvider {
  runPromptAnalysis(input: AiPromptAnalysisRequest): Promise<string>;
  analyzeTicket(input: AiTicketAnalysisRequest): Promise<string>;
  generateTicketReply(input: AiTicketReplyRequest): Promise<string>;
}
