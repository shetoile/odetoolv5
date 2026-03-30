import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode
} from "react";
import { NodeGlyph } from "@/components/Icons";
import { useDraggableModalSurface } from "@/hooks/useDraggableModalSurface";
import type { TranslationParams } from "@/lib/i18n";
import { getNodeMirrorFilePath } from "@/lib/iconSupport";
import { readLocalFileDataUrl, readLocalImageDataUrl } from "@/lib/nodeService";
import type { AppNode } from "@/lib/types";
import type { PDFDocumentProxy } from "pdfjs-dist";

type TranslateFn = (key: string, params?: TranslationParams) => string;
type MindMapPreviewKind = "image" | "video" | "pdf" | "text" | "powerpoint";
type ReviewAnnotationMode = "pointer" | "note";
type ReviewAnnotation = {
  id: string;
  kind: ReviewAnnotationMode;
  x: number;
  y: number;
  text: string | null;
};
const PDF_MAX_RENDER_WIDTH = 1040;
const PDF_MAX_DEVICE_SCALE = 2;
const pdfWorkerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();

type PdfPreviewStatus = "idle" | "loading" | "ready" | "error";

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
  return pdfjs;
}

function createAnnotationId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clampInRange(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildAnnotationCoordinates(
  event: ReactMouseEvent<HTMLDivElement>,
  mode: ReviewAnnotationMode
) {
  const bounds = event.currentTarget.getBoundingClientRect();
  const rawX = bounds.width > 0 ? (event.clientX - bounds.left) / bounds.width : 0.5;
  const rawY = bounds.height > 0 ? (event.clientY - bounds.top) / bounds.height : 0.5;
  return {
    x: clampInRange(rawX, 0.04, mode === "note" ? 0.76 : 0.96),
    y: clampInRange(rawY, 0.05, 0.95)
  };
}

function isTypingElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName;
  return tagName === "INPUT" || tagName === "TEXTAREA" || target.isContentEditable;
}

function ReviewAnnotationSurface({
  surfaceKey,
  annotations,
  mode,
  noteDraft,
  removeAnnotationLabel,
  onAddAnnotation,
  onRemoveAnnotation,
  className = "",
  children
}: {
  surfaceKey: string;
  annotations: ReviewAnnotation[];
  mode: ReviewAnnotationMode | null;
  noteDraft: string;
  removeAnnotationLabel: string;
  onAddAnnotation: (surfaceKey: string, annotation: ReviewAnnotation) => void;
  onRemoveAnnotation: (surfaceKey: string, annotationId: string) => void;
  className?: string;
  children: ReactNode;
}) {
  const canPlace = mode === "pointer" || (mode === "note" && noteDraft.trim().length > 0);

  const handleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!mode || !canPlace) return;
    if (event.target instanceof HTMLElement && event.target.closest("[data-annotation-chip='true']")) {
      return;
    }
    const coordinates = buildAnnotationCoordinates(event, mode);
    onAddAnnotation(surfaceKey, {
      id: createAnnotationId(),
      kind: mode,
      x: coordinates.x,
      y: coordinates.y,
      text: mode === "note" ? noteDraft.trim() : null
    });
  };

  return (
    <div
      className={`relative ${mode ? "cursor-crosshair" : ""} ${className}`.trim()}
      onClick={handleClick}
    >
      {children}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {annotations.map((annotation) =>
          annotation.kind === "pointer" ? (
            <button
              key={annotation.id}
              type="button"
              data-annotation-chip="true"
              aria-label={removeAnnotationLabel}
              className="pointer-events-auto absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(118,223,255,0.9)] bg-[rgba(15,135,188,0.2)] shadow-[0_0_0_1px_rgba(6,29,46,0.52),0_0_26px_rgba(82,201,255,0.34)]"
              style={{
                left: `${annotation.x * 100}%`,
                top: `${annotation.y * 100}%`
              }}
              onClick={(event) => {
                event.stopPropagation();
                onRemoveAnnotation(surfaceKey, annotation.id);
              }}
            >
              <span
                aria-hidden="true"
                className="absolute inset-[3px] rounded-full border border-[rgba(132,229,255,0.65)]"
              />
              <span
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--ode-accent)]"
              />
            </button>
          ) : (
            <button
              key={annotation.id}
              type="button"
              data-annotation-chip="true"
              aria-label={removeAnnotationLabel}
              className="pointer-events-auto absolute max-w-[220px] -translate-y-1/2 rounded-xl border border-[rgba(255,214,102,0.6)] bg-[rgba(61,38,6,0.92)] px-3 py-1.5 text-left text-[0.82rem] font-medium leading-5 text-[#ffe7a4] shadow-[0_12px_26px_rgba(0,0,0,0.28)]"
              style={{
                left: `${annotation.x * 100}%`,
                top: `${annotation.y * 100}%`
              }}
              onClick={(event) => {
                event.stopPropagation();
                onRemoveAnnotation(surfaceKey, annotation.id);
              }}
            >
              <span aria-hidden="true" className="mr-2 inline-block h-2 w-2 rounded-full bg-[#ffd36a]" />
              <span>{annotation.text}</span>
            </button>
          )
        )}
      </div>
    </div>
  );
}

function PdfScrollPreview({
  src,
  filePath,
  title,
  loadingLabel,
  unavailableLabel,
  annotationMode,
  annotationNoteDraft,
  annotationSurfacePrefix,
  annotationsBySurface,
  removeAnnotationLabel,
  onAddAnnotation,
  onRemoveAnnotation
}: {
  src: string;
  filePath: string | null;
  title: string;
  loadingLabel: string;
  unavailableLabel: string;
  annotationMode: ReviewAnnotationMode | null;
  annotationNoteDraft: string;
  annotationSurfacePrefix: string;
  annotationsBySurface: Record<string, ReviewAnnotation[]>;
  removeAnnotationLabel: string;
  onAddAnnotation: (surfaceKey: string, annotation: ReviewAnnotation) => void;
  onRemoveAnnotation: (surfaceKey: string, annotationId: string) => void;
}) {
  const [status, setStatus] = useState<PdfPreviewStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [renderWidth, setRenderWidth] = useState(PDF_MAX_RENDER_WIDTH);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    let loadedDocument: PDFDocumentProxy | null = null;

    setStatus("loading");
    setError(null);
    setPageCount(0);
    setPdfDocument(null);
    canvasRefs.current = [];

    void (async () => {
      try {
        const pdfjs = await loadPdfJs();
        let data: Uint8Array;
        if (filePath) {
          const dataUrl = await readLocalFileDataUrl(filePath);
          if (!dataUrl) {
            throw new Error("PDF preview file is unavailable.");
          }
          const response = await fetch(dataUrl);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          data = new Uint8Array(await response.arrayBuffer());
        } else {
          const response = await fetch(src);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          data = new Uint8Array(await response.arrayBuffer());
        }
        const documentProxy = await pdfjs.getDocument({ data }).promise;
        if (cancelled) {
          void documentProxy.destroy();
          return;
        }
        loadedDocument = documentProxy;
        setPdfDocument(documentProxy);
        setPageCount(documentProxy.numPages);
        setStatus("ready");
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        if (cancelled) return;
        setError(message);
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      const documentToDestroy = loadedDocument;
      loadedDocument = null;
      if (documentToDestroy) {
        void documentToDestroy.destroy();
      }
    };
  }, [filePath, src]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const syncWidth = () => {
      const nextWidth = Math.max(320, Math.min(PDF_MAX_RENDER_WIDTH, Math.floor(container.clientWidth - 24)));
      setRenderWidth((current) => (current === nextWidth ? current : nextWidth));
    };

    syncWidth();
    const observer = new ResizeObserver(syncWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, [pageCount, status]);

  useEffect(() => {
    if (!pdfDocument || pageCount === 0 || status !== "ready") return;

    let cancelled = false;
    const renderTasks: Array<{ cancel: () => void }> = [];

    void (async () => {
      try {
        await new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));
        for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
          if (cancelled) return;
          const page = await pdfDocument.getPage(pageIndex + 1);
          const canvas = canvasRefs.current[pageIndex];
          if (!canvas) {
            page.cleanup();
            continue;
          }
          const context = canvas.getContext("2d");
          if (!context) {
            page.cleanup();
            continue;
          }

          const baseViewport = page.getViewport({ scale: 1 });
          const cssScale = renderWidth / baseViewport.width;
          const viewport = page.getViewport({ scale: cssScale });
          const outputScale = Math.min(window.devicePixelRatio || 1, PDF_MAX_DEVICE_SCALE);

          canvas.width = Math.floor(viewport.width * outputScale);
          canvas.height = Math.floor(viewport.height * outputScale);
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;

          const renderTask = page.render({
            canvas,
            canvasContext: context,
            viewport,
            transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0]
          });
          renderTasks.push(renderTask);
          await renderTask.promise;
          page.cleanup();
        }
      } catch (cause) {
        const maybeRenderingCancelled =
          typeof cause === "object" &&
          cause !== null &&
          "name" in cause &&
          (cause as { name?: string }).name === "RenderingCancelledException";
        if (cancelled || maybeRenderingCancelled) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      for (const task of renderTasks) {
        task.cancel();
      }
    };
  }, [pageCount, pdfDocument, renderWidth, status]);

  if (status === "loading" || status === "idle") {
    return (
      <div className="ode-preview-surface flex min-h-[60vh] items-center justify-center rounded-[22px] text-[0.96rem] text-[var(--ode-text-muted)]">
        {loadingLabel}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed border-[var(--ode-border-strong)] bg-[var(--ode-preview-surface)] px-6 text-center text-[0.96rem] text-[var(--ode-text-muted)]">
        <span>{unavailableLabel}</span>
        {error ? <span className="max-w-3xl text-[0.84rem] leading-6 text-[var(--ode-text-dim)]">{error}</span> : null}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="ode-preview-surface rounded-[22px] p-3"
    >
      <div className="mx-auto flex max-w-[1040px] flex-col gap-5">
        {Array.from({ length: pageCount }, (_, pageIndex) => {
          const surfaceKey = `${annotationSurfacePrefix}:page-${pageIndex + 1}`;
          return (
            <ReviewAnnotationSurface
              key={`pdf-page-${pageIndex + 1}`}
              surfaceKey={surfaceKey}
              annotations={annotationsBySurface[surfaceKey] ?? []}
              mode={annotationMode}
              noteDraft={annotationNoteDraft}
              removeAnnotationLabel={removeAnnotationLabel}
              onAddAnnotation={onAddAnnotation}
              onRemoveAnnotation={onRemoveAnnotation}
              className="overflow-hidden rounded-[18px] border border-[rgba(255,255,255,0.06)] bg-white shadow-[0_18px_46px_rgba(0,0,0,0.34)]"
            >
              <canvas
                ref={(element) => {
                  canvasRefs.current[pageIndex] = element;
                }}
                aria-label={`${title} page ${pageIndex + 1}`}
                className="block w-full"
              />
            </ReviewAnnotationSurface>
          );
        })}
      </div>
    </div>
  );
}

interface MindMapFileReviewModalProps {
  open: boolean;
  t: TranslateFn;
  node: AppNode | null;
  previewKind: MindMapPreviewKind | null;
  previewSrc: string | null;
  powerPointSlideSrcs: string[];
  previewText: string | null;
  previewLoading: boolean;
  previewError: string | null;
  nodeTypeLabel: string | null;
  sizeLabel: string | null;
  modifiedLabel: string | null;
  onOpenExternal: () => void;
  onClose: () => void;
}

export function MindMapFileReviewModal({
  open,
  t,
  node,
  previewKind,
  previewSrc,
  powerPointSlideSrcs,
  previewText,
  previewLoading,
  previewError,
  nodeTypeLabel,
  sizeLabel,
  modifiedLabel,
  onOpenExternal,
  onClose
}: MindMapFileReviewModalProps) {
  const { surfaceRef, surfaceStyle, handlePointerDown } = useDraggableModalSurface({ open });
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [activeImageDataUrl, setActiveImageDataUrl] = useState<string | null>(null);
  const [activeImageLoading, setActiveImageLoading] = useState(false);
  const [activeImageError, setActiveImageError] = useState<string | null>(null);
  const [activeSlideDataUrl, setActiveSlideDataUrl] = useState<string | null>(null);
  const [activeSlideLoading, setActiveSlideLoading] = useState(false);
  const [activeSlideError, setActiveSlideError] = useState<string | null>(null);
  const [annotationMode, setAnnotationMode] = useState<ReviewAnnotationMode | null>(null);
  const [annotationNoteDraft, setAnnotationNoteDraft] = useState("");
  const [annotationsBySurface, setAnnotationsBySurface] = useState<Record<string, ReviewAnnotation[]>>({});
  const imageDataUrlCacheRef = useRef<Map<string, string>>(new Map());
  const slideDataUrlCacheRef = useRef<Map<string, string>>(new Map());
  const slideCount = powerPointSlideSrcs.length;
  const previewFilePath = useMemo(() => (node ? getNodeMirrorFilePath(node) ?? null : null), [node]);
  const activeSlidePath =
    slideCount > 0 ? powerPointSlideSrcs[Math.max(0, Math.min(currentSlideIndex, slideCount - 1))] : null;
  const slideLabel = useMemo(
    () => t("desktop.mindmap_review_slide_label", { current: currentSlideIndex + 1, total: slideCount }),
    [currentSlideIndex, slideCount, t]
  );
  const imageSurfaceKey = useMemo(
    () => (node ? `review:${node.id}:image` : "review:image"),
    [node]
  );
  const slideSurfaceKey = useMemo(
    () =>
      node
        ? `review:${node.id}:powerpoint:${activeSlidePath ?? currentSlideIndex + 1}`
        : `review:powerpoint:${activeSlidePath ?? currentSlideIndex + 1}`,
    [activeSlidePath, currentSlideIndex, node]
  );
  const pdfSurfacePrefix = useMemo(
    () => (node ? `review:${node.id}:pdf` : "review:pdf"),
    [node]
  );
  const currentAnnotationSurfaceKey =
    previewKind === "image" ? imageSurfaceKey : previewKind === "powerpoint" ? slideSurfaceKey : null;
  const totalAnnotationCount = useMemo(
    () =>
      Object.values(annotationsBySurface).reduce((count, annotations) => count + annotations.length, 0),
    [annotationsBySurface]
  );
  const canAnnotate =
    previewKind === "image" || previewKind === "pdf" || previewKind === "powerpoint";

  useEffect(() => {
    setCurrentSlideIndex(0);
  }, [node?.id, slideCount]);

  useEffect(() => {
    setAnnotationMode(null);
    setAnnotationNoteDraft("");
    setAnnotationsBySurface({});
  }, [node?.id]);

  useEffect(() => {
    if (previewKind !== "image") {
      setActiveImageDataUrl(null);
      setActiveImageLoading(false);
      setActiveImageError(null);
      return;
    }

    if (!previewFilePath) {
      setActiveImageDataUrl(previewSrc);
      setActiveImageLoading(false);
      setActiveImageError(previewSrc ? null : "Image preview file is unavailable.");
      return;
    }

    const cached = imageDataUrlCacheRef.current.get(previewFilePath);
    if (cached) {
      setActiveImageDataUrl(cached);
      setActiveImageLoading(false);
      setActiveImageError(null);
      return;
    }

    let cancelled = false;
    setActiveImageDataUrl(null);
    setActiveImageLoading(true);
    setActiveImageError(null);

    void readLocalImageDataUrl(previewFilePath)
      .then((dataUrl) => {
        if (cancelled) return;
        if (!dataUrl) {
          setActiveImageError("Image preview file is unavailable.");
          setActiveImageLoading(false);
          return;
        }
        imageDataUrlCacheRef.current.set(previewFilePath, dataUrl);
        setActiveImageDataUrl(dataUrl);
        setActiveImageLoading(false);
      })
      .catch((cause) => {
        if (cancelled) return;
        setActiveImageError(cause instanceof Error ? cause.message : String(cause));
        setActiveImageLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [previewFilePath, previewKind, previewSrc]);

  useEffect(() => {
    if (previewKind !== "powerpoint" || !activeSlidePath) {
      setActiveSlideDataUrl(null);
      setActiveSlideLoading(false);
      setActiveSlideError(null);
      return;
    }

    const cached = slideDataUrlCacheRef.current.get(activeSlidePath);
    if (cached) {
      setActiveSlideDataUrl(cached);
      setActiveSlideLoading(false);
      setActiveSlideError(null);
      return;
    }

    let cancelled = false;
    setActiveSlideDataUrl(null);
    setActiveSlideLoading(true);
    setActiveSlideError(null);

    void readLocalImageDataUrl(activeSlidePath)
      .then((dataUrl) => {
        if (cancelled) return;
        if (!dataUrl) {
          setActiveSlideError("Slide preview image is unavailable.");
          setActiveSlideLoading(false);
          return;
        }
        slideDataUrlCacheRef.current.set(activeSlidePath, dataUrl);
        setActiveSlideDataUrl(dataUrl);
        setActiveSlideLoading(false);
      })
      .catch((cause) => {
        if (cancelled) return;
        setActiveSlideError(cause instanceof Error ? cause.message : String(cause));
        setActiveSlideLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSlidePath, previewKind]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingElement(event.target)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (previewKind !== "powerpoint" || slideCount <= 1) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setCurrentSlideIndex((current) => Math.max(0, current - 1));
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        setCurrentSlideIndex(0);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setCurrentSlideIndex((current) => Math.min(slideCount - 1, current + 1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, previewKind, slideCount]);

  const addAnnotation = (surfaceKey: string, annotation: ReviewAnnotation) => {
    setAnnotationsBySurface((current) => ({
      ...current,
      [surfaceKey]: [...(current[surfaceKey] ?? []), annotation]
    }));
  };

  const removeAnnotation = (surfaceKey: string, annotationId: string) => {
    setAnnotationsBySurface((current) => {
      const nextSurfaceAnnotations = (current[surfaceKey] ?? []).filter(
        (annotation) => annotation.id !== annotationId
      );
      if (nextSurfaceAnnotations.length === 0) {
        const { [surfaceKey]: _removed, ...rest } = current;
        return rest;
      }
      return {
        ...current,
        [surfaceKey]: nextSurfaceAnnotations
      };
    });
  };

  const clearAllAnnotations = () => {
    setAnnotationsBySurface({});
  };

  const clearCurrentAnnotations = () => {
    if (!currentAnnotationSurfaceKey) return;
    setAnnotationsBySurface((current) => {
      const { [currentAnnotationSurfaceKey]: _removed, ...rest } = current;
      return rest;
    });
  };

  if (!open || !node) return null;

  return (
    <div
      className="ode-overlay-scrim fixed inset-0 z-[175] flex items-center justify-center p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return;
        onClose();
      }}
    >
      <div
        ref={surfaceRef}
        style={surfaceStyle}
        className="ode-modal flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] border border-[var(--ode-border-strong)]"
      >
        <div
          className="ode-modal-drag-handle flex items-start justify-between gap-4 border-b border-[var(--ode-border)] px-6 py-5"
          onPointerDown={handlePointerDown}
        >
          <div className="min-w-0">
            <p className="text-[0.76rem] uppercase tracking-[0.14em] text-[var(--ode-accent)]">
              {t("desktop.mindmap_review_title")}
            </p>
            <div className="mt-3 flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--ode-border)] bg-[rgba(5,29,46,0.5)]">
                <NodeGlyph node={node} active={false} />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-[1.12rem] font-semibold tracking-tight text-[var(--ode-text)]">
                  {node.name}
                </h2>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[0.86rem] text-[var(--ode-text-dim)]">
                  {nodeTypeLabel ? <span>{nodeTypeLabel}</span> : null}
                  {sizeLabel ? (
                    <span>
                      {t("details.size")}: {sizeLabel}
                    </span>
                  ) : null}
                  {modifiedLabel ? (
                    <span>
                      {t("details.modified")}: {modifiedLabel}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          <button type="button" className="ode-icon-btn h-10 w-10" onClick={onClose} aria-label={t("settings.cancel")}>
            x
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
          <div className="space-y-4">
            {canAnnotate ? (
              <div className="flex flex-wrap items-center gap-2 rounded-[18px] border border-[var(--ode-border)] bg-[rgba(4,24,40,0.52)] px-4 py-3">
                <button
                  type="button"
                  className={`ode-mini-btn h-9 px-3 ${annotationMode === "pointer" ? "ode-mini-btn-active" : ""}`}
                  onClick={() =>
                    setAnnotationMode((current) => (current === "pointer" ? null : "pointer"))
                  }
                >
                  {t("desktop.mindmap_review_pointer")}
                </button>
                <button
                  type="button"
                  className={`ode-mini-btn h-9 px-3 ${annotationMode === "note" ? "ode-mini-btn-active" : ""}`}
                  onClick={() =>
                    setAnnotationMode((current) => (current === "note" ? null : "note"))
                  }
                >
                  {t("desktop.mindmap_review_note")}
                </button>
                {annotationMode === "note" ? (
                  <input
                    type="text"
                    className="ode-input h-9 min-w-[220px] flex-1 rounded-lg px-3 text-[0.9rem]"
                    value={annotationNoteDraft}
                    onChange={(event) => setAnnotationNoteDraft(event.target.value)}
                    placeholder={t("desktop.mindmap_review_note_placeholder")}
                  />
                ) : null}
                {currentAnnotationSurfaceKey ? (
                  <button
                    type="button"
                    className="ode-text-btn h-9 px-3"
                    onClick={clearCurrentAnnotations}
                    disabled={!annotationsBySurface[currentAnnotationSurfaceKey]?.length}
                  >
                    {t("desktop.mindmap_review_clear_current")}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="ode-text-btn h-9 px-3"
                  onClick={clearAllAnnotations}
                  disabled={totalAnnotationCount === 0}
                >
                  {t("desktop.mindmap_review_clear_all")}
                </button>
              </div>
            ) : null}

            {previewLoading ? (
              <div className="ode-preview-surface flex min-h-[60vh] items-center justify-center rounded-[22px] text-[0.96rem] text-[var(--ode-text-muted)]">
                {t("desktop.mindmap_review_loading")}
              </div>
            ) : previewKind === "image" ? (
              <div className="ode-preview-surface flex min-h-[60vh] items-center justify-center rounded-[22px] p-4">
                {activeImageLoading ? (
                  <div className="text-[0.96rem] text-[var(--ode-text-muted)]">
                    {t("desktop.mindmap_review_loading")}
                  </div>
                ) : activeImageDataUrl ? (
                  <ReviewAnnotationSurface
                    surfaceKey={imageSurfaceKey}
                    annotations={annotationsBySurface[imageSurfaceKey] ?? []}
                    mode={annotationMode}
                    noteDraft={annotationNoteDraft}
                    removeAnnotationLabel={t("desktop.mindmap_review_remove_annotation")}
                    onAddAnnotation={addAnnotation}
                    onRemoveAnnotation={removeAnnotation}
                    className="inline-block"
                  >
                    <img
                      src={activeImageDataUrl}
                      alt={node.name}
                      className="max-h-[72vh] max-w-full rounded-[18px] object-contain shadow-[0_18px_46px_rgba(0,0,0,0.34)]"
                      draggable={false}
                    />
                  </ReviewAnnotationSurface>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center text-[0.96rem] text-[var(--ode-text-muted)]">
                    <span>{t("desktop.mindmap_review_unavailable")}</span>
                    {activeImageError ? (
                      <span className="max-w-3xl text-[0.84rem] leading-6 text-[var(--ode-text-dim)]">{activeImageError}</span>
                    ) : null}
                  </div>
                )}
              </div>
            ) : previewKind === "video" && previewSrc ? (
              <div className="ode-preview-surface rounded-[22px] p-4">
                <video
                  src={previewSrc}
                  className="h-[72vh] w-full rounded-[18px] bg-black object-contain"
                  controls
                  preload="metadata"
                />
              </div>
            ) : previewKind === "pdf" && previewSrc ? (
              <PdfScrollPreview
                src={previewSrc}
                filePath={previewFilePath}
                title={node.name}
                loadingLabel={t("desktop.mindmap_review_loading")}
                unavailableLabel={t("desktop.mindmap_review_unavailable")}
                annotationMode={annotationMode}
                annotationNoteDraft={annotationNoteDraft}
                annotationSurfacePrefix={pdfSurfacePrefix}
                annotationsBySurface={annotationsBySurface}
                removeAnnotationLabel={t("desktop.mindmap_review_remove_annotation")}
                onAddAnnotation={addAnnotation}
                onRemoveAnnotation={removeAnnotation}
              />
            ) : previewKind === "powerpoint" && activeSlidePath ? (
              <div className="ode-preview-surface rounded-[22px] p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="text-[0.92rem] text-[var(--ode-text-dim)]">{slideLabel}</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="ode-text-btn h-10 px-4"
                      onClick={() => setCurrentSlideIndex(0)}
                      disabled={currentSlideIndex <= 0}
                    >
                      {t("desktop.mindmap_review_first_slide")}
                    </button>
                    <button
                      type="button"
                      className="ode-text-btn h-10 px-4"
                      onClick={() => setCurrentSlideIndex((current) => Math.max(0, current - 1))}
                      disabled={currentSlideIndex <= 0}
                    >
                      {t("desktop.mindmap_review_prev_slide")}
                    </button>
                    <button
                      type="button"
                      className="ode-primary-btn h-10 px-4"
                      onClick={() => setCurrentSlideIndex((current) => Math.min(slideCount - 1, current + 1))}
                      disabled={currentSlideIndex >= slideCount - 1}
                    >
                      {t("desktop.mindmap_review_next_slide")}
                    </button>
                  </div>
                </div>
                <div className="flex min-h-[68vh] items-center justify-center rounded-[18px] bg-[rgba(2,12,23,0.82)] p-4">
                  {activeSlideLoading ? (
                    <div className="text-[0.96rem] text-[var(--ode-text-muted)]">
                      {t("desktop.mindmap_review_loading")}
                    </div>
                  ) : activeSlideDataUrl ? (
                    <ReviewAnnotationSurface
                      surfaceKey={slideSurfaceKey}
                      annotations={annotationsBySurface[slideSurfaceKey] ?? []}
                      mode={annotationMode}
                      noteDraft={annotationNoteDraft}
                      removeAnnotationLabel={t("desktop.mindmap_review_remove_annotation")}
                      onAddAnnotation={addAnnotation}
                      onRemoveAnnotation={removeAnnotation}
                      className="inline-block"
                    >
                      <img
                        src={activeSlideDataUrl}
                        alt={`${node.name} - ${slideLabel}`}
                        className="max-h-[72vh] max-w-full rounded-[12px] object-contain shadow-[0_18px_46px_rgba(0,0,0,0.34)]"
                        draggable={false}
                      />
                    </ReviewAnnotationSurface>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-center text-[0.96rem] text-[var(--ode-text-muted)]">
                      <span>{t("desktop.mindmap_review_unavailable")}</span>
                      {activeSlideError ? (
                        <span className="max-w-3xl text-[0.84rem] leading-6 text-[var(--ode-text-dim)]">{activeSlideError}</span>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            ) : previewKind === "text" ? (
              <div className="ode-preview-surface rounded-[22px] p-4">
                {typeof previewText === "string" && previewText.trim().length > 0 ? (
                  <pre className="max-h-[72vh] overflow-auto whitespace-pre-wrap break-words rounded-[16px] bg-[rgba(2,12,23,0.82)] px-4 py-4 text-[0.92rem] leading-7 text-[var(--ode-text)]">
                    {previewText}
                  </pre>
                ) : (
                  <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 rounded-[16px] border border-dashed border-[var(--ode-border-strong)] bg-[rgba(2,12,23,0.42)] px-6 text-center text-[0.96rem] text-[var(--ode-text-muted)]">
                    <span>{t("desktop.mindmap_review_empty_text")}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed border-[var(--ode-border-strong)] bg-[var(--ode-preview-surface)] px-6 text-center text-[0.96rem] text-[var(--ode-text-muted)]">
                <span>{t("desktop.mindmap_review_unavailable")}</span>
                {previewError ? (
                  <span className="max-w-3xl text-[0.84rem] leading-6 text-[var(--ode-text-dim)]">{previewError}</span>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--ode-border)] px-6 py-4">
          <button type="button" className="ode-text-btn h-11 px-5" onClick={onClose}>
            {t("settings.cancel")}
          </button>
          <button type="button" className="ode-primary-btn h-11 px-5" onClick={onOpenExternal}>
            {t("desktop.mindmap_review_open_external")}
          </button>
        </div>
      </div>
    </div>
  );
}
