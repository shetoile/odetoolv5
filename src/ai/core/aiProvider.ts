import { AI_REBUILD_DISABLED_MESSAGE } from "@/ai/rebuild/status";
import { callNative } from "@/lib/tauriApi";
import { decodeAiAccessToken } from "@/lib/aiProviderKeys";
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
    const decoded = decodeAiAccessToken(input.apiKey);
    return callNative<string>("run_ai_tree_analysis", {
      apiKey: decoded.apiKey,
      providerId: input.providerId ?? decoded.providerId ?? null,
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      userContent: input.userContent ?? null,
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
