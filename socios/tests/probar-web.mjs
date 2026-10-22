// Prueba de la página pública socios.html con jsdom y Supabase simulado.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { JSDOM, VirtualConsole } = require('jsdom');
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const HTML = fs.readFileSync(process.env.REPO + '/socios.html', 'utf8');

const PRODUCTOS = [
  { clave: 'agentes-pixel', nombre: 'Ecosistema de agentes Pixel', marca: 'Pixel', categoria: 'AGENTES IA', descripcion: 'Agentes que publican.', precio: '', url: null, canal: 'directo', costo_pct: 15, estado: 'proximamente', color: '#AAFF00' },
  { clave: 'tienda-hk23-studio', nombre: 'Tienda HK23 STUDIO', marca: 'Proof of Work', categoria: 'ARTE', descripcion: 'Posters.', precio: 'desde US$3', url: 'https://fcqevq-jr.myshopify.com', canal: 'shopify', costo_pct: 62, estado: 'disponible', color: '#FF3A1F' },
  { clave: 'guia', nombre: '<img src=x onerror="window.__xss=1">', marca: 'Guía', categoria: 'GUÍA', descripcion: '', precio: 'US$9', url: 'https://hk23hub.gumroad.com/l/guia', canal: 'directo', costo_pct: 15, estado: 'disponible', color: 'red;background:url(x)' },
];
const BASE = { ahora: new Date().toISOString(), etapa: 1, cupos: 20, fundadores: 0, interesados: 3, mostrar_desde: 10,
  comision_fundador: 49, comision_normal: 10, descuento: 10, tienda: 'https://fcqevq-jr.myshopify.com', productos: PRODUCTOS, ranking: null, totales: null };
const futuro = (ms) => new Date(Date.now() + ms).toISOString();

function montar({ estados, rpcs = {}, url = 'https://hk23universe.vercel.app/socios' }) {
  const calls = [], errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(String(e.message)));
  let nEstado = 0;
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url,
    beforeParse(w) {
      w.fetch = (u, init = {}) => {
        const fn = String(u).replace(/^.*\/rest\/v1\/rpc\//, '');
        const body = init.body ? JSON.parse(init.body) : null;
        calls.push({ url: String(u), fn, body, headers: init.headers });
        let r;
        if (fn === 'socios_estado') {
          const e = estados[Math.min(nEstado++, estados.length - 1)];
          r = e === 'caida' ? { status: 503, body: { message: 'down' } } : { status: 200, body: e };
        } else if (rpcs[fn]) r = rpcs[fn](body);
        else r = { status: 404, body: { message: 'no' } };
        return new Promise((res) => setTimeout(() => res(new Response(JSON.stringify(r.body), { status: r.status })), 5));
      };
    },
  });
  return { dom, w: dom.window, d: dom.window.document, calls, errors };
}
const txt = (d, id) => d.getElementById(id).textContent;

// ---------- 1. antes de abrir: lista de espera ----------
{
  const { w, d, calls, errors } = montar({ estados: [{ ...BASE, abierto: false, abre: futuro(3 * 86400e3 + 5000) }],
    rpcs: { socios_anotar: () => ({ status: 200, body: { ok: true } }) } });
  await wait(60);
  const c0 = calls[0];
  ok(c0 && c0.fn === 'socios_estado' && c0.url.startsWith('https://iiqhhglgjsbnuihythko.supabase.co/rest/v1/rpc/'), 'carga el estado desde Supabase');
  ok(c0.headers.apikey.startsWith('sb_publishable_') && !JSON.stringify(c0.headers).includes('service'), 'usa solo la clave pública');
  ok(txt(d, 'estadoChipTxt') === 'Próximamente' && /hora de Chile/.test(txt(d, 'estadoFecha')), 'muestra la fecha de apertura en hora de Chile: ' + txt(d, 'estadoFecha'));
  ok(!d.getElementById('cuenta').hidden && txt(d, 'cD') === '3', 'cuenta regresiva visible (3 días)');
  ok(!/anotadas/.test(txt(d, 'cifras')), 'con 3 interesados (menos de 10) no se muestra el contador');
  ok(!d.getElementById('heroPct').hidden && txt(d, 'heroPctNum') === '49%' && txt(d, 'pctFundador') === '49%',
    'el 49% de fundador se destaca en el inicio y en la comparación');
  ok(/de la ganancia/.test(txt(d, 'fundLede')) && /casi a medias/.test(txt(d, 'fundLede')) && /20 cupos/.test(txt(d, 'fundLede')),
    'explica que es 49% de la ganancia, casi a medias, y que por eso hay 20 cupos');
  const partes = [...d.querySelectorAll('#productos .parte b')].map((b) => b.textContent);
  ok(partes[0] === '~42%' && partes[1] === '~15%', 'cada producto muestra la parte real: Pixel ~42% (costo 15%), tienda ~15% (costo 62% y 10% de descuento) → ' + partes.join(', '));
  ok(/de lo que paga el cliente/.test(d.querySelector('#productos .parte').textContent), 'la parte se explica: de lo que paga el cliente');
  ok(d.getElementById('fAlias').closest('[data-modo]').hidden && txt(d, 'enviar') === 'Anotarme', 'formulario en modo lista de espera');
  const cards = d.querySelectorAll('#productos .producto');
  ok(cards.length === 3, 'pinta los 3 productos del catálogo');
  ok(cards[0].tagName === 'ARTICLE' && /Próximamente/.test(cards[0].textContent) && /Precio al lanzar/.test(cards[0].textContent),
    'producto próximamente: sin link, con «Próximamente» y «Precio al lanzar»');
  ok(cards[1].tagName === 'A' && cards[1].href === 'https://fcqevq-jr.myshopify.com/' && cards[1].rel.includes('noopener'), 'producto disponible: link seguro a la tienda');
  ok(!d.querySelector('#productos img') && w.__xss === undefined && cards[2].textContent.includes('<img'), 'nombres con HTML se muestran como texto (sin XSS)');
  ok(!cards[2].querySelector('.bloque').getAttribute('style').includes('url('), 'un color inválido no entra al estilo');
  ok(!d.querySelector('#rankCuerpo table') && /etapa 2/.test(txt(d, 'rankLede')), 'etapa 1: sin tabla de ranking ni números de muestra');
  ok(d.getElementById('panel').hidden, 'sin llave no hay panel');

  d.getElementById('fNombre').value = 'Ana Pérez';
  d.getElementById('fEmail').value = 'ana@';
  d.getElementById('form').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await wait(30);
  ok(!d.getElementById('formError').hidden && calls.length === 1, 'correo inválido: error y no envía');
  d.getElementById('fEmail').value = ' Ana@Mail.com ';
  d.getElementById('fWhatsapp').value = '+56 9 1111 2222';
  d.getElementById('form').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await wait(40);
  const an = calls.find((c) => c.fn === 'socios_anotar');
  ok(an && an.body.p_email === 'ana@mail.com' && an.body.p_nombre === 'Ana Pérez' && an.body.p_whatsapp === '+56 9 1111 2222', 'se anota con correo normalizado');
  ok(d.getElementById('form').hidden && !d.getElementById('listo').hidden && /Estás en la lista/.test(txt(d, 'listoTitulo')), 'confirma que quedó en la lista');
  ok(errors.length === 0, 'sin errores de JS ' + errors.join(' | '));
}

// ---------- 2. trampa para bots ----------
{
  const { w, d, calls } = montar({ estados: [{ ...BASE, abierto: false, abre: futuro(86400e3) }] });
  await wait(40);
  d.getElementById('fNombre').value = 'Bot'; d.getElementById('fEmail').value = 'bot@x.com'; d.getElementById('fWeb').value = 'spam';
  d.getElementById('form').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await wait(30);
  ok(calls.length === 1 && !d.getElementById('listo').hidden, 'si el campo trampa viene lleno, no envía nada');
}

// ---------- 3. abierto: postulación ----------
{
  const { w, d, calls } = montar({ estados: [{ ...BASE, abierto: true, abre: futuro(-1000), fundadores: 5, interesados: 42 }],
    rpcs: { socios_postular: (b) => b.p_email === 'ya@x.com' ? { status: 400, body: { message: 'socios: ya_postulaste' } } : { status: 200, body: { ok: true } } } });
  await wait(60);
  ok(txt(d, 'estadoChipTxt') === 'Postulaciones abiertas' && txt(d, 'estadoFecha') === 'Quedan 15 de 20.', 'abierto: quedan 15 de 20 cupos');
  ok(/42/.test(txt(d, 'cifras')) && /anotadas/.test(txt(d, 'cifras')), 'con 42 interesados se muestra el contador real');
  ok(!d.getElementById('fAlias').closest('[data-modo]').hidden && txt(d, 'enviar') === 'Enviar postulación', 'formulario completo de postulación');
  ok(d.querySelectorAll('#fIntereses input').length === 3, 'checkboxes de productos desde el catálogo');
  const set = (id, v) => { d.getElementById(id).value = v; };
  set('fNombre', 'Bruno Díaz'); set('fEmail', 'bruno@x.com'); set('fAlias', 'Bruno'); set('fCanal', 'Comunidad de golf en Instagram');
  d.querySelectorAll('#fIntereses input')[1].checked = true;
  d.getElementById('form').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await wait(30);
  ok(/aceptar/.test(txt(d, 'formError')) && !calls.some((c) => c.fn === 'socios_postular'), 'sin aceptar la publicación de datos no envía');
  d.getElementById('fConsiente').checked = true;
  set('fEmail', 'ya@x.com');
  d.getElementById('form').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await wait(40);
  ok(/ya tiene una postulación/.test(txt(d, 'formError')) && !d.getElementById('form').hidden, 'error del servidor traducido: ya postulaste');
  set('fEmail', 'bruno@x.com');
  d.getElementById('form').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await wait(40);
  const po = calls.filter((c) => c.fn === 'socios_postular').pop();
  ok(po.body.p_consiente === true && po.body.p_alias === 'Bruno' && JSON.stringify(po.body.p_intereses) === '["tienda-hk23-studio"]' && po.body.p_red === null,
    'postula con alias, intereses marcados y consentimiento');
  ok(/Recibimos tu postulación/.test(txt(d, 'listoTitulo')), 'confirma la postulación');
}

// ---------- 4. etapa 2: ranking real ----------
{
  const ranking = [{ alias: 'Carla', fundador: 3, ventas: 4, monto: 1250.5 }, { alias: '<b>Hack</b>', fundador: null, ventas: 1, monto: 20 }];
  const { d } = montar({ estados: [{ ...BASE, abierto: true, abre: futuro(-1e6), etapa: 2, fundadores: 20, ranking,
    totales: { socios: 2, ventas: 5, monto: 1270.5, comisiones: 200 } }] });
  await wait(60);
  const filas = d.querySelectorAll('#rankCuerpo tbody tr');
  ok(filas.length === 2 && /Carla/.test(filas[0].textContent) && /Fundador #3/.test(filas[0].textContent) && /1\.250,5/.test(filas[0].textContent),
    'etapa 2: tabla con alias, sello de fundador y monto');
  ok(!d.querySelector('#rankCuerpo b') && filas[1].textContent.includes('<b>Hack</b>'), 'alias con HTML se muestra como texto');
  ok(/2 freelancers · 5 ventas/.test(txt(d, 'rankLede')) && !/200/.test(txt(d, 'rankLede')), 'totales reales sin publicar comisiones');
  ok(txt(d, 'formTitulo') === 'Postula al programa.', 'cupos completos: se postula a la etapa 2');
}

// ---------- 5. panel privado ----------
{
  const LL = 'a'.repeat(32);
  const panel = { alias: 'Ana P.', nombre: 'Ana Pérez', codigo: 'HK23-ANAP', fundador: 1, comision: 20, descuento: 10, tienda: 'https://fcqevq-jr.myshopify.com',
    ventas: [{ fecha: '2026-11-02T15:00:00Z', origen: 'shopify', detalle: '#1001', producto: null, monto: 40, comision: 8, estado: 'valida' }],
    totales: { ventas: 1, monto: 40, comision: 8 } };
  const { d, calls } = montar({ url: 'https://hk23universe.vercel.app/socios?llave=' + LL,
    estados: [{ ...BASE, abierto: true, abre: futuro(-1e6) }], rpcs: { socios_mi_panel: () => ({ status: 200, body: panel }) } });
  await wait(80);
  const pc = calls.find((c) => c.fn === 'socios_mi_panel');
  ok(pc && pc.body.p_llave === LL, 'con ?llave= pide el panel privado');
  ok(!d.getElementById('panel').hidden && txt(d, 'panelCodigo') === 'HK23-ANAP' && /Fundador #1/.test(txt(d, 'panelOjo')), 'panel visible con código y número de fundador');
  const codes = [...d.querySelectorAll('#panelLinks code')].map((c) => c.textContent);
  ok(codes.includes('https://fcqevq-jr.myshopify.com/discount/HK23-ANAP?redirect=/'), 'link de la tienda: aplica el código de descuento');
  ok(codes.includes('https://hk23hub.gumroad.com/l/guia?ref=HK23-ANAP'), 'link de otro producto: lleva ?ref= con el código');
  ok(codes.length === 2, 'solo productos disponibles tienen link');
  ok(d.querySelectorAll('#panelVentas tbody tr').length === 1 && /US\$8/.test(txt(d, 'panelVentas')), 'lista de ventas con comisión');
  ok(d.querySelector('meta[name=referrer]').content === 'no-referrer', 'la llave no se filtra por el Referer');
}
{
  const { calls } = montar({ url: 'https://hk23universe.vercel.app/socios?llave=no-valida', estados: [{ ...BASE, abierto: true, abre: futuro(-1e6) }] });
  await wait(60);
  ok(!calls.some((c) => c.fn === 'socios_mi_panel'), 'llave con formato inválido: ni siquiera se consulta');
}

// ---------- 6. sin conexión ----------
{
  const { d } = montar({ estados: ['caida'] });
  await wait(60);
  ok(!d.getElementById('estadoError').hidden && txt(d, 'estadoChipTxt') === 'Sin conexión', 'si Supabase no responde, lo dice');
}

// ---------- 7. la cuenta llega a cero y abre sola ----------
{
  const ahora = new Date().toISOString();
  const { d, calls } = montar({ estados: [{ ...BASE, ahora, abierto: false, abre: futuro(1200) }, { ...BASE, ahora, abierto: true, abre: futuro(-10) }] });
  await wait(2600);
  ok(calls.filter((c) => c.fn === 'socios_estado').length === 2 && txt(d, 'enviar') === 'Enviar postulación',
    'al llegar la hora, recarga el estado y abre la postulación sin recargar la página');
}
{
  // el reloj del visitante va 1 hora adelantado: la cuenta usa la hora del servidor
  // servidor: falta 1 hora para abrir · reloj del visitante: ya sería la hora
  const { d, calls } = montar({ estados: [{ ...BASE, ahora: new Date(Date.now() - 3600e3).toISOString(), abierto: false, abre: futuro(0) }] });
  await wait(1200);
  const hm = txt(d, 'cH') + ':' + txt(d, 'cM');
  ok((hm === '00:59' || hm === '01:00') && calls.filter((c) => c.fn === 'socios_estado').length === 1,
    'la cuenta regresiva usa la hora del servidor, no la del visitante (' + hm + ')');
}

// ---------- 8. catálogo de lanzamiento: LeadHunter, DuckCam y la tienda ----------
const LANZAMIENTO = [
  { clave: 'leadhunter', nombre: 'LeadHunter', marca: 'LeadHunter', categoria: 'AGENTE IA · VENTAS', descripcion: 'Agente que consigue clientes.', precio: 'US$97',
    url: 'https://hk23universe.vercel.app/leadhunter', canal: 'directo', costo_pct: 15, estado: 'disponible', color: '#AAFF00', moneda: 'USD', descuenta: true, precio_lista: 97 },
  { clave: 'duckcam', nombre: 'DuckCam', marca: 'DuckCam', categoria: 'CÁMARA DE AUTO', descripcion: 'Un pato que graba.', precio: '$49.990 CLP · preventa',
    url: 'https://hk23universe.vercel.app/duckcam', canal: 'directo', costo_pct: 95, estado: 'disponible', color: '#FFD200', moneda: 'CLP', descuenta: false, precio_lista: 49990 },
  { clave: 'tienda-hk23-studio', nombre: 'Tienda HK23 STUDIO', marca: 'Proof of Work', categoria: 'ARTE', descripcion: 'Posters.', precio: 'desde US$3',
    url: 'https://fcqevq-jr.myshopify.com', canal: 'shopify', costo_pct: 62, estado: 'disponible', color: '#FF3A1F', moneda: 'USD', descuenta: true, precio_lista: null },
];
{
  const { d, errors } = montar({ estados: [{ ...BASE, productos: LANZAMIENTO, abierto: false, abre: futuro(86400e3) }] });
  await wait(60);
  ok(/Partimos con LeadHunter, DuckCam y Tienda HK23 STUDIO\./.test(txt(d, 'heroLede')), 'el inicio nombra los 3 productos de lanzamiento: ' + txt(d, 'heroLede'));
  const partes = [...d.querySelectorAll('#productos .parte')].map((p) => p.textContent);
  ok(/^US\$35/.test(partes[0]) && /~41%/.test(partes[0]) && /por venta como fundador/.test(partes[0]),
    'LeadHunter: US$35 por venta para el fundador (US$97 − 10%, costo 15%, 49% de la ganancia) → ' + partes[0]);
  ok(/^\$1\.200/.test(partes[1]) && /~2%/.test(partes[1]), 'DuckCam: $1.200 por venta (49% de la ganancia con costo 95%), redondeado hacia abajo → ' + partes[1]);
  ok(/^~15%/.test(partes[2]), 'la tienda, sin precio único, muestra solo el %: ' + partes[2]);
  const cards = d.querySelectorAll('#productos .producto');
  ok(cards[0].tagName === 'A' && cards[1].tagName === 'A' && cards[1].href === 'https://hk23universe.vercel.app/duckcam', 'DuckCam: la tarjeta lleva a su página /duckcam');
  ok(/En LeadHunter y Tienda HK23 STUDIO, tu código además le da 10% de descuento/.test(txt(d, 'pasoCompartes')),
    'explica en qué productos el código da descuento: ' + txt(d, 'pasoCompartes'));
  ok(/DuckCam/.test(d.getElementById('preguntas').textContent) && /7 días/.test(d.getElementById('preguntas').textContent),
    'las preguntas explican cuándo se paga una preventa y la garantía de LeadHunter');
  ok(errors.length === 0, 'sin errores de JS ' + errors.join(' | '));
}
{
  const LL = 'b'.repeat(32);
  const productos = LANZAMIENTO;
  const panel = { alias: 'Ana P.', nombre: 'Ana Pérez', codigo: 'HK23ANAP', fundador: 1, comision: 49, descuento: 10, tienda: 'https://fcqevq-jr.myshopify.com',
    ventas: [{ fecha: '2026-11-02T15:00:00Z', origen: 'manual', detalle: 'Pato Corbata', producto: 'DuckCam', monto: 52.07, comision: 5.1, estado: 'valida', moneda: 'CLP', original: 49990 }],
    totales: { ventas: 1, monto: 52.07, comision: 5.1 } };
  const { d } = montar({ url: 'https://hk23universe.vercel.app/socios?llave=' + LL,
    estados: [{ ...BASE, productos, abierto: true, abre: futuro(-1e6) }], rpcs: { socios_mi_panel: () => ({ status: 200, body: panel }) } });
  await wait(80);
  ok(/En LeadHunter y Tienda HK23 STUDIO, tu código le da 10% de descuento/.test(txt(d, 'panelLede')), 'el panel dice dónde descuenta su código');
  const filas = [...d.querySelectorAll('#panelLinks .link-fila')].map((f) => f.textContent);
  ok(filas[0].includes('https://hk23universe.vercel.app/leadhunter?ref=HK23ANAP') && /se aplica solo al pagar/.test(filas[0]),
    'LeadHunter: link con ?ref= que la página lleva a Gumroad');
  ok(filas[1].includes('https://hk23universe.vercel.app/duckcam?ref=HK23ANAP') && /mándanos el nombre de tu comprador/.test(filas[1]),
    'DuckCam: link con ?ref= y aviso de reportar al comprador');
  ok(filas[2].includes('/discount/HK23ANAP?redirect=/'), 'tienda: link que aplica el código');
  ok(/US\$52,07 · \$49\.990/.test(txt(d, 'panelVentas')), 'la venta en pesos se ve en US$ y en sus pesos originales');
}

// ---------- 9. la landing de LeadHunter lleva el código del socio a Gumroad ----------
const LH = fs.readFileSync(process.env.REPO + '/leadhunter/index.html', 'utf8');
const landing = (url) => new JSDOM(LH, { runScripts: 'dangerously', url }).window.document;
{
  let d = landing('https://hk23universe.vercel.app/leadhunter?ref=hk23anap');
  let hrefs = [...d.querySelectorAll('a.cta')].map((a) => a.href);
  ok(hrefs.length === 2 && hrefs.every((h) => h === 'https://hk23hub.gumroad.com/l/leadhunter/HK23ANAP'), 'con ?ref= los 2 botones de compra llevan el código a Gumroad');
  ok(/CÓDIGO HK23ANAP APLICADO/.test(d.querySelector('.under-cta').textContent), 'avisa que el código se aplica al pagar');
  d = landing('https://hk23universe.vercel.app/leadhunter?ref=%3Cscript%3E');
  hrefs = [...d.querySelectorAll('a.cta')].map((a) => a.href);
  ok(hrefs.every((h) => h === 'https://hk23hub.gumroad.com/l/leadhunter'), 'un ref con formato raro no toca los links');
  d = landing('https://hk23universe.vercel.app/leadhunter');
  ok([...d.querySelectorAll('a.cta')].every((a) => a.href === 'https://hk23hub.gumroad.com/l/leadhunter'), 'sin ref, la compra queda igual que siempre');
}
// ---------- 10. la página de DuckCam ----------
const DC = fs.readFileSync(process.env.REPO + '/duckcam/index.html', 'utf8');
const pato = (url) => new JSDOM(DC, { runScripts: 'dangerously', url }).window.document;
{
  let d = pato('https://hk23universe.vercel.app/duckcam?ref=hk23anap');
  const pagos = [...d.querySelectorAll('a.js-mp')].map((a) => a.href);
  ok(JSON.stringify(pagos) === JSON.stringify(['https://mpago.la/2T4NuSp', 'https://mpago.la/2AXwVwo']), 'los botones de compra van a los links reales de Mercado Pago (Corbata y Negro)');
  const socio = d.getElementById('socio');
  ok(!socio.hidden && socio.textContent.includes('HK23ANAP') && /dinos este código/.test(socio.textContent), 'con ?ref= muestra el código del socio junto al pago');
  const imgs = [...d.querySelectorAll('img')].map((i) => i.getAttribute('src'));
  ok(imgs.length === 11 && imgs.every((s) => s.startsWith('/duckcam/img/')), 'las 11 imágenes usan rutas absolutas (/duckcam sin barra final no las rompe)');
  ok(imgs.every((s) => fs.existsSync(process.env.REPO + s)), 'todas las imágenes existen en el repo');
  ok(d.documentElement.lang === 'es' && /DuckCam/.test(d.title) && d.querySelector('meta[property="og:image"]'), 'tiene idioma, título y vista previa para compartir');
  ok(d.querySelector('footer a[href="/socios"]'), 'el pie invita al programa de socios');
  d = pato('https://hk23universe.vercel.app/duckcam?ref=%3Cimg%20src%3Dx%3E');
  ok(d.getElementById('socio').hidden && !d.querySelector('#socio img'), 'un ref con formato raro no se muestra');
  d = pato('https://hk23universe.vercel.app/duckcam');
  ok(d.getElementById('socio').hidden, 'sin ref no aparece el aviso del socio');
}
process.exit(process.exitCode ?? 0);
