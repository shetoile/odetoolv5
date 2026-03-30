import type { AppNode, ProjectSummary } from "@/lib/types";
import {
  buildWorkspaceActionPlan,
  type ActionPlanProposal,
  type ActionPlanProposalKind,
  type WorkspaceActionPlan
} from "./actionPlanning";

export type ApprovalQueueRiskLevel = "low" | "medium" | "high";
export type ApprovalQueueReadiness = "ready_for_handoff" | "review_only" | "needs_more_context";
export type ApprovalQueueDecision = "approve_for_handoff" | "hold";

export type ApprovalChecklistItem = {
  id: string;
  label: string;
  satisfied: boolean;
};

export type ApprovalQueueItem = {
  id: string;
  title: string;
  kind: ActionPlanProposalKind;
  confidence: number;
  riskLevel: ApprovalQueueRiskLevel;
  readiness: ApprovalQueueReadiness;
  recommendedDecision: ApprovalQueueDecision;
  rationale: string;
  sourceTitles: string[];
  blockers: string[];
  checklist: ApprovalChecklistItem[];
  handoffNote: string;
  steps: string[];
};

export type WorkspaceApprovalQueue = {
  scopeName: string;
  focus: string;
  focusSource: WorkspaceActionPlan["focusSource"];
  itemCount: number;
  readyForHandoffCount: number;
  holdCount: number;
  items: ApprovalQueueItem[];
  generatedAt: string | null;
};

function buildChecklist(args: {
  language: string;
  proposal: ActionPlanProposal;
  hasEvidence: boolean;
}): ApprovalChecklistItem[] {
  const base = [
    {
      id: "steps_present",
      satisfied: args.proposal.steps.length > 0
    },
    {
      id: "evidence_present",
      satisfied: args.hasEvidence || args.proposal.kind === "repair_ingestion" || args.proposal.kind === "broaden_search"
    },
    {
      id: "manual_review",
      satisfied: args.proposal.requiresReview
    }
  ];

  if (args.language === "FR") {
    return [
      {
        ...base[0],
        label: "Etapes de revue explicites"
      },
      {
        ...base[1],
        label: "Contexte ou preuve source disponible"
      },
      {
        ...base[2],
        label: "Validation humaine requise avant toute execution"
      }
    ];
  }

  if (args.language === "DE") {
    return [
      {
        ...base[0],
        label: "Explizite Review-Schritte vorhanden"
      },
      {
        ...base[1],
        label: "Kontext oder Quellbeleg verfuegbar"
      },
      {
        ...base[2],
        label: "Menschliche Freigabe vor jeder Ausfuehrung erforderlich"
      }
    ];
  }

  if (args.language === "ES") {
    return [
      {
        ...base[0],
        label: "Pasos de revision explicitos"
      },
      {
        ...base[1],
        label: "Contexto o evidencia fuente disponible"
      },
      {
        ...base[2],
        label: "Validacion humana requerida antes de cualquier ejecucion"
      }
    ];
  }

  return [
    {
      ...base[0],
      label: "Explicit review steps are present"
    },
    {
      ...base[1],
      label: "Source context or evidence is available"
    },
    {
      ...base[2],
      label: "Human approval is required before any execution"
    }
  ];
}

function getRiskLevel(kind: ActionPlanProposalKind): ApprovalQueueRiskLevel {
  if (kind === "repair_ingestion") return "high";
  if (kind === "prepare_brief" || kind === "review_documents") return "medium";
  return "low";
}

function getReadiness(args: {
  proposal: ActionPlanProposal;
  hasEvidence: boolean;
}): ApprovalQueueReadiness {
  if (args.proposal.kind === "broaden_search") return "needs_more_context";
  if (args.proposal.kind === "repair_ingestion") return "review_only";
  if (!args.hasEvidence) return "needs_more_context";
  if (args.proposal.confidence < 0.65) return "review_only";
  return "ready_for_handoff";
}

function buildBlockers(args: {
  language: string;
  proposal: ActionPlanProposal;
  hasEvidence: boolean;
  readiness: ApprovalQueueReadiness;
}): string[] {
  const blockers: string[] = [];

  if (!args.hasEvidence && args.proposal.kind !== "repair_ingestion" && args.proposal.kind !== "broaden_search") {
    if (args.language === "FR") {
      blockers.push("Aucune preuve source n'est encore reliee a cette proposition.");
    } else if (args.language === "DE") {
      blockers.push("Zu diesem Vorschlag ist noch kein Quellbeleg verknuepft.");
    } else if (args.language === "ES") {
      blockers.push("Todavia no hay evidencia fuente vinculada a esta propuesta.");
    } else {
      blockers.push("No source evidence is attached to this proposal yet.");
    }
  }

  if (args.readiness === "review_only") {
    if (args.proposal.kind === "repair_ingestion") {
      if (args.language === "FR") {
        blockers.push("Cette proposition touche a la qualite d'ingestion et doit rester en revue manuelle.");
      } else if (args.language === "DE") {
        blockers.push("Dieser Vorschlag betrifft die Ingestion-Qualitaet und bleibt in manueller Pruefung.");
      } else if (args.language === "ES") {
        blockers.push("Esta propuesta afecta la calidad de ingesta y debe mantenerse en revision manual.");
      } else {
        blockers.push("This proposal affects ingestion quality and must stay in manual review.");
      }
    } else if (args.proposal.confidence < 0.65) {
      if (args.language === "FR") {
        blockers.push("La confiance reste moderee; garder cette proposition en revue.");
      } else if (args.language === "DE") {
        blockers.push("Die Sicherheit ist noch moderat; Vorschlag in der Pruefung halten.");
      } else if (args.language === "ES") {
        blockers.push("La confianza sigue siendo moderada; mantenga la propuesta en revision.");
      } else {
        blockers.push("Confidence is still moderate; keep this proposal in review.");
      }
    }
  }

  if (args.readiness === "needs_more_context") {
    if (args.proposal.kind === "broaden_search") {
      if (args.language === "FR") {
        blockers.push("Elargir ou clarifier la recherche avant toute approbation.");
      } else if (args.language === "DE") {
        blockers.push("Suche vor jeder Freigabe erweitern oder praezisieren.");
      } else if (args.language === "ES") {
        blockers.push("Amplie o aclare la busqueda antes de cualquier aprobacion.");
      } else {
        blockers.push("Broaden or clarify the search before any approval.");
      }
    } else if (args.language === "FR") {
      blockers.push("Le contexte est encore incomplet pour preparer un transfert d'execution.");
    } else if (args.language === "DE") {
      blockers.push("Der Kontext ist noch unvollstaendig fuer einen Ausfuehrungs-Handoff.");
    } else if (args.language === "ES") {
      blockers.push("El contexto aun es incompleto para preparar un traspaso de ejecucion.");
    } else {
      blockers.push("The context is still incomplete for an execution handoff.");
    }
  }

  return blockers;
}

function buildHandoffNote(args: {
  language: string;
  proposal: ActionPlanProposal;
  readiness: ApprovalQueueReadiness;
}): string {
  if (args.readiness === "ready_for_handoff") {
    if (args.language === "FR") {
      return "Pret pour un transfert vers une future couche d'execution controlee, avec validation humaine explicite.";
    }
    if (args.language === "DE") {
      return "Bereit fuer die Uebergabe an eine spaetere kontrollierte Ausfuehrungsschicht mit expliziter menschlicher Freigabe.";
    }
    if (args.language === "ES") {
      return "Listo para pasar a una futura capa de ejecucion controlada con aprobacion humana explicita.";
    }
    return "Ready to hand off into a future controlled-execution layer with explicit human approval.";
  }

  if (args.readiness === "review_only") {
    if (args.language === "FR") {
      return "Rester en revue. Cette proposition est utile pour orienter la suite, mais ne doit pas encore alimenter une execution.";
    }
    if (args.language === "DE") {
      return "In der Pruefung behalten. Der Vorschlag ist nuetzlich fuer die Orientierung, soll aber noch keine Ausfuehrung speisen.";
    }
    if (args.language === "ES") {
      return "Mantener en revision. La propuesta sirve para orientar el trabajo, pero aun no debe alimentar una ejecucion.";
    }
    return "Keep in review. This proposal is useful for direction, but should not feed execution yet.";
  }

  if (args.language === "FR") {
    return "Completer d'abord le contexte ou la recherche avant de preparer une future execution controlee.";
  }
  if (args.language === "DE") {
    return "Zuerst Kontext oder Suche vervollstaendigen, bevor eine spaetere kontrollierte Ausfuehrung vorbereitet wird.";
  }
  if (args.language === "ES") {
    return "Complete primero el contexto o la busqueda antes de preparar una futura ejecucion controlada.";
  }
  return "Complete the missing context or search first before preparing any future controlled execution.";
}

function toApprovalQueueItem(language: string, proposal: ActionPlanProposal): ApprovalQueueItem {
  const hasEvidence = proposal.sourceTitles.length > 0;
  const readiness = getReadiness({ proposal, hasEvidence });
  const blockers = buildBlockers({
    language,
    proposal,
    hasEvidence,
    readiness
  });

  return {
    id: proposal.id,
    title: proposal.title,
    kind: proposal.kind,
    confidence: proposal.confidence,
    riskLevel: getRiskLevel(proposal.kind),
    readiness,
    recommendedDecision: readiness === "ready_for_handoff" ? "approve_for_handoff" : "hold",
    rationale: proposal.rationale,
    sourceTitles: proposal.sourceTitles,
    blockers,
    checklist: buildChecklist({
      language,
      proposal,
      hasEvidence
    }),
    handoffNote: buildHandoffNote({
      language,
      proposal,
      readiness
    }),
    steps: proposal.steps
  };
}

export async function buildWorkspaceApprovalQueue(args: {
  project: ProjectSummary | null;
  allNodes: AppNode[];
  selectedNodeIds: string[];
  language: string;
  focus: string;
  maxRecords?: number;
}): Promise<WorkspaceApprovalQueue> {
  const actionPlan = await buildWorkspaceActionPlan({
    project: args.project,
    allNodes: args.allNodes,
    selectedNodeIds: args.selectedNodeIds,
    language: args.language,
    focus: args.focus,
    maxRecords: args.maxRecords
  });

  const items = actionPlan.proposals.map((proposal) => toApprovalQueueItem(args.language, proposal));

  return {
    scopeName: actionPlan.scopeName,
    focus: actionPlan.focus,
    focusSource: actionPlan.focusSource,
    itemCount: items.length,
    readyForHandoffCount: items.filter((item) => item.readiness === "ready_for_handoff").length,
    holdCount: items.filter((item) => item.recommendedDecision === "hold").length,
    items,
    generatedAt: actionPlan.generatedAt
  };
}
