import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent
} from "react";
import { NodeGlyph, OpenGlyphSmall } from "@/components/Icons";
import { useDraggableModalSurface } from "@/hooks/useDraggableModalSurface";
import type { TranslationParams } from "@/lib/i18n";
import { isFileLikeNode, type AppNode, type FolderNodeState } from "@/lib/types";

type TranslateFn = (key: string, params?: TranslationParams) => string;

interface WorkspaceContentModalProps {
  t: TranslateFn;
  open: boolean;
  title: string;
  contextLabel: string;
  items: AppNode[];
  folderNodeStateById: Map<string, FolderNodeState>;
  executionOwnerNodeIds: Set<string>;
  getNodeTypeLabel: (node: AppNode) => string;
  emptyMessage: string;
  openLabel: string;
  onClose: () => void;
  onOpenItem: (nodeId: string) => void | Promise<void>;
}

export function WorkspaceContentModal({
  t,
  open,
  title,
  contextLabel,
  items,
  folderNodeStateById,
  executionOwnerNodeIds,
  getNodeTypeLabel,
  emptyMessage,
  openLabel,
  onClose,
  onOpenItem
}: WorkspaceContentModalProps) {
  const { surfaceRef, surfaceStyle, handlePointerDown } = useDraggableModalSurface({ open });

  if (!open) return null;

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  const handleOpen = (event: ReactMouseEvent<HTMLElement>, nodeId: string) => {
    event.preventDefault();
    void onOpenItem(nodeId);
  };

  return (
    <div
      className="ode-overlay-scrim fixed inset-0 z-[125] flex items-center justify-center p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return;
        onClose();
      }}
    >
      <div
        ref={surfaceRef}
        style={surfaceStyle}
        className="ode-modal w-full max-w-3xl overflow-hidden rounded-[22px] border border-[var(--ode-border-strong)]"
        onKeyDown={handleKeyDown}
      >
        <div
          className="ode-modal-drag-handle flex items-center justify-between border-b border-[var(--ode-border)] px-6 py-5"
          onPointerDown={handlePointerDown}
        >
          <div className="min-w-0">
            <h2 className="text-[1.35rem] font-semibold tracking-tight text-[var(--ode-accent)]">{title}</h2>
            <p className="mt-1 truncate text-[0.9rem] text-[var(--ode-text-dim)]">{contextLabel}</p>
          </div>
          <button
            type="button"
            className="ode-icon-btn h-10 w-10"
            onClick={onClose}
            aria-label={t("delete.modal_cancel")}
          >
            x
          </button>
        </div>

        <div className="max-h-[68vh] overflow-auto px-6 py-5">
          {items.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-[var(--ode-border)] bg-[rgba(4,24,40,0.35)] px-5 py-6 text-[0.92rem] text-[var(--ode-text-dim)]">
              {emptyMessage}
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const isFile = isFileLikeNode(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-[18px] border border-[var(--ode-border)] bg-[rgba(5,27,44,0.42)] px-4 py-3 text-left transition hover:border-[rgba(106,212,255,0.3)] hover:bg-[rgba(8,38,60,0.64)]"
                    onClick={(event) => {
                      handleOpen(event, item.id);
                    }}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-[rgba(88,197,255,0.18)] bg-[rgba(8,41,62,0.78)] text-[var(--ode-text)]">
                      <NodeGlyph
                        node={item}
                        active
                        folderState={!isFile ? folderNodeStateById.get(item.id) : undefined}
                        showExecutionOwnerGlyph={executionOwnerNodeIds.has(item.id)}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[1rem] font-medium text-[var(--ode-text)]">{item.name}</div>
                      <div className="mt-1 text-[0.8rem] text-[var(--ode-text-dim)]">{getNodeTypeLabel(item)}</div>
                    </div>
                    <span className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[12px] border border-[rgba(88,197,255,0.2)] bg-[rgba(9,47,72,0.65)] px-3 text-[0.78rem] uppercase tracking-[0.1em] text-[var(--ode-text)]">
                      <OpenGlyphSmall />
                      <span>{openLabel}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
