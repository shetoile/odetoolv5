import { type AiTelemetryDocumentAdvisorContext } from "@/lib/aiTelemetry";
import { type TranslationParams } from "@/lib/i18n";

export type DocumentAdvisorKind =
  | "numbered_outline"
  | "structured_document"
  | "narrative_document"
  | "mixed_document";

export type DocumentAdvisorActionId =
  | "create_tree_structure"
  | "import_outline_tree"
  | "map_to_na"
  | "create_chantier_ai"
  | "wbs_from_section"
  | "wbs_from_document"
  | "document_review";

export type DocumentAdvisorActionShape = {
  id: DocumentAdvisorActionId;
  title: string;
  description: string;
  reason: string;
  confidence: number;
  recommended: boolean;
};

export type DocumentAdvisorNAMatchShape = {
  code: string;
  confidence: number;
};

export type DocumentAdvisorSectionShape = {
  id: string;
  title: string;
};

export type DocumentAdvisorAnalysisShape = {
  nodeId: string;
  nodeName: string;
  nodeType: AiTelemetryDocumentAdvisorContext["nodeType"];
  documentKind: DocumentAdvisorKind;
  lineCount: number;
  outlineLineCount: number;
  outlineCoverage: number;
  maxOutlineLevel: number;
  sections: DocumentAdvisorSectionShape[];
  naMatch: DocumentAdvisorNAMatchShape | null;
  naChantierReady: boolean;
};

export type DocumentAdvisorActionMetrics = {
  outlineLineCount: number;
  maxOutlineLevel: number;
  sectionCount: number;
  selectedSectionTitle: string | null;
  naMatch: DocumentAdvisorNAMatchShape | null;
  naChantierReady: boolean;
};

export type DocumentAdvisorTranslateFn = (key: string, params?: TranslationParams) => string;

export function buildDocumentAdvisorActions(
  kind: DocumentAdvisorKind,
  _metrics: DocumentAdvisorActionMetrics,
  t: DocumentAdvisorTranslateFn
): DocumentAdvisorActionShape[] {
  const reason =
    kind === "numbered_outline"
      ? t("document_ai.action.tree.reason_outline")
      : kind === "structured_document"
        ? t("document_ai.action.tree.reason_structured")
        : kind === "narrative_document"
          ? t("document_ai.action.tree.reason_narrative")
          : t("document_ai.action.tree.reason_mixed");
  const confidence =
    kind === "numbered_outline"
      ? 0.98
      : kind === "structured_document"
        ? 0.86
        : kind === "narrative_document"
          ? 0.64
          : 0.76;

  return [
    {
      id: "create_tree_structure",
      title: t("document_ai.action.tree.title"),
      description: t("document_ai.action.tree.description"),
      reason,
      confidence,
      recommended: true
    }
  ];
}

export function getDocumentAdvisorSelectedSection<TSection extends DocumentAdvisorSectionShape>(
  analysis: { sections: TSection[]; } | null,
  selectedSectionId: string
): TSection | null {
  if (!analysis || analysis.sections.length === 0) return null;
  return analysis.sections.find((section) => section.id === selectedSectionId) ?? analysis.sections[0] ?? null;
}

export function getDocumentAdvisorActions<TAnalysis extends DocumentAdvisorAnalysisShape>(
  analysis: TAnalysis | null,
  selectedSectionId: string,
  t: DocumentAdvisorTranslateFn
): DocumentAdvisorActionShape[] {
  if (!analysis) return [];
  const selectedSection = getDocumentAdvisorSelectedSection(analysis, selectedSectionId);
  return buildDocumentAdvisorActions(
    analysis.documentKind,
    {
      outlineLineCount: analysis.outlineLineCount,
      maxOutlineLevel: analysis.maxOutlineLevel,
      sectionCount: analysis.sections.length,
      selectedSectionTitle: selectedSection?.title ?? null,
      naMatch: analysis.naMatch,
      naChantierReady: analysis.naChantierReady
    },
    t
  );
}

export function buildDocumentAdvisorTelemetryContext<TAnalysis extends DocumentAdvisorAnalysisShape>(
  analysis: TAnalysis,
  selectedSectionId: string,
  actionId: DocumentAdvisorActionId,
  t: DocumentAdvisorTranslateFn
): AiTelemetryDocumentAdvisorContext {
  const selectedSection = getDocumentAdvisorSelectedSection(analysis, selectedSectionId);
  const actions = getDocumentAdvisorActions(analysis, selectedSectionId, t);
  const recommendedActionId = actions.find((candidate) => candidate.recommended)?.id ?? null;
  return {
    nodeId: analysis.nodeId,
    nodeName: analysis.nodeName,
    nodeType: analysis.nodeType,
    documentKind: analysis.documentKind,
    lineCount: analysis.lineCount,
    outlineLineCount: analysis.outlineLineCount,
    outlineCoverage: analysis.outlineCoverage,
    sectionCount: analysis.sections.length,
    selectedSectionId: selectedSection?.id ?? null,
    selectedSectionTitle: selectedSection?.title ?? null,
    recommendedActionId,
    usedRecommendedAction: recommendedActionId === actionId,
    naCode: analysis.naMatch?.code ?? null,
    naConfidence: analysis.naMatch?.confidence ?? null
  };
}
