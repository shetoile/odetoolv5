import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode
} from "react";
import {
  ClockGlyphSmall,
  OpenGlyphSmall,
  FileGlyphSmall,
  ImageGlyphSmall,
  NodeLinkGlyphSmall,
  PlusGlyphSmall,
  SparkGlyphSmall,
  TrashGlyphSmall
} from "@/components/Icons";
import { AiWorkspaceModal } from "@/components/modals/AiWorkspaceModal";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import { TextEditContextMenu, type TextEditContextMenuState } from "@/components/overlay/TextEditContextMenu";
import { useDraggableModalSurface } from "@/hooks/useDraggableModalSurface";
import { type LanguageCode, type TranslationParams } from "@/lib/i18n";
import { getMindMapTheme } from "@/lib/mindMapTheme";
import { getODENodeMetadata } from "@/lib/odePolicy";
import {
  ROOT_PARENT_ID,
  type AppNode,
  type ODEChantierMaturityLevel,
  type ODEChantierProfile,
  type ODEChantierSignoffState,
  type ODEChantierStatus,
  type ODEDeliverableProposal,
  type ODEExecutionTaskItem,
  type ODEIntegratedPlanProposal,
  type ODEStructuredDeliverable,
  type ScheduleStatus,
  type ODEWorkstreamSource,
  type ODEWorkstreamWorkspace,
  type ODEWorkstreamWorkspaceProposal,
  type ProjectSummary
} from "@/lib/types";
import { getDesktopMediaPreviewKind, resolveDesktopPreviewSrc } from "@/lib/iconSupport";
import { saveExportFile } from "@/lib/nodeService";
import { buildProcedureDocxBytes, buildProcedurePdfBytes } from "@/lib/procedureExport";
import {
  areChantierProfilesEqual,
  getChantierLinkedNADisplay,
  isChantierNode,
  isManualChantierNode,
  normalizeChantierProfile,
  readChantierProfile
} from "@/features/ode/chantierProfile";
import { isHiddenExecutionTaskNode } from "@/features/workspace/execution";
import { getSpellSuggestions } from "@/lib/spellcheckService";
import {
  buildProcedureSectionTree,
  decodeNodeLinkId,
  findProcedureWorkspaceRootId,
  getNodeBody,
  getProcedureInsightTemplate,
  getProcedureInsightDomainLabel,
  isReferenceNode,
  parseProcedureBlocks,
  parseProcedureInlineTokens,
  type ProcedureInsightDomain,
  type ProcedureSectionData
} from "@/lib/procedureDocument";
import {
  appendApprovedIntegratedPlanMemory,
  buildApprovedIntegratedPlanExamplesSummary,
  buildApprovedIntegratedPlanMemoryEntry,
  clearApprovedIntegratedPlanMemories,
  findRelevantApprovedIntegratedPlans,
  readApprovedIntegratedPlanMemories,
  removeApprovedIntegratedPlanMemory
} from "@/lib/aiMemory";
import { buildAiCapabilityGuidance, buildAiCapabilityPromptBlock } from "@/lib/aiCapabilityGuidance";
import { generateIntegratedPlanProposal } from "@/lib/integratedPlanAi";
import type { WBSResult } from "@/lib/aiService";
import { generateDeliverableProposal, generateWorkstreamTaskProposal } from "@/lib/workstreamAi";
import { buildExecutionTasksFromProposal, buildWorkstreamWorkspaceFromProposal } from "@/lib/workstreamWorkspace";

type TranslateFn = (key: string, params?: TranslationParams) => string;
type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
type ProcedureToneStyle = CSSProperties & Record<`--${string}`, string>;
type ProcedureExecutionTabKey = "tasks" | "data" | "notifications";
type ProcedureModalClipboard =
  | {
      kind: "deliverable";
      mode: "copy" | "cut";
      sourceId: string;
      payload: ODEStructuredDeliverable;
    }
  | {
      kind: "execution_item";
      mode: "copy" | "cut";
      deliverableId: string;
      tab: ProcedureExecutionTabKey;
      sourceKey: string;
      payload: ODEExecutionTaskItem | string;
    };

type ProcedureNodeLinkCandidate = {
  node: AppNode;
  workspaceRootId: string | null;
  workspaceName: string;
  pathLabel: string;
  isCurrentWorkspace: boolean;
  searchText: string;
};

type ProcedureLinkDialogState = {
  selectionStart: number;
  selectionEnd: number;
  label: string;
  href: string;
};

type DraftMentionState = {
  start: number;
  end: number;
  query: string;
};

type ProcedureChantierCopy = {
  steeringTab: string;
  sectionTitle: string;
  sectionHint: string;
  planningTitle: string;
  planningHint: string;
  portfolioCadenceTitle: string;
  portfolioCadenceHint: string;
  linkedNA: string;
  linkedNAEmpty: string;
  status: string;
  governanceTitle: string;
  governanceHint: string;
  traceabilityTitle: string;
  traceabilityHint: string;
  activity: string;
  activityPlaceholder: string;
  valueStatementLabel: string;
  valueStatementPlaceholder: string;
  qualityTarget: string;
  costTarget: string;
  delayTarget: string;
  targetPlaceholder: string;
  owner: string;
  ownerPlaceholder: string;
  planningWindow: string;
  planningWindowPlaceholder: string;
  reviewCadence: string;
  reviewCadencePlaceholder: string;
  quarterFocus: string;
  quarterFocusPlaceholder: string;
  cadenceMilestones: string;
  cadenceMilestonesPlaceholder: string;
  capacityPlan: string;
  capacityPlanPlaceholder: string;
  dependencies: string;
  dependenciesPlaceholder: string;
  resources: string;
  resourcesPlaceholder: string;
  responsibilityTitle: string;
  responsibilityHint: string;
  roleModel: string;
  roleModelPlaceholder: string;
  requiredSkills: string;
  requiredSkillsPlaceholder: string;
  peoplePlan: string;
  peoplePlanPlaceholder: string;
  indicators: string;
  indicatorsPlaceholder: string;
  evidencePlan: string;
  evidencePlanPlaceholder: string;
  signoffOwner: string;
  signoffOwnerPlaceholder: string;
  signoffState: string;
  signoffStateOptions: Array<{ value: ODEChantierSignoffState; label: string }>;
  acceptancePlan: string;
  acceptancePlanPlaceholder: string;
  closurePack: string;
  closurePackPlaceholder: string;
  decisionLog: string;
  decisionLogPlaceholder: string;
  approvalComment: string;
  approvalCommentPlaceholder: string;
  maturityTitle: string;
  maturityHint: string;
  maturityLevel: string;
  maturityLevelOptions: Array<{ value: ODEChantierMaturityLevel; label: string }>;
  transformationImpact: string;
  transformationImpactPlaceholder: string;
  adoptionNotes: string;
  adoptionNotesPlaceholder: string;
  closureSummary: string;
  closureSummaryPlaceholder: string;
  retex: string;
  retexPlaceholder: string;
  manualEnable: string;
  manualDisable: string;
  manualHint: string;
  manualDisableHint: string;
  statusOptions: Array<{ value: ODEChantierStatus; label: string }>;
};

type ProcedureSystemTabKey = "description" | "steering" | "deliverables";

interface ProcedureContentPanelProps {
  t: TranslateFn;
  language: LanguageCode;
  rootNode: AppNode | null;
  selectedNode: AppNode | null;
  byParent: Map<string, AppNode[]>;
  scopedNumbering: Map<string, string>;
  nodeLevelById: Map<string, number>;
  allNodes: AppNode[];
  projects: ProjectSummary[];
  activeProjectRootId: string | null;
  onSelectNode: (nodeId: string) => void | Promise<void>;
  onReviewFile: (nodeId: string) => void;
  onSaveNodeContent: (nodeId: string, text: string) => Promise<void>;
  onRenameNodeTitle: (nodeId: string, title: string) => Promise<void>;
  onSaveNodeDescription: (nodeId: string, description: string | null) => Promise<void>;
  onSaveNodeMeaning: (
    nodeId: string,
    meaning: {
      objective: string | null;
      deliverables: ODEStructuredDeliverable[];
      chantierProfile?: ODEChantierProfile | null;
    }
  ) => Promise<void>;
  onSetNodeChantierMode: (nodeId: string, enabled: boolean) => Promise<void>;
  onSaveNodeWorkstreamWorkspace: (
    nodeId: string,
    payload: {
      description: string | null;
      objective: string | null;
      deliverables: ODEStructuredDeliverable[];
      workspace: ODEWorkstreamWorkspace;
      workspaces?: ODEWorkstreamWorkspace[];
    }
  ) => Promise<void>;
  onApplyIntegratedStructure: (nodeId: string, result: WBSResult) => Promise<void>;
  executionQuickOpenRequestKey?: number;
  executionQuickOpenDeliverableId?: string | null;
  onOpenAssistant?: () => void;
  onActivateProcedureSurface: () => void;
  onOpenNodeContextMenu: (event: ReactMouseEvent<HTMLElement>, nodeId: string) => void;
  onOpenSurfaceContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
}

function normalizeExportFileName(value: string): string {
  const normalized = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.length > 0 ? normalized : "procedure";
}

function sanitizeProcedureLinkLabel(value: string, fallback: string): string {
  const normalized = value
    .replace(/[\r\n]+/g, " ")
    .replace(/[\[\]\(\)]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized) return normalized;
  return fallback
    .replace(/[\r\n]+/g, " ")
    .replace(/[\[\]\(\)]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getProcedureChantierCopy(language: LanguageCode): ProcedureChantierCopy {
  if (language === "fr") {
    return {
      steeringTab: "Pilotage",
      sectionTitle: "Cadre chantier",
      sectionHint: "Fixez le cadre de valeur, les cibles QCD et les reperes de pilotage du chantier.",
      planningTitle: "Cadence et capacite",
      planningHint: "Planifiez le rythme, la capacite et la fenetre de pilotage pour rendre le chantier tenable.",
      portfolioCadenceTitle: "Portefeuille et cadence",
      portfolioCadenceHint: "Cadrez le trimestre, les jalons et le rythme de pilotage pour la revue portefeuille.",
      linkedNA: "NA liee",
      linkedNAEmpty: "NA non definie",
      status: "Statut chantier",
      governanceTitle: "Gouvernance chantier",
      governanceHint: "Cadrez la decision, l'approbation et le retour d'experience pour que le chantier reste pilotable.",
      traceabilityTitle: "Traceabilite et cloture",
      traceabilityHint: "Gardez la chaine de preuve, le signoff et le pack de cloture visibles pour la revue.",
      activity: "Activite ciblee",
      activityPlaceholder: "Definir le perimetre ou l'activite metier concernee.",
      valueStatementLabel: "Valeur attendue",
      valueStatementPlaceholder: "Formulez la valeur metier attendue de ce chantier.",
      qualityTarget: "Cible qualite",
      costTarget: "Cible cout",
      delayTarget: "Cible delai",
      targetPlaceholder: "Resultat attendu",
      owner: "Pilote / responsable",
      ownerPlaceholder: "Nom du pilote, sponsor ou responsable operationnel.",
      planningWindow: "Fenetre / trimestre",
      planningWindowPlaceholder: "Ex. T2 2026, S1, cycle QCD, sprint de bascule...",
      reviewCadence: "Cadence de revue",
      reviewCadencePlaceholder: "Hebdo, quinzaine, mensuel, gate, rituel terrain...",
      quarterFocus: "Focal trimestre / cycle",
      quarterFocusPlaceholder: "Quel resultat portefeuille ou trimestre doit etre tenu ?",
      cadenceMilestones: "Jalons de cadence",
      cadenceMilestonesPlaceholder: "Revues cles, gates, jalons terrain, points de bascule...",
      capacityPlan: "Enveloppe capacite",
      capacityPlanPlaceholder: "Charge disponible, equipe mobilisee, besoin d'arbitrage, partenaires...",
      dependencies: "Dependances et arbitrages",
      dependenciesPlaceholder: "Prealables, interfaces, blocages attendus, decisions externes...",
      resources: "Ressources clefs",
      resourcesPlaceholder: "Equipes, roles, competences, capacite, partenaires...",
      responsibilityTitle: "Responsabilites et competences",
      responsibilityHint: "Rendez explicites les roles, competences et plans personnes necessaires pour tenir le chantier.",
      roleModel: "Modele de roles",
      roleModelPlaceholder: "Sponsor, pilote, terrain, support, validation, gouvernance...",
      requiredSkills: "Competences critiques",
      requiredSkillsPlaceholder: "Competences, metiers, expertises ou certifications mobilisees...",
      peoplePlan: "Plan personnes / GPEC",
      peoplePlanPlaceholder: "Disponibilites, renforts, montee en competence, remplacements, succession...",
      indicators: "Indicateurs de succes",
      indicatorsPlaceholder: "KPI, preuves, jalons ou signaux qui montreront que le chantier reussit.",
      evidencePlan: "Chaine de preuve",
      evidencePlanPlaceholder: "Quels documents, releves, preuves terrain ou traces valideront l'avancement ?",
      signoffOwner: "Responsable signoff",
      signoffOwnerPlaceholder: "Qui porte la validation finale ou intermediaire ?",
      signoffState: "Etat du signoff",
      signoffStateOptions: [
        { value: "not_started", label: "Non lance" },
        { value: "in_review", label: "En revue" },
        { value: "signed", label: "Signe" }
      ],
      acceptancePlan: "Signoff / acceptation",
      acceptancePlanPlaceholder: "Qui valide quoi, a quel moment, avec quel livrable de cloture ?",
      closurePack: "Pack de cloture",
      closurePackPlaceholder: "Quels livrables, preuves, syntheses ou annexes composent le pack de cloture ?",
      decisionLog: "Journal de decision",
      decisionLogPlaceholder: "Tracez les arbitrages, options retenues, pivots et points de pilotage.",
      approvalComment: "Gate / approbation",
      approvalCommentPlaceholder: "Qui a valide, sous quelles conditions, et quelle est la prochaine etape d'engagement.",
      maturityTitle: "Maturite et transformation",
      maturityHint: "Suivez l'adoption, l'impact transformation et le niveau de maturite atteint par le chantier.",
      maturityLevel: "Niveau de maturite",
      maturityLevelOptions: [
        { value: "emerging", label: "Emergent" },
        { value: "stabilizing", label: "Stabilisation" },
        { value: "scaling", label: "Extension" },
        { value: "institutionalized", label: "Institutionnalise" }
      ],
      transformationImpact: "Impact transformation",
      transformationImpactPlaceholder: "Quels standards, processus, routines ou outils sont modifies par ce chantier ?",
      adoptionNotes: "Adoption / conduite du changement",
      adoptionNotesPlaceholder: "Freins, relais, communication, formation, adoption terrain, feedback...",
      closureSummary: "Resume de cloture",
      closureSummaryPlaceholder: "A renseigner lors de la cloture: gains, ecarts, lecons apprises, suite.",
      retex: "RETEX",
      retexPlaceholder: "Capturez les enseignements, standards a mettre a jour et points a generaliser.",
      manualEnable: "Marquer comme chantier",
      manualDisable: "Retirer le mode chantier",
      manualHint: "Activez le mode chantier sur ce dossier pour tester les champs de gouvernance et les vues portefeuille.",
      manualDisableHint: "Ce chantier a ete marque manuellement pour test. Vous pouvez retirer ce mode a tout moment.",
      statusOptions: [
        { value: "draft", label: "Brouillon" },
        { value: "proposed", label: "Propose" },
        { value: "approved", label: "Approuve" },
        { value: "active", label: "Actif" },
        { value: "paused", label: "En pause" },
        { value: "closed", label: "Cloture" },
        { value: "archived", label: "Archive" }
      ]
    };
  }

  return {
    steeringTab: "Steering",
    sectionTitle: "Chantier frame",
    sectionHint: "Capture the value case, QCD targets, and steering markers for this chantier.",
    planningTitle: "Cadence and capacity",
    planningHint: "Plan the review rhythm, capacity envelope, and time window so the chantier stays executable.",
    portfolioCadenceTitle: "Portfolio and cadence",
    portfolioCadenceHint: "Frame the quarter, milestones, and steering rhythm so the chantier fits portfolio review.",
    linkedNA: "Linked NA",
    linkedNAEmpty: "No NA linked yet",
    status: "Chantier status",
    governanceTitle: "Chantier governance",
    governanceHint: "Track the decision path, approval gate, and lessons learned so the chantier stays governable.",
    traceabilityTitle: "Traceability and closure",
    traceabilityHint: "Keep the proof chain, signoff path, and closure pack visible for management review.",
    activity: "Activity scope",
    activityPlaceholder: "Describe the business activity or scope this chantier covers.",
    valueStatementLabel: "Value statement",
    valueStatementPlaceholder: "State the business value this chantier is expected to create.",
    qualityTarget: "Quality target",
    costTarget: "Cost target",
    delayTarget: "Delay target",
    targetPlaceholder: "Expected target",
    owner: "Owner / sponsor",
    ownerPlaceholder: "Name the chantier owner, sponsor, or operational lead.",
    planningWindow: "Planning window",
    planningWindowPlaceholder: "Example: Q2 2026, H1, rollout wave, operating cycle...",
    reviewCadence: "Review cadence",
    reviewCadencePlaceholder: "Weekly, biweekly, monthly, gate review, field ritual...",
    quarterFocus: "Quarter / cycle focus",
    quarterFocusPlaceholder: "Which portfolio or quarterly result must this chantier secure?",
    cadenceMilestones: "Cadence milestones",
    cadenceMilestonesPlaceholder: "Key reviews, gates, field milestones, cutovers, steering checkpoints...",
    capacityPlan: "Capacity envelope",
    capacityPlanPlaceholder: "Available effort, committed team, arbitration need, partners...",
    dependencies: "Dependencies and arbitration",
    dependenciesPlaceholder: "Prerequisites, interfaces, blockers, or external decisions needed...",
    resources: "Key resources",
    resourcesPlaceholder: "Teams, roles, skills, capacity, partners...",
    responsibilityTitle: "Responsibilities and skills",
    responsibilityHint: "Make the role model, critical skills, and staffing/GPEC plan explicit for the chantier.",
    roleModel: "Role model",
    roleModelPlaceholder: "Sponsor, owner, field lead, support, validation, governance...",
    requiredSkills: "Critical skills",
    requiredSkillsPlaceholder: "Skills, métiers, expertise, or certifications the chantier depends on...",
    peoplePlan: "People / GPEC plan",
    peoplePlanPlaceholder: "Availability, reinforcement, upskilling, replacements, succession, staffing choices...",
    indicators: "Success indicators",
    indicatorsPlaceholder: "KPIs, proof points, milestones, or signals that show the chantier is succeeding.",
    evidencePlan: "Evidence chain",
    evidencePlanPlaceholder: "Which proof, documents, field signals, or records will validate the chantier?",
    signoffOwner: "Signoff owner",
    signoffOwnerPlaceholder: "Who owns the final or intermediate signoff?",
    signoffState: "Signoff state",
    signoffStateOptions: [
      { value: "not_started", label: "Not started" },
      { value: "in_review", label: "In review" },
      { value: "signed", label: "Signed" }
    ],
    acceptancePlan: "Signoff / acceptance",
    acceptancePlanPlaceholder: "Who signs off what, when, and with which closure pack?",
    closurePack: "Closure pack",
    closurePackPlaceholder: "Which deliverables, proof, summaries, or annexes make up the closure pack?",
    decisionLog: "Decision log",
    decisionLogPlaceholder: "Record tradeoffs, steering decisions, pivots, and important governance calls.",
    approvalComment: "Approval gate",
    approvalCommentPlaceholder: "Capture who approved it, under which conditions, and what unlocks the next step.",
    maturityTitle: "Maturity and transformation",
    maturityHint: "Track adoption, transformation impact, and the maturity level the chantier has reached.",
    maturityLevel: "Maturity level",
    maturityLevelOptions: [
      { value: "emerging", label: "Emerging" },
      { value: "stabilizing", label: "Stabilizing" },
      { value: "scaling", label: "Scaling" },
      { value: "institutionalized", label: "Institutionalized" }
    ],
    transformationImpact: "Transformation impact",
    transformationImpactPlaceholder: "Which standards, processes, routines, or tools does this chantier reshape?",
    adoptionNotes: "Adoption / change notes",
    adoptionNotesPlaceholder: "Resistance, champions, communication, training, field adoption, and feedback...",
    closureSummary: "Closure summary",
    closureSummaryPlaceholder: "To fill at closure: gains, gaps, lessons learned, and next step.",
    retex: "RETEX",
    retexPlaceholder: "Capture lessons learned, standards to update, and what should be generalized.",
    manualEnable: "Mark as chantier",
    manualDisable: "Remove chantier mode",
    manualHint: "Turn this folder into a chantier so you can test governance fields and portfolio views immediately.",
    manualDisableHint: "This chantier was marked manually for testing, so you can remove the mode at any time.",
    statusOptions: [
      { value: "draft", label: "Draft" },
      { value: "proposed", label: "Proposed" },
      { value: "approved", label: "Approved" },
      { value: "active", label: "Active" },
      { value: "paused", label: "Paused" },
      { value: "closed", label: "Closed" },
      { value: "archived", label: "Archived" }
    ]
  };
}

function shouldIgnoreProcedureNodeContextMenu(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("[data-ode-procedure-ignore-context='true']"));
}

function isProcedureSpellTokenChar(char: string): boolean {
  return /[\p{L}\p{M}'â€™-]/u.test(char);
}

function resolveProcedureSpellTarget(
  value: string,
  selectionStart: number,
  selectionEnd: number
): { word: string; start: number; end: number } | null {
  if (selectionEnd > selectionStart) {
    const selectedWord = value.slice(selectionStart, selectionEnd).trim();
    if (/^[\p{L}\p{M}'â€™-]{2,}$/u.test(selectedWord)) {
      return {
        word: selectedWord,
        start: selectionStart,
        end: selectionEnd
      };
    }
  }

  let start = Math.max(0, selectionStart);
  let end = Math.max(start, selectionStart);
  while (start > 0 && isProcedureSpellTokenChar(value.charAt(start - 1))) {
    start -= 1;
  }
  while (end < value.length && isProcedureSpellTokenChar(value.charAt(end))) {
    end += 1;
  }

  if (end <= start) return null;
  const word = value.slice(start, end).trim();
  if (!/^[\p{L}\p{M}'â€™-]{2,}$/u.test(word)) return null;
  return { word, start, end };
}

function buildProcedureToneStyle(level: number): ProcedureToneStyle {
  const theme = getMindMapTheme(level);
  return {
    "--ode-procedure-accent": theme.accent,
    "--ode-procedure-border": theme.border,
    "--ode-procedure-glow": theme.glow,
    "--ode-procedure-chip-bg": theme.chipBg,
    "--ode-procedure-chip-border": theme.chipBorder,
    "--ode-procedure-meta-bg": theme.metaBg,
    "--ode-procedure-meta-border": theme.metaBorder,
    "--ode-procedure-connector": theme.connector
  };
}

function getProcedureNodeLevel(nodeId: string, nodeLevelById: Map<string, number>, fallbackDepth: number): number {
  return nodeLevelById.get(nodeId) ?? Math.max(1, fallbackDepth + 1);
}

function applyDraftToSectionTree(
  section: ProcedureSectionData,
  nodeId: string | null,
  titleDraft: string,
  draft: string
): ProcedureSectionData {
  const isTarget = nodeId && section.node.id === nodeId;
  const nextName = isTarget ? titleDraft.trim() || section.node.name : section.node.name;
  const nextBody = isTarget ? draft : section.body;

  return {
    ...section,
    node: isTarget
      ? {
          ...section.node,
          name: nextName,
          content: nextBody
        }
      : section.node,
    body: nextBody,
    children: section.children.map((child) => applyDraftToSectionTree(child, nodeId, titleDraft, draft))
  };
}

function buildSectionPath(nodeId: string, nodeById: Map<string, AppNode>, rootNodeId: string): AppNode[] {
  const path: AppNode[] = [];
  const visited = new Set<string>();
  let current = nodeById.get(nodeId) ?? null;

  while (current) {
    path.push(current);
    if (current.id === rootNodeId) break;
    if (visited.has(current.id)) break;
    visited.add(current.id);
    if (!current.parentId || current.parentId === ROOT_PARENT_ID) break;
    current = nodeById.get(current.parentId) ?? null;
  }

  return path.reverse();
}

function findSectionById(section: ProcedureSectionData, nodeId: string): ProcedureSectionData | null {
  if (section.node.id === nodeId) return section;
  for (const child of section.children) {
    const match = findSectionById(child, nodeId);
    if (match) return match;
  }
  return null;
}

function flattenProcedureSections(section: ProcedureSectionData): ProcedureSectionData[] {
  const sections = [section];
  for (const child of section.children) {
    sections.push(...flattenProcedureSections(child));
  }
  return sections;
}

function readProcedureObjective(node: AppNode | null): string {
  const value = node?.properties?.odeObjective;
  return typeof value === "string" ? value : "";
}

function readProcedureDeliverables(node: AppNode | null): string[] {
  const raw = node?.properties?.odeExpectedDeliverables;
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
  }
  if (typeof raw === "string") {
    return raw
      .split(/\r?\n|;/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
}

let procedureDeliverableIdCounter = 0;
function createProcedureDeliverableId(): string {
  procedureDeliverableIdCounter += 1;
  return `procedure-deliverable-${Date.now()}-${procedureDeliverableIdCounter}`;
}

function buildIndexedProcedureTitle(baseLabel: string, existingTitles: Iterable<string>): string {
  const normalizedBase = baseLabel.trim() || "Item";
  const existing = new Set(
    Array.from(existingTitles)
      .map((title) => title.trim().toLowerCase())
      .filter((title) => title.length > 0)
  );
  let index = 1;
  let candidate = `${normalizedBase} ${index}`;
  while (existing.has(candidate.trim().toLowerCase())) {
    index += 1;
    candidate = `${normalizedBase} ${index}`;
  }
  return candidate;
}

function getSavedMistralApiKey(): string | null {
  try {
    const raw = localStorage.getItem("odetool.ai.keys.v1");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { mistralKeys?: string[] };
    if (!parsed.mistralKeys || parsed.mistralKeys.length === 0) return null;
    return parsed.mistralKeys.find((item) => item.trim().length > 0)?.trim() ?? null;
  } catch {
    return null;
  }
}

function trimExcerpt(value: string, limit = 420): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit).trim()}...`;
}

function collectProcedureWorkstreamSources(options: {
  node: AppNode;
  byParent: Map<string, AppNode[]>;
  title: string;
  objective: string;
  description: string;
  deliverable: ODEStructuredDeliverable;
}): ODEWorkstreamSource[] {
  const { node, byParent, title, objective, description, deliverable } = options;
  const sources: ODEWorkstreamSource[] = [];

  if (objective.trim().length > 0) {
    sources.push({
      sourceId: "objective",
      label: `${title || node.name} objective`,
      kind: "objective",
      sourceNodeId: node.id,
      excerpt: trimExcerpt(objective)
    });
  }

  if (description.trim().length > 0) {
    sources.push({
      sourceId: "description",
      label: `${title || node.name} description`,
      kind: "description",
      sourceNodeId: node.id,
      excerpt: trimExcerpt(description)
    });
  }

  if (deliverable.title.trim().length > 0) {
    sources.push({
      sourceId: "deliverable",
      label: deliverable.title.trim(),
      kind: "deliverable",
      sourceNodeId: node.id,
      excerpt:
        deliverable.tasks.length > 0
          ? trimExcerpt(deliverable.tasks.map((task) => task.title).join("; "), 240)
          : null
    });
  }

  const visited = new Set<string>([node.id]);
  const queue = [...(byParent.get(node.id) ?? [])];
  const descendantLimit = 6;

  while (queue.length > 0 && sources.length < 3 + descendantLimit) {
    const current = queue.shift() ?? null;
    if (!current || visited.has(current.id)) continue;
    visited.add(current.id);
    if (isHiddenExecutionTaskNode(current)) continue;

    const excerpt = trimExcerpt(getNodeBody(current));
    const isDocument = current.type === "file";
    const isUsefulText = excerpt.length > 0;
    if (current.id !== node.id && (isDocument || isUsefulText)) {
      sources.push({
        sourceId: `node-${current.id}`,
        label: current.name,
        kind: isDocument ? "document" : "node",
        sourceNodeId: current.id,
        excerpt: excerpt.length > 0 ? excerpt : null
      });
    }

    const children = byParent.get(current.id) ?? [];
    for (const child of children) {
      if (!visited.has(child.id)) queue.push(child);
    }
  }

  return sources;
}

function collectProcedureDeliverableSources(options: {
  node: AppNode;
  byParent: Map<string, AppNode[]>;
  title: string;
  description: string;
}): ODEWorkstreamSource[] {
  const { node, byParent, title, description } = options;
  const sources: ODEWorkstreamSource[] = [];

  if (description.trim().length > 0) {
    sources.push({
      sourceId: "description",
      label: `${title || node.name} description`,
      kind: "description",
      sourceNodeId: node.id,
      excerpt: trimExcerpt(description)
    });
  }

  const visited = new Set<string>([node.id]);
  const queue = [...(byParent.get(node.id) ?? [])];
  const descendantLimit = 6;

  while (queue.length > 0 && sources.length < 1 + descendantLimit) {
    const current = queue.shift() ?? null;
    if (!current || visited.has(current.id)) continue;
    visited.add(current.id);
    if (isHiddenExecutionTaskNode(current)) continue;

    const excerpt = trimExcerpt(getNodeBody(current));
    const isDocument = current.type === "file";
    const isUsefulText = excerpt.length > 0;
    if (current.id !== node.id && (isDocument || isUsefulText)) {
      sources.push({
        sourceId: `node-${current.id}`,
        label: current.name,
        kind: isDocument ? "document" : "node",
        sourceNodeId: current.id,
        excerpt: excerpt.length > 0 ? excerpt : null
      });
    }

    const children = byParent.get(current.id) ?? [];
    for (const child of children) {
      if (!visited.has(child.id)) queue.push(child);
    }
  }

  return sources;
}

function normalizeProcedureStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

let procedureTaskIdCounter = 0;
function createProcedureTaskId(): string {
  procedureTaskIdCounter += 1;
  return `procedure-task-${Date.now()}-${procedureTaskIdCounter}`;
}

function cloneProcedureTaskItem(task: ODEExecutionTaskItem): ODEExecutionTaskItem {
  return {
    ...task,
    id: createProcedureTaskId()
  };
}

function cloneProcedureDeliverable(deliverable: ODEStructuredDeliverable): ODEStructuredDeliverable {
  return {
    id: createProcedureDeliverableId(),
    title: deliverable.title,
    tasks: deliverable.tasks.map((task) => cloneProcedureTaskItem(task)),
    notifications: [...deliverable.notifications],
    data: [...deliverable.data]
  };
}

function getProcedureExecutionItemKey(
  tab: ProcedureExecutionTabKey,
  entry: ODEExecutionTaskItem | string,
  index: number
): string {
  if (tab === "tasks") {
    return (entry as ODEExecutionTaskItem).id;
  }
  return `${tab}-${index}`;
}

function normalizeProcedureTaskStatus(value: unknown): ScheduleStatus {
  if (value === "active" || value === "blocked" || value === "done") return value;
  return "planned";
}

function normalizeProcedureIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function normalizeProcedureTaskText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

type ProcedureExecutionTaskSnapshot = {
  ownerName?: string | null;
  dueDate?: string | null;
  status?: ScheduleStatus | null;
  flagged?: boolean | null;
  note?: string | null;
};

function buildProcedureTaskItem(
  record: {
    id: string;
    title: string;
    ownerName?: string | null;
    dueDate?: string | null;
    status?: ScheduleStatus | null;
    flagged?: boolean | null;
    note?: string | null;
  }
): ODEExecutionTaskItem {
  return {
    id: record.id,
    title: record.title,
    ownerName: record.ownerName ?? null,
    dueDate: record.dueDate ?? null,
    status: record.status ?? "planned",
    flagged: record.flagged === true,
    note: record.note ?? null
  };
}

function trimProcedureTaskItem(task: ODEExecutionTaskItem): ODEExecutionTaskItem | null {
  const title = task.title.trim();
  if (!title) return null;
  return buildProcedureTaskItem({
    id: task.id,
    title,
    ownerName: normalizeProcedureTaskText(task.ownerName),
    dueDate: normalizeProcedureIsoDate(task.dueDate),
    status: task.status ?? "planned",
    flagged: task.flagged === true,
    note: normalizeProcedureTaskText(task.note)
  });
}

function readProcedureExecutionTaskSnapshot(node: AppNode): ProcedureExecutionTaskSnapshot {
  const rawSchedule = node.properties?.timelineSchedule;
  const scheduleRecord = rawSchedule && typeof rawSchedule === "object" ? (rawSchedule as Record<string, unknown>) : null;
  const scheduleAssignees = Array.isArray(scheduleRecord?.assignees)
    ? scheduleRecord.assignees
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0)
    : [];
  const schedulePriority = typeof scheduleRecord?.priority === "string" ? scheduleRecord.priority.trim().toLowerCase() : "";
  const scheduleStatusRaw = typeof scheduleRecord?.status === "string" ? scheduleRecord.status.trim().toLowerCase() : "";
  const scheduleStatus =
    scheduleStatusRaw === "planned" || scheduleStatusRaw === "active" || scheduleStatusRaw === "blocked" || scheduleStatusRaw === "done"
      ? (scheduleStatusRaw as ScheduleStatus)
      : null;

  return {
    ownerName:
      normalizeProcedureTaskText(node.properties?.odeExecutionTaskOwnerName) ??
      (scheduleAssignees.length > 0 ? scheduleAssignees.join(", ") : null),
    dueDate:
      normalizeProcedureIsoDate(node.properties?.odeExecutionTaskDueDate) ??
      normalizeProcedureIsoDate(scheduleRecord?.endDate) ??
      normalizeProcedureIsoDate(scheduleRecord?.startDate),
    status:
      typeof node.properties?.odeExecutionTaskStatus === "string"
        ? normalizeProcedureTaskStatus(node.properties.odeExecutionTaskStatus)
        : scheduleStatus,
    flagged:
      typeof node.properties?.odeExecutionTaskFlagged === "boolean"
        ? node.properties.odeExecutionTaskFlagged
        : schedulePriority === "high" || schedulePriority === "urgent"
          ? true
          : scheduleRecord
            ? false
            : null,
    note: normalizeProcedureTaskText(node.properties?.odeExecutionTaskNote) ?? normalizeProcedureTaskText(node.description)
  };
}

function normalizeProcedureTaskList(value: unknown): ODEExecutionTaskItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") {
        const title = item.trim();
        return title
          ? buildProcedureTaskItem({
              id: createProcedureTaskId(),
              title
            })
          : null;
      }
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const title = typeof record.title === "string" ? record.title.trim() : "";
      if (!title) return null;
      return buildProcedureTaskItem({
        id: typeof record.id === "string" && record.id.trim().length > 0 ? record.id.trim() : createProcedureTaskId(),
        title,
        ownerName: normalizeProcedureTaskText(record.ownerName),
        dueDate: normalizeProcedureIsoDate(record.dueDate),
        status:
          typeof record.status === "string" || record.status === "planned"
            ? normalizeProcedureTaskStatus(record.status)
            : null,
        flagged: record.flagged === true,
        note: normalizeProcedureTaskText(record.note)
      });
    })
    .filter((item): item is ODEExecutionTaskItem => Boolean(item));
}

function normalizeProcedureStructuredDeliverable(raw: unknown, fallbackTitle = ""): ODEStructuredDeliverable {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const title =
    (typeof record?.title === "string" ? record.title : fallbackTitle)
      .trim();
  return {
    id:
      typeof record?.id === "string" && record.id.trim().length > 0
        ? record.id.trim()
        : createProcedureDeliverableId(),
    title,
    tasks: normalizeProcedureTaskList(record?.tasks),
    notifications: normalizeProcedureStringList(record?.notifications),
    data: normalizeProcedureStringList(record?.data)
  };
}

function isProcedureHiddenExecutionTaskNode(node: AppNode | null | undefined): boolean {
  return Boolean(node && node.type === "task" && node.properties?.odeExecutionTask === true);
}

function readProcedureExecutionTaskMeta(
  node: AppNode | null | undefined
): { taskId: string; deliverableId: string; ownerNodeId: string } | null {
  if (!isProcedureHiddenExecutionTaskNode(node)) return null;
  const resolvedNode = node as AppNode;
  const taskId =
    typeof resolvedNode.properties?.odeExecutionTaskId === "string" ? resolvedNode.properties.odeExecutionTaskId.trim() : "";
  const deliverableId =
    typeof resolvedNode.properties?.odeExecutionDeliverableId === "string"
      ? resolvedNode.properties.odeExecutionDeliverableId.trim()
      : "";
  const ownerNodeId =
    typeof resolvedNode.properties?.odeExecutionOwnerNodeId === "string"
      ? resolvedNode.properties.odeExecutionOwnerNodeId.trim()
      : "";
  if (!taskId || !deliverableId || !ownerNodeId) return null;
  return { taskId, deliverableId, ownerNodeId };
}

function readProcedureStructuredDeliverables(node: AppNode | null, allNodes: AppNode[] = []): ODEStructuredDeliverable[] {
  const raw = node?.properties?.odeStructuredDeliverables;
  const deliverables = Array.isArray(raw)
    ? raw
        .map((item) => normalizeProcedureStructuredDeliverable(item))
        .filter((deliverable) => deliverable.title.length > 0)
    : readProcedureDeliverables(node).map((title) =>
        normalizeProcedureStructuredDeliverable({ title, tasks: [], notifications: [], data: [] }, title)
      );

  if (!node || allNodes.length === 0) return deliverables;

  const deliverableById = new Map(
    deliverables.map((deliverable) => [
      deliverable.id,
      {
        ...deliverable,
        tasks: [...deliverable.tasks],
        notifications: [...deliverable.notifications],
        data: [...deliverable.data]
      }
    ])
  );
  const mergedDeliverables = Array.from(deliverableById.values());

  allNodes
    .map((candidate) => ({ candidate, meta: readProcedureExecutionTaskMeta(candidate) }))
    .filter(
      (
        entry
      ): entry is {
        candidate: AppNode;
        meta: { taskId: string; deliverableId: string; ownerNodeId: string };
      } => Boolean(entry.meta && entry.meta.ownerNodeId === node.id)
    )
    .sort((left, right) => {
      const leftOrder =
        typeof left.candidate.properties?.odeExecutionTaskOrder === "number"
          ? left.candidate.properties.odeExecutionTaskOrder
          : Number.MAX_SAFE_INTEGER;
      const rightOrder =
        typeof right.candidate.properties?.odeExecutionTaskOrder === "number"
          ? right.candidate.properties.odeExecutionTaskOrder
          : Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.candidate.name.localeCompare(right.candidate.name, undefined, { sensitivity: "base", numeric: true });
    })
    .forEach(({ candidate, meta }) => {
      const fallbackDeliverableTitle =
        typeof candidate.properties?.odeExecutionDeliverableTitle === "string"
          ? candidate.properties.odeExecutionDeliverableTitle.trim()
          : "";
      let deliverable = deliverableById.get(meta.deliverableId);
      if (!deliverable) {
        const fallbackTitle = fallbackDeliverableTitle || "Deliverable";
        deliverable = normalizeProcedureStructuredDeliverable(
          {
            id: meta.deliverableId,
            title: fallbackTitle
          },
          fallbackTitle
        );
        deliverableById.set(deliverable.id, deliverable);
        mergedDeliverables.push(deliverable);
      }
      const nextTitle =
        typeof candidate.properties?.odeExecutionTaskTitle === "string" && candidate.properties.odeExecutionTaskTitle.trim().length > 0
          ? candidate.properties.odeExecutionTaskTitle.trim()
          : candidate.name.trim();
      if (!nextTitle) return;
      const existingTaskIndex = deliverable.tasks.findIndex((task) => task.id === meta.taskId);
      const existingTask = existingTaskIndex >= 0 ? deliverable.tasks[existingTaskIndex] : null;
      const taskSnapshot = readProcedureExecutionTaskSnapshot(candidate);
      const nextTask: ODEExecutionTaskItem = buildProcedureTaskItem({
        id: meta.taskId,
        title: nextTitle,
        ownerName: taskSnapshot.ownerName ?? existingTask?.ownerName ?? null,
        dueDate: taskSnapshot.dueDate ?? existingTask?.dueDate ?? null,
        status: taskSnapshot.status ?? existingTask?.status ?? "planned",
        flagged: taskSnapshot.flagged ?? existingTask?.flagged ?? false,
        note: taskSnapshot.note ?? existingTask?.note ?? null
      });
      if (existingTaskIndex >= 0) {
        deliverable.tasks[existingTaskIndex] = nextTask;
      } else {
        deliverable.tasks.push(nextTask);
      }
    });

  return mergedDeliverables;
}

function buildProcedureExecutionTaskSignature(node: AppNode | null, allNodes: AppNode[]): string {
  if (!node) return "";
  return allNodes
    .map((candidate) => ({ candidate, meta: readProcedureExecutionTaskMeta(candidate) }))
    .filter(
      (
        entry
      ): entry is {
        candidate: AppNode;
        meta: { taskId: string; deliverableId: string; ownerNodeId: string };
      } => Boolean(entry.meta && entry.meta.ownerNodeId === node.id)
    )
    .map(
      ({ candidate, meta }) =>
        `${meta.deliverableId}|${meta.taskId}|${candidate.name}|${candidate.updatedAt ?? 0}|${
          typeof candidate.properties?.odeExecutionTaskOrder === "number" ? candidate.properties.odeExecutionTaskOrder : ""
        }`
    )
    .sort()
    .join("||");
}

function areProcedureListsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((item, index) => item === right[index]);
}

function areProcedureTaskListsEqual(left: ODEExecutionTaskItem[], right: ODEExecutionTaskItem[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((item, index) => {
    const other = right[index];
    if (!other) return false;
    return (
      item.id === other.id &&
      item.title === other.title &&
      (item.ownerName ?? null) === (other.ownerName ?? null) &&
      (item.dueDate ?? null) === (other.dueDate ?? null) &&
      (item.status ?? "planned") === (other.status ?? "planned") &&
      (item.flagged === true) === (other.flagged === true) &&
      (item.note ?? null) === (other.note ?? null)
    );
  });
}

function areProcedureStructuredDeliverablesEqual(
  left: ODEStructuredDeliverable[],
  right: ODEStructuredDeliverable[]
): boolean {
  if (left.length !== right.length) return false;
  return left.every((deliverable, index) => {
    const other = right[index];
    if (!other) return false;
    return (
      deliverable.title === other.title &&
      areProcedureTaskListsEqual(deliverable.tasks, other.tasks) &&
      areProcedureListsEqual(deliverable.notifications, other.notifications) &&
      areProcedureListsEqual(deliverable.data, other.data)
    );
  });
}

function normalizeExternalHref(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

function resolveDraftMention(value: string, selectionStart: number, selectionEnd: number): DraftMentionState | null {
  if (selectionStart !== selectionEnd) return null;
  let index = selectionStart - 1;
  while (index >= 0) {
    const char = value.charAt(index);
    if (char === "@") break;
    if (/\s|[\[\]\(\)`>]/.test(char)) return null;
    index -= 1;
  }
  if (index < 0 || value.charAt(index) !== "@") return null;
  if (index > 0 && /[\p{L}\p{N}_-]/u.test(value.charAt(index - 1))) return null;
  const query = value.slice(index + 1, selectionStart);
  if (/[\s\[\]\(\)`>]/.test(query)) return null;
  return {
    start: index,
    end: selectionStart,
    query
  };
}

function renderInlineTokens(
  text: string,
  nodeById: Map<string, AppNode>,
  onSelectNode: (nodeId: string) => void | Promise<void>,
  onReviewFile: (nodeId: string) => void,
  keyPrefix: string
): ReactNode[] {
  const pattern = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|_([^_]+)_|\*([^*]+)\*)/;
  const match = pattern.exec(text);
  if (!match) return [text];

  const nodes: ReactNode[] = [];
  const [matchedValue] = match;
  const matchIndex = match.index ?? 0;
  const before = text.slice(0, matchIndex);
  if (before) nodes.push(before);

  if (match[2] !== undefined && match[3] !== undefined) {
    const label = match[2] || match[3];
    const href = match[3].trim();

    if (href.startsWith("ode://node/")) {
      const nodeId = decodeNodeLinkId(href);
      const linkedNode = nodeById.get(nodeId);
      nodes.push(
        <button
          key={`${keyPrefix}-node-${matchIndex}`}
          type="button"
          className={`inline border-none bg-transparent p-0 align-baseline text-left text-[0.98em] underline decoration-[rgba(110,211,255,0.55)] underline-offset-4 transition ${
            linkedNode
              ? "text-[var(--ode-accent)] hover:text-white"
              : "text-[#ffb0b0] decoration-[rgba(255,176,176,0.5)]"
          }`}
          onClick={(event) => {
            event.stopPropagation();
            if (linkedNode) {
              void onSelectNode(nodeId);
            }
          }}
          onDoubleClick={(event) => {
            event.stopPropagation();
            if (linkedNode?.type === "file") {
              onReviewFile(nodeId);
            }
          }}
          disabled={!linkedNode}
        >
          <span>{label || linkedNode?.name || nodeId}</span>
        </button>
      );
    } else {
      nodes.push(
        <a
          key={`${keyPrefix}-link-${matchIndex}`}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-[var(--ode-accent)] underline decoration-[rgba(110,211,255,0.55)] underline-offset-4 transition hover:text-white"
          onClick={(event) => event.stopPropagation()}
        >
          {label}
        </a>
      );
    }
  } else if (match[4] !== undefined) {
    nodes.push(
      <strong key={`${keyPrefix}-bold-${matchIndex}`} className="font-semibold text-[var(--ode-text)]">
        {match[4]}
      </strong>
    );
  } else {
    const italicValue = match[5] ?? match[6] ?? "";
    nodes.push(
      <em key={`${keyPrefix}-italic-${matchIndex}`} className="italic text-[var(--ode-text)]">
        {italicValue}
      </em>
    );
  }

  const after = text.slice(matchIndex + matchedValue.length);
  if (after) {
    nodes.push(...renderInlineTokens(after, nodeById, onSelectNode, onReviewFile, `${keyPrefix}-${matchIndex}`));
  }

  return nodes;
}

function renderProcedureBlocks(
  text: string,
  nodeById: Map<string, AppNode>,
  onSelectNode: (nodeId: string) => void | Promise<void>,
  onReviewFile: (nodeId: string) => void,
  emptyLabel: string,
  showEmptyState = true
) {
  const trimmed = text.trim();
  if (!trimmed) {
    return showEmptyState ? <span className="italic text-[var(--ode-text-muted)]">{emptyLabel}</span> : null;
  }

  return parseProcedureBlocks(text).map((block, blockIndex) => {
    if (block.type === "heading") {
      return (
        <div
          key={`block-${blockIndex}`}
          className={
            block.level === 2
              ? "text-[1.45rem] font-semibold tracking-[-0.03em] text-[var(--ode-text)]"
              : "text-[1.15rem] font-semibold tracking-[-0.02em] text-[var(--ode-text)]"
          }
        >
          {renderInlineTokens(block.text, nodeById, onSelectNode, onReviewFile, `h-${blockIndex}`)}
        </div>
      );
    }

    if (block.type === "bullets") {
      return (
        <ul key={`block-${blockIndex}`} className="ml-5 list-disc space-y-1 text-[1rem] leading-7 text-[var(--ode-text-dim)]">
          {block.items.map((item, itemIndex) => (
            <li key={`bullet-${blockIndex}-${itemIndex}`}>
              {renderInlineTokens(item, nodeById, onSelectNode, onReviewFile, `b-${blockIndex}-${itemIndex}`)}
            </li>
          ))}
        </ul>
      );
    }

    if (block.type === "numbers") {
      return (
        <ol key={`block-${blockIndex}`} className="ml-5 list-decimal space-y-1 text-[1rem] leading-7 text-[var(--ode-text-dim)]">
          {block.items.map((item, itemIndex) => (
            <li key={`number-${blockIndex}-${itemIndex}`}>
              {renderInlineTokens(item, nodeById, onSelectNode, onReviewFile, `n-${blockIndex}-${itemIndex}`)}
            </li>
          ))}
        </ol>
      );
    }

    if (block.type === "quote") {
      return (
        <div
          key={`block-${blockIndex}`}
          className="rounded-[20px] border border-[rgba(110,211,255,0.2)] bg-[linear-gradient(135deg,rgba(8,37,58,0.82),rgba(4,22,37,0.94))] px-4 py-4 text-[0.98rem] leading-7 text-[var(--ode-text)]"
        >
          <div className="mb-2 text-[1.8rem] leading-none text-[var(--ode-accent)]">“</div>
          <blockquote className="pl-1 italic">
            {block.lines.map((line, lineIndex) => (
              <Fragment key={`quote-${blockIndex}-${lineIndex}`}>
                {lineIndex > 0 ? <br /> : null}
                {renderInlineTokens(line, nodeById, onSelectNode, onReviewFile, `q-${blockIndex}-${lineIndex}`)}
              </Fragment>
            ))}
          </blockquote>
          <div className="mt-2 text-right text-[1.8rem] leading-none text-[var(--ode-accent)]">”</div>
        </div>
      );
    }

    if (block.type === "code") {
      return (
        <pre
          key={`block-${blockIndex}`}
          className="overflow-x-auto rounded-[18px] border border-[rgba(110,211,255,0.18)] bg-[rgba(8,19,31,0.92)] px-4 py-3 font-mono text-[0.84rem] leading-6 text-[#cfeaff]"
        >
          {block.language ? (
            <div className="mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-[var(--ode-accent)]">
              {block.language}
            </div>
          ) : null}
          <code>{block.code}</code>
        </pre>
      );
    }

    if (block.type === "divider") {
      return <div key={`block-${blockIndex}`} className="my-2 border-t border-[rgba(110,211,255,0.22)]" />;
    }

    if (block.type === "insight") {
      return (
        <div
          key={`block-${blockIndex}`}
          className="rounded-[20px] border border-[rgba(110,211,255,0.2)] bg-[linear-gradient(135deg,rgba(10,47,74,0.84),rgba(6,26,42,0.92))] px-4 py-4"
        >
          <div className="mb-2 text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-accent)]">
            {getProcedureInsightDomainLabel(block.domain)}
          </div>
          <div className="space-y-2 text-[0.94rem] leading-7 text-[var(--ode-text)]">
            {block.lines.map((line, lineIndex) => (
              <p key={`insight-${blockIndex}-${lineIndex}`}>
                {renderInlineTokens(line, nodeById, onSelectNode, onReviewFile, `i-${blockIndex}-${lineIndex}`)}
              </p>
            ))}
          </div>
        </div>
      );
    }

    return (
      <p key={`block-${blockIndex}`} className="text-[1rem] leading-8 text-[var(--ode-text-dim)]">
        {block.lines.map((line, lineIndex) => (
          <Fragment key={`line-${blockIndex}-${lineIndex}`}>
            {lineIndex > 0 ? <br /> : null}
            {renderInlineTokens(line, nodeById, onSelectNode, onReviewFile, `p-${blockIndex}-${lineIndex}`)}
          </Fragment>
        ))}
      </p>
    );
  });
}

function ProcedureInlineReferencePreview({ node }: { node: AppNode }) {
  const previewKind = getDesktopMediaPreviewKind(node);
  const previewSrc = previewKind ? resolveDesktopPreviewSrc(node) : null;
  if (previewKind !== "image" || !previewSrc) {
    return (
      <span className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-[var(--ode-border)] bg-[rgba(5,29,46,0.86)] text-[var(--ode-accent)]">
        <FileGlyphSmall />
      </span>
    );
  }

  return (
    <span className="h-11 w-11 overflow-hidden rounded-[12px] border border-[var(--ode-border)] bg-[rgba(5,29,46,0.86)]">
      <img src={previewSrc} alt="" className="h-full w-full object-cover" draggable={false} loading="lazy" />
    </span>
  );
}

export function ProcedureContentPanel({
  t,
  language,
  rootNode,
  selectedNode,
  byParent,
  scopedNumbering,
  nodeLevelById,
  allNodes,
  projects,
  activeProjectRootId,
  onSelectNode,
  onReviewFile,
  onSaveNodeContent,
  onRenameNodeTitle,
  onSaveNodeDescription,
  onSaveNodeMeaning,
  onSetNodeChantierMode,
  onSaveNodeWorkstreamWorkspace,
  onApplyIntegratedStructure,
  executionQuickOpenRequestKey = 0,
  executionQuickOpenDeliverableId = null,
  onOpenAssistant,
  onActivateProcedureSurface,
  onOpenNodeContextMenu,
  onOpenSurfaceContextMenu
}: ProcedureContentPanelProps) {
  const globalNodeById = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const projectByRootId = useMemo(() => new Map(projects.map((project) => [project.rootNodeId, project])), [projects]);
  const workspaceRootIdSet = useMemo(() => new Set(projects.map((project) => project.rootNodeId)), [projects]);
  const nodeProjectRootById = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of allNodes) {
      const projectRootId = findProcedureWorkspaceRootId(node.id, globalNodeById, workspaceRootIdSet);
      if (projectRootId) {
        map.set(node.id, projectRootId);
      }
    }
    return map;
  }, [allNodes, globalNodeById, workspaceRootIdSet]);

  const workspaceRootId = useMemo(
    () => (rootNode ? findProcedureWorkspaceRootId(rootNode.id, globalNodeById, workspaceRootIdSet) : activeProjectRootId),
    [activeProjectRootId, globalNodeById, rootNode, workspaceRootIdSet]
  );

  const editorNode = useMemo(() => {
    if (!rootNode) return null;
    if (!selectedNode) return rootNode;
    if (!isReferenceNode(selectedNode)) return selectedNode;
    if (!selectedNode.parentId || selectedNode.parentId === ROOT_PARENT_ID) return rootNode;
    return globalNodeById.get(selectedNode.parentId) ?? rootNode;
  }, [globalNodeById, rootNode, selectedNode]);

  const selectedReferenceId = selectedNode && isReferenceNode(selectedNode) ? selectedNode.id : null;
  const selectedSectionId = editorNode?.id ?? rootNode?.id ?? null;
  const editorBody = useMemo(() => getNodeBody(editorNode), [editorNode]);
  const executionTaskSignature = useMemo(
    () => buildProcedureExecutionTaskSignature(editorNode, allNodes),
    [allNodes, editorNode]
  );
  const structuredDeliverableSeed = useMemo(
    () => readProcedureStructuredDeliverables(editorNode, allNodes),
    [allNodes, editorNode, executionTaskSignature]
  );
  const chantierProfileSeed = useMemo(() => readChantierProfile(editorNode), [editorNode]);
  const isChantierEditor = useMemo(() => isChantierNode(editorNode), [editorNode]);
  const isManualChantierEditor = useMemo(() => isManualChantierNode(editorNode), [editorNode]);
  const chantierCopy = useMemo(() => getProcedureChantierCopy(language), [language]);
  const chantierLinkedNADisplay = useMemo(() => getChantierLinkedNADisplay(editorNode), [editorNode]);
  const editorNodeMetadata = useMemo(() => getODENodeMetadata(editorNode), [editorNode]);
  const canEnableManualChantierMode = Boolean(
    editorNode &&
      editorNode.type === "folder" &&
      !isChantierEditor &&
      editorNodeMetadata.level === null &&
      editorNodeMetadata.naCode === null &&
      editorNodeMetadata.kind === null
  );
  const canDisableManualChantierMode = Boolean(editorNode && editorNode.type === "folder" && isManualChantierEditor);
  const showChantierSteeringTab = isChantierEditor || canEnableManualChantierMode || canDisableManualChantierMode;

  const [draft, setDraft] = useState(editorBody);
  const [titleDraft, setTitleDraft] = useState(editorNode?.name ?? "");
  const [descriptionDraft, setDescriptionDraft] = useState(editorNode?.description ?? "");
  const [objectiveDraft, setObjectiveDraft] = useState(readProcedureObjective(editorNode));
  const [deliverableDrafts, setDeliverableDrafts] = useState<ODEStructuredDeliverable[]>(structuredDeliverableSeed);
  const [chantierProfileDraft, setChantierProfileDraft] = useState<ODEChantierProfile>(chantierProfileSeed);
  const [selectedDeliverableId, setSelectedDeliverableId] = useState<string | null>(null);
  const [systemTab, setSystemTab] = useState<ProcedureSystemTabKey>("description");
  const [executionTab, setExecutionTab] = useState<ProcedureExecutionTabKey>("tasks");
  const [executionModalOpen, setExecutionModalOpen] = useState(false);
  const [selectedExecutionItemKey, setSelectedExecutionItemKey] = useState<string | null>(null);
  const [deliverableProposal, setDeliverableProposal] = useState<ODEDeliverableProposal | null>(null);
  const [deliverableAiBusy, setDeliverableAiBusy] = useState(false);
  const [deliverableAiSaveBusy, setDeliverableAiSaveBusy] = useState(false);
  const [deliverableAiError, setDeliverableAiError] = useState<string | null>(null);
  const [integratedPlanProposal, setIntegratedPlanProposal] = useState<ODEIntegratedPlanProposal | null>(null);
  const [integratedPlanAiBusy, setIntegratedPlanAiBusy] = useState(false);
  const [integratedPlanAiSaveBusy, setIntegratedPlanAiSaveBusy] = useState(false);
  const [integratedPlanAiError, setIntegratedPlanAiError] = useState<string | null>(null);
  const [aiMemoryReviewOpen, setAiMemoryReviewOpen] = useState(false);
  const [aiMemoryEntries, setAiMemoryEntries] = useState(() => readApprovedIntegratedPlanMemories());
  const [workstreamProposal, setWorkstreamProposal] = useState<ODEWorkstreamWorkspaceProposal | null>(null);
  const [workstreamAiBusyDeliverableId, setWorkstreamAiBusyDeliverableId] = useState<string | null>(null);
  const [workstreamAiSaveBusy, setWorkstreamAiSaveBusy] = useState(false);
  const [workstreamAiError, setWorkstreamAiError] = useState<string | null>(null);
  const [chantierModeToggleBusy, setChantierModeToggleBusy] = useState(false);
  const [lastSavedValue, setLastSavedValue] = useState(editorBody);
  const [lastSavedTitle, setLastSavedTitle] = useState(editorNode?.name ?? "");
  const [bodySaveState, setBodySaveState] = useState<SaveState>("idle");
  const [titleSaveState, setTitleSaveState] = useState<SaveState>("idle");
  const [meaningSaveState, setMeaningSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exportState, setExportState] = useState<"idle" | "pdf" | "docx">("idle");
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [nodeLinkPickerOpen, setNodeLinkPickerOpen] = useState(false);
  const [nodeLinkQuery, setNodeLinkQuery] = useState("");
  const [linkDialogState, setLinkDialogState] = useState<ProcedureLinkDialogState | null>(null);
  const [mentionState, setMentionState] = useState<DraftMentionState | null>(null);
  const [mentionSelectionIndex, setMentionSelectionIndex] = useState(0);
  const [procedureTextEditMenu, setProcedureTextEditMenu] = useState<TextEditContextMenuState | null>(null);

  const lastSavedValueRef = useRef(editorBody);
  const lastSavedTitleRef = useRef(editorNode?.name ?? "");
  const lastSavedDescriptionRef = useRef(editorNode?.description ?? "");
  const lastSavedObjectiveRef = useRef(readProcedureObjective(editorNode));
  const lastSavedDeliverablesRef = useRef<ODEStructuredDeliverable[]>(structuredDeliverableSeed);
  const lastSavedChantierProfileRef = useRef<ODEChantierProfile>(chantierProfileSeed);
  const bodySaveRequestIdRef = useRef(0);
  const titleSaveRequestIdRef = useRef(0);
  const meaningSaveRequestIdRef = useRef(0);
  const draftTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const nodeLinkPickerRef = useRef<HTMLDivElement | null>(null);
  const nodeLinkButtonRef = useRef<HTMLButtonElement | null>(null);
  const nodeLinkQueryInputRef = useRef<HTMLInputElement | null>(null);
  const nodeLinkSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const deliverableCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const deliverableInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const executionItemRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const executionItemInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const deliverableTaskPreviewInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const pendingDeliverableRevealIdRef = useRef<string | null>(null);
  const modalClipboardRef = useRef<ProcedureModalClipboard | null>(null);
  const lastExecutionQuickOpenRequestKeyRef = useRef(executionQuickOpenRequestKey);
  const draftRef = useRef(editorBody);
  const procedureTextSessionRef = useRef<{
    input: HTMLInputElement | HTMLTextAreaElement;
    getValue: () => string;
    setValue: (value: string) => void;
  } | null>(null);

  const procedureTree = useMemo(
    () => (rootNode ? buildProcedureSectionTree(rootNode, rootNode.id, byParent, scopedNumbering) : null),
    [rootNode, byParent, scopedNumbering]
  );
  const liveProcedureTree = useMemo(
    () => (procedureTree ? applyDraftToSectionTree(procedureTree, editorNode?.id ?? null, titleDraft, draft) : null),
    [draft, editorNode?.id, procedureTree, titleDraft]
  );
  const currentSection = useMemo(
    () => (liveProcedureTree && selectedSectionId ? findSectionById(liveProcedureTree, selectedSectionId) : liveProcedureTree),
    [liveProcedureTree, selectedSectionId]
  );
  const editorPathNodes = useMemo(
    () => (editorNode && rootNode ? buildSectionPath(editorNode.id, globalNodeById, rootNode.id) : rootNode ? [rootNode] : []),
    [editorNode, globalNodeById, rootNode]
  );
  const editorPathLabel = useMemo(() => editorPathNodes.map((node) => node.name).join(" / "), [editorPathNodes]);

  useEffect(() => {
    // Only hard-reset the editor when we switch to a different node.
    // Autosave refreshes update the same node instance and should not close the execution modal.
    setDraft(editorBody);
    setTitleDraft(editorNode?.name ?? "");
    setDescriptionDraft(editorNode?.description ?? "");
    setObjectiveDraft(readProcedureObjective(editorNode));
    setDeliverableDrafts(structuredDeliverableSeed);
    setChantierProfileDraft(chantierProfileSeed);
    setLastSavedValue(editorBody);
    setLastSavedTitle(editorNode?.name ?? "");
    lastSavedValueRef.current = editorBody;
    lastSavedTitleRef.current = editorNode?.name ?? "";
    lastSavedDescriptionRef.current = editorNode?.description ?? "";
    lastSavedObjectiveRef.current = readProcedureObjective(editorNode);
    lastSavedDeliverablesRef.current = structuredDeliverableSeed;
    lastSavedChantierProfileRef.current = chantierProfileSeed;
    setBodySaveState("idle");
    setTitleSaveState("idle");
    setMeaningSaveState("idle");
    setSaveError(null);
    setSelectedDeliverableId(null);
    setSystemTab("description");
    setExecutionTab("tasks");
    setExecutionModalOpen(false);
    setSelectedExecutionItemKey(null);
    setDeliverableProposal(null);
    setDeliverableAiBusy(false);
    setDeliverableAiSaveBusy(false);
    setDeliverableAiError(null);
    setIntegratedPlanProposal(null);
    setIntegratedPlanAiBusy(false);
    setIntegratedPlanAiSaveBusy(false);
    setIntegratedPlanAiError(null);
    setAiMemoryReviewOpen(false);
    setWorkstreamProposal(null);
    setWorkstreamAiBusyDeliverableId(null);
    setWorkstreamAiSaveBusy(false);
    setWorkstreamAiError(null);
    setNodeLinkPickerOpen(false);
    setNodeLinkQuery("");
    setMentionState(null);
    setMentionSelectionIndex(0);
    setProcedureTextEditMenu(null);
    setChantierModeToggleBusy(false);
    nodeLinkSelectionRef.current = null;
    procedureTextSessionRef.current = null;
    modalClipboardRef.current = null;
    draftRef.current = editorBody;
  }, [editorNode?.id]);

  useEffect(() => {
    if (systemTab === "steering" && !showChantierSteeringTab) {
      setSystemTab("description");
    }
  }, [showChantierSteeringTab, systemTab]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (deliverableDrafts.length === 0) {
      if (selectedDeliverableId !== null) {
        setSelectedDeliverableId(null);
      }
      if (executionModalOpen) {
        setExecutionModalOpen(false);
      }
      return;
    }
    if (selectedDeliverableId && deliverableDrafts.some((deliverable) => deliverable.id === selectedDeliverableId)) {
      return;
    }
    setSelectedDeliverableId(deliverableDrafts[0]?.id ?? null);
  }, [deliverableDrafts, executionModalOpen, selectedDeliverableId]);

  useEffect(() => {
    if (!executionModalOpen) {
      setSelectedExecutionItemKey(null);
      return;
    }
    const selectedDeliverable =
      deliverableDrafts.find((deliverable) => deliverable.id === selectedDeliverableId) ?? null;
    if (!selectedDeliverable) {
      setSelectedExecutionItemKey(null);
      return;
    }
    const entries = selectedDeliverable[executionTab];
    if (entries.length === 0) {
      if (selectedExecutionItemKey !== null) {
        setSelectedExecutionItemKey(null);
      }
      return;
    }
    const availableKeys = entries.map((entry, index) => getProcedureExecutionItemKey(executionTab, entry, index));
    if (selectedExecutionItemKey && availableKeys.includes(selectedExecutionItemKey)) {
      return;
    }
    setSelectedExecutionItemKey(availableKeys[0] ?? null);
  }, [deliverableDrafts, executionModalOpen, executionTab, selectedDeliverableId, selectedExecutionItemKey]);

  useEffect(() => {
    const targetId = pendingDeliverableRevealIdRef.current;
    if (!targetId) return;
    if (!deliverableDrafts.some((deliverable) => deliverable.id === targetId)) {
      pendingDeliverableRevealIdRef.current = null;
      return;
    }

    const targetCard = deliverableCardRefs.current.get(targetId);
    if (!targetCard) return;

    pendingDeliverableRevealIdRef.current = null;
    const rafId = window.requestAnimationFrame(() => {
      targetCard.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      const targetInput = targetCard.querySelector("input");
      if (targetInput instanceof HTMLInputElement) {
        targetInput.focus();
        targetInput.select();
      }
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [deliverableDrafts, selectedDeliverableId, systemTab]);

  useEffect(() => {
    if (!executionModalOpen || !selectedExecutionItemKey) return;
    const targetRow = executionItemRowRefs.current.get(selectedExecutionItemKey);
    if (!targetRow) return;
    const rafId = window.requestAnimationFrame(() => {
      targetRow.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    });
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [executionModalOpen, selectedExecutionItemKey]);

  useEffect(() => {
    if (!executionModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setExecutionModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [executionModalOpen]);

  useEffect(() => {
    if (!exportMessage) return;
    const timeoutId = window.setTimeout(() => {
      setExportMessage(null);
    }, 2600);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [exportMessage]);

  useEffect(() => {
    if (!nodeLinkPickerOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (nodeLinkPickerRef.current?.contains(target)) return;
      if (nodeLinkButtonRef.current?.contains(target)) return;
      setNodeLinkPickerOpen(false);
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [nodeLinkPickerOpen]);

  useEffect(() => {
    if (!nodeLinkPickerOpen) return;
    const rafId = window.requestAnimationFrame(() => {
      nodeLinkQueryInputRef.current?.focus();
      nodeLinkQueryInputRef.current?.select();
    });
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [nodeLinkPickerOpen]);

  const saveNow = useCallback(async () => {
    if (!editorNode) return;
    const nextValue = draft.replace(/\r\n/g, "\n");
    if (nextValue === lastSavedValueRef.current) {
      setBodySaveState("saved");
      return;
    }

    const requestId = bodySaveRequestIdRef.current + 1;
    bodySaveRequestIdRef.current = requestId;
    setBodySaveState("saving");
    setSaveError(null);

    try {
      await onSaveNodeContent(editorNode.id, nextValue);
      if (bodySaveRequestIdRef.current !== requestId) return;
      lastSavedValueRef.current = nextValue;
      setLastSavedValue(nextValue);
      setBodySaveState("saved");
    } catch (error) {
      if (bodySaveRequestIdRef.current !== requestId) return;
      setBodySaveState("error");
      setSaveError(error instanceof Error ? error.message : String(error));
    }
  }, [draft, editorNode, onSaveNodeContent]);

  const saveTitleNow = useCallback(async () => {
    if (!editorNode) return;
    const nextTitle = titleDraft.trim();

    if (!nextTitle) {
      setTitleDraft(lastSavedTitleRef.current);
      setTitleSaveState("idle");
      return;
    }
    if (nextTitle === lastSavedTitleRef.current) {
      setTitleSaveState("saved");
      return;
    }

    const requestId = titleSaveRequestIdRef.current + 1;
    titleSaveRequestIdRef.current = requestId;
    setTitleSaveState("saving");
    setSaveError(null);

    try {
      await onRenameNodeTitle(editorNode.id, nextTitle);
      if (titleSaveRequestIdRef.current !== requestId) return;
      lastSavedTitleRef.current = nextTitle;
      setLastSavedTitle(nextTitle);
      setTitleSaveState("saved");
    } catch (error) {
      if (titleSaveRequestIdRef.current !== requestId) return;
      setTitleSaveState("error");
      setSaveError(error instanceof Error ? error.message : String(error));
    }
  }, [editorNode, onRenameNodeTitle, titleDraft]);

  const saveMeaningNow = useCallback(async (overrides?: {
    description?: string;
    objective?: string;
    deliverables?: ODEStructuredDeliverable[];
    chantierProfile?: ODEChantierProfile;
  }) => {
    if (!editorNode) return;

    const nextDescription = (overrides?.description ?? descriptionDraft).trim();
    const nextObjective = (overrides?.objective ?? objectiveDraft).trim();
    const nextDeliverables = (overrides?.deliverables ?? deliverableDrafts)
      .map((deliverable) => ({
        ...deliverable,
        title: deliverable.title.trim(),
        tasks: deliverable.tasks.map((item) => trimProcedureTaskItem(item)).filter((item): item is ODEExecutionTaskItem => Boolean(item)),
        notifications: deliverable.notifications.map((item) => item.trim()).filter((item) => item.length > 0),
        data: deliverable.data.map((item) => item.trim()).filter((item) => item.length > 0)
      }))
      .filter((deliverable) => deliverable.title.length > 0);
    const nextChantierProfile = normalizeChantierProfile(overrides?.chantierProfile ?? chantierProfileDraft);
    const descriptionChanged = nextDescription !== lastSavedDescriptionRef.current;
    const objectiveChanged = nextObjective !== lastSavedObjectiveRef.current;
    const deliverablesChanged = !areProcedureStructuredDeliverablesEqual(
      nextDeliverables,
      lastSavedDeliverablesRef.current
    );
    const chantierChanged =
      isChantierEditor && !areChantierProfilesEqual(nextChantierProfile, lastSavedChantierProfileRef.current);

    if (!descriptionChanged && !objectiveChanged && !deliverablesChanged && !chantierChanged) {
      setMeaningSaveState("saved");
      return;
    }

    const requestId = meaningSaveRequestIdRef.current + 1;
    meaningSaveRequestIdRef.current = requestId;
    setMeaningSaveState("saving");
    setSaveError(null);

    try {
      const operations: Promise<void>[] = [];
      if (descriptionChanged) {
        operations.push(onSaveNodeDescription(editorNode.id, nextDescription || null));
      }
      if (objectiveChanged || deliverablesChanged || chantierChanged) {
        operations.push(
          onSaveNodeMeaning(editorNode.id, {
            objective: nextObjective || null,
            deliverables: nextDeliverables,
            chantierProfile: isChantierEditor ? nextChantierProfile : undefined
          })
        );
      }
      if (operations.length > 0) {
        await Promise.all(operations);
      }
      if (meaningSaveRequestIdRef.current !== requestId) return;
      lastSavedDescriptionRef.current = nextDescription;
      lastSavedObjectiveRef.current = nextObjective;
      lastSavedDeliverablesRef.current = nextDeliverables;
      lastSavedChantierProfileRef.current = nextChantierProfile;
      setDescriptionDraft(nextDescription);
      setObjectiveDraft(nextObjective);
      setDeliverableDrafts(nextDeliverables);
      setChantierProfileDraft(nextChantierProfile);
      setMeaningSaveState("saved");
    } catch (error) {
      if (meaningSaveRequestIdRef.current !== requestId) return;
      setMeaningSaveState("error");
      setSaveError(error instanceof Error ? error.message : String(error));
    }
  }, [chantierProfileDraft, deliverableDrafts, descriptionDraft, editorNode, isChantierEditor, objectiveDraft, onSaveNodeDescription, onSaveNodeMeaning]);

  const setChantierModeNow = useCallback(
    async (enabled: boolean) => {
      if (!editorNode || chantierModeToggleBusy) return;
      setChantierModeToggleBusy(true);
      setSaveError(null);
      try {
        await onSetNodeChantierMode(editorNode.id, enabled);
        if (!enabled) {
          const clearedProfile = normalizeChantierProfile(null);
          setChantierProfileDraft(clearedProfile);
          lastSavedChantierProfileRef.current = clearedProfile;
          setSystemTab("description");
        } else {
          setSystemTab("steering");
        }
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : String(error));
      } finally {
        setChantierModeToggleBusy(false);
      }
    },
    [chantierModeToggleBusy, editorNode, onSetNodeChantierMode]
  );

  const updateDeliverableDraft = useCallback(
    (
      deliverableId: string,
      updater: (current: ODEStructuredDeliverable) => ODEStructuredDeliverable,
      saveOverrides?: (nextDeliverables: ODEStructuredDeliverable[]) => ODEStructuredDeliverable[]
    ) => {
      setDeliverableDrafts((current) => {
        const nextDeliverables = current.map((deliverable) =>
          deliverable.id === deliverableId ? updater(deliverable) : deliverable
        );
        if (saveOverrides) {
          void saveMeaningNow({ deliverables: saveOverrides(nextDeliverables) });
        }
        return nextDeliverables;
      });
    },
    [saveMeaningNow]
  );

  const updateChantierProfileDraft = useCallback(<K extends keyof ODEChantierProfile>(key: K, value: ODEChantierProfile[K]) => {
    setChantierProfileDraft((current) => ({
      ...current,
      [key]: value
    }));
  }, []);

  const insertDeliverableDraft = useCallback(
    (index: number, seed?: ODEStructuredDeliverable, options?: { persist?: boolean }) => {
      const nextDeliverable =
        seed ??
        ({
          id: createProcedureDeliverableId(),
          title: buildIndexedProcedureTitle(
            t("procedure.node_deliverable_default"),
            deliverableDrafts.map((deliverable) => deliverable.title)
          ),
          tasks: [],
          notifications: [],
          data: []
        } satisfies ODEStructuredDeliverable);
      const safeIndex = Math.max(0, Math.min(index, deliverableDrafts.length));
      const nextDeliverables = [...deliverableDrafts];
      nextDeliverables.splice(safeIndex, 0, nextDeliverable);
      pendingDeliverableRevealIdRef.current = nextDeliverable.id;
      setDeliverableDrafts(nextDeliverables);
      setSelectedDeliverableId(nextDeliverable.id);
      if (options?.persist !== false) {
        void saveMeaningNow({ deliverables: nextDeliverables });
      }
      return nextDeliverable.id;
    },
    [deliverableDrafts, saveMeaningNow, t]
  );

  const addDeliverableDraft = useCallback(() => {
    insertDeliverableDraft(deliverableDrafts.length, undefined, { persist: true });
  }, [deliverableDrafts.length, insertDeliverableDraft]);

  const openExecutionWorkspace = useCallback(() => {
    setSystemTab("deliverables");
    setExecutionTab("tasks");

    const existingDeliverableId =
      (executionQuickOpenDeliverableId &&
      deliverableDrafts.some((deliverable) => deliverable.id === executionQuickOpenDeliverableId))
        ? executionQuickOpenDeliverableId
        : (selectedDeliverableId &&
          deliverableDrafts.some((deliverable) => deliverable.id === selectedDeliverableId))
          ? selectedDeliverableId
        : deliverableDrafts[0]?.id ?? null;

    if (existingDeliverableId) {
      pendingDeliverableRevealIdRef.current = existingDeliverableId;
      setSelectedDeliverableId(existingDeliverableId);
      setExecutionModalOpen(true);
      return;
    }
    setExecutionModalOpen(false);
    setSelectedDeliverableId(null);
  }, [deliverableDrafts, executionQuickOpenDeliverableId, selectedDeliverableId]);

  useEffect(() => {
    if (!executionQuickOpenDeliverableId) return;
    if (!deliverableDrafts.some((deliverable) => deliverable.id === executionQuickOpenDeliverableId)) return;
    pendingDeliverableRevealIdRef.current = executionQuickOpenDeliverableId;
    setSelectedDeliverableId(executionQuickOpenDeliverableId);
  }, [deliverableDrafts, executionQuickOpenDeliverableId]);

  useEffect(() => {
    if (executionQuickOpenRequestKey <= 0) return;
    if (lastExecutionQuickOpenRequestKeyRef.current === executionQuickOpenRequestKey) return;
    lastExecutionQuickOpenRequestKeyRef.current = executionQuickOpenRequestKey;
    openExecutionWorkspace();
  }, [executionQuickOpenRequestKey, openExecutionWorkspace]);

  const removeDeliverableDraft = useCallback(
    (deliverableId: string) => {
      const deliverableIndex = deliverableDrafts.findIndex((deliverable) => deliverable.id === deliverableId);
      const nextDeliverables = deliverableDrafts.filter((deliverable) => deliverable.id !== deliverableId);
      setDeliverableDrafts(nextDeliverables);
      setSelectedDeliverableId((current) => {
        if (current !== deliverableId) return current;
        const fallback =
          nextDeliverables[deliverableIndex] ??
          nextDeliverables[Math.max(0, deliverableIndex - 1)] ??
          null;
        return fallback?.id ?? null;
      });
      void saveMeaningNow({ deliverables: nextDeliverables });
    },
    [deliverableDrafts, saveMeaningNow]
  );

  const duplicateDeliverableDraft = useCallback(
    (deliverableId: string) => {
      const deliverableIndex = deliverableDrafts.findIndex((deliverable) => deliverable.id === deliverableId);
      if (deliverableIndex < 0) return;
      const duplicate = cloneProcedureDeliverable(deliverableDrafts[deliverableIndex]);
      insertDeliverableDraft(deliverableIndex + 1, duplicate, { persist: true });
    },
    [deliverableDrafts, insertDeliverableDraft]
  );

  const copyDeliverableDraft = useCallback(
    (deliverableId: string, mode: "copy" | "cut") => {
      const deliverable = deliverableDrafts.find((item) => item.id === deliverableId) ?? null;
      if (!deliverable) return;
      modalClipboardRef.current = {
        kind: "deliverable",
        mode,
        sourceId: deliverable.id,
        payload: cloneProcedureDeliverable(deliverable)
      };
    },
    [deliverableDrafts]
  );

  const pasteDeliverableDraft = useCallback(
    (targetDeliverableId?: string | null) => {
      const clipboard = modalClipboardRef.current;
      if (!clipboard || clipboard.kind !== "deliverable") return;
      const targetIndex =
        targetDeliverableId
          ? deliverableDrafts.findIndex((deliverable) => deliverable.id === targetDeliverableId)
          : deliverableDrafts.length - 1;
      const insertIndex = targetIndex >= 0 ? targetIndex + 1 : deliverableDrafts.length;

      if (clipboard.mode === "cut") {
        const sourceIndex = deliverableDrafts.findIndex((deliverable) => deliverable.id === clipboard.sourceId);
        if (sourceIndex < 0) {
          modalClipboardRef.current = null;
          return;
        }
        const sourceDeliverable = deliverableDrafts[sourceIndex];
        const remaining = deliverableDrafts.filter((deliverable) => deliverable.id !== clipboard.sourceId);
        const adjustedInsertIndex = sourceIndex < insertIndex ? insertIndex - 1 : insertIndex;
        const nextDeliverables = [...remaining];
        nextDeliverables.splice(Math.max(0, Math.min(adjustedInsertIndex, nextDeliverables.length)), 0, sourceDeliverable);
        pendingDeliverableRevealIdRef.current = sourceDeliverable.id;
        setDeliverableDrafts(nextDeliverables);
        setSelectedDeliverableId(sourceDeliverable.id);
        void saveMeaningNow({ deliverables: nextDeliverables });
        modalClipboardRef.current = null;
        return;
      }

      const pasted = cloneProcedureDeliverable(clipboard.payload);
      insertDeliverableDraft(insertIndex, pasted, { persist: true });
    },
    [deliverableDrafts, insertDeliverableDraft, saveMeaningNow]
  );

  const addExecutionItem = useCallback(
    (deliverableId: string, key: ProcedureExecutionTabKey, index?: number) => {
      const deliverableIndex = deliverableDrafts.findIndex((deliverable) => deliverable.id === deliverableId);
      if (deliverableIndex < 0) return null;
      const deliverable = deliverableDrafts[deliverableIndex];
      const currentItems = [...deliverable[key]];
      const insertIndex = Math.max(0, Math.min(index ?? currentItems.length, currentItems.length));
      const nextItem =
        key === "tasks"
          ? ({
              id: createProcedureTaskId(),
              title: buildIndexedProcedureTitle(
                t("procedure.node_task_default"),
                deliverable.tasks.map((item) => item.title)
              )
            } satisfies ODEExecutionTaskItem)
          : "";
      currentItems.splice(insertIndex, 0, nextItem as never);
      const nextDeliverables = deliverableDrafts.map((item, itemIndex) =>
        itemIndex === deliverableIndex
          ? ({
              ...item,
              [key]: currentItems
            } as ODEStructuredDeliverable)
          : item
      );
      setDeliverableDrafts(nextDeliverables);
      setSelectedDeliverableId(deliverableId);
      const nextKey = getProcedureExecutionItemKey(key, currentItems[insertIndex] as ODEExecutionTaskItem | string, insertIndex);
      setSelectedExecutionItemKey(nextKey);
      if (key === "tasks") {
        void saveMeaningNow({ deliverables: nextDeliverables });
      }
      return nextKey;
    },
    [deliverableDrafts, saveMeaningNow, t]
  );

  const removeExecutionItem = useCallback(
    (deliverableId: string, key: ProcedureExecutionTabKey, itemIndex: number) => {
      const deliverableIndex = deliverableDrafts.findIndex((deliverable) => deliverable.id === deliverableId);
      if (deliverableIndex < 0) return;
      const deliverable = deliverableDrafts[deliverableIndex];
      const nextItems = deliverable[key].filter((_, index) => index !== itemIndex);
      const nextDeliverables = deliverableDrafts.map((item, index) =>
        index === deliverableIndex
          ? ({
              ...item,
              [key]: nextItems
            } as ODEStructuredDeliverable)
          : item
      );
      setDeliverableDrafts(nextDeliverables);
      const fallbackIndex = Math.min(itemIndex, nextItems.length - 1);
      const fallback =
        fallbackIndex >= 0 ? getProcedureExecutionItemKey(key, nextItems[fallbackIndex] as ODEExecutionTaskItem | string, fallbackIndex) : null;
      setSelectedExecutionItemKey(fallback);
      void saveMeaningNow({ deliverables: nextDeliverables });
    },
    [deliverableDrafts, saveMeaningNow]
  );

  const duplicateExecutionItem = useCallback(
    (deliverableId: string, key: ProcedureExecutionTabKey, itemIndex: number) => {
      const deliverableIndex = deliverableDrafts.findIndex((deliverable) => deliverable.id === deliverableId);
      if (deliverableIndex < 0) return;
      const deliverable = deliverableDrafts[deliverableIndex];
      const sourceItem = deliverable[key][itemIndex];
      if (sourceItem === undefined) return;
      const clonedItem =
        key === "tasks"
          ? cloneProcedureTaskItem(sourceItem as ODEExecutionTaskItem)
          : String(sourceItem);
      const nextItems = [...deliverable[key]];
      nextItems.splice(itemIndex + 1, 0, clonedItem as never);
      const nextDeliverables = deliverableDrafts.map((item, index) =>
        index === deliverableIndex
          ? ({
              ...item,
              [key]: nextItems
            } as ODEStructuredDeliverable)
          : item
      );
      setDeliverableDrafts(nextDeliverables);
      setSelectedExecutionItemKey(
        getProcedureExecutionItemKey(key, nextItems[itemIndex + 1] as ODEExecutionTaskItem | string, itemIndex + 1)
      );
      void saveMeaningNow({ deliverables: nextDeliverables });
    },
    [deliverableDrafts, saveMeaningNow]
  );

  const copyExecutionItem = useCallback(
    (deliverableId: string, key: ProcedureExecutionTabKey, itemIndex: number, mode: "copy" | "cut") => {
      const deliverable = deliverableDrafts.find((item) => item.id === deliverableId) ?? null;
      if (!deliverable) return;
      const sourceItem = deliverable[key][itemIndex];
      if (sourceItem === undefined) return;
      modalClipboardRef.current = {
        kind: "execution_item",
        mode,
        deliverableId,
        tab: key,
        sourceKey: getProcedureExecutionItemKey(key, sourceItem as ODEExecutionTaskItem | string, itemIndex),
        payload: key === "tasks" ? cloneProcedureTaskItem(sourceItem as ODEExecutionTaskItem) : String(sourceItem)
      };
    },
    [deliverableDrafts]
  );

  const pasteExecutionItem = useCallback(
    (deliverableId: string, key: ProcedureExecutionTabKey, afterItemIndex?: number) => {
      const clipboard = modalClipboardRef.current;
      if (!clipboard || clipboard.kind !== "execution_item") return;
      const deliverableIndex = deliverableDrafts.findIndex((deliverable) => deliverable.id === deliverableId);
      if (deliverableIndex < 0) return;
      const insertIndex = Math.max(
        0,
        Math.min(
          afterItemIndex === undefined ? deliverableDrafts[deliverableIndex][key].length : afterItemIndex + 1,
          deliverableDrafts[deliverableIndex][key].length
        )
      );

      if (clipboard.mode === "cut" && clipboard.deliverableId === deliverableId && clipboard.tab === key) {
        const sourceDeliverable = deliverableDrafts[deliverableIndex];
        const sourceIndex = sourceDeliverable[key].findIndex(
          (entry, index) => getProcedureExecutionItemKey(key, entry as ODEExecutionTaskItem | string, index) === clipboard.sourceKey
        );
        if (sourceIndex < 0) {
          modalClipboardRef.current = null;
          return;
        }
        const movingItem = sourceDeliverable[key][sourceIndex];
        const remaining = sourceDeliverable[key].filter((_, index) => index !== sourceIndex);
        const adjustedInsertIndex = sourceIndex < insertIndex ? insertIndex - 1 : insertIndex;
        const nextItems = [...remaining];
        nextItems.splice(Math.max(0, Math.min(adjustedInsertIndex, nextItems.length)), 0, movingItem);
        const nextDeliverables = deliverableDrafts.map((item, index) =>
          index === deliverableIndex
            ? ({
                ...item,
                [key]: nextItems
              } as ODEStructuredDeliverable)
            : item
        );
        setDeliverableDrafts(nextDeliverables);
        setSelectedExecutionItemKey(
          getProcedureExecutionItemKey(
            key,
            nextItems[Math.max(0, Math.min(adjustedInsertIndex, nextItems.length - 1))] as ODEExecutionTaskItem | string,
            Math.max(0, Math.min(adjustedInsertIndex, nextItems.length - 1))
          )
        );
        void saveMeaningNow({ deliverables: nextDeliverables });
        modalClipboardRef.current = null;
        return;
      }

      const targetDeliverable = deliverableDrafts[deliverableIndex];
      const clonedItem =
        key === "tasks"
          ? cloneProcedureTaskItem(clipboard.payload as ODEExecutionTaskItem)
          : String(clipboard.payload);
      const nextItems = [...targetDeliverable[key]];
      nextItems.splice(insertIndex, 0, clonedItem as never);
      const nextDeliverables = deliverableDrafts.map((item, index) =>
        index === deliverableIndex
          ? ({
              ...item,
              [key]: nextItems
            } as ODEStructuredDeliverable)
          : item
      );
      setDeliverableDrafts(nextDeliverables);
      setSelectedExecutionItemKey(
        getProcedureExecutionItemKey(key, nextItems[insertIndex] as ODEExecutionTaskItem | string, insertIndex)
      );
      void saveMeaningNow({ deliverables: nextDeliverables });
    },
    [deliverableDrafts, saveMeaningNow]
  );

  const generateDeliverablesWithAi = useCallback(async () => {
    if (!editorNode) return;

    const apiKey = getSavedMistralApiKey();
    if (!apiKey) {
      const message = t("assistant.mistral_missing_key");
      setDeliverableAiError(message);
      setSaveError(message);
      return;
    }

    const description = descriptionDraft.trim();
    if (description.length === 0) {
      const message = t("procedure.deliverable_ai_description_required");
      setDeliverableAiError(message);
      setSaveError(message);
      return;
    }

    setDeliverableAiError(null);
    setSaveError(null);
    setDeliverableAiBusy(true);

    try {
      const nodeTitle = titleDraft.trim() || editorNode.name;
      const sources = collectProcedureDeliverableSources({
        node: editorNode,
        byParent,
        title: nodeTitle,
        description
      });
      const approvedExamplesSummary = buildApprovedIntegratedPlanExamplesSummary(
        findRelevantApprovedIntegratedPlans({
          nodeTitle,
          description,
          objective: objectiveDraft.trim(),
          targetLanguage: language,
          limit: 3
        })
      );
      const capabilityGuidanceSummary = buildAiCapabilityPromptBlock(
        buildAiCapabilityGuidance({
          nodeTitle,
          description,
          objective: objectiveDraft.trim(),
          sources,
          limit: 4
        })
      );

      const proposal = await generateDeliverableProposal({
        apiKey,
        nodeId: editorNode.id,
        nodeTitle,
        targetLanguage: language,
        description,
        existingDeliverables: deliverableDrafts.map((deliverable) => deliverable.title.trim()).filter((item) => item.length > 0),
        sources,
        approvedExamplesSummary,
        capabilityGuidanceSummary
      });

      setDeliverableProposal(proposal);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setDeliverableAiError(message);
      setSaveError(message);
    } finally {
      setDeliverableAiBusy(false);
    }
  }, [byParent, deliverableDrafts, descriptionDraft, editorNode, language, objectiveDraft, t, titleDraft]);

  const acceptDeliverableProposal = useCallback(async () => {
    const proposal = deliverableProposal;
    if (!proposal) return;

    const nextDeliverables: ODEStructuredDeliverable[] = proposal.deliverables.map((deliverable) => ({
      id: deliverable.id,
      title: deliverable.title,
      tasks: [],
      notifications: [],
      data: []
    }));

    setDeliverableAiSaveBusy(true);
    setDeliverableAiError(null);
    setSaveError(null);

    try {
      await saveMeaningNow({ deliverables: nextDeliverables });
      setDeliverableDrafts(nextDeliverables);
      setSelectedDeliverableId(nextDeliverables[0]?.id ?? null);
      if (nextDeliverables[0]) {
        pendingDeliverableRevealIdRef.current = nextDeliverables[0].id;
      }
      setDeliverableProposal(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setDeliverableAiError(message);
      setSaveError(message);
    } finally {
      setDeliverableAiSaveBusy(false);
    }
  }, [deliverableProposal, saveMeaningNow]);

  const openAiMemoryReview = useCallback(() => {
    setAiMemoryEntries(readApprovedIntegratedPlanMemories());
    setAiMemoryReviewOpen(true);
  }, []);

  const removeAiMemoryEntry = useCallback((entryId: string) => {
    removeApprovedIntegratedPlanMemory(entryId);
    setAiMemoryEntries(readApprovedIntegratedPlanMemories());
  }, []);

  const clearAiMemoryEntries = useCallback(() => {
    if (typeof window !== "undefined" && !window.confirm(t("procedure.ai_memory_clear_confirm"))) {
      return;
    }
    clearApprovedIntegratedPlanMemories();
    setAiMemoryEntries([]);
  }, [t]);

  const generateIntegratedPlanWithAi = useCallback(async () => {
    if (!editorNode) return;

    const apiKey = getSavedMistralApiKey();
    if (!apiKey) {
      const message = t("assistant.mistral_missing_key");
      setIntegratedPlanAiError(message);
      setSaveError(message);
      return;
    }

    const description = descriptionDraft.trim();
    if (description.length === 0) {
      const message = t("procedure.deliverable_ai_description_required");
      setIntegratedPlanAiError(message);
      setSaveError(message);
      return;
    }

    setIntegratedPlanAiError(null);
    setSaveError(null);
    setIntegratedPlanAiBusy(true);

    try {
      const nodeTitle = titleDraft.trim() || editorNode.name;
      const deliverableSources = collectProcedureDeliverableSources({
        node: editorNode,
        byParent,
        title: nodeTitle,
        description
      });

      const proposal = await generateIntegratedPlanProposal({
        apiKey,
        nodeId: editorNode.id,
        nodeTitle,
        targetLanguage: language,
        description,
        objective: objectiveDraft.trim(),
        existingDeliverables: deliverableDrafts,
        deliverableSources,
        buildTaskSources: (deliverable) =>
          collectProcedureWorkstreamSources({
            node: editorNode,
            byParent,
            title: nodeTitle,
            objective: objectiveDraft,
            description: descriptionDraft,
            deliverable: {
              id: deliverable.id,
              title: deliverable.title,
              tasks: [],
              notifications: [],
              data: []
            }
          })
      });

      setIntegratedPlanProposal(proposal);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setIntegratedPlanAiError(message);
      setSaveError(message);
    } finally {
      setIntegratedPlanAiBusy(false);
    }
  }, [byParent, deliverableDrafts, descriptionDraft, editorNode, language, objectiveDraft, t, titleDraft]);

  const acceptIntegratedPlanProposal = useCallback(async () => {
    if (!editorNode || !integratedPlanProposal) return;

    const nextDeliverables: ODEStructuredDeliverable[] = integratedPlanProposal.deliverables.map((deliverable) => ({
      id: deliverable.id,
      title: deliverable.title,
      tasks: buildExecutionTasksFromProposal(deliverable.taskProposal),
      notifications: [],
      data: []
    }));
    const nextWorkspaces = integratedPlanProposal.deliverables.map((deliverable) =>
      buildWorkstreamWorkspaceFromProposal(deliverable.taskProposal)
    );
    const trimmedDescription = descriptionDraft.trim();
    const trimmedObjective = objectiveDraft.trim();

    setIntegratedPlanAiSaveBusy(true);
    setIntegratedPlanAiError(null);
    setSaveError(null);
    setMeaningSaveState("saving");

    try {
      if (nextWorkspaces.length > 0) {
        await onSaveNodeWorkstreamWorkspace(editorNode.id, {
          description: trimmedDescription || null,
          objective: trimmedObjective || null,
          deliverables: nextDeliverables,
          workspace: nextWorkspaces[0],
          workspaces: nextWorkspaces
        });
      } else {
        await saveMeaningNow({ deliverables: nextDeliverables });
      }
      lastSavedDescriptionRef.current = trimmedDescription;
      lastSavedObjectiveRef.current = trimmedObjective;
      lastSavedDeliverablesRef.current = nextDeliverables;
      setDescriptionDraft(trimmedDescription);
      setObjectiveDraft(trimmedObjective);
      setDeliverableDrafts(nextDeliverables);
      setSelectedDeliverableId(nextDeliverables[0]?.id ?? null);
      if (nextDeliverables[0]) {
        pendingDeliverableRevealIdRef.current = nextDeliverables[0].id;
      }
      setMeaningSaveState("saved");
      appendApprovedIntegratedPlanMemory(
        buildApprovedIntegratedPlanMemoryEntry({
          nodeId: editorNode.id,
          nodeTitle: titleDraft.trim() || editorNode.name,
          description: trimmedDescription,
          objective: trimmedObjective,
          proposal: integratedPlanProposal
        })
      );
      setAiMemoryEntries(readApprovedIntegratedPlanMemories());
      setIntegratedPlanProposal(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setIntegratedPlanAiError(message);
      setSaveError(message);
      setMeaningSaveState("error");
    } finally {
      setIntegratedPlanAiSaveBusy(false);
    }
  }, [
    descriptionDraft,
    editorNode,
    integratedPlanProposal,
    objectiveDraft,
    onSaveNodeWorkstreamWorkspace,
    saveMeaningNow
  ]);

  const generateDeliverableTasksWithAi = useCallback(
    async (deliverable: ODEStructuredDeliverable) => {
      if (!editorNode) return;

      const apiKey = getSavedMistralApiKey();
      if (!apiKey) {
        const message = t("assistant.mistral_missing_key");
        setWorkstreamAiError(message);
        setSaveError(message);
        return;
      }

      const deliverableTitle = deliverable.title.trim();
      if (deliverableTitle.length === 0) {
        const message = t("procedure.workstream_ai_deliverable_required");
        setWorkstreamAiError(message);
        setSaveError(message);
        return;
      }

      setWorkstreamAiError(null);
      setSaveError(null);
      setWorkstreamAiBusyDeliverableId(deliverable.id);

      try {
        const nodeTitle = titleDraft.trim() || editorNode.name;
        const sources = collectProcedureWorkstreamSources({
          node: editorNode,
          byParent,
          title: nodeTitle,
          objective: objectiveDraft,
          description: descriptionDraft,
          deliverable
        });
        const approvedExamplesSummary = buildApprovedIntegratedPlanExamplesSummary(
          findRelevantApprovedIntegratedPlans({
            nodeTitle,
            description: descriptionDraft.trim(),
            objective: objectiveDraft.trim(),
            targetLanguage: language,
            limit: 2
          }),
          {
            deliverableTitle,
            maxExamples: 2,
            maxDeliverablesPerExample: 2,
            maxTasksPerDeliverable: 5,
            maxChars: 2200
          }
        );
        const capabilityGuidanceSummary = buildAiCapabilityPromptBlock(
          buildAiCapabilityGuidance({
            nodeTitle,
            description: descriptionDraft.trim(),
            objective: objectiveDraft.trim(),
            sources,
            limit: 4
          })
        );

        const proposal = await generateWorkstreamTaskProposal({
          apiKey,
          nodeId: editorNode.id,
          nodeTitle,
          targetLanguage: language,
          deliverableId: deliverable.id,
          deliverableTitle,
          objective: objectiveDraft.trim(),
          description: descriptionDraft.trim(),
          existingTasks: deliverable.tasks,
          sources,
          capabilityGuidanceSummary,
          approvedExamplesSummary
        });

        setWorkstreamProposal(proposal);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setWorkstreamAiError(message);
        setSaveError(message);
      } finally {
        setWorkstreamAiBusyDeliverableId(null);
      }
    },
    [byParent, descriptionDraft, editorNode, language, objectiveDraft, t, titleDraft]
  );

  const acceptWorkstreamProposal = useCallback(async () => {
    if (!editorNode || !workstreamProposal) return;

    const nextDeliverables = deliverableDrafts.map((deliverable) =>
      deliverable.id === workstreamProposal.deliverableId
        ? {
            ...deliverable,
            tasks: buildExecutionTasksFromProposal(workstreamProposal)
          }
        : deliverable
    );

    const trimmedDescription = descriptionDraft.trim();
    const trimmedObjective = objectiveDraft.trim();
    const workspace = buildWorkstreamWorkspaceFromProposal(workstreamProposal);

    setWorkstreamAiSaveBusy(true);
    setWorkstreamAiError(null);
    setSaveError(null);
    setMeaningSaveState("saving");

    try {
      await onSaveNodeWorkstreamWorkspace(editorNode.id, {
        description: trimmedDescription || null,
        objective: trimmedObjective || null,
        deliverables: nextDeliverables,
        workspace
      });
      lastSavedDescriptionRef.current = trimmedDescription;
      lastSavedObjectiveRef.current = trimmedObjective;
      lastSavedDeliverablesRef.current = nextDeliverables;
      setDescriptionDraft(trimmedDescription);
      setObjectiveDraft(trimmedObjective);
      setDeliverableDrafts(nextDeliverables);
      setMeaningSaveState("saved");
      setWorkstreamProposal(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWorkstreamAiError(message);
      setSaveError(message);
      setMeaningSaveState("error");
    } finally {
      setWorkstreamAiSaveBusy(false);
    }
  }, [
    deliverableDrafts,
    descriptionDraft,
    editorNode,
    objectiveDraft,
    onSaveNodeWorkstreamWorkspace,
    workstreamProposal
  ]);

  useEffect(() => {
    if (!editorNode) return;
    if (draft === lastSavedValue) {
      if (bodySaveState === "dirty") setBodySaveState("idle");
      return;
    }

    setBodySaveState((current) => (current === "saving" ? current : "dirty"));
    const timeoutId = window.setTimeout(() => {
      void saveNow();
    }, 700);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [bodySaveState, draft, editorNode, lastSavedValue, saveNow]);

  useEffect(() => {
    if (!editorNode) return;
    const nextTitle = titleDraft.trim();

    if (!nextTitle) {
      setTitleSaveState("dirty");
      return;
    }
    if (nextTitle === lastSavedTitle) {
      if (titleSaveState === "dirty") setTitleSaveState("idle");
      return;
    }

    setTitleSaveState((current) => (current === "saving" ? current : "dirty"));
    const timeoutId = window.setTimeout(() => {
      void saveTitleNow();
    }, 700);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [editorNode, lastSavedTitle, saveTitleNow, titleDraft, titleSaveState]);

  useEffect(() => {
    if (!editorNode) return;
    const nextDescription = descriptionDraft.trim();
    const nextObjective = objectiveDraft.trim();
    const nextDeliverables = deliverableDrafts
      .map((deliverable) => ({
        ...deliverable,
        title: deliverable.title.trim(),
        tasks: deliverable.tasks.map((item) => trimProcedureTaskItem(item)).filter((item): item is ODEExecutionTaskItem => Boolean(item)),
        notifications: deliverable.notifications.map((item) => item.trim()).filter((item) => item.length > 0),
        data: deliverable.data.map((item) => item.trim()).filter((item) => item.length > 0)
      }))
      .filter((deliverable) => deliverable.title.length > 0);
    const nextChantierProfile = normalizeChantierProfile(chantierProfileDraft);
    const changed =
      nextDescription !== lastSavedDescriptionRef.current ||
      nextObjective !== lastSavedObjectiveRef.current ||
      !areProcedureStructuredDeliverablesEqual(nextDeliverables, lastSavedDeliverablesRef.current) ||
      (isChantierEditor && !areChantierProfilesEqual(nextChantierProfile, lastSavedChantierProfileRef.current));

    if (!changed) {
      if (meaningSaveState === "dirty") setMeaningSaveState("idle");
      return;
    }

    setMeaningSaveState((current) => (current === "saving" ? current : "dirty"));
  }, [chantierProfileDraft, deliverableDrafts, descriptionDraft, editorNode, isChantierEditor, meaningSaveState, objectiveDraft]);

  const handleExport = useCallback(
    async (format: "pdf" | "docx") => {
      if (!liveProcedureTree) return;
      setExportState(format);
      setExportMessage(null);
      setSaveError(null);

      try {
        const bytes =
          format === "pdf"
            ? buildProcedurePdfBytes({
                rootSection: liveProcedureTree,
                locale: navigator.language || "en-US",
                labels: {
                  generatedPrefix: t("procedure.export_generated"),
                  reportWorkspace: t("procedure.report_workspace"),
                  reportNode: t("procedure.report_node"),
                  statusOverview: t("procedure.status_overview"),
                  sections: t("procedure.status_sections"),
                  documented: t("procedure.status_documented"),
                  references: t("procedure.references"),
                  connections: t("procedure.connections"),
                  linkedNodes: t("procedure.linked_nodes"),
                  externalLinks: t("procedure.external_links"),
                  scheduled: t("procedure.status_scheduled"),
                  planned: t("procedure.status_planned"),
                  active: t("procedure.status_active"),
                  blocked: t("procedure.status_blocked"),
                  done: t("procedure.status_done")
                }
              })
            : await buildProcedureDocxBytes({
                rootSection: liveProcedureTree,
                locale: navigator.language || "en-US",
                labels: {
                  generatedPrefix: t("procedure.export_generated"),
                  reportWorkspace: t("procedure.report_workspace"),
                  reportNode: t("procedure.report_node"),
                  statusOverview: t("procedure.status_overview"),
                  sections: t("procedure.status_sections"),
                  documented: t("procedure.status_documented"),
                  references: t("procedure.references"),
                  connections: t("procedure.connections"),
                  linkedNodes: t("procedure.linked_nodes"),
                  externalLinks: t("procedure.external_links"),
                  scheduled: t("procedure.status_scheduled"),
                  planned: t("procedure.status_planned"),
                  active: t("procedure.status_active"),
                  blocked: t("procedure.status_blocked"),
                  done: t("procedure.status_done")
                }
              });
        const normalizedName = normalizeExportFileName(liveProcedureTree.node.name);
        const savedPath = await saveExportFile(
          format === "pdf" ? t("procedure.export_dialog_pdf_title") : t("procedure.export_dialog_word_title"),
          `${normalizedName}.${format === "pdf" ? "pdf" : "docx"}`,
          format === "pdf" ? t("procedure.export_dialog_pdf_filter") : t("procedure.export_dialog_word_filter"),
          format === "pdf" ? "pdf" : "docx",
          Array.from(bytes)
        );
        if (savedPath) {
          setExportMessage(savedPath);
        }
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : String(error));
      } finally {
        setExportState("idle");
      }
    },
    [liveProcedureTree, t]
  );

  const handleTextareaKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionState) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMentionSelectionIndex((current) => {
          if (mentionCandidates.length === 0) return 0;
          return (current + 1) % mentionCandidates.length;
        });
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionSelectionIndex((current) => {
          if (mentionCandidates.length === 0) return 0;
          return current <= 0 ? mentionCandidates.length - 1 : current - 1;
        });
        return;
      }
      if ((event.key === "Enter" || event.key === "Tab") && mentionCandidates.length > 0) {
        event.preventDefault();
        const candidate = mentionCandidates[Math.min(mentionSelectionIndex, mentionCandidates.length - 1)];
        if (candidate) {
          insertMentionNodeLink(candidate);
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMentionState(null);
        setMentionSelectionIndex(0);
        return;
      }
    }

    if (nodeLinkPickerOpen && event.key === "Escape") {
      event.preventDefault();
      setNodeLinkPickerOpen(false);
      const selection = nodeLinkSelectionRef.current;
      if (selection) {
        window.requestAnimationFrame(() => {
          draftTextareaRef.current?.focus();
          draftTextareaRef.current?.setSelectionRange(selection.start, selection.end);
        });
      }
      return;
    }

    const hasModifier = event.ctrlKey || event.metaKey;
    if (!hasModifier) return;

    const key = event.key.toLowerCase();
    if (event.shiftKey && key === "k") {
      event.preventDefault();
      const selectionStart = event.currentTarget.selectionStart ?? draft.length;
      const selectionEnd = event.currentTarget.selectionEnd ?? selectionStart;
      nodeLinkSelectionRef.current = { start: selectionStart, end: selectionEnd };
      setNodeLinkQuery("");
      setMentionState(null);
      setMentionSelectionIndex(0);
      setNodeLinkPickerOpen(true);
      return;
    }
    if (key === "s") {
      event.preventDefault();
      void Promise.all([saveTitleNow(), saveNow()]);
    }
  };

  const handleTitleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void saveTitleNow();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setTitleDraft(lastSavedTitleRef.current);
    }
  };

  const minimalActionButtonClass =
    "inline-flex items-center justify-center rounded-full border border-[var(--ode-border)] bg-[rgba(5,29,46,0.82)] px-4 py-2.5 text-[0.84rem] text-[var(--ode-text-dim)] transition hover:border-[var(--ode-border-strong)] hover:text-[var(--ode-text)]";
  const labeledActionButtonClass =
    "inline-flex h-11 items-center gap-2 rounded-full border border-[var(--ode-border)] bg-[rgba(5,29,46,0.82)] px-4 text-[0.88rem] text-[var(--ode-text)] transition hover:border-[var(--ode-border-strong)] hover:bg-[rgba(8,38,60,0.9)]";
  const primaryLabeledActionButtonClass =
    "ode-primary-btn inline-flex h-11 items-center gap-2 px-4 text-[0.88rem]";
  const iconActionButtonClass = `${minimalActionButtonClass} h-10 w-10 px-0`;
  const tallIconActionButtonClass = `${minimalActionButtonClass} h-11 w-11 px-0`;
  const renderTooltipIconButton = (
    label: string,
    icon: ReactNode,
    options: {
      onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
      disabled?: boolean;
      className?: string;
    }
  ) => (
    <OdeTooltip label={label} side="bottom">
      <span className="inline-flex">
        <button
          type="button"
          aria-label={label}
          className={options.className ?? iconActionButtonClass}
          onClick={options.onClick}
          disabled={options.disabled}
        >
          {icon}
        </button>
      </span>
    </OdeTooltip>
  );
  const renderTooltipActionButton = (
    label: string,
    icon: ReactNode,
    options: {
      onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
      disabled?: boolean;
      className?: string;
    }
  ) => (
    <OdeTooltip label={label} side="bottom">
      <span className="inline-flex">
        <button
          type="button"
          aria-label={label}
          className={options.className ?? labeledActionButtonClass}
          onClick={options.onClick}
          disabled={options.disabled}
        >
          <span className="inline-flex items-center justify-center text-[1rem]">{icon}</span>
          <span className="whitespace-nowrap">{label}</span>
        </button>
      </span>
    </OdeTooltip>
  );
  const allNodeLinkCandidates = useMemo(() => {
    return allNodes
      .filter((node) => node.id !== editorNode?.id)
      .map<ProcedureNodeLinkCandidate>((node) => {
        const candidateWorkspaceRootId = nodeProjectRootById.get(node.id) ?? null;
        const workspaceName = candidateWorkspaceRootId
          ? (projectByRootId.get(candidateWorkspaceRootId)?.name ?? node.name)
          : node.name;
        const pathLabel = buildSectionPath(node.id, globalNodeById, candidateWorkspaceRootId ?? node.id)
          .map((item) => item.name)
          .join(" / ");
        return {
          node,
          workspaceRootId: candidateWorkspaceRootId,
          workspaceName,
          pathLabel,
          isCurrentWorkspace: candidateWorkspaceRootId === workspaceRootId,
          searchText: `${node.name} ${pathLabel} ${workspaceName} ${node.type}`.toLowerCase()
        };
      })
      .sort((left, right) => {
        if (left.isCurrentWorkspace !== right.isCurrentWorkspace) {
          return left.isCurrentWorkspace ? -1 : 1;
        }
        const workspaceCompare = left.workspaceName.localeCompare(right.workspaceName, undefined, { sensitivity: "base" });
        if (workspaceCompare !== 0) return workspaceCompare;
        return left.pathLabel.localeCompare(right.pathLabel, undefined, { sensitivity: "base" });
      });
  }, [allNodes, editorNode?.id, globalNodeById, nodeProjectRootById, projectByRootId, workspaceRootId]);

  const nodeLinkCandidates = useMemo(() => {
    const normalizedQuery = nodeLinkQuery.trim().toLowerCase();
    return allNodeLinkCandidates.filter((candidate) => !normalizedQuery || candidate.searchText.includes(normalizedQuery));
  }, [allNodeLinkCandidates, nodeLinkQuery]);

  const currentWorkspaceNodeLinkCandidates = useMemo(
    () => nodeLinkCandidates.filter((candidate) => candidate.isCurrentWorkspace).slice(0, 8),
    [nodeLinkCandidates]
  );

  const otherWorkspaceNodeLinkCandidates = useMemo(
    () => nodeLinkCandidates.filter((candidate) => !candidate.isCurrentWorkspace).slice(0, 8),
    [nodeLinkCandidates]
  );
  const mentionCandidates = useMemo(() => {
    if (!mentionState) return [];
    const normalizedQuery = mentionState.query.trim().toLowerCase();
    return allNodeLinkCandidates
      .filter((candidate) => !normalizedQuery || candidate.searchText.includes(normalizedQuery))
      .slice(0, 6);
  }, [allNodeLinkCandidates, mentionState]);

  const focusDraftTextareaAt = useCallback((selectionStart: number, selectionEnd: number = selectionStart) => {
    window.requestAnimationFrame(() => {
      const textarea = draftTextareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  }, []);

  const focusProcedureTextSessionAt = useCallback((selectionStart: number, selectionEnd: number = selectionStart) => {
    window.requestAnimationFrame(() => {
      const session = procedureTextSessionRef.current;
      if (!session) return;
      session.input.focus();
      session.input.setSelectionRange(selectionStart, selectionEnd);
    });
  }, []);
  const preserveEditorSelection = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  }, []);

  const replaceDraftRange = useCallback(
    (start: number, end: number, replacement: string) => {
      const current = draftRef.current;
      const safeStart = Math.max(0, Math.min(start, current.length));
      const safeEnd = Math.max(safeStart, Math.min(end, current.length));
      const nextValue = `${current.slice(0, safeStart)}${replacement}${current.slice(safeEnd)}`;
      const nextCaret = safeStart + replacement.length;
      draftRef.current = nextValue;
      nodeLinkSelectionRef.current = { start: nextCaret, end: nextCaret };
      setDraft(nextValue);
      setNodeLinkPickerOpen(false);
      setNodeLinkQuery("");
      setMentionState(null);
      setMentionSelectionIndex(0);
      focusDraftTextareaAt(nextCaret);
    },
    [focusDraftTextareaAt]
  );

  const openNodeLinkPicker = useCallback(() => {
    const textarea = draftTextareaRef.current;
    const selectionStart = textarea?.selectionStart ?? draftRef.current.length;
    const selectionEnd = textarea?.selectionEnd ?? selectionStart;
    nodeLinkSelectionRef.current = { start: selectionStart, end: selectionEnd };
    setNodeLinkQuery("");
    setMentionState(null);
    setMentionSelectionIndex(0);
    setNodeLinkPickerOpen(true);
  }, []);

  const syncDraftSelection = useCallback((input: HTMLTextAreaElement | null) => {
    if (!input) return;
    nodeLinkSelectionRef.current = {
      start: input.selectionStart ?? draftRef.current.length,
      end: input.selectionEnd ?? input.selectionStart ?? draftRef.current.length
    };
  }, []);

  const syncDraftMention = useCallback((value: string, selectionStart: number, selectionEnd: number) => {
    const nextMention = resolveDraftMention(value, selectionStart, selectionEnd);
    setMentionState(nextMention);
    setMentionSelectionIndex(0);
  }, []);

  const insertBlockAtSelection = useCallback(
    (blockText: string) => {
      const current = draftRef.current;
      const selection = nodeLinkSelectionRef.current ?? {
        start: current.length,
        end: current.length
      };
      const prefix = selection.start > 0 && !current.slice(0, selection.start).endsWith("\n\n") ? "\n\n" : "";
      const suffix = selection.end < current.length && !current.slice(selection.end).startsWith("\n\n") ? "\n\n" : "";
      replaceDraftRange(selection.start, selection.end, `${prefix}${blockText}${suffix}`);
    },
    [replaceDraftRange]
  );

  const insertQuoteBlock = useCallback(() => {
    const current = draftRef.current;
    const selection = nodeLinkSelectionRef.current ?? {
      start: current.length,
      end: current.length
    };
    const selectedText = current.slice(selection.start, selection.end).trim();
    const replacement =
      selectedText.length > 0
        ? selectedText
            .split(/\r?\n/)
            .map((line) => {
              const trimmedLine = line.trim();
              return trimmedLine ? `“${trimmedLine}”` : "";
            })
            .join("\n")
        : "“Key takeaway”";
    insertBlockAtSelection(replacement);
  }, [insertBlockAtSelection]);

  const insertCodeBlock = useCallback(() => {
    const current = draftRef.current;
    const selection = nodeLinkSelectionRef.current ?? {
      start: current.length,
      end: current.length
    };
    const selectedText = current.slice(selection.start, selection.end).trim();
    const replacement = selectedText.length > 0 ? `\`\`\`text\n${selectedText}\n\`\`\`` : "```text\n\n```";
    insertBlockAtSelection(replacement);
  }, [insertBlockAtSelection]);

  const insertDividerBlock = useCallback(() => {
    insertBlockAtSelection("────────────────");
  }, [insertBlockAtSelection]);

  const insertInsightBlock = useCallback(
    (domain: ProcedureInsightDomain) => {
      insertBlockAtSelection(getProcedureInsightTemplate(domain));
    },
    [insertBlockAtSelection]
  );

  const insertNodeLink = useCallback(
    (candidate: ProcedureNodeLinkCandidate) => {
      const selection = nodeLinkSelectionRef.current ?? {
        start: draftRef.current.length,
        end: draftRef.current.length
      };
      const label = sanitizeProcedureLinkLabel(candidate.node.name, candidate.node.name);
      const replacement = `[${label}](ode://node/${encodeURIComponent(candidate.node.id)})`;
      replaceDraftRange(selection.start, selection.end, replacement);
    },
    [replaceDraftRange]
  );

  const insertMentionNodeLink = useCallback(
    (candidate: ProcedureNodeLinkCandidate) => {
      if (!mentionState) return;
      const replacement = `[${candidate.node.name}](ode://node/${encodeURIComponent(candidate.node.id)})`;
      replaceDraftRange(mentionState.start, mentionState.end, replacement);
    },
    [mentionState, replaceDraftRange]
  );

  const openExternalLinkDialog = useCallback(() => {
    const selection = nodeLinkSelectionRef.current ?? {
      start: draftRef.current.length,
      end: draftRef.current.length
    };
    const selectedText = draftRef.current.slice(selection.start, selection.end);
    const label = sanitizeProcedureLinkLabel(selectedText, t("procedure.link_default_text"));
    setLinkDialogState({
      selectionStart: selection.start,
      selectionEnd: selection.end,
      label,
      href: "www."
    });
  }, [t]);

  const confirmExternalLinkDialog = useCallback(() => {
    if (!linkDialogState) return;
    const href = normalizeExternalHref(linkDialogState.href);
    if (!href) return;
    let fallbackLabel = t("procedure.link_default_text");
    try {
      fallbackLabel = new URL(href).hostname.replace(/^www\./, "") || fallbackLabel;
    } catch {
      fallbackLabel = t("procedure.link_default_text");
    }
    const label = sanitizeProcedureLinkLabel(linkDialogState.label, fallbackLabel);
    replaceDraftRange(linkDialogState.selectionStart, linkDialogState.selectionEnd, `[${label}](${href})`);
    setLinkDialogState(null);
  }, [linkDialogState, replaceDraftRange, t]);

  const replaceProcedureTextRange = useCallback(
    (start: number, end: number, replacement: string) => {
      const session = procedureTextSessionRef.current;
      if (!session) return;
      const current = session.getValue();
      const safeStart = Math.max(0, Math.min(start, current.length));
      const safeEnd = Math.max(safeStart, Math.min(end, current.length));
      const nextValue = `${current.slice(0, safeStart)}${replacement}${current.slice(safeEnd)}`;
      session.setValue(nextValue);
      setProcedureTextEditMenu(null);
      focusProcedureTextSessionAt(safeStart + replacement.length);
    },
    [focusProcedureTextSessionAt]
  );

  const openProcedureTextEditContextMenu = useCallback(
    async (
      event: ReactMouseEvent<HTMLInputElement | HTMLTextAreaElement>,
      session: {
        getValue: () => string;
        setValue: (value: string) => void;
      }
    ) => {
      event.preventDefault();
      event.stopPropagation();
      setNodeLinkPickerOpen(false);
      procedureTextSessionRef.current = {
        input: event.currentTarget,
        getValue: session.getValue,
        setValue: session.setValue
      };
      event.currentTarget.focus();

      const value = session.getValue();
      const selectionStart = event.currentTarget.selectionStart ?? value.length;
      const selectionEnd = event.currentTarget.selectionEnd ?? selectionStart;
      const spellTarget = resolveProcedureSpellTarget(value, selectionStart, selectionEnd);

      const nextMenu: TextEditContextMenuState = {
        x: event.clientX,
        y: event.clientY,
        word: spellTarget?.word ?? null,
        suggestions: [],
        loading: Boolean(spellTarget),
        selectionStart,
        selectionEnd
      };
      setProcedureTextEditMenu(nextMenu);

      if (!spellTarget) return;

      const suggestions = await getSpellSuggestions(spellTarget.word, language);
      setProcedureTextEditMenu((current) => {
        if (!current) return current;
        if (
          current.word !== spellTarget.word ||
          current.selectionStart !== selectionStart ||
          current.selectionEnd !== selectionEnd
        ) {
          return current;
        }
        return {
          ...current,
          suggestions,
          loading: false
        };
      });
    },
    [language]
  );

  const writeProcedureClipboardText = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
  }, []);

  const readProcedureClipboardText = useCallback(async () => navigator.clipboard.readText(), []);

  const runProcedureTextMenuCopy = useCallback(async () => {
    if (!procedureTextEditMenu || !procedureTextSessionRef.current) return;
    const { selectionStart, selectionEnd } = procedureTextEditMenu;
    if (selectionEnd <= selectionStart) return;
    const value = procedureTextSessionRef.current.getValue();
    const selectedText = value.slice(selectionStart, selectionEnd);
    if (!selectedText) return;
    await writeProcedureClipboardText(selectedText);
    focusProcedureTextSessionAt(selectionStart, selectionEnd);
    setProcedureTextEditMenu(null);
  }, [focusProcedureTextSessionAt, procedureTextEditMenu, writeProcedureClipboardText]);

  const runProcedureTextMenuCut = useCallback(async () => {
    if (!procedureTextEditMenu || !procedureTextSessionRef.current) return;
    const { selectionStart, selectionEnd } = procedureTextEditMenu;
    if (selectionEnd <= selectionStart) return;
    const value = procedureTextSessionRef.current.getValue();
    const selectedText = value.slice(selectionStart, selectionEnd);
    if (!selectedText) return;
    await writeProcedureClipboardText(selectedText);
    replaceProcedureTextRange(selectionStart, selectionEnd, "");
  }, [procedureTextEditMenu, replaceProcedureTextRange, writeProcedureClipboardText]);

  const runProcedureTextMenuPaste = useCallback(async () => {
    if (!procedureTextEditMenu) return;
    const raw = await readProcedureClipboardText();
    if (!raw) return;
    replaceProcedureTextRange(procedureTextEditMenu.selectionStart, procedureTextEditMenu.selectionEnd, raw);
  }, [procedureTextEditMenu, readProcedureClipboardText, replaceProcedureTextRange]);

  const runProcedureTextMenuSelectAll = useCallback(() => {
    const session = procedureTextSessionRef.current;
    if (!session) return;
    focusProcedureTextSessionAt(0, session.getValue().length);
    setProcedureTextEditMenu(null);
  }, [focusProcedureTextSessionAt]);

  const runProcedureTextMenuSuggestion = useCallback(
    (suggestion: string) => {
      if (!procedureTextEditMenu || !procedureTextSessionRef.current) return;
      const value = procedureTextSessionRef.current.getValue();
      const target = resolveProcedureSpellTarget(
        value,
        procedureTextEditMenu.selectionStart,
        procedureTextEditMenu.selectionEnd
      );
      const start = target?.start ?? procedureTextEditMenu.selectionStart;
      const end = target?.end ?? procedureTextEditMenu.selectionEnd;
      replaceProcedureTextRange(start, end, suggestion);
    },
    [procedureTextEditMenu, replaceProcedureTextRange]
  );

  const renderReferenceCards = (
    references: AppNode[],
    options?: { compact?: boolean; title?: string }
  ) => {
    if (references.length === 0) return null;

    const compact = options?.compact ?? false;

    return (
      <div className="space-y-3">
        {options?.title ? (
          <div className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">{options.title}</div>
        ) : null}
        <div className={compact ? "space-y-2" : "grid gap-3 sm:grid-cols-2"}>
          {references.map((reference) => {
            const isSelected = selectedReferenceId === reference.id;
            const mediaKind = getDesktopMediaPreviewKind(reference);

            return (
              <div
                key={reference.id}
                className={`flex items-center gap-3 rounded-[18px] border px-3 py-3 transition ${
                  isSelected
                    ? "border-[var(--ode-accent)] bg-[rgba(38,157,214,0.18)] text-[var(--ode-text)]"
                    : "border-[var(--ode-border)] bg-[rgba(4,28,45,0.82)] text-[var(--ode-text-dim)]"
                }`}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onContextMenu={(event) => {
                    event.stopPropagation();
                    onOpenNodeContextMenu(event, reference.id);
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    void onSelectNode(reference.id);
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    onReviewFile(reference.id);
                  }}
                >
                  <ProcedureInlineReferencePreview node={reference} />
                  <span className="min-w-0 flex-1">
                    <span className="ode-wrap-text block text-[0.9rem] font-medium text-[var(--ode-text)]">{reference.name}</span>
                    <span className="mt-1 flex items-center gap-1 text-[0.72rem] uppercase tracking-[0.14em] text-[var(--ode-text-muted)]">
                      {mediaKind === "image" ? <ImageGlyphSmall /> : <FileGlyphSmall />}
                      <span>{reference.type}</span>
                    </span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const systemFocusedMode = true;
  const selectedDeliverable =
    deliverableDrafts.find((deliverable) => deliverable.id === selectedDeliverableId) ?? null;
  const executionTabs = [
    {
      key: "tasks" as const,
      label: t("procedure.node_tasks"),
      addLabel: t("procedure.node_task_add"),
      placeholder: t("procedure.node_task_placeholder")
    },
    {
      key: "data" as const,
      label: t("procedure.node_data"),
      addLabel: t("procedure.node_data_add"),
      placeholder: t("procedure.node_data_placeholder")
    },
    {
      key: "notifications" as const,
      label: t("procedure.node_notifications"),
      addLabel: t("procedure.node_notification_add"),
      placeholder: t("procedure.node_notification_placeholder")
    }
  ] as const;
  const activeExecutionTab = executionTabs.find((tab) => tab.key === executionTab) ?? executionTabs[0];
  const selectedExecutionItems = selectedDeliverable ? selectedDeliverable[activeExecutionTab.key] : [];
  const selectedExecutionIndex =
    selectedExecutionItemKey && selectedDeliverable
      ? selectedExecutionItems.findIndex((entry, index) =>
          getProcedureExecutionItemKey(activeExecutionTab.key, entry as ODEExecutionTaskItem | string, index) === selectedExecutionItemKey
        )
      : -1;
  const focusDeliverableTitleInput = useCallback((deliverableId: string) => {
    window.requestAnimationFrame(() => {
      const input = deliverableInputRefs.current.get(deliverableId);
      if (!input) return;
      input.focus();
      input.select();
    });
  }, []);
  const focusExecutionItemInput = useCallback((itemKey: string) => {
    window.requestAnimationFrame(() => {
      const input = executionItemInputRefs.current.get(itemKey);
      if (!input) return;
      input.focus();
      input.select();
    });
  }, []);
  const focusDeliverableTaskPreviewInput = useCallback((itemKey: string) => {
    window.requestAnimationFrame(() => {
      const input = deliverableTaskPreviewInputRefs.current.get(itemKey);
      if (!input) return;
      input.focus();
      input.select();
    });
  }, []);
  const openExecutionModal = (deliverableId: string) => {
    setSelectedDeliverableId(deliverableId);
    setExecutionModalOpen(true);
  };

  useEffect(() => {
    const hasBlockingPreview = Boolean(deliverableProposal) || Boolean(integratedPlanProposal) || Boolean(workstreamProposal) || aiMemoryReviewOpen;
    if (hasBlockingPreview) return;
    if (systemTab !== "deliverables" && !executionModalOpen) return;

    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable || target.closest("[contenteditable='true']")) return true;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (isEditableTarget(event.target)) return;

      const hasModifier = event.ctrlKey || event.metaKey;
      const keyLower = event.key.toLowerCase();

      if (executionModalOpen && selectedDeliverable) {
        if (event.altKey && event.shiftKey && event.key === "ArrowLeft") {
          event.preventDefault();
          setExecutionModalOpen(false);
          focusDeliverableTitleInput(selectedDeliverable.id);
          return;
        }

        if (event.key === "ArrowUp" && selectedExecutionItems.length > 0) {
          event.preventDefault();
          const nextIndex = selectedExecutionIndex > 0 ? selectedExecutionIndex - 1 : 0;
          setSelectedExecutionItemKey(
            getProcedureExecutionItemKey(
              activeExecutionTab.key,
              selectedExecutionItems[nextIndex] as ODEExecutionTaskItem | string,
              nextIndex
            )
          );
          return;
        }

        if (event.key === "ArrowDown" && selectedExecutionItems.length > 0) {
          event.preventDefault();
          const startIndex = selectedExecutionIndex >= 0 ? selectedExecutionIndex : 0;
          const nextIndex = Math.min(selectedExecutionItems.length - 1, startIndex + 1);
          setSelectedExecutionItemKey(
            getProcedureExecutionItemKey(
              activeExecutionTab.key,
              selectedExecutionItems[nextIndex] as ODEExecutionTaskItem | string,
              nextIndex
            )
          );
          return;
        }

        if (event.key === "Home" && selectedExecutionItems.length > 0) {
          event.preventDefault();
          setSelectedExecutionItemKey(
            getProcedureExecutionItemKey(activeExecutionTab.key, selectedExecutionItems[0] as ODEExecutionTaskItem | string, 0)
          );
          return;
        }

        if (event.key === "End" && selectedExecutionItems.length > 0) {
          event.preventDefault();
          const endIndex = selectedExecutionItems.length - 1;
          setSelectedExecutionItemKey(
            getProcedureExecutionItemKey(
              activeExecutionTab.key,
              selectedExecutionItems[endIndex] as ODEExecutionTaskItem | string,
              endIndex
            )
          );
          return;
        }

        if (hasModifier && keyLower === "c" && selectedExecutionIndex >= 0) {
          event.preventDefault();
          copyExecutionItem(selectedDeliverable.id, activeExecutionTab.key, selectedExecutionIndex, "copy");
          return;
        }
        if (hasModifier && keyLower === "x" && selectedExecutionIndex >= 0) {
          event.preventDefault();
          copyExecutionItem(selectedDeliverable.id, activeExecutionTab.key, selectedExecutionIndex, "cut");
          return;
        }
        if (hasModifier && keyLower === "v") {
          event.preventDefault();
          pasteExecutionItem(selectedDeliverable.id, activeExecutionTab.key, selectedExecutionIndex >= 0 ? selectedExecutionIndex : undefined);
          return;
        }
        if (hasModifier && keyLower === "d" && selectedExecutionIndex >= 0) {
          event.preventDefault();
          duplicateExecutionItem(selectedDeliverable.id, activeExecutionTab.key, selectedExecutionIndex);
          return;
        }
        if ((event.key === "Delete" || event.key === "Backspace") && selectedExecutionIndex >= 0) {
          event.preventDefault();
          removeExecutionItem(selectedDeliverable.id, activeExecutionTab.key, selectedExecutionIndex);
          return;
        }
        if (event.key === "F2" && selectedExecutionIndex >= 0) {
          event.preventDefault();
          focusExecutionItemInput(selectedExecutionItemKey ?? "");
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          const insertAfterIndex = selectedExecutionIndex >= 0 ? selectedExecutionIndex + 1 : selectedExecutionItems.length;
          const nextKey = addExecutionItem(selectedDeliverable.id, activeExecutionTab.key, insertAfterIndex);
          if (nextKey) focusExecutionItemInput(nextKey);
          return;
        }
        if (event.key === "Tab" && event.shiftKey) {
          event.preventDefault();
          setExecutionModalOpen(false);
          focusDeliverableTitleInput(selectedDeliverable.id);
          return;
        }
      }

      if (systemTab !== "deliverables") return;
      if (deliverableDrafts.length === 0) {
        if (event.key === "Enter" || event.key === "Insert") {
          event.preventDefault();
          const nextId = insertDeliverableDraft(0);
          focusDeliverableTitleInput(nextId);
        }
        return;
      }
      const selectedIndex = selectedDeliverableId
        ? deliverableDrafts.findIndex((deliverable) => deliverable.id === selectedDeliverableId)
        : -1;

      if (event.key === "ArrowUp") {
        event.preventDefault();
        const nextIndex = selectedIndex > 0 ? selectedIndex - 1 : 0;
        setSelectedDeliverableId(deliverableDrafts[nextIndex]?.id ?? null);
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const startIndex = selectedIndex >= 0 ? selectedIndex : 0;
        const nextIndex = Math.min(deliverableDrafts.length - 1, startIndex + 1);
        setSelectedDeliverableId(deliverableDrafts[nextIndex]?.id ?? null);
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        setSelectedDeliverableId(deliverableDrafts[0]?.id ?? null);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        setSelectedDeliverableId(deliverableDrafts[deliverableDrafts.length - 1]?.id ?? null);
        return;
      }

      if (!selectedDeliverableId) return;

      if (event.altKey && event.shiftKey && event.key === "ArrowRight") {
        event.preventDefault();
        openExecutionModal(selectedDeliverableId);
        return;
      }

      if (hasModifier && keyLower === "c") {
        event.preventDefault();
        copyDeliverableDraft(selectedDeliverableId, "copy");
        return;
      }
      if (hasModifier && keyLower === "x") {
        event.preventDefault();
        copyDeliverableDraft(selectedDeliverableId, "cut");
        return;
      }
      if (hasModifier && keyLower === "v") {
        event.preventDefault();
        pasteDeliverableDraft(selectedDeliverableId);
        return;
      }
      if (hasModifier && keyLower === "d") {
        event.preventDefault();
        duplicateDeliverableDraft(selectedDeliverableId);
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && deliverableDrafts.length > 0) {
        event.preventDefault();
        removeDeliverableDraft(selectedDeliverableId);
        return;
      }
      if (event.key === "F2") {
        event.preventDefault();
        focusDeliverableTitleInput(selectedDeliverableId);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const insertIndex =
          selectedIndex >= 0
            ? event.shiftKey
              ? selectedIndex
              : selectedIndex + 1
            : deliverableDrafts.length;
        const nextId = insertDeliverableDraft(insertIndex);
        focusDeliverableTitleInput(nextId);
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        openExecutionModal(selectedDeliverableId);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    activeExecutionTab.key,
    addExecutionItem,
    aiMemoryReviewOpen,
    copyDeliverableDraft,
    copyExecutionItem,
    deliverableDrafts,
    deliverableProposal,
    duplicateDeliverableDraft,
    duplicateExecutionItem,
    executionModalOpen,
    focusDeliverableTitleInput,
    focusExecutionItemInput,
    insertDeliverableDraft,
    integratedPlanProposal,
    openExecutionModal,
    pasteDeliverableDraft,
    pasteExecutionItem,
    removeDeliverableDraft,
    removeExecutionItem,
    selectedDeliverable,
    selectedDeliverableId,
    selectedExecutionIndex,
    selectedExecutionItemKey,
    selectedExecutionItems,
    systemTab,
    workstreamProposal
  ]);

  const renderChantierModeCard = () => {
    if (!(canEnableManualChantierMode || canDisableManualChantierMode || isChantierEditor)) return null;

    return (
      <div className="space-y-3 rounded-[18px] border border-[rgba(110,211,255,0.12)] bg-[rgba(4,24,39,0.72)] px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-[60ch] text-[0.84rem] leading-6 text-[var(--ode-text-muted)]">
            {canDisableManualChantierMode ? chantierCopy.manualDisableHint : chantierCopy.manualHint}
          </div>
          {canEnableManualChantierMode || canDisableManualChantierMode ? (
            <button
              type="button"
              className={`ode-text-btn h-10 rounded-[14px] px-4 text-[0.84rem] font-medium ${
                canDisableManualChantierMode
                  ? "border-[rgba(255,154,120,0.28)] text-[#ffd1bf]"
                  : "border-[rgba(93,193,255,0.34)] text-[#bde8ff]"
              }`.trim()}
              disabled={chantierModeToggleBusy}
              onClick={() => {
                void setChantierModeNow(!canDisableManualChantierMode);
              }}
            >
              {chantierModeToggleBusy ? "..." : canDisableManualChantierMode ? chantierCopy.manualDisable : chantierCopy.manualEnable}
            </button>
          ) : null}
        </div>
        {isChantierEditor ? (
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <div className="rounded-[14px] border border-[rgba(110,211,255,0.12)] bg-[rgba(2,18,31,0.52)] px-3 py-3">
              <div className="text-[0.68rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
                {chantierCopy.linkedNA}
              </div>
              <div className="mt-1 text-[0.88rem] text-[var(--ode-text)]">
                {chantierLinkedNADisplay ?? chantierCopy.linkedNAEmpty}
              </div>
            </div>
            <label className="block">
              <div className="mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                {chantierCopy.status}
              </div>
              <select
                className="ode-input h-11 w-full rounded-[14px] px-3 text-[0.92rem]"
                value={chantierProfileDraft.status}
                onChange={(event) =>
                  setChantierProfileDraft((current) => ({
                    ...current,
                    status: event.target.value as ODEChantierStatus
                  }))
                }
                onBlur={() => {
                  void saveMeaningNow();
                }}
              >
                {chantierCopy.statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </div>
    );
  };

  const renderChantierSteeringForm = () => {
    if (!showChantierSteeringTab) return null;

    return (
      <div className="space-y-4">
        {renderChantierModeCard()}
        {!isChantierEditor ? (
          <div className="rounded-[18px] border border-dashed border-[var(--ode-border)] px-4 py-4 text-[0.84rem] text-[var(--ode-text-muted)]">
            {chantierCopy.manualHint}
          </div>
        ) : (
          <>
            <div className="rounded-[20px] border border-[rgba(110,211,255,0.12)] bg-[rgba(4,24,39,0.72)] px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                    {chantierCopy.sectionTitle}
                  </div>
                  <div className="mt-1 text-[0.84rem] leading-6 text-[var(--ode-text-muted)]">{chantierCopy.sectionHint}</div>
                </div>
              </div>
              <div className="mt-4 grid gap-4">
                <label className="block">
                  <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                    {chantierCopy.valueStatementLabel}
                  </div>
                  <textarea
                    className="ode-input min-h-[100px] w-full resize-y rounded-[18px] px-4 py-3 text-[0.94rem] leading-7"
                    value={objectiveDraft}
                    onChange={(event) => setObjectiveDraft(event.target.value)}
                    onBlur={() => {
                      void saveMeaningNow();
                    }}
                    placeholder={chantierCopy.valueStatementPlaceholder}
                    spellCheck
                  />
                </label>
                <div className="grid gap-4 xl:grid-cols-2">
                  <label className="block">
                    <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                      {chantierCopy.activity}
                    </div>
                    <textarea
                      className="ode-input min-h-[88px] w-full resize-y rounded-[18px] px-4 py-3 text-[0.92rem] leading-7"
                      value={chantierProfileDraft.activity ?? ""}
                      onChange={(event) => updateChantierProfileDraft("activity", event.target.value)}
                      onBlur={() => {
                        void saveMeaningNow();
                      }}
                      placeholder={chantierCopy.activityPlaceholder}
                      spellCheck
                    />
                  </label>
                  <label className="block">
                    <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                      {chantierCopy.owner}
                    </div>
                    <textarea
                      className="ode-input min-h-[88px] w-full resize-y rounded-[18px] px-4 py-3 text-[0.92rem] leading-7"
                      value={chantierProfileDraft.owner ?? ""}
                      onChange={(event) => updateChantierProfileDraft("owner", event.target.value)}
                      onBlur={() => {
                        void saveMeaningNow();
                      }}
                      placeholder={chantierCopy.ownerPlaceholder}
                      spellCheck
                    />
                  </label>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="block">
                    <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                      {chantierCopy.qualityTarget}
                    </div>
                    <input
                      className="ode-input h-11 w-full rounded-[14px] px-3 text-[0.92rem]"
                      value={chantierProfileDraft.qualityTarget ?? ""}
                      onChange={(event) => updateChantierProfileDraft("qualityTarget", event.target.value)}
                      onBlur={() => {
                        void saveMeaningNow();
                      }}
                      placeholder={chantierCopy.targetPlaceholder}
                    />
                  </label>
                  <label className="block">
                    <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                      {chantierCopy.costTarget}
                    </div>
                    <input
                      className="ode-input h-11 w-full rounded-[14px] px-3 text-[0.92rem]"
                      value={chantierProfileDraft.costTarget ?? ""}
                      onChange={(event) => updateChantierProfileDraft("costTarget", event.target.value)}
                      onBlur={() => {
                        void saveMeaningNow();
                      }}
                      placeholder={chantierCopy.targetPlaceholder}
                    />
                  </label>
                  <label className="block">
                    <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                      {chantierCopy.delayTarget}
                    </div>
                    <input
                      className="ode-input h-11 w-full rounded-[14px] px-3 text-[0.92rem]"
                      value={chantierProfileDraft.delayTarget ?? ""}
                      onChange={(event) => updateChantierProfileDraft("delayTarget", event.target.value)}
                      onBlur={() => {
                        void saveMeaningNow();
                      }}
                      placeholder={chantierCopy.targetPlaceholder}
                    />
                  </label>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  <label className="block">
                    <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                      {chantierCopy.resources}
                    </div>
                    <textarea
                      className="ode-input min-h-[88px] w-full resize-y rounded-[18px] px-4 py-3 text-[0.92rem] leading-7"
                      value={chantierProfileDraft.resources ?? ""}
                      onChange={(event) => updateChantierProfileDraft("resources", event.target.value)}
                      onBlur={() => {
                        void saveMeaningNow();
                      }}
                      placeholder={chantierCopy.resourcesPlaceholder}
                      spellCheck
                    />
                  </label>
                  <label className="block">
                    <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                      {chantierCopy.indicators}
                    </div>
                    <textarea
                      className="ode-input min-h-[88px] w-full resize-y rounded-[18px] px-4 py-3 text-[0.92rem] leading-7"
                      value={chantierProfileDraft.indicators ?? ""}
                      onChange={(event) => updateChantierProfileDraft("indicators", event.target.value)}
                      onBlur={() => {
                        void saveMeaningNow();
                      }}
                      placeholder={chantierCopy.indicatorsPlaceholder}
                      spellCheck
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="rounded-[20px] border border-[rgba(110,211,255,0.12)] bg-[rgba(4,24,39,0.72)] px-4 py-4">
              <div>
                <div className="text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                  {chantierCopy.planningTitle}
                </div>
                <div className="mt-1 text-[0.84rem] leading-6 text-[var(--ode-text-muted)]">{chantierCopy.planningHint}</div>
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <label className="block">
                  <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                    {chantierCopy.planningWindow}
                  </div>
                  <input
                    className="ode-input h-11 w-full rounded-[14px] px-3 text-[0.92rem]"
                    value={chantierProfileDraft.planningWindow ?? ""}
                    onChange={(event) => updateChantierProfileDraft("planningWindow", event.target.value)}
                    onBlur={() => {
                      void saveMeaningNow();
                    }}
                    placeholder={chantierCopy.planningWindowPlaceholder}
                  />
                </label>
                <label className="block">
                  <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                    {chantierCopy.reviewCadence}
                  </div>
                  <input
                    className="ode-input h-11 w-full rounded-[14px] px-3 text-[0.92rem]"
                    value={chantierProfileDraft.reviewCadence ?? ""}
                    onChange={(event) => updateChantierProfileDraft("reviewCadence", event.target.value)}
                    onBlur={() => {
                      void saveMeaningNow();
                    }}
                    placeholder={chantierCopy.reviewCadencePlaceholder}
                  />
                </label>
                <label className="block">
                  <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                    {chantierCopy.quarterFocus}
                  </div>
                  <input
                    className="ode-input h-11 w-full rounded-[14px] px-3 text-[0.92rem]"
                    value={chantierProfileDraft.quarterFocus ?? ""}
                    onChange={(event) => updateChantierProfileDraft("quarterFocus", event.target.value)}
                    onBlur={() => {
                      void saveMeaningNow();
                    }}
                    placeholder={chantierCopy.quarterFocusPlaceholder}
                  />
                </label>
                <label className="block">
                  <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                    {chantierCopy.capacityPlan}
                  </div>
                  <textarea
                    className="ode-input min-h-[88px] w-full resize-y rounded-[18px] px-4 py-3 text-[0.92rem] leading-7"
                    value={chantierProfileDraft.capacityPlan ?? ""}
                    onChange={(event) => updateChantierProfileDraft("capacityPlan", event.target.value)}
                    onBlur={() => {
                      void saveMeaningNow();
                    }}
                    placeholder={chantierCopy.capacityPlanPlaceholder}
                    spellCheck
                  />
                </label>
                <label className="block">
                  <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                    {chantierCopy.dependencies}
                  </div>
                  <textarea
                    className="ode-input min-h-[88px] w-full resize-y rounded-[18px] px-4 py-3 text-[0.92rem] leading-7"
                    value={chantierProfileDraft.dependencies ?? ""}
                    onChange={(event) => updateChantierProfileDraft("dependencies", event.target.value)}
                    onBlur={() => {
                      void saveMeaningNow();
                    }}
                    placeholder={chantierCopy.dependenciesPlaceholder}
                    spellCheck
                  />
                </label>
              </div>
            </div>

            <div className="rounded-[20px] border border-[rgba(110,211,255,0.12)] bg-[rgba(4,24,39,0.72)] px-4 py-4">
              <div>
                <div className="text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                  {chantierCopy.portfolioCadenceTitle}
                </div>
                <div className="mt-1 text-[0.84rem] leading-6 text-[var(--ode-text-muted)]">{chantierCopy.portfolioCadenceHint}</div>
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <label className="block xl:col-span-2">
                  <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                    {chantierCopy.cadenceMilestones}
                  </div>
                  <textarea
                    className="ode-input min-h-[92px] w-full resize-y rounded-[18px] px-4 py-3 text-[0.92rem] leading-7"
                    value={chantierProfileDraft.cadenceMilestones ?? ""}
                    onChange={(event) => updateChantierProfileDraft("cadenceMilestones", event.target.value)}
                    onBlur={() => {
                      void saveMeaningNow();
                    }}
                    placeholder={chantierCopy.cadenceMilestonesPlaceholder}
                    spellCheck
                  />
                </label>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-[20px] border border-[rgba(110,211,255,0.12)] bg-[rgba(4,24,39,0.72)] px-4 py-4">
                <div>
                  <div className="text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                    {chantierCopy.governanceTitle}
                  </div>
                  <div className="mt-1 text-[0.84rem] leading-6 text-[var(--ode-text-muted)]">
                    {chantierCopy.governanceHint}
                  </div>
                </div>
                <div className="mt-4 grid gap-4">
                  <label className="block">
                    <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                      {chantierCopy.approvalComment}
                    </div>
                    <textarea
                      className="ode-input min-h-[92px] w-full resize-y rounded-[18px] px-4 py-3 text-[0.92rem] leading-7"
                      value={chantierProfileDraft.approvalComment ?? ""}
                      onChange={(event) => updateChantierProfileDraft("approvalComment", event.target.value)}
                      onBlur={() => {
                        void saveMeaningNow();
                      }}
                      placeholder={chantierCopy.approvalCommentPlaceholder}
                      spellCheck
                    />
                  </label>
                  <label className="block">
                    <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                      {chantierCopy.decisionLog}
                    </div>
                    <textarea
                      className="ode-input min-h-[124px] w-full resize-y rounded-[18px] px-4 py-3 text-[0.92rem] leading-7"
                      value={chantierProfileDraft.decisionLog ?? ""}
                      onChange={(event) => updateChantierProfileDraft("decisionLog", event.target.value)}
                      onBlur={() => {
                        void saveMeaningNow();
                      }}
                      placeholder={chantierCopy.decisionLogPlaceholder}
                      spellCheck
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-[20px] border border-[rgba(110,211,255,0.12)] bg-[rgba(4,24,39,0.72)] px-4 py-4">
                <div>
                  <div className="text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                    {chantierCopy.traceabilityTitle}
                  </div>
                  <div className="mt-1 text-[0.84rem] leading-6 text-[var(--ode-text-muted)]">
                    {chantierCopy.traceabilityHint}
                  </div>
                </div>
                <div className="mt-4 grid gap-4">
                  <label className="block">
                    <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                      {chantierCopy.evidencePlan}
                    </div>
                    <textarea
                      className="ode-input min-h-[88px] w-full resize-y rounded-[18px] px-4 py-3 text-[0.92rem] leading-7"
                      value={chantierProfileDraft.evidencePlan ?? ""}
                      onChange={(event) => updateChantierProfileDraft("evidencePlan", event.target.value)}
                      onBlur={() => {
                        void saveMeaningNow();
                      }}
                      placeholder={chantierCopy.evidencePlanPlaceholder}
                      spellCheck
                    />
                  </label>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <label className="block">
                      <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                        {chantierCopy.signoffOwner}
                      </div>
                      <input
                        className="ode-input h-11 w-full rounded-[14px] px-3 text-[0.92rem]"
                        value={chantierProfileDraft.signoffOwner ?? ""}
                        onChange={(event) => updateChantierProfileDraft("signoffOwner", event.target.value)}
                        onBlur={() => {
                          void saveMeaningNow();
                        }}
                        placeholder={chantierCopy.signoffOwnerPlaceholder}
                      />
                    </label>
                    <label className="block">
                      <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                        {chantierCopy.signoffState}
                      </div>
                      <select
                        className="ode-input h-11 w-full rounded-[14px] px-3 text-[0.92rem]"
                        value={chantierProfileDraft.signoffState ?? "not_started"}
                        onChange={(event) =>
                          setChantierProfileDraft((current) => ({
                            ...current,
                            signoffState: event.target.value as ODEChantierSignoffState
                          }))
                        }
                        onBlur={() => {
                          void saveMeaningNow();
                        }}
                      >
                        {chantierCopy.signoffStateOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="block">
                    <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                      {chantierCopy.acceptancePlan}
                    </div>
                    <textarea
                      className="ode-input min-h-[88px] w-full resize-y rounded-[18px] px-4 py-3 text-[0.92rem] leading-7"
                      value={chantierProfileDraft.acceptancePlan ?? ""}
                      onChange={(event) => updateChantierProfileDraft("acceptancePlan", event.target.value)}
                      onBlur={() => {
                        void saveMeaningNow();
                      }}
                      placeholder={chantierCopy.acceptancePlanPlaceholder}
                      spellCheck
                    />
                  </label>
                  <label className="block">
                    <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                      {chantierCopy.closurePack}
                    </div>
                    <textarea
                      className="ode-input min-h-[88px] w-full resize-y rounded-[18px] px-4 py-3 text-[0.92rem] leading-7"
                      value={chantierProfileDraft.closurePack ?? ""}
                      onChange={(event) => updateChantierProfileDraft("closurePack", event.target.value)}
                      onBlur={() => {
                        void saveMeaningNow();
                      }}
                      placeholder={chantierCopy.closurePackPlaceholder}
                      spellCheck
                    />
                  </label>
                  <label className="block">
                    <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                      {chantierCopy.closureSummary}
                    </div>
                    <textarea
                      className="ode-input min-h-[88px] w-full resize-y rounded-[18px] px-4 py-3 text-[0.92rem] leading-7"
                      value={chantierProfileDraft.closureSummary ?? ""}
                      onChange={(event) => updateChantierProfileDraft("closureSummary", event.target.value)}
                      onBlur={() => {
                        void saveMeaningNow();
                      }}
                      placeholder={chantierCopy.closureSummaryPlaceholder}
                      spellCheck
                    />
                  </label>
                  <label className="block">
                    <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                      {chantierCopy.retex}
                    </div>
                    <textarea
                      className="ode-input min-h-[88px] w-full resize-y rounded-[18px] px-4 py-3 text-[0.92rem] leading-7"
                      value={chantierProfileDraft.retex ?? ""}
                      onChange={(event) => updateChantierProfileDraft("retex", event.target.value)}
                      onBlur={() => {
                        void saveMeaningNow();
                      }}
                      placeholder={chantierCopy.retexPlaceholder}
                      spellCheck
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-[20px] border border-[rgba(110,211,255,0.12)] bg-[rgba(4,24,39,0.72)] px-4 py-4">
                <div>
                  <div className="text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                    {chantierCopy.responsibilityTitle}
                  </div>
                  <div className="mt-1 text-[0.84rem] leading-6 text-[var(--ode-text-muted)]">
                    {chantierCopy.responsibilityHint}
                  </div>
                </div>
                <div className="mt-4 grid gap-4">
                  <label className="block">
                    <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                      {chantierCopy.roleModel}
                    </div>
                    <textarea
                      className="ode-input min-h-[88px] w-full resize-y rounded-[18px] px-4 py-3 text-[0.92rem] leading-7"
                      value={chantierProfileDraft.roleModel ?? ""}
                      onChange={(event) => updateChantierProfileDraft("roleModel", event.target.value)}
                      onBlur={() => {
                        void saveMeaningNow();
                      }}
                      placeholder={chantierCopy.roleModelPlaceholder}
                      spellCheck
                    />
                  </label>
                  <label className="block">
                    <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                      {chantierCopy.requiredSkills}
                    </div>
                    <textarea
                      className="ode-input min-h-[88px] w-full resize-y rounded-[18px] px-4 py-3 text-[0.92rem] leading-7"
                      value={chantierProfileDraft.requiredSkills ?? ""}
                      onChange={(event) => updateChantierProfileDraft("requiredSkills", event.target.value)}
                      onBlur={() => {
                        void saveMeaningNow();
                      }}
                      placeholder={chantierCopy.requiredSkillsPlaceholder}
                      spellCheck
                    />
                  </label>
                  <label className="block">
                    <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                      {chantierCopy.peoplePlan}
                    </div>
                    <textarea
                      className="ode-input min-h-[88px] w-full resize-y rounded-[18px] px-4 py-3 text-[0.92rem] leading-7"
                      value={chantierProfileDraft.peoplePlan ?? ""}
                      onChange={(event) => updateChantierProfileDraft("peoplePlan", event.target.value)}
                      onBlur={() => {
                        void saveMeaningNow();
                      }}
                      placeholder={chantierCopy.peoplePlanPlaceholder}
                      spellCheck
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-[20px] border border-[rgba(110,211,255,0.12)] bg-[rgba(4,24,39,0.72)] px-4 py-4">
                <div>
                  <div className="text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                    {chantierCopy.maturityTitle}
                  </div>
                  <div className="mt-1 text-[0.84rem] leading-6 text-[var(--ode-text-muted)]">
                    {chantierCopy.maturityHint}
                  </div>
                </div>
                <div className="mt-4 grid gap-4">
                  <label className="block">
                    <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                      {chantierCopy.maturityLevel}
                    </div>
                    <select
                      className="ode-input h-11 w-full rounded-[14px] px-3 text-[0.92rem]"
                      value={chantierProfileDraft.maturityLevel ?? "emerging"}
                      onChange={(event) =>
                        setChantierProfileDraft((current) => ({
                          ...current,
                          maturityLevel: event.target.value as ODEChantierMaturityLevel
                        }))
                      }
                      onBlur={() => {
                        void saveMeaningNow();
                      }}
                    >
                      {chantierCopy.maturityLevelOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                      {chantierCopy.transformationImpact}
                    </div>
                    <textarea
                      className="ode-input min-h-[88px] w-full resize-y rounded-[18px] px-4 py-3 text-[0.92rem] leading-7"
                      value={chantierProfileDraft.transformationImpact ?? ""}
                      onChange={(event) => updateChantierProfileDraft("transformationImpact", event.target.value)}
                      onBlur={() => {
                        void saveMeaningNow();
                      }}
                      placeholder={chantierCopy.transformationImpactPlaceholder}
                      spellCheck
                    />
                  </label>
                  <label className="block">
                    <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                      {chantierCopy.adoptionNotes}
                    </div>
                    <textarea
                      className="ode-input min-h-[88px] w-full resize-y rounded-[18px] px-4 py-3 text-[0.92rem] leading-7"
                      value={chantierProfileDraft.adoptionNotes ?? ""}
                      onChange={(event) => updateChantierProfileDraft("adoptionNotes", event.target.value)}
                      onBlur={() => {
                        void saveMeaningNow();
                      }}
                      placeholder={chantierCopy.adoptionNotesPlaceholder}
                      spellCheck
                    />
                  </label>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderInlineSectionEditor = (
    section: ProcedureSectionData,
    nodeLevel: number,
    options?: { compactReferences?: boolean; showHeadingCard?: boolean }
  ) => {
    const toneStyle = buildProcedureToneStyle(nodeLevel);
    const combinedSaveState: SaveState =
      bodySaveState === "error" || titleSaveState === "error"
        ? "error"
        : bodySaveState === "saving" || titleSaveState === "saving"
          ? "saving"
          : bodySaveState === "dirty" || titleSaveState === "dirty"
            ? "dirty"
            : bodySaveState === "saved" || titleSaveState === "saved"
              ? "saved"
              : "idle";
  const saveStateLabel =
      combinedSaveState === "saving"
        ? t("procedure.save_saving")
        : combinedSaveState === "error"
          ? t("procedure.save_error")
          : combinedSaveState === "dirty"
            ? t("procedure.save_pending")
            : t("procedure.save_saved");
  const previewNodes = renderProcedureBlocks(
    draft,
    globalNodeById,
    onSelectNode,
    onReviewFile,
    t("procedure.preview_empty")
  );

    return (
      <div className="space-y-5" data-ode-procedure-ignore-context="true" style={toneStyle}>
        {!systemFocusedMode && selectedReferenceId ? (
          <div className="rounded-[18px] border border-[var(--ode-border)] bg-[rgba(5,30,47,0.86)] px-4 py-3 text-[0.84rem] text-[var(--ode-text-dim)]">
            {t("procedure.editor_selected_file")}
          </div>
        ) : null}

        <div
          className="rounded-[28px] border px-5 py-5 shadow-[0_16px_48px_rgba(0,0,0,0.16)]"
          style={{
            borderColor: "var(--ode-procedure-border)",
            background: "linear-gradient(180deg,rgba(4,24,39,0.96),rgba(2,18,31,0.98))"
          }}
        >
          {systemFocusedMode ? (
            <div className="space-y-4">
              <label className="block">
                <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                  {t("procedure.node_title")}
                </div>
                <input
                  className="ode-input h-14 w-full rounded-[18px] px-4 text-[1.05rem] font-semibold tracking-tight"
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  onContextMenu={(event) => {
                    void openProcedureTextEditContextMenu(event, {
                      getValue: () => titleDraft,
                      setValue: (value) => setTitleDraft(value)
                    });
                  }}
                  onBlur={() => {
                    void saveTitleNow();
                  }}
                  onKeyDown={handleTitleKeyDown}
                  placeholder={t("procedure.node_title_placeholder")}
                />
              </label>
            </div>
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[rgba(110,211,255,0.14)] pb-4">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                <div className="text-[0.72rem] uppercase tracking-[0.16em]" style={{ color: "var(--ode-procedure-accent)" }}>
                  {t("desktop.view_procedure")}
                </div>
                <input
                  className="min-w-[220px] flex-1 border-none bg-transparent p-0 text-[clamp(1.2rem,2.2vw,1.8rem)] font-semibold tracking-tight text-[var(--ode-text)] outline-none placeholder:text-[var(--ode-text-muted)]"
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  onContextMenu={(event) => {
                    void openProcedureTextEditContextMenu(event, {
                      getValue: () => titleDraft,
                      setValue: (value) => setTitleDraft(value)
                    });
                  }}
                  onBlur={() => {
                    void saveTitleNow();
                  }}
                  onKeyDown={handleTitleKeyDown}
                  placeholder={t("procedure.inline_title_placeholder")}
                />
                {section.headingNumber ? (
                  <div
                    className="inline-flex rounded-full border px-3 py-1 text-[0.75rem] uppercase tracking-[0.12em]"
                    style={{
                      borderColor: "var(--ode-procedure-chip-border)",
                      background: "var(--ode-procedure-chip-bg)",
                      color: "var(--ode-procedure-accent)"
                    }}
                  >
                    {section.headingNumber}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="rounded-full border border-[var(--ode-procedure-chip-border)] bg-[var(--ode-procedure-chip-bg)] px-3 py-1 text-[0.72rem] uppercase tracking-[0.14em] text-[var(--ode-procedure-accent)]">
                  {saveStateLabel}
                </div>
                {exportMessage ? (
                  <div className="max-w-[340px] truncate rounded-full border border-[var(--ode-border)] bg-[rgba(7,34,53,0.78)] px-3 py-1 text-[0.72rem] text-[var(--ode-text-muted)]">
                    {exportMessage}
                  </div>
                ) : null}
                <button
                  type="button"
                  className={`${minimalActionButtonClass} h-10 px-4 text-[0.8rem]`}
                  onClick={() => {
                    void handleExport("pdf");
                  }}
                  disabled={exportState !== "idle"}
                >
                  {exportState === "pdf" ? t("procedure.export_pdf_busy") : t("procedure.export_pdf")}
                </button>
                <button
                  type="button"
                  className={`${minimalActionButtonClass} h-10 px-4 text-[0.8rem]`}
                  onClick={() => {
                    void handleExport("docx");
                  }}
                  disabled={exportState !== "idle"}
                >
                  {exportState === "docx" ? t("procedure.export_word_busy") : t("procedure.export_word")}
                </button>
              </div>
            </div>
          )}

          {!systemFocusedMode && editorPathLabel ? (
            <div className="mt-4 text-[0.84rem] leading-6 text-[var(--ode-text-muted)]">{editorPathLabel}</div>
          ) : null}

          {systemFocusedMode ? (
            <>
              <div className="mt-4 flex flex-wrap gap-3">
                {([
                  { key: "description" as const, label: t("procedure.node_description") },
                  ...(showChantierSteeringTab ? [{ key: "steering" as const, label: chantierCopy.steeringTab }] : []),
                  { key: "deliverables" as const, label: t("procedure.node_deliverables") }
                ] as Array<{ key: ProcedureSystemTabKey; label: string }>).map((tab) => {
                  const isActive = systemTab === tab.key;
                  return (
                    <button
                      key={`system-tab-${tab.key}`}
                      type="button"
                      className={`rounded-full border px-4 py-2 text-[0.82rem] uppercase tracking-[0.12em] transition ${
                        isActive
                          ? "border-[var(--ode-accent)] bg-[rgba(38,157,214,0.18)] text-[var(--ode-text)]"
                          : "border-[rgba(110,211,255,0.18)] bg-[rgba(5,29,46,0.54)] text-[var(--ode-text-dim)] hover:border-[var(--ode-border-accent)] hover:text-[var(--ode-text)]"
                      }`}
                      onClick={() => setSystemTab(tab.key)}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 rounded-[22px] border border-[rgba(110,211,255,0.16)] bg-[rgba(6,29,46,0.62)] px-4 py-4">
                {systemTab === "description" ? (
                  <div className="space-y-4">
                    <textarea
                      className="ode-input min-h-[132px] w-full resize-y rounded-[18px] px-4 py-3 text-[0.94rem] leading-7"
                      value={descriptionDraft}
                      onChange={(event) => setDescriptionDraft(event.target.value)}
                      onBlur={() => {
                        void saveMeaningNow();
                      }}
                      placeholder={t("procedure.node_description_placeholder")}
                      spellCheck
                    />
                    {renderChantierModeCard()}
                  </div>
                ) : systemTab === "steering" ? (
                  renderChantierSteeringForm()
                ) : (
                  <div className="space-y-4">
                    {deliverableAiError || integratedPlanAiError ? (
                      <div className="rounded-[16px] border border-[rgba(255,149,117,0.32)] bg-[rgba(80,28,18,0.34)] px-4 py-3 text-[0.88rem] text-[#ffd1c2]">
                        {integratedPlanAiError || deliverableAiError}
                      </div>
                    ) : null}

                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {renderTooltipActionButton(
                            integratedPlanAiBusy
                              ? t("procedure.integrated_ai_build_busy")
                              : t("procedure.deliverable_ai_generate"),
                            <SparkGlyphSmall />,
                            {
                              className: primaryLabeledActionButtonClass,
                              disabled:
                                deliverableAiBusy ||
                                deliverableAiSaveBusy ||
                                integratedPlanAiBusy ||
                                integratedPlanAiSaveBusy,
                              onClick: () => {
                                void generateIntegratedPlanWithAi();
                              }
                            }
                          )}
                          {renderTooltipActionButton(t("procedure.node_deliverable_add"), <PlusGlyphSmall />, {
                            className: labeledActionButtonClass,
                            onClick: () => addDeliverableDraft()
                          })}
                          {renderTooltipActionButton(t("procedure.ai_memory_button"), <ClockGlyphSmall />, {
                            className: labeledActionButtonClass,
                            onClick: () => openAiMemoryReview()
                          })}
                        </div>
                      </div>

                      {deliverableDrafts.length > 0 ? (
                        <div className="space-y-3">
                          {deliverableDrafts.map((deliverable) => {
                            const isSelected = deliverable.id === selectedDeliverable?.id;
                            return (
                              <div
                                key={deliverable.id}
                                ref={(element) => {
                                  if (element) {
                                    deliverableCardRefs.current.set(deliverable.id, element);
                                  } else {
                                    deliverableCardRefs.current.delete(deliverable.id);
                                  }
                                }}
                                className={`rounded-[18px] border px-3 py-3 transition ${
                                  isSelected
                                    ? "border-[var(--ode-accent)] bg-[rgba(38,157,214,0.14)]"
                                    : "border-[rgba(110,211,255,0.12)] bg-[rgba(4,24,39,0.72)]"
                                }`}
                                data-ode-procedure-ignore-context="true"
                                onClick={() => {
                                  setSelectedDeliverableId(deliverable.id);
                                }}
                              >
                                <div className="flex flex-wrap items-center gap-3">
                                  <input
                                    ref={(element) => {
                                      if (element) {
                                        deliverableInputRefs.current.set(deliverable.id, element);
                                      } else {
                                        deliverableInputRefs.current.delete(deliverable.id);
                                      }
                                    }}
                                    className="ode-input h-11 min-w-0 flex-1 rounded-[14px] px-3 text-[0.92rem]"
                                    value={deliverable.title}
                                    onFocus={() => {
                                      setSelectedDeliverableId(deliverable.id);
                                    }}
                                    onChange={(event) =>
                                      updateDeliverableDraft(deliverable.id, (current) => ({
                                        ...current,
                                        title: event.target.value
                                      }))
                                    }
                                    onBlur={() => {
                                      void saveMeaningNow();
                                    }}
                                    placeholder={t("procedure.node_deliverable_placeholder")}
                                  />
                                  {renderTooltipActionButton(t("procedure.execution_open"), <OpenGlyphSmall />, {
                                    className: labeledActionButtonClass,
                                    onClick: (event) => {
                                      event.stopPropagation();
                                      openExecutionModal(deliverable.id);
                                    }
                                  })}
                                  {renderTooltipIconButton(t("procedure.node_action_remove"), <TrashGlyphSmall />, {
                                    className: tallIconActionButtonClass,
                                    onClick: (event) => {
                                      event.stopPropagation();
                                      removeDeliverableDraft(deliverable.id);
                                    }
                                  })}
                                </div>
                                <div className="mt-4 rounded-[16px] border border-[rgba(110,211,255,0.12)] bg-[rgba(2,18,31,0.52)] px-3 py-3">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="inline-flex items-center gap-2 text-[0.74rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                                      <span>{t("procedure.node_tasks")}</span>
                                      <span className="inline-flex min-w-[1.8rem] items-center justify-center rounded-full border border-[rgba(110,211,255,0.18)] bg-[rgba(5,29,46,0.76)] px-2 py-0.5 text-[0.72rem] text-[var(--ode-text)]">
                                        {deliverable.tasks.length}
                                      </span>
                                    </div>
                                    {renderTooltipActionButton(t("procedure.node_task_add"), <PlusGlyphSmall />, {
                                      className: labeledActionButtonClass,
                                      onClick: (event) => {
                                        event.stopPropagation();
                                        const nextKey = addExecutionItem(deliverable.id, "tasks");
                                        if (nextKey) {
                                          focusDeliverableTaskPreviewInput(nextKey);
                                        }
                                      }
                                    })}
                                  </div>
                                  {deliverable.tasks.length > 0 ? (
                                    <div className="mt-3 space-y-2">
                                      {deliverable.tasks.map((task, taskIndex) => {
                                        const taskKey = getProcedureExecutionItemKey("tasks", task, taskIndex);
                                        return (
                                          <div
                                            key={task.id}
                                            className="flex items-center gap-2 rounded-[14px] border border-[rgba(110,211,255,0.1)] bg-[rgba(4,24,39,0.56)] px-2 py-2"
                                            onMouseDown={() => {
                                              setSelectedDeliverableId(deliverable.id);
                                              setSelectedExecutionItemKey(taskKey);
                                            }}
                                          >
                                            <div className="ml-1 h-2.5 w-2.5 rounded-full bg-[rgba(110,211,255,0.72)]" />
                                            <input
                                              ref={(element) => {
                                                if (element) {
                                                  deliverableTaskPreviewInputRefs.current.set(taskKey, element);
                                                } else {
                                                  deliverableTaskPreviewInputRefs.current.delete(taskKey);
                                                }
                                              }}
                                              className="ode-input h-10 min-w-0 flex-1 rounded-[12px] px-3 text-[0.9rem]"
                                              value={task.title}
                                              onFocus={() => {
                                                setSelectedDeliverableId(deliverable.id);
                                                setSelectedExecutionItemKey(taskKey);
                                              }}
                                              onChange={(event) =>
                                                updateDeliverableDraft(deliverable.id, (current) => ({
                                                  ...current,
                                                  tasks: current.tasks.map((item, itemIndex) =>
                                                    itemIndex === taskIndex ? { ...item, title: event.target.value } : item
                                                  )
                                                }))
                                              }
                                              onBlur={() => {
                                                void saveMeaningNow();
                                              }}
                                              placeholder={t("procedure.node_task_placeholder")}
                                            />
                                            {renderTooltipIconButton(t("procedure.node_action_remove"), <TrashGlyphSmall />, {
                                              className: tallIconActionButtonClass,
                                              onClick: (event) => {
                                                event.stopPropagation();
                                                removeExecutionItem(deliverable.id, "tasks", taskIndex);
                                              }
                                            })}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="mt-3 rounded-[14px] border border-dashed border-[var(--ode-border)] px-3 py-3 text-[0.84rem] text-[var(--ode-text-muted)]">
                                      {t("procedure.node_execution_empty")}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-[18px] border border-dashed border-[var(--ode-border)] px-4 py-4 text-[0.84rem] text-[var(--ode-text-muted)]">
                          <div>{t("procedure.node_actions_empty")}</div>
                          <div className="mt-3">
                            {renderTooltipActionButton(t("procedure.node_deliverable_add"), <PlusGlyphSmall />, {
                              className: labeledActionButtonClass,
                              onClick: () => addDeliverableDraft()
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-[22px] border border-[rgba(110,211,255,0.16)] bg-[rgba(6,29,46,0.62)] px-4 py-4">
              <div className="space-y-4">
                <label className="block">
                  <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                    {t("procedure.node_description")}
                  </div>
                  <textarea
                    className="ode-input min-h-[132px] w-full resize-y rounded-[18px] px-4 py-3 text-[0.94rem] leading-7"
                    value={descriptionDraft}
                    onChange={(event) => setDescriptionDraft(event.target.value)}
                    onBlur={() => {
                      void saveMeaningNow();
                    }}
                    placeholder={t("procedure.node_description_placeholder")}
                    spellCheck
                  />
                </label>

                <label className="block">
                  <div className="mb-2 text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                    {isChantierEditor ? chantierCopy.valueStatementLabel : t("procedure.node_objective")}
                  </div>
                  <textarea
                    className="ode-input min-h-[92px] w-full resize-y rounded-[18px] px-4 py-3 text-[0.94rem] leading-7"
                    value={objectiveDraft}
                    onChange={(event) => setObjectiveDraft(event.target.value)}
                    onBlur={() => {
                      void saveMeaningNow();
                    }}
                    placeholder={
                      isChantierEditor ? chantierCopy.valueStatementPlaceholder : t("procedure.node_objective_placeholder")
                    }
                    spellCheck
                  />
                </label>

                {canEnableManualChantierMode || canDisableManualChantierMode ? (
                  <div className="rounded-[18px] border border-[rgba(110,211,255,0.12)] bg-[rgba(4,24,39,0.72)] px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="max-w-[60ch] text-[0.84rem] leading-6 text-[var(--ode-text-muted)]">
                        {canDisableManualChantierMode ? chantierCopy.manualDisableHint : chantierCopy.manualHint}
                      </div>
                      <button
                        type="button"
                        className={`ode-text-btn h-10 rounded-[14px] px-4 text-[0.84rem] font-medium ${
                          canDisableManualChantierMode
                            ? "border-[rgba(255,154,120,0.28)] text-[#ffd1bf]"
                            : "border-[rgba(93,193,255,0.34)] text-[#bde8ff]"
                        }`.trim()}
                        disabled={chantierModeToggleBusy}
                        onClick={() => {
                          void setChantierModeNow(!canDisableManualChantierMode);
                        }}
                      >
                        {chantierModeToggleBusy
                          ? "..."
                          : canDisableManualChantierMode
                            ? chantierCopy.manualDisable
                            : chantierCopy.manualEnable}
                      </button>
                    </div>
                  </div>
                ) : null}

                {isChantierEditor ? (
                  <div className="space-y-3 rounded-[18px] border border-[rgba(110,211,255,0.12)] bg-[rgba(4,24,39,0.72)] px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                          {chantierCopy.sectionTitle}
                        </div>
                        <div className="mt-1 max-w-[56ch] text-[0.84rem] leading-6 text-[var(--ode-text-muted)]">
                          {chantierCopy.sectionHint}
                        </div>
                      </div>
                      <div className="min-w-[220px] rounded-[14px] border border-[rgba(110,211,255,0.16)] bg-[rgba(6,29,46,0.72)] px-3 py-2 text-right">
                        <div className="text-[0.68rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
                          {chantierCopy.linkedNA}
                        </div>
                        <div className="mt-1 text-[0.86rem] text-[var(--ode-text)]">
                          {chantierLinkedNADisplay ?? chantierCopy.linkedNAEmpty}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block">
                        <div className="mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                          {chantierCopy.status}
                        </div>
                        <select
                          className="ode-input h-11 w-full rounded-[14px] px-3 text-[0.92rem]"
                          value={chantierProfileDraft.status}
                          onChange={(event) =>
                            setChantierProfileDraft((current) => ({
                              ...current,
                              status: event.target.value as ODEChantierStatus
                            }))
                          }
                          onBlur={() => {
                            void saveMeaningNow();
                          }}
                        >
                          {chantierCopy.statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <div className="mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                          {chantierCopy.activity}
                        </div>
                        <input
                          className="ode-input h-11 w-full rounded-[14px] px-3 text-[0.92rem]"
                          value={chantierProfileDraft.activity ?? ""}
                          onChange={(event) => updateChantierProfileDraft("activity", event.target.value)}
                          onBlur={() => {
                            void saveMeaningNow();
                          }}
                          placeholder={chantierCopy.activityPlaceholder}
                        />
                      </label>

                      <label className="block">
                        <div className="mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                          {chantierCopy.qualityTarget}
                        </div>
                        <input
                          className="ode-input h-11 w-full rounded-[14px] px-3 text-[0.92rem]"
                          value={chantierProfileDraft.qualityTarget ?? ""}
                          onChange={(event) => updateChantierProfileDraft("qualityTarget", event.target.value)}
                          onBlur={() => {
                            void saveMeaningNow();
                          }}
                          placeholder={chantierCopy.targetPlaceholder}
                        />
                      </label>

                      <label className="block">
                        <div className="mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                          {chantierCopy.costTarget}
                        </div>
                        <input
                          className="ode-input h-11 w-full rounded-[14px] px-3 text-[0.92rem]"
                          value={chantierProfileDraft.costTarget ?? ""}
                          onChange={(event) => updateChantierProfileDraft("costTarget", event.target.value)}
                          onBlur={() => {
                            void saveMeaningNow();
                          }}
                          placeholder={chantierCopy.targetPlaceholder}
                        />
                      </label>

                      <label className="block">
                        <div className="mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                          {chantierCopy.delayTarget}
                        </div>
                        <input
                          className="ode-input h-11 w-full rounded-[14px] px-3 text-[0.92rem]"
                          value={chantierProfileDraft.delayTarget ?? ""}
                          onChange={(event) => updateChantierProfileDraft("delayTarget", event.target.value)}
                          onBlur={() => {
                            void saveMeaningNow();
                          }}
                          placeholder={chantierCopy.targetPlaceholder}
                        />
                      </label>
                    </div>

                    <label className="block">
                      <div className="mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                        {chantierCopy.resources}
                      </div>
                      <textarea
                        className="ode-input min-h-[88px] w-full resize-y rounded-[18px] px-4 py-3 text-[0.94rem] leading-7"
                        value={chantierProfileDraft.resources ?? ""}
                        onChange={(event) => updateChantierProfileDraft("resources", event.target.value)}
                        onBlur={() => {
                          void saveMeaningNow();
                        }}
                        placeholder={chantierCopy.resourcesPlaceholder}
                        spellCheck
                      />
                    </label>

                    <label className="block">
                      <div className="mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                        {chantierCopy.indicators}
                      </div>
                      <textarea
                        className="ode-input min-h-[88px] w-full resize-y rounded-[18px] px-4 py-3 text-[0.94rem] leading-7"
                        value={chantierProfileDraft.indicators ?? ""}
                        onChange={(event) => updateChantierProfileDraft("indicators", event.target.value)}
                        onBlur={() => {
                          void saveMeaningNow();
                        }}
                        placeholder={chantierCopy.indicatorsPlaceholder}
                        spellCheck
                      />
                    </label>

                    <div className="space-y-3 rounded-[18px] border border-[rgba(110,211,255,0.12)] bg-[rgba(3,19,31,0.72)] px-4 py-4">
                      <div>
                        <div className="text-[0.72rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                          {chantierCopy.governanceTitle}
                        </div>
                        <div className="mt-1 text-[0.84rem] leading-6 text-[var(--ode-text-muted)]">
                          {chantierCopy.governanceHint}
                        </div>
                      </div>

                      <label className="block">
                        <div className="mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                          {chantierCopy.approvalComment}
                        </div>
                        <textarea
                          className="ode-input min-h-[76px] w-full resize-y rounded-[18px] px-4 py-3 text-[0.94rem] leading-7"
                          value={chantierProfileDraft.approvalComment ?? ""}
                          onChange={(event) => updateChantierProfileDraft("approvalComment", event.target.value)}
                          onBlur={() => {
                            void saveMeaningNow();
                          }}
                          placeholder={chantierCopy.approvalCommentPlaceholder}
                          spellCheck
                        />
                      </label>

                      <label className="block">
                        <div className="mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                          {chantierCopy.decisionLog}
                        </div>
                        <textarea
                          className="ode-input min-h-[88px] w-full resize-y rounded-[18px] px-4 py-3 text-[0.94rem] leading-7"
                          value={chantierProfileDraft.decisionLog ?? ""}
                          onChange={(event) => updateChantierProfileDraft("decisionLog", event.target.value)}
                          onBlur={() => {
                            void saveMeaningNow();
                          }}
                          placeholder={chantierCopy.decisionLogPlaceholder}
                          spellCheck
                        />
                      </label>
                    </div>

                    <label className="block">
                      <div className="mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                        {chantierCopy.closureSummary}
                      </div>
                      <textarea
                        className="ode-input min-h-[88px] w-full resize-y rounded-[18px] px-4 py-3 text-[0.94rem] leading-7"
                        value={chantierProfileDraft.closureSummary ?? ""}
                        onChange={(event) => updateChantierProfileDraft("closureSummary", event.target.value)}
                        onBlur={() => {
                          void saveMeaningNow();
                        }}
                        placeholder={chantierCopy.closureSummaryPlaceholder}
                        spellCheck
                      />
                    </label>

                    <label className="block">
                      <div className="mb-2 text-[0.72rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                        {chantierCopy.retex}
                      </div>
                      <textarea
                        className="ode-input min-h-[88px] w-full resize-y rounded-[18px] px-4 py-3 text-[0.94rem] leading-7"
                        value={chantierProfileDraft.retex ?? ""}
                        onChange={(event) => updateChantierProfileDraft("retex", event.target.value)}
                        onBlur={() => {
                          void saveMeaningNow();
                        }}
                        placeholder={chantierCopy.retexPlaceholder}
                        spellCheck
                      />
                    </label>
                  </div>
                ) : null}

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                      {t("procedure.node_actions")}
                    </div>
                    {renderTooltipIconButton(t("procedure.node_deliverable_add"), <PlusGlyphSmall />, {
                      onClick: () => addDeliverableDraft()
                    })}
                  </div>

                  {deliverableDrafts.length > 0 ? (
                    <div className="space-y-3">
                      {deliverableDrafts.map((deliverable) => (
                        <div
                          key={deliverable.id}
                          ref={(element) => {
                            if (element) {
                              deliverableCardRefs.current.set(deliverable.id, element);
                            } else {
                              deliverableCardRefs.current.delete(deliverable.id);
                            }
                          }}
                          className="space-y-4 rounded-[18px] border border-[rgba(110,211,255,0.12)] bg-[rgba(4,24,39,0.72)] px-3 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              className="ode-input h-11 min-w-0 flex-1 rounded-[14px] px-3 text-[0.92rem]"
                              value={deliverable.title}
                              onChange={(event) =>
                                updateDeliverableDraft(deliverable.id, (current) => ({
                                  ...current,
                                  title: event.target.value
                                }))
                              }
                              onBlur={() => {
                                void saveMeaningNow();
                              }}
                              placeholder={t("procedure.node_deliverable_placeholder")}
                            />
                            {renderTooltipIconButton(t("procedure.node_action_remove"), <TrashGlyphSmall />, {
                              className: tallIconActionButtonClass,
                              onClick: () => {
                                removeDeliverableDraft(deliverable.id);
                              }
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[18px] border border-dashed border-[var(--ode-border)] px-4 py-4 text-[0.84rem] text-[var(--ode-text-muted)]">
                      {t("procedure.node_actions_empty")}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {!systemFocusedMode ? (
            <>
              <div className="mt-4 rounded-[22px] border border-[rgba(110,211,255,0.16)] bg-[rgba(6,29,46,0.62)] px-4 py-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
                      {t("procedure.preview_title")}
                    </div>
                  </div>
                </div>
                <div
                  className="space-y-3 rounded-[18px] border border-[rgba(110,211,255,0.12)] bg-[linear-gradient(180deg,rgba(4,24,39,0.72),rgba(3,18,30,0.88))] px-4 py-4"
                  onClick={() => {
                    draftTextareaRef.current?.focus();
                  }}
                >
                  {previewNodes}
                </div>
              </div>

              <div className="mt-4 rounded-[20px] border border-[rgba(110,211,255,0.14)] bg-[rgba(5,29,46,0.56)] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
                      {t("procedure.editor_toolbar")}
                    </div>
                  </div>
                  <button
                    ref={nodeLinkButtonRef}
                    type="button"
                    className={`${minimalActionButtonClass} h-10 px-4 text-[0.8rem]`}
                    onMouseDown={preserveEditorSelection}
                    onClick={() => {
                      openNodeLinkPicker();
                    }}
                  >
                    <NodeLinkGlyphSmall />
                    <span>{t("procedure.format_node_link")}</span>
                  </button>
                  <button
                    type="button"
                    className={`${minimalActionButtonClass} h-10 px-4 text-[0.8rem]`}
                    onMouseDown={preserveEditorSelection}
                    onClick={openExternalLinkDialog}
                  >
                    {t("procedure.format_link")}
                  </button>
                  <button
                    type="button"
                    className={`${minimalActionButtonClass} h-10 px-4 text-[0.8rem]`}
                    onMouseDown={preserveEditorSelection}
                    onClick={insertQuoteBlock}
                  >
                    {t("procedure.insert_quote")}
                  </button>
                  <button
                    type="button"
                    className={`${minimalActionButtonClass} h-10 px-4 text-[0.8rem]`}
                    onMouseDown={preserveEditorSelection}
                    onClick={insertDividerBlock}
                  >
                    {t("procedure.insert_divider")}
                  </button>
                  {onOpenAssistant ? (
                    <button type="button" className="ode-primary-btn h-10 px-4" onClick={onOpenAssistant}>
                      {t("procedure.ask_ai")}
                    </button>
                  ) : null}
                </div>
              </div>

              {nodeLinkPickerOpen ? (
                <div ref={nodeLinkPickerRef} className="mt-4 space-y-4 rounded-[20px] border border-[var(--ode-border)] bg-[rgba(5,29,46,0.72)] px-4 py-4">
                  <div className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
                    {t("procedure.node_link_picker_title")}
                  </div>
                  <input
                    ref={nodeLinkQueryInputRef}
                    className="ode-input h-11 w-full rounded-[16px] px-4"
                    value={nodeLinkQuery}
                    onChange={(event) => setNodeLinkQuery(event.target.value)}
                    placeholder={t("procedure.node_link_picker_search_placeholder")}
                  />

                  <div className="space-y-3">
                    <div>
                      <div className="mb-2 text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
                        {t("procedure.node_link_picker_current_workspace")}
                      </div>
                      <div className="space-y-2">
                        {currentWorkspaceNodeLinkCandidates.length > 0 ? (
                          currentWorkspaceNodeLinkCandidates.map((candidate) => (
                            <button
                              key={candidate.node.id}
                              type="button"
                              className="flex w-full flex-col rounded-[18px] border border-[var(--ode-border)] bg-[rgba(5,29,46,0.76)] px-4 py-3 text-left transition hover:border-[var(--ode-border-strong)] hover:bg-[rgba(7,37,58,0.84)]"
                              onClick={() => insertNodeLink(candidate)}
                            >
                              <span className="ode-wrap-text text-[0.92rem] font-medium text-[var(--ode-text)]">{candidate.node.name}</span>
                              <span className="ode-wrap-text mt-1 text-[0.8rem] leading-5 text-[var(--ode-text-muted)]">{candidate.pathLabel}</span>
                            </button>
                          ))
                        ) : (
                          <div className="rounded-[18px] border border-dashed border-[var(--ode-border)] px-4 py-3 text-[0.84rem] text-[var(--ode-text-muted)]">
                            {t("procedure.node_link_picker_empty")}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
                        {t("procedure.node_link_picker_other_workspaces")}
                      </div>
                      <div className="space-y-2">
                        {otherWorkspaceNodeLinkCandidates.length > 0 ? (
                          otherWorkspaceNodeLinkCandidates.map((candidate) => (
                            <button
                              key={candidate.node.id}
                              type="button"
                              className="flex w-full flex-col rounded-[18px] border border-[var(--ode-border)] bg-[rgba(5,29,46,0.76)] px-4 py-3 text-left transition hover:border-[var(--ode-border-strong)] hover:bg-[rgba(7,37,58,0.84)]"
                              onClick={() => insertNodeLink(candidate)}
                            >
                              <span className="ode-wrap-text text-[0.92rem] font-medium text-[var(--ode-text)]">
                                {candidate.node.name}
                                <span className="ml-2 text-[0.76rem] uppercase tracking-[0.14em] text-[var(--ode-text-muted)]">
                                  {candidate.workspaceName}
                                </span>
                              </span>
                              <span className="ode-wrap-text mt-1 text-[0.8rem] leading-5 text-[var(--ode-text-muted)]">{candidate.pathLabel}</span>
                            </button>
                          ))
                        ) : (
                          <div className="rounded-[18px] border border-dashed border-[var(--ode-border)] px-4 py-3 text-[0.84rem] text-[var(--ode-text-muted)]">
                            {t("procedure.node_link_picker_empty")}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
                    {t("procedure.editor_title")}
                  </div>
                </div>
                <textarea
                  ref={draftTextareaRef}
                  className="ode-input ode-procedure-editor-textarea min-h-[360px] w-full resize-y rounded-[22px] px-5 py-4 text-[0.98rem] leading-8"
                  value={draft}
                  onChange={(event) => {
                    draftRef.current = event.target.value;
                    setDraft(event.target.value);
                    syncDraftSelection(event.currentTarget);
                    syncDraftMention(
                      event.target.value,
                      event.currentTarget.selectionStart ?? event.target.value.length,
                      event.currentTarget.selectionEnd ?? event.currentTarget.selectionStart ?? event.target.value.length
                    );
                  }}
                  onFocus={(event) => {
                    syncDraftSelection(event.currentTarget);
                    syncDraftMention(
                      event.currentTarget.value,
                      event.currentTarget.selectionStart ?? event.currentTarget.value.length,
                      event.currentTarget.selectionEnd ?? event.currentTarget.selectionStart ?? event.currentTarget.value.length
                    );
                  }}
                  onClick={(event) => {
                    syncDraftSelection(event.currentTarget);
                    syncDraftMention(
                      event.currentTarget.value,
                      event.currentTarget.selectionStart ?? event.currentTarget.value.length,
                      event.currentTarget.selectionEnd ?? event.currentTarget.selectionStart ?? event.currentTarget.value.length
                    );
                  }}
                  onKeyUp={(event) => {
                    syncDraftSelection(event.currentTarget);
                    syncDraftMention(
                      event.currentTarget.value,
                      event.currentTarget.selectionStart ?? event.currentTarget.value.length,
                      event.currentTarget.selectionEnd ?? event.currentTarget.selectionStart ?? event.currentTarget.value.length
                    );
                  }}
                  onSelect={(event) => {
                    syncDraftSelection(event.currentTarget);
                    syncDraftMention(
                      event.currentTarget.value,
                      event.currentTarget.selectionStart ?? event.currentTarget.value.length,
                      event.currentTarget.selectionEnd ?? event.currentTarget.selectionStart ?? event.currentTarget.value.length
                    );
                  }}
                  onContextMenu={(event) => {
                    void openProcedureTextEditContextMenu(event, {
                      getValue: () => draftRef.current,
                      setValue: (value) => {
                        draftRef.current = value;
                        setDraft(value);
                      }
                    });
                  }}
                  onBlur={() => {
                    setMentionState(null);
                    void saveNow();
                  }}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder={t("procedure.editor_placeholder")}
                  spellCheck
                />
              </div>
              {mentionState ? (
                <div className="mt-4 rounded-[20px] border border-[rgba(110,211,255,0.18)] bg-[rgba(6,28,44,0.82)] px-4 py-4">
                  <div className="space-y-2">
                    {mentionCandidates.length > 0 ? (
                      mentionCandidates.map((candidate, index) => (
                        <button
                          key={candidate.node.id}
                          type="button"
                          className={`flex w-full flex-col rounded-[16px] border px-4 py-3 text-left transition ${
                            index === mentionSelectionIndex
                              ? "border-[var(--ode-accent)] bg-[rgba(10,54,82,0.82)]"
                              : "border-[var(--ode-border)] bg-[rgba(5,29,46,0.7)] hover:border-[var(--ode-border-strong)] hover:bg-[rgba(7,37,58,0.84)]"
                          }`}
                          onMouseDown={(event) => {
                            event.preventDefault();
                          }}
                          onClick={() => insertMentionNodeLink(candidate)}
                        >
                          <span className="ode-wrap-text text-[0.92rem] font-medium text-[var(--ode-text)]">{candidate.node.name}</span>
                          <span className="ode-wrap-text mt-1 text-[0.8rem] leading-5 text-[var(--ode-text-muted)]">
                            {candidate.workspaceName}
                            {candidate.pathLabel ? ` / ${candidate.pathLabel}` : ""}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-[16px] border border-dashed border-[var(--ode-border)] px-4 py-3 text-[0.84rem] text-[var(--ode-text-muted)]">
                        {t("procedure.node_link_picker_empty")}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center gap-3 text-[0.8rem] text-[var(--ode-text-muted)]">
                <span>Ctrl+S</span>
                <span>Ctrl+Shift+K</span>
                <span>@node</span>
              </div>
            </>
          ) : null}
        </div>

        {!systemFocusedMode && section.references.length > 0
          ? renderReferenceCards(section.references, {
              compact: options?.compactReferences ?? false,
              title: t("procedure.references")
            })
          : null}

        {saveError ? (
          <div className="rounded-[18px] border border-[rgba(244,102,102,0.36)] bg-[rgba(78,21,21,0.42)] px-4 py-3 text-[0.84rem] text-[#ffb0b0]">
            {saveError}
          </div>
        ) : null}
      </div>
    );
  };

  const currentSectionLevel = getProcedureNodeLevel(
    currentSection?.node.id ?? rootNode?.id ?? "",
    nodeLevelById,
    currentSection?.depth ?? 1
  );
  const currentToneStyle = buildProcedureToneStyle(currentSectionLevel);

  const renderSectionHeadingCard = (section: ProcedureSectionData, nodeLevel: number, label: string, hint: string) => {
    const toneStyle = buildProcedureToneStyle(nodeLevel);
    return (
      <section
        data-ode-node-id={section.node.id}
        className="rounded-[28px] border px-5 py-5 shadow-[0_16px_48px_rgba(0,0,0,0.18)]"
        style={{
          ...toneStyle,
          borderColor: "var(--ode-procedure-border)",
          background: "linear-gradient(180deg,rgba(4,25,40,0.96),rgba(3,20,33,0.94))"
        }}
      >
        <div className="text-[0.72rem] uppercase tracking-[0.16em]" style={{ color: "var(--ode-procedure-accent)" }}>
          {label}
        </div>
        <div className="mt-2 max-w-[54ch] text-[0.9rem] leading-6 text-[var(--ode-text-muted)]">{hint}</div>
        <input
          className="mt-5 min-w-0 w-full border-none bg-transparent p-0 text-[clamp(1.6rem,3vw,2.3rem)] font-semibold tracking-tight text-[var(--ode-text)] outline-none placeholder:text-[var(--ode-text-muted)]"
          value={titleDraft}
          onChange={(event) => setTitleDraft(event.target.value)}
          onContextMenu={(event) => {
            void openProcedureTextEditContextMenu(event, {
              getValue: () => titleDraft,
              setValue: (value) => setTitleDraft(value)
            });
          }}
          onBlur={() => {
            void saveTitleNow();
          }}
          onKeyDown={handleTitleKeyDown}
          placeholder={t("procedure.inline_title_placeholder")}
        />
        {editorPathLabel ? <div className="mt-3 text-[0.84rem] leading-6 text-[var(--ode-text-muted)]">{editorPathLabel}</div> : null}
        {section.headingNumber ? (
          <div
            className="mt-4 inline-flex rounded-full border px-3 py-1 text-[0.75rem] uppercase tracking-[0.12em]"
            style={{
              borderColor: "var(--ode-procedure-chip-border)",
              background: "var(--ode-procedure-chip-bg)",
              color: "var(--ode-procedure-accent)"
            }}
          >
            {section.headingNumber}
          </div>
        ) : null}
      </section>
    );
  };

  const linkDialogDrag = useDraggableModalSurface({ open: Boolean(linkDialogState) });
  const executionDialogDrag = useDraggableModalSurface({
    open: systemFocusedMode && executionModalOpen && Boolean(selectedDeliverable)
  });

  if (!rootNode || !liveProcedureTree || !editorNode) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-[var(--ode-text-dim)]">
        {t("procedure.empty")}
      </div>
    );
  }

  return (
    <div
      className="min-h-0 flex-1 overflow-hidden bg-[linear-gradient(180deg,rgba(3,22,36,0.96),rgba(2,16,27,0.98))]"
      data-ode-surface="procedure"
      data-ode-procedure-surface="true"
      onMouseDownCapture={onActivateProcedureSurface}
    >
      <TextEditContextMenu
        t={t}
        menu={procedureTextEditMenu}
        canCopy={(procedureTextEditMenu?.selectionEnd ?? 0) > (procedureTextEditMenu?.selectionStart ?? 0)}
        canCut={(procedureTextEditMenu?.selectionEnd ?? 0) > (procedureTextEditMenu?.selectionStart ?? 0)}
        onClose={() => setProcedureTextEditMenu(null)}
        onUseSuggestion={runProcedureTextMenuSuggestion}
        onCut={() => {
          void runProcedureTextMenuCut();
        }}
        onCopy={() => {
          void runProcedureTextMenuCopy();
        }}
        onPaste={() => {
          void runProcedureTextMenuPaste();
        }}
        onSelectAll={runProcedureTextMenuSelectAll}
      />
      {linkDialogState ? (
        <div className="ode-overlay-scrim fixed inset-0 z-[135] flex items-center justify-center p-4" data-ode-procedure-ignore-context="true">
          <div
            ref={linkDialogDrag.surfaceRef}
            style={linkDialogDrag.surfaceStyle}
            className="w-full max-w-xl rounded-[28px] border border-[var(--ode-border-strong)] bg-[linear-gradient(180deg,rgba(4,24,39,0.98),rgba(2,18,31,0.98))] px-6 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.36)]"
          >
            <div className="ode-modal-drag-handle text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-accent)]" onPointerDown={linkDialogDrag.handlePointerDown}>{t("procedure.format_link")}</div>
            <div className="mt-4 space-y-4">
              <label className="block">
                <div className="mb-2 text-[0.82rem] text-[var(--ode-text-dim)]">{t("procedure.link_default_text")}</div>
                <input
                  className="ode-input h-11 w-full rounded-[16px] px-4"
                  value={linkDialogState.label}
                  onChange={(event) =>
                    setLinkDialogState((current) => (current ? { ...current, label: event.target.value } : current))
                  }
                  placeholder={t("procedure.link_default_text")}
                  autoFocus
                />
              </label>
              <label className="block">
                <div className="mb-2 text-[0.82rem] text-[var(--ode-text-dim)]">{t("procedure.link_prompt")}</div>
                <input
                  className="ode-input h-11 w-full rounded-[16px] px-4"
                  value={linkDialogState.href}
                  onChange={(event) =>
                    setLinkDialogState((current) => (current ? { ...current, href: event.target.value } : current))
                  }
                  placeholder="www.example.com"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      confirmExternalLinkDialog();
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setLinkDialogState(null);
                    }
                  }}
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className={`${minimalActionButtonClass} h-10 px-4`} onClick={() => setLinkDialogState(null)}>
                {t("settings.cancel")}
              </button>
              <button type="button" className="ode-primary-btn h-10 px-4" onClick={confirmExternalLinkDialog}>
                {t("procedure.format_link")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {systemFocusedMode && executionModalOpen && selectedDeliverable ? (
        <div
          className="ode-overlay-scrim fixed inset-0 z-[136] flex items-start justify-center overflow-y-auto p-4 backdrop-blur-sm"
          data-ode-procedure-ignore-context="true"
          onMouseDown={(event) => {
            if (event.target !== event.currentTarget) return;
            setExecutionModalOpen(false);
          }}
        >
          <div
            ref={executionDialogDrag.surfaceRef}
            style={executionDialogDrag.surfaceStyle}
            className="ode-modal my-4 flex max-h-[calc(100vh-2rem)] w-full max-w-[820px] flex-col overflow-hidden rounded-[24px] border border-[var(--ode-border-strong)] bg-[rgba(2,18,31,0.98)]"
            role="dialog"
            aria-modal="true"
            aria-label={t("procedure.execution_sidebar")}
          >
            <div className="ode-modal-drag-handle flex items-center justify-between border-b border-[var(--ode-border)] px-6 py-4" onPointerDown={executionDialogDrag.handlePointerDown}>
              <div className="min-w-0">
                <div className="text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                  {t("procedure.execution_sidebar")}
                </div>
                <div className="ode-wrap-text mt-1 text-[1.25rem] font-semibold text-[var(--ode-text)]">
                  {selectedDeliverable.title.trim() || t("procedure.node_deliverable_placeholder")}
                </div>
                <div className="ode-wrap-text mt-1 text-[0.9rem] text-[var(--ode-text-muted)]">
                  {titleDraft.trim() || editorNode.name}
                </div>
              </div>
              <button
                type="button"
                className="ode-icon-btn h-10 w-10 text-[1.35rem]"
                aria-label={t("procedure.execution_close")}
                onClick={() => {
                  setExecutionModalOpen(false);
                }}
              >
                {"\u00d7"}
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  {executionTabs.map((tab) => {
                    const isActive = tab.key === activeExecutionTab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        className={`rounded-full border px-4 py-2 text-[0.82rem] uppercase tracking-[0.12em] transition ${
                          isActive
                            ? "border-[var(--ode-accent)] bg-[rgba(38,157,214,0.18)] text-[var(--ode-text)]"
                            : "border-[var(--ode-border)] bg-[rgba(4,24,39,0.42)] text-[var(--ode-text-muted)]"
                        }`}
                        onClick={() => {
                          setExecutionTab(tab.key);
                        }}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {workstreamAiError ? (
                  <div className="rounded-[16px] border border-[rgba(255,149,117,0.32)] bg-[rgba(80,28,18,0.34)] px-4 py-3 text-[0.88rem] text-[#ffd1c2]">
                    {workstreamAiError}
                  </div>
                ) : null}

                <div className="space-y-4 rounded-[20px] border border-[rgba(110,211,255,0.14)] bg-[rgba(5,29,46,0.62)] px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-[0.8rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                      {activeExecutionTab.label}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {activeExecutionTab.key === "tasks" ? (
                        renderTooltipActionButton(
                          workstreamAiBusyDeliverableId === selectedDeliverable.id
                            ? t("procedure.workstream_ai_generate_busy")
                            : t("procedure.workstream_ai_generate"),
                          <SparkGlyphSmall />,
                          {
                            className: primaryLabeledActionButtonClass,
                            disabled: Boolean(workstreamAiBusyDeliverableId) || workstreamAiSaveBusy,
                            onClick: () => {
                              void generateDeliverableTasksWithAi(selectedDeliverable);
                            }
                          }
                        )
                      ) : null}
                      {renderTooltipActionButton(activeExecutionTab.addLabel, <PlusGlyphSmall />, {
                        className: labeledActionButtonClass,
                        onClick: () => {
                          const nextKey = addExecutionItem(selectedDeliverable.id, activeExecutionTab.key);
                          if (nextKey) {
                            focusExecutionItemInput(nextKey);
                          }
                        }
                      })}
                    </div>
                  </div>

                  {selectedDeliverable[activeExecutionTab.key].length > 0 ? (
                    activeExecutionTab.key === "tasks" ? (
                      <div className="space-y-2">
                        {selectedDeliverable.tasks.map((entry, entryIndex) => {
                          const itemKey = getProcedureExecutionItemKey(activeExecutionTab.key, entry, entryIndex);
                          const isSelected = itemKey === selectedExecutionItemKey;
                          return (
                        <div
                          key={entry.id}
                          ref={(element) => {
                            if (element) {
                              executionItemRowRefs.current.set(itemKey, element);
                            } else {
                              executionItemRowRefs.current.delete(itemKey);
                            }
                          }}
                          className={`flex items-center gap-2 rounded-[16px] border px-2 py-2 transition ${
                            isSelected
                              ? "border-[var(--ode-accent)] bg-[rgba(38,157,214,0.12)]"
                              : "border-transparent bg-transparent"
                          }`}
                          data-ode-procedure-ignore-context="true"
                          onMouseDown={() => {
                            setSelectedExecutionItemKey(itemKey);
                          }}
                        >
                          <input
                            ref={(element) => {
                              if (element) {
                                executionItemInputRefs.current.set(itemKey, element);
                              } else {
                                executionItemInputRefs.current.delete(itemKey);
                              }
                            }}
                            className="ode-input h-11 min-w-0 flex-1 rounded-[14px] px-3 text-[0.92rem]"
                            value={entry.title}
                            onFocus={() => {
                              setSelectedExecutionItemKey(itemKey);
                            }}
                            onChange={(event) =>
                              updateDeliverableDraft(selectedDeliverable.id, (current) => ({
                                ...current,
                                tasks: current.tasks.map((item, itemIndex) =>
                                  itemIndex === entryIndex ? { ...item, title: event.target.value } : item
                                )
                              }))
                            }
                            onBlur={() => {
                              void saveMeaningNow();
                            }}
                            placeholder={activeExecutionTab.placeholder}
                          />
                          {renderTooltipIconButton(t("procedure.node_action_remove"), <TrashGlyphSmall />, {
                            className: tallIconActionButtonClass,
                            onClick: (event) => {
                              event.stopPropagation();
                              removeExecutionItem(selectedDeliverable.id, activeExecutionTab.key, entryIndex);
                            }
                          })}
                        </div>
                        )})}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedDeliverable[activeExecutionTab.key].map((entry, entryIndex) => {
                          const itemKey = getProcedureExecutionItemKey(activeExecutionTab.key, entry, entryIndex);
                          const isSelected = itemKey === selectedExecutionItemKey;
                          return (
                        <div
                          key={`${selectedDeliverable.id}-${activeExecutionTab.key}-${entryIndex}`}
                          ref={(element) => {
                            if (element) {
                              executionItemRowRefs.current.set(itemKey, element);
                            } else {
                              executionItemRowRefs.current.delete(itemKey);
                            }
                          }}
                          className={`flex items-center gap-2 rounded-[16px] border px-2 py-2 transition ${
                            isSelected
                              ? "border-[var(--ode-accent)] bg-[rgba(38,157,214,0.12)]"
                              : "border-transparent bg-transparent"
                          }`}
                          data-ode-procedure-ignore-context="true"
                          onMouseDown={() => {
                            setSelectedExecutionItemKey(itemKey);
                          }}
                        >
                          <input
                            ref={(element) => {
                              if (element) {
                                executionItemInputRefs.current.set(itemKey, element);
                              } else {
                                executionItemInputRefs.current.delete(itemKey);
                              }
                            }}
                            className="ode-input h-11 min-w-0 flex-1 rounded-[14px] px-3 text-[0.92rem]"
                            value={entry}
                            onFocus={() => {
                              setSelectedExecutionItemKey(itemKey);
                            }}
                            onChange={(event) =>
                              updateDeliverableDraft(selectedDeliverable.id, (current) => ({
                                ...current,
                                [activeExecutionTab.key]: current[activeExecutionTab.key].map((item, itemIndex) =>
                                  itemIndex === entryIndex ? event.target.value : item
                                )
                              }))
                            }
                            onBlur={() => {
                              void saveMeaningNow();
                            }}
                            placeholder={activeExecutionTab.placeholder}
                          />
                          {renderTooltipIconButton(t("procedure.node_action_remove"), <TrashGlyphSmall />, {
                            className: tallIconActionButtonClass,
                            onClick: (event) => {
                              event.stopPropagation();
                              removeExecutionItem(selectedDeliverable.id, activeExecutionTab.key, entryIndex);
                            }
                          })}
                        </div>
                        )})}
                      </div>
                    )
                  ) : (
                    <div className="rounded-[16px] border border-dashed border-[var(--ode-border)] px-4 py-5 text-[0.86rem] text-[var(--ode-text-muted)]">
                      <div>{t("procedure.node_execution_empty")}</div>
                      <div className="mt-3">
                        {renderTooltipActionButton(activeExecutionTab.addLabel, <PlusGlyphSmall />, {
                          className: labeledActionButtonClass,
                          onClick: () => {
                            const nextKey = addExecutionItem(selectedDeliverable.id, activeExecutionTab.key);
                            if (nextKey) {
                              focusExecutionItemInput(nextKey);
                            }
                          }
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end border-t border-[var(--ode-border)] px-6 py-4">
              <button
                type="button"
                className="ode-text-btn h-11 px-5"
                onClick={() => {
                  setExecutionModalOpen(false);
                }}
              >
                {t("procedure.execution_close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {deliverableProposal ? (
        <AiWorkspaceModal
          view="deliverable-proposal"
          open
          t={t}
          proposal={deliverableProposal}
          nodeTitle={titleDraft.trim() || editorNode?.name || null}
          onChangeProposal={setDeliverableProposal}
          onClose={() => {
            if (deliverableAiSaveBusy) return;
            setDeliverableProposal(null);
          }}
          onConfirm={() => {
            if (deliverableAiSaveBusy) return;
            void acceptDeliverableProposal();
          }}
        />
      ) : integratedPlanProposal ? (
        <AiWorkspaceModal
          view="integrated-plan"
          open
          t={t}
          proposal={integratedPlanProposal}
          nodeTitle={titleDraft.trim() || editorNode?.name || null}
          onChangeProposal={setIntegratedPlanProposal}
          onClose={() => {
            if (integratedPlanAiSaveBusy) return;
            setIntegratedPlanProposal(null);
          }}
          onConfirm={() => {
            if (integratedPlanAiSaveBusy) return;
            void acceptIntegratedPlanProposal();
          }}
        />
      ) : workstreamProposal ? (
        <AiWorkspaceModal
          view="workstream-proposal"
          open
          t={t}
          proposal={workstreamProposal}
          nodeTitle={titleDraft.trim() || editorNode?.name || null}
          deliverableTitle={
            deliverableDrafts.find((deliverable) => deliverable.id === workstreamProposal.deliverableId)?.title ?? null
          }
          onChangeProposal={setWorkstreamProposal}
          onClose={() => {
            if (workstreamAiSaveBusy) return;
            setWorkstreamProposal(null);
          }}
          onConfirm={() => {
            if (workstreamAiSaveBusy) return;
            void acceptWorkstreamProposal();
          }}
        />
      ) : aiMemoryReviewOpen ? (
        <AiWorkspaceModal
          view="memory-review"
          open
          t={t}
          entries={aiMemoryEntries}
          onClose={() => setAiMemoryReviewOpen(false)}
          onRemove={removeAiMemoryEntry}
          onClearAll={clearAiMemoryEntries}
        />
      ) : null}
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div
            className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 py-5 lg:px-6"
            onContextMenu={(event) => {
              if (shouldIgnoreProcedureNodeContextMenu(event.target)) return;
              onOpenSurfaceContextMenu(event);
            }}
          >
            <section
              data-ode-node-id={currentSection?.node.id ?? editorNode.id}
              className="min-w-0 rounded-[34px] border p-5 lg:p-6"
              style={{
                ...currentToneStyle,
                borderColor: "var(--ode-procedure-border)",
                background: "linear-gradient(180deg,rgba(4,24,39,0.96),rgba(2,18,31,0.98))",
                boxShadow: "0 18px 60px rgba(0,0,0,0.2)"
              }}
              onContextMenu={(event) => {
                if (shouldIgnoreProcedureNodeContextMenu(event.target)) return;
                onOpenNodeContextMenu(event, currentSection?.node.id ?? editorNode.id);
              }}
            >
              {renderInlineSectionEditor(currentSection ?? liveProcedureTree, currentSectionLevel, {
                compactReferences: true
              })}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}





