import { isWorkareaRootNode } from "@/features/workspace/workarea";
import type { AppNode } from "@/lib/types";

const INTERNAL_ODE_NODE_NAME_PATTERN = /^__ode_[a-z0-9_]+__$/i;

function humanizeInternalNodeName(name: string): string {
  const normalized = name
    .trim()
    .replace(/^__+|__+$/g, "")
    .replace(/^ode_?/i, "")
    .replace(/[_-]+/g, " ")
    .trim();

  if (!normalized) return "";

  return normalized.replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

export function isInternalSystemNodeName(name: string | null | undefined): boolean {
  if (typeof name !== "string") return false;
  return INTERNAL_ODE_NODE_NAME_PATTERN.test(name.trim());
}

export function shouldHideNodeFromGenericUi(node: AppNode | null | undefined): boolean {
  if (!node) return false;
  return isWorkareaRootNode(node) || isInternalSystemNodeName(node.name);
}

export function getNodeDisplayName(node: AppNode | null | undefined): string {
  if (!node) return "";

  if (isWorkareaRootNode(node)) {
    return "Workarea";
  }

  if (isInternalSystemNodeName(node.name)) {
    const humanized = humanizeInternalNodeName(node.name);
    if (humanized) return humanized;
  }

  return node.name;
}
