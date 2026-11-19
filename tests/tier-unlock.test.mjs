// api/tier-unlock.js — GET dice qué planes están a la venta; POST verifica la licencia con Gumroad.
// Handler puro: req/res de mentira y fetch de mentira (nunca sale a la red).
import { test } from 'node:test';
import assert from 'node:assert/strict';

const VARS = ['GUMROAD_PREMIUM_PERMALINK', 'GUMROAD_FULL_PERMALINK', 'GUMROAD_TEMPLATE_HK23_PERMALINK', 'GUMROAD_TEMPLATE_GENESIS_PERMALINK'];

// Los permalinks se leen al importar: cada caso importa su propia copia del módulo.
async function cargar(env, tag) {
  const antes = {};
  for (const k of VARS) { antes[k] = process.env[k]; delete process.env[k]; }
  Object.assign(process.env, env);
  try { return (await import('../api/tier-unlock.js?' + tag)).default; }
  finally { for (const k of VARS) { if (antes[k] === undefined) delete process.env[k]; else process.env[k] = antes[k]; } }
}
function res() {
  const r = { code: 0, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.end = () => r;
  return r;
}
async function conFetch(fake, fn) {
  const orig = globalThis.fetch; const llamadas = [];
  globalThis.fetch = async (url, opts) => { llamadas.push({ url: String(url), opts }); return fake(url, opts); };
  try { await fn(); } finally { globalThis.fetch = orig; }
  return llamadas;
}
const gumroad = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('GET sin productos configurados: todo en PENDING → venta:false', async () => {
  const h = await cargar({}, 'vacio'); const r = res();
  await h({ method: 'GET', headers: {} }, r);
  assert.equal(r.code, 200);
  assert.deepEqual(r.body, { ok: true, planes: {
    premium: { venta: false }, full: { venta: false }, template_hk23: { venta: false }, template_genesis: { venta: false } } });
});

test('GET con un producto configurado: ese plan sale a la venta con su permalink', async () => {
  const h = await cargar({ GUMROAD_PREMIUM_PERMALINK: 'prueba-premium' }, 'premium'); const r = res();
  await h({ method: 'GET', headers: {} }, r);
  assert.equal(r.code, 200);
  assert.deepEqual(r.body.planes.premium, { venta: true, permalink: 'prueba-premium' });
  assert.deepEqual(r.body.planes.full, { venta: false });
  assert.match(r.headers['access-control-allow-methods'], /GET/);
});

test('POST a un plan PENDING: 503 y no llama a Gumroad', async () => {
  const h = await cargar({}, 'pending'); const r = res();
  const llamadas = await conFetch(() => { throw new Error('no debía llamar'); }, () =>
    h({ method: 'POST', headers: {}, body: { tier: 'full', license_key: 'AAAAAAAA-BBBBBBBB' } }, r));
  assert.equal(r.code, 503);
  assert.equal(r.body.ok, false);
  assert.equal(llamadas.length, 0);
});

test('POST con licencia válida → ok; con licencia inválida → mensaje claro', async () => {
  const h = await cargar({ GUMROAD_FULL_PERMALINK: 'prueba-full' }, 'full');
  const ok = res();
  const ll = await conFetch(() => gumroad(200, { success: true, uses: 1, purchase: { email: 'comprador@example.com' } }), () =>
    h({ method: 'POST', headers: {}, body: { tier: 'full', license_key: 'AAAAAAAA-BBBBBBBB' } }, ok));
  assert.equal(ok.body.ok, true);
  assert.equal(ok.body.tier, 'full');
  assert.equal(ok.body.email, 'c***@example.com');
  assert.match(ll[0].url, /api\.gumroad\.com\/v2\/licenses\/verify/);
  assert.match(String(ll[0].opts.body), /product_permalink=prueba-full/);
  const mal = res();
  await conFetch(() => gumroad(404, { success: false, message: 'That license does not exist for the provided product.' }), () =>
    h({ method: 'POST', headers: {}, body: { tier: 'full', license_key: 'ZZZZZZZZ-ZZZZZZZZ' } }, mal));
  assert.equal(mal.body.ok, false);
  assert.match(mal.body.error, /no válida/);
});

test('otros métodos: 405', async () => {
  const h = await cargar({}, 'metodo'); const r = res();
  await h({ method: 'PUT', headers: {} }, r);
  assert.equal(r.code, 405);
});
