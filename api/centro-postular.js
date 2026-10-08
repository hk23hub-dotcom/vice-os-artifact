// El Centro — postular un agente. Gratis para quien postula; la prueba de entrada corre aquí,
// con la IA de El Centro, así que el resultado no se puede falsear desde el navegador.
// Topes: 3 postulaciones por persona al día, 6 por IP al día y un tope global diario de pruebas.
import { parseBody, applyCors, clientIp } from './_lib.js';
import { OLA, canon, clean } from './_centro.js';
import { db, dbListo, GLOBAL_EXAMENES } from './_centro-db.js';
import { usuario, idDeIp } from './_centro-sesion.js';
import { examinar, ayudaPara } from './_centro-examen.js';

const EXAMENES_DIA = parseInt(process.env.CENTRO_EXAMENES_DIA || '60', 10);
const POSTULAR_IP = parseInt(process.env.CENTRO_POSTULAR_IP || '6', 10);
const MUNDO_OK = /^[\p{L}\p{N} .&'-]{1,24}$/u;
export const config = { maxDuration: 120 };

export default async function handler(req, res) {
  applyCors(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  if (!dbListo()) { res.status(503).json({ error: 'Las postulaciones todavía no están conectadas.', code: 'sin_conexion' }); return; }

  const who = await usuario(req);
  if (!who) { res.status(401).json({ error: 'Tu sesión no es válida. Recarga la página.', code: 'sin_sesion' }); return; }

  const parsed = parseBody(req);
  if (!parsed.ok) { res.status(400).json({ error: 'JSON inválido' }); return; }
  const b = parsed.body;
  const a = {
    k: 'postulando', n: clean(b.nombre, 32), c: canon(b.mundo),
    f: ['caza', 'hace', 'acom'].includes(b.forma) ? b.forma : 'hace',
    q: clean(b.que, 140), p: 'quien lo necesite', s: '', por: clean(b.por, 40),
  };
  if (!a.n || !a.q || !clean(b.mundo, 24) || !a.por) { res.status(400).json({ error: 'Completa nombre, mundo, qué hace y tu nombre o @.' }); return; }
  if (!MUNDO_OK.test(clean(b.mundo, 24))) { res.status(400).json({ error: 'El mundo solo puede llevar letras, números y espacios.' }); return; }

  let comunidad = [];
  try {
    const desde = new Date(Date.now() - 86400000).toISOString();
    const [mias, vivos] = await Promise.all([
      db.select('centro_postulaciones', 'select=id&creador=eq.' + who.id + '&creado=gt.' + encodeURIComponent(desde) + '&limit=5'),
      db.select('centro_agentes', 'select=nombre,mundo,que&bloque=eq.agentes&limit=1000'),
    ]);
    if (mias && mias.length >= 3) { res.status(429).json({ error: 'Ya postulaste 3 veces hoy. Vuelve mañana.' }); return; }
    if (vivos && vivos.length >= OLA.tam) { res.status(409).json({ error: 'La ola se llenó. La siguiente abre pronto.' }); return; }
    const ipq = await db.rpc('centro_consumir', { p_persona: idDeIp(clientIp(req)), p_plan: 'ip_postular', p_tope: POSTULAR_IP, p_periodo_dias: 1 });
    if (ipq < 0) { res.status(429).json({ error: 'Muchas postulaciones desde esta conexión por hoy. Vuelve mañana.' }); return; }
    comunidad = (vivos || []).map((r) => ({ k: 'u', n: r.nombre, c: canon(r.mundo), q: r.que }));
    const g = await db.rpc('centro_consumir', { p_persona: GLOBAL_EXAMENES, p_plan: 'gratis', p_tope: EXAMENES_DIA, p_periodo_dias: 1 });
    if (g < 0) { res.status(429).json({ error: 'Por hoy se llenó la fila de pruebas de entrada. Vuelve mañana.' }); return; }
  } catch (_) { res.status(502).json({ error: 'No se pudo revisar la postulación. Inténtalo de nuevo.' }); return; }

  let r;
  try { r = await examinar(a, comunidad); } catch (_) { res.status(502).json({ error: 'La prueba se cortó. Inténtalo de nuevo.' }); return; }

  const fila = {
    nombre: a.n, mundo: a.c, forma: a.f, que: a.q, por: a.por, creador: who.id,
    estado: r.aprobado ? 'revision' : 'no_paso',
    examen: { aprobado: r.aprobado, puntaje: r.puntaje, falla: r.falla, motivo: r.motivo, criterios: r.criterios, ts: r.ts },
  };
  try { await db.insert('centro_postulaciones', fila); } catch (_) {
    if (r.aprobado) { res.status(502).json({ error: 'Pasó la prueba, pero no se pudo guardar la postulación. Inténtalo de nuevo.' }); return; }
  }
  if (r.aprobado) { res.status(200).json({ ok: true, aprobado: true, puntaje: r.puntaje, mundo: a.c }); return; }
  const ayuda = ayudaPara(a, r);
  res.status(200).json({ ok: true, aprobado: false, bloqueado: !ayuda, ayuda });
}
