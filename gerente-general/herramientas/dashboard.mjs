#!/usr/bin/env node
// Gerente General — dashboard local a partir de la memoria HQ. Sin dependencias (Node >= 18).
//
//   node dashboard.mjs --hq ~/DMS [--out <archivo.html dentro de HQ>] [--hoy YYYY-MM-DD] [--json]
//
// Lee CONTEXTO.md y memoria/*.md de la carpeta HQ, calcula la presión por vencido y el brief de apertura, y escribe
// <HQ>/dashboard.html inyectando los datos en ../plantillas/dashboard.html (un solo archivo, se abre con doble clic,
// sin red; la página vuelve a calcular la presión con la fecha del día en que se abre). Es una VISTA: nunca modifica
// la memoria. Nunca lee .leadhunter ni .leadhunter-url (solo si existen). Se niega a escribir fuera de HQ, dentro de
// un repositorio git o de la carpeta del plugin. Progreso por stderr; con --json, los datos por stdout (para pruebas:
// no pegarlos en el chat, son la memoria completa).
//
// Las funciones de presión (días de atraso, nivel, líneas VENCIDO y HOY) viven en la plantilla, entre los marcadores
// /*<compartido>*/ … /*</compartido>*/, y este módulo las carga de ahí: un solo origen para el generador y la página.

import { readFileSync, writeFileSync, existsSync, readdirSync, renameSync, mkdirSync, statSync, realpathSync, unlinkSync } from 'node:fs';
import { join, resolve, dirname, basename, relative, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { rutaProhibida } from './leadhunter.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PLUGIN = resolve(AQUI, '..');
const PLANTILLA = join(PLUGIN, 'plantillas', 'dashboard.html');
const FLAGS_VALOR = ['hq', 'out', 'hoy'];
const FLAGS_BOOL = ['json'];
const ARCHIVOS_MEMORIA = ['empresa.md', 'diego.md', 'personas.md', 'proyectos.md', 'pendientes.md', 'decisiones.md', 'indicadores.md', 'radar.md', 'glosario.md', 'agentes.md'];
const SECCIONES_PENDIENTES = [['inbox', 'Inbox'], ['hoy', 'Hoy'], ['semana', 'Esta semana'], ['backlog', 'Backlog'], ['seguimientos', 'Seguimientos'], ['parked', 'Parked'], ['hecho', 'Hecho']];
const RE_BITACORA = /^(\d{4}-\d{2}-\d{2})(?:-(\d+))?\.md$/;

/* ── bloque compartido con la plantilla ── */
function leerPlantilla() { return readFileSync(PLANTILLA, 'utf8'); }
function cargarCompartido(src) {
  const m = src.match(/^[ \t]*\/\*<compartido>\*\/[ \t]*\n([\s\S]*?)^[ \t]*\/\*<\/compartido>\*\//m);
  if (!m) throw new Error('la plantilla no tiene el bloque /*<compartido>*/');
  return new Function(m[1] + '\nreturn { diasEntre, nivelPresion, fmtAtraso, recalcularPresion, lineasPresion, abierta };')();
}
export const compartido = cargarCompartido(leerPlantilla());
export const { diasEntre, nivelPresion, fmtAtraso, recalcularPresion, lineasPresion } = compartido;

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
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
/* BOM y finales de línea de Windows fuera, comentarios HTML fuera: todo parser pasa por aquí antes de cualquier regex. */
export const normalizar = (md) => String(md || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
const sinComentarios = (md) => normalizar(md).replace(/<!--[\s\S]*?-->/g, '');
const limpio = (s) => String(s || '').trim();
/* Solo marcadores completos de plantilla: «(por confirmar)», «<slug>», «—»; un valor real con «<» no es placeholder. */
export const esPlaceholder = (s) => { const t = limpio(s); return !t || ['—', '-', '…'].includes(t) || /^\(.*\)$/.test(t) || /^<[^<>]+>$/.test(t); };
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n) => String(n).padStart(2, '0');

/* Fecha local de hoy (no toISOString: en Chile de noche ya es otro día en UTC). */
export function hoyLocal(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

/* Parte un markdown en secciones por encabezado de un nivel dado. La parte previa al primer encabezado va con título ''. */
export function secciones(md, nivel = 2) {
  const re = new RegExp('^' + '#'.repeat(nivel) + '\\s+(.*)$');
  const out = [{ titulo: '', lineas: [] }];
  for (const l of normalizar(md).split('\n')) {
    const m = l.match(re);
    if (m) out.push({ titulo: m[1].trim(), lineas: [] }); else out[out.length - 1].lineas.push(l);
  }
  return out;
}
const buscar = (secs, prefijo) => secs.find((s) => norm(s.titulo).startsWith(norm(prefijo)));
const bullets = (lineas) => (lineas || []).map((l) => l.match(/^\s*[-*]\s+(.*)$/)).filter(Boolean).map((m) => m[1].trim()).filter((t) => !esPlaceholder(t));
/* posicional (alertas, historial, radar): parte en todo « · » */
const partes = (s) => String(s).split(/\s+·\s+/).map(limpio);
/* fichas de obra: parte solo antes de una «Clave:» que empieza por letra (no parte «https://» ni «10:30») */
export const partesClave = (s) => String(s).split(/\s+·\s+(?=[A-Za-zÁ-ÿ][^·:]{0,39}:(?!\/\/))/).map(limpio);

/* Filas de una tabla markdown: primera fila = cabecera, se salta la línea |---|. */
export function filasTabla(lineas) {
  const filas = (lineas || []).filter((l) => /^\s*\|/.test(l)).map((l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(limpio));
  if (filas.length < 2) return { cabecera: filas[0] || [], filas: [] };
  const [cabecera, ...resto] = filas;
  return { cabecera, filas: resto.filter((f) => !f.every((c) => /^:?-+:?$/.test(c) || c === '')) };
}
/* columna por nombre de cabecera (prefijo, sin acentos); -1 si no está */
const columna = (cabecera, nombre) => cabecera.findIndex((c) => norm(c).startsWith(norm(nombre)));
const celda = (fila, i) => (i >= 0 ? fila[i] || '' : '');

/* ── pendientes.md ── */
const RE_TAREA = /^- \[( |~|x|X)\] ([TS]-\d{4})\s*\|\s*(.*)$/;
const RE_HIJA = /^(?:\t|[ ]{2,})\s*([a-z][a-z-]*):\s*(.*)$/;
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
        const estado = m[1] !== ' ' && m[1] !== '~' ? 'hecha' : seccion === 'hecho' ? 'hecha' : m[1] === '~' ? 'curso' : 'abierta';
        const celdas = m[3].split('|').map(limpio).filter(Boolean);
        const campos = {}; const libres = [];
        for (const c of celdas) {
          if (/^P[0-3]$/i.test(c)) campos.prioridad = c.toUpperCase();
          else if (PREFIJOS.test(c)) { const i = c.indexOf(':'); campos[c.slice(0, i)] = limpio(c.slice(i + 1)); }
          else libres.push(c);
        }
        const due = FECHA.test(campos.due || '') ? campos.due : '';
        const base = { id: m[2], estado, seccion, due, hijas: {}, nivel: null, atraso: null };
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
      if (h) { const v = h[2].trim(); actual.hijas[h[1]] = actual.hijas[h[1]] ? actual.hijas[h[1]] + ' · ' + v : v; continue; }
      if (l.trim()) actual = null; // cualquier otra línea corta la tarea
    }
  }
  recalcularPresion(tareas, hoy); recalcularPresion(seguimientos, hoy);
  return { tareas, seguimientos };
}

/* ── proyectos.md ── */
export function normSemaforo(s) {
  const t = String(s || '') + ' ' + norm(s);
  const m = t.match(/🔴|🟡|🟢|\b(rojo|amarillo|verde)\b/);
  if (!m) return 'sin';
  return /🔴|rojo/.test(m[0]) ? 'rojo' : /🟡|amarillo/.test(m[0]) ? 'amarillo' : 'verde';
}
const ORDEN_SEMAFORO = { rojo: 0, amarillo: 1, verde: 2, sin: 3 };
const nuevoProyecto = (slug, nombre) => ({ slug, nombre, cliente: '', estado: '', semaforo: 'sin', hito: '', fecha: '', resp: '', campos: {}, riesgos: '', pendientes: [], actualizado: '' });

export function parseProyectos(md) {
  const secs = secciones(sinComentarios(md));
  const porSlug = new Map();
  const resumen = buscar(secs, 'Resumen');
  if (resumen) {
    const { cabecera, filas } = filasTabla(resumen.lineas);
    const [iSlug, iNombre, iCliente, iEstado, iSem, iHito, iFecha, iResp] = ['Slug', 'Nombre', 'Cliente', 'Estado', 'Sem', 'Próximo', 'Fecha', 'Resp'].map((n) => columna(cabecera, n));
    for (const f of filas) {
      const slug = celda(f, iSlug);
      if (esPlaceholder(slug)) continue;
      porSlug.set(slug, { ...nuevoProyecto(slug, celda(f, iNombre)), cliente: celda(f, iCliente), estado: celda(f, iEstado), semaforo: normSemaforo(celda(f, iSem)), hito: celda(f, iHito), fecha: celda(f, iFecha), resp: celda(f, iResp) });
    }
  }
  for (const ficha of secciones(sinComentarios(md), 3)) {
    const m = ficha.titulo.match(/^(.+?)\s+[—–-]\s+(.+)$/);
    if (!m || esPlaceholder(m[1])) continue;
    const slug = limpio(m[1]);
    const p = porSlug.get(slug) || nuevoProyecto(slug, limpio(m[2]));
    if (!p.nombre) p.nombre = limpio(m[2]);
    for (const b of bullets(ficha.lineas)) {
      const mR = b.match(/^riesgos[^:]*:\s*(.*)$/i);
      if (mR) { p.riesgos = esPlaceholder(mR[1]) ? '' : limpio(mR[1]); continue; }
      for (const trozo of partesClave(b)) {
        const i = trozo.indexOf(':'); if (i < 1) continue;
        const k = limpio(trozo.slice(0, i)); const v = limpio(trozo.slice(i + 1));
        const nk = norm(k);
        // Cliente, Estado, Próximo hito y Semáforo ya vienen de la fila del Resumen: la ficha solo los completa si faltan.
        if (nk === 'semaforo') { if (v && p.semaforo === 'sin') p.semaforo = normSemaforo(v); }
        else if (nk === 'estado') { if (v && !p.estado) p.estado = v; }
        else if (nk === 'cliente') { if (v && !p.cliente) p.cliente = v; }
        else if (nk.startsWith('proximo hito')) { if (v && !esPlaceholder(v) && !p.hito) p.hito = v; }
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
    const { cabecera, filas } = filasTabla(s.lineas);
    const [iK, iD, iF, iU, iV, iFe] = ['KPI', 'Defin', 'Fuente', 'Umbral', 'Último', 'Fecha'].map((n) => columna(cabecera, n));
    return filas.map((f) => ({ kpi: celda(f, iK), definicion: celda(f, iD), fuente: celda(f, iF), umbral: celda(f, iU), valor: celda(f, iV), fecha: celda(f, iFe) })).filter((r) => r.kpi && !esPlaceholder(r.kpi));
  };
  const alertas = bullets((buscar(secs, 'Alertas') || {}).lineas).map((b) => { const [fecha, kpi, valor, propuesta, estado] = partes(b); return { fecha: fecha || '', kpi: kpi || '', valor: valor || '', propuesta: propuesta || '', estado: estado || '', cerrada: /cerrad|resuelt/i.test(estado || '') }; });
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

/* ── decisiones.md: bloques «## fecha — título» y fichas «# Decisión: título» (referencias/ficha-decision.md) ── */
const campoDe = (lineas, k) => { const re = new RegExp('^\\s*(?:-\\s*)?\\**\\s*' + k + '\\**\\s*:\\s*(.*)$', 'i'); for (const l of lineas) { const m = norm(l).match(new RegExp('^\\s*(?:-\\s*)?\\**\\s*' + norm(k) + '\\**\\s*:')); if (m) { const r = l.match(re); return limpio(r ? r[1] : l.slice(l.indexOf(':') + 1)).replace(/\*+$/, '').trim(); } } return ''; };
function esPendiente({ estado, decision, quien, esFicha }) {
  if (estado) return /^(pendiente|en preparaci)/i.test(estado);
  if (decision) return /^(pendiente|en preparaci)/i.test(decision) || /pendiente/i.test(quien);
  return !!esFicha; // una ficha sin «Decisión:» todavía no se decidió
}
export function parseDecisiones(md) {
  const out = [];
  for (const s1 of secciones(sinComentarios(md), 1)) {
    const mf = s1.titulo.match(/^Decisi[oó]n:\s*(.+)$/i);
    if (mf) {
      const fechaL = campoDe(s1.lineas, 'Fecha');
      const fecha = (fechaL.match(/\d{4}-\d{2}-\d{2}/) || [''])[0];
      const sub = secciones(s1.lineas.join('\n'), 2);
      const primera = (n) => ((buscar(sub, n) || { lineas: [] }).lineas.find((l) => l.trim() && !/^\s*\|/.test(l)) || '').replace(/^\s*[-*]\s+/, '').trim();
      const decision = campoDe(s1.lineas, 'Decisión') || primera('Recomendación');
      const quien = campoDe(s1.lineas, 'Quién decidió') || (fechaL.match(/Decide:\s*([^·]+)/i) || ['', ''])[1].trim();
      const estado = campoDe(s1.lineas, 'Estado');
      out.push({ fecha, titulo: limpio(mf[1]), contexto: primera('Contexto'), decision, quien, consecuencia: campoDe(s1.lineas, 'Consecuencia'), pendiente: esPendiente({ estado, decision: campoDe(s1.lineas, 'Decisión'), quien, esFicha: true }) });
      continue;
    }
    for (const s of secciones(s1.lineas.join('\n'), 2)) {
      const m = s.titulo.match(/^(\d{4}-\d{2}-\d{2})\s*[—–-]\s*(.+)$/);
      if (!m) continue;
      const decision = campoDe(s.lineas, 'Decisión'); const quien = campoDe(s.lineas, 'Quién decidió'); const estado = campoDe(s.lineas, 'Estado');
      out.push({ fecha: m[1], titulo: limpio(m[2]), contexto: campoDe(s.lineas, 'Contexto'), decision, quien, consecuencia: campoDe(s.lineas, 'Consecuencia'), pendiente: esPendiente({ estado, decision, quien, esFicha: false }) });
    }
  }
  return out.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

/* ── bitácora de sesión ── */
const CLAVES_BITACORA = [['pedia', 'Qué pedía'], ['hizo', 'Qué se hizo'], ['decisiones', 'Decisiones'], ['pendientes', 'Pendientes'], ['preguntas', 'Preguntas'], ['recordar', 'Para recordar']];
export function parseBitacora(md, archivo = '') {
  const texto = sinComentarios(md);
  const secs = secciones(texto);
  const out = { archivo, fecha: (archivo.match(/^\d{4}-\d{2}-\d{2}/) || [''])[0], titulo: (texto.match(/^#\s+(.*)$/m) || ['', ''])[1].trim(), secciones: {} };
  for (const [k, pref] of CLAVES_BITACORA) {
    const todas = secs.filter((s) => norm(s.titulo).startsWith(norm(pref)));
    out.secciones[k] = todas.flatMap((s) => bullets(s.lineas)).filter((b) => b !== '…');
  }
  return out;
}
/* orden numérico: 2026-10-12.md < 2026-10-12-2.md < 2026-10-12-10.md */
export function ordenBitacora(a, b) {
  const ka = a.match(RE_BITACORA), kb = b.match(RE_BITACORA);
  if (ka[1] !== kb[1]) return ka[1] < kb[1] ? -1 : 1;
  return (+(ka[2] || 1)) - (+(kb[2] || 1));
}
export function ultimaBitacora(dir) {
  if (!existsSync(dir)) return null;
  const nombres = readdirSync(dir).filter((f) => RE_BITACORA.test(f)).sort(ordenBitacora);
  return nombres.length ? nombres[nombres.length - 1] : null;
}

/* ── CONTEXTO.md ── */
export function parseContexto(md) {
  const texto = sinComentarios(md);
  const secs = secciones(texto);
  const act = (texto.match(/_Actualizado:\s*([^_]*)_/) || ['', ''])[1].trim();
  return { actualizado: act, proxima: bullets((buscar(secs, 'Para la próxima') || {}).lineas), hitos: bullets((buscar(secs, 'Próximos hitos') || {}).lineas), herramientas: bullets((buscar(secs, 'Herramientas') || {}).lineas) };
}

/* ── agentes.md + <HQ>/agentes/ ── */
export function parseAgentes(md) {
  const secs = secciones(sinComentarios(md));
  const activos = filasTabla((buscar(secs, 'Activos') || {}).lineas).filas.map((f) => ({ nombre: f[0] || '', cubre: f[2] || '', creado: f[4] || '' })).filter((a) => a.nombre && !esPlaceholder(a.nombre));
  const propuestos = filasTabla((buscar(secs, 'Propuestos') || {}).lineas).filas.map((f) => ({ nombre: f[0] || '', area: f[1] || '', trabajo: f[2] || '', estado: f[3] || '' })).filter((a) => a.nombre && !esPlaceholder(a.nombre));
  return { activos, propuestos };
}

/* ── brief de apertura (protocolo-memoria §2): 7 líneas; VENCIDO y HOY salen del bloque compartido ── */
export function armarBrief(d) {
  const L = lineasPresion(d.pendientes.tareas, d.pendientes.seguimientos);
  const obras = d.proyectos.filter((p) => p.semaforo === 'rojo' || p.semaforo === 'amarillo' || (FECHA.test(p.fecha) && diasEntre(d.hoy, p.fecha) >= 0 && diasEntre(d.hoy, p.fecha) <= 7));
  const decisiones = d.decisiones.filter((x) => x.pendiente);
  const desde = d.bitacora ? d.bitacora.fecha : '';
  const radar = d.radar.entradas.filter((e) => !desde || e.fecha > desde).slice(0, 3);
  const debia = [...(d.bitacora ? d.bitacora.secciones.recordar : []), ...d.contexto.proxima];
  const preguntas = d.bitacora ? d.bitacora.secciones.preguntas : [];
  const pregunta = preguntas[preguntas.length - 1] || (L.escalar ? `${L.escalar.id}: ¿nueva fecha, reasignar o soltar?` : '');
  const sem = { rojo: '🔴', amarillo: '🟡', verde: '🟢', sin: '⚪' };
  return [
    { k: 'VENCIDO', v: L.VENCIDO },
    { k: 'HOY', v: L.HOY },
    { k: 'OBRAS', v: obras.length ? obras.map((p) => `${sem[p.semaforo]} ${p.slug}${p.hito ? ' · ' + p.hito : ''}${p.fecha ? ' · ' + p.fecha : ''}`).join(' | ') : 'sin novedades' },
    { k: 'DECISIÓN', v: decisiones.length ? decisiones.map((x) => x.titulo).join(' | ') : 'ninguna' },
    { k: 'RADAR', v: radar.length ? radar.map((e) => `${e.fecha} · ${e.tema} · ${e.cambio}`).join(' | ') : 'sin novedades' },
    { k: 'TE DEBÍA', v: debia.length ? debia.join(' | ') : 'nada' },
    { k: 'PREGUNTA', v: pregunta || 'ninguna' },
  ];
}

/* ── lectura de HQ ── */
function leer(p, readImpl) { try { return normalizar(readImpl(p, 'utf8')); } catch (_) { return ''; } }
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
  const dirSkills = join(PLUGIN, 'skills');
  const skills = existsImpl(dirSkills) ? readdirSync(dirSkills).filter((f) => existsImpl(join(dirSkills, f, 'SKILL.md'))).sort((a, b) => (a === 'gg' ? -1 : b === 'gg' ? 1 : a.localeCompare(b))) : [];
  const memoria = [{ archivo: 'CONTEXTO.md', existe: existsImpl(join(hq, 'CONTEXTO.md')), lineas: lineas(join(hq, 'CONTEXTO.md'), readImpl) }, ...ARCHIVOS_MEMORIA.map((f) => ({ archivo: 'memoria/' + f, existe: existsImpl(mem(f)), lineas: lineas(mem(f), readImpl) }))];
  const sesiones = existsImpl(mem('sesiones')) ? readdirSync(mem('sesiones')).filter((f) => RE_BITACORA.test(f)).length : 0;
  const ahora = new Date();
  const d = {
    generado: `${hoyLocal(ahora)} ${pad(ahora.getHours())}:${pad(ahora.getMinutes())}`, hoy, hqNombre: basename(resolve(hq)),
    pendientes, proyectos, indicadores, radar, decisiones, contexto, bitacora,
    ecosistema: {
      skills, memoria, sesiones,
      agentes: { activos: agentes.activos, propuestos: agentes.propuestos, instalados },
      leadhunter: { key: existsImpl(join(hq, '.leadhunter')), url: existsImpl(join(hq, '.leadhunter-url')), prospectos: { total: prospectos.length, ultima: prospectos.length ? prospectos[prospectos.length - 1].slice(0, 10) : '' } },
    },
  };
  d.brief = armarBrief(d);
  const L = lineasPresion(pendientes.tareas, pendientes.seguimientos);
  d.stats = {
    vencidos: L.vencidos,
    hoy: L.hoy,
    obrasRojas: proyectos.filter((p) => p.semaforo === 'rojo').length,
    decisiones: decisiones.filter((x) => x.pendiente).length,
    alertas: indicadores.alertas.filter((a) => !a.cerrada).length,
    tratos: pendientes.seguimientos.filter((s) => s.tipo === 'trato' && s.estado !== 'hecha').length,
  };
  return d;
}

/* Inyecta el JSON en la plantilla. `<` → \u003c: así ni </script> ni <!-- dentro de un título rompen la página. */
export function inyectar(plantilla, datos) {
  const json = JSON.stringify(datos).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const re = /(<script id="datos" type="application\/json">)[\s\S]*?(<\/script>)/;
  if (!re.test(plantilla)) throw new Error('la plantilla no tiene el marcador <script id="datos">');
  return plantilla.replace(re, (_, a, b) => a + json + b); // función: ningún «$» del JSON se interpreta

}

/* ruta real de un archivo que puede no existir todavía: realpath del ancestro existente más cercano + el resto */
function rutaReal(p) {
  let base = resolve(p); let resto = '';
  while (!existsSync(base)) { resto = join(basename(base), resto); const up = dirname(base); if (up === base) break; base = up; }
  return resto ? join(realpathSync(base), resto) : realpathSync(base);
}
const dentroDe = (padre, hijo) => { const r = relative(padre, hijo); return !r.startsWith('..') && !isAbsolute(r); }; // r === '' (el mismo directorio) cuenta como dentro: lo rechaza el chequeo de directorio

export async function run(argv, { stdout = process.stdout, stderr = process.stderr, env = process.env, execImpl, existsImpl, readImpl, writeImpl = writeFileSync, renameImpl = renameSync, hoy } = {}) {
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
  const hqReal = rutaReal(hq); const outReal = rutaReal(out);
  if (!dentroDe(hqReal, outReal)) throw new Error(`El destino (${out}) está fuera de la carpeta HQ: el dashboard lleva la memoria completa y solo se escribe dentro de HQ.`);
  if (dentroDe(PLUGIN, outReal) || outReal === PLUGIN) throw new Error(`El destino (${out}) está dentro de la carpeta del plugin.`);
  if (existsSync(out) && statSync(out).isDirectory()) throw new Error(`El destino (${out}) es una carpeta: indica el archivo, p. ej. ${join(out, 'dashboard.html')}.`);
  const h = String(args.hoy || hoy || hoyLocal());
  if (!FECHA.test(h)) throw new Error('--hoy debe ser YYYY-MM-DD');
  const log = (s) => stderr.write(s + '\n');
  log(`dashboard: leyendo ${hq}`);
  const datos = armarDatos(hq, { hoy: h, readImpl: rd, existsImpl: ex });
  const html = inyectar(leerPlantilla(), datos);
  mkdirSync(dirname(out), { recursive: true });
  const tmp = join(dirname(out), `.${basename(out)}.${process.pid}.${Date.now().toString(36)}.tmp`);
  try {
    writeImpl(tmp, html, { flag: 'wx' });
    renameImpl(tmp, out);
  } finally {
    try { unlinkSync(tmp); } catch (_) { /* ya renombrado */ }
  }
  const s = datos.stats;
  const r = { ...datos, hq: resolve(hq), salida: out };
  if (args.json) stdout.write(JSON.stringify(r, null, 2) + '\n');
  else stdout.write(`${out} · vencidos ${s.vencidos} · hoy ${s.hoy} · obras 🔴 ${s.obrasRojas} · decisiones ${s.decisiones} · alertas ${s.alertas} · tratos ${s.tratos}\n`);
  return r;
}

const esPrincipal = (() => { try { return import.meta.url === pathToFileURL(process.argv[1]).href; } catch (_) { return false; } })();
if (esPrincipal) {
  run(process.argv.slice(2)).catch((e) => { process.stderr.write('dashboard: ' + e.message + '\n'); process.exit(1); });
}
