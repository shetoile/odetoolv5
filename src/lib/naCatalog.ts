import type { NAMatchCandidate, NAMatchResult } from "@/lib/types";

export interface NAEntry {
  code: string;
  level: number;
  label: string;
  pathLabels: string[];
  aliases: string[];
  keywords: string[];
  examples: string[];
}

type NAEntrySeed = Omit<NAEntry, "aliases" | "keywords" | "examples"> & {
  aliases?: string[];
  keywords?: string[];
  examples?: string[];
};

export const NA_CATALOG_VERSION = "v1";

const RAW_NA_CATALOG: NAEntrySeed[] = [
  { code: "1", level: 1, label: "Pilotage", pathLabels: [] },
  { code: "11", level: 2, label: "Managements", pathLabels: ["Pilotage"] },
  { code: "111", level: 3, label: "Management strategique", pathLabels: ["Pilotage", "Managements"] },
  {
    code: "1111",
    level: 4,
    label: "Strategie d'ensemble",
    pathLabels: ["Pilotage", "Managements", "Management strategique"],
    keywords: ["strategie globale", "vision", "orientation"],
    examples: ["strategie d'entreprise", "strategie groupe"]
  },
  {
    code: "1112",
    level: 4,
    label: "Strategie Activite A",
    pathLabels: ["Pilotage", "Managements", "Management strategique"],
    keywords: ["strategie activite", "strategie business unit"]
  },
  {
    code: "1113",
    level: 4,
    label: "Strategie Activite B",
    pathLabels: ["Pilotage", "Managements", "Management strategique"],
    keywords: ["strategie activite", "strategie business line"]
  },
  { code: "112", level: 3, label: "Management Operationnel", pathLabels: ["Pilotage", "Managements"] },
  {
    code: "1121",
    level: 4,
    label: "Gestion Chantiers/processus",
    pathLabels: ["Pilotage", "Managements", "Management Operationnel"],
    aliases: ["gestion chantiers", "gestion processus"],
    keywords: ["processus", "pilotage chantier", "workflow"]
  },
  {
    code: "1122",
    level: 4,
    label: "Marketing strategique",
    pathLabels: ["Pilotage", "Managements", "Management Operationnel"],
    keywords: ["positionnement", "offre", "marche"]
  },
  {
    code: "1123",
    level: 4,
    label: "Cellules de crises",
    pathLabels: ["Pilotage", "Managements", "Management Operationnel"],
    aliases: ["cellule de crise"],
    keywords: ["crise", "gestion de crise", "incident majeur"]
  },
  {
    code: "1124",
    level: 4,
    label: "Reseaux, partenariats",
    pathLabels: ["Pilotage", "Managements", "Management Operationnel"],
    aliases: ["reseaux partenariats"],
    keywords: ["partenariat", "alliance", "ecosysteme"]
  },
  { code: "12", level: 2, label: "Gestion RH", pathLabels: ["Pilotage"] },
  { code: "121", level: 3, label: "Effectif", pathLabels: ["Pilotage", "Gestion RH"] },
  {
    code: "1211",
    level: 4,
    label: "GPEC",
    pathLabels: ["Pilotage", "Gestion RH", "Effectif"],
    aliases: ["gestion previsionnelle des emplois et competences"],
    keywords: ["competences", "effectifs", "planning rh"]
  },
  {
    code: "1212",
    level: 4,
    label: "Groupes",
    pathLabels: ["Pilotage", "Gestion RH", "Effectif"],
    keywords: ["equipes", "groupes de travail"]
  },
  { code: "122", level: 3, label: "Formations", pathLabels: ["Pilotage", "Gestion RH"] },
  {
    code: "1221",
    level: 4,
    label: "Formations internes",
    pathLabels: ["Pilotage", "Gestion RH", "Formations"],
    keywords: ["formation interne", "academy", "upskilling"]
  },
  {
    code: "1222",
    level: 4,
    label: "Formations externes",
    pathLabels: ["Pilotage", "Gestion RH", "Formations"],
    keywords: ["formation externe", "certification", "prestataire formation"]
  },
  { code: "123", level: 3, label: "Recrutements", pathLabels: ["Pilotage", "Gestion RH"] },
  {
    code: "1231",
    level: 4,
    label: "Plan de recrutement",
    pathLabels: ["Pilotage", "Gestion RH", "Recrutements"],
    keywords: ["hiring plan", "plan embauche", "recrutement"]
  },
  {
    code: "1232",
    level: 4,
    label: "Emplois temporaires",
    pathLabels: ["Pilotage", "Gestion RH", "Recrutements"],
    keywords: ["interim", "temporaire", "contractuel"]
  },
  {
    code: "1233",
    level: 4,
    label: "Stages",
    pathLabels: ["Pilotage", "Gestion RH", "Recrutements"],
    keywords: ["stagiaire", "internship"]
  },
  { code: "13", level: 2, label: "Communication", pathLabels: ["Pilotage"] },
  { code: "131", level: 3, label: "Communication interne", pathLabels: ["Pilotage", "Communication"], aliases: ["Com. interne"] },
  {
    code: "1311",
    level: 4,
    label: "Affichages et Diffusion",
    pathLabels: ["Pilotage", "Communication", "Communication interne"],
    keywords: ["affichage", "diffusion", "communication interne"]
  },
  {
    code: "1312",
    level: 4,
    label: "Evenementiel",
    pathLabels: ["Pilotage", "Communication", "Communication interne"],
    keywords: ["event", "evenement", "seminaire"]
  },
  { code: "132", level: 3, label: "Communication externe", pathLabels: ["Pilotage", "Communication"], aliases: ["Com. externe"] },
  {
    code: "1321",
    level: 4,
    label: "Image de l'entreprise",
    pathLabels: ["Pilotage", "Communication", "Communication externe"],
    keywords: ["marque", "branding", "image entreprise"]
  },
  {
    code: "1322",
    level: 4,
    label: "Images par offre / produit",
    pathLabels: ["Pilotage", "Communication", "Communication externe"],
    keywords: ["image produit", "communication offre", "product branding"]
  },
  {
    code: "1323",
    level: 4,
    label: "Accueils-standard",
    pathLabels: ["Pilotage", "Communication", "Communication externe"],
    keywords: ["accueil", "standard", "reception"]
  },
  { code: "14", level: 2, label: "Gestion des Actifs", pathLabels: ["Pilotage"] },
  { code: "141", level: 3, label: "Materiels", pathLabels: ["Pilotage", "Gestion des Actifs"] },
  {
    code: "1411",
    level: 4,
    label: "Infrastructures",
    pathLabels: ["Pilotage", "Gestion des Actifs", "Materiels"],
    keywords: ["batiment", "site", "infrastructure"]
  },
  {
    code: "1412",
    level: 4,
    label: "Outils de production",
    pathLabels: ["Pilotage", "Gestion des Actifs", "Materiels"],
    keywords: ["equipement", "machine", "outillage", "production"]
  },
  {
    code: "1413",
    level: 4,
    label: "Bureautique",
    pathLabels: ["Pilotage", "Gestion des Actifs", "Materiels"],
    keywords: ["poste de travail", "ordinateur", "messagerie", "office"]
  },
  {
    code: "1414",
    level: 4,
    label: "Instrumentation",
    pathLabels: ["Pilotage", "Gestion des Actifs", "Materiels"],
    keywords: ["capteur", "mesure", "instrument"]
  },
  { code: "142", level: 3, label: "Immateriels", pathLabels: ["Pilotage", "Gestion des Actifs"] },
  {
    code: "1421",
    level: 4,
    label: "Propriete intellectuelle",
    pathLabels: ["Pilotage", "Gestion des Actifs", "Immateriels"],
    keywords: ["brevet", "marque", "copyright", "licence"]
  },
  {
    code: "1422",
    level: 4,
    label: "Systeme d'information",
    pathLabels: ["Pilotage", "Gestion des Actifs", "Immateriels"],
    aliases: ["SI"],
    keywords: ["informatique", "it", "application", "erp", "logiciel", "donnee", "digital"]
  },
  { code: "15", level: 2, label: "Management du Savoir", pathLabels: ["Pilotage"] },
  { code: "151", level: 3, label: "Methodes", pathLabels: ["Pilotage", "Management du Savoir"] },
  {
    code: "1511",
    level: 4,
    label: "Referentiels",
    pathLabels: ["Pilotage", "Management du Savoir", "Methodes"],
    keywords: ["reference", "standard", "norme"]
  },
  {
    code: "1512",
    level: 4,
    label: "Recettes et procedes",
    pathLabels: ["Pilotage", "Management du Savoir", "Methodes"],
    keywords: ["process recipe", "procedure", "mode operatoire"]
  },
  {
    code: "1513",
    level: 4,
    label: "HSE, RSE",
    pathLabels: ["Pilotage", "Management du Savoir", "Methodes"],
    keywords: ["hse", "rse", "securite", "durabilite", "sante au travail"]
  },
  {
    code: "1514",
    level: 4,
    label: "Documentations",
    pathLabels: ["Pilotage", "Management du Savoir", "Methodes"],
    keywords: ["documentation", "manuel", "guide"]
  },
  { code: "152", level: 3, label: "Amelioration continue", pathLabels: ["Pilotage", "Management du Savoir"] },
  {
    code: "1521",
    level: 4,
    label: "Management de la Qualite",
    pathLabels: ["Pilotage", "Management du Savoir", "Amelioration continue"],
    keywords: ["qualite", "qms", "audit qualite"]
  },
  {
    code: "1522",
    level: 4,
    label: "Innovation",
    pathLabels: ["Pilotage", "Management du Savoir", "Amelioration continue"],
    keywords: ["innovation", "idee", "prototype", "r&d"]
  },
  {
    code: "1523",
    level: 4,
    label: "Environnement",
    pathLabels: ["Pilotage", "Management du Savoir", "Amelioration continue"],
    keywords: ["ecologie", "environnemental", "impact environnement"]
  },
  {
    code: "1524",
    level: 4,
    label: "Gestion des Risques",
    pathLabels: ["Pilotage", "Management du Savoir", "Amelioration continue"],
    keywords: ["risque", "risk", "mitigation", "controle interne"]
  },
  { code: "2", level: 1, label: "Administration", pathLabels: [] },
  { code: "21", level: 2, label: "Administratif-Juridique", pathLabels: ["Administration"] },
  { code: "211", level: 3, label: "Identite administrative", pathLabels: ["Administration", "Administratif-Juridique"] },
  {
    code: "2111",
    level: 4,
    label: "Personne morale",
    pathLabels: ["Administration", "Administratif-Juridique", "Identite administrative"],
    keywords: ["statuts", "entite juridique", "legal entity"]
  },
  {
    code: "2112",
    level: 4,
    label: "Representation des salaries",
    pathLabels: ["Administration", "Administratif-Juridique", "Identite administrative"],
    keywords: ["cse", "representation salariale", "representants du personnel"]
  },
  { code: "212", level: 3, label: "Protection sociale", pathLabels: ["Administration", "Administratif-Juridique"] },
  {
    code: "2121",
    level: 4,
    label: "Sante",
    pathLabels: ["Administration", "Administratif-Juridique", "Protection sociale"],
    keywords: ["mutuelle", "sante", "medecine du travail"]
  },
  {
    code: "2122",
    level: 4,
    label: "Retraites",
    pathLabels: ["Administration", "Administratif-Juridique", "Protection sociale"],
    keywords: ["pension", "retraite"]
  },
  { code: "213", level: 3, label: "Assurances", pathLabels: ["Administration", "Administratif-Juridique"] },
  {
    code: "2131",
    level: 4,
    label: "RC, autres assurances",
    pathLabels: ["Administration", "Administratif-Juridique", "Assurances"],
    keywords: ["assurance", "responsabilite civile", "couverture"]
  },
  {
    code: "2132",
    level: 4,
    label: "Assistance",
    pathLabels: ["Administration", "Administratif-Juridique", "Assurances"],
    keywords: ["assistance", "support assurance"]
  },
  { code: "214", level: 3, label: "Support juridique", pathLabels: ["Administration", "Administratif-Juridique"] },
  {
    code: "2141",
    level: 4,
    label: "Contrats",
    pathLabels: ["Administration", "Administratif-Juridique", "Support juridique"],
    keywords: ["contrat", "agreement", "clause", "negociation"]
  },
  {
    code: "2142",
    level: 4,
    label: "Contentieux",
    pathLabels: ["Administration", "Administratif-Juridique", "Support juridique"],
    keywords: ["litige", "contentieux", "dispute", "claim"]
  },
  { code: "215", level: 3, label: "Divers Administration", pathLabels: ["Administration", "Administratif-Juridique"] },
  {
    code: "2151",
    level: 4,
    label: "Import/export",
    pathLabels: ["Administration", "Administratif-Juridique", "Divers Administration"],
    keywords: ["douane", "import", "export", "trade"]
  },
  {
    code: "2152",
    level: 4,
    label: "Autres",
    pathLabels: ["Administration", "Administratif-Juridique", "Divers Administration"]
  },
  { code: "22", level: 2, label: "Gestion financiere", pathLabels: ["Administration"] },
  { code: "221", level: 3, label: "Emplois/Ressources", pathLabels: ["Administration", "Gestion financiere"] },
  {
    code: "2211",
    level: 4,
    label: "Ressources (Passif)",
    pathLabels: ["Administration", "Gestion financiere", "Emplois/Ressources"],
    keywords: ["passif", "funding", "financement", "ressource financiere"]
  },
  {
    code: "2212",
    level: 4,
    label: "Emplois (Actifs)",
    pathLabels: ["Administration", "Gestion financiere", "Emplois/Ressources"],
    keywords: ["actif", "asset", "emploi des fonds"]
  },
  {
    code: "2213",
    level: 4,
    label: "Tresorerie",
    pathLabels: ["Administration", "Gestion financiere", "Emplois/Ressources"],
    keywords: ["cash", "cash flow", "liquidite", "treasury"]
  },
  { code: "222", level: 3, label: "Comptabilite", pathLabels: ["Administration", "Gestion financiere"] },
  {
    code: "2221",
    level: 4,
    label: "Financiere",
    pathLabels: ["Administration", "Gestion financiere", "Comptabilite"],
    keywords: ["comptabilite financiere", "financial accounting"]
  },
  {
    code: "2222",
    level: 4,
    label: "de gestion",
    pathLabels: ["Administration", "Gestion financiere", "Comptabilite"],
    aliases: ["controle de gestion"],
    keywords: ["gestion", "cost control", "budget"]
  },
  {
    code: "2223",
    level: 4,
    label: "Paie",
    pathLabels: ["Administration", "Gestion financiere", "Comptabilite"],
    keywords: ["salaire", "payroll", "bulletin"]
  },
  { code: "223", level: 3, label: "Fiscalite", pathLabels: ["Administration", "Gestion financiere"] },
  {
    code: "2231",
    level: 4,
    label: "Declarations",
    pathLabels: ["Administration", "Gestion financiere", "Fiscalite"],
    keywords: ["declaration fiscale", "tax filing", "reporting fiscal"]
  },
  {
    code: "2232",
    level: 4,
    label: "Credits d'impots",
    pathLabels: ["Administration", "Gestion financiere", "Fiscalite"],
    keywords: ["credit impot", "tax credit", "incitation fiscale"]
  },
  { code: "3", level: 1, label: "Operationnel", pathLabels: [] },
  { code: "31", level: 2, label: "Commercial", pathLabels: ["Operationnel"] },
  { code: "311", level: 3, label: "Marketing operationnel", pathLabels: ["Operationnel", "Commercial"] },
  {
    code: "3111",
    level: 4,
    label: "Prospection",
    pathLabels: ["Operationnel", "Commercial", "Marketing operationnel"],
    keywords: ["lead generation", "prospect", "acquisition"]
  },
  {
    code: "3112",
    level: 4,
    label: "Evenementiel",
    pathLabels: ["Operationnel", "Commercial", "Marketing operationnel"],
    keywords: ["salon", "event", "roadshow"]
  },
  { code: "312", level: 3, label: "Ventes", pathLabels: ["Operationnel", "Commercial"] },
  {
    code: "3121",
    level: 4,
    label: "Demarches commerciales",
    pathLabels: ["Operationnel", "Commercial", "Ventes"],
    keywords: ["vente", "negociation commerciale", "sales outreach"]
  },
  {
    code: "3122",
    level: 4,
    label: "Administration des ventes",
    pathLabels: ["Operationnel", "Commercial", "Ventes"],
    aliases: ["adv"],
    keywords: ["sales ops", "order management", "devis"]
  },
  {
    code: "3123",
    level: 4,
    label: "CRM",
    pathLabels: ["Operationnel", "Commercial", "Ventes"],
    keywords: ["crm", "client relationship", "pipeline"]
  },
  { code: "32", level: 2, label: "Production", pathLabels: ["Operationnel"] },
  { code: "321", level: 3, label: "Logistique", pathLabels: ["Operationnel", "Production"] },
  {
    code: "3211",
    level: 4,
    label: "Planification",
    pathLabels: ["Operationnel", "Production", "Logistique"],
    keywords: ["planning", "ordonnancement", "schedule"]
  },
  {
    code: "3212",
    level: 4,
    label: "Tracabilite",
    pathLabels: ["Operationnel", "Production", "Logistique"],
    keywords: ["traceability", "lot", "tracking"]
  },
  {
    code: "3213",
    level: 4,
    label: "Emballages",
    pathLabels: ["Operationnel", "Production", "Logistique"],
    keywords: ["packaging", "emballage"]
  },
  {
    code: "3214",
    level: 4,
    label: "Transports - Manutention",
    pathLabels: ["Operationnel", "Production", "Logistique"],
    aliases: ["transport manutention"],
    keywords: ["transport", "manutention", "shipping"]
  },
  { code: "322", level: 3, label: "Achats", pathLabels: ["Operationnel", "Production"] },
  {
    code: "3221",
    level: 4,
    label: "Fournisseurs",
    pathLabels: ["Operationnel", "Production", "Achats"],
    keywords: ["supplier", "vendor", "fournisseur"]
  },
  {
    code: "3222",
    level: 4,
    label: "Approvisionnements",
    pathLabels: ["Operationnel", "Production", "Achats"],
    keywords: ["procurement", "sourcing", "approvisionnement"]
  },
  {
    code: "3223",
    level: 4,
    label: "Sous-Traitance",
    pathLabels: ["Operationnel", "Production", "Achats"],
    aliases: ["sous traitance"],
    keywords: ["outsourcing", "subcontracting"]
  },
  { code: "323", level: 3, label: "Stocks", pathLabels: ["Operationnel", "Production"] },
  {
    code: "3231",
    level: 4,
    label: "Matieres premieres",
    pathLabels: ["Operationnel", "Production", "Stocks"],
    aliases: ["matieres premieres stock"],
    keywords: ["raw material", "matiere premiere"]
  },
  {
    code: "3232",
    level: 4,
    label: "Composants",
    pathLabels: ["Operationnel", "Production", "Stocks"],
    keywords: ["component", "piece", "subassembly"]
  },
  {
    code: "3233",
    level: 4,
    label: "Produits",
    pathLabels: ["Operationnel", "Production", "Stocks"],
    keywords: ["finished goods", "produit fini"]
  },
  { code: "324", level: 3, label: "Process", pathLabels: ["Operationnel", "Production"] },
  {
    code: "3241",
    level: 4,
    label: "Etudes - conception",
    pathLabels: ["Operationnel", "Production", "Process"],
    aliases: ["etudes conception"],
    keywords: ["design", "engineering", "conception", "study"]
  },
  {
    code: "3242",
    level: 4,
    label: "Fabrication",
    pathLabels: ["Operationnel", "Production", "Process"],
    keywords: ["manufacturing", "fabrication", "production line"]
  },
  {
    code: "3243",
    level: 4,
    label: "Traitements",
    pathLabels: ["Operationnel", "Production", "Process"],
    keywords: ["treatment", "processing", "traitement"]
  },
  {
    code: "3244",
    level: 4,
    label: "Assemblage",
    pathLabels: ["Operationnel", "Production", "Process"],
    keywords: ["assembly", "assemblage"]
  },
  {
    code: "3245",
    level: 4,
    label: "Mesures - Controles - Tests",
    pathLabels: ["Operationnel", "Production", "Process"],
    aliases: ["mesures controles tests"],
    keywords: ["qa", "controle", "test", "inspection", "measurement"]
  },
  {
    code: "3246",
    level: 4,
    label: "Installation - Mise en service",
    pathLabels: ["Operationnel", "Production", "Process"],
    aliases: ["installation mise en service"],
    keywords: ["commissioning", "installation", "deployment", "mise en service"]
  },
  {
    code: "3247",
    level: 4,
    label: "Gestion des dechets et rejets",
    pathLabels: ["Operationnel", "Production", "Process"],
    keywords: ["dechets", "rejets", "waste", "disposal"]
  }
];

export const NA_CATALOG: NAEntry[] = RAW_NA_CATALOG.map((entry) => ({
  ...entry,
  aliases: entry.aliases ?? [],
  keywords: entry.keywords ?? [],
  examples: entry.examples ?? []
}));

export const NA_LEVEL4_CATALOG = NA_CATALOG.filter((entry) => entry.level === 4);

const SEARCH_STOPWORDS = new Set([
  "a",
  "au",
  "aux",
  "d",
  "de",
  "des",
  "du",
  "en",
  "et",
  "l",
  "la",
  "le",
  "les",
  "of",
  "the",
  "to"
]);

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, " ")
    .toLowerCase();
}

function tokenizeSearchText(value: string): string[] {
  return Array.from(
    new Set(
      normalizeSearchText(value)
        .split(/[^a-z0-9]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2 && !SEARCH_STOPWORDS.has(token))
    )
  );
}

function scoreFields(inputTokens: string[], normalizedInput: string, fields: string[], weight: number): number {
  let score = 0;
  for (const field of fields) {
    const normalizedField = normalizeSearchText(field);
    if (!normalizedField) continue;
    if (normalizedInput.includes(normalizedField)) {
      score += weight * 2.4;
    }
    const fieldTokens = tokenizeSearchText(normalizedField);
    for (const token of inputTokens) {
      if (fieldTokens.includes(token)) {
        score += weight;
      } else if (normalizedField.includes(token)) {
        score += weight * 0.5;
      }
    }
  }
  return score;
}

function buildCandidate(entry: NAEntry, input: string): NAMatchCandidate | null {
  const normalizedInput = normalizeSearchText(input);
  const inputTokens = tokenizeSearchText(input);
  if (normalizedInput.length === 0 || inputTokens.length === 0) return null;

  let score = 0;
  if (normalizedInput.includes(entry.code)) {
    score += 10;
  }

  score += scoreFields(inputTokens, normalizedInput, [entry.label], 2.4);
  score += scoreFields(inputTokens, normalizedInput, entry.pathLabels, 1.4);
  score += scoreFields(inputTokens, normalizedInput, entry.aliases, 1.8);
  score += scoreFields(inputTokens, normalizedInput, entry.keywords, 1.6);
  score += scoreFields(inputTokens, normalizedInput, entry.examples, 1.2);

  if (score <= 0) return null;

  const matchedSignals: string[] = [];
  const labelTokens = tokenizeSearchText(entry.label);
  const matchedLabelTokens = labelTokens.filter((token) => inputTokens.includes(token));
  if (matchedLabelTokens.length > 0) {
    matchedSignals.push(`label:${matchedLabelTokens.slice(0, 3).join(", ")}`);
  }
  const matchedPathLabel = entry.pathLabels.find((label) =>
    tokenizeSearchText(label).some((token) => inputTokens.includes(token))
  );
  if (matchedPathLabel) {
    matchedSignals.push(`path:${matchedPathLabel}`);
  }
  const matchedKeyword = entry.keywords.find((keyword) =>
    tokenizeSearchText(keyword).some((token) => inputTokens.includes(token))
  );
  if (matchedKeyword) {
    matchedSignals.push(`keyword:${matchedKeyword}`);
  }

  return {
    code: entry.code,
    label: entry.label,
    score: Number(score.toFixed(2)),
    reason: matchedSignals.length > 0 ? matchedSignals.join(" | ") : "heuristic_match"
  };
}

function computeConfidence(topScore: number, secondScore: number): number {
  if (topScore <= 0) return 0;
  const scoreFactor = Math.min(0.36, topScore / 22);
  const marginFactor = Math.min(0.26, Math.max(0, topScore - secondScore) / 14);
  const confidence = 0.36 + scoreFactor + marginFactor;
  return Number(Math.max(0, Math.min(0.98, confidence)).toFixed(2));
}

export function getNAByCode(code: string | null | undefined): NAEntry | null {
  if (!code) return null;
  return NA_CATALOG.find((entry) => entry.code === code.trim()) ?? null;
}

export function getNALabel(code: string | null | undefined): string | null {
  const entry = getNAByCode(code);
  return entry ? `${entry.code} ${entry.label}` : null;
}

export function getNAPathLabel(code: string | null | undefined): string | null {
  const entry = getNAByCode(code);
  if (!entry) return null;
  return [...entry.pathLabels, `${entry.code} ${entry.label}`].join(" > ");
}

export function matchNAOutlineNode(code: string, title: string): NAEntry | null {
  const entry = getNAByCode(code);
  if (!entry) return null;
  const normalizedTitle = normalizeSearchText(title);
  const normalizedLabel = normalizeSearchText(entry.label);
  return normalizedTitle === normalizedLabel || normalizedTitle.includes(normalizedLabel) ? entry : null;
}

export function searchNACandidates(input: string, limit = 5): NAMatchCandidate[] {
  if (typeof input !== "string" || input.trim().length === 0) return [];
  return NA_LEVEL4_CATALOG
    .map((entry) => buildCandidate(entry, input))
    .filter((candidate): candidate is NAMatchCandidate => candidate !== null)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.code.localeCompare(right.code);
    })
    .slice(0, Math.max(1, limit));
}

export function buildNAMatchResult(input: string, limit = 5): NAMatchResult {
  const candidates = searchNACandidates(input, limit);
  const topCandidate = candidates[0] ?? null;
  const secondCandidate = candidates[1] ?? null;
  const confidence = topCandidate ? computeConfidence(topCandidate.score, secondCandidate?.score ?? 0) : 0;
  const recommendedCode = topCandidate && topCandidate.score >= 3.2 ? topCandidate.code : null;

  return {
    recommendedCode,
    confidence,
    extractedIntent: input.trim().slice(0, 220),
    candidates
  };
}
