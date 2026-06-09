// secrets.js — loads gitignored credentials from config.local.json (or env).
// Nothing secret is ever committed. Keys are optional; channels that need a
// missing key stay dormant until it is provided.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './sources.js';

let cache;
export function secrets() {
  if (cache) return cache;
  const path = join(ROOT, 'config.local.json');
  const file = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  cache = {
    anthropicKey: process.env.ANTHROPIC_API_KEY || file.anthropicKey || null,
    printifyToken: process.env.PRINTIFY_API_TOKEN || file.printifyToken || null,
    printifyShopId: process.env.PRINTIFY_SHOP_ID || file.printifyShopId || null,
    pinterestToken: process.env.PINTEREST_TOKEN || file.pinterestToken || null,
    pinterestBoardId: file.pinterestBoardId || null,
  };
  return cache;
}
