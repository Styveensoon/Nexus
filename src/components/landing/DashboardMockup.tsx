import React from "react";
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
} from "react-native";

import {
  CheckCircle2,
  Circle,
  Clock3,
  Users,
  BarChart3,
  Sparkles,
  Folder,
  Bug,
} from "lucide-react-native";

export default function DashboardMockup() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  return (
    <View style={styles.wrapper}>

      {/* Browser */}
      <View style={styles.browser}>

        {/* Browser Header */}
        <View style={styles.browserHeader}>
          <View style={styles.browserDots}>
            <View style={[styles.dot, { backgroundColor: "#FF5F57" }]} />
            <View style={[styles.dot, { backgroundColor: "#FEBC2E" }]} />
            <View style={[styles.dot, { backgroundColor: "#28C840" }]} />
          </View>

          <Text style={styles.browserUrl}>
            nexus.app / dashboard
          </Text>
        </View>

        {/* Content */}
        <View style={[styles.content, isMobile && { minHeight: undefined }]}>

          {/* Sidebar */}
          {!isMobile && (
            <View style={styles.sidebar}>

              <SidebarItem
                icon={<BarChart3 size={14} color="#111827" />}
                label="Dashboard"
                active
              />

              <SidebarItem
                icon={<Folder size={14} color="#6B7280" />}
                label="Proyectos"
              />

              <SidebarItem
                icon={<Users size={14} color="#6B7280" />}
                label="Equipos"
              />

              <SidebarItem
                icon={<Bug size={14} color="#6B7280" />}
                label="Issues"
              />

              <SidebarItem
                icon={<Sparkles size={14} color="#6B7280" />}
                label="IA"
              />

            </View>
          )}

          {/* Main */}
          <View style={styles.main}>

            {/* Header */}
            <View style={styles.topRow}>
              <View>
                <Text style={styles.smallText}>
                  Hola, Andrea
                </Text>

                <Text style={styles.title}>
                  Resumen de hoy
                </Text>
              </View>

              <View style={styles.avatarGroup}>
                <View style={[styles.avatar, { backgroundColor: "#DBEAFE" }]} />
                <View style={[styles.avatar, { backgroundColor: "#FDE68A" }]} />
                <View style={[styles.avatar, { backgroundColor: "#FBCFE8" }]} />
              </View>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>

              <StatCard
                title="PROYECTOS"
                value="12"
                trend="+2"
              />

              <StatCard
                title="TAREAS"
                value="184"
                trend="+24"
              />

              <StatCard
                title="EQUIPOS"
                value="7"
                trend="+1"
              />

            </View>

            {/* Bottom */}
            <View
              style={[
                styles.bottomSection,
                isMobile && {
                  flexDirection: "column",
                },
              ]}
            >

              {/* Tasks */}
              {/* `flex: 3` de tasksCard divide el ANCHO cuando está en fila (desktop) — en
                  mobile, bottomSection pasa a columna y ese mismo flex (flexBasis 0%) se
                  traduce en una repartición del ALTO, estirando esta tarjeta con un hueco
                  vacío al final. `{ flex: undefined }` NO alcanza para anularlo — React
                  Native Web ignora los valores `undefined` al mezclar estilos (no "borran"
                  el valor anterior del array), así que hay que pisar explícitamente
                  flexGrow/flexShrink/flexBasis para que la tarjeta mida su contenido real. */}
              <View style={[styles.tasksCard, isMobile && { flexGrow: 0, flexShrink: 0, flexBasis: "auto" }]}>

                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>
                    Tareas en progreso
                  </Text>

                  <Text style={styles.cardDate}>
                    Hoy
                  </Text>
                </View>

                <TaskItem
                  icon={
                    <CheckCircle2
                      size={14}
                      color="#10B981"
                    />
                  }
                  title="Diseño onboarding"
                  subtitle="Mobile App"
                />

                <TaskItem
                  icon={
                    <Clock3
                      size={14}
                      color="#2563EB"
                    />
                  }
                  title="API de pagos"
                  subtitle="Checkout"
                />

                <TaskItem
                  icon={
                    <Circle
                      size={14}
                      color="#9CA3AF"
                    />
                  }
                  title="Sprint planning"
                  subtitle="Equipo Web"
                />

                <TaskItem
                  icon={
                    <Bug
                      size={14}
                      color="#EF4444"
                    />
                  }
                  title="Bug login Safari"
                  subtitle="Web App"
                />

              </View>

              {/* Reports */}
              <View style={[styles.reportCard, isMobile && { flexGrow: 0, flexShrink: 0, flexBasis: "auto" }]}>

                <Text style={styles.cardTitle}>
                  Reportes IA
                </Text>

                <View style={styles.chart}>

                  {[45, 70, 55, 82, 62, 95, 75].map(
                    (h, index) => (
                      <View
                        key={index}
                        style={[
                          styles.bar,
                          {
                            height: h,
                          },
                        ]}
                      />
                    )
                  )}

                </View>

                <View style={styles.productivityBox}>

                  <Sparkles
                    size={12}
                    color="#2563EB"
                  />

                  <Text style={styles.productivityText}>
                    +18% productividad esta semana
                  </Text>

                </View>

              </View>

            </View>

          </View>
        </View>
      </View>
    </View>
  );
}

function SidebarItem({
  icon,
  label,
  active,
}: any) {
  return (
    <View
      style={[
        styles.sidebarItem,
        active && styles.sidebarActive,
      ]}
    >
      {icon}
      <Text
        style={[
          styles.sidebarText,
          active && {
            color: "#111827",
            fontWeight: "700",
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function StatCard({
  title,
  value,
  trend,
}: any) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>
        {title}
      </Text>

      <View style={styles.statRow}>
        <Text style={styles.statValue}>
          {value}
        </Text>

        <Text style={styles.statTrend}>
          {trend}
        </Text>
      </View>
    </View>
  );
}

function TaskItem({
  icon,
  title,
  subtitle,
}: any) {
  return (
    <View style={styles.taskRow}>
      {icon}

      <View style={{ flex: 1 }}>
        <Text style={styles.taskTitle}>
          {title}
        </Text>

        <Text style={styles.taskSubtitle}>
          {subtitle}
        </Text>
      </View>

      <View style={styles.taskAvatar} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
  },

  browser: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },

  browserHeader: {
    height: 50,
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },

  browserDots: {
    flexDirection: "row",
    gap: 6,
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },

  browserUrl: {
    marginLeft: 14,
    color: "#6B7280",
    fontSize: 12,
  },

  content: {
    flexDirection: "row",
    minHeight: 430,
  },

  sidebar: {
    width: 120,
    backgroundColor: "#F8FAFC",
    borderRightWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
  },

  sidebarItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
  },

  sidebarActive: {
    backgroundColor: "#FFFFFF",
  },

  sidebarText: {
    fontSize: 12,
    color: "#6B7280",
  },

  main: {
    flex: 1,
    padding: 18,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  smallText: {
    color: "#6B7280",
    fontSize: 12,
  },

  title: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 4,
  },

  avatarGroup: {
    flexDirection: "row",
  },

  avatar: {
    width: 30,
    height: 30,
    borderRadius: 999,
    marginLeft: -6,
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },

  statCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 14,
  },

  statLabel: {
    fontSize: 10,
    color: "#6B7280",
  },

  statRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },

  statValue: {
    fontSize: 24,
    fontWeight: "700",
  },

  statTrend: {
    marginLeft: 6,
    color: "#10B981",
    fontSize: 12,
    fontWeight: "700",
  },

  bottomSection: {
    flexDirection: "row",
    gap: 12,
  },

  tasksCard: {
    flex: 3,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 18,
    padding: 14,
  },

  reportCard: {
    flex: 2,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 18,
    padding: 14,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  cardTitle: {
    fontWeight: "700",
    fontSize: 13,
  },

  cardDate: {
    fontSize: 11,
    color: "#6B7280",
  },

  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },

  taskTitle: {
    fontSize: 13,
    fontWeight: "600",
  },

  taskSubtitle: {
    fontSize: 11,
    color: "#6B7280",
  },

  taskAvatar: {
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: "#DBEAFE",
  },

  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 120,
    marginTop: 12,
    gap: 5,
  },

  bar: {
    flex: 1,
    backgroundColor: "#2563EB",
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },

  productivityBox: {
    marginTop: 16,
    backgroundColor: "#DBEAFE",
    borderRadius: 12,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  productivityText: {
    marginLeft: 6,
    color: "#1D4ED8",
    fontWeight: "600",
    fontSize: 11,
  },
});