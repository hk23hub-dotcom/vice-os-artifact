// VICE.HUB — daily GTA 6 research agent.
// Runs on a Vercel cron: pulls fresh headlines (Google News RSS), does web
// research with an online model (perplexity/sonar via AI Gateway, falls back
// to deepseek + RSS-only), classifies CONFIRMADO/RUMOR/FILTRACIÓN, and stores
// the intel in Supabase (hk23.entities, meta.kind='gta6-intel') for the page.
import { generateText } from 'ai';

const TOKEN = process.env.RUN_TOKEN || 'hk23-run-9x';
const MODEL = process.env.INTEL_MODEL || 'perplexity/sonar';
const FALLBACK = process.env.RUN_MODEL || 'deepseek/deepseek-v3.2';
const SB_URL = 'https://iiqhhglgjsbnuihythko.supabase.co/rest/v1';
const SB_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_IAeknohtaw-n9fAgh7Zxlg_K9VN-kcM';

function sbH(rep) {
  const h = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', 'Content-Profile': 'hk23', 'Accept-Profile': 'hk23' };
  if (rep) h.Prefer = 'return=representation';
  return h;
}

async function fetchHeadlines() {
  try {
    const r = await fetch('https://news.google.com/rss/search?q=%22GTA+6%22+OR+%22GTA+VI%22+when:2d&hl=en-US&gl=US&ceid=US:en', {
      headers: { 'user-agent': 'Mozilla/5.0 (vicehub-intel)' },
    });
    const xml = await r.text();
    const items = [];
    const re = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>/g;
    let m;
    while ((m = re.exec(xml)) && items.length < 12) {
      const title = m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      const link = m[2].trim();
      if (title && !/Google News/i.test(title)) items.push({ title, link });
    }
    return items;
  } catch (_) { return []; }
}

function parseItems(text) {
  try {
    const s = text.indexOf('['), e = text.lastIndexOf(']');
    if (s < 0 || e <= s) return [];
    const arr = JSON.parse(text.slice(s, e + 1));
    return Array.isArray(arr) ? arr.filter(x => x && x.title && x.summary).slice(0, 6) : [];
  } catch (_) { return []; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const ua = req.headers['user-agent'] || '';
  const tok = req.headers['x-run-token'] || (req.query && req.query.token) || '';
  if (!ua.startsWith('vercel-cron') && tok !== TOKEN) { res.status(401).json({ error: 'no autorizado' }); return; }

  const day = new Date().toISOString().slice(0, 10);
  const force = !!(req.query && req.query.force);

  try {
    // already ran today? (idempotent cron)
    const chk = await fetch(SB_URL + '/entities?select=id&meta-%3E%3Ekind=eq.gta6-intel&meta-%3E%3Eday=eq.' + day + '&limit=1', { headers: sbH(false) });
    const existing = chk.ok ? await chk.json() : [];
    if (existing.length && !force) { res.status(200).json({ ok: true, day, skipped: 'ya corrió hoy' }); return; }

    const heads = await fetchHeadlines();
    const headTxt = heads.map(h => '- ' + h.title + ' :: ' + h.link).join('\n');
    const prompt = 'Hoy es ' + day + '. Eres el agente de inteligencia de VICE.HUB (fan hub de GTA 6). '
      + 'Investiga las novedades REALES de GTA 6 de las últimas 24-48 horas. Titulares de Google News de hoy:\n'
      + (headTxt || '(sin RSS disponible — usa tu búsqueda web)')
      + '\n\nDevuelve SOLO un array JSON válido (sin markdown, sin texto extra), máximo 6 items, formato: '
      + '[{"title":"titular corto en español","summary":"1-2 frases en español con lo esencial","status":"CONFIRMADO|RUMOR|FILTRACIÓN","source":"nombre del medio","url":"link"}]. '
      + 'CONFIRMADO solo para info oficial de Rockstar/Take-Two; declaraciones de insiders/analistas = RUMOR; material no oficial = FILTRACIÓN. Sin duplicados.';

    let text = '', usedModel = MODEL;
    try {
      ({ text } = await generateText({ model: MODEL, maxOutputTokens: 1400, prompt }));
    } catch (_) {
      usedModel = FALLBACK;
      ({ text } = await generateText({ model: FALLBACK, maxOutputTokens: 1400, prompt }));
    }
    let items = parseItems(text);
    if (!items.length && usedModel !== FALLBACK) { // model answered but not parseable → one retry on fallback
      usedModel = FALLBACK;
      ({ text } = await generateText({ model: FALLBACK, maxOutputTokens: 1400, prompt }));
      items = parseItems(text);
    }
    if (!items.length) { res.status(200).json({ ok: false, day, error: 'sin items parseables', raw: (text || '').slice(0, 200) }); return; }

    let saved = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const row = {
        name: String(it.title).slice(0, 90),
        slug: 'gta6-intel-' + day + '-' + i + '-' + Math.random().toString(36).slice(2, 6),
        level: 'node', kind: 'system', color: '#ff2e93',
        summary: String(it.summary).slice(0, 400),
        meta: { nh: '1', kind: 'gta6-intel', day, status: it.status || 'RUMOR', source: String(it.source || '').slice(0, 60), url: String(it.url || '').slice(0, 300) },
      };
      const r = await fetch(SB_URL + '/entities', { method: 'POST', headers: sbH(true), body: JSON.stringify(row) });
      if (r.ok) saved++;
    }
    res.status(200).json({ ok: true, day, model: usedModel, found: items.length, saved });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'research falló' });
  }
}
