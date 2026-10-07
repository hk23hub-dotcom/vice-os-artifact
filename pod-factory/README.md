# POD FACTORY

Fábrica print-on-demand de HK23. Publica productos todos los días, arma la cola de venta
y deja el parte escrito. Corre sola; lo único que nunca hace sola es mandar correo.

```
vice-seller/data/img (926 MJ)  ─┐
vice-collection (PROOF OF WORK) ─┼─→ Printify ──→ Shopify (fcqevq-jr) ──→ URL real
LeadHunter export (CSV/JSON)   ─┘                        │
                                                          └─→ cola de venta (aprobación del dueño)
```

## El ciclo diario

```bash
node daily.mjs              # simulación: muestra qué haría, no toca red
node daily.mjs --live       # publica de verdad (ola de 3)
node daily.mjs --live --n 5 # ola más grande
```

Hace, en orden: publica la ola del día, corrige formatos que quedaron desalineados,
arma la cola de venta y escribe `reports/<fecha>.md`.

Para que corra solo todos los días a las 09:15 (una vez, tú):

```bash
launchctl load ~/Library/LaunchAgents/com.hk23.podfactory.plist
```

## Meter una colección nueva

Deja en `inbox/` cualquier `.zip` o carpeta con imágenes (sesiones de MidJourney bajadas de Drive,
dibujos escaneados, exports de Procreate). El ciclo diario las ingresa solo:

- descarta lo que ya existe, incluida **la misma imagen con otro nombre** (huella visual calibrada);
- si llega el original en mejor resolución, reemplaza el archivo de arte (pasa de sticker a poster);
- descarta lo que no da para imprimir (lado corto bajo 1000 px);
- lo nuevo queda en `library/` esperando curaduría; solo lo curado entra al catálogo.

```bash
node intake.mjs          # informe
node intake.mjs --live   # ingresa
```

## Colecciones temáticas

Cada pieza cae en una colección por reglas (`midjourney/collections.mjs`) y el producto sale con
ese tag, así las colecciones automáticas de Shopify se llenan solas: NEON DRIVE, THIRD EYE,
CREATURES, CIRCUIT CITY, SACRED GRID, HARD EDGE, FIELD & TURF, WILD BLOOM, OPEN STUDIO.
La ola diaria rota entre colecciones: cada cupo va a la que menos piezas tiene en la tienda.

## Las piezas

| Carpeta | Qué hace |
|---|---|
| `intake.mjs` + `library/` | entrada de colecciones nuevas, sin repetidos y con mejora de resolución |
| `midjourney/` | catálogo (201 piezas únicas) + colecciones temáticas + ola diaria + corrector de formatos |
| `sync-products.mjs` | mantiene copy y tags al día en todo lo ya publicado |
| `sales/` | leads de LeadHunter → producto que calza → mensaje escrito → cola para aprobar |
| `storekit/` | contenido completo de la tienda, políticas, colecciones y tema Spotlight, con aplicador idempotente |
| `out/` | payload del universo, borradores y posts de PROOF OF WORK |
| `data/` | ledgers: qué se creó, qué se publicó, con qué URL |
| `reports/` | un parte por día |

## Reglas que el sistema respeta solo

1. **Nunca manda correo.** La cola queda en `sales/out/` esperando tu OK. El envío
   automático de correo frío quema el dominio y no se recupera.
2. **Idempotencia.** Correr dos veces no duplica nada: todo pasa por ledger.
3. **Nada de URLs inventadas.** Si Shopify aún no devolvió el link, el producto queda
   pendiente y se retoma en la corrida siguiente.
4. **Formatos con proporción.** Solo se habilitan las medidas que calzan con el arte;
   un cuadrado nunca se vende impreso en 16x20 con franjas blancas.

## Lo que depende de ti

- Quitar el password de la tienda (Online Store → Preferences) — sin eso nadie compra.
- Elegir plan de Shopify y conectar pagos (Mercado Pago; nunca Stripe).
- Crear el token de Admin API de la tienda para que `storekit/apply-store.mjs` pueda
  aplicar diseño, colecciones y políticas solo.
- Rellenar los `[COMPLETAR: ...]` legales que lista `storekit/apply-store.mjs --dry-run`.
- Ordenar las dos cuentas de Printify: los primeros 7 productos quedaron en la cuenta
  vieja (shop 29068296, sin canal) y se recrearon en la nueva (29068711).
