import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  Calendar,
  Check,
  CircleCheckBig,
  Crown,
  FileText,
  Flag,
  Folder,
  Link2,
  MessageSquare,
  Pencil,
  Plus,
  Reply,
  Send,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react-native";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { listProjects, Project } from "../lib/projects";
import ChatAttachmentButtons from "../components/ChatAttachmentButtons";
import DatePickerModal from "../components/DatePickerModal";
import {
  addTaskComment,
  createTask,
  deleteTask,
  deleteTaskComment,
  listTaskComments,
  listTasksForProjects,
  Task,
  TaskComment,
  TaskCommentAttachment,
  TaskPriority,
  TaskStatus,
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_ORDER,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  updateTask,
  updateTaskStatus,
  uploadTaskAttachment,
} from "../lib/tasks";

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: "#94A3B8",
  in_progress: "#2563EB",
  blocked: "#EF4444",
  completed: "#10B981",
};

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function formatShortDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function isOverdue(task: Task) {
  if (!task.dueDate || task.status === "completed") return false;
  return task.dueDate < new Date().toISOString().slice(0, 10);
}

const DUE_SOON_DAYS = 2;
// Violeta a propósito, no ámbar/naranja: la prioridad "Alta" ya usa naranja
// (#F97316) y un ámbar quedaba demasiado parecido a simple vista — con la
// bandera vs. el ícono de calendario ya alcanza para distinguir el tipo de
// chip, pero el color no debía competir con la escala de prioridad.
const DUE_SOON_COLOR = "#8B5CF6";

function isDueSoon(task: Task) {
  if (!task.dueDate || task.status === "completed" || isOverdue(task)) return false;
  const todayIso = new Date().toISOString().slice(0, 10);
  const limitIso = new Date(Date.now() + DUE_SOON_DAYS * 86400000).toISOString().slice(0, 10);
  return task.dueDate >= todayIso && task.dueDate <= limitIso;
}

function nextStatus(status: TaskStatus): TaskStatus {
  const idx = TASK_STATUS_ORDER.indexOf(status);
  return TASK_STATUS_ORDER[(idx + 1) % TASK_STATUS_ORDER.length];
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatAttachmentDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function attachmentLabel(attachment: TaskCommentAttachment) {
  if (attachment.type === "date") return formatAttachmentDate(attachment.url);
  if (attachment.type === "link") return attachment.url;
  return attachment.name ?? "Adjunto";
}

function renderLinkifiedText(text: string, linkColor: string) {
  return text.split(URL_REGEX).map((part, idx) =>
    /^https?:\/\//.test(part) ? (
      <Text key={idx} style={{ color: linkColor, fontWeight: "700", textDecorationLine: "underline" }} onPress={() => Linking.openURL(part)}>
        {part}
      </Text>
    ) : (
      <Text key={idx}>{part}</Text>
    )
  );
}

type AssignableUser = { userId: string; name: string; avatarUrl: string | null; avatarColor: string };

export default function TasksScreen({ navigation, route }: any) {
  const { isDark } = useTheme();
  const { user, organization, loading: authLoading } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isWeb = Platform.OS === "web";

  const bg            = isDark ? "#020617" : "#FAFAFA";
  const cardBg        = isDark ? "rgba(15, 23, 42, 0.8)" : "rgba(255, 255, 255, 0.9)";
  const border        = isDark ? "rgba(51, 65, 85, 0.5)" : "rgba(226, 232, 240, 0.8)";
  const textPrimary   = isDark ? "#F8FAFC" : "#020617";
  const textSecondary = isDark ? "#94A3B8" : "#475569";
  const primaryColor  = organization?.color ?? "#2563EB";
  const inputBg       = isDark ? "rgba(255,255,255,0.04)" : "#F8FAFC";
  const dangerColor   = "#EF4444";

  const ultraShadow = Platform.select({
    web: {
      boxShadow: isDark
        ? "0 25px 50px -12px rgba(0,0,0,1), 0 0 0 1px rgba(255,255,255,0.05) inset"
        : "0 30px 60px -15px rgba(0,0,0,0.08), 0 10px 30px -5px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.02) inset",
      backdropFilter: "blur(12px)",
    } as any,
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDark ? 0.4 : 0.06,
      shadowRadius: 16,
      elevation: 6,
    },
  });

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [filterOnlyMine, setFilterOnlyMine] = useState(false);
  const [filterOverdueOnly, setFilterOverdueOnly] = useState(false);
  const [filterPriorities, setFilterPriorities] = useState<Set<TaskPriority>>(new Set());

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [assigneeMode, setAssigneeMode] = useState<"user" | "team">("user");
  const [selectedAssigneeUserId, setSelectedAssigneeUserId] = useState<string | null>(null);
  const [selectedAssigneeTeamId, setSelectedAssigneeTeamId] = useState<string | null>(null);
  const [newPriority, setNewPriority] = useState<TaskPriority>("medium");
  const [newStartDate, setNewStartDate] = useState<string | null>(null);
  const [newDueDate, setNewDueDate] = useState<string | null>(null);
  const [showNewStartDatePicker, setShowNewStartDatePicker] = useState(false);
  const [showNewDueDatePicker, setShowNewDueDatePicker] = useState(false);
  const [newAttachments, setNewAttachments] = useState<TaskCommentAttachment[]>([]);
  const [uploadingCreateAttachment, setUploadingCreateAttachment] = useState(false);
  const [createAttachError, setCreateAttachError] = useState<string | null>(null);
  const [showCreateDatePicker, setShowCreateDatePicker] = useState(false);
  const [showCreateLinkInput, setShowCreateLinkInput] = useState(false);
  const [createLinkInputValue, setCreateLinkInputValue] = useState("");

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAssigneeMode, setEditAssigneeMode] = useState<"user" | "team">("user");
  const [editSelectedAssigneeUserId, setEditSelectedAssigneeUserId] = useState<string | null>(null);
  const [editSelectedAssigneeTeamId, setEditSelectedAssigneeTeamId] = useState<string | null>(null);
  const [editPriority, setEditPriority] = useState<TaskPriority>("medium");
  const [editStartDate, setEditStartDate] = useState<string | null>(null);
  const [editDueDate, setEditDueDate] = useState<string | null>(null);
  const [showEditStartDatePicker, setShowEditStartDatePicker] = useState(false);
  const [showEditDueDatePicker, setShowEditDueDatePicker] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<TaskComment | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<TaskCommentAttachment | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkInputValue, setLinkInputValue] = useState("");
  const [confirmDeleteCommentId, setConfirmDeleteCommentId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!organization) return;
    setLoadingData(true);
    setErrorText(null);

    const { data: projectRows, error: projectsError } = await listProjects(organization.id);
    if (projectsError) {
      setErrorText("No se pudieron cargar los proyectos.");
      setLoadingData(false);
      return;
    }
    setProjects(projectRows);
    setSelectedProjectId((prev) => (prev && projectRows.some((p) => p.id === prev) ? prev : projectRows[0]?.id ?? null));

    const { data: taskRows, error: tasksError } = await listTasksForProjects(projectRows.map((p) => p.id));
    if (tasksError) setErrorText("No se pudieron cargar las tareas.");
    setTasks(taskRows);
    setLoadingData(false);
  }, [organization]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  const isProjectLeaderOrOwner = useCallback(
    (project: Project | null) => {
      if (!project || !user || !organization) return false;
      return organization.owner_id === user.id || project.leaderId === user.id;
    },
    [user, organization]
  );

  const assignableUsers: AssignableUser[] = useMemo(() => {
    if (!selectedProject) return [];
    const map = new Map<string, AssignableUser>();
    [...selectedProject.members, ...selectedProject.teams.flatMap((t) => t.members)].forEach((m) => {
      if (!map.has(m.userId)) map.set(m.userId, { userId: m.userId, name: m.name, avatarUrl: m.avatarUrl, avatarColor: m.avatarColor });
    });
    return Array.from(map.values());
  }, [selectedProject]);

  const isInvolvedInTask = useCallback(
    (task: Task, project: Project | null) => {
      if (!user || !project) return false;
      if (isProjectLeaderOrOwner(project)) return true;
      const assignee = task.assignee;
      if (assignee.type === "user") return assignee.userId === user.id;
      const team = project.teams.find((t) => t.id === assignee.teamId);
      return !!team?.members.some((m) => m.userId === user.id);
    },
    [user, isProjectLeaderOrOwner]
  );

  const canChangeStatus = useCallback(
    (task: Task) => isInvolvedInTask(task, projects.find((p) => p.id === task.projectId) ?? null),
    [isInvolvedInTask, projects]
  );

  // A diferencia de isInvolvedInTask (que da true al líder/owner sobre CUALQUIER
  // task, porque pueden gestionarla), esto es solo "esta task es mía" para el
  // filtro "Solo mías" — sin el atajo de líder/owner.
  const isAssignedToMe = useCallback(
    (task: Task) => {
      if (!user) return false;
      const assignee = task.assignee;
      if (assignee.type === "user") return assignee.userId === user.id;
      const project = projects.find((p) => p.id === task.projectId);
      const team = project?.teams.find((t) => t.id === assignee.teamId);
      return !!team?.members.some((m) => m.userId === user.id);
    },
    [user, projects]
  );

  const togglePriorityFilter = (priority: TaskPriority) => {
    setFilterPriorities((prev) => {
      const next = new Set(prev);
      if (next.has(priority)) next.delete(priority);
      else next.add(priority);
      return next;
    });
  };

  const overdueCount = tasks.filter(isOverdue).length;

  let projectTasks = selectedProjectId ? tasks.filter((t) => t.projectId === selectedProjectId) : [];
  if (filterOnlyMine) projectTasks = projectTasks.filter(isAssignedToMe);
  if (filterOverdueOnly) projectTasks = projectTasks.filter(isOverdue);
  if (filterPriorities.size > 0) projectTasks = projectTasks.filter((t) => filterPriorities.has(t.priority));

  const openCreateModal = () => {
    setNewTitle("");
    setNewDescription("");
    setAssigneeMode("user");
    setSelectedAssigneeUserId(selectedProject?.leaderId ?? null);
    setSelectedAssigneeTeamId(null);
    setNewPriority("medium");
    setNewStartDate(null);
    setNewDueDate(null);
    setCreateError(null);
    setNewAttachments([]);
    setCreateAttachError(null);
    setShowCreateLinkInput(false);
    setCreateLinkInputValue("");
    setShowCreateModal(true);
  };

  const handleCreateAttachmentReady = async (
    data: ArrayBuffer | File,
    contentType: string,
    ext: string,
    name: string,
    kind: "image" | "file"
  ) => {
    if (!user) return;
    setCreateAttachError(null);
    setUploadingCreateAttachment(true);
    const { url, error } = await uploadTaskAttachment(user.id, data, contentType, ext);
    setUploadingCreateAttachment(false);
    if (error || !url) {
      setCreateAttachError("No pudimos subir el adjunto, intenta de nuevo.");
      return;
    }
    setNewAttachments((prev) => [...prev, { url, type: kind, name }]);
  };

  const handleCreatePickDate = (isoDate: string) => {
    setNewAttachments((prev) => [...prev, { url: isoDate, type: "date", name: null }]);
    setShowCreateDatePicker(false);
  };

  const confirmCreateLinkInput = () => {
    const value = createLinkInputValue.trim();
    setShowCreateLinkInput(false);
    if (!value) return;
    const url = /^https?:\/\//.test(value) ? value : `https://${value}`;
    setNewAttachments((prev) => [...prev, { url, type: "link", name: null }]);
    setCreateLinkInputValue("");
  };

  const removeNewAttachment = (idx: number) => {
    setNewAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCreate = async () => {
    if (!selectedProject || !user || !newTitle.trim()) return;
    const assignedUserId = assigneeMode === "user" ? selectedAssigneeUserId : null;
    const assignedTeamId = assigneeMode === "team" ? selectedAssigneeTeamId : null;
    if (!assignedUserId && !assignedTeamId) {
      setCreateError("Elige a quién se le asigna la task.");
      return;
    }
    if (newStartDate && newDueDate && newDueDate < newStartDate) {
      setCreateError("La fecha límite no puede ser antes que la de inicio.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    const { data: taskRow, error } = await createTask({
      projectId: selectedProject.id,
      createdBy: user.id,
      title: newTitle.trim(),
      description: newDescription.trim() || null,
      assignedUserId,
      assignedTeamId,
      priority: newPriority,
      startDate: newStartDate,
      dueDate: newDueDate,
    });
    if (error || !taskRow) {
      setCreating(false);
      setCreateError("No se pudo crear la task.");
      return;
    }
    for (const attachment of newAttachments) {
      await addTaskComment({
        taskId: taskRow.id,
        userId: user.id,
        content: "",
        attachmentUrl: attachment.url,
        attachmentType: attachment.type,
        attachmentName: attachment.name,
      });
    }
    setCreating(false);
    setShowCreateModal(false);
    loadData();
  };

  const handleCycleStatus = async (task: Task) => {
    if (!canChangeStatus(task)) return;
    const status = nextStatus(task.status);
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)));
    if (selectedTask?.id === task.id) setSelectedTask({ ...task, status });
    await updateTaskStatus(task.id, status);
  };

  const handleSetStatus = async (task: Task, status: TaskStatus) => {
    if (!canChangeStatus(task)) return;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)));
    setSelectedTask((prev) => (prev && prev.id === task.id ? { ...prev, status } : prev));
    await updateTaskStatus(task.id, status);
  };

  const handleDelete = async (taskId: string) => {
    setConfirmDeleteId(null);
    const { error } = await deleteTask(taskId);
    if (!error) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      closeTaskDetail();
    }
  };

  const openTaskDetail = async (task: Task) => {
    setSelectedTask(task);
    setEditingTask(false);
    setCommentInput("");
    setComments([]);
    setReplyingTo(null);
    setPendingAttachment(null);
    setCommentError(null);
    setShowLinkInput(false);
    setLinkInputValue("");
    setConfirmDeleteCommentId(null);
    if (!isInvolvedInTask(task, projects.find((p) => p.id === task.projectId) ?? null)) return;
    setLoadingComments(true);
    const { data, error } = await listTaskComments(task.id);
    if (error) setCommentError("No se pudieron cargar los comentarios.");
    setComments(data);
    setLoadingComments(false);
  };

  const closeTaskDetail = () => {
    setSelectedTask(null);
    setEditingTask(false);
    setReplyingTo(null);
    setPendingAttachment(null);
    setCommentError(null);
    setShowLinkInput(false);
    setLinkInputValue("");
    setConfirmDeleteCommentId(null);
  };

  const startEditTask = () => {
    if (!selectedTask) return;
    setEditTitle(selectedTask.title);
    setEditDescription(selectedTask.description ?? "");
    setEditAssigneeMode(selectedTask.assignee.type);
    setEditSelectedAssigneeUserId(selectedTask.assignee.type === "user" ? selectedTask.assignee.userId : null);
    setEditSelectedAssigneeTeamId(selectedTask.assignee.type === "team" ? selectedTask.assignee.teamId : null);
    setEditPriority(selectedTask.priority);
    setEditStartDate(selectedTask.startDate);
    setEditDueDate(selectedTask.dueDate);
    setEditError(null);
    setEditingTask(true);
  };

  const cancelEditTask = () => {
    setEditingTask(false);
    setEditError(null);
  };

  const saveEditTask = async () => {
    if (!selectedTask || !editTitle.trim()) return;
    const assignedUserId = editAssigneeMode === "user" ? editSelectedAssigneeUserId : null;
    const assignedTeamId = editAssigneeMode === "team" ? editSelectedAssigneeTeamId : null;
    if (!assignedUserId && !assignedTeamId) {
      setEditError("Elige a quién se le asigna la task.");
      return;
    }
    if (editStartDate && editDueDate && editDueDate < editStartDate) {
      setEditError("La fecha límite no puede ser antes que la de inicio.");
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    const { error } = await updateTask(selectedTask.id, {
      title: editTitle.trim(),
      description: editDescription.trim() || null,
      assignedUserId,
      assignedTeamId,
      priority: editPriority,
      startDate: editStartDate,
      dueDate: editDueDate,
    });
    setSavingEdit(false);
    if (error) {
      setEditError("No se pudo guardar la task.");
      return;
    }
    const { data: taskRows } = await listTasksForProjects(projects.map((p) => p.id));
    setTasks(taskRows);
    const updated = taskRows.find((t) => t.id === selectedTask.id) ?? null;
    setSelectedTask(updated);
    setEditingTask(false);
  };

  const handlePickDate = (isoDate: string) => {
    setPendingAttachment({ url: isoDate, type: "date", name: null });
    setShowDatePicker(false);
  };

  const confirmLinkInput = () => {
    const value = linkInputValue.trim();
    setShowLinkInput(false);
    if (!value) return;
    const url = /^https?:\/\//.test(value) ? value : `https://${value}`;
    setPendingAttachment({ url, type: "link", name: null });
    setLinkInputValue("");
  };

  const handleAttachmentReady = async (
    data: ArrayBuffer | File,
    contentType: string,
    ext: string,
    name: string,
    kind: "image" | "file"
  ) => {
    if (!user) return;
    setCommentError(null);
    setUploadingAttachment(true);
    const { url, error } = await uploadTaskAttachment(user.id, data, contentType, ext);
    setUploadingAttachment(false);
    if (error || !url) {
      setCommentError("No pudimos subir el adjunto, intenta de nuevo.");
      return;
    }
    setPendingAttachment({ url, type: kind, name });
  };

  const handlePostComment = async () => {
    if (!selectedTask || !user) return;
    if (!commentInput.trim() && !pendingAttachment) return;
    setPostingComment(true);
    const { error } = await addTaskComment({
      taskId: selectedTask.id,
      userId: user.id,
      content: commentInput.trim(),
      replyToId: replyingTo?.id ?? null,
      attachmentUrl: pendingAttachment?.url ?? null,
      attachmentType: pendingAttachment?.type ?? null,
      attachmentName: pendingAttachment?.name ?? null,
    });
    setPostingComment(false);
    if (error) {
      console.error("addTaskComment failed:", error);
      setCommentError(`No se pudo enviar el comentario: ${error.message ?? "error desconocido"}`);
      return;
    }
    setCommentError(null);
    setCommentInput("");
    setReplyingTo(null);
    setPendingAttachment(null);
    const { data } = await listTaskComments(selectedTask.id);
    setComments(data);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedTask) return;
    setConfirmDeleteCommentId(null);
    const { error } = await deleteTaskComment(commentId);
    if (error) {
      setCommentError("No se pudo borrar el comentario.");
      return;
    }
    const { data } = await listTaskComments(selectedTask.id);
    setComments(data);
  };

  // Deep link desde el Calendario: navigation.navigate("Tasks", { projectId, taskId })
  // preselecciona el proyecto y abre el detalle de esa task en cuanto termina de
  // cargar. Se limpian los params después de usarlos para que no se repita el
  // salto si el usuario vuelve a esta pestaña sin params nuevos.
  useEffect(() => {
    const routeProjectId = route?.params?.projectId as string | undefined;
    const routeTaskId = route?.params?.taskId as string | undefined;
    if (!routeProjectId || loadingData) return;
    if (projects.some((p) => p.id === routeProjectId)) setSelectedProjectId(routeProjectId);
    if (routeTaskId) {
      const task = tasks.find((t) => t.id === routeTaskId);
      if (task) openTaskDetail(task);
    }
    navigation.setParams?.({ projectId: undefined, taskId: undefined });
  }, [route?.params?.projectId, route?.params?.taskId, loadingData, projects, tasks]);

  if (authLoading) {
    return (
      <View style={[styles.container, { backgroundColor: bg, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: textSecondary }}>Cargando…</Text>
      </View>
    );
  }

  const selectedTaskProject = selectedTask ? projects.find((p) => p.id === selectedTask.projectId) ?? null : null;
  const selectedTaskInvolved = selectedTask ? isInvolvedInTask(selectedTask, selectedTaskProject) : false;
  const selectedTaskCanEdit = selectedTaskProject ? isProjectLeaderOrOwner(selectedTaskProject) : false;

  const renderTaskCard = (task: Task) => {
    if (confirmDeleteId === task.id) {
      return (
        <View key={task.id} style={[styles.taskCard, { backgroundColor: cardBg, borderColor: dangerColor, borderWidth: 1 }, ultraShadow]}>
          <Text style={{ color: textPrimary, fontSize: 13, fontWeight: "600" }}>¿Borrar "{task.title}"?</Text>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <TouchableOpacity activeOpacity={0.85} style={[styles.confirmBtn, { backgroundColor: dangerColor }]} onPress={() => handleDelete(task.id)}>
              <Check size={13} color="#FFF" />
              <Text style={styles.confirmBtnText}>Borrar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.confirmBtn, { backgroundColor: inputBg, borderWidth: 1, borderColor: border }]}
              onPress={() => setConfirmDeleteId(null)}
            >
              <X size={13} color={textPrimary} />
              <Text style={[styles.confirmBtnText, { color: textPrimary }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <TouchableOpacity key={task.id} activeOpacity={0.85} onPress={() => openTaskDetail(task)} style={[styles.taskCard, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
        <View style={styles.taskCardHeader}>
          <Text style={[styles.taskTitle, { color: textPrimary }]} numberOfLines={1}>
            {task.title}
          </Text>
          {isProjectLeaderOrOwner(selectedProject) && (
            <TouchableOpacity hitSlop={8} onPress={() => setConfirmDeleteId(task.id)}>
              <Trash2 size={14} color={textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {task.description && (
          <Text style={[styles.taskDescription, { color: textSecondary }]} numberOfLines={2}>
            {task.description}
          </Text>
        )}

        {(task.priority !== "medium" || task.dueDate) && (
          <View style={styles.taskMetaRow}>
            {task.priority !== "medium" && (
              <View style={[styles.metaChip, { backgroundColor: TASK_PRIORITY_COLORS[task.priority] + "20" }]}>
                <Flag size={11} color={TASK_PRIORITY_COLORS[task.priority]} />
                <Text style={{ color: TASK_PRIORITY_COLORS[task.priority], fontWeight: "700", fontSize: 11 }}>
                  {TASK_PRIORITY_LABELS[task.priority]}
                </Text>
              </View>
            )}
            {task.dueDate && (() => {
              const dueColor = isOverdue(task) ? dangerColor : isDueSoon(task) ? DUE_SOON_COLOR : textSecondary;
              return (
                <View style={[styles.metaChip, { backgroundColor: dueColor === textSecondary ? inputBg : dueColor + "20" }]}>
                  <Calendar size={11} color={dueColor} />
                  <Text style={{ color: dueColor, fontWeight: "700", fontSize: 11 }}>{formatShortDate(task.dueDate)}</Text>
                </View>
              );
            })()}
          </View>
        )}

        <View style={styles.taskFooter}>
          <View style={styles.assigneeRow}>
            {task.assignee.type === "user" ? (
              <>
                <View style={[styles.avatarMini, { backgroundColor: task.assignee.avatarColor }]}>
                  <Text style={styles.avatarMiniText}>{initials(task.assignee.name)}</Text>
                </View>
                <Text style={{ color: textSecondary, fontSize: 12 }} numberOfLines={1}>
                  {task.assignee.name}
                </Text>
              </>
            ) : (
              <>
                <View style={[styles.avatarMini, { backgroundColor: task.assignee.color }]}>
                  <Users size={13} color="#FFF" />
                </View>
                <Text style={{ color: textSecondary, fontSize: 12 }} numberOfLines={1}>
                  {task.assignee.name}
                </Text>
              </>
            )}
          </View>

          <TouchableOpacity
            activeOpacity={canChangeStatus(task) ? 0.7 : 1}
            disabled={!canChangeStatus(task)}
            onPress={() => handleCycleStatus(task)}
            style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[task.status] + "20" }]}
          >
            <Text style={{ color: STATUS_COLORS[task.status], fontWeight: "700", fontSize: 11.5 }}>{TASK_STATUS_LABELS[task.status]}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderColumnBody = (status: TaskStatus) => {
    const columnTasks = projectTasks.filter((t) => t.status === status);
    return (
      <>
        <View style={styles.columnHeader}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[status] }]} />
          <Text style={[styles.columnTitle, { color: textPrimary }]}>{TASK_STATUS_LABELS[status]}</Text>
          <Text style={[styles.columnCount, { color: textSecondary }]}>{columnTasks.length}</Text>
        </View>

        {columnTasks.length === 0 ? (
          <Text style={{ color: textSecondary, fontSize: 12.5 }}>Sin tareas en esta columna.</Text>
        ) : (
          <View style={{ gap: 10 }}>{columnTasks.map(renderTaskCard)}</View>
        )}
      </>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: isMobile ? 16 : 32 }}>
        <View style={{ width: "100%", maxWidth: 1280, alignSelf: "center" }}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.subtitle, { color: textSecondary }]}>{organization?.name ?? "Workspace"}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={[styles.title, { color: textPrimary }]}>Tareas</Text>
                {overdueCount > 0 && (
                  <View style={[styles.metaChip, { backgroundColor: "#EF444420" }]}>
                    <Calendar size={11} color={dangerColor} />
                    <Text style={{ color: dangerColor, fontWeight: "700", fontSize: 11.5 }}>
                      {overdueCount} vencida{overdueCount === 1 ? "" : "s"}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {isProjectLeaderOrOwner(selectedProject) && selectedProject && (
              <TouchableOpacity activeOpacity={0.85} style={[styles.newBtn, { backgroundColor: primaryColor }]} onPress={openCreateModal}>
                <Plus size={16} color="#FFF" />
                <Text style={styles.newBtnText}>Nueva task</Text>
              </TouchableOpacity>
            )}
          </View>

          {!organization ? (
            <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: border, marginTop: 24 }, ultraShadow]}>
              <Text style={[styles.emptyTitle, { color: textPrimary }]}>Tu cuenta no tiene un workspace todavía</Text>
            </View>
          ) : loadingData ? (
            <Text style={{ color: textSecondary, marginTop: 24 }}>Cargando…</Text>
          ) : projects.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: border, marginTop: 20 }, ultraShadow]}>
              <Folder size={32} color={textSecondary} />
              <Text style={[styles.emptyTitle, { color: textPrimary }]}>Todavía no hay proyectos</Text>
              <Text style={[styles.emptySubtitle, { color: textSecondary }]}>
                Las tareas viven dentro de un proyecto. Crea uno primero desde Proyectos o El Semillero.
              </Text>
              <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate("Projects")}>
                <Text style={[styles.emptyLink, { color: primaryColor }]}>Ir a Proyectos</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.projectScroll}>
                {projects.map((project) => {
                  const selected = project.id === selectedProjectId;
                  return (
                    <TouchableOpacity
                      key={project.id}
                      activeOpacity={0.85}
                      onPress={() => setSelectedProjectId(project.id)}
                      style={[
                        styles.projectChip,
                        { backgroundColor: selected ? project.color : cardBg, borderColor: selected ? project.color : border },
                      ]}
                    >
                      <Folder size={12} color={selected ? "#FFF" : project.color} />
                      <Text style={{ color: selected ? "#FFF" : textPrimary, fontWeight: "700", fontSize: 12.5 }} numberOfLines={1}>
                        {project.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.filterRow}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setFilterOnlyMine((v) => !v)}
                  style={[styles.filterChip, { backgroundColor: filterOnlyMine ? primaryColor : inputBg, borderColor: filterOnlyMine ? primaryColor : border }]}
                >
                  <User size={12} color={filterOnlyMine ? "#FFF" : textSecondary} />
                  <Text style={{ color: filterOnlyMine ? "#FFF" : textPrimary, fontWeight: "700", fontSize: 12 }}>Solo mías</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setFilterOverdueOnly((v) => !v)}
                  style={[styles.filterChip, { backgroundColor: filterOverdueOnly ? dangerColor : inputBg, borderColor: filterOverdueOnly ? dangerColor : border }]}
                >
                  <Calendar size={12} color={filterOverdueOnly ? "#FFF" : textSecondary} />
                  <Text style={{ color: filterOverdueOnly ? "#FFF" : textPrimary, fontWeight: "700", fontSize: 12 }}>Vencidas</Text>
                </TouchableOpacity>

                <View style={styles.filterDivider} />

                {TASK_PRIORITY_ORDER.map((priority) => {
                  const active = filterPriorities.has(priority);
                  const color = TASK_PRIORITY_COLORS[priority];
                  return (
                    <TouchableOpacity
                      key={priority}
                      activeOpacity={0.85}
                      onPress={() => togglePriorityFilter(priority)}
                      style={[styles.filterChip, { backgroundColor: active ? color : inputBg, borderColor: active ? color : border }]}
                    >
                      <Flag size={12} color={active ? "#FFF" : color} />
                      <Text style={{ color: active ? "#FFF" : textPrimary, fontWeight: "700", fontSize: 12 }}>{TASK_PRIORITY_LABELS[priority]}</Text>
                    </TouchableOpacity>
                  );
                })}

                {(filterOnlyMine || filterOverdueOnly || filterPriorities.size > 0) && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      setFilterOnlyMine(false);
                      setFilterOverdueOnly(false);
                      setFilterPriorities(new Set());
                    }}
                    style={styles.filterClear}
                  >
                    <X size={12} color={textSecondary} />
                    <Text style={{ color: textSecondary, fontWeight: "700", fontSize: 12 }}>Limpiar</Text>
                  </TouchableOpacity>
                )}
              </View>

              {errorText && <Text style={[styles.errorText, { color: dangerColor }]}>{errorText}</Text>}

              {selectedProject &&
                (isMobile ? (
                  <View style={{ marginTop: 20 }}>
                    {TASK_STATUS_ORDER.map((status) => (
                      <View key={status} style={{ marginBottom: 22 }}>
                        {renderColumnBody(status)}
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.kanbanRow}>
                    {TASK_STATUS_ORDER.map((status) => (
                      <View key={status} style={[styles.kanbanColumn, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
                        {renderColumnBody(status)}
                      </View>
                    ))}
                  </View>
                ))}
            </>
          )}

          <View style={{ height: 60 }} />
        </View>
      </ScrollView>

      {/* CREATE MODAL */}
      <Modal visible={showCreateModal} transparent animationType="fade" onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.overlayScroll} showsVerticalScrollIndicator={false}>
            <View style={[styles.modalCard, { backgroundColor: isDark ? "#0F172A" : "#FFFFFF", borderColor: border }, !isMobile && styles.modalCardWide]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: textPrimary }]}>Nueva task</Text>
                <TouchableOpacity onPress={() => setShowCreateModal(false)} hitSlop={8}>
                  <X size={20} color={textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={!isMobile && styles.formLayout}>
                <View style={!isMobile ? styles.formMain : undefined}>
                  <View style={[styles.taskFormCard, { backgroundColor: inputBg, borderColor: border }]}>
                    <Text style={[styles.modalLabel, { color: textSecondary, marginTop: 0 }]}>Título</Text>
                    <TextInput
                      value={newTitle}
                      onChangeText={setNewTitle}
                      placeholder="Ej. Maquetar la landing"
                      placeholderTextColor={textSecondary}
                      style={[styles.taskFormTitleInput, { color: textPrimary }, isWeb && styles.noOutline]}
                    />

                    <View style={[styles.divider, { backgroundColor: border, marginVertical: 12 }]} />

                    <Text style={[styles.modalLabel, { color: textSecondary, marginTop: 0 }]}>Descripción (opcional)</Text>
                    <TextInput
                      value={newDescription}
                      onChangeText={setNewDescription}
                      placeholder="¿Qué hay que hacer exactamente?"
                      placeholderTextColor={textSecondary}
                      multiline
                      style={[styles.taskFormDescInput, { color: textPrimary }, isWeb && styles.noOutline]}
                    />
                  </View>

                  <Text style={[styles.modalLabel, { color: textSecondary, marginTop: 20 }]}>Asignar a</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => setAssigneeMode("user")}
                      style={[styles.modeChip, { backgroundColor: assigneeMode === "user" ? primaryColor : inputBg, borderColor: assigneeMode === "user" ? primaryColor : border }]}
                    >
                      <User size={13} color={assigneeMode === "user" ? "#FFF" : textSecondary} />
                      <Text style={{ color: assigneeMode === "user" ? "#FFF" : textPrimary, fontWeight: "700", fontSize: 12.5 }}>Una persona</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => setAssigneeMode("team")}
                      style={[styles.modeChip, { backgroundColor: assigneeMode === "team" ? primaryColor : inputBg, borderColor: assigneeMode === "team" ? primaryColor : border }]}
                    >
                      <Users size={13} color={assigneeMode === "team" ? "#FFF" : textSecondary} />
                      <Text style={{ color: assigneeMode === "team" ? "#FFF" : textPrimary, fontWeight: "700", fontSize: 12.5 }}>Un equipo</Text>
                    </TouchableOpacity>
                  </View>

                  {assigneeMode === "user" ? (
                    assignableUsers.length === 0 ? (
                      <Text style={{ color: textSecondary, fontSize: 13, marginTop: 12 }}>
                        Este proyecto todavía no tiene gente asignada.
                      </Text>
                    ) : (
                      <View style={{ flexDirection: isMobile ? "column" : "row", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
                        {assignableUsers.map((person) => {
                          const selected = selectedAssigneeUserId === person.userId;
                          const isLeader = selectedProject?.leaderId === person.userId;
                          return (
                            <TouchableOpacity
                              key={person.userId}
                              activeOpacity={0.85}
                              onPress={() => setSelectedAssigneeUserId(person.userId)}
                              style={[styles.listItemRow, { backgroundColor: inputBg, borderColor: selected ? primaryColor : border }, !isMobile && styles.listItemRowHalf]}
                            >
                              <View style={[styles.avatarMini, { backgroundColor: person.avatarColor }]}>
                                <Text style={styles.avatarMiniText}>{initials(person.name)}</Text>
                              </View>
                              <Text style={{ color: textPrimary, fontSize: 13, fontWeight: "600", flex: 1 }} numberOfLines={1}>
                                {person.name}{isLeader ? " · Líder" : ""}
                              </Text>
                              {selected && <Check size={15} color={primaryColor} />}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )
                  ) : (selectedProject?.teams.length ?? 0) === 0 ? (
                    <Text style={{ color: textSecondary, fontSize: 13, marginTop: 12 }}>
                      Este proyecto todavía no tiene equipos asignados.
                    </Text>
                  ) : (
                    <View style={{ flexDirection: isMobile ? "column" : "row", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
                      {selectedProject?.teams.map((team) => {
                        const selected = selectedAssigneeTeamId === team.id;
                        return (
                          <TouchableOpacity
                            key={team.id}
                            activeOpacity={0.85}
                            onPress={() => setSelectedAssigneeTeamId(team.id)}
                            style={[styles.listItemRow, { backgroundColor: inputBg, borderColor: selected ? primaryColor : border }, !isMobile && styles.listItemRowHalf]}
                          >
                            <View style={[styles.avatarMini, { backgroundColor: team.color }]}>
                              <Users size={13} color="#FFF" />
                            </View>
                            <Text style={{ color: textPrimary, fontSize: 13, fontWeight: "600", flex: 1 }} numberOfLines={1}>
                              {team.name}
                            </Text>
                            {selected && <Check size={15} color={primaryColor} />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>

                <View style={!isMobile ? styles.formSide : undefined}>
                  <Text style={[styles.modalLabel, { color: textSecondary, marginTop: isMobile ? 20 : 0 }]}>Prioridad</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {TASK_PRIORITY_ORDER.map((priority) => {
                      const selected = newPriority === priority;
                      const color = TASK_PRIORITY_COLORS[priority];
                      return (
                        <TouchableOpacity
                          key={priority}
                          activeOpacity={0.85}
                          onPress={() => setNewPriority(priority)}
                          style={[styles.statusPill, { backgroundColor: selected ? color : inputBg, borderColor: selected ? color : border, flexDirection: "row", alignItems: "center", gap: 6 }]}
                        >
                          <Flag size={12} color={selected ? "#FFF" : color} />
                          <Text style={{ color: selected ? "#FFF" : textPrimary, fontWeight: "700", fontSize: 12 }}>{TASK_PRIORITY_LABELS[priority]}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={[styles.modalLabel, { color: textSecondary, marginTop: 20 }]}>Fechas (opcional)</Text>
                  <View style={{ gap: 10 }}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => setShowNewStartDatePicker(true)}
                      style={[styles.listItemRow, { backgroundColor: inputBg, borderColor: border }]}
                    >
                      <Calendar size={15} color={primaryColor} />
                      <Text style={{ color: newStartDate ? textPrimary : textSecondary, fontSize: 13, fontWeight: "600", flex: 1 }}>
                        {newStartDate ? `Inicio: ${formatShortDate(newStartDate)}` : "Elegir fecha de inicio"}
                      </Text>
                      {newStartDate && (
                        <TouchableOpacity hitSlop={8} onPress={() => setNewStartDate(null)}>
                          <X size={14} color={textSecondary} />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => setShowNewDueDatePicker(true)}
                      style={[styles.listItemRow, { backgroundColor: inputBg, borderColor: border }]}
                    >
                      <Calendar size={15} color={primaryColor} />
                      <Text style={{ color: newDueDate ? textPrimary : textSecondary, fontSize: 13, fontWeight: "600", flex: 1 }}>
                        {newDueDate ? `Límite: ${formatShortDate(newDueDate)}` : "Elegir fecha límite"}
                      </Text>
                      {newDueDate && (
                        <TouchableOpacity hitSlop={8} onPress={() => setNewDueDate(null)}>
                          <X size={14} color={textSecondary} />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  </View>
                  {newStartDate && newDueDate && newDueDate < newStartDate && (
                    <Text style={[styles.errorText, { color: dangerColor, marginTop: 8 }]}>La fecha límite no puede ser antes que la de inicio.</Text>
                  )}

                  <Text style={[styles.modalLabel, { color: textSecondary, marginTop: 20 }]}>Adjuntos (opcional)</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                    <ChatAttachmentButtons color={primaryColor} disabled={uploadingCreateAttachment} onAttachmentReady={handleCreateAttachmentReady} onError={setCreateAttachError} />
                    <TouchableOpacity hitSlop={8} onPress={() => setShowCreateDatePicker(true)} style={styles.composerIconBtn}>
                      <Calendar size={18} color={primaryColor} />
                    </TouchableOpacity>
                    <TouchableOpacity hitSlop={8} onPress={() => setShowCreateLinkInput(true)} style={styles.composerIconBtn}>
                      <Link2 size={18} color={primaryColor} />
                    </TouchableOpacity>
                    {uploadingCreateAttachment && <Text style={{ color: textSecondary, fontSize: 12 }}>Subiendo…</Text>}
                  </View>

                  {showCreateLinkInput && (
                    <View style={[styles.inlineBar, { backgroundColor: inputBg, borderColor: border, marginTop: 10 }]}>
                      <Link2 size={16} color={primaryColor} />
                      <TextInput
                        value={createLinkInputValue}
                        onChangeText={setCreateLinkInputValue}
                        onSubmitEditing={confirmCreateLinkInput}
                        onBlur={confirmCreateLinkInput}
                        autoFocus
                        placeholder="Pega un enlace…"
                        placeholderTextColor={textSecondary}
                        style={[{ flex: 1, fontSize: 13, color: textPrimary }, isWeb && styles.noOutline]}
                      />
                      <TouchableOpacity
                        hitSlop={8}
                        onPress={() => {
                          setShowCreateLinkInput(false);
                          setCreateLinkInputValue("");
                        }}
                      >
                        <X size={14} color={textSecondary} />
                      </TouchableOpacity>
                    </View>
                  )}

                  {createAttachError && <Text style={[styles.errorText, { color: dangerColor }]}>{createAttachError}</Text>}

                  {newAttachments.length > 0 && (
                    <View style={{ gap: 10, marginTop: 12 }}>
                      {newAttachments.map((att, idx) => (
                        <View key={idx} style={[styles.listItemRow, { backgroundColor: inputBg, borderColor: border }]}>
                          {att.type === "image" ? (
                            <Image source={{ uri: att.url }} style={styles.attachmentPreviewThumb} />
                          ) : att.type === "link" ? (
                            <Link2 size={16} color={primaryColor} />
                          ) : att.type === "date" ? (
                            <Calendar size={16} color={primaryColor} />
                          ) : (
                            <FileText size={16} color={primaryColor} />
                          )}
                          <Text
                            style={{ color: textPrimary, fontSize: 12.5, fontWeight: "600", flex: 1, textTransform: att.type === "date" ? "capitalize" : "none" }}
                            numberOfLines={1}
                          >
                            {attachmentLabel(att)}
                          </Text>
                          <TouchableOpacity hitSlop={8} onPress={() => removeNewAttachment(idx)}>
                            <X size={14} color={textSecondary} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              {createError && <Text style={[styles.errorText, { color: dangerColor, marginTop: 16 }]}>{createError}</Text>}

              <TouchableOpacity
                activeOpacity={0.85}
                disabled={!newTitle.trim() || creating}
                style={[styles.createBtn, { backgroundColor: primaryColor, opacity: !newTitle.trim() || creating ? 0.5 : 1, marginTop: 20 }]}
                onPress={handleCreate}
              >
                <CircleCheckBig size={16} color="#FFF" />
                <Text style={styles.createBtnText}>{creating ? "Creando…" : "Crear task"}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* DETAIL MODAL */}
      <Modal visible={!!selectedTask} transparent animationType="fade" onRequestClose={closeTaskDetail}>
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.overlayScroll} showsVerticalScrollIndicator={false}>
            {selectedTask && (
              <View style={[styles.modalCard, { backgroundColor: isDark ? "#0F172A" : "#FFFFFF", borderColor: border }, !isMobile && styles.modalCardWide]}>
                <View style={[styles.modalHeader, { justifyContent: "flex-end", marginBottom: 12, gap: 16 }]}>
                  {selectedTaskCanEdit && !editingTask && (
                    <TouchableOpacity onPress={startEditTask} hitSlop={8}>
                      <Pencil size={18} color={textSecondary} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={closeTaskDetail} hitSlop={8}>
                    <X size={20} color={textSecondary} />
                  </TouchableOpacity>
                </View>

                {editingTask ? (
                  <View style={{ marginBottom: 16 }}>
                    <View style={!isMobile && styles.formLayout}>
                      <View style={!isMobile ? styles.formMain : undefined}>
                        <View style={[styles.taskFormCard, { backgroundColor: inputBg, borderColor: border }]}>
                          <Text style={[styles.modalLabel, { color: textSecondary, marginTop: 0 }]}>Título</Text>
                          <TextInput
                            value={editTitle}
                            onChangeText={setEditTitle}
                            placeholderTextColor={textSecondary}
                            style={[styles.taskFormTitleInput, { color: textPrimary }, isWeb && styles.noOutline]}
                          />

                          <View style={[styles.divider, { backgroundColor: border, marginVertical: 12 }]} />

                          <Text style={[styles.modalLabel, { color: textSecondary, marginTop: 0 }]}>Descripción (opcional)</Text>
                          <TextInput
                            value={editDescription}
                            onChangeText={setEditDescription}
                            placeholder="¿Qué hay que hacer exactamente?"
                            placeholderTextColor={textSecondary}
                            multiline
                            style={[styles.taskFormDescInput, { color: textPrimary }, isWeb && styles.noOutline]}
                          />
                        </View>

                        <Text style={[styles.modalLabel, { color: textSecondary, marginTop: 20 }]}>Asignar a</Text>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => setEditAssigneeMode("user")}
                            style={[styles.modeChip, { backgroundColor: editAssigneeMode === "user" ? primaryColor : cardBg, borderColor: editAssigneeMode === "user" ? primaryColor : border }]}
                          >
                            <User size={13} color={editAssigneeMode === "user" ? "#FFF" : textSecondary} />
                            <Text style={{ color: editAssigneeMode === "user" ? "#FFF" : textPrimary, fontWeight: "700", fontSize: 12.5 }}>Una persona</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => setEditAssigneeMode("team")}
                            style={[styles.modeChip, { backgroundColor: editAssigneeMode === "team" ? primaryColor : cardBg, borderColor: editAssigneeMode === "team" ? primaryColor : border }]}
                          >
                            <Users size={13} color={editAssigneeMode === "team" ? "#FFF" : textSecondary} />
                            <Text style={{ color: editAssigneeMode === "team" ? "#FFF" : textPrimary, fontWeight: "700", fontSize: 12.5 }}>Un equipo</Text>
                          </TouchableOpacity>
                        </View>

                        {editAssigneeMode === "user" ? (
                          <View style={{ flexDirection: isMobile ? "column" : "row", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
                            {assignableUsers.map((person) => {
                              const selected = editSelectedAssigneeUserId === person.userId;
                              const isLeader = selectedTaskProject?.leaderId === person.userId;
                              return (
                                <TouchableOpacity
                                  key={person.userId}
                                  activeOpacity={0.85}
                                  onPress={() => setEditSelectedAssigneeUserId(person.userId)}
                                  style={[styles.listItemRow, { backgroundColor: cardBg, borderColor: selected ? primaryColor : border }, !isMobile && styles.listItemRowHalf]}
                                >
                                  <View style={[styles.avatarMini, { backgroundColor: person.avatarColor }]}>
                                    <Text style={styles.avatarMiniText}>{initials(person.name)}</Text>
                                  </View>
                                  <Text style={{ color: textPrimary, fontSize: 13, fontWeight: "600", flex: 1 }} numberOfLines={1}>
                                    {person.name}{isLeader ? " · Líder" : ""}
                                  </Text>
                                  {selected && <Check size={15} color={primaryColor} />}
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        ) : (
                          <View style={{ flexDirection: isMobile ? "column" : "row", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
                            {selectedTaskProject?.teams.map((team) => {
                              const selected = editSelectedAssigneeTeamId === team.id;
                              return (
                                <TouchableOpacity
                                  key={team.id}
                                  activeOpacity={0.85}
                                  onPress={() => setEditSelectedAssigneeTeamId(team.id)}
                                  style={[styles.listItemRow, { backgroundColor: cardBg, borderColor: selected ? primaryColor : border }, !isMobile && styles.listItemRowHalf]}
                                >
                                  <View style={[styles.avatarMini, { backgroundColor: team.color }]}>
                                    <Users size={13} color="#FFF" />
                                  </View>
                                  <Text style={{ color: textPrimary, fontSize: 13, fontWeight: "600", flex: 1 }} numberOfLines={1}>
                                    {team.name}
                                  </Text>
                                  {selected && <Check size={15} color={primaryColor} />}
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}
                      </View>

                      <View style={!isMobile ? styles.formSide : undefined}>
                        <Text style={[styles.modalLabel, { color: textSecondary, marginTop: isMobile ? 20 : 0 }]}>Prioridad</Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                          {TASK_PRIORITY_ORDER.map((priority) => {
                            const selected = editPriority === priority;
                            const color = TASK_PRIORITY_COLORS[priority];
                            return (
                              <TouchableOpacity
                                key={priority}
                                activeOpacity={0.85}
                                onPress={() => setEditPriority(priority)}
                                style={[styles.statusPill, { backgroundColor: selected ? color : cardBg, borderColor: selected ? color : border, flexDirection: "row", alignItems: "center", gap: 6 }]}
                              >
                                <Flag size={12} color={selected ? "#FFF" : color} />
                                <Text style={{ color: selected ? "#FFF" : textPrimary, fontWeight: "700", fontSize: 12 }}>{TASK_PRIORITY_LABELS[priority]}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        <Text style={[styles.modalLabel, { color: textSecondary, marginTop: 20 }]}>Fechas (opcional)</Text>
                        <View style={{ gap: 10 }}>
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => setShowEditStartDatePicker(true)}
                            style={[styles.listItemRow, { backgroundColor: cardBg, borderColor: border }]}
                          >
                            <Calendar size={15} color={primaryColor} />
                            <Text style={{ color: editStartDate ? textPrimary : textSecondary, fontSize: 13, fontWeight: "600", flex: 1 }}>
                              {editStartDate ? `Inicio: ${formatShortDate(editStartDate)}` : "Elegir fecha de inicio"}
                            </Text>
                            {editStartDate && (
                              <TouchableOpacity hitSlop={8} onPress={() => setEditStartDate(null)}>
                                <X size={14} color={textSecondary} />
                              </TouchableOpacity>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => setShowEditDueDatePicker(true)}
                            style={[styles.listItemRow, { backgroundColor: cardBg, borderColor: border }]}
                          >
                            <Calendar size={15} color={primaryColor} />
                            <Text style={{ color: editDueDate ? textPrimary : textSecondary, fontSize: 13, fontWeight: "600", flex: 1 }}>
                              {editDueDate ? `Límite: ${formatShortDate(editDueDate)}` : "Elegir fecha límite"}
                            </Text>
                            {editDueDate && (
                              <TouchableOpacity hitSlop={8} onPress={() => setEditDueDate(null)}>
                                <X size={14} color={textSecondary} />
                              </TouchableOpacity>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>

                    {editError && <Text style={[styles.errorText, { color: dangerColor, marginTop: 16 }]}>{editError}</Text>}

                    <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        disabled={savingEdit}
                        style={[styles.confirmBtn, { backgroundColor: primaryColor, flex: 1, justifyContent: "center", opacity: savingEdit ? 0.6 : 1 }]}
                        onPress={saveEditTask}
                      >
                        <Check size={14} color="#FFF" />
                        <Text style={styles.confirmBtnText}>{savingEdit ? "Guardando…" : "Guardar cambios"}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        style={[styles.confirmBtn, { backgroundColor: cardBg, borderWidth: 1, borderColor: border, flex: 1, justifyContent: "center" }]}
                        onPress={cancelEditTask}
                      >
                        <X size={14} color={textPrimary} />
                        <Text style={[styles.confirmBtnText, { color: textPrimary }]}>Cancelar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={[!isMobile && styles.formLayout, { marginBottom: 20 }]}>
                    <View style={!isMobile ? styles.formMain : undefined}>
                      <View style={[styles.taskInfoCard, { backgroundColor: inputBg, borderColor: border, marginBottom: isMobile ? 16 : 0 }]}>
                        <Text style={[styles.taskInfoTitle, { color: textPrimary }]}>{selectedTask.title}</Text>
                        <Text style={[styles.taskInfoDescription, { color: textSecondary }]}>
                          {selectedTask.description || "Sin descripción."}
                        </Text>
                      </View>
                    </View>

                    <View style={!isMobile ? styles.formSide : undefined}>
                      <View style={[styles.listItemRow, { backgroundColor: inputBg, borderColor: border, marginTop: isMobile ? 0 : 0 }]}>
                        {selectedTask.assignee.type === "user" ? (
                          <>
                            <View style={[styles.avatarMini, { backgroundColor: selectedTask.assignee.avatarColor }]}>
                              <Text style={styles.avatarMiniText}>{initials(selectedTask.assignee.name)}</Text>
                            </View>
                            <Text style={{ color: textPrimary, fontSize: 13, fontWeight: "600", flex: 1 }} numberOfLines={1}>
                              Asignada a {selectedTask.assignee.name}
                            </Text>
                            {selectedTaskProject?.leaderId === selectedTask.assignee.userId && <Crown size={13} color={primaryColor} />}
                          </>
                        ) : (
                          <>
                            <View style={[styles.avatarMini, { backgroundColor: selectedTask.assignee.color }]}>
                              <Users size={13} color="#FFF" />
                            </View>
                            <Text style={{ color: textPrimary, fontSize: 13, fontWeight: "600", flex: 1 }} numberOfLines={1}>
                              Asignada al equipo {selectedTask.assignee.name}
                            </Text>
                          </>
                        )}
                      </View>

                      <View style={[styles.taskMetaRow, { marginTop: 12 }]}>
                        <View style={[styles.metaChip, { backgroundColor: TASK_PRIORITY_COLORS[selectedTask.priority] + "20" }]}>
                          <Flag size={11} color={TASK_PRIORITY_COLORS[selectedTask.priority]} />
                          <Text style={{ color: TASK_PRIORITY_COLORS[selectedTask.priority], fontWeight: "700", fontSize: 11 }}>
                            Prioridad {TASK_PRIORITY_LABELS[selectedTask.priority].toLowerCase()}
                          </Text>
                        </View>
                        {selectedTask.startDate && (
                          <View style={[styles.metaChip, { backgroundColor: cardBg }]}>
                            <Calendar size={11} color={textSecondary} />
                            <Text style={{ color: textSecondary, fontWeight: "700", fontSize: 11 }}>Inicio {formatShortDate(selectedTask.startDate)}</Text>
                          </View>
                        )}
                        {selectedTask.dueDate && (() => {
                          const dueColor = isOverdue(selectedTask) ? dangerColor : isDueSoon(selectedTask) ? DUE_SOON_COLOR : textSecondary;
                          return (
                            <View style={[styles.metaChip, { backgroundColor: dueColor === textSecondary ? cardBg : dueColor + "20" }]}>
                              <Calendar size={11} color={dueColor} />
                              <Text style={{ color: dueColor, fontWeight: "700", fontSize: 11 }}>Límite {formatShortDate(selectedTask.dueDate)}</Text>
                            </View>
                          );
                        })()}
                      </View>

                      <Text style={[styles.modalLabel, { color: textSecondary }]}>Status</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {TASK_STATUS_ORDER.map((status) => {
                          const selected = selectedTask.status === status;
                          return (
                            <TouchableOpacity
                              key={status}
                              activeOpacity={canChangeStatus(selectedTask) ? 0.85 : 1}
                              disabled={!canChangeStatus(selectedTask)}
                              onPress={() => handleSetStatus(selectedTask, status)}
                              style={[
                                styles.statusPill,
                                {
                                  backgroundColor: selected ? STATUS_COLORS[status] : inputBg,
                                  borderColor: selected ? STATUS_COLORS[status] : border,
                                },
                              ]}
                            >
                              <Text style={{ color: selected ? "#FFF" : textPrimary, fontWeight: "700", fontSize: 12 }}>
                                {TASK_STATUS_LABELS[status]}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      {!canChangeStatus(selectedTask) && (
                        <Text style={{ color: textSecondary, fontSize: 11.5, marginTop: 8 }}>
                          Solo el líder del proyecto, el owner, o quien tiene asignada esta task pueden cambiar el status.
                        </Text>
                      )}

                      {selectedTaskCanEdit && (
                        <TouchableOpacity activeOpacity={0.7} onPress={() => setConfirmDeleteId(selectedTask.id)} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16 }}>
                          <Trash2 size={13} color={dangerColor} />
                          <Text style={{ color: dangerColor, fontSize: 12.5, fontWeight: "700" }}>Borrar task</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}

                <View style={[styles.divider, { backgroundColor: border }]} />

                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16, marginBottom: 12 }}>
                  <MessageSquare size={14} color={textSecondary} />
                  <Text style={[styles.modalLabel, { color: textSecondary, marginTop: 0, marginBottom: 0 }]}>Comentarios</Text>
                </View>

                {!selectedTaskInvolved ? (
                  <Text style={{ color: textSecondary, fontSize: 12.5 }}>
                    Solo el líder del proyecto, el owner, o quien tiene asignada esta task pueden ver y escribir comentarios.
                  </Text>
                ) : (
                  <>
                    <View style={[styles.chatContainer, { backgroundColor: inputBg, borderColor: border }]}>
                      <ScrollView
                        style={{ maxHeight: isMobile ? 260 : 340 }}
                        contentContainerStyle={styles.chatScrollContent}
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled
                      >
                        {loadingComments ? (
                          <Text style={{ color: textSecondary, fontSize: 12.5 }}>Cargando comentarios…</Text>
                        ) : comments.length === 0 ? (
                          <Text style={{ color: textSecondary, fontSize: 12.5 }}>Todavía no hay comentarios.</Text>
                        ) : (
                          comments.map((c) => (
                            <View key={c.id} style={{ flexDirection: "row", gap: 10 }}>
                              <View style={[styles.avatarMini, { backgroundColor: c.authorAvatarColor }]}>
                                <Text style={styles.avatarMiniText}>{initials(c.authorName)}</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: "row", gap: 8, alignItems: "baseline" }}>
                                  <Text style={{ color: textPrimary, fontSize: 12.5, fontWeight: "700" }}>{c.authorName}</Text>
                                  <Text style={{ color: textSecondary, fontSize: 11 }}>{formatTime(c.createdAt)}</Text>
                                </View>

                                {c.replyTo && (
                                  <View style={[styles.replyQuote, { borderLeftColor: primaryColor, backgroundColor: cardBg }]}>
                                    <Text style={{ color: primaryColor, fontSize: 11, fontWeight: "700" }}>{c.replyTo.authorName}</Text>
                                    <Text style={{ color: textSecondary, fontSize: 11.5 }} numberOfLines={1}>
                                      {c.replyTo.content || "Archivo adjunto"}
                                    </Text>
                                  </View>
                                )}

                                {!!c.content && (
                                  <Text style={{ color: textSecondary, fontSize: 13, lineHeight: 18, marginTop: 4 }}>
                                    {renderLinkifiedText(c.content, primaryColor)}
                                  </Text>
                                )}

                                {c.attachment &&
                                  (c.attachment.type === "image" ? (
                                    <TouchableOpacity activeOpacity={0.85} onPress={() => Linking.openURL(c.attachment!.url)} style={{ marginTop: 8 }}>
                                      <Image source={{ uri: c.attachment.url }} style={styles.attachmentImage} />
                                    </TouchableOpacity>
                                  ) : c.attachment.type === "link" ? (
                                    <TouchableOpacity
                                      activeOpacity={0.85}
                                      onPress={() => Linking.openURL(c.attachment!.url)}
                                      style={[styles.attachmentFileChip, { backgroundColor: cardBg, borderColor: border }]}
                                    >
                                      <Link2 size={14} color={primaryColor} />
                                      <Text style={{ color: primaryColor, fontSize: 12, fontWeight: "600", flexShrink: 1, textDecorationLine: "underline" }} numberOfLines={1}>
                                        {c.attachment.url}
                                      </Text>
                                    </TouchableOpacity>
                                  ) : c.attachment.type === "date" ? (
                                    <View style={[styles.attachmentFileChip, { backgroundColor: cardBg, borderColor: border }]}>
                                      <Calendar size={14} color={primaryColor} />
                                      <Text style={{ color: textPrimary, fontSize: 12, fontWeight: "600", flexShrink: 1, textTransform: "capitalize" }} numberOfLines={1}>
                                        {formatAttachmentDate(c.attachment.url)}
                                      </Text>
                                    </View>
                                  ) : (
                                    <TouchableOpacity
                                      activeOpacity={0.85}
                                      onPress={() => Linking.openURL(c.attachment!.url)}
                                      style={[styles.attachmentFileChip, { backgroundColor: cardBg, borderColor: border }]}
                                    >
                                      <FileText size={14} color={primaryColor} />
                                      <Text style={{ color: textPrimary, fontSize: 12, fontWeight: "600", flexShrink: 1 }} numberOfLines={1}>
                                        {c.attachment.name ?? "Archivo adjunto"}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}

                                {confirmDeleteCommentId === c.id ? (
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 }}>
                                    <Text style={{ color: textSecondary, fontSize: 11 }}>¿Borrar comentario?</Text>
                                    <TouchableOpacity activeOpacity={0.7} onPress={() => handleDeleteComment(c.id)}>
                                      <Text style={{ color: dangerColor, fontSize: 11, fontWeight: "700" }}>Sí, borrar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity activeOpacity={0.7} onPress={() => setConfirmDeleteCommentId(null)}>
                                      <Text style={{ color: textSecondary, fontSize: 11, fontWeight: "700" }}>Cancelar</Text>
                                    </TouchableOpacity>
                                  </View>
                                ) : (
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                                    <TouchableOpacity activeOpacity={0.7} onPress={() => setReplyingTo(c)} style={styles.replyLink}>
                                      <Reply size={11} color={textSecondary} />
                                      <Text style={{ color: textSecondary, fontSize: 11, fontWeight: "700" }}>Responder</Text>
                                    </TouchableOpacity>
                                    {c.userId === user?.id && (
                                      <TouchableOpacity activeOpacity={0.7} onPress={() => setConfirmDeleteCommentId(c.id)} style={styles.replyLink}>
                                        <Trash2 size={11} color={textSecondary} />
                                        <Text style={{ color: textSecondary, fontSize: 11, fontWeight: "700" }}>Borrar</Text>
                                      </TouchableOpacity>
                                    )}
                                  </View>
                                )}
                              </View>
                            </View>
                          ))
                        )}
                      </ScrollView>
                    </View>

                    {replyingTo && (
                      <View style={[styles.inlineBar, { backgroundColor: inputBg, borderColor: border }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: primaryColor, fontSize: 11, fontWeight: "700" }}>Respondiendo a {replyingTo.authorName}</Text>
                          <Text style={{ color: textSecondary, fontSize: 11.5 }} numberOfLines={1}>
                            {replyingTo.content || "Archivo adjunto"}
                          </Text>
                        </View>
                        <TouchableOpacity hitSlop={8} onPress={() => setReplyingTo(null)}>
                          <X size={14} color={textSecondary} />
                        </TouchableOpacity>
                      </View>
                    )}

                    {pendingAttachment && (
                      <View style={[styles.inlineBar, { backgroundColor: inputBg, borderColor: border }]}>
                        {pendingAttachment.type === "image" ? (
                          <Image source={{ uri: pendingAttachment.url }} style={styles.attachmentPreviewThumb} />
                        ) : pendingAttachment.type === "link" ? (
                          <Link2 size={16} color={primaryColor} />
                        ) : pendingAttachment.type === "date" ? (
                          <Calendar size={16} color={primaryColor} />
                        ) : (
                          <FileText size={16} color={primaryColor} />
                        )}
                        <Text style={{ color: textPrimary, fontSize: 12, fontWeight: "600", flex: 1, textTransform: pendingAttachment.type === "date" ? "capitalize" : "none" }} numberOfLines={1}>
                          {attachmentLabel(pendingAttachment)}
                        </Text>
                        <TouchableOpacity hitSlop={8} onPress={() => setPendingAttachment(null)}>
                          <X size={14} color={textSecondary} />
                        </TouchableOpacity>
                      </View>
                    )}

                    {showLinkInput && (
                      <View style={[styles.inlineBar, { backgroundColor: inputBg, borderColor: border }]}>
                        <Link2 size={16} color={primaryColor} />
                        <TextInput
                          value={linkInputValue}
                          onChangeText={setLinkInputValue}
                          onSubmitEditing={confirmLinkInput}
                          onBlur={confirmLinkInput}
                          autoFocus
                          placeholder="Pega un enlace…"
                          placeholderTextColor={textSecondary}
                          style={[{ flex: 1, fontSize: 13, color: textPrimary }, isWeb && styles.noOutline]}
                        />
                        <TouchableOpacity
                          hitSlop={8}
                          onPress={() => {
                            setShowLinkInput(false);
                            setLinkInputValue("");
                          }}
                        >
                          <X size={14} color={textSecondary} />
                        </TouchableOpacity>
                      </View>
                    )}

                    <View style={[styles.chipInputRow, { backgroundColor: inputBg, borderColor: border }]}>
                      <ChatAttachmentButtons color={primaryColor} disabled={uploadingAttachment} onAttachmentReady={handleAttachmentReady} onError={setCommentError} />
                      <TouchableOpacity hitSlop={8} onPress={() => setShowDatePicker(true)} style={styles.composerIconBtn}>
                        <Calendar size={18} color={primaryColor} />
                      </TouchableOpacity>
                      <TouchableOpacity hitSlop={8} onPress={() => setShowLinkInput(true)} style={styles.composerIconBtn}>
                        <Link2 size={18} color={primaryColor} />
                      </TouchableOpacity>
                      <TextInput
                        value={commentInput}
                        onChangeText={setCommentInput}
                        onSubmitEditing={handlePostComment}
                        placeholder={uploadingAttachment ? "Subiendo adjunto…" : "Escribe un comentario…"}
                        placeholderTextColor={textSecondary}
                        style={[styles.chipInput, { color: textPrimary }, isWeb && styles.noOutline]}
                      />
                      <TouchableOpacity
                        onPress={handlePostComment}
                        hitSlop={8}
                        disabled={postingComment || uploadingAttachment || (!commentInput.trim() && !pendingAttachment)}
                      >
                        <Send size={16} color={commentInput.trim() || pendingAttachment ? primaryColor : textSecondary} />
                      </TouchableOpacity>
                    </View>
                    {commentError && <Text style={[styles.errorText, { color: dangerColor }]}>{commentError}</Text>}
                  </>
                )}

                {confirmDeleteId === selectedTask.id && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={{ color: textPrimary, fontSize: 13, fontWeight: "600" }}>¿Borrar esta task? No se puede deshacer.</Text>
                    <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                      <TouchableOpacity activeOpacity={0.85} style={[styles.confirmBtn, { backgroundColor: dangerColor }]} onPress={() => handleDelete(selectedTask.id)}>
                        <Check size={13} color="#FFF" />
                        <Text style={styles.confirmBtnText}>Borrar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        style={[styles.confirmBtn, { backgroundColor: inputBg, borderWidth: 1, borderColor: border }]}
                        onPress={() => setConfirmDeleteId(null)}
                      >
                        <X size={13} color={textPrimary} />
                        <Text style={[styles.confirmBtnText, { color: textPrimary }]}>Cancelar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      <DatePickerModal
        visible={showDatePicker}
        initialDate={pendingAttachment?.type === "date" ? pendingAttachment.url : null}
        isDark={isDark}
        onClose={() => setShowDatePicker(false)}
        onConfirm={handlePickDate}
      />

      <DatePickerModal
        visible={showCreateDatePicker}
        initialDate={null}
        isDark={isDark}
        onClose={() => setShowCreateDatePicker(false)}
        onConfirm={handleCreatePickDate}
      />

      <DatePickerModal
        visible={showNewStartDatePicker}
        initialDate={newStartDate}
        isDark={isDark}
        onClose={() => setShowNewStartDatePicker(false)}
        onConfirm={(isoDate) => {
          setNewStartDate(isoDate);
          setShowNewStartDatePicker(false);
        }}
      />

      <DatePickerModal
        visible={showNewDueDatePicker}
        initialDate={newDueDate}
        isDark={isDark}
        onClose={() => setShowNewDueDatePicker(false)}
        onConfirm={(isoDate) => {
          setNewDueDate(isoDate);
          setShowNewDueDatePicker(false);
        }}
      />

      <DatePickerModal
        visible={showEditStartDatePicker}
        initialDate={editStartDate}
        isDark={isDark}
        onClose={() => setShowEditStartDatePicker(false)}
        onConfirm={(isoDate) => {
          setEditStartDate(isoDate);
          setShowEditStartDatePicker(false);
        }}
      />

      <DatePickerModal
        visible={showEditDueDatePicker}
        initialDate={editDueDate}
        isDark={isDark}
        onClose={() => setShowEditDueDatePicker(false)}
        onConfirm={(isoDate) => {
          setEditDueDate(isoDate);
          setShowEditDueDatePicker(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  subtitle: { fontSize: 13, fontWeight: "700" },
  title: { fontSize: 30, fontWeight: "900", letterSpacing: -0.5, marginTop: 2 },

  newBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12 },
  newBtnText: { color: "#FFF", fontWeight: "700", fontSize: 13 },

  projectScroll: { marginTop: 20 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 14 },
  filterChip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  filterDivider: { width: 1, height: 16, backgroundColor: "rgba(148, 163, 184, 0.4)" },
  filterClear: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 7 },
  projectChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, marginRight: 10, maxWidth: 200 },

  errorText: { marginTop: 16, fontSize: 13, fontWeight: "600" },

  kanbanRow: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 20, alignItems: "flex-start" },
  kanbanColumn: { flexGrow: 1, flexBasis: 280, minWidth: 260, maxWidth: 340, borderRadius: 22, borderWidth: 1, padding: 18 },

  columnHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  columnTitle: { fontSize: 15, fontWeight: "800" },
  columnCount: { fontSize: 12, fontWeight: "700" },

  taskCard: { borderRadius: 18, borderWidth: 1, padding: 16 },
  taskCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  taskTitle: { fontSize: 14.5, fontWeight: "800", flex: 1 },
  taskDescription: { fontSize: 12.5, lineHeight: 18, marginTop: 6 },
  taskFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  assigneeRow: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  taskMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },

  avatarMini: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  avatarMiniText: { color: "#FFF", fontSize: 10.5, fontWeight: "800" },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },

  confirmBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  confirmBtnText: { color: "#FFF", fontWeight: "700", fontSize: 13 },

  emptyCard: { borderRadius: 20, borderWidth: 1, padding: 32, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  emptySubtitle: { fontSize: 13, textAlign: "center", lineHeight: 20 },
  emptyLink: { fontSize: 13, fontWeight: "700", textAlign: "center", marginTop: 6 },

  overlay: { flex: 1, backgroundColor: "rgba(2, 6, 23, 0.6)", alignItems: "center", justifyContent: "center", padding: 20 },
  overlayScroll: { flexGrow: 1, alignItems: "center", justifyContent: "center", width: "100%" },
  modalCard: { width: "100%", maxWidth: 460, borderRadius: 24, borderWidth: 1, padding: 24 },
  modalCardWide: { maxWidth: 1080, padding: 40 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 10 },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  modalLabel: { fontSize: 12, fontWeight: "700", marginBottom: 8, marginTop: 14 },
  modalInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14 },
  modalTextarea: { minHeight: 80, textAlignVertical: "top" },
  noOutline: { outlineStyle: "none" } as any,

  // Layout de dos columnas para los modales de task en desktop: contenido
  // principal (título/descripción/asignación o comentarios) a la izquierda,
  // panel angosto de metadata (prioridad/fechas/adjuntos o status) a la
  // derecha — en vez de todo apilado en una sola columna angosta.
  formLayout: { flexDirection: "row", gap: 28, alignItems: "flex-start" },
  formMain: { flex: 1.5, minWidth: 0 },
  formSide: { width: 300 },

  taskInfoCard: { borderWidth: 1, borderRadius: 18, padding: 18, marginBottom: 16 },
  taskInfoTitle: { fontSize: 19, fontWeight: "800", letterSpacing: -0.3, marginBottom: 8 },
  taskInfoDescription: { fontSize: 13.5, lineHeight: 20 },

  taskFormCard: { borderWidth: 1, borderRadius: 18, padding: 16 },
  taskFormTitleInput: { fontSize: 16, fontWeight: "700", paddingVertical: 6 },
  taskFormDescInput: { fontSize: 13.5, lineHeight: 19, paddingVertical: 6, minHeight: 70, textAlignVertical: "top" },

  modeChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  listItemRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  listItemRowHalf: { flexBasis: "48%", flexGrow: 1 },

  divider: { height: 1, marginTop: 4 },

  replyQuote: { borderLeftWidth: 2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginTop: 6 },
  replyLink: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6, alignSelf: "flex-start" },

  attachmentImage: { width: 200, height: 150, borderRadius: 14, resizeMode: "cover" },
  attachmentFileChip: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginTop: 8, alignSelf: "flex-start", maxWidth: 260 },
  attachmentPreviewThumb: { width: 32, height: 32, borderRadius: 8 },

  chatContainer: { borderWidth: 1, borderRadius: 18, marginBottom: 12, overflow: "hidden" },
  chatScrollContent: { padding: 14, gap: 16 },

  inlineBar: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },

  chipInputRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 4 },
  chipInput: { flex: 1, paddingVertical: 12, fontSize: 13 },
  composerIconBtn: { padding: 2 },

  createBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 999, paddingVertical: 14, marginTop: 24 },
  createBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
});
