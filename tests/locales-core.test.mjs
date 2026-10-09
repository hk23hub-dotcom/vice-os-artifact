import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../leadhunter/locales-core.js';

test('buildSystem ancla el país y la ruta de fuentes', () => {
  const cl = C.buildSystem({ pais: 'CL', cfg: { nombre: 'Ana', rol: 'corredor' } });
  assert.match(cl, /Región de Valparaíso, Chile/);
  assert.match(cl, /Conservador de Bienes Raíces/);
  assert.match(cl, /Mapas SII/);
  assert.match(cl, /Quien contacta: Ana/);
  assert.match(cl, /corredor de propiedades/);
  assert.doesNotMatch(cl, /ONAPI/);
  const rd = C.buildSystem({ pais: 'DO' });
  assert.match(rd, /República Dominicana/);
  assert.match(rd, /Registro Inmobiliario/);
  assert.doesNotMatch(rd, /Conservador/);
});

test('buildUserContent intercala texto e imágenes y cierra con el pedido', () => {
  const content = C.buildUserContent({
    pais: 'CL', objetivo: 'arrendar', notas: 'letrero sin teléfono',
    marcas: [{ n: 1, lat: -33.6375, lon: -71.636, dir: 'Av. del Litoral', imgs: [{ b64: 'AAA' }, { b64: 'BBB' }] }],
    fotos: [{ n: 1, nombre: 'fachada.jpg', b64: 'CCC', gps: { lat: -33.6, lon: -71.6 } }],
  });
  assert.deepEqual(content.map(b => b.type), ['text', 'image', 'image', 'text', 'image', 'text']);
  assert.match(content[0].text, /MARCA #1 — coordenadas -33\.637500, -71\.636000/);
  assert.match(content[3].text, /GPS de la foto: -33\.600000/);
  assert.match(content.at(-1).text, /MODO: BARRIDO/);
  assert.match(content.at(-1).text, /Numera las FICHA/);
  assert.equal(content[1].source.media_type, 'image/jpeg');
});

test('buildRequest arma herramientas, ubicación y fallbacks', () => {
  const { body, headers } = C.buildRequest({ model: 'claude-opus-5-5', effort: 'high', pais: 'CL', cfg: {}, messages: [] });
  assert.equal(body.tools[0].type, 'web_search_20260209');
  assert.equal(body.tools[0].user_location.country, 'CL');
  assert.equal(body.tools[1].type, 'web_fetch_20260209');
  assert.equal(body.output_config.effort, 'high');
  assert.equal(body.fallbacks, 'default');
  assert.equal(headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
  assert.equal(headers['anthropic-dangerous-direct-browser-access'], 'true');
  const sin = C.buildRequest({ model: 'claude-sonnet-5-5', pais: 'DO', cfg: {}, messages: [], fallbacks: false });
  assert.equal(sin.body.fallbacks, undefined);
  assert.equal(sin.headers['anthropic-beta'], undefined);
  assert.equal(sin.body.tools[0].user_location.country, 'DO');
});

test('parseSSE separa eventos y conserva el resto incompleto', () => {
  const { eventos, resto } = C.parseSSE('event: a\ndata: {"type":"ping"}\n\nevent: b\ndata: {"type":"mes');
  assert.deepEqual(eventos, [{ type: 'ping' }]);
  assert.equal(resto, 'event: b\ndata: {"type":"mes');
});

test('Acumulador reconstruye texto, herramientas, citas y stop_reason', () => {
  const acc = new C.Acumulador();
  const vistos = [];
  const on = { texto: t => vistos.push(t), bloque: (b, f) => f === 'stop' && b.type === 'server_tool_use' && vistos.push('Q:' + b.input.query) };
  const evs = [
    { type: 'message_start', message: { model: 'claude-opus-5-5', usage: { input_tokens: 10 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'server_tool_use', id: 'srv_1', name: 'web_search', input: {} } },
    { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"query":"locales ' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: 'Santo Domingo"}' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'content_block_start', index: 1, content_block: { type: 'web_search_tool_result', tool_use_id: 'srv_1', content: [{ type: 'web_search_result', url: 'https://www.yapo.cl/x', title: 'Yapo' }] } },
    { type: 'content_block_stop', index: 1 },
    { type: 'content_block_start', index: 2, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 2, delta: { type: 'text_delta', text: '1. UBICACIÓN\n' } },
    { type: 'content_block_delta', index: 2, delta: { type: 'citations_delta', citation: { type: 'web_search_result_location', url: 'https://www.portalinmobiliario.com/y', title: 'PI' } } },
    { type: 'content_block_delta', index: 2, delta: { type: 'text_delta', text: 'Santo Domingo' } },
    { type: 'content_block_stop', index: 2 },
    { type: 'message_delta', delta: { stop_reason: 'pause_turn' }, usage: { output_tokens: 50 } },
  ];
  for (const e of evs) acc.push(e, on);
  assert.equal(acc.texto, '1. UBICACIÓN\nSanto Domingo');
  assert.equal(acc.stopReason, 'pause_turn');
  assert.deepEqual(acc.content[0].input, { query: 'locales Santo Domingo' });
  assert.equal(acc.usage.input_tokens, 10);
  assert.equal(acc.usage.output_tokens, 50);
  assert.deepEqual(vistos, ['Q:locales Santo Domingo', '1. UBICACIÓN\n', 'Santo Domingo']);
  const fs = C.fuentes(acc.bloques);
  assert.equal(fs[0].url, 'https://www.portalinmobiliario.com/y');
  assert.equal(fs[0].citada, true);
  assert.equal(fs[1].url, 'https://www.yapo.cl/x');
});

test('parseFichas lee la línea FICHA con tildes y la quita del texto', () => {
  const texto = 'algo\nFICHA #2 | puntaje: 81 | prioridad: ATACAR YA | dirección: Av. del Litoral 245, Santo Domingo | dueño: no encontrado | estatus: desconocido | contacto: MKT Propiedades, formulario | siguiente paso: llamar a la corredora\nfin';
  const [f] = C.parseFichas(texto);
  assert.equal(f.n, 2); assert.equal(f.puntaje, 81); assert.equal(f.prioridad, 'ATACAR YA');
  assert.equal(f.direccion, 'Av. del Litoral 245, Santo Domingo');
  assert.equal(f.dueno, 'no encontrado'); assert.equal(f.estatus, 'desconocido');
  assert.equal(f.siguiente, 'llamar a la corredora');
  assert.equal(C.sinFichas(texto), 'algo\nfin');
  assert.equal(C.parseFichas('FICHA #1 | puntaje: 140').at(0).puntaje, 100);
});

test('secciones separa por títulos numerados en mayúsculas', () => {
  const s = C.secciones('intro\n1. UBICACIÓN\nCalle 1\n2. DUEÑO O ADMINISTRADOR:\nno encontrado\n8. PLAN DE EJECUCIÓN (acciones numeradas; marca cuáles hace el usuario)\n1. Llamar a la corredora\n2. Pedir el rol en Mapas SII\n');
  assert.deepEqual(s.map(x => x.titulo), ['', '1. UBICACIÓN', '2. DUEÑO O ADMINISTRADOR', '8. PLAN DE EJECUCIÓN']);
  assert.equal(s[1].cuerpo, 'Calle 1');
  // las acciones numeradas en minúsculas quedan dentro de su sección
  assert.equal(s[3].cuerpo, '1. Llamar a la corredora\n2. Pedir el rol en Mapas SII');
});

test('prioridadDe usa el texto y si no, el puntaje', () => {
  assert.equal(C.prioridadDe(30, 'EN COLA'), 'EN COLA');
  assert.equal(C.prioridadDe(80, ''), 'ATACAR YA');
  assert.equal(C.prioridadDe(60, ''), 'EN COLA');
  assert.equal(C.prioridadDe(10, ''), 'DESCARTAR');
  assert.equal(C.prioridadDe(null, ''), '');
});

test('parseCSV maneja comillas, comas y saltos de línea; toCSV escapa', () => {
  const rows = C.parseCSV('﻿a,b\n"x, y","línea 1\nlínea 2"\n"con ""comillas""",z\n');
  assert.deepEqual(rows, [['a', 'b'], ['x, y', 'línea 1\nlínea 2'], ['con "comillas"', 'z']]);
  const csv = C.toCSV([{ a: 'x,y', b: 'ok' }], [{ titulo: 'A', valor: r => r.a }, { titulo: 'B', valor: r => r.b }]);
  assert.equal(csv, '﻿A,B\r\n"x,y",ok');
});

test('leadsDesdeLeadHunter importa el CSV de la app', () => {
  const csv = 'Puntaje,Veredicto,Motivo veredicto,Prospecto,Para quién,Datos,Señal,Por qué encaja,Contacto,WhatsApp,Email,Fuente,Objeción,Mensaje,Seguimiento (día 3),Estado\n"88","🟢","m","Focolare Propiedades — Local Santa Teresa 41","Corredora","450 m²","Anuncio activo","encaja","focolare.cl","","","https://www.icasas.cl/x","obj","Hola\nqué tal","seg","new"\n';
  const [l] = C.leadsDesdeLeadHunter(C.parseCSV(csv));
  assert.equal(l.titulo, 'Focolare Propiedades — Local Santa Teresa 41');
  assert.equal(l.puntaje, 88); assert.equal(l.prioridad, 'ATACAR YA');
  assert.equal(l.contacto, 'focolare.cl'); assert.equal(l.fuente, 'https://www.icasas.cl/x');
  assert.match(l.analisis, /MENSAJE\nHola\nqué tal/);
  assert.deepEqual(C.leadsDesdeLeadHunter([['otra', 'cosa']]), []);
});

function jpegConGps(lat, lon) {
  // JPEG mínimo: SOI + APP1 (Exif, TIFF little endian, IFD0 con puntero GPS, IFD GPS) + EOI
  const deg = x => { const a = Math.abs(x); const d = Math.floor(a); const mf = (a - d) * 60; const m = Math.floor(mf); const s = Math.round((mf - m) * 60 * 100); return [[d, 1], [m, 1], [s, 100]]; };
  const tiff = new DataView(new ArrayBuffer(200)); let o = 0;
  const w16 = v => { tiff.setUint16(o, v, true); o += 2; }; const w32 = v => { tiff.setUint32(o, v, true); o += 4; };
  w16(0x4949); w16(42); w32(8);
  w16(1); w16(0x8825); w16(4); w32(1); w32(26); w32(0); // IFD0: 1 entrada → GPS en 26
  const gpsStart = 26; o = gpsStart; const datos = gpsStart + 2 + 4 * 12 + 4; let d = datos;
  w16(4);
  const ent = (tag, tipo, cnt, val) => { w16(tag); w16(tipo); w32(cnt); w32(val); };
  ent(1, 2, 2, lat < 0 ? 0x53 : 0x4E); ent(2, 5, 3, d); const latOff = d; d += 24;
  ent(3, 2, 2, lon < 0 ? 0x57 : 0x45); ent(4, 5, 3, d); const lonOff = d; d += 24;
  w32(0);
  const rat = (off, arr) => arr.forEach(([n, den], i) => { tiff.setUint32(off + i * 8, n, true); tiff.setUint32(off + i * 8 + 4, den, true); });
  rat(latOff, deg(lat)); rat(lonOff, deg(lon));
  const tiffBytes = new Uint8Array(tiff.buffer, 0, d);
  const app1Len = 2 + 6 + tiffBytes.length;
  const out = new Uint8Array(2 + 2 + app1Len + 2); const dv = new DataView(out.buffer);
  dv.setUint16(0, 0xFFD8); dv.setUint16(2, 0xFFE1); dv.setUint16(4, app1Len);
  out.set([0x45, 0x78, 0x69, 0x66, 0, 0], 6); out.set(tiffBytes, 12);
  dv.setUint16(12 + tiffBytes.length, 0xFFD9);
  return out.buffer;
}

test('gpsDeJpeg lee coordenadas EXIF y responde null sin GPS', () => {
  const g = C.gpsDeJpeg(jpegConGps(-33.6375, -71.636));
  assert.ok(Math.abs(g.lat + 33.6375) < 1e-4, String(g.lat));
  assert.ok(Math.abs(g.lon + 71.636) < 1e-4, String(g.lon));
  assert.equal(C.gpsDeJpeg(new Uint8Array([0x89, 0x50, 0x4E, 0x47]).buffer), null);
  assert.equal(C.gpsDeJpeg(new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9]).buffer), null);
});

test('teselasPara cubre el lienzo y centra el punto', () => {
  const ts = C.teselasPara(-33.6375, -71.636, 18, 768, 768);
  assert.ok(ts.length >= 9 && ts.length <= 16);
  const c = C.aPixel(-33.6375, -71.636, 18);
  for (const t of ts) assert.ok(t.dx > -256 && t.dx < 768 && t.dy > -256 && t.dy < 768);
  const t0 = ts.find(t => t.x === Math.floor(c.x / 256) && t.y === Math.floor(c.y / 256));
  assert.ok(t0, 'incluye la tesela del centro');
  assert.equal(Math.round(t0.dx + (c.x - t0.x * 256)), 384);
});

test('costoAprox y enlaces', () => {
  const usd = C.costoAprox('claude-opus-5-5', { input_tokens: 1e6, output_tokens: 1e5, server_tool_use: { web_search_requests: 10 } });
  assert.ok(Math.abs(usd - (4 + 2 + 0.1)) < 1e-9);
  const e = C.enlaces(-33.6375, -71.636);
  assert.match(e.streetview, /map_action=pano&viewpoint=-33\.637500,-71\.636000/);
  assert.match(e.earth, /^https:\/\/earth\.google\.com\/web\/@-33\.637500,-71\.636000,/);
});
