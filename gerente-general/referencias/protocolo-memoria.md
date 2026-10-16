# Protocolo de memoria — "si no está escrito, no pasó"

Compartido por todas las skills. El agente solo sabe lo que está en la carpeta HQ (`referencias/hq.md`).

## 1. Paso 1 de toda skill (no solo de `gg`)

Resolver HQ (`hq.md`) y leer `CONTEXTO.md` + `memoria/pendientes.md` (secciones Hoy, Esta semana, Seguimientos).
Son cortos; se leen siempre, aunque el pedido sea "redacta un correo". Sin esto el agente contesta sin memoria.

Si `empresa.md` sigue "por confirmar" y la skill no es `gg`, **no se recorre la cola de preguntas de la primera
sesión**: se trabaja con lo que hay, lo inferido va marcado "por confirmar" en la línea Asumo, y se cierra con una
línea "quedan N preguntas de primera sesión en cola". Con "ejecuta", igual.

## 2. Al abrir con `gg`

Leer además la bitácora más reciente `memoria/sesiones/YYYY-MM-DD(-N).md` (por fecha; se ignoran los
`<fecha>-<area>.md` de subagentes) y las entradas de `decisiones.md` marcadas "en preparación" o
"pendiente" (alimentan la línea DECISIÓN). Si la última sesión no tiene bitácora (se cerró la ventana sin "cierre"),
reconstruirla desde `pendientes.md` y `decisiones.md`, marcarla "reconstruida" y decirlo. Si no existe ninguna
bitácora y `empresa.md` sigue "por confirmar", es la primera sesión: nada que reconstruir.

Brief de apertura (≤ 9 líneas, sin preámbulo):
```
VENCIDO     — T-#### título · dueño · días de atraso · nivel (o "nada")
HOY         — lo que toca hoy (máx 5)
OBRAS       — proyectos con hito o riesgo esta semana, con semáforo (o "sin novedades")
DECISIÓN    — lo que espera una decisión del gerente (o "ninguna")
RADAR       — lo nuevo desde la última sesión con impacto en la empresa (o "sin novedades")
TE DEBÍA    — lo que quedó para recordarle
PREGUNTA    — la única pregunta abierta, si hay
```

## 3. Durante la sesión — escribir al momento

| Pasa esto | Se escribe en | Cómo |
|---|---|---|
| El gerente se compromete a algo o alguien le promete algo | `pendientes.md` | línea canónica T-#### o S-#### con due y done-when |
| Se toma una decisión (o se decide no decidir) | `decisiones.md` | bloque append-only: contexto, decisión, quién, consecuencia |
| Cambia el estado de una obra o proyecto | `proyectos.md` | ficha + fila del resumen |
| Aparece una persona, cliente, proveedor, especialista | `personas.md` | fila |
| Aparece una sigla, término o apodo | `glosario.md` | fila |
| Dato de mercado, norma, bono, subsidio | `radar.md` | entrada con fuente y fecha |
| Un KPI recibe valor | `indicadores.md` | fila en Historial; alerta si cruza umbral |
| Cambia algo del caché | `CONTEXTO.md` | corregir la línea; ≤ 100 líneas |

Editar con Edit sobre la línea, no reescribir archivos. Nunca borrar: mover a Hecho o Parked.

**Escrituras que cambian estado se confirman antes** (persona.md, compuertas): cerrar, reasignar o reprogramar un
pendiente; registrar una decisión como tomada; convertir acuerdos de una reunión en pendientes con responsable y
fecha; sobrescribir datos de `CONTEXTO.md` o `empresa.md` con información inferida. Registrar y proponer no
requiere confirmación.

## 4. Cierre ("cierre", o cuando el gerente termina)

1. Escribir `memoria/sesiones/YYYY-MM-DD.md` (plantilla en `memoria/sesiones/README.md`); si ya existe, agregar un
   bloque con la hora, no sobrescribir.
2. Repasar `pendientes.md`: fechas, dueños, nada en Hoy que no sea para hoy.
3. Si cambió el caché, actualizar `CONTEXTO.md` y su línea `_Actualizado:_`.
4. Regenerar `<HQ>/dashboard.html`: `node <plugin>/herramientas/dashboard.mjs --hq <HQ>` (skill `dashboard`; es una vista
   derivada, no cambia estado; si Node no está instalado, decirlo y seguir).
5. Terminar con 5 líneas: qué se hizo, dónde quedó, qué falta, qué se le recordará, archivos tocados (el dashboard
   incluido).

La única escritura durable es la inmediata (sección 3). El cierre produce la bitácora, no la memoria.

## 5. Reglas duras

- Un pendiente pasa a Hecho solo con evidencia visible (archivo, correo citado, dato con fecha) y confirmación.
- Nada se inventa: si falta un dato, la celda dice "sin dato" y la pregunta entra a la cola.
- Confidencial nunca sale de HQ. Si HQ está dentro de un repo git, avisar y no seguir escribiendo ahí.
- Sin planificador: no hay recordatorios entre sesiones. La presión se calcula al abrir (persona.md).
