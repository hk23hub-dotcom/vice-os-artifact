# POD Factory — Design Spec
**Fecha:** 2026-08-26 · **Estado:** aprobado en diseño, pendiente de plan de implementación

## Qué es

Sistema de agentes que convierte lo que el usuario tira a una carpeta (imágenes o ideas)
en productos print-on-demand publicados en Printify, y publica cada creación como un
**planeta** en la galaxia **POD** del universo HK23 (cosmos.html), con blogpost público
y nota espejo en Obsidian. Los planetas se conectan entre sí como red neuronal
(tabla `hk23.relationships`, ya renderizada por cosmos.html).

## Decisiones cerradas

| Decisión | Elección |
|---|---|
| Input | **C** — carpeta drop que acepta imágenes *y* archivos de idea; enruta según tipo |
| Canal de venta | **A** — Printify **Pop-Up Store** (checkout de Printify, buy-link inmediato) |
| Blog | **C** — post público en el universo (Supabase) + nota espejo en VICE OS (Obsidian) |
| Blueprint | **B** — coleccionable **bloqueado** (`listings.status = 'future'`); Gumroad después |

## Ubicación y reutilización

- Código en `~/vice-os-artifact/pod-factory/` (mismo repo que el universo → el blog
  deploya a Vercel sin pasos extra).
- **Reutiliza las librerías de VICE SELLER** (`vice-seller/lib/`): `printify.js`
  (upload de arte + creación de producto), `caption.js` (visión → subject/style/keywords),
  `seo.js` (títulos/tags), `state.js` (patrón ledger idempotente). No se reescriben;
  se importan. `printify.js` se extiende con publish al Pop-Up Store (hoy apunta a Etsy).

## Arquitectura

```
inbox/  ──┬── imagen (png/jpg/webp) ──▶ PIPELINE PRODUCTO
          └── idea (.md/.txt)       ──▶ PIPELINE CONCEPTO ──▶ pending/ ──(usuario
                                                              genera arte y lo
                                                              devuelve a inbox/)──▶ PIPELINE PRODUCTO
```

**PIPELINE PRODUCTO** (por imagen):
1. Caption con visión → metadata SEO.
2. Printify: upload arte → crear producto (canvas + poster) → publicar a Pop-Up Store.
3. Universo: insertar entidad (planeta, galaxia POD) + listing con buy-link del Pop-Up
   + listing `future` para el blueprint bloqueado + relaciones a planetas afines.
4. Blog: post público + nota espejo en el vault.
5. Ledger: cada paso registrado; re-runs no duplican nada.

**PIPELINE CONCEPTO** (por idea):
1. Lee la idea → escribe concepto (nombre, historia, colección propuesta) +
   prompts de MidJourney listos para copiar → `pending/<slug>/concept.md`.
2. El planeta se crea **de inmediato** en estado `concept` (visible en el cosmos como
   idea en gestación — parte del atractivo coleccionable).
3. Cuando el usuario deposita las imágenes en `inbox/` con el slug del concepto
   (`<slug>__nombre.png`), el director las asocia y corre el pipeline producto,
   y el planeta pasa de `concept` a `live`.

## Los tres agentes

| Agente | Rol | Herramientas clave |
|---|---|---|
| `pod-director` | Orquesta: escanea inbox, enruta, corre pipelines, reporta | Bash, Read, Write (corre `pod-factory/run.js`) |
| `pod-publisher` | Escribe en Supabase: entidad, listings, relationships | módulo `lib/universe.js` |
| `pod-scribe` | Blogpost público + nota Obsidian con `[[links]]` | módulos `lib/blog.js`, `lib/vault.js` |

Director delega en publisher y scribe; los tres son definiciones en `~/.claude/agents/`
(patrón tommy/mercury) y la lógica determinista vive en `pod-factory/lib/` +
`run.js` (CLI: `--dry`, `--status`, run normal), igual que VICE SELLER.

## Datos

**Supabase (schema `hk23`, proyecto del universo):**
- `entities`: un planeta por producto/concepto. `kind='pod'`, `state='concept'|'live'`,
  `parent_id` → entidad-galaxia "POD" (se crea una vez). `meta` guarda printify ids,
  prompts, slug del post.
- `listings`: fila `status='active'` con `external_url` = buy-link Pop-Up;
  fila `status='future'` para el blueprint bloqueado.
- `relationships`: `type='pod-link'` entre planetas afines (el scribe propone conexiones
  por tema/paleta/serie usando la metadata del caption).
- `posts` (tabla nueva): `slug, entity_id, title, html, published_at`. Renderizada por
  `blog.html` + `api/posts.js` (mismo patrón anon-key de lectura que cosmos.html).

**Obsidian:** notas en `VAULT/04 Content/POD/<slug>.md` con frontmatter + `[[links]]`
espejando `relationships`.

**Local:** `pod-factory/data/ledger.json` (idempotencia), `config.local.json`
(gitignored) con `printifyToken`, `printifyShopId`, `anthropicKey`,
`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (escritura local; el sitio sigue leyendo
con anon key).

## Manejo de errores

- Cada paso del pipeline es una entrada de ledger con estado; un fallo a mitad de wave
  se retoma sin duplicar (patrón VICE SELLER probado).
- Sin `printifyToken` → el director corre en `--dry` y lo dice claramente en el reporte.
- Imagen sin slug de concepto asociable y sin resolución mínima (Printify exige DPI
  para canvas) → va a `rejected/` con un motivo escrito, nunca falla silencioso.
- Escrituras a Supabase con retry simple; si el universo falla pero Printify publicó,
  el ledger marca el paso pendiente y el próximo run lo completa.

## Testing

- `run.js --dry` como smoke test permanente (sin red, sin fees).
- Tests de unidad para el router del inbox (imagen vs idea vs imagen-de-concepto) y
  para el mapeo entidad/listing/relationship (fixtures JSON, sin Supabase real).
- Primer producto real se publica en modo draft en Printify y se verifica a mano
  antes de habilitar publish automático.

## Prerrequisitos (única cosa que el agente no puede autoproveer)

1. **Printify:** token API + shop id del Pop-Up Store (Printify → Connections → API).
   Hoy NO existe `config.local.json` — hay que crearlo.
2. **Supabase service-role key** del proyecto del universo (ya existe en Vercel env;
   copiar a `config.local.json`).

## Fuera de alcance v1

- Venta real del blueprint (Gumroad) — queda `future`.
- Etsy/Pinterest como canales (el código de VICE SELLER queda listo para encender).
- Generación automática de imágenes (el arte lo genera el usuario en MidJourney).
- Mercury: se registra como campaña `pod-factory` para tracking, pero sin integración
  profunda en v1.
