import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  ArrowDownGlyphSmall,
  ArrowUpGlyphSmall,
  ImageGlyphSmall,
  LinkGlyphSmall,
  PlusGlyphSmall,
  TrashGlyphSmall,
  UploadGlyphSmall
} from "@/components/Icons";
import { QuickAppIcon } from "@/components/quick-apps/QuickAppIcon";
import type { TranslationParams } from "@/lib/i18n";
import type { NodeQuickAppItem, QuickAppScope } from "@/lib/nodeQuickApps";

type TranslateFn = (key: string, params?: TranslationParams) => string;

type QuickAppsStudioSectionProps = {
  t: TranslateFn;
  scope: QuickAppScope;
  title: string;
  ownerLabel: string | null;
  highlighted: boolean;
  items: NodeQuickAppItem[];
  saving: boolean;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onChange: (id: string, patch: Partial<NodeQuickAppItem>) => void;
  onLaunch: (item: NodeQuickAppItem) => void;
};

interface QuickAppsStudioProps {
  t: TranslateFn;
  open: boolean;
  saving?: boolean;
  focusedScope: QuickAppScope;
  generalOwnerLabel: string;
  functionOwnerLabel: string | null;
  tabOwnerLabel: string | null;
  generalItems: NodeQuickAppItem[];
  functionItems: NodeQuickAppItem[];
  tabItems: NodeQuickAppItem[];
  onAdd: (scope: QuickAppScope) => void;
  onRemove: (scope: QuickAppScope, id: string) => void;
  onMove: (scope: QuickAppScope, id: string, direction: "up" | "down") => void;
  onChange: (scope: QuickAppScope, id: string, patch: Partial<NodeQuickAppItem>) => void;
  onLaunch: (scope: QuickAppScope, item: NodeQuickAppItem) => void;
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

function QuickAppsStudioSection({
  t,
  scope,
  title,
  ownerLabel,
  highlighted,
  items,
  saving,
  onAdd,
  onRemove,
  onMove,
  onChange,
  onLaunch
}: QuickAppsStudioSectionProps) {
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);

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
    <section
      className={`rounded-[28px] border px-6 py-6 transition ${
        highlighted
          ? "border-[rgba(88,201,255,0.72)] bg-[linear-gradient(180deg,rgba(8,42,66,0.72),rgba(3,20,34,0.96))] shadow-[0_0_0_1px_rgba(88,201,255,0.16),0_18px_40px_rgba(0,0,0,0.28)]"
          : "border-[var(--ode-border)] bg-[rgba(5,27,44,0.58)]"
      }`}
      data-quick-app-scope={scope}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-[1.28rem] font-semibold text-[var(--ode-accent)]">{title}</h3>
          <p className="mt-1 text-[0.9rem] text-[var(--ode-text-dim)]">
            {ownerLabel || t("quick_apps.scope_owner_missing")}
          </p>
        </div>
        <button type="button" className="ode-text-btn inline-flex h-11 items-center gap-2 px-4" onClick={onAdd}>
          <PlusGlyphSmall />
          <span>{t("quick_apps.add")}</span>
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-[18px] border border-dashed border-[var(--ode-border)] bg-[rgba(4,24,40,0.35)] px-5 py-6 text-[0.94rem] text-[var(--ode-text-dim)]">
          {t("quick_apps.scope_empty")}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="rounded-[22px] border border-[rgba(71,142,186,0.24)] bg-[rgba(4,21,36,0.68)] p-5"
            >
              <div className="flex items-start gap-5">
                <div
                  className={`flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-[22px] border border-[rgba(74,156,205,0.24)] bg-[linear-gradient(180deg,rgba(10,43,66,0.82),rgba(4,19,31,0.9))] ${
                    uploadingItemId === item.id ? "opacity-70" : ""
                  }`}
                >
                  <QuickAppIcon item={item} variant="editor" />
                </div>

                <div className="min-w-0 flex-1 space-y-4">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
                    <input
                      className="ode-input h-12 w-full rounded-xl px-4 text-[1rem]"
                      value={item.label}
                      placeholder={t("quick_apps.label_placeholder")}
                      onChange={(event) => onChange(item.id, { label: event.target.value })}
                    />

                    <select
                      className="ode-input h-12 w-full rounded-xl px-4 text-[1rem]"
                      value={item.kind}
                      onChange={(event) =>
                        onChange(item.id, {
                          kind: event.target.value === "local_path" ? "local_path" : "url"
                        })
                      }
                    >
                      <option value="url">{t("quick_apps.kind_url")}</option>
                      <option value="local_path">{t("quick_apps.kind_local_path")}</option>
                    </select>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="ode-icon-btn inline-flex h-12 w-12 items-center justify-center"
                        onClick={() => onLaunch(item)}
                        aria-label={t("quick_apps.open_item", { name: item.label || title })}
                        title={t("quick_apps.open_item", { name: item.label || title })}
                        disabled={saving || item.target.trim().length === 0}
                      >
                        <LinkGlyphSmall />
                      </button>
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

                  <input
                    className="ode-input h-12 w-full rounded-xl px-4 text-[1rem]"
                    value={item.target}
                    placeholder={
                      item.kind === "local_path"
                        ? t("quick_apps.target_placeholder_path")
                        : t("quick_apps.target_placeholder_url")
                    }
                    onChange={(event) => onChange(item.id, { target: event.target.value })}
                  />

                  <div className="flex flex-wrap items-center gap-3">
                    <label className="ode-text-btn inline-flex h-10 cursor-pointer items-center gap-2 px-4">
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
                        className="ode-text-btn inline-flex h-10 items-center gap-2 px-4"
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
    </section>
  );
}

export function QuickAppsStudio({
  t,
  open,
  saving = false,
  focusedScope,
  generalOwnerLabel,
  functionOwnerLabel,
  tabOwnerLabel,
  generalItems,
  functionItems,
  tabItems,
  onAdd,
  onRemove,
  onMove,
  onChange,
  onLaunch,
  onClose,
  onSave
}: QuickAppsStudioProps) {
  const generalRef = useRef<HTMLDivElement | null>(null);
  const functionRef = useRef<HTMLDivElement | null>(null);
  const tabRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const targetRef =
      focusedScope === "general" ? generalRef : focusedScope === "function" ? functionRef : tabRef;
    window.setTimeout(() => {
      targetRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 0);
  }, [focusedScope, open]);

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

  return (
    <div
      className="ode-overlay-scrim fixed inset-0 z-[150] overflow-hidden backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget || saving) return;
        onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,rgba(1,16,28,0.98),rgba(2,22,36,0.98))]">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--ode-border)] px-8 py-6">
          <div className="min-w-0">
            <h2 className="text-[1.7rem] font-semibold tracking-tight text-[var(--ode-accent)]">
              {t("quick_apps.studio_title")}
            </h2>
            <p className="mt-2 max-w-4xl text-[0.98rem] leading-7 text-[var(--ode-text-dim)]">
              {t("quick_apps.studio_hint")}
            </p>
          </div>
          <button
            type="button"
            className="ode-icon-btn h-11 w-11"
            onClick={onClose}
            disabled={saving}
            aria-label={t("delete.modal_cancel")}
          >
            x
          </button>
        </header>

        <div className="shrink-0 border-b border-[var(--ode-border)] px-8 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[rgba(71,145,185,0.42)] bg-[rgba(4,25,40,0.72)] px-3 py-1 text-[0.76rem] font-medium uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
              {t("quick_apps.scope_priority")}
            </span>
            <span className="text-[0.92rem] text-[var(--ode-text-dim)]">
              {t("quick_apps.scope_priority_value")}
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-8 py-8">
          <div className="mx-auto flex max-w-[1480px] flex-col gap-8">
            <div ref={generalRef}>
              <QuickAppsStudioSection
                t={t}
                scope="general"
                title={t("quick_apps.scope_general")}
                ownerLabel={generalOwnerLabel}
                highlighted={focusedScope === "general"}
                items={generalItems}
                saving={saving}
                onAdd={() => onAdd("general")}
                onRemove={(id) => onRemove("general", id)}
                onMove={(id, direction) => onMove("general", id, direction)}
                onChange={(id, patch) => onChange("general", id, patch)}
                onLaunch={(item) => onLaunch("general", item)}
              />
            </div>

            <div ref={functionRef}>
              <QuickAppsStudioSection
                t={t}
                scope="function"
                title={t("quick_apps.scope_function")}
                ownerLabel={functionOwnerLabel}
                highlighted={focusedScope === "function"}
                items={functionItems}
                saving={saving}
                onAdd={() => onAdd("function")}
                onRemove={(id) => onRemove("function", id)}
                onMove={(id, direction) => onMove("function", id, direction)}
                onChange={(id, patch) => onChange("function", id, patch)}
                onLaunch={(item) => onLaunch("function", item)}
              />
            </div>

            <div ref={tabRef}>
              <QuickAppsStudioSection
                t={t}
                scope="tab"
                title={t("quick_apps.scope_tab")}
                ownerLabel={tabOwnerLabel}
                highlighted={focusedScope === "tab"}
                items={tabItems}
                saving={saving}
                onAdd={() => onAdd("tab")}
                onRemove={(id) => onRemove("tab", id)}
                onMove={(id, direction) => onMove("tab", id, direction)}
                onChange={(id, patch) => onChange("tab", id, patch)}
                onLaunch={(item) => onLaunch("tab", item)}
              />
            </div>
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-[var(--ode-border)] px-8 py-5">
          <button className="ode-text-btn h-11 px-5" onClick={onClose} disabled={saving}>
            {t("delete.modal_cancel")}
          </button>
          <button className="ode-primary-btn h-11 px-6" onClick={() => void onSave()} disabled={saving}>
            {saving ? t("quick_apps.saving") : t("settings.save")}
          </button>
        </footer>
      </div>
    </div>
  );
}
