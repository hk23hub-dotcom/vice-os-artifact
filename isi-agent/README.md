# Luis — super agente de Isi

Agente personal de Isi para Chilli Toes y para todo lo demás. Mismo formato que Pepper (`chilli-manager`): un `SKILL.md` que se instala en Claude / Cowork. Ejecuta primero, pregunta solo si cambia el resultado, y opera en **niveles de eficiencia** con auto-auditoría por tarea.

## Qué trae
- **3 niveles**: N1 Flash (respuesta directa) · N2 Pro (entregable listo, default) · N3 Deep (plan → ejecución → verificación). Se eligen solos; Isi puede forzarlos con `N1/N2/N3`.
- **Score de eficiencia** por tarea (velocidad, precisión, completitud, autonomía). Menos de 80 no se entrega: se rehace. Log en `ISI/EFICIENCIA.md` y promedio semanal con 1 mejora propuesta.
- **Puente con Pepper**: lee `ISI/BRIEF_FOTOS.md` y `ISI/UPDATES.md`; escribe `ISI/ENTREGAS.md`, `ISI/MI_ESTADO.md`, `ISI/EFICIENCIA.md`.
- **Reglas duras** iguales a Pepper: anonimato total, nunca explícito, Isi veta, nunca cuentas/publicar/cobrar.

## El dictáfono (`/luis`)
Luis también existe como **grabador de voz**, al estilo del que usa Louis Litt: `luis.html`, publicado en `/luis`.
- **● REC** (o mantener la barra espaciadora): dicta la nota. Al soltar, Luis la ejecuta vía `/api/run` (persona `luis`).
- **Switch AUTO / N1 / N2 / N3** en el cuerpo del grabador: nivel de eficiencia. En AUTO elige Luis.
- **Pantallita OLED**: estado (REC · THINKING · SPEAKING), cronómetro, nota #, y el **EFF** de la última nota (auto-auditoría 0–100).
- **▶ VOZ**: responde hablado (voz en español del navegador). **■ STOP** corta grabación o voz.
- **Filtro de ruido**: separa el pedido real de la conversación de fondo y ejecuta solo el pedido. Sin pedido → lo dice en 2 líneas.
- **Decisiones**: cada dato o decisión que aparece en una nota queda anotado (líneas `MEMO:` del agente, o **+ anotar** a mano) y viaja en cada consulta. Si una nota repite un tema, Luis arranca con "Ya lo teníamos". Hacer repetir a Isi baja su score a 0 en autonomía.
- **Memoria**: las notas quedan en el dispositivo (localStorage). **Exportar .md** genera el `EFICIENCIA.md` listo para pegar en `ISI/`.
- Sin micrófono o sin permiso: campo de texto abajo, misma ejecución.
Requiere Chrome o Safari para dictar (Web Speech API). El texto funciona en todos.

**Instalar como app** (ícono en la pantalla de inicio, abre a pantalla completa):
- iPhone: abrir `/luis` en Safari → Compartir → **Agregar a inicio**.
- Android: abrir `/luis` en Chrome → menú ⋮ → **Instalar app**.

Las notas y decisiones quedan guardadas en el teléfono. Sin internet la app abre, pero Luis necesita conexión para contestar.

## Instalar (3 minutos)
1. Copiar `isi-agent/SKILL.md`.
2. En claude.ai → **Configuración → Capacidades → Skills → Crear skill** (o en Cowork: proyecto → Skills → agregar). Pegar el contenido tal cual, con el frontmatter.
3. Darle a Isi acceso a la carpeta **Chilli Toes** (o al menos a `ISI/`). Crear dentro de `ISI/` los tres archivos desde `isi-agent/plantillas/`:
   - `MI_ESTADO.md` · `ENTREGAS.md` · `EFICIENCIA.md` · `DECISIONES.md`
4. Primer mensaje de Isi: **"Luis, arrancá"**. Lee onboarding, brief y updates, y devuelve su estado + plan de la próxima sesión.

Si Isi usa su propia cuenta de Claude: instala el skill ahí y comparte solo la carpeta `ISI/` (no `SALES_LOG.csv` ni `ESTADO.md`).

## Cerrar el loop con Pepper (1 línea)
Agregar en el skill `chilli-manager`, sección **Loop operativo**, paso 2:

> Leer `ISI/ENTREGAS.md` antes de curar: marcar en `ISI/BRIEF_FOTOS.md` lo entregado y responder en `ISI/UPDATES.md` lo que no pudo.

## Automatizaciones sugeridas (Cowork → tareas programadas)
- `isi-daily-prep` (diario 09:00): leer `MI_ESTADO.md` + brief; si hay sesión hoy, dejar el plan listo; si hay algo vencido, marcarlo.
- `isi-weekly-efficiency` (lunes 09:00): promedio de `EFICIENCIA.md`, 1 mejora, propuesta de mini-sesión temática de la semana.

## Personalizar
- Nombre: reemplazar `Luis` en `SKILL.md`.
- Umbral de calidad: `< 80 no entregas` → subir a 85 cuando el promedio semanal esté en A dos semanas seguidas.
- Dominios: agregar secciones bajo **Qué haces** sin tocar las reglas duras.
