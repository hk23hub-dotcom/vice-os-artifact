// etsy.js — VICE SELLER Etsy channel. Creates a digital-download listing,
// attaches the artwork as the listing photo AND the downloadable file.
// Reuses the approved etsy-agent OAuth/token layer (single source of truth).
import { readFileSync } from 'node:fs';
import { api, getShopId, getFreshAccessToken } from '../../etsy-agent/lib.js';
import { loadConfig } from './sources.js';

const API = 'https://api.etsy.com/v3/application';
const KEYSTRING = JSON.parse(
  readFileSync(new URL('../../etsy-agent/config.json', import.meta.url), 'utf8'),
).keystring;

// download the full-res image into memory (png, with webp fallback)
export async function fetchImage(url) {
  const r = await fetch(url);
  if (!r.ok) {
    const alt = url.replace('/0_0.png', '/0_0_2048_N.webp');
    const r2 = await fetch(alt);
    if (!r2.ok) throw new Error(`image fetch failed: ${url} (${r.status})`);
    return { buf: Buffer.from(await r2.arrayBuffer()), type: 'image/webp', ext: 'webp' };
  }
  return { buf: Buffer.from(await r.arrayBuffer()), type: 'image/png', ext: 'png' };
}

// 1) create the draft listing
export async function createDraft(seo) {
  const cfg = loadConfig();
  const shopId = await getShopId();
  const d = cfg.listingDefaults;
  const body = new URLSearchParams({
    quantity: String(d.quantity),
    title: seo.title,
    description: seo.description,
    price: String(seo.price),
    who_made: d.who_made,
    when_made: d.when_made,
    taxonomy_id: String(d.taxonomy_id),
    type: d.type,
    is_digital: 'true',
    should_auto_renew: 'false',
    state: 'draft',
  });
  seo.tags.slice(0, 13).forEach((t) => body.append('tags', t));
  const res = await api(`/shops/${shopId}/listings`, { method: 'POST', body });
  return res.listing_id;
}

async function multipart(path, fields) {
  const shopId = await getShopId();
  const token = await getFreshAccessToken();
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v && v.blob) fd.append(k, v.blob, v.name);
    else fd.append(k, String(v));
  }
  const r = await fetch(`${API}/shops/${shopId}${path}`, {
    method: 'POST',
    headers: { 'x-api-key': KEYSTRING, Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!r.ok) throw new Error(`${path} ${r.status}: ${await r.text()}`);
  return r.json();
}

// 2) attach the artwork as the listing photo
export async function uploadImage(listingId, img) {
  const j = await multipart(`/listings/${listingId}/images`, {
    image: { blob: new Blob([img.buf], { type: img.type }), name: `art.${img.ext}` },
    rank: 1,
  });
  return j.listing_image_id;
}

// 3) attach the downloadable digital file
export async function uploadFile(listingId, img, name) {
  const j = await multipart(`/listings/${listingId}/files`, {
    file: { blob: new Blob([img.buf], { type: img.type }), name: `${name}.${img.ext}` },
    name: `${name}.${img.ext}`,
    rank: 1,
  });
  return j.listing_file_id;
}

// optionally flip the draft to active (this is when the $0.20 fee hits)
export async function activate(listingId) {
  const shopId = await getShopId();
  await api(`/shops/${shopId}/listings/${listingId}`, {
    method: 'PUT',
    body: new URLSearchParams({ state: 'active' }),
  });
}
