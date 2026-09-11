// api/scale-push.js — Web Push sender for Motivation Scale (remind / nudge / test).
// Pure handler tests: mock req/res, mock fetch (PostgREST RPCs) and a mock web-push.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import liveHandler, {
  createHandler, endpointAllowed, buildPayload, MAX_DEVICES, DUE_BATCH, REMIND_BUDGET_MS,
} from '../api/scale-push.js';

const TOKEN = 'cron-token-0123456789abcdef0123456789';
const ENV = Object.freeze({ SCALE_CRON_TOKEN: TOKEN, VAPID_PUBLIC_KEY: 'vapid-public-test', VAPID_PRIVATE_KEY: 'vapid-private-test' });
const SB = 'https://iiqhhglgjsbnuihythko.supabase.co';
const ANON = 'sb_publishable_IAeknohtaw-n9fAgh7Zxlg_K9VN-kcM';
const SUBJECT = 'https://hk23universe.vercel.app/scale';
const OPTS = { TTL: 3600, urgency: 'normal', timeout: 10000 };
const ID = '11111111-1111-4111-8111-111111111111';
const FRIEND = '22222222-2222-4222-8222-222222222222';
const SECRET = 'ab'.repeat(32);
const FCM = 'https://fcm.googleapis.com/fcm/send/';
const MOZ = 'https://updates.push.services.mozilla.com/wpush/v2/';
const APPLE = 'https://web.push.apple.com/Q';
const WNS = 'https://wns2-by3p.notify.windows.com/w/?token=';

const REMIND_EN = "Where's your fire today? Log your day.";
const REMIND_ES = '¿Dónde está tu fuego hoy? Anota tu día.';
const REMIND_PT = 'Onde está seu fogo hoje? Registre seu dia.';

// Every request gets its own client IP unless a test pins one: the rate limiter
// in _lib.js is module-global, so tests must not share buckets by accident.
let ipSeq = 0;
const freshIp = () => { ipSeq++; return `10.9.${ipSeq >> 8}.${ipSeq & 255}`; };

function mkReq({ method = 'POST', body, headers = {}, ip = freshIp() } = {}) {
  return { method, body, headers: { 'x-forwarded-for': ip, ...headers }, socket: { remoteAddress: '127.0.0.1' } };
}

function mkRes() {
  const res = { statusCode: null, headers: {}, body: undefined, ended: false };
  res.setHeader = (k, v) => { res.headers[String(k).toLowerCase()] = v; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.body = obj; res.ended = true; return res; };
  res.end = () => { res.ended = true; return res; };
  return res;
}

// routes: { rpcName: {status, body} | (args) => {status, body} }; unknown RPC → PostgREST 404.
function mkFetch(routes = {}) {
  const calls = [];
  async function fetchImpl(url, init) {
    const fn = String(url).split('/rest/v1/rpc/')[1];
    const args = JSON.parse(init.body);
    calls.push({ url: String(url), fn, init, args });
    let out = routes[fn];
    if (typeof out === 'function') out = await out(args);
    if (!out) out = { status: 404, body: { code: 'PGRST202', message: `Could not find the function public.${fn}` } };
    const status = out.status || 200;
    return { ok: status >= 200 && status < 300, status, json: async () => (out.body === undefined ? null : out.body) };
  }
  return { fetchImpl, calls };
}

function mkPush({ failWith = {}, vapidThrows = false } = {}) {
  const push = { attempts: [], vapid: [] };
  push.setVapidDetails = (subject, pub, priv) => {
    if (vapidThrows) throw new Error('Vapid public key should be 65 bytes long when decoded.');
    push.vapid.push([subject, pub, priv]);
  };
  push.sendNotification = async (sub, payload, opts) => {
    push.attempts.push({ sub, payload: JSON.parse(payload), opts, armed: push.vapid.length > 0 });
    const code = failWith[sub.endpoint];
    if (code) {
      const e = new Error(`Received unexpected response code ${code}`);
      e.statusCode = code;
      throw e;
    }
    return { statusCode: 201 };
  };
  return push;
}

function setup({ env = ENV, routes = {}, push = mkPush() } = {}) {
  const f = mkFetch(routes);
  const logs = [];
  const handler = createHandler({ fetchImpl: f.fetchImpl, webpush: push, env, log: (...a) => logs.push(a.join(' ')) });
  const call = async (opts) => { const res = mkRes(); await handler(mkReq(opts), res); return res; };
  return { handler, call, calls: f.calls, push, logs };
}

// remindReq() → valid token; remindReq(null) → no x-scale-token header at all.
const remindReq = (token = TOKEN) => ({ body: { kind: 'remind' }, headers: token === null ? {} : { 'x-scale-token': token } });
const nudgeBody = () => ({ kind: 'nudge', id: ID, secret: SECRET, friend: FRIEND });

// Endpoints that must never receive a request, whatever ends up in the table.
const HOSTILE = [
  'https://fcm.googleapis.com.evil.com/fcm/send/x', // suffix trick
  'https://fcm.googleapis.com@evil.com/fcm/send/x', // userinfo trick: the real host is evil.com
  'https://user:pw@fcm.googleapis.com/fcm/send/x', // userinfo in front of a real host
  'https://fcm.googleapis.com\\@evil.com/fcm/send/x', // backslash + userinfo
  'https://evil.com/fcm.googleapis.com/',
  'https://evil.com/.notify.windows.com/x',
  'https://evil.push.apple.com.attacker.net/x',
  'http://fcm.googleapis.com/fcm/send/x', // not https
  'https://fcm.googleapis.com:8443/fcm/send/x', // explicit port
  'https://FCM.GOOGLEAPIS.COM/fcm/send/x', // case games
  'https://169.254.169.254/latest/meta-data/', // cloud metadata
  'https://localhost/',
  'https://fcm.googleapis.com', // no path at all
  ' https://fcm.googleapis.com/fcm/send/x', // leading space
  'https://fcm.googleapis.com/fcm/send/x\r\nHost: evil.com', // header smuggling
  'https://fcm.googleapis.com/' + 'a'.repeat(1100), // over the 1024-char limit
  '',
  null,
];

test('OPTIONS → 204 with CORS for our own origin, touches nothing', async () => {
  const { call, calls, push } = setup();
  const res = await call({ method: 'OPTIONS', headers: { origin: 'https://hk23universe.vercel.app' } });
  assert.equal(res.statusCode, 204);
  assert.equal(res.ended, true);
  assert.equal(res.headers['access-control-allow-origin'], 'https://hk23universe.vercel.app');
  assert.match(res.headers['access-control-allow-methods'], /POST/);

  const foreign = await call({ method: 'OPTIONS', headers: { origin: 'https://evil.example' } });
  assert.equal(foreign.statusCode, 204);
  assert.equal(foreign.headers['access-control-allow-origin'], undefined);
  assert.equal(calls.length, 0);
  assert.equal(push.attempts.length, 0);
});

test('GET (and any other non-POST) → 405', async () => {
  const { call, calls } = setup();
  for (const method of ['GET', 'PUT', 'DELETE']) {
    const res = await call({ method });
    assert.equal(res.statusCode, 405, method);
    assert.deepEqual(res.body, { error: 'POST only' });
  }
  assert.equal(calls.length, 0);
});

test('remind: 401 on missing or wrong x-scale-token, nothing consumed', async () => {
  const { call, calls, push } = setup({ routes: { scale_due: { body: [] } } });
  const wrong = [null, '', 'x'.repeat(TOKEN.length), TOKEN.slice(0, -1), TOKEN + 'x', TOKEN.toUpperCase()];
  for (const t of wrong) {
    const res = await call(remindReq(t));
    assert.equal(res.statusCode, 401, `token ${JSON.stringify(t)}`);
    assert.deepEqual(res.body, { error: 'unauthorized' });
  }
  // the token only counts in the header, never in the body
  const inBody = await call({ body: { kind: 'remind', token: TOKEN, p_token: TOKEN } });
  assert.equal(inBody.statusCode, 401);

  assert.equal(calls.length, 0, 'scale_due never called');
  assert.equal(push.vapid.length, 0);
  assert.equal(push.attempts.length, 0);
});

test('remind: one localized push per due row (es streak suffix, en default)', async () => {
  const rows = [
    { endpoint: FCM + 'es5', p256dh: 'k-es5', auth: 'a-es5', lang: 'es', streak: 5, name: 'Ana' },
    { endpoint: FCM + 'es0', p256dh: 'k-es0', auth: 'a-es0', lang: 'es', streak: 0, name: 'Beto' },
    { endpoint: MOZ + 'en', p256dh: 'k-en', auth: 'a-en', lang: 'en', streak: 1, name: 'Cy' },
    { endpoint: APPLE + 'nolang', p256dh: 'k-nl', auth: 'a-nl', lang: null, streak: 0, name: null },
    { endpoint: WNS + 'pt', p256dh: 'k-pt', auth: 'a-pt', lang: 'pt', streak: 12, name: 'Dora' },
  ];
  const { call, calls, push } = setup({ routes: { scale_due: { body: rows } } });
  const res = await call(remindReq());
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { sent: 5, failed: 0, dropped: 0, skipped: 0 });

  // exactly one RPC: scale_due with the server token, anon-key headers, default project
  assert.equal(calls.length, 1);
  const [due] = calls;
  assert.equal(due.url, `${SB}/rest/v1/rpc/scale_due`);
  assert.equal(due.init.method, 'POST');
  assert.equal(due.init.headers.apikey, ANON);
  assert.equal(due.init.headers.authorization, `Bearer ${ANON}`);
  assert.equal(due.init.headers['content-type'], 'application/json');
  assert.deepEqual(due.args, { p_token: TOKEN });

  assert.deepEqual(push.vapid, [[SUBJECT, ENV.VAPID_PUBLIC_KEY, ENV.VAPID_PRIVATE_KEY]]);
  assert.equal(push.attempts.length, rows.length, 'one push per due row');
  const byEndpoint = Object.fromEntries(push.attempts.map((a) => [a.sub.endpoint, a]));
  for (const row of rows) {
    const a = byEndpoint[row.endpoint];
    assert.ok(a, row.endpoint);
    assert.equal(a.armed, true, 'VAPID details set before sending');
    assert.deepEqual(a.sub, { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } });
    assert.deepEqual(a.opts, OPTS);
  }
  const payload = (ep) => byEndpoint[ep].payload;
  assert.deepEqual(payload(FCM + 'es5'), { title: 'Motivation Scale', body: REMIND_ES + ' · racha de 5', url: '/scale', tag: 'scale-remind' });
  assert.equal(payload(FCM + 'es0').body, REMIND_ES);
  assert.equal(payload(MOZ + 'en').body, REMIND_EN + ' · 1-day streak');
  assert.deepEqual(payload(APPLE + 'nolang'), { title: 'Motivation Scale', body: REMIND_EN, url: '/scale', tag: 'scale-remind' });
  assert.equal(payload(WNS + 'pt').body, REMIND_PT + ' · sequência de 12');
});

test('remind: endpoints answering 404/410 go to scale_push_drop, other failures do not', async () => {
  const rows = ['gone', 'missing', 'busy', 'boom', 'ok'].map((k, i) => ({ endpoint: FCM + k, p256dh: 'k' + i, auth: 'a' + i, lang: 'en', streak: 0 }));
  const push = mkPush({ failWith: { [FCM + 'gone']: 410, [FCM + 'missing']: 404, [FCM + 'busy']: 429, [FCM + 'boom']: 500 } });
  const { call, calls } = setup({
    push,
    routes: { scale_due: { body: rows }, scale_push_drop: (args) => ({ body: { dropped: args.p_endpoints.length } }) },
  });
  const res = await call(remindReq());
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { sent: 1, failed: 4, dropped: 2, skipped: 0 });
  assert.equal(push.attempts.length, 5);
  assert.deepEqual(calls.map((c) => c.fn), ['scale_due', 'scale_push_drop']);
  assert.equal(calls[1].args.p_token, TOKEN);
  assert.deepEqual([...calls[1].args.p_endpoints].sort(), [FCM + 'gone', FCM + 'missing']);
});

test('remind: a failing scale_push_drop does not turn a sent batch into an error', async () => {
  const rows = [{ endpoint: FCM + 'gone', p256dh: 'k', auth: 'a', lang: 'en', streak: 0 }];
  const { call, calls, logs } = setup({
    push: mkPush({ failWith: { [FCM + 'gone']: 410 } }),
    routes: { scale_due: { body: rows }, scale_push_drop: { status: 500, body: { message: 'boom' } } },
  });
  const res = await call(remindReq());
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { sent: 0, failed: 1, dropped: 0, skipped: 0 });
  assert.deepEqual(calls.map((c) => c.fn), ['scale_due', 'scale_push_drop']);
  assert.ok(logs.some((l) => l.includes('drop failed')));
});

test('remind: endpoints outside the push-service allowlist are skipped — never sent, never dropped', async () => {
  const rows = HOSTILE.map((endpoint, i) => ({ endpoint, p256dh: 'k' + i, auth: 'a' + i, lang: 'en', streak: 0 }));
  rows.push(null);
  rows.push({ endpoint: FCM + 'good', p256dh: 'kg', auth: 'ag', lang: 'en', streak: 0 });
  const { call, calls, push } = setup({ routes: { scale_due: { body: rows } } });
  const res = await call(remindReq());
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { sent: 1, failed: 0, dropped: 0, skipped: HOSTILE.length + 1 });
  assert.deepEqual(push.attempts.map((a) => a.sub.endpoint), [FCM + 'good']);
  assert.deepEqual(calls.map((c) => c.fn), ['scale_due']);
});

test('endpointAllowed: the contract allowlist, anchored, no userinfo', () => {
  const good = [
    FCM + 'abc',
    'https://android.googleapis.com/gcm/send/abc',
    MOZ + 'gAAAAA',
    'https://web.push.apple.com/QGx',
    'https://api.push.apple.com/3/device/x',
    'https://db5p.notify.windows.com/w/?token=AwYAAA%3d%3d',
    WNS + 'x',
  ];
  for (const ep of good) assert.equal(endpointAllowed(ep), true, ep);
  for (const ep of HOSTILE) assert.equal(endpointAllowed(ep), false, JSON.stringify(ep));
  assert.equal(endpointAllowed(undefined), false);
  assert.equal(endpointAllowed({ toString: () => FCM + 'x' }), false);
});

test('nudge: title "{emoji} {name}", es body, one push per friend device', async () => {
  const subs = [
    { endpoint: FCM + 'friend-phone', p256dh: 'k1', auth: 'a1' },
    { endpoint: APPLE + 'friend-mac', p256dh: 'k2', auth: 'a2' },
  ];
  const { call, calls, push } = setup({ routes: { scale_nudge_targets: { body: { from_name: 'Ana', from_emoji: '🔥', lang: 'es', subs } } } });
  const res = await call({ body: nudgeBody() });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, delivered: 2 });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${SB}/rest/v1/rpc/scale_nudge_targets`);
  assert.deepEqual(calls[0].args, { p_token: TOKEN, p_id: ID, p_secret: SECRET, p_friend: FRIEND });

  assert.deepEqual(push.attempts.map((a) => a.sub.endpoint).sort(), subs.map((s) => s.endpoint).sort());
  for (const a of push.attempts) {
    assert.equal(a.armed, true);
    assert.deepEqual(a.opts, OPTS);
    assert.deepEqual(a.payload, { title: '🔥 Ana', body: 'te manda un empujón: anota tu día 👊', url: '/scale', tag: 'scale-nudge' });
  }
});

test('nudge: no emoji → just the name, en by default; a friend without devices is still ok', async () => {
  const one = setup({ routes: { scale_nudge_targets: { body: { from_name: 'Bo', from_emoji: null, lang: null, subs: [{ endpoint: MOZ + 'x', p256dh: 'k', auth: 'a' }] } } } });
  const res = await one.call({ body: nudgeBody() });
  assert.deepEqual(res.body, { ok: true, delivered: 1 });
  assert.deepEqual(one.push.attempts[0].payload, { title: 'Bo', body: 'is nudging you: log your day 👊', url: '/scale', tag: 'scale-nudge' });

  const none = setup({ routes: { scale_nudge_targets: { body: { from_name: 'Bo', from_emoji: '🌊', lang: 'pt', subs: [] } } } });
  const res2 = await none.call({ body: nudgeBody() });
  assert.equal(res2.statusCode, 200);
  assert.deepEqual(res2.body, { ok: true, delivered: 0 });
  assert.equal(none.push.attempts.length, 0);
});

test('nudge: known "scale: …" RPC errors → 400 {error: reason}, nothing pushed', async () => {
  for (const reason of ['already nudged', 'already logged', 'not in your circle', 'bad credentials', 'slow down', 'set a name first']) {
    const { call, push } = setup({
      routes: { scale_nudge_targets: { status: 400, body: { code: 'P0001', details: null, hint: null, message: `scale: ${reason}` } } },
    });
    const res = await call({ body: nudgeBody() });
    assert.equal(res.statusCode, 400, reason);
    assert.deepEqual(res.body, { error: reason });
    assert.equal(push.attempts.length, 0);
  }
});

test('unexpected failures → 500 {error:"server"} with no internals leaked', async () => {
  const cases = [
    { status: 500, body: { code: '42501', message: 'permission denied for table scale_users', hint: 'check grants on scale_push' } },
    { status: 404, body: { code: 'PGRST202', message: 'Could not find the function public.scale_nudge_targets(p_friend, p_id, p_secret, p_token)' } },
    { status: 400, body: { message: 'scale: Bad; select * from scale_users' } }, // not a clean reason
    { status: 502, body: null },
  ];
  for (const route of cases) {
    const { call, push, logs } = setup({ routes: { scale_nudge_targets: route } });
    const res = await call({ body: nudgeBody() });
    assert.equal(res.statusCode, 500, JSON.stringify(route));
    assert.deepEqual(res.body, { error: 'server' });
    assert.equal(push.attempts.length, 0);
    assert.ok(logs.length > 0, 'logged server-side only');
  }

  // Supabase unreachable
  const handler = createHandler({
    fetchImpl: async () => { throw new TypeError('fetch failed: connect ECONNREFUSED 10.0.0.1:443'); },
    webpush: mkPush(),
    env: ENV,
    log: () => {},
  });
  const res = mkRes();
  await handler(mkReq(remindReq()), res);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'server' });
});

test('503 {error:"not configured"} when VAPID keys or SCALE_CRON_TOKEN are missing', async () => {
  for (const missing of ['SCALE_CRON_TOKEN', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY']) {
    for (const blank of [undefined, '   ']) {
      const env = { ...ENV };
      if (blank === undefined) delete env[missing];
      else env[missing] = blank;
      const { call, calls, push } = setup({ env, routes: { scale_due: { body: [] } } });
      for (const body of [{ kind: 'remind' }, nudgeBody(), { kind: 'test', id: ID, secret: SECRET }]) {
        const res = await call({ body, headers: { 'x-scale-token': TOKEN } });
        assert.equal(res.statusCode, 503, `${missing}=${JSON.stringify(blank)} ${body.kind}`);
        assert.deepEqual(res.body, { error: 'not configured' });
      }
      assert.equal(calls.length, 0);
      assert.equal(push.attempts.length, 0);
    }
  }
});

test('a sender that cannot arm → 503 before any RPC, so no reminder or nudge is consumed', async () => {
  const broken = [
    mkPush({ vapidThrows: true }), // bad VAPID keys
    async () => { throw new Error("Cannot find package 'web-push'"); }, // package missing
    null,
  ];
  for (const webpush of broken) {
    const f = mkFetch({ scale_due: { body: [{ endpoint: FCM + 'x', p256dh: 'k', auth: 'a' }] }, scale_nudge_targets: { body: { subs: [] } } });
    const handler = createHandler({ fetchImpl: f.fetchImpl, webpush, env: ENV, log: () => {} });
    for (const body of [{ kind: 'remind' }, nudgeBody(), { kind: 'test', id: ID, secret: SECRET }]) {
      const res = mkRes();
      await handler(mkReq({ body, headers: { 'x-scale-token': TOKEN } }), res);
      assert.equal(res.statusCode, 503, body.kind);
      assert.deepEqual(res.body, { error: 'not configured' });
    }
    assert.equal(f.calls.length, 0);
  }
});

test('webpush may be an async loader: only invoked once a push is really about to go out', async () => {
  let loads = 0;
  const push = mkPush();
  const f = mkFetch({ scale_self_targets: { body: { lang: 'en', subs: [{ endpoint: FCM + 'me', p256dh: 'k', auth: 'a' }] } } });
  const handler = createHandler({ fetchImpl: f.fetchImpl, webpush: async () => { loads++; return push; }, env: ENV, log: () => {} });
  for (const opts of [{ method: 'OPTIONS' }, { method: 'GET' }, remindReq('nope'), { body: { kind: 'test', id: 'x', secret: SECRET } }]) {
    await handler(mkReq(opts), mkRes());
  }
  assert.equal(loads, 0);
  const res = mkRes();
  await handler(mkReq({ body: { kind: 'test', id: ID, secret: SECRET } }), res);
  assert.deepEqual(res.body, { ok: true, delivered: 1 });
  assert.equal(loads, 1);
});

test('VAPID subject: an https VAPID_SUBJECT is used, an email never is', async () => {
  const cases = [
    [undefined, SUBJECT],
    ['https://example.org/scale', 'https://example.org/scale'],
    ['mailto:owner@example.com', SUBJECT],
    ['owner@example.com', SUBJECT],
  ];
  for (const [value, expected] of cases) {
    const env = { ...ENV };
    if (value !== undefined) env.VAPID_SUBJECT = value;
    const { call, push } = setup({ env, routes: { scale_due: { body: [] } } });
    const res = await call(remindReq());
    assert.equal(res.statusCode, 200);
    assert.equal(push.vapid[0][0], expected, String(value));
  }
});

test('SUPABASE_URL / SUPABASE_ANON_KEY from env are used (trailing slash trimmed)', async () => {
  const env = { ...ENV, SUPABASE_URL: 'http://127.0.0.1:54321/', SUPABASE_ANON_KEY: 'local-anon' };
  const { call, calls } = setup({ env, routes: { scale_due: { body: [] } } });
  const res = await call(remindReq());
  assert.deepEqual(res.body, { sent: 0, failed: 0, dropped: 0, skipped: 0 });
  assert.equal(calls[0].url, 'http://127.0.0.1:54321/rest/v1/rpc/scale_due');
  assert.equal(calls[0].init.headers.apikey, 'local-anon');
  assert.equal(calls[0].init.headers.authorization, 'Bearer local-anon');
});

test('test: self ping in the user language (pt), allowlist enforced, 3/min per IP', async () => {
  const subs = [
    { endpoint: FCM + 'me', p256dh: 'k', auth: 'a' },
    { endpoint: 'https://evil.example/steal', p256dh: 'k', auth: 'a' },
  ];
  const { call, calls, push } = setup({ routes: { scale_self_targets: { body: { lang: 'pt', subs } } } });
  const ip = freshIp();
  const req = { ip, body: { kind: 'test', id: ID, secret: SECRET } };

  const first = await call(req);
  assert.equal(first.statusCode, 200);
  assert.deepEqual(first.body, { ok: true, delivered: 1 });
  assert.equal(calls[0].url, `${SB}/rest/v1/rpc/scale_self_targets`);
  assert.deepEqual(calls[0].args, { p_token: TOKEN, p_id: ID, p_secret: SECRET });
  assert.deepEqual(push.attempts.map((a) => a.sub.endpoint), [FCM + 'me']);
  assert.deepEqual(push.attempts[0].payload, { title: 'Motivation Scale', body: 'Lembretes ativos. Até a noite.', url: '/scale', tag: 'scale-test' });

  assert.equal((await call(req)).statusCode, 200);
  assert.equal((await call(req)).statusCode, 200);
  const fourth = await call(req);
  assert.equal(fourth.statusCode, 429);
  assert.deepEqual(fourth.body, { error: 'slow down' });
  assert.equal(calls.length, 3, 'rate-limited call never reaches the database');
  assert.equal((await call({ ...req, ip: freshIp() })).statusCode, 200, 'other IPs unaffected');
});

test('nudge: rate limited to 10/min per IP', async () => {
  const { call, calls } = setup({ routes: { scale_nudge_targets: { body: { from_name: 'Ana', from_emoji: '', lang: 'en', subs: [] } } } });
  const ip = freshIp();
  const req = { ip, body: nudgeBody() };
  for (let i = 1; i <= 10; i++) {
    const res = await call(req);
    assert.equal(res.statusCode, 200, `nudge #${i}`);
    assert.deepEqual(res.body, { ok: true, delivered: 0 });
  }
  const eleventh = await call(req);
  assert.equal(eleventh.statusCode, 429);
  assert.deepEqual(eleventh.body, { error: 'slow down' });
  assert.equal(calls.length, 10, 'rate-limited call never reaches the database');
  assert.equal((await call({ ...req, ip: freshIp() })).statusCode, 200, 'other IPs unaffected');
});

const dueRows = (n, tag) => Array.from({ length: n }, (_, i) => ({ endpoint: `${FCM}${tag}-${i}`, p256dh: 'k', auth: 'a', lang: 'en', streak: 0 }));

test('nudge + test: never more than MAX_DEVICES (5) pushes per user, whatever the RPC returns', async () => {
  assert.equal(MAX_DEVICES, 5);
  const many = Array.from({ length: 300 }, (_, i) => ({ endpoint: `${FCM}dev-${i}`, p256dh: 'k' + i, auth: 'a' + i }));

  const self = setup({ routes: { scale_self_targets: { body: { lang: 'en', subs: many } } } });
  const r1 = await self.call({ body: { kind: 'test', id: ID, secret: SECRET } });
  assert.equal(r1.statusCode, 200);
  assert.deepEqual(r1.body, { ok: true, delivered: MAX_DEVICES });
  assert.deepEqual(self.push.attempts.map((a) => a.sub.endpoint).sort(), many.slice(0, MAX_DEVICES).map((s) => s.endpoint).sort());

  const nudge = setup({ routes: { scale_nudge_targets: { body: { from_name: 'Ana', from_emoji: null, lang: 'es', subs: many } } } });
  const r2 = await nudge.call({ body: nudgeBody() });
  assert.equal(r2.statusCode, 200);
  assert.deepEqual(r2.body, { ok: true, delivered: MAX_DEVICES });
  assert.equal(nudge.push.attempts.length, MAX_DEVICES);
});

test('remind: scale_due is claimed in batches of DUE_BATCH until a short one; every claimed row is sent once', async () => {
  assert.equal(DUE_BATCH, 500);
  const batches = [dueRows(DUE_BATCH, 'b1'), dueRows(DUE_BATCH, 'b2'), dueRows(3, 'b3')];
  let i = 0;
  const { call, calls, push } = setup({ routes: { scale_due: () => ({ body: batches[i++] || [] }) } });
  const res = await call(remindReq());
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { sent: 1003, failed: 0, dropped: 0, skipped: 0 });
  assert.deepEqual(calls.map((c) => c.fn), ['scale_due', 'scale_due', 'scale_due'], 'stops after the short batch');
  assert.equal(push.attempts.length, 1003);
  assert.equal(new Set(push.attempts.map((a) => a.sub.endpoint)).size, 1003);

  // exactly one full batch → one more (empty) claim, then stop
  let j = 0;
  const full = setup({ routes: { scale_due: () => ({ body: j++ === 0 ? dueRows(DUE_BATCH, 'x') : [] }) } });
  const res2 = await full.call(remindReq());
  assert.deepEqual(res2.body, { sent: DUE_BATCH, failed: 0, dropped: 0, skipped: 0 });
  assert.equal(full.calls.length, 2);
});

test('remind: stops claiming once REMIND_BUDGET_MS is spent, so no row is marked that is not sent', async () => {
  const STEP = 12_000; // each claim + send "takes" 12 s on the fake clock
  let t = 5_000_000;
  const f = mkFetch({ scale_due: () => { t += STEP; return { body: dueRows(DUE_BATCH, `t${t}`) }; } });
  const push = mkPush();
  const logs = [];
  const handler = createHandler({ fetchImpl: f.fetchImpl, webpush: push, env: ENV, log: (...a) => logs.push(a.join(' ')), now: () => t });
  const res = mkRes();
  await handler(mkReq(remindReq()), res);
  assert.equal(res.statusCode, 200);
  const claims = Math.ceil(REMIND_BUDGET_MS / STEP); // the claim that crosses the budget is the last one
  assert.ok(claims > 1);
  assert.equal(f.calls.length, claims, 'no claim after the budget is spent');
  assert.deepEqual(res.body, { sent: claims * DUE_BATCH, failed: 0, dropped: 0, skipped: 0 });
  assert.equal(push.attempts.length, f.calls.length * DUE_BATCH, 'every claimed row was sent');
  assert.ok(logs.some((l) => l.includes('remind budget spent')), 'a cut-short hour leaves a log line');
});

test('vercel.json maxDuration covers the remind budget plus one more full batch; DUE_BATCH matches scale_due', () => {
  const cfg = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const max = cfg.functions && cfg.functions['api/scale-push.js'] && cfg.functions['api/scale-push.js'].maxDuration;
  assert.equal(max, 60);
  assert.ok(REMIND_BUDGET_MS * 2 <= max * 1000, 'a batch claimed right at the budget still has as long again to finish');

  const sql = readFileSync(new URL('../supabase/migrations/0011_scale_circle.sql', import.meta.url), 'utf8');
  const due = sql.slice(sql.indexOf('function public.scale_due('), sql.indexOf('function public.scale_nudge_targets('));
  assert.match(due, new RegExp(`\\blimit ${DUE_BATCH}\\b`), 'scale_due claims at most DUE_BATCH rows per call');
});

test('malformed requests → 400 without touching the database', async () => {
  const { call, calls, push } = setup();
  const bodies = [
    '{not json',
    '[]',
    '42',
    'null',
    [{ kind: 'nudge' }],
    {},
    { kind: 'party' },
    { kind: 'nudge', id: ID, secret: SECRET }, // no friend
    { kind: 'nudge', id: 'me', secret: SECRET, friend: FRIEND }, // id not a uuid
    { kind: 'nudge', id: [ID], secret: SECRET, friend: FRIEND }, // arrays don't sneak through
    { kind: 'nudge', id: ID, secret: SECRET.slice(1), friend: FRIEND }, // short secret
    { kind: 'test', id: ID, secret: 'z'.repeat(64) }, // non-hex secret
    { kind: 'test', id: ID },
  ];
  for (const body of bodies) {
    const res = await call({ body });
    assert.equal(res.statusCode, 400, JSON.stringify(body));
    assert.deepEqual(res.body, { error: 'bad request' });
  }
  assert.equal(calls.length, 0);
  assert.equal(push.vapid.length, 0);
});

test('buildPayload: every kind localized en/es/pt with en fallback', () => {
  assert.deepEqual(buildPayload('remind', { lang: 'es', streak: 5 }), { title: 'Motivation Scale', body: REMIND_ES + ' · racha de 5', url: '/scale', tag: 'scale-remind' });
  assert.equal(buildPayload('remind', { lang: 'en', streak: 3 }).body, REMIND_EN + ' · 3-day streak');
  assert.equal(buildPayload('remind', { lang: 'pt', streak: 0 }).body, REMIND_PT);
  assert.equal(buildPayload('remind', { lang: 'es-CL', streak: 2 }).body, REMIND_ES + ' · racha de 2');
  assert.equal(buildPayload('remind', { lang: 'fr', streak: null }).body, REMIND_EN);
  assert.equal(buildPayload('remind', {}).body, REMIND_EN);

  assert.deepEqual(buildPayload('nudge', { lang: 'pt', name: 'Ana', emoji: '🌊' }), { title: '🌊 Ana', body: 'está te dando um empurrão: registre seu dia 👊', url: '/scale', tag: 'scale-nudge' });
  assert.equal(buildPayload('nudge', { name: 'Ana', emoji: null }).title, 'Ana');
  assert.equal(buildPayload('nudge', {}).title, 'Motivation Scale');
  assert.equal(buildPayload('nudge', { lang: 'en', name: 'Ana' }).body, 'is nudging you: log your day 👊');

  assert.deepEqual(buildPayload('test', { lang: 'es' }), { title: 'Motivation Scale', body: 'Recordatorios activos. Nos vemos esta noche.', url: '/scale', tag: 'scale-test' });
  assert.equal(buildPayload('test', { lang: 'en' }).body, 'Reminders are on. See you tonight.');
  assert.equal(buildPayload('test', { lang: 'pt' }).body, 'Lembretes ativos. Até a noite.');
});

test('default export: live wiring answers without web-push and refuses before any RPC when the sender cannot arm', async () => {
  assert.equal(typeof liveHandler, 'function');
  const opt = mkRes();
  await liveHandler(mkReq({ method: 'OPTIONS' }), opt);
  assert.equal(opt.statusCode, 204);
  const get = mkRes();
  await liveHandler(mkReq({ method: 'GET' }), get);
  assert.equal(get.statusCode, 405);

  const KEYS = ['SCALE_CRON_TOKEN', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  const realFetch = globalThis.fetch;
  const realError = console.error;
  const fetched = [];
  const errors = [];
  try {
    for (const k of KEYS) delete process.env[k];
    const r1 = mkRes();
    await liveHandler(mkReq(remindReq()), r1);
    assert.equal(r1.statusCode, 503, 'nothing configured');

    // Configured, but web-push is either not installed here or rejects these keys:
    // either way it must refuse before scale_due marks anyone as reminded.
    Object.assign(process.env, { SCALE_CRON_TOKEN: TOKEN, VAPID_PUBLIC_KEY: 'x', VAPID_PRIVATE_KEY: 'x' });
    globalThis.fetch = async (...a) => { fetched.push(a); throw new Error('no network in tests'); };
    console.error = (...a) => { errors.push(a.join(' ')); };
    const r2 = mkRes();
    await liveHandler(mkReq(remindReq()), r2);
    assert.equal(r2.statusCode, 503);
    assert.deepEqual(r2.body, { error: 'not configured' });
    assert.equal(fetched.length, 0);
    assert.ok(errors.some((e) => e.includes('scale-push')));
  } finally {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    globalThis.fetch = realFetch;
    console.error = realError;
  }
});
