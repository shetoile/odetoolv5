import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import {
  DataFolderGlyphSmall,
  DatabaseRootGlyph,
  ExportGlyphSmall,
  ImportGlyphSmall,
  SearchGlyphSmall
} from "@/components/Icons";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import { getNodeTooltipLabel } from "@/lib/nodeTooltipCatalog";
import type { TranslationParams } from "@/lib/i18n";
import {
  type ODELibraryKind,
  type ReusableLibraryIndexItem
} from "@/lib/reusableLibraries";
import type { AppNode } from "@/lib/types";

type TranslateFn = (key: string, params?: TranslationParams) => string;

type ReusableLibraryPanelProps = {
  t: TranslateFn;
  currentNode: AppNode | null;
  canCreateIntoCurrentNode: boolean;
  canSaveCurrentAsOrganisationModel: boolean;
  canSaveCurrentAsDatabaseTemplate: boolean;
  organisationModels: ReusableLibraryIndexItem[];
  databaseTemplates: ReusableLibraryIndexItem[];
  onSaveCurrentAsOrganisationModel: () => void;
  onSaveCurrentAsDatabaseTemplate: () => void;
  onCreateFromLibraryItem: (itemId: string, kind: ODELibraryKind) => void | Promise<void>;
  onExportLibraryItem: (itemId: string, kind: ODELibraryKind) => void | Promise<void>;
  onImportLibraryJson: (kind: ODELibraryKind, file: File) => void | Promise<void>;
  selectedItemId: string | null;
  selectedItemIds: Set<string>;
  onSelectItem: (itemId: string, options?: { range?: boolean; toggle?: boolean }) => void;
  onOpenItem: (itemId: string) => void | Promise<void>;
  onOpenItemContextMenu: (event: ReactMouseEvent<HTMLElement>, itemId: string) => void;
};

type LibraryTab = ODELibraryKind;

type LibraryTabDefinition = {
  kind: LibraryTab;
  label: string;
  icon: ReactNode;
};

function renderLibraryActionButton(props: {
  label: string;
  disabled?: boolean;
  onClick?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}) {
  return (
    <OdeTooltip label={props.label} side="bottom">
      <span className="inline-flex">
        <button
          type="button"
          aria-label={props.label}
          className="ode-icon-btn h-10 w-10 text-[rgba(220,244,255,0.92)]"
          disabled={props.disabled}
          onMouseDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            props.onClick?.(event);
          }}
        >
          {props.children}
        </button>
      </span>
    </OdeTooltip>
  );
}

function resolveSearchPlaceholder(kind: LibraryTab, t: TranslateFn): string {
  return kind === "organisation_model" ? t("library.search_models") : t("library.search_templates");
}

function resolveEmptyCopy(kind: LibraryTab, t: TranslateFn): string {
  return kind === "organisation_model" ? t("library.empty_models") : t("library.empty_templates");
}

export function ReusableLibraryPanel({
  t,
  organisationModels,
  databaseTemplates,
  onExportLibraryItem,
  onImportLibraryJson,
  selectedItemId,
  selectedItemIds,
  onSelectItem,
  onOpenItem,
  onOpenItemContextMenu
}: ReusableLibraryPanelProps) {
  const [activeTab, setActiveTab] = useState<LibraryTab>("organisation_model");
  const [searchByTab, setSearchByTab] = useState<Record<LibraryTab, string>>({
    organisation_model: "",
    database_template: ""
  });
  const organisationImportInputRef = useRef<HTMLInputElement | null>(null);
  const databaseImportInputRef = useRef<HTMLInputElement | null>(null);

  const tabDefinitions: LibraryTabDefinition[] = [
    {
      kind: "organisation_model",
      label: t("library.models"),
      icon: <DataFolderGlyphSmall />
    },
    {
      kind: "database_template",
      label: t("library.templates"),
      icon: <DatabaseRootGlyph />
    }
  ];

  const activeItems = activeTab === "organisation_model" ? organisationModels : databaseTemplates;
  const activeSearch = searchByTab[activeTab];
  const normalizedQuery = activeSearch.trim().toLowerCase();
  const filteredItems = useMemo(
    () =>
      normalizedQuery.length > 0
        ? activeItems.filter((item) => item.searchText.includes(normalizedQuery))
        : activeItems,
    [activeItems, normalizedQuery]
  );

  const activeImportInputRef =
    activeTab === "organisation_model" ? organisationImportInputRef : databaseImportInputRef;

  useEffect(() => {
    if (!selectedItemId) return;
    if (organisationModels.some((item) => item.node.id === selectedItemId)) {
      setActiveTab("organisation_model");
      return;
    }
    if (databaseTemplates.some((item) => item.node.id === selectedItemId)) {
      setActiveTab("database_template");
    }
  }, [databaseTemplates, organisationModels, selectedItemId]);

  return (
    <div className="mb-6">
      <input
        ref={organisationImportInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          if (!file) return;
          void onImportLibraryJson("organisation_model", file);
          event.target.value = "";
        }}
      />
      <input
        ref={databaseImportInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          if (!file) return;
          void onImportLibraryJson("database_template", file);
          event.target.value = "";
        }}
      />

      <section className="rounded-[30px] border border-[rgba(88,197,255,0.16)] bg-[linear-gradient(180deg,rgba(7,29,45,0.96),rgba(4,20,33,0.92))] p-4 shadow-[0_24px_64px_rgba(0,0,0,0.22)]">
        <div className="flex flex-wrap items-center gap-2">
          {tabDefinitions.map((tab) => {
            const active = tab.kind === activeTab;
            return (
              <button
                key={tab.kind}
                type="button"
                className={`inline-flex h-11 items-center gap-2 rounded-[16px] border px-4 text-[0.78rem] font-medium uppercase tracking-[0.18em] transition ${
                  active
                    ? "border-[rgba(106,212,255,0.46)] bg-[rgba(16,77,112,0.46)] text-[#eefbff] shadow-[0_0_0_1px_rgba(94,208,255,0.18)]"
                    : "border-[rgba(88,197,255,0.14)] bg-[rgba(5,29,45,0.72)] text-[rgba(188,225,245,0.72)] hover:border-[rgba(106,212,255,0.28)] hover:bg-[rgba(8,41,62,0.86)]"
                }`}
                onClick={() => setActiveTab(tab.kind)}
              >
                <span className="flex h-4 w-4 items-center justify-center">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}

          <div className="ml-auto flex items-center gap-2">
            {renderLibraryActionButton({
              label: t("context.import_package"),
              onClick: () => activeImportInputRef.current?.click(),
              children: <ImportGlyphSmall />
            })}
          </div>
        </div>

        <div className="relative mt-4">
          <input
            type="search"
            value={activeSearch}
            onChange={(event) =>
              setSearchByTab((prev) => ({
                ...prev,
                [activeTab]: event.target.value
              }))
            }
            placeholder={resolveSearchPlaceholder(activeTab, t)}
            className="ode-input h-11 w-full rounded-[16px] pl-11 pr-4"
          />
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(129,203,236,0.72)]">
            <SearchGlyphSmall />
          </span>
        </div>

        <div className="mt-4 min-h-[30rem] rounded-[24px] border border-[rgba(88,197,255,0.12)] bg-[rgba(4,23,38,0.82)] p-2">
          {filteredItems.length > 0 ? (
            <div className="max-h-[38rem] space-y-2 overflow-y-auto pr-1">
              {filteredItems.map((item) => {
                const itemTooltipLabel = getNodeTooltipLabel({
                  title: item.node.name,
                  description: item.node.description
                });
                const selected = selectedItemIds.has(item.node.id);
                const focused = selectedItemId === item.node.id;
                const row = (
                  <div
                    key={item.node.id}
                    role="button"
                    tabIndex={0}
                    aria-selected={selected}
                    className={`flex items-center gap-3 rounded-[18px] border px-3 py-3 transition ${
                      selected
                        ? focused
                          ? "border-[rgba(106,212,255,0.46)] bg-[rgba(16,77,112,0.42)] shadow-[0_0_0_1px_rgba(94,208,255,0.18)]"
                          : "border-[rgba(88,197,255,0.26)] bg-[rgba(10,46,68,0.76)]"
                        : "border-[rgba(88,197,255,0.12)] bg-[rgba(5,29,45,0.72)] hover:border-[rgba(106,212,255,0.28)] hover:bg-[rgba(8,41,62,0.86)]"
                    }`}
                    onMouseDown={(event) => {
                      if (event.button !== 0) return;
                      onSelectItem(item.node.id, {
                        range: event.shiftKey,
                        toggle: event.ctrlKey || event.metaKey
                      });
                    }}
                    onDoubleClick={() => {
                      void onOpenItem(item.node.id);
                    }}
                    onContextMenu={(event) => {
                      onOpenItemContextMenu(event, item.node.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void onOpenItem(item.node.id);
                        return;
                      }
                      if (event.key === " ") {
                        event.preventDefault();
                        onSelectItem(item.node.id, {
                          toggle: true
                        });
                      }
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[0.98rem] font-medium leading-6 text-[#eefbff]">
                        {item.node.name}
                      </div>
                      <div className="mt-1 text-[0.72rem] uppercase tracking-[0.16em] text-[rgba(148,203,232,0.56)]">
                        {item.nodeCount}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {renderLibraryActionButton({
                        label: t("context.export_package"),
                        onClick: () => {
                          void onExportLibraryItem(item.node.id, activeTab);
                        },
                        children: <ExportGlyphSmall />
                      })}
                    </div>
                  </div>
                );

                return itemTooltipLabel ? (
                  <OdeTooltip
                    key={item.node.id}
                    label={itemTooltipLabel}
                    side="bottom"
                    align="start"
                    tooltipClassName="ode-node-tooltip-popup"
                  >
                    {row}
                  </OdeTooltip>
                ) : (
                  row
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-[28rem] items-center justify-center rounded-[18px] border border-dashed border-[rgba(88,197,255,0.14)] px-5 text-center text-[0.92rem] text-[rgba(188,225,245,0.62)]">
              {activeItems.length === 0 ? resolveEmptyCopy(activeTab, t) : t("library.no_matches")}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
