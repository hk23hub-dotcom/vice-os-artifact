---
name: look-and-fill-dms
description: >
  This skill should be used when the agent must learn or refresh what the company is — "look & fill",
  "look and fill DMS", "lee la página de DMS", "interiorízate en la empresa", "actualiza el perfil de la
  empresa", "mira la web y llena la memoria", "te paso este documento de la empresa", "learn the company",
  "read our website" — or on the first session when memoria/empresa.md still says "por confirmar". It reads
  the company website and any document the gerente hands over, fills empresa.md with sourced facts marked
  "web, por confirmar" until he validates them, and asks the gaps one at a time. Initial interpretation of
  the gerente's "LOOK & FILL DMS" skill name, to be confirmed with him.
metadata:
  version: "0.2.0"
---

# Look & Fill DMS

Mirar la empresa con ojos de gerente general y dejarla escrita en la memoria, con fuente y fecha.
(Interpretación inicial del nombre que dio el gerente; `gg` lo confirma en la primera sesión.)

## Paso 1 — Persona y HQ

Adopta `../../referencias/persona.md`; resuelve HQ con `../../referencias/hq.md`; lee `CONTEXTO.md` y
`memoria/pendientes.md`. Abre `<HQ>/memoria/empresa.md` y anota qué sigue "por confirmar". Lee también
`../../referencias/sector-constructora-chile.md` para mirar con criterio de sector.

## Pasos

2. **Leer la web** (URL en `CONTEXTO.md`): portada y subpáginas (servicios, proyectos, nosotros, contacto). Si la
   red no deja, dilo en una línea y pide al gerente que pegue el texto o un PDF; no inventes.
3. **Leer lo que entregue el gerente** (brochures, propuestas, organigrama, planillas). Confidencial: queda en HQ.
4. **Escribir en `<HQ>/memoria/empresa.md`**, cada dato con `(fuente: web | gerente | <documento>, YYYY-MM-DD)`.
   Lo que viene de la web se marca **"(web, por confirmar)"** y solo pierde la marca cuando el gerente lo valida.
   Cubre: identidad, líneas y qué incluye cada una, cliente típico, ticket y plazo típico, propuesta de valor,
   zona, proyectos de referencia, equipo y áreas, cómo vende hoy, voz de la marca.
5. **Lectura del GG**: 3 líneas al final bajo "Lectura del GG" (dónde está la plata, dónde se traba la venta, qué
   no dice la web y debería). Marcadas como opinión.
6. **Preguntar los vacíos de a uno**, por orden de impacto en las respuestas del agente, hasta cerrarlos: líneas
   que pesan en ventas → zona → socios y áreas → proyectos en curso → canal de llegada de clientes → voz. Sin tope:
   lo que no se sabe, se pregunta; lo que queda pendiente entra a la cola y se dice en una línea.
7. **Actualizar `CONTEXTO.md`** (bloque Empresa) solo con lo validado; lo inferido va con "por confirmar".
   Términos nuevos → `glosario.md`; personas → `personas.md`; proyectos → `proyectos.md`.
8. Cerrar T-0001 en `pendientes.md` cuando Identidad, Qué hace y Clientes no tengan "por confirmar", con el OK
   del gerente.

## Reglas

- Nada se escribe sin fuente. Lo que la web no dice se pregunta; no se deduce como hecho.
- Las plantillas del plugin no se tocan; todo va a la copia en HQ.
- Repetir cuando la web cambie o haya material nuevo: actualizar, no reescribir.
- Una pregunta por turno; "ejecuta" solo suprime preguntas, no la marca "por confirmar".
