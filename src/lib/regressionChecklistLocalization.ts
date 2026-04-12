import type { LanguageCode } from "@/lib/i18n";
import type { RegressionChecklistItem } from "@/lib/regressionChecklist";

type ChecklistArea = RegressionChecklistItem["area"];
type ChecklistText = { title: string; scenario: string };
type ChecklistTextById = Record<string, ChecklistText>;

const AREA_LABELS: Record<LanguageCode, Record<ChecklistArea, string>> = {
  EN: {
    Tree: "Tree",
    Desktop: "Desktop",
    Timeline: "Timeline",
    Workspace: "Workspace",
    Favorites: "Favorites",
    Keyboard: "Keyboard",
    UI: "UI"
  },
  FR: {
    Tree: "Arbre",
    Desktop: "Desktop",
    Timeline: "Timeline",
    Workspace: "Workspace",
    Favorites: "Favoris",
    Keyboard: "Clavier",
    UI: "UI"
  },
  DE: {
    Tree: "Baum",
    Desktop: "Desktop",
    Timeline: "Timeline",
    Workspace: "Arbeitsbereich",
    Favorites: "Favoriten",
    Keyboard: "Tastatur",
    UI: "UI"
  },
  ES: {
    Tree: "Arbol",
    Desktop: "Desktop",
    Timeline: "Timeline",
    Workspace: "Espacio de trabajo",
    Favorites: "Favoritos",
    Keyboard: "Teclado",
    UI: "UI"
  }
};

const FR_CHECKLIST_TEXT: ChecklistTextById = {
  "tree-f2-rename": {
    title: "Renommage F2 fonctionne dans l'arbre et la timeline",
    scenario: "Selectionnez un noeud, appuyez sur F2, renommez, puis verifiez que numerotation et selection restent correctes."
  },
  "tree-enter-new-node": {
    title: "Entree cree un nouveau noeud frere",
    scenario: "Selectionnez un noeud et appuyez sur Entree, puis confirmez que le nouveau noeud apparait et est editable."
  },
  "tree-tab-new-child": {
    title: "Tab cree un noeud enfant",
    scenario: "Selectionnez un noeud et appuyez sur Tab, puis verifiez que l'enfant est cree sous le parent selectionne."
  },
  "tree-new-node-auto-scroll": {
    title: "Defilement auto vers le noeud cree",
    scenario: "Creez ou dupliquez un noeud pres du bas de liste et verifiez que la vue defile pour le garder visible."
  },
  "desktop-duplicate-consistency": {
    title: "Dupliquer cree une seule copie valide",
    scenario: "Dupliquez des noeuds en grille et detail, puis confirmez une seule copie avec numerotation valide."
  },
  "desktop-filter-sync": {
    title: "Les filtres d'etat se synchronisent entre vues",
    scenario: "Basculez EMPTY/TASK/DATA et confirmez que arbre, desktop et timeline se rafraichissent de facon coherente."
  },
  "desktop-filter-logic": {
    title: "Logique des filtres ALL et EMPTY",
    scenario:
      "ALL active EMPTY/TASK/DATA; EMPTY deselectionne automatiquement TASK/DATA; et les dossiers FILLED n'apparaissent que lorsque TASK et DATA sont actifs ensemble, pas quand un seul l'est."
  },
  "desktop-upload-targets-current-folder": {
    title: "L'import et le glisser-deposer externe restent dans le dossier Desktop actuellement ouvert",
    scenario:
      "Ouvrez un dossier imbrique dans Desktop, puis importez un ou plusieurs fichiers depuis le bouton d'entete et par glisser-deposer depuis Windows dans une zone vide de Grille/Carte mentale/Detail. Verifiez que les fichiers importes sont crees dans ce dossier courant et non a la racine du workspace."
  },
  "desktop-mindmap-view-toggle": {
    title: "Vue Mind Map et bascule d'orientation",
    scenario: "Basculez Grille/Detail/Mind Map et verifiez que Horizontal/Vertical s'affiche correctement."
  },
  "desktop-mindmap-shortcuts-dnd": {
    title: "Mind Map garde raccourcis et glisser-deposer",
    scenario: "En mode Mind Map, testez fleches, multi-selection, copier/couper/coller/dupliquer et glisser/deplacer."
  },
  "desktop-procedure-selection-and-autosave": {
    title: "Systeme utilise Noeuds, Edition et Rapport tout en enregistrant automatiquement le contenu",
    scenario:
      "Dans Desktop > Systeme, commencez par Noeuds, renommez ou choisissez un titre de section, passez a Edition, utilisez les outils inline pour inserer une citation, un separateur ou un lien de noeud, saisissez du contenu, puis confirmez que le contenu enregistre du noeud se met a jour sans quitter ce flux en 3 actions."
  },
  "desktop-procedure-title-and-node-links": {
    title: "Le Rapport Systeme garde ses totaux, ses exports et ses liens inter-espaces alignes",
    scenario:
      "Dans Desktop > Systeme, renommez un titre depuis Noeuds, modifiez le texte et les connexions dans Edition, inserez un lien de noeud avec @ ou le selecteur depuis le workspace courant et un autre depuis un autre workspace, ajoutez un lien vers un outil en ligne, ouvrez Rapport, verifiez que les totaux sections, sections documentees, references, connexions, noeuds lies et liens externes se mettent a jour pour la branche ou l'espace courant, exportez le systeme en PDF et DOCX, puis cliquez les liens rendus et confirmez qu'ODETool selectionne la cible locale ou bascule vers l'espace distant sans casser le flux Systeme en 3 actions."
  },
  "timeline-schedule-next-month": {
    title: "Le planificateur accepte les mois suivants",
    scenario: "Ouvrez la planification, naviguez vers les mois futurs, choisissez des dates et verifiez la sauvegarde."
  },
  "timeline-modal-alignment": {
    title: "La modale Task Schedule est alignee et themed",
    scenario: "Verifiez labels, champs, date picker et actions selon le theme et la grille d'alignement."
  },
  "timeline-scroll-stability": {
    title: "Le scroll timeline reste stable apres copie/duplication",
    scenario: "Faites copier/dupliquer et confirmez que le scroll vertical ne saute pas."
  },
  "timeline-status-filter": {
    title: "Le filtre de statut met a jour les lignes visibles",
    scenario: "Basculez planned/in-progress/blocked/done et verifiez la mise a jour immediate des lignes timeline."
  },
  "timeline-parent-rollup-range": {
    title: "La plage parent cumule la plage des enfants",
    scenario: "Pour un parent, verifiez debut = plus tot des enfants et fin = plus tard des enfants."
  },
  "timeline-status-no-tooltip": {
    title: "Les pastilles statut n'ont pas de tooltip navigateur",
    scenario: "Survolez les pastilles de statut et confirmez qu'aucun tooltip navigateur n'apparait."
  },
  "workspace-move-branch": {
    title: "Move to Workspace fonctionne pour fichiers et branches",
    scenario: "Deplacez un fichier puis une branche vers un autre workspace et verifiez suppression source, insertion cible, focus sur le workspace cible, et ouverture fichier preservee apres deplacement."
  },
  "workspace-scope-list": {
    title: "La liste workspace montre seulement cree/importe",
    scenario: "Ouvrez le selecteur workspace et confirmez qu'aucun nom de noeud temporaire n'apparait."
  },
  "workspace-root-numbering": {
    title: "La numerotation des racines est optionnelle",
    scenario: "Desactivez la numerotation des racines: racines sans numero, enfants avec numerotation conservee."
  },
  "workspace-open-folder": {
    title: "Open Folder fonctionne sans clignotement",
    scenario: "Cliquez Open Folder et confirmez que l'explorateur s'ouvre sans flash visuel dans l'app."
  },
  "workspace-import-compat": {
    title: "Import folder gere les index versionnes en securite",
    scenario: "Importez un dossier externe et confirmez qu'aucune erreur de deserialisation de revision n'apparait."
  },
  "workspace-linked-mirror-no-sidecar-context": {
    title: "Le miroir workspace lie ne cree pas de fichiers .ode-context",
    scenario: "Generez ou synchronisez du contenu d'arbre dans un workspace lie puis verifiez que les dossiers miroirs ne contiennent que les dossiers/fichiers attendus, sans fichiers .ode-context."
  },
  "workspace-delete-themed-confirm": {
    title: "Suppression workspace utilise la modale themee",
    scenario: "Supprimez un workspace et confirmez la modale ODE, pas le dialogue navigateur natif."
  },
  "favorites-quick-access-visible": {
    title: "Quick Access est visible et alimente",
    scenario: "Ajoutez des favoris et verifiez que Quick Access affiche correctement onglets et noeuds."
  },
  "favorites-group-create-and-select": {
    title: "Groupes favoris: creer une fois puis selectionner en liste",
    scenario: "Creez le premier groupe avec +, puis assignez via liste sans prompts navigateur."
  },
  "favorites-group-delete": {
    title: "Suppression de groupe favori propre",
    scenario: "Supprimez un groupe et verifiez la mise a jour sans residus des onglets, mappings et etat."
  },
  "favorites-quick-access-tab-layout": {
    title: "Mise en page des onglets Quick Access conforme",
    scenario: "Verifiez l'absence d'onglet All avant + et des onglets groupes sur une seule ligne compacte."
  },
  "favorites-quick-access-double-click-open": {
    title: "Quick Access agit comme un lanceur avec des actions de groupe ciblees",
    scenario:
      "Dans Quick Access, cliquez une fois sur un favori dossier ou fichier et verifiez qu'ODETool l'ouvre dans le workspace puis bascule vers Node Tree. Ensuite faites clic droit sur une carte favorite et confirmez que le menu ne contient que des actions de lancement comme Ouvrir dans l'espace, Gerer les groupes d'acces rapide, Retirer de l'acces rapide, plus Apercu du fichier pour les fichiers. Faites aussi clic droit sur un en-tete de groupe puis sur un fond vide Quick Access et confirmez que ces menus restent limites aux actions de groupe comme Afficher le groupe, Supprimer le groupe et Nouveau groupe."
  },
  "keyboard-clipboard-shortcuts": {
    title: "Raccourcis copier/couper/coller/supprimer/dupliquer partout",
    scenario: "Testez ces raccourcis sur arbre, desktop et timeline avec une selection active."
  },
  "keyboard-multi-select": {
    title: "Le focus et la multi-selection restent coherents facon Windows",
    scenario:
      "Dans l'arbre, le desktop, la mind map/details et la timeline, verifiez que Fleche Haut/Bas deplace le focus, que Shift+Fleche etend la selection depuis l'ancre, que Ctrl+Fleche deplace le focus sans effacer la selection, que Ctrl+Espace bascule l'element focalise, et que Home/End ainsi que Ctrl+Home/Ctrl+End sautent correctement sur la surface active."
  },
  "ui-help-release-sync": {
    title: "Aide et Release Notes restent alignees avec les features",
    scenario: "Ouvrez Aide et Release Notes et verifiez une doc coherente dans toutes les langues supportees."
  },
  "ui-qa-checklist-release-gate": {
    title: "Checklist QA est revue avant packaging",
    scenario: "Avant packaging EXE/MSI, verifiez les statuts checklist et qu'aucun scenario critique n'est ouvert."
  },
  "ui-single-instance-and-utility-windows": {
    title: "Le second lancement refocalise l'app et les panneaux utilitaires reutilisent des fenetres dediees",
    scenario:
      "Avec ODETool deja ouvert, relancez l'EXE et confirmez que la fenetre principale existante reprend le focus au lieu d'ouvrir une seconde instance complete. Puis ouvrez Notes de version, Aide et Checklist QA depuis le footer et confirmez que chacune ouvre ou reutilise sa propre fenetre utilitaire."
  },
  "ui-utility-window-controls": {
    title: "Les fenetres utilitaires ont reduire, agrandir, restaurer et fermer",
    scenario:
      "Ouvrez Notes de version, Aide et Checklist QA dans leurs fenetres utilitaires dediees, puis verifiez que chaque entete propose reduire, agrandir/restaurer et fermer, et qu'un double-clic sur l'entete bascule aussi entre agrandir et restaurer."
  },
  "ui-main-window-multi-display-move": {
    title: "La fenetre principale se deplace proprement entre plusieurs ecrans",
    scenario:
      "Avec au moins deux ecrans connectes, faites glisser la fenetre principale ODETool d'un ecran a un autre en mode restaure, puis recommencez depuis une fenetre agrandie. Verifiez que la fenetre traverse les ecrans, continue a suivre le pointeur, peut etre agrandie sur le nouvel ecran, puis garde aussi reduire/restaurer."
  },
  "tree-organization-structure-lock": {
    title: "Les branches d'organisation peuvent etre verrouillees et deverrouillees depuis l'arborescence",
    scenario:
      "Dans Organisation, faites un clic droit sur une branche normale qui n'est pas la racine du workspace et confirmez que Verrouiller la structure apparait. Verrouillez la branche, verifiez que le badge cadenas apparait sur ce noeud et confirmez que la creation, le deplacement ou la suppression de noeuds dans cette branche sont bloques. Puis deverrouillez la meme branche et confirmez que ces editions d'arborescence refonctionnent."
  },
  "ui-qa-evidence-capture-flow": {
    title: "Les preuves QA acceptent les images presse-papiers et les fichiers",
    scenario:
      "Ouvrez la Checklist QA, marquez un element en echec, puis utilisez Depuis presse-papiers et Ajouter des fichiers. Verifiez que la preuve se joint correctement, s'ouvre au clic et peut etre retiree sans laisser d'etat UI stale."
  },
  "ui-qa-checklist-scroll-stability": {
    title: "Le scroll de la checklist QA reste stable au milieu de la liste",
    scenario:
      "Ouvrez la Checklist QA, faites defiler jusqu'au milieu, arretez le scroll, puis verifiez que la liste ne derive pas et ne rebondit pas toute seule. Fermez puis rouvrez la checklist et confirmez que la position enregistree est restauree une seule fois sans relancer une boucle de scroll."
  },
  "ui-no-default-browser-context-menu": {
    title: "Le menu clic-droit navigateur par defaut est bloque",
    scenario: "Faites clic droit sur zones vides et confirmez que seul le menu ODE personnalise apparait."
  },
  "ui-ai-command-bar-ctrl-k": {
    title: "Ctrl+K ouvre la Command Bar redesign",
    scenario: "Ouvrez la Command Bar, verifiez la nouvelle mise en page et executez le flux Plan/Confirm."
  },
  "ui-document-advisor-outline-routing": {
    title: "Options IA recommande l'import du plan numerote",
    scenario: "Selectionnez un document numerote comme Tree.txt, confirmez qu'Options IA detecte le plan, recommande l'import en arbre, et cree les vraies branches au lieu d'un WBS generique."
  },
  "ui-document-advisor-section-tree": {
    title: "La generation par section respecte la section choisie",
    scenario: "Dans Options IA, choisissez une section detectee, verifiez que l'apercu change, lancez Creer un arbre depuis la section, puis confirmez que seule cette branche est generee."
  },
  "ui-document-advisor-na-mapping": {
    title: "Options IA mappe correctement un document vers une NA",
    scenario: "Selectionnez un document avec un domaine ODE clair comme systeme d'information ou recrutement, ouvrez Options IA, confirmez qu'une NA recommandee apparait, lancez Mapper le document vers une NA, puis verifiez que la suggestion est enregistree sans creation d'arbre."
  },
  "ui-document-advisor-create-chantier": {
    title: "Options IA cree un chantier sous la NA niveau 4 mappee",
    scenario: "Dans un workspace contenant l'arbre ODE, selectionnez un document avec une forte correspondance NA niveau 4, ouvrez Options IA, lancez Creer un Chantier avec l'IA, puis verifiez qu'un nouveau chantier niveau 5 est cree sous la NA mappee sans modifier les niveaux 1 a 4."
  },
  "ui-ode-auto-chantier-routing": {
    title: "Le WBS documentaire bascule automatiquement en mode chantier dans ODE",
    scenario: "Selectionnez un document structure sous une NA niveau 4 ou un chantier existant, lancez Creer un WBS depuis le document, puis verifiez qu'ODETool cree une branche compatible chantier sous la bonne cible ODE au lieu d'un conteneur WBS generique."
  },
  "ui-ode-metadata-backfill": {
    title: "Les anciens arbres ODE recuperent leurs metadonnees a la demande",
    scenario: "Ouvrez un ancien workspace dont l'arbre ODE existait avant le support des metadonnees, selectionnez un document ou un noeud dans cette branche, lancez une action IA, puis verifiez qu'ODETool reconnait la branche comme ODE sans re-import."
  },
  "ui-root-enter-creates-top-level-branch": {
    title: "Entrer sur la racine cree une branche visible de premier niveau",
    scenario: "Selectionnez le noeud racine du workspace actif dans l'arbre ou la timeline, appuyez sur Entree, puis verifiez qu'ODETool cree un nouveau fils de premier niveau dans ce workspace au lieu d'un noeud invisible hors du scope projet."
  },
  "ui-workspace-root-branch-actions-stay-scoped": {
    title: "Les actions de branche sur la racine restent dans le workspace",
    scenario: "Dans un workspace actif, verifiez que Ctrl+V sans selection, Dupliquer sur la racine du workspace, et copier/coller depuis la racine creent des noeuds visibles dans le workspace, tandis que Couper sur la racine fixe est bloque."
  },
  "ui-timeline-child-create-actions": {
    title: "La creation d'enfant dans la timeline marche avec Tab et Nouveau sujet",
    scenario: "Dans la vue Timeline, selectionnez une ligne dossier, appuyez sur Tab, puis verifiez qu'un enfant visible est cree sous cette ligne. Ensuite utilisez clic droit Nouveau sujet sur la meme ligne et sur une zone vide de la timeline avec cette ligne selectionnee, puis verifiez que la creation reste sous le parent visible de la timeline."
  },
  "ui-context-menu-keyboard-default-action": {
    title: "Les menus clic droit prennent Enter et la navigation clavier",
    scenario: "Ouvrez le menu contextuel dans l'arbre, le Desktop et la Timeline, verifiez que la premiere action active recoit automatiquement le focus, que Entree l'execute, et que Fleches ou Tab deplacent le focus sans declencher les raccourcis globaux."
  },
  "ui-multi-select-context-menu-actions": {
    title: "Le clic droit preserve la multi-selection pour les actions partagees",
    scenario:
      "Selectionnez plusieurs noeuds freres dans l'arbre, le Desktop et la Timeline, puis faites clic droit sur un noeud deja selectionne et verifiez que toute la selection reste intacte afin que Copier, Couper, Dupliquer, Deplacer vers un workspace et Supprimer s'appliquent a l'ensemble selectionne au lieu de retomber sur un seul noeud."
  },
  "ui-desktop-context-menu-default-action-all-views": {
    title: "Desktop Grille, Mind Map et Details partagent la meme action par defaut",
    scenario: "En Desktop Grille, Mind Map et Details, faites clic droit sur une carte ou ligne dossier puis appuyez immediatement sur Entree, et verifiez que Nouveau sujet s'execute comme premiere action par defaut dans les trois vues."
  },
  "ui-shared-create-routing-across-surfaces": {
    title: "Le routage par defaut de Nouveau sujet reste coherent selon la surface",
    scenario: "Verifiez que Nouveau sujet sur une zone vide cree a la racine du workspace dans l'arbre, dans le dossier courant sur Desktop Grille/Mind Map/Details, et sous la ligne visible selectionnee dans Timeline quand il y en a une ; une cible fichier doit creer un frere et non un enfant."
  },
  "ui-desktop-filter-descendants-with-optional-parents": {
    title: "Les filtres Desktop montrent les descendants avec parents optionnels",
    scenario:
      "Activez un filtre Empty, Task ou Data en Desktop Grille/Mind Map/Details et verifiez que les descendants correspondants apparaissent depuis le dossier courant meme si les enfants directs ne correspondent pas ; avec Parents desactive, tous les dossiers ancetres jusqu'a la racine doivent rester masques afin de ne montrer que les correspondances directes ; basculez Parents et confirmez que ces dossiers parents peuvent alors etre affiches a la demande."
  },
  "ui-timeline-filter-parents-optional": {
    title: "Les filtres Timeline peuvent afficher ou masquer les parents",
    scenario:
      "Activez un ou plusieurs filtres de statut dans Timeline, y compris le cas ou les quatre statuts sont actifs, et verifiez que les lignes correspondantes restent visibles ; avec Parents desactive, toutes les lignes ancetres jusqu'a la racine doivent rester masquees meme si ce parent a lui-meme un statut correspondant ; basculez Parents dans l'entete Timeline et confirmez que ces lignes parentes n'apparaissent que lorsque cette option est activee."
  },
  "ui-inline-rename-spellcheck": {
    title: "Le renommage inline utilise le menu d'orthographe theme ODE",
    scenario: "Commencez un renommage dans l'arbre puis dans Timeline, tapez un mot mal orthographie, faites clic droit dans le champ, et verifiez que le menu ODE d'orthographe apparait avec suggestions et actions texte au lieu du menu navigateur natif ou du menu contextuel du noeud."
  },
  "tree-ode-protected-level-guard": {
    title: "Les niveaux ODE proteges bloquent la creation IA au-dessus du chantier",
    scenario: "Importez un plan ODE numerote en arbre, selectionnez un noeud protege de niveau 1 a 3, puis confirmez que la creation WBS par IA est bloquee tant qu'un noeud NA de niveau 4 ou un chantier existant n'est pas selectionne."
  }
};

const DE_CHECKLIST_TEXT: ChecklistTextById = {
  "tree-f2-rename": {
    title: "F2-Umbenennung funktioniert in Baum- und Timeline-Zeilen",
    scenario: "Node auswaehlen, F2 druecken, umbenennen und pruefen, dass Nummerierung und Auswahl korrekt bleiben."
  },
  "tree-enter-new-node": {
    title: "Enter erstellt einen neuen Geschwister-Node",
    scenario: "Node auswaehlen, Enter druecken und bestaetigen, dass ein neuer bearbeitbarer Node erscheint."
  },
  "tree-tab-new-child": {
    title: "Tab erstellt einen Kind-Node",
    scenario: "Node auswaehlen, Tab druecken und pruefen, dass der Kind-Node unter dem gewaehlten Parent erstellt wird."
  },
  "tree-new-node-auto-scroll": {
    title: "Auto-Scroll zum neu erstellten Node",
    scenario: "Node nahe Listenende erstellen/duplizieren und pruefen, dass der Viewport zur Sichtbarkeit scrollt."
  },
  "desktop-duplicate-consistency": {
    title: "Duplizieren erzeugt genau eine gueltige Kopie",
    scenario: "Nodes in Grid- und Detailansicht duplizieren und eine einzelne Kopie mit gueltiger Nummerierung bestaetigen."
  },
  "desktop-filter-sync": {
    title: "Node-Statusfilter bleiben zwischen Ansichten synchron",
    scenario: "EMPTY/TASK/DATA umschalten und pruefen, dass Baum, Desktop und Timeline konsistent aktualisieren."
  },
  "desktop-filter-logic": {
    title: "ALL- und EMPTY-Filterlogik",
    scenario:
      "ALL aktiviert EMPTY/TASK/DATA; EMPTY deaktiviert TASK/DATA automatisch; und FILLED-Ordner erscheinen nur, wenn TASK und DATA gemeinsam aktiv sind, nicht wenn nur einer davon aktiv ist."
  },
  "desktop-upload-targets-current-folder": {
    title: "Datei-Upload und externer Drop bleiben im aktuell geoeffneten Desktop-Ordner",
    scenario:
      "Einen verschachtelten Ordner im Desktop oeffnen und dann ueber die Kopfzeilen-Schaltflaeche sowie per Windows-Drag-and-Drop in leeren Grid-/Mind-Map-/Detail-Bereich eine oder mehrere Dateien importieren. Pruefen, dass die importierten Dateien im aktuellen Ordner und nicht an der Workspace-Wurzel erstellt werden."
  },
  "desktop-mindmap-view-toggle": {
    title: "Mind-Map-Ansicht und Orientierungsumschaltung",
    scenario: "Zwischen Grid/Detail/Mind Map wechseln und korrekte Darstellung von Horizontal/Vertical pruefen."
  },
  "desktop-mindmap-shortcuts-dnd": {
    title: "Mind Map behaelt Tastatur und Drag-and-Drop Verhalten",
    scenario: "Im Mind-Map-Modus Pfeile, Mehrfachauswahl, Copy/Cut/Paste/Duplicate sowie Drag/Move testen."
  },
  "desktop-procedure-selection-and-autosave": {
    title: "System nutzt Knoten, Bearbeitung und Bericht bei weiterem Autosave des Knoteninhalts",
    scenario:
      "In Desktop > System mit Knoten starten, eine Abschnittsueberschrift waehlen oder umbenennen, zu Bearbeitung wechseln, die Inline-Werkzeuge fuer Zitat, Trenner oder Knotenlink nutzen, Inhalt eingeben und bestaetigen, dass der gespeicherte Knotentext ohne Verlassen des 3-Aktionen-Flows aktualisiert wird."
  },
  "desktop-procedure-title-and-node-links": {
    title: "System-Bericht haelt Summen, Exporte und Knotenlinks ueber Workspaces hinweg konsistent",
    scenario:
      "In Desktop > System eine Ueberschrift unter Knoten umbenennen, Text und Verbindungen in Bearbeitung pflegen, einen Knotenlink per @ oder Picker aus dem aktuellen Workspace und einen aus einem anderen Workspace einfuegen, einen Link zu einem Online-Tool einfuegen, Bericht oeffnen, pruefen, dass die Summen fuer Abschnitte, dokumentierte Abschnitte, Referenzen, Verbindungen, verknuepfte Knoten und externe Links fuer den aktuellen Zweig oder Workspace aktualisiert werden, das System als PDF und DOCX exportieren und dann die gerenderten Links anklicken. Bestaetigen, dass ODETool das lokale Ziel auswaehlt oder zum entfernten Workspace wechselt, ohne den 3-Aktionen-Systemfluss zu stoeren."
  },
  "timeline-schedule-next-month": {
    title: "Terminplaner unterstuetzt naechsten Monat und spaeter",
    scenario: "Task Schedule oeffnen, Monate vorwaerts wechseln, Zukunftsdatum speichern und Persistenz pruefen."
  },
  "timeline-modal-alignment": {
    title: "Task-Schedule-Modal ist ausgerichtet und im Theme",
    scenario: "Labels, Felder, Date Picker und Aktionen auf Theme- und Grid-Ausrichtung pruefen."
  },
  "timeline-scroll-stability": {
    title: "Timeline-Scroll bleibt nach Copy/Duplicate stabil",
    scenario: "Copy/Duplicate ausfuehren und bestaetigen, dass vertikales Scrollen nicht springt."
  },
  "timeline-status-filter": {
    title: "Statusfilter aktualisiert sichtbare Zeilen",
    scenario: "planned/in-progress/blocked/done umschalten und sofortige Aktualisierung der Timeline-Zeilen pruefen."
  },
  "timeline-parent-rollup-range": {
    title: "Parent-Zeitraum rollt Kind-Zeitraeume auf",
    scenario: "Bei Parent-Ordnern pruefen: Start = fruehestes Kind, Ende = spaetestes Kind."
  },
  "timeline-status-no-tooltip": {
    title: "Status-Pills zeigen keinen Browser-Tooltip",
    scenario: "Status-Pills hoveren und bestaetigen, dass kein Browser-Tooltip den Timeline-Header ueberlagert."
  },
  "workspace-move-branch": {
    title: "Move to Workspace funktioniert fuer Dateien und Branches",
    scenario: "Verschieben Sie zuerst eine Datei und dann einen Branch in einen anderen Workspace und pruefen Sie Entfernen an der Quelle, Einfuegen am Ziel, Fokus auf den Ziel-Workspace und weiterhin funktionierendes Oeffnen der Datei nach dem Move."
  },
  "workspace-scope-list": {
    title: "Workspace-Liste zeigt nur erstellte/importierte Workspaces",
    scenario: "Workspace-Selector oeffnen und bestaetigen, dass keine temporaeren Node-Namen als Workspaces erscheinen."
  },
  "workspace-root-numbering": {
    title: "Root-Nummerierung ist optional",
    scenario: "Root-Nummerierung deaktivieren und pruefen: Roots ohne Nummer, Kinder behalten Nummerierung."
  },
  "workspace-open-folder": {
    title: "Open Folder funktioniert ohne Render-Blinken",
    scenario: "Open Folder klicken und bestaetigen, dass Explorer ohne sichtbares App-Flackern oeffnet."
  },
  "workspace-import-compat": {
    title: "Ordnerimport verarbeitet versionierte Indexdaten sicher",
    scenario: "Externen Ordner importieren und bestaetigen, dass kein Revision-Deserialisierungsfehler erscheint."
  },
  "workspace-linked-mirror-no-sidecar-context": {
    title: "Verknuepfter Workspace-Mirror erzeugt keine .ode-context-Dateien",
    scenario: "Bauminhalte in einem verknuepften Workspace erzeugen oder synchronisieren und pruefen, dass Mirror-Ordner nur erwartete Projektordner/-dateien ohne .ode-context-Hilfsdateien enthalten."
  },
  "workspace-delete-themed-confirm": {
    title: "Workspace-Loeschen nutzt thematisches Modal",
    scenario: "Workspace loeschen und bestaetigen, dass ODE-Modal statt nativer Browser-Dialog verwendet wird."
  },
  "favorites-quick-access-visible": {
    title: "Quick Access ist sichtbar und befuellt",
    scenario: "Favoriten hinzufuegen und pruefen, dass Quick Access Tabs und Nodes korrekt rendert."
  },
  "favorites-group-create-and-select": {
    title: "Favoritengruppen einmal erstellen, dann aus Liste waehlen",
    scenario: "Erste Gruppe mit + erstellen, danach Favoriten ueber Dropdown ohne Browser-Prompts zuweisen."
  },
  "favorites-group-delete": {
    title: "Favoritengruppe wird sauber geloescht",
    scenario: "Gruppe loeschen und pruefen, dass Tabs, Zuordnungen und Zustand ohne Reste aktualisieren."
  },
  "favorites-quick-access-tab-layout": {
    title: "Quick-Access-Tablayout entspricht der Vorgabe",
    scenario: "Pruefen, dass kein All-Tab vor + steht und Gruppentabs kompakt in einer Zeile bleiben."
  },
  "favorites-quick-access-double-click-open": {
    title: "Quick Access arbeitet jetzt als Launcher mit klaren Gruppenaktionen",
    scenario:
      "In Quick Access einen Datei- oder Ordner-Favoriten einmal anklicken und pruefen, dass ODETool ihn im Workspace oeffnet und zu Node Tree wechselt. Danach einen Favoriten per Rechtsklick oeffnen und bestaetigen, dass das Menue nur Launcher-Aktionen wie Im Workspace oeffnen, Schnellzugriffsgruppen verwalten, Aus Schnellzugriff entfernen sowie fuer Dateien Datei ansehen zeigt. Auch auf einen Gruppenkopf und auf freien Quick-Access-Hintergrund rechtsklicken und pruefen, dass diese Menues auf Gruppenaktionen wie Gruppe anzeigen, Gruppe loeschen und Neue Gruppe begrenzt bleiben."
  },
  "keyboard-clipboard-shortcuts": {
    title: "Copy/Cut/Paste/Delete/Duplicate funktionieren auf allen Flaechen",
    scenario: "Shortcuts in Baum, Desktop und Timeline mit aktiver Auswahl ausfuehren."
  },
  "keyboard-multi-select": {
    title: "Windows-artiger Fokus und Mehrfachauswahl bleiben konsistent",
    scenario:
      "In Baum, Desktop, Mind Map/Details und Timeline pruefen, dass Pfeil Hoch/Runter den Fokus bewegt, Shift+Pfeil die Auswahl vom Anker aus erweitert, Ctrl+Pfeil den Fokus ohne Kollaps der Auswahl verschiebt, Ctrl+Leertaste das fokussierte Element umschaltet und Home/End sowie Ctrl+Home/Ctrl+End korrekt auf der aktiven Oberflaeche springen."
  },
  "ui-help-release-sync": {
    title: "Hilfe und Release Notes bleiben mit Features synchron",
    scenario: "Hilfe und Release Notes oeffnen und auf konsistente Dokumentation in allen Sprachen pruefen."
  },
  "ui-qa-checklist-release-gate": {
    title: "QA-Checkliste wird vor Packaging geprueft",
    scenario: "Vor EXE/MSI-Paketierung Checklistenstatus pruefen und offene kritische Szenarien ausschliessen."
  },
  "ui-single-instance-and-utility-windows": {
    title: "Ein zweiter Start fokussiert die bestehende App und Utility-Panels nutzen eigene Fenster",
    scenario:
      "Wenn ODETool bereits offen ist, EXE erneut starten und bestaetigen, dass das vorhandene Hauptfenster fokussiert wird statt eine zweite vollstaendige Instanz zu oeffnen. Danach Release Notes, Hilfe und QA-Checkliste ueber den Footer oeffnen und bestaetigen, dass jedes Panel sein eigenes Utility-Fenster oeffnet oder wiederverwendet."
  },
  "ui-utility-window-controls": {
    title: "Utility-Fenster unterstuetzen Minimieren, Maximieren, Wiederherstellen und Schliessen",
    scenario:
      "Release Notes, Hilfe und QA-Checkliste in ihren eigenen Utility-Fenstern oeffnen und pruefen, dass jede Kopfzeile Minimieren, Maximieren/Wiederherstellen und Schliessen anbietet und dass ein Doppelklick auf die Kopfzeile ebenfalls zwischen Maximieren und Wiederherstellen umschaltet."
  },
  "ui-main-window-multi-display-move": {
    title: "Das Hauptfenster laesst sich sauber ueber mehrere Monitore verschieben",
    scenario:
      "Mit zwei oder mehr angeschlossenen Monitoren das ODETool-Hauptfenster im wiederhergestellten Zustand von einem Bildschirm auf einen anderen ziehen und den Test dann erneut aus maximiertem Zustand starten. Pruefen, dass das Fenster den Monitor wechselt, dem Zeiger weiter folgt, auf dem neuen Bildschirm maximiert werden kann und danach weiterhin Minimieren/Wiederherstellen unterstuetzt."
  },
  "tree-organization-structure-lock": {
    title: "Organisationszweige lassen sich im Baum sperren und entsperren",
    scenario:
      "In Organisation einen normalen Zweig, der nicht die Workspace-Wurzel ist, per Rechtsklick oeffnen und bestaetigen, dass Struktur sperren erscheint. Den Zweig sperren, pruefen, dass das Schloss-Badge an diesem Knoten erscheint, und bestaetigen, dass Erstellen, Verschieben oder Loeschen von Knoten innerhalb dieses Zweigs blockiert wird. Danach denselben Zweig entsperren und bestaetigen, dass diese Baum-Bearbeitungen wieder funktionieren."
  },
  "ui-qa-evidence-capture-flow": {
    title: "QA-Belege akzeptieren Zwischenablagebilder und Dateien",
    scenario:
      "QA-Checkliste oeffnen, einen Punkt als fehlgeschlagen markieren und dann Aus Zwischenablage sowie Dateien hinzufuegen verwenden. Bestaetigen, dass der Beleg angehaengt wird, sich per Klick oeffnen laesst und wieder sauber entfernt werden kann."
  },
  "ui-qa-checklist-scroll-stability": {
    title: "Der Scroll der QA-Checkliste bleibt in der Listenmitte stabil",
    scenario:
      "Die QA-Checkliste oeffnen, bis in die Mitte scrollen, anhalten und pruefen, dass die Liste nicht von selbst nach oben oder unten driftet. Danach die Checkliste schliessen und erneut oeffnen und bestaetigen, dass die gespeicherte Position genau einmal wiederhergestellt wird, ohne eine neue Scroll-Schleife auszulosen."
  },
  "ui-no-default-browser-context-menu": {
    title: "Standard-Browser-Kontextmenue ist blockiert",
    scenario: "Auf leere Flaechen rechtsklicken und bestaetigen, dass nur das ODE-Kontextmenue angezeigt wird."
  },
  "ui-ai-command-bar-ctrl-k": {
    title: "Ctrl+K oeffnet die neu gestaltete Command Bar",
    scenario: "Command Bar oeffnen, neues Layout pruefen und Plan/Confirm-Flow erfolgreich ausfuehren."
  },
  "ui-document-advisor-outline-routing": {
    title: "KI-Optionen empfehlen Outline-Import fuer nummerierte Dokumente",
    scenario: "Ein nummeriertes Dokument wie Tree.txt auswaehlen, pruefen dass KI-Optionen die Nummernstruktur erkennen, Outline-Import empfehlen und echte Zweiglabels statt generischer Fallback-WBS-Titel erzeugen."
  },
  "ui-document-advisor-section-tree": {
    title: "Abschnittsbaum respektiert die gewaehlte Section",
    scenario: "In KI-Optionen eine erkannte Section waehlen, die Vorschau pruefen, Create tree from section ausfuehren und bestaetigen, dass nur der gewaehlte Zweig erzeugt wird."
  },
  "ui-document-advisor-na-mapping": {
    title: "KI-Optionen ordnen ein Dokument der richtigen NA zu",
    scenario: "Ein Dokument mit klarem ODE-Bezug wie Systeminformation oder Recruiting auswaehlen, KI-Optionen oeffnen, empfohlene NA pruefen, Dokument einer NA zuordnen ausfuehren und bestaetigen, dass nur der Vorschlag gespeichert wird."
  },
  "ui-document-advisor-create-chantier": {
    title: "KI-Optionen erzeugen ein Chantier unter dem gemappten Level-4-NA",
    scenario: "In einem Workspace mit ODE-NA-Baum ein Dokument mit starkem Level-4-NA-Match auswaehlen, KI-Optionen oeffnen, Create Chantier from AI ausfuehren und pruefen, dass ein neues Level-5-Chantier unter der gemappten NA entsteht, ohne Levels 1-4 zu veraendern."
  },
  "ui-ode-auto-chantier-routing": {
    title: "Dokumenten-WBS schaltet in ODE-Zweigen automatisch in den Chantier-Modus",
    scenario: "Ein strukturiertes Dokument unter einem Level-4-NA oder bestehenden Chantier auswaehlen, Create WBS from document ausfuehren und pruefen, dass ODETool einen chantier-kompatiblen Zweig unter dem richtigen ODE-Ziel statt eines generischen WBS-Containers erzeugt."
  },
  "ui-ode-metadata-backfill": {
    title: "Aeltere ODE-Baeume erhalten ihre Metadaten bei Bedarf zurueck",
    scenario: "Einen aelteren Workspace oeffnen, dessen ODE-Baum vor der Metadaten-Unterstuetzung existierte, ein Dokument oder einen Knoten in diesem Zweig waehlen, eine KI-Aktion ausfuehren und pruefen, dass ODETool den Zweig ohne Neuimport als ODE erkennt."
  },
  "ui-root-enter-creates-top-level-branch": {
    title: "Enter auf der Workspace-Wurzel erzeugt einen sichtbaren Top-Level-Zweig",
    scenario: "Den aktiven Workspace-Wurzelknoten im Baum oder in der Timeline auswaehlen, Enter druecken und pruefen, dass ODETool einen neuen Top-Level-Child in diesem Workspace statt eines unsichtbaren Knotens ausserhalb des Projekt-Scopes erzeugt."
  },
  "ui-workspace-root-branch-actions-stay-scoped": {
    title: "Branch-Aktionen auf der Wurzel bleiben im Workspace",
    scenario: "In einem aktiven Workspace pruefen, dass Ctrl+V ohne Auswahl, Duplicate auf der Workspace-Wurzel und Copy/Paste von der Wurzel sichtbare Knoten innerhalb des Workspace erzeugen, waehrend Cut auf der festen Wurzel blockiert ist."
  },
  "ui-timeline-child-create-actions": {
    title: "Timeline-Child-Erstellung funktioniert mit Tab und Neues Thema",
    scenario: "In der Timeline-Ansicht einen Ordner-Row auswaehlen, Tab druecken und pruefen, dass darunter ein sichtbares Child erstellt wird. Danach per Rechtsklick Neues Thema auf derselben Zeile und auf leerer Timeline-Flaeche bei ausgewaehlter Zeile ausfuehren und pruefen, dass die Erstellung unter dem sichtbaren Timeline-Elternteil bleibt."
  },
  "ui-context-menu-keyboard-default-action": {
    title: "Rechtsklick-Menues unterstuetzen Enter und Tastaturnavigation",
    scenario: "Das Kontextmenue in Baum, Desktop und Timeline oeffnen, pruefen, dass die erste aktive Aktion automatisch fokussiert wird, Enter sie ausfuehrt und Pfeiltasten oder Tab den Fokus verschieben ohne globale Shortcuts ausgeloest."
  },
  "ui-multi-select-context-menu-actions": {
    title: "Rechtsklick behaelt Mehrfachauswahl fuer gemeinsame Aktionen bei",
    scenario:
      "Mehrere Geschwister-Nodes in Baum, Desktop und Timeline auswaehlen, dann auf einen bereits markierten Node rechtsklicken und pruefen, dass die gesamte Auswahl erhalten bleibt, sodass Copy, Cut, Duplicate, Move to Workspace und Delete auf die ganze Auswahl statt nur auf einen Node wirken."
  },
  "ui-desktop-context-menu-default-action-all-views": {
    title: "Desktop Grid, Mind Map und Details teilen dieselbe Standardaktion",
    scenario: "In Desktop Grid, Mind Map und Details auf eine Ordner-Karte oder Zeile rechtsklicken und sofort Enter druecken; pruefen, dass Neues Thema in allen drei Ansichten als erste Standardaktion ausgefuehrt wird."
  },
  "ui-shared-create-routing-across-surfaces": {
    title: "Das Standard-Routing fuer Neues Thema bleibt je Surface konsistent",
    scenario: "Pruefen, dass Neues Thema auf leerer Flaeche im Baum an der Workspace-Wurzel erstellt, in Desktop Grid/Mind Map/Details im aktuellen Ordner und in der Timeline unter der ausgewaehlten sichtbaren Zeile wenn vorhanden; Datei-Ziele muessen ein Geschwister statt eines Kindknotens erzeugen."
  },
  "ui-desktop-filter-descendants-with-optional-parents": {
    title: "Desktop-Filter zeigen Nachfahren mit optionalen Eltern",
    scenario:
      "Aktivieren Sie Empty-, Task- oder Data-Filter in Desktop Grid/Mind Map/Details und pruefen Sie, dass passende Nachfahren aus dem aktuellen Ordner erscheinen, auch wenn direkte Kinder nicht passen; bei deaktiviertem Parents muessen alle Ahnenordner bis zur Wurzel verborgen bleiben, sodass nur direkte Treffer sichtbar sind; schalten Sie Parents um und bestaetigen Sie, dass diese Elternordner bei Bedarf angezeigt werden koennen."
  },
  "ui-timeline-filter-parents-optional": {
    title: "Timeline-Filter koennen Eltern zeigen oder ausblenden",
    scenario:
      "Aktivieren Sie einen oder mehrere Timeline-Statusfilter, einschliesslich des Falls mit allen vier aktiven Status-Pills, und pruefen Sie, dass passende Zeilen sichtbar bleiben; bei deaktiviertem Parents muessen alle Ahnenzeilen bis zur Wurzel verborgen bleiben, selbst wenn dieser Elternknoten selbst einen passenden Status hat; schalten Sie Parents im Timeline-Header um und bestaetigen Sie, dass diese Elternzeilen nur bei aktivierter Option erscheinen."
  },
  "ui-inline-rename-spellcheck": {
    title: "Inline-Umbenennung nutzt das ODE-Rechtschreibmenue",
    scenario: "Starten Sie das Umbenennen im Baum und in der Timeline, tippen Sie ein falsch geschriebenes Wort, klicken Sie im Eingabefeld rechts und pruefen Sie, dass das ODE-Rechtschreibmenue mit Vorschlaegen und Textaktionen statt des nativen Browser- oder Node-Kontextmenues erscheint."
  },
  "tree-ode-protected-level-guard": {
    title: "Geschuetzte ODE-Level blockieren KI-Erstellung oberhalb des Chantier",
    scenario: "Eine nummerierte ODE-Gliederung als Baum importieren, einen geschuetzten Level-1-bis-3-Knoten auswaehlen und pruefen, dass KI-WBS-Erstellung blockiert bleibt, bis ein Level-4-NA-Knoten oder bestehendes Chantier gewaehlt ist."
  }
};

const ES_CHECKLIST_TEXT: ChecklistTextById = {
  "tree-f2-rename": {
    title: "Renombrar con F2 funciona en arbol y filas de timeline",
    scenario: "Seleccione un nodo, pulse F2, cambie el nombre y verifique que numeracion y seleccion se mantienen."
  },
  "tree-enter-new-node": {
    title: "Enter crea un nuevo nodo hermano",
    scenario: "Seleccione un nodo y pulse Enter, luego confirme que aparece un nodo nuevo editable."
  },
  "tree-tab-new-child": {
    title: "Tab crea un nodo hijo",
    scenario: "Seleccione un nodo y pulse Tab, luego verifique que el hijo se crea bajo el padre seleccionado."
  },
  "tree-new-node-auto-scroll": {
    title: "Auto-scroll al nodo creado",
    scenario: "Cree o duplique un nodo cerca del final de la lista y verifique que la vista se desplaza para mostrarlo."
  },
  "desktop-duplicate-consistency": {
    title: "Duplicar crea una sola copia valida",
    scenario: "Duplique nodos en vista grid y detail y confirme una sola copia con numeracion valida."
  },
  "desktop-filter-sync": {
    title: "Los filtros de estado se sincronizan entre vistas",
    scenario: "Cambie EMPTY/TASK/DATA y confirme que arbol, desktop y timeline se actualizan de forma consistente."
  },
  "desktop-filter-logic": {
    title: "Logica de filtros ALL y EMPTY",
    scenario:
      "ALL activa EMPTY/TASK/DATA; EMPTY desactiva TASK/DATA automaticamente; y las carpetas FILLED solo aparecen cuando TASK y DATA estan activos al mismo tiempo, no cuando solo uno lo esta."
  },
  "desktop-upload-targets-current-folder": {
    title: "La subida y el arrastre externo quedan dentro de la carpeta Desktop actual",
    scenario:
      "Abra una carpeta anidada en Desktop y luego importe uno o varios archivos desde el boton del encabezado y arrastrando desde Windows sobre un espacio vacio de Grid/Mind Map/Detail. Verifique que los archivos importados se crean dentro de esa carpeta actual y no en la raiz del workspace."
  },
  "desktop-mindmap-view-toggle": {
    title: "Vista Mind Map y cambio de orientacion",
    scenario: "Cambie entre Grid/Detail/Mind Map y verifique que Horizontal/Vertical se renderiza correctamente."
  },
  "desktop-mindmap-shortcuts-dnd": {
    title: "Mind Map mantiene atajos y comportamiento de arrastrar/soltar",
    scenario: "En modo Mind Map pruebe flechas, seleccion multiple, copy/cut/paste/duplicate y drag/move."
  },
  "desktop-procedure-selection-and-autosave": {
    title: "Sistema usa Nodos, Edicion e Informe manteniendo el autoguardado del contenido",
    scenario:
      "En Desktop > Sistema comience por Nodos, renombre o elija un titulo de seccion, cambie a Edicion, use las herramientas inline para insertar una cita, un separador o un enlace de nodo, escriba contenido y confirme que el contenido guardado del nodo se actualiza sin salir del flujo de 3 acciones."
  },
  "desktop-procedure-title-and-node-links": {
    title: "Informe de Sistema mantiene totales, exportaciones y enlaces entre workspaces alineados",
    scenario:
      "En Desktop > Sistema renombre un titulo desde Nodos, edite el texto y las conexiones en Edicion, inserte un enlace de nodo con @ o el selector desde el workspace actual y otro desde un workspace distinto, agregue un enlace a una herramienta online, abra Informe, verifique que los totales de secciones, secciones documentadas, referencias, conexiones, nodos vinculados y enlaces externos se actualizan para la rama o el workspace actual, exporte el sistema a PDF y DOCX, luego haga clic en los enlaces renderizados y confirme que ODETool selecciona el destino local o cambia al workspace remoto sin romper el flujo de Sistema en 3 acciones."
  },
  "timeline-schedule-next-month": {
    title: "El programador admite el mes siguiente y posteriores",
    scenario: "Abra Task Schedule, avance meses, seleccione fechas futuras, guarde y verifique persistencia."
  },
  "timeline-modal-alignment": {
    title: "El modal Task Schedule esta alineado y con el tema",
    scenario: "Verifique alineacion de etiquetas, campos, date picker y acciones con el tema y espaciado."
  },
  "timeline-scroll-stability": {
    title: "El scroll de timeline se mantiene estable tras copiar/duplicar",
    scenario: "Ejecute copy/duplicate y confirme que el desplazamiento vertical no salta."
  },
  "timeline-status-filter": {
    title: "El filtro de estado actualiza las filas visibles",
    scenario: "Active planned/in-progress/blocked/done y verifique actualizacion inmediata de filas en timeline."
  },
  "timeline-parent-rollup-range": {
    title: "El rango del padre acumula el rango de hijos",
    scenario: "En carpetas padre, verifique inicio = mas temprano de hijos y fin = mas tardio de hijos."
  },
  "timeline-status-no-tooltip": {
    title: "Las pastillas de estado no muestran tooltip del navegador",
    scenario: "Pase el cursor sobre pastillas de estado y confirme que no aparece tooltip del navegador."
  },
  "workspace-move-branch": {
    title: "Move to Workspace funciona para archivos y ramas",
    scenario: "Mueva primero un archivo y luego una rama a otro workspace y verifique eliminacion en origen, insercion en destino, foco en el workspace objetivo y que abrir el archivo sigue funcionando despues del movimiento."
  },
  "workspace-scope-list": {
    title: "La lista de workspace solo muestra creados/importados",
    scenario: "Abra el selector de workspace y confirme que no aparecen nombres de nodos temporales."
  },
  "workspace-root-numbering": {
    title: "La numeracion de raices es opcional",
    scenario: "Desactive numeracion en raices y verifique raices sin numero y hijos con numeracion."
  },
  "workspace-open-folder": {
    title: "Open Folder funciona sin parpadeo de render",
    scenario: "Pulse Open Folder y confirme que el explorador abre directo sin flash visible en la app."
  },
  "workspace-import-compat": {
    title: "Importar carpeta maneja indices versionados de forma segura",
    scenario: "Importe carpeta externa y confirme que no aparece error de deserializacion de revision."
  },
  "workspace-linked-mirror-no-sidecar-context": {
    title: "El espejo del workspace vinculado no crea archivos .ode-context",
    scenario: "Genere o sincronice contenido de arbol dentro de un workspace vinculado y verifique que las carpetas espejo solo contienen carpetas/archivos esperados, sin archivos auxiliares .ode-context."
  },
  "workspace-delete-themed-confirm": {
    title: "Eliminar workspace usa modal con tema ODE",
    scenario: "Elimine workspace y confirme uso de modal ODE, no dialogo nativo del navegador."
  },
  "favorites-quick-access-visible": {
    title: "Quick Access es visible y se llena correctamente",
    scenario: "Agregue favoritos y verifique que Quick Access muestra pestañas y nodos correctamente."
  },
  "favorites-group-create-and-select": {
    title: "Crear grupo una vez y luego seleccionar desde lista",
    scenario: "Cree el primer grupo con + y luego asigne favoritos desde lista sin prompts del navegador."
  },
  "favorites-group-delete": {
    title: "Eliminar grupo favorito limpia correctamente",
    scenario: "Elimine un grupo y verifique que pestañas, mapeos y estado se actualizan sin residuos."
  },
  "favorites-quick-access-tab-layout": {
    title: "El layout de pestanas Quick Access cumple la politica",
    scenario: "Verifique que no hay pestana All antes de + y que las pestanas de grupos quedan en una linea compacta."
  },
  "favorites-quick-access-double-click-open": {
    title: "Quick Access ahora funciona como lanzador con acciones de grupo enfocadas",
    scenario:
      "En Quick Access, haga un solo clic en un favorito de carpeta o archivo y verifique que ODETool lo abre en el espacio de trabajo y cambia a Node Tree. Luego haga clic derecho sobre una tarjeta favorita y confirme que el menu solo muestra acciones de lanzador como Abrir en el espacio, Administrar grupos de acceso rapido, Quitar de acceso rapido y Vista previa del archivo para archivos. Tambien haga clic derecho sobre un encabezado de grupo y sobre el fondo vacio de Quick Access y confirme que esos menus quedan limitados a acciones de grupo como Mostrar grupo, Eliminar grupo y Nuevo grupo."
  },
  "keyboard-clipboard-shortcuts": {
    title: "Atajos copy/cut/paste/delete/duplicate funcionan en todas las vistas",
    scenario: "Pruebe atajos en arbol, desktop y timeline con seleccion activa."
  },
  "keyboard-multi-select": {
    title: "El foco y la multi-seleccion se mantienen con estilo Windows",
    scenario:
      "En arbol, desktop, mind map/details y timeline, verifique que Flecha Arriba/Abajo mueve el foco, Shift+Flecha extiende la seleccion desde el ancla, Ctrl+Flecha mueve el foco sin colapsar la seleccion, Ctrl+Espacio alterna el elemento enfocado y Home/End junto con Ctrl+Home/Ctrl+End saltan correctamente en la superficie activa."
  },
  "ui-help-release-sync": {
    title: "Help y Release Notes se mantienen alineados con funciones publicadas",
    scenario: "Abra Help y Release Notes y verifique documentacion coherente en todos los idiomas soportados."
  },
  "ui-qa-checklist-release-gate": {
    title: "La checklist QA se revisa antes del empaquetado",
    scenario: "Antes de empaquetar EXE/MSI, revise estados y confirme que no quedan escenarios criticos abiertos."
  },
  "ui-single-instance-and-utility-windows": {
    title: "El segundo lanzamiento enfoca la app existente y los paneles utilitarios reutilizan ventanas dedicadas",
    scenario:
      "Con ODETool ya abierto, vuelva a lanzar el EXE y confirme que la ventana principal existente recibe el foco en lugar de abrir una segunda instancia completa. Luego abra Notas de version, Ayuda y Checklist QA desde el pie y confirme que cada uno abre o reutiliza su propia ventana utilitaria."
  },
  "ui-utility-window-controls": {
    title: "Las ventanas utilitarias admiten minimizar, maximizar, restaurar y cerrar",
    scenario:
      "Abra Notas de version, Ayuda y Checklist QA en sus ventanas utilitarias dedicadas y verifique que cada cabecera ofrece minimizar, maximizar/restaurar y cerrar, y que un doble clic en la cabecera tambien alterna entre maximizar y restaurar."
  },
  "ui-main-window-multi-display-move": {
    title: "La ventana principal se mueve correctamente entre varias pantallas",
    scenario:
      "Con dos o mas monitores conectados, arrastre la ventana principal de ODETool de una pantalla a otra estando restaurada y luego repita partiendo de una ventana maximizada. Verifique que la ventana cruza entre pantallas, sigue al puntero, puede maximizarse en la nueva pantalla y despues sigue admitiendo minimizar/restaurar."
  },
  "tree-organization-structure-lock": {
    title: "Las ramas de organizacion pueden bloquearse y desbloquearse desde el arbol",
    scenario:
      "En Organizacion, haga clic derecho en una rama normal que no sea la raiz del workspace y confirme que aparece Bloquear estructura. Bloquee la rama, verifique que el icono de candado aparece en ese nodo y confirme que crear, mover o eliminar nodos dentro de esa rama queda bloqueado. Luego desbloquee la misma rama y confirme que esas ediciones del arbol vuelven a funcionar."
  },
  "ui-qa-evidence-capture-flow": {
    title: "Las pruebas QA admiten imagenes del portapapeles y archivos",
    scenario:
      "Abra la Checklist QA, marque un elemento como fallado y luego use Desde portapapeles y Agregar archivos. Verifique que la prueba se adjunta, se abre al hacer clic y puede eliminarse otra vez sin dejar estado visual residual."
  },
  "ui-qa-checklist-scroll-stability": {
    title: "El desplazamiento de la checklist QA se mantiene estable en mitad de la lista",
    scenario:
      "Abra la Checklist QA, desplácese hasta la mitad, deje de mover la rueda y confirme que la lista no sube ni baja sola. Luego cierre y vuelva a abrir la checklist y confirme que la posición guardada se restaura una sola vez sin iniciar otro bucle de desplazamiento."
  },
  "ui-no-default-browser-context-menu": {
    title: "El menu contextual por defecto del navegador esta bloqueado",
    scenario: "Haga clic derecho en zonas vacias y confirme que solo aparece el menu personalizado de ODE."
  },
  "ui-ai-command-bar-ctrl-k": {
    title: "Ctrl+K abre la Command Bar redisenada",
    scenario: "Abra Command Bar, verifique el nuevo layout y ejecute correctamente el flujo Plan/Confirm."
  },
  "ui-document-advisor-outline-routing": {
    title: "AI Options recomienda importar el esquema numerado",
    scenario: "Seleccione un documento numerado como Tree.txt, confirme que AI Options detecta el esquema, recomienda Import outline as tree y crea ramas reales en lugar del WBS generico."
  },
  "ui-document-advisor-section-tree": {
    title: "La generacion por seccion respeta la seccion elegida",
    scenario: "En AI Options elija una seccion detectada, verifique que cambia la vista previa, ejecute Create tree from section y confirme que solo se genera la rama elegida."
  },
  "ui-document-advisor-na-mapping": {
    title: "AI Options asigna un documento a la NA correcta",
    scenario: "Seleccione un documento con un dominio ODE claro como sistema de informacion o reclutamiento, abra AI Options, confirme la NA recomendada, ejecute Map document to NA y verifique que solo se guarda la sugerencia."
  },
  "ui-document-advisor-create-chantier": {
    title: "AI Options crea un chantier bajo la NA de nivel 4 mapeada",
    scenario: "En un workspace que ya contiene el arbol ODE, seleccione un documento con una coincidencia fuerte de NA de nivel 4, abra AI Options, ejecute Create Chantier from AI y confirme que se crea un nuevo chantier de nivel 5 bajo la NA mapeada sin modificar los niveles 1-4."
  },
  "ui-ode-auto-chantier-routing": {
    title: "El WBS documental cambia automaticamente a modo chantier dentro de ramas ODE",
    scenario: "Seleccione un documento estructurado bajo una NA de nivel 4 o un chantier existente, ejecute Create WBS from document y confirme que ODETool crea una rama compatible con chantier bajo el objetivo ODE correcto en lugar de un contenedor WBS generico."
  },
  "ui-ode-metadata-backfill": {
    title: "Los arboles ODE antiguos recuperan metadatos bajo demanda",
    scenario: "Abra un workspace antiguo cuyo arbol ODE existia antes del soporte de metadatos, seleccione un documento o nodo dentro de esa rama, ejecute una accion IA y confirme que ODETool reconoce la rama como ODE sin requerir una nueva importacion."
  },
  "ui-root-enter-creates-top-level-branch": {
    title: "Enter en la raiz del workspace crea una rama superior visible",
    scenario: "Seleccione el nodo raiz del workspace activo en arbol o timeline, pulse Enter y confirme que ODETool crea un nuevo hijo de primer nivel dentro de ese workspace en lugar de un nodo invisible fuera del scope del proyecto."
  },
  "ui-workspace-root-branch-actions-stay-scoped": {
    title: "Las acciones de rama en la raiz permanecen dentro del workspace",
    scenario: "En un workspace activo, confirme que Ctrl+V sin seleccion, Duplicate sobre la raiz del workspace y copiar/pegar desde la raiz crean nodos visibles dentro del workspace, mientras que Cut sobre la raiz fija queda bloqueado."
  },
  "ui-timeline-child-create-actions": {
    title: "La creacion hija en Timeline funciona con Tab y Nuevo tema",
    scenario: "En la vista Timeline, seleccione una fila carpeta, pulse Tab y verifique que se crea un hijo visible debajo de esa fila. Luego use clic derecho Nuevo tema sobre la misma fila y sobre espacio vacio de Timeline con esa fila seleccionada, y verifique que la creacion permanece bajo el padre visible de Timeline."
  },
  "ui-context-menu-keyboard-default-action": {
    title: "Los menus clic derecho admiten Enter y navegacion por teclado",
    scenario: "Abra el menu contextual en arbol, Desktop y Timeline, verifique que la primera accion habilitada recibe foco automaticamente, que Enter la ejecuta, y que Flechas o Tab mueven el foco sin disparar atajos globales."
  },
  "ui-multi-select-context-menu-actions": {
    title: "El clic derecho conserva la multiseleccion para acciones compartidas",
    scenario:
      "Seleccione varios nodos hermanos en arbol, Desktop y Timeline, luego haga clic derecho sobre uno de los nodos ya seleccionados y verifique que la seleccion completa permanece intacta para que Copy, Cut, Duplicate, Move to Workspace y Delete actuen sobre todo el conjunto seleccionado en lugar de colapsar a un solo nodo."
  },
  "ui-desktop-context-menu-default-action-all-views": {
    title: "Desktop Grid, Mind Map y Details comparten la misma accion por defecto",
    scenario: "En Desktop Grid, Mind Map y Details, haga clic derecho sobre una tarjeta o fila de carpeta y pulse Enter inmediatamente; verifique que Nuevo tema se ejecuta como primera accion por defecto en las tres vistas."
  },
  "ui-shared-create-routing-across-surfaces": {
    title: "El enrutamiento por defecto de Nuevo tema se mantiene coherente por superficie",
    scenario: "Verifique que Nuevo tema sobre espacio vacio crea en la raiz del workspace en arbol, en la carpeta actual en Desktop Grid/Mind Map/Details, y bajo la fila visible seleccionada en Timeline cuando exista; si el objetivo es un archivo debe crear un hermano y no un hijo."
  },
  "ui-desktop-filter-descendants-with-optional-parents": {
    title: "Los filtros Desktop muestran descendientes con padres opcionales",
    scenario:
      "Active filtros Empty, Task o Data en Desktop Grid/Mind Map/Details y verifique que aparecen descendientes coincidentes desde la carpeta actual aunque los hijos directos no coincidan; con Parents desactivado, todas las carpetas ancestro hasta la raiz deben permanecer ocultas para mostrar solo coincidencias directas; cambie Parents y confirme que esas carpetas padre pueden mostrarse a demanda."
  },
  "ui-timeline-filter-parents-optional": {
    title: "Los filtros Timeline pueden mostrar u ocultar padres",
    scenario:
      "Active uno o varios filtros de estado en Timeline, incluido el caso con las cuatro pastillas de estado activas, y verifique que las filas coincidentes siguen visibles; con Parents desactivado, todas las filas ancestro hasta la raiz deben permanecer ocultas incluso si ese padre tambien tiene un estado coincidente; cambie Parents en la cabecera Timeline y confirme que esas filas padre solo aparecen cuando la opcion esta activada."
  },
  "ui-inline-rename-spellcheck": {
    title: "El renombrado inline usa el menu ODE de ortografia",
    scenario: "Inicie un renombrado en arbol y en Timeline, escriba una palabra mal escrita, haga clic derecho dentro del campo y verifique que aparece el menu ODE de ortografia con sugerencias y acciones de texto en lugar del menu nativo del navegador o del menu contextual del nodo."
  },
  "tree-ode-protected-level-guard": {
    title: "Los niveles ODE protegidos bloquean creacion IA por encima del chantier",
    scenario: "Importe un esquema ODE numerado como arbol, seleccione un nodo protegido de nivel 1 a 3 y confirme que la creacion WBS por IA sigue bloqueada hasta seleccionar una NA de nivel 4 o un chantier existente."
  }
};

const CHECKLIST_TEXT_BY_LANGUAGE: Partial<Record<LanguageCode, ChecklistTextById>> = {
  FR: FR_CHECKLIST_TEXT,
  DE: DE_CHECKLIST_TEXT,
  ES: ES_CHECKLIST_TEXT
};

export function getLocalizedRegressionChecklistItem(
  item: RegressionChecklistItem,
  language: LanguageCode
): { area: string; title: string; scenario: string } {
  const localizedText = CHECKLIST_TEXT_BY_LANGUAGE[language]?.[item.id];
  const area = AREA_LABELS[language]?.[item.area] ?? item.area;
  return {
    area,
    title: localizedText?.title ?? item.title,
    scenario: localizedText?.scenario ?? item.scenario
  };
}
