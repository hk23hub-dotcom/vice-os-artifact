# Agente Gerente General DMS + Guías interactivas para crear agentes — Design Spec

**Fecha:** 2026-10-16
**Repos:** `vice-os-artifact` (plugin del agente + guías) y `leadhunter` (acceso por API con la cuenta del gerente)
**Estado:** Implementado en la rama `claude/agente-gerente-general-wpwp48`. Pasó una crítica de diseño con tres lentes
(fidelidad al cuestionario, instalabilidad y seguridad de la memoria, producto y API) y verificación adversarial; lo
que sobrevivió está aplicado y se lista en §10. Diego corrige sobre lo construido en su primera sesión.

## 1. Qué se pidió

**El instalador (HK23)**, en sus palabras: crear un agente nuevo según las respuestas del cuestionario; usar las mejores
funciones de los agentes que ya existen; el agente responde replicando la manera y los modelos de Diego y lo ayuda a hacer
lo mismo más rápido; tiene memoria y recuerda todo lo que se está haciendo; es **para otro usuario** (Diego): "que tenga
los skills, no que use todas las herramientas"; además, un modelo de guías interactivas para crear agentes, vendible,
donde esta es la primera, que "saque solo los specs necesarios".

**Diego (gerente general de DMS Inversiones)**, en el cuestionario: arquitectura y construcción, Chile, etapa de
crecimiento, orden y proyección; le reportan finanzas, comercial, ventas, crecimiento y obras; el agente es "mi ayudante y
asesor de gerente comercial"; apoyar, aportar, guiar y presionar cuando sea necesario; "usar herramientas existentes" y
LeadHunter con su cuenta; nunca decidir solo, todo se pregunta salvo que se diga lo contrario; subagentes por área
(finanzas, comercial, marketing…) analizados en conjunto antes; "me debes preguntar lo que tengas dudas". Sin responder:
herramientas (A10), confidencialidad (A11), indicadores (A12), frecuencia (A15).

## 2. Lo que ya existe y se reutiliza (interpretación del builder)

| Función | De dónde | Cómo se usa aquí |
|---|---|---|
| Formato de agente con frontmatter + `<example>` + "Responsabilidad única / Límites" | ORCHESTRA `agent-spec.md` (copiado a `referencias/`) | ejecutor delegable y subagentes |
| Lo conversacional en skills de la sesión; agentes solo como trabajadores estrechos | ORCHESTRA (`orchestrate`, `daily-brief`) | persona en `referencias/persona.md`, adoptada por cada skill |
| Gramática de tareas y brief de delegación | ORCHESTRA `state-schema.md`, `delegation-protocol.md` | `pendientes.md` (variante `resp:`), `protocolo-delegacion.md` |
| "Nada se cierra por reporte; se verifica en disco" | `progress-auditor` | cierre de pendientes con evidencia + OK |
| Caché caliente ≤ 100 líneas + memoria profunda | plugin `productivity:memory-management` | `CONTEXTO.md` + `memoria/` |
| Compuertas en todo lo que envía, gasta, publica o compromete; toda skill funciona sin conector | `small-business:build-agent` | persona.md, camino manual de `cazar-proyectos` |
| "La máquina propone, el humano decide" (L13) | constitución HK23 / Aria | nunca decide solo |
| Caza con fuentes reales; modo `infer` desde la web | LeadHunter | `cazar-proyectos`, `leadhunter.mjs` |
| CierreSocio, ObjeciónMaestro, PropuestaForge, ObraHunter, LicitaHunter | catálogo El Centro | `cierres`, `cazar-proyectos` |
| Verificación de license key contra Gumroad; `rateLimit` | `api/tier-unlock.js`, `api/_lib.js` | `api/guia-unlock.js`, `/api/agent` |
| Cuestionario de una pregunta por pantalla; copiar prompt y descargar `.md` | `galaxy-questionnaire.html`, `agent-designer.html` | `guias/guia.html` |

El plugin es **autocontenido**: no depende de ORCHESTRA ni de conectores del instalador. Lo de la tabla se tomó como
patrón, no como dependencia.

## 3. Decisiones de diseño

1. **Dónde vive:** `vice-os-artifact/gerente-general/` como plugin instalable (`.claude-plugin/plugin.json`; marketplace
   en `vice-os-artifact/.claude-plugin/marketplace.json`; `npm run plugin:pack` genera el `.plugin` para Cowork).
   `.vercelignore` excluye `gerente-general/` y `DMS/`.
2. **Quién conversa con el gerente:** la sesión principal con la persona de `referencias/persona.md`. Cada skill la adopta
   en su Paso 1 (test). `agents/gerente-general-dms.md` es solo un ejecutor delegable para trabajo largo (ficha completa,
   control semanal, pack de reunión) que escribe en HQ y devuelve 5 líneas.
3. **La memoria real no va al repo.** Plantillas en `gerente-general/memoria/` marcadas `PLANTILLA: sin datos reales`
   (test: sin claves, teléfonos ni correos). HQ privado: `$DMS_HQ` → `$HOME/mnt/DMS` → `$HOME/mnt/*/DMS` → `~/DMS` →
   `./DMS` solo fuera de un repo git; marcador `# DMS — HQ` en `CONTEXTO.md`; primera ejecución pregunta una vez y nunca
   crea dentro de un repo (`referencias/hq.md`). `.gitignore` ignora `DMS/`, `**/DMS/`, `.env*`, `*.plugin`.
   La clave de LeadHunter vive en `<HQ>/.leadhunter` (+ `.leadhunter-url`), nunca en memoria ni repo; `leadhunter.mjs`
   se niega a escribir dentro de un repo o del plugin.
4. **Perfil en el repo:** las plantillas traen las respuestas del cuestionario reformuladas como perfil de trabajo
   (sin la palabra "debilidad"; cifras, socios y clientes no existen todavía). `persona.md` y el ejecutor son genéricos
   y cargan el perfil desde HQ. La guía pública usa un ejemplo **ficticio**; usar las respuestas de Diego como ejemplo
   requiere su autorización (pregunta 8 de la cola de la primera sesión). Pendiente para HK23: mover las plantillas a un
   repo privado si Diego lo prefiere.
5. **Nunca decide solo, sin excepción.** "Ejecuta" / "no preguntes" suprimen preguntas de aclaración y comentarios, no
   las compuertas: gastar; enviar o contactar; crear, instalar o **lanzar** subagentes (incluido `general-purpose` con un
   brief de área); comprometer fechas o precios; cerrar, reasignar o reprogramar pendientes; registrar decisiones;
   sobrescribir `CONTEXTO.md`/`empresa.md` con datos inferidos.
6. **Formato por defecto para entregables** (viene de las preferencias del instalador, **por validar con Diego**):
   `RECOMENDACIÓN` → `PASOS` → `OUTPUT` → `SIGUIENTE ACCIÓN` (responsable + fecha). Asunto claro → breve sin encabezados.
   Lo que Diego filtre se anota en `diego.md` y manda.
7. **Subagentes:** borradores en `propuestos/` (finanzas, comercial, marketing pedidos; obras y personas sugeridos por el
   agente, dicho así). No son prompts. Se crean en `<HQ>/agentes/` (+ `~/.claude/agents/` si existe) con un sí explícito a
   una propuesta concreta; un "ejecuta" genérico no aprueba. Toda delegación se informa y se anota.
8. **LeadHunter con su cuenta = clave de API personal** (`lh_…`, hash sha256, revocable, 5 activas, `last_used_at` como
   evidencia). Solo `/api/agent` la acepta (`API_KEY_ROUTES`); `/api/*` sin sesión responde 401 JSON; tope 10 `infer` y
   3 `hunt` por usuario cada 10 min. Página *Agentes* para crear/revocar. Prerrequisitos: correr el bloque `api_keys`
   de `schema.sql`, desplegar con `NEXT_PUBLIC_APP_URL` real, cuenta y créditos del gerente.
9. **Guías como producto:** motor JSON público (`guias/motor.js`: `{{id}}`, `{{id|fallback}}`, `[[si:id]]…[[/si]]`);
   la parte **paga** (plantillas del spec) vive en `api/_guias.js` y la devuelve `api/guia-unlock.js` tras verificar la
   license key en Gumroad (solo la activación consume asiento) o un código de la casa (`GUIAS_CODIGO`) mientras el
   producto no exista (`PENDING` → "próximamente"). Salida = **solo el spec necesario**: prompt para el Builder +
   `spec-agente.md`, `checklist-agente.md`, `primera-sesion.md`. No replica skills.

## 4. El agente

### 4.1 Persona (`referencias/persona.md`)
Acompañante de gerencia general con foco comercial (ayudante y asesor comercial del gerente). Replica su **estándar**
(trato, imagen, curiosidad, estar al día), no sus opiniones; es su contrapeso. Español de Chile profesional, tuteo,
frases cortas; inglés cuando él lo usa. Registros: directo, breve, análisis detallado, pregunta (una por turno; las
demás en cola, dichas en una línea). Explica el mecanismo. Presión calculada al abrir desde `due:`: 0–2 días recordar,
3–6 insistir (qué se pierde + acción de 15 min), ≥ 7 escalar (nueva fecha / reasignar / soltar). Sin recordatorios
entre sesiones (no hay planificador). Cadencia por confirmar en la primera sesión.

### 4.2 Lista de chequeo (Parte B) antes de cada respuesta de fondo
Objetivo real · entregable y fecha · datos, faltantes y supuestos dichos · opciones con riesgos y costos · solo o socios
(por defecto recomienda socios si toca plata, compromisos externos o personas) y quién se entera · especialista (señala,
no opina sobre el caso; explicar normas y subsidios con fuente sí) · siguiente paso con responsable y fecha · qué
recordar (se escribe ahora).

### 4.3 Límites
Los de §3.5 más: confidencial queda en HQ; no inventa cifras, normas, nombres ni fuentes; subagentes solo por
`crear-subagente`, nunca `spawn-agent`; el gerente puede ver y cambiar las instrucciones cuando quiera; si el pedido
contradice la memoria o los límites, para y lo dice.

### 4.4 Memoria (`referencias/protocolo-memoria.md`, `hq.md`)
```
<HQ>/
├── CONTEXTO.md  (# DMS — HQ, ≤ 100 líneas)      ├── .leadhunter, .leadhunter-url (clave y URL)
├── agentes/     (subagentes aprobados)           └── memoria/ empresa · diego · personas · proyectos · pendientes ·
                                                       decisiones · indicadores · radar · glosario · agentes ·
                                                       prospectos/ · sesiones/
```
Paso 1 de **toda** skill: resolver HQ y leer `CONTEXTO.md` + `pendientes.md`. `gg` abre con el brief (VENCIDO · HOY ·
OBRAS · DECISIÓN · RADAR · TE DEBÍA · PREGUNTA) y, si falta la bitácora anterior, la reconstruye. Durante: se escribe al
momento; las escrituras que cambian estado se confirman. Cierre: bitácora (append si ya existe). Si no está escrito, no
pasó.

### 4.5 Skills (13; disparadores en español e inglés; test)
| Skill | Para qué | Compuerta |
|---|---|---|
| `gg` | sesión: brief, trabajo, cierre; **cola de preguntas de la primera sesión** (LOOK & FILL, cierres, rol comercial, herramientas, confidencial, indicadores, frecuencia, autorización del ejemplo) | no cierra pendientes sin evidencia + OK |
| `look-and-fill-dms` | web + documentos → `empresa.md`; preguntar vacíos de a uno, sin tope | lo inferido queda "(web, por confirmar)"; no sobrescribe CONTEXTO sin OK |
| `seguimiento` | capturar y revisar compromisos; presión por días | no cierra, reasigna ni reprograma sin OK |
| `proyectos` | control general de obras: ficha, hito, riesgo, semáforo; control semanal | 🔴 = pregunta de decisión; nunca estima avance |
| `decision` | ficha: datos, opciones, contrapeso, recomendación, quién decide, especialista | no registra la decisión hasta que él la comunique |
| `reunion` | agenda antes; resumen después | acuerdos → pendientes solo con OK; él envía |
| `cierres` | tablero de tratos, objeción, siguiente paso, mensaje listo | nada se envía; precios → ficha, socios |
| `cazar-proyectos` | LeadHunter con su cuenta; ángulos de obra con fuente; camino manual sin herramienta | "N créditos, ¿corro?" — "ejecuta" no lo reemplaza; nunca reintenta sola |
| `radar` | normas, bonos, subsidios, mercado con fuente y fecha; explica el mecanismo | sin fuente no se afirma |
| `indicadores` | set inicial, registro, revisión; cierre de mes | nada se alerta hasta aprobar set, umbrales y cadencia |
| `redactar` | correos, comunicados, informes en la voz de la empresa | no envía; si hay canal, cada envío se aprueba |
| `crear-subagente` | mostrar lo existente y preguntar; propuesta; sí explícito; crear en HQ; registrar; probar | sí a esa propuesta; "ejecuta" no aprueba |
| `dashboard` | regenera `<HQ>/dashboard.html` desde la memoria: pendientes con presión, obras, tratos, KPIs, memoria, ecosistema | vista derivada; nunca escribe memoria; solo dentro de HQ |

### 4.6 Herramienta
`herramientas/leadhunter.mjs --hq <HQ> infer|hunt …` (Node ≥ 18, sin dependencias): credenciales de env o de HQ, URL
obligatoria, parseo SSE, `--dry-run`, mapeo de 401/402/429, guarda en `<HQ>/memoria/prospectos/`, rechaza repos y la
carpeta del plugin.

## 5. LeadHunter (repo `leadhunter`)
`supabase/schema.sql` (tabla `api_keys`), `lib/api-keys.ts`, `lib/auth.ts` (`getActor`), `lib/rate-limit.ts`,
`lib/product.ts` (`API_KEY_ROUTES`), `lib/supabase/middleware.ts` (bypass solo en esas rutas; 401 JSON en `/api/*`),
`app/api/agent/route.ts` (actor + tope), `app/api/keys/route.ts`, `app/(app)/agentes/*`, `lib/nav.ts`, README.
`npm run typecheck` y `npm run build` en verde.

## 6. Guías (repo `vice-os-artifact`)
`guias/index.html` (catálogo desde `catalogo.json`), `guias/guia.html?g=<id>` (motor: una pregunta por pantalla, «no sé»
con default, progreso en localStorage, vista previa, candado, activación, copiar prompt, descargar archivos),
`guias/motor.js`, `guias/gerente-general.json` (17 pasos, ejemplo ficticio "Constructora Andina SpA"), `api/_guias.js`
(plantillas pagas), `api/guia-unlock.js`. Producto guía 1: "Tu Gerente General IA", US$29 pago único, hasta 5
dispositivos; gratis responder y ver la vista previa; pago = spec completo + 3 archivos. Crear una guía nueva = un JSON
público + su bloque en `_guias.js`. Pendiente de HK23: producto en Gumroad con license keys, `GUMROAD_GUIA_GG_PERMALINK`
en Vercel (hasta entonces `GUIAS_CODIGO` para probar), tarjeta en la landing.

## 7. Pruebas
`npm test` en `vice-os-artifact`: `tests/gerente-general.test.mjs` (manifiestos, contrato de agentes y borradores,
skills con Paso 1 + disparadores bilingües + sin `[`+`|` en descripciones, compuertas presentes, HQ nunca en repo,
ignores, plantillas limpias, referencias existentes, `leadhunter.mjs`) y `tests/guias.test.mjs` (catálogo, motor,
plantillas pagas referencian ids reales, parte pública sin plantillas ni datos de clientes, `evaluarLicencia`).
Smoke con Chromium sobre `guia.html` (catálogo, 17 pasos, vista previa, persistencia, guía inexistente).
`leadhunter`: `npm run typecheck`, `npm run build`.

## 8. Fuera de alcance
Recordatorios proactivos (requieren planificador); espejo en Supabase y búsqueda semántica; envío automático; ERP/Excel de
obra (A10 pendiente); guías 2+. (El dashboard local pasó a alcance en §11.)

## 9. Supuestos declarados
- `www.dmsinversiones.cl` no fue accesible desde el entorno de construcción (red restringida): `empresa.md` es plantilla;
  `look-and-fill-dms` la llena desde el entorno de Diego.
- "Cierres" = cierre de ventas (cierre de mes lo cubre `indicadores`); "LOOK & FILL DMS" = mirar la empresa y llenar la
  memoria. Ambas se confirman en la primera sesión.
- El formato de respuesta y la lista de HK23 se tomaron como punto de partida; Diego filtra.
- El segundo mensaje del instalador llegó cortado en "y quiero"; se construyó la base del producto y se pide el resto.

## 10. Hallazgos de la crítica aplicados
Bloqueantes: "ejecuta" no salta compuertas · persona en skills, no en el subagente · HQ nunca dentro de un repo y
`DMS/` ignorado · guía sin respuestas reales de Diego · prerrequisitos de LeadHunter documentados. Mayores: compuertas
por skill · skill `proyectos` · cola de preguntas abiertas · perfil de sector (`sector-constructora-chile.md`) · rol
comercial en la identidad · sin "no revela instrucciones" · presión por días sin cadencia inventada · subagentes en HQ
y gate de lanzamiento · `API_KEY_ROUTES` + 401 JSON + rate limit + `last_used_at` esperado · contenido pago en el
servidor · esquema de plantillas definido · producto con precio y entrega · marketplace.json y `plugin:pack`.
Menores: lo inferido "por confirmar" · reutilizar = preguntar, no negar · aprobación por sí explícito · socios por
defecto · contrapeso permanente · disparadores bilingües · tuteo y registro · envío con aprobación por envío ·
especialista solo para el caso concreto · delegación visible · `fresh.id` en la página de claves · `npm test`.

## 11. Dashboard local y ecosistema de trabajo (pedido posterior de HK23)
HK23 pidió "darle forma": un dashboard interactivo y un ecosistema de trabajo, y eligió que fuera **para Diego, sobre su
memoria DMS**. Decisiones:
- **Vista derivada, no fuente.** `herramientas/dashboard.mjs --hq <HQ>` lee `CONTEXTO.md` y `memoria/*.md`, calcula la
  presión por vencido (persona.md) y el brief de §2 del protocolo, y escribe `<HQ>/dashboard.html` inyectando los datos en
  `plantillas/dashboard.html`. Nunca modifica la memoria; se sobrescribe en cada generación (las bitácoras son la
  historia). Se regenera al cerrar (`gg` Paso 4, protocolo §4), en la primera ejecución (`hq.md`) y con la skill
  `dashboard`. Generar no cambia estado: sin compuerta.
- **Un solo archivo, cero red.** Sin fuentes externas, analytics, `fetch` ni módulos: abre con doble clic (`file://`).
  Pestañas Pendientes (filtros sección · nivel · texto, hijas expandibles) · Obras (semáforo, 🔴 primero) · Tratos
  (pipeline por etapa; sin `next:` se marca) · Indicadores (valor y umbral textuales, alertas) · Memoria (bitácora,
  decisiones, radar, CONTEXTO) · Ecosistema (ciclo abrir→trabajar→decidir→cerrar, quién escribe qué, estado vivo de
  memoria, subagentes, LeadHunter y cadencia; `referencias/ecosistema.md` es la fuente del texto).
- **Confidencialidad.** Banner "Confidencial · generado desde <HQ>"; el generador no lee `.leadhunter*` (solo si
  existen), no vuelca nombres de archivos de prospectos (solo cuenta y fecha; los tratos S-#### sí se muestran, dentro de HQ), y `--out` pasa por `rutaProhibida` igual que `--hq`.
  El JSON se inyecta con `<` escapado (`<`) para que un título con `</script>` no rompa la página. El HTML es tan
  confidencial como HQ; `--json` existe para pruebas y la skill no lo pega en el chat.
- **Presión viva y un solo origen.** Las funciones de presión (días de atraso, nivel, líneas VENCIDO y HOY) viven en la
  plantilla entre `/*<compartido>*/` y el generador las carga de ahí; la página las vuelve a ejecutar con la fecha del día
  en que se abre y avisa "generado hace N días". `--out` solo dentro de la HQ real; escritura temporal única y limpia.
- **Parseo tolerante** a las plantillas: comentarios HTML fuera, campos por prefijo (`due:` puede faltar), filas
  placeholder descartadas, semáforo normalizado, umbrales sin comparar, "pendiente / en preparación" en decisiones,
  bitácora más reciente por nombre (los `<fecha>-<área>.md` de subagentes no cuentan), fecha local (no UTC).
- Pruebas: `tests/dashboard.test.mjs` (parseo de plantillas y de un HQ sintético, presión con `--hoy`, fuga de clave y
  URL, inyección, rechazo dentro de un repo, brief, plantilla sin datos ni red). Smoke manual con Chromium sobre `file://`.
