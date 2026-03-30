import type { JSX } from "react";
import type { LanguageCode, TranslationParams } from "@/lib/i18n";
import { OdeAiMark } from "@/components/OdeAiMark";
import { useDraggableModalSurface } from "@/hooks/useDraggableModalSurface";
import type { WBSNode } from "@/lib/aiService";
import type { DocumentLanguageCode } from "@/lib/documentLanguage";

type TranslateFn = (key: string, params?: TranslationParams) => string;

export type DocumentActionModalItem = {
  id: string;
  title: string;
  description: string;
  reason: string;
  confidence: number;
  recommended: boolean;
};

type DocumentActionModalSection = {
  id: string;
  title: string;
  lineCount: number;
};

type DocumentActionModalNAMatch = {
  code: string;
  label: string;
  pathLabel: string;
  confidence: number;
  candidates: Array<{
    code: string;
    label: string;
    pathLabel: string;
    score: number;
    reason: string;
  }>;
};

interface DocumentActionModalProps {
  open: boolean;
  t: TranslateFn;
  languageCodes: LanguageCode[];
  documentName: string | null;
  documentKindLabel: string | null;
  summary: string | null;
  previewLines: string[];
  detectedDocumentLanguage: DocumentLanguageCode;
  translationMode: "source" | "auto" | "manual";
  manualTranslationLanguage: LanguageCode;
  resolvedTranslationLanguage: LanguageCode | null;
  translationWarningMessage?: string | null;
  isTranslationBusy?: boolean;
  naMatch: DocumentActionModalNAMatch | null;
  sections: DocumentActionModalSection[];
  selectedSectionId: string;
  selectedSectionPreviewLines: string[];
  actions: DocumentActionModalItem[];
  isAnalyzing: boolean;
  isRunning: boolean;
  treeProposal: {
    goal: string;
    mode: "outline" | "ai" | "fallback";
    warningMessage: string | null;
    nodes: WBSNode[];
    valueSummary: string;
    refinementHistory: string[];
  } | null;
  isTreeProposalBusy: boolean;
  treeProposalError: string | null;
  treeProposalPrompt: string;
  error: string | null;
  onClose: () => void;
  onTranslationModeChange: (mode: "source" | "auto" | "manual") => void;
  onManualTranslationLanguageChange: (language: LanguageCode) => void;
  onSelectSection: (sectionId: string) => void;
  onTreeProposalPromptChange: (value: string) => void;
  onRefineTreeProposal: (options?: { selectedNodeKeys?: string[] }) => void;
  onRunAction: (actionId: string, options?: { selectedNodeKeys?: string[] }) => void;
}

const renderTreeNodes = (nodes: WBSNode[], depth = 0): JSX.Element[] =>
  nodes.map((node, index) => (
    <div key={`${depth}-${index}-${node.title}`} className="space-y-2">
      <div
        className="rounded-lg border border-[rgba(63,118,154,0.22)] bg-[rgba(3,18,30,0.46)] px-3 py-2"
        style={{ marginLeft: `${depth * 14}px` }}
      >
        <p className="text-[0.94rem] font-medium text-[var(--ode-text)]">{node.title}</p>
        {(node.suggested_role || node.estimated_effort) ? (
          <p className="mt-1 text-[0.78rem] text-[var(--ode-text-muted)]">
            {[node.suggested_role, node.estimated_effort].filter((value) => value.trim().length > 0).join(" / ")}
          </p>
        ) : null}
      </div>
      {node.children.length > 0 ? (
        <div className="space-y-2">{renderTreeNodes(node.children, depth + 1)}</div>
      ) : null}
    </div>
  ));

const getTreeProposalModeLabel = (
  mode: "outline" | "ai" | "fallback",
  t: TranslateFn
): string => {
  if (mode === "outline") return t("document_ai.tree_proposal_source_outline");
  if (mode === "ai") return t("document_ai.tree_proposal_source_ai");
  return t("document_ai.tree_proposal_source_fallback");
};

export function DocumentActionModal({
  open,
  t,
  languageCodes,
  documentName,
  documentKindLabel,
  summary,
  previewLines,
  detectedDocumentLanguage,
  translationMode,
  manualTranslationLanguage,
  resolvedTranslationLanguage,
  translationWarningMessage = null,
  isTranslationBusy = false,
  actions,
  isAnalyzing,
  isRunning,
  treeProposal,
  isTreeProposalBusy,
  treeProposalError,
  error,
  onClose,
  onTranslationModeChange,
  onManualTranslationLanguageChange,
  onRunAction
}: DocumentActionModalProps) {
  const { surfaceRef, surfaceStyle, handlePointerDown } = useDraggableModalSurface({ open });

  if (!open) return null;

  const treeAction = actions.find((action) => action.id === "create_tree_structure") ?? actions[0] ?? null;
  const treeActionConfidencePercent =
    treeAction && Number.isFinite(treeAction.confidence) ? Math.round(treeAction.confidence * 100) : null;
  const canExecute = Boolean(treeAction && treeProposal && !isAnalyzing && !isRunning && !isTreeProposalBusy);

  return (
    <div
      className="ode-overlay-scrim fixed inset-0 z-[160] flex items-center justify-center p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget || isRunning) return;
        onClose();
      }}
    >
      <div
        ref={surfaceRef}
        style={surfaceStyle}
        className="ode-modal flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] border border-[var(--ode-border-strong)]"
      >
        <div
          className="ode-modal-drag-handle flex items-center justify-between border-b border-[var(--ode-border)] px-6 py-5"
          onPointerDown={handlePointerDown}
        >
          <div className="min-w-0">
            <div className="truncate">
              <OdeAiMark />
            </div>
          </div>
          <button
            type="button"
            className="ode-icon-btn h-10 w-10"
            onClick={onClose}
            aria-label={t("settings.cancel")}
            disabled={isRunning}
          >
            x
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {isAnalyzing && !treeProposal ? (
            <div className="rounded-xl border border-[var(--ode-border)] bg-[rgba(4,24,40,0.52)] px-4 py-4">
              <p className="text-[0.84rem] uppercase tracking-[0.12em] text-[var(--ode-accent)]">
                {t("document_ai.analysis_title")}
              </p>
              <p className="mt-2 text-[0.98rem] text-[var(--ode-text)]">{t("document_ai.analysis_loading")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--ode-border)] bg-[rgba(4,24,40,0.52)] px-4 py-4">
                <p className="text-[0.84rem] uppercase tracking-[0.12em] text-[var(--ode-accent)]">
                  {t("document_ai.analysis_title")}
                </p>
                {summary ? (
                  <p className="mt-2 text-[0.98rem] leading-6 text-[var(--ode-text)]">{summary}</p>
                ) : null}
                {previewLines.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-[0.8rem] uppercase tracking-[0.12em] text-[var(--ode-accent)]">
                      {t("document_ai.preview_title")}
                    </p>
                    {previewLines.map((line, index) => (
                      <div
                        key={`document-preview-${index}`}
                        className="rounded-lg border border-[rgba(63,118,154,0.22)] bg-[rgba(3,18,30,0.46)] px-3 py-2 text-[0.92rem] text-[var(--ode-text-dim)]"
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-[var(--ode-border)] bg-[rgba(4,24,40,0.52)] px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.84rem] uppercase tracking-[0.12em] text-[var(--ode-accent)]">
                      {t("document_ai.translation_title")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {([
                      ["source", t("document_ai.translation_mode_source")],
                      ["auto", t("document_ai.translation_mode_auto")],
                      ["manual", t("document_ai.translation_mode_manual")]
                    ] as const).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        className={`rounded-full border px-3 py-1.5 text-[0.78rem] uppercase tracking-[0.1em] ${
                          translationMode === mode
                            ? "border-[var(--ode-accent)] bg-[rgba(39,147,210,0.22)] text-white"
                            : "border-[var(--ode-border)] text-[var(--ode-text-dim)]"
                        }`}
                        onClick={() => onTranslationModeChange(mode)}
                        disabled={isAnalyzing || isRunning || isTreeProposalBusy}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-[0.9rem] text-[var(--ode-text-dim)]">
                  <p>
                    {detectedDocumentLanguage === "unknown"
                      ? t("document_ai.translation_detected_unknown")
                      : t("document_ai.translation_detected", { language: detectedDocumentLanguage })}
                  </p>
                  <p>
                    {translationMode === "auto" && !resolvedTranslationLanguage && detectedDocumentLanguage !== "unknown"
                      ? t("document_ai.translation_output_auto_same", { language: detectedDocumentLanguage })
                      : translationMode === "source" || !resolvedTranslationLanguage
                      ? t("document_ai.translation_output_source")
                      : translationMode === "auto"
                        ? t("document_ai.translation_output_auto", { language: resolvedTranslationLanguage })
                        : t("document_ai.translation_output_auto", { language: resolvedTranslationLanguage })}
                  </p>
                </div>
                {isTranslationBusy ? (
                  <p className="mt-3 text-[0.88rem] text-[var(--ode-text-muted)]">
                    {t("document_ai.translation_loading")}
                  </p>
                ) : translationWarningMessage ? (
                  <p className="mt-3 text-[0.88rem] text-[#ffb8b8]">{translationWarningMessage}</p>
                ) : null}

                {translationMode === "manual" ? (
                  <div className="mt-4">
                    <p className="mb-2 text-[0.8rem] uppercase tracking-[0.12em] text-[var(--ode-accent)]">
                      {t("document_ai.translation_manual_label")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {languageCodes.map((code) => (
                        <button
                          key={code}
                          type="button"
                          className={`rounded-md border px-3 py-1.5 text-[0.82rem] ${
                            manualTranslationLanguage === code
                              ? "border-[var(--ode-accent)] bg-[rgba(39,147,210,0.22)] text-white"
                              : "border-[var(--ode-border)] text-[var(--ode-text-dim)]"
                          }`}
                          onClick={() => onManualTranslationLanguageChange(code)}
                          disabled={isAnalyzing || isRunning || isTreeProposalBusy}
                        >
                          {code}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-[var(--ode-border-strong)] bg-[rgba(5,35,57,0.62)] px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.84rem] uppercase tracking-[0.12em] text-[var(--ode-accent)]">
                      {t("document_ai.tree_proposal_title")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {treeProposal ? (
                      <span className="rounded-full border border-[rgba(86,210,255,0.28)] px-3 py-1 text-[0.72rem] uppercase tracking-[0.12em] text-[var(--ode-accent)]">
                        {getTreeProposalModeLabel(treeProposal.mode, t)}
                      </span>
                    ) : null}
                    {treeActionConfidencePercent !== null ? (
                      <span className="rounded-full border border-[rgba(63,118,154,0.22)] px-3 py-1 text-[0.76rem] text-[var(--ode-text-muted)]">
                        {t("document_ai.confidence", { percent: treeActionConfidencePercent })}
                      </span>
                    ) : null}
                  </div>
                </div>

                {treeProposal?.valueSummary ? (
                  <p className="mt-4 text-[0.92rem] leading-6 text-[var(--ode-text-dim)]">{treeProposal.valueSummary}</p>
                ) : null}

                {treeProposalError && !treeProposal ? (
                  <p className="mt-4 text-[0.92rem] text-[#ffb8b8]">{treeProposalError}</p>
                ) : null}
                {treeProposal?.warningMessage ? (
                  <p className="mt-4 text-[0.9rem] text-[var(--ode-text-muted)]">{treeProposal.warningMessage}</p>
                ) : null}
                {error ? <p className="mt-4 text-[0.92rem] text-[#ffb8b8]">{error}</p> : null}

                {isTreeProposalBusy && !treeProposal ? (
                  <p className="mt-4 text-[0.92rem] text-[var(--ode-text-muted)]">
                    {t("document_ai.tree_proposal_loading")}
                  </p>
                ) : treeProposal ? (
                  <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                    {renderTreeNodes(treeProposal.nodes)}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--ode-border)] px-6 py-4">
          <button className="ode-text-btn h-11 px-5" onClick={onClose} disabled={isRunning}>
            {t("delete.modal_cancel")}
          </button>
          <button
            type="button"
            className="ode-primary-btn h-11 px-6"
            onClick={() => {
              if (!treeAction) return;
              onRunAction(treeAction.id);
            }}
            disabled={!canExecute}
          >
            {isRunning ? t("document_ai.run_busy") : t("document_ai.run_action")}
          </button>
        </div>
      </div>
    </div>
  );
}
