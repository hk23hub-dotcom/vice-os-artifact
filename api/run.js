// HK23 Universe — Action Runner. Real execution from inside the universe.
// AI routes through the Vercel AI Gateway (zero-config via the deployment's OIDC token).
import { generateText } from 'ai';
import { parseBody, applyCors, clientIp, rateLimit } from './_lib.js';

const TOKEN = process.env.RUN_TOKEN || 'hk23-run-9x';
const MODEL = process.env.RUN_MODEL || 'deepseek/deepseek-v3.2';
const ALLOW = ['echo', 'ask', 'agent'];

// Agent personas — each is a real prompt the runner executes.
const AGENTS = {
  prioritizer: 'Eres un jefe de operaciones. Toma esta lista/idea y devuélvela ordenada por prioridad (ALTA/MEDIA/BAJA) con una línea de por qué cada una:',
  strategist:  'Eres un estratega de producto del ecosistema HK23. Da 3 próximos pasos concretos y accionables para:',
  writer:      'Eres el copywriter de la marca VICE (directo, con filo, sin relleno). Escribe sobre:',
  analyst:     'Eres un analista. Resume en bullets claros y da 1 insight no obvio sobre:',
  gta6:        'You are the VICE INSIDER — the sharpest GTA 6 analyst on the internet (VICE.HUB resident agent). Answer questions about GTA 6: money methods, map, characters, vehicles, heists, release info. ALWAYS distinguish CONFIRMED facts (trailers/official Rockstar info) from SPECULATION (label it). Reply in the user\'s language, punchy and concrete, max ~150 words. Question:',
};

// F0: verify a real Supabase session (JWT) server-side. The legacy shared token
// remains only as the guest fallback. Tier comes from the VERIFIED user, never the client.
const SB_URL = process.env.SUPABASE_URL || 'https://iiqhhglgjsbnuihythko.supabase.co';
const SB_ANON = process.env.SUPABASE_ANON_KEY || 'sb_publishable_IAeknohtaw-n9fAgh7Zxlg_K9VN-kcM';

async function verifyUser(req) {
  const auth = req.headers['authorization'] || '';
  if (!auth.startsWith('Bearer ')) return null;
  try {
    const r = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SB_ANON, authorization: auth } });
    if (!r.ok) return null;
    const u = await r.json();
    if (!u || !u.id) return null;
    return { id: u.id, email: u.email || null, anon: !!u.is_anonymous, tier: (u.user_metadata && u.user_metadata.tier) || 'visitante' };
  } catch (_) { return null; }
}

export default async function handler(req, res) {
  applyCors(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  const who = await verifyUser(req); // real session first
  if (!who) {
    const token = req.headers['x-run-token'] || '';
    if (token !== TOKEN) { res.status(401).json({ error: 'sesión o token inválido' }); return; }
  }

  const parsed = parseBody(req);
  if (!parsed.ok) { res.status(400).json({ error: 'JSON inválido' }); return; }
  const body = parsed.body;
  const action = body.action;
  if (!ALLOW.includes(action)) { res.status(400).json({ error: 'acción no permitida', allow: ALLOW }); return; }

  try {
    if (action === 'echo') { res.status(200).json({ ok: true, action, echo: body.args ?? null, ts: Date.now(), who: who ? { id: who.id, tier: who.tier, anon: who.anon } : { guest: true } }); return; }

    // Billed path (ask/agent → generateText). Rate-limit per verified user or IP so
    // the client-embedded guest token can't be looped to burn AI Gateway budget.
    const rlKey = who ? ('u:' + who.id) : ('ip:' + clientIp(req));
    const quota = who && !who.anon ? 40 : 12; // signed-in gets more; guests/anon limited
    if (!rateLimit(rlKey, quota, 5 * 60 * 1000)) {
      res.status(429).json({ error: 'Demasiadas solicitudes — esperá unos minutos.' }); return;
    }

    const input = (body.prompt || body.input || '').toString().slice(0, 8000);
    if (!input) { res.status(400).json({ error: 'falta prompt/input' }); return; }

    let prompt = input;
    if (action === 'agent') {
      const persona = AGENTS[body.agent] || AGENTS.strategist;
      const ctx = (body.context || '').toString().slice(0, 5000);
      prompt = persona + '\n\n'
        + (ctx ? ('CONTEXTO REAL DE HK23 (esto es del usuario — básate en esto, no inventes):\n' + ctx + '\n\n') : '')
        + 'TAREA:\n' + input;
    }

    const { text } = await generateText({ model: MODEL, maxOutputTokens: 800, prompt });
    res.status(200).json({ ok: true, action, agent: body.agent || null, text: (text || '').trim() });
  } catch (e) {
    res.status(e?.statusCode || 500).json({ error: e?.message || 'ejecución falló' });
  }
}
