// sync-products.mjs — deja TODOS los productos ya publicados con el copy y los tags vigentes.
// Existe porque las reglas cambian (tienda en inglés, colecciones temáticas, tags estructurales)
// y los productos viejos quedaron con el texto anterior. Es idempotente: solo toca lo que difiere.
//
// Son dos pasos y cualquiera puede fallar por separado: corregir en Printify (PUT) y enviar a
// Shopify (publish). Si el segundo falla, Printify ya quedó bien y una comparación simple diría
// "al día" para siempre. Por eso el envío pendiente se anota en data/sync-state.json y se
// reintenta en la corrida siguiente aunque el copy ya coincida.
//   node sync-products.mjs          → informe, sin tocar nada
//   node sync-products.mjs --live   → aplica
import { join } from 'node:path';
import { copyFor } from './midjourney/publish-wave.mjs';
import { printify, loadJSON, saveJSON, SHOP, ROOT } from './lib.mjs';

const LIVE = process.argv.includes('--live');
const STATE = join(ROOT, 'data', 'sync-state.json');
const state = loadJSON(STATE, {});

// ── PROOF OF WORK: copy en inglés ────────────────────────────────────────────
const POW_TAGS = ['hk23', 'proof of work', 'data art', 'generative art', 'pixel art', 'dev gift', 'coding art', 'activity grid', 'terminal aesthetic', 'tech decor'];
const EDITIONS = {
  'pow-poster-002': { ed: '002', serial: '0GNZ1P1', tokens: '32M', sessions: 44, days: 23, streak: 3 },
  'pow-poster-003': { ed: '003', serial: '1UQDHCL', tokens: '42.2M', sessions: 109, days: 92, streak: 18 },
};
function powCopy(sku, current) {
  const e = EDITIONS[sku];
  if (e) return {
    title: `PROOF OF WORK — Edition ${e.ed} · ${e.tokens} tokens (Serial ${e.serial})`,
    description: `Generative poster from the PROOF OF WORK series. The grid, its density and the coral peaks come from real activity data: ${e.tokens} tokens, ${e.sessions} sessions, ${e.days} active days and a longest streak of ${e.streak} days. The same numbers always generate the same image, which is why serial ${e.serial} identifies this piece and no other.\n\n• Museum-grade matte paper, no glare\n• Archival inks that hold their color\n• Printed and shipped on demand\n\nEdition ${e.ed} of 100 · HK23 STUDIO.`,
    tags: [...POW_TAGS, 'poster', 'numbered edition', 'stats poster'],
  };
  return {
    title: current.title,
    description: 'PROOF OF WORK by HK23 STUDIO. Your work, made object.\n\n• Die-cut vinyl sticker, water- and UV-resistant\n• Peels off clean\n• Made for laptops, bottles and helmets\n\nPart of the Season One capsule. Printed and shipped on demand.',
    tags: [...POW_TAGS, 'sticker', 'laptop sticker', 'vinyl sticker'],
  };
}

// ── qué debería tener cada producto ─────────────────────────────────────────
const objetivos = [];
const pow = loadJSON(join(ROOT, 'data', 'printify-ledger.json'), {});
for (const [sku, e] of Object.entries(pow)) if (e.product_id) objetivos.push({ sku, id: e.product_id, want: (cur) => powCopy(sku, cur) });

const mj = loadJSON(join(ROOT, 'midjourney', 'data', 'mj-ledger.json'), {});
const cat = loadJSON(join(ROOT, 'midjourney', 'data', 'catalog.json'), { items: [] });
const items = Array.isArray(cat) ? cat : (cat.items || []);
for (const [sku, e] of Object.entries(mj)) {
  if (!e.product_id || ['gone', 'nofit'].includes(e.stage)) continue;
  const it = items.find((i) => i.sku === sku);
  if (!it) continue;
  const kind = e.kind || (e.blueprint_id === 1268 ? 'sticker' : 'posterV');
  objetivos.push({ sku, id: e.product_id, want: (cur) => { const c = copyFor(it, kind); return { title: cur.title, description: c.description, tags: c.tags }; } });
}

const igual = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const plano = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const ENVIO = { title: true, description: true, images: false, variants: false, tags: true };

const r = { ok: 0, actualizados: 0, reenviados: 0, bloqueados: 0, fallos: 0 };
for (const o of objetivos) {
  try {
    const p = await printify(`/shops/${SHOP}/products/${o.id}.json`);
    const want = o.want(p);
    const difiere = p.title !== want.title || plano(p.description) !== plano(want.description) || !igual(p.tags || [], want.tags);
    const pendiente = state[o.id]?.pending_publish === true;

    if (!difiere && !pendiente) { r.ok++; continue; }
    if (p.is_locked) { r.bloqueados++; console.log(`· ${o.sku} bloqueado por Printify — se retoma en la próxima corrida`); continue; }
    if (!LIVE) { console.log(`· ${o.sku} ${difiere ? `desactualizado → ${want.tags.slice(0, 4).join(', ')}…` : 'corregido en Printify, falta enviarlo a Shopify'}`); continue; }

    if (difiere) {
      state[o.id] = { sku: o.sku, pending_publish: true, since: new Date().toISOString() };
      saveJSON(STATE, state);                  // se anota ANTES: si el envío falla, queda la deuda
      await printify(`/shops/${SHOP}/products/${o.id}.json`, { method: 'PUT', body: JSON.stringify(want) });
    }
    await printify(`/shops/${SHOP}/products/${o.id}/publish.json`, { method: 'POST', body: JSON.stringify(ENVIO) });
    state[o.id] = { sku: o.sku, pending_publish: false, synced_at: new Date().toISOString() };
    saveJSON(STATE, state);
    if (difiere) { r.actualizados++; console.log(`✓ ${o.sku} actualizado y enviado a Shopify`); }
    else { r.reenviados++; console.log(`✓ ${o.sku} envío pendiente completado`); }
  } catch (err) {
    r.fallos++;
    console.log(`✗ ${o.sku} ${String(err.message).slice(0, 140)} — se reintenta en la próxima corrida`);
  }
}
console.log(`copy y tags: ${r.ok} al día · ${r.actualizados} actualizados · ${r.reenviados} reenviados · ${r.bloqueados} bloqueados · ${r.fallos} fallos${LIVE ? '' : ' (informe, no se aplicó nada)'}`);
