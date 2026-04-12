export interface HtmlAppTemplate {
  id: string;
  label: string;
  entryPath: string;
  version: number;
  updatedAt: number;
}

function createHtmlAppTemplateId() {
  return `html-app-template-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function trimString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function deriveTemplateLabel(entryPath: string): string {
  const normalized = entryPath.replace(/[\\/]+$/, "");
  const segments = normalized.split(/[\\/]/).filter(Boolean);
  const leaf = segments[segments.length - 1] ?? "";
  if (!leaf) return "HTML App";
  const dotIndex = leaf.lastIndexOf(".");
  return dotIndex > 0 ? leaf.slice(0, dotIndex) : leaf;
}

export function createHtmlAppTemplate(seed?: Partial<HtmlAppTemplate>): HtmlAppTemplate {
  const entryPath = trimString(seed?.entryPath);
  const label = trimString(seed?.label) || deriveTemplateLabel(entryPath);
  return {
    id: trimString(seed?.id) || createHtmlAppTemplateId(),
    label: label || "HTML App",
    entryPath,
    version: isFiniteNumber(seed?.version) && seed.version > 0 ? Math.floor(seed.version) : 1,
    updatedAt: isFiniteNumber(seed?.updatedAt) ? seed.updatedAt : Date.now()
  };
}

export function normalizeHtmlAppTemplates(raw: unknown): HtmlAppTemplate[] {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set<string>();
  const items: HtmlAppTemplate[] = [];
  for (const candidate of raw) {
    if (!candidate || typeof candidate !== "object") continue;
    const next = createHtmlAppTemplate(candidate as Partial<HtmlAppTemplate>);
    if (!next.entryPath) continue;
    if (seenIds.has(next.id)) {
      next.id = createHtmlAppTemplateId();
    }
    seenIds.add(next.id);
    items.push(next);
  }
  return items.sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: "base" }));
}

export function isHtmlTemplatePath(path: string): boolean {
  const trimmed = trimString(path);
  if (!trimmed) return false;
  return /\.(html?|HTML?)$/i.test(trimmed);
}

