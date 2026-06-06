// publish.js — turn generated listings into Etsy listings (draft → image → optional publish).
// Run: npm run publish:dry   (preview, no API writes)
//      npm run publish       (real: creates listings on your shop)
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { api, getShopId, loadConfig, REPO } from './lib.js';

const DRY = process.argv.includes('--dry');
const cfg = loadConfig();
const d = cfg.listingDefaults;
const STATE_PATH = join(REPO, 'etsy-agent', '.published.json');

const listings = JSON.parse(readFileSync(join(REPO, 'etsy-listings.json'), 'utf8'));
const published = existsSync(STATE_PATH) ? JSON.parse(readFileSync(STATE_PATH, 'utf8')) : {};

function recordPublished(id, listingId) {
  published[id] = { listing_id: listingId, at: new Date().toISOString() };
  writeFileSync(STATE_PATH, JSON.stringify(published, null, 2));
}

// Etsy accepts JPG/PNG/GIF — not WebP. Convert via macOS `sips` to a temp JPG.
function toJpg(relPath) {
  const src = join(REPO, relPath);
  if (/\.(jpe?g|png|gif)$/i.test(relPath)) return src;
  const out = join(mkdtempSync(join(tmpdir(), 'etsy-')), 'image.jpg');
  execFileSync('sips', ['-s', 'format', 'jpeg', src, '--out', out], { stdio: 'ignore' });
  return out;
}

async function createDraft(L, shopId) {
  const body = new URLSearchParams({
    quantity: String(d.quantity),
    title: L.title,
    description: L.description,
    price: L.price,
    who_made: d.who_made,
    when_made: d.when_made,
    taxonomy_id: String(d.taxonomy_id),
    type: d.type,
    tags: L.tags.join(','),
    materials: (L.materials || []).join(','),
  });
  const r = await api(`/shops/${shopId}/listings`, { method: 'POST', body });
  return r.listing_id;
}

async function uploadImage(shopId, listingId, jpgPath) {
  const buf = readFileSync(jpgPath);
  const fd = new FormData();
  fd.append('image', new Blob([buf], { type: 'image/jpeg' }), 'listing.jpg');
  await api(`/shops/${shopId}/listings/${listingId}/images`, { method: 'POST', body: fd, isForm: true });
}

async function activate(shopId, listingId) {
  await api(`/shops/${shopId}/listings/${listingId}`, {
    method: 'PATCH',
    body: new URLSearchParams({ state: 'active' }),
  });
}

(async () => {
  if (!DRY && (!d.taxonomy_id || d.taxonomy_id <= 0)) {
    console.error('✗ Set listingDefaults.taxonomy_id in config.json (run `npm run taxonomy` to find it).');
    process.exit(1);
  }

  const pending = listings.filter((L) => !published[L.id]);
  console.log(`\nHK23 Etsy Agent — ${pending.length} listing(s) pending` + (DRY ? '  [DRY RUN]\n' : '\n'));

  if (DRY) {
    pending.forEach((L) => {
      console.log(`• ${L.id}  $${L.price}  ${L.type}`);
      console.log(`  ${L.title}`);
      console.log(`  tags(${L.tags.length}): ${L.tags.join(', ')}`);
      console.log(`  image: ${L.file}\n`);
    });
    console.log('Dry run only — no listings created. Remove --dry to publish for real.\n');
    return;
  }

  const shopId = await getShopId();
  for (const L of pending) {
    try {
      const jpg = toJpg(L.file);
      const listingId = await createDraft(L, shopId);
      await uploadImage(shopId, listingId, jpg);
      if (d.publish) await activate(shopId, listingId);
      recordPublished(L.id, listingId);
      console.log(`✓ ${L.id} → listing ${listingId} ${d.publish ? '(ACTIVE)' : '(draft)'}`);
    } catch (e) {
      console.error(`✗ ${L.id} failed: ${e.message}`);
    }
  }
  console.log(`\nDone. ${d.publish ? 'Published live.' : 'Created as drafts — review in Etsy, or set listingDefaults.publish=true to auto-activate.'}\n`);
})();
