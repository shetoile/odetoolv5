import { ROOT_PARENT_ID, type AppNode, type ScheduleStatus } from "@/lib/types";
import type { NodeQuickAppKind } from "@/lib/nodeQuickApps";
import { isHiddenExecutionTaskNode } from "@/features/workspace/execution";

export type ProcedureInsightDomain = "business" | "operations" | "ux" | "ai";
export type ProcedureConnectionType = "receives_from" | "hands_off_to" | "decision_from" | "escalates_to";

export interface ProcedureConnection {
  type: ProcedureConnectionType;
  nodeId: string;
  nodeName?: string | null;
}

export const PROCEDURE_APP_LINK_PREFIX = "ode://app/";

export interface ProcedureAppLinkPayload {
  appId?: string | null;
  appName?: string | null;
  kind: NodeQuickAppKind;
  target: string;
  sourceNodeId?: string | null;
  sourceNodeName?: string | null;
  workspaceName?: string | null;
}

export type ProcedureInlineToken =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "external_link"; label: string; href: string }
  | { type: "node_link"; label: string; nodeId: string }
  | {
      type: "app_link";
      label: string;
      appId: string | null;
      appName: string | null;
      kind: NodeQuickAppKind;
      target: string;
      sourceNodeId: string | null;
      sourceNodeName: string | null;
      workspaceName: string | null;
    };

export type ProcedureBlock =
  | { type: "heading"; level: 1 | 2 | 3 | 4; text: string }
  | { type: "paragraph"; lines: string[] }
  | { type: "bullets"; items: string[] }
  | { type: "numbers"; items: string[] }
  | { type: "quote"; lines: string[] }
  | { type: "code"; code: string; language: string }
  | { type: "divider" }
  | { type: "insight"; domain: ProcedureInsightDomain; lines: string[] };

export interface ProcedureSectionData {
  node: AppNode;
  depth: number;
  headingNumber: string;
  body: string;
  references: AppNode[];
  children: ProcedureSectionData[];
}

export interface ProcedureStatusSummary {
  sectionCount: number;
  documentedSectionCount: number;
  referenceCount: number;
  connectionCount: number;
  linkedNodeCount: number;
  externalLinkCount: number;
  scheduledCount: number;
  scheduleCounts: Record<ScheduleStatus, number>;
}

export function isReferenceNode(node: AppNode): boolean {
  return node.type === "file";
}

export function getNodeBody(node: AppNode | null): string {
  if (!node) return "";
  if (typeof node.content === "string") return node.content;
  if (typeof node.description === "string") return node.description;
  return "";
}

export function decodeNodeLinkId(rawValue: string): string {
  const encodedId = rawValue.replace(/^ode:\/\/node\//, "").trim();
  if (encodedId.length === 0) return "";
  try {
    return decodeURIComponent(encodedId);
  } catch {
    return encodedId;
  }
}

export function encodeProcedureAppLinkPayload(payload: ProcedureAppLinkPayload): string {
  const normalizedPayload: ProcedureAppLinkPayload = {
    appId: typeof payload.appId === "string" ? payload.appId.trim() || null : null,
    appName: typeof payload.appName === "string" ? payload.appName.trim() || null : null,
    kind: payload.kind === "local_path" ? "local_path" : "url",
    target: typeof payload.target === "string" ? payload.target.trim() : "",
    sourceNodeId: typeof payload.sourceNodeId === "string" ? payload.sourceNodeId.trim() || null : null,
    sourceNodeName: typeof payload.sourceNodeName === "string" ? payload.sourceNodeName.trim() || null : null,
    workspaceName: typeof payload.workspaceName === "string" ? payload.workspaceName.trim() || null : null
  };
  return `${PROCEDURE_APP_LINK_PREFIX}${encodeURIComponent(JSON.stringify(normalizedPayload))}`;
}

export function decodeProcedureAppLinkPayload(rawValue: string): ProcedureAppLinkPayload | null {
  const encodedPayload = rawValue.replace(/^ode:\/\/app\//, "").trim();
  if (!encodedPayload) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(encodedPayload)) as Partial<ProcedureAppLinkPayload>;
    const target = typeof parsed.target === "string" ? parsed.target.trim() : "";
    if (!target) return null;
    return {
      appId: typeof parsed.appId === "string" ? parsed.appId.trim() || null : null,
      appName: typeof parsed.appName === "string" ? parsed.appName.trim() || null : null,
      kind: parsed.kind === "local_path" ? "local_path" : "url",
      target,
      sourceNodeId: typeof parsed.sourceNodeId === "string" ? parsed.sourceNodeId.trim() || null : null,
      sourceNodeName: typeof parsed.sourceNodeName === "string" ? parsed.sourceNodeName.trim() || null : null,
      workspaceName: typeof parsed.workspaceName === "string" ? parsed.workspaceName.trim() || null : null
    };
  } catch {
    return null;
  }
}

export function getProcedureInsightTemplate(domain: ProcedureInsightDomain): string {
  if (domain === "business") {
    return [
      "[insight:business]",
      "Decision owner:",
      "Expected business outcome:",
      "KPI / target:",
      "Commercial / compliance risk:"
    ].join("\n");
  }
  if (domain === "operations") {
    return [
      "[insight:operations]",
      "Trigger and cadence:",
      "Inputs and outputs:",
      "SLA / cycle time:",
      "Escalation path:"
    ].join("\n");
  }
  if (domain === "ux") {
    return [
      "[insight:ux]",
      "Primary user and intent:",
      "Critical interaction / friction:",
      "Feedback and confirmation:",
      "Accessibility / empty-state check:"
    ].join("\n");
  }
  return [
    "[insight:ai]",
    "Source of truth:",
    "Human approval gate:",
    "Telemetry / evaluation:",
    "Fallback when confidence drops:"
  ].join("\n");
}

export function getProcedureInsightDomainLabel(domain: ProcedureInsightDomain): string {
  if (domain === "business") return "Business Management";
  if (domain === "operations") return "Operations Management";
  if (domain === "ux") return "UX / UI";
  return "AI-Driven Architecture";
}

export function getProcedureConnectionLabel(type: ProcedureConnectionType): string {
  if (type === "receives_from") return "Receives from";
  if (type === "hands_off_to") return "Hands off to";
  if (type === "decision_from") return "Decision from";
  return "Escalates to";
}

function extractQuotedProcedureLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const quotePairs: Array<[string, string]> = [
    ["“", "”"],
    ["\"", "\""],
    ["«", "»"]
  ];
  for (const [open, close] of quotePairs) {
    if (trimmed.startsWith(open) && trimmed.endsWith(close) && trimmed.length > open.length + close.length) {
      return trimmed.slice(open.length, trimmed.length - close.length).trim();
    }
  }
  return null;
}

export function normalizeProcedureConnections(value: unknown): ProcedureConnection[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const normalized: ProcedureConnection[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const rawType = typeof (item as { type?: unknown }).type === "string" ? (item as { type: string }).type.trim() : "";
    const rawNodeId =
      typeof (item as { nodeId?: unknown }).nodeId === "string" ? (item as { nodeId: string }).nodeId.trim() : "";
    if (!rawNodeId) continue;
    if (
      rawType !== "receives_from" &&
      rawType !== "hands_off_to" &&
      rawType !== "decision_from" &&
      rawType !== "escalates_to"
    ) {
      continue;
    }
    const key = `${rawType}:${rawNodeId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const rawNodeName =
      typeof (item as { nodeName?: unknown }).nodeName === "string"
        ? (item as { nodeName: string }).nodeName.trim()
        : "";
    normalized.push({ type: rawType, nodeId: rawNodeId, nodeName: rawNodeName || null });
  }

  return normalized;
}

export function readProcedureConnections(node: AppNode | null): ProcedureConnection[] {
  return normalizeProcedureConnections(node?.properties?.procedureConnections);
}

export function parseProcedureInlineTokens(text: string): ProcedureInlineToken[] {
  const pattern = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|_([^_]+)_|\*([^*]+)\*)/;
  const match = pattern.exec(text);
  if (!match) return [{ type: "text", value: text }];

  const tokens: ProcedureInlineToken[] = [];
  const [matchedValue] = match;
  const matchIndex = match.index ?? 0;
  const before = text.slice(0, matchIndex);
  if (before) tokens.push({ type: "text", value: before });

  if (match[2] !== undefined && match[3] !== undefined) {
    const label = match[2] || match[3];
    const href = match[3].trim();
    if (href.startsWith("ode://node/")) {
      tokens.push({
        type: "node_link",
        label,
        nodeId: decodeNodeLinkId(href)
      });
    } else if (href.startsWith(PROCEDURE_APP_LINK_PREFIX)) {
      const payload = decodeProcedureAppLinkPayload(href);
      if (payload) {
        tokens.push({
          type: "app_link",
          label: label || payload.appName || "App",
          appId: payload.appId ?? null,
          appName: payload.appName ?? null,
          kind: payload.kind,
          target: payload.target,
          sourceNodeId: payload.sourceNodeId ?? null,
          sourceNodeName: payload.sourceNodeName ?? null,
          workspaceName: payload.workspaceName ?? null
        });
      } else {
        tokens.push({ type: "external_link", label, href });
      }
    } else {
      tokens.push({ type: "external_link", label, href });
    }
  } else if (match[4] !== undefined) {
    tokens.push({ type: "bold", value: match[4] });
  } else {
    tokens.push({ type: "italic", value: match[5] ?? match[6] ?? "" });
  }

  const after = text.slice(matchIndex + matchedValue.length);
  if (after) {
    tokens.push(...parseProcedureInlineTokens(after));
  }
  return tokens;
}

function collectProcedureBodyLinkedNodeIds(text: string): string[] {
  const ids = new Set<string>();
  for (const block of parseProcedureBlocks(text)) {
    const lineCandidates =
      block.type === "heading"
        ? [block.text]
        : block.type === "paragraph" || block.type === "quote" || block.type === "insight"
        ? block.lines
        : block.type === "bullets" || block.type === "numbers"
          ? block.items
          : [];
    for (const line of lineCandidates) {
      for (const token of parseProcedureInlineTokens(line)) {
        if (token.type === "node_link" && token.nodeId) {
          ids.add(token.nodeId);
        }
      }
    }
  }
  return Array.from(ids);
}

function collectProcedureBodyExternalLinkKeys(text: string): string[] {
  const keys = new Set<string>();
  for (const block of parseProcedureBlocks(text)) {
    const lineCandidates =
      block.type === "heading"
        ? [block.text]
        : block.type === "paragraph" || block.type === "quote" || block.type === "insight"
        ? block.lines
        : block.type === "bullets" || block.type === "numbers"
          ? block.items
          : [];
    for (const line of lineCandidates) {
      for (const token of parseProcedureInlineTokens(line)) {
        if (token.type === "external_link") {
          keys.add(`${token.label}::${token.href}`);
        }
      }
    }
  }
  return Array.from(keys);
}

function readProcedureScheduleStatus(node: AppNode): ScheduleStatus | null {
  const raw = node.properties?.timelineSchedule;
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const startDate = typeof obj.startDate === "string" ? obj.startDate.trim() : "";
  const endDate = typeof obj.endDate === "string" ? obj.endDate.trim() : "";
  if (!startDate || !endDate) return null;
  const statusRaw = typeof obj.status === "string" ? obj.status.trim() : "";
  if (statusRaw === "active" || statusRaw === "blocked" || statusRaw === "done") return statusRaw;
  return "planned";
}

export function inlineTokensToPlainText(text: string): string {
  return parseProcedureInlineTokens(text)
    .map((token) => {
      if (token.type === "text") return token.value;
      if (token.type === "bold") return token.value;
      if (token.type === "italic") return token.value;
      if (token.type === "external_link") return `${token.label} (${token.href})`;
      if (token.type === "app_link") return token.label || token.appName || "App";
      return `${token.label} [${token.nodeId}]`;
    })
    .join("");
}

export function buildProcedureStatusSummary(section: ProcedureSectionData): ProcedureStatusSummary {
  const linkedNodeIds = new Set<string>();
  const externalLinkKeys = new Set<string>();
  const summary: ProcedureStatusSummary = {
    sectionCount: 0,
    documentedSectionCount: 0,
    referenceCount: 0,
    connectionCount: 0,
    linkedNodeCount: 0,
    externalLinkCount: 0,
    scheduledCount: 0,
    scheduleCounts: {
      planned: 0,
      active: 0,
      blocked: 0,
      done: 0
    }
  };

  const visit = (current: ProcedureSectionData) => {
    summary.sectionCount += 1;
    if (current.body.trim()) {
      summary.documentedSectionCount += 1;
    }
    summary.referenceCount += current.references.length;

    const connections = readProcedureConnections(current.node);
    summary.connectionCount += connections.length;

    for (const nodeId of collectProcedureBodyLinkedNodeIds(current.body)) {
      linkedNodeIds.add(nodeId);
    }
    for (const key of collectProcedureBodyExternalLinkKeys(current.body)) {
      externalLinkKeys.add(key);
    }

    const scheduleStatus = readProcedureScheduleStatus(current.node);
    if (scheduleStatus) {
      summary.scheduledCount += 1;
      summary.scheduleCounts[scheduleStatus] += 1;
    }

    for (const child of current.children) {
      visit(child);
    }
  };

  visit(section);
  summary.linkedNodeCount = linkedNodeIds.size;
  summary.externalLinkCount = externalLinkKeys.size;
  return summary;
}

export function parseProcedureBlocks(text: string): ProcedureBlock[] {
  const blocks: ProcedureBlock[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const paragraphLines: string[] = [];
  let index = 0;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    blocks.push({ type: "paragraph", lines: [...paragraphLines] });
    paragraphLines.length = 0;
  };

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      flushParagraph();
      const language = trimmed.slice(3).trim();
      index += 1;
      const codeLines: string[] = [];
      while (index < lines.length && !(lines[index] ?? "").trim().startsWith("```")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({
        type: "code",
        code: codeLines.join("\n"),
        language
      });
      continue;
    }

    const insightMatch = /^\[insight:(business|operations|ux|ai)\]\s*$/i.exec(trimmed);
    if (insightMatch) {
      flushParagraph();
      const domain = insightMatch[1].toLowerCase() as ProcedureInsightDomain;
      index += 1;
      const insightLines: string[] = [];
      while (index < lines.length && (lines[index] ?? "").trim()) {
        insightLines.push(lines[index] ?? "");
        index += 1;
      }
      blocks.push({ type: "insight", domain, lines: insightLines });
      continue;
    }

    if (/^[-\u2500]{3,}$/.test(trimmed)) {
      flushParagraph();
      blocks.push({ type: "divider" });
      index += 1;
      continue;
    }

    const headingLevel4Match = /^####\s+(.+)$/.exec(trimmed);
    if (headingLevel4Match) {
      flushParagraph();
      blocks.push({ type: "heading", level: 4, text: headingLevel4Match[1] ?? "" });
      index += 1;
      continue;
    }

    const headingLevel3Match = /^###\s+(.+)$/.exec(trimmed);
    if (headingLevel3Match) {
      flushParagraph();
      blocks.push({ type: "heading", level: 3, text: headingLevel3Match[1] ?? "" });
      index += 1;
      continue;
    }

    const headingLevel2Match = /^##\s+(.+)$/.exec(trimmed);
    if (headingLevel2Match) {
      flushParagraph();
      blocks.push({ type: "heading", level: 2, text: headingLevel2Match[1] ?? "" });
      index += 1;
      continue;
    }

    const headingLevel1Match = /^#\s+(.+)$/.exec(trimmed);
    if (headingLevel1Match) {
      flushParagraph();
      blocks.push({ type: "heading", level: 1, text: headingLevel1Match[1] ?? "" });
      index += 1;
      continue;
    }

    const quoteMatch = /^\s*>\s?(.*)$/.exec(line);
    const quotedLine = extractQuotedProcedureLine(line);
    if (quoteMatch || quotedLine !== null) {
      flushParagraph();
      const quoteLines: string[] = [];
      while (index < lines.length) {
        const currentLine = lines[index] ?? "";
        const currentQuote = /^\s*>\s?(.*)$/.exec(currentLine);
        const currentQuotedLine = extractQuotedProcedureLine(currentLine);
        if (!currentQuote && currentQuotedLine === null) break;
        quoteLines.push(currentQuote ? currentQuote[1] ?? "" : currentQuotedLine ?? "");
        index += 1;
      }
      blocks.push({ type: "quote", lines: quoteLines });
      continue;
    }

    const bulletMatch = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bulletMatch) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length) {
        const currentLine = lines[index] ?? "";
        const currentBullet = /^\s*[-*]\s+(.*)$/.exec(currentLine);
        if (!currentBullet) break;
        items.push(currentBullet[1] ?? "");
        index += 1;
      }
      blocks.push({ type: "bullets", items });
      continue;
    }

    const numberMatch = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (numberMatch) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length) {
        const currentLine = lines[index] ?? "";
        const currentNumber = /^\s*\d+\.\s+(.*)$/.exec(currentLine);
        if (!currentNumber) break;
        items.push(currentNumber[1] ?? "");
        index += 1;
      }
      blocks.push({ type: "numbers", items });
      continue;
    }

    paragraphLines.push(line);
    index += 1;
  }

  flushParagraph();
  return blocks;
}

export function buildProcedureCopyText(
  node: AppNode,
  rootNodeId: string,
  byParent: Map<string, AppNode[]>,
  scopedNumbering: Map<string, string>,
  depth = 0
): string {
  const headingNumber = node.id === rootNodeId ? "" : scopedNumbering.get(node.id) ?? "";
  const headingPrefix = `${"#".repeat(Math.min(depth + 1, 6))} `;
  const heading = `${headingPrefix}${headingNumber ? `${headingNumber} ` : ""}${node.name}`.trimEnd();
  const lines = [heading];
  const body = getNodeBody(node).trim();
  if (body) lines.push("", body);

  const children = (byParent.get(node.id) ?? []).filter((child) => !isHiddenExecutionTaskNode(child));
  const references = children.filter(isReferenceNode);
  if (references.length > 0) {
    lines.push("", `Files: ${references.map((reference) => reference.name).join(", ")}`);
  }

  const structuralChildren = children.filter((child) => !isReferenceNode(child));
  for (const child of structuralChildren) {
    lines.push("", buildProcedureCopyText(child, rootNodeId, byParent, scopedNumbering, depth + 1));
  }

  return lines.join("\n");
}

export function buildProcedureSectionTree(
  node: AppNode,
  rootNodeId: string,
  byParent: Map<string, AppNode[]>,
  scopedNumbering: Map<string, string>,
  depth = 0
): ProcedureSectionData {
  const children = (byParent.get(node.id) ?? []).filter((child) => !isHiddenExecutionTaskNode(child));
  const references = children.filter(isReferenceNode);
  const structuralChildren = children.filter((child) => !isReferenceNode(child));

  return {
    node,
    depth,
    headingNumber: node.id === rootNodeId ? "" : scopedNumbering.get(node.id) ?? "",
    body: getNodeBody(node),
    references,
    children: structuralChildren.map((child) =>
      buildProcedureSectionTree(child, rootNodeId, byParent, scopedNumbering, depth + 1)
    )
  };
}

export function findProcedureWorkspaceRootId(
  nodeId: string,
  nodeById: Map<string, AppNode>,
  workspaceRootIdSet: Set<string>
): string | null {
  let current = nodeById.get(nodeId) ?? null;
  const visited = new Set<string>();
  while (current) {
    if (workspaceRootIdSet.has(current.id)) return current.id;
    if (visited.has(current.id)) break;
    visited.add(current.id);
    if (!current.parentId || current.parentId === ROOT_PARENT_ID) break;
    current = nodeById.get(current.parentId) ?? null;
  }
  return null;
}

