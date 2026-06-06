// oauth.js — one-time Etsy OAuth 2.0 (PKCE) authorization.
// Run: npm run oauth → click "Allow" in the browser → tokens saved to tokens.json.
import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { execSync } from 'node:child_process';
import { loadConfig, saveTokens, TOKEN_URL, CONNECT_URL } from './lib.js';

const cfg = loadConfig();
if (!cfg.keystring || cfg.keystring.includes('PASTE')) {
  console.error('✗ Set your keystring in config.json first.');
  process.exit(1);
}

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const verifier = b64url(randomBytes(48));
const challenge = b64url(createHash('sha256').update(verifier).digest());
const state = b64url(randomBytes(16));

const authUrl = CONNECT_URL + '?' + new URLSearchParams({
  response_type: 'code',
  client_id: cfg.keystring,
  redirect_uri: cfg.redirectUri,
  scope: cfg.scopes,
  state,
  code_challenge: challenge,
  code_challenge_method: 'S256',
}).toString();

const port = Number(new URL(cfg.redirectUri).port) || 3003;

const server = createServer(async (req, res) => {
  if (!req.url.startsWith('/callback')) { res.writeHead(404); res.end(); return; }
  const url = new URL(req.url, cfg.redirectUri);
  const code = url.searchParams.get('code');
  const gotState = url.searchParams.get('state');
  if (!code || gotState !== state) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h2>Auth failed (missing code or bad state). Close this and re-run.</h2>');
    return;
  }
  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: cfg.keystring,
      redirect_uri: cfg.redirectUri,
      code,
      code_verifier: verifier,
    });
    const r = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const j = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(j));
    saveTokens({
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_at: Date.now() + j.expires_in * 1000,
    });
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h2 style="font-family:sans-serif">✓ Authorized. Tokens saved. You can close this tab.</h2>');
    console.log('\n✓ Success — tokens saved to tokens.json. You can now run: npm run publish:dry');
    setTimeout(() => process.exit(0), 300);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end('<h2>Token exchange failed. See terminal.</h2>');
    console.error('✗ Token exchange failed:', e.message);
    setTimeout(() => process.exit(1), 300);
  }
});

server.listen(port, () => {
  console.log('\n1. Open this URL in your browser and click "Allow":\n');
  console.log('   ' + authUrl + '\n');
  console.log('   (waiting for the redirect on ' + cfg.redirectUri + ' ...)');
  try { execSync('open ' + JSON.stringify(authUrl)); } catch { /* user opens manually */ }
});
