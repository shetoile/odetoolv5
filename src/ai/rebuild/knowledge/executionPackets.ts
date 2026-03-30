import type { AppNode, ProjectSummary } from "@/lib/types";
import {
  buildWorkspaceApprovalQueue,
  type ApprovalQueueItem,
  type ApprovalQueueRiskLevel,
  type WorkspaceApprovalQueue
} from "./approvalQueue";

export type ExecutionPacketClass =
  | "review_session"
  | "summary_draft"
  | "brief_draft"
  | "repair_preflight"
  | "retrieval_preflight";

export type ExecutionPacketFutureEffect = "no_direct_write" | "draft_only" | "future_pipeline_change";

export type ExecutionPacket = {
  id: string;
  sourceApprovalId: string;
  sourceKind: ApprovalQueueItem["kind"];
  title: string;
  executionClass: ExecutionPacketClass;
  executionClassLabel: string;
  futureEffect: ExecutionPacketFutureEffect;
  futureEffectLabel: string;
  riskLevel: ApprovalQueueRiskLevel;
  confidence: number;
  targetSurface: string;
  requiresExplicitApproval: boolean;
  evidenceTitles: string[];
  guardrails: string[];
  plannedOutputs: string[];
  steps: string[];
};

export type DeferredExecutionItem = {
  id: string;
  title: string;
  reason: string;
};

export type WorkspaceExecutionPacketPreview = {
  scopeName: string;
  focus: string;
  focusSource: WorkspaceApprovalQueue["focusSource"];
  packetCount: number;
  draftPacketCount: number;
  deferredCount: number;
  requiresExplicitApprovalCount: number;
  packets: ExecutionPacket[];
  deferredItems: DeferredExecutionItem[];
  generatedAt: string | null;
};

function getClassLabel(language: string, executionClass: ExecutionPacketClass): string {
  if (language === "FR") {
    if (executionClass === "review_session") return "session de revue";
    if (executionClass === "summary_draft") return "brouillon de synthese";
    if (executionClass === "brief_draft") return "brouillon de note";
    if (executionClass === "repair_preflight") return "preparation reparation";
    return "preparation recherche";
  }
  if (language === "DE") {
    if (executionClass === "review_session") return "Review-Sitzung";
    if (executionClass === "summary_draft") return "Summary-Entwurf";
    if (executionClass === "brief_draft") return "Briefing-Entwurf";
    if (executionClass === "repair_preflight") return "Reparatur-Vorbereitung";
    return "Retrieval-Vorbereitung";
  }
  if (language === "ES") {
    if (executionClass === "review_session") return "sesion de revision";
    if (executionClass === "summary_draft") return "borrador de sintesis";
    if (executionClass === "brief_draft") return "borrador de nota";
    if (executionClass === "repair_preflight") return "preparacion de reparacion";
    return "preparacion de busqueda";
  }
  if (executionClass === "review_session") return "review session";
  if (executionClass === "summary_draft") return "summary draft";
  if (executionClass === "brief_draft") return "brief draft";
  if (executionClass === "repair_preflight") return "repair preflight";
  return "retrieval preflight";
}

function getFutureEffectLabel(language: string, futureEffect: ExecutionPacketFutureEffect): string {
  if (language === "FR") {
    if (futureEffect === "no_direct_write") return "aucune ecriture directe";
    if (futureEffect === "draft_only") return "brouillon uniquement";
    return "changement pipeline futur";
  }
  if (language === "DE") {
    if (futureEffect === "no_direct_write") return "kein Direktschreiben";
    if (futureEffect === "draft_only") return "nur Entwurf";
    return "spaetere Pipeline-Aenderung";
  }
  if (language === "ES") {
    if (futureEffect === "no_direct_write") return "sin escritura directa";
    if (futureEffect === "draft_only") return "solo borrador";
    return "cambio futuro de pipeline";
  }
  if (futureEffect === "no_direct_write") return "no direct write";
  if (futureEffect === "draft_only") return "draft only";
  return "future pipeline change";
}

function buildDeferredReason(language: string, item: ApprovalQueueItem): string {
  if (item.blockers.length > 0) return item.blockers[0];
  if (language === "FR") {
    return "Cet element reste hors paquet d'execution tant que la revue n'est pas complete.";
  }
  if (language === "DE") {
    return "Dieses Element bleibt ausserhalb des Ausfuehrungspakets, bis die Pruefung abgeschlossen ist.";
  }
  if (language === "ES") {
    return "Este elemento queda fuera del paquete de ejecucion hasta completar la revision.";
  }
  return "This item stays outside the execution packet until review is complete.";
}

function buildPacketFromApprovalItem(language: string, item: ApprovalQueueItem): ExecutionPacket {
  if (item.kind === "review_documents") {
    return {
      id: `packet-${item.id}`,
      sourceApprovalId: item.id,
      sourceKind: item.kind,
      title: item.title,
      executionClass: "review_session",
      executionClassLabel: getClassLabel(language, "review_session"),
      futureEffect: "no_direct_write",
      futureEffectLabel: getFutureEffectLabel(language, "no_direct_write"),
      riskLevel: item.riskLevel,
      confidence: item.confidence,
      targetSurface:
        language === "FR"
          ? "lot documentaire cible"
          : language === "DE"
            ? "gezieltes Dokument-Set"
            : language === "ES"
              ? "conjunto documental objetivo"
              : "target document set",
      requiresExplicitApproval: true,
      evidenceTitles: item.sourceTitles,
      guardrails:
        language === "FR"
          ? [
              "Conserver la revue en lecture seule dans cette etape.",
              "Garder les preuves source attachees au paquet.",
              "Ne rien creer dans l'espace sans validation humaine explicite."
            ]
          : language === "DE"
            ? [
                "Diese Stufe als reine Lese-Review halten.",
                "Quellbelege am Paket belassen.",
                "Ohne explizite menschliche Freigabe nichts im Workspace erzeugen."
              ]
            : language === "ES"
              ? [
                  "Mantener esta etapa como revision solo de lectura.",
                  "Conservar la evidencia fuente unida al paquete.",
                  "No crear nada en el espacio sin aprobacion humana explicita."
                ]
              : [
                  "Keep this stage read-only.",
                  "Keep the source evidence attached to the packet.",
                  "Create nothing in the workspace without explicit human approval."
                ],
      plannedOutputs:
        language === "FR"
          ? ["liste de documents verifies", "notes de contexte confirmees"]
          : language === "DE"
            ? ["verifizierte Dokumentliste", "bestaetigte Kontextnotizen"]
            : language === "ES"
              ? ["lista de documentos verificados", "notas de contexto confirmadas"]
              : ["verified document list", "confirmed context notes"],
      steps: item.steps
    };
  }

  if (item.kind === "summarize_theme") {
    return {
      id: `packet-${item.id}`,
      sourceApprovalId: item.id,
      sourceKind: item.kind,
      title: item.title,
      executionClass: "summary_draft",
      executionClassLabel: getClassLabel(language, "summary_draft"),
      futureEffect: "draft_only",
      futureEffectLabel: getFutureEffectLabel(language, "draft_only"),
      riskLevel: item.riskLevel,
      confidence: item.confidence,
      targetSurface:
        language === "FR"
          ? "synthese de connaissance"
          : language === "DE"
            ? "Wissenszusammenfassung"
            : language === "ES"
              ? "sintesis de conocimiento"
              : "knowledge summary",
      requiresExplicitApproval: true,
      evidenceTitles: item.sourceTitles,
      guardrails:
        language === "FR"
          ? [
              "Produire seulement un brouillon de synthese.",
              "Marquer clairement les hypothesees et les points a verifier.",
              "Ne pas ecrire dans l'arborescence de travail."
            ]
          : language === "DE"
            ? [
                "Nur einen Summary-Entwurf erzeugen.",
                "Annahmen und offene Punkte klar markieren.",
                "Nicht in die Arbeitsstruktur schreiben."
              ]
            : language === "ES"
              ? [
                  "Generar solo un borrador de sintesis.",
                  "Marcar con claridad hipotesis y puntos por verificar.",
                  "No escribir en la estructura de trabajo."
                ]
              : [
                  "Produce a draft summary only.",
                  "Clearly mark assumptions and open questions.",
                  "Do not write into the workspace tree."
                ],
      plannedOutputs:
        language === "FR"
          ? ["plan de synthese", "points stables", "questions ouvertes"]
          : language === "DE"
            ? ["Summary-Gliederung", "stabile Punkte", "offene Fragen"]
            : language === "ES"
              ? ["esquema de sintesis", "puntos estables", "preguntas abiertas"]
              : ["summary outline", "stable points", "open questions"],
      steps: item.steps
    };
  }

  if (item.kind === "prepare_brief") {
    return {
      id: `packet-${item.id}`,
      sourceApprovalId: item.id,
      sourceKind: item.kind,
      title: item.title,
      executionClass: "brief_draft",
      executionClassLabel: getClassLabel(language, "brief_draft"),
      futureEffect: "draft_only",
      futureEffectLabel: getFutureEffectLabel(language, "draft_only"),
      riskLevel: item.riskLevel,
      confidence: item.confidence,
      targetSurface:
        language === "FR"
          ? "note de cadrage"
          : language === "DE"
            ? "Arbeitsnotiz"
            : language === "ES"
              ? "nota de trabajo"
              : "working brief",
      requiresExplicitApproval: true,
      evidenceTitles: item.sourceTitles,
      guardrails:
        language === "FR"
          ? [
              "La sortie reste un brouillon relisible.",
              "Signaler les zones d'incertitude avant tout passage en execution.",
              "Aucune creation de noeud ou document n'est autorisee ici."
            ]
          : language === "DE"
            ? [
                "Das Ergebnis bleibt ein pruefbarer Entwurf.",
                "Unsicherheiten vor jedem Ausfuehrungs-Handoff markieren.",
                "Keine Knoten- oder Dokumenterstellung in dieser Stufe."
              ]
            : language === "ES"
              ? [
                  "La salida sigue siendo un borrador revisable.",
                  "Marcar las zonas inciertas antes de cualquier traspaso a ejecucion.",
                  "No se permite crear nodos ni documentos en esta etapa."
                ]
              : [
                  "The output stays a reviewable draft.",
                  "Call out uncertain areas before any execution handoff.",
                  "No node or document creation is allowed here."
                ],
      plannedOutputs:
        language === "FR"
          ? ["note de cadrage", "liste des risques", "questions a arbitrer"]
          : language === "DE"
            ? ["Arbeitsnotiz", "Risikoliste", "offene Entscheidungen"]
            : language === "ES"
              ? ["nota de trabajo", "lista de riesgos", "decisiones pendientes"]
              : ["working brief", "risk list", "open decisions"],
      steps: item.steps
    };
  }

  if (item.kind === "repair_ingestion") {
    return {
      id: `packet-${item.id}`,
      sourceApprovalId: item.id,
      sourceKind: item.kind,
      title: item.title,
      executionClass: "repair_preflight",
      executionClassLabel: getClassLabel(language, "repair_preflight"),
      futureEffect: "future_pipeline_change",
      futureEffectLabel: getFutureEffectLabel(language, "future_pipeline_change"),
      riskLevel: item.riskLevel,
      confidence: item.confidence,
      targetSurface:
        language === "FR"
          ? "pipeline d'ingestion"
          : language === "DE"
            ? "Ingestion-Pipeline"
            : language === "ES"
              ? "pipeline de ingesta"
              : "ingestion pipeline",
      requiresExplicitApproval: true,
      evidenceTitles: item.sourceTitles,
      guardrails:
        language === "FR"
          ? [
              "Aucune relance automatique dans cette etape.",
              "Valider manuellement les fichiers cibles avant toute reparation.",
              "Journaliser les changements futurs de pipeline."
            ]
          : language === "DE"
            ? [
                "In dieser Stufe keine automatische Wiederholung.",
                "Zieldateien vor jeder Reparatur manuell bestaetigen.",
                "Spaetere Pipeline-Aenderungen protokollieren."
              ]
            : language === "ES"
              ? [
                  "No relanzar automaticamente en esta etapa.",
                  "Confirmar manualmente los archivos destino antes de cualquier reparacion.",
                  "Registrar los futuros cambios de pipeline."
                ]
              : [
                  "No automatic rerun at this stage.",
                  "Manually confirm target files before any repair.",
                  "Log any future pipeline change."
                ],
      plannedOutputs:
        language === "FR"
          ? ["liste des fichiers a reparer", "plan de relance controlee"]
          : language === "DE"
            ? ["Liste der zu reparierenden Dateien", "kontrollierter Neustartplan"]
            : language === "ES"
              ? ["lista de archivos a reparar", "plan de relanzamiento controlado"]
              : ["files-to-repair list", "controlled rerun plan"],
      steps: item.steps
    };
  }

  return {
    id: `packet-${item.id}`,
    sourceApprovalId: item.id,
    sourceKind: item.kind,
    title: item.title,
    executionClass: "retrieval_preflight",
    executionClassLabel: getClassLabel(language, "retrieval_preflight"),
    futureEffect: "no_direct_write",
    futureEffectLabel: getFutureEffectLabel(language, "no_direct_write"),
    riskLevel: item.riskLevel,
    confidence: item.confidence,
    targetSurface:
      language === "FR"
        ? "requete de connaissance"
        : language === "DE"
          ? "Wissensabfrage"
          : language === "ES"
            ? "consulta de conocimiento"
            : "knowledge query",
    requiresExplicitApproval: true,
    evidenceTitles: item.sourceTitles,
    guardrails:
      language === "FR"
        ? [
            "Rester sur un enrichissement de contexte.",
            "Aucune action de creation ou de deplacement.",
            "Relancer la recherche avant toute nouvelle compilation."
          ]
        : language === "DE"
          ? [
              "Auf Kontextanreicherung begrenzt bleiben.",
              "Keine Erstellungs- oder Verschiebeaktion.",
              "Suche vor jeder neuen Kompilierung erneut starten."
            ]
          : language === "ES"
            ? [
                "Limitarse a enriquecer el contexto.",
                "Sin acciones de creacion ni movimiento.",
                "Reejecutar la busqueda antes de una nueva compilacion."
              ]
            : [
                "Stay limited to context enrichment.",
                "No create or move action.",
                "Rerun retrieval before any new compilation."
              ],
    plannedOutputs:
      language === "FR"
        ? ["requete refinee", "nouveaux termes de recherche"]
        : language === "DE"
          ? ["verfeinerte Anfrage", "neue Suchbegriffe"]
          : language === "ES"
            ? ["consulta refinada", "nuevos terminos de busqueda"]
            : ["refined query", "new search terms"],
    steps: item.steps
  };
}

export async function buildWorkspaceExecutionPacketPreview(args: {
  project: ProjectSummary | null;
  allNodes: AppNode[];
  selectedNodeIds: string[];
  language: string;
  focus: string;
  maxRecords?: number;
}): Promise<WorkspaceExecutionPacketPreview> {
  const queue = await buildWorkspaceApprovalQueue({
    project: args.project,
    allNodes: args.allNodes,
    selectedNodeIds: args.selectedNodeIds,
    language: args.language,
    focus: args.focus,
    maxRecords: args.maxRecords
  });

  const packets: ExecutionPacket[] = [];
  const deferredItems: DeferredExecutionItem[] = [];

  queue.items.forEach((item) => {
    if (item.readiness === "ready_for_handoff" && item.recommendedDecision === "approve_for_handoff") {
      packets.push(buildPacketFromApprovalItem(args.language, item));
      return;
    }

    deferredItems.push({
      id: item.id,
      title: item.title,
      reason: buildDeferredReason(args.language, item)
    });
  });

  return {
    scopeName: queue.scopeName,
    focus: queue.focus,
    focusSource: queue.focusSource,
    packetCount: packets.length,
    draftPacketCount: packets.filter((packet) => packet.futureEffect === "draft_only").length,
    deferredCount: deferredItems.length,
    requiresExplicitApprovalCount: packets.filter((packet) => packet.requiresExplicitApproval).length,
    packets,
    deferredItems,
    generatedAt: queue.generatedAt
  };
}
