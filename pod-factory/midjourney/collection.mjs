// collection.mjs — construye el catálogo publicable de la colección MidJourney.
//
//   node collection.mjs            → escribe data/catalog.json
//   node collection.mjs --json     → además imprime el JSON completo
//
// Cruza tres fuentes reales (cero red, cero dependencias):
//   1. midjourney-manifest.json  → ids[] en orden; sku = mjx-{index+1}  (misma regla que vice-seller/lib/sources.js)
//   2. captions.json             → curaduría por visión, keyed por sku. Solo keep:true entra.
//   3. ledger.json               → SEO ya generado, keyed por el id del manifiesto (NO por sku).
//   + dimensiones reales del jpg local (cabecera JPEG, con `sips` de respaldo).
import { readFileSync, writeFileSync, existsSync, openSync, readSync, closeSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fingerprint, distance, SAME_IMAGE } from '../fingerprint.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = '/Users/hk23neo/vice-os-artifact/vice-seller/data';
const OUT = join(HERE, 'data', 'catalog.json');

// Lado corto mínimo para imprimir un póster grande sin que se vea blando.
export const MIN_PRINTABLE = 1800;

// ─── dimensiones ────────────────────────────────────────────────────────────
// Lee los marcadores SOFn de la cabecera JPEG. Sin dependencias, sin proceso hijo.
function jpegSize(file) {
  const fd = openSync(file, 'r');
  try {
    const buf = Buffer.alloc(Math.min(1 << 20, 1 << 20));
    const n = readSync(fd, buf, 0, buf.length, 0);
    if (n < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
    let o = 2;
    while (o + 9 < n) {
      if (buf[o] !== 0xff) { o++; continue; }
      const m = buf[o + 1];
      if (m === 0xff) { o++; continue; }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { o += 2; continue; }
      if (m === 0xd9 || m === 0xda) break; // fin / inicio de scan
      const len = buf.readUInt16BE(o + 2);
      // SOF0..SOF15 salvo DHT(C4), JPG(C8) y DAC(CC)
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { h: buf.readUInt16BE(o + 5), w: buf.readUInt16BE(o + 7) };
      }
      if (len < 2) break;
      o += 2 + len;
    }
    return null;
  } finally { closeSync(fd); }
}

function sipsSize(file) {
  try {
    const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], { encoding: 'utf8' });
    const w = +(/pixelWidth:\s*(\d+)/.exec(out) || [])[1];
    const h = +(/pixelHeight:\s*(\d+)/.exec(out) || [])[1];
    return w && h ? { w, h } : null;
  } catch { return null; }
}

const sizeOf = (file) => jpegSize(file) || sipsSize(file);

// ─── forma ──────────────────────────────────────────────────────────────────
export function orientationOf(w, h) {
  const r = w / h;
  if (r > 1.05) return 'horizontal';
  if (r < 0.95) return 'vertical';
  return 'square';
}

// ─── ranking ────────────────────────────────────────────────────────────────
// Prioriza resolución (lo que manda para imprimir) y luego riqueza de metadata.
export function scoreOf(it) {
  const short = Math.min(it.w, it.h);
  let s = short / 100;                                   // 1024 → 10.2 · 4096 → 41
  if (it.minPrintable) s += 15;                          // salto: habilita póster
  s += Math.min(it.keywords.length, 8) * 1.5;            // hasta 12
  if (it.seo) s += 6;                                    // SEO ya escrito
  if (it.subject && it.style && it.theme && it.palette) s += 4;
  return Math.round(s * 100) / 100;
}

// ─── build ──────────────────────────────────────────────────────────────────
export function buildCatalog() {
  const man = JSON.parse(readFileSync(join(SRC, 'midjourney-manifest.json'), 'utf8'));
  const caps = JSON.parse(readFileSync(join(SRC, 'captions.json'), 'utf8'));
  const led = JSON.parse(readFileSync(join(SRC, 'ledger.json'), 'utf8'));

  const items = [];
  const skipped = { noKeep: 0, noCaption: 0, noFile: 0, noSize: 0 };
  const LIB0 = join(HERE, '..', 'library', 'library.json');
  const upgrades = existsSync(LIB0) ? (JSON.parse(readFileSync(LIB0, 'utf8')).upgrades || {}) : {};

  man.ids.forEach((id, i) => {
    const sku = `mjx-${String(i + 1).padStart(4, '0')}`;
    const c = caps[sku];
    if (!c) { skipped.noCaption++; return; }
    if (!c.keep) { skipped.noKeep++; return; }

    // si el intake trajo el original en mejor resolución, se imprime desde ese archivo
    const up = upgrades[sku];
    const file = up && existsSync(up.file) ? up.file : join(SRC, 'img', `${sku}.jpg`);
    if (!existsSync(file)) { skipped.noFile++; return; }
    const dim = up && existsSync(up.file) ? { w: up.w, h: up.h } : sizeOf(file);
    if (!dim) { skipped.noSize++; return; }

    const seo = led[id]?.seo || null;
    const it = {
      sku,
      mjId: id,
      file,
      w: dim.w,
      h: dim.h,
      orientation: orientationOf(dim.w, dim.h),
      minPrintable: Math.min(dim.w, dim.h) >= MIN_PRINTABLE,
      subject: c.subject || null,
      style: c.style || null,
      theme: c.theme || null,
      palette: c.palette || null,
      keywords: Array.isArray(c.keywords) ? c.keywords : [],
      seo,
    };
    it.rank = scoreOf(it);
    items.push(it);
  });

  // Biblioteca: todo lo que entró por pod-factory/intake.mjs (archivos de Drive, carpetas,
  // colecciones nuevas) y ya pasó curaduría. Misma forma que un ítem del manifiesto.
  const LIB = join(HERE, '..', 'library', 'library.json');
  const LIBCAP = join(HERE, '..', 'library', 'captions.json');
  skipped.libUncurated = 0;
  if (existsSync(LIB)) {
    const lib = JSON.parse(readFileSync(LIB, 'utf8'));
    const lcap = existsSync(LIBCAP) ? JSON.parse(readFileSync(LIBCAP, 'utf8')) : {};
    for (const e of Object.values(lib.items || {})) {
      const c = lcap[e.id];
      if (!c) { skipped.libUncurated++; continue; }
      if (!c.keep) { skipped.noKeep++; continue; }
      // misma regla que el manifiesto: si llegó el original más grande, se imprime desde ahí
      const lup = (lib.upgrades || {})[e.id];
      const src = lup && existsSync(lup.file) ? lup : e;
      if (!existsSync(src.file)) { skipped.noFile++; continue; }
      const it = {
        sku: e.id, mjId: null, file: src.file, w: src.w, h: src.h,
        orientation: orientationOf(src.w, src.h),
        minPrintable: Math.min(src.w, src.h) >= MIN_PRINTABLE,
        subject: c.subject || null, style: c.style || null, theme: c.theme || null,
        palette: c.palette || null, keywords: Array.isArray(c.keywords) ? c.keywords : [],
        seo: null, source: e.source || 'library',
      };
      it.rank = scoreOf(it);
      items.push(it);
    }
  }

  // Una sola pieza por imagen. El catálogo curado traía la misma imagen repetida con nombres
  // distintos (upscales y variaciones): se agrupan y sobrevive una. Gana la que ya está
  // publicada; si ninguna lo está, la de mejor ranking.
  const FPC = join(HERE, 'data', 'fingerprints.json');
  const fpc = existsSync(FPC) ? JSON.parse(readFileSync(FPC, 'utf8')) : {};
  for (const it of items) if (!fpc[it.sku]) { const f = fingerprint(it.file); if (f) fpc[it.sku] = f; }
  mkdirSync(join(HERE, 'data'), { recursive: true });
  writeFileSync(FPC, JSON.stringify(fpc) + '\n');
  const LEDG = join(HERE, 'data', 'mj-ledger.json');
  const pub = existsSync(LEDG) ? JSON.parse(readFileSync(LEDG, 'utf8')) : {};
  const orden = [...items].sort((a, b) => (pub[b.sku]?.product_id ? 1 : 0) - (pub[a.sku]?.product_id ? 1 : 0) || b.rank - a.rank || a.sku.localeCompare(b.sku));
  const vivos = [];
  const duplicates = [];
  for (const it of orden) {
    const f = fpc[it.sku];
    const igual = f ? vivos.find((v) => fpc[v.sku] && distance(f, fpc[v.sku]) <= SAME_IMAGE) : null;
    if (igual) duplicates.push({ sku: it.sku, subject: it.subject, sameAs: igual.sku }); else vivos.push(it);
  }
  skipped.duplicates = duplicates.length;
  items.length = 0; items.push(...vivos);

  // ranking: mayor score primero; empate → sku (orden estable y reproducible)
  items.sort((a, b) => b.rank - a.rank || a.sku.localeCompare(b.sku));
  items.forEach((it, i) => { it.position = i + 1; });

  const by = (f) => items.reduce((a, it) => ((a[f(it)] = (a[f(it)] || 0) + 1), a), {});
  return {
    generated: new Date().toISOString(),
    source: join(SRC, 'midjourney-manifest.json'),
    minPrintable: MIN_PRINTABLE,
    counts: {
      manifest: man.ids.length,
      publishable: items.length,
      withSeo: items.filter((i) => i.seo).length,
      printableLarge: items.filter((i) => i.minPrintable).length,
      byOrientation: by((i) => i.orientation),
      byResolution: by((i) => `${i.w}x${i.h}`),
      skipped,
    },
    duplicates,
    items,
  };
}

// ─── cli ────────────────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const cat = buildCatalog();
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(cat, null, 2) + '\n');
  const c = cat.counts;
  console.log(`\nPOD FACTORY · colección MidJourney`);
  console.log(`  manifiesto ........ ${c.manifest}`);
  console.log(`  publicables ....... ${c.publishable} (keep:true + archivo local + dimensiones)`);
  console.log(`  con SEO listo ..... ${c.withSeo}`);
  console.log(`  póster grande ..... ${c.printableLarge} (lado corto ≥ ${MIN_PRINTABLE}px) · resto va a sticker`);
  console.log(`  orientación ....... ${Object.entries(c.byOrientation).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  console.log(`  resoluciones ...... ${Object.entries(c.byResolution).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(' · ')}`);
  console.log(`  descartados ....... ${Object.entries(c.skipped).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  console.log(`  top 5 ............. ${cat.items.slice(0, 5).map((i) => `${i.sku}(${i.rank})`).join(' ')}`);
  console.log(`\n→ ${OUT}`);
  if (process.argv.includes('--json')) console.log(JSON.stringify(cat, null, 2));
}
