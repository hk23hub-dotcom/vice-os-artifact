// printify.js — physical print-on-demand channel (canvas + poster).
// Uploads the artwork, creates products on chosen blueprints, and publishes
// them to the connected Etsy shop. Dormant until a Printify token + shop id.
// API: https://developers.printify.com  (v1, Bearer token)
import { secrets } from './secrets.js';

const BASE = 'https://api.printify.com/v1';

function authed() {
  const s = secrets();
  if (!s.printifyToken || !s.printifyShopId) return null;
  const h = { Authorization: `Bearer ${s.printifyToken}`, 'Content-Type': 'application/json' };
  return { h, shop: s.printifyShopId };
}
export const printifyReady = () => !!authed();

// Catalog blueprints worth selling prints on (Printify ids; verified at runtime).
export const BLUEPRINTS = {
  poster: { blueprint_id: 5,   label: 'Poster' },          // "Poster" (Generic brand)
  canvas: { blueprint_id: 50,  label: 'Canvas' },          // "Matte Canvas, Stretched"
};

export async function uploadImage(url, name) {
  const a = authed(); if (!a) throw new Error('printify not configured');
  const r = await fetch(`${BASE}/uploads/images.json`, {
    method: 'POST', headers: a.h, body: JSON.stringify({ file_name: name, url }),
  });
  if (!r.ok) throw new Error(`printify upload ${r.status}: ${await r.text()}`);
  return (await r.json()).id; // image id used in print_areas
}

// pick the first print provider + its variants for a blueprint
async function providerAndVariants(blueprintId) {
  const a = authed();
  const provs = await fetch(`${BASE}/catalog/blueprints/${blueprintId}/print_providers.json`, { headers: a.h }).then((r) => r.json());
  const pp = provs[0].id;
  const vs = await fetch(`${BASE}/catalog/blueprints/${blueprintId}/print_providers/${pp}/variants.json`, { headers: a.h }).then((r) => r.json());
  return { pp, variants: vs.variants };
}

export async function createProduct({ kind, title, description, imageId, markup }) {
  const a = authed(); if (!a) throw new Error('printify not configured');
  const bp = BLUEPRINTS[kind];
  const { pp, variants } = await providerAndVariants(bp.blueprint_id);
  const variant_ids = variants.map((v) => v.id);
  const body = {
    title, description, blueprint_id: bp.blueprint_id, print_provider_id: pp,
    variants: variants.map((v) => ({ id: v.id, price: Math.round(v.cost * markup), is_enabled: true })),
    print_areas: [{ variant_ids, placeholders: [{ position: 'front', images: [{ id: imageId, x: 0.5, y: 0.5, scale: 1, angle: 0 }] }] }],
  };
  const r = await fetch(`${BASE}/shops/${a.shop}/products.json`, { method: 'POST', headers: a.h, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`printify product ${r.status}: ${await r.text()}`);
  return (await r.json()).id;
}

export async function publish(productId) {
  const a = authed();
  const r = await fetch(`${BASE}/shops/${a.shop}/products/${productId}/publish.json`, {
    method: 'POST', headers: a.h,
    body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
  });
  if (!r.ok) throw new Error(`printify publish ${r.status}: ${await r.text()}`);
  return true;
}
