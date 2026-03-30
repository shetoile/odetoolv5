import {
  cloneElement,
  isValidElement,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement
} from "react";
import { createPortal } from "react-dom";

type TooltipSide = "top" | "bottom";
type TooltipAlign = "start" | "center" | "end";

interface OdeTooltipProps {
  label?: string | null;
  side?: TooltipSide;
  align?: TooltipAlign;
  tooltipClassName?: string;
  children: ReactElement;
}

type TooltipAnchorElement = HTMLElement & {
  focus?: () => void;
};

type TooltipPosition = {
  left: number;
  top: number;
  side: TooltipSide;
};

function assignRef<T>(ref: React.Ref<T> | undefined, value: T) {
  if (!ref) return;
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  try {
    (ref as React.MutableRefObject<T>).current = value;
  } catch {
    // Ignore readonly ref shapes.
  }
}

export function OdeTooltip({
  label,
  side = "bottom",
  align = "center",
  tooltipClassName,
  children
}: OdeTooltipProps) {
  const anchorRef = useRef<TooltipAnchorElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({
    left: 0,
    top: 0,
    side
  });
  const tooltipId = useId().replace(/:/g, "");

  if (!label || !isValidElement(children)) {
    return children;
  }

  const updatePosition = () => {
    const anchor = anchorRef.current;
    const tooltip = tooltipRef.current;
    if (!anchor || !tooltip) return;

    const viewportPadding = 8;
    const gap = 10;
    const anchorRect = anchor.getBoundingClientRect();
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;

    let resolvedSide = side;
    if (
      side === "bottom" &&
      anchorRect.bottom + gap + tooltipHeight + viewportPadding > window.innerHeight &&
      anchorRect.top - gap - tooltipHeight >= viewportPadding
    ) {
      resolvedSide = "top";
    } else if (
      side === "top" &&
      anchorRect.top - gap - tooltipHeight < viewportPadding &&
      anchorRect.bottom + gap + tooltipHeight <= window.innerHeight - viewportPadding
    ) {
      resolvedSide = "bottom";
    }

    let left = anchorRect.left + (anchorRect.width - tooltipWidth) / 2;
    if (align === "start") {
      left = anchorRect.left;
    } else if (align === "end") {
      left = anchorRect.right - tooltipWidth;
    }

    left = Math.min(
      window.innerWidth - viewportPadding - tooltipWidth,
      Math.max(viewportPadding, left)
    );

    let top =
      resolvedSide === "bottom"
        ? anchorRect.bottom + gap
        : anchorRect.top - gap - tooltipHeight;
    top = Math.min(
      window.innerHeight - viewportPadding - tooltipHeight,
      Math.max(viewportPadding, top)
    );

    setPosition({
      left,
      top,
      side: resolvedSide
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const rafId = window.requestAnimationFrame(updatePosition);
    const handleViewportChange = () => updatePosition();
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [align, label, open, side]);

  const child = children as ReactElement<any>;
  const childProps = child.props as {
    onMouseEnter?: (event: ReactMouseEvent<TooltipAnchorElement>) => void;
    onMouseLeave?: (event: ReactMouseEvent<TooltipAnchorElement>) => void;
    onFocus?: (event: ReactFocusEvent<TooltipAnchorElement>) => void;
    onBlur?: (event: ReactFocusEvent<TooltipAnchorElement>) => void;
    "aria-describedby"?: string;
  };
  const childRef = (child as ReactElement & { ref?: React.Ref<TooltipAnchorElement> }).ref;

  return (
    <>
      {cloneElement<any>(child, {
        ref: (node: TooltipAnchorElement | null) => {
          anchorRef.current = node;
          assignRef(childRef, node);
        },
        onMouseEnter: (event: ReactMouseEvent<TooltipAnchorElement>) => {
          childProps.onMouseEnter?.(event);
          setOpen(true);
        },
        onMouseLeave: (event: ReactMouseEvent<TooltipAnchorElement>) => {
          childProps.onMouseLeave?.(event);
          setOpen(false);
        },
        onFocus: (event: ReactFocusEvent<TooltipAnchorElement>) => {
          childProps.onFocus?.(event);
          setOpen(true);
        },
        onBlur: (event: ReactFocusEvent<TooltipAnchorElement>) => {
          childProps.onBlur?.(event);
          setOpen(false);
        },
        "aria-describedby": open
          ? childProps["aria-describedby"]
            ? `${childProps["aria-describedby"]} ${tooltipId}`
            : tooltipId
          : childProps["aria-describedby"]
      })}
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={tooltipRef}
              id={tooltipId}
              role="tooltip"
              className={tooltipClassName ? `ode-tooltip-popup ${tooltipClassName}` : "ode-tooltip-popup"}
              data-side={position.side}
              style={{
                left: `${position.left}px`,
                top: `${position.top}px`
              }}
            >
              {label}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
