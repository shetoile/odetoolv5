import type { ChangeEvent, RefObject } from "react";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import type { TranslationParams } from "@/lib/i18n";
import { isFileLikeNode, type AppNode } from "@/lib/types";

type TranslateFn = (key: string, params?: TranslationParams) => string;
type WorkspaceMode = "grid" | "timeline";
type DesktopViewMode = "grid" | "mindmap" | "details" | "dashboard" | "library" | "procedure";
type WorkspaceFocusMode = "structure" | "data" | "execution";

interface MainPaneHeaderProps {
  t: TranslateFn;
  breadcrumbNodes: AppNode[];
  getBreadcrumbLabel?: (node: AppNode) => string;
  workspaceMode: WorkspaceMode;
  desktopViewMode: DesktopViewMode;
  workspaceFocusMode: WorkspaceFocusMode;
  documentationModeActive: boolean;
  workspaceStructureLocked: boolean;
  currentFolderNode: AppNode | null;
  uploadInputRef: RefObject<HTMLInputElement | null>;
  onUploadInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSelectBreadcrumbNode: (nodeId: string) => void;
  onOpenNodeHome: () => void | Promise<void>;
  onOpenNodeExecution: () => void | Promise<void>;
  onOpenNodeTimeline: () => void | Promise<void>;
}

export function MainPaneHeader({
  t,
  breadcrumbNodes,
  getBreadcrumbLabel,
  workspaceMode,
  desktopViewMode,
  workspaceFocusMode,
  documentationModeActive,
  workspaceStructureLocked,
  currentFolderNode,
  uploadInputRef,
  onUploadInputChange,
  onSelectBreadcrumbNode,
  onOpenNodeHome,
  onOpenNodeExecution,
  onOpenNodeTimeline
}: MainPaneHeaderProps) {
  const isLibraryActive = workspaceMode === "grid" && desktopViewMode === "library";
  const canShowNodeWorkspace =
    !isLibraryActive &&
    !documentationModeActive &&
    currentFolderNode !== null &&
    !isFileLikeNode(currentFolderNode) &&
    currentFolderNode.properties?.odeDashboardWidget !== true;
  const isHomeActive = workspaceMode === "grid" && desktopViewMode === "dashboard";
  const isExecutionActive =
    workspaceMode === "grid" &&
    workspaceFocusMode === "execution" &&
    desktopViewMode !== "dashboard";
  const isTimelineActive = workspaceMode === "timeline";

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--ode-border)] px-4 py-2.5 text-[1.02rem] text-[var(--ode-text-dim)]">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {isLibraryActive ? (
              <div className="ode-wrap-text leading-6">{t("tabs.library")}</div>
            ) : breadcrumbNodes.length > 0 ? (
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {breadcrumbNodes.map((node, idx) => {
                  const isCurrent = idx === breadcrumbNodes.length - 1;
                  const label = getBreadcrumbLabel ? getBreadcrumbLabel(node) : node.name;
                  return (
                    <div key={node.id} className="flex min-w-0 items-center gap-1.5">
                      {idx > 0 ? (
                        <span className="shrink-0 text-[var(--ode-text-subtle)]">/</span>
                      ) : null}
                      <button
                        type="button"
                        className={`min-w-0 max-w-[220px] truncate rounded-md px-2 py-[2px] text-left text-[0.98rem] transition ${
                          isCurrent
                            ? "bg-[rgba(32,119,170,0.2)] text-[var(--ode-text)]"
                            : "text-[var(--ode-text-dim)] hover:bg-[rgba(18,62,89,0.34)] hover:text-[var(--ode-text)]"
                        }`}
                        onClick={() => onSelectBreadcrumbNode(node.id)}
                        aria-label={node.name}
                      >
                        {label || "\u00A0"}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              documentationModeActive ? null : <div className="ode-wrap-text leading-6">{t("main.desktop")}</div>
            )}
            {workspaceStructureLocked ? (
              <span className="rounded-full border border-[rgba(223,198,119,0.42)] bg-[rgba(108,88,34,0.24)] px-2.5 py-0.5 text-[0.72rem] uppercase tracking-[0.08em] text-[#f3d98a]">
                {t("structure_lock.locked_badge")}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(workspaceMode === "grid" || workspaceMode === "timeline") && !documentationModeActive ? (
            <>
              {canShowNodeWorkspace ? (
                <div className="flex items-center gap-1 rounded-lg border border-[var(--ode-border)] bg-[rgba(3,18,30,0.42)] p-1">
                  <button
                    type="button"
                    className={`ode-mini-btn h-8 px-3 ${isHomeActive ? "ode-mini-btn-active" : ""}`}
                    onClick={() => {
                      void onOpenNodeHome();
                    }}
                  >
                    {t("desktop.view_home")}
                  </button>
                  <button
                    type="button"
                    className={`ode-mini-btn h-8 px-3 ${isExecutionActive ? "ode-mini-btn-active" : ""}`}
                    onClick={() => {
                      void onOpenNodeExecution();
                    }}
                  >
                    {t("tabs.execution")}
                  </button>
                  <button
                    type="button"
                    className={`ode-mini-btn h-8 px-3 ${isTimelineActive ? "ode-mini-btn-active" : ""}`}
                    onClick={() => {
                      void onOpenNodeTimeline();
                    }}
                  >
                    {t("tabs.timeline")}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
      <input
        ref={uploadInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={onUploadInputChange}
      />
    </>
  );
}
