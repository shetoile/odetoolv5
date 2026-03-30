import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject
} from "react";
import { SearchGlyph } from "@/components/Icons";
import type { TranslationParams } from "@/lib/i18n";
import type { AppNode, ScheduleStatus } from "@/lib/types";

type TranslateFn = (key: string, params?: TranslationParams) => string;
type SearchResultItem = {
  id: string;
  node: AppNode;
  pathLabel: string;
};

interface TimelineHeaderBarProps {
  t: TranslateFn;
  timelineYear: number;
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  searchDropdownOpen: boolean;
  searchResults: SearchResultItem[];
  searchActiveIndex: number;
  statusOrder: ScheduleStatus[];
  activeStatusFilters: Set<ScheduleStatus>;
  onSearchDropdownOpenChange: (open: boolean) => void;
  onSearchActiveIndexChange: (index: number) => void;
  onSelectFromSearch: (id: string) => void;
  onRunSearch: () => void;
  onSearchQueryChange: (value: string) => void;
  onPreviousYear: () => void;
  onNextYear: () => void;
  onToggleStatusFilter: (status: ScheduleStatus) => void;
  getTimelineStatusClass: (status: ScheduleStatus) => string;
}

export function TimelineHeaderBar({
  t,
  timelineYear,
  searchInputRef,
  searchQuery,
  searchDropdownOpen,
  searchResults,
  searchActiveIndex,
  statusOrder,
  activeStatusFilters,
  onSearchDropdownOpenChange,
  onSearchActiveIndexChange,
  onSelectFromSearch,
  onRunSearch,
  onSearchQueryChange,
  onPreviousYear,
  onNextYear,
  onToggleStatusFilter,
  getTimelineStatusClass
}: TimelineHeaderBarProps) {
  const searchShellRef = useRef<HTMLDivElement | null>(null);

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onSearchDropdownOpenChange(false);
      return;
    }

    if (event.key === "ArrowDown" && searchResults.length > 0) {
      event.preventDefault();
      onSearchDropdownOpenChange(true);
      onSearchActiveIndexChange(Math.min(searchActiveIndex + 1, searchResults.length - 1));
      return;
    }

    if (event.key === "ArrowUp" && searchResults.length > 0) {
      event.preventDefault();
      onSearchActiveIndexChange(Math.max(searchActiveIndex - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (searchDropdownOpen && searchResults[searchActiveIndex]) {
        onSelectFromSearch(searchResults[searchActiveIndex].node.id);
      } else {
        onRunSearch();
        onSearchDropdownOpenChange(true);
      }
    }
  };

  useEffect(() => {
    if (!searchDropdownOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      if (searchShellRef.current?.contains(event.target)) return;
      onSearchDropdownOpenChange(false);
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [searchDropdownOpen, onSearchDropdownOpenChange]);

  return (
    <div className="relative z-[40] shrink-0 border-b border-[var(--ode-border)] px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <button
            className="ode-mini-btn h-8 w-8"
            onClick={onPreviousYear}
          >
            {"<"}
          </button>
          <span className="w-14 text-center text-[1.1rem]">{timelineYear}</span>
          <button
            className="ode-mini-btn h-8 w-8"
            onClick={onNextYear}
          >
            {">"}
          </button>
        </div>
        <div
          ref={searchShellRef}
          className={`relative min-w-[280px] flex-1 max-w-[440px] ${searchDropdownOpen ? "z-[70]" : "z-[1]"}`}
        >
          <div className="flex items-center gap-2 rounded-xl border border-[var(--ode-border-strong)] bg-[rgba(5,25,42,0.82)] px-3 py-2">
            <span className="text-[0.95rem] text-[var(--ode-text-muted)]">
              <SearchGlyph />
            </span>
            <input
              ref={searchInputRef}
              value={searchQuery}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-gramm="false"
              onFocus={() => {
                if (searchQuery.trim().length > 0) onSearchDropdownOpenChange(true);
              }}
              onChange={(event) => {
                onSearchQueryChange(event.target.value);
                if (!event.target.value.trim()) {
                  onSearchDropdownOpenChange(false);
                  onSearchActiveIndexChange(0);
                }
              }}
              onKeyDown={handleSearchKeyDown}
              className="ode-search-input"
              placeholder={t("search.placeholder")}
            />
          </div>

          {searchDropdownOpen && searchQuery.trim().length > 0 ? (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[90] max-h-72 overflow-auto rounded-xl border border-[var(--ode-border-strong)] bg-[rgba(5,25,42,0.97)] p-1 shadow-[0_14px_28px_rgba(0,0,0,0.42)]">
              {searchResults.length > 0 ? (
                searchResults.map((result, idx) => (
                  <button
                    key={`timeline-search-${result.node.id}`}
                    className={`flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-left ${
                      idx === searchActiveIndex
                        ? "bg-[rgba(26,121,182,0.35)] text-white"
                        : "text-[var(--ode-text-dim)] hover:bg-[rgba(15,75,117,0.28)]"
                    }`}
                    onMouseEnter={() => onSearchActiveIndexChange(idx)}
                    onClick={() => onSelectFromSearch(result.node.id)}
                  >
                    <span className="block whitespace-normal break-words text-[0.94rem] leading-[1.2]">
                      {result.node.name}
                    </span>
                    {result.pathLabel && result.pathLabel !== result.node.name ? (
                      <span className="block whitespace-normal break-words text-[0.76rem] leading-5 text-[var(--ode-text-muted)]">
                        {result.pathLabel}
                      </span>
                    ) : null}
                  </button>
                ))
              ) : (
                <div className="px-3 py-3 text-[0.84rem] text-[var(--ode-text-dim)]">
                  {t("search.no_matching_nodes")}
                </div>
              )}
            </div>
          ) : null}
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {statusOrder.map((status) => (
              <button
                type="button"
                key={`timeline-status-legend-${status}`}
                className={`ode-timeline-status-chip ${
                  activeStatusFilters.has(status)
                    ? "ode-timeline-status-chip-active"
                    : "ode-timeline-status-chip-inactive"
                }`}
                onClick={() => onToggleStatusFilter(status)}
                aria-pressed={activeStatusFilters.has(status)}
              >
                <span className={`ode-timeline-legend-dot ${getTimelineStatusClass(status)}`} />
                <span>{t(`timeline.status.${status}`)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
