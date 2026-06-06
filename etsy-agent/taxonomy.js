// taxonomy.js — find the Etsy taxonomy_id for your product type.
// Run: npm run taxonomy → prints matching category ids. Put the right one in config.json.
import { loadConfig } from './lib.js';

const cfg = loadConfig();
const SEARCH = (process.argv[2] || 'print').toLowerCase();

const res = await fetch('https://api.etsy.com/v3/application/seller-taxonomy/nodes', {
  headers: { 'x-api-key': cfg.keystring },
});
if (!res.ok) {
  console.error('✗ Failed:', res.status, await res.text());
  console.error('  (This also fails while your key is still "Pending Personal Approval".)');
  process.exit(1);
}
const data = await res.json();

const hits = [];
function walk(node, trail) {
  const path = [...trail, node.name];
  if (node.name.toLowerCase().includes(SEARCH)) hits.push({ id: node.id, path: path.join(' > ') });
  (node.children || []).forEach((c) => walk(c, path));
}
(data.results || []).forEach((n) => walk(n, []));

console.log(`\nTaxonomy nodes matching "${SEARCH}":\n`);
hits.forEach((h) => console.log(`  ${String(h.id).padEnd(8)} ${h.path}`));
console.log(`\nPick the id that fits (e.g. Art & Collectibles > Prints > Digital Prints) and set "taxonomy_id" in config.json.\n`);
