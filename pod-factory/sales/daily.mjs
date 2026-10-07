// daily.mjs — el ciclo diario del agente vendedor.
// normaliza → matchea → compone → deja la cola del día en out/ para aprobación.
//
// ESTE AGENTE NO ENVÍA NADA. Nunca. La cola se revisa y se envía a mano.
import fs from 'node:fs';
import path from 'node:path';
import { PATHS, today, writeJSON, readJSON, ESTADOS } from './lib.mjs';
import { normalize, guardar } from './normalize.mjs';
import { componerLote } from './compose.mjs';

const TOPE_DEFAULT = 15;

function args(argv) {
  const o = { limite: TOPE_DEFAULT, fecha: today(), send: false, seco: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--send') o.send = true;
    else if (a === '--dry-run' || a === '--seco') o.seco = true;
    else if (a === '--limit' || a === '--tope') o.limite = parseInt(argv[++i], 10);
    else if (a.startsWith('--limit=') || a.startsWith('--tope=')) o.limite = parseInt(a.split('=')[1], 10);
    else if (a === '--fecha') o.fecha = argv[++i];
    else if (a.startsWith('--fecha=')) o.fecha = a.split('=')[1];
  }
  if (!Number.isFinite(o.limite) || o.limite < 1) o.limite = TOPE_DEFAULT;
  return o;
}

// ---- Portón de seguridad -------------------------------------------------
function portonEnvio() {
  console.error(`
NO SE ENVÍA NADA.

El flag --send está reconocido pero deliberadamente inhabilitado. Faltan dos
cosas, y ninguna de las dos la puede resolver este agente solo:

  1. CREDENCIAL. No hay proveedor de envío configurado en este repo (ni SMTP,
     ni API key de un proveedor transaccional). No existe en disco.
  2. APROBACIÓN EXPLÍCITA DEL DUEÑO, por cola y por lote.

Y la razón de fondo: el envío masivo automático de correo frío quema el dominio
y la cuenta del dueño. Una sola tanda mal mandada arruina la entregabilidad de
hk23 para siempre, y eso no se revierte.

El flujo correcto es:
  1. node daily.mjs              → deja la cola en out/outreach-<fecha>.md
  2. el dueño la lee y la corrige
  3. el dueño envía desde su propia cuenta, o aprueba por ~/hq/hq.sh execute
  4. node estado.mjs <lead> contactado   (o se edita data/leads.json a mano)
`.trim());
  process.exit(2);
}

function md({ fecha, piezas, listas, saltadas, resumen, notas, limite, productos }) {
  const L = [];
  L.push(`# Cola de venta — ${fecha}`);
  L.push('');
  L.push(`**Nada de esto se ha enviado.** Este archivo es una propuesta para revisión del dueño.`);
  L.push('');
  L.push(`- Leads en base: ${resumen.total} · tope del día: ${limite}`);
  L.push(`- Mensajes listos: ${listas.length}`);
  L.push(`- Saltados: ${saltadas.length}`);
  L.push(`- Productos publicados con URL real: ${productos.filter(p => p.url).length}/${productos.length}`);
  for (const n of notas) L.push(`- AVISO: ${n}`);
  L.push('');
  L.push('---');
  L.push('');

  listas.forEach((p, i) => {
    L.push(`## ${i + 1}. ${p.lead.empresa || p.lead.nombre}`);
    L.push('');
    L.push(`| | |`);
    L.push(`|---|---|`);
    L.push(`| Para | ${p.lead.nombre || '—'} <${p.email}> |`);
    L.push(`| Rubro | ${p.lead.rubro || '—'} |`);
    L.push(`| Dónde | ${[p.lead.ciudad, p.lead.pais].filter(Boolean).join(', ') || '—'} |`);
    L.push(`| Idioma | ${p.idioma} |`);
    L.push(`| Producto | \`${p.match.sku}\` (score ${p.match.score}) |`);
    L.push(`| URL | ${p.match.url} |`);
    L.push(`| Metadata | ${p.match.meta_source} |`);
    L.push(`| Gancho | ${p.ancla.tipo} |`);
    if (p.aviso.length) L.push(`| Avisos | ${p.aviso.join(' · ')} |`);
    L.push('');
    L.push(`**Por qué este producto:** ${p.match.razon}`);
    L.push('');
    L.push(`**Asunto:** ${p.mensaje.asunto}`);
    L.push('');
    L.push('```');
    L.push(p.mensaje.cuerpo);
    L.push('```');
    L.push(`_${p.mensaje.palabras} palabras_`);
    L.push('');
    L.push(`**Follow-up — enviar el ${p.followup.enviar_el}** · Asunto: ${p.followup.asunto}`);
    L.push('');
    L.push('```');
    L.push(p.followup.cuerpo);
    L.push('```');
    if (p.alternativas.length) {
      L.push('');
      L.push(`<details><summary>Alternativas descartadas</summary>`);
      L.push('');
      for (const a of p.alternativas) L.push(`- \`${a.sku}\` (score ${a.score}) — ${a.razon}`);
      L.push('');
      L.push('</details>');
    }
    L.push('');
    L.push('---');
    L.push('');
  });

  if (saltadas.length) {
    L.push('## Saltados (no entran en la cola)');
    L.push('');
    for (const p of saltadas) {
      L.push(`- **${p.lead.empresa || p.lead.nombre}** — ${p.aviso.join(' · ') || 'sin razón registrada'}`);
    }
    L.push('');
  }

  L.push('## Qué hacer con esto');
  L.push('');
  L.push('1. Lee los mensajes y corrige lo que suene mal.');
  L.push('2. Envíalos tú, desde tu cuenta. El agente no envía y `--send` está bloqueado a propósito.');
  L.push('3. Marca los que mandaste: `node estado.mjs <id-o-email> contactado`.');
  L.push('4. El follow-up es para 4 días después, no antes.');
  return L.join('\n');
}

export function correrDia(opts = {}) {
  const o = { limite: TOPE_DEFAULT, fecha: today(), ...opts };
  const { store, resumen } = normalize();

  // Solo se encolan leads nuevos, con email. Nunca se recontacta desde acá.
  const candidatos = Object.values(store.leads)
    .filter(l => l.estado === 'nuevo' && l.email)
    .sort((a, b) => String(a.primera_vez).localeCompare(String(b.primera_vez)) || a.id.localeCompare(b.id));

  const tanda = candidatos.slice(0, o.limite);
  const { piezas, productos, notas } = componerLote(tanda, { fecha: o.fecha });
  const listas = piezas.filter(p => p.listo);
  const saltadas = piezas.filter(p => !p.listo);

  // Los leads sin email nunca llegan a componerLote: se reportan igual.
  const sinEmail = Object.values(store.leads).filter(l => l.estado === 'nuevo' && !l.email)
    .map(l => ({ lead: { id: l.id, nombre: l.nombre, empresa: l.empresa, rubro: l.rubro }, aviso: ['sin email: LeadHunter no trajo correo'] }));
  const saltadasTodas = [...saltadas, ...sinEmail];

  // Si ya se corrió hoy, la cola del día se ACUMULA. Nunca se pisa lo ya
  // revisado por el dueño con una corrida vacía.
  const jsonFile = path.join(PATHS.out, `outreach-${o.fecha}.json`);
  const previa = readJSON(jsonFile, null);
  const yaEnCola = new Set((previa?.mensajes || []).map(m => m.lead_id));
  const mensajes = [...(previa?.mensajes || []), ...listas.filter(p => !yaEnCola.has(p.lead_id))];

  const cola = {
    fecha: o.fecha,
    generado: new Date().toISOString(),
    enviado: false,
    aviso: 'Cola propuesta. Nada fue enviado. El agente vendedor no envía correo.',
    tope: o.limite,
    candidatos: candidatos.length,
    productos_con_url: productos.filter(p => p.url).length,
    productos_totales: productos.length,
    notas,
    mensajes,
    saltados: saltadasTodas,
  };

  if (!o.seco) {
    const mdFile = path.join(PATHS.out, `outreach-${o.fecha}.md`);
    writeJSON(jsonFile, cola);
    const texto = md({ fecha: o.fecha, piezas, listas: mensajes, saltadas: saltadasTodas, resumen, notas, limite: o.limite, productos });
    fs.mkdirSync(PATHS.out, { recursive: true });
    fs.writeFileSync(mdFile, texto + '\n', 'utf8');

    // Marcar encolado SOLO lo que quedó realmente listo.
    for (const p of listas) {
      const l = store.leads[p.lead_id];
      if (!l) continue;
      l.estado = 'encolado';
      l.historial = [...(l.historial || []), { fecha: o.fecha, evento: 'encolado', sku: p.match.sku, asunto: p.mensaje.asunto }];
    }
    guardar(store);
  }

  return { cola, listas, enCola: cola.mensajes, saltadas: saltadasTodas, resumen, productos, notas, candidatos: candidatos.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const o = args(process.argv);
  if (o.send) portonEnvio();
  const r = correrDia(o);
  console.log(`daily ${o.fecha} — tope ${o.limite}`);
  console.log(`leads en base ${r.resumen.total} · candidatos nuevos con email ${r.candidatos}`);
  for (const n of r.notas) console.log(`  ! ${n}`);
  console.log(`encolados ahora ${r.listas.length} · total en la cola de hoy ${r.enCola.length} · saltados ${r.saltadas.length}`);
  for (const p of r.listas) console.log(`  → ${(p.lead.empresa || p.lead.nombre).padEnd(26)} ${p.match.sku.padEnd(22)} ${p.idioma}  score ${p.match.score}`);
  for (const p of r.saltadas) console.log(`  · saltado: ${(p.lead.empresa || p.lead.nombre)} — ${p.aviso.join(' · ')}`);
  console.log(`\n→ out/outreach-${o.fecha}.json`);
  console.log(`→ out/outreach-${o.fecha}.md   (revisar antes de mandar nada)`);
  console.log(`\nNada fue enviado. Eso es a propósito.`);
}
