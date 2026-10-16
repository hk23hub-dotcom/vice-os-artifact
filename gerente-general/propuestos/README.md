# Subagentes propuestos — NO están instalados

Borradores de los cinco agentes de área que DMS podría necesitar. **No se cargan**: esta carpeta no es `agents/`.
Pasan a `agents/` solo cuando Diego dice "sí, créalo" a través de la skill `crear-subagente`, que además los
registra en `memoria/agentes.md` y los prueba con un brief real.

| Borrador | Área | Trabajo único |
|---|---|---|
| `dms-finanzas.md` | finanzas | caja, cobranza, márgenes y desviaciones por obra a partir de los datos que entregue Diego |
| `dms-comercial.md` | comercial y ventas | pipeline, propuestas, objeciones y cierres |
| `dms-marketing.md` | marketing | presencia, contenido y campañas que traigan proyectos |
| `dms-obras.md` | obras y proyectos | avance, plazos, hitos y riesgos por obra |
| `dms-personas.md` | equipo | que los equipos funcionen: roles, cargas y conversaciones difíciles |

Todos cumplen `referencias/agent-spec.md` y los límites comunes: no deciden, no envían, no contactan terceros, no
gastan, no salen de `DMS/`.
