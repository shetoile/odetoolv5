import { useEffect, useMemo, useState, type ChangeEvent, type MouseEvent as ReactMouseEvent } from "react";
import type { LanguageCode } from "@/lib/i18n";
import { getLocaleForLanguage } from "@/lib/i18n";
import {
  FORM_FIELD_TYPES,
  buildDefaultRecordValues,
  createFormDefinition,
  createFormField,
  createFormSection,
  duplicateFormDefinition,
  ensureUniqueFieldKey,
  fieldTypeSupportsLengthRules,
  fieldTypeSupportsNumericRules,
  fieldTypeSupportsOptions,
  loadFormsStudioState,
  saveFormsStudioState,
  slugifyFormFieldKey,
  type FormDefinition,
  type FormFieldDefinition,
  type FormFieldType,
  type FormRecordAttachment,
  type FormRecordDefinition,
  type FormRecordValue,
  type FormSectionDefinition,
  type FormsStudioState
} from "@/features/forms/studio";

type FormsStudioTab = "builder" | "entry" | "records";
type NoticeTone = "info" | "success" | "warning";

interface FormsStudioPanelProps {
  language: LanguageCode;
  workspaceName: string | null;
  onActivateFormsSurface: () => void;
  onOpenSurfaceContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
}

const COPY = {
  title: "Forms",
  builder: "Builder",
  entry: "Entry",
  records: "Records",
  listTitle: "Form Library",
  newForm: "New Form",
  duplicateForm: "Duplicate",
  deleteForm: "Delete",
  addSection: "Add Section",
  addField: "Add Field",
  deleteSection: "Delete Section",
  deleteField: "Delete Field",
  formTitle: "Form Title",
  formDescription: "Description",
  sectionTitle: "Section Title",
  sectionDescription: "Section Description",
  fieldLabel: "Field Label",
  fieldKey: "Field Key",
  fieldType: "Field Type",
  fieldRequired: "Required",
  fieldPlaceholder: "Placeholder",
  fieldHelpText: "Help Text",
  fieldOptions: "Options",
  fieldOptionsHint: "One option per line.",
  fieldMask: "Mask",
  fieldCurrency: "Currency",
  fieldMinLength: "Min Length",
  fieldMaxLength: "Max Length",
  fieldMinValue: "Min Value",
  fieldMaxValue: "Max Value",
  saveRecord: "Save Record",
  resetRecord: "Reset",
  noRecords: "No records saved yet.",
  notAnswered: "Not answered",
  yes: "Yes",
  no: "No",
  localHint: "This first pass stores forms and captured records locally on this device.",
  emptyState: "Create your first form to start building a digital document workflow."
} as const;

function isStringArray(value: FormRecordValue | undefined): value is string[] {
  return Array.isArray(value) && (value.length === 0 || typeof value[0] === "string");
}

function isAttachmentArray(value: FormRecordValue | undefined): value is FormRecordAttachment[] {
  return Array.isArray(value) && (value.length === 0 || typeof value[0] === "object");
}

function collectFieldKeys(form: FormDefinition, excludeFieldId?: string): string[] {
  return form.sections.flatMap((section) =>
    section.fields.filter((field) => field.id !== excludeFieldId).map((field) => field.key)
  );
}

function mergeDraftValues(
  form: FormDefinition | null,
  currentDraft: Record<string, FormRecordValue>
): Record<string, FormRecordValue> {
  const baseDraft = buildDefaultRecordValues(form);
  if (!form) return baseDraft;
  for (const section of form.sections) {
    for (const field of section.fields) {
      const currentValue = currentDraft[field.key];
      if (currentValue === undefined) continue;
      if (field.type === "multi_select" && isStringArray(currentValue)) {
        baseDraft[field.key] = currentValue;
      } else if (field.type === "attachment" && isAttachmentArray(currentValue)) {
        baseDraft[field.key] = currentValue;
      } else if (typeof currentValue === "string") {
        baseDraft[field.key] = currentValue;
      }
    }
  }
  return baseDraft;
}

function isEmptyValue(value: FormRecordValue | undefined): boolean {
  if (value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  return value.length === 0;
}

function formatValue(value: FormRecordValue | undefined, field: FormFieldDefinition, locale: string): string {
  if (isEmptyValue(value)) return COPY.notAnswered;
  if (field.type === "multi_select" && isStringArray(value)) return value.join(", ");
  if (field.type === "attachment" && isAttachmentArray(value)) return value.map((item) => item.name).join(", ");
  if (typeof value !== "string") return COPY.notAnswered;
  if (field.type === "yes_no") return value === "yes" ? COPY.yes : value === "no" ? COPY.no : COPY.notAnswered;
  if (field.type === "currency") {
    const numericValue = Number(value);
    if (!Number.isNaN(numericValue)) {
      try {
        return new Intl.NumberFormat(locale, { style: "currency", currency: field.currencyCode || "EUR" }).format(
          numericValue
        );
      } catch {
        return `${field.currencyCode || "EUR"} ${numericValue}`;
      }
    }
  }
  return value;
}

export function FormsStudioPanel({
  language,
  workspaceName,
  onActivateFormsSurface,
  onOpenSurfaceContextMenu
}: FormsStudioPanelProps) {
  const locale = useMemo(() => getLocaleForLanguage(language), [language]);
  const [studioState, setStudioState] = useState<FormsStudioState>(() => loadFormsStudioState());
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FormsStudioTab>("builder");
  const [draftValues, setDraftValues] = useState<Record<string, FormRecordValue>>({});
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>({
    tone: "info",
    text: COPY.localHint
  });

  const selectedForm = useMemo(
    () => studioState.forms.find((form) => form.id === selectedFormId) ?? null,
    [selectedFormId, studioState.forms]
  );
  const selectedFormFields = useMemo(
    () => selectedForm?.sections.flatMap((section) => section.fields) ?? [],
    [selectedForm]
  );
  const selectedRecords = useMemo(
    () => studioState.records.filter((record) => record.formId === selectedFormId).sort((a, b) => b.createdAt - a.createdAt),
    [selectedFormId, studioState.records]
  );

  useEffect(() => {
    saveFormsStudioState(studioState);
  }, [studioState]);

  useEffect(() => {
    if (studioState.forms.length === 0) {
      if (selectedFormId !== null) setSelectedFormId(null);
      return;
    }
    if (!selectedFormId || !studioState.forms.some((form) => form.id === selectedFormId)) {
      setSelectedFormId(studioState.forms[0]?.id ?? null);
    }
  }, [selectedFormId, studioState.forms]);

  useEffect(() => {
    setDraftValues((current) => mergeDraftValues(selectedForm, current));
  }, [selectedForm]);

  const updateSelectedForm = (updater: (form: FormDefinition) => FormDefinition) => {
    if (!selectedFormId) return;
    setStudioState((current) => ({
      ...current,
      forms: current.forms.map((form) =>
        form.id === selectedFormId
          ? {
              ...updater(form),
              updatedAt: Date.now()
            }
          : form
      )
    }));
  };

  const createNewForm = () => {
    const nextForm = createFormDefinition(`Form ${studioState.forms.length + 1}`);
    setStudioState((current) => ({
      ...current,
      forms: [nextForm, ...current.forms]
    }));
    setSelectedFormId(nextForm.id);
    setActiveTab("builder");
    setDraftValues(buildDefaultRecordValues(nextForm));
    setNotice({
      tone: "success",
      text: `${nextForm.title} is ready.`
    });
  };

  const duplicateSelectedForm = () => {
    if (!selectedForm) return;
    const nextForm = duplicateFormDefinition(selectedForm);
    setStudioState((current) => ({
      ...current,
      forms: [nextForm, ...current.forms]
    }));
    setSelectedFormId(nextForm.id);
    setActiveTab("builder");
    setNotice({
      tone: "success",
      text: `${nextForm.title} copied from the current form.`
    });
  };

  const deleteSelectedForm = () => {
    if (!selectedForm) return;
    if (!window.confirm(`Delete "${selectedForm.title}" and its saved records?`)) return;
    setStudioState((current) => ({
      ...current,
      forms: current.forms.filter((form) => form.id !== selectedForm.id),
      records: current.records.filter((record) => record.formId !== selectedForm.id)
    }));
    setNotice({
      tone: "warning",
      text: `${selectedForm.title} removed from this device.`
    });
  };

  const addSection = () => {
    updateSelectedForm((form) => ({
      ...form,
      sections: [...form.sections, createFormSection(collectFieldKeys(form))]
    }));
  };

  const deleteSection = (sectionId: string) => {
    updateSelectedForm((form) => {
      const remainingSections = form.sections.filter((section) => section.id !== sectionId);
      return {
        ...form,
        sections: remainingSections.length > 0 ? remainingSections : [createFormSection(collectFieldKeys(form))]
      };
    });
  };

  const updateSection = (sectionId: string, updater: (section: FormSectionDefinition) => FormSectionDefinition) => {
    updateSelectedForm((form) => ({
      ...form,
      sections: form.sections.map((section) => (section.id === sectionId ? updater(section) : section))
    }));
  };

  const addField = (sectionId: string) => {
    updateSelectedForm((form) => ({
      ...form,
      sections: form.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              fields: [...section.fields, createFormField("short_text", collectFieldKeys(form))]
            }
          : section
      )
    }));
  };

  const deleteField = (sectionId: string, fieldId: string) => {
    updateSelectedForm((form) => ({
      ...form,
      sections: form.sections.map((section) => {
        if (section.id !== sectionId) return section;
        const remainingFields = section.fields.filter((field) => field.id !== fieldId);
        return {
          ...section,
          fields: remainingFields.length > 0 ? remainingFields : [createFormField("short_text", collectFieldKeys(form))]
        };
      })
    }));
  };

  const updateField = (
    sectionId: string,
    fieldId: string,
    updater: (field: FormFieldDefinition, form: FormDefinition) => FormFieldDefinition
  ) => {
    updateSelectedForm((form) => ({
      ...form,
      sections: form.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              fields: section.fields.map((field) => (field.id === fieldId ? updater(field, form) : field))
            }
          : section
      )
    }));
  };

  const updateDraftValue = (fieldKey: string, value: FormRecordValue) => {
    setDraftValues((current) => ({
      ...current,
      [fieldKey]: value
    }));
  };

  const resetDraft = () => {
    setDraftValues(buildDefaultRecordValues(selectedForm));
    setNotice({
      tone: "info",
      text: COPY.localHint
    });
  };

  const saveRecord = () => {
    if (!selectedForm) return;
    const validationMessages: string[] = [];
    for (const field of selectedFormFields) {
      const value = draftValues[field.key];
      if (field.required && isEmptyValue(value)) {
        validationMessages.push(`${field.label} is required`);
        continue;
      }
      if (typeof value === "string" && value.trim().length > 0) {
        if (fieldTypeSupportsLengthRules(field.type)) {
          if (field.minLength !== null && value.length < field.minLength) validationMessages.push(`${field.label} is too short`);
          if (field.maxLength !== null && value.length > field.maxLength) validationMessages.push(`${field.label} is too long`);
        }
        if (fieldTypeSupportsNumericRules(field.type)) {
          const numericValue = Number(value);
          if (Number.isNaN(numericValue)) validationMessages.push(`${field.label} must be numeric`);
          if (field.minValue !== null && numericValue < field.minValue) validationMessages.push(`${field.label} is below minimum`);
          if (field.maxValue !== null && numericValue > field.maxValue) validationMessages.push(`${field.label} is above maximum`);
        }
      }
    }
    if (validationMessages.length > 0) {
      setNotice({
        tone: "warning",
        text: validationMessages.join(", ")
      });
      return;
    }

    const nextRecord: FormRecordDefinition = {
      id: crypto.randomUUID?.() ?? `record-${Date.now()}`,
      formId: selectedForm.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      values: { ...draftValues }
    };
    setStudioState((current) => ({
      ...current,
      records: [nextRecord, ...current.records]
    }));
    setDraftValues(buildDefaultRecordValues(selectedForm));
    setActiveTab("records");
    setNotice({
      tone: "success",
      text: "Record saved locally."
    });
  };

  const deleteRecord = (recordId: string) => {
    setStudioState((current) => ({
      ...current,
      records: current.records.filter((record) => record.id !== recordId)
    }));
    setNotice({
      tone: "success",
      text: "Record deleted."
    });
  };

  const renderFieldEditor = (section: FormSectionDefinition, field: FormFieldDefinition) => (
    <div
      key={field.id}
      className="rounded-[24px] border border-[rgba(110,211,255,0.14)] bg-[rgba(5,28,45,0.58)] px-4 py-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-[0.76rem] uppercase tracking-[0.14em] text-[var(--ode-accent)]">{field.type.replace("_", " ")}</div>
        <button type="button" className="ode-mini-btn h-8 px-3 text-[#ffd2c2]" onClick={() => deleteField(section.id, field.id)}>
          {COPY.deleteField}
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="block">
          <div className="mb-2 text-[0.8rem] text-[var(--ode-text-dim)]">{COPY.fieldLabel}</div>
          <input
            className="ode-input h-11 w-full rounded-[16px] px-4"
            value={field.label}
            onChange={(event) =>
              updateField(section.id, field.id, (currentField, form) => {
                const nextLabel = event.target.value;
                const shouldFollowLabel = currentField.key === slugifyFormFieldKey(currentField.label);
                return {
                  ...currentField,
                  label: nextLabel,
                  key: shouldFollowLabel
                    ? ensureUniqueFieldKey(nextLabel, collectFieldKeys(form, currentField.id), currentField.key)
                    : currentField.key
                };
              })
            }
          />
        </label>
        <label className="block">
          <div className="mb-2 text-[0.8rem] text-[var(--ode-text-dim)]">{COPY.fieldKey}</div>
          <input
            className="ode-input h-11 w-full rounded-[16px] px-4"
            value={field.key}
            onChange={(event) =>
              updateField(section.id, field.id, (currentField, form) => ({
                ...currentField,
                key: ensureUniqueFieldKey(event.target.value, collectFieldKeys(form, currentField.id), currentField.key)
              }))
            }
          />
        </label>
        <label className="block">
          <div className="mb-2 text-[0.8rem] text-[var(--ode-text-dim)]">{COPY.fieldType}</div>
          <select
            className="ode-input h-11 w-full rounded-[16px] px-4"
            value={field.type}
            onChange={(event) =>
              updateField(section.id, field.id, (currentField) => ({
                ...currentField,
                type: event.target.value as FormFieldType,
                options: fieldTypeSupportsOptions(event.target.value as FormFieldType) ? currentField.options : [],
                mask: event.target.value === "identifier" ? currentField.mask : "",
                minLength: fieldTypeSupportsLengthRules(event.target.value as FormFieldType) ? currentField.minLength : null,
                maxLength: fieldTypeSupportsLengthRules(event.target.value as FormFieldType) ? currentField.maxLength : null,
                minValue: fieldTypeSupportsNumericRules(event.target.value as FormFieldType) ? currentField.minValue : null,
                maxValue: fieldTypeSupportsNumericRules(event.target.value as FormFieldType) ? currentField.maxValue : null
              }))
            }
          >
            {FORM_FIELD_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-3 rounded-[16px] border border-[rgba(110,211,255,0.14)] bg-[rgba(4,21,33,0.52)] px-4 py-3">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(event) =>
              updateField(section.id, field.id, (currentField) => ({
                ...currentField,
                required: event.target.checked
              }))
            }
          />
          <span className="text-[0.92rem] text-[var(--ode-text)]">{COPY.fieldRequired}</span>
        </label>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block">
          <div className="mb-2 text-[0.8rem] text-[var(--ode-text-dim)]">{COPY.fieldPlaceholder}</div>
          <input
            className="ode-input h-11 w-full rounded-[16px] px-4"
            value={field.placeholder}
            onChange={(event) => updateField(section.id, field.id, (currentField) => ({ ...currentField, placeholder: event.target.value }))}
          />
        </label>
        <label className="block">
          <div className="mb-2 text-[0.8rem] text-[var(--ode-text-dim)]">{COPY.fieldHelpText}</div>
          <input
            className="ode-input h-11 w-full rounded-[16px] px-4"
            value={field.helpText}
            onChange={(event) => updateField(section.id, field.id, (currentField) => ({ ...currentField, helpText: event.target.value }))}
          />
        </label>
      </div>
    </div>
  );

  const renderEntryField = (field: FormFieldDefinition) => {
    const value = draftValues[field.key];
    if (field.type === "long_text") {
      return (
        <label key={field.id} className="block">
          <div className="mb-2 text-[0.82rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">{field.label}</div>
          <textarea
            className="ode-input min-h-[132px] w-full rounded-[20px] px-4 py-3"
            placeholder={field.placeholder}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => updateDraftValue(field.key, event.target.value)}
          />
        </label>
      );
    }
    if (field.type === "yes_no") {
      return (
        <label key={field.id} className="block">
          <div className="mb-2 text-[0.82rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">{field.label}</div>
          <select
            className="ode-input h-11 w-full rounded-[16px] px-4"
            value={typeof value === "string" ? value : ""}
            onChange={(event) => updateDraftValue(field.key, event.target.value)}
          >
            <option value="">{COPY.notAnswered}</option>
            <option value="yes">{COPY.yes}</option>
            <option value="no">{COPY.no}</option>
          </select>
        </label>
      );
    }
    if (field.type === "single_select") {
      return (
        <label key={field.id} className="block">
          <div className="mb-2 text-[0.82rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">{field.label}</div>
          <select
            className="ode-input h-11 w-full rounded-[16px] px-4"
            value={typeof value === "string" ? value : ""}
            onChange={(event) => updateDraftValue(field.key, event.target.value)}
          >
            <option value="">{COPY.notAnswered}</option>
            {field.options.map((option) => (
              <option key={`${field.id}-${option}`} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      );
    }
    if (field.type === "multi_select") {
      const selectedValues = isStringArray(value) ? value : [];
      return (
        <div key={field.id} className="block">
          <div className="mb-2 text-[0.82rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">{field.label}</div>
          <div className="grid gap-2 md:grid-cols-2">
            {field.options.map((option) => (
              <label
                key={`${field.id}-${option}`}
                className="flex items-center gap-3 rounded-[16px] border border-[rgba(110,211,255,0.14)] bg-[rgba(4,21,33,0.52)] px-4 py-3"
              >
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option)}
                  onChange={(event) => {
                    const nextValues = event.target.checked
                      ? [...selectedValues, option]
                      : selectedValues.filter((item) => item !== option);
                    updateDraftValue(field.key, nextValues);
                  }}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </div>
      );
    }
    if (field.type === "attachment") {
      const attachments = isAttachmentArray(value) ? value : [];
      return (
        <label key={field.id} className="block">
          <div className="mb-2 text-[0.82rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">{field.label}</div>
          <input
            type="file"
            multiple
            className="ode-input h-11 w-full rounded-[16px] px-4 py-[9px]"
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              updateDraftValue(
                field.key,
                Array.from(event.target.files ?? []).map((file) => ({
                  name: file.name,
                  size: file.size,
                  lastModified: file.lastModified
                }))
              );
            }}
          />
          {attachments.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {attachments.map((attachment) => (
                <span
                  key={`${field.id}-${attachment.name}-${attachment.lastModified}`}
                  className="rounded-full border border-[rgba(93,193,255,0.28)] bg-[rgba(18,70,104,0.28)] px-3 py-1 text-[0.78rem] text-[var(--ode-text)]"
                >
                  {attachment.name}
                </span>
              ))}
            </div>
          ) : null}
        </label>
      );
    }
    return (
      <label key={field.id} className="block">
        <div className="mb-2 text-[0.82rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">{field.label}</div>
        <input
          type={field.type === "date" ? "date" : field.type === "number" || field.type === "decimal" || field.type === "currency" ? "number" : field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
          step={field.type === "decimal" || field.type === "currency" ? "0.01" : field.type === "number" ? "1" : undefined}
          className="ode-input h-11 w-full rounded-[16px] px-4"
          placeholder={field.placeholder}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => updateDraftValue(field.key, event.target.value)}
        />
      </label>
    );
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      onMouseDownCapture={onActivateFormsSurface}
      onKeyDownCapture={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("input, textarea, select")) {
          event.stopPropagation();
        }
      }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          className="mx-auto flex max-w-[1240px] flex-col gap-5 px-4 py-5 lg:px-6"
          onContextMenu={(event) => {
            const target = event.target as HTMLElement;
            if (target.closest("input, textarea, select, button, label")) return;
            onOpenSurfaceContextMenu(event);
          }}
        >
          <section className="rounded-[34px] border border-[rgba(110,211,255,0.16)] bg-[linear-gradient(180deg,rgba(4,24,39,0.96),rgba(2,18,31,0.98))] px-5 py-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)] lg:px-6">
            <div className="text-[0.78rem] uppercase tracking-[0.18em] text-[var(--ode-accent)]">{COPY.title}</div>
            <div className="mt-2 max-w-[820px] text-[1rem] leading-7 text-[var(--ode-text-muted)]">
              {workspaceName ? `Build digital forms for ${workspaceName}.` : "Build digital forms without leaving the current shell."}
            </div>
            <div className="mt-4 rounded-[20px] border border-[rgba(110,211,255,0.12)] bg-[rgba(5,27,42,0.46)] px-4 py-3 text-[0.9rem] text-[var(--ode-text-muted)]">
              {COPY.localHint}
            </div>
          </section>

          {notice ? (
            <div className="rounded-[20px] border border-[rgba(93,193,255,0.28)] bg-[rgba(18,70,104,0.28)] px-4 py-3 text-[0.92rem] text-[#b8e6ff]">
              {notice.text}
            </div>
          ) : null}

          <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="rounded-[30px] border border-[rgba(110,211,255,0.14)] bg-[linear-gradient(180deg,rgba(4,24,39,0.94),rgba(2,18,31,0.97))] px-4 py-4 shadow-[0_18px_48px_rgba(0,0,0,0.18)]">
              <div className="flex items-start justify-between gap-3">
                <div className="text-[0.76rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">{COPY.listTitle}</div>
                <button type="button" className="ode-primary-btn h-10 px-4" onClick={createNewForm}>
                  +
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="ode-mini-btn h-9 px-3" onClick={createNewForm}>
                  {COPY.newForm}
                </button>
                <button type="button" className="ode-mini-btn h-9 px-3" onClick={duplicateSelectedForm} disabled={!selectedForm}>
                  {COPY.duplicateForm}
                </button>
                <button type="button" className="ode-mini-btn h-9 px-3 text-[#ffd2c2]" onClick={deleteSelectedForm} disabled={!selectedForm}>
                  {COPY.deleteForm}
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {studioState.forms.length > 0 ? (
                  studioState.forms.map((form) => (
                    <button
                      key={form.id}
                      type="button"
                      className={`flex w-full flex-col rounded-[22px] border px-4 py-4 text-left transition ${
                        form.id === selectedFormId
                          ? "border-[rgba(93,193,255,0.44)] bg-[rgba(18,70,104,0.34)]"
                          : "border-[rgba(110,211,255,0.12)] bg-[rgba(4,21,33,0.52)] hover:border-[rgba(93,193,255,0.28)]"
                      }`}
                      onClick={() => {
                        setSelectedFormId(form.id);
                        setActiveTab("builder");
                      }}
                    >
                      <span className="ode-wrap-text text-[1rem] font-semibold text-[var(--ode-text)]">{form.title}</span>
                      <span className="mt-1 text-[0.82rem] text-[var(--ode-text-muted)]">
                        {form.sections.length} sections / {form.sections.reduce((total, section) => total + section.fields.length, 0)} fields
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="rounded-[22px] border border-dashed border-[rgba(110,211,255,0.16)] bg-[rgba(4,21,33,0.46)] px-4 py-5 text-[0.9rem] text-[var(--ode-text-muted)]">
                    {COPY.emptyState}
                  </div>
                )}
              </div>
            </aside>

            <section className="min-w-0 rounded-[30px] border border-[rgba(110,211,255,0.14)] bg-[linear-gradient(180deg,rgba(4,24,39,0.94),rgba(2,18,31,0.97))] px-4 py-4 shadow-[0_18px_48px_rgba(0,0,0,0.18)] lg:px-5">
              {selectedForm ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="ode-wrap-text text-[1.35rem] font-semibold text-[var(--ode-text)]">{selectedForm.title}</div>
                    <div className="flex flex-wrap items-center gap-2 rounded-[18px] border border-[rgba(110,211,255,0.14)] bg-[rgba(4,21,33,0.5)] p-1">
                      <button type="button" className={`ode-mini-btn h-9 px-4 ${activeTab === "builder" ? "ode-mini-btn-active" : ""}`} onClick={() => setActiveTab("builder")}>{COPY.builder}</button>
                      <button type="button" className={`ode-mini-btn h-9 px-4 ${activeTab === "entry" ? "ode-mini-btn-active" : ""}`} onClick={() => setActiveTab("entry")}>{COPY.entry}</button>
                      <button type="button" className={`ode-mini-btn h-9 px-4 ${activeTab === "records" ? "ode-mini-btn-active" : ""}`} onClick={() => setActiveTab("records")}>{COPY.records}</button>
                    </div>
                  </div>
                  {activeTab === "builder" ? (
                    <div className="mt-5 space-y-5">
                      <section className="rounded-[26px] border border-[rgba(110,211,255,0.14)] bg-[rgba(5,28,45,0.58)] px-4 py-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="block">
                            <div className="mb-2 text-[0.82rem] text-[var(--ode-text-dim)]">{COPY.formTitle}</div>
                            <input
                              className="ode-input h-11 w-full rounded-[16px] px-4"
                              value={selectedForm.title}
                              onChange={(event) => updateSelectedForm((form) => ({ ...form, title: event.target.value }))}
                            />
                          </label>
                          <label className="block">
                            <div className="mb-2 text-[0.82rem] text-[var(--ode-text-dim)]">{COPY.formDescription}</div>
                            <input
                              className="ode-input h-11 w-full rounded-[16px] px-4"
                              value={selectedForm.description}
                              onChange={(event) => updateSelectedForm((form) => ({ ...form, description: event.target.value }))}
                            />
                          </label>
                        </div>
                      </section>

                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[0.78rem] uppercase tracking-[0.16em] text-[var(--ode-text-dim)]">Sections</div>
                        <button type="button" className="ode-primary-btn h-10 px-4" onClick={addSection}>
                          {COPY.addSection}
                        </button>
                      </div>

                      {selectedForm.sections.map((section) => (
                        <section
                          key={section.id}
                          className="rounded-[28px] border border-[rgba(110,211,255,0.14)] bg-[rgba(4,21,33,0.52)] px-4 py-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[0.78rem] uppercase tracking-[0.16em] text-[var(--ode-accent)]">{section.title || COPY.sectionTitle}</div>
                            <button type="button" className="ode-mini-btn h-8 px-3 text-[#ffd2c2]" onClick={() => deleteSection(section.id)}>
                              {COPY.deleteSection}
                            </button>
                          </div>
                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <label className="block">
                              <div className="mb-2 text-[0.82rem] text-[var(--ode-text-dim)]">{COPY.sectionTitle}</div>
                              <input
                                className="ode-input h-11 w-full rounded-[16px] px-4"
                                value={section.title}
                                onChange={(event) => updateSection(section.id, (currentSection) => ({ ...currentSection, title: event.target.value }))}
                              />
                            </label>
                            <label className="block">
                              <div className="mb-2 text-[0.82rem] text-[var(--ode-text-dim)]">{COPY.sectionDescription}</div>
                              <input
                                className="ode-input h-11 w-full rounded-[16px] px-4"
                                value={section.description}
                                onChange={(event) => updateSection(section.id, (currentSection) => ({ ...currentSection, description: event.target.value }))}
                              />
                            </label>
                          </div>
                          <div className="mt-4 flex justify-end">
                            <button type="button" className="ode-mini-btn h-9 px-4" onClick={() => addField(section.id)}>
                              {COPY.addField}
                            </button>
                          </div>
                          <div className="mt-4 space-y-4">{section.fields.map((field) => renderFieldEditor(section, field))}</div>
                        </section>
                      ))}
                    </div>
                  ) : null}

                  {activeTab === "entry" ? (
                    <div className="mt-5 space-y-5">
                      {selectedForm.sections.map((section) => (
                        <section
                          key={`entry-${section.id}`}
                          className="rounded-[28px] border border-[rgba(110,211,255,0.14)] bg-[rgba(4,21,33,0.52)] px-4 py-4"
                        >
                          <div className="text-[0.78rem] uppercase tracking-[0.16em] text-[var(--ode-accent)]">{section.title}</div>
                          {section.description ? <div className="mt-2 text-[0.92rem] text-[var(--ode-text-muted)]">{section.description}</div> : null}
                          <div className="mt-4 grid gap-5 md:grid-cols-2">{section.fields.map((field) => renderEntryField(field))}</div>
                        </section>
                      ))}
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <button type="button" className="ode-text-btn h-11 px-5" onClick={resetDraft}>
                          {COPY.resetRecord}
                        </button>
                        <button type="button" className="ode-primary-btn h-11 px-5" onClick={saveRecord}>
                          {COPY.saveRecord}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {activeTab === "records" ? (
                    <div className="mt-5">
                      {selectedRecords.length > 0 ? (
                        <div className="overflow-hidden rounded-[26px] border border-[rgba(110,211,255,0.14)] bg-[rgba(4,21,33,0.52)]">
                          <div className="overflow-x-auto">
                            <table className="min-w-full border-collapse text-left">
                              <thead>
                                <tr className="border-b border-[rgba(110,211,255,0.12)] text-[0.75rem] uppercase tracking-[0.14em] text-[var(--ode-text-dim)]">
                                  <th className="px-4 py-3">Created</th>
                                  {selectedFormFields.slice(0, 6).map((field) => (
                                    <th key={`head-${field.id}`} className="px-4 py-3">
                                      {field.label}
                                    </th>
                                  ))}
                                  <th className="px-4 py-3">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedRecords.map((record) => (
                                  <tr key={record.id} className="border-b border-[rgba(110,211,255,0.08)] text-[0.92rem] text-[var(--ode-text)]">
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(record.createdAt))}
                                    </td>
                                    {selectedFormFields.slice(0, 6).map((field) => (
                                      <td key={`${record.id}-${field.id}`} className="max-w-[220px] px-4 py-3 text-[var(--ode-text-muted)]">
                                        <div className="truncate">{formatValue(record.values[field.key], field, locale)}</div>
                                      </td>
                                    ))}
                                    <td className="px-4 py-3">
                                      <button type="button" className="ode-mini-btn h-8 px-3 text-[#ffd2c2]" onClick={() => deleteRecord(record.id)}>
                                        Delete
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-[26px] border border-dashed border-[rgba(110,211,255,0.16)] bg-[rgba(4,21,33,0.42)] px-4 py-5 text-[0.92rem] text-[var(--ode-text-muted)]">
                          {COPY.noRecords}
                        </div>
                      )}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="rounded-[26px] border border-dashed border-[rgba(110,211,255,0.16)] bg-[rgba(4,21,33,0.42)] px-4 py-5 text-[0.92rem] text-[var(--ode-text-muted)]">
                  {COPY.emptyState}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
