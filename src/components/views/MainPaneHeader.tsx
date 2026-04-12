import type { ChangeEvent, RefObject } from "react";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import type {
  WorkspaceNavigationActions,
  WorkspaceNavigationState
} from "@/features/workspace/navigation";
import type { WorkspaceScopeContext } from "@/features/workspace/scope";
import type { TranslationParams } from "@/lib/i18n";
import { QuickAppIcon } from "@/components/quick-apps/QuickAppIcon";
import { PlusGlyphSmall, SettingsGlyphSmall } from "@/components/Icons";
import type { NodeQuickAppItem } from "@/lib/nodeQuickApps";
import { isFileLikeNode, type AppNode } from "@/lib/types";

type TranslateFn = (key: string, params?: TranslationParams) => string;

interface MainPaneHeaderProps {
  t: TranslateFn;
  navigationState: Pick<
    WorkspaceNavigationState,
    "breadcrumbNodes" | "workspaceMode" | "desktopViewMode" | "workspaceFocusMode" | "mainPaneTargetNode"
  >;
  scopeContext: Pick<WorkspaceScopeContext, "documentationModeActive" | "libraryModeActive">;
  navigationActions: Pick<
    WorkspaceNavigationActions,
    "selectBreadcrumbNode" | "openNodeHome" | "openNodeExecution" | "openNodeTimeline"
  >;
  getBreadcrumbLabel?: (node: AppNode) => string;
  workspaceTitle?: string | null;
  workspaceStructureLocked: boolean;
  workspaceQuickApps: NodeQuickAppItem[];
  uploadInputRef: RefObject<HTMLInputElement | null>;
  onUploadInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onLaunchWorkspaceQuickApp: (item: NodeQuickAppItem) => void | Promise<void>;
  onManageWorkspaceQuickApps: () => void;
}

export function MainPaneHeader({
  t,
  navigationState,
  scopeContext,
  navigationActions,
  getBreadcrumbLabel,
  workspaceTitle = null,
  workspaceStructureLocked,
  workspaceQuickApps,
  uploadInputRef,
  onUploadInputChange,
  onLaunchWorkspaceQuickApp,
  onManageWorkspaceQuickApps
}: MainPaneHeaderProps) {
  const { breadcrumbNodes, workspaceMode, desktopViewMode, workspaceFocusMode, mainPaneTargetNode } =
    navigationState;
  const { documentationModeActive, libraryModeActive } = scopeContext;
  const isLibraryActive = workspaceMode === "grid" && desktopViewMode === "library";
  const canShowNodeWorkspace =
    !isLibraryActive &&
    !libraryModeActive &&
    !documentationModeActive &&
    mainPaneTargetNode !== null &&
    !isFileLikeNode(mainPaneTargetNode) &&
    mainPaneTargetNode.properties?.odeDashboardWidget !== true;
  const isHomeActive = workspaceMode === "grid" && desktopViewMode === "dashboard";
  const isExecutionActive =
    workspaceMode === "grid" &&
    workspaceFocusMode === "execution" &&
    desktopViewMode !== "dashboard";
  const isTimelineActive = workspaceMode === "timeline";
  const showWorkspaceApps = !documentationModeActive && !isLibraryActive;
  const workspaceAppsControl = showWorkspaceApps ? (
    <div className="flex items-center gap-1 rounded-[16px] border border-[var(--ode-border)] bg-[rgba(3,18,30,0.42)] p-[5px] shadow-[inset_0_1px_0_rgba(125,221,255,0.04)]">
      {workspaceQuickApps.map((item) => (
        <OdeTooltip key={item.id} label={item.label} side="bottom">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-[11px] border border-[rgba(56,138,188,0.3)] bg-[rgba(8,36,57,0.58)] text-[var(--ode-text-dim)] transition hover:border-[rgba(88,201,244,0.54)] hover:bg-[rgba(11,56,86,0.72)] hover:text-[var(--ode-text)]"
            onClick={() => {
              void onLaunchWorkspaceQuickApp(item);
            }}
            aria-label={item.label}
          >
            <QuickAppIcon item={item} variant="dock" />
          </button>
        </OdeTooltip>
      ))}
      <OdeTooltip label={workspaceQuickApps.length > 0 ? "Manage workspace apps" : "Add workspace apps"} side="bottom">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-[11px] border border-[rgba(56,138,188,0.3)] bg-[rgba(8,36,57,0.58)] text-[var(--ode-text-dim)] transition hover:border-[rgba(88,201,244,0.54)] hover:bg-[rgba(11,56,86,0.72)] hover:text-[var(--ode-text)]"
          onClick={() => {
            onManageWorkspaceQuickApps();
          }}
          aria-label={workspaceQuickApps.length > 0 ? "Manage workspace apps" : "Add workspace apps"}
        >
          {workspaceQuickApps.length > 0 ? <SettingsGlyphSmall /> : <PlusGlyphSmall />}
        </button>
      </OdeTooltip>
    </div>
  ) : null;

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--ode-border)] px-4 py-2.5 text-[1.02rem] text-[var(--ode-text-dim)]">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {breadcrumbNodes.length > 0 ? (
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
                        onClick={() => navigationActions.selectBreadcrumbNode(node.id)}
                        aria-label={node.name}
                      >
                        {label || "\u00A0"}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : documentationModeActive || isLibraryActive ? null : workspaceTitle?.trim() ? (
              <div className="ode-wrap-text leading-6">{workspaceTitle.trim()}</div>
            ) : null}
            {workspaceStructureLocked ? (
              <span className="rounded-full border border-[rgba(223,198,119,0.42)] bg-[rgba(108,88,34,0.24)] px-2.5 py-0.5 text-[0.72rem] uppercase tracking-[0.08em] text-[#f3d98a]">
                {t("structure_lock.locked_badge")}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {workspaceAppsControl}
          {(workspaceMode === "grid" || workspaceMode === "timeline") && !documentationModeActive ? (
            <>
              {canShowNodeWorkspace ? (
                <div className="flex items-center gap-1.5 rounded-[16px] border border-[var(--ode-border)] bg-[rgba(3,18,30,0.42)] p-[5px] shadow-[inset_0_1px_0_rgba(125,221,255,0.04)]">
                  <button
                    type="button"
                    className={`inline-flex h-9 min-w-[92px] items-center justify-center rounded-[12px] border px-4 text-[0.9rem] tracking-[0.03em] transition ${
                      isHomeActive
                        ? "border-[rgba(88,201,244,0.76)] bg-[linear-gradient(180deg,rgba(14,94,143,0.96),rgba(9,60,94,0.94))] text-[var(--ode-text)] shadow-[inset_0_0_0_1px_rgba(149,228,255,0.16)]"
                        : "border-[rgba(56,138,188,0.36)] bg-[rgba(8,36,57,0.58)] text-[var(--ode-text-dim)] hover:border-[rgba(88,201,244,0.54)] hover:bg-[rgba(11,56,86,0.72)] hover:text-[var(--ode-text)]"
                    }`}
                    onClick={() => {
                      void navigationActions.openNodeHome(mainPaneTargetNode?.id ?? null);
                    }}
                  >
                    {t("desktop.view_home")}
                  </button>
                  <button
                    type="button"
                    className={`inline-flex h-9 min-w-[92px] items-center justify-center rounded-[12px] border px-4 text-[0.9rem] tracking-[0.03em] transition ${
                      isExecutionActive
                        ? "border-[rgba(88,201,244,0.76)] bg-[linear-gradient(180deg,rgba(14,94,143,0.96),rgba(9,60,94,0.94))] text-[var(--ode-text)] shadow-[inset_0_0_0_1px_rgba(149,228,255,0.16)]"
                        : "border-[rgba(56,138,188,0.36)] bg-[rgba(8,36,57,0.58)] text-[var(--ode-text-dim)] hover:border-[rgba(88,201,244,0.54)] hover:bg-[rgba(11,56,86,0.72)] hover:text-[var(--ode-text)]"
                    }`}
                    onClick={() => {
                      void navigationActions.openNodeExecution(mainPaneTargetNode?.id ?? null);
                    }}
                  >
                    {t("tabs.execution")}
                  </button>
                  <button
                    type="button"
                    className={`inline-flex h-9 min-w-[92px] items-center justify-center rounded-[12px] border px-4 text-[0.9rem] tracking-[0.03em] transition ${
                      isTimelineActive
                        ? "border-[rgba(88,201,244,0.76)] bg-[linear-gradient(180deg,rgba(14,94,143,0.96),rgba(9,60,94,0.94))] text-[var(--ode-text)] shadow-[inset_0_0_0_1px_rgba(149,228,255,0.16)]"
                        : "border-[rgba(56,138,188,0.36)] bg-[rgba(8,36,57,0.58)] text-[var(--ode-text-dim)] hover:border-[rgba(88,201,244,0.54)] hover:bg-[rgba(11,56,86,0.72)] hover:text-[var(--ode-text)]"
                    }`}
                    onClick={() => {
                      void navigationActions.openNodeTimeline(mainPaneTargetNode?.id ?? null);
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
