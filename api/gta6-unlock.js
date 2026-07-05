// VICE.HUB PRO — server-side license verification against Gumroad.
// The buyer pastes the license key from their Gumroad receipt; we verify it
// here (source of truth = Gumroad's API), so the unlock can't be faked client-side.
const PERMALINK = process.env.GUMROAD_PERMALINK || 'luzaug'; // VICE.HUB PRO — Full Access (gumroad.com/l/luzaug)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  if (PERMALINK === 'PENDING') { res.status(503).json({ ok: false, error: 'La tienda aún no está conectada — falta el producto de Gumroad.' }); return; }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const key = (body.license_key || '').toString().trim();
  if (!key || key.length < 8) { res.status(400).json({ ok: false, error: 'license key inválida' }); return; }

  try {
    const form = new URLSearchParams();
    form.set('product_permalink', PERMALINK);
    form.set('license_key', key);
    form.set('increment_uses_count', body.first ? 'true' : 'false');
    const r = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.success) { res.status(200).json({ ok: false, error: 'License key no válida para este producto.' }); return; }
    const p = j.purchase || {};
    if (p.refunded || p.chargebacked || p.disputed) { res.status(200).json({ ok: false, error: 'Esta compra fue reembolsada o disputada.' }); return; }
    res.status(200).json({ ok: true, pro: true, uses: j.uses ?? null, email: p.email || null, sale_ts: p.sale_timestamp || null });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'No se pudo verificar ahora — probá de nuevo.' });
  }
}
