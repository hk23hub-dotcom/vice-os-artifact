// HK23 — Freelancers Fundadores · webhook de Shopify (Supabase Edge Function "socios-shopify").
//
// Shopify avisa cada pedido pagado, cancelado o reembolsado de la tienda HK23 STUDIO. Esta función:
//   1. verifica la firma HMAC del webhook con SHOPIFY_WEBHOOK_SECRET (sin firma válida no se registra nada);
//   2. llama a la función socios_registrar_shopify de la base con la service role.
// Un pedido se atribuye a un socio solo si usó su código de descuento; el resto se ignora.
//
// Despliegue (una vez):  supabase functions deploy socios-shopify --no-verify-jwt
// Secreto:               supabase secrets set SHOPIFY_WEBHOOK_SECRET=<clave que muestra Shopify>
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya existen dentro de las Edge Functions.
// Pasos completos: socios/CHECKLIST.md

export interface Entorno {
  secreto: string;
  sbUrl: string;
  sbKey: string;
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const enc = new TextEncoder();

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function igual(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function firmaValida(cuerpo: string, firma: string, secreto: string): Promise<boolean> {
  if (!firma || !secreto) return false;
  const clave = await crypto.subtle.importKey('raw', enc.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', clave, enc.encode(cuerpo)));
  let bin = '';
  for (const b of mac) bin += String.fromCharCode(b);
  return igual(btoa(bin), firma.trim());
}

function numero(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Los ids de Shopify pueden superar 2^53: se toman del texto crudo (gid://shopify/Order/123…) y no del número ya parseado.
function idExacto(cuerpo: string, patron: RegExp, respaldo: unknown): string | null {
  const m = patron.exec(cuerpo);
  if (m) return m[1];
  return respaldo == null ? null : String(respaldo);
}

// Traduce el payload de Shopify a los argumentos de socios_registrar_shopify (null = no hay nada que registrar).
export function argumentos(tema: string, o: Record<string, any>, cuerpo = ''): Record<string, unknown> | null {
  if (tema === 'orders/paid') {
    const codigos = (Array.isArray(o.discount_codes) ? o.discount_codes : [])
      .map((d: any) => String((d && d.code) || '').trim())
      .filter((c: string) => c.length > 0);
    const pedido = idExacto(cuerpo, /gid:\/\/shopify\/Order\/(\d+)/, o.id);
    if (!codigos.length || !pedido) return null;
    // base de la comisión: productos después de descuentos, sin envío ni impuestos (moneda de la tienda)
    const monto = numero(o.current_subtotal_price ?? o.subtotal_price ?? o.total_price);
    return { p_evento: 'pagado', p_pedido: pedido, p_nombre: String(o.name || ''), p_codigos: codigos, p_monto: monto };
  }
  if (tema === 'orders/cancelled') {
    const pedido = idExacto(cuerpo, /gid:\/\/shopify\/Order\/(\d+)/, o.id);
    if (!pedido) return null;
    return { p_evento: 'cancelado', p_pedido: pedido };
  }
  if (tema === 'refunds/create') {
    const pedido = idExacto(cuerpo, /"order_id"\s*:\s*(\d+)/, o.order_id);
    const reembolso = idExacto(cuerpo, /gid:\/\/shopify\/Refund\/(\d+)/, o.id);
    if (!pedido || !reembolso) return null;
    const lineas = Array.isArray(o.refund_line_items) ? o.refund_line_items : [];
    let monto = lineas.reduce((s: number, l: any) => s + numero(l && l.subtotal), 0);
    if (!lineas.length) {
      monto = (Array.isArray(o.transactions) ? o.transactions : [])
        .filter((t: any) => t && t.kind === 'refund' && t.status !== 'failure' && t.status !== 'error')
        .reduce((s: number, t: any) => s + numero(t.amount), 0);
    }
    return { p_evento: 'reembolso', p_pedido: pedido, p_reembolso_id: reembolso, p_reembolso: Math.round(monto * 100) / 100 };
  }
  return null;
}

export async function manejar(req: Request, env: Entorno, f: Fetch = fetch): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  if (!env.secreto || !env.sbUrl || !env.sbKey) return json(503, { error: 'Falta configurar el webhook.' });

  const cuerpo = await req.text();
  if (!(await firmaValida(cuerpo, req.headers.get('x-shopify-hmac-sha256') || '', env.secreto))) {
    return json(401, { error: 'Firma inválida.' });
  }
  let o: Record<string, any>;
  try { o = JSON.parse(cuerpo); } catch (_) { return json(400, { error: 'JSON inválido.' }); }

  const args = argumentos(req.headers.get('x-shopify-topic') || '', o || {}, cuerpo);
  if (!args) return json(200, { ok: true, ignorado: true });

  const r = await f(env.sbUrl.replace(/\/+$/, '') + '/rest/v1/rpc/socios_registrar_shopify', {
    method: 'POST',
    headers: { apikey: env.sbKey, authorization: 'Bearer ' + env.sbKey, 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  const texto = await r.text();
  // Un 5xx hace que Shopify reintente; los datos que la base rechaza (400) no mejoran reintentando.
  if (r.status >= 500) return json(502, { error: 'La base no respondió.' });
  if (!r.ok) return json(200, { ok: false, rechazado: texto.slice(0, 200) });
  return new Response(texto || '{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } });
}

// En Supabase (Deno) atiende pedidos; importado desde las pruebas en Node no hace nada.
const D = (globalThis as any).Deno;
if (D && typeof D.serve === 'function') {
  D.serve((req: Request) => manejar(req, {
    secreto: D.env.get('SHOPIFY_WEBHOOK_SECRET') || '',
    sbUrl: D.env.get('SUPABASE_URL') || '',
    sbKey: D.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
  }));
}
