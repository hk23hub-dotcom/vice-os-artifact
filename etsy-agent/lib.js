// lib.js — shared Etsy Open API v3 helpers (no external deps; Node 20+).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = join(HERE, '..');
export const API = 'https://api.etsy.com/v3/application';
export const TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token';
export const CONNECT_URL = 'https://www.etsy.com/oauth/connect';

const CONFIG_PATH = join(HERE, 'config.json');
const TOKENS_PATH = join(HERE, 'tokens.json');

export function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error('Missing config.json — copy config.example.json to config.json and paste your keystring.');
  }
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
}

export function loadTokens() {
  if (!existsSync(TOKENS_PATH)) {
    throw new Error('Missing tokens.json — run `npm run oauth` first to authorize your shop.');
  }
  return JSON.parse(readFileSync(TOKENS_PATH, 'utf8'));
}

export function saveTokens(t) {
  writeFileSync(TOKENS_PATH, JSON.stringify(t, null, 2));
}

// Refresh the access token if it is within 2 minutes of expiry.
export async function getFreshAccessToken() {
  const cfg = loadConfig();
  const t = loadTokens();
  const now = Date.now();
  if (t.access_token && t.expires_at && now < t.expires_at - 120000) {
    return t.access_token;
  }
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: cfg.keystring,
    refresh_token: t.refresh_token,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error('Token refresh failed: ' + res.status + ' ' + (await res.text()));
  const j = await res.json();
  const next = {
    access_token: j.access_token,
    refresh_token: j.refresh_token || t.refresh_token,
    expires_at: now + (j.expires_in * 1000),
  };
  saveTokens(next);
  return next.access_token;
}

// Authenticated Etsy API call. `path` is relative to API base.
export async function api(path, { method = 'GET', body, isForm } = {}) {
  const cfg = loadConfig();
  const token = await getFreshAccessToken();
  const headers = {
    'x-api-key': cfg.sharedSecret ? `${cfg.keystring}:${cfg.sharedSecret}` : cfg.keystring,
    'Authorization': 'Bearer ' + token,
  };
  let payload = body;
  if (body && !isForm && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    payload = body instanceof URLSearchParams ? body : new URLSearchParams(body);
  }
  const res = await fetch(API + path, { method, headers, body: payload });
  const text = await res.text();
  if (!res.ok) throw new Error(`Etsy API ${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

// Resolve the authenticated user's shop_id (cached into tokens.json).
export async function getShopId() {
  const t = loadTokens();
  if (t.shop_id) return t.shop_id;
  const me = await api('/users/me');
  const shopId = me.shop_id;
  if (!shopId) throw new Error('No shop_id on this account — open your Etsy shop first.');
  saveTokens({ ...t, shop_id: shopId });
  return shopId;
}
