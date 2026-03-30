export const AI_COMMAND_ACTION_IDS = [
  "workspace_import",
  "workspace_resync",
  "plan_my_day",
  "wbs_generate",
  "wbs_from_document",
  "tree_create_topic",
  "tree_rename_selected",
  "tree_move_selected",
  "tree_bulk_create",
  "favorite_selected",
  "desktop_open",
  "timeline_open",
  "timeline_set_schedule",
  "timeline_clear_schedule",
  "document_review",
  "ticket_create",
  "ticket_analyze",
  "ticket_draft_reply",
  "run_qa",
  "draft_release_note"
] as const;

export type AiCommandActionId = (typeof AI_COMMAND_ACTION_IDS)[number];

export type AiPlannerParseResult = {
  actionId: AiCommandActionId | null;
  args: Record<string, unknown>;
  reason: string | null;
  steps: string[];
  confidence: number;
  requiresConfirmation: boolean;
};

export function normalizeAiCommandActionId(value: string | null | undefined): AiCommandActionId | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const aliases: Record<string, AiCommandActionId> = {
    import_folder: "workspace_import",
    workspace_import: "workspace_import",
    resync_workspace: "workspace_resync",
    workspace_resync: "workspace_resync",
    plan_my_day: "plan_my_day",
    my_day_plan: "plan_my_day",
    daily_plan: "plan_my_day",
    wbs_generate: "wbs_generate",
    ai_wbs: "wbs_generate",
    generate_wbs: "wbs_generate",
    work_breakdown: "wbs_generate",
    create_wbs: "wbs_generate",
    wbs_from_document: "wbs_from_document",
    document_wbs: "wbs_from_document",
    file_wbs: "wbs_from_document",
    create_wbs_from_document: "wbs_from_document",
    create_wbs_from_file: "wbs_from_document",
    create_topic: "tree_create_topic",
    tree_create_topic: "tree_create_topic",
    rename_selected: "tree_rename_selected",
    rename_node: "tree_rename_selected",
    tree_rename_selected: "tree_rename_selected",
    move_selected: "tree_move_selected",
    move_node: "tree_move_selected",
    tree_move_selected: "tree_move_selected",
    bulk_create: "tree_bulk_create",
    tree_bulk_create: "tree_bulk_create",
    favorite_selected: "favorite_selected",
    add_favorite: "favorite_selected",
    pin_favorite: "favorite_selected",
    bookmark_selected: "favorite_selected",
    open_desktop: "desktop_open",
    desktop_open: "desktop_open",
    open_timeline: "timeline_open",
    timeline_open: "timeline_open",
    set_schedule: "timeline_set_schedule",
    timeline_set_schedule: "timeline_set_schedule",
    clear_schedule: "timeline_clear_schedule",
    timeline_clear_schedule: "timeline_clear_schedule",
    document_review: "document_review",
    review_documents: "document_review",
    review_docs: "document_review",
    create_ticket: "ticket_create",
    ticket_create: "ticket_create",
    analyze_ticket: "ticket_analyze",
    ticket_analyze: "ticket_analyze",
    draft_ticket_reply: "ticket_draft_reply",
    ticket_draft_reply: "ticket_draft_reply",
    run_qa: "run_qa",
    qa_run: "run_qa",
    draft_release_note: "draft_release_note",
    release_note_draft: "draft_release_note"
  };
  return aliases[normalized] ?? null;
}

export function inferAiCommandActionId(commandText: string): AiCommandActionId | null {
  const text = commandText.toLowerCase();
  if ((text.includes("wbs") || text.includes("work breakdown") || text.includes("break down") || text.includes("breakdown")) &&
    (text.includes("document") || text.includes("documents") || text.includes("doc") || text.includes("file") || text.includes("pdf") || text.includes("proposal") || text.includes("brief") || text.includes("report") || text.includes("upload"))) {
    return "wbs_from_document";
  }
  if (text.includes("plan my day") || text.includes("my day") || text.includes("daily plan") || text.includes("focus list")) return "plan_my_day";
  if (text.includes("wbs") || text.includes("work breakdown") || text.includes("break down") || text.includes("breakdown")) return "wbs_generate";
  if (text.includes("import")) return "workspace_import";
  if (text.includes("re-sync") || text.includes("resync") || text.includes("synchronize") || text.includes("sync")) return "workspace_resync";
  if (text.includes("clear schedule") || text.includes("remove schedule") || text.includes("delete schedule")) return "timeline_clear_schedule";
  if ((text.includes("review") || text.includes("analyze") || text.includes("summarize")) && (text.includes("document") || text.includes("documents") || text.includes("doc") || text.includes("file"))) return "document_review";
  if (text.includes("schedule") || text.includes("deadline") || text.includes("start date") || text.includes("end date")) return "timeline_set_schedule";
  if (text.includes("timeline")) return "timeline_open";
  if (text.includes("desktop")) return "desktop_open";
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
  const actionCatalog = [
    "workspace_import: Import a folder and create/sync workspace.",
    "workspace_resync: Re-sync selected workspace.",
    "plan_my_day: Build a short AI focus plan from current workspace context.",
    "wbs_generate: Generate recursive AI WBS under current context. args: { goal }",
    "wbs_from_document: Generate recursive AI WBS from selected document/file context. args: { goal? }",
    "tree_create_topic: Create a new topic node in current context.",
    "tree_rename_selected: Rename selected node. args: { new_name }",
    "tree_move_selected: Move selected node(s) into target folder. args: { target_ref }",
    "tree_bulk_create: Create multiple topics under current context. args: { names: string[] }",
    "favorite_selected: Add selected node to favorites and optional group. args: { group? }",
    "desktop_open: Switch to Desktop view.",
    "timeline_open: Switch to Timeline view.",
    "timeline_set_schedule: Set selected node schedule. args: { start_date, end_date, status, predecessor?, title? }",
    "timeline_clear_schedule: Clear selected node schedule.",
    "document_review: Review documents in selected context with desired result. args: { goal? }",
    "ticket_create: Create a support ticket node.",
    "ticket_analyze: Analyze selected ticket with AI.",
    "ticket_draft_reply: Draft a reply for selected ticket. args: { instructions? }",
    "run_qa: Run quality gate.",
    "draft_release_note: Draft release note from current context and QA."
  ].join("\n");

  return {
    systemPrompt: [
      "You are ODETool AI command planner.",
      "Return exactly one JSON object and no markdown.",
      "Do not include actions outside the allowed action list.",
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

export function inferAiCommandArgs(commandText: string, actionId: AiCommandActionId | null): Record<string, unknown> {
  if (!actionId) return {};
  const text = commandText.trim();
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
    const names = source.split(/[,;\n|]/).map((item) => item.trim().replace(/^\"|\"$/g, "")).filter((item) => item.length > 0).slice(0, 25);
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
    const goal = (text.match(/(?:for|with result|result)\s*(?:\:)?\s*(.+)$/i)?.[1] ?? text.match(/review\s+(?:documents?|files?)\s*(?:\:)?\s*(.+)$/i)?.[1] ?? "").trim();
    return goal ? { goal } : {};
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
  if (actionId === "document_review") return getString("goal", "objective", "focus") ? { goal: getString("goal", "objective", "focus") } : fallback;
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
