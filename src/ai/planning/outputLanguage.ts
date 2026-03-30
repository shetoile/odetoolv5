import type { LanguageCode } from "@/lib/i18n";

export const AI_OUTPUT_LANGUAGE_LABELS: Record<LanguageCode, string> = {
  EN: "English",
  FR: "French",
  DE: "German",
  ES: "Spanish"
};

export const AI_SPEECH_LOCALES: Record<LanguageCode, string> = {
  EN: "en-US",
  FR: "fr-FR",
  DE: "de-DE",
  ES: "es-ES"
};

export function getAiOutputLanguageLabel(language: LanguageCode): string {
  return AI_OUTPUT_LANGUAGE_LABELS[language];
}

export function buildAiOutputLanguageInstruction(language: LanguageCode): string {
  const label = getAiOutputLanguageLabel(language);
  return [
    `Return all user-facing content in ${label}.`,
    `You may read source evidence in any language, but write generated titles, summaries, descriptions, deliverables, tasks, and roles in ${label}.`,
    "Preserve acronyms, stable codes, legal names, formal product names, and official document titles when necessary.",
    "If a translated business term is clearer, keep the original acronym in parentheses when helpful."
  ].join(" ");
}
