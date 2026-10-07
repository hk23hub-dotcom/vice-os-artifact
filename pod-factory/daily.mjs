// daily.mjs — el ciclo diario del POD FACTORY.
//   00. revisa la tienda (moneda, password)
//   0.  ingresa lo que haya en inbox/ y reconstruye el catálogo
//   1.  publica la ola del día, rotando entre colecciones
//   1b. deja a la venta solo las medidas que el arte soporta
//   1c. deja copy y tags al día en todo lo publicado
//   2.  arma la cola de venta (leads de LeadHunter)
//   3.  escribe el parte
//
//   node daily.mjs            → simulación: no publica nada
//   node daily.mjs --live     → publica de verdad
//   node daily.mjs --n 5      → tamaño de ola (default 3)
//
// Corre desatendido desde launchd. Nunca envía correos: la venta queda encolada para aprobación.
// SIEMPRE termina con código 0: el plist encadena un segundo intento con `||`, y un código
// distinto de cero relanzaría el ciclo completo.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireLock, loadJSON, today } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const LIVE = process.argv.includes('--live');
const N = (() => { const i = process.argv.indexOf('--n'); return i > -1 ? Number(process.argv[i + 1]) || 3 : 3; })();
const TODAY = today();
const pasos = [];

const run = (script, args) => new Promise((resolve) => {
  const file = join(HERE, script);
  if (!existsSync(file)) return resolve({ skipped: true, code: 0, out: `(falta ${script} — paso omitido)` });
  const p = spawn(process.execPath, [file, ...args], { cwd: dirname(file) });
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });
  p.on('error', (e) => resolve({ code: 1, out: `${out}\nno se pudo lanzar: ${e.message}`.trim() }));
  p.on('close', (code) => resolve({ code, out: out.trim() }));
});

async function paso(nombre, script, args) {
  const r = await run(script, args);
  pasos.push({ paso: nombre, ...r });
  console.log(`\n── ${nombre} ──\n${r.out || '(sin salida)'}`);
  if (r.code && r.code !== 2) console.log(`! ${nombre} terminó con código ${r.code}`);
  return r;
}

async function ciclo() {
  console.log(`\nPOD FACTORY · ciclo diario ${TODAY} ${LIVE ? '[LIVE]' : '[SIMULACIÓN]'}`);

  const pre = await paso('revisión de la tienda', 'preflight.mjs', []);
  const BLOQUEADO = pre.code === 2;
  if (BLOQUEADO) console.log('\n⛔ Publicación suspendida hoy: la tienda está abierta en una moneda distinta de USD.');

  await paso('entrada de colecciones', 'intake.mjs', LIVE ? ['--live'] : []);
  await paso('catálogo', 'midjourney/collection.mjs', []);
  await paso('ola de productos', 'midjourney/publish-wave.mjs', LIVE && !BLOQUEADO ? ['--n', String(N), '--live'] : ['--n', String(N)]);
  await paso('medidas', 'midjourney/fix-aspect.mjs', LIVE ? ['--live'] : []);
  await paso('copy y tags', 'sync-products.mjs', LIVE ? ['--live'] : []);
  await paso('cola de venta', 'sales/daily.mjs', []);
}

function parte() {
  const led = loadJSON(join(HERE, 'midjourney', 'data', 'mj-ledger.json'), {});
  const lib = loadJSON(join(HERE, 'library', 'library.json'), { items: {}, review: [] });
  const hoy = Object.entries(led).filter(([, v]) => v.published_at && new Date(v.published_at).toLocaleDateString('sv-SE') === TODAY && (v.url || v.external?.handle));
  const fuera = Object.entries(led).filter(([, v]) => ['blocked', 'nofit', 'gone'].includes(v.stage));
  const sinCurar = Object.values(lib.items || {}).filter((i) => i.status === 'uncurated').length;
  const enRevision = (lib.review || []).length;

  const atencion = [];
  const pre = pasos.find((p) => p.paso === 'revisión de la tienda');
  if (pre?.code === 2) atencion.push('La tienda está ABIERTA en moneda distinta de USD: no se publicó nada.');
  else if (/debe ser USD/.test(pre?.out || '')) atencion.push('La tienda NO está en dólares. Cambia la moneda a USD antes de quitar el password (Shopify → Settings → General → Store currency).');
  if (sinCurar) atencion.push(`${sinCurar} piezas nuevas esperan curaduría: no se publican hasta pasar por ahí.`);
  if (enRevision) atencion.push(`${enRevision} imágenes parecidas a otras esperan que alguien decida si son la misma.`);
  if (fuera.length) atencion.push(`Fuera de juego: ${fuera.map(([k, v]) => `${k} (${v.stage})`).join(', ')}.`);
  for (const p of pasos) if (p.code && p.code !== 2) atencion.push(`El paso "${p.paso}" terminó con error (código ${p.code}).`);

  return `# POD FACTORY · ${TODAY}\n\n` +
    `Modo: ${LIVE ? 'live' : 'simulación'} · ola de ${N}\n\n` +
    `## Necesita tu atención\n${atencion.length ? atencion.map((a) => `- ${a}`).join('\n') : '- nada'}\n\n` +
    `## Publicado hoy\n${hoy.length ? hoy.map(([sku, v]) => `- ${sku} → ${v.url || v.external.handle}`).join('\n') : '- nada'}\n\n` +
    pasos.map((p) => `## ${p.paso}\n\`\`\`\n${(p.out || '').slice(0, 2500)}\n\`\`\``).join('\n\n') + '\n';
}

try {
  if (LIVE && !acquireLock('daily')) {
    console.log('Ya hay un ciclo diario corriendo. No se lanza otro.');
  } else {
    try { await ciclo(); } catch (e) { console.log(`\n✗ el ciclo se cortó: ${e.message}`); pasos.push({ paso: 'ciclo', code: 1, out: String(e.stack || e.message) }); }
    try {
      mkdirSync(join(HERE, 'reports'), { recursive: true });
      // la simulación jamás pisa el parte real del día
      const nombre = LIVE ? `${TODAY}.md` : `${TODAY}.sim.md`;
      writeFileSync(join(HERE, 'reports', nombre), parte());
      console.log(`\nParte del día: reports/${nombre}`);
    } catch (e) { console.log(`\n! no pude escribir el parte: ${e.message}`); }
    if (!LIVE) console.log('Simulación. Corre con --live para publicar de verdad.');
  }
} catch (e) {
  console.log(`✗ ${e.message}`);
}
process.exitCode = 0;
