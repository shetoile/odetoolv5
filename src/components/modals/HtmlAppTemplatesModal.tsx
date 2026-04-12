import { PlusGlyphSmall, TrashGlyphSmall, UploadGlyphSmall } from "@/components/Icons";
import { useDraggableModalSurface } from "@/hooks/useDraggableModalSurface";
import type { HtmlAppTemplate } from "@/lib/htmlAppTemplates";

interface HtmlAppTemplatesModalProps {
  open: boolean;
  templates: HtmlAppTemplate[];
  saving?: boolean;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onChange: (id: string, patch: Partial<HtmlAppTemplate>) => void;
  onPickEntryPath: (id: string) => void | Promise<void>;
  onClose: () => void;
  onSave: () => void | Promise<void>;
}

function formatUpdatedAt(value: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(value);
  } catch {
    return "";
  }
}

export function HtmlAppTemplatesModal({
  open,
  templates,
  saving = false,
  onAdd,
  onRemove,
  onChange,
  onPickEntryPath,
  onClose,
  onSave
}: HtmlAppTemplatesModalProps) {
  const { surfaceRef, surfaceStyle, handlePointerDown } = useDraggableModalSurface({ open });

  if (!open) return null;

  return (
    <div
      className="ode-overlay-scrim fixed inset-0 z-[126] flex items-center justify-center p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget || saving) return;
        onClose();
      }}
    >
      <div
        ref={surfaceRef}
        style={surfaceStyle}
        className="ode-modal w-full max-w-4xl overflow-hidden rounded-[22px] border border-[var(--ode-border-strong)]"
      >
        <div
          className="ode-modal-drag-handle flex items-center justify-between border-b border-[var(--ode-border)] px-6 py-5"
          onPointerDown={handlePointerDown}
        >
          <div className="min-w-0">
            <h2 className="text-[1.35rem] font-semibold tracking-tight text-[var(--ode-accent)]">
              HTML App Templates
            </h2>
            <p className="mt-1 text-[0.9rem] text-[var(--ode-text-dim)]">
              Register one shared HTML file here, then attach it to many nodes.
            </p>
          </div>
          <button
            type="button"
            className="ode-icon-btn h-10 w-10"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            x
          </button>
        </div>

        <div className="max-h-[68vh] overflow-auto px-6 py-5">
          <div className="mb-4 rounded-[18px] border border-[rgba(88,197,255,0.14)] bg-[rgba(5,27,44,0.38)] px-4 py-3 text-[0.9rem] leading-6 text-[var(--ode-text-dim)]">
            Upload or replace the shared HTML source once. Nodes linked to the template will open the updated version
            while keeping separate per-node data.
          </div>

          <div className="mb-4 flex items-center justify-end gap-3">
            <button type="button" className="ode-text-btn inline-flex h-10 items-center gap-2 px-4" onClick={onAdd}>
              <PlusGlyphSmall />
              <span>Add template</span>
            </button>
          </div>

          {templates.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-[var(--ode-border)] bg-[rgba(4,24,40,0.35)] px-5 py-6 text-[0.92rem] text-[var(--ode-text-dim)]">
              No HTML templates yet. Add one shared `index.html` and reuse it across nodes.
            </div>
          ) : (
            <div className="space-y-4">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="rounded-[18px] border border-[var(--ode-border)] bg-[rgba(5,27,44,0.42)] p-4"
                >
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                    <input
                      className="ode-input h-11 w-full rounded-lg px-3 text-[0.92rem]"
                      value={template.label}
                      placeholder="Template name"
                      onChange={(event) => onChange(template.id, { label: event.target.value })}
                    />
                    <div className="flex items-center gap-2 text-[0.82rem] text-[var(--ode-text-dim)]">
                      <span>v{template.version}</span>
                      <span>{formatUpdatedAt(template.updatedAt)}</span>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <input
                      className="ode-input h-11 w-full rounded-lg px-3 text-[0.92rem]"
                      value={template.entryPath}
                      placeholder="Choose a shared index.html file"
                      onChange={(event) => onChange(template.id, { entryPath: event.target.value })}
                    />
                    <button
                      type="button"
                      className="ode-text-btn inline-flex h-11 items-center justify-center gap-2 px-4"
                      onClick={() => {
                        void onPickEntryPath(template.id);
                      }}
                      disabled={saving}
                    >
                      <UploadGlyphSmall />
                      <span>Choose HTML</span>
                    </button>
                    <button
                      type="button"
                      className="ode-icon-btn inline-flex h-11 w-11 items-center justify-center text-[rgba(255,138,138,0.9)]"
                      onClick={() => onRemove(template.id)}
                      disabled={saving}
                      aria-label="Delete template"
                      title="Delete template"
                    >
                      <TrashGlyphSmall />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--ode-border)] px-6 py-4">
          <button className="ode-text-btn h-11 px-5" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="ode-primary-btn h-11 px-6" onClick={() => void onSave()} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

