// Motivation Scale — Web Push sender for /scale.
//   remind  hourly from Supabase pg_cron (header x-scale-token) → scale_due, in batches → one push per due row
//   nudge   a friend in your circle (device-bound id + secret)  → scale_nudge_targets (≤ 5 devices)
//   test    "send test" to your own devices                     → scale_self_targets  (≤ 5 devices)
// No service-role key anywhere: every read/write is a token- or secret-checked
// security-definer RPC called with the public anon key.
import { timingSafeEqual } from 'node:crypto';
import { parseBody, applyCors, clientIp, rateLimit } from './_lib.js';

const DEFAULT_SB_URL = 'https://iiqhhglgjsbnuihythko.supabase.co';
const DEFAULT_SB_ANON = 'sb_publishable_IAeknohtaw-n9fAgh7Zxlg_K9VN-kcM';
// The VAPID subject rides inside every JWT we hand to Google/Apple/Mozilla:
// always a public https URL, never an email address.
const DEFAULT_SUBJECT = 'https://hk23universe.vercel.app/scale';

// Same allowlist scale_push_set enforces (anti-SSRF: we POST to whatever endpoint
// is stored). Re-checked before every single send — defense in depth.
const PUSH_ALLOW = /^https:\/\/(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)\//;
// timeout: one hung push service can't stall the whole hourly batch.
const PUSH_OPTS = { TTL: 3600, urgency: 'normal', timeout: 10000 };
const SEND_CONCURRENCY = 16;
// Fan-out caps. A nudge or a self-test reaches at most MAX_DEVICES endpoints (scale_push_set keeps
// 5 per user; this holds even if an RPC returns more). scale_due claims (marks as sent) at most
// DUE_BATCH rows per call, so remind() sends each batch before claiming the next and stops
// claiming once REMIND_BUDGET_MS is spent: a row is only marked when it is about to go out, and
// the last claimed batch still has the other half of vercel.json's maxDuration (60 s) to finish.
export const MAX_DEVICES = 5;
export const DUE_BATCH = 500;
export const REMIND_BUDGET_MS = 30 * 1000;
const MINUTE = 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECRET = /^[0-9a-f]{64}$/i;
// Deliberate, client-facing RPC errors ('scale: <reason>'); anything else is internal.
const REASON = /^scale: ([a-z][a-z ]{0,39})$/;

const COPY = {
  en: {
    remind: "Where's your fire today? Log your day.",
    streak: (n) => ` · ${n}-day streak`,
    nudge: 'is nudging you: log your day 👊',
    test: 'Reminders are on. See you tonight.',
  },
  es: {
    remind: '¿Dónde está tu fuego hoy? Anota tu día.',
    streak: (n) => ` · racha de ${n}`,
    nudge: 'te manda un empujón: anota tu día 👊',
    test: 'Recordatorios activos. Nos vemos esta noche.',
  },
  pt: {
    remind: 'Onde está seu fogo hoje? Registre seu dia.',
    streak: (n) => ` · sequência de ${n}`,
    nudge: 'está te dando um empurrão: registre seu dia 👊',
    test: 'Lembretes ativos. Até a noite.',
  },
};

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const isUuid = (v) => typeof v === 'string' && UUID.test(v);
const isSecret = (v) => typeof v === 'string' && SECRET.test(v);

function copyFor(lang) {
  const k = typeof lang === 'string' ? lang.slice(0, 2).toLowerCase() : '';
  return Object.prototype.hasOwnProperty.call(COPY, k) ? COPY[k] : COPY.en;
}

// Notification payload {title, body, url, tag}, localized by lang (en default, es, pt).
export function buildPayload(kind, d = {}) {
  const c = copyFor(d.lang);
  if (kind === 'nudge') {
    const title = `${str(d.emoji)} ${str(d.name)}`.trim() || 'Motivation Scale';
    return { title, body: c.nudge, url: '/scale', tag: 'scale-nudge' };
  }
  if (kind === 'test') return { title: 'Motivation Scale', body: c.test, url: '/scale', tag: 'scale-test' };
  const n = Math.floor(Number(d.streak));
  return { title: 'Motivation Scale', body: c.remind + (n > 0 ? c.streak(n) : ''), url: '/scale', tag: 'scale-remind' };
}

// Real push services only: https, no userinfo/port tricks, and nothing but
// printable ASCII (no whitespace or control chars to smuggle into the request).
export function endpointAllowed(endpoint) {
  if (typeof endpoint !== 'string' || endpoint.length >= 1024) return false;
  if (!/^[\x21-\x7e]+$/.test(endpoint)) return false;
  const authority = /^https:\/\/([^/]*)/.exec(endpoint);
  if (!authority || authority[1].includes('@')) return false;
  return PUSH_ALLOW.test(endpoint);
}

// Constant-time compare; different lengths are rejected outright.
function tokenOk(given, expected) {
  if (typeof given !== 'string' || !given || !expected) return false;
  const a = Buffer.from(given, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Values are trimmed: `vercel env add` fed through echo leaves a trailing newline.
function readConfig(env) {
  const token = str(env.SCALE_CRON_TOKEN);
  const pub = str(env.VAPID_PUBLIC_KEY);
  const priv = str(env.VAPID_PRIVATE_KEY);
  if (!token || !pub || !priv) return null;
  const subject = str(env.VAPID_SUBJECT);
  return {
    token,
    pub,
    priv,
    subject: /^https:\/\/\S+$/.test(subject) ? subject : DEFAULT_SUBJECT,
    sbUrl: (str(env.SUPABASE_URL) || DEFAULT_SB_URL).replace(/\/+$/, ''),
    anon: str(env.SUPABASE_ANON_KEY) || DEFAULT_SB_ANON,
  };
}

async function eachLimit(items, limit, fn) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

// Pure, testable handler. `webpush` is the web-push module (or anything with
// setVapidDetails + sendNotification) or an async loader returning it.
export function createHandler({ fetchImpl, webpush, env, log, now } = {}) {
  const doFetch = fetchImpl || ((url, init) => fetch(url, init));
  const clock = typeof now === 'function' ? now : () => Date.now();
  const loadPusher = typeof webpush === 'function' ? webpush : async () => webpush;
  const say = typeof log === 'function' ? log : (...a) => console.error(...a);
  const vars = env || {};

  async function rpc(cfg, fn, args) {
    const r = await doFetch(`${cfg.sbUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: cfg.anon, authorization: `Bearer ${cfg.anon}`, 'content-type': 'application/json' },
      body: JSON.stringify(args),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error(j && typeof j.message === 'string' ? j.message : `rpc ${fn} failed (${r.status})`);
    return j;
  }

  // Arm web-push BEFORE any RPC: scale_due marks rows as sent and
  // scale_nudge_targets records the nudge, so a broken sender must fail first
  // instead of silently eating today's reminders.
  async function armPusher(cfg) {
    try {
      const wp = await loadPusher();
      if (!wp || typeof wp.setVapidDetails !== 'function' || typeof wp.sendNotification !== 'function') {
        throw new Error('web-push unavailable');
      }
      wp.setVapidDetails(cfg.subject, cfg.pub, cfg.priv);
      return wp;
    } catch (e) {
      say('scale-push: sender not ready:', (e && e.message) || e);
      return null;
    }
  }

  // → 'sent' | 'skipped' | push-service status code (0 when unknown)
  async function sendOne(wp, sub, payload) {
    if (!sub || !endpointAllowed(sub.endpoint)) return 'skipped';
    try {
      await wp.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: String(sub.p256dh || ''), auth: String(sub.auth || '') } },
        JSON.stringify(payload),
        { ...PUSH_OPTS },
      );
      return 'sent';
    } catch (e) {
      return (e && Number(e.statusCode)) || 0;
    }
  }

  async function deliver(wp, subs, payload) {
    let delivered = 0;
    const list = (Array.isArray(subs) ? subs : []).slice(0, MAX_DEVICES);
    await eachLimit(list, SEND_CONCURRENCY, async (sub) => {
      if ((await sendOne(wp, sub, payload)) === 'sent') delivered++;
    });
    return delivered;
  }

  async function remind(req, res, cfg) {
    if (!tokenOk(req.headers['x-scale-token'], cfg.token)) { res.status(401).json({ error: 'unauthorized' }); return; }
    const wp = await armPusher(cfg);
    if (!wp) { res.status(503).json({ error: 'not configured' }); return; }

    // Each scale_due call claims (marks as sent) at most DUE_BATCH rows: send them all, then claim
    // the next batch only while there is time left, so nothing is marked that never goes out.
    const started = clock();
    let sent = 0, failed = 0, skipped = 0, batches = 0;
    const dead = new Set();
    for (;;) {
      const rows = await rpc(cfg, 'scale_due', { p_token: cfg.token });
      const batch = Array.isArray(rows) ? rows : [];
      batches++;
      await eachLimit(batch, SEND_CONCURRENCY, async (row) => {
        const out = await sendOne(wp, row, buildPayload('remind', row || {}));
        if (out === 'sent') sent++;
        else if (out === 'skipped') skipped++;
        else {
          failed++;
          if (out === 404 || out === 410) dead.add(row.endpoint); // subscription is gone for good
        }
      });
      if (batch.length < DUE_BATCH) break; // a short batch: nothing else is due this hour
      if (clock() - started >= REMIND_BUDGET_MS) {
        say(`scale-push: remind budget spent after ${batches} batches (${sent + failed + skipped} rows); rows still due stay unclaimed`);
        break;
      }
    }

    let dropped = 0;
    if (dead.size) {
      try {
        const d = await rpc(cfg, 'scale_push_drop', { p_token: cfg.token, p_endpoints: [...dead] });
        dropped = Number(d && d.dropped) || 0;
      } catch (e) {
        // Best effort: the pushes already went out; a dead endpoint fails again next time and is retried.
        say('scale-push: drop failed:', (e && e.message) || e);
      }
    }
    res.status(200).json({ sent, failed, dropped, skipped });
  }

  async function nudge(req, res, cfg, body) {
    if (!rateLimit('scale-nudge:' + clientIp(req), 10, MINUTE)) { res.status(429).json({ error: 'slow down' }); return; }
    if (!isUuid(body.id) || !isSecret(body.secret) || !isUuid(body.friend)) { res.status(400).json({ error: 'bad request' }); return; }
    const wp = await armPusher(cfg);
    if (!wp) { res.status(503).json({ error: 'not configured' }); return; }

    const t = (await rpc(cfg, 'scale_nudge_targets', {
      p_token: cfg.token, p_id: body.id, p_secret: body.secret, p_friend: body.friend,
    })) || {};
    const payload = buildPayload('nudge', { lang: t.lang, name: t.from_name, emoji: t.from_emoji });
    res.status(200).json({ ok: true, delivered: await deliver(wp, t.subs, payload) });
  }

  async function selfTest(req, res, cfg, body) {
    if (!rateLimit('scale-test:' + clientIp(req), 3, MINUTE)) { res.status(429).json({ error: 'slow down' }); return; }
    if (!isUuid(body.id) || !isSecret(body.secret)) { res.status(400).json({ error: 'bad request' }); return; }
    const wp = await armPusher(cfg);
    if (!wp) { res.status(503).json({ error: 'not configured' }); return; }

    const t = (await rpc(cfg, 'scale_self_targets', { p_token: cfg.token, p_id: body.id, p_secret: body.secret })) || {};
    res.status(200).json({ ok: true, delivered: await deliver(wp, t.subs, buildPayload('test', { lang: t.lang })) });
  }

  return async function scalePush(req, res) {
    applyCors(req, res, 'POST, OPTIONS');
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

    const parsed = parseBody(req);
    const body = parsed.ok ? parsed.body : null;
    if (!body || typeof body !== 'object' || Array.isArray(body)) { res.status(400).json({ error: 'bad request' }); return; }
    const kind = body.kind;
    if (kind !== 'remind' && kind !== 'nudge' && kind !== 'test') { res.status(400).json({ error: 'bad request' }); return; }

    const cfg = readConfig(vars);
    if (!cfg) { res.status(503).json({ error: 'not configured' }); return; }

    try {
      if (kind === 'remind') await remind(req, res, cfg);
      else if (kind === 'nudge') await nudge(req, res, cfg, body);
      else await selfTest(req, res, cfg, body);
    } catch (e) {
      const m = REASON.exec((e && typeof e.message === 'string' && e.message) || '');
      if (m) { res.status(400).json({ error: m[1] }); return; }
      say('scale-push: unexpected error:', String((e && e.message) || e).slice(0, 200));
      res.status(500).json({ error: 'server' });
    }
  };
}

// Live wiring. web-push is imported lazily (and cached) the first time a push is
// really about to go out, so importing this module never needs the package.
let webpushModule = null;
function loadWebpush() {
  if (!webpushModule) {
    webpushModule = import('web-push')
      .then((m) => m.default || m)
      .catch((e) => { webpushModule = null; throw e; });
  }
  return webpushModule;
}

const liveHandler = createHandler({
  fetchImpl: (url, init) => fetch(url, init),
  webpush: loadWebpush,
  env: process.env,
});

export default function handler(req, res) {
  return liveHandler(req, res);
}
