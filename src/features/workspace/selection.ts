import type { DesktopViewMode, SelectionSurface, WorkspaceMode } from "@/features/workspace/viewMode";
import type { AppNode } from "@/lib/types";

export type KeyboardSurface = "tree" | "grid" | "timeline" | "procedure";

type PreferredView = {
  desktopViewMode?: DesktopViewMode;
  selectionSurface: SelectionSurface;
};

export function resolvePreferredKeyboardSurface(preferredView: PreferredView): KeyboardSurface {
  if (preferredView.desktopViewMode === "procedure") return "procedure";
  if (preferredView.selectionSurface === "tree") return "tree";
  if (preferredView.selectionSurface === "timeline") return "timeline";
  return "grid";
}

export function resolveProcedureSelectionSurface(params: {
  workspaceMode: WorkspaceMode;
  desktopViewMode: DesktopViewMode;
  selectionSurface: SelectionSurface;
}): SelectionSurface | null {
  if (params.desktopViewMode !== "procedure") return null;
  if (params.selectionSurface === "tree") return null;
  return "tree";
}

export function resolveSurfaceStateForWorkspaceMode(params: {
  workspaceMode: WorkspaceMode;
  keyboardSurface: KeyboardSurface;
  selectionSurface: SelectionSurface;
}): {
  selectionSurface: SelectionSurface | null;
  keyboardSurface: KeyboardSurface | null;
} {
  if (params.workspaceMode === "timeline") {
    if (params.keyboardSurface === "procedure") {
      return {
        selectionSurface: params.selectionSurface === "tree" ? null : "tree",
        keyboardSurface: null
      };
    }
    return {
      selectionSurface:
        params.keyboardSurface !== "tree" && params.selectionSurface !== "timeline" ? "timeline" : null,
      keyboardSurface: null
    };
  }

  return {
    selectionSurface: params.selectionSurface === "timeline" ? "grid" : null,
    keyboardSurface: params.keyboardSurface === "timeline" ? "grid" : null
  };
}

export function resolveKeyboardSurfaceAfterProcedure(params: {
  desktopViewMode: DesktopViewMode;
  keyboardSurface: KeyboardSurface;
  selectionSurface: SelectionSurface;
  workspaceMode: WorkspaceMode;
}): KeyboardSurface | null {
  if (params.desktopViewMode === "procedure") return null;
  if (params.keyboardSurface !== "procedure") return null;
  if (params.selectionSurface === "tree") return "tree";
  return params.workspaceMode === "timeline" ? "timeline" : "grid";
}

export function normalizeSelectionState(
  nodeIds: string[],
  focusId: string | null,
  nodeById: Map<string, AppNode>
): { selectedIds: string[]; focusId: string } | null {
  const dedupedIds = Array.from(new Set(nodeIds)).filter((id) => typeof id === "string" && id.trim().length > 0);
  const knownIds = dedupedIds.filter((id) => nodeById.has(id));
  const selectedIds = knownIds.length > 0 ? knownIds : dedupedIds;
  if (selectedIds.length === 0) return null;

  return {
    selectedIds,
    focusId: focusId && selectedIds.includes(focusId) ? focusId : selectedIds[0]
  };
}

export function buildSelectionSignature(selectedNodeIds: Set<string>, selectionSurface: SelectionSurface): string | null {
  const ids = Array.from(selectedNodeIds).sort();
  return ids.length > 0 ? `${selectionSurface}:${ids.join(",")}` : null;
}
