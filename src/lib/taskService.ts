import { callNative } from "@/lib/tauriApi";
import type { Task, TaskFilterOptions, TaskMetadata } from "@/lib/types";

export async function createTask(taskData: Partial<Task> & { title: string }): Promise<Task> {
  return callNative<Task>("create_task", { taskData });
}

export async function getTask(id: string): Promise<Task | undefined> {
  const task = await callNative<Task | null>("get_task", { id });
  return task ?? undefined;
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<void> {
  await callNative("update_task", { id, updates });
}

export async function deleteTask(id: string): Promise<void> {
  await callNative("delete_task", { id });
}

export async function searchTasks(options: TaskFilterOptions): Promise<Task[]> {
  return callNative<Task[]>("search_tasks", { options });
}

export async function linkTaskToNode(taskId: string, nodeId: string, isPrimary = false): Promise<void> {
  await callNative("link_task_to_node", { taskId, nodeId, isPrimary });
}

export async function unlinkTaskFromNode(taskId: string, nodeId: string): Promise<void> {
  await callNative("unlink_task_from_node", { taskId, nodeId });
}

export async function getTaskIdsForNode(
  nodeId: string,
  includeSubnodes = false
): Promise<string[]> {
  return callNative<string[]>("get_task_ids_for_node", { nodeId, includeSubnodes });
}

export async function getTaskMetadata(): Promise<TaskMetadata> {
  return callNative<TaskMetadata>("get_task_metadata");
}
