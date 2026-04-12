export type QaTesterMode = "manual" | "hybrid" | "automated";
export type QaTesterPriority = "critical" | "high" | "normal";

export type RegressionChecklistAiTesterConfig = {
  mode?: QaTesterMode;
  priority?: QaTesterPriority;
  tags?: string[];
  hints?: string[];
  automationId?: string;
};

export type RegressionChecklistItem = {
  id: string;
  area: "Tree" | "Desktop" | "Timeline" | "Workspace" | "Favorites" | "Keyboard" | "UI";
  title: string;
  scenario: string;
  aiTester?: RegressionChecklistAiTesterConfig;
};

export const REGRESSION_CHECKLIST_ITEMS: RegressionChecklistItem[] = [
  {
    id: "tree-f2-rename",
    area: "Tree",
    title: "F2 rename works in tree and timeline rows",
    scenario: "Select a node and press F2, rename in tree and timeline, then verify numbering, selection, and multi-letter typing stay correct.",
    aiTester: {
      mode: "automated",
      priority: "high",
      automationId: "tree-f2-rename",
      tags: ["f2", "rename", "tree", "timeline", "inline edit"],
      hints: ["F2 should open rename in tree and timeline", "rename should accept full multi-letter typing"]
    }
  },
  {
    id: "tree-enter-new-node",
    area: "Tree",
    title: "Enter creates a new sibling node",
    scenario:
      "Select a node and press Enter, then confirm the new node appears, inline rename starts immediately, and the rename field is blank instead of keeping the default placeholder text.",
    aiTester: {
      mode: "automated",
      priority: "high",
      automationId: "tree-enter-new-node",
      tags: ["tree", "enter", "new topic", "inline rename", "blank rename"],
      hints: ["enter should create a sibling", "new node rename should start empty"]
    }
  },
  {
    id: "tree-tab-new-child",
    area: "Tree",
    title: "Tab creates a child node",
    scenario: "Select a node and press Tab, then verify child is created under selected parent."
  },
  {
    id: "tree-new-node-auto-scroll",
    area: "Tree",
    title: "Auto-scroll to created node",
    scenario: "Create or duplicate a node near list bottom and verify viewport scrolls to keep it visible."
  },
  {
    id: "desktop-duplicate-consistency",
    area: "Desktop",
    title: "Duplicate creates one valid copy",
    scenario: "Duplicate nodes from desktop grid and details view and confirm single copy with valid numbering."
  },
  {
    id: "desktop-filter-sync",
    area: "Desktop",
    title: "Node-state filters sync across views",
    scenario: "Toggle EMPTY/TASK/DATA and confirm tree, desktop, and timeline all refresh consistently."
  },
  {
    id: "desktop-filter-logic",
    area: "Desktop",
    title: "ALL and EMPTY filter logic",
    scenario:
      "Selecting ALL enables EMPTY/TASK/DATA; selecting EMPTY clears TASK/DATA automatically; and FILLED folders only appear when both TASK and DATA are active, not when only one is selected."
  },
  {
    id: "desktop-upload-targets-current-folder",
    area: "Desktop",
    title: "Upload and external drop stay inside the current open folder",
    scenario:
      "Open a nested folder in Desktop, then import one or more files from the header button and by dragging from Windows into empty Grid/Mind Map/Details space. Verify the imported files are created inside that current folder instead of the workspace root.",
    aiTester: {
      mode: "automated",
      priority: "critical",
      automationId: "desktop-upload-targets-current-folder",
      tags: ["desktop", "upload", "drag drop", "current folder", "workspace root"],
      hints: ["import file into current folder", "upload should not leak to workspace root"]
    }
  },
  {
    id: "desktop-mindmap-view-toggle",
    area: "Desktop",
    title: "Mind Map view and orientation toggle",
    scenario: "Switch Grid/Detail/Mind Map and verify Horizontal/Vertical orientation toggles render correctly."
  },
  {
    id: "desktop-mindmap-shortcuts-dnd",
    area: "Desktop",
    title: "Mind Map keeps keyboard and drag/drop behavior",
    scenario: "In Mind Map mode test arrows, multi-select, copy/cut/paste/duplicate, and drag/move operations.",
    aiTester: {
      priority: "high",
      tags: ["mind map", "keyboard", "drag drop", "clipboard"],
      hints: ["mind map should keep keyboard parity", "mind map should keep drag and drop behavior"]
    }
  },
  {
    id: "desktop-inline-rename-stays-on-surface",
    area: "Desktop",
    title: "Desktop Grid and Mind Map rename stays on the clicked surface",
    scenario:
      "In Desktop Grid and Mind Map, press F2 on a selected node and verify the inline editor opens on that card itself, the tree does not steal focus, and typing accepts multiple letters before commit.",
    aiTester: {
      mode: "automated",
      priority: "high",
      automationId: "desktop-inline-rename-stays-on-surface",
      tags: ["desktop", "mind map", "f2", "rename", "surface routing"],
      hints: ["Desktop rename should stay on the clicked card", "Mind Map rename should not fall back to the tree"]
    }
  },
  {
    id: "desktop-procedure-selection-and-autosave",
    area: "Desktop",
    title: "System uses Nodes, Edition, and Report while autosaving node body",
    scenario:
      "In Desktop > System, start in Nodes, rename or choose a section heading, switch to Edition, use the inline tools to insert a quote, divider, or node link, type content, and confirm the saved node content updates without leaving the new 3-action flow.",
    aiTester: {
      mode: "automated",
      priority: "high",
      automationId: "desktop-procedure-selection-and-autosave",
      tags: ["procedure", "desktop", "nodes", "edition", "report", "autosave", "node content"],
      hints: [
        "Nodes should let users choose or rename the active section heading",
        "Edition tools should insert content into the current section",
        "typing in Edition should save back to node content without leaving the 3-action flow"
      ]
    }
  },
  {
    id: "desktop-procedure-title-and-node-links",
    area: "Desktop",
    title: "System Report keeps totals, exports, and cross-workspace links aligned",
    scenario:
      "In Desktop > System, rename a heading from Nodes, edit the body and connections in Edition, insert one node link with @ mention or the picker from the current workspace and one from another workspace, add one external online-tool link, open Report, verify the totals update sections, documented sections, references, connections, linked nodes, and external links for the current branch or workspace, export the system to PDF and DOCX, then click the rendered links and confirm ODETool selects the local target or switches workspace to the remote target without breaking the 3-action System flow.",
    aiTester: {
      mode: "manual",
      priority: "high",
      tags: ["procedure", "desktop", "nodes", "edition", "report", "export", "node links", "workspace navigation", "connections", "external links", "status overview"],
      hints: [
        "Nodes heading edits should save inline",
        "@ mention insertion should create a rendered node link",
        "Edition connection changes should persist",
        "External links should remain clickable",
        "Report totals should reflect current system coverage",
        "PDF and DOCX export should save successfully",
        "rendered node links should navigate across workspaces without leaving the 3-action flow"
      ]
    }
  },
  {
    id: "desktop-file-review-pdf-scroll-preview",
    area: "Desktop",
    title: "File Review renders PDFs as a scrollable page stack",
    scenario:
      "Open File Review for a PDF from Mind Map and verify pages render inside the modal and can be scrolled page by page without falling back to the browser or external app."
  },
  {
    id: "desktop-file-review-powerpoint-slide-preview",
    area: "Desktop",
    title: "File Review renders PowerPoint slides inside the modal",
    scenario:
      "Open File Review for a PowerPoint from Mind Map and verify exported slide previews render inside the modal and Previous/Next moves between slides without broken images."
  },
  {
    id: "timeline-schedule-next-month",
    area: "Timeline",
    title: "Schedule date picker supports next month and later",
    scenario: "Open task schedule, navigate months forward, pick future dates, save, and verify persistence."
  },
  {
    id: "timeline-modal-alignment",
    area: "Timeline",
    title: "Task Schedule modal is aligned and themed",
    scenario: "Verify labels, fields, picker, and actions align with the app theme and spacing grid."
  },
  {
    id: "timeline-scroll-stability",
    area: "Timeline",
    title: "Timeline scrolling remains stable after copy/duplicate",
    scenario: "Perform copy/duplicate operations and confirm vertical scroll does not jump unexpectedly."
  },
  {
    id: "timeline-status-filter",
    area: "Timeline",
    title: "Status filter updates visible rows",
    scenario:
      "Toggle planned/in-progress/blocked/done and verify timeline rows update immediately, including branches whose visible status comes from computed child roll-up."
  },
  {
    id: "timeline-parent-rollup-range",
    area: "Timeline",
    title: "Parent range rolls up children range",
    scenario: "For parent folders, verify schedule start equals earliest child start and end equals latest child end."
  },
  {
    id: "timeline-status-no-tooltip",
    area: "Timeline",
    title: "Status pills have no default tooltip",
    scenario: "Hover status pills and confirm no browser tooltip overlays the timeline header."
  },
  {
    id: "timeline-keyboard-shortcuts-stay-on-surface",
    area: "Timeline",
    title: "Timeline keyboard shortcuts stay on the timeline surface",
    scenario:
      "In Timeline, verify F2 rename stays on the row editor, Ctrl+D duplicates the selected row into the visible branch, and Ctrl+C/Ctrl+V paste on the selected timeline row instead of leaking to the tree.",
    aiTester: {
      mode: "automated",
      priority: "critical",
      automationId: "timeline-keyboard-shortcuts-stay-on-surface",
      tags: ["timeline", "keyboard", "f2", "copy", "paste", "duplicate", "surface routing"],
      hints: ["Timeline shortcuts should not require waking up the tree", "timeline keyboard actions should stay on the selected row"]
    }
  },
  {
    id: "workspace-move-branch",
    area: "Workspace",
    title: "Move to Workspace succeeds for files and branches",
    scenario: "Move a selected file and a selected branch to another workspace and verify source removal, target insertion, target workspace focus, and preserved file open behavior after the move."
  },
  {
    id: "workspace-scope-list",
    area: "Workspace",
    title: "Workspace list only shows created/imported workspaces",
    scenario: "Open workspace selector and confirm no transient node names appear as workspaces."
  },
  {
    id: "workspace-root-numbering",
    area: "Workspace",
    title: "Root numbering toggle is optional",
    scenario: "Disable root numbering and verify roots are unnumbered while children keep numbering."
  },
  {
    id: "workspace-open-folder",
    area: "Workspace",
    title: "Open Folder works with no render blink",
    scenario: "Click Open Folder and confirm explorer opens directly without visible in-app flash."
  },
  {
    id: "workspace-import-compat",
    area: "Workspace",
    title: "Import folder handles versioned index data safely",
    scenario: "Import external folder and confirm no invalid revision deserialization error appears."
  },
  {
    id: "workspace-linked-mirror-no-sidecar-context",
    area: "Workspace",
    title: "Linked workspace mirror does not create .ode-context sidecars",
    scenario: "Generate or sync tree content inside a linked workspace and confirm mirrored folders only contain expected project folders/files, with no .ode-context helper files."
  },
  {
    id: "workspace-delete-themed-confirm",
    area: "Workspace",
    title: "Delete workspace uses themed modal",
    scenario: "Delete workspace and confirm custom ODE modal is used instead of native browser dialog."
  },
  {
    id: "workspace-linked-folder-resync-badge",
    area: "Workspace",
    title: "Linked workspace shows Re-sync action and external-change badge",
    scenario:
      "Modify a linked workspace folder outside ODETool, open Workspace Settings, and verify a visible Re-sync action appears together with an external changes badge before importing updates.",
    aiTester: {
      priority: "high",
      tags: ["workspace", "linked folder", "re-sync", "external changes", "badge"],
      hints: ["workspace settings should show re-sync", "linked folder changes should be detected"]
    }
  },
  {
    id: "favorites-quick-access-visible",
    area: "Favorites",
    title: "Quick Access is visible and populated",
    scenario: "Add favorites and verify Quick Access panel renders favorite tabs and nodes correctly."
  },
  {
    id: "favorites-group-create-and-select",
    area: "Favorites",
    title: "Favorite groups create once then select from list",
    scenario: "Create first group with +, then assign favorites via dropdown without prompt dialogs."
  },
  {
    id: "favorites-group-delete",
    area: "Favorites",
    title: "Favorite group delete removes group cleanly",
    scenario: "Delete a group and verify group tab, mappings, and list state update without leftovers."
  },
  {
    id: "favorites-quick-access-tab-layout",
    area: "Favorites",
    title: "Quick Access tabs layout matches policy",
    scenario: "Verify no default All tab before + and group tabs follow compact one-line layout."
  },
  {
    id: "favorites-quick-access-double-click-open",
    area: "Favorites",
    title: "Quick Access works as a launcher with focused group actions",
    scenario:
      "In Quick Access, single-click a folder or file favorite and verify ODETool opens it in the workspace and switches to Node Tree. Then right-click a favorite card and confirm the menu only shows launcher actions such as Open in Workspace, Manage Quick Access Groups, Remove from Quick Access, plus Preview File for files. Right-click a group header and empty Quick Access background and confirm those menus stay limited to group actions such as Show Group, Delete Group, and New Group.",
    aiTester: {
      priority: "high",
      tags: ["favorites", "quick access", "launcher", "context menu", "group actions", "open file", "open folder"],
      hints: [
        "single click should open the favorite and switch into Node Tree",
        "Quick Access card menus should only show launcher and group-management actions",
        "Quick Access group and background menus should not show New Topic or Paste"
      ]
    }
  },
  {
    id: "keyboard-clipboard-shortcuts",
    area: "Keyboard",
    title: "Copy/Cut/Paste/Delete/Duplicate shortcuts work on all surfaces",
    scenario:
      "Run Ctrl+C/Ctrl+X/Ctrl+V/Ctrl+D/Delete in tree, desktop, and timeline while selection is active, and confirm the active surface keeps ownership of the action.",
    aiTester: {
      priority: "high",
      tags: ["keyboard", "clipboard", "copy", "paste", "duplicate", "delete"],
      hints: ["shortcuts should work on all surfaces", "selection surface should own clipboard actions"]
    }
  },
  {
    id: "keyboard-backspace-navigate-up",
    area: "Keyboard",
    title: "Backspace navigates up one folder and keeps surface context",
    scenario:
      "Open a child folder in Desktop Grid and Mind Map, press Backspace, and verify ODETool returns to the parent folder while keeping the folder you came from selected on the same active surface.",
    aiTester: {
      mode: "automated",
      priority: "high",
      automationId: "keyboard-backspace-navigate-up",
      tags: ["keyboard", "backspace", "navigate up", "desktop", "mind map", "surface ownership"],
      hints: ["backspace should navigate to parent folder", "the current surface should keep ownership after navigate-up"]
    }
  },
  {
    id: "keyboard-multi-select",
    area: "Keyboard",
    title: "Windows-style focus and multi-select stays consistent",
    scenario:
      "In tree, desktop, mind map/details, and timeline, verify Arrow Up/Down moves focus, Shift+Arrow extends selection from the anchor, Ctrl+Arrow moves focus without collapsing selection, Ctrl+Space toggles the focused item, and Home/End plus Ctrl+Home/Ctrl+End jump correctly on the active surface.",
    aiTester: {
      priority: "critical",
      tags: ["windows behavior", "keyboard", "selection", "focus", "surface ownership", "multi-select"],
      hints: ["the clicked surface should own keyboard selection", "focus and selection should follow one Windows-like contract"]
    }
  },
  {
    id: "ui-help-release-sync",
    area: "UI",
    title: "Help and Release Notes stay aligned with shipped features",
    scenario: "Open Help and Release Notes and verify new behaviors are documented consistently across supported languages.",
    aiTester: {
      priority: "high",
      tags: ["help", "release notes", "documentation", "languages"]
    }
  },
  {
    id: "ui-qa-checklist-release-gate",
    area: "UI",
    title: "QA checklist is reviewed before packaging",
    scenario: "Before EXE/MSI packaging, verify checklist statuses are reviewed and critical scenarios are not left unresolved.",
    aiTester: {
      priority: "critical",
      tags: ["qa checklist", "release gate", "packaging", "critical scenarios"]
    }
  },
  {
    id: "ui-single-instance-and-utility-windows",
    area: "UI",
    title: "Second launch focuses existing app and utility panels reuse dedicated windows",
    scenario:
      "With ODETool already open, launch the EXE again and confirm the existing main window is focused instead of opening a second full app instance. Then open Release Notes, Help, and QA Checklist from the footer and confirm each opens or reuses its own utility window.",
    aiTester: {
      mode: "automated",
      automationId: "ui-single-instance-and-utility-windows",
      priority: "high",
      tags: ["single instance", "utility window", "focus existing app", "release notes", "help", "qa checklist"]
    }
  },
  {
    id: "ui-utility-window-controls",
    area: "UI",
    title: "Utility windows support minimize, maximize, restore, and close",
    scenario:
      "Open Release Notes, Help, and QA Checklist in their dedicated utility windows, then verify each header provides minimize, maximize/restore, and close actions and that double-clicking the header toggles maximize/restore.",
    aiTester: {
      mode: "automated",
      automationId: "ui-utility-window-controls",
      priority: "high",
      tags: ["utility windows", "minimize", "maximize", "restore", "close"]
    }
  },
  {
    id: "ui-main-window-multi-display-move",
    area: "UI",
    title: "Main window moves cleanly across multiple displays",
    scenario:
      "With two or more monitors connected, drag the main ODETool window from one display to another while restored, then repeat starting from a maximized window. Verify the window crosses monitors, keeps following the pointer, can be maximized on the new display, and still supports minimize/restore afterward.",
    aiTester: {
      mode: "manual",
      priority: "high",
      tags: ["multi display", "multi monitor", "main window", "drag", "maximize", "restore", "desktop shell"],
      hints: [
        "the main window should be able to leave the current monitor",
        "dragging from maximized should restore and continue moving on the target display",
        "maximize and restore should still work after the move"
      ]
    }
  },
  {
    id: "tree-organization-structure-lock",
    area: "Tree",
    title: "Organisation branches can be locked and unlocked from the tree",
    scenario:
      "In Organisation, right-click a normal branch that is not the workspace root and confirm Lock structure appears. Lock the branch, verify the lock badge appears on that node, and confirm creating, moving, or deleting nodes inside that branch is blocked. Then unlock the same branch and confirm those tree edits work again.",
    aiTester: {
      mode: "manual",
      priority: "high",
      tags: ["tree", "organisation", "structure lock", "context menu", "branch lock", "permissions"],
      hints: [
        "the action should appear on a regular organisation branch, not only on the workspace root",
        "descendants under a locked branch should reject tree structure edits",
        "unlocking the owner branch should restore normal tree editing"
      ]
    }
  },
  {
    id: "ui-qa-evidence-capture-flow",
    area: "UI",
    title: "QA proof attachments support clipboard images and files",
    scenario:
      "Open QA Checklist, mark one item as failed, then use From clipboard and Add files. Verify evidence attaches as proof, opens on click, and can be removed again without leaving stale UI state."
  },
  {
    id: "ui-qa-checklist-scroll-stability",
    area: "UI",
    title: "QA checklist scroll stays stable in the middle of the list",
    scenario:
      "Open QA Checklist, scroll to the middle, stop scrolling, and verify the list does not drift or bounce up and down on its own. Then close and reopen the checklist and confirm the saved position restores once without starting another scroll loop."
  },
  {
    id: "ui-no-default-browser-context-menu",
    area: "UI",
    title: "Default browser right-click menu is blocked",
    scenario: "Right-click empty surfaces and confirm only ODE custom menu behavior is shown."
  },
  {
    id: "ui-ai-command-bar-ctrl-k",
    area: "UI",
    title: "Ctrl+K opens redesigned command bar",
    scenario: "Open command bar, verify new layout, and run Plan/Confirm flow successfully.",
    aiTester: {
      mode: "automated",
      automationId: "ui-ai-command-bar-ctrl-k",
      priority: "high",
      tags: ["command bar", "ctrl+k", "keyboard", "planner"]
    }
  },
  {
    id: "ui-document-advisor-outline-routing",
    area: "UI",
    title: "AI Options recommends outline import for numbered documents",
    scenario: "Select a numbered document such as Tree.txt, confirm AI Options detects a numbered outline, recommends Import outline as tree, and creates real branch labels instead of generic fallback WBS titles."
  },
  {
    id: "ui-document-advisor-section-tree",
    area: "UI",
    title: "Section-only tree generation respects selected section",
    scenario: "In AI Options choose a detected section, verify the preview changes, run Create tree from section, and confirm only the chosen branch is generated."
  },
  {
    id: "ui-document-advisor-na-mapping",
    area: "UI",
    title: "AI Options maps a document to the right NA",
    scenario: "Select a document with a clear ODE domain such as systeme d'information or recrutement, open AI Options, confirm a recommended NA is shown, run Map document to NA, and verify the suggestion is saved without creating tree changes.",
    aiTester: {
      priority: "high",
      tags: ["ode", "na", "map document", "ai options", "classification"]
    }
  },
  {
    id: "ui-document-advisor-create-chantier",
    area: "UI",
    title: "AI Options creates a chantier under the mapped Level 4 NA",
    scenario: "In a workspace containing the ODE NA tree, select a document with a strong Level 4 NA match, open AI Options, run Create Chantier from AI, and verify a new Level 5 chantier is created under the mapped NA without altering Levels 1-4.",
    aiTester: {
      priority: "high",
      tags: ["ode", "chantier", "level 4", "ai options", "create chantier"]
    }
  },
  {
    id: "ui-ode-auto-chantier-routing",
    area: "UI",
    title: "Document WBS auto-switches to chantier mode inside ODE branches",
    scenario: "Select a structured document under a Level 4 NA or existing chantier, run Create WBS from document, and verify ODETool creates a chantier-aware branch under the correct ODE target instead of a generic WBS container.",
    aiTester: {
      priority: "high",
      tags: ["ode", "chantier", "document wbs", "routing", "level 4"]
    }
  },
  {
    id: "ui-ode-metadata-backfill",
    area: "UI",
    title: "Older ODE trees regain metadata on demand",
    scenario: "Open an older workspace whose ODE tree existed before metadata support, select a document or node inside that branch, run an AI action, and verify ODETool recognizes the branch as ODE without requiring a fresh re-import.",
    aiTester: {
      priority: "high",
      tags: ["ode", "metadata", "backfill", "legacy tree"]
    }
  },
  {
    id: "ui-root-enter-creates-top-level-branch",
    area: "UI",
    title: "Enter on workspace root creates a visible top-level branch",
    scenario: "Select the active workspace root node in tree or timeline, press Enter, and verify ODETool creates a new top-level child inside that workspace instead of an invisible node outside project scope.",
    aiTester: {
      mode: "automated",
      automationId: "ui-root-enter-creates-top-level-branch",
      priority: "high",
      tags: ["workspace root", "enter", "top-level branch", "keyboard creation"]
    }
  },
  {
    id: "ui-workspace-root-branch-actions-stay-scoped",
    area: "UI",
    title: "Root copy, paste, duplicate, and no-selection create stay inside workspace",
    scenario: "In an active workspace, verify Ctrl+V with no selection, Duplicate on the workspace root, and copy/paste from the root all create visible nodes inside the workspace while Cut on the fixed root is blocked."
  },
  {
    id: "ui-timeline-child-create-actions",
    area: "UI",
    title: "Timeline child creation works from Tab and New Topic",
    scenario: "In Timeline view, select a folder row, press Tab, and verify a visible child is created under that row. Then use right-click New Topic on the same row and on blank timeline space with that row selected, and verify creation stays under the visible timeline parent."
  },
  {
    id: "ui-context-menu-keyboard-default-action",
    area: "UI",
    title: "Right-click menus support Enter and keyboard navigation",
    scenario: "Open the context menu in tree, desktop, and timeline, verify the first enabled action is focused automatically, Enter runs it, and Arrow keys or Tab move focus without leaking to global shortcuts."
  },
  {
    id: "ui-multi-select-context-menu-actions",
    area: "UI",
    title: "Right-click keeps multi-selection for shared actions",
    scenario:
      "Select multiple sibling nodes in tree, desktop, and timeline, then right-click one of the already-selected nodes and verify the full selection stays intact so Copy, Cut, Duplicate, Move to Workspace, and Delete operate on the selected set instead of collapsing to one node."
  },
  {
    id: "ui-desktop-context-menu-default-action-all-views",
    area: "UI",
    title: "Desktop Grid, Mind Map, and Details share the same default menu action",
    scenario: "In Desktop Grid, Mind Map, and Details, right-click a folder card/row and press Enter immediately; verify New Topic runs as the default first action consistently across all three views."
  },
  {
    id: "ui-mindmap-root-node-interactions",
    area: "UI",
    title: "Mind Map root behaves like a real selected node",
    scenario:
      "In Mind Map Quick Access and Node Tree, click the center root card, confirm it becomes selected, right-click opens the normal node context menu, and F2, Enter, and double-click use the same root behavior as other nodes.",
    aiTester: {
      priority: "high",
      tags: ["mind map", "root", "selection", "context menu", "keyboard"],
      hints: ["mind map root should be selectable", "root should support shortcuts and right click"]
    }
  },
  {
    id: "ui-mindmap-connectors-only-where-branches-exist",
    area: "UI",
    title: "Mind Map connectors only render where branches exist",
    scenario:
      "Open horizontal and vertical Mind Map layouts on branches with missing left, right, or child branches and verify no decorative connector line remains where no node branch exists.",
    aiTester: {
      priority: "normal",
      tags: ["mind map", "connectors", "lines", "horizontal", "vertical"],
      hints: ["no empty connector stubs", "connectors should only appear for real branches"]
    }
  },
  {
    id: "ui-shared-create-routing-across-surfaces",
    area: "UI",
    title: "Surface default New Topic routing stays consistent",
    scenario: "Verify blank-space New Topic creates at workspace root in Tree, in the current folder for Desktop Grid/Mind Map/Details, and under the selected visible row in Timeline when one is selected; file targets should create a sibling instead of a child."
  },
  {
    id: "ui-desktop-filter-descendants-with-optional-parents",
    area: "UI",
    title: "Desktop state filters can recurse descendants with optional parents",
    scenario:
      "Apply Empty, Task, or Data filters in Desktop Grid/Mind Map/Details and verify matching descendants appear from the current folder even when direct children do not match; with Parents off, every ancestor folder up to the root must stay hidden so only direct matches remain; toggle Parents and verify those parent folders can then be shown on demand."
  },
  {
    id: "ui-timeline-filter-parents-optional",
    area: "UI",
    title: "Timeline filters can hide or show parents",
    scenario:
      "Apply one or more timeline status filters, including the case where all four status pills are enabled, and verify matching rows remain visible; with Parents off, every ancestor row up to the root must stay hidden even if that parent also has its own matching status; toggle Parents in the timeline header and confirm those parent rows appear only when the toggle is enabled.",
    aiTester: {
      mode: "automated",
      automationId: "ui-timeline-filter-parents-optional",
      priority: "critical",
      tags: ["timeline", "status filter", "parents", "computed status", "roll-up"],
      hints: ["filtered timeline rows should not go empty", "parents toggle should only add ancestors on demand"]
    }
  },
  {
    id: "ui-timeline-search-filters-scheduled-execution-tasks",
    area: "UI",
    title: "Timeline search isolates the scheduled execution task you asked for",
    scenario:
      "In Timeline, search for a unique execution task such as Task 111 and verify the result list and visible timeline rows narrow to the matching scheduled execution task and its owner context instead of leaving unrelated sibling tasks visible."
  },
  {
    id: "ui-search-prioritizes-visible-node-matches",
    area: "UI",
    title: "Sidebar search prefers visible node names and paths over internal metadata",
    scenario:
      "In Tree/Desktop/Mind Map, search for a unique task or file title and verify the dropdown prioritizes exact node-name or path matches instead of unrelated owners that only share hidden execution metadata or numeric internal properties."
  },
  {
    id: "ui-system-view-tabs-separate-objective-and-deliverables",
    area: "UI",
    title: "System view separates Objective and Deliverables cleanly",
    scenario:
      "Open Desktop > System and verify the editor is split into Objective and Deliverables tabs, with node title, description, and objective grouped together in Objective while deliverables and execution controls live in Deliverables."
  },
  {
    id: "ui-inline-rename-spellcheck",
    area: "UI",
    title: "Inline rename uses the themed ODE spelling menu",
    scenario: "Start renaming a node in tree and timeline, type a misspelled word, then right-click inside the input and verify the ODE-themed spelling menu appears with suggestions and text actions instead of the native browser or node context menu."
  },
  {
    id: "tree-ode-protected-level-guard",
    area: "Tree",
    title: "Protected ODE levels block AI branch creation above chantier level",
    scenario: "Import an ODE numbered outline as tree, select a protected Level 1-3 node, then confirm AI-generated WBS creation is blocked until a Level 4 NA node or existing chantier is selected.",
    aiTester: {
      priority: "critical",
      tags: ["ode", "protected levels", "ai guard", "chantier", "level 4"]
    }
  }
];
