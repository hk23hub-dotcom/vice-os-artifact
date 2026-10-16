# Plantillas de memoria — NO se usan aquí

Estas carpetas son **plantillas**. El agente las copia la primera vez a la carpeta privada **HQ** de DMS y
desde ahí trabaja. La información real de la empresa (cifras, socios, clientes, contratos) nunca vuelve a este repo.

Orden de búsqueda de la carpeta HQ (primer acierto gana):

1. `$HOME/mnt/*/DMS` — carpeta conectada en Cowork
2. `~/hk23-neuralhub/DMS` — Claude Code en el Mac
3. `./DMS` — relativa al proyecto abierto

Si ninguna existe, el agente crea `~/hk23-neuralhub/DMS` (o `./DMS` si no hay HOME), copia estas plantillas y lo dice.

```
DMS/
├── CONTEXTO.md         caché caliente (≤ 100 líneas): lo que hay que saber antes de responder
└── memoria/
    ├── empresa.md      perfil de DMS (lo llena look-and-fill-dms)
    ├── diego.md        perfil y estilo de Diego; qué decide solo y qué va a socios
    ├── personas.md     socios, equipo, clientes y proveedores clave
    ├── proyectos.md    obras y proyectos: estado, hitos, riesgos, responsable
    ├── pendientes.md   compromisos y seguimientos (una línea por tarea, gramática ORCHESTRA)
    ├── decisiones.md   registro append-only
    ├── indicadores.md  KPIs: definición, frecuencia, último valor, umbral de alerta
    ├── radar.md        normas, bonos, subsidios, mercado, macro — con fuente y fecha
    ├── glosario.md     siglas, términos, apodos
    ├── agentes.md      subagentes propuestos / creados
    ├── prospectos/     resultados de LeadHunter (los escribe herramientas/leadhunter.mjs)
    └── sesiones/       bitácora YYYY-MM-DD.md por sesión
```

Regla: **si no está en la memoria, no pasó.** Ver `referencias/protocolo-memoria.md`.
