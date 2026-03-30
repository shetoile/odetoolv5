import type { HelpGuideCategory } from "@/lib/helpGuideLocalization";

export const HELP_GUIDE_CATEGORIES: HelpGuideCategory[] = [
  {
    category: "Workspace and Sources",
    topics: [
      {
        title: "Create or import a workspace",
        summary: "Start from Workspace Settings and link a real folder when needed.",
        steps: [
          "Open Workspace Settings from the top bar.",
          "Use Create Workspace for a clean internal tree, or Import Folder/Browse for an existing path.",
          "Set Default to make one workspace open first next time."
        ]
      },
      {
        title: "Open linked folder quickly",
        summary: "Jump directly to the workspace folder in Windows Explorer.",
        steps: [
          "Open Workspace Settings.",
          "Click Open Folder next to workspace actions.",
          "Use this for direct file operations outside ODETool."
        ]
      },
      {
        title: "Recover workspace list if loading fails",
        summary: "Workspace index now recovers root folders even when legacy records are broken.",
        steps: [
          "Open Workspace Settings and verify your workspaces appear in linked/internal groups.",
          "If needed, click Repair Workspace Index to rebuild missing workspace entries.",
          "Imported paths are matched by normalized folder path; quoted input paths are accepted."
        ]
      }
    ]
  },
  {
    category: "Tree Structure and Editing",
    topics: [
      {
        title: "Create and structure nodes fast",
        summary: "Use keyboard-first actions to build parent/child hierarchies quickly.",
        steps: [
          "Enter creates sibling after selected node; on the workspace root it creates a new top-level branch inside that workspace.",
          "Ctrl+C/Ctrl+V/Ctrl+D stay inside the active workspace; the fixed workspace root cannot be cut.",
          "Tab creates child node; in Timeline it creates the child under the selected row and right-click New Topic on a row follows the same rule.",
          "Shift+Enter creates sibling before.",
          "Ctrl+Enter creates a parent above selected node.",
          "Right-click menus now focus the first action automatically; use Enter to run it and Arrow keys or Tab to move between actions.",
          "Blank-space New Topic now follows one shared rule set: Tree creates at workspace root, Desktop creates in the current folder, and Timeline creates under the selected visible row when there is one."
        ]
      },
      {
        title: "Rename, copy, move, and delete",
        summary: "All core branch operations are available in keyboard and context menu.",
        steps: [
          "F2 renames selected node.",
          "While renaming, right-click opens the ODE spelling menu with themed suggestions plus Cut, Copy, Paste, and Select all.",
          "Ctrl+C/Ctrl+X/Ctrl+V copies or moves branches; Ctrl+D duplicates.",
          "Delete removes selected nodes; right-click supports Move to Workspace."
        ]
      }
    ]
  },
  {
    category: "Desktop and File Operations",
    topics: [
      {
        title: "Import and open files",
        summary: "Desktop view supports upload, drag-and-drop, and native Windows open actions.",
        steps: [
          "Use Upload in Desktop header or drag files from Explorer.",
          "Right-click a file for Open, Open with, Open file location, or Copy full path.",
          "Files stay mirrored in the ODE mirror folder and sync status is visible in footer."
        ]
      },
      {
        title: "Use node-state filters",
        summary: "Filter by Empty, Task, and Data from the bottom bar.",
        steps: [
          "All selects all filter states.",
          "Empty selects Empty only and clears other state filters.",
          "Task and Data can be selected independently or together.",
          "Parents toggles whether matching descendants keep their parent folders visible.",
          "When filters are active, Grid, Mind Map, and Details now recurse through the current folder instead of showing empty just because only descendants match."
        ]
      },
      {
        title: "Switch to Mind Map view for structure planning",
        summary: "Desktop supports Grid, Detail, and Mind Map with horizontal/vertical layouts.",
        steps: [
          "Use the Desktop view switcher to open Mind Map mode.",
          "Toggle orientation between Horizontal and Vertical based on your planning style.",
          "Keyboard shortcuts and drag/move actions stay consistent with tree and timeline behavior."
        ]
      },
      {
        title: "Build systems inline",
        summary: "System keeps section writing, linked nodes, context, and export in one fast workspace.",
        steps: [
          "Switch the Desktop view to System.",
          "Use the Objective tab for node title context, description, and objective writing, then switch to Deliverables for execution-ready outputs.",
          "Use Nodes to choose the section and rename its heading before writing.",
          "Open Edition to write content, insert node links or external links, and maintain connections in the same place.",
          "Changes autosave and Ctrl+S forces a save.",
          "Write directly in the section body with short paragraphs, bullet or numbered lists, `>` quotes, fenced code blocks, `---` dividers, and `[insight:business|operations|ux|ai]` sections.",
          "Type `@` inside the editor to mention a node inline, or use Link node / Ctrl+Shift+K for the picker.",
          "Node links can target the current workspace or another workspace; clicking a rendered node pill navigates to that node.",
          "Open Report to review section, documentation, reference, connection, linked-node, and external-link totals.",
          "Copy system exports the assembled text, and Export PDF / Export Word save a shareable document version of the same system."
        ]
      }
    ]
  },
  {
    category: "Timeline and Scheduling",
    topics: [
      {
        title: "Plan tasks on the timeline",
        summary: "Set schedule, status, and predecessor directly from nodes.",
        steps: [
          "Switch to Timeline tab.",
          "Timeline search now focuses scheduled execution tasks, keeps only matching execution rows in view, and helps you jump directly to the exact task bar you searched for.",
          "Open Schedule Task from context menu or timeline row action.",
          "Set start/end, status, predecessor, then save.",
          "Use the Parents chip in the timeline header to choose whether filtered status results keep parent rows visible."
        ]
      },
      {
        title: "Understand schedule behavior",
        summary: "Timeline and tree stay synchronized with stable date handling across months and years.",
        steps: [
          "When parent schedule is auto-derived, it rolls up from earliest child start to latest child end.",
          "Date picker supports moving to future months/years and saving those values correctly.",
          "Status colors and week bars reflect planned/active/blocked/done states.",
          "Use year navigation in timeline header to review long plans."
        ]
      }
    ]
  },
  {
    category: "Favorites and Quick Access",
    topics: [
      {
        title: "Use Quick Access as a launcher",
        summary: "Quick Access is now for opening work fast, not for editing on the spot.",
        steps: [
          "Open Quick Access in Desktop > Mind Map.",
          "Single-click a favorite card to open that folder or file in the workspace and switch to Node Tree.",
          "Use the Quick Access / Node Tree switch in the header to move between launcher view and the working view.",
          "Right-click a file favorite if you want Preview File instead of immediately working from the tree."
        ]
      },
      {
        title: "Organize favorite groups without touching the tree",
        summary: "Use focused Quick Access actions to group, move, and remove favorites.",
        steps: [
          "Create a group with + in the sidebar Quick Access panel or by right-clicking empty Quick Access space in Mind Map and choosing New Group.",
          "Right-click a favorite card for Open in Workspace, Manage Quick Access Groups, or Remove from Quick Access; files also show Preview File.",
          "Drag a favorite card onto a group to move it there quickly, or use Manage Quick Access Groups when you want multiple group assignments.",
          "Right-click a group header for Show Group or Delete Group."
        ]
      }
    ]
  },
  {
    category: "AI Actions and Command Bar",
    topics: [
      {
        title: "Command Bar (Ctrl+K)",
        summary: "Select files inside the current node, then open AI Help, Tree Structure, Deliverables, or Plan from one minimal panel.",
        steps: [
          "Press Ctrl+K to open command bar.",
          "Use the files button in the node header to choose which files inside the node AI should read.",
          "Run AI Help or Review Files for grounded answers from the selected files.",
          "Run Tree Structure to open an editable tree proposal before you validate and apply it.",
          "Run Deliverables to draft only the deliverables for the node and edit them before validation.",
          "Run Plan to draft deliverables and workarea tasks together in one editable proposal."
        ]
      },
      {
        title: "Document AI options",
        summary: "Select a file first, then let ODETool rank the safest next action for that document.",
        steps: [
          "Select a readable file in the tree or Desktop.",
          "Click AI Options in the main header to inspect detected signals, recommended actions, and detected sections.",
          "Use Create Chantier from AI when the document maps clearly to a Level 4 NA and you want ODETool to create a Level 5 chantier under that protected branch.",
          "When Create WBS from document runs inside a Level 4 NA or an existing chantier, ODETool now switches automatically into chantier mode instead of using a generic WBS prompt.",
          "Older ODE trees are now backfilled on demand: if a branch matches the NA structure by titles and depth, ODETool persists the missing ODE metadata before generating work.",
          "Use Map document to NA when you want ODE classification first, Import outline as tree for numbered outlines, Create tree from section for focused extraction, or Create WBS from document when AI must infer structure.",
          "Document review responses include evidence citations in [number|name] format.",
          "Configure the Mistral API key in the AI Settings tab for AI-generated review and WBS actions beyond direct outline extraction."
        ]
      }
    ]
  },
  {
    category: "Quality and Release Discipline",
    topics: [
      {
        title: "Run QA before packaging",
        summary: "Keep the app stable by using the QA checklist together with the quality gate.",
        steps: [
          "Open QA Checklist from the footer and review every discussed bug scenario.",
          "Mark each scenario as Passed/Failed/Pending and investigate failures before packaging.",
          "Run mock tests and type/build checks from command actions or npm scripts.",
          "Review generated reports under quality/reports.",
          "Only package new EXE/MSI after quality pass."
        ]
      },
      {
        title: "Track what changed",
        summary: "Use Release Notes as the historical source of truth.",
        steps: [
          "Open Release Notes from bottom bar.",
          "Review by date, version, category, and details.",
          "Keep Help and QA checklist aligned with release updates when new features are added."
        ]
      }
    ]
  },
  {
    category: "Keyboard Shortcuts (Core)",
    topics: [
      {
        title: "Windows behavior standard",
        summary: "Tree, Desktop, Mind Map, Details, and Timeline follow one shared interaction contract.",
        steps: [
          "The surface you click becomes the owner of keyboard actions until you move focus elsewhere.",
          "Arrow keys move focus, Shift+Arrow extends selection, Ctrl+Arrow keeps the current selection while moving focus, and Ctrl+Space toggles the focused item.",
          "Home/End jump inside the active surface, and Ctrl+Home/Ctrl+End jump to first or last visible item.",
          "Focused, selected, and editing states are intentionally different so you can always see where typing or clipboard actions will apply."
        ]
      },
      {
        title: "Navigation and selection",
        summary: "Move across tree, desktop grid, and timeline with keyboard.",
        steps: [
          "Arrow keys move focus on the active surface; Shift+Arrow extends range from the current anchor.",
          "Ctrl+Arrow moves focus without collapsing the current selection.",
          "Ctrl+Space toggles the focused item without moving it.",
          "Home/End jump to first/last visible row, and Ctrl+Home/Ctrl+End jump to first/last visible item.",
          "Ctrl+A selects all in active surface."
        ]
      },
      {
        title: "Editing and clipboard",
        summary: "Fast editing works best when no modal is open.",
        steps: [
          "F2 rename, Enter/Tab create structure, Delete remove selection.",
          "Ctrl+S commits an inline rename, and Escape cancels rename or clears pending cut highlight when you are not editing text.",
          "During inline rename, right-click uses the ODE spelling menu instead of the native browser menu.",
          "Inside the rename input, native text editing stays active for Ctrl+Z/Ctrl+Y/Ctrl+C/Ctrl+X/Ctrl+V/Ctrl+A.",
          "Outside rename, Ctrl+C/Ctrl+X/Ctrl+V/Ctrl+D stay on the active surface for copy/cut/paste/duplicate."
        ]
      }
    ]
  }
];
