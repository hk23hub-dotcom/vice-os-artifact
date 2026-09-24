# Cayena — super agente de Isi

Agente personal de Isi para Chilli Toes y para todo lo demás. Mismo formato que Pepper (`chilli-manager`): un `SKILL.md` que se instala en Claude / Cowork. Ejecuta primero, pregunta solo si cambia el resultado, y opera en **niveles de eficiencia** con auto-auditoría por tarea.

## Qué trae
- **3 niveles**: N1 Flash (respuesta directa) · N2 Pro (entregable listo, default) · N3 Deep (plan → ejecución → verificación). Se eligen solos; Isi puede forzarlos con `N1/N2/N3`.
- **Score de eficiencia** por tarea (velocidad, precisión, completitud, autonomía). Menos de 80 no se entrega: se rehace. Log en `ISI/EFICIENCIA.md` y promedio semanal con 1 mejora propuesta.
- **Puente con Pepper**: lee `ISI/BRIEF_FOTOS.md` y `ISI/UPDATES.md`; escribe `ISI/ENTREGAS.md`, `ISI/MI_ESTADO.md`, `ISI/EFICIENCIA.md`.
- **Reglas duras** iguales a Pepper: anonimato total, nunca explícito, Isi veta, nunca cuentas/publicar/cobrar.

## Instalar (3 minutos)
1. Copiar `isi-agent/SKILL.md`.
2. En claude.ai → **Configuración → Capacidades → Skills → Crear skill** (o en Cowork: proyecto → Skills → agregar). Pegar el contenido tal cual, con el frontmatter.
3. Darle a Isi acceso a la carpeta **Chilli Toes** (o al menos a `ISI/`). Crear dentro de `ISI/` los tres archivos desde `isi-agent/plantillas/`:
   - `MI_ESTADO.md` · `ENTREGAS.md` · `EFICIENCIA.md`
4. Primer mensaje de Isi: **"Cayena, arrancá"**. Lee onboarding, brief y updates, y devuelve su estado + plan de la próxima sesión.

Si Isi usa su propia cuenta de Claude: instala el skill ahí y comparte solo la carpeta `ISI/` (no `SALES_LOG.csv` ni `ESTADO.md`).

## Cerrar el loop con Pepper (1 línea)
Agregar en el skill `chilli-manager`, sección **Loop operativo**, paso 2:

> Leer `ISI/ENTREGAS.md` antes de curar: marcar en `ISI/BRIEF_FOTOS.md` lo entregado y responder en `ISI/UPDATES.md` lo que no pudo.

## Automatizaciones sugeridas (Cowork → tareas programadas)
- `isi-daily-prep` (diario 09:00): leer `MI_ESTADO.md` + brief; si hay sesión hoy, dejar el plan listo; si hay algo vencido, marcarlo.
- `isi-weekly-efficiency` (lunes 09:00): promedio de `EFICIENCIA.md`, 1 mejora, propuesta de mini-sesión temática de la semana.

## Personalizar
- Nombre: reemplazar `Cayena` en `SKILL.md`.
- Umbral de calidad: `< 80 no entregas` → subir a 85 cuando el promedio semanal esté en A dos semanas seguidas.
- Dominios: agregar secciones bajo **Qué haces** sin tocar las reglas duras.
