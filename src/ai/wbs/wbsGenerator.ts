import { z } from "zod";
import { runStructuredAiPromptWithRaw, StructuredAiPromptError } from "@/ai/core/runStructuredPrompt";
import { buildStructurePlanningContext, formatStructurePlanningContext } from "@/ai/planning/planningContext";
import { buildAiOutputLanguageInstruction } from "@/ai/planning/outputLanguage";
import type {
  GenerateChantierWbsOptions,
  GenerateWbsOptions,
  GenerateWbsResult,
  TranslateWbsOptions,
  TranslateWbsResult,
  WBSNode,
  WBSResult,
  WbsPromptPreset
} from "@/ai/wbs/wbsTypes";
import type { LanguageCode } from "@/lib/i18n";

const DEFAULT_MAX_DEPTH = 5;
const DEFAULT_MAX_CHILDREN_PER_NODE = 8;
const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  EN: "English",
  FR: "French",
  DE: "German",
  ES: "Spanish"
};

const WBSNodeSchema: z.ZodType<WBSNode> = z.lazy(
  (): z.ZodType<WBSNode> =>
    z.object({
      title: z.string().trim().min(1).max(140),
      description: z.string().trim().min(1).max(480).optional(),
      objective: z.string().trim().min(1).max(240).optional(),
      expected_deliverables: z.array(z.string().trim().min(1).max(220)).max(12).optional(),
      prerequisites: z.array(z.string().trim().min(1).max(140)).max(20),
      estimated_effort: z.string().trim().min(1).max(32),
      suggested_role: z.string().trim().min(1).max(80),
      value_milestone: z.boolean(),
      source_code: z.string().trim().min(1).max(32).optional(),
      children: z.array(WBSNodeSchema).max(20)
    })
);

const WBSResultSchema: z.ZodType<WBSResult> = z.object({
  goal: z.string().trim().min(1).max(280),
  value_summary: z.string().trim().min(1).max(4000),
  nodes: z.array(WBSNodeSchema).min(1).max(20)
});

function effortToNumeric(effort: string): number {
  const normalized = effort.trim().toUpperCase();
  if (normalized === "XS") return 1;
  if (normalized === "S") return 2;
  if (normalized === "M") return 4;
  if (normalized === "L") return 8;
  if (normalized === "XL") return 13;
  const numeric = Number(normalized);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }
  return 4;
}

export function getWbsEstimatedEffortPoints(node: WBSNode): number {
  return effortToNumeric(node.estimated_effort);
}

function clampWbsNodes(nodes: WBSNode[], depth: number, maxDepth: number, maxChildrenPerNode: number): WBSNode[] {
  if (depth > maxDepth) return [];
  return nodes.slice(0, maxChildrenPerNode).map((node) => ({
    title: node.title,
    description: node.description?.trim() || undefined,
    objective: node.objective?.trim() || undefined,
    expected_deliverables: node.expected_deliverables?.slice(0, 12).map((item) => item.trim()).filter(Boolean),
    prerequisites: node.prerequisites.slice(0, 20),
    estimated_effort: node.estimated_effort,
    suggested_role: node.suggested_role,
    value_milestone: node.value_milestone,
    source_code: node.source_code,
    children:
      depth >= maxDepth
        ? []
        : clampWbsNodes(node.children, depth + 1, maxDepth, maxChildrenPerNode)
  }));
}

function normalizeDependencies(result: WBSResult): WBSResult {
  const normalizedTitleMap = new Map<string, string>();
  const indexTitles = (nodes: WBSNode[]) => {
    for (const node of nodes) {
      const normalized = node.title.trim().toLowerCase();
      if (!normalizedTitleMap.has(normalized)) {
        normalizedTitleMap.set(normalized, node.title.trim());
      }
      indexTitles(node.children);
    }
  };
  indexTitles(result.nodes);

  const normalizeNodes = (nodes: WBSNode[]): WBSNode[] =>
    nodes.map((node) => {
      const nodeTitle = node.title.trim();
      const depSet = new Set<string>();
      for (const rawDependency of node.prerequisites) {
        const canonical = normalizedTitleMap.get(rawDependency.trim().toLowerCase());
        if (!canonical) continue;
        if (canonical === nodeTitle) continue;
        depSet.add(canonical);
      }
      const normalizedDescription = node.description?.trim() || undefined;
      const normalizedObjective = node.objective?.trim() || undefined;
      const normalizedDeliverables = Array.from(
        new Set(
          (node.expected_deliverables ?? [])
            .map((item) => item.trim())
            .filter((item) => item.length > 0)
        )
      ).slice(0, 12);
      return {
        ...node,
        title: nodeTitle,
        description: normalizedDescription,
        objective: normalizedObjective,
        expected_deliverables: normalizedDeliverables.length > 0 ? normalizedDeliverables : undefined,
        prerequisites: Array.from(depSet),
        source_code: node.source_code?.trim() || undefined,
        children: normalizeNodes(node.children)
      };
    });

  return {
    goal: result.goal.trim(),
    value_summary: result.value_summary.trim(),
    nodes: normalizeNodes(result.nodes)
  };
}

function countWbsNodes(nodes: WBSNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countWbsNodes(node.children), 0);
}

function buildFallbackWbs(goal: string): WBSResult {
  const cleanGoal = goal.trim() || "Deliver project";
  return {
    goal: cleanGoal,
    value_summary:
      `Deliver "${cleanGoal}" with clear milestones, predictable execution, and measurable business value.`,
    nodes: [
      {
        title: "Define success criteria",
        prerequisites: [],
        estimated_effort: "S",
        suggested_role: "Product Owner",
        value_milestone: true,
        children: [
          {
            title: "List outcomes and KPI targets",
            prerequisites: [],
            estimated_effort: "S",
            suggested_role: "Product Owner",
            value_milestone: false,
            source_code: undefined,
            children: []
          },
          {
            title: "Confirm scope and constraints",
            prerequisites: ["List outcomes and KPI targets"],
            estimated_effort: "S",
            suggested_role: "Project Manager",
            value_milestone: false,
            source_code: undefined,
            children: []
          }
        ]
      },
      {
        title: "Build and validate implementation",
        prerequisites: ["Define success criteria"],
        estimated_effort: "L",
        suggested_role: "Tech Lead",
        value_milestone: true,
        children: [
          {
            title: "Implement MVP slices",
            prerequisites: ["Confirm scope and constraints"],
            estimated_effort: "L",
            suggested_role: "Engineering",
            value_milestone: false,
            source_code: undefined,
            children: []
          },
          {
            title: "Run QA and fix blockers",
            prerequisites: ["Implement MVP slices"],
            estimated_effort: "M",
            suggested_role: "QA",
            value_milestone: false,
            source_code: undefined,
            children: []
          }
        ]
      },
      {
        title: "Release and adoption",
        prerequisites: ["Run QA and fix blockers"],
        estimated_effort: "M",
        suggested_role: "Operations",
        value_milestone: true,
        children: [
          {
            title: "Publish release notes and rollout",
            prerequisites: ["Run QA and fix blockers"],
            estimated_effort: "S",
            suggested_role: "Release Manager",
            value_milestone: false,
            source_code: undefined,
            children: []
          },
          {
            title: "Track post-release outcomes",
            prerequisites: ["Publish release notes and rollout"],
            estimated_effort: "S",
            suggested_role: "Product Owner",
            value_milestone: false,
            source_code: undefined,
            children: []
          }
        ]
      }
    ]
  };
}

function buildFallbackChantierWbs(goal: string, naLabel: string): WBSResult {
  const cleanGoal = goal.trim() || "New Chantier";
  return {
    goal: cleanGoal,
    value_summary:
      `Deliver the chantier "${cleanGoal}" under ${naLabel} with clear execution packages, validation gates, and operational handover.`,
    nodes: [
      {
        title: "Frame chantier scope and baseline",
        prerequisites: [],
        estimated_effort: "S",
        suggested_role: "Project Manager",
        value_milestone: true,
        children: [
          {
            title: "Confirm objectives and acceptance criteria",
            prerequisites: [],
            estimated_effort: "S",
            suggested_role: "Project Sponsor",
            source_code: undefined,
            value_milestone: false,
            children: []
          },
          {
            title: "Capture current-state constraints and dependencies",
            prerequisites: ["Confirm objectives and acceptance criteria"],
            estimated_effort: "M",
            suggested_role: "Business Analyst",
            source_code: undefined,
            value_milestone: false,
            children: []
          }
        ]
      },
      {
        title: "Plan chantier execution workstreams",
        prerequisites: ["Capture current-state constraints and dependencies"],
        estimated_effort: "M",
        suggested_role: "Project Manager",
        value_milestone: true,
        children: [
          {
            title: "Sequence work packages and owners",
            prerequisites: ["Capture current-state constraints and dependencies"],
            estimated_effort: "S",
            suggested_role: "Project Manager",
            source_code: undefined,
            value_milestone: false,
            children: []
          },
          {
            title: "Prepare controls, risks, and decision gates",
            prerequisites: ["Sequence work packages and owners"],
            estimated_effort: "S",
            suggested_role: "PMO",
            source_code: undefined,
            value_milestone: false,
            children: []
          }
        ]
      },
      {
        title: "Execute prioritized chantier packages",
        prerequisites: ["Sequence work packages and owners"],
        estimated_effort: "L",
        suggested_role: "Operational Lead",
        value_milestone: true,
        children: [
          {
            title: "Deliver implementation tasks",
            prerequisites: ["Prepare controls, risks, and decision gates"],
            estimated_effort: "L",
            suggested_role: "Delivery Team",
            source_code: undefined,
            value_milestone: false,
            children: []
          },
          {
            title: "Resolve blockers and adjust plan",
            prerequisites: ["Deliver implementation tasks"],
            estimated_effort: "M",
            suggested_role: "Project Manager",
            source_code: undefined,
            value_milestone: false,
            children: []
          }
        ]
      },
      {
        title: "Validate results and hand over",
        prerequisites: ["Resolve blockers and adjust plan"],
        estimated_effort: "M",
        suggested_role: "Quality Lead",
        value_milestone: true,
        children: [
          {
            title: "Run acceptance review and evidence capture",
            prerequisites: ["Resolve blockers and adjust plan"],
            estimated_effort: "S",
            suggested_role: "Quality Lead",
            source_code: undefined,
            value_milestone: false,
            children: []
          },
          {
            title: "Publish operating guidance and next actions",
            prerequisites: ["Run acceptance review and evidence capture"],
            estimated_effort: "S",
            suggested_role: "Operations",
            source_code: undefined,
            value_milestone: false,
            children: []
          }
        ]
      }
    ]
  };
}

function buildWbsPrompts(
  goal: string,
  context: string,
  targetLanguage: LanguageCode | undefined,
  preset: WbsPromptPreset = "generic"
): { systemPrompt: string; userPrompt: string } {
  const languageInstruction = targetLanguage ? buildAiOutputLanguageInstruction(targetLanguage) : "";
  if (preset === "chantier") {
    return {
      systemPrompt: [
        "You are an expert ODE chantier planner.",
        "Return only valid JSON with no markdown.",
        "The ODE NA hierarchy already exists and must not be recreated.",
        "Assume the chantier root container will be created separately under the mapped Level 4 NA.",
        "Return only execution work packages and sub-tasks that belong under that chantier.",
        "Avoid generic project boilerplate when the source evidence points to specific operational work.",
        "Use concise titles, realistic effort labels, and practical execution order.",
        languageInstruction
      ].join(" "),
      userPrompt: [
        "Create a chantier breakdown for this goal:",
        goal,
        "",
        "ODE context:",
        context || "(none)",
        "",
        "Required JSON schema:",
        "{",
        '  "goal": "string",',
        '  "value_summary": "string",',
        '  "nodes": [',
        "    {",
        '      "title": "string",',
        '      "description": "string",',
        '      "objective": "string",',
        '      "expected_deliverables": ["string"],',
        '      "prerequisites": ["string"],',
        '      "estimated_effort": "XS|S|M|L|XL or numeric",',
        '      "suggested_role": "string",',
        '      "value_milestone": true,',
        '      "children": []',
        "    }",
        "  ]",
        "}",
        "",
        "Rules:",
        "- The root chantier container already exists; do not recreate the NA or chantier label inside child nodes",
        "- Maximum depth: 5",
        "- Maximum children per node: 8",
        "- Keep dependencies by title references",
        "- Add a concise business description for each node",
        "- Add a short objective for each node",
        "- Add 0 to 6 concrete expected deliverables or outcomes for each node",
        "- Focus on execution packages, controls, validation, and handover",
        "- Ensure at least 3 top-level nodes"
      ].join("\n")
    };
  }

  if (preset === "document_tree") {
    return {
      systemPrompt: [
        "You are an expert document structure analyst and methodology architect.",
        "Return only valid JSON with no markdown.",
        "Build a tree that stays grounded in the source documents and preserves their methodology structure when it is clear.",
        "Prefer source headings, sections, and subsections over invented delivery phases.",
        "Avoid generic project boilerplate unless the source explicitly describes it.",
        "Use concise titles and realistic metadata.",
        "When the evidence clearly describes one main business system, methodology, or operating model, use that as the root title instead of repeating the user's request sentence.",
        languageInstruction
      ].join(" "),
      userPrompt: [
        "Create an AI tree structure for this document goal:",
        goal,
        "",
        "Context:",
        context || "(none)",
        "",
        "Required JSON schema:",
        "{",
        '  "goal": "string",',
        '  "value_summary": "string",',
        '  "nodes": [',
        "    {",
        '      "title": "string",',
        '      "description": "string",',
        '      "objective": "string",',
        '      "expected_deliverables": ["string"],',
        '      "prerequisites": ["string"],',
        '      "estimated_effort": "XS|S|M|L|XL or numeric",',
        '      "suggested_role": "string",',
        '      "value_milestone": true,',
        '      "children": []',
        "    }",
        "  ]",
        "}",
        "",
        "Rules:",
        "- Preserve the source methodology headings when they are clear",
        "- Use dependencies only when the source explicitly implies them",
        "- Maximum depth: 5",
        "- Maximum children per node: 8",
        "- Ensure at least 3 top-level nodes when the source supports it",
        "- Do not invent phases like implementation, rollout, or QA unless they appear in the source",
        "- Add a concise description for each node grounded in the document",
        "- Add a short objective for each node grounded in the document",
        "- Add concrete expected deliverables or outcomes for each node when the source supports them"
      ].join("\n")
    };
  }

  return {
    systemPrompt: [
      "You are an expert Work Breakdown Structure architect.",
      "Return only valid JSON with no markdown.",
      "Focus on value milestones, dependencies, and practical execution order.",
      "Use concise titles and realistic effort labels.",
      languageInstruction
    ].join(" "),
    userPrompt: [
      "Create an AI Work Breakdown Structure for this goal:",
      goal,
      "",
      "Context:",
      context || "(none)",
      "",
      "Required JSON schema:",
      "{",
      '  "goal": "string",',
      '  "value_summary": "string",',
      '  "nodes": [',
      "    {",
      '      "title": "string",',
      '      "description": "string",',
      '      "objective": "string",',
      '      "expected_deliverables": ["string"],',
      '      "prerequisites": ["string"],',
      '      "estimated_effort": "XS|S|M|L|XL or numeric",',
      '      "suggested_role": "string",',
      '      "value_milestone": true,',
      '      "children": []',
      "    }",
      "  ]",
      "}",
      "",
      "Rules:",
      "- Maximum depth: 5",
      "- Maximum children per node: 8",
      "- Keep dependencies by title references",
      "- Add a concise description for each node",
      "- Add a short objective for each node",
      "- Add 0 to 6 expected deliverables or outcomes for each node",
      "- Ensure at least 3 top-level nodes"
    ].join("\n")
  };
}

function mapStructuredPromptErrorToWbsWarning(
  error: unknown
): GenerateWbsResult["warning"] | TranslateWbsResult["warning"] {
  if (error instanceof StructuredAiPromptError) {
    if (error.code === "ai_request_failed") return "ai_request_failed";
    if (error.code === "json_not_found") return "json_not_found";
    if (error.code === "json_invalid") return "json_invalid";
    if (error.code === "schema_invalid") return "schema_invalid";
    if (error.code === "shape_changed") return "shape_changed";
  }
  return "schema_invalid";
}

export async function generateAiWorkBreakdown(options: GenerateWbsOptions): Promise<GenerateWbsResult> {
  const goal = options.goal.trim();
  if (!goal) {
    throw new Error("WBS goal cannot be empty.");
  }

  const maxDepth = Math.max(2, Math.min(8, options.maxDepth ?? DEFAULT_MAX_DEPTH));
  const maxChildrenPerNode = Math.max(2, Math.min(12, options.maxChildrenPerNode ?? DEFAULT_MAX_CHILDREN_PER_NODE));
  const onProgress = options.onProgress;
  const fallback = options.fallbackResult ?? buildFallbackWbs(goal);
  const apiKey = options.apiKey?.trim() ?? "";
  const aiEngine = options.aiEngine ?? (apiKey ? "cloud" : "local");

  onProgress?.("understand_goal");
  if (aiEngine !== "local" && !apiKey) {
    onProgress?.("fallback");
    return {
      result: fallback,
      source: "fallback",
      raw: "",
      warning: "missing_api_key"
    };
  }

  onProgress?.("build_prompt");
  const planningContext = buildStructurePlanningContext({
    goal,
    context: options.context,
    targetLanguage: options.targetLanguage,
    promptPreset: options.promptPreset ?? "generic",
    maxDepth,
    maxChildrenPerNode
  });
  const { systemPrompt, userPrompt } = buildWbsPrompts(
    planningContext.goal,
    formatStructurePlanningContext(planningContext),
    planningContext.targetLanguage,
    (planningContext.promptPreset as WbsPromptPreset | null) ?? "generic"
  );

  onProgress?.("request_ai");
  try {
    const response = await runStructuredAiPromptWithRaw<WBSResult>({
      apiKey,
      intent: "planning_structure",
      systemPrompt,
      userPrompt,
      aiEngine,
      invalidJsonMessage: "AI returned an invalid WBS payload.",
      malformedJsonMessage: "AI returned malformed WBS JSON.",
      parse: (parsed) => {
        onProgress?.("validate_json");
        const schemaParsed = WBSResultSchema.safeParse(parsed);
        if (!schemaParsed.success) {
          throw new StructuredAiPromptError("schema_invalid", "AI returned WBS JSON that does not match the schema.");
        }

        onProgress?.("normalize_tree");
        const clamped: WBSResult = {
          goal: schemaParsed.data.goal,
          value_summary: schemaParsed.data.value_summary,
          nodes: clampWbsNodes(schemaParsed.data.nodes, 1, maxDepth, maxChildrenPerNode)
        };
        return normalizeDependencies(clamped);
      }
    });

    return {
      result: response.result,
      source: "llm",
      raw: response.raw
    };
  } catch (error) {
    onProgress?.("fallback");
    return {
      result: fallback,
      source: "fallback",
      raw: error instanceof StructuredAiPromptError ? error.raw : "",
      warning: mapStructuredPromptErrorToWbsWarning(error)
    };
  }
}

export async function generateChantierWBS(options: GenerateChantierWbsOptions): Promise<GenerateWbsResult> {
  const odeContext = [
    `Target NA: ${options.naCode} ${options.naLabel}`,
    options.naPathLabel ? `NA path: ${options.naPathLabel}` : "",
    options.sourceName ? `Source document: ${options.sourceName}` : "",
    "Create a Level 5 chantier under this NA.",
    "Do not recreate the ODE hierarchy; generate only the work packages and sub-tasks that belong under the chantier.",
    options.context?.trim() ?? ""
  ]
    .filter((line) => line.trim().length > 0)
    .join("\n");

  return generateAiWorkBreakdown({
    goal: options.goal,
    context: odeContext,
    targetLanguage: options.targetLanguage,
    apiKey: options.apiKey,
    aiEngine: options.aiEngine,
    maxDepth: options.maxDepth,
    maxChildrenPerNode: options.maxChildrenPerNode,
    promptPreset: "chantier",
    fallbackResult: buildFallbackChantierWbs(options.goal, options.naLabel),
    onProgress: options.onProgress
  });
}

export async function translateWbsResult(options: TranslateWbsOptions): Promise<TranslateWbsResult> {
  const apiKey = options.apiKey?.trim() ?? "";
  const aiEngine = options.aiEngine ?? (apiKey ? "cloud" : "local");
  if (aiEngine !== "local" && !apiKey) {
    return {
      result: options.result,
      source: "original",
      raw: "",
      warning: "missing_api_key",
      targetLanguage: options.targetLanguage
    };
  }

  const targetLanguageLabel = LANGUAGE_LABELS[options.targetLanguage];
  const sourceLanguageLabel = options.sourceLanguage ? LANGUAGE_LABELS[options.sourceLanguage] : null;
  const systemPrompt = [
    "You are an expert project structure translator.",
    "Return only valid JSON with no markdown.",
    "Preserve the hierarchy, field names, booleans, effort values, and source_code values exactly.",
    "Translate goal, value_summary, title, description, objective, expected_deliverables, prerequisites, and suggested_role only.",
    "If a prerequisite points to a node title, translate it so it exactly matches the translated node title.",
    "Do not add, remove, merge, or split nodes."
  ].join(" ");
  const userPrompt = [
    `Translate this WBS JSON into ${targetLanguageLabel}.`,
    sourceLanguageLabel ? `Source language: ${sourceLanguageLabel}.` : "",
    "",
    "JSON:",
    JSON.stringify(options.result, null, 2)
  ]
    .filter((line) => line.trim().length > 0)
    .join("\n");

  try {
    const response = await runStructuredAiPromptWithRaw<WBSResult>({
      apiKey,
      intent: "translate_structure",
      systemPrompt,
      userPrompt,
      aiEngine,
      invalidJsonMessage: "AI returned an invalid translated WBS payload.",
      malformedJsonMessage: "AI returned malformed translated WBS JSON.",
      parse: (parsed) => {
        const schemaParsed = WBSResultSchema.safeParse(parsed);
        if (!schemaParsed.success) {
          throw new StructuredAiPromptError(
            "schema_invalid",
            "AI returned translated WBS JSON that does not match the schema."
          );
        }

        if (countWbsNodes(schemaParsed.data.nodes) !== countWbsNodes(options.result.nodes)) {
          throw new StructuredAiPromptError("shape_changed", "AI changed the WBS shape during translation.");
        }

        return normalizeDependencies(schemaParsed.data);
      }
    });

    return {
      result: response.result,
      source: "llm",
      raw: response.raw,
      targetLanguage: options.targetLanguage
    };
  } catch (error) {
    return {
      result: options.result,
      source: "original",
      raw: error instanceof StructuredAiPromptError ? error.raw : "",
      warning: mapStructuredPromptErrorToWbsWarning(error),
      targetLanguage: options.targetLanguage
    };
  }
}
