import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, buildRequest, parseSSE, readSSE, toMarkdown, slug, run, rutaProhibida, credenciales } from '../gerente-general/herramientas/leadhunter.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(REPO, 'gerente-general');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const SKILLS = ['cazar-proyectos', 'cierres', 'crear-subagente', 'decision', 'gg', 'indicadores', 'look-and-fill-dms', 'proyectos', 'radar', 'redactar', 'reunion', 'seguimiento'];

/* ── frontmatter mínimo: suficiente para validar los campos del spec ── */
function frontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, 'falta frontmatter');
  const fm = m[1];
  const get = (k) => (fm.match(new RegExp('^' + k + ':\\s*(.*)$', 'm')) || [])[1];
  const desc = (fm.match(/description: >\n([\s\S]*?)(?=\n[a-z]+:|$)/) || [])[1] || '';
  return { raw: fm, name: get('name'), model: get('model'), color: get('color'), tools: get('tools'), desc, body: md.slice(m[0].length) };
}
const examples = (fm) => (fm.match(/<example>/g) || []).length;
/* la gramática `[ ] … | …` rompe el parser YAML de Cowork si aparece en una description */
const yamlSeguro = (desc, who) => { assert.ok(!(desc.includes('[') && desc.includes('|')), who + ': description con [ y | a la vez'); assert.ok(!desc.includes('**['), who + ': **[ en description'); };

test('plugin.json y marketplace.json son válidos y apuntan al plugin', () => {
  const j = JSON.parse(read('.claude-plugin/plugin.json'));
  assert.equal(j.name, 'gerente-general');
  assert.match(j.version, /^\d+\.\d+\.\d+$/);
  assert.ok(j.description.length > 40);
  const m = JSON.parse(readFileSync(join(REPO, '.claude-plugin', 'marketplace.json'), 'utf8'));
  assert.ok(m.plugins.some((p) => p.name === 'gerente-general' && p.source === './gerente-general'));
});

test('el agente delegable cumple el contrato y remite a la persona compartida', () => {
  const fm = frontmatter(read('agents/gerente-general-dms.md'));
  assert.equal(fm.name, 'gerente-general-dms');
  assert.ok(examples(fm.raw) >= 2, 'necesita ≥ 2 <example>');
  assert.ok(['inherit', 'opus', 'sonnet', 'haiku'].includes(fm.model));
  assert.ok(['blue', 'cyan', 'green', 'yellow', 'magenta', 'red'].includes(fm.color));
  assert.match(fm.tools, /^\["Read"/);
  yamlSeguro(fm.desc, 'agente');
  assert.match(fm.body, /\*\*Responsabilidad única:\*\*/);
  assert.match(fm.body, /\*\*Límites:\*\*/);
  assert.match(fm.body, /referencias\/persona\.md/);
  assert.match(fm.body, /No decides, no envías/);
  assert.doesNotMatch(fm.body, /desorden y destiempos/, 'el perfil personal no va en el repo');
});

test('agents/ solo carga el ejecutor; los borradores viven en propuestos/ y cumplen el spec', () => {
  assert.deepEqual(readdirSync(join(ROOT, 'agents')), ['gerente-general-dms.md']);
  const drafts = readdirSync(join(ROOT, 'propuestos')).filter((f) => f.endsWith('.md') && f !== 'README.md');
  assert.deepEqual(drafts.sort(), ['dms-comercial.md', 'dms-finanzas.md', 'dms-marketing.md', 'dms-obras.md', 'dms-personas.md']);
  for (const f of drafts) {
    const fm = frontmatter(read('propuestos/' + f));
    assert.equal(fm.name + '.md', f, f + ': name debe coincidir con el archivo');
    assert.ok(examples(fm.raw) >= 2, f + ': ≥ 2 <example>');
    assert.ok(['sonnet', 'haiku', 'opus'].includes(fm.model), f + ': modelo');
    assert.ok(fm.color, f + ': color');
    yamlSeguro(fm.desc, f);
    assert.match(fm.body, /\*\*Responsabilidad única:\*\*/, f);
    assert.match(fm.body, /\*\*Límites:\*\*/, f);
    assert.match(fm.body, /\*\*Salida:\*\*[\s\S]*memoria\//, f + ': la salida nombra una ruta en memoria/');
    assert.doesNotMatch(fm.tools, /"Bash"/, f + ': los borradores no necesitan Bash');
  }
});

test('cada skill: name = carpeta, disparadores en español e inglés, Paso 1 con persona y HQ, ≤ 130 líneas', () => {
  assert.deepEqual(readdirSync(join(ROOT, 'skills')).sort(), SKILLS);
  for (const s of SKILLS) {
    const md = read(`skills/${s}/SKILL.md`);
    const fm = frontmatter(md);
    assert.equal(fm.name, s, s + ': name');
    assert.match(fm.raw, /This skill should be used/, s + ': la description dice cuándo se usa');
    assert.match(fm.desc, /"[^"]*[áéíóñ][^"]*"/, s + ': frase de disparo en español');
    assert.match(fm.desc, /"(?=[^"]*\b(what|how|status|start|draft|write|find|help|push|follow|remind|note|meeting|board|close|objection|deal|project|weekly|new|any|explain|learn|read|create|build|spawn|wrap|metrics|month|prospects|tenders|reply|clients|proposal|site|overdue|regulation|market|subsidy|agent)\b)[a-z' ]+"/i, s + ': frase de disparo en inglés');
    yamlSeguro(fm.desc, s);
    assert.match(md, /## Paso 1 — Persona y HQ/, s + ': Paso 1');
    assert.match(md, /referencias\/persona\.md/, s + ': adopta la persona');
    assert.match(md, /referencias\/hq\.md/, s + ': resuelve HQ');
    assert.ok(md.split('\n').length <= 130, s + ': demasiado largo, mueve detalle a referencias/');
  }
});

test('las compuertas están donde importan', () => {
  assert.match(read('skills/cazar-proyectos/SKILL.md'), /¿Corro\?[\s\S]*"Ejecuta" no reemplaza este sí/);
  assert.match(read('skills/crear-subagente/SKILL.md'), /sí explícito a esa propuesta[\s\S]*"ejecuta" genérico no aprueba/);
  assert.match(read('skills/crear-subagente/SKILL.md'), /<HQ>\/agentes\//);
  assert.match(read('skills/redactar/SKILL.md'), /\*\*No envía ni publica\.\*\*/);
  assert.match(read('skills/decision/SKILL.md'), /solo cuando el gerente comunique la decisión/);
  assert.match(read('skills/reunion/SKILL.md'), /\*\*Compuerta\*\*/);
  assert.match(read('skills/seguimiento/SKILL.md'), /\*\*y\*\* el OK del gerente/);
  assert.match(read('skills/indicadores/SKILL.md'), /Nada se alerta hasta/);
  const persona = read('referencias/persona.md');
  assert.match(persona, /\*\*No suprimen las compuertas\.\*\*/);
  assert.match(persona, /nunca `spawn-agent` de ORCHESTRA/);
  assert.doesNotMatch(persona, /No revela/);
});

test('HQ nunca cae dentro de un repo y la memoria está ignorada por git y Vercel', () => {
  const hq = read('referencias/hq.md');
  assert.match(hq, /\$DMS_HQ/);
  assert.match(hq, /solo si el directorio actual NO está dentro de un repositorio git/);
  assert.match(hq, /# DMS — HQ/);
  const gi = readFileSync(join(REPO, '.gitignore'), 'utf8');
  for (const l of ['DMS/', '**/DMS/', '.env', '.env.*', '*.plugin']) assert.ok(gi.split('\n').includes(l), '.gitignore: ' + l);
  const vi = readFileSync(join(REPO, '.vercelignore'), 'utf8');
  assert.match(vi, /^gerente-general\/$/m);
  assert.match(vi, /^DMS\/$/m);
  assert.ok(!existsSync(join(REPO, 'DMS')), 'no debe existir DMS/ en el repo');
});

test('las plantillas de memoria existen, llevan marcador, CONTEXTO cabe en 100 líneas y no traen datos reales', () => {
  const files = ['CONTEXTO.md', 'empresa.md', 'diego.md', 'personas.md', 'proyectos.md', 'pendientes.md', 'decisiones.md', 'indicadores.md', 'radar.md', 'glosario.md', 'agentes.md'];
  for (const f of files) {
    const t = read('memoria/' + f);
    assert.match(t, /<!-- PLANTILLA: sin datos reales -->/, f + ': marcador');
    assert.doesNotMatch(t, /lh_[A-Za-z0-9_-]{10,}/, f + ': ninguna clave');
    assert.doesNotMatch(t, /\+56 ?9|[\w.+-]+@[\w-]+\.[a-z]{2,}/, f + ': sin teléfonos ni correos');
  }
  for (const f of ['sesiones/README.md', 'prospectos/README.md', 'README.md']) assert.ok(existsSync(join(ROOT, 'memoria', f)), f);
  const ctx = read('memoria/CONTEXTO.md');
  assert.ok(ctx.startsWith('# DMS — HQ'), 'CONTEXTO empieza con el marcador de HQ');
  assert.ok(ctx.split('\n').length <= 100);
  assert.match(read('memoria/pendientes.md'), /T-0001 \| P1 \| proj:dms \| resp:GG/);
});

test('referencias citadas existen', () => {
  const refs = readdirSync(join(ROOT, 'referencias')).filter((f) => f.endsWith('.md'));
  for (const r of ['persona.md', 'hq.md', 'protocolo-memoria.md', 'formato-respuesta.md', 'protocolo-delegacion.md', 'ficha-decision.md', 'agenda-y-resumen.md', 'indicadores-constructora.md', 'radar-fuentes-chile.md', 'sector-constructora-chile.md', 'agent-spec.md']) {
    assert.ok(refs.includes(r), r); assert.ok(statSync(join(ROOT, 'referencias', r)).size > 200, r);
  }
  const all = SKILLS.map((s) => read(`skills/${s}/SKILL.md`)).join('\n') + read('agents/gerente-general-dms.md') + readdirSync(join(ROOT, 'referencias')).map((f) => read('referencias/' + f)).join('\n');
  for (const m of all.matchAll(/referencias\/([a-z0-9-]+\.md)/g)) assert.ok(refs.includes(m[1]), 'referencia citada que no existe: ' + m[1]);
});

/* ── herramientas/leadhunter.mjs ── */
test('parseArgs y buildRequest', () => {
  const a = parseArgs(['--hq', '/x', 'hunt', '--offer', 'Construimos', '--target', 'inmobiliarias', '--channel', 'Email', '--count', '5', '--dry-run']);
  assert.deepEqual(a._, ['hunt']); assert.equal(a.hq, '/x'); assert.equal(a['dry-run'], true);
  const r = buildRequest('hunt', a);
  assert.deepEqual(r, { mode: 'hunt', input: { offer: 'Construimos', target: 'inmobiliarias', zone: '', channel: 'Email', count: 5 } });
  assert.deepEqual(buildRequest('infer', { url: 'https://x.cl' }), { mode: 'infer', input: { url: 'https://x.cl' } });
  assert.throws(() => buildRequest('hunt', { offer: 'x' }), /--target, --channel/);
  assert.throws(() => buildRequest('hunt', { offer: 'x', target: 'y', channel: 'Fax' }), /--channel/);
  assert.throws(() => buildRequest('hunt', { offer: 'x', target: 'y', channel: 'Email', count: '99' }), /entre 3 y 20/);
  assert.throws(() => buildRequest('nada', {}), /comando desconocido/);
});

test('rutaProhibida: plugin y repos git; credenciales: env primero, luego archivos de HQ', () => {
  assert.match(rutaProhibida('/home/x/vice-os-artifact/gerente-general/memoria', { execImpl: () => 'false' }), /plugin/);
  assert.match(rutaProhibida('/home/x/repo/DMS', { execImpl: () => 'true\n' }), /repositorio git/);
  assert.equal(rutaProhibida('/home/x/DMS', { execImpl: () => { throw new Error('not a git repo'); } }), null);
  const files = { '/hq/.leadhunter': 'lh_file\n', '/hq/.leadhunter-url': 'https://lh.test/\n' };
  const readImpl = (p) => { if (p in files) return files[p]; throw new Error('ENOENT'); };
  assert.deepEqual(credenciales({ env: {}, hq: '/hq', readImpl }), { key: 'lh_file', url: 'https://lh.test' });
  assert.deepEqual(credenciales({ env: { LEADHUNTER_API_KEY: 'lh_env', LEADHUNTER_URL: 'https://e.test' }, hq: '/hq', readImpl }), { key: 'lh_env', url: 'https://e.test' });
  assert.deepEqual(credenciales({ env: {}, hq: '', readImpl }), { key: '', url: '' });
});

test('parseSSE ignora pings y líneas rotas; readSSE junta chunks partidos', async () => {
  assert.deepEqual(parseSSE(': ping\n\ndata: {"type":"status","text":"a"}\n\ndata: {rota\n\nevent: x\ndata: {"type":"done","result":[]}\n\n').map((e) => e.type), ['status', 'done']);
  const parts = ['data: {"type":"sea', 'rch","n":1}\n\ndata: {"type":"do', 'ne","result":{"ok":1}}\n\n'];
  const body = new ReadableStream({ start(c) { for (const p of parts) c.enqueue(new TextEncoder().encode(p)); c.close(); } });
  const out = []; for await (const e of readSSE(body)) out.push(e);
  assert.deepEqual(out, [{ type: 'search', n: 1 }, { type: 'done', result: { ok: 1 } }]);
});

test('toMarkdown deja claro que nada se envió y cuánto se cobró', () => {
  const md = toMarkdown({ mode: 'hunt', input: { offer: 'o', target: 't', zone: 'Stgo', channel: 'WhatsApp', count: 5 }, result: [{ name: 'Inmo X', score: 85, message: 'hola', source: 'https://s' }], charged: 1, usedSearch: true, fecha: '2026-10-16' });
  assert.match(md, /Entregados: 1 · Cobrados: 1 créditos/);
  assert.match(md, /no enviado, lo envía el gerente/);
  assert.match(md, /Fuente: https:\/\/s/);
  assert.match(toMarkdown({ mode: 'hunt', input: { offer: 'o', target: 't', channel: 'Email', count: 3 }, result: [], usedSearch: false }), /NO \(objetivos de búsqueda/);
  assert.match(toMarkdown({ mode: 'infer', input: { url: 'https://x' }, result: { offer: 'a' } }), /por confirmar con el gerente/);
  assert.equal(slug('Inmobiliarias Región Metropolitana'), 'inmobiliarias-region-metropolitana');
});

function sink() { const s = { out: '' }; s.write = (t) => { s.out += t; return true; }; return s; }
const noGit = () => { throw new Error('no git'); };

test('run --dry-run no toca la red; sin URL o sin clave falla claro; HQ en repo se rechaza', async () => {
  let llamadas = 0;
  const fetchImpl = async () => { llamadas++; };
  const stdout = sink();
  const r = await run(['hunt', '--offer', 'o', '--target', 't', '--channel', 'WhatsApp', '--dry-run'], { fetchImpl, stdout, stderr: sink(), env: {} });
  assert.equal(llamadas, 0); assert.equal(r.dryRun, true); assert.equal(r.hayClave, false); assert.match(stdout.out, /<LEADHUNTER_URL>\/api\/agent/);
  await assert.rejects(run(['infer', '--url', 'https://x.cl'], { fetchImpl, stdout: sink(), stderr: sink(), env: { LEADHUNTER_API_KEY: 'lh_x' } }), /Falta la URL/);
  await assert.rejects(run(['infer', '--url', 'https://x.cl'], { fetchImpl, stdout: sink(), stderr: sink(), env: { LEADHUNTER_URL: 'https://e.test' } }), /Falta la clave/);
  await assert.rejects(run(['--hq', '/repo/DMS', 'infer', '--url', 'https://x.cl'], { fetchImpl, stdout: sink(), stderr: sink(), env: {}, execImpl: () => 'true' }), /repositorio git/);
  assert.equal(llamadas, 0);
});

test('run manda la clave, lee el stream y guarda en <HQ>/memoria/prospectos', async () => {
  let req;
  const sse = 'data: {"type":"status","text":"preparando"}\n\ndata: {"type":"search","n":1,"query":"inmobiliarias"}\n\ndata: {"type":"done","result":[{"name":"A","message":"m","score":90}],"charged":1,"usedSearch":true,"huntId":"h1","leadIds":["l1"]}\n\n';
  const fetchImpl = async (url, init) => { req = { url, init }; return { ok: true, status: 200, body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(sse)); c.close(); } }) }; };
  const stderr = sink();
  const { mkdtempSync } = await import('node:fs'); const { tmpdir } = await import('node:os');
  const hq = mkdtempSync(join(tmpdir(), 'dms-hq-'));
  const r = await run(['--hq', hq, 'hunt', '--offer', 'o', '--target', 'Inmobiliarias', '--zone', 'z', '--channel', 'WhatsApp', '--count', '3'], { fetchImpl, stdout: sink(), stderr, env: { LEADHUNTER_API_KEY: 'lh_abc', LEADHUNTER_URL: 'https://lh.test/' }, execImpl: noGit });
  assert.equal(req.url, 'https://lh.test/api/agent');
  assert.equal(req.init.headers.Authorization, 'Bearer lh_abc');
  assert.equal(JSON.parse(req.init.body).mode, 'hunt');
  assert.equal(r.charged, 1); assert.equal(r.huntId, 'h1'); assert.equal(r.result[0].name, 'A');
  assert.match(stderr.out, /buscando: «inmobiliarias»/);
  assert.ok(r.saved.startsWith(join(hq, 'memoria', 'prospectos')) && existsSync(r.saved));
});

test('run explica 402, 401 y 429 en palabras del gerente', async () => {
  const mk = (status, json) => async () => ({ ok: false, status, json: async () => json });
  const env = { LEADHUNTER_API_KEY: 'lh_abc', LEADHUNTER_URL: 'https://e.test' };
  await assert.rejects(run(['infer', '--url', 'https://x.cl'], { fetchImpl: mk(402, { needed: 5, credits: 2 }), stdout: sink(), stderr: sink(), env }), /tienes 2, necesitas 5/);
  await assert.rejects(run(['infer', '--url', 'https://x.cl'], { fetchImpl: mk(401, {}), stdout: sink(), stderr: sink(), env }), /rechazó la clave/);
  await assert.rejects(run(['infer', '--url', 'https://x.cl'], { fetchImpl: mk(429, {}), stdout: sink(), stderr: sink(), env }), /espera unos minutos/);
});
