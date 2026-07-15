import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { ClipboardList, LayoutGrid, LogOut, MessageCircle, User } from "lucide-react-native";

import ClientHomeScreen from "../screens/ClientHomeScreen";
import ClientChatScreen from "../screens/ClientChatScreen";
import ClientRequestsScreen from "../screens/ClientRequestsScreen";
import ClientProfileScreen from "../screens/ClientProfileScreen";
import SpaceSwitcher from "../components/SpaceSwitcher";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

const Tab = createBottomTabNavigator();

const AZURE_DEEP = "#2C7BD1";

const TAB_ICONS: Record<string, any> = {
  ClientHome: LayoutGrid,
  ClientChat: MessageCircle,
  ClientRequests: ClipboardList,
  ClientProfile: User,
};

const TAB_LABELS: Record<string, string> = {
  ClientHome: "Inicio",
  ClientChat: "Chat",
  ClientRequests: "Solicitudes",
  ClientProfile: "Perfil",
};

// Shell de navegación para un espacio de tipo "cliente" (docs/CLIENTE.md) —
// mismo CustomTabBar que BottomTabs.tsx (barra abajo en mobile, arriba en
// desktop), pero con tabs propios y el SpaceSwitcher en vez del logo fijo de
// Nexus (un cliente puede tener más de un espacio, ver docs/CLIENTE.md §2).
function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { isDark } = useTheme();
  const { signOut } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const bg            = isDark ? "rgba(11,18,32,0.86)" : "rgba(255,255,255,0.86)";
  const border        = isDark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.05)";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const primaryColor  = AZURE_DEEP;
  const activeBg      = isDark ? "rgba(126,200,245,0.16)" : "rgba(44,123,209,0.09)";

  const glass = Platform.select({
    web: {
      backdropFilter: "blur(20px) saturate(180%)",
      boxShadow: isDark
        ? "0 1px 0 rgba(255,255,255,0.05)"
        : "0 1px 0 rgba(255,255,255,0.75), 0 16px 34px -22px rgba(44,123,209,0.28)",
    } as any,
    default: {},
  });

  const handleSignOut = async () => {
    await signOut();
    navigation.getParent()?.reset({ index: 0, routes: [{ name: "Landing" }] });
  };

  if (isMobile) {
    return (
      <>
        <View style={[styles.mobileTopRow, { backgroundColor: bg, borderBottomColor: border }, glass]}>
          <SpaceSwitcher isDark={isDark} navigation={navigation} />
        </View>
        <View style={[styles.mobileBar, { backgroundColor: bg, borderTopColor: border }, glass]}>
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
                <Icon size={22} color={isFocused ? primaryColor : textSecondary} strokeWidth={2.2} />
                <Text style={[styles.mobileLabel, { color: isFocused ? primaryColor : textSecondary }]}>
                  {TAB_LABELS[route.name] ?? route.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </>
    );
  }

  return (
    <View style={[styles.topBar, { backgroundColor: bg, borderBottomColor: border }, glass]}>
      <View style={styles.topBarInner}>
        <SpaceSwitcher isDark={isDark} navigation={navigation} />

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
                <Icon size={16} color={isFocused ? primaryColor : textSecondary} strokeWidth={2.2} />
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

export default function ClientTabs() {
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
      <Tab.Screen name="ClientHome" component={ClientHomeScreen} />
      <Tab.Screen name="ClientChat" component={ClientChatScreen} />
      <Tab.Screen name="ClientRequests" component={ClientRequestsScreen} />
      <Tab.Screen name="ClientProfile" component={ClientProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  mobileTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, borderBottomWidth: 1 },
  mobileBar: { flexDirection: "row", height: 70, borderTopWidth: 1, paddingTop: 8, paddingBottom: 10 },
  mobileItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  mobileLabel: { fontSize: 11, fontWeight: "600" },

  topBar: { borderBottomWidth: 1 },
  topBarInner: {
    width: "100%", maxWidth: 1280, alignSelf: "center", flexDirection: "row",
    alignItems: "center", justifyContent: "space-between", paddingHorizontal: 32, height: 64,
  },
  links: { flexDirection: "row", alignItems: "center", gap: 6 },
  link: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  linkText: { fontSize: 13, fontWeight: "700" },
  signOutBtn: { width: 38, height: 38, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
