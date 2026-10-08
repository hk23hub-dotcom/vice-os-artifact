// Prueba de la página pública centro.html contra la API: estado real (handler), correr, pase y postular simulados.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { JSDOM, VirtualConsole } = require('jsdom');
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const WEB = process.env.CENTRO_HTML || process.env.REPO + '/centro.html';

// ---------- 1. el estado sale del handler real, con Supabase simulado ----------
process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc-test';
process.env.CENTRO_PASE_URL = 'https://fcqevq-jr.myshopify.com/products/pase-30-dias';
const realFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const u = String(url);
  const body = u.includes('/centro_agentes') ? [{ id: 7, nombre: 'GTA Heist Planner', mundo: 'gta 6', forma: 'hace', que: 'Arma el plan del golpe', por: '@fan', examen: { aprobado: true } }]
    : u.includes('/centro_uso') ? [{ agente: 'c0', usos: 40 }, { agente: 'u7', usos: 3 }]
    : u.includes('/centro_examenes') ? [{ agente: 'c1' }] : [];
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
};
const { default: estadoH } = await import('./api/centro-estado.js');
function fakeRes() { const r = { h: {}, code: 0, body: null }; r.setHeader = (k, v) => { r.h[k] = v; }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; r.end = () => r; return r; }
const er = fakeRes(); await estadoH({ method: 'GET', headers: {} }, er);
globalThis.fetch = realFetch;
const ESTADO = er.body;
ok(er.code === 200 && ESTADO.conectado === true, 'centro-estado responde conectado');
ok(ESTADO.agentes.length === 157, 'estado trae 156 de la casa + 1 de la comunidad (' + ESTADO.agentes.length + ')');
ok(!JSON.stringify(ESTADO).includes('ACOMPAÑAS') && !ESTADO.agentes.some((a) => 'rules' in a || 'p' in a), 'el estado no expone instrucciones');
ok(ESTADO.agentes.find((a) => a.k === 'u7').c === 'GTA 6', '"gta 6" se une al mundo GTA 6');

// ---------- 2. la página ----------
function montar(estado, opts = {}) {
  const html = fs.readFileSync(WEB, 'utf8');
  const errors = [], calls = [], anon = { n: 0 };
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { if (!/canvas|getContext|HTMLCanvasElement|Could not load script/i.test(String(e.message))) errors.push(String(e.message)); });
  const H = Object.assign({
    'centro-correr': () => ({ status: 200, body: { ok: true, texto: 'Respira conmigo. Suelta los hombros.', firma: 'f1', restantes: 4, plan: 'gratis' } }),
    'centro-pase': () => ({ status: 200, body: { ok: true, vence: '2026-10-28T12:00:00.000Z' } }),
    'centro-postular': () => ({ status: 200, body: { ok: true, aprobado: true, puntaje: 90, mundo: 'Ventas' } }),
  }, opts.H || {});
  const downloads = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'https://hk23universe.vercel.app/centro',
    beforeParse(w) {
      w.fetch = (url, init = {}) => {
        const ruta = String(url).replace(/^.*\/api\//, '');
        calls.push({ ruta, init, body: init.body ? JSON.parse(init.body) : null });
        if (ruta === 'centro-sesion') { anon.n++; return Promise.resolve(new Response(JSON.stringify({ ok: true, token: 'c1.tok-' + anon.n }), { status: 200 })); }
        if (opts.expira && ruta === opts.expira && init.headers.authorization === 'Bearer c1.tok-1') return Promise.resolve(new Response(JSON.stringify({ ok: false, code: 'sin_sesion', error: 'x' }), { status: 401 }));
        if (ruta === 'centro-estado') return Promise.resolve(new Response(JSON.stringify(estado), { status: 200 }));
        const f = H[ruta]; if (!f) return Promise.reject(new Error('ruta ' + ruta));
        const r = f(calls[calls.length - 1]);
        return new Promise((res, rej) => setTimeout(() => {
          if (init.signal && init.signal.aborted) { const e = new Error('abort'); e.name = 'AbortError'; rej(e); return; }
          res(new Response(JSON.stringify(r.body), { status: r.status }));
        }, r.ms || 10));
      };
      const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {}, width: 10 })), set: (t, k, v) => { t[k] = v; return true; } });
      w.HTMLCanvasElement.prototype.getContext = () => ctx;
      w.HTMLCanvasElement.prototype.toBlob = function (cb) { setTimeout(() => cb(new w.Blob(['png'], { type: 'image/png' })), 0); };
      w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {};
      w.HTMLAnchorElement.prototype.click = function () { if (this.hasAttribute('download')) downloads.push(this.download); };
    },
  });
  const w = dom.window, d = w.document;
  return { w, d, $: (s) => d.querySelector(s), $$: (s) => [...d.querySelectorAll(s)], calls, anon, errors, downloads };
}
const tile = (P, n) => P.$$('.tile').find((t) => t.querySelector('.tn').textContent === n);

const P = montar(ESTADO);
await wait(200);
const { $, $$, calls, anon } = P;
ok($$('.tile').length === 157, '157 bloques en el mapa (' + $$('.tile').length + ')');
ok($$('.sector').filter((s) => s.querySelector('.sector-h')).length === 22, '22 mundos (el de la comunidad se unió a GTA 6)');
const bq = $$('#bloques .bq');
ok(bq.length === 4 && bq[0].classList.contains('on') && bq.slice(1).every((b) => /pronto/.test(b.textContent)), 'bloques: Agentes activo; Sistemas, Oficinas, Agencias "pronto" (' + bq.map((b) => b.textContent).join(' | ') + ')');
ok(/Motor encendido/.test($('#pillT').textContent), 'motor: ' + $('#pillT').textContent);
ok($('#plan').textContent === '5 usos gratis para probar', 'plan inicial: ' + $('#plan').textContent);
ok(anon.n === 0 && !calls.some((c) => c.ruta !== 'centro-estado'), 'no abre sesión ni gasta nada solo por visitar');
ok([...P.d.querySelectorAll('script[src]')].every((x) => x.getAttribute('src') === '/_vercel/insights/script.js'), 'sin scripts de terceros: solo Vercel Analytics del mismo origen (nada de supabase-js)');
ok(/99 cupos libres/.test(($('.openb') || {}).textContent || ''), 'cupos libres: ' + (($('.openb') || {}).textContent || '—'));
const fan = tile(P, 'GTA Heist Planner');
ok(fan && /✓\s*Por @fan/.test(fan.querySelector('.tp').textContent), 'el bloque postulado lleva firma y sello: ' + (fan && fan.querySelector('.tp').textContent));
const casa0 = $$('.tile').find((t) => /HK23/.test(t.querySelector('.tp').textContent));
ok(!!casa0, 'los bloques de la casa firman HK23');
ok(!$('#casaSec') && !$('#pendSec'), 'la página pública no trae la sección del dueño');
ok(!/ACOMPAÑAS|Eres el juez|Eres el examinador/.test(P.d.documentElement.outerHTML), 'la página no trae instrucciones ni la prueba');

// correr un agente
tile(P, 'AnsiedadAncla').click(); await wait(80);
ok($('#runner').classList.contains('on') && $('#rName').textContent === 'AnsiedadAncla', 'se abre el panel del agente');
$('#rIn').value = 'tengo el pecho apretado'; $('#rGo').click(); await wait(80);
const c1 = calls.find((c) => c.ruta === 'centro-correr');
ok(anon.n === 1 && P.w.localStorage.getItem('centro-sesion') === 'c1.tok-1', 'la sesión de El Centro se abre al primer uso y se recuerda');
ok(c1 && c1.init.headers.authorization === 'Bearer c1.tok-1', 'correr manda la sesión');
ok(c1 && /^c\d+$/.test(c1.body.agente) && c1.body.mensajes.length === 1 && c1.body.mensajes[0].content === 'tengo el pecho apretado', 'correr manda solo agente y mensajes');
ok(/Respira conmigo/.test($('#rLog').textContent), 'la respuesta aparece en el panel');
ok($('#plan').textContent === 'Te quedan 4 usos gratis', 'plan tras usar: ' + $('#plan').textContent);
$('#rIn').value = 'y ahora?'; $('#rGo').click(); await wait(80);
const c2 = calls.filter((c) => c.ruta === 'centro-correr')[1];
ok(c2 && c2.body.mensajes.length === 3 && c2.body.mensajes[1].role === 'assistant' && c2.body.mensajes[1].firma === 'f1', 'la conversación sigue (3 turnos) y devuelve la firma de cada respuesta');
ok(anon.n === 1, 'no abre otra sesión');

// sesión que el servidor ya no reconoce: se renueva sola y reintenta una vez
const PX = montar(ESTADO, { expira: 'centro-correr' });
await wait(200);
tile(PX, 'AnsiedadAncla').click(); await wait(60);
PX.$('#rIn').value = 'hola'; PX.$('#rGo').click(); await wait(120);
const cx = PX.calls.filter((c) => c.ruta === 'centro-correr');
ok(PX.anon.n === 2 && cx.length === 2 && cx[1].init.headers.authorization === 'Bearer c1.tok-2' && /Respira/.test(PX.$('#rLog').textContent), 'sesión vencida: pide otra y reintenta sin que la persona haga nada');

// sin cuota → se abre el pase
P.w.eval('0'); // noop
const P2 = montar(ESTADO, { H: { 'centro-correr': () => ({ status: 402, body: { ok: false, code: 'sin_cuota', error: 'Se acabaron tus 5 usos gratis.' } }) } });
await wait(200);
tile(P2, 'AnsiedadAncla').click(); await wait(60);
P2.$('#rIn').value = 'hola'; P2.$('#rGo').click(); await wait(80);
ok(!P2.$('#pase').hidden, 'sin usos → se abre la ventana del pase');
ok(P2.$('#pWhy').textContent === 'Se acabaron tus 5 usos gratis.', 'dice por qué');
ok(!P2.$('#pBuy').hidden && P2.$('#pBuy').href === process.env.CENTRO_PASE_URL && P2.$('#pBuy').target === '_top', 'botón de compra a la tienda Shopify (sale del iframe)');
ok(/US\$9/.test(P2.$('#pBuy').textContent), 'muestra el precio: ' + P2.$('#pBuy').textContent);
ok(P2.$('#rIn').value === 'hola', 'el mensaje no se pierde');
// activar pase
P2.$('#pPed').value = ''; P2.$('#pForm').dispatchEvent(new P2.w.Event('submit', { cancelable: true })); await wait(20);
ok(/número de pedido/.test(P2.$('#pMsg').textContent), 'pide el número de pedido');
P2.$('#pPed').value = '#1001'; P2.$('#pMail').value = 'Compra@Mail.com';
P2.$('#pForm').dispatchEvent(new P2.w.Event('submit', { cancelable: true })); await wait(80);
const cp = P2.calls.find((c) => c.ruta === 'centro-pase');
ok(cp && cp.body.pedido === '1001' && cp.body.email === 'Compra@Mail.com' && /^Bearer c1\.tok-\d$/.test(cp.init.headers.authorization), 'activación manda pedido, correo y sesión');
ok(/Pase activo hasta el/.test(P2.$('#pMsg').textContent), 'confirma: ' + P2.$('#pMsg').textContent);
ok(P2.$('#plan').textContent === 'Pase activo · 300 usos este mes', 'plan: ' + P2.$('#plan').textContent);
P2.$('#pX').click();
ok(P2.$('#pase').hidden, 'la ventana se cierra');

// pase rechazado
const P3 = montar(ESTADO, { H: { 'centro-pase': () => ({ status: 200, body: { ok: false, error: 'Ese pedido está cancelado.' } }) } });
await wait(200);
P3.$('#paseBtn').click(); await wait(50);
ok(!P3.$('#pase').hidden && P3.$('#pWhy').hidden, 'botón "Pase" abre la ventana sin motivo');
P3.$('#pPed').value = '1002'; P3.$('#pMail').value = 'a@b.cl';
P3.$('#pForm').dispatchEvent(new P3.w.Event('submit', { cancelable: true })); await wait(80);
ok(P3.$('#pMsg').textContent === 'Ese pedido está cancelado.' && /bad/.test(P3.$('#pMsg').className), 'muestra el rechazo del servidor');

// app con puerta
tile(P, 'LeadHunter').click(); await wait(80);
ok($('#runner').classList.contains('door') && !$('#rDoor').hidden, 'LeadHunter abre como app');
ok($('#rDoorGo').href === 'https://hk23universe.vercel.app/leadhunter', 'la puerta lleva a su app: ' + $('#rDoorGo').href);
ok(!calls.some((c) => c.ruta === 'centro-correr' && c.body.agente === ESTADO.agentes.find((a) => a.n === 'LeadHunter').k), 'la app no gasta el motor');
$('#rX').click();

// postular: pasa
function llenar(Q) { Q.$('#fn').value = 'Cierra Tratos'; Q.$('#fc').value = 'Ventas'; Q.$('#fq').value = 'Te ayuda a cerrar ventas por WhatsApp'; Q.$('#fa').value = '@maria'; }
llenar(P); $('#sub').click(); await wait(10);
ok($('#sub').textContent === 'Cancelar prueba', 'mientras corre la prueba se puede cancelar');
await wait(80);
const cpo = calls.find((c) => c.ruta === 'centro-postular');
ok(cpo && cpo.body.nombre === 'Cierra Tratos' && cpo.body.por === '@maria' && ['caza', 'hace', 'acom'].includes(cpo.body.forma) && cpo.init.headers.authorization, 'postular manda la ficha con sesión');
ok(/pasó la prueba/.test($('#msg').textContent), 'aprobado: ' + $('#msg').textContent);
ok($('#sub').textContent === 'Postular', 'el botón vuelve');

// postular: no pasa, con ayuda
const ay = ESTADO.agentes.find((a) => a.k === 'c5');
const P4 = montar(ESTADO, { H: { 'centro-postular': () => ({ status: 200, body: { ok: true, aprobado: false, bloqueado: false, ayuda: { k: ay.k, n: ay.n, q: ay.q, mensaje: 'Ayúdame a afinar mi agente' } } }) } });
await wait(200); llenar(P4); P4.$('#sub').click(); await wait(100);
ok(/No pasó/.test(P4.$('#msg').textContent) && !P4.$('#examOut').hidden, 'no pasó: se muestra el resultado');
ok(P4.$('#examOut .who').textContent === ay.n, 'recomienda a ' + ay.n);
P4.$('#examOut button').click(); await wait(100);
ok(P4.$('#rName').textContent === ay.n && P4.$('#rIn').value === 'Ayúdame a afinar mi agente', 'el agente de la casa abre con el mensaje listo');

// postular: bloqueado
const P5 = montar(ESTADO, { H: { 'centro-postular': () => ({ status: 200, body: { ok: true, aprobado: false, bloqueado: true, ayuda: null } }) } });
await wait(200); llenar(P5); P5.$('#sub').click(); await wait(100);
ok(/no puede entrar/.test(P5.$('#examOut').textContent) && !P5.$('#examOut button'), 'dañino: sin ayuda');

// postular: cancelar
const P6 = montar(ESTADO, { H: { 'centro-postular': () => ({ status: 200, ms: 400, body: { ok: true, aprobado: true, mundo: 'Ventas' } }) } });
await wait(200); llenar(P6); P6.$('#sub').click(); await wait(20); P6.$('#sub').click(); await wait(450);
ok(/cancelada/.test(P6.$('#msg').textContent) && P6.$('#sub').textContent === 'Postular', 'cancelar la prueba: ' + P6.$('#msg').textContent);

// tarjeta descargable
$('#go').click(); await wait(50);
$('#dl').click(); await wait(80);
ok(P.downloads.length === 1 && /-elcentro\.png$/.test(P.downloads[0]), 'descarga la tarjeta: ' + P.downloads[0]);

// motor apagado y ola llena
const P7 = montar(Object.assign({}, ESTADO, { conectado: false }));
await wait(200);
ok(/Motor apagado/.test(P7.$('#pillT').textContent) && P7.$('#sub').disabled, 'sin conexión: motor apagado y postular cerrado');
const lleno = Object.assign({}, ESTADO, { agentes: ESTADO.agentes.concat(Array.from({ length: 99 }, (_, i) => ({ k: 'u' + (100 + i), n: 'X' + i, c: 'Ventas', f: 'hace', q: 'x', s: '', por: '@x', app: null, sello: false }))), ola: { tam: 100, total: 1000, libres: 0 } });
const P8 = montar(lleno); await wait(250);
ok(P8.$('#sub').disabled && /se llenó/.test(P8.$('#msg').textContent), 'ola llena: ' + P8.$('#msg').textContent);

for (const Q of [P, PX, P2, P3, P4, P5, P6, P7, P8]) if (Q.errors.length) { ok(false, 'errores: ' + Q.errors.join(' / ')); break; }
ok([P, PX, P2, P3, P4, P5, P6, P7, P8].every((Q) => !Q.errors.length), 'sin errores de script');
process.exit();
