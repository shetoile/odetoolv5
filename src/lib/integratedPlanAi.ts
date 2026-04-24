import type {
  ODEDeliverableProposalItem,
  ODEStructuredDeliverable,
  ODEIntegratedPlanProposal,
  ODEIntegratedPlanProposalItem,
  ODEWorkstreamSource
} from "@/lib/types";
import type { AiCommandAttachment } from "@/lib/aiCommandAttachments";
import type { LanguageCode } from "@/lib/i18n";
import {
  buildApprovedIntegratedPlanExamplesSummary,
  findRelevantApprovedIntegratedPlans
} from "@/lib/aiMemory";
import { buildAiCapabilityGuidance, buildAiCapabilityPromptBlock } from "@/lib/aiCapabilityGuidance";
import { generateDeliverableProposal, generateWorkstreamTaskProposal } from "@/lib/workstreamAi";

export interface GenerateIntegratedPlanProposalInput {
  apiKey: string;
  nodeId: string;
  nodeTitle: string;
  targetLanguage: LanguageCode;
  description: string;
  objective: string;
  existingDeliverables: ODEStructuredDeliverable[];
  deliverableSources: ODEWorkstreamSource[];
  promptAttachments?: AiCommandAttachment[];
  buildTaskSources: (deliverable: ODEDeliverableProposalItem) => ODEWorkstreamSource[];
}

function buildDeliverableLookup(deliverables: ODEStructuredDeliverable[]): Map<string, ODEStructuredDeliverable> {
  const lookup = new Map<string, ODEStructuredDeliverable>();
  for (const deliverable of deliverables) {
    const normalizedTitle = deliverable.title.trim().toLowerCase();
    if (!normalizedTitle || lookup.has(normalizedTitle)) continue;
    lookup.set(normalizedTitle, deliverable);
  }
  return lookup;
}

function mergeSources(sourceGroups: ODEWorkstreamSource[][]): ODEWorkstreamSource[] {
  const merged = new Map<string, ODEWorkstreamSource>();
  for (const group of sourceGroups) {
    for (const source of group) {
      if (!merged.has(source.sourceId)) {
        merged.set(source.sourceId, source);
      }
    }
  }
  return Array.from(merged.values());
}

function averageConfidence(values: number[]): number {
  if (values.length === 0) return 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.max(0, Math.min(1, total / values.length));
}

export async function generateIntegratedPlanProposal(
  input: GenerateIntegratedPlanProposalInput
): Promise<ODEIntegratedPlanProposal> {
  const existingDeliverableLookup = buildDeliverableLookup(input.existingDeliverables);
  const approvedExamples = findRelevantApprovedIntegratedPlans({
    nodeTitle: input.nodeTitle,
    description: input.description,
    objective: input.objective,
    targetLanguage: input.targetLanguage,
    limit: 3
  });
  const approvedExamplesSummary = buildApprovedIntegratedPlanExamplesSummary(approvedExamples);
  const capabilityMatch = buildAiCapabilityGuidance({
    nodeTitle: input.nodeTitle,
    description: input.description,
    objective: input.objective,
    sources: input.deliverableSources,
    limit: 4
  });
  const capabilityGuidanceSummary = buildAiCapabilityPromptBlock(capabilityMatch);
  const deliverableProposal = await generateDeliverableProposal({
    apiKey: input.apiKey,
    nodeId: input.nodeId,
    nodeTitle: input.nodeTitle,
    targetLanguage: input.targetLanguage,
    description: input.description,
    existingDeliverables: input.existingDeliverables.map((deliverable) => deliverable.title.trim()).filter((title) => title.length > 0),
    sources: input.deliverableSources,
    approvedExamplesSummary,
    capabilityGuidanceSummary,
    promptAttachments: input.promptAttachments
  });

  const deliverablePlans: ODEIntegratedPlanProposalItem[] = [];
  for (const deliverable of deliverableProposal.deliverables) {
    const matchedExistingDeliverable = existingDeliverableLookup.get(deliverable.title.trim().toLowerCase()) ?? null;
    const taskProposal = await generateWorkstreamTaskProposal({
      apiKey: input.apiKey,
      nodeId: input.nodeId,
      nodeTitle: input.nodeTitle,
      targetLanguage: input.targetLanguage,
      deliverableId: deliverable.id,
      deliverableTitle: deliverable.title,
      objective: input.objective,
      description: input.description,
      existingTasks: matchedExistingDeliverable?.tasks ?? [],
      sources: input.buildTaskSources(deliverable),
      capabilityGuidanceSummary,
      promptAttachments: input.promptAttachments,
      approvedExamplesSummary: buildApprovedIntegratedPlanExamplesSummary(approvedExamples, {
        deliverableTitle: deliverable.title,
        maxExamples: 2,
        maxDeliverablesPerExample: 2,
        maxTasksPerDeliverable: 5,
        maxChars: 2200
      })
    });

    deliverablePlans.push({
      id: deliverable.id,
      title: deliverable.title,
      rationale: deliverable.rationale ?? null,
      taskProposal
    });
  }

  const totalTaskCount = deliverablePlans.reduce((total, deliverable) => {
    const tasksSection = deliverable.taskProposal.sections.find((section) => section.type === "tasks");
    return total + (tasksSection?.items.length ?? 0);
  }, 0);

  return {
    version: 1,
    nodeId: input.nodeId,
    outputLanguage: input.targetLanguage,
    title: deliverableProposal.title,
    summary: `AI prepared ${deliverablePlans.length} deliverable(s) and ${totalTaskCount} starter task(s) for ${input.nodeTitle}.`,
    confidence: averageConfidence([
      deliverableProposal.confidence,
      ...deliverablePlans.map((deliverable) => deliverable.taskProposal.confidence)
    ]),
    sources: mergeSources([
      deliverableProposal.sources,
      ...deliverablePlans.map((deliverable) => deliverable.taskProposal.sources)
    ]),
    capabilityMatch,
    approvedExamplesUsed: approvedExamples.map((entry) => ({
      id: entry.id,
      nodeTitle: entry.nodeTitle,
      approvedAt: entry.approvedAt,
      structureTitles: entry.structureTitles.slice(0, 8),
      deliverableTitles: entry.deliverables.map((deliverable) => deliverable.title).slice(0, 6)
    })),
    structure: {
      goal: input.nodeTitle,
      summary: "",
      source: "fallback",
      warning: undefined,
      nodes: []
    },
    deliverables: deliverablePlans
  };
}
