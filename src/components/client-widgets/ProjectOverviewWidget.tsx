import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { FolderKanban, Users as UsersIcon } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { STATUS_COLORS, STATUS_LABELS, ProjectStatus } from "../../lib/projects";
import { ClientHomeSection } from "../../lib/clientHome";

// Ficha 100% de datos reales, sin IA (docs/CLIENTE.md §6) — status/avance
// calculados directo de tasks, nunca inferidos. Self-contained.
//
// Usa la RPC get_client_widget_overview (security definer, schema.sql) en
// vez de listProjects()/listTeams()/supabase.from("tasks") directos — esas
// queries corren con la sesión del CLIENTE, y projects/tasks/teams nunca le
// dan acceso vía RLS normal (dependen de my_organization_ids(), que un
// cliente nunca integra a propósito). Bug real encontrado probando en vivo:
// con las queries directas este widget quedaba siempre vacío para el
// cliente aunque el staff sí hubiera elegido una fuente — RLS filtraba todo
// en silencio, sin ningún error. Ver docs/TRAMPAS.md.
type Props = {
  isDark: boolean;
  organizationId: string;
  clientUserId: string;
  section: ClientHomeSection;
};

type OverviewProject = { id: string; name: string; color: string; status: ProjectStatus; tasksTotal: number; tasksCompleted: number };
type OverviewTeam = { id: string; name: string; color: string };

export default function ProjectOverviewWidget({ isDark, organizationId, clientUserId, section }: Props) {
  const [projects, setProjects] = useState<OverviewProject[]>([]);
  const [teams, setTeams] = useState<OverviewTeam[]>([]);
  const [loading, setLoading] = useState(true);

  const cardBg        = isDark ? "rgba(17, 24, 39, 0.6)" : "rgba(255, 255, 255, 0.6)";
  const inputBg       = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const primaryColor  = "#2C7BD1";

  const projectIds: string[] = section.config?.projectIds ?? [];
  const teamIds: string[] = section.config?.teamIds ?? [];

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_client_widget_overview", {
        p_organization_id: organizationId,
        p_client_user_id: clientUserId,
        p_project_ids: projectIds,
        p_team_ids: teamIds,
      });

      if (active) {
        if (!error && data) {
          setProjects(data.projects ?? []);
          setTeams(data.teams ?? []);
        }
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, clientUserId, section.id]);

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
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
      <View style={styles.header}>
        <FolderKanban size={16} color={primaryColor} strokeWidth={2.2} />
        <Text style={[styles.title, { color: textPrimary }]}>{section.title}</Text>
      </View>

      {loading ? (
        <Text style={{ color: textSecondary, fontSize: 12.5 }}>Cargando…</Text>
      ) : projects.length === 0 && teams.length === 0 ? (
        <Text style={{ color: textSecondary, fontSize: 12.5 }}>Tu equipo todavía no eligió qué mostrar acá.</Text>
      ) : (
        <View style={{ gap: 12 }}>
          {projects.map((project) => {
            const pct = project.tasksTotal ? Math.round((project.tasksCompleted / project.tasksTotal) * 100) : 0;
            return (
              <View key={project.id} style={[styles.projectRow, { backgroundColor: inputBg, borderColor: border }]}>
                <View style={styles.projectHeader}>
                  <View style={[styles.iconWrap, { backgroundColor: project.color + "20" }]}>
                    <FolderKanban size={14} color={project.color} strokeWidth={2.2} />
                  </View>
                  <Text style={[styles.projectName, { color: textPrimary }]} numberOfLines={1}>
                    {project.name}
                  </Text>
                  <View style={[styles.statusPill, { backgroundColor: STATUS_COLORS[project.status] + "20" }]}>
                    <Text style={[styles.statusPillText, { color: STATUS_COLORS[project.status] }]}>{STATUS_LABELS[project.status]}</Text>
                  </View>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: border }]}>
                  <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: project.color }]} />
                </View>
                <Text style={[styles.progressLabel, { color: textSecondary }]}>
                  {project.tasksCompleted}/{project.tasksTotal} tareas completadas ({pct}%)
                </Text>
              </View>
            );
          })}

          {teams.length > 0 && (
            <View style={styles.teamsRow}>
              <UsersIcon size={13} color={textSecondary} strokeWidth={2.2} />
              <Text style={{ color: textSecondary, fontSize: 12 }}>{teams.map((t) => t.name).join(", ")}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 24, padding: 18 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  title: { fontSize: 14.5, fontWeight: "700" },
  projectRow: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 8 },
  projectHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconWrap: { width: 26, height: 26, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  projectName: { fontSize: 13, fontWeight: "700", flex: 1 },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontSize: 10, fontWeight: "700" },
  progressTrack: { height: 6, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 999 },
  progressLabel: { fontSize: 11 },
  teamsRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
});
