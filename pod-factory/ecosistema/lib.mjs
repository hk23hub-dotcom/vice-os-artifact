import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
export const ECO  = path.join(ROOT, 'ecosistema');

export const hoy = () => new Date().toISOString().slice(0,10);

export function readJSON(rel, fallback = null){
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
  catch { return fallback; }
}
export function readText(rel, fallback = ''){
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
  catch { return fallback; }
}
export function listDir(rel){
  try { return fs.readdirSync(path.join(ROOT, rel)); } catch { return []; }
}
export function writeOut(rel, txt){
  const f = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, txt);
  return rel;
}
export function appendMemoria(code, linea){
  const rel = `ecosistema/agentes/${code}/memoria.md`;
  const f = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const prev = fs.existsSync(f) ? fs.readFileSync(f,'utf8') : '';
  if (prev.includes(linea)) return false;        // no repite lo ya aprendido
  fs.appendFileSync(f, (prev.endsWith('\n')||!prev ? '' : '\n') + linea + '\n');
  return true;
}
export const reparto = () => readJSON('ecosistema/reparto.json', { agentes: [] });
export const clp = n => '$' + Number(n||0).toLocaleString('es-CL');
