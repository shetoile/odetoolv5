import { resolveEffectiveCreationSurfaceForWorkspace } from "@/features/workspace/creation";
import type { KeyboardSurface } from "@/features/workspace/selection";
import type { DesktopViewMode, SelectionSurface, WorkspaceMode } from "@/features/workspace/viewMode";

export type MindMapOrientation = "horizontal" | "vertical";

export function resolveSelectionSurfaceForKeyboardSurface(
  keyboardSurface: KeyboardSurface,
  selectionSurface: SelectionSurface = "grid"
): SelectionSurface {
  if (keyboardSurface === "tree") return "tree";
  if (keyboardSurface === "timeline") return "timeline";
  if (keyboardSurface === "procedure") return selectionSurface;
  return "grid";
}

export function resolveActiveSelectionSurface(params: {
  desktopViewMode?: DesktopViewMode;
  keyboardSurface: KeyboardSurface;
  selectionSurface?: SelectionSurface;
  workspaceMode: WorkspaceMode;
}): SelectionSurface {
  const selectionSurface = params.selectionSurface ?? "grid";
  if (params.desktopViewMode === "library") return "tree";
  if (params.keyboardSurface === "tree") return "tree";
  if (params.keyboardSurface === "timeline") return "timeline";
  if (params.keyboardSurface === "procedure") return selectionSurface;
  if (selectionSurface === "tree") return "tree";
  if (selectionSurface === "timeline" && params.workspaceMode === "timeline") return "timeline";
  return "grid";
}

export function resolveKeyboardCreationSurface(params: {
  keyboardSurface: KeyboardSurface;
  workspaceMode: WorkspaceMode;
  selectionSurface?: SelectionSurface;
}): SelectionSurface {
  return resolveEffectiveCreationSurfaceForWorkspace(
    resolveSelectionSurfaceForKeyboardSurface(
      params.keyboardSurface,
      params.selectionSurface ?? "grid"
    ),
    params.workspaceMode
  );
}

export function isTimelineKeyboardSurfaceActive(params: {
  workspaceMode: WorkspaceMode;
  selectionSurface: SelectionSurface;
}): boolean {
  return params.workspaceMode === "timeline" && params.selectionSurface === "timeline";
}

export function resolveGridNavigationColumnCount(params: {
  desktopViewMode: DesktopViewMode;
  mindMapOrientation: MindMapOrientation;
  viewportWidth: number;
}): number {
  if (params.desktopViewMode === "details") return 1;
  if (params.desktopViewMode === "mindmap") {
    return params.mindMapOrientation === "horizontal" ? 2 : 4;
  }
  if (params.viewportWidth >= 1280) return 4;
  if (params.viewportWidth >= 768) return 3;
  return 2;
}
