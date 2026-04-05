import type { AppNode } from "@/lib/types";

export const NODE_NUMBER_OVERRIDE_PROPERTY = "odeNumberingOverride";
export const NODE_NUMBER_START_AT_PROPERTY = "odeNumberingStartAt";
export const NODE_NUMBER_FORMAT_PROPERTY = "odeNumberingFormat";
export const NODE_NUMBER_SEPARATOR_PROPERTY = "odeNumberingSeparator";
export const NODE_NUMBER_HIDDEN_PROPERTY = "odeNumberingHidden";

export const NODE_NUMBER_FORMAT_OPTIONS = [
  "numeric",
  "upper_alpha",
  "lower_alpha",
  "upper_roman",
  "lower_roman"
] as const;
export type NodeNumberFormat = (typeof NODE_NUMBER_FORMAT_OPTIONS)[number];

export const NODE_NUMBER_SEPARATOR_OPTIONS = [".", "-"] as const;
export type NodeNumberSeparator = (typeof NODE_NUMBER_SEPARATOR_OPTIONS)[number];

export const DEFAULT_NODE_NUMBER_FORMAT: NodeNumberFormat = "numeric";
export const DEFAULT_NODE_NUMBER_SEPARATOR: NodeNumberSeparator = ".";

export type NodeNumberingLevelState = {
  nextIndex: number;
  format: NodeNumberFormat;
  separator: NodeNumberSeparator;
};

export type ResolvedNodeTreeNumbering = {
  label: string;
  descendantPrefix: string;
  nextLevelState: NodeNumberingLevelState;
  childSeparator: NodeNumberSeparator;
};

function normalizePositiveInteger(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeNumberFormat(value: unknown): NodeNumberFormat | null {
  if (typeof value !== "string") return null;
  return NODE_NUMBER_FORMAT_OPTIONS.includes(value as NodeNumberFormat) ? (value as NodeNumberFormat) : null;
}

function normalizeNumberSeparator(value: unknown): NodeNumberSeparator | null {
  if (typeof value !== "string") return null;
  return NODE_NUMBER_SEPARATOR_OPTIONS.includes(value as NodeNumberSeparator)
    ? (value as NodeNumberSeparator)
    : null;
}

function formatAlphabeticIndex(index: number, upper: boolean): string {
  if (!Number.isFinite(index) || index <= 0) return `${index}`;
  let remaining = Math.floor(index);
  let result = "";
  while (remaining > 0) {
    remaining -= 1;
    result = String.fromCharCode(65 + (remaining % 26)) + result;
    remaining = Math.floor(remaining / 26);
  }
  return upper ? result : result.toLowerCase();
}

function formatRomanIndex(index: number, upper: boolean): string {
  if (!Number.isFinite(index) || index <= 0) return `${index}`;
  const numerals: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"]
  ];
  let remaining = Math.floor(index);
  let result = "";
  for (const [value, token] of numerals) {
    while (remaining >= value) {
      result += token;
      remaining -= value;
    }
  }
  return upper ? result : result.toLowerCase();
}

export function readNodeNumberOverride(node: AppNode | null | undefined): string {
  const value = node?.properties?.[NODE_NUMBER_OVERRIDE_PROPERTY];
  return typeof value === "string" ? value.trim() : "";
}

export function readNodeNumberStartAt(node: AppNode | null | undefined): number | null {
  return normalizePositiveInteger(node?.properties?.[NODE_NUMBER_START_AT_PROPERTY]);
}

export function readNodeNumberFormat(node: AppNode | null | undefined): NodeNumberFormat | null {
  return normalizeNumberFormat(node?.properties?.[NODE_NUMBER_FORMAT_PROPERTY]);
}

export function readNodeNumberSeparator(node: AppNode | null | undefined): NodeNumberSeparator | null {
  return normalizeNumberSeparator(node?.properties?.[NODE_NUMBER_SEPARATOR_PROPERTY]);
}

export function readNodeNumberHidden(node: AppNode | null | undefined): boolean {
  const value = node?.properties?.[NODE_NUMBER_HIDDEN_PROPERTY];
  return value === true || value === "true" || value === 1 || value === "1";
}

export function createNodeNumberingLevelState(
  overrides?: Partial<NodeNumberingLevelState>
): NodeNumberingLevelState {
  return {
    nextIndex: overrides?.nextIndex && overrides.nextIndex > 0 ? Math.floor(overrides.nextIndex) : 1,
    format: overrides?.format ?? DEFAULT_NODE_NUMBER_FORMAT,
    separator: overrides?.separator ?? DEFAULT_NODE_NUMBER_SEPARATOR
  };
}

export function formatNodeNumberIndex(index: number, format: NodeNumberFormat): string {
  switch (format) {
    case "upper_alpha":
      return formatAlphabeticIndex(index, true);
    case "lower_alpha":
      return formatAlphabeticIndex(index, false);
    case "upper_roman":
      return formatRomanIndex(index, true);
    case "lower_roman":
      return formatRomanIndex(index, false);
    case "numeric":
    default:
      return `${index}`;
  }
}

export function buildAutomaticNodeNumberLabel(
  parentLabel: string,
  index: number,
  format: NodeNumberFormat,
  separator: NodeNumberSeparator
): string {
  const segment = formatNodeNumberIndex(index, format);
  return parentLabel ? `${parentLabel}${separator}${segment}` : segment;
}

export function resolveNodeTreeNumbering(
  node: AppNode,
  params: {
    parentLabel: string;
    siblingState: NodeNumberingLevelState;
    ignoreLabelOverride?: boolean;
    ignoreFormatOverride?: boolean;
    ignoreSeparatorOverride?: boolean;
  }
): ResolvedNodeTreeNumbering {
  const overrideLabel = params.ignoreLabelOverride ? null : readNodeNumberOverride(node);
  const startAt = readNodeNumberStartAt(node);
  const format = (params.ignoreFormatOverride ? null : readNodeNumberFormat(node)) ?? params.siblingState.format;
  const separator =
    (params.ignoreSeparatorOverride ? null : readNodeNumberSeparator(node)) ?? params.siblingState.separator;
  const hidden = readNodeNumberHidden(node);
  const index = startAt ?? params.siblingState.nextIndex;
  const effectiveLabel = overrideLabel || buildAutomaticNodeNumberLabel(params.parentLabel, index, format, separator);
  const label = hidden ? "" : effectiveLabel;
  return {
    label,
    descendantPrefix: effectiveLabel,
    nextLevelState: {
      nextIndex: index + 1,
      format,
      separator
    },
    childSeparator: separator
  };
}

export function resolveNodeNumberLabel(node: AppNode, fallbackLabel: string): string {
  return readNodeNumberOverride(node) || fallbackLabel;
}
