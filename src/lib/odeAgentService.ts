import type { WBSNode } from "@/lib/aiService";
import type { ODEImportPreview } from "@/lib/types";

export interface BuildODEImportPreviewInput {
  targetNodeId: string | null;
  targetNA: string | null;
  targetLabel: string | null;
  confidence: number;
  warnings?: string[];
  chantierTitle: string | null;
  nodes: WBSNode[];
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function normalizeWarnings(warnings: string[] | undefined): string[] {
  if (!warnings) return [];
  const seen = new Set<string>();
  const next: string[] = [];
  for (const warning of warnings) {
    const trimmed = warning.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    next.push(trimmed);
  }
  return next;
}

export function countPlannedNodes(nodes: WBSNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countPlannedNodes(node.children), 0);
}

export function buildODEImportPreview(input: BuildODEImportPreviewInput): ODEImportPreview {
  return {
    targetNodeId: input.targetNodeId,
    targetNA: input.targetNA,
    targetLabel: input.targetLabel,
    confidence: clampConfidence(input.confidence),
    warnings: normalizeWarnings(input.warnings),
    chantierTitle: input.chantierTitle?.trim() || null,
    estimatedNodeCount: countPlannedNodes(input.nodes) + 2
  };
}
