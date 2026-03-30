import { type WBSNode } from "@/lib/aiService";

export function formatWbsNodesForPrompt(nodes: WBSNode[], depth = 0): string[] {
  const lines: string[] = [];
  for (const node of nodes) {
    const prefix = `${"  ".repeat(depth)}- `;
    const metaParts = [node.suggested_role, node.estimated_effort]
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    lines.push(`${prefix}${node.title}${metaParts.length > 0 ? ` [${metaParts.join(" | ")}]` : ""}`);
    if (node.description?.trim()) {
      lines.push(`${"  ".repeat(depth + 1)}description: ${node.description.trim()}`);
    }
    if (node.objective?.trim()) {
      lines.push(`${"  ".repeat(depth + 1)}objective: ${node.objective.trim()}`);
    }
    if (node.expected_deliverables && node.expected_deliverables.length > 0) {
      lines.push(
        `${"  ".repeat(depth + 1)}deliverables: ${node.expected_deliverables
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
          .join("; ")}`
      );
    }
    if (node.children.length > 0) {
      lines.push(...formatWbsNodesForPrompt(node.children, depth + 1));
    }
  }
  return lines;
}
