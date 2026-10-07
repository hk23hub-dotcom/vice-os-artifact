// lib.mjs — piezas compartidas por todos los scripts del POD FACTORY.
// Existen porque el sistema corre desatendido: un ledger truncado, una red caída al despertar
// el Mac o dos corridas a la vez no pueden terminar en productos duplicados ni en estado perdido.
import { readFileSync, writeFileSync, renameSync, existsSync, copyFileSync, mkdirSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = dirname(fileURLToPath(import.meta.url));
const CFG_FILE = '/Users/hk23neo/vice-os-artifact/vice-seller/config.local.json';
export const CFG = existsSync(CFG_FILE) ? JSON.parse(readFileSync(CFG_FILE, 'utf8')) : {};
export const SHOP = CFG.printifyShopId;
const BASE = 'https://api.printify.com/v1';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fecha LOCAL (no UTC): una corrida a las 22:00 en Chile pertenece a hoy, no a mañana.
export const today = () => new Date().toLocaleDateString('sv-SE');

// ── estado en disco ─────────────────────────────────────────────────────────
// Escritura atómica: se escribe a .tmp y se renombra. Si el proceso muere a mitad de camino,
// el archivo anterior queda intacto. Se guarda además el último estado bueno en .bak.
export function saveJSON(file, obj) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  if (existsSync(file)) { try { copyFileSync(file, `${file}.bak`); } catch {} }
  renameSync(tmp, file);
}

// Nunca se parte de un ledger vacío por error: si el archivo existe pero no parsea,
// se usa el respaldo; si tampoco sirve, se aborta con un mensaje claro.
export function loadJSON(file, fallback) {
  if (!existsSync(file)) return fallback;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch (e) {
    const bak = `${file}.bak`;
    if (existsSync(bak)) {
      try { const v = JSON.parse(readFileSync(bak, 'utf8')); console.log(`! ${file} estaba dañado: se recuperó desde el respaldo.`); return v; } catch {}
    }
    throw new Error(`${file} está dañado y no hay respaldo válido. No sigo para no duplicar productos. (${e.message})`);
  }
}

// ── Printify con reintentos ─────────────────────────────────────────────────
// Reintenta cortes de red, 429 y 5xx con espera creciente (≈2,5 min en total).
// Un 4xx distinto de 429 es un error real y se devuelve de inmediato.
export async function printify(path, init = {}) {
  const headers = { Authorization: `Bearer ${CFG.printifyToken}`, 'Content-Type': 'application/json' };
  const esperas = [4000, 12000, 35000, 90000];
  let ultimo;
  for (let i = 0; i <= esperas.length; i++) {
    try {
      const r = await fetch(`${BASE}${path}`, { headers, ...init });
      const body = await r.text();
      if (r.ok) return body ? JSON.parse(body) : {};
      const err = new Error(`${init.method || 'GET'} ${path} → ${r.status}: ${body.slice(0, 250)}`);
      err.status = r.status;
      try { err.code = JSON.parse(body).code; } catch {}
      if (r.status !== 429 && r.status < 500) throw err;
      ultimo = err;
    } catch (e) {
      if (e.status && e.status !== 429 && e.status < 500) throw e;
      ultimo = e;
    }
    if (i < esperas.length) await sleep(esperas[i]);
  }
  throw ultimo;
}

// ── candado de ejecución ────────────────────────────────────────────────────
// Dos corridas a la vez elegirían las mismas piezas y publicarían duplicados.
const vivo = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
export function acquireLock(name) {
  const file = join(ROOT, 'data', `.lock-${name}`);
  mkdirSync(dirname(file), { recursive: true });
  for (let intento = 0; intento < 2; intento++) {
    try {
      const fd = openSync(file, 'wx');
      writeFileSync(fd, String(process.pid));
      closeSync(fd);
      const soltar = () => { try { if (readFileSync(file, 'utf8') === String(process.pid)) unlinkSync(file); } catch {} };
      process.on('exit', soltar);
      process.on('SIGINT', () => { soltar(); process.exit(130); });
      process.on('SIGTERM', () => { soltar(); process.exit(143); });
      return true;
    } catch {
      let pid = NaN;
      try { pid = Number(readFileSync(file, 'utf8')); } catch {}
      if (pid && vivo(pid)) return false;        // hay otra corrida viva
      try { unlinkSync(file); } catch {}          // candado huérfano: se toma
    }
  }
  return false;
}
