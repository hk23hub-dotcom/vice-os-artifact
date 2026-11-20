// HK23 — GUMROAD AGENT: resumen de la tienda (productos, ventas, ingresos) para el panel del dueño.
// Lee la API de Gumroad con GUMROAD_ACCESS_TOKEN (Gumroad → Settings → Advanced → Applications).
// Son datos del negocio: solo responde a quien manda la clave de administración en el header
// x-hk23-admin (GUMROAD_AGENT_ADMIN_TOKEN en Vercel, mínimo 24 caracteres). Sin esa clave el
// endpoint queda cerrado. Nunca devuelve correos de compradores, ni siquiera enmascarados.
import { rateLimit, clientIp } from './_lib.js';

const TOKEN = process.env.GUMROAD_ACCESS_TOKEN || '';
const ADMIN = process.env.GUMROAD_AGENT_ADMIN_TOKEN || '';

function igual(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!a || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') { res.status(405).json({ error: 'Solo GET.' }); return; }
  if (!rateLimit('gumroad-agent:' + clientIp(req), 20, 60 * 1000)) { res.status(429).json({ ok: false, error: 'Demasiadas solicitudes.' }); return; }
  if (ADMIN.length < 24 || !igual(req.headers['x-hk23-admin'], ADMIN)) { res.status(401).json({ ok: false, error: 'Clave de administración inválida.' }); return; }
  if (!TOKEN) { res.status(200).json({ ok: false, dormant: true, error: 'Agente dormido: falta GUMROAD_ACCESS_TOKEN en Vercel.' }); return; }

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
      product: s.product_name, price_usd: s.price != null ? s.price / 100 : null, at: s.created_at,
    }));
    const totalRevenue = products.reduce((a, p) => a + (p.revenue_usd || 0), 0);
    const totalSales = products.reduce((a, p) => a + (p.sales_count || 0), 0);
    res.status(200).json({ ok: true, totalSales, totalRevenue, products, recentSales: sales, at: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'No pude hablar con Gumroad. Prueba de nuevo.' });
  }
}
