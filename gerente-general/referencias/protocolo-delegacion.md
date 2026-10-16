# Protocolo de delegación a subagentes

Mismo contrato que ORCHESTRA (`delegation-protocol.md`), con las reglas de la empresa encima.

## Antes de delegar

1. Solo se delega a lo que figura en `memoria/agentes.md › Activos` con copia en `<HQ>/agentes/`. Los `.md` de
   `propuestos/` son documentos de propuesta, **no prompts**: no se pasan al Agent tool.
2. Lanzar un agente genérico (`general-purpose`) con un brief de área equivale a usar un subagente: requiere el sí
   explícito del gerente en esa sesión. Lecturas con `Explore` / `Plan` sobre HQ sí están permitidas.
3. Nunca se delegan: decisiones de precio, contratación, despido o gasto; envíos a terceros; elegir entre dos
   caminos estratégicos. Esas se presentan al gerente reducidas a dos opciones y una recomendación.
4. Toda delegación se informa en la respuesta (a quién, qué brief, qué devolvió) y se anota en la bitácora y en
   `agentes.md` (fecha, brief). Nunca en silencio. El gerente puede pedir que se le pregunte antes de cada una.

## El brief (plantilla exacta; sin Done-when no se lanza)

```
Objetivo: <una frase, verbo primero>

Contexto:
- Empresa: <nombre> — carpeta HQ: <ruta absoluta>
- Tarea: T-#### — <título>
- Antecedentes: <archivos de memoria a leer, decisiones previas, datos>

Done-when: <condición verificable por un tercero>

Entregable: <artefacto exacto> escrito en <ruta absoluta dentro de HQ>

Límites:
- No tocar: decisiones.md, pendientes.md, CONTEXTO.md, <otros>
- Pedir aprobación antes de: <acciones irreversibles o con plata>
- Confidencial: nada sale de HQ; no usar datos reales en búsquedas externas
- Presupuesto: <alcance máximo>

Devuelve: resumen de 5 líneas + ruta del artefacto. Nada más.
```

## Paralelismo

Lanzar en un solo mensaje los que no comparten `blocked-by`, no escriben el mismo archivo y no dependen uno del
otro. Tope: 5 a la vez.

## Verificación antes de cerrar

Ninguna tarea pasa a `[x]` por reporte del subagente. Se comprueba que el artefacto existe, cumple `done-when:` y
no rompió nada de `Límites`; luego se confirma con el gerente. Si falla, vuelve a `[~]` con `note:` del motivo.
Máximo 2 reintentos; al tercero se informa al gerente.
