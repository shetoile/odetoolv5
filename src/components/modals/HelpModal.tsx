import { useEffect, useMemo } from "react";
import { QuestionMarkGlyphSmall } from "@/components/Icons";
import { UtilityModalShell } from "@/components/modals/UtilityModalShell";
import { isTauri } from "@tauri-apps/api/core";
import { HELP_GUIDE_CATEGORIES } from "@/lib/helpGuideContent";
import { getLocalizedHelpGuideCategories } from "@/lib/helpGuideLocalization";
import { translate, type LanguageCode, type TranslationParams } from "@/lib/i18n";

interface HelpModalProps {
  open: boolean;
  language: LanguageCode;
  isUtilityPanelWindow: boolean;
  isWindowMaximized: boolean;
  onWindowMinimize: () => void;
  onWindowToggleMaximize: () => void;
  onClose: () => void;
}

export function HelpModal({
  open,
  language,
  isUtilityPanelWindow,
  isWindowMaximized,
  onWindowMinimize,
  onWindowToggleMaximize,
  onClose
}: HelpModalProps) {
  const t = (key: string, params?: TranslationParams) => translate(language, key, params);
  const showWindowControls = isTauri();
  const helpGuideCategories = useMemo(
    () => getLocalizedHelpGuideCategories(language, HELP_GUIDE_CATEGORIES),
    [language]
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <UtilityModalShell
      t={t}
      title={t("help.modal_title")}
      icon={<QuestionMarkGlyphSmall />}
      isUtilityPanelWindow={isUtilityPanelWindow}
      showWindowControls={showWindowControls}
      isWindowMaximized={isWindowMaximized}
      onWindowMinimize={onWindowMinimize}
      onWindowToggleMaximize={onWindowToggleMaximize}
      onClose={onClose}
      closeOnBackdrop
    >
      <div className="ode-surface-panel min-h-0 flex-1 overflow-auto rounded-xl p-3">
        <div className="grid gap-3 xl:grid-cols-2">
          {helpGuideCategories.map((section) => (
            <section
              key={`help-section-${section.category}`}
              className="rounded-xl border border-[var(--ode-border)] bg-[rgba(5,29,46,0.46)] p-3"
            >
              <h3 className="text-[0.8rem] uppercase tracking-[0.11em] text-[var(--ode-accent)]">
                {section.category}
              </h3>
              <div className="mt-2 space-y-2">
                {section.topics.map((topic) => (
                  <article
                    key={`help-topic-${section.category}-${topic.title}`}
                    className="rounded-lg border border-[rgba(42,116,159,0.35)] bg-[rgba(4,22,36,0.55)] p-3"
                  >
                    <h4 className="text-[1.02rem] font-semibold text-[var(--ode-text)]">
                      {topic.title}
                    </h4>
                    <p className="mt-1 text-[0.9rem] text-[var(--ode-text-muted)]">
                      {topic.summary}
                    </p>
                    <ol className="mt-2 list-decimal pl-5 text-[0.84rem] leading-relaxed text-[var(--ode-text-dim)]">
                      {topic.steps.map((step) => (
                        <li key={`${topic.title}-${step}`} className="py-[1px]">
                          {step}
                        </li>
                      ))}
                    </ol>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </UtilityModalShell>
  );
}
