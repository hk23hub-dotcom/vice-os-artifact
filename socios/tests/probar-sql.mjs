// Prueba de la migración 0013_socios con PGlite (Postgres real en memoria).
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
const TOKEN = 'clave-del-dueno-con-mas-de-24-caracteres';
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;`);
const base = readFileSync(process.env.REPO + '/supabase/migrations/0013_socios.sql', 'utf8');

await db.exec(base);
ok(true, 'la migración corre completa');
const h0 = (await db.query(`select value from socios_config where key='admin_token_sha256'`)).rows[0].value;
ok(h0 === 'unset', 'sin reemplazar el marcador, el panel queda cerrado');
await db.exec(base.replace(`'__SET_ADMIN_TOKEN__'`, `'${TOKEN}'`));
ok(true, 'es idempotente: se puede correr dos veces');
const h1 = (await db.query(`select value from socios_config where key='admin_token_sha256'`)).rows[0].value;
ok(/^[0-9a-f]{64}$/.test(h1), 'con la clave reemplazada se guarda solo su sha256');
await db.exec(base);
ok((await db.query(`select value from socios_config where key='admin_token_sha256'`)).rows[0].value === h1,
  'volver a correr con el marcador conserva la clave existente');
ok((await db.query(`select count(*)::int n from socios_productos`)).rows[0].n === 9, 'catálogo: 9 productos sin duplicar');
const visibles = (await db.query(`select clave from socios_productos where estado <> 'oculto' order by orden, id`)).rows.map((x) => x.clave);
ok(JSON.stringify(visibles) === JSON.stringify(['leadhunter', 'duckcam', 'tienda-hk23-studio']),
  'catálogo de lanzamiento: LeadHunter, DuckCam y la tienda, en ese orden; el resto oculto');

// una base con el catálogo anterior (antes de monedas y del lanzamiento) se pone al día al volver a correr el archivo
await db.exec(`
  alter table socios_ventas drop column moneda, drop column original;
  alter table socios_productos drop column moneda, drop column descuenta, drop column precio_lista;
  delete from socios_productos where clave in ('leadhunter', 'duckcam');
  update socios_productos set estado = 'proximamente' where clave <> 'tienda-hk23-studio';
  update socios_productos set orden = 20 where clave = 'tienda-hk23-studio';
  delete from socios_config where key in ('catalogo_lanzamiento', 'clp_por_usd');`);
await db.exec(base);
const puesta = (await db.query(`select clave, estado, moneda, descuenta, precio_lista from socios_productos where estado <> 'oculto' order by orden, id`)).rows;
ok(JSON.stringify(puesta.map((x) => x.clave)) === JSON.stringify(['leadhunter', 'duckcam', 'tienda-hk23-studio'])
  && puesta[1].moneda === 'CLP' && puesta[2].descuenta === true && Number(puesta[0].precio_lista) === 97,
  'una base con el catálogo anterior queda con los 3 productos, sus monedas y el descuento de la tienda');
ok((await db.query(`select value from socios_config where key = 'clp_por_usd'`)).rows[0].value === '960', 'tipo de cambio inicial: 960 pesos por US$');
await db.exec(`update socios_productos set estado = 'proximamente' where clave = 'el-centro'; update socios_productos set costo_pct = 20 where clave = 'leadhunter'`);
await db.exec(base);
const pisado = (await db.query(`select string_agg(clave || ':' || estado || ':' || costo_pct::int, ',' order by clave) c from socios_productos where clave in ('el-centro', 'leadhunter')`)).rows[0].c;
ok(pisado === 'el-centro:proximamente:15,leadhunter:disponible:20', 'volver a correr el archivo no pisa el catálogo que editó el dueño');
await db.exec(`update socios_productos set estado = 'oculto' where clave = 'el-centro'; update socios_productos set costo_pct = 15 where clave = 'leadhunter'`);

// helpers: llamar como anon (lo que hace el navegador) o como service_role (edge function)
async function como(rol, sql, params = []) {
  await db.exec(`set role ${rol}`);
  try { return await db.query(sql, params); } finally { await db.exec(`reset role`); }
}
async function err(rol, sql, params = []) {
  try { await como(rol, sql, params); return null; } catch (e) { return String(e.message); }
}
const estado = async () => (await como('anon', `select socios_estado() r`)).rows[0].r;
const admin = async (accion, datos = {}, tok = TOKEN) =>
  (await como('anon', `select socios_admin($1,$2,$3::jsonb) r`, [tok, accion, JSON.stringify(datos)])).rows[0].r;
const postular = (o) => como('anon',
  `select socios_postular(p_nombre=>$1, p_email=>$2, p_alias=>$3, p_canal=>$4, p_whatsapp=>$5, p_pais=>$6, p_red=>$7, p_intereses=>$8, p_consiente=>$9) r`,
  [o.nombre, o.email, o.alias, o.canal, o.whatsapp ?? null, o.pais ?? null, o.red ?? null, o.intereses ?? [], o.consiente ?? true]);

// ---------- seguridad ----------
const rls = (await db.query(`select relname, relrowsecurity from pg_class where relname like 'socios%' and relkind='r' order by 1`)).rows;
ok(rls.length === 5 && rls.every((r) => r.relrowsecurity), 'las 5 tablas tienen RLS');
ok((await db.query(`select count(*)::int n from pg_policies where tablename like 'socios%'`)).rows[0].n === 0, 'sin políticas');
ok(/permission denied/i.test(await err('anon', `select * from socios`) || ''), 'anon no puede leer la tabla socios');
ok(/permission denied/i.test(await err('anon', `insert into socios_ventas (socio_id, origen, referencia, monto, comision_pct) values (1,'manual','x',1,1)`) || ''),
  'anon no puede escribir ventas');
const priv = (await db.query(`select p.proname, has_function_privilege('anon', p.oid, 'execute') a,
  has_function_privilege('service_role', p.oid, 'execute') s from pg_proc p where proname like 'socios%' order by 1`)).rows;
const abiertas = priv.filter((r) => r.a).map((r) => r.proname).sort();
ok(JSON.stringify(abiertas) === JSON.stringify(['socios_admin', 'socios_anotar', 'socios_estado', 'socios_mi_panel', 'socios_postular']),
  'anon solo ejecuta las 5 puertas públicas: ' + abiertas.join(', '));
ok(priv.find((r) => r.proname === 'socios_registrar_shopify').s && !priv.find((r) => r.proname === 'socios_registrar_shopify').a,
  'registrar_shopify: solo service_role');

// ---------- antes de abrir ----------
let e = await estado();
ok(e.abierto === false && e.etapa === 1 && e.ranking === null && e.totales === null, 'antes de abrir: cerrado, etapa 1, sin ranking');
ok(e.productos.length === 3 && e.productos.every((p) => p.estado === 'disponible'), 'estado trae los 3 productos visibles, sin los ocultos');
const [lh, dc, td] = e.productos;
ok(lh.descuenta === true && lh.moneda === 'USD' && Number(lh.precio_lista) === 97 && lh.url === 'https://hk23universe.vercel.app/leadhunter',
  'LeadHunter: US$97 en Gumroad, el código descuenta');
ok(dc.descuenta === false && dc.moneda === 'CLP' && Number(dc.precio_lista) === 49990 && dc.url === null && Number(dc.costo_pct) === 80,
  'DuckCam: $49.990 CLP, sin código, costo supuesto 80 % y sin link hasta que el dueño lo ponga');
ok(td.descuenta === true && td.canal === 'shopify', 'en la tienda el código siempre descuenta');
ok(!JSON.stringify(e).includes('@'), 'el estado público no trae correos');
await como('anon', `select socios_anotar('Ana Pérez','  ANA@Mail.com ','+56 9 1111 2222') r`);
await como('anon', `select socios_anotar('Ana Pérez','ana@mail.com',null) r`);
ok((await db.query(`select count(*)::int n, min(email) e from socios`)).rows[0].n === 1, 'anotarse dos veces no duplica (correo normalizado)');
ok(/correo_invalido/.test(await err('anon', `select socios_anotar('Ana','no-es-correo',null)`) || ''), 'correo inválido rechazado');
ok(/falta_nombre/.test(await err('anon', `select socios_anotar(' ','b@b.cl',null)`) || ''), 'nombre vacío rechazado');
ok(/aun_no_abre/.test(await err('anon', `select socios_postular('Ana','ana@mail.com','Ana','Vendo por LinkedIn a pymes')`) || ''),
  'postular antes de la apertura: aun_no_abre');

// ---------- apertura ----------
ok(/clave_invalida/.test(await err('anon', `select socios_admin('corta','resumen','{}')`) || ''), 'clave corta rechazada');
ok(/clave_invalida/.test(await err('anon', `select socios_admin($1,'resumen','{}')`, ['x'.repeat(40)]) || ''), 'clave equivocada rechazada');
ok(/fecha_invalida/.test(await err('anon', `select socios_admin($1,'config',$2::jsonb)`, [TOKEN, JSON.stringify({ abre: 'mañana' })]) || ''), 'fecha inválida rechazada');
await admin('config', { abre: new Date(Date.now() - 60000).toISOString(), cupos: '2' });
e = await estado();
ok(e.abierto === true && Number(e.cupos) === 2, 'el dueño abre las postulaciones y fija 2 cupos');

ok(/falta_consentimiento/.test(await err('anon', `select socios_postular('Ana','ana@mail.com','Ana','Vendo por LinkedIn a pymes', p_consiente=>false)`) || ''),
  'sin aceptar la publicación de datos no se puede postular');
ok(/falta_canal/.test(await err('anon', `select socios_postular('Ana','ana@mail.com','Ana','corto', p_consiente=>true)`) || ''), 'canal muy corto rechazado');
await postular({ nombre: 'Ana Pérez', email: 'ana@mail.com', alias: 'Ana P.', canal: 'Vendo por LinkedIn a pymes', intereses: ['leadhunter', 'agentes-pixel', 'no-existe'], pais: 'Chile' });
let ana = (await db.query(`select * from socios where email='ana@mail.com'`)).rows[0];
ok(ana.estado === 'postulado' && ana.consiente && ana.whatsapp === '+56 9 1111 2222' && JSON.stringify(ana.intereses) === '["leadhunter"]',
  'la lista pasa a postulación, conserva el WhatsApp y filtra intereses inexistentes u ocultos');
ok(/ya_postulaste/.test(await err('anon', `select socios_postular('Ana','ana@mail.com','Ana','Vendo por LinkedIn a pymes', p_consiente=>true)`) || ''),
  'postular dos veces: ya_postulaste');
await postular({ nombre: 'Bruno Díaz', email: 'bruno@mail.com', alias: 'Bruno', canal: 'Comunidad de golf en Instagram' });
await postular({ nombre: 'Carla Soto', email: 'carla@mail.com', alias: 'Carla', canal: 'Newsletter de emprendedores' });
await postular({ nombre: 'Dani Ruiz', email: 'dani@mail.com', alias: 'Dani', canal: 'Ventas B2B por WhatsApp' });

// ---------- aprobar ----------
let r = await admin('resumen');
ok(r.conteo.postulados === 4 && r.postulados.length === 4 && !('admin_token_sha256' in r.config), 'resumen: 4 postulaciones; no expone el hash de la clave');
const id = (email) => r.postulados.find((p) => p.email === email).id;
const a1 = await admin('aprobar', { id: id('ana@mail.com') });
ok(a1.codigo === 'HK23ANAP' && a1.fundador === 1 && Number(a1.comision) === 49 && /^[0-9a-f]{32}$/.test(a1.llave),
  'Ana: código HK23ANAP (solo letras y números, como exige Gumroad), fundador #1, 49%, llave de 32 hex');
ok(/no_esta_en_revision/.test(await err('anon', `select socios_admin($1,'aprobar',$2::jsonb)`, [TOKEN, JSON.stringify({ id: id('ana@mail.com') })]) || ''),
  'aprobar dos veces: no_esta_en_revision');
ok(/codigo_invalido/.test(await err('anon', `select socios_admin($1,'aprobar',$2::jsonb)`, [TOKEN, JSON.stringify({ id: id('bruno@mail.com'), codigo: 'golf-bruno' })]) || ''),
  'código con guion rechazado: Gumroad no lo acepta');
const a2 = await admin('aprobar', { id: id('bruno@mail.com'), codigo: 'golfbruno' });
ok(a2.codigo === 'GOLFBRUNO' && a2.fundador === 2, 'código propuesto por el dueño (en mayúsculas), fundador #2');
ok(/codigo_en_uso/.test(await err('anon', `select socios_admin($1,'aprobar',$2::jsonb)`, [TOKEN, JSON.stringify({ id: id('carla@mail.com'), codigo: 'HK23ANAP' })]) || ''),
  'código repetido rechazado');
const a3 = await admin('aprobar', { id: id('carla@mail.com') });
ok(a3.fundador === null && Number(a3.comision) === 10, 'sin cupos de fundador: socio normal con 10%');
await admin('rechazar', { id: id('dani@mail.com') });
e = await estado();
ok(Number(e.fundadores) === 2 && Number(e.interesados) === 3, 'estado: 2 fundadores, 3 interesados (el rechazado no cuenta)');

// ---------- ventas desde Shopify ----------
const shop = (args) => como('service_role',
  `select socios_registrar_shopify(p_evento=>$1, p_pedido=>$2, p_nombre=>$3, p_codigos=>$4, p_monto=>$5, p_reembolso_id=>$6, p_reembolso=>$7) r`,
  [args.evento, args.pedido, args.nombre ?? '', args.codigos ?? [], args.monto ?? 0, args.rid ?? null, args.reembolso ?? 0]);
ok(/permission denied/i.test(await err('anon', `select socios_registrar_shopify('pagado','1','#1',array['HK23ANAP'],10)`) || ''),
  'el navegador no puede inventar ventas');
let s1 = (await shop({ evento: 'pagado', pedido: '5001', nombre: '#1001', codigos: ['hk23anap'], monto: 40 })).rows[0].r;
ok(s1.atribuida && s1.nueva && s1.codigo === 'HK23ANAP', 'pedido con el código de Ana (minúsculas) se le atribuye');
s1 = (await shop({ evento: 'pagado', pedido: '5001', nombre: '#1001', codigos: ['HK23ANAP'], monto: 40 })).rows[0].r;
ok(s1.atribuida && !s1.nueva, 'el mismo pedido dos veces no duplica');
s1 = (await shop({ evento: 'pagado', pedido: '5002', codigos: ['BIENVENIDA10'], monto: 99 })).rows[0].r;
ok(!s1.atribuida, 'un código que no es de un socio no se registra');
await shop({ evento: 'pagado', pedido: '5003', nombre: '#1003', codigos: ['GOLFBRUNO'], monto: 100 });
await shop({ evento: 'pagado', pedido: '5004', nombre: '#1004', codigos: ['GOLFBRUNO'], monto: 20 });
await shop({ evento: 'reembolso', pedido: '5003', rid: '9001', reembolso: 30 });
await shop({ evento: 'reembolso', pedido: '5003', rid: '9001', reembolso: 30 });
ok(Number((await db.query(`select reembolsado from socios_ventas where referencia='5003'`)).rows[0].reembolsado) === 30,
  'un reembolso se aplica una sola vez');
await shop({ evento: 'reembolso', pedido: '5004', rid: '9002', reembolso: 500 });
ok((await db.query(`select estado, reembolsado from socios_ventas where referencia='5004'`)).rows[0].estado === 'anulada',
  'reembolso total anula la venta');
await shop({ evento: 'pagado', pedido: '5005', codigos: ['HK23CARLA'], monto: 15 });
await shop({ evento: 'cancelado', pedido: '5005' });
ok((await db.query(`select estado from socios_ventas where referencia='5005'`)).rows[0].estado === 'anulada', 'pedido cancelado anula la venta');
ok(/pedido_invalido/.test(await err('service_role', `select socios_registrar_shopify('pagado','abc')`) || ''), 'id de pedido inválido rechazado');

// ---------- ventas manuales ----------
const socioId = (await db.query(`select id from socios where codigo='HK23CARLA'`)).rows[0].id;
const prod = (await db.query(`select id from socios_productos where clave='agentes-pixel'`)).rows[0].id;
await admin('venta', { socio_id: socioId, monto: '200', referencia: 'Transferencia 77', producto_id: prod, detalle: 'Pixel anual' });
ok(/referencia_repetida/.test(await err('anon', `select socios_admin($1,'venta',$2::jsonb)`, [TOKEN, JSON.stringify({ socio_id: socioId, monto: 5, referencia: 'Transferencia 77', producto_id: prod })]) || ''),
  'venta manual con referencia repetida rechazada');
ok(/falta_producto/.test(await err('anon', `select socios_admin($1,'venta',$2::jsonb)`, [TOKEN, JSON.stringify({ socio_id: socioId, monto: 5, referencia: 'Sin producto' })]) || ''),
  'venta manual sin producto rechazada: sin producto no se sabe el costo');
ok(/comision_sobre_mitad/.test(await err('anon', `select socios_admin($1,'venta',$2::jsonb)`, [TOKEN, JSON.stringify({ socio_id: socioId, monto: 5, referencia: 'Mitad', producto_id: prod, comision: 50 })]) || ''),
  'venta manual con comisión de 50% rechazada');
ok(/monto_invalido/.test(await err('anon', `select socios_admin($1,'venta',$2::jsonb)`, [TOKEN, JSON.stringify({ socio_id: socioId, monto: 'abc', referencia: 'x' })]) || ''),
  'monto inválido rechazado con mensaje claro');

// ---------- ranking: solo en etapa 2 ----------
e = await estado();
ok(e.ranking === null, 'etapa 1: el ranking no se publica');
await admin('config', { etapa: '2' });
e = await estado();
const rk = e.ranking;
ok(rk.length === 3 && rk[0].alias === 'Carla' && Number(rk[0].monto) === 200 && rk[0].ventas === 1,
  'etapa 2: Carla primera con US$200 (su venta de Shopify cancelada no cuenta)');
ok(rk[1].alias === 'Bruno' && Number(rk[1].monto) === 70 && rk[1].ventas === 1 && rk[1].fundador === 2,
  'Bruno: 100 − 30 reembolsado; la venta reembolsada entera no cuenta');
ok(rk[2].alias === 'Ana P.' && Number(rk[2].monto) === 40, 'Ana: US$40');
ok(Number(e.totales.monto) === 310 && Number(e.totales.ventas) === 3 && Number(e.totales.socios) === 3, 'totales: 3 socios, 3 ventas, US$310');
ok(!JSON.stringify(e).includes('@') && !JSON.stringify(e).includes(a1.llave), 'el ranking no trae correos ni llaves');

// ---------- panel privado ----------
const p = (await como('anon', `select socios_mi_panel($1) r`, [a2.llave])).rows[0].r;
ok(p.codigo === 'GOLFBRUNO' && p.fundador === 2 && p.ventas.length === 2 && Number(p.totales.monto) === 70 && Number(p.totales.comision) === 13.03,
  'panel de Bruno: US$70 netos; ganancia 70 × (1 − 62%) = 26,60; su 49% = US$13,03');
const pc = (await como('anon', `select socios_mi_panel($1) r`, [a3.llave])).rows[0].r;
ok(Number(pc.totales.comision) === 17, 'panel de Carla: venta de Pixel US$200, costo 15% → ganancia 170, su 10% = US$17');
const pa = (await como('anon', `select socios_mi_panel($1) r`, [a1.llave])).rows[0].r;
ok(Number(pa.totales.comision) === 7.45, 'panel de Ana: pedido de US$40 en la tienda → ganancia 15,20, su 49% = US$7,45');
ok(/llave_invalida/.test(await err('anon', `select socios_mi_panel($1)`, ['0'.repeat(32)]) || ''), 'llave inexistente rechazada');
ok(/llave_invalida/.test(await err('anon', `select socios_mi_panel($1)`, ["' or 1=1 --"]) || ''), 'llave con formato raro rechazada');

// ---------- los números siempre cuadran a favor de HK23 ----------
// poster real: lista US$17,63, el cliente paga 15,87 con el código; el costo (62%) se calcula sobre la lista
await shop({ evento: 'pagado', pedido: '5006', nombre: '#1006', codigos: ['HK23ANAP'], monto: 15.87 });
await db.exec('set role service_role');
await db.query(`select socios_registrar_shopify(p_evento=>'pagado', p_pedido=>'5007', p_nombre=>'#1007', p_codigos=>array['HK23ANAP'], p_monto=>15.87, p_lista=>17.63)`);
await db.exec('reset role');
const v7 = (await db.query(`select lista, costo_pct, socios__ganancia(estado,monto,reembolsado,lista,costo_pct) g,
  socios__comision(estado,monto,reembolsado,lista,costo_pct,comision_pct) c from socios_ventas where referencia='5007'`)).rows[0];
ok(Number(v7.lista) === 17.63 && Number(v7.costo_pct) === 62 && Number(v7.g) === 4.94 && Number(v7.c) === 2.42,
  'poster con descuento: ganancia 15,87 − 62% de 17,63 = 4,94; socia US$2,42; HK23 US$2,52');
const v6 = (await db.query(`select socios__comision(estado,monto,reembolsado,lista,costo_pct,comision_pct) c from socios_ventas where referencia='5006'`)).rows[0];
ok(Number(v6.c) > Number(v7.c), 'si Shopify no manda el precio de lista, se usa lo pagado (la versión con lista paga menos comisión)');
ok(/comision_sobre_mitad/.test(await err('anon', `select socios_admin($1,'config',$2::jsonb)`, [TOKEN, JSON.stringify({ comision_fundador: '50' })]) || ''),
  'comisión de fundador de 50% rechazada: HK23 siempre se queda con más de la mitad');
await admin('config', { comision_fundador: '49.99' });
ok((await db.query(`select value from socios_config where key='comision_fundador'`)).rows[0].value === '49.99', '49,99% se acepta');
await admin('config', { comision_fundador: '49' });
ok(/sin_margen/.test(await err('anon', `select socios_admin($1,'config',$2::jsonb)`, [TOKEN, JSON.stringify({ descuento: '40' })]) || ''),
  'descuento de 40% rechazado: con el costo de la tienda (62%) no queda ganancia');
const tienda = (await db.query(`select * from socios_productos where clave='tienda-hk23-studio'`)).rows[0];
ok(/sin_margen/.test(await err('anon', `select socios_admin($1,'producto',$2::jsonb)`, [TOKEN, JSON.stringify({ ...tienda, costo_pct: 95 })]) || ''),
  'costo de 95% en la tienda rechazado: con el descuento de 10% no queda ganancia');
const peor = (await db.query(`
  select max(socios__comision('valida', m, m * r, m / (1 - d), c, p) - socios__ganancia('valida', m, m * r, m / (1 - d), c) / 2) exceso,
         min(socios__ganancia('valida', m, m * r, m / (1 - d), c)) minimo, count(*)::int n
    from unnest(array[0.5, 3, 17.63, 57, 999.99]) m, unnest(array[0, 0.1, 0.3]) d, unnest(array[0, 15, 40, 62, 95]) c,
         unnest(array[0, 10, 49, 49.99]) p, unnest(array[0, 0.5, 1]) r`)).rows[0];
ok(Number(peor.exceso) <= 0.005 && Number(peor.minimo) >= 0,
  `en ${peor.n} combinaciones de precio, descuento, costo, comisión y reembolso: la ganancia nunca es negativa y el socio nunca supera la mitad`);

// ---------- productos y config ----------
const np = await admin('producto', { nombre: 'Guía de prompts', estado: 'disponible', url: 'https://hk23hub.gumroad.com/l/x', color: '#00F0FF' });
ok((await db.query(`select clave from socios_productos where id=$1`, [np.id])).rows[0].clave === 'guia-de-prompts', 'producto nuevo con clave legible');
ok(/falta_url/.test(await err('anon', `select socios_admin($1,'producto',$2::jsonb)`, [TOKEN, JSON.stringify({ nombre: 'X sin link', estado: 'disponible' })]) || ''),
  'un producto disponible exige link');
ok(/url_invalida/.test(await err('anon', `select socios_admin($1,'producto',$2::jsonb)`, [TOKEN, JSON.stringify({ nombre: 'Malo', url: 'javascript:alert(1)' })]) || ''),
  'un link que no es https se rechaza');
await admin('producto', { id: np.id, nombre: 'Guía de prompts', estado: 'oculto' });
ok(!(await estado()).productos.some((x) => x.nombre === 'Guía de prompts'), 'un producto oculto no sale en la página');
ok(/ajuste_desconocido/.test(await err('anon', `select socios_admin($1,'config',$2::jsonb)`, [TOKEN, JSON.stringify({ admin_token_sha256: 'x' })]) || ''),
  'la clave no se puede cambiar desde el panel');
ok(/porcentaje_invalido/.test(await err('anon', `select socios_admin($1,'config',$2::jsonb)`, [TOKEN, JSON.stringify({ descuento: '95' })]) || ''),
  'descuento fuera de rango rechazado');
ok(/porcentaje_invalido/.test(await err('anon', `select socios_admin($1,'config',$2::jsonb)`, [TOKEN, JSON.stringify({ comision_normal: 'diez' })]) || ''),
  'comisión que no es número rechazada');

// ---------- monedas y productos donde el código descuenta ----------
const pid = async (clave) => (await db.query(`select id from socios_productos where clave=$1`, [clave])).rows[0].id;
const anaId = (await db.query(`select id from socios where codigo='HK23ANAP'`)).rows[0].id;
const venta = async (ref) => (await db.query(`select monto, lista, moneda, original, costo_pct,
  socios__ganancia(estado,monto,reembolsado,lista,costo_pct) g, socios__comision(estado,monto,reembolsado,lista,costo_pct,comision_pct) c
  from socios_ventas where referencia=$1`, [ref])).rows[0];
await admin('venta', { socio_id: anaId, producto_id: await pid('leadhunter'), monto: '87.30', referencia: 'gumroad-001' });
let vv = await venta('gumroad-001');
ok(Number(vv.lista) === 97 && Number(vv.g) === 72.75 && Number(vv.c) === 35.65 && vv.moneda === 'USD',
  'LeadHunter con el código: pagó US$87,30, lista US$97, costo 15% de 97 → ganancia 72,75; Ana (49%) US$35,65');
await admin('venta', { socio_id: anaId, producto_id: await pid('duckcam'), monto: '49990', referencia: 'mp-001', detalle: 'Pato Corbata' });
vv = await venta('mp-001');
ok(vv.moneda === 'CLP' && Number(vv.original) === 49990 && Number(vv.monto) === 52.07 && Number(vv.lista) === 52.07,
  'DuckCam en pesos: $49.990 se guardan y se contabilizan como US$52,07 (960 por US$), sin descuento');
ok(Number(vv.g) === 10.41 && Number(vv.c) === 5.1, 'DuckCam: ganancia 52,07 × 20% = 10,41; Ana (49%) US$5,10');
await admin('venta', { socio_id: anaId, producto_id: await pid('duckcam'), monto: '52', moneda: 'usd', referencia: 'mp-002' });
ok((await venta('mp-002')).moneda === 'USD' && Number((await venta('mp-002')).monto) === 52, 'el panel puede registrar en US$ un producto que cobra en pesos');
ok(/moneda_invalida/.test(await err('anon', `select socios_admin($1,'venta',$2::jsonb)`, [TOKEN, JSON.stringify({ socio_id: anaId, producto_id: await pid('duckcam'), monto: 10, moneda: 'EUR', referencia: 'eur' })]) || ''),
  'moneda que no es US$ ni CLP rechazada');
ok(/monto_invalido/.test(await err('anon', `select socios_admin($1,'venta',$2::jsonb)`, [TOKEN, JSON.stringify({ socio_id: anaId, producto_id: await pid('duckcam'), monto: 1, referencia: 'peso' })]) || ''),
  '$1 CLP es menos de un centavo de dólar: rechazado');
const pa2 = (await como('anon', `select socios_mi_panel($1) r`, [a1.llave])).rows[0].r;
ok(pa2.ventas.some((x) => x.moneda === 'CLP' && Number(x.original) === 49990 && x.producto === 'DuckCam'), 'el panel de Ana muestra la venta de DuckCam con sus pesos');
ok(/tipo_de_cambio_invalido/.test(await err('anon', `select socios_admin($1,'config',$2::jsonb)`, [TOKEN, JSON.stringify({ clp_por_usd: '50' })]) || ''),
  'tipo de cambio absurdo rechazado');
await admin('config', { clp_por_usd: '950' });
ok((await admin('resumen')).config.clp_por_usd === '950', 'el dueño actualiza el tipo de cambio');
const lhRow = (await db.query(`select * from socios_productos where clave='leadhunter'`)).rows[0];
await admin('producto', { ...lhRow, costo_pct: 85 });
ok(/sin_margen/.test(await err('anon', `select socios_admin($1,'config',$2::jsonb)`, [TOKEN, JSON.stringify({ descuento: '20' })]) || ''),
  'descuento de 20% rechazado si LeadHunter (donde el código descuenta) cuesta 85%');
await admin('producto', { ...lhRow, costo_pct: 15 });
ok(/sin_margen/.test(await err('anon', `select socios_admin($1,'producto',$2::jsonb)`, [TOKEN, JSON.stringify({ ...lhRow, costo_pct: 95 })]) || ''),
  'LeadHunter con costo de 95%: rechazado, con el descuento no queda ganancia');
const dcRow = (await db.query(`select * from socios_productos where clave='duckcam'`)).rows[0];
ok(/falta_url/.test(await err('anon', `select socios_admin($1,'producto',$2::jsonb)`, [TOKEN, JSON.stringify(dcRow)]) || ''),
  'DuckCam no se puede guardar como disponible sin su link');
await admin('producto', { ...dcRow, url: 'https://duckcam.example/early-egg', costo_pct: 95 });
ok(Number((await db.query(`select costo_pct from socios_productos where clave='duckcam'`)).rows[0].costo_pct) === 95,
  'sin código no hay descuento: DuckCam acepta costo de 95%');
ok(/moneda_invalida/.test(await err('anon', `select socios_admin($1,'producto',$2::jsonb)`, [TOKEN, JSON.stringify({ ...dcRow, url: 'https://duckcam.example/x', moneda: 'ARS' })]) || ''),
  'moneda de producto inválida rechazada');
ok(/precio_invalido/.test(await err('anon', `select socios_admin($1,'producto',$2::jsonb)`, [TOKEN, JSON.stringify({ ...dcRow, url: 'https://duckcam.example/x', precio_lista: -5 })]) || ''),
  'precio de lista negativo rechazado');
const tdRow = (await db.query(`select * from socios_productos where clave='tienda-hk23-studio'`)).rows[0];
await admin('producto', { ...tdRow, moneda: 'CLP', descuenta: false });
const td2 = (await db.query(`select moneda, descuenta from socios_productos where clave='tienda-hk23-studio'`)).rows[0];
ok(td2.moneda === 'USD' && td2.descuenta === true, 'la tienda Shopify siempre cobra en US$ y su código siempre descuenta');

// ---------- topes por IP ----------
await db.exec(`set request.headers = '{"x-forwarded-for":"1.2.3.4, 10.0.0.1"}'`);
let corte = null;
for (let i = 0; i < 9; i++) { const m = await err('anon', `select socios_anotar('P${i}','p${i}@x.cl',null)`); if (m) { corte = { i, m }; break; } }
ok(corte && corte.i === 8 && /muchos_envios/.test(corte.m), 'la novena inscripción del día desde la misma IP se corta');
await db.exec(`set request.headers = '{"cf-connecting-ip":"5.6.7.8"}'`);
ok(!(await err('anon', `select socios_anotar('Otra','otra@x.cl',null)`)), 'otra IP sigue pudiendo');
const crudo = (await db.query(`select string_agg(clave, ',') c from socios_cuotas`)).rows[0].c;
ok(!crudo.includes('1.2.3.4'), 'las IP se guardan como hash, nunca en claro');
