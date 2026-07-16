import React from "react";
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FileText, X } from "lucide-react-native";

const AZURE_DEEP = "#2C7BD1";

type Props = {
  visible: boolean;
  isDark: boolean;
  onAccept: () => void;
  onClose: () => void;
};

// Contenido real de Términos y Condiciones — reflejan cómo funciona Nexus hoy
// (self-hosting/privacidad de datos como diferenciador, ver docs/ARQUITECTURA.md),
// no una plantilla genérica de relleno.
const SECTIONS: { heading: string; body: string }[] = [
  {
    heading: "1. Aceptación de los términos",
    body:
      "Al crear una cuenta en Nexus aceptas estos Términos y Condiciones. Si no estás de acuerdo con alguno de los puntos siguientes, no debes registrarte ni usar la plataforma.",
  },
  {
    heading: "2. Qué es Nexus",
    body:
      "Nexus es una plataforma de gestión de proyectos con asistencia de IA, pensada para operar de forma privada dentro de la red de tu organización. Tu organización (workspace) es responsable de administrar sus propios miembros, proyectos, equipos y datos dentro de la plataforma.",
  },
  {
    heading: "3. Tu cuenta",
    body:
      "Sos responsable de mantener la confidencialidad de tu contraseña y de toda la actividad que ocurra bajo tu cuenta. Notifica de inmediato al owner de tu organización si sospechás un uso no autorizado de tu cuenta.",
  },
  {
    heading: "4. Privacidad y uso de datos",
    body:
      "La información que cargás (proyectos, tareas, mensajes, perfiles) pertenece a tu organización, no a Nexus. En un despliegue self-hosted, esos datos nunca salen de la red de tu organización. En el entorno de desarrollo/nube, los datos se procesan únicamente para brindar el servicio (incluyendo el uso puntual de un proveedor de IA para funciones como El Semillero) y no se venden ni se comparten con terceros con fines comerciales.",
  },
  {
    heading: "5. Uso aceptable",
    body:
      "No está permitido usar Nexus para actividades ilegales, para vulnerar la seguridad de la plataforma, ni para acceder a datos de organizaciones ajenas a la tuya. El owner de cada organización es responsable de a quién invita y qué permisos otorga dentro de su workspace.",
  },
  {
    heading: "6. Disponibilidad del servicio",
    body:
      "Nexus se ofrece \"tal cual\". Podemos actualizar, modificar o interrumpir funciones de la plataforma en cualquier momento, priorizando siempre no perder datos ya guardados de tu organización.",
  },
  {
    heading: "7. Cambios a estos términos",
    body:
      "Podemos actualizar estos Términos y Condiciones a medida que la plataforma evoluciona. El uso continuado de Nexus después de un cambio implica la aceptación de los términos actualizados.",
  },
];

export default function TermsModal({ visible, isDark, onAccept, onClose }: Props) {
  const cardBg        = isDark ? "rgba(15,23,42,0.9)" : "rgba(255,255,255,0.9)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const inputBg       = isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.03)";
  const primaryColor  = AZURE_DEEP;

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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
          <View style={styles.header}>
            <View style={[styles.icon, { backgroundColor: primaryColor }]}>
              <FileText size={18} color="#FFF" strokeWidth={2.2} />
            </View>
            <Text style={[styles.title, { color: textPrimary }]}>Términos y condiciones</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={20} color={textSecondary} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={[styles.body, { backgroundColor: inputBg, borderColor: border }]}
            contentContainerStyle={{ padding: 18, gap: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {SECTIONS.map((section) => (
              <View key={section.heading}>
                <Text style={[styles.sectionHeading, { color: textPrimary }]}>{section.heading}</Text>
                <Text style={[styles.sectionBody, { color: textSecondary }]}>{section.body}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.btnSecondary, { borderColor: border }]}
              onPress={onClose}
            >
              <Text style={[styles.btnSecondaryText, { color: textPrimary }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.btnPrimary, { backgroundColor: primaryColor }]}
              onPress={onAccept}
            >
              <Text style={styles.btnPrimaryText}>Aceptar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    ...Platform.select({ web: { backdropFilter: "blur(4px)" } as any, default: {} }),
  },
  card: { width: "100%", maxWidth: 520, maxHeight: "85%", borderRadius: 28, borderWidth: 1, padding: 22 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, fontWeight: "700", flex: 1 },
  body: { borderWidth: 1, borderRadius: 18, flexGrow: 0, flexShrink: 1 },
  sectionHeading: { fontSize: 13, fontWeight: "700", marginBottom: 5 },
  sectionBody: { fontSize: 12.5, lineHeight: 19 },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  btnSecondary: { flex: 1, borderRadius: 999, borderWidth: 1, paddingVertical: 14, alignItems: "center" },
  btnSecondaryText: { fontWeight: "700", fontSize: 14 },
  btnPrimary: { flex: 1.4, borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  btnPrimaryText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
});
