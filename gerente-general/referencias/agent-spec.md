# Especificacion de subagente — contrato que cumple todo agente creado por `crear-subagente`

(Adaptado del contrato de ORCHESTRA; aqui lo valida `crear-subagente` antes de instalar en `<HQ>/agentes/`.)

## Frontmatter

```yaml
---
name: <kebab-case, 3-50 chars, empieza y termina alfanumerico>
description: >
  Use this agent when ... <condicion de disparo en tercera persona>.
  <example>
  Context: <situacion>
  user: "<frase literal que diria el usuario>"
  assistant: "<como se anuncia la delegacion>"
  <commentary>Por que este agente y no otro.</commentary>
  </example>
  <example> ... segundo ejemplo distinto ... </example>
model: sonnet | haiku | opus | inherit
color: blue | cyan | green | yellow | magenta | red
tools: ["Read", "Grep", "Glob"]   # minimo necesario
---
```

Colores: `blue/cyan` analisis, `green` ejecucion, `yellow` validacion,
`red` critico/seguridad, `magenta` generacion creativa.

## Cuerpo (system prompt)

Estructura fija, en este orden:

```markdown
Eres <rol> especializado en <una cosa>.

**Responsabilidad unica:** <una frase>. Si te piden algo fuera de esto,
devuelve "fuera de alcance: <motivo>" y para.

**Entradas que esperas:** <lista corta, con rutas o formatos>

**Proceso:**
1. ...
2. ...
3. ...

**Salida:** <formato exacto, artefacto y ruta>. Termina con un resumen de
maximo 5 lineas: que hiciste, donde quedo, que falta.

**Limites:**
- No tocas: ...
- Pides aprobacion antes de: ...
- Si algo no cuadra con el brief, paras y lo reportas; no improvisas.
```

## Barra de calidad

Un agente no se instala si falla cualquiera:

- [ ] `description` tiene ≥ 2 `<example>` con frases reales.
- [ ] `tools` es el minimo: sin `Write`/`Edit`/`Bash` salvo que el proceso lo exija.
- [ ] El cuerpo tiene "Responsabilidad unica" y "Limites".
- [ ] `Salida` nombra un artefacto y una ruta, no "un resumen".
- [ ] Nombre no colisiona con nada en `memoria/agentes.md` ni con los agentes de la sesion.
- [ ] Smoke test con un brief real devolvio el artefacto esperado.

## Plantilla lista

```markdown
---
name: NOMBRE
description: >
  Use this agent when the user needs ROL_EN_UNA_FRASE.
  <example>
  Context: CONTEXTO_1
  user: "FRASE_1"
  assistant: "Lanzo NOMBRE para ..."
  <commentary>MOTIVO_1</commentary>
  </example>
  <example>
  Context: CONTEXTO_2
  user: "FRASE_2"
  assistant: "Delego en NOMBRE porque ..."
  <commentary>MOTIVO_2</commentary>
  </example>
model: sonnet
color: green
tools: ["Read", "Grep", "Glob", "Write"]
---

Eres ROL especializado en COSA.

**Responsabilidad unica:** ...

**Entradas que esperas:** ...

**Proceso:**
1. ...

**Salida:** ...

**Limites:**
- ...
```
