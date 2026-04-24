import nspell from "nspell";
import enAffUrl from "@/dictionaries/en.aff?url";
import enDicUrl from "@/dictionaries/en.dic?url";
import deAffUrl from "@/dictionaries/de.aff?url";
import deDicUrl from "@/dictionaries/de.dic?url";
import esAffUrl from "@/dictionaries/es.aff?url";
import esDicUrl from "@/dictionaries/es.dic?url";
import frAffUrl from "@/dictionaries/fr.aff?url";
import frDicUrl from "@/dictionaries/fr.dic?url";
import {
  resolveSupportedLanguageCode,
  type LanguageCode,
  type SupportedLanguageCode
} from "@/lib/i18n";

type SpellChecker = {
  correct: (word: string) => boolean;
  suggest: (word: string) => string[];
};

const DICTIONARY_ASSET_URLS: Record<SupportedLanguageCode, { aff: string; dic: string }> = {
  EN: { aff: enAffUrl, dic: enDicUrl },
  DE: { aff: deAffUrl, dic: deDicUrl },
  ES: { aff: esAffUrl, dic: esDicUrl },
  FR: { aff: frAffUrl, dic: frDicUrl },
  // Farsi UI translations are supported; spellcheck currently falls back to English assets.
  FA: { aff: enAffUrl, dic: enDicUrl }
};

const spellCheckerByLanguage = new Map<SupportedLanguageCode, Promise<SpellChecker>>();

async function readDictionaryAsset(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load spellcheck dictionary asset: ${url}`);
  }
  return response.text();
}

async function loadSpellChecker(language: SupportedLanguageCode): Promise<SpellChecker> {
  const urls = DICTIONARY_ASSET_URLS[language] ?? DICTIONARY_ASSET_URLS.EN;
  const [affText, dicText] = await Promise.all([
    readDictionaryAsset(urls.aff),
    readDictionaryAsset(urls.dic)
  ]);
  return nspell(affText, dicText) as SpellChecker;
}

async function getSpellChecker(language: LanguageCode): Promise<SpellChecker> {
  const resolvedLanguage = resolveSupportedLanguageCode(language);
  const cached = spellCheckerByLanguage.get(resolvedLanguage);
  if (cached) return cached;
  const created = loadSpellChecker(resolvedLanguage);
  spellCheckerByLanguage.set(resolvedLanguage, created);
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
