import { EditGlyphSmall, PlusGlyphSmall, SparkGlyphSmall, UploadGlyphSmall } from "@/components/Icons";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import { QuickAppIcon } from "@/components/quick-apps/QuickAppIcon";
import type { TranslationParams } from "@/lib/i18n";
import type { NodeQuickAppItem } from "@/lib/nodeQuickApps";

type TranslateFn = (key: string, params?: TranslationParams) => string;

export type DesktopNodeTabItem = {
  nodeId: string;
  title: string;
};

interface DesktopNodeTabBarProps {
  t: TranslateFn;
  tabs: DesktopNodeTabItem[];
  activeTabId: string | null;
  isSidebarCollapsed?: boolean;
  showUploadAction?: boolean;
  showAiAction?: boolean;
  showQuickAppsAction?: boolean;
  activeTabQuickApps?: NodeQuickAppItem[];
  onActivateTab: (nodeId: string) => void;
  onCloseTab: (nodeId: string) => void;
  onTriggerUpload?: () => void;
  onOpenAiForActiveTab?: () => void;
  onLaunchQuickAppForActiveTab?: (item: NodeQuickAppItem) => void;
  onManageQuickAppsForActiveTab?: () => void;
}

export function DesktopNodeTabBar({
  t,
  tabs,
  activeTabId,
  isSidebarCollapsed = false,
  showUploadAction = false,
  showAiAction = false,
  showQuickAppsAction = false,
  activeTabQuickApps = [],
  onActivateTab,
  onCloseTab,
  onTriggerUpload,
  onOpenAiForActiveTab,
  onLaunchQuickAppForActiveTab,
  onManageQuickAppsForActiveTab
}: DesktopNodeTabBarProps) {
  if (tabs.length === 0 && !showUploadAction && !showAiAction && !showQuickAppsAction) return null;

  return (
    <div className={`bg-transparent py-1 ${isSidebarCollapsed ? "pl-0 pr-4" : "px-4"}`}>
      <div className="flex items-center gap-2 pb-0.5">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {showUploadAction ? (
            <OdeTooltip label={t("desktop.upload")} side="top" align="start">
              <button
                type="button"
                className="group inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-transparent bg-[rgba(10,45,66,0.46)] text-[var(--ode-text-dim)] transition hover:bg-[rgba(12,54,79,0.62)] hover:text-[var(--ode-text)]"
                onClick={() => {
                  onTriggerUpload?.();
                }}
                aria-label={t("desktop.upload")}
              >
                <UploadGlyphSmall />
              </button>
            </OdeTooltip>
          ) : null}
          {showAiAction && activeTabId ? (
            <OdeTooltip label={t("command.title")} side="top" align="start">
              <button
                type="button"
                className="group inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-transparent bg-[rgba(10,45,66,0.46)] px-0 text-[var(--ode-text-dim)] transition hover:bg-[rgba(12,54,79,0.62)] hover:text-[var(--ode-text)]"
                onClick={() => {
                  onOpenAiForActiveTab?.();
                }}
                aria-label={t("command.title")}
              >
                <SparkGlyphSmall />
              </button>
            </OdeTooltip>
          ) : null}
          {tabs.map((tab) => {
            const active = tab.nodeId === activeTabId;
            return (
              <div
                key={tab.nodeId}
                className={`group relative flex max-w-[188px] shrink-0 items-center gap-1 rounded-[10px] px-1 py-[3px] transition ${
                  active
                    ? "bg-[linear-gradient(180deg,rgba(14,69,101,0.34),rgba(7,32,49,0.18))] shadow-[inset_0_1px_0_rgba(135,220,255,0.12)]"
                    : "bg-transparent hover:bg-[rgba(10,37,57,0.12)]"
                }`}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center rounded-[8px] px-2.5 py-1 text-left"
                  onClick={() => onActivateTab(tab.nodeId)}
                  aria-label={t("desktop.node_tab_open", { name: tab.title })}
                >
                  <span className="min-w-0 max-w-[132px] truncate">
                    <span
                      className={`block truncate text-[0.84rem] font-medium leading-[1.1rem] ${
                        active
                          ? "text-[#f2fbff]"
                          : "text-[var(--ode-text-dim)] group-hover:text-[var(--ode-text)]"
                      }`}
                    >
                      {tab.title}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.78rem] leading-none transition ${
                    active
                      ? "bg-[rgba(36,110,151,0.18)] text-[rgba(236,249,255,0.9)] hover:bg-[rgba(118,204,244,0.16)]"
                      : "text-[var(--ode-text-muted)] hover:bg-[rgba(23,63,91,0.28)] hover:text-[var(--ode-text)]"
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onCloseTab(tab.nodeId);
                  }}
                  aria-label={t("desktop.node_tab_close", { name: tab.title })}
                >
                  <span aria-hidden>x</span>
                </button>
                <span
                  className={`pointer-events-none absolute bottom-[1px] left-1/2 h-[2px] -translate-x-1/2 rounded-full transition ${
                    active
                      ? "w-9 bg-[rgba(136,227,255,0.98)] shadow-[0_0_10px_rgba(120,214,255,0.34)]"
                      : "w-0 bg-transparent group-hover:w-5 group-hover:bg-[rgba(128,220,255,0.28)]"
                  }`}
                />
              </div>
            );
          })}
        </div>
        {showQuickAppsAction && activeTabId ? (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {activeTabQuickApps.length > 0 ? (
              <div className="flex max-w-[340px] items-center gap-1 overflow-x-auto rounded-[12px] bg-[rgba(10,45,66,0.34)] px-1 py-1">
                {activeTabQuickApps.map((item) => (
                  <OdeTooltip key={item.id} label={item.label || t("quick_apps.scope_tab")} side="top" align="end">
                    <button
                      type="button"
                      className="group inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-transparent p-0 text-[var(--ode-text-dim)] transition hover:-translate-y-[1px] hover:bg-[rgba(18,75,108,0.22)] hover:text-[var(--ode-text)]"
                      onClick={() => {
                        onLaunchQuickAppForActiveTab?.(item);
                      }}
                      aria-label={t("quick_apps.open_item", { name: item.label })}
                    >
                      <QuickAppIcon item={item} variant="dock" />
                    </button>
                  </OdeTooltip>
                ))}
              </div>
            ) : null}
            <OdeTooltip label={t("quick_apps.manage_tab_tooltip")} side="top" align="end">
              <button
                type="button"
                className="group inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-transparent bg-[rgba(10,45,66,0.46)] px-0 text-[var(--ode-text-dim)] transition hover:bg-[rgba(12,54,79,0.62)] hover:text-[var(--ode-text)]"
                onClick={() => {
                  onManageQuickAppsForActiveTab?.();
                }}
                aria-label={t("quick_apps.manage_tab_tooltip")}
              >
                {activeTabQuickApps.length > 0 ? <EditGlyphSmall /> : <PlusGlyphSmall />}
              </button>
            </OdeTooltip>
          </div>
        ) : null}
      </div>
    </div>
  );
}
