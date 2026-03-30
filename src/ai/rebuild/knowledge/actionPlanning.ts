import type { AppNode, ProjectSummary } from "@/lib/types";
import { buildKnowledgeRetrievalPreview, type KnowledgeRetrievalPreview, type KnowledgeDocumentMatch } from "./retrieval";
import { buildWorkspaceKnowledgeSummary } from "./workspaceSummary";

export type ActionPlanProposalKind =
  | "review_documents"
  | "summarize_theme"
  | "repair_ingestion"
  | "prepare_brief"
  | "broaden_search";

export type ActionPlanProposal = {
  id: string;
  kind: ActionPlanProposalKind;
  title: string;
  confidence: number;
  rationale: string;
  sourceTitles: string[];
  steps: string[];
  requiresReview: boolean;
};

export type WorkspaceActionPlan = {
  scopeName: string;
  focus: string;
  focusSource: KnowledgeRetrievalPreview["querySource"];
  query: string;
  proposals: ActionPlanProposal[];
  generatedAt: string | null;
};

function roundConfidence(value: number): number {
  return Math.max(0.05, Math.min(0.99, Math.round(value * 100) / 100));
}

function buildReviewDocumentsProposal(args: {
  language: string;
  focus: string;
  documentMatches: KnowledgeDocumentMatch[];
}): ActionPlanProposal | null {
  if (args.documentMatches.length === 0) return null;
  const topMatches = args.documentMatches.slice(0, 3);
  const averageScore = topMatches.reduce((sum, match) => sum + match.score, 0) / topMatches.length;
  if (args.language === "FR") {
    return {
      id: "review_documents",
      kind: "review_documents",
      title: `Verifier les documents les plus proches de "${args.focus}"`,
      confidence: roundConfidence(0.45 + averageScore / 40),
      rationale: "Les meilleurs matchs documentaires sont deja identifies et classes.",
      sourceTitles: topMatches.map((match) => match.title),
      steps: [
        "Ouvrir les 2 ou 3 premiers documents dans l'ordre du score.",
        "Comparer leurs extraits et lignes de structure pour confirmer le bon contexte.",
        "Conserver seulement les documents utiles avant toute action suivante."
      ],
      requiresReview: true
    };
  }
  if (args.language === "DE") {
    return {
      id: "review_documents",
      kind: "review_documents",
      title: `Die naechsten Dokumente zu "${args.focus}" pruefen`,
      confidence: roundConfidence(0.45 + averageScore / 40),
      rationale: "Die besten Dokumenttreffer sind bereits identifiziert und sortiert.",
      sourceTitles: topMatches.map((match) => match.title),
      steps: [
        "Die ersten 2 bis 3 Dokumente nach Score oeffnen.",
        "Auszuege und Gliederungslinien vergleichen, um den Kontext zu bestaetigen.",
        "Nur relevante Dokumente behalten, bevor weitere Aktionen geplant werden."
      ],
      requiresReview: true
    };
  }
  if (args.language === "ES") {
    return {
      id: "review_documents",
      kind: "review_documents",
      title: `Revisar los documentos mas cercanos a "${args.focus}"`,
      confidence: roundConfidence(0.45 + averageScore / 40),
      rationale: "Los mejores documentos coincidentes ya estan identificados y ordenados.",
      sourceTitles: topMatches.map((match) => match.title),
      steps: [
        "Abrir los 2 o 3 primeros documentos por puntuacion.",
        "Comparar extractos y lineas de estructura para confirmar el contexto.",
        "Conservar solo los documentos utiles antes de planificar la siguiente accion."
      ],
      requiresReview: true
    };
  }
  return {
    id: "review_documents",
    kind: "review_documents",
    title: `Review the best documents for "${args.focus}"`,
    confidence: roundConfidence(0.45 + averageScore / 40),
    rationale: "The strongest document matches are already identified and ranked.",
    sourceTitles: topMatches.map((match) => match.title),
    steps: [
      "Open the top 2-3 documents in score order.",
      "Compare excerpts and outline lines to confirm the right context.",
      "Keep only the relevant documents before planning the next action."
    ],
    requiresReview: true
  };
}

function buildSummarizeThemeProposal(args: {
  language: string;
  focus: string;
  matchedOutlineTopics: string[];
}): ActionPlanProposal | null {
  if (args.matchedOutlineTopics.length === 0) return null;
  const topics = args.matchedOutlineTopics.slice(0, 3);
  if (args.language === "FR") {
    return {
      id: "summarize_theme",
      kind: "summarize_theme",
      title: `Preparer un resume structure sur "${args.focus}"`,
      confidence: 0.74,
      rationale: "Les themes de structure repetes donnent deja un squelette de synthese.",
      sourceTitles: topics,
      steps: [
        "Regrouper les themes repetes dans un meme plan.",
        "Relever les convergences et les ecarts entre documents.",
        "Soumettre le plan a validation avant toute creation dans l'espace."
      ],
      requiresReview: true
    };
  }
  if (args.language === "DE") {
    return {
      id: "summarize_theme",
      kind: "summarize_theme",
      title: `Eine strukturierte Zusammenfassung zu "${args.focus}" vorbereiten`,
      confidence: 0.74,
      rationale: "Wiederholte Gliederungsthemen liefern bereits ein brauchbares Summary-Geruest.",
      sourceTitles: topics,
      steps: [
        "Wiederholte Themen in einem gemeinsamen Plan gruppieren.",
        "Uebereinstimmungen und Abweichungen zwischen Dokumenten markieren.",
        "Den Plan vor jeder Workspace-Aktion bestaetigen lassen."
      ],
      requiresReview: true
    };
  }
  if (args.language === "ES") {
    return {
      id: "summarize_theme",
      kind: "summarize_theme",
      title: `Preparar un resumen estructurado sobre "${args.focus}"`,
      confidence: 0.74,
      rationale: "Los temas de estructura repetidos ya dan una base para la sintesis.",
      sourceTitles: topics,
      steps: [
        "Agrupar los temas repetidos en un mismo esquema.",
        "Marcar coincidencias y diferencias entre documentos.",
        "Validar el esquema antes de cualquier accion en el espacio."
      ],
      requiresReview: true
    };
  }
  return {
    id: "summarize_theme",
    kind: "summarize_theme",
    title: `Prepare a structured summary around "${args.focus}"`,
    confidence: 0.74,
    rationale: "Repeated outline topics already provide a workable summary skeleton.",
    sourceTitles: topics,
    steps: [
      "Group repeated topics into one shared outline.",
      "Mark agreement and divergence across documents.",
      "Review the outline before any workspace action is proposed."
    ],
    requiresReview: true
  };
}

function buildRepairIngestionProposal(args: {
  language: string;
  blockedCount: number;
}): ActionPlanProposal | null {
  if (args.blockedCount <= 0) return null;
  if (args.language === "FR") {
    return {
      id: "repair_ingestion",
      kind: "repair_ingestion",
      title: "Stabiliser les documents bloques avant d'aller plus loin",
      confidence: 0.82,
      rationale: "Une partie du corpus reste inutilisable tant que l'extraction n'est pas fiable.",
      sourceTitles: [],
      steps: [
        "Identifier les documents sans chemin fiable ou sans texte lisible.",
        "Corriger le lien fichier ou relancer l'extraction.",
        "Relancer ensuite le magasin documentaire puis la recherche."
      ],
      requiresReview: true
    };
  }
  if (args.language === "DE") {
    return {
      id: "repair_ingestion",
      kind: "repair_ingestion",
      title: "Blockierte Dokumente zuerst stabilisieren",
      confidence: 0.82,
      rationale: "Ein Teil des Bestands bleibt unbrauchbar, solange die Extraktion nicht verlaesslich ist.",
      sourceTitles: [],
      steps: [
        "Dokumente ohne verlaesslichen Pfad oder lesbaren Text identifizieren.",
        "Dateiverknuepfung korrigieren oder Extraktion erneut ausfuehren.",
        "Danach Dokumentenspeicher und Suche erneut laufen lassen."
      ],
      requiresReview: true
    };
  }
  if (args.language === "ES") {
    return {
      id: "repair_ingestion",
      kind: "repair_ingestion",
      title: "Estabilizar primero los documentos bloqueados",
      confidence: 0.82,
      rationale: "Parte del corpus sigue inutilizable mientras la extraccion no sea fiable.",
      sourceTitles: [],
      steps: [
        "Identificar documentos sin ruta fiable o sin texto legible.",
        "Corregir el enlace del archivo o relanzar la extraccion.",
        "Volver a ejecutar luego el almacen documental y la busqueda."
      ],
      requiresReview: true
    };
  }
  return {
    id: "repair_ingestion",
    kind: "repair_ingestion",
    title: "Stabilize blocked documents before going further",
    confidence: 0.82,
    rationale: "Part of the corpus is still unusable while extraction remains unreliable.",
    sourceTitles: [],
    steps: [
      "Identify documents without a reliable file path or readable text.",
      "Repair the file link or rerun extraction.",
      "Rerun the document store and retrieval afterwards."
    ],
    requiresReview: true
  };
}

function buildPrepareBriefProposal(args: {
  language: string;
  focus: string;
  matchedSignals: string[];
  indexedReadyCount: number;
}): ActionPlanProposal | null {
  if (args.indexedReadyCount <= 0) return null;
  const signals = args.matchedSignals.slice(0, 2);
  if (args.language === "FR") {
    return {
      id: "prepare_brief",
      kind: "prepare_brief",
      title: `Preparer une note de cadrage sur "${args.focus}"`,
      confidence: roundConfidence(0.58 + Math.min(args.indexedReadyCount, 4) * 0.06),
      rationale: "Le corpus pret permet deja de produire une note de travail ciblee et verifiable.",
      sourceTitles: signals,
      steps: [
        "Resumer les points stables venant des documents indexes.",
        "Lister les zones a verifier ou a arbitrer.",
        "Presenter la note comme proposition a relire avant execution."
      ],
      requiresReview: true
    };
  }
  if (args.language === "DE") {
    return {
      id: "prepare_brief",
      kind: "prepare_brief",
      title: `Eine Arbeitsnotiz zu "${args.focus}" vorbereiten`,
      confidence: roundConfidence(0.58 + Math.min(args.indexedReadyCount, 4) * 0.06),
      rationale: "Der bereite Dokumentbestand reicht fuer eine gezielte, nachvollziehbare Arbeitsnotiz.",
      sourceTitles: signals,
      steps: [
        "Stabile Punkte aus den indizierten Dokumenten zusammenfassen.",
        "Offene Fragen oder Konflikte explizit notieren.",
        "Die Notiz als pruefbare Vorlage vor jeder Ausfuehrung vorlegen."
      ],
      requiresReview: true
    };
  }
  if (args.language === "ES") {
    return {
      id: "prepare_brief",
      kind: "prepare_brief",
      title: `Preparar una nota de trabajo sobre "${args.focus}"`,
      confidence: roundConfidence(0.58 + Math.min(args.indexedReadyCount, 4) * 0.06),
      rationale: "El corpus disponible ya permite una nota dirigida y verificable.",
      sourceTitles: signals,
      steps: [
        "Resumir los puntos estables procedentes de documentos indexados.",
        "Enumerar dudas o conflictos que aun deban verificarse.",
        "Presentar la nota como propuesta para revision antes de ejecutar nada."
      ],
      requiresReview: true
    };
  }
  return {
    id: "prepare_brief",
    kind: "prepare_brief",
    title: `Prepare a working brief for "${args.focus}"`,
    confidence: roundConfidence(0.58 + Math.min(args.indexedReadyCount, 4) * 0.06),
    rationale: "The ready corpus is already strong enough for a targeted, reviewable brief.",
    sourceTitles: signals,
    steps: [
      "Summarize the stable points coming from indexed documents.",
      "List the open questions or conflicts that still need review.",
      "Present the brief as a proposal before any execution."
    ],
    requiresReview: true
  };
}

function buildBroadenSearchProposal(args: {
  language: string;
  focus: string;
}): ActionPlanProposal {
  if (args.language === "FR") {
    return {
      id: "broaden_search",
      kind: "broaden_search",
      title: `Elargir la recherche autour de "${args.focus}"`,
      confidence: 0.53,
      rationale: "Les correspondances actuelles sont trop faibles ou trop rares pour proposer plus.",
      sourceTitles: [],
      steps: [
        "Essayer un theme plus large ou un synonyme metier.",
        "Utiliser la selection de noeuds pour restreindre le contexte.",
        "Relancer ensuite la recherche de connaissance avant tout plan detaille."
      ],
      requiresReview: true
    };
  }
  if (args.language === "DE") {
    return {
      id: "broaden_search",
      kind: "broaden_search",
      title: `Die Suche um "${args.focus}" erweitern`,
      confidence: 0.53,
      rationale: "Die aktuellen Treffer sind zu schwach oder zu selten fuer mehr.",
      sourceTitles: [],
      steps: [
        "Ein breiteres Thema oder ein Fachsynonym probieren.",
        "Die Knotenauswahl nutzen, um den Kontext einzugrenzen.",
        "Danach die Wissenssuche erneut starten, bevor ein Detailplan entsteht."
      ],
      requiresReview: true
    };
  }
  if (args.language === "ES") {
    return {
      id: "broaden_search",
      kind: "broaden_search",
      title: `Ampliar la busqueda sobre "${args.focus}"`,
      confidence: 0.53,
      rationale: "Las coincidencias actuales son demasiado debiles o escasas para proponer mas.",
      sourceTitles: [],
      steps: [
        "Probar un tema mas amplio o un sinonimo funcional.",
        "Usar la seleccion de nodos para acotar el contexto.",
        "Volver a ejecutar la recuperacion antes de un plan mas detallado."
      ],
      requiresReview: true
    };
  }
  return {
    id: "broaden_search",
    kind: "broaden_search",
    title: `Broaden the search around "${args.focus}"`,
    confidence: 0.53,
    rationale: "The current matches are too weak or too sparse to plan much more.",
    sourceTitles: [],
    steps: [
      "Try a broader topic or a business synonym.",
      "Use selected nodes to narrow the context.",
      "Rerun retrieval before producing a more detailed plan."
    ],
    requiresReview: true
  };
}

export async function buildWorkspaceActionPlan(args: {
  project: ProjectSummary | null;
  allNodes: AppNode[];
  selectedNodeIds: string[];
  language: string;
  focus: string;
  maxRecords?: number;
}): Promise<WorkspaceActionPlan> {
  const [retrieval, workspaceSummary] = await Promise.all([
    buildKnowledgeRetrievalPreview({
      project: args.project,
      allNodes: args.allNodes,
      selectedNodeIds: args.selectedNodeIds,
      language: args.language,
      query: args.focus,
      maxRecords: args.maxRecords
    }),
    buildWorkspaceKnowledgeSummary({
      project: args.project,
      allNodes: args.allNodes,
      selectedNodeIds: args.selectedNodeIds,
      language: args.language,
      maxRecords: args.maxRecords
    })
  ]);

  const proposals = [
    buildReviewDocumentsProposal({
      language: args.language,
      focus: retrieval.query,
      documentMatches: retrieval.documentMatches
    }),
    buildSummarizeThemeProposal({
      language: args.language,
      focus: retrieval.query,
      matchedOutlineTopics: retrieval.matchedOutlineTopics
    }),
    buildRepairIngestionProposal({
      language: args.language,
      blockedCount: workspaceSummary.blockedCount
    }),
    buildPrepareBriefProposal({
      language: args.language,
      focus: retrieval.query,
      matchedSignals: retrieval.matchedSignals,
      indexedReadyCount: workspaceSummary.indexedReadyCount
    })
  ].filter((proposal): proposal is ActionPlanProposal => Boolean(proposal));

  if (proposals.length === 0) {
    proposals.push(
      buildBroadenSearchProposal({
        language: args.language,
        focus: retrieval.query
      })
    );
  }

  return {
    scopeName: retrieval.scopeName,
    focus: retrieval.query,
    focusSource: retrieval.querySource,
    query: retrieval.query,
    proposals: proposals.slice(0, 4),
    generatedAt: retrieval.generatedAt
  };
}
