// compose.mjs — escribe el mensaje de venta y su follow-up.
// Voz HK23: directa, sin relleno, sin emojis, sin promesas que no podamos cumplir.
import { langFor, kindLabel, words, norm, addDays, today, readJSON, PATHS } from './lib.mjs';
import { matchAll } from './match.mjs';

const MAX_PALABRAS = 120;

// "Algo concreto del lead": se prefiere el dato más específico que exista.
function ancla(lead, lang) {
  const n = (lead.notas || '').split('|')[0].trim();
  if (n) {
    let frase = n.split(/[;.]/)[0].trim();
    if (frase.length > 95) frase = frase.slice(0, 92).trimEnd() + '...';
    frase = frase.replace(/[.,;]+$/, '');
    // El fragmento va después de dos puntos, así que parte en minúscula.
    if (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(frase)) frase = frase[0].toLowerCase() + frase.slice(1);
    return { texto: frase, tipo: 'notas' };
  }
  if (lead.ciudad && lead.rubro) {
    return lang === 'en'
      ? { texto: `${lead.rubro.toLowerCase()} in ${lead.ciudad}`, tipo: 'rubro+ciudad' }
      : { texto: `${lead.rubro.toLowerCase()} en ${lead.ciudad}`, tipo: 'rubro+ciudad' };
  }
  if (lead.rubro) return { texto: lead.rubro.toLowerCase(), tipo: 'rubro' };
  if (lead.sitio) return { texto: lead.dominio || lead.sitio, tipo: 'sitio' };
  return { texto: '', tipo: 'ninguno' };
}

function saludo(lead) {
  const n = (lead.nombre || '').split(/\s+/)[0];
  return n || lead.empresa || '';
}

function descriptor(m, lang) {
  const k = kindLabel(m.kind, lang);
  const rasgos = [m.style, m.theme].filter(Boolean).join(', ');
  if (lang === 'en') return rasgos ? `${m.subject} — a ${rasgos.toLowerCase()} ${k}` : `${m.subject} (${k})`;
  return rasgos ? `${m.subject} — ${k} ${rasgos.toLowerCase()}` : `${m.subject} (${k})`;
}

export function componer(lead, matches, { fecha = today() } = {}) {
  const lang = langFor(lead);
  const m = matches[0];
  const aviso = [];

  if (!lead.email) aviso.push('sin email: no se puede encolar');
  if (!m) aviso.push('sin producto con URL publicada: no se compone');
  if (m && !m.url) aviso.push('el producto no tiene URL publicada: no se compone');
  if (!lead.pais) aviso.push('país vacío: se asumió español, revisar');
  const a = ancla(lead, lang);
  if (a.tipo === 'ninguno') aviso.push('sin dato concreto para personalizar: revisar a mano');
  if (m && m.score < 5) aviso.push(`match débil (score ${m.score}): revisar antes de enviar`);

  if (!m || !m.url || !lead.email || a.tipo === 'ninguno') {
    return { lead_id: lead.id, email: lead.email || null, idioma: lang, listo: false, aviso, mensaje: null, followup: null, match: m || null };
  }

  const nom = saludo(lead);
  const emp = lead.empresa || nom;
  const desc = descriptor(m, lang);
  let asunto, cuerpo, fuAsunto, fuCuerpo;

  if (lang === 'es') {
    asunto = `${m.subject} para ${emp}`;
    cuerpo = [
      `${nom}, te escribo derecho por lo que tengo anotado de ${emp}: ${a.texto}.`,
      ``,
      `Tengo una pieza del catálogo que calza: ${desc}. Se imprime por encargo y la despacha el proveedor, así que no hay mínimo ni stock que financiar: se puede pedir una sola para probar.`,
      ``,
      m.url,
      ``,
      `Si te hace sentido, respóndeme y te paso las medidas y el precio por volumen. Si no es para ustedes, dímelo y no insisto.`,
      ``,
      `HK23`,
    ].join('\n');
    fuAsunto = `Re: ${asunto}`;
    fuCuerpo = [
      `${nom}, subo esto una vez y lo dejo hasta ahí.`,
      ``,
      `${m.subject} sigue disponible: ${m.url}`,
      ``,
      `Un "no" también me sirve y te saco de la lista.`,
      ``,
      `HK23`,
    ].join('\n');
  } else {
    asunto = `${m.subject} for ${emp}`;
    cuerpo = [
      `${nom}, going straight to the point, based on what I have on ${emp}: ${a.texto}.`,
      ``,
      `One piece from our catalog fits: ${desc}. It is printed on demand and shipped by the supplier, so there is no minimum and no stock to finance: you can order a single one to test it.`,
      ``,
      m.url,
      ``,
      `If it makes sense, reply and I will send sizes and volume pricing. If it is not for you, say so and I will drop it.`,
      ``,
      `HK23`,
    ].join('\n');
    fuAsunto = `Re: ${asunto}`;
    fuCuerpo = [
      `${nom}, bringing this up once and then leaving it.`,
      ``,
      `${m.subject} is still available: ${m.url}`,
      ``,
      `A "no" works too and I will take you off the list.`,
      ``,
      `HK23`,
    ].join('\n');
  }

  const n = words(cuerpo);
  if (n > MAX_PALABRAS) aviso.push(`cuerpo con ${n} palabras (tope ${MAX_PALABRAS})`);

  return {
    lead_id: lead.id,
    email: lead.email,
    idioma: lang,
    listo: true,
    aviso,
    ancla: a,
    match: m,
    mensaje:  { asunto, cuerpo, palabras: n },
    followup: { enviar_el: addDays(fecha, 4), asunto: fuAsunto, cuerpo: fuCuerpo, palabras: words(fuCuerpo) },
  };
}

export function componerLote(leads, { fecha = today() } = {}) {
  const { resultados, productos, notas } = matchAll(leads);
  const piezas = resultados.map(({ lead, matches }) => ({
    ...componer(lead, matches, { fecha }),
    lead: { id: lead.id, nombre: lead.nombre, empresa: lead.empresa, rubro: lead.rubro, email: lead.email, ciudad: lead.ciudad, pais: lead.pais },
    alternativas: matches.slice(1).map(x => ({ sku: x.sku, score: x.score, url: x.url, razon: x.razon })),
  }));
  return { piezas, productos, notas };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const store = readJSON(PATHS.leads, { leads: {} });
  const leads = Object.values(store.leads);
  const solo = process.argv[2];
  const sel = solo ? leads.filter(l => norm(`${l.empresa} ${l.nombre} ${l.id}`).includes(norm(solo))) : leads;
  const { piezas } = componerLote(sel);
  for (const p of piezas) {
    console.log('='.repeat(72));
    console.log(`${p.lead.empresa || p.lead.nombre} · ${p.email || 'SIN EMAIL'} · ${p.idioma} · ${p.listo ? 'LISTO' : 'NO LISTO'}`);
    if (p.aviso.length) console.log(`avisos: ${p.aviso.join(' | ')}`);
    if (!p.mensaje) continue;
    console.log(`\nAsunto: ${p.mensaje.asunto}\n`);
    console.log(p.mensaje.cuerpo);
    console.log(`\n[${p.mensaje.palabras} palabras · follow-up ${p.followup.enviar_el}]`);
  }
}
