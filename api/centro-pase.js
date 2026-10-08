// El Centro — activa el "Pase 30 días" comprado en la tienda Shopify HK23 STUDIO.
// La persona escribe su número de pedido y el correo de la compra; se verifica contra la Admin API
// de Shopify (fuente de verdad), nunca contra lo que diga el navegador.
// Un pedido vale para una sesión a la vez; si la persona cambia de navegador, vuelve a activarlo y el pase
// se mueve con los usos que ya lleva (máximo una vez al día). Un reembolso o cancelación lo apaga.
import { parseBody, applyCors, clientIp } from './_lib.js';
import { db, dbListo } from './_centro-db.js';
import { usuario, idDeIp } from './_centro-sesion.js';

const DOMINIO = process.env.SHOPIFY_STORE_DOMAIN || 'fcqevq-jr.myshopify.com';
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN || '';
const VERSION = process.env.SHOPIFY_API_VERSION || '2026-07';
const HANDLE = process.env.CENTRO_PASE_HANDLE || 'pase-30-dias';
const INTENTOS_IP = parseInt(process.env.CENTRO_PASE_INTENTOS_IP || '15', 10);
const DIAS = 30, DIA = 86400000;

const CAMPOS = 'id name email createdAt cancelledAt displayFinancialStatus lineItems(first: 25) { nodes { quantity currentQuantity product { handle } } }';
const Q_BUSCAR = `query ($q: String!) { orders(first: 5, query: $q) { nodes { ${CAMPOS} } } }`;
const Q_ID = `query ($id: ID!) { order(id: $id) { ${CAMPOS} } }`;

async function gql(query, variables) {
  const r = await fetch('https://' + DOMINIO + '/admin/api/' + VERSION + '/graphql.json', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-shopify-access-token': TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.errors) { const e = new Error('shopify ' + r.status); e.code = 'shopify'; throw e; }
  return j.data || {};
}

export async function buscarPedido(numero, correo) {
  const d = await gql(Q_BUSCAR, { q: 'name:#' + numero });
  const nodos = (d.orders && d.orders.nodes) || [];
  // no se confía en la búsqueda: el nombre y el correo tienen que calzar exacto
  return nodos.find((o) => o.name === '#' + numero && String(o.email || '').toLowerCase() === correo) || null;
}

export function evaluarPedido(o, ahora) {
  const no = { ok: false, error: 'No encontramos un pase pagado y vigente con ese número y ese correo.' };
  if (!o) return no;
  if (o.cancelledAt) return { ok: false, error: 'Ese pedido está cancelado.' };
  if (o.displayFinancialStatus !== 'PAID') return { ok: false, error: 'Ese pedido todavía no figura como pagado.' };
  const items = ((o.lineItems && o.lineItems.nodes) || []).filter((l) => l.product && l.product.handle === HANDLE);
  // currentQuantity descuenta lo reembolsado o quitado del pedido
  const cant = items.reduce((s, l) => s + (l.currentQuantity == null ? (l.quantity || 0) : l.currentQuantity), 0);
  if (!cant) return { ok: false, error: 'Ese pedido no incluye el Pase El Centro.' };
  const vence = new Date(new Date(o.createdAt).getTime() + DIAS * cant * DIA);
  if (vence.getTime() <= ahora) return { ok: false, error: 'Ese pase ya venció.' };
  return { ok: true, vence: vence.toISOString() };
}

/* Revisa de nuevo el pedido una vez al día: si lo reembolsaron o cancelaron, el pase se apaga.
   Si Shopify no responde, el pase sigue (no se castiga a quien pagó por una caída ajena). */
export async function revisarPase(p) {
  if (!TOKEN || (p.revisado && Date.now() - new Date(p.revisado).getTime() < DIA)) return true;
  let ev;
  try { const d = await gql(Q_ID, { id: p.pedido }); ev = evaluarPedido(d.order || null, Date.now()); } catch (_) { return true; }
  const cambios = ev.ok ? { revisado: new Date().toISOString(), vence: ev.vence } : { revisado: new Date().toISOString(), vence: new Date().toISOString() };
  await db.update('centro_pases', 'pedido=eq.' + encodeURIComponent(p.pedido), cambios).catch(() => {});
  return ev.ok;
}

export default async function handler(req, res) {
  applyCors(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  if (!TOKEN || !dbListo()) { res.status(503).json({ error: 'La activación de pases todavía no está conectada.', code: 'sin_conexion' }); return; }

  const who = await usuario(req);
  if (!who) { res.status(401).json({ error: 'Tu sesión no es válida. Recarga la página.', code: 'sin_sesion' }); return; }

  const parsed = parseBody(req);
  if (!parsed.ok) { res.status(400).json({ error: 'JSON inválido' }); return; }
  const numero = String(parsed.body.pedido || '').replace(/[^0-9]/g, '').slice(0, 12);
  const correo = String(parsed.body.email || '').trim().toLowerCase().slice(0, 120);
  if (!numero || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { res.status(400).json({ error: 'Escribe el número de pedido y el correo de la compra.' }); return; }

  try {
    const q = await db.rpc('centro_consumir', { p_persona: idDeIp(clientIp(req)), p_plan: 'ip_pase', p_tope: INTENTOS_IP, p_periodo_dias: 1 });
    if (q < 0) { res.status(429).json({ error: 'Demasiados intentos desde esta conexión. Prueba mañana.' }); return; }
  } catch (_) { res.status(502).json({ error: 'No pudimos revisar el pedido ahora. Inténtalo en un rato.' }); return; }

  let o;
  try { o = await buscarPedido(numero, correo); } catch (_) { res.status(502).json({ error: 'No pudimos revisar el pedido ahora. Inténtalo en un rato.' }); return; }
  const ev = evaluarPedido(o, Date.now());
  if (!ev.ok) { res.status(200).json({ ok: false, error: ev.error }); return; }

  const ahora = new Date().toISOString();
  const pedido = 'pedido=eq.' + encodeURIComponent(o.id);
  try {
    const ya = (await db.select('centro_pases', 'select=persona,vence,movido&' + pedido + '&limit=1'))[0];
    if (ya && ya.persona === who.id) { res.status(200).json({ ok: true, vence: ev.vence }); return; }
    if (ya) {
      // mismo comprador en otro navegador: el pase se mueve con los usos que ya lleva
      if (ya.movido && Date.now() - new Date(ya.movido).getTime() < DIA) {
        res.status(409).json({ ok: false, error: 'Este pase se activó en otro navegador hace poco. Podrás moverlo de nuevo mañana.' }); return;
      }
      const cuota = (await db.select('centro_cuotas', 'select=desde,usados&persona=eq.' + ya.persona + '&plan=eq.pase&limit=1'))[0];
      if (cuota) await db.upsert('centro_cuotas', { persona: who.id, plan: 'pase', desde: cuota.desde, usados: cuota.usados });
      await db.update('centro_pases', pedido, { persona: who.id, movido: ahora, vence: ev.vence, revisado: ahora });
      res.status(200).json({ ok: true, vence: ev.vence, movido: true }); return;
    }
    // pedido nuevo: la cuota del pase parte de cero (quien agotó sus 300 y compra otro, sigue al tiro)
    await db.insert('centro_pases', { pedido: o.id, persona: who.id, vence: ev.vence, revisado: ahora });
    await db.upsert('centro_cuotas', { persona: who.id, plan: 'pase', desde: ahora, usados: 0 });
    res.status(200).json({ ok: true, vence: ev.vence });
  } catch (_) { res.status(502).json({ error: 'No se pudo guardar la activación. Inténtalo de nuevo.' }); }
}
