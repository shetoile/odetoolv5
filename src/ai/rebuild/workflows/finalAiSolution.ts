import type { AiWorkflowDefinition, AiWorkflowRequest } from "../core/contracts";
import { listRebuildWorkflowPolicies } from "../core/rebuildPolicy";
import { buildRebuildScorecard, type RebuildLayerScore } from "../evals";

export type FinalAiSolutionInput = {
  focus?: string;
};

export type FinalAiSolutionOutput = {
  architectureName: string;
  currentState: string;
  summary: string;
  overallScore: number;
  readyCount: number;
  partialCount: number;
  futureCount: number;
  layers: RebuildLayerScore[];
  workflowStages: {
    stage: string;
    workflows: string[];
    description: string;
  }[];
  governanceRules: string[];
  qualitySignals: string[];
  remainingFutureModules: string[];
  generatedAt: string;
};

type FinalAiSolutionPrepared = FinalAiSolutionOutput;

function buildSummary(language: string, score: number, architectureName: string): string {
  if (language === "FR") {
    return `${architectureName} est maintenant structure autour d'un pipeline clair: ingestion, connaissance, recherche, planification, approbation et paquetage. Score de maturite actuel: ${score}/100.`;
  }
  if (language === "DE") {
    return `${architectureName} ist jetzt um eine klare Pipeline aufgebaut: Ingestion, Wissen, Retrieval, Planung, Freigabe und Paketbildung. Aktueller Reifegrad: ${score}/100.`;
  }
  if (language === "ES") {
    return `${architectureName} ahora se organiza alrededor de un pipeline claro: ingesta, conocimiento, recuperacion, planificacion, aprobacion y paquetizacion. Madurez actual: ${score}/100.`;
  }
  return `${architectureName} is now organized around a clear pipeline: ingestion, knowledge, retrieval, planning, approval, and packetization. Current maturity score: ${score}/100.`;
}

function buildCurrentState(language: string): string {
  if (language === "FR") {
    return "Le rebuild AI est termine cote architecture preview: toutes les couches jusqu'au handoff sont en place, avec execution reelle encore volontairement desactivee.";
  }
  if (language === "DE") {
    return "Der AI-Rebuild ist auf Architektur-Vorschau-Ebene abgeschlossen: alle Schichten bis zum Handoff sind vorhanden, reale Ausfuehrung bleibt bewusst deaktiviert.";
  }
  if (language === "ES") {
    return "La reconstruccion AI esta terminada a nivel de arquitectura preview: todas las capas hasta el handoff estan listas, con ejecucion real aun desactivada a proposito.";
  }
  return "The AI rebuild is complete at the architecture-preview level: all layers up to handoff are in place, while real execution stays intentionally disabled.";
}

function buildGovernanceRules(language: string): string[] {
  if (language === "FR") {
    return [
      "Aucun workflow rebuild publie n'ecrit directement dans l'espace de travail.",
      "Tout passage de plan vers execution reste subordonne a une approbation humaine explicite.",
      "Les preuves documentaires doivent rester visibles dans chaque proposition ou paquet.",
      "La passerelle modele restera coupee tant que les evaluations reelles ne sont pas suffisantes."
    ];
  }
  if (language === "DE") {
    return [
      "Kein veroeffentlichter Rebuild-Workflow schreibt direkt in den Workspace.",
      "Jeder Uebergang von Plan zu Ausfuehrung bleibt an explizite menschliche Freigabe gebunden.",
      "Dokumentbelege muessen in jedem Vorschlag oder Paket sichtbar bleiben.",
      "Das Model-Gateway bleibt deaktiviert, bis reale Evaluationen ausreichen."
    ];
  }
  if (language === "ES") {
    return [
      "Ningun flujo rebuild publicado escribe directamente en el espacio de trabajo.",
      "Todo paso de plan a ejecucion sigue dependiendo de una aprobacion humana explicita.",
      "La evidencia documental debe seguir visible en cada propuesta o paquete.",
      "La pasarela de modelo seguira desactivada hasta tener evaluaciones reales suficientes."
    ];
  }
  return [
    "No published rebuild workflow writes directly into the workspace.",
    "Any move from plan to execution remains gated by explicit human approval.",
    "Documentary evidence must stay visible in every proposal or packet.",
    "The model gateway stays disabled until real evaluations are strong enough."
  ];
}

function buildRemainingFutureModules(language: string): string[] {
  if (language === "FR") {
    return [
      "Passerelle modele cloud/local avec validation schema stricte.",
      "Executeur controle pour brouillons ou actions autorisees uniquement.",
      "Jeux d'evaluation reels par cas client et mesures d'acceptation."
    ];
  }
  if (language === "DE") {
    return [
      "Cloud/Local-Model-Gateway mit strikter Schema-Validierung.",
      "Kontrollierter Executor nur fuer erlaubte Entwuerfe oder Aktionen.",
      "Reale Evaluationsfaelle pro Kundenszenario und Akzeptanzmetriken."
    ];
  }
  if (language === "ES") {
    return [
      "Pasarela de modelo cloud/local con validacion estricta por esquema.",
      "Ejecutor controlado solo para borradores o acciones permitidas.",
      "Casos reales de evaluacion por escenario cliente y metricas de aceptacion."
    ];
  }
  return [
    "A cloud/local model gateway with strict schema validation.",
    "A controlled executor limited to approved drafts or allowed actions.",
    "Real evaluation cases per client scenario and acceptance metrics."
  ];
}

function buildWorkflowStages(language: string) {
  const stageDescriptions: Record<string, string> =
    language === "FR"
      ? {
          observe: "inspection deterministe de l'espace",
          ingest: "lecture et extraction documentaires",
          normalize: "normalisation des connaissances",
          retrieve: "recherche explicable",
          plan: "planification reviewable",
          approve: "gouvernance et blocages",
          handoff: "paquets explicites pour future execution",
          blueprint: "vision finale de l'architecture"
        }
      : language === "DE"
        ? {
            observe: "deterministische Workspace-Inspektion",
            ingest: "Dokumentlesen und Extraktion",
            normalize: "Normalisierung von Wissen",
            retrieve: "erklaerbares Retrieval",
            plan: "pruefbare Planung",
            approve: "Governance und Blocker",
            handoff: "explizite Pakete fuer spaetere Ausfuehrung",
            blueprint: "endgueltige Architektursicht"
          }
        : language === "ES"
          ? {
              observe: "inspeccion determinista del espacio",
              ingest: "lectura y extraccion documental",
              normalize: "normalizacion del conocimiento",
              retrieve: "recuperacion explicable",
              plan: "planificacion revisable",
              approve: "gobernanza y bloqueos",
              handoff: "paquetes explicitos para futura ejecucion",
              blueprint: "vision final de arquitectura"
            }
          : {
              observe: "deterministic workspace inspection",
              ingest: "document reading and extraction",
              normalize: "knowledge normalization",
              retrieve: "explainable retrieval",
              plan: "reviewable planning",
              approve: "governance and blockers",
              handoff: "explicit packets for future execution",
              blueprint: "final architecture view"
            };

  const grouped = new Map<string, string[]>();
  listRebuildWorkflowPolicies().forEach((policy) => {
    if (!policy.enabled) return;
    const entries = grouped.get(policy.stage) ?? [];
    entries.push(policy.workflowId);
    grouped.set(policy.stage, entries);
  });

  return Array.from(grouped.entries()).map(([stage, workflows]) => ({
    stage,
    workflows,
    description: stageDescriptions[stage] ?? stage
  }));
}

async function prepareFinalAiSolution(
  request: AiWorkflowRequest<FinalAiSolutionInput>
): Promise<FinalAiSolutionPrepared> {
  const architectureName =
    request.context.language === "FR"
      ? "ODE AI Rebuild"
      : request.context.language === "DE"
        ? "ODE AI Rebuild"
        : request.context.language === "ES"
          ? "ODE AI Rebuild"
          : "ODE AI Rebuild";
  const scorecard = buildRebuildScorecard(request.context.language);
  const generatedAt = new Date().toISOString();

  return {
    architectureName,
    currentState: buildCurrentState(request.context.language),
    summary: buildSummary(request.context.language, scorecard.overallScore, architectureName),
    overallScore: scorecard.overallScore,
    readyCount: scorecard.readyCount,
    partialCount: scorecard.partialCount,
    futureCount: scorecard.futureCount,
    layers: scorecard.layers,
    workflowStages: buildWorkflowStages(request.context.language),
    governanceRules: buildGovernanceRules(request.context.language),
    qualitySignals: scorecard.qualitySignals,
    remainingFutureModules: buildRemainingFutureModules(request.context.language),
    generatedAt
  };
}

export const finalAiSolutionWorkflow: AiWorkflowDefinition<
  FinalAiSolutionInput,
  FinalAiSolutionPrepared,
  FinalAiSolutionOutput
> = {
  id: "final_ai_solution",
  async prepare(request) {
    return prepareFinalAiSolution(request);
  },
  async execute({ prepared }) {
    return {
      workflowId: "final_ai_solution",
      output: prepared,
      warnings: [],
      requiresApproval: false
    };
  }
};
