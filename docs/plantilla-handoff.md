# UNIVERSE OS — PLANTILLA · dónde se enchufa el handoff nuevo

`universe-template.html` es el universo completo **sin nada del autor original**:
misma maquinaria, cero contenido. Se abre en `/universe-template`.

**No se edita a mano.** Sale de `universe-os.html` con el generador, así nunca se queda atrás:

```
node scripts/plantilla.mjs          # universe-os.html → universe-template.html
node scripts/plantilla-check.mjs    # lista negra en cero, storage solo uos_, node --check, al día
```

Córrelos cada vez que cambie el universo. Si algo no cuadra, el generador no escribe nada y te
dice qué ancla se movió. Misma entrada, mismo archivo, byte por byte.

## Qué trae vivo (maquinaria)
Todo lo del universo: ⊕ launcher, ▦ dashboard, A23 ATLAS, ◆ FORMAS, ◉ MÚSICA, ▣ ARTE 3D,
la cancha de RUGBY, el green de GOLF, CRYPTO con su guardia anti-estafa, backrooms, tiers con
códigos, ▦ CUARTEL por planeta, ⤒ SUBIR, ◈ DISEÑO, NEÓN por uso, LAS PUERTAS (fachada pública
y llaves firmadas), láminas y el mapa con sus íconos.

## Qué está vacío a propósito (y lo dice en pantalla)
- Proyectos del mapa: 4 mundos con maquinaria propia (RUGBY, GOLF, ARTE, CRYPTO) + `demo1` y `demo2` marcados "reemplázame"
- Mundos del dashboard: `demo-a` y `demo-b`
- Inquilinos: `const SEED=[]`
- Biblioteca: `let BIB=[]`, con una tarjeta que dice que está vacía
- Cuartel: sin links SUGERIDO · LAS PUERTAS: `FIRMA_PUBLICA = null` y planetas sin página pública
- Música, Arte y Formas arrancan vacíos

## Los enchufes del handoff (busca y reemplaza)
| enchufe | valor en la plantilla | qué poner |
|---|---|---|
| Supabase | `https://TU-PROYECTO.supabase.co` | tu URL real |
| Anon key | `TU-ANON-KEY` | tu key real |
| Códigos de acceso | `CODES={ 'DEMO23':'socio' }` | tus códigos y su nivel |
| Tienda | `https://TU-TIENDA.example` | tus links de venta (Gumroad, Mercado Pago o Shopify) |
| Tu sitio | `TU-SITIO.example` | tu dominio |
| Planes (si el universo trae el selector) | `/api/TU-TIENDA` | el endpoint de tu tienda |
| Libros, eventos y música | `uos-biblioteca.json`, `uos-mvb-eventos.json`, `uos-musica.json` | tus JSON, con el mismo esquema que los del universo |
| Fondo de muestra | un short neutro | tu video |
| Firma del dueño | `FIRMA_PUBLICA = null` | crea tu firma en el CUARTEL y publícala |
| Marca | `UOS` / `UNIVERSE OS` / `NOVA` | tu nombre (título, portal, dock) |
| Paleta y tipos | tokens CSS en `:root` | los del handoff nuevo |
| Storage | prefijo `uos_` | déjalo: aísla esta copia del original |

Sin Supabase real todo funciona igual en **modo LOCAL** (se guarda en el aparato y se dice).
El runner `/api/run` requiere deploy con la carpeta `api/`.

## Advertencia honesta
La lista negra (nombres, proyectos, lugares, colecciones, los dos proyectos Supabase y sus keys,
códigos de acceso, links de tienda y de artifacts del autor) queda en cero y el chequeo lo
verifica cada vez. Los textos largos de las zonas (LORE, SYSTEMS…) siguen siendo relleno
estructural: **reescríbelos con la voz del handoff nuevo** antes de vender esta copia.
