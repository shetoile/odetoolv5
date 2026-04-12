import { useMemo, useState, type ReactNode } from "react";
import { ChantierModulePickerModal } from "@/components/modals/ChantierModulePickerModal";
import { QuickAppIcon } from "@/components/quick-apps/QuickAppIcon";
import { useDraggableModalSurface } from "@/hooks/useDraggableModalSurface";
import {
  buildChantierModuleCatalog,
  getLatestModuleRecord,
  getModuleField,
  getRecordValueAsText,
  type ChantierModuleDefinition
} from "@/features/ode/chantierModules";
import { readChantierProfile } from "@/features/ode/chantierProfile";
import type { LanguageCode, TranslationParams } from "@/lib/i18n";
import { createNodeQuickAppItem, getNodeQuickApps, type NodeQuickAppItem } from "@/lib/nodeQuickApps";
import {
  PROCEDURE_RECORDS_PROPERTY_KEY,
  type ProcedureFieldDefinition,
  type ProcedureFieldType,
  type ProcedureRecord,
  type ProcedureRecordValue
} from "@/lib/procedureDatabase";
import type { ReusableLibraryIndexItem } from "@/lib/reusableLibraries";
import type { AppNode } from "@/lib/types";

type TranslateFn = (key: string, params?: TranslationParams) => string;
type WorkspacePanelMode = "overview" | "execution";

type FeedDraft = { moduleId: string | null; message: string; tags: string[]; freeTags: string };
type JournalDraft = { moduleId: string | null; title: string; body: string; tags: string[]; freeTags: string };
type MeetingDraft = { moduleId: string | null; title: string; provider: string; url: string; when: string; notes: string };
type MessagingDraft = { moduleId: string | null; to: string; cc: string; bcc: string; subject: string; body: string };

type ChantierWorkspacePanelProps = {
  t: TranslateFn;
  language: LanguageCode;
  mode: WorkspacePanelMode;
  chantierNode: AppNode;
  browseNode?: AppNode | null;
  allNodes: AppNode[];
  byParent: Map<string, AppNode[]>;
  databaseTemplates: ReusableLibraryIndexItem[];
  currentUserDisplayName?: string | null;
  onSaveNodeDescription: (nodeId: string, description: string | null) => Promise<void> | void;
  onSaveNodeProperties: (nodeId: string, properties: Record<string, unknown>) => Promise<void> | void;
  onLaunchQuickApp: (
    item: NodeQuickAppItem,
    launchContext?: { scope?: "global" | "workspace" | "node"; sourceNodeId?: string | null }
  ) => Promise<void> | void;
  onManageQuickApps: (nodeId: string) => void;
  onOpenTimeline: (nodeId: string) => void;
  onCreateModuleFromTemplate: (itemId: string, chantierNodeId: string) => Promise<void> | void;
};

function buildCopy(language: LanguageCode) {
  return language === "fr"
      ? {
        addModule: "Ajouter un module",
        appsTitle: "Applications",
        manageApps: "Gerer les apps",
        linkedAppsEmpty: "Aucune application liee a ce chantier pour le moment. Ajoutez ici un outil HTML local, une application web ou un futur connecteur CRM/ERP.",
        open: "Ouvrir",
        newPost: "Nouveau post",
        newEntry: "Nouvelle entree",
        edit: "Editer",
        remove: "Supprimer",
        save: "Enregistrer",
        cancel: "Annuler",
        openMeeting: "Ouvrir la reunion",
        composeEmail: "Composer",
        tags: "Tags",
        message: "Message",
        title: "Titre",
        body: "Contenu",
        provider: "Plateforme",
        link: "Lien",
        when: "Planifie",
        notes: "Notes",
        to: "A",
        cc: "Cc",
        bcc: "Cci",
        subject: "Objet",
        today: "Aujourd'hui",
        contributors: "Contributeurs",
        close: "Fermer",
        you: "Utilisateur",
        noSummary: "Aucun resume"
      }
    : {
        addModule: "Add module",
        appsTitle: "Apps",
        manageApps: "Manage apps",
        linkedAppsEmpty: "No linked apps on this chantier yet. Add a local HTML tool, a web app, or a future CRM/ERP connector here.",
        open: "Open",
        newPost: "New post",
        newEntry: "New entry",
        edit: "Edit",
        remove: "Delete",
        save: "Save",
        cancel: "Cancel",
        openMeeting: "Open meeting",
        composeEmail: "Compose email",
        tags: "Tags",
        message: "Message",
        title: "Title",
        body: "Body",
        provider: "Provider",
        link: "Link",
        when: "Scheduled",
        notes: "Notes",
        to: "To",
        cc: "Cc",
        bcc: "Bcc",
        subject: "Subject",
        today: "Today",
        contributors: "Contributors",
        close: "Close",
        you: "User",
        noSummary: "No summary"
      };
}

function normalizeText(value: string): string | null {
  const trimmed = value.replace(/\r\n/g, "\n").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function createRecordId() {
  return `ode-module-record-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatTimestamp(language: LanguageCode, timestamp: number): string {
  try {
    return new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(timestamp);
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}

function buildTimestampValue(fieldType: ProcedureFieldType, timestamp: number): string {
  const date = new Date(timestamp);
  if (fieldType === "date") return date.toISOString().slice(0, 10);
  if (fieldType === "time") return date.toISOString().slice(11, 16);
  return date.toISOString();
}

function clipText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...` : value;
}

function setRecordValue(nextValues: Record<string, ProcedureRecordValue>, field: ProcedureFieldDefinition | null, value: string | string[] | null) {
  if (!field || value === null) return;
  if (Array.isArray(value)) {
    const normalized = value.map((item) => item.trim()).filter(Boolean);
    if (normalized.length === 0) return;
    nextValues[field.nodeId] = field.type === "single_select" ? normalized[0] ?? "" : normalized;
    return;
  }
  const normalized = value.trim();
  if (!normalized) return;
  nextValues[field.nodeId] = normalized;
}

function getFieldString(record: ProcedureRecord | null, field: ProcedureFieldDefinition | null): string {
  if (!record || !field) return "";
  const raw = record.values[field.nodeId];
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw.join(", ");
  if (raw && typeof raw === "object") return Object.values(raw).join(", ");
  return "";
}

function getFieldArray(record: ProcedureRecord | null, field: ProcedureFieldDefinition | null): string[] {
  if (!record || !field) return [];
  const raw = record.values[field.nodeId];
  if (Array.isArray(raw)) return raw.filter((item) => item.trim().length > 0);
  if (typeof raw === "string") {
    return raw.split(/[,\n;]+/g).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function FieldLine({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-start">
      <div className="text-[0.74rem] uppercase tracking-[0.18em] text-[rgba(148,203,232,0.68)]">{label}</div>
      <div className="break-words text-[0.98rem] leading-6 text-[#eefbff]">{value}</div>
    </div>
  );
}

function TagPills({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex h-8 items-center rounded-full border border-[rgba(88,197,255,0.18)] bg-[rgba(8,41,62,0.86)] px-3 text-[0.72rem] font-medium uppercase tracking-[0.14em] text-[rgba(209,241,255,0.9)]"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function ModuleShell({
  title,
  actions,
  children
}: {
  title: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-[rgba(88,197,255,0.14)] bg-[rgba(4,23,38,0.82)] p-5 shadow-[0_22px_58px_rgba(0,0,0,0.18)]">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[1.12rem] font-semibold text-[#eefbff]">{title}</h3>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

function ModalShell({
  open,
  title,
  closeLabel,
  onClose,
  children,
  footer
}: {
  open: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { surfaceRef, surfaceStyle, handlePointerDown } = useDraggableModalSurface({ open });
  if (!open) return null;
  return (
    <div className="ode-overlay-scrim fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-sm">
      <div
        ref={surfaceRef}
        style={surfaceStyle}
        className="ode-modal flex w-full max-w-3xl flex-col overflow-hidden rounded-[24px] border border-[var(--ode-border-strong)]"
      >
        <div className="ode-modal-drag-handle flex items-center justify-between border-b border-[var(--ode-border)] px-6 py-5" onPointerDown={handlePointerDown}>
          <h2 className="text-[1.5rem] font-semibold tracking-tight text-[var(--ode-accent)]">{title}</h2>
          <button type="button" className="ode-icon-btn h-10 w-10" aria-label={closeLabel} onClick={onClose}>
            {"\u00d7"}
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-3 border-t border-[var(--ode-border)] px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

function buildMailtoUrl(params: { to: string; cc: string; bcc: string; subject: string; body: string }): string | null {
  const to = params.to.trim();
  if (!to) return null;
  const query = new URLSearchParams();
  if (params.cc.trim()) query.set("cc", params.cc.trim());
  if (params.bcc.trim()) query.set("bcc", params.bcc.trim());
  if (params.subject.trim()) query.set("subject", params.subject.trim());
  if (params.body.trim()) query.set("body", params.body.trim());
  const encoded = query.toString();
  return `mailto:${to}${encoded ? `?${encoded}` : ""}`;
}

export function ChantierWorkspacePanel({
  language,
  mode,
  chantierNode,
  browseNode,
  allNodes,
  byParent,
  databaseTemplates,
  currentUserDisplayName,
  onSaveNodeProperties,
  onLaunchQuickApp,
  onManageQuickApps,
  onCreateModuleFromTemplate
}: ChantierWorkspacePanelProps) {
  const copy = useMemo(() => buildCopy(language), [language]);
  const userName = normalizeText(currentUserDisplayName ?? "") ?? copy.you;
  const chantierProfile = useMemo(() => readChantierProfile(chantierNode), [chantierNode]);
  const linkedApps = useMemo(() => getNodeQuickApps(chantierNode), [chantierNode]);
  const moduleCatalog = useMemo(() => buildChantierModuleCatalog(allNodes, chantierNode.id, byParent), [allNodes, byParent, chantierNode.id]);
  const modules = moduleCatalog.modules;
  const [modulePickerOpen, setModulePickerOpen] = useState(false);
  const [feedDraft, setFeedDraft] = useState<FeedDraft>({ moduleId: null, message: "", tags: [], freeTags: "" });
  const [journalDraft, setJournalDraft] = useState<JournalDraft>({ moduleId: null, title: "", body: "", tags: [], freeTags: "" });
  const [meetingDraft, setMeetingDraft] = useState<MeetingDraft>({ moduleId: null, title: "", provider: "", url: "", when: "", notes: "" });
  const [messagingDraft, setMessagingDraft] = useState<MessagingDraft>({ moduleId: null, to: "", cc: "", bcc: "", subject: "", body: "" });
  const [busyModuleId, setBusyModuleId] = useState<string | null>(null);

  const launchTarget = async (label: string, target: string, iconKey: NodeQuickAppItem["iconKey"]) => {
    await onLaunchQuickApp(createNodeQuickAppItem({ label, kind: "url", target, iconKey }), {
      scope: "node",
      sourceNodeId: browseNode?.id ?? chantierNode.id
    });
  };

  const saveModuleRecords = async (module: ChantierModuleDefinition, nextRecords: ProcedureRecord[]) => {
    setBusyModuleId(module.table.node.id);
    try {
      await Promise.resolve(
        onSaveNodeProperties(module.table.node.id, {
          ...(module.table.node.properties ?? {}),
          [PROCEDURE_RECORDS_PROPERTY_KEY]: nextRecords
        })
      );
    } finally {
      setBusyModuleId((current) => (current === module.table.node.id ? null : current));
    }
  };

  const headerBadges = [
    chantierProfile.owner ? chantierProfile.owner : null,
    chantierProfile.planningWindow ? chantierProfile.planningWindow : null
  ].filter((value): value is string => Boolean(value));

  const feedModule = feedDraft.moduleId ? modules.find((item) => item.table.node.id === feedDraft.moduleId) ?? null : null;
  const journalModule = journalDraft.moduleId ? modules.find((item) => item.table.node.id === journalDraft.moduleId) ?? null : null;
  const meetingModule = meetingDraft.moduleId ? modules.find((item) => item.table.node.id === meetingDraft.moduleId) ?? null : null;
  const messagingModule = messagingDraft.moduleId ? modules.find((item) => item.table.node.id === messagingDraft.moduleId) ?? null : null;

  const closeFeedDraft = () => setFeedDraft({ moduleId: null, message: "", tags: [], freeTags: "" });
  const closeJournalDraft = () => setJournalDraft({ moduleId: null, title: "", body: "", tags: [], freeTags: "" });
  const closeMeetingDraft = () => setMeetingDraft({ moduleId: null, title: "", provider: "", url: "", when: "", notes: "" });
  const closeMessagingDraft = () => setMessagingDraft({ moduleId: null, to: "", cc: "", bcc: "", subject: "", body: "" });

  const openFeedDraft = (module: ChantierModuleDefinition) => {
    setFeedDraft({ moduleId: module.table.node.id, message: "", tags: [], freeTags: "" });
  };
  const openJournalDraft = (module: ChantierModuleDefinition) => {
    setJournalDraft({ moduleId: module.table.node.id, title: "", body: "", tags: [], freeTags: "" });
  };
  const openMeetingDraft = (module: ChantierModuleDefinition) => {
    const record = getLatestModuleRecord(module);
    setMeetingDraft({
      moduleId: module.table.node.id,
      title: getFieldString(record, getModuleField(module, "title")),
      provider: getFieldString(record, getModuleField(module, "provider")),
      url: getFieldString(record, getModuleField(module, "meeting_url")),
      when: getFieldString(record, getModuleField(module, "scheduled_at")),
      notes: getFieldString(record, getModuleField(module, "notes"))
    });
  };
  const openMessagingDraft = (module: ChantierModuleDefinition) => {
    const record = getLatestModuleRecord(module);
    setMessagingDraft({
      moduleId: module.table.node.id,
      to: getFieldString(record, getModuleField(module, "to")),
      cc: getFieldString(record, getModuleField(module, "cc")),
      bcc: getFieldString(record, getModuleField(module, "bcc")),
      subject: getFieldString(record, getModuleField(module, "subject")),
      body: getFieldString(record, getModuleField(module, "body"))
    });
  };

  const saveFeed = async () => {
    if (!feedModule) return;
    const message = normalizeText(feedDraft.message);
    if (!message) return;
    const timestamp = Date.now();
    const nextValues: Record<string, ProcedureRecordValue> = {};
    const tagsField = getModuleField(feedModule, "tags");
    const createdAtField = getModuleField(feedModule, "created_at");
    const freeTags = feedDraft.freeTags
      .split(/[,\n;]+/g)
      .map((item) => item.trim())
      .filter(Boolean);
    setRecordValue(nextValues, getModuleField(feedModule, "author"), userName);
    setRecordValue(nextValues, getModuleField(feedModule, "message") ?? getModuleField(feedModule, "body"), message);
    setRecordValue(nextValues, tagsField, tagsField?.options.length ? feedDraft.tags : freeTags);
    if (createdAtField) {
      setRecordValue(nextValues, createdAtField, buildTimestampValue(createdAtField.type, timestamp));
    }
    await saveModuleRecords(feedModule, [
      {
        id: createRecordId(),
        createdAt: timestamp,
        updatedAt: timestamp,
        values: nextValues
      },
      ...feedModule.table.records
    ]);
    closeFeedDraft();
  };

  const saveJournal = async () => {
    if (!journalModule) return;
    const title = normalizeText(journalDraft.title);
    const body = normalizeText(journalDraft.body);
    if (!title || !body) return;
    const timestamp = Date.now();
    const nextValues: Record<string, ProcedureRecordValue> = {};
    const tagsField = getModuleField(journalModule, "tags");
    const createdAtField = getModuleField(journalModule, "created_at");
    const freeTags = journalDraft.freeTags
      .split(/[,\n;]+/g)
      .map((item) => item.trim())
      .filter(Boolean);
    setRecordValue(nextValues, getModuleField(journalModule, "title"), title);
    setRecordValue(nextValues, getModuleField(journalModule, "body") ?? getModuleField(journalModule, "message"), body);
    setRecordValue(nextValues, getModuleField(journalModule, "author"), userName);
    setRecordValue(nextValues, tagsField, tagsField?.options.length ? journalDraft.tags : freeTags);
    if (createdAtField) {
      setRecordValue(nextValues, createdAtField, buildTimestampValue(createdAtField.type, timestamp));
    }
    await saveModuleRecords(journalModule, [
      {
        id: createRecordId(),
        createdAt: timestamp,
        updatedAt: timestamp,
        values: nextValues
      },
      ...journalModule.table.records
    ]);
    closeJournalDraft();
  };

  const saveMeeting = async () => {
    if (!meetingModule) return;
    const timestamp = Date.now();
    const existing = getLatestModuleRecord(meetingModule);
    const nextValues: Record<string, ProcedureRecordValue> = {};
    setRecordValue(nextValues, getModuleField(meetingModule, "title"), normalizeText(meetingDraft.title));
    setRecordValue(nextValues, getModuleField(meetingModule, "provider"), normalizeText(meetingDraft.provider));
    setRecordValue(nextValues, getModuleField(meetingModule, "meeting_url"), normalizeText(meetingDraft.url));
    setRecordValue(nextValues, getModuleField(meetingModule, "scheduled_at"), normalizeText(meetingDraft.when));
    setRecordValue(nextValues, getModuleField(meetingModule, "notes"), normalizeText(meetingDraft.notes));
    await saveModuleRecords(meetingModule, [
      {
        id: existing?.id ?? createRecordId(),
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
        values: nextValues
      }
    ]);
    closeMeetingDraft();
  };

  const saveMessaging = async () => {
    if (!messagingModule) return;
    const timestamp = Date.now();
    const existing = getLatestModuleRecord(messagingModule);
    const nextValues: Record<string, ProcedureRecordValue> = {};
    setRecordValue(nextValues, getModuleField(messagingModule, "to"), normalizeText(messagingDraft.to));
    setRecordValue(nextValues, getModuleField(messagingModule, "cc"), normalizeText(messagingDraft.cc));
    setRecordValue(nextValues, getModuleField(messagingModule, "bcc"), normalizeText(messagingDraft.bcc));
    setRecordValue(nextValues, getModuleField(messagingModule, "subject"), normalizeText(messagingDraft.subject));
    setRecordValue(nextValues, getModuleField(messagingModule, "body"), normalizeText(messagingDraft.body));
    await saveModuleRecords(messagingModule, [
      {
        id: existing?.id ?? createRecordId(),
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
        values: nextValues
      }
    ]);
    closeMessagingDraft();
  };

  const removeRecord = async (module: ChantierModuleDefinition, recordId: string) => {
    await saveModuleRecords(
      module,
      module.table.records.filter((record) => record.id !== recordId)
    );
  };

  const renderFeedCard = (module: ChantierModuleDefinition) => {
    const authorField = getModuleField(module, "author");
    const messageField = getModuleField(module, "message") ?? getModuleField(module, "body");
    const tagsField = getModuleField(module, "tags");
    const records = [...module.table.records].sort((left, right) => right.updatedAt - left.updatedAt).slice(0, mode === "overview" ? 3 : 5);
    return (
      <ModuleShell
        key={module.table.node.id}
        title={module.table.node.name}
        actions={<button type="button" className="ode-primary-btn h-10 px-4" onClick={() => openFeedDraft(module)}>{copy.newPost}</button>}
      >
        <div className="space-y-3">
          {records.map((record) => (
            <div key={record.id} className="rounded-[20px] border border-[rgba(88,197,255,0.12)] bg-[rgba(7,30,46,0.72)] px-4 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <TagPills tags={tagsField ? getFieldArray(record, tagsField) : []} />
                {authorField ? <span className="text-[0.9rem] font-medium text-[#eefbff]">{getFieldString(record, authorField) || userName}</span> : null}
                <span className="text-[0.82rem] text-[rgba(188,225,245,0.58)]">{formatTimestamp(language, record.updatedAt)}</span>
                <button type="button" className="ode-danger-btn ml-auto h-9 px-3" onClick={() => { void removeRecord(module, record.id); }}>{copy.remove}</button>
              </div>
              {messageField ? (
                <div className="mt-3 whitespace-pre-wrap text-[0.98rem] leading-7 text-[rgba(225,244,255,0.92)]">
                  {clipText(getRecordValueAsText(moduleCatalog.model, record, messageField), mode === "overview" ? 180 : 360)}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </ModuleShell>
    );
  };

  const renderJournalCard = (module: ChantierModuleDefinition) => {
    const titleField = getModuleField(module, "title");
    const bodyField = getModuleField(module, "body") ?? getModuleField(module, "message");
    const authorField = getModuleField(module, "author");
    const records = [...module.table.records].sort((left, right) => right.updatedAt - left.updatedAt).slice(0, mode === "overview" ? 2 : 4);
    const latest = getLatestModuleRecord(module);
    const aiSummary = getFieldString(latest, getModuleField(module, "ai_summary"));
    const manualSummary = getFieldString(latest, getModuleField(module, "manual_summary")) || getFieldString(latest, getModuleField(module, "summary"));
    const contributors = [...new Set(module.table.records.map((record) => getFieldString(record, authorField)).filter(Boolean))].slice(0, 3).join(", ");
    const journalSummary =
      aiSummary ||
      manualSummary ||
      `${copy.today}: ${module.table.records.filter((record) => new Date(record.updatedAt).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)).length}${contributors ? ` | ${copy.contributors}: ${contributors}` : ""}`;
    return (
      <ModuleShell
        key={module.table.node.id}
        title={module.table.node.name}
        actions={<button type="button" className="ode-primary-btn h-10 px-4" onClick={() => openJournalDraft(module)}>{copy.newEntry}</button>}
      >
        {module.table.records.length > 0 ? (
          <div className="mb-4 rounded-[20px] border border-[rgba(88,197,255,0.12)] bg-[rgba(7,30,46,0.72)] px-4 py-4 text-[0.92rem] leading-7 text-[rgba(208,239,255,0.86)]">
            {clipText(journalSummary || copy.noSummary, 220)}
          </div>
        ) : null}
        <div className="space-y-3">
          {records.map((record) => (
            <div key={record.id} className="rounded-[20px] border border-[rgba(88,197,255,0.12)] bg-[rgba(7,30,46,0.72)] px-4 py-4">
              <div className="flex items-start gap-3">
                {titleField ? <div className="min-w-0 flex-1 text-[1rem] font-semibold text-[#eefbff]">{getRecordValueAsText(moduleCatalog.model, record, titleField)}</div> : <div className="min-w-0 flex-1" />}
                <button type="button" className="ode-danger-btn h-9 px-3" onClick={() => { void removeRecord(module, record.id); }}>{copy.remove}</button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[0.82rem] text-[rgba(188,225,245,0.58)]">
                {authorField ? <span>{getFieldString(record, authorField) || userName}</span> : null}
                <span>{formatTimestamp(language, record.updatedAt)}</span>
              </div>
              {bodyField ? (
                <div className="mt-3 whitespace-pre-wrap text-[0.96rem] leading-7 text-[rgba(225,244,255,0.88)]">
                  {clipText(getRecordValueAsText(moduleCatalog.model, record, bodyField), mode === "overview" ? 160 : 320)}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </ModuleShell>
    );
  };

  const renderMeetingCard = (module: ChantierModuleDefinition) => {
    const record = getLatestModuleRecord(module);
    const link = getFieldString(record, getModuleField(module, "meeting_url"));
    const provider = getFieldString(record, getModuleField(module, "provider"));
    const when = getFieldString(record, getModuleField(module, "scheduled_at"));
    const notes = getFieldString(record, getModuleField(module, "notes"));
    return (
      <ModuleShell
        key={module.table.node.id}
        title={module.table.node.name}
        actions={
          <>
            <button type="button" className="ode-secondary-btn h-10 px-4" onClick={() => openMeetingDraft(module)}>{copy.edit}</button>
            {link ? <button type="button" className="ode-primary-btn h-10 px-4" onClick={() => { void launchTarget(module.table.node.name, link, "link"); }}>{copy.openMeeting}</button> : null}
          </>
        }
      >
        <div className="space-y-3">
          <FieldLine label={copy.provider} value={provider || null} />
          <FieldLine label={copy.when} value={when || null} />
          <FieldLine label={copy.link} value={link || null} />
          {notes ? <div className="rounded-[20px] border border-[rgba(88,197,255,0.12)] bg-[rgba(7,30,46,0.72)] px-4 py-4 text-[0.96rem] leading-7 text-[rgba(225,244,255,0.88)]">{clipText(notes, mode === "overview" ? 180 : 320)}</div> : null}
        </div>
      </ModuleShell>
    );
  };

  const renderMessagingCard = (module: ChantierModuleDefinition) => {
    const record = getLatestModuleRecord(module);
    const to = getFieldString(record, getModuleField(module, "to"));
    const cc = getFieldString(record, getModuleField(module, "cc"));
    const bcc = getFieldString(record, getModuleField(module, "bcc"));
    const subject = getFieldString(record, getModuleField(module, "subject"));
    const body = getFieldString(record, getModuleField(module, "body"));
    const mailto = buildMailtoUrl({ to, cc, bcc, subject, body });
    return (
      <ModuleShell
        key={module.table.node.id}
        title={module.table.node.name}
        actions={
          <>
            <button type="button" className="ode-secondary-btn h-10 px-4" onClick={() => openMessagingDraft(module)}>{copy.edit}</button>
            {mailto ? <button type="button" className="ode-primary-btn h-10 px-4" onClick={() => { void launchTarget(module.table.node.name, mailto, "mail"); }}>{copy.composeEmail}</button> : null}
          </>
        }
      >
        <div className="space-y-3">
          <FieldLine label={copy.to} value={to || null} />
          <FieldLine label={copy.cc} value={cc || null} />
          <FieldLine label={copy.bcc} value={bcc || null} />
          <FieldLine label={copy.subject} value={subject || null} />
          {body ? <div className="rounded-[20px] border border-[rgba(88,197,255,0.12)] bg-[rgba(7,30,46,0.72)] px-4 py-4 text-[0.96rem] leading-7 text-[rgba(225,244,255,0.88)]">{clipText(body, mode === "overview" ? 180 : 260)}</div> : null}
        </div>
      </ModuleShell>
    );
  };

  const renderGenericCard = (module: ChantierModuleDefinition) => {
    const fields = module.table.fields.slice(0, 3);
    const records = [...module.table.records].sort((left, right) => right.updatedAt - left.updatedAt).slice(0, mode === "overview" ? 2 : 3);
    return (
      <ModuleShell key={module.table.node.id} title={module.table.node.name}>
        <div className="space-y-3">
          {records.map((record) => (
            <div key={record.id} className="rounded-[20px] border border-[rgba(88,197,255,0.12)] bg-[rgba(7,30,46,0.72)] px-4 py-4">
              <div className="space-y-2">
                {fields.map((field) => {
                  const value = getRecordValueAsText(moduleCatalog.model, record, field);
                  return value ? <FieldLine key={field.nodeId} label={field.label} value={clipText(value, 120)} /> : null;
                })}
              </div>
            </div>
          ))}
        </div>
      </ModuleShell>
    );
  };

  const renderModule = (module: ChantierModuleDefinition) => {
    if (module.role === "feed") return renderFeedCard(module);
    if (module.role === "journal") return renderJournalCard(module);
    if (module.role === "meeting") return renderMeetingCard(module);
    if (module.role === "messaging") return renderMessagingCard(module);
    return renderGenericCard(module);
  };

  const renderLinkedAppsCard = () => {
    const visibleApps = mode === "overview" ? linkedApps.slice(0, 6) : linkedApps;
    return (
      <ModuleShell
        title={linkedApps.length > 0 ? `${copy.appsTitle} (${linkedApps.length})` : copy.appsTitle}
        actions={
          <button type="button" className="ode-secondary-btn h-10 px-4" onClick={() => onManageQuickApps(chantierNode.id)}>
            {copy.manageApps}
          </button>
        }
      >
        {visibleApps.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleApps.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex items-center gap-4 rounded-[20px] border border-[rgba(88,197,255,0.14)] bg-[rgba(7,30,46,0.72)] px-4 py-4 text-left transition hover:border-[rgba(106,212,255,0.28)] hover:bg-[rgba(8,41,62,0.86)]"
                onClick={() => {
                  void onLaunchQuickApp(item, {
                    scope: "node",
                    sourceNodeId: browseNode?.id ?? chantierNode.id
                  });
                }}
              >
                <QuickAppIcon item={item} variant="editor" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[1rem] font-semibold text-[#eefbff]">{item.label}</div>
                  <div className="mt-1 break-all text-[0.84rem] leading-6 text-[rgba(188,225,245,0.68)]">
                    {clipText(item.target, mode === "overview" ? 72 : 120)}
                  </div>
                </div>
                <span className="shrink-0 rounded-full border border-[rgba(88,197,255,0.18)] bg-[rgba(8,33,50,0.78)] px-3 py-1.5 text-[0.72rem] uppercase tracking-[0.12em] text-[rgba(220,244,255,0.86)]">
                  {copy.open}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-[20px] border border-dashed border-[rgba(88,197,255,0.14)] bg-[rgba(4,22,36,0.42)] px-4 py-5 text-[0.92rem] leading-7 text-[var(--ode-text-muted)]">
            {copy.linkedAppsEmpty}
          </div>
        )}
      </ModuleShell>
    );
  };

  const feedTagsField = feedModule ? getModuleField(feedModule, "tags") : null;
  const journalTagsField = journalModule ? getModuleField(journalModule, "tags") : null;

  return (
    <>
      <section className="rounded-[30px] border border-[rgba(88,197,255,0.16)] bg-[linear-gradient(180deg,rgba(7,29,45,0.96),rgba(4,20,33,0.92))] p-5 shadow-[0_24px_64px_rgba(0,0,0,0.22)]">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[2.25rem] font-semibold tracking-tight text-[#eefbff]">{chantierNode.name}</h1>
            {headerBadges.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {headerBadges.map((badge) => (
                  <span key={badge} className="inline-flex h-10 items-center rounded-full border border-[rgba(88,197,255,0.16)] bg-[rgba(8,33,50,0.78)] px-4 text-[0.88rem] text-[rgba(220,244,255,0.9)]">
                    {badge}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <button type="button" className="ode-primary-btn h-11 px-5" onClick={() => setModulePickerOpen(true)}>
            {copy.addModule}
          </button>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {renderLinkedAppsCard()}
          {modules.map((module) => renderModule(module))}
        </div>
        {linkedApps.length === 0 && modules.length === 0 ? <div className="min-h-[24vh]" /> : null}
      </section>

      <ChantierModulePickerModal
        open={modulePickerOpen}
        language={language}
        templates={databaseTemplates}
        onClose={() => setModulePickerOpen(false)}
        onPick={async (itemId) => {
          await onCreateModuleFromTemplate(itemId, chantierNode.id);
        }}
      />

      <ModalShell
        open={Boolean(feedModule)}
        title={copy.newPost}
        closeLabel={copy.close}
        onClose={closeFeedDraft}
        footer={
          <>
            <button type="button" className="ode-danger-btn h-11 px-5" onClick={closeFeedDraft}>{copy.cancel}</button>
            <button type="button" className="ode-primary-btn h-11 px-6" onClick={() => void saveFeed()} disabled={busyModuleId === feedModule?.table.node.id}>{copy.save}</button>
          </>
        }
      >
        {feedTagsField ? (
          <div className="space-y-3">
            <div className="text-[0.78rem] uppercase tracking-[0.18em] text-[rgba(148,203,232,0.68)]">{copy.tags}</div>
            {feedTagsField.options.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {feedTagsField.options.map((tag) => {
                  const active = feedDraft.tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      className={`rounded-full border px-3 py-2 text-[0.84rem] transition ${
                        active
                          ? "border-[rgba(106,212,255,0.44)] bg-[rgba(16,77,112,0.44)] text-[#eefbff]"
                          : "border-[rgba(88,197,255,0.14)] bg-[rgba(5,29,45,0.72)] text-[rgba(188,225,245,0.72)]"
                      }`}
                      onClick={() =>
                        setFeedDraft((current) => ({
                          ...current,
                          tags:
                            feedTagsField.type === "single_select"
                              ? current.tags.includes(tag)
                                ? []
                                : [tag]
                              : current.tags.includes(tag)
                                ? current.tags.filter((item) => item !== tag)
                                : [...current.tags, tag]
                        }))
                      }
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            ) : (
              <input type="text" value={feedDraft.freeTags} onChange={(event) => setFeedDraft((current) => ({ ...current, freeTags: event.target.value }))} className="ode-input h-12 w-full rounded-[16px] px-4" />
            )}
          </div>
        ) : null}
        <div className="space-y-2">
          <div className="text-[0.78rem] uppercase tracking-[0.18em] text-[rgba(148,203,232,0.68)]">{copy.message}</div>
          <textarea value={feedDraft.message} onChange={(event) => setFeedDraft((current) => ({ ...current, message: event.target.value }))} className="ode-input min-h-[16rem] w-full rounded-[18px] px-4 py-4" />
        </div>
      </ModalShell>

      <ModalShell
        open={Boolean(journalModule)}
        title={copy.newEntry}
        closeLabel={copy.close}
        onClose={closeJournalDraft}
        footer={
          <>
            <button type="button" className="ode-danger-btn h-11 px-5" onClick={closeJournalDraft}>{copy.cancel}</button>
            <button type="button" className="ode-primary-btn h-11 px-6" onClick={() => void saveJournal()} disabled={busyModuleId === journalModule?.table.node.id}>{copy.save}</button>
          </>
        }
      >
        <div className="space-y-2">
          <div className="text-[0.78rem] uppercase tracking-[0.18em] text-[rgba(148,203,232,0.68)]">{copy.title}</div>
          <input type="text" value={journalDraft.title} onChange={(event) => setJournalDraft((current) => ({ ...current, title: event.target.value }))} className="ode-input h-12 w-full rounded-[16px] px-4" />
        </div>
        {journalTagsField ? (
          <div className="space-y-3">
            <div className="text-[0.78rem] uppercase tracking-[0.18em] text-[rgba(148,203,232,0.68)]">{copy.tags}</div>
            {journalTagsField.options.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {journalTagsField.options.map((tag) => {
                  const active = journalDraft.tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      className={`rounded-full border px-3 py-2 text-[0.84rem] transition ${
                        active
                          ? "border-[rgba(106,212,255,0.44)] bg-[rgba(16,77,112,0.44)] text-[#eefbff]"
                          : "border-[rgba(88,197,255,0.14)] bg-[rgba(5,29,45,0.72)] text-[rgba(188,225,245,0.72)]"
                      }`}
                      onClick={() =>
                        setJournalDraft((current) => ({
                          ...current,
                          tags:
                            journalTagsField.type === "single_select"
                              ? current.tags.includes(tag)
                                ? []
                                : [tag]
                              : current.tags.includes(tag)
                                ? current.tags.filter((item) => item !== tag)
                                : [...current.tags, tag]
                        }))
                      }
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            ) : (
              <input type="text" value={journalDraft.freeTags} onChange={(event) => setJournalDraft((current) => ({ ...current, freeTags: event.target.value }))} className="ode-input h-12 w-full rounded-[16px] px-4" />
            )}
          </div>
        ) : null}
        <div className="space-y-2">
          <div className="text-[0.78rem] uppercase tracking-[0.18em] text-[rgba(148,203,232,0.68)]">{copy.body}</div>
          <textarea value={journalDraft.body} onChange={(event) => setJournalDraft((current) => ({ ...current, body: event.target.value }))} className="ode-input min-h-[18rem] w-full rounded-[18px] px-4 py-4" />
        </div>
      </ModalShell>

      <ModalShell
        open={Boolean(meetingModule)}
        title={copy.edit}
        closeLabel={copy.close}
        onClose={closeMeetingDraft}
        footer={
          <>
            <button type="button" className="ode-danger-btn h-11 px-5" onClick={closeMeetingDraft}>{copy.cancel}</button>
            <button type="button" className="ode-primary-btn h-11 px-6" onClick={() => void saveMeeting()} disabled={busyModuleId === meetingModule?.table.node.id}>{copy.save}</button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <input type="text" value={meetingDraft.title} onChange={(event) => setMeetingDraft((current) => ({ ...current, title: event.target.value }))} placeholder={copy.title} className="ode-input h-12 w-full rounded-[16px] px-4" />
          <input type="text" value={meetingDraft.provider} onChange={(event) => setMeetingDraft((current) => ({ ...current, provider: event.target.value }))} placeholder={copy.provider} className="ode-input h-12 w-full rounded-[16px] px-4" />
          <input type="url" value={meetingDraft.url} onChange={(event) => setMeetingDraft((current) => ({ ...current, url: event.target.value }))} placeholder={copy.link} className="ode-input h-12 w-full rounded-[16px] px-4 md:col-span-2" />
          <input type="text" value={meetingDraft.when} onChange={(event) => setMeetingDraft((current) => ({ ...current, when: event.target.value }))} placeholder={copy.when} className="ode-input h-12 w-full rounded-[16px] px-4 md:col-span-2" />
          <textarea value={meetingDraft.notes} onChange={(event) => setMeetingDraft((current) => ({ ...current, notes: event.target.value }))} placeholder={copy.notes} className="ode-input min-h-[12rem] w-full rounded-[18px] px-4 py-4 md:col-span-2" />
        </div>
      </ModalShell>

      <ModalShell
        open={Boolean(messagingModule)}
        title={copy.edit}
        closeLabel={copy.close}
        onClose={closeMessagingDraft}
        footer={
          <>
            <button type="button" className="ode-danger-btn h-11 px-5" onClick={closeMessagingDraft}>{copy.cancel}</button>
            <button type="button" className="ode-primary-btn h-11 px-6" onClick={() => void saveMessaging()} disabled={busyModuleId === messagingModule?.table.node.id}>{copy.save}</button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <input type="text" value={messagingDraft.to} onChange={(event) => setMessagingDraft((current) => ({ ...current, to: event.target.value }))} placeholder={copy.to} className="ode-input h-12 w-full rounded-[16px] px-4 md:col-span-2" />
          <input type="text" value={messagingDraft.cc} onChange={(event) => setMessagingDraft((current) => ({ ...current, cc: event.target.value }))} placeholder={copy.cc} className="ode-input h-12 w-full rounded-[16px] px-4" />
          <input type="text" value={messagingDraft.bcc} onChange={(event) => setMessagingDraft((current) => ({ ...current, bcc: event.target.value }))} placeholder={copy.bcc} className="ode-input h-12 w-full rounded-[16px] px-4" />
          <input type="text" value={messagingDraft.subject} onChange={(event) => setMessagingDraft((current) => ({ ...current, subject: event.target.value }))} placeholder={copy.subject} className="ode-input h-12 w-full rounded-[16px] px-4 md:col-span-2" />
          <textarea value={messagingDraft.body} onChange={(event) => setMessagingDraft((current) => ({ ...current, body: event.target.value }))} placeholder={copy.body} className="ode-input min-h-[14rem] w-full rounded-[18px] px-4 py-4 md:col-span-2" />
        </div>
      </ModalShell>
    </>
  );
}
