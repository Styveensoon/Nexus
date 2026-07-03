import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { decode } from "base64-arraybuffer";
import { UploadCloud } from "lucide-react-native";
import { AVATAR_TILE_SIZE } from "../lib/profiles";

type Props = {
  isDark: boolean;
  primaryColor: string;
  uploading: boolean;
  onFileReady: (data: ArrayBuffer, contentType: string, ext: string) => void;
  onError: (message: string) => void;
};

export default function AvatarUploadZone({ isDark, primaryColor, uploading, onFileReady, onError }: Props) {
  const border = isDark ? "rgba(255,255,255,0.16)" : "rgba(15,23,42,0.14)";
  const inputBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";

  const handlePress = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      onError("Necesitamos permiso para acceder a tus fotos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]?.base64) return;

    const asset = result.assets[0];
    const contentType = asset.mimeType ?? "image/jpeg";
    const ext = contentType.split("/")[1] ?? "jpg";

    try {
      const arrayBuffer = decode(asset.base64!);
      onFileReady(arrayBuffer, contentType, ext);
    } catch {
      onError("No pudimos leer esa imagen, prueba con otra.");
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={uploading}
      onPress={handlePress}
      style={[styles.tile, { borderColor: border, backgroundColor: inputBg, opacity: uploading ? 0.6 : 1 }]}
    >
      <UploadCloud size={20} color={primaryColor} strokeWidth={2.2} />
      <Text style={[styles.label, { color: textSecondary }]} numberOfLines={2}>
        {uploading ? "Subiendo…" : "Subir foto"}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: AVATAR_TILE_SIZE,
    height: AVATAR_TILE_SIZE,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 6,
  },
  label: { fontSize: 11, fontWeight: "600", textAlign: "center" },
});
