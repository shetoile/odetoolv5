import { useEffect } from "react";
import type { AiRebuildStatus } from "@/ai/rebuild/status";
import type { ApprovalQueuePreviewOutput } from "@/ai/rebuild/workflows/approvalQueuePreview";
import type { ActionPlanPreviewOutput } from "@/ai/rebuild/workflows/actionPlanPreview";
import type { DocumentIngestionPreviewOutput } from "@/ai/rebuild/workflows/documentIngestionPreview";
import type { DocumentRecordStoreOutput } from "@/ai/rebuild/workflows/documentRecordStore";
import type { ExecutionPacketPreviewOutput } from "@/ai/rebuild/workflows/executionPacketPreview";
import type { FinalAiSolutionOutput } from "@/ai/rebuild/workflows/finalAiSolution";
import type { KnowledgeSnapshotOutput } from "@/ai/rebuild/workflows/knowledgeSnapshot";
import type { KnowledgeRetrievalPreviewOutput } from "@/ai/rebuild/workflows/knowledgeRetrievalPreview";
import type { WorkspaceKnowledgeSummaryOutput } from "@/ai/rebuild/workflows/workspaceKnowledgeSummary";
import type { WorkspaceOverviewOutput } from "@/ai/rebuild/workflows/workspaceOverview";
import { WorkspaceManageCard } from "@/components/workspace/WorkspaceManageCard";
import { AiRebuildCard } from "@/components/workspace/AiRebuildCard";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import type { TranslationParams } from "@/lib/i18n";
import type { ProjectSummary } from "@/lib/types";

type TranslateFn = (key: string, params?: TranslationParams) => string;

interface WorkspaceSettingsModalProps {
  open: boolean;
  showAiRebuild?: boolean;
  t: TranslateFn;
  projects: ProjectSummary[];
  activeProjectId: string | null;
  defaultProjectId: string | null;
  workspaceNameInput: string;
  isProjectImporting: boolean;
  isWorkspaceCreating: boolean;
  isProjectResyncing: boolean;
  isProjectDeleting: boolean;
  workspaceCreateInlineOpen: boolean;
  workspaceExternalChangeCount: number;
  isWorkspaceExternalChangeChecking: boolean;
  workspaceError: string | null;
  workspaceNotice: string | null;
  onClose: () => void;
  onProjectSelectionChange: (projectId: string) => void;
  onWorkspaceNameInputChange: (value: string) => void;
  onOpenCreateWorkspace: () => void;
  onCancelCreateWorkspace: () => void;
  onCreateWorkspace: () => void;
  onPickAndImportProjectFolder: () => void;
  onReSyncWorkspace: () => void;
  onDeleteProjectWorkspace: () => void;
  onSetDefaultWorkspace: () => void;
  onOpenWorkspaceFolderLocation: () => void;
  workspaceRootNumberingEnabled: boolean;
  onWorkspaceRootNumberingEnabledChange: (enabled: boolean) => void;
  aiRebuildStatus: AiRebuildStatus | null;
  aiRebuildStatusBusy: boolean;
  aiRebuildWorkflowBusy: boolean;
  aiRebuildError: string | null;
  aiRebuildOverview: WorkspaceOverviewOutput | null;
  aiRebuildKnowledgeSnapshot: KnowledgeSnapshotOutput | null;
  aiRebuildDocumentIngestion: DocumentIngestionPreviewOutput | null;
  aiRebuildDocumentStore: DocumentRecordStoreOutput | null;
  aiRebuildWorkspaceKnowledgeSummary: WorkspaceKnowledgeSummaryOutput | null;
  aiRebuildKnowledgeRetrieval: KnowledgeRetrievalPreviewOutput | null;
  aiRebuildActionPlan: ActionPlanPreviewOutput | null;
  aiRebuildApprovalQueue: ApprovalQueuePreviewOutput | null;
  aiRebuildExecutionPacket: ExecutionPacketPreviewOutput | null;
  aiRebuildFinalSolution: FinalAiSolutionOutput | null;
  onRefreshAiRebuildStatus: () => void;
  onRunAiRebuildWorkspaceOverview: () => void;
  onRunAiRebuildKnowledgeSnapshot: () => void;
  onRunAiRebuildDocumentIngestion: () => void;
  onRunAiRebuildDocumentStore: () => void;
  onRunAiRebuildWorkspaceKnowledgeSummary: () => void;
  onRunAiRebuildKnowledgeRetrieval: (query: string) => void;
  onRunAiRebuildActionPlan: (focus: string) => void;
  onRunAiRebuildApprovalQueue: (focus: string) => void;
  onRunAiRebuildExecutionPacket: (focus: string) => void;
  onRunAiRebuildFinalSolution: () => void;
}

export function WorkspaceSettingsModal({
  open,
  showAiRebuild = false,
  t,
  projects,
  activeProjectId,
  defaultProjectId,
  workspaceNameInput,
  isProjectImporting,
  isWorkspaceCreating,
  isProjectResyncing,
  isProjectDeleting,
  workspaceCreateInlineOpen,
  workspaceExternalChangeCount,
  isWorkspaceExternalChangeChecking,
  workspaceError,
  workspaceNotice,
  onClose,
  onProjectSelectionChange,
  onWorkspaceNameInputChange,
  onOpenCreateWorkspace,
  onCancelCreateWorkspace,
  onCreateWorkspace,
  onPickAndImportProjectFolder,
  onReSyncWorkspace,
  onDeleteProjectWorkspace,
  onSetDefaultWorkspace,
  onOpenWorkspaceFolderLocation,
  workspaceRootNumberingEnabled,
  onWorkspaceRootNumberingEnabledChange,
  aiRebuildStatus,
  aiRebuildStatusBusy,
  aiRebuildWorkflowBusy,
  aiRebuildError,
  aiRebuildOverview,
  aiRebuildKnowledgeSnapshot,
  aiRebuildDocumentIngestion,
  aiRebuildDocumentStore,
  aiRebuildWorkspaceKnowledgeSummary,
  aiRebuildKnowledgeRetrieval,
  aiRebuildActionPlan,
  aiRebuildApprovalQueue,
  aiRebuildExecutionPacket,
  aiRebuildFinalSolution,
  onRefreshAiRebuildStatus,
  onRunAiRebuildWorkspaceOverview,
  onRunAiRebuildKnowledgeSnapshot,
  onRunAiRebuildDocumentIngestion,
  onRunAiRebuildDocumentStore,
  onRunAiRebuildWorkspaceKnowledgeSummary,
  onRunAiRebuildKnowledgeRetrieval,
  onRunAiRebuildActionPlan,
  onRunAiRebuildApprovalQueue,
  onRunAiRebuildExecutionPacket,
  onRunAiRebuildFinalSolution
}: WorkspaceSettingsModalProps) {
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
    <div className="ode-overlay-scrim fixed inset-0 z-[220] flex backdrop-blur-sm">
      <div
        className="ode-modal flex h-screen w-screen flex-col overflow-hidden rounded-none border-0"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--ode-border)] bg-[rgba(2,18,31,0.96)] px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="truncate text-[1.15rem] font-semibold tracking-[0.01em] text-[var(--ode-accent)]">
            {t("project.settings_title")}
          </h2>
          <OdeTooltip label={t("window.close")} side="bottom">
            <span className="block">
              <button
                type="button"
                className="ode-text-btn h-10 px-4 shrink-0"
                onClick={onClose}
                aria-label={t("window.close")}
              >
                {t("window.close")}
              </button>
            </span>
          </OdeTooltip>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <WorkspaceManageCard
            t={t}
            projects={projects}
            activeProjectId={activeProjectId}
            defaultProjectId={defaultProjectId}
            workspaceNameInput={workspaceNameInput}
            isProjectImporting={isProjectImporting}
            isWorkspaceCreating={isWorkspaceCreating}
            isProjectResyncing={isProjectResyncing}
            isProjectDeleting={isProjectDeleting}
            workspaceCreateInlineOpen={workspaceCreateInlineOpen}
            workspaceExternalChangeCount={workspaceExternalChangeCount}
            isWorkspaceExternalChangeChecking={isWorkspaceExternalChangeChecking}
            workspaceError={workspaceError}
            workspaceNotice={workspaceNotice}
            onProjectSelectionChange={onProjectSelectionChange}
            onWorkspaceNameInputChange={onWorkspaceNameInputChange}
            onOpenCreateWorkspace={onOpenCreateWorkspace}
            onCancelCreateWorkspace={onCancelCreateWorkspace}
            onCreateWorkspace={onCreateWorkspace}
            onPickAndImportProjectFolder={onPickAndImportProjectFolder}
            onReSyncWorkspace={onReSyncWorkspace}
            onDeleteProjectWorkspace={onDeleteProjectWorkspace}
            onSetDefaultWorkspace={onSetDefaultWorkspace}
            onOpenWorkspaceFolderLocation={onOpenWorkspaceFolderLocation}
            workspaceRootNumberingEnabled={workspaceRootNumberingEnabled}
            onWorkspaceRootNumberingEnabledChange={onWorkspaceRootNumberingEnabledChange}
          />
          {showAiRebuild ? (
            <AiRebuildCard
              t={t}
              status={aiRebuildStatus}
              statusBusy={aiRebuildStatusBusy}
              workflowBusy={aiRebuildWorkflowBusy}
              error={aiRebuildError}
              overview={aiRebuildOverview}
              knowledgeSnapshot={aiRebuildKnowledgeSnapshot}
              documentIngestion={aiRebuildDocumentIngestion}
              documentStore={aiRebuildDocumentStore}
              workspaceKnowledgeSummary={aiRebuildWorkspaceKnowledgeSummary}
              knowledgeRetrieval={aiRebuildKnowledgeRetrieval}
              actionPlan={aiRebuildActionPlan}
              approvalQueue={aiRebuildApprovalQueue}
              executionPacket={aiRebuildExecutionPacket}
              finalSolution={aiRebuildFinalSolution}
              onRefreshStatus={onRefreshAiRebuildStatus}
              onRunWorkspaceOverview={onRunAiRebuildWorkspaceOverview}
              onRunKnowledgeSnapshot={onRunAiRebuildKnowledgeSnapshot}
              onRunDocumentIngestion={onRunAiRebuildDocumentIngestion}
              onRunDocumentStore={onRunAiRebuildDocumentStore}
              onRunWorkspaceKnowledgeSummary={onRunAiRebuildWorkspaceKnowledgeSummary}
              onRunKnowledgeRetrieval={onRunAiRebuildKnowledgeRetrieval}
              onRunActionPlan={onRunAiRebuildActionPlan}
              onRunApprovalQueue={onRunAiRebuildApprovalQueue}
              onRunExecutionPacket={onRunAiRebuildExecutionPacket}
              onRunFinalSolution={onRunAiRebuildFinalSolution}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
