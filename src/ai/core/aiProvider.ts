import { AI_REBUILD_DISABLED_MESSAGE } from "@/ai/rebuild/status";
import { callNative } from "@/lib/tauriApi";
import type {
  AiPromptAnalysisRequest,
  AiProvider,
  AiTicketAnalysisRequest,
  AiTicketReplyRequest
} from "@/ai/core/aiContracts";

function throwLegacyAiDisabled(): never {
  throw new Error(AI_REBUILD_DISABLED_MESSAGE);
}

export const nativeAiProvider: AiProvider = {
  async runPromptAnalysis(input: AiPromptAnalysisRequest): Promise<string> {
    return callNative<string>("run_mistral_tree_analysis", {
      apiKey: input.apiKey,
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      aiEngine: input.aiEngine ?? "cloud"
    });
  },
  async analyzeTicket(input: AiTicketAnalysisRequest): Promise<string> {
    void input;
    return throwLegacyAiDisabled();
  },
  async generateTicketReply(input: AiTicketReplyRequest): Promise<string> {
    void input;
    return throwLegacyAiDisabled();
  }
};
