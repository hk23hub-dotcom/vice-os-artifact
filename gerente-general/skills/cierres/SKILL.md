---
name: cierres
description: >
  This skill should be used to drive open deals to a close — "cierres", "cómo cierro esto", "el cliente no
  responde", "me dijo que lo iba a pensar", "tratos abiertos", "semana de cierre", "objeción", "propuesta
  para", "qué le respondo", "close this deal", "objection", "open deals", "proposal". It keeps a board of
  open deals in pendientes.md (Seguimientos), prepares the next step, the likely objection and its answer,
  drafts the message the gerente sends, and when he asks for the deal review it pushes on every deal without
  a next step. Adapted from El Centro's CierreSocio, ObjeciónMaestro and PropuestaForge. Never sends.
metadata:
  version: "0.2.0"
---

# Cierres — tratos abiertos hasta cerrar

"Cierres" es una de las cuatro cosas que más tiempo le quitan al gerente (interpretado como cierre de ventas;
`gg` lo confirma en la primera sesión; si también es cierre de mes, eso lo cubre `indicadores`).

## Paso 1 — Persona y HQ

Adopta `../../referencias/persona.md`; resuelve HQ con `../../referencias/hq.md`; lee `CONTEXTO.md`,
`memoria/pendientes.md` (Seguimientos) y `memoria/empresa.md` (diferenciales, voz).

## Tablero (en `<HQ>/memoria/pendientes.md › Seguimientos`)

Una línea por trato: `- [ ] S-#### | <cliente · proyecto> | etapa:<contacto|visita|propuesta|negociación|firma> |
monto:<UF, CLP o "sin dato"> | due:<fecha de decisión> | nivel:<recordar|insistir|escalar>` + hija obligatoria
`next: <quién hace qué y cuándo>`. Un trato sin `next:` es un trato que se enfría.

## Pasos por trato

2. **Estado real**: qué dijo el cliente, cuándo, qué falta para firmar. Sin dato → una pregunta.
3. **Objeción probable** y respuesta en una frase (precio, plazo, confianza, "lo voy a pensar", competencia),
   con los diferenciales de `empresa.md` y lo aprendido en tratos anteriores de la memoria.
4. **Siguiente paso de baja fricción**: una pregunta que se responde con "sí" o una palabra ("¿Te paso la
   propuesta ajustada el jueves?"), nunca "¿te interesa?".
5. **Mensaje listo** (WhatsApp 4–6 líneas / correo con asunto ≤ 6 palabras): gancho con un dato real del cliente,
   qué gana con decidir ahora, cierre de baja fricción. Tutear o no según el cliente. El gerente lo envía.
6. **Propuesta** si hace falta: estructura (incluye, excluye, plazo, precio, condiciones, validez) con los
   diferenciales; los números los pone el gerente o finanzas.
7. Escribir `next:` y `due:`; cambio de etapa → `proyectos.md`. Cambiar `due:` o dar un trato por perdido se
   propone y se aplica con su OK.

## Revisión de tratos ("cierres", "semana de cierre")

Cuando el gerente la pide (la cadencia se acuerda en la primera sesión): todos los tratos abiertos por fecha de
decisión; por cada uno etapa, `next:` y nivel. Preguntar por los que no tienen `next:`, uno a uno. Los que llevan
2 semanas sin movimiento: proponer "¿lo damos por perdido o lo reactivamos con X?". Perdidos → `## Hecho` con
`note: perdido · motivo`, con su OK.

## Reglas

- Nunca enviar ni contactar; nunca prometer plazos, precios ni alcances sin confirmación del gerente.
- Precios y condiciones con plata grande → ficha de `decision`; por defecto "para socios: sí".
- Cláusulas, garantías, boletas → especialista legal de `personas.md`; el agente no redacta contratos.
