import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import { useDraggableModalSurface } from "@/hooks/useDraggableModalSurface";
import type { TranslationParams } from "@/lib/i18n";
import type {
  ODEIntegratedPlanProposal,
  ODEIntegratedPlanProposalItem,
  ODEIntegratedPlanStructureNode,
  ODEWorkstreamTaskItem
} from "@/lib/types";

type TranslateFn = (key: string, params?: TranslationParams) => string;
type StructurePath = number[];

interface IntegratedPlanPreviewModalProps {
  open: boolean;
  t: TranslateFn;
  proposal: ODEIntegratedPlanProposal | null;
  nodeTitle: string | null;
  onClose: () => void;
  onConfirm: () => void;
  onChangeProposal: (proposal: ODEIntegratedPlanProposal) => void;
}

type FlatStructureRow = {
  key: string;
  path: StructurePath;
  depth: number;
  node: ODEIntegratedPlanStructureNode;
};

type FlatTaskRow = {
  key: string;
  deliverableId: string;
  task: ODEWorkstreamTaskItem;
};

type StructureClipboard =
  | {
      mode: "copy" | "cut";
      sourceKey: string;
      payload: ODEIntegratedPlanStructureNode;
    }
  | null;

type DeliverableClipboard =
  | {
      mode: "copy" | "cut";
      sourceId: string;
      payload: ODEIntegratedPlanProposalItem;
    }
  | null;

type TaskClipboard =
  | {
      mode: "copy" | "cut";
      sourceKey: string;
      sourceDeliverableId: string;
      payload: ODEWorkstreamTaskItem;
    }
  | null;

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function keyFromPath(path: StructurePath): string {
  return path.join(".");
}

function createBlankNode(): ODEIntegratedPlanStructureNode {
  return {
    title: "",
    description: "",
    objective: "",
    expected_deliverables: [],
    prerequisites: [],
    estimated_effort: "",
    suggested_role: "",
    value_milestone: false,
    source_code: "",
    children: []
  };
}

function createBlankTask(): ODEWorkstreamTaskItem {
  return {
    id: createId("task"),
    title: "",
    status: "planned",
    flagged: false,
    ownerName: null,
    dueDate: null,
    note: null
  };
}

function createBlankDeliverable(
  nodeId: string,
  outputLanguage: ODEIntegratedPlanProposal["outputLanguage"],
  sources: ODEIntegratedPlanProposal["sources"]
): ODEIntegratedPlanProposalItem {
  const deliverableId = createId("deliverable");
  return {
    id: deliverableId,
    title: "",
    rationale: null,
    taskProposal: {
      version: 1,
      nodeId,
      deliverableId,
      outputLanguage,
      title: "",
      summary: "",
      confidence: 0,
      sources: [...sources],
      sections: [
        {
          id: createId("section"),
          type: "tasks",
          title: "Tasks",
          collapsed: false,
          reasoning: null,
          items: []
        }
      ]
    }
  };
}

function cloneStructureNode(node: ODEIntegratedPlanStructureNode): ODEIntegratedPlanStructureNode {
  return {
    ...node,
    prerequisites: [...node.prerequisites],
    expected_deliverables: [...(node.expected_deliverables ?? [])],
    children: node.children.map(cloneStructureNode)
  };
}

function flattenStructure(nodes: ODEIntegratedPlanStructureNode[], depth = 0, parent: number[] = []): FlatStructureRow[] {
  return nodes.flatMap((node, index) => {
    const path = [...parent, index];
    return [{ key: keyFromPath(path), path, depth, node }, ...flattenStructure(node.children, depth + 1, path)];
  });
}

function getNodeAtPath(nodes: ODEIntegratedPlanStructureNode[], path: StructurePath): ODEIntegratedPlanStructureNode | null {
  let currentNodes = nodes;
  let currentNode: ODEIntegratedPlanStructureNode | null = null;
  for (const index of path) {
    if (index < 0 || index >= currentNodes.length) return null;
    currentNode = currentNodes[index];
    currentNodes = currentNode.children;
  }
  return currentNode;
}

function updateNodeAtPath(
  nodes: ODEIntegratedPlanStructureNode[],
  path: StructurePath,
  updater: (node: ODEIntegratedPlanStructureNode) => ODEIntegratedPlanStructureNode
): ODEIntegratedPlanStructureNode[] {
  const [index, ...rest] = path;
  if (index === undefined || index < 0 || index >= nodes.length) return nodes;
  const next = [...nodes];
  next[index] =
    rest.length === 0 ? updater(next[index]) : { ...next[index], children: updateNodeAtPath(next[index].children, rest, updater) };
  return next;
}

function insertSibling(
  nodes: ODEIntegratedPlanStructureNode[],
  path: StructurePath,
  node: ODEIntegratedPlanStructureNode,
  after: boolean
): ODEIntegratedPlanStructureNode[] {
  const [index, ...rest] = path;
  if (index === undefined || index < 0 || index >= nodes.length) return nodes;
  const next = [...nodes];
  if (rest.length === 0) {
    next.splice(index + (after ? 1 : 0), 0, node);
    return next;
  }
  next[index] = { ...next[index], children: insertSibling(next[index].children, rest, node, after) };
  return next;
}

function removeNodeAtPath(
  nodes: ODEIntegratedPlanStructureNode[],
  path: StructurePath
): { nodes: ODEIntegratedPlanStructureNode[]; removed: ODEIntegratedPlanStructureNode | null } {
  const [index, ...rest] = path;
  if (index === undefined || index < 0 || index >= nodes.length) return { nodes, removed: null };
  const next = [...nodes];
  if (rest.length === 0) {
    const [removed] = next.splice(index, 1);
    return { nodes: next, removed: removed ?? null };
  }
  const child = removeNodeAtPath(next[index].children, rest);
  if (!child.removed) return { nodes, removed: null };
  next[index] = { ...next[index], children: child.nodes };
  return { nodes: next, removed: child.removed };
}

function appendChild(
  nodes: ODEIntegratedPlanStructureNode[],
  path: StructurePath,
  child: ODEIntegratedPlanStructureNode
): ODEIntegratedPlanStructureNode[] {
  const [index, ...rest] = path;
  if (index === undefined || index < 0 || index >= nodes.length) return nodes;
  const next = [...nodes];
  next[index] =
    rest.length === 0
      ? { ...next[index], children: [...next[index].children, child] }
      : { ...next[index], children: appendChild(next[index].children, rest, child) };
  return next;
}

function moveIn(
  nodes: ODEIntegratedPlanStructureNode[],
  path: StructurePath
): { nodes: ODEIntegratedPlanStructureNode[]; nextKey: string | null } {
  const previousSiblingIndex = path[path.length - 1] - 1;
  if (previousSiblingIndex < 0) return { nodes, nextKey: null };
  const previousPath = [...path];
  previousPath[previousPath.length - 1] = previousSiblingIndex;
  const previousNode = getNodeAtPath(nodes, previousPath);
  if (!previousNode) return { nodes, nextKey: null };
  const removal = removeNodeAtPath(nodes, path);
  if (!removal.removed) return { nodes, nextKey: null };
  const nextNodes = appendChild(removal.nodes, previousPath, removal.removed);
  return {
    nodes: nextNodes,
    nextKey: keyFromPath([...previousPath, previousNode.children.length])
  };
}

function moveOut(
  nodes: ODEIntegratedPlanStructureNode[],
  path: StructurePath
): { nodes: ODEIntegratedPlanStructureNode[]; nextKey: string | null } {
  if (path.length <= 1) return { nodes, nextKey: null };
  const parentPath = path.slice(0, -1);
  const removal = removeNodeAtPath(nodes, path);
  if (!removal.removed) return { nodes, nextKey: null };
  const nextNodes = insertSibling(removal.nodes, parentPath, removal.removed, true);
  return {
    nodes: nextNodes,
    nextKey: keyFromPath([...parentPath.slice(0, -1), parentPath[parentPath.length - 1] + 1])
  };
}

function cloneTask(task: ODEWorkstreamTaskItem): ODEWorkstreamTaskItem {
  return { ...task, id: createId("task") };
}

function cloneDeliverable(deliverable: ODEIntegratedPlanProposalItem): ODEIntegratedPlanProposalItem {
  const nextId = createId("deliverable");
  return {
    ...deliverable,
    id: nextId,
    taskProposal: {
      ...deliverable.taskProposal,
      deliverableId: nextId,
      sections: deliverable.taskProposal.sections.map((section) =>
        section.type === "tasks" ? { ...section, items: section.items.map(cloneTask) } : section
      )
    }
  };
}

function buildFlatTasks(deliverables: ODEIntegratedPlanProposalItem[]): FlatTaskRow[] {
  return deliverables.flatMap((deliverable) => {
    const section = deliverable.taskProposal.sections.find((entry) => entry.type === "tasks");
    return (section?.items ?? []).map((task) => ({
      key: `${deliverable.id}::${task.id}`,
      deliverableId: deliverable.id,
      task
    }));
  });
}

export function IntegratedPlanPreviewModal({
  open,
  t,
  proposal,
  nodeTitle,
  onClose,
  onConfirm,
  onChangeProposal
}: IntegratedPlanPreviewModalProps) {
  const { surfaceRef, surfaceStyle, handlePointerDown } = useDraggableModalSurface({ open });
  const [activeTab, setActiveTab] = useState<"structure" | "deliverables" | "tasks">("deliverables");
  const [selectedStructureKey, setSelectedStructureKey] = useState<string | null>(null);
  const [selectedDeliverableId, setSelectedDeliverableId] = useState<string | null>(null);
  const [selectedTaskKey, setSelectedTaskKey] = useState<string | null>(null);
  const structureRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const structureInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const deliverableRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const deliverableInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const taskRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const taskInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const structureClipboardRef = useRef<StructureClipboard>(null);
  const deliverableClipboardRef = useRef<DeliverableClipboard>(null);
  const taskClipboardRef = useRef<TaskClipboard>(null);

  const structureRows = useMemo(() => (proposal ? flattenStructure(proposal.structure.nodes) : []), [proposal]);
  const taskRows = useMemo(() => (proposal ? buildFlatTasks(proposal.deliverables) : []), [proposal]);
  const totalTaskCount = taskRows.length;

  const focusCurrentInput = () => {
    window.requestAnimationFrame(() => {
      if (activeTab === "structure" && selectedStructureKey) {
        const input = structureInputRefs.current.get(selectedStructureKey);
        input?.focus();
        input?.select();
        return;
      }
      if (activeTab === "deliverables" && selectedDeliverableId) {
        const input = deliverableInputRefs.current.get(selectedDeliverableId);
        input?.focus();
        input?.select();
        return;
      }
      if (activeTab === "tasks" && selectedTaskKey) {
        const input = taskInputRefs.current.get(selectedTaskKey);
        input?.focus();
        input?.select();
      }
    });
  };

  useEffect(() => {
    if (!open || !proposal) {
      setSelectedStructureKey(null);
      setSelectedDeliverableId(null);
      setSelectedTaskKey(null);
      structureClipboardRef.current = null;
      deliverableClipboardRef.current = null;
      taskClipboardRef.current = null;
      return;
    }
    setActiveTab("deliverables");
    setSelectedStructureKey((current) => (current && structureRows.some((row) => row.key === current) ? current : (structureRows[0]?.key ?? null)));
    setSelectedDeliverableId((current) =>
      current && proposal.deliverables.some((deliverable) => deliverable.id === current) ? current : (proposal.deliverables[0]?.id ?? null)
    );
    setSelectedTaskKey((current) => (current && taskRows.some((row) => row.key === current) ? current : (taskRows[0]?.key ?? null)));
  }, [open, proposal, structureRows, taskRows]);

  useEffect(() => {
    if (!open) return;
    const selectedKey =
      activeTab === "structure" ? selectedStructureKey : activeTab === "deliverables" ? selectedDeliverableId : selectedTaskKey;
    const rowMap =
      activeTab === "structure" ? structureRowRefs.current : activeTab === "deliverables" ? deliverableRowRefs.current : taskRowRefs.current;
    if (!selectedKey) return;
    const row = rowMap.get(selectedKey);
    if (!row) return;
    const rafId = window.requestAnimationFrame(() => row.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" }));
    return () => window.cancelAnimationFrame(rafId);
  }, [activeTab, open, selectedDeliverableId, selectedStructureKey, selectedTaskKey]);

  useEffect(() => {
    if (!open || !proposal) return;
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable || target.closest("[contenteditable='true']")) return true;
      return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    };
    const updateStructureNodes = (nextNodes: ODEIntegratedPlanStructureNode[], nextSelectedKey?: string | null) => {
      onChangeProposal({ ...proposal, structure: { ...proposal.structure, nodes: nextNodes } });
      if (nextSelectedKey !== undefined) {
        setSelectedStructureKey(nextSelectedKey);
      }
    };

    const insertStructureNode = (path: StructurePath, after: boolean, seed?: ODEIntegratedPlanStructureNode) => {
      const nextNode = seed ?? createBlankNode();
      const insertIndex = path[path.length - 1] + (after ? 1 : 0);
      const nextPath = [...path.slice(0, -1), insertIndex];
      updateStructureNodes(
        insertSibling(proposal.structure.nodes, path, nextNode, after),
        keyFromPath(nextPath)
      );
      setSelectedStructureKey(keyFromPath(nextPath));
      window.requestAnimationFrame(focusCurrentInput);
    };

    const updateDeliverables = (nextDeliverables: ODEIntegratedPlanProposalItem[], nextSelectedId?: string | null) => {
      onChangeProposal({ ...proposal, deliverables: nextDeliverables });
      if (nextSelectedId !== undefined) {
        setSelectedDeliverableId(nextSelectedId);
      }
    };

    const insertDeliverable = (index: number, seed?: ODEIntegratedPlanProposalItem) => {
      const nextItem = seed ?? createBlankDeliverable(proposal.nodeId, proposal.outputLanguage, proposal.sources);
      const nextDeliverables = [...proposal.deliverables];
      const safeIndex = Math.max(0, Math.min(index, nextDeliverables.length));
      nextDeliverables.splice(safeIndex, 0, nextItem);
      updateDeliverables(nextDeliverables, nextItem.id);
      window.requestAnimationFrame(focusCurrentInput);
    };

    const updateTasksForDeliverable = (
      deliverableId: string,
      nextItems: ODEWorkstreamTaskItem[],
      nextSelectedKey?: string | null
    ) => {
      onChangeProposal({
        ...proposal,
        deliverables: proposal.deliverables.map((entry) =>
          entry.id === deliverableId
            ? {
                ...entry,
                taskProposal: {
                  ...entry.taskProposal,
                  sections: entry.taskProposal.sections.map((section) =>
                    section.type === "tasks" ? { ...section, items: nextItems } : section
                  )
                }
              }
            : entry
        )
      });
      if (nextSelectedKey !== undefined) {
        setSelectedTaskKey(nextSelectedKey);
      }
    };

    const insertTask = (deliverableId: string, index: number, seed?: ODEWorkstreamTaskItem) => {
      const nextTask = seed ?? createBlankTask();
      const deliverable = proposal.deliverables.find((entry) => entry.id === deliverableId);
      const taskSection = deliverable?.taskProposal.sections.find((section) => section.type === "tasks");
      if (!deliverable || !taskSection) return;
      const nextItems = [...taskSection.items];
      const safeIndex = Math.max(0, Math.min(index, nextItems.length));
      nextItems.splice(safeIndex, 0, nextTask);
      const nextKey = `${deliverableId}::${nextTask.id}`;
      updateTasksForDeliverable(deliverableId, nextItems, nextKey);
      window.requestAnimationFrame(focusCurrentInput);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) return;
      const hasModifier = event.ctrlKey || event.metaKey;
      const keyLower = event.key.toLowerCase();
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (activeTab === "structure") {
        if (structureRows.length === 0) {
          if (event.key === "Enter" || event.key === "Insert") {
            event.preventDefault();
            updateStructureNodes([createBlankNode()], "0");
            window.requestAnimationFrame(focusCurrentInput);
          }
          return;
        }
        const selectedIndex = selectedStructureKey ? structureRows.findIndex((row) => row.key === selectedStructureKey) : -1;
        const selectedRow = selectedIndex >= 0 ? structureRows[selectedIndex] : null;
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSelectedStructureKey(structureRows[Math.max(0, selectedIndex > 0 ? selectedIndex - 1 : 0)]?.key ?? null);
          return;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSelectedStructureKey(structureRows[Math.min(structureRows.length - 1, (selectedIndex >= 0 ? selectedIndex : 0) + 1)]?.key ?? null);
          return;
        }
        if (event.key === "Home") {
          event.preventDefault();
          setSelectedStructureKey(structureRows[0]?.key ?? null);
          return;
        }
        if (event.key === "End") {
          event.preventDefault();
          setSelectedStructureKey(structureRows[structureRows.length - 1]?.key ?? null);
          return;
        }
        if (!selectedRow) return;
        if (hasModifier && keyLower === "c") {
          event.preventDefault();
          structureClipboardRef.current = {
            mode: "copy",
            sourceKey: selectedRow.key,
            payload: cloneStructureNode(selectedRow.node)
          };
          return;
        }
        if (hasModifier && keyLower === "x") {
          event.preventDefault();
          structureClipboardRef.current = {
            mode: "cut",
            sourceKey: selectedRow.key,
            payload: cloneStructureNode(selectedRow.node)
          };
          return;
        }
        if (hasModifier && keyLower === "v") {
          event.preventDefault();
          const clipboard = structureClipboardRef.current;
          if (!clipboard) return;
          if (clipboard.mode === "cut") {
            const sourceRow = flattenStructure(proposal.structure.nodes).find((row) => row.key === clipboard.sourceKey);
            if (!sourceRow) {
              structureClipboardRef.current = null;
              return;
            }
            const removal = removeNodeAtPath(proposal.structure.nodes, sourceRow.path);
            if (!removal.removed) {
              structureClipboardRef.current = null;
              return;
            }
            const destinationRow = flattenStructure(removal.nodes).find((row) => row.key === selectedRow.key) ?? null;
            if (!destinationRow) {
              structureClipboardRef.current = null;
              return;
            }
            const nextNodes = insertSibling(removal.nodes, destinationRow.path, removal.removed, true);
            const nextKey = keyFromPath([...destinationRow.path.slice(0, -1), destinationRow.path[destinationRow.path.length - 1] + 1]);
            updateStructureNodes(nextNodes, nextKey);
            structureClipboardRef.current = null;
            return;
          }
          insertStructureNode(selectedRow.path, true, cloneStructureNode(clipboard.payload));
          return;
        }
        if (event.key === "F2") {
          event.preventDefault();
          focusCurrentInput();
          return;
        }
        if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          const result = removeNodeAtPath(proposal.structure.nodes, selectedRow.path);
          const nextRows = flattenStructure(result.nodes);
          const nextSelected = nextRows[Math.min(selectedIndex, nextRows.length - 1)]?.key ?? null;
          updateStructureNodes(result.nodes, nextSelected);
          return;
        }
        if (hasModifier && keyLower === "d") {
          event.preventDefault();
          insertStructureNode(selectedRow.path, true, cloneStructureNode(selectedRow.node));
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          insertStructureNode(selectedRow.path, !event.shiftKey);
          return;
        }
        if (!event.shiftKey && (event.key === "Tab" || (event.altKey && event.shiftKey && event.key === "ArrowRight"))) {
          event.preventDefault();
          const result = moveIn(proposal.structure.nodes, selectedRow.path);
          if (result.nextKey) {
            onChangeProposal({ ...proposal, structure: { ...proposal.structure, nodes: result.nodes } });
            setSelectedStructureKey(result.nextKey);
          }
          return;
        }
        if ((event.key === "Tab" && event.shiftKey) || (event.altKey && event.shiftKey && event.key === "ArrowLeft")) {
          event.preventDefault();
          const result = moveOut(proposal.structure.nodes, selectedRow.path);
          if (result.nextKey) {
            onChangeProposal({ ...proposal, structure: { ...proposal.structure, nodes: result.nodes } });
            setSelectedStructureKey(result.nextKey);
          }
          return;
        }
        return;
      }

      if (activeTab === "deliverables") {
        if (proposal.deliverables.length === 0) {
          if (event.key === "Enter" || event.key === "Insert") {
            event.preventDefault();
            insertDeliverable(0);
          }
          return;
        }
        const selectedIndex = selectedDeliverableId ? proposal.deliverables.findIndex((deliverable) => deliverable.id === selectedDeliverableId) : -1;
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSelectedDeliverableId(proposal.deliverables[Math.max(0, selectedIndex > 0 ? selectedIndex - 1 : 0)]?.id ?? null);
          return;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSelectedDeliverableId(proposal.deliverables[Math.min(proposal.deliverables.length - 1, (selectedIndex >= 0 ? selectedIndex : 0) + 1)]?.id ?? null);
          return;
        }
        if (event.key === "Home") {
          event.preventDefault();
          setSelectedDeliverableId(proposal.deliverables[0]?.id ?? null);
          return;
        }
        if (event.key === "End") {
          event.preventDefault();
          setSelectedDeliverableId(proposal.deliverables[proposal.deliverables.length - 1]?.id ?? null);
          return;
        }
        if (!selectedDeliverableId || selectedIndex < 0) return;
        if (hasModifier && keyLower === "c") {
          event.preventDefault();
          deliverableClipboardRef.current = {
            mode: "copy",
            sourceId: selectedDeliverableId,
            payload: cloneDeliverable(proposal.deliverables[selectedIndex])
          };
          return;
        }
        if (hasModifier && keyLower === "x") {
          event.preventDefault();
          deliverableClipboardRef.current = {
            mode: "cut",
            sourceId: selectedDeliverableId,
            payload: cloneDeliverable(proposal.deliverables[selectedIndex])
          };
          return;
        }
        if (hasModifier && keyLower === "v") {
          event.preventDefault();
          const clipboard = deliverableClipboardRef.current;
          if (!clipboard) return;
          if (clipboard.mode === "cut") {
            const sourceIndex = proposal.deliverables.findIndex((deliverable) => deliverable.id === clipboard.sourceId);
            if (sourceIndex < 0) {
              deliverableClipboardRef.current = null;
              return;
            }
            const movingItem = proposal.deliverables[sourceIndex];
            const remaining = proposal.deliverables.filter((deliverable) => deliverable.id !== clipboard.sourceId);
            const adjustedInsertIndex = sourceIndex < selectedIndex + 1 ? selectedIndex : selectedIndex + 1;
            const nextDeliverables = [...remaining];
            nextDeliverables.splice(Math.max(0, Math.min(adjustedInsertIndex, nextDeliverables.length)), 0, movingItem);
            updateDeliverables(nextDeliverables, movingItem.id);
            deliverableClipboardRef.current = null;
            return;
          }
          insertDeliverable(selectedIndex + 1, cloneDeliverable(clipboard.payload));
          return;
        }
        if (event.key === "F2") {
          event.preventDefault();
          focusCurrentInput();
          return;
        }
        if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          const nextDeliverables = proposal.deliverables.filter((deliverable) => deliverable.id !== selectedDeliverableId);
          const fallback = nextDeliverables[selectedIndex] ?? nextDeliverables[Math.max(0, selectedIndex - 1)] ?? null;
          updateDeliverables(nextDeliverables, fallback?.id ?? null);
          return;
        }
        if (hasModifier && keyLower === "d") {
          event.preventDefault();
          insertDeliverable(selectedIndex + 1, cloneDeliverable(proposal.deliverables[selectedIndex]));
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          insertDeliverable(event.shiftKey ? selectedIndex : selectedIndex + 1);
          return;
        }
        return;
      }

      if (taskRows.length === 0) {
        if ((event.key === "Enter" || event.key === "Insert") && proposal.deliverables.length > 0) {
          event.preventDefault();
          insertTask(selectedDeliverableId ?? proposal.deliverables[0].id, 0);
        }
        return;
      }
      const selectedRow = selectedTaskKey ? taskRows.find((row) => row.key === selectedTaskKey) ?? null : null;
      const selectedIndex = selectedTaskKey ? taskRows.findIndex((row) => row.key === selectedTaskKey) : -1;
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedTaskKey(taskRows[Math.max(0, selectedIndex > 0 ? selectedIndex - 1 : 0)]?.key ?? null);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedTaskKey(taskRows[Math.min(taskRows.length - 1, (selectedIndex >= 0 ? selectedIndex : 0) + 1)]?.key ?? null);
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        setSelectedTaskKey(taskRows[0]?.key ?? null);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        setSelectedTaskKey(taskRows[taskRows.length - 1]?.key ?? null);
        return;
      }
      if (!selectedRow) return;
      if (hasModifier && keyLower === "c") {
        event.preventDefault();
        taskClipboardRef.current = {
          mode: "copy",
          sourceKey: selectedRow.key,
          sourceDeliverableId: selectedRow.deliverableId,
          payload: cloneTask(selectedRow.task)
        };
        return;
      }
      if (hasModifier && keyLower === "x") {
        event.preventDefault();
        taskClipboardRef.current = {
          mode: "cut",
          sourceKey: selectedRow.key,
          sourceDeliverableId: selectedRow.deliverableId,
          payload: cloneTask(selectedRow.task)
        };
        return;
      }
      if (event.key === "F2") {
        event.preventDefault();
        focusCurrentInput();
        return;
      }
      const deliverable = proposal.deliverables.find((entry) => entry.id === selectedRow.deliverableId);
      const taskSection = deliverable?.taskProposal.sections.find((section) => section.type === "tasks");
      const taskIndex = taskSection?.items.findIndex((task) => task.id === selectedRow.task.id) ?? -1;
      if (!deliverable || !taskSection || taskIndex < 0) return;
      if (hasModifier && keyLower === "v") {
        event.preventDefault();
        const clipboard = taskClipboardRef.current;
        if (!clipboard) return;
        if (clipboard.mode === "cut") {
          const sourceRow = buildFlatTasks(proposal.deliverables).find((row) => row.key === clipboard.sourceKey);
          if (!sourceRow) {
            taskClipboardRef.current = null;
            return;
          }
          const sourceDeliverable = proposal.deliverables.find((entry) => entry.id === sourceRow.deliverableId);
          const sourceSection = sourceDeliverable?.taskProposal.sections.find((section) => section.type === "tasks");
          const sourceIndex = sourceSection?.items.findIndex((task) => task.id === sourceRow.task.id) ?? -1;
          if (!sourceDeliverable || !sourceSection || sourceIndex < 0) {
            taskClipboardRef.current = null;
            return;
          }
          const movingTask = sourceSection.items[sourceIndex];
          const nextDeliverables = proposal.deliverables.map((entry) => {
            if (entry.id === sourceDeliverable.id) {
              return {
                ...entry,
                taskProposal: {
                  ...entry.taskProposal,
                  sections: entry.taskProposal.sections.map((section) =>
                    section.type === "tasks"
                      ? { ...section, items: section.items.filter((task) => task.id !== movingTask.id) }
                      : section
                  )
                }
              };
            }
            return entry;
          });
          const targetDeliverable = nextDeliverables.find((entry) => entry.id === deliverable.id);
          const targetSection = targetDeliverable?.taskProposal.sections.find((section) => section.type === "tasks");
          if (!targetDeliverable || !targetSection) {
            taskClipboardRef.current = null;
            return;
          }
          const targetIndex =
            sourceDeliverable.id === deliverable.id && sourceIndex < taskIndex + 1 ? taskIndex : taskIndex + 1;
          const nextItems = [...targetSection.items];
          nextItems.splice(Math.max(0, Math.min(targetIndex, nextItems.length)), 0, movingTask);
          onChangeProposal({
            ...proposal,
            deliverables: nextDeliverables.map((entry) =>
              entry.id === deliverable.id
                ? {
                    ...entry,
                    taskProposal: {
                      ...entry.taskProposal,
                      sections: entry.taskProposal.sections.map((section) =>
                        section.type === "tasks" ? { ...section, items: nextItems } : section
                      )
                    }
                  }
                : entry
            )
          });
          setSelectedTaskKey(`${deliverable.id}::${movingTask.id}`);
          taskClipboardRef.current = null;
          return;
        }
        insertTask(deliverable.id, taskIndex + 1, cloneTask(clipboard.payload));
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        const nextItems = taskSection.items.filter((task) => task.id !== selectedRow.task.id);
        const fallbackTask = nextItems[taskIndex] ?? nextItems[Math.max(0, taskIndex - 1)] ?? null;
        updateTasksForDeliverable(
          deliverable.id,
          nextItems,
          fallbackTask ? `${deliverable.id}::${fallbackTask.id}` : null
        );
        return;
      }
      if (hasModifier && keyLower === "d") {
        event.preventDefault();
        insertTask(deliverable.id, taskIndex + 1, cloneTask(taskSection.items[taskIndex]));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        insertTask(deliverable.id, event.shiftKey ? taskIndex : taskIndex + 1);
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTab, onChangeProposal, onClose, open, proposal, selectedDeliverableId, selectedStructureKey, selectedTaskKey, structureRows, taskRows]);

  if (!open || !proposal) return null;

  const renderStructureNodes = (nodes: ODEIntegratedPlanStructureNode[], depth = 0, parentPath: number[] = []): JSX.Element[] =>
    nodes.map((node, index) => {
      const path = [...parentPath, index];
      const key = keyFromPath(path);
      return (
        <div key={key} className="space-y-2">
          <div
            ref={(element) => {
              if (element) structureRowRefs.current.set(key, element);
              else structureRowRefs.current.delete(key);
            }}
            className={`rounded-[14px] border px-3 py-3 transition ${
              selectedStructureKey === key
                ? "border-[var(--ode-accent)] bg-[rgba(38,157,214,0.14)]"
                : "border-[rgba(110,211,255,0.12)] bg-[rgba(6,28,44,0.72)]"
            }`}
            style={{ marginLeft: `${depth * 14}px` }}
            onMouseDown={() => setSelectedStructureKey(key)}
          >
            <input
              ref={(element) => {
                if (element) structureInputRefs.current.set(key, element);
                else structureInputRefs.current.delete(key);
              }}
              className="ode-input h-11 w-full rounded-[14px] px-3 text-[0.95rem]"
              value={node.title}
              onFocus={() => setSelectedStructureKey(key)}
              onChange={(event) =>
                onChangeProposal({
                  ...proposal,
                  structure: {
                    ...proposal.structure,
                    nodes: updateNodeAtPath(proposal.structure.nodes, path, (current) => ({ ...current, title: event.target.value }))
                  }
                })
              }
              placeholder={t("procedure.inline_title_placeholder")}
            />
            {(node.suggested_role || node.estimated_effort) ? (
              <div className="mt-1 text-[0.8rem] text-[var(--ode-text-muted)]">
                {[node.suggested_role, node.estimated_effort].filter((value) => value.trim().length > 0).join(" / ")}
              </div>
            ) : null}
            {node.description ? <p className="mt-2 text-[0.84rem] leading-6 text-[var(--ode-text-dim)]">{node.description}</p> : null}
          </div>
          {node.children.length > 0 ? <div className="space-y-2">{renderStructureNodes(node.children, depth + 1, path)}</div> : null}
        </div>
      );
    });

  return (
    <div
      className="ode-overlay-scrim fixed inset-0 z-[171] flex items-center justify-center p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return;
        onClose();
      }}
    >
      <div
        ref={surfaceRef}
        style={surfaceStyle}
        className="ode-modal flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] border border-[var(--ode-border-strong)]"
      >
        <div
          className="ode-modal-drag-handle flex items-start justify-between gap-4 border-b border-[var(--ode-border)] px-6 py-5"
          onPointerDown={handlePointerDown}
        >
          <div className="min-w-0">
            <h2 className="text-[1.2rem] font-semibold tracking-tight text-[var(--ode-accent)]">{t("procedure.integrated_ai_preview_title")}</h2>
          </div>
          <button type="button" className="ode-icon-btn h-10 w-10" onClick={onClose} aria-label={t("settings.cancel")}>x</button>
        </div>
        <div className="border-b border-[var(--ode-border)] px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            {[
              { key: "deliverables" as const, label: `${t("procedure.integrated_ai_tab_deliverables")} (${proposal.deliverables.length})` },
              { key: "tasks" as const, label: `${t("procedure.integrated_ai_tab_tasks")} (${totalTaskCount})` }
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`rounded-full border px-4 py-2 text-[0.82rem] uppercase tracking-[0.12em] transition ${activeTab === tab.key ? "border-[var(--ode-accent)] bg-[rgba(38,157,214,0.18)] text-[var(--ode-text)]" : "border-[var(--ode-border)] bg-[rgba(4,24,39,0.42)] text-[var(--ode-text-muted)]"}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-y-auto px-6 py-5">
          <div className="space-y-4">
            {activeTab === "deliverables" ? (
              <div className="space-y-3">
                {proposal.deliverables.map((deliverable) => (
                  <div
                    key={deliverable.id}
                    ref={(element) => {
                      if (element) deliverableRowRefs.current.set(deliverable.id, element);
                      else deliverableRowRefs.current.delete(deliverable.id);
                    }}
                    className={`rounded-[16px] border px-4 py-3 transition ${selectedDeliverableId === deliverable.id ? "border-[var(--ode-accent)] bg-[rgba(38,157,214,0.14)]" : "border-[rgba(110,211,255,0.14)] bg-[rgba(4,24,39,0.6)]"}`}
                    onMouseDown={() => setSelectedDeliverableId(deliverable.id)}
                  >
                    <input
                      ref={(element) => {
                        if (element) deliverableInputRefs.current.set(deliverable.id, element);
                        else deliverableInputRefs.current.delete(deliverable.id);
                      }}
                      className="ode-input h-11 w-full rounded-[14px] px-3 text-[0.95rem]"
                      value={deliverable.title}
                      onFocus={() => setSelectedDeliverableId(deliverable.id)}
                      onChange={(event) =>
                        onChangeProposal({
                          ...proposal,
                          deliverables: proposal.deliverables.map((item) =>
                            item.id === deliverable.id ? { ...item, title: event.target.value, taskProposal: { ...item.taskProposal, title: event.target.value } } : item
                          )
                        })
                      }
                      placeholder={t("procedure.node_deliverable_placeholder")}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {proposal.deliverables.map((deliverable) => {
                  const taskSection = deliverable.taskProposal.sections.find((section) => section.type === "tasks");
                  const tasks = taskSection?.items ?? [];
                  return (
                    <div key={`tasks-${deliverable.id}`} className="rounded-[18px] border border-[rgba(110,211,255,0.14)] bg-[rgba(4,24,39,0.6)] px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="ode-wrap-text text-[0.98rem] font-semibold text-[var(--ode-text)]">{deliverable.title}</div>
                        <div className="text-[0.82rem] text-[var(--ode-text-muted)]">{tasks.length} task(s)</div>
                      </div>
                      <div className="mt-3 space-y-3">
                        {tasks.map((task) => {
                          const taskKey = `${deliverable.id}::${task.id}`;
                          return (
                            <div
                              key={task.id}
                              ref={(element) => {
                                if (element) taskRowRefs.current.set(taskKey, element);
                                else taskRowRefs.current.delete(taskKey);
                              }}
                              className={`rounded-[14px] border px-3 py-3 transition ${selectedTaskKey === taskKey ? "border-[var(--ode-accent)] bg-[rgba(38,157,214,0.14)]" : "border-[rgba(110,211,255,0.12)] bg-[rgba(6,28,44,0.72)]"}`}
                              onMouseDown={() => setSelectedTaskKey(taskKey)}
                            >
                              <input
                                ref={(element) => {
                                  if (element) taskInputRefs.current.set(taskKey, element);
                                  else taskInputRefs.current.delete(taskKey);
                                }}
                                className="ode-input h-11 w-full rounded-[14px] px-3 text-[0.95rem]"
                                value={task.title}
                                onFocus={() => setSelectedTaskKey(taskKey)}
                                onChange={(event) =>
                                  onChangeProposal({
                                    ...proposal,
                                    deliverables: proposal.deliverables.map((item) =>
                                      item.id === deliverable.id
                                        ? {
                                            ...item,
                                            taskProposal: {
                                              ...item.taskProposal,
                                              sections: item.taskProposal.sections.map((section) =>
                                                section.type === "tasks" ? { ...section, items: section.items.map((taskItem) => (taskItem.id === task.id ? { ...taskItem, title: event.target.value } : taskItem)) } : section
                                              )
                                            }
                                          }
                                        : item
                                    )
                                  })
                                }
                                placeholder={t("procedure.node_task_placeholder")}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-[var(--ode-border)] px-6 py-4">
          <button type="button" className="ode-text-btn h-11 px-5" onClick={onClose}>{t("procedure.ai_reject")}</button>
          <button type="button" className="ode-primary-btn h-11 px-5" onClick={onConfirm}>{t("procedure.ai_accept")}</button>
        </div>
      </div>
    </div>
  );
}
