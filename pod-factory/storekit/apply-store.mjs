#!/usr/bin/env node
// apply-store.mjs — aplicador idempotente del KIT DE TIENDA de HK23 STUDIO.
//
//   node apply-store.mjs                 → dry-run: imprime exactamente qué haría
//   node apply-store.mjs --live          → aplica
//   node apply-store.mjs --locale en     → usa la versión en inglés del contenido (default: es)
//   node apply-store.mjs --only=collections,pages,policies,menus,theme
//   node apply-store.mjs --audit-tags    → compara los tags reales contra content/collections.json
//   node apply-store.mjs --fix-tags --live  → corrige los tags según tag_plan
//   node apply-store.mjs --fonts --live  → además aplica las fuentes (leer theme/README.md antes)
//
// Credenciales: variables de entorno SHOPIFY_STORE / SHOPIFY_ADMIN_TOKEN,
// o un config.local.json local (gitignored). Nada se hardcodea.
//
// Sin dependencias npm. Node >= 18 (fetch nativo).

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTENT = join(HERE, 'content');
const OUT = join(HERE, 'out');
const BACKUPS = join(HERE, 'backups');
const API_VERSION = '2026-01';

// ---------------------------------------------------------------- argumentos
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => {
  const inline = argv.find((a) => a.startsWith(`${f}=`));
  if (inline) return inline.slice(f.length + 1);
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const LIVE = has('--live');
const LOCALE = (val('--locale', 'es') || 'es').toLowerCase();
const WITH_FONTS = has('--fonts');
const AUDIT_TAGS = has('--audit-tags') || has('--fix-tags');
const FIX_TAGS = has('--fix-tags');
const ONLY = (val('--only', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const wants = (step) => ONLY.length === 0 || ONLY.includes(step);

if (!['es', 'en'].includes(LOCALE)) {
  console.error(`locale inválido: ${LOCALE}. Usa --locale es | --locale en`);
  process.exit(1);
}

// ---------------------------------------------------------------- salida
const C = process.stdout.isTTY
  ? { dim: '\x1b[2m', b: '\x1b[1m', r: '\x1b[0m', g: '\x1b[32m', y: '\x1b[33m', c: '\x1b[36m' }
  : { dim: '', b: '', r: '', g: '', y: '', c: '' };
const log = (s = '') => console.log(s);
const head = (s) => log(`\n${C.b}${s}${C.r}`);
const item = (s) => log(`  ${s}`);
const plan = (verb, what) => item(`${C.c}${verb.padEnd(10)}${C.r} ${what}`);
const skip = (what, why) => item(`${C.dim}sin cambio${C.r} ${what}${why ? ` ${C.dim}(${why})${C.r}` : ''}`);
const warn = (s) => item(`${C.y}aviso${C.r}      ${s}`);

// ---------------------------------------------------------------- utilidades
const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));

function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { data: {}, body: raw.trim() };
  const data = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (kv) data[kv[1]] = kv[2].trim();
  }
  return { data, body: raw.slice(m[0].length).trim() };
}

// markdown mínimo → HTML. Cubre lo que usan las páginas y políticas del kit:
// headings, párrafos, listas, negrita, cursiva, links y código inline.
function mdToHtml(md) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) =>
    esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');

  const out = [];
  const blocks = md.trim().split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split('\n');
    const h = block.match(/^(#{1,6})\s+(.*)$/);
    if (h && lines.length === 1) {
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      continue;
    }
    if (lines.every((l) => /^[-*]\s+/.test(l))) {
      out.push(`<ul>${lines.map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`);
      continue;
    }
    if (lines.every((l) => /^\d+\.\s+/.test(l))) {
      out.push(`<ol>${lines.map((l) => `<li>${inline(l.replace(/^\d+\.\s+/, ''))}</li>`).join('')}</ol>`);
      continue;
    }
    out.push(`<p>${lines.map(inline).join('<br>')}</p>`);
  }
  return out.join('\n');
}

// Serializa a literal GraphQL. Inlinear los inputs evita declarar tipos
// (CollectionInput, PageCreateInput, ...) que Shopify renombra entre versiones.
class Enum {
  constructor(v) { this.v = v; }
}
const E = (v) => new Enum(v);
function lit(v) {
  if (v instanceof Enum) return v.v;
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(lit).join(', ')}]`;
  return `{${Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => `${k}: ${lit(x)}`).join(', ')}}`;
}

const sameSet = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// ---------------------------------------------------------------- credenciales
function loadConfig() {
  const file = join(HERE, 'config.local.json');
  const fromFile = existsSync(file) ? readJSON(file) : {};
  const store = process.env.SHOPIFY_STORE || fromFile.store || fromFile.SHOPIFY_STORE || '';
  const token = process.env.SHOPIFY_ADMIN_TOKEN || fromFile.token || fromFile.SHOPIFY_ADMIN_TOKEN || '';
  const domain = store.includes('.') ? store : store ? `${store}.myshopify.com` : '';
  return { domain, token, source: process.env.SHOPIFY_ADMIN_TOKEN ? 'env' : existsSync(file) ? 'config.local.json' : 'ninguna' };
}

// ---------------------------------------------------------------- cliente API
let CFG = null;
async function gql(query, { tries = 3 } = {}) {
  const url = `https://${CFG.domain}/admin/api/${API_VERSION}/graphql.json`;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': CFG.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (res.status === 429 && attempt < tries) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      continue;
    }
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${text.slice(0, 300)}`);
    let json;
    try { json = JSON.parse(text); } catch { throw new Error(`respuesta no-JSON: ${text.slice(0, 200)}`); }
    if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join(' | '));
    return json.data;
  }
}
async function rest(path, init) {
  const res = await fetch(`https://${CFG.domain}/admin/api/${API_VERSION}/${path}`, {
    headers: { 'X-Shopify-Access-Token': CFG.token, 'Content-Type': 'application/json' },
    ...init,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`REST ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}
// userErrors uniforme
function checkErrors(label, payload) {
  const errs = payload?.userErrors || payload?.themeFilesUpsertUserErrors || [];
  if (!errs.length) return;
  const where = (e) => (Array.isArray(e.field) ? e.field.join('.') : e.field) || e.filename || '';
  throw new Error(`${label}: ${errs.map((e) => `${where(e)} ${e.message}`.trim()).join(' | ')}`);
}

// ---------------------------------------------------------------- carga del kit
function loadKit() {
  const store = readJSON(join(CONTENT, 'store.json'));
  const home = readJSON(join(CONTENT, 'home.json'));
  const collections = readJSON(join(CONTENT, 'collections.json'));
  const navigation = readJSON(join(CONTENT, 'navigation.json'));
  const seo = readJSON(join(CONTENT, 'seo.json'));
  const theme = readJSON(join(HERE, 'theme', 'spotlight.json'));

  const pickLocale = (dir, kind) => {
    const files = readdirSync(join(CONTENT, dir)).filter((f) => f.endsWith(`.${LOCALE}.md`));
    return files.sort().map((f) => {
      const { data, body } = parseFrontmatter(readFileSync(join(CONTENT, dir, f), 'utf8'));
      return { file: `${dir}/${f}`, kind, ...data, body, html: mdToHtml(body) };
    });
  };
  return {
    store, home, collections, navigation, seo, theme,
    pages: pickLocale('pages', 'page'),
    policies: pickLocale('policies', 'policy'),
  };
}

function countTodos(kit) {
  const hits = [];
  const walk = (v, path) => {
    if (typeof v === 'string') {
      const m = v.match(/\[COMPLETAR:[^\]]*\]/g);
      if (m) m.forEach((x) => hits.push({ path, text: x }));
    } else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) if (!k.startsWith('_')) walk(x, `${path}.${k}`);
    }
  };
  walk(kit.store, 'store.json');
  walk(kit.theme.manual_only, 'theme/spotlight.json');
  for (const p of [...kit.pages, ...kit.policies]) {
    (p.body.match(/\[COMPLETAR:[^\]]*\]/g) || []).forEach((x) => hits.push({ path: p.file, text: x }));
  }
  return hits;
}

// ---------------------------------------------------------------- pasos
async function stepCollections(kit) {
  head('COLECCIONES (smart collections por tag)');
  const defs = kit.collections.collections;
  const handles = defs.map((d) => d.handle);
  const data = await gql(`{ collections(first: 50, query: ${JSON.stringify(handles.map((h) => `handle:${h}`).join(' OR '))}) {
    nodes { id handle title sortOrder descriptionHtml seo { title description }
      ruleSet { appliedDisjunctively rules { column relation condition } } } } }`);
  const live = new Map(data.collections.nodes.map((n) => [n.handle, n]));

  for (const def of defs) {
    const seo = kit.seo.collections[def.handle]?.[LOCALE] || {};
    const desired = {
      title: def.title,
      handle: def.handle,
      descriptionHtml: def.description[LOCALE],
      sortOrder: E(def.sort_order),
      ruleSet: {
        appliedDisjunctively: def.rules.disjunctive,
        rules: def.rules.conditions.map((c) => ({ column: E(c.column), relation: E(c.relation), condition: c.condition })),
      },
      seo: { title: seo.title, description: seo.description },
    };
    const cur = live.get(def.handle);
    if (!cur) {
      plan('crear', `${def.handle} — ${def.title} [${def.rules.conditions.map((c) => `${c.column}=${c.condition}`).join(' Y ')}]`);
      if (LIVE) {
        const r = await gql(`mutation { collectionCreate(input: ${lit(desired)}) { collection { id handle } userErrors { field message } } }`);
        checkErrors(`collectionCreate ${def.handle}`, r.collectionCreate);
      }
      continue;
    }
    const curRules = (cur.ruleSet?.rules || []).map((r) => `${r.column}|${r.relation}|${r.condition}`).sort();
    const newRules = def.rules.conditions.map((c) => `${c.column}|${c.relation}|${c.condition}`).sort();
    const diffs = [];
    if (cur.title !== def.title) diffs.push('título');
    if ((cur.descriptionHtml || '') !== def.description[LOCALE]) diffs.push('descripción');
    if (cur.sortOrder !== def.sort_order) diffs.push('orden');
    if (!sameSet(curRules, newRules) || cur.ruleSet?.appliedDisjunctively !== def.rules.disjunctive) diffs.push('reglas');
    if ((cur.seo?.title || '') !== (seo.title || '')) diffs.push('seo.title');
    if ((cur.seo?.description || '') !== (seo.description || '')) diffs.push('seo.description');
    if (!diffs.length) { skip(def.handle, 'idéntica'); continue; }
    plan('actualizar', `${def.handle} → ${diffs.join(', ')}`);
    if (LIVE) {
      const r = await gql(`mutation { collectionUpdate(input: ${lit({ id: cur.id, ...desired })}) { collection { id } userErrors { field message } } }`);
      checkErrors(`collectionUpdate ${def.handle}`, r.collectionUpdate);
    }
  }
}

async function stepPages(kit) {
  head(`PÁGINAS (locale ${LOCALE})`);
  for (const p of kit.pages) {
    const seo = kit.seo.pages[p.handle]?.[LOCALE] || {};
    const data = await gql(`{ pages(first: 5, query: ${JSON.stringify(`handle:${p.handle}`)}) { nodes { id handle title body isPublished templateSuffix
      metafields(first: 10, namespace: "global") { nodes { key value } } } } }`);
    const cur = data.pages.nodes.find((n) => n.handle === p.handle);
    const metafields = [];
    if (seo.title) metafields.push({ namespace: 'global', key: 'title_tag', type: 'single_line_text_field', value: seo.title });
    if (seo.description) metafields.push({ namespace: 'global', key: 'description_tag', type: 'single_line_text_field', value: seo.description });
    const desired = {
      title: p.title, handle: p.handle, body: p.html, isPublished: true,
      templateSuffix: p.template_suffix || undefined,
      metafields: metafields.length ? metafields : undefined,
    };
    if (!cur) {
      plan('crear', `/pages/${p.handle} — ${p.title} ${C.dim}(${p.html.length} B html, desde ${p.file})${C.r}`);
      if (LIVE) {
        const r = await gql(`mutation { pageCreate(page: ${lit(desired)}) { page { id handle } userErrors { field message } } }`);
        checkErrors(`pageCreate ${p.handle}`, r.pageCreate);
      }
      continue;
    }
    const mf = new Map(cur.metafields.nodes.map((n) => [n.key, n.value]));
    const diffs = [];
    if (cur.title !== p.title) diffs.push('título');
    if ((cur.body || '').trim() !== p.html.trim()) diffs.push('cuerpo');
    if (!cur.isPublished) diffs.push('publicar');
    if ((cur.templateSuffix || '') !== (p.template_suffix || '')) diffs.push('template');
    if (seo.title && mf.get('title_tag') !== seo.title) diffs.push('seo.title');
    if (seo.description && mf.get('description_tag') !== seo.description) diffs.push('seo.description');
    if (!diffs.length) { skip(`/pages/${p.handle}`, 'idéntica'); continue; }
    plan('actualizar', `/pages/${p.handle} → ${diffs.join(', ')}`);
    if (LIVE) {
      const r = await gql(`mutation { pageUpdate(id: ${lit(cur.id)}, page: ${lit(desired)}) { page { id } userErrors { field message } } }`);
      checkErrors(`pageUpdate ${p.handle}`, r.pageUpdate);
    }
  }
}

async function stepPolicies(kit) {
  head(`POLÍTICAS (locale ${LOCALE})`);
  const data = await gql('{ shop { shopPolicies { id type body } } }');
  const live = new Map(data.shop.shopPolicies.map((p) => [p.type, p]));
  for (const pol of kit.policies) {
    const cur = live.get(pol.policy);
    if (!cur) { warn(`${pol.policy} no existe en esta tienda — se omite (${pol.file})`); continue; }
    if ((cur.body || '').trim() === pol.html.trim()) { skip(pol.policy, 'idéntica'); continue; }
    plan(cur.body ? 'reemplazar' : 'escribir', `${pol.policy} ${C.dim}(${pol.html.length} B html, desde ${pol.file})${C.r}`);
    if (LIVE) {
      const r = await gql(`mutation { shopPolicyUpdate(shopPolicy: ${lit({ id: cur.id, body: pol.html })}) { shopPolicy { id type } userErrors { field message } } }`);
      checkErrors(`shopPolicyUpdate ${pol.policy}`, r.shopPolicyUpdate);
    }
  }
}

async function stepMenus(kit) {
  head('NAVEGACIÓN');
  const [cols, pages, menus] = await Promise.all([
    gql('{ collections(first: 100) { nodes { id handle } } }'),
    gql('{ pages(first: 100) { nodes { id handle } } }'),
    gql('{ menus(first: 50) { nodes { id handle title items { id title type url items { id title type url } } } } }'),
  ]);
  const colId = new Map(cols.collections.nodes.map((n) => [n.handle, n.id]));
  const pageId = new Map(pages.pages.nodes.map((n) => [n.handle, n.id]));
  const liveMenus = new Map(menus.menus.nodes.map((n) => [n.handle, n]));

  const build = (items, depth = 0) => {
    const out = [];
    for (const it of items) {
      const title = it.title[LOCALE];
      if (it.type === 'COLLECTION' || it.type === 'PAGE') {
        const id = it.type === 'COLLECTION' ? colId.get(it.resource_handle) : pageId.get(it.resource_handle);
        if (!id) { warn(`item "${title}" omitido: no existe ${it.type.toLowerCase()} "${it.resource_handle}" todavía`); continue; }
        const node = { title, type: E(it.type), resourceId: id };
        if (it.items?.length) node.items = build(it.items, depth + 1);
        out.push(node);
      } else {
        out.push({ title, type: E('HTTP'), url: it.url });
      }
    }
    return out;
  };

  for (const menu of kit.navigation.menus) {
    const items = build(menu.items);
    const sig = (arr) => arr.map((i) => `${i.title}>${i.type.v || i.type}${i.items ? `[${sig(i.items)}]` : ''}`).join(',');
    const cur = liveMenus.get(menu.handle);
    const curSig = cur ? cur.items.map((i) => `${i.title}>${i.type}${i.items?.length ? `[${i.items.map((s) => `${s.title}>${s.type}`).join(',')}]` : ''}`).join(',') : null;
    const newSig = sig(items);
    if (!cur) {
      plan('crear', `menú ${menu.handle} — ${items.length} items`);
      if (LIVE) {
        const r = await gql(`mutation { menuCreate(title: ${lit(menu.title)}, handle: ${lit(menu.handle)}, items: ${lit(items)}) { menu { id handle } userErrors { field message } } }`);
        checkErrors(`menuCreate ${menu.handle}`, r.menuCreate);
      }
      continue;
    }
    if (curSig === newSig) { skip(`menú ${menu.handle}`, 'idéntico'); continue; }
    plan('actualizar', `menú ${menu.handle} — ${items.length} items: ${items.map((i) => i.title).join(' · ')}`);
    if (LIVE) {
      const r = await gql(`mutation { menuUpdate(id: ${lit(cur.id)}, title: ${lit(menu.title)}, handle: ${lit(menu.handle)}, items: ${lit(items)}) { menu { id } userErrors { field message } } }`);
      checkErrors(`menuUpdate ${menu.handle}`, r.menuUpdate);
    }
  }
}

// --- tema: merge quirúrgico sobre settings_data.json ------------------------
function mergeThemeSettings(current, spec, { withFonts }) {
  const applied = [];
  const omitted = [];
  const cur = current.current;
  if (!cur || typeof cur !== 'object') throw new Error('settings_data.json sin objeto "current"');

  const put = (obj, key, value, label) => {
    if (!(key in obj)) { omitted.push(label); return; }
    if (JSON.stringify(obj[key]) === JSON.stringify(value)) return;
    obj[key] = value;
    applied.push(`${label}: ${JSON.stringify(obj[key])}`);
  };

  for (const [k, v] of Object.entries(spec.settings)) {
    if (k.startsWith('_')) continue;
    put(cur, k, v, k);
  }
  for (const [k, v] of Object.entries(spec.legacy_color_settings)) {
    if (k.startsWith('_')) continue;
    put(cur, k, v, k);
  }
  if (cur.color_schemes && typeof cur.color_schemes === 'object') {
    for (const [scheme, def] of Object.entries(spec.color_schemes)) {
      const target = cur.color_schemes[scheme];
      if (!target || !target.settings) { omitted.push(`color_schemes.${scheme}`); continue; }
      for (const [k, v] of Object.entries(def.settings)) put(target.settings, k, v, `color_schemes.${scheme}.${k}`);
    }
  } else {
    omitted.push('color_schemes (el tema no usa esquemas)');
  }
  if (withFonts) {
    for (const [k, v] of Object.entries(spec.fonts.settings)) put(cur, k, v, `fonts.${k}`);
  }
  return { merged: current, applied, omitted };
}

async function stepTheme(kit) {
  head('TEMA');
  const themes = await gql('{ themes(first: 20, roles: [MAIN]) { nodes { id name role } } }');
  const theme = themes.themes.nodes[0];
  if (!theme) { warn('no hay tema con rol MAIN — nada que aplicar'); return; }
  item(`${C.dim}tema activo:${C.r} ${theme.name} (${theme.id})`);
  if (!/spotlight/i.test(theme.name)) warn(`el tema activo no se llama Spotlight; el merge solo tocará las claves que existan igual`);

  let raw;
  try {
    const f = await gql(`{ theme(id: ${lit(theme.id)}) { files(filenames: ["config/settings_data.json"], first: 1) {
      nodes { filename body { ... on OnlineStoreThemeFileBodyText { content } } } } } }`);
    raw = f.theme?.files?.nodes?.[0]?.body?.content;
  } catch (e) {
    warn(`themeFiles por GraphQL falló (${e.message.slice(0, 80)}), intento con el Asset API REST`);
  }
  if (!raw) {
    const legacyId = theme.id.split('/').pop();
    const a = await rest(`themes/${legacyId}/assets.json?asset[key]=config/settings_data.json`);
    raw = a.asset.value;
  }
  const current = JSON.parse(raw);

  const { merged, applied, omitted } = mergeThemeSettings(current, kit.theme, { withFonts: WITH_FONTS });
  if (!WITH_FONTS) item(`${C.dim}fuentes: no se tocan (pasa --fonts tras verificar los handles; ver theme/README.md)${C.r}`);
  if (!applied.length) { skip('settings_data.json', 'todas las claves ya están en el valor deseado'); }
  else {
    plan('mezclar', `${applied.length} claves en config/settings_data.json`);
    for (const a of applied.slice(0, 40)) item(`    ${C.dim}·${C.r} ${a}`);
    if (applied.length > 40) item(`    ${C.dim}· … y ${applied.length - 40} más${C.r}`);
  }
  if (omitted.length) item(`  ${C.dim}omitidas por no existir en este tema (${omitted.length}): ${omitted.slice(0, 12).join(', ')}${omitted.length > 12 ? ', …' : ''}${C.r}`);

  if (!applied.length) return;
  if (!LIVE) { item(`  ${C.dim}en --live: backup + subida de config/settings_data.json${C.r}`); return; }

  mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = join(BACKUPS, `settings_data.${theme.id.split('/').pop()}.${stamp}.json`);
  writeFileSync(backup, raw);
  item(`  ${C.dim}backup → ${backup}${C.r}`);

  const value = JSON.stringify(merged, null, 2);
  try {
    const r = await gql(`mutation { themeFilesUpsert(themeId: ${lit(theme.id)}, files: [${lit({ filename: 'config/settings_data.json', body: { type: E('TEXT'), value } })}]) {
      upsertedThemeFiles { filename } userErrors { filename message } } }`);
    checkErrors('themeFilesUpsert', r.themeFilesUpsert);
  } catch (e) {
    warn(`themeFilesUpsert falló (${e.message.slice(0, 80)}), reintento con el Asset API REST`);
    const legacyId = theme.id.split('/').pop();
    await rest(`themes/${legacyId}/assets.json`, {
      method: 'PUT',
      body: JSON.stringify({ asset: { key: 'config/settings_data.json', value } }),
    });
  }
  item(`  ${C.g}config/settings_data.json actualizado${C.r}`);
}

async function stepTags(kit) {
  head('TAGS DE PRODUCTO');
  const plans = kit.collections.tag_plan;
  const data = await gql('{ products(first: 250) { nodes { id handle title tags } } }');
  const live = new Map(data.products.nodes.map((n) => [n.handle, n]));
  for (const tp of plans) {
    const p = live.get(tp.handle);
    if (!p) { warn(`producto no encontrado: ${tp.handle}`); continue; }
    const set = new Set(p.tags);
    const missing = tp.add.filter((t) => !set.has(t));
    const extra = tp.remove.filter((t) => set.has(t));
    if (!missing.length && !extra.length) { skip(tp.handle, 'tags correctos'); continue; }
    const desc = [missing.length ? `+${missing.join(', +')}` : '', extra.length ? `-${extra.join(', -')}` : ''].filter(Boolean).join('  ');
    if (!FIX_TAGS) { item(`${C.y}pendiente${C.r}  ${tp.handle} → ${desc}  ${C.dim}(corrige con --fix-tags --live)${C.r}`); continue; }
    plan('tags', `${tp.handle} → ${desc}`);
    if (LIVE) {
      const tags = [...p.tags.filter((t) => !tp.remove.includes(t)), ...missing];
      const r = await gql(`mutation { productUpdate(product: ${lit({ id: p.id, tags })}) { product { id } userErrors { field message } } }`);
      checkErrors(`productUpdate ${tp.handle}`, r.productUpdate);
    }
  }
}

function emitHomeCopy(kit) {
  const L = LOCALE;
  const lines = [`HK23 STUDIO — copy de la home (${L})`, `Pegar a mano en Tienda online > Temas > Personalizar.`, ''];
  lines.push('## HERO', `Titular:    ${kit.home.hero[L].headline}`, `Bajada:     ${kit.home.hero[L].subhead}`,
    `Botón 1:    ${kit.home.hero[L].cta_primary}`, `Botón 2:    ${kit.home.hero[L].cta_secondary}`, '');
  lines.push('## BLOQUES DE VALOR');
  for (const b of kit.home.value_blocks) lines.push(`[${b.key}] ${b[L].title}`, `        ${b[L].body}`, '');
  lines.push('## SECCIONES');
  for (const [k, s] of Object.entries(kit.home.sections)) {
    if (k.startsWith('_')) continue;
    lines.push(`[${k}] ${s[L].title}`, `        ${s[L].body}`);
    if (s[L].cta) lines.push(`        CTA: ${s[L].cta}`);
    lines.push('');
  }
  lines.push('## ANUNCIO SUPERIOR', kit.store.announcement[L], '');
  lines.push('## SEO HOME', `Title: ${kit.seo.home[L].title}`, `Meta:  ${kit.seo.home[L].description}`);
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------- main
async function main() {
  const kit = loadKit();
  CFG = loadConfig();

  log(`${C.b}HK23 STUDIO · KIT DE TIENDA${C.r}  ${C.dim}[${LIVE ? 'LIVE' : 'DRY-RUN'}] locale=${LOCALE} api=${API_VERSION}${C.r}`);
  log(`${C.dim}tienda objetivo: ${CFG.domain || kit.store.store_domain + ' (del kit, sin confirmar)'} · credenciales: ${CFG.source}${C.r}`);

  head('PLAN (leído del kit, sin red)');
  item(`colecciones  ${kit.collections.collections.length}: ${kit.collections.collections.map((c) => c.handle).join(', ')}`);
  item(`páginas      ${kit.pages.length}: ${kit.pages.map((p) => `/pages/${p.handle}`).join(', ')}`);
  item(`políticas    ${kit.policies.length}: ${kit.policies.map((p) => p.policy).join(', ')}`);
  item(`menús        ${kit.navigation.menus.length}: ${kit.navigation.menus.map((m) => m.handle).join(', ')}`);
  const themeKeys = Object.keys(kit.theme.settings).filter((k) => !k.startsWith('_')).length
    + Object.keys(kit.theme.legacy_color_settings).filter((k) => !k.startsWith('_')).length
    + Object.values(kit.theme.color_schemes).reduce((n, s) => n + Object.keys(s.settings).length, 0);
  item(`tema         ${themeKeys} claves candidatas (se aplican solo las que existan en el tema activo)`);
  item(`tags         ${kit.collections.tag_plan.length} productos en el tag_plan`);

  const todos = countTodos(kit);
  if (todos.length) {
    head(`PENDIENTES DEL DUEÑO — ${todos.length} marcas [COMPLETAR: ...]`);
    const byPath = todos.reduce((m, t) => ((m[t.path] = (m[t.path] || 0) + 1), m), {});
    for (const [p, n] of Object.entries(byPath).sort((a, b) => b[1] - a[1])) item(`${String(n).padStart(3)}  ${p}`);
    item(`${C.dim}Se publican tal cual si no los llenas: son visibles para el comprador.${C.r}`);
  }

  if (!CFG.token || !CFG.domain) {
    log(`\n${C.y}Falta ${!CFG.token ? 'SHOPIFY_ADMIN_TOKEN' : 'SHOPIFY_STORE'}: exporta la variable de entorno o crea storekit/config.local.json a partir de config.example.json (scopes: write_products, write_content, write_online_store_pages, write_online_store_navigation, write_themes).${C.r}`);
    process.exit(1);
  }

  const shop = await gql('{ shop { name myshopifyDomain } }');
  head('CONEXIÓN');
  item(`${C.g}ok${C.r} ${shop.shop.name} · ${shop.shop.myshopifyDomain}`);

  if (wants('collections')) await stepCollections(kit);
  if (wants('pages')) await stepPages(kit);
  if (wants('policies')) await stepPolicies(kit);
  if (wants('menus')) await stepMenus(kit);
  if (wants('theme')) await stepTheme(kit);
  if (AUDIT_TAGS) await stepTags(kit);

  head('COPY DE LA HOME');
  const target = join(OUT, `home-copy.${LOCALE}.txt`);
  if (LIVE) {
    mkdirSync(OUT, { recursive: true });
    writeFileSync(target, emitHomeCopy(kit));
    item(`escrito ${target} ${C.dim}(pegar a mano en el editor de temas)${C.r}`);
  } else {
    plan('escribir', `${target} ${C.dim}(solo en --live)${C.r}`);
  }

  log(`\n${LIVE ? `${C.g}Aplicado.${C.r}` : `${C.dim}Dry-run. Nada se tocó. Corre con --live para aplicar.${C.r}`}`);
}

// Exportadas para poder probarlas sin red; main() solo corre si se ejecuta el archivo.
export { mdToHtml, mergeThemeSettings, lit, E, parseFrontmatter, loadKit };

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`\n${C.y}error${C.r} ${e.message}`);
    process.exit(1);
  });
}
