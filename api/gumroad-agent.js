// HK23 — GUMROAD AGENT: se hace cargo de la tienda desde adentro del universo.
// Lee ventas/productos vía la API de Gumroad y devuelve un resumen para el
// Mission Control (CÓDICE → AGENTES). Dormido hasta setear GUMROAD_ACCESS_TOKEN
// (Gumroad → Settings → Advanced → Applications → create token).
const TOKEN = process.env.GUMROAD_ACCESS_TOKEN || '';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  if (req.method !== 'GET') { res.status(405).json({ error: 'GET only' }); return; }
  if (!TOKEN) { res.status(200).json({ ok: false, dormant: true, error: 'Agente dormido — falta GUMROAD_ACCESS_TOKEN en Vercel.' }); return; }

  try {
    const [prodR, salesR] = await Promise.all([
      fetch('https://api.gumroad.com/v2/products?access_token=' + encodeURIComponent(TOKEN)),
      fetch('https://api.gumroad.com/v2/sales?access_token=' + encodeURIComponent(TOKEN)),
    ]);
    const prodJ = await prodR.json().catch(() => ({}));
    const salesJ = await salesR.json().catch(() => ({}));
    if (!prodJ.success) { res.status(200).json({ ok: false, error: 'Gumroad rechazó el token.' }); return; }

    const products = (prodJ.products || []).map(p => ({
      name: p.name, permalink: p.custom_permalink || p.short_url, published: !!p.published,
      price: p.formatted_price || null, sales_count: p.sales_count ?? 0, revenue_usd: p.sales_usd_cents != null ? p.sales_usd_cents / 100 : null,
    }));
    const sales = (salesJ.sales || []).slice(0, 10).map(s => ({
      product: s.product_name, price_usd: s.price != null ? s.price / 100 : null, at: s.created_at, email_masked: (s.email || '').replace(/^(..).*(@.*)$/, '$1***$2'),
    }));
    const totalRevenue = products.reduce((a, p) => a + (p.revenue_usd || 0), 0);
    const totalSales = products.reduce((a, p) => a + (p.sales_count || 0), 0);
    res.status(200).json({ ok: true, totalSales, totalRevenue, products, recentSales: sales, at: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'No pude hablar con Gumroad — probá de nuevo.' });
  }
}
