import { supabase } from "./supabase";
import { logClientActivity } from "./clientActivity";
import { notifyClientDocumentReady } from "./emails";

// Documentos/presentaciones bajo demanda (docs/CLIENTE.md §7) — a diferencia
// del Dashboard (§6, automático/vivo), esto es SIEMPRE reactivo: el cliente
// lo pide vía Solicitudes (ya existente), el staff lo genera acá ligado a esa
// solicitud (request_id). Un documento notifica por email al cliente tanto
// en su primera generación como en cada regeneración (a diferencia del
// Dashboard, que nunca notifica) — acá cada regeneración es una entrega
// puntual que el cliente pidió, no un refresco automático de fondo.
export type ClientDocumentSection = { heading: string; body: string };

export type ClientDocument = {
  id: string;
  organizationId: string;
  clientUserId: string;
  requestId: string | null;
  title: string;
  extraPrompt: string | null;
  source: { projectIds: string[]; teamIds: string[] };
  generatedContent: { sections: ClientDocumentSection[] } | null;
  generatedAt: string | null;
  generatedBy: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

function mapDocumentRow(row: any): ClientDocument {
  return {
    id: row.id,
    organizationId: row.organization_id,
    clientUserId: row.client_user_id,
    requestId: row.request_id,
    title: row.title,
    extraPrompt: row.extra_prompt,
    source: row.source ?? { projectIds: [], teamIds: [] },
    generatedContent: row.generated_content ?? null,
    generatedAt: row.generated_at,
    generatedBy: row.generated_by,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const DOCUMENT_COLUMNS =
  "id, organization_id, client_user_id, request_id, title, extra_prompt, source, generated_content, generated_at, generated_by, created_by, created_at, updated_at";

// Un documento por solicitud como máximo — regenerar actualiza el mismo row
// en vez de acumular versiones, mismo criterio conceptual que "Regenerar" en
// el Dashboard o en El Semillero.
export async function getDocumentForRequest(requestId: string) {
  const { data, error } = await supabase.from("client_documents").select(DOCUMENT_COLUMNS).eq("request_id", requestId).maybeSingle();

  if (error) return { data: null, error };
  return { data: data ? mapDocumentRow(data) : null, error: null };
}

export async function listClientDocuments(organizationId: string, clientUserId: string) {
  const { data, error } = await supabase
    .from("client_documents")
    .select(DOCUMENT_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("client_user_id", clientUserId)
    .order("created_at", { ascending: false });

  if (error) return { data: [] as ClientDocument[], error };
  return { data: (data ?? []).map(mapDocumentRow), error: null };
}

export async function generateClientDocument(params: {
  organizationId: string;
  clientUserId: string;
  requestId: string | null;
  title: string;
  extraPrompt: string;
  projectIds: string[];
  teamIds: string[];
  actorId: string;
  existingDocumentId?: string | null;
}) {
  const { data, error } = await supabase.functions.invoke("client-document-generate", {
    body: {
      organizationId: params.organizationId,
      clientUserId: params.clientUserId,
      projectIds: params.projectIds,
      teamIds: params.teamIds,
      extraPrompt: params.extraPrompt,
      title: params.title,
    },
  });

  if (error) return { error, documentId: null };
  const content = data?.content as { sections: ClientDocumentSection[] } | undefined;
  if (!content) return { error: new Error("La IA no devolvió contenido"), documentId: null };

  const source = { projectIds: params.projectIds, teamIds: params.teamIds };
  const isRegeneration = !!params.existingDocumentId;
  let documentId = params.existingDocumentId ?? null;

  if (isRegeneration) {
    const { error: updateError } = await supabase
      .from("client_documents")
      .update({
        title: params.title,
        extra_prompt: params.extraPrompt || null,
        source,
        generated_content: content,
        generated_at: new Date().toISOString(),
        generated_by: params.actorId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.existingDocumentId);
    if (updateError) return { error: updateError, documentId: null };
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("client_documents")
      .insert({
        organization_id: params.organizationId,
        client_user_id: params.clientUserId,
        request_id: params.requestId,
        title: params.title,
        extra_prompt: params.extraPrompt || null,
        source,
        generated_content: content,
        generated_at: new Date().toISOString(),
        generated_by: params.actorId,
        created_by: params.actorId,
      })
      .select("id")
      .single();
    if (insertError) return { error: insertError, documentId: null };
    documentId = inserted?.id ?? null;
  }

  await Promise.all([
    logClientActivity({
      organizationId: params.organizationId,
      clientUserId: params.clientUserId,
      actorId: params.actorId,
      action: isRegeneration ? "document_regenerated" : "document_created",
      entityName: params.title,
      entityId: documentId,
    }),
    notifyClientDocumentReady(params.clientUserId, params.title, params.organizationId),
  ]);

  return { error: null, documentId, content };
}
