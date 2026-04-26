import {
  AI_COMMAND_ACTION_IDS,
  buildAiCapabilityPlannerCatalog,
  normalizeAiCapabilityActionId,
  type AiCommandActionId
} from "@/features/ai/capabilityRegistry";

export { AI_COMMAND_ACTION_IDS, type AiCommandActionId };

export type AiPlannerParseResult = {
  actionId: AiCommandActionId | null;
  args: Record<string, unknown>;
  reason: string | null;
  steps: string[];
  confidence: number;
  requiresConfirmation: boolean;
};

export function normalizeAiCommandActionId(value: string | null | undefined): AiCommandActionId | null {
  return normalizeAiCapabilityActionId(value);
}

export function inferAiCommandActionId(commandText: string): AiCommandActionId | null {
  const text = commandText.toLowerCase();
  const workspaceMentioned = text.includes("workspace");
  const quickAppMentioned = text.includes("quick app") || text.includes("quickapp");
  const htmlMentioned = /\bhtml\b/.test(text);
  const hasDatabaseIntent =
    (text.includes("database") ||
      text.includes("schema") ||
      text.includes("field") ||
      text.includes("fields") ||
      text.includes("column") ||
      text.includes("columns")) &&
    (text.includes("create") ||
      text.includes("add") ||
      text.includes("build") ||
      text.includes("generate") ||
      text.includes("make"));
  if ((text.includes("wbs") || text.includes("work breakdown") || text.includes("break down") || text.includes("breakdown")) &&
    (text.includes("document") || text.includes("documents") || text.includes("doc") || text.includes("file") || text.includes("pdf") || text.includes("proposal") || text.includes("brief") || text.includes("report") || text.includes("upload"))) {
    return "wbs_from_document";
  }
  if (workspaceMentioned && (text.includes("create") || text.includes("new") || text.includes("add"))) return "workspace_create";
  if (workspaceMentioned && text.includes("folder") && (text.includes("show") || text.includes("open") || text.includes("reveal"))) return "workspace_open_folder";
  if (workspaceMentioned && (text.includes("switch") || text.includes("change") || text.includes("open") || text.includes("go to"))) return "workspace_switch";
  if (workspaceMentioned && text.includes("rename")) return "workspace_rename";
  if (workspaceMentioned && (text.includes("location") || text.includes("folder path") || text.includes("workspace path") || text.includes("link folder") || text.includes("set path"))) return "workspace_set_location";
  if (workspaceMentioned && text.includes("default")) return "workspace_set_default";
  if (workspaceMentioned && (text.includes("delete") || text.includes("remove"))) return "workspace_delete";
  if (quickAppMentioned && (text.includes("add") || text.includes("create") || text.includes("save"))) return "quick_app_add";
  if (quickAppMentioned && (text.includes("remove") || text.includes("delete"))) return "quick_app_remove";
  if ((quickAppMentioned || htmlMentioned) && (text.includes("review") || text.includes("analyze") || text.includes("analyse") || text.includes("summarize") || text.includes("summary") || text.includes("feedback") || text.includes("report"))) {
    return "document_review";
  }
  if (quickAppMentioned && (text.includes("open") || text.includes("launch") || text.includes("run"))) return "quick_app_open";
  if (text.includes("plan my day") || text.includes("my day") || text.includes("daily plan") || text.includes("focus list")) return "plan_my_day";
  if (text.includes("wbs") || text.includes("work breakdown") || text.includes("break down") || text.includes("breakdown")) return "wbs_generate";
  if (text.includes("import")) return "workspace_import";
  if (text.includes("re-sync") || text.includes("resync") || text.includes("synchronize") || text.includes("sync")) return "workspace_resync";
  if (text.includes("clear schedule") || text.includes("remove schedule") || text.includes("delete schedule")) return "timeline_clear_schedule";
  if ((text.includes("review") || text.includes("analyze") || text.includes("summarize")) && (text.includes("document") || text.includes("documents") || text.includes("doc") || text.includes("file"))) return "document_review";
  if (text.includes("schedule") || text.includes("deadline") || text.includes("start date") || text.includes("end date")) return "timeline_set_schedule";
  if (text.includes("timeline")) return "timeline_open";
  if (text.includes("desktop")) return "desktop_open";
  if (hasDatabaseIntent) return "database_create_section";
  if (text.includes("rename")) return "tree_rename_selected";
  if (text.includes("move")) return "tree_move_selected";
  if ((text.includes("bulk") || text.includes("batch") || text.includes("multiple")) && (text.includes("create") || text.includes("add"))) return "tree_bulk_create";
  if (text.includes("favorite") || text.includes("favourite") || text.includes("bookmark") || text.includes("quick access")) return "favorite_selected";
  if ((text.includes("reply") || text.includes("response") || text.includes("respond")) && text.includes("ticket")) return "ticket_draft_reply";
  if (text.includes("analyze") && text.includes("ticket")) return "ticket_analyze";
  if (text.includes("ticket")) return "ticket_create";
  if (text.includes("qa") || text.includes("quality") || text.includes("test")) return "run_qa";
  if (text.includes("release")) return "draft_release_note";
  if (text.includes("node") || text.includes("topic") || text.includes("tree")) return "tree_create_topic";
  return null;
}

export function shouldSkipAiPlannerForCommand(commandText: string, heuristicAction: AiCommandActionId | null): boolean {
  if (heuristicAction !== "wbs_generate" && heuristicAction !== "wbs_from_document") return false;
  const normalized = commandText.trim().toLowerCase();
  if (!normalized || normalized.length > 160 || normalized.includes("?")) return false;
  return !/\b(and|then|after|also|plus|compare|review|analyze|summarize|rename|move|schedule|timeline|desktop|ticket|import|sync|if|when)\b/.test(normalized);
}

export function resolveDocumentAwareAiCommandAction(
  candidate: AiCommandActionId | null,
  options: { preferDocumentWbs: boolean; wbsIntentRequested: boolean; }
): AiCommandActionId | null {
  if (!candidate) {
    return options.preferDocumentWbs && options.wbsIntentRequested ? "wbs_from_document" : null;
  }
  if (candidate === "wbs_generate" && options.preferDocumentWbs) {
    return "wbs_from_document";
  }
  return candidate;
}

export function buildAiPlannerPrompts(commandText: string, context: string): {
  systemPrompt: string;
  userPrompt: string;
} {
  const actionCatalog = buildAiCapabilityPlannerCatalog();

  return {
    systemPrompt: [
      "You are ODETool AI command planner.",
      "Return exactly one JSON object and no markdown.",
      "Do not include actions outside the allowed action list.",
      "Base the action on the grounded context, including documents and quick-app evidence when present.",
      "Prefer review-first or non-destructive actions when the request is ambiguous or the evidence is thin.",
      "Keep args minimal and safe.",
      "If no safe action exists, set action_id to null."
    ].join(" "),
    userPrompt: [
      "User command:",
      commandText,
      "",
      "Context:",
      context,
      "",
      "Allowed actions:",
      actionCatalog,
      "",
      "Return JSON schema:",
      "{",
      '  "intent": "string",',
      '  "action_id": "string | null",',
      '  "args": { },',
      '  "reason": "string",',
      '  "steps": ["string"],',
      '  "confidence": "number between 0 and 1",',
      '  "requires_confirmation": true',
      "}",
      "No markdown. No extra text."
    ].join("\n")
  };
}

function extractDelimitedList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[,;\n|]/)
        .map((item) => item.trim().replace(/^\"|\"$/g, ""))
        .filter((item) => item.length > 0)
    )
  ).slice(0, 25);
}

function extractDatabaseSectionName(text: string): string {
  const match =
    text.match(/\b(?:section|table|schema)\s+(?:named|called)\s+\"?([^\"\n,]+?)\"?(?:\s+(?:with|including)\b|$)/i) ??
    text.match(/\bcreate\s+(?:a|an|the)?\s*\"?([^\"\n,]+?)\"?\s+(?:database\s+)?(?:section|table|schema)\b/i) ??
    text.match(/\b(?:database|schema)\s+(?:for|named|called)\s+\"?([^\"\n,]+?)\"?(?:\s+(?:with|including)\b|$)/i);
  return match?.[1]?.trim() ?? "";
}

function extractDatabaseFields(text: string): string[] {
  const source =
    text.match(/\b(?:fields?|columns?)\s*(?:\:|->|=|include|includes|including)\s*(.+)$/i)?.[1] ??
    text.match(/\bwith\s+(.+?)\s+(?:as\s+)?(?:fields?|columns?)\b/i)?.[1] ??
    "";
  if (!source) return [];
  const values = extractDelimitedList(source);
  return values.length >= 2 ? values : [];
}

function extractQuotedSegments(text: string): string[] {
  return Array.from(
    text.matchAll(/"([^"\n]+)"|'([^'\n]+)'/g),
    (match) => (match[1] ?? match[2] ?? "").trim()
  ).filter((value) => value.length > 0);
}

function extractUrlFromText(text: string): string {
  return text.match(/\bhttps?:\/\/[^\s"'`]+/i)?.[0]?.trim() ?? "";
}

function extractPathFromText(text: string): string {
  const windowsPath =
    text.match(/\b[a-zA-Z]:\\[^"'`\n]+/i)?.[0] ??
    text.match(/\b[a-zA-Z]:\/[^"'`\n]+/i)?.[0] ??
    "";
  if (windowsPath) return windowsPath.trim();
  const unixPath = text.match(/(?:^|\s)(\/[^"'`\n]+)(?=\s|$)/)?.[1] ?? "";
  return unixPath.trim();
}

function extractWorkspaceReference(text: string): string {
  return (
    text.match(/\bworkspace\s+(?:named|called)\s+["']?([^"'\n]+?)["']?(?:\s+(?:to|as|at|in|path|location)\b|$)/i)?.[1] ??
    text.match(/\b(?:switch|change|open|delete|remove|resync|sync)\s+(?:to\s+)?workspace\s+["']?([^"'\n]+?)["']?$/i)?.[1] ??
    text.match(/\bworkspace\s+["']?([^"'\n]+?)["']?\s+(?:folder|path|location|default)\b/i)?.[1] ??
    ""
  ).trim();
}

function extractWorkspaceCreateName(text: string): string {
  return (
    text.match(/\b(?:create|new|add)\s+workspace\s+(?:named|called)\s+["']?([^"'\n]+?)["']?(?:\s+(?:at|in|path|location)\b|$)/i)?.[1] ??
    text.match(/\b(?:create|new|add)\s+workspace\s+["']?([^"'\n]+?)["']?(?:\s+(?:at|in|path|location)\b|$)/i)?.[1] ??
    ""
  ).trim();
}

function extractWorkspaceRenameArgs(text: string): { workspaceRef?: string; newName?: string } {
  const explicitRefMatch = text.match(
    /\brename\s+workspace\s+["']?([^"'\n]+?)["']?\s+(?:to|as)\s+["']?([^"'\n]+?)["']?$/i
  );
  if (explicitRefMatch) {
    return {
      workspaceRef: explicitRefMatch[1].trim(),
      newName: explicitRefMatch[2].trim()
    };
  }
  const currentMatch = text.match(/\brename\s+(?:the\s+)?workspace\s+(?:to|as)\s+["']?([^"'\n]+?)["']?$/i);
  return currentMatch ? { newName: currentMatch[1].trim() } : {};
}

function extractQuickAppScope(text: string): string {
  if (/\bglobal\b|\bgeneral\b/.test(text)) return "general";
  if (/\bworkspace\b|\bfunction\b/.test(text)) return "function";
  if (/\btab\b|\bnode\b|\bcurrent node\b/.test(text)) return "tab";
  return "";
}

function extractQuickAppLabel(text: string): string {
  return (
    text.match(/\bquick\s*app\s+(?:called|named|label)\s+["']?([^"'\n]+?)["']?(?:\s+(?:to|for|in|on|at|https?:\/\/|[a-zA-Z]:\\|\/)\b|$)/i)?.[1] ??
    text.match(/\b(?:add|create|save)\s+(?:a\s+)?quick\s*app\s+["']?([^"'\n]+?)["']?(?:\s+(?:to|for|in|on|at|https?:\/\/|[a-zA-Z]:\\|\/)\b|$)/i)?.[1] ??
    ""
  ).trim();
}

function inferQuickAppTypeFromTarget(target: string): string {
  if (/^https?:\/\//i.test(target)) return "link";
  if (/\.(html?|xhtml)$/i.test(target)) return "html";
  return "local_app";
}

function extractQuickAppReference(text: string): string {
  return (
    text.match(/\bquick\s*app\s+["']?([^"'\n]+?)["']?$/i)?.[1] ??
    text.match(/\b(?:open|launch|remove|delete)\s+(?:the\s+)?quick\s*app\s+["']?([^"'\n]+?)["']?$/i)?.[1] ??
    ""
  ).trim();
}

function extractDocumentReviewOutputFormat(text: string): string {
  return /\bpdf\b/i.test(text) && /\b(export|save|generate|create|make|report)\b/i.test(text) ? "pdf" : "";
}

function stripDocumentReviewOutputInstruction(value: string): string {
  return value
    .replace(/\b(?:and|then)?\s*(?:export|save|generate|create|make)\s+(?:it|this|that|a|the)?\s*(?:full\s+)?(?:pdf\s+)?report\b.*$/i, "")
    .replace(/\b(?:and|then)?\s*(?:export|save|generate|create|make)\s+(?:it|this|that)?\s*(?:as\s+)?pdf\b.*$/i, "")
    .replace(/\bas\s+pdf\b.*$/i, "")
    .trim()
    .replace(/[\s,;:-]+$/g, "");
}

function extractDocumentReviewTitle(text: string): string {
  return (
    text.match(/\b(?:pdf|report)\s+(?:called|named|titled)\s+["']?([^"'\n]+?)["']?(?:\s+(?:for|about|on|from)\b|$)/i)?.[1] ??
    text.match(/\b(?:called|named|titled)\s+["']?([^"'\n]+?)["']?\s+(?:pdf|report)\b/i)?.[1] ??
    ""
  ).trim();
}

export function inferAiCommandArgs(commandText: string, actionId: AiCommandActionId | null): Record<string, unknown> {
  if (!actionId) return {};
  const text = commandText.trim();
  if (actionId === "workspace_import") {
    const path = extractPathFromText(text);
    return path ? { path } : {};
  }
  if (actionId === "workspace_create") {
    const workspaceName = extractWorkspaceCreateName(text);
    const path = extractPathFromText(text);
    const args: Record<string, unknown> = {};
    if (workspaceName) args.workspace_name = workspaceName;
    if (path) args.path = path;
    return args;
  }
  if (actionId === "workspace_switch" || actionId === "workspace_set_default" || actionId === "workspace_open_folder" || actionId === "workspace_delete" || actionId === "workspace_resync") {
    const workspaceRef = extractWorkspaceReference(text);
    return workspaceRef ? { workspace_ref: workspaceRef } : {};
  }
  if (actionId === "workspace_rename") {
    const renameArgs = extractWorkspaceRenameArgs(text);
    const args: Record<string, unknown> = {};
    if (renameArgs.workspaceRef) args.workspace_ref = renameArgs.workspaceRef;
    if (renameArgs.newName) args.new_name = renameArgs.newName;
    return args;
  }
  if (actionId === "workspace_set_location") {
    const workspaceRef = extractWorkspaceReference(text);
    const path = extractPathFromText(text);
    const args: Record<string, unknown> = {};
    if (workspaceRef) args.workspace_ref = workspaceRef;
    if (path) args.path = path;
    return args;
  }
  if (actionId === "database_create_section") {
    const sectionName = extractDatabaseSectionName(text);
    const fields = extractDatabaseFields(text);
    const args: Record<string, unknown> = {};
    if (sectionName) args.section_name = sectionName;
    if (fields.length > 0) args.fields = fields;
    return args;
  }
  if (actionId === "tree_rename_selected") {
    const renameMatch = text.match(/rename(?:\s+(?:node|topic|ticket))?\s*(?:to|as)\s+\"?([^"\n]+?)\"?$/i) ?? text.match(/rename\s+\"?([^"\n]+?)\"?$/i);
    return renameMatch?.[1] ? { new_name: renameMatch[1].trim() } : {};
  }
  if (actionId === "tree_move_selected") {
    const moveMatch = text.match(/move(?:\s+(?:node|topic|ticket))?\s*(?:to|under|into)\s+\"?([^"\n]+?)\"?$/i) ?? text.match(/move\s+\"?([^"\n]+?)\"?$/i);
    return moveMatch?.[1] ? { target_ref: moveMatch[1].trim() } : {};
  }
  if (actionId === "tree_bulk_create") {
    const source = text.match(/(?:create|add)\s+(?:topics?|nodes?)\s*(?:\:|->)?\s*(.+)$/i)?.[1] ?? text;
    const names = extractDelimitedList(source);
    return names.length > 0 ? { names } : {};
  }
  if (actionId === "timeline_set_schedule") {
    const dates = [...text.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)].map((match) => match[1]);
    const status = text.match(/\bblocked\b/i) ? "blocked" : text.match(/\bdone|completed|complete\b/i) ? "done" : text.match(/\bactive|in progress\b/i) ? "active" : "planned";
    const predecessorMatch = text.match(/predecessor\s+([0-9.]+)/i);
    const args: Record<string, unknown> = { status };
    if (dates.length >= 2) {
      args.start_date = dates[0];
      args.end_date = dates[1];
    } else if (dates.length === 1) {
      args.start_date = dates[0];
      args.end_date = dates[0];
    }
    if (predecessorMatch?.[1]) args.predecessor = predecessorMatch[1];
    return args;
  }
  if (actionId === "wbs_generate") {
    const goal = (text.match(/(?:for|goal|objective|about)\s*(?:\:)?\s*(.+)$/i)?.[1] ?? text.match(/(?:wbs|work breakdown|break down|breakdown)\s*(?:\:)?\s*(.+)$/i)?.[1] ?? "").trim();
    return goal ? { goal } : {};
  }
  if (actionId === "wbs_from_document") {
    const goal = (text.match(/(?:for|goal|objective|about)\s*(?:\:)?\s*(.+)$/i)?.[1] ?? text.match(/(?:document|documents|doc|file|pdf)\s+(?:for|about|on)\s*(?:\:)?\s*(.+)$/i)?.[1] ?? text.match(/(?:wbs|work breakdown|break down|breakdown)\s*(?:\:|-)\s*(.+)$/i)?.[1] ?? "").trim();
    return goal ? { goal } : {};
  }
  if (actionId === "favorite_selected") {
    const group = (text.match(/(?:group|in)\s+\"?([^"\n]+?)\"?$/i)?.[1] ?? text.match(/favorite(?:\s+selected)?\s+\"?([^"\n]+?)\"?$/i)?.[1] ?? "").trim();
    return group ? { group } : {};
  }
  if (actionId === "document_review") {
    const rawGoal =
      (text.match(/(?:for|with result|result)\s*(?:\:)?\s*(.+)$/i)?.[1] ??
        text.match(/(?:review|analy[sz]e|summari[sz]e)\s+(?:documents?|files?|quick\s*apps?|html)\s*(?:\:)?\s*(.+)$/i)?.[1] ??
        "").trim();
    const goal = stripDocumentReviewOutputInstruction(rawGoal);
    const outputFormat = extractDocumentReviewOutputFormat(text);
    const reportTitle = extractDocumentReviewTitle(text);
    const args: Record<string, unknown> = {};
    if (goal) args.goal = goal;
    if (outputFormat) args.output_format = outputFormat;
    if (reportTitle) args.report_title = reportTitle;
    return args;
  }
  if (actionId === "quick_app_add") {
    const quotedValues = extractQuotedSegments(text);
    const target = extractUrlFromText(text) || extractPathFromText(text) || quotedValues.find((value) => /^https?:\/\//i.test(value) || /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("/")) || "";
    const label =
      extractQuickAppLabel(text) ||
      quotedValues.find((value) => value !== target) ||
      "";
    const scope = extractQuickAppScope(text.toLowerCase());
    const requestedType =
      text.includes("html quick app") || /\bhtml\b/.test(text)
        ? "html"
        : text.includes("local app")
          ? "local_app"
          : target
            ? inferQuickAppTypeFromTarget(target)
            : "";
    const args: Record<string, unknown> = {};
    if (label) args.label = label;
    if (target) args.target = target;
    if (scope) args.scope = scope;
    if (requestedType) args.type = requestedType;
    return args;
  }
  if (actionId === "quick_app_remove" || actionId === "quick_app_open") {
    const itemRef = extractQuickAppReference(text) || extractQuickAppLabel(text) || extractQuotedSegments(text)[0] || "";
    const scope = extractQuickAppScope(text.toLowerCase());
    const args: Record<string, unknown> = {};
    if (itemRef) args.item_ref = itemRef;
    if (scope) args.scope = scope;
    return args;
  }
  if (actionId === "ticket_draft_reply") {
    const instructions = (text.match(/(?:with|using|style|tone)\s*(?:\:)?\s*(.+)$/i)?.[1] ?? text.match(/reply(?:\s+to)?\s+ticket\s*(?:\:)?\s*(.+)$/i)?.[1] ?? "").trim();
    return instructions ? { instructions } : {};
  }
  return {};
}

function clampAiPlannerConfidence(value: unknown, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

export function sanitizeAiCommandArgs(actionId: AiCommandActionId, rawArgs: Record<string, unknown> | null | undefined, commandText: string): Record<string, unknown> {
  const fallback = inferAiCommandArgs(commandText, actionId);
  const source = rawArgs ?? {};
  const getString = (...keys: string[]) => {
    for (const key of keys) {
      const raw = source[key];
      if (typeof raw !== "string") continue;
      const trimmed = raw.trim();
      if (trimmed.length > 0) return trimmed;
    }
    return "";
  };
  const getStringList = (...keys: string[]) => {
    for (const key of keys) {
      const raw = source[key];
      if (Array.isArray(raw)) {
        const values = raw
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter((item) => item.length > 0)
          .slice(0, 25);
        if (values.length > 0) return values;
      }
      if (typeof raw === "string") {
        const values = extractDelimitedList(raw);
        if (values.length > 0) return values;
      }
    }
    return [] as string[];
  };
  if (actionId === "workspace_import") {
    const path = getString("path", "folder_path", "workspace_path");
    return path ? { path } : fallback;
  }
  if (actionId === "workspace_create") {
    const args: Record<string, unknown> = {};
    const workspaceName = getString("workspace_name", "workspaceName", "name", "title");
    const path = getString("path", "folder_path", "workspace_path");
    if (workspaceName) args.workspace_name = workspaceName;
    if (path) args.path = path;
    return Object.keys(args).length > 0 ? args : fallback;
  }
  if (actionId === "workspace_switch" || actionId === "workspace_set_default" || actionId === "workspace_open_folder" || actionId === "workspace_delete" || actionId === "workspace_resync") {
    const workspaceRef = getString("workspace_ref", "workspaceRef", "workspace", "name", "target");
    return workspaceRef ? { workspace_ref: workspaceRef } : fallback;
  }
  if (actionId === "workspace_rename") {
    const args: Record<string, unknown> = {};
    const workspaceRef = getString("workspace_ref", "workspaceRef", "workspace", "target");
    const newName = getString("new_name", "newName", "name", "title");
    if (workspaceRef) args.workspace_ref = workspaceRef;
    if (newName) args.new_name = newName;
    return Object.keys(args).length > 0 ? args : fallback;
  }
  if (actionId === "workspace_set_location") {
    const args: Record<string, unknown> = {};
    const workspaceRef = getString("workspace_ref", "workspaceRef", "workspace", "target");
    const path = getString("path", "folder_path", "workspace_path");
    if (workspaceRef) args.workspace_ref = workspaceRef;
    if (path) args.path = path;
    return Object.keys(args).length > 0 ? args : fallback;
  }
  if (actionId === "database_create_section") {
    const args: Record<string, unknown> = {};
    const sectionName = getString("section_name", "sectionName", "name", "title", "section");
    const fields = getStringList("fields", "columns", "names");
    if (sectionName) args.section_name = sectionName;
    if (fields.length > 0) args.fields = fields;
    return Object.keys(args).length > 0 ? args : fallback;
  }
  if (actionId === "tree_rename_selected") return getString("new_name", "name", "newName") ? { new_name: getString("new_name", "name", "newName") } : fallback;
  if (actionId === "tree_move_selected") return getString("target_ref", "target", "targetRef", "destination") ? { target_ref: getString("target_ref", "target", "targetRef", "destination") } : fallback;
  if (actionId === "tree_bulk_create") {
    const rawNames = source.names;
    if (Array.isArray(rawNames)) {
      const names = rawNames.map((item) => (typeof item === "string" ? item.trim() : "")).filter((item) => item.length > 0).slice(0, 25);
      if (names.length > 0) return { names };
    }
    return fallback;
  }
  if (actionId === "timeline_set_schedule") {
    const args: Record<string, unknown> = {};
    const statusCandidate = getString("status").toLowerCase();
    const startDate = getString("start_date", "startDate");
    const endDate = getString("end_date", "endDate");
    const predecessor = getString("predecessor");
    const title = getString("title");
    if (startDate) args.start_date = startDate;
    if (endDate) args.end_date = endDate;
    if (predecessor) args.predecessor = predecessor;
    if (title) args.title = title;
    if (statusCandidate === "planned" || statusCandidate === "active" || statusCandidate === "blocked" || statusCandidate === "done") args.status = statusCandidate;
    return Object.keys(args).length > 0 ? args : fallback;
  }
  if (actionId === "wbs_generate") return getString("goal", "objective", "target", "topic") ? { goal: getString("goal", "objective", "target", "topic") } : fallback;
  if (actionId === "wbs_from_document") return getString("goal", "objective", "target", "topic", "focus") ? { goal: getString("goal", "objective", "target", "topic", "focus") } : fallback;
  if (actionId === "favorite_selected") return getString("group", "group_name", "favorite_group") ? { group: getString("group", "group_name", "favorite_group") } : fallback;
  if (actionId === "document_review") {
    const args: Record<string, unknown> = {};
    const goal = getString("goal", "objective", "focus");
    const outputFormat = getString("output_format", "outputFormat", "format");
    const reportTitle = getString("report_title", "reportTitle", "title");
    if (goal) args.goal = goal;
    if (outputFormat) args.output_format = outputFormat;
    if (reportTitle) args.report_title = reportTitle;
    return Object.keys(args).length > 0 ? args : fallback;
  }
  if (actionId === "quick_app_add") {
    const args: Record<string, unknown> = {};
    const label = getString("label", "name", "title");
    const target = getString("target", "url", "path", "launch_target", "launchTarget");
    const scope = getString("scope");
    const type = getString("type", "item_type", "itemType");
    if (label) args.label = label;
    if (target) args.target = target;
    if (scope) args.scope = scope;
    if (type) args.type = type;
    return Object.keys(args).length > 0 ? args : fallback;
  }
  if (actionId === "quick_app_remove" || actionId === "quick_app_open") {
    const args: Record<string, unknown> = {};
    const itemRef = getString("item_ref", "itemRef", "name", "label", "target");
    const scope = getString("scope");
    if (itemRef) args.item_ref = itemRef;
    if (scope) args.scope = scope;
    return Object.keys(args).length > 0 ? args : fallback;
  }
  if (actionId === "ticket_draft_reply") return getString("instructions", "style", "tone", "guidance") ? { instructions: getString("instructions", "style", "tone", "guidance") } : fallback;
  return {};
}

export function parseAiPlannerPayload(rawResponse: string, commandText: string): AiPlannerParseResult | null {
  const jsonPayload = extractFirstJsonObject(rawResponse);
  if (!jsonPayload) return null;
  try {
    const parsed = JSON.parse(jsonPayload) as { action_id?: string | null; args?: Record<string, unknown>; reason?: string; steps?: string[]; confidence?: number; requires_confirmation?: boolean; };
    const actionId = normalizeAiCommandActionId(parsed.action_id ?? null);
    const reason = typeof parsed.reason === "string" && parsed.reason.trim().length > 0 ? parsed.reason.trim() : null;
    const steps = Array.isArray(parsed.steps) ? parsed.steps.map((step) => (typeof step === "string" ? step.trim() : "")).filter((step) => step.length > 0).slice(0, 6) : [];
    const confidence = clampAiPlannerConfidence(parsed.confidence, actionId ? 0.72 : 0.18);
    const requiresConfirmation = typeof parsed.requires_confirmation === "boolean" ? parsed.requires_confirmation : true;
    if (!actionId) return { actionId: null, args: {}, reason, steps, confidence, requiresConfirmation };
    return { actionId, args: sanitizeAiCommandArgs(actionId, parsed.args, commandText), reason, steps, confidence, requiresConfirmation };
  } catch {
    return null;
  }
}

export function extractFirstJsonObject(raw: string): string | null {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = raw.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let idx = start; idx < raw.length; idx += 1) {
    const ch = raw[idx];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === "\"") inString = false;
      continue;
    }
    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "{") {
      depth += 1;
      continue;
    }
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return raw.slice(start, idx + 1);
    }
  }
  return null;
}
