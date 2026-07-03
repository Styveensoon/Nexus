import React, { useState } from "react";
import { Image, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Check, ChevronRight, Palette, X } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import ColorPickerModal from "./ColorPickerModal";
import AvatarUploadZone from "./AvatarUploadZone";
import { uploadIconFile } from "../lib/icons";
import { AVATAR_TILE_SIZE } from "../lib/profiles";

type Props = {
  isDark: boolean;
  userId: string;
  color: string;
  onColorChange: (hex: string) => void;
  iconUrl: string | null;
  onIconChange: (url: string | null) => void;
  fallbackIcon: LucideIcon;
};

// Mismo tamaño que AvatarUploadZone (84) para que el preview y el dropzone
// queden alineados uno al lado del otro en vez de un icono chico apachurrado
// contra una columna angosta.
const TILE_SIZE = AVATAR_TILE_SIZE;

const PRESET_COLORS = ["#2C7BD1", "#7C3AED", "#10B981", "#F59E0B", "#EF4444"];

export default function IconColorPicker({ isDark, userId, color, onColorChange, iconUrl, onIconChange, fallbackIcon: FallbackIcon }: Props) {
  const isWeb = Platform.OS === "web";
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";
  const textPrimary = isDark ? "#F8FAFC" : "#101828";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";
  const inputBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileReady = async (data: ArrayBuffer | File, contentType: string, ext: string) => {
    setErrorMsg(null);
    setUploading(true);
    const { url, error } = await uploadIconFile(userId, data, contentType, ext);
    setUploading(false);
    if (error || !url) {
      setErrorMsg("No pudimos subir la imagen, intenta de nuevo.");
      return;
    }
    onIconChange(url);
  };

  const commitUrl = () => {
    const value = urlInput.trim();
    if (!value) return;
    onIconChange(value);
    setUrlInput("");
  };

  const isPreset = PRESET_COLORS.some((c) => c.toUpperCase() === color.toUpperCase());

  return (
    <View>
      <Text style={[styles.sectionLabel, { color: textSecondary, marginTop: 14 }]}>Imagen</Text>
      <View style={styles.imageRow}>
        <View style={[styles.previewTile, { backgroundColor: color + "20", borderColor: color + "40" }]}>
          {iconUrl ? (
            <Image source={{ uri: iconUrl }} style={styles.previewImage} />
          ) : (
            <FallbackIcon size={30} color={color} strokeWidth={2.2} />
          )}
        </View>
        <AvatarUploadZone isDark={isDark} primaryColor={color} uploading={uploading} onFileReady={handleFileReady as any} onError={setErrorMsg} />
      </View>

      <View style={[styles.urlInputWrapper, { backgroundColor: inputBg, borderColor: border }]}>
        <TextInput
          value={urlInput}
          onChangeText={setUrlInput}
          onSubmitEditing={commitUrl}
          onBlur={commitUrl}
          placeholder="o pega la URL de una imagen"
          placeholderTextColor={textSecondary}
          style={[styles.urlInput, { color: textPrimary }, isWeb && styles.noOutline]}
        />
        <TouchableOpacity onPress={commitUrl} hitSlop={8}>
          <ChevronRight size={16} color={color} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      {iconUrl && (
        <TouchableOpacity activeOpacity={0.7} style={styles.removeIconBtn} onPress={() => onIconChange(null)}>
          <X size={13} color={textSecondary} strokeWidth={2.2} />
          <Text style={{ color: textSecondary, fontSize: 12.5, fontWeight: "600" }}>Quitar imagen</Text>
        </TouchableOpacity>
      )}

      <Text style={[styles.sectionLabel, { color: textSecondary, marginTop: 18 }]}>Color</Text>
      <View style={styles.colorRow}>
        {PRESET_COLORS.map((c) => (
          <TouchableOpacity
            key={c}
            activeOpacity={0.8}
            onPress={() => onColorChange(c)}
            style={[styles.presetSwatch, { backgroundColor: c }]}
          >
            {color.toUpperCase() === c.toUpperCase() && <Check size={16} color="#FFF" strokeWidth={2.3} />}
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setShowColorPicker(true)}
          style={[
            styles.customSwatch,
            { borderColor: border, backgroundColor: !isPreset ? color : inputBg },
          ]}
        >
          {!isPreset ? <Check size={16} color="#FFF" strokeWidth={2.3} /> : <Palette size={15} color={textSecondary} strokeWidth={2.2} />}
        </TouchableOpacity>
      </View>
      <Text style={[styles.hexLabel, { color: textSecondary }]}>{color.toUpperCase()}</Text>

      {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

      <ColorPickerModal
        visible={showColorPicker}
        initialColor={color}
        isDark={isDark}
        onClose={() => setShowColorPicker(false)}
        onConfirm={(hex) => {
          onColorChange(hex);
          setShowColorPicker(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { fontSize: 12, fontWeight: "700", marginBottom: 10 },

  imageRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  previewTile: {
    width: TILE_SIZE, height: TILE_SIZE, borderRadius: 20, borderWidth: 1.5,
    justifyContent: "center", alignItems: "center", overflow: "hidden",
  },
  previewImage: { width: TILE_SIZE, height: TILE_SIZE, resizeMode: "cover" },

  urlInputWrapper: {
    flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  urlInput: { flex: 1, fontSize: 13 },
  noOutline: { outlineStyle: "none" } as any,

  removeIconBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 10 },

  colorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  presetSwatch: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  customSwatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  hexLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginTop: 10 },

  errorText: { color: "#EF4444", fontSize: 12.5, fontWeight: "600", marginTop: 10 },
});
