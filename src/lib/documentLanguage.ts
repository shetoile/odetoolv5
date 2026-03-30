import type { LanguageCode } from "@/lib/i18n";

export type DocumentLanguageCode = LanguageCode | "unknown";

const LANGUAGE_STOPWORDS: Record<LanguageCode, string[]> = {
  EN: [
    "the",
    "and",
    "of",
    "to",
    "in",
    "for",
    "with",
    "on",
    "from",
    "this",
    "that",
    "project",
    "plan",
    "scope"
  ],
  FR: [
    "le",
    "la",
    "les",
    "de",
    "des",
    "du",
    "et",
    "pour",
    "dans",
    "avec",
    "sur",
    "une",
    "un",
    "projet"
  ],
  DE: [
    "der",
    "die",
    "das",
    "und",
    "mit",
    "fuer",
    "von",
    "auf",
    "zu",
    "den",
    "dem",
    "ein",
    "eine",
    "projekt"
  ],
  ES: [
    "el",
    "la",
    "los",
    "las",
    "de",
    "del",
    "y",
    "para",
    "con",
    "en",
    "por",
    "una",
    "un",
    "proyecto"
  ]
};

export type DocumentLanguageDetection = {
  language: DocumentLanguageCode;
  confidence: number;
  scores: Record<LanguageCode, number>;
};

function normalizeLanguageSample(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, " ");
}

export function detectDocumentLanguage(text: string): DocumentLanguageDetection {
  const normalized = normalizeLanguageSample(text).slice(0, 12000);
  const tokens = normalized.match(/[a-z]+/g) ?? [];
  const scores: Record<LanguageCode, number> = {
    EN: 0,
    FR: 0,
    DE: 0,
    ES: 0
  };

  if (tokens.length < 12) {
    return {
      language: "unknown",
      confidence: 0,
      scores
    };
  }

  const tokenCounts = new Map<string, number>();
  for (const token of tokens) {
    tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
  }

  for (const language of Object.keys(LANGUAGE_STOPWORDS) as LanguageCode[]) {
    let score = 0;
    for (const stopword of LANGUAGE_STOPWORDS[language]) {
      score += tokenCounts.get(stopword) ?? 0;
    }
    scores[language] = score;
  }

  const ranked = (Object.entries(scores) as Array<[LanguageCode, number]>).sort((left, right) => right[1] - left[1]);
  const [topLanguage, topScore] = ranked[0];
  const secondScore = ranked[1]?.[1] ?? 0;
  const totalScore = ranked.reduce((total, [, score]) => total + score, 0);

  if (topScore < 3 || totalScore < 5) {
    return {
      language: "unknown",
      confidence: 0,
      scores
    };
  }

  if (topScore < secondScore + 2) {
    return {
      language: "unknown",
      confidence: topScore / Math.max(1, totalScore),
      scores
    };
  }

  return {
    language: topLanguage,
    confidence: topScore / Math.max(1, totalScore),
    scores
  };
}
