import type { AiModelGateway, AiModelGatewayRequest, AiModelGatewayResponse } from "./contracts";
import { AI_REBUILD_DISABLED_MESSAGE, getAiRebuildStatus } from "../status";

export const rebuildGateway: AiModelGateway = {
  async run(_request: AiModelGatewayRequest): Promise<AiModelGatewayResponse> {
    const status = await getAiRebuildStatus().catch(() => null);
    throw new Error(status?.message ?? AI_REBUILD_DISABLED_MESSAGE);
  }
};
