@AGENTS.md
@docs/ESTADO.md
@docs/PATRONES.md
@docs/TRAMPAS.md
@docs/ARQUITECTURA.md
@docs/BASE_DE_DATOS.md
@docs/SETUP.md

# NEXUS — Contexto del proyecto

## Qué es
Plataforma de gestión de proyectos con IA local, self-hosted, multiplataforma (iOS, Android, Web) con un solo código en Expo + React Native.

**Diferenciador de negocio principal:** los datos nunca salen de la red del cliente. En producción, la IA correría 100% local vía Ollama en un Raspberry Pi 5 — sin esto no hay venta a empresas como T-Systems, bancos o gobierno. **Nota: esto es visión de producto, todavía no hay ninguna infraestructura de IA construida (ver `docs/ESTADO.md`).**

## Cómo está organizada esta documentación
Este archivo es solo el índice. El contenido real vive en `docs/` (importado arriba, así que siempre está disponible en contexto):
- **`docs/ESTADO.md`** — qué existe de verdad hoy vs. visión, y el changelog de las últimas rondas de trabajo. Leer primero, antes de asumir que algo existe o no.
- **`docs/PATRONES.md`** — patrones de código ya establecidos (paletas, sombras, responsive, pickers, subida de archivos). Reusar, no reinventar.
- **`docs/TRAMPAS.md`** — bugs/gotchas ya resueltos, para no perder tiempo redescubriéndolos.
- **`docs/ARQUITECTURA.md`** — jerarquía/roles objetivo, diferenciadores de producto, stack técnico, decisiones de arquitectura, modelo de negocio.
- **`docs/BASE_DE_DATOS.md`** — esquema real de Supabase, tabla por tabla, con RLS.
- **`docs/SETUP.md`** — variables de entorno, setup de desarrollo, y roadmap de setup de producción (Pi 5).

## Convenciones de trabajo
- Priorizar RLS (Row Level Security) en cualquier query o tabla nueva — el aislamiento por organización es requisito de seguridad, no opcional.
- Al tocar código de IA, tener en cuenta que dev usa Groq (`llama-3.3-70b-versatile`, no Mixtral — Groq lo descontinuó) y prod usaría Ollama/Mistral-Llama — no asumir que el prompt/formato de respuesta es idéntico entre ambos sin probar. El parseo del bloque `<<<TEAM>>>...<<<END_TEAM>>>` en `supabase/functions/semillero-chat/index.ts` es específico del prompt actual; si se cambia de modelo o proveedor, probar que el modelo nuevo sigue respetando ese formato.
- Componentes deben funcionar en los 3 targets (iOS, Android, Web) salvo que se indique lo contrario explícitamente.
- Preferir archivos completos al proponer cambios, no snippets parciales.
- Antes de tocar esquema de base de datos, confirmar impacto en RLS policies existentes, y avisar explícitamente que hay que re-correr `schema.sql` en Supabase.
