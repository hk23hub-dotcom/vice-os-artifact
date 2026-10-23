// Guías interactivas HK23 — desbloquea la parte paga de una guía.
// Verifica la compra contra Gumroad (fuente de verdad) o, mientras no exista el producto, contra un código de la casa
// (GUIAS_CODIGO). Devuelve las plantillas de api/_guias.js; el navegador las guarda junto con la key y no vuelve a
// pedirlas. Solo la primera activación (nueva:true) consume un asiento de la license key.
import { parseBody, applyCors, clientIp, rateLimit, maskEmail } from './_lib.js';
import { guiaPaga } from './_guias.js';

const PERMALINKS = {
  'gerente-general': process.env.GUMROAD_GUIA_GG_PERMALINK || 'PENDING',
};
const MAX_SEATS = parseInt(process.env.GUMROAD_GUIA_MAX_SEATS || process.env.GUMROAD_MAX_SEATS || '5', 10);
const CODIGO = process.env.GUIAS_CODIGO || '';

/* decide con la respuesta de Gumroad ya parseada; puro para poder probarlo */
export function evaluarLicencia(j, { maxSeats = MAX_SEATS } = {}) {
  if (!j || !j.success) return { ok: false, error: 'License key no válida para esta guía.' };
  const p = j.purchase || {};
  if (p.refunded || p.chargebacked || p.disputed) return { ok: false, error: 'Esta compra fue reembolsada o disputada.' };
  if (typeof j.uses === 'number' && j.uses > maxSeats) return { ok: false, error: `Esta license key ya se usó en ${maxSeats} dispositivos.` };
  return { ok: true, uses: j.uses ?? null, email: maskEmail(p.email) };
}

export default async function handler(req, res) {
  applyCors(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  // GET ?guia=<id> → estado de venta, sin gastar intentos ni asientos: la página decide si muestra precio o "próximamente"
  if (req.method === 'GET') {
    const g = String((req.query && req.query.guia) || '');
    const existe = !!guiaPaga(g);
    const pl = PERMALINKS[g];
    res.setHeader('Cache-Control', 'no-store');
    res.status(existe ? 200 : 404).json({ ok: existe, venta: !!pl && pl !== 'PENDING', codigo: !!CODIGO, version: existe ? guiaPaga(g).version || 1 : null });
    return;
  }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'GET o POST' }); return; }
  if (!rateLimit('gu:' + clientIp(req), 12, 10 * 60 * 1000)) { res.status(429).json({ ok: false, error: 'Demasiados intentos. Espera unos minutos.' }); return; }

  const parsed = parseBody(req);
  if (!parsed.ok) { res.status(400).json({ ok: false, error: 'JSON inválido' }); return; }
  const id = String(parsed.body.guia || '');
  const guia = guiaPaga(id);
  if (!guia) { res.status(400).json({ ok: false, error: 'guía desconocida' }); return; }
  const key = String(parsed.body.license_key || '').trim();
  const nueva = parsed.body.nueva === true;
  res.setHeader('Cache-Control', 'no-store');

  // código de la casa: para probar la guía antes de publicar el producto (o regalos)
  if (CODIGO && key && key === CODIGO) { res.status(200).json({ ok: true, via: 'codigo', version: guia.version || 1, salida: guia.salida }); return; }

  const permalink = PERMALINKS[id];
  if (!permalink || permalink === 'PENDING') { res.status(503).json({ ok: false, code: 'pending', error: 'Esta guía aún no está a la venta.' }); return; }
  if (key.length < 8) { res.status(400).json({ ok: false, error: 'license key inválida' }); return; }

  try {
    const form = new URLSearchParams();
    form.set('product_permalink', permalink);
    form.set('license_key', key);
    form.set('increment_uses_count', nueva ? 'true' : 'false'); // solo la activación consume asiento (lo decide el cliente: el tope de 5 es orientativo, las plantillas igual quedan en su navegador)
    const r = await fetch('https://api.gumroad.com/v2/licenses/verify', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form.toString() });
    const j = await r.json().catch(() => ({}));
    const ev = evaluarLicencia(r.ok ? j : null);
    if (!ev.ok) { res.status(200).json({ ok: false, error: ev.error }); return; }
    res.status(200).json({ ok: true, via: 'gumroad', uses: ev.uses, maxSeats: MAX_SEATS, email: ev.email, version: guia.version || 1, salida: guia.salida });
  } catch (_) {
    res.status(500).json({ ok: false, error: 'No se pudo verificar ahora. Prueba de nuevo en un minuto.' });
  }
}
