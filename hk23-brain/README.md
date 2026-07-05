# HK23 Brain — Aria (resident in Vice OS)

The reflective layer the constitution gives Vice OS. Aria reads the live `hk23` graph and **proposes**
connections; **you** decide which are real. She never forces, never deletes (Laws L12/L13; Review Note O5).

## Run (dry-run — works now, no DB needed)
```bash
node hk23-brain/aria.mjs
```
Prints proposed `ai_suggested` (Similarity) links over a sample graph.

## Run against your live Supabase
```bash
SUPABASE_URL="https://<project>.supabase.co" SUPABASE_KEY="<service-or-anon-key>" \
  node hk23-brain/aria.mjs            # read + propose (no writes)

SUPABASE_URL=… SUPABASE_KEY=… node hk23-brain/aria.mjs --write   # persist as ai_suggested
```
Aria writes only `source='ai'` / `type='ai_suggested'` edges. Promoting one to `source='manual'`
(Resonance) is **your** act — that's the human validation that turns machine similarity into meaning.

## Why this is the connection
This is the constitution's **brain** operating on Vice OS's **body**: same O5 distinction the Supabase
schema already encodes (`source: ai | manual`), now driven by an agent. Next: embeddings for smarter
similarity, and wiring Aria's daily run into the Vice OS cosmos.
