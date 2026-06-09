// state.js — local ledger: the source of truth for what each item has done
// across channels. One JSON file, append-friendly, survives restarts.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './sources.js';

const LEDGER = join(ROOT, 'data', 'ledger.json');

export function loadLedger() {
  if (!existsSync(LEDGER)) return {};
  try { return JSON.parse(readFileSync(LEDGER, 'utf8')); } catch { return {}; }
}

export function saveLedger(l) {
  writeFileSync(LEDGER, JSON.stringify(l, null, 2));
}

// record(id, {etsy:{listingId,state}, printify:{...}, pinterest:{...}, seo:{...}})
export function record(id, patch) {
  const l = loadLedger();
  l[id] = { ...(l[id] || {}), ...patch, updated_at: new Date().toISOString() };
  saveLedger(l);
  return l[id];
}

// items that still need work on a given channel
export function pending(items, channel) {
  const l = loadLedger();
  return items.filter((it) => !(l[it.id] && l[it.id][channel] && l[it.id][channel].done));
}

export function summary(items) {
  const l = loadLedger();
  const count = (ch) => items.filter((it) => l[it.id]?.[ch]?.done).length;
  return {
    total: items.length,
    etsy: count('etsy'),
    printify: count('printify'),
    pinterest: count('pinterest'),
    seoReady: items.filter((it) => l[it.id]?.seo).length,
  };
}
