import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  ArrowDownGlyphSmall,
  ArrowUpGlyphSmall,
  ImageGlyphSmall,
  OpenGlyphSmall,
  PlusGlyphSmall,
  SearchGlyphSmall,
  TrashGlyphSmall,
  UploadGlyphSmall
} from "@/components/Icons";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import { QuickAppIcon } from "@/components/quick-apps/QuickAppIcon";
import {
  resolveQuickAppItemType,
  shouldOpenQuickAppInsideOdeBrowser,
  type NodeQuickAppItem,
  type QuickAppLibraryItem,
  type NodeQuickAppType
} from "@/lib/nodeQuickApps";
import type { TranslationParams } from "@/lib/i18n";

type TranslateFn = (key: string, params?: TranslationParams) => string;

interface NodeQuickAppsModalProps {
  t: TranslateFn;
  open: boolean;
  nodeLabel?: string | null;
  title?: string | null;
  emptyMessage?: string | null;
  libraryItems: QuickAppLibraryItem[];
  items: NodeQuickAppItem[];
  saving?: boolean;
  onAdd: () => void;
  onAddFromLibrary: (libraryItemId: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onChange: (id: string, patch: Partial<NodeQuickAppItem>) => void;
  onBrowseTarget?: (id: string, item: NodeQuickAppItem) => void | Promise<void>;
  onClose: () => void;
  onSave: () => void | Promise<void>;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("file_read_failed"));
    reader.onload = () => {
      if (typeof reader.result === "string" && reader.result.length > 0) {
        resolve(reader.result);
      } else {
        reject(new Error("file_read_failed"));
      }
    };
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image_decode_failed"));
    image.src = dataUrl;
  });
}

async function createQuickAppCustomIconDataUrl(file: File): Promise<string> {
  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImageFromDataUrl(sourceDataUrl);
  const canvas = document.createElement("canvas");
  const size = 72;
  const maxContentSize = 52;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) {
    return sourceDataUrl;
  }

  const drawScale = Math.min(maxContentSize / image.width, maxContentSize / image.height, 1);
  const drawWidth = Math.max(1, Math.round(image.width * drawScale));
  const drawHeight = Math.max(1, Math.round(image.height * drawScale));
  const x = Math.round((size - drawWidth) / 2);
  const y = Math.round((size - drawHeight) / 2);

  context.clearRect(0, 0, size, size);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, x, y, drawWidth, drawHeight);
  return canvas.toDataURL("image/png");
}

export function NodeQuickAppsModal({
  t,
  open,
  nodeLabel = "",
  title = null,
  emptyMessage = null,
  libraryItems,
  items,
  saving = false,
  onAdd,
  onAddFromLibrary,
  onRemove,
  onMove,
  onChange,
  onBrowseTarget,
  onClose,
  onSave
}: NodeQuickAppsModalProps) {
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
  const libraryPickerRef = useRef<HTMLDivElement | null>(null);

  const normalizedLibraryQuery = libraryQuery.trim().toLowerCase();
  const visibleLibraryItems = normalizedLibraryQuery
    ? libraryItems.filter((item) => {
        const haystack = `${item.label} ${item.target} ${item.type ?? ""}`.toLowerCase();
        return haystack.includes(normalizedLibraryQuery);
      })
    : libraryItems;

  useEffect(() => {
    if (open) return;
    setLibraryPickerOpen(false);
    setLibraryQuery("");
  }, [open]);

  useEffect(() => {
    if (!libraryPickerOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!libraryPickerRef.current?.contains(event.target as Node)) {
        setLibraryPickerOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [libraryPickerOpen]);

  if (!open) return null;

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (libraryPickerOpen) {
        setLibraryPickerOpen(false);
        return;
      }
      if (!saving) onClose();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (!saving) void onSave();
    }
  };

  const handleLibraryUse = (libraryItemId: string) => {
    onAddFromLibrary(libraryItemId);
    setLibraryPickerOpen(false);
    setLibraryQuery("");
  };

  const handleIconFileChange = async (itemId: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;

    setUploadingItemId(itemId);
    try {
      const customIconDataUrl = await createQuickAppCustomIconDataUrl(file);
      onChange(itemId, { customIconDataUrl });
    } catch {
      // Ignore upload failures silently; the user can retry with another image.
    } finally {
      setUploadingItemId((current) => (current === itemId ? null : current));
    }
  };

  const handleTypeChange = (itemId: string, item: NodeQuickAppItem, nextType: NodeQuickAppType) => {
    const currentType = resolveQuickAppItemType(item);
    const typeChanged = currentType !== nextType;
    onChange(itemId, {
      type: nextType,
      kind: nextType === "link" ? "url" : "local_path",
      ...(typeChanged
        ? {
            target: "",
            iconKey: "auto" as const,
            customIconDataUrl: null
          }
        : {}),
      openInOdeBrowser: nextType === "html" ? true : nextType === "link" ? Boolean(item.openInOdeBrowser) : false
    });
  };

  return (
    <div className="ode-overlay-scrim fixed inset-0 z-[125] backdrop-blur-sm">
      <div
        className="ode-modal ode-quick-apps-shell flex h-full w-full flex-col overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        <div className="flex shrink-0 items-start justify-between gap-6 px-6 py-6 md:px-10 md:py-8">
          <div className="min-w-0">
            <h2 className="text-[1.55rem] font-semibold tracking-tight text-[var(--ode-accent)]">
              {title || t("quick_apps.modal_title")}
            </h2>
            {nodeLabel ? (
              <p className="mt-2 truncate text-[1rem] text-[var(--ode-text-dim)]">{nodeLabel}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              className="ode-text-btn inline-flex h-11 items-center gap-2 px-4"
              onClick={onAdd}
              disabled={saving}
            >
              <PlusGlyphSmall />
              <span>{t("quick_apps.add")}</span>
            </button>
            <button
              type="button"
              className="ode-icon-btn h-11 w-11"
              onClick={onClose}
              disabled={saving}
              aria-label={t("delete.modal_cancel")}
            >
              x
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-6 pb-6 md:px-10 md:pb-8">
          <div className="space-y-6 pb-3">
            <section className="relative z-20 rounded-[28px] border border-[rgba(76,152,194,0.2)] bg-[rgba(5,27,44,0.34)] px-5 py-5 shadow-[inset_0_1px_0_rgba(121,219,255,0.03)] md:px-6">
              <div ref={libraryPickerRef} className="relative space-y-3">
                <label className="flex h-11 items-center gap-2 rounded-[16px] border border-[rgba(71,145,185,0.22)] bg-[rgba(8,35,54,0.52)] px-4 text-[var(--ode-text-dim)]">
                  <SearchGlyphSmall />
                  <input
                    className="h-full min-w-0 flex-1 bg-transparent text-[0.94rem] text-[var(--ode-text)] outline-none placeholder:text-[var(--ode-text-muted)]"
                    value={libraryQuery}
                    placeholder={t("quick_apps.library_search_placeholder")}
                    onFocus={() => {
                      if (libraryItems.length > 0) {
                        setLibraryPickerOpen(true);
                      }
                    }}
                    onChange={(event) => {
                      setLibraryQuery(event.target.value);
                      if (libraryItems.length > 0) {
                        setLibraryPickerOpen(true);
                      }
                    }}
                  />
                </label>

                <button
                  type="button"
                  className="flex h-11 w-full items-center justify-between rounded-[16px] border border-[rgba(71,145,185,0.22)] bg-[rgba(8,35,54,0.52)] px-4 text-left text-[0.94rem] font-medium text-[var(--ode-text)] transition hover:border-[rgba(96,186,228,0.34)] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setLibraryPickerOpen((current) => !current)}
                  disabled={saving || libraryItems.length === 0}
                  aria-expanded={libraryPickerOpen}
                  aria-haspopup="listbox"
                >
                  <span>{t("quick_apps.library_all_items")}</span>
                  <span className={`transition ${libraryPickerOpen ? "rotate-180" : ""}`}>
                    <ArrowDownGlyphSmall />
                  </span>
                </button>

                {libraryItems.length === 0 ? (
                  <div className="rounded-[20px] border border-dashed border-[rgba(76,152,194,0.24)] bg-[rgba(5,24,39,0.34)] px-5 py-4 text-[0.94rem] text-[var(--ode-text-dim)]">
                    {t("quick_apps.library_empty")}
                  </div>
                ) : null}

                {libraryPickerOpen && libraryItems.length > 0 ? (
                  <div className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-[22px] border border-[rgba(76,152,194,0.24)] bg-[rgba(3,20,33,0.97)] shadow-[0_18px_44px_rgba(0,0,0,0.34)]">
                    {visibleLibraryItems.length === 0 ? (
                      <div className="px-5 py-5 text-[0.94rem] text-[var(--ode-text-dim)]">
                        {t("quick_apps.library_empty_search")}
                      </div>
                    ) : (
                      <div className="max-h-[320px] space-y-2 overflow-auto p-3" role="listbox" aria-label={t("quick_apps.library_all_items")}>
                        {visibleLibraryItems.map((libraryItem) => {
                          const displayLabel =
                            libraryItem.label.trim().length > 0
                              ? libraryItem.label
                              : libraryItem.target.trim().length > 0
                                ? libraryItem.target
                                : t("quick_apps.item_untitled");

                          return (
                            <div
                              key={libraryItem.id}
                              className="flex min-w-0 items-center gap-3 rounded-[18px] border border-[rgba(71,142,186,0.18)] bg-[rgba(6,28,44,0.78)] px-3 py-3"
                              title={libraryItem.target}
                            >
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[linear-gradient(180deg,rgba(10,43,66,0.72),rgba(4,19,31,0.78))]">
                                <QuickAppIcon item={libraryItem} variant="editor" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="block truncate text-[0.94rem] font-medium text-[var(--ode-text)]">
                                  {displayLabel}
                                </span>
                              </div>
                              <button
                                type="button"
                                className="ode-text-btn inline-flex h-9 shrink-0 items-center px-4 text-[0.82rem] font-medium text-[var(--ode-accent)]"
                                onClick={() => handleLibraryUse(libraryItem.id)}
                                disabled={saving}
                              >
                                {t("quick_apps.use_saved")}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </section>

            {items.length === 0 ? (
              <div className="rounded-[30px] bg-[rgba(5,27,44,0.28)] px-6 py-8 text-center text-[1rem] text-[var(--ode-text-dim)] shadow-[inset_0_1px_0_rgba(121,219,255,0.03)]">
                {emptyMessage || t("quick_apps.modal_empty")}
              </div>
            ) : (
              <div className="space-y-4">
              {items.map((item, index) => (
                (() => {
                  const itemType = resolveQuickAppItemType(item);
                  const opensInsideOde = shouldOpenQuickAppInsideOdeBrowser(item);
                  const odeBrowserChecked = itemType === "html" ? true : opensInsideOde;
                  const showOdeBrowserToggle = itemType !== "local_app";
                  const odeBrowserToggleable = itemType === "link";
                  const targetPlaceholder =
                    itemType === "link"
                      ? t("quick_apps.target_placeholder_url")
                      : itemType === "html"
                        ? t("quick_apps.target_placeholder_html")
                        : t("quick_apps.target_placeholder_local_app");

                  return (
                    <div
                      key={item.id}
                      className="rounded-[30px] bg-[linear-gradient(180deg,rgba(5,27,44,0.42),rgba(4,20,33,0.52))] px-5 py-5 shadow-[inset_0_1px_0_rgba(121,219,255,0.03)] md:px-6"
                    >
                      <div className="grid gap-5 xl:grid-cols-[96px_minmax(0,1fr)]">
                    <div
                      className={`flex h-24 w-24 shrink-0 items-center justify-center rounded-[26px] bg-[linear-gradient(180deg,rgba(10,43,66,0.72),rgba(4,19,31,0.78))] shadow-[inset_0_1px_0_rgba(121,219,255,0.04)] ${
                        uploadingItemId === item.id ? "opacity-70" : ""
                      }`}
                    >
                      <QuickAppIcon item={item} variant="editor" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_230px_auto]">
                        <input
                          className="ode-input h-12 w-full rounded-[18px] px-4 text-[0.98rem]"
                          value={item.label}
                          placeholder={t("quick_apps.label_placeholder")}
                          onChange={(event) => onChange(item.id, { label: event.target.value })}
                        />

                        <select
                          className="ode-input h-12 w-full rounded-[18px] px-4 text-[0.98rem]"
                          value={itemType}
                          onChange={(event) => {
                            const nextType =
                              event.target.value === "html"
                                ? "html"
                                : event.target.value === "local_app"
                                  ? "local_app"
                                  : "link";
                            handleTypeChange(item.id, item, nextType);
                          }}
                        >
                          <option value="link">{t("quick_apps.kind_link")}</option>
                          <option value="html">{t("quick_apps.kind_html")}</option>
                          <option value="local_app">{t("quick_apps.kind_local_app")}</option>
                        </select>

                        <div className="flex items-center gap-1.5">
                          {showOdeBrowserToggle ? (
                          <OdeTooltip label="Browser" side="top" align="start">
                            <span className="block">
                              <button
                                type="button"
                                className={`ode-icon-btn inline-flex h-12 w-12 items-center justify-center border transition ${
                                  odeBrowserChecked
                                    ? "border-[rgba(69,201,255,0.7)] bg-[rgba(18,92,131,0.48)] text-[var(--ode-accent)] shadow-[0_0_0_1px_rgba(69,201,255,0.18),0_0_18px_rgba(69,201,255,0.18)]"
                                    : "border-transparent text-[var(--ode-text-dim)]"
                                }`}
                                onClick={() => {
                                  if (!odeBrowserToggleable) {
                                    onChange(item.id, { openInOdeBrowser: true });
                                    return;
                                  }
                                  onChange(item.id, { openInOdeBrowser: !odeBrowserChecked });
                                }}
                                aria-label={t("quick_apps.open_inside_ode_browser")}
                                aria-pressed={odeBrowserChecked}
                                aria-disabled={saving || (!odeBrowserToggleable && itemType !== "html")}
                                disabled={saving}
                              >
                                <img
                                  src="/ode-logo-ui.png"
                                  alt=""
                                  className={`h-7 w-7 object-contain transition ${
                                    odeBrowserChecked
                                      ? "scale-105 opacity-100 drop-shadow-[0_0_10px_rgba(69,201,255,0.55)]"
                                      : "opacity-45 grayscale"
                                  }`}
                                  aria-hidden
                                />
                              </button>
                            </span>
                          </OdeTooltip>
                          ) : null}
                          {item.customIconDataUrl ? (
                            <OdeTooltip label={t("quick_apps.use_auto_icon")} side="top" align="start">
                              <span className="block">
                                <button
                                  type="button"
                                  className="ode-icon-btn inline-flex h-12 w-12 items-center justify-center"
                                  onClick={() => onChange(item.id, { customIconDataUrl: null })}
                                  disabled={saving}
                                  aria-label={t("quick_apps.use_auto_icon")}
                                >
                                  <ImageGlyphSmall />
                                </button>
                              </span>
                            </OdeTooltip>
                          ) : null}
                          <button
                            type="button"
                            className="ode-icon-btn inline-flex h-12 w-12 items-center justify-center"
                            onClick={() => onMove(item.id, "up")}
                            aria-label={t("quick_apps.move_up")}
                            title={t("quick_apps.move_up")}
                            disabled={saving || index === 0}
                          >
                            <ArrowUpGlyphSmall />
                          </button>
                          <button
                            type="button"
                            className="ode-icon-btn inline-flex h-12 w-12 items-center justify-center"
                            onClick={() => onMove(item.id, "down")}
                            aria-label={t("quick_apps.move_down")}
                            title={t("quick_apps.move_down")}
                            disabled={saving || index === items.length - 1}
                          >
                            <ArrowDownGlyphSmall />
                          </button>
                          <button
                            type="button"
                            className="ode-icon-btn inline-flex h-12 w-12 items-center justify-center"
                            onClick={() => onRemove(item.id)}
                            aria-label={t("quick_apps.remove")}
                            disabled={saving}
                          >
                            <TrashGlyphSmall />
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                        <input
                          className="ode-input h-12 w-full rounded-[18px] px-4 text-[0.98rem]"
                          value={item.target}
                          placeholder={targetPlaceholder}
                          onChange={(event) => onChange(item.id, { target: event.target.value })}
                        />
                        <div className="flex items-center gap-1.5">
                          {onBrowseTarget ? (
                            <OdeTooltip label={t("project.browse_btn")} side="top" align="end">
                              <span className="block">
                                <button
                                  type="button"
                                  className="ode-icon-btn inline-flex h-12 w-12 items-center justify-center"
                                  onClick={() => {
                                    void onBrowseTarget(item.id, item);
                                  }}
                                  disabled={saving}
                                  aria-label={t("project.browse_btn")}
                                >
                                  <OpenGlyphSmall />
                                </button>
                              </span>
                            </OdeTooltip>
                          ) : null}
                          <OdeTooltip label={t("quick_apps.upload_icon")} side="top" align="end">
                            <span className="block">
                              <label
                                className={`ode-icon-btn inline-flex h-12 w-12 items-center justify-center ${
                                  saving ? "cursor-not-allowed opacity-45" : "cursor-pointer"
                                }`}
                                aria-label={t("quick_apps.upload_icon")}
                              >
                                <UploadGlyphSmall />
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  disabled={saving}
                                  onChange={(event) => {
                                    void handleIconFileChange(item.id, event);
                                  }}
                                />
                              </label>
                            </span>
                          </OdeTooltip>
                        </div>
                      </div>

                    </div>
                  </div>
                    </div>
                  );
                })()
              ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 px-6 py-5 md:px-10 md:py-6">
          <button className="ode-text-btn h-11 px-5" onClick={onClose} disabled={saving}>
            {t("delete.modal_cancel")}
          </button>
          <button className="ode-primary-btn h-11 px-6" onClick={() => void onSave()} disabled={saving}>
            {saving ? t("quick_apps.saving") : t("settings.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
