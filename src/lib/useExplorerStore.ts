import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createNode,
  getAllNodes,
  getAncestors,
  getChildren,
  renameNode,
  searchNodes
} from "@/lib/nodeService";
import { ROOT_PARENT_ID, isFileLikeNode, type AppNode } from "@/lib/types";

const LOCAL_SEARCH_RESULT_LIMIT = 80;
const LOCAL_SEARCH_CONTENT_LIMIT = 4000;

async function loadTreeRecursively(parentId: string | null): Promise<AppNode[]> {
  const directChildren = await getChildren(parentId);
  const nested = await Promise.all(directChildren.map((node) => loadTreeRecursively(node.id)));
  return directChildren.concat(...nested);
}

function sortNodesByOrder(nodes: AppNode[]): AppNode[] {
  return nodes.slice().sort((left, right) => {
    if (left.order !== right.order) return left.order - right.order;
    if (left.updatedAt !== right.updatedAt) return right.updatedAt - left.updatedAt;
    return left.name.localeCompare(right.name);
  });
}

function normalizeFolderId(folderId: string | null): string {
  return folderId ?? ROOT_PARENT_ID;
}

function buildLocalSearchContent(node: AppNode): string {
  const raw = typeof node.content === "string" ? node.content.trim() : "";
  if (!raw) return "";
  return raw.length > LOCAL_SEARCH_CONTENT_LIMIT ? raw.slice(0, LOCAL_SEARCH_CONTENT_LIMIT) : raw;
}

function buildLocalSearchPath(node: AppNode, nodeById: Map<string, AppNode>): string {
  const names = [node.name];
  const visited = new Set<string>();
  let currentParentId = node.parentId;

  while (currentParentId !== ROOT_PARENT_ID && currentParentId.trim().length > 0) {
    if (visited.has(currentParentId)) break;
    visited.add(currentParentId);
    const parent = nodeById.get(currentParentId);
    if (!parent) break;
    names.push(parent.name);
    currentParentId = parent.parentId;
  }

  names.reverse();
  return names.join(" / ");
}

function collectReachableNodeIds(nodes: AppNode[]): Set<string> {
  const byParent = new Map<string, AppNode[]>();
  nodes.forEach((node) => {
    const siblings = byParent.get(node.parentId) ?? [];
    siblings.push(node);
    byParent.set(node.parentId, siblings);
  });

  const reachable = new Set<string>();
  const stack = [...(byParent.get(ROOT_PARENT_ID) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || reachable.has(current.id)) continue;
    reachable.add(current.id);
    const children = byParent.get(current.id) ?? [];
    children.forEach((child) => stack.push(child));
  }
  return reachable;
}

function scoreLocalSearchMatch(
  node: AppNode,
  normalizedQuery: string,
  queryTerms: string[],
  nodeById: Map<string, AppNode>
) {
  if (!normalizedQuery || queryTerms.length === 0) return null;

  const name = node.name.toLowerCase();
  const path = buildLocalSearchPath(node, nodeById).toLowerCase();
  const nodeType = node.type.toLowerCase();
  const contentType = (node.contentType ?? "").toLowerCase();
  const description = (node.description ?? "").toLowerCase();
  const content = buildLocalSearchContent(node).toLowerCase();
  const primaryText = `${name}\n${path}\n${description}`;
  const secondaryText = `${nodeType}\n${contentType}\n${content}`;
  const primaryMatch =
    primaryText.includes(normalizedQuery) || queryTerms.every((term) => primaryText.includes(term));
  const secondaryMatch =
    secondaryText.includes(normalizedQuery) || queryTerms.every((term) => secondaryText.includes(term));

  if (!primaryMatch && !secondaryMatch) {
    return null;
  }

  let score = 0;

  if (name === normalizedQuery) {
    score += 1000;
  } else if (name.startsWith(normalizedQuery)) {
    score += 700;
  } else if (name.includes(normalizedQuery)) {
    score += 450;
  }

  if (path === normalizedQuery) {
    score += 600;
  } else if (path.startsWith(normalizedQuery)) {
    score += 320;
  } else if (path.includes(normalizedQuery)) {
    score += 180;
  }

  if (description.includes(normalizedQuery)) {
    score += 160;
  }

  if (secondaryMatch) {
    if (nodeType === normalizedQuery) {
      score += 80;
    } else if (nodeType.includes(normalizedQuery)) {
      score += 40;
    }

    if (contentType === normalizedQuery) {
      score += 70;
    } else if (contentType && contentType.includes(normalizedQuery)) {
      score += 35;
    }

    if (content.includes(normalizedQuery)) {
      score += 60;
    }
  }

  queryTerms.forEach((term) => {
    if (name.includes(term)) score += 90;
    if (path.includes(term)) score += 55;
    if (description.includes(term)) score += 28;
    if (secondaryMatch) {
      if (nodeType.includes(term)) score += 12;
      if (contentType && contentType.includes(term)) score += 10;
      if (content.includes(term)) score += 8;
    }
  });

  return {
    score,
    primaryMatch
  };
}

export function useExplorerStore() {
  const [allNodes, setAllNodes] = useState<AppNode[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [currentChildren, setCurrentChildren] = useState<AppNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<AppNode[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AppNode[]>([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState<string | null>(null);
  const searchCacheRef = useRef<Map<string, AppNode[]>>(new Map());
  const didInitializeNavigationRef = useRef(false);

  const refreshTree = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      let nodes: AppNode[];
      try {
        // Fast path: fetch the full tree in a single backend call.
        nodes = await getAllNodes();
      } catch {
        // Compatibility fallback for older runtimes.
        nodes = await loadTreeRecursively(null);
      }
      searchCacheRef.current.clear();
      setAllNodes(nodes);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const refreshCurrentChildren = useCallback(async (folderId: string | null) => {
    const children = await getChildren(folderId);
    setCurrentChildren(children);
  }, []);

  const normalizeNavigableFolderId = useCallback(
    (folderId: string | null): string | null => {
      if (!folderId) return null;
      const targetNode = allNodes.find((node) => node.id === folderId) ?? null;
      if (!targetNode || !isFileLikeNode(targetNode)) return folderId;
      return targetNode.parentId === ROOT_PARENT_ID ? null : targetNode.parentId;
    },
    [allNodes]
  );

  const navigateTo = useCallback(
    async (folderId: string | null) => {
      const normalizedFolderId = normalizeNavigableFolderId(folderId);
      setCurrentFolderId(normalizedFolderId);
      try {
        setError(null);
        await refreshCurrentChildren(normalizedFolderId);
        if (!normalizedFolderId) {
          setBreadcrumbs([]);
          return;
        }
        const nextBreadcrumbs = await getAncestors(normalizedFolderId);
        setBreadcrumbs(nextBreadcrumbs);
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [normalizeNavigableFolderId, refreshCurrentChildren]
  );

  const patchNode = useCallback((nodeId: string, patch: Partial<AppNode>) => {
    const applyPatch = (node: AppNode) => (node.id === nodeId ? { ...node, ...patch } : node);
    setAllNodes((prev) => prev.map(applyPatch));
    setCurrentChildren((prev) => prev.map(applyPatch));
    setBreadcrumbs((prev) => prev.map(applyPatch));
  }, []);

  const createFolder = useCallback(
    async (parentId: string | null, name: string) => {
      const cleanName = name.trim();
      if (!cleanName) return;
      const createdNode = await createNode(parentId, cleanName, "folder");
      searchCacheRef.current.clear();
      setAllNodes((prev) => sortNodesByOrder([...prev, createdNode]));
      if (createdNode.parentId === normalizeFolderId(currentFolderId)) {
        setCurrentChildren((prev) => sortNodesByOrder([...prev, createdNode]));
      }
    },
    [currentFolderId]
  );

  const renameSelectedNode = useCallback(
    async (newName: string) => {
      if (!selectedNodeId) return;
      const cleanName = newName.trim();
      if (!cleanName) return;
      const resolvedName = await renameNode(selectedNodeId, cleanName);
      searchCacheRef.current.clear();
      patchNode(selectedNodeId, {
        name: resolvedName,
        updatedAt: Date.now()
      });
    },
    [patchNode, selectedNodeId]
  );

  const runSearch = useCallback(async (queryOverride?: string) => {
    const q = (queryOverride ?? searchQuery).trim().toLowerCase();
    if (!q) {
      setSearchResults([]);
      return;
    }

    const cached = searchCacheRef.current.get(q);
    if (cached) {
      setSearchResults(cached);
      return;
    }

    try {
      let results: AppNode[] = [];
      if (allNodes.length > 0) {
        const queryTerms = q.split(/\s+/).filter(Boolean);
        const nodeById = new Map(allNodes.map((node) => [node.id, node]));
        const reachableIds = collectReachableNodeIds(allNodes);
        const matchedEntries = allNodes
          .filter((node) => reachableIds.has(node.id))
          .map((node) => ({
            node,
            match: scoreLocalSearchMatch(node, q, queryTerms, nodeById)
          }))
          .filter(
            (entry): entry is { node: AppNode; match: { score: number; primaryMatch: boolean } } =>
              entry.match !== null
          );

        const primaryMatches = matchedEntries.some((entry) => entry.match.primaryMatch);
        results = matchedEntries
          .filter((entry) => !primaryMatches || entry.match.primaryMatch)
          .sort((left, right) => {
            if (left.match.score !== right.match.score) return right.match.score - left.match.score;
            if (left.node.updatedAt !== right.node.updatedAt) {
              return right.node.updatedAt - left.node.updatedAt;
            }
            if (left.node.order !== right.node.order) return left.node.order - right.node.order;
            return left.node.name.localeCompare(right.node.name);
          })
          .slice(0, LOCAL_SEARCH_RESULT_LIMIT)
          .map((entry) => entry.node);
      } else {
        results = await searchNodes(q);
      }

      searchCacheRef.current.set(q, results);
      setSearchResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [allNodes, searchQuery]);

  useEffect(() => {
    searchCacheRef.current.clear();
  }, [allNodes]);

  useEffect(() => {
    void refreshTree();
  }, [refreshTree]);

  useEffect(() => {
    if (didInitializeNavigationRef.current) return;
    didInitializeNavigationRef.current = true;
    void navigateTo(null);
  }, [navigateTo]);

  const currentNode = useMemo(
    () => allNodes.find((n) => n.id === currentFolderId) ?? null,
    [allNodes, currentFolderId]
  );

  return {
    allNodes,
    currentFolderId,
    currentNode,
    currentChildren,
    selectedNodeId,
    breadcrumbs,
    searchQuery,
    searchResults,
    status,
    error,
    setSelectedNodeId,
    setSearchQuery,
    refreshTree,
    navigateTo,
    createFolder,
    renameSelectedNode,
    runSearch,
    patchNode
  };
}
