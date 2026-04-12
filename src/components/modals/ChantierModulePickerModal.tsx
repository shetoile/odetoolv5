import { useEffect, useMemo, useState } from "react";
import { DataFolderGlyphSmall, SearchGlyphSmall } from "@/components/Icons";
import { useDraggableModalSurface } from "@/hooks/useDraggableModalSurface";
import { type LanguageCode } from "@/lib/i18n";
import type { ReusableLibraryIndexItem } from "@/lib/reusableLibraries";

type ChantierModulePickerModalProps = {
  open: boolean;
  language: LanguageCode;
  templates: ReusableLibraryIndexItem[];
  onClose: () => void;
  onPick: (itemId: string) => Promise<void> | void;
};

export function ChantierModulePickerModal({
  open,
  language,
  templates,
  onClose,
  onPick
}: ChantierModulePickerModalProps) {
  const copy =
    language === "fr"
      ? {
          title: "Ajouter un module",
          search: "Rechercher un template",
          empty: "Aucun template de base de donnees disponible.",
          noMatches: "Aucun template ne correspond.",
          add: "Utiliser",
          close: "Fermer",
          loading: "Chargement..."
        }
      : {
          title: "Add module",
          search: "Search templates",
          empty: "No database templates are available yet.",
          noMatches: "No template matches this search.",
          add: "Use template",
          close: "Close",
          loading: "Loading..."
        };
  const { surfaceRef, surfaceStyle, handlePointerDown } = useDraggableModalSurface({ open });
  const [search, setSearch] = useState("");
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setBusyItemId(null);
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose, open]);

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();
    if (!normalizedQuery) return templates;
    return templates.filter((item) => item.searchText.includes(normalizedQuery));
  }, [search, templates]);

  if (!open) return null;

  return (
    <div className="ode-overlay-scrim fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-sm">
      <div
        ref={surfaceRef}
        style={surfaceStyle}
        className="ode-modal flex w-full max-w-3xl flex-col overflow-hidden rounded-[24px] border border-[var(--ode-border-strong)]"
      >
        <div
          className="ode-modal-drag-handle flex items-center justify-between border-b border-[var(--ode-border)] px-6 py-5"
          onPointerDown={handlePointerDown}
        >
          <h2 className="text-[1.5rem] font-semibold tracking-tight text-[var(--ode-accent)]">
            {copy.title}
          </h2>
          <button type="button" className="ode-icon-btn h-10 w-10" aria-label={copy.close} onClick={onClose}>
            {"\u00d7"}
          </button>
        </div>
        <div className="px-6 py-5">
          <div className="relative">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={copy.search}
              className="ode-input h-12 w-full rounded-[16px] pl-11 pr-4"
            />
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(129,203,236,0.72)]">
              <SearchGlyphSmall />
            </span>
          </div>

          <div className="mt-4 max-h-[55vh] space-y-2 overflow-y-auto pr-1">
            {filteredTemplates.length > 0 ? (
              filteredTemplates.map((item) => {
                const busy = busyItemId === item.node.id;
                return (
                  <button
                    key={item.node.id}
                    type="button"
                    className="flex w-full items-center gap-4 rounded-[18px] border border-[rgba(88,197,255,0.14)] bg-[rgba(5,29,45,0.72)] px-4 py-4 text-left transition hover:border-[rgba(106,212,255,0.28)] hover:bg-[rgba(8,41,62,0.86)]"
                    disabled={busyItemId !== null}
                    onClick={async () => {
                      setBusyItemId(item.node.id);
                      try {
                        await onPick(item.node.id);
                        onClose();
                      } finally {
                        setBusyItemId(null);
                      }
                    }}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-[rgba(88,197,255,0.14)] bg-[rgba(8,33,50,0.78)] text-[rgba(220,244,255,0.92)]">
                      <DataFolderGlyphSmall />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[1rem] font-medium text-[#eefbff]">{item.node.name}</span>
                      {item.summary ? (
                        <span className="mt-1 block truncate text-[0.84rem] text-[rgba(188,225,245,0.62)]">{item.summary}</span>
                      ) : null}
                    </span>
                    <span className="ode-primary-btn flex h-11 min-w-[8rem] items-center justify-center px-4">
                      {busy ? copy.loading : copy.add}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="rounded-[18px] border border-dashed border-[rgba(88,197,255,0.14)] px-5 py-10 text-center text-[0.95rem] text-[rgba(188,225,245,0.62)]">
                {templates.length === 0 ? copy.empty : copy.noMatches}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
