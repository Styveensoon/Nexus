import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { UploadCloud } from "lucide-react-native";
import { AVATAR_TILE_SIZE } from "../lib/profiles";

type Props = {
  isDark: boolean;
  primaryColor: string;
  uploading: boolean;
  onFileReady: (data: File, contentType: string, ext: string) => void;
  onError: (message: string) => void;
};

export default function AvatarUploadZone({ isDark, primaryColor, uploading, onFileReady, onError }: Props) {
  const border = isDark ? "rgba(255,255,255,0.16)" : "rgba(15,23,42,0.14)";
  const inputBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";
  const textSecondary = isDark ? "#94A3B8" : "#5B6472";

  const viewRef = useRef<View>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onError("Ese archivo no es una imagen.");
      return;
    }
    const ext = file.type.split("/")[1] ?? "jpg";
    onFileReady(file, file.type, ext);
  };

  useEffect(() => {
    const node = viewRef.current as unknown as HTMLElement | null;
    if (!node) return;

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    };
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFile(e.dataTransfer?.files?.[0]);
    };

    node.addEventListener("dragover", onDragOver);
    node.addEventListener("dragleave", onDragLeave);
    node.addEventListener("drop", onDrop);
    return () => {
      node.removeEventListener("dragover", onDragOver);
      node.removeEventListener("dragleave", onDragLeave);
      node.removeEventListener("drop", onDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      ref={viewRef}
      style={[
        styles.tile,
        {
          borderColor: isDragging ? primaryColor : border,
          backgroundColor: isDragging ? `${primaryColor}1A` : inputBg,
          opacity: uploading ? 0.6 : 1,
          cursor: uploading ? "default" : "pointer",
        } as any,
      ]}
      {...({ onClick: () => !uploading && fileInputRef.current?.click() } as any)}
    >
      <UploadCloud size={20} color={primaryColor} strokeWidth={2.2} />
      <Text style={[styles.label, { color: textSecondary }]} numberOfLines={2}>
        {uploading ? "Subiendo…" : isDragging ? "Suelta la imagen" : "Arrastra o haz clic"}
      </Text>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        disabled={uploading}
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
        style={{ display: "none" }}
      />
    </View>
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
