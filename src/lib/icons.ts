import { supabase } from "./supabase";

// Reusa el bucket público `avatars` (mismas políticas: cualquier autenticado
// escribe solo en su propia carpeta, lectura pública para todos) para íconos
// de equipos/proyectos — evita crear infraestructura de Storage nueva.
export async function uploadIconFile(
  ownerUserId: string,
  data: ArrayBuffer | File,
  contentType: string,
  ext: string
) {
  const path = `${ownerUserId}/icon-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, data, {
    contentType,
    upsert: true,
  });

  if (error) return { url: null, error };

  const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
  return { url: publicUrlData.publicUrl, error: null };
}
