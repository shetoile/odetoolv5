import type {
  AiEngine,
  AiPromptAnalysisRequest,
  AiProvider,
  AiTicketAnalysisRequest,
  AiTicketReplyRequest
} from "@/ai/core/aiContracts";
import { nativeAiProvider } from "@/ai/core/aiProvider";

const DEFAULT_CLOUD_ENGINE: AiEngine = "cloud";

export interface AiOrchestrator {
  runPromptAnalysis(input: AiPromptAnalysisRequest): Promise<string>;
  analyzeTicket(input: AiTicketAnalysisRequest): Promise<string>;
  generateTicketReply(input: AiTicketReplyRequest): Promise<string>;
}

export function createAiOrchestrator(provider: AiProvider = nativeAiProvider): AiOrchestrator {
  return {
    runPromptAnalysis(input) {
      return provider.runPromptAnalysis({
        ...input,
        aiEngine: input.aiEngine ?? DEFAULT_CLOUD_ENGINE
      });
    },
    analyzeTicket(input) {
      return provider.analyzeTicket({
        ...input,
        aiEngine: input.aiEngine ?? DEFAULT_CLOUD_ENGINE
      });
    },
    generateTicketReply(input) {
      return provider.generateTicketReply({
        ...input,
        aiEngine: input.aiEngine ?? DEFAULT_CLOUD_ENGINE
      });
    }
  };
}

export const aiOrchestrator = createAiOrchestrator();

export function runAiPromptAnalysis(input: AiPromptAnalysisRequest): Promise<string> {
  return aiOrchestrator.runPromptAnalysis(input);
}

export function analyzeTicketWithAi(input: AiTicketAnalysisRequest): Promise<string> {
  return aiOrchestrator.analyzeTicket(input);
}

export function generateTicketReplyWithAi(input: AiTicketReplyRequest): Promise<string> {
  return aiOrchestrator.generateTicketReply(input);
}
