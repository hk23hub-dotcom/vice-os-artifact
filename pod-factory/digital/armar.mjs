#!/usr/bin/env node
/**
 * ARMA LOS PAQUETES DIGITALES
 * Agrupa las ilustraciones por colección y arma un .zip por paquete,
 * más el índice que cada comprador recibe adentro.
 *
 *   node digital/armar.mjs          → informe, no escribe zips
 *   node digital/armar.mjs --zip    → arma los archivos
 */
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectionOf } from '../midjourney/collections.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const ZIP  = process.argv.includes('--zip');
const OUT  = join(HERE, 'paquetes');

const cat = JSON.parse(readFileSync(join(ROOT, 'midjourney/data/catalog.json'), 'utf8'));
const items = cat.items.filter(i => i.file && existsSync(i.file));

const mb = b => (b / 1024 / 1024).toFixed(1);
const lado = i => Math.min(i.w || 0, i.h || 0);

// dos calidades, dicho sin maquillaje: lo que da para imprimir y lo que da para pantalla
const PRINT = items.filter(i => lado(i) >= 2048);
const TODO  = items;

// collectionOf devuelve {slug, title, blurb}: agrupo por slug y guardo el título y la reseña
const porColeccion = {};
for (const i of items) {
  const c = collectionOf(i);
  const k = c.slug;
  (porColeccion[k] = porColeccion[k] || { title: c.title, blurb: c.blurb, items: [] }).items.push(i);
}

function indice(lista, titulo) {
  const l = lista.slice().sort((a, b) => a.sku.localeCompare(b.sku));
  return `${titulo}\nHK23 STUDIO\n\n${l.length} archivos\n\n` +
    l.map(i => `${i.sku}  ${i.w}x${i.h}  ${(i.seo?.title || i.style || '').slice(0, 60)}`).join('\n') +
    `\n\nUso: personal y comercial sobre obra derivada impresa o digital.\n` +
    `No se permite revender los archivos tal cual ni redistribuirlos.\n`;
}

function armar(nombre, lista, titulo) {
  const bytes = lista.reduce((n, i) => n + statSync(i.file).size, 0);
  const linea = `  ${nombre.padEnd(34)} ${String(lista.length).padStart(3)} piezas   ${mb(bytes).padStart(6)} MB`;
  if (!ZIP) return { linea, bytes, n: lista.length };

  mkdirSync(OUT, { recursive: true });
  const txt = join(OUT, `${nombre}-INDICE.txt`);
  writeFileSync(txt, indice(lista, titulo));
  const zip = join(OUT, `${nombre}.zip`);
  const args = ['-j', '-q', '-9', zip, txt, ...lista.map(i => i.file)];
  try {
    execFileSync('zip', args, { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 });
    const z = statSync(zip).size;
    return { linea: linea + `  →  ${mb(z)} MB comprimido`, bytes: z, n: lista.length };
  } catch (e) {
    return { linea: linea + `  ✗ ${e.message.slice(0, 60)}`, bytes: 0, n: lista.length };
  }
}

console.log(`\nPAQUETES DIGITALES${ZIP ? '' : '  (informe — no escribe nada)'}\n`);
console.log('PREMIUM · solo lo que da para imprimir (lado corto 2048+)');
console.log(armar('print-ready-completo', PRINT, 'PRINT-READY · catálogo completo').linea);
console.log('\nPOR COLECCIÓN · todas las piezas de cada mundo');
let tot = 0;
for (const [slug, c] of Object.entries(porColeccion).sort((a, b) => b[1].items.length - a[1].items.length)) {
  const r = armar(slug, c.items, c.title);
  console.log(r.linea); tot += r.bytes;
}
console.log('\nTODO · el catálogo entero');
const t = armar('catalogo-completo', TODO, 'CATÁLOGO COMPLETO');
console.log(t.linea);
console.log(`\n${ZIP ? 'escritos en' : 'se escribirían en'}: digital/paquetes/\n`);
