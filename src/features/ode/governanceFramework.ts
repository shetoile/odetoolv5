import type {
  DashboardAggregation,
  DashboardFilterOperator,
  DashboardWidgetType
} from "@/lib/dashboard";
import {
  normalizeProcedureFieldAutoValue,
  normalizeProcedureFieldType,
  type ProcedureAutomationRole,
  type ProcedureFieldAutoValue,
  type ProcedureFieldType,
  type ProcedurePriorityOption
} from "@/lib/procedureDatabase";

export const GOVERNANCE_FRAMEWORK_SCHEMA_VERSION = 1;
export const GOVERNANCE_FRAMEWORK_PROPERTY_KEY = "odeGovernanceFrameworkDefinition";
export const GOVERNANCE_FRAMEWORK_REQUEST_PROPERTY_KEY = "odeGovernanceFrameworkRequest";
export const GOVERNANCE_FRAMEWORK_VERSION_PROPERTY_KEY = "odeGovernanceFrameworkVersion";
export const GOVERNANCE_FRAMEWORK_RAW_RESPONSE_PROPERTY_KEY = "odeGovernanceFrameworkRawResponse";

export type GovernanceFieldDefinition = {
  id: string;
  label: string;
  icon: string;
  tooltip: string;
  type: ProcedureFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
  priorityOptions?: ProcedurePriorityOption[];
  formulaExpression?: string;
  relationTargetModuleId?: string;
  relationDisplayFieldIds?: string[];
  automationRole?: ProcedureAutomationRole;
  autoValue?: ProcedureFieldAutoValue;
  settings?: Record<string, unknown>;
};

export type GovernanceModuleDefinition = {
  id: string;
  label: string;
  icon: string;
  tooltip: string;
  itemType: "table" | "branch";
  fields: GovernanceFieldDefinition[];
  settings?: Record<string, unknown>;
};

export type GovernanceLifecycleState = {
  id: string;
  label: string;
  icon: string;
  color: string;
  rank: number;
  terminal: boolean;
};

export type GovernanceScoringModel = {
  id: string;
  label: string;
  method: "manual" | "formula" | "matrix_lookup" | "weighted";
  valueFieldIds: string[];
  resultFieldId: string;
  settings?: Record<string, unknown>;
};

export type GovernanceDashboardPreset = {
  id: string;
  label: string;
  icon: string;
  widgetType: DashboardWidgetType;
  sourceModuleId: string;
  aggregation: DashboardAggregation;
  groupFieldId?: string;
  secondaryGroupFieldId?: string;
  measureFieldId?: string;
  displayFieldIds?: string[];
  filters?: Array<{
    fieldId: string;
    operator: DashboardFilterOperator;
    value: string;
  }>;
  settings?: Record<string, unknown>;
};

export type GovernanceFrameworkDefinition = {
  id: string;
  label: string;
  icon: string;
  tooltip: string;
  modules: GovernanceModuleDefinition[];
  lifecycleStates: GovernanceLifecycleState[];
  scoringModels: GovernanceScoringModel[];
  dashboardPresets: GovernanceDashboardPreset[];
  settings: {
    reviewCadenceDays: number;
    escalationThreshold: number;
    evidenceRequired: boolean;
    [key: string]: unknown;
  };
};

const ALLOWED_AGGREGATIONS = new Set<DashboardAggregation>(["count", "sum", "avg", "min", "max"]);
const ALLOWED_FILTER_OPERATORS = new Set<DashboardFilterOperator>([
  "equals",
  "not_equals",
  "contains",
  "gt",
  "gte",
  "lt",
  "lte"
]);
const ALLOWED_WIDGET_TYPES = new Set<DashboardWidgetType>(["metric", "distribution", "table", "matrix"]);
const ALLOWED_AUTOMATION_ROLES = new Set<ProcedureAutomationRole>([
  "none",
  "execution_owner_node",
  "execution_deliverable",
  "execution_task",
  "execution_subtask",
  "execution_status",
  "execution_due_date",
  "execution_note"
]);
const ALLOWED_SCORING_METHODS = new Set<GovernanceScoringModel["method"]>([
  "manual",
  "formula",
  "matrix_lookup",
  "weighted"
]);

function slugifyGovernanceValue(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || fallback;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0)
    )
  );
}

function normalizePriorityOptions(value: unknown): ProcedurePriorityOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    const record = readRecord(entry);
    if (!record) return [];
    const optionValue = readString(record.value || record.label);
    if (!optionValue) return [];
    return [
      {
        value: optionValue,
        icon: readString(record.icon) || optionValue.slice(0, 1).toUpperCase(),
        color: readString(record.color) || "#5dc2ff",
        rank: Math.max(1, Math.floor(readNumber(record.rank, index + 1))),
        score: readNumber(record.score, index + 1),
        tooltip: readString(record.tooltip),
        reviewDays:
          record.reviewDays === null
            ? null
            : Math.max(0, Math.floor(readNumber(record.reviewDays, 0))) || null,
        escalate: readBoolean(record.escalate)
      }
    ];
  });
}

function normalizeGovernanceFieldDefinition(
  value: unknown,
  fallbackPrefix: string
): GovernanceFieldDefinition | null {
  const record = readRecord(value);
  if (!record) return null;
  const label = readString(record.label || record.name || record.title);
  if (!label) return null;
  const type = normalizeProcedureFieldType(record.type);
  const id = slugifyGovernanceValue(readString(record.id) || label, `${fallbackPrefix}_field`);
  const options = readStringList(record.options);
  const priorityOptions = normalizePriorityOptions(record.priorityOptions || record.priority_options);
  const automationRoleCandidate = readString(record.automationRole || record.automation_role);
  const automationRole = ALLOWED_AUTOMATION_ROLES.has(automationRoleCandidate as ProcedureAutomationRole)
    ? (automationRoleCandidate as ProcedureAutomationRole)
    : undefined;
  const autoValueCandidate = normalizeProcedureFieldAutoValue(record.autoValue || record.auto_value);
  const relationDisplayFieldIds = readStringList(
    record.relationDisplayFieldIds || record.relation_display_field_ids
  ).map((entry) => slugifyGovernanceValue(entry, entry));
  const relationTargetModuleId = slugifyGovernanceValue(
    readString(record.relationTargetModuleId || record.relation_target_module_id || record.relationTargetModule),
    ""
  );

  return {
    id,
    label,
    icon: readString(record.icon) || "dot",
    tooltip: readString(record.tooltip),
    type,
    required: readBoolean(record.required),
    placeholder: readString(record.placeholder) || undefined,
    options: options.length > 0 ? options : undefined,
    priorityOptions: priorityOptions.length > 0 ? priorityOptions : undefined,
    formulaExpression: readString(record.formulaExpression || record.formula_expression) || undefined,
    relationTargetModuleId: relationTargetModuleId || undefined,
    relationDisplayFieldIds: relationDisplayFieldIds.length > 0 ? relationDisplayFieldIds : undefined,
    automationRole,
    autoValue: autoValueCandidate !== "none" ? autoValueCandidate : undefined,
    settings: readRecord(record.settings) ?? undefined
  };
}

function normalizeGovernanceModuleDefinition(
  value: unknown,
  index: number
): GovernanceModuleDefinition | null {
  const record = readRecord(value);
  if (!record) return null;
  const label = readString(record.label || record.name || record.title);
  if (!label) return null;
  const itemType = readString(record.itemType) === "branch" ? "branch" : "table";
  const moduleId = slugifyGovernanceValue(readString(record.id) || label, `module_${index + 1}`);
  const rawFields = Array.isArray(record.fields) ? record.fields : [];
  const fields = rawFields
    .map((entry, fieldIndex) => normalizeGovernanceFieldDefinition(entry, `${moduleId}_${fieldIndex + 1}`))
    .filter((entry): entry is GovernanceFieldDefinition => entry !== null);

  return {
    id: moduleId,
    label,
    icon: readString(record.icon) || "module",
    tooltip: readString(record.tooltip),
    itemType,
    fields,
    settings: readRecord(record.settings) ?? undefined
  };
}

function normalizeLifecycleState(value: unknown, index: number): GovernanceLifecycleState | null {
  const record = readRecord(value);
  if (!record) return null;
  const label = readString(record.label || record.name || record.title);
  if (!label) return null;
  return {
    id: slugifyGovernanceValue(readString(record.id) || label, `state_${index + 1}`),
    label,
    icon: readString(record.icon) || "state",
    color: readString(record.color) || "#5dc2ff",
    rank: Math.max(1, Math.floor(readNumber(record.rank, index + 1))),
    terminal: readBoolean(record.terminal)
  };
}

function normalizeScoringModel(value: unknown, index: number): GovernanceScoringModel | null {
  const record = readRecord(value);
  if (!record) return null;
  const label = readString(record.label || record.name || record.title);
  const resultFieldId = slugifyGovernanceValue(
    readString(record.resultFieldId || record.result_field_id),
    ""
  );
  if (!label || !resultFieldId) return null;
  const methodCandidate = readString(record.method);
  return {
    id: slugifyGovernanceValue(readString(record.id) || label, `score_${index + 1}`),
    label,
    method: ALLOWED_SCORING_METHODS.has(methodCandidate as GovernanceScoringModel["method"])
      ? (methodCandidate as GovernanceScoringModel["method"])
      : "manual",
    valueFieldIds: readStringList(record.valueFieldIds || record.value_field_ids).map((entry) =>
      slugifyGovernanceValue(entry, entry)
    ),
    resultFieldId,
    settings: readRecord(record.settings) ?? undefined
  };
}

function normalizeDashboardPreset(value: unknown, index: number): GovernanceDashboardPreset | null {
  const record = readRecord(value);
  if (!record) return null;
  const label = readString(record.label || record.name || record.title);
  const sourceModuleId = slugifyGovernanceValue(
    readString(record.sourceModuleId || record.source_module_id),
    ""
  );
  if (!label || !sourceModuleId) return null;
  const widgetTypeCandidate = readString(record.widgetType || record.widget_type);
  const aggregationCandidate = readString(record.aggregation);
  const filters = Array.isArray(record.filters)
    ? record.filters.flatMap((entry) => {
        const filterRecord = readRecord(entry);
        if (!filterRecord) return [];
        const fieldId = slugifyGovernanceValue(
          readString(filterRecord.fieldId || filterRecord.field_id),
          ""
        );
        const operatorCandidate = readString(filterRecord.operator);
        const value = readString(filterRecord.value);
        if (!fieldId || !ALLOWED_FILTER_OPERATORS.has(operatorCandidate as DashboardFilterOperator)) {
          return [];
        }
        return [
          {
            fieldId,
            operator: operatorCandidate as DashboardFilterOperator,
            value
          }
        ];
      })
    : undefined;

  return {
    id: slugifyGovernanceValue(readString(record.id) || label, `widget_${index + 1}`),
    label,
    icon: readString(record.icon) || "chart",
    widgetType: ALLOWED_WIDGET_TYPES.has(widgetTypeCandidate as DashboardWidgetType)
      ? (widgetTypeCandidate as DashboardWidgetType)
      : "metric",
    sourceModuleId,
    aggregation: ALLOWED_AGGREGATIONS.has(aggregationCandidate as DashboardAggregation)
      ? (aggregationCandidate as DashboardAggregation)
      : "count",
    groupFieldId: slugifyGovernanceValue(readString(record.groupFieldId || record.group_field_id), "") || undefined,
    secondaryGroupFieldId:
      slugifyGovernanceValue(
        readString(record.secondaryGroupFieldId || record.secondary_group_field_id),
        ""
      ) || undefined,
    measureFieldId:
      slugifyGovernanceValue(readString(record.measureFieldId || record.measure_field_id), "") || undefined,
    displayFieldIds:
      readStringList(record.displayFieldIds || record.display_field_ids).map((entry) =>
        slugifyGovernanceValue(entry, entry)
      ),
    filters,
    settings: readRecord(record.settings) ?? undefined
  };
}

function extractFirstJsonObject(raw: string): string | null {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = raw.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") {
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return raw.slice(start, index + 1);
    }
  }
  return null;
}

export function normalizeGovernanceFrameworkDefinition(value: unknown): GovernanceFrameworkDefinition | null {
  const record = readRecord(value);
  if (!record) return null;
  const frameworkRecord =
    readRecord(record.framework) ??
    readRecord(record.definition) ??
    readRecord(record.spec) ??
    record;
  const label = readString(frameworkRecord.label || frameworkRecord.name || frameworkRecord.title);
  if (!label) return null;
  const modules = (Array.isArray(frameworkRecord.modules) ? frameworkRecord.modules : [])
    .map((entry, index) => normalizeGovernanceModuleDefinition(entry, index))
    .filter((entry): entry is GovernanceModuleDefinition => entry !== null);
  if (modules.length === 0) return null;

  const lifecycleStates = (Array.isArray(frameworkRecord.lifecycleStates || frameworkRecord.lifecycle_states)
    ? ((frameworkRecord.lifecycleStates || frameworkRecord.lifecycle_states) as unknown[])
    : []
  )
    .map((entry, index) => normalizeLifecycleState(entry, index))
    .filter((entry): entry is GovernanceLifecycleState => entry !== null);
  const scoringModels = (Array.isArray(frameworkRecord.scoringModels || frameworkRecord.scoring_models)
    ? ((frameworkRecord.scoringModels || frameworkRecord.scoring_models) as unknown[])
    : []
  )
    .map((entry, index) => normalizeScoringModel(entry, index))
    .filter((entry): entry is GovernanceScoringModel => entry !== null);
  const dashboardPresets = (Array.isArray(frameworkRecord.dashboardPresets || frameworkRecord.dashboard_presets)
    ? ((frameworkRecord.dashboardPresets || frameworkRecord.dashboard_presets) as unknown[])
    : []
  )
    .map((entry, index) => normalizeDashboardPreset(entry, index))
    .filter((entry): entry is GovernanceDashboardPreset => entry !== null);
  const rawSettings = readRecord(frameworkRecord.settings) ?? {};

  return {
    id: slugifyGovernanceValue(readString(frameworkRecord.id) || label, "governance_framework"),
    label,
    icon: readString(frameworkRecord.icon) || "shield",
    tooltip: readString(frameworkRecord.tooltip),
    modules,
    lifecycleStates,
    scoringModels,
    dashboardPresets,
    settings: {
      ...rawSettings,
      reviewCadenceDays: Math.max(1, Math.floor(readNumber(rawSettings.reviewCadenceDays, 30))),
      escalationThreshold: Math.max(0, readNumber(rawSettings.escalationThreshold, 0)),
      evidenceRequired: readBoolean(rawSettings.evidenceRequired)
    }
  };
}

export function parseGovernanceFrameworkDefinition(raw: string): GovernanceFrameworkDefinition | null {
  const jsonPayload = extractFirstJsonObject(raw);
  if (!jsonPayload) return null;
  try {
    return normalizeGovernanceFrameworkDefinition(JSON.parse(jsonPayload) as unknown);
  } catch {
    return null;
  }
}

export function buildGovernanceFrameworkSummary(definition: GovernanceFrameworkDefinition): string {
  const moduleLabels = definition.modules.map((module) => module.label).slice(0, 6);
  const widgetLabels = definition.dashboardPresets.map((preset) => preset.label).slice(0, 4);
  return [
    definition.tooltip || `${definition.label} framework`,
    `Modules: ${moduleLabels.join(", ") || "None"}.`,
    widgetLabels.length > 0 ? `Insights: ${widgetLabels.join(", ")}.` : null
  ]
    .filter((entry): entry is string => Boolean(entry))
    .join(" ");
}

export function buildGovernanceFrameworkGenerationPrompts(options: {
  requestText: string;
  workspaceName?: string | null;
  selectedLabel?: string | null;
}): { systemPrompt: string; userPrompt: string } {
  const supportedFieldTypes: ProcedureFieldType[] = [
    "short_text",
    "long_text",
    "rich_text",
    "message",
    "number",
    "year",
    "month",
    "day",
    "decimal",
    "percentage",
    "currency",
    "date",
    "time",
    "datetime",
    "duration",
    "priority",
    "single_select",
    "multi_select",
    "tags",
    "yes_no",
    "email",
    "phone",
    "identifier",
    "url",
    "user_ref",
    "user_list",
    "attachment",
    "table",
    "node_link",
    "organization_link",
    "relation",
    "relation_list",
    "formula"
  ];

  return {
    systemPrompt: [
      "You design dynamic governance frameworks for ODETool.",
      "Return exactly one JSON object and no markdown.",
      "Everything must stay configuration-driven.",
      "Do not hardcode business logic outside the returned schema.",
      "Use compact icon ids and short tooltip text.",
      "Use the priority field type for ranked scales like likelihood, impact, severity, appetite, residual score bands, or control effectiveness."
    ].join(" "),
    userPrompt: [
      "Create a governance framework definition for this request.",
      "",
      `Workspace: ${options.workspaceName?.trim() || "Current workspace"}`,
      `Selected node: ${options.selectedLabel?.trim() || "Current selection"}`,
      `Request: ${options.requestText.trim()}`,
      "",
      "Available field types:",
      supportedFieldTypes.join(", "),
      "",
      "Available automation roles:",
      Array.from(ALLOWED_AUTOMATION_ROLES).join(", "),
      "",
      "Available dashboard widget types:",
      Array.from(ALLOWED_WIDGET_TYPES).join(", "),
      "",
      "Available aggregations:",
      Array.from(ALLOWED_AGGREGATIONS).join(", "),
      "",
      "Return this JSON shape:",
      "{",
      '  "id": "string",',
      '  "label": "string",',
      '  "icon": "string",',
      '  "tooltip": "string",',
      '  "modules": [',
      "    {",
      '      "id": "string",',
      '      "label": "string",',
      '      "icon": "string",',
      '      "tooltip": "string",',
      '      "itemType": "table | branch",',
      '      "fields": [',
      "        {",
      '          "id": "string",',
      '          "label": "string",',
      '          "icon": "string",',
      '          "tooltip": "string",',
      '          "type": "field type",',
      '          "required": true,',
      '          "placeholder": "optional string",',
      '          "options": ["optional strings"],',
      '          "priorityOptions": [{ "value": "string", "icon": "string", "color": "string", "rank": 1, "score": 1, "tooltip": "string", "reviewDays": 30, "escalate": false }],',
      '          "formulaExpression": "optional string",',
      '          "relationTargetModuleId": "optional module id for relation/relation_list",',
      '          "relationDisplayFieldIds": ["optional field ids from target module"],',
      '          "automationRole": "optional automation role",',
      '          "autoValue": "optional auto value: none | current_user | today | now",',
      '          "settings": { "optional": "config" }',
      "        }",
      "      ],",
      '      "settings": { "optional": "config" }',
      "    }",
      "  ],",
      '  "lifecycleStates": [{ "id": "string", "label": "string", "icon": "string", "color": "string", "rank": 1, "terminal": false }],',
      '  "scoringModels": [{ "id": "string", "label": "string", "method": "manual | formula | matrix_lookup | weighted", "valueFieldIds": ["field ids"], "resultFieldId": "field id", "settings": {} }],',
      '  "dashboardPresets": [{ "id": "string", "label": "string", "icon": "string", "widgetType": "metric | distribution | table | matrix", "sourceModuleId": "module id", "aggregation": "count | sum | avg | min | max", "groupFieldId": "optional field id", "secondaryGroupFieldId": "optional field id", "measureFieldId": "optional field id", "displayFieldIds": ["optional field ids"], "filters": [{ "fieldId": "field id", "operator": "equals | not_equals | contains | gt | gte | lt | lte", "value": "string" }], "settings": {} }],',
      '  "settings": { "reviewCadenceDays": 30, "escalationThreshold": 3, "evidenceRequired": true }',
      "}",
      "",
      "Rules:",
      "- Keep it compact and implementation-ready.",
      "- Use ids that stay stable and machine-friendly.",
      "- Include required settings needed to operate the framework.",
      "- Prefer relation and relation_list fields when modules should stay linked dynamically.",
      "- Prefer formulaExpression for computed values instead of hardcoded result fields.",
      "- Use automationRole and autoValue only when the workflow really needs them.",
      "- Keep governance lifecycle states separate from execution task states.",
      "- Prefer icons plus short labels; do not add explanatory prose outside the JSON."
    ].join("\n")
  };
}
