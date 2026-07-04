import React, { useEffect, useState } from "react";
import {
  Image,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { ArrowRight, Briefcase, Check, ChevronDown, Clock, Globe, Palette, Plus, Sparkles, User, X } from "lucide-react-native";
import ColorPickerModal from "./ColorPickerModal";
import AvatarUploadZone from "./AvatarUploadZone";
import TimezoneModal from "./TimezoneModal";
import LanguageModal from "./LanguageModal";
import LevelDots from "./LevelDots";
import {
  AVATAR_TILE_SIZE,
  BIO_MAX_LENGTH,
  CUSTOM_ROLE_VALUE,
  DEFAULT_AVATAR_PREFIX,
  DEFAULT_AVATARS,
  DEFAULT_LANGUAGE_LEVEL,
  DEFAULT_SKILL_LEVEL,
  LANGUAGE_LEVELS,
  ROLE_OPTIONS,
  detectDeviceTimezone,
  getContrastTextColor,
  getProfile,
  getTimezoneLabel,
  isUploadedAvatar,
  updateProfile,
  uploadAvatarFile,
} from "../lib/profiles";

const CARD_COLORS = ["#2C7BD1", "#7C3AED", "#10B981", "#F59E0B", "#EF4444", "#EC4899"];

type Props = {
  isDark: boolean;
  userId: string;
  displayName: string;
  submitLabel: string;
  onSaved: () => void;
  onCancel?: () => void;
};

export default function ProfileEditorForm({ isDark, userId, displayName, submitLabel, onSaved, onCancel }: Props) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isWeb = Platform.OS === "web";

  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | null>(null);
  const [avatarColor, setAvatarColor] = useState(CARD_COLORS[0]);
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [timezone, setTimezone] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [customRole, setCustomRole] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillLevels, setSkillLevels] = useState<Record<string, number>>({});
  const [skillInput, setSkillInput] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [languageLevels, setLanguageLevels] = useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showTimezoneModal, setShowTimezoneModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await getProfile(userId);
      if (!data) return;
      setAvatarColor(data.avatar_color ?? CARD_COLORS[0]);
      setNickname(data.nickname ?? "");
      setBio(data.bio ?? "");
      setTimezone(data.timezone ?? detectDeviceTimezone());
      setRole(data.role ?? null);
      setCustomRole(data.custom_role ?? "");
      setSkills(data.skills ?? []);
      setSkillLevels(data.skill_levels ?? {});
      setLanguages(data.languages ?? []);
      setLanguageLevels(data.language_levels ?? {});
      if (data.avatar_url) {
        if (isUploadedAvatar(data.avatar_url)) setUploadedAvatarUrl(data.avatar_url);
        else setSelectedAvatarId(data.avatar_url.slice(DEFAULT_AVATAR_PREFIX.length));
      }
    })();
  }, [userId]);

  const cardBg        = isDark ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.85)";
  const border        = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary   = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  // El acento de este formulario sigue el color de card que elige el usuario
  // (no afecta al resto de la app, que sigue usando el azure de marca fijo).
  const primaryColor  = avatarColor;
  const inputBg       = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";

  const ultraShadow = {
    ...Platform.select({
      web: {
        boxShadow: isDark
          ? "0 30px 60px -25px rgba(0,0,0,0.65), 0 1px 0 rgba(255,255,255,0.08) inset"
          : "0 30px 60px -22px rgba(44,123,209,0.18), 0 1px 0 rgba(255,255,255,0.9) inset",
        backdropFilter: "blur(32px) saturate(200%)",
      } as any,
      default: {
        shadowColor: isDark ? "#000" : "#2C7BD1",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: isDark ? 0.35 : 0.1,
        shadowRadius: 22,
        elevation: 6,
      },
    }),
    borderTopColor: isDark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.9)",
  };

  const previewSource = uploadedAvatarUrl
    ? { uri: uploadedAvatarUrl }
    : selectedAvatarId
    ? DEFAULT_AVATARS.find((a) => a.id === selectedAvatarId)?.source
    : null;

  const roleLabel = role === CUSTOM_ROLE_VALUE ? customRole.trim() || CUSTOM_ROLE_VALUE : role;
  const previewName = nickname.trim() || displayName;
  const previewTextColor = getContrastTextColor(avatarColor);
  const previewSubTextColor = previewTextColor === "#FFFFFF" ? "rgba(255,255,255,0.8)" : "rgba(15,23,42,0.65)";

  const handleSelectDefault = (id: string) => {
    setSelectedAvatarId(id);
    setUploadedAvatarUrl(null);
  };

  const handleFileReady = async (data: ArrayBuffer | File, contentType: string, ext: string) => {
    setErrorMsg(null);
    setUploading(true);
    const { url, error } = await uploadAvatarFile(userId, data, contentType, ext);
    setUploading(false);
    if (error || !url) {
      setErrorMsg(error?.message ? `No pudimos subir tu foto: ${error.message}` : "No pudimos subir tu foto, intenta de nuevo.");
      return;
    }
    setUploadedAvatarUrl(url);
    setSelectedAvatarId(null);
  };

  const addSkill = () => {
    const value = skillInput.trim();
    if (!value) return;
    if (skills.some((s) => s.toLowerCase() === value.toLowerCase())) {
      setSkillInput("");
      return;
    }
    setSkills([...skills, value]);
    setSkillLevels({ ...skillLevels, [value]: DEFAULT_SKILL_LEVEL });
    setSkillInput("");
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
    const nextLevels = { ...skillLevels };
    delete nextLevels[skill];
    setSkillLevels(nextLevels);
  };

  const setSkillLevel = (skill: string, level: number) => {
    setSkillLevels({ ...skillLevels, [skill]: level });
  };

  const toggleLanguage = (lang: string) => {
    if (languages.includes(lang)) {
      setLanguages(languages.filter((l) => l !== lang));
      const nextLevels = { ...languageLevels };
      delete nextLevels[lang];
      setLanguageLevels(nextLevels);
    } else {
      setLanguages([...languages, lang]);
      setLanguageLevels({ ...languageLevels, [lang]: DEFAULT_LANGUAGE_LEVEL });
    }
  };

  const setLanguageLevel = (lang: string, level: string) => {
    setLanguageLevels({ ...languageLevels, [lang]: level });
  };

  const handleSave = async () => {
    setErrorMsg(null);
    setSaving(true);

    const avatarUrl = uploadedAvatarUrl
      ? uploadedAvatarUrl
      : selectedAvatarId
      ? `${DEFAULT_AVATAR_PREFIX}${selectedAvatarId}`
      : null;

    const { error } = await updateProfile(userId, {
      avatar_url: avatarUrl,
      avatar_color: avatarColor,
      nickname: nickname.trim() || null,
      bio: bio.trim() || null,
      timezone,
      role,
      custom_role: role === CUSTOM_ROLE_VALUE ? customRole.trim() || null : null,
      skills,
      skill_levels: skillLevels,
      languages,
      language_levels: languageLevels,
    });

    setSaving(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    onSaved();
  };

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }, ultraShadow]}>
      <View style={[styles.previewRow, { backgroundColor: avatarColor }]}>
        <View style={[styles.previewAvatar, { backgroundColor: "rgba(255,255,255,0.22)", borderColor: "rgba(255,255,255,0.5)" }]}>
          {previewSource ? (
            <Image source={previewSource} style={styles.previewAvatarImage} />
          ) : (
            <User size={26} color={previewTextColor} strokeWidth={2.2} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.previewName, { color: previewTextColor }]} numberOfLines={1}>
            {previewName || "Tu perfil"}
          </Text>
          <Text style={[styles.previewRoleText, { color: previewSubTextColor }]} numberOfLines={1}>
            {roleLabel || "Sin rol asignado todavía"}
          </Text>
        </View>
      </View>

      <Text style={[styles.label, { color: textSecondary }]}>¿Cómo quieres que te llamen?</Text>
      <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: focusedField === "nickname" ? primaryColor : border }]}>
        <User size={18} color={textSecondary} strokeWidth={2.2} />
        <TextInput
          placeholder={displayName ? `Ej. ${displayName.split(" ")[0]}, o el mote que prefieras` : "Tu mote o apodo"}
          placeholderTextColor={textSecondary}
          value={nickname}
          onChangeText={setNickname}
          onFocus={() => setFocusedField("nickname")}
          onBlur={() => setFocusedField(null)}
          style={[styles.input, { color: textPrimary }, isWeb && styles.inputNoOutline]}
        />
      </View>

      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: textSecondary, marginBottom: 0 }]}>Bio corta</Text>
        <Text style={[styles.charCount, { color: textSecondary }]}>
          {bio.length}/{BIO_MAX_LENGTH}
        </Text>
      </View>
      <View style={[styles.textAreaWrapper, { backgroundColor: inputBg, borderColor: focusedField === "bio" ? primaryColor : border }]}>
        <TextInput
          placeholder="Cuéntale a tu equipo quién eres, en una línea"
          placeholderTextColor={textSecondary}
          value={bio}
          onChangeText={(v) => setBio(v.slice(0, BIO_MAX_LENGTH))}
          onFocus={() => setFocusedField("bio")}
          onBlur={() => setFocusedField(null)}
          multiline
          maxLength={BIO_MAX_LENGTH}
          style={[styles.textArea, { color: textPrimary }, isWeb && styles.inputNoOutline]}
        />
      </View>

      <Text style={[styles.label, { color: textSecondary }]}>Foto de perfil</Text>
      <View style={styles.avatarGrid}>
        {DEFAULT_AVATARS.map((avatar) => (
          <TouchableOpacity
            key={avatar.id}
            activeOpacity={0.85}
            onPress={() => handleSelectDefault(avatar.id)}
            style={[
              styles.avatarTile,
              { borderColor: selectedAvatarId === avatar.id ? primaryColor : border },
            ]}
          >
            <Image source={avatar.source} style={styles.avatarImage} />
            {selectedAvatarId === avatar.id && (
              <View style={[styles.checkBadge, { backgroundColor: primaryColor }]}>
                <Check size={12} color={previewTextColor} strokeWidth={2.3} />
              </View>
            )}
          </TouchableOpacity>
        ))}
        <AvatarUploadZone
          isDark={isDark}
          primaryColor={primaryColor}
          uploading={uploading}
          onFileReady={handleFileReady as any}
          onError={setErrorMsg}
        />
      </View>

      <Text style={[styles.label, { color: textSecondary }]}>Color de tu card</Text>
      <View style={styles.colorRow}>
        {CARD_COLORS.map((c) => (
          <TouchableOpacity key={c} activeOpacity={0.8} onPress={() => setAvatarColor(c)} style={[styles.colorSwatch, { backgroundColor: c }]}>
            {avatarColor === c && <Check size={16} color={getContrastTextColor(c)} strokeWidth={2.3} />}
          </TouchableOpacity>
        ))}
        {!CARD_COLORS.includes(avatarColor) && (
          <View style={[styles.colorSwatch, { backgroundColor: avatarColor, borderWidth: 2, borderColor: isDark ? "#F8FAFC" : "#FFFFFF" }]}>
            <Check size={16} color={previewTextColor} strokeWidth={2.3} />
          </View>
        )}
      </View>
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.customColorBtn, { borderColor: border, backgroundColor: inputBg }]}
        onPress={() => setShowColorPicker(true)}
      >
        <Palette size={16} color={primaryColor} strokeWidth={2.2} />
        <Text style={[styles.customColorText, { color: textPrimary }]}>Personalizar color</Text>
      </TouchableOpacity>

      <Text style={[styles.label, { color: textSecondary }]}>Zona horaria</Text>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setShowTimezoneModal(true)}
        style={[styles.selectorBtn, { backgroundColor: inputBg, borderColor: border }]}
      >
        <Clock size={18} color={textSecondary} strokeWidth={2.2} />
        <Text style={[styles.selectorText, { color: timezone ? textPrimary : textSecondary }]} numberOfLines={1}>
          {getTimezoneLabel(timezone) ?? "Selecciona tu zona horaria"}
        </Text>
        <ChevronDown size={18} color={textSecondary} strokeWidth={2.2} />
      </TouchableOpacity>

      <Text style={[styles.label, { color: textSecondary }]}>Tu rol</Text>
      <View style={styles.chipsRow}>
        {ROLE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt}
            activeOpacity={0.85}
            onPress={() => setRole(opt)}
            style={[
              styles.chip,
              { borderColor: role === opt ? primaryColor : border, backgroundColor: role === opt ? primaryColor : inputBg },
            ]}
          >
            <Text style={[styles.chipText, { color: role === opt ? previewTextColor : textPrimary }]}>{opt}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setRole(CUSTOM_ROLE_VALUE)}
          style={[
            styles.chip,
            { borderColor: role === CUSTOM_ROLE_VALUE ? primaryColor : border, backgroundColor: role === CUSTOM_ROLE_VALUE ? primaryColor : inputBg },
          ]}
        >
          <Text style={[styles.chipText, { color: role === CUSTOM_ROLE_VALUE ? previewTextColor : textPrimary }]}>Otro</Text>
        </TouchableOpacity>
      </View>

      {role === CUSTOM_ROLE_VALUE && (
        <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: focusedField === "customRole" ? primaryColor : border, marginTop: 4 }]}>
          <Briefcase size={18} color={textSecondary} strokeWidth={2.2} />
          <TextInput
            placeholder="Escribe tu cargo"
            placeholderTextColor={textSecondary}
            value={customRole}
            onChangeText={setCustomRole}
            onSubmitEditing={() => Keyboard.dismiss()}
            onFocus={() => setFocusedField("customRole")}
            onBlur={() => setFocusedField(null)}
            style={[styles.input, { color: textPrimary }, isWeb && styles.inputNoOutline]}
          />
          <TouchableOpacity onPress={() => Keyboard.dismiss()} hitSlop={8}>
            <Check size={18} color={primaryColor} strokeWidth={2.3} />
          </TouchableOpacity>
        </View>
      )}

      <Text style={[styles.label, { color: textSecondary, marginTop: 4 }]}>Idiomas que hablas</Text>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setShowLanguageModal(true)}
        style={[styles.selectorBtn, { backgroundColor: inputBg, borderColor: border, marginBottom: languages.length > 0 ? 12 : 24 }]}
      >
        <Globe size={18} color={textSecondary} strokeWidth={2.2} />
        <Text style={[styles.selectorText, { color: languages.length ? textPrimary : textSecondary }]} numberOfLines={1}>
          {languages.length ? languages.join(", ") : "Selecciona los idiomas que hablas"}
        </Text>
        <ChevronDown size={18} color={textSecondary} strokeWidth={2.2} />
      </TouchableOpacity>

      {languages.length > 0 && (
        <View style={{ marginTop: 4, marginBottom: 20, gap: 8 }}>
          {languages.map((lang) => {
            const level = languageLevels[lang] ?? DEFAULT_LANGUAGE_LEVEL;
            return (
              <View key={lang} style={[styles.skillRow, isMobile && styles.skillRowMobile, { backgroundColor: inputBg, borderColor: border }]}>
                <Text style={[styles.skillName, { color: textPrimary }]} numberOfLines={1}>
                  {lang}
                </Text>
                <View style={[styles.skillControls, isMobile && styles.skillControlsMobile]}>
                  <View style={styles.levelSegments}>
                    {LANGUAGE_LEVELS.map((lvl) => {
                      const active = lvl === level;
                      return (
                        <TouchableOpacity
                          key={lvl}
                          activeOpacity={0.8}
                          onPress={() => setLanguageLevel(lang, lvl)}
                          style={[
                            styles.levelSegment,
                            { borderColor: active ? primaryColor : border, backgroundColor: active ? primaryColor : "transparent" },
                          ]}
                        >
                          <Text style={[styles.levelSegmentText, { color: active ? previewTextColor : textSecondary }]}>{lvl}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <TouchableOpacity onPress={() => toggleLanguage(lang)} hitSlop={8}>
                    <X size={14} color={textSecondary} strokeWidth={2.2} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Text style={[styles.label, { color: textSecondary, marginTop: 4 }]}>Habilidades</Text>
      <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: focusedField === "skill" ? primaryColor : border }]}>
        <Sparkles size={18} color={textSecondary} strokeWidth={2.2} />
        <TextInput
          placeholder="Ej. Figma, React, Copywriting"
          placeholderTextColor={textSecondary}
          value={skillInput}
          onChangeText={setSkillInput}
          onSubmitEditing={addSkill}
          onFocus={() => setFocusedField("skill")}
          onBlur={() => setFocusedField(null)}
          style={[styles.input, { color: textPrimary }, isWeb && styles.inputNoOutline]}
        />
        <TouchableOpacity onPress={addSkill} hitSlop={8}>
          <Plus size={20} color={primaryColor} strokeWidth={2.3} />
        </TouchableOpacity>
      </View>

      {skills.length > 0 && (
        <View style={{ marginTop: 12, marginBottom: 24, gap: 8 }}>
          {skills.map((skill) => {
            const level = skillLevels[skill] ?? DEFAULT_SKILL_LEVEL;
            return (
              <View key={skill} style={[styles.skillRow, isMobile && styles.skillRowMobile, { backgroundColor: inputBg, borderColor: border }]}>
                <Text style={[styles.skillName, { color: textPrimary }]} numberOfLines={1}>
                  {skill}
                </Text>
                <View style={[styles.skillControls, isMobile && styles.skillControlsMobile]}>
                  <LevelDots
                    value={level}
                    activeColor={primaryColor}
                    trackColor={border}
                    onChange={(next) => setSkillLevel(skill, next)}
                  />
                  <TouchableOpacity onPress={() => removeSkill(skill)} hitSlop={8}>
                    <X size={14} color={textSecondary} strokeWidth={2.2} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

      <View style={styles.actionsRow}>
        {onCancel && (
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={saving}
            style={[styles.btnSecondary, { borderColor: border }]}
            onPress={onCancel}
          >
            <Text style={[styles.btnSecondaryText, { color: textPrimary }]}>Cancelar</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={saving || uploading}
          style={[styles.btnPrimary, { backgroundColor: primaryColor, shadowColor: primaryColor, opacity: saving || uploading ? 0.7 : 1, flex: onCancel ? 1.6 : 1 }]}
          onPress={handleSave}
        >
          <Text style={[styles.btnPrimaryText, { color: previewTextColor }]}>{saving ? "Guardando…" : submitLabel}</Text>
          {!saving && <ArrowRight size={18} color={previewTextColor} strokeWidth={2.2} />}
        </TouchableOpacity>
      </View>

      <ColorPickerModal
        visible={showColorPicker}
        initialColor={avatarColor}
        isDark={isDark}
        onClose={() => setShowColorPicker(false)}
        onConfirm={(hex) => {
          setAvatarColor(hex);
          setShowColorPicker(false);
        }}
      />

      <TimezoneModal
        visible={showTimezoneModal}
        isDark={isDark}
        selectedId={timezone}
        onClose={() => setShowTimezoneModal(false)}
        onSelect={(id) => {
          setTimezone(id);
          setShowTimezoneModal(false);
        }}
      />

      <LanguageModal
        visible={showLanguageModal}
        isDark={isDark}
        selected={languages}
        onClose={() => setShowLanguageModal(false)}
        onToggle={toggleLanguage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 28, borderWidth: 1, padding: 28 },
  previewRow: {
    flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 28, borderRadius: 20, padding: 18,
  },
  previewAvatar: {
    width: 64, height: 64, borderRadius: 18, justifyContent: "center", alignItems: "center", overflow: "hidden", borderWidth: 2,
  },
  previewAvatarImage: { width: 74, height: 74, resizeMode: "cover" },
  previewName: { fontSize: 18, fontWeight: "700" },
  previewRoleText: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  label: { fontSize: 13, fontWeight: "700", marginBottom: 10 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  charCount: { fontSize: 11, fontWeight: "600" },
  textAreaWrapper: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 24 },
  textArea: { minHeight: 56, fontSize: 15, textAlignVertical: "top" },
  selectorBtn: {
    flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 16, marginBottom: 24,
  },
  selectorText: { flex: 1, fontSize: 15 },
  skillRow: {
    flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  skillRowMobile: { flexDirection: "column", alignItems: "stretch", gap: 10 },
  skillName: { flexShrink: 1, flexGrow: 1, fontSize: 13, fontWeight: "700" },
  skillControls: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 0 },
  skillControlsMobile: { justifyContent: "space-between" },
  levelSegments: { flexDirection: "row", gap: 4, flexShrink: 0 },
  levelSegment: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4 },
  levelSegmentText: { fontSize: 10, fontWeight: "700" },
  avatarGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  avatarTile: {
    width: AVATAR_TILE_SIZE, height: AVATAR_TILE_SIZE, borderRadius: 20, borderWidth: 2,
    overflow: "hidden", justifyContent: "center", alignItems: "center",
  },
  avatarImage: { width: AVATAR_TILE_SIZE + 8, height: AVATAR_TILE_SIZE + 8, resizeMode: "cover" },
  checkBadge: {
    position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 10,
    justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#FFF",
  },
  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  colorSwatch: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  customColorBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1, borderRadius: 16, paddingVertical: 12, marginBottom: 24,
  },
  customColorText: { fontWeight: "700", fontSize: 14 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16 },
  chipText: { fontSize: 13, fontWeight: "700" },
  inputWrapper: {
    flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, marginBottom: 20,
  },
  input: { flex: 1, paddingVertical: 16, fontSize: 15 },
  inputNoOutline: { outlineStyle: "none" } as any,
  errorText: { color: "#EF4444", fontSize: 13, fontWeight: "600", marginBottom: 14 },
  actionsRow: { flexDirection: "row", gap: 12 },
  btnPrimary: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 999,
    paddingVertical: 18, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 8,
  },
  btnPrimaryText: { fontWeight: "700", fontSize: 16, letterSpacing: 0.3 },
  btnSecondary: { flex: 1, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingVertical: 18 },
  btnSecondaryText: { fontWeight: "700", fontSize: 15 },
});
