import React, { useCallback, useState } from "react";
import { Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ArrowLeft, ChevronRight, Handshake, Search, Users as UsersIcon, User as UserIcon } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { listOrgClients, OrgClient } from "../lib/clients";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

// Gestión de clientes (docs/CLIENTE.md §4) — la RLS de organization_clients
// ya acota sola quién ve qué: el owner ve todos los clientes de la
// organización (organization_clients_select_owner), un encargado no-owner
// solo ve los clientes que tiene asignados (organization_clients_select_staff,
// vía client_space_is_staff) — no hace falta ninguna lógica de rol acá, la
// misma query listOrgClients sirve para los dos casos.
export default function ClientsScreen({ navigation }: any) {
  const { isDark } = useTheme();
  const { organization, user } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isWeb = Platform.OS === "web";

  const [clients, setClients] = useState<OrgClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const bg            = isDark ? "#0B1220" : "#F1F5FA";
  const cardBg        = isDark ? "rgba(17, 24, 39, 0.6)" : "rgba(255, 255, 255, 0.6)";
  const inputBg       = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const primaryColor  = "#2C7BD1";

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

  const load = useCallback(async () => {
    if (!organization) return;
    setLoading(true);
    const { data } = await listOrgClients(organization.id);
    setClients(data);
    setLoading(false);
  }, [organization?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = clients.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: isMobile ? 16 : 32 }}>
        <View style={{ width: "100%", maxWidth: 900, alignSelf: "center" }}>
          <View style={styles.header}>
            <TouchableOpacity activeOpacity={0.8} style={[styles.backBtn, { backgroundColor: cardBg, borderColor: border }]} onPress={() => navigation.goBack()}>
              <ArrowLeft size={18} color={textSecondary} strokeWidth={2.2} />
            </TouchableOpacity>
            <View>
              <Text style={[styles.subtitle, { color: textSecondary }]}>{organization?.name ?? "Workspace"}</Text>
              <Text style={[styles.title, { color: textPrimary }]}>Clientes</Text>
            </View>
          </View>

          {clients.length > 3 && (
            <View style={[styles.searchWrapper, { backgroundColor: inputBg, borderColor: border, marginBottom: 16 }]}>
              <Search size={18} color={textSecondary} strokeWidth={2.3} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar cliente…"
                placeholderTextColor={textSecondary}
                style={[styles.searchInput, { color: textPrimary }, isWeb && (styles.noOutline as any)]}
              />
            </View>
          )}

          {loading ? (
            <Text style={{ color: textSecondary, fontSize: 13 }}>Cargando…</Text>
          ) : filtered.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
              <Handshake size={26} color={textSecondary} strokeWidth={2} />
              <Text style={[styles.emptyTitle, { color: textPrimary }]}>
                {clients.length === 0 ? "Todavía no tienes clientes" : "Nadie coincide con la búsqueda"}
              </Text>
              {clients.length === 0 && !!organization && (
                <Text style={[styles.emptySubtitle, { color: textSecondary }]}>
                  Comparte tu código de cliente <Text style={{ fontWeight: "700" }}>{organization.client_invite_code}</Text> para que se unan.
                </Text>
              )}
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ gap: 10 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
              {filtered.map((c) => (
                <TouchableOpacity
                  key={c.userId}
                  activeOpacity={0.85}
                  style={[styles.clientCard, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}
                  onPress={() =>
                    navigation.navigate("ClientDetail", {
                      clientUserId: c.userId,
                      clientName: c.name,
                      clientAvatarUrl: c.avatarUrl,
                      clientAvatarColor: c.avatarColor,
                    })
                  }
                >
                  <View style={[styles.avatar, { backgroundColor: c.avatarColor, overflow: "hidden" }]}>
                    {c.avatarUrl ? <Image source={{ uri: c.avatarUrl }} style={{ width: 42, height: 42 }} /> : <Text style={styles.avatarText}>{initials(c.name)}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.clientName, { color: textPrimary }]} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={[styles.clientMeta, { color: textSecondary }]} numberOfLines={1}>
                      Cliente desde {formatDate(c.joinedAt)}
                    </Text>
                  </View>
                  <View style={[styles.assignBadge, { backgroundColor: c.assignment ? primaryColor + "18" : inputBg, borderColor: c.assignment ? primaryColor + "40" : border }]}>
                    {c.assignment?.type === "team" ? (
                      <UsersIcon size={12} color={c.assignment ? primaryColor : textSecondary} strokeWidth={2.4} />
                    ) : (
                      <UserIcon size={12} color={c.assignment ? primaryColor : textSecondary} strokeWidth={2.4} />
                    )}
                    <Text style={[styles.assignBadgeText, { color: c.assignment ? primaryColor : textSecondary }]} numberOfLines={1}>
                      {c.assignment?.name ?? "Sin asignar"}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={textSecondary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 24 },
  backBtn: { width: 40, height: 40, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  subtitle: { fontSize: 13, fontWeight: "600" },
  title: { fontSize: 26, fontWeight: "700", letterSpacing: -0.5, marginTop: 2 },

  searchWrapper: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16 },
  searchInput: { flex: 1, paddingVertical: 14, fontSize: 15 },
  noOutline: { outlineStyle: "none" } as any,

  emptyCard: { borderWidth: 1, borderRadius: 24, padding: 32, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  emptySubtitle: { fontSize: 12.5, textAlign: "center", lineHeight: 18, marginTop: 4 },

  clientCard: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 22, borderWidth: 1, padding: 14 },
  avatar: { width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  clientName: { fontSize: 14, fontWeight: "700" },
  clientMeta: { fontSize: 11.5, marginTop: 2 },
  assignBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 140 },
  assignBadgeText: { fontSize: 11, fontWeight: "700", flexShrink: 1 },
});
