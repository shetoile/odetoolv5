import type { WBSNode } from "@/lib/aiService";

export const getDocumentTreeProposalNodeKey = (parentKey: string, index: number): string =>
  parentKey ? `${parentKey}.${index + 1}` : `${index + 1}`;

export const collectDocumentTreeProposalNodeKeys = (nodes: WBSNode[], parentKey = ""): string[] => {
  const keys: string[] = [];
  nodes.forEach((node, index) => {
    const nodeKey = getDocumentTreeProposalNodeKey(parentKey, index);
    keys.push(nodeKey);
    if (node.children.length > 0) {
      keys.push(...collectDocumentTreeProposalNodeKeys(node.children, nodeKey));
    }
  });
  return keys;
};

export const collectDocumentTreeProposalBranchKeys = (
  nodes: WBSNode[],
  targetKey: string,
  parentKey = ""
): string[] => {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const nodeKey = getDocumentTreeProposalNodeKey(parentKey, index);
    if (nodeKey === targetKey) {
      return [nodeKey, ...collectDocumentTreeProposalNodeKeys(node.children, nodeKey)];
    }
    if (node.children.length > 0) {
      const nested = collectDocumentTreeProposalBranchKeys(node.children, targetKey, nodeKey);
      if (nested.length > 0) {
        return nested;
      }
    }
  }
  return [];
};

export const filterDocumentTreeProposalNodes = (
  nodes: WBSNode[],
  selectedKeys: ReadonlySet<string>,
  parentKey = ""
): WBSNode[] =>
  nodes.flatMap((node, index) => {
    const nodeKey = getDocumentTreeProposalNodeKey(parentKey, index);
    if (!selectedKeys.has(nodeKey)) {
      return [];
    }
    return [
      {
        ...node,
        children: filterDocumentTreeProposalNodes(node.children, selectedKeys, nodeKey)
      }
    ];
  });
