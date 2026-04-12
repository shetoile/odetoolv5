import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDownGlyphSmall,
  EditGlyphSmall,
  FlagGlyphSmall,
  ImportGlyphSmall,
  OpenGlyphSmall,
  PlusGlyphSmall,
  SearchGlyphSmall,
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
  const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState("");
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null);
  const workspaceNameInputRef = useRef<HTMLInputElement | null>(null);
  const workspaceSearchInputRef = useRef<HTMLInputElement | null>(null);
  const isActiveDefault = Boolean(activeProjectId && activeProjectId === defaultProjectId);
  const { linkedProjects, internalProjects } = partitionWorkspaceProjects(projects);
  const activeProject = resolveActiveProject(projects, activeProjectId);
  const activeProjectIsLinked = hasLinkedWorkspaceFolder(activeProject);
  const activeProjectLabel = activeProject?.name ?? t("project.none");
  const normalizedWorkspaceSearchQuery = workspaceSearchQuery.trim().toLocaleLowerCase();
  const searchMatches = (value: string) =>
    normalizedWorkspaceSearchQuery.length === 0 || value.toLocaleLowerCase().includes(normalizedWorkspaceSearchQuery);
  const filteredLinkedProjects = linkedProjects.filter((project) => searchMatches(project.name));
  const filteredInternalProjects = internalProjects.filter((project) => searchMatches(project.name));
  const showAllWorkspacesOption = searchMatches(t("project.none"));
  const hasWorkspaceResults =
    showAllWorkspacesOption || filteredLinkedProjects.length > 0 || filteredInternalProjects.length > 0;

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
    setWorkspaceSearchQuery("");
  }, [activeProjectId]);

  useEffect(() => {
    if (!workspaceCreateInlineOpen) return;
    workspaceNameInputRef.current?.focus();
    workspaceNameInputRef.current?.select();
  }, [workspaceCreateInlineOpen]);

  useEffect(() => {
    if (!workspaceMenuOpen) return;
    const frame = window.requestAnimationFrame(() => {
      workspaceSearchInputRef.current?.focus();
      workspaceSearchInputRef.current?.select();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [workspaceMenuOpen]);

  const renderWorkspaceOption = (projectId: string, label: string) => {
    const selected = (activeProjectId ?? "") === projectId;
    return (
      <button
        key={projectId || "__all__"}
        type="button"
        role="option"
        aria-selected={selected}
        className={`flex min-h-[50px] w-full items-center justify-start rounded-[12px] pl-6 pr-5 py-2.5 text-left text-[0.92rem] leading-[1.35] transition-colors ${
          selected
            ? "bg-[rgba(35,128,184,0.28)] text-[var(--ode-text)] shadow-[inset_0_0_0_1px_rgba(74,194,255,0.35)]"
            : "text-[var(--ode-text-muted)] hover:bg-[rgba(10,48,74,0.72)] hover:text-[var(--ode-text)]"
        }`}
        onClick={() => {
          onProjectSelectionChange(projectId);
          setWorkspaceMenuOpen(false);
        }}
      >
        <span className="block w-full pl-1 leading-[1.38]">{label}</span>
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
          className={`inline-flex h-12 w-12 items-center justify-center rounded-[15px] border transition duration-150 focus-visible:outline-none focus-visible:ring-2 ${
            props.tone === "danger"
              ? "border-[rgba(255,146,146,0.22)] bg-[linear-gradient(180deg,rgba(81,34,34,0.92),rgba(48,18,18,0.96))] text-[#ffd4d4] shadow-[0_16px_36px_rgba(33,8,8,0.26)] hover:border-[rgba(255,176,176,0.34)] hover:bg-[linear-gradient(180deg,rgba(96,40,40,0.96),rgba(58,22,22,0.98))] focus-visible:ring-[rgba(255,167,167,0.2)]"
              : "border-[rgba(95,220,255,0.22)] bg-[linear-gradient(180deg,rgba(12,48,73,0.96),rgba(6,31,48,0.98))] text-[#eefaff] shadow-[0_18px_40px_rgba(0,0,0,0.2)] hover:border-[rgba(95,220,255,0.36)] hover:bg-[linear-gradient(180deg,rgba(17,63,93,0.98),rgba(8,38,59,0.99))] focus-visible:ring-[rgba(95,220,255,0.2)]"
          } disabled:cursor-not-allowed disabled:opacity-40`}
          onClick={props.onClick}
          disabled={props.disabled}
        >
          {props.icon}
        </button>
      </span>
    </OdeTooltip>
  );

  const workspaceFieldClass =
    "h-[52px] w-full rounded-[16px] border border-[var(--ode-border-strong)] bg-[linear-gradient(180deg,rgba(7,34,56,0.96),rgba(5,28,46,0.98))] px-5 text-[0.98rem] font-medium leading-[1.32] text-[var(--ode-text)] outline-none shadow-[inset_0_1px_0_rgba(217,243,255,0.05)] transition placeholder:text-[var(--ode-text-dim)] focus:border-[var(--ode-border-accent)] focus:ring-2 focus:ring-[rgba(32,150,210,0.18)]";
  const workspacePrimaryButtonClass =
    "inline-flex h-[52px] min-w-[132px] items-center justify-center gap-2 rounded-[16px] border border-[rgba(95,220,255,0.34)] bg-[radial-gradient(140px_90px_at_50%_0%,rgba(135,232,255,0.24),transparent_64%),linear-gradient(180deg,rgba(42,172,228,0.98),rgba(18,118,171,0.99))] px-6 text-[0.94rem] font-semibold tracking-[0.01em] text-white shadow-[0_20px_40px_rgba(10,93,138,0.34),inset_0_1px_0_rgba(235,250,255,0.16)] transition duration-150 hover:brightness-[1.05] hover:border-[rgba(117,225,255,0.42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(95,220,255,0.22)] disabled:cursor-not-allowed disabled:opacity-45";
  const workspacePrimaryIconButtonClass =
    "inline-flex h-[52px] w-[52px] items-center justify-center rounded-[16px] border border-[rgba(95,220,255,0.34)] bg-[radial-gradient(140px_90px_at_50%_0%,rgba(135,232,255,0.24),transparent_64%),linear-gradient(180deg,rgba(42,172,228,0.98),rgba(18,118,171,0.99))] text-white shadow-[0_20px_40px_rgba(10,93,138,0.34),inset_0_1px_0_rgba(235,250,255,0.16)] transition duration-150 hover:brightness-[1.05] hover:border-[rgba(117,225,255,0.42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(95,220,255,0.22)] disabled:cursor-not-allowed disabled:opacity-45";
  const workspaceSecondaryButtonClass =
    "inline-flex h-[52px] items-center justify-center gap-2 rounded-[16px] border border-[rgba(95,220,255,0.24)] bg-[radial-gradient(140px_80px_at_50%_0%,rgba(88,199,245,0.14),transparent_68%),linear-gradient(180deg,rgba(12,49,74,0.96),rgba(7,31,49,0.99))] px-6 text-[0.92rem] font-semibold tracking-[0.01em] text-[#eefaff] shadow-[0_16px_34px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(223,245,255,0.06)] transition duration-150 hover:border-[rgba(110,220,255,0.38)] hover:bg-[radial-gradient(140px_80px_at_50%_0%,rgba(103,207,247,0.18),transparent_68%),linear-gradient(180deg,rgba(15,58,88,0.98),rgba(8,35,54,0.99))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(95,220,255,0.18)] disabled:cursor-not-allowed disabled:opacity-45";
  const workspaceCancelButtonClass =
    "inline-flex h-[52px] min-w-[124px] items-center justify-center gap-2 rounded-[16px] border border-[rgba(237,129,129,0.3)] bg-[radial-gradient(130px_80px_at_50%_0%,rgba(255,182,182,0.14),transparent_66%),linear-gradient(180deg,rgba(72,30,38,0.96),rgba(48,18,27,0.99))] px-6 text-[0.92rem] font-semibold tracking-[0.01em] text-[#ffe8ea] shadow-[0_16px_34px_rgba(35,10,14,0.24),inset_0_1px_0_rgba(255,233,233,0.04)] transition duration-150 hover:border-[rgba(247,150,150,0.42)] hover:bg-[radial-gradient(130px_80px_at_50%_0%,rgba(255,192,192,0.18),transparent_66%),linear-gradient(180deg,rgba(86,35,44,0.98),rgba(57,22,31,0.99))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(246,154,154,0.18)] disabled:cursor-not-allowed disabled:opacity-45";
  const workspacePanelClass =
    "rounded-[24px] border border-[rgba(95,220,255,0.12)] bg-[linear-gradient(180deg,rgba(7,30,47,0.82),rgba(4,22,36,0.72))] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] sm:px-6 sm:py-6";

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.92fr)]">
      <section className={workspacePanelClass}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--ode-accent)]">
              {t("project.manage_title")}
            </div>
            <div className="mt-2 text-[1.18rem] font-semibold text-[var(--ode-text)]">{activeProjectLabel}</div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isActiveDefault ? (
              <span className="inline-flex min-h-9 items-center rounded-full border border-[rgba(95,220,255,0.24)] bg-[rgba(8,52,82,0.54)] px-3 text-[0.76rem] font-medium text-[#d9f4ff]">
                {t("project.default_active")}
              </span>
            ) : null}
            {activeProjectIsLinked && workspaceExternalChangeCount > 0 ? (
              <span className="inline-flex min-h-9 items-center rounded-full border border-[rgba(214,170,82,0.5)] bg-[rgba(71,51,14,0.86)] px-3 text-[0.76rem] font-medium text-[#f2d38b]">
                {t("project.external_changes_badge", { count: workspaceExternalChangeCount })}
              </span>
            ) : null}
            {activeProjectIsLinked && isWorkspaceExternalChangeChecking ? (
              <span className="inline-flex min-h-9 items-center rounded-full border border-[var(--ode-border)] bg-[rgba(5,29,46,0.55)] px-3 text-[0.76rem] text-[var(--ode-text-dim)]">
                {t("project.external_changes_checking")}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-5">
          <label className="mb-2 block text-[0.72rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
            {t("project.select")}
          </label>
          <div className="min-w-0" ref={workspaceMenuRef}>
            <button
              type="button"
              className={`flex h-[56px] w-full items-center justify-between rounded-[18px] border border-[var(--ode-border-strong)] bg-[rgba(5,29,48,0.9)] pl-6 pr-5 text-left text-[0.98rem] font-medium text-[var(--ode-text)] outline-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(32,150,210,0.18)] ${
                workspaceMenuOpen
                  ? "border-[var(--ode-border-accent)] shadow-[0_0_0_2px_rgba(74,194,255,0.16)]"
                  : "hover:border-[rgba(95,220,255,0.24)] hover:bg-[rgba(7,35,55,0.94)]"
              }`}
              aria-haspopup="listbox"
              aria-expanded={workspaceMenuOpen}
              onClick={() => setWorkspaceMenuOpen((prev) => !prev)}
            >
              <span className="block min-w-0 flex-1 truncate pl-1 leading-[1.38]">{activeProjectLabel}</span>
              <span
                className={`ml-4 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[rgba(126,154,176,0.16)] bg-[rgba(8,24,37,0.78)] text-[var(--ode-text-dim)] transition-transform ${
                  workspaceMenuOpen ? "rotate-180" : ""
                }`}
              >
                <ArrowDownGlyphSmall />
              </span>
            </button>
            {workspaceMenuOpen ? (
              <div
                className="mt-2 rounded-[18px] border border-[var(--ode-border-strong)] bg-[linear-gradient(180deg,rgba(7,34,56,0.98),rgba(4,22,39,0.98))] p-2.5 shadow-[0_20px_44px_rgba(0,0,0,0.34)]"
              >
                <div className="mb-2.5 flex items-center gap-2 rounded-[14px] border border-[rgba(126,154,176,0.16)] bg-[rgba(8,24,37,0.78)] px-4">
                  <span className="inline-flex h-10 w-5 shrink-0 items-center justify-center text-[var(--ode-text-dim)]">
                    <SearchGlyphSmall />
                  </span>
                  <input
                    ref={workspaceSearchInputRef}
                    type="text"
                    value={workspaceSearchQuery}
                    placeholder={t("project.search_placeholder")}
                    className="h-11 min-w-0 flex-1 border-none bg-transparent p-0 text-[0.92rem] leading-[1.3] text-[var(--ode-text)] outline-none placeholder:text-[var(--ode-text-dim)]"
                    onMouseDown={(event) => {
                      event.stopPropagation();
                    }}
                    onChange={(event) => {
                      setWorkspaceSearchQuery(event.target.value);
                    }}
                  />
                </div>
                <div role="listbox" className="max-h-64 overflow-y-auto overscroll-contain rounded-[14px] bg-[rgba(5,20,32,0.22)] p-2">
                  {showAllWorkspacesOption ? renderWorkspaceOption("", t("project.none")) : null}
                  {filteredLinkedProjects.length > 0 ? (
                    <>
                      <div className="px-6 pb-1 pt-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--ode-accent)]">
                        {t("project.scope_linked")}
                      </div>
                      {filteredLinkedProjects.map((project) => renderWorkspaceOption(project.id, project.name))}
                    </>
                  ) : null}
                  {filteredInternalProjects.length > 0 ? (
                    <>
                      <div className="px-6 pb-1 pt-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--ode-accent)]">
                        {t("project.scope_internal")}
                      </div>
                      {filteredInternalProjects.map((project) => renderWorkspaceOption(project.id, project.name))}
                    </>
                  ) : null}
                  {!hasWorkspaceResults ? (
                    <div className="rounded-[12px] border border-dashed border-[rgba(126,154,176,0.16)] bg-[rgba(8,24,37,0.34)] px-4 py-5 text-center text-[0.84rem] text-[var(--ode-text-dim)]">
                      {t("project.search_empty")}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2.5">
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
                label: isProjectDeleting ? t("project.deleting_short") : t("project.delete_btn"),
                onClick: onDeleteProjectWorkspace,
                disabled: isProjectImporting || isProjectResyncing || isProjectDeleting,
                tone: "danger",
                icon: <TrashGlyphSmall />
              })
            : null}
        </div>
      </section>

      <section className={workspacePanelClass}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--ode-accent)]">
              {t("project.name_modal_title")}
            </div>
          </div>
          {!workspaceCreateInlineOpen ? (
            <OdeTooltip label={t("project.create_btn")} side="top">
              <span className="inline-flex">
                <button
                  type="button"
                  aria-label={t("project.create_btn")}
                  className={workspacePrimaryIconButtonClass}
                  onClick={onOpenCreateWorkspace}
                  disabled={isProjectImporting || isWorkspaceCreating || isProjectResyncing || isProjectDeleting}
                >
                  <PlusGlyphSmall />
                </button>
              </span>
            </OdeTooltip>
          ) : null}
        </div>

        {workspaceCreateInlineOpen ? (
          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-[0.72rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
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
                placeholder=""
                className={workspaceFieldClass}
              />
            </div>

            <div>
              <label className="mb-2 block text-[0.72rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                {t("project.local_path_label")}
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={workspaceLocalPathInput}
                  onChange={(event) => onWorkspaceLocalPathInputChange(event.target.value)}
                  placeholder=""
                  className={`${workspaceFieldClass} min-w-0 flex-1`}
                />
                <button
                  type="button"
                  className={workspaceSecondaryButtonClass}
                  onClick={onPickWorkspaceLocalFolder}
                  disabled={isWorkspaceCreating}
                >
                  {t("project.local_path_browse_btn")}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                className={workspacePrimaryButtonClass}
                onClick={onCreateWorkspace}
                disabled={!workspaceNameInput.trim() || isWorkspaceCreating}
              >
                {isWorkspaceCreating ? t("project.creating") : t("project.name_modal_confirm")}
              </button>
              <button
                type="button"
                className={workspaceCancelButtonClass}
                onClick={onCancelCreateWorkspace}
                disabled={isWorkspaceCreating}
              >
                {t("project.name_modal_cancel")}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {workspaceError ? (
        <OdeTooltip label={workspaceError} side="top">
          <p className="xl:col-span-2 text-[0.82rem] text-[#ffb2b2]">{workspaceError}</p>
        </OdeTooltip>
      ) : null}
      {workspaceNotice ? <p className="xl:col-span-2 text-[0.82rem] text-[var(--ode-accent)]">{workspaceNotice}</p> : null}
    </div>
  );
}
