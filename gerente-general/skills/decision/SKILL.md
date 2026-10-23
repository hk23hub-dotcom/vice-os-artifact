---
name: decision
description: >
  This skill should be used when the gerente has to decide something and wants it prepared, challenged or
  structured — "ayúdame a decidir", "qué harías", "opciones", "cuestióname", "hazme de contrapeso",
  "conviene o no", "tomamos esta obra?", "subo el precio?", "lo llevo a socios?", "pros y contras",
  "help me decide", "push back on this", "what would you do". It produces a one-page decision sheet
  (context, data, options with risks and costs, counterweight, recommendation, specialist flag, who
  decides) and never records the decision as taken until the gerente says so.
metadata:
  version: "0.2.0"
---

# Decisión — ficha, contrapeso y recomendación

El agente prepara y cuestiona; el gerente (o los socios) deciden. Plantilla en `../../referencias/ficha-decision.md`.

## Paso 1 — Persona y HQ

Adopta `../../referencias/persona.md`; resuelve HQ con `../../referencias/hq.md`; lee `CONTEXTO.md`,
`memoria/pendientes.md` y lo que toque de `empresa.md`, `proyectos.md`, `indicadores.md`, `radar.md`.

## Pasos

2. **Objetivo real** y fecha. Si la fecha no existe, proponerla.
3. **Datos**: de la memoria y de lo que entregue el gerente. Cada número con fuente y fecha; lo que falta, "sin
   dato" + supuesto explícito. Nunca inventar.
4. **Opciones**: mínimo dos más "no hacer nada". Por opción: qué implica, plata, riesgo principal, qué gana la
   empresa, si es reversible.
5. **Contrapeso**: la objeción más fuerte a la opción que el gerente parece preferir, y qué tendría que ser cierto
   para que la descartada fuera la correcta. Directo; para eso lo pidió.
6. **Recomendación**: una opción, una razón, una condición, la señal de alarma para revertir.
7. **Quién decide**: él solo o socios. Por defecto, si toca plata, compromisos externos o personas, la ficha dice
   "Para socios: sí" con el porqué, aunque él pueda decidirlo solo (prefiere transparencia y alineamiento).
   Anotar quién debe enterarse.
8. **Especialista**: si hay tema legal, tributario, laboral o financiero complejo, nombrarlo (de `personas.md`) y
   dejar escrita la pregunta exacta que debe responder; el agente no opina como experto sobre el caso.
9. **Escribir**: la ficha en `<HQ>/memoria/decisiones.md` con estado "en preparación". Se cierra el bloque (decisión,
   quién, consecuencia) **solo cuando el gerente comunique la decisión**; entonces se crean los pendientes.

## Formato

`RECOMENDACIÓN` (1–3 líneas o "va a socios: ficha lista") → `PASOS` → `OUTPUT` (la ficha completa) →
`SIGUIENTE ACCIÓN` (quién, qué, fecha).

## Reglas

- "Ejecuta": entregar la ficha sin preguntas de aclaración; supuestos al final. No registra la decisión como tomada.
- Si un dato cambia la recomendación: una sola pregunta, con la opción por defecto.
- Nunca "vamos con A". Sí "recomiendo A".
