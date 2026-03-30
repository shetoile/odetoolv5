export type AiEngine = "cloud" | "local";

export interface AiPromptAnalysisRequest {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  aiEngine?: AiEngine;
}

export interface AiTicketAnalysisRequest {
  apiKey: string;
  nodeId: string;
  aiEngine?: AiEngine;
}

export interface AiTicketReplyRequest {
  apiKey: string;
  nodeId: string;
  instructions: string;
  aiEngine?: AiEngine;
}

export interface AiProvider {
  runPromptAnalysis(input: AiPromptAnalysisRequest): Promise<string>;
  analyzeTicket(input: AiTicketAnalysisRequest): Promise<string>;
  generateTicketReply(input: AiTicketReplyRequest): Promise<string>;
}
