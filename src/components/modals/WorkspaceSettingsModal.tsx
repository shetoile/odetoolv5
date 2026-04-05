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
import { useDraggableModalSurface } from "@/hooks/useDraggableModalSurface";
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
  workspaceLocalPathInput: string;
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
  onWorkspaceLocalPathInputChange: (value: string) => void;
  onOpenCreateWorkspace: () => void;
  onCancelCreateWorkspace: () => void;
  onCreateWorkspace: () => void;
  onPickAndImportProjectFolder: () => void;
  onPickWorkspaceLocalFolder: () => void;
  onSetWorkspaceLocalPath: () => void;
  onReSyncWorkspace: () => void;
  onDeleteProjectWorkspace: () => void;
  onSetDefaultWorkspace: () => void;
  onOpenWorkspaceFolderLocation: () => void;
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
  workspaceLocalPathInput,
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
  onWorkspaceLocalPathInputChange,
  onOpenCreateWorkspace,
  onCancelCreateWorkspace,
  onCreateWorkspace,
  onPickAndImportProjectFolder,
  onPickWorkspaceLocalFolder,
  onSetWorkspaceLocalPath,
  onReSyncWorkspace,
  onDeleteProjectWorkspace,
  onSetDefaultWorkspace,
  onOpenWorkspaceFolderLocation,
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
  const { surfaceRef, surfaceStyle, handlePointerDown } = useDraggableModalSurface({ open });

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
    <div
      className="ode-overlay-scrim fixed inset-0 z-[118] flex items-start justify-center overflow-y-auto p-2 sm:p-3 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return;
        onClose();
      }}
    >
      <div
        ref={surfaceRef}
        style={surfaceStyle}
        className="ode-modal mt-1 flex max-h-[calc(100vh-0.75rem)] w-[min(96vw,96rem)] max-w-none flex-col overflow-hidden rounded-[24px] border border-[var(--ode-border-strong)] sm:mt-2"
      >
        <div
          className="ode-modal-drag-handle flex shrink-0 items-center justify-between border-b border-[var(--ode-border)] px-6 py-5"
          onPointerDown={handlePointerDown}
        >
          <h2 className="text-[1.5rem] font-semibold tracking-tight text-[var(--ode-accent)]">
            {t("project.settings_title")}
          </h2>
          <button type="button" className="ode-icon-btn h-10 w-10" onClick={onClose}>
            x
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          <WorkspaceManageCard
            t={t}
            projects={projects}
            activeProjectId={activeProjectId}
            defaultProjectId={defaultProjectId}
            workspaceNameInput={workspaceNameInput}
            workspaceLocalPathInput={workspaceLocalPathInput}
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
            onWorkspaceLocalPathInputChange={onWorkspaceLocalPathInputChange}
            onOpenCreateWorkspace={onOpenCreateWorkspace}
            onCancelCreateWorkspace={onCancelCreateWorkspace}
            onCreateWorkspace={onCreateWorkspace}
            onPickAndImportProjectFolder={onPickAndImportProjectFolder}
            onPickWorkspaceLocalFolder={onPickWorkspaceLocalFolder}
            onSetWorkspaceLocalPath={onSetWorkspaceLocalPath}
            onReSyncWorkspace={onReSyncWorkspace}
            onDeleteProjectWorkspace={onDeleteProjectWorkspace}
            onSetDefaultWorkspace={onSetDefaultWorkspace}
            onOpenWorkspaceFolderLocation={onOpenWorkspaceFolderLocation}
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
