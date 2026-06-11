import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import DashboardScreen from "../screens/DashboardScreen";
import ProjectsScreen from "../screens/ProjectsScreen";
import CalendarScreen from "../screens/CalendarScreen";
import TeamScreen from "../screens/TeamScreen";
import ProfileScreen from "../screens/ProfileScreen";
import TasksScreen from "../screens/TasksScreen";

const Tab = createBottomTabNavigator();

export default function BottomTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,

        tabBarActiveTintColor: "#2563EB",
        tabBarInactiveTintColor: "#9CA3AF",

        tabBarStyle: {
          height: 70,
          borderTopWidth: 0,
          backgroundColor: "#FFFFFF",
        },

        tabBarIcon: ({ color, size }) => {
          let iconName: any = "grid";

          switch (route.name) {
            case "Dashboard":
              iconName = "grid";
              break;

            case "Projects":
              iconName = "folder";
              break;

            case "Tasks":
              iconName = "checkmark-circle";
              break;

            case "Calendar":
              iconName = "calendar";
              break;

            case "Team":
              iconName = "people";
              break;

            case "Profile":
              iconName = "person";
              break;
          }

          return (
            <Ionicons
              name={iconName}
              size={size}
              color={color}
            />
          );
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