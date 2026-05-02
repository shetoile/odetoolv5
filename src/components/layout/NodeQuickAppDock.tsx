import { useCallback, useEffect, useRef, useState, type DragEvent as ReactDragEvent, type ReactNode } from "react";
import { EditGlyphSmall, PlusGlyphSmall } from "@/components/Icons";
import { OdeTooltip } from "@/components/overlay/OdeTooltip";
import { QuickAppIcon } from "@/components/quick-apps/QuickAppIcon";
import type { TranslationParams } from "@/lib/i18n";
import type { NodeQuickAppItem } from "@/lib/nodeQuickApps";

type TranslateFn = (key: string, params?: TranslationParams) => string;

interface NodeQuickAppDockProps {
  t: TranslateFn;
  nodeLabel: string | null;
  quickApps: NodeQuickAppItem[];
  onLaunchQuickApp: (item: NodeQuickAppItem) => void;
  onReorderQuickApps: (quickApps: NodeQuickAppItem[]) => void;
  onManageQuickApps: () => void;
  manageTooltipLabel?: string | null;
  leadingSlot?: ReactNode;
  compact?: boolean;
}

type QuickAppDropPlacement = "before" | "after";

function reorderQuickApps(
  items: NodeQuickAppItem[],
  draggedId: string,
  targetId: string,
  placement: QuickAppDropPlacement
): NodeQuickAppItem[] {
  if (draggedId === targetId) return items;
  const draggedIndex = items.findIndex((item) => item.id === draggedId);
  const targetIndex = items.findIndex((item) => item.id === targetId);
  if (draggedIndex < 0 || targetIndex < 0) return items;

  const nextItems = [...items];
  const [draggedItem] = nextItems.splice(draggedIndex, 1);
  const baseIndex = nextItems.findIndex((item) => item.id === targetId);
  if (baseIndex < 0) return items;
  const insertIndex = placement === "before" ? baseIndex : baseIndex + 1;
  nextItems.splice(insertIndex, 0, draggedItem);
  return nextItems;
}

function areQuickAppOrdersEqual(left: NodeQuickAppItem[], right: NodeQuickAppItem[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((item, index) => item.id === right[index]?.id);
}

function QuickAppDockButton({
  t,
  item,
  onOpen,
  dragging,
  canDrag,
  dragIndicator,
  suppressTooltip,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd
}: {
  t: TranslateFn;
  item: NodeQuickAppItem;
  onOpen: (item: NodeQuickAppItem) => void;
  dragging: boolean;
  canDrag: boolean;
  dragIndicator: QuickAppDropPlacement | null;
  suppressTooltip: boolean;
  onDragStart: (event: ReactDragEvent<HTMLButtonElement>, item: NodeQuickAppItem) => void;
  onDragOver: (event: ReactDragEvent<HTMLButtonElement>, item: NodeQuickAppItem) => void;
  onDrop: (event: ReactDragEvent<HTMLButtonElement>, item: NodeQuickAppItem) => void;
  onDragEnd: () => void;
}) {
  const accessibilityLabel = t("quick_apps.open_item", { name: item.label });
  const button = (
    <button
      type="button"
      draggable={canDrag}
      className={`group relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-transparent p-0 text-[var(--ode-text)] transition duration-150 hover:-translate-y-[1px] hover:bg-[rgba(18,75,108,0.26)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(110,198,244,0.28)] ${
        canDrag ? "cursor-grab active:cursor-grabbing" : ""
      } ${
        dragging ? "opacity-45" : ""
      }`}
      onClick={() => onOpen(item)}
      aria-label={accessibilityLabel}
      onDragStart={(event) => onDragStart(event, item)}
      onDragOver={(event) => onDragOver(event, item)}
      onDrop={(event) => onDrop(event, item)}
      onDragEnd={onDragEnd}
    >
      {dragIndicator === "before" ? (
        <span className="pointer-events-none absolute left-[-4px] top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-full bg-[rgba(145,221,255,0.96)] shadow-[0_0_10px_rgba(145,221,255,0.48)]" />
      ) : null}
      {dragIndicator === "after" ? (
        <span className="pointer-events-none absolute right-[-4px] top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-full bg-[rgba(145,221,255,0.96)] shadow-[0_0_10px_rgba(145,221,255,0.48)]" />
      ) : null}
      <QuickAppIcon item={item} variant="dock" />
      <span className="pointer-events-none absolute bottom-[2px] left-1/2 h-[2px] w-3 -translate-x-1/2 rounded-full bg-[rgba(110,198,244,0.26)] transition duration-150 group-hover:w-4 group-hover:bg-[rgba(145,221,255,0.92)]" />
    </button>
  );

  if (suppressTooltip) {
    return button;
  }

  return (
    <OdeTooltip label={item.label || accessibilityLabel} side="top">
      {button}
    </OdeTooltip>
  );
}

export function NodeQuickAppDock({
  t,
  nodeLabel,
  quickApps,
  onLaunchQuickApp,
  onReorderQuickApps,
  onManageQuickApps,
  manageTooltipLabel = null,
  leadingSlot,
  compact = false
}: NodeQuickAppDockProps) {
  const [orderedQuickApps, setOrderedQuickApps] = useState<NodeQuickAppItem[]>(quickApps);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragIndicator, setDragIndicator] = useState<{
    targetId: string;
    placement: QuickAppDropPlacement;
  } | null>(null);
  const didReorderRef = useRef(false);
  const droppedOrderRef = useRef<NodeQuickAppItem[] | null>(null);
  const suppressLaunchRef = useRef(false);
  const hasNode = Boolean(nodeLabel);
  const showManageButton = hasNode;
  const hasLeadingSlot = Boolean(leadingSlot);
  const showDock = quickApps.length > 0 || showManageButton || hasLeadingSlot;
  const canDragQuickApps = orderedQuickApps.length > 1;
  const manageLabel = manageTooltipLabel?.trim() || nodeLabel || (quickApps.length > 0 ? t("quick_apps.manage") : t("quick_apps.add_new"));
  const handleOpenQuickApp = useCallback(
    (item: NodeQuickAppItem) => {
      if (suppressLaunchRef.current) {
        suppressLaunchRef.current = false;
        return;
      }
      onLaunchQuickApp(item);
    },
    [onLaunchQuickApp]
  );

  useEffect(() => {
    setOrderedQuickApps(quickApps);
  }, [quickApps]);

  const commitReorder = useCallback(
    (nextItems: NodeQuickAppItem[]) => {
      if (areQuickAppOrdersEqual(nextItems, quickApps)) return;
      onReorderQuickApps(nextItems);
    },
    [onReorderQuickApps, quickApps]
  );

  const handleDragStart = (event: ReactDragEvent<HTMLButtonElement>, item: NodeQuickAppItem) => {
    if (!canDragQuickApps) return;
    didReorderRef.current = false;
    setDraggingId(item.id);
    setDragIndicator(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", item.id);
  };

  const handleDragOver = (event: ReactDragEvent<HTMLButtonElement>, item: NodeQuickAppItem) => {
    if (!draggingId || draggingId === item.id) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const placement: QuickAppDropPlacement =
      event.clientX < rect.left + rect.width / 2 ? "before" : "after";
    setDragIndicator({ targetId: item.id, placement });
    setOrderedQuickApps((current) => {
      const nextItems = reorderQuickApps(current, draggingId, item.id, placement);
      if (!areQuickAppOrdersEqual(nextItems, current)) {
        didReorderRef.current = true;
      }
      return nextItems;
    });
  };

  const handleDrop = (event: ReactDragEvent<HTMLButtonElement>, item: NodeQuickAppItem) => {
    if (!draggingId) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const placement: QuickAppDropPlacement =
      event.clientX < rect.left + rect.width / 2 ? "before" : "after";
    const nextItems = reorderQuickApps(orderedQuickApps, draggingId, item.id, placement);
    droppedOrderRef.current = nextItems;
    setOrderedQuickApps(nextItems);
    setDragIndicator(null);
    setDraggingId(null);
    if (didReorderRef.current || !areQuickAppOrdersEqual(nextItems, quickApps)) {
      suppressLaunchRef.current = true;
      window.setTimeout(() => {
        suppressLaunchRef.current = false;
      }, 0);
      commitReorder(nextItems);
    }
    didReorderRef.current = false;
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragIndicator(null);
    didReorderRef.current = false;
    setOrderedQuickApps(droppedOrderRef.current ?? quickApps);
    droppedOrderRef.current = null;
  };

  if (!showDock) {
    return compact ? null : <div className="flex min-w-0 flex-[1.15] items-center justify-start px-2" />;
  }

  return (
    <div
      className={
        compact
          ? "flex min-w-0 items-center justify-end"
          : "flex min-w-0 flex-[1.15] items-center justify-start px-2"
      }
    >
      <div
        className={`flex min-w-0 items-center gap-1.5 rounded-[15px] bg-[rgba(7,30,47,0.34)] px-1.5 py-1 backdrop-blur-[10px] ${
          compact ? "max-w-[360px]" : "max-w-[760px]"
        }`}
      >
        {hasLeadingSlot ? (
          <div className="mr-1 flex shrink-0 items-center pr-1.5">
            {leadingSlot}
          </div>
        ) : null}

        <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto">
          {orderedQuickApps.map((item) => (
            <QuickAppDockButton
              key={item.id}
              t={t}
              item={item}
              onOpen={handleOpenQuickApp}
              dragging={draggingId === item.id}
              canDrag={canDragQuickApps}
              dragIndicator={dragIndicator?.targetId === item.id ? dragIndicator.placement : null}
              suppressTooltip={Boolean(draggingId)}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>

        {showManageButton ? (
          <div className="ml-1 flex shrink-0 items-center pl-1.5">
            <OdeTooltip label={manageLabel} side="top">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-transparent text-[var(--ode-text-dim)] transition hover:bg-[rgba(18,75,108,0.22)] hover:text-[var(--ode-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(110,198,244,0.28)]"
                onClick={onManageQuickApps}
                aria-label={manageLabel}
              >
                {quickApps.length > 0 ? <EditGlyphSmall /> : <PlusGlyphSmall />}
              </button>
            </OdeTooltip>
          </div>
        ) : null}
      </div>
    </div>
  );
}
