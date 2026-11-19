// ═══ PLANTILLA — el chequeo de universe-template.html ═════════════════════════════════════════
//   node scripts/plantilla-check.mjs                    revisa universe-template.html contra universe-os.html
//   node scripts/plantilla-check.mjs PLANTILLA UNIVERSO otras rutas
// Revisa, y sale con código 1 si algo falla:
//   1. cero apariciones de cada marcador de la lista negra (los cuenta, nunca los imprime)
//   2. cero claves hk23_ en el código de storage, y toda clave que el código usa empieza con uos
//   3. título UNIVERSE OS — PLANTILLA y la cinta PLANTILLA puestos
//   4. node --check de cada <script> de la plantilla y de cada script de scripts/
//   5. que la plantilla esté al día: regenerarla desde el universo da exactamente el mismo archivo
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { MARCADORES, generar, verificar, clavesDeStorage, scriptsInline } from './plantilla.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const argv = process.argv.slice(2);
const rutaPlantilla = path.resolve(argv[0] || path.join(RAIZ, 'universe-template.html'));
const rutaUniverso = path.resolve(argv[1] || path.join(RAIZ, 'universe-os.html'));

let fallas = 0;
const ok = (bien, txt) => { console.log((bien ? '✓ ' : '✗ ') + txt); if(!bien) fallas++; };

const html = readFileSync(rutaPlantilla, 'utf8');

/* 1 · lista negra */
let restos = 0;
for(const mk of MARCADORES){
  const n = (html.match(mk.re) || []).length; restos += n;
  if(n) console.log(`  marcador #${mk.n} (${mk.cat}): ${n}`);
}
ok(restos === 0, `lista negra: ${MARCADORES.length} marcadores, ${restos} aparición(es)`);

/* 2 · storage */
const claves = clavesDeStorage(html);
const hk = [...claves.keys()].filter(k => /hk23/i.test(k));
const ajenas = [...claves.keys()].filter(k => !/^uos/.test(k));
ok(hk.length === 0 && ajenas.length === 0 && !/hk23_/i.test(html),
  `storage: ${claves.size} claves en el código, ${hk.length} con hk23_, ${ajenas.length} sin el prefijo uos` +
  (ajenas.length ? ' → ' + ajenas.join(', ') : ''));

/* 3 · título y cinta (y lo que verificar() del generador mira además) */
const prob = verificar(html);
ok(prob.length === 0, 'verificación del generador' + (prob.length ? ': ' + prob.join(' | ') : ': título, cinta, marcadores, storage y compilación'));

/* 4 · node --check */
const tmp = mkdtempSync(path.join(os.tmpdir(), 'plantilla-check-'));
try{
  const scripts = scriptsInline(html);
  const malos = [];
  scripts.forEach((s, i) => {
    const f = path.join(tmp, `script-${String(i + 1).padStart(2, '0')}.js`);
    writeFileSync(f, s.codigo);
    const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
    if(r.status !== 0) malos.push(`script ${i + 1} (línea ${s.linea}): ${(r.stderr || '').split('\n').find(l => /Error/.test(l)) || 'no compila'}`);
  });
  ok(malos.length === 0, `node --check: ${scripts.length} <script> de la plantilla, ${malos.length} con error` + (malos.length ? ' → ' + malos.join(' | ') : ''));
  const propios = readdirSync(AQUI).filter(f => /\.(mjs|cjs|js)$/.test(f));
  const malosP = propios.filter(f => spawnSync(process.execPath, ['--check', path.join(AQUI, f)]).status !== 0);
  ok(malosP.length === 0, `node --check: ${propios.length} script(s) en scripts/ (${propios.join(', ')}), ${malosP.length} con error` + (malosP.length ? ' → ' + malosP.join(', ') : ''));
} finally { rmSync(tmp, { recursive: true, force: true }); }

/* 5 · al día */
try{
  const nueva = generar(readFileSync(rutaUniverso, 'utf8')).html;
  ok(nueva === html, nueva === html ? 'al día: regenerarla desde el universo da el mismo archivo'
    : 'al día: el universo cambió desde que se generó la plantilla — corre  node scripts/plantilla.mjs');
}catch(e){ ok(false, 'al día: el generador no pudo correr — ' + e.message); }

console.log(fallas ? `✗ PLANTILLA: ${fallas} chequeo(s) fallaron` : '✓ PLANTILLA LIMPIA');
process.exitCode = fallas ? 1 : 0;
