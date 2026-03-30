import type { Dispatch, SetStateAction } from "react";
import {
  resolveClipboardFocusId,
  resolveClipboardPasteLocation,
  resolveDuplicatePlacement,
  resolveMovableClipboardSourceIds,
  shouldBeginInlineEditAfterClipboardMutation
} from "@/features/workspace/clipboard";
import type { SelectionSurface } from "@/features/workspace/viewMode";
import { getNodeMirrorFilePath } from "@/lib/iconSupport";
import {
  createNode,
  importFilesToNode,
  moveNode,
  renameNode,
  setWindowsClipboardFilePaths,
  updateNodeProperties
} from "@/lib/nodeService";
import { ROOT_PARENT_ID, isFileLikeNode, type AppNode, type ODEExecutionTaskItem } from "@/lib/types";
import type { TranslationParams } from "@/lib/i18n";

type TranslateFn = (key: string, params?: TranslationParams) => string;

export type BranchSnapshot = {
  name: string;
  type: AppNode["type"];
  properties?: Record<string, unknown>;
  children: BranchSnapshot[];
};

export type ExecutionTaskClipboardItem = {
  sourceNodeId: string;
  ownerNodeId: string;
  deliverableId: string;
  task: ODEExecutionTaskItem;
  order: number;
};

export type BranchTreeClipboard = {
  kind?: "branch";
  mode: "copy" | "cut";
  sourceNodeId: string;
  sourceNodeIds: string[];
  root: BranchSnapshot;
  roots: BranchSnapshot[];
  copiedAt: number;
  sourceApp: "odetool-rebuild";
};

export type ExecutionTaskClipboard = {
  kind: "execution_tasks";
  mode: "copy" | "cut";
  sourceNodeId: string;
  sourceNodeIds: string[];
  items: ExecutionTaskClipboardItem[];
  copiedAt: number;
  sourceApp: "odetool-rebuild";
};

export type BranchClipboard = BranchTreeClipboard | ExecutionTaskClipboard;

export type ClipboardMutationResult = {
  createdNodeIds: string[];
  focusNodeId?: string | null;
  surface?: SelectionSurface;
};

type UseBranchClipboardActionsParams = {
  t: TranslateFn;
  selectedNode: AppNode | null;
  nodeById: Map<string, AppNode>;
  byParent: Map<string, AppNode[]>;
  currentFolderId: string | null;
  activeProjectRootId: string | null;
  isDesktopRuntime: boolean;
  branchClipboard: BranchClipboard | null;
  setBranchClipboard: Dispatch<SetStateAction<BranchClipboard | null>>;
  isNodeInSubtree: (ancestorId: string, candidateId: string) => boolean;
  setSelectionFromIds: (nodeIds: string[], focusId?: string | null, surface?: SelectionSurface) => void;
  resolveBranchSourceIds: (sourceNodeId?: string | null, surface?: SelectionSurface) => string[];
  beginInlineEdit: (nodeId: string, initialText?: string, preferredSurface?: SelectionSurface) => void;
  refreshTreeAndKeepContext: (
    nextSelectedNodeId?: string,
    expandNodeIds?: string[],
    preferredSurface?: SelectionSurface,
    nextFolderId?: string | null
  ) => Promise<void>;
  writeBranchClipboardToSystem: (payload: BranchClipboard) => Promise<void>;
  readBranchClipboardFromSystem: () => Promise<BranchClipboard | null>;
  clearBranchClipboardFromSystem: () => Promise<void>;
  pasteExternalFilesFromClipboard: (targetNodeId?: string | null, surface?: SelectionSurface) => Promise<void | boolean>;
  buildCopyNameWithSuffix: (name: string, nodeType: AppNode["type"], copySuffix: string) => string;
  ensureStructureMutationAllowed: (
    nodeIds: Array<string | null | undefined>,
    options?: { scope?: "organization" | "workarea" | "content" }
  ) => boolean;
  buildSpecialClipboard?: (
    mode: "copy" | "cut",
    sourceNodeIds: string[]
  ) => Promise<BranchClipboard | null>;
  pasteSpecialClipboard?: (
    clipboard: ExecutionTaskClipboard,
    targetNodeId?: string | null,
    surface?: SelectionSurface
  ) => Promise<ClipboardMutationResult | null>;
  duplicateSpecialNodes?: (
    sourceNodeIds: string[],
    surface?: SelectionSurface
  ) => Promise<ClipboardMutationResult | null>;
};

let executionTaskCloneCounter = 0;
function createExecutionTaskCloneId(): string {
  executionTaskCloneCounter += 1;
  return `ode-execution-task-${Date.now()}-${executionTaskCloneCounter}`;
}

function isExecutionProjectionNode(node: AppNode | null | undefined): boolean {
  return Boolean(node && node.type === "task" && node.properties?.odeExecutionTask === true);
}

function buildSnapshot(
  rootNodeId: string,
  nodeById: Map<string, AppNode>,
  byParent: Map<string, AppNode[]>
): BranchSnapshot | null {
  const source = nodeById.get(rootNodeId);
  if (!source) return null;
  if (isExecutionProjectionNode(source)) return null;
  const children = byParent.get(rootNodeId) ?? [];
  return {
    name: source.name,
    type: source.type,
    properties: source.properties as Record<string, unknown> | undefined,
    children: children
      .filter((child) => !isExecutionProjectionNode(child))
      .map((child) => buildSnapshot(child.id, nodeById, byParent))
      .filter((item): item is BranchSnapshot => Boolean(item))
  };
}

async function cloneSnapshot(
  snapshot: BranchSnapshot,
  parentId: string | null,
  afterId: string | null,
  rootNameOverride?: string
): Promise<string> {
  const snapshotProperties = (snapshot.properties ?? {}) as Record<string, unknown>;
  const snapshotMirrorPath =
    typeof snapshotProperties.mirrorFilePath === "string" ? snapshotProperties.mirrorFilePath.trim() : "";
  const sanitizedSnapshotProperties: Record<string, unknown> = { ...snapshotProperties };
  delete sanitizedSnapshotProperties.mirrorFilePath;
  delete sanitizedSnapshotProperties.importedFromPath;
  delete sanitizedSnapshotProperties.sizeBytes;

  if (snapshot.type === "file" && snapshotMirrorPath.length > 0) {
    try {
      const imported = await importFilesToNode(parentId, [snapshotMirrorPath]);
      const createdFromImport = imported[0];
      if (createdFromImport) {
        await moveNode(createdFromImport.id, parentId, afterId);
        if (rootNameOverride && rootNameOverride.trim() && rootNameOverride !== createdFromImport.name) {
          await renameNode(createdFromImport.id, rootNameOverride);
        }
        if (Object.keys(sanitizedSnapshotProperties).length > 0) {
          await updateNodeProperties(createdFromImport.id, {
            ...(createdFromImport.properties ?? {}),
            ...sanitizedSnapshotProperties
          });
        }
        return createdFromImport.id;
      }
    } catch {
      // Fall through to generic clone behavior when source file copy is unavailable.
    }
  }

  const created = await createNode(parentId, rootNameOverride ?? snapshot.name, snapshot.type);
  await moveNode(created.id, parentId, afterId);
  const fallbackProperties =
    snapshot.type === "file" ? sanitizedSnapshotProperties : snapshot.properties;
  if (fallbackProperties && Object.keys(fallbackProperties).length > 0) {
    const nextProperties = { ...fallbackProperties };
    if (snapshot.type === "task" && nextProperties.odeExecutionTask === true) {
      nextProperties.odeExecutionTaskId = createExecutionTaskCloneId();
      nextProperties.odeExecutionTaskTitle = rootNameOverride ?? snapshot.name;
      if (typeof parentId === "string" && parentId.trim().length > 0) {
        nextProperties.odeExecutionOwnerNodeId = parentId;
      }
    }
    await updateNodeProperties(created.id, nextProperties);
  }

  let previousChildId: string | null = null;
  for (const child of snapshot.children) {
    previousChildId = await cloneSnapshot(child, created.id, previousChildId);
  }
  return created.id;
}

export function useBranchClipboardActions({
  t,
  selectedNode,
  nodeById,
  byParent,
  currentFolderId,
  activeProjectRootId,
  isDesktopRuntime,
  branchClipboard,
  setBranchClipboard,
  isNodeInSubtree,
  setSelectionFromIds,
  resolveBranchSourceIds,
  beginInlineEdit,
  refreshTreeAndKeepContext,
  writeBranchClipboardToSystem,
  readBranchClipboardFromSystem,
  clearBranchClipboardFromSystem,
  pasteExternalFilesFromClipboard,
  buildCopyNameWithSuffix,
  ensureStructureMutationAllowed,
  buildSpecialClipboard,
  pasteSpecialClipboard,
  duplicateSpecialNodes
}: UseBranchClipboardActionsParams) {
  const resolveNodeIdsMutationScope = (nodeIds: string[]): "organization" | "workarea" | "content" => {
    if (nodeIds.length === 0) return "organization";
    if (nodeIds.every((nodeId) => isFileLikeNode(nodeById.get(nodeId) ?? null))) {
      return "content";
    }
    if (
      nodeIds.every((nodeId) => {
        const node = nodeById.get(nodeId) ?? null;
        return Boolean(node && (node.properties?.odeWorkareaItem === true || node.properties?.odeExecutionTask === true));
      })
    ) {
      return "workarea";
    }
    return "organization";
  };

  const resolveSnapshotMutationScope = (
    snapshots: BranchSnapshot[]
  ): "organization" | "workarea" | "content" => {
    if (snapshots.length === 0) return "organization";
    if (snapshots.every((snapshot) => snapshot.type === "file" || snapshot.type === "document" || snapshot.type === "report" || snapshot.type === "minutes")) {
      return "content";
    }
    if (snapshots.every((snapshot) => snapshot.properties?.odeWorkareaItem === true || snapshot.properties?.odeExecutionTask === true)) {
      return "workarea";
    }
    return "organization";
  };

  const collectFilePathsForClipboardExport = (sourceNodeIds: string[]): string[] => {
    const uniquePaths = new Set<string>();
    for (const nodeId of sourceNodeIds) {
      const node = nodeById.get(nodeId);
      if (!node || node.type !== "file") continue;
      const mirrorPath = getNodeMirrorFilePath(node);
      if (!mirrorPath) continue;
      uniquePaths.add(mirrorPath);
    }
    return Array.from(uniquePaths);
  };

  const copySelectedBranch = async (mode: "copy" | "cut", sourceNodeId?: string) => {
    const sourceIds = resolveBranchSourceIds(sourceNodeId);
    if (sourceIds.length === 0) return;
    if (mode === "cut" && activeProjectRootId && sourceIds.some((sourceId) => sourceId === activeProjectRootId)) {
      return;
    }
    if (
      mode === "cut" &&
      !ensureStructureMutationAllowed(sourceIds, {
        scope: resolveNodeIdsMutationScope(sourceIds)
      })
    ) {
      return;
    }
    const specialClipboard = buildSpecialClipboard ? await buildSpecialClipboard(mode, sourceIds) : null;
    if (specialClipboard) {
      setBranchClipboard(specialClipboard);
      await writeBranchClipboardToSystem(specialClipboard);
      return;
    }
    const snapshots = sourceIds
      .map((sourceId) => {
        const snapshot = buildSnapshot(sourceId, nodeById, byParent);
        return snapshot ? { sourceId, snapshot } : null;
      })
      .filter((item): item is { sourceId: string; snapshot: BranchSnapshot } => Boolean(item));
    if (snapshots.length === 0) return;

    const resolvedSourceIds = snapshots.map((item) => item.sourceId);
    const roots = snapshots.map((item) => item.snapshot);
    const payload: BranchClipboard = {
      mode,
      sourceNodeId: resolvedSourceIds[0],
      sourceNodeIds: resolvedSourceIds,
      root: roots[0],
      roots,
      copiedAt: Date.now(),
      sourceApp: "odetool-rebuild"
    };
    setBranchClipboard(payload);
    await writeBranchClipboardToSystem(payload);
    if (isDesktopRuntime) {
      const filePaths = collectFilePathsForClipboardExport(resolvedSourceIds);
      if (filePaths.length > 0) {
        try {
          await setWindowsClipboardFilePaths(filePaths);
        } catch {
          // Keep branch clipboard available even if file clipboard export fails.
        }
      }
    }
  };

  const pasteClipboardBranch = async (
    targetNodeId?: string | null,
    surface: SelectionSurface = "tree"
  ): Promise<boolean> => {
    const pastedExternalFiles = await pasteExternalFilesFromClipboard(targetNodeId, surface);
    if (pastedExternalFiles) return true;

    const systemClipboard = await readBranchClipboardFromSystem();
    const clipboard = systemClipboard ?? branchClipboard;
    if (!clipboard) {
      return false;
    }
    if (!branchClipboard || systemClipboard) {
      setBranchClipboard(clipboard);
    }

    const targetNode =
      targetNodeId === undefined ? selectedNode : targetNodeId ? nodeById.get(targetNodeId) ?? null : null;

    if (clipboard.kind === "execution_tasks") {
      const result = pasteSpecialClipboard
        ? await pasteSpecialClipboard(clipboard, targetNode?.id ?? targetNodeId, surface)
        : null;
      if (result && result.createdNodeIds.length > 0) {
        if (clipboard.mode === "cut") {
          setBranchClipboard(null);
          await clearBranchClipboardFromSystem();
        }
        setSelectionFromIds(
          result.createdNodeIds,
          result.focusNodeId ?? result.createdNodeIds[result.createdNodeIds.length - 1] ?? result.createdNodeIds[0],
          result.surface ?? surface
        );
        return true;
      }
      return false;
    }

    const clipboardSourceIds = clipboard.sourceNodeIds.length > 0 ? clipboard.sourceNodeIds : [clipboard.sourceNodeId];
    const clipboardRoots = clipboard.roots.length > 0 ? clipboard.roots : [clipboard.root];
    const clipboardSourceIdSet = new Set(clipboardSourceIds);
    const clipboardMutationScope = resolveSnapshotMutationScope(clipboardRoots);

    const { parentId, targetParentKey, afterId } = resolveClipboardPasteLocation({
      targetNode,
      surface,
      currentFolderId,
      activeProjectRootId,
      byParent,
      excludedNodeIds: clipboardSourceIdSet
    });
    if (!ensureStructureMutationAllowed([parentId], { scope: clipboardMutationScope })) {
      return false;
    }

    const canMoveAllSources =
      clipboard.mode === "cut" && clipboardSourceIds.length > 0 && clipboardSourceIds.every((sourceId) => nodeById.has(sourceId));
    if (canMoveAllSources) {
      const movableSourceIds = resolveMovableClipboardSourceIds({
        sourceNodeIds: clipboardSourceIds,
        targetNode,
        parentId,
        nodeById,
        isNodeInSubtree
      });
      if (movableSourceIds.length === 0) return true;
      if (!ensureStructureMutationAllowed(movableSourceIds, { scope: clipboardMutationScope })) {
        return false;
      }

      const refreshParentIds = new Set<string>([targetParentKey]);
      let nextAfterId = afterId;
      for (let index = 0; index < movableSourceIds.length; index += 1) {
        const sourceId = movableSourceIds[index];
        const sourceNode = nodeById.get(sourceId);
        if (!sourceNode) continue;
        refreshParentIds.add(sourceNode.parentId);
        const shouldSyncProjection = index === movableSourceIds.length - 1;
        await moveNode(sourceId, parentId, nextAfterId, shouldSyncProjection);
        nextAfterId = sourceId;
      }
      setBranchClipboard(null);
      await clearBranchClipboardFromSystem();
      const focusId = resolveClipboardFocusId(movableSourceIds);
      await refreshTreeAndKeepContext(
        undefined,
        Array.from(refreshParentIds),
        surface,
        surface === "grid" ? parentId : undefined
      );
      setSelectionFromIds(movableSourceIds, focusId, surface);
      return true;
    }

    const createdRootIds: string[] = [];
    let nextAfterId = afterId;
    for (const root of clipboardRoots) {
      const createdId = await cloneSnapshot(
        root,
        parentId,
        nextAfterId,
        buildCopyNameWithSuffix(root.name, root.type, t("node.copy_suffix"))
      );
      createdRootIds.push(createdId);
      nextAfterId = createdId;
    }
    const createdRootId = resolveClipboardFocusId(createdRootIds);
    if (!createdRootId) return true;
    await refreshTreeAndKeepContext(undefined, [targetParentKey], surface, surface === "grid" ? parentId : undefined);
    setSelectionFromIds(createdRootIds, createdRootId, surface);
    if (shouldBeginInlineEditAfterClipboardMutation(createdRootIds, surface)) {
      beginInlineEdit(createdRootId, undefined, surface);
    }
    return true;
  };

  const duplicateSelectedBranch = async (
    sourceNodeId?: string,
    surface: SelectionSurface = "tree"
  ) => {
    const sourceIds = resolveBranchSourceIds(sourceNodeId);
    if (sourceIds.length === 0) return;
    if (!ensureStructureMutationAllowed(sourceIds, { scope: resolveNodeIdsMutationScope(sourceIds) })) return;
    const specialResult = duplicateSpecialNodes ? await duplicateSpecialNodes(sourceIds, surface) : null;
    if (specialResult && specialResult.createdNodeIds.length > 0) {
      const focusId =
        specialResult.focusNodeId ??
        specialResult.createdNodeIds[specialResult.createdNodeIds.length - 1] ??
        specialResult.createdNodeIds[0];
      setSelectionFromIds(specialResult.createdNodeIds, focusId, specialResult.surface ?? surface);
      return;
    }

    const duplicatedIds: string[] = [];
    const refreshParentIds = new Set<string>();
    for (const sourceId of sourceIds) {
      const sourceNode = nodeById.get(sourceId);
      if (!sourceNode) continue;
      const snapshot = buildSnapshot(sourceId, nodeById, byParent);
      if (!snapshot) continue;
      const { parentId, afterId, refreshParentKey } = resolveDuplicatePlacement({
        sourceNode,
        activeProjectRootId,
        byParent
      });
      const duplicateId = await cloneSnapshot(
        snapshot,
        parentId,
        afterId,
        buildCopyNameWithSuffix(snapshot.name, snapshot.type, t("node.copy_suffix"))
      );
      duplicatedIds.push(duplicateId);
      refreshParentIds.add(refreshParentKey);
    }

    const lastDuplicatedId = resolveClipboardFocusId(duplicatedIds);
    if (!lastDuplicatedId) return;
    await refreshTreeAndKeepContext(
      undefined,
      Array.from(refreshParentIds),
      surface,
      surface === "grid" ? currentFolderId : undefined
    );
    setSelectionFromIds(duplicatedIds, lastDuplicatedId, surface);
    if (shouldBeginInlineEditAfterClipboardMutation(duplicatedIds, surface)) {
      beginInlineEdit(lastDuplicatedId, undefined, surface);
    }
  };

  return {
    copySelectedBranch,
    pasteClipboardBranch,
    duplicateSelectedBranch
  };
}
