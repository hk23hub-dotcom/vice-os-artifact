# HK23 STUDIO — kit de tienda

Todo el contenido, los ajustes de tema y el aplicador de la tienda Shopify
`fcqevq-jr.myshopify.com` (print-on-demand vía Printify).

El kit está **listo para aplicarse solo** en cuanto exista un token de Admin API. Hasta entonces,
`node apply-store.mjs` imprime el plan completo y sale con código 1 diciendo qué falta.

```
storekit/
├── apply-store.mjs        el aplicador idempotente (Node ESM, sin dependencias)
├── config.example.json    plantilla de credenciales → copiar a config.local.json (gitignored)
├── content/
│   ├── store.json         nombre, anuncio, contacto, datos legales, fulfillment
│   ├── home.json          copy de la home (hero, 3 bloques de valor, secciones) ES + EN
│   ├── collections.json   definición de colecciones, reglas por tag, taxonomía y tag_plan
│   ├── navigation.json    menú principal y menú del footer
│   ├── seo.json           title + meta description por página y colección, ES + EN
│   ├── pages/             about · faq · contact  (.es.md y .en.md)
│   └── policies/          shipping · refund · privacy · terms  (.es.md y .en.md)
└── theme/
    ├── spotlight.json     ajustes del tema Spotlight (colores, forma, densidad, fuentes)
    └── README.md          qué clave toca y por qué
```

## Colecciones

| Handle | Qué agrupa | Regla |
|---|---|---|
| `proof-of-work` | La colección madre | tag `proof of work` |
| `proof-of-work-stickers` | Los 5 stickers | tags `proof of work` + `sticker` |
| `proof-of-work-posters` | Los posters numerados | tags `proof of work` + `poster` |
| `idle-cycles` | La colección MidJourney | tag `idle cycles` |
| `todo` | Catálogo completo | tag `hk23` |

**IDLE CYCLES** es el nombre de la colección MidJourney: PROOF OF WORK es lo que produce tu
trabajo, IDLE CYCLES es lo que la máquina imagina en los ciclos que sobran. Mismo vocabulario de
cómputo, y explica en dos palabras por qué esta serie no lleva datos ni serial.

> **Ojo con los tags.** Hoy los 7 productos publicados llevan los mismos 13 tags (los stickers
> incluidos vienen con `numbered edition`), así que las sub-colecciones no discriminan nada hasta
> que se corrija. Eso lo resuelve `--audit-tags` / `--fix-tags`, que es el paso 4 de abajo.

## Orden de aplicación

Cada paso es idempotente: si el estado ya coincide, no escribe. Se puede repetir sin miedo.

```bash
cd ~/vice-os-artifact/pod-factory/storekit
cp config.example.json config.local.json    # y pegar el token

# 0. ver el plan completo sin tocar nada  (es el modo por defecto)
node apply-store.mjs

# 1. colecciones — primero, porque el menú las necesita para enlazar
node apply-store.mjs --only=collections --live

# 2. páginas y políticas
node apply-store.mjs --only=pages,policies --live

# 3. navegación — después de 1 y 2: los items que no resuelven se omiten con aviso
node apply-store.mjs --only=menus --live

# 4. tags de producto — sin esto, stickers y posters caen en la misma sub-colección
node apply-store.mjs --audit-tags              # ver la diferencia
node apply-store.mjs --fix-tags --live         # aplicarla

# 5. tema — hace backup de settings_data.json antes de escribir
node apply-store.mjs --only=theme --live

# o todo de una vez, cuando ya viste el dry-run
node apply-store.mjs --live
```

Banderas: `--locale en` publica la versión en inglés · `--fonts` incluye las tipografías (leer
`theme/README.md` antes) · `--only=...` limita los pasos.

### Qué hace exactamente el paso del tema

Descarga el `config/settings_data.json` del tema activo, guarda una copia en `backups/`, mezcla
**solo** las claves de `theme/spotlight.json` que ya existan en ese tema, y lo sube de vuelta.
Nunca sobrescribe el tema entero ni crea claves nuevas. Las claves que el tema no tiene se
reportan como omitidas. Las fuentes no se tocan salvo `--fonts`, porque un handle de fuente
inválido rompe el render y el API no lo valida.

### Credenciales

Por variables de entorno (tienen prioridad) o por `config.local.json`, nunca en el código:

```bash
export SHOPIFY_STORE=fcqevq-jr.myshopify.com
export SHOPIFY_ADMIN_TOKEN=shpat_...
```

Scopes necesarios en la app custom: `write_products`, `read_products`, `write_content`,
`write_online_store_pages`, `write_online_store_navigation`, `write_themes`, `read_themes`.

## Lo que el dueño tiene que hacer a mano

El aplicador no puede hacer nada de esto. Sin los tres primeros, la tienda no vende.

1. **Elegir plan de Shopify.** La tienda está en prueba; sin plan activo no se puede quitar el
   password ni cobrar.
2. **Conectar pagos.** Mercado Pago o el proveedor que corresponda al país de facturación.
   Nunca Stripe.
3. **Quitar el password de la tienda.** Tienda online > Preferencias > Restricción por contraseña.
   Mientras esté puesto, nadie ve nada de lo que aplica este kit.
4. **Crear el token de Admin API.** Configuración > Aplicaciones y canales de venta > Desarrollar
   aplicaciones > Crear app > asignar los scopes de arriba > instalar > copiar el token `shpat_`.
5. **Rellenar los 59 `[COMPLETAR: ...]`.** El dry-run los lista agrupados por archivo. Son datos
   legales, plazos y direcciones que no se inventan: nombre legal, RUT, dirección comercial,
   correo público, plazos reales de producción y tránsito, plazo de reclamo, jurisdicción,
   moneda. **Si no se llenan, se publican tal cual y el comprador los ve.**
6. **Pegar el copy de la home.** Vive en las secciones del tema, no en una página. El aplicador
   escribe `out/home-copy.es.txt` listo para pegar en Tienda online > Temas > Personalizar.
7. **Subir favicon y logo** desde el editor de temas (`theme/spotlight.json` → `manual_only`).
8. **Verificar las tipografías** en el selector del editor antes de usar `--fonts`.
9. **Decidir el inglés.** El kit trae todo en ES y EN. `--locale` elige cuál se publica; para
   tener ambos en vivo hay que instalar Translate & Adapt y pegar la versión EN ahí.

## Notas

- Sin dependencias npm. Node >= 18, `fetch` nativo, Admin API GraphQL `2026-01` con caída a REST
  en el paso del tema.
- Los inputs de GraphQL se serializan inline en vez de declararse como variables tipadas: así el
  script no se rompe cuando Shopify renombra un input type entre versiones de API.
- `config.local.json`, `backups/` y `out/` están en `.gitignore`.
