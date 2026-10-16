import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseArgs, parsePendientes, parseProyectos, parseIndicadores, parseRadar, parseDecisiones, parseContexto, nivelPresion, diasEntre, hoyLocal, armarDatos, inyectar, run } from '../gerente-general/herramientas/dashboard.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(REPO, 'gerente-general');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
function sink() { const s = { out: '' }; s.write = (t) => { s.out += t; return true; }; return s; }
const noGit = () => { throw new Error('no git'); };

test('parsea las plantillas del plugin: 5 tareas, 0 S-líneas (ejemplos comentados), 0 obras (placeholder), T-0005 sin due', () => {
  const p = parsePendientes(read('memoria/pendientes.md'), '2026-10-16');
  assert.equal(p.tareas.length, 5); assert.equal(p.seguimientos.length, 0);
  const t5 = p.tareas.find((t) => t.id === 'T-0005');
  assert.equal(t5.due, ''); assert.equal(t5.nivel, null); assert.equal(t5.seccion, 'backlog');
  assert.match(t5.titulo, /^Registrar socios/);
  assert.match(p.tareas[0].hijas['done-when'], /^memoria\/empresa\.md/);
  assert.deepEqual(parseProyectos(read('memoria/proyectos.md')), []);
  const ind = parseIndicadores(read('memoria/indicadores.md'));
  assert.equal(ind.semanal.length, 5); assert.equal(ind.mensual.length, 6); assert.equal(ind.alertas.length, 0); assert.equal(ind.porConfirmar, true);
  assert.equal(ind.semanal[0].umbral, 'cae > 20 % en 2 semanas'); assert.equal(ind.semanal[0].valor, 'sin dato');
  const dec = parseDecisiones(read('memoria/decisiones.md'));
  assert.equal(dec.length, 3); assert.equal(dec.filter((d) => d.pendiente).length, 1);
  const rad = parseRadar(read('memoria/radar.md'));
  assert.equal(rad.entradas.length, 0); assert.ok(rad.temas.length >= 5);
  assert.equal(parseContexto(read('memoria/CONTEXTO.md')).proxima.length, 1);
});

test('presión por días calendario (--hoy), [x] nunca vence, fecha local', () => {
  assert.equal(nivelPresion('2026-10-23', '2026-10-25'), 'recordar');
  assert.equal(nivelPresion('2026-10-23', '2026-10-29'), 'insistir');
  assert.equal(nivelPresion('2026-10-23', '2026-10-30'), 'escalar');
  assert.equal(nivelPresion('2026-10-23', '2026-10-20'), null);
  assert.equal(nivelPresion('', '2026-10-20'), null);
  assert.equal(diasEntre('2026-03-31', '2026-04-01'), 1);
  const p = parsePendientes('## Hecho\n- [x] T-0001 | P1 | proj:a | resp:GG | due:2020-01-01 | vieja\n## Hoy\n- [~] T-0002 | P0 | proj:a | resp:Ana | due:2026-10-10 | en curso\n', '2026-10-16');
  assert.equal(p.tareas[0].estado, 'hecha'); assert.equal(p.tareas[0].nivel, null);
  assert.equal(p.tareas[1].estado, 'curso'); assert.equal(p.tareas[1].atraso, 6); assert.equal(p.tareas[1].nivel, 'insistir');
  assert.equal(hoyLocal(new Date(2026, 0, 5, 23, 30)), '2026-01-05');
});

function hqSintetico() {
  const hq = mkdtempSync(join(tmpdir(), 'dms-dash-'));
  mkdirSync(join(hq, 'memoria', 'sesiones'), { recursive: true });
  writeFileSync(join(hq, 'CONTEXTO.md'), '# DMS — HQ · CONTEXTO\n\n_Actualizado: 2026-10-15 por GG._\n\n## Para la próxima sesión\n- recordar el EP n°4\n');
  writeFileSync(join(hq, 'memoria', 'pendientes.md'), '# PENDIENTES\n\n## Hoy\n- [ ] T-0001 | P0 | proj:norte | resp:Carla | due:2026-10-16 | Confirmar lista </script><img src=x onerror=alert(1)>\n      done-when: lista firmada\n\n## Esta semana\n- [ ] T-0002 | P1 | proj:norte | resp:Diego | due:2026-10-09 | Cobrar EP\n\n## Seguimientos (tratos y compromisos de terceros)\n<!-- `- [ ] S-9999 | ejemplo | no cuenta | due:2020-01-01 | nivel:escalar` -->\n- [ ] S-0001 | Mandante Norte · EP 4 | etapa:negociación | monto:UF 1.250 | due:2026-10-11 | nivel:insistir\n      next: Diego llama el viernes\n- [ ] S-0002 | Proveedor | muestras | due:2026-10-08 | nivel:escalar\n');
  writeFileSync(join(hq, 'memoria', 'proyectos.md'), '# PROYECTOS\n\n## Resumen\n| Slug | Nombre | Cliente | Estado | Semáforo | Próximo hito | Fecha | Responsable |\n|---|---|---|---|---|---|---|---|\n| verde-1 | Obra Verde | C1 | en ejecución | 🟢 | hito | 2026-11-01 | Ana |\n| norte | Obra Norte | C2 | en ejecución | 🔴 | adicional | 2026-10-21 | Diego |\n| (por confirmar) | | | | | | | |\n\n## Fichas\n\n### norte — Obra Norte\n- Cliente: C2 · Contrato / monto (UF o CLP): UF 9.800 · Plazo contractual: 8 meses\n- Estado: en ejecución · Semáforo: rojo · Avance físico: 54 % · Avance financiero: 49 %\n- Riesgos abiertos: adicional de palabra · UF 320 · exigir orden · Diego\n- Pendientes relacionados: T-0002\n- Última actualización: 2026-10-15 · fuente: jefe de obra\n\n### <slug> — <nombre>\n- Estado: · Semáforo: ·\n');
  writeFileSync(join(hq, 'memoria', 'decisiones.md'), '# DECISIONES\n\n## 2026-10-15 — Adicional\nContexto: x\nDecisión: en preparación\nQuién decidió: pendiente\nConsecuencia: T-0002\n\n## 2026-10-14 — KPIs\nContexto: y\nDecisión: set de 5\nQuién decidió: Diego.\nConsecuencia: alertas\n');
  writeFileSync(join(hq, 'memoria', 'indicadores.md'), '# IND\n\n_set confirmado_\n\n## Semanal\n| KPI | Definición | Fuente del dato | Umbral de alerta | Último valor | Fecha |\n|---|---|---|---|---|---|\n| Caja | caja | finanzas | < 1 mes | 1,4 meses | 2026-10-14 |\n\n## Alertas activas\n- 2026-10-14 · Cobranza · 12 % vs 10 % · cobrar · abierta\n');
  writeFileSync(join(hq, 'memoria', 'sesiones', '2026-10-10.md'), '# Sesión 2026-10-10\n\n## Para recordarle la próxima vez\n- vieja\n');
  writeFileSync(join(hq, 'memoria', 'sesiones', '2026-10-12.md'), '# Sesión 2026-10-12\n\n## Preguntas que quedaron abiertas\n- ¿Exigimos orden de cambio?\n\n## Para recordarle la próxima vez\n- llamar al mandante\n');
  writeFileSync(join(hq, 'memoria', 'sesiones', '2026-10-12-comercial.md'), '# Sesión comercial\n\n## Para recordarle la próxima vez\n- NO debe salir\n');
  writeFileSync(join(hq, '.leadhunter'), 'lh_SECRETA_0123456789abcdef\n');
  writeFileSync(join(hq, '.leadhunter-url'), 'https://leadhunter-secreta.example\n');
  return hq;
}

test('HQ sintético: stats, brief, semáforos (🔴 primero, placeholders fuera), bitácora más reciente sin la de área', () => {
  const d = armarDatos(hqSintetico(), { hoy: '2026-10-16' });
  assert.deepEqual(d.stats, { vencidos: 3, hoy: 1, obrasRojas: 1, decisiones: 1, alertas: 1, tratos: 1 });
  assert.deepEqual(d.proyectos.map((p) => p.slug), ['norte', 'verde-1']);
  const n = d.proyectos[0];
  assert.equal(n.cliente, 'C2'); assert.equal(n.campos.Cliente, undefined, 'la ficha no duplica lo que ya trae el resumen');
  assert.equal(n.campos['Contrato / monto (UF o CLP)'], 'UF 9.800'); assert.equal(n.campos['Avance físico'], '54 %');
  assert.equal(n.actualizado, '2026-10-15 · fuente: jefe de obra'); assert.deepEqual(n.pendientes, ['T-0002']);
  assert.equal(d.bitacora.archivo, '2026-10-12.md');
  assert.equal(d.pendientes.seguimientos.length, 2, 'el ejemplo comentado no cuenta');
  const b = Object.fromEntries(d.brief.map((x) => [x.k, x.v]));
  assert.equal(b.VENCIDO, 'S-0002 Proveedor · muestras · 8 días · escalar | T-0002 Cobrar EP · Diego · 7 días · escalar | S-0001 Mandante Norte · EP 4 · 5 días · insistir');
  assert.match(b.HOY, /^T-0001 Confirmar lista/);
  assert.equal(b.OBRAS, '🔴 norte · adicional · 2026-10-21');
  assert.equal(b['DECISIÓN'], 'Adicional'); assert.equal(b.RADAR, 'sin novedades');
  assert.equal(b['TE DEBÍA'], 'llamar al mandante | recordar el EP n°4');
  assert.equal(b.PREGUNTA, '¿Exigimos orden de cambio?');
  assert.deepEqual(d.ecosistema.leadhunter, { key: true, url: true, prospectos: { total: 0, ultima: '' } });
  assert.equal(d.ecosistema.skills[0], 'gg'); assert.ok(d.ecosistema.skills.includes('dashboard'));
  assert.ok(d.ecosistema.memoria.some((m) => m.archivo === 'memoria/radar.md' && m.existe === false), 'archivo ausente → existe:false, sin error');
});

test('run escribe <HQ>/dashboard.html sin clave ni URL, con el JSON escapado y round-trip; --out y --json', async () => {
  const hq = hqSintetico(); const stdout = sink();
  const r = await run(['--hq', hq, '--hoy', '2026-10-16'], { stdout, stderr: sink(), env: {}, execImpl: noGit });
  assert.equal(r.salida, join(hq, 'dashboard.html')); assert.ok(existsSync(r.salida)); assert.ok(!existsSync(r.salida + '.tmp'));
  const html = readFileSync(r.salida, 'utf8');
  assert.doesNotMatch(html, /lh_SECRETA|leadhunter-secreta/, 'ni la clave ni la URL salen al HTML');
  assert.doesNotMatch(html, /NO debe salir/, 'la bitácora de área no es la última bitácora');
  assert.doesNotMatch(html, /<\/script><img/, 'el título malicioso queda escapado');
  assert.match(html, /Confidencial/);
  const m = html.match(/<script id="datos" type="application\/json">([\s\S]*?)<\/script>/);
  const back = JSON.parse(m[1]);
  assert.equal(back.pendientes.tareas[0].titulo, 'Confirmar lista </script><img src=x onerror=alert(1)>');
  assert.equal(back.ecosistema.leadhunter.key, true);
  assert.match(stdout.out, /dashboard\.html · vencidos 3 · hoy 1 · obras 🔴 1 · decisiones 1 · alertas 1 · tratos 1/);
  assert.doesNotMatch(stdout.out, /"tareas"/, 'sin --json no se vuelca la memoria por stdout');
  const out2 = join(hq, 'otro', 'd.html'); const s2 = sink();
  await run(['--hq', hq, '--out', out2, '--json', '--hoy', '2026-10-16'], { stdout: s2, stderr: sink(), env: { DMS_HQ: '/ignorado' }, execImpl: noGit });
  assert.ok(existsSync(out2)); assert.equal(JSON.parse(s2.out).salida, out2);
  const s3 = sink();
  await run(['--hoy', '2026-10-16'], { stdout: s3, stderr: sink(), env: { DMS_HQ: hq }, execImpl: noGit });
  assert.match(s3.out, /vencidos 3/, 'DMS_HQ sirve de --hq');
});

test('se niega dentro de un repo o del plugin (también con --out), exige HQ real y valida banderas', async () => {
  const hq = hqSintetico();
  const deps = { stdout: sink(), stderr: sink(), env: {}, execImpl: noGit };
  await assert.rejects(run(['--hq', '/repo/DMS'], { ...deps, execImpl: () => 'true' }), /repositorio git/);
  await assert.rejects(run(['--hq', hq, '--out', join(ROOT, 'x.html')], deps), /carpeta del plugin/);
  mkdirSync(join(hq, 'repo', '.git'), { recursive: true });
  await assert.rejects(run(['--hq', hq, '--out', join(hq, 'repo', 'd.html')], deps), /repositorio git/);
  assert.ok(!existsSync(join(hq, 'repo', 'd.html')));
  await assert.rejects(run(['--hq', join(hq, 'nada')], deps), /no parece una carpeta HQ/);
  await assert.rejects(run(['--hq', hq, '--hoy', 'ayer'], deps), /--hoy/);
  await assert.rejects(run([], deps), /Falta la carpeta HQ/);
  assert.throws(() => parseArgs(['--url', 'x']), /bandera desconocida/);
  assert.throws(() => parseArgs(['--hq']), /necesita un valor/);
});

test('la plantilla no trae datos reales ni red, se abre vacía sin romperse y el marcador existe', () => {
  const t = read('plantillas/dashboard.html');
  assert.match(t, /<script id="datos" type="application\/json">\{\}<\/script>/);
  assert.doesNotMatch(t, /lh_[A-Za-z0-9_-]{10,}|\+56 ?9|[\w.+-]+@[\w-]+\.[a-z]{2,}/, 'sin claves, teléfonos ni correos');
  assert.doesNotMatch(t, /<link[^>]+href=["']https?:|<script[^>]+src=|@import|url\(\s*["']?https?:/i, 'cero peticiones de red');
  assert.doesNotMatch(t, /fetch\(|localStorage|\bimport\s*[{(*'"]/, 'sin fetch, localStorage ni módulos: debe abrir en file://');
  assert.doesNotMatch(t, /dmsinversiones|desorden y destiempos/i, 'sin datos del cliente');
  assert.match(t, /Plantilla sin datos/);
  assert.match(inyectar(t, { a: '</script><!--' }), /\\u003c\/script>\\u003c!--/);
  assert.throws(() => inyectar('<html></html>', {}), /marcador/);
});
