import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";

import {
  Menu,
  X,
  Sparkles,
} from "lucide-react-native";

import { useTheme } from "../../context/ThemeContext";

const { width } = Dimensions.get("window");

const isMobile = width < 768;

export default function Navbar({ navigation }: any) {
  const { isDark } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <View
        style={[
          styles.navbar,
          isDark && styles.navbarDark,
        ]}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Sparkles
              size={16}
              color="#FFFFFF"
            />
          </View>

          <Text
            style={[
              styles.logoText,
              isDark && styles.darkText,
            ]}
          >
            Nexus
          </Text>
        </View>

        {/* WEB MENU */}
        {!isMobile && (
          <>
            <View style={styles.navLinks}>
              <NavItem
                label="Inicio"
                isDark={isDark}
              />

              <NavItem
                label="Características"
                isDark={isDark}
              />

              <NavItem
                label="Integraciones"
                isDark={isDark}
              />

              <NavItem
                label="Contacto"
                isDark={isDark}
              />
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate("Login")
                }
              >
                <Text
                  style={[
                    styles.loginText,
                    isDark && styles.darkSubText,
                  ]}
                >
                  Iniciar sesión
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.registerBtn}
                onPress={() =>
                  navigation.navigate("Register")
                }
              >
                <Text style={styles.registerText}>
                  Registrarse
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* MOBILE MENU BUTTON */}
        {isMobile && (
          <TouchableOpacity
            onPress={() =>
              setMenuOpen(!menuOpen)
            }
          >
            {menuOpen ? (
              <X
                size={26}
                color={
                  isDark
                    ? "#FFFFFF"
                    : "#111827"
                }
              />
            ) : (
              <Menu
                size={26}
                color={
                  isDark
                    ? "#FFFFFF"
                    : "#111827"
                }
              />
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* MOBILE DROPDOWN */}
      {menuOpen && isMobile && (
        <View
          style={[
            styles.mobileMenu,
            isDark && styles.mobileMenuDark,
          ]}
        >
          <MobileItem
            label="Inicio"
          />

          <MobileItem
            label="Características"
          />

          <MobileItem
            label="Integraciones"
          />

          <MobileItem
            label="Contacto"
          />

          <TouchableOpacity
            style={styles.mobileLogin}
            onPress={() =>
              navigation.navigate("Login")
            }
          >
            <Text style={styles.mobileLoginText}>
              Iniciar sesión
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mobileRegister}
            onPress={() =>
              navigation.navigate("Register")
            }
          >
            <Text style={styles.mobileRegisterText}>
              Registrarse
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}

function NavItem({
  label,
  isDark,
}: any) {
  return (
    <TouchableOpacity>
      <Text
        style={[
          styles.navLink,
          isDark && styles.darkSubText,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function MobileItem({
  label,
}: any) {
  return (
    <TouchableOpacity style={styles.mobileItem}>
      <Text style={styles.mobileItemText}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  navbar: {
    height: 80,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    backgroundColor: "#FFFFFF",

    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
  },

  navbarDark: {
    backgroundColor: "#111827",
    borderColor: "#1F2937",
  },

  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
  },

  logoIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,

    backgroundColor: "#2563EB",

    justifyContent: "center",
    alignItems: "center",
  },

  logoText: {
    marginLeft: 10,
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
  },

  darkText: {
    color: "#FFFFFF",
  },

  darkSubText: {
    color: "#CBD5E1",
  },

  navLinks: {
    flexDirection: "row",
    gap: 32,
  },

  navLink: {
    fontSize: 15,
    fontWeight: "500",
    color: "#374151",
  },

  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },

  loginText: {
    fontSize: 15,
    color: "#374151",
    fontWeight: "500",
  },

  registerBtn: {
    backgroundColor: "#2563EB",

    paddingHorizontal: 18,
    paddingVertical: 12,

    borderRadius: 999,
  },

  registerText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  mobileMenu: {
    backgroundColor: "#FFFFFF",
    padding: 20,

    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
  },

  mobileMenuDark: {
    backgroundColor: "#111827",
    borderColor: "#1F2937",
  },

  mobileItem: {
    paddingVertical: 14,
  },

  mobileItemText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },

  mobileLogin: {
    marginTop: 16,

    paddingVertical: 14,

    borderWidth: 1,
    borderColor: "#D1D5DB",

    borderRadius: 14,
    alignItems: "center",
  },

  mobileLoginText: {
    fontWeight: "700",
  },

  mobileRegister: {
    marginTop: 12,

    backgroundColor: "#2563EB",

    paddingVertical: 14,

    borderRadius: 14,
    alignItems: "center",
  },

  mobileRegisterText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});