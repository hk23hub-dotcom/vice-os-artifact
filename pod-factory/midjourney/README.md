# POD FACTORY · motor diario MidJourney

Publica, de a una ola por día, la colección MidJourney curada por visión hacia Printify
(tienda `29068711`, con canal Shopify conectado). Node ESM puro, `fetch` nativo, cero
dependencias npm.

## Cómo corre

```bash
node collection.mjs            # arma data/catalog.json (cero red)
node publish-wave.mjs --n 3    # PLAN: qué saldría hoy. No crea nada.
node publish-wave.mjs --n 3 --live   # crea, precia y publica de verdad
```

Sin `--live` no se toca la red salvo un GET por blueprint para confirmar que el id
sigue apuntando al producto correcto. Si el título del blueprint no coincide, aborta.

## De dónde sale el catálogo

`collection.mjs` cruza tres fuentes reales de `vice-seller/data`:

| fuente | rol |
|---|---|
| `midjourney-manifest.json` | `ids[]` en orden; `sku = mjx-{índice+1}` (misma regla que `vice-seller/lib/sources.js`) |
| `captions.json` | curaduría por visión, **keyed por sku**. Solo entra `keep:true` |
| `ledger.json` | SEO ya escrito, **keyed por el id del manifiesto, no por sku** — se une por índice |
| `img/mjx-XXXX.jpg` | archivo local; el ancho y alto se leen de la cabecera JPEG (`sips` de respaldo) |

Resultado actual: **215 publicables**, los 215 con SEO previo, 0 sin archivo.

Cada ítem lleva `{sku, file, w, h, orientation, minPrintable, subject, style, theme,
palette, keywords, seo, rank, position}`. El ranking prioriza resolución (lado corto/100,
+15 si habilita póster) y luego riqueza de metadata (keywords, SEO previo, ficha completa).
El orden es estable: empate se rompe por sku.

## Regla de formato (por resolución, no por gusto)

```
lado corto < 1800 px  →  sticker · Kiss-Cut Vinyl Decals (1268) · markup 2.4
lado corto ≥ 1800 px
        vertical      →  Matte Vertical Posters   (282) · markup 1.8
        horizontal    →  Matte Horizontal Posters (284) · markup 1.8
        cuadrado      →  Matte Vertical Posters   (282) · markup 1.8
```

El cuadrado va a póster vertical: el 282 lo encuadra bien y el sticker queda reservado
a lo que no aguanta un póster grande. Precio final por variante:
`max(round(costo × markup), costo + 100)` en centavos — nunca por debajo de costo+US$1.

Con el catálogo de hoy la regla reparte **59 pósters (282) y 156 stickers (1268)**.
El 284 está verificado contra la API pero no se usa todavía: las dos únicas piezas
horizontales curadas (`mjx-0252`, `mjx-0446`) tienen el lado corto bajo 1800 px.

## El copy

El SEO de `vice-seller/data/ledger.json` es copy de **descarga digital de Etsy**
("instant download", "nothing is shipped"): sirve para el título y los tags, no para la
descripción de un producto físico. El motor recicla el segmento descriptivo del título
y los tags (filtrando los de descarga digital) y **reescribe la descripción** para
impresión bajo demanda. Si un sku no tuviera SEO, el título y los tags salen de
`subject / style / theme / palette / keywords` de la curaduría.

## Idempotencia y cómo se retoma tras un fallo

El estado vive en `data/mj-ledger.json`, keyed por sku, y se graba en disco después de
cada paso. Cada sku avanza por etapas:

| etapa | significa | qué hace el próximo run |
|---|---|---|
| (sin entrada) | nunca tocado | lo crea |
| `created` / `publishing` | producto ya existe en Printify, falta el handle del canal | **reanuda solo la publicación**, no vuelve a crear |
| `published` | tiene `url` real | lo salta para siempre |
| `error` | falló antes de crear | reintenta desde cero |

Tras crear el producto el motor hace `POST .../publish.json` y hace polling cada 6 s
hasta ~3 min esperando `external.handle`. Si no llega, el sku queda en `publishing` con
su `product_id` guardado y el próximo run lo toma **primero**, antes de cualquier pieza
nueva. Por eso correr dos veces seguidas nunca duplica: lo publicado se salta y lo
pendiente se reanuda sobre el mismo `product_id`.

El token de Printify se lee de `vice-seller/config.local.json` y nunca se imprime.
