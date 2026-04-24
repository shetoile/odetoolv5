import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import { OdeAiMark } from "@/components/OdeAiMark";
import { useDraggableModalSurface } from "@/hooks/useDraggableModalSurface";
import { callNative } from "@/lib/tauriApi";
import { translate, type LanguageCode, type TranslationParams } from "@/lib/i18n";
import {
  createEmptyStoredAiProviderKey,
  detectAndNormalizeAiProviderKeys,
  ensureAiProviderKeyDrafts,
  readStoredAiProviderKeys,
  writeStoredAiProviderKeys,
  type StoredAiProviderKey
} from "@/lib/aiProviderKeys";

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
  const [providerKeys, setProviderKeys] = useState<StoredAiProviderKey[]>([createEmptyStoredAiProviderKey()]);
  const [message, setMessage] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProviderKeys(ensureAiProviderKeyDrafts(readStoredAiProviderKeys()));
    setMessage("");
  }, [open]);

  if (!open) return null;

  const updateList = (next: StoredAiProviderKey[]) => {
    setProviderKeys(ensureAiProviderKeyDrafts(next));
  };

  const updateProviderKey = (index: number, apiKey: string) => {
    setProviderKeys((current) =>
      ensureAiProviderKeyDrafts(
        current.map((entry, entryIndex) =>
          entryIndex === index
            ? {
                providerId: "unknown",
                providerLabel: apiKey.trim().length > 0 ? "Auto-detect" : "Auto-detect",
                apiKey
              }
            : entry
        )
      )
    );
    setMessage("");
  };

  const formatDetectedProviderMessage = (entries: StoredAiProviderKey[]): string => {
    const known = entries.filter((entry) => entry.providerId !== "unknown");
    if (known.length === 0) {
      return t("settings.msg_no_keys");
    }
    const labels = Array.from(new Set(known.map((entry) => entry.providerLabel)));
    const unknownCount = entries.filter((entry) => entry.providerId === "unknown").length;
    return unknownCount > 0
      ? `Detected ${known.length} key(s): ${labels.join(", ")}. ${unknownCount} key(s) could not be identified.`
      : `Detected ${known.length} key(s): ${labels.join(", ")}.`;
  };

  const runTest = async () => {
    setMessage("");
    setIsTesting(true);
    try {
      const detected = await detectAndNormalizeAiProviderKeys(providerKeys);
      if (detected.length === 0) {
        setProviderKeys([createEmptyStoredAiProviderKey()]);
        setMessage(t("settings.msg_no_keys"));
      } else {
        updateList(detected);
        setMessage(formatDetectedProviderMessage(detected));
      }
    } catch {
      setMessage(t("settings.msg_no_keys"));
    } finally {
      setIsTesting(false);
    }
  };

  const save = async (event?: ReactMouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    setIsSaving(true);
    try {
      const detected = await detectAndNormalizeAiProviderKeys(providerKeys);
      writeStoredAiProviderKeys(detected);
      setProviderKeys(ensureAiProviderKeyDrafts(detected));
      setMessage(t("settings.msg_saved_local"));
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      setMessage(reason);
    } finally {
      setIsSaving(false);
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
              {t("settings.ai_provider_keys_title")}
            </p>
            <div className="space-y-3">
              {providerKeys.map((entry, idx) => (
                <div key={`provider-key-${idx}`} className="flex items-center gap-2">
                  <span className="min-w-[9rem] rounded-xl border border-[var(--ode-border)] bg-[rgba(7,36,57,0.32)] px-3 py-3 text-center text-[0.8rem] font-medium text-[var(--ode-text-dim)]">
                    {entry.providerLabel}
                  </span>
                  <input
                    type="password"
                    value={entry.apiKey}
                    onChange={(event) => updateProviderKey(idx, event.target.value)}
                    className="ode-input h-12 w-full rounded-xl px-4"
                    placeholder={t("settings.ai_provider_placeholder", { index: idx + 1 })}
                  />
                  <button
                    type="button"
                    className="ode-icon-btn h-12 w-12"
                    onClick={() => updateList(providerKeys.filter((_, itemIdx) => itemIdx !== idx))}
                  >
                    -
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="ode-action-btn h-12 w-full rounded-xl border border-dashed border-[var(--ode-border-accent)] text-[var(--ode-text-dim)]"
                onClick={() => updateList([...providerKeys, createEmptyStoredAiProviderKey()])}
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
              disabled={isTesting || isCleaning || isSaving}
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
              disabled={isSaving || isTesting || isCleaning}
            >
              {isSaving ? t("settings.saving_keys") : t("settings.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
