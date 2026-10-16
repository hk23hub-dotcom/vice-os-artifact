---
name: dashboard
description: >
  This skill should be used when the gerente wants to see the state of the company at a glance in one page —
  "dashboard", "abre el dashboard", "regenera el dashboard", "muéstrame todo en una página",
  "what's on the dashboard", "open the dashboard", "refresh the dashboard". It regenerates <HQ>/dashboard.html from the memory
  (pendientes with pressure, obras with semáforo, tratos, indicadores, radar, decisiones, bitácora and the work
  ecosystem) and tells the gerente where to open it. It never changes the memory files: it only writes
  dashboard.html inside HQ.
metadata:
  version: "0.2.0"
---

# Dashboard — la memoria en una página

El dashboard es una **vista** de la memoria: un solo archivo HTML dentro de HQ, sin servidor ni red, que se abre
con doble clic y recalcula la presión por vencido con la fecha del día en que se abre. Lo que no está en la memoria
no aparece; lo que hay que cambiar se cambia en la memoria (con las skills y sus compuertas), nunca en el
dashboard. Mapa completo del ecosistema en `../../referencias/ecosistema.md`.

## Paso 1 — Persona y HQ

Adopta `../../referencias/persona.md`. Resuelve HQ con `../../referencias/hq.md`; si no existe, sigue su primera
ejecución antes de generar nada.

## Paso 2 — Generar

```bash
node ../../herramientas/dashboard.mjs --hq <HQ>
```

La ruta es relativa a esta carpeta de skill (`herramientas/` está en la raíz del plugin). Generar **no cambia
estado**: no requiere confirmación y "ejecuta" no aplica. El generador:

- lee `CONTEXTO.md` y `memoria/*.md`, calcula la presión por vencido (persona.md) y el brief de apertura;
- escribe `<HQ>/dashboard.html` (sobrescribe: la memoria es la fuente de verdad y las bitácoras son la historia);
- **nunca** lee `.leadhunter` ni `.leadhunter-url` (solo muestra si existen) y se niega a escribir fuera de HQ,
  dentro de un repositorio git o de la carpeta del plugin. Si se niega, explícalo en una línea y no insistas.

Si Node no está instalado, dilo y entrega el brief de `../../referencias/protocolo-memoria.md` §2 en el chat.

## Paso 3 — Responder

Tres líneas: dónde está el archivo y cómo abrirlo (Claude Code: la ruta, doble clic o `open`/`xdg-open`/`start`;
Cowork: "está en tu carpeta DMS conectada → `dashboard.html`", porque la ruta que ve el agente es la del sandbox),
los conteos que imprime el generador (vencidos · hoy · obras 🔴 · decisiones · alertas · tratos) y, si hay algo 🔴 o
un vencido en nivel escalar, la pregunta de decisión que corresponde. Si el archivo lleva días sin regenerarse, la
página misma lo avisa ("generado hace N días") y la presión se muestra al día igual. Nunca pegues el JSON de
`--json` en el chat: es la memoria completa (ese modo existe para pruebas).

## Cuándo se regenera solo

- Al cerrar la sesión (`gg` Paso 4, `protocolo-memoria.md` §4): después de la bitácora y de `CONTEXTO.md`.
- En la primera ejecución de HQ (`hq.md`), para que el gerente vea la página desde el día uno.

## Reglas

- El archivo lleva la memoria completa: es tan confidencial como HQ. Si el gerente quiere compartirlo, recuérdale
  que contiene cifras, clientes y socios, y propón en su lugar un resumen redactado (`redactar`).
- Si el dashboard muestra algo que el gerente dice que ya no es así, la corrección va a la memoria con la skill
  que corresponda (`seguimiento`, `proyectos`, `decision`…) y luego se regenera.
- "tablero" a secas no es esta skill: es el tablero de obras (`proyectos`) o de tratos (`cierres`).
