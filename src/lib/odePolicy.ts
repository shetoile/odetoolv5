import { getNAByCode } from "@/lib/naCatalog";
import type { AppNode, ODENodeKind, ODENodeMetadata, ODETraceMeta } from "@/lib/types";

export interface ODECreationResolution {
  allowed: boolean;
  reason: string | null;
  createAs: ODENodeKind;
  nextLevel: number | null;
  naCode: string | null;
}

function readStringProperty(properties: Record<string, unknown> | undefined, key: string): string | null {
  const value = properties?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readNumberProperty(properties: Record<string, unknown> | undefined, key: string): number | null {
  const value = properties?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readBooleanProperty(properties: Record<string, unknown> | undefined, key: string): boolean | null {
  const value = properties?.[key];
  return typeof value === "boolean" ? value : null;
}

function readNodeKind(properties: Record<string, unknown> | undefined): ODENodeKind | null {
  const raw = readStringProperty(properties, "ode_node_kind");
  if (
    raw === "na_root" ||
    raw === "na_branch" ||
    raw === "chantier" ||
    raw === "task" ||
    raw === "document" ||
    raw === "generic"
  ) {
    return raw;
  }
  return null;
}

export function getODENodeMetadata(node: AppNode | null | undefined): ODENodeMetadata {
  const properties = node?.properties;
  const naCode = readStringProperty(properties, "ode_na_code");
  const levelFromProperty = readNumberProperty(properties, "ode_level");
  const levelFromCode = naCode && getNAByCode(naCode) ? naCode.length : null;
  const level = levelFromProperty ?? levelFromCode ?? null;
  const kind = readNodeKind(properties);
  const explicitLocked = readBooleanProperty(properties, "ode_locked");
  const locked = explicitLocked ?? (level !== null && level <= 4);
  return {
    level,
    naCode,
    locked,
    kind
  };
}

export function isODENode(node: AppNode | null | undefined): boolean {
  const metadata = getODENodeMetadata(node);
  return metadata.level !== null || metadata.naCode !== null || metadata.kind !== null;
}

export function isProtectedODENode(node: AppNode | null | undefined): boolean {
  const metadata = getODENodeMetadata(node);
  return metadata.level !== null && metadata.level <= 4 && metadata.locked;
}

export function canCreateChantierUnderNode(node: AppNode | null | undefined): boolean {
  if (!node) return true;
  if (!isODENode(node)) return true;
  const metadata = getODENodeMetadata(node);
  if (metadata.level === 4) return true;
  return metadata.kind === "chantier" || (metadata.level !== null && metadata.level >= 5 && !metadata.locked);
}

export function resolveODECreationTarget(node: AppNode | null | undefined): ODECreationResolution {
  if (!node || !isODENode(node)) {
    return {
      allowed: true,
      reason: null,
      createAs: "generic",
      nextLevel: null,
      naCode: null
    };
  }

  const metadata = getODENodeMetadata(node);
  if (metadata.level === null) {
    return {
      allowed: true,
      reason: null,
      createAs: "generic",
      nextLevel: null,
      naCode: metadata.naCode
    };
  }

  if (metadata.level < 4) {
    return {
      allowed: false,
      reason: "Select a Level 4 NA node or an existing Chantier before creating AI-generated structure.",
      createAs: "generic",
      nextLevel: null,
      naCode: metadata.naCode
    };
  }

  if (metadata.level === 4) {
    return {
      allowed: true,
      reason: null,
      createAs: "chantier",
      nextLevel: 5,
      naCode: metadata.naCode
    };
  }

  return {
    allowed: true,
    reason: null,
    createAs: metadata.kind === "chantier" ? "task" : metadata.kind ?? "task",
    nextLevel: metadata.level + 1,
    naCode: metadata.naCode
  };
}

export function buildODENodeProperties(
  input: {
    level: number | null;
    naCode: string | null;
    kind: ODENodeKind;
    trace?: ODETraceMeta | null;
  }
): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    ode_node_kind: input.kind,
    ode_locked: input.level !== null && input.level <= 4
  };
  if (input.level !== null) {
    properties.ode_level = input.level;
  }
  if (input.naCode) {
    properties.ode_na_code = input.naCode;
  }
  if (input.trace) {
    properties.ode_ai_trace = input.trace;
  }
  return properties;
}
