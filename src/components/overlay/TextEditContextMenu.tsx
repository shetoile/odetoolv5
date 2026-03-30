import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { TranslationParams } from "@/lib/i18n";

type TranslateFn = (key: string, params?: TranslationParams) => string;

export type TextEditContextMenuState = {
  x: number;
  y: number;
  word: string | null;
  suggestions: string[];
  loading: boolean;
  selectionStart: number;
  selectionEnd: number;
};

interface TextEditContextMenuProps {
  t: TranslateFn;
  menu: TextEditContextMenuState | null;
  canCopy: boolean;
  canCut: boolean;
  onClose: () => void;
  onUseSuggestion: (suggestion: string) => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onSelectAll: () => void;
}

export function TextEditContextMenu({
  t,
  menu,
  canCopy,
  canCut,
  onClose,
  onUseSuggestion,
  onCut,
  onCopy,
  onPaste,
  onSelectAll
}: TextEditContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  const getEnabledButtons = () =>
    Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>("button.ode-context-item:not(:disabled)") ?? []
    );

  const focusButtonAt = (index: number) => {
    const buttons = getEnabledButtons();
    if (buttons.length === 0) return;
    const normalizedIndex = ((index % buttons.length) + buttons.length) % buttons.length;
    buttons[normalizedIndex]?.focus();
  };

  useEffect(() => {
    if (!menu) return;
    const frame = window.requestAnimationFrame(() => {
      focusButtonAt(0);
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [menu]);

  useEffect(() => {
    if (!menu) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".ode-text-edit-menu")) return;
      onClose();
    };
    const onContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".ode-text-edit-menu")) return;
      onClose();
    };
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("contextmenu", onContextMenu, true);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    window.addEventListener("keydown", onWindowKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("contextmenu", onContextMenu, true);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("keydown", onWindowKeyDown);
    };
  }, [menu, onClose]);

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const buttons = getEnabledButtons();
    if (buttons.length === 0) return;
    const activeIndex = buttons.findIndex((button) => button === document.activeElement);
    if (event.key === "ArrowDown" || (event.key === "Tab" && !event.shiftKey)) {
      event.preventDefault();
      focusButtonAt(activeIndex < 0 ? 0 : activeIndex + 1);
      return;
    }
    if (event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey)) {
      event.preventDefault();
      focusButtonAt(activeIndex <= 0 ? buttons.length - 1 : activeIndex - 1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusButtonAt(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      focusButtonAt(buttons.length - 1);
    }
  };

  if (!menu) return null;

  return (
    <div
      ref={menuRef}
      className="ode-context-menu ode-text-edit-menu"
      style={{ left: `${menu.x}px`, top: `${menu.y}px` }}
      role="menu"
      aria-label={t("spell.menu_title")}
      onMouseDown={(event) => event.preventDefault()}
      onKeyDown={handleMenuKeyDown}
    >
      {menu.loading ? (
        <div className="ode-text-edit-menu-label">{t("spell.loading")}</div>
      ) : menu.word ? (
        <>
          <div className="ode-text-edit-menu-label">{t("spell.menu_title")}</div>
          {menu.suggestions.length > 0 ? (
            menu.suggestions.map((suggestion) => (
              <button
                key={`spell-suggestion-${suggestion}`}
                type="button"
                className="ode-context-item"
                onClick={() => onUseSuggestion(suggestion)}
              >
                {suggestion}
              </button>
            ))
          ) : (
            <div className="ode-text-edit-menu-empty">{t("spell.no_suggestions")}</div>
          )}
          <div className="ode-context-separator" />
        </>
      ) : null}

      <button type="button" className="ode-context-item" onClick={onCut} disabled={!canCut}>
        {t("context.cut")}
      </button>
      <button type="button" className="ode-context-item" onClick={onCopy} disabled={!canCopy}>
        {t("context.copy")}
      </button>
      <button type="button" className="ode-context-item" onClick={onPaste}>
        {t("context.paste")}
      </button>
      <button type="button" className="ode-context-item" onClick={onSelectAll}>
        {t("spell.select_all")}
      </button>
    </div>
  );
}
