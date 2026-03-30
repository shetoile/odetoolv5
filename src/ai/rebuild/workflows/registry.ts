import type { AiWorkflowDefinition, AiWorkflowId } from "../core/contracts";

export type AiWorkflowRegistry = Map<AiWorkflowId, AiWorkflowDefinition>;

export function createWorkflowRegistry(workflows: AiWorkflowDefinition[]): AiWorkflowRegistry {
  const registry: AiWorkflowRegistry = new Map();
  for (const workflow of workflows) {
    registry.set(workflow.id, workflow);
  }
  return registry;
}
