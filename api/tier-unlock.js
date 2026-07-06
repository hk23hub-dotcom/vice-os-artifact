// HK23 Universe — tier subscription verification against Gumroad (piece 3).
// The buyer purchases Premium/Full on Gumroad and pastes their license key;
// we verify server-side (source of truth = Gumroad), so tiers can't be faked.
// While a permalink is 'PENDING' that tier simply isn't purchasable yet and
// the client keeps today's behavior.
const PERMALINKS = {
  premium: process.env.GUMROAD_PREMIUM_PERMALINK || 'PENDING',
  full: process.env.GUMROAD_FULL_PERMALINK || 'PENDING',
  // universe templates — one-time products, replicables al tiro
  template_hk23: process.env.GUMROAD_TEMPLATE_HK23_PERMALINK || 'PENDING',
  template_genesis: process.env.GUMROAD_TEMPLATE_GENESIS_PERMALINK || 'PENDING',
};

const SB_URL = process.env.SUPABASE_URL || 'https://iiqhhglgjsbnuihythko.supabase.co';
const SB_ANON = process.env.SUPABASE_ANON_KEY || 'sb_publishable_IAeknohtaw-n9fAgh7Zxlg_K9VN-kcM';
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// If we have the service key AND a real session, persist the verified tier
// into the user's metadata server-side (client can't forge it).
async function saveTierToAccount(req, tier) {
  if (!SB_SERVICE) return false;
  const auth = req.headers['authorization'] || '';
  if (!auth.startsWith('Bearer ')) return false;
  try {
    const r = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SB_ANON, authorization: auth } });
    if (!r.ok) return false;
    const u = await r.json();
    if (!u || !u.id) return false;
    const upd = await fetch(SB_URL + '/auth/v1/admin/users/' + u.id, {
      method: 'PUT',
      headers: { apikey: SB_SERVICE, authorization: 'Bearer ' + SB_SERVICE, 'content-type': 'application/json' },
      body: JSON.stringify({ user_metadata: { ...(u.user_metadata || {}), tier, tier_verified: true, tier_ts: Date.now() } }),
    });
    return upd.ok;
  } catch (_) { return false; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const tier = (body.tier || '').toString();
  const permalink = PERMALINKS[tier];
  if (!permalink) { res.status(400).json({ ok: false, error: 'tier inválido' }); return; }
  if (permalink === 'PENDING') { res.status(503).json({ ok: false, error: 'Este tier aún no está a la venta.' }); return; }

  const key = (body.license_key || '').toString().trim();
  if (!key || key.length < 8) { res.status(400).json({ ok: false, error: 'license key inválida' }); return; }

  try {
    const form = new URLSearchParams();
    form.set('product_permalink', permalink);
    form.set('license_key', key);
    form.set('increment_uses_count', body.first ? 'true' : 'false');
    const r = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.success) { res.status(200).json({ ok: false, error: 'License key no válida para este tier.' }); return; }
    const p = j.purchase || {};
    if (p.refunded || p.chargebacked || p.disputed) { res.status(200).json({ ok: false, error: 'Esta compra fue reembolsada o disputada.' }); return; }
    if (p.subscription_cancelled_at || p.subscription_failed_at) { res.status(200).json({ ok: false, error: 'Esta suscripción está cancelada o con pago fallido.' }); return; }
    // only real tiers persist to the account — templates are products, not access levels
    const savedToAccount = (tier === 'premium' || tier === 'full') ? await saveTierToAccount(req, tier) : false;
    res.status(200).json({ ok: true, tier, savedToAccount, uses: j.uses ?? null, email: p.email || null, sale_ts: p.sale_timestamp || null });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'No se pudo verificar ahora — probá de nuevo.' });
  }
}
