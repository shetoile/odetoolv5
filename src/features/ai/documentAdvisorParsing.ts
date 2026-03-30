import { type WBSNode, type WBSResult } from "@/lib/aiService";

export type DocumentAdvisorOutlineRow = {
  code: string;
  title: string;
  level: number;
  lineIndex: number;
  description?: string;
  objective?: string;
  expectedDeliverables?: string[];
};

export type DocumentAdvisorTreeSeed = {
  result: WBSResult;
  sourceMode: "numbered_outline" | "document_structure";
  warning: "document_outline_extracted" | "document_structure_extracted";
};

export type DocumentAdvisorSection = {
  id: string;
  title: string;
  goal: string;
  level: number;
  startLineIndex: number;
  endLineIndex: number;
  lineCount: number;
  previewLines: string[];
};

const DOCUMENT_ATTRIBUTION_LINE_PATTERN = /^[\[(]?\s*sources?\s*:\s*.+?(?:[\])])?[.]?$/iu;
const DOCUMENT_SUMMARY_HEADING_PATTERN = /^(sommaire|summary|contents|table of contents)$/iu;
const DOCUMENT_STRUCTURE_INLINE_MARKER_PATTERN =
  /^([\u25B7\u25BA\u25B8\u25CB\u25E6\u2022\u25AA\u25CF\u2023])\s*(.+)$/u;
const DOCUMENT_STRUCTURE_FALLBACK_MARKER_PATTERN = /^\?\s*(.+)$/u;
const DOCUMENT_STRUCTURE_MARKER_LEVEL = new Map<string, number>([
  ["\u25B7", 1],
  ["\u25BA", 1],
  ["\u25B8", 1],
  ["\u25CB", 2],
  ["\u25E6", 2],
  ["\u2022", 2],
  ["\u25AA", 3],
  ["\u25CF", 3],
  ["\u2023", 3]
]);
const OUTLINE_CELL_SPLIT_PATTERN = /\s+\|\s+/u;
const OUTLINE_CODE_TITLE_PATTERN = /^(\d+(?:[.-]\d+)*)(?:[.)])?\s+(.+)$/;

function looksLikeFragmentedGlyphLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter((token) => token.length > 0);
  if (tokens.length < 6) return false;

  const shortWordCount = tokens.filter((token) => /^[\p{L}\p{N}]{1,2}$/u.test(token)).length;
  return shortWordCount >= 6 && shortWordCount / tokens.length >= 0.7;
}

function getCompactTokenClass(token: string): "alpha" | "digit" | "mixed" {
  if (/^[\p{L}]+$/u.test(token)) return "alpha";
  if (/^[\p{N}]+$/u.test(token)) return "digit";
  return "mixed";
}

function repairFragmentedGlyphLine(line: string): string {
  const trimmed = line.trim();
  if (!looksLikeFragmentedGlyphLine(trimmed)) return trimmed;

  const tokens = trimmed.split(/\s+/).filter((token) => token.length > 0);
  const rebuilt: string[] = [];
  let compact = "";

  const flushCompact = () => {
    if (!compact) return;
    rebuilt.push(compact);
    compact = "";
  };

  for (const token of tokens) {
    if (/^[\p{L}\p{N}]{1,2}$/u.test(token)) {
      if (compact) {
        const currentClass = getCompactTokenClass(compact);
        const nextClass = getCompactTokenClass(token);
        if (
          currentClass !== "mixed" &&
          nextClass !== "mixed" &&
          currentClass !== nextClass
        ) {
          flushCompact();
        }
      }
      compact += token;
      continue;
    }
    flushCompact();
    rebuilt.push(token);
  }
  flushCompact();

  return rebuilt
    .join(" ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s*([—–-])\s*/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDocumentTextForAi(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .split("\n")
    .map((line) => repairFragmentedGlyphLine(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isDocumentAttributionNoise(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 120) return false;
  return DOCUMENT_ATTRIBUTION_LINE_PATTERN.test(trimmed);
}

function getOutlineLevelFromCode(code: string): number {
  const normalized = code.trim();
  if (!normalized) return 1;
  if (normalized.includes(".") || normalized.includes("-")) {
    return Math.max(1, normalized.split(/[.-]/).filter((part) => part.trim().length > 0).length);
  }
  const digitsOnly = normalized.replace(/\D/g, "");
  return Math.max(1, Math.min(6, digitsOnly.length || 1));
}

function splitOutlineRowCells(line: string): string[] {
  return line
    .split(OUTLINE_CELL_SPLIT_PATTERN)
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0);
}

function parseOutlineCodeSegments(code: string): number[] {
  return code
    .split(/[.-]/)
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((value) => Number.isFinite(value) && value >= 0);
}

function parseOutlineCodeTitleCell(value: string): { code: string; title: string; } | null {
  const match = value.match(OUTLINE_CODE_TITLE_PATTERN);
  if (!match) return null;
  const [, rawCode, rawTitle] = match;
  const title = rawTitle.trim();
  if (!title) return null;
  return {
    code: rawCode.trim(),
    title
  };
}

function normalizeNodeDeliverables(value: string | undefined): string[] {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(/[;\n]/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    )
  ).slice(0, 12);
}

function extractObjectiveFromDescription(description: string | undefined): string | undefined {
  if (!description) return undefined;
  const candidate = description
    .split(/[;•]/)
    .map((chunk) => chunk.trim())
    .find((chunk) => chunk.length >= 18);
  if (!candidate) return undefined;
  return candidate.replace(/[.]+$/u, "").trim();
}

export function buildOutlineWbsNode(
  title: string,
  level: number,
  sourceCode: string | undefined,
  description: string | undefined,
  objective: string | undefined,
  expectedDeliverables: string[] | undefined,
  defaultRoleLabel: string
): WBSNode {
  return {
    title,
    description: description?.trim() || undefined,
    objective: objective?.trim() || undefined,
    expected_deliverables:
      expectedDeliverables?.map((item) => item.trim()).filter((item) => item.length > 0).slice(0, 12) ?? [],
    prerequisites: [],
    estimated_effort: level <= 2 ? "M" : "S",
    suggested_role: defaultRoleLabel,
    value_milestone: level <= 2,
    source_code: sourceCode,
    children: []
  };
}

function normalizeDocumentStructureTitle(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+[\u2013\u2014-]\s+/g, " - ")
    .trim();
}

function normalizeDocumentStructureSearchText(value: string): string {
  return normalizeDocumentStructureTitle(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9:? -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getDocumentStructureLookupKeys(title: string): string[] {
  const normalized = normalizeDocumentStructureSearchText(title);
  if (!normalized) return [];
  const variants = new Set<string>([normalized]);
  for (const prefix of ["les ", "des ", "vos ", "votre ", "le ", "la ", "l "]) {
    if (normalized.startsWith(prefix) && normalized.length > prefix.length + 2) {
      variants.add(normalized.slice(prefix.length).trim());
    }
  }
  return [...variants].filter((value) => value.length > 0);
}

function readDocumentStructureTitle(
  lines: string[],
  startIndex: number,
  initialTitle: string
): { title: string; endLineIndex: number; } {
  const parts = [initialTitle.trim()];
  let cursor = startIndex;

  while (cursor + 1 < lines.length && parts.length < 4) {
    const candidate = lines[cursor + 1]?.trim() ?? "";
    if (!candidate) break;
    if (DOCUMENT_SUMMARY_HEADING_PATTERN.test(candidate)) break;
    if (DOCUMENT_STRUCTURE_MARKER_LEVEL.has(candidate)) break;
    if (/^[\u25B7\u25BA\u25B8\u25CB\u25E6\u2022\u25AA\u25CF\u2023]/u.test(candidate)) break;
    if (/^\d+$/.test(candidate)) break;
    if (candidate.length > 28 && /[.!?]$/.test(candidate)) break;
    if (
      !/^[\u2013\u2014&/+]+$/u.test(candidate) &&
      candidate.length > 22 &&
      parts[parts.length - 1] !== "-" &&
      parts[parts.length - 1] !== "&"
    ) {
      break;
    }
    parts.push(candidate);
    cursor += 1;
  }

  return {
    title: normalizeDocumentStructureTitle(parts.join(" ")),
    endLineIndex: cursor
  };
}

function extractDocumentStructureRows(
  lines: string[]
): Array<{ marker: string; title: string; level: number; lineIndex: number; }> {
  const summaryIndex = lines.findIndex((line, index) => index < 140 && DOCUMENT_SUMMARY_HEADING_PATTERN.test(line));
  if (summaryIndex < 0) return [];

  const rows: Array<{ marker: string; title: string; level: number; lineIndex: number; }> = [];
  const maxScanIndex = Math.min(lines.length, summaryIndex + 90);
  let pendingMarker: { marker: string; lineIndex: number; } | null = null;
  let lastEntryIndex = summaryIndex;

  for (let index = summaryIndex + 1; index < maxScanIndex; index += 1) {
    const line = lines[index]?.trim() ?? "";
    if (!line) continue;

    const markerOnly = DOCUMENT_STRUCTURE_MARKER_LEVEL.get(line);
    if (markerOnly) {
      pendingMarker = { marker: line, lineIndex: index };
      continue;
    }

    const markerWithTitle = line.match(DOCUMENT_STRUCTURE_INLINE_MARKER_PATTERN);
    if (markerWithTitle) {
      const marker = markerWithTitle[1];
      const level = DOCUMENT_STRUCTURE_MARKER_LEVEL.get(marker);
      const inlineTitle = markerWithTitle[2]?.trim() ?? "";
      if (level && inlineTitle) {
        const { title, endLineIndex } = readDocumentStructureTitle(lines, index, inlineTitle);
        rows.push({
          marker,
          title,
          level,
          lineIndex: index
        });
        index = endLineIndex;
        lastEntryIndex = endLineIndex;
        pendingMarker = null;
        continue;
      }
    }

    if (pendingMarker) {
      const level = DOCUMENT_STRUCTURE_MARKER_LEVEL.get(pendingMarker.marker);
      if (level) {
        const { title, endLineIndex } = readDocumentStructureTitle(lines, index, line);
        rows.push({
          marker: pendingMarker.marker,
          title,
          level,
          lineIndex: pendingMarker.lineIndex
        });
        index = endLineIndex;
        lastEntryIndex = endLineIndex;
      }
      pendingMarker = null;
      continue;
    }

    if (rows.length >= 3) {
      if (/^\d+$/.test(line)) continue;
      if (line.length > 72 || /[.!?]$/.test(line) || index - lastEntryIndex >= 5) {
        break;
      }
    }
  }

  const topLevelCount = rows.filter((row) => row.level === 1).length;
  if (rows.length >= 4 && topLevelCount >= 2) {
    return rows;
  }

  const fallbackEntries: Array<{ marker: string; title: string; lineIndex: number; }> = [];
  const fallbackMaxScanIndex = Math.min(lines.length, summaryIndex + 90);
  for (let index = summaryIndex + 1; index < fallbackMaxScanIndex; index += 1) {
    const line = lines[index]?.trim() ?? "";
    if (!line) continue;
    const fallbackMatch = line.match(DOCUMENT_STRUCTURE_FALLBACK_MARKER_PATTERN);
    if (fallbackMatch) {
      fallbackEntries.push({
        marker: "?",
        title: normalizeDocumentStructureTitle(fallbackMatch[1] ?? ""),
        lineIndex: index
      });
      continue;
    }
    if (fallbackEntries.length >= 4) {
      if (/^\d+$/.test(line)) continue;
      break;
    }
  }

  if (fallbackEntries.length < 4) {
    return [];
  }

  const summaryEndIndex = fallbackEntries[fallbackEntries.length - 1]?.lineIndex ?? summaryIndex;
  const normalizedLaterLines = lines
    .slice(summaryEndIndex + 1)
    .map((line) => normalizeDocumentStructureSearchText(line))
    .filter((line) => line.length > 0);

  let currentParentSeen = false;
  return fallbackEntries.map((entry) => {
    const lookupKeys = getDocumentStructureLookupKeys(entry.title);
    let prefixedHits = 0;
    for (const line of normalizedLaterLines) {
      for (const key of lookupKeys) {
        if (!key) continue;
        if (line.startsWith(`${key} :`) || line.startsWith(`${key}:`) || line.startsWith(`${key} -`)) {
          prefixedHits += 1;
        }
      }
    }
    const isContainer = prefixedHits >= 2;
    const level = isContainer || !currentParentSeen ? 1 : 2;
    if (level === 1) {
      currentParentSeen = true;
    }
    return {
      marker: entry.marker,
      title: entry.title,
      level,
      lineIndex: entry.lineIndex
    };
  });
}

function looksLikeStructuredHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 4 || trimmed.length > 96) return false;
  if (isDocumentAttributionNoise(trimmed)) return false;
  if (/[.!?;:]$/.test(trimmed)) return false;
  const words = trimmed.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0 || words.length > 10) return false;

  let structuredWords = 0;
  for (const word of words) {
    const cleaned = word.replace(/^[\[\](){}\-\u2013\u2014\d.]+/, "").replace(/[,:;]+$/, "");
    if (!cleaned) continue;
    const first = cleaned.charAt(0);
    if (first.toLocaleUpperCase() === first && first.toLocaleLowerCase() !== first) {
      structuredWords += 1;
    }
  }

  return structuredWords >= Math.max(1, Math.ceil(words.length * 0.45));
}

function stripFileExtension(fileName: string): string {
  const trimmed = fileName.trim();
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot <= 0) return trimmed;
  const baseName = trimmed.slice(0, lastDot).trim();
  return baseName.length > 0 ? baseName : trimmed;
}

export function buildPreviewLines(lines: string[], limit = 4): string[] {
  return lines.slice(0, Math.max(1, limit));
}

export function getDocumentAdvisorLines(rawText: string): string[] {
  return normalizeDocumentTextForAi(rawText)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !isDocumentAttributionNoise(line));
}

export function extractOutlineRows(lines: string[]): DocumentAdvisorOutlineRow[] {
  const seenRows = new Set<string>();
  return lines
    .map((line, lineIndex) => {
      const cells = splitOutlineRowCells(line);
      if (cells.length > 1) {
        const first = parseOutlineCodeTitleCell(cells[0]);
        if (!first) return null;
        const second = cells.length > 1 ? parseOutlineCodeTitleCell(cells[1]) : null;
        const code = first.code;
        const title =
          second && second.code === code && second.title.trim().length > 0 ? second.title.trim() : first.title.trim();
        if (!title) return null;
        const metaStart = second && second.code === code ? 2 : 1;
        const description = cells[metaStart]?.trim() || undefined;
        const expectedDeliverables = normalizeNodeDeliverables(cells[metaStart + 1]);
        return {
          code,
          title,
          level: getOutlineLevelFromCode(code),
          lineIndex,
          description,
          objective: extractObjectiveFromDescription(description),
          expectedDeliverables: expectedDeliverables.length > 0 ? expectedDeliverables : undefined
        };
      }
      const match = line.match(OUTLINE_CODE_TITLE_PATTERN);
      if (!match) return null;
      const [, rawCode, rawTitle] = match;
      const title = rawTitle.trim();
      if (!title) return null;
      return {
        code: rawCode.trim(),
        title,
        level: getOutlineLevelFromCode(rawCode),
        lineIndex
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .filter((row) => {
      const key = `${row.code.toLowerCase()}::${row.title.trim().toLowerCase()}`;
      if (seenRows.has(key)) {
        return false;
      }
      seenRows.add(key);
      return true;
    });
}

function isLikelySparseNumberedOutline(outlineRows: DocumentAdvisorOutlineRow[]): boolean {
  if (outlineRows.length < 6) return false;

  const headingStyleCount = outlineRows.filter((row) => {
    const title = row.title.trim();
    return title.length >= 3 && title.length <= 110 && !/[.!?]$/.test(title);
  }).length;
  if (headingStyleCount / Math.max(1, outlineRows.length) < 0.7) {
    return false;
  }

  const topLevelSequence = Array.from(
    new Set(
      outlineRows
        .filter((row) => row.level === 1)
        .map((row) => parseOutlineCodeSegments(row.code)[0] ?? null)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    )
  );
  if (topLevelSequence.length < 4) return false;

  let increasingSteps = 0;
  for (let index = 1; index < topLevelSequence.length; index += 1) {
    if (topLevelSequence[index] > topLevelSequence[index - 1]) {
      increasingSteps += 1;
    }
  }

  const monotonicRatio =
    topLevelSequence.length > 1 ? increasingSteps / (topLevelSequence.length - 1) : 0;
  return monotonicRatio >= 0.75;
}

export function extractDocumentAdvisorSections(
  lines: string[],
  outlineRows: Array<{ code: string; title: string; level: number; lineIndex: number; }>
): DocumentAdvisorSection[] {
  if (outlineRows.length >= 4) {
    const maxSelectableLevel = outlineRows.length > 24 ? 2 : 3;
    return outlineRows
      .filter((row) => row.level <= maxSelectableLevel)
      .slice(0, 18)
      .map((row, index, filteredRows) => {
        const nextRow = filteredRows
          .slice(index + 1)
          .find((candidate) => candidate.level <= row.level && candidate.lineIndex > row.lineIndex);
        const endLineIndex = nextRow ? nextRow.lineIndex : lines.length;
        const sectionLines = lines.slice(row.lineIndex, endLineIndex);
        return {
          id: `outline:${row.code}`,
          title: `${row.code} ${row.title}`,
          goal: row.title,
          level: row.level,
          startLineIndex: row.lineIndex,
          endLineIndex,
          lineCount: sectionLines.length,
          previewLines: buildPreviewLines(sectionLines, 3)
        };
      })
      .filter((section) => section.lineCount >= 2);
  }

  const headingRows = lines
    .map((line, lineIndex) => (looksLikeStructuredHeading(line) ? { title: line, lineIndex } : null))
    .filter((row): row is { title: string; lineIndex: number; } => row !== null);

  if (headingRows.length < 2) return [];

  return headingRows
    .slice(0, 18)
    .map((row, index) => {
      const nextRow = headingRows[index + 1];
      const endLineIndex = nextRow ? nextRow.lineIndex : lines.length;
      const sectionLines = lines.slice(row.lineIndex, endLineIndex);
      return {
        id: `heading:${index + 1}`,
        title: row.title,
        goal: row.title,
        level: 1,
        startLineIndex: row.lineIndex,
        endLineIndex,
        lineCount: sectionLines.length,
        previewLines: buildPreviewLines(sectionLines, 3)
      };
    })
    .filter((section) => section.lineCount >= 2);
}

export function extractDocumentAdvisorSectionText(rawText: string, section: DocumentAdvisorSection): string {
  const lines = getDocumentAdvisorLines(rawText);
  return lines.slice(section.startLineIndex, section.endLineIndex).join("\n").trim();
}

export function parseNumberedOutlineToWbs(
  goal: string,
  sourceName: string,
  rawText: string,
  defaultRoleLabel: string
): WBSResult | null {
  const lines = getDocumentAdvisorLines(rawText);

  if (lines.length < 6) return null;

  const outlineRows = extractOutlineRows(lines);

  if (outlineRows.length < 6) return null;

  const significantLineCount = lines.filter((line) => line.length <= 220).length;
  const coverage = outlineRows.length / Math.max(1, significantLineCount);
  const maxLevel = outlineRows.reduce((highest, row) => Math.max(highest, row.level), 0);
  const isSparseOutline = isLikelySparseNumberedOutline(outlineRows);
  if ((coverage < 0.45 && !isSparseOutline) || (maxLevel < 2 && !isSparseOutline)) {
    return null;
  }

  const rootNodes: WBSNode[] = [];
  const stack: WBSNode[] = [];

  for (const row of outlineRows) {
    const targetLevel = Math.max(1, Math.min(row.level, stack.length + 1));
    const node = buildOutlineWbsNode(
      row.title,
      targetLevel,
      row.code,
      row.description,
      row.objective,
      row.expectedDeliverables,
      defaultRoleLabel
    );

    while (stack.length >= targetLevel) {
      stack.pop();
    }

    if (targetLevel === 1 || stack.length === 0) {
      rootNodes.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  }

  if (rootNodes.length === 0) return null;

  return {
    goal: goal.trim() || stripFileExtension(sourceName) || "Document Outline",
    value_summary: `Tree extracted from numbered document outline in "${sourceName}".`,
    nodes: rootNodes
  };
}

export function parseDocumentStructureToWbs(
  goal: string,
  sourceName: string,
  rawText: string,
  defaultRoleLabel: string
): WBSResult | null {
  const lines = getDocumentAdvisorLines(rawText);

  if (lines.length < 8) return null;

  const structureRows = extractDocumentStructureRows(lines);
  if (structureRows.length < 4) return null;

  const rootNodes: WBSNode[] = [];
  const stack: WBSNode[] = [];

  for (const row of structureRows) {
    const targetLevel = Math.max(1, Math.min(row.level, stack.length + 1));
    const node = buildOutlineWbsNode(row.title, targetLevel, undefined, undefined, undefined, undefined, defaultRoleLabel);

    while (stack.length >= targetLevel) {
      stack.pop();
    }

    if (targetLevel === 1 || stack.length === 0) {
      rootNodes.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  }

  if (rootNodes.length === 0) return null;

  return {
    goal: goal.trim() || stripFileExtension(sourceName) || "Document Structure",
    value_summary: `Tree extracted from the document structure in "${sourceName}".`,
    nodes: rootNodes
  };
}

export function parseSimpleStructuredEntriesToWbs(
  goal: string,
  sourceName: string,
  rawText: string,
  defaultRoleLabel: string
): WBSResult | null {
  const lines = getDocumentAdvisorLines(rawText);

  if (lines.length < 2 || lines.length > 18) return null;

  const seen = new Set<string>();
  const entries: string[] = [];
  for (const line of lines) {
    if (!looksLikeStructuredHeading(line)) continue;
    const normalized = normalizeDocumentStructureTitle(line);
    const dedupeKey = normalized.toLowerCase();
    if (!normalized || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    entries.push(normalized);
  }

  if (entries.length < 2) return null;
  if (entries.length / Math.max(1, lines.length) < 0.5) return null;

  return {
    goal: goal.trim() || stripFileExtension(sourceName) || "Document Structure",
    value_summary: `Tree extracted from concise structured entries in "${sourceName}".`,
    nodes: entries.slice(0, 18).map((title) => buildOutlineWbsNode(title, 1, undefined, undefined, undefined, undefined, defaultRoleLabel))
  };
}

export function parseSectionHeadingStructureToWbs(
  goal: string,
  sourceName: string,
  rawText: string,
  defaultRoleLabel: string
): WBSResult | null {
  const lines = getDocumentAdvisorLines(rawText);
  if (lines.length < 8) return null;

  const sections = extractDocumentAdvisorSections(lines, []);
  if (sections.length < 4) return null;

  const seenTitles = new Set<string>();
  const nodes = sections
    .map((section) => normalizeDocumentStructureTitle(section.title))
    .filter((title) => {
      const key = title.toLowerCase();
      if (!title || seenTitles.has(key)) return false;
      seenTitles.add(key);
      return true;
    })
    .slice(0, 18)
    .map((title) => buildOutlineWbsNode(title, 1, undefined, undefined, undefined, undefined, defaultRoleLabel));

  if (nodes.length < 4) return null;

  return {
    goal: goal.trim() || stripFileExtension(sourceName) || "Document Structure",
    value_summary: `Tree extracted from repeated document section headings in "${sourceName}".`,
    nodes
  };
}

export function extractOutlineWbsFromSources(
  goal: string,
  sources: Array<{ name: string; text: string; }>,
  defaultRoleLabel: string
): WBSResult | null {
  for (const source of sources) {
    const parsed = parseNumberedOutlineToWbs(goal, source.name, source.text, defaultRoleLabel);
    if (parsed) return parsed;
  }
  return null;
}

export function extractDocumentStructureWbsFromSources(
  goal: string,
  sources: Array<{ name: string; text: string; }>,
  defaultRoleLabel: string
): WBSResult | null {
  for (const source of sources) {
    const parsed = parseDocumentStructureToWbs(goal, source.name, source.text, defaultRoleLabel);
    if (parsed) return parsed;
    const simpleStructured = parseSimpleStructuredEntriesToWbs(goal, source.name, source.text, defaultRoleLabel);
    if (simpleStructured) return simpleStructured;
    const sectionHeadingStructure = parseSectionHeadingStructureToWbs(
      goal,
      source.name,
      source.text,
      defaultRoleLabel
    );
    if (sectionHeadingStructure) return sectionHeadingStructure;
  }
  return null;
}

export function extractDocumentTreeSeedFromSources(
  goal: string,
  sources: Array<{ name: string; text: string; }>,
  defaultRoleLabel: string
): DocumentAdvisorTreeSeed | null {
  const outlineResult = extractOutlineWbsFromSources(goal, sources, defaultRoleLabel);
  if (outlineResult) {
    return {
      result: outlineResult,
      sourceMode: "numbered_outline",
      warning: "document_outline_extracted"
    };
  }

  const structureResult = extractDocumentStructureWbsFromSources(goal, sources, defaultRoleLabel);
  if (structureResult) {
    return {
      result: structureResult,
      sourceMode: "document_structure",
      warning: "document_structure_extracted"
    };
  }

  return null;
}
