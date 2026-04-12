import {
  buildDefaultProcedurePriorityOptions,
  inferProcedureAutomationRoleFromLabel,
  inferProcedureFieldAutoValueFromLabel,
  inferProcedureFieldTypeFromLabel,
  normalizeProcedureFieldAutoValue,
  normalizeProcedureFieldType,
  type ProcedureAutomationRole,
  type ProcedureFieldAutoValue,
  type ProcedureFieldType,
  type ProcedurePriorityOption
} from "@/lib/procedureDatabase";

export const AI_COMMAND_ACTION_IDS = [
  "workspace_import",
  "workspace_resync",
  "plan_my_day",
  "wbs_generate",
  "wbs_from_document",
  "database_create_section",
  "database_seed_examples",
  "dashboard_widget_create",
  "governance_framework_generate",
  "execution_task_create",
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

export type AiPlannerActionStep = {
  actionId: AiCommandActionId;
  args: Record<string, unknown>;
};

export type AiPlannerParseResult = {
  actionId: AiCommandActionId | null;
  args: Record<string, unknown>;
  actionSequence: AiPlannerActionStep[];
  reason: string | null;
  steps: string[];
  confidence: number;
  requiresConfirmation: boolean;
};

export type AiDatabaseFieldSpec = {
  label: string;
  type?: ProcedureFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  priorityOptions?: ProcedurePriorityOption[];
  formulaExpression?: string;
  relationTargetRef?: string;
  relationDisplayFieldRefs?: string[];
  automationRole?: ProcedureAutomationRole;
  autoValue?: ProcedureFieldAutoValue;
  showInMasterList?: boolean;
};

const AI_MAX_ACTION_SEQUENCE_STEPS = 16;

const AI_ALLOWED_AUTOMATION_ROLES = new Set<ProcedureAutomationRole>([
  "none",
  "execution_owner_node",
  "execution_deliverable",
  "execution_task",
  "execution_subtask",
  "execution_status",
  "execution_due_date",
  "execution_note"
]);

const AI_FIELD_TYPE_ALIASES: Record<string, ProcedureFieldType> = {
  text: "short_text",
  string: "short_text",
  longtext: "long_text",
  long_text: "long_text",
  richtext: "rich_text",
  rich_text: "rich_text",
  integer: "number",
  float: "decimal",
  money: "currency",
  bool: "yes_no",
  boolean: "yes_no",
  select: "single_select",
  select_one: "single_select",
  select_many: "multi_select",
  multiselect: "multi_select",
  multi_select: "multi_select",
  link: "url",
  user: "user_ref",
  users: "user_list"
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
    create_database_section: "database_create_section",
    database_create_section: "database_create_section",
    database_section: "database_create_section",
    database_schema: "database_create_section",
    create_schema: "database_create_section",
    create_database_schema: "database_create_section",
    database_seed_examples: "database_seed_examples",
    create_database_examples: "database_seed_examples",
    seed_database_examples: "database_seed_examples",
    add_sample_records: "database_seed_examples",
    populate_database: "database_seed_examples",
    dashboard_widget_create: "dashboard_widget_create",
    create_widget: "dashboard_widget_create",
    create_dashboard_widget: "dashboard_widget_create",
    add_widget: "dashboard_widget_create",
    governance_framework_generate: "governance_framework_generate",
    governance_framework: "governance_framework_generate",
    create_governance_framework: "governance_framework_generate",
    generate_governance_framework: "governance_framework_generate",
    risk_framework: "governance_framework_generate",
    risk_management_framework: "governance_framework_generate",
    execution_task_create: "execution_task_create",
    create_task: "execution_task_create",
    add_task: "execution_task_create",
    create_action_item: "execution_task_create",
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

function normalizeAiCapabilityKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeAiFieldTypeToken(value: string): ProcedureFieldType | null {
  const normalized = normalizeAiCapabilityKey(value);
  if (!normalized) return null;
  if (normalized in AI_FIELD_TYPE_ALIASES) {
    return AI_FIELD_TYPE_ALIASES[normalized];
  }
  const candidate = normalizedProcedureFieldTypeFromAlias(normalized);
  return candidate;
}

function normalizedProcedureFieldTypeFromAlias(value: string): ProcedureFieldType | null {
  const normalized = normalizeProcedureFieldType(value);
  return normalized === "short_text" && value !== "short_text" && value !== "text" && value !== "string"
    ? null
    : normalized;
}

function stripAiListPrefix(value: string): string {
  return value
    .trim()
    .replace(/^[-*•]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .trim();
}

function splitAiMetaSegments(value: string): string[] {
  return value
    .split(/\s*(?:\||;)\s*/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function extractAiTopLevelDelimitedEntries(value: string): string[] {
  const entries: string[] = [];
  let current = "";
  let quote: string | null = null;
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;

  const pushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed) entries.push(trimmed);
    current = "";
  };

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const previous = index > 0 ? value[index - 1] : "";

    if (quote) {
      current += char;
      if (char === quote && previous !== "\\") {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      current += char;
      continue;
    }

    if (char === "(") {
      parenDepth += 1;
      current += char;
      continue;
    }
    if (char === ")" && parenDepth > 0) {
      parenDepth -= 1;
      current += char;
      continue;
    }
    if (char === "[") {
      bracketDepth += 1;
      current += char;
      continue;
    }
    if (char === "]" && bracketDepth > 0) {
      bracketDepth -= 1;
      current += char;
      continue;
    }
    if (char === "{") {
      braceDepth += 1;
      current += char;
      continue;
    }
    if (char === "}" && braceDepth > 0) {
      braceDepth -= 1;
      current += char;
      continue;
    }

    const atTopLevel = parenDepth === 0 && bracketDepth === 0 && braceDepth === 0;
    if (atTopLevel && (char === "," || char === ";" || char === "\n" || char === "\r")) {
      pushCurrent();
      continue;
    }

    current += char;
  }

  pushCurrent();
  return Array.from(new Set(entries));
}

function parseAiStringList(value: string): string[] {
  return extractDelimitedList(
    value
      .replace(/^\[|\]$/g, "")
      .replace(/[()]/g, "")
  );
}

function extractAiHeadingList(commandText: string, headingPatterns: RegExp[]): string[] {
  const values: string[] = [];
  const lines = commandText.split(/\r?\n/g);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line || !headingPatterns.some((pattern) => pattern.test(line))) continue;
    const colonIndex = line.indexOf(":");
    if (colonIndex >= 0 && colonIndex < line.length - 1) {
      const inlineValue = line.slice(colonIndex + 1).trim();
      if (inlineValue) values.push(...extractDelimitedList(inlineValue));
    }
    let collectedAny = false;
    for (let pointer = index + 1; pointer < lines.length; pointer += 1) {
      const candidate = lines[pointer].trim();
      if (!candidate) {
        if (collectedAny) break;
        continue;
      }
      if (/^[-*•]\s+/.test(candidate) || /^\d+[.)]\s+/.test(candidate)) {
        values.push(stripAiListPrefix(candidate));
        collectedAny = true;
        continue;
      }
      if (!collectedAny && !candidate.endsWith(":")) {
        values.push(candidate);
        collectedAny = true;
        continue;
      }
      break;
    }
  }
  return Array.from(
    new Set(
      values
        .flatMap((entry) => (entry.includes(",") && !/[=:>(]/.test(entry) ? extractDelimitedList(entry) : [entry]))
        .map((entry) => stripAiListPrefix(entry))
        .filter((entry) => entry.length > 0)
    )
  );
}

function buildAiPriorityOptionsFromList(values: string[]): ProcedurePriorityOption[] {
  const labels = values.map((value) => value.trim()).filter((value) => value.length > 0);
  return labels.length > 0 ? buildDefaultProcedurePriorityOptions(labels) : [];
}

function parseAiFieldMetaSegment(
  segment: string,
  current: AiDatabaseFieldSpec
): AiDatabaseFieldSpec {
  const normalized = normalizeAiCapabilityKey(segment);
  if (!normalized) return current;
  if (normalized === "required") {
    return { ...current, required: true };
  }
  if (normalized === "optional") {
    return { ...current, required: false };
  }
  if (normalized === "hide" || normalized === "hidden" || normalized === "hide_from_master") {
    return { ...current, showInMasterList: false };
  }
  const keyValueMatch = segment.match(/^([a-zA-Z0-9 _-]+)\s*(?:=|:)\s*(.+)$/);
  if (!keyValueMatch?.[1] || !keyValueMatch?.[2]) {
    return current;
  }
  const key = normalizeAiCapabilityKey(keyValueMatch[1]);
  const rawValue = keyValueMatch[2].trim();
  if (!rawValue) return current;
  if (key === "placeholder") {
    return { ...current, placeholder: rawValue };
  }
  if (key === "options") {
    return { ...current, options: parseAiStringList(rawValue) };
  }
  if (key === "priority" || key === "priority_options" || key === "scale") {
    return { ...current, priorityOptions: buildAiPriorityOptionsFromList(parseAiStringList(rawValue)) };
  }
  if (key === "formula" || key === "expression") {
    return { ...current, type: "formula", formulaExpression: rawValue };
  }
  if (key === "target" || key === "relation" || key === "relation_target") {
    return { ...current, relationTargetRef: rawValue };
  }
  if (key === "display" || key === "relation_display" || key === "display_fields") {
    return { ...current, relationDisplayFieldRefs: parseAiStringList(rawValue) };
  }
  if (key === "role" || key === "automation_role" || key === "workflow_role") {
    const role = normalizeAiCapabilityKey(rawValue) as ProcedureAutomationRole;
    return AI_ALLOWED_AUTOMATION_ROLES.has(role) ? { ...current, automationRole: role } : current;
  }
  if (key === "auto" || key === "auto_value") {
    const autoValue = normalizeProcedureFieldAutoValue(rawValue);
    return autoValue !== "none" ? { ...current, autoValue } : current;
  }
  if (key === "show" || key === "show_in_master") {
    return {
      ...current,
      showInMasterList: !/^(false|no|0)$/i.test(rawValue)
    };
  }
  return current;
}

function parseAiFieldSpecLine(line: string): AiDatabaseFieldSpec | null {
  const cleaned = stripAiListPrefix(line).replace(/[;,]+$/g, "").trim();
  if (!cleaned) return null;

  const segments = splitAiMetaSegments(cleaned);
  const primary = segments[0] ?? cleaned;
  let label = primary;
  let descriptor = "";
  const separatorMatch = primary.match(/^(.+?)\s*(?:=|:|->)\s*(.+)$/);
  if (separatorMatch?.[1] && separatorMatch?.[2]) {
    label = separatorMatch[1].trim();
    descriptor = separatorMatch[2].trim();
  } else {
    const parenMatch = primary.match(/^(.+?)\s+\(([^()]+)\)$/);
    if (parenMatch?.[1] && parenMatch?.[2]) {
      label = parenMatch[1].trim();
      descriptor = parenMatch[2].trim();
    }
  }

  label = label.replace(/^["'`]+|["'`]+$/g, "").trim();
  if (!label) return null;

  let nextSpec: AiDatabaseFieldSpec = {
    label
  };

  if (descriptor) {
    const descriptorSegments = splitAiMetaSegments(descriptor);
    const mainDescriptor = descriptorSegments[0] ?? descriptor;
    const explicitTypeMatch = mainDescriptor.match(/^([a-zA-Z_ -]+?)(?:\((.*)\))?$/);
    const explicitType = explicitTypeMatch?.[1] ? normalizeAiFieldTypeToken(explicitTypeMatch[1]) : null;
    const explicitConfig = explicitTypeMatch?.[2]?.trim() ?? "";

    if (explicitType) {
      nextSpec.type = explicitType;
      if (explicitType === "formula" && explicitConfig) {
        nextSpec.formulaExpression = explicitConfig;
      } else if ((explicitType === "relation" || explicitType === "relation_list") && explicitConfig) {
        nextSpec.relationTargetRef = explicitConfig;
      } else if (explicitType === "priority" && explicitConfig) {
        nextSpec.priorityOptions = buildAiPriorityOptionsFromList(parseAiStringList(explicitConfig));
      } else if (
        (explicitType === "single_select" || explicitType === "multi_select" || explicitType === "tags") &&
        explicitConfig
      ) {
        nextSpec.options = parseAiStringList(explicitConfig);
      }
    } else if (/^formula\b/i.test(mainDescriptor)) {
      nextSpec.type = "formula";
      nextSpec.formulaExpression = mainDescriptor.replace(/^formula\s*[:(]?\s*/i, "").replace(/\)$/, "").trim();
    } else if (/^relation_list\b/i.test(mainDescriptor)) {
      nextSpec.type = "relation_list";
      nextSpec.relationTargetRef = mainDescriptor.replace(/^relation_list\s*[:(]?\s*/i, "").replace(/\)$/, "").trim();
    } else if (/^relation\b/i.test(mainDescriptor)) {
      nextSpec.type = "relation";
      nextSpec.relationTargetRef = mainDescriptor.replace(/^relation\s*[:(]?\s*/i, "").replace(/\)$/, "").trim();
    } else if (/^priority\b/i.test(mainDescriptor)) {
      nextSpec.type = "priority";
      const priorityValue = mainDescriptor.replace(/^priority\s*[:(]?\s*/i, "").replace(/\)$/, "").trim();
      if (priorityValue) {
        nextSpec.priorityOptions = buildAiPriorityOptionsFromList(parseAiStringList(priorityValue));
      }
    }

    for (const metaSegment of descriptorSegments.slice(1)) {
      nextSpec = parseAiFieldMetaSegment(metaSegment, nextSpec);
    }
  }

  for (const metaSegment of segments.slice(1)) {
    nextSpec = parseAiFieldMetaSegment(metaSegment, nextSpec);
  }

  const resolvedType = nextSpec.type ?? inferProcedureFieldTypeFromLabel(label);
  const inferredAutomationRole = nextSpec.automationRole ?? inferProcedureAutomationRoleFromLabel(label, resolvedType);
  const inferredAutoValue = nextSpec.autoValue ?? inferProcedureFieldAutoValueFromLabel(label, resolvedType);

  return {
    ...nextSpec,
    type: resolvedType,
    options:
      nextSpec.options && nextSpec.options.length > 0
        ? Array.from(new Set(nextSpec.options.map((value) => value.trim()).filter((value) => value.length > 0)))
        : undefined,
    priorityOptions:
      nextSpec.priorityOptions && nextSpec.priorityOptions.length > 0
        ? nextSpec.priorityOptions
        : resolvedType === "priority"
          ? buildDefaultProcedurePriorityOptions()
          : undefined,
    relationTargetRef: nextSpec.relationTargetRef?.trim() || undefined,
    relationDisplayFieldRefs:
      nextSpec.relationDisplayFieldRefs && nextSpec.relationDisplayFieldRefs.length > 0
        ? Array.from(new Set(nextSpec.relationDisplayFieldRefs.map((value) => value.trim()).filter((value) => value.length > 0)))
        : undefined,
    formulaExpression: nextSpec.formulaExpression?.trim() || undefined,
    automationRole: inferredAutomationRole !== "none" ? inferredAutomationRole : undefined,
    autoValue: inferredAutoValue !== "none" ? inferredAutoValue : undefined
  };
}

export function coerceAiDatabaseFieldSpecs(value: unknown): AiDatabaseFieldSpec[] {
  if (!Array.isArray(value)) return [];
  const specs = value.flatMap((entry) => {
    if (typeof entry === "string") {
      const parsed = parseAiFieldSpecLine(entry);
      return parsed ? [parsed] : [];
    }
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const label =
      (typeof record.label === "string" && record.label.trim()) ||
      (typeof record.name === "string" && record.name.trim()) ||
      (typeof record.title === "string" && record.title.trim()) ||
      "";
    if (!label) return [];
    const explicitType =
      typeof record.type === "string"
        ? normalizeAiFieldTypeToken(record.type)
        : null;
    const type = explicitType ?? inferProcedureFieldTypeFromLabel(label);
    const options =
      Array.isArray(record.options)
        ? record.options.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : typeof record.options === "string"
          ? parseAiStringList(record.options)
          : [];
    const priorityOptions =
      Array.isArray(record.priorityOptions)
        ? record.priorityOptions.flatMap((option) => {
            if (!option || typeof option !== "object" || Array.isArray(option)) return [];
            const item = option as Record<string, unknown>;
            const optionLabel =
              (typeof item.value === "string" && item.value.trim()) ||
              (typeof item.label === "string" && item.label.trim()) ||
              "";
            if (!optionLabel) return [];
            return [
              {
                value: optionLabel,
                icon: typeof item.icon === "string" ? item.icon.trim() : "",
                color: typeof item.color === "string" ? item.color.trim() : "#5dc2ff",
                rank: typeof item.rank === "number" && Number.isFinite(item.rank) ? item.rank : 1,
                score: typeof item.score === "number" && Number.isFinite(item.score) ? item.score : 1,
                tooltip: typeof item.tooltip === "string" ? item.tooltip.trim() : "",
                reviewDays:
                  typeof item.reviewDays === "number" && Number.isFinite(item.reviewDays)
                    ? item.reviewDays
                    : null,
                escalate: item.escalate === true
              } satisfies ProcedurePriorityOption
            ];
          })
        : type === "priority" && options.length > 0
          ? buildAiPriorityOptionsFromList(options)
          : [];
    const relationDisplayFieldRefs =
      Array.isArray(record.relationDisplayFieldRefs)
        ? record.relationDisplayFieldRefs.filter(
            (item): item is string => typeof item === "string" && item.trim().length > 0
          )
        : typeof record.relationDisplayFieldRefs === "string"
          ? parseAiStringList(record.relationDisplayFieldRefs)
          : [];
    const automationRoleCandidate =
      typeof record.automationRole === "string"
        ? (normalizeAiCapabilityKey(record.automationRole) as ProcedureAutomationRole)
        : inferProcedureAutomationRoleFromLabel(label, type);
    const autoValueCandidate =
      record.autoValue !== undefined
        ? normalizeProcedureFieldAutoValue(record.autoValue)
        : inferProcedureFieldAutoValueFromLabel(label, type);
    return [
      {
        label,
        type,
        required: typeof record.required === "boolean" ? record.required : undefined,
        placeholder: typeof record.placeholder === "string" ? record.placeholder.trim() : undefined,
        options: options.length > 0 ? options : undefined,
        priorityOptions: priorityOptions.length > 0 ? priorityOptions : undefined,
        formulaExpression:
          typeof record.formulaExpression === "string" ? record.formulaExpression.trim() : undefined,
        relationTargetRef:
          (typeof record.relationTargetRef === "string" && record.relationTargetRef.trim()) ||
          (typeof record.relationTarget === "string" && record.relationTarget.trim()) ||
          undefined,
        relationDisplayFieldRefs: relationDisplayFieldRefs.length > 0 ? relationDisplayFieldRefs : undefined,
        automationRole:
          AI_ALLOWED_AUTOMATION_ROLES.has(automationRoleCandidate) && automationRoleCandidate !== "none"
            ? automationRoleCandidate
            : undefined,
        autoValue: autoValueCandidate !== "none" ? autoValueCandidate : undefined,
        showInMasterList:
          typeof record.showInMasterList === "boolean" ? record.showInMasterList : undefined
      } satisfies AiDatabaseFieldSpec
    ];
  });
  const byLabel = new Map<string, AiDatabaseFieldSpec>();
  for (const spec of specs) {
    const key = normalizeAiCapabilityKey(spec.label);
    if (!key) continue;
    const current = byLabel.get(key);
    byLabel.set(key, current ? { ...current, ...spec, label: current.label || spec.label } : spec);
  }
  return Array.from(byLabel.values());
}

function hasCreationVerb(text: string): boolean {
  return (
    text.includes("create") ||
    text.includes("add") ||
    text.includes("build") ||
    text.includes("generate") ||
    text.includes("make") ||
    text.includes("populate") ||
    text.includes("fill") ||
    text.includes("seed")
  );
}

function matchesAnyPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function hasStructureOnlyDirective(text: string): boolean {
  return matchesAnyPattern(text, [
    /\bthis\s+is\s+step\s+\d+\s+only\b/i,
    /\b(?:database\s+)?structure\s+only\b/i,
    /\b(?:database\s+)?schema\s+only\b/i,
    /\bonly\s+create\s+the\s+(?:database\s+)?(?:structure|schema)\b/i,
    /\bcreate\s+the\s+(?:database\s+)?(?:structure|schema)\s+only\b/i,
    /\bfor\s+now,\s*only\s+create\b/i
  ]);
}

function shouldSuppressDatabaseExamplesIntent(text: string): boolean {
  return (
    hasStructureOnlyDirective(text) ||
    matchesAnyPattern(text, [
      /\bdo\s+not\s+(?:create|add|seed|populate|fill)\b[^.\n]{0,120}\b(?:sample|samples|example|examples|records?|rows?|data)\b/i,
      /\bdo\s+not\s+create\b[^.\n]{0,120}\b(?:fake|sample|samples|example|examples|operational)\b[^.\n]{0,40}\b(?:data|records?|rows?)\b/i,
      /\bdo\s+not\s+create\s+records?\s+yet\b/i,
      /\bdo\s+not\s+(?:populate|seed)\b/i,
      /\b(?:no|without)\s+(?:fake|sample|samples|example|examples)\b[^.\n]{0,40}\b(?:data|records?|rows?)\b/i
    ])
  );
}

function shouldSuppressDashboardWidgetIntent(text: string): boolean {
  return (
    hasStructureOnlyDirective(text) ||
    matchesAnyPattern(text, [
      /\bdo\s+not\s+(?:create|add)\b[^.\n]{0,120}\b(?:dashboards?|widgets?|metrics?|charts?|heatmaps?)\b/i,
      /\b(?:no|without)\s+(?:dashboards?|widgets?)\b/i
    ])
  );
}

function hasDatabaseExamplesRequest(text: string): boolean {
  if (!/\b(?:database|table|section|record|records|row|rows)\b/i.test(text)) {
    return false;
  }
  return matchesAnyPattern(text, [
    /\b(?:create|add|seed|populate|fill)\b[^.\n]{0,80}\b(?:sample|samples|example|examples|records?|rows?)\b/i,
    /\b(?:sample|samples|example|examples)\s+(?:records?|rows?)\b/i,
    /\b(?:seed|populate|fill)\b[^.\n]{0,80}\b(?:database|table|section)\b/i
  ]);
}

function hasDashboardWidgetRequest(text: string): boolean {
  if (!hasCreationVerb(text)) return false;
  return (
    /\b(?:widget|widgets|dashboard|dashboards|chart|charts|heatmap|heatmaps)\b/i.test(text) ||
    /\bcreate\b[^.\n]{0,80}\b(?:metric|metrics|distribution)\b/i.test(text) ||
    (/\b(?:matrix|heatmap)\b/i.test(text) && /\b(?:widget|dashboard|chart|visual|insight|report)\b/i.test(text))
  );
}

function isWeakDatabaseSectionName(value: string): boolean {
  const normalized = value.replace(/\s+/g, " ").trim().toLowerCase();
  if (!normalized) return true;
  if (/^(?:main|new|primary|database|section|table|schema)$/.test(normalized)) {
    return true;
  }
  return (
    /^(?:to\s+)?(?:explain|describe|summari[sz]e|review|analy[sz]e)\b/.test(normalized) &&
    /\b(?:it|this|that|what it is|what this is)\b/.test(normalized)
  );
}

function shouldSuppressAiCommandAction(actionId: AiCommandActionId, commandText: string): boolean {
  if (actionId === "database_seed_examples") {
    return shouldSuppressDatabaseExamplesIntent(commandText);
  }
  if (actionId === "dashboard_widget_create") {
    return shouldSuppressDashboardWidgetIntent(commandText);
  }
  return false;
}

type AiCommandClauseHint = {
  actionId: AiCommandActionId;
  start: number;
};

function collectAiCommandClauseHints(commandText: string): AiCommandClauseHint[] {
  const matchStart = (regex: RegExp): number | null => {
    const match = regex.exec(commandText);
    return typeof match?.index === "number" ? match.index : null;
  };
  const addHint = (
    hints: AiCommandClauseHint[],
    actionId: AiCommandActionId,
    matchers: RegExp[]
  ) => {
    const starts = matchers
      .map((matcher) => matchStart(matcher))
      .filter((value): value is number => typeof value === "number");
    if (starts.length === 0) return;
    hints.push({
      actionId,
      start: Math.min(...starts)
    });
  };

  const hints: AiCommandClauseHint[] = [];
  addHint(hints, "database_create_section", [
    /\bcreate\s+(?:a|an|the)?\s*database\s+(?:section|table|schema)\b/i,
    /\bcreate\s+(?:a|an|the)?\s*(?:section|table|schema)\s+(?:named|called)\b/i,
    /\bdatabase\s+(?:section|table|schema)\s+(?:named|called)\b/i
  ]);
  addHint(hints, "database_seed_examples", [
    /\b(?:then|and then|also|next)?\s*(?:add|create|seed|populate|fill)\s+\d{0,2}\s*(?:sample|example)?\s*(?:rows|records|examples?)\b/i,
    /\b(?:then|and then|also|next)?\s*(?:add|create|seed|populate|fill)\s+(?:sample|example)\s+(?:rows|records)\b/i
  ]);
  addHint(hints, "dashboard_widget_create", [
    /\b(?:then|and then|also|next)?\s*(?:create|add)\b[^.;\n]*\b(?:widget|dashboard|metric|distribution|matrix|heatmap|chart)\b/i
  ]);
  addHint(hints, "execution_task_create", [
    /\b(?:then|and then|also|next)?\s*(?:create|add)\b[^.;\n]*\b(?:tasks?|action items?|follow[- ]ups?)\b/i
  ]);
  return hints.sort((left, right) => left.start - right.start);
}

function extractAiCommandClauseText(commandText: string, actionId: AiCommandActionId): string {
  const hints = collectAiCommandClauseHints(commandText);
  const currentIndex = hints.findIndex((hint) => hint.actionId === actionId);
  if (currentIndex < 0) return commandText.trim();
  const currentHint = hints[currentIndex];
  const nextHint = hints[currentIndex + 1];
  const rawSlice = commandText.slice(currentHint.start, nextHint?.start ?? commandText.length).trim();
  return rawSlice.replace(/[;,\s]+$/g, "").trim();
}

export function inferAiCommandActionId(commandText: string): AiCommandActionId | null {
  const text = commandText.toLowerCase();
  const hasCreateIntent = hasCreationVerb(text);
  const suppressDatabaseExamplesIntent = shouldSuppressDatabaseExamplesIntent(text);
  const suppressWidgetIntent = shouldSuppressDashboardWidgetIntent(text);
  const hasScheduleIntent =
    /\bset schedule\b/.test(text) ||
    /\bschedule\b/.test(text) ||
    /\bdeadline\b/.test(text) ||
    /\bstart date\b/.test(text) ||
    /\bend date\b/.test(text);
  const hasExplicitDatabaseSectionIntent =
    hasCreateIntent &&
    ((/\bdatabase\s+(section|table|schema)\b/.test(text) ||
      /\b(section|table|schema)\s+(named|called)\b/.test(text) ||
      /\bwith\s+fields?\s*[:=]/.test(text) ||
      /\bfields?\s*[:=]/.test(text) ||
      /\bcolumns?\s*[:=]/.test(text)) &&
      (text.includes("database") ||
        text.includes("schema") ||
        text.includes("section") ||
        text.includes("table") ||
        text.includes("field") ||
        text.includes("fields") ||
        text.includes("column") ||
        text.includes("columns")));
  const hasDatabaseExamplesIntent = !suppressDatabaseExamplesIntent && hasDatabaseExamplesRequest(text);
  const hasDatabaseIntent =
    hasCreateIntent &&
    (text.includes("database") ||
      text.includes("schema") ||
      text.includes("field") ||
      text.includes("fields") ||
      text.includes("column") ||
      text.includes("columns"));
  const hasWidgetIntent = !suppressWidgetIntent && hasDashboardWidgetRequest(text);
  const hasGovernanceIntent =
    (text.includes("framework") ||
      text.includes("governance") ||
      text.includes("risk management") ||
      text.includes("risk register") ||
      text.includes("controls") ||
      text.includes("compliance")) &&
    (text.includes("create") ||
      text.includes("build") ||
      text.includes("generate") ||
      text.includes("design") ||
      text.includes("make"));
  const hasTaskIntent =
    hasCreateIntent &&
    (/\btask\b/.test(text) ||
      /\btasks\b/.test(text) ||
      /\baction item\b/.test(text) ||
      /\bfollow[- ]up\b/.test(text) ||
      /\bto[- ]do\b/.test(text) ||
      /\btodo\b/.test(text) ||
      /\bmitigation action\b/.test(text));
  if ((text.includes("wbs") || text.includes("work breakdown") || text.includes("break down") || text.includes("breakdown")) &&
    (text.includes("document") || text.includes("documents") || text.includes("doc") || text.includes("file") || text.includes("pdf") || text.includes("proposal") || text.includes("brief") || text.includes("report") || text.includes("upload"))) {
    return "wbs_from_document";
  }
  if (text.includes("plan my day") || text.includes("my day") || text.includes("daily plan") || text.includes("focus list")) return "plan_my_day";
  if (text.includes("wbs") || text.includes("work breakdown") || text.includes("break down") || text.includes("breakdown")) return "wbs_generate";
  if (/\bimport\b/.test(text)) return "workspace_import";
  if (/\b(?:re-sync|resync|synchronize|sync)\b/.test(text)) return "workspace_resync";
  if (text.includes("clear schedule") || text.includes("remove schedule") || text.includes("delete schedule")) return "timeline_clear_schedule";
  if ((text.includes("review") || text.includes("analyze") || text.includes("summarize")) && (text.includes("document") || text.includes("documents") || text.includes("doc") || text.includes("file"))) return "document_review";
  if (hasExplicitDatabaseSectionIntent) return "database_create_section";
  if (hasDatabaseExamplesIntent) return "database_seed_examples";
  if (hasWidgetIntent) return "dashboard_widget_create";
  if (hasDatabaseIntent) return "database_create_section";
  if (hasGovernanceIntent) return "governance_framework_generate";
  if (hasTaskIntent) return "execution_task_create";
  if (hasScheduleIntent) return "timeline_set_schedule";
  if (text.includes("timeline")) return "timeline_open";
  if (text.includes("desktop")) return "desktop_open";
  if (/\brename\b/.test(text)) return "tree_rename_selected";
  if (/\bmove\b/.test(text)) return "tree_move_selected";
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

export function normalizeAiCommandActionSequence(
  rawSteps: Array<{
    actionId: AiCommandActionId | null;
    args?: Record<string, unknown> | null;
  }>,
  commandText: string
): AiPlannerActionStep[] {
  const normalizedSteps: AiPlannerActionStep[] = [];
  const seenKeys = new Set<string>();

  for (const rawStep of rawSteps) {
    if (!rawStep.actionId) continue;
    if (shouldSuppressAiCommandAction(rawStep.actionId, commandText)) continue;
    const args = sanitizeAiCommandArgs(rawStep.actionId, rawStep.args ?? {}, commandText);
    const dedupeKey = `${rawStep.actionId}:${JSON.stringify(args)}`;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);
    normalizedSteps.push({
      actionId: rawStep.actionId,
      args
    });
    if (normalizedSteps.length >= AI_MAX_ACTION_SEQUENCE_STEPS) break;
  }

  const createdSectionName =
    normalizedSteps.find((step) => step.actionId === "database_create_section")?.args?.section_name;
  const sectionName =
    typeof createdSectionName === "string" && createdSectionName.trim().length > 0
      ? createdSectionName.trim()
      : "";

  if (sectionName) {
    for (const step of normalizedSteps) {
      if (step.actionId === "database_seed_examples" && typeof step.args.section_name !== "string") {
        step.args = {
          ...step.args,
          section_name: sectionName
        };
      }
      if (
        step.actionId === "dashboard_widget_create" &&
        typeof step.args.source_ref !== "string" &&
        typeof step.args.section_name !== "string"
      ) {
        step.args = {
          ...step.args,
          source_ref: sectionName,
          source_kind:
            typeof step.args.source_kind === "string" && step.args.source_kind.trim().length > 0
              ? step.args.source_kind
              : "database_records"
        };
      }
    }
  }

  return normalizedSteps;
}

export function inferAiCommandActionSequence(
  commandText: string,
  preferredActionId?: AiCommandActionId | null
): AiPlannerActionStep[] {
  const text = commandText.toLowerCase();
  const hasCreateIntent = hasCreationVerb(text);
  const suppressDatabaseExamplesIntent = shouldSuppressDatabaseExamplesIntent(text);
  const suppressWidgetIntent = shouldSuppressDashboardWidgetIntent(text);
  const hasExplicitDatabaseSectionIntent =
    hasCreateIntent &&
    ((/\bdatabase\s+(section|table|schema)\b/.test(text) ||
      /\b(section|table|schema)\s+(named|called)\b/.test(text) ||
      /\bwith\s+fields?\s*[:=]/.test(text) ||
      /\bfields?\s*[:=]/.test(text) ||
      /\bcolumns?\s*[:=]/.test(text)) &&
      (text.includes("database") ||
        text.includes("schema") ||
        text.includes("section") ||
        text.includes("table") ||
        text.includes("field") ||
        text.includes("fields") ||
        text.includes("column") ||
        text.includes("columns")));
  const hasDatabaseExamplesIntent = !suppressDatabaseExamplesIntent && hasDatabaseExamplesRequest(text);
  const hasDatabaseIntent =
    hasCreateIntent &&
    (text.includes("database") ||
      text.includes("schema") ||
      text.includes("field") ||
      text.includes("fields") ||
      text.includes("column") ||
      text.includes("columns"));
  const hasWidgetIntent = !suppressWidgetIntent && hasDashboardWidgetRequest(text);
  const hasTaskIntent =
    hasCreateIntent &&
    (/\btask\b/.test(text) ||
      /\btasks\b/.test(text) ||
      /\baction item\b/.test(text) ||
      /\bfollow[- ]up\b/.test(text) ||
      /\bto[- ]do\b/.test(text) ||
      /\btodo\b/.test(text) ||
      /\bmitigation action\b/.test(text));

  const buildArgsForAction = (actionId: AiCommandActionId) => {
    const clauseArgs = inferAiCommandArgs(extractAiCommandClauseText(commandText, actionId), actionId);
    const fallbackArgs = { ...inferAiCommandArgs(commandText, actionId) };
    if (actionId === "execution_task_create" && clauseArgs.count === undefined) {
      delete fallbackArgs.count;
    }
    return mergeAiCommandArgs(clauseArgs, fallbackArgs);
  };

  const requestedSteps: Array<{ actionId: AiCommandActionId; args?: Record<string, unknown> }> = [];
  const listedDatabaseSections = extractDatabaseSectionList(commandText);
  if (hasExplicitDatabaseSectionIntent) {
    requestedSteps.push({
      actionId: "database_create_section",
      args: buildArgsForAction("database_create_section")
    });
  } else if ((hasDatabaseIntent || preferredActionId === "database_create_section") && listedDatabaseSections.length > 0) {
    const sharedArgs = buildArgsForAction("database_create_section");
    const {
      fields: _sharedFields,
      field_specs: _sharedFieldSpecs,
      ...sharedSectionArgs
    } = sharedArgs;
    for (const sectionName of listedDatabaseSections) {
      requestedSteps.push({
        actionId: "database_create_section",
        args: {
          ...sharedSectionArgs,
          section_name: sectionName
        }
      });
    }
  }
  if (hasDatabaseExamplesIntent) {
    requestedSteps.push({
      actionId: "database_seed_examples",
      args: buildArgsForAction("database_seed_examples")
    });
  }
  if (hasWidgetIntent) {
    const widgetArgs = buildArgsForAction("dashboard_widget_create");
    const widgetTitles = extractDashboardWidgetTitles(commandText);
    if (widgetTitles.length > 1) {
      for (const title of widgetTitles) {
        requestedSteps.push({
          actionId: "dashboard_widget_create",
          args: {
            ...widgetArgs,
            title,
            widget_type: inferDashboardWidgetTypeFromTitle(
              title,
              typeof widgetArgs.widget_type === "string" ? widgetArgs.widget_type : "metric"
            )
          }
        });
      }
    } else {
      requestedSteps.push({
        actionId: "dashboard_widget_create",
        args:
          widgetTitles.length === 1 && typeof widgetArgs.title !== "string"
            ? {
                ...widgetArgs,
                title: widgetTitles[0],
                widget_type: inferDashboardWidgetTypeFromTitle(
                  widgetTitles[0],
                  typeof widgetArgs.widget_type === "string" ? widgetArgs.widget_type : "metric"
                )
              }
            : widgetArgs
      });
    }
  }
  if (hasTaskIntent) {
    requestedSteps.push({
      actionId: "execution_task_create",
      args: buildArgsForAction("execution_task_create")
    });
  }
  if (requestedSteps.length === 0 && preferredActionId) {
    requestedSteps.push({
      actionId: preferredActionId,
      args: buildArgsForAction(preferredActionId)
    });
  }

  return normalizeAiCommandActionSequence(requestedSteps, commandText);
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
    "database_create_section: Create a database section in the Database workspace and optional aligned fields. args: { section_name?, fields?: string[], field_specs?: [{ label, type?, required?, placeholder?, options?, priorityOptions?, formulaExpression?, relationTargetRef?, relationDisplayFieldRefs?, automationRole?, autoValue?, showInMasterList? }] }",
    "database_seed_examples: Create sample/example records inside an existing database section. args: { section_name?, count?, scenario? }",
    "dashboard_widget_create: Create and configure one dashboard widget under the current node. args: { title?, widget_type?, source_ref?, source_kind?, group_field?, secondary_group_field?, measure_field?, aggregation?, filter_field?, filter_value?, filter_operator?, limit? }",
    "governance_framework_generate: Generate a dynamic governance framework definition and create framework nodes/widgets in current context. args: { framework_name?, goal?, modules?: string[] }",
    "execution_task_create: Create one or more execution tasks in the current execution/workarea context. args: { title?, names?: string[], scenario?, count?, deliverable_title?, owner_ref?, due_date?, status?, note? }",
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
  const databaseFieldCatalog = [
    "Dynamic capability catalog:",
    "Field types: short_text, long_text, rich_text, message, number, year, month, day, decimal, percentage, currency, date, time, datetime, duration, priority, single_select, multi_select, tags, yes_no, email, phone, identifier, url, user_ref, user_list, attachment, table, node_link, organization_link, relation, relation_list, formula.",
    "Automatic values: current_user for user fields, today for date fields, now for date/time/datetime fields.",
    "Workflow automation roles: execution_owner_node, execution_deliverable, execution_task, execution_subtask, execution_status, execution_due_date, execution_note.",
    "Use field_specs when the user describes typed fields, formulas, relations, priority scales, workflow mappings, or auto values.",
    "Relation fields stay dynamic by pointing to another section/module label through relationTargetRef and optional relationDisplayFieldRefs.",
    "Formula fields stay dynamic through formulaExpression only.",
    "Priority fields stay dynamic through priorityOptions with ranked values, colors, scores, reviewDays, and escalate flags.",
    "Structured field examples: Owner = relation(Owners) | display: Full Name ; Residual Score = formula(Likelihood * Impact) ; Review Date = date | role: execution_due_date ; Priority = priority(Low, Medium, High, Critical).",
    "Preserve labels like Author, Tags, Meeting URL, Attendees, Scheduled At, Created At so the database engine can align correct defaults automatically.",
    "Prefer database_create_section when the user explicitly asks for a database section/table/schema with fields, even if the section name is Risk Register, Controls, Actions, or Reviews.",
    "Treat risk matrix or likelihood/impact matrix as database structure unless the user explicitly asks for a dashboard widget or chart.",
    "Respect negative instructions exactly. If the user says not to create widgets, dashboards, examples, sample data, or records yet, do not return those actions.",
    "When the user provides a list of database sections or tables, return several database_create_section actions, one per listed section.",
    "When the user lists several widgets, return several dashboard_widget_create actions, one per widget.",
    "When the user asks for follow-up tasks without exact names, keep the scenario in args.scenario so execution can synthesize them safely.",
    "Multi-step workflows are allowed: one command can create a section, seed sample rows, add several widgets, and create tasks in one ordered action sequence."
  ].join("\n");

  return {
    systemPrompt: [
      "You are ODETool AI command planner.",
      "Return exactly one JSON object and no markdown.",
      "Do not include actions outside the allowed action list.",
      "Keep args minimal and safe.",
      "When the command asks for multiple outcomes, return them in ordered actions.",
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
      databaseFieldCatalog,
      "",
      "Return JSON schema:",
      "{",
      '  "intent": "string",',
      '  "action_id": "string | null",',
      '  "actions": [{"action_id": "string", "args": {}}],',
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
  const linePatterns = [
    /\b(?:section|table|schema)\s+(?:named|called)\s+\"?([^\"\n,]+?)\"?(?=\s+(?:with|including|using|for)\b|$)/i,
    /\b(?:create|add|build)\b[^.\n]*?\b(?:database\s+)?(?:section|table|schema)\s+(?:named|called)\s+\"?([^\"\n;:]+?)\"?(?=\s+(?:with|including|using|for)\b|$)/i,
    /\b(?:create|add|build)\b[^.\n]*?\b(?:database\s+)?(?:section|table|schema)\s+\"?([^\"\n;:]+?)\"?(?=\s+(?:with|including|using|for)\b|$)/i,
    /\bcreate\s+(?:a|an|the)?\s*\"?([^\"\n,]+?)\"?\s+(?:database\s+)?(?:section|table|schema)\b/i
  ];
  for (const rawLine of text.split(/\r?\n/g)) {
    const line = stripAiListPrefix(rawLine);
    if (!line) continue;
    for (const pattern of linePatterns) {
      const candidate = pattern.exec(line)?.[1]?.trim();
      if (!candidate) continue;
      if (isWeakDatabaseSectionName(candidate)) continue;
      return candidate;
    }
  }

  const patterns = [
    /\b(?:section|table|schema)\s+(?:named|called)\s+\"?([^\"\n,]+?)\"?(?=\s+(?:with|including)\b|[\r\n.;]|$)/i,
    /\bcreate\b[^.\n]*?\b(?:database\s+)?(?:section|table|schema)\s+(?:named|called)\s+\"?([^\"\n;:]+?)\"?(?=\s+(?:with|including|using|for)\b|[\r\n.;]|$)/i,
    /\bcreate\b[^.\n]*?\b(?:database\s+)?(?:section|table|schema)\s+\"?([^\"\n;:]+?)\"?(?=\s+(?:with|including|using|for)\b|[\r\n.;]|$)/i,
    /\b(?:add|build)\b[^.\n]*?\b(?:database\s+)?(?:section|table|schema)\s+(?:named|called)\s+\"?([^\"\n;:]+?)\"?(?=\s+(?:with|including|using|for)\b|[\r\n.;]|$)/i,
    /\b(?:add|build)\b[^.\n]*?\b(?:database\s+)?(?:section|table|schema)\s+\"?([^\"\n;:]+?)\"?(?=\s+(?:with|including|using|for)\b|[\r\n.;]|$)/i,
    /\bcreate\s+(?:a|an|the)?\s*\"?([^\"\n,]+?)\"?\s+(?:database\s+)?(?:section|table|schema)\b/i,
    /\b(?:database|schema)\s+(?:for|named|called)\s+\"?([^\"\n,]+?)\"?(?=\s+(?:with|including)\b|[\r\n.;]|$)/i
  ];
  for (const pattern of patterns) {
    const candidate = pattern.exec(text)?.[1]?.trim();
    if (!candidate) continue;
    if (isWeakDatabaseSectionName(candidate)) continue;
    return candidate;
  }
  return "";
}

function extractDatabaseSectionList(text: string): string[] {
  return extractAiHeadingList(text, [
    /\b(?:include\s+at\s+least|include\s+these|database\s+sections?|database\s+tables?|registers?|tables?)\b.*:$/i,
    /\b(?:create|build)\b.*\b(?:database\s+sections?|database\s+tables?)\b.*:$/i
  ])
    .map((entry) => entry.replace(/[:.;]+$/g, "").trim())
    .filter((entry) => entry.length > 0 && !isWeakDatabaseSectionName(entry))
    .slice(0, 24);
}

function extractAiFieldSpecs(text: string): AiDatabaseFieldSpec[] {
  const specs: AiDatabaseFieldSpec[] = [];
  const addLines = (entries: string[]) => {
    for (const entry of entries) {
      if (!entry) continue;
      if (entry.includes(",") && !/[=:>(]/.test(entry)) {
        for (const subEntry of extractDelimitedList(entry)) {
          const parsed = parseAiFieldSpecLine(subEntry);
          if (parsed) specs.push(parsed);
        }
        continue;
      }
      const parsed = parseAiFieldSpecLine(entry);
      if (parsed) specs.push(parsed);
    }
  };

  const inlineSource =
    text.match(/\b(?:fields?|columns?)\s*(?:\:|->|=|include|includes|including)\s*(.+)$/i)?.[1] ??
    text.match(/\bwith\s+(.+?)\s+(?:as\s+)?(?:fields?|columns?)\b/i)?.[1] ??
    "";
  if (inlineSource) {
    addLines(extractAiTopLevelDelimitedEntries(inlineSource));
  }

  addLines(
    extractAiHeadingList(text, [
      /\b(?:fields?|columns?)\b.*:$/i,
      /\bfield design\b.*:$/i,
      /\bfield structure\b.*:$/i,
      /\buse a practical structure for\b.*:$/i,
      /\bbuild\b.*\bwith fields\b.*:$/i,
      /\badd useful fields\b.*:$/i
    ])
  );

  return coerceAiDatabaseFieldSpecs(specs);
}

function extractDatabaseFields(text: string): string[] {
  const fieldSpecs = extractAiFieldSpecs(text);
  if (fieldSpecs.length > 0) {
    return fieldSpecs.map((entry) => entry.label).slice(0, 40);
  }
  const source =
    text.match(/\b(?:fields?|columns?)\s*(?:\:|->|=|include|includes|including)\s*(.+)$/i)?.[1] ??
    text.match(/\bwith\s+(.+?)\s+(?:as\s+)?(?:fields?|columns?)\b/i)?.[1] ??
    "";
  if (!source) return [];
  const values = extractDelimitedList(source);
  return values.length >= 2 ? values : [];
}

function extractRequestedCount(text: string, fallback = 3): number {
  const numericMatch =
    text.match(/\b(\d{1,2})(?:\s+[a-z][a-z-]*){0,3}\s+(?:examples?|samples?|records?|rows?|tasks?|widgets?)\b/i) ??
    text.match(/\b(?:examples?|samples?|records?|rows?|tasks?|widgets?)\s*[:=]?\s*(\d{1,2})\b/i);
  const parsed = numericMatch?.[1] ? Number.parseInt(numericMatch[1], 10) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(12, parsed));
}

function inferDashboardWidgetTypeFromTitle(title: string, fallback: string): string {
  const normalized = title.trim().toLowerCase();
  if (!normalized) return fallback;
  if (/\bmatrix\b|\bheatmap\b/.test(normalized)) return "matrix";
  if (/\btable\b|\blist\b/.test(normalized)) return "table";
  if (/\bby\b/.test(normalized) || /\bbreakdown\b|\bdistribution\b/.test(normalized)) {
    return "distribution";
  }
  return fallback;
}

function extractGovernanceFrameworkName(text: string): string {
  const match =
    text.match(/\b(?:framework|register|program)\s+(?:named|called)\s+\"?([^\"\n,]+?)\"?(?:\s+(?:with|including|for)\b|$)/i) ??
    text.match(/\bcreate\s+(?:a|an|the)?\s*\"?([^\"\n,]+?)\"?\s+(?:governance|risk|compliance)\s+framework\b/i) ??
    text.match(/\bbuild\s+(?:a|an|the)?\s*\"?([^\"\n,]+?)\"?\s+(?:governance|risk|compliance)\s+framework\b/i) ??
    text.match(/\b(?:for|about)\s+\"?([^\"\n,]+?)\"?(?:\s+(?:framework|register)\b|$)/i);
  return match?.[1]?.trim() ?? "";
}

function extractGovernanceModules(text: string): string[] {
  const source =
    text.match(/\b(?:modules?|areas?)\s*(?:\:|->|=|include|includes|including)\s*(.+)$/i)?.[1] ??
    text.match(/\bwith\s+(.+?)\s+(?:as\s+)?modules?\b/i)?.[1] ??
    "";
  if (!source) return [];
  return extractDelimitedList(source).slice(0, 12);
}

function extractDashboardWidgetName(text: string): string {
  const match =
    text.match(/\bwidget\s+(?:named|called)\s+\"?([^\"\n,]+?)\"?(?:\s+(?:for|from|using|with)\b|$)/i) ??
    text.match(/\b(?:metric|distribution|table|matrix|heatmap|chart)\s+(?:widget\s+)?(?:named|called)\s+\"?([^\"\n,]+?)\"?(?:\s+(?:for|from|using|with)\b|$)/i) ??
    text.match(/\bcreate\s+(?:(?:a|an|the)\s+)?\"?([^\"\n,]+?)\"?\s+widget\b/i) ??
    text.match(/\bcreate\s+(?:(?:a|an)\s+)?(?:dashboard\s+)?(?:widget|metric|distribution|table|matrix|heatmap|chart)\s+\"?([^\"\n,]+?)\"?(?:\s+(?:for|from|using|with)\b|$)/i);
  return match?.[1]?.trim() ?? "";
}

function extractDashboardWidgetTitles(text: string): string[] {
  const values = extractAiHeadingList(text, [
    /\bwidgets?\b.*:$/i,
    /\binsights?\b.*:$/i,
    /\bcreate\b.*\bwidgets?\s+for\b.*:$/i,
    /\balso create widgets?\s+for\b.*:$/i
  ]);
  if (values.length > 0) return values.slice(0, 12);

  const inlineMatch =
    text.match(
      /\b(?:create|add)(?:\s+(?:dashboard\s+)?widgets?)\s+for\s+(.+?)(?=(?:\s+(?:then|next|after that)\b)|(?:\s+and\s+create\s+(?:tasks?|action items?|follow[- ]ups?)\b)|[.;\n]|$)/i
    ) ??
    text.match(
      /\bwidgets?\s+for\s+(.+?)(?=(?:\s+(?:then|next|after that)\b)|(?:\s+and\s+create\s+(?:tasks?|action items?|follow[- ]ups?)\b)|[.;\n]|$)/i
    );
  if (!inlineMatch?.[1]) return [];

  return Array.from(
    new Set(
      inlineMatch[1]
        .replace(/\s*,\s*and\s+/gi, ", ")
        .replace(/\s+and\s+/gi, ", ")
        .split(/\s*,\s*/)
        .map((entry) => stripAiListPrefix(entry))
        .map((entry) => entry.replace(/[.;]+$/g, "").trim())
        .filter((entry) => entry.length > 0)
    )
  ).slice(0, 12);
}

function extractDashboardWidgetType(text: string): string {
  if (/\bmatrix\b|\bheatmap\b/i.test(text)) return "matrix";
  if (/\bdistribution\b|\bchart\b/i.test(text)) return "distribution";
  if (/\btable\b/i.test(text)) return "table";
  return "metric";
}

function extractDashboardSourceRef(text: string): string {
  const match =
    text.match(/\b(?:from|using|for)\s+(?:database\s+section|database\s+table|section|table|widget)\s+\"?([^\"\n,]+?)\"?(?:\s+(?:with|where|group|filter|and)\b|$)/i) ??
    text.match(/\bsource\s*(?:\:|=)\s*\"?([^\"\n,]+?)\"?(?:\s|$)/i);
  return match?.[1]?.trim() ?? "";
}

function extractDashboardFieldRef(text: string, mode: "group" | "secondary" | "measure" | "filter"): string {
  if (mode === "measure") {
    const match = text.match(/\b(?:sum|average|avg|min|max)\s+(?:of\s+)?\"?([^\"\n,]+?)\"?(?:\s+(?:by|for|with|where)\b|$)/i);
    return match?.[1]?.trim() ?? "";
  }
  if (mode === "filter") {
    const match = text.match(/\b(?:where|filter(?:ed)?\s+by)\s+\"?([^\"\n=]+?)\"?\s*(?:=|is|contains)?\s*\"?([^\"\n]+?)\"?$/i);
    return match?.[1]?.trim() ?? "";
  }
  const matrixMatch = text.match(/\b(?:matrix|heatmap)\b.*?\b([a-z][a-z0-9 _-]+?)\s+(?:vs|x|by)\s+([a-z][a-z0-9 _-]+)\b/i);
  if (matrixMatch?.[1] && matrixMatch?.[2]) {
    return mode === "group" ? matrixMatch[1].trim() : matrixMatch[2].trim();
  }
  const byMatch = text.match(/\bby\s+([a-z][a-z0-9 _-]+?)(?:\s+and\s+([a-z][a-z0-9 _-]+))?(?:\s+(?:for|with|where|using)\b|$)/i);
  if (!byMatch?.[1]) return "";
  if (mode === "group") return byMatch[1].trim();
  return byMatch[2]?.trim() ?? "";
}

function extractDashboardFilterValue(text: string): string {
  const match = text.match(/\b(?:where|filter(?:ed)?\s+by)\s+\"?([^\"\n=]+?)\"?\s*(?:=|is|contains)?\s*\"?([^\"\n]+?)\"?$/i);
  return match?.[2]?.trim() ?? "";
}

function extractExecutionTaskTitle(text: string): string {
  const match =
    text.match(/\btask\s+(?:named|called)\s+\"?([^\"\n]+?)\"?(?:\s+(?:for|under|in|with)\b|$)/i) ??
    text.match(/\bcreate\s+(?:a|an)?\s*(?:task|action item|follow[- ]up)\s+\"?([^\"\n]+?)\"?(?:\s+(?:for|under|in|with)\b|$)/i);
  const candidate = match?.[1]?.trim() ?? "";
  return /^(?:tasks?|action items?|follow[- ]ups?)$/i.test(candidate) ? "" : candidate;
}

function extractExecutionTaskNames(text: string): string[] {
  const source =
    text.match(/\b(?:tasks?|action items?|follow[- ]ups?)\s*(?:\:|->|=|include|includes|including)\s*(.+)$/i)?.[1] ??
    "";
  if (source) return extractDelimitedList(source).slice(0, 12);
  return extractAiHeadingList(text, [
    /\b(?:tasks?|action items?|follow[- ]ups?)\b.*:$/i,
    /\bcreate tasks?\s+for\b.*:$/i,
    /\balso create tasks?\s+for\b.*:$/i
  ]).slice(0, 12);
}

function extractExecutionTaskScenario(text: string): string {
  const match =
    text.match(/\b(?:tasks?|action items?|follow[- ]ups?)\s+(?:for|about|on)\s+(.+?)(?=[\r\n.;]|$)/i) ??
    text.match(/\bcreate\b[^.\n]*\btasks?\s+for\s+(.+?)(?=[\r\n.;]|$)/i) ??
    text.match(/\bfollow[- ]up tasks?\s+for\s+(.+?)(?=[\r\n.;]|$)/i);
  return match?.[1]?.trim() ?? "";
}

function mergeAiCommandArgs(
  primary: Record<string, unknown>,
  fallback: Record<string, unknown>
): Record<string, unknown> {
  const merged = { ...fallback };
  for (const [key, value] of Object.entries(primary)) {
    if (
      value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim().length === 0) ||
      (Array.isArray(value) && value.length === 0) ||
      (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0)
    ) {
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

function extractExecutionDeliverableTitle(text: string): string {
  const match =
    text.match(/\bdeliverable\s+(?:named|called)\s+\"?([^\"\n,]+?)\"?(?:\s+(?:with|for|under)\b|$)/i) ??
    text.match(/\b(?:for|under|in)\s+deliverable\s+\"?([^\"\n,]+?)\"?(?:\s+(?:with|by)\b|$)/i);
  return match?.[1]?.trim() ?? "";
}

function extractExecutionOwnerRef(text: string): string {
  const match =
    text.match(/\bowner\s+(?:named|called)\s+\"?([^\"\n,]+?)\"?(?:\s+(?:with|for|under)\b|$)/i) ??
    text.match(/\bfor\s+owner\s+\"?([^\"\n,]+?)\"?(?:\s+(?:with|by)\b|$)/i);
  return match?.[1]?.trim() ?? "";
}

export function inferAiCommandArgs(commandText: string, actionId: AiCommandActionId | null): Record<string, unknown> {
  if (!actionId) return {};
  const text = commandText.trim();
  if (actionId === "database_create_section") {
    const sectionName = extractDatabaseSectionName(text);
    const fieldSpecs = extractAiFieldSpecs(text);
    const fields = fieldSpecs.length > 0 ? fieldSpecs.map((entry) => entry.label) : extractDatabaseFields(text);
    const args: Record<string, unknown> = {};
    if (sectionName) args.section_name = sectionName;
    if (fieldSpecs.length > 0) args.field_specs = fieldSpecs;
    if (fields.length > 0) args.fields = fields;
    return args;
  }
  if (actionId === "database_seed_examples") {
    const sectionName = extractDatabaseSectionName(text);
    const scenario = (
      text.match(/\b(?:for|about|focused on|focus on)\s*(?:\:)?\s*(.+)$/i)?.[1] ??
      ""
    ).trim();
    const args: Record<string, unknown> = {
      count: extractRequestedCount(text, 3)
    };
    if (sectionName) args.section_name = sectionName;
    if (scenario) args.scenario = scenario;
    return args;
  }
  if (actionId === "dashboard_widget_create") {
    const widgetTitles = extractDashboardWidgetTitles(text);
    const title = extractDashboardWidgetName(text) || (widgetTitles.length === 1 ? widgetTitles[0] : "");
    const widgetType = extractDashboardWidgetType(text);
    const sourceRef = extractDashboardSourceRef(text) || extractDatabaseSectionName(text);
    const groupField = extractDashboardFieldRef(text, "group");
    const secondaryGroupField = extractDashboardFieldRef(text, "secondary");
    const measureField = extractDashboardFieldRef(text, "measure");
    const filterField = extractDashboardFieldRef(text, "filter");
    const filterValue = extractDashboardFilterValue(text);
    const aggregation = /\baverage\b|\bavg\b/i.test(text)
      ? "avg"
      : /\bsum\b/i.test(text)
        ? "sum"
        : /\bminimum\b|\bmin\b/i.test(text)
          ? "min"
          : /\bmaximum\b|\bmax\b/i.test(text)
            ? "max"
            : "count";
    const args: Record<string, unknown> = {
      widget_type: widgetType,
      aggregation,
      limit: extractRequestedCount(text, widgetType === "table" ? 8 : 6)
    };
    if (title) args.title = title;
    if (sourceRef) args.source_ref = sourceRef;
    if (groupField) args.group_field = groupField;
    if (secondaryGroupField) args.secondary_group_field = secondaryGroupField;
    if (measureField) args.measure_field = measureField;
    if (filterField) args.filter_field = filterField;
    if (filterValue) args.filter_value = filterValue;
    return args;
  }
  if (actionId === "governance_framework_generate") {
    const frameworkName = extractGovernanceFrameworkName(text);
    const modules = extractGovernanceModules(text);
    const goal = (
      text.match(/\b(?:for|about|focused on|focus on)\s*(?:\:)?\s*(.+)$/i)?.[1] ??
      text.match(/\b(?:framework|register|program)\s*(?:\:|-)\s*(.+)$/i)?.[1] ??
      ""
    ).trim();
    const args: Record<string, unknown> = {};
    if (frameworkName) args.framework_name = frameworkName;
    if (goal) args.goal = goal;
    if (modules.length > 0) args.modules = modules;
    return args;
  }
  if (actionId === "execution_task_create") {
    const title = extractExecutionTaskTitle(text);
    const names = extractExecutionTaskNames(text);
    const deliverableTitle = extractExecutionDeliverableTitle(text);
    const ownerRef = extractExecutionOwnerRef(text);
    const scenario = extractExecutionTaskScenario(text);
    const dates = [...text.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)].map((match) => match[1]);
    const status = text.match(/\bblocked\b/i)
      ? "blocked"
      : text.match(/\bdone|completed|complete\b/i)
        ? "done"
        : text.match(/\bactive|in progress\b/i)
          ? "active"
          : "planned";
    const note = (text.match(/\b(?:note|details?)\s*(?:\:|=)\s*(.+)$/i)?.[1] ?? "").trim();
    const args: Record<string, unknown> = {
      status
    };
    if (title) args.title = title;
    if (names.length > 0) args.names = names;
    if (deliverableTitle) args.deliverable_title = deliverableTitle;
    if (ownerRef) args.owner_ref = ownerRef;
    if (scenario) args.scenario = scenario;
    if (scenario && !title && names.length === 0) args.count = extractRequestedCount(text, 3);
    if (dates[0]) args.due_date = dates[0];
    if (note) args.note = note;
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
  const getNumber = (...keys: string[]) => {
    for (const key of keys) {
      const raw = source[key];
      if (typeof raw === "number" && Number.isFinite(raw)) return raw;
      if (typeof raw === "string") {
        const parsed = Number.parseInt(raw.trim(), 10);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return Number.NaN;
  };
  if (actionId === "database_create_section") {
    const args: Record<string, unknown> = {};
    const sectionName = getString("section_name", "sectionName", "name", "title", "section");
    const fields = getStringList("fields", "columns", "names");
    const fieldSpecs = coerceAiDatabaseFieldSpecs(source.field_specs ?? source.fieldSpecs);
    if (sectionName && !isWeakDatabaseSectionName(sectionName)) args.section_name = sectionName;
    if (fieldSpecs.length > 0) {
      args.field_specs = fieldSpecs;
      if (fields.length === 0) {
        args.fields = fieldSpecs.map((entry) => entry.label);
      }
    }
    if (fields.length > 0) args.fields = fields;
    return Object.keys(args).length > 0 ? args : fallback;
  }
  if (actionId === "database_seed_examples") {
    const args: Record<string, unknown> = {};
    const sectionName = getString("section_name", "sectionName", "name", "title", "section");
    const scenario = getString("scenario", "focus", "goal", "brief");
    const count = getNumber("count", "examples", "records", "rows");
    if (sectionName && !isWeakDatabaseSectionName(sectionName)) args.section_name = sectionName;
    if (scenario) args.scenario = scenario;
    if (Number.isFinite(count)) args.count = Math.max(1, Math.min(12, count));
    return Object.keys(args).length > 0 ? args : fallback;
  }
  if (actionId === "dashboard_widget_create") {
    const args: Record<string, unknown> = {};
    const title = getString("title", "name", "widget_title");
    const widgetType = getString("widget_type", "widgetType", "type").toLowerCase();
    const sourceRef = getString("source_ref", "sourceRef", "source", "section_name", "section");
    const sourceKind = getString("source_kind", "sourceKind").toLowerCase();
    const groupField = getString("group_field", "groupField");
    const secondaryGroupField = getString("secondary_group_field", "secondaryGroupField");
    const measureField = getString("measure_field", "measureField");
    const aggregation = getString("aggregation", "aggregate").toLowerCase();
    const filterField = getString("filter_field", "filterField");
    const filterValue = getString("filter_value", "filterValue", "value");
    const filterOperator = getString("filter_operator", "filterOperator").toLowerCase();
    const limit = getNumber("limit", "count");
    if (title) args.title = title;
    if (widgetType === "metric" || widgetType === "distribution" || widgetType === "table" || widgetType === "matrix") {
      args.widget_type = widgetType;
    }
    if (sourceRef) args.source_ref = sourceRef;
    if (sourceKind === "database_records" || sourceKind === "execution_items") args.source_kind = sourceKind;
    if (groupField) args.group_field = groupField;
    if (secondaryGroupField) args.secondary_group_field = secondaryGroupField;
    if (measureField) args.measure_field = measureField;
    if (aggregation === "count" || aggregation === "sum" || aggregation === "avg" || aggregation === "min" || aggregation === "max") {
      args.aggregation = aggregation;
    }
    if (filterField) args.filter_field = filterField;
    if (filterValue) args.filter_value = filterValue;
    if (
      filterOperator === "equals" ||
      filterOperator === "not_equals" ||
      filterOperator === "contains" ||
      filterOperator === "gt" ||
      filterOperator === "gte" ||
      filterOperator === "lt" ||
      filterOperator === "lte"
    ) {
      args.filter_operator = filterOperator;
    }
    if (Number.isFinite(limit)) args.limit = Math.max(1, Math.min(24, limit));
    return Object.keys(args).length > 0 ? args : fallback;
  }
  if (actionId === "governance_framework_generate") {
    const args: Record<string, unknown> = {};
    const frameworkName = getString("framework_name", "frameworkName", "name", "title");
    const goal = getString("goal", "objective", "focus", "brief");
    const modules = getStringList("modules", "areas", "registers");
    if (frameworkName) args.framework_name = frameworkName;
    if (goal) args.goal = goal;
    if (modules.length > 0) args.modules = modules;
    return Object.keys(args).length > 0 ? args : fallback;
  }
  if (actionId === "execution_task_create") {
    const args: Record<string, unknown> = {};
    const title = getString("title", "name", "task", "task_title");
    const names = getStringList("names", "tasks", "titles");
    const scenario = getString("scenario", "focus", "goal", "brief");
    const deliverableTitle = getString("deliverable_title", "deliverableTitle", "deliverable");
    const ownerRef = getString("owner_ref", "ownerRef", "owner");
    const dueDate = getString("due_date", "dueDate");
    const note = getString("note", "notes", "details");
    const statusCandidate = getString("status").toLowerCase();
    const count = getNumber("count", "tasks");
    if (title) args.title = title;
    if (names.length > 0) args.names = names;
    if (scenario) args.scenario = scenario;
    if (deliverableTitle) args.deliverable_title = deliverableTitle;
    if (ownerRef) args.owner_ref = ownerRef;
    if (dueDate) args.due_date = dueDate;
    if (note) args.note = note;
    if (Number.isFinite(count)) args.count = Math.max(1, Math.min(12, count));
    if (statusCandidate === "planned" || statusCandidate === "active" || statusCandidate === "blocked" || statusCandidate === "done") {
      args.status = statusCandidate;
    }
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
  if (actionId === "document_review") return getString("goal", "objective", "focus") ? { goal: getString("goal", "objective", "focus") } : fallback;
  if (actionId === "ticket_draft_reply") return getString("instructions", "style", "tone", "guidance") ? { instructions: getString("instructions", "style", "tone", "guidance") } : fallback;
  return {};
}

export function parseAiPlannerPayload(rawResponse: string, commandText: string): AiPlannerParseResult | null {
  const jsonPayload = extractFirstJsonObject(rawResponse);
  if (!jsonPayload) return null;
  try {
    const parsed = JSON.parse(jsonPayload) as {
      action_id?: string | null;
      actions?: Array<{ action_id?: string | null; args?: Record<string, unknown> | null }>;
      args?: Record<string, unknown>;
      reason?: string;
      steps?: string[];
      confidence?: number;
      requires_confirmation?: boolean;
    };
    const parsedSequence = normalizeAiCommandActionSequence(
      Array.isArray(parsed.actions)
        ? parsed.actions.map((step) => ({
            actionId: normalizeAiCommandActionId(step?.action_id ?? null),
            args: step?.args ?? {}
          }))
        : [],
      commandText
    );
    const parsedActionId = normalizeAiCommandActionId(parsed.action_id ?? null);
    const actionId =
      parsedSequence[0]?.actionId ??
      (parsedActionId && !shouldSuppressAiCommandAction(parsedActionId, commandText) ? parsedActionId : null);
    const reason = typeof parsed.reason === "string" && parsed.reason.trim().length > 0 ? parsed.reason.trim() : null;
    const steps = Array.isArray(parsed.steps) ? parsed.steps.map((step) => (typeof step === "string" ? step.trim() : "")).filter((step) => step.length > 0).slice(0, 6) : [];
    const confidence = clampAiPlannerConfidence(parsed.confidence, actionId ? 0.72 : 0.18);
    const requiresConfirmation = typeof parsed.requires_confirmation === "boolean" ? parsed.requires_confirmation : true;
    if (!actionId) {
      return {
        actionId: null,
        args: {},
        actionSequence: [],
        reason,
        steps,
        confidence,
        requiresConfirmation
      };
    }
    const actionSequence =
      parsedSequence.length > 0
        ? parsedSequence
        : normalizeAiCommandActionSequence(
            [
              {
                actionId,
                args: parsed.args ?? {}
              }
            ],
            commandText
          );
    return {
      actionId,
      args: actionSequence[0]?.args ?? sanitizeAiCommandArgs(actionId, parsed.args, commandText),
      actionSequence,
      reason,
      steps,
      confidence,
      requiresConfirmation
    };
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
