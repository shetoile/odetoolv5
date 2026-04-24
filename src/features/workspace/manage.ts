import { buildAppStorageKey } from "@/lib/appIdentity";
import type { ProjectSummary } from "@/lib/types";
import { isInternalWorkspaceRootPath } from "@/features/workspace/scope";

const WORKSPACE_RECENT_HISTORY_STORAGE_KEY = buildAppStorageKey("workspace.recentHistory.v1");
const MAX_RECENT_WORKSPACE_HISTORY = 12;

export interface WorkspaceRecentHistoryEntry {
  projectId: string;
  openedAt: number;
}

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

function normalizeWorkspaceRecentHistory(
  entries: WorkspaceRecentHistoryEntry[]
): WorkspaceRecentHistoryEntry[] {
  const seen = new Set<string>();
  return entries
    .filter(
      (entry) =>
        typeof entry.projectId === "string" &&
        entry.projectId.trim().length > 0 &&
        typeof entry.openedAt === "number" &&
        Number.isFinite(entry.openedAt) &&
        entry.openedAt > 0
    )
    .sort((left, right) => right.openedAt - left.openedAt)
    .filter((entry) => {
      if (seen.has(entry.projectId)) return false;
      seen.add(entry.projectId);
      return true;
    })
    .slice(0, MAX_RECENT_WORKSPACE_HISTORY);
}

export function readWorkspaceRecentHistory(): WorkspaceRecentHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(WORKSPACE_RECENT_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeWorkspaceRecentHistory(
      parsed.map((entry) => ({
        projectId: typeof entry?.projectId === "string" ? entry.projectId : "",
        openedAt: typeof entry?.openedAt === "number" ? entry.openedAt : 0
      }))
    );
  } catch {
    return [];
  }
}

export function rememberWorkspaceOpened(
  projectId: string | null,
  openedAt: number = Date.now()
): WorkspaceRecentHistoryEntry[] {
  if (typeof window === "undefined" || !projectId) {
    return readWorkspaceRecentHistory();
  }
  const nextHistory = normalizeWorkspaceRecentHistory([
    { projectId, openedAt },
    ...readWorkspaceRecentHistory()
  ]);
  try {
    window.localStorage.setItem(
      WORKSPACE_RECENT_HISTORY_STORAGE_KEY,
      JSON.stringify(nextHistory)
    );
  } catch {
    // Best-effort persistence only.
  }
  return nextHistory;
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
