import type { AppNode, ProjectSummary } from "@/lib/types";
import {
  buildDocumentKnowledgeStore,
  type DocumentKnowledgeSourceMode,
  type KnowledgeDocumentRecord
} from "./documentStore";
import { buildWorkspaceKnowledgeSummary } from "./workspaceSummary";

export type RetrievalReason = "title" | "outline" | "content" | "format";

export type KnowledgeDocumentMatch = {
  nodeId: string;
  title: string;
  extension: string;
  ingestionState: KnowledgeDocumentRecord["ingestionState"];
  score: number;
  reasons: RetrievalReason[];
  excerpt: string;
};

export type KnowledgeRetrievalPreview = {
  scopeName: string;
  sourceMode: DocumentKnowledgeSourceMode;
  query: string;
  querySource: "manual" | "selected_context" | "outline_topic" | "format_hint" | "recent_fallback";
  documentMatches: KnowledgeDocumentMatch[];
  matchedOutlineTopics: string[];
  matchedExtensions: string[];
  matchedSignals: string[];
  generatedAt: string | null;
};

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenizeQuery(value: string): string[] {
  return Array.from(
    new Set(
      normalizeText(value)
        .split(/[^a-z0-9\u00c0-\u024f]+/i)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2)
    )
  );
}

function resolveRetrievalQuery(args: {
  requestedQuery: string;
  selectedNodeIds: string[];
  allNodes: AppNode[];
  outlineTopics: string[];
  topExtensions: string[];
}): { query: string; querySource: KnowledgeRetrievalPreview["querySource"] } {
  const trimmedRequested = args.requestedQuery.trim();
  if (trimmedRequested.length > 0) {
    return {
      query: trimmedRequested,
      querySource: "manual"
    };
  }

  const nodeById = new Map(args.allNodes.map((node) => [node.id, node]));
  const selectedContext = args.selectedNodeIds
    .map((nodeId) => nodeById.get(nodeId)?.name?.trim() ?? "")
    .filter((value) => value.length > 0)
    .slice(0, 2)
    .join(" ");
  if (selectedContext.length > 0) {
    return {
      query: selectedContext,
      querySource: "selected_context"
    };
  }

  if (args.outlineTopics.length > 0) {
    return {
      query: args.outlineTopics[0],
      querySource: "outline_topic"
    };
  }

  if (args.topExtensions.length > 0) {
    return {
      query: args.topExtensions[0],
      querySource: "format_hint"
    };
  }

  return {
    query: "recent knowledge",
    querySource: "recent_fallback"
  };
}

function scoreDocumentMatch(record: KnowledgeDocumentRecord, tokens: string[]): KnowledgeDocumentMatch | null {
  const normalizedTitle = normalizeText(record.title);
  const normalizedOutline = normalizeText(record.outlineLines.join(" "));
  const normalizedExcerpt = normalizeText(record.excerpt);
  const normalizedText = normalizeText(record.text.slice(0, 2500));
  const normalizedExtension = normalizeText(record.extension);
  const normalizedKind = normalizeText(record.kind);
  const reasons = new Set<RetrievalReason>();
  let score = 0;

  for (const token of tokens) {
    if (normalizedTitle.includes(token)) {
      score += 12;
      reasons.add("title");
    }
    if (normalizedOutline.includes(token)) {
      score += 8;
      reasons.add("outline");
    }
    if (normalizedExcerpt.includes(token) || normalizedText.includes(token)) {
      score += 4;
      reasons.add("content");
    }
    if (normalizedExtension.includes(token) || normalizedKind.includes(token)) {
      score += 3;
      reasons.add("format");
    }
  }

  if (score <= 0) return null;

  return {
    nodeId: record.nodeId,
    title: record.title,
    extension: record.extension,
    ingestionState: record.ingestionState,
    score,
    reasons: Array.from(reasons),
    excerpt: record.excerpt
  };
}

export async function buildKnowledgeRetrievalPreview(args: {
  project: ProjectSummary | null;
  allNodes: AppNode[];
  selectedNodeIds: string[];
  language: string;
  query: string;
  maxRecords?: number;
}): Promise<KnowledgeRetrievalPreview> {
  const maxRecords = Math.max(1, args.maxRecords ?? 12);
  const [documentStore, workspaceSummary] = await Promise.all([
    buildDocumentKnowledgeStore({
      project: args.project,
      allNodes: args.allNodes,
      selectedNodeIds: args.selectedNodeIds,
      language: args.language,
      maxRecords
    }),
    buildWorkspaceKnowledgeSummary({
      project: args.project,
      allNodes: args.allNodes,
      selectedNodeIds: args.selectedNodeIds,
      language: args.language,
      maxRecords
    })
  ]);

  const resolvedQuery = resolveRetrievalQuery({
    requestedQuery: args.query,
    selectedNodeIds: args.selectedNodeIds,
    allNodes: args.allNodes,
    outlineTopics: workspaceSummary.outlineTopics,
    topExtensions: workspaceSummary.topExtensions.map((entry) => entry.label)
  });
  const tokens = tokenizeQuery(resolvedQuery.query);

  let documentMatches: KnowledgeDocumentMatch[];
  if (tokens.length === 0) {
    documentMatches = documentStore.snapshot.documents.slice(0, 5).map((record, index) => ({
      nodeId: record.nodeId,
      title: record.title,
      extension: record.extension,
      ingestionState: record.ingestionState,
      score: Math.max(1, 5 - index),
      reasons: ["content"],
      excerpt: record.excerpt
    }));
  } else {
    documentMatches = documentStore.snapshot.documents
      .map((record) => scoreDocumentMatch(record, tokens))
      .filter((value): value is KnowledgeDocumentMatch => Boolean(value))
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return left.title.localeCompare(right.title);
      })
      .slice(0, 5);
  }

  const normalizedTokens = tokens.length > 0 ? tokens : tokenizeQuery(resolvedQuery.query);
  const tokenMatches = (value: string) => normalizedTokens.some((token) => normalizeText(value).includes(token));

  return {
    scopeName: documentStore.scopeName,
    sourceMode: documentStore.sourceMode,
    query: resolvedQuery.query,
    querySource: resolvedQuery.querySource,
    documentMatches,
    matchedOutlineTopics: workspaceSummary.outlineTopics.filter((topic) => tokenMatches(topic)).slice(0, 6),
    matchedExtensions: workspaceSummary.topExtensions
      .map((entry) => entry.label)
      .filter((label) => tokenMatches(label))
      .slice(0, 5),
    matchedSignals: workspaceSummary.signals.filter((signal) => tokenMatches(signal)).slice(0, 4),
    generatedAt: workspaceSummary.generatedAt
  };
}
