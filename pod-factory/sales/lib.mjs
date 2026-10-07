// lib.mjs — utilidades compartidas del AGENTE VENDEDOR (POD FACTORY).
// Node ESM puro. Cero dependencias npm.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const POD = path.resolve(HERE, '..');

export const PATHS = {
  inbox:     path.join(HERE, 'leads-inbox'),
  data:      path.join(HERE, 'data'),
  out:       path.join(HERE, 'out'),
  leads:     path.join(HERE, 'data', 'leads.json'),
  printify:  path.join(POD, 'data', 'printify-ledger.json'),
  mjLedger:  path.join(POD, 'midjourney', 'data', 'mj-ledger.json'),
  captions:  path.resolve(POD, '..', 'vice-seller', 'data', 'captions.json'),
};

export const ESTADOS = ['nuevo', 'encolado', 'contactado', 'respondió', 'descartado'];

/* ---------------------------------------------------------- texto */

export function deaccent(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function norm(s) {
  return deaccent(s).toLowerCase().replace(/\s+/g, ' ').trim();
}

export function slug(s) {
  return norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const STOP = new Set(('de del la el los las y o en para con por un una al que su sus es lo a the of and for with to in on at a an is are your our '
  + 'sa spa ltda limitada srl inc llc co com cl').split(' '));

export function tokens(s) {
  return norm(s).split(/[^a-z0-9]+/).filter(t => t.length > 2 && !STOP.has(t));
}

export function words(s) {
  return String(s ?? '').trim().split(/\s+/).filter(Boolean).length;
}

const MENORES = new Set(['de', 'del', 'la', 'el', 'y', 'con', 'para', 'of', 'the', 'and', 'for', 'to']);

export function titleCase(s) {
  return String(s ?? '').split(/[\s-]+/).filter(Boolean)
    .map((w, i) => (i > 0 && MENORES.has(w.toLowerCase())) ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

// Nombre presentable a partir del handle: corta el serial y el ruido de tokens.
// No inventa nada, solo deja de mostrar lo que no le dice nada a un comprador.
export function nombreDesdeHandle(handle, sku) {
  const base = String(handle || sku || '').replace(/-/g, ' ').trim();
  const esNumero = w => /^\d+([.,]\d+)?[km]?$/i.test(w);
  const parts = [];
  for (const w of base.split(/\s+/)) {
    const lw = w.toLowerCase();
    if (lw === 'serial' || lw === 'tokens') break;
    if (esNumero(lw)) {
      // Un número tras una palabra es parte del nombre ("edicion 003").
      // Un número tras otro número ya es ruido de serie: se corta ahí.
      const prev = parts[parts.length - 1];
      if (!prev || esNumero(prev)) break;
    }
    parts.push(w);
  }
  return titleCase((parts.length ? parts : base.split(/\s+/)).join(' '));
}


/* ---------------------------------------------------------- fs */

export function readJSON(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

export function writeJSON(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

export function today(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return today(d);
}

/* ---------------------------------------------------------- CSV */

// Parser CSV propio. Maneja: comillas dobles, comas y saltos de línea dentro de
// campos entrecomillados, "" como comilla escapada, CRLF, BOM, y ; como separador.
export function parseCSV(text) {
  let src = String(text).replace(/^﻿/, '');
  if (!src.trim()) return [];

  const delim = detectDelimiter(src);
  const rows = [];
  let row = [], field = '', inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === delim) { row.push(field); field = ''; continue; }
    if (c === '\r') { if (src[i + 1] === '\n') i++; rows.push([...row, field]); row = []; field = ''; continue; }
    if (c === '\n') { rows.push([...row, field]); row = []; field = ''; continue; }
    field += c;
  }
  if (field.length || row.length) rows.push([...row, field]);

  const clean = rows.filter(r => r.some(c => String(c).trim() !== ''));
  if (clean.length < 2) return [];

  const headers = clean[0].map(h => String(h).trim());
  return clean.slice(1).map(r => {
    const o = {};
    headers.forEach((h, i) => { o[h] = (r[i] ?? '').trim(); });
    return o;
  });
}

function detectDelimiter(src) {
  const line = src.split(/\r?\n/, 1)[0] || '';
  let out = 0, semi = 0, q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') q = !q;
    else if (!q && c === ',') out++;
    else if (!q && c === ';') semi++;
  }
  return semi > out ? ';' : ',';
}

/* ---------------------------------------------------------- productos */

const KIND_ES = { sticker: 'sticker', poster: 'lámina', print: 'lámina', tee: 'polera', mug: 'taza' };
const KIND_EN = { sticker: 'sticker', poster: 'print', print: 'print', tee: 'tee', mug: 'mug' };
export const kindLabel = (k, lang) => (lang === 'en' ? KIND_EN[k] : KIND_ES[k]) || k || (lang === 'en' ? 'print' : 'lámina');

// Carga los productos publicados desde los ledgers reales.
// Tolera que mj-ledger.json todavía no exista. NUNCA inventa URLs.
export function loadProducts() {
  const captions = readJSON(PATHS.captions, {}) || {};
  const out = [];
  const notes = [];

  const printify = readJSON(PATHS.printify, null);
  if (printify) {
    for (const [sku, rec] of Object.entries(printify)) out.push(toProduct(sku, rec, captions, 'printify-ledger'));
  } else {
    notes.push(`No se pudo leer ${PATHS.printify}`);
  }

  const mj = readJSON(PATHS.mjLedger, null);
  if (mj) {
    const entries = Array.isArray(mj) ? mj.map(r => [r.sku || r.id || r.mjx, r]) : Object.entries(mj);
    for (const [sku, rec] of entries) { if (sku && rec) out.push(toProduct(sku, rec, captions, 'mj-ledger')); }
  } else {
    notes.push(`mj-ledger.json todavía no existe (${PATHS.mjLedger}) — se trabaja solo con printify-ledger.`);
  }

  const seen = new Set();
  const products = out.filter(p => { if (seen.has(p.sku)) return false; seen.add(p.sku); return true; });
  const sinURL = products.filter(p => !p.url).map(p => p.sku);
  if (sinURL.length) notes.push(`${sinURL.length} producto(s) sin URL publicada: ${sinURL.join(', ')} — no se ofrecen.`);

  return { products, notes };
}

function toProduct(sku, rec, captions, source) {
  const url = pickURL(rec);
  const mjId = findMjId(sku, rec);
  const meta = mjId && captions[mjId] && captions[mjId].keep ? captions[mjId] : null;
  const handle = url ? url.split('/products/')[1] || '' : '';
  const derivedName = nombreDesdeHandle(handle, sku);

  // Los ledgers traen un title SEO largo ("... | ..."); se usa solo el primer tramo.
  const tituloLedger = String(rec.title || '').split('|')[0].trim();

  const kw = new Set();
  if (meta) for (const k of meta.keywords || []) kw.add(norm(k));
  for (const t of tokens(handle)) kw.add(t);
  for (const t of tokens(sku)) kw.add(t);
  for (const t of tokens(rec.title || '')) kw.add(t);

  return {
    sku,
    source,
    url: url || null,
    url_missing: !url,
    kind: normalizeKind(rec.kind) || guessKind(`${sku} ${handle} ${rec.title || ''}`),
    product_id: rec.product_id || null,
    price_usd: Array.isArray(rec.price_usd) ? rec.price_usd : null,
    meta_source: meta ? `captions.json:${mjId}` : 'derivado del handle/sku',
    subject: meta?.subject || tituloLedger || derivedName,
    style: meta?.style || '',
    theme: meta?.theme || '',
    palette: meta?.palette || '',
    keywords: [...kw],
  };
}

function pickURL(rec) {
  const cands = [rec?.external?.handle, rec?.url, rec?.shopify_url, rec?.handle, rec?.external?.url];
  for (const c of cands) if (typeof c === 'string' && /^https?:\/\//.test(c)) return c;
  return null;
}

function findMjId(sku, rec) {
  for (const v of [rec?.mjx, rec?.mj_id, rec?.source_id, rec?.image_id, sku]) {
    const m = /mjx-\d{3,4}/.exec(String(v ?? ''));
    if (m) return m[0];
  }
  return null;
}

// Los ledgers usan variantes (posterV, posterH, stickerDie...). Se reducen al formato.
function normalizeKind(k) {
  const t = norm(k);
  if (!t) return '';
  if (/^poster/.test(t) || /^print/.test(t) || /^canvas/.test(t)) return 'poster';
  if (/^sticker/.test(t)) return 'sticker';
  if (/^(tee|shirt|tshirt)/.test(t)) return 'tee';
  if (/^mug/.test(t)) return 'mug';
  return t;
}

function guessKind(s) {
  const t = norm(s);
  if (/sticker|calcoman/.test(t)) return 'sticker';
  if (/poster|print|lamina|canvas/.test(t)) return 'poster';
  if (/tee|shirt|polera/.test(t)) return 'tee';
  if (/mug|taza/.test(t)) return 'mug';
  return 'producto';
}

/* ---------------------------------------------------------- idioma */

const ES_COUNTRIES = new Set(['cl','chile','ar','argentina','mx','mexico','méxico','pe','peru','perú','co','colombia',
  'es','espana','españa','spain','uy','uruguay','bo','bolivia','ec','ecuador','py','paraguay','cr','costa rica',
  'gt','guatemala','pa','panama','panamá','do','republica dominicana','ve','venezuela','sv','hn','ni','pr']);

export function langFor(lead) {
  const c = norm(lead.pais);
  if (!c) return 'es'; // HK23 es chilena: sin dato, se asume español y se marca para revisión.
  return ES_COUNTRIES.has(c) ? 'es' : 'en';
}
