// Prueba de punta a punta: socios-admin.html y socios.html en jsdom, hablando con la migración real (PGlite)
// a través de un PostgREST simulado. Recorre el programa completo: lista → apertura → postulación → aprobación →
// venta en Shopify → panel privado → etapa 2 con ranking.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';
const require = createRequire(import.meta.url);
const { JSDOM, VirtualConsole } = require('jsdom');
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const TOKEN = 'clave-del-dueno-con-mas-de-24-caracteres';

const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;`);
await db.exec(fs.readFileSync(process.env.REPO + '/supabase/migrations/0013_socios.sql', 'utf8').replace(`'__SET_ADMIN_TOKEN__'`, `'${TOKEN}'`));
await db.exec(`update socios_config set value = '${new Date(Date.now() + 5 * 86400e3).toISOString()}' where key = 'abre'`);

// PostgREST simulado: POST /rest/v1/rpc/<fn> con argumentos con nombre, ejecutado como anon
const PUBLICAS = ['socios_estado', 'socios_anotar', 'socios_postular', 'socios_mi_panel', 'socios_admin'];
const llamadas = [];
async function postgrest(url, init) {
  const fn = String(url).replace(/^.*\/rest\/v1\/rpc\//, '');
  const body = init.body ? JSON.parse(init.body) : {};
  llamadas.push({ fn, body });
  if (!PUBLICAS.includes(fn)) return new Response(JSON.stringify({ message: 'not found' }), { status: 404 });
  const params = [], partes = [];
  for (const [k, v] of Object.entries(body)) {
    if (!/^p_[a-z_]+$/.test(k)) return new Response(JSON.stringify({ message: 'bad arg' }), { status: 400 });
    let cast = '';
    if (Array.isArray(v)) { params.push(v); cast = '::text[]'; }
    else if (v && typeof v === 'object') { params.push(JSON.stringify(v)); cast = '::jsonb'; }
    else if (typeof v === 'boolean') { params.push(v); cast = '::boolean'; }
    else params.push(v);
    partes.push(`${k} => $${params.length}${cast}`);
  }
  await db.exec('set role anon');
  try {
    const r = await db.query(`select ${fn}(${partes.join(', ')}) as r`, params);
    return new Response(JSON.stringify(r.rows[0].r), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ code: e.code, message: e.message }), { status: 400 });
  } finally { await db.exec('reset role'); }
}

function abrir(archivo, url, extra = {}) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(String(e.message)));
  const copiado = [];
  const dom = new JSDOM(fs.readFileSync(process.env.REPO + '/' + archivo, 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url,
    beforeParse(w) {
      w.fetch = postgrest;
      Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: (t) => { copiado.push(t); return Promise.resolve(); } } });
      w.confirm = () => (extra.confirmar ?? true);
    },
  });
  return { w: dom.window, d: dom.window.document, errors, copiado, cerrar: () => dom.window.close() };
}
const submit = (w, d, id) => d.getElementById(id).dispatchEvent(new w.Event('submit', { cancelable: true }));
const click = (w, n) => n.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const btn = (scope, texto) => [...scope.querySelectorAll('button')].find((b) => b.textContent.trim() === texto);
const fila = async (sql, p = []) => (await db.query(sql, p)).rows[0];

// ---------- 1. login del panel ----------
let A = abrir('socios-admin.html', 'https://hk23universe.vercel.app/socios-admin');
await wait(30);
ok(A.d.querySelector('meta[name=robots]').content.includes('noindex') && !A.d.getElementById('login').hidden && A.d.getElementById('panel').hidden,
  'el panel pide clave y no se indexa');
ok(!llamadas.length, 'sin clave no consulta nada');
A.d.getElementById('tok').value = 'x'.repeat(30);
click(A.w, A.d.getElementById('entrar'));
await wait(80);
ok(A.d.getElementById('lmsg').textContent === 'Clave inválida.' && A.d.getElementById('panel').hidden, 'clave mala: «Clave inválida.»');
A.d.getElementById('tok').value = TOKEN;
click(A.w, A.d.getElementById('entrar'));
await wait(120);
ok(!A.d.getElementById('panel').hidden && A.d.getElementById('login').hidden, 'clave buena abre el panel');
ok(A.d.querySelectorAll('#productos tbody tr').length === 9, 'muestra los 9 productos: 3 a la venta y 6 ocultos');
ok(A.d.getElementById('cTasa').value === '960', 'el tipo de cambio para ventas en pesos aparece en «Programa»: 960');
ok(/Nadie en la lista/.test(A.d.getElementById('lista').textContent), 'lista de espera vacía');

// ---------- 2. la página pública antes de abrir ----------
let P = abrir('socios.html', 'https://hk23universe.vercel.app/socios');
await wait(120);
ok(P.d.getElementById('estadoChipTxt').textContent === 'Próximamente' && P.d.getElementById('cD').textContent === '4',
  'pública: próximamente, faltan 4 días y algo');
ok(!P.d.getElementById('heroPct').hidden && P.d.getElementById('heroPctNum').textContent === '49%' && /Casi la mitad/.test(P.d.getElementById('heroPctTxt').textContent),
  'pública: el inicio destaca 49% «casi la mitad de cada venta» desde la base');
P.d.getElementById('fNombre').value = '<img src=x onerror=alert(1)> Ana';
P.d.getElementById('fEmail').value = 'ana@mail.com';
submit(P.w, P.d, 'form');
await wait(120);
ok((await fila(`select estado from socios where email='ana@mail.com'`)).estado === 'lista', 'anotarse desde la página guarda en la lista');

// ---------- 3. el dueño abre las postulaciones ----------
click(A.w, A.d.getElementById('entrar')); // recarga
A.d.getElementById('tok').value = TOKEN;
await wait(120);
ok(A.d.querySelectorAll('#lista tbody tr').length === 1 && !A.d.querySelector('#lista img'), 'la lista aparece en el panel (nombre con HTML como texto)');
click(A.w, A.d.getElementById('copiarCorreos'));
await wait(20);
ok(A.copiado.pop() === 'ana@mail.com', 'copia los correos de la lista para avisarles');

// ¿Cuadra?: con 49% de fundador, 10% de descuento y la tienda a 62% de costo, todo cuadra a favor de HK23
const cuadra = () => [...A.d.querySelectorAll('#cuadra tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent));
let filasC = cuadra();
const tiendaC = filasC.find((r) => r[0] === 'Tienda HK23 STUDIO');
ok(filasC.length === 3 && filasC.every((r) => r[6] === 'Cuadra'), '¿Cuadra?: los 3 productos a la venta cuadran con los números actuales');
const lhC = filasC.find((r) => r[0] === 'LeadHunter'), dcC = filasC.find((r) => r[0] === 'DuckCam');
ok(lhC[1] === 'US$90' && lhC[3] === 'US$75' && lhC[4] === 'US$36,75' && lhC[5] === 'US$38,25',
  'LeadHunter por US$100: el código descuenta 10, costo 15 → ganancia 75, fundador 36,75, HK23 38,25 → ' + lhC.join(' | '));
ok(dcC[1] === 'US$100' && dcC[3] === 'US$20' && dcC[4] === 'US$9,8' && dcC[5] === 'US$10,2',
  'DuckCam por US$100: sin descuento, costo 80 → ganancia 20, fundador 9,8, HK23 10,2 → ' + dcC.join(' | '));
ok(tiendaC[1] === 'US$90' && tiendaC[3] === 'US$28' && tiendaC[4] === 'US$13,72' && tiendaC[5] === 'US$14,28',
  'tienda por US$100: cliente paga 90, ganancia 28, fundador 13,72, HK23 14,28 → ' + tiendaC.join(' | '));
A.d.getElementById('cFund').value = '50';
A.d.getElementById('cFund').dispatchEvent(new A.w.Event('input'));
ok(cuadra().every((r) => r[6] === 'No cuadra') && /menor a 50/.test(A.d.getElementById('cuadra').textContent), 'al escribir 50% se marca en rojo al tiro');
submit(A.w, A.d, 'fConfig');
await wait(150);
ok(/menor a 50/.test(A.d.getElementById('cMsg').textContent), 'guardar 50% lo rechaza la base con el motivo');
A.d.getElementById('cFund').value = '49';
A.d.getElementById('cDesc').value = '40';
A.d.getElementById('cDesc').dispatchEvent(new A.w.Event('input'));
ok(cuadra().find((r) => r[0] === 'Tienda HK23 STUDIO')[6] === 'No cuadra', 'descuento de 40% con costo de 62%: la tienda no cuadra');
A.d.getElementById('cDesc').value = '10';
A.d.getElementById('cDesc').dispatchEvent(new A.w.Event('input'));

const pasado = new Date(Date.now() - 60000);
const z = (n) => String(n).padStart(2, '0');
A.d.getElementById('cAbre').value = `${pasado.getFullYear()}-${z(pasado.getMonth() + 1)}-${z(pasado.getDate())}T${z(pasado.getHours())}:${z(pasado.getMinutes())}`;
A.d.getElementById('cCupos').value = '1';
submit(A.w, A.d, 'fConfig');
await wait(150);
ok(A.d.getElementById('cMsg').textContent === 'Guardado.', 'guarda la configuración');
const cfg = await fila(`select (select value from socios_config where key='abre') abre, (select value from socios_config where key='cupos') cupos`);
ok(Date.parse(cfg.abre) <= Date.now() && cfg.cupos === '1', 'apertura en el pasado y 1 cupo, guardados en la base');

// ---------- 4. postular desde la página ----------
P.cerrar();
P = abrir('socios.html', 'https://hk23universe.vercel.app/socios');
await wait(150);
ok(P.d.getElementById('enviar').textContent === 'Enviar postulación' && P.d.getElementById('estadoFecha').textContent === 'Quedan 1 de 1.',
  'pública: postulación abierta, queda 1 cupo');
const set = (id, v) => { P.d.getElementById(id).value = v; };
set('fNombre', 'Ana Pérez'); set('fEmail', 'ana@mail.com'); set('fAlias', 'Ana P.'); set('fCanal', 'Vendo a pymes por LinkedIn');
set('fPais', 'Chile');
P.d.querySelector('#fIntereses input[value="leadhunter"]').checked = true;
P.d.getElementById('fConsiente').checked = true;
submit(P.w, P.d, 'form');
await wait(150);
ok(/Recibimos tu postulación/.test(P.d.getElementById('listoTitulo').textContent), 'la postulación se envía desde la página');
const ana = await fila(`select * from socios where email='ana@mail.com'`);
ok(ana.estado === 'postulado' && ana.alias === 'Ana P.' && JSON.stringify(ana.intereses) === '["leadhunter"]' && ana.consiente, 'queda postulada con su consentimiento');

// ---------- 5. aprobar ----------
click(A.w, A.d.getElementById('entrar'));
await wait(150);
const tarjeta = A.d.querySelector('#postulados .it');
ok(tarjeta && /Ana Pérez/.test(tarjeta.textContent) && /Le interesa: LeadHunter/.test(tarjeta.textContent), 'la postulación aparece con sus intereses por nombre');
tarjeta.querySelector('input').value = 'ana-pixel';
click(A.w, btn(tarjeta, 'Aprobar'));
await wait(150);
ok(/sin guiones/.test(tarjeta.textContent), 'un código con guion se rechaza con el motivo (Gumroad no lo acepta)');
tarjeta.querySelector('input').value = 'anapixel';
click(A.w, btn(tarjeta, 'Aprobar'));
await wait(150);
ok(/fundador #1/.test(tarjeta.textContent) && /ANAPIXEL/.test(tarjeta.textContent), 'aprobada como fundadora #1 con el código ANAPIXEL');
await wait(1000);
const anaOk = await fila(`select * from socios where email='ana@mail.com'`);
ok(anaOk.estado === 'aprobado' && anaOk.codigo === 'ANAPIXEL' && Number(anaOk.comision) === 49, 'en la base: aprobada, código y 49%');
const bLink = btn(A.d.getElementById('socios'), 'Copiar link del panel');
click(A.w, bLink);
await wait(20);
ok(A.copiado.pop() === 'https://hk23universe.vercel.app/socios?llave=' + anaOk.llave, 'copia el link privado del panel');

// ---------- 6. una venta real por Shopify + una manual ----------
await db.exec('set role service_role');
await db.query(`select socios_registrar_shopify('pagado','5512345678901','#1001',array['anapixel'],35.5)`);
await db.exec('reset role');
click(A.w, A.d.getElementById('entrar'));
await wait(150);
A.d.getElementById('vMonto').value = '120';
A.d.getElementById('vRef').value = 'Transferencia 0042';
A.d.getElementById('vProducto').value = String((await fila(`select id from socios_productos where clave='agentes-pixel'`)).id);
submit(A.w, A.d, 'fVenta');
await wait(150);
ok(A.d.getElementById('vMsg').textContent === 'Venta registrada.', 'registra una venta manual');
await wait(300);
A.d.getElementById('vMonto').value = '5'; A.d.getElementById('vRef').value = 'Transferencia 0042';
submit(A.w, A.d, 'fVenta');
await wait(200);
ok(A.d.getElementById('vMsg').textContent === 'Esa referencia ya está registrada.', 'referencia repetida: mensaje claro');
await wait(300);
ok(A.d.querySelectorAll('#ventas tbody tr').length === 2 && /US\$155,5/.test(A.d.getElementById('cifras').textContent), 'el panel suma US$155,5 vendidos');
const filaPixel = [...A.d.querySelectorAll('#ventas tbody tr')].find((tr) => /Transferencia 0042/.test(tr.textContent));
const celdas = [...filaPixel.children].map((td) => td.textContent);
ok(celdas[4] === 'US$102' && /^US\$49,98/.test(celdas[5]) && celdas[6] === 'US$52,02',
  'venta de Pixel: ganancia US$102, socia US$49,98, HK23 US$52,02 → ' + celdas.slice(3, 7).join(' | '));

// ---------- 7. panel privado de la socia ----------
let S = abrir('socios.html', 'https://hk23universe.vercel.app/socios?llave=' + anaOk.llave);
await wait(200);
ok(!S.d.getElementById('panel').hidden && S.d.getElementById('panelCodigo').textContent === 'ANAPIXEL', 'la socia ve su panel con su código');
ok(S.d.querySelectorAll('#panelVentas tbody tr').length === 2 && /US\$56,59/.test(S.d.getElementById('panelCifras').textContent),
  've sus 2 ventas y US$56,59: 49% de la ganancia (tienda 35,5 − 62% = 13,49 → 6,61; Pixel 120 − 15% = 102 → 49,98)');
ok(/de la ganancia/.test(S.d.getElementById('panelLede').textContent), 'su panel le dice que gana sobre la ganancia');
ok([...S.d.querySelectorAll('#panelLinks code')].some((c) => c.textContent === 'https://fcqevq-jr.myshopify.com/discount/ANAPIXEL?redirect=/'),
  'tiene su link de la tienda con el código aplicado');
ok(S.d.getElementById('rankCuerpo').querySelector('table') === null, 'etapa 1: el ranking aún no se publica');

// ---------- 8. producto nuevo disponible ----------
A.d.getElementById('pNombre').value = 'Guía PROOF OF WORK';
A.d.getElementById('pEstado').value = 'disponible';
A.d.getElementById('pUrl').value = 'javascript:alert(1)';
submit(A.w, A.d, 'fProducto');
await wait(150);
ok(A.d.getElementById('pMsg').textContent === 'El link debe empezar con https://', 'rechaza links que no son https');
A.d.getElementById('pUrl').value = 'https://hk23hub.gumroad.com/l/pow';
submit(A.w, A.d, 'fProducto');
await wait(250);
ok((await fila(`select estado, clave from socios_productos where nombre='Guía PROOF OF WORK'`)).clave === 'guia-proof-of-work', 'producto nuevo guardado');
const editar = [...A.d.querySelectorAll('#productos tbody tr')].find((tr) => /Guía PROOF OF WORK/.test(tr.textContent));
click(A.w, btn(editar, 'Editar'));
ok(A.d.getElementById('pNombre').value === 'Guía PROOF OF WORK' && A.d.getElementById('pId').value !== '', 'editar carga el producto en el formulario');

// ---------- 8b. DuckCam: el dueño pone su link y registra una venta en pesos ----------
const filaProd = (nombre) => [...A.d.querySelectorAll('#productos tbody tr')].find((tr) => tr.querySelector('b').textContent === nombre);
click(A.w, btn(filaProd('LeadHunter'), 'Editar'));
ok(A.d.getElementById('pDescuenta').checked && A.d.getElementById('pMoneda').value === 'USD' && A.d.getElementById('pLista').value === '97',
  'LeadHunter en el formulario: US$, precio de lista 97 y el código descuenta');
click(A.w, btn(filaProd('DuckCam'), 'Editar'));
ok(!A.d.getElementById('pDescuenta').checked && A.d.getElementById('pMoneda').value === 'CLP' && A.d.getElementById('pLista').value === '49990',
  'DuckCam en el formulario: pesos, precio de lista 49.990 y sin código');
submit(A.w, A.d, 'fProducto');
await wait(150);
ok(A.d.getElementById('pMsg').textContent === 'Un producto disponible necesita su link.', 'DuckCam no se publica sin su link');
A.d.getElementById('pUrl').value = 'https://duckcam.example/early-egg';
submit(A.w, A.d, 'fProducto');
await wait(250);
const dc = await fila(`select url, moneda, precio_lista, descuenta, costo_pct from socios_productos where clave='duckcam'`);
ok(dc.url === 'https://duckcam.example/early-egg' && dc.moneda === 'CLP' && Number(dc.precio_lista) === 49990 && !dc.descuenta && Number(dc.costo_pct) === 80,
  'DuckCam guardado con su link, sin perder moneda, precio ni costo');
await wait(200);
const vp = A.d.getElementById('vProducto');
vp.value = String((await fila(`select id from socios_productos where clave='leadhunter'`)).id);
vp.dispatchEvent(new A.w.Event('change'));
ok(A.d.getElementById('vMonto').value === '87.3' && A.d.getElementById('vMoneda').value === 'USD', 'venta de LeadHunter: propone US$87,30 (97 con el 10% del código)');
vp.value = String((await fila(`select id from socios_productos where clave='duckcam'`)).id);
vp.dispatchEvent(new A.w.Event('change'));
ok(A.d.getElementById('vMonto').value === '49990' && A.d.getElementById('vMoneda').value === 'CLP', 'venta de DuckCam: propone $49.990 en pesos');
A.d.getElementById('vRef').value = 'MP 1234567890';
A.d.getElementById('vDetalle').value = 'Pato Corbata · reportado por Ana';
submit(A.w, A.d, 'fVenta');
await wait(250);
ok(A.d.getElementById('vMsg').textContent === 'Venta registrada.', 'registra la venta de DuckCam');
const vdc = await fila(`select moneda, original, monto from socios_ventas where referencia='MP 1234567890'`);
ok(vdc.moneda === 'CLP' && Number(vdc.original) === 49990 && Number(vdc.monto) === 52.07, 'en la base: $49.990 CLP = US$52,07 a 960');
await wait(200);
ok([...A.d.querySelectorAll('#ventas tbody tr')].some((tr) => /\$49\.990 → US\$52,07/.test(tr.textContent)), 'la tabla de ventas muestra los pesos y su conversión');
S.cerrar();
S = abrir('socios.html', 'https://hk23universe.vercel.app/socios?llave=' + anaOk.llave);
await wait(250);
const partesS = [...S.d.querySelectorAll('#productos .parte b')].map((b) => b.textContent);
ok(partesS[0] === 'US$7' && partesS[1] === '$900' && partesS[2] === '~3%',
  'pública: con el único cupo de fundador ocupado, cada producto muestra lo que gana un socio nuevo (10%) por venta → ' + partesS.join(', '));
ok([...S.d.querySelectorAll('#panelLinks code')].some((c) => c.textContent === 'https://duckcam.example/early-egg?ref=ANAPIXEL'), 'la socia ya tiene su link de DuckCam');
ok(/US\$61,69/.test(S.d.getElementById('panelCifras').textContent) && /\$49\.990/.test(S.d.getElementById('panelVentas').textContent),
  'su panel suma la venta de DuckCam: US$56,59 + 5,10 = US$61,69');

// ---------- 9. etapa 2: ranking público ----------
A.d.getElementById('cEtapa').value = '2';
const B = abrir('socios-admin.html', 'https://hk23universe.vercel.app/socios-admin', { confirmar: false });
B.d.getElementById('tok').value = TOKEN; click(B.w, B.d.getElementById('entrar'));
await wait(200);
B.d.getElementById('cEtapa').value = '2';
const antes = llamadas.length;
submit(B.w, B.d, 'fConfig');
await wait(80);
ok(llamadas.length === antes && (await fila(`select value from socios_config where key='etapa'`)).value === '1', 'si el dueño no confirma, no pasa a la etapa 2');
submit(A.w, A.d, 'fConfig');
await wait(200);
ok((await fila(`select value from socios_config where key='etapa'`)).value === '2', 'con confirmación pasa a la etapa 2');
P.cerrar();
P = abrir('socios.html', 'https://hk23universe.vercel.app/socios');
await wait(200);
const filas = P.d.querySelectorAll('#rankCuerpo tbody tr');
ok(filas.length === 1 && /Ana P\./.test(filas[0].textContent) && /Fundador #1/.test(filas[0].textContent) && /US\$207,57/.test(filas[0].textContent),
  'pública: ranking real con Ana P., fundadora #1, US$207,57 (tienda 35,5 + Pixel 120 + DuckCam 52,07)');
ok(!P.d.body.textContent.includes('ana@mail.com') && !P.d.body.textContent.includes(anaOk.llave), 'la página pública no muestra correo ni llave');
ok([A, P, S, B].every((x) => x.errors.length === 0), 'sin errores de JS ' + [A, P, S, B].flatMap((x) => x.errors).join(' | '));
process.exit(process.exitCode ?? 0);
