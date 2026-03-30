import { useEffect, useMemo, useRef, useState } from "react";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import type { WBSNode } from "@/lib/aiService";
import type { TranslationParams } from "@/lib/i18n";

type TranslateFn = (key: string, params?: TranslationParams) => string;

type DraftNode = Omit<WBSNode, "children"> & {
  editorId: string;
  children: DraftNode[];
};

type FlatDraftRow = {
  id: string;
  depth: number;
  label: string;
  parentId: string | null;
  node: DraftNode;
  hasChildren: boolean;
};

type DraftClipboard = {
  mode: "copy" | "cut";
  nodes: DraftNode[];
  sourceIds: string[];
};

interface DocumentTreeProposalEditorProps {
  nodes: WBSNode[];
  t: TranslateFn;
  disabled?: boolean;
  onChange: (nodes: WBSNode[]) => void;
}

let draftNodeIdCounter = 0;
const createDraftNodeId = () => `draft-node-${draftNodeIdCounter++}`;

const materializeDraftNode = (node: WBSNode): DraftNode => ({
  ...node,
  editorId: createDraftNodeId(),
  prerequisites: [...node.prerequisites],
  children: node.children.map(materializeDraftNode)
});

const materializeDraftNodes = (nodes: WBSNode[]): DraftNode[] => nodes.map(materializeDraftNode);

const cloneDraftNode = (node: DraftNode, regenerateIds = false): DraftNode => ({
  ...node,
  editorId: regenerateIds ? createDraftNodeId() : node.editorId,
  prerequisites: [...node.prerequisites],
  children: node.children.map((child) => cloneDraftNode(child, regenerateIds))
});

const cloneDraftNodes = (nodes: DraftNode[], regenerateIds = false): DraftNode[] =>
  nodes.map((node) => cloneDraftNode(node, regenerateIds));

const serializeDraftNodes = (nodes: DraftNode[]): WBSNode[] =>
  nodes.map((node) => ({
    title: node.title,
    description: node.description?.trim() || undefined,
    objective: node.objective?.trim() || undefined,
    expected_deliverables:
      node.expected_deliverables
        ?.map((item) => item.trim())
        .filter((item) => item.length > 0)
        .slice(0, 12) ?? [],
    prerequisites: [...node.prerequisites],
    estimated_effort: node.estimated_effort,
    suggested_role: node.suggested_role,
    value_milestone: node.value_milestone,
    source_code: node.source_code,
    children: serializeDraftNodes(node.children)
  }));

const collectAllDraftIds = (nodes: DraftNode[]): string[] =>
  nodes.flatMap((node) => [node.editorId, ...collectAllDraftIds(node.children)]);

const flattenDraftNodes = (
  nodes: DraftNode[],
  expandedIds: ReadonlySet<string>,
  depth = 0,
  parentId: string | null = null,
  parentLabel = ""
): FlatDraftRow[] =>
  nodes.flatMap((node, index) => {
    const label = parentLabel ? `${parentLabel}.${index + 1}` : `${index + 1}`;
    const row: FlatDraftRow = {
      id: node.editorId,
      depth,
      label,
      parentId,
      node,
      hasChildren: node.children.length > 0
    };
    if (!node.children.length || !expandedIds.has(node.editorId)) {
      return [row];
    }
    return [row, ...flattenDraftNodes(node.children, expandedIds, depth + 1, node.editorId, label)];
  });

const findNodePath = (nodes: DraftNode[], targetId: string, prefix: number[] = []): number[] | null => {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const path = [...prefix, index];
    if (node.editorId === targetId) {
      return path;
    }
    const nested = findNodePath(node.children, targetId, path);
    if (nested) return nested;
  }
  return null;
};

const getNodeAtPath = (nodes: DraftNode[], path: number[]): DraftNode | null => {
  let currentNodes = nodes;
  let currentNode: DraftNode | null = null;
  for (const index of path) {
    currentNode = currentNodes[index] ?? null;
    if (!currentNode) return null;
    currentNodes = currentNode.children;
  }
  return currentNode;
};

const getArrayAtPath = (nodes: DraftNode[], parentPath: number[]): DraftNode[] => {
  if (parentPath.length === 0) return nodes;
  const parentNode = getNodeAtPath(nodes, parentPath);
  return parentNode?.children ?? [];
};

const collectTopLevelSelectedIds = (nodes: DraftNode[], selectedIds: ReadonlySet<string>): string[] => {
  const result: string[] = [];
  const walk = (entries: DraftNode[], parentSelected: boolean) => {
    for (const node of entries) {
      const selected = selectedIds.has(node.editorId);
      if (selected && !parentSelected) {
        result.push(node.editorId);
      }
      walk(node.children, parentSelected || selected);
    }
  };
  walk(nodes, false);
  return result;
};

const removeNodesByIdSet = (nodes: DraftNode[], removeIds: ReadonlySet<string>): DraftNode[] =>
  nodes
    .filter((node) => !removeIds.has(node.editorId))
    .map((node) => ({
      ...node,
      children: removeNodesByIdSet(node.children, removeIds)
    }));

const collectSelectedBranches = (nodes: DraftNode[], selectedIds: ReadonlySet<string>): DraftNode[] => {
  const topLevelIds = new Set(collectTopLevelSelectedIds(nodes, selectedIds));
  const result: DraftNode[] = [];
  const walk = (entries: DraftNode[]) => {
    for (const node of entries) {
      if (topLevelIds.has(node.editorId)) {
        result.push(cloneDraftNode(node));
        continue;
      }
      walk(node.children);
    }
  };
  walk(nodes);
  return result;
};

const createBlankDraftNode = (): DraftNode => ({
  editorId: createDraftNodeId(),
  title: "New node",
  description: "",
  objective: "",
  expected_deliverables: [],
  prerequisites: [],
  estimated_effort: "S",
  suggested_role: "Document Owner",
  value_milestone: false,
  children: []
});

const isDraftNodeDescendantOf = (nodes: DraftNode[], ancestorId: string, candidateId: string): boolean => {
  const ancestorPath = findNodePath(nodes, ancestorId);
  const candidatePath = findNodePath(nodes, candidateId);
  if (!ancestorPath || !candidatePath || candidatePath.length <= ancestorPath.length) return false;
  return ancestorPath.every((segment, index) => candidatePath[index] === segment);
};

type TreeEditorActionIconKind =
  | "rename"
  | "addChild"
  | "addSibling"
  | "moveUp"
  | "moveDown"
  | "indent"
  | "outdent"
  | "copy"
  | "cut"
  | "paste"
  | "duplicate"
  | "delete"
  | "expand"
  | "collapse";

function TreeEditorActionIcon({ kind }: { kind: TreeEditorActionIconKind }) {
  const baseClass = "h-4 w-4";
  switch (kind) {
    case "rename":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} aria-hidden>
          <path d="M4 20h4.2l10-10-4.2-4.2-10 10Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M12.7 7.3 16.8 11.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case "addChild":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} aria-hidden>
          <path d="M7 5v10a2 2 0 0 0 2 2h6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 12v8M11 16h8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case "addSibling":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} aria-hidden>
          <path d="M6 7h7M6 12h7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M16 12v8M12 16h8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case "moveUp":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} aria-hidden>
          <path d="M12 18V6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="m7.5 10.5 4.5-4.5 4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "moveDown":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} aria-hidden>
          <path d="M12 6v12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="m7.5 13.5 4.5 4.5 4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "indent":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} aria-hidden>
          <path d="M4 7h8M4 12h8M4 17h8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="m13 8 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "outdent":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} aria-hidden>
          <path d="M12 7h8M12 12h8M12 17h8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="m11 8-4 4 4 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "copy":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} aria-hidden>
          <rect x="8" y="8" width="10" height="10" rx="1.7" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M6 15H5a1 1 0 0 1-1-1V5.8A1.8 1.8 0 0 1 5.8 4H14a1 1 0 0 1 1 1v1" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case "cut":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} aria-hidden>
          <circle cx="7" cy="17" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="17" cy="17" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M8.6 15.6 19 5M15.4 15.6 11.8 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "paste":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} aria-hidden>
          <path d="M9 5.5h6M9 4h6a1.3 1.3 0 0 1 1.3 1.3v.7H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1.7v-.7A1.3 1.3 0 0 1 11 4Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      );
    case "duplicate":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} aria-hidden>
          <rect x="5" y="6" width="9" height="9" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <rect x="10" y="10" width="9" height="9" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      );
    case "delete":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} aria-hidden>
          <path d="M5 7h14M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M7 7l.8 11a2 2 0 0 0 2 1.8h4.4a2 2 0 0 0 2-1.8L17 7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "expand":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} aria-hidden>
          <path d="M9 5H5v4M15 5h4v4M5 15v4h4M19 15v4h-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "collapse":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} aria-hidden>
          <path d="M8 8h3V5M16 8h-3V5M8 16h3v3M16 16h-3v3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

export function DocumentTreeProposalEditor({
  nodes,
  t,
  disabled = false,
  onChange
}: DocumentTreeProposalEditorProps) {
  const serializeNodesSignature = (value: WBSNode[]) => JSON.stringify(value);
  const [draftNodes, setDraftNodes] = useState<DraftNode[]>(() => materializeDraftNodes(nodes));
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(collectAllDraftIds(materializeDraftNodes(nodes))));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [clipboard, setClipboard] = useState<DraftClipboard | null>(null);
  const [cutPendingIds, setCutPendingIds] = useState<Set<string>>(new Set());
  const [detailDescriptionDraft, setDetailDescriptionDraft] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const lastSyncedSignatureRef = useRef<string>(serializeNodesSignature(nodes));

  useEffect(() => {
    const nextSignature = serializeNodesSignature(nodes);
    if (nextSignature === lastSyncedSignatureRef.current) {
      return;
    }
    const nextDraft = materializeDraftNodes(nodes);
    lastSyncedSignatureRef.current = nextSignature;
    setDraftNodes(nextDraft);
    setExpandedIds(new Set(collectAllDraftIds(nextDraft)));
    setSelectedIds(new Set());
    setFocusedId(null);
    setAnchorId(null);
    setEditingId(null);
    setEditingTitle("");
    setClipboard(null);
    setCutPendingIds(new Set());
    setDetailDescriptionDraft("");
  }, [nodes]);

  useEffect(() => {
    const serializedNodes = serializeDraftNodes(draftNodes);
    const nextSignature = serializeNodesSignature(serializedNodes);
    if (nextSignature === lastSyncedSignatureRef.current) {
      return;
    }
    lastSyncedSignatureRef.current = nextSignature;
    onChange(serializedNodes);
  }, [draftNodes, onChange]);

  useEffect(() => {
    if (!editingId) return;
    window.setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 0);
  }, [editingId]);

  const visibleRows = useMemo(() => flattenDraftNodes(draftNodes, expandedIds), [draftNodes, expandedIds]);
  const rowIndexById = useMemo(
    () => new Map(visibleRows.map((row, index) => [row.id, index])),
    [visibleRows]
  );

  const selectedIdList = selectedIds.size > 0 ? Array.from(selectedIds) : focusedId ? [focusedId] : [];
  const topLevelSelectedIds = useMemo(
    () => collectTopLevelSelectedIds(draftNodes, new Set(selectedIdList)),
    [draftNodes, selectedIdList]
  );
  const hasSelection = selectedIdList.length > 0;
  const singleSelectionId = selectedIdList.length === 1 ? selectedIdList[0] : null;
  const selectedDetailNode = useMemo(() => {
    const targetId = singleSelectionId ?? focusedId;
    if (!targetId) return null;
    const path = findNodePath(draftNodes, targetId);
    return path ? getNodeAtPath(draftNodes, path) : null;
  }, [draftNodes, focusedId, singleSelectionId]);

  useEffect(() => {
    if (!singleSelectionId || !selectedDetailNode) {
      setDetailDescriptionDraft("");
      return;
    }
    setDetailDescriptionDraft(selectedDetailNode.description ?? "");
  }, [singleSelectionId, selectedDetailNode?.editorId]);

  useEffect(() => {
    if (visibleRows.length === 0) {
      if (focusedId !== null) {
        setFocusedId(null);
      }
      if (selectedIds.size > 0) {
        setSelectedIds(new Set());
      }
      if (anchorId !== null) {
        setAnchorId(null);
      }
      return;
    }
    const hasFocusedVisible = focusedId ? visibleRows.some((row) => row.id === focusedId) : false;
    const hasSelectedVisible =
      selectedIds.size > 0 && Array.from(selectedIds).some((id) => visibleRows.some((row) => row.id === id));
    if (!hasFocusedVisible && !hasSelectedVisible) {
      const fallbackId = visibleRows[0]?.id ?? null;
      if (fallbackId) {
        setFocusedId(fallbackId);
        setSelectedIds(new Set([fallbackId]));
        setAnchorId(fallbackId);
      }
    }
  }, [anchorId, focusedId, selectedIds, visibleRows]);

  const setNextDraft = (
    updater: (current: DraftNode[]) => {
      nodes: DraftNode[];
      selectedIds?: string[];
      focusedId?: string | null;
      anchorId?: string | null;
      expandedIds?: string[];
      clearCut?: boolean;
    }
  ) => {
    setDraftNodes((current) => {
      const next = updater(current);
      if (next.selectedIds) {
        setSelectedIds(new Set(next.selectedIds));
      }
      if (next.focusedId !== undefined) {
        setFocusedId(next.focusedId);
      }
      if (next.anchorId !== undefined) {
        setAnchorId(next.anchorId);
      }
      if (next.expandedIds) {
        setExpandedIds((prev) => {
          const merged = new Set(prev);
          next.expandedIds?.forEach((id) => merged.add(id));
          return merged;
        });
      }
      if (next.clearCut) {
        setCutPendingIds(new Set());
        setClipboard((prev) => (prev?.mode === "cut" ? null : prev));
      }
      return next.nodes;
    });
  };

  const focusEditor = () => {
    window.setTimeout(() => {
      containerRef.current?.focus();
    }, 0);
  };

  const updateFocusedNode = (updater: (node: DraftNode) => void) => {
    const targetId = singleSelectionId ?? focusedId;
    if (!targetId || disabled) return;
    setNextDraft((current) => {
      const next = cloneDraftNodes(current);
      const path = findNodePath(next, targetId);
      const target = path ? getNodeAtPath(next, path) : null;
      if (!target) {
        return { nodes: next };
      }
      updater(target);
      return {
        nodes: next,
        selectedIds: [targetId],
        focusedId: targetId,
        anchorId: targetId
      };
    });
  };

  const startRename = (nodeId: string | null) => {
    if (!nodeId || disabled) return;
    const path = findNodePath(draftNodes, nodeId);
    const node = path ? getNodeAtPath(draftNodes, path) : null;
    if (!node) return;
    setEditingId(node.editorId);
    setEditingTitle(node.title);
    setFocusedId(node.editorId);
    setSelectedIds(new Set([node.editorId]));
    setAnchorId(node.editorId);
  };

  const commitRename = () => {
    if (!editingId) return;
    const nextTitle = editingTitle.trim();
    const targetId = editingId;
    setEditingId(null);
    setEditingTitle("");
    if (!nextTitle) return;
    setNextDraft((current) => {
      const next = cloneDraftNodes(current);
      const path = findNodePath(next, targetId);
      const target = path ? getNodeAtPath(next, path) : null;
      if (target) {
        target.title = nextTitle;
      }
      return {
        nodes: next,
        selectedIds: [targetId],
        focusedId: targetId,
        anchorId: targetId
      };
    });
    focusEditor();
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingTitle("");
    focusEditor();
  };

  const applySelection = (nodeId: string, options?: { toggle?: boolean; range?: boolean }) => {
    if (disabled) return;
    if (options?.range && anchorId && rowIndexById.has(anchorId) && rowIndexById.has(nodeId)) {
      const start = rowIndexById.get(anchorId) ?? 0;
      const end = rowIndexById.get(nodeId) ?? 0;
      const [from, to] = start <= end ? [start, end] : [end, start];
      const rangeIds = visibleRows.slice(from, to + 1).map((row) => row.id);
      setSelectedIds(new Set(rangeIds));
      setFocusedId(nodeId);
      focusEditor();
      return;
    }
    if (options?.toggle) {
      setSelectedIds((current) => {
        const next = new Set(current);
        if (next.has(nodeId)) {
          next.delete(nodeId);
        } else {
          next.add(nodeId);
        }
        return next;
      });
      setFocusedId(nodeId);
      setAnchorId(nodeId);
      focusEditor();
      return;
    }
    setSelectedIds(new Set([nodeId]));
    setFocusedId(nodeId);
    setAnchorId(nodeId);
    focusEditor();
  };

  const moveSelectionFocus = (direction: -1 | 1, extendRange: boolean) => {
    if (!visibleRows.length) return;
    const currentId = focusedId ?? visibleRows[0]?.id ?? null;
    const currentIndex = currentId ? rowIndexById.get(currentId) ?? 0 : 0;
    const nextIndex = Math.max(0, Math.min(visibleRows.length - 1, currentIndex + direction));
    const nextId = visibleRows[nextIndex]?.id ?? null;
    if (!nextId) return;
    applySelection(nextId, { range: extendRange });
  };

  const toggleExpanded = (nodeId: string) => {
    if (disabled) return;
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const copySelection = (mode: "copy" | "cut") => {
    if (disabled || topLevelSelectedIds.length === 0) return;
    const sourceIdSet = new Set(topLevelSelectedIds);
    const branches = collectSelectedBranches(draftNodes, sourceIdSet);
    if (branches.length === 0) return;
    setClipboard({
      mode,
      nodes: branches,
      sourceIds: topLevelSelectedIds
    });
    setCutPendingIds(mode === "cut" ? new Set(topLevelSelectedIds) : new Set());
  };

  const deleteSelection = () => {
    if (disabled || topLevelSelectedIds.length === 0) return;
    const removeIdSet = new Set(topLevelSelectedIds);
    setNextDraft((current) => {
      const next = removeNodesByIdSet(cloneDraftNodes(current), removeIdSet);
      const nextRows = flattenDraftNodes(next, expandedIds);
      const nextFocus = nextRows[0]?.id ?? null;
      return {
        nodes: next,
        selectedIds: nextFocus ? [nextFocus] : [],
        focusedId: nextFocus,
        anchorId: nextFocus,
        clearCut: true
      };
    });
  };

  const duplicateSelection = () => {
    if (disabled || topLevelSelectedIds.length === 0) return;
    const selectedSet = new Set(topLevelSelectedIds);
    setNextDraft((current) => {
      const next = cloneDraftNodes(current);
      const insertedIds: string[] = [];
      const walk = (entries: DraftNode[]) => {
        for (let index = entries.length - 1; index >= 0; index -= 1) {
          const node = entries[index];
          walk(node.children);
          if (selectedSet.has(node.editorId)) {
            const duplicated = cloneDraftNode(node, true);
            entries.splice(index + 1, 0, duplicated);
            insertedIds.unshift(duplicated.editorId);
          }
        }
      };
      walk(next);
      return {
        nodes: next,
        selectedIds: insertedIds,
        focusedId: insertedIds[0] ?? null,
        anchorId: insertedIds[0] ?? null
      };
    });
  };

  const pasteClipboard = () => {
    if (disabled || !clipboard) return;
    const targetId = singleSelectionId ?? focusedId;
    if (clipboard.mode === "cut" && targetId && clipboard.sourceIds.some((id) => isDraftNodeDescendantOf(draftNodes, id, targetId))) {
      return;
    }

    setNextDraft((current) => {
      let next = cloneDraftNodes(current);
      if (clipboard.mode === "cut") {
        next = removeNodesByIdSet(next, new Set(clipboard.sourceIds));
      }

      const nextTargetId = targetId && !clipboard.sourceIds.includes(targetId) ? targetId : null;
      const targetPath = nextTargetId ? findNodePath(next, nextTargetId) : null;
      const insertNodes =
        clipboard.mode === "copy"
          ? cloneDraftNodes(clipboard.nodes, true)
          : cloneDraftNodes(clipboard.nodes);
      const insertedIds = insertNodes.map((node) => node.editorId);

      if (targetPath) {
        const target = getNodeAtPath(next, targetPath);
        if (target) {
          target.children.push(...insertNodes);
        } else {
          next.push(...insertNodes);
        }
      } else {
        next.push(...insertNodes);
      }

      return {
        nodes: next,
        selectedIds: insertedIds,
        focusedId: insertedIds[0] ?? null,
        anchorId: insertedIds[0] ?? null,
        expandedIds: nextTargetId ? [nextTargetId] : insertedIds,
        clearCut: clipboard.mode === "cut"
      };
    });
  };

  const addChildNode = () => {
    if (disabled) return;
    const targetId = singleSelectionId ?? focusedId;
    if (!targetId) return;
    const newNode = createBlankDraftNode();
    setNextDraft((current) => {
      const next = cloneDraftNodes(current);
      const path = findNodePath(next, targetId);
      const target = path ? getNodeAtPath(next, path) : null;
      if (!target) {
        return { nodes: next };
      }
      target.children.push(newNode);
      return {
        nodes: next,
        selectedIds: [newNode.editorId],
        focusedId: newNode.editorId,
        anchorId: newNode.editorId,
        expandedIds: [target.editorId, newNode.editorId]
      };
    });
    setEditingId(newNode.editorId);
    setEditingTitle(newNode.title);
  };

  const addSiblingNode = () => {
    if (disabled) return;
    const targetId = singleSelectionId ?? focusedId;
    if (!targetId) return;
    const newNode = createBlankDraftNode();
    setNextDraft((current) => {
      const next = cloneDraftNodes(current);
      const path = findNodePath(next, targetId);
      if (!path) return { nodes: next };
      const parentPath = path.slice(0, -1);
      const siblingIndex = path[path.length - 1] ?? 0;
      const siblings = getArrayAtPath(next, parentPath);
      siblings.splice(siblingIndex + 1, 0, newNode);
      return {
        nodes: next,
        selectedIds: [newNode.editorId],
        focusedId: newNode.editorId,
        anchorId: newNode.editorId
      };
    });
    setEditingId(newNode.editorId);
    setEditingTitle(newNode.title);
  };

  const moveSelectionUp = () => {
    if (disabled || topLevelSelectedIds.length === 0) return;
    const selectedSet = new Set(topLevelSelectedIds);
    setNextDraft((current) => {
      const next = cloneDraftNodes(current);
      const walk = (entries: DraftNode[]) => {
        for (let index = 1; index < entries.length; index += 1) {
          if (selectedSet.has(entries[index].editorId) && !selectedSet.has(entries[index - 1].editorId)) {
            [entries[index - 1], entries[index]] = [entries[index], entries[index - 1]];
          }
        }
        entries.forEach((entry) => walk(entry.children));
      };
      walk(next);
      return {
        nodes: next,
        selectedIds: topLevelSelectedIds,
        focusedId: focusedId ?? topLevelSelectedIds[0] ?? null,
        anchorId: anchorId ?? topLevelSelectedIds[0] ?? null
      };
    });
  };

  const moveSelectionDown = () => {
    if (disabled || topLevelSelectedIds.length === 0) return;
    const selectedSet = new Set(topLevelSelectedIds);
    setNextDraft((current) => {
      const next = cloneDraftNodes(current);
      const walk = (entries: DraftNode[]) => {
        for (let index = entries.length - 2; index >= 0; index -= 1) {
          if (selectedSet.has(entries[index].editorId) && !selectedSet.has(entries[index + 1].editorId)) {
            [entries[index], entries[index + 1]] = [entries[index + 1], entries[index]];
          }
        }
        entries.forEach((entry) => walk(entry.children));
      };
      walk(next);
      return {
        nodes: next,
        selectedIds: topLevelSelectedIds,
        focusedId: focusedId ?? topLevelSelectedIds[0] ?? null,
        anchorId: anchorId ?? topLevelSelectedIds[0] ?? null
      };
    });
  };

  const indentSelection = () => {
    if (disabled || topLevelSelectedIds.length === 0) return;
    const selectedSet = new Set(topLevelSelectedIds);
    setNextDraft((current) => {
      const next = cloneDraftNodes(current);
      const walk = (entries: DraftNode[]) => {
        let index = 0;
        while (index < entries.length) {
          const node = entries[index];
          if (!selectedSet.has(node.editorId)) {
            walk(node.children);
            index += 1;
            continue;
          }

          let end = index;
          while (end + 1 < entries.length && selectedSet.has(entries[end + 1].editorId)) {
            end += 1;
          }

          if (index > 0 && !selectedSet.has(entries[index - 1].editorId)) {
            const group = entries.splice(index, end - index + 1);
            entries[index - 1].children.push(...group);
            continue;
          }

          index = end + 1;
        }
        entries.forEach((entry) => walk(entry.children));
      };
      walk(next);
      return {
        nodes: next,
        selectedIds: topLevelSelectedIds,
        focusedId: focusedId ?? topLevelSelectedIds[0] ?? null,
        anchorId: anchorId ?? topLevelSelectedIds[0] ?? null
      };
    });
  };

  const outdentSelection = () => {
    if (disabled || topLevelSelectedIds.length === 0) return;
    setNextDraft((current) => {
      const next = cloneDraftNodes(current);
      const paths = topLevelSelectedIds
        .map((id) => ({ id, path: findNodePath(next, id) }))
        .filter((entry): entry is { id: string; path: number[] } => Boolean(entry.path && entry.path.length > 0))
        .sort((left, right) => {
          const leftPath = left.path;
          const rightPath = right.path;
          const maxLength = Math.max(leftPath.length, rightPath.length);
          for (let index = 0; index < maxLength; index += 1) {
            const delta = (rightPath[index] ?? -1) - (leftPath[index] ?? -1);
            if (delta !== 0) return delta;
          }
          return 0;
        });

      for (const entry of paths) {
        const currentPath = findNodePath(next, entry.id);
        if (!currentPath || currentPath.length === 0) continue;
        const parentPath = currentPath.slice(0, -1);
        if (parentPath.length === 0) continue;
        const grandParentPath = parentPath.slice(0, -1);
        const parentIndex = parentPath[parentPath.length - 1] ?? 0;
        const sourceIndex = currentPath[currentPath.length - 1] ?? 0;
        const parentChildren = getArrayAtPath(next, parentPath);
        const [node] = parentChildren.splice(sourceIndex, 1);
        if (!node) continue;
        const grandParentChildren = getArrayAtPath(next, grandParentPath);
        grandParentChildren.splice(parentIndex + 1, 0, node);
      }

      return {
        nodes: next,
        selectedIds: topLevelSelectedIds,
        focusedId: focusedId ?? topLevelSelectedIds[0] ?? null,
        anchorId: anchorId ?? topLevelSelectedIds[0] ?? null
      };
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(collectAllDraftIds(draftNodes)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
      if (event.key === "Escape" && editingId) {
        event.preventDefault();
        cancelRename();
      }
      return;
    }

    const isMeta = event.ctrlKey || event.metaKey;
    if (isMeta && event.key.toLowerCase() === "c") {
      event.preventDefault();
      copySelection("copy");
      return;
    }
    if (isMeta && event.key.toLowerCase() === "x") {
      event.preventDefault();
      copySelection("cut");
      return;
    }
    if (isMeta && event.key.toLowerCase() === "v") {
      event.preventDefault();
      pasteClipboard();
      return;
    }
    if (isMeta && event.key.toLowerCase() === "d") {
      event.preventDefault();
      duplicateSelection();
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteSelection();
      return;
    }
    if (event.key === "F2") {
      event.preventDefault();
      startRename(singleSelectionId ?? focusedId);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (event.shiftKey) {
        addChildNode();
      } else {
        addSiblingNode();
      }
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      if (event.shiftKey) {
        outdentSelection();
      } else {
        indentSelection();
      }
      return;
    }
    if (event.altKey && event.key === "ArrowUp") {
      event.preventDefault();
      moveSelectionUp();
      return;
    }
    if (event.altKey && event.key === "ArrowDown") {
      event.preventDefault();
      moveSelectionDown();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSelectionFocus(-1, event.shiftKey);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSelectionFocus(1, event.shiftKey);
      return;
    }
    if (event.key === "ArrowLeft" && focusedId) {
      event.preventDefault();
      if (expandedIds.has(focusedId)) {
        toggleExpanded(focusedId);
        return;
      }
      const focusedRow = visibleRows.find((row) => row.id === focusedId);
      if (focusedRow?.parentId) {
        applySelection(focusedRow.parentId);
      }
      return;
    }
    if (event.key === "ArrowRight" && focusedId) {
      event.preventDefault();
      const focusedRow = visibleRows.find((row) => row.id === focusedId);
      if (focusedRow?.hasChildren && !expandedIds.has(focusedId)) {
        toggleExpanded(focusedId);
        return;
      }
      const currentIndex = rowIndexById.get(focusedId) ?? -1;
      const nextRow = currentIndex >= 0 ? visibleRows[currentIndex + 1] : null;
      if (nextRow) {
        applySelection(nextRow.id);
      }
    }
  };

  const toolbarButtonClass =
    "inline-flex h-10 w-10 items-center justify-center rounded-md border border-[rgba(63,118,154,0.22)] bg-[rgba(3,18,30,0.46)] text-[var(--ode-text-dim)] transition hover:border-[rgba(74,188,239,0.5)] hover:text-[var(--ode-text)] disabled:cursor-not-allowed disabled:opacity-45";
  const renderToolbarButton = (
    label: string,
    action: () => void,
    isDisabled: boolean,
    kind:
      | "rename"
      | "addChild"
      | "addSibling"
      | "moveUp"
      | "moveDown"
      | "indent"
      | "outdent"
      | "copy"
      | "cut"
      | "paste"
      | "duplicate"
      | "delete"
      | "expand"
      | "collapse"
  ) => (
    <OdeTooltip key={kind} label={label} side="bottom">
      <button
        type="button"
        className={toolbarButtonClass}
        onClick={action}
        disabled={isDisabled}
        aria-label={label}
      >
        <TreeEditorActionIcon kind={kind} />
      </button>
    </OdeTooltip>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {renderToolbarButton(
          t("document_ai.tree_editor_rename"),
          () => startRename(singleSelectionId ?? focusedId),
          disabled || !hasSelection,
          "rename"
        )}
        {renderToolbarButton(
          t("document_ai.tree_editor_add_child"),
          addChildNode,
          disabled || !singleSelectionId,
          "addChild"
        )}
        {renderToolbarButton(
          t("document_ai.tree_editor_add_sibling"),
          addSiblingNode,
          disabled || !singleSelectionId,
          "addSibling"
        )}
        {renderToolbarButton(
          t("document_ai.tree_editor_move_up"),
          moveSelectionUp,
          disabled || !hasSelection,
          "moveUp"
        )}
        {renderToolbarButton(
          t("document_ai.tree_editor_move_down"),
          moveSelectionDown,
          disabled || !hasSelection,
          "moveDown"
        )}
        {renderToolbarButton(
          t("document_ai.tree_editor_indent"),
          indentSelection,
          disabled || !hasSelection,
          "indent"
        )}
        {renderToolbarButton(
          t("document_ai.tree_editor_outdent"),
          outdentSelection,
          disabled || !hasSelection,
          "outdent"
        )}
        {renderToolbarButton(t("context.copy"), () => copySelection("copy"), disabled || !hasSelection, "copy")}
        {renderToolbarButton(t("context.cut"), () => copySelection("cut"), disabled || !hasSelection, "cut")}
        {renderToolbarButton(t("context.paste"), pasteClipboard, disabled || !clipboard, "paste")}
        {renderToolbarButton(
          t("context.duplicate"),
          duplicateSelection,
          disabled || !hasSelection,
          "duplicate"
        )}
        {renderToolbarButton(t("context.delete"), deleteSelection, disabled || !hasSelection, "delete")}
        {renderToolbarButton(
          t("document_ai.tree_editor_expand_all"),
          expandAll,
          disabled || visibleRows.length === 0,
          "expand"
        )}
        {renderToolbarButton(
          t("document_ai.tree_editor_collapse_all"),
          collapseAll,
          disabled || visibleRows.length === 0,
          "collapse"
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.95fr)]">
        <div className="space-y-3">
          <div
            ref={containerRef}
            tabIndex={0}
            className="max-h-[420px] overflow-y-auto rounded-xl border border-[rgba(63,118,154,0.22)] bg-[rgba(3,18,30,0.46)] p-2 outline-none"
            onKeyDown={handleKeyDown}
          >
            {visibleRows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[rgba(63,118,154,0.22)] px-4 py-4 text-[0.92rem] text-[var(--ode-text-muted)]">
                {t("document_ai.tree_editor_empty")}
              </div>
            ) : (
              visibleRows.map((row) => {
                const selected = selectedIds.has(row.id);
                const focused = focusedId === row.id;
                const editing = editingId === row.id;
                return (
                  <div
                    key={row.id}
                    className={`ode-tree-row ${selected ? "ode-tree-row-selected" : ""} ${focused ? "ode-tree-row-active" : ""} ${cutPendingIds.has(row.id) ? "ode-cut-pending" : ""}`}
                    style={{ paddingLeft: `${10 + row.depth * 18}px` }}
                    onMouseDown={() => {
                      if (editing) return;
                      focusEditor();
                    }}
                    onClick={(event) => {
                      if (editing) return;
                      applySelection(row.id, {
                        range: event.shiftKey,
                        toggle: event.ctrlKey || event.metaKey
                      });
                    }}
                    onDoubleClick={() => {
                      if (disabled) return;
                      startRename(row.id);
                    }}
                  >
                    <button
                      type="button"
                      className="ode-caret-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (!row.hasChildren) return;
                        toggleExpanded(row.id);
                      }}
                    >
                      {row.hasChildren ? (expandedIds.has(row.id) ? "v" : ">") : ""}
                    </button>

                    <div className="ode-tree-row-main">
                      <span className="rounded-sm bg-[rgba(36,133,202,0.16)] px-1.5 py-[1px] text-[0.7rem] text-[var(--ode-text-dim)]">
                        {row.label}
                      </span>
                      {editing ? (
                        <input
                          ref={renameInputRef}
                          value={editingTitle}
                          onChange={(event) => setEditingTitle(event.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              commitRename();
                            } else if (event.key === "Escape") {
                              event.preventDefault();
                              cancelRename();
                            }
                          }}
                          className="min-w-0 flex-1 rounded-md border border-[rgba(74,188,239,0.52)] bg-[rgba(2,18,31,0.9)] px-2 py-1 text-[0.94rem] text-[var(--ode-text)] outline-none"
                        />
                      ) : (
                        <div className="min-w-0 flex-1">
                          <p className="ode-wrap-text text-[0.94rem] font-medium text-[var(--ode-text)] ode-node-label">{row.node.title}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[rgba(63,118,154,0.22)] bg-[rgba(3,18,30,0.46)] px-4 py-4">
          {!hasSelection ? (
            <p className="text-[0.9rem] text-[var(--ode-text-muted)]">
              {t("document_ai.tree_editor_detail_empty")}
            </p>
          ) : !singleSelectionId || !selectedDetailNode ? (
            <p className="text-[0.9rem] text-[var(--ode-text-muted)]">
              {t("document_ai.tree_editor_detail_multi")}
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-[0.76rem] uppercase tracking-[0.11em] text-[var(--ode-accent)]">
                  {t("document_ai.tree_editor_description")}
                </p>
                <textarea
                  value={detailDescriptionDraft}
                  onChange={(event) => {
                    setDetailDescriptionDraft(event.target.value);
                    updateFocusedNode((node) => {
                      node.description = event.target.value;
                    });
                  }}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                  }}
                  disabled={disabled}
                  rows={4}
                  className="ode-input mt-2 min-h-[96px] w-full rounded-lg px-3 py-2 text-[0.92rem]"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
