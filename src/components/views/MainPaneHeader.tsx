import type { ChangeEvent, RefObject } from "react";
import { UploadGlyphSmall } from "@/components/Icons";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import type { TranslationParams } from "@/lib/i18n";
import type { AppNode } from "@/lib/types";

type TranslateFn = (key: string, params?: TranslationParams) => string;
type WorkspaceMode = "grid" | "timeline";
type DesktopViewMode = "grid" | "mindmap" | "details" | "procedure";
type WorkspaceFocusMode = "structure" | "data" | "execution";

interface MainPaneHeaderProps {
  t: TranslateFn;
  breadcrumbNodes: AppNode[];
  workspaceMode: WorkspaceMode;
  desktopViewMode: DesktopViewMode;
  workspaceFocusMode: WorkspaceFocusMode;
  documentationModeActive: boolean;
  workspaceStructureLocked: boolean;
  uploadInputRef: RefObject<HTMLInputElement | null>;
  onUploadInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onTriggerDesktopUpload: () => void;
  onSelectBreadcrumbNode: (nodeId: string) => void;
  onSetDesktopViewMode: (mode: DesktopViewMode) => void;
}

export function MainPaneHeader({
  t,
  breadcrumbNodes,
  workspaceMode,
  desktopViewMode,
  workspaceFocusMode,
  documentationModeActive,
  workspaceStructureLocked,
  uploadInputRef,
  onUploadInputChange,
  onTriggerDesktopUpload,
  onSelectBreadcrumbNode,
  onSetDesktopViewMode
}: MainPaneHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--ode-border)] px-4 py-2.5 text-[1.02rem] text-[var(--ode-text-dim)]">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {breadcrumbNodes.length > 0 ? (
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {breadcrumbNodes.map((node, idx) => {
                  const isCurrent = idx === breadcrumbNodes.length - 1;
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
                        {node.name}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="ode-wrap-text leading-6">
                {documentationModeActive ? t("tabs.documentation") : t("main.desktop")}
              </div>
            )}
            {workspaceStructureLocked ? (
              <span className="rounded-full border border-[rgba(223,198,119,0.42)] bg-[rgba(108,88,34,0.24)] px-2.5 py-0.5 text-[0.72rem] uppercase tracking-[0.08em] text-[#f3d98a]">
                {t("structure_lock.locked_badge")}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {workspaceMode === "grid" && !documentationModeActive ? (
            <>
              {workspaceFocusMode === "execution" ? (
                <div className="flex items-center gap-1 rounded-lg border border-[rgba(81,182,214,0.26)] bg-[linear-gradient(180deg,rgba(8,42,63,0.88),rgba(5,25,40,0.9))] p-1 shadow-[0_0_0_1px_rgba(10,110,152,0.12)]">
                  <button
                    type="button"
                    className={`ode-mini-btn h-8 px-3 ${desktopViewMode === "grid" ? "ode-mini-btn-active" : ""}`}
                    onClick={() => onSetDesktopViewMode("grid")}
                  >
                    {t("desktop.view_grid")}
                  </button>
                  <button
                    type="button"
                    className={`ode-mini-btn h-8 px-3 ${desktopViewMode === "details" ? "ode-mini-btn-active" : ""}`}
                    onClick={() => onSetDesktopViewMode("details")}
                  >
                    {t("desktop.view_details")}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 rounded-lg border border-[var(--ode-border)] bg-[rgba(3,18,30,0.42)] p-1">
                  <button
                    type="button"
                    className={`ode-mini-btn h-8 px-3 ${desktopViewMode === "grid" ? "ode-mini-btn-active" : ""}`}
                    onClick={() => onSetDesktopViewMode("grid")}
                  >
                    {t("desktop.view_grid")}
                  </button>
                  {workspaceFocusMode === "structure" ? (
                    <button
                      type="button"
                      className={`ode-mini-btn h-8 px-3 ${desktopViewMode === "mindmap" ? "ode-mini-btn-active" : ""}`}
                      onClick={() => onSetDesktopViewMode("mindmap")}
                    >
                      {t("desktop.view_mindmap")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={`ode-mini-btn h-8 px-3 ${desktopViewMode === "details" ? "ode-mini-btn-active" : ""}`}
                    onClick={() => onSetDesktopViewMode("details")}
                  >
                    {t("desktop.view_details")}
                  </button>
                </div>
              )}
              {workspaceFocusMode !== "execution" &&
              (desktopViewMode === "grid" || desktopViewMode === "mindmap" || desktopViewMode === "details") ? (
                <OdeTooltip label={t("desktop.upload")} side="bottom" align="end">
                  <button
                    className="ode-mini-btn h-8 w-8"
                    onClick={onTriggerDesktopUpload}
                    aria-label={t("desktop.upload")}
                  >
                    <UploadGlyphSmall />
                  </button>
                </OdeTooltip>
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
