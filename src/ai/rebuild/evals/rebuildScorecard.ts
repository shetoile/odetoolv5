import { listRebuildWorkflowPolicies } from "../core/rebuildPolicy";

export type RebuildLayerStatus = "ready" | "partial" | "future";

export type RebuildLayerScore = {
  id: string;
  name: string;
  status: RebuildLayerStatus;
  score: number;
  summary: string;
};

export type RebuildScorecard = {
  overallScore: number;
  readyCount: number;
  partialCount: number;
  futureCount: number;
  layers: RebuildLayerScore[];
  qualitySignals: string[];
};

function buildQualitySignals(language: string): string[] {
  if (language === "FR") {
    return [
      "Tous les workflows publies restent sans ecriture directe dans l'espace.",
      "La couche de politique empeche deja toute execution destructive.",
      "Le modele reste desactive tant que la gouvernance et l'evaluation ne sont pas pretes.",
      "L'architecture couvre maintenant ingestion, normalisation, recherche, planification, approbation et paquetage."
    ];
  }
  if (language === "DE") {
    return [
      "Alle veroeffentlichten Workflows bleiben ohne direkte Workspace-Schreibvorgaenge.",
      "Die Policy-Schicht blockiert bereits jede destruktive Ausfuehrung.",
      "Das Modell bleibt deaktiviert, bis Governance und Evaluation weiter ausgebaut sind.",
      "Die Architektur deckt jetzt Ingestion, Normalisierung, Retrieval, Planung, Freigabe und Paketbildung ab."
    ];
  }
  if (language === "ES") {
    return [
      "Todos los flujos publicados siguen sin escritura directa en el espacio.",
      "La capa de politica ya bloquea cualquier ejecucion destructiva.",
      "El modelo sigue desactivado hasta que gobernanza y evaluacion esten mas maduras.",
      "La arquitectura ya cubre ingesta, normalizacion, recuperacion, planificacion, aprobacion y paquetizacion."
    ];
  }
  return [
    "All published workflows remain free of direct workspace writes.",
    "The policy layer already blocks destructive execution.",
    "The model stays disabled until governance and evaluation are mature enough.",
    "The architecture now covers ingestion, normalization, retrieval, planning, approval, and packetization."
  ];
}

export function buildRebuildScorecard(language: string): RebuildScorecard {
  const policies = listRebuildWorkflowPolicies();
  const workflowCount = policies.filter((policy) => policy.enabled).length;

  const layers: RebuildLayerScore[] = [
    {
      id: "ingestion",
      name: language === "FR" ? "Ingestion" : language === "DE" ? "Ingestion" : language === "ES" ? "Ingesta" : "Ingestion",
      status: "ready",
      score: 1,
      summary:
        language === "FR"
          ? "Extraction et previsualisation documentaires actives."
          : language === "DE"
            ? "Dokument-Extraktion und Vorschau aktiv."
            : language === "ES"
              ? "Extraccion y vista previa documental activas."
              : "Document extraction and preview are active."
    },
    {
      id: "knowledge",
      name:
        language === "FR"
          ? "Connaissance"
          : language === "DE"
            ? "Wissensschicht"
            : language === "ES"
              ? "Conocimiento"
              : "Knowledge",
      status: "ready",
      score: 1,
      summary:
        language === "FR"
          ? "Magasin documentaire et resume espace disponibles."
          : language === "DE"
            ? "Dokumentspeicher und Workspace-Summary verfuegbar."
            : language === "ES"
              ? "Almacen documental y resumen de espacio disponibles."
              : "Document store and workspace summary are available."
    },
    {
      id: "retrieval",
      name: language === "FR" ? "Recherche" : language === "DE" ? "Retrieval" : language === "ES" ? "Recuperacion" : "Retrieval",
      status: "ready",
      score: 1,
      summary:
        language === "FR"
          ? "Recherche structuree et explicable sur les connaissances."
          : language === "DE"
            ? "Strukturiertes und erklaerbares Retrieval."
            : language === "ES"
              ? "Recuperacion estructurada y explicable."
              : "Structured and explainable retrieval is in place."
    },
    {
      id: "planning",
      name: language === "FR" ? "Planification" : language === "DE" ? "Planung" : language === "ES" ? "Planificacion" : "Planning",
      status: "ready",
      score: 1,
      summary:
        language === "FR"
          ? "Plans d'action deterministes et revus humainement."
          : language === "DE"
            ? "Deterministische Aktionsplaene mit menschlicher Pruefung."
            : language === "ES"
              ? "Planes de accion deterministas con revision humana."
              : "Deterministic action planning with human review is available."
    },
    {
      id: "approval",
      name: language === "FR" ? "Approbation" : language === "DE" ? "Freigabe" : language === "ES" ? "Aprobacion" : "Approval",
      status: "ready",
      score: 1,
      summary:
        language === "FR"
          ? "Files d'approbation, risques et blocages visibles."
          : language === "DE"
            ? "Freigabe-Queue, Risiken und Blocker sind sichtbar."
            : language === "ES"
              ? "Cola de aprobacion, riesgos y bloqueos visibles."
              : "Approval queues, risks, and blockers are visible."
    },
    {
      id: "handoff",
      name: language === "FR" ? "Transmission" : language === "DE" ? "Handoff" : language === "ES" ? "Traspaso" : "Handoff",
      status: "ready",
      score: 1,
      summary:
        language === "FR"
          ? "Paquets d'execution preview uniquement, sans action automatique."
          : language === "DE"
            ? "Ausfuehrungspakete nur als Vorschau, ohne Automatik."
            : language === "ES"
              ? "Paquetes de ejecucion solo en vista previa, sin automatismo."
              : "Execution packets are preview-only, with no automatic execution."
    },
    {
      id: "policy",
      name: language === "FR" ? "Politique" : language === "DE" ? "Policy" : language === "ES" ? "Politica" : "Policy",
      status: "ready",
      score: 1,
      summary:
        language === "FR"
          ? "Politiques par workflow et interdiction des ecritures directes."
          : language === "DE"
            ? "Workflow-Policies und Verbot direkter Schreibvorgaenge."
            : language === "ES"
              ? "Politicas por flujo y bloqueo de escrituras directas."
              : "Per-workflow policies and direct-write blocking are active."
    },
    {
      id: "evaluation",
      name: language === "FR" ? "Evaluation" : language === "DE" ? "Evaluation" : language === "ES" ? "Evaluacion" : "Evaluation",
      status: "partial",
      score: 0.6,
      summary:
        language === "FR"
          ? "Scorecard et signaux qualite disponibles, jeux d'essai reels encore a enrichir."
          : language === "DE"
            ? "Scorecard und Qualitaetssignale vorhanden, reale Golden Cases muessen noch wachsen."
            : language === "ES"
              ? "Scorecard y senales de calidad presentes, faltan mas casos reales."
              : "A scorecard and quality signals exist, but real golden cases still need to grow."
    },
    {
      id: "model_gateway",
      name: language === "FR" ? "Passerelle modele" : language === "DE" ? "Model-Gateway" : language === "ES" ? "Pasarela de modelo" : "Model Gateway",
      status: "future",
      score: 0.2,
      summary:
        language === "FR"
          ? "La couche modele reste coupee volontairement."
          : language === "DE"
            ? "Die Modellebene bleibt bewusst deaktiviert."
            : language === "ES"
              ? "La capa de modelo sigue desactivada a proposito."
              : "The model layer intentionally remains disabled."
    },
    {
      id: "controlled_execution",
      name:
        language === "FR"
          ? "Execution controlee"
          : language === "DE"
            ? "Kontrollierte Ausfuehrung"
            : language === "ES"
              ? "Ejecucion controlada"
              : "Controlled Execution",
      status: "future",
      score: 0.1,
      summary:
        language === "FR"
          ? "Aucun executeur ecrivant dans l'espace n'est encore autorise."
          : language === "DE"
            ? "Noch kein in den Workspace schreibender Executor ist freigegeben."
            : language === "ES"
              ? "Aun no existe un ejecutor autorizado para escribir en el espacio."
              : "No executor that writes into the workspace is enabled yet."
    }
  ];

  const readyCount = layers.filter((layer) => layer.status === "ready").length;
  const partialCount = layers.filter((layer) => layer.status === "partial").length;
  const futureCount = layers.filter((layer) => layer.status === "future").length;
  const overallScore = Math.round((layers.reduce((sum, layer) => sum + layer.score, 0) / layers.length) * 100);

  const qualitySignals = buildQualitySignals(language);
  qualitySignals.push(
    language === "FR"
      ? `${workflowCount} workflows rebuild publies par politique.`
      : language === "DE"
        ? `${workflowCount} rebuild-Workflows sind per Policy veroeffentlicht.`
        : language === "ES"
          ? `${workflowCount} flujos rebuild publicados por politica.`
          : `${workflowCount} rebuild workflows are published by policy.`
  );

  return {
    overallScore,
    readyCount,
    partialCount,
    futureCount,
    layers,
    qualitySignals
  };
}
