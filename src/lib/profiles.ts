import { supabase } from "./supabase";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  avatar_color: string;
  nickname: string | null;
  bio: string | null;
  timezone: string | null;
  role: string | null;
  custom_role: string | null;
  skills: string[];
  skill_levels: Record<string, number>;
  languages: string[];
  language_levels: Record<string, string>;
  badges: Badge[];
};

// Los badges no son editables por el usuario todavía — quién los otorga
// (team leaders/admins) es trabajo pendiente. Por ahora solo se muestran.
export type Badge = {
  id: string;
  name: string;
  color: string;
};

export const AVATAR_TILE_SIZE = 84;

export const DEFAULT_AVATAR_PREFIX = "default:";

export const DEFAULT_AVATARS = [
  { id: "01_human_resources.png", source: require("../../assets/images/avatares/01_human_resources.png") },
  { id: "02_software_developer.png", source: require("../../assets/images/avatares/02_software_developer.png") },
  { id: "03_marketing_specialist.png", source: require("../../assets/images/avatares/03_marketing_specialist.png") },
  { id: "04_data_analyst.png", source: require("../../assets/images/avatares/04_data_analyst.png") },
  { id: "05_project_manager.png", source: require("../../assets/images/avatares/05_project_manager.png") },
  { id: "06_graphic_designer.png", source: require("../../assets/images/avatares/06_graphic_designer.png") },
  { id: "07_accountant.png", source: require("../../assets/images/avatares/07_accountant.png") },
  { id: "08_executive_assistant.png", source: require("../../assets/images/avatares/08_executive_assistant.png") },
];

export const ROLE_OPTIONS = [
  "Desarrollador/a",
  "Diseñador/a",
  "Product Manager",
  "Recursos Humanos",
  "Marketing",
  "Ventas",
  "Atención al Cliente",
  "Finanzas",
  "Operaciones",
  "Legal",
];

export const CUSTOM_ROLE_VALUE = "Otro";

export function getContrastTextColor(hex: string) {
  const clean = hex.replace("#", "");
  if (!/^[0-9A-Fa-f]{6}$/.test(clean)) return "#0F172A";
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0F172A" : "#FFFFFF";
}

export const BIO_MAX_LENGTH = 160;

export const DEFAULT_SKILL_LEVEL = 5;

export const LANGUAGE_OPTIONS = [
  "Español",
  "Inglés",
  "Portugués",
  "Francés",
  "Alemán",
  "Italiano",
  "Mandarín",
  "Japonés",
  "Coreano",
  "Árabe",
];

export const LANGUAGE_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export const DEFAULT_LANGUAGE_LEVEL = "A1";

// Cobertura curada de husos horarios (no es la lista IANA completa),
// ordenada por offset para que el modal de selección sea corto y usable.
export const TIMEZONE_OPTIONS = [
  { id: "Pacific/Midway", label: "Midway, Samoa", offset: "UTC-11" },
  { id: "Pacific/Honolulu", label: "Honolulu", offset: "UTC-10" },
  { id: "America/Anchorage", label: "Anchorage", offset: "UTC-9" },
  { id: "America/Tijuana", label: "Tijuana, Los Ángeles, Vancouver", offset: "UTC-8" },
  { id: "America/Denver", label: "Denver, Phoenix", offset: "UTC-7" },
  { id: "America/Mexico_City", label: "Ciudad de México, Guatemala, San José", offset: "UTC-6" },
  { id: "America/Chicago", label: "Chicago, Winnipeg", offset: "UTC-6" },
  { id: "America/Bogota", label: "Bogotá, Lima, Quito", offset: "UTC-5" },
  { id: "America/New_York", label: "Nueva York, Toronto, Miami", offset: "UTC-5" },
  { id: "America/Caracas", label: "Caracas", offset: "UTC-4" },
  { id: "America/Santiago", label: "Santiago de Chile", offset: "UTC-4" },
  { id: "America/La_Paz", label: "La Paz", offset: "UTC-4" },
  { id: "America/Halifax", label: "Halifax", offset: "UTC-4" },
  { id: "America/Sao_Paulo", label: "São Paulo, Buenos Aires, Montevideo", offset: "UTC-3" },
  { id: "Atlantic/South_Georgia", label: "Georgia del Sur", offset: "UTC-2" },
  { id: "Atlantic/Azores", label: "Azores", offset: "UTC-1" },
  { id: "Europe/London", label: "Londres, Lisboa, Dakar", offset: "UTC+0" },
  { id: "Europe/Madrid", label: "Madrid, París, Berlín, Roma", offset: "UTC+1" },
  { id: "Europe/Athens", label: "Atenas, Helsinki, Bucarest", offset: "UTC+2" },
  { id: "Europe/Moscow", label: "Moscú, Estambul, Nairobi", offset: "UTC+3" },
  { id: "Asia/Dubai", label: "Dubái, Abu Dabi", offset: "UTC+4" },
  { id: "Asia/Karachi", label: "Karachi, Islamabad", offset: "UTC+5" },
  { id: "Asia/Kolkata", label: "Nueva Delhi, Bombay", offset: "UTC+5:30" },
  { id: "Asia/Dhaka", label: "Dhaka", offset: "UTC+6" },
  { id: "Asia/Bangkok", label: "Bangkok, Yakarta", offset: "UTC+7" },
  { id: "Asia/Shanghai", label: "Pekín, Shanghái, Singapur", offset: "UTC+8" },
  { id: "Asia/Tokyo", label: "Tokio, Seúl", offset: "UTC+9" },
  { id: "Australia/Sydney", label: "Sídney, Melbourne", offset: "UTC+10" },
  { id: "Pacific/Auckland", label: "Auckland, Fiyi", offset: "UTC+12" },
];

export function getTimezoneLabel(timezone: string | null) {
  if (!timezone) return null;
  const match = TIMEZONE_OPTIONS.find((tz) => tz.id === timezone);
  return match ? `${match.label} (${match.offset})` : timezone;
}

export function detectDeviceTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

export function getDefaultAvatarSource(avatarUrl: string | null) {
  if (!avatarUrl || !avatarUrl.startsWith(DEFAULT_AVATAR_PREFIX)) return null;
  const id = avatarUrl.slice(DEFAULT_AVATAR_PREFIX.length);
  return DEFAULT_AVATARS.find((a) => a.id === id)?.source ?? null;
}

export function isUploadedAvatar(avatarUrl: string | null) {
  return !!avatarUrl && !avatarUrl.startsWith(DEFAULT_AVATAR_PREFIX);
}

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, avatar_url, avatar_color, nickname, bio, timezone, role, custom_role, skills, skill_levels, languages, language_levels, badges"
    )
    .eq("id", userId)
    .maybeSingle();

  return { data: data as Profile | null, error };
}

export async function updateProfile(
  userId: string,
  updates: Partial<
    Pick<
      Profile,
      | "avatar_url"
      | "avatar_color"
      | "nickname"
      | "bio"
      | "timezone"
      | "role"
      | "custom_role"
      | "skills"
      | "skill_levels"
      | "languages"
      | "language_levels"
    >
  >
) {
  const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
  return { error };
}

export async function uploadAvatarFile(
  userId: string,
  data: ArrayBuffer | File,
  contentType: string,
  ext: string
) {
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, data, {
    contentType,
    upsert: true,
  });

  if (error) return { url: null, error };

  const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
  return { url: publicUrlData.publicUrl, error: null };
}
