// El Centro — abre una sesión para quien va a usar algo (no por cada visita).
// Tope persistente de sesiones nuevas por conexión y día, para que no se fabriquen usos gratis en serie.
import { applyCors, clientIp } from './_lib.js';
import { db, dbListo } from './_centro-db.js';
import { nuevaSesion, sesionLista, idDeIp } from './_centro-sesion.js';

const POR_IP = parseInt(process.env.CENTRO_SESIONES_IP || '20', 10);

export default async function handler(req, res) {
  applyCors(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  if (!dbListo() || !sesionLista()) { res.status(503).json({ error: 'El Centro todavía no está conectado.', code: 'sin_conexion' }); return; }
  try {
    const q = await db.rpc('centro_consumir', { p_persona: idDeIp(clientIp(req)), p_plan: 'ip_sesion', p_tope: POR_IP, p_periodo_dias: 1 });
    if (q < 0) { res.status(429).json({ error: 'Demasiadas sesiones nuevas desde esta conexión hoy. Vuelve mañana.', code: 'rate_limited' }); return; }
  } catch (_) { res.status(502).json({ error: 'No se pudo abrir tu sesión. Inténtalo de nuevo.' }); return; }
  const s = nuevaSesion();
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ ok: true, token: s.token });
}
