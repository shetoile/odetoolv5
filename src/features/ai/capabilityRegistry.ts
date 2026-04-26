export type AiCapabilityCategory =
  | "workspace"
  | "planning"
  | "structure"
  | "timeline"
  | "review"
  | "quick_app"
  | "ticket"
  | "quality"
  | "release";

export type AiCapabilityHandlerKey =
  | "workspaceImport"
  | "workspaceCreate"
  | "workspaceSwitch"
  | "workspaceRename"
  | "workspaceSetLocation"
  | "workspaceSetDefault"
  | "workspaceOpenFolder"
  | "workspaceDelete"
  | "workspaceResync"
  | "planMyDay"
  | "wbsGenerate"
  | "wbsFromDocument"
  | "databaseCreateSection"
  | "treeCreateTopic"
  | "treeRenameSelected"
  | "treeMoveSelected"
  | "treeBulkCreate"
  | "favoriteSelected"
  | "desktopOpen"
  | "timelineOpen"
  | "timelineSetSchedule"
  | "timelineClearSchedule"
  | "documentReview"
  | "quickAppAdd"
  | "quickAppRemove"
  | "quickAppOpen"
  | "ticketCreate"
  | "ticketAnalyze"
  | "ticketDraftReply"
  | "runQa"
  | "draftReleaseNote";

export type AiCapabilityConfirmation = "none" | "preview" | "required";

export type AiCapabilityDefinition = {
  id: string;
  title: string;
  category: AiCapabilityCategory;
  description: string;
  args?: string;
  aliases: readonly string[];
  handlerKey: AiCapabilityHandlerKey;
  confirmation: AiCapabilityConfirmation;
  mutatesWorkspace: boolean;
};

export const AI_CAPABILITIES = [
  {
    id: "workspace_import",
    title: "Import workspace",
    category: "workspace",
    description: "Import a folder into ODE.",
    args: "{ path? }",
    aliases: ["import_folder", "workspace_import"],
    handlerKey: "workspaceImport",
    confirmation: "required",
    mutatesWorkspace: true
  },
  {
    id: "workspace_create",
    title: "Create workspace",
    category: "workspace",
    description: "Create a workspace.",
    args: "{ workspace_name, path? }",
    aliases: ["create_workspace", "new_workspace", "workspace_create"],
    handlerKey: "workspaceCreate",
    confirmation: "required",
    mutatesWorkspace: true
  },
  {
    id: "workspace_switch",
    title: "Switch workspace",
    category: "workspace",
    description: "Switch to a workspace.",
    args: "{ workspace_ref }",
    aliases: ["switch_workspace", "change_workspace", "workspace_switch"],
    handlerKey: "workspaceSwitch",
    confirmation: "preview",
    mutatesWorkspace: false
  },
  {
    id: "workspace_rename",
    title: "Rename workspace",
    category: "workspace",
    description: "Rename a workspace.",
    args: "{ workspace_ref?, new_name }",
    aliases: ["rename_workspace", "workspace_rename"],
    handlerKey: "workspaceRename",
    confirmation: "required",
    mutatesWorkspace: true
  },
  {
    id: "workspace_set_location",
    title: "Set workspace location",
    category: "workspace",
    description: "Link or set a workspace folder path.",
    args: "{ workspace_ref?, path }",
    aliases: ["set_workspace_location", "workspace_set_location", "link_workspace_folder"],
    handlerKey: "workspaceSetLocation",
    confirmation: "required",
    mutatesWorkspace: true
  },
  {
    id: "workspace_set_default",
    title: "Set default workspace",
    category: "workspace",
    description: "Set the default workspace.",
    args: "{ workspace_ref? }",
    aliases: ["set_workspace_default", "workspace_set_default", "workspace_default"],
    handlerKey: "workspaceSetDefault",
    confirmation: "required",
    mutatesWorkspace: true
  },
  {
    id: "workspace_open_folder",
    title: "Open workspace folder",
    category: "workspace",
    description: "Open the workspace folder in the system explorer.",
    args: "{ workspace_ref? }",
    aliases: ["open_workspace_folder", "workspace_open_folder"],
    handlerKey: "workspaceOpenFolder",
    confirmation: "preview",
    mutatesWorkspace: false
  },
  {
    id: "workspace_delete",
    title: "Delete workspace",
    category: "workspace",
    description: "Delete a workspace.",
    args: "{ workspace_ref? }",
    aliases: ["delete_workspace", "remove_workspace", "workspace_delete"],
    handlerKey: "workspaceDelete",
    confirmation: "required",
    mutatesWorkspace: true
  },
  {
    id: "workspace_resync",
    title: "Re-sync workspace",
    category: "workspace",
    description: "Re-sync the selected workspace.",
    args: "{ workspace_ref? }",
    aliases: ["resync_workspace", "workspace_resync"],
    handlerKey: "workspaceResync",
    confirmation: "required",
    mutatesWorkspace: true
  },
  {
    id: "plan_my_day",
    title: "Plan my day",
    category: "planning",
    description: "Build a short AI focus plan from current workspace context.",
    aliases: ["plan_my_day", "my_day_plan", "daily_plan"],
    handlerKey: "planMyDay",
    confirmation: "preview",
    mutatesWorkspace: false
  },
  {
    id: "wbs_generate",
    title: "Generate WBS",
    category: "planning",
    description: "Generate recursive AI WBS under the current context.",
    args: "{ goal }",
    aliases: ["wbs_generate", "ai_wbs", "generate_wbs", "work_breakdown", "create_wbs"],
    handlerKey: "wbsGenerate",
    confirmation: "required",
    mutatesWorkspace: true
  },
  {
    id: "wbs_from_document",
    title: "Generate WBS from document",
    category: "planning",
    description: "Generate recursive AI WBS from selected document or file context.",
    args: "{ goal? }",
    aliases: ["wbs_from_document", "document_wbs", "file_wbs", "create_wbs_from_document", "create_wbs_from_file"],
    handlerKey: "wbsFromDocument",
    confirmation: "required",
    mutatesWorkspace: true
  },
  {
    id: "database_create_section",
    title: "Create database section",
    category: "structure",
    description: "Create a database section and optional aligned fields.",
    args: "{ section_name?, fields?: string[] }",
    aliases: ["create_database_section", "database_create_section", "database_section", "database_schema", "create_schema", "create_database_schema"],
    handlerKey: "databaseCreateSection",
    confirmation: "required",
    mutatesWorkspace: true
  },
  {
    id: "tree_create_topic",
    title: "Create topic",
    category: "structure",
    description: "Create a new topic node in the current context.",
    aliases: ["create_topic", "tree_create_topic"],
    handlerKey: "treeCreateTopic",
    confirmation: "required",
    mutatesWorkspace: true
  },
  {
    id: "tree_rename_selected",
    title: "Rename selected node",
    category: "structure",
    description: "Rename the selected node.",
    args: "{ new_name }",
    aliases: ["rename_selected", "rename_node", "tree_rename_selected"],
    handlerKey: "treeRenameSelected",
    confirmation: "required",
    mutatesWorkspace: true
  },
  {
    id: "tree_move_selected",
    title: "Move selected node",
    category: "structure",
    description: "Move selected node(s) into a target folder.",
    args: "{ target_ref }",
    aliases: ["move_selected", "move_node", "tree_move_selected"],
    handlerKey: "treeMoveSelected",
    confirmation: "required",
    mutatesWorkspace: true
  },
  {
    id: "tree_bulk_create",
    title: "Bulk create nodes",
    category: "structure",
    description: "Create multiple topics under the current context.",
    args: "{ names: string[] }",
    aliases: ["bulk_create", "tree_bulk_create"],
    handlerKey: "treeBulkCreate",
    confirmation: "required",
    mutatesWorkspace: true
  },
  {
    id: "favorite_selected",
    title: "Favorite selected node",
    category: "structure",
    description: "Add selected node to favorites and optional group.",
    args: "{ group? }",
    aliases: ["favorite_selected", "add_favorite", "pin_favorite", "bookmark_selected"],
    handlerKey: "favoriteSelected",
    confirmation: "preview",
    mutatesWorkspace: true
  },
  {
    id: "desktop_open",
    title: "Open desktop view",
    category: "structure",
    description: "Switch to Desktop view.",
    aliases: ["open_desktop", "desktop_open"],
    handlerKey: "desktopOpen",
    confirmation: "none",
    mutatesWorkspace: false
  },
  {
    id: "timeline_open",
    title: "Open timeline view",
    category: "timeline",
    description: "Switch to Timeline view.",
    aliases: ["open_timeline", "timeline_open"],
    handlerKey: "timelineOpen",
    confirmation: "none",
    mutatesWorkspace: false
  },
  {
    id: "timeline_set_schedule",
    title: "Set schedule",
    category: "timeline",
    description: "Set selected node schedule.",
    args: "{ start_date, end_date, status, predecessor?, title? }",
    aliases: ["set_schedule", "timeline_set_schedule"],
    handlerKey: "timelineSetSchedule",
    confirmation: "required",
    mutatesWorkspace: true
  },
  {
    id: "timeline_clear_schedule",
    title: "Clear schedule",
    category: "timeline",
    description: "Clear selected node schedule.",
    aliases: ["clear_schedule", "timeline_clear_schedule"],
    handlerKey: "timelineClearSchedule",
    confirmation: "required",
    mutatesWorkspace: true
  },
  {
    id: "document_review",
    title: "Review documents and apps",
    category: "review",
    description: "Review documents, links, or grounded quick apps in the selected context.",
    args: "{ goal?, output_format?, report_title? }",
    aliases: ["document_review", "review_documents", "review_docs"],
    handlerKey: "documentReview",
    confirmation: "preview",
    mutatesWorkspace: false
  },
  {
    id: "quick_app_add",
    title: "Add quick app",
    category: "quick_app",
    description: "Add a quick app link, local app, or HTML target.",
    args: "{ label?, target, scope?, type? }",
    aliases: ["add_quick_app", "create_quick_app", "quick_app_add"],
    handlerKey: "quickAppAdd",
    confirmation: "required",
    mutatesWorkspace: true
  },
  {
    id: "quick_app_remove",
    title: "Remove quick app",
    category: "quick_app",
    description: "Remove a quick app.",
    args: "{ item_ref, scope? }",
    aliases: ["remove_quick_app", "delete_quick_app", "quick_app_remove"],
    handlerKey: "quickAppRemove",
    confirmation: "required",
    mutatesWorkspace: true
  },
  {
    id: "quick_app_open",
    title: "Open quick app",
    category: "quick_app",
    description: "Open a quick app.",
    args: "{ item_ref, scope? }",
    aliases: ["open_quick_app", "launch_quick_app", "quick_app_open"],
    handlerKey: "quickAppOpen",
    confirmation: "preview",
    mutatesWorkspace: false
  },
  {
    id: "ticket_create",
    title: "Create ticket",
    category: "ticket",
    description: "Create a support ticket node.",
    aliases: ["create_ticket", "ticket_create"],
    handlerKey: "ticketCreate",
    confirmation: "required",
    mutatesWorkspace: true
  },
  {
    id: "ticket_analyze",
    title: "Analyze ticket",
    category: "ticket",
    description: "Analyze the selected ticket with AI.",
    aliases: ["analyze_ticket", "ticket_analyze"],
    handlerKey: "ticketAnalyze",
    confirmation: "preview",
    mutatesWorkspace: false
  },
  {
    id: "ticket_draft_reply",
    title: "Draft ticket reply",
    category: "ticket",
    description: "Draft a reply for the selected ticket.",
    args: "{ instructions? }",
    aliases: ["draft_ticket_reply", "ticket_draft_reply"],
    handlerKey: "ticketDraftReply",
    confirmation: "preview",
    mutatesWorkspace: false
  },
  {
    id: "run_qa",
    title: "Run QA",
    category: "quality",
    description: "Run quality gate.",
    aliases: ["run_qa", "qa_run"],
    handlerKey: "runQa",
    confirmation: "preview",
    mutatesWorkspace: false
  },
  {
    id: "draft_release_note",
    title: "Draft release note",
    category: "release",
    description: "Draft release note from current context and QA.",
    aliases: ["draft_release_note", "release_note_draft"],
    handlerKey: "draftReleaseNote",
    confirmation: "preview",
    mutatesWorkspace: false
  }
] as const satisfies readonly AiCapabilityDefinition[];

export type AiCommandActionId = (typeof AI_CAPABILITIES)[number]["id"];
export type RegisteredAiCapability = (typeof AI_CAPABILITIES)[number];

export const AI_COMMAND_ACTION_IDS = AI_CAPABILITIES.map(
  (capability) => capability.id
) as AiCommandActionId[];

const normalizeCapabilityKey = (value: string): string =>
  value.trim().toLowerCase().replace(/[\s-]+/g, "_");

const AI_CAPABILITY_ALIAS_MAP: Record<string, AiCommandActionId> = AI_CAPABILITIES.reduce(
  (map, capability) => {
    map[normalizeCapabilityKey(capability.id)] = capability.id;
    for (const alias of capability.aliases) {
      map[normalizeCapabilityKey(alias)] = capability.id;
    }
    return map;
  },
  {} as Record<string, AiCommandActionId>
);

export function normalizeAiCapabilityActionId(value: string | null | undefined): AiCommandActionId | null {
  if (!value) return null;
  return AI_CAPABILITY_ALIAS_MAP[normalizeCapabilityKey(value)] ?? null;
}

export function getAiCapabilityDefinition(actionId: AiCommandActionId | null | undefined): RegisteredAiCapability | null {
  if (!actionId) return null;
  return AI_CAPABILITIES.find((capability) => capability.id === actionId) ?? null;
}

export function getAiCapabilityHandlerKey(actionId: AiCommandActionId): AiCapabilityHandlerKey {
  const definition = getAiCapabilityDefinition(actionId);
  if (!definition) throw new Error(`Unsupported action: ${actionId}`);
  return definition.handlerKey;
}

export function buildAiCapabilityPlannerCatalog(): string {
  return AI_CAPABILITIES.map((capability) => {
    const args = "args" in capability ? capability.args : "";
    return `${capability.id}: ${capability.description}${args ? ` args: ${args}` : ""}`;
  }).join("\n");
}

function parseArgsString(args: Record<string, unknown> | undefined, key: string): string {
  const value = args?.[key];
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function parseArgsNames(args: Record<string, unknown> | undefined): string[] {
  const value = args?.names;
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
  }
  if (typeof value === "string") {
    return value
      .split(/[,;\n|]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
}

function parseArgsList(args: Record<string, unknown> | undefined, key: string): string[] {
  const value = args?.[key];
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
  }
  if (typeof value === "string") {
    return value
      .split(/[,;\n|]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
}

export function buildAiCapabilityPreview(
  actionId: AiCommandActionId | null,
  args: Record<string, unknown>,
  context: {
    selectedLabel: string;
    workspaceName: string;
  }
): string[] {
  if (!actionId) return ["No executable action identified yet."];
  const { selectedLabel, workspaceName } = context;

  if (actionId === "workspace_import") {
    const path = parseArgsString(args, "path");
    return [
      path
        ? `Import workspace from "${path}".`
        : "Open folder picker and import a workspace from your PC path."
    ];
  }
  if (actionId === "workspace_create") {
    const name = parseArgsString(args, "workspace_name");
    const path = parseArgsString(args, "path");
    return [
      `Create workspace "${name || "(missing name)"}".`,
      path ? `Linked folder path: ${path}` : "Workspace location: internal/local default."
    ];
  }
  if (actionId === "workspace_switch") {
    return [`Switch to workspace "${parseArgsString(args, "workspace_ref") || "(missing workspace)"}".`];
  }
  if (actionId === "workspace_rename") {
    return [
      `Rename workspace "${parseArgsString(args, "workspace_ref") || workspaceName}" to "${parseArgsString(args, "new_name") || "(missing name)"}".`
    ];
  }
  if (actionId === "workspace_set_location") {
    return [
      `Set workspace "${parseArgsString(args, "workspace_ref") || workspaceName}" location path.`,
      `Path: ${parseArgsString(args, "path") || "(missing path)"}`
    ];
  }
  if (actionId === "workspace_set_default") {
    return [`Set workspace "${parseArgsString(args, "workspace_ref") || workspaceName}" as default.`];
  }
  if (actionId === "workspace_open_folder") {
    return [`Open the folder for workspace "${parseArgsString(args, "workspace_ref") || workspaceName}".`];
  }
  if (actionId === "workspace_delete") {
    return [`Delete workspace "${parseArgsString(args, "workspace_ref") || workspaceName}".`];
  }
  if (actionId === "workspace_resync") {
    return [
      `Re-sync workspace "${parseArgsString(args, "workspace_ref") || workspaceName}" with linked folder path.`
    ];
  }
  if (actionId === "plan_my_day") {
    return [
      "Generate an AI focus plan from the current workspace context.",
      "Copy the result to clipboard for quick use."
    ];
  }
  if (actionId === "wbs_generate") {
    const goal = parseArgsString(args, "goal") || selectedLabel;
    return [
      `Generate AI WBS for "${goal}".`,
      "Create recursive topic tree with prerequisites, effort, and role metadata.",
      "Mark critical path/blockers and keep the value summary on the WBS root."
    ];
  }
  if (actionId === "wbs_from_document") {
    const goal = parseArgsString(args, "goal") || selectedLabel;
    return [
      `Review the extracted tree from selected document context for "${goal}".`,
      "Read uploaded document text from selected file(s) or current scope.",
      "Show the proposed hierarchy before anything is added to the workspace."
    ];
  }
  if (actionId === "database_create_section") {
    const sectionName = parseArgsString(args, "section_name");
    const fields = parseArgsList(args, "fields");
    return [
      sectionName
        ? `Create database section "${sectionName}" in the selected context (${selectedLabel}).`
        : `Add aligned database fields in the selected context (${selectedLabel}).`,
      fields.length > 0 ? `Fields: ${fields.join(", ")}` : "Fields: infer or add from the request."
    ];
  }
  if (actionId === "tree_create_topic") {
    return [`Create a new topic under selected context (${selectedLabel}).`];
  }
  if (actionId === "tree_rename_selected") {
    return [`Rename selected node (${selectedLabel}) to "${parseArgsString(args, "new_name") || "(missing name)"}".`];
  }
  if (actionId === "tree_move_selected") {
    return [`Move selected node(s) (${selectedLabel}) to target "${parseArgsString(args, "target_ref") || "(missing target)"}".`];
  }
  if (actionId === "tree_bulk_create") {
    const names = parseArgsNames(args);
    return names.length > 0
      ? [`Create ${names.length} node(s) under selected context.`, `Names: ${names.join(", ")}`]
      : ["Create multiple nodes under selected context (names not resolved)."];
  }
  if (actionId === "favorite_selected") {
    const group = parseArgsString(args, "group");
    return [group ? `Add selected node to favorite group "${group}".` : "Add selected node to favorites."];
  }
  if (actionId === "desktop_open") return ["Switch application to Desktop view."];
  if (actionId === "timeline_open") return ["Switch application to Timeline view."];
  if (actionId === "timeline_set_schedule") {
    const start = parseArgsString(args, "start_date");
    const end = parseArgsString(args, "end_date");
    const status = parseArgsString(args, "status") || "planned";
    return [
      `Set schedule for selected node (${selectedLabel}).`,
      `Start: ${start || "(missing)"} | End: ${end || "(missing)"} | Status: ${status}`
    ];
  }
  if (actionId === "timeline_clear_schedule") {
    return [`Clear schedule for selected node (${selectedLabel}).`];
  }
  if (actionId === "document_review") {
    const goal = parseArgsString(args, "goal");
    const outputFormat = parseArgsString(args, "output_format");
    return [
      goal ? `Run grounded document review: "${goal}".` : "Run grounded document review for current scope.",
      outputFormat === "pdf" ? "Save the review as a PDF report after generation." : "Copy the review result to clipboard."
    ];
  }
  if (actionId === "quick_app_add") {
    const label = parseArgsString(args, "label");
    const target = parseArgsString(args, "target");
    const scope = parseArgsString(args, "scope") || "active scope";
    return [
      `Add quick app ${label ? `"${label}"` : "(auto label)"} in ${scope} scope.`,
      `Target: ${target || "(missing target)"}`
    ];
  }
  if (actionId === "quick_app_remove") {
    return [
      `Remove quick app "${parseArgsString(args, "item_ref") || "(missing quick app)"}"${parseArgsString(args, "scope") ? ` from ${parseArgsString(args, "scope")} scope` : ""}.`
    ];
  }
  if (actionId === "quick_app_open") {
    return [
      `Open quick app "${parseArgsString(args, "item_ref") || "(missing quick app)"}"${parseArgsString(args, "scope") ? ` from ${parseArgsString(args, "scope")} scope` : ""}.`
    ];
  }
  if (actionId === "ticket_create") return ["Create a new support ticket node in current context."];
  if (actionId === "ticket_analyze") return ["Run AI analysis on selected ticket content."];
  if (actionId === "ticket_draft_reply") {
    const instructions = parseArgsString(args, "instructions");
    return [
      "Draft a professional ticket reply with AI.",
      instructions ? `Instructions: ${instructions}` : "Instructions: default professional + empathetic tone."
    ];
  }
  if (actionId === "run_qa") return ["Run quality gate (catalog, typecheck, build, Rust tests)."];
  if (actionId === "draft_release_note") return ["Generate release note draft from current context and last QA output."];
  return ["Action planned."];
}
