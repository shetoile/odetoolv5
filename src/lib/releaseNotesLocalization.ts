import type { LanguageCode } from "@/lib/i18n";

type ReleaseText = {
  title: string;
  details: string;
};

type ReleaseLogEntryLike = {
  id: string;
  title: string;
  details: string;
};

const FR_RELEASE_TEXT: Record<string, ReleaseText> = {
  "rn-20260309195614": {
    title: "La vue Systeme inclut maintenant mentions, liens de noeuds, relations et propositions IA",
    details:
      "L'edition Systeme permet maintenant d'inserer des liens de noeuds inline via @ ou le selecteur, de garder les relations explicites dans un panneau Connexions a droite, d'ajouter des liens externes courts, de demander une reecriture IA avec acceptation ou refus explicite, et de reutiliser la palette mind-map sur les cartes Systeme et les accents de section. Les exports Copier, PDF et DOCX restent alignes sur le meme contenu redige."
  },
  "rn-20260309191245": {
    title: "La vue Systeme utilise maintenant une mise en page orientee editeur",
    details:
      "L'ancien ecran type publication a ete remanie en espace Systeme centre sur l'editeur : le noeud selectionne reste ouvert au centre, les insertions rapides et liens de noeuds restent dans le rail de contexte a droite, et les actions copier/export restent visibles dans la barre du haut pour une redaction plus rapide et previsible."
  },
  "rn-20260309185239": {
    title: "Les onglets de groupes favoris utilisent maintenant une corbeille pour supprimer",
    details:
      "L'ancienne croix de suppression sur les onglets de groupes favoris a ete remplacee par l'icone corbeille partagee afin que l'action soit lue comme une suppression et non comme une fermeture. Le texte d'aide associe pointe maintenant vers le bouton corbeille de l'onglet."
  },
  "rn-20260309185021": {
    title: "La barre de commande IA inclut maintenant la configuration inline de la cle Mistral",
    details:
      "Un nouvel onglet Parametres IA a ete ajoute directement dans la barre de commande ODE AI pour ajouter, supprimer, tester et enregistrer les cles API Mistral sans quitter le panneau. Les messages d'aide en cas d'absence de cle ont aussi ete mis a jour pour viser cet onglet inline."
  },
  "rn-20260309183357": {
    title: "Les options IA enregistrent maintenant la telemetrie des actions document avec contexte",
    details:
      "Chaque execution d'Options IA ecrit maintenant un evenement structure avec l'action document choisie, la forme detectee, la section selectionnee, la correspondance NA et le suivi de la recommandation. Assistant Activity affiche ce contexte directement, et les revues document lancees depuis Options IA ne doublonnent plus les journaux."
  },
  "rn-20260309093109": {
    title: "La vue Systeme prend maintenant en charge les sections structurees, les relations et l'export PDF ou DOCX",
    details:
      "Desktop > Systeme se comporte maintenant comme un editeur de systeme metier structure : sections en ligne avec apercu, blocs citation/code/separateur ainsi que cartes insight Business, Operations, UX/UI et AI architecture, liens de noeuds entre espaces, relations explicites hors du texte, liens externes courts, puis export direct en PDF ou DOCX."
  },
  "rn-20260308135501": {
    title: "La checklist QA a ete etendue et AI Tester lance plus de controles de regression actifs",
    details:
      "La couverture de regression a ete elargie pour le renommage vide sur nouveau noeud, les filtres Timeline statut + parents, la navigation Backspace vers le parent, la visibilite du Re-sync sur espace lie, l'ouverture Quick Access au double-clic, l'interaction racine de la Mind Map et le nettoyage des connecteurs. AI Tester priorise maintenant les cas a risque elevement automatisables."
  },
  "rn-20260307174741": {
    title: "Les fenetres des panneaux utilitaires prennent maintenant en charge reduire et agrandir",
    details:
      "Les fenetres Notes de version, Aide et Checklist QA utilisent maintenant des controles ODE pour reduire, agrandir/restaurer, fermer et basculer par double-clic sur l'entete, afin de rester coherentes avec la fenetre principale."
  },
  "rn-20260307163928": {
    title: "La capture de preuve QA cible maintenant l'application et les pieces jointes s'ouvrent directement",
    details:
      "Les preuves des elements QA en echec s'ouvrent directement depuis la checklist, la capture d'ecran masque la fenetre utilitaire QA pour capturer l'application principale avant de joindre automatiquement l'image, et les rapports PDF QA enregistres s'ouvrent automatiquement apres creation."
  },
  "rn-20260307144508": {
    title: "Preuves QA, filtres exacts et durcissement du mode desktop en instance unique",
    details:
      "L'export de rapport QA enregistre maintenant un vrai PDF avec raison d'echec et preuve, un second lancement EXE refocalise l'application existante au lieu d'ouvrir une autre instance, et les dossiers FILLED n'apparaissent plus dans les vues filtrees TASK-only ou DATA-only."
  },
  "rn-20260307132356": {
    title: "Les suggestions d'orthographe inline utilisent maintenant le theme ODE",
    details:
      "Le clic droit pendant un renommage inline ouvre maintenant un menu orthographe et edition de texte theme ODE au lieu du menu navigateur natif, avec suggestions multilingues locales ainsi que Couper, Copier, Coller et Tout selectionner."
  },
  "rn-20260307123210": {
    title: "Les vues filtrees, les deplacements d'espace et le renommage inline sont maintenant plus fiables",
    details:
      "Les filtres d'etat peuvent maintenant montrer uniquement les correspondances ou inclure les parents, les vues Grille/Mind Map/Details parcourent le dossier courant au lieu de devenir vides lorsque seuls les descendants correspondent, le filtrage de statut Timeline peut aussi masquer les parents, Move to Workspace bascule vers l'espace cible avant de rafraichir la selection, et le renommage inline active les suggestions natives d'orthographe."
  },
  "rn-20260307112234": {
    title: "Le routage partage de creation reste maintenant coherent entre arbre, desktop et timeline",
    details:
      "Tous les chemins Nouveau sujet, Entree, Tab et creation sans selection utilisent maintenant une seule regle partagee selon la surface : Arbre cree a la racine de l'espace, Desktop dans le dossier courant, Timeline sous la ligne visible selectionnee quand elle existe, et une cible fichier cree un frere au lieu d'un enfant invalide."
  },
  "rn-20260307110544": {
    title: "Les menus clic droit se comportent maintenant comme des menus d'actions pilotes au clavier",
    details:
      "Les menus contextuels donnent maintenant automatiquement le focus a la premiere action disponible, Nouveau sujet devient l'action par defaut sur les dossiers dans arbre, desktop et timeline, et Entree/Fleches/Tab permettent de naviguer et d'executer sans retomber sur les raccourcis globaux."
  },
  "rn-20260307105647": {
    title: "La creation d'enfant dans la timeline suit maintenant la branche timeline visible",
    details:
      "La creation d'enfant par Tab suit maintenant la surface Timeline active, les menus de ligne incluent Nouveau sujet pour une creation directe d'enfant, et le Nouveau sujet sur fond vide respecte le parent timeline visible selectionne au lieu de sortir de la branche."
  },
  "rn-20260307100659": {
    title: "Les raccourcis de branche sur la racine d'espace restent maintenant dans l'espace actif",
    details:
      "Les actions dupliquer, coller et creation clavier sans selection restent maintenant dans le scope du workspace actif afin de rester visibles, et Couper est bloque sur la racine fixe du workspace."
  },
  "rn-20260307095633": {
    title: "Entrer sur la racine d'espace cree maintenant une branche visible de premier niveau",
    details:
      "La creation clavier de frere sur la racine du workspace actif a ete corrigee : Entree cree maintenant un enfant de premier niveau visible dans l'espace courant au lieu d'un noeud invisible hors du scope projet."
  },
  "rn-20260307013958": {
    title: "Les anciens arbres ODE recuperent maintenant leurs metadonnees a la demande",
    details:
      "Quand l'IA touche une ancienne branche ODE creee avant le support metadata, ODETool deduit maintenant le chemin NA a partir des titres et de la profondeur, enregistre les metadonnees ODE manquantes et reutilise ce backfill pour les regles de protection et le routage chantier."
  },
  "rn-20260307012428": {
    title: "Le WBS documentaire ODE bascule maintenant automatiquement en mode chantier",
    details:
      "La generation de WBS a partir d'un document bascule maintenant automatiquement vers des prompts IA compatibles chantier quand la cible est une NA niveau 4 ou un chantier existant, afin de garder le travail ODE dans une vraie structure chantier dynamique."
  },
  "rn-20260307011244": {
    title: "Creation de chantier ODE sous une NA niveau 4 mappee",
    details:
      "L'action Creer un Chantier avec l'IA a ete ajoutee dans AI Options, avec generation IA specifique chantier et fallback securise ODE, resolution des cibles NA niveau 4 mappees dans l'espace actif, et materialisation des racines generees en vrais dossiers chantier."
  },
  "rn-20260307001310": {
    title: "Base de mapping ODE NA et politique de niveaux proteges",
    details:
      "Ajout d'un catalogue ODE NA et de helpers de politique, du mapping document -> NA dans AI Options, de l'enregistrement des suggestions de metadonnees NA sur les documents, et debut de la protection des niveaux 1 a 4 contre les ecritures structurelles generees par l'IA."
  },
  "rn-20260306231905": {
    title: "Conseiller IA document, arbres par section et nettoyage des espaces lies",
    details:
      "Ajout d'AI Options pour les documents selectionnes avec classement des actions, support de la generation d'arbre par section, correction du routage d'action de section, mise a jour de l'Aide et de la QA, et suppression de l'ecriture de fichiers .ode-context dans les miroirs d'espaces lies."
  },
  "rn-20260306101151": {
    title: "Durcissement de la release v1.029 et synchronisation de la discipline QA",
    details:
      "Les guides d'aide ont ete mis a jour en EN/FR/DE/ES, les releases 36 a 38 ont ete ajoutees au journal in-app, la checklist de regression a ete elargie et la couverture du catalogue qualite a ete resynchronisee. Le quality gate complet a ete passe avant l'enregistrement de cette release."
  },
  "rn-20260306001549": {
    title: "Le contenu d'aide est localise pour FR/DE/ES",
    details:
      "Les categories du centre d'aide, les resumes de sujets et les etapes pas a pas sont maintenant localises en francais, allemand et espagnol, avec bascule automatique selon la langue de l'application et repli sur l'anglais."
  },
  "rn-20260306001037": {
    title: "Virtualisation de l'arbre et des details pour les grands jeux de donnees",
    details:
      "Ajout d'un rendu fenetre pour les lignes de l'arbre lateral et des details Desktop, avec spacer virtualization, suivi de selection par auto-scroll et overscan pour garder une interaction fluide sur de tres grandes listes."
  },
  "rn-20260306000518": {
    title: "Passe performance pour les grands arbres et timelines",
    details:
      "Les recherches de fratries cote backend utilisent maintenant des chemins d'aide directs, la navigation clavier reduit les scans lineaires grace aux index maps, et les mises a jour scroll/index de la timeline evitent du rendu redondant."
  },
  "rn-20260305230344": {
    title: "Les retours import/export de package utilisent maintenant des notices themees",
    details:
      "Les alertes navigateur bloquantes lors de l'import/export de packages de noeuds ont ete remplacees par des notices de succes/erreur integrees au theme ODE afin de garder une UX coherente et d'eviter les popups natifs."
  },
  "rn-20260305225108": {
    title: "Durcissement du fallback legacy de l'index des espaces",
    details:
      "Le chargement des workspaces a ete durci face aux anciens enregistrements de revision Surreal Value, la normalisation des chemins de dossier entoures de guillemets a ete ajoutee pour l'import projet, et la couverture de regression a ete elargie avant release."
  },
  "rn-20260305174505": {
    title: "Pipeline de build desktop Tauri et livraison des executables",
    details:
      "Le flux de packaging desktop base sur Tauri a ete confirme, les bundles de production ont ete construits avec succes, un executable applicatif direct et un installeur NSIS ont ete generes, puis livres pour les tests locaux."
  },
  "rn-20260303224236": {
    title: "Durcissement de la persistance d'espace et de la fiabilite de sync",
    details:
      "L'espace actif, le dossier courant et le noeud selectionne sont maintenant persistants entre redemarrages, la liste des espaces n'est plus coupee trop tot avant chargement de l'arbre, la selection d'espace est conservee sur les erreurs transitoires, les espaces restent gardes meme si leur chemin est hors ligne, et le cas de copie miroir sur lui-meme pendant Re-sync a ete corrige."
  },
  "rn-20260303125320": {
    title: "Action manuelle Re-sync de workspace (deux sens)",
    details:
      "Ajout d'un bouton Workspace Re-sync qui lance l'import PC -> app depuis le chemin du workspace selectionne puis la projection app -> PC, limite au workspace actif pour eviter un cout de performance en arriere-plan."
  },
  "rn-20260303120859": {
    title: "La sync projet utilise maintenant la liste d'espaces recuperee",
    details:
      "La projection vers les dossiers projet resout maintenant le mapping root-path via get_projects, la meme source que l'UI, ce qui permet aussi de synchroniser les espaces recuperees ou legacy des changements app vers les chemins PC."
  },
  "rn-20260303114846": {
    title: "Fallback de sync projet via les enregistrements d'espace",
    details:
      "La projection project-path resout maintenant ses cibles depuis les enregistrements d'espace rootNodeId -> rootPath avec repli sur les proprietes de noeud, ce qui renforce la fiabilite lorsque projectPath manque."
  },
  "rn-20260303113306": {
    title: "Sync dossier projet de l'application vers le chemin PC",
    details:
      "Ajout d'une projection sync vers les chemins projet des workspaces importes afin que les dossiers/fichiers crees dans l'application soient ecrits dans le vrai dossier projet du PC, avec suivi des entrees gerees et nettoyage lors des mises a jour ou suppressions."
  },
  "rn-20260303095811": {
    title: "Normalisation de numerotation desktop et projection entre crochets",
    details:
      "Les prefixes de numerotation sur import de dossier projet, par exemple [2], (3), 1.2, sont maintenant normalises avant stockage du nom de noeud, et la projection miroir desktop rend toujours le format [numero] Nom tout en conservant les etiquettes de numerotation de l'application."
  },
  "rn-20260303092619": {
    title: "Correction de creation clavier de noeuds dans les workspaces",
    details:
      "La creation de noeud par Entree/Tab a ete corrigee lorsqu'une racine d'espace est selectionnee ou lorsqu'aucun noeud n'est selectionne dans le scope projet ; les nouveaux noeuds sont maintenant toujours crees dans l'espace actif au lieu d'une racine globale cachee."
  },
  "rn-20260303085339": {
    title: "Initialisation du workflow qualite de base",
    details:
      "Le workflow obligatoire de changement a ete pose : rapport quality gate, boucle de correction des problemes, et entrees de notes de version categorisees et liees au rapport QA."
  },
  "rn-20260310120229": {
    title: "La vue Systeme montre maintenant la couverture de statut et garde les outils de section inline",
    details:
      "Desktop > Systeme garde maintenant les actions lien de noeud, lien externe, citation, separateur et insertions business ou operations directement au-dessus de l'editeur actif, deplace le rail droit vers la vue de statut, les connexions, les liens externes et les sections de branche, et inclut le meme resume de couverture de workspace ou de noeud dans les exports PDF et DOCX."
  },
  "rn-20260311000328": {
    title: "Quick Access se comporte maintenant comme un lanceur avec actions de groupe ciblees",
    details:
      "Les cartes Quick Access ouvrent maintenant le favori selectionne dans le workspace puis basculent vers Node Tree pour un retour clair, tandis que les menus clic droit sont limites aux cartes favorites, en-tetes de groupes et fond vide pour ne montrer que les actions de lancement et de gestion de groupes. L'Aide et la checklist QA ont ete mises a jour pour suivre ce nouveau flux."
  },
  "rn-20260315120000": {
    title: "Precision de recherche, clarte Timeline et onglets Systeme",
    details:
      "La recherche workspace privilegie maintenant les noms et chemins de noeuds visibles plutot que des metadonnees internes bruyantes, la recherche Timeline vise les taches d'execution planifiees tout en filtrant les lignes visibles sur les vraies correspondances, la grille quotidienne a ete allegee avec des frontieres de mois plus chaudes, Desktop > Systeme a ete separe en onglets Objective et Deliverables, les suggestions natives de recherche ont ete desactivees, et l'Aide ainsi que la checklist QA ont ete rafraichies."
  }
};

const DE_RELEASE_TEXT: Record<string, ReleaseText> = {};

Object.assign(DE_RELEASE_TEXT, {
  "rn-20260309195614": {
    title: "Die Systemansicht enthaelt jetzt Mentions, Knotenlinks, Relationen und KI-Vorschlaege",
    details:
      "Die Bearbeitung in System erlaubt jetzt Inline-Knotenlinks ueber @ oder den Picker, haelt explizite Relationen in einem rechten Verbindungsbereich, fuegt kurze externe Links hinzu, fordert KI-Umschreibungen mit klarer Annehmen/Ablehnen-Bestaetigung an und nutzt die bestehende Mind-Map-Farbpalette fuer Systemkarten und Abschnittsakzente. Kopieren sowie PDF- und DOCX-Export bleiben mit demselben verfassten Abschnittsinhalt abgestimmt."
  },
  "rn-20260309191245": {
    title: "Die Systemansicht nutzt jetzt ein editororientiertes Layout",
    details:
      "Der alte veroeffentlichungsartige Bildschirm wurde in einen editororientierten System-Arbeitsbereich umgebaut: Der ausgewaehlte Knoten bleibt im mittleren Editor offen, schnelle Einfuegungen und Knotenlinks liegen in der rechten Kontextleiste, und Kopier-/Exportaktionen bleiben in der oberen Leiste sichtbar, damit das Authoring schneller und berechenbarer ist."
  },
  "rn-20260309185239": {
    title: "Favoritgruppen-Tabs verwenden jetzt ein Papierkorb-Symbol zum Loeschen",
    details:
      "Das einfache x zum Entfernen auf Favoritgruppen-Tabs wurde durch das gemeinsame Papierkorb-Symbol ersetzt, damit die Aktion eindeutig als Loeschen und nicht als Schliessen verstanden wird. Der zugehoerige Hilfetext verweist jetzt ebenfalls auf die Papierkorb-Schaltflaeche im Gruppentab."
  },
  "rn-20260309185021": {
    title: "Die KI-Befehlsleiste enthaelt jetzt die Inline-Einrichtung fuer den Mistral-Schluessel",
    details:
      "Ein neuer Tab KI-Einstellungen wurde direkt in die ODE-AI-Befehlsleiste integriert, damit Nutzer Mistral-API-Schluessel hinzufuegen, entfernen, testen und speichern koennen, ohne das Panel zu verlassen. Auch die Hinweise bei fehlendem Schluessel wurden auf diese Inline-Registerkarte umgestellt."
  },
  "rn-20260309183357": {
    title: "KI-Optionen erfassen jetzt Dokumentaktionen mit Kontext in der Telemetrie",
    details:
      "Jede Ausfuehrung von KI-Optionen schreibt jetzt ein strukturiertes Telemetrie-Ereignis mit der gewaehlten Dokumentaktion, der erkannten Dokumentform, dem ausgewaehlten Abschnitt, dem NA-Treffer und ob der Nutzer der empfohlenen Aktion gefolgt ist. Assistant Activity zeigt diesen Kontext direkt an, und Dokumentpruefungen aus KI-Optionen werden nicht mehr doppelt protokolliert."
  },
  "rn-20260309093109": {
    title: "Die Systemansicht unterstuetzt jetzt strukturierte Abschnitte, Relationen sowie PDF- oder DOCX-Export",
    details:
      "Desktop > System verhaelt sich jetzt wie ein strukturierter Business-System-Editor: Abschnitte schreiben inline mit Live-Vorschau, Zitat-/Code-/Trenner-Muster sowie Insight-Bloecke fuer Business, Operations, UX/UI und KI-Architektur bleiben verfuegbar, gerenderte Knotenlinks koennen ueber Arbeitsbereiche springen, explizite Relationen bleiben ausserhalb des Fliesstexts sichtbar, kurze externe Links koennen zu Tools wie Jira oder SharePoint zeigen, und das zusammengesetzte System kann direkt nach PDF oder DOCX exportiert werden."
  },
  "rn-20260308135501": {
    title: "Die QA-Checkliste wurde erweitert und AI Tester fuehrt mehr aktive Regressionstests aus",
    details:
      "Die juengste Regressionsabdeckung wurde fuer leeres Inline-Umbenennen bei neuen Knoten, Timeline-Filter fuer Status plus Eltern, Backspace-Navigation nach oben, Sichtbarkeit von Re-sync bei verknuepften Arbeitsbereichen, Quick-Access-Doppelklick, Interaktion mit der Mind-Map-Wurzel und Connector-Bereinigung erweitert. AI Tester priorisiert jetzt zuerst gut automatisierbare Hochrisiko-Faelle."
  },
  "rn-20260307174741": {
    title: "Hilfsfenster unterstuetzen jetzt Minimieren und Maximieren",
    details:
      "Die Hilfsfenster fuer Release Notes, Hilfe und QA-Checkliste verwenden jetzt ODE-eigene Minimieren-, Maximieren/Wiederherstellen-, Schliessen- und Kopfzeilen-Doppelklicklogik, damit sie mit dem Hauptfenster konsistent bleiben."
  },
  "rn-20260307163928": {
    title: "QA-Beweiserfassung zielt jetzt auf die App und Anhaenge oeffnen direkt",
    details:
      "QA-Beweise fuer fehlgeschlagene Elemente oeffnen jetzt direkt aus der Checkliste, die Screenshot-Erfassung blendet das QA-Hilfsfenster aus und nimmt stattdessen die Haupt-App auf, bevor das Bild automatisch angehaengt wird, und gespeicherte QA-PDF-Berichte werden nach dem Schreiben automatisch geoeffnet."
  },
  "rn-20260307144508": {
    title: "QA-Belege, exakte Filter und Haertung auf eine einzige Desktop-Instanz",
    details:
      "Der Export von QA-Berichten speichert jetzt eine echte PDF-Datei mit Fehlergrund und Beweis, ein zweiter EXE-Start fokussiert die vorhandene App statt eine neue Instanz zu oeffnen, und FILLED-Ordner tauchen nicht mehr in TASK-only- oder DATA-only-gefilterten Ansichten auf."
  }
});

Object.assign(DE_RELEASE_TEXT, {
  "rn-20260307132356": {
    title: "Inline-Rechtschreibvorschlaege verwenden jetzt das ODE-Design",
    details:
      "Rechtsklick waehrend des Inline-Umbenennens oeffnet jetzt ein ODE-gestyltes Rechtschreib- und Textbearbeitungsmenue statt des nativen Browsermenues, mit lokalen mehrsprachigen Vorschlaegen sowie Ausschneiden, Kopieren, Einfuegen und Alles auswaehlen im selben minimalistischen Stil."
  },
  "rn-20260307123210": {
    title: "Gefilterte Ansichten, Workspace-Verschiebungen und Inline-Umbenennen sind jetzt zuverlaessiger",
    details:
      "Knotenstatus-Filter koennen jetzt nur Treffer anzeigen oder Eltern auf Wunsch einschliessen, Grid, Mind Map und Details durchsuchen den aktuellen Ordner rekursiv statt bei Treffern in Nachfahren leer zu werden, Timeline-Statusfilter koennen ebenfalls Eltern ausblenden, Move to Workspace wechselt vor dem Aktualisieren der Auswahl in den Zielarbeitsbereich, und Inline-Umbenennen aktiviert native Rechtschreibvorschlaege."
  },
  "rn-20260307112234": {
    title: "Gemeinsames Erstellungsrouting bleibt jetzt in Baum, Desktop und Timeline konsistent",
    details:
      "Alle Pfade fuer Neuer Eintrag, Enter, Tab und Erstellen ohne Auswahl verwenden jetzt ein gemeinsames, flaechenbewusstes Routing: Der Baum erstellt an der Workspace-Wurzel, Desktop im aktuellen Ordner, Timeline unter der aktuell sichtbaren ausgewaehlten Zeile, und Datei-Ziele erzeugen Geschwister statt ungueltiger Kinder."
  },
  "rn-20260307110544": {
    title: "Rechtsklick-Menues verhalten sich jetzt wie tastaturgesteuerte Aktionsmenues",
    details:
      "Kontextmenues fokussieren jetzt automatisch die erste verfuegbare Aktion, Neuer Eintrag ist die Standard-Erstaktion auf Ordnern in Baum, Desktop und Timeline, und Enter, Pfeiltasten sowie Tab navigieren und fuehren Aktionen aus, ohne in globale Shortcuts durchzufallen."
  },
  "rn-20260307105647": {
    title: "Timeline-Kinderstellung folgt jetzt dem sichtbaren Timeline-Zweig",
    details:
      "Die Kinderstellung per Tab folgt jetzt der aktiven Timeline-Flaeche, Zeilen-Kontextmenues enthalten Neuer Eintrag fuer direkte Kinderstellung, und Neuer Eintrag auf leerem Timeline-Hintergrund respektiert den sichtbaren ausgewaehlten Timeline-Elternknoten statt aus dem Zweig zu springen."
  },
  "rn-20260307100659": {
    title: "Shortcuts an der Workspace-Wurzel bleiben jetzt im aktiven Workspace",
    details:
      "Duplizieren, Einfuegen und tastaturgestuetzte Erstellung ohne Auswahl bleiben jetzt im Geltungsbereich des aktiven Workspaces sichtbar, und Ausschneiden ist an der festen Workspace-Wurzel blockiert, statt nur eine Bewegung vorzutaeuschen."
  },
  "rn-20260307095633": {
    title: "Enter auf der Workspace-Wurzel erstellt jetzt einen sichtbaren Zweig erster Ebene",
    details:
      "Die Geschwistererstellung per Tastatur an der aktiven Workspace-Wurzel wurde korrigiert: Enter erzeugt jetzt ein sichtbares Kind der obersten Ebene im aktuellen Workspace statt einen unsichtbaren Knoten ausserhalb des Projektbereichs."
  },
  "rn-20260307013958": {
    title: "Aeltere ODE-Baeume fuellen Metadaten jetzt bei Bedarf nach",
    details:
      "Wenn KI einen aelteren ODE-Zweig ohne Metadaten beruehrt, leitet ODETool jetzt den NA-Pfad aus Titeln und Tiefe ab, speichert die fehlenden ODE-Metadaten und verwendet diese Nachfuellung fuer Schutzregeln und chantier-Routing."
  },
  "rn-20260307012428": {
    title: "ODE-bewusster Dokument-WBS wird jetzt automatisch in den chantier-Modus geleitet",
    details:
      "Die WBS-Generierung aus Dokumenten wechselt jetzt automatisch zu chantier-sensitiven KI-Prompts, wenn das Ziel eine NA der Ebene 4 oder ein vorhandener chantier ist, damit ODE-Arbeit in einer dynamischen chantier-Struktur statt in generischen WBS-Behaeltern bleibt."
  },
  "rn-20260307011244": {
    title: "ODE-chantier-Erstellung unter zugeordneter NA der Ebene 4",
    details:
      "Create Chantier from AI wurde zu AI Options hinzugefuegt, chantier-spezifische KI-Generierung mit ODE-sicherem Fallback eingefuehrt, zugeordnete NA-Ziele der Ebene 4 im aktiven Workspace aufgeloest und ODE-generierte Wurzeln als echte chantier-Ordner materialisiert."
  }
});

Object.assign(DE_RELEASE_TEXT, {
  "rn-20260307001310": {
    title: "Grundlage fuer ODE-NA-Mapping und geschuetzte Ebenenrichtlinien",
    details:
      "Ein ODE-NA-Katalog und Richtlinien-Helfer wurden hinzugefuegt, Dokument-zu-NA-Mapping in AI Options eingefuehrt, vorgeschlagene NA-Metadaten auf Dokumenten gespeichert und der Schutz der Ebenen 1 bis 4 vor KI-generierten Struktur-Schreibvorgaengen begonnen."
  },
  "rn-20260306231905": {
    title: "Dokumenten-KI-Berater, Abschnittsbaeume und Bereinigung verknuepfter Workspaces",
    details:
      "AI Options fuer ausgewaehlte Dokumente mit Aktionsranking wurden hinzugefuegt, baumartige Generierung pro Abschnitt aktiviert, das Abschnitts-Routing korrigiert, Hilfe- und QA-Hinweise aktualisiert und verknuepfte Workspace-Spiegel daran gehindert, .ode-context-Sidecar-Dateien zu schreiben."
  },
  "rn-20260306101151": {
    title: "Haertung des Releases v1.029 und Abgleich der QA-Disziplin",
    details:
      "Die Help-Center-Hinweise wurden in EN/FR/DE/ES aktualisiert, die In-App-Release-Logs 36 bis 38 angehaengt, Regressionsszenarien in der Checkliste erweitert und die Abdeckung des Qualitaets-Testkatalogs synchronisiert. Vor dem Festhalten dieses Releases wurde das volle Quality Gate ausgefuehrt."
  },
  "rn-20260306001549": {
    title: "Help-Inhalte jetzt fuer FR/DE/ES lokalisiert",
    details:
      "Kategorien des Help Centers, Themenzusammenfassungen und Schritt-fuer-Schritt-Anleitungen sind jetzt fuer Franzoesisch, Deutsch und Spanisch lokalisiert und wechseln automatisch mit der ausgewaehlten App-Sprache, waehrend Englisch als Fallback erhalten bleibt."
  },
  "rn-20260306001037": {
    title: "Virtualisierung fuer Baum und Detailansicht bei grossen Datenmengen",
    details:
      "Fensterbasiertes Rendering fuer Baumzeilen in der Seitenleiste und Detailzeilen im Desktop wurde hinzugefuegt, mit Spacer-basierter Virtualisierung, Auswahl-Folge-Autoscroll und Overscan-Schwellenwerten fuer fluessige Interaktion in sehr grossen Knotenlisten."
  },
  "rn-20260306000518": {
    title: "Performance-Durchlauf fuer grosse Baeume und Timelines",
    details:
      "Backend-Geschwisterabfragen nutzen jetzt direkte DB-Helferpfade, die Tastaturnavigation reduziert lineare Scans ueber Index-Maps, und Timeline-Scroll-/Index-Updates vermeiden redundante Renderarbeit bei unveraendertem Verhalten."
  },
  "rn-20260305230344": {
    title: "Rueckmeldungen bei Paketimport und -export verwenden jetzt gestaltete Hinweise",
    details:
      "Blockierende Browser-Dialoge beim Import und Export von Knotenpaketen wurden durch In-App-Erfolgs- und Fehlermeldungen ersetzt, damit die UX mit dem ODE-Modaldesign konsistent bleibt und native Popups entfallen."
  },
  "rn-20260305225108": {
    title: "Haertung des Legacy-Fallbacks fuer den Workspace-Index",
    details:
      "Das Laden von Workspaces wurde gegen alte Surreal-Value-Revisionseintraege gehaertet, die Normalisierung von in Anfuehrungszeichen gesetzten Ordnerpfaden fuer den Projektimport hinzugefuegt und die Regressionsabdeckung vor dem Release erweitert."
  },
  "rn-20260305174505": {
    title: "Tauri-Desktop-Build-Pipeline und Bereitstellung der Executables",
    details:
      "Der Tauri-basierte Desktop-Paketierungsfluss wurde bestaetigt, Produktions-Bundles erfolgreich erstellt, eine direkte App-Executable und ein NSIS-Installer erzeugt und fuer lokale Tests bereitgestellt."
  },
  "rn-20260303224236": {
    title: "Haertung von Workspace-Persistenz und Sync-Zuverlaessigkeit",
    details:
      "Aktiver Workspace, aktueller Ordner und ausgewaehlter Knoten bleiben jetzt ueber Neustarts erhalten, die Workspace-Liste wird nicht mehr vor dem Laden des Baums verfrueht beschnitten, die Workspace-Auswahl bleibt bei voruebergehenden Ladefehlern erhalten, Workspaces bleiben sichtbar, selbst wenn ihr Pfad offline ist, und ein Spiegelkopie-Selbstpfadfall waehrend Re-sync wurde behoben."
  }
});

Object.assign(DE_RELEASE_TEXT, {
  "rn-20260303125320": {
    title: "Manuelle Workspace-Re-sync-Aktion in beide Richtungen",
    details:
      "Eine Workspace-Re-sync-Schaltflaeche fuehrt jetzt den Import PC -> App vom ausgewaehlten Workspace-Pfad und danach die Projektion App -> PC aus, begrenzt auf den aktiven Workspace, um Hintergrundkosten zu vermeiden."
  },
  "rn-20260303120859": {
    title: "Projekt-Sync nutzt jetzt die wiederhergestellte Workspace-Liste",
    details:
      "Die Projektion zu Projektordnern loest das Root-Path-Mapping jetzt ueber get_projects auf, also dieselbe Quelle wie die UI, sodass auch wiederhergestellte oder Legacy-Workspaces von App-Aenderungen zu PC-Pfaden synchronisiert werden."
  },
  "rn-20260303114846": {
    title: "Projekt-Sync-Fallback ueber Workspace-Eintraege",
    details:
      "Die Projektpfad-Projektion loest Sync-Ziele jetzt aus Workspace-Eintraegen rootNodeId -> rootPath mit Knoten-Eigenschaften-Fallback auf, was die Zuverlaessigkeit verbessert, wenn projectPath-Metadaten fehlen."
  },
  "rn-20260303113306": {
    title: "Projektordner-Sync von der App zum PC-Pfad",
    details:
      "Eine Projektions-Synchronisierung zu importierten Workspace-Projektpfaden wurde hinzugefuegt, damit in der App erstellte Ordner und Dateien in das echte Projektverzeichnis des PCs geschrieben werden, inklusive Verwaltung der Eintraege und Bereinigung bei Updates oder Loeschungen."
  },
  "rn-20260303095811": {
    title: "Desktop-Nummerierungsnormalisierung und Projektion in Klammern",
    details:
      "Nummerierungspraefixe beim Import von Projektordnern, zum Beispiel [2], (3) oder 1.2, werden jetzt vor dem Speichern des Knotennamens normalisiert, und die Desktop-Spiegelprojektion rendert immer das Format [Nummer] Name, waehrend App-Nummerierungslabels erhalten bleiben."
  },
  "rn-20260303092619": {
    title: "Korrektur fuer Tastatur-Knotenerstellung in Workspaces",
    details:
      "Die Knotenerstellung per Enter und Tab wurde korrigiert, wenn eine Workspace-Wurzel ausgewaehlt ist oder kein Knoten im Projektbereich ausgewaehlt ist; neue Knoten werden jetzt immer im aktiven Workspace statt an einer versteckten globalen Wurzel erstellt."
  },
  "rn-20260303085339": {
    title: "Grundlegender Qualitaets-Workflow initialisiert",
    details:
      "Der verpflichtende Aenderungsablauf wurde eingerichtet: Quality-Gate-Bericht, Schleife zur Fehlerbehebung und kategorisierte Release-Note-Eintraege, die mit dem QA-Bericht verknuepft sind."
  },
  "rn-20260310120229": {
    title: "Die Systemansicht zeigt jetzt Statusabdeckung und behaelt Abschnittswerkzeuge inline",
    details:
      "Desktop > System behaelt jetzt Knotenlink-, Extern-Link-, Zitat-, Trenner- und Business- oder Operations-Einfuegeaktionen direkt ueber dem aktiven Editor, verschiebt die rechte Leiste hin zu Statusuebersicht, Verbindungen, externen Links und Zweigabschnitten und enthaelt dieselbe Workspace- oder Knoten-Abdeckungszusammenfassung im PDF- und DOCX-Export."
  },
  "rn-20260311000328": {
    title: "Quick Access verhaelt sich jetzt wie ein Launcher mit fokussierten Gruppenaktionen",
    details:
      "Quick-Access-Karten oeffnen jetzt den ausgewaehlten Favoriten im Workspace und wechseln fuer einen klaren Rueckweg in den Node Tree, waehrend Rechtsklick-Menues auf Favoritenkarten, Gruppenkoepfe und leeren Hintergrund begrenzt sind. Hilfe und QA-Checkliste wurden aktualisiert, um diesen Ablauf abzubilden."
  },
  "rn-20260315120000": {
    title: "Praezisere Suche, klarere Timeline und System-Tabs",
    details:
      "Die Workspace-Suche bevorzugt jetzt sichtbare Knotennamen und Pfade statt verrauschter interner Metadaten, die Timeline-Suche fokussiert geplante Ausfuehrungsaufgaben und filtert die sichtbaren Zeilen auf exakte Treffer, das taegliche Raster wurde mit waermeren Monatsgrenzen aufgehellt, Desktop > System wurde in Objective- und Deliverables-Tabs aufgeteilt, native Suchvorschlaege wurden deaktiviert und Hilfe plus QA-Checkliste wurden fuer den neuen Ablauf aktualisiert."
  }
});

const ES_RELEASE_TEXT: Record<string, ReleaseText> = {};

Object.assign(ES_RELEASE_TEXT, {
  "rn-20260309195614": {
    title: "La vista Sistema ahora incluye menciones, enlaces de nodos, relaciones y propuestas de IA",
    details:
      "La edicion de Sistema ahora permite insertar enlaces de nodos en linea mediante @ o el selector, mantener relaciones explicitas en un panel de Conexiones a la derecha, agregar enlaces externos cortos, pedir una reescritura de IA con confirmacion explicita de aceptar o rechazar, y reutilizar la paleta de colores del mapa mental en tarjetas de Sistema y acentos de seccion. Copiar y las exportaciones PDF y DOCX siguen alineadas con el mismo contenido redactado."
  },
  "rn-20260309191245": {
    title: "La vista Sistema ahora usa un diseno centrado en el editor",
    details:
      "La antigua pantalla estilo publicacion se rehizo como un espacio Sistema centrado en el editor: el nodo seleccionado permanece abierto en el editor central, las inserciones rapidas y los enlaces de nodos quedan en el riel de contexto derecho, y las acciones de copiar y exportar siguen visibles en la barra superior para que la redaccion sea mas rapida y predecible."
  },
  "rn-20260309185239": {
    title: "Las pestanas de grupos favoritos ahora usan un icono de papelera para eliminar",
    details:
      "La simple x para eliminar en las pestanas de grupos favoritos fue reemplazada por el icono compartido de papelera para que la accion se lea claramente como eliminacion y no como cierre. El texto de ayuda relacionado ahora tambien apunta al boton de papelera de la pestana del grupo."
  },
  "rn-20260309185021": {
    title: "La barra de comandos de IA ahora incluye la configuracion en linea de la clave Mistral",
    details:
      "Se agrego una nueva pestana de Configuracion de IA directamente dentro de la barra de comandos ODE AI para que los usuarios puedan agregar, eliminar, probar y guardar claves API de Mistral sin salir del panel. La orientacion cuando falta una clave tambien se actualizo para apuntar a esa pestana integrada."
  },
  "rn-20260309183357": {
    title: "Las opciones de IA ahora registran telemetria de acciones sobre documentos con contexto",
    details:
      "Cada ejecucion de Opciones de IA ahora escribe un evento de telemetria estructurado con la accion documental elegida, la forma del documento detectada, la seccion seleccionada, la coincidencia NA y si el usuario siguio la accion recomendada. Assistant Activity muestra ese contexto directamente y las revisiones documentales iniciadas desde Opciones de IA ya no generan doble registro."
  },
  "rn-20260309093109": {
    title: "La vista Sistema ahora admite secciones estructuradas, relaciones y exportacion a PDF o DOCX",
    details:
      "Desktop > Sistema ahora se comporta como un editor estructurado de sistema de negocio: las secciones se escriben en linea con vista previa en vivo, siguen disponibles los patrones de cita, codigo y divisor junto con bloques de insight Business, Operations, UX/UI y AI architecture, los enlaces de nodos pueden saltar entre espacios de trabajo, las relaciones explicitas permanecen visibles fuera del texto, los enlaces externos cortos pueden apuntar a herramientas como Jira o SharePoint, y el sistema ensamblado se puede exportar directamente a PDF o DOCX."
  },
  "rn-20260308135501": {
    title: "La checklist de QA se amplio y AI Tester ahora ejecuta mas comprobaciones activas de regresion",
    details:
      "La cobertura reciente de regresion se amplio para el renombrado en blanco al crear nodos, los filtros de Timeline por estado y padres, la navegacion hacia arriba con Backspace, la visibilidad de Re-sync en espacios enlazados, la apertura por doble clic en Quick Access, la interaccion con la raiz del mapa mental y la limpieza de conectores. AI Tester ahora prioriza primero los casos de alto riesgo mas automatizables."
  },
  "rn-20260307174741": {
    title: "Las ventanas de paneles utilitarios ahora admiten minimizar y maximizar",
    details:
      "Las ventanas utilitarias de Notas de version, Ayuda y Checklist de QA ahora usan controles tematicos ODE para minimizar, maximizar/restaurar, cerrar y alternar con doble clic en el encabezado, manteniendose coherentes con la ventana principal."
  },
  "rn-20260307163928": {
    title: "La captura de pruebas QA ahora apunta a la app y los adjuntos se abren directamente",
    details:
      "Las pruebas de elementos QA fallidos ahora se abren directamente desde la checklist, la captura de pantalla oculta la ventana utilitaria de QA y captura la aplicacion principal antes de adjuntar automaticamente la imagen, y los informes PDF guardados de QA se abren solos al terminar."
  },
  "rn-20260307144508": {
    title: "Evidencia QA, filtros exactos y refuerzo del escritorio en instancia unica",
    details:
      "La exportacion del informe QA ahora guarda un PDF real con el motivo del fallo y la prueba, una segunda ejecucion del EXE vuelve a enfocar la aplicacion existente en lugar de abrir otra instancia completa, y las carpetas FILLED ya no aparecen en vistas filtradas TASK-only o DATA-only."
  }
});

Object.assign(ES_RELEASE_TEXT, {
  "rn-20260307132356": {
    title: "Las sugerencias ortograficas en linea ahora usan el tema ODE",
    details:
      "El clic derecho durante el renombrado en linea ahora abre un menu de ortografia y edicion de texto con tema ODE en lugar del menu nativo del navegador, con sugerencias multilingues locales y acciones de Cortar, Copiar, Pegar y Seleccionar todo en el mismo estilo minimalista."
  },
  "rn-20260307123210": {
    title: "Las vistas filtradas, los movimientos de workspace y el renombrado en linea ahora son mas fiables",
    details:
      "Los filtros de estado de nodos ahora pueden mostrar solo coincidencias o incluir padres segun necesidad, Grid, Mind Map y Details recorren recursivamente la carpeta actual en lugar de quedar vacios cuando solo coinciden descendientes, el filtrado de estado en Timeline tambien puede ocultar padres, Move to Workspace cambia primero al espacio objetivo antes de refrescar la seleccion, y el renombrado en linea habilita sugerencias nativas de ortografia."
  },
  "rn-20260307112234": {
    title: "El enrutamiento compartido de creacion ahora se mantiene consistente entre arbol, desktop y timeline",
    details:
      "Todas las rutas de Nuevo tema, Enter, Tab y creacion sin seleccion usan ahora un unico conjunto de reglas segun la superficie: el Arbol crea en la raiz del workspace, Desktop crea en la carpeta actual, Timeline crea bajo la fila visible seleccionada cuando existe, y los objetivos de archivo crean hermanos en lugar de hijos invalidos."
  },
  "rn-20260307110544": {
    title: "Los menus de clic derecho ahora se comportan como menus de acciones guiados por teclado",
    details:
      "Los menus contextuales ahora enfocan automaticamente la primera accion habilitada, Nuevo tema es la primera accion por defecto sobre carpetas en arbol, desktop y timeline, y Enter, las flechas y Tab permiten navegar y ejecutar acciones sin caer en atajos globales."
  },
  "rn-20260307105647": {
    title: "La creacion de hijos en Timeline ahora sigue la rama visible de la timeline",
    details:
      "La creacion de hijos con Tab ahora sigue la superficie Timeline activa, los menus contextuales de fila incluyen Nuevo tema para crear hijos directamente, y Nuevo tema sobre el fondo vacio de Timeline respeta el padre visible seleccionado en lugar de salir de la rama."
  },
  "rn-20260307100659": {
    title: "Los atajos en la rama raiz del workspace ahora permanecen dentro del workspace activo",
    details:
      "Duplicar, pegar y crear sin seleccion mediante teclado ahora se mantienen dentro del alcance del workspace activo para seguir siendo visibles, y Cortar esta bloqueado en la raiz fija del workspace en lugar de simular un movimiento."
  },
  "rn-20260307095633": {
    title: "Enter en la raiz del workspace ahora crea una rama visible de primer nivel",
    details:
      "Se corrigio la creacion de hermanos por teclado en la raiz del workspace activo: Enter ahora crea un hijo visible de primer nivel dentro del workspace actual en lugar de un nodo invisible fuera del alcance del proyecto."
  },
  "rn-20260307013958": {
    title: "Los arboles ODE antiguos ahora completan metadatos bajo demanda",
    details:
      "Cuando la IA toca una rama ODE antigua creada antes del soporte de metadatos, ODETool ahora infiere la ruta NA a partir de los titulos y la profundidad, guarda los metadatos ODE faltantes y reutiliza ese backfill para reglas de proteccion y enrutamiento de chantier."
  },
  "rn-20260307012428": {
    title: "El WBS documental consciente de ODE ahora se enruta automaticamente al modo chantier",
    details:
      "La generacion de WBS basada en documentos cambia ahora automaticamente a prompts de IA sensibles a chantier cuando el destino es una NA de nivel 4 o un chantier existente, para mantener el trabajo ODE dentro de una estructura chantier dinamica y no en contenedores WBS genericos."
  },
  "rn-20260307011244": {
    title: "Creacion de chantier ODE bajo una NA de nivel 4 mapeada",
    details:
      "Se agrego Create Chantier from AI dentro de AI Options, se introdujo una generacion de IA especifica para chantier con fallback seguro ODE, se resolvieron objetivos NA de nivel 4 mapeados dentro del workspace activo y las raices generadas por ODE se materializan como carpetas chantier reales."
  }
});

Object.assign(ES_RELEASE_TEXT, {
  "rn-20260307001310": {
    title: "Base para el mapeo ODE NA y la politica de niveles protegidos",
    details:
      "Se agrego un catalogo ODE NA y helpers de politica, se introdujo el mapeo documento -> NA en AI Options, se guardaron metadatos sugeridos de NA en documentos y se comenzo a proteger los niveles 1 a 4 frente a escrituras estructurales generadas por IA."
  },
  "rn-20260306231905": {
    title: "Asesor IA de documentos, arboles por seccion y limpieza de workspaces enlazados",
    details:
      "Se agregaron AI Options para documentos seleccionados con ranking de acciones, se habilito la generacion de arboles por seccion, se corrigio la ruta de acciones de seccion, se actualizaron Ayuda y QA, y se impidio que los espejos de workspaces enlazados escriban archivos laterales .ode-context."
  },
  "rn-20260306101151": {
    title: "Refuerzo del lanzamiento v1.029 y sincronizacion de la disciplina QA",
    details:
      "Se actualizaron las guias del Help Center en EN/FR/DE/ES, se anadieron los registros internos 36 a 38, se ampliaron los escenarios de regresion y se sincronizo la cobertura del catalogo de calidad. Se ejecuto la compuerta completa de calidad antes de registrar este lanzamiento."
  },
  "rn-20260306001549": {
    title: "El contenido de Ayuda ahora esta localizado para FR/DE/ES",
    details:
      "Las categorias del Help Center, los resumenes de temas y las guias paso a paso ahora estan localizados para frances, aleman y espanol, y cambian automaticamente con el idioma seleccionado de la aplicacion manteniendo el ingles como respaldo."
  },
  "rn-20260306001037": {
    title: "Virtualizacion del arbol y de detalles para conjuntos de datos grandes",
    details:
      "Se agrego renderizado por ventanas para las filas del arbol lateral y las filas de Desktop Details, con virtualizacion basada en espaciadores, auto-scroll que sigue la seleccion y umbrales de overscan para mantener interaccion fluida en listas de nodos muy grandes."
  },
  "rn-20260306000518": {
    title: "Pase de rendimiento para arboles y timelines grandes",
    details:
      "Las busquedas de hermanos en backend ahora usan rutas auxiliares directas a BD, la navegacion por teclado reduce recorridos lineales mediante mapas de indices, y las actualizaciones de scroll e indice en Timeline reducen trabajo de render redundante manteniendo el comportamiento existente."
  },
  "rn-20260305230344": {
    title: "La retroalimentacion de importacion y exportacion de paquetes ahora usa avisos tematicos",
    details:
      "Las alertas bloqueantes del navegador en la importacion y exportacion de paquetes de nodos fueron reemplazadas por avisos internos de exito y error para mantener la UX coherente con el tema modal de ODE y evitar interrupciones de popups nativos."
  },
  "rn-20260305225108": {
    title: "Refuerzo del fallback heredado del indice de workspaces",
    details:
      "La carga de workspaces se endurecio frente a registros heredados de revision Surreal Value, se agrego la normalizacion de rutas de carpetas entrecomilladas para la importacion de proyectos y se amplio la cobertura de regresion antes del lanzamiento."
  },
  "rn-20260305174505": {
    title: "Pipeline de build desktop con Tauri y entrega de ejecutables",
    details:
      "Se confirmo el flujo de empaquetado desktop basado en Tauri, se construyeron correctamente los bundles de produccion, se generaron un ejecutable directo de la app y un instalador NSIS, y se entregaron ejecutables listos para pruebas locales."
  },
  "rn-20260303224236": {
    title: "Refuerzo de la persistencia del workspace y de la fiabilidad de sincronizacion",
    details:
      "El workspace activo, la carpeta actual y el nodo seleccionado ahora persisten entre reinicios, se evita recortar la lista de workspaces antes de cargar el arbol, se mantiene la seleccion de workspace ante errores transitorios de carga, los workspaces siguen visibles aunque su ruta este sin conexion, y se corrigio un caso limite de auto-ruta en la copia espejo durante Re-sync."
  }
});

Object.assign(ES_RELEASE_TEXT, {
  "rn-20260303125320": {
    title: "Accion manual de Re-sync de workspace en dos sentidos",
    details:
      "Se agrego un boton Workspace Re-sync que ejecuta la importacion PC -> app desde la ruta del workspace seleccionado y luego la proyeccion app -> PC, limitado al workspace activo para evitar impacto de rendimiento en segundo plano."
  },
  "rn-20260303120859": {
    title: "La sincronizacion del proyecto ahora usa la lista recuperada de workspaces",
    details:
      "La proyeccion al directorio del proyecto ahora resuelve el mapeo root-path mediante get_projects, la misma fuente que usa la UI, de modo que los workspaces recuperados o heredados tambien se sincronizan desde los cambios en la app hacia las rutas del PC."
  },
  "rn-20260303114846": {
    title: "Fallback de sincronizacion del proyecto mediante registros de workspace",
    details:
      "La proyeccion project-path ahora resuelve destinos de sincronizacion desde registros de workspace rootNodeId -> rootPath con fallback a propiedades del nodo, mejorando la fiabilidad cuando faltan metadatos projectPath."
  },
  "rn-20260303113306": {
    title: "Sincronizacion de carpetas de proyecto desde la app hacia la ruta del PC",
    details:
      "Se agrego una sincronizacion por proyeccion hacia rutas de proyecto de workspaces importados para que carpetas y archivos creados en la app se escriban en el directorio real del proyecto en el PC, con seguimiento de entradas gestionadas y limpieza ante actualizaciones o eliminaciones."
  },
  "rn-20260303095811": {
    title: "Normalizacion de numeracion en Desktop y proyeccion entre corchetes",
    details:
      "Los prefijos de numeracion al importar carpetas de proyecto, por ejemplo [2], (3) o 1.2, ahora se normalizan antes de almacenar los nombres de nodos, y la proyeccion espejo de Desktop siempre muestra el formato [numero] Nombre mientras conserva las etiquetas de numeracion de la app."
  },
  "rn-20260303092619": {
    title: "Correccion de la creacion de nodos por teclado en workspaces",
    details:
      "Se corrigio la creacion de nodos con Enter y Tab cuando esta seleccionada una raiz de workspace o no hay nodo seleccionado dentro del alcance del proyecto; los nodos nuevos ahora siempre se crean dentro del workspace activo en lugar de una raiz global oculta."
  },
  "rn-20260303085339": {
    title: "Inicializacion del flujo base de calidad",
    details:
      "Se establecio el flujo obligatorio de cambios: informe de quality gate, bucle de correccion de incidencias y entradas de release notes categorizadas y enlazadas al informe QA."
  },
  "rn-20260310120229": {
    title: "La vista Sistema ahora muestra cobertura de estado y mantiene herramientas de seccion en linea",
    details:
      "Desktop > System ahora mantiene acciones de enlace de nodos, enlace externo, cita, divisor e inserciones de business u operations justo encima del editor activo, desplaza el riel derecho hacia el resumen de estado, conexiones, enlaces externos y secciones de rama, e incluye el mismo resumen de cobertura de workspace o nodo en la exportacion PDF y DOCX."
  },
  "rn-20260311000328": {
    title: "Quick Access ahora se comporta como un lanzador con acciones de grupo enfocadas",
    details:
      "Las tarjetas de Quick Access ahora abren el favorito seleccionado dentro del workspace y cambian a Node Tree para ofrecer un camino de regreso claro, mientras que los menus de clic derecho se limitan a tarjetas favoritas, cabeceras de grupo y fondo vacio. La guia de Ayuda y la checklist de QA se actualizaron para seguir este nuevo flujo."
  },
  "rn-20260315120000": {
    title: "Precision de busqueda, claridad de Timeline y pestanas de System",
    details:
      "La busqueda del workspace ahora prioriza nombres y rutas visibles de nodos sobre metadatos internos ruidosos, la busqueda en Timeline se centra en tareas de ejecucion programadas filtrando el conjunto de filas visibles a coincidencias exactas, la cuadricula diaria se suavizo con limites mensuales mas calidos, Desktop > System se dividio en pestanas Objective y Deliverables, se desactivaron las sugerencias nativas de busqueda y se actualizaron Ayuda y Checklist QA para el nuevo flujo."
  }
});

const RELEASE_TEXT_BY_LANGUAGE: Partial<Record<LanguageCode, Record<string, ReleaseText>>> = {
  FR: FR_RELEASE_TEXT,
  DE: DE_RELEASE_TEXT,
  ES: ES_RELEASE_TEXT
};

export function getLocalizedReleaseText(
  language: LanguageCode,
  entry: ReleaseLogEntryLike
): ReleaseText {
  return RELEASE_TEXT_BY_LANGUAGE[language]?.[entry.id] ?? {
    title: entry.title,
    details: entry.details
  };
}
