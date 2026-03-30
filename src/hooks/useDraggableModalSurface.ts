import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react"

type UseDraggableModalSurfaceOptions = {
  open: boolean
  enabled?: boolean
  viewportPadding?: number
  ignoreSelector?: string
}

type ModalOffset = {
  x: number
  y: number
}

type DragState = {
  startClientX: number
  startClientY: number
  startLeft: number
  startTop: number
  startOffsetX: number
  startOffsetY: number
  width: number
  height: number
}

const DEFAULT_IGNORE_SELECTOR = [
  "button",
  "input",
  "textarea",
  "select",
  "option",
  "a",
  "summary",
  "label",
  "[role='button']",
  "[data-ode-drag-ignore='true']",
  "[data-ode-window-drag-ignore='true']"
].join(", ")

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getAxisBounds(size: number, viewportSize: number, viewportPadding: number) {
  const viewportEdge = viewportSize - size - viewportPadding
  return {
    min: Math.min(viewportPadding, viewportEdge),
    max: Math.max(viewportPadding, viewportEdge)
  }
}

export function useDraggableModalSurface({
  open,
  enabled = true,
  viewportPadding = 16,
  ignoreSelector = DEFAULT_IGNORE_SELECTOR
}: UseDraggableModalSurfaceOptions) {
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<DragState | null>(null)
  const bodyUserSelectRef = useRef<string | null>(null)
  const bodyCursorRef = useRef<string | null>(null)
  const [offset, setOffset] = useState<ModalOffset>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)

  const resetPosition = () => {
    setOffset({ x: 0, y: 0 })
  }

  const restoreBodyDragStyles = () => {
    if (typeof document === "undefined") return
    document.body.style.userSelect = bodyUserSelectRef.current ?? ""
    document.body.style.cursor = bodyCursorRef.current ?? ""
    bodyUserSelectRef.current = null
    bodyCursorRef.current = null
  }

  const applyBodyDragStyles = () => {
    if (typeof document === "undefined") return
    if (bodyUserSelectRef.current === null) {
      bodyUserSelectRef.current = document.body.style.userSelect
    }
    if (bodyCursorRef.current === null) {
      bodyCursorRef.current = document.body.style.cursor
    }
    document.body.style.userSelect = "none"
    document.body.style.cursor = "grabbing"
  }

  const clampOffsetToViewport = (currentOffset: ModalOffset): ModalOffset => {
    const surface = surfaceRef.current
    if (!surface || typeof window === "undefined") return currentOffset
    const rect = surface.getBoundingClientRect()
    const horizontalBounds = getAxisBounds(rect.width, window.innerWidth, viewportPadding)
    const verticalBounds = getAxisBounds(rect.height, window.innerHeight, viewportPadding)
    const nextLeft = clamp(rect.left, horizontalBounds.min, horizontalBounds.max)
    const nextTop = clamp(rect.top, verticalBounds.min, verticalBounds.max)
    return {
      x: currentOffset.x + nextLeft - rect.left,
      y: currentOffset.y + nextTop - rect.top
    }
  }

  useEffect(() => {
    return () => {
      restoreBodyDragStyles()
    }
  }, [])

  useEffect(() => {
    if (enabled) return
    dragStateRef.current = null
    setIsDragging(false)
    restoreBodyDragStyles()
    resetPosition()
  }, [enabled])

  useEffect(() => {
    if (!open) {
      dragStateRef.current = null
      setIsDragging(false)
      restoreBodyDragStyles()
      resetPosition()
      return
    }
    resetPosition()
  }, [open])

  useEffect(() => {
    if (!open || !enabled) return

    const frameId = window.requestAnimationFrame(() => {
      setOffset((currentOffset) => clampOffsetToViewport(currentOffset))
    })

    const handleResize = () => {
      setOffset((currentOffset) => clampOffsetToViewport(currentOffset))
    }

    window.addEventListener("resize", handleResize)
    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener("resize", handleResize)
    }
  }, [enabled, open, viewportPadding])

  useEffect(() => {
    if (!isDragging || !enabled) return

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current
      if (!dragState) return
      const horizontalBounds = getAxisBounds(dragState.width, window.innerWidth, viewportPadding)
      const verticalBounds = getAxisBounds(dragState.height, window.innerHeight, viewportPadding)
      const targetLeft = dragState.startLeft + (event.clientX - dragState.startClientX)
      const targetTop = dragState.startTop + (event.clientY - dragState.startClientY)
      const nextLeft = clamp(targetLeft, horizontalBounds.min, horizontalBounds.max)
      const nextTop = clamp(targetTop, verticalBounds.min, verticalBounds.max)

      setOffset({
        x: dragState.startOffsetX + (nextLeft - dragState.startLeft),
        y: dragState.startOffsetY + (nextTop - dragState.startTop)
      })
    }

    const stopDragging = () => {
      dragStateRef.current = null
      setIsDragging(false)
      restoreBodyDragStyles()
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", stopDragging)
    window.addEventListener("pointercancel", stopDragging)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", stopDragging)
      window.removeEventListener("pointercancel", stopDragging)
      restoreBodyDragStyles()
    }
  }, [enabled, isDragging, viewportPadding])

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!enabled) return
    if (event.button !== 0) return
    if (event.target instanceof Element && event.target.closest(ignoreSelector)) return

    const surface = surfaceRef.current
    if (!surface) return

    const rect = surface.getBoundingClientRect()
    dragStateRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      startOffsetX: offset.x,
      startOffsetY: offset.y,
      width: rect.width,
      height: rect.height
    }
    event.preventDefault()
    applyBodyDragStyles()
    setIsDragging(true)
  }

  const surfaceStyle: CSSProperties | undefined = enabled
    ? {
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
        willChange: isDragging ? "transform" : undefined
      }
    : undefined

  return {
    surfaceRef,
    surfaceStyle,
    handlePointerDown,
    isDragging,
    resetPosition
  }
}
