// publish-printify.mjs — sube las piezas de out/printify-drafts.json a Printify como BORRADORES.
// Corrige dos cosas del lister viejo: usa los blueprints correctos y calcula el precio
// leyendo el costo real del producto ya creado (el catálogo no expone `cost`).
//   node publish-printify.mjs          → plan, sin red
//   node publish-printify.mjs --live   → crea los productos
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CFG = JSON.parse(readFileSync('/Users/hk23neo/vice-os-artifact/vice-seller/config.local.json', 'utf8'));
const BASE = 'https://api.printify.com/v1';
const H = { Authorization: `Bearer ${CFG.printifyToken}`, 'Content-Type': 'application/json' };
const SHOP = CFG.printifyShopId;
const LIVE = process.argv.includes('--live');

// blueprints verificados contra el catálogo real (2026-09-24)
const BLUEPRINT = {
  sticker: { id: 1268, label: 'Kiss-Cut Vinyl Decals' },
  poster: { id: 282, label: 'Matte Vertical Posters' },
};

const LEDGER = join(HERE, 'data', 'printify-ledger.json');
const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : {};
const save = () => writeFileSync(LEDGER, JSON.stringify(ledger, null, 2) + '\n');

const api = async (path, init) => {
  const r = await fetch(`${BASE}${path}`, { headers: H, ...init });
  if (!r.ok) throw new Error(`${init?.method || 'GET'} ${path} → ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
};

async function uploadArt(file, name) {
  const contents = readFileSync(file).toString('base64');
  const { id } = await api('/uploads/images.json', { method: 'POST', body: JSON.stringify({ file_name: name, contents }) });
  return id;
}

async function createDraft(p) {
  const bp = BLUEPRINT[p.kind];
  const providers = await api(`/catalog/blueprints/${bp.id}/print_providers.json`);
  // Proveedor FIJO por blueprint. providers[0] cambia de un día a otro y mezcla proveedores
  // con tarifas y perfiles de envío distintos para el mismo producto.
  const PREFERIDO = { 282: 99, 284: 99, 1268: 215 };       // 99 = Printify Choice · 215 = Stickers & Posters
  const pp = (providers.find((x) => x.id === PREFERIDO[bp.id]) || providers[0]).id;
  const { variants } = await api(`/catalog/blueprints/${bp.id}/print_providers/${pp}/variants.json`);
  const ids = variants.map((v) => v.id);
  const imageId = await uploadArt(p.art, `${p.sku}.png`);

  // 1) crear con precio provisional (el catálogo no trae el costo)
  const created = await api(`/shops/${SHOP}/products.json`, {
    method: 'POST',
    body: JSON.stringify({
      title: p.title, description: p.description, blueprint_id: bp.id, print_provider_id: pp, tags: p.tags,
      variants: variants.map((v) => ({ id: v.id, price: 9999, is_enabled: true })),
      print_areas: [{ variant_ids: ids, placeholders: [{ position: 'front', images: [{ id: imageId, x: 0.5, y: 0.5, scale: 1, angle: 0 }] }] }],
    }),
  });

  // 2) releer costos reales y aplicar el markup
  const full = await api(`/shops/${SHOP}/products/${created.id}.json`);
  const priced = full.variants.map((v) => ({ id: v.id, price: Math.max(Math.round(v.cost * p.markup), v.cost + 100), is_enabled: true }));
  await api(`/shops/${SHOP}/products/${created.id}.json`, { method: 'PUT', body: JSON.stringify({ variants: priced }) });

  const money = priced.map((v) => v.price);
  return { id: created.id, variants: priced.length, min: Math.min(...money) / 100, max: Math.max(...money) / 100 };
}

const drafts = JSON.parse(readFileSync(join(HERE, 'out', 'printify-drafts.json'), 'utf8'));
console.log(`\nPOD FACTORY · Printify  [${LIVE ? 'LIVE' : 'PLAN'}]  tienda ${SHOP}`);

for (const p of drafts.products) {
  if (ledger[p.sku]?.product_id) { console.log(`· ${p.sku.padEnd(24)} ya existe (${ledger[p.sku].product_id})`); continue; }
  if (!LIVE) { console.log(`· ${p.sku.padEnd(24)} ${BLUEPRINT[p.kind].label} ×${p.markup}`); continue; }
  process.stdout.write(`→ ${p.sku.padEnd(24)} `);
  try {
    const r = await createDraft(p);
    ledger[p.sku] = { product_id: r.id, kind: p.kind, variants: r.variants, price_usd: [r.min, r.max], created: new Date().toISOString() };
    save();
    console.log(`✓ ${r.id} · ${r.variants} variantes · US$${r.min}–${r.max}`);
  } catch (e) {
    ledger[p.sku] = { error: e.message, at: new Date().toISOString() };
    save();
    console.log(`✗ ${e.message}`);
  }
}
if (!LIVE) console.log('\nPlan solamente. Corre con --live para crear los borradores.');
