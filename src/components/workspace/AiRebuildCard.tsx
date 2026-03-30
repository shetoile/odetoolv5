import { useState } from "react";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import type { ApprovalQueuePreviewOutput } from "@/ai/rebuild/workflows/approvalQueuePreview";
import type { ActionPlanPreviewOutput } from "@/ai/rebuild/workflows/actionPlanPreview";
import type { DocumentIngestionPreviewItem, DocumentIngestionPreviewOutput } from "@/ai/rebuild/workflows/documentIngestionPreview";
import type { DocumentRecordStoreOutput } from "@/ai/rebuild/workflows/documentRecordStore";
import type { ExecutionPacketPreviewOutput } from "@/ai/rebuild/workflows/executionPacketPreview";
import type { FinalAiSolutionOutput } from "@/ai/rebuild/workflows/finalAiSolution";
import type { AiRebuildStatus } from "@/ai/rebuild/status";
import type { KnowledgeSnapshotOutput } from "@/ai/rebuild/workflows/knowledgeSnapshot";
import type { KnowledgeRetrievalPreviewOutput } from "@/ai/rebuild/workflows/knowledgeRetrievalPreview";
import type { WorkspaceKnowledgeSummaryOutput } from "@/ai/rebuild/workflows/workspaceKnowledgeSummary";
import type { WorkspaceOverviewOutput } from "@/ai/rebuild/workflows/workspaceOverview";
import type { TranslationParams } from "@/lib/i18n";

type TranslateFn = (key: string, params?: TranslationParams) => string;

interface AiRebuildCardProps {
  t: TranslateFn;
  status: AiRebuildStatus | null;
  statusBusy: boolean;
  workflowBusy: boolean;
  error: string | null;
  overview: WorkspaceOverviewOutput | null;
  knowledgeSnapshot: KnowledgeSnapshotOutput | null;
  documentIngestion: DocumentIngestionPreviewOutput | null;
  documentStore: DocumentRecordStoreOutput | null;
  workspaceKnowledgeSummary: WorkspaceKnowledgeSummaryOutput | null;
  knowledgeRetrieval: KnowledgeRetrievalPreviewOutput | null;
  actionPlan: ActionPlanPreviewOutput | null;
  approvalQueue: ApprovalQueuePreviewOutput | null;
  executionPacket: ExecutionPacketPreviewOutput | null;
  finalSolution: FinalAiSolutionOutput | null;
  onRefreshStatus: () => void;
  onRunWorkspaceOverview: () => void;
  onRunKnowledgeSnapshot: () => void;
  onRunDocumentIngestion: () => void;
  onRunDocumentStore: () => void;
  onRunWorkspaceKnowledgeSummary: () => void;
  onRunKnowledgeRetrieval: (query: string) => void;
  onRunActionPlan: (focus: string) => void;
  onRunApprovalQueue: (focus: string) => void;
  onRunExecutionPacket: (focus: string) => void;
  onRunFinalSolution: () => void;
}

function renderFlagPill(t: TranslateFn, enabled: boolean) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[0.7rem] font-medium ${
        enabled
          ? "border-[rgba(214,170,82,0.5)] bg-[rgba(71,51,14,0.86)] text-[#f2d38b]"
          : "border-[rgba(72,182,134,0.34)] bg-[rgba(10,49,39,0.72)] text-[#9ff0cb]"
      }`}
    >
      {enabled ? t("ai_rebuild.enabled") : t("ai_rebuild.disabled")}
    </span>
  );
}

function getDocumentIngestionStateLabelByState(
  t: TranslateFn,
  state: DocumentIngestionPreviewItem["ingestionState"]
): string {
  if (state === "indexed") return t("ai_rebuild.ingestion_state_indexed");
  if (state === "description_only") return t("ai_rebuild.ingestion_state_description_only");
  if (state === "extracted_now") return t("ai_rebuild.ingestion_state_extracted_now");
  if (state === "no_file_path") return t("ai_rebuild.ingestion_state_no_file_path");
  return t("ai_rebuild.ingestion_state_unreadable");
}

function getDocumentIngestionStateLabel(t: TranslateFn, item: DocumentIngestionPreviewItem): string {
  return getDocumentIngestionStateLabelByState(t, item.ingestionState);
}

export function AiRebuildCard({
  t,
  status,
  statusBusy,
  workflowBusy,
  error,
  overview,
  knowledgeSnapshot,
  documentIngestion,
  documentStore,
  workspaceKnowledgeSummary,
  knowledgeRetrieval,
  actionPlan,
  approvalQueue,
  executionPacket,
  finalSolution,
  onRefreshStatus,
  onRunWorkspaceOverview,
  onRunKnowledgeSnapshot,
  onRunDocumentIngestion,
  onRunDocumentStore,
  onRunWorkspaceKnowledgeSummary,
  onRunKnowledgeRetrieval,
  onRunActionPlan,
  onRunApprovalQueue,
  onRunExecutionPacket,
  onRunFinalSolution
}: AiRebuildCardProps) {
  const [knowledgeRetrievalQuery, setKnowledgeRetrievalQuery] = useState("");
  const [actionPlanFocus, setActionPlanFocus] = useState("");
  const [approvalQueueFocus, setApprovalQueueFocus] = useState("");
  const [executionPacketFocus, setExecutionPacketFocus] = useState("");

  return (
    <div className="mt-4 rounded-xl border border-[var(--ode-border)] bg-[rgba(4,25,42,0.62)] p-2.5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[0.72rem] uppercase tracking-[0.12em] text-[var(--ode-text-dim)]">
          {t("ai_rebuild.title")}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="ode-mini-btn h-8 px-3"
            onClick={onRefreshStatus}
            disabled={statusBusy || workflowBusy}
          >
            {statusBusy ? t("project.external_changes_checking") : t("ai_rebuild.refresh")}
          </button>
          <button
            type="button"
            className="ode-mini-btn h-8 px-3"
            onClick={onRunWorkspaceOverview}
            disabled={statusBusy || workflowBusy}
          >
            {workflowBusy ? t("ai_rebuild.running") : t("ai_rebuild.run_workspace_overview")}
          </button>
          <button
            type="button"
            className="ode-mini-btn h-8 px-3"
            onClick={onRunKnowledgeSnapshot}
            disabled={statusBusy || workflowBusy}
          >
            {workflowBusy ? t("ai_rebuild.running") : t("ai_rebuild.run_knowledge_snapshot")}
          </button>
          <button
            type="button"
            className="ode-mini-btn h-8 px-3"
            onClick={onRunDocumentIngestion}
            disabled={statusBusy || workflowBusy}
          >
            {workflowBusy ? t("ai_rebuild.running") : t("ai_rebuild.run_document_ingestion")}
          </button>
          <button
            type="button"
            className="ode-mini-btn h-8 px-3"
            onClick={onRunDocumentStore}
            disabled={statusBusy || workflowBusy}
          >
            {workflowBusy ? t("ai_rebuild.running") : t("ai_rebuild.run_document_store")}
          </button>
          <button
            type="button"
            className="ode-mini-btn h-8 px-3"
            onClick={onRunWorkspaceKnowledgeSummary}
            disabled={statusBusy || workflowBusy}
          >
            {workflowBusy ? t("ai_rebuild.running") : t("ai_rebuild.run_workspace_knowledge_summary")}
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.5)] px-3 py-3">
          <div className="text-[0.72rem] uppercase tracking-[0.12em] text-[var(--ode-text-dim)]">{t("ai_rebuild.phase")}</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-full border border-[var(--ode-border)] bg-[rgba(7,33,52,0.82)] px-2.5 py-1 text-[0.76rem] text-[var(--ode-accent)]">
              {status?.phase === "foundation" ? t("ai_rebuild.foundation") : status?.phase ?? t("ai_rebuild.foundation")}
            </span>
          </div>
          <p className="mt-3 text-[0.8rem] leading-6 text-[var(--ode-text-muted)]">
            {status?.message ?? t("ai_rebuild.summary_empty")}
          </p>
        </div>

        <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.5)] px-3 py-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-[0.72rem] uppercase tracking-[0.12em] text-[var(--ode-text-dim)]">
                {t("ai_rebuild.legacy_surface")}
              </div>
              <div className="mt-2">{renderFlagPill(t, status?.legacySurfaceEnabled ?? false)}</div>
            </div>
            <div>
              <div className="text-[0.72rem] uppercase tracking-[0.12em] text-[var(--ode-text-dim)]">
                {t("ai_rebuild.legacy_backend")}
              </div>
              <div className="mt-2">{renderFlagPill(t, status?.legacyBackendEnabled ?? false)}</div>
            </div>
          </div>
          <div className="mt-4 text-[0.72rem] uppercase tracking-[0.12em] text-[var(--ode-text-dim)]">
            {t("ai_rebuild.workflows")}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {status?.availableWorkflows.length ? (
              status.availableWorkflows.map((workflowId) => (
                <span
                  key={workflowId}
                  className="rounded-full border border-[var(--ode-border)] bg-[rgba(7,33,52,0.82)] px-2.5 py-1 text-[0.72rem] text-[var(--ode-text)]"
                >
                  {workflowId}
                </span>
              ))
            ) : (
              <span className="text-[0.78rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.none")}</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.5)] px-3 py-3">
        <div className="text-[0.72rem] uppercase tracking-[0.12em] text-[var(--ode-text-dim)]">
          {t("ai_rebuild.workspace_overview")}
        </div>
        {overview ? (
          <>
            <p className="mt-2 text-[0.92rem] text-[var(--ode-text)]">{overview.summary}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">{t("ai_rebuild.total_nodes")}</div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{overview.totalNodes}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">{t("ai_rebuild.folders")}</div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{overview.folderCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">{t("ai_rebuild.documents")}</div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{overview.documentCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">{t("ai_rebuild.files")}</div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{overview.fileCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">{t("ai_rebuild.tasks")}</div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{overview.taskCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">{t("ai_rebuild.depth")}</div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{overview.maxDepth}</div>
              </div>
            </div>
            <div className="mt-2 text-[0.78rem] text-[var(--ode-text-muted)]">
              {t("ai_rebuild.active_scope")}: {overview.scopeName} | {t("ai_rebuild.tickets")}: {overview.ticketCount}
            </div>
          </>
        ) : (
          <p className="mt-2 text-[0.8rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.summary_empty")}</p>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.5)] px-3 py-3">
        <div className="text-[0.72rem] uppercase tracking-[0.12em] text-[var(--ode-text-dim)]">
          {t("ai_rebuild.knowledge_snapshot")}
        </div>
        {knowledgeSnapshot ? (
          <>
            <p className="mt-2 text-[0.92rem] text-[var(--ode-text)]">{knowledgeSnapshot.summary}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">{t("ai_rebuild.selected_nodes")}</div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{knowledgeSnapshot.selectedNodeCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">{t("ai_rebuild.documents_with_content")}</div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">
                  {knowledgeSnapshot.contentBackedDocumentCount}/{knowledgeSnapshot.documentLikeCount}
                </div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">{t("ai_rebuild.tasks")}</div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{knowledgeSnapshot.taskLikeCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">{t("ai_rebuild.tickets")}</div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{knowledgeSnapshot.ticketCount}</div>
              </div>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.56)] px-3 py-3">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.selected_scope_nodes")}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {knowledgeSnapshot.selectedNodeNames.length ? (
                    knowledgeSnapshot.selectedNodeNames.map((name) => (
                      <span
                        key={name}
                        className="rounded-full border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-2.5 py-1 text-[0.74rem] text-[var(--ode-text)]"
                      >
                        {name}
                      </span>
                    ))
                  ) : (
                    <span className="text-[0.78rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.none")}</span>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.56)] px-3 py-3">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.recent_nodes")}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {knowledgeSnapshot.recentNodeNames.length ? (
                    knowledgeSnapshot.recentNodeNames.map((name) => (
                      <span
                        key={name}
                        className="rounded-full border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-2.5 py-1 text-[0.74rem] text-[var(--ode-text)]"
                      >
                        {name}
                      </span>
                    ))
                  ) : (
                    <span className="text-[0.78rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.none")}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.56)] px-3 py-3">
              <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                {t("ai_rebuild.document_samples")}
              </div>
              <div className="mt-2 space-y-2">
                {knowledgeSnapshot.documentSamples.length ? (
                  knowledgeSnapshot.documentSamples.map((sample) => (
                    <div
                      key={sample.nodeId}
                      className="rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[0.84rem] text-[var(--ode-text)]">{sample.name}</span>
                        <span className="rounded-full border border-[var(--ode-border)] px-2 py-[1px] text-[0.68rem] uppercase text-[var(--ode-text-dim)]">
                          {sample.type}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-[1px] text-[0.68rem] ${
                            sample.hasContent
                              ? "border-[rgba(72,182,134,0.34)] text-[#9ff0cb]"
                              : "border-[var(--ode-border)] text-[var(--ode-text-dim)]"
                          }`}
                        >
                          {sample.hasContent ? t("ai_rebuild.indexed") : t("ai_rebuild.not_indexed")}
                        </span>
                      </div>
                      <p className="mt-2 text-[0.78rem] leading-6 text-[var(--ode-text-muted)]">{sample.excerpt}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-[0.78rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.summary_empty")}</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <p className="mt-2 text-[0.8rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.knowledge_empty")}</p>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.5)] px-3 py-3">
        <div className="text-[0.72rem] uppercase tracking-[0.12em] text-[var(--ode-text-dim)]">
          {t("ai_rebuild.document_ingestion")}
        </div>
        {documentIngestion ? (
          <>
            <p className="mt-2 text-[0.92rem] text-[var(--ode-text)]">{documentIngestion.summary}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">{t("ai_rebuild.document_candidates")}</div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{documentIngestion.candidateCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">{t("ai_rebuild.inspected_documents")}</div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{documentIngestion.inspectedCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">{t("ai_rebuild.indexed")}</div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{documentIngestion.indexedCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">{t("ai_rebuild.description_backed")}</div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{documentIngestion.descriptionCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">{t("ai_rebuild.extracted_now")}</div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{documentIngestion.extractedCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">{t("ai_rebuild.blocked_documents")}</div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{documentIngestion.blockedCount}</div>
              </div>
            </div>

            <div className="mt-2 text-[0.78rem] text-[var(--ode-text-muted)]">
              {t("ai_rebuild.active_scope")}: {documentIngestion.scopeName} | {t("ai_rebuild.ingestion_source_mode")}:{" "}
              {documentIngestion.sourceMode === "selected_documents"
                ? t("ai_rebuild.selected_documents")
                : t("ai_rebuild.recent_documents")}
            </div>

            <div className="mt-3 rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.56)] px-3 py-3">
              <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                {t("ai_rebuild.ingestion_entries")}
              </div>
              <div className="mt-2 space-y-2">
                {documentIngestion.items.length ? (
                  documentIngestion.items.map((item) => (
                    <div
                      key={item.nodeId}
                      className="rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[0.84rem] text-[var(--ode-text)]">{item.name}</span>
                        <span className="rounded-full border border-[var(--ode-border)] px-2 py-[1px] text-[0.68rem] uppercase text-[var(--ode-text-dim)]">
                          {item.type}
                        </span>
                        {item.extension ? (
                          <span className="rounded-full border border-[var(--ode-border)] px-2 py-[1px] text-[0.68rem] uppercase text-[var(--ode-text-dim)]">
                            {item.extension}
                          </span>
                        ) : null}
                        <span
                          className={`rounded-full border px-2 py-[1px] text-[0.68rem] ${
                            item.ingestionState === "indexed" || item.ingestionState === "extracted_now"
                              ? "border-[rgba(72,182,134,0.34)] text-[#9ff0cb]"
                              : item.ingestionState === "description_only"
                                ? "border-[rgba(214,170,82,0.5)] text-[#f2d38b]"
                                : "border-[var(--ode-border)] text-[var(--ode-text-dim)]"
                          }`}
                        >
                          {getDocumentIngestionStateLabel(t, item)}
                        </span>
                      </div>
                      <div className="mt-2 text-[0.72rem] text-[var(--ode-text-dim)]">
                        {item.charCount} {t("ai_rebuild.characters")} | {item.lineCount} {t("ai_rebuild.lines")} |{" "}
                        {item.hasFilePath ? t("ai_rebuild.file_path_yes") : t("ai_rebuild.file_path_no")}
                      </div>
                      <p className="mt-2 text-[0.78rem] leading-6 text-[var(--ode-text-muted)]">{item.excerpt}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-[0.78rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.document_ingestion_empty")}</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <p className="mt-2 text-[0.8rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.document_ingestion_empty")}</p>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.5)] px-3 py-3">
        <div className="text-[0.72rem] uppercase tracking-[0.12em] text-[var(--ode-text-dim)]">
          {t("ai_rebuild.document_store")}
        </div>
        {documentStore ? (
          <>
            <p className="mt-2 text-[0.92rem] text-[var(--ode-text)]">{documentStore.summary}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">{t("ai_rebuild.stored_records")}</div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{documentStore.recordCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">{t("ai_rebuild.indexed")}</div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{documentStore.indexedCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">{t("ai_rebuild.extracted_now")}</div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{documentStore.extractedCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">{t("ai_rebuild.outline_ready_records")}</div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{documentStore.outlineReadyCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">{t("ai_rebuild.blocked_documents")}</div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{documentStore.blockedCount}</div>
              </div>
            </div>

            <div className="mt-2 text-[0.78rem] text-[var(--ode-text-muted)]">
              {t("ai_rebuild.active_scope")}: {documentStore.scopeName} | {t("ai_rebuild.ingestion_source_mode")}:{" "}
              {documentStore.sourceMode === "selected_documents"
                ? t("ai_rebuild.selected_documents")
                : t("ai_rebuild.recent_documents")}{" "}
              | {t("ai_rebuild.generated_at")}: {documentStore.snapshot.workspace?.generatedAt ?? "-"}
            </div>

            <div className="mt-3 rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.56)] px-3 py-3">
              <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                {t("ai_rebuild.record_entries")}
              </div>
              <div className="mt-2 space-y-2">
                {documentStore.snapshot.documents.length ? (
                  documentStore.snapshot.documents.map((record) => (
                    <div
                      key={record.nodeId}
                      className="rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[0.84rem] text-[var(--ode-text)]">{record.title}</span>
                        <span className="rounded-full border border-[var(--ode-border)] px-2 py-[1px] text-[0.68rem] uppercase text-[var(--ode-text-dim)]">
                          {record.kind}
                        </span>
                        {record.extension ? (
                          <span className="rounded-full border border-[var(--ode-border)] px-2 py-[1px] text-[0.68rem] uppercase text-[var(--ode-text-dim)]">
                            {record.extension}
                          </span>
                        ) : null}
                        <span
                          className={`rounded-full border px-2 py-[1px] text-[0.68rem] ${
                            record.ingestionState === "indexed" || record.ingestionState === "extracted_now"
                              ? "border-[rgba(72,182,134,0.34)] text-[#9ff0cb]"
                              : record.ingestionState === "description_only"
                                ? "border-[rgba(214,170,82,0.5)] text-[#f2d38b]"
                                : "border-[var(--ode-border)] text-[var(--ode-text-dim)]"
                          }`}
                        >
                          {getDocumentIngestionStateLabelByState(t, record.ingestionState)}
                        </span>
                      </div>
                      <div className="mt-2 text-[0.72rem] text-[var(--ode-text-dim)]">
                        {record.charCount} {t("ai_rebuild.characters")} | {record.lineCount} {t("ai_rebuild.lines")} |{" "}
                        {t("ai_rebuild.updated_at")}: {record.updatedAt}
                      </div>
                      <p className="mt-2 text-[0.78rem] leading-6 text-[var(--ode-text-muted)]">{record.excerpt}</p>
                      <div className="mt-2">
                        <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                          {t("ai_rebuild.outline_preview")}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {record.outlineLines.length ? (
                            record.outlineLines.map((line) => (
                              <span
                                key={`${record.nodeId}-${line}`}
                                className="rounded-full border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-2.5 py-1 text-[0.72rem] text-[var(--ode-text)]"
                              >
                                {line}
                              </span>
                            ))
                          ) : (
                            <span className="text-[0.78rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.none")}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[0.78rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.document_store_empty")}</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <p className="mt-2 text-[0.8rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.document_store_empty")}</p>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.5)] px-3 py-3">
        <div className="text-[0.72rem] uppercase tracking-[0.12em] text-[var(--ode-text-dim)]">
          {t("ai_rebuild.workspace_knowledge_summary")}
        </div>
        {workspaceKnowledgeSummary ? (
          <>
            <p className="mt-2 text-[0.92rem] text-[var(--ode-text)]">{workspaceKnowledgeSummary.summary}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.summary_documents")}
                </div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{workspaceKnowledgeSummary.recordCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.summary_indexed_ready")}
                </div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{workspaceKnowledgeSummary.indexedReadyCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.summary_blocked")}
                </div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{workspaceKnowledgeSummary.blockedCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.average_chars")}
                </div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{workspaceKnowledgeSummary.averageCharCount}</div>
              </div>
            </div>

            <div className="mt-2 text-[0.78rem] text-[var(--ode-text-muted)]">
              {t("ai_rebuild.active_scope")}: {workspaceKnowledgeSummary.scopeName} | {t("ai_rebuild.ingestion_source_mode")}:{" "}
              {workspaceKnowledgeSummary.sourceMode === "selected_documents"
                ? t("ai_rebuild.selected_documents")
                : t("ai_rebuild.recent_documents")}{" "}
              | {t("ai_rebuild.generated_at")}: {workspaceKnowledgeSummary.generatedAt ?? "-"}
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.56)] px-3 py-3">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.top_extensions")}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {workspaceKnowledgeSummary.topExtensions.length ? (
                    workspaceKnowledgeSummary.topExtensions.map((entry) => (
                      <span
                        key={`${entry.label}-${entry.count}`}
                        className="rounded-full border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-2.5 py-1 text-[0.74rem] text-[var(--ode-text)]"
                      >
                        {entry.label} ({entry.count})
                      </span>
                    ))
                  ) : (
                    <span className="text-[0.78rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.none")}</span>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.56)] px-3 py-3">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.outline_topics")}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {workspaceKnowledgeSummary.outlineTopics.length ? (
                    workspaceKnowledgeSummary.outlineTopics.map((topic) => (
                      <span
                        key={topic}
                        className="rounded-full border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-2.5 py-1 text-[0.74rem] text-[var(--ode-text)]"
                      >
                        {topic}
                      </span>
                    ))
                  ) : (
                    <span className="text-[0.78rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.none")}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.56)] px-3 py-3">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.recent_document_titles")}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {workspaceKnowledgeSummary.recentDocumentTitles.length ? (
                    workspaceKnowledgeSummary.recentDocumentTitles.map((title) => (
                      <span
                        key={title}
                        className="rounded-full border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-2.5 py-1 text-[0.74rem] text-[var(--ode-text)]"
                      >
                        {title}
                      </span>
                    ))
                  ) : (
                    <span className="text-[0.78rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.none")}</span>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.56)] px-3 py-3">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.knowledge_signals")}
                </div>
                <div className="mt-2 space-y-2">
                  {workspaceKnowledgeSummary.signals.length ? (
                    workspaceKnowledgeSummary.signals.map((signal) => (
                      <p
                        key={signal}
                        className="rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-3 py-2 text-[0.78rem] leading-6 text-[var(--ode-text-muted)]"
                      >
                        {signal}
                      </p>
                    ))
                  ) : (
                    <p className="text-[0.78rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.none")}</p>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-2 text-[0.8rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.workspace_summary_empty")}</p>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.5)] px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[0.72rem] uppercase tracking-[0.12em] text-[var(--ode-text-dim)]">
            {t("ai_rebuild.knowledge_retrieval")}
          </div>
          <button
            type="button"
            className="ode-mini-btn h-8 px-3"
            onClick={() => onRunKnowledgeRetrieval(knowledgeRetrievalQuery)}
            disabled={statusBusy || workflowBusy}
          >
            {workflowBusy ? t("ai_rebuild.running") : t("ai_rebuild.run_knowledge_retrieval")}
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
          <input
            type="text"
            value={knowledgeRetrievalQuery}
            onChange={(event) => setKnowledgeRetrievalQuery(event.target.value)}
            placeholder={t("ai_rebuild.retrieval_query_placeholder")}
            className="h-11 flex-1 rounded-xl border border-[var(--ode-border)] bg-[rgba(7,33,52,0.82)] px-3 text-[0.88rem] text-[var(--ode-text)] outline-none transition focus:border-[var(--ode-accent)]"
          />
        </div>

        {knowledgeRetrieval ? (
          <>
            <p className="mt-3 text-[0.92rem] text-[var(--ode-text)]">{knowledgeRetrieval.summary}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.retrieved_documents")}
                </div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{knowledgeRetrieval.matchedDocumentCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.retrieved_topics")}
                </div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{knowledgeRetrieval.matchedOutlineTopicCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.retrieved_signals")}
                </div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{knowledgeRetrieval.matchedSignalCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.retrieved_formats")}
                </div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{knowledgeRetrieval.matchedExtensionCount}</div>
              </div>
            </div>

            <div className="mt-2 text-[0.78rem] text-[var(--ode-text-muted)]">
              {t("ai_rebuild.active_scope")}: {knowledgeRetrieval.scopeName} | {t("ai_rebuild.retrieval_query_label")}:{" "}
              {knowledgeRetrieval.query} | {t("ai_rebuild.retrieval_query_source")}:{" "}
              {t(`ai_rebuild.retrieval_query_source_${knowledgeRetrieval.querySource}`)} | {t("ai_rebuild.generated_at")}:{" "}
              {knowledgeRetrieval.generatedAt ?? "-"}
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.56)] px-3 py-3">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.retrieval_topics")}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {knowledgeRetrieval.matchedOutlineTopics.length ? (
                    knowledgeRetrieval.matchedOutlineTopics.map((topic) => (
                      <span
                        key={topic}
                        className="rounded-full border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-2.5 py-1 text-[0.74rem] text-[var(--ode-text)]"
                      >
                        {topic}
                      </span>
                    ))
                  ) : (
                    <span className="text-[0.78rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.none")}</span>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.56)] px-3 py-3">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.retrieval_formats")}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {knowledgeRetrieval.matchedExtensions.length ? (
                    knowledgeRetrieval.matchedExtensions.map((extension) => (
                      <span
                        key={extension}
                        className="rounded-full border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-2.5 py-1 text-[0.74rem] text-[var(--ode-text)]"
                      >
                        {extension}
                      </span>
                    ))
                  ) : (
                    <span className="text-[0.78rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.none")}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.56)] px-3 py-3">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.retrieval_signals")}
                </div>
                <div className="mt-2 space-y-2">
                  {knowledgeRetrieval.matchedSignals.length ? (
                    knowledgeRetrieval.matchedSignals.map((signal) => (
                      <p
                        key={signal}
                        className="rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-3 py-2 text-[0.78rem] leading-6 text-[var(--ode-text-muted)]"
                      >
                        {signal}
                      </p>
                    ))
                  ) : (
                    <p className="text-[0.78rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.none")}</p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.56)] px-3 py-3">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.retrieval_documents")}
                </div>
                <div className="mt-2 space-y-2">
                  {knowledgeRetrieval.documentMatches.length ? (
                    knowledgeRetrieval.documentMatches.map((match) => (
                      <div
                        key={match.nodeId}
                        className="rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[0.84rem] text-[var(--ode-text)]">{match.title}</span>
                          {match.extension ? (
                            <span className="rounded-full border border-[var(--ode-border)] px-2 py-[1px] text-[0.68rem] uppercase text-[var(--ode-text-dim)]">
                              {match.extension}
                            </span>
                          ) : null}
                          <span className="rounded-full border border-[rgba(72,182,134,0.34)] px-2 py-[1px] text-[0.68rem] text-[#9ff0cb]">
                            {t("ai_rebuild.retrieval_score")}: {match.score}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {match.reasons.map((reason) => (
                            <span
                              key={`${match.nodeId}-${reason}`}
                              className="rounded-full border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-2 py-[1px] text-[0.68rem] text-[var(--ode-text-dim)]"
                            >
                              {t(`ai_rebuild.retrieval_reason_${reason}`)}
                            </span>
                          ))}
                        </div>
                        <p className="mt-2 text-[0.78rem] leading-6 text-[var(--ode-text-muted)]">{match.excerpt}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-[0.78rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.retrieval_empty")}</p>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-3 text-[0.8rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.retrieval_empty")}</p>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.5)] px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[0.72rem] uppercase tracking-[0.12em] text-[var(--ode-text-dim)]">
            {t("ai_rebuild.action_plan")}
          </div>
          <button
            type="button"
            className="ode-mini-btn h-8 px-3"
            onClick={() => onRunActionPlan(actionPlanFocus)}
            disabled={statusBusy || workflowBusy}
          >
            {workflowBusy ? t("ai_rebuild.running") : t("ai_rebuild.run_action_plan")}
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
          <input
            type="text"
            value={actionPlanFocus}
            onChange={(event) => setActionPlanFocus(event.target.value)}
            placeholder={t("ai_rebuild.action_plan_focus_placeholder")}
            className="h-11 flex-1 rounded-xl border border-[var(--ode-border)] bg-[rgba(7,33,52,0.82)] px-3 text-[0.88rem] text-[var(--ode-text)] outline-none transition focus:border-[var(--ode-accent)]"
          />
        </div>

        {actionPlan ? (
          <>
            <p className="mt-3 text-[0.92rem] text-[var(--ode-text)]">{actionPlan.summary}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.plan_proposals")}
                </div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{actionPlan.proposalCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.plan_high_confidence")}
                </div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{actionPlan.highConfidenceCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.generated_at")}
                </div>
                <div className="mt-1 text-[0.88rem] text-[var(--ode-text)]">{actionPlan.generatedAt ?? "-"}</div>
              </div>
            </div>

            <div className="mt-2 text-[0.78rem] text-[var(--ode-text-muted)]">
              {t("ai_rebuild.active_scope")}: {actionPlan.scopeName} | {t("ai_rebuild.action_plan_focus_label")}: {actionPlan.focus} |{" "}
              {t("ai_rebuild.action_plan_focus_source")}: {t(`ai_rebuild.retrieval_query_source_${actionPlan.focusSource}`)}
            </div>

            <div className="mt-3 space-y-3">
              {actionPlan.proposals.map((proposal) => (
                <div
                  key={proposal.id}
                  className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.56)] px-3 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[0.9rem] text-[var(--ode-text)]">{proposal.title}</span>
                    <span className="rounded-full border border-[var(--ode-border)] px-2 py-[1px] text-[0.68rem] uppercase text-[var(--ode-text-dim)]">
                      {t(`ai_rebuild.action_kind_${proposal.kind}`)}
                    </span>
                    <span className="rounded-full border border-[rgba(72,182,134,0.34)] px-2 py-[1px] text-[0.68rem] text-[#9ff0cb]">
                      {t("ai_rebuild.action_confidence")}: {proposal.confidence}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-[1px] text-[0.68rem] ${
                        proposal.requiresReview
                          ? "border-[rgba(214,170,82,0.5)] text-[#f2d38b]"
                          : "border-[rgba(72,182,134,0.34)] text-[#9ff0cb]"
                      }`}
                    >
                      {proposal.requiresReview ? t("ai_rebuild.review_required") : t("ai_rebuild.review_not_required")}
                    </span>
                  </div>
                  <p className="mt-2 text-[0.78rem] leading-6 text-[var(--ode-text-muted)]">{proposal.rationale}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {proposal.sourceTitles.length ? (
                      proposal.sourceTitles.map((sourceTitle) => (
                        <span
                          key={`${proposal.id}-${sourceTitle}`}
                          className="rounded-full border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-2.5 py-1 text-[0.74rem] text-[var(--ode-text)]"
                        >
                          {sourceTitle}
                        </span>
                      ))
                    ) : (
                      <span className="text-[0.78rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.none")}</span>
                    )}
                  </div>
                  <div className="mt-3 space-y-2">
                    {proposal.steps.map((step, index) => (
                      <p
                        key={`${proposal.id}-${index + 1}`}
                        className="rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-3 py-2 text-[0.78rem] leading-6 text-[var(--ode-text-muted)]"
                      >
                        {index + 1}. {step}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-3 text-[0.8rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.action_plan_empty")}</p>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.5)] px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[0.72rem] uppercase tracking-[0.12em] text-[var(--ode-text-dim)]">
            {t("ai_rebuild.approval_queue")}
          </div>
          <button
            type="button"
            className="ode-mini-btn h-8 px-3"
            onClick={() => onRunApprovalQueue(approvalQueueFocus)}
            disabled={statusBusy || workflowBusy}
          >
            {workflowBusy ? t("ai_rebuild.running") : t("ai_rebuild.run_approval_queue")}
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
          <input
            type="text"
            value={approvalQueueFocus}
            onChange={(event) => setApprovalQueueFocus(event.target.value)}
            placeholder={t("ai_rebuild.approval_queue_focus_placeholder")}
            className="h-11 flex-1 rounded-xl border border-[var(--ode-border)] bg-[rgba(7,33,52,0.82)] px-3 text-[0.88rem] text-[var(--ode-text)] outline-none transition focus:border-[var(--ode-accent)]"
          />
        </div>

        {approvalQueue ? (
          <>
            <p className="mt-3 text-[0.92rem] text-[var(--ode-text)]">{approvalQueue.summary}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.approval_items")}
                </div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{approvalQueue.itemCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.approval_ready")}
                </div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{approvalQueue.readyForHandoffCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.approval_hold")}
                </div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{approvalQueue.holdCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.generated_at")}
                </div>
                <div className="mt-1 text-[0.88rem] text-[var(--ode-text)]">{approvalQueue.generatedAt ?? "-"}</div>
              </div>
            </div>

            <div className="mt-2 text-[0.78rem] text-[var(--ode-text-muted)]">
              {t("ai_rebuild.active_scope")}: {approvalQueue.scopeName} | {t("ai_rebuild.action_plan_focus_label")}: {approvalQueue.focus} |{" "}
              {t("ai_rebuild.action_plan_focus_source")}: {t(`ai_rebuild.retrieval_query_source_${approvalQueue.focusSource}`)}
            </div>

            <div className="mt-3 space-y-3">
              {approvalQueue.items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.56)] px-3 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[0.9rem] text-[var(--ode-text)]">{item.title}</span>
                    <span className="rounded-full border border-[var(--ode-border)] px-2 py-[1px] text-[0.68rem] uppercase text-[var(--ode-text-dim)]">
                      {t(`ai_rebuild.action_kind_${item.kind}`)}
                    </span>
                    <span className="rounded-full border border-[rgba(72,182,134,0.34)] px-2 py-[1px] text-[0.68rem] text-[#9ff0cb]">
                      {t("ai_rebuild.action_confidence")}: {item.confidence}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-[1px] text-[0.68rem] ${
                        item.riskLevel === "high"
                          ? "border-[rgba(240,122,122,0.46)] text-[#ffb2b2]"
                          : item.riskLevel === "medium"
                            ? "border-[rgba(214,170,82,0.5)] text-[#f2d38b]"
                            : "border-[rgba(72,182,134,0.34)] text-[#9ff0cb]"
                      }`}
                    >
                      {t("ai_rebuild.approval_risk")}: {t(`ai_rebuild.approval_risk_${item.riskLevel}`)}
                    </span>
                    <span className="rounded-full border border-[var(--ode-border)] px-2 py-[1px] text-[0.68rem] text-[var(--ode-text-dim)]">
                      {t("ai_rebuild.approval_readiness")}: {t(`ai_rebuild.approval_${item.readiness}`)}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-[1px] text-[0.68rem] ${
                        item.recommendedDecision === "approve_for_handoff"
                          ? "border-[rgba(72,182,134,0.34)] text-[#9ff0cb]"
                          : "border-[rgba(214,170,82,0.5)] text-[#f2d38b]"
                      }`}
                    >
                      {t("ai_rebuild.approval_recommended_decision")}: {t(`ai_rebuild.approval_decision_${item.recommendedDecision}`)}
                    </span>
                  </div>
                  <p className="mt-2 text-[0.78rem] leading-6 text-[var(--ode-text-muted)]">{item.rationale}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.sourceTitles.length ? (
                      item.sourceTitles.map((sourceTitle) => (
                        <span
                          key={`${item.id}-${sourceTitle}`}
                          className="rounded-full border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-2.5 py-1 text-[0.74rem] text-[var(--ode-text)]"
                        >
                          {sourceTitle}
                        </span>
                      ))
                    ) : (
                      <span className="text-[0.78rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.none")}</span>
                    )}
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-3 py-3">
                      <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                        {t("ai_rebuild.approval_checklist")}
                      </div>
                      <div className="mt-2 space-y-2">
                        {item.checklist.map((check) => (
                          <div
                            key={`${item.id}-${check.id}`}
                            className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.56)] px-3 py-2 text-[0.78rem] leading-6 text-[var(--ode-text-muted)]"
                          >
                            <span
                              className={`mr-2 rounded-full border px-2 py-[1px] text-[0.68rem] ${
                                check.satisfied
                                  ? "border-[rgba(72,182,134,0.34)] text-[#9ff0cb]"
                                  : "border-[rgba(214,170,82,0.5)] text-[#f2d38b]"
                              }`}
                            >
                              {check.satisfied ? t("ai_rebuild.approval_check_ready") : t("ai_rebuild.approval_check_open")}
                            </span>
                            {check.label}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-3 py-3">
                      <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                        {t("ai_rebuild.approval_blockers")}
                      </div>
                      <div className="mt-2 space-y-2">
                        {item.blockers.length ? (
                          item.blockers.map((blocker, index) => (
                            <p
                              key={`${item.id}-blocker-${index + 1}`}
                              className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.56)] px-3 py-2 text-[0.78rem] leading-6 text-[var(--ode-text-muted)]"
                            >
                              {blocker}
                            </p>
                          ))
                        ) : (
                          <p className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.56)] px-3 py-2 text-[0.78rem] leading-6 text-[var(--ode-text-muted)]">
                            {t("ai_rebuild.none")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-3 py-3">
                    <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                      {t("ai_rebuild.approval_handoff_note")}
                    </div>
                    <p className="mt-2 text-[0.78rem] leading-6 text-[var(--ode-text-muted)]">{item.handoffNote}</p>
                  </div>

                  <div className="mt-3 space-y-2">
                    {item.steps.map((step, index) => (
                      <p
                        key={`${item.id}-step-${index + 1}`}
                        className="rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-3 py-2 text-[0.78rem] leading-6 text-[var(--ode-text-muted)]"
                      >
                        {index + 1}. {step}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-3 text-[0.8rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.approval_queue_empty")}</p>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.5)] px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[0.72rem] uppercase tracking-[0.12em] text-[var(--ode-text-dim)]">
            {t("ai_rebuild.execution_packet")}
          </div>
          <button
            type="button"
            className="ode-mini-btn h-8 px-3"
            onClick={() => onRunExecutionPacket(executionPacketFocus)}
            disabled={statusBusy || workflowBusy}
          >
            {workflowBusy ? t("ai_rebuild.running") : t("ai_rebuild.run_execution_packet")}
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
          <input
            type="text"
            value={executionPacketFocus}
            onChange={(event) => setExecutionPacketFocus(event.target.value)}
            placeholder={t("ai_rebuild.execution_packet_focus_placeholder")}
            className="h-11 flex-1 rounded-xl border border-[var(--ode-border)] bg-[rgba(7,33,52,0.82)] px-3 text-[0.88rem] text-[var(--ode-text)] outline-none transition focus:border-[var(--ode-accent)]"
          />
        </div>

        {executionPacket ? (
          <>
            <p className="mt-3 text-[0.92rem] text-[var(--ode-text)]">{executionPacket.summary}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.execution_packets")}
                </div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{executionPacket.packetCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.execution_draft_packets")}
                </div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{executionPacket.draftPacketCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.execution_approval_required")}
                </div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{executionPacket.requiresExplicitApprovalCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.execution_deferred")}
                </div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{executionPacket.deferredCount}</div>
              </div>
            </div>

            <div className="mt-2 text-[0.78rem] text-[var(--ode-text-muted)]">
              {t("ai_rebuild.active_scope")}: {executionPacket.scopeName} | {t("ai_rebuild.action_plan_focus_label")}: {executionPacket.focus} |{" "}
              {t("ai_rebuild.action_plan_focus_source")}: {t(`ai_rebuild.retrieval_query_source_${executionPacket.focusSource}`)} |{" "}
              {t("ai_rebuild.generated_at")}: {executionPacket.generatedAt ?? "-"}
            </div>

            <div className="mt-3 space-y-3">
              {executionPacket.packets.length ? (
                executionPacket.packets.map((packet) => (
                  <div
                    key={packet.id}
                    className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.56)] px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[0.9rem] text-[var(--ode-text)]">{packet.title}</span>
                      <span className="rounded-full border border-[var(--ode-border)] px-2 py-[1px] text-[0.68rem] uppercase text-[var(--ode-text-dim)]">
                        {packet.executionClassLabel}
                      </span>
                      <span className="rounded-full border border-[rgba(72,182,134,0.34)] px-2 py-[1px] text-[0.68rem] text-[#9ff0cb]">
                        {t("ai_rebuild.action_confidence")}: {packet.confidence}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-[1px] text-[0.68rem] ${
                          packet.riskLevel === "high"
                            ? "border-[rgba(240,122,122,0.46)] text-[#ffb2b2]"
                            : packet.riskLevel === "medium"
                              ? "border-[rgba(214,170,82,0.5)] text-[#f2d38b]"
                              : "border-[rgba(72,182,134,0.34)] text-[#9ff0cb]"
                        }`}
                      >
                        {t("ai_rebuild.approval_risk")}: {t(`ai_rebuild.approval_risk_${packet.riskLevel}`)}
                      </span>
                      <span className="rounded-full border border-[var(--ode-border)] px-2 py-[1px] text-[0.68rem] text-[var(--ode-text-dim)]">
                        {packet.futureEffectLabel}
                      </span>
                    </div>

                    <div className="mt-2 text-[0.78rem] text-[var(--ode-text-muted)]">
                      {t("ai_rebuild.execution_target_surface")}: {packet.targetSurface} | {t("ai_rebuild.execution_approval_required")}:{" "}
                      {packet.requiresExplicitApproval ? t("ai_rebuild.review_required") : t("ai_rebuild.review_not_required")}
                    </div>

                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-3 py-3">
                        <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                          {t("ai_rebuild.execution_guardrails")}
                        </div>
                        <div className="mt-2 space-y-2">
                          {packet.guardrails.map((guardrail, index) => (
                            <p
                              key={`${packet.id}-guardrail-${index + 1}`}
                              className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.56)] px-3 py-2 text-[0.78rem] leading-6 text-[var(--ode-text-muted)]"
                            >
                              {guardrail}
                            </p>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-3 py-3">
                        <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                          {t("ai_rebuild.execution_outputs")}
                        </div>
                        <div className="mt-2 space-y-2">
                          {packet.plannedOutputs.map((output, index) => (
                            <p
                              key={`${packet.id}-output-${index + 1}`}
                              className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.56)] px-3 py-2 text-[0.78rem] leading-6 text-[var(--ode-text-muted)]"
                            >
                              {output}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {packet.evidenceTitles.length ? (
                        packet.evidenceTitles.map((sourceTitle) => (
                          <span
                            key={`${packet.id}-${sourceTitle}`}
                            className="rounded-full border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-2.5 py-1 text-[0.74rem] text-[var(--ode-text)]"
                          >
                            {sourceTitle}
                          </span>
                        ))
                      ) : (
                        <span className="text-[0.78rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.none")}</span>
                      )}
                    </div>

                    <div className="mt-3 space-y-2">
                      {packet.steps.map((step, index) => (
                        <p
                          key={`${packet.id}-step-${index + 1}`}
                          className="rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-3 py-2 text-[0.78rem] leading-6 text-[var(--ode-text-muted)]"
                        >
                          {index + 1}. {step}
                        </p>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[0.78rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.execution_packet_empty")}</p>
              )}
            </div>

            <div className="mt-3 rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.56)] px-3 py-3">
              <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                {t("ai_rebuild.execution_deferred_queue")}
              </div>
              <div className="mt-2 space-y-2">
                {executionPacket.deferredItems.length ? (
                  executionPacket.deferredItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-3 py-2"
                    >
                      <div className="text-[0.84rem] text-[var(--ode-text)]">{item.title}</div>
                      <p className="mt-1 text-[0.76rem] leading-6 text-[var(--ode-text-muted)]">{item.reason}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-[0.78rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.none")}</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <p className="mt-3 text-[0.8rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.execution_packet_empty")}</p>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.5)] px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[0.72rem] uppercase tracking-[0.12em] text-[var(--ode-text-dim)]">
            {t("ai_rebuild.final_solution")}
          </div>
          <button
            type="button"
            className="ode-mini-btn h-8 px-3"
            onClick={onRunFinalSolution}
            disabled={statusBusy || workflowBusy}
          >
            {workflowBusy ? t("ai_rebuild.running") : t("ai_rebuild.run_final_solution")}
          </button>
        </div>

        {finalSolution ? (
          <>
            <p className="mt-3 text-[0.92rem] text-[var(--ode-text)]">{finalSolution.summary}</p>
            <p className="mt-2 text-[0.8rem] leading-6 text-[var(--ode-text-muted)]">{finalSolution.currentState}</p>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">{t("ai_rebuild.solution_score")}</div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{finalSolution.overallScore}/100</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">{t("ai_rebuild.solution_ready_layers")}</div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{finalSolution.readyCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">{t("ai_rebuild.solution_partial_layers")}</div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{finalSolution.partialCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.72)] px-3 py-2">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">{t("ai_rebuild.solution_future_layers")}</div>
                <div className="mt-1 text-[1rem] text-[var(--ode-text)]">{finalSolution.futureCount}</div>
              </div>
            </div>

            <div className="mt-2 text-[0.78rem] text-[var(--ode-text-muted)]">
              {finalSolution.architectureName} | {t("ai_rebuild.generated_at")}: {finalSolution.generatedAt}
            </div>

            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.56)] px-3 py-3">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.solution_layers")}
                </div>
                <div className="mt-2 space-y-2">
                  {finalSolution.layers.map((layer) => (
                    <div
                      key={layer.id}
                      className="rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[0.84rem] text-[var(--ode-text)]">{layer.name}</span>
                        <span
                          className={`rounded-full border px-2 py-[1px] text-[0.68rem] ${
                            layer.status === "ready"
                              ? "border-[rgba(72,182,134,0.34)] text-[#9ff0cb]"
                              : layer.status === "partial"
                                ? "border-[rgba(214,170,82,0.5)] text-[#f2d38b]"
                                : "border-[rgba(240,122,122,0.46)] text-[#ffb2b2]"
                          }`}
                        >
                          {t(`ai_rebuild.solution_status_${layer.status}`)}
                        </span>
                        <span className="rounded-full border border-[var(--ode-border)] px-2 py-[1px] text-[0.68rem] text-[var(--ode-text-dim)]">
                          {layer.score * 100}%
                        </span>
                      </div>
                      <p className="mt-1 text-[0.76rem] leading-6 text-[var(--ode-text-muted)]">{layer.summary}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.56)] px-3 py-3">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.solution_workflow_stages")}
                </div>
                <div className="mt-2 space-y-2">
                  {finalSolution.workflowStages.map((stage) => (
                    <div
                      key={stage.stage}
                      className="rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-3 py-2"
                    >
                      <div className="text-[0.82rem] text-[var(--ode-text)]">{stage.stage}</div>
                      <p className="mt-1 text-[0.76rem] leading-6 text-[var(--ode-text-muted)]">{stage.description}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {stage.workflows.map((workflowId) => (
                          <span
                            key={`${stage.stage}-${workflowId}`}
                            className="rounded-full border border-[var(--ode-border)] bg-[rgba(7,33,52,0.56)] px-2.5 py-1 text-[0.72rem] text-[var(--ode-text)]"
                          >
                            {workflowId}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-3 xl:grid-cols-3">
              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.56)] px-3 py-3">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.solution_governance")}
                </div>
                <div className="mt-2 space-y-2">
                  {finalSolution.governanceRules.map((rule, index) => (
                    <p
                      key={`governance-${index + 1}`}
                      className="rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-3 py-2 text-[0.76rem] leading-6 text-[var(--ode-text-muted)]"
                    >
                      {rule}
                    </p>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.56)] px-3 py-3">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.solution_quality_signals")}
                </div>
                <div className="mt-2 space-y-2">
                  {finalSolution.qualitySignals.map((signal, index) => (
                    <p
                      key={`signal-${index + 1}`}
                      className="rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-3 py-2 text-[0.76rem] leading-6 text-[var(--ode-text-muted)]"
                    >
                      {signal}
                    </p>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-[var(--ode-border)] bg-[rgba(7,33,52,0.56)] px-3 py-3">
                <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[var(--ode-text-dim)]">
                  {t("ai_rebuild.solution_future_modules")}
                </div>
                <div className="mt-2 space-y-2">
                  {finalSolution.remainingFutureModules.map((item, index) => (
                    <p
                      key={`future-${index + 1}`}
                      className="rounded-lg border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-3 py-2 text-[0.76rem] leading-6 text-[var(--ode-text-muted)]"
                    >
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-3 text-[0.8rem] text-[var(--ode-text-muted)]">{t("ai_rebuild.final_solution_empty")}</p>
        )}
      </div>

      {error ? (
        <OdeTooltip label={error} side="top">
          <p className="mt-3 text-[0.75rem] text-[#ffb2b2]">{error}</p>
        </OdeTooltip>
      ) : null}
    </div>
  );
}
