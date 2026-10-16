---
name: redactar
description: >
  This skill should be used to write anything that leaves the company in the gerente's name — "redacta",
  "escribe un correo", "mensaje para el cliente", "comunicado", "informe", "carta", "respuesta a", "en
  inglés", "write an email", "draft a report", "reply to this". It drafts in the company's voice (Chilean
  Spanish or English), with the image the gerente cares about, and returns a draft for him to send. No
  sending channel exists today; if one is added later, every send needs his explicit approval.
metadata:
  version: "0.2.0"
---

# Redactar — correos, comunicados e informes en la voz de la empresa

El gerente cuida el trato con clientes y la imagen de la empresa: todo lo que sale tiene que estar impecable.
Voz: `memoria/empresa.md › Voz de la marca`; personas y cómo prefieren que les lleguen los temas: `memoria/personas.md`.

## Paso 1 — Persona y HQ

Adopta `../../referencias/persona.md`; resuelve HQ con `../../referencias/hq.md`; lee `CONTEXTO.md`,
`memoria/pendientes.md` y lo que toque de `personas.md`, `proyectos.md`, `decisiones.md`.

## Pasos

2. Aclarar solo lo que falte: destinatario, objetivo (informar / pedir / cerrar / resolver), tono (formal, cercano,
   ejecutivo, crítico), idioma. Una pregunta; con "ejecuta", asumir y marcarlo.
3. Traer el contexto: historial con esa persona, acuerdos previos, cifras con fuente.
4. Escribir según el tipo:
   - **Correo**: asunto ≤ 6 palabras; primera línea con el punto; ≤ 120 palabras; una sola petición al final; firma
     del gerente.
   - **WhatsApp**: 4–6 líneas, natural, una pregunta de cierre.
   - **Comunicado** (equipo, clientes, socios): qué pasa, qué cambia para ellos, desde cuándo, a quién preguntar.
   - **Informe** (socios, inversionistas, cliente): resumen de 5 líneas arriba; datos con fuente; riesgos;
     decisiones que se piden; siguiente paso. Tablas antes que párrafos.
   - **Respuesta a reclamo**: reconocer, hechos, qué haremos y cuándo, quién responde.
5. Revisar: nombres y fechas correctos, cifras con fuente, nada confidencial que no corresponda al destinatario,
   sin "estimado" ni relleno, lectura en voz alta de 20 segundos.
6. Entregar como `OUTPUT` listo para copiar; `SIGUIENTE ACCIÓN: <gerente> · enviar · <fecha>`. Si se prometió
   algo, proponer la línea para `pendientes.md`.

## Reglas

- **No envía ni publica.** Hoy no hay canal; si se conecta uno, cada envío concreto se aprueba antes (persona.md).
- Cláusulas contractuales, garantías, finiquitos, cartas laborales → borrador marcado "revisar con abogado".
- Inglés natural, no traducción literal; medidas y monedas como las usa el destinatario.
- Dos versiones solo si el gerente lo pide o el tono es ambiguo.
