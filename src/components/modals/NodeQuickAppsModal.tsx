import { useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  ArrowDownGlyphSmall,
  ArrowUpGlyphSmall,
  ImageGlyphSmall,
  PlusGlyphSmall,
  TrashGlyphSmall,
  UploadGlyphSmall
} from "@/components/Icons";
import { useDraggableModalSurface } from "@/hooks/useDraggableModalSurface";
import { QuickAppIcon } from "@/components/quick-apps/QuickAppIcon";
import type { HtmlAppTemplate } from "@/lib/htmlAppTemplates";
import type { NodeQuickAppItem } from "@/lib/nodeQuickApps";
import type { TranslationParams } from "@/lib/i18n";

type TranslateFn = (key: string, params?: TranslationParams) => string;

interface NodeQuickAppsModalProps {
  t: TranslateFn;
  open: boolean;
  nodeLabel: string;
  hintText?: string;
  items: NodeQuickAppItem[];
  htmlTemplates?: HtmlAppTemplate[];
  saving?: boolean;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onChange: (id: string, patch: Partial<NodeQuickAppItem>) => void;
  onPickLocalPath: (id: string) => void | Promise<void>;
  onOpenHtmlTemplateManager?: () => void;
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
  nodeLabel,
  hintText,
  items,
  htmlTemplates = [],
  saving = false,
  onAdd,
  onRemove,
  onMove,
  onChange,
  onPickLocalPath,
  onOpenHtmlTemplateManager,
  onClose,
  onSave
}: NodeQuickAppsModalProps) {
  const { surfaceRef, surfaceStyle, handlePointerDown } = useDraggableModalSurface({ open });
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);

  if (!open) return null;

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!saving) onClose();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (!saving) void onSave();
    }
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

  return (
    <div
      className="ode-overlay-scrim fixed inset-0 z-[125] flex items-center justify-center p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget || saving) return;
        onClose();
      }}
    >
      <div
        ref={surfaceRef}
        style={surfaceStyle}
        className="ode-modal w-full max-w-4xl overflow-hidden rounded-[22px] border border-[var(--ode-border-strong)]"
        onKeyDown={handleKeyDown}
      >
        <div
          className="ode-modal-drag-handle flex items-center justify-between border-b border-[var(--ode-border)] px-6 py-5"
          onPointerDown={handlePointerDown}
        >
          <div className="min-w-0">
            <h2 className="text-[1.35rem] font-semibold tracking-tight text-[var(--ode-accent)]">
              {t("quick_apps.modal_title")}
            </h2>
            <p className="mt-1 truncate text-[0.9rem] text-[var(--ode-text-dim)]">{nodeLabel}</p>
          </div>
          <button
            type="button"
            className="ode-icon-btn h-10 w-10"
            onClick={onClose}
            disabled={saving}
            aria-label={t("delete.modal_cancel")}
          >
            x
          </button>
        </div>

        <div className="max-h-[68vh] overflow-auto px-6 py-5">
          <div className="mb-4 rounded-[18px] border border-[rgba(88,197,255,0.14)] bg-[rgba(5,27,44,0.38)] px-4 py-3 text-[0.9rem] leading-6 text-[var(--ode-text-dim)]">
            {hintText ?? t("quick_apps.modal_hint")}
          </div>

          <div className="mb-4 flex items-center justify-end gap-3">
            <button type="button" className="ode-text-btn inline-flex h-10 items-center gap-2 px-4" onClick={onAdd}>
              <PlusGlyphSmall />
              <span>{t("quick_apps.add")}</span>
            </button>
          </div>

          {items.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-[var(--ode-border)] bg-[rgba(4,24,40,0.35)] px-5 py-6 text-[0.92rem] text-[var(--ode-text-dim)]">
              {t("quick_apps.modal_empty")}
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="rounded-[18px] border border-[var(--ode-border)] bg-[rgba(5,27,44,0.42)] p-4"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[18px] border border-[rgba(74,156,205,0.24)] bg-[linear-gradient(180deg,rgba(10,43,66,0.82),rgba(4,19,31,0.9))] ${
                        uploadingItemId === item.id ? "opacity-70" : ""
                      }`}
                    >
                      <QuickAppIcon item={item} variant="editor" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_220px_auto]">
                        <input
                          className="ode-input h-11 w-full rounded-lg px-3 text-[0.92rem]"
                          value={item.label}
                          placeholder={t("quick_apps.label_placeholder")}
                          onChange={(event) => onChange(item.id, { label: event.target.value })}
                        />

                        <select
                          className="ode-input h-11 w-full rounded-lg px-3 text-[0.92rem]"
                          value={item.kind}
                          onChange={(event) =>
                            onChange(item.id, {
                              kind:
                                event.target.value === "local_path"
                                  ? "local_path"
                                  : event.target.value === "html_template"
                                    ? "html_template"
                                    : "url",
                              launchMode: event.target.value === "html_template" ? "ode_window" : item.launchMode,
                              target:
                                event.target.value === "html_template" && !item.target
                                  ? htmlTemplates[0]?.id ?? ""
                                  : item.target
                            })
                          }
                        >
                          <option value="url">{t("quick_apps.kind_url")}</option>
                          <option value="local_path">{t("quick_apps.kind_local_path")}</option>
                          <option value="html_template">HTML template</option>
                        </select>

                        <select
                          className="ode-input h-11 w-full rounded-lg px-3 text-[0.92rem]"
                          value={item.kind === "html_template" ? "ode_window" : item.launchMode ?? "system"}
                          onChange={(event) =>
                            onChange(item.id, {
                              launchMode: event.target.value === "ode_window" ? "ode_window" : "system"
                            })
                          }
                          disabled={item.kind === "html_template"}
                        >
                          <option value="system">{t("quick_apps.launch_mode_system")}</option>
                          <option value="ode_window">{t("quick_apps.launch_mode_ode_window")}</option>
                        </select>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="ode-icon-btn inline-flex h-11 w-11 items-center justify-center"
                            onClick={() => onMove(item.id, "up")}
                            aria-label={t("quick_apps.move_up")}
                            title={t("quick_apps.move_up")}
                            disabled={saving || index === 0}
                          >
                            <ArrowUpGlyphSmall />
                          </button>
                          <button
                            type="button"
                            className="ode-icon-btn inline-flex h-11 w-11 items-center justify-center"
                            onClick={() => onMove(item.id, "down")}
                            aria-label={t("quick_apps.move_down")}
                            title={t("quick_apps.move_down")}
                            disabled={saving || index === items.length - 1}
                          >
                            <ArrowDownGlyphSmall />
                          </button>
                          <button
                            type="button"
                            className="ode-icon-btn inline-flex h-11 w-11 items-center justify-center"
                            onClick={() => onRemove(item.id)}
                            aria-label={t("quick_apps.remove")}
                            disabled={saving}
                          >
                            <TrashGlyphSmall />
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                        {item.kind === "html_template" ? (
                          <select
                            className="ode-input h-11 w-full rounded-lg px-3 text-[0.92rem]"
                            value={item.target}
                            onChange={(event) => {
                              const selectedTemplate = htmlTemplates.find((template) => template.id === event.target.value) ?? null;
                              onChange(item.id, {
                                target: event.target.value,
                                launchMode: "ode_window",
                                label: item.label.trim().length > 0 ? item.label : selectedTemplate?.label ?? item.label
                              });
                            }}
                          >
                            <option value="">Choose a shared HTML template</option>
                            {htmlTemplates.map((template) => (
                              <option key={template.id} value={template.id}>
                                {template.label} (v{template.version})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            className="ode-input h-11 w-full rounded-lg px-3 text-[0.92rem]"
                            value={item.target}
                            placeholder={
                              item.kind === "local_path"
                                ? t("quick_apps.target_placeholder_path")
                                : t("quick_apps.target_placeholder_url")
                            }
                            onChange={(event) => onChange(item.id, { target: event.target.value })}
                          />
                        )}

                        {item.kind === "local_path" ? (
                          <button
                            type="button"
                            className="ode-text-btn inline-flex h-11 items-center justify-center px-4"
                            onClick={() => {
                              void onPickLocalPath(item.id);
                            }}
                            disabled={saving}
                          >
                            {t("quick_apps.pick_local_path")}
                          </button>
                        ) : item.kind === "html_template" ? (
                          <button
                            type="button"
                            className="ode-text-btn inline-flex h-11 items-center justify-center px-4"
                            onClick={() => {
                              onOpenHtmlTemplateManager?.();
                            }}
                            disabled={saving}
                          >
                            Manage templates
                          </button>
                        ) : null}
                      </div>

                      {item.kind === "html_template" ? (
                        <div className="text-[0.82rem] text-[var(--ode-text-dim)]">
                          {item.target
                            ? (() => {
                                const selectedTemplate = htmlTemplates.find((template) => template.id === item.target) ?? null;
                                return selectedTemplate
                                  ? `Shared source: ${selectedTemplate.entryPath}`
                                  : "This node app is linked to a missing HTML template.";
                              })()
                            : "Choose one shared HTML template. Every node linked to it will follow future updates."}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-2">
                        <label className="ode-text-btn inline-flex h-9 cursor-pointer items-center gap-2 px-3">
                          <UploadGlyphSmall />
                          <span>{t("quick_apps.upload_icon")}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => {
                              void handleIconFileChange(item.id, event);
                            }}
                          />
                        </label>

                        {item.customIconDataUrl ? (
                          <button
                            type="button"
                            className="ode-text-btn inline-flex h-9 items-center gap-2 px-3"
                            onClick={() => onChange(item.id, { customIconDataUrl: null })}
                          >
                            <ImageGlyphSmall />
                            <span>{t("quick_apps.use_auto_icon")}</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--ode-border)] px-6 py-4">
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
