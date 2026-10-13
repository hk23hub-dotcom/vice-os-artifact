import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const M = require('../minas-utils.js');

test('patenteAnual: 86 ha explotación = 34.4 UTM', () => {
  const p = M.patenteAnual(86, 'explotacion', 70000, 950);
  assert.equal(p.utm, 34.4);
  assert.equal(p.clp, 2408000);
});

test('patenteAnual: exploración 714 ha ≈ 42,84 UTM', () => {
  assert.equal(M.patenteAnual(714, 'exploracion', 71721, 950).utm, 42.84);
});

test('deudaImpaga: un año con recargo = doble', () => {
  assert.equal(M.deudaImpaga(86, 1, 70000, 950).utm, 68.8);
});

test('rect: 2000×1100 = 220 ha', () => {
  const r = M.rect(0, 0, 2000, 1100);
  assert.equal(r.ha, 220);
  assert.deepEqual(M.esquinas(r)[2], ['NE', 2000, 1100]);
});

test('validarPedimento / ajustarPedimento (lados múltiplos de 100 m)', () => {
  assert.equal(M.validarPedimento(M.rect(0, 0, 2100, 3400)).ok, true);
  const r = M.rect(0, 0, 2150, 1180);
  assert.equal(M.validarPedimento(r).ok, false);
  const p = M.ajustarPedimento(r);
  assert.equal(p.ha, 231);
  assert.equal(M.validarPedimento(p).ok, true);
});

test('pertenencias: 2000×1100 → 22 de 10 ha', () => {
  const r = M.rect(0, 0, 2000, 1100);
  const p = M.pertenencias(r);
  assert.equal(p.n, 22);
  assert.equal(p.haCada, 10);
});

test('contigüidad y traslape', () => {
  const a = M.rect(0, 0, 1000, 1000);
  assert.equal(M.sonContiguos(a, M.rect(1000, 0, 2000, 1000)), true);
  assert.equal(M.sonContiguos(a, M.rect(1000, 1000, 2000, 2000)), false); // solo esquina
  assert.equal(M.seTraslapan(a, M.rect(500, 500, 1500, 1500)), true);
  assert.equal(M.distanciaKm(a, M.rect(3000, 0, 4000, 1000)), 3);
});

test('score: área libre contigua a impaga, competidor lejos → tier A', () => {
  const s = M.score({ tipo: 'area_libre', estadoPatente: 'n/a', contiguaImpaga: true, ha: 200, competidorKm: 2.11 });
  assert.equal(s.total, 20 + 20 + 10 + 15);
  assert.equal(M.tier(s.total), 'A');
  const s2 = M.score({ tipo: 'area_libre', estadoPatente: 'n/a', contiguaImpaga: false, ha: 40, competidorKm: 0.5 });
  assert.equal(M.tier(s2.total), 'C');
});

test('parseCSV acepta ; y ,', () => {
  assert.deepEqual(M.parseCSV('a;b\n1;2\n'), [{ a: '1', b: '2' }]);
  assert.deepEqual(M.parseCSV('a,b\r\n3,4'), [{ a: '3', b: '4' }]);
});
