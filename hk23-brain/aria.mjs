#!/usr/bin/env node
// Aria — the HK23 brain, resident in Vice OS.
// Reads the live Supabase `hk23` graph and PROPOSES `ai_suggested` connections (Similarity — machine).
// The human confirms meaningful ones to source='manual' (Resonance). This is Review Note O5 + Law L13:
// the machine suggests; the human validates meaning. Aria NEVER writes 'manual' and never deletes.
//
// Dry-run by default (prints proposals). Pass --write to POST ai_suggested edges to Supabase.
// Env: SUPABASE_URL, SUPABASE_KEY (service or anon with write). No deps — plain Node ESM.

const WRITE = process.argv.includes('--write');
const { SUPABASE_URL, SUPABASE_KEY } = process.env;

// Sample graph so Aria runs even with no DB connected (Principle 5 — it works now).
const MOCK = [
  { id: 'a1', name: 'Vicegolfer', summary: 'golf community and content world' },
  { id: 'a2', name: 'Putting Lab blueprint', summary: 'training facility design for putting practice golf' },
  { id: 'a3', name: 'Etsy art shop', summary: 'surreal AI art prints for sale' },
  { id: 'a4', name: 'Arteworld', summary: 'immersive surreal AI art universe' },
  { id: 'a5', name: 'Club tournaments', summary: 'golf tournament builder and player roles' },
];

async function fetchEntities() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return { source: 'mock (no SUPABASE_URL set)', rows: MOCK };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/entities?select=id,name,summary,kind,state&limit=300`, {
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Accept-Profile': 'hk23' },
  });
  if (!r.ok) throw new Error('Supabase read HTTP ' + r.status);
  return { source: 'supabase (live)', rows: await r.json() };
}

const words = (s) => new Set((s || '').toLowerCase().match(/[a-z0-9]+/g) || []);
function jaccard(a, b) {
  const A = words(a), B = words(b); let i = 0;
  for (const w of A) if (B.has(w)) i++;
  const u = A.size + B.size - i; return u ? i / u : 0;
}
function propose(rows) {
  const out = [];
  for (let i = 0; i < rows.length; i++)
    for (let j = i + 1; j < rows.length; j++) {
      const s = jaccard(rows[i].name + ' ' + rows[i].summary, rows[j].name + ' ' + rows[j].summary);
      if (s >= 0.12) out.push({ from: rows[i], to: rows[j], strength: Math.min(0.9, Math.round(s * 100) / 100) });
    }
  return out.sort((a, b) => b.strength - a.strength).slice(0, 12);
}
async function writeEdge(p) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/relationships`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', 'Content-Profile': 'hk23', Prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify({ from_id: p.from.id, to_id: p.to.id, type: 'ai_suggested', source: 'ai', strength: p.strength }),
  });
  return r.ok;
}

(async () => {
  const { source, rows } = await fetchEntities();
  const proposals = propose(rows);
  console.log(`Aria · read ${rows.length} entities from ${source}`);
  console.log(`Aria proposes ${proposals.length} SIMILARITY links (source='ai', type='ai_suggested').`);
  console.log("These are suggestions only — YOU confirm the meaningful ones to source='manual' = Resonance (O5 / L13).\n");
  for (const p of proposals) console.log(`  ~${p.strength}  ${p.from.name}  ⟷  ${p.to.name}`);
  if (WRITE && SUPABASE_URL && SUPABASE_KEY) {
    let n = 0; for (const p of proposals) if (await writeEdge(p)) n++;
    console.log(`\nWrote ${n} ai_suggested edges to Supabase — awaiting your human validation (promote to 'manual').`);
  } else {
    console.log("\n(dry-run — no writes. Run with SUPABASE_URL=… SUPABASE_KEY=… node aria.mjs --write to persist as ai_suggested.)");
  }
})().catch((e) => { console.error('Aria error:', e.message); process.exit(1); });
