---
name: proyectos
description: >
  This skill should be used for the general control of works and projects — "cómo va la obra", "en qué
  está el proyecto", "estado de las obras", "control de obras", "control semanal", "hitos", "riesgos de la
  obra", "semáforo", "llegó el informe de obra", "project status", "how is the site going", "weekly
  control". It keeps memoria/proyectos.md current (state, next milestone, risk, owner, traffic light) from
  what the gerente or site reports provide, flags red items for decision and feeds pendientes.md. Never
  invents progress.
metadata:
  version: "0.2.0"
---

# Proyectos — control general de obras y proyectos

"Control general" y "seguimiento de proyectos" son las dos cosas que más tiempo le quitan al gerente. Aquí viven en
`memoria/proyectos.md` (ficha por proyecto + resumen). Compromisos sueltos: `seguimiento`. Números: `indicadores`.
Criterio de sector: `../../referencias/sector-constructora-chile.md`.

## Paso 1 — Persona y HQ

Adopta `../../referencias/persona.md`; resuelve HQ con `../../referencias/hq.md`; lee `CONTEXTO.md`,
`memoria/pendientes.md` y `memoria/proyectos.md`.

## Actualizar un proyecto (cuando llega información)

1. Fuente: lo que diga el gerente, el informe del jefe de obra o la ITO, el estado de pago. Cada dato con fuente y
   fecha; sin informe, "sin dato": **nunca se estima avance**.
2. Ficha: estado (estudio · propuesta · adjudicado · en ejecución · recepción · garantía · cerrado · perdido),
   avance físico y financiero, próximo hito (qué, fecha, responsable), riesgos (riesgo · impacto · plan · dueño),
   adicionales aprobados vs ejecutados, pendientes relacionados (T-####).
3. Semáforo: 🟢 en plan · 🟡 desviación dentro de umbral con plan · 🔴 fuera de umbral, sin plan, o adicional sin
   aprobación escrita → requiere decisión del gerente y entra al brief (línea OBRAS).
4. Fila del resumen actualizada. Valores de avance y atraso → `indicadores.md › Historial`.
5. Si el cambio genera una acción (pedir informe, aprobar adicional, visitar), proponer la línea para
   `pendientes.md`; se escribe con su OK si cambia dueño o fecha de algo existente.

## Control semanal ("cómo van las obras", lunes)

Tabla: proyecto · estado · semáforo · avance real vs programado · próximo hito y fecha · riesgo principal · qué
necesita del gerente. Orden: 🔴 primero. Cerrar con RECOMENDACIÓN (qué decidir esta semana) y SIGUIENTE ACCIÓN.
Para el informe largo con todas las obras, delegar en `gerente-general-dms` (ejecutor) con brief; informarlo.

## Reglas

- 🔴 siempre llega al gerente como una pregunta de decisión, no como narrativa.
- No contacta a jefes de obra, ITO ni mandantes: redacta la petición de información y el gerente la envía.
- Seguridad y accidentes: registrar, poner en rojo y derivar al prevencionista de `personas.md`.
- Adicionales, multas, garantías y contratos: señalar y derivar; no opinar como abogado.
