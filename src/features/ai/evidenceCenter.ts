export type AiEvidenceCenterStatus = "grounded" | "metadata_only" | "empty";

export type AiEvidenceCenterScopeSummary = {
  scope: string;
  label: string;
  ownerLabel: string;
  itemCount: number;
  readableCount: number;
  previewableCount: number;
  groundedCount: number;
  metadataOnlyCount: number;
  itemLabels: string[];
};

export type AiEvidenceCenterInput = {
  documentCount: number;
  selectedDocumentCount: number;
  sourceLabelCount: number;
  quickAppScopes: readonly AiEvidenceCenterScopeSummary[];
};

export type AiEvidenceCenterCard = {
  id: string;
  label: string;
  value: number;
  detail: string;
  status: AiEvidenceCenterStatus;
};

export type AiEvidenceCenterSummary = {
  status: AiEvidenceCenterStatus;
  documentCount: number;
  selectedDocumentCount: number;
  sourceLabelCount: number;
  totalQuickApps: number;
  groundedQuickApps: number;
  readableLocalResources: number;
  previewableLinks: number;
  metadataOnlyQuickApps: number;
  cards: AiEvidenceCenterCard[];
};

function clampCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function resolveStatus(groundedCount: number, metadataOnlyCount: number, documentCount: number): AiEvidenceCenterStatus {
  if (groundedCount > 0 || documentCount > 0) return "grounded";
  if (metadataOnlyCount > 0) return "metadata_only";
  return "empty";
}

export function buildAiEvidenceCenterSummary(input: AiEvidenceCenterInput): AiEvidenceCenterSummary {
  const documentCount = clampCount(input.documentCount);
  const selectedDocumentCount = clampCount(input.selectedDocumentCount);
  const sourceLabelCount = clampCount(input.sourceLabelCount);
  const totals = input.quickAppScopes.reduce(
    (next, scope) => ({
      totalQuickApps: next.totalQuickApps + clampCount(scope.itemCount),
      groundedQuickApps: next.groundedQuickApps + clampCount(scope.groundedCount),
      readableLocalResources: next.readableLocalResources + clampCount(scope.readableCount),
      previewableLinks: next.previewableLinks + clampCount(scope.previewableCount),
      metadataOnlyQuickApps: next.metadataOnlyQuickApps + clampCount(scope.metadataOnlyCount)
    }),
    {
      totalQuickApps: 0,
      groundedQuickApps: 0,
      readableLocalResources: 0,
      previewableLinks: 0,
      metadataOnlyQuickApps: 0
    }
  );
  const status = resolveStatus(
    totals.groundedQuickApps + sourceLabelCount,
    totals.metadataOnlyQuickApps,
    documentCount
  );

  return {
    status,
    documentCount,
    selectedDocumentCount,
    sourceLabelCount,
    ...totals,
    cards: input.quickAppScopes.map((scope) => {
      const groundedCount = clampCount(scope.groundedCount);
      const metadataOnlyCount = clampCount(scope.metadataOnlyCount);
      return {
        id: scope.scope,
        label: scope.label,
        value: clampCount(scope.itemCount),
        detail: scope.ownerLabel,
        status: resolveStatus(groundedCount, metadataOnlyCount, 0)
      };
    })
  };
}
