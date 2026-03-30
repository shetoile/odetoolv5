import { extractFileExtensionLower, getNodeMirrorFilePath } from "@/lib/iconSupport";
import { extractDocumentText } from "@/lib/nodeService";
import type { AppNode } from "@/lib/types";

export type DocumentIngestionState =
  | "indexed"
  | "description_only"
  | "extracted_now"
  | "no_file_path"
  | "unreadable";

export type NormalizedDocumentKnowledge = {
  nodeId: string;
  name: string;
  type: AppNode["type"];
  extension: string;
  mirrorFilePath: string | null;
  text: string;
  charCount: number;
  lineCount: number;
  ingestionState: DocumentIngestionState;
};

const DOCUMENT_NODE_TYPES = new Set<AppNode["type"]>(["file", "document", "report", "minutes"]);

function normalizeDocumentText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countDocumentLines(text: string): number {
  if (!text) return 0;
  return text.split("\n").filter((line) => line.trim().length > 0).length;
}

export function isDocumentKnowledgeCandidate(node: AppNode | null | undefined): node is AppNode {
  if (!node) return false;
  return DOCUMENT_NODE_TYPES.has(node.type);
}

export function hasStoredDocumentKnowledge(node: AppNode): boolean {
  return normalizeDocumentText(node.content).length > 0 || normalizeDocumentText(node.description).length > 0;
}

export function buildDocumentKnowledgeExcerpt(text: string, limit: number = 180): string {
  const normalized = normalizeDocumentText(text);
  if (!normalized) return "No extracted text available yet.";
  return normalized.slice(0, limit);
}

export async function ingestDocumentKnowledge(node: AppNode): Promise<NormalizedDocumentKnowledge> {
  const mirrorFilePath = getNodeMirrorFilePath(node);
  const extension = extractFileExtensionLower(node.name);
  const indexedText = normalizeDocumentText(node.content);
  if (indexedText.length > 0) {
    return {
      nodeId: node.id,
      name: node.name,
      type: node.type,
      extension,
      mirrorFilePath,
      text: indexedText,
      charCount: indexedText.length,
      lineCount: countDocumentLines(indexedText),
      ingestionState: "indexed"
    };
  }

  const descriptionText = normalizeDocumentText(node.description);
  if (descriptionText.length > 0) {
    return {
      nodeId: node.id,
      name: node.name,
      type: node.type,
      extension,
      mirrorFilePath,
      text: descriptionText,
      charCount: descriptionText.length,
      lineCount: countDocumentLines(descriptionText),
      ingestionState: "description_only"
    };
  }

  if (!mirrorFilePath) {
    return {
      nodeId: node.id,
      name: node.name,
      type: node.type,
      extension,
      mirrorFilePath: null,
      text: "",
      charCount: 0,
      lineCount: 0,
      ingestionState: "no_file_path"
    };
  }

  try {
    const extractedText = normalizeDocumentText(
      await extractDocumentText(mirrorFilePath, {
        extension,
        nodeId: node.id
      })
    );
    if (extractedText.length > 0) {
      return {
        nodeId: node.id,
        name: node.name,
        type: node.type,
        extension,
        mirrorFilePath,
        text: extractedText,
        charCount: extractedText.length,
        lineCount: countDocumentLines(extractedText),
        ingestionState: "extracted_now"
      };
    }
  } catch {
    // The rebuild preview reports unreadable files without crashing the workflow.
  }

  return {
    nodeId: node.id,
    name: node.name,
    type: node.type,
    extension,
    mirrorFilePath,
    text: "",
    charCount: 0,
    lineCount: 0,
    ingestionState: "unreadable"
  };
}
