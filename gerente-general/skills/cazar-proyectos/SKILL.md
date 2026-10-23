---
name: cazar-proyectos
description: >
  This skill should be used to find new projects and clients — "busca proyectos", "nuevos proyectos",
  "prospectos", "clientes nuevos", "cazar", "LeadHunter", "quién está construyendo en", "licitaciones",
  "permisos de edificación nuevos", "find projects", "prospects", "new clients", "tenders". It runs
  LeadHunter with the gerente's own account (API key stored in the private HQ folder), only after he
  confirms the credit cost, saves results in HQ memoria/prospectos and the follow-ups in pendientes.md, and
  adds construction-specific angles (permits, SEIA, public tenders) with real sources. Works without the
  tool too: it hands over the hunt brief to paste into the LeadHunter app. It never sends messages.
metadata:
  version: "0.2.0"
---

# Cazar proyectos — LeadHunter con la cuenta del gerente

Buscar nuevos proyectos es una de las cuatro tareas que más tiempo le quitan. LeadHunter hace la caza; aquí se
dirige con el perfil de la empresa y se guarda en la memoria. Herramienta: `../../herramientas/leadhunter.mjs`
(Node ≥ 18, sin dependencias).

## Paso 1 — Persona y HQ

Adopta `../../referencias/persona.md`; resuelve HQ con `../../referencias/hq.md`; lee `CONTEXTO.md`,
`memoria/pendientes.md` y `memoria/empresa.md`.

## Conexión (primera vez)

2. Clave y URL viven en HQ: `<HQ>/.leadhunter` (una línea `lh_…`, permisos 600) y `<HQ>/.leadhunter-url`.
   **El agente nunca recibe la clave** (si pasa por el chat queda en la transcripción). Si no existen, no se pregunta:
   se entrega igual el brief de caza (ver "Sin herramienta") y, como SIGUIENTE ACCIÓN, los pasos para que el
   gerente la guarde él mismo: "LeadHunter → Agentes → Crear clave; luego en tu terminal:
   `umask 077; printf '%s\n' 'lh_…' > <HQ>/.leadhunter; printf '%s\n' 'https://<tu-app>' > <HQ>/.leadhunter-url`
   (o exporta LEADHUNTER_API_KEY y LEADHUNTER_URL). Avísame cuando esté." Después el agente solo prueba:
   `node <plugin>/herramientas/leadhunter.mjs --hq <HQ> infer --url <web> --dry-run` (debe decir `hayClave: true`).
   Si el gerente pegó la clave en el chat igual, pedirle que la revoque en Agentes y cree otra. La compuerta
   "¿Corro?" se formula solo cuando la clave existe.

## Pasos

3. **Brief de caza** desde `empresa.md`: oferta (primera persona, con diferencial), cliente ideal buscable (rubro +
   tamaño + quién decide; no "pymes"), zona, canal, cantidad 3–20. Canal si el gerente no lo dice: Email para
   empresas e inmobiliarias, WhatsApp para particulares y locales, LinkedIn para profesionales; siempre declarado en
   Asumo. Zona ambigua ("Valparaíso" = comuna o región): asumir la más amplia y decirlo. Si Identidad, Qué hace o
   Propuesta de valor siguen "por confirmar" en `empresa.md`: la oferta se arma con lo validado en `CONTEXTO.md`, el
   diferencial se declara "por confirmar" en Asumo, y se propone `look-and-fill-dms` al cierre. `infer` (no gasta
   créditos) solo con clave. El brief se guarda en `<HQ>/memoria/prospectos/<fecha>-brief-<slug>.md`.
4. **Compuerta de gasto**: "N prospectos = N créditos de tu cuenta. ¿Corro?". Sin un sí a esa corrida, no se
   corre. "Ejecuta" no reemplaza este sí. Nunca se reintenta una cacería sola.
5. **Correr**: `node <plugin>/herramientas/leadhunter.mjs --hq <HQ> hunt --offer "…" --target "…" --zone "…"
   --channel WhatsApp --count N` → guarda en `<HQ>/memoria/prospectos/`.
6. **Leer**: solo prospectos con fuente (URL) cuentan como reales; `usedSearch` false = objetivos de búsqueda, no
   empresas: decirlo. 402 → sin créditos, proponer comprar; 401 → revocar y crear otra clave; 429 → esperar.
7. **Priorizar**: score ≥ 80 → `pendientes.md › Seguimientos` con `next:` y `due:` (hoy + 2 días); 60–79 → "tibios"
   en el `.md` de la cacería; < 60 se deja.
8. **Entregar**: tabla (nombre · señal · contacto · score) y mensajes listos para que **él** envíe. El seguimiento
   día 3 lo agenda LeadHunter al marcar "enviado" en la app.

## Sin herramienta (sin Node, sin clave, Cowork sin terminal)

Entregar el brief de caza (ya guardado en `<HQ>/memoria/prospectos/`) listo para pegar en la app de LeadHunter con
su cuenta, y crear `T-#### resp:<gerente>` con `blocked-by:` el pendiente de la clave si falta; el gerente pega o
exporta el CSV del resultado y el agente lo normaliza a `<HQ>/memoria/prospectos/<fecha>-<slug>.md`. Mismo output,
un paso más.

## Ángulos propios de construcción (con fuente, sin inventar)

Permisos de edificación recientes (DOM, transparencia municipal) · proyectos en el SEIA (sea.gob.cl) · licitaciones
(mercadopublico.cl, SERVIU, municipios) · corredores, inmobiliarias y arquitectos que subcontratan · condominios que
licitan mejoras. Cada hallazgo entra a `radar.md` o `pendientes.md` con URL y fecha; sin URL no existe.

## Reglas

- Nunca enviar ni contactar prospectos. A LeadHunter solo va oferta, cliente ideal y zona.
- La clave nunca pasa por el chat (ni de ida ni de vuelta), ni se escribe en la memoria ni en un repo.
