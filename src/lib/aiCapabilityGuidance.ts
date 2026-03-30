import { buildNAMatchResult, getNAPathLabel } from "@/lib/naCatalog";
import type { NAMatchResult, ODEWorkstreamSource } from "@/lib/types";

export interface AiCapabilityGuidanceInput {
  nodeTitle: string;
  description: string;
  objective?: string;
  sources?: ODEWorkstreamSource[];
  limit?: number;
}

function trimForGuidance(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit).trim()}...`;
}

function buildCapabilitySearchText(input: AiCapabilityGuidanceInput): string {
  const sourceFragments = (input.sources ?? [])
    .slice(0, 8)
    .map((source) => [source.label.trim(), trimForGuidance(source.excerpt ?? "", 220)].filter((item) => item.length > 0).join(" "))
    .filter((item) => item.length > 0);

  return [
    input.nodeTitle.trim(),
    input.description.trim(),
    input.objective?.trim() ?? "",
    ...sourceFragments
  ]
    .filter((item) => item.length > 0)
    .join("\n");
}

export function buildAiCapabilityGuidance(input: AiCapabilityGuidanceInput): NAMatchResult | null {
  const searchText = buildCapabilitySearchText(input);
  if (!searchText.trim()) return null;
  const result = buildNAMatchResult(searchText, input.limit ?? 4);
  if (!result.recommendedCode && result.candidates.length === 0) return null;
  return result;
}

export function buildAiCapabilityPromptBlock(match: NAMatchResult | null): string {
  if (!match) return "";

  const lines: string[] = ["Business capability guidance:"];
  if (match.recommendedCode) {
    const pathLabel = getNAPathLabel(match.recommendedCode);
    lines.push(`- Recommended capability: ${pathLabel ?? match.recommendedCode}`);
    lines.push(`- Confidence: ${Math.round(match.confidence * 100)}%`);
  } else {
    lines.push("- No single capability is dominant. Use the closest candidates below as guidance.");
  }

  if (match.candidates.length > 0) {
    lines.push("- Relevant ODE capabilities:");
    for (const candidate of match.candidates.slice(0, 4)) {
      const pathLabel = getNAPathLabel(candidate.code) ?? `${candidate.code} ${candidate.label}`;
      lines.push(`  - ${pathLabel} (${candidate.reason})`);
    }
  }

  lines.push("- Stay aligned with these capabilities when the evidence supports it.");
  return lines.join("\n");
}
