import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Clock, Crown, Flame, GraduationCap, Lightbulb, LucideIcon, MessageCircle, Puzzle, ShieldCheck, Target, Users } from "lucide-react-native";
import { BadgeDefinition } from "../lib/badges";
import { getContrastTextColor } from "../lib/profiles";

// Nombre de ícono (string, ver BadgeDefinition.icon) -> componente real.
// Vive acá (no en lib/badges.ts, que es lógica pura sin componentes de React)
// y se reusa desde BadgeAwardModal para no duplicar el mapa dos veces.
export const BADGE_ICONS: Record<string, LucideIcon> = {
  Crown,
  Users,
  GraduationCap,
  ShieldCheck,
  MessageCircle,
  Puzzle,
  Lightbulb,
  Clock,
  Flame,
  Target,
};

type Props = {
  badge: BadgeDefinition;
  size?: "sm" | "md";
  onPress?: () => void;
};

// Pill minimalista (ícono + nombre, coloreado con el color del badge) —
// mismo lenguaje visual que los chips de habilidades/idiomas del perfil, para
// que se vea consistente en ProfileScreen, MemberProfileModal y BadgesScreen.
// Con `onPress` se vuelve tocable (usado para abrir el detalle de quién lo
// otorgó y cuándo, ver BadgeDetailModal) — sin él es un chip de solo lectura.
export default function BadgePill({ badge, size = "md", onPress }: Props) {
  const Icon = BADGE_ICONS[badge.icon] ?? Users;
  const textColor = getContrastTextColor(badge.color);
  const isSmall = size === "sm";
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      activeOpacity={onPress ? 0.8 : undefined}
      onPress={onPress}
      style={[styles.pill, isSmall && styles.pillSm, { backgroundColor: badge.color }]}
    >
      <Icon size={isSmall ? 12 : 14} color={textColor} strokeWidth={2.2} />
      <Text style={[styles.text, isSmall && styles.textSm, { color: textColor }]}>{badge.label}</Text>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  pillSm: { paddingHorizontal: 10, paddingVertical: 6, gap: 5 },
  text: { fontSize: 12.5, fontWeight: "600" },
  textSm: { fontSize: 11.5 },
});
