# Ecosistema de trabajo — quién hace qué, dónde queda y cuándo

Mapa de cómo trabajan juntos el gerente, la sesión con la persona, la memoria HQ, los subagentes, LeadHunter y el
dashboard. La pestaña **Ecosistema** de `<HQ>/dashboard.html` muestra este mapa con el estado vivo de cada pieza.

## El ciclo de cada sesión

1. **Abrir** — el gerente dice "GG" (o "en qué vamos"). La sesión adopta `persona.md`, resuelve HQ y abre con el
   brief de `protocolo-memoria.md` §2 (VENCIDO · HOY · OBRAS · DECISIÓN · RADAR · TE DEBÍA · PREGUNTA).
2. **Trabajar** — una skill por pedido. Lo que pasa se escribe en la memoria **al momento** (protocolo §3); las
   escrituras que cambian estado se confirman antes.
3. **Decidir** — el gerente decide; la sesión propone, cuestiona y prepara fichas. Decisiones importantes van a la
   reunión de socios con su ficha.
4. **Cerrar** — "cierre": bitácora de la sesión, repaso de pendientes, `CONTEXTO.md` si cambió el caché, y se
   regenera `dashboard.html`. Cinco líneas finales.

## Quién escribe qué

| Pieza | Escribe | Dónde | Nunca |
|---|---|---|---|
| Gerente | pide, decide, envía | — | — |
| Sesión GG (persona + skills) | pendientes, decisiones, proyectos, personas, radar, indicadores, bitácora | `<HQ>/CONTEXTO.md`, `<HQ>/memoria/*.md`, `memoria/sesiones/YYYY-MM-DD.md` | decidir, enviar, gastar o lanzar sin su sí |
| Ejecutor `gerente-general-dms` | artefactos largos (ficha completa, control semanal, pack de reunión) | `<HQ>/memoria/sesiones/` y el archivo que se le pide | conversar con el gerente, decidir |
| Subagentes de área (si se aprueban) | su propia bitácora de área | `<HQ>/memoria/sesiones/<fecha>-<área>.md` y lo que su ficha autorice | tocar `pendientes.md` o `decisiones.md` sin pasar por la sesión |
| `herramientas/leadhunter.mjs` | resultados de cada cacería | `<HQ>/memoria/prospectos/` | enviar mensajes; gastar sin confirmación |
| `herramientas/dashboard.mjs` | la vista | `<HQ>/dashboard.html` | modificar la memoria |

Regla de la casa: **si no está escrito en la memoria, no pasó.** El dashboard solo muestra lo escrito.

## Cadencia sugerida (se confirma con el gerente en la primera sesión y queda en `diego.md`)

| Cuándo | Qué | Skill |
|---|---|---|
| Cada sesión | brief · vencidos con nivel de presión · cierre con bitácora y dashboard | `gg`, `seguimiento`, `dashboard` |
| Lunes | control de obras (semáforos, hitos de la semana) · KPIs semanales | `proyectos`, `indicadores` |
| Viernes | tratos abiertos, cada uno con `next:` · cobros y compromisos de terceros | `cierres`, `seguimiento` |
| Primera semana del mes | KPIs mensuales · radar de normas, subsidios y mercado | `indicadores`, `radar` |
| Antes de la reunión de socios | agenda con decisiones a pedir y fichas; después, acuerdos → pendientes con su OK | `reunion`, `decision` |
| Cuando haga falta | perfil de la empresa, caza de proyectos, redacción, subagentes | `look-and-fill-dms`, `cazar-proyectos`, `redactar`, `crear-subagente` |

Sin planificador: la presión se calcula al abrir, desde `due:` (0–2 recordar · 3–6 insistir · ≥ 7 escalar).

## Privacidad del dashboard

`dashboard.html` lleva la memoria completa (cifras, clientes, socios, tratos). Es tan confidencial como HQ: vive
ahí, no se sube a repos ni se comparte por mensajería. Para compartir estado con socios o equipo, la sesión redacta
un resumen (`redactar`) y el gerente decide qué sale.
