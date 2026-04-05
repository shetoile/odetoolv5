import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  EditGlyphSmall,
  FlagGlyphSmall,
  ImportGlyphSmall,
  OpenGlyphSmall,
  PlusGlyphSmall,
  TrashGlyphSmall
} from "@/components/Icons";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import { partitionWorkspaceProjects } from "@/features/workspace/manage";
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
  workspaceLocalPathInput: string;
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
  onWorkspaceLocalPathInputChange: (value: string) => void;
  onOpenCreateWorkspace: () => void;
  onCancelCreateWorkspace: () => void;
  onCreateWorkspace: () => void;
  onPickAndImportProjectFolder: () => void;
  onPickWorkspaceLocalFolder: () => void;
  onSetWorkspaceLocalPath: () => void;
  onReSyncWorkspace: () => void;
  onDeleteProjectWorkspace: () => void;
  onSetDefaultWorkspace: () => void;
  onOpenWorkspaceFolderLocation: () => void;
}

function RefreshGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
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

export function WorkspaceManageCard({
  t,
  projects,
  activeProjectId,
  defaultProjectId,
  workspaceNameInput,
  workspaceLocalPathInput,
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
  onWorkspaceLocalPathInputChange,
  onOpenCreateWorkspace,
  onCancelCreateWorkspace,
  onCreateWorkspace,
  onPickAndImportProjectFolder,
  onPickWorkspaceLocalFolder,
  onSetWorkspaceLocalPath,
  onReSyncWorkspace,
  onDeleteProjectWorkspace,
  onSetDefaultWorkspace,
  onOpenWorkspaceFolderLocation
}: WorkspaceManageCardProps) {
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null);
  const workspaceNameInputRef = useRef<HTMLInputElement | null>(null);
  const isActiveDefault = Boolean(activeProjectId && activeProjectId === defaultProjectId);
  const { linkedProjects, internalProjects } = partitionWorkspaceProjects(projects);
  const activeProject = resolveActiveProject(projects, activeProjectId);
  const activeProjectIsLinked = hasLinkedWorkspaceFolder(activeProject);
  const activeProjectLabel = activeProject?.name ?? t("project.none");

  useEffect(() => {
    if (!workspaceMenuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      if (workspaceMenuRef.current?.contains(event.target)) return;
      setWorkspaceMenuOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setWorkspaceMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [workspaceMenuOpen]);

  useEffect(() => {
    setWorkspaceMenuOpen(false);
  }, [activeProjectId]);

  useEffect(() => {
    if (!workspaceCreateInlineOpen) return;
    workspaceNameInputRef.current?.focus();
    workspaceNameInputRef.current?.select();
  }, [workspaceCreateInlineOpen]);

  const renderWorkspaceOption = (projectId: string, label: string) => {
    const selected = (activeProjectId ?? "") === projectId;
    return (
      <button
        key={projectId || "__all__"}
        type="button"
        role="option"
        aria-selected={selected}
        className={`flex w-full items-center rounded-md px-3 py-2 text-left text-[0.82rem] transition-colors ${
          selected
            ? "bg-[rgba(35,128,184,0.28)] text-[var(--ode-text)] shadow-[inset_0_0_0_1px_rgba(74,194,255,0.35)]"
            : "text-[var(--ode-text-muted)] hover:bg-[rgba(10,48,74,0.72)] hover:text-[var(--ode-text)]"
        }`}
        onClick={() => {
          onProjectSelectionChange(projectId);
          setWorkspaceMenuOpen(false);
        }}
      >
        {label}
      </button>
    );
  };

  const renderActionButton = (props: {
    label: string;
    disabled?: boolean;
    onClick: () => void;
    tone?: "default" | "danger";
    icon: ReactNode;
  }) => (
    <OdeTooltip label={props.label} side="top">
      <span className="inline-flex">
        <button
          type="button"
          aria-label={props.label}
          className={`ode-icon-btn h-11 w-11 ${
            props.tone === "danger" ? "text-[#ffb8b8]" : "text-[var(--ode-text)]"
          }`}
          onClick={props.onClick}
          disabled={props.disabled}
        >
          {props.icon}
        </button>
      </span>
    </OdeTooltip>
  );

  return (
    <div className="rounded-[26px] border border-[var(--ode-border)] bg-[rgba(4,25,42,0.62)] p-4 sm:p-5">
      <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)]">
        <span className="pt-2 text-[0.84rem] text-[var(--ode-text-muted)]">{t("project.select")}</span>
        <div className="min-w-0" ref={workspaceMenuRef}>
          <button
            type="button"
            className={`ode-input flex h-10 w-full items-center justify-between rounded-xl px-4 text-[0.96rem] ${
              workspaceMenuOpen ? "border-[var(--ode-border-accent)] shadow-[0_0_0_1px_rgba(74,194,255,0.18)]" : ""
            }`}
            aria-haspopup="listbox"
            aria-expanded={workspaceMenuOpen}
            onClick={() => setWorkspaceMenuOpen((prev) => !prev)}
          >
            <span className="truncate text-left text-[var(--ode-text)]">{activeProjectLabel}</span>
            <span className={`ml-3 shrink-0 text-[0.72rem] text-[var(--ode-text-dim)] transition-transform ${workspaceMenuOpen ? "rotate-180" : ""}`}>
              v
            </span>
          </button>
          {workspaceMenuOpen ? (
            <div
              role="listbox"
              className="mt-2 max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-[var(--ode-border-strong)] bg-[linear-gradient(180deg,rgba(7,34,56,0.98),rgba(4,22,39,0.98))] p-2 shadow-[0_18px_42px_rgba(0,0,0,0.34)]"
            >
              {renderWorkspaceOption("", t("project.none"))}
              {linkedProjects.length > 0 ? (
                <div className="px-3 pb-1 pt-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--ode-accent)]">
                  {t("project.scope_linked")}
                </div>
              ) : null}
              {linkedProjects.map((project) => renderWorkspaceOption(project.id, project.name))}
              {internalProjects.length > 0 ? (
                <div className="px-3 pb-1 pt-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--ode-accent)]">
                  {t("project.scope_internal")}
                </div>
              ) : null}
              {internalProjects.map((project) => renderWorkspaceOption(project.id, project.name))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
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
        {activeProjectId
          ? renderActionButton({
              label: t("project.local_path_btn"),
              onClick: onSetWorkspaceLocalPath,
              disabled: isProjectImporting || isWorkspaceCreating || isProjectResyncing || isProjectDeleting,
              icon: <EditGlyphSmall />
            })
          : null}
        {activeProjectIsLinked
          ? renderActionButton({
              label: isProjectResyncing ? t("project.resyncing_short") : t("project.resync_btn"),
              onClick: onReSyncWorkspace,
              disabled: isProjectImporting || isProjectResyncing || isProjectDeleting,
              icon: <RefreshGlyphSmall />
            })
          : null}
        {activeProjectId
          ? renderActionButton({
              label: isActiveDefault ? t("project.default_active") : t("project.set_default_btn"),
              onClick: onSetDefaultWorkspace,
              disabled: isProjectImporting || isProjectResyncing || isProjectDeleting || isActiveDefault,
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
      {activeProjectIsLinked && (workspaceExternalChangeCount > 0 || isWorkspaceExternalChangeChecking) ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {workspaceExternalChangeCount > 0 ? (
            <span className="inline-flex min-h-9 items-center rounded-full border border-[rgba(214,170,82,0.5)] bg-[rgba(71,51,14,0.86)] px-3 text-[0.78rem] font-medium text-[#f2d38b]">
              {t("project.external_changes_badge", { count: workspaceExternalChangeCount })}
            </span>
          ) : null}
          {isWorkspaceExternalChangeChecking ? (
            <span className="inline-flex min-h-9 items-center rounded-full border border-[var(--ode-border)] bg-[rgba(5,29,46,0.55)] px-3 text-[0.78rem] text-[var(--ode-text-dim)]">
              {t("project.external_changes_checking")}
            </span>
          ) : null}
        </div>
      ) : null}
      {workspaceCreateInlineOpen ? (
        <div className="mt-4 rounded-[18px] border border-[var(--ode-border)] bg-[rgba(5,29,46,0.5)] p-3.5 sm:p-4">
          <p className="mb-2 text-[0.84rem] text-[var(--ode-text)]">{t("project.name_modal_title")}</p>
          <div className="flex flex-col gap-2">
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
              placeholder=""
              className="ode-input h-10 min-w-0 flex-1 rounded-xl px-3 text-[0.92rem]"
            />
            <div className="rounded-[16px] border border-[var(--ode-border)] bg-[rgba(5,29,46,0.36)] p-3">
              <label className="mb-1.5 block text-[0.72rem] uppercase tracking-[0.12em] text-[var(--ode-text-dim)]">
                {t("project.local_path_label")}
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={workspaceLocalPathInput}
                  onChange={(event) => onWorkspaceLocalPathInputChange(event.target.value)}
                  placeholder=""
                  className="ode-input h-10 min-w-0 flex-1 rounded-xl px-3 text-[0.88rem]"
                />
                <button
                  type="button"
                  className="ode-mini-btn h-10 px-3"
                  onClick={onPickWorkspaceLocalFolder}
                  disabled={isWorkspaceCreating}
                >
                  {t("project.local_path_browse_btn")}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="ode-mini-btn h-10 px-4"
                onClick={onCreateWorkspace}
                disabled={!workspaceNameInput.trim() || isWorkspaceCreating}
              >
                {isWorkspaceCreating ? t("project.creating") : t("project.name_modal_confirm")}
              </button>
              <button
                type="button"
                className="ode-mini-btn h-10 px-4"
                onClick={onCancelCreateWorkspace}
                disabled={isWorkspaceCreating}
              >
                {t("project.name_modal_cancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {workspaceError ? (
        <OdeTooltip label={workspaceError} side="top">
          <p className="mt-3 text-[0.8rem] text-[#ffb2b2]">{workspaceError}</p>
        </OdeTooltip>
      ) : null}
      {workspaceNotice ? <p className="mt-3 text-[0.8rem] text-[var(--ode-accent)]">{workspaceNotice}</p> : null}
    </div>
  );
}
