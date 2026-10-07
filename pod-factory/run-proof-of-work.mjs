// run-proof-of-work.mjs — primer encargo del POD FACTORY.
// Genera, en modo borrador y sin tocar nada público:
//   • payload del universo (galaxia POD + planetas + listings + relaciones)
//   • specs de producto listas para Printify (stickers + posters)
//   • blogposts para hk23.posts
//   • notas espejo en el vault de Obsidian (VICE OS)
//   • ledger idempotente
// Uso: node run-proof-of-work.mjs   (todo local; nada se publica)
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const VAULT = '/Users/hk23neo/Library/Mobile Documents/iCloud~md~obsidian/Documents/VAULT/04 Content/POD';
const COLLECTION = 'vice-collection';
const STICKER_ART = '/Users/hk23neo/vice-collection/assets/print/stickers';
const POSTER_ART = '/Users/hk23neo/vice-collection/poster/out';

for (const d of [OUT, join(OUT, 'posts'), join(HERE, 'inbox'), join(HERE, 'pending'), join(HERE, 'rejected'), join(HERE, 'data')]) mkdirSync(d, { recursive: true });
mkdirSync(VAULT, { recursive: true });

// ---------- datos de la colección ----------
const EDITIONS = [
  { slug: 'proof-of-work-002', edition: '002', serial: '0GNZ1P1', tokens: '32M', sessions: 44, messages: 39680, activeDays: 23, streak: 3, file: 'a2-002-32M.png' },
  { slug: 'proof-of-work-003', edition: '003', serial: '1UQDHCL', tokens: '42.2M', sessions: 109, messages: 46987, activeDays: 92, streak: 18, file: 'a2-003-2026-09-10.png' },
];
const STICKERS = [
  { sku: 'pow-stk-invader-coral', file: 'invader-coral.png', title: 'PROOF OF WORK — Invader Sticker (Coral)' },
  { sku: 'pow-stk-starburst', file: 'starburst-black.png', title: 'PROOF OF WORK — Starburst Sticker (Black)' },
  { sku: 'pow-stk-invader-blue', file: 'invader-blue.png', title: 'PROOF OF WORK — Invader Sticker (Blue)' },
  { sku: 'pow-stk-invader-bone', file: 'invader-bone.png', title: 'PROOF OF WORK — Invader Sticker (Bone)' },
  { sku: 'pow-stk-grid', file: 'grid-bar.png', title: 'PROOF OF WORK — Activity Grid Sticker' },
];
const TAGS = ['proof of work', 'data art', 'generative art', 'pixel art', 'dev gift', 'coding art',
  'stats poster', 'minimal poster', 'hk23', 'activity grid', 'terminal aesthetic', 'tech decor', 'numbered edition'];

// ---------- 1. payload del universo ----------
const entities = [
  { slug: 'pod', name: 'POD', kind: 'galaxy', level: 1, state: 'live', color: '#FF5A36',
    summary: 'Print on demand: cada idea que se vuelve objeto. Aquí viven el concepto, el blueprint y el producto.' },
  { slug: 'proof-of-work', name: 'PROOF OF WORK', kind: 'pod', level: 2, parent_slug: 'pod', state: 'concept', color: '#FF5A36',
    summary: 'Season One. Tu trabajo convertido en objeto: las estadísticas de uso se vuelven el arte, y ninguna pieza se puede copiar porque nadie tiene tus números.' },
  ...EDITIONS.map((e) => ({
    slug: e.slug, name: `PROOF OF WORK · Edición ${e.edition}`, kind: 'pod', level: 3, parent_slug: 'proof-of-work',
    state: 'concept', color: '#2F6FD1',
    summary: `${e.tokens} tokens · ${e.sessions} sesiones · ${e.activeDays} días activos · racha ${e.streak}d. Serial ${e.serial}.`,
    meta: { serial: e.serial, edition: e.edition, edition_total: '100', stats: { tokens: e.tokens, sessions: e.sessions, messages: e.messages, activeDays: e.activeDays, longestStreak: e.streak }, art: join(POSTER_ART, e.file) },
  })),
];

const listings = [
  ...EDITIONS.map((e) => ({ entity_slug: e.slug, price: 45, currency: 'USD', status: 'draft', source: 'printify', note: 'Poster A2 numerado /100 — se activa cuando exista URL real' })),
  ...EDITIONS.map((e) => ({ entity_slug: e.slug, price: 19, currency: 'USD', status: 'future', source: 'blueprint', note: 'Blueprint: los datos, el motor generativo y el proceso de esta edición' })),
  { entity_slug: 'proof-of-work', price: 6, currency: 'USD', status: 'draft', source: 'printify', note: 'Sticker capsule — 5 diseños' },
  { entity_slug: 'proof-of-work', price: 29, currency: 'USD', status: 'future', source: 'blueprint', note: 'Guía: cómo convertir tus propios datos en una colección' },
];

// las relaciones encadenan la serie: cada edición apunta a la anterior
const relationships = [
  { from_slug: 'proof-of-work', to_slug: 'pod', type: 'belongs-to', strength: 1 },
  { from_slug: 'proof-of-work-002', to_slug: 'proof-of-work', type: 'pod-link', strength: 1 },
  { from_slug: 'proof-of-work-003', to_slug: 'proof-of-work', type: 'pod-link', strength: 1 },
  { from_slug: 'proof-of-work-003', to_slug: 'proof-of-work-002', type: 'continues', strength: 1 },
];

writeFileSync(join(OUT, 'universe-payload.json'), JSON.stringify({ schema: 'hk23', entities, listings, relationships }, null, 2) + '\n');

// ---------- 2. specs para Printify (borradores) ----------
const printify = {
  store: 'Hk23 STUDIO (Shopify clipvice-ai-store) · fallback Printify Pop-Up',
  status: 'draft',
  blocked_by: 'falta printifyToken + printifyShopId en vice-seller/config.local.json',
  products: [
    ...STICKERS.map((s) => ({
      kind: 'sticker', sku: s.sku, title: s.title, art: join(STICKER_ART, s.file), markup: 2.4, tags: TAGS.slice(0, 13),
      description: 'PROOF OF WORK by HK23. Vinilo die-cut resistente al agua. Tu trabajo, hecho objeto. Parte de la cápsula Season One.',
    })),
    ...EDITIONS.map((e) => ({
      kind: 'poster', sku: `pow-poster-${e.edition}`, title: `PROOF OF WORK — Edición ${e.edition} · ${e.tokens} tokens (Serial ${e.serial})`,
      art: join(POSTER_ART, e.file), markup: 1.8, tags: TAGS.slice(0, 13),
      description: `Poster generativo de la serie PROOF OF WORK. La grilla, la densidad y los picos naranjos salen de datos reales de actividad: ${e.tokens} tokens, ${e.sessions} sesiones, ${e.activeDays} días activos y una racha máxima de ${e.streak} días. Los mismos números generan siempre la misma imagen, y por eso el serial ${e.serial} identifica esta pieza. Edición ${e.edition} de 100.`,
    })),
  ],
};
writeFileSync(join(OUT, 'printify-drafts.json'), JSON.stringify(printify, null, 2) + '\n');

// ---------- 3. blogposts ----------
const posts = [];
posts.push({
  slug: 'proof-of-work-season-one',
  entity_slug: 'proof-of-work',
  title: 'PROOF OF WORK: convertir tu trabajo en un objeto',
  body: `Todos los días dejas un rastro de trabajo que nadie ve: sesiones, mensajes, rachas, madrugadas. PROOF OF WORK toma ese rastro y lo convierte en una pieza física.

La idea es simple. Tus estadísticas de uso alimentan un motor generativo que dibuja una grilla: la densidad viene de tus días activos, la profundidad del azul de tus sesiones y los picos naranjos de tu racha más larga. Nadie más tiene tus números, así que nadie más puede tener tu pieza. Es una huella digital que se puede colgar en la pared.

Season One son cuatro formatos que nacen de la misma alma: stickers, poster numerado, gorro y polera. El poster es el grial físico; el sticker es la puerta de entrada.

Cada edición que sale queda registrada como un planeta en el universo HK23, encadenada a la anterior. La colección se lee como una línea de tiempo: no compras una imagen bonita, compras el momento exacto en que tus números eran esos.`,
});
for (const e of EDITIONS) {
  posts.push({
    slug: `proof-of-work-edicion-${e.edition}`,
    entity_slug: e.slug,
    title: `Edición ${e.edition} — ${e.tokens} tokens`,
    body: `Esta pieza se generó con un snapshot real: ${e.tokens} tokens, ${e.sessions} sesiones, ${e.messages.toLocaleString('es-CL')} mensajes, ${e.activeDays} días activos y una racha máxima de ${e.streak} días.

El motor convierte esos números en arte de forma determinista. La cantidad de celdas llenas sale de los días activos, el azul profundo de las sesiones y los cuadrados naranjos de la racha. Como el proceso es una función pura de los datos, volver a ingresar estas cifras devuelve exactamente la misma imagen. Por eso el serial ${e.serial} funciona como certificado: identifica estos números y ningunos otros.

Edición ${e.edition} de 100. Impresa en A2 a 300 dpi.`,
  });
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
for (const p of posts) {
  p.html = `<article><h1>${esc(p.title)}</h1>\n` + p.body.split('\n\n').map((par) => `<p>${esc(par)}</p>`).join('\n') + '\n</article>';
  writeFileSync(join(OUT, 'posts', `${p.slug}.html`), p.html + '\n');
}
writeFileSync(join(OUT, 'posts.json'), JSON.stringify(posts.map(({ slug, entity_slug, title, html }) => ({ slug, entity_slug, title, html, status: 'draft' })), null, 2) + '\n');

// ---------- 4. notas espejo en Obsidian ----------
const today = new Date().toISOString().slice(0, 10);
const note = (name, front, body) => writeFileSync(join(VAULT, `${name}.md`), `---\n${front}\n---\n\n${body}\n`);
note('PROOF OF WORK', `tipo: coleccion\nestado: concepto\ncreado: ${today}\ntags: [pod, proof-of-work, hk23]`,
  `# PROOF OF WORK\n\n${posts[0].body}\n\n## Piezas\n${EDITIONS.map((e) => `- [[PROOF OF WORK ${e.edition}]] — ${e.tokens} tokens · serial ${e.serial}`).join('\n')}\n- 5 stickers (cápsula Season One)\n\n## Conecta con\n- [[POD]] — la galaxia donde vive\n- [[VICE SELLER]] — el motor que publica en Printify\n- [[ViceGolfer]] — mismo motor aplicado a estadísticas de golf (idea guardada)\n`);
for (const [i, e] of EDITIONS.entries()) {
  const prev = EDITIONS[i - 1];
  note(`PROOF OF WORK ${e.edition}`, `tipo: pieza\ncoleccion: PROOF OF WORK\nedicion: ${e.edition}/100\nserial: ${e.serial}\nestado: borrador\ncreado: ${today}\ntags: [pod, proof-of-work]`,
    `# Edición ${e.edition} — ${e.tokens} tokens\n\n${posts[i + 1].body}\n\n## Datos\n| dato | valor |\n|---|---|\n| tokens | ${e.tokens} |\n| sesiones | ${e.sessions} |\n| mensajes | ${e.messages.toLocaleString('es-CL')} |\n| días activos | ${e.activeDays} |\n| racha máxima | ${e.streak}d |\n| serial | ${e.serial} |\n\n## Conecta con\n- [[PROOF OF WORK]]\n${prev ? `- [[PROOF OF WORK ${prev.edition}]] — la edición anterior de la serie\n` : ''}`);
}
note('POD', `tipo: galaxia\nestado: activo\ncreado: ${today}\ntags: [pod, hk23]`,
  `# POD\n\nGalaxia del universo HK23 donde vive todo lo print-on-demand: la idea, el blueprint y el producto final. Cada pieza es un planeta y los planetas se encadenan entre sí.\n\n## Colecciones\n- [[PROOF OF WORK]]\n\n## Sistema\n- Fábrica: \`~/vice-os-artifact/pod-factory\`\n- Prompt del workflow: \`docs/pod-factory-workflow-prompt.md\`\n`);

// ---------- 5. ledger ----------
const LEDGER = join(HERE, 'data', 'ledger.json');
const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : {};
for (const e of entities.filter((x) => x.kind === 'pod')) {
  ledger[e.slug] = { ...(ledger[e.slug] || {}), slug: e.slug, updated: new Date().toISOString(),
    steps: { curated: true, produced: false, published_universe: false, written: true, qa: true, live: false },
    blocked_by: ['printify token', 'supabase service key'] };
}
writeFileSync(LEDGER, JSON.stringify(ledger, null, 2) + '\n');

// ---------- reporte ----------
console.log(`\nPOD FACTORY · ${today}`);
console.log(`Procesados: ${printify.products.length} piezas (${STICKERS.length} stickers + ${EDITIONS.length} posters) · Borradores: ${printify.products.length} · Rechazados: 0`);
console.log(`Planetas preparados: ${entities.map((e) => e.slug).join(', ')}`);
console.log(`Posts: ${posts.length} · Notas en el vault: ${EDITIONS.length + 2}`);
console.log('Bloqueado: Printify (falta token) y escritura al universo (falta llave de Supabase).');
