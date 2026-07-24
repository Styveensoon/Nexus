import { supabase } from "./supabase";
import { ProjectDigestContent } from "./projects";

// Invoca project-weekly-digest en modo usuario (botón manual "Generar
// ahora" en ProjectsScreen.tsx) — a diferencia de client-dashboard-generate,
// esta función SÍ persiste sola del lado servidor (usa su propio admin
// client), porque el modo principal de esta Edge Function es el cron
// semanal, sin ningún cliente esperando la respuesta para guardarla. Acá
// solo se invoca y se devuelve el contenido para reflejarlo de inmediato en
// la UI sin esperar un refetch.
export async function generateProjectDigest(projectId: string) {
  const { data, error } = await supabase.functions.invoke("project-weekly-digest", {
    body: { projectId },
  });

  if (error) return { error, content: null };
  const content = data?.content as ProjectDigestContent | undefined;
  if (!content) return { error: new Error("La IA no devolvió contenido"), content: null };

  return { error: null, content };
}
