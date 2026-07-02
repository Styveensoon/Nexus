import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { CircleCheckBig, Folder, LayoutGrid, LogOut, Sparkles, User, Users } from "lucide-react-native";

import DashboardScreen from "../screens/DashboardScreen";
import ProjectsScreen from "../screens/ProjectsScreen";
import TeamScreen from "../screens/TeamScreen";
import ProfileScreen from "../screens/ProfileScreen";
import TasksScreen from "../screens/TasksScreen";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

const Tab = createBottomTabNavigator();

// Calendario dejó de ser una pestaña propia — es una de las 4 vistas
// (Kanban/Lista/Calendario/Gantt) dentro de Tasks, ver TasksScreen.tsx.
const TAB_ICONS: Record<string, any> = {
  Dashboard: LayoutGrid,
  Projects: Folder,
  Tasks: CircleCheckBig,
  Team: Users,
  Profile: User,
};

const TAB_LABELS: Record<string, string> = {
  Dashboard: "Inicio",
  Projects: "Proyectos",
  Tasks: "Tareas",
  Team: "Equipo",
  Profile: "Perfil",
};

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { isDark } = useTheme();
  const { signOut } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const bg            = isDark ? "#0F172A" : "#FFFFFF";
  const border        = isDark ? "#1E293B" : "#F1F5F9";
  const textSecondary = isDark ? "#94A3B8" : "#64748B";
  const primaryColor  = "#2563EB";
  const activeBg      = isDark ? "rgba(37,99,235,0.18)" : "#EFF6FF";

  const handleSignOut = async () => {
    await signOut();
    navigation.getParent()?.reset({ index: 0, routes: [{ name: "Landing" }] });
  };

  if (isMobile) {
    return (
      <View style={[styles.mobileBar, { backgroundColor: bg, borderTopColor: border }]}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const Icon = TAB_ICONS[route.name] ?? LayoutGrid;
          return (
            <TouchableOpacity
              key={route.key}
              activeOpacity={0.75}
              style={styles.mobileItem}
              onPress={() => navigation.navigate(route.name)}
            >
              <Icon size={22} color={isFocused ? primaryColor : textSecondary} />
              <Text style={[styles.mobileLabel, { color: isFocused ? primaryColor : textSecondary }]}>
                {TAB_LABELS[route.name] ?? route.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return (
    <View style={[styles.topBar, { backgroundColor: bg, borderBottomColor: border }]}>
      <View style={styles.topBarInner}>
        <View style={styles.brand}>
          <View style={styles.brandIcon}>
            <Sparkles size={16} color="#FFF" />
          </View>
          <Text style={[styles.brandText, { color: isDark ? "#F8FAFC" : "#020617" }]}>Nexus</Text>
        </View>

        <View style={styles.links}>
          {state.routes.map((route, index) => {
            const isFocused = state.index === index;
            const Icon = TAB_ICONS[route.name] ?? LayoutGrid;
            return (
              <TouchableOpacity
                key={route.key}
                activeOpacity={0.8}
                style={[styles.link, isFocused && { backgroundColor: activeBg }]}
                onPress={() => navigation.navigate(route.name)}
              >
                <Icon size={16} color={isFocused ? primaryColor : textSecondary} />
                <Text style={[styles.linkText, { color: isFocused ? primaryColor : textSecondary }]}>
                  {TAB_LABELS[route.name] ?? route.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.signOutBtn, { borderColor: border }]}
          onPress={handleSignOut}
        >
          <LogOut size={16} color={textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function BottomTabs() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarPosition: isMobile ? "bottom" : "top",
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Projects" component={ProjectsScreen} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
      <Tab.Screen name="Team" component={TeamScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  mobileBar: {
    flexDirection: "row", height: 70, borderTopWidth: 1, paddingTop: 8, paddingBottom: 10,
  },
  mobileItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  mobileLabel: { fontSize: 11, fontWeight: "600" },

  topBar: { borderBottomWidth: 1 },
  topBarInner: {
    width: "100%", maxWidth: 1280, alignSelf: "center", flexDirection: "row",
    alignItems: "center", justifyContent: "space-between", paddingHorizontal: 32, height: 64,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: "#2563EB", justifyContent: "center", alignItems: "center" },
  brandText: { fontSize: 17, fontWeight: "900", letterSpacing: -0.5 },
  links: { flexDirection: "row", alignItems: "center", gap: 6 },
  link: {
    flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
  },
  linkText: { fontSize: 13, fontWeight: "700" },
  signOutBtn: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
});
