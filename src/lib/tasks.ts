import { supabase } from "./supabase";
import { Team, getTeamsByIds } from "./teams";
import { uploadFile } from "./icons";

export type TaskStatus = "pending" | "in_progress" | "blocked" | "completed";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  blocked: "Bloqueada",
  completed: "Completada",
};

export const TASK_STATUS_ORDER: TaskStatus[] = ["pending", "in_progress", "blocked", "completed"];

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "#94A3B8",
  medium: "#2563EB",
  high: "#F97316",
  urgent: "#EF4444",
};

export const TASK_PRIORITY_ORDER: TaskPriority[] = ["low", "medium", "high", "urgent"];

export type TaskAssignee =
  | { type: "user"; userId: string; name: string; avatarUrl: string | null; avatarColor: string }
  | { type: "team"; teamId: string; name: string; color: string; iconUrl: string | null };

export type Task = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  startDate: string | null;
  dueDate: string | null;
  createdBy: string;
  createdAt: string;
  assignee: TaskAssignee;
};

type TaskRow = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  start_date: string | null;
  due_date: string | null;
  assigned_user_id: string | null;
  assigned_team_id: string | null;
  created_by: string;
  created_at: string;
};

async function hydrateTasks(taskRows: TaskRow[]) {
  const userIds = Array.from(new Set(taskRows.map((t) => t.assigned_user_id).filter((id): id is string => !!id)));
  const teamIds = Array.from(new Set(taskRows.map((t) => t.assigned_team_id).filter((id): id is string => !!id)));

  const { data: profileRows, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, nickname, avatar_url, avatar_color")
    .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);

  if (profilesError) return { data: [] as Task[], error: profilesError };

  const { data: teams, error: teamsError } = await getTeamsByIds(teamIds);
  if (teamsError) return { data: [] as Task[], error: teamsError };

  const profileById = new Map((profileRows ?? []).map((p) => [p.id, p]));
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const tasks: Task[] = taskRows.reduce<Task[]>((acc, row) => {
    let assignee: TaskAssignee | null = null;

    if (row.assigned_user_id) {
      const profile = profileById.get(row.assigned_user_id);
      assignee = {
        type: "user",
        userId: row.assigned_user_id,
        name: profile?.nickname || profile?.full_name || "Miembro",
        avatarUrl: profile?.avatar_url ?? null,
        avatarColor: profile?.avatar_color ?? "#2563EB",
      };
    } else if (row.assigned_team_id) {
      const team = teamById.get(row.assigned_team_id);
      assignee = {
        type: "team",
        teamId: row.assigned_team_id,
        name: team?.name ?? "Equipo",
        color: team?.color ?? "#2563EB",
        iconUrl: team?.iconUrl ?? null,
      };
    }

    if (!assignee) return acc;

    acc.push({
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      startDate: row.start_date,
      dueDate: row.due_date,
      createdBy: row.created_by,
      createdAt: row.created_at,
      assignee,
    });
    return acc;
  }, []);

  return { data: tasks, error: null };
}

const TASK_COLUMNS =
  "id, project_id, title, description, status, priority, start_date, due_date, assigned_user_id, assigned_team_id, created_by, created_at";

export async function listTasksForProjects(projectIds: string[]) {
  if (!projectIds.length) return { data: [] as Task[], error: null };

  const { data: taskRows, error } = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .in("project_id", projectIds)
    .order("created_at", { ascending: false });

  if (error) return { data: [] as Task[], error };
  return hydrateTasks(taskRows ?? []);
}

export async function createTask(params: {
  projectId: string;
  createdBy: string;
  title: string;
  description?: string | null;
  assignedUserId?: string | null;
  assignedTeamId?: string | null;
  priority?: TaskPriority;
  startDate?: string | null;
  dueDate?: string | null;
}) {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      project_id: params.projectId,
      created_by: params.createdBy,
      title: params.title,
      description: params.description ?? null,
      assigned_user_id: params.assignedUserId ?? null,
      assigned_team_id: params.assignedTeamId ?? null,
      priority: params.priority ?? "medium",
      start_date: params.startDate ?? null,
      due_date: params.dueDate ?? null,
    })
    .select("id")
    .single();

  return { data, error };
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const { error } = await supabase.from("tasks").update({ status }).eq("id", taskId);
  return { error };
}

export async function updateTask(
  taskId: string,
  updates: Partial<{
    title: string;
    description: string | null;
    assignedUserId: string | null;
    assignedTeamId: string | null;
    priority: TaskPriority;
    startDate: string | null;
    dueDate: string | null;
  }>
) {
  const { error } = await supabase
    .from("tasks")
    .update({
      ...(updates.title !== undefined && { title: updates.title }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.assignedUserId !== undefined && { assigned_user_id: updates.assignedUserId, assigned_team_id: null }),
      ...(updates.assignedTeamId !== undefined && { assigned_team_id: updates.assignedTeamId, assigned_user_id: null }),
      ...(updates.priority !== undefined && { priority: updates.priority }),
      ...(updates.startDate !== undefined && { start_date: updates.startDate }),
      ...(updates.dueDate !== undefined && { due_date: updates.dueDate }),
    })
    .eq("id", taskId);

  return { error };
}

export async function deleteTask(taskId: string) {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  return { error };
}

export type TaskAttachmentType = "image" | "file" | "link" | "date";

export type TaskCommentAttachment = { url: string; type: TaskAttachmentType; name: string | null };

export type TaskComment = {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
  authorName: string;
  authorAvatarUrl: string | null;
  authorAvatarColor: string;
  attachment: TaskCommentAttachment | null;
  replyTo: { id: string; authorName: string; content: string } | null;
};

export async function listTaskComments(taskId: string) {
  const { data: commentRows, error } = await supabase
    .from("task_comments")
    .select("id, task_id, user_id, content, reply_to_id, attachment_url, attachment_type, attachment_name, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) return { data: [] as TaskComment[], error };

  const userIds = Array.from(new Set((commentRows ?? []).map((c) => c.user_id)));
  const { data: profileRows, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, nickname, avatar_url, avatar_color")
    .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);

  if (profilesError) return { data: [] as TaskComment[], error: profilesError };

  const profileById = new Map((profileRows ?? []).map((p) => [p.id, p]));
  const rowById = new Map((commentRows ?? []).map((r) => [r.id, r]));

  const comments: TaskComment[] = (commentRows ?? []).map((row) => {
    const profile = profileById.get(row.user_id);
    const parentRow = row.reply_to_id ? rowById.get(row.reply_to_id) : null;
    const parentProfile = parentRow ? profileById.get(parentRow.user_id) : null;

    return {
      id: row.id,
      taskId: row.task_id,
      userId: row.user_id,
      content: row.content,
      createdAt: row.created_at,
      authorName: profile?.nickname || profile?.full_name || "Miembro",
      authorAvatarUrl: profile?.avatar_url ?? null,
      authorAvatarColor: profile?.avatar_color ?? "#2563EB",
      attachment: row.attachment_url
        ? { url: row.attachment_url, type: (row.attachment_type as TaskAttachmentType) ?? "file", name: row.attachment_name }
        : null,
      replyTo: parentRow
        ? { id: parentRow.id, authorName: parentProfile?.nickname || parentProfile?.full_name || "Miembro", content: parentRow.content }
        : null,
    };
  });

  return { data: comments, error: null };
}

export async function addTaskComment(params: {
  taskId: string;
  userId: string;
  content: string;
  replyToId?: string | null;
  attachmentUrl?: string | null;
  attachmentType?: TaskAttachmentType | null;
  attachmentName?: string | null;
}) {
  const { data, error } = await supabase
    .from("task_comments")
    .insert({
      task_id: params.taskId,
      user_id: params.userId,
      content: params.content,
      reply_to_id: params.replyToId ?? null,
      attachment_url: params.attachmentUrl ?? null,
      attachment_type: params.attachmentType ?? null,
      attachment_name: params.attachmentName ?? null,
    })
    .select("id")
    .single();

  return { data, error };
}

export async function uploadTaskAttachment(ownerUserId: string, data: ArrayBuffer | File, contentType: string, ext: string) {
  return uploadFile(ownerUserId, data, contentType, ext, "task-attachment");
}

export async function deleteTaskComment(commentId: string) {
  const { error } = await supabase.from("task_comments").delete().eq("id", commentId);
  return { error };
}
