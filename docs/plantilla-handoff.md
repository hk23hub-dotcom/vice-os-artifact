# UNIVERSE OS — PLANTILLA · dónde se enchufa el handoff nuevo

`universe-template.html` es el universo completo **sin nada del autor original**:
misma maquinaria, cero contenido. Se abre en `/universe-template`.

## Qué trae vivo (maquinaria)
- ⊕ Launcher (19 mundos) · ▦ Dashboard (notas/tareas/vender/referidos/ejecutar)
- A23 ATLAS (verifica con prueba) · ◆ FORMAS (cuerpos arrastrables con trabajo)
- ◉ MÚSICA (planeta de temas, cabina 2 decks) · ▣ ARTE 3D (foto → relieve)
- RUGBY (cancha jugable) · GOLF (green jugable) · CRYPTO (market + guardia anti-scam)
- Backrooms v2 · Tiers con códigos · Mapa con íconos por proyecto

## Qué está vacío a propósito
- Inquilinos: `const SEED=[]` — cargá los tuyos
- Biblioteca: `let BIB=[]` — tus libros van en `biblioteca.json` (mismo esquema)
- Proyectos del mapa: 4 mundos genéricos + `demo1/demo2` marcados "reemplazame"
- Mundos del dashboard: `demo-a`, `demo-b`
- Música, Arte, Formas: arrancan vacíos y lo dicen en pantalla

## Los enchufes del handoff (buscá y reemplazá)
| enchufe | valor actual | qué poner |
|---|---|---|
| Supabase | `https://TU-PROYECTO.supabase.co` | tu URL real |
| Anon key | `TU-ANON-KEY` | tu key real (2 apariciones) |
| Códigos de acceso | `CODES={ 'DEMO23':'socio' }` | tus códigos y tiers |
| Tienda | `https://TU-TIENDA.example` | tus links de venta |
| Marca | `UOS` / `UNIVERSE OS` | tu nombre (título, portal, dock) |
| Paleta/tipos | tokens CSS al tope de cada bloque | los del handoff nuevo |
| Storage | prefijo `uos_` | dejalo: aísla esta copia del original |

Sin Supabase real todo funciona igual en **modo LOCAL** (se guarda en el aparato
y se dice). El runner `/api/run` requiere deploy con la carpeta `api/`.

## Advertencia honesta
Se barrieron 21 marcadores personales hasta cero restos (nombres, llaves,
códigos, lugares, colecciones). Los textos largos de las zonas (LORE, SYSTEMS…)
quedaron como relleno estructural: **reescribilos con la voz del handoff nuevo**
antes de vender esta copia.
