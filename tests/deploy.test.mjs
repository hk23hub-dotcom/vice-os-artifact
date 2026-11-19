// Deploy: nada de lo que el sitio sirve puede apuntar a un archivo que .vercelignore deja afuera.
// Si una página nueva usa algo ignorado, esta prueba falla y te dice qué línea de .vercelignore sacar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, posix } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LINEAS = readFileSync(join(ROOT, '.vercelignore'), 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

// Formato .gitignore, lo que usa este repo: "/" al inicio = desde la raíz, "/" al final = carpeta,
// "*" dentro de un nombre, "**/" a cualquier profundidad. Sin "/" al inicio ni en el medio, vale en cualquier carpeta.
function aRegex(linea) {
  let p = linea; const carpeta = p.endsWith('/'); if (carpeta) p = p.slice(0, -1);
  const anclado = p.includes('/'); p = p.replace(/^\//, '');
  const cuerpo = p.split(/(\*\*\/|\*|\?)/).map(t => t === '**/' ? '(?:.*/)?' : t === '*' ? '[^/]*' : t === '?' ? '[^/]'
    : t.replace(/[.+^${}()|[\]\\]/g, '\\$&')).join('');
  return new RegExp((anclado ? '^' : '(?:^|/)') + cuerpo + (carpeta ? '/' : '(?:/|$)'));
}
const REGLAS = LINEAS.map(aRegex);
const ignorado = rel => REGLAS.some(r => r.test(rel));

function archivos(dir = ROOT, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules' || e.name === '.vercel' || e.name === '.claude' || e.name === 'vice-os') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) archivos(p, out); else out.push(posix.normalize(p.slice(ROOT.length + 1).split('\\').join('/')));
  }
  return out;
}
const TODOS = archivos();
const TEXTO = new Set(['.html', '.js', '.mjs', '.json', '.css', '.svg', '.webmanifest', '.xml', '.txt']);
const servidos = TODOS.filter(f => !ignorado(f));
const ignorados = TODOS.filter(ignorado);
// palabras sueltas de cada texto: "lib.js" no calza dentro de "_lib.js"
const palabras = t => { const s = new Set(); for (const [w] of t.matchAll(/[A-Za-z0-9_.-]+/g)) { s.add(w); s.add(w.replace(/\.+$/, '')); } return s; };
const textos = servidos.filter(f => TEXTO.has(extname(f).toLowerCase())).map(f => {
  const t = readFileSync(join(ROOT, f), 'utf8'); return [f, t, palabras(t)];
});

// Menciones revisadas a mano: son texto, no cargan nada.
const SOLO_TEXTO = [
  // libros de la biblioteca (markdown); mdToHtml solo pinta títulos, listas y negritas, sin <a> ni <img>
  [/^biblioteca\.json$/, /^(etsy-exports|hk23-brain|hk23-constitution)\//],
  // "corre el SQL de supabase-schema.sql en tu Supabase": texto en <b> y comentario de un bloque para copiar
  [/^universe-(os|template)\.html$/, /^supabase-schema\.sql$/],
  // comentario: "GENERADO desde … con centro/extraer.py"
  [/^api\/_centro\.js$/, /^centro\/extraer\.py$/],
];
const revisado = (en, archivo) => SOLO_TEXTO.some(([a, b]) => a.test(en) && b.test(archivo));
const GENERICOS = new Set(['README.md', 'index.html', 'config.json', 'package.json', '.gitignore', 'tokens.json']);
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('cada ruta anclada de .vercelignore existe (sin entradas muertas)', () => {
  const muertas = LINEAS.filter(l => l.startsWith('/') && !existsSync(join(ROOT, l.replace(/^\/|\/$/g, ''))));
  assert.deepEqual(muertas, []);
});

test('lo que el sitio necesita para arrancar sigue publicado', () => {
  for (const f of ['universe-os.html', 'index.html', 'vercel.json', 'package.json', 'biblioteca.json', 'mvb-eventos.json',
    'musica.json', 'design/hk23-tokens.css', 'leadhunter/index.html', 'api/run.js', 'api/_lib.js'])
    assert.equal(ignorado(f), false, f + ' quedó ignorado');
});

test('.claude/ y vice-os/ no se publican (settings locales y worktrees)', () => {
  for (const f of ['.claude/settings.local.json', '.claude/worktrees/x/vice-seller/a.png', 'vice-os/index.html'])
    assert.equal(ignorado(f), true, f + ' se publicaría');
});

test('ninguna página servida nombra un archivo ignorado', () => {
  const cruces = [];
  for (const x of ignorados) {
    const b = posix.basename(x);
    for (const [f, t, P] of textos) {
      const nombra = GENERICOS.has(b) ? t.includes(x) : P.has(b);
      if (nombra && !revisado(f, x)) cruces.push(f + ' → ' + x);
    }
  }
  assert.deepEqual(cruces, [], 'saca de .vercelignore lo que se usa');
});

test('ninguna página arma por código la ruta de algo ignorado', () => {
  // 'assets/house/' + n, `puttview-${i}.png`, 'golfteiner-render-' + n …
  const prefijos = new Set();
  for (const x of ignorados) {
    const partes = x.split('/');
    for (let i = 1; i < partes.length; i++) prefijos.add(partes.slice(0, i).join('/') + '/');
    const tallo = partes.at(-1).replace(/\.[^.]+$/, ''), sinNum = tallo.replace(/\d+$/, '');
    if (sinNum.length >= 3 && sinNum !== tallo) prefijos.add(sinNum);
  }
  const armados = [];
  for (const p of prefijos) {
    const re = new RegExp(esc(p) + '(?=["\'`+]|\\$\\{)');
    for (const [f, t] of textos) if (re.test(t)) armados.push(f + ' arma ' + p);
  }
  assert.deepEqual(armados, []);
});
