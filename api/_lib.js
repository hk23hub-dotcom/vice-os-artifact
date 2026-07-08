// Shared helpers for HK23 serverless endpoints — safe body parse, CORS allowlist,
// best-effort in-memory rate limiting, email masking.

// Parse a request body without ever throwing (Vercel delivers a raw string for
// non-JSON content types). Returns { ok, body }.
export function parseBody(req) {
  try {
    if (req.body == null) return { ok: true, body: {} };
    if (typeof req.body === 'string') return { ok: true, body: JSON.parse(req.body || '{}') };
    return { ok: true, body: req.body };
  } catch (_) {
    return { ok: false, body: null };
  }
}

// Only reflect an Origin we actually own. Same-origin client calls don't need
// this header at all; it exists to stop other sites from calling our paid APIs.
const ORIGIN_OK = [
  /^https:\/\/hk23universe(-[a-z0-9-]+)?\.vercel\.app$/, // prod + preview deploys
  /^https:\/\/([a-z0-9-]+\.)?hk23\.[a-z.]+$/,            // future custom domain
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];
export function applyCors(req, res, methods) {
  const origin = req.headers.origin || '';
  if (origin && ORIGIN_OK.some((re) => re.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization, x-run-token');
  res.setHeader('Access-Control-Allow-Methods', (methods || 'POST, OPTIONS'));
}

export function clientIp(req) {
  const xff = (req.headers['x-forwarded-for'] || '').toString();
  if (xff) return xff.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

// Best-effort sliding-window limiter. Shared only within a warm lambda instance
// (no external store here), but that still throttles the abuse loops that matter.
const _hits = new Map();
export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const arr = (_hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { _hits.set(key, arr); return false; }
  arr.push(now); _hits.set(key, arr);
  if (_hits.size > 5000) { for (const k of _hits.keys()) { if (k !== key) { _hits.delete(k); if (_hits.size <= 4000) break; } } }
  return true;
}

export function maskEmail(e) {
  if (!e || typeof e !== 'string') return null;
  return e.replace(/^(.).*(@.*)$/, '$1***$2');
}
