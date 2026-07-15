import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, Linking } from "react-native";
import { Lock, Server, Check, X } from "lucide-react-native";

interface PricingSectionProps {
  isDark: boolean;
  isMobile: boolean;
}

const AZURE_DEEP = "#2C7BD1";
const isWeb = Platform.OS === "web";

// El diferenciador real de Nexus (ver docs/ARQUITECTURA.md: self-hosting, Ollama local,
// datos que nunca salen de la red del cliente) es el argumento de venta más fuerte del
// producto — esta sección lo vende como tal en vez de esconderlo en una tabla de precios
// genérica. Nada de lo que se afirma acá es una cifra inventada: es la arquitectura real
// (o su roadmap de producción declarado en ese doc), solo presentada con fuerza de marketing.
const COMPARISON = [
  { label: "Dónde viven tus datos",   them: "En la nube pública de un tercero",        us: "Nunca salen de tu propia red" },
  { label: "Dónde corre la IA",       them: "Modelo compartido en servidores ajenos",  us: "Ollama local, en tu propio servidor" },
  { label: "Cumplimiento normativo",  them: "A merced de la letra chica de otro",      us: "Pensado para bancos, gobierno y salud" },
  { label: "Quién decide el uptime",  them: "Un proveedor externo",                    us: "Tu infraestructura, tus reglas" },
];

const STATS = [
  { value: "0%", label: "de tus datos en manos de terceros" },
  { value: "100%", label: "de la IA corriendo dentro de tu red" },
  { value: "∞", label: "control sobre tu propia información" },
];

const SALES_EMAIL = "styveen.emiliano@gmail.com";

export default function PricingSection({ isDark, isMobile }: PricingSectionProps) {
  const cardBg        = isDark ? "rgba(17, 24, 39, 0.62)" : "rgba(255, 255, 255, 0.78)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const bg2           = isDark ? "#0E1626" : "#EAF1FA";
  const badgeBg       = isDark ? "rgba(44,123,209,0.14)" : "#EAF4FC";
  const badgeBorder   = isDark ? "rgba(44,123,209,0.35)" : "#BEE3FA";
  const themCellBg    = isDark ? "rgba(148,163,184,0.06)" : "rgba(15,23,42,0.025)";
  const usCellBg      = isDark ? "rgba(44,123,209,0.14)" : "rgba(44,123,209,0.08)";
  const rowBorder     = isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)";
  const mutedIconColor = isDark ? "#64748B" : "#94A3B8";

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

  const [hoverSales, setHoverSales] = useState(false);

  const talkSales = () => Linking.openURL(`mailto:${SALES_EMAIL}?subject=${encodeURIComponent("Nexus Self-Hosted")}`);

  return (
    <View style={[styles.wrap, { backgroundColor: bg2, paddingHorizontal: isMobile ? 16 : "5%", paddingVertical: isMobile ? 56 : 140 }]}>
      <View style={[styles.container, { maxWidth: 1080 }]}>

        <View style={[styles.badge, { backgroundColor: badgeBg, borderColor: badgeBorder, alignSelf: "center" }]}>
          <Lock size={14} color={AZURE_DEEP} />
          <Text style={styles.badgeText}>No es una promesa. Es arquitectura.</Text>
        </View>

        <Text style={[styles.title, { color: textPrimary, fontSize: isMobile ? 32 : 56, lineHeight: isMobile ? 38 : 60, marginTop: isMobile ? 16 : 24, marginBottom: isMobile ? 16 : 24 }]}>
          Tu IA. Tu servidor.{"\n"}
          <Text style={{ color: AZURE_DEEP }}>Tus reglas.</Text>
        </Text>
        <Text style={[styles.sub, { color: textSecondary, fontSize: isMobile ? 15 : 20, marginBottom: isMobile ? 32 : 64 }]}>
          Mientras el resto del mercado sube tus datos a servidores ajenos, Nexus corre Ollama
          100% dentro de tu propia infraestructura. Ni un solo byte sale de tu red — ni falta que hace.
        </Text>

        {/* --- TABLA "ELLOS vs NEXUS" --- */}
        <View style={[styles.compareCard, { backgroundColor: cardBg, borderColor: border, borderWidth: 1 }, ultraShadow]}>
          <View style={[styles.compareRow, styles.compareHead]}>
            <View style={[styles.compareLabelCol, isMobile && { flex: 1 }]} />
            <View style={[styles.compareCol, isMobile && { flex: 1, paddingHorizontal: 8 }]}>
              <Text style={[styles.compareHeadText, { color: textSecondary, fontSize: isMobile ? 11 : 13 }]}>Otras plataformas</Text>
            </View>
            <View style={[styles.compareCol, styles.compareColUs, isMobile && { flex: 1, paddingHorizontal: 8 }, { backgroundColor: usCellBg }]}>
              <Text style={[styles.compareHeadText, { color: AZURE_DEEP, fontSize: isMobile ? 11 : 13 }]}>Nexus</Text>
            </View>
          </View>

          {COMPARISON.map((row, i) => (
            <View key={row.label} style={[styles.compareRow, i < COMPARISON.length - 1 && { borderBottomWidth: 1, borderBottomColor: rowBorder }]}>
              <View style={[styles.compareLabelCol, isMobile && { paddingHorizontal: 10, flex: 1 }]}>
                <Text style={[styles.compareLabel, { color: textPrimary, fontSize: isMobile ? 12.5 : 14 }]}>{row.label}</Text>
              </View>
              <View style={[styles.compareCol, isMobile && { flex: 1, paddingHorizontal: 8, gap: 4 }, { backgroundColor: themCellBg }]}>
                <X size={14} color={mutedIconColor} strokeWidth={2.4} />
                <Text style={[styles.compareValue, { color: textSecondary, fontSize: isMobile ? 11.5 : 13 }]}>{row.them}</Text>
              </View>
              <View style={[styles.compareCol, styles.compareColUs, isMobile && { flex: 1, paddingHorizontal: 8, gap: 4 }, { backgroundColor: usCellBg }]}>
                <Check size={14} color={AZURE_DEEP} strokeWidth={2.6} />
                <Text style={[styles.compareValue, styles.compareValueUs, { color: textPrimary, fontSize: isMobile ? 11.5 : 13 }]}>{row.us}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* --- STATS GRANDES --- */}
        <View style={[styles.statsRow, { flexDirection: isMobile ? "column" : "row" }]}>
          {STATS.map((s) => (
            <View key={s.label} style={styles.statItem}>
              <Text style={[styles.statValue, { color: AZURE_DEEP, fontSize: isMobile ? 40 : 56 }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: textSecondary }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* --- CTA --- */}
        <View style={[styles.ctaRow, { justifyContent: "center" }]}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={talkSales}
            style={[
              styles.ctaBtnPrimary,
              { flexDirection: "row", gap: 10, backgroundColor: AZURE_DEEP, width: isMobile ? "100%" : "auto" },
              isWeb && ({ transitionProperty: "transform", transitionDuration: "0.2s", transform: [{ translateY: hoverSales ? -3 : 0 }] } as any),
            ]}
            {...(isWeb ? ({ onMouseEnter: () => setHoverSales(true), onMouseLeave: () => setHoverSales(false) } as any) : {})}
          >
            <Server size={18} color="#FFFFFF" strokeWidth={2.2} />
            <Text style={styles.ctaPrimaryText}>Quiero self-hosting para mi empresa</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", alignItems: "center" },
  container: { width: "100%", alignSelf: "center" },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1,
  },
  badgeText: { color: "#2C7BD1", fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  title: { fontWeight: "700", textAlign: "center", letterSpacing: -1.5, alignSelf: "center" },
  sub: { textAlign: "center", lineHeight: 30, maxWidth: 760, alignSelf: "center", fontWeight: "400" },

  compareCard: { borderRadius: 24, overflow: "hidden", marginBottom: 48 },
  compareRow: { flexDirection: "row", alignItems: "stretch" },
  compareHead: { paddingTop: 18, paddingBottom: 10 },
  compareHeadText: { fontSize: 13, fontWeight: "700", textAlign: "center", textTransform: "uppercase", letterSpacing: 0.4 },
  compareLabelCol: { flex: 1.1, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 16 },
  compareLabel: { fontSize: 14, fontWeight: "600" },
  compareCol: { flex: 1.3, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 16 },
  compareColUs: {},
  compareValue: { fontSize: 13, flexShrink: 1, lineHeight: 18 },
  compareValueUs: { fontWeight: "700" },

  statsRow: { gap: 24, justifyContent: "center", marginBottom: 48 },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontWeight: "800", letterSpacing: -1 },
  statLabel: { fontSize: 14, fontWeight: "500", textAlign: "center", marginTop: 4, maxWidth: 220 },

  ctaRow: { gap: 16, justifyContent: "center", alignItems: "center" },
  ctaBtnPrimary: {
    borderRadius: 999, paddingVertical: 18, paddingHorizontal: 32, alignItems: "center", justifyContent: "center",
    shadowColor: AZURE_DEEP, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 8,
  },
  ctaPrimaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
