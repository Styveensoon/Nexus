import { supabase } from "./supabase";

// Reusa el bucket público `avatars` (mismas políticas: cualquier autenticado
// escribe solo en su propia carpeta, lectura pública para todos) para
// íconos de equipos/proyectos y adjuntos de chat de tasks — evita crear
// infraestructura de Storage nueva. `prefix` es solo para que el nombre del
// archivo en Storage sea legible (icon-, task-attachment-, etc.).
export async function uploadFile(
  ownerUserId: string,
  data: ArrayBuffer | File,
  contentType: string,
  ext: string,
  prefix: string = "file"
) {
  const path = `${ownerUserId}/${prefix}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, data, {
    contentType,
    upsert: true,
  });

  if (error) return { url: null, error };

  const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
  return { url: publicUrlData.publicUrl, error: null };
}

export async function uploadIconFile(ownerUserId: string, data: ArrayBuffer | File, contentType: string, ext: string) {
  return uploadFile(ownerUserId, data, contentType, ext, "icon");
}
