import { type WBSNode, type WBSResult } from "@/lib/aiService";
import { buildNAMatchResult, getNAByCode } from "@/lib/naCatalog";

function normalizeDocumentAdvisorCatalogText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['â€™]/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cloneDocumentAdvisorWbsNode(node: WBSNode): WBSNode {
  return {
    ...node,
    prerequisites: [...node.prerequisites],
    expected_deliverables: [...(node.expected_deliverables ?? [])],
    children: node.children.map(cloneDocumentAdvisorWbsNode)
  };
}

function buildDocumentAdvisorCatalogPathNode(
  title: string,
  sourceCode: string | undefined,
  seed?: WBSNode
): WBSNode {
  return {
    title,
    description: "",
    objective: "",
    expected_deliverables: [],
    prerequisites: [],
    estimated_effort: seed?.estimated_effort ?? "S",
    suggested_role: seed?.suggested_role ?? "Responsable",
    value_milestone: false,
    source_code: sourceCode,
    children: []
  };
}

function findMatchingDocumentAdvisorWbsNode(
  nodes: WBSNode[],
  title: string,
  sourceCode?: string
): WBSNode | null {
  const normalizedTitle = normalizeDocumentAdvisorCatalogText(title);
  for (const candidate of nodes) {
    if (sourceCode && candidate.source_code && candidate.source_code === sourceCode) {
      return candidate;
    }
    if (normalizeDocumentAdvisorCatalogText(candidate.title) === normalizedTitle) {
      return candidate;
    }
  }
  return null;
}

function mergeDocumentAdvisorWbsNodes(target: WBSNode, incoming: WBSNode) {
  if ((!target.description || target.description.trim().length === 0) && incoming.description?.trim()) {
    target.description = incoming.description.trim();
  }
  if ((!target.objective || target.objective.trim().length === 0) && incoming.objective?.trim()) {
    target.objective = incoming.objective.trim();
  }
  if ((!target.source_code || target.source_code.trim().length === 0) && incoming.source_code?.trim()) {
    target.source_code = incoming.source_code.trim();
  }
  if ((!target.suggested_role || target.suggested_role.trim().length === 0) && incoming.suggested_role?.trim()) {
    target.suggested_role = incoming.suggested_role.trim();
  }
  if ((!target.estimated_effort || target.estimated_effort.trim().length === 0) && incoming.estimated_effort?.trim()) {
    target.estimated_effort = incoming.estimated_effort.trim();
  }
  target.value_milestone = target.value_milestone || incoming.value_milestone;
  target.prerequisites = Array.from(
    new Set([...target.prerequisites, ...incoming.prerequisites].map((entry) => entry.trim()).filter((entry) => entry.length > 0))
  );
  target.expected_deliverables = Array.from(
    new Set(
      [...(target.expected_deliverables ?? []), ...(incoming.expected_deliverables ?? [])]
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    )
  );
  target.children.push(...incoming.children);
}

function maybeCanonicalizeDocumentAdvisorLeafTitle(title: string, code: string, label: string): string {
  const normalizedTitle = normalizeDocumentAdvisorCatalogText(title);
  const normalizedLabel = normalizeDocumentAdvisorCatalogText(label);
  if (!normalizedTitle || !normalizedLabel) return title;
  if (normalizedTitle === normalizedLabel) return label;
  if (normalizedTitle.includes(normalizedLabel) && title.trim().length > label.trim().length + 10) {
    return label;
  }
  const entry = getNAByCode(code);
  const matchingAlias = entry?.aliases.find(
    (alias) => normalizeDocumentAdvisorCatalogText(alias) && normalizedTitle.includes(normalizeDocumentAdvisorCatalogText(alias))
  );
  if (matchingAlias && label.trim().length <= title.trim().length) {
    return label;
  }
  return title;
}

export function normalizeDocumentAdvisorTreeForCatalog(
  result: WBSResult,
  options?: { enabled?: boolean; }
): WBSResult {
  if (!options?.enabled || result.nodes.length === 0) {
    return result;
  }

  const roots = result.nodes.map(cloneDocumentAdvisorWbsNode);
  const detachedRoots = [...roots];

  for (const detached of detachedRoots) {
    const matchInput = [
      detached.title,
      detached.description ?? "",
      detached.objective ?? "",
      ...(detached.expected_deliverables ?? [])
    ]
      .join(" ")
      .trim();
    const match = buildNAMatchResult(matchInput, 3);
    if (!match.recommendedCode || match.confidence < 0.64) {
      continue;
    }
    const entry = getNAByCode(match.recommendedCode);
    if (!entry || entry.pathLabels.length === 0) {
      continue;
    }

    const normalizedDetachedTitle = normalizeDocumentAdvisorCatalogText(detached.title);
    if (entry.pathLabels.some((label) => normalizeDocumentAdvisorCatalogText(label) === normalizedDetachedTitle)) {
      continue;
    }

    const detachedIndex = roots.indexOf(detached);
    if (detachedIndex >= 0) {
      roots.splice(detachedIndex, 1);
    }

    const ancestorCodes = [
      match.recommendedCode.slice(0, 1),
      match.recommendedCode.slice(0, 2),
      match.recommendedCode.slice(0, 3)
    ];

    let siblings = roots;
    for (let level = 0; level < entry.pathLabels.length; level += 1) {
      const pathLabel = entry.pathLabels[level];
      const ancestorCode = ancestorCodes[level];
      let pathNode = findMatchingDocumentAdvisorWbsNode(siblings, pathLabel, ancestorCode);
      if (!pathNode) {
        pathNode = buildDocumentAdvisorCatalogPathNode(pathLabel, ancestorCode, detached);
        siblings.push(pathNode);
      }
      siblings = pathNode.children;
    }

    detached.source_code = detached.source_code?.trim() ? detached.source_code : match.recommendedCode;
    detached.title = maybeCanonicalizeDocumentAdvisorLeafTitle(detached.title, match.recommendedCode, entry.label);

    const existingLeaf =
      findMatchingDocumentAdvisorWbsNode(siblings, detached.title, detached.source_code) ??
      findMatchingDocumentAdvisorWbsNode(siblings, entry.label, match.recommendedCode);

    if (existingLeaf) {
      mergeDocumentAdvisorWbsNodes(existingLeaf, detached);
    } else {
      siblings.push(detached);
    }
  }

  return {
    ...result,
    nodes: roots
  };
}
