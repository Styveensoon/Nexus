import React, { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function RegisterScreen({ navigation }: any) {
  const { isDark } = useTheme();
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  return (
    <SafeAreaView
      style={[
        styles.container,
        isDark && styles.darkContainer,
      ]}
    >
      <View style={styles.backgroundCircle} />

      <View style={styles.content}>
        <Text
          style={[
            styles.logo,
            isDark && { color: "#60A5FA" },
          ]}
        >
          ENZO
        </Text>

        <Text
          style={[
            styles.title,
            isDark && { color: "#F8FAFC" },
          ]}
        >
          Crea tu cuenta
        </Text>

        <Text
          style={[
            styles.subtitle,
            isDark && { color: "#94A3B8" },
          ]}
        >
          Empieza gratis y construye proyectos increíbles.
        </Text>

        <View
          style={[
            styles.card,
            isDark && { backgroundColor: "#1E293B" },
          ]}
        >
          <TextInput
            placeholder="Nombre completo"
            placeholderTextColor={isDark ? "#94A3B8" : "#9CA3AF"}
            style={[
              styles.input,
              isDark && {
                backgroundColor: "#0F172A",
                borderColor: "#334155",
                color: "#F8FAFC",
              },
            ]}
          />

          <TextInput
            placeholder="Correo electrónico"
            placeholderTextColor={isDark ? "#94A3B8" : "#9CA3AF"}
            keyboardType="email-address"
            style={[
              styles.input,
              isDark && {
                backgroundColor: "#0F172A",
                borderColor: "#334155",
                color: "#F8FAFC",
              },
            ]}
          />

          <TextInput
            placeholder="Contraseña"
            placeholderTextColor={isDark ? "#94A3B8" : "#9CA3AF"}
            secureTextEntry
            style={[
              styles.input,
              isDark && {
                backgroundColor: "#0F172A",
                borderColor: "#334155",
                color: "#F8FAFC",
              },
            ]}
          />

          <View style={styles.passwordStrength}>
            <View style={[styles.strengthBar, styles.activeBar]} />
            <View style={[styles.strengthBar, styles.activeBar]} />
            <View style={styles.strengthBar} />
          </View>

          <Text
            style={[
              styles.passwordHint,
              isDark && { color: "#94A3B8" },
            ]}
          >
            Usa al menos 8 caracteres.
          </Text>

          <TextInput
            placeholder="Confirmar contraseña"
            placeholderTextColor={isDark ? "#94A3B8" : "#9CA3AF"}
            secureTextEntry
            style={[
              styles.input,
              isDark && {
                backgroundColor: "#0F172A",
                borderColor: "#334155",
                color: "#F8FAFC",
              },
            ]}
          />

          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setAcceptedTerms(!acceptedTerms)}
          >
            <View
              style={[
                styles.checkbox,
                acceptedTerms && styles.checkboxActive,
              ]}
            />

            <Text
              style={[
                styles.checkboxText,
                isDark && { color: "#CBD5E1" },
              ]}
            >
              Acepto los términos y condiciones
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => navigation.replace("Main")}
          >
            <Text style={styles.registerButtonText}>
              Crear cuenta
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View
              style={[
                styles.line,
                isDark && { backgroundColor: "#334155" },
              ]}
            />
            <Text
              style={[
                styles.or,
                isDark && { color: "#94A3B8" },
              ]}
            >
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
              isDark && { borderColor: "#334155" },
            ]}
          >
            <Text
              style={[
                styles.googleText,
                isDark && { color: "#F8FAFC" },
              ]}
            >
              Continuar con Google
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate("Login")}
        >
          <Text
            style={[
              styles.loginLink,
              isDark && { color: "#60A5FA" },
            ]}
          >
            ¿Ya tienes cuenta? Inicia sesión
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

  backgroundCircle: {
    position: "absolute",
    top: -160,
    left: -100,
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
    color: "#111827",
    textAlign: "center",
  },

  subtitle: {
    textAlign: "center",
    marginTop: 10,
    marginBottom: 30,
    color: "#6B7280",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 6,
  },

  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },

  passwordStrength: {
    flexDirection: "row",
    marginBottom: 8,
  },

  strengthBar: {
    flex: 1,
    height: 6,
    borderRadius: 6,
    backgroundColor: "#E5E7EB",
    marginRight: 4,
  },

  activeBar: {
    backgroundColor: "#2563EB",
  },

  passwordHint: {
    color: "#6B7280",
    fontSize: 12,
    marginBottom: 14,
  },

  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    marginRight: 10,
  },

  checkboxActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },

  checkboxText: {
    flex: 1,
    color: "#374151",
    fontSize: 13,
  },

  registerButton: {
    backgroundColor: "#2563EB",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
  },

  registerButtonText: {
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

  googleText: {
    color: "#111827",
    fontWeight: "700",
  },

  loginLink: {
    textAlign: "center",
    marginTop: 30,
    color: "#2563EB",
    fontWeight: "700",
  },
  darkContainer: {
        backgroundColor: "#0F172A",
    },
});