// Prueba de la Edge Function socios-shopify (firma HMAC + traducción de pedidos) en Node.
// Correr con: node --experimental-strip-types probar-webhook.mjs
import { createHmac } from 'node:crypto';
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
const { manejar, argumentos, firmaValida } = await import(process.env.REPO + '/supabase/functions/socios-shopify/index.ts');

const SECRETO = 'shpss_secreto_de_prueba';
const ENV = { secreto: SECRETO, sbUrl: 'https://x.supabase.co/', sbKey: 'svc' };
const firmar = (cuerpo, s = SECRETO) => createHmac('sha256', s).update(cuerpo, 'utf8').digest('base64');
function pedido(tema, obj, opts = {}) {
  const cuerpo = typeof obj === 'string' ? obj : JSON.stringify(obj);
  const headers = { 'content-type': 'application/json', 'x-shopify-topic': tema,
    'x-shopify-hmac-sha256': opts.firma ?? firmar(cuerpo) };
  return new Request('https://f.supabase.co/functions/v1/socios-shopify', { method: opts.method || 'POST', headers, body: opts.method === 'GET' ? undefined : cuerpo });
}
function fakeFetch(status = 200, body = { ok: true, atribuida: true }) {
  const calls = [];
  const f = async (url, init) => { calls.push({ url, init, args: JSON.parse(init.body) }); return new Response(JSON.stringify(body), { status }); };
  f.calls = calls;
  return f;
}

const PAGADO = { id: 5512345678901, admin_graphql_api_id: 'gid://shopify/Order/5512345678901', name: '#1001',
  subtotal_price: '35.50', current_subtotal_price: '35.50', total_price: '44.00', total_line_items_price: '39.45', total_discounts: '3.95',
  discount_codes: [{ code: 'HK23-ANAP', amount: '3.95', type: 'percentage' }], email: 'cliente@x.com',
  line_items: [{ id: 1, admin_graphql_api_id: 'gid://shopify/LineItem/1' }] };

ok(await firmaValida('hola', firmar('hola'), SECRETO), 'firma correcta se acepta');
ok(!(await firmaValida('hola', firmar('hola', 'otro'), SECRETO)), 'firma con otro secreto se rechaza');
ok(!(await firmaValida('hola', '', SECRETO)), 'sin firma se rechaza');

let f = fakeFetch();
let r = await manejar(pedido('orders/paid', PAGADO), ENV, f);
ok(r.status === 200 && f.calls.length === 1, 'pedido pagado con código: llama a la base una vez');
const a = f.calls[0].args;
ok(f.calls[0].url === 'https://x.supabase.co/rest/v1/rpc/socios_registrar_shopify', 'llama a la RPC correcta (sin doble barra)');
ok(f.calls[0].init.headers.apikey === 'svc' && f.calls[0].init.headers.authorization === 'Bearer svc', 'usa la service role');
ok(a.p_evento === 'pagado' && a.p_pedido === '5512345678901' && a.p_monto === 35.5 && a.p_nombre === '#1001'
  && JSON.stringify(a.p_codigos) === '["HK23-ANAP"]', 'traduce pedido, monto sin envío ni impuestos y códigos');
ok(!JSON.stringify(a).includes('cliente@x.com'), 'no manda el correo del comprador a la base');
ok(a.p_lista === 39.45, 'manda el precio de lista antes del descuento (39,45) para calcular el costo');
const sinLista = argumentos('orders/paid', { ...PAGADO, total_line_items_price: undefined }, JSON.stringify(PAGADO));
ok(sinLista.p_lista === 39.45, 'sin precio de lista, lo reconstruye: pagado + descuentos');

// id de 18 dígitos (más que 2^53): escrito a mano porque JSON.stringify ya lo redondearía
const GRANDE = '{"id":820982911946154508,"admin_graphql_api_id":"gid://shopify/Order/820982911946154508","name":"#9",'
  + '"subtotal_price":"10.00","discount_codes":[{"code":"HK23-ANAP"}]}';
f = fakeFetch();
await manejar(pedido('orders/paid', GRANDE), ENV, f);
ok(f.calls[0].args.p_pedido === '820982911946154508', 'id de pedido enorme llega exacto (no se redondea)');
const RGRANDE = '{"id":929361464,"admin_graphql_api_id":"gid://shopify/Refund/929361464","order_id":820982911946154508,'
  + '"refund_line_items":[{"subtotal":"10.00"}]}';
f = fakeFetch();
await manejar(pedido('refunds/create', RGRANDE), ENV, f);
ok(f.calls[0].args.p_pedido === '820982911946154508' && f.calls[0].args.p_reembolso_id === '929361464', 'reembolso de pedido enorme: ids exactos');

f = fakeFetch();
r = await manejar(pedido('orders/paid', PAGADO, { firma: firmar(JSON.stringify(PAGADO), 'falso') }), ENV, f);
ok(r.status === 401 && f.calls.length === 0, 'firma falsa: 401 y no toca la base');

f = fakeFetch();
const alterado = JSON.stringify(PAGADO);
r = await manejar(pedido('orders/paid', alterado.replace('35.50', '9999'), { firma: firmar(alterado) }), ENV, f);
ok(r.status === 401 && f.calls.length === 0, 'cuerpo alterado después de firmar: 401');

f = fakeFetch();
r = await manejar(pedido('orders/paid', { ...PAGADO, discount_codes: [] }), ENV, f);
ok(r.status === 200 && f.calls.length === 0 && (await r.json()).ignorado, 'pedido sin código: se ignora sin tocar la base');

f = fakeFetch();
r = await manejar(pedido('products/update', { id: 1 }), ENV, f);
ok(r.status === 200 && f.calls.length === 0, 'otros temas se ignoran');

f = fakeFetch();
await manejar(pedido('orders/cancelled', { id: 555 }), ENV, f);
ok(f.calls[0].args.p_evento === 'cancelado' && f.calls[0].args.p_pedido === '555', 'cancelación → evento cancelado');

const REEMB = { id: 929361464, admin_graphql_api_id: 'gid://shopify/Refund/929361464', order_id: 5512345678901,
  refund_line_items: [{ subtotal: 10.5 }, { subtotal: '4.5' }],
  transactions: [{ kind: 'refund', status: 'success', amount: '19.00' }] };
f = fakeFetch();
await manejar(pedido('refunds/create', REEMB), ENV, f);
let ra = f.calls[0].args;
ok(ra.p_evento === 'reembolso' && ra.p_pedido === '5512345678901' && ra.p_reembolso_id === '929361464' && ra.p_reembolso === 15,
  'reembolso: suma el subtotal de las líneas devueltas (15, sin envío)');
ra = argumentos('refunds/create', { id: 1, order_id: 2, refund_line_items: [], transactions: [{ kind: 'refund', status: 'success', amount: '7.25' }, { kind: 'refund', status: 'failure', amount: '99' }] });
ok(ra.p_reembolso === 7.25, 'reembolso sin líneas: usa las transacciones exitosas');

f = fakeFetch(500, { message: 'caída' });
r = await manejar(pedido('orders/paid', PAGADO), ENV, f);
ok(r.status === 502, 'si la base falla, responde 5xx para que Shopify reintente');
f = fakeFetch(400, { message: 'socios: pedido_invalido' });
r = await manejar(pedido('orders/paid', PAGADO), ENV, f);
ok(r.status === 200 && (await r.json()).ok === false, 'si la base rechaza el dato, no fuerza reintentos');

r = await manejar(pedido('orders/paid', PAGADO, { method: 'GET' }), ENV, fakeFetch());
ok(r.status === 405, 'GET: 405');
r = await manejar(pedido('orders/paid', PAGADO), { ...ENV, secreto: '' }, fakeFetch());
ok(r.status === 503, 'sin secreto configurado: 503');
r = await manejar(pedido('orders/paid', 'no es json{'), ENV, fakeFetch());
ok(r.status === 400, 'JSON roto con firma válida: 400');
