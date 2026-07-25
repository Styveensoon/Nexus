import { supabase } from "./supabase";
import { Team, getTeamsByIds } from "./teams";
import { uploadFile } from "./icons";
import { logActivity } from "./activity";
import {
  getDisplayName,
  notifyTaskAssigned,
  notifyTaskTeamAssigned,
  notifyTaskCollaboratorAdded,
  notifyTaskBlockedToggle,
} from "./emails";
import { pushNotification } from "./notifications";
import { AutomationEvent, ProjectAutomation, matchEnabledAutomations } from "./automations";

export type TaskStatus =
  | "backlog"
  | "pending"
  | "in_progress"
  | "in_review"
  | "testing"
  | "blocked"
  | "completed"
  | "cancelled";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  pending: "Pendiente",
  in_progress: "En progreso",
  in_review: "En revisión",
  testing: "En pruebas",
  blocked: "Bloqueada",
  completed: "Completada",
  cancelled: "Cancelada",
};

export const TASK_STATUS_ORDER: TaskStatus[] = [
  "backlog",
  "pending",
  "in_progress",
  "in_review",
  "testing",
  "blocked",
  "completed",
  "cancelled",
];

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  backlog: "#64748B",
  pending: "#94A3B8",
  in_progress: "#2563EB",
  in_review: "#A855F7",
  testing: "#0D9488",
  blocked: "#EF4444",
  completed: "#10B981",
  cancelled: "#78716C",
};

// Estados que ya no cuentan como "activos" para vencimiento — una task
// cancelada no debe marcarse "vencida" igual que una completada.
const TERMINAL_STATUSES: TaskStatus[] = ["completed", "cancelled"];

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
  labels: string[];
};

// Un color determinístico por texto (mismo string siempre da el mismo color)
// para las etiquetas libres — no hay tabla de colores porque no hay catálogo
// de labels (texto libre de verdad, ver la columna en schema.sql). Paleta
// fija de 8 tonos legibles en claro/oscuro, elegida por un hash simple del
// string en vez de aleatorio, para que la misma etiqueta ("bug", "urgente")
// se vea siempre igual en toda la app sin persistir nada.
const LABEL_COLOR_PALETE = ["#2C7BD1", "#0D9488", "#F97316", "#A855F7", "#EF4444", "#65A30D", "#DB2777", "#64748B"];
export function labelColor(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return LABEL_COLOR_PALETE[hash % LABEL_COLOR_PALETE.length];
}

export function isOverdue(task: Task) {
  if (!task.dueDate || TERMINAL_STATUSES.includes(task.status)) return false;
  return task.dueDate < new Date().toISOString().slice(0, 10);
}

export const DUE_SOON_DAYS = 2;
// Violeta a propósito, no ámbar/naranja: la prioridad "Alta" ya usa naranja
// (TASK_PRIORITY_COLORS.high) y un ámbar quedaba demasiado parecido a simple
// vista — con el ícono distinto (bandera vs. calendario) ya alcanza para
// distinguir el tipo de chip, pero el color no debía competir con la escala
// de prioridad.
export const DUE_SOON_COLOR = "#8B5CF6";

export function isDueSoon(task: Task) {
  if (!task.dueDate || TERMINAL_STATUSES.includes(task.status) || isOverdue(task)) return false;
  const todayIso = new Date().toISOString().slice(0, 10);
  const limitIso = new Date(Date.now() + DUE_SOON_DAYS * 86400000).toISOString().slice(0, 10);
  return task.dueDate >= todayIso && task.dueDate <= limitIso;
}

export function formatShortDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

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
  labels: string[] | null;
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
      labels: row.labels ?? [],
    });
    return acc;
  }, []);

  return { data: tasks, error: null };
}

const TASK_COLUMNS =
  "id, project_id, title, description, status, priority, start_date, due_date, assigned_user_id, assigned_team_id, created_by, created_at, labels";

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

// Motor de ejecución de automatizaciones — vive acá (no en automations.ts)
// para evitar un import circular: necesita llamar a updateTask/
// updateTaskStatus/addTaskComment, que están en este mismo archivo. Nunca se
// llama a sí mismo indirectamente: cada acción escribe con
// { skipAutomations: true }, así una automatización jamás dispara otra
// (cascada de un solo nivel, por construcción). Si una regla puntual falla,
// se loguea con console.warn y se sigue con las demás — una automatización
// rota nunca debe tumbar la acción humana que la disparó.
async function runProjectAutomations(event: AutomationEvent) {
  const matching = await matchEnabledAutomations(event);
  for (const automation of matching) {
    try {
      await executeAutomationAction(automation, event);
    } catch (err) {
      console.warn(`Automatización "${automation.name}" falló:`, err);
    }
  }
}

async function executeAutomationAction(automation: ProjectAutomation, event: AutomationEvent) {
  const { actionType, actionConfig } = automation;
  const taskId = event.taskId;

  switch (actionType) {
    case "change_status": {
      const status = actionConfig.status as TaskStatus | undefined;
      if (!status) return;
      await updateTaskStatus(taskId, status, { skipAutomations: true });
      return;
    }
    case "change_priority": {
      const priority = actionConfig.priority as TaskPriority | undefined;
      if (!priority) return;
      await updateTask(taskId, { priority }, { skipAutomations: true });
      return;
    }
    case "add_label": {
      const label = (actionConfig.label as string | undefined)?.trim();
      if (!label) return;
      const { data: row } = await supabase.from("tasks").select("labels").eq("id", taskId).maybeSingle();
      const current: string[] = row?.labels ?? [];
      if (current.some((l) => l.toLowerCase() === label.toLowerCase())) return;
      await updateTask(taskId, { labels: [...current, label] }, { skipAutomations: true });
      return;
    }
    case "assign_to_user": {
      const userId = actionConfig.userId as string | undefined;
      if (!userId) return;
      await updateTask(taskId, { assignedUserId: userId, assignedTeamId: null }, { skipAutomations: true });
      return;
    }
    case "post_comment": {
      const content = (actionConfig.content as string | undefined)?.trim();
      if (!content) return;
      // Sin skipActivityLog — un comentario de automatización es un comentario
      // real con texto, debe aparecer en Actividad igual que uno humano (ese
      // flag es solo para los adjuntos sin texto que se agregan al crear una
      // task, ver el comentario en addTaskComment).
      await addTaskComment({ taskId, userId: event.actorUserId, content });
      return;
    }
    case "notify_user": {
      const userId = actionConfig.userId as string | undefined;
      if (!userId) return;
      await pushNotification(
        event.organizationId,
        [userId],
        "automation_triggered",
        automation.name,
        (actionConfig.message as string | undefined)?.trim() || `Automatización "${automation.name}" se activó.`,
        { entityType: "task", entityId: taskId, projectId: event.projectId }
      );
      return;
    }
  }
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
  labels?: string[];
}, opts?: { skipAutomations?: boolean }) {
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
      labels: params.labels ?? [],
    })
    .select("id")
    .single();

  if (!error && data) {
    const { data: project } = await supabase.from("projects").select("organization_id, name").eq("id", params.projectId).maybeSingle();
    if (project) {
      await logActivity({
        organizationId: project.organization_id,
        actorId: params.createdBy,
        action: "task_created",
        entityType: "task",
        entityName: params.title,
        entityId: data.id,
        projectId: params.projectId,
      });

      if (params.assignedUserId) {
        const assignedByName = await getDisplayName(params.createdBy);
        await notifyTaskAssigned(
          params.assignedUserId,
          params.title,
          project.name,
          assignedByName,
          params.dueDate ?? null,
          project.organization_id,
          params.projectId,
          data.id
        );
      } else if (params.assignedTeamId) {
        await notifyTaskTeamAssigned(params.assignedTeamId, params.title, project.name, project.organization_id, params.projectId, data.id);
      }

      if (!opts?.skipAutomations) {
        await runProjectAutomations({
          type: "task_created",
          taskId: data.id,
          projectId: params.projectId,
          organizationId: project.organization_id,
          actorUserId: params.createdBy,
        });
      }
    }
  }

  return { data, error };
}

export async function updateTaskStatus(taskId: string, status: TaskStatus, opts?: { skipAutomations?: boolean }) {
  const { data: taskBefore } = await supabase
    .from("tasks")
    .select("project_id, title, status, assigned_user_id, assigned_team_id")
    .eq("id", taskId)
    .maybeSingle();
  const { error } = await supabase.from("tasks").update({ status }).eq("id", taskId);

  if (!error && taskBefore) {
    const { data: project } = await supabase.from("projects").select("organization_id").eq("id", taskBefore.project_id).maybeSingle();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (project && user) {
      await logActivity({
        organizationId: project.organization_id,
        actorId: user.id,
        action: "task_status_changed",
        entityType: "task",
        entityName: taskBefore.title,
        entityId: taskId,
        projectId: taskBefore.project_id,
        metadata: {
          toStatus: status,
          toLabel: TASK_STATUS_LABELS[status],
          fromStatus: taskBefore.status,
          fromLabel: TASK_STATUS_LABELS[taskBefore.status as TaskStatus],
        },
      });

      // 5.5: aviso al asignado (persona o equipo) al entrar o salir del
      // estado "bloqueada" — no en cualquier otro cambio de status.
      const enteringBlocked = status === "blocked" && taskBefore.status !== "blocked";
      const leavingBlocked = status !== "blocked" && taskBefore.status === "blocked";
      if (enteringBlocked || leavingBlocked) {
        const changedByName = await getDisplayName(user.id);
        if (taskBefore.assigned_user_id) {
          await notifyTaskBlockedToggle(
            [taskBefore.assigned_user_id],
            taskBefore.title,
            enteringBlocked,
            changedByName,
            project.organization_id,
            taskBefore.project_id,
            taskId
          );
        } else if (taskBefore.assigned_team_id) {
          const { data: teamMembers } = await supabase.from("team_members").select("user_id").eq("team_id", taskBefore.assigned_team_id);
          await notifyTaskBlockedToggle(
            (teamMembers ?? []).map((m) => m.user_id),
            taskBefore.title,
            enteringBlocked,
            changedByName,
            project.organization_id,
            taskBefore.project_id,
            taskId
          );
        }
      }

      if (!opts?.skipAutomations) {
        await runProjectAutomations({
          type: "task_status_changed",
          taskId,
          projectId: taskBefore.project_id,
          organizationId: project.organization_id,
          actorUserId: user.id,
          toStatus: status,
          fromStatus: taskBefore.status as TaskStatus,
        });
      }
    }
  }

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
    labels: string[];
  }>,
  opts?: { skipAutomations?: boolean }
) {
  // Se necesita el estado previo solo si cambia la asignación (para saber a
  // quién avisar) o la fecha límite (para resetear el aviso de vencimiento
  // ya mandado — ver due_reminder_sent_at en schema.sql).
  const needsBefore = updates.assignedUserId !== undefined || updates.assignedTeamId !== undefined || updates.dueDate !== undefined;
  const { data: before } = needsBefore
    ? await supabase.from("tasks").select("project_id, title, assigned_user_id, assigned_team_id, due_date").eq("id", taskId).maybeSingle()
    : { data: null };

  // assignedUserId/assignedTeamId se tratan como UNA sola unidad (persona XOR
  // equipo, tasks_assignee_xor) — spreadearlos por separado con un "&& { ...,
  // otroCampo: null }" cada uno se pisaba entre sí cuando el caller manda los
  // DOS (que es siempre el caso real: TasksScreen.saveEditTask siempre pasa
  // assignedUserId Y assignedTeamId, uno con el id elegido y el otro en null
  // explícito) — el segundo spread terminaba dejando AMBOS en null y violando
  // el constraint. Bug real encontrado probando en vivo (ver docs/TRAMPAS.md).
  const assigneeChangedFields =
    updates.assignedUserId !== undefined || updates.assignedTeamId !== undefined
      ? { assigned_user_id: updates.assignedUserId ?? null, assigned_team_id: updates.assignedTeamId ?? null }
      : {};

  const { error } = await supabase
    .from("tasks")
    .update({
      ...(updates.title !== undefined && { title: updates.title }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...assigneeChangedFields,
      ...(updates.priority !== undefined && { priority: updates.priority }),
      ...(updates.startDate !== undefined && { start_date: updates.startDate }),
      ...(updates.dueDate !== undefined && {
        due_date: updates.dueDate,
        ...(updates.dueDate !== before?.due_date && { due_reminder_sent_at: null }),
      }),
      ...(updates.labels !== undefined && { labels: updates.labels }),
    })
    .eq("id", taskId);

  if (!error && before) {
    const assigneeChanged =
      (updates.assignedUserId !== undefined && updates.assignedUserId !== before.assigned_user_id) ||
      (updates.assignedTeamId !== undefined && updates.assignedTeamId !== before.assigned_team_id);

    if (assigneeChanged) {
      const [{ data: project }, { data: { user } }] = await Promise.all([
        supabase.from("projects").select("name, organization_id").eq("id", before.project_id).maybeSingle(),
        supabase.auth.getUser(),
      ]);
      const title = updates.title ?? before.title;
      if (project && user) {
        const assignedByName = await getDisplayName(user.id);
        if (updates.assignedUserId) {
          await notifyTaskAssigned(
            updates.assignedUserId,
            title,
            project.name,
            assignedByName,
            updates.dueDate ?? null,
            project.organization_id,
            before.project_id,
            taskId
          );
        } else if (updates.assignedTeamId) {
          await notifyTaskTeamAssigned(updates.assignedTeamId, title, project.name, project.organization_id, before.project_id, taskId);
        }

        if (!opts?.skipAutomations) {
          await runProjectAutomations({
            type: "task_assigned",
            taskId,
            projectId: before.project_id,
            organizationId: project.organization_id,
            actorUserId: user.id,
            assignedUserId: updates.assignedUserId ?? null,
            assignedTeamId: updates.assignedTeamId ?? null,
          });
        }
      }
    }
  }

  return { error };
}

export async function deleteTask(taskId: string) {
  const { data: before } = await supabase.from("tasks").select("project_id, title").eq("id", taskId).maybeSingle();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);

  if (!error && before) {
    const { data: project } = await supabase.from("projects").select("organization_id").eq("id", before.project_id).maybeSingle();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (project && user) {
      await logActivity({
        organizationId: project.organization_id,
        actorId: user.id,
        action: "task_deleted",
        entityType: "task",
        entityName: before.title,
        // El proyecto sigue existiendo (solo se borró la task), a diferencia
        // de project_deleted/team_deleted no hace falta omitir projectId acá.
        projectId: before.project_id,
      });
    }
  }

  return { error };
}

export type TaskAttachmentType = "image" | "file" | "link" | "date";

export type TaskCommentAttachment = { url: string; type: TaskAttachmentType; name: string | null };

export type ReactionType = "like" | "heart" | "dislike" | "question";

export const REACTION_TYPES: ReactionType[] = ["like", "heart", "dislike", "question"];

export type CommentReactions = {
  counts: Record<ReactionType, number>;
  myReaction: ReactionType | null;
};

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
  reactions: CommentReactions;
};

function emptyReactions(): CommentReactions {
  return { counts: { like: 0, heart: 0, dislike: 0, question: 0 }, myReaction: null };
}

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

  const commentIds = (commentRows ?? []).map((c) => c.id);
  const { data: reactionRows, error: reactionsError } = await supabase
    .from("task_comment_reactions")
    .select("comment_id, user_id, reaction")
    .in("comment_id", commentIds.length ? commentIds : ["00000000-0000-0000-0000-000000000000"]);

  if (reactionsError) return { data: [] as TaskComment[], error: reactionsError };

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  const reactionsByComment = new Map<string, CommentReactions>();
  (reactionRows ?? []).forEach((r) => {
    const entry = reactionsByComment.get(r.comment_id) ?? emptyReactions();
    entry.counts[r.reaction as ReactionType] += 1;
    if (currentUser && r.user_id === currentUser.id) entry.myReaction = r.reaction as ReactionType;
    reactionsByComment.set(r.comment_id, entry);
  });

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
      reactions: reactionsByComment.get(row.id) ?? emptyReactions(),
    };
  });

  return { data: comments, error: null };
}

// Estilo WhatsApp: una sola reacción por persona por comentario. Tocar la
// misma reacción que ya tenías la quita (toggle); tocar otra la reemplaza.
export async function reactToComment(commentId: string, userId: string, reaction: ReactionType) {
  const { data: existing } = await supabase
    .from("task_comment_reactions")
    .select("id, reaction")
    .eq("comment_id", commentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.reaction === reaction) {
    const { error } = await supabase.from("task_comment_reactions").delete().eq("id", existing.id);
    return { error };
  }

  if (existing) {
    const { error } = await supabase.from("task_comment_reactions").update({ reaction }).eq("id", existing.id);
    return { error };
  }

  const { error } = await supabase.from("task_comment_reactions").insert({ comment_id: commentId, user_id: userId, reaction });
  return { error };
}

export async function addTaskComment(params: {
  taskId: string;
  userId: string;
  content: string;
  replyToId?: string | null;
  attachmentUrl?: string | null;
  attachmentType?: TaskAttachmentType | null;
  attachmentName?: string | null;
  // true solo para los adjuntos iniciales que se agregan AL CREAR una task
  // (ver el loop sobre newAttachments en handleCreate, TasksScreen.tsx) — esos
  // pasan por esta misma función con content:"" y no deben aparecer en
  // Actividad como "comentó en la tarea". Un comentario real del chat (con
  // texto, con adjunto, o ambos) siempre deja rastro.
  skipActivityLog?: boolean;
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

  if (!error && data && !params.skipActivityLog && (params.content.trim() || params.attachmentUrl)) {
    const { data: task } = await supabase.from("tasks").select("project_id, title").eq("id", params.taskId).maybeSingle();
    if (task) {
      const { data: project } = await supabase.from("projects").select("organization_id").eq("id", task.project_id).maybeSingle();
      if (project) {
        await logActivity({
          organizationId: project.organization_id,
          actorId: params.userId,
          action: "task_comment_created",
          entityType: "task",
          entityName: task.title,
          entityId: params.taskId,
          projectId: task.project_id,
          // El comentario real (+ su adjunto, si tiene), para que el detalle
          // de Actividad (Punto 4 del feedback) pueda mostrar el contenido
          // real en vez de solo "comentó en la tarea" — incluida la imagen/
          // link/archivo, no un texto genérico de "tal vez fue un adjunto".
          metadata: {
            commentContent: params.content,
            attachmentUrl: params.attachmentUrl ?? null,
            attachmentType: params.attachmentType ?? null,
            attachmentName: params.attachmentName ?? null,
          },
        });
      }
    }
  }

  return { data, error };
}

export async function uploadTaskAttachment(ownerUserId: string, data: ArrayBuffer | File, contentType: string, ext: string) {
  return uploadFile(ownerUserId, data, contentType, ext, "task-attachment");
}

export async function deleteTaskComment(commentId: string) {
  const { error } = await supabase.from("task_comments").delete().eq("id", commentId);
  return { error };
}

// Checklist simple dentro de una task (estilo Trello) — colaborativo: quien
// está involucrado en la task puede agregar/tildar cualquier ítem, pero solo
// quien lo creó puede borrarlo (mismo criterio que task_comments_delete_own).
export type TaskChecklistItem = {
  id: string;
  taskId: string;
  content: string;
  completed: boolean;
  createdBy: string;
  createdAt: string;
};

function mapChecklistRow(row: any): TaskChecklistItem {
  return { id: row.id, taskId: row.task_id, content: row.content, completed: row.completed, createdBy: row.created_by, createdAt: row.created_at };
}

export async function listChecklistItems(taskId: string) {
  const { data, error } = await supabase
    .from("task_checklist_items")
    .select("id, task_id, content, completed, created_by, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  return { data: (data ?? []).map(mapChecklistRow), error };
}

export async function addChecklistItem(taskId: string, userId: string, content: string) {
  const { data, error } = await supabase
    .from("task_checklist_items")
    .insert({ task_id: taskId, content, created_by: userId })
    .select("id, task_id, content, completed, created_by, created_at")
    .single();

  return { data: data ? mapChecklistRow(data) : null, error };
}

export async function toggleChecklistItem(itemId: string, completed: boolean) {
  const { error } = await supabase.from("task_checklist_items").update({ completed }).eq("id", itemId);
  return { error };
}

export async function deleteChecklistItem(itemId: string) {
  const { error } = await supabase.from("task_checklist_items").delete().eq("id", itemId);
  return { error };
}

// Dependencias entre tareas del MISMO proyecto ("task_id no puede avanzar
// hasta que depends_on_task_id esté lista") — solo informativo/de
// planificación, no bloquea de verdad cambiar el status (ver nota en
// schema.sql). Gestionarlas requiere poder editar la task (líder/owner),
// igual criterio que crear/editar tasks — no es colaborativo como el
// checklist.
export type TaskDependencyRef = { dependencyId: string; taskId: string; title: string; status: TaskStatus };

async function resolveDependencyRefs(
  rows: { id: string; task_id: string; depends_on_task_id: string }[],
  idField: "task_id" | "depends_on_task_id",
  refField: "task_id" | "depends_on_task_id"
): Promise<TaskDependencyRef[]> {
  const refIds = Array.from(new Set(rows.map((r) => r[refField])));
  if (!refIds.length) return [];
  const { data: refTasks } = await supabase.from("tasks").select("id, title, status").in("id", refIds);
  const byId = new Map((refTasks ?? []).map((t) => [t.id, t]));
  return rows
    .map((r) => {
      const t = byId.get(r[refField]);
      if (!t) return null;
      return { dependencyId: r.id, taskId: t.id, title: t.title, status: t.status as TaskStatus };
    })
    .filter((x): x is TaskDependencyRef => x !== null);
}

// Devuelve, para una task puntual: de qué tareas depende ("dependsOn") y qué
// tareas dependen de ella ("blocks" — si esta no avanza, esas tampoco).
export async function listTaskDependencies(taskId: string) {
  const [{ data: dependsOnRows, error: e1 }, { data: blocksRows, error: e2 }] = await Promise.all([
    supabase.from("task_dependencies").select("id, task_id, depends_on_task_id").eq("task_id", taskId),
    supabase.from("task_dependencies").select("id, task_id, depends_on_task_id").eq("depends_on_task_id", taskId),
  ]);
  if (e1 || e2) return { dependsOn: [] as TaskDependencyRef[], blocks: [] as TaskDependencyRef[], error: e1 ?? e2 };

  const [dependsOn, blocks] = await Promise.all([
    resolveDependencyRefs(dependsOnRows ?? [], "task_id", "depends_on_task_id"),
    resolveDependencyRefs(blocksRows ?? [], "depends_on_task_id", "task_id"),
  ]);
  return { dependsOn, blocks, error: null };
}

// Detecta si agregar "taskId depende de dependsOnTaskId" cerraría un ciclo
// (ej. A depende de B, B depende de A) — recorre el grafo de dependencias del
// proyecto en el cliente ANTES de insertar, porque validar ciclos de un grafo
// arbitrario en SQL puro es mucho más caro que hacerlo una vez acá.
async function wouldCreateCycle(projectId: string, taskId: string, dependsOnTaskId: string): Promise<boolean> {
  const { data: projectTasks } = await supabase.from("tasks").select("id").eq("project_id", projectId);
  const taskIds = (projectTasks ?? []).map((t) => t.id);
  if (!taskIds.length) return false;

  const { data: allDeps } = await supabase.from("task_dependencies").select("task_id, depends_on_task_id").in("task_id", taskIds);
  const edges = new Map<string, string[]>();
  (allDeps ?? []).forEach((d) => edges.set(d.task_id, [...(edges.get(d.task_id) ?? []), d.depends_on_task_id]));
  // La arista nueva sería taskId -> dependsOnTaskId; hay ciclo si ya existe un
  // camino de dependsOnTaskId de vuelta a taskId.
  const visited = new Set<string>();
  const stack = [dependsOnTaskId];
  while (stack.length) {
    const current = stack.pop()!;
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    (edges.get(current) ?? []).forEach((next) => stack.push(next));
  }
  return false;
}

export async function addTaskDependency(projectId: string, taskId: string, dependsOnTaskId: string, userId: string) {
  if (taskId === dependsOnTaskId) return { error: { message: "Una tarea no puede depender de sí misma." } };
  if (await wouldCreateCycle(projectId, taskId, dependsOnTaskId)) {
    return { error: { message: "Esa dependencia crearía un ciclo (dependencia circular)." } };
  }
  const { error } = await supabase.from("task_dependencies").insert({ task_id: taskId, depends_on_task_id: dependsOnTaskId, created_by: userId });
  return { error };
}

export async function deleteTaskDependency(dependencyId: string) {
  const { error } = await supabase.from("task_dependencies").delete().eq("id", dependencyId);
  return { error };
}

// Colaboradores adicionales de una task (Punto 3 del feedback) — a
// diferencia del asignado (persona O equipo, exclusivo, ver
// tasks_assignee_xor), un colaborador es gente extra que también puede ver y
// comentar la task sin ser la responsable de cambiar su status. Solo el
// líder del proyecto o el owner de la organización pueden agregar/quitar
// colaboradores (mismo criterio que crear/editar la task, ver
// task_collaborators_insert_leader_owner en schema.sql).
export type TaskCollaborator = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  avatarColor: string;
  createdAt: string;
};

export async function listTaskCollaborators(taskId: string) {
  const { data: rows, error } = await supabase
    .from("task_collaborators")
    .select("user_id, created_at")
    .eq("task_id", taskId);

  if (error) return { data: [] as TaskCollaborator[], error };

  const userIds = (rows ?? []).map((r) => r.user_id);
  const { data: profileRows, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, nickname, avatar_url, avatar_color")
    .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);

  if (profilesError) return { data: [] as TaskCollaborator[], error: profilesError };

  const profileById = new Map((profileRows ?? []).map((p) => [p.id, p]));
  const collaborators: TaskCollaborator[] = (rows ?? []).map((r) => {
    const profile = profileById.get(r.user_id);
    return {
      userId: r.user_id,
      name: profile?.nickname || profile?.full_name || "Miembro",
      avatarUrl: profile?.avatar_url ?? null,
      avatarColor: profile?.avatar_color ?? "#2563EB",
      createdAt: r.created_at,
    };
  });

  return { data: collaborators, error: null };
}

export async function addTaskCollaborator(taskId: string, userId: string, addedBy: string) {
  const { error } = await supabase.from("task_collaborators").insert({ task_id: taskId, user_id: userId, added_by: addedBy });

  if (!error) {
    const { data: task } = await supabase.from("tasks").select("title, project_id").eq("id", taskId).maybeSingle();
    if (task) {
      const { data: project } = await supabase.from("projects").select("organization_id").eq("id", task.project_id).maybeSingle();
      if (project) {
        const addedByName = await getDisplayName(addedBy);
        await notifyTaskCollaboratorAdded(userId, task.title, addedByName, project.organization_id, task.project_id, taskId);
      }
    }
  }

  return { error };
}

export async function removeTaskCollaborator(taskId: string, userId: string) {
  const { error } = await supabase.from("task_collaborators").delete().eq("task_id", taskId).eq("user_id", userId);
  return { error };
}

// Tareas de un usuario puntual en toda la organización (Punto 3 del
// feedback, buscador de usuarios en Tasks) — asignado directo, integrante de
// un equipo asignado, o colaborador. Reusa listTasksForProjects/hydrateTasks
// en vez de duplicar la hidratación de asignado.
export async function listTasksForUser(organizationId: string, userId: string) {
  const { data: projectRows, error: projectsError } = await supabase
    .from("projects")
    .select("id")
    .eq("organization_id", organizationId);

  if (projectsError) return { data: [] as Task[], error: projectsError };

  const projectIds = (projectRows ?? []).map((p) => p.id);
  const { data: allTasks, error } = await listTasksForProjects(projectIds);
  if (error) return { data: [] as Task[], error };

  const { data: teamMemberRows } = await supabase.from("team_members").select("team_id").eq("user_id", userId);
  const myTeamIds = new Set((teamMemberRows ?? []).map((t) => t.team_id));

  const taskIds = allTasks.map((t) => t.id);
  const { data: collabRows } = await supabase
    .from("task_collaborators")
    .select("task_id")
    .eq("user_id", userId)
    .in("task_id", taskIds.length ? taskIds : ["00000000-0000-0000-0000-000000000000"]);
  const collabTaskIds = new Set((collabRows ?? []).map((c) => c.task_id));

  const tasks = allTasks.filter(
    (t) =>
      (t.assignee.type === "user" && t.assignee.userId === userId) ||
      (t.assignee.type === "team" && myTeamIds.has(t.assignee.teamId)) ||
      collabTaskIds.has(t.id)
  );

  return { data: tasks, error: null };
}
