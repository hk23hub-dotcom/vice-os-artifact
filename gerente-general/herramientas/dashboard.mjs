#!/usr/bin/env node
// Gerente General — dashboard local a partir de la memoria HQ. Sin dependencias (Node >= 18).
//
//   node dashboard.mjs --hq ~/DMS [--out <archivo.html>] [--hoy YYYY-MM-DD] [--json]
//
// Lee CONTEXTO.md y memoria/*.md de la carpeta HQ, calcula la presión por vencido y el brief de apertura, y escribe
// <HQ>/dashboard.html inyectando los datos en ../plantillas/dashboard.html (un solo archivo, se abre con doble clic,
// sin red). Es una VISTA: nunca modifica la memoria. Nunca lee .leadhunter ni .leadhunter-url (solo si existen).
// Se niega a escribir dentro de un repositorio git o de la carpeta del plugin. Progreso por stderr; con --json, los
// datos por stdout (para pruebas: no pegarlos en el chat, son la memoria completa).

import { readFileSync, writeFileSync, existsSync, readdirSync, renameSync, mkdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { rutaProhibida } from './leadhunter.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PLANTILLA = join(AQUI, '..', 'plantillas', 'dashboard.html');
const FLAGS_VALOR = ['hq', 'out', 'hoy'];
const FLAGS_BOOL = ['json'];
const ARCHIVOS_MEMORIA = ['empresa.md', 'diego.md', 'personas.md', 'proyectos.md', 'pendientes.md', 'decisiones.md', 'indicadores.md', 'radar.md', 'glosario.md', 'agentes.md'];
const SECCIONES_PENDIENTES = [['inbox', 'Inbox'], ['hoy', 'Hoy'], ['semana', 'Esta semana'], ['backlog', 'Backlog'], ['seguimientos', 'Seguimientos'], ['parked', 'Parked'], ['hecho', 'Hecho']];

/* Solo banderas conocidas. */
export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const k = a.slice(2);
    if (FLAGS_BOOL.includes(k)) { out[k] = true; continue; }
    if (!FLAGS_VALOR.includes(k)) throw new Error('bandera desconocida: --' + k + ' (válidas: --' + [...FLAGS_VALOR, ...FLAGS_BOOL].join(', --') + ')');
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) throw new Error('--' + k + ' necesita un valor');
    out[k] = next; i++;
  }
  return out;
}

/* ── utilidades de texto ── */
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const sinComentarios = (md) => String(md || '').replace(/<!--[\s\S]*?-->/g, '');
const limpio = (s) => String(s || '').trim();
const esPlaceholder = (s) => { const t = limpio(s); return !t || t.startsWith('(') || t.includes('<') || t === '—' || t === '-'; };
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n) => String(n).padStart(2, '0');

/* Fecha local de hoy (no toISOString: en Chile de noche ya es otro día en UTC). */
export function hoyLocal(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

/* Días calendario entre dos fechas YYYY-MM-DD (positivo si `hasta` es después de `desde`). */
export function diasEntre(desde, hasta) {
  if (!FECHA.test(desde) || !FECHA.test(hasta)) return null;
  const [a1, m1, d1] = desde.split('-').map(Number); const [a2, m2, d2] = hasta.split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
}

/* Presión por días de atraso (persona.md): 0–2 recordar · 3–6 insistir · ≥ 7 escalar; null si no está vencido. */
export function nivelPresion(due, hoy) {
  const atraso = diasEntre(due, hoy);
  if (atraso === null || atraso < 0) return null;
  return atraso >= 7 ? 'escalar' : atraso >= 3 ? 'insistir' : 'recordar';
}

/* Parte un markdown en secciones por encabezado de un nivel dado. La parte previa al primer encabezado va con título ''. */
export function secciones(md, nivel = 2) {
  const re = new RegExp('^' + '#'.repeat(nivel) + '\\s+(.*)$');
  const out = [{ titulo: '', lineas: [] }];
  for (const l of String(md || '').split('\n')) {
    const m = l.match(re);
    if (m) out.push({ titulo: m[1].trim(), lineas: [] }); else out[out.length - 1].lineas.push(l);
  }
  return out;
}
const buscar = (secs, prefijo) => secs.find((s) => norm(s.titulo).startsWith(norm(prefijo)));
const bullets = (lineas) => (lineas || []).map((l) => l.match(/^\s*[-*]\s+(.*)$/)).filter(Boolean).map((m) => m[1].trim()).filter((t) => !esPlaceholder(t));
const partes = (s) => String(s).split(/\s+·\s+/).map(limpio);

/* Filas de una tabla markdown: primera fila = cabecera, se salta la línea |---|. */
export function filasTabla(lineas) {
  const filas = (lineas || []).filter((l) => /^\s*\|/.test(l)).map((l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(limpio));
  if (filas.length < 2) return { cabecera: filas[0] || [], filas: [] };
  const [cabecera, ...resto] = filas;
  return { cabecera, filas: resto.filter((f) => !f.every((c) => /^:?-+:?$/.test(c) || c === '')) };
}

/* ── pendientes.md ── */
const RE_TAREA = /^- \[( |~|x|X)\] ([TS]-\d{4})\s*\|\s*(.*)$/;
const RE_HIJA = /^\s{2,}([a-z][a-z-]*):\s*(.*)$/;
const PREFIJOS = /^(proj|resp|due|nivel|etapa|monto):/;

function claveSeccion(titulo) {
  const t = norm(titulo);
  for (const [k, nombre] of SECCIONES_PENDIENTES) if (t.startsWith(norm(nombre))) return k;
  return t ? 'otra' : 'inbox';
}

export function parsePendientes(md, hoy) {
  const tareas = []; const seguimientos = [];
  let actual = null;
  for (const sec of secciones(sinComentarios(md))) {
    if (!sec.titulo) continue;
    const seccion = claveSeccion(sec.titulo);
    for (const l of sec.lineas) {
      const m = l.match(RE_TAREA);
      if (m) {
        const estado = m[1] === ' ' ? 'abierta' : m[1] === '~' ? 'curso' : 'hecha';
        const celdas = m[3].split('|').map(limpio).filter(Boolean);
        const campos = {}; const libres = [];
        for (const c of celdas) {
          if (/^P[0-3]$/i.test(c)) campos.prioridad = c.toUpperCase();
          else if (PREFIJOS.test(c)) { const i = c.indexOf(':'); campos[c.slice(0, i)] = limpio(c.slice(i + 1)); }
          else libres.push(c);
        }
        const due = FECHA.test(campos.due || '') ? campos.due : '';
        const base = { id: m[2], estado, seccion, due, hijas: {}, nivel: null, atraso: null };
        if (estado !== 'hecha' && due) { base.atraso = diasEntre(due, hoy); base.nivel = nivelPresion(due, hoy); }
        if (m[2].startsWith('T-')) {
          actual = { ...base, prioridad: campos.prioridad || '', proj: campos.proj || '', resp: campos.resp || '', titulo: libres.join(' | ') };
          tareas.push(actual);
        } else {
          actual = { ...base, tipo: campos.etapa ? 'trato' : 'compromiso', quien: libres[0] || '', que: libres.slice(1).join(' | '), etapa: campos.etapa || '', monto: campos.monto || '', nivelDeclarado: campos.nivel || '' };
          seguimientos.push(actual);
        }
        continue;
      }
      const h = actual && l.match(RE_HIJA);
      if (h) { actual.hijas[h[1]] = h[2].trim(); continue; }
      if (l.trim()) actual = null; // cualquier otra línea corta la tarea
    }
  }
  return { tareas, seguimientos };
}

/* ── proyectos.md ── */
export function normSemaforo(s) {
  const t = norm(s);
  if (/🔴|rojo|red/.test(String(s)) || /rojo|red/.test(t)) return 'rojo';
  if (/🟡|amarillo|yellow/.test(String(s)) || /amarillo/.test(t)) return 'amarillo';
  if (/🟢|verde|green/.test(String(s)) || /verde/.test(t)) return 'verde';
  return 'sin';
}
const ORDEN_SEMAFORO = { rojo: 0, amarillo: 1, verde: 2, sin: 3 };

export function parseProyectos(md) {
  const secs = secciones(sinComentarios(md));
  const porSlug = new Map();
  const resumen = buscar(secs, 'Resumen');
  if (resumen) {
    const { cabecera, filas } = filasTabla(resumen.lineas);
    const idx = (nombre) => cabecera.findIndex((c) => norm(c).startsWith(norm(nombre)));
    const [iSlug, iNombre, iCliente, iEstado, iSem, iHito, iFecha, iResp] = ['Slug', 'Nombre', 'Cliente', 'Estado', 'Sem', 'Próximo', 'Fecha', 'Resp'].map(idx);
    for (const f of filas) {
      const slug = f[iSlug] || '';
      if (esPlaceholder(slug)) continue;
      porSlug.set(slug, { slug, nombre: f[iNombre] || '', cliente: f[iCliente] || '', estado: f[iEstado] || '', semaforo: normSemaforo(f[iSem]), hito: f[iHito] || '', fecha: f[iFecha] || '', resp: f[iResp] || '', campos: {}, riesgos: '', pendientes: [], actualizado: '' });
    }
  }
  for (const ficha of secciones(sinComentarios(md), 3)) {
    const m = ficha.titulo.match(/^(.+?)\s+[—–-]\s+(.+)$/);
    if (!m || esPlaceholder(m[1])) continue;
    const slug = limpio(m[1]);
    const p = porSlug.get(slug) || { slug, nombre: limpio(m[2]), cliente: '', estado: '', semaforo: 'sin', hito: '', fecha: '', resp: '', campos: {}, riesgos: '', pendientes: [], actualizado: '' };
    if (!p.nombre) p.nombre = limpio(m[2]);
    for (const b of bullets(ficha.lineas)) {
      for (const trozo of partes(b)) {
        const i = trozo.indexOf(':'); if (i < 1) continue;
        const k = limpio(trozo.slice(0, i)); const v = limpio(trozo.slice(i + 1));
        const nk = norm(k);
        // Cliente, Estado y Próximo hito ya vienen de la fila del Resumen: la ficha solo los completa si faltan.
        if (nk === 'semaforo') { if (v) p.semaforo = normSemaforo(v); }
        else if (nk === 'estado') { if (v && !p.estado) p.estado = v; }
        else if (nk === 'cliente') { if (v && !p.cliente) p.cliente = v; }
        else if (nk.startsWith('proximo hito')) { if (v && !esPlaceholder(v) && !p.hito) p.hito = v; }
        else if (nk.startsWith('riesgos')) p.riesgos = esPlaceholder(v) ? '' : v;
        else if (nk.startsWith('pendientes')) p.pendientes = Array.from(b.matchAll(/T-\d{4}/g)).map((x) => x[0]);
        else if (nk.startsWith('ultima actualizacion')) p.actualizado = esPlaceholder(v) ? '' : v;
        else if (nk === 'fuente') { if (v) p.actualizado = (p.actualizado ? p.actualizado + ' · ' : '') + 'fuente: ' + v; }
        else if (v && !esPlaceholder(v) && !/^%$/.test(v)) p.campos[k] = v;
      }
    }
    porSlug.set(slug, p);
  }
  return [...porSlug.values()].sort((a, b) => ORDEN_SEMAFORO[a.semaforo] - ORDEN_SEMAFORO[b.semaforo]);
}

/* ── indicadores.md ── */
export function parseIndicadores(md) {
  const secs = secciones(sinComentarios(md));
  const tabla = (nombre) => {
    const s = buscar(secs, nombre); if (!s) return [];
    return filasTabla(s.lineas).filas.map((f) => ({ kpi: f[0] || '', definicion: f[1] || '', fuente: f[2] || '', umbral: f[3] || '', valor: f[4] || '', fecha: f[5] || '' })).filter((r) => r.kpi && !esPlaceholder(r.kpi));
  };
  const alertas = bullets((buscar(secs, 'Alertas') || {}).lineas).map((b) => { const [fecha, kpi, valor, propuesta, estado] = partes(b); return { fecha: fecha || '', kpi: kpi || '', valor: valor || '', propuesta: propuesta || '', estado: estado || '' }; });
  const historial = bullets((buscar(secs, 'Historial') || {}).lineas).map((b) => { const [fecha, kpi, valor, fuente] = partes(b); return { fecha: fecha || '', kpi: kpi || '', valor: valor || '', fuente: fuente || '' }; });
  const cabecera = secs[0].lineas.join('\n');
  return { semanal: tabla('Semanal'), mensual: tabla('Mensual'), alertas, historial: historial.slice(-12).reverse(), porConfirmar: /por confirmar/i.test(cabecera) };
}

/* ── radar.md ── */
export function parseRadar(md) {
  const secs = secciones(sinComentarios(md));
  const entradas = bullets((buscar(secs, 'Entradas') || {}).lineas).map((b) => { const [fecha, tema, cambio, impacto, fuente, siguiente] = partes(b); return { fecha: fecha || '', tema: (tema || '').replace(/^\[|\]$/g, ''), cambio: cambio || '', impacto: impacto || '', fuente: fuente || '', siguiente: siguiente || '' }; });
  const oportunidades = bullets((buscar(secs, 'Oportunidades') || {}).lineas).map((b) => { const [tema, porque, que, dueno, fecha] = partes(b); return { tema: tema || '', porque: porque || '', que: que || '', dueno: dueno || '', fecha: fecha || '' }; });
  return { temas: bullets((buscar(secs, 'Temas') || {}).lineas), entradas, oportunidades };
}

/* ── decisiones.md ── */
export function parseDecisiones(md) {
  const out = [];
  for (const s of secciones(sinComentarios(md))) {
    const m = s.titulo.match(/^(\d{4}-\d{2}-\d{2})\s*[—–-]\s*(.+)$/);
    if (!m) continue;
    const campo = (k) => { const l = s.lineas.find((x) => norm(x).startsWith(norm(k) + ':')); return l ? limpio(l.slice(l.indexOf(':') + 1)) : ''; };
    const texto = s.titulo + '\n' + s.lineas.join('\n');
    out.push({ fecha: m[1], titulo: limpio(m[2]), contexto: campo('Contexto'), decision: campo('Decisión'), quien: campo('Quién decidió'), consecuencia: campo('Consecuencia'), pendiente: /pendiente|en preparaci/i.test(texto) });
  }
  return out.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

/* ── bitácora de sesión ── */
const CLAVES_BITACORA = [['pedia', 'Qué pedía'], ['hizo', 'Qué se hizo'], ['decisiones', 'Decisiones'], ['pendientes', 'Pendientes'], ['preguntas', 'Preguntas'], ['recordar', 'Para recordar']];
export function parseBitacora(md, archivo = '') {
  const secs = secciones(sinComentarios(md));
  const out = { archivo, fecha: (archivo.match(/^\d{4}-\d{2}-\d{2}/) || [''])[0], titulo: (String(md).match(/^#\s+(.*)$/m) || ['', ''])[1].trim(), secciones: {} };
  for (const [k, pref] of CLAVES_BITACORA) {
    const todas = secs.filter((s) => norm(s.titulo).startsWith(norm(pref)));
    out.secciones[k] = todas.flatMap((s) => bullets(s.lineas)).filter((b) => b !== '…');
  }
  return out;
}
export function ultimaBitacora(dir) {
  if (!existsSync(dir)) return null;
  const nombres = readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}(-\d+)?\.md$/.test(f)).sort();
  return nombres.length ? nombres[nombres.length - 1] : null;
}

/* ── CONTEXTO.md ── */
export function parseContexto(md) {
  const secs = secciones(sinComentarios(md));
  const act = (String(md).match(/_Actualizado:\s*([^_]*)_/) || ['', ''])[1].trim();
  return { actualizado: act, proxima: bullets((buscar(secs, 'Para la próxima') || {}).lineas), hitos: bullets((buscar(secs, 'Próximos hitos') || {}).lineas), herramientas: bullets((buscar(secs, 'Herramientas') || {}).lineas) };
}

/* ── agentes.md + <HQ>/agentes/ ── */
export function parseAgentes(md) {
  const secs = secciones(sinComentarios(md));
  const activos = filasTabla((buscar(secs, 'Activos') || {}).lineas).filas.map((f) => ({ nombre: f[0] || '', cubre: f[2] || '', creado: f[4] || '' })).filter((a) => a.nombre && !esPlaceholder(a.nombre));
  const propuestos = filasTabla((buscar(secs, 'Propuestos') || {}).lineas).filas.map((f) => ({ nombre: f[0] || '', area: f[1] || '', trabajo: f[2] || '', estado: f[3] || '' })).filter((a) => a.nombre && !esPlaceholder(a.nombre));
  return { activos, propuestos };
}

/* ── brief de apertura (protocolo-memoria §2): 7 líneas ── */
const fmtAtraso = (n) => (n === 1 ? '1 día' : n + ' días');
export function armarBrief(d) {
  const abiertas = d.pendientes.tareas.filter((t) => t.estado !== 'hecha');
  const vencidas = [...abiertas.filter((t) => t.atraso > 0), ...d.pendientes.seguimientos.filter((s) => s.estado !== 'hecha' && s.atraso > 0)].sort((a, b) => b.atraso - a.atraso);
  const hoyL = abiertas.filter((t) => t.seccion === 'hoy' || t.atraso === 0);
  const obras = d.proyectos.filter((p) => p.semaforo === 'rojo' || p.semaforo === 'amarillo' || (FECHA.test(p.fecha) && diasEntre(d.hoy, p.fecha) >= 0 && diasEntre(d.hoy, p.fecha) <= 7));
  const decisiones = d.decisiones.filter((x) => x.pendiente);
  const desde = d.bitacora ? d.bitacora.fecha : '';
  const radar = d.radar.entradas.filter((e) => !desde || e.fecha > desde).slice(0, 3);
  const debia = [...(d.bitacora ? d.bitacora.secciones.recordar : []), ...d.contexto.proxima];
  const escalar = vencidas.find((v) => v.nivel === 'escalar');
  const pregunta = (d.bitacora && d.bitacora.secciones.preguntas[0]) || (escalar ? `${escalar.id}: ¿nueva fecha, reasignar o soltar?` : '');
  const sem = { rojo: '🔴', amarillo: '🟡', verde: '🟢', sin: '⚪' };
  return [
    { k: 'VENCIDO', v: vencidas.length ? vencidas.map((v) => `${v.id} ${v.id.startsWith('T-') ? `${v.titulo} · ${v.resp || '—'}` : `${v.quien}${v.que ? ' · ' + v.que : ''}`} · ${fmtAtraso(v.atraso)} · ${v.nivel}`).join(' | ') : 'nada' },
    { k: 'HOY', v: hoyL.length ? hoyL.slice(0, 5).map((t) => `${t.id} ${t.titulo}`).join(' | ') : 'nada para hoy' },
    { k: 'OBRAS', v: obras.length ? obras.map((p) => `${sem[p.semaforo]} ${p.slug}${p.hito ? ' · ' + p.hito : ''}${p.fecha ? ' · ' + p.fecha : ''}`).join(' | ') : 'sin novedades' },
    { k: 'DECISIÓN', v: decisiones.length ? decisiones.map((x) => x.titulo).join(' | ') : 'ninguna' },
    { k: 'RADAR', v: radar.length ? radar.map((e) => `${e.fecha} · ${e.tema} · ${e.cambio}`).join(' | ') : 'sin novedades' },
    { k: 'TE DEBÍA', v: debia.length ? debia.join(' | ') : 'nada' },
    { k: 'PREGUNTA', v: pregunta || 'ninguna' },
  ];
}

/* ── lectura de HQ ── */
function leer(p, readImpl) { try { return readImpl(p, 'utf8'); } catch (_) { return ''; } }
function lineas(p, readImpl) { const t = leer(p, readImpl); return t ? t.split('\n').length : 0; }

export function armarDatos(hq, { hoy = hoyLocal(), readImpl = readFileSync, existsImpl = existsSync } = {}) {
  const mem = (f) => join(hq, 'memoria', f);
  const pendientes = parsePendientes(leer(mem('pendientes.md'), readImpl), hoy);
  const proyectos = parseProyectos(leer(mem('proyectos.md'), readImpl));
  const indicadores = parseIndicadores(leer(mem('indicadores.md'), readImpl));
  const radar = parseRadar(leer(mem('radar.md'), readImpl));
  const decisiones = parseDecisiones(leer(mem('decisiones.md'), readImpl));
  const contexto = parseContexto(leer(join(hq, 'CONTEXTO.md'), readImpl));
  const agentes = parseAgentes(leer(mem('agentes.md'), readImpl));
  const ultima = ultimaBitacora(mem('sesiones'));
  const bitacora = ultima ? parseBitacora(leer(mem(join('sesiones', ultima)), readImpl), ultima) : null;
  const dirPros = mem('prospectos');
  const prospectos = existsImpl(dirPros) ? readdirSync(dirPros).filter((f) => /^\d{4}-\d{2}-\d{2}-(hunt|infer)-.*\.json$/.test(f)).sort() : [];
  const dirAg = join(hq, 'agentes');
  const instalados = existsImpl(dirAg) ? readdirSync(dirAg).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')).sort() : [];
  const dirSkills = join(AQUI, '..', 'skills');
  const skills = existsImpl(dirSkills) ? readdirSync(dirSkills).filter((f) => existsImpl(join(dirSkills, f, 'SKILL.md'))).sort((a, b) => (a === 'gg' ? -1 : b === 'gg' ? 1 : a.localeCompare(b))) : [];
  const memoria = [{ archivo: 'CONTEXTO.md', existe: existsImpl(join(hq, 'CONTEXTO.md')), lineas: lineas(join(hq, 'CONTEXTO.md'), readImpl) }, ...ARCHIVOS_MEMORIA.map((f) => ({ archivo: 'memoria/' + f, existe: existsImpl(mem(f)), lineas: lineas(mem(f), readImpl) }))];
  const sesiones = existsImpl(mem('sesiones')) ? readdirSync(mem('sesiones')).filter((f) => /^\d{4}-\d{2}-\d{2}(-\d+)?\.md$/.test(f)).length : 0;
  const d = {
    generado: `${hoyLocal()} ${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`, hoy, hq: resolve(hq),
    pendientes, proyectos, indicadores, radar, decisiones, contexto, bitacora,
    ecosistema: {
      skills, memoria, sesiones,
      agentes: { activos: agentes.activos, propuestos: agentes.propuestos, instalados },
      leadhunter: { key: existsImpl(join(hq, '.leadhunter')), url: existsImpl(join(hq, '.leadhunter-url')), prospectos: { total: prospectos.length, ultima: prospectos.length ? prospectos[prospectos.length - 1].slice(0, 10) : '' } },
    },
  };
  d.brief = armarBrief(d);
  const abiertas = pendientes.tareas.filter((t) => t.estado !== 'hecha');
  d.stats = {
    vencidos: abiertas.filter((t) => t.atraso > 0).length + pendientes.seguimientos.filter((s) => s.estado !== 'hecha' && s.atraso > 0).length,
    hoy: abiertas.filter((t) => t.seccion === 'hoy' || t.atraso === 0).length,
    obrasRojas: proyectos.filter((p) => p.semaforo === 'rojo').length,
    decisiones: decisiones.filter((x) => x.pendiente).length,
    alertas: indicadores.alertas.length,
    tratos: pendientes.seguimientos.filter((s) => s.tipo === 'trato' && s.estado !== 'hecha').length,
  };
  return d;
}

/* Inyecta el JSON en la plantilla. `<` → <: así ni </script> ni <!-- dentro de un título rompen la página. */
export function inyectar(plantilla, datos) {
  const json = JSON.stringify(datos).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const re = /(<script id="datos" type="application\/json">)[\s\S]*?(<\/script>)/;
  if (!re.test(plantilla)) throw new Error('la plantilla no tiene el marcador <script id="datos">');
  return plantilla.replace(re, (_, a, b) => a + json + b);
}

export async function run(argv, { stdout = process.stdout, stderr = process.stderr, env = process.env, execImpl, existsImpl, readImpl, hoy } = {}) {
  const args = parseArgs(argv);
  const hq = String(args.hq || env.DMS_HQ || '');
  if (!hq) throw new Error('Falta la carpeta HQ: usa --hq <ruta> o la variable DMS_HQ.');
  const ex = existsImpl || existsSync; const rd = readImpl || readFileSync;
  const prohibida = (p) => rutaProhibida(p, { ...(execImpl ? { execImpl } : {}), ...(existsImpl ? { existsImpl } : {}) });
  const mal = prohibida(hq);
  if (mal) throw new Error(`La carpeta HQ (${hq}) ${mal}: la memoria no puede vivir ahí.`);
  const ctx = leer(join(hq, 'CONTEXTO.md'), rd);
  if (!ctx.startsWith('# DMS — HQ')) throw new Error(`${hq} no parece una carpeta HQ (su CONTEXTO.md no empieza con "# DMS — HQ").`);
  const out = resolve(String(args.out || join(hq, 'dashboard.html')));
  const malOut = prohibida(out);
  if (malOut) throw new Error(`El destino (${out}) ${malOut}: el dashboard lleva la memoria completa y no puede escribirse ahí.`);
  const h = String(args.hoy || hoy || hoyLocal());
  if (!FECHA.test(h)) throw new Error('--hoy debe ser YYYY-MM-DD');
  const log = (s) => stderr.write(s + '\n');
  log(`dashboard: leyendo ${hq}`);
  const datos = armarDatos(hq, { hoy: h, readImpl: rd, existsImpl: ex });
  const plantilla = rd(PLANTILLA, 'utf8');
  const html = inyectar(plantilla, datos);
  mkdirSync(dirname(out), { recursive: true });
  const tmp = out + '.tmp';
  writeFileSync(tmp, html); renameSync(tmp, out);
  const s = datos.stats;
  if (args.json) stdout.write(JSON.stringify({ ...datos, salida: out }, null, 2) + '\n');
  else stdout.write(`${out} · vencidos ${s.vencidos} · hoy ${s.hoy} · obras 🔴 ${s.obrasRojas} · decisiones ${s.decisiones} · alertas ${s.alertas} · tratos ${s.tratos}\n`);
  return { ...datos, salida: out };
}

const esPrincipal = (() => { try { return import.meta.url === pathToFileURL(process.argv[1]).href; } catch (_) { return false; } })();
if (esPrincipal) {
  run(process.argv.slice(2)).catch((e) => { process.stderr.write('dashboard: ' + e.message + '\n'); process.exit(1); });
}
