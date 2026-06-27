// proof-of-work-stickers.mjs — list the PROOF OF WORK sticker capsule on Printify.
// Unlike the MidJourney waves, this sources our OWN art (local PNGs) and uploads
// via base64. Dry-run by default; --live actually creates products.
//
//   node proof-of-work-stickers.mjs          # plan only, no network
//   node proof-of-work-stickers.mjs --live   # create products (needs Printify creds)
//
// Each design becomes one Kiss-Cut Sticker product. (POD reality: a true physical
// "5-pack" needs manual bundling in Etsy; here we list the 5 designs individually.)
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { printifyReady, uploadImageBase64, createProduct, publish } from './lib/printify.js';

const LIVE = process.argv.includes('--live');
const ART = '/Users/hk23neo/vice-collection/assets/print/stickers';

const DESIGNS = [
  { sku: 'pow-stk-invader-coral',  file: 'invader-coral.png',   title: 'PROOF OF WORK — Invader Sticker (Coral)' },
  { sku: 'pow-stk-starburst',      file: 'starburst-black.png', title: 'PROOF OF WORK — Starburst Sticker (Black)' },
  { sku: 'pow-stk-invader-blue',   file: 'invader-blue.png',    title: 'PROOF OF WORK — Invader Sticker (Blue)' },
  { sku: 'pow-stk-invader-bone',   file: 'invader-bone.png',    title: 'PROOF OF WORK — Invader Sticker (Bone)' },
  { sku: 'pow-stk-grid',           file: 'grid-bar.png',        title: 'PROOF OF WORK — Activity Grid Sticker' },
];

const DESC = 'PROOF OF WORK by HK23. Die-cut weatherproof vinyl sticker. ' +
  'Your work, made into an object. Part of the Season One capsule.';
const TAGS = ['proof of work', 'pixel art sticker', 'invader sticker', 'dev sticker',
  'coding sticker', 'laptop sticker', 'retro gaming', 'data art', 'hk23', 'vinyl sticker',
  'die cut sticker', 'tech sticker', 'minimal sticker'];
const MARKUP = 2.4; // sticker markup over Printify cost

async function main() {
  console.log(`\nPROOF OF WORK · sticker capsule → Printify  [${LIVE ? 'LIVE' : 'DRY-RUN'}]\n`);

  const missing = DESIGNS.filter((d) => !existsSync(join(ART, d.file)));
  if (missing.length) {
    console.error('✗ missing art (run vice-collection/assets/export-stickers.mjs first):');
    missing.forEach((d) => console.error('   - ' + d.file));
    process.exit(1);
  }
  console.log(`✓ ${DESIGNS.length} print-ready designs found in ${ART}`);

  if (!LIVE) {
    console.log('\nPlan:');
    DESIGNS.forEach((d) => console.log(`   • ${d.sku.padEnd(26)} ${d.title}`));
    console.log(`\n   blueprint: Kiss-Cut Sticker (id 1268, verify at runtime) · markup ×${MARKUP}`);
    console.log(`   tags: ${TAGS.length} · desc: ${DESC.length} chars`);
    console.log('\nDry-run only. Re-run with --live (+ Printify creds in config.local.json) to create.');
    return;
  }

  if (!printifyReady()) {
    console.error('\n✗ Printify not configured. Add printifyToken + printifyShopId to config.local.json.');
    process.exit(1);
  }

  for (const d of DESIGNS) {
    process.stdout.write(`→ ${d.sku} … `);
    try {
      const imageId = await uploadImageBase64(join(ART, d.file), d.file);
      const productId = await createProduct({
        kind: 'sticker', title: d.title, description: DESC, imageId, markup: MARKUP, tags: TAGS,
      });
      await publish(productId);
      console.log(`✓ product ${productId}`);
    } catch (e) {
      console.log(`✗ ${e.message}`);
    }
  }
  console.log('\nDone.');
}

main();
