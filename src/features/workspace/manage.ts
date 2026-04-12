import type { ProjectSummary } from "@/lib/types";
import { isInternalWorkspaceRootPath } from "@/features/workspace/scope";

export function partitionWorkspaceProjects(projects: ProjectSummary[]): {
  linkedProjects: ProjectSummary[];
  internalProjects: ProjectSummary[];
} {
  return {
    linkedProjects: projects.filter((project) => !isInternalWorkspaceRootPath(project.rootPath)),
    internalProjects: projects.filter((project) => isInternalWorkspaceRootPath(project.rootPath))
  };
}

export function resolveWorkspaceDefaultProjectName(
  projects: ProjectSummary[],
  activeProjectId: string | null
): string | null {
  if (!activeProjectId) return null;
  return projects.find((project) => project.id === activeProjectId)?.name ?? activeProjectId;
}

export function resolveWorkspaceOpenFolderPath(project: ProjectSummary | null): string | null {
  const path = project?.rootPath?.trim() ?? "";
  if (!path || isInternalWorkspaceRootPath(path)) return null;
  return path;
}

export function resolveWorkspaceSuggestedNameFromPath(path: string): string {
  const trimmed = path.trim().replace(/^["']+|["']+$/g, "");
  if (!trimmed) return "";
  const normalized = trimmed.replace(/[\\/]+$/, "");
  if (!normalized) return "";
  const segments = normalized.split(/[\\/]+/).filter((segment) => segment.length > 0);
  return segments[segments.length - 1] ?? "";
}

export function buildWorkspaceCreateInlineOpenState() {
  return {
    workspaceSettingsOpen: true,
    workspaceCreateInlineOpen: true,
    workspaceLocalPathInput: "",
    workspaceManageError: null as string | null,
    workspaceManageNotice: null as string | null
  };
}

export function buildWorkspaceCreateInlineCancelState() {
  return {
    workspaceCreateInlineOpen: false,
    workspaceNameInput: "",
    workspaceLocalPathInput: ""
  };
}

export function buildWorkspaceCreateInlineSubmitSuccessState() {
  return {
    workspaceCreateInlineOpen: false,
    workspaceSettingsOpen: false
  };
}

export function buildWorkspaceSettingsCloseState() {
  return {
    workspaceSettingsOpen: false,
    workspaceCreateInlineOpen: false,
    workspaceNameInput: "",
    workspaceLocalPathInput: "",
    workspaceManageError: null as string | null,
    workspaceManageNotice: null as string | null,
    aiRebuildError: null as string | null
  };
}

export function buildWorkspaceSettingsToggleState(previousOpen: boolean) {
  if (previousOpen) {
    return {
      workspaceSettingsOpen: false,
      workspaceCreateInlineOpen: false,
      workspaceNameInput: ""
    };
  }

  return {
    workspaceSettingsOpen: true,
    workspaceCreateInlineOpen: false,
    workspaceNameInput: null as string | null
  };
}
