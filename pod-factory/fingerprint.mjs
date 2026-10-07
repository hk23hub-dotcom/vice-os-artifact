// fingerprint.mjs — huella visual para detectar "la misma imagen con otro nombre".
// La imagen se reduce a 16x16 a color (768 valores). La distancia es la diferencia absoluta
// media por canal (0-255).
//
// Calibrado contra el catálogo real (2026-09-27):
//   · la MISMA imagen recomprimida y reescalada queda a ≤ 3.0
//   · variaciones/upscales de un mismo resultado de MidJourney quedan entre 0.7 y 7.1
//   · piezas distintas de una misma serie (tótems, circuitos) quedan sobre 9
// Una huella gris de 8x8 NO sirve: confunde piezas distintas que comparten composición.
import { readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const SAME_IMAGE = 8;
const N = 16;
const TMP = join(tmpdir(), `fp-${process.pid}.bmp`);

export function fingerprint(file) {
  try {
    execFileSync('sips', ['-s', 'format', 'bmp', '-z', String(N), String(N), file, '--out', TMP], { stdio: 'ignore' });
    const b = readFileSync(TMP);
    const off = b.readUInt32LE(10), bpp = b.readUInt16LE(28) / 8;
    const row = Math.ceil((N * bpp) / 4) * 4;
    const v = Buffer.alloc(N * N * 3);
    let k = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const o = off + y * row + x * bpp;
      v[k++] = b[o]; v[k++] = b[o + 1]; v[k++] = b[o + 2];
    }
    return v.toString('base64');
  } catch { return null; } finally { try { rmSync(TMP); } catch {} }
}

export function distance(a, b) {
  const x = Buffer.from(a, 'base64'), y = Buffer.from(b, 'base64');
  if (x.length !== y.length) return Infinity;
  let s = 0;
  for (let i = 0; i < x.length; i++) s += Math.abs(x[i] - y[i]);
  return s / x.length;
}

// Dos umbrales, porque equivocarse cuesta distinto en cada sentido:
//   ≤ SAME_STRICT → es la misma imagen con seguridad (rango medido para recompresión/reescalado)
//   ≤ SAME_IMAGE  → probablemente la misma, pero dos piezas DISTINTAS de fondo parejo también
//                   pueden caer aquí. No se decide solo: va a revisión.
export const SAME_STRICT = 3;

// La coincidencia MÁS CERCANA, no la primera que pase el umbral.
export function nearest(fp, known) {
  let best = null;
  for (const [id, k] of known) {
    const d = distance(fp, k);
    if (!best || d < best.d) best = { id, d };
  }
  return best;
}

export function findSame(fp, known) {
  const n = nearest(fp, known);
  return n && n.d <= SAME_IMAGE ? n.id : null;
}
