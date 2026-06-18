// sources.js — load the MidJourney collection manifest and build image URLs.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const loadConfig = () => JSON.parse(readFileSync(join(ROOT, 'config.json'), 'utf8'));

// vision-curated captions/keep decisions, keyed by sku (built during captioning).
export function loadCaptions() {
  const p = join(ROOT, 'data', 'captions.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {};
}

// Every job in the manifest becomes one print "item".
export function loadItems() {
  const cfg = loadConfig();
  const man = JSON.parse(readFileSync(join(ROOT, cfg.source), 'utf8'));
  return (man.ids || []).map((id, i) => ({
    id,
    sku: `mjx-${String(i + 1).padStart(4, '0')}`,
    full: `${cfg.cdnBase}/${id}/0_0.png`,            // full-resolution upscale
    preview: `${cfg.cdnBase}/${id}/0_0_2048_N.webp`, // high-quality preview
    thumb: `${cfg.cdnBase}/${id}/0_0_640_N.webp`,
  }));
}
