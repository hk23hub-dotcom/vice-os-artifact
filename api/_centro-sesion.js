// El Centro — sesiones propias, firmadas por el servidor.
// NO usa el login anónimo de Supabase: ese proyecto es el mismo de ViceGolfer, y activar anónimos
// le daría a cualquiera una cuenta "authenticated" con acceso a las APIs pagadas de ViceGolfer.
// La llave sale de CENTRO_SESION_SECRET o, si no existe, se deriva de la service role (nunca sale del servidor).
import crypto from 'node:crypto';

const secreto = () => process.env.CENTRO_SESION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
let cache = null;
function llave() {
  const s = secreto();
  if (!cache || cache.s !== s) cache = { s, k: crypto.createHmac('sha256', s).update('el-centro/sesion/v1').digest() };
  return cache.k;
}
export function firmar(txt) { return crypto.createHmac('sha256', llave()).update(String(txt)).digest('base64url'); }
function igual(a, b) { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }

export function sesionLista() { return !!secreto(); }
export function nuevaSesion() {
  const id = crypto.randomUUID();
  return { id, token: 'c1.' + id + '.' + firmar('s:' + id) };
}

/* Authorization: Bearer c1.<uuid>.<firma> → { id } o null */
export async function usuario(req) {
  if (!secreto()) return null;
  const m = String((req.headers && req.headers.authorization) || '').match(/^Bearer c1\.([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/);
  if (!m || !igual(m[2], firmar('s:' + m[1]))) return null;
  return { id: m[1], anon: true };
}

/* la IP nunca se guarda: se convierte en un id opaco para llevar topes diarios persistentes por conexión */
export function idDeIp(ip) {
  const h = crypto.createHmac('sha256', llave()).update('ip:' + String(ip || 'x')).digest('hex');
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-8' + h.slice(17, 20) + '-' + h.slice(20, 32);
}

/* cada respuesta del agente va firmada: el navegador no puede inventar lo que "dijo" el agente */
export function firmaTurno(persona, agente, texto) { return firmar('t:' + persona + ':' + agente + ':' + texto).slice(0, 32); }
export function turnoValido(persona, agente, texto, firma) { return typeof firma === 'string' && igual(firma, firmaTurno(persona, agente, texto)); }
