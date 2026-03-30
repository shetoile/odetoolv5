export type FormFieldType =
  | "short_text"
  | "long_text"
  | "number"
  | "decimal"
  | "currency"
  | "date"
  | "yes_no"
  | "single_select"
  | "multi_select"
  | "email"
  | "phone"
  | "identifier"
  | "attachment";

export type FormRecordAttachment = {
  name: string;
  size: number;
  lastModified: number;
};

export type FormRecordValue = string | string[] | FormRecordAttachment[];

export interface FormFieldDefinition {
  id: string;
  label: string;
  key: string;
  type: FormFieldType;
  required: boolean;
  placeholder: string;
  helpText: string;
  defaultValue: string;
  options: string[];
  currencyCode: string;
  mask: string;
  minLength: number | null;
  maxLength: number | null;
  minValue: number | null;
  maxValue: number | null;
}

export interface FormSectionDefinition {
  id: string;
  title: string;
  description: string;
  fields: FormFieldDefinition[];
}

export interface FormDefinition {
  id: string;
  title: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  sections: FormSectionDefinition[];
}

export interface FormRecordDefinition {
  id: string;
  formId: string;
  createdAt: number;
  updatedAt: number;
  values: Record<string, FormRecordValue>;
}

export interface FormsStudioState {
  version: 1;
  forms: FormDefinition[];
  records: FormRecordDefinition[];
}

export const FORMS_STUDIO_STORAGE_KEY = "odetool.forms.studio.v1";

export const FORM_FIELD_TYPES: FormFieldType[] = [
  "short_text",
  "long_text",
  "number",
  "decimal",
  "currency",
  "date",
  "yes_no",
  "single_select",
  "multi_select",
  "email",
  "phone",
  "identifier",
  "attachment"
];

const DEFAULT_FIELD_LABELS: Record<FormFieldType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  number: "Number",
  decimal: "Decimal",
  currency: "Currency",
  date: "Date",
  yes_no: "Yes / No",
  single_select: "Select",
  multi_select: "Multi-select",
  email: "Email",
  phone: "Phone",
  identifier: "Identifier",
  attachment: "Attachment"
};

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `forms-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function slugifyFormFieldKey(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "field";
}

export function ensureUniqueFieldKey(
  desiredKey: string,
  existingKeys: Iterable<string>,
  currentKey?: string
): string {
  const taken = new Set(
    [...existingKeys]
      .map((key) => key.trim())
      .filter((key) => key.length > 0 && key !== (currentKey?.trim() ?? ""))
  );
  const base = slugifyFormFieldKey(desiredKey);
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}_${suffix}`)) {
    suffix += 1;
  }
  return `${base}_${suffix}`;
}

export function fieldTypeSupportsOptions(type: FormFieldType): boolean {
  return type === "single_select" || type === "multi_select";
}

export function fieldTypeSupportsNumericRules(type: FormFieldType): boolean {
  return type === "number" || type === "decimal" || type === "currency";
}

export function fieldTypeSupportsLengthRules(type: FormFieldType): boolean {
  return (
    type === "short_text" ||
    type === "long_text" ||
    type === "email" ||
    type === "phone" ||
    type === "identifier"
  );
}

export function createFormField(
  type: FormFieldType = "short_text",
  existingKeys: Iterable<string> = []
): FormFieldDefinition {
  const label = DEFAULT_FIELD_LABELS[type];
  return {
    id: createId(),
    label,
    key: ensureUniqueFieldKey(label, existingKeys),
    type,
    required: false,
    placeholder: "",
    helpText: "",
    defaultValue: "",
    options: fieldTypeSupportsOptions(type) ? ["Option 1", "Option 2"] : [],
    currencyCode: "EUR",
    mask: type === "identifier" ? "AA-999999" : "",
    minLength: null,
    maxLength: null,
    minValue: null,
    maxValue: null
  };
}

export function createFormSection(existingKeys: Iterable<string> = []): FormSectionDefinition {
  return {
    id: createId(),
    title: "General information",
    description: "",
    fields: [createFormField("short_text", existingKeys)]
  };
}

export function createFormDefinition(title = "New Form"): FormDefinition {
  const firstSection = createFormSection();
  return {
    id: createId(),
    title,
    description: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sections: [firstSection]
  };
}

function cloneField(field: FormFieldDefinition, existingKeys: Iterable<string>): FormFieldDefinition {
  const next = createFormField(field.type, existingKeys);
  return {
    ...field,
    ...next,
    label: field.label,
    key: ensureUniqueFieldKey(field.key, existingKeys)
  };
}

export function duplicateFormDefinition(form: FormDefinition): FormDefinition {
  const nextSections: FormSectionDefinition[] = [];
  const existingKeys: string[] = [];
  for (const section of form.sections) {
    const nextFields = section.fields.map((field) => {
      const nextField = cloneField(field, existingKeys);
      existingKeys.push(nextField.key);
      return nextField;
    });
    nextSections.push({
      ...section,
      id: createId(),
      fields: nextFields
    });
  }
  return {
    ...form,
    id: createId(),
    title: `${form.title} Copy`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sections: nextSections
  };
}

export function buildDefaultRecordValues(form: FormDefinition | null | undefined): Record<string, FormRecordValue> {
  if (!form) return {};
  const values: Record<string, FormRecordValue> = {};
  for (const section of form.sections) {
    for (const field of section.fields) {
      if (field.type === "multi_select") {
        values[field.key] = field.defaultValue
          ? field.defaultValue.split(/[\n,;|]+/g).map((item) => item.trim()).filter(Boolean)
          : [];
      } else if (field.type === "attachment") {
        values[field.key] = [];
      } else {
        values[field.key] = field.defaultValue;
      }
    }
  }
  return values;
}

function normalizeAttachment(value: unknown): FormRecordAttachment | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<FormRecordAttachment>;
  if (
    typeof candidate.name !== "string" ||
    typeof candidate.size !== "number" ||
    typeof candidate.lastModified !== "number"
  ) {
    return null;
  }
  return {
    name: candidate.name,
    size: candidate.size,
    lastModified: candidate.lastModified
  };
}

function normalizeField(field: unknown, existingKeys: string[]): FormFieldDefinition | null {
  if (!field || typeof field !== "object") return null;
  const candidate = field as Partial<FormFieldDefinition>;
  const type = FORM_FIELD_TYPES.includes(candidate.type as FormFieldType)
    ? (candidate.type as FormFieldType)
    : "short_text";
  const key = ensureUniqueFieldKey(
    typeof candidate.key === "string" && candidate.key.trim().length > 0
      ? candidate.key
      : typeof candidate.label === "string"
        ? candidate.label
        : DEFAULT_FIELD_LABELS[type],
    existingKeys
  );
  existingKeys.push(key);
  return {
    id: typeof candidate.id === "string" && candidate.id.trim().length > 0 ? candidate.id : createId(),
    label:
      typeof candidate.label === "string" && candidate.label.trim().length > 0
        ? candidate.label
        : DEFAULT_FIELD_LABELS[type],
    key,
    type,
    required: candidate.required === true,
    placeholder: typeof candidate.placeholder === "string" ? candidate.placeholder : "",
    helpText: typeof candidate.helpText === "string" ? candidate.helpText : "",
    defaultValue: typeof candidate.defaultValue === "string" ? candidate.defaultValue : "",
    options:
      Array.isArray(candidate.options) && fieldTypeSupportsOptions(type)
        ? candidate.options.filter((option): option is string => typeof option === "string")
        : [],
    currencyCode: typeof candidate.currencyCode === "string" && candidate.currencyCode.trim().length > 0
      ? candidate.currencyCode
      : "EUR",
    mask: typeof candidate.mask === "string" ? candidate.mask : "",
    minLength: typeof candidate.minLength === "number" ? candidate.minLength : null,
    maxLength: typeof candidate.maxLength === "number" ? candidate.maxLength : null,
    minValue: typeof candidate.minValue === "number" ? candidate.minValue : null,
    maxValue: typeof candidate.maxValue === "number" ? candidate.maxValue : null
  };
}

function normalizeSection(section: unknown): FormSectionDefinition | null {
  if (!section || typeof section !== "object") return null;
  const candidate = section as Partial<FormSectionDefinition>;
  const existingKeys: string[] = [];
  const fields =
    Array.isArray(candidate.fields)
      ? candidate.fields
          .map((field) => normalizeField(field, existingKeys))
          .filter((field): field is FormFieldDefinition => field !== null)
      : [];
  return {
    id: typeof candidate.id === "string" && candidate.id.trim().length > 0 ? candidate.id : createId(),
    title:
      typeof candidate.title === "string" && candidate.title.trim().length > 0
        ? candidate.title
        : "General information",
    description: typeof candidate.description === "string" ? candidate.description : "",
    fields: fields.length > 0 ? fields : [createFormField("short_text", existingKeys)]
  };
}

function normalizeForm(form: unknown): FormDefinition | null {
  if (!form || typeof form !== "object") return null;
  const candidate = form as Partial<FormDefinition>;
  const sections =
    Array.isArray(candidate.sections)
      ? candidate.sections
          .map((section) => normalizeSection(section))
          .filter((section): section is FormSectionDefinition => section !== null)
      : [];
  return {
    id: typeof candidate.id === "string" && candidate.id.trim().length > 0 ? candidate.id : createId(),
    title:
      typeof candidate.title === "string" && candidate.title.trim().length > 0
        ? candidate.title
        : "New Form",
    description: typeof candidate.description === "string" ? candidate.description : "",
    createdAt: typeof candidate.createdAt === "number" ? candidate.createdAt : Date.now(),
    updatedAt: typeof candidate.updatedAt === "number" ? candidate.updatedAt : Date.now(),
    sections: sections.length > 0 ? sections : [createFormSection()]
  };
}

function normalizeRecord(record: unknown): FormRecordDefinition | null {
  if (!record || typeof record !== "object") return null;
  const candidate = record as Partial<FormRecordDefinition>;
  if (typeof candidate.formId !== "string" || candidate.formId.trim().length === 0) return null;
  const nextValues: Record<string, FormRecordValue> = {};
  if (candidate.values && typeof candidate.values === "object") {
    for (const [key, value] of Object.entries(candidate.values as Record<string, unknown>)) {
      if (typeof value === "string") {
        nextValues[key] = value;
      } else if (Array.isArray(value)) {
        const attachments = value
          .map((item) => normalizeAttachment(item))
          .filter((item): item is FormRecordAttachment => item !== null);
        if (attachments.length === value.length) {
          nextValues[key] = attachments;
          continue;
        }
        const tokens = value.filter((item): item is string => typeof item === "string");
        if (tokens.length === value.length) {
          nextValues[key] = tokens;
        }
      }
    }
  }
  return {
    id: typeof candidate.id === "string" && candidate.id.trim().length > 0 ? candidate.id : createId(),
    formId: candidate.formId,
    createdAt: typeof candidate.createdAt === "number" ? candidate.createdAt : Date.now(),
    updatedAt: typeof candidate.updatedAt === "number" ? candidate.updatedAt : Date.now(),
    values: nextValues
  };
}

export function createDefaultFormsStudioState(): FormsStudioState {
  return {
    version: 1,
    forms: [createFormDefinition("Document Intake")],
    records: []
  };
}

export function loadFormsStudioState(): FormsStudioState {
  if (typeof window === "undefined") {
    return createDefaultFormsStudioState();
  }
  try {
    const raw = window.localStorage.getItem(FORMS_STUDIO_STORAGE_KEY);
    if (!raw) return createDefaultFormsStudioState();
    const parsed = JSON.parse(raw) as Partial<FormsStudioState>;
    const forms =
      Array.isArray(parsed.forms)
        ? parsed.forms
            .map((form) => normalizeForm(form))
            .filter((form): form is FormDefinition => form !== null)
        : [];
    const records =
      Array.isArray(parsed.records)
        ? parsed.records
            .map((record) => normalizeRecord(record))
            .filter((record): record is FormRecordDefinition => record !== null)
        : [];
    if (forms.length === 0) return createDefaultFormsStudioState();
    const validFormIds = new Set(forms.map((form) => form.id));
    return {
      version: 1,
      forms,
      records: records.filter((record) => validFormIds.has(record.formId))
    };
  } catch {
    return createDefaultFormsStudioState();
  }
}

export function saveFormsStudioState(state: FormsStudioState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FORMS_STUDIO_STORAGE_KEY, JSON.stringify(state));
}
