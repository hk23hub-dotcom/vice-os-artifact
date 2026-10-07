#!/usr/bin/env node
/**
 * PARTE DEL DÍA · POD FACTORY
 * Lee el estado real de la fábrica, actualiza la memoria de cada agente y deja
 * un parte de como máximo 3 aprobaciones y 1 tarea humana.
 * No toca red. No envía nada. No publica nada.
 */
import { ROOT, hoy, readJSON, readText, listDir, writeOut, appendMemoria, reparto } from './lib.mjs';
import { estado as credEstado, faltantes } from './credenciales.mjs';

const D = hoy();
const R = reparto();

/* ---------- fuentes de verdad ---------- */
const catalogo  = readJSON('midjourney/data/catalog.json', { counts:{}, items:[] });
const printify  = readJSON('data/printify-ledger.json', {});
const mjLedger  = readJSON('midjourney/data/mj-ledger.json', {});
const libreria  = readJSON('library/library.json', { items:{}, hashes:{} });
const bloqueos  = readJSON('data/ledger.json', {});
const parteHoy  = readText(`reports/${D}.md`);
// el preflight en vivo manda sobre el reporte de la mañana, que puede estar viejo
const preflight = readText('ecosistema/estado-tienda.txt');
const colaHoy   = readJSON(`sales/out/outreach-${D}.json`, null);
const leads     = readJSON('sales/data/leads.json', {});
const inbox     = listDir('inbox').filter(f => !f.startsWith('.'));

const items      = Array.isArray(catalogo.items) ? catalogo.items : [];
// la fábrica lleva dos ledgers: stickers/posters por Printify y la ola MidJourney
const publicados = [
  ...Object.values(printify).map(p => ({ url: p?.external?.handle || null, fecha: (p.created||'').slice(0,10) })),
  ...Object.values(mjLedger).map(p => ({ url: p?.url || null,             fecha: (p.created_at||'').slice(0,10) }))
];
const conURL = publicados.filter(p => p.url);
const hoyPub = publicados.filter(p => p.fecha === D);
const sinCurar   = Object.keys(libreria.items || {}).length;
const fuenteTienda  = preflight.trim() ? preflight : parteHoy;
const dominio   = (fuenteTienda.match(/\(([a-z0-9-]+\.myshopify\.com)\)/i) || [])[1] || null;
const tiendaUrl = dominio ? `https://${dominio}` : null;
const adminUrl  = dominio ? `https://admin.shopify.com/store/${dominio.split('.')[0]}` : null;
const tiendaCerrada = /tienda con password/i.test(fuenteTienda);

// data/ledger.json escribe blocked_by hardcodeado, sin comprobar nada.
// Un bloqueo solo cuenta si la credencial REALMENTE falta.
const CRED = credEstado();
const MAPA = { 'printify token':'printifyToken', 'shopify admin token':'shopifyAdminToken', 'supabase service key':'supabaseServiceKey' };
const bloqueadoPor = new Set();
Object.values(bloqueos).forEach(b => (b?.blocked_by || []).forEach(x => {
  const id = MAPA[String(x).toLowerCase()];
  if (!id || !CRED[id]?.presente) bloqueadoPor.add(x);
}));
const faltanReq = faltantes();

const cand  = colaHoy?.candidatos;
const colaN = Array.isArray(cand) ? cand.length : (typeof cand === 'number' ? cand : 0);
const colaEnviada = colaHoy?.enviado === true;
const leadsN = Array.isArray(leads) ? leads.length
             : Array.isArray(leads.items) ? leads.items.length
             : Object.keys(leads.leads || leads || {}).length;

/* ---------- qué hizo hoy cada uno ---------- */
const E = {};
E.INT = inbox.length
  ? { estado:'ok', titular:`${inbox.length} cosa(s) esperando en el inbox`, detalle:'Hay material nuevo para ingresar en la próxima corrida.', n:{ inbox: inbox.length } }
  : { estado:'espera', titular:'Inbox vacío', detalle:'Sin colecciones nuevas. Deja .zip o carpetas en inbox/ y las ingresa solo.', n:{ inbox:0 } };

E.CUR = sinCurar
  ? { estado:'ok', titular:`${sinCurar} pieza(s) esperando curaduría`, detalle:'Nada de esto entra al catálogo hasta que se cure.', n:{ sinCurar } }
  : { estado:'espera', titular:'Nada pendiente de curar', detalle:'Todo lo ingresado ya pasó por curaduría.', n:{ sinCurar:0 } };

E.CAT = { estado:'ok',
  titular:`${items.length} piezas publicables en catálogo`,
  detalle:`Con metadata y dimensiones verificadas. ${catalogo.counts?.duplicates ?? catalogo.duplicates?.length ?? 0} duplicados descartados.`,
  n:{ catalogo: items.length } };

E.PRO = { estado: hoyPub.length ? 'ok' : 'espera',
  titular: hoyPub.length ? `${hoyPub.length} producto(s) producidos hoy` : 'Sin producción hoy',
  detalle: `${publicados.length} productos creados en total entre los dos ledgers (Printify + ola MidJourney).`,
  n:{ hoy: hoyPub.length, total: publicados.length } };

E.TDA = { estado: tiendaCerrada ? 'bloqueado' : (conURL.length ? 'ok' : 'espera'),
  titular: tiendaCerrada ? 'La tienda está cerrada con contraseña' : `${conURL.length} productos con URL real`,
  detalle: tiendaCerrada
    ? `Hay ${conURL.length} productos publicados con URL real, pero nadie puede entrar a comprarlos.`
    : 'Vitrina abierta. Los productos son alcanzables.',
  n:{ conURL: conURL.length, cerrada: tiendaCerrada ? 1 : 0 } };

E.VEN = colaN
  ? { estado: colaEnviada ? 'ok' : 'espera', titular:`${colaN} mensaje(s) en la cola de venta`, detalle:'Escritos y esperando tu OK. El vendedor nunca envía solo.', n:{ cola: colaN, leads: leadsN } }
  : { estado:'espera', titular:'Sin cola de venta hoy', detalle:`${leadsN} lead(s) conocidos. Deja un export de LeadHunter en sales/leads-inbox/ para armar cola.`, n:{ cola:0, leads: leadsN } };

E.CEN = { estado: tiendaCerrada ? 'bloqueado' : 'ok',
  titular: tiendaCerrada ? 'Dirigiendo una fábrica con la puerta cerrada' : 'Consolidando el parte',
  detalle: `Leyó a los siete. ${hoyPub.length} producido(s) hoy, ${conURL.length} productos alcanzables, ${colaN} mensaje(s) en cola.`,
  n:{ agentes: 8, aprobaciones: 0 } };

E.CAJ = { estado: tiendaCerrada ? 'bloqueado' : 'espera',
  titular: tiendaCerrada ? 'No puede entrar un peso' : 'Sin ingresos registrados',
  detalle: tiendaCerrada
    ? 'La tienda no acepta visitas, así que no hay ninguna venta posible que contar.'
    : 'Falta conectar la fuente de órdenes para contar ingresos reales.',
  n:{ ingresos: 0, credenciales: Object.values(CRED).filter(c=>c.presente).length } };

/* ---------- aprobaciones (máximo 3) ---------- */
const candidatas = [];
if (colaN && !colaEnviada) candidatas.push({
  t:`Enviar ${colaN} mensaje(s) de la cola de venta`,
  d:'El vendedor los dejó escritos con el producto que calza y la URL real. No salen sin tu sí.',
  r:`sales/out/outreach-${D}.md`, peso: tiendaCerrada ? 1 : 9 });

if (items.length > publicados.length) candidatas.push({
  t:`Publicar la ola de mañana (${Math.min(3, items.length - publicados.length)} piezas)`,
  d:`Quedan ${items.length - publicados.length} piezas de catálogo sin producir. La ola rota por colección.`,
  r:'node daily.mjs --live', peso: 6 });

if (sinCurar) candidatas.push({
  t:`Curar ${sinCurar} pieza(s) nuevas`,
  d:'Sin curaduría no entran al catálogo y la fábrica se queda sin materia prima.',
  r:'library/', peso: 5 });

if (bloqueadoPor.size) candidatas.push({
  t:`Destrabar: ${[...bloqueadoPor].join(' · ')}`,
  d:'Hay piezas detenidas esperando estas credenciales.',
  r:'data/ledger.json', peso: 4 });

const aprobaciones = candidatas.sort((a,b) => b.peso - a.peso).slice(0,3);

/* ---------- la única tarea humana ---------- */
const humanas = [];
if (tiendaCerrada) humanas.push({
  t:'Quitarle la contraseña a la tienda',
  d:`La fábrica publicó ${conURL.length} productos con URL real hacia una puerta cerrada. Online Store → Preferences → quitar protección por contraseña. Hasta que hagas esto, todo lo demás es decorado.` });
faltanReq.forEach(c => humanas.push({
  t:`Poner ${c.label}`,
  d:`${c.porque} Se pega desde el panel, campo "${c.label}". Dónde sacarla: ${c.donde}` }));
if (!colaN && !leadsN) humanas.push({ t:'Dejar un export de LeadHunter en sales/leads-inbox/', d:'Sin prospectos, el vendedor no tiene a quién ofrecerle.' });
const tareaHumana = humanas[0] || { t:'Nada. Hoy no te necesita.', d:'La fábrica corre sola.' };

/* ---------- memoria ---------- */
const aprendido = [];
if (tiendaCerrada) aprendido.push(['TDA', `- ${D} · La tienda seguía con contraseña. Producir más no sirve de nada mientras esto no se abra.`]);
if (!inbox.length)  aprendido.push(['INT', `- ${D} · Inbox vacío. La materia prima se agota si nadie deja colecciones nuevas.`]);
if (hoyPub.length)  aprendido.push(['PRO', `- ${D} · Producidos ${hoyPub.length}. Total acumulado ${publicados.length}.`]);
if (!colaN)         aprendido.push(['VEN', `- ${D} · Sin cola. ${leadsN} leads conocidos, insuficientes para armar ronda.`]);
aprendido.forEach(([c, l]) => appendMemoria(c, l));

/* ---------- escribir ---------- */
R.agentes.forEach(a => {
  const e = E[a.code] || { estado:'espera', titular:'—', detalle:'', n:{} };
  writeOut(`ecosistema/agentes/${a.code}/estado.json`,
    JSON.stringify({ fecha:D, code:a.code, nombre:a.nombre, ...e }, null, 2));
});

const linea = a => { const e = E[a.code]; const icono = e?.estado==='bloqueado' ? '🔴' : e?.estado==='ok' ? '🟢' : '⚪';
  return `| ${icono} | **${a.nombre}** | ${e?.titular ?? '—'} |`; };

const md = `# PARTE DEL DÍA · POD FACTORY · ${D}

## Necesita tu decisión — ${aprobaciones.length} aprobación(es)

${aprobaciones.length ? aprobaciones.map((x,i) =>
`**${i+1}. ${x.t}**
${x.d}
\`${x.r}\`
`).join('\n') : '_Nada que aprobar hoy._'}

## Tu única tarea humana

**${tareaHumana.t}**
${tareaHumana.d}

## La planta

| | Agente | Estado |
|---|---|---|
${R.agentes.map(linea).join('\n')}

## Números duros

- Catálogo publicable: **${items.length}** piezas
- Productos creados: **${publicados.length}** · con URL real: **${conURL.length}**
- Producidos hoy: **${hoyPub.length}**
- Esperando curaduría: **${sinCurar}**
- Cola de venta: **${colaN}** mensaje(s) · leads conocidos: **${leadsN}**
- Tienda: **${tiendaCerrada ? 'CERRADA con contraseña' : 'abierta'}**
- Ingresos registrados: **$0**

---
_Generado por \`ecosistema/parte.mjs\`. No envía, no publica, no cobra._
`;

writeOut(`ecosistema/partes/${D}.md`, md);
writeOut('ecosistema/mundo/datos.json', JSON.stringify({
  fecha:D, tiendaCerrada, catalogo: items.length, publicados: publicados.length,
  conURL: conURL.length, hoyPub: hoyPub.length, sinCurar, cola: colaN, leads: leadsN,
  ingresos: 0, aprobaciones, tareaHumana, credenciales: Object.values(CRED),
  tiendaUrl, adminUrl, dominio,
  agentes: R.agentes.map(a => ({ ...a, ...(E[a.code]||{}) }))
}, null, 2));

console.log(md);
console.log('→ escrito: ecosistema/partes/' + D + '.md');
