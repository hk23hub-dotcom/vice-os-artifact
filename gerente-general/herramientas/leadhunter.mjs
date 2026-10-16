#!/usr/bin/env node
// Gerente General — cliente de LeadHunter con la cuenta del gerente. Sin dependencias (Node >= 18).
//
//   node leadhunter.mjs --hq ~/DMS infer --url https://www.ejemplo.cl
//   node leadhunter.mjs --hq ~/DMS hunt --offer "…" --target "…" --zone "Santiago" --channel WhatsApp --count 10 \
//        [--booking https://…] [--site https://…] [--dry-run] [--no-save]
//
// Clave y URL: variables LEADHUNTER_API_KEY / LEADHUNTER_URL o, si no existen, los archivos <HQ>/.leadhunter y
// <HQ>/.leadhunter-url (una línea cada uno). HQ viene de --hq o de DMS_HQ. El resultado se guarda en
// <HQ>/memoria/prospectos/ (.md y .json). Se niega a escribir dentro de un repositorio git o de la carpeta del plugin.
// Progreso por stderr; al final, JSON por stdout. Una cacería cuesta 1 crédito por prospecto: confirma antes.

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const CHANNELS = ['WhatsApp', 'Email', 'LinkedIn'];
const FLAGS_VALOR = ['hq', 'url', 'offer', 'target', 'zone', 'channel', 'count', 'booking', 'site'];
const FLAGS_BOOL = ['dry-run', 'no-save'];

/* Solo acepta las banderas conocidas: una bandera mal escrita no puede gastar créditos sin guardar nada. */
export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      if (FLAGS_BOOL.includes(k)) { out[k] = true; continue; }
      if (!FLAGS_VALOR.includes(k)) throw new Error('bandera desconocida: --' + k + ' (válidas: --' + [...FLAGS_VALOR, ...FLAGS_BOOL].join(', --') + ')');
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) throw new Error('--' + k + ' necesita un valor');
      out[k] = next; i++;
    } else out._.push(a);
  }
  return out;
}

/* Arma la petición a /api/agent a partir de los argumentos. Lanza si falta algo. */
export function buildRequest(cmd, args) {
  if (cmd === 'infer') {
    if (!args.url) throw new Error('infer necesita --url');
    return { mode: 'infer', input: { url: String(args.url) } };
  }
  if (cmd === 'hunt') {
    const faltan = ['offer', 'target', 'channel'].filter((k) => !args[k]);
    if (faltan.length) throw new Error('hunt necesita --' + faltan.join(', --'));
    const channel = String(args.channel);
    if (!CHANNELS.includes(channel)) throw new Error('--channel debe ser ' + CHANNELS.join(' | '));
    const count = parseInt(args.count || '10', 10);
    if (!(count >= 3 && count <= 20)) throw new Error('--count entre 3 y 20');
    const input = { offer: String(args.offer), target: String(args.target), zone: String(args.zone || ''), channel, count };
    if (args.booking) input.bookingUrl = String(args.booking);
    if (args.site) input.siteUrl = String(args.site);
    return { mode: 'hunt', input };
  }
  throw new Error('comando desconocido: ' + cmd + ' (usa infer | hunt)');
}

/* ¿La ruta está dentro de un repositorio git o de la carpeta del plugin? Ahí no se escribe nunca.
   Sube hasta el primer ancestro que exista (la carpeta puede no existir todavía), busca un `.git` hacia arriba
   (sirve aunque git no esté instalado) y además pregunta a git si está disponible. */
export function rutaProhibida(dir, { execImpl = execFileSync, existsImpl = existsSync } = {}) {
  const abs = resolve(dir);
  if (/[\\/]gerente-general([\\/]|$)/.test(abs)) return 'está dentro de la carpeta del plugin';
  let base = abs;
  while (!existsImpl(base) && dirname(base) !== base) base = dirname(base);
  for (let p = base; ; p = dirname(p)) {
    if (existsImpl(join(p, '.git'))) return 'está dentro de un repositorio git';
    if (dirname(p) === p) break;
  }
  try {
    const r = String(execImpl('git', ['-C', base, 'rev-parse', '--is-inside-work-tree'], { stdio: ['ignore', 'pipe', 'ignore'] })).trim();
    if (r === 'true') return 'está dentro de un repositorio git';
  } catch (_) { /* sin git: ya se revisó .git hacia arriba */ }
  return null;
}

/* Clave y URL: variables de entorno primero; si no, archivos de una línea en HQ. */
export function credenciales({ env = {}, hq = '', readImpl = readFileSync } = {}) {
  const leer = (f) => { try { return String(readImpl(join(hq, f), 'utf8')).split('\n')[0].trim(); } catch (_) { return ''; } };
  const key = String(env.LEADHUNTER_API_KEY || (hq ? leer('.leadhunter') : '')).trim();
  return { key, url: normalizarUrl(env.LEADHUNTER_URL || (hq ? leer('.leadhunter-url') : '')) };
}

/* Acepta lo que el gerente pegue: con o sin https://, con barras de más o con /api/agent al final. */
export function normalizarUrl(u) {
  let s = String(u || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  s = s.replace(/\/+$/, '').replace(/\/api\/agent$/i, '').replace(/\/+$/, '');
  try { return new URL(s).origin + new URL(s).pathname.replace(/\/+$/, ''); } catch (_) { return ''; }
}

/* Parsea un bloque de texto SSE ("data: {...}\n\n") a eventos. Ignora pings y líneas rotas. */
export function parseSSE(text) {
  const events = [];
  for (const chunk of String(text).split('\n\n')) {
    const line = chunk.split('\n').find((l) => l.startsWith('data:'));
    if (!line) continue;
    try { events.push(JSON.parse(line.slice(5).trim())); } catch (_) { /* línea rota: se ignora */ }
  }
  return events;
}

/* Lee un ReadableStream SSE y emite eventos a medida que llegan. */
export async function* readSSE(body) {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let sep;
    while ((sep = buf.indexOf('\n\n')) !== -1) {
      const chunk = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      for (const ev of parseSSE(chunk + '\n\n')) yield ev;
    }
  }
  if (buf.trim()) for (const ev of parseSSE(buf + '\n\n')) yield ev;
}

export function slug(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'caceria';
}

/* Resumen en Markdown para la memoria del agente (memoria/prospectos/). */
export function toMarkdown({ mode, input, result, charged, usedSearch, huntId, fecha }) {
  const f = fecha || new Date().toISOString().slice(0, 10);
  if (mode === 'infer') {
    const b = result || {};
    return `# LeadHunter · infer · ${f}\n\nURL: ${input.url}\n\n- Oferta: ${b.offer || ''}\n- Cliente ideal: ${b.target || ''}\n- Zona: ${b.zone || ''}\n- Canal: ${b.channel || ''}\n- Resumen: ${b.summary || ''}\n\n_Inferido por LeadHunter desde la web: por confirmar con el gerente._\n`;
  }
  const leads = Array.isArray(result) ? result : [];
  const head = `# LeadHunter · cacería · ${f}\n\n` +
    `- Oferta: ${input.offer}\n- Cliente ideal: ${input.target}\n- Zona: ${input.zone || '—'}\n- Canal: ${input.channel}\n` +
    `- Pedidos: ${input.count} · Entregados: ${leads.length} · Cobrados: ${charged ?? leads.length} créditos\n` +
    `- Búsqueda web: ${usedSearch === false ? 'NO (objetivos de búsqueda, no empresas concretas)' : 'sí'}${huntId ? `\n- Historial: ${huntId}` : ''}\n\n`;
  const body = leads.map((l, i) =>
    `## ${i + 1}. ${l.name} · ${l.score ?? '—'}/100\n` +
    `- Datos: ${l.meta || '—'}\n- Señal: ${l.signal || '—'}\n- Por qué encaja: ${l.fit || '—'}\n- Contacto: ${l.contact || '—'}` +
    `${l.phone ? `\n- WhatsApp: ${l.phone}` : ''}${l.email ? `\n- Email: ${l.email}` : ''}${l.source ? `\n- Fuente: ${l.source}` : ''}\n` +
    `- Objeción probable: ${l.objection || '—'}\n\n**Mensaje (no enviado, lo envía el gerente):**\n\n${l.message}\n\n**Seguimiento día 3:**\n\n${l.followup || '—'}\n`
  ).join('\n');
  return head + (body || '_Sin prospectos entregados._\n') + '\n---\n_Estado inicial: ninguno enviado. Marcar en LeadHunter al enviar; el seguimiento se agenda a +3 días._\n';
}

export async function run(argv, { fetchImpl = globalThis.fetch, stdout = process.stdout, stderr = process.stderr, env = process.env, execImpl, readImpl } = {}) {
  const args = parseArgs(argv);
  const cmd = args._[0];
  const req = buildRequest(cmd, args); // valida antes de tocar la red
  const hq = String(args.hq || env.DMS_HQ || '');
  const log = (s) => stderr.write(s + '\n');

  if (hq) {
    const mal = rutaProhibida(hq, execImpl ? { execImpl } : {});
    if (mal) throw new Error(`La carpeta HQ (${hq}) ${mal}: la memoria no puede vivir ahí.`);
  }
  const { key, url } = credenciales({ env, hq, ...(readImpl ? { readImpl } : {}) });

  if (args['dry-run']) {
    stdout.write(JSON.stringify({ dryRun: true, url: (url || '<LEADHUNTER_URL>') + '/api/agent', hq: hq || null, hayClave: key.startsWith('lh_'), ...req }, null, 2) + '\n');
    return { dryRun: true, hayClave: key.startsWith('lh_'), ...req };
  }
  if (!url) throw new Error('Falta la URL de LeadHunter: LEADHUNTER_URL o <HQ>/.leadhunter-url (está en la página Agentes).');
  if (!hq && !args['no-save'] && req.mode === 'hunt') throw new Error('Una cacería gasta créditos y sin --hq (o DMS_HQ) no se guardaría en la memoria. Pasa --hq <HQ>, o --no-save si de verdad no quieres guardarla.');
  if (!key.startsWith('lh_') || /\s/.test(key)) throw new Error('Falta la clave: LEADHUNTER_API_KEY o <HQ>/.leadhunter con una sola línea lh_… (se crea en LeadHunter → Agentes).');

  const res = await fetchImpl(url + '/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify(req),
  });
  if (res.status === 402) {
    let j = {}; try { j = await res.json(); } catch (_) {}
    throw new Error(`Sin créditos suficientes (tienes ${j.credits ?? '?'}, necesitas ${j.needed ?? req.input.count}). Compra en LeadHunter → Créditos.`);
  }
  if (res.status === 401) throw new Error('LeadHunter rechazó la clave (401): revócala y crea otra en Agentes.');
  if (res.status === 429) throw new Error('LeadHunter limita las corridas seguidas (429): espera unos minutos.');
  if (!res.ok || !res.body) {
    let msg = 'HTTP ' + res.status; try { msg = (await res.json()).error || msg; } catch (_) {}
    throw new Error(msg);
  }

  let done = null;
  for await (const ev of readSSE(res.body)) {
    if (ev.type === 'status') log('· ' + ev.text);
    else if (ev.type === 'search') log(ev.query ? `· buscando: «${ev.query}»` : `· búsqueda ${ev.n}…`);
    else if (ev.type === 'error') throw new Error(ev.message || 'error del agente');
    else if (ev.type === 'done') done = ev;
  }
  if (!done) throw new Error('La conexión se cortó antes de terminar (¿URL correcta? ¿clave válida?). Reintenta.');

  const out = { mode: req.mode, input: req.input, result: done.result, charged: done.charged ?? 0, usedSearch: done.usedSearch !== false, huntId: done.huntId || null, leadIds: done.leadIds || [] };
  if (hq) {
    const dir = join(hq, 'memoria', 'prospectos');
    mkdirSync(dir, { recursive: true });
    const base = `${new Date().toISOString().slice(0, 10)}-${req.mode}-${slug(req.mode === 'infer' ? req.input.url : req.input.target)}`;
    let name = base; for (let n = 2; existsSync(join(dir, name + '.json')) || existsSync(join(dir, name + '.md')); n++) name = `${base}-${n}`; // nunca pisar una cacería pagada
    writeFileSync(join(dir, name + '.json'), JSON.stringify(out, null, 2));
    writeFileSync(join(dir, name + '.md'), toMarkdown(out));
    out.saved = join(dir, name + '.md');
    log('· guardado en ' + out.saved);
  } else log('· sin --hq: no se guardó en la memoria');
  stdout.write(JSON.stringify(out, null, 2) + '\n');
  return out;
}

const esPrincipal = (() => { try { return import.meta.url === pathToFileURL(process.argv[1]).href; } catch (_) { return false; } })();
if (esPrincipal) {
  run(process.argv.slice(2)).catch((e) => { process.stderr.write('leadhunter: ' + e.message + '\n'); process.exit(1); });
}
