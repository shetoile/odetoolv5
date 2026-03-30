function normalizeTooltipKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, " ")
    .trim();
}

const SIMPLIFIED_ODE_NODE_TOOLTIPS = new Map<string, string>([
  [
    normalizeTooltipKey("1.1 Managements"),
    [
      "Pour les chantiers des classes d'activites :",
      "111 Management strategique",
      "1111 Strategie d'ensemble (Politique et strategie)",
      "1112 Strategie Offre A (par offre de produit ou service)",
      "1113 Strategie Offre B, etc",
      "112 Management operationnel",
      "1121 Gestion Chantiers/processus (*)",
      "1122 Marketing strategique",
      "1123 Cellules de crises",
      "1124 Reseaux, partenariats",
    ].join("\n"),
  ],
  [
    normalizeTooltipKey("1.2 Gestion RH"),
    [
      "Pour les chantiers des classes d'activites :",
      "121 Effectif",
      "1211 GPEC (*)",
      "1212 Groupes (*)",
      "122 Formations",
      "1221 Formations internes",
      "1222 Formations externes",
      "123 Recrutements",
      "1231 Plan de recrutement",
      "1232 Emplois temporaires",
      "1233 Stages",
    ].join("\n"),
  ],
  [
    normalizeTooltipKey("1.3 Communication"),
    [
      "Pour les chantiers des classes d'activites :",
      "131 Communication interne",
      "1311 Affichages et Diffusion",
      "1312 Evenementiel",
      "132 Communication externe",
      "1321 Image de l'entreprise",
      "1322 Images par offre / produit",
      "1323 Accueils-standard (*)",
    ].join("\n"),
  ],
  [
    normalizeTooltipKey("1.4 Gestion des Actifs"),
    [
      "Pour les chantiers des classes d'activites :",
      "141 Actifs materiels",
      "1411 Infrastructures",
      "1412 Outils de production",
      "1413 Bureautique (*)",
      "1414 Instrumentation",
      "142 Actifs immateriels",
      "1421 Propriete intellectuelle",
      "1422 Systeme d'information (*)",
    ].join("\n"),
  ],
  [
    normalizeTooltipKey("1.5 Gestion du Savoir"),
    [
      "Pour les chantiers des classes d'activites :",
      "151 Methodes",
      "1511 Referentiels",
      "1512 Recettes et procedes (*)",
      "1513 HSE, RSE",
      "1514 Documentations (*)",
      "152 Amelioration continue",
      "1521 Management de la Qualite",
      "1522 Innovation",
      "1523 Environnement",
      "1524 Gestion des Risques (*)",
    ].join("\n"),
  ],
  [
    normalizeTooltipKey("2.1 Juridique"),
    [
      "Pour les chantiers des classes d'activites :",
      "211 Identite administrative",
      "2111 Personne morale (*)",
      "2112 Representation des salaries",
      "212 Protection sociale",
      "2121 Sante (*)",
      "2122 Retraites (*)",
      "213 Assurances",
      "2131 RC, autres assurances (*)",
      "2132 Assistance",
      "214 Support juridique",
      "2141 Contrats",
      "2142 Contentieux",
      "215 Divers administration",
      "2151 Import/export",
      "2152 Autres",
    ].join("\n"),
  ],
  [
    normalizeTooltipKey("2.2 Finances"),
    [
      "Pour les chantiers des classes d'activites :",
      "221 Logistique",
      "2211 Ressources (Passif)",
      "2212 Emplois (Actifs)",
      "2213 Tresorerie (*)",
      "222 Comptabilite",
      "2221 Financiere (*)",
      "2222 de gestion",
      "2223 Paie (*)",
      "223 Fiscalite",
      "2231 Declarations",
      "2232 Credits d'impots",
    ].join("\n"),
  ],
  [
    normalizeTooltipKey("3.1 Commercial"),
    [
      "Pour les chantiers des classes d'activites :",
      "311 Marketing operationnel",
      "3111 Prospection",
      "3112 Evenementiel",
      "312 Ventes",
      "3121 Demarches commerciales",
      "3122 Administration des ventes (*)",
      "3123 CRM (*)",
    ].join("\n"),
  ],
  [
    normalizeTooltipKey("3.2 Production"),
    [
      "Pour les chantiers des classes d'activites :",
      "321 Logistique",
      "3211 Planification (*)",
      "3212 Tracabilite",
      "3213 Emballages",
      "3214 Transports - Manutention",
      "322 Achats",
      "3221 Fournisseurs (*)",
      "3222 Approvisionnements (*)",
      "3223 Sous-Traitance",
      "323 Stocks",
      "3231 Matieres premieres",
      "3232 Composants",
      "3233 Produits (*)",
      "324 Process",
      "3241 Etudes - conception",
      "3242 Fabrication",
      "3243 Traitements",
      "3244 Assemblage",
      "3245 Mesures - Controles - Tests",
      "3246 Installation - Mise en service",
      "3247 Gestion des dechets et rejets",
    ].join("\n"),
  ],
]);

[
  "Managements",
  "Gestion RH",
  "Communication",
  "Gestion des Actifs",
  "Gestion du Savoir",
  "Juridique",
  "Finances",
  "Commercial",
  "Production",
].forEach((label) => {
  const numberedEntry = [...SIMPLIFIED_ODE_NODE_TOOLTIPS.entries()].find(([key]) =>
    key.endsWith(normalizeTooltipKey(label))
  );
  if (numberedEntry) {
    SIMPLIFIED_ODE_NODE_TOOLTIPS.set(normalizeTooltipKey(label), numberedEntry[1]);
  }
});

export function getNodeTooltipLabel(input: {
  title: string;
  description?: string | null;
  numberLabel?: string | null;
}): string | null {
  const description = input.description?.trim();
  if (description) return description;

  const combinedKey = normalizeTooltipKey(
    [input.numberLabel?.trim() ?? "", input.title.trim()].filter(Boolean).join(" ")
  );
  const titleKey = normalizeTooltipKey(input.title);

  return SIMPLIFIED_ODE_NODE_TOOLTIPS.get(combinedKey) ?? SIMPLIFIED_ODE_NODE_TOOLTIPS.get(titleKey) ?? null;
}
