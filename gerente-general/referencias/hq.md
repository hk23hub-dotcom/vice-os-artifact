# Carpeta HQ — dónde vive la memoria de DMS (Paso 1 de toda skill)

La memoria es confidencial. Vive **fuera de cualquier repositorio** y fuera de la carpeta del plugin. Toda skill
empieza resolviendo HQ y leyendo `CONTEXTO.md` + `memoria/pendientes.md` (son cortos). Nada se escribe con rutas
relativas: siempre la ruta absoluta de HQ resuelta aquí.

## Orden de búsqueda (primer acierto gana)

1. `$DMS_HQ` — variable de entorno, si está definida
2. `$HOME/mnt/DMS` — Cowork, carpeta conectada que se llama DMS
3. `$HOME/mnt/*/DMS` — Cowork, subcarpeta DMS dentro de la carpeta conectada
4. `~/DMS` — Claude Code en el computador del gerente
5. `./DMS` — **solo si el directorio actual NO está dentro de un repositorio git**
   (`git rev-parse --is-inside-work-tree` falla o devuelve false)

Una carpeta cuenta como HQ solo si su `CONTEXTO.md` empieza con la línea `# DMS — HQ`. Un `DMS/` vacío o ajeno no
cuenta.

## Si no hay acierto (primera ejecución)

1. Preguntar **una sola vez**: "¿Dónde guardo la memoria de DMS? Propongo `~/DMS` (fuera de cualquier repo)."
   Si el gerente dice "ejecuta" o no responde en ese turno, usar `~/DMS`.
2. Crear la carpeta y copiar **cada archivo** de las plantillas del plugin (`../memoria/` relativo a esta
   referencia, es decir `gerente-general/memoria/`) a `<HQ>/` (`CONTEXTO.md` en la raíz, el resto bajo
   `<HQ>/memoria/`). Copiar solo si el destino no existe; **nunca editar el origen**.
3. Quitar la línea `<!-- PLANTILLA: sin datos reales -->` de las copias.
4. Decir en una línea dónde quedó y recordar que esa carpeta no debe subirse a ningún repositorio público.

Nunca crear HQ dentro de un repositorio git ni dentro de la carpeta del plugin. Si el único lugar disponible es un
repo, parar y preguntar.

## Archivos privados que también viven en HQ

| Archivo | Qué guarda | Quién lo lee |
|---|---|---|
| `<HQ>/.leadhunter` | la clave `lh_…` de LeadHunter, una línea, permisos 600 | `herramientas/leadhunter.mjs` |
| `<HQ>/.leadhunter-url` | la URL de la app de LeadHunter, una línea | `herramientas/leadhunter.mjs` |
| `<HQ>/agentes/*.md` | subagentes aprobados (copia canónica) | `crear-subagente`, delegación |
| `<HQ>/CLAUDE.md` | copia del bloque del plugin, si el gerente usa Claude Code | Claude Code |

Las plantillas del plugin son de **solo lectura**. Si una skill se encuentra escribiendo bajo `gerente-general/`
o bajo un repo, está en el lugar equivocado: parar y resolver HQ de nuevo.
