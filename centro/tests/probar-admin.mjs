// Prueba del panel del dueño centro-admin.html con la API simulada.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { JSDOM, VirtualConsole } = require('jsdom');
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const html = fs.readFileSync(process.env.REPO + '/centro-admin.html', 'utf8');
const TOK = 'k'.repeat(30);
const casa = [{ k: 'c0', n: 'LeadHunter', c: 'Ventas', app: true }, { k: 'c1', n: 'AnsiedadAncla', c: 'Mente', app: false }, { k: 'c2', n: 'ClienteDormido', c: 'Ventas', app: false }, { k: 'c3', n: 'MeditaCorta', c: 'Mente', app: false }];
const S = {
  revision: [{ id: 11, nombre: 'Cierra Tratos', que: 'Cierra ventas por WhatsApp', mundo: 'Ventas', forma: 'hace', por: '@maria', creado: '2026-09-28T12:00:00Z', examen: { aprobado: true, puntaje: 86, motivo: '' } },
    { id: 12, nombre: '<img src=x onerror=alert(1)>', que: 'x', mundo: 'Meta', forma: 'hace', por: '@y', creado: '2026-09-28T12:00:00Z', examen: { aprobado: true, puntaje: 70 } }],
  no_paso: [{ nombre: 'Malo', que: 'x', mundo: 'Meta', por: '@z', examen: { falla: 'seguridad', motivo: 'Da consejos peligrosos' } }],
  examenes: [{ agente: 'c1', aprobado: true, puntaje: 90 }],
};
const calls = [];
const errors = []; const vc = new VirtualConsole(); vc.on('jsdomError', (e) => errors.push(String(e.message)));
let fallarEn = null;
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'https://hk23universe.vercel.app/centro-admin',
  beforeParse(w) {
    w.fetch = (url, init) => {
      const b = JSON.parse(init.body); calls.push({ url, h: init.headers, b });
      let st = 200, body;
      if (init.headers['x-centro-admin'] !== TOK) { st = 401; body = { error: 'Clave de administración inválida.' }; }
      else if (b.accion === 'resumen') body = { ok: true, revision: S.revision, no_paso: S.no_paso, comunidad: 0, casa, examenes: S.examenes.slice() };
      else if (b.accion === 'aprobar' || b.accion === 'rechazar') { S.revision = S.revision.filter((r) => r.id !== b.id); body = { ok: true }; }
      else if (b.accion === 'probar') body = { ok: true, examen: { aprobado: false, puntaje: 40, falla: 'claridad', motivo: 'Respuestas vagas' } };
      else if (b.accion === 'examinar_casa') {
        if (fallarEn === b.k) { st = 502; body = { error: 'Falló: gateway' }; }
        else { const ex = { aprobado: b.k !== 'c3', puntaje: 80, falla: b.k === 'c3' ? 'utilidad' : null, motivo: b.k === 'c3' ? 'No ayuda' : '' }; S.examenes.push(Object.assign({ agente: b.k }, ex)); body = { ok: true, examen: ex }; }
      }
      return new Promise((r) => setTimeout(() => r(new Response(JSON.stringify(body), { status: st })), 5));
    };
  } });
const w = dom.window, d = w.document, $ = (s) => d.querySelector(s), $$ = (s) => [...d.querySelectorAll(s)];
await wait(30);
ok(!calls.length && !$('#login').hidden && $('#panel').hidden, 'sin clave no pide nada y muestra el login');
ok(d.querySelector('meta[name=robots]').content.includes('noindex'), 'noindex');
$('#tok').value = 'mala'; $('#entrar').click(); await wait(40);
ok(/inválida/.test($('#lmsg').textContent) && $('#panel').hidden, 'clave mala: ' + $('#lmsg').textContent);
$('#tok').value = TOK; $('#entrar').click(); await wait(40);
ok(!$('#panel').hidden && $('#login').hidden, 'clave buena abre el panel');
ok(w.sessionStorage.getItem('centro-admin') === TOK, 'la clave queda solo en esta pestaña');
ok($$('#rev .it').length === 2 && /Pasó · 86/.test($('#rev .it').textContent), 'postulaciones en revisión con su prueba');
ok(!$('#rev img') && $$('#rev b')[1].textContent.startsWith('<img'), 'los nombres se muestran como texto (sin inyección)');
ok(/Da consejos peligrosos/.test($('#nop').textContent), 'intentos que no pasaron con su motivo');
ok(/1 de 3 probados · 1 aprobados/.test($('#casaMsg').textContent), 'conteo de la casa sin contar apps: ' + $('#casaMsg').textContent);
// volver a probar
$$('#rev .it')[0].querySelectorAll('button')[2].click(); await wait(40);
ok(/No pasó · claridad/.test($('#rev .it').textContent) && /Respuestas vagas/.test($('#rev .it').textContent), 'volver a probar muestra el nuevo resultado');
// aprobar
$$('#rev .it')[0].querySelector('button').click(); await wait(60);
ok(calls.some((c) => c.b.accion === 'aprobar' && c.b.id === 11) && $$('#rev .it').length === 1, 'aprobar saca la postulación de la lista');
$$('#rev .it')[0].querySelectorAll('button')[1].click(); await wait(60);
ok(/No hay postulaciones/.test($('#rev').textContent), 'rechazar deja la lista vacía');
// examen de la casa, con corte a la mitad
fallarEn = 'c3';
$('#casaGo').click(); await wait(10);
ok(!$('#casaStop').hidden && $('#casaGo').hidden, 'mientras corre se puede detener');
await wait(80);
ok(calls.filter((c) => c.b.accion === 'examinar_casa').map((c) => c.b.k).join() === 'c2,c3', 'prueba solo los que faltan y nunca la app');
ok(/gateway/.test($('#casaMsg').textContent) && !$('#casaGo').hidden, 'si se corta avisa y se puede retomar: ' + $('#casaMsg').textContent);
fallarEn = null; $('#casaGo').click(); await wait(100);
ok(/3 de 3 probados · 2 aprobados/.test($('#casaMsg').textContent) && $('#casaGo').hidden, 'al terminar: ' + $('#casaMsg').textContent);
ok(/MeditaCorta/.test($('#casaFallas').textContent) && /No ayuda/.test($('#casaFallas').textContent), 'lista a los de la casa que no pasaron');
ok(calls.every((c) => c.h['x-centro-admin'] === c.h['x-centro-admin'] && c.url === '/api/centro-admin'), 'todo va a /api/centro-admin');
ok(!errors.length, 'sin errores de script ' + errors.join(' / '));
process.exit();
