import React, { useEffect, useRef, useState } from "react";
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Bell, CheckCheck, X } from "lucide-react-native";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import {
  AppNotification,
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../lib/notifications";

const AZURE_DEEP = "#2C7BD1";

// Adónde navegar al tocar cada tipo de notificación — mismo criterio de
// deep-link que la búsqueda global del Dashboard (entityType "task" abre el
// detalle exacto vía route.params, el resto solo cambia de tab porque esas
// pantallas no tienen vista de detalle propia todavía).
function resolveRoute(n: AppNotification): { name: string; params?: Record<string, any> } | null {
  switch (n.entityType) {
    case "task":
      return n.projectId && n.entityId ? { name: "Tasks", params: { projectId: n.projectId, taskId: n.entityId } } : { name: "Tasks" };
    case "project":
      return { name: "Projects" };
    case "team":
      return { name: "Team" };
    case "badge":
      return { name: "Profile" };
    default:
      return null;
  }
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

// Sondea el conteo de no leídas cada 30s (sin Realtime, para no sumar una
// suscripción nueva solo para esto) — se re-lee la lista completa recién al
// abrir el panel, no en cada poll.
const POLL_MS = 30000;

// navigation se recibe por prop (no useNavigation()) porque este componente
// se monta dentro del tabBar custom de BottomTabs.tsx, fuera del árbol de
// pantallas — ahí useNavigation() resuelve el navigator raíz (Landing/Main),
// no el Tab.Navigator interno, así que navigate("Tasks", ...) fallaba en
// silencio. CustomTabBar ya recibe el navigation correcto vía
// BottomTabBarProps, se lo pasa tal cual.
export default function NotificationBell({ navigation, floating }: { navigation: any; floating?: boolean }) {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const bg = isDark ? "#0B1220" : "#FFFFFF";
  const cardBg = isDark ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.96)";
  const border = isDark ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.08)";
  const textPrimary = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const unreadDot = isDark ? "rgba(126,200,245,0.14)" : "rgba(44,123,209,0.07)";

  const refreshUnread = async () => {
    if (!user) return;
    const { count } = await countUnreadNotifications(user.id);
    setUnread(count);
  };

  useEffect(() => {
    if (!user) return;
    refreshUnread();
    pollRef.current = setInterval(refreshUnread, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const openPanel = async () => {
    setOpen(true);
    if (!user) return;
    setLoading(true);
    const { data } = await listNotifications(user.id);
    setItems(data);
    setLoading(false);
  };

  const handleMarkAllRead = async () => {
    if (!user || !unread) return;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    await markAllNotificationsRead(user.id);
  };

  const handlePress = async (n: AppNotification) => {
    if (!n.read) {
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read: true } : i)));
      setUnread((prev) => Math.max(0, prev - 1));
      markNotificationRead(n.id);
    }
    setOpen(false);
    const route = resolveRoute(n);
    if (route) navigation.navigate(route.name, route.params);
  };

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={openPanel}
        hitSlop={8}
        style={[styles.bellBtn, { borderColor: border, backgroundColor: bg }, floating && styles.floating]}
        {...(Platform.OS === "web" ? ({ title: "Notificaciones" } as any) : {})}
      >
        <Bell size={17} color={textSecondary} strokeWidth={2.2} />
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text>
          </View>
        )}
      </TouchableOpacity>

      {open && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject as any} activeOpacity={1} onPress={() => setOpen(false)} />
          <View style={styles.panelWrap} pointerEvents="box-none">
            <View style={[styles.panel, { backgroundColor: cardBg, borderColor: border }]}>
              <View style={styles.header}>
                <Text style={[styles.title, { color: textPrimary }]}>Notificaciones</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  {unread > 0 && (
                    <TouchableOpacity activeOpacity={0.7} onPress={handleMarkAllRead} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <CheckCheck size={13} color={AZURE_DEEP} />
                      <Text style={{ color: AZURE_DEEP, fontSize: 12, fontWeight: "700" }}>Marcar leídas</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => setOpen(false)} hitSlop={8}>
                    <X size={18} color={textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                {loading ? (
                  <Text style={{ color: textSecondary, fontSize: 13, padding: 4 }}>Cargando…</Text>
                ) : !items.length ? (
                  <Text style={{ color: textSecondary, fontSize: 13, padding: 4 }}>Todavía no tenés notificaciones.</Text>
                ) : (
                  items.map((n) => (
                    <TouchableOpacity
                      key={n.id}
                      activeOpacity={0.7}
                      onPress={() => handlePress(n)}
                      style={[styles.row, { borderColor: border, backgroundColor: n.read ? "transparent" : unreadDot }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.rowTitle, { color: textPrimary }]}>{n.title}</Text>
                        <Text style={{ fontSize: 12.5, color: textSecondary, marginTop: 2 }} numberOfLines={2}>
                          {n.body}
                        </Text>
                        <Text style={{ fontSize: 10.5, color: textSecondary, marginTop: 4 }}>{timeAgo(n.createdAt)}</Text>
                      </View>
                      {!n.read && <View style={styles.dot} />}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  floating: {
    position: Platform.OS === "web" ? ("fixed" as any) : "absolute",
    top: 14,
    right: 14,
    zIndex: 50,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: "#E4483A",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#FFF", fontSize: 9.5, fontWeight: "800" },
  panelWrap: { flex: 1, alignItems: "flex-end", paddingTop: Platform.OS === "web" ? 70 : 60, paddingRight: 16 },
  panel: { width: 360, maxWidth: "94%", borderRadius: 22, borderWidth: 1, padding: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 15, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12, borderBottomWidth: 1, marginBottom: 2 },
  rowTitle: { fontSize: 13, fontWeight: "700" },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: AZURE_DEEP, marginTop: 4 },
});
