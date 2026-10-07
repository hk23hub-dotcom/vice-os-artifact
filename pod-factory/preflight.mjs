// preflight.mjs — revisa la tienda ANTES de publicar nada.
// Printify envía precios y tarifas como número en USD, sin convertir. Si la tienda Shopify
// está en otra moneda (hoy: CLP), un poster de US$8,93 queda a la venta en $9 pesos.
// Mientras la tienda tenga password nadie puede comprar; el peligro es abrirla así.
//
//   exit 0 → se puede publicar
//   exit 2 → tienda ABIERTA con moneda equivocada: no publicar, avisar al dueño
//
//   node preflight.mjs
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const led = join(HERE, 'data', 'printify-ledger.json');
let domain = 'fcqevq-jr.myshopify.com';
if (existsSync(led)) {
  const any = Object.values(JSON.parse(readFileSync(led, 'utf8'))).find((e) => e.external?.handle);
  if (any) domain = new URL(any.external.handle).host;
}

let meta = null, abierta = null;
try { meta = await fetch(`https://${domain}/meta.json`).then((r) => (r.ok ? r.json() : null)); } catch {}
try {
  const r = await fetch(`https://${domain}/`, { redirect: 'manual' });
  abierta = !(r.status >= 300 && r.status < 400 && /\/password/.test(r.headers.get('location') || ''));
} catch {}

if (!meta) { console.log(`preflight: no pude leer ${domain}/meta.json — sigo, pero revisa la tienda a mano.`); process.exit(0); }

const okMoneda = meta.currency === 'USD';
console.log(`preflight · ${meta.name} (${domain})`);
console.log(`  moneda ${meta.currency}${okMoneda ? ' ✓' : ' ✗ debe ser USD'} · tienda ${abierta ? 'ABIERTA' : 'con password'} · despacha a ${meta.ships_to_countries?.length ?? '?'} destinos`);

if (!okMoneda && abierta) {
  console.log('  ✗ PELIGRO: la tienda está abierta y en moneda distinta de USD. Los precios se leen en esa moneda.');
  console.log('    No se publica nada hasta corregirlo: Shopify → Settings → General → Store currency → USD.');
  process.exit(2);
}
if (!okMoneda) console.log('  ! Antes de quitar el password: Shopify → Settings → General → Store currency → USD.');
process.exit(0);
