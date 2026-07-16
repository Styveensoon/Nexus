import React, { useEffect, useState } from "react";
import { Image, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Search, Users, User as UserIcon, X } from "lucide-react-native";
import { listOrganizationMembers, OrganizationMemberProfile } from "../lib/organizations";
import { listTeams, Team } from "../lib/teams";
import { assignClient } from "../lib/clients";

// Asignar persona o equipo a un cliente (docs/CLIENTE.md §4) — solo el owner
// puede llamar esto (RLS client_assignments_insert_owner). Mismo lenguaje
// visual que MemberProfileModal/SpaceSwitcher (overlay + card + lista de
// filas con avatar).
type Props = {
  visible: boolean;
  isDark: boolean;
  organizationId: string;
  clientUserId: string;
  assignedBy: string;
  onClose: () => void;
  onAssigned: () => void;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

export default function ClientAssignModal({ visible, isDark, organizationId, clientUserId, assignedBy, onClose, onAssigned }: Props) {
  const [tab, setTab] = useState<"person" | "team">("person");
  const [members, setMembers] = useState<OrganizationMemberProfile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const cardBg        = isDark ? "rgba(15,23,42,0.9)" : "rgba(255,255,255,0.92)";
  const inputBg       = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const primaryColor  = "#2C7BD1";
  const dangerColor   = "#EF4444";

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

  useEffect(() => {
    if (!visible) return;
    setSearch("");
    setErrorText(null);
    setLoading(true);
    Promise.all([listOrganizationMembers(organizationId), listTeams(organizationId)]).then(([membersRes, teamsRes]) => {
      setMembers(membersRes.data);
      setTeams(teamsRes.data);
      setLoading(false);
    });
  }, [visible, organizationId]);

  const filteredMembers = members.filter((m) => m.name.toLowerCase().includes(search.trim().toLowerCase()));
  const filteredTeams = teams.filter((t) => t.name.toLowerCase().includes(search.trim().toLowerCase()));

  const handleAssignPerson = async (userId: string) => {
    setAssigningId(userId);
    setErrorText(null);
    const { error } = await assignClient({ organizationId, clientUserId, assignedBy, target: { type: "user", userId } });
    setAssigningId(null);
    if (error) {
      setErrorText("No se pudo asignar a esta persona.");
      return;
    }
    onAssigned();
  };

  const handleAssignTeam = async (teamId: string) => {
    setAssigningId(teamId);
    setErrorText(null);
    const { error } = await assignClient({ organizationId, clientUserId, assignedBy, target: { type: "team", teamId } });
    setAssigningId(null);
    if (error) {
      setErrorText("No se pudo asignar a este equipo.");
      return;
    }
    onAssigned();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: textPrimary }]}>Asignar a este cliente</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={20} color={textSecondary} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <View style={[styles.segmentRow, { backgroundColor: inputBg, borderColor: border }]}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.segmentBtn, tab === "person" && { backgroundColor: primaryColor }]}
              onPress={() => setTab("person")}
            >
              <UserIcon size={14} color={tab === "person" ? "#FFF" : textSecondary} strokeWidth={2.2} />
              <Text style={[styles.segmentText, { color: tab === "person" ? "#FFF" : textSecondary }]}>Persona</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.segmentBtn, tab === "team" && { backgroundColor: primaryColor }]}
              onPress={() => setTab("team")}
            >
              <Users size={14} color={tab === "team" ? "#FFF" : textSecondary} strokeWidth={2.2} />
              <Text style={[styles.segmentText, { color: tab === "team" ? "#FFF" : textSecondary }]}>Equipo</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.searchWrapper, { backgroundColor: inputBg, borderColor: border }]}>
            <Search size={16} color={textSecondary} strokeWidth={2.3} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={tab === "person" ? "Buscar persona…" : "Buscar equipo…"}
              placeholderTextColor={textSecondary}
              style={[styles.searchInput, { color: textPrimary }, Platform.OS === "web" && (styles.noOutline as any)]}
            />
          </View>

          {errorText && <Text style={{ color: dangerColor, fontSize: 12, fontWeight: "600", marginBottom: 8 }}>{errorText}</Text>}

          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 6 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            {loading ? (
              <Text style={{ color: textSecondary, fontSize: 13 }}>Cargando…</Text>
            ) : tab === "person" ? (
              filteredMembers.length === 0 ? (
                <Text style={{ color: textSecondary, fontSize: 13 }}>Nadie coincide con la búsqueda.</Text>
              ) : (
                filteredMembers.map((m) => (
                  <TouchableOpacity
                    key={m.userId}
                    activeOpacity={0.8}
                    disabled={assigningId === m.userId}
                    onPress={() => handleAssignPerson(m.userId)}
                    style={[styles.row, { opacity: assigningId === m.userId ? 0.6 : 1 }]}
                  >
                    <View style={[styles.rowAvatar, { backgroundColor: m.avatarColor }]}>
                      <Text style={styles.rowAvatarText}>{initials(m.name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowName, { color: textPrimary }]} numberOfLines={1}>
                        {m.name}
                      </Text>
                      {!!(m.customRole || m.role) && (
                        <Text style={[styles.rowSubtitle, { color: textSecondary }]} numberOfLines={1}>
                          {m.customRole || m.role}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))
              )
            ) : filteredTeams.length === 0 ? (
              <Text style={{ color: textSecondary, fontSize: 13 }}>Ningún equipo coincide con la búsqueda.</Text>
            ) : (
              filteredTeams.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  activeOpacity={0.8}
                  disabled={assigningId === t.id}
                  onPress={() => handleAssignTeam(t.id)}
                  style={[styles.row, { opacity: assigningId === t.id ? 0.6 : 1 }]}
                >
                  <View style={[styles.rowAvatar, { backgroundColor: t.color, overflow: "hidden" }]}>
                    {t.iconUrl ? <Image source={{ uri: t.iconUrl }} style={{ width: 34, height: 34 }} /> : <Users size={16} color="#FFF" strokeWidth={2.3} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowName, { color: textPrimary }]} numberOfLines={1}>
                      {t.name}
                    </Text>
                    <Text style={[styles.rowSubtitle, { color: textSecondary }]}>{t.members.length} integrantes</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
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
  card: { width: "100%", maxWidth: 400, borderRadius: 28, borderWidth: 1, padding: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  title: { fontSize: 16, fontWeight: "700", letterSpacing: -0.3 },

  segmentRow: { flexDirection: "row", borderWidth: 1, borderRadius: 14, padding: 4, gap: 4, marginBottom: 12 },
  segmentBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, paddingVertical: 9 },
  segmentText: { fontSize: 12.5, fontWeight: "700" },

  searchWrapper: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, marginBottom: 12 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13.5 },
  noOutline: { outlineStyle: "none" } as any,

  row: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 8 },
  rowAvatar: { width: 34, height: 34, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  rowAvatarText: { color: "#FFF", fontWeight: "700", fontSize: 12.5 },
  rowName: { fontSize: 13.5, fontWeight: "700" },
  rowSubtitle: { fontSize: 11, marginTop: 1 },
});
