import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  FlagGlyphSmall,
  ImportGlyphSmall,
  OpenGlyphSmall,
  PlusGlyphSmall,
  SearchGlyphSmall,
  TrashGlyphSmall
} from "@/components/Icons";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import { readWorkspaceRecentHistory, resolveWorkspaceOpenFolderPath } from "@/features/workspace/manage";
import { hasLinkedWorkspaceFolder, resolveActiveProject } from "@/features/workspace/scope";
import type { TranslationParams } from "@/lib/i18n";
import type { ProjectSummary } from "@/lib/types";

type TranslateFn = (key: string, params?: TranslationParams) => string;

interface WorkspaceManageCardProps {
  t: TranslateFn;
  projects: ProjectSummary[];
  activeProjectId: string | null;
  defaultProjectId: string | null;
  workspaceNameInput: string;
  isProjectImporting: boolean;
  isWorkspaceCreating: boolean;
  isProjectResyncing: boolean;
  isProjectDeleting: boolean;
  workspaceCreateInlineOpen: boolean;
  workspaceExternalChangeCount: number;
  isWorkspaceExternalChangeChecking: boolean;
  workspaceError: string | null;
  workspaceNotice: string | null;
  onProjectSelectionChange: (projectId: string) => void;
  onWorkspaceNameInputChange: (value: string) => void;
  onOpenCreateWorkspace: () => void;
  onCancelCreateWorkspace: () => void;
  onCreateWorkspace: () => void;
  onPickAndImportProjectFolder: () => void;
  onReSyncWorkspace: () => void;
  onDeleteProjectWorkspace: () => void;
  onSetDefaultWorkspace: () => void;
  onOpenWorkspaceFolderLocation: () => void;
  workspaceRootNumberingEnabled: boolean;
  onWorkspaceRootNumberingEnabledChange: (enabled: boolean) => void;
}

function RefreshGlyphSmall({ spinning = false }: { spinning?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={spinning ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden>
      <path
        d="M18.2 11.1a6.2 6.2 0 1 1-2-4.5M18.2 4.9v4.4h-4.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatWorkspaceTimestamp(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "-";
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(value);
  } catch {
    return new Date(value).toLocaleString();
  }
}

function buildWorkspaceSortScore(
  project: ProjectSummary,
  activeProjectId: string | null,
  recentOpenedAtByProjectId: Map<string, number>
): number {
  if (project.id === activeProjectId) {
    return Number.MAX_SAFE_INTEGER;
  }
  return recentOpenedAtByProjectId.get(project.id) ?? project.updatedAt ?? project.createdAt ?? 0;
}

export function WorkspaceManageCard({
  t,
  projects,
  activeProjectId,
  defaultProjectId,
  workspaceNameInput,
  isProjectImporting,
  isWorkspaceCreating,
  isProjectResyncing,
  isProjectDeleting,
  workspaceCreateInlineOpen,
  workspaceExternalChangeCount,
  isWorkspaceExternalChangeChecking,
  workspaceError,
  workspaceNotice,
  onProjectSelectionChange,
  onWorkspaceNameInputChange,
  onOpenCreateWorkspace,
  onCancelCreateWorkspace,
  onCreateWorkspace,
  onPickAndImportProjectFolder,
  onReSyncWorkspace,
  onDeleteProjectWorkspace,
  onSetDefaultWorkspace,
  onOpenWorkspaceFolderLocation
}: WorkspaceManageCardProps) {
  const workspaceNameInputRef = useRef<HTMLInputElement | null>(null);
  const [workspaceSearch, setWorkspaceSearch] = useState("");

  const activeProject = resolveActiveProject(projects, activeProjectId);
  const activeProjectIsLinked = hasLinkedWorkspaceFolder(activeProject);
  const activeWorkspaceFolderPath = resolveWorkspaceOpenFolderPath(activeProject);
  const isActiveDefault = Boolean(activeProjectId && activeProjectId === defaultProjectId);

  const recentHistory = useMemo(() => readWorkspaceRecentHistory(), [activeProjectId, projects]);
  const recentOpenedAtByProjectId = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of recentHistory) {
      map.set(entry.projectId, entry.openedAt);
    }
    if (activeProjectId && !map.has(activeProjectId)) {
      map.set(activeProjectId, Date.now());
    }
    return map;
  }, [activeProjectId, recentHistory]);

  const sortedProjects = useMemo(() => {
    return [...projects].sort((left, right) => {
      const scoreDelta =
        buildWorkspaceSortScore(right, activeProjectId, recentOpenedAtByProjectId) -
        buildWorkspaceSortScore(left, activeProjectId, recentOpenedAtByProjectId);
      if (scoreDelta !== 0) return scoreDelta;
      if (right.updatedAt !== left.updatedAt) return right.updatedAt - left.updatedAt;
      if (right.createdAt !== left.createdAt) return right.createdAt - left.createdAt;
      return left.name.localeCompare(right.name);
    });
  }, [activeProjectId, projects, recentOpenedAtByProjectId]);

  const normalizedWorkspaceSearch = workspaceSearch.trim().toLowerCase();
  const filteredProjects = useMemo(() => {
    if (!normalizedWorkspaceSearch) return sortedProjects;
    return sortedProjects.filter((project) => {
      const openFolderPath = resolveWorkspaceOpenFolderPath(project)?.toLowerCase() ?? "";
      return (
        project.name.toLowerCase().includes(normalizedWorkspaceSearch) ||
        openFolderPath.includes(normalizedWorkspaceSearch)
      );
    });
  }, [normalizedWorkspaceSearch, sortedProjects]);

  useEffect(() => {
    if (!workspaceCreateInlineOpen) return;
    workspaceNameInputRef.current?.focus();
    workspaceNameInputRef.current?.select();
  }, [workspaceCreateInlineOpen]);

  const renderWorkspaceRow = (props: {
    key: string;
    label: string;
    detail?: string | null;
    selected: boolean;
    onClick: () => void;
    showDefault?: boolean;
  }) => (
    <button
      key={props.key}
      type="button"
      aria-label={props.label}
      className={`w-full rounded-[14px] px-3 py-2.5 text-left transition-colors ${
        props.selected
          ? "bg-[rgba(11,56,84,0.72)] text-[var(--ode-text)]"
          : "text-[var(--ode-text-dim)] hover:bg-[rgba(8,40,61,0.44)] hover:text-[var(--ode-text)]"
      }`}
      onClick={props.onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[0.92rem] font-medium">{props.label}</div>
          {props.detail ? (
            <div className="mt-1 truncate text-[0.72rem] text-[var(--ode-text-muted)]">
              {props.detail}
            </div>
          ) : null}
        </div>
        {props.showDefault ? (
          <span className="shrink-0 text-[0.64rem] uppercase tracking-[0.08em] text-[var(--ode-accent)]">
            {t("project.default_active")}
          </span>
        ) : null}
      </div>
    </button>
  );

  const renderActionButton = (props: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    active?: boolean;
    tone?: "default" | "danger";
    icon: ReactNode;
  }) => (
    <OdeTooltip key={props.label} label={props.label} side="top">
      <span className="block">
        <button
          type="button"
          aria-label={props.label}
          aria-pressed={props.active ? true : undefined}
          className={`ode-icon-btn h-10 w-10 rounded-[12px] ${
            props.tone === "danger"
              ? "bg-[rgba(63,18,24,0.38)] text-[#ffcccc] hover:bg-[rgba(78,24,29,0.58)]"
              : props.active
                ? "bg-[rgba(18,92,131,0.28)] text-[var(--ode-accent)] hover:bg-[rgba(18,92,131,0.42)]"
                : "bg-[rgba(8,40,61,0.24)] text-[var(--ode-text-dim)] hover:bg-[rgba(8,52,82,0.4)]"
          } ${props.disabled ? "cursor-not-allowed opacity-45" : ""}`}
          onClick={props.onClick}
          disabled={props.disabled}
        >
          {props.icon}
        </button>
      </span>
    </OdeTooltip>
  );

  return (
    <div className="grid h-full min-h-0 gap-5 px-4 pb-4 sm:px-6 sm:pb-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="min-h-0">
        <div className="flex h-full min-h-0 flex-col gap-3">
          <label className="relative block">
            <span className="sr-only">{t("project.search_placeholder")}</span>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ode-text-muted)]">
              <SearchGlyphSmall />
            </span>
            <input
              type="search"
              value={workspaceSearch}
              onChange={(event) => setWorkspaceSearch(event.target.value)}
              className="ode-input h-11 w-full rounded-[14px] border-transparent bg-[rgba(8,40,61,0.26)] pl-10 pr-3 text-[0.9rem]"
              placeholder={t("project.search_placeholder")}
              aria-label={t("project.search_placeholder")}
            />
          </label>

          <div className="min-h-0 overflow-y-auto pr-1">
            <div className="space-y-1">
              {filteredProjects.length > 0 ? (
                filteredProjects.map((project) =>
                  renderWorkspaceRow({
                    key: project.id,
                    label: project.name,
                    detail:
                      formatWorkspaceTimestamp(
                        recentOpenedAtByProjectId.get(project.id) ?? project.updatedAt
                      ) ?? null,
                    selected: project.id === activeProjectId,
                    onClick: () => onProjectSelectionChange(project.id),
                    showDefault: project.id === defaultProjectId
                  })
                )
              ) : (
                <div className="px-3 py-2 text-[0.82rem] text-[var(--ode-text-muted)]">
                  {t("project.search_empty")}
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      <div className="min-h-0 overflow-y-auto">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            {activeProject ? (
              <div className="min-w-0">
                <div className="truncate text-[1.08rem] font-semibold text-[var(--ode-text)]">
                  {activeProject.name}
                </div>
                <div className="mt-1 text-[0.76rem] text-[var(--ode-text-dim)]">
                  {activeProjectIsLinked
                    ? t("project.scope_linked_value")
                    : t("project.scope_internal_value")}
                </div>
                {activeWorkspaceFolderPath ? (
                  <div className="mt-1 max-w-4xl break-all whitespace-pre-wrap text-[0.78rem] text-[var(--ode-text-muted)]">
                    {activeWorkspaceFolderPath}
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.74rem]">
                  {isActiveDefault ? (
                    <span className="rounded-full bg-[rgba(18,92,131,0.28)] px-2.5 py-1 text-[var(--ode-accent)]">
                      {t("project.default_active")}
                    </span>
                  ) : null}
                  {activeProjectIsLinked && workspaceExternalChangeCount > 0 ? (
                    <span className="rounded-full bg-[rgba(71,51,14,0.78)] px-2.5 py-1 text-[#f2d38b]">
                      {t("project.external_changes_badge", { count: workspaceExternalChangeCount })}
                    </span>
                  ) : null}
                  {activeProjectIsLinked && isWorkspaceExternalChangeChecking ? (
                    <span className="rounded-full bg-[rgba(8,40,61,0.3)] px-2.5 py-1 text-[var(--ode-text-dim)]">
                      {t("project.external_changes_checking")}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-1.5">
              {renderActionButton({
                label: isWorkspaceCreating ? t("project.creating") : t("project.create_btn"),
                onClick: onOpenCreateWorkspace,
                disabled: isProjectImporting || isWorkspaceCreating || isProjectResyncing || isProjectDeleting,
                icon: <PlusGlyphSmall />
              })}
              {renderActionButton({
                label: isProjectImporting ? t("project.importing_short") : t("project.import_btn"),
                onClick: onPickAndImportProjectFolder,
                disabled: isProjectImporting || isWorkspaceCreating || isProjectResyncing || isProjectDeleting,
                icon: <ImportGlyphSmall />
              })}
              {activeProjectIsLinked
                ? renderActionButton({
                    label: isProjectResyncing ? t("project.resyncing_short") : t("project.resync_btn"),
                    onClick: onReSyncWorkspace,
                    disabled: isProjectImporting || isProjectResyncing || isProjectDeleting,
                    icon: <RefreshGlyphSmall spinning={isProjectResyncing} />
                  })
                : null}
              {activeProjectId
                ? renderActionButton({
                    label: isActiveDefault ? t("project.default_active") : t("project.set_default_btn"),
                    onClick: onSetDefaultWorkspace,
                    disabled: isProjectImporting || isProjectResyncing || isProjectDeleting || isActiveDefault,
                    active: isActiveDefault,
                    icon: <FlagGlyphSmall active={!isActiveDefault} />
                  })
                : null}
              {activeProjectId
                ? renderActionButton({
                    label: t("project.open_folder_btn"),
                    onClick: onOpenWorkspaceFolderLocation,
                    disabled: isProjectImporting || isProjectResyncing || isProjectDeleting,
                    icon: <OpenGlyphSmall />
                  })
                : null}
              {activeProjectId
                ? renderActionButton({
                    label: isProjectDeleting ? t("project.deleting_short") : t("project.delete_btn"),
                    onClick: onDeleteProjectWorkspace,
                    disabled: isProjectImporting || isProjectResyncing || isProjectDeleting,
                    tone: "danger",
                    icon: <TrashGlyphSmall />
                  })
                : null}
            </div>
          </div>

          {workspaceCreateInlineOpen ? (
            <section className="max-w-5xl space-y-3 pt-2">
              <div>
                <label className="mb-1.5 block text-[0.76rem] font-medium text-[var(--ode-text-dim)]">
                  {t("project.name_prompt")}
                </label>
                <input
                  ref={workspaceNameInputRef}
                  type="text"
                  value={workspaceNameInput}
                  onChange={(event) => onWorkspaceNameInputChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onCreateWorkspace();
                      return;
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      onCancelCreateWorkspace();
                    }
                  }}
                  aria-label={t("project.name_modal_title")}
                  className="ode-input h-12 w-full rounded-[14px] border-transparent bg-[rgba(8,40,61,0.26)] px-4 text-[0.96rem]"
                  placeholder={t("project.name_prompt")}
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {renderActionButton({
                  label: isWorkspaceCreating ? t("project.creating") : t("project.name_modal_confirm"),
                  onClick: onCreateWorkspace,
                  disabled: !workspaceNameInput.trim() || isWorkspaceCreating,
                  icon: <PlusGlyphSmall />
                })}
                {renderActionButton({
                  label: t("project.name_modal_cancel"),
                  onClick: onCancelCreateWorkspace,
                  disabled: isWorkspaceCreating,
                  tone: "danger",
                  icon: <span className="text-[1rem] leading-none">x</span>
                })}
              </div>
            </section>
          ) : null}

          {workspaceError ? (
            <section className="max-w-4xl rounded-[14px] bg-[rgba(55,16,19,0.45)] px-3 py-2.5">
              <p className="text-[0.84rem] text-[#ffb2b2]">{workspaceError}</p>
            </section>
          ) : null}

          {workspaceNotice ? (
            <section className="max-w-4xl rounded-[14px] bg-[rgba(9,46,71,0.38)] px-3 py-2.5">
              <p className="text-[0.84rem] text-[var(--ode-accent)]">{workspaceNotice}</p>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
