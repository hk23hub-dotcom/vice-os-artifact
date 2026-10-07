// intake.mjs — la puerta de entrada de TODAS las colecciones de ilustraciones.
// Tira en pod-factory/inbox/ cualquier .zip o carpeta con imágenes (sesiones de MidJourney,
// dibujos escaneados, exports de Procreate) y esto:
//   1. descomprime los zip (a una carpeta temporal; solo cuenta si terminó bien)
//   2. descarta duplicados exactos (hash del archivo)
//   3. compara la huella visual contra todo lo conocido:
//        ≤ 3  → misma imagen: se descarta, o reemplaza el arte si viene en mejor resolución
//        3–8  → parecida: NO se decide solo, queda en la lista de revisión
//        > 8  → pieza nueva
//   4. descarta lo que no da para imprimir y convierte a PNG lo que Printify no acepta
//   5. copia lo aceptado a library/ y lo deja esperando curaduría
// Es idempotente y tolera archivos malos: uno roto no bota al resto.
//   node intake.mjs           → informe, sin tocar nada
//   node intake.mjs --live    → ingresa
import { readFileSync, existsSync, mkdirSync, readdirSync, lstatSync, copyFileSync, rmSync, renameSync, statfsSync } from 'node:fs';
import { join, dirname, extname, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fingerprint, nearest, SAME_IMAGE, SAME_STRICT } from './fingerprint.mjs';
import { loadJSON, saveJSON } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const LIVE = process.argv.includes('--live');
const INBOX = join(HERE, 'inbox');
const LIBDIR = join(HERE, 'library');
const LIBFILE = join(LIBDIR, 'library.json');
const EXISTING = '/Users/hk23neo/vice-os-artifact/vice-seller/data/img';
const MIN_SIDE = 1000;                       // bajo esto no da ni para sticker decente
const RECIENTE_MS = 120_000;                 // un zip tocado hace menos de 2 min puede estar copiándose
const IMG = new Set(['.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff', '.heic', '.bmp']);
const DIRECTO = new Set(['.png', '.jpg', '.jpeg']);   // lo que Printify acepta tal cual

mkdirSync(INBOX, { recursive: true });
mkdirSync(join(LIBDIR, 'img'), { recursive: true });
const lib = loadJSON(LIBFILE, { next: 1, items: {}, hashes: {}, fingerprints: {}, upgrades: {}, review: [], rejected: [] });
for (const k of ['items', 'hashes', 'fingerprints', 'upgrades']) lib[k] ||= {};
lib.review ||= []; lib.rejected ||= [];
const guardar = () => { if (LIVE) saveJSON(LIBFILE, lib); };

const avisos = [];
const ignorados = {};

function walk(dir, out = []) {
  let nombres = [];
  try { nombres = readdirSync(dir); } catch (e) { avisos.push(`no pude leer ${relative(HERE, dir)}: ${e.code || e.message}`); return out; }
  for (const n of nombres) {
    if (n.startsWith('.') || n === '__MACOSX' || n.endsWith('.partial')) continue;
    const p = join(dir, n);
    let st;
    try { st = lstatSync(p); } catch { continue; }
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) walk(p, out);
    else if (st.isFile()) out.push(p);
  }
  return out;
}

const sha1 = (file) => createHash('sha1').update(readFileSync(file)).digest('hex');

function dims(file) {
  try {
    const o = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const w = Number(o.match(/pixelWidth:\s*(\d+)/)?.[1]), h = Number(o.match(/pixelHeight:\s*(\d+)/)?.[1]);
    return w && h ? { w, h } : null;
  } catch { return null; }
}

const libreGB = () => { try { const s = statfsSync(HERE); return (s.bavail * s.bsize) / 1e9; } catch { return Infinity; } };

// Copia a la biblioteca; convierte a PNG lo que Printify no acepta (webp, tiff, heic, bmp).
function guardarArte(src, destSinExt) {
  const ext = extname(src).toLowerCase();
  if (DIRECTO.has(ext)) { const d = `${destSinExt}${ext === '.jpeg' ? '.jpg' : ext}`; copyFileSync(src, d); return d; }
  const d = `${destSinExt}.png`;
  execFileSync('sips', ['-s', 'format', 'png', src, '--out', d], { stdio: 'ignore' });
  return d;
}

// ── 1) descomprimir ─────────────────────────────────────────────────────────
const extraidos = join(INBOX, '_extracted');
if (existsSync(extraidos)) for (const n of readdirSync(extraidos).filter((x) => x.endsWith('.partial'))) { try { rmSync(join(extraidos, n), { recursive: true, force: true }); } catch {} }

const zips = readdirSync(INBOX).filter((n) => n.toLowerCase().endsWith('.zip'));
for (const z of zips) {
  const src = join(INBOX, z);
  const dest = join(extraidos, basename(z, '.zip'));
  if (existsSync(dest)) continue;
  let st;
  try { st = lstatSync(src); } catch { continue; }
  if (Date.now() - st.mtimeMs < RECIENTE_MS) { avisos.push(`${z} todavía se está copiando — se toma en la próxima corrida`); continue; }
  if (libreGB() < (st.size * 2.5) / 1e9 + 1) { avisos.push(`${z}: no hay espacio en disco para descomprimirlo (${libreGB().toFixed(1)} GB libres)`); continue; }
  console.log(`descomprimiendo ${z}…`);
  if (!LIVE) continue;
  const tmp = `${dest}.partial`;
  try {
    mkdirSync(tmp, { recursive: true });
    execFileSync('unzip', ['-o', '-q', src, '-d', tmp], { stdio: 'ignore' });
    renameSync(tmp, dest);                     // solo cuenta como extraído si unzip terminó bien
  } catch {
    try { rmSync(tmp, { recursive: true, force: true }); } catch {}
    avisos.push(`${z}: no se pudo descomprimir (¿corrupto o incompleto?) — se reintenta en la próxima corrida`);
  }
}

// ── 2) índice de lo que ya existe (las 926 originales) — se hace una sola vez ──
if (!lib.seeded && existsSync(EXISTING)) {
  const base = readdirSync(EXISTING).filter((n) => DIRECTO.has(extname(n).toLowerCase()));
  console.log(`indexando las ${base.length} imágenes que ya estaban en el catálogo (solo la primera vez)…`);
  for (const n of base) {
    try {
      const f = join(EXISTING, n);
      const sku = n.replace(/\.[a-z]+$/i, '');
      lib.hashes[sha1(f)] = sku;
      const fp = fingerprint(f);
      if (fp) lib.fingerprints[sku] = fp;
    } catch {}
  }
  lib.seeded = true;
  guardar();
}

// ── 3) candidatos ───────────────────────────────────────────────────────────
const todos = walk(INBOX).filter((f) => !f.toLowerCase().endsWith('.zip'));
const files = todos.filter((f) => IMG.has(extname(f).toLowerCase()));
for (const f of todos) if (!IMG.has(extname(f).toLowerCase())) { const e = extname(f).toLowerCase() || '(sin extensión)'; ignorados[e] = (ignorados[e] || 0) + 1; }

const r = { nuevos: 0, mejoras: 0, duplicado: 0, misma: 0, revisar: 0, chico: 0, ilegible: 0 };
const known = Object.entries(lib.fingerprints);
const archivoDe = (id) => lib.upgrades[id]?.file || lib.items[id]?.file || join(EXISTING, `${id}.jpg`);
let desdeGuardado = 0;

for (const f of files) {
  try {
    const h = sha1(f);
    if (lib.hashes[h]) { r.duplicado++; continue; }
    const d = dims(f);
    if (!d) { r.ilegible++; continue; }
    if (Math.min(d.w, d.h) < MIN_SIDE) { r.chico++; if (LIVE) lib.hashes[h] = 'rechazado:chico'; continue; }

    const fp = fingerprint(f);
    const cerca = fp ? nearest(fp, known) : null;

    if (cerca && cerca.d <= SAME_STRICT) {
      // misma imagen con seguridad: ¿viene en mejor resolución?
      const prevFile = archivoDe(cerca.id);
      const prev = existsSync(prevFile) ? dims(prevFile) : null;
      if (prev && Math.min(d.w, d.h) > Math.min(prev.w, prev.h) * 1.2) {
        r.mejoras++;
        if (LIVE) {
          mkdirSync(join(LIBDIR, 'upgrades'), { recursive: true });
          const dest = guardarArte(f, join(LIBDIR, 'upgrades', cerca.id));
          lib.upgrades[cerca.id] = { file: dest, w: d.w, h: d.h, from: `${prev.w}x${prev.h}`, added: new Date().toISOString() };
          lib.hashes[h] = `mejora:${cerca.id}`;
        }
      } else {
        r.misma++;
        if (LIVE) { lib.hashes[h] = `rechazado:misma-imagen-que:${cerca.id}`; lib.rejected.push({ file: relative(INBOX, f), sameAs: cerca.id, d: Number(cerca.d.toFixed(2)) }); }
      }
      continue;
    }

    if (cerca && cerca.d <= SAME_IMAGE) {
      // parecida pero no segura: puede ser otra pieza con fondo parejo. No se ingresa ni se rechaza.
      r.revisar++;
      if (LIVE && !lib.review.some((x) => x.hash === h)) lib.review.push({ file: relative(INBOX, f), hash: h, looksLike: cerca.id, d: Number(cerca.d.toFixed(2)) });
      continue;
    }

    r.nuevos++;
    if (!LIVE) continue;
    const id = `lib-${String(lib.next++).padStart(5, '0')}`;
    const dest = guardarArte(f, join(LIBDIR, 'img', id));
    const partes = relative(INBOX, f).split('/');
    lib.items[id] = { id, file: dest, w: d.w, h: d.h, hash: h, source: partes[0] === '_extracted' ? (partes[1] || 'inbox') : partes[0], status: 'uncurated', added: new Date().toISOString() };
    lib.hashes[h] = id;
    if (fp) { lib.fingerprints[id] = fp; known.push([id, fp]); }
    if (++desdeGuardado >= 50) { guardar(); desdeGuardado = 0; }     // no perder el avance si algo se corta
  } catch (e) {
    r.ilegible++;
    avisos.push(`${relative(INBOX, f)}: ${String(e.message).slice(0, 80)}`);
  }
}
guardar();

const pendientes = Object.values(lib.items).filter((i) => i.status === 'uncurated').length;
console.log(`\nINTAKE ${LIVE ? '[LIVE]' : '[INFORME]'} · imágenes vistas ${files.length}`);
console.log(`  nuevas ${r.nuevos} · mejoras de resolución ${r.mejoras} · ya estaban ${r.duplicado + r.misma} · parecidas a revisar ${r.revisar} · muy chicas ${r.chico} · ilegibles ${r.ilegible}`);
console.log(`  biblioteca: ${Object.keys(lib.items).length} piezas · ESPERANDO CURADURÍA: ${pendientes} · en revisión: ${lib.review.length}`);
const ign = Object.entries(ignorados);
if (ign.length) console.log(`  archivos ignorados por formato: ${ign.map(([e, n]) => `${n} ${e}`).join(', ')}`);
for (const a of avisos.slice(0, 8)) console.log(`  ! ${a}`);
if (!todos.length && !zips.length) console.log('  inbox vacío: deja ahí los .zip o carpetas con tus ilustraciones.');
