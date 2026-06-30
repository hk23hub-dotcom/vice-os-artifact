// HK23 Universe — Action Runner. Real execution from inside the universe.
// AI routes through the Vercel AI Gateway (zero-config via the deployment's OIDC token).
import { generateText } from 'ai';

const TOKEN = process.env.RUN_TOKEN || 'hk23-run-9x';
const MODEL = process.env.RUN_MODEL || 'deepseek/deepseek-v3.2';
const ALLOW = ['echo', 'ask', 'agent'];

// Agent personas — each is a real prompt the runner executes.
const AGENTS = {
  prioritizer: 'Eres un jefe de operaciones. Toma esta lista/idea y devuélvela ordenada por prioridad (ALTA/MEDIA/BAJA) con una línea de por qué cada una:',
  strategist:  'Eres un estratega de producto del ecosistema HK23. Da 3 próximos pasos concretos y accionables para:',
  writer:      'Eres el copywriter de la marca VICE (directo, con filo, sin relleno). Escribe sobre:',
  analyst:     'Eres un analista. Resume en bullets claros y da 1 insight no obvio sobre:',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-run-token');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  const token = req.headers['x-run-token'] || '';
  if (token !== TOKEN) { res.status(401).json({ error: 'token inválido' }); return; }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const action = body.action;
  if (!ALLOW.includes(action)) { res.status(400).json({ error: 'acción no permitida', allow: ALLOW }); return; }

  try {
    if (action === 'echo') { res.status(200).json({ ok: true, action, echo: body.args ?? null, ts: Date.now() }); return; }

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
