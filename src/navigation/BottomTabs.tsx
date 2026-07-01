import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Calendar, CircleCheckBig, Folder, LayoutGrid, User, Users } from "lucide-react-native";

import DashboardScreen from "../screens/DashboardScreen";
import ProjectsScreen from "../screens/ProjectsScreen";
import CalendarScreen from "../screens/CalendarScreen";
import TeamScreen from "../screens/TeamScreen";
import ProfileScreen from "../screens/ProfileScreen";
import TasksScreen from "../screens/TasksScreen";
import { useTheme } from "../context/ThemeContext";

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, any> = {
  Dashboard: LayoutGrid,
  Projects: Folder,
  Tasks: CircleCheckBig,
  Calendar: Calendar,
  Team: Users,
  Profile: User,
};

export default function BottomTabs() {
  const { isDark } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,

        tabBarActiveTintColor: "#2563EB",
        tabBarInactiveTintColor: isDark ? "#64748B" : "#9CA3AF",

        tabBarStyle: {
          height: 70,
          borderTopWidth: 1,
          borderTopColor: isDark ? "#1E293B" : "#F1F5F9",
          backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
        },

        tabBarIcon: ({ color, size }) => {
          const Icon = TAB_ICONS[route.name] ?? LayoutGrid;
          return <Icon size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
      />

      <Tab.Screen
        name="Projects"
        component={ProjectsScreen}
      />

      <Tab.Screen
        name="Tasks"
        component={TasksScreen}
      />

      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
      />

      <Tab.Screen
        name="Team"
        component={TeamScreen}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
      />
    </Tab.Navigator>
  );
}
