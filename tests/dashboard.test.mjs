import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir, platform } from 'node:os';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { parseArgs, parsePendientes, parseProyectos, parseIndicadores, parseRadar, parseDecisiones, parseContexto, parseBitacora, ordenBitacora, nivelPresion, diasEntre, hoyLocal, armarDatos, armarBrief, inyectar, run, esPlaceholder, partesClave, normSemaforo, lineasPresion } from '../gerente-general/herramientas/dashboard.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(REPO, 'gerente-general');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
function sink() { const s = { out: '' }; s.write = (t) => { s.out += t; return true; }; return s; }
const noGit = () => { throw new Error('no git'); };
const deps = () => ({ stdout: sink(), stderr: sink(), env: {}, execImpl: noGit });
/* patrones que delatan una petición de red en una página que debe abrir sin conexión */
const RED = /\b(?:src|href|action|data|poster|srcset)\s*=\s*["']?\s*(?:https?:)?\/\/|url\(\s*["']?\s*(?:https?:)?\/\/|@import|http-equiv\s*=\s*["']?refresh|sendBeacon|XMLHttpRequest|WebSocket|EventSource|\bfetch\s*\(/i;
const sinDatos = (html) => html.replace(/<script id="datos" type="application\/json">[\s\S]*?<\/script>/, '');

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
  assert.equal(ind.semanal[3].umbral, '< 1 mes de gastos', 'un umbral con < no es placeholder');
  const dec = parseDecisiones(read('memoria/decisiones.md'));
  assert.equal(dec.length, 3);
  assert.deepEqual(dec.map((d) => d.pendiente), [false, false, true], 'solo "diseño (pendiente de que Diego lo confirme)" está pendiente');
  const rad = parseRadar(read('memoria/radar.md'));
  assert.equal(rad.entradas.length, 0); assert.ok(rad.temas.length >= 5);
  const ctx = parseContexto(read('memoria/CONTEXTO.md'));
  assert.equal(ctx.proxima.length, 1);
  assert.ok(ctx.herramientas.some((h) => h.includes('.leadhunter')), 'la línea con <HQ>/.leadhunter no se pierde');
});

test('CRLF, BOM y tabs dan el mismo resultado que LF (una memoria escrita en Windows no deja el dashboard vacío)', () => {
  const lf = read('memoria/pendientes.md');
  const crlf = '﻿' + lf.replace(/\n/g, '\r\n').replace(/\n {6}done-when:/g, '\n\tdone-when:');
  const a = parsePendientes(lf, '2026-10-16'), b = parsePendientes(crlf, '2026-10-16');
  assert.equal(b.tareas.length, a.tareas.length);
  assert.deepEqual(b.tareas.map((t) => t.hijas['done-when']), a.tareas.map((t) => t.hijas['done-when']));
  assert.equal(parseIndicadores(read('memoria/indicadores.md').replace(/\n/g, '\r\n')).semanal.length, 5);
  assert.equal(parseDecisiones('﻿' + read('memoria/decisiones.md').replace(/\n/g, '\r\n')).length, 3);
  assert.equal(parseContexto(read('memoria/CONTEXTO.md').replace(/\n/g, '\r\n')).proxima.length, 1);
  assert.equal(parseBitacora('﻿# Sesión 2026-10-12\r\n\r\n## Preguntas que quedaron abiertas\r\n- ¿a?\r\n- ¿b?\r\n', '2026-10-12.md').secciones.preguntas.length, 2);
});

test('placeholders solo cuando lo son; partición de fichas no rompe URLs ni horas; semáforo por palabra', () => {
  assert.equal(esPlaceholder('(por confirmar)'), true); assert.equal(esPlaceholder('<slug>'), true); assert.equal(esPlaceholder('—'), true); assert.equal(esPlaceholder(''), true);
  assert.equal(esPlaceholder('< 1 mes de gastos'), false); assert.equal(esPlaceholder('margen < 8 % (desvío)'), false);
  assert.deepEqual(partesClave('Estado: en ejecución · Semáforo: 🔴 · Avance físico: 54 % (desvío < −5 pp) · Web: https://x.cl/a · Hora: 10:30 · dueño'), ['Estado: en ejecución', 'Semáforo: 🔴', 'Avance físico: 54 % (desvío < −5 pp)', 'Web: https://x.cl/a', 'Hora: 10:30 · dueño']);
  assert.equal(normSemaforo('🟡 espera de crédito bancario'), 'amarillo');
  assert.equal(normSemaforo('🟢 (venía de 🔴)'), 'verde');
  assert.equal(normSemaforo('🟡 se redujo el plazo'), 'amarillo');
  assert.equal(normSemaforo('rojo'), 'rojo'); assert.equal(normSemaforo('red eléctrica'), 'sin'); assert.equal(normSemaforo(''), 'sin');
  const ind = parseIndicadores('# I\n## Alertas activas\n- 2026-10-14 · Caja · 0,8 meses vs < 1 mes · ver https://x.cl/informe a las 10:30 · abierta\n- 2026-10-10 · Margen · 9 % vs 12 % · revisar · cerrada\n## Historial de valores\n- 2026-10-14 · Avance · −7 pp (< −5 pp) · ITO\n');
  assert.equal(ind.alertas.length, 2); assert.equal(ind.alertas[0].propuesta, 'ver https://x.cl/informe a las 10:30'); assert.equal(ind.alertas[1].cerrada, true); assert.equal(ind.historial.length, 1);
  const kpi = parseIndicadores('# I\n## Semanal\n| KPI | Frecuencia | Definición | Fuente del dato | Umbral de alerta | Último valor | Fecha |\n|---|---|---|---|---|---|---|\n| Caja | semanal | caja | finanzas | < 1 mes | 1,4 meses | 2026-10-14 |\n').semanal[0];
  assert.deepEqual(kpi, { kpi: 'Caja', definicion: 'caja', fuente: 'finanzas', umbral: '< 1 mes', valor: '1,4 meses', fecha: '2026-10-14' }, 'columnas por nombre, no por posición');
});

test('presión por días calendario (--hoy), [x]/Hecho/Parked, hijas repetidas, fecha local', (t) => {
  assert.equal(nivelPresion('2026-10-23', '2026-10-25'), 'recordar');
  assert.equal(nivelPresion('2026-10-23', '2026-10-29'), 'insistir');
  assert.equal(nivelPresion('2026-10-23', '2026-10-30'), 'escalar');
  assert.equal(nivelPresion('2026-10-23', '2026-10-20'), null);
  assert.equal(nivelPresion('', '2026-10-20'), null);
  assert.equal(diasEntre('2026-03-31', '2026-04-01'), 1);
  const p = parsePendientes('## Hoy\n- [~] T-0002 | P0 | proj:a | resp:Ana | due:2026-10-10 | en curso\n      note: fecha propuesta por GG\n      note: insistir (6 días)\n      done-when: EP pagado\n## Parked\n- [ ] T-0008 | P3 | proj:a | resp:GG | due:2026-09-01 | estacionada\n      note: se desbloquea cuando …\n## Hecho\n- [ ] T-0001 | P1 | proj:a | resp:GG | due:2020-01-01 | perdida sin [x]\n      note: perdido · motivo\n', '2026-10-16');
  const porId = Object.fromEntries(p.tareas.map((x) => [x.id, x]));
  assert.equal(porId['T-0002'].estado, 'curso'); assert.equal(porId['T-0002'].atraso, 6); assert.equal(porId['T-0002'].nivel, 'insistir');
  assert.equal(porId['T-0002'].hijas.note, 'fecha propuesta por GG · insistir (6 días)', 'note: repetido se concatena');
  assert.equal(porId['T-0001'].estado, 'hecha', 'lo que está en Hecho está hecho aunque conserve [ ]'); assert.equal(porId['T-0001'].nivel, null);
  assert.equal(porId['T-0008'].nivel, 'escalar', 'Parked conserva su atraso para la etiqueta');
  const L = lineasPresion(p.tareas, []);
  assert.equal(L.vencidos, 1, 'ni Parked ni Hecho cuentan como vencidos'); assert.match(L.VENCIDO, /^T-0002 en curso · Ana · 6 días · insistir$/);
  assert.equal(L.HOY, 'T-0002 en curso');
  // fecha local, no UTC: a las 02:30Z del 16 en Santiago todavía es 15
  if (platform() === 'win32') { t.diagnostic('TZ no se puede cambiar en caliente en Windows'); return; }
  const antes = process.env.TZ;
  try { process.env.TZ = 'America/Santiago'; assert.equal(hoyLocal(new Date(Date.UTC(2026, 9, 16, 2, 30))), '2026-10-15'); }
  finally { if (antes === undefined) delete process.env.TZ; else process.env.TZ = antes; }
});

test('decisiones: pendiente por campos (no por la consecuencia) y fichas «# Decisión:» de ficha-decision.md', () => {
  const md = '# DECISIONES\n\n## 2026-10-15 — Subir precio m2\nContexto: x\nDecisión: sí, con anticipo 30 %\nQuién decidió: Diego y socios.\nConsecuencia: T-0007 y T-0008 en pendientes.md\n\n## 2026-10-14 — Tomamos la obra Norte\nContexto: y\n- **Decisión:** en preparación\nQuién decidió: pendiente (reunión del 21)\nConsecuencia: se crean los pendientes\n\n# Decisión: Adicional de Obra Norte sin orden de cambio\nFecha: 2026-10-15 · Preparó: GG · Decide: socios (reunión del 2026-10-21) · Deben enterarse: jefe de obra\n\nEstado: en preparación\n\n## Contexto (5 líneas máximo)\nEl mandante pide avanzar de palabra.\n\n## Recomendación\nOpción A porque protege el margen.\n\n# Decisión: Cambiar de proveedor de ventanas\nFecha: 2026-10-01 · Preparó: GG · Decide: Diego\nEstado: decidida\n\n## Contexto (5 líneas máximo)\nMuestras atrasadas.\nDecisión: se cambia a Termopanel Sur.\nQuién decidió: Diego.\nConsecuencia: T-0013\n';
  const d = parseDecisiones(md);
  assert.deepEqual(d.map((x) => [x.titulo, x.pendiente]), [['Subir precio m2', false], ['Adicional de Obra Norte sin orden de cambio', true], ['Tomamos la obra Norte', true], ['Cambiar de proveedor de ventanas', false]]);
  const ficha = d[1];
  assert.equal(ficha.fecha, '2026-10-15'); assert.equal(ficha.contexto, 'El mandante pide avanzar de palabra.'); assert.equal(ficha.decision, 'Opción A porque protege el margen.'); assert.match(ficha.quien, /^socios/);
  assert.equal(d[3].decision, 'se cambia a Termopanel Sur.');
});

test('bitácora: orden numérico de -N y la pregunta más reciente', () => {
  assert.deepEqual(['2026-10-12-10.md', '2026-10-12-2.md', '2026-10-12.md', '2026-10-11.md'].sort(ordenBitacora), ['2026-10-11.md', '2026-10-12.md', '2026-10-12-2.md', '2026-10-12-10.md']);
  const b = parseBitacora('# Sesión 2026-10-12\n\n## Preguntas que quedaron abiertas\n- ¿a?\n\n---\n_Bloque 18:40_\n\n## Preguntas que quedaron abiertas\n- ¿b?\n\n## Para recordarle la próxima vez\n- x\n', '2026-10-12.md');
  assert.deepEqual(b.secciones.preguntas, ['¿a?', '¿b?']);
  const brief = armarBrief({ hoy: '2026-10-16', pendientes: { tareas: [], seguimientos: [] }, proyectos: [], decisiones: [], radar: { entradas: [] }, contexto: { proxima: [] }, bitacora: b });
  assert.equal(brief.find((r) => r.k === 'PREGUNTA').v, '¿b?');
});

function hqSintetico(t) {
  const hq = mkdtempSync(join(tmpdir(), 'dms-dash-'));
  if (t) t.after(() => rmSync(hq, { recursive: true, force: true }));
  mkdirSync(join(hq, 'memoria', 'sesiones'), { recursive: true });
  writeFileSync(join(hq, 'CONTEXTO.md'), '# DMS — HQ · CONTEXTO\n\n_Actualizado: 2026-10-15 por GG._\n\n## Para la próxima sesión\n- recordar el EP n°4\n');
  writeFileSync(join(hq, 'memoria', 'pendientes.md'), '# PENDIENTES\n\n## Hoy\n- [ ] T-0001 | P0 | proj:norte | resp:Carla | due:2026-10-16 | Confirmar lista </script><img src=x onerror=alert(1)>\n      done-when: lista firmada\n\n## Esta semana\n- [ ] T-0002 | P1 | proj:norte | resp:Diego | due:2026-10-09 | Cobrar EP\n\n## Seguimientos (tratos y compromisos de terceros)\n<!-- `- [ ] S-9999 | ejemplo | no cuenta | due:2020-01-01 | nivel:escalar` -->\n- [ ] S-0001 | Mandante Norte · EP 4 | etapa:negociación | monto:UF 1.250 | due:2026-10-11 | nivel:insistir\n      next: Diego llama el viernes\n- [ ] S-0002 | Proveedor | muestras | due:2026-10-08 | nivel:escalar\n\n## Parked\n- [ ] T-0009 | P3 | proj:a | resp:Ana | due:2026-09-01 | Pedir cotización grúa\n      note: se desbloquea cuando haya 3 obras\n');
  writeFileSync(join(hq, 'memoria', 'proyectos.md'), '# PROYECTOS\n\n## Resumen\n| Slug | Nombre | Cliente | Estado | Semáforo | Próximo hito | Fecha | Responsable |\n|---|---|---|---|---|---|---|---|\n| verde-1 | Obra Verde | C1 | en ejecución | 🟢 | hito | 2026-11-01 | Ana |\n| norte | Obra Norte | C2 | en ejecución | 🔴 | adicional | 2026-10-21 | Diego |\n| (por confirmar) | | | | | | | |\n\n## Fichas\n\n### norte — Obra Norte\n- Cliente: C2 · Contrato / monto (UF o CLP): UF 9.800 · Plazo contractual: 8 meses\n- Estado: en ejecución · Semáforo: verde · Avance físico: 54 % (desvío < −5 pp) · Avance financiero: 49 %\n- Riesgos abiertos: adicional de palabra · UF 320 · exigir orden · Diego\n- Pendientes relacionados: T-0002\n- Última actualización: 2026-10-15 · fuente: jefe de obra\n\n### <slug> — <nombre>\n- Estado: · Semáforo: ·\n');
  writeFileSync(join(hq, 'memoria', 'decisiones.md'), '# DECISIONES\n\n## 2026-10-15 — Adicional\nContexto: x\nDecisión: en preparación\nQuién decidió: pendiente\nConsecuencia: T-0002\n\n## 2026-10-14 — KPIs\nContexto: y\nDecisión: set de 5\nQuién decidió: Diego.\nConsecuencia: alertas en pendientes.md\n');
  writeFileSync(join(hq, 'memoria', 'indicadores.md'), '# IND\n\n_set confirmado_\n\n## Semanal\n| KPI | Definición | Fuente del dato | Umbral de alerta | Último valor | Fecha |\n|---|---|---|---|---|---|\n| Caja | caja | finanzas | < 1 mes | 1,4 meses | 2026-10-14 |\n\n## Alertas activas\n- 2026-10-14 · Cobranza · 12 % vs 10 % · cobrar · abierta\n- 2026-10-14 · Caja · 0,8 meses vs < 1 mes de gastos · postergar · abierta\n- 2026-10-01 · Margen · 9 % vs 12 % · revisar · cerrada\n');
  writeFileSync(join(hq, 'memoria', 'sesiones', '2026-10-10.md'), '# Sesión 2026-10-10\n\n## Para recordarle la próxima vez\n- vieja\n');
  writeFileSync(join(hq, 'memoria', 'sesiones', '2026-10-12.md'), '# Sesión 2026-10-12\n\n## Preguntas que quedaron abiertas\n- ¿Exigimos orden de cambio?\n\n## Para recordarle la próxima vez\n- llamar al mandante\n');
  writeFileSync(join(hq, 'memoria', 'sesiones', '2026-10-12-2.md'), '# Sesión 2026-10-12 (2)\n\n## Preguntas que quedaron abiertas\n- ¿Segunda sesión del día?\n\n## Para recordarle la próxima vez\n- llamar al mandante\n');
  writeFileSync(join(hq, 'memoria', 'sesiones', '2026-10-12-comercial.md'), '# Sesión comercial\n\n## Para recordarle la próxima vez\n- NO debe salir\n');
  writeFileSync(join(hq, '.leadhunter'), 'lh_SECRETA_0123456789abcdef\n');
  writeFileSync(join(hq, '.leadhunter-url'), 'https://leadhunter-secreta.example\n');
  return hq;
}

test('HQ sintético: stats, brief, semáforos (🔴 primero, placeholders fuera), riesgos enteros, alertas, bitácora -2', (t) => {
  const d = armarDatos(hqSintetico(t), { hoy: '2026-10-16' });
  assert.deepEqual(d.stats, { vencidos: 3, hoy: 1, obrasRojas: 1, decisiones: 1, alertas: 2, tratos: 1 });
  assert.deepEqual(d.proyectos.map((p) => p.slug), ['norte', 'verde-1']);
  const n = d.proyectos[0];
  assert.equal(n.semaforo, 'rojo', 'el Resumen manda sobre la ficha');
  assert.equal(n.cliente, 'C2'); assert.equal(n.campos.Cliente, undefined, 'la ficha no duplica lo que ya trae el resumen');
  assert.equal(n.campos['Contrato / monto (UF o CLP)'], 'UF 9.800'); assert.equal(n.campos['Avance físico'], '54 % (desvío < −5 pp)');
  assert.equal(n.riesgos, 'adicional de palabra · UF 320 · exigir orden · Diego');
  assert.equal(n.actualizado, '2026-10-15 · fuente: jefe de obra'); assert.deepEqual(n.pendientes, ['T-0002']);
  assert.equal(d.bitacora.archivo, '2026-10-12-2.md');
  assert.equal(d.pendientes.seguimientos.length, 2, 'el ejemplo comentado no cuenta');
  assert.equal(d.indicadores.alertas.length, 3);
  const b = Object.fromEntries(d.brief.map((x) => [x.k, x.v]));
  assert.equal(b.VENCIDO, 'S-0002 Proveedor · muestras · 8 días · escalar | T-0002 Cobrar EP · Diego · 7 días · escalar | S-0001 Mandante Norte · EP 4 · 5 días · insistir', 'Parked no aparece');
  assert.match(b.HOY, /^T-0001 Confirmar lista/);
  assert.equal(b.OBRAS, '🔴 norte · adicional · 2026-10-21');
  assert.equal(b['DECISIÓN'], 'Adicional'); assert.equal(b.RADAR, 'sin novedades');
  assert.equal(b['TE DEBÍA'], 'llamar al mandante | recordar el EP n°4');
  assert.equal(b.PREGUNTA, '¿Segunda sesión del día?');
  assert.deepEqual(d.ecosistema.leadhunter, { key: true, url: true, prospectos: { total: 0, ultima: '' } });
  assert.equal(d.ecosistema.skills[0], 'gg'); assert.ok(d.ecosistema.skills.includes('dashboard'));
  assert.ok(d.ecosistema.memoria.some((m) => m.archivo === 'memoria/radar.md' && m.existe === false), 'archivo ausente → existe:false, sin error');
  assert.equal(d.hq, undefined, 'la ruta absoluta no va al JSON'); assert.match(d.hqNombre, /^dms-dash-/);
});

test('run escribe <HQ>/dashboard.html sin clave, URL ni ruta absoluta, con el JSON escapado y round-trip; --out y --json', async (t) => {
  const hq = hqSintetico(t); const stdout = sink();
  const r = await run(['--hq', hq, '--hoy', '2026-10-16'], { ...deps(), stdout });
  assert.equal(r.salida, join(hq, 'dashboard.html')); assert.ok(existsSync(r.salida));
  assert.deepEqual(readdirSync(hq).filter((f) => f.endsWith('.tmp')), [], 'sin temporales');
  const html = readFileSync(r.salida, 'utf8');
  assert.doesNotMatch(html, /lh_SECRETA|leadhunter-secreta/, 'ni la clave ni la URL salen al HTML');
  assert.ok(!html.includes(hq), 'la ruta absoluta de HQ no va al HTML');
  assert.doesNotMatch(html, /NO debe salir/, 'la bitácora de área no es la última bitácora');
  assert.doesNotMatch(html, /<\/script><img/, 'el título malicioso queda escapado');
  assert.doesNotMatch(sinDatos(html), RED, 'sin red en el HTML generado');
  assert.match(html, /Confidencial/);
  const m = html.match(/<script id="datos" type="application\/json">([\s\S]*?)<\/script>/);
  const back = JSON.parse(m[1]);
  assert.equal(back.pendientes.tareas[0].titulo, 'Confirmar lista </script><img src=x onerror=alert(1)>');
  assert.equal(back.ecosistema.leadhunter.key, true); assert.equal(back.hq, undefined);
  assert.match(stdout.out, /dashboard\.html · vencidos 3 · hoy 1 · obras 🔴 1 · decisiones 1 · alertas 2 · tratos 1/);
  assert.doesNotMatch(stdout.out, /"tareas"/, 'sin --json no se vuelca la memoria por stdout');
  const out2 = join(hq, 'otro', 'd.html'); const s2 = sink();
  await run(['--hq', hq, '--out', out2, '--json', '--hoy', '2026-10-16'], { ...deps(), stdout: s2, env: { DMS_HQ: '/ignorado' } });
  assert.ok(existsSync(out2)); assert.equal(JSON.parse(s2.out).salida, out2); assert.equal(JSON.parse(s2.out).hq, hq);
  const s3 = sink();
  await run(['--hoy', '2026-10-16'], { ...deps(), stdout: s3, env: { DMS_HQ: hq } });
  assert.match(s3.out, /vencidos 3/, 'DMS_HQ sirve de --hq');
});

test('se niega fuera de HQ, dentro de un repo o del plugin, sobre un directorio; sin .tmp huérfano; valida banderas', async (t) => {
  const hq = hqSintetico(t);
  await assert.rejects(run(['--hq', '/repo/DMS'], { ...deps(), execImpl: () => 'true' }), /repositorio git/);
  await assert.rejects(run(['--hq', hq, '--out', join(ROOT, 'x.html')], deps()), /carpeta del plugin/);
  mkdirSync(join(hq, 'repo', '.git'), { recursive: true });
  await assert.rejects(run(['--hq', hq, '--out', join(hq, 'repo', 'd.html')], deps()), /repositorio git/);
  await assert.rejects(run(['--hq', hq, '--out', join(tmpdir(), 'dms-fuera-' + process.pid + '.html')], deps()), /fuera de la carpeta HQ/);
  await assert.rejects(run(['--hq', hq, '--out', hq], deps()), /es una carpeta/);
  assert.ok(!existsSync(join(hq, 'repo', 'd.html')) && !existsSync(hq + '.tmp'));
  await assert.rejects(run(['--hq', hq], { ...deps(), renameImpl: () => { throw new Error('disco lleno'); } }), /disco lleno/);
  assert.deepEqual(readdirSync(hq).filter((f) => f.endsWith('.tmp')), [], 'el temporal se borra aunque falle el rename');
  assert.ok(!existsSync(join(hq, 'dashboard.html')));
  await assert.rejects(run(['--hq', join(hq, 'nada')], deps()), /no parece una carpeta HQ/);
  await assert.rejects(run(['--hq', hq, '--hoy', 'ayer'], deps()), /--hoy/);
  await assert.rejects(run([], deps()), /Falta la carpeta HQ/);
  assert.throws(() => parseArgs(['--url', 'x']), /bandera desconocida/);
  assert.throws(() => parseArgs(['--hq']), /necesita un valor/);
});

test('la plantilla no trae datos reales ni red, es accesible e imprimible, y el bloque compartido da el mismo brief en la página', (t) => {
  const tpl = read('plantillas/dashboard.html');
  assert.match(tpl, /<script id="datos" type="application\/json">\{\}<\/script>/);
  assert.doesNotMatch(tpl, /lh_[A-Za-z0-9_-]{10,}|\+56 ?9|[\w.+-]+@[\w-]+\.[a-z]{2,}/, 'sin claves, teléfonos ni correos');
  assert.doesNotMatch(tpl, RED, 'cero peticiones de red');
  assert.doesNotMatch(tpl, /localStorage|\bimport\s*[{(*'"]/, 'sin localStorage ni módulos: debe abrir en file://');
  assert.doesNotMatch(tpl, /dmsinversiones|desorden y destiempos|node <plugin>|tablero/i, 'sin datos del cliente ni rutas que el gerente no puede resolver');
  assert.match(tpl, /<details class="' \+ cls/); assert.match(tpl, /aria-label="Buscar pendientes"/); assert.match(tpl, /@media print\{[\s\S]*--txt:#000/);
  assert.match(tpl, /beforeprint/); assert.match(tpl, /Plantilla sin datos/);
  assert.match(inyectar(tpl, { a: '</script><!--' }), /\\u003c\/script>\\u003c!--/);
  assert.match(inyectar(tpl, { a: '$1 $& $$' }), /"\$1 \$& \$\$"/, 'los $ del JSON no se interpretan');
  assert.throws(() => inyectar('<html></html>', {}), /marcador/);
  // el bloque compartido, ejecutado como lo hace la página, reproduce VENCIDO/HOY del generador
  const d = armarDatos(hqSintetico(t), { hoy: '2026-10-16' });
  const bloque = tpl.match(/^[ \t]*\/\*<compartido>\*\/[ \t]*\n([\s\S]*?)^[ \t]*\/\*<\/compartido>\*\//m)[1];
  const ctx = vm.createContext({});
  vm.runInContext(bloque + '\nthis.L = (function(tareas, segs){ recalcularPresion(tareas, "2026-10-16"); recalcularPresion(segs, "2026-10-16"); return lineasPresion(tareas, segs); })(' + JSON.stringify(d.pendientes.tareas) + ',' + JSON.stringify(d.pendientes.seguimientos) + ');', ctx);
  const brief = Object.fromEntries(d.brief.map((x) => [x.k, x.v]));
  assert.equal(ctx.L.VENCIDO, brief.VENCIDO); assert.equal(ctx.L.HOY, brief.HOY); assert.equal(ctx.L.vencidos, d.stats.vencidos); assert.equal(ctx.L.hoy, d.stats.hoy);
  // abierta días después: la presión sube sola
  vm.runInContext('this.L2 = (function(tareas, segs){ recalcularPresion(tareas, "2026-10-30"); recalcularPresion(segs, "2026-10-30"); return lineasPresion(tareas, segs); })(' + JSON.stringify(d.pendientes.tareas) + ',' + JSON.stringify(d.pendientes.seguimientos) + ');', ctx);
  assert.equal(ctx.L2.vencidos, 4); assert.match(ctx.L2.VENCIDO, /T-0001 Confirmar lista[^|]*· 14 días · escalar/);
});
