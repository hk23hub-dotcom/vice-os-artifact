import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validarGuia, validarSalida, armarSalida, render, referencias, progreso, vacia } from '../guias/motor.js';
import { GUIAS } from '../api/_guias.js';
import { evaluarLicencia } from '../api/guia-unlock.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'guias');
const cat = JSON.parse(readFileSync(join(DIR, 'catalogo.json'), 'utf8'));
const guias = cat.guias.map((id) => JSON.parse(readFileSync(join(DIR, id + '.json'), 'utf8')));

test('el catálogo apunta a guías que existen y validan', () => {
  assert.ok(cat.guias.length >= 1);
  for (const g of guias) assert.deepEqual(validarGuia(g), [], g.id);
  const jsons = readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'catalogo.json').map((f) => f.replace('.json', ''));
  assert.deepEqual(jsons.sort(), [...cat.guias].sort(), 'toda guía del disco está en el catálogo');
});

test('cada guía tiene su parte paga en el servidor y las plantillas referencian ids reales', () => {
  for (const g of guias) {
    assert.ok(GUIAS[g.id], 'falta parte paga de ' + g.id);
    assert.deepEqual(validarSalida(GUIAS[g.id].salida, g.pasos), [], g.id);
    assert.ok(GUIAS[g.id].salida.archivos.length >= 3);
  }
});

test('la parte pública no contiene las plantillas pagas ni respuestas reales de clientes', () => {
  const pub = readFileSync(join(DIR, 'gerente-general.json'), 'utf8');
  assert.doesNotMatch(pub, /Eres el Builder/);
  assert.doesNotMatch(pub, /desorden y destiempos|dmsinversiones|DMS Inversiones|abarcar todo|imagen de la empresa|trato con clientes|control general|búsqueda de (nuevos )?proyectos|arquitectura y construcción/i, 'los ejemplos no pueden ser las respuestas reales del cliente');
  assert.match(pub, /"gumroad": "https:\/\/hk23hub\.gumroad\.com\/l\//);
  assert.match(pub, /ficticia/);
  const g = guias.find((x) => x.id === 'gerente-general');
  assert.equal(g.pasos.length, 17);
  assert.ok(g.pasos.every((p) => p.default != null), 'todo paso tiene valor por defecto para «no sé»');
});

test('motor: vacia, render con {{id}}, {{id|fb}} y [[si:id]], y progreso', () => {
  assert.equal(vacia('no sé'), true); assert.equal(vacia('No se'), true); assert.equal(vacia(''), true); assert.equal(vacia([]), true);
  assert.equal(vacia('Constructora'), false); assert.equal(vacia(['a']), false);
  const pasos = [{ id: 'a', tipo: 'text', default: 'D' }, { id: 'b', tipo: 'multi' }, { id: 'c', tipo: 'text' }];
  const t = 'A={{a}} B={{b}} C={{c|sin c}}[[si:c]] (hay c: {{c}})[[/si]]';
  assert.equal(render(t, { a: 'no sé', b: ['x', 'y'] }, pasos), 'A=D B=x, y C=sin c\n');
  assert.equal(render(t, { a: 'A1', b: [], c: 'C1' }, pasos), 'A=A1 B= C=C1 (hay c: C1)\n');
  assert.deepEqual(referencias(t).sort(), ['a', 'b', 'c']);
  assert.deepEqual(progreso({ pasos }, { a: 'x', b: 'no sé' }), { hechos: 1, total: 3, pct: 33 });
  // :linea colapsa saltos (tablas y títulos); [[si]] respeta defaults; marcadores sueltos no llegan al comprador
  assert.equal(render('| E | {{c:linea}} |', { c: 'Línea 1\nLínea 2' }, pasos), '| E | Línea 1 · Línea 2 |\n');
  assert.equal(render('[[si:a]]hay a[[/si]]', { a: 'no sé' }, pasos), 'hay a\n');
  assert.equal(render('x [[si:a]] y', { a: 'z' }, pasos), 'x  y\n');
  assert.deepEqual(validarSalida({ prompt: 'ok [[si:a]] sin cierre', archivos: [{ nombre: 'a.md', plantilla: 'b' }] }, pasos), ['prompt: [[si]] sin cerrar']);
});

test('armarSalida produce el prompt y los archivos con las respuestas (y con «no sé» usa defaults)', () => {
  const g = guias.find((x) => x.id === 'gerente-general');
  const r = { empresa: 'Constructora Andina SpA\nValparaíso', etapa: 'crecimiento', funciones: ['dar seguimiento a pendientes y compromisos', 'preparar decisiones con opciones, riesgos y recomendación'], prohibido: 'nunca decidir solo', nombre_gerente: 'Andrés' };
  const out = armarSalida(GUIAS[g.id].salida, r, g.pasos);
  assert.match(out.prompt, /Constructora Andina SpA\nValparaíso/);
  assert.match(out.archivos[0].contenido, /\| Empresa \| Constructora Andina SpA · Valparaíso \|/, 'la tabla queda en una fila');
  assert.match(out.archivos[0].contenido, /## Skills recomendadas \(una por función\)\ndar seguimiento/);
  assert.match(out.prompt, /Llama al gerente "Andrés"/);
  assert.match(out.prompt, /dar seguimiento a pendientes y compromisos, preparar decisiones/);
  assert.match(out.prompt, /no sé \(se define en la primera sesión\)/, 'herramientas sin responder → default');
  assert.doesNotMatch(out.prompt, /\{\{|\[\[/, 'sin construcciones sin resolver');
  assert.deepEqual(out.archivos.map((a) => a.nombre), ['spec-agente.md', 'checklist-agente.md', 'primera-sesion.md']);
  for (const a of out.archivos) assert.doesNotMatch(a.contenido, /\{\{|\[\[/, a.nombre);
  const prev = render(g.vista_previa, r, g.pasos);
  assert.match(prev, /se desbloquean con la compra/);
});

test('evaluarLicencia: acepta compra válida, rechaza reembolsos y exceso de asientos', () => {
  assert.equal(evaluarLicencia({ success: true, uses: 2, purchase: { email: 'ab@x.cl' } }).ok, true);
  assert.equal(evaluarLicencia({ success: true, uses: 2, purchase: { email: 'ab@x.cl' } }).email, 'a***@x.cl');
  assert.equal(evaluarLicencia({ success: false }).ok, false);
  assert.equal(evaluarLicencia(null).ok, false);
  assert.match(evaluarLicencia({ success: true, purchase: { refunded: true } }).error, /reembolsada/);
  assert.match(evaluarLicencia({ success: true, uses: 6, purchase: {} }, { maxSeats: 5 }).error, /5 dispositivos/);
});
