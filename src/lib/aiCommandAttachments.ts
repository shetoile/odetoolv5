import type { AiEngine } from "@/ai/core/aiContracts";

export type AiCommandAttachmentKind = "image" | "document";
export type AiCommandAttachmentSource = "picker" | "drop" | "clipboard-image" | "clipboard-file";
export type AiCommandAttachmentStatus = "loading" | "ready" | "unsupported" | "error";

export type AiPromptMessageContentPart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image_url";
      imageUrl: string;
    };

export type AiCommandAttachment = {
  id: string;
  name: string;
  kind: AiCommandAttachmentKind;
  source: AiCommandAttachmentSource;
  mimeType: string;
  sizeBytes: number;
  dataUrl?: string | null;
  extractedText?: string | null;
  status: AiCommandAttachmentStatus;
  error?: string | null;
};

export type AiConversationAttachment = {
  id: string;
  name: string;
  kind: AiCommandAttachmentKind;
  mimeType: string;
  sizeBytes: number;
  status: AiCommandAttachmentStatus;
  error?: string | null;
  dataUrl?: string | null;
};

export const AI_COMMAND_MAX_ATTACHMENTS = 6;
export const AI_COMMAND_MAX_TOTAL_BYTES = 20 * 1024 * 1024;

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"]);
const DOCUMENT_EXTENSIONS = new Set(["pdf", "docx", "xlsx", "xls", "html", "htm", "txt", "md", "csv"]);

function trimEvidenceText(value: string, limit = 2400): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit).trim()}...`;
}

export function buildAiCommandAttachmentId(prefix = "aiatt"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getAiCommandAttachmentExtension(name: string): string {
  const trimmed = name.trim();
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot < 0 || lastDot === trimmed.length - 1) return "";
  return trimmed.slice(lastDot + 1).toLowerCase();
}

export function isAiCommandImageMimeType(mimeType: string | null | undefined): boolean {
  return typeof mimeType === "string" && /^image\//i.test(mimeType.trim());
}

export function inferAiCommandAttachmentKind(
  name: string,
  mimeType: string | null | undefined
): AiCommandAttachmentKind | null {
  const extension = getAiCommandAttachmentExtension(name);
  if (isAiCommandImageMimeType(mimeType) || IMAGE_EXTENSIONS.has(extension)) {
    return "image";
  }
  if (
    DOCUMENT_EXTENSIONS.has(extension) ||
    (typeof mimeType === "string" &&
      (/^(text\/|application\/pdf$)/i.test(mimeType.trim()) ||
        /officedocument|spreadsheet|csv|markdown|html/i.test(mimeType.trim())))
  ) {
    return "document";
  }
  return null;
}

export function formatAiCommandAttachmentSize(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return "0 B";
  if (sizeBytes < 1024) return `${Math.round(sizeBytes)} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(sizeBytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(sizeBytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function getReadyAiCommandAttachments(
  attachments: AiCommandAttachment[] | null | undefined
): AiCommandAttachment[] {
  return (attachments ?? []).filter((attachment) => attachment.status === "ready");
}

export function hasReadyAiCommandAttachments(
  attachments: AiCommandAttachment[] | null | undefined
): boolean {
  return getReadyAiCommandAttachments(attachments).length > 0;
}

export function snapshotAiCommandAttachment(
  attachment: AiCommandAttachment
): AiConversationAttachment {
  return {
    id: attachment.id,
    name: attachment.name,
    kind: attachment.kind,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    status: attachment.status,
    error: attachment.error ?? null,
    dataUrl: attachment.kind === "image" ? attachment.dataUrl ?? null : null
  };
}

export function buildAiPromptInput(
  basePrompt: string,
  attachments: AiCommandAttachment[] | null | undefined,
  options?: {
    aiEngine?: AiEngine;
    attachmentHeading?: string;
    localImageWarning?: string | null;
    emptyPromptFallback?: string;
  }
): {
  userPrompt: string;
  userContent?: AiPromptMessageContentPart[];
  attachmentLabels: string[];
  documentLabels: string[];
  imageLabels: string[];
  ignoredImageCount: number;
} {
  const readyAttachments = getReadyAiCommandAttachments(attachments);
  const readyDocuments = readyAttachments.filter(
    (attachment) => attachment.kind === "document" && typeof attachment.extractedText === "string" && attachment.extractedText.trim().length > 0
  );
  const readyImages = readyAttachments.filter(
    (attachment) => attachment.kind === "image" && typeof attachment.dataUrl === "string" && attachment.dataUrl.trim().length > 0
  );

  const promptSections: string[] = [];
  const trimmedBasePrompt = basePrompt.trim();
  if (trimmedBasePrompt.length > 0) {
    promptSections.push(trimmedBasePrompt);
  }

  if (readyDocuments.length > 0) {
    promptSections.push(
      [
        options?.attachmentHeading?.trim() || "Temporary prompt attachments:",
        ...readyDocuments.map(
          (attachment, index) =>
            `[A${index + 1}|Prompt attachment: ${attachment.name}]\n${trimEvidenceText(attachment.extractedText ?? "")}`
        )
      ].join("\n\n")
    );
  }

  let ignoredImageCount = 0;
  if ((options?.aiEngine ?? "cloud") === "local" && readyImages.length > 0) {
    ignoredImageCount = readyImages.length;
    if (options?.localImageWarning?.trim()) {
      promptSections.push(options.localImageWarning.trim());
    }
  }

  const userPrompt =
    promptSections.join("\n\n").trim() ||
    options?.emptyPromptFallback?.trim() ||
    "Analyze the attached item(s) and provide concise insights.";

  const userContent =
    (options?.aiEngine ?? "cloud") !== "local" && readyImages.length > 0
      ? [
          ({
            type: "text",
            text: userPrompt
          }) satisfies AiPromptMessageContentPart,
          ...readyImages.map(
            (attachment) =>
              ({
                type: "image_url",
                imageUrl: attachment.dataUrl ?? ""
              }) satisfies AiPromptMessageContentPart
          )
        ]
      : undefined;

  return {
    userPrompt,
    userContent,
    attachmentLabels: readyAttachments.map((attachment) => attachment.name),
    documentLabels: readyDocuments.map((attachment) => attachment.name),
    imageLabels: readyImages.map((attachment) => attachment.name),
    ignoredImageCount
  };
}
