# Gerente General DMS — agente acompañante con memoria

Plugin para Cowork y Claude Code, **autocontenido**: trae sus doce skills, sus referencias, la persona y las plantillas de
memoria. No depende de otros plugins ni conectores del instalador (ORCHESTRA, Gmail, Drive…); LeadHunter es opcional y
tiene camino manual. Está hecho para otro usuario (Diego, gerente general de DMS): se instala en su máquina y trabaja
desde su carpeta privada.

Quién conversa con el gerente es la **sesión principal con la persona** (`referencias/persona.md`), que cada skill
adopta en su Paso 1. El archivo `agents/gerente-general-dms.md` es solo un ejecutor delegable para trabajo largo.
Memoria privada fuera del repo, LeadHunter con la cuenta del gerente, y subagentes por área que **solo se crean con
aprobación**.

Diseño: `docs/superpowers/specs/2026-10-16-agente-gerente-general-design.md` (sale del cuestionario que respondió Diego).

## Qué hace

| Pedido típico | Skill | Qué entrega |
|---|---|---|
| "GG, en qué vamos" · "cierre" | `gg` | brief de apertura desde la memoria; cola de preguntas de la primera sesión; bitácora al cerrar |
| "look & fill DMS" · "lee la página" | `look-and-fill-dms` | perfil de la empresa con fuentes en `empresa.md` (web = "por confirmar" hasta que él valide) |
| "anota" · "qué está vencido" | `seguimiento` | pendientes con dueño y fecha; presión por días de atraso; nada se cierra sin su OK |
| "cómo va la obra" · "control semanal" | `proyectos` | tablero de obras con semáforo, hitos y riesgos; 🔴 = decisión |
| "ayúdame a decidir" · "cuestióname" | `decision` | ficha de decisión: opciones, riesgos, contrapeso, recomendación, quién decide |
| "reunión de socios" · "resumen de la reunión" | `reunion` | agenda con decisiones a pedir; resumen con acuerdos → pendientes |
| "cierres" · "qué le respondo" | `cierres` | tablero de tratos, objeción y respuesta, mensaje listo (Diego envía) |
| "busca proyectos" · "prospectos" | `cazar-proyectos` | LeadHunter con tu cuenta (confirma créditos antes) + ángulos de obra con fuente |
| "radar" · "bonos" · "normas" | `radar` | novedades con fuente, fecha e impacto en DMS |
| "indicadores" · "cómo vamos en números" | `indicadores` | KPIs con umbral, registro de valores, alertas |
| "redacta" · "write an email" | `redactar` | borrador en la voz de DMS, es-CL o inglés; nunca envía |
| "crea un subagente de finanzas" | `crear-subagente` | propuesta de una pantalla → solo con "sí, créalo" escribe e instala |

Lo que **nunca** hace, ni con "ejecuta": decidir solo, enviar o contactar a terceros, gastar sin confirmar, crear o
lanzar subagentes sin un sí explícito, cerrar pendientes o registrar decisiones sin su OK, sacar información
confidencial de la carpeta HQ, inventar cifras o fuentes.

## Instalar (en la máquina del gerente)

1. **Cowork:** `npm run plugin:pack` genera `gerente-general.plugin`; se instala con el botón "Aceptar" sobre ese
   archivo. Conecta una carpeta privada llamada `DMS` (o una carpeta que la contenga): ahí vivirá la memoria.
2. **Claude Code:** `claude plugin marketplace add hk23hub-dotcom/vice-os-artifact` y luego instala `gerente-general`;
   o copia `agents/`, `skills/` y `referencias/` a `~/.claude/`. Agrega el bloque de `CLAUDE.md` a `~/.claude/CLAUDE.md`.
3. Primera sesión: di **"GG"**. El agente pregunta una vez dónde guardar la memoria (propone `~/DMS`, nunca dentro de
   un repo), copia las plantillas, recorre la cola de preguntas abiertas y propone `look-and-fill-dms`.
4. **LeadHunter con la cuenta del gerente (opcional):** en la app → *Agentes* → *Crear clave*. La skill
   `cazar-proyectos` pide la clave y la URL una vez y las guarda en `<HQ>/.leadhunter` y `<HQ>/.leadhunter-url`
   (nunca en la memoria ni en un repo). Prueba:
   ```bash
   node gerente-general/herramientas/leadhunter.mjs --hq ~/DMS infer --url https://www.dmsinversiones.cl --dry-run
   ```
   Sin Node o sin clave, la skill entrega el brief para pegar en la app y normaliza el CSV que él exporte.

## Memoria (dónde vive y por qué no está aquí)

Este repo es público. El plugin trae **plantillas** en `memoria/` (marcadas `PLANTILLA: sin datos reales`); la memoria
real (socios, cifras, clientes, proyectos, decisiones, bitácora) vive en la carpeta privada HQ:

`$DMS_HQ` → `$HOME/mnt/DMS` → `$HOME/mnt/*/DMS` → `~/DMS` → `./DMS` solo fuera de un repo git (primer acierto;
`referencias/hq.md`). `.gitignore` y `.vercelignore` ignoran `DMS/`. Regla de la casa: si no está escrito en la
memoria, no pasó.

## Subagentes

`propuestos/` trae cinco borradores: finanzas, comercial y marketing (los que el gerente nombró) más obras y personas
(sugeridos por el agente, no pedidos). No están cargados y no son prompts. Se crean uno a uno en `<HQ>/agentes/`
cuando él lo aprueba, vía `crear-subagente`, y quedan registrados en `memoria/agentes.md`.

## Estructura

```
gerente-general/
├── .claude-plugin/plugin.json
├── agents/gerente-general-dms.md      ejecutor delegable (trabajo largo); la persona vive en referencias/
├── skills/<12 skills>/SKILL.md        cada una adopta la persona y resuelve HQ en su Paso 1
├── referencias/                       persona, hq, protocolo de memoria, formato, fichas, sector, fuentes, agent-spec
├── memoria/                           PLANTILLAS (se copian a DMS/ privado)
├── propuestos/                        borradores de subagentes (no cargados)
├── herramientas/leadhunter.mjs        cliente LeadHunter (cuenta propia, sin dependencias)
└── CLAUDE.md                          bloque para ~/.claude/CLAUDE.md
```

Pruebas: `npm test` (desde la raíz del repo).

## Reutiliza

Formato de agente, gramática de tareas y protocolo de delegación de **ORCHESTRA**; memoria en dos niveles del plugin
**productivity**; compuertas de aprobación de **small-business:build-agent**; "la máquina propone, el humano decide"
de la **constitución HK23**; caza con fuentes reales de **LeadHunter**; CierreSocio, ObjeciónMaestro, PropuestaForge,
ObraHunter y LicitaHunter de **El Centro**.
