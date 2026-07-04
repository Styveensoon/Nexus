import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, Easing, Platform } from "react-native";
import {
  Hexagon,
  Triangle,
  Compass,
  Feather,
  Aperture,
  Gem,
  Orbit,
  Atom,
} from "lucide-react-native";

interface LogoCarouselProps {
  isDark: boolean;
  isMobile: boolean;
}

// Marcas, logos y frases de ejemplo, no clientes reales — Nexus todavía no tiene clientes
// que mostrar (ver docs/ESTADO.md), esta franja es puramente decorativa ("para que sea lindo").
// Cada marca inventada lleva nombre + una micro-frase de marketing + su propio ícono/color
// (como un logotipo real tendría), en vez de un simple texto plano.
const MARK_COLORS = ["#2C7BD1", "#0EA5A5", "#64748B", "#3B82F6"];
const PLACEHOLDER_BRANDS = [
  { name: "Northwind",     tagline: "Ahora gestiona todo diferente", icon: Hexagon },
  { name: "Vertex Labs",   tagline: "Cero caos, pura ejecución",      icon: Triangle },
  { name: "Orbital",       tagline: "Equipos alineados, siempre",     icon: Orbit },
  { name: "Atlas & Co.",   tagline: "Del caos al control total",      icon: Compass },
  { name: "Lumen Systems", tagline: "Menos reuniones, más resultados", icon: Feather },
  { name: "Quanta Group",  tagline: "Su IA, a su ritmo",               icon: Atom },
  { name: "Meridian",      tagline: "Todo el equipo, un solo lugar",   icon: Aperture },
  { name: "Solstice",      tagline: "Proyectos que sí se cumplen",     icon: Gem },
];

export default function LogoCarousel({ isDark, isMobile }: LogoCarouselProps) {
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const logoTextColor = isDark ? "rgba(248,250,252,0.85)" : "rgba(16,24,40,0.75)";
  const taglineColor  = isDark ? "rgba(148,163,184,0.85)" : "rgba(91,100,114,0.85)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const cardBg        = isDark ? "rgba(17, 24, 39, 0.5)" : "rgba(255, 255, 255, 0.65)";
  const bg            = isDark ? "#0E1626" : "#EAF1FA";

  const [setWidth, setSetWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const measuredRef = useRef(false);

  useEffect(() => {
    if (!setWidth) return;
    translateX.setValue(0);
    const loop = Animated.loop(
      Animated.timing(translateX, {
        toValue: -setWidth,
        duration: setWidth * 45,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== "web",
      })
    );
    loop.start();
    return () => loop.stop();
  }, [setWidth]);

  const renderSet = (measure: boolean) => (
    <View
      style={styles.set}
      onLayout={measure ? (e) => {
        if (measuredRef.current) return;
        measuredRef.current = true;
        setSetWidth(e.nativeEvent.layout.width);
      } : undefined}
    >
      {PLACEHOLDER_BRANDS.map((brand, i) => {
        const color = MARK_COLORS[i % MARK_COLORS.length];
        return (
          <View key={`${brand.name}-${i}`} style={[styles.logoCard, { borderColor: border, backgroundColor: cardBg }]}>
            <Text style={[styles.logoText, { color: logoTextColor }]}>{brand.name}</Text>
            <Text style={[styles.tagline, { color: taglineColor }]}>{brand.tagline}</Text>
            <View style={[styles.mark, { backgroundColor: `${color}1F` }]}>
              <brand.icon size={22} color={color} strokeWidth={2.2} />
            </View>
          </View>
        );
      })}
    </View>
  );

  return (
    <View style={[styles.wrap, { backgroundColor: bg, paddingVertical: isMobile ? 32 : 56 }]}>
      <Text style={[styles.caption, { color: textSecondary }]}>Equipos que ya construyen con Nexus</Text>
      <View style={styles.mask}>
        <Animated.View style={[styles.track, { transform: [{ translateX }] }]}>
          {renderSet(true)}
          {renderSet(false)}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", alignItems: "center" },
  caption: { fontSize: 13, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase", marginBottom: 28, textAlign: "center" },
  mask: { width: "100%", overflow: "hidden" },
  track: { flexDirection: "row" },
  set: { flexDirection: "row" },
  logoCard: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    width: 224,
    minHeight: 176,
    borderWidth: 1,
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginRight: 20,
  },
  mark: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  logoText: { fontSize: 22, fontWeight: "800", letterSpacing: 0.1, textAlign: "center" },
  tagline: { fontSize: 14, fontWeight: "500", textAlign: "center", lineHeight: 20 },
});
