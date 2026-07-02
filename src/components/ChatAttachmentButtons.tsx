import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { Image as ImageIcon, Paperclip } from "lucide-react-native";

type Props = {
  color: string;
  disabled?: boolean;
  onAttachmentReady: (data: ArrayBuffer, contentType: string, ext: string, name: string, kind: "image" | "file") => void;
  onError: (message: string) => void;
};

export default function ChatAttachmentButtons({ color, disabled, onAttachmentReady, onError }: Props) {
  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      onError("Necesitamos permiso para acceder a tus fotos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]?.base64) return;

    const asset = result.assets[0];
    const contentType = asset.mimeType ?? "image/jpeg";
    const ext = contentType.split("/")[1] ?? "jpg";

    try {
      const arrayBuffer = decode(asset.base64!);
      onAttachmentReady(arrayBuffer, contentType, ext, asset.fileName ?? `foto.${ext}`, "image");
    } catch {
      onError("No pudimos leer esa imagen, prueba con otra.");
    }
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    try {
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const arrayBuffer = decode(base64);
      const contentType = asset.mimeType ?? "application/octet-stream";
      const ext = asset.name.includes(".") ? asset.name.split(".").pop()! : "bin";
      onAttachmentReady(arrayBuffer, contentType, ext, asset.name, "file");
    } catch {
      onError("No pudimos leer ese archivo, prueba con otro.");
    }
  };

  return (
    <>
      <TouchableOpacity hitSlop={8} disabled={disabled} onPress={pickImage} style={styles.btn}>
        <ImageIcon size={18} color={color} />
      </TouchableOpacity>
      <TouchableOpacity hitSlop={8} disabled={disabled} onPress={pickFile} style={styles.btn}>
        <Paperclip size={18} color={color} />
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  btn: { padding: 2 },
});
