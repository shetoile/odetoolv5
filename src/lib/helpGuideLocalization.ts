import type { LanguageCode } from "@/lib/i18n";

export type HelpGuideTopic = {
  title: string;
  summary: string;
  steps: string[];
};

export type HelpGuideCategory = {
  category: string;
  topics: HelpGuideTopic[];
};

const HELP_GUIDE_LOCALIZED: Partial<Record<LanguageCode, HelpGuideCategory[]>> = {
  FR: [
    {
      category: "Espaces et sources",
      topics: [
        {
          title: "Creer ou importer un espace",
          summary: "Commencez dans Parametres d'espace et liez un vrai dossier si besoin.",
          steps: [
            "Ouvrez Parametres d'espace depuis la barre du haut.",
            "Utilisez Creer Espace pour un arbre interne, ou Importer dossier/Parcourir pour un chemin existant.",
            "Cliquez Definir par defaut pour ouvrir cet espace automatiquement au prochain lancement."
          ]
        },
        {
          title: "Ouvrir vite le dossier lie",
          summary: "Accedez directement au dossier de l'espace dans l'Explorateur Windows.",
          steps: [
            "Ouvrez Parametres d'espace.",
            "Cliquez Ouvrir dossier dans les actions de l'espace.",
            "Utilisez-le pour des operations fichiers hors ODETool."
          ]
        },
        {
          title: "Recuperer la liste des espaces si chargement en echec",
          summary: "L'index des espaces peut reconstruire les racines meme avec des enregistrements legacy.",
          steps: [
            "Ouvrez Parametres d'espace et verifiez les groupes lie/interne.",
            "Si necessaire, cliquez Reparer index des espaces pour recreer les entrees manquantes.",
            "Les chemins importes sont compares apres normalisation; les chemins entre guillemets sont acceptes."
          ]
        }
      ]
    },
    {
      category: "Structure arborescente et edition",
      topics: [
        {
          title: "Creer et structurer les noeuds rapidement",
          summary: "Utilisez surtout le clavier pour construire vite la hierarchie parent/enfant.",
          steps: [
            "Entree cree un frere apres le noeud selectionne; sur la racine du workspace, elle cree une nouvelle branche de premier niveau dans ce workspace.",
            "Tab cree un enfant; en Timeline il cree l'enfant sous la ligne selectionnee et clic droit Nouveau sujet sur une ligne suit la meme regle.",
            "Shift+Entree cree un frere avant.",
            "Ctrl+Entree cree un parent au-dessus du noeud selectionne.",
            "Les menus clic droit donnent maintenant le focus a la premiere action; utilisez Entree pour l'executer et Fleches ou Tab pour naviguer.",
            "Nouveau sujet sur une zone vide suit des regles stables : Arbre = racine du workspace, Desktop = dossier courant, Timeline = ligne visible selectionnee quand elle existe."
          ]
        },
        {
          title: "Renommer, copier, deplacer, supprimer",
          summary: "Toutes les operations de branche existent au clavier et dans le menu contextuel.",
          steps: [
            "F2 renomme le noeud selectionne.",
            "Pendant le renommage, clic droit ouvre le menu ODE d'orthographe avec suggestions themees ainsi que Couper, Copier, Coller et Tout selectionner.",
            "Ctrl+C/Ctrl+V/Ctrl+D restent dans le workspace actif; Ctrl+X est bloque sur la racine fixe du workspace.",
            "Suppr retire les noeuds selectionnes; clic droit propose Deplacer vers espace."
          ]
        }
      ]
    },
    {
      category: "Bureau et operations fichiers",
      topics: [
        {
          title: "Importer et ouvrir des fichiers",
          summary: "La vue Bureau supporte upload, glisser-deposer, et actions Windows natives.",
          steps: [
            "Utilisez Upload dans l'en-tete Bureau ou glissez des fichiers depuis l'Explorateur.",
            "Clic droit sur un fichier pour Ouvrir, Ouvrir avec, Ouvrir emplacement, ou Copier chemin complet.",
            "Les fichiers restent miroires dans le dossier ODE et l'etat de sync est visible en bas."
          ]
        },
        {
          title: "Utiliser les filtres d'etat de noeud",
          summary: "Filtrez par Empty, Task, et Data depuis la barre du bas.",
          steps: [
            "All active tous les etats.",
            "Empty selectionne seulement Empty et retire les autres filtres.",
            "Task et Data peuvent etre actives seuls ou ensemble.",
            "Parents choisit si les descendants correspondants gardent leurs dossiers parents visibles.",
            "Quand un filtre est actif, Desktop Grille/Mind Map/Details parcourt maintenant le dossier courant pour afficher aussi les descendants correspondants."
          ]
        },
        {
          title: "Passer en vue Mind Map pour planifier la structure",
          summary: "Desktop propose Grille, Details, et Mind Map avec orientation horizontale/verticale.",
          steps: [
            "Utilisez le selecteur de vue Desktop pour ouvrir le mode Mind Map.",
            "Basculez l'orientation Horizontal/Vertical selon votre logique de planification.",
            "Les raccourcis clavier et actions glisser/deplacer restent alignes avec arbre et timeline."
          ]
        },
        {
          title: "Construire le systeme inline",
          summary: "Systeme regroupe redaction de sections, liens de noeuds, contexte et export dans un espace rapide.",
          steps: [
            "Passez la vue Desktop sur Systeme.",
            "Utilisez Noeuds pour choisir la section et renommer son titre avant la redaction.",
            "Ouvrez Edition pour rediger, inserer des liens de noeud ou externes, et garder les connexions au meme endroit.",
            "Les changements s'enregistrent automatiquement et Ctrl+S force l'enregistrement.",
            "Ecrivez directement dans la section : paragraphes courts, listes, citations `>`, blocs de code, separateurs `---`, et sections `[insight:business|operations|ux|ai]`.",
            "Tapez `@` dans l'editeur pour mentionner un noeud inline, ou utilisez Lier un noeud / Ctrl+Shift+K pour le selecteur.",
            "Les liens de noeud peuvent viser l'espace courant ou un autre espace ; cliquer une pastille de lien rendue navigue vers ce noeud.",
            "Ouvrez Rapport pour verifier les totaux de sections, documentation, references, connexions, noeuds lies et liens externes.",
            "Copier le systeme exporte le texte assemble, et Export PDF / Export Word enregistrent une version partageable du meme systeme."
          ]
        }
      ]
    },
    {
      category: "Timeline et planification",
      topics: [
        {
          title: "Planifier les taches sur la timeline",
          summary: "Definissez planning, statut, et predecesseur directement depuis les noeuds.",
          steps: [
            "Passez sur l'onglet Timeline.",
            "Ouvrez Planifier tache depuis le menu contextuel ou l'action de ligne timeline.",
            "Definissez debut/fin, statut, predecesseur, puis enregistrez.",
            "Utilisez la puce Parents dans l'entete Timeline pour choisir si les lignes parentes restent visibles pendant le filtrage par statut."
          ]
        },
        {
          title: "Comprendre le comportement des plannings",
          summary: "Timeline et arbre restent synchronises avec des dates stables sur mois et annees.",
          steps: [
            "En mode auto, le planning parent reprend le debut le plus tot et la fin la plus tardive des enfants.",
            "Le date picker permet d'aller sur les prochains mois/annees et de sauvegarder correctement.",
            "Les couleurs de statut et barres semaine refletent planned/active/blocked/done.",
            "Utilisez la navigation par annee dans l'entete timeline pour les plans longs."
          ]
        }
      ]
    },
    {
      category: "Favoris et acces rapide",
      topics: [
        {
          title: "Utiliser Acces rapide comme lanceur",
          summary: "Acces rapide sert maintenant a ouvrir vite le travail, pas a editer sur place.",
          steps: [
            "Ouvrez Acces rapide dans Desktop > Mind Map.",
            "Cliquez une fois sur une carte favorite pour ouvrir ce dossier ou fichier dans le workspace et basculer vers Node Tree.",
            "Utilisez le switch Acces rapide / Node Tree dans l'entete pour passer du lanceur a la vue de travail.",
            "Faites clic droit sur un favori fichier si vous voulez Apercu du fichier au lieu de travailler directement depuis l'arbre."
          ]
        },
        {
          title: "Organiser les groupes favoris sans toucher a l'arbre",
          summary: "Utilisez des actions Acces rapide ciblees pour grouper, deplacer et retirer des favoris.",
          steps: [
            "Creez un groupe avec + dans le panneau Acces rapide de la barre laterale ou par clic droit sur un fond vide Acces rapide dans Mind Map puis Nouveau groupe.",
            "Faites clic droit sur une carte favorite pour Ouvrir dans l'espace, Gerer les groupes d'acces rapide, ou Retirer de l'acces rapide ; les fichiers montrent aussi Apercu du fichier.",
            "Glissez une carte favorite sur un groupe pour la deplacer rapidement, ou utilisez Gerer les groupes d'acces rapide si vous voulez plusieurs affectations.",
            "Faites clic droit sur un en-tete de groupe pour Afficher le groupe ou Supprimer le groupe."
          ]
        }
      ]
    },
    {
      category: "Actions IA et barre de commandes",
      topics: [
        {
          title: "Barre de commandes (Ctrl+K)",
          summary: "Selectionnez les fichiers du noeud puis ouvrez Aide IA, Structure arbre, Livrables, ou Plan depuis un panneau minimal.",
          steps: [
            "Appuyez sur Ctrl+K pour ouvrir la barre de commandes.",
            "Utilisez le bouton fichiers dans l'entete du noeud pour choisir les fichiers que l'IA doit lire.",
            "Lancez Aide IA ou Revoir fichiers pour obtenir une reponse fondee sur les fichiers selectionnes.",
            "Lancez Structure arbre pour ouvrir une proposition d'arbre editable avant validation.",
            "Lancez Livrables pour preparer seulement les livrables du noeud et les modifier avant validation.",
            "Lancez Plan pour preparer ensemble les livrables et les taches chantier dans une seule proposition editable."
          ]
        },
        {
          title: "Options IA documentaires",
          summary: "Selectionnez d'abord un fichier puis laissez ODETool recommander l'action IA la plus fiable.",
          steps: [
            "Selectionnez un fichier lisible dans l'arbre ou le Desktop.",
            "Cliquez Options IA dans le header principal pour voir les signaux detectes, l'action recommandee, et les sections detectees.",
            "Quand Creer un WBS depuis le document s'execute dans une NA niveau 4 ou dans un chantier existant, ODETool bascule maintenant automatiquement en mode chantier au lieu d'utiliser un prompt WBS generique.",
            "Les anciens arbres ODE sont maintenant retro-renseignes a la demande : si une branche correspond a la NA par ses titres et sa profondeur, ODETool enregistre les metadonnees ODE manquantes avant de generer du travail.",
            "Utilisez Creer un Chantier avec l'IA quand le document correspond clairement a une NA de niveau 4 et doit ouvrir un Chantier niveau 5, Mapper le document vers une NA pour classifier le contenu dans ODE, Importer le plan en arbre pour les plans numerotes, Creer un arbre depuis la section pour une extraction ciblee, ou Creer un WBS depuis le document quand l'IA doit deduire la structure.",
            "Les revues documentaires retournent des citations de preuve au format [numero|nom].",
            "Configurez la cle API Mistral dans l'onglet Parametres IA pour les revues et WBS generes par l'IA."
          ]
        }
      ]
    },
    {
      category: "Discipline qualite et release",
      topics: [
        {
          title: "Executer la QA avant packaging",
          summary: "Gardez l'application stable avec checklist QA et quality gate.",
          steps: [
            "Ouvrez la Checklist QA depuis le footer et passez chaque scenario de bug discute.",
            "Marquez chaque scenario en Valide/Echec/En attente et corrigez les echec avant packaging.",
            "Lancez mock tests et checks type/build depuis commandes ou scripts npm.",
            "Consultez les rapports dans quality/reports.",
            "Ne packagez un nouvel EXE/MSI qu'apres un passage QA reussi."
          ]
        },
        {
          title: "Tracer les changements",
          summary: "Utilisez Release Notes comme source historique de reference.",
          steps: [
            "Ouvrez Release Notes depuis la barre du bas.",
            "Revoyez par date, version, categorie, et details.",
            "Gardez Aide et checklist QA alignees avec les mises a jour release."
          ]
        }
      ]
    },
    {
      category: "Raccourcis clavier (base)",
      topics: [
        {
          title: "Standard de comportement Windows",
          summary: "Arbre, Desktop, Mind Map, Details et Timeline suivent un seul contrat d'interaction.",
          steps: [
            "La surface que vous cliquez devient proprietaire des actions clavier jusqu'a ce que le focus change.",
            "Les fleches deplacent le focus, Shift+Fleche etend la selection, Ctrl+Fleche conserve la selection en deplacant le focus, et Ctrl+Espace bascule l'element focalise.",
            "Home/End sautent dans la surface active, et Ctrl+Home/Ctrl+End vont au premier ou dernier element visible.",
            "Les etats focalise, selectionne et en edition restent visuellement differents pour montrer ou le clavier et le presse-papiers s'appliquent."
          ]
        },
        {
          title: "Navigation et selection",
          summary: "Deplacez-vous dans arbre, grille desktop, et timeline au clavier.",
          steps: [
            "Les fleches deplacent le focus sur la surface active; Shift+Fleche etend la plage depuis l'ancre courante.",
            "Ctrl+Fleche deplace le focus sans effacer la selection courante.",
            "Ctrl+Espace bascule l'element focalise sans le deplacer.",
            "Home/End vont a la premiere/derniere ligne visible, et Ctrl+Home/Ctrl+End vont au premier/dernier element visible.",
            "Ctrl+A selectionne tout sur la surface active."
          ]
        },
        {
          title: "Edition et presse-papiers",
          summary: "L'edition rapide marche mieux quand aucun modal n'est ouvert.",
          steps: [
            "F2 renommer, Entree/Tab creer la structure, Suppr supprimer la selection.",
            "Ctrl+S valide un renommage inline, et Echap annule le renommage ou efface la coupe en attente quand aucun texte n'est en cours d'edition.",
            "Pendant un renommage inline, clic droit utilise le menu ODE d'orthographe au lieu du menu natif du navigateur.",
            "Dans le champ de renommage, l'edition texte native reste active pour Ctrl+Z/Ctrl+Y/Ctrl+C/Ctrl+X/Ctrl+V/Ctrl+A.",
            "Hors renommage, Ctrl+C/Ctrl+V/Ctrl+D pour copier/coller/dupliquer dans la surface active; Ctrl+X reste bloque sur la racine fixe du workspace."
          ]
        }
      ]
    }
  ],
  DE: [
    {
      category: "Workspaces und Quellen",
      topics: [
        {
          title: "Workspace erstellen oder importieren",
          summary: "Starten Sie in den Workspace-Einstellungen und verknuepfen Sie bei Bedarf einen echten Ordner.",
          steps: [
            "Oeffnen Sie Workspace-Einstellungen in der oberen Leiste.",
            "Nutzen Sie Workspace erstellen fuer eine interne Struktur, oder Ordner importieren/Durchsuchen fuer einen vorhandenen Pfad.",
            "Setzen Sie Als Standard, damit dieser Workspace beim naechsten Start zuerst geoeffnet wird."
          ]
        },
        {
          title: "Verknuepften Ordner schnell oeffnen",
          summary: "Springen Sie direkt in den Workspace-Ordner im Windows Explorer.",
          steps: [
            "Oeffnen Sie Workspace-Einstellungen.",
            "Klicken Sie auf Ordner oeffnen bei den Workspace-Aktionen.",
            "Nutzen Sie dies fuer Dateivorgaenge ausserhalb von ODETool."
          ]
        },
        {
          title: "Workspace-Liste bei Ladefehler wiederherstellen",
          summary: "Der Workspace-Index kann Root-Ordner auch bei defekten Legacy-Daten rekonstruieren.",
          steps: [
            "Oeffnen Sie Workspace-Einstellungen und pruefen Sie die Listen linked/internal.",
            "Falls noetig, klicken Sie Index reparieren, um fehlende Eintraege neu aufzubauen.",
            "Importierte Pfade werden normalisiert verglichen; Pfade in Anfuehrungszeichen werden akzeptiert."
          ]
        }
      ]
    },
    {
      category: "Baumstruktur und Bearbeitung",
      topics: [
        {
          title: "Knoten schnell erstellen und strukturieren",
          summary: "Mit Tastaturaktionen bauen Sie Eltern/Kind-Hierarchien schneller auf.",
          steps: [
            "Enter erstellt ein Geschwister nach dem ausgewaehlten Knoten; auf der Workspace-Wurzel entsteht stattdessen ein neuer Top-Level-Zweig in diesem Workspace.",
            "Tab erstellt ein Kind; in der Timeline entsteht es unter der ausgewaehlten Zeile und Rechtsklick Neues Thema auf einer Zeile folgt derselben Regel.",
            "Shift+Enter erstellt ein Geschwister davor.",
            "Ctrl+Enter erstellt einen Elternknoten ueber dem ausgewaehlten Knoten.",
            "Rechtsklick-Menues fokussieren jetzt die erste Aktion; Enter fuehrt sie aus und Pfeile oder Tab bewegen den Fokus.",
            "Neues Thema auf leerer Flaeche folgt festen Regeln: Baum = Workspace-Wurzel, Desktop = aktueller Ordner, Timeline = ausgewaehlte sichtbare Zeile wenn vorhanden."
          ]
        },
        {
          title: "Umbenennen, kopieren, verschieben, loeschen",
          summary: "Alle Kernaktionen fuer Zweige sind per Tastatur und Kontextmenue verfuegbar.",
          steps: [
            "F2 benennt den ausgewaehlten Knoten um.",
            "Waehren der Umbenennung oeffnet Rechtsklick das ODE-Rechtschreibmenue mit thematischen Vorschlaegen sowie Ausschneiden, Kopieren, Einfuegen und Alles auswaehlen.",
            "Ctrl+C/Ctrl+V/Ctrl+D bleiben im aktiven Workspace; Ctrl+X ist auf der festen Workspace-Wurzel blockiert.",
            "Entf entfernt ausgewaehlte Knoten; Rechtsklick bietet In Workspace verschieben."
          ]
        }
      ]
    },
    {
      category: "Desktop und Dateioperationen",
      topics: [
        {
          title: "Dateien importieren und oeffnen",
          summary: "Desktop-Ansicht unterstuetzt Upload, Drag-and-drop und native Windows-Aktionen.",
          steps: [
            "Nutzen Sie Upload im Desktop-Header oder ziehen Sie Dateien aus dem Explorer.",
            "Rechtsklick auf Datei: Oeffnen, Oeffnen mit, Dateispeicherort oeffnen oder Vollstaendigen Pfad kopieren.",
            "Dateien bleiben im ODE-Spiegelordner; der Sync-Status steht in der Fussleiste."
          ]
        },
        {
          title: "Knotenstatus-Filter nutzen",
          summary: "Filtern Sie per Empty, Task und Data in der unteren Leiste.",
          steps: [
            "All waehlt alle Filterzustaende.",
            "Empty waehlt nur Empty und deaktiviert die anderen Statusfilter.",
            "Task und Data koennen einzeln oder zusammen aktiv sein.",
            "Parents steuert, ob passende Nachfahren ihre Elternordner sichtbar behalten.",
            "Wenn Filter aktiv sind, durchsuchen Desktop Grid, Mind Map und Details jetzt den aktuellen Ordner rekursiv statt bei Treffern in Nachfahren leer zu bleiben."
          ]
        },
        {
          title: "Mind-Map-Ansicht fuer Strukturplanung nutzen",
          summary: "Desktop bietet Grid, Details und Mind Map mit horizontaler/vertikaler Ausrichtung.",
          steps: [
            "Ueber den Desktop-Ansichtsumschalter in den Mind-Map-Modus wechseln.",
            "Die Ausrichtung Horizontal/Vertikal je nach Planungsstil umschalten.",
            "Tastaturkuerzel und Drag/Move bleiben konsistent zu Baum und Timeline."
          ]
        },
        {
          title: "System inline aufbauen",
          summary: "System verbindet Abschnittsbearbeitung, Knotenlinks, Kontext und Export in einer schnellen Arbeitsflaeche.",
          steps: [
            "Im Desktop die Ansicht System waehlen.",
            "Knoten nutzen, um den Abschnitt zu waehlen und den Titel vor dem Schreiben umzubenennen.",
            "Bearbeitung oeffnen, um Inhalte zu schreiben, Knoten- oder externe Links einzufuegen und Verbindungen an einem Ort zu pflegen.",
            "Aenderungen speichern automatisch und Ctrl+S erzwingt das Speichern.",
            "Direkt im Abschnitt schreiben: kurze Absaetze, Listen, `>`-Zitate, Code-Fences, `---`-Trenner und `[insight:business|operations|ux|ai]`-Abschnitte.",
            "`@` im Editor tippen, um einen Knoten inline zu erwaehnen, oder Knoten verlinken / Ctrl+Shift+K fuer den Picker nutzen.",
            "Knotenlinks koennen auf den aktuellen Workspace oder einen anderen Workspace zeigen; ein Klick auf die gerenderte Link-Pille navigiert zu diesem Knoten.",
            "Bericht oeffnen, um Summen fuer Abschnitte, Dokumentation, Referenzen, Verbindungen, verknuepfte Knoten und externe Links zu pruefen.",
            "System kopieren exportiert den zusammengesetzten Text, und Export PDF / Export Word speichern eine teilbare Dokumentversion desselben Systems."
          ]
        }
      ]
    },
    {
      category: "Timeline und Planung",
      topics: [
        {
          title: "Aufgaben in der Timeline planen",
          summary: "Setzen Sie Termin, Status und Vorgaenger direkt am Knoten.",
          steps: [
            "Wechseln Sie zum Timeline-Tab.",
            "Oeffnen Sie Aufgabe planen ueber Kontextmenue oder Reihenaktion.",
            "Setzen Sie Start/Ende, Status, Vorgaenger und speichern Sie.",
            "Mit Parents im Timeline-Header bestimmen Sie, ob Elternzeilen bei Statusfiltern sichtbar bleiben."
          ]
        },
        {
          title: "Planungsverhalten verstehen",
          summary: "Timeline und Baum bleiben mit stabiler Datumslogik ueber Monate/Jahre synchron.",
          steps: [
            "Im Auto-Modus rollt der Elterntermin vom fruehesten Kinderstart bis zum spaetesten Kinderende auf.",
            "Der Date Picker unterstuetzt Vorwaerts-Navigation in kuenftige Monate/Jahre mit korrekter Speicherung.",
            "Statusfarben und Wochenbalken zeigen planned/active/blocked/done.",
            "Nutzen Sie die Jahresnavigation im Timeline-Header fuer lange Plaene."
          ]
        }
      ]
    },
    {
      category: "Favoriten und Schnellzugriff",
      topics: [
        {
          title: "Schnellzugriff als Launcher verwenden",
          summary: "Schnellzugriff dient jetzt zum schnellen Oeffnen von Arbeit und nicht zum Editieren an Ort und Stelle.",
          steps: [
            "Schnellzugriff in Desktop > Mind Map oeffnen.",
            "Einen Favoriten einmal anklicken, um Ordner oder Datei im Workspace zu oeffnen und zu Node Tree zu wechseln.",
            "Den Schnellzugriff / Node Tree-Schalter im Kopfbereich nutzen, um zwischen Launcher und Arbeitsansicht zu wechseln.",
            "Bei Datei-Favoriten per Rechtsklick Datei ansehen waehlen, wenn eine Vorschau statt direkter Arbeit im Baum gewuenscht ist."
          ]
        },
        {
          title: "Favoritengruppen organisieren ohne den Baum zu aendern",
          summary: "Mit fokussierten Schnellzugriffsaktionen lassen sich Favoriten gruppieren, verschieben und entfernen.",
          steps: [
            "Eine Gruppe mit + in der Schnellzugriffs-Seitenleiste erstellen oder per Rechtsklick auf freien Schnellzugriffs-Hintergrund in Mind Map und Neue Gruppe.",
            "Per Rechtsklick auf eine Favoritenkarte Im Workspace oeffnen, Schnellzugriffsgruppen verwalten oder Aus Schnellzugriff entfernen waehlen; Dateien zeigen zusaetzlich Datei ansehen.",
            "Eine Favoritenkarte auf eine Gruppe ziehen, um sie schnell dorthin zu verschieben, oder Schnellzugriffsgruppen verwalten fuer Mehrfachzuweisungen nutzen.",
            "Per Rechtsklick auf einen Gruppenkopf Gruppe anzeigen oder Gruppe loeschen waehlen."
          ]
        }
      ]
    },
    {
      category: "KI-Aktionen und Befehlsleiste",
      topics: [
        {
          title: "Befehlsleiste (Ctrl+K)",
          summary: "Waehlen Sie Dateien im aktuellen Knoten und oeffnen Sie KI Hilfe, Baumstruktur, Deliverables oder Plan aus einem minimalistischen Panel.",
          steps: [
            "Ctrl+K druecken, um die Befehlsleiste zu oeffnen.",
            "Die Dateischaltflaeche im Knotenkopf verwenden, um die Dateien auszuwaehlen, die die KI lesen soll.",
            "KI Hilfe oder Dateien pruefen fuer fundierte Antworten aus den ausgewaehlten Dateien starten.",
            "Baumstruktur starten, um vor der Bestaetigung einen editierbaren Baumvorschlag zu oeffnen.",
            "Deliverables starten, um nur die Deliverables des Knotens vorzuschlagen und vor der Bestaetigung zu bearbeiten.",
            "Plan starten, um Deliverables und Arbeitsfeld-Aufgaben gemeinsam in einem editierbaren Vorschlag zu erstellen."
          ]
        },
        {
          title: "Dokument-KI-Optionen",
          summary: "Waehlen Sie zuerst eine Datei aus und lassen Sie ODETool die zuverlaessigste KI-Aktion empfehlen.",
          steps: [
            "Eine lesbare Datei im Baum oder Desktop auswaehlen.",
            "Im Haupt-Header KI-Optionen anklicken, um erkannte Signale, empfohlene Aktion und erkannte Sections zu sehen.",
            "Wenn Create WBS from document innerhalb eines Level-4-NA oder eines bestehenden Chantier ausgefuehrt wird, wechselt ODETool jetzt automatisch in den Chantier-Modus statt einen generischen WBS-Prompt zu verwenden.",
            "Aeltere ODE-Baeume werden jetzt bei Bedarf rueckwirkend annotiert: Wenn ein Zweig anhand von Titeln und Tiefe zur NA passt, speichert ODETool die fehlenden ODE-Metadaten vor der Generierung.",
            "Create Chantier from AI verwenden, wenn das Dokument klar zu einem Level-4-NA passt und ein Level-5-Chantier erzeugen soll; Map document to NA fuer ODE-Klassifikation, Import outline as tree fuer nummerierte Gliederungen, Create tree from section fuer fokussierte Extraktion oder Create WBS from document verwenden, wenn KI die Struktur ableiten soll.",
            "Dokumentenpruefungen liefern Belegzitate im Format [nummer|name].",
            "Den Mistral API Key im Tab KI-Einstellungen fuer KI-generierte Reviews und WBS konfigurieren."
          ]
        }
      ]
    },
    {
      category: "Qualitaet und Release-Disziplin",
      topics: [
        {
          title: "QA vor Packaging ausfuehren",
          summary: "Halten Sie die App stabil mit QA-Checkliste plus Quality Gate.",
          steps: [
            "QA-Checkliste im Footer oeffnen und alle besprochenen Bug-Szenarien durchgehen.",
            "Jedes Szenario als Bestanden/Fehler/Offen markieren und Fehler vor Packaging beheben.",
            "Mock-Tests und Type/Build-Checks ueber Befehle oder npm-Skripte starten.",
            "Erzeugte Reports unter quality/reports pruefen.",
            "Neue EXE/MSI erst nach erfolgreichem QA-Durchlauf bauen."
          ]
        },
        {
          title: "Aenderungen nachvollziehen",
          summary: "Nutzen Sie Release Notes als zentrale, historische Quelle.",
          steps: [
            "Release Notes in der unteren Leiste oeffnen.",
            "Nach Datum, Version, Kategorie und Details pruefen.",
            "Hilfe und QA-Checkliste mit den Release-Updates synchron halten."
          ]
        }
      ]
    },
    {
      category: "Tastaturkuerzel (Kern)",
      topics: [
        {
          title: "Windows-Verhaltensstandard",
          summary: "Baum, Desktop, Mind Map, Details und Timeline folgen einem gemeinsamen Interaktionsvertrag.",
          steps: [
            "Die angeklickte Oberflaeche besitzt die Tastaturaktionen, bis der Fokus bewusst woanders hingelegt wird.",
            "Pfeile bewegen den Fokus, Shift+Pfeil erweitert die Auswahl, Ctrl+Pfeil behaelt die aktuelle Auswahl beim Fokuswechsel, und Ctrl+Leertaste schaltet das fokussierte Element um.",
            "Home/End springen innerhalb der aktiven Oberflaeche, und Ctrl+Home/Ctrl+End springen zum ersten oder letzten sichtbaren Element.",
            "Fokussiert, ausgewaehlt und in Bearbeitung bleiben absichtlich unterschiedliche Zustande, damit immer klar ist, wo Tippen oder Zwischenablage wirken."
          ]
        },
        {
          title: "Navigation und Auswahl",
          summary: "Bewegen Sie sich in Baum, Desktop-Grid und Timeline per Tastatur.",
          steps: [
            "Pfeiltasten bewegen den Fokus auf der aktiven Oberflaeche; Shift+Pfeil erweitert den Bereich vom aktuellen Anker aus.",
            "Ctrl+Pfeil bewegt den Fokus, ohne die aktuelle Auswahl zu loeschen.",
            "Ctrl+Leertaste schaltet das fokussierte Element um, ohne es zu verschieben.",
            "Home/End springen zur ersten/letzten sichtbaren Zeile, und Ctrl+Home/Ctrl+End springen zum ersten/letzten sichtbaren Element.",
            "Ctrl+A waehlt alles auf der aktiven Oberflaeche."
          ]
        },
        {
          title: "Bearbeitung und Zwischenablage",
          summary: "Schnellbearbeitung funktioniert am besten ohne offene Modals.",
          steps: [
            "F2 umbenennen, Enter/Tab Struktur erstellen, Entf Auswahl loeschen.",
            "Ctrl+S bestaetigt eine Inline-Umbenennung, und Escape bricht die Umbenennung ab oder entfernt eine ausstehende Ausschneiden-Markierung, wenn gerade kein Text bearbeitet wird.",
            "Waehren einer Inline-Umbenennung nutzt Rechtsklick das ODE-Rechtschreibmenue statt des nativen Browsermenues.",
            "Im Umbenennungsfeld bleibt natives Textverhalten fuer Ctrl+Z/Ctrl+Y/Ctrl+C/Ctrl+X/Ctrl+V/Ctrl+A aktiv.",
            "Ausserhalb der Umbenennung gelten Ctrl+C/Ctrl+V/Ctrl+D fuer kopieren/einfuegen/duplizieren auf der aktiven Oberflaeche; Ctrl+X ist auf der festen Workspace-Wurzel blockiert."
          ]
        }
      ]
    }
  ],
  ES: [
    {
      category: "Espacios de trabajo y fuentes",
      topics: [
        {
          title: "Crear o importar un espacio",
          summary: "Empiece en Configuracion de workspace y vincule una carpeta real cuando haga falta.",
          steps: [
            "Abra Configuracion de workspace desde la barra superior.",
            "Use Crear workspace para un arbol interno, o Importar carpeta/Explorar para una ruta existente.",
            "Use Definir por defecto para abrir primero ese workspace la proxima vez."
          ]
        },
        {
          title: "Abrir rapido la carpeta vinculada",
          summary: "Vaya directamente a la carpeta del workspace en el Explorador de Windows.",
          steps: [
            "Abra Configuracion de workspace.",
            "Haga clic en Abrir carpeta junto a las acciones del workspace.",
            "Uselo para operaciones de archivo fuera de ODETool."
          ]
        },
        {
          title: "Recuperar la lista de workspaces si falla la carga",
          summary: "El indice de workspaces puede reconstruir raices incluso con registros legacy danados.",
          steps: [
            "Abra Configuracion de workspace y verifique grupos linked/internal.",
            "Si hace falta, pulse Reparar indice para reconstruir entradas faltantes.",
            "Las rutas importadas se comparan normalizadas; rutas entre comillas tambien son validas."
          ]
        }
      ]
    },
    {
      category: "Estructura del arbol y edicion",
      topics: [
        {
          title: "Crear y estructurar nodos rapido",
          summary: "Use acciones de teclado para construir jerarquias padre/hijo rapidamente.",
          steps: [
            "Enter crea un hermano despues del nodo seleccionado; en la raiz del workspace crea una nueva rama de primer nivel dentro de ese workspace.",
            "Tab crea un hijo; en Timeline lo crea bajo la fila seleccionada y clic derecho Nuevo tema sobre una fila sigue la misma regla.",
            "Shift+Enter crea un hermano antes.",
            "Ctrl+Enter crea un padre encima del nodo seleccionado.",
            "Los menus clic derecho ahora enfocan la primera accion; use Enter para ejecutarla y Flechas o Tab para moverse.",
            "Nuevo tema sobre espacio vacio sigue reglas estables: Arbol = raiz del workspace, Desktop = carpeta actual, Timeline = fila visible seleccionada cuando exista."
          ]
        },
        {
          title: "Renombrar, copiar, mover y eliminar",
          summary: "Todas las operaciones de rama estan en teclado y menu contextual.",
          steps: [
            "F2 renombra el nodo seleccionado.",
            "Durante el renombrado, el clic derecho abre el menu ODE de ortografia con sugerencias tematicas junto con Cortar, Copiar, Pegar y Seleccionar todo.",
            "Ctrl+C/Ctrl+V/Ctrl+D permanecen dentro del workspace activo; Ctrl+X queda bloqueado en la raiz fija del workspace.",
            "Delete elimina nodos seleccionados; clic derecho incluye Mover a workspace."
          ]
        }
      ]
    },
    {
      category: "Escritorio y operaciones de archivos",
      topics: [
        {
          title: "Importar y abrir archivos",
          summary: "La vista Escritorio soporta upload, arrastrar y acciones nativas de Windows.",
          steps: [
            "Use Upload en la cabecera de Escritorio o arrastre archivos desde el Explorador.",
            "Clic derecho en archivo para Abrir, Abrir con, Abrir ubicacion, o Copiar ruta completa.",
            "Los archivos se reflejan en la carpeta espejo ODE y el estado de sync se ve en el pie."
          ]
        },
        {
          title: "Usar filtros de estado de nodo",
          summary: "Filtre por Empty, Task y Data desde la barra inferior.",
          steps: [
            "All selecciona todos los estados de filtro.",
            "Empty selecciona solo Empty y limpia otros filtros de estado.",
            "Task y Data pueden estar activos por separado o juntos.",
            "Parents decide si los descendientes coincidentes mantienen visibles sus carpetas padre.",
            "Cuando un filtro esta activo, Desktop Grid, Mind Map y Details ahora recorren la carpeta actual para mostrar tambien coincidencias en descendientes."
          ]
        },
        {
          title: "Cambiar a vista Mind Map para planificar estructura",
          summary: "Desktop incluye Grid, Detail y Mind Map con orientacion horizontal/vertical.",
          steps: [
            "Use el selector de vista de Desktop para abrir el modo Mind Map.",
            "Cambie la orientacion Horizontal/Vertical segun su forma de planificar.",
            "Atajos de teclado y acciones de arrastrar/mover se mantienen consistentes con arbol y timeline."
          ]
        },
        {
          title: "Construir el sistema inline",
          summary: "Sistema une redaccion de secciones, nodos vinculados, contexto y exportacion en un espacio rapido.",
          steps: [
            "Cambie la vista Desktop a Sistema.",
            "Use Nodos para elegir la seccion y renombrar su titulo antes de redactar.",
            "Abra Edicion para escribir contenido, insertar enlaces de nodo o externos y mantener las conexiones en el mismo lugar.",
            "Los cambios se guardan automaticamente y Ctrl+S fuerza el guardado.",
            "Escriba directamente en la seccion: parrafos cortos, listas, citas `>`, bloques de codigo, separadores `---` y secciones `[insight:business|operations|ux|ai]`.",
            "Escriba `@` en el editor para mencionar un nodo en linea, o use Vincular nodo / Ctrl+Shift+K para el selector.",
            "Los enlaces de nodo pueden apuntar al workspace actual o a otro workspace; al hacer clic en una pastilla de enlace renderizada se navega a ese nodo.",
            "Abra Informe para revisar los totales de secciones, documentacion, referencias, conexiones, nodos vinculados y enlaces externos.",
            "Copiar sistema exporta el texto completo, y Export PDF / Export Word guardan una version compartible del mismo sistema."
          ]
        }
      ]
    },
    {
      category: "Timeline y planificacion",
      topics: [
        {
          title: "Planificar tareas en timeline",
          summary: "Configure agenda, estado y predecesor directamente desde nodos.",
          steps: [
            "Cambie a la pestana Timeline.",
            "Abra Programar tarea desde menu contextual o accion de fila.",
            "Defina inicio/fin, estado y predecesor, luego guarde.",
            "Use el chip Parents en la cabecera Timeline para decidir si las filas padre siguen visibles durante el filtrado por estado."
          ]
        },
        {
          title: "Entender el comportamiento de agenda",
          summary: "Timeline y arbol se mantienen sincronizados con fechas estables entre meses y anos.",
          steps: [
            "En modo auto, la agenda padre toma inicio mas temprano y fin mas tardio de los hijos.",
            "El selector de fecha permite avanzar a meses/anos futuros y guardar correctamente.",
            "Los colores de estado y barras por semana reflejan planned/active/blocked/done.",
            "Use la navegacion por ano en la cabecera timeline para planes largos."
          ]
        }
      ]
    },
    {
      category: "Favoritos y acceso rapido",
      topics: [
        {
          title: "Usar Acceso rapido como lanzador",
          summary: "Acceso rapido ahora sirve para abrir trabajo rapido, no para editar alli mismo.",
          steps: [
            "Abra Acceso rapido en Desktop > Mind Map.",
            "Haga un solo clic sobre una tarjeta favorita para abrir esa carpeta o archivo en el espacio de trabajo y cambiar a Node Tree.",
            "Use el selector Acceso rapido / Node Tree del encabezado para volver entre la vista lanzador y la vista de trabajo.",
            "En favoritos de archivo, use clic derecho y Vista previa del archivo si quiere revisar antes de trabajar desde el arbol."
          ]
        },
        {
          title: "Organizar grupos favoritos sin tocar el arbol",
          summary: "Use acciones enfocadas de Acceso rapido para agrupar, mover y quitar favoritos.",
          steps: [
            "Cree un grupo con + en el panel lateral de Acceso rapido o con clic derecho sobre el fondo vacio de Quick Access en Mind Map y Nuevo grupo.",
            "Haga clic derecho sobre una tarjeta favorita para Abrir en el espacio, Administrar grupos de acceso rapido o Quitar de acceso rapido; los archivos tambien muestran Vista previa del archivo.",
            "Arrastre una tarjeta favorita hacia un grupo para moverla rapido, o use Administrar grupos de acceso rapido si quiere varias asignaciones.",
            "Haga clic derecho sobre un encabezado de grupo para Mostrar grupo o Eliminar grupo."
          ]
        }
      ]
    },
    {
      category: "Acciones IA y barra de comandos",
      topics: [
        {
          title: "Barra de comandos (Ctrl+K)",
          summary: "Seleccione archivos dentro del nodo actual y abra Ayuda IA, Estructura arbol, Entregables o Plan desde un panel minimo.",
          steps: [
            "Presione Ctrl+K para abrir la barra de comandos.",
            "Use el boton de archivos en el encabezado del nodo para elegir que archivos debe leer la IA.",
            "Ejecute Ayuda IA o Revisar archivos para obtener respuestas basadas en los archivos seleccionados.",
            "Ejecute Estructura arbol para abrir una propuesta de arbol editable antes de validarla.",
            "Ejecute Entregables para proponer solo los entregables del nodo y editarlos antes de validar.",
            "Ejecute Plan para preparar juntos entregables y tareas de workarea en una sola propuesta editable."
          ]
        },
        {
          title: "Opciones IA para documentos",
          summary: "Seleccione primero un archivo y deje que ODETool recomiende la accion IA mas fiable para ese documento.",
          steps: [
            "Seleccione un archivo legible en el arbol o Desktop.",
            "Haga clic en AI Options en el encabezado principal para revisar senales detectadas, accion recomendada y secciones detectadas.",
            "Cuando Create WBS from document se ejecuta dentro de una NA de nivel 4 o de un chantier existente, ODETool cambia ahora automaticamente a modo chantier en lugar de usar un prompt WBS generico.",
            "Los arboles ODE antiguos ahora se completan bajo demanda: si una rama coincide con la NA por titulos y profundidad, ODETool guarda los metadatos ODE faltantes antes de generar trabajo.",
            "Use Create Chantier from AI cuando el documento encaje claramente en una NA de nivel 4 y deba abrir un chantier de nivel 5; Use Map document to NA para clasificacion ODE, Import outline as tree para esquemas numerados, Create tree from section para extraccion enfocada, o Create WBS from document cuando la IA deba inferir la estructura.",
            "Las revisiones documentales devuelven citas de evidencia en formato [numero|nombre].",
            "Configure la clave API de Mistral en la pestana Configuracion IA para revisiones y WBS generados por IA."
          ]
        }
      ]
    },
    {
      category: "Disciplina de calidad y release",
      topics: [
        {
          title: "Ejecutar QA antes de empaquetar",
          summary: "Mantenga estable la app usando checklist QA junto con quality gate.",
          steps: [
            "Abra Checklist QA desde el pie y revise cada escenario de bug discutido.",
            "Marque cada escenario como Aprobado/Fallado/Pendiente y corrija fallos antes de empaquetar.",
            "Ejecute mock tests y checks type/build desde comandos o scripts npm.",
            "Revise reportes generados en quality/reports.",
            "Empaquete nuevo EXE/MSI solo despues de pasar QA."
          ]
        },
        {
          title: "Rastrear cambios",
          summary: "Use Release Notes como fuente historica principal.",
          steps: [
            "Abra Release Notes desde la barra inferior.",
            "Revise por fecha, version, categoria y detalles.",
            "Mantenga Ayuda y checklist QA alineadas con cada actualizacion de release."
          ]
        }
      ]
    },
    {
      category: "Atajos de teclado (base)",
      topics: [
        {
          title: "Estandar de comportamiento Windows",
          summary: "Arbol, Desktop, Mind Map, Details y Timeline siguen un solo contrato de interaccion.",
          steps: [
            "La superficie que se pulsa pasa a ser la propietaria de las acciones de teclado hasta que el foco cambie a otra.",
            "Las flechas mueven el foco, Shift+Flecha extiende la seleccion, Ctrl+Flecha mantiene la seleccion mientras mueve el foco, y Ctrl+Espacio alterna el elemento enfocado.",
            "Home/End saltan dentro de la superficie activa, y Ctrl+Home/Ctrl+End saltan al primer o ultimo elemento visible.",
            "Los estados enfocado, seleccionado y en edicion se mantienen distintos para que siempre se vea donde aplican la escritura y el portapapeles."
          ]
        },
        {
          title: "Navegacion y seleccion",
          summary: "Muevase por arbol, grid de escritorio y timeline con teclado.",
          steps: [
            "Las flechas mueven el foco en la superficie activa; Shift+Flecha extiende el rango desde el ancla actual.",
            "Ctrl+Flecha mueve el foco sin colapsar la seleccion actual.",
            "Ctrl+Espacio alterna el elemento enfocado sin moverlo.",
            "Home/End saltan a la primera/ultima fila visible, y Ctrl+Home/Ctrl+End al primer/ultimo elemento visible.",
            "Ctrl+A selecciona todo en la superficie activa."
          ]
        },
        {
          title: "Edicion y portapapeles",
          summary: "La edicion rapida funciona mejor cuando no hay modales abiertos.",
          steps: [
            "F2 renombrar, Enter/Tab crear estructura, Delete eliminar seleccion.",
            "Ctrl+S confirma el renombrado inline, y Escape cancela el renombrado o limpia un corte pendiente cuando no se esta editando texto.",
            "Durante el renombrado inline, el clic derecho usa el menu ODE de ortografia en lugar del menu nativo del navegador.",
            "Dentro del campo de renombrado, la edicion de texto nativa sigue activa para Ctrl+Z/Ctrl+Y/Ctrl+C/Ctrl+X/Ctrl+V/Ctrl+A.",
            "Fuera del renombrado, Ctrl+C/Ctrl+V/Ctrl+D copian/pegan/duplican en la superficie activa; Ctrl+X queda bloqueado en la raiz fija del workspace."
          ]
        }
      ]
    }
  ]
};

export function getLocalizedHelpGuideCategories(
  language: LanguageCode,
  englishGuide: HelpGuideCategory[]
): HelpGuideCategory[] {
  if (language === "EN") return englishGuide;
  return HELP_GUIDE_LOCALIZED[language] ?? englishGuide;
}
