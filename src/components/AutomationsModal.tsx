import React, { useEffect, useState } from "react";
import { Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Plus, Trash2, X, Zap } from "lucide-react-native";
import {
  ACTION_LABELS,
  AutomationActionType,
  AutomationTriggerType,
  createAutomation,
  deleteAutomation,
  listProjectAutomations,
  ProjectAutomation,
  toggleAutomation,
  TRIGGER_LABELS,
} from "../lib/automations";
import {
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_ORDER,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  TaskPriority,
  TaskStatus,
} from "../lib/tasks";

// Reglas "CUANDO <trigger> ENTONCES <acción>" por proyecto — solo el líder
// del proyecto o el owner las gestionan (mismo criterio que RLS en
// project_automations). Sin edición: recrear es más simple que un formulario
// de edición completo para v1, mismo criterio que otros pickers de este
// proyecto (ver docs/PATRONES.md).
type AssignableUser = { userId: string; name: string; avatarUrl: string | null; avatarColor: string };

type Props = {
  visible: boolean;
  isDark: boolean;
  projectId: string;
  projectName: string;
  currentUserId: string;
  assignableUsers: AssignableUser[];
  onClose: () => void;
};

const TRIGGER_TYPES: AutomationTriggerType[] = ["task_created", "task_status_changed", "task_assigned"];
const ACTION_TYPES: AutomationActionType[] = ["change_status", "change_priority", "add_label", "assign_to_user", "post_comment", "notify_user"];

export default function AutomationsModal({ visible, isDark, projectId, projectName, currentUserId, assignableUsers, onClose }: Props) {
  const [automations, setAutomations] = useState<ProjectAutomation[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState<AutomationTriggerType>("task_status_changed");
  const [triggerStatus, setTriggerStatus] = useState<TaskStatus>("blocked");
  const [actionType, setActionType] = useState<AutomationActionType>("notify_user");
  const [actionStatus, setActionStatus] = useState<TaskStatus>("in_review");
  const [actionPriority, setActionPriority] = useState<TaskPriority>("urgent");
  const [actionLabel, setActionLabel] = useState("");
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [actionText, setActionText] = useState("");

  const cardBg = isDark ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.9)";
  const inputBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const primaryColor = "#2C7BD1";
  const dangerColor = "#EF4444";

  const load = async () => {
    setLoading(true);
    const { data } = await listProjectAutomations(projectId);
    setAutomations(data);
    setLoading(false);
  };

  useEffect(() => {
    if (!visible) return;
    load();
    setShowForm(false);
    setConfirmDeleteId(null);
    setErrorText(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, projectId]);

  const resetForm = () => {
    setName("");
    setTriggerType("task_status_changed");
    setTriggerStatus("blocked");
    setActionType("notify_user");
    setActionStatus("in_review");
    setActionPriority("urgent");
    setActionLabel("");
    setActionUserId(assignableUsers[0]?.userId ?? null);
    setActionText("");
    setErrorText(null);
  };

  const openForm = () => {
    resetForm();
    setShowForm(true);
  };

  const buildTriggerConfig = (): Record<string, any> => {
    if (triggerType === "task_status_changed") return { toStatus: triggerStatus };
    return {};
  };

  const buildActionConfig = (): Record<string, any> | null => {
    switch (actionType) {
      case "change_status":
        return { status: actionStatus };
      case "change_priority":
        return { priority: actionPriority };
      case "add_label":
        return actionLabel.trim() ? { label: actionLabel.trim() } : null;
      case "assign_to_user":
        return actionUserId ? { userId: actionUserId } : null;
      case "post_comment":
        return actionText.trim() ? { content: actionText.trim() } : null;
      case "notify_user":
        return actionUserId ? { userId: actionUserId, message: actionText.trim() || undefined } : null;
      default:
        return null;
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setErrorText("Ponele un nombre a la regla.");
      return;
    }
    const actionConfig = buildActionConfig();
    if (!actionConfig) {
      setErrorText("Completá los datos de la acción.");
      return;
    }
    setSaving(true);
    setErrorText(null);
    const { data, error } = await createAutomation({
      projectId,
      createdBy: currentUserId,
      name: name.trim(),
      triggerType,
      triggerConfig: buildTriggerConfig(),
      actionType,
      actionConfig,
    });
    setSaving(false);
    if (error || !data) {
      setErrorText("No se pudo crear la automatización.");
      return;
    }
    setAutomations((prev) => [data, ...prev]);
    setShowForm(false);
  };

  const handleToggle = async (automation: ProjectAutomation) => {
    setAutomations((prev) => prev.map((a) => (a.id === automation.id ? { ...a, enabled: !a.enabled } : a)));
    await toggleAutomation(automation.id, !automation.enabled);
  };

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(null);
    setAutomations((prev) => prev.filter((a) => a.id !== id));
    await deleteAutomation(id);
  };

  const userName = (userId?: string) => assignableUsers.find((u) => u.userId === userId)?.name ?? "alguien";

  const describeTrigger = (a: ProjectAutomation) => {
    if (a.triggerType === "task_status_changed" && a.triggerConfig.toStatus) {
      return `una tarea pasa a "${TASK_STATUS_LABELS[a.triggerConfig.toStatus as TaskStatus] ?? a.triggerConfig.toStatus}"`;
    }
    return TRIGGER_LABELS[a.triggerType].toLowerCase();
  };

  const describeAction = (a: ProjectAutomation) => {
    switch (a.actionType) {
      case "change_status":
        return `cambiar el status a "${TASK_STATUS_LABELS[a.actionConfig.status as TaskStatus] ?? a.actionConfig.status}"`;
      case "change_priority":
        return `cambiar la prioridad a "${TASK_PRIORITY_LABELS[a.actionConfig.priority as TaskPriority] ?? a.actionConfig.priority}"`;
      case "add_label":
        return `agregar la etiqueta "${a.actionConfig.label}"`;
      case "assign_to_user":
        return `reasignar a ${userName(a.actionConfig.userId)}`;
      case "post_comment":
        return `comentar "${a.actionConfig.content}"`;
      case "notify_user":
        return `notificar a ${userName(a.actionConfig.userId)}`;
      default:
        return "";
    }
  };

  const ultraShadow = {
    ...Platform.select({
      web: {
        boxShadow: isDark
          ? "0 30px 60px -25px rgba(0,0,0,0.65), 0 1px 0 rgba(255,255,255,0.08) inset"
          : "0 30px 60px -22px rgba(44,123,209,0.18), 0 1px 0 rgba(255,255,255,0.9) inset",
        backdropFilter: "blur(32px) saturate(200%)",
      } as any,
      default: {},
    }),
    borderTopColor: isDark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.9)",
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <ScrollView style={[styles.card, { backgroundColor: cardBg, borderColor: border }, ultraShadow]} contentContainerStyle={{ padding: 20 }}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Zap size={16} color={primaryColor} />
                <Text style={[styles.title, { color: textPrimary }]}>Automatizaciones</Text>
              </View>
              <Text style={[styles.subtitle, { color: textSecondary }]}>{projectName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={18} color={textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.description, { color: textSecondary }]}>
            Reglas que corren solas sobre las tareas de este proyecto — "cuando pasa esto, hacé aquello".
          </Text>

          {loading ? (
            <Text style={{ color: textSecondary, fontSize: 12.5 }}>Cargando…</Text>
          ) : (
            <View style={{ gap: 10 }}>
              {automations.map((a) =>
                confirmDeleteId === a.id ? (
                  <View key={a.id} style={[styles.ruleRow, { borderColor: dangerColor, backgroundColor: inputBg }]}>
                    <Text style={{ color: textPrimary, fontSize: 13, fontWeight: "600", marginBottom: 10 }}>¿Borrar "{a.name}"?</Text>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <TouchableOpacity onPress={() => handleDelete(a.id)} style={[styles.smallBtn, { backgroundColor: dangerColor }]}>
                        <Text style={styles.smallBtnText}>Borrar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setConfirmDeleteId(null)}
                        style={[styles.smallBtn, { backgroundColor: "transparent", borderWidth: 1, borderColor: border }]}
                      >
                        <Text style={[styles.smallBtnText, { color: textPrimary }]}>Cancelar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View key={a.id} style={[styles.ruleRow, { borderColor: border, backgroundColor: inputBg, opacity: a.enabled ? 1 : 0.5 }]}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                      <Text style={{ color: textPrimary, fontSize: 13.5, fontWeight: "700", flex: 1 }}>{a.name}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <TouchableOpacity activeOpacity={0.8} onPress={() => handleToggle(a)} hitSlop={6}>
                          <View
                            style={[
                              styles.switchTrack,
                              { backgroundColor: a.enabled ? primaryColor : border, justifyContent: a.enabled ? "flex-end" : "flex-start" },
                            ]}
                          >
                            <View style={styles.switchThumb} />
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setConfirmDeleteId(a.id)} hitSlop={6}>
                          <Trash2 size={14} color={textSecondary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={{ color: textSecondary, fontSize: 12, marginTop: 4 }}>
                      Cuando {describeTrigger(a)}, {describeAction(a)}.
                    </Text>
                  </View>
                )
              )}
              {!automations.length && !showForm && <Text style={{ color: textSecondary, fontSize: 12.5 }}>Sin automatizaciones todavía.</Text>}
            </View>
          )}

          {!showForm ? (
            <TouchableOpacity activeOpacity={0.85} onPress={openForm} style={[styles.addBtn, { borderColor: border }]}>
              <Plus size={14} color={primaryColor} />
              <Text style={{ color: primaryColor, fontSize: 13, fontWeight: "700" }}>Nueva automatización</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ marginTop: 16, gap: 14 }}>
              <View style={[styles.divider, { backgroundColor: border }]} />

              <View>
                <Text style={[styles.formLabel, { color: textSecondary }]}>Nombre</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder='Ej. "Avisar cuando algo se bloquea"'
                  placeholderTextColor={textSecondary}
                  style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                />
              </View>

              <View>
                <Text style={[styles.formLabel, { color: textSecondary }]}>Cuando…</Text>
                <View style={styles.chipsRow}>
                  {TRIGGER_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t}
                      activeOpacity={0.8}
                      onPress={() => setTriggerType(t)}
                      style={[styles.chip, { borderColor: border, backgroundColor: triggerType === t ? primaryColor : "transparent" }]}
                    >
                      <Text style={{ color: triggerType === t ? "#FFF" : textPrimary, fontSize: 12, fontWeight: "600" }}>{TRIGGER_LABELS[t]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {triggerType === "task_status_changed" && (
                  <View style={[styles.chipsRow, { marginTop: 8 }]}>
                    {TASK_STATUS_ORDER.map((s) => (
                      <TouchableOpacity
                        key={s}
                        activeOpacity={0.8}
                        onPress={() => setTriggerStatus(s)}
                        style={[styles.chip, { borderColor: border, borderWidth: triggerStatus === s ? 1.5 : 1 }]}
                      >
                        <Text style={{ color: textPrimary, fontSize: 11.5, fontWeight: triggerStatus === s ? "800" : "600" }}>
                          {TASK_STATUS_LABELS[s]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View>
                <Text style={[styles.formLabel, { color: textSecondary }]}>Entonces…</Text>
                <View style={styles.chipsRow}>
                  {ACTION_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t}
                      activeOpacity={0.8}
                      onPress={() => setActionType(t)}
                      style={[styles.chip, { borderColor: border, backgroundColor: actionType === t ? primaryColor : "transparent" }]}
                    >
                      <Text style={{ color: actionType === t ? "#FFF" : textPrimary, fontSize: 12, fontWeight: "600" }}>{ACTION_LABELS[t]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {actionType === "change_status" && (
                  <View style={[styles.chipsRow, { marginTop: 8 }]}>
                    {TASK_STATUS_ORDER.map((s) => (
                      <TouchableOpacity
                        key={s}
                        activeOpacity={0.8}
                        onPress={() => setActionStatus(s)}
                        style={[styles.chip, { borderColor: border, borderWidth: actionStatus === s ? 1.5 : 1 }]}
                      >
                        <Text style={{ color: textPrimary, fontSize: 11.5, fontWeight: actionStatus === s ? "800" : "600" }}>
                          {TASK_STATUS_LABELS[s]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {actionType === "change_priority" && (
                  <View style={[styles.chipsRow, { marginTop: 8 }]}>
                    {TASK_PRIORITY_ORDER.map((p) => (
                      <TouchableOpacity
                        key={p}
                        activeOpacity={0.8}
                        onPress={() => setActionPriority(p)}
                        style={[styles.chip, { borderColor: border, borderWidth: actionPriority === p ? 1.5 : 1 }]}
                      >
                        <Text style={{ color: textPrimary, fontSize: 11.5, fontWeight: actionPriority === p ? "800" : "600" }}>
                          {TASK_PRIORITY_LABELS[p]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {actionType === "add_label" && (
                  <TextInput
                    value={actionLabel}
                    onChangeText={setActionLabel}
                    placeholder="Nombre de la etiqueta"
                    placeholderTextColor={textSecondary}
                    style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrimary, marginTop: 8 }]}
                  />
                )}
                {(actionType === "assign_to_user" || actionType === "notify_user") && (
                  <View style={[styles.chipsRow, { marginTop: 8 }]}>
                    {assignableUsers.map((u) => (
                      <TouchableOpacity
                        key={u.userId}
                        activeOpacity={0.8}
                        onPress={() => setActionUserId(u.userId)}
                        style={[styles.chip, { borderColor: border, borderWidth: actionUserId === u.userId ? 1.5 : 1 }]}
                      >
                        <Text style={{ color: textPrimary, fontSize: 11.5, fontWeight: actionUserId === u.userId ? "800" : "600" }}>{u.name}</Text>
                      </TouchableOpacity>
                    ))}
                    {!assignableUsers.length && <Text style={{ color: textSecondary, fontSize: 11.5 }}>Sin gente asignable en este proyecto.</Text>}
                  </View>
                )}
                {actionType === "post_comment" && (
                  <TextInput
                    value={actionText}
                    onChangeText={setActionText}
                    placeholder="Qué comentar automáticamente…"
                    placeholderTextColor={textSecondary}
                    style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrimary, marginTop: 8 }]}
                  />
                )}
                {actionType === "notify_user" && (
                  <TextInput
                    value={actionText}
                    onChangeText={setActionText}
                    placeholder="Mensaje de la notificación (opcional)"
                    placeholderTextColor={textSecondary}
                    style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrimary, marginTop: 8 }]}
                  />
                )}
              </View>

              {!!errorText && <Text style={{ color: dangerColor, fontSize: 12 }}>{errorText}</Text>}

              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={saving}
                  onPress={handleSave}
                  style={[styles.smallBtn, { backgroundColor: primaryColor, flex: 1, alignItems: "center", opacity: saving ? 0.6 : 1 }]}
                >
                  <Text style={styles.smallBtnText}>{saving ? "Guardando…" : "Crear regla"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setShowForm(false)}
                  style={[styles.smallBtn, { backgroundColor: "transparent", borderWidth: 1, borderColor: border }]}
                >
                  <Text style={[styles.smallBtnText, { color: textPrimary }]}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {!!errorText && !showForm && <Text style={{ color: dangerColor, fontSize: 12, marginTop: 10 }}>{errorText}</Text>}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    ...Platform.select({ web: { backdropFilter: "blur(4px)" } as any, default: {} }),
  },
  card: { width: "100%", maxWidth: 560, maxHeight: "88%", borderRadius: 28, borderWidth: 1 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 },
  title: { fontSize: 16, fontWeight: "700", letterSpacing: -0.3 },
  subtitle: { fontSize: 12, marginTop: 2 },
  description: { fontSize: 12.5, lineHeight: 18, marginBottom: 16 },
  ruleRow: { borderWidth: 1, borderRadius: 16, padding: 12 },
  switchTrack: { width: 34, height: 20, borderRadius: 10, padding: 2, flexDirection: "row" },
  switchThumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#FFF" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 999,
    paddingVertical: 12,
    marginTop: 14,
  },
  divider: { height: 1 },
  formLabel: { fontSize: 11.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  smallBtn: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  smallBtnText: { color: "#FFF", fontSize: 12.5, fontWeight: "700" },
});
