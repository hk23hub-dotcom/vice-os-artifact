// seo.js — turn a caption ({subject, style, palette, theme, keywords}) into a
// complete, Etsy-valid listing (title <=140 chars, 13 unique tags, description).
// If no caption is supplied (no vision key yet), produce VARIED fallback copy so
// no two listings are identical (Etsy penalises duplicates).
import { loadConfig } from './sources.js';

const TITLE_SHAPES = [
  (c) => `${c.subject} Wall Art Print | ${c.style} ${c.theme} Decor | Printable Digital Download`,
  (c) => `${c.style} ${c.subject} Art Print | ${c.theme} Home Decor | Instant Download Poster`,
  (c) => `${c.subject} Printable Art | ${c.palette} ${c.style} Wall Decor | Digital Download Print`,
  (c) => `${c.theme} ${c.subject} Poster | ${c.style} Wall Art | Instant Printable Download`,
];

const FALLBACK_SUBJECTS = ['Surreal Abstract', 'Dreamlike Portrait', 'Cosmic Landscape', 'Mystic Botanical',
  'Geometric Creature', 'Neon Cityscape', 'Ethereal Figure', 'Psychedelic Vision', 'Dark Romantic',
  'Vintage Surrealism', 'Celestial Scene', 'Organic Abstract'];
const FALLBACK_STYLES = ['Surreal', 'Maximalist', 'Minimal', 'Expressionist', 'Vaporwave', 'Painterly', 'Bold Graphic'];
const FALLBACK_THEMES = ['Modern', 'Eclectic', 'Boho', 'Gallery Wall', 'Statement', 'Moody'];
const FALLBACK_PALETTES = ['Warm Tone', 'High Contrast', 'Earthy', 'Jewel Tone', 'Monochrome', 'Pastel'];

const clamp = (s, n) => (s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, ''));
const titleCase = (s) => s.replace(/\b\w/g, (m) => m.toUpperCase());

export function captionFor(item, i) {
  // deterministic, varied fallback caption (seeded by index) until vision fills it in
  const pick = (arr, off = 0) => arr[(i + off) % arr.length];
  return {
    subject: pick(FALLBACK_SUBJECTS),
    style: pick(FALLBACK_STYLES, 1),
    theme: pick(FALLBACK_THEMES, 2),
    palette: pick(FALLBACK_PALETTES, 3),
    keywords: [],
  };
}

export function buildSeo(item, caption, i) {
  const cfg = loadConfig();
  const c = {
    subject: titleCase(caption.subject || 'Abstract Art'),
    style: titleCase(caption.style || 'Surreal'),
    theme: titleCase(caption.theme || 'Modern'),
    palette: titleCase(caption.palette || 'Bold'),
  };
  const title = clamp(TITLE_SHAPES[i % TITLE_SHAPES.length](c), cfg.seo.titleMaxChars);

  // 13 unique tags (Etsy max 20 chars each), blending caption + base keywords
  const raw = [
    `${c.style} wall art`, `${c.subject}`.toLowerCase(), `${c.theme} decor`, `${c.palette} print`.toLowerCase(),
    'printable art', 'digital download', 'instant download', 'wall art print', 'home decor',
    'poster art', 'modern wall art', 'art print', 'gallery wall', `${c.style} poster`.toLowerCase(),
    ...(caption.keywords || []),
  ];
  const tags = [...new Set(raw.map((t) => t.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()).filter(Boolean)
    .map((t) => t.slice(0, 20)))].slice(0, cfg.seo.tagCount);

  const description =
`${title}

A ${c.style.toLowerCase()} ${c.subject.toLowerCase()} piece from the HK23 collection — high-resolution printable wall art for ${c.theme.toLowerCase()} interiors.

WHAT YOU GET (instant digital download):
• High-resolution file ready to print
• Print at home, at a local shop, or via any print service
• For personal use

HOW TO USE:
1. Buy & download instantly — nothing is shipped.
2. Print at your size of choice (ratios scale cleanly).
3. Frame it and enjoy.

Part of HK23 — everything is monetizable, documented, raw.`;

  return { title, tags, description, price: cfg.pricing.digitalUSD, caption: c };
}
