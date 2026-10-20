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
ok((await db.query(`select count(*)::int n from socios_productos`)).rows[0].n === 7, 'catálogo inicial: 7 productos sin duplicar');

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
ok(e.productos.length === 7 && e.productos.filter((p) => p.estado === 'disponible').length === 1, 'estado trae el catálogo (1 disponible)');
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
await postular({ nombre: 'Ana Pérez', email: 'ana@mail.com', alias: 'Ana P.', canal: 'Vendo por LinkedIn a pymes', intereses: ['agentes-pixel', 'no-existe'], pais: 'Chile' });
let ana = (await db.query(`select * from socios where email='ana@mail.com'`)).rows[0];
ok(ana.estado === 'postulado' && ana.consiente && ana.whatsapp === '+56 9 1111 2222' && JSON.stringify(ana.intereses) === '["agentes-pixel"]',
  'la lista pasa a postulación, conserva el WhatsApp y filtra intereses inexistentes');
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
ok(a1.codigo === 'HK23-ANAP' && a1.fundador === 1 && Number(a1.comision) === 20 && /^[0-9a-f]{32}$/.test(a1.llave),
  'Ana: código HK23-ANAP, fundador #1, 20%, llave de 32 hex');
ok(/no_esta_en_revision/.test(await err('anon', `select socios_admin($1,'aprobar',$2::jsonb)`, [TOKEN, JSON.stringify({ id: id('ana@mail.com') })]) || ''),
  'aprobar dos veces: no_esta_en_revision');
const a2 = await admin('aprobar', { id: id('bruno@mail.com'), codigo: 'golf-bruno' });
ok(a2.codigo === 'GOLF-BRUNO' && a2.fundador === 2, 'código propuesto por el dueño (en mayúsculas), fundador #2');
ok(/codigo_en_uso/.test(await err('anon', `select socios_admin($1,'aprobar',$2::jsonb)`, [TOKEN, JSON.stringify({ id: id('carla@mail.com'), codigo: 'HK23-ANAP' })]) || ''),
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
ok(/permission denied/i.test(await err('anon', `select socios_registrar_shopify('pagado','1','#1',array['HK23-ANAP'],10)`) || ''),
  'el navegador no puede inventar ventas');
let s1 = (await shop({ evento: 'pagado', pedido: '5001', nombre: '#1001', codigos: ['hk23-anap'], monto: 40 })).rows[0].r;
ok(s1.atribuida && s1.nueva && s1.codigo === 'HK23-ANAP', 'pedido con el código de Ana (minúsculas) se le atribuye');
s1 = (await shop({ evento: 'pagado', pedido: '5001', nombre: '#1001', codigos: ['HK23-ANAP'], monto: 40 })).rows[0].r;
ok(s1.atribuida && !s1.nueva, 'el mismo pedido dos veces no duplica');
s1 = (await shop({ evento: 'pagado', pedido: '5002', codigos: ['BIENVENIDA10'], monto: 99 })).rows[0].r;
ok(!s1.atribuida, 'un código que no es de un socio no se registra');
await shop({ evento: 'pagado', pedido: '5003', nombre: '#1003', codigos: ['GOLF-BRUNO'], monto: 100 });
await shop({ evento: 'pagado', pedido: '5004', nombre: '#1004', codigos: ['GOLF-BRUNO'], monto: 20 });
await shop({ evento: 'reembolso', pedido: '5003', rid: '9001', reembolso: 30 });
await shop({ evento: 'reembolso', pedido: '5003', rid: '9001', reembolso: 30 });
ok(Number((await db.query(`select reembolsado from socios_ventas where referencia='5003'`)).rows[0].reembolsado) === 30,
  'un reembolso se aplica una sola vez');
await shop({ evento: 'reembolso', pedido: '5004', rid: '9002', reembolso: 500 });
ok((await db.query(`select estado, reembolsado from socios_ventas where referencia='5004'`)).rows[0].estado === 'anulada',
  'reembolso total anula la venta');
await shop({ evento: 'pagado', pedido: '5005', codigos: ['HK23-CARLA'], monto: 15 });
await shop({ evento: 'cancelado', pedido: '5005' });
ok((await db.query(`select estado from socios_ventas where referencia='5005'`)).rows[0].estado === 'anulada', 'pedido cancelado anula la venta');
ok(/pedido_invalido/.test(await err('service_role', `select socios_registrar_shopify('pagado','abc')`) || ''), 'id de pedido inválido rechazado');

// ---------- ventas manuales ----------
const socioId = (await db.query(`select id from socios where codigo='HK23-CARLA'`)).rows[0].id;
const prod = (await db.query(`select id from socios_productos where clave='agentes-pixel'`)).rows[0].id;
await admin('venta', { socio_id: socioId, monto: '200', referencia: 'Transferencia 77', producto_id: prod, detalle: 'Pixel anual' });
ok(/referencia_repetida/.test(await err('anon', `select socios_admin($1,'venta',$2::jsonb)`, [TOKEN, JSON.stringify({ socio_id: socioId, monto: 5, referencia: 'Transferencia 77' })]) || ''),
  'venta manual con referencia repetida rechazada');
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
ok(p.codigo === 'GOLF-BRUNO' && p.fundador === 2 && p.ventas.length === 2 && Number(p.totales.monto) === 70 && Number(p.totales.comision) === 14,
  'panel de Bruno: 2 ventas, US$70 netos, US$14 de comisión');
ok(/llave_invalida/.test(await err('anon', `select socios_mi_panel($1)`, ['0'.repeat(32)]) || ''), 'llave inexistente rechazada');
ok(/llave_invalida/.test(await err('anon', `select socios_mi_panel($1)`, ["' or 1=1 --"]) || ''), 'llave con formato raro rechazada');

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
ok(/porcentaje_invalido/.test(await err('anon', `select socios_admin($1,'config',$2::jsonb)`, [TOKEN, JSON.stringify({ comision_fundador: '95' })]) || ''),
  'comisión fuera de rango rechazada');

// ---------- topes por IP ----------
await db.exec(`set request.headers = '{"x-forwarded-for":"1.2.3.4, 10.0.0.1"}'`);
let corte = null;
for (let i = 0; i < 9; i++) { const m = await err('anon', `select socios_anotar('P${i}','p${i}@x.cl',null)`); if (m) { corte = { i, m }; break; } }
ok(corte && corte.i === 8 && /muchos_envios/.test(corte.m), 'la novena inscripción del día desde la misma IP se corta');
await db.exec(`set request.headers = '{"cf-connecting-ip":"5.6.7.8"}'`);
ok(!(await err('anon', `select socios_anotar('Otra','otra@x.cl',null)`)), 'otra IP sigue pudiendo');
const crudo = (await db.query(`select string_agg(clave, ',') c from socios_cuotas`)).rows[0].c;
ok(!crudo.includes('1.2.3.4'), 'las IP se guardan como hash, nunca en claro');
