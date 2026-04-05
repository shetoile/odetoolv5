import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import { OdeAiMark } from "@/components/OdeAiMark";
import { useDraggableModalSurface } from "@/hooks/useDraggableModalSurface";
import { AI_KEYS_STORAGE_KEY } from "@/lib/appIdentity";
import { callNative } from "@/lib/tauriApi";
import { translate, type LanguageCode, type TranslationParams } from "@/lib/i18n";

interface AiSettingsModalProps {
  open: boolean;
  onClose: () => void;
  language: LanguageCode;
}

export function AiSettingsModal({
  open,
  onClose,
  language
}: AiSettingsModalProps) {
  const t = (key: string, params?: TranslationParams) => translate(language, key, params);
  const { surfaceRef, surfaceStyle, handlePointerDown } = useDraggableModalSurface({ open });
  const [mistralKeys, setMistralKeys] = useState<string[]>([""]);
  const [message, setMessage] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

  useEffect(() => {
    if (!open) return;
    const raw = localStorage.getItem(AI_KEYS_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        mistralKeys?: string[];
        groqKeys?: string[];
        perplexityKeys?: string[];
      };
      if (parsed.mistralKeys && parsed.mistralKeys.length > 0) {
        setMistralKeys(parsed.mistralKeys);
        return;
      }
      const legacy = [...(parsed.groqKeys ?? []), ...(parsed.perplexityKeys ?? [])].filter(
        (key) => key.trim().length > 0
      );
      if (legacy.length > 0) setMistralKeys([legacy[0]]);
    } catch {
      // Keep defaults if persisted data is malformed.
    }
  }, [open]);

  if (!open) return null;

  const updateList = (next: string[], setList: (next: string[]) => void) =>
    setList(next.length > 0 ? next : [""]);

  const runTest = async () => {
    setMessage("");
    setIsTesting(true);
    await new Promise((resolve) => setTimeout(resolve, 550));
    const mistralConfigured = mistralKeys.some((key) => key.trim().length > 0);
    if (mistralConfigured) {
      setMessage(t("settings.msg_key_check_complete"));
    } else {
      setMessage(t("settings.msg_no_keys"));
    }
    setIsTesting(false);
  };

  const save = (event?: ReactMouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    try {
      localStorage.setItem(
        AI_KEYS_STORAGE_KEY,
        JSON.stringify({
          mistralKeys: mistralKeys.filter((key) => key.trim().length > 0)
        })
      );
      setMessage(t("settings.msg_saved_local"));
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      setMessage(reason);
    }
  };

  const runCleanup = async () => {
    setMessage("");
    setIsCleaning(true);
    try {
      const removed = await callNative<number>("cleanup_orphan_nodes");
      if (removed > 0) {
        setMessage(
          t("settings.msg_cleanup_complete_removed", {
            count: removed,
            suffix: removed === 1 ? "" : "s"
          })
        );
      } else {
        setMessage(t("settings.msg_cleanup_complete_none"));
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      setMessage(t("settings.msg_cleanup_failed", { reason }));
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="ode-overlay-scrim fixed inset-0 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
      <div
        ref={surfaceRef}
        style={surfaceStyle}
        className="ode-modal max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-[26px] border border-[var(--ode-border-strong)]"
      >
        <div
          className="ode-modal-drag-handle flex items-center justify-between border-b border-[var(--ode-border)] px-8 py-7"
          onPointerDown={handlePointerDown}
        >
          <div className="min-w-0">
            <OdeAiMark />
          </div>
          <button type="button" onClick={onClose} className="ode-icon-btn h-11 w-11 text-[1.6rem]">
            x
          </button>
        </div>

        <div className="space-y-8 px-8 py-8">
          <section>
            <p className="mb-3 text-sm uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
              {t("settings.mistral_title")}
            </p>
            <div className="space-y-3">
              {mistralKeys.map((key, idx) => (
                <div key={`mistral-${idx}`} className="flex items-center gap-2">
                  <input
                    type="password"
                    value={key}
                    onChange={(event) => {
                      const next = [...mistralKeys];
                      next[idx] = event.target.value;
                      setMistralKeys(next);
                    }}
                    className="ode-input h-12 w-full rounded-xl px-4"
                    placeholder={t("settings.mistral_placeholder", { index: idx + 1 })}
                  />
                  <button
                    type="button"
                    className="ode-icon-btn h-12 w-12"
                    onClick={() =>
                      updateList(
                        mistralKeys.filter((_, itemIdx) => itemIdx !== idx),
                        setMistralKeys
                      )
                    }
                  >
                    -
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="ode-action-btn h-12 w-full rounded-xl border border-dashed border-[var(--ode-border-accent)] text-[var(--ode-text-dim)]"
                onClick={() => setMistralKeys((prev) => [...prev, ""])}
              >
                {t("settings.add_key")}
              </button>
            </div>
          </section>

          {message ? (
            <p className="rounded-xl border border-[var(--ode-border)] bg-[rgba(7,40,66,0.45)] px-4 py-2.5 text-sm text-[var(--ode-accent)]">
              {message}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between border-t border-[var(--ode-border)] px-8 py-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="ode-secondary-btn h-12 px-6"
              onClick={runTest}
              disabled={isTesting || isCleaning}
            >
              {isTesting ? t("settings.testing") : t("settings.test_keys")}
            </button>
            <button
              type="button"
              className="ode-secondary-btn h-12 px-6"
              onClick={runCleanup}
              disabled={isCleaning || isTesting}
            >
              {isCleaning ? t("settings.cleaning") : t("settings.run_cleanup")}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" className="ode-text-btn h-12 px-5" onClick={onClose}>
              {t("settings.cancel")}
            </button>
            <button
              type="button"
              className="ode-primary-btn h-12 px-9"
              onClick={(event) => save(event)}
            >
              {t("settings.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
