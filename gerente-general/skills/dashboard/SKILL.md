---
name: dashboard
description: >
  This skill should be used when the gerente wants to see the state of the company at a glance — "dashboard",
  "tablero", "panel", "ábreme el estado", "muéstrame todo", "regenera el dashboard", "status board", "show me the
  board", "open the dashboard". It regenerates <HQ>/dashboard.html from the memory (pendientes with pressure, obras
  with semáforo, tratos, indicadores, radar, decisiones, bitácora and the work ecosystem) and tells the gerente where
  to open it. Read-only over the memory: it never changes a file of HQ.
metadata:
  version: "0.1.0"
---

# Dashboard — la memoria en una página

El dashboard es una **vista** de la memoria: un solo archivo HTML dentro de HQ, sin servidor ni red, que se abre
con doble clic. Lo que no está en la memoria no aparece; lo que hay que cambiar se cambia en la memoria (con las
skills y sus compuertas), nunca en el dashboard. Mapa completo del ecosistema en `../../referencias/ecosistema.md`.

## Paso 1 — Persona y HQ

Adopta `../../referencias/persona.md`. Resuelve HQ con `../../referencias/hq.md`; si no existe, sigue su primera
ejecución antes de generar nada.

## Paso 2 — Generar

```bash
node <plugin>/herramientas/dashboard.mjs --hq <HQ>
```

`<plugin>` es la carpeta de este plugin (donde está `herramientas/`). Generar **no cambia estado**: no requiere
confirmación y "ejecuta" no aplica. El generador:

- lee `CONTEXTO.md` y `memoria/*.md`, calcula la presión por vencido (persona.md) y el brief de apertura;
- escribe `<HQ>/dashboard.html` (sobrescribe: la memoria es la fuente de verdad y las bitácoras son la historia);
- **nunca** lee `.leadhunter` ni `.leadhunter-url` (solo muestra si existen) y se niega a escribir dentro de un
  repositorio git o de la carpeta del plugin. Si se niega, explícalo en una línea y no insistas.

Si Node no está instalado, dilo y entrega el brief de `../../referencias/protocolo-memoria.md` §2 en el chat.

## Paso 3 — Responder

Tres líneas: la ruta del archivo (y cómo abrirlo: doble clic, o `open`/`xdg-open`/`start` sobre la ruta), los
conteos que imprime el generador (vencidos · hoy · obras 🔴 · decisiones · alertas · tratos) y, si hay algo 🔴 o un
vencido en nivel escalar, la pregunta de decisión que corresponde. Nunca pegues el JSON de `--json` en el chat: es
la memoria completa (ese modo existe para pruebas).

## Cuándo se regenera solo

- Al cerrar la sesión (`gg` Paso 4, `protocolo-memoria.md` §4): después de la bitácora y de `CONTEXTO.md`.
- En la primera ejecución de HQ (`hq.md`), para que el gerente vea la página desde el día uno.

## Reglas

- El archivo lleva la memoria completa: es tan confidencial como HQ. Si el gerente quiere compartirlo, recuérdale
  que contiene cifras, clientes y socios, y propón en su lugar un resumen redactado (`redactar`).
- Si el dashboard muestra algo que el gerente dice que ya no es así, la corrección va a la memoria con la skill
  que corresponda (`seguimiento`, `proyectos`, `decision`…) y luego se regenera.
