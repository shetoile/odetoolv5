import { extractFirstJsonObject } from "@/features/ai/commandPlanner";
import { translateWbsResult, type WBSResult } from "@/lib/aiService";
import { type DocumentLanguageCode } from "@/lib/documentLanguage";
import { type LanguageCode, type TranslationParams } from "@/lib/i18n";

export type DocumentTranslationMode = "source" | "auto" | "manual";

export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  EN: "English",
  FR: "French",
  DE: "German",
  ES: "Spanish"
};

export type DocumentAdvisorTranslationSection = {
  id: string;
  title: string;
  goal: string;
  previewLines: string[];
};

export type DocumentAdvisorTranslationAnalysis = {
  nodeId: string;
  summary: string;
  previewLines: string[];
  sections: DocumentAdvisorTranslationSection[];
};

export type DocumentAdvisorTranslatedReview = {
  nodeId: string;
  mode: DocumentTranslationMode;
  requestedLanguage: LanguageCode | null;
  targetLanguage: LanguageCode | null;
  applied: boolean;
  warning?: string;
  summary: string;
  previewLines: string[];
  sections: DocumentAdvisorTranslationSection[];
};

export type DocumentTranslationTranslateFn = (key: string, params?: TranslationParams) => string;

export type DocumentAdvisorTreeProposalWarningShape = {
  warning?: string;
  translationWarning?: string;
  translationTargetLanguage?: LanguageCode | null;
};

export function resolveDocumentTranslationTarget(
  mode: DocumentTranslationMode,
  sourceLanguage: DocumentLanguageCode,
  appLanguage: LanguageCode,
  manualTargetLanguage: LanguageCode
): LanguageCode | null {
  if (mode === "source") return null;
  if (mode === "auto") {
    if (sourceLanguage === "unknown" || sourceLanguage === appLanguage) return null;
    return appLanguage;
  }
  if (sourceLanguage !== "unknown" && sourceLanguage === manualTargetLanguage) {
    return null;
  }
  return manualTargetLanguage;
}

export function resolveDocumentTreeOutputLanguage(
  mode: DocumentTranslationMode,
  sourceLanguage: DocumentLanguageCode,
  appLanguage: LanguageCode,
  manualTargetLanguage: LanguageCode
): LanguageCode {
  const translatedTarget = resolveDocumentTranslationTarget(
    mode,
    sourceLanguage,
    appLanguage,
    manualTargetLanguage
  );
  if (translatedTarget) return translatedTarget;
  if (sourceLanguage === "FR" || sourceLanguage === "EN" || sourceLanguage === "DE" || sourceLanguage === "ES") {
    return sourceLanguage;
  }
  return appLanguage;
}

type DocumentAdvisorTranslationNormalization = {
  summary: string;
  previewLines: string[];
  sections: DocumentAdvisorTranslationSection[];
};

export function buildDocumentAdvisorTranslatedReviewFallback(
  analysis: DocumentAdvisorTranslationAnalysis,
  options: {
    mode: DocumentTranslationMode;
    requestedLanguage: LanguageCode | null;
    targetLanguage: LanguageCode | null;
    warning: string;
  }
): DocumentAdvisorTranslatedReview {
  return {
    nodeId: analysis.nodeId,
    mode: options.mode,
    requestedLanguage: options.requestedLanguage,
    targetLanguage: options.targetLanguage,
    applied: false,
    warning: options.warning,
    summary: analysis.summary,
    previewLines: analysis.previewLines,
    sections: analysis.sections.map((section) => ({
      id: section.id,
      title: section.title,
      goal: section.goal,
      previewLines: section.previewLines
    }))
  };
}

export function normalizeDocumentAdvisorTranslationPayload(
  parsed: unknown,
  analysis: DocumentAdvisorTranslationAnalysis
): DocumentAdvisorTranslationNormalization | null {
  if (!parsed || typeof parsed !== "object") return null;
  const payload = parsed as {
    summary?: unknown;
    preview_lines?: unknown;
    sections?: unknown;
  };
  const previewLines =
    Array.isArray(payload.preview_lines) && payload.preview_lines.every((item) => typeof item === "string")
      ? payload.preview_lines.map((item) => item.trim()).filter((item) => item.length > 0)
      : [];
  const sectionRows = Array.isArray(payload.sections) ? payload.sections : null;
  if (!sectionRows) return null;

  const translatedById = new Map<
    string,
    {
      title: string;
      goal: string;
      previewLines: string[];
    }
  >();

  for (const row of sectionRows) {
    if (!row || typeof row !== "object") return null;
    const section = row as {
      id?: unknown;
      title?: unknown;
      goal?: unknown;
      preview_lines?: unknown;
    };
    if (typeof section.id !== "string" || section.id.trim().length === 0) return null;
    if (typeof section.title !== "string" || typeof section.goal !== "string") return null;
    const translatedPreviewLines =
      Array.isArray(section.preview_lines) && section.preview_lines.every((item) => typeof item === "string")
        ? section.preview_lines.map((item) => item.trim()).filter((item) => item.length > 0)
        : [];
    translatedById.set(section.id, {
      title: section.title.trim() || analysis.sections.find((item) => item.id === section.id)?.title || "",
      goal: section.goal.trim() || analysis.sections.find((item) => item.id === section.id)?.goal || "",
      previewLines: translatedPreviewLines
    });
  }

  const sections = analysis.sections.map((section) => {
    const translated = translatedById.get(section.id);
    if (!translated) {
      return null;
    }
    return {
      id: section.id,
      title: translated.title || section.title,
      goal: translated.goal || section.goal,
      previewLines: translated.previewLines.length > 0 ? translated.previewLines : section.previewLines
    };
  });

  if (sections.some((section) => section === null)) {
    return null;
  }

  return {
    summary: typeof payload.summary === "string" && payload.summary.trim().length > 0 ? payload.summary.trim() : analysis.summary,
    previewLines: previewLines.length > 0 ? previewLines : analysis.previewLines,
    sections: sections.filter((section): section is DocumentAdvisorTranslationSection => section !== null)
  };
}

export function parseDocumentAdvisorTranslatedReview(
  raw: string,
  analysis: DocumentAdvisorTranslationAnalysis,
  options: {
    mode: DocumentTranslationMode;
    requestedLanguage: LanguageCode | null;
    targetLanguage: LanguageCode | null;
  }
): DocumentAdvisorTranslatedReview {
  const jsonPayload = extractFirstJsonObject(raw);
  if (!jsonPayload) {
    return buildDocumentAdvisorTranslatedReviewFallback(analysis, {
      ...options,
      warning: "json_not_found"
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonPayload);
  } catch {
    return buildDocumentAdvisorTranslatedReviewFallback(analysis, {
      ...options,
      warning: "json_invalid"
    });
  }

  const normalized = normalizeDocumentAdvisorTranslationPayload(parsed, analysis);
  if (!normalized) {
    return buildDocumentAdvisorTranslatedReviewFallback(analysis, {
      ...options,
      warning: "schema_invalid"
    });
  }

  return {
    nodeId: analysis.nodeId,
    mode: options.mode,
    requestedLanguage: options.requestedLanguage,
    targetLanguage: options.targetLanguage,
    applied: true,
    summary: normalized.summary,
    previewLines: normalized.previewLines,
    sections: normalized.sections
  };
}

export async function maybeTranslateDocumentTreeResult(
  result: WBSResult,
  options: {
    mode: DocumentTranslationMode;
    sourceLanguage: DocumentLanguageCode;
    appLanguage: LanguageCode;
    manualTargetLanguage: LanguageCode;
    apiKey?: string;
  }
): Promise<{
  result: WBSResult;
  targetLanguage: LanguageCode | null;
  applied: boolean;
  warning?: string;
}> {
  const targetLanguage = resolveDocumentTranslationTarget(
    options.mode,
    options.sourceLanguage,
    options.appLanguage,
    options.manualTargetLanguage
  );
  if (!targetLanguage) {
    return {
      result,
      targetLanguage: null,
      applied: false
    };
  }

  const translated = await translateWbsResult({
    result,
    targetLanguage,
    sourceLanguage: options.sourceLanguage === "unknown" ? undefined : options.sourceLanguage,
    apiKey: options.apiKey,
    aiEngine: "cloud"
  });

  return {
    result: translated.result,
    targetLanguage,
    applied: translated.source === "llm",
    warning: translated.warning
  };
}

export function getDocumentAdvisorTranslationWarningMessage(
  t: DocumentTranslationTranslateFn,
  language: LanguageCode,
  translationWarning?: string,
  targetLanguage?: LanguageCode | null
): string | null {
  if (translationWarning) {
    const resolvedTargetLanguage = targetLanguage ?? language;
    if (translationWarning === "missing_api_key") {
      return t("document_ai.translation_warning_missing_key", { language: resolvedTargetLanguage });
    }
    return t("document_ai.translation_warning_failed", { language: resolvedTargetLanguage });
  }
  return null;
}

export function getDocumentAdvisorTreeProposalWarningMessage(
  t: DocumentTranslationTranslateFn,
  language: LanguageCode,
  proposal?: DocumentAdvisorTreeProposalWarningShape | null
): string | null {
  const translationWarning = getDocumentAdvisorTranslationWarningMessage(
    t,
    language,
    proposal?.translationWarning,
    proposal?.translationTargetLanguage ?? language
  );
  if (translationWarning) {
    return translationWarning;
  }
  const warning = proposal?.warning;
  if (!warning) return null;
  if (warning === "missing_api_key") {
    return t("document_ai.tree_proposal_warning_missing_key");
  }
  if (warning === "document_outline_extracted" || warning === "document_structure_extracted") {
    return null;
  }
  return t("document_ai.tree_proposal_warning_fallback");
}
