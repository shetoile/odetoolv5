import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject
} from "react";
import { NodeGlyph, UploadGlyphSmall } from "@/components/Icons";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import { DashboardPanel } from "@/components/views/DashboardPanel";
import { ReusableLibraryPanel } from "@/components/views/ReusableLibraryPanel";
import { getChantierLinkedNADisplay, isChantierNode, readChantierProfile } from "@/features/ode/chantierProfile";
import { getLocaleForLanguage, type LanguageCode, type TranslationParams } from "@/lib/i18n";
import { NA_CATALOG, NA_CATALOG_VERSION, getNAPathLabel } from "@/lib/naCatalog";
import { getNodeDisplayName } from "@/lib/nodeDisplay";
import {
  buildMindMapThemeStyle,
  buildMindMapThemeStyleFromTheme,
  QUICK_ACCESS_GROUP_THEME,
  type MindMapThemeStyle
} from "@/lib/mindMapTheme";
import { getODENodeMetadata } from "@/lib/odePolicy";
import type {
  AppNode,
  FolderNodeState,
  ODEChantierMaturityLevel,
  ODEChantierStatus
} from "@/lib/types";
import { isFileLikeNode } from "@/lib/types";
import type { ODELibraryKind, ReusableLibraryIndexItem } from "@/lib/reusableLibraries";

type TranslateFn = (key: string, params?: TranslationParams) => string;
type DesktopViewMode = "grid" | "mindmap" | "details" | "dashboard" | "library" | "procedure";
type MindMapOrientation = "horizontal" | "vertical";
type MindMapContentMode = "quick_access" | "node_tree";
type SelectionSurface = "tree" | "grid" | "timeline";
type DropPosition = "before" | "inside" | "after";
type QuickAccessMindMapGroup = {
  id: string;
  name: string;
  nodes: AppNode[];
  synthetic?: boolean;
};
type ChantierStatusFilter = "all" | ODEChantierStatus;
type WorkspacePortfolioScope = "all" | "readiness" | "active" | "ready";
type WorkspacePortfolioSort = "status" | "planning" | "owner" | "updated";
type PortfolioHotspotKind = "role" | "skill";
type MindMapVerticalConnectorBounds = {
  start: number;
  end: number;
};

type DropIndicator = { targetId: string; position: DropPosition } | null;
const DETAILS_VIRTUAL_ROW_HEIGHT = 42;
const DETAILS_VIRTUAL_OVERSCAN = 10;
const DETAILS_VIRTUALIZE_MIN_ROWS = 120;
function partitionAlternating<T>(items: T[]) {
  const left: T[] = [];
  const right: T[] = [];
  items.forEach((item, idx) => {
    if (idx % 2 === 0) {
      right.push(item);
    } else {
      left.push(item);
    }
  });
  return { left, right };
}

function shouldCenterMindMapLabel(text: string) {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return false;
  const wordCount = normalized.split(" ").filter(Boolean).length;
  return normalized.length <= 28 && wordCount <= 4;
}

function splitPortfolioTokens(value: string | null | undefined) {
  if (!value) return [];
  return value
    .split(/[\n,;|/]+/g)
    .map((token) => token.trim())
    .filter(Boolean);
}

function getChantierStatusCopy(
  language: LanguageCode
): {
  portfolioTitle: string;
  portfolioSummary: (count: number) => string;
  governanceTitle: string;
  governanceSummary: (count: number) => string;
  managementTitle: string;
  managementSummary: (count: number) => string;
  commandCenterTitle: string;
  commandCenterSummary: (count: number) => string;
  portfolioListTitle: string;
  portfolioListSummary: (count: number) => string;
  portfolioSearchPlaceholder: string;
  portfolioEmptyFiltered: string;
  planningRadarTitle: string;
  planningRadarSummary: string;
  platformBoardTitle: string;
  platformBoardSummary: string;
  executionBoardTitle: string;
  executionBoardSummary: string;
  traceabilityBoardTitle: string;
  traceabilityBoardSummary: string;
  peopleBoardTitle: string;
  peopleBoardSummary: string;
  maturityBoardTitle: string;
  maturityBoardSummary: string;
  catalogCoverageTitle: string;
  naCoverageTitle: string;
  unanchoredChantiersTitle: string;
  emptyCatalogCoverage: string;
  emptyNACoverage: string;
  emptyUnanchoredChantiers: string;
  catalogVersion: string;
  anchoredChantiers: string;
  uniqueNAAnchors: string;
  level4CatalogEntries: string;
  ownerLoadTitle: string;
  planningWindowsTitle: string;
  readinessGapsTitle: string;
  capacityConflictsTitle: string;
  cadenceWatchTitle: string;
  signoffWatchTitle: string;
  closureWatchTitle: string;
  roleHotspotsTitle: string;
  peopleGapsTitle: string;
  maturityDistributionTitle: string;
  transformationWatchTitle: string;
  emptyOwnerLoad: string;
  emptyPlanningWindows: string;
  emptyReadinessGaps: string;
  emptyCapacityConflicts: string;
  emptyCadenceWatch: string;
  emptySignoffWatch: string;
  emptyClosureWatch: string;
  emptyRoleHotspots: string;
  emptyPeopleGaps: string;
  emptyMaturityDistribution: string;
  emptyTransformationWatch: string;
  activeNow: string;
  needsAttention: string;
  noActive: string;
  noAttention: string;
  all: string;
  chantier: string;
  linkedNA: string;
  unassigned: string;
  unwindowed: string;
  portfolioScopes: {
    all: string;
    readiness: string;
    active: string;
    ready: string;
  };
  portfolioSorts: {
    status: string;
    planning: string;
    owner: string;
    updated: string;
  };
  reviewLanes: {
    frameAndDecide: string;
    readyToLaunch: string;
    activeExecution: string;
    pausedBlocked: string;
    closureMemory: string;
  };
  reviewLaneHints: {
    frameAndDecide: string;
    readyToLaunch: string;
    activeExecution: string;
    pausedBlocked: string;
    closureMemory: string;
  };
  reviewLaneEmpty: {
    frameAndDecide: string;
    readyToLaunch: string;
    activeExecution: string;
    pausedBlocked: string;
    closureMemory: string;
  };
  signals: {
    owner: string;
    planningWindow: string;
    cadence: string;
    quarterFocus: string;
    milestones: string;
    capacity: string;
    dependencies: string;
    activity: string;
    resources: string;
    roleModel: string;
    skills: string;
    people: string;
    indicators: string;
    evidence: string;
    signoffOwner: string;
    signoffState: string;
    acceptance: string;
    closurePack: string;
    gate: string;
    decision: string;
    maturity: string;
    transformation: string;
    adoption: string;
    closure: string;
    retex: string;
  };
  actionCards: {
    openActive: string;
    readyToLaunch: string;
    frameAndDecide: string;
    pausedBacklog: string;
    fixReadiness: string;
  };
  actionHints: {
    openActive: string;
    readyToLaunch: string;
    frameAndDecide: string;
    pausedBacklog: string;
    fixReadiness: string;
  };
  missing: {
    owner: string;
    planningWindow: string;
    cadence: string;
    quarterFocus: string;
    milestones: string;
    capacity: string;
    signoffOwner: string;
    signoffState: string;
    roleModel: string;
    skills: string;
    people: string;
    indicators: string;
    evidence: string;
    acceptance: string;
    closurePack: string;
    transformation: string;
    adoption: string;
    closure: string;
  };
  hotspotKinds: Record<PortfolioHotspotKind, string>;
  maturityLevels: Record<ODEChantierMaturityLevel, string>;
  guidance: Record<ODEChantierStatus, string>;
  statuses: Record<ODEChantierStatus, string>;
} {
  if (language === "fr") {
    return {
      portfolioTitle: "Portefeuille chantier",
      portfolioSummary: (count) => `${count} chantier${count > 1 ? "s" : ""} visible${count > 1 ? "s" : ""}`,
      governanceTitle: "Pilotage global",
      governanceSummary: (count) => `${count} chantier${count > 1 ? "s" : ""} suivis dans l'espace`,
      managementTitle: "Revue de pilotage",
      managementSummary: (count) => `${count} chantier${count > 1 ? "s" : ""} classe${count > 1 ? "s" : ""} par etape de decision`,
      commandCenterTitle: "Centre d'action",
      commandCenterSummary: (count) => `${count} chantier${count > 1 ? "s" : ""} pilotable${count > 1 ? "s" : ""} avec raccourcis de revue`,
      portfolioListTitle: "Liste portefeuille",
      portfolioListSummary: (count) => `${count} chantier${count > 1 ? "s" : ""} ordonne${count > 1 ? "s" : ""} pour revue`,
      portfolioSearchPlaceholder: "Rechercher un chantier, un pilote, une fenetre...",
      portfolioEmptyFiltered: "Aucun chantier ne correspond a ce filtre portefeuille.",
      planningRadarTitle: "Radar capacite et readiness",
      planningRadarSummary: "Visualisez les charges par pilote, les fenetres de planning, et les chantiers incomplets.",
      platformBoardTitle: "Plateforme ODE",
      platformBoardSummary: "Ancrez les chantiers dans le catalogue ODE, exposez la couverture NA et reperez les chantiers encore hors ossature.",
      executionBoardTitle: "Execution et cadence",
      executionBoardSummary: "Reperez les conflits de capacite et les chantiers actifs sans rythme portefeuille suffisamment cadre.",
      traceabilityBoardTitle: "Signoff et preuve",
      traceabilityBoardSummary: "Suivez les chantiers dont la chaine de preuve, le signoff, ou le pack de cloture reste incomplet.",
      peopleBoardTitle: "Roles et competences",
      peopleBoardSummary: "Exposez les hotspots de roles, competences critiques, et manques de plan personnes / GPEC.",
      maturityBoardTitle: "Maturite transformation",
      maturityBoardSummary: "Visualisez le niveau de maturite atteint et les chantiers dont l'adoption n'est pas encore securisee.",
      catalogCoverageTitle: "Couverture catalogue",
      naCoverageTitle: "NA les plus porteuses",
      unanchoredChantiersTitle: "Chantiers sans ancrage NA",
      emptyCatalogCoverage: "Aucun chantier n'est encore rattache au catalogue ODE.",
      emptyNACoverage: "Aucun ancrage NA n'est encore visible dans cet espace.",
      emptyUnanchoredChantiers: "Tous les chantiers visibles sont ancres a une NA du catalogue.",
      catalogVersion: "Version catalogue",
      anchoredChantiers: "Chantiers ancres",
      uniqueNAAnchors: "NA uniques",
      level4CatalogEntries: "NA niveau 4",
      ownerLoadTitle: "Charge par pilote",
      planningWindowsTitle: "Fenetres de planning",
      readinessGapsTitle: "Ecarts de readiness",
      capacityConflictsTitle: "Conflits de capacite",
      cadenceWatchTitle: "Cadence a cadrer",
      signoffWatchTitle: "Signoff a traiter",
      closureWatchTitle: "Cloture a consolider",
      roleHotspotsTitle: "Hotspots roles / competences",
      peopleGapsTitle: "Plan personnes a completer",
      maturityDistributionTitle: "Distribution maturite",
      transformationWatchTitle: "Adoption a securiser",
      emptyOwnerLoad: "Aucun pilote repete pour l'instant.",
      emptyPlanningWindows: "Aucune fenetre de planning renseignee.",
      emptyReadinessGaps: "Aucun chantier critique n'a de manque de readiness visible.",
      emptyCapacityConflicts: "Aucun conflit de capacite visible pour l'instant.",
      emptyCadenceWatch: "Aucun chantier actif ou approuve n'a de lacune de cadence visible.",
      emptySignoffWatch: "Aucun chantier n'attend de preuve ou de signoff prioritaire.",
      emptyClosureWatch: "Aucun chantier cloture n'a de pack de cloture incomplet.",
      emptyRoleHotspots: "Aucun role ou competence critique ne ressort encore a l'echelle espace.",
      emptyPeopleGaps: "Aucun chantier actif n'a de manque visible sur le plan personnes / competences.",
      emptyMaturityDistribution: "Aucun niveau de maturite n'est encore renseigne.",
      emptyTransformationWatch: "Aucun chantier n'a de risque d'adoption prioritaire visible.",
      activeNow: "Actifs maintenant",
      needsAttention: "A surveiller",
      noActive: "Aucun chantier actif dans cet espace.",
      noAttention: "Aucun chantier en pause, propose ou brouillon a traiter.",
      all: "Tous",
      chantier: "Chantier",
      linkedNA: "NA",
      unassigned: "Sans pilote",
      unwindowed: "Sans fenetre",
      portfolioScopes: {
        all: "Tout",
        readiness: "Readiness",
        active: "Actifs",
        ready: "Prets"
      },
      portfolioSorts: {
        status: "Statut",
        planning: "Fenetre",
        owner: "Pilote",
        updated: "Maj"
      },
      reviewLanes: {
        frameAndDecide: "Cadrer et proposer",
        readyToLaunch: "Pret a lancer",
        activeExecution: "En execution",
        pausedBlocked: "En pause",
        closureMemory: "Cloture et memoire"
      },
      reviewLaneHints: {
        frameAndDecide: "Clarifier la decision et la trajectoire avant lancement.",
        readyToLaunch: "Chantiers approuves a lancer ou a preparer.",
        activeExecution: "Chantiers en cours a suivre sur la cadence et les indicateurs.",
        pausedBlocked: "Chantiers bloques ou mis en attente a arbitrer.",
        closureMemory: "Capitaliser la fermeture et la memoire de reference."
      },
      reviewLaneEmpty: {
        frameAndDecide: "Aucun chantier en cadrage ou en proposition.",
        readyToLaunch: "Aucun chantier approuve en attente de lancement.",
        activeExecution: "Aucun chantier actif a piloter actuellement.",
        pausedBlocked: "Aucun chantier en pause dans l'espace.",
        closureMemory: "Aucun chantier cloture ou archive a relire."
      },
      signals: {
        owner: "Pilote",
        planningWindow: "Fenetre",
        cadence: "Cadence",
        quarterFocus: "Trimestre",
        milestones: "Jalons",
        capacity: "Capacite",
        dependencies: "Dependances",
        activity: "Activite",
        resources: "Ressources",
        roleModel: "Roles",
        skills: "Competences",
        people: "GPEC",
        indicators: "Indicateurs",
        evidence: "Preuves",
        signoffOwner: "Resp. signoff",
        signoffState: "Etat signoff",
        acceptance: "Signoff",
        closurePack: "Pack cloture",
        gate: "Gate",
        decision: "Decision",
        maturity: "Maturite",
        transformation: "Transformation",
        adoption: "Adoption",
        closure: "Cloture",
        retex: "RETEX"
      },
      actionCards: {
        openActive: "Ouvrir actif",
        readyToLaunch: "Pret a lancer",
        frameAndDecide: "A cadrer",
        pausedBacklog: "Revoir pauses",
        fixReadiness: "Corriger readiness"
      },
      actionHints: {
        openActive: "Sautez directement sur un chantier actif.",
        readyToLaunch: "Reprenez un chantier approuve avant lancement.",
        frameAndDecide: "Revenez sur les brouillons et propositions.",
        pausedBacklog: "Traitez les pauses, blocages et arbitrages.",
        fixReadiness: "Reperez les manques de preuves, capacite ou signoff."
      },
      missing: {
        owner: "pilote",
        planningWindow: "fenetre",
        cadence: "cadence",
        quarterFocus: "trimestre",
        milestones: "jalons",
        capacity: "capacite",
        signoffOwner: "resp. signoff",
        signoffState: "etat signoff",
        roleModel: "roles",
        skills: "competences",
        people: "plan personnes",
        indicators: "indicateurs",
        evidence: "preuves",
        acceptance: "signoff",
        closurePack: "pack cloture",
        transformation: "impact transformation",
        adoption: "adoption",
        closure: "cloture"
      },
      hotspotKinds: {
        role: "Role",
        skill: "Competence"
      },
      maturityLevels: {
        emerging: "Emergent",
        stabilizing: "Stabilisation",
        scaling: "Extension",
        institutionalized: "Institutionnalise"
      },
      guidance: {
        draft: "Completer le cadrage avant de proposer ce chantier.",
        proposed: "Formaliser la note de validation et la decision attendue.",
        approved: "Preparer les ressources et indicateurs avant lancement.",
        active: "Suivre le rythme, les indicateurs et les arbitrages.",
        paused: "Documenter le blocage et la relance attendue.",
        closed: "Finaliser la synthese de cloture et la valeur obtenue.",
        archived: "Conserver ce chantier comme memoire reutilisable."
      },
      statuses: {
        draft: "Brouillon",
        proposed: "Propose",
        approved: "Approuve",
        active: "Actif",
        paused: "En pause",
        closed: "Cloture",
        archived: "Archive"
      }
    };
  }
  return {
    portfolioTitle: "Chantier portfolio",
    portfolioSummary: (count) => `${count} chantier${count === 1 ? "" : "s"} in view`,
    governanceTitle: "Workspace governance",
    governanceSummary: (count) => `${count} chantier${count === 1 ? "" : "s"} tracked across the workspace`,
    managementTitle: "Management review",
    managementSummary: (count) => `${count} chantier${count === 1 ? "" : "s"} grouped by decision stage`,
    commandCenterTitle: "Command center",
    commandCenterSummary: (count) => `${count} chantier${count === 1 ? "" : "s"} available for direct management actions`,
    portfolioListTitle: "Workspace portfolio list",
    portfolioListSummary: (count) => `${count} chantier${count === 1 ? "" : "s"} ordered for review`,
    portfolioSearchPlaceholder: "Search chantier, owner, planning window...",
    portfolioEmptyFiltered: "No chantier matches the current portfolio filter.",
    planningRadarTitle: "Capacity and readiness radar",
    planningRadarSummary: "See owner load, planning windows, and chantier readiness gaps at a glance.",
    platformBoardTitle: "ODE platform",
    platformBoardSummary: "Anchor chantiers in the ODE catalog, expose NA coverage, and spot the work that still sits outside the structural backbone.",
    executionBoardTitle: "Execution and cadence",
    executionBoardSummary: "Spot capacity conflicts and active chantiers whose cadence framing is still too weak for portfolio review.",
    traceabilityBoardTitle: "Signoff and evidence",
    traceabilityBoardSummary: "Track chantiers whose proof chain, signoff path, or closure pack is still incomplete.",
    peopleBoardTitle: "Roles and skills",
    peopleBoardSummary: "Expose recurring role/skill hotspots and active chantiers missing a real people / GPEC plan.",
    maturityBoardTitle: "Transformation maturity",
    maturityBoardSummary: "See maturity distribution and the chantiers whose adoption and transformation impact remain under-framed.",
    catalogCoverageTitle: "Catalog coverage",
    naCoverageTitle: "Top NA anchors",
    unanchoredChantiersTitle: "Unanchored chantiers",
    emptyCatalogCoverage: "No chantier is anchored to the ODE catalog yet.",
    emptyNACoverage: "No NA anchoring is visible in this workspace yet.",
    emptyUnanchoredChantiers: "Every visible chantier is anchored to a catalog NA.",
    catalogVersion: "Catalog version",
    anchoredChantiers: "Anchored chantiers",
    uniqueNAAnchors: "Unique NAs",
    level4CatalogEntries: "Level 4 NAs",
    ownerLoadTitle: "Owner load",
    planningWindowsTitle: "Planning windows",
    readinessGapsTitle: "Readiness gaps",
    capacityConflictsTitle: "Capacity conflicts",
    cadenceWatchTitle: "Cadence to frame",
    signoffWatchTitle: "Signoff watch",
    closureWatchTitle: "Closure watch",
    roleHotspotsTitle: "Role / skill hotspots",
    peopleGapsTitle: "People plan gaps",
    maturityDistributionTitle: "Maturity distribution",
    transformationWatchTitle: "Adoption watch",
    emptyOwnerLoad: "No repeated owner load hotspot yet.",
    emptyPlanningWindows: "No planning window has been filled yet.",
    emptyReadinessGaps: "No critical chantier readiness gap is visible right now.",
    emptyCapacityConflicts: "No visible capacity conflict is emerging right now.",
    emptyCadenceWatch: "No active or approved chantier currently lacks cadence framing.",
    emptySignoffWatch: "No chantier needs urgent evidence or signoff follow-up right now.",
    emptyClosureWatch: "No closed chantier has an incomplete closure pack right now.",
    emptyRoleHotspots: "No role or skill hotspot stands out across the workspace yet.",
    emptyPeopleGaps: "No active chantier has a visible people / skills planning gap right now.",
    emptyMaturityDistribution: "No maturity level has been filled yet.",
    emptyTransformationWatch: "No chantier has a visible adoption risk that needs escalation right now.",
    activeNow: "Active now",
    needsAttention: "Needs attention",
    noActive: "No active chantier in this workspace.",
    noAttention: "No paused, proposed, or draft chantier needs attention right now.",
    all: "All",
    chantier: "Chantier",
    linkedNA: "NA",
    unassigned: "Unassigned",
    unwindowed: "No window",
    portfolioScopes: {
      all: "All",
      readiness: "Readiness",
      active: "Active",
      ready: "Ready"
    },
    portfolioSorts: {
      status: "Status",
      planning: "Window",
      owner: "Owner",
      updated: "Updated"
    },
    reviewLanes: {
      frameAndDecide: "Frame and propose",
      readyToLaunch: "Ready to launch",
      activeExecution: "Running now",
      pausedBlocked: "Paused or blocked",
      closureMemory: "Closure and memory"
    },
    reviewLaneHints: {
      frameAndDecide: "Clarify the decision basis and launch path.",
      readyToLaunch: "Approved chantier ready for activation.",
      activeExecution: "Execution lane to watch on cadence and indicators.",
      pausedBlocked: "Items waiting for unblock or management arbitration.",
      closureMemory: "Closure learning and reusable memory."
    },
    reviewLaneEmpty: {
      frameAndDecide: "No chantier is being framed or proposed right now.",
      readyToLaunch: "No approved chantier is waiting for launch.",
      activeExecution: "No active chantier is running right now.",
      pausedBlocked: "No chantier is paused in this workspace.",
      closureMemory: "No closed or archived chantier is ready for review."
    },
    signals: {
      owner: "Owner",
      planningWindow: "Window",
      cadence: "Cadence",
      quarterFocus: "Quarter",
      milestones: "Milestones",
      capacity: "Capacity",
      dependencies: "Dependencies",
      activity: "Activity",
      resources: "Resources",
      roleModel: "Roles",
      skills: "Skills",
      people: "People",
      indicators: "Indicators",
      evidence: "Evidence",
      signoffOwner: "Signoff owner",
      signoffState: "Signoff state",
      acceptance: "Signoff",
      closurePack: "Closure pack",
      gate: "Gate",
      decision: "Decision",
      maturity: "Maturity",
      transformation: "Transformation",
      adoption: "Adoption",
      closure: "Closure",
      retex: "RETEX"
    },
    actionCards: {
      openActive: "Open active",
      readyToLaunch: "Ready to launch",
      frameAndDecide: "Frame and decide",
      pausedBacklog: "Review paused",
      fixReadiness: "Fix readiness"
    },
    actionHints: {
      openActive: "Jump straight into a running chantier.",
      readyToLaunch: "Pick up an approved chantier before activation.",
      frameAndDecide: "Review draft and proposed chantier framing.",
      pausedBacklog: "Work through paused or blocked chantier.",
      fixReadiness: "Find missing evidence, capacity, or signoff signals."
    },
    missing: {
      owner: "owner",
      planningWindow: "window",
      cadence: "cadence",
      quarterFocus: "quarter",
      milestones: "milestones",
      capacity: "capacity",
      signoffOwner: "signoff owner",
      signoffState: "signoff state",
      roleModel: "role model",
      skills: "skills",
      people: "people plan",
      indicators: "indicators",
      evidence: "evidence",
      acceptance: "signoff",
      closurePack: "closure pack",
      transformation: "transformation impact",
      adoption: "adoption",
      closure: "closure"
    },
    hotspotKinds: {
      role: "Role",
      skill: "Skill"
    },
    maturityLevels: {
      emerging: "Emerging",
      stabilizing: "Stabilizing",
      scaling: "Scaling",
      institutionalized: "Institutionalized"
    },
    guidance: {
      draft: "Complete the framing before proposing this chantier.",
      proposed: "Formalize the approval note and decision path.",
      approved: "Prepare resources and indicators before launch.",
      active: "Track cadence, indicators, and management decisions.",
      paused: "Document the blocker and the restart path.",
      closed: "Capture closure value and final summary.",
      archived: "Keep this chantier as reusable organizational memory."
    },
    statuses: {
      draft: "Draft",
      proposed: "Proposed",
      approved: "Approved",
      active: "Active",
      paused: "Paused",
      closed: "Closed",
      archived: "Archived"
    }
  };
}

function getChantierStatusTone(status: ODEChantierStatus): string {
  if (status === "active") return "border-[rgba(94,207,145,0.44)] bg-[rgba(22,82,52,0.38)] text-[#b8f3c9]";
  if (status === "approved") return "border-[rgba(90,188,255,0.42)] bg-[rgba(18,70,104,0.38)] text-[#9fdcff]";
  if (status === "proposed") return "border-[rgba(236,194,106,0.42)] bg-[rgba(96,72,22,0.34)] text-[#f3dda0]";
  if (status === "paused") return "border-[rgba(255,171,86,0.42)] bg-[rgba(102,56,18,0.36)] text-[#ffd0a0]";
  if (status === "closed") return "border-[rgba(159,175,196,0.38)] bg-[rgba(44,54,67,0.34)] text-[#d7dfeb]";
  if (status === "archived") return "border-[rgba(128,146,176,0.34)] bg-[rgba(29,37,48,0.34)] text-[#b9c7da]";
  return "border-[rgba(164,126,255,0.36)] bg-[rgba(58,36,96,0.34)] text-[#d7c7ff]";
}

function getMaturityTone(level: ODEChantierMaturityLevel): string {
  if (level === "institutionalized") return "border-[rgba(94,207,145,0.42)] bg-[rgba(18,78,51,0.34)] text-[#b8f3c9]";
  if (level === "scaling") return "border-[rgba(90,188,255,0.42)] bg-[rgba(18,70,104,0.34)] text-[#9fdcff]";
  if (level === "stabilizing") return "border-[rgba(236,194,106,0.42)] bg-[rgba(96,72,22,0.32)] text-[#f3dda0]";
  return "border-[rgba(214,150,255,0.38)] bg-[rgba(87,42,118,0.32)] text-[#efd6ff]";
}

interface DesktopContentPanelProps {
  t: TranslateFn;
  language: LanguageCode;
  showChantierInsights?: boolean;
  desktopViewMode: DesktopViewMode;
  mindMapOrientation: MindMapOrientation;
  mindMapContentMode: MindMapContentMode;
  quickAccessMindMapRootLabel: string;
  quickAccessMindMapRootNode: AppNode | null;
  quickAccessMindMapRootLevel: number;
  nodeTreeMindMapRootLabel: string;
  nodeTreeMindMapRootNode: AppNode | null;
  nodeTreeMindMapRootLevel: number;
  quickAccessMindMapGroups: QuickAccessMindMapGroup[];
  quickAccessMindMapDirectFavorites: AppNode[];
  activeFavoriteGroupId: string;
  currentFolderNode: AppNode | null;
  allNodes: AppNode[];
  byParent: Map<string, AppNode[]>;
  gridNodes: AppNode[];
  chantierStatusCounts: Record<ODEChantierStatus, number>;
  chantierNodeCount: number;
  workspaceChantierStatusCounts: Record<ODEChantierStatus, number>;
  workspaceChantierNodeCount: number;
  workspaceChantierNodes: AppNode[];
  workspaceActiveChantierNodes: AppNode[];
  workspaceAttentionChantierNodes: AppNode[];
  activeChantierStatusFilter: ChantierStatusFilter;
  onSetActiveChantierStatusFilter: (filter: ChantierStatusFilter) => void;
  selectedNodeId: string | null;
  selectedNodeIds: Set<string>;
  cutPendingNodeIds: Set<string>;
  draggingNodeId: string | null;
  editingNodeId: string | null;
  editingSurface: SelectionSurface | null;
  editingValue: string;
  inlineEditInputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  dropIndicator: DropIndicator;
  scopedRootDropTargetId: string;
  currentFolderDropTargetId: string | null;
  folderNodeStateById: Map<string, FolderNodeState>;
  executionOwnerNodeIds: Set<string>;
  nodeLevelById: Map<string, number>;
  scopedNumbering: Map<string, string>;
  isNodeProvisionalInlineCreate: (nodeId: string) => boolean;
  showEmptyState: boolean;
  emptyStateMessage: string;
  showCreateFirstNodeAction: boolean;
  showUploadEmptyStateAction: boolean;
  onActivateGridSurface: () => void;
  onOpenSurfaceContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  onHasExternalFileDrag: (event: DragEvent<HTMLElement>) => boolean;
  onResolveActiveDragSourceId: (event: DragEvent<HTMLElement>) => string | null;
  onResolveExternalDropPaths: (event: DragEvent<HTMLElement>) => string[];
  onSetDropIndicator: (next: DropIndicator) => void;
  onClearDraggingState: () => void;
  onImportExternalFilesToNode: (paths: string[], parentNodeId: string | null, surface: SelectionSurface) => void;
  onApplyDropIntoCurrentGridFolder: (sourceId: string) => void;
  onCloseContextMenu: () => void;
  onApplyGridSelection: (nodeId: string, options: { range: boolean; toggle: boolean }) => void;
  onOpenNodeContextMenu: (event: ReactMouseEvent<HTMLElement>, nodeId: string) => void;
  onOpenQuickAccessNodeContextMenu: (event: ReactMouseEvent<HTMLElement>, nodeId: string) => void;
  onOpenQuickAccessGroupContextMenu: (event: ReactMouseEvent<HTMLElement>, groupId: string) => void;
  onOpenQuickAccessSurfaceContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  onBeginNodeDrag: (event: DragEvent<HTMLElement>, nodeId: string) => void;
  onDetectGridDropPosition: (event: DragEvent<HTMLElement>, node: AppNode) => DropPosition;
  onApplyGridDropMove: (sourceId: string, targetId: string, position: DropPosition) => void;
  onOpenFolder: (nodeId: string) => void;
  onJumpToWorkspaceChantier: (nodeId: string) => void;
  onReviewMindMapFile: (nodeId: string) => void;
  onSelectQuickAccessGroup: (groupId: string) => void;
  onOpenQuickAccessNode: (nodeId: string) => void;
  onMoveNodeToQuickAccessGroup: (nodeId: string, groupId: string | null) => void;
  onDetectDetailsDropPosition: (event: DragEvent<HTMLElement>, node: AppNode) => DropPosition;
  onGetNodeTypeDisplayLabel: (node: AppNode) => string;
  onFormatBytes: (bytes: number | null) => string;
  onGetNodeSizeBytes: (node: AppNode) => number | null;
  onFormatNodeModified: (updatedAt: number, language: LanguageCode) => string;
  onCreateFirstNode: () => void;
  onCreateDashboardWidget: (parentNodeId: string) => Promise<string | null>;
  onRenameDashboardWidget: (nodeId: string, title: string) => Promise<void> | void;
  onSaveDashboardWidgetProperties: (nodeId: string, properties: Record<string, unknown>) => Promise<void> | void;
  onMoveDashboardWidget: (nodeId: string, direction: "up" | "down" | "left" | "right") => Promise<void> | void;
  onDeleteDashboardWidget: (nodeId: string) => Promise<void> | void;
  organisationModels: ReusableLibraryIndexItem[];
  databaseTemplates: ReusableLibraryIndexItem[];
  canCreateFromReusableLibraryIntoCurrentNode: boolean;
  canSaveCurrentAsOrganisationModel: boolean;
  canSaveCurrentAsDatabaseTemplate: boolean;
  onSaveCurrentAsOrganisationModel: () => void;
  onSaveCurrentAsDatabaseTemplate: () => void;
  onCreateFromReusableLibraryItem: (itemId: string, kind: ODELibraryKind) => Promise<void> | void;
  onExportReusableLibraryItem: (itemId: string, kind: ODELibraryKind) => Promise<void> | void;
  onImportReusableLibraryJson: (kind: ODELibraryKind, file: File) => Promise<void> | void;
  onSelectReusableLibraryItem: (itemId: string, options?: { range?: boolean; toggle?: boolean }) => void;
  onOpenReusableLibraryItem: (itemId: string) => Promise<void> | void;
  onOpenReusableLibraryItemContextMenu: (event: ReactMouseEvent<HTMLElement>, itemId: string) => void;
  onTriggerUpload: () => void;
  onSetEditingValue: (value: string) => void;
  onOpenInlineEditContextMenu: (event: ReactMouseEvent<HTMLInputElement>) => void;
  onCommitInlineEdit: () => Promise<void> | void;
  onCancelInlineEdit: () => void;
}

export function DesktopContentPanel({
  t,
  language,
  showChantierInsights = true,
  desktopViewMode,
  mindMapOrientation,
  mindMapContentMode,
  quickAccessMindMapRootLabel,
  quickAccessMindMapRootNode,
  quickAccessMindMapRootLevel,
  nodeTreeMindMapRootLabel,
  nodeTreeMindMapRootNode,
  nodeTreeMindMapRootLevel,
  quickAccessMindMapGroups,
  quickAccessMindMapDirectFavorites,
  activeFavoriteGroupId,
  currentFolderNode,
  allNodes,
  byParent,
  gridNodes,
  chantierStatusCounts,
  chantierNodeCount,
  workspaceChantierStatusCounts,
  workspaceChantierNodeCount,
  workspaceChantierNodes,
  workspaceActiveChantierNodes,
  workspaceAttentionChantierNodes,
  activeChantierStatusFilter,
  onSetActiveChantierStatusFilter,
  selectedNodeId,
  selectedNodeIds,
  cutPendingNodeIds,
  draggingNodeId,
  editingNodeId,
  editingSurface,
  editingValue,
  inlineEditInputRef,
  dropIndicator,
  scopedRootDropTargetId,
  currentFolderDropTargetId,
  folderNodeStateById,
  executionOwnerNodeIds,
  nodeLevelById,
  scopedNumbering,
  isNodeProvisionalInlineCreate,
  showEmptyState,
  emptyStateMessage,
  showCreateFirstNodeAction,
  showUploadEmptyStateAction,
  onActivateGridSurface,
  onOpenSurfaceContextMenu,
  onHasExternalFileDrag,
  onResolveActiveDragSourceId,
  onResolveExternalDropPaths,
  onSetDropIndicator,
  onClearDraggingState,
  onImportExternalFilesToNode,
  onApplyDropIntoCurrentGridFolder,
  onCloseContextMenu,
  onApplyGridSelection,
  onOpenNodeContextMenu,
  onOpenQuickAccessNodeContextMenu,
  onOpenQuickAccessGroupContextMenu,
  onOpenQuickAccessSurfaceContextMenu,
  onBeginNodeDrag,
  onDetectGridDropPosition,
  onApplyGridDropMove,
  onOpenFolder,
  onJumpToWorkspaceChantier,
  onReviewMindMapFile,
  onSelectQuickAccessGroup,
  onOpenQuickAccessNode,
  onMoveNodeToQuickAccessGroup,
  onDetectDetailsDropPosition,
  onGetNodeTypeDisplayLabel,
  onFormatBytes,
  onGetNodeSizeBytes,
  onFormatNodeModified,
  onCreateFirstNode,
  onCreateDashboardWidget,
  onRenameDashboardWidget,
  onSaveDashboardWidgetProperties,
  onMoveDashboardWidget,
  onDeleteDashboardWidget,
  organisationModels,
  databaseTemplates,
  canCreateFromReusableLibraryIntoCurrentNode,
  canSaveCurrentAsOrganisationModel,
  canSaveCurrentAsDatabaseTemplate,
  onSaveCurrentAsOrganisationModel,
  onSaveCurrentAsDatabaseTemplate,
  onCreateFromReusableLibraryItem,
  onExportReusableLibraryItem,
  onImportReusableLibraryJson,
  onSelectReusableLibraryItem,
  onOpenReusableLibraryItem,
  onOpenReusableLibraryItemContextMenu,
  onTriggerUpload,
  onSetEditingValue,
  onOpenInlineEditContextMenu,
  onCommitInlineEdit,
  onCancelInlineEdit
}: DesktopContentPanelProps) {
  const effectiveRootDropTargetId = currentFolderDropTargetId ?? scopedRootDropTargetId;
  const rootInteractiveSelector =
    ".ode-grid-card, .ode-details-row, .ode-quick-mind-favorite, .ode-quick-mind-group-card, .ode-quick-mind-group-branch, .ode-mind-root-button";
  const dashboardRootChildren = currentFolderNode ? byParent.get(currentFolderNode.id) ?? [] : [];
  const chantierStatusCopy = useMemo(() => getChantierStatusCopy(language), [language]);
  const detailsScrollRef = useRef<HTMLDivElement | null>(null);
  const verticalBranchesRef = useRef<HTMLDivElement | null>(null);
  const [detailsScrollTop, setDetailsScrollTop] = useState(0);
  const [detailsViewportHeight, setDetailsViewportHeight] = useState(0);
  const [workspacePortfolioQuery, setWorkspacePortfolioQuery] = useState("");
  const [workspacePortfolioScope, setWorkspacePortfolioScope] = useState<WorkspacePortfolioScope>("all");
  const [workspacePortfolioSort, setWorkspacePortfolioSort] = useState<WorkspacePortfolioSort>("status");
  const [verticalConnectorBounds, setVerticalConnectorBounds] = useState<MindMapVerticalConnectorBounds | null>(null);
  const shouldVirtualizeDetails =
    desktopViewMode === "details" && gridNodes.length >= DETAILS_VIRTUALIZE_MIN_ROWS;
  const detailsRowIndexById = useMemo(() => {
    const map = new Map<string, number>();
    gridNodes.forEach((node, idx) => map.set(node.id, idx));
    return map;
  }, [gridNodes]);
  const virtualDetailsWindow = useMemo(() => {
    if (!shouldVirtualizeDetails) {
      return {
        rows: gridNodes,
        topSpacer: 0,
        bottomSpacer: 0
      };
    }

    const total = gridNodes.length;
    if (total === 0) {
      return {
        rows: [] as AppNode[],
        topSpacer: 0,
        bottomSpacer: 0
      };
    }

    const viewport = detailsViewportHeight > 0 ? detailsViewportHeight : DETAILS_VIRTUAL_ROW_HEIGHT * 14;
    const unclampedStart = Math.floor(detailsScrollTop / DETAILS_VIRTUAL_ROW_HEIGHT) - DETAILS_VIRTUAL_OVERSCAN;
    const startIndex = Math.max(0, unclampedStart);
    const unclampedEnd =
      Math.ceil((detailsScrollTop + viewport) / DETAILS_VIRTUAL_ROW_HEIGHT) + DETAILS_VIRTUAL_OVERSCAN;
    const endIndex = Math.min(total - 1, unclampedEnd);
    return {
      rows: gridNodes.slice(startIndex, endIndex + 1),
      topSpacer: startIndex * DETAILS_VIRTUAL_ROW_HEIGHT,
      bottomSpacer: Math.max(0, (total - endIndex - 1) * DETAILS_VIRTUAL_ROW_HEIGHT)
    };
  }, [gridNodes, shouldVirtualizeDetails, detailsScrollTop, detailsViewportHeight]);

  useEffect(() => {
    if (desktopViewMode !== "details") return;
    const detailsEl = detailsScrollRef.current;
    if (!detailsEl) return;

    const updateViewport = () => {
      setDetailsViewportHeight(detailsEl.clientHeight);
    };
    updateViewport();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateViewport);
      observer.observe(detailsEl);
      return () => {
        observer.disconnect();
      };
    }

    window.addEventListener("resize", updateViewport);
    return () => {
      window.removeEventListener("resize", updateViewport);
    };
  }, [desktopViewMode]);

  useEffect(() => {
    if (!shouldVirtualizeDetails) return;
    const detailsEl = detailsScrollRef.current;
    if (!detailsEl) return;
    const maxScrollTop = Math.max(
      0,
      gridNodes.length * DETAILS_VIRTUAL_ROW_HEIGHT - detailsViewportHeight
    );
    if (detailsScrollTop <= maxScrollTop) return;
    detailsEl.scrollTop = maxScrollTop;
    setDetailsScrollTop(maxScrollTop);
  }, [shouldVirtualizeDetails, gridNodes.length, detailsViewportHeight, detailsScrollTop]);

  useEffect(() => {
    if (!shouldVirtualizeDetails || !selectedNodeId || detailsViewportHeight <= 0) return;
    const selectedIndex = detailsRowIndexById.get(selectedNodeId);
    if (selectedIndex === undefined) return;
    const rowTop = selectedIndex * DETAILS_VIRTUAL_ROW_HEIGHT;
    const rowBottom = rowTop + DETAILS_VIRTUAL_ROW_HEIGHT;
    const viewportTop = detailsScrollTop;
    const viewportBottom = detailsScrollTop + detailsViewportHeight;
    let nextScrollTop: number | null = null;

    if (rowTop < viewportTop) {
      nextScrollTop = rowTop;
    } else if (rowBottom > viewportBottom) {
      nextScrollTop = rowBottom - detailsViewportHeight;
    }

    if (nextScrollTop === null) return;
    const clamped = Math.max(0, nextScrollTop);
    const detailsEl = detailsScrollRef.current;
    if (detailsEl) detailsEl.scrollTop = clamped;
    setDetailsScrollTop((prev) => (prev === clamped ? prev : clamped));
  }, [
    shouldVirtualizeDetails,
    selectedNodeId,
    detailsRowIndexById,
    detailsViewportHeight
  ]);

  const quickAccessHasGroups = quickAccessMindMapGroups.length > 0;
  const quickAccessIsEmpty =
    quickAccessMindMapGroups.length === 0 && quickAccessMindMapDirectFavorites.length === 0;
  const nodeTreeMindMapBranchNodes = useMemo(
    () => gridNodes.filter((node) => !isFileLikeNode(node)),
    [gridNodes]
  );
  const nodeTreeMindMapFileNodes = useMemo(
    () => gridNodes.filter((node) => isFileLikeNode(node)),
    [gridNodes]
  );
  const gridBranchNodes = useMemo(
    () => gridNodes.filter((node) => !isFileLikeNode(node)),
    [gridNodes]
  );
  const gridFileNodes = useMemo(
    () => gridNodes.filter((node) => isFileLikeNode(node)),
    [gridNodes]
  );
  const chantierStatusOrder: ODEChantierStatus[] = [
    "draft",
    "proposed",
    "approved",
    "active",
    "paused",
    "closed",
    "archived"
  ];
  const showChantierPortfolio = showChantierInsights && chantierNodeCount > 0;
  const showWorkspaceChantierGovernance = workspaceChantierNodeCount > 0;
  const workspaceAttentionNodeCount =
    workspaceChantierStatusCounts.paused + workspaceChantierStatusCounts.proposed + workspaceChantierStatusCounts.draft;
  const workspacePortfolioNodes = useMemo(() => {
    return [...workspaceChantierNodes].sort((left, right) => {
      const statusDiff =
        chantierStatusOrder.indexOf(readChantierProfile(left).status) -
        chantierStatusOrder.indexOf(readChantierProfile(right).status);
      if (statusDiff !== 0) return statusDiff;
      return left.name.localeCompare(right.name, getLocaleForLanguage(language), { sensitivity: "base" });
    });
  }, [chantierStatusOrder, language, workspaceChantierNodes]);
  const chantierManagementLanes = useMemo(
    () => [
      {
        key: "frame-and-decide",
        title: chantierStatusCopy.reviewLanes.frameAndDecide,
        hint: chantierStatusCopy.reviewLaneHints.frameAndDecide,
        emptyCopy: chantierStatusCopy.reviewLaneEmpty.frameAndDecide,
        count: workspaceChantierStatusCounts.draft + workspaceChantierStatusCounts.proposed,
        nodes: workspacePortfolioNodes
          .filter((node) => {
            const status = readChantierProfile(node).status;
            return status === "draft" || status === "proposed";
          })
          .slice(0, 4),
        toneClassName: getChantierStatusTone("proposed")
      },
      {
        key: "ready-to-launch",
        title: chantierStatusCopy.reviewLanes.readyToLaunch,
        hint: chantierStatusCopy.reviewLaneHints.readyToLaunch,
        emptyCopy: chantierStatusCopy.reviewLaneEmpty.readyToLaunch,
        count: workspaceChantierStatusCounts.approved,
        nodes: workspacePortfolioNodes.filter((node) => readChantierProfile(node).status === "approved").slice(0, 4),
        toneClassName: getChantierStatusTone("approved")
      },
      {
        key: "active-execution",
        title: chantierStatusCopy.reviewLanes.activeExecution,
        hint: chantierStatusCopy.reviewLaneHints.activeExecution,
        emptyCopy: chantierStatusCopy.reviewLaneEmpty.activeExecution,
        count: workspaceChantierStatusCounts.active,
        nodes: workspacePortfolioNodes.filter((node) => readChantierProfile(node).status === "active").slice(0, 4),
        toneClassName: getChantierStatusTone("active")
      },
      {
        key: "paused-blocked",
        title: chantierStatusCopy.reviewLanes.pausedBlocked,
        hint: chantierStatusCopy.reviewLaneHints.pausedBlocked,
        emptyCopy: chantierStatusCopy.reviewLaneEmpty.pausedBlocked,
        count: workspaceChantierStatusCounts.paused,
        nodes: workspacePortfolioNodes.filter((node) => readChantierProfile(node).status === "paused").slice(0, 4),
        toneClassName: getChantierStatusTone("paused")
      },
      {
        key: "closure-memory",
        title: chantierStatusCopy.reviewLanes.closureMemory,
        hint: chantierStatusCopy.reviewLaneHints.closureMemory,
        emptyCopy: chantierStatusCopy.reviewLaneEmpty.closureMemory,
        count: workspaceChantierStatusCounts.closed + workspaceChantierStatusCounts.archived,
        nodes: workspacePortfolioNodes
          .filter((node) => {
            const status = readChantierProfile(node).status;
            return status === "closed" || status === "archived";
          })
          .slice(0, 4),
        toneClassName: getChantierStatusTone("closed")
      }
    ],
    [chantierStatusCopy, workspaceChantierStatusCounts, workspacePortfolioNodes]
  );
  const workspaceOwnerHotspots = useMemo(() => {
    const groups = new Map<string, { label: string; count: number; targetNodeId: string }>();
    for (const node of workspacePortfolioNodes) {
      const profile = readChantierProfile(node);
      if (profile.status === "closed" || profile.status === "archived") continue;
      const label = profile.owner?.trim();
      if (!label) continue;
      const key = label.toLocaleLowerCase(getLocaleForLanguage(language));
      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        groups.set(key, { label, count: 1, targetNodeId: node.id });
      }
    }
    return [...groups.values()]
      .filter((entry) => entry.count > 1)
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, getLocaleForLanguage(language)))
      .slice(0, 6);
  }, [language, workspacePortfolioNodes]);
  const workspacePlanningWindows = useMemo(() => {
    const groups = new Map<string, { label: string; count: number; targetNodeId: string }>();
    for (const node of workspacePortfolioNodes) {
      const label = readChantierProfile(node).planningWindow?.trim();
      if (!label) continue;
      const key = label.toLocaleLowerCase(getLocaleForLanguage(language));
      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        groups.set(key, { label, count: 1, targetNodeId: node.id });
      }
    }
    return [...groups.values()]
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, getLocaleForLanguage(language)))
      .slice(0, 6);
  }, [language, workspacePortfolioNodes]);
  const catalogLevel4Count = useMemo(() => NA_CATALOG.filter((entry) => entry.level === 4).length, []);
  const workspaceAnchoredChantierCount = useMemo(
    () => workspacePortfolioNodes.filter((node) => Boolean(getODENodeMetadata(node).naCode)).length,
    [workspacePortfolioNodes]
  );
  const workspaceUniqueNAAnchorCount = useMemo(
    () => new Set(workspacePortfolioNodes.map((node) => getODENodeMetadata(node).naCode).filter(Boolean)).size,
    [workspacePortfolioNodes]
  );
  const workspaceTopNAAnchors = useMemo(() => {
    const groups = new Map<string, { code: string; label: string; count: number; targetNodeId: string; meta: string | null }>();
    for (const node of workspacePortfolioNodes) {
      const naCode = getODENodeMetadata(node).naCode;
      if (!naCode) continue;
      const existing = groups.get(naCode);
      if (existing) {
        existing.count += 1;
      } else {
        groups.set(naCode, {
          code: naCode,
          label: getChantierLinkedNADisplay(node) ?? naCode,
          count: 1,
          targetNodeId: node.id,
          meta: getNAPathLabel(naCode)
        });
      }
    }
    return [...groups.values()]
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, getLocaleForLanguage(language)))
      .slice(0, 6);
  }, [language, workspacePortfolioNodes]);
  const workspaceUnanchoredChantiers = useMemo(
    () => workspacePortfolioNodes.filter((node) => !getODENodeMetadata(node).naCode).slice(0, 6),
    [workspacePortfolioNodes]
  );
  const getChantierReadinessGapLabels = (node: AppNode) => {
    const profile = readChantierProfile(node);
    const missing: string[] = [];
    if (!profile.owner) missing.push(chantierStatusCopy.missing.owner);
    if (!profile.planningWindow) missing.push(chantierStatusCopy.missing.planningWindow);
    if (!profile.reviewCadence) missing.push(chantierStatusCopy.missing.cadence);
    if ((profile.status === "approved" || profile.status === "active") && !profile.quarterFocus) {
      missing.push(chantierStatusCopy.missing.quarterFocus);
    }
    if ((profile.status === "approved" || profile.status === "active") && !profile.cadenceMilestones) {
      missing.push(chantierStatusCopy.missing.milestones);
    }
    if (!profile.capacityPlan) missing.push(chantierStatusCopy.missing.capacity);
    if ((profile.status === "approved" || profile.status === "active") && !profile.indicators) {
      missing.push(chantierStatusCopy.missing.indicators);
    }
    if (!profile.evidencePlan) missing.push(chantierStatusCopy.missing.evidence);
    if ((profile.status === "approved" || profile.status === "active" || profile.status === "closed") && !profile.signoffOwner) {
      missing.push(chantierStatusCopy.missing.signoffOwner);
    }
    if ((profile.status === "approved" || profile.status === "active" || profile.status === "closed") && !profile.signoffState) {
      missing.push(chantierStatusCopy.missing.signoffState);
    }
    if (!profile.acceptancePlan) missing.push(chantierStatusCopy.missing.acceptance);
    if ((profile.status === "approved" || profile.status === "active") && !profile.roleModel) {
      missing.push(chantierStatusCopy.missing.roleModel);
    }
    if ((profile.status === "approved" || profile.status === "active") && !profile.requiredSkills) {
      missing.push(chantierStatusCopy.missing.skills);
    }
    if ((profile.status === "approved" || profile.status === "active") && !profile.peoplePlan) {
      missing.push(chantierStatusCopy.missing.people);
    }
    if ((profile.status === "closed" || profile.status === "archived") && !profile.closureSummary) {
      missing.push(chantierStatusCopy.missing.closure);
    }
    if ((profile.status === "closed" || profile.status === "archived") && !profile.closurePack) {
      missing.push(chantierStatusCopy.missing.closurePack);
    }
    return missing;
  };
  const getChantierCadenceGapLabels = (node: AppNode) => {
    const profile = readChantierProfile(node);
    const missing: string[] = [];
    if (profile.status !== "approved" && profile.status !== "active") return missing;
    if (!profile.quarterFocus) missing.push(chantierStatusCopy.missing.quarterFocus);
    if (!profile.reviewCadence) missing.push(chantierStatusCopy.missing.cadence);
    if (!profile.cadenceMilestones) missing.push(chantierStatusCopy.missing.milestones);
    if (!profile.capacityPlan) missing.push(chantierStatusCopy.missing.capacity);
    return missing;
  };
  const getChantierTraceabilityGapLabels = (node: AppNode) => {
    const profile = readChantierProfile(node);
    const missing: string[] = [];
    if (!profile.evidencePlan) missing.push(chantierStatusCopy.missing.evidence);
    if (!profile.signoffOwner) missing.push(chantierStatusCopy.missing.signoffOwner);
    if (!profile.signoffState || profile.signoffState !== "signed") missing.push(chantierStatusCopy.missing.signoffState);
    if (!profile.acceptancePlan) missing.push(chantierStatusCopy.missing.acceptance);
    return missing;
  };
  const getChantierClosureGapLabels = (node: AppNode) => {
    const profile = readChantierProfile(node);
    const missing: string[] = [];
    if (profile.status !== "closed" && profile.status !== "archived") return missing;
    if (!profile.closurePack) missing.push(chantierStatusCopy.missing.closurePack);
    if (!profile.closureSummary) missing.push(chantierStatusCopy.missing.closure);
    if (!profile.retex) missing.push(chantierStatusCopy.missing.adoption);
    return missing;
  };
  const getChantierPeopleGapLabels = (node: AppNode) => {
    const profile = readChantierProfile(node);
    const missing: string[] = [];
    if (profile.status !== "approved" && profile.status !== "active") return missing;
    if (!profile.roleModel) missing.push(chantierStatusCopy.missing.roleModel);
    if (!profile.requiredSkills) missing.push(chantierStatusCopy.missing.skills);
    if (!profile.peoplePlan) missing.push(chantierStatusCopy.missing.people);
    return missing;
  };
  const getChantierTransformationGapLabels = (node: AppNode) => {
    const profile = readChantierProfile(node);
    const missing: string[] = [];
    if (profile.status !== "approved" && profile.status !== "active" && profile.status !== "closed") return missing;
    if (!profile.transformationImpact) missing.push(chantierStatusCopy.missing.transformation);
    if (!profile.adoptionNotes) missing.push(chantierStatusCopy.missing.adoption);
    return missing;
  };
  const workspaceReadinessGapNodes = useMemo(
    () =>
      workspacePortfolioNodes
        .map((node) => ({ node, missing: getChantierReadinessGapLabels(node) }))
        .filter((entry) => entry.missing.length > 0)
        .slice(0, 6),
    [chantierStatusCopy, workspacePortfolioNodes]
  );
  const workspaceReadinessGapCount = useMemo(
    () => workspacePortfolioNodes.filter((node) => getChantierReadinessGapLabels(node).length > 0).length,
    [chantierStatusCopy, workspacePortfolioNodes]
  );
  const workspaceCapacityConflictRows = useMemo(() => {
    const groups = new Map<string, { label: string; count: number; targetNodeId: string; meta: string }>();
    for (const node of workspacePortfolioNodes) {
      const profile = readChantierProfile(node);
      if (profile.status !== "proposed" && profile.status !== "approved" && profile.status !== "active") continue;
      const owner = profile.owner?.trim() || chantierStatusCopy.unassigned;
      const planningWindow = profile.planningWindow?.trim() || chantierStatusCopy.unwindowed;
      const key = `${owner.toLocaleLowerCase(getLocaleForLanguage(language))}::${planningWindow.toLocaleLowerCase(
        getLocaleForLanguage(language)
      )}`;
      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        groups.set(key, {
          label: owner,
          count: 1,
          targetNodeId: node.id,
          meta: planningWindow
        });
      }
    }
    return [...groups.values()]
      .filter((entry) => entry.count > 1)
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, getLocaleForLanguage(language)))
      .slice(0, 6);
  }, [chantierStatusCopy, language, workspacePortfolioNodes]);
  const workspaceCadenceWatchNodes = useMemo(
    () =>
      workspacePortfolioNodes
        .map((node) => ({ node, missing: getChantierCadenceGapLabels(node) }))
        .filter((entry) => entry.missing.length > 0)
        .slice(0, 6),
    [chantierStatusCopy, workspacePortfolioNodes]
  );
  const workspaceTraceabilityWatchNodes = useMemo(
    () =>
      workspacePortfolioNodes
        .map((node) => ({ node, missing: getChantierTraceabilityGapLabels(node) }))
        .filter((entry) => entry.missing.length > 0)
        .slice(0, 6),
    [chantierStatusCopy, workspacePortfolioNodes]
  );
  const workspaceClosureWatchNodes = useMemo(
    () =>
      workspacePortfolioNodes
        .map((node) => ({ node, missing: getChantierClosureGapLabels(node) }))
        .filter((entry) => entry.missing.length > 0)
        .slice(0, 6),
    [chantierStatusCopy, workspacePortfolioNodes]
  );
  const workspaceRoleSkillHotspots = useMemo(() => {
    const groups = new Map<string, { kind: PortfolioHotspotKind; label: string; count: number; targetNodeId: string }>();
    for (const node of workspacePortfolioNodes) {
      const profile = readChantierProfile(node);
      splitPortfolioTokens(profile.roleModel).forEach((label) => {
        const key = `role::${label.toLocaleLowerCase(getLocaleForLanguage(language))}`;
        const existing = groups.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          groups.set(key, { kind: "role", label, count: 1, targetNodeId: node.id });
        }
      });
      splitPortfolioTokens(profile.requiredSkills).forEach((label) => {
        const key = `skill::${label.toLocaleLowerCase(getLocaleForLanguage(language))}`;
        const existing = groups.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          groups.set(key, { kind: "skill", label, count: 1, targetNodeId: node.id });
        }
      });
    }
    return [...groups.values()]
      .filter((entry) => entry.count > 1)
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, getLocaleForLanguage(language)))
      .slice(0, 8);
  }, [language, workspacePortfolioNodes]);
  const workspacePeopleGapNodes = useMemo(
    () =>
      workspacePortfolioNodes
        .map((node) => ({ node, missing: getChantierPeopleGapLabels(node) }))
        .filter((entry) => entry.missing.length > 0)
        .slice(0, 6),
    [chantierStatusCopy, workspacePortfolioNodes]
  );
  const workspaceMaturityDistribution = useMemo(() => {
    const counts: Record<ODEChantierMaturityLevel, { count: number; targetNodeId: string | null }> = {
      emerging: { count: 0, targetNodeId: null },
      stabilizing: { count: 0, targetNodeId: null },
      scaling: { count: 0, targetNodeId: null },
      institutionalized: { count: 0, targetNodeId: null }
    };
    for (const node of workspacePortfolioNodes) {
      const level = readChantierProfile(node).maturityLevel;
      if (!level) continue;
      counts[level].count += 1;
      counts[level].targetNodeId ??= node.id;
    }
    return (Object.entries(counts) as Array<[ODEChantierMaturityLevel, { count: number; targetNodeId: string | null }]>)
      .filter(([, value]) => value.count > 0)
      .map(([level, value]) => ({ level, count: value.count, targetNodeId: value.targetNodeId }))
      .sort((left, right) => right.count - left.count);
  }, [workspacePortfolioNodes]);
  const workspaceTransformationWatchNodes = useMemo(
    () =>
      workspacePortfolioNodes
        .map((node) => ({ node, missing: getChantierTransformationGapLabels(node) }))
        .filter((entry) => entry.missing.length > 0)
        .slice(0, 6),
    [chantierStatusCopy, workspacePortfolioNodes]
  );
  const filteredWorkspacePortfolioNodes = useMemo(() => {
    const normalizedQuery = workspacePortfolioQuery.trim().toLocaleLowerCase(getLocaleForLanguage(language));
    return [...workspacePortfolioNodes]
      .filter((node) => {
        const profile = readChantierProfile(node);
        if (workspacePortfolioScope === "readiness" && getChantierReadinessGapLabels(node).length === 0) {
          return false;
        }
        if (workspacePortfolioScope === "active" && profile.status !== "active") {
          return false;
        }
        if (workspacePortfolioScope === "ready" && profile.status !== "approved") {
          return false;
        }
        if (!normalizedQuery) {
          return true;
        }
        const haystack = [
          node.name,
          node.description ?? "",
          getChantierValueStatement(node) ?? "",
          profile.owner ?? "",
          profile.planningWindow ?? "",
          profile.reviewCadence ?? "",
          profile.quarterFocus ?? "",
          profile.cadenceMilestones ?? "",
          profile.activity ?? "",
          profile.roleModel ?? "",
          profile.requiredSkills ?? "",
          profile.peoplePlan ?? "",
          profile.signoffOwner ?? "",
          profile.transformationImpact ?? "",
          profile.adoptionNotes ?? "",
          getChantierLinkedNADisplay(node) ?? ""
        ]
          .join(" ")
          .toLocaleLowerCase(getLocaleForLanguage(language));
        return haystack.includes(normalizedQuery);
      })
      .sort((left, right) => {
        if (workspacePortfolioSort === "updated") {
          return right.updatedAt - left.updatedAt;
        }
        if (workspacePortfolioSort === "planning") {
          const leftWindow = readChantierProfile(left).planningWindow ?? "";
          const rightWindow = readChantierProfile(right).planningWindow ?? "";
          const windowDiff = leftWindow.localeCompare(rightWindow, getLocaleForLanguage(language), {
            sensitivity: "base"
          });
          if (windowDiff !== 0) return windowDiff;
        }
        if (workspacePortfolioSort === "owner") {
          const leftOwner = readChantierProfile(left).owner ?? "";
          const rightOwner = readChantierProfile(right).owner ?? "";
          const ownerDiff = leftOwner.localeCompare(rightOwner, getLocaleForLanguage(language), {
            sensitivity: "base"
          });
          if (ownerDiff !== 0) return ownerDiff;
        }
        const statusDiff =
          chantierStatusOrder.indexOf(readChantierProfile(left).status) -
          chantierStatusOrder.indexOf(readChantierProfile(right).status);
        if (statusDiff !== 0) return statusDiff;
        return left.name.localeCompare(right.name, getLocaleForLanguage(language), { sensitivity: "base" });
      });
  }, [
    chantierStatusOrder,
    language,
    workspacePortfolioNodes,
    workspacePortfolioQuery,
    workspacePortfolioScope,
    workspacePortfolioSort
  ]);
  const chantierCommandActions = useMemo(
    () => [
      {
        key: "open-active",
        title: chantierStatusCopy.actionCards.openActive,
        hint: chantierStatusCopy.actionHints.openActive,
        count: workspaceChantierStatusCounts.active,
        toneClassName: getChantierStatusTone("active"),
        targetNodeId: workspacePortfolioNodes.find((node) => readChantierProfile(node).status === "active")?.id ?? null
      },
      {
        key: "ready-to-launch",
        title: chantierStatusCopy.actionCards.readyToLaunch,
        hint: chantierStatusCopy.actionHints.readyToLaunch,
        count: workspaceChantierStatusCounts.approved,
        toneClassName: getChantierStatusTone("approved"),
        targetNodeId: workspacePortfolioNodes.find((node) => readChantierProfile(node).status === "approved")?.id ?? null
      },
      {
        key: "frame-and-decide",
        title: chantierStatusCopy.actionCards.frameAndDecide,
        hint: chantierStatusCopy.actionHints.frameAndDecide,
        count: workspaceChantierStatusCounts.draft + workspaceChantierStatusCounts.proposed,
        toneClassName: getChantierStatusTone("proposed"),
        targetNodeId:
          workspacePortfolioNodes.find((node) => {
            const status = readChantierProfile(node).status;
            return status === "draft" || status === "proposed";
          })?.id ?? null
      },
      {
        key: "paused-backlog",
        title: chantierStatusCopy.actionCards.pausedBacklog,
        hint: chantierStatusCopy.actionHints.pausedBacklog,
        count: workspaceChantierStatusCounts.paused,
        toneClassName: getChantierStatusTone("paused"),
        targetNodeId: workspacePortfolioNodes.find((node) => readChantierProfile(node).status === "paused")?.id ?? null
      },
      {
        key: "fix-readiness",
        title: chantierStatusCopy.actionCards.fixReadiness,
        hint: chantierStatusCopy.actionHints.fixReadiness,
        count: workspaceReadinessGapCount,
        toneClassName: getChantierStatusTone("draft"),
        targetNodeId: workspaceReadinessGapNodes[0]?.node.id ?? null
      }
    ],
    [
      chantierStatusCopy,
      workspaceChantierStatusCounts,
      workspacePortfolioNodes,
      workspaceReadinessGapCount,
      workspaceReadinessGapNodes
    ]
  );
  const detailsFirstFileNodeId = gridFileNodes[0]?.id ?? null;
  const nodeTreeMindMapPartitions = useMemo(
    () => partitionAlternating(nodeTreeMindMapBranchNodes),
    [nodeTreeMindMapBranchNodes]
  );
  const quickAccessGroupPartitions = useMemo(
    () => partitionAlternating(quickAccessMindMapGroups),
    [quickAccessMindMapGroups]
  );
  const quickAccessFavoritePartitions = useMemo(
    () => partitionAlternating(quickAccessMindMapDirectFavorites),
    [quickAccessMindMapDirectFavorites]
  );
  const quickAccessHasLeftBranch = quickAccessHasGroups
    ? quickAccessGroupPartitions.left.length > 0
    : quickAccessFavoritePartitions.left.length > 0;
  const quickAccessHasRightBranch = quickAccessHasGroups
    ? quickAccessGroupPartitions.right.length > 0
    : quickAccessFavoritePartitions.right.length > 0;
  const nodeTreeHasLeftBranch = nodeTreeMindMapPartitions.left.length > 0;
  const nodeTreeHasRightBranch = nodeTreeMindMapPartitions.right.length > 0;
  const quickAccessHasAnyBranch = quickAccessHasLeftBranch || quickAccessHasRightBranch;
  const nodeTreeHasAnyBranch = nodeTreeHasLeftBranch || nodeTreeHasRightBranch;
  const quickAccessVerticalBranchCount = quickAccessHasGroups
    ? quickAccessMindMapGroups.length
    : quickAccessMindMapDirectFavorites.length;
  const nodeTreeVerticalConnectorLineVisible = nodeTreeMindMapBranchNodes.length > 1;
  const quickAccessVerticalConnectorLineVisible = quickAccessVerticalBranchCount > 1;
  const nodeTreeShouldShowFileStrip = nodeTreeMindMapFileNodes.length > 0;
  const quickAccessGroupLevel = useMemo(
    () => Math.min(Math.max(quickAccessMindMapRootLevel + 1, 2), 4),
    [quickAccessMindMapRootLevel]
  );
  const quickAccessRootThemeStyle = useMemo(
    () => buildMindMapThemeStyle(quickAccessMindMapRootLevel),
    [quickAccessMindMapRootLevel]
  );
  const quickAccessGroupThemeStyle = useMemo(
    () => buildMindMapThemeStyleFromTheme(QUICK_ACCESS_GROUP_THEME),
    []
  );
  const nodeTreeRootThemeStyle = useMemo(
    () => buildMindMapThemeStyle(nodeTreeMindMapRootLevel),
    [nodeTreeMindMapRootLevel]
  );
  const verticalBranchSignature = useMemo(() => {
    if (mindMapContentMode === "quick_access") {
      return quickAccessHasGroups
        ? quickAccessMindMapGroups.map((group) => `group:${group.id}:${group.nodes.length}`).join("|")
        : quickAccessMindMapDirectFavorites.map((node) => `node:${node.id}`).join("|");
    }
    return nodeTreeMindMapBranchNodes.map((node) => `node:${node.id}`).join("|");
  }, [
    mindMapContentMode,
    nodeTreeMindMapBranchNodes,
    quickAccessHasGroups,
    quickAccessMindMapDirectFavorites,
    quickAccessMindMapGroups
  ]);

  const resolveNodeMindMapLevel = (node: AppNode, fallbackLevel: number) =>
    nodeLevelById.get(node.id) ?? fallbackLevel;

  useLayoutEffect(() => {
    if (desktopViewMode !== "mindmap" || mindMapOrientation !== "vertical") {
      setVerticalConnectorBounds((current) => (current === null ? current : null));
      return;
    }

    const container = verticalBranchesRef.current;
    if (!container) return;

    let rafId = 0;
    const measureConnectorBounds = () => {
      const branchElements = Array.from(container.children).filter(
        (child): child is HTMLElement =>
          child instanceof HTMLElement && child.classList.contains("ode-mind-branch-item")
      );

      if (branchElements.length <= 1) {
        setVerticalConnectorBounds((current) => (current === null ? current : null));
        return;
      }

      const containerRect = container.getBoundingClientRect();
      if (containerRect.width <= 0) return;

      const centers = branchElements
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return rect.left - containerRect.left + rect.width / 2;
        })
        .filter((value) => Number.isFinite(value))
        .sort((left, right) => left - right);

      if (centers.length <= 1) {
        setVerticalConnectorBounds((current) => (current === null ? current : null));
        return;
      }

      const start = Math.max(0, Math.min(containerRect.width, centers[0]));
      const end = Math.max(0, Math.min(containerRect.width, containerRect.width - centers[centers.length - 1]));

      setVerticalConnectorBounds((current) => {
        if (current && Math.abs(current.start - start) < 0.5 && Math.abs(current.end - end) < 0.5) {
          return current;
        }
        return { start, end };
      });
    };

    const scheduleMeasurement = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(measureConnectorBounds);
    };

    scheduleMeasurement();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(scheduleMeasurement);
      observer.observe(container);
      Array.from(container.children).forEach((child) => {
        if (child instanceof HTMLElement) {
          observer.observe(child);
        }
      });

      return () => {
        if (rafId) {
          window.cancelAnimationFrame(rafId);
        }
        observer.disconnect();
      };
    }

    window.addEventListener("resize", scheduleMeasurement);
    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("resize", scheduleMeasurement);
    };
  }, [desktopViewMode, mindMapOrientation, verticalBranchSignature]);

  const applyVerticalConnectorBounds = (themeStyle: MindMapThemeStyle): MindMapThemeStyle => {
    if (!verticalConnectorBounds) return themeStyle;
    return {
      ...themeStyle,
      "--ode-mind-vertical-line-start": `${verticalConnectorBounds.start}px`,
      "--ode-mind-vertical-line-end": `${verticalConnectorBounds.end}px`
    };
  };

  const renderInlineEditInput = (inputClassName: string) => (
    <input
      ref={inlineEditInputRef as RefObject<HTMLInputElement | null>}
      autoFocus
      value={editingValue}
      spellCheck
      autoCorrect="on"
      autoCapitalize="off"
      lang={getLocaleForLanguage(language)}
      onChange={(event) => onSetEditingValue(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onContextMenu={onOpenInlineEditContextMenu}
      onBlur={() => {
        void onCommitInlineEdit();
      }}
      onKeyDown={(event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.blur();
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onCancelInlineEdit();
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.blur();
        }
      }}
      className={inputClassName}
    />
  );

  const getNodeDisplayLabel = (node: AppNode) => {
    if (editingNodeId === node.id) {
      return editingValue.length > 0 ? editingValue : "\u00A0";
    }
    return isNodeProvisionalInlineCreate(node.id) ? "\u00A0" : getNodeDisplayName(node);
  };

  const getNodeDisplayText = (node: AppNode) => {
    const label = getNodeDisplayLabel(node);
    return label === "\u00A0" ? "" : label;
  };

  const renderEditableNodeLabel = (
    node: AppNode,
    labelClassName: string,
    inputClassName: string
  ) => {
    const isEditingHere = editingNodeId === node.id && editingSurface === "grid";
    if (!isEditingHere) {
      return <span className={labelClassName}>{getNodeDisplayLabel(node)}</span>;
    }
    return renderInlineEditInput(inputClassName);
  };

  const renderEmptyStateAction = () => {
    if (showUploadEmptyStateAction) {
      return (
        <OdeTooltip label={t("desktop.upload")} side="bottom">
          <button
            type="button"
            className="ode-text-btn mt-3 inline-flex h-9 w-9 items-center justify-center px-0 text-[0.92rem]"
            onClick={onTriggerUpload}
            aria-label={t("desktop.upload")}
          >
            <UploadGlyphSmall />
          </button>
        </OdeTooltip>
      );
    }
    if (showCreateFirstNodeAction) {
      return (
        <OdeTooltip label={t("grid.add_first_node")} side="bottom">
          <button
            type="button"
            className="ode-text-btn mt-3 h-9 w-9 px-0 text-[1.15rem] font-semibold"
            onClick={onCreateFirstNode}
            aria-label={t("grid.add_first_node")}
          >
            +
          </button>
        </OdeTooltip>
      );
    }
    return null;
  };

  const renderChantierMeta = (node: AppNode, options?: { compact?: boolean }) => {
    if (!showChantierInsights) return null;
    if (isFileLikeNode(node) || !isChantierNode(node)) return null;
    const chantierProfile = readChantierProfile(node);
    const linkedNA = getChantierLinkedNADisplay(node);
    const compact = options?.compact ?? false;

    return (
      <div className={`flex flex-wrap items-center gap-2 ${compact ? "mt-1" : "mt-2"}`.trim()}>
        <span className="rounded-full border border-[rgba(88,197,255,0.26)] bg-[rgba(10,62,92,0.34)] px-2 py-[3px] text-[0.63rem] font-semibold uppercase tracking-[0.12em] text-[#8ad9ff]">
          {chantierStatusCopy.chantier}
        </span>
        <span
          className={`rounded-full border px-2 py-[3px] text-[0.63rem] font-semibold uppercase tracking-[0.12em] ${getChantierStatusTone(
            chantierProfile.status
          )}`.trim()}
        >
          {chantierStatusCopy.statuses[chantierProfile.status]}
        </span>
        {!compact && linkedNA ? (
          <span className="truncate text-[0.68rem] text-[var(--ode-text-muted)]">
            {chantierStatusCopy.linkedNA}: {linkedNA}
          </span>
        ) : null}
      </div>
    );
  };

  const renderChantierPortfolioStrip = () => {
    if (!showChantierPortfolio) return null;

    return (
      <section className="mb-5 rounded-[22px] border border-[rgba(110,211,255,0.16)] bg-[linear-gradient(180deg,rgba(7,34,54,0.82),rgba(4,23,38,0.88))] px-4 py-4 shadow-[0_0_0_1px_rgba(10,92,130,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
              {chantierStatusCopy.portfolioTitle}
            </div>
            <div className="mt-1 text-[0.92rem] text-[var(--ode-text-muted)]">
              {chantierStatusCopy.portfolioSummary(chantierNodeCount)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-full border px-3 py-1.5 text-[0.72rem] font-medium transition ${
                activeChantierStatusFilter === "all"
                  ? "border-[rgba(93,193,255,0.5)] bg-[rgba(23,87,124,0.45)] text-[var(--ode-text)]"
                  : "border-[var(--ode-border)] bg-[rgba(5,25,39,0.45)] text-[var(--ode-text-dim)] hover:text-[var(--ode-text)]"
              }`}
              onClick={() => onSetActiveChantierStatusFilter("all")}
            >
              {chantierStatusCopy.all} ({chantierNodeCount})
            </button>
            {chantierStatusOrder
              .filter((status) => chantierStatusCounts[status] > 0)
              .map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`rounded-full border px-3 py-1.5 text-[0.72rem] font-medium transition ${
                    activeChantierStatusFilter === status
                      ? `${getChantierStatusTone(status)}`
                      : "border-[var(--ode-border)] bg-[rgba(5,25,39,0.45)] text-[var(--ode-text-dim)] hover:text-[var(--ode-text)]"
                  }`}
                  onClick={() => onSetActiveChantierStatusFilter(status)}
                >
                  {chantierStatusCopy.statuses[status]} ({chantierStatusCounts[status]})
                </button>
              ))}
          </div>
        </div>
      </section>
    );
  };

  const renderChantierGovernanceJumpRow = (node: AppNode) => {
    const chantierProfile = readChantierProfile(node);
    const linkedNA = getChantierLinkedNADisplay(node);
    const numberLabel = scopedNumbering.get(node.id) ?? "";

    return (
      <button
        key={`chantier-governance-${node.id}`}
        type="button"
        className="flex w-full items-start justify-between gap-3 rounded-[18px] border border-[var(--ode-border)] bg-[rgba(7,27,42,0.54)] px-3 py-3 text-left transition hover:border-[rgba(93,193,255,0.34)] hover:bg-[rgba(11,40,61,0.6)]"
        onClick={() => onJumpToWorkspaceChantier(node.id)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {numberLabel ? (
              <span className="rounded-sm border border-[var(--ode-border-strong)] px-1.5 py-[1px] text-[0.68rem] text-[var(--ode-text-dim)]">
                {numberLabel}
              </span>
            ) : null}
            <span className="truncate text-[0.95rem] font-medium text-[var(--ode-text)]">{node.name}</span>
          </div>
          {linkedNA ? (
            <div className="mt-1 truncate text-[0.72rem] text-[var(--ode-text-dim)]">
              {chantierStatusCopy.linkedNA}: {linkedNA}
            </div>
          ) : null}
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-[3px] text-[0.62rem] font-semibold uppercase tracking-[0.12em] ${getChantierStatusTone(
            chantierProfile.status
          )}`.trim()}
        >
          {chantierStatusCopy.statuses[chantierProfile.status]}
        </span>
      </button>
    );
  };

  const renderChantierGovernanceQueue = (
    title: string,
    count: number,
    nodes: AppNode[],
    emptyCopy: string
  ) => (
    <section className="rounded-[20px] border border-[rgba(110,211,255,0.14)] bg-[rgba(4,20,33,0.52)] px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">{title}</div>
        <div className="text-[0.92rem] font-medium text-[var(--ode-text-muted)]">{count}</div>
      </div>
      <div className="mt-3 space-y-2">
        {nodes.length > 0 ? (
          nodes.map((node) => renderChantierGovernanceJumpRow(node))
        ) : (
          <div className="rounded-[16px] border border-dashed border-[rgba(110,211,255,0.16)] bg-[rgba(6,24,38,0.34)] px-3 py-3 text-[0.8rem] text-[var(--ode-text-dim)]">
            {emptyCopy}
          </div>
        )}
      </div>
    </section>
  );

  const renderChantierGovernancePanel = () => {
    if (!showWorkspaceChantierGovernance) return null;

    return (
      <section className="mb-5 rounded-[22px] border border-[rgba(110,211,255,0.16)] bg-[linear-gradient(180deg,rgba(6,30,48,0.82),rgba(4,18,30,0.9))] px-4 py-4 shadow-[0_0_0_1px_rgba(10,92,130,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
              {chantierStatusCopy.governanceTitle}
            </div>
            <div className="mt-1 text-[0.92rem] text-[var(--ode-text-muted)]">
              {chantierStatusCopy.governanceSummary(workspaceChantierNodeCount)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {chantierStatusOrder
              .filter((status) => workspaceChantierStatusCounts[status] > 0)
              .map((status) => (
                <span
                  key={`workspace-chantier-${status}`}
                  className={`rounded-full border px-3 py-1.5 text-[0.72rem] font-medium ${getChantierStatusTone(status)}`.trim()}
                >
                  {chantierStatusCopy.statuses[status]} ({workspaceChantierStatusCounts[status]})
                </span>
              ))}
          </div>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {renderChantierGovernanceQueue(
            chantierStatusCopy.activeNow,
            workspaceChantierStatusCounts.active,
            workspaceActiveChantierNodes,
            chantierStatusCopy.noActive
          )}
          {renderChantierGovernanceQueue(
            chantierStatusCopy.needsAttention,
            workspaceAttentionNodeCount,
            workspaceAttentionChantierNodes,
            chantierStatusCopy.noAttention
          )}
        </div>
      </section>
    );
  };

  const getChantierValueStatement = (node: AppNode) => {
    const value = node.properties?.odeObjective;
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
  };

  const getChantierSignalPills = (node: AppNode) => {
    const chantierProfile = readChantierProfile(node);
    const pills: string[] = [];
    if (chantierProfile.owner) pills.push(chantierStatusCopy.signals.owner);
    if (chantierProfile.planningWindow) pills.push(chantierStatusCopy.signals.planningWindow);
    if (chantierProfile.reviewCadence) pills.push(chantierStatusCopy.signals.cadence);
    if (chantierProfile.quarterFocus) pills.push(chantierStatusCopy.signals.quarterFocus);
    if (chantierProfile.cadenceMilestones) pills.push(chantierStatusCopy.signals.milestones);
    if (chantierProfile.capacityPlan) pills.push(chantierStatusCopy.signals.capacity);
    if (chantierProfile.dependencies) pills.push(chantierStatusCopy.signals.dependencies);
    if (chantierProfile.activity) pills.push(chantierStatusCopy.signals.activity);
    if (chantierProfile.resources) pills.push(chantierStatusCopy.signals.resources);
    if (chantierProfile.roleModel) pills.push(chantierStatusCopy.signals.roleModel);
    if (chantierProfile.requiredSkills) pills.push(chantierStatusCopy.signals.skills);
    if (chantierProfile.peoplePlan) pills.push(chantierStatusCopy.signals.people);
    if (chantierProfile.indicators) pills.push(chantierStatusCopy.signals.indicators);
    if (chantierProfile.evidencePlan) pills.push(chantierStatusCopy.signals.evidence);
    if (chantierProfile.signoffOwner) pills.push(chantierStatusCopy.signals.signoffOwner);
    if (chantierProfile.signoffState) pills.push(chantierStatusCopy.signals.signoffState);
    if (chantierProfile.acceptancePlan) pills.push(chantierStatusCopy.signals.acceptance);
    if (chantierProfile.closurePack) pills.push(chantierStatusCopy.signals.closurePack);
    if (chantierProfile.approvalComment) pills.push(chantierStatusCopy.signals.gate);
    if (chantierProfile.decisionLog) pills.push(chantierStatusCopy.signals.decision);
    if (chantierProfile.maturityLevel) pills.push(chantierStatusCopy.signals.maturity);
    if (chantierProfile.transformationImpact) pills.push(chantierStatusCopy.signals.transformation);
    if (chantierProfile.adoptionNotes) pills.push(chantierStatusCopy.signals.adoption);
    if (chantierProfile.closureSummary) pills.push(chantierStatusCopy.signals.closure);
    if (chantierProfile.retex) pills.push(chantierStatusCopy.signals.retex);
    return pills;
  };

  const renderChantierManagementPreview = (node: AppNode, toneClassName: string) => (
    <button
      key={`chantier-management-preview-${node.id}`}
      type="button"
      className="inline-flex items-center gap-2 rounded-full border border-[var(--ode-border)] bg-[rgba(6,24,38,0.48)] px-3 py-1.5 text-left text-[0.72rem] text-[var(--ode-text-muted)] transition hover:border-[rgba(93,193,255,0.34)] hover:text-[var(--ode-text)]"
      onClick={() => onJumpToWorkspaceChantier(node.id)}
    >
      <span className={`rounded-full border px-1.5 py-[1px] text-[0.6rem] font-semibold uppercase tracking-[0.12em] ${toneClassName}`.trim()}>
        {chantierStatusCopy.statuses[readChantierProfile(node).status]}
      </span>
      <span className="max-w-[14rem] truncate">{node.name}</span>
    </button>
  );

  const renderChantierManagementBoard = () => {
    if (!showWorkspaceChantierGovernance) return null;

    return (
      <section className="mb-5 rounded-[22px] border border-[rgba(110,211,255,0.16)] bg-[linear-gradient(180deg,rgba(5,25,40,0.82),rgba(4,18,29,0.9))] px-4 py-4 shadow-[0_0_0_1px_rgba(10,92,130,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
              {chantierStatusCopy.managementTitle}
            </div>
            <div className="mt-1 text-[0.92rem] text-[var(--ode-text-muted)]">
              {chantierStatusCopy.managementSummary(workspaceChantierNodeCount)}
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {chantierManagementLanes.map((lane) => (
            <section
              key={lane.key}
              className="rounded-[20px] border border-[rgba(110,211,255,0.14)] bg-[rgba(4,20,33,0.52)] px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[0.75rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
                    {lane.title}
                  </div>
                  <div className="mt-1 text-[0.8rem] text-[var(--ode-text-muted)]">{lane.hint}</div>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-[3px] text-[0.7rem] font-semibold uppercase tracking-[0.12em] ${lane.toneClassName}`.trim()}
                >
                  {lane.count}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {lane.nodes.length > 0 ? (
                  lane.nodes.map((node) => renderChantierManagementPreview(node, lane.toneClassName))
                ) : (
                  <div className="rounded-[16px] border border-dashed border-[rgba(110,211,255,0.16)] bg-[rgba(6,24,38,0.34)] px-3 py-3 text-[0.8rem] text-[var(--ode-text-dim)]">
                    {lane.emptyCopy}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      </section>
    );
  };

  const renderChantierCommandCenter = () => {
    if (!showWorkspaceChantierGovernance) return null;

    return (
      <section className="mb-5 rounded-[22px] border border-[rgba(110,211,255,0.16)] bg-[linear-gradient(180deg,rgba(6,30,48,0.76),rgba(4,18,29,0.9))] px-4 py-4 shadow-[0_0_0_1px_rgba(10,92,130,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
              {chantierStatusCopy.commandCenterTitle}
            </div>
            <div className="mt-1 text-[0.92rem] text-[var(--ode-text-muted)]">
              {chantierStatusCopy.commandCenterSummary(workspaceChantierNodeCount)}
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {chantierCommandActions.map((action) => {
            const disabled = !action.targetNodeId;
            return (
              <button
                key={action.key}
                type="button"
                className={`rounded-[20px] border px-4 py-4 text-left transition ${
                  disabled
                    ? "cursor-default border-[rgba(110,211,255,0.1)] bg-[rgba(4,20,33,0.34)] text-[var(--ode-text-dim)]"
                    : "border-[rgba(110,211,255,0.16)] bg-[rgba(4,20,33,0.56)] hover:border-[rgba(93,193,255,0.34)] hover:bg-[rgba(11,40,61,0.6)]"
                }`}
                onClick={() => {
                  if (action.targetNodeId) {
                    onJumpToWorkspaceChantier(action.targetNodeId);
                  }
                }}
                disabled={disabled}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[0.78rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                      {action.title}
                    </div>
                    <div className="mt-2 text-[0.84rem] leading-6 text-[var(--ode-text-muted)]">{action.hint}</div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-[3px] text-[0.7rem] font-semibold uppercase tracking-[0.12em] ${action.toneClassName}`.trim()}
                  >
                    {action.count}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    );
  };

  const renderRadarGroupRow = (
    key: string,
    label: string,
    count: number,
    targetNodeId: string | null,
    meta?: string
  ) => (
    <button
      key={key}
      type="button"
      className={`flex w-full items-start justify-between gap-3 rounded-[16px] border px-3 py-3 text-left transition ${
        targetNodeId
          ? "border-[var(--ode-border)] bg-[rgba(7,27,42,0.54)] hover:border-[rgba(93,193,255,0.34)] hover:bg-[rgba(11,40,61,0.6)]"
          : "cursor-default border-[rgba(110,211,255,0.1)] bg-[rgba(4,20,33,0.34)]"
      }`}
      onClick={() => {
        if (targetNodeId) {
          onJumpToWorkspaceChantier(targetNodeId);
        }
      }}
      disabled={!targetNodeId}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[0.9rem] font-medium text-[var(--ode-text)]">{label}</div>
        {meta ? <div className="mt-1 text-[0.76rem] text-[var(--ode-text-dim)]">{meta}</div> : null}
      </div>
      <span className="rounded-full border border-[rgba(88,197,255,0.2)] bg-[rgba(10,62,92,0.24)] px-2 py-[3px] text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#8ad9ff]">
        {count}
      </span>
    </button>
  );

  const renderChantierPlanningRadar = () => {
    if (!showWorkspaceChantierGovernance) return null;

    return (
      <section className="mb-5 rounded-[22px] border border-[rgba(110,211,255,0.16)] bg-[linear-gradient(180deg,rgba(4,20,33,0.76),rgba(3,16,27,0.88))] px-4 py-4 shadow-[0_0_0_1px_rgba(10,92,130,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
              {chantierStatusCopy.planningRadarTitle}
            </div>
            <div className="mt-1 text-[0.92rem] text-[var(--ode-text-muted)]">{chantierStatusCopy.planningRadarSummary}</div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          <section className="rounded-[20px] border border-[rgba(110,211,255,0.14)] bg-[rgba(4,20,33,0.52)] px-4 py-4">
            <div className="text-[0.75rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">{chantierStatusCopy.ownerLoadTitle}</div>
            <div className="mt-3 space-y-2">
              {workspaceOwnerHotspots.length > 0 ? (
                workspaceOwnerHotspots.map((entry) =>
                  renderRadarGroupRow(`owner-${entry.label}`, entry.label, entry.count, entry.targetNodeId)
                )
              ) : (
                <div className="rounded-[16px] border border-dashed border-[rgba(110,211,255,0.16)] bg-[rgba(6,24,38,0.34)] px-3 py-3 text-[0.8rem] text-[var(--ode-text-dim)]">
                  {chantierStatusCopy.emptyOwnerLoad}
                </div>
              )}
            </div>
          </section>
          <section className="rounded-[20px] border border-[rgba(110,211,255,0.14)] bg-[rgba(4,20,33,0.52)] px-4 py-4">
            <div className="text-[0.75rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
              {chantierStatusCopy.planningWindowsTitle}
            </div>
            <div className="mt-3 space-y-2">
              {workspacePlanningWindows.length > 0 ? (
                workspacePlanningWindows.map((entry) =>
                  renderRadarGroupRow(`window-${entry.label}`, entry.label, entry.count, entry.targetNodeId)
                )
              ) : (
                <div className="rounded-[16px] border border-dashed border-[rgba(110,211,255,0.16)] bg-[rgba(6,24,38,0.34)] px-3 py-3 text-[0.8rem] text-[var(--ode-text-dim)]">
                  {chantierStatusCopy.emptyPlanningWindows}
                </div>
              )}
            </div>
          </section>
          <section className="rounded-[20px] border border-[rgba(110,211,255,0.14)] bg-[rgba(4,20,33,0.52)] px-4 py-4">
            <div className="text-[0.75rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
              {chantierStatusCopy.readinessGapsTitle}
            </div>
            <div className="mt-3 space-y-2">
              {workspaceReadinessGapNodes.length > 0 ? (
                workspaceReadinessGapNodes.map(({ node, missing }) =>
                  renderRadarGroupRow(`gap-${node.id}`, node.name, missing.length, node.id, missing.slice(0, 4).join(", "))
                )
              ) : (
                <div className="rounded-[16px] border border-dashed border-[rgba(110,211,255,0.16)] bg-[rgba(6,24,38,0.34)] px-3 py-3 text-[0.8rem] text-[var(--ode-text-dim)]">
                  {chantierStatusCopy.emptyReadinessGaps}
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    );
  };

  const renderWorkspaceChantierPortfolioList = () => {
    if (!showWorkspaceChantierGovernance) return null;

    return (
      <section className="mb-5 rounded-[22px] border border-[rgba(110,211,255,0.16)] bg-[linear-gradient(180deg,rgba(4,20,33,0.76),rgba(3,16,27,0.88))] px-4 py-4 shadow-[0_0_0_1px_rgba(10,92,130,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
              {chantierStatusCopy.portfolioListTitle}
            </div>
            <div className="mt-1 text-[0.92rem] text-[var(--ode-text-muted)]">
              {chantierStatusCopy.portfolioListSummary(filteredWorkspacePortfolioNodes.length)}
            </div>
          </div>
          <div className="w-full max-w-[420px]">
            <label className="sr-only" htmlFor="chantier-portfolio-search">
              {chantierStatusCopy.portfolioSearchPlaceholder}
            </label>
            <input
              id="chantier-portfolio-search"
              type="search"
              value={workspacePortfolioQuery}
              onChange={(event) => setWorkspacePortfolioQuery(event.target.value)}
              placeholder={chantierStatusCopy.portfolioSearchPlaceholder}
              className="w-full rounded-[16px] border border-[rgba(88,197,255,0.18)] bg-[rgba(7,29,45,0.8)] px-3 py-2 text-[0.86rem] text-[var(--ode-text)] outline-none transition placeholder:text-[var(--ode-text-dim)] focus:border-[rgba(93,193,255,0.46)] focus:shadow-[0_0_0_1px_rgba(93,193,255,0.16)]"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {(
            [
              ["all", chantierStatusCopy.portfolioScopes.all],
              ["active", chantierStatusCopy.portfolioScopes.active],
              ["ready", chantierStatusCopy.portfolioScopes.ready],
              ["readiness", chantierStatusCopy.portfolioScopes.readiness]
            ] as const
          ).map(([scope, label]) => {
            const active = workspacePortfolioScope === scope;
            return (
              <button
                key={`workspace-portfolio-scope-${scope}`}
                type="button"
                className={`rounded-full border px-3 py-[6px] text-[0.68rem] font-semibold uppercase tracking-[0.12em] transition ${
                  active
                    ? "border-[rgba(93,193,255,0.5)] bg-[rgba(17,86,128,0.34)] text-[#dff7ff]"
                    : "border-[rgba(88,197,255,0.16)] bg-[rgba(7,27,42,0.42)] text-[var(--ode-text-dim)] hover:border-[rgba(88,197,255,0.32)] hover:text-[var(--ode-text)]"
                }`.trim()}
                onClick={() => setWorkspacePortfolioScope(scope)}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(
            [
              ["status", chantierStatusCopy.portfolioSorts.status],
              ["planning", chantierStatusCopy.portfolioSorts.planning],
              ["owner", chantierStatusCopy.portfolioSorts.owner],
              ["updated", chantierStatusCopy.portfolioSorts.updated]
            ] as const
          ).map(([sort, label]) => {
            const active = workspacePortfolioSort === sort;
            return (
              <button
                key={`workspace-portfolio-sort-${sort}`}
                type="button"
                className={`rounded-full border px-3 py-[6px] text-[0.65rem] font-semibold uppercase tracking-[0.12em] transition ${
                  active
                    ? "border-[rgba(255,196,112,0.44)] bg-[rgba(107,67,12,0.24)] text-[#ffe1b0]"
                    : "border-[rgba(255,196,112,0.16)] bg-[rgba(31,20,6,0.16)] text-[var(--ode-text-dim)] hover:border-[rgba(255,196,112,0.3)] hover:text-[var(--ode-text)]"
                }`.trim()}
                onClick={() => setWorkspacePortfolioSort(sort)}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {filteredWorkspacePortfolioNodes.map((node) => {
            const chantierProfile = readChantierProfile(node);
            const linkedNA = getChantierLinkedNADisplay(node);
            const numberLabel = scopedNumbering.get(node.id) ?? "";
            const signalPills = getChantierSignalPills(node);
            const readinessGaps = getChantierReadinessGapLabels(node);
            const valueStatement = getChantierValueStatement(node);
            const planningLine = [
              chantierProfile.owner,
              chantierProfile.planningWindow,
              chantierProfile.reviewCadence,
              chantierProfile.quarterFocus
            ]
              .filter((value): value is string => Boolean(value))
              .join(" | ");
            return (
              <button
                key={`workspace-chantier-portfolio-${node.id}`}
                type="button"
                className="flex w-full flex-col gap-3 rounded-[20px] border border-[var(--ode-border)] bg-[rgba(7,27,42,0.54)] px-4 py-4 text-left transition hover:border-[rgba(93,193,255,0.34)] hover:bg-[rgba(11,40,61,0.6)]"
                onClick={() => onJumpToWorkspaceChantier(node.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {numberLabel ? (
                        <span className="rounded-sm border border-[var(--ode-border-strong)] px-1.5 py-[1px] text-[0.68rem] text-[var(--ode-text-dim)]">
                          {numberLabel}
                        </span>
                      ) : null}
                      <span className="truncate text-[0.98rem] font-medium text-[var(--ode-text)]">{node.name}</span>
                    </div>
                    {linkedNA ? (
                      <div className="mt-1 truncate text-[0.72rem] text-[var(--ode-text-dim)]">
                        {chantierStatusCopy.linkedNA}: {linkedNA}
                      </div>
                    ) : null}
                    {valueStatement ? (
                      <div className="mt-2 text-[0.86rem] leading-6 text-[var(--ode-text)]">{valueStatement}</div>
                    ) : null}
                    {node.description ? (
                      <div className="mt-2 text-[0.82rem] text-[var(--ode-text-muted)]">{node.description}</div>
                    ) : null}
                    {planningLine ? (
                      <div className="mt-2 text-[0.74rem] uppercase tracking-[0.12em] text-[var(--ode-text-dim)]">
                        {planningLine}
                      </div>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-[3px] text-[0.62rem] font-semibold uppercase tracking-[0.12em] ${getChantierStatusTone(
                      chantierProfile.status
                    )}`.trim()}
                  >
                    {chantierStatusCopy.statuses[chantierProfile.status]}
                  </span>
                </div>
                {signalPills.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {signalPills.map((label) => (
                      <span
                        key={`${node.id}-${label}`}
                        className="rounded-full border border-[rgba(88,197,255,0.2)] bg-[rgba(10,62,92,0.24)] px-2 py-[3px] text-[0.63rem] font-semibold uppercase tracking-[0.12em] text-[#8ad9ff]"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}
                {readinessGaps.length > 0 ? (
                  <div className="rounded-[16px] border border-[rgba(255,196,112,0.18)] bg-[rgba(69,43,10,0.22)] px-3 py-2">
                    <div className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[#ffd28b]">
                      {chantierStatusCopy.readinessGapsTitle}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {readinessGaps.map((label) => (
                        <span
                          key={`${node.id}-gap-${label}`}
                          className="rounded-full border border-[rgba(255,196,112,0.18)] bg-[rgba(255,196,112,0.08)] px-2 py-[3px] text-[0.64rem] font-medium text-[#ffe1b0]"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="text-[0.8rem] text-[var(--ode-text-dim)]">
                  {chantierStatusCopy.guidance[chantierProfile.status]}
                </div>
              </button>
            );
          })}
        </div>
        {filteredWorkspacePortfolioNodes.length === 0 ? (
          <div className="mt-4 rounded-[18px] border border-dashed border-[rgba(110,211,255,0.16)] bg-[rgba(6,24,38,0.34)] px-4 py-4 text-[0.84rem] text-[var(--ode-text-dim)]">
            {chantierStatusCopy.portfolioEmptyFiltered}
          </div>
        ) : null}
      </section>
    );
  };

  const renderChantierPlatformBoard = () => {
    if (!showWorkspaceChantierGovernance) return null;

    return (
      <section className="mb-5 rounded-[22px] border border-[rgba(110,211,255,0.16)] bg-[linear-gradient(180deg,rgba(6,30,48,0.76),rgba(4,18,29,0.9))] px-4 py-4 shadow-[0_0_0_1px_rgba(10,92,130,0.08)]">
        <div>
          <div className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
            {chantierStatusCopy.platformBoardTitle}
          </div>
          <div className="mt-1 text-[0.92rem] text-[var(--ode-text-muted)]">{chantierStatusCopy.platformBoardSummary}</div>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          <section className="rounded-[20px] border border-[rgba(110,211,255,0.14)] bg-[rgba(4,20,33,0.52)] px-4 py-4">
            <div className="text-[0.75rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
              {chantierStatusCopy.catalogCoverageTitle}
            </div>
            {workspaceChantierNodeCount > 0 ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[
                  [chantierStatusCopy.catalogVersion, NA_CATALOG_VERSION],
                  [chantierStatusCopy.anchoredChantiers, `${workspaceAnchoredChantierCount}/${workspaceChantierNodeCount}`],
                  [chantierStatusCopy.uniqueNAAnchors, `${workspaceUniqueNAAnchorCount}`],
                  [chantierStatusCopy.level4CatalogEntries, `${catalogLevel4Count}`]
                ].map(([label, value]) => (
                  <div
                    key={`catalog-coverage-${label}`}
                    className="rounded-[16px] border border-[rgba(88,197,255,0.16)] bg-[rgba(7,27,42,0.48)] px-3 py-3"
                  >
                    <div className="text-[0.64rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">{label}</div>
                    <div className="mt-1 text-[1rem] font-semibold text-[var(--ode-text)]">{value}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-[16px] border border-dashed border-[rgba(110,211,255,0.16)] bg-[rgba(6,24,38,0.34)] px-3 py-3 text-[0.8rem] text-[var(--ode-text-dim)]">
                {chantierStatusCopy.emptyCatalogCoverage}
              </div>
            )}
          </section>
          <section className="rounded-[20px] border border-[rgba(110,211,255,0.14)] bg-[rgba(4,20,33,0.52)] px-4 py-4">
            <div className="text-[0.75rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
              {chantierStatusCopy.naCoverageTitle}
            </div>
            <div className="mt-3 space-y-2">
              {workspaceTopNAAnchors.length > 0 ? (
                workspaceTopNAAnchors.map((entry) =>
                  renderRadarGroupRow(`na-anchor-${entry.code}`, entry.label, entry.count, entry.targetNodeId, entry.meta ?? undefined)
                )
              ) : (
                <div className="rounded-[16px] border border-dashed border-[rgba(110,211,255,0.16)] bg-[rgba(6,24,38,0.34)] px-3 py-3 text-[0.8rem] text-[var(--ode-text-dim)]">
                  {chantierStatusCopy.emptyNACoverage}
                </div>
              )}
            </div>
          </section>
          <section className="rounded-[20px] border border-[rgba(110,211,255,0.14)] bg-[rgba(4,20,33,0.52)] px-4 py-4">
            <div className="text-[0.75rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
              {chantierStatusCopy.unanchoredChantiersTitle}
            </div>
            <div className="mt-3 space-y-2">
              {workspaceUnanchoredChantiers.length > 0 ? (
                workspaceUnanchoredChantiers.map((node) =>
                  renderRadarGroupRow(`unanchored-chantier-${node.id}`, node.name, 1, node.id)
                )
              ) : (
                <div className="rounded-[16px] border border-dashed border-[rgba(110,211,255,0.16)] bg-[rgba(6,24,38,0.34)] px-3 py-3 text-[0.8rem] text-[var(--ode-text-dim)]">
                  {chantierStatusCopy.emptyUnanchoredChantiers}
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    );
  };

  const renderChantierExecutionBoard = () => {
    if (!showWorkspaceChantierGovernance) return null;

    return (
      <section className="mb-5 rounded-[22px] border border-[rgba(110,211,255,0.16)] bg-[linear-gradient(180deg,rgba(6,28,44,0.76),rgba(4,16,28,0.9))] px-4 py-4 shadow-[0_0_0_1px_rgba(10,92,130,0.08)]">
        <div>
          <div className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
            {chantierStatusCopy.executionBoardTitle}
          </div>
          <div className="mt-1 text-[0.92rem] text-[var(--ode-text-muted)]">{chantierStatusCopy.executionBoardSummary}</div>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <section className="rounded-[20px] border border-[rgba(110,211,255,0.14)] bg-[rgba(4,20,33,0.52)] px-4 py-4">
            <div className="text-[0.75rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
              {chantierStatusCopy.capacityConflictsTitle}
            </div>
            <div className="mt-3 space-y-2">
              {workspaceCapacityConflictRows.length > 0 ? (
                workspaceCapacityConflictRows.map((entry) =>
                  renderRadarGroupRow(`capacity-conflict-${entry.label}-${entry.meta}`, entry.label, entry.count, entry.targetNodeId, entry.meta)
                )
              ) : (
                <div className="rounded-[16px] border border-dashed border-[rgba(110,211,255,0.16)] bg-[rgba(6,24,38,0.34)] px-3 py-3 text-[0.8rem] text-[var(--ode-text-dim)]">
                  {chantierStatusCopy.emptyCapacityConflicts}
                </div>
              )}
            </div>
          </section>
          <section className="rounded-[20px] border border-[rgba(110,211,255,0.14)] bg-[rgba(4,20,33,0.52)] px-4 py-4">
            <div className="text-[0.75rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
              {chantierStatusCopy.cadenceWatchTitle}
            </div>
            <div className="mt-3 space-y-2">
              {workspaceCadenceWatchNodes.length > 0 ? (
                workspaceCadenceWatchNodes.map(({ node, missing }) =>
                  renderRadarGroupRow(`cadence-watch-${node.id}`, node.name, missing.length, node.id, missing.slice(0, 4).join(", "))
                )
              ) : (
                <div className="rounded-[16px] border border-dashed border-[rgba(110,211,255,0.16)] bg-[rgba(6,24,38,0.34)] px-3 py-3 text-[0.8rem] text-[var(--ode-text-dim)]">
                  {chantierStatusCopy.emptyCadenceWatch}
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    );
  };

  const renderChantierTraceabilityBoard = () => {
    if (!showWorkspaceChantierGovernance) return null;

    return (
      <section className="mb-5 rounded-[22px] border border-[rgba(110,211,255,0.16)] bg-[linear-gradient(180deg,rgba(6,28,44,0.76),rgba(4,16,28,0.9))] px-4 py-4 shadow-[0_0_0_1px_rgba(10,92,130,0.08)]">
        <div>
          <div className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
            {chantierStatusCopy.traceabilityBoardTitle}
          </div>
          <div className="mt-1 text-[0.92rem] text-[var(--ode-text-muted)]">{chantierStatusCopy.traceabilityBoardSummary}</div>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <section className="rounded-[20px] border border-[rgba(110,211,255,0.14)] bg-[rgba(4,20,33,0.52)] px-4 py-4">
            <div className="text-[0.75rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
              {chantierStatusCopy.signoffWatchTitle}
            </div>
            <div className="mt-3 space-y-2">
              {workspaceTraceabilityWatchNodes.length > 0 ? (
                workspaceTraceabilityWatchNodes.map(({ node, missing }) =>
                  renderRadarGroupRow(`traceability-watch-${node.id}`, node.name, missing.length, node.id, missing.slice(0, 4).join(", "))
                )
              ) : (
                <div className="rounded-[16px] border border-dashed border-[rgba(110,211,255,0.16)] bg-[rgba(6,24,38,0.34)] px-3 py-3 text-[0.8rem] text-[var(--ode-text-dim)]">
                  {chantierStatusCopy.emptySignoffWatch}
                </div>
              )}
            </div>
          </section>
          <section className="rounded-[20px] border border-[rgba(110,211,255,0.14)] bg-[rgba(4,20,33,0.52)] px-4 py-4">
            <div className="text-[0.75rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
              {chantierStatusCopy.closureWatchTitle}
            </div>
            <div className="mt-3 space-y-2">
              {workspaceClosureWatchNodes.length > 0 ? (
                workspaceClosureWatchNodes.map(({ node, missing }) =>
                  renderRadarGroupRow(`closure-watch-${node.id}`, node.name, missing.length, node.id, missing.slice(0, 4).join(", "))
                )
              ) : (
                <div className="rounded-[16px] border border-dashed border-[rgba(110,211,255,0.16)] bg-[rgba(6,24,38,0.34)] px-3 py-3 text-[0.8rem] text-[var(--ode-text-dim)]">
                  {chantierStatusCopy.emptyClosureWatch}
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    );
  };

  const renderChantierPeopleBoard = () => {
    if (!showWorkspaceChantierGovernance) return null;

    return (
      <section className="mb-5 rounded-[22px] border border-[rgba(110,211,255,0.16)] bg-[linear-gradient(180deg,rgba(6,28,44,0.76),rgba(4,16,28,0.9))] px-4 py-4 shadow-[0_0_0_1px_rgba(10,92,130,0.08)]">
        <div>
          <div className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
            {chantierStatusCopy.peopleBoardTitle}
          </div>
          <div className="mt-1 text-[0.92rem] text-[var(--ode-text-muted)]">{chantierStatusCopy.peopleBoardSummary}</div>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <section className="rounded-[20px] border border-[rgba(110,211,255,0.14)] bg-[rgba(4,20,33,0.52)] px-4 py-4">
            <div className="text-[0.75rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
              {chantierStatusCopy.roleHotspotsTitle}
            </div>
            <div className="mt-3 space-y-2">
              {workspaceRoleSkillHotspots.length > 0 ? (
                workspaceRoleSkillHotspots.map((entry) =>
                  renderRadarGroupRow(
                    `hotspot-${entry.kind}-${entry.label}`,
                    `${chantierStatusCopy.hotspotKinds[entry.kind]} | ${entry.label}`,
                    entry.count,
                    entry.targetNodeId
                  )
                )
              ) : (
                <div className="rounded-[16px] border border-dashed border-[rgba(110,211,255,0.16)] bg-[rgba(6,24,38,0.34)] px-3 py-3 text-[0.8rem] text-[var(--ode-text-dim)]">
                  {chantierStatusCopy.emptyRoleHotspots}
                </div>
              )}
            </div>
          </section>
          <section className="rounded-[20px] border border-[rgba(110,211,255,0.14)] bg-[rgba(4,20,33,0.52)] px-4 py-4">
            <div className="text-[0.75rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
              {chantierStatusCopy.peopleGapsTitle}
            </div>
            <div className="mt-3 space-y-2">
              {workspacePeopleGapNodes.length > 0 ? (
                workspacePeopleGapNodes.map(({ node, missing }) =>
                  renderRadarGroupRow(`people-gap-${node.id}`, node.name, missing.length, node.id, missing.slice(0, 4).join(", "))
                )
              ) : (
                <div className="rounded-[16px] border border-dashed border-[rgba(110,211,255,0.16)] bg-[rgba(6,24,38,0.34)] px-3 py-3 text-[0.8rem] text-[var(--ode-text-dim)]">
                  {chantierStatusCopy.emptyPeopleGaps}
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    );
  };

  const renderChantierMaturityBoard = () => {
    if (!showWorkspaceChantierGovernance) return null;

    return (
      <section className="mb-5 rounded-[22px] border border-[rgba(110,211,255,0.16)] bg-[linear-gradient(180deg,rgba(6,28,44,0.76),rgba(4,16,28,0.9))] px-4 py-4 shadow-[0_0_0_1px_rgba(10,92,130,0.08)]">
        <div>
          <div className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
            {chantierStatusCopy.maturityBoardTitle}
          </div>
          <div className="mt-1 text-[0.92rem] text-[var(--ode-text-muted)]">{chantierStatusCopy.maturityBoardSummary}</div>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <section className="rounded-[20px] border border-[rgba(110,211,255,0.14)] bg-[rgba(4,20,33,0.52)] px-4 py-4">
            <div className="text-[0.75rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
              {chantierStatusCopy.maturityDistributionTitle}
            </div>
            <div className="mt-3 space-y-2">
              {workspaceMaturityDistribution.length > 0 ? (
                workspaceMaturityDistribution.map((entry) => (
                  <button
                    key={`maturity-distribution-${entry.level}`}
                    type="button"
                    className={`flex w-full items-center justify-between gap-3 rounded-[16px] border px-3 py-3 text-left transition hover:brightness-105 ${getMaturityTone(
                      entry.level
                    )}`.trim()}
                    onClick={() => {
                      if (entry.targetNodeId) {
                        onJumpToWorkspaceChantier(entry.targetNodeId);
                      }
                    }}
                    disabled={!entry.targetNodeId}
                  >
                    <span className="text-[0.84rem] font-medium">{chantierStatusCopy.maturityLevels[entry.level]}</span>
                    <span className="rounded-full border border-current/25 px-2 py-[3px] text-[0.68rem] font-semibold uppercase tracking-[0.12em]">
                      {entry.count}
                    </span>
                  </button>
                ))
              ) : (
                <div className="rounded-[16px] border border-dashed border-[rgba(110,211,255,0.16)] bg-[rgba(6,24,38,0.34)] px-3 py-3 text-[0.8rem] text-[var(--ode-text-dim)]">
                  {chantierStatusCopy.emptyMaturityDistribution}
                </div>
              )}
            </div>
          </section>
          <section className="rounded-[20px] border border-[rgba(110,211,255,0.14)] bg-[rgba(4,20,33,0.52)] px-4 py-4">
            <div className="text-[0.75rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">
              {chantierStatusCopy.transformationWatchTitle}
            </div>
            <div className="mt-3 space-y-2">
              {workspaceTransformationWatchNodes.length > 0 ? (
                workspaceTransformationWatchNodes.map(({ node, missing }) =>
                  renderRadarGroupRow(
                    `transformation-watch-${node.id}`,
                    node.name,
                    missing.length,
                    node.id,
                    missing.slice(0, 4).join(", ")
                  )
                )
              ) : (
                <div className="rounded-[16px] border border-dashed border-[rgba(110,211,255,0.16)] bg-[rgba(6,24,38,0.34)] px-3 py-3 text-[0.8rem] text-[var(--ode-text-dim)]">
                  {chantierStatusCopy.emptyTransformationWatch}
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    );
  };

  const renderQuickAccessFavoriteCard = (
    node: AppNode,
    className = "",
    fallbackLevel = quickAccessGroupLevel + 1
  ) => {
    const numberLabel = scopedNumbering.get(node.id) ?? "";
    const selected = selectedNodeIds.has(node.id);
    const focused = selectedNodeId === node.id;
    const themeStyle = buildMindMapThemeStyle(resolveNodeMindMapLevel(node, fallbackLevel));

    return (
      <button
        key={node.id}
        type="button"
        data-ode-node-id={node.id}
        className={`ode-quick-mind-favorite ${selected ? "ode-quick-mind-favorite-active" : ""} ${focused ? "ode-quick-mind-favorite-focused" : ""} ${cutPendingNodeIds.has(node.id) ? "ode-cut-pending" : ""} ${draggingNodeId === node.id ? "ode-grid-card-dragging" : ""} ${className}`.trim()}
        style={themeStyle}
        draggable={editingNodeId !== node.id}
        onClick={() => {
          onCloseContextMenu();
          onOpenQuickAccessNode(node.id);
        }}
        onDragStart={(event) => onBeginNodeDrag(event, node.id)}
        onDragEnd={onClearDraggingState}
        onDoubleClick={() => {
          if (isFileLikeNode(node)) {
            onReviewMindMapFile(node.id);
          }
        }}
        onContextMenu={(event) => onOpenQuickAccessNodeContextMenu(event, node.id)}
      >
        {numberLabel ? (
          <span className="ode-quick-mind-number">{numberLabel}</span>
        ) : (
          <span className="ode-quick-mind-number ode-quick-mind-number-empty" aria-hidden />
        )}
        <span className="ode-quick-mind-favorite-icon">
          <NodeGlyph
            node={node}
            active={selected || focused}
            folderState={!isFileLikeNode(node) ? folderNodeStateById.get(node.id) : undefined}
            showExecutionOwnerGlyph={executionOwnerNodeIds.has(node.id)}
          />
        </span>
        {renderEditableNodeLabel(
          node,
          `ode-quick-mind-favorite-label ${
            shouldCenterMindMapLabel(getNodeDisplayText(node)) ? "ode-mind-label-smart-center" : ""
          }`.trim(),
          "ode-input h-8 w-full rounded px-2 text-[1rem]"
        )}
        {renderChantierMeta(node, { compact: true })}
      </button>
    );
  };

  const renderNodeTreeMindNodeCard = (node: AppNode, className = "") => {
    const numberLabel = scopedNumbering.get(node.id) ?? "";
    const selected = selectedNodeIds.has(node.id);
    const focused = selectedNodeId === node.id;
    const nodeLevel = resolveNodeMindMapLevel(node, nodeTreeMindMapRootLevel + 1);
    const themeStyle = buildMindMapThemeStyle(nodeLevel);
    const nodeIsFileLike = isFileLikeNode(node);

    return (
      <button
        key={node.id}
        data-ode-node-id={node.id}
        className={`ode-grid-card ode-mind-node ${nodeIsFileLike ? "ode-grid-card-file" : ""} ${selected ? "ode-mind-node-selected" : ""
          } ${focused ? "ode-mind-node-focused" : ""
          } ${cutPendingNodeIds.has(node.id) ? "ode-cut-pending" : ""
          } ${draggingNodeId === node.id ? "ode-grid-card-dragging" : ""
          } ${dropIndicator?.targetId === node.id
            ? dropIndicator.position === "before"
              ? "ode-grid-drop-before"
              : dropIndicator.position === "after"
                ? "ode-grid-drop-after"
                : "ode-grid-drop-inside"
            : ""
          } ${className}`.trim()}
        style={themeStyle}
        draggable={editingNodeId !== node.id}
        onClick={(event) => {
          onCloseContextMenu();
          onApplyGridSelection(node.id, {
            range: event.shiftKey,
            toggle: event.ctrlKey || event.metaKey
          });
        }}
        onContextMenu={(event) => onOpenNodeContextMenu(event, node.id)}
        onDragStart={(event) => onBeginNodeDrag(event, node.id)}
        onDragOver={(event) => {
          if (onHasExternalFileDrag(event)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            onSetDropIndicator({ targetId: node.id, position: "inside" });
            return;
          }
          const sourceId = onResolveActiveDragSourceId(event);
          if (!sourceId) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          onSetDropIndicator({ targetId: node.id, position: onDetectGridDropPosition(event, node) });
        }}
        onDrop={(event) => {
          const externalPaths = onResolveExternalDropPaths(event);
          if (externalPaths.length > 0) {
            event.preventDefault();
            onClearDraggingState();
            onImportExternalFilesToNode(externalPaths, node.id, "grid");
            return;
          }
          event.preventDefault();
          const sourceId = onResolveActiveDragSourceId(event);
          if (!sourceId) return;
          const position =
            dropIndicator?.targetId === node.id
              ? dropIndicator.position
              : onDetectGridDropPosition(event, node);
          onClearDraggingState();
          onApplyGridDropMove(sourceId, node.id, position);
        }}
        onDragEnd={onClearDraggingState}
        onDoubleClick={() => {
          if (node.type === "folder") {
            onOpenFolder(node.id);
          } else if (nodeIsFileLike) {
            onReviewMindMapFile(node.id);
          }
        }}
      >
        {!nodeIsFileLike && numberLabel ? (
          <span className="ode-mind-number-chip">
            {numberLabel}
          </span>
        ) : null}
        <NodeGlyph
          node={node}
          active={selected || focused}
          folderState={!nodeIsFileLike ? folderNodeStateById.get(node.id) : undefined}
          showExecutionOwnerGlyph={executionOwnerNodeIds.has(node.id)}
        />
        {renderEditableNodeLabel(
          node,
          `ode-grid-card-title text-[1.01rem] font-medium ${
            shouldCenterMindMapLabel(getNodeDisplayText(node)) ? "ode-mind-label-smart-center" : ""
          }`.trim(),
          "ode-input h-8 w-full rounded px-2 text-[1.01rem] font-medium"
        )}
        {renderChantierMeta(node)}
      </button>
    );
  };

  const renderDesktopGridCard = (node: AppNode) => {
    const numberLabel = scopedNumbering.get(node.id) ?? "";
    const selected = selectedNodeIds.has(node.id);
    const focused = selectedNodeId === node.id;
    const nodeIsFileLike = isFileLikeNode(node);

    return (
      <button
        key={node.id}
        data-ode-node-id={node.id}
        className={`ode-grid-card ${nodeIsFileLike ? "ode-grid-card-file" : ""} ${selected ? "ode-grid-card-selected" : ""
          } ${focused ? "ode-grid-card-focused" : ""
          } ${cutPendingNodeIds.has(node.id) ? "ode-cut-pending" : ""
          } ${draggingNodeId === node.id ? "ode-grid-card-dragging" : ""
          } ${dropIndicator?.targetId === node.id
            ? dropIndicator.position === "before"
              ? "ode-grid-drop-before"
              : dropIndicator.position === "after"
                ? "ode-grid-drop-after"
                : "ode-grid-drop-inside"
            : ""
          }`}
        draggable={editingNodeId !== node.id}
        onClick={(event) => {
          onCloseContextMenu();
          onApplyGridSelection(node.id, {
            range: event.shiftKey,
            toggle: event.ctrlKey || event.metaKey
          });
        }}
        onContextMenu={(event) => onOpenNodeContextMenu(event, node.id)}
        onDragStart={(event) => onBeginNodeDrag(event, node.id)}
        onDragOver={(event) => {
          if (onHasExternalFileDrag(event)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            onSetDropIndicator({ targetId: node.id, position: "inside" });
            return;
          }
          const sourceId = onResolveActiveDragSourceId(event);
          if (!sourceId) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          onSetDropIndicator({ targetId: node.id, position: onDetectGridDropPosition(event, node) });
        }}
        onDrop={(event) => {
          const externalPaths = onResolveExternalDropPaths(event);
          if (externalPaths.length > 0) {
            event.preventDefault();
            onClearDraggingState();
            onImportExternalFilesToNode(externalPaths, node.id, "grid");
            return;
          }
          event.preventDefault();
          const sourceId = onResolveActiveDragSourceId(event);
          if (!sourceId) return;
          const position =
            dropIndicator?.targetId === node.id
              ? dropIndicator.position
              : onDetectGridDropPosition(event, node);
          onClearDraggingState();
          onApplyGridDropMove(sourceId, node.id, position);
        }}
        onDragEnd={onClearDraggingState}
        onDoubleClick={() => {
          if (node.type === "folder") {
            onOpenFolder(node.id);
          } else if (nodeIsFileLike) {
            onReviewMindMapFile(node.id);
          }
        }}
      >
        {!nodeIsFileLike && numberLabel ? (
          <span className="rounded-sm border border-[var(--ode-border-strong)] px-1.5 py-[1px] text-[0.72rem] text-[var(--ode-text-dim)]">
            {numberLabel}
          </span>
        ) : null}
        <NodeGlyph
          node={node}
          active={selected || focused}
          folderState={!nodeIsFileLike ? folderNodeStateById.get(node.id) : undefined}
          showExecutionOwnerGlyph={executionOwnerNodeIds.has(node.id)}
        />
        {renderEditableNodeLabel(
          node,
          "ode-grid-card-title text-[1.06rem] font-medium",
          "ode-input h-8 w-full rounded px-2 text-[1.06rem] font-medium"
        )}
        {renderChantierMeta(node)}
      </button>
    );
  };

  const renderNodeTreeMindNode = (
    node: AppNode,
    side: "left" | "right" | "vertical"
  ) => {
    const nodeLevel = resolveNodeMindMapLevel(node, nodeTreeMindMapRootLevel + 1);
    const themeStyle = buildMindMapThemeStyle(nodeLevel);
    const connectorClass =
      side === "left"
        ? "ode-mind-connector-left"
        : side === "right"
          ? "ode-mind-connector-right"
          : "ode-mind-connector-vertical";

    return (
      <div
        key={`node-tree-${side}-${node.id}`}
        className={`ode-mind-branch-item ${connectorClass}`}
        style={themeStyle}
      >
        {renderNodeTreeMindNodeCard(node)}
      </div>
    );
  };

  const renderNodeTreeMindFileStrip = () => {
    if (!nodeTreeShouldShowFileStrip) return null;

    return (
      <section className="ode-mind-file-section">
        <div className="ode-mind-file-section-title">
          {t("desktop.mindmap_files")} ({nodeTreeMindMapFileNodes.length})
        </div>
        <div className="ode-mind-file-grid">
          {nodeTreeMindMapFileNodes.map((node) => renderNodeTreeMindNodeCard(node, "ode-mind-file-card"))}
        </div>
      </section>
    );
  };

  const renderQuickAccessDirectFavorite = (
    node: AppNode,
    side: "left" | "right" | "vertical"
  ) => {
    const nodeLevel = resolveNodeMindMapLevel(node, quickAccessGroupLevel + 1);
    const themeStyle = buildMindMapThemeStyle(nodeLevel);
    const connectorClass =
      side === "left"
        ? "ode-mind-connector-left"
        : side === "right"
          ? "ode-mind-connector-right"
          : "ode-mind-connector-vertical";

    return (
      <div
        key={`quick-direct-${side}-${node.id}`}
        className={`ode-mind-branch-item ${connectorClass}`}
        style={themeStyle}
      >
        {renderQuickAccessFavoriteCard(node, "ode-quick-mind-favorite-direct", nodeLevel)}
      </div>
    );
  };

  const renderQuickAccessGroupBranch = (
    group: QuickAccessMindMapGroup,
    side: "left" | "right" | "vertical"
  ) => {
    const connectorClass =
      side === "left"
        ? "ode-mind-connector-left"
        : side === "right"
          ? "ode-mind-connector-right"
          : "ode-mind-connector-vertical";
    const quickAccessGroupDropTargetId = `favorite-group:${group.id}`;
    const isDropTarget = dropIndicator?.targetId === quickAccessGroupDropTargetId;
    const targetGroupId = group.synthetic ? null : group.id;
    const groupCardClass = `ode-quick-mind-group-card ${activeFavoriteGroupId === group.id ? "ode-quick-mind-group-card-active" : ""} ${isDropTarget ? "ode-quick-mind-group-card-drop" : ""} ${group.synthetic ? "ode-quick-mind-group-card-static" : ""}`.trim();
    const branchClass = `ode-quick-mind-group-branch ode-quick-mind-group-branch-${side} ${isDropTarget ? "ode-quick-mind-group-branch-drop" : ""}`.trim();

    const handleQuickAccessGroupDragOver = (event: DragEvent<HTMLElement>) => {
      if (onHasExternalFileDrag(event)) return;
      const sourceId = onResolveActiveDragSourceId(event);
      if (!sourceId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      onSetDropIndicator({ targetId: quickAccessGroupDropTargetId, position: "inside" });
    };

    const handleQuickAccessGroupDrop = (event: DragEvent<HTMLElement>) => {
      if (onHasExternalFileDrag(event)) return;
      const sourceId = onResolveActiveDragSourceId(event);
      if (!sourceId) return;
      event.preventDefault();
      event.stopPropagation();
      onClearDraggingState();
      onMoveNodeToQuickAccessGroup(sourceId, targetGroupId);
    };

    return (
      <div
        key={`quick-group-${side}-${group.id}`}
        className={`ode-mind-branch-item ${connectorClass}`}
        style={quickAccessGroupThemeStyle}
      >
        <div
          className={branchClass}
          onDragOver={handleQuickAccessGroupDragOver}
          onDrop={handleQuickAccessGroupDrop}
        >
          {group.synthetic ? (
            <div className={groupCardClass}>
              <span
                className={`ode-quick-mind-group-title ${
                  shouldCenterMindMapLabel(group.name) ? "ode-mind-label-smart-center" : ""
                }`.trim()}
              >
                {group.name}
              </span>
              <span className="ode-quick-mind-group-meta">{group.nodes.length}</span>
            </div>
          ) : (
            <button
              type="button"
              className={groupCardClass}
              onClick={() => onSelectQuickAccessGroup(group.id)}
              onContextMenu={(event) => onOpenQuickAccessGroupContextMenu(event, group.id)}
              onDragOver={handleQuickAccessGroupDragOver}
              onDrop={handleQuickAccessGroupDrop}
            >
              <span
                className={`ode-quick-mind-group-title ${
                  shouldCenterMindMapLabel(group.name) ? "ode-mind-label-smart-center" : ""
                }`.trim()}
              >
                {group.name}
              </span>
              <span className="ode-quick-mind-group-meta">{group.nodes.length}</span>
            </button>
          )}
          {group.nodes.length > 0 ? (
            <div className="ode-quick-mind-favorites">
              {group.nodes.map((node) => renderQuickAccessFavoriteCard(node))}
            </div>
          ) : null}
        </div>
      </div>
    );
  };
  const renderMindMapRoot = (
    label: string,
    rootNode: AppNode | null,
    themeStyle: MindMapThemeStyle,
    className = ""
  ) => {
    const selected = Boolean(rootNode && selectedNodeIds.has(rootNode.id));
    const focused = Boolean(rootNode && selectedNodeId === rootNode.id);
    const rootClassName = `ode-mind-root ${selected ? "ode-mind-root-selected" : ""} ${focused ? "ode-mind-root-focused" : ""} ${rootNode ? "ode-mind-root-button" : ""} ${className}`.trim();

    if (!rootNode) {
      return (
        <div className={rootClassName} style={themeStyle}>
          <span className="ode-mind-root-label ode-mind-label-smart-center">{label}</span>
        </div>
      );
    }

    return (
      <button
        type="button"
        data-ode-node-id={rootNode.id}
        className={rootClassName}
        style={themeStyle}
        onClick={(event) => {
          onCloseContextMenu();
          onApplyGridSelection(rootNode.id, {
            range: event.shiftKey,
            toggle: event.ctrlKey || event.metaKey
          });
        }}
        onContextMenu={(event) => onOpenNodeContextMenu(event, rootNode.id)}
        onDoubleClick={() => {
          if (rootNode.type === "folder") {
            onOpenFolder(rootNode.id);
          } else if (isFileLikeNode(rootNode)) {
            onReviewMindMapFile(rootNode.id);
          }
        }}
      >
        {editingNodeId === rootNode.id && editingSurface === "grid"
          ? renderInlineEditInput(
            "ode-input h-10 w-full rounded px-3 text-center text-[1.18rem] font-medium"
          )
          : <span className="ode-mind-root-label ode-mind-label-smart-center">{label}</span>}
      </button>
    );
  };
  if (desktopViewMode === "library") {
    return (
      <div
        className="flex-1 min-h-0 overflow-auto px-5 py-6"
        data-ode-surface="grid"
        onMouseDownCapture={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest('[data-ode-dashboard-editor="true"]')) {
            return;
          }
          onActivateGridSurface();
        }}
        onContextMenu={onOpenSurfaceContextMenu}
      >
        <ReusableLibraryPanel
          t={t}
          currentNode={currentFolderNode}
          canCreateIntoCurrentNode={canCreateFromReusableLibraryIntoCurrentNode}
          canSaveCurrentAsOrganisationModel={canSaveCurrentAsOrganisationModel}
          canSaveCurrentAsDatabaseTemplate={canSaveCurrentAsDatabaseTemplate}
          organisationModels={organisationModels}
          databaseTemplates={databaseTemplates}
          onSaveCurrentAsOrganisationModel={onSaveCurrentAsOrganisationModel}
          onSaveCurrentAsDatabaseTemplate={onSaveCurrentAsDatabaseTemplate}
          onCreateFromLibraryItem={onCreateFromReusableLibraryItem}
          onExportLibraryItem={onExportReusableLibraryItem}
          onImportLibraryJson={onImportReusableLibraryJson}
          selectedItemId={selectedNodeId}
          selectedItemIds={selectedNodeIds}
          onSelectItem={onSelectReusableLibraryItem}
          onOpenItem={onOpenReusableLibraryItem}
          onOpenItemContextMenu={onOpenReusableLibraryItemContextMenu}
        />
      </div>
    );
  }
  if (
    currentFolderNode &&
    !isFileLikeNode(currentFolderNode) &&
    currentFolderNode.properties?.odeDashboardWidget !== true &&
    desktopViewMode === "dashboard"
  ) {
    return (
      <div
        className="flex-1 min-h-0 overflow-auto px-5 py-6"
        data-ode-surface="grid"
        onMouseDownCapture={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest('[data-ode-dashboard-editor="true"]')) {
            return;
          }
          onActivateGridSurface();
        }}
        onContextMenu={onOpenSurfaceContextMenu}
      >
        <DashboardPanel
          rootNode={currentFolderNode}
          childNodes={dashboardRootChildren}
          allNodes={allNodes}
          onCreateWidget={onCreateDashboardWidget}
          onRenameWidget={onRenameDashboardWidget}
          onSaveWidgetProperties={onSaveDashboardWidgetProperties}
          onMoveWidget={onMoveDashboardWidget}
          onDeleteWidget={onDeleteDashboardWidget}
        />
      </div>
    );
  }
  return (
    <div
      className={`flex-1 min-h-0 overflow-auto px-5 py-6 ${desktopViewMode === "mindmap" ? "ode-mind-scroll-shell" : ""}`.trim()}
      data-ode-surface="grid"
      onMouseDownCapture={onActivateGridSurface}
      onContextMenu={
        desktopViewMode === "mindmap" && mindMapContentMode === "quick_access"
          ? onOpenQuickAccessSurfaceContextMenu
          : onOpenSurfaceContextMenu
      }
      onDragOver={(event) => {
        if (onHasExternalFileDrag(event)) {
          const targetEl = event.target as HTMLElement;
          if (targetEl.closest(rootInteractiveSelector)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          onSetDropIndicator({ targetId: effectiveRootDropTargetId, position: "inside" });
          return;
        }
        const sourceId = onResolveActiveDragSourceId(event);
        if (!sourceId) return;
        const targetEl = event.target as HTMLElement;
        if (targetEl.closest(rootInteractiveSelector)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onSetDropIndicator({ targetId: effectiveRootDropTargetId, position: "inside" });
      }}
      onDrop={(event) => {
        const externalPaths = onResolveExternalDropPaths(event);
        if (externalPaths.length > 0) {
          const targetEl = event.target as HTMLElement;
          if (targetEl.closest(rootInteractiveSelector)) return;
          event.preventDefault();
          onClearDraggingState();
          onImportExternalFilesToNode(externalPaths, currentFolderDropTargetId ?? null, "grid");
          return;
        }
        const sourceId = onResolveActiveDragSourceId(event);
        if (!sourceId) return;
        const targetEl = event.target as HTMLElement;
        if (targetEl.closest(rootInteractiveSelector)) return;
        event.preventDefault();
        onClearDraggingState();
        onApplyDropIntoCurrentGridFolder(sourceId);
      }}
    >
      {showChantierInsights ? (
        <>
          {renderChantierPortfolioStrip()}
          {renderChantierGovernancePanel()}
          {renderChantierCommandCenter()}
          {renderChantierManagementBoard()}
          {renderChantierPlanningRadar()}
          {renderChantierPlatformBoard()}
          {renderChantierExecutionBoard()}
          {renderChantierTraceabilityBoard()}
          {renderChantierPeopleBoard()}
          {renderChantierMaturityBoard()}
          {renderWorkspaceChantierPortfolioList()}
        </>
      ) : null}
      {dropIndicator?.targetId === effectiveRootDropTargetId ? (
        <div className="ode-root-drop-hint">{t("tree.drop_to_root")}</div>
      ) : null}
      {desktopViewMode === "grid" || desktopViewMode === "dashboard" ? (
        <>
          {gridBranchNodes.length > 0 ? (
            <div
              className="grid gap-6"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
            >
              {gridBranchNodes.map((node) => renderDesktopGridCard(node))}
            </div>
          ) : null}
          {gridFileNodes.length > 0 ? (
            <section className={`ode-file-trailing-section ${gridBranchNodes.length > 0 ? "ode-file-trailing-section-separated" : ""}`.trim()}>
              <div className="ode-file-trailing-title">
                {t("desktop.mindmap_files")} ({gridFileNodes.length})
              </div>
              <div
                className="grid gap-6"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
              >
                {gridFileNodes.map((node) => renderDesktopGridCard(node))}
              </div>
            </section>
          ) : null}
          {showEmptyState && gridNodes.length === 0 ? (
            <div className="mt-12 rounded-2xl border border-dashed border-[var(--ode-border-strong)] bg-[rgba(4,23,39,0.5)] px-6 py-8 text-center text-[var(--ode-text-muted)]">
              {renderEmptyStateAction()}
            </div>
          ) : null}
        </>
      ) : desktopViewMode === "mindmap" ? (
        <div className="ode-mind-shell">
          <div className="ode-mind-wrap">
            {mindMapContentMode === "quick_access" ? (
              <>
                {mindMapOrientation === "horizontal" ? (
                  <div className="ode-mind-horizontal">
                    <div
                      className={`ode-mind-side ode-mind-side-left ${quickAccessHasLeftBranch ? "ode-mind-side-has-branches" : ""}`.trim()}
                      style={quickAccessRootThemeStyle}
                    >
                      {quickAccessHasGroups
                        ? quickAccessGroupPartitions.left.map((group) => renderQuickAccessGroupBranch(group, "left"))
                        : quickAccessFavoritePartitions.left.map((node) => renderQuickAccessDirectFavorite(node, "left"))}
                    </div>
                    {renderMindMapRoot(
                      quickAccessMindMapRootLabel,
                      quickAccessMindMapRootNode,
                      quickAccessRootThemeStyle,
                      `${quickAccessHasLeftBranch ? "ode-mind-root-has-left" : ""} ${quickAccessHasRightBranch ? "ode-mind-root-has-right" : ""}`.trim()
                    )}
                    <div
                      className={`ode-mind-side ode-mind-side-right ${quickAccessHasRightBranch ? "ode-mind-side-has-branches" : ""}`.trim()}
                      style={quickAccessRootThemeStyle}
                    >
                      {quickAccessHasGroups
                        ? quickAccessGroupPartitions.right.map((group) => renderQuickAccessGroupBranch(group, "right"))
                        : quickAccessFavoritePartitions.right.map((node) => renderQuickAccessDirectFavorite(node, "right"))}
                    </div>
                  </div>
                ) : (
                  <div className="ode-mind-vertical">
                    {renderMindMapRoot(
                      quickAccessMindMapRootLabel,
                      quickAccessMindMapRootNode,
                      quickAccessRootThemeStyle,
                      `ode-mind-root-vertical ${quickAccessHasAnyBranch ? "ode-mind-root-has-children" : ""}`.trim()
                    )}
                    <div
                      ref={verticalBranchesRef}
                      className={`${quickAccessHasGroups ? "ode-quick-mind-group-grid" : "ode-quick-mind-favorite-grid"} ode-mind-vertical-branches ${quickAccessVerticalConnectorLineVisible ? "ode-mind-vertical-branches-has-items" : ""}`.trim()}
                      style={applyVerticalConnectorBounds(quickAccessRootThemeStyle)}
                    >
                      {quickAccessHasGroups
                        ? quickAccessMindMapGroups.map((group) => renderQuickAccessGroupBranch(group, "vertical"))
                        : quickAccessMindMapDirectFavorites.map((node) => renderQuickAccessDirectFavorite(node, "vertical"))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {mindMapOrientation === "horizontal" ? (
                  <div className="ode-mind-horizontal">
                    <div
                      className={`ode-mind-side ode-mind-side-left ${nodeTreeHasLeftBranch ? "ode-mind-side-has-branches" : ""}`.trim()}
                      style={nodeTreeRootThemeStyle}
                    >
                      {nodeTreeMindMapPartitions.left.map((node) => renderNodeTreeMindNode(node, "left"))}
                    </div>
                    {renderMindMapRoot(
                      nodeTreeMindMapRootLabel,
                      nodeTreeMindMapRootNode,
                      nodeTreeRootThemeStyle,
                      `${nodeTreeHasLeftBranch ? "ode-mind-root-has-left" : ""} ${nodeTreeHasRightBranch ? "ode-mind-root-has-right" : ""}`.trim()
                    )}
                    <div
                      className={`ode-mind-side ode-mind-side-right ${nodeTreeHasRightBranch ? "ode-mind-side-has-branches" : ""}`.trim()}
                      style={nodeTreeRootThemeStyle}
                    >
                      {nodeTreeMindMapPartitions.right.map((node) => renderNodeTreeMindNode(node, "right"))}
                    </div>
                  </div>
                ) : (
                  <div className="ode-mind-vertical">
                    {renderMindMapRoot(
                      nodeTreeMindMapRootLabel,
                      nodeTreeMindMapRootNode,
                      nodeTreeRootThemeStyle,
                      `ode-mind-root-vertical ${nodeTreeHasAnyBranch ? "ode-mind-root-has-children" : ""}`.trim()
                    )}
                    <div
                      ref={verticalBranchesRef}
                      className={`ode-mind-vertical-grid ode-mind-vertical-branches ${nodeTreeVerticalConnectorLineVisible ? "ode-mind-vertical-branches-has-items" : ""}`.trim()}
                      style={applyVerticalConnectorBounds(nodeTreeRootThemeStyle)}
                    >
                      {nodeTreeMindMapBranchNodes.map((node) => renderNodeTreeMindNode(node, "vertical"))}
                    </div>
                  </div>
                )}
                {renderNodeTreeMindFileStrip()}
                {showEmptyState && gridNodes.length === 0 ? (
                  <div className="mt-8 rounded-2xl border border-dashed border-[var(--ode-border-strong)] bg-[rgba(4,23,39,0.5)] px-6 py-8 text-center text-[var(--ode-text-muted)]">
                    {renderEmptyStateAction()}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="ode-details-wrap">
          <div className="ode-details-header">
            <span>{t("details.name")}</span>
            <span>{t("details.type")}</span>
            <span className="text-right">{t("details.size")}</span>
            <span>{t("details.modified")}</span>
          </div>
          <div
            ref={detailsScrollRef}
            className="ode-details-body"
            onScroll={(event) => {
              if (!shouldVirtualizeDetails) return;
              const next = event.currentTarget.scrollTop;
              setDetailsScrollTop((prev) => (prev === next ? prev : next));
            }}
          >
            {shouldVirtualizeDetails && virtualDetailsWindow.topSpacer > 0 ? (
              <div style={{ height: `${virtualDetailsWindow.topSpacer}px` }} />
            ) : null}
            {virtualDetailsWindow.rows.map((node) => (
              (() => {
                const selected = selectedNodeIds.has(node.id);
                const focused = selectedNodeId === node.id;
                const nodeIsFileLike = isFileLikeNode(node);
                return (
              <div
                key={`details-${node.id}`}
                data-ode-node-id={node.id}
                className={`ode-details-row ${selected ? "ode-details-row-selected" : ""} ${focused ? "ode-details-row-focused" : ""} ${cutPendingNodeIds.has(node.id) ? "ode-cut-pending" : ""
                  } ${draggingNodeId === node.id ? "ode-details-row-dragging" : ""
                  } ${detailsFirstFileNodeId === node.id && gridBranchNodes.length > 0 ? "ode-details-file-section-start" : ""
                  } ${dropIndicator?.targetId === node.id
                    ? dropIndicator.position === "before"
                      ? "ode-details-drop-before"
                      : dropIndicator.position === "after"
                        ? "ode-details-drop-after"
                        : "ode-details-drop-inside"
                    : ""
                  }`}
                draggable={editingNodeId !== node.id}
                onClick={(event) => {
                  onCloseContextMenu();
                  onApplyGridSelection(node.id, {
                    range: event.shiftKey,
                    toggle: event.ctrlKey || event.metaKey
                  });
                }}
                onContextMenu={(event) => onOpenNodeContextMenu(event, node.id)}
                onDragStart={(event) => onBeginNodeDrag(event, node.id)}
                onDragOver={(event) => {
                  if (onHasExternalFileDrag(event)) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "copy";
                    onSetDropIndicator({ targetId: node.id, position: "inside" });
                    return;
                  }
                  const sourceId = onResolveActiveDragSourceId(event);
                  if (!sourceId) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  onSetDropIndicator({ targetId: node.id, position: onDetectDetailsDropPosition(event, node) });
                }}
                onDrop={(event) => {
                  const externalPaths = onResolveExternalDropPaths(event);
                  if (externalPaths.length > 0) {
                    event.preventDefault();
                    onClearDraggingState();
                    onImportExternalFilesToNode(externalPaths, node.id, "grid");
                    return;
                  }
                  event.preventDefault();
                  const sourceId = onResolveActiveDragSourceId(event);
                  if (!sourceId) return;
                  const position =
                    dropIndicator?.targetId === node.id
                      ? dropIndicator.position
                      : onDetectDetailsDropPosition(event, node);
                  onClearDraggingState();
                  onApplyGridDropMove(sourceId, node.id, position);
                }}
                onDragEnd={onClearDraggingState}
                onDoubleClick={() => {
                  if (node.type === "folder") {
                    onOpenFolder(node.id);
                  } else if (nodeIsFileLike) {
                    onReviewMindMapFile(node.id);
                  }
                }}
              >
                <span className="ode-details-col-name">
                  <NodeGlyph
                    node={node}
                    active={selected || focused}
                    folderState={!nodeIsFileLike ? folderNodeStateById.get(node.id) : undefined}
                    showExecutionOwnerGlyph={executionOwnerNodeIds.has(node.id)}
                  />
                  <div className="min-w-0 flex-1">
                    {renderEditableNodeLabel(
                      node,
                      "ode-details-name-text",
                      "ode-input h-7 min-w-0 flex-1 rounded px-2 text-[1rem]"
                    )}
                    {renderChantierMeta(node, { compact: true })}
                  </div>
                </span>
                <span className="ode-details-col-type">{onGetNodeTypeDisplayLabel(node)}</span>
                <span className="ode-details-col-size">{onFormatBytes(onGetNodeSizeBytes(node))}</span>
                <span className="ode-details-col-modified">{onFormatNodeModified(node.updatedAt, language)}</span>
              </div>
                );
              })()
            ))}
            {shouldVirtualizeDetails && virtualDetailsWindow.bottomSpacer > 0 ? (
              <div style={{ height: `${virtualDetailsWindow.bottomSpacer}px` }} />
            ) : null}
            {showEmptyState && gridNodes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--ode-border-strong)] bg-[rgba(4,23,39,0.5)] px-6 py-8 text-center text-[var(--ode-text-muted)]">
                {renderEmptyStateAction()}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
