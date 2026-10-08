// El Centro — acceso a Supabase para las funciones /api/centro-*.
// Escribe con la service role (solo existe en el servidor); las tablas centro_* no tienen
// políticas públicas, así que el navegador nunca las toca directo (ver supabase/migrations/0011).
const SB_URL = process.env.SUPABASE_URL || 'https://iiqhhglgjsbnuihythko.supabase.co';
const SB_ANON = process.env.SUPABASE_ANON_KEY || 'sb_publishable_IAeknohtaw-n9fAgh7Zxlg_K9VN-kcM';
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export function dbListo() { return !!SB_SERVICE; }

async function rest(path, { method = 'GET', body, prefer } = {}) {
  const headers = { apikey: SB_SERVICE, authorization: 'Bearer ' + SB_SERVICE, 'content-type': 'application/json' };
  if (prefer) headers.prefer = prefer;
  const r = await fetch(SB_URL + '/rest/v1/' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text();
  if (!r.ok) throw new Error('db ' + r.status + ' ' + t.slice(0, 200));
  return t ? JSON.parse(t) : null;
}

/* consultas mínimas en la sintaxis de PostgREST: filtros como 'estado=eq.revision&order=creado.desc' */
export const db = {
  select: (tabla, q) => rest(tabla + '?' + q),
  insert: (tabla, fila) => rest(tabla, { method: 'POST', body: fila, prefer: 'return=representation' }),
  update: (tabla, q, cambios) => rest(tabla + '?' + q, { method: 'PATCH', body: cambios, prefer: 'return=representation' }),
  upsert: (tabla, fila) => rest(tabla, { method: 'POST', body: fila, prefer: 'resolution=merge-duplicates,return=representation' }),
  rpc: (fn, args) => rest('rpc/' + fn, { method: 'POST', body: args }),
};

/* valor seguro para un filtro eq.: solo lo que puede traer un id o una clave de agente */
export function idSeguro(s) { return /^[A-Za-z0-9_-]{1,64}$/.test(String(s || '')) ? String(s) : null; }

/* sesión real de Supabase (anónima o con correo), verificada en el servidor */
export async function usuario(req) {
  const auth = req.headers['authorization'] || '';
  if (!auth.startsWith('Bearer ')) return null;
  try {
    const r = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SB_ANON, authorization: auth } });
    if (!r.ok) return null;
    const u = await r.json();
    if (!u || !u.id || !idSeguro(u.id)) return null;
    return { id: u.id, anon: !!u.is_anonymous, email: u.email || null };
  } catch (_) { return null; }
}

/* ids reservados para topes globales (no son personas): usos gratis por día y pruebas de entrada por día */
export const GLOBAL_GRATIS = '00000000-0000-0000-0000-00000000c0f1';
export const GLOBAL_EXAMENES = '00000000-0000-0000-0000-00000000c0e2';
