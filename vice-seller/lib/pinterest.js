// pinterest.js — traffic channel. Creates a Pin per published listing that
// links back to its Etsy URL. Uses the Pinterest API v5 when a token is set.
// Dormant otherwise (the browser-assisted fallback is driven separately).
import { secrets } from './secrets.js';

const BASE = 'https://api.pinterest.com/v5';
export const pinterestReady = () => !!(secrets().pinterestToken && secrets().pinterestBoardId);

export async function createPin({ title, description, link, imageUrl }) {
  const s = secrets();
  if (!pinterestReady()) throw new Error('pinterest not configured');
  const r = await fetch(`${BASE}/pins`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${s.pinterestToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      board_id: s.pinterestBoardId,
      title: title.slice(0, 100),
      description: description.slice(0, 500),
      link,
      media_source: { source_type: 'image_url', url: imageUrl },
    }),
  });
  if (!r.ok) throw new Error(`pinterest pin ${r.status}: ${await r.text()}`);
  return (await r.json()).id;
}
