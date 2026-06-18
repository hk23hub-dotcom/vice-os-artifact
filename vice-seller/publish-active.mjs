// publish-active.mjs — flip vision-approved Etsy DRAFTS to ACTIVE (incurs $0.20 each).
// Only publishes captions[sku].keep === true (skips the early bad test draft).
import { loadLedger, saveLedger } from './lib/state.js';
import { loadCaptions } from './lib/sources.js';
import { activate } from './lib/etsy.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const caps = loadCaptions();
const ledger = loadLedger();

// map listingId → sku via ledger; need sku to check keep. Ledger is keyed by job id, not sku.
// Rebuild sku from manifest order.
import { loadItems } from './lib/sources.js';
const items = loadItems();
const idToSku = Object.fromEntries(items.map((it) => [it.id, it.sku]));

const targets = Object.entries(ledger)
  .filter(([id, v]) => v.etsy && v.etsy.done && v.etsy.listingId && v.etsy.state !== 'active')
  .map(([id, v]) => ({ id, sku: idToSku[id], listingId: v.etsy.listingId }))
  .filter((t) => t.sku && caps[t.sku] && caps[t.sku].keep === true);

console.log(`Publishing ${targets.length} keeper drafts → ACTIVE (~$${(targets.length * 0.2).toFixed(2)} in Etsy fees)\n`);
let ok = 0, fail = 0;
for (const t of targets) {
  try {
    await activate(t.listingId);
    ledger[t.id].etsy.state = 'active';
    saveLedger(ledger);
    ok++;
    console.log(`  ✓ ${t.sku} → ${t.listingId} ACTIVE`);
  } catch (e) {
    fail++;
    console.log(`  ✗ ${t.sku}: ${String(e).slice(0, 140)}`);
  }
  await sleep(1300); // throttle: stay under rate limit + avoid mass-listing velocity flags
}
console.log(`\nDone: ${ok} published, ${fail} failed.`);
