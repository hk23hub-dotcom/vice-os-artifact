// caption.js — vision upgrade. Describes each artwork with Claude so the SEO
// matches the real image instead of a generic template. Dormant (returns null)
// until an Anthropic key is present, in which case the orchestrator uses it.
import { secrets } from './secrets.js';

const MODEL = 'claude-3-5-haiku-latest'; // cheap + fast for captioning at scale
const SYS = `You are an Etsy print-shop merchandiser. Look at the artwork and reply with STRICT JSON:
{"subject":"2-4 word literal subject","style":"1-2 word art style","theme":"1 word room/mood","palette":"1-2 word colour","keywords":["buyer search term", ...up to 6]}
No prose, JSON only. Keywords must be real Etsy buyer searches for wall art.`;

export function captioner() {
  const { anthropicKey } = secrets();
  if (!anthropicKey) return null; // signal: fall back to template SEO
  return async function caption(item) {
    const img = await fetch(item.thumb).then((r) => r.arrayBuffer());
    const b64 = Buffer.from(img).toString('base64');
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL, max_tokens: 300, system: SYS,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/webp', data: b64 } },
            { type: 'text', text: 'Caption this artwork for an Etsy print listing.' },
          ],
        }],
      }),
    });
    if (!r.ok) throw new Error(`caption ${r.status}: ${await r.text()}`);
    const j = await r.json();
    const txt = (j.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
    try { return JSON.parse(txt); } catch { return null; }
  };
}
