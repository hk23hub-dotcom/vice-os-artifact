---
name: crear-subagente
description: >
  This skill should be used when the gerente wants a new area agent or the Gerente General finds a
  capability gap — "crea un subagente", "crea un agente que", "necesito un subagente para", "necesito un
  agente de finanzas", "arma el equipo de agentes", "un agente para obras", "qué agentes necesita la
  empresa", "spawn an agent", "create a subagent that", "build me an agent for". It shows what already
  covers the job and asks, presents a one-screen proposal, waits for the gerente's explicit yes to that
  proposal, and only then writes the agent file (ORCHESTRA agent spec) into the private HQ folder,
  registers it in memoria/agentes.md and smoke-tests it. Never ORCHESTRA's spawn-agent for this company.
metadata:
  version: "0.2.0"
---

# Crear subagente — solo con aprobación

El gerente lo dijo así: "lo analizaremos en conjunto antes de crear agentes sin que yo sepa, yo soy el que maneja
todo". Contrato: `../../referencias/agent-spec.md`. Delegación: `../../referencias/protocolo-delegacion.md`.
Borradores para proponer: `../../propuestos/` (documentos de propuesta, **no prompts**: no se pasan al Agent tool).

## Paso 1 — Persona y HQ

Adopta `../../referencias/persona.md`; resuelve HQ con `../../referencias/hq.md`; lee `CONTEXTO.md`,
`memoria/pendientes.md` y `memoria/agentes.md`.

## Pasos

2. **Mostrar lo que ya existe.** Revisar `agentes.md`, las skills de este plugin y los agentes y skills de la sesión.
   Si algo cubre el trabajo (encaje ≥ 0.7), decirlo y preguntar: "¿usamos este o creamos uno nuevo?". Nunca un no
   silencioso. Un gap puntual suele resolverse con un buen brief; un rol recurrente justifica un agente.
3. **Propuesta de una pantalla** (en el chat):
   ```
   AGENTE PROPUESTO: dms-<area>
   Trabajo único: <una frase>          Lo que NO hace: <decidir, enviar, contratar…>
   Entradas: <qué lee de HQ>           Salida: <artefacto y ruta en HQ>
   Tools mínimas: <lista>              Modelo: sonnet | haiku | opus (por qué)
   Por qué no lo cubre algo existente: <una línea>
   Riesgos y compuertas: <…>
   ¿Lo creo?
   ```
   Si hay borrador en `propuestos/`, mostrar ese (los de obras y personas fueron sugeridos por el agente, no
   pedidos por el gerente; decirlo). Las áreas que él nombró: finanzas, comercial, marketing; preguntar si ventas y
   crecimiento van dentro de comercial.
4. **Esperar un sí explícito a esa propuesta** ("dale", "ok, hazlo", "sí"). Un "ejecuta" genérico no aprueba;
   cualquier otra respuesta es no.
5. **Escribir** `<HQ>/agentes/dms-<area>.md` cumpliendo el spec (≥ 2 `<example>`, responsabilidad única, límites,
   salida con ruta en HQ). El archivo no contiene datos de la empresa, solo rutas a `memoria/*`. Nunca sobrescribir:
   versionar (`-v2`). Nunca escribir bajo la carpeta del plugin ni bajo un repositorio.
6. **Instalar** además en `~/.claude/agents/` si existe `~/.claude/` (Claude Code). En Cowork el subagente aprobado
   se usa pasando su `.md` como brief al Agent tool. Decir las rutas escritas.
7. **Registrar** en `memoria/agentes.md › Activos` (cubre / no cubre / creado) y anotar en `decisiones.md`.
8. **Prueba**: lanzarlo con un brief real de 3 líneas de `pendientes.md` (informarlo). Si falla, corregir antes de
   darlo por instalado. Reportar: nombre, modelo, rol, rutas, resultado.

## Límites de todo subagente de la empresa

No decide, no envía, no contacta terceros, no gasta. No lee ni escribe fuera de HQ. Confidencial no sale a búsquedas
externas. Un agente, un trabajo: si la descripción necesita "y", son dos.
