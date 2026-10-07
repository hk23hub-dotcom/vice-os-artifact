// match.mjs — decide qué producto se le ofrece a cada lead, con puntaje explicable.
import { loadProducts, readJSON, PATHS, norm, tokens, deaccent } from './lib.mjs';

// Afinidad rubro → conceptos. Es el puente entre "a qué se dedica el lead"
// y el vocabulario de la metadata del producto (subject/theme/palette/keywords).
const AFINIDAD = [
  { test: /golf|driving range|putt|caddie|fairway|green/,                   conceptos: ['golf', 'golfer', 'clubhouse', 'sports', 'course', 'vintage golf'], etiqueta: 'golf' },
  { test: /cafe|cafeteria|restauran|bar|resto|bistro|coffee|brunch/,        conceptos: ['decor', 'wall art', 'vintage', 'retro', 'moody', 'poster'], etiqueta: 'gastronomía' },
  { test: /hotel|hosteria|cabana|lodge|hospedaje|turismo|hostel/,           conceptos: ['decor', 'wall art', 'landscape', 'cinematic', 'poster'], etiqueta: 'hotelería' },
  { test: /coworking|oficina|office|estudio juridico|abogad|contab|consult/,conceptos: ['office', 'wall art', 'minimal', 'decor', 'poster'], etiqueta: 'oficinas' },
  { test: /software|startup|tech|it |saas|dev|data|digital|agencia digital/,conceptos: ['tech', 'pixel', 'retro', 'grid', 'proof', 'work', 'sticker', 'invader'], etiqueta: 'tecnología' },
  { test: /deco|interior|mueble|hogar|retail|tienda|shop|galeria|regalo/,   conceptos: ['decor', 'wall art', 'poster', 'print', 'gift'], etiqueta: 'retail/deco' },
  { test: /gimnasio|gym|crossfit|deporte|club deportivo|fitness/,           conceptos: ['sports', 'motivation', 'moody', 'man cave'], etiqueta: 'deporte' },
  { test: /barberia|peluqueria|tattoo|estetica/,                            conceptos: ['retro', 'vintage', 'moody', 'wall art'], etiqueta: 'retro' },
  { test: /media|podcast|contenido|marketing|publicidad|productora/,        conceptos: ['merch', 'sticker', 'poster', 'retro', 'gift'], etiqueta: 'media' },
];

const PESOS = { keyword: 3, subject: 2.5, theme: 2, style: 1.5, palette: 1, afinidad: 2.5, ciudad: 0.5 };

function bolsaLead(lead) {
  const bolsa = new Map();
  const add = (texto, peso) => { for (const t of tokens(texto)) bolsa.set(t, Math.max(bolsa.get(t) || 0, peso)); };
  add(lead.rubro, 2);      // el rubro es la señal más fuerte
  add(lead.notas, 1.5);    // las notas de LeadHunter son la segunda
  add(lead.empresa, 1);
  add(lead.dominio || lead.sitio, 0.6);
  return bolsa;
}

function afinidades(lead) {
  const txt = norm(`${lead.rubro} ${lead.notas} ${lead.empresa}`);
  return AFINIDAD.filter(a => a.test.test(txt));
}

export function puntuar(lead, producto) {
  if (producto.url_missing) return { score: 0, senales: [], bloqueado: 'sin URL publicada' };
  const bolsa = bolsaLead(lead);
  const afs = afinidades(lead);
  const conceptos = new Set(afs.flatMap(a => a.conceptos.flatMap(c => tokens(c))));
  const senales = [];
  let score = 0;

  const golpear = (campo, texto, peso) => {
    const hits = [];
    for (const t of tokens(texto)) {
      if (bolsa.has(t)) { score += peso * bolsa.get(t); hits.push(t); }
      else if (conceptos.has(t)) { score += PESOS.afinidad; hits.push(t); }
    }
    if (hits.length) senales.push({ campo, hits: [...new Set(hits)] });
  };

  for (const kw of producto.keywords) golpear('keywords', kw, PESOS.keyword / 2);
  golpear('subject', producto.subject, PESOS.subject);
  golpear('theme', producto.theme, PESOS.theme);
  golpear('style', producto.style, PESOS.style);
  golpear('palette', producto.palette, PESOS.palette);

  // Un sticker es la entrada natural para equipos/merch; una lámina para espacios.
  const txt = norm(`${lead.rubro} ${lead.notas}`);
  if (producto.kind === 'sticker' && /(equipo|team|notebook|laptop|merch|staff|devs|stickers)/.test(txt)) {
    score += 4; senales.push({ campo: 'formato', hits: ['sticker para equipo/merch'] });
  }
  if (producto.kind === 'poster' && /(pared|muro|hall|sala|decorar|decoracion|wall|lobby|habitacion|oficina)/.test(txt)) {
    score += 4; senales.push({ campo: 'formato', hits: ['lámina para muro'] });
  }

  return { score: Math.round(score * 10) / 10, senales, bloqueado: null };
}

// Una frase, en español, que explica POR QUÉ se eligió este producto.
export function razon(lead, producto, { senales }) {
  const hits = [...new Set(senales.flatMap(s => s.hits))].slice(0, 3);
  const af = afinidades(lead)[0];
  const donde = lead.notas ? 'lo que anotó LeadHunter' : 'su rubro';
  if (!hits.length) {
    return `Cruce débil: no hay señales en común entre ${donde} y la metadata de ${producto.subject}; revisar a mano.`;
  }
  const eje = af ? `es del rubro ${af.etiqueta}` : `trabaja en ${lead.rubro || 'su rubro'}`;
  return `${lead.empresa || lead.nombre} ${eje} y ${producto.subject} comparte ${hits.map(h => `"${h}"`).join(', ')} con ${donde}.`;
}

export function matchLead(lead, productos, { top = 3, uso = null, penalizacion = 1.5 } = {}) {
  const puntuados = productos.map(p => {
    const r = puntuar(lead, p);
    const veces = uso ? (uso.get(p.sku) || 0) : 0;
    return { sku: p.sku, producto: p, ...r, score_ajustado: Math.max(0, r.score - veces * penalizacion) };
  })
    .filter(r => !r.bloqueado && r.score > 0)
    .sort((a, b) => b.score_ajustado - a.score_ajustado || b.score - a.score || a.sku.localeCompare(b.sku));

  return puntuados.slice(0, top).map(r => ({
    sku: r.sku,
    url: r.producto.url,
    kind: r.producto.kind,
    subject: r.producto.subject,
    style: r.producto.style,
    theme: r.producto.theme,
    palette: r.producto.palette,
    meta_source: r.producto.meta_source,
    score: r.score,
    senales: r.senales,
    razon: razon(lead, r.producto, r),
  }));
}

export function matchAll(leads, { top = 3, balancear = true } = {}) {
  const { products, notes } = loadProducts();
  const uso = new Map();
  const salida = [];
  for (const lead of leads) {
    const m = matchLead(lead, products, { top, uso: balancear ? uso : null });
    if (m[0]) uso.set(m[0].sku, (uso.get(m[0].sku) || 0) + 1);
    salida.push({ lead, matches: m });
  }
  return { resultados: salida, productos: products, notas: notes };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const store = readJSON(PATHS.leads, { leads: {} });
  const leads = Object.values(store.leads);
  if (!leads.length) { console.log('No hay leads. Corre primero: node normalize.mjs'); process.exit(0); }
  const { resultados, productos, notas } = matchAll(leads);
  console.log(`match — ${leads.length} leads contra ${productos.length} productos (${productos.filter(p => p.url).length} con URL real)`);
  for (const n of notas) console.log(`  ! ${n}`);
  for (const { lead, matches } of resultados) {
    console.log(`\n${lead.empresa || lead.nombre} [${lead.rubro || 'sin rubro'}]`);
    if (!matches.length) { console.log('  — sin match'); continue; }
    for (const m of matches) console.log(`  ${m.score.toString().padStart(5)}  ${m.sku}  · ${m.razon}`);
  }
}
