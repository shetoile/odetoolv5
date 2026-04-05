import React, { useState, useEffect, useMemo } from "react";
import { AppNode, FolderNodeState, DesktopStateFilter, ScheduleStatus, isFileLikeNode } from "@/lib/types";
import { isTauri } from "@tauri-apps/api/core";
import { LanguageCode, TranslationParams, translate, getLocaleForLanguage } from "@/lib/i18n";
import {
  getNodeMirrorFilePath,
  buildWindowsFileIconCacheKey,
  resolveWindowsFileIcon,
  WINDOWS_FILE_ICON_SIZE,
  WINDOWS_FILE_ICON_CACHE,
  extractFileExtensionLabel,
  getDesktopMediaPreviewKind,
  resolveDesktopPreviewSrc
} from "@/lib/iconSupport";

export function FolderGlyph({ active = true, state = "empty" }: { active?: boolean; state?: FolderNodeState }) {
  const isEmpty = state === "empty";
  const isScheduled = state === "task_only" || state === "filled";
  const palette =
    state === "task_only"
      ? {
        stroke: active ? "#3fd17b" : "#79a88c",
        fill: active ? "rgba(21,120,62,0.3)" : "rgba(27,72,48,0.2)",
        check: active ? "#bcf8d2" : "#9ecab0"
      }
      : state === "data_only"
        ? {
          stroke: active ? "#43c3e9" : "#7ca8bb",
          fill: active ? "rgba(25,111,145,0.28)" : "rgba(30,65,84,0.18)",
          check: active ? "#43c3e9" : "#7ca8bb"
        }
        : state === "filled"
          ? {
            stroke: active ? "#ffd84d" : "#c9ac56",
            fill: active ? "rgba(255,214,84,0.58)" : "rgba(172,142,67,0.34)",
            check: active ? "#3a2d08" : "#4c3b12"
          }
          : {
            stroke: active ? "#f26f6f" : "#b08282",
            fill: "transparent",
            check: active ? "#f26f6f" : "#b08282"
          };

  if (isEmpty) {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        <path
          d="M3.8 9.1V7.5A2.3 2.3 0 0 1 6.1 5.2h2.6l1.4 1.7h7.7a2.3 2.3 0 0 1 2.3 2.2"
          fill="none"
          stroke={palette.stroke}
          strokeWidth="1.55"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M3.6 10.2h16.8l-1.2 6a2.2 2.2 0 0 1-2.2 1.8H6.9a2.2 2.2 0 0 1-2.2-1.8l-1.1-5.5Z"
          fill="none"
          stroke={palette.stroke}
          strokeWidth="1.55"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l1.4 1.8H18.5A2.5 2.5 0 0 1 21 9.3V16.5A2.5 2.5 0 0 1 18.5 19H5.5A2.5 2.5 0 0 1 3 16.5Z"
        fill={palette.fill}
        stroke={palette.stroke}
        strokeWidth="1.6"
      />
      {isScheduled ? (
        <path
          d="M8.2 12.6 10.4 14.7 15.4 10"
          fill="none"
          stroke={palette.check}
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
}

export function WindowsFolderFilterGlyph({ active = true, mode = "all" }: { active?: boolean; mode?: DesktopStateFilter }) {
  const state: FolderNodeState =
    mode === "empty" ? "empty" : mode === "task" ? "task_only" : mode === "data" ? "data_only" : "filled";
  return <FolderGlyph active={active} state={state} />;
}


export function FileGlyph({
  active = true,
  extension,
  iconDataUrl,
  showExtensionFallback = true,
  showPlaceholderGlyph = true
}: {
  active?: boolean;
  extension: string;
  iconDataUrl?: string | null;
  showExtensionFallback?: boolean;
  showPlaceholderGlyph?: boolean;
}) {
  const stroke = active ? "#4ec8f3" : "#8ba9c2";
  const fill = active ? "rgba(32,138,195,0.3)" : "rgba(17,52,77,0.24)";
  const foldFill = active ? "rgba(109,225,255,0.45)" : "rgba(94,133,160,0.32)";
  return (
    <span className="ode-node-glyph" aria-hidden>
      {iconDataUrl ? (
        <span className={`ode-native-file-icon-shell ${active ? "ode-native-file-icon-shell-active" : ""}`}>
          <img src={iconDataUrl} className="ode-native-file-icon" alt="" draggable={false} />
        </span>
      ) : showPlaceholderGlyph ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5">
          <path
            d="M7.1 3.8h7.4l4.4 4.4v11.1a1.9 1.9 0 0 1-1.9 1.9H7.1a1.9 1.9 0 0 1-1.9-1.9V5.7a1.9 1.9 0 0 1 1.9-1.9Z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.55"
            strokeLinejoin="round"
          />
          <path d="M14.5 3.8v4.4h4.4" fill={foldFill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      ) : (
        <span className="ode-native-file-icon-shell" style={{ opacity: 0 }} />
      )}
      {!iconDataUrl && showExtensionFallback && extension ? (
        <span className={`ode-file-ext-pill ${active ? "ode-file-ext-pill-active" : ""}`}>{extension}</span>
      ) : null}
    </span>
  );
}

export function TicketGlyph({ active = true }: { active?: boolean }) {
  const stroke = active ? "#ff7e5f" : "#c18a7c";
  const fill = active ? "rgba(255,126,95,0.22)" : "rgba(102,63,54,0.18)";
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        d="M2 9V15C2 17.2 3.8 19 6 19H18C20.2 19 22 17.2 22 15V9C22 6.8 20.2 5 18 5H6C3.8 5 2 6.8 2 9Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.6"
      />
      <path
        d="M2 9L12 13L22 9"
        fill="none"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type WorkareaItemGlyphKind = "deliverable" | "task" | "subtask";
type ProcedureItemGlyphKind = "section" | "text" | "field" | "attachment";

function readWorkareaItemKind(node: AppNode): WorkareaItemGlyphKind | null {
  const kind = node.properties?.odeWorkareaItemKind;
  if (kind === "deliverable" || kind === "task" || kind === "subtask") {
    return kind;
  }
  return null;
}

function isDocumentationWorkspaceRootNode(node: AppNode): boolean {
  return node.properties?.odeWorkspaceScopeKind === "documentation_root";
}

function readProcedureItemGlyphKind(node: AppNode): ProcedureItemGlyphKind | null {
  const itemType = node.properties?.odeProcedureItemType;
  if (itemType === "section" || itemType === "text" || itemType === "field" || itemType === "attachment") {
    return itemType;
  }
  if (typeof node.properties?.odeProcedureFieldType === "string" && node.properties.odeProcedureFieldType.trim().length > 0) {
    return "field";
  }
  return null;
}

function readWorkareaStatus(node: AppNode): ScheduleStatus {
  const displayStatus = node.properties?.odeWorkareaDisplayStatus;
  if (displayStatus === "active" || displayStatus === "blocked" || displayStatus === "done") {
    return displayStatus;
  }
  const timelineStatus =
    node.properties?.timelineSchedule && typeof node.properties.timelineSchedule === "object"
      ? (node.properties.timelineSchedule as Record<string, unknown>).status
      : null;
  if (timelineStatus === "active" || timelineStatus === "blocked" || timelineStatus === "done") {
    return timelineStatus;
  }
  const propertyStatus = node.properties?.odeExecutionTaskStatus;
  if (propertyStatus === "active" || propertyStatus === "blocked" || propertyStatus === "done") {
    return propertyStatus;
  }
  return "planned";
}

function getWorkareaPalette(status: ScheduleStatus, active: boolean) {
  if (status === "active") {
    return {
      stroke: active ? "#f5b46c" : "#cda173",
      fill: active ? "rgba(158,104,39,0.24)" : "rgba(98,56,17,0.18)",
      accent: active ? "#ffe7c7" : "#e2bf97"
    };
  }
  if (status === "blocked") {
    return {
      stroke: active ? "#d26e81" : "#a9808a",
      fill: active ? "rgba(72,32,42,0.24)" : "rgba(31,13,18,0.18)",
      accent: active ? "#ffd7df" : "#d5b7bf"
    };
  }
  if (status === "done") {
    return {
      stroke: active ? "#67d8a6" : "#7cae96",
      fill: active ? "rgba(30,110,75,0.24)" : "rgba(16,62,44,0.18)",
      accent: active ? "#d8ffec" : "#b7dec8"
    };
  }
  return {
    stroke: active ? "#6dc4f3" : "#7ca8bb",
    fill: active ? "rgba(39,93,134,0.24)" : "rgba(18,51,79,0.18)",
    accent: active ? "#dff5ff" : "#aacde0"
  };
}

export function WorkareaDeliverableGlyph({
  active = true,
  status = "planned"
}: {
  active?: boolean;
  status?: ScheduleStatus;
}) {
  const palette = getWorkareaPalette(status, active);
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        d="M12 4.4 18.6 7.6 12 10.8 5.4 7.6Z"
        fill={palette.fill}
        stroke={palette.stroke}
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path
        d="M5.4 7.6v8.1L12 19l6.6-3.3V7.6"
        fill="none"
        stroke={palette.stroke}
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path d="M12 10.8V19" fill="none" stroke={palette.accent} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8.8 6 15.2 9.1" fill="none" stroke={palette.accent} strokeWidth="1.45" strokeLinecap="round" />
    </svg>
  );
}

export function WorkareaTaskGlyph({
  active = true,
  status = "planned"
}: {
  active?: boolean;
  status?: ScheduleStatus;
}) {
  const palette = getWorkareaPalette(status, active);
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <rect x="5.6" y="4.8" width="13.4" height="14.4" rx="2.3" fill={palette.fill} stroke={palette.stroke} strokeWidth="1.55" />
      <path d="M9.1 8.7h6M9.1 12h6M9.1 15.3h4.1" fill="none" stroke={palette.accent} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7.3 12.1l.9.9 1.4-1.4" fill="none" stroke={palette.accent} strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 4.8h6v2.1H9z" fill={palette.fill} stroke={palette.stroke} strokeWidth="1.35" strokeLinejoin="round" />
    </svg>
  );
}

export function WorkareaSubtaskGlyph({
  active = true,
  status = "planned"
}: {
  active?: boolean;
  status?: ScheduleStatus;
}) {
  const palette = getWorkareaPalette(status, active);
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        d="M4.7 7.2v7.1a1.8 1.8 0 0 0 1.8 1.8H8"
        fill="none"
        stroke={palette.stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="4.7" cy="7.2" r="1.1" fill={palette.stroke} />
      <rect x="8.2" y="6.1" width="10.9" height="11.8" rx="2" fill={palette.fill} stroke={palette.stroke} strokeWidth="1.5" />
      <path d="M11.1 9.5h4.8M11.1 12.4h4.8M11.1 15.3h3.2" fill="none" stroke={palette.accent} strokeWidth="1.45" strokeLinecap="round" />
      <path d="M9.9 12.4l.7.7 1.1-1.1" fill="none" stroke={palette.accent} strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DatabaseRootGlyph({ active = true }: { active?: boolean }) {
  const stroke = active ? "#3cd2f2" : "#7aa5b6";
  const fill = active ? "rgba(18,93,121,0.24)" : "rgba(21,49,63,0.18)";
  const accent = active ? "#d8f8ff" : "#b6d2dc";
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <ellipse cx="12" cy="6.1" rx="6.8" ry="2.8" fill={fill} stroke={stroke} strokeWidth="1.5" />
      <path d="M5.2 6.1v8.7c0 1.6 3 2.9 6.8 2.9s6.8-1.3 6.8-2.9V6.1" fill="none" stroke={stroke} strokeWidth="1.5" />
      <path d="M5.2 10.2c0 1.6 3 2.9 6.8 2.9s6.8-1.3 6.8-2.9" fill="none" stroke={accent} strokeWidth="1.45" strokeLinecap="round" />
      <path d="M5.2 14.2c0 1.6 3 2.9 6.8 2.9s6.8-1.3 6.8-2.9" fill="none" stroke={accent} strokeWidth="1.45" strokeLinecap="round" />
    </svg>
  );
}

export function DatabaseSectionGlyph({ active = true }: { active?: boolean }) {
  const stroke = active ? "#58d7ff" : "#87a7b8";
  const fill = active ? "rgba(31,96,129,0.24)" : "rgba(21,45,58,0.18)";
  const accent = active ? "#dff7ff" : "#b7cfda";
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        d="M6.1 4.3h8.2l3.6 3.6v11.5a1.8 1.8 0 0 1-1.8 1.8H6.1a1.8 1.8 0 0 1-1.8-1.8V6.1a1.8 1.8 0 0 1 1.8-1.8Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path d="M14.3 4.3v3.8h3.6" fill="none" stroke={stroke} strokeWidth="1.45" strokeLinejoin="round" />
      <path d="M8.2 10.4h7.2M8.2 13.5h6.1M8.2 16.6h4.1" fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function DatabaseFieldGlyph({
  active = true,
  fieldType = "short_text"
}: {
  active?: boolean;
  fieldType?: string;
}) {
  const isTableField = fieldType === "table";
  const stroke = active ? (isTableField ? "#ffb454" : "#62d88f") : "#87a7b8";
  const fill = active
    ? (isTableField ? "rgba(184,111,28,0.26)" : "rgba(25,112,61,0.26)")
    : "rgba(22,45,58,0.18)";
  const accent = active ? (isTableField ? "#fff1d6" : "#e6ffef") : "#bfd5de";

  if (isTableField) {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        <rect x="4.6" y="5.4" width="14.8" height="13.2" rx="2" fill={fill} stroke={stroke} strokeWidth="1.55" />
        <path d="M4.8 10h14.4M9.6 5.6v12.8M14.4 5.6v12.8" fill="none" stroke={accent} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <rect x="4.8" y="6" width="14.4" height="12" rx="2.2" fill={fill} stroke={stroke} strokeWidth="1.55" />
      <path d="M7.8 10h8.4M7.8 14h4.8" fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="7.2" cy="14" r="1" fill={stroke} />
    </svg>
  );
}

export function ExecutionRootGlyph({
  active = true,
  status = "planned"
}: {
  active?: boolean;
  status?: ScheduleStatus;
}) {
  const palette = getWorkareaPalette(status, active);
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <rect x="4.2" y="5.2" width="15.6" height="13.6" rx="2.4" fill={palette.fill} stroke={palette.stroke} strokeWidth="1.55" />
      <path d="M8 9.1h8M8 12.1h5.3M8 15.1h3.8" fill="none" stroke={palette.accent} strokeWidth="1.45" strokeLinecap="round" />
      <path d="M15.6 13.8 18.4 16.6" fill="none" stroke={palette.accent} strokeWidth="1.45" strokeLinecap="round" />
      <circle cx="15.4" cy="13.6" r="2.4" fill="none" stroke={palette.accent} strokeWidth="1.45" />
    </svg>
  );
}

export function DashboardGlyph({ active = true }: { active?: boolean }) {
  const stroke = active ? "#5fd3ff" : "#87a7b8";
  const fill = active ? "rgba(25,109,150,0.22)" : "rgba(20,45,58,0.18)";
  const accent = active ? "#dff7ff" : "#bed5df";
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <rect x="4.6" y="5" width="14.8" height="14" rx="2.6" fill={fill} stroke={stroke} strokeWidth="1.55" />
      <path d="M8.1 14.8V11M12 14.8V8.7M15.9 14.8V10.2" fill="none" stroke={accent} strokeWidth="1.75" strokeLinecap="round" />
      <path d="M7.5 8.2h9" fill="none" stroke={stroke} strokeWidth="1.35" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

export function NodeGlyph({
  node,
  active = true,
  folderState,
  showExecutionOwnerGlyph = false
}: {
  node: AppNode;
  active?: boolean;
  folderState?: FolderNodeState | null;
  showExecutionOwnerGlyph?: boolean;
}) {
  const isFile = isFileLikeNode(node);
  const isExecutionTask = node.type === "task" && node.properties?.odeExecutionTask === true;
  const isStructuralTask = node.type === "task" && !isExecutionTask;
  const mirrorFilePath = isFile ? getNodeMirrorFilePath(node) : null;
  const iconKey = isFile ? buildWindowsFileIconCacheKey(mirrorFilePath, node.name, WINDOWS_FILE_ICON_SIZE) : "";
  const [iconDataUrl, setIconDataUrl] = useState<string | null>(() => {
    if (!isFile) return null;
    return WINDOWS_FILE_ICON_CACHE.get(iconKey) ?? null;
  });
  const [iconLoadState, setIconLoadState] = useState<"idle" | "loading" | "ready" | "unavailable">(() => {
    if (!isFile) return "idle";
    if (WINDOWS_FILE_ICON_CACHE.get(iconKey)) return "ready";
    return isTauri() ? "loading" : "unavailable";
  });

  useEffect(() => {
    if (!isFile) {
      setIconDataUrl(null);
      setIconLoadState("idle");
      return;
    }

    const cached = WINDOWS_FILE_ICON_CACHE.get(iconKey);
    if (cached) {
      setIconDataUrl(cached);
      setIconLoadState("ready");
      return;
    }

    if (!isTauri()) {
      setIconDataUrl(null);
      setIconLoadState("unavailable");
      return;
    }

    setIconDataUrl(null);
    setIconLoadState("loading");
    let cancelled = false;
    void resolveWindowsFileIcon(mirrorFilePath, node.name, WINDOWS_FILE_ICON_SIZE).then((icon) => {
      if (cancelled) return;
      setIconDataUrl(icon);
      setIconLoadState(icon ? "ready" : "unavailable");
    });
    return () => {
      cancelled = true;
    };
  }, [iconKey, isFile, mirrorFilePath, node.name]);

  if (isFile) {
    const showPlaceholderGlyph = iconLoadState === "unavailable" || !isTauri();
    return (
      <FileGlyph
        active={active}
        extension={extractFileExtensionLabel(node.name)}
        iconDataUrl={iconDataUrl}
        showExtensionFallback={iconLoadState === "unavailable"}
        showPlaceholderGlyph={showPlaceholderGlyph}
      />
    );
  }
  const workareaKind = readWorkareaItemKind(node);
  const procedureItemKind = readProcedureItemGlyphKind(node);
  const fieldType =
    typeof node.properties?.odeProcedureFieldType === "string" ? node.properties.odeProcedureFieldType.trim() : "";
  const isExecutionOwner = showExecutionOwnerGlyph || node.properties?.odeWorkareaOwner === true;
  if (workareaKind) {
    const status = readWorkareaStatus(node);
    return (
      <span className="ode-node-glyph" aria-hidden>
        {workareaKind === "deliverable" ? (
          <WorkareaDeliverableGlyph active={active} status={status} />
        ) : workareaKind === "task" ? (
          <WorkareaTaskGlyph active={active} status={status} />
        ) : (
          <WorkareaSubtaskGlyph active={active} status={status} />
        )}
      </span>
    );
  }
  if (isDocumentationWorkspaceRootNode(node)) {
    return (
      <span className="ode-node-glyph" aria-hidden>
        <DatabaseRootGlyph active={active} />
      </span>
    );
  }
  if (node.properties?.odeDashboardWidget === true || node.properties?.odeDashboard === true) {
    return (
      <span className="ode-node-glyph" aria-hidden>
        <DashboardGlyph active={active} />
      </span>
    );
  }
  if (procedureItemKind) {
    return (
      <span className="ode-node-glyph" aria-hidden>
        {procedureItemKind === "field" ? (
          <DatabaseFieldGlyph active={active} fieldType={fieldType} />
        ) : (
          <DatabaseSectionGlyph active={active} />
        )}
      </span>
    );
  }
  if (node.type === "ticket") {
    return (
      <span className="ode-node-glyph" aria-hidden>
        <TicketGlyph active={active} />
      </span>
    );
  }
  if (isExecutionTask) {
    return (
      <span className="ode-node-glyph" aria-hidden>
        <ExecutionTaskGlyph active={active} />
      </span>
    );
  }
  if (isExecutionOwner) {
    return (
      <span className="ode-node-glyph" aria-hidden>
        <ExecutionRootGlyph active={active} status={readWorkareaStatus(node)} />
      </span>
    );
  }
  if (isStructuralTask) {
    return (
      <span className="ode-node-glyph" aria-hidden>
        <TaskGlyph active={active} />
      </span>
    );
  }
  return (
    <span className="ode-node-glyph" aria-hidden>
      <FolderGlyph active={active} state={folderState ?? "empty"} />
    </span>
  );
}

export function DesktopFilePreview({ node }: { node: AppNode }) {
  const previewKind = getDesktopMediaPreviewKind(node);
  const previewSrc = previewKind ? resolveDesktopPreviewSrc(node) : null;
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    setPreviewError(false);
  }, [previewKind, previewSrc]);

  if (!previewKind || !previewSrc || previewError) return null;

  if (previewKind === "image") {
    return (
      <span className="ode-grid-file-preview" aria-hidden>
        <img src={previewSrc} alt="" loading="lazy" draggable={false} onError={() => setPreviewError(true)} />
      </span>
    );
  }

  if (previewKind === "video") {
    return (
      <span className="ode-grid-file-preview" aria-hidden>
        <img src={previewSrc} alt="" loading="lazy" draggable={false} onError={() => setPreviewError(true)} />
      </span>
    );
  }

  return (
    <span className="ode-grid-file-preview ode-grid-file-preview-pdf" aria-hidden>
      <iframe
        src={`${previewSrc}#toolbar=0&navpanes=0&scrollbar=0&page=1&view=FitH`}
        loading="lazy"
        tabIndex={-1}
        onError={() => setPreviewError(true)}
      />
    </span>
  );
}

export function SmartEmptyState({ t }: { t: (key: string) => string }) {
  return (
    <div className="mt-12 flex flex-col items-center">
      <div className="mb-8 rounded-2xl border border-dashed border-[var(--ode-border-strong)] bg-[rgba(4,23,39,0.35)] px-8 py-6 text-center">
        <p className="text-[1.1rem] text-[var(--ode-text-muted)]">{t("grid.empty")}</p>
      </div>
    </div>
  );
}

export function SearchGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <defs>
        <linearGradient id="odeSearchGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#43d3ff" />
          <stop offset="100%" stopColor="#1f9fe0" />
        </linearGradient>
      </defs>
      <circle cx="10" cy="10" r="6" fill="rgba(32,156,220,0.2)" stroke="url(#odeSearchGlow)" strokeWidth="1.8" />
      <circle cx="8.2" cy="8" r="1.05" fill="#79e2ff" opacity="0.95" />
      <path d="M14.6 14.6L20 20" stroke="url(#odeSearchGlow)" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  );
}

export function SidebarMenuGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path d="M6 7.2h12M6 12h12M6 16.8h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ExpandAllGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M6.2 6.5h6.4M6.2 12h6.4M6.2 17.5h6.4M15.1 8.4l2.7 2.7 2.7-2.7M17.8 11.1v7.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CollapseAllGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M6.2 6.5h6.4M6.2 12h6.4M6.2 17.5h6.4M15.1 15.6l2.7-2.7 2.7 2.7M17.8 12.9V5.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CalendarGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M7 3.8v2.1M17 3.8v2.1M4.5 9.1h15M6.2 6h11.6A1.7 1.7 0 0 1 19.5 7.7v10.1a1.7 1.7 0 0 1-1.7 1.7H6.2a1.7 1.7 0 0 1-1.7-1.7V7.7A1.7 1.7 0 0 1 6.2 6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FileGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M7.2 3.8h7.1l4 4v12.3a1.8 1.8 0 0 1-1.8 1.8H7.2a1.8 1.8 0 0 1-1.8-1.8V5.6a1.8 1.8 0 0 1 1.8-1.8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M14.3 3.8v4h4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8.8 12h6.5M8.8 15.6h6.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function DataFolderGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M4.5 8.8V7.4A1.9 1.9 0 0 1 6.4 5.5h2.2l1.3 1.5h7.5a1.9 1.9 0 0 1 1.9 1.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.3 9.8h15.4l-1 5.5a1.9 1.9 0 0 1-1.9 1.5H7.2a1.9 1.9 0 0 1-1.9-1.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WorkspaceRootGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <path
        d="M4.6 8.2V7a1.9 1.9 0 0 1 1.9-1.9h2.5l1.4 1.7h7a1.9 1.9 0 0 1 1.9 1.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.15 9.35h15.7l-1.02 6.32a1.92 1.92 0 0 1-1.92 1.6H7.12a1.92 1.92 0 0 1-1.92-1.6Z"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12.45"
        r="2.35"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.95 10.95a2.35 2.35 0 0 0-3.55-.15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="8.85" r="1.05" fill="currentColor" />
      <circle cx="8.25" cy="15.35" r="1.05" fill="currentColor" />
      <circle cx="15.75" cy="15.35" r="1.05" fill="currentColor" />
      <path
        d="M12 10.25v-0.3M10.08 13.7l-1.1 0.95M13.92 13.7l1.1 0.95"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TaskGlyph({ active = true }: { active?: boolean }) {
  const stroke = active ? "#54c9f5" : "#8aa8bb";
  const fill = active ? "rgba(35,129,168,0.24)" : "rgba(18,49,66,0.2)";
  const accent = active ? "#bfefff" : "#a7c4d3";
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <rect x="4.4" y="4.6" width="15.2" height="14.8" rx="2.4" fill={fill} stroke={stroke} strokeWidth="1.6" />
      <path d="M8.1 8.7h7.6M8.1 12h7.6M8.1 15.3h5.4" fill="none" stroke={accent} strokeWidth="1.55" strokeLinecap="round" />
      <path d="M6.6 12 7.5 12.9 8.9 11.3" fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ExecutionTaskGlyph({ active = true }: { active?: boolean }) {
  const gear = active ? "#9fe4ff" : "#6f99ad";
  const coreFill = active ? "rgba(8,28,43,0.94)" : "rgba(15,28,38,0.8)";
  const check = active ? "#39df82" : "#8fc5a4";
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <g fill={gear}>
        <rect x="10.8" y="1.9" width="2.4" height="3.4" rx="0.7" />
        <rect x="10.8" y="18.7" width="2.4" height="3.4" rx="0.7" />
        <rect x="18.7" y="10.8" width="3.4" height="2.4" rx="0.7" />
        <rect x="1.9" y="10.8" width="3.4" height="2.4" rx="0.7" />
        <rect x="16.95" y="3.35" width="2.35" height="3.35" rx="0.7" transform="rotate(45 18.125 5.025)" />
        <rect x="4.7" y="15.6" width="2.35" height="3.35" rx="0.7" transform="rotate(45 5.875 17.275)" />
        <rect x="15.6" y="16.95" width="3.35" height="2.35" rx="0.7" transform="rotate(45 17.275 18.125)" />
        <rect x="3.35" y="4.7" width="3.35" height="2.35" rx="0.7" transform="rotate(45 5.025 5.875)" />
      </g>
      <circle cx="12" cy="12" r="6.4" fill={coreFill} stroke={gear} strokeWidth="1.45" />
      <path
        d="M8.9 12.2 11.2 14.5 15.4 9.8"
        fill="none"
        stroke={check}
        strokeWidth="2.05"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChecklistGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <rect
        x="5.2"
        y="3.8"
        width="13.6"
        height="16.4"
        rx="2.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M8.1 8.1h7.8M8.1 12h7.8M8.1 15.9h5.3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M6.4 12.1 7.3 13 8.7 11.5" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
    </svg>
  );
}

export function ClockGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7.8v4.7l3.2 1.9" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function UploadGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M12 4.4v9.7M8.5 7.9 12 4.4l3.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.2 14.6v3.3A1.9 1.9 0 0 0 7.1 19.8h9.8a1.9 1.9 0 0 0 1.9-1.9v-3.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ImportGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M8 4.7h6.5l3 3v11a1.8 1.8 0 0 1-1.8 1.8H8A1.8 1.8 0 0 1 6.2 18.7V6.5A1.8 1.8 0 0 1 8 4.7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path
        d="M14.5 4.7v3.1h3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path
        d="M3.8 12h7.7m-2.6-2.7 2.7 2.7-2.7 2.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.6 15.9h4.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ExportGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M8 4.7h6.5l3 3v11a1.8 1.8 0 0 1-1.8 1.8H8A1.8 1.8 0 0 1 6.2 18.7V6.5A1.8 1.8 0 0 1 8 4.7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path
        d="M14.5 4.7v3.1h3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path
        d="M12.4 12H20m-2.7-2.7L20 12l-2.7 2.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.4 15.9h3.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function MindMapHorizontalGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <rect x="2.8" y="10.1" width="3.4" height="3.4" rx="0.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="10.2" y="10.1" width="3.4" height="3.4" rx="0.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="17.6" y="10.1" width="3.4" height="3.4" rx="0.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.4 11.8h3.4m3.8 0h3.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function MindMapVerticalGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <rect x="10.3" y="2.9" width="3.4" height="3.4" rx="0.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="10.3" y="10.3" width="3.4" height="3.4" rx="0.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="10.3" y="17.7" width="3.4" height="3.4" rx="0.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 6.6v3.3m0 3.8v3.3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function SettingsGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <circle cx="9" cy="6.5" r="1.7" fill="currentColor" />
      <circle cx="15" cy="12" r="1.7" fill="currentColor" />
      <circle cx="9" cy="17.5" r="1.7" fill="currentColor" />
      <path
        d="M4 6.5h3.3M10.7 6.5H20M4 12h9.3M16.7 12H20M4 17.5h3.3M10.7 17.5H20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function QuickAccessGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="m12 4.1 2.35 4.76 5.25.76-3.8 3.7.9 5.23L12 16.1l-4.7 2.47.9-5.23-3.8-3.7 5.25-.76Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinejoin="round"
      />
      <circle cx="18.15" cy="6.15" r="1.15" fill="currentColor" opacity="0.92" />
    </svg>
  );
}

export function FlagGlyphSmall({ active = true }: { active?: boolean }) {
  const mastFill = active ? "#f4f7fb" : "#cfd7e1";
  const mastStroke = active ? "rgba(38, 58, 82, 0.72)" : "rgba(42, 57, 76, 0.45)";
  const ringStroke = active ? "#ffb13c" : "#caa066";
  const pennantFill = active ? "#ff3a1f" : "#db6d60";
  const pennantStroke = active ? "rgba(88, 18, 18, 0.72)" : "rgba(92, 34, 34, 0.5)";
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M5.95 2.9h2.15v18.2H5.95z"
        fill={mastFill}
        stroke={mastStroke}
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      <path
        d="M8.05 4.7 21.15 9.2 8.05 13.7Z"
        fill={pennantFill}
        stroke={pennantStroke}
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      <circle cx="7.02" cy="4.65" r="1.35" fill={mastFill} stroke={ringStroke} strokeWidth="0.9" />
      <circle cx="7.02" cy="19.35" r="1.35" fill={mastFill} stroke={ringStroke} strokeWidth="0.9" />
    </svg>
  );
}

export function FavoriteTreeFilterGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M7.2 7.8h4.2M12.1 7.8h4.7M7.2 12h5.7M13.8 12h3M7.2 16.2h6.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
      />
      <circle cx="6" cy="7.8" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="18" cy="7.8" r="1.3" fill="currentColor" />
      <path
        d="M16.5 14.4l.6 1.3 1.4.1-1.1.9.3 1.3-1.2-.7-1.2.7.3-1.3-1.1-.9 1.4-.1Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function ContextGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <rect x="3.8" y="6.1" width="4.2" height="11.8" rx="1.1" fill="none" stroke="currentColor" strokeWidth="1.45" />
      <rect x="15.9" y="6.1" width="4.3" height="11.8" rx="1.1" fill="none" stroke="currentColor" strokeWidth="1.45" opacity="0.75" />
      <rect x="10.1" y="9" width="3.8" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.55" />
      <path d="M8 9.9h2.1M13.9 9.9H16M8 14.1h2.1M13.9 14.1H16" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
    </svg>
  );
}

export function TrashGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11v6M14 11v6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowUpGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M12 18V6.2M7.8 10.4 12 6.2l4.2 4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArrowLeftGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M18 12H6.2M10.4 7.8 6.2 12l4.2 4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArrowRightGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M6 12h11.8M13.6 7.8 17.8 12l-4.2 4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArrowDownGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M12 6v11.8M7.8 13.6 12 17.8l4.2-4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TextAlignLeftGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path d="M5.5 7.2h12.8M5.5 10.8h9.6M5.5 14.4h12.8M5.5 18h8.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function TextAlignCenterGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path d="M5.9 7.2h12.2M7.4 10.8h9.2M5.9 14.4h12.2M7.9 18h8.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function TextAlignRightGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path d="M5.7 7.2h12.8M8.9 10.8h9.6M5.7 14.4h12.8M10.3 18h8.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function TextAlignJustifyGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path d="M5.5 7.2h13M5.5 10.8h13M5.5 14.4h13M5.5 18h13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IndentDecreaseGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M9.6 7.2h8.8M9.6 10.8h6.4M9.6 14.4h8.8M9.6 18h6.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M5.4 12h3.5M5.4 12l1.8-1.8M5.4 12l1.8 1.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IndentIncreaseGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M5.6 7.2h8.8M5.6 10.8H12M5.6 14.4h8.8M5.6 18H12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M18.6 12h-3.5M18.6 12l-1.8-1.8M18.6 12l-1.8 1.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LineSpacingGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M10.2 7.2h8M10.2 12h8M10.2 16.8h8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M5.8 5.2v13.6M5.8 5.2L4.2 6.8M5.8 5.2l1.6 1.6M5.8 18.8l-1.6-1.6M5.8 18.8l1.6-1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TableGridGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <rect x="4.8" y="5.4" width="14.4" height="13.2" rx="1.8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.8 10h14.4M4.8 14.6h14.4M9.6 5.4v13.2M14.4 5.4v13.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function PageBreakGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path d="M5.2 7.2h13.6M5.2 16.8h13.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M12 9.2v5.6M9.8 12.6 12 14.8l2.2-2.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PlusGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path d="M12 5.2v13.6M5.2 12h13.6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function DashboardGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <rect x="4.8" y="5.8" width="14.4" height="12.8" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.65" />
      <path d="M8.1 14.6v-3.4M12 14.6V8.9M15.9 14.6v-4.8" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M7.4 8.1h9.2" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.74" />
    </svg>
  );
}

export function DashboardOffGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <rect x="4.8" y="5.8" width="14.4" height="12.8" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.65" />
      <path d="M8.1 14.6v-3.4M12 14.6V8.9M15.9 14.6v-4.8" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" opacity="0.8" />
      <path d="M6.2 17.8 17.8 6.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function SparkGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path d="M12 3.8l1.9 4.3 4.3 1.9-4.3 1.9-1.9 4.3-1.9-4.3-4.3-1.9 4.3-1.9L12 3.8Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M18 15.2l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round" />
    </svg>
  );
}

export function OpenGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path d="M8 6.2h9.8v9.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.4 17.6 17.3 6.7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M6.2 10.1v7.7h7.7" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" opacity="0.72" />
    </svg>
  );
}

export function SearchGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M16 16l4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function QuestionMarkGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9.1 9a2.9 2.9 0 0 1 5.8 0c0 2.9-4.3 2.9-4.3 5.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="10.6" cy="18" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function InfoGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="8.1" r="1.1" fill="currentColor" />
      <path d="M12 11.2v5.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function EditGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M5.2 18.8l2.8-.5 8.6-8.6-2.3-2.3-8.6 8.6-.5 2.8Zm0 0 2.1-2.1M13.2 8.6l2.3 2.3M15.6 6.2l2.2 2.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LockGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <rect x="6.4" y="10.4" width="11.2" height="8.2" rx="1.8" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8.8 10.4V8.6a3.2 3.2 0 0 1 6.4 0v1.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="12" cy="14.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function TextBoldGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M7.4 4.8h6.3c2.55 0 4.2 1.37 4.2 3.46 0 1.4-.72 2.45-2.02 2.97 1.59.45 2.53 1.62 2.53 3.35 0 2.67-1.93 4.22-5.07 4.22H7.4Zm2.56 2.04v3.23h3.1c1.39 0 2.2-.59 2.2-1.66 0-1.04-.78-1.57-2.32-1.57Zm0 5.15v3.09h3.44c1.51 0 2.38-.58 2.38-1.68 0-1.08-.84-1.41-2.5-1.41Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function TextItalicGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M9.1 4.9h8.1v1.95h-2.47l-2.7 10.3h2.47v1.95H6.8v-1.95h2.49l2.69-10.3H9.1Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function HeadingStyleGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M5.6 6.2v11.6M10.1 6.2v11.6M5.6 12h4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.4 7h4.2M14.4 12h3.4M14.4 17h4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ListBulletsGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <circle cx="6.1" cy="7.2" r="1.2" fill="currentColor" />
      <circle cx="6.1" cy="12" r="1.2" fill="currentColor" />
      <circle cx="6.1" cy="16.8" r="1.2" fill="currentColor" />
      <path d="M9.6 7.2h8.3M9.6 12h8.3M9.6 16.8h8.3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function ListNumbersGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path d="M4.7 6.1h1.8v3.4M4.4 13h2.5l-2.5 3.1h2.5M9.8 7.2h8M9.8 12h8M9.8 16.8h8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function QuoteGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M8.5 7.2A4.3 4.3 0 0 0 4.8 11v5.2h5.5v-5H7.6c.2-1.2 1.1-2.2 2.4-2.9M17.8 7.2A4.3 4.3 0 0 0 14 11v5.2h5.5v-5h-2.7c.2-1.2 1.1-2.2 2.4-2.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CodeGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="m8.4 8.1-3.3 3.9 3.3 3.9M15.6 8.1l3.3 3.9-3.3 3.9M13.6 6.4l-3.2 11.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DividerGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path d="M5.2 12h13.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function NodeLinkGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M4.8 7.2a2 2 0 0 1 2-2h4.6a2 2 0 0 1 2 2v2.5a2 2 0 0 1-2 2H6.8a2 2 0 0 1-2-2Zm5.8 9.6h6.6a2 2 0 0 0 2-2v-4.5a2 2 0 0 0-2-2h-1.8M11.4 14.1l1.8-1.8a2.2 2.2 0 0 1 3.1 0 2.2 2.2 0 0 1 0 3.1l-1.2 1.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LinkGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M9.4 14.6 14.7 9.3M8.1 17.3H6.7a3.2 3.2 0 0 1 0-6.4h2.8M15.9 6.7h1.4a3.2 3.2 0 1 1 0 6.4h-2.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ImageGlyphSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <rect x="4.1" y="5.2" width="15.8" height="13.6" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9" cy="10" r="1.4" fill="currentColor" />
      <path d="M6.8 16.2 10.4 12.6l2.4 2.4 2.1-1.9 2.3 3.1" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
