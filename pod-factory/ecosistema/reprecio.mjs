#!/usr/bin/env node
/**
 * RE-PRECIO · POD FACTORY
 * Vuelve a preciar los productos YA publicados con el markup vigente.
 * Sin --live no toca nada: muestra qué haría, producto por producto.
 *
 * El markup NO se escribe acá: se lee del texto de midjourney/publish-wave.mjs
 * para que exista una sola fuente de verdad (importarlo ejecutaría la ola).
 */
import { readFileSync } from 'node:fs';
import { printify as api, loadJSON, sleep, SHOP } from '../lib.mjs';

const LIVE = process.argv.includes('--live');

// markup vigente, leído del publicador
const src = readFileSync(new URL('../midjourney/publish-wave.mjs', import.meta.url), 'utf8');
const MARKUP = {};
for (const m of src.matchAll(/(\w+):\s*\{\s*id:\s*\d+,[^}]*markup:\s*([\d.]+)/g)) MARKUP[m[1]] = parseFloat(m[2]);
if (!Object.keys(MARKUP).length) { console.error('no pude leer el markup de publish-wave.mjs'); process.exit(1); }

const precio = (cost, markup) => Math.max(Math.round(cost * markup), cost + 100);
const usd = c => '$' + (c / 100).toFixed(2);

const ledger = loadJSON('midjourney/data/mj-ledger.json', {});
const entradas = Object.entries(ledger).filter(([, v]) => v.product_id && v.stage === 'published');

console.log(`\nRE-PRECIO  [${LIVE ? 'LIVE' : 'PROPUESTA'}]  tienda ${SHOP}`);
console.log('markup vigente: ' + Object.entries(MARKUP).map(([k, v]) => `${k} ×${v}`).join(' · ') + '\n');

let tocados = 0, sinCambio = 0;
for (const [sku, e] of entradas) {
  const mk = MARKUP[e.kind];
  if (!mk) { console.log(`· ${sku.padEnd(12)} sin markup para "${e.kind}", se salta`); continue; }
  let full;
  try { full = await api(`/shops/${SHOP}/products/${e.product_id}.json`); }
  catch (err) { console.log(`· ${sku.padEnd(12)} no pude leerlo: ${err.message}`); continue; }

  const activos = full.variants.filter(v => v.is_enabled);
  if (!activos.length) { console.log(`· ${sku.padEnd(12)} sin variantes activas`); continue; }

  const nuevos = activos.map(v => ({ id: v.id, antes: v.price, ahora: precio(v.cost, mk), cost: v.cost }));
  const cambia = nuevos.filter(v => v.ahora !== v.antes);
  const aMin = Math.min(...nuevos.map(v => v.antes)), aMax = Math.max(...nuevos.map(v => v.antes));
  const nMin = Math.min(...nuevos.map(v => v.ahora)), nMax = Math.max(...nuevos.map(v => v.ahora));

  if (!cambia.length) { sinCambio++; console.log(`· ${sku.padEnd(12)} ya está al día (${usd(aMin)}–${usd(aMax)})`); continue; }

  console.log(`${LIVE ? '→' : '·'} ${sku.padEnd(12)} ${usd(aMin)}–${usd(aMax)}  →  ${usd(nMin)}–${usd(nMax)}   (${cambia.length}/${activos.length} variantes)`);

  if (LIVE) {
    const body = full.variants.map(v => {
      const n = nuevos.find(x => x.id === v.id);
      return { id: v.id, price: n ? n.ahora : v.price, is_enabled: v.is_enabled };
    });
    try {
      await api(`/shops/${SHOP}/products/${e.product_id}.json`, { method: 'PUT', body: JSON.stringify({ variants: body }) });
      await api(`/shops/${SHOP}/products/${e.product_id}/publish.json`, { method: 'POST', body: JSON.stringify({ title: false, description: false, images: false, variants: true, tags: false }) });
      tocados++;
      await sleep(600);
    } catch (err) { console.log(`   ✗ falló: ${err.message}`); }
  } else tocados++;
}

console.log(`\n${LIVE ? 'repreciados' : 'se repreciarían'}: ${tocados} · ya al día: ${sinCambio}`);
if (!LIVE) console.log('Para aplicarlo de verdad:  node ecosistema/reprecio.mjs --live\n');
