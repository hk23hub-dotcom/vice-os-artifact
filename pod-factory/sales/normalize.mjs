// normalize.mjs — lee todo leads-inbox/ y escribe data/leads.json normalizado.
// Idempotente: reprocesar NUNCA pierde el estado de un lead ya conocido.
import fs from 'node:fs';
import path from 'node:path';
import { PATHS, parseCSV, readJSON, writeJSON, norm, slug, deaccent, ESTADOS } from './lib.mjs';

const ALIASES = {
  nombre:  ['nombre', 'name', 'contacto', 'contact', 'full name', 'fullname', 'first name', 'nombre contacto', 'persona'],
  empresa: ['empresa', 'company', 'negocio', 'business', 'organizacion', 'organization', 'account', 'razon social', 'compania'],
  rubro:   ['rubro', 'industria', 'industry', 'sector', 'categoria', 'category', 'giro', 'vertical', 'tipo'],
  email:   ['email', 'correo', 'mail', 'e mail', 'correo electronico', 'email address', 'e-mail'],
  ciudad:  ['ciudad', 'city', 'comuna', 'localidad', 'town'],
  pais:    ['pais', 'country', 'nacion', 'nation'],
  sitio:   ['sitio', 'web', 'website', 'url', 'sitio web', 'pagina', 'pagina web', 'domain', 'dominio', 'link'],
  notas:   ['notas', 'notes', 'observaciones', 'comentarios', 'descripcion', 'description', 'bio', 'detalle', 'about'],
};

const LOOKUP = new Map();
for (const [campo, list] of Object.entries(ALIASES)) {
  for (const a of list) LOOKUP.set(norm(a).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(), campo);
}

const key = h => norm(h).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

function mapRow(raw) {
  const lead = { nombre: '', empresa: '', rubro: '', email: '', ciudad: '', pais: '', sitio: '', notas: '', extra: {} };
  for (const [h, v] of Object.entries(raw)) {
    const val = typeof v === 'string' ? v.trim() : (v == null ? '' : String(v).trim());
    if (!val) continue;
    const campo = LOOKUP.get(key(h));
    if (campo) { if (!lead[campo]) lead[campo] = val; }
    else lead.extra[String(h).trim()] = val;
  }
  lead.email = lead.email.toLowerCase();
  if (lead.email && !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(lead.email)) {
    lead.extra.email_invalido = lead.email;
    lead.email = '';
  }
  lead.dominio = dominio(lead.sitio) || (lead.email ? lead.email.split('@')[1] : '');
  return lead;
}

function dominio(sitio) {
  if (!sitio) return '';
  let s = String(sitio).trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  s = s.split(/[/?#]/)[0].toLowerCase();
  return /\./.test(s) ? s : '';
}

const GENERICOS = new Set(['gmail.com','hotmail.com','outlook.com','yahoo.com','icloud.com','live.cl','gmail.cl','proton.me']);

function idDe(lead) {
  if (lead.email) return 'em:' + lead.email;
  if (lead.dominio && !GENERICOS.has(lead.dominio)) return 'dm:' + lead.dominio;
  return 'nm:' + (slug(lead.empresa || lead.nombre) || 'sin-nombre');
}

function leerArchivos() {
  if (!fs.existsSync(PATHS.inbox)) return { filas: [], archivos: [], ignorados: [] };
  const filas = [], archivos = [], ignorados = [];
  for (const f of fs.readdirSync(PATHS.inbox).sort()) {
    const full = path.join(PATHS.inbox, f);
    if (!fs.statSync(full).isFile()) continue;
    const ext = path.extname(f).toLowerCase();
    if (ext !== '.csv' && ext !== '.json') { if (f !== 'README.md') ignorados.push(f); continue; }
    let rows = [];
    try {
      const txt = fs.readFileSync(full, 'utf8');
      if (ext === '.csv') rows = parseCSV(txt);
      else {
        const j = JSON.parse(txt);
        rows = Array.isArray(j) ? j : (j.leads || j.results || j.data || j.items || []);
        if (!Array.isArray(rows)) rows = [];
      }
    } catch (e) {
      ignorados.push(`${f} (ilegible: ${e.message})`);
      continue;
    }
    archivos.push({ archivo: f, filas: rows.length });
    for (const r of rows) if (r && typeof r === 'object') filas.push({ _origen: f, ...r });
  }
  return { filas, archivos, ignorados };
}

// Une notas sin duplicar fragmentos (reprocesar el mismo export no debe inflar el campo).
function mergeNotas(previas, nuevas) {
  const partes = [];
  const vistas = new Set();
  for (const bloque of [previas, nuevas]) {
    for (const frag of String(bloque || '').split('|')) {
      const t = frag.trim();
      if (!t) continue;
      const k = norm(t);
      if (vistas.has(k)) continue;
      vistas.add(k);
      partes.push(t);
    }
  }
  return partes.join(' | ');
}

export function normalize({ verbose = false } = {}) {
  const previo = readJSON(PATHS.leads, null);
  const store = previo && previo.leads ? previo : { generado: null, leads: {} };
  const { filas, archivos, ignorados } = leerArchivos();

  let nuevos = 0, actualizados = 0, fusionados = 0;
  const porDominio = new Map();
  for (const [id, l] of Object.entries(store.leads)) {
    if (l.dominio && !GENERICOS.has(l.dominio)) porDominio.set(l.dominio, id);
  }

  for (const raw of filas) {
    const origen = raw._origen; delete raw._origen;
    const lead = mapRow(raw);
    if (!lead.empresa && !lead.nombre && !lead.email) continue;

    let id = idDe(lead);
    // Segunda pasada de dedupe: mismo dominio corporativo = mismo lead.
    if (!store.leads[id] && lead.dominio && !GENERICOS.has(lead.dominio) && porDominio.has(lead.dominio)) {
      id = porDominio.get(lead.dominio);
      fusionados++;
    }

    const yaExiste = Boolean(store.leads[id]);
    const prev = store.leads[id] || {};
    const merged = {
      id,
      nombre:  lead.nombre  || prev.nombre  || '',
      empresa: lead.empresa || prev.empresa || '',
      rubro:   lead.rubro   || prev.rubro   || '',
      email:   lead.email   || prev.email   || '',
      ciudad:  lead.ciudad  || prev.ciudad  || '',
      pais:    lead.pais    || prev.pais    || '',
      sitio:   lead.sitio   || prev.sitio   || '',
      dominio: lead.dominio || prev.dominio || '',
      notas:   mergeNotas(prev.notas, lead.notas),
      extra:   { ...(prev.extra || {}), ...lead.extra },
      // ---- estado: se conserva SIEMPRE el del lead ya conocido ----
      estado:  ESTADOS.includes(prev.estado) ? prev.estado : 'nuevo',
      primera_vez: prev.primera_vez || new Date().toISOString(),
      ultima_vez:  new Date().toISOString(),
      fuentes: [...new Set([...(prev.fuentes || []), origen].filter(Boolean))],
      historial: prev.historial || [],
    };
    if (!merged.notas) merged.notas = '';
    store.leads[id] = merged;
    if (merged.dominio && !GENERICOS.has(merged.dominio)) porDominio.set(merged.dominio, id);
    if (yaExiste) actualizados++; else nuevos++;
  }

  store.generado = new Date().toISOString();
  writeJSON(PATHS.leads, store);

  const resumen = {
    archivos, ignorados, filas: filas.length, nuevos, actualizados, fusionados,
    total: Object.keys(store.leads).length,
    sin_email: Object.values(store.leads).filter(l => !l.email).length,
    por_estado: Object.fromEntries(ESTADOS.map(e => [e, Object.values(store.leads).filter(l => l.estado === e).length])),
  };
  if (verbose) console.log(JSON.stringify(resumen, null, 2));
  return { store, resumen };
}

export function guardar(store) {
  store.generado = new Date().toISOString();
  writeJSON(PATHS.leads, store);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { resumen } = normalize({ verbose: false });
  console.log(`normalize — ${resumen.filas} filas de ${resumen.archivos.length} archivo(s)`);
  for (const a of resumen.archivos) console.log(`  · ${a.archivo}: ${a.filas} filas`);
  if (resumen.ignorados.length) console.log(`  ! ignorados: ${resumen.ignorados.join(', ')}`);
  console.log(`nuevos ${resumen.nuevos} · actualizados ${resumen.actualizados} · fusionados por dominio ${resumen.fusionados}`);
  console.log(`total ${resumen.total} · sin email ${resumen.sin_email}`);
  console.log(`estados: ${Object.entries(resumen.por_estado).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  console.log(`→ ${PATHS.leads}`);
}
