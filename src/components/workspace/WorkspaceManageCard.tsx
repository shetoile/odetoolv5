import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  FlagGlyphSmall,
  ImportGlyphSmall,
  PlusGlyphSmall,
  SearchGlyphSmall,
  TrashGlyphSmall
} from "@/components/Icons";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import { resolveWorkspaceOpenFolderPath } from "@/features/workspace/manage";
import { hasLinkedWorkspaceFolder, resolveActiveProject } from "@/features/workspace/scope";
import type { TranslationParams } from "@/lib/i18n";
import type { ProjectSummary } from "@/lib/types";

type TranslateFn = (key: string, params?: TranslationParams) => string;

const WORKSPACE_LIST_MIN_WIDTH = 270;
const WORKSPACE_LIST_DEFAULT_WIDTH = 360;
const WORKSPACE_LIST_MAX_WIDTH = 520;

type WorkspaceOrderSnapshot = {
  signature: string;
  ranks: Map<string, number>;
};

interface WorkspaceManageCardProps {
  t: TranslateFn;
  projects: ProjectSummary[];
  activeProjectId: string | null;
  defaultProjectId: string | null;
  isProjectImporting: boolean;
  isWorkspaceCreating: boolean;
  isProjectResyncing: boolean;
  isProjectDeleting: boolean;
  isWorkspaceDuplicating: boolean;
  isWorkspacePackageExporting: boolean;
  isWorkspacePackageImporting: boolean;
  workspaceExternalChangeCount: number;
  isWorkspaceExternalChangeChecking: boolean;
  workspaceError: string | null;
  workspaceNotice: string | null;
  onProjectSelectionChange: (projectId: string) => void;
  onOpenCreateWorkspace: () => void;
  onPickAndImportProjectFolder: () => void;
  onDuplicateWorkspace: () => void;
  onCopyWorkspaceSelection: (projectId: string) => void;
  onPasteWorkspaceSelection: () => void;
  onExportWorkspacePackage: () => void;
  onImportWorkspacePackage: () => void;
  onReSyncWorkspace: () => void;
  onDeleteProjectWorkspace: () => void;
  onSetActiveWorkspaceLocalPath: () => void;
  onSetDefaultWorkspace: () => void;
  onOpenWorkspaceFolderLocation: () => void;
  workspaceNumberingVisible: boolean;
  onWorkspaceNumberingVisibleChange: (enabled: boolean) => void;
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

function DuplicateGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M8.2 8.2h7.7a2 2 0 0 1 2 2v7.7a2 2 0 0 1-2 2H8.2a2 2 0 0 1-2-2v-7.7a2 2 0 0 1 2-2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 15.7H5a2 2 0 0 1-2-2V6.1a2 2 0 0 1 2-2h7.6a2 2 0 0 1 2 2v.5M12.1 11.4v5.4M9.4 14.1h5.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExportGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M5.2 14.4v3.2a2.2 2.2 0 0 0 2.2 2.2h9.2a2.2 2.2 0 0 0 2.2-2.2v-3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 4.2v10.2M8.3 7.9 12 4.2l3.7 3.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function OpenFolderGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M3.4 8.4V6.9a2 2 0 0 1 2-2h4l1.8 2.1h7.4a2 2 0 0 1 2 2v1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.6 10.5h16.8l-1.5 7a2.1 2.1 0 0 1-2.1 1.7H6.9a2.1 2.1 0 0 1-2.1-1.7Z"
        fill="rgba(78,200,243,0.14)"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinejoin="round"
      />
      <path
        d="M12 13.2v3.4M10.3 14.9H13.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SetFolderGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M3.6 8.3V6.8a2 2 0 0 1 2-2h4l1.7 2h7.1a2 2 0 0 1 2 2v1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.8 10.4h16.4l-1.4 7.1a2.1 2.1 0 0 1-2.1 1.7H7.1A2.1 2.1 0 0 1 5 17.5Z"
        fill="rgba(78,200,243,0.12)"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinejoin="round"
      />
      <path
        d="M12 12.9c1.25 0 2.25.94 2.25 2.08 0 1.56-2.25 3.56-2.25 3.56s-2.25-2-2.25-3.56c0-1.14 1-2.08 2.25-2.08Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinejoin="round"
      />
      <path d="M12 15.2h.01" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PackageImportGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="m12 3.8 7.1 3.6-7.1 3.6-7.1-3.6Z"
        fill="rgba(78,200,243,0.12)"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path
        d="M4.9 7.6v8.3l7.1 4.2 7.1-4.2V7.6M12 11.1v8.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 14.6H6.9m0 0 1.8-1.8m-1.8 1.8 1.8 1.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NumberingGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M9.5 6.8h9M9.5 12h9M9.5 17.2h9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M5.2 7.4h.1M4.7 11.2h1.2l-1.2 1.5h1.4M4.7 16.2h1.4l-.9 1.1c.7 0 1.1.3 1.1.8 0 .6-.5 1-1.3 1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RootNumberingGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M6.2 5.5h11.6a1.9 1.9 0 0 1 1.9 1.9v9.2a1.9 1.9 0 0 1-1.9 1.9H6.2a1.9 1.9 0 0 1-1.9-1.9V7.4a1.9 1.9 0 0 1 1.9-1.9Z"
        fill="rgba(78,200,243,0.12)"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path
        d="M8.1 9.2h7.8M8.1 12h7.8M8.1 14.8h4.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
      />
      <path
        d="M3.6 12H2.4M21.6 12h-1.2M12 3.6V2.4M12 21.6v-1.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
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

function getWorkspaceCreatedAt(project: ProjectSummary): number {
  return typeof project.createdAt === "number" && Number.isFinite(project.createdAt) ? project.createdAt : 0;
}

export function WorkspaceManageCard({
  t,
  projects,
  activeProjectId,
  defaultProjectId,
  isProjectImporting,
  isWorkspaceCreating,
  isProjectResyncing,
  isProjectDeleting,
  isWorkspaceDuplicating,
  isWorkspacePackageExporting,
  isWorkspacePackageImporting,
  workspaceExternalChangeCount,
  isWorkspaceExternalChangeChecking,
  workspaceError,
  workspaceNotice,
  onProjectSelectionChange,
  onOpenCreateWorkspace,
  onPickAndImportProjectFolder,
  onDuplicateWorkspace,
  onCopyWorkspaceSelection,
  onPasteWorkspaceSelection,
  onExportWorkspacePackage,
  onImportWorkspacePackage,
  onReSyncWorkspace,
  onDeleteProjectWorkspace,
  onSetActiveWorkspaceLocalPath,
  onSetDefaultWorkspace,
  onOpenWorkspaceFolderLocation,
  workspaceNumberingVisible,
  onWorkspaceNumberingVisibleChange,
  workspaceRootNumberingEnabled,
  onWorkspaceRootNumberingEnabledChange
}: WorkspaceManageCardProps) {
  const workspaceOrderSnapshotRef = useRef<WorkspaceOrderSnapshot>({ signature: "", ranks: new Map() });
  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const [workspaceListWidth, setWorkspaceListWidth] = useState(WORKSPACE_LIST_DEFAULT_WIDTH);
  const [isResizingWorkspaceList, setIsResizingWorkspaceList] = useState(false);

  const activeProject = resolveActiveProject(projects, activeProjectId);
  const activeProjectIsLinked = hasLinkedWorkspaceFolder(activeProject);
  const activeWorkspaceFolderPath = resolveWorkspaceOpenFolderPath(activeProject);
  const isActiveDefault = Boolean(activeProjectId && activeProjectId === defaultProjectId);
  const localPathActionLabel = activeWorkspaceFolderPath
    ? t("project.open_folder_btn")
    : t("project.local_path_btn");
  const showWorkspaceSyncAction = activeProjectIsLinked && workspaceExternalChangeCount > 0;

  const sortedProjects = useMemo(() => {
    const projectSignature = projects
      .map((project) => project.id)
      .sort()
      .join("|");
    const snapshot = workspaceOrderSnapshotRef.current;

    if (snapshot.signature !== projectSignature) {
      const rankedProjects = projects
        .map((project, index) => ({ project, index }))
        .sort((left, right) => {
          const createdDelta = getWorkspaceCreatedAt(right.project) - getWorkspaceCreatedAt(left.project);
          if (createdDelta !== 0) return createdDelta;
          return left.index - right.index;
        });
      workspaceOrderSnapshotRef.current = {
        signature: projectSignature,
        ranks: new Map(rankedProjects.map(({ project }, rank) => [project.id, rank]))
      };
    }

    const ranks = workspaceOrderSnapshotRef.current.ranks;
    return [...projects].sort((left, right) => {
      const leftRank = ranks.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = ranks.get(right.id) ?? Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) return leftRank - rightRank;
      const createdDelta = getWorkspaceCreatedAt(right) - getWorkspaceCreatedAt(left);
      if (createdDelta !== 0) return createdDelta;
      return left.name.localeCompare(right.name);
    });
  }, [projects]);

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

  const clampWorkspaceListWidth = (nextWidth: number) =>
    Math.min(WORKSPACE_LIST_MAX_WIDTH, Math.max(WORKSPACE_LIST_MIN_WIDTH, Math.round(nextWidth)));

  const nudgeWorkspaceListWidth = (delta: number) => {
    setWorkspaceListWidth((current) => clampWorkspaceListWidth(current + delta));
  };

  const startWorkspaceListResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const originX = event.clientX;
    const originWidth = workspaceListWidth;

    setIsResizingWorkspaceList(true);
    document.body.classList.add("ode-resizing");

    const handlePointerMove = (moveEvent: PointerEvent) => {
      setWorkspaceListWidth(clampWorkspaceListWidth(originWidth + moveEvent.clientX - originX));
    };

    const stopResize = () => {
      setIsResizingWorkspaceList(false);
      document.body.classList.remove("ode-resizing");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
  };

  const renderWorkspaceRow = (props: {
    key: string;
    projectId: string;
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
      aria-selected={props.selected}
      className={`w-full rounded-[14px] px-3 py-2.5 text-left transition-colors ${
        props.selected
          ? "bg-[rgba(11,56,84,0.72)] text-[var(--ode-text)]"
          : "text-[var(--ode-text-dim)] hover:bg-[rgba(8,40,61,0.44)] hover:text-[var(--ode-text)]"
      }`}
      onClick={props.onClick}
      onKeyDown={(event) => {
        const shortcutKey = event.key.toLowerCase();
        if ((event.ctrlKey || event.metaKey) && shortcutKey === "c") {
          event.preventDefault();
          onCopyWorkspaceSelection(props.projectId);
          return;
        }
        if ((event.ctrlKey || event.metaKey) && shortcutKey === "v") {
          event.preventDefault();
          onPasteWorkspaceSelection();
          return;
        }
        if ((event.ctrlKey || event.metaKey) && shortcutKey === "d") {
          event.preventDefault();
          if (props.selected && !workspaceActionBusy) {
            onDuplicateWorkspace();
          }
          return;
        }
        if ((event.key === "Delete" || event.key === "Backspace") && props.selected && !workspaceActionBusy) {
          event.preventDefault();
          onDeleteProjectWorkspace();
        }
      }}
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

  const renderActionGroup = (label: string, children: ReactNode) => (
    <div
      className="inline-flex items-center gap-1 rounded-[16px] bg-[rgba(5,25,39,0.24)] p-1"
      role="group"
      aria-label={label}
    >
      {children}
    </div>
  );

  const renderNumberingToggle = (props: {
    checked: boolean;
    title: string;
    icon: ReactNode;
    onChange: (checked: boolean) => void;
  }) => {
    const stateLabel = props.checked ? t("project.toggle_on") : t("project.toggle_off");
    return (
      <OdeTooltip label={`${props.title}: ${stateLabel}`} side="top">
        <span className="block">
          <button
            type="button"
            aria-label={`${props.title}: ${stateLabel}`}
            aria-pressed={props.checked}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-[14px] px-3 text-[0.78rem] font-semibold transition ${
              props.checked
                ? "bg-[rgba(18,92,131,0.42)] text-[var(--ode-text)] hover:bg-[rgba(18,92,131,0.54)]"
                : "bg-[rgba(8,40,61,0.24)] text-[var(--ode-text-dim)] hover:bg-[rgba(8,52,82,0.4)] hover:text-[var(--ode-text)]"
            }`}
            onClick={() => props.onChange(!props.checked)}
          >
            <span className="text-[var(--ode-accent)]">{props.icon}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[0.58rem] font-bold tracking-[0.12em] ${
                props.checked
                  ? "bg-[rgba(38,176,98,0.2)] text-[#8ff0b5]"
                  : "bg-[rgba(198,58,70,0.2)] text-[#ff9aa5]"
              }`}
            >
              {stateLabel}
            </span>
          </button>
        </span>
      </OdeTooltip>
    );
  };

  const renderNumberingControls = () => (
    <section
      className="inline-flex max-w-max flex-wrap items-center gap-2 rounded-[18px] bg-[rgba(5,25,39,0.18)] px-2 py-2"
      aria-label={t("project.numbering_title")}
    >
      {renderNumberingToggle({
        checked: workspaceNumberingVisible,
        title: t("project.numbering_toggle_title"),
        icon: <NumberingGlyphSmall />,
        onChange: onWorkspaceNumberingVisibleChange
      })}
      {workspaceNumberingVisible
        ? renderNumberingToggle({
          checked: workspaceRootNumberingEnabled,
          title: t("project.root_numbering_toggle_title"),
          icon: <RootNumberingGlyphSmall />,
          onChange: onWorkspaceRootNumberingEnabledChange
        })
        : null}
    </section>
  );

  const workspaceActionBusy =
    isProjectImporting ||
    isWorkspaceCreating ||
    isProjectResyncing ||
    isProjectDeleting ||
    isWorkspaceDuplicating ||
    isWorkspacePackageExporting ||
    isWorkspacePackageImporting;

  return (
    <div
      className="grid h-full min-h-[calc(100vh-4.75rem)] min-w-[68rem] gap-0 px-4 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-4"
      style={{
        gridTemplateColumns: `${workspaceListWidth}px 8px minmax(42rem,1fr)`
      }}
    >
      <aside className="min-h-0 min-w-0 pr-4">
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
                    projectId: project.id,
                    label: project.name,
                    detail:
                      formatWorkspaceTimestamp(
                        project.createdAt
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

      <OdeTooltip label={t("splitter.title")} side="bottom">
        <div
          className={`ode-splitter ${isResizingWorkspaceList ? "ode-splitter-active" : ""}`}
          onPointerDown={startWorkspaceListResize}
          onDoubleClick={() => setWorkspaceListWidth(WORKSPACE_LIST_DEFAULT_WIDTH)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              nudgeWorkspaceListWidth(event.ctrlKey ? -36 : -14);
              return;
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              nudgeWorkspaceListWidth(event.ctrlKey ? 36 : 14);
              return;
            }
            if (event.key === "Home") {
              event.preventDefault();
              setWorkspaceListWidth(WORKSPACE_LIST_MIN_WIDTH);
              return;
            }
            if (event.key === "End") {
              event.preventDefault();
              setWorkspaceListWidth(WORKSPACE_LIST_MAX_WIDTH);
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              setWorkspaceListWidth(WORKSPACE_LIST_DEFAULT_WIDTH);
            }
          }}
          role="separator"
          tabIndex={0}
          aria-label={t("splitter.aria")}
          aria-orientation="vertical"
          aria-valuemin={WORKSPACE_LIST_MIN_WIDTH}
          aria-valuenow={Math.round(workspaceListWidth)}
          aria-valuemax={WORKSPACE_LIST_MAX_WIDTH}
        />
      </OdeTooltip>

      <div className="min-h-0 min-w-[42rem] overflow-auto pl-5">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            {activeProject ? (
              <div className="min-w-0">
                <div className="truncate text-[1.08rem] font-semibold text-[var(--ode-text)]">
                  {activeProject.name}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.74rem]">
                  <span className="rounded-full bg-[rgba(8,40,61,0.34)] px-2.5 py-1 text-[var(--ode-text-dim)]">
                    {activeProjectIsLinked
                      ? t("project.scope_linked_value")
                      : t("project.scope_internal_value")}
                  </span>
                  {isActiveDefault ? (
                    <span className="rounded-full bg-[rgba(18,92,131,0.28)] px-2.5 py-1 text-[var(--ode-accent)]">
                      {t("project.default_active")}
                    </span>
                  ) : null}
                  {!activeWorkspaceFolderPath ? (
                    <span className="rounded-full bg-[rgba(74,52,18,0.32)] px-2.5 py-1 text-[#f2d38b]">
                      {t("project.no_local_path")}
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
                <div className="mt-2 flex max-w-4xl items-stretch gap-2">
                  {showWorkspaceSyncAction ? (
                    <OdeTooltip label={isProjectResyncing ? t("project.resyncing_short") : t("project.resync_btn")} side="top">
                      <span className="block">
                        <button
                          type="button"
                          className="ode-icon-btn h-full min-h-[56px] w-12 rounded-[14px] bg-[rgba(71,51,14,0.34)] text-[#f2d38b] hover:bg-[rgba(71,51,14,0.5)]"
                          onClick={onReSyncWorkspace}
                          disabled={workspaceActionBusy}
                          aria-label={isProjectResyncing ? t("project.resyncing_short") : t("project.resync_btn")}
                        >
                          <RefreshGlyphSmall spinning={isProjectResyncing} />
                        </button>
                      </span>
                    </OdeTooltip>
                  ) : null}
                  <OdeTooltip label={localPathActionLabel} side="top">
                    <span className="block min-w-0 flex-1">
                      <button
                        type="button"
                        className="w-full rounded-[14px] bg-[rgba(8,40,61,0.22)] px-3 py-2 text-left transition hover:bg-[rgba(8,52,82,0.38)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ode-border-accent)]"
                        onClick={activeWorkspaceFolderPath ? onOpenWorkspaceFolderLocation : onSetActiveWorkspaceLocalPath}
                        disabled={workspaceActionBusy}
                        aria-label={localPathActionLabel}
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="mt-0.5 shrink-0 text-[var(--ode-accent)]">
                            {activeWorkspaceFolderPath ? <OpenFolderGlyphSmall /> : <SetFolderGlyphSmall />}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[0.66rem] font-semibold uppercase tracking-[0.08em] text-[var(--ode-text-muted)]">
                              {t("project.local_path_label")}
                            </span>
                            <span className="mt-1 block break-all whitespace-pre-wrap text-[0.8rem] text-[var(--ode-text-dim)]">
                              {activeWorkspaceFolderPath ?? t("project.no_local_path")}
                            </span>
                          </span>
                        </div>
                      </button>
                    </span>
                  </OdeTooltip>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
              {renderActionGroup(
                `${t("project.create_btn")} / ${t("project.duplicate_btn")}`,
                <>
                  {renderActionButton({
                    label: isWorkspaceCreating ? t("project.creating") : t("project.create_btn"),
                    onClick: onOpenCreateWorkspace,
                    disabled: workspaceActionBusy,
                    icon: <PlusGlyphSmall />
                  })}
                  {activeProjectId
                    ? renderActionButton({
                        label: isWorkspaceDuplicating ? t("project.duplicating_short") : t("project.duplicate_btn"),
                        onClick: onDuplicateWorkspace,
                        disabled: workspaceActionBusy,
                        icon: <DuplicateGlyphSmall />
                      })
                    : null}
                  {activeProjectId
                    ? renderActionButton({
                        label: isActiveDefault ? t("project.default_active") : t("project.set_default_btn"),
                        onClick: onSetDefaultWorkspace,
                        disabled: workspaceActionBusy || isActiveDefault,
                        active: isActiveDefault,
                        icon: <FlagGlyphSmall active={!isActiveDefault} />
                      })
                    : null}
                </>
              )}
              {renderActionGroup(
                `${t("project.import_btn")} / ${t("project.export_workspace_btn")}`,
                <>
                  {renderActionButton({
                    label: isProjectImporting ? t("project.importing_short") : t("project.import_btn"),
                    onClick: onPickAndImportProjectFolder,
                    disabled: workspaceActionBusy,
                    icon: <ImportGlyphSmall />
                  })}
                  {renderActionButton({
                    label: isWorkspacePackageImporting
                      ? t("project.import_workspace_package_busy")
                      : t("project.import_workspace_package_btn"),
                    onClick: onImportWorkspacePackage,
                    disabled: workspaceActionBusy,
                    icon: <PackageImportGlyphSmall />
                  })}
                  {activeProjectId
                    ? renderActionButton({
                        label: isWorkspacePackageExporting
                          ? t("project.exporting_short")
                          : t("project.export_workspace_btn"),
                        onClick: onExportWorkspacePackage,
                        disabled: workspaceActionBusy,
                        icon: <ExportGlyphSmall />
                      })
                    : null}
                </>
              )}
              {renderNumberingControls()}
              {activeProjectId
                ? renderActionGroup(
                    t("project.delete_btn"),
                    renderActionButton({
                      label: isProjectDeleting ? t("project.deleting_short") : t("project.delete_btn"),
                      onClick: onDeleteProjectWorkspace,
                      disabled: workspaceActionBusy,
                      tone: "danger",
                      icon: <TrashGlyphSmall />
                    })
                  )
                : null}
            </div>
          </div>

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
