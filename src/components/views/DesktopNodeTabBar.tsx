import type { TranslationParams } from "@/lib/i18n";

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
  onActivateTab: (nodeId: string) => void;
  onCloseTab: (nodeId: string) => void;
}

export function DesktopNodeTabBar({
  t,
  tabs,
  activeTabId,
  isSidebarCollapsed = false,
  onActivateTab,
  onCloseTab
}: DesktopNodeTabBarProps) {
  if (tabs.length === 0) return null;

  return (
    <div className={`bg-transparent py-1 ${isSidebarCollapsed ? "pl-0 pr-4" : "px-4"}`}>
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
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
    </div>
  );
}
