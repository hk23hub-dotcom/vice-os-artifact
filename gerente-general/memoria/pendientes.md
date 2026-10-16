# PENDIENTES — compromisos y seguimientos de DMS
<!-- PLANTILLA: sin datos reales -->

_Actualizado: 2026-10-16 por la instalación. Una línea canónica por tarea (misma gramática que ORCHESTRA):_
`- [ ] T-#### | P0..P3 | proj:<slug> | resp:<quién> | due:YYYY-MM-DD | Título imperativo`
_Hijas: `why:`, `done-when:` (obligatoria), `blocked-by:`, `artifact:`, `note:`. `resp:` es una persona de personas.md o `GG` (el agente). Es el único backlog de la empresa._
_Prioridad: P0 incendio · P1 esta semana · P2 este mes · P3 algún día. Nunca se borra una tarea: pasa a Hecho o a Parked._
_Siguiente ID: `grep -o "T-[0-9]\{4\}" pendientes.md | sort | tail -1` + 1._

## Inbox
<!-- captura cruda; se ordena en la siguiente sesión -->

## Hoy
<!-- máximo 5 líneas -->

## Esta semana
- [ ] T-0001 | P1 | proj:dms | resp:GG | due:2026-10-23 | Llenar el perfil de DMS desde la web y documentos
      why: sin perfil, el agente opina a ciegas
      done-when: memoria/empresa.md sin "por confirmar" en Identidad, Qué hace y Clientes; CONTEXTO.md actualizado
      artifact: memoria/empresa.md
- [ ] T-0002 | P1 | proj:dms | resp:Diego | due:2026-10-23 | Definir el set de indicadores semanal y mensual
      why: Diego no los tiene definidos (cuestionario A12); sin KPIs no hay alertas
      done-when: memoria/indicadores.md con ≥ 5 KPIs confirmados por Diego, con frecuencia y umbral
      artifact: memoria/indicadores.md
- [ ] T-0003 | P1 | proj:dms | resp:Diego | due:2026-10-23 | Definir herramientas, datos que se entregan y qué es confidencial
      why: cuestionario A10 y A11 sin responder; condiciona qué puede leer y escribir el agente
      done-when: CONTEXTO.md → "Herramientas conectadas" sin "sin definir"; lista de confidenciales en diego.md
      artifact: CONTEXTO.md
- [ ] T-0004 | P1 | proj:dms | resp:Diego | due:2026-10-23 | Conectar LeadHunter con clave de API de Diego
      why: sin clave, cazar-proyectos no puede usar su cuenta
      done-when: `node herramientas/leadhunter.mjs infer --url https://www.dmsinversiones.cl` responde con la oferta y el cliente ideal
      note: la clave se crea en LeadHunter → Agentes; va en LEADHUNTER_API_KEY, nunca en la memoria

## Backlog
- [ ] T-0005 | P2 | proj:dms | resp:GG | Registrar socios, equipo y proyectos activos en personas.md y proyectos.md
      done-when: personas.md con los socios y el área que lleva cada uno; proyectos.md con ≥ 1 proyecto con estado y próximo hito

## Seguimientos (tratos y compromisos de terceros)
<!-- `- [ ] S-#### | <quién> | <qué prometió> | due:YYYY-MM-DD | nivel:recordar|insistir|escalar` -->

## Parked
<!-- cada línea lleva `note: se desbloquea cuando …` -->

## Hecho
<!-- solo con evidencia; mover, no borrar -->
