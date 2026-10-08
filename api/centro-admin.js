// El Centro — panel del dueño: revisar postulaciones, aprobar o rechazar, volver a probar,
// y rendir la prueba de entrada de los agentes de la casa. Protegido con CENTRO_ADMIN_TOKEN
// (solo en el servidor, mínimo 24 caracteres; sin él, el panel queda cerrado).
import { parseBody, applyCors, rateLimit, clientIp } from './_lib.js';
import { CASA, OLA, canon, clean } from './_centro.js';
import { db, dbListo, idSeguro } from './_centro-db.js';
import { examinar } from './_centro-examen.js';

const TOKEN = process.env.CENTRO_ADMIN_TOKEN || '';
export const config = { maxDuration: 120 };

function igual(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!a || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function comunidad() {
  const v = await db.select('centro_agentes', 'select=id,nombre,mundo,que&bloque=eq.agentes&limit=1000');
  return (v || []).map((r) => ({ k: 'u' + r.id, n: r.nombre, c: canon(r.mundo), q: r.que }));
}

export default async function handler(req, res) {
  applyCors(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  if (!rateLimit('adm:' + clientIp(req), 30, 60 * 1000)) { res.status(429).json({ error: 'Demasiadas solicitudes.' }); return; }
  if (TOKEN.length < 24 || !igual(req.headers['x-centro-admin'], TOKEN)) { res.status(401).json({ error: 'Clave de administración inválida.' }); return; }
  if (!dbListo()) { res.status(503).json({ error: 'Falta conectar la base de datos.' }); return; }

  const parsed = parseBody(req);
  if (!parsed.ok) { res.status(400).json({ error: 'JSON inválido' }); return; }
  const { accion } = parsed.body;
  const id = idSeguro(parsed.body.id);

  try {
    if (accion === 'resumen') {
      const [rev, nop, ag, ex] = await Promise.all([
        db.select('centro_postulaciones', 'select=*&estado=eq.revision&order=creado.asc&limit=100'),
        db.select('centro_postulaciones', 'select=nombre,mundo,que,por,examen,creado&estado=eq.no_paso&order=creado.desc&limit=20'),
        db.select('centro_agentes', 'select=id&limit=1000'),
        db.select('centro_examenes', 'select=*&limit=1000'),
      ]);
      res.status(200).json({ ok: true, revision: rev, no_paso: nop, comunidad: (ag || []).length, casa: CASA.map((a) => ({ k: a.k, n: a.n, c: a.c, app: !!a.app })), examenes: ex });
      return;
    }
    if (accion === 'aprobar' || accion === 'rechazar' || accion === 'probar') {
      if (!id) { res.status(400).json({ error: 'Falta la postulación.' }); return; }
      const p = (await db.select('centro_postulaciones', 'select=*&id=eq.' + id + '&estado=eq.revision&limit=1'))[0];
      if (!p) { res.status(404).json({ error: 'Esa postulación ya no está en revisión.' }); return; }
      if (accion === 'probar') {
        const a = { k: 'rev', n: p.nombre, c: canon(p.mundo), f: p.forma, q: p.que, p: 'quien lo necesite', s: '', por: p.por };
        const r = await examinar(a, await comunidad());
        res.status(200).json({ ok: true, examen: r }); return;
      }
      if (accion === 'aprobar') {
        const vivos = await db.select('centro_agentes', 'select=id&bloque=eq.agentes&limit=' + (OLA.tam + 1));
        if (vivos && vivos.length >= OLA.tam) { res.status(409).json({ error: 'La ola ya está llena.' }); return; }
        // índice único por postulación: aprobar dos veces no duplica el agente
        await db.insert('centro_agentes', { nombre: p.nombre, mundo: canon(p.mundo), forma: p.forma, que: p.que, por: p.por, creador: p.creador, postulacion: p.id, examen: p.examen });
      }
      await db.update('centro_postulaciones', 'id=eq.' + id, { estado: accion === 'aprobar' ? 'aprobada' : 'rechazada', decidido: new Date().toISOString() });
      res.status(200).json({ ok: true }); return;
    }
    if (accion === 'examinar_casa') {
      const k = clean(parsed.body.k, 8);
      const a = CASA.find((x) => x.k === k);
      if (!a || a.app) { res.status(400).json({ error: 'Ese agente no rinde la prueba.' }); return; }
      const r = await examinar(a, await comunidad());
      await db.upsert('centro_examenes', { agente: a.k, aprobado: r.aprobado, puntaje: r.puntaje, falla: r.falla, motivo: r.motivo, creado: new Date().toISOString() });
      res.status(200).json({ ok: true, examen: r }); return;
    }
    res.status(400).json({ error: 'Acción desconocida.' });
  } catch (e) {
    res.status(502).json({ error: 'Falló: ' + String(e && e.message || e).slice(0, 160) });
  }
}
