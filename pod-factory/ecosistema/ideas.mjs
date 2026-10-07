#!/usr/bin/env node
/**
 * LABORATORIO · POD FACTORY
 * Mira el estado real de la fábrica y propone mejoras al mundo.
 *
 * Regla única: una idea solo existe si nombra QUÉ TOCA — un archivo o un comando.
 * Si no se puede implementar, no es idea. Factibilidad la descarta sin culpa.
 *
 * Las ideas viven en ecosistema/ideas/ideas.json y no se pisan: cada una guarda
 * su estado (propuesta → factible → aprobada → implementada | descartada) y su historia.
 */
import { readJSON, writeOut, hoy, ROOT } from './lib.mjs';
import { estado as credEstado } from './credenciales.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const D = hoy();
const IDX = 'ecosistema/ideas/ideas.json';
const previas = readJSON(IDX, {});
const datos = readJSON('ecosistema/mundo/datos.json', {});
const cred = credEstado();

/* ---------- reglas: cada una mira un número real y propone algo ejecutable ---------- */
const reglas = [];

// economía de la oferta
if (datos.conURL > 0) reglas.push({
  id:'envio-vs-precio', area:'oferta',
  t:'Precio con envío incluido en vez de envío aparte',
  porque:'En el checkout el envío ($13,39) casi iguala al producto ($14,00). El sobresalto de envío es la primera causa de carrito abandonado.',
  toca:'Shopify → Envío y entrega · perfil de envío + markup en midjourney/publish-wave.mjs',
  esfuerzo:'medio', impacto:'alto',
});

if ((datos.catalogo || 0) > (datos.publicados || 0) * 5) reglas.push({
  id:'catalogo-dormido', area:'produccion',
  t:`Subir la ola diaria: hay ${datos.catalogo - datos.publicados} piezas sin publicar`,
  porque:'A 3 piezas por día, vaciar el catálogo toma más de un año. El arte ya está pagado y no genera nada mientras duerme.',
  toca:'daily.mjs --live --n <número> · o el cron de com.hk23.podfactory',
  esfuerzo:'bajo', impacto:'medio',
});

if (!datos.cola) reglas.push({
  id:'sin-cola-venta', area:'venta',
  t:'La tienda no tiene a quién ofrecerle',
  porque:`Hay ${datos.leads || 0} leads conocidos y cero cola armada. La fábrica produce hacia nadie.`,
  toca:'sales/leads-inbox/ · dejar un export de LeadHunter y correr node sales/daily.mjs',
  esfuerzo:'bajo', impacto:'alto',
});

if (!datos.ingresos) reglas.push({
  id:'caja-ciega', area:'medicion',
  t:'Caja no puede contar ingresos reales',
  porque:'Sin token de Admin API de Shopify, Caja reporta $0 aunque entre una venta. El parte no sabe si estás ganando.',
  toca:`Llave "Token de Admin API de Shopify" en el panel · ${cred.shopifyAdminToken?.donde || ''}`,
  esfuerzo:'bajo', impacto:'alto',
});

if (datos.sinCurar === 0 && datos.catalogo) reglas.push({
  id:'materia-prima', area:'entrada',
  t:'El inbox está vacío: la fábrica se queda sin arte nuevo',
  porque:'Todo lo ingresado ya está curado. Cuando se acabe el catálogo, la fábrica se apaga sola.',
  toca:'inbox/ · dejar .zip o carpetas y correr node intake.mjs --live',
  esfuerzo:'bajo', impacto:'medio',
});

reglas.push({
  id:'colecciones-tienda', area:'tienda',
  t:'Las colecciones temáticas no tienen vitrina propia',
  porque:'Cada pieza ya sale con su tag (NEON DRIVE, THIRD EYE, CREATURES…), pero si la tienda no arma colecciones automáticas, el visitante ve un muro plano.',
  toca:'storekit/apply-store.mjs · requiere el token de Admin API',
  esfuerzo:'medio', impacto:'medio',
});

/* ---------- factibilidad: sin "toca", no pasa ---------- */
const ideas = {};
for (const r of reglas) {
  const prev = previas[r.id] || {};
  const factible = Boolean(r.toca && r.toca.trim());
  ideas[r.id] = {
    ...r,
    estado: prev.estado && prev.estado !== 'propuesta' ? prev.estado : (factible ? 'factible' : 'descartada'),
    motivo_descarte: factible ? null : 'no nombra qué toca',
    vista: prev.vista || D,
    ultima: D,
    historia: [...(prev.historia || []), ...(prev.ultima === D ? [] : [`${D} · revisada`])].slice(-12),
  };
}
// las que ya no aplican: se archivan, no se borran
for (const [id, v] of Object.entries(previas)) {
  if (!ideas[id]) ideas[id] = { ...v, estado: v.estado === 'implementada' ? 'implementada' : 'resuelta', ultima: D };
}

writeOut(IDX, JSON.stringify(ideas, null, 2));

const vivas = Object.values(ideas).filter(i => ['factible','aprobada'].includes(i.estado));
console.log(`\nLABORATORIO · ${D}`);
console.log(`  ideas vivas: ${vivas.length} · implementadas: ${Object.values(ideas).filter(i=>i.estado==='implementada').length} · archivadas: ${Object.values(ideas).filter(i=>['resuelta','descartada'].includes(i.estado)).length}\n`);
for (const i of vivas.sort((a,b)=> (b.impacto==='alto') - (a.impacto==='alto'))) {
  console.log(`· [${i.impacto}/${i.esfuerzo}] ${i.t}`);
  console.log(`    ${i.porque}`);
  console.log(`    toca: ${i.toca}\n`);
}
console.log(`→ ${IDX}`);
