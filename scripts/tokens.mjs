// Genera design/hk23-tokens.css y design/hk23-tokens.json desde el :root de universe-os.html.
// Fuente única de verdad: el :root. Correr después de cambiar un token:  node scripts/tokens.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync(new URL('../universe-os.html', import.meta.url), 'utf8');
const m = html.match(/:root\s*\{([^}]*)\}/);
if (!m) { console.error('no encontré el :root'); process.exit(1); }
const tokens = {};
for (const line of m[1].split('\n')) {
  const t = line.match(/^\s*(--[a-z0-9-]+)\s*:\s*(.+?);\s*(\/\*.*\*\/)?\s*$/i);
  if (t) tokens[t[1]] = t[2].trim();
}
const fecha = new Date().toISOString().slice(0, 10);
const css = [
  `/* HK23 — tokens del universo · generado desde universe-os.html :root · ${fecha} */`,
  `/* Usar en cualquier proyecto: <link rel="stylesheet" href="https://hk23universe.vercel.app/design/hk23-tokens.css"> */`,
  ':root {', ...Object.entries(tokens).map(([k, v]) => `  ${k}: ${v};`), '}', ''
].join('\n');
const json = JSON.stringify({ nombre: 'HK23 UNIVERSE', fuente: 'universe-os.html :root', fecha,
  tokens: Object.fromEntries(Object.entries(tokens).map(([k, v]) => [k.replace(/^--/, ''), v])) }, null, 2) + '\n';
writeFileSync(new URL('../design/hk23-tokens.css', import.meta.url), css);
writeFileSync(new URL('../design/hk23-tokens.json', import.meta.url), json);
console.log(`${Object.keys(tokens).length} tokens → design/hk23-tokens.css + design/hk23-tokens.json`);
