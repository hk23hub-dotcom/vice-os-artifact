// El Centro — lo que muestra el mapa: agentes (casa + comunidad), calor, sellos, ola y bloques.
// Público y sin sesión; se cachea 30 s en el borde.
import { applyCors } from './_lib.js';
import { BLOQUES, OLA, PLANES, CASA, canon } from './_centro.js';
import { db, dbListo } from './_centro-db.js';

export default async function handler(req, res) {
  applyCors(req, res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'GET only' }); return; }

  let comunidad = [], usos = {}, sellos = {}, conectado = dbListo();
  if (conectado) {
    try {
      const [ag, uso, ex] = await Promise.all([
        db.select('centro_agentes', 'select=id,nombre,mundo,forma,que,por,examen&bloque=eq.agentes&order=creado.asc&limit=1000'),
        db.select('centro_uso', 'select=agente,usos&limit=5000'),
        db.select('centro_examenes', 'select=agente&aprobado=eq.true&limit=5000'),
      ]);
      comunidad = (ag || []).map((r) => ({
        k: 'u' + r.id, n: r.nombre, c: canon(r.mundo), f: r.forma, q: r.que, s: '', por: r.por || 'anónimo', app: null,
        sello: !!(r.examen && r.examen.aprobado === true),
      }));
      (uso || []).forEach((u) => { usos[u.agente] = Number(u.usos) || 0; });
      (ex || []).forEach((e) => { sellos[e.agente] = true; });
    } catch (_) { conectado = false; }
  }
  const casa = CASA.map((a) => ({ k: a.k, n: a.n, c: a.c, f: a.f, q: a.q, s: a.s, por: a.por, app: a.app, sello: !!sellos[a.k] }));
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
  res.status(200).json({
    ok: true, conectado, bloques: BLOQUES, bloque: 'agentes',
    ola: { tam: OLA.tam, total: OLA.total, libres: Math.max(0, OLA.tam - comunidad.length) },
    agentes: casa.concat(comunidad), usos,
    planes: { gratis: PLANES.gratis.tope, pase: PLANES.pase.tope },
    pase: { url: process.env.CENTRO_PASE_URL || null, precio: process.env.CENTRO_PASE_PRECIO || 'US$9' },
  });
}
