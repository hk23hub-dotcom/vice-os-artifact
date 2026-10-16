---
name: indicadores
description: >
  This skill should be used to define, record and review the company's key numbers and alert on
  deviations — "indicadores", "KPIs", "cómo vamos en números", "revisión semanal", "revisión mensual",
  "cierre de mes", "me llegaron los números", "margen de la obra", "cómo va la caja", "desviación",
  "metrics", "how are the numbers", "month-end review". It proposes a starter set for a growing
  construction company, keeps memoria/indicadores.md with sources and thresholds approved by the gerente,
  and flags anything that crosses a threshold. Never invents a value.
metadata:
  version: "0.2.0"
---

# Indicadores — definir, registrar, alertar

El gerente no tiene definidos sus indicadores (cuestionario A12). Set de partida y cómo arrancar:
`../../referencias/indicadores-constructora.md`. Estado: `memoria/indicadores.md`.

## Paso 1 — Persona y HQ

Adopta `../../referencias/persona.md`; resuelve HQ con `../../referencias/hq.md`; lee `CONTEXTO.md`,
`memoria/pendientes.md` y `memoria/indicadores.md`.

## Definir (T-0002) — con compuerta

2. Proponer **5 KPIs** para la semana 1: pipeline ponderado, tratos por cerrar en 7 días, avance físico vs
   programado por obra, caja disponible vs compromisos 30 días, cobranza vencida. Una línea de porqué cada uno.
3. Por KPI acordar: definición exacta, fuente del dato, quién lo entrega, qué día, umbral de alerta. Una pregunta
   por turno. **Nada se alerta hasta que el set, los umbrales y la cadencia tengan su OK**; hasta entonces quedan
   "(propuesto, por confirmar)" en `indicadores.md`.
4. Mensuales (ventas, margen por obra, desviación de presupuesto, atraso, nuevos proyectos, reclamos) se activan
   cuando haya datos limpios y su OK.

## Registrar (cuando llegan números)

5. Cada valor → "Historial de valores" con fuente y fecha. Lo que no viene → "sin dato" + pendiente para quien lo
   debe. Nunca estimar sin decir "estimado por GG a partir de X".
6. Contrastar con umbral aprobado. Si cruza → "Alertas activas": KPI, valor vs umbral, qué propongo, estado. Alerta
   que exige decisión (plata, plazo, personas) → `decision`; operativa → `seguimiento` o `proyectos`.

## Revisar (según la cadencia acordada; "cierre de mes" = revisión mensual completa)

Tabla KPI · valor · vs umbral · tendencia (3 últimas) · qué hacer. Cerrar con RECOMENDACIÓN y SIGUIENTE ACCIÓN, y
la lista de datos que faltan para cerrar el mes.

## Reglas

- UF o CLP según la fuente; conversiones con tipo de cambio y fecha.
- Márgenes, deuda, impuestos: análisis sí; asesoría contable o tributaria no → especialista de `personas.md`.
- Dashboard: primero datos confiables; el dashboard es otro pedido.
