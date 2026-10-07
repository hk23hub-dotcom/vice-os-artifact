// publish-wave.mjs — publica la ola diaria de la colección MidJourney en Printify.
//
//   node publish-wave.mjs              → PLAN (sin red salvo verificar blueprints)
//   node publish-wave.mjs --n 5        → plan de 5
//   node publish-wave.mjs --n 3 --live → crea, precia y publica de verdad
//
// Flujo copiado de pod-factory/publish-printify.mjs (el catálogo NO expone `cost`):
//   1) subir arte en base64          → /uploads/images.json
//   2) crear producto con precio provisional
//   3) releer el producto            → ahora sí trae v.cost
//   4) PUT variantes con precio = costo × markup (piso costo+100)
//   5) POST publish.json y hacer polling hasta que aparezca external.handle
//
// Idempotencia: data/mj-ledger.json, keyed por sku. Cada sku avanza por etapas
// (created → published) y jamás se reprocesa una etapa ya cerrada.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog } from './collection.mjs';
import { collectionOf } from './collections.mjs';
import { printify as api, saveJSON, loadJSON, acquireLock, sleep, SHOP } from '../lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const LIVE = argv.includes('--live');
const N = (() => { const i = argv.indexOf('--n'); const v = i >= 0 ? parseInt(argv[i + 1], 10) : NaN; return Number.isFinite(v) && v > 0 ? v : 3; })();
const MAX_INTENTOS = 3;

// blueprints verificados contra el catálogo real de Printify (2026-09-24)
const BLUEPRINT = {
  sticker: { id: 1268, label: 'Kiss-Cut Vinyl Decals', markup: 3.0 },
  posterV: { id: 282, label: 'Matte Vertical Posters', markup: 2.5 },
  posterH: { id: 284, label: 'Matte Horizontal Posters', markup: 2.5 },
};
// Proveedor FIJO por blueprint: providers[0] cambia de un día a otro y mezcla proveedores
// con tarifas y perfiles de envío distintos. 99 = Printify Choice · 215 = Stickers & Posters.
export const PROVEEDOR = { 282: 99, 284: 99, 1268: 215 };

// REGLA DE FORMATO (ver README):
//   lado corto < 1800px  → sticker (1268), da igual la forma
//   vertical             → póster vertical (282)
//   horizontal           → póster horizontal (284)
//   cuadrado             → póster vertical (282), que trae medidas cuadradas
export function kindFor(it) {
  if (!it.minPrintable) return 'sticker';
  if (it.orientation === 'horizontal') return 'posterH';
  return 'posterV';
}

const LEDGER = join(HERE, 'data', 'mj-ledger.json');
const ledger = loadJSON(LEDGER, {});
const save = () => saveJSON(LEDGER, ledger);

// ─── copy ───────────────────────────────────────────────────────────────────
// El SEO de vice-seller/ledger.json es copy de DESCARGA DIGITAL (Etsy). El título
// y los tags se reciclan limpiándolos; la descripción se reescribe para producto
// físico, porque "instant download / nothing is shipped" es falso en Printify.
const DIGITAL = /printable|digital download|instant download|download/i;

const titleCase = (s) => String(s || '').replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

export function copyFor(it, kind) {
  const noun = kind === 'sticker' ? 'Sticker' : 'Poster';
  const subject = titleCase(it.subject || 'Abstract Art');
  const style = titleCase(it.style || '');
  const theme = titleCase(it.theme || '');

  // título: se reutiliza el segmento descriptivo del SEO existente y se re-etiqueta el formato
  let title;
  const segs = (it.seo?.title || '').split('|').map((s) => s.trim()).filter((s) => s && !DIGITAL.test(s));
  if (segs.length) title = `${segs[0].replace(/\b(Art Print|Wall Art Print|Printable Art|Poster)\b/gi, '').replace(/\s+/g, ' ').trim()} ${noun}`;
  else title = `${subject} ${noun}`;
  title = `${title} | ${[style, theme].filter(Boolean).join(' ')} ${kind === 'sticker' ? 'Vinyl Decal' : 'Matte Wall Art'}`.replace(/\s+/g, ' ').trim().slice(0, 140);

  // tags: los del SEO menos los de descarga digital, más los de la curaduría
  // los tres primeros son estructurales: las colecciones de la tienda se arman con ellos
  const col = collectionOf(it);
  // Etsy corta los tags a 20 caracteres: "vintage golfers scen". Si un tag del SEO llega justo
  // al tope, se le quita la última palabra, que casi siempre quedó mutilada.
  const limpio = (t) => { const x = String(t).toLowerCase().trim(); return x.length >= 20 && x.includes(' ') ? x.slice(0, x.lastIndexOf(' ')) : x; };
  const tags = [...new Set(['hk23', 'idle cycles', kind === 'sticker' ? 'sticker' : 'poster', col.tag,
    ...(it.keywords || []), it.style, it.theme, it.palette, ...(it.seo?.tags || []).map(limpio)]
    .filter(Boolean).map((t) => String(t).toLowerCase().trim())
    .filter((t) => t && !DIGITAL.test(t)))].slice(0, 13);

  const body = kind === 'sticker'
    ? ['Kiss-cut vinyl decal, printed and shipped on demand.', '', '• Water- and UV-resistant vinyl', '• Kiss-cut: peels off clean', '• Made for laptops, bottles, helmets and cars']
    : ['Matte poster, printed and shipped on demand.', '', '• Museum-grade matte paper, no glare', '• Archival inks that hold their color', '• Multiple sizes, shipped in a protective tube'];

  const description = [
    `${subject}${style ? ` — ${style.toLowerCase()}` : ''}${theme ? `, ${theme.toLowerCase()}` : ''}${it.palette ? `, ${String(it.palette).toLowerCase()} palette` : ''}.`,
    '',
    ...body,
    '',
    `Part of the ${col.title} collection · IDLE CYCLES by HK23 STUDIO. Piece ${it.sku}.`,
  ].join('\n');

  return { title, tags, description, collection: col };
}

// ─── printify ───────────────────────────────────────────────────────────────
async function verifyBlueprint(kind) {
  const bp = BLUEPRINT[kind];
  const real = await api(`/catalog/blueprints/${bp.id}.json`);
  return { ...bp, realTitle: real.title, ok: real.title === bp.label };
}

async function uploadArt(file, name) {
  const contents = readFileSync(file).toString('base64');
  const { id } = await api('/uploads/images.json', { method: 'POST', body: JSON.stringify({ file_name: name, contents }) });
  return id;
}

// Qué medidas se pueden vender para un arte dado. Se decide con el placeholder REAL de cada
// variante (ancho y alto en pixeles a la resolución de impresión), no con el título.
//   · proporción: ±3% respecto del arte. Un cuadrado impreso en 16x20 sale con franjas blancas.
//   · resolución: el arte debe cubrir al menos el 45% de los pixeles del placeholder
//     (≈135 dpi sobre un placeholder de 300 dpi). Bajo eso la impresión sale borrosa.
//   · sticker kiss-cut: el corte sigue al arte, así que la proporción no importa.
// Si nada calza devuelve []: ese producto NO se crea. Nunca se habilita "la menos mala".
export const TOL_PROPORCION = 1.03;
export const MIN_COBERTURA = 0.45;
export function fitVariants(variants, art, kind) {
  const ph = (v) => v.placeholders?.find((p) => p.position === 'front') || v.placeholders?.[0] || null;
  const conMedida = variants.filter((v) => ph(v)?.width && ph(v)?.height);
  if (!conMedida.length) return [];
  const resOK = (v) => art.w >= ph(v).width * MIN_COBERTURA && art.h >= ph(v).height * MIN_COBERTURA;
  if (kind === 'sticker') return conMedida.filter(resOK);
  const target = art.w / art.h;
  return conMedida.filter((v) => Math.abs(Math.log((ph(v).width / ph(v).height) / target)) <= Math.log(TOL_PROPORCION) && resOK(v));
}

export async function catalogVariants(blueprintId, providerId) {
  const { variants } = await api(`/catalog/blueprints/${blueprintId}/print_providers/${providerId}/variants.json`);
  return variants || [];
}

async function providerFor(bp) {
  const providers = await api(`/catalog/blueprints/${bp.id}/print_providers.json`);
  return (providers.find((x) => x.id === PROVEEDOR[bp.id]) || providers[0]).id;
}

// Precio de cada variante a partir del costo real. Solo quedan activas las medidas que calzan.
function priceVariants(full, markup, permitidas) {
  return full.variants.map((v) => ({ id: v.id, price: Math.max(Math.round(v.cost * markup), v.cost + 100), is_enabled: permitidas.has(v.id) }));
}

// Crea el producto y DEVUELVE EL ID APENAS EXISTE, vía onCreated, antes de cualquier otro paso.
// Si algo falla después (red, 429), el ledger ya conoce el producto y la corrida siguiente
// retoma desde el precio en vez de crear un duplicado.
async function createProduct(it, kind, onCreated) {
  const bp = BLUEPRINT[kind];
  const pp = await providerFor(bp);
  const variants = fitVariants(await catalogVariants(bp.id, pp), it, kind);
  if (!variants.length) { const e = new Error(`ninguna medida calza con un arte de ${it.w}x${it.h}`); e.nofit = true; throw e; }
  const ids = variants.map((v) => v.id);
  const position = variants[0]?.placeholders?.[0]?.position || 'front';
  const c = copyFor(it, kind);
  const imageId = await uploadArt(it.file, `${it.sku}.${/\.png$/i.test(it.file) ? 'png' : 'jpg'}`);

  const created = await api(`/shops/${SHOP}/products.json`, {
    method: 'POST',
    body: JSON.stringify({
      title: c.title, description: c.description, blueprint_id: bp.id, print_provider_id: pp, tags: c.tags,
      variants: variants.map((v) => ({ id: v.id, price: 9999, is_enabled: true })),
      print_areas: [{ variant_ids: ids, placeholders: [{ position, images: [{ id: imageId, x: 0.5, y: 0.5, scale: 1, angle: 0 }] }] }],
    }),
  });
  onCreated({ id: created.id, blueprint_id: bp.id, print_provider_id: pp, enabled_ids: ids, title: c.title });
  return created.id;
}

// Etapa de precio, reanudable: relee el costo real y fija precio + medidas activas.
async function priceProduct(e, kind) {
  const bp = BLUEPRINT[kind];
  const full = await api(`/shops/${SHOP}/products/${e.product_id}.json`);
  const priced = priceVariants(full, bp.markup, new Set(e.enabled_ids || []));
  await api(`/shops/${SHOP}/products/${e.product_id}.json`, { method: 'PUT', body: JSON.stringify({ variants: priced }) });
  const money = priced.filter((v) => v.is_enabled).map((v) => v.price);
  return { variants: money.length, min: Math.min(...money) / 100, max: Math.max(...money) / 100 };
}

const urlOf = (handle) => `https://${handle}`.replace(/^https:\/\/https?:\/\//, 'https://');

// Publica y espera la URL (hasta ~3 min). Antes de publicar MIRA el producto: si ya tiene URL no
// se publica de nuevo, y si Printify lo tiene bloqueado es que ya está sincronizando.
async function publishAndWait(productId) {
  let p = await api(`/shops/${SHOP}/products/${productId}.json`);
  if (p.external?.handle) return { handle: p.external.handle, externalId: p.external.id || null };
  if (!p.is_locked) {
    await api(`/shops/${SHOP}/products/${productId}/publish.json`, {
      method: 'POST',
      body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true, keyFeatures: true, shipping_template: true }),
    });
  }
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    await sleep(6000);
    p = await api(`/shops/${SHOP}/products/${productId}.json`);
    if (p.external?.handle) return { handle: p.external.handle, externalId: p.external.id || null };
  }
  return null;
}

// ─── selección ──────────────────────────────────────────────────────────────
// Etapas: created_unpriced → created → publishing → published.
// Fuera de juego: blocked (3 fallos seguidos), nofit (ninguna medida calza), gone (borrado en Printify).
const FUERA = new Set(['blocked', 'nofit', 'gone']);
const isDone = (e) => e?.stage === 'published';
const isOut = (e) => FUERA.has(e?.stage);
const isPending = (e) => Boolean(e?.product_id) && !isDone(e) && !isOut(e);

function pick(items, n) {
  const resume = items.filter((it) => isPending(ledger[it.sku]));
  const fresh = items.filter((it) => !ledger[it.sku]?.product_id && !isDone(ledger[it.sku]) && !isOut(ledger[it.sku]));

  // rotación: cada cupo va a la colección con menos piezas ya en la tienda
  const enTienda = {};
  for (const it of items) if (ledger[it.sku]?.product_id) { const c = collectionOf(it).slug; enTienda[c] = (enTienda[c] || 0) + 1; }
  const porCol = {};
  for (const it of fresh) (porCol[collectionOf(it).slug] ||= []).push(it);   // ya vienen ordenados por ranking
  const rotados = [];
  while (rotados.length < n) {
    const cands = Object.keys(porCol).filter((c) => porCol[c].length);
    if (!cands.length) break;
    cands.sort((a, b) => (enTienda[a] || 0) - (enTienda[b] || 0) || porCol[b].length - porCol[a].length);
    const c = cands[0];
    rotados.push(porCol[c].shift());
    enTienda[c] = (enTienda[c] || 0) + 1;
  }
  // los pendientes se retoman siempre y NO le quitan cupo a las piezas nuevas
  return { resume, fresh: rotados };
}

// ─── run ────────────────────────────────────────────────────────────────────
function fallo(sku, err) {
  const e = ledger[sku] || {};
  const attempts = (e.attempts || 0) + 1;
  let stage = e.product_id ? e.stage : 'error';
  if (err.nofit) stage = 'nofit';
  else if (err.status === 404 && e.product_id) stage = 'gone';
  else if (attempts >= MAX_INTENTOS) stage = 'blocked';
  ledger[sku] = { ...e, stage, attempts, error: err.message, last_attempt: new Date().toISOString() };
  save();
  return stage;
}

async function main() {
  if (LIVE && !acquireLock('wave')) { console.log('Ya hay una ola corriendo. No se lanza otra para no duplicar productos.'); return; }

  const cat = existsSync(join(HERE, 'data', 'catalog.json'))
    ? JSON.parse(readFileSync(join(HERE, 'data', 'catalog.json'), 'utf8'))
    : buildCatalog();

  const { resume, fresh } = pick(cat.items, N);
  const wave = [...resume, ...fresh];
  const done = cat.items.filter((it) => isDone(ledger[it.sku])).length;
  const fuera = Object.entries(ledger).filter(([, e]) => isOut(e));

  console.log(`\nPOD FACTORY · ola MidJourney  [${LIVE ? 'LIVE' : 'PLAN'}]  tienda ${SHOP}`);
  console.log(`catálogo ${cat.items.length} · publicados ${done} · por retomar ${resume.length} · nuevas en esta ola ${fresh.length}\n`);

  const kinds = [...new Set(wave.map(kindFor))];
  const BP = {};
  for (const k of kinds) {
    const v = await verifyBlueprint(k);
    BP[k] = v;
    console.log(`  blueprint ${v.id} → "${v.realTitle}" ${v.ok ? '✓' : `✗ esperaba "${v.label}"`}`);
  }
  if (Object.values(BP).some((v) => !v.ok)) { console.error('\nBlueprint no coincide con el catálogo real. Abortado.'); process.exitCode = 1; return; }
  console.log('');

  const urls = [];
  let creados = 0, publicados = 0, fallos = 0;

  for (const it of wave) {
    const kind = ledger[it.sku]?.kind || kindFor(it);
    const bp = BLUEPRINT[kind];
    const tag = `${it.sku} ${it.w}x${it.h} ${it.orientation}`.padEnd(30);

    if (!LIVE) {
      const c = copyFor(it, kind);
      const st = isPending(ledger[it.sku]) ? `RETOMAR desde ${ledger[it.sku].stage}` : 'crear';
      console.log(`· ${tag} → ${bp.label} (${bp.id}) ×${bp.markup}  [${st}]`);
      console.log(`    ${c.title}`);
      console.log(`    tags: ${c.tags.slice(0, 6).join(', ')}…`);
      continue;
    }

    try {
      // 1) crear — el id queda en el ledger en el mismo instante en que Printify lo devuelve
      if (!ledger[it.sku]?.product_id) {
        process.stdout.write(`→ ${tag} creando… `);
        await createProduct(it, kind, (c) => {
          ledger[it.sku] = { ...(ledger[it.sku] || {}), stage: 'created_unpriced', kind, product_id: c.id, blueprint_id: c.blueprint_id,
            print_provider_id: c.print_provider_id, enabled_ids: c.enabled_ids, title: c.title, created_at: new Date().toISOString() };
          save();
        });
        creados++;
        process.stdout.write(`✓ ${ledger[it.sku].product_id} · `);
      } else {
        process.stdout.write(`→ ${tag} retomando ${ledger[it.sku].product_id} (${ledger[it.sku].stage})… `);
      }

      // 2) precio — etapa propia: un producto sin precio real jamás se publica
      if (ledger[it.sku].stage === 'created_unpriced') {
        const r = await priceProduct(ledger[it.sku], kind);
        ledger[it.sku] = { ...ledger[it.sku], stage: 'created', variants: r.variants, price_usd: [r.min, r.max] };
        save();
        process.stdout.write(`${r.variants} medidas · US$${r.min}–${r.max} · `);
      }

      // 3) publicar
      process.stdout.write('publicando… ');
      const pub = await publishAndWait(ledger[it.sku].product_id);
      if (pub) {
        const url = urlOf(pub.handle);
        ledger[it.sku] = { ...ledger[it.sku], stage: 'published', url, external_id: pub.externalId, variants_synced: true, attempts: 0, error: undefined, published_at: new Date().toISOString() };
        save(); publicados++; urls.push(`${it.sku} ${url}`);
        console.log(`✓ ${url}`);
      } else {
        const attempts = (ledger[it.sku].attempts || 0) + 1;
        ledger[it.sku] = { ...ledger[it.sku], stage: attempts >= MAX_INTENTOS ? 'blocked' : 'publishing', attempts, last_attempt: new Date().toISOString() };
        save();
        console.log(attempts >= MAX_INTENTOS ? '✗ sin URL tras 3 intentos — queda bloqueado, revisar en Printify' : '⏳ sin URL todavía — se retoma en la próxima corrida');
      }
    } catch (err) {
      const stage = fallo(it.sku, err); fallos++;
      console.log(`✗ ${err.message}${stage === 'blocked' ? ' — BLOQUEADO tras 3 intentos' : stage === 'nofit' ? ' — se descarta' : stage === 'gone' ? ' — ya no existe en Printify' : ''}`);
    }
  }

  console.log('');
  if (!LIVE) {
    console.log(`PLAN · ${fresh.length} piezas nuevas (${fresh.filter((i) => kindFor(i) !== 'sticker').length} póster · ${fresh.filter((i) => kindFor(i) === 'sticker').length} sticker) + ${resume.length} por retomar.`);
    console.log(`Catálogo ${cat.items.length} · ya publicadas ${done} · quedan ${cat.items.length - done}. Nada tocó la red salvo verificar blueprints.`);
    console.log('Corre con --live para crear y publicar.');
  } else {
    console.log(`OLA LISTA · ${creados} creados · ${publicados} publicados · ${fallos} fallos · quedan ${cat.items.length - done - publicados}.`);
    urls.slice(0, 3).forEach((u) => console.log(`  ${u}`));
    if (urls.length > 3) console.log(`  …y ${urls.length - 3} más en data/mj-ledger.json`);
  }
  const fueraAhora = Object.entries(ledger).filter(([, e]) => isOut(e));
  if (fueraAhora.length) console.log(`FUERA DE JUEGO: ${fueraAhora.map(([k, e]) => `${k} (${e.stage})`).join(', ')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
