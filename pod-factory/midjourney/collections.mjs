// collections.mjs — reparte cada pieza curada en UNA colección temática.
// Las colecciones de la tienda se arman con estos tags, así que cada producto nuevo
// cae solo en su colección sin que nadie lo ordene a mano.
//
//   node collections.mjs    → muestra el reparto del catálogo actual
//
// Reglas: se evalúan en orden; gana la primera que calza. El orden importa: lo más
// específico (deporte, criaturas) va antes que lo más amplio (abstracto).
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const COLLECTIONS = [
  { slug: 'field-and-turf', title: 'FIELD & TURF', tag: 'field and turf',
    blurb: 'Golf, rugby and the quiet hours before the first whistle.',
    match: /\b(golf|golfer|golfers|fairway|clubhouse|rugby|scrum|stadium|pitch|athlete|sport|sports)\b/ },
  { slug: 'creatures', title: 'CREATURES', tag: 'creatures',
    blurb: 'Beasts, companions and things that look back at you.',
    match: /\b(creature|wildlife|animal|beast|doxie|dachshund|dog|cat|fox|wolf|owl|bird|parrot|tiger|lion|bear|whale|fish|octopus|jellyfish|dragon|monster|childrens|whimsical)\b/ },
  { slug: 'circuit-city', title: 'CIRCUIT CITY', tag: 'circuit city',
    blurb: 'Cyberpunk streets, circuits and machines with opinions.',
    match: /\b(cyberpunk|circuit|futuristic|futurism|sci fi|scifi|robot|android|mech|glitch|hologram|dystopian|chrome|anomaly)\b/ },
  { slug: 'neon-drive', title: 'NEON DRIVE', tag: 'neon drive',
    blurb: 'Synthwave sunsets, palm lines and chrome horizons.',
    match: /\b(synthwave|vaporwave|retrowave|outrun|neon|palm|sunset|miami|retro cool|arcade)\b/ },
  { slug: 'sacred-grid', title: 'SACRED GRID', tag: 'sacred grid',
    blurb: 'Mandalas, totems and geometry drawn like a ritual.',
    match: /\b(sacred|geometry|mandala|totem|ornate|symbolic|mystic|mystical|tarot|alchemy|ritual|temple|meditative)\b/ },
  { slug: 'third-eye', title: 'THIRD EYE', tag: 'third eye',
    blurb: 'Psychedelic and visionary pieces. Look longer than you planned to.',
    match: /\b(psychedelic|visionary|surreal|cosmic|goddess|muse|dream|dreamy|dreamlike|ascension|astral|trippy|spiritual)\b/ },
  { slug: 'wild-bloom', title: 'WILD BLOOM', tag: 'wild bloom',
    blurb: 'Folk botanicals, jungle and gardens that refuse to stay in the vase.',
    match: /\b(botanical|folk|floral|flower|flowers|bloom|garden|jungle|foliage|tropical|leaf|leaves|forest|woodland)\b/ },
  { slug: 'hard-edge', title: 'HARD EDGE', tag: 'hard edge',
    blurb: 'Cubist, abstract and minimal. Shape first, story later.',
    match: /\b(cubist|abstract|expressionist|minimalist|minimal|geometric|splash|pop|street art|graffiti|collage|bauhaus)\b/ },
];

export const FALLBACK = { slug: 'open-studio', title: 'OPEN STUDIO', tag: 'open studio',
  blurb: 'Pieces that do not fit a box. Landscapes, portraits and one-offs.' };

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

// Orden de las señales, de la más confiable a la menos:
//   0. el SUJETO, pero solo para las colecciones que se definen por lo que aparece en la imagen
//      (deporte, criaturas): un golfista pintado en estilo "street art" sigue siendo golf
//   1. el ESTILO que puso el curador
//   2. el sujeto contra todas las colecciones
//   3. tema y keywords sueltas
const POR_SUJETO = new Set(['field-and-turf', 'creatures']);
export function collectionOf(it) {
  const sujeto = norm(it.subject);
  if (sujeto) for (const c of COLLECTIONS) if (POR_SUJETO.has(c.slug) && c.match.test(sujeto)) return c;
  for (const texto of [norm(it.style), sujeto, norm([it.theme, ...(it.keywords || [])].join(' '))]) {
    if (!texto) continue;
    for (const c of COLLECTIONS) if (c.match.test(texto)) return c;
  }
  return FALLBACK;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const f = join(HERE, 'data', 'catalog.json');
  if (!existsSync(f)) { console.log('Falta data/catalog.json — corre primero: node collection.mjs'); process.exit(1); }
  const cat = JSON.parse(readFileSync(f, 'utf8'));
  const items = Array.isArray(cat) ? cat : cat.items;
  const out = {};
  for (const it of items) { const c = collectionOf(it); (out[c.title] ||= []).push(it); }
  console.log(`\nReparto de ${items.length} piezas en colecciones\n`);
  for (const [t, arr] of Object.entries(out).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`${String(arr.length).padStart(4)}  ${t.padEnd(16)} ej: ${arr.slice(0, 3).map((i) => i.subject).join(' · ')}`);
  }
}
