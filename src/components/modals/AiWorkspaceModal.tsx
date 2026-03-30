import {
  AiCommandBar,
  type AiActivityItem,
  type AiCommandPlan,
  type AiCommandRequestOptions,
  type AiNodeContext,
  type AiNodeResponse,
  type AssistantSurface
} from "@/components/overlay/AiCommandBar";
import { AiMemoryReviewModal } from "@/components/modals/AiMemoryReviewModal";
import { DeliverableProposalModal } from "@/components/modals/DeliverableProposalModal";
import { IntegratedPlanPreviewModal } from "@/components/modals/IntegratedPlanPreviewModal";
import { WorkstreamWorkspacePreviewModal } from "@/components/modals/WorkstreamWorkspacePreviewModal";
import type { DocumentLanguageCode } from "@/lib/documentLanguage";
import type { LanguageCode, TranslationParams } from "@/lib/i18n";
import type {
  ODEDeliverableProposal,
  ODEIntegratedPlanProposal,
  ODEWorkstreamWorkspaceProposal
} from "@/lib/types";
import type { ApprovedIntegratedPlanMemoryEntry } from "@/lib/aiMemory";
import type { WBSNode } from "@/lib/aiService";

type TranslateFn = (key: string, params?: TranslationParams) => string;

type AssistantViewProps = {
  view: "assistant";
  open: boolean;
  simpleMode?: boolean;
  initialSurface?: AssistantSurface;
  t: TranslateFn;
  language: LanguageCode;
  languageCodes: LanguageCode[];
  activityItems: AiActivityItem[];
  nodeContext?: AiNodeContext | null;
  documentReview?: {
    open: boolean;
    documentName: string | null;
    summary: string | null;
    previewLines: string[];
    detectedDocumentLanguage: DocumentLanguageCode;
    translationMode: "source" | "auto" | "manual";
    manualTranslationLanguage: LanguageCode;
    resolvedTranslationLanguage: LanguageCode | null;
    translationWarningMessage?: string | null;
    isTranslationBusy?: boolean;
    confidence: number | null;
    treeProposal: {
      warningMessage: string | null;
      nodes: WBSNode[];
      valueSummary: string;
    } | null;
    isBusy: boolean;
    error: string | null;
  } | null;
  onClose: () => void;
  onDocumentTranslationModeChange: (mode: "source" | "auto" | "manual") => void;
  onDocumentManualTranslationLanguageChange: (language: LanguageCode) => void;
  onAskNode?: (requestText: string, options?: AiCommandRequestOptions) => Promise<AiNodeResponse>;
  onApplyNodePlan?: (
    requestText: string,
    answerText: string,
    options?: AiCommandRequestOptions
  ) => Promise<void>;
  onOpenNodeDeliverableProposal?: (requestText: string, options?: AiCommandRequestOptions) => Promise<void>;
  onOpenNodeIntegratedPlanProposal?: (requestText: string, options?: AiCommandRequestOptions) => Promise<void>;
  onAnalyze: (commandText: string, options?: AiCommandRequestOptions) => Promise<AiCommandPlan>;
  onExecute: (plan: AiCommandPlan) => Promise<void>;
  onExecuteDocumentReview?: (editedNodes: WBSNode[]) => Promise<void>;
  onClearActivity: () => void;
  showWindowControls?: boolean;
  isWindowMaximized?: boolean;
  onWindowMinimize?: () => void;
  onWindowToggleMaximize?: () => void;
};

type MemoryReviewViewProps = {
  view: "memory-review";
  open: boolean;
  t: TranslateFn;
  entries: ApprovedIntegratedPlanMemoryEntry[];
  onClose: () => void;
  onRemove: (entryId: string) => void;
  onClearAll: () => void;
};

type DeliverableProposalViewProps = {
  view: "deliverable-proposal";
  open: boolean;
  t: TranslateFn;
  proposal: ODEDeliverableProposal | null;
  nodeTitle: string | null;
  onClose: () => void;
  onConfirm: () => void;
  onChangeProposal: (proposal: ODEDeliverableProposal) => void;
};

type IntegratedPlanViewProps = {
  view: "integrated-plan";
  open: boolean;
  t: TranslateFn;
  proposal: ODEIntegratedPlanProposal | null;
  nodeTitle: string | null;
  onClose: () => void;
  onConfirm: () => void;
  onChangeProposal: (proposal: ODEIntegratedPlanProposal) => void;
};

type WorkstreamProposalViewProps = {
  view: "workstream-proposal";
  open: boolean;
  t: TranslateFn;
  proposal: ODEWorkstreamWorkspaceProposal | null;
  nodeTitle: string | null;
  deliverableTitle: string | null;
  onClose: () => void;
  onConfirm: () => void;
  onChangeProposal: (proposal: ODEWorkstreamWorkspaceProposal) => void;
};

export type AiWorkspaceModalProps =
  | AssistantViewProps
  | MemoryReviewViewProps
  | DeliverableProposalViewProps
  | IntegratedPlanViewProps
  | WorkstreamProposalViewProps;

export function AiWorkspaceModal(props: AiWorkspaceModalProps) {
  switch (props.view) {
    case "assistant":
      return (
        <AiCommandBar
          open={props.open}
          simpleMode={props.simpleMode}
          initialSurface={props.initialSurface}
          t={props.t}
          language={props.language}
          languageCodes={props.languageCodes}
          activityItems={props.activityItems}
          nodeContext={props.nodeContext}
          documentReview={props.documentReview}
          onClose={props.onClose}
          onDocumentTranslationModeChange={props.onDocumentTranslationModeChange}
          onDocumentManualTranslationLanguageChange={props.onDocumentManualTranslationLanguageChange}
          onAskNode={props.onAskNode}
          onApplyNodePlan={props.onApplyNodePlan}
          onOpenNodeDeliverableProposal={props.onOpenNodeDeliverableProposal}
          onOpenNodeIntegratedPlanProposal={props.onOpenNodeIntegratedPlanProposal}
          onAnalyze={props.onAnalyze}
          onExecute={props.onExecute}
          onExecuteDocumentReview={props.onExecuteDocumentReview}
          onClearActivity={props.onClearActivity}
          showWindowControls={props.showWindowControls}
          isWindowMaximized={props.isWindowMaximized}
          onWindowMinimize={props.onWindowMinimize}
          onWindowToggleMaximize={props.onWindowToggleMaximize}
        />
      );
    case "memory-review":
      return (
        <AiMemoryReviewModal
          open={props.open}
          t={props.t}
          entries={props.entries}
          onClose={props.onClose}
          onRemove={props.onRemove}
          onClearAll={props.onClearAll}
        />
      );
    case "deliverable-proposal":
      return (
        <DeliverableProposalModal
          open={props.open}
          t={props.t}
          proposal={props.proposal}
          nodeTitle={props.nodeTitle}
          onClose={props.onClose}
          onConfirm={props.onConfirm}
          onChangeProposal={props.onChangeProposal}
        />
      );
    case "integrated-plan":
      return (
        <IntegratedPlanPreviewModal
          open={props.open}
          t={props.t}
          proposal={props.proposal}
          nodeTitle={props.nodeTitle}
          onClose={props.onClose}
          onConfirm={props.onConfirm}
          onChangeProposal={props.onChangeProposal}
        />
      );
    case "workstream-proposal":
      return (
        <WorkstreamWorkspacePreviewModal
          open={props.open}
          t={props.t}
          proposal={props.proposal}
          nodeTitle={props.nodeTitle}
          deliverableTitle={props.deliverableTitle}
          onClose={props.onClose}
          onConfirm={props.onConfirm}
          onChangeProposal={props.onChangeProposal}
        />
      );
    default:
      return null;
  }
}
