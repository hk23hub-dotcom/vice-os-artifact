// orchestrator.js — the brain. Picks the next wave of un-published items,
// generates SEO, and runs them through each enabled channel. Records every
// step to the ledger so it is resumable and idempotent.
import { loadItems, loadConfig, loadCaptions } from './sources.js';
import { loadLedger, record, pending, summary } from './state.js';
import { buildSeo, captionFor } from './seo.js';

const log = (...a) => console.log(...a);

export function plan(waveSize) {
  const items = loadItems();
  const cfg = loadConfig();
  const caps = loadCaptions();
  const size = waveSize || cfg.waveSize;
  // only sell vision-approved keepers; skip logos/mockups/renders.
  const sellable = items.filter((it) => caps[it.sku] && caps[it.sku].keep === true);
  const todo = pending(sellable, 'etsy').slice(0, size);
  return { items, sellable, todo, cfg, caps };
}

// dry-run: show exactly what the next wave WOULD do (no network, no fees)
export function dryRun(waveSize) {
  const { items, sellable, todo, cfg, caps } = plan(waveSize);
  log(`\n  VICE SELLER — dry run`);
  log(`  collection: ${items.length} · curated sellable: ${sellable.length} · captioned: ${Object.keys(caps).length} · wave: ${todo.length}`);
  log(`  channels: ${Object.entries(cfg.channels).filter(([, c]) => c.enabled).map(([k]) => k).join(', ') || 'none'}`);
  log(`  etsy mode: ${cfg.channels.etsyDigital.publish} (draft = $0 until you publish)\n`);
  todo.slice(0, 5).forEach((it, i) => {
    const seo = buildSeo(it, caps[it.sku] || captionFor(it, i), i);
    log(`  • ${it.sku}  ${seo.title}`);
    log(`      $${seo.price} · tags: ${seo.tags.join(', ')}`);
  });
  if (todo.length > 5) log(`  … +${todo.length - 5} more in this wave`);
  log(`\n  ${JSON.stringify(summary(items))}\n`);
  return summary(items);
}

// live wave: requires an Etsy token. captionFn is optional (vision upgrade).
export async function runWave({ waveSize, captionFn } = {}) {
  const { todo, cfg, caps } = plan(waveSize);
  const etsy = await import('./etsy.js');
  log(`VICE SELLER — live wave of ${todo.length} (etsy: ${cfg.channels.etsyDigital.publish})`);
  let ok = 0, fail = 0;
  for (let i = 0; i < todo.length; i++) {
    const it = todo[i];
    try {
      // vision caption from captions.json → falls back to template only if missing
      const caption = caps[it.sku] || loadLedger()[it.id]?.seo?.caption || (captionFn ? await captionFn(it) : captionFor(it, i));
      const seo = buildSeo(it, caption, i);
      record(it.id, { seo });

      const img = etsy.localImage(it.sku) || await etsy.fetchImage(it.full);
      const listingId = await etsy.createDraft(seo);
      await etsy.uploadImage(listingId, img);
      await etsy.uploadFile(listingId, img, it.sku);
      let state = 'draft';
      if (cfg.channels.etsyDigital.publish === 'active') { await etsy.activate(listingId); state = 'active'; }

      record(it.id, { etsy: { done: true, listingId, state } });

      // --- physical print-on-demand (Printify → Etsy) ---
      if (cfg.channels.printify?.enabled) {
        try {
          const pf = await import('./printify.js');
          if (pf.printifyReady()) {
            const imgId = await pf.uploadImage(it.preview, `${it.sku}.webp`);
            const ids = {};
            for (const kind of cfg.channels.printify.blueprints) {
              const markup = kind === 'canvas' ? cfg.pricing.canvasMarkup : cfg.pricing.posterMarkup;
              const pid = await pf.createProduct({ kind, title: seo.title, description: seo.description, imageId: imgId, markup });
              if (cfg.channels.printify.publish === 'active') await pf.publish(pid);
              ids[kind] = pid;
            }
            record(it.id, { printify: { done: true, products: ids } });
          }
        } catch (e) { record(it.id, { printify: { done: false, error: String(e).slice(0, 160) } }); }
      }

      // --- traffic (Pinterest) ---
      if (cfg.channels.pinterest?.enabled) {
        try {
          const pin = await import('./pinterest.js');
          if (pin.pinterestReady()) {
            const link = `https://www.etsy.com/listing/${listingId}`;
            const pinId = await pin.createPin({ title: seo.caption.subject + ' Wall Art', description: seo.description, link, imageUrl: it.preview });
            record(it.id, { pinterest: { done: true, pinId } });
          }
        } catch (e) { record(it.id, { pinterest: { done: false, error: String(e).slice(0, 160) } }); }
      }

      ok++;
      log(`  ✓ ${it.sku} → listing ${listingId} (${state})`);
      await new Promise((r) => setTimeout(r, 1100)); // stay under 5 QPS
    } catch (e) {
      fail++;
      record(it.id, { etsy: { done: false, error: String(e).slice(0, 200) } });
      log(`  ✗ ${it.sku}: ${String(e).slice(0, 160)}`);
    }
  }
  log(`\nWave complete: ${ok} ok, ${fail} failed.`);
  return { ok, fail, summary: summary(loadItems()) };
}
