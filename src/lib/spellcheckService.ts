import nspell from "nspell";
import type { LanguageCode } from "@/lib/i18n";

type SpellChecker = {
  correct: (word: string) => boolean;
  suggest: (word: string) => string[];
};

const spellCheckerByLanguage = new Map<LanguageCode, Promise<SpellChecker>>();

async function loadSpellChecker(language: LanguageCode): Promise<SpellChecker> {
  const dictionaryPromise = (() => {
    if (language === "FR") {
      return Promise.all([
        import("@/dictionaries/fr.aff?raw"),
        import("@/dictionaries/fr.dic?raw")
      ]);
    }
    if (language === "DE") {
      return Promise.all([
        import("@/dictionaries/de.aff?raw"),
        import("@/dictionaries/de.dic?raw")
      ]);
    }
    if (language === "ES") {
      return Promise.all([
        import("@/dictionaries/es.aff?raw"),
        import("@/dictionaries/es.dic?raw")
      ]);
    }
    return Promise.all([
      import("@/dictionaries/en.aff?raw"),
      import("@/dictionaries/en.dic?raw")
    ]);
  })();

  const [affModule, dicModule] = await dictionaryPromise;
  return nspell(affModule.default, dicModule.default) as SpellChecker;
}

async function getSpellChecker(language: LanguageCode): Promise<SpellChecker> {
  const cached = spellCheckerByLanguage.get(language);
  if (cached) return cached;
  const created = loadSpellChecker(language);
  spellCheckerByLanguage.set(language, created);
  return created;
}

function normalizeWord(word: string): string {
  return word.trim().replace(/^[^\p{L}\p{M}]+|[^\p{L}\p{M}]+$/gu, "");
}

function matchSuggestionCasing(suggestion: string, original: string): string {
  if (!suggestion) return suggestion;
  if (original === original.toUpperCase()) return suggestion.toUpperCase();
  const originalFirst = original.charAt(0);
  const isTitleCase =
    originalFirst === originalFirst.toUpperCase() && original.slice(1) === original.slice(1).toLowerCase();
  if (!isTitleCase) return suggestion;
  return suggestion.charAt(0).toUpperCase() + suggestion.slice(1);
}

export async function getSpellSuggestions(word: string, language: LanguageCode): Promise<string[]> {
  const normalized = normalizeWord(word);
  if (normalized.length < 2 || !/\p{L}/u.test(normalized)) return [];

  try {
    const spellChecker = await getSpellChecker(language);
    if (spellChecker.correct(normalized)) return [];
    const dedupe = new Set<string>();
    const suggestions: string[] = [];
    for (const suggestion of spellChecker.suggest(normalized)) {
      const cased = matchSuggestionCasing(suggestion, normalized);
      const key = cased.toLowerCase();
      if (dedupe.has(key)) continue;
      dedupe.add(key);
      suggestions.push(cased);
      if (suggestions.length >= 6) break;
    }
    return suggestions;
  } catch {
    return [];
  }
}
