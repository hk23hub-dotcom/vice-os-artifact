// fix-aspect.mjs — deja a la venta SOLO las medidas que el arte soporta, en Printify Y en Shopify.
//
// Cubre los dos ledgers (colección diaria y PROOF OF WORK). Para cada producto:
//   1. calcula las medidas permitidas con el placeholder real (proporción ±3%, resolución ≥45%)
//   2. si Printify tiene otras habilitadas, las corrige (PUT)
//   3. REPUBLICA las variantes a Shopify. Sin este paso el cambio se queda en Printify y la
//      tienda sigue vendiendo las 46 medidas, incluidas las que salen con franjas blancas.
// Printify bloquea un producto mientras sincroniza: los bloqueados se saltan y se retoman en la
// corrida siguiente. El estado de sincronización vive en data/variants-state.json.
//   node fix-aspect.mjs           → informe, sin tocar nada
//   node fix-aspect.mjs --live    → aplica
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fitVariants, catalogVariants } from './publish-wave.mjs';
import { printify, loadJSON, saveJSON, SHOP } from '../lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const LIVE = process.argv.includes('--live');
const STATE = join(HERE, 'data', 'variants-state.json');
const state = loadJSON(STATE, {});

const cat = loadJSON(join(HERE, 'data', 'catalog.json'), { items: [] });
const items = Array.isArray(cat) ? cat : (cat.items || []);
const mj = loadJSON(join(HERE, 'data', 'mj-ledger.json'), {});
const pow = loadJSON(join(HERE, '..', 'data', 'printify-ledger.json'), {});
const drafts = loadJSON(join(HERE, '..', 'out', 'printify-drafts.json'), { products: [] });

function dims(file) {
  try {
    const o = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const w = Number(o.match(/pixelWidth:\s*(\d+)/)?.[1]), h = Number(o.match(/pixelHeight:\s*(\d+)/)?.[1]);
    return w && h ? { w, h } : null;
  } catch { return null; }
}

// objetivos: { sku, id, art:{w,h} }
const objetivos = [];
for (const [sku, e] of Object.entries(mj)) {
  if (!e.product_id || ['gone', 'nofit'].includes(e.stage)) continue;
  const it = items.find((i) => i.sku === sku);
  if (it?.w && it?.h) objetivos.push({ sku, id: e.product_id, art: { w: it.w, h: it.h } });
}
for (const [sku, e] of Object.entries(pow)) {
  if (!e.product_id) continue;
  const d = drafts.products.find((p) => p.sku === sku);
  const art = d?.art && existsSync(d.art) ? dims(d.art) : null;
  if (art) objetivos.push({ sku, id: e.product_id, art });
}

const variantsCache = {};
const r = { ok: 0, corregidos: 0, republicados: 0, bloqueados: 0, sinMedida: 0, fallos: 0 };

for (const o of objetivos) {
  try {
    const p = await printify(`/shops/${SHOP}/products/${o.id}.json`);
    const kind = p.blueprint_id === 1268 ? 'sticker' : 'poster';
    const key = `${p.blueprint_id}/${p.print_provider_id}`;
    variantsCache[key] ||= await catalogVariants(p.blueprint_id, p.print_provider_id);
    const permitidas = new Set(fitVariants(variantsCache[key], o.art, kind).map((v) => v.id));

    if (!permitidas.size) { r.sinMedida++; console.log(`! ${o.sku} ninguna medida soporta un arte de ${o.art.w}x${o.art.h} — revisar a mano`); continue; }

    const habilitadas = p.variants.filter((v) => v.is_enabled).map((v) => v.id);
    const difiere = habilitadas.length !== permitidas.size || habilitadas.some((id) => !permitidas.has(id));
    const sincronizado = state[o.id]?.synced === true && state[o.id]?.enabled === permitidas.size;

    if (!difiere && sincronizado) { r.ok++; continue; }
    if (p.is_locked) { r.bloqueados++; console.log(`· ${o.sku} bloqueado por Printify (sincronizando) — se retoma en la próxima corrida`); continue; }
    if (!LIVE) { console.log(`· ${o.sku} ${difiere ? `medidas: ${habilitadas.length} → ${permitidas.size}` : 'medidas bien en Printify, falta enviarlas a Shopify'}`); continue; }

    if (difiere) {
      const body = { variants: p.variants.map((v) => ({ id: v.id, price: v.price, is_enabled: permitidas.has(v.id) })) };
      await printify(`/shops/${SHOP}/products/${o.id}.json`, { method: 'PUT', body: JSON.stringify(body) });
      r.corregidos++;
      state[o.id] = { sku: o.sku, synced: false, enabled: permitidas.size, fixed_at: new Date().toISOString() };
      saveJSON(STATE, state);
    }
    await printify(`/shops/${SHOP}/products/${o.id}/publish.json`, { method: 'POST',
      body: JSON.stringify({ title: false, description: false, images: false, variants: true, tags: false }) });
    state[o.id] = { ...(state[o.id] || {}), sku: o.sku, synced: true, enabled: permitidas.size, synced_at: new Date().toISOString() };
    saveJSON(STATE, state);
    r.republicados++;
    console.log(`✓ ${o.sku} ${permitidas.size} medidas a la venta (arte ${o.art.w}x${o.art.h}) → enviado a Shopify`);
  } catch (err) {
    r.fallos++;
    console.log(`✗ ${o.sku} ${err.message.slice(0, 140)}`);
  }
}
console.log(`medidas: ${r.ok} al día · ${r.corregidos} corregidos · ${r.republicados} enviados a Shopify · ${r.bloqueados} bloqueados · ${r.sinMedida} sin medida posible · ${r.fallos} fallos${LIVE ? '' : ' (informe, no se aplicó nada)'}`);
