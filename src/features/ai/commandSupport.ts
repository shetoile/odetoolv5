import { type AiCommandActionId } from "@/features/ai/commandPlanner";

export function parseArgsString(args: Record<string, unknown> | undefined, key: string): string {
  const value = args?.[key];
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function parseArgsNames(args: Record<string, unknown> | undefined): string[] {
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

export function parseArgsList(args: Record<string, unknown> | undefined, key: string): string[] {
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

export function buildAiPlanPreview(
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
    return ["Open folder picker and import a workspace from your PC path."];
  }
  if (actionId === "workspace_resync") {
    return [`Re-sync workspace "${workspaceName}" with linked folder path.`];
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
    const fieldSpecs = Array.isArray(args?.field_specs) ? args?.field_specs : [];
    return [
      sectionName
        ? `Create database section "${sectionName}" in the Database workspace${selectedLabel ? ` (current selection: ${selectedLabel})` : ""}.`
        : `Add aligned database fields in the Database workspace${selectedLabel ? ` (current selection: ${selectedLabel})` : ""}.`,
      fields.length > 0
        ? `Fields: ${fields.join(", ")}`
        : fieldSpecs.length > 0
          ? `Fields: ${fieldSpecs.length} structured field spec(s).`
          : "Fields: infer or add from the request.",
      "Fields can stay dynamic with types, formulas, relations, priority scales, auto values, and workflow roles."
    ];
  }
  if (actionId === "database_seed_examples") {
    const sectionName = parseArgsString(args, "section_name") || selectedLabel;
    const count = parseArgsString(args, "count") || "3";
    const scenario = parseArgsString(args, "scenario");
    return [
      `Create ${count} example record(s) in "${sectionName}".`,
      scenario ? `Scenario: ${scenario}` : "Scenario: infer realistic examples from the section fields and current workspace context.",
      "Append the example rows without deleting existing records."
    ];
  }
  if (actionId === "dashboard_widget_create") {
    const title = parseArgsString(args, "title") || "New Widget";
    const widgetType = parseArgsString(args, "widget_type") || "metric";
    const sourceRef = parseArgsString(args, "source_ref");
    const groupField = parseArgsString(args, "group_field");
    const secondaryGroupField = parseArgsString(args, "secondary_group_field");
    return [
      `Create a ${widgetType} widget named "${title}" under the current node (${selectedLabel}).`,
      sourceRef ? `Source: ${sourceRef}` : "Source: infer the best current table or execution context.",
      groupField && secondaryGroupField
        ? `Fields: ${groupField} x ${secondaryGroupField}`
        : groupField
          ? `Field: ${groupField}`
          : "Fields: infer the best grouping/filter fields from the request."
    ];
  }
  if (actionId === "governance_framework_generate") {
    const frameworkName = parseArgsString(args, "framework_name") || selectedLabel || "Governance Framework";
    const modules = parseArgsList(args, "modules");
    const goal = parseArgsString(args, "goal");
    return [
      `Generate a dynamic governance framework for "${frameworkName}".`,
      goal ? `Goal: ${goal}` : "Goal: infer from the request and current context.",
      modules.length > 0
        ? `Modules: ${modules.join(", ")}`
        : "Modules: infer the right registers, controls, actions, reviews, and insights from the request.",
      "Create a framework root with dynamic sections, priority fields, scoring config, and dashboard widgets. Save the framework definition on the node for reuse."
    ];
  }
  if (actionId === "execution_task_create") {
    const title = parseArgsString(args, "title");
    const names = parseArgsNames(args);
    const scenario = parseArgsString(args, "scenario");
    const deliverableTitle = parseArgsString(args, "deliverable_title");
    const dueDate = parseArgsString(args, "due_date");
    const status = parseArgsString(args, "status") || "planned";
    return [
      title
        ? `Create execution task "${title}"${deliverableTitle ? ` in deliverable "${deliverableTitle}"` : ""}.`
        : names.length > 0
        ? `Create ${names.length} execution task(s)${deliverableTitle ? ` in deliverable "${deliverableTitle}"` : ""}.`
          : scenario
            ? `Create follow-up execution task(s) for "${scenario}"${deliverableTitle ? ` in deliverable "${deliverableTitle}"` : ""}.`
            : `Create execution task(s) in the current workarea context (${selectedLabel}).`,
      `Status: ${status}${dueDate ? ` | Due: ${dueDate}` : ""}`,
      "Update structured deliverables and sync the execution projection nodes."
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
    return [goal ? `Run grounded document review: "${goal}".` : "Run grounded document review for current scope."];
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
