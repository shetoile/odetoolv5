import type { QuickAppHtmlStorageSnapshot } from "@/lib/quickAppHtmlSnapshot";
import { callNative } from "@/lib/tauriApi";
import type { TreeSpreadsheetPayload } from "@/lib/treeSpreadsheet";
import { ROOT_PARENT_ID, type AppNode, type NodeType, type ProjectSummary } from "@/lib/types";

export type QualityGateResult = {
  success: boolean;
  exitCode: number;
  output: string;
};

export type ProcedureTableSpreadsheetMetaEntry = {
  label: string;
  value: string;
};

export type ProcedureTableSpreadsheetSheet = {
  name: string;
  headers: string[];
  rows: string[][];
};

export type ProcedureTableSpreadsheetPayload = {
  tableName: string;
  meta: ProcedureTableSpreadsheetMetaEntry[];
  sheets: ProcedureTableSpreadsheetSheet[];
};

export type WorkspaceRepairSummary = {
  recoveredCount: number;
  updatedCount: number;
  removedStaleCount: number;
  totalWorkspaces: number;
  warning: string | null;
};

const COPY_SUFFIX_REGEX = /\s*(\(|\[)(copy|copie|kopie|copia)(?:\s+(\d+))?(\)|\])$/i;

function buildMirrorPathKey(name: string, nodeType: NodeType): string {
  const sanitized = name.replace(/[<>:"/\\|?*]/g, "_").trim().toLowerCase();
  if (nodeType === "folder" || nodeType === "file") return sanitized;
  return `${sanitized}.md`;
}

function splitFileName(name: string): { base: string; ext: string } {
  const lastDot = name.lastIndexOf(".");
  if (lastDot > 0 && lastDot < name.length - 1) {
    return { base: name.slice(0, lastDot), ext: name.slice(lastDot) };
  }
  return { base: name, ext: "" };
}

function getVariantName(desiredName: string, nodeType: NodeType, variantIndex: number): string {
  if (variantIndex === 0) return desiredName;
  const { base, ext } =
    nodeType === "file" ? splitFileName(desiredName) : { base: desiredName, ext: "" };
  const copyMatch = base.match(COPY_SUFFIX_REGEX);
  const rootBase = copyMatch ? base.slice(0, copyMatch.index).trimEnd() : base;
  const copyToken = copyMatch ? copyMatch[2] : "Copy";
  const openBracket = copyMatch ? copyMatch[1] : "[";
  const closeBracket = copyMatch ? copyMatch[4] : "]";
  const baseCopyIndex = copyMatch ? Number(copyMatch[3] ?? "1") : 0;
  const nextCopyIndex = baseCopyIndex + variantIndex;
  const copyLabel =
    nextCopyIndex <= 1
      ? ` ${openBracket}${copyToken}${closeBracket}`
      : ` ${openBracket}${copyToken} ${nextCopyIndex}${closeBracket}`;
  return `${rootBase}${copyLabel}${ext}`;
}

function findUniqueName(
  desiredName: string,
  nodeType: NodeType,
  isTaken: (candidateName: string) => boolean
): string {
  let variantIndex = 0;
  while (variantIndex < 5000) {
    const candidateName = getVariantName(desiredName, nodeType, variantIndex);
    if (!isTaken(candidateName)) return candidateName;
    variantIndex += 1;
  }
  return `${desiredName}-${Date.now()}`;
}

async function ensureUniqueSiblingName(
  parentId: string | null,
  desiredName: string,
  nodeType: NodeType,
  excludeNodeId?: string
): Promise<string> {
  const siblings = await getChildren(parentId);
  const takenKeys = new Set(
    siblings
      .filter((sibling) => sibling.id !== excludeNodeId)
      .map((sibling) => buildMirrorPathKey(sibling.name, sibling.type))
  );
  return findUniqueName(desiredName, nodeType, (candidateName) =>
    takenKeys.has(buildMirrorPathKey(candidateName, nodeType))
  );
}

export async function createNode(
  parentId: string | null,
  name: string,
  type: NodeType = "folder"
): Promise<AppNode> {
  const uniqueName = await ensureUniqueSiblingName(parentId, name, type);
  return callNative<AppNode>("create_node", {
    parentId,
    name: uniqueName,
    nodeType: type
  });
}

export async function renameNode(id: string, newName: string): Promise<string> {
  const node = await getNode(id);
  if (!node) return newName.trim();
  const parentId = node.parentId === ROOT_PARENT_ID ? null : node.parentId;
  const uniqueName = await ensureUniqueSiblingName(parentId, newName, node.type, id);
  await callNative("rename_node", { id, newName: uniqueName });
  return uniqueName;
}

export async function updateNodeProperties(
  id: string,
  newProperties: Record<string, unknown>
): Promise<void> {
  await callNative("update_node_properties", { id, newProperties });
}

export async function updateNodeDescription(id: string, description: string | null): Promise<void> {
  await callNative("update_node_description", { id, description });
}

export async function updateNodeContent(id: string, text: string): Promise<void> {
  await callNative("update_node_content", { id, text });
}

export async function deleteNode(id: string, syncProjection: boolean = true): Promise<void> {
  await callNative("delete_node", { id, syncProjection });
}

export async function getChildren(parentId: string | null): Promise<AppNode[]> {
  return callNative<AppNode[]>("get_nodes", { parentId });
}

export async function getAllNodes(): Promise<AppNode[]> {
  return callNative<AppNode[]>("get_all_nodes");
}

export async function getNode(id: string): Promise<AppNode | undefined> {
  const node = await callNative<AppNode | null>("get_node", { id });
  return node ?? undefined;
}

export async function getAncestors(nodeId: string): Promise<AppNode[]> {
  return callNative<AppNode[]>("get_ancestors", { nodeId });
}

export async function moveNode(
  nodeId: string,
  newParentId: string | null,
  afterId: string | null,
  syncProjection: boolean = true
): Promise<void> {
  await callNative("move_node", { nodeId, newParentId, afterId, syncProjection });
}

export async function getAllDescendantIds(nodeId: string): Promise<Set<string>> {
  const ids = await callNative<string[]>("get_all_descendant_ids", { nodeId });
  return new Set(ids);
}

export async function searchNodes(query: string): Promise<AppNode[]> {
  return callNative<AppNode[]>("search_nodes", { query });
}

export async function importFilesToNode(
  parentNodeId: string | null,
  sourcePaths: string[]
): Promise<AppNode[]> {
  return callNative<AppNode[]>("import_files_to_node", { parentNodeId, sourcePaths });
}

export type ImportedFilePayload = {
  name: string;
  bytesBase64: string;
};

export async function importFilePayloadsToNode(
  parentNodeId: string | null,
  filePayloads: ImportedFilePayload[]
): Promise<AppNode[]> {
  return callNative<AppNode[]>("import_file_payloads_to_node", { parentNodeId, filePayloads });
}

export async function openNodeFile(nodeId: string): Promise<void> {
  await callNative("open_node_file", { nodeId });
}

export async function extractDocumentText(
  filePath: string,
  options?: { extension?: string; nodeId?: string }
): Promise<string | null> {
  return callNative<string | null>("extract_document_text", {
    filePath,
    extension: options?.extension,
    nodeId: options?.nodeId
  });
}

export type QuickAppUrlPreview = {
  url: string;
  finalUrl: string;
  title: string | null;
  description: string | null;
  excerpt: string | null;
  contentType: string | null;
  reachable: boolean;
};

export async function fetchQuickAppUrlPreview(url: string): Promise<QuickAppUrlPreview | null> {
  return callNative<QuickAppUrlPreview | null>("fetch_quick_app_url_preview", {
    url
  });
}

export async function reparseNodeDocumentContent(nodeId: string): Promise<AppNode | undefined> {
  const node = await callNative<AppNode | null>("reparse_node_document_content", { nodeId });
  return node ?? undefined;
}

export async function openNodeFileWith(nodeId: string): Promise<void> {
  await callNative("open_node_file_with", { nodeId });
}

export async function openNodeFileLocation(nodeId: string): Promise<void> {
  await callNative("open_node_file_location", { nodeId });
}

export async function getWindowsFileIcon(
  filePath: string | null,
  fileName: string,
  size: number = 20
): Promise<string | null> {
  return callNative<string | null>("get_windows_file_icon", { filePath, fileName, size });
}

export async function getWindowsInstalledFontFamilies(): Promise<string[]> {
  return callNative<string[]>("get_windows_installed_font_families");
}

export async function setWindowsClipboardFilePaths(paths: string[]): Promise<void> {
  await callNative("set_windows_clipboard_file_paths", { paths });
}

export async function getWindowsClipboardFilePaths(): Promise<string[]> {
  return callNative<string[]>("get_windows_clipboard_file_paths");
}

export async function pickWindowsFilesForImport(): Promise<string[]> {
  return callNative<string[]>("pick_windows_files_for_import");
}

export async function pickQaEvidenceFiles(): Promise<string[]> {
  return callNative<string[]>("pick_qa_evidence_files");
}

export async function exportNodePackage(nodeId: string): Promise<string> {
  return callNative<string>("export_node_package", { nodeId });
}

export async function importNodePackage(
  parentNodeId: string | null,
  packagePath: string
): Promise<AppNode> {
  return callNative<AppNode>("import_node_package", { parentNodeId, packagePath });
}

export async function duplicateWorkspace(
  projectId: string,
  name?: string | null
): Promise<ProjectSummary> {
  return callNative<ProjectSummary>("duplicate_workspace", {
    projectId,
    name: name?.trim() ? name.trim() : null
  });
}

export async function exportWorkspacePackage(projectId: string): Promise<string> {
  return callNative<string>("export_workspace_package", { projectId });
}

export async function importWorkspacePackage(
  packagePath: string,
  name?: string | null
): Promise<ProjectSummary> {
  return callNative<ProjectSummary>("import_workspace_package", {
    packagePath,
    name: name?.trim() ? name.trim() : null
  });
}

export async function pickWindowsNodePackageFile(): Promise<string | null> {
  return callNative<string | null>("pick_windows_node_package_file");
}

export async function pickWindowsWorkspacePackageFile(): Promise<string | null> {
  return callNative<string | null>("pick_windows_workspace_package_file");
}

export async function pickWindowsProjectFolder(): Promise<string | null> {
  return callNative<string | null>("pick_windows_project_folder");
}

export async function exportTreeStructureExcel(
  dialogTitle: string,
  defaultFileName: string,
  payload: TreeSpreadsheetPayload
): Promise<string | null> {
  return callNative<string | null>("export_tree_structure_excel", {
    dialogTitle,
    defaultFileName,
    payload
  });
}

export async function exportProcedureTableExcel(
  dialogTitle: string,
  defaultFileName: string,
  payload: ProcedureTableSpreadsheetPayload
): Promise<string | null> {
  return callNative<string | null>("export_procedure_table_excel", {
    dialogTitle,
    defaultFileName,
    payload
  });
}

export async function pickWindowsTreeSpreadsheetFile(): Promise<string | null> {
  return callNative<string | null>("pick_windows_tree_spreadsheet_file");
}

export async function pickWindowsProcedureTableSpreadsheetFile(): Promise<string | null> {
  return callNative<string | null>("pick_windows_procedure_table_spreadsheet_file");
}

export async function readTreeStructureExcel(filePath: string): Promise<TreeSpreadsheetPayload> {
  return callNative<TreeSpreadsheetPayload>("read_tree_structure_excel", { filePath });
}

export async function readProcedureTableExcel(
  filePath: string
): Promise<ProcedureTableSpreadsheetPayload> {
  return callNative<ProcedureTableSpreadsheetPayload>("read_procedure_table_excel", { filePath });
}

export async function getProjects(): Promise<ProjectSummary[]> {
  return callNative<ProjectSummary[]>("get_projects");
}

export async function createProjectFromPath(path: string): Promise<ProjectSummary> {
  return callNative<ProjectSummary>("create_project_from_path", { path });
}

export async function createWorkspace(name: string): Promise<ProjectSummary> {
  return callNative<ProjectSummary>("create_workspace", { name });
}

export async function setProjectWorkspacePath(
  projectId: string,
  path: string
): Promise<ProjectSummary> {
  return callNative<ProjectSummary>("set_project_workspace_path", { projectId, path });
}

export async function deleteProjectWorkspace(projectId: string): Promise<void> {
  await callNative("delete_project_workspace", { projectId });
}

export async function syncExternalMirrorEntries(targetParentId: string | null): Promise<number> {
  return callNative<number>("sync_external_mirror_entries", { targetParentId });
}

export async function reSyncProjectWorkspace(projectId: string): Promise<number> {
  return callNative<number>("re_sync_project_workspace", { projectId });
}

export async function detectProjectWorkspaceExternalChanges(projectId: string): Promise<number> {
  return callNative<number>("detect_project_workspace_external_changes", { projectId });
}

export async function repairWorkspaceIndex(): Promise<WorkspaceRepairSummary> {
  return callNative<WorkspaceRepairSummary>("repair_workspace_index");
}

export async function openExternalUrl(url: string): Promise<void> {
  await callNative("open_external_url", { url });
}

export async function openLocalPath(path: string): Promise<void> {
  await callNative("open_local_path", { path });
}

export async function startWindowsSnippingTool(): Promise<void> {
  await callNative("start_windows_snipping_tool");
}

export async function readLocalImageDataUrl(path: string): Promise<string | null> {
  return callNative<string | null>("read_local_image_data_url", { path });
}

export async function readLocalFileDataUrl(path: string): Promise<string | null> {
  return callNative<string | null>("read_local_file_data_url", { path });
}

export async function readClipboardImageDataUrl(): Promise<string | null> {
  return callNative<string | null>("read_clipboard_image_data_url");
}

export async function extractDocumentTextFromPayload(
  fileName: string,
  bytesBase64: string
): Promise<string | null> {
  return callNative<string | null>("extract_document_text_from_payload", {
    fileName,
    bytesBase64
  });
}

export async function prepareQuickAppHtmlInstance(
  templatePath: string,
  instanceFileName: string,
  options?: {
    templateBaseHref?: string | null;
    storageNamespace?: string | null;
    snapshotSeed?: {
      scope: string;
      ownerId?: string | null;
      ownerLabel?: string | null;
      quickAppId: string;
    } | null;
  }
): Promise<string> {
  return callNative<string>("prepare_quick_app_html_instance", {
    templatePath,
    instanceFileName,
    templateBaseHref: options?.templateBaseHref ?? null,
    storageNamespace: options?.storageNamespace ?? null,
    snapshotSeed: options?.snapshotSeed ?? null
  });
}

export async function getQuickAppHtmlStorageSnapshot(
  namespace: string
): Promise<QuickAppHtmlStorageSnapshot | null> {
  return callNative<QuickAppHtmlStorageSnapshot | null>("get_quick_app_html_storage_snapshot", {
    namespace
  });
}

export async function exportPowerPointSlides(filePath: string): Promise<string[]> {
  return callNative<string[]>("export_powerpoint_slides", { filePath });
}

export async function probeSingleInstanceRelaunch(): Promise<boolean> {
  return callNative<boolean>("probe_single_instance_relaunch");
}

export async function attachClipboardImageToTicket(ticketNodeId: string): Promise<AppNode> {
  return callNative<AppNode>("attach_clipboard_image_to_ticket", { ticketNodeId });
}

export async function saveExportFile(
  dialogTitle: string,
  defaultFileName: string,
  filterLabel: string,
  extension: string,
  bytes: number[]
): Promise<string | null> {
  return callNative<string | null>("save_export_file", {
    dialogTitle,
    defaultFileName,
    filterLabel,
    extension,
    bytes
  });
}

export async function runQualityGateCommand(): Promise<QualityGateResult> {
  return callNative<QualityGateResult>("run_quality_gate_command");
}
