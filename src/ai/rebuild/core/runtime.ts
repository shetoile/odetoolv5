import type {
  AiModelGateway,
  AiPolicyGate,
  AiTelemetrySink,
  AiWorkflowDefinition,
  AiWorkflowId,
  AiWorkflowRequest,
  AiWorkflowResult
} from "./contracts";

type AiRuntimeWorkflowRegistry = Map<AiWorkflowId, AiWorkflowDefinition>;

export function createAiRuntime(args: {
  registry: AiRuntimeWorkflowRegistry;
  gateway: AiModelGateway;
  telemetry?: AiTelemetrySink;
  policy?: AiPolicyGate;
}) {
  const { registry, gateway, telemetry, policy } = args;

  return {
    async run<TInput = unknown, TOutput = unknown>(
      request: AiWorkflowRequest<TInput>
    ): Promise<AiWorkflowResult<TOutput>> {
      const workflow = registry.get(request.workflowId);
      if (!workflow) {
        throw new Error(`Unknown AI workflow: ${request.workflowId}`);
      }

      telemetry?.record({
        workflowId: request.workflowId,
        stage: "start"
      });

      try {
        await policy?.allow(request);
        const prepared = await workflow.prepare(request);
        const result = await workflow.execute({
          request,
          prepared,
          gateway
        });

        telemetry?.record({
          workflowId: request.workflowId,
          stage: "success"
        });

        return result as AiWorkflowResult<TOutput>;
      } catch (error) {
        telemetry?.record({
          workflowId: request.workflowId,
          stage: "failure",
          detail: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    }
  };
}
