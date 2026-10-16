---
name: seguimiento
description: >
  This skill should be used to capture and chase commitments for the gerente — "anota", "pendiente",
  "recuérdame", "quedó de", "me prometió", "seguimiento", "qué está vencido", "presióname con esto",
  "control general", "note this", "remind me", "follow up", "what's overdue". It writes canonical task
  lines in memoria/pendientes.md, computes the pressure level of overdue items when the session opens and
  proposes the next step; it never closes, reassigns or reschedules an item without the gerente's OK.
metadata:
  version: "0.2.0"
---

# Seguimiento — pendientes y compromisos

El gerente no puede abarcar todo; esta skill lleva el orden y los tiempos por él. Gramática en la cabecera de
`memoria/pendientes.md`; presión y compuertas en `../../referencias/persona.md`. Obras y proyectos: `proyectos`.

## Paso 1 — Persona y HQ

Adopta `../../referencias/persona.md`; resuelve HQ con `../../referencias/hq.md`; lee `CONTEXTO.md` y
`memoria/pendientes.md`. Todas las escrituras van a `<HQ>/memoria/pendientes.md`.

## Capturar (cuando el gerente cuenta algo)

1. Partir en ítems atómicos: una frase con "y" son dos líneas.
2. Cada ítem → `- [ ] T-#### | P? | proj:<slug> | resp:<quién> | due:YYYY-MM-DD | Título` con `done-when:`
   verificable. Si falta la fecha, proponer una ("¿jueves 23?"); si no contesta, ponerla con
   `note: fecha propuesta por GG`.
3. Lo que un tercero prometió → sección **Seguimientos**: `S-#### | quién | qué | due | nivel:recordar`.
4. Devolver solo IDs y títulos agregados, una línea cada uno. Capturar no requiere confirmación.

## Revisar ("qué está vencido", brief)

1. Listar vencidos con días de atraso y dueño. Nivel por días desde `due:` (persona.md): 0–2 recordar,
   3–6 insistir (qué se pierde + acción de 15 minutos), ≥ 7 escalar (pregunta: nueva fecha, reasignar o soltar).
   Escribir el nivel en `note:`.
2. Siguiente paso concreto por ítem (quién, qué, cuándo). Si es del gerente, decírselo; si es del agente, hacerlo.
3. Más de 5 líneas en `## Hoy` no es un plan: decirlo y proponer cuáles bajan.

## Cerrar, reasignar, reprogramar (con compuerta)

- Pasa a `## Hecho` solo con evidencia (archivo, correo citado, dato con fecha) **y** el OK del gerente en ese
  turno. Sin evidencia: "¿me muestras cómo quedó?" y sigue `[~]`.
- Reasignar o cambiar `due:` se propone y se aplica con su sí. Nunca borrar: Hecho o Parked con
  `note: se desbloquea cuando …`.

## Reglas

- El agente no contacta al tercero: redacta el mensaje de cobro (`redactar`) y el gerente lo envía.
- Sin recordatorios entre sesiones (no hay planificador): la presión se calcula al abrir.
- Siguiente ID: `grep -o "T-[0-9]\{4\}" pendientes.md | sort | tail -1` + 1. Nunca se reutiliza.
