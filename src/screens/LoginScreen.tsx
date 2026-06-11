import React from "react";
import { useTheme } from "../context/ThemeContext";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function LoginScreen({ navigation }: any) {
  const { isDark } = useTheme();

  return (
    <SafeAreaView
      style={[
        styles.container,
        isDark && styles.darkContainer,
      ]}
    >
      <View
        style={[
          styles.backgroundCircle,
          isDark && { backgroundColor: "#1E293B" },
        ]}
      />

      <View style={styles.content}>
        <Text style={[styles.logo, isDark && styles.darkText]}>
          ENZO
        </Text>

        <Text style={[styles.title, isDark && styles.darkText]}>
          Bienvenido de nuevo
        </Text>

        <Text style={[styles.subtitle, isDark && styles.darkSubText]}>
          Inicia sesión para continuar con tus proyectos.
        </Text>

        <View
          style={[
            styles.card,
            isDark && styles.darkCard,
          ]}
        >
          <TextInput
            placeholder="Correo electrónico"
            placeholderTextColor={isDark ? "#94A3B8" : "#9CA3AF"}
            style={[
              styles.input,
              isDark && styles.darkInput,
            ]}
          />

          <TextInput
            placeholder="Contraseña"
            placeholderTextColor={isDark ? "#94A3B8" : "#9CA3AF"}
            secureTextEntry
            style={[
              styles.input,
              isDark && styles.darkInput,
            ]}
          />

          <TouchableOpacity>
            <Text style={styles.forgotPassword}>
              ¿Olvidaste tu contraseña?
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.replace("Main")}
          >
            <Text style={styles.loginText}>
              Iniciar sesión
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View
              style={[
                styles.line,
                isDark && { backgroundColor: "#334155" },
              ]}
            />
            <Text style={[styles.or, isDark && styles.darkSubText]}>
              o
            </Text>
            <View
              style={[
                styles.line,
                isDark && { backgroundColor: "#334155" },
              ]}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.googleButton,
              isDark && styles.darkGoogleButton,
            ]}
          >
            <Text
              style={[
                styles.googleText,
                isDark && styles.darkText,
              ]}
            >
              Continuar con Google
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate("Register")}
        >
          <Text style={styles.registerLink}>
            ¿No tienes cuenta? Crear cuenta
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  darkContainer: {
    backgroundColor: "#0F172A",
  },

  backgroundCircle: {
    position: "absolute",
    top: -150,
    right: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#DBEAFE",
  },

  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  logo: {
    fontSize: 42,
    fontWeight: "900",
    color: "#2563EB",
    textAlign: "center",
  },

  title: {
    marginTop: 20,
    fontSize: 34,
    fontWeight: "900",
    textAlign: "center",
    color: "#111827",
  },

  subtitle: {
    textAlign: "center",
    marginTop: 10,
    color: "#6B7280",
    marginBottom: 30,
    lineHeight: 22,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },

  darkCard: {
    backgroundColor: "#1E293B",
  },

  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    fontSize: 15,
  },

  darkInput: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    color: "#F8FAFC",
  },

  forgotPassword: {
    color: "#2563EB",
    fontWeight: "600",
    textAlign: "right",
    marginBottom: 20,
  },

  loginButton: {
    backgroundColor: "#2563EB",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
  },

  loginText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
  },

  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },

  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },

  or: {
    marginHorizontal: 10,
    color: "#9CA3AF",
  },

  googleButton: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
  },

  darkGoogleButton: {
    borderColor: "#334155",
    backgroundColor: "#0F172A",
  },

  googleText: {
    color: "#111827",
    fontWeight: "700",
  },

  darkText: {
    color: "#F8FAFC",
  },

  darkSubText: {
    color: "#94A3B8",
  },

  registerLink: {
    textAlign: "center",
    marginTop: 30,
    color: "#2563EB",
    fontWeight: "700",
  },
});