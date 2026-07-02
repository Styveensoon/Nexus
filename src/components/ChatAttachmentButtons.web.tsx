import React, { useRef } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { Image as ImageIcon, Paperclip } from "lucide-react-native";

type Props = {
  color: string;
  disabled?: boolean;
  onAttachmentReady: (data: File, contentType: string, ext: string, name: string, kind: "image" | "file") => void;
  onError: (message: string) => void;
};

export default function ChatAttachmentButtons({ color, disabled, onAttachmentReady, onError }: Props) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImage = (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onError("Ese archivo no es una imagen.");
      return;
    }
    const ext = file.type.split("/")[1] ?? "jpg";
    onAttachmentReady(file, file.type, ext, file.name, "image");
  };

  const handleFile = (file: File | null | undefined) => {
    if (!file) return;
    const ext = file.name.includes(".") ? file.name.split(".").pop()! : "bin";
    onAttachmentReady(file, file.type || "application/octet-stream", ext, file.name, "file");
  };

  return (
    <>
      <TouchableOpacity hitSlop={8} disabled={disabled} onPress={() => imageInputRef.current?.click()} style={styles.btn}>
        <ImageIcon size={18} color={color} />
      </TouchableOpacity>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          handleImage(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <TouchableOpacity hitSlop={8} disabled={disabled} onPress={() => fileInputRef.current?.click()} style={styles.btn}>
        <Paperclip size={18} color={color} />
      </TouchableOpacity>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: "none" }}
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  btn: { padding: 2 },
});
