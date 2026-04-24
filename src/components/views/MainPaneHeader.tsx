import { useEffect, useRef, useState, type ChangeEvent, type RefObject } from "react";
import {
  EditGlyphSmall,
  FileGlyphSmall,
  PlusGlyphSmall,
  SettingsGlyphSmall,
  SparkGlyphSmall,
  UploadGlyphSmall
} from "@/components/Icons";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import { QuickAppIcon } from "@/components/quick-apps/QuickAppIcon";
import type { TranslationParams } from "@/lib/i18n";
import { isFileLikeNode, type AppNode } from "@/lib/types";
import type { NodeQuickAppItem } from "@/lib/nodeQuickApps";

type TranslateFn = (key: string, params?: TranslationParams) => string;

interface MainPaneHeaderProps {
  t: TranslateFn;
  breadcrumbNodes: AppNode[];
  activeWorkspaceRootId?: string | null;
  getBreadcrumbLabel?: (node: AppNode) => string;
  isDesktopRuntime?: boolean;
  documentationModeActive: boolean;
  workspaceStructureLocked: boolean;
  currentFolderNode: AppNode | null;
  fileItems?: AppNode[];
  showUploadAction?: boolean;
  uploadInputRef: RefObject<HTMLInputElement | null>;
  onUploadInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onTriggerUpload?: () => void;
  onOpenFileItem?: (nodeId: string) => void;
  onSelectBreadcrumbNode: (nodeId: string) => void;
  commandBarEnabled: boolean;
  commandBarBusy: boolean;
  commandBarActive: boolean;
  onOpenCommandBar: () => void;
  onOpenWorkspaceSettings: () => void;
  workspaceSettingsEnabled: boolean;
  onOpenFunctionQuickApps: () => void;
  functionQuickAppsEnabled: boolean;
  functionQuickApps: NodeQuickAppItem[];
  onLaunchFunctionQuickApp: (item: NodeQuickAppItem) => void;
}

function QuickAppStrip({
  t,
  scopeLabel,
  items,
  onLaunch,
  onManage
}: {
  t: TranslateFn;
  scopeLabel: string;
  items: NodeQuickAppItem[];
  onLaunch: (item: NodeQuickAppItem) => void;
  onManage: () => void;
}) {
  return (
    <div className="flex max-w-[360px] items-center gap-1.5 overflow-x-auto rounded-[14px] bg-[rgba(4,24,39,0.42)] px-1 py-1">
      {items.map((item) => (
        <OdeTooltip key={item.id} label={item.label || scopeLabel} side="bottom">
          <button
            type="button"
            className="group inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-transparent p-0 text-[var(--ode-text)] transition duration-150 hover:-translate-y-[1px] hover:bg-[rgba(18,75,108,0.26)]"
            onClick={() => onLaunch(item)}
            aria-label={t("quick_apps.open_item", { name: item.label })}
          >
            <QuickAppIcon item={item} variant="dock" />
          </button>
        </OdeTooltip>
      ))}
      <OdeTooltip label={items.length > 0 ? t("quick_apps.manage") : scopeLabel} side="bottom" align="end">
        <button
          type="button"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-transparent bg-[rgba(7,36,57,0.28)] text-[var(--ode-text-dim)] transition hover:bg-[rgba(10,50,77,0.38)] hover:text-[var(--ode-text)]"
          onClick={onManage}
          aria-label={items.length > 0 ? t("quick_apps.manage") : scopeLabel}
        >
          {items.length > 0 ? <EditGlyphSmall /> : <PlusGlyphSmall />}
        </button>
      </OdeTooltip>
    </div>
  );
}

export function MainPaneHeader({
  t,
  breadcrumbNodes,
  activeWorkspaceRootId = null,
  getBreadcrumbLabel,
  isDesktopRuntime = false,
  documentationModeActive,
  workspaceStructureLocked,
  currentFolderNode,
  fileItems = [],
  showUploadAction = false,
  uploadInputRef,
  onUploadInputChange,
  onTriggerUpload,
  onOpenFileItem,
  onSelectBreadcrumbNode,
  commandBarEnabled,
  commandBarBusy,
  commandBarActive,
  onOpenCommandBar,
  onOpenWorkspaceSettings,
  workspaceSettingsEnabled,
  onOpenFunctionQuickApps,
  functionQuickAppsEnabled,
  functionQuickApps,
  onLaunchFunctionQuickApp
}: MainPaneHeaderProps) {
  const [filesMenuOpen, setFilesMenuOpen] = useState(false);
  const filesMenuRef = useRef<HTMLDivElement | null>(null);
  const canShowWorkspaceQuickApps =
    functionQuickAppsEnabled &&
    !documentationModeActive &&
    (!currentFolderNode ||
      (!isFileLikeNode(currentFolderNode) && currentFolderNode.properties?.odeDashboardWidget !== true));
  const visibleFileItems = fileItems.filter((item) => isFileLikeNode(item));
  const canShowAiAction =
    commandBarEnabled &&
    !documentationModeActive &&
    (!currentFolderNode || !isFileLikeNode(currentFolderNode));
  const canShowFilesAction =
    showUploadAction &&
    visibleFileItems.length > 0 &&
    !documentationModeActive &&
    (!currentFolderNode || !isFileLikeNode(currentFolderNode));
  const shouldHideWorkspaceRootFallback =
    Boolean(activeWorkspaceRootId) && currentFolderNode?.id === activeWorkspaceRootId;
  const fallbackPaneLabel =
    documentationModeActive || shouldHideWorkspaceRootFallback
      ? null
      : currentFolderNode?.name || t("main.desktop");
  const filesLabel = `${t("desktop.mindmap_files")} [${visibleFileItems.length}]`;
  const hasHeaderActions =
    canShowAiAction ||
    canShowFilesAction ||
    showUploadAction ||
    workspaceSettingsEnabled ||
    canShowWorkspaceQuickApps;

  useEffect(() => {
    setFilesMenuOpen(false);
  }, [currentFolderNode?.id, visibleFileItems.length]);

  useEffect(() => {
    if (!filesMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!filesMenuRef.current?.contains(event.target as Node)) {
        setFilesMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFilesMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [filesMenuOpen]);

  return (
    <>
      <div
        className={`flex items-center gap-3 py-2.5 pl-4 text-[1.02rem] text-[var(--ode-text-dim)] ${
          isDesktopRuntime && hasHeaderActions ? "pr-[11rem]" : "pr-4"
        }`}
      >
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
                        onClick={() => onSelectBreadcrumbNode(node.id)}
                        aria-label={node.name}
                      >
                        {label || "\u00A0"}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : fallbackPaneLabel ? (
              <div className="ode-wrap-text leading-6">{fallbackPaneLabel}</div>
            ) : null}
            {workspaceStructureLocked ? (
              <span className="rounded-full border border-[rgba(223,198,119,0.42)] bg-[rgba(108,88,34,0.24)] px-2.5 py-0.5 text-[0.72rem] uppercase tracking-[0.08em] text-[#f3d98a]">
                {t("structure_lock.locked_badge")}
              </span>
            ) : null}
          </div>
        </div>
        {hasHeaderActions ? (
          <div className="flex min-w-0 shrink-0 items-center gap-2">
            {canShowAiAction ? (
              <OdeTooltip label={t("command.title")} side="bottom" align="end">
                <button
                  type="button"
                  className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition ${
                    commandBarActive
                      ? "border-[rgba(101,194,239,0.42)] bg-[rgba(12,77,117,0.34)] text-[var(--ode-accent)]"
                      : "border-[rgba(90,162,204,0.24)] bg-[rgba(7,36,57,0.32)] text-[var(--ode-text-dim)] hover:bg-[rgba(10,50,77,0.42)] hover:text-[var(--ode-text)]"
                  }`}
                  onClick={onOpenCommandBar}
                  disabled={commandBarBusy}
                  aria-label={t("command.title")}
                  aria-pressed={commandBarActive}
                >
                  <SparkGlyphSmall />
                </button>
              </OdeTooltip>
            ) : null}
            {canShowFilesAction ? (
              <div ref={filesMenuRef} className="relative">
                <button
                  type="button"
                  className={`inline-flex h-10 items-center gap-2 rounded-[14px] border px-4 text-[0.88rem] font-medium transition ${
                    filesMenuOpen
                      ? "border-[rgba(101,194,239,0.42)] bg-[rgba(12,77,117,0.34)] text-[var(--ode-accent)]"
                      : "border-[rgba(92,189,232,0.24)] bg-[rgba(7,36,57,0.32)] text-[var(--ode-text)] hover:-translate-y-[1px] hover:bg-[rgba(12,55,81,0.42)]"
                  }`}
                  onClick={() => setFilesMenuOpen((current) => !current)}
                  aria-expanded={filesMenuOpen}
                  aria-haspopup="menu"
                >
                  <FileGlyphSmall />
                  <span>{filesLabel}</span>
                </button>
                {filesMenuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+0.55rem)] z-30 w-[340px] overflow-hidden rounded-[20px] border border-[rgba(92,189,232,0.22)] bg-[rgba(4,24,39,0.98)] shadow-[0_18px_44px_rgba(0,0,0,0.34)]">
                    {visibleFileItems.length > 0 ? (
                      <div className="max-h-[320px] overflow-auto p-2">
                        {visibleFileItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="flex w-full items-center gap-3 rounded-[14px] px-3 py-3 text-left transition hover:bg-[rgba(10,50,77,0.34)]"
                            onClick={() => {
                              setFilesMenuOpen(false);
                              onOpenFileItem?.(item.id);
                            }}
                          >
                            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[rgba(7,36,57,0.42)] text-[var(--ode-text-dim)]">
                              <FileGlyphSmall />
                            </span>
                            <span className="min-w-0 truncate text-[0.9rem] text-[var(--ode-text)]">{item.name}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-4 text-[0.88rem] text-[var(--ode-text-dim)]">{t("command.ai_files_none")}</div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
            {showUploadAction ? (
              <OdeTooltip label={t("desktop.upload")} side="bottom" align="end">
                <button
                  type="button"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[rgba(92,189,232,0.24)] bg-[rgba(7,36,57,0.32)] text-[var(--ode-text-dim)] transition hover:-translate-y-[1px] hover:bg-[rgba(12,55,81,0.42)] hover:text-[var(--ode-text)]"
                  onClick={() => {
                    onTriggerUpload?.();
                  }}
                  aria-label={t("desktop.upload")}
                >
                  <UploadGlyphSmall />
                </button>
              </OdeTooltip>
            ) : null}
            {workspaceSettingsEnabled ? (
              <OdeTooltip label={t("project.settings_title")} side="bottom" align="end">
                <button
                  type="button"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[rgba(90,162,204,0.24)] bg-[rgba(7,36,57,0.32)] text-[var(--ode-text-dim)] transition hover:bg-[rgba(10,50,77,0.42)] hover:text-[var(--ode-text)]"
                  onClick={onOpenWorkspaceSettings}
                  aria-label={t("project.settings_title")}
                >
                  <SettingsGlyphSmall />
                </button>
              </OdeTooltip>
            ) : null}
            {canShowWorkspaceQuickApps ? (
              <QuickAppStrip
                t={t}
                scopeLabel={t("quick_apps.scope_function")}
                items={functionQuickApps}
                onLaunch={onLaunchFunctionQuickApp}
                onManage={onOpenFunctionQuickApps}
              />
            ) : null}
          </div>
        ) : null}
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
