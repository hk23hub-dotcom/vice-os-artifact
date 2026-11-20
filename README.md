# HK23 Universe · vice-os-artifact

Sitio estático con funciones serverless, publicado en Vercel (`hk23universe.vercel.app`).
El corazón es `universe-os.html`: un solo archivo (~1 MB) con todo el universo.

## Qué está vivo

Lo define `vercel.json`. Con `cleanUrls`, cada `.html` se sirve sin la extensión (`/cosmos` → `cosmos.html`).

| Ruta | Qué abre |
|------|----------|
| `/` | `index.html`, que te manda a `/universe-os` |
| `/universe-os` | `universe-os.html`, el universo |
| `/g/:slug` | el universo con la galaxia `:slug` abierta (`universe-os.html?g=:slug`) |
| `/frequency` y `/jc` | el universo con la galaxia `frequency` |
| `/hk23-universe` | redirige a `/universe-os` (la página vieja ya no existe) |
| `/landing` | página de venta de los planes |
| `/agent-designer` (y `/designer`, `/try`) | el diseñador de agentes |
| `/agent-os`, `/agentos`, `/agent` | redirigen al producto en Gumroad |
| `/centro` y `/centro-admin` | El Centro; el panel del dueño va con `noindex` y sin caché |
| `/scale` | Motivation Scale (app instalable: `scale-sw.js`, `scale-manifest.webmanifest`) |
| `/leadhunter` | `leadhunter/index.html` |
| Otras | `/cosmos`, `/multiverse`, `/mundial`, `/autografo`, `/vice-gta6`, `/vice-futures`, `/grid`, `/galaxy-questionnaire`, `/privacy`, `/terms`, los blueprints de ViceGolfer y demás `.html` de la raíz |

`universe-template.html` es la plantilla vendible del universo.

Datos que leen las páginas: `biblioteca.json`, `mvb-eventos.json` y `musica.json` (universo),
`midjourney.json` (cosmos) y `quotes.json` (daily y quote-studio). `design/hk23-tokens.css` queda público
para usarlo desde otros proyectos.

## Backend: `api/`

Funciones serverless de Vercel (Node, ESM). Los archivos que empiezan con `_` son librerías compartidas, no rutas.
Las dependencias están en `package.json`.

- `centro-*.js`: El Centro (postular, correr, estado, sesión, pase y panel del dueño).
- `tier-unlock.js` y `gta6-unlock.js`: verifican licencias de Gumroad.
- `gumroad-agent.js`: resumen de ventas de Gumroad para el universo.
- `run.js`: corre acciones pedidas desde el universo (IA por Vercel AI Gateway).
- `scale-push.js`: notificaciones push de `/scale`.
- `gta6-research.js`: cron diario a las 13:00 UTC para el hub de GTA 6.

## Qué no se publica

`.vercelignore` deja afuera del deploy lo que ninguna página usa. Todo sigue en el repo: no se borró nada.

- **Secretos y backend:** `etsy-agent/`, archivos de tokens y `config.json`.
- **Herramientas que corres tú:** `vice-seller/` (CLI de Etsy/Printify, 88,8 MB de imágenes),
  `nft-collection.json` (su índice), `scripts/`, `hk23-brain/`, `supabase/` y `supabase-schema.sql`
  (esas migraciones se corren en Supabase).
- **Interno:** `tests/`, `docs/`, `prompts/`, `centro/` (scripts de El Centro), `hk23-constitution/`,
  `VICE-OS-vs-ATLAS-X.md` y este README.
- **Otros proyectos:** `etsy-exports/`, `albatros-*` y `clubscore-qr.svg`.
- **Imágenes sin uso (~120 MB):** `assets/art/`, `assets/puttview/`, 16 fotos de `assets/house/`,
  `golfteiner-render-7` y `-8`, `assets/putting-lab-blueprint.png` y `assets/website/`. También la página `pump-up-the-bid/`.

Si una página nueva necesita algo de esa lista, saca su línea de `.vercelignore`.
`tests/deploy.test.mjs` falla si una página servida nombra un archivo ignorado.

## Pruebas

```bash
node --test tests/*.mjs
```

Necesitas Node 18 o más nuevo. No hay que instalar nada.

## Tokens de diseño

`node scripts/tokens.mjs` regenera `design/hk23-tokens.css` y `design/hk23-tokens.json` desde el `:root` de `universe-os.html`.
