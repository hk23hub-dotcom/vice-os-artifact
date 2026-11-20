// ═══ PLANTILLA — el generador de universe-template.html ═══════════════════════════════════════
// La plantilla vendible es el universo entero sin nada del autor. Antes se hacía a mano y se
// quedaba atrás; ahora sale de aquí, siempre igual:
//
//   node scripts/plantilla.mjs                       universe-os.html → universe-template.html
//   node scripts/plantilla.mjs ENTRADA SALIDA        otras rutas
//   node scripts/plantilla.mjs --codificar "texto"   base64 para sumar un marcador a la lista negra
//
// Qué hace, en orden:
//   1. CIRUGÍA: reemplaza bloques enteros por su versión vacía y honesta (proyectos del mapa,
//      inquilinos, biblioteca, mundos del dashboard, códigos de acceso, links del cuartel, firma
//      de LAS PUERTAS, links públicos de los planetas, referido del cosmos cripto…). Se ancla en el código, no en los textos.
//   2. RED: todo pedido a Supabase va a https://TU-PROYECTO.supabase.co y las keys quedan en
//      TU-ANON-KEY; los JSON del universo pasan a uos-*.json (la plantilla no lee los del dueño).
//   3. BARRIDO: nombres, proyectos, lugares, colecciones, links de tienda y la marca → placeholders.
//      El último paso pasa la marca a UOS en todo: textos, ids, clases y el prefijo de storage
//      (hk23_ → uos_, así la plantilla y el original nunca comparten estado en el mismo aparato).
//   4. CINTA: título UNIVERSE OS — PLANTILLA y una cinta morada que se cierra con OK.
//   5. VERIFICA y, si algo falla, NO escribe: cero marcadores de la lista negra, toda clave de
//      storage empieza con uos, y cada <script> compila.
//
// La lista negra y el barrido van codificados en base64: no son secretos (están en el universo),
// es para que este archivo no repita en claro lo que barre. Sin dependencias; misma entrada,
// misma salida, byte por byte.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const d = s => Buffer.from(s, 'base64').toString('utf8');

/* ── lista negra: [categoría, RegExp en base64, flags] ── tiene que dar CERO en la plantilla ── */
const MARCADORES_B64 = [
  ['marca', 'aGsyMw==', 'i'],
  ['marca', 'aGV5b2th', 'i'],
  ['marca', 'PkhLPHwnSEsnfCJISyI=', ''],
  ['proyecto', 'XGJWSUNFXGJ8XGJWaWNlXGI=', ''],
  ['proyecto', 'VmljZUdvbGZlcnxWSUNFR09MRkVSfFZpY2UgP0dvbGZlcnxWSUNFID9HT0xGRVJ8dmljZWdvbGZlclwuY29t', ''],
  ['proyecto', 'UnVnYnlWaWNlfFJVR0JZID9WSUNFfFJ1Z2J5ID9WaWNl', ''],
  ['proyecto', 'Q1JZUFRPWyAtXT9WSUNFfENyeXB0b1sgLV0/VmljZXxjcnlwdG8tdmljZQ==', ''],
  ['lugar', 'bGEgP2lnbGVzaWE=', 'i'],
  ['lugar', 'M1suLF02NzY=', ''],
  ['lugar', 'XGJzYW50aWFnb1xifFxiY2hpbGVcYnxcYklWIFJlZ2lbb8OzXW58XGJJViBSRUdJW0/Dk11O', 'i'],
  ['lugar', 'XGJMQSBQTEFZQVxi', ''],
  ['supabase', 'cWhrbG5ndnpkbXdzYm9wYmtpZmY=', 'i'],
  ['supabase', 'aWlxaGhnbGdqc2JudWloeXRoa28=', 'i'],
  ['llave', 'ZXlKaGJHY2k=', ''],
  ['llave', 'c2JfcHVibGlzaGFibGVf', ''],
  ['código', 'U09DSU8yM3xNVkItSkN8J1RBS0VOJ1xzKjp8J09XTCdccyo6', ''],
  ['tienda', 'Z3Vtcm9hZFwuY29tXC9sXC9bQS1aYS16MC05XXxsamtva2o=', ''],
  ['nombre', 'ZmFsbG93b29k', 'i'],
  ['nombre', 'amFtZXNcV3swLDN9Y3JhaWd8XGJKQyBBUlRcYnxqYW1lcy1jcmFpZw==', 'i'],
  ['nombre', 'bWlkam91cm5leQ==', 'i'],
  ['nombre', 'amVhblsgLV0/Y2hyaXN0b3BoZXxcYmRlIEpDXGI=', 'i'],
  ['colección', 'aGFyZFsgXy1dP3RydXRocw==', 'i'],
  ['colección', 'XGJyZXdpcmVkXGI=', 'i'],
  ['inquilino', 'KD88IVsuXHddKWZyZXF1ZW5jeSg/IVx3KQ==', 'i'],
  ['proyecto', 'YXRsYXMteHxcYkFUTEFTIFhcYnxhbGJhdHJvc3xcYmd0YSA/NlxifHZpY2UtZ3RhNnxtdW5kaWFsIDIwMjZ8bXVuZGlhbFwuaHRtbHxtdWx0aXZlcnNlXC5odG1sfGNvc21vc1wuaHRtbA==', 'i'],
  ['link', 'Y2xhdWRlXC5haVwvYXJ0aWZhY3RcLw==', ''],
  ['referido', 'OTlmYzQzYzgtOTA4Mi00Njk0LTk2M2YtMTk3ZWVjODQ1MmEw', '']
];
export const MARCADORES = MARCADORES_B64.map(([cat, src, fl], i) =>
  ({ n: i + 1, cat, re: new RegExp(d(src), fl.includes('g') ? fl : fl + 'g') }));

/* ── barrido: [nota, buscar (base64), poner, flags|null] ── null = texto literal ── */
const BARRIDO_B64 = [
  ['red social', 'QGhrMjNuZW8=', '@tu-usuario', null],
  ['tienda', 'aHR0cHM6Ly9oazIzaHViLmd1bXJvYWQuY29tL2wv', 'https://TU-TIENDA.example/', null],
  ['tienda', 'aHR0cHM6Ly9oazIzaHViLmd1bXJvYWQuY29t', 'https://TU-TIENDA.example', null],
  ['tienda', 'UHJvZHVjdG8gcmVhbCBlbiB0dSBHdW1yb2FkIOKAlCB1biBjbGljIHkgZXN0w6EgZW4gZWwgY2hlY2tvdXQu', 'Reemplázame: el link de tu producto en tu tienda.', null],
  ['sitio', 'aGsyM3VuaXZlcnNlLnZlcmNlbC5hcHAvdW5pdmVyc2Utb3M=', 'TU-SITIO.example', null],
  ['sitio', 'aHR0cHM6Ly9oazIzdW5pdmVyc2UudmVyY2VsLmFwcA==', 'https://TU-SITIO.example', null],
  ['sitio', 'aGsyM3VuaXZlcnNlLnZlcmNlbC5hcHA=', 'TU-SITIO.example', null],
  ['sitio', 'aHR0cHM6Ly92aWNlZ29sZmVyLmNvbQ==', 'https://TU-SITIO.example', null],
  ['marca', 'PGRpdiBjbGFzcz0iZ2hvc3QiPkhLPHNwYW4+MjM8L3NwYW4+PC9kaXY+', '<div class="ghost">U<span>OS</span></div>', null],
  ['marca', 'PHNwYW4+SEs8L3NwYW4+PHNwYW4gY2xhc3M9InJlZCI+MjM8L3NwYW4+', '<span>U</span><span class="red">OS</span>', null],
  ['marca', 'PGRpdiBjbGFzcz0ibWFwLWxvZ28iPjxzcGFuPkhLPC9zcGFuPjIzPC9kaXY+', '<div class="map-logo"><span>U</span>OS</div>', null],
  ['marca', 'eC5maWxsVGV4dCgnSEsnLCBNRw==', 'x.fillText(\'U\', MG', null],
  ['marca', 'eC5tZWFzdXJlVGV4dCgnSEsnKQ==', 'x.measureText(\'U\')', null],
  ['marca', 'eC5maWxsVGV4dCgnMjMnLCBNRyArIGFuY2hvSEs=', 'x.fillText(\'OS\', MG + anchoHK', null],
  ['marca', 'SEVZT0tB', 'NOVA', 'g'],
  ['marca', 'SGV5b2th', 'Nova', 'g'],
  ['marca', 'aGV5b2th', 'nova', 'g'],
  ['proyecto', 'VklDRTxicj5PUw==', 'CORE<br>OS', null],
  ['proyecto', 'VklDRTxlbT5HT0xGRVI8L2VtPg==', 'GOLF<em>WORLD</em>', null],
  ['proyecto', 'UlVHQlkgPGVtPlZJQ0U8L2VtPg==', 'RUGBY <em>WORLD</em>', null],
  ['proyecto', 'VklDRSBTRUxMRVI=', 'AGENTE VENDEDOR', null],
  ['proyecto', 'Q3J5cHRvVmljZQ==', 'CryptoPlus', null],
  ['proyecto', 'VklDRSBPUw==', 'CORE OS', null],
  ['proyecto', 'VmljZSBPUw==', 'Core OS', null],
  ['proyecto', 'J1ZJQ0UnLCfCtyc=', '\'CORE\',\'·\'', null],
  ['proyecto', 'R0FMQVhJQSBWSUNF', 'GALAXIA NOVA', null],
  ['proyecto', 'VmljZUdvbGZlcg==', 'GolfWorld', null],
  ['proyecto', 'VklDRUdPTEZFUg==', 'GOLF', null],
  ['proyecto', 'UnVnYnlWaWNl', 'RugbyWorld', null],
  ['proyecto', 'UlVHQlkgVklDRQ==', 'RUGBY', null],
  ['proyecto', 'UnVnYnkgVmljZQ==', 'Rugby', null],
  ['proyecto', 'Q1JZUFRPIFZJQ0U=', 'CRYPTO', null],
  ['proyecto', 'Q3J5cHRvIFZpY2U=', 'Crypto', null],
  ['proyecto', 'J2NyeXB0by12aWNlJw==', '\'crypto\'', null],
  ['proyecto', 'LFsnZ3RhNicsJ0dUQTYnXQ==', '', null],
  ['proyecto', 'QVRMQVMgWA==', 'TU MOTOR IA', null],
  ['lugar', 'TEEgSUdMRVNJQQ==', 'PROYECTO ORO', null],
  ['lugar', 'TGEgSWdsZXNpYQ==', 'Proyecto Oro', null],
  ['lugar', 'bGFpZ2xlc2lh', 'proyectoro', null],
  ['lugar', 'SVYgUmVnacOzbg==', 'tu región', null],
  ['lugar', 'SVYgUkVHScOTTg==', 'TU REGIÓN', null],
  ['lugar', 'Myw2NzY=', 'X.XXX', null],
  ['lugar', 'TEEgUExBWUE=', 'CONCEPTO', null],
  ['nombre', 'Wy9mYWxsb3dvb2QvaSwnZmFsbG93b29kJ10=', '[/marca-x/i,\'marca-x\']', null],
  ['nombre', 'RkFMTE9XT09E', 'MARCA X', null],
  ['nombre', 'L2phbWVzfGNyYWlnfGJyYW5kIGlkZW50aXR5L2k=', '/brand identity/i', null],
  ['nombre', 'amFtZXMtY3JhaWctYXJ0', 'tu-arte', null],
  ['nombre', 'SkFNRVMgQ1JBSUcgQVJU', 'TU ARTE', null],
  ['nombre', 'SkMgQVJU', 'TU ARTE', null],
  ['nombre', 'TUlESk9VUk5FWQ==', 'AI STUDIO', null],
  ['colección', 'Q09MRUNDScOTTiBIQVJEIFRSVVRIUw==', 'COLECCIÓN PROPIA', null],
  ['colección', 'SEFSRCBUUlVUSFM=', 'COLECCIÓN PROPIA', null],
  ['colección', 'SEFSRF9UUlVUSFM=', 'COLECCION_PROPIA', null],
  ['colección', 'aGFyZC10cnV0aHM=', 'coleccion-propia', null],
  ['colección', 'Q09MRUNDScOTTiBSRVdJUkVE', 'COLECCIÓN DOS', null],
  ['colección', 'UkVXSVJFRA==', 'COLECCIÓN DOS', null],
  ['inquilino', 'U29sbyBlc3TDoSBsYSBzZW1pbGxhIEZSRVFVRU5DWS4g', 'La plantilla no trae inquilinos. ', null],
  ['inquilino', 'RlJFUVVFTkNZIFVOSVZFUlNF', 'UNIVERSO DEMO', null],
  ['inquilino', 'KD88IVsuXHddKUZSRVFVRU5DWSg/IVx3KQ==', 'RESONANCIA', 'g'],
  ['inquilino', 'KD88IVsuXHddKWZyZXF1ZW5jeSg/IVx3KQ==', 'resonancia', 'g'],
  ['inquilino', 'TVZCLUpD', 'DEMO-01', null],
  ['inquilino', 'SkVBTiBDSFJJU1RPUEhF', 'TU USUARIO', null],
  ['inquilino', 'amVhbiBjaHJpc3RvcGhl', 'tu usuario', null],
  ['marca', 'SEsyMw==', 'UOS', 'g'],
  ['marca', 'SGsyMw==', 'Uos', 'g'],
  ['marca', 'aGsyMw==', 'uos', 'g']
];
const BARRIDO = BARRIDO_B64.map(([nota, src, poner, fl]) =>
  ({ nota, buscar: fl == null ? d(src) : new RegExp(d(src), fl), poner }));

/* ── 1 · CIRUGÍA ─────────────────────────────────────────────────────────────────────────────
   min: cuántas veces tiene que estar como mínimo (0 = opcional: si otro cambio la borró, se avisa
   y se sigue; la lista negra igual atrapa lo que se escape). max: tope de seguridad. */
const PROYECTOS_PLANTILLA = `const PROJECTS = [
  // plantilla: 4 mundos con maquinaria propia (cancha, green, arte 3D, mercado) + 2 proyectos tuyos por llenar
  { id: 'rugbyvice',  label: 'RUGBY',  sub: 'mundo deportivo A', x: 0.63, y: 0.33, color: '#00F0FF', size: 22 },
  { id: 'vicegolfer', label: 'GOLF',   sub: 'mundo deportivo B', x: 0.68, y: 0.55, color: '#AAFF00', size: 22 },
  { id: 'arteworld',  label: 'ARTE',   sub: 'tus obras en 3D',   x: 0.33, y: 0.40, color: '#FF3A1F', size: 22 },
  { id: 'cryptovice', label: 'CRYPTO', sub: 'mercado y guías',   x: 0.80, y: 0.40, color: '#F7931A', size: 22 },
  { id: 'demo1', label: 'TU PROYECTO 1', sub: 'reemplázame', x: 0.42, y: 0.62, color: '#B84DFF', size: 20,
    universe: { title: 'TU PROYECTO 1', color: '#B84DFF', nodes: [] } },
  { id: 'demo2', label: 'TU PROYECTO 2', sub: 'reemplázame', x: 0.52, y: 0.24, color: '#FFD200', size: 20,
    universe: { title: 'TU PROYECTO 2', color: '#FFD200', nodes: [] } },
];`;

const MUNDOS_PLANTILLA = `const WORLDS=[
    {id:'demo-a',label:'Tu Mundo A',sub:'reemplázame',status:'idea',url:'',roadmap:'La plantilla no trae mundos del autor.',
      why:'Espacio reservado: carga aquí tus proyectos reales desde tu handoff.'},
    {id:'demo-b',label:'Tu Mundo B',sub:'reemplázame',status:'idea',url:'',roadmap:'',
      why:'Segundo espacio reservado.'}
  ];`;

const CIRUGIA = [
  { n: 'título', re: /<title>[^<]*<\/title>/, poner: '<title>UNIVERSE OS — PLANTILLA</title>', min: 1, max: 1 },
  { n: 'proyectos del mapa → 4 mundos + 2 por llenar', re: /const PROJECTS = \[[\s\S]*?\n\];/, poner: PROYECTOS_PLANTILLA, min: 1, max: 1 },
  { n: 'códigos de acceso → uno de demostración', re: /const CODES=\{[^}]*\};/,
    poner: "const CODES={ 'DEMO23':'socio' };   // plantilla: define aquí tus códigos y su nivel", min: 1, max: 1 },
  { n: 'biblioteca: las colecciones del autor fuera', re: /const ([A-Z_]+)=\[\s*\{ id:'ht-[\s\S]*?\n  \];/,
    poner: (m, v) => `const ${v}=[];   // plantilla: sin las colecciones del autor`, min: 1, max: 1 },
  { n: 'biblioteca: arranca vacía', re: /let BIB=BIB_FALLBACK;/,
    poner: 'let BIB=[];   // plantilla: la biblioteca arranca vacía (tus libros: uos-biblioteca.json)', min: 1, max: 1 },
  { n: 'biblioteca: estantes honestos', re: /divider\('▸ CANON [^']*'[\s\S]*?(\n\s*\} else if\(bibSection==='plugins'\)\{)/,
    poner: (m, cola) => "divider('▸ TU BIBLIOTECA','#00F0FF');\n" +
      "      BIB.forEach(bookCard);\n" +
      "      if(!BIB.length) card('TU BIBLIOTECA ESTÁ VACÍA', 'Esta plantilla no trae libros del autor. Carga los tuyos en uos-biblioteca.json (mismo esquema: books con id, title, tier, desc y md) y aparecen aquí, legibles página por página.', 'REEMPLÁZAME', '#FF3A1F', ()=>{}, 'VACÍA, Y LO DICE');" + cola,
    min: 1, max: 1 },
  { n: 'biblioteca: sin la tarjeta del grafo externo del autor', re: /\n[ \t]*card\('ARIA',[^\n]*/, poner: '', min: 0, max: 1 },
  { n: 'biblioteca: productos → 2 por llenar', re: /const P=\[\[[^\n]*\]\];/,
    poner: "const P=[['TU PRODUCTO 1','tu-producto-1'],['TU PRODUCTO 2','tu-producto-2']];", min: 1, max: 1 },
  { n: 'inventario: la constitución es la tuya, por cargar', re: /El libro de leyes del universo, legible en la Biblioteca\./g,
    poner: 'Tu libro de leyes: cárgalo en tu biblioteca (uos-biblioteca.json).', min: 0, max: 3 },
  { n: 'inquilinos: sin la semilla', re: /const SEED=\[[\s\S]*?\}\];/,
    poner: 'const SEED=[];   // plantilla: sin inquilinos del autor', min: 1, max: 1 },
  { n: 'ATLAS: verifica la ruta de esta página', re: /const RUTAS=\[[\s\S]*?\];/,
    poner: "const RUTAS=[ [location.pathname,'esta plantilla'] ];", min: 1, max: 1 },
  { n: 'dashboard: mundos → 2 por llenar', re: /const WORLDS=\[[\s\S]*?\n  \];/, poner: MUNDOS_PLANTILLA, min: 1, max: 1 },
  { n: 'taller: sin los repos del autor', re: /for\(const repo of \[[^\]]*\]\)/,
    poner: "for(const repo of [ /* plantilla: tus repos, ej. 'tu-usuario/tu-repo' */ ])", min: 1, max: 1 },
  { n: 'cuartel: sin links SUGERIDO a artifacts del autor', re: /var SUGERIDOS = \{[\s\S]*?\n  \};/,
    poner: 'var SUGERIDOS = {};   /* plantilla: sin links del autor */', min: 0, max: 1 },
  { n: 'LAS PUERTAS: firma pública sin publicar', re: /var FIRMA_PUBLICA = [^;]*;/, poner: 'var FIRMA_PUBLICA = null;', min: 0, max: 1 },
  { n: 'LAS PUERTAS: planetas sin página pública del autor', re: /var PLANETAS = \{[\s\S]*?\n  \};/,
    poner: m => m.replace(/publica:\s*(['"])[^'"]*\1/g, "publica:''"), min: 0, max: 1 },
  { n: 'LAS PUERTAS: el link de la llave apunta a esta página', re: /(['"])https?:\/\/[^'"]*\?llave=\1\s*\+/g,
    poner: "location.origin + location.pathname + '?llave=' +", min: 0, max: 3 },
  { n: 'láminas: el sitio es el de quien la usa', re: /var SITIO = (['"])[^'"]*\1;/,
    poner: "var SITIO = location.host ? location.host + location.pathname : 'TU-SITIO.example';", min: 0, max: 1 },
  { n: 'fondo de muestra: el neutro, nunca el video del dueño', re: /const FONDO_POR_DEFECTO = (['"])[^'"]*\1;/,
    poner: "const FONDO_POR_DEFECTO = 'https://www.youtube.com/shorts/k0cVxCm5B8k';   // plantilla: pon aquí tu video", min: 0, max: 1 },
  { n: 'planes: la tienda de la plantilla no consulta la del dueño', re: /(['"])\/api\/tier-unlock\1/g,
    poner: "$1/api/TU-TIENDA$1", min: 0, max: 10 },
  { n: 'MADRE: sin salto al universo del dueño', re: /location\.href\s*=\s*(["'])\/universe-os\1/g, poner: 'location.href=location.pathname', min: 0, max: 5 },
  { n: 'CRYPTO COSMOS: referido vacío y sin el link de futuros del dueño', re: /const CC_CONFIG = \{[\s\S]*?\n  \};/,
    poner: m => m.replace(/(referido:\s*\{\s*rollbit:\s*)(['"])[^'"]*\2/, "$1''")
                 .replace(/(futures:\s*)(['"])[^'"]*\2/, "$1''")
                 .replace(/(futuresTexto:\s*)(['"])[^'"]*\2/, "$1'FUTURES →'"), min: 1, max: 1 },
  { n: 'diseño: los tokens salen del :root de esta página', re: /universe-os\.html :root/g, poner: 'el :root de esta página', min: 0, max: 5 },
  { n: 'red: Supabase → placeholder', re: /https:\/\/[a-z0-9]{20}\.supabase\.co/g, poner: 'https://TU-PROYECTO.supabase.co', min: 1, max: 50 },
  { n: 'red: panel de Supabase sin proyecto', re: /https:\/\/supabase\.com\/dashboard\/project\/[^'"\s)]+/g, poner: 'https://supabase.com/dashboard', min: 0, max: 10 },
  { n: 'red: keys JWT → placeholder', re: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, poner: 'TU-ANON-KEY', min: 0, max: 50 },
  { n: 'red: keys publishable → placeholder', re: /sb_publishable_[A-Za-z0-9_-]+/g, poner: 'TU-ANON-KEY', min: 0, max: 50 },
  { n: 'red: los JSON del universo → uos-*.json', re: /(['"])(biblioteca|mvb-eventos|musica)\.json\1/g, poner: '$1uos-$2.json$1', min: 1, max: 10 },
  { n: 'storage: las claves del reproductor también con uos_', re: /(['"])wa_(skin|playlist|radios)\1/g, poner: '$1uos_wa_$2$1', min: 0, max: 20 },
];

/* ── 4 · CINTA ─────────────────────────────────────────────────────────────────────────────── */
const CINTA = `
<!-- ═══════════ PLANTILLA — cinta: esta copia no trae contenido del autor ═══════════
     La pone el generador de la plantilla cada vez que regenera este archivo. Se cierra con OK y queda
     cerrada en este aparato (uos_tpl_visto). Bórrala cuando cargues tu handoff. -->
<style id="tpl-style">
  #tpl-cinta{ position:fixed; left:0; right:0; top:0; z-index:698; display:flex; gap:10px; align-items:center;
    justify-content:center; flex-wrap:wrap; padding:calc(6px + env(safe-area-inset-top,0px)) 12px 6px;
    background:var(--purple,#B84DFF); color:#0a0a12; font:700 10px/1.5 var(--mono,'Space Mono',monospace);
    letter-spacing:2px; text-transform:uppercase; text-align:center; }
  #tpl-cinta[hidden]{ display:none; }
  #tpl-cinta button{ min-height:44px; min-width:44px; padding:0 14px; background:#0a0a12; color:var(--purple,#B84DFF);
    border:none; border-radius:2px; font:700 10px var(--mono,'Space Mono',monospace); letter-spacing:2px; cursor:pointer; }
  @media(max-width:600px){
    #tpl-cinta{ flex-wrap:nowrap; gap:8px; padding:calc(4px + env(safe-area-inset-top,0px)) 8px 4px; font-size:9px; letter-spacing:1px; }
    #tpl-cinta .tpl-mas{ display:none; }
  }
</style>
<div id="tpl-cinta" role="status"><span>PLANTILLA · SIN CONTENIDO DEL AUTOR<span class="tpl-mas"> — CARGA TU HANDOFF NUEVO</span></span>
  <button type="button" id="tpl-ok" aria-label="Cerrar el aviso de plantilla">OK</button></div>
<script>
(function(){
  var c = document.getElementById('tpl-cinta'); if(!c) return;
  try{ if(localStorage.getItem('uos_tpl_visto') === '1'){ c.hidden = true; return; } }catch(e){}
  document.getElementById('tpl-ok').addEventListener('click', function(){
    c.hidden = true; try{ localStorage.setItem('uos_tpl_visto', '1'); }catch(e){}
  });
})();
</script>
`;

/* ── utilidades ────────────────────────────────────────────────────────────────────────────── */
function contar(txt, buscar){
  if(typeof buscar === 'string') return buscar ? txt.split(buscar).length - 1 : 0;
  const re = new RegExp(buscar.source, buscar.flags.includes('g') ? buscar.flags : buscar.flags + 'g');
  return (txt.match(re) || []).length;
}
function lineaDe(txt, idx){ let n = 1; for(let i = 0; i < idx; i++) if(txt.charCodeAt(i) === 10) n++; return n; }

/* las claves de storage que el código usa (literal en la llamada o en su constante) */
const CLAVES_RE = new RegExp([
  String.raw`(?:localStorage|sessionStorage)\.(?:get|set|remove)Item\(\s*(['"])([^'"]+)\1`,
  String.raw`indexedDB\.open\(\s*(['"])([^'"]+)\3`,
  String.raw`\b(?:store|st)\.(?:get|set)\(\s*(['"])([^'"]+)\5`,
  String.raw`\b(?:lsGet|lsSet|leerLocal|lee|load)\(\s*(['"])([^'"]+)\7`,
  String.raw`\b(?:K|KF|KEY|[A-Z]+_KEY|DB_NOMBRE)\s*=\s*(['"])([^'"]+)\9`,
].join('|'), 'g');
export function clavesDeStorage(html){
  const out = new Map();
  for(const m of html.matchAll(CLAVES_RE)){
    const k = m[2] || m[4] || m[6] || m[8] || m[10];
    if(k) out.set(k, (out.get(k) || 0) + 1);
  }
  return out;
}
export function scriptsInline(html){
  const out = []; const re = /<script>([\s\S]*?)<\/script>/g; let m;
  while((m = re.exec(html))) out.push({ codigo: m[1], linea: lineaDe(html, m.index) });
  return out;
}

/* ── 5 · VERIFICA ─────────────────────────────────────────────────────────────────────────────
   Devuelve la lista de problemas (vacía = limpia). Nunca imprime el texto de un marcador. */
export function verificar(html){
  const prob = [];
  for(const mk of MARCADORES){
    const hits = [...html.matchAll(mk.re)];
    if(hits.length) prob.push(`marcador #${mk.n} (${mk.cat}): ${hits.length} resto(s), líneas ${[...new Set(hits.slice(0, 6).map(h => lineaDe(html, h.index)))].join(', ')}`);
  }
  for(const [k, v] of clavesDeStorage(html)) if(!/^uos/.test(k)) prob.push(`storage: la clave «${k}» (${v}×) no empieza con uos`);
  scriptsInline(html).forEach((s, i) => {
    try{ new vm.Script(s.codigo, { filename: 'script-' + (i + 1) }); }
    catch(e){ prob.push(`script ${i + 1} (línea ${s.linea}): no compila — ${e.message}`); }
  });
  if(contar(html, '<title>UNIVERSE OS — PLANTILLA</title>') !== 1) prob.push('falta el título UNIVERSE OS — PLANTILLA');
  if(contar(html, 'id="tpl-cinta"') !== 1) prob.push('falta la cinta PLANTILLA');
  return prob;
}

/* ── generar: entrada → { html, informe } (lanza si una cirugía obligatoria no encuentra su ancla) ── */
export function generar(fuente){
  let html = fuente.replace(/\r\n/g, '\n');
  const informe = [], avisos = [];
  for(const r of CIRUGIA){
    const re = r.re.global ? r.re : new RegExp(r.re.source, r.re.flags);
    const n = contar(html, re);
    if(n < r.min) throw new Error(`cirugía «${r.n}»: encontré ${n}, necesito al menos ${r.min}. El universo cambió ahí: ajusta su ancla en scripts/plantilla.mjs.`);
    if(n > r.max) throw new Error(`cirugía «${r.n}»: encontré ${n}, el tope es ${r.max}. Revisa que el ancla no esté agarrando de más.`);
    if(n === 0){ avisos.push(`cirugía «${r.n}»: no estaba (opcional, sigo)`); continue; }
    html = html.replace(re, r.poner);
    informe.push(`cirugía · ${r.n}: ${n}`);
  }
  const porNota = new Map();
  for(const b of BARRIDO){
    const n = contar(html, b.buscar);
    if(!n) continue;
    html = typeof b.buscar === 'string' ? html.split(b.buscar).join(b.poner) : html.replace(b.buscar, b.poner);
    porNota.set(b.nota, (porNota.get(b.nota) || 0) + n);
  }
  for(const [nota, n] of porNota) informe.push(`barrido · ${nota}: ${n}`);
  const cierre = html.lastIndexOf('</body>');
  if(cierre < 0) throw new Error('no encontré </body> para poner la cinta');
  html = html.slice(0, cierre) + CINTA.replace(/^\n/, '') + html.slice(cierre);
  return { html, informe, avisos };
}

/* ── CLI ───────────────────────────────────────────────────────────────────────────────────── */
function main(argv){
  if(argv[0] === '--codificar'){ console.log(Buffer.from(argv.slice(1).join(' '), 'utf8').toString('base64')); return 0; }
  const entrada = path.resolve(argv[0] || path.join(RAIZ, 'universe-os.html'));
  const salida = path.resolve(argv[1] || path.join(RAIZ, 'universe-template.html'));
  let res;
  try{ res = generar(readFileSync(entrada, 'utf8')); }
  catch(e){ console.error('✗ PLANTILLA: ' + e.message); return 1; }
  const prob = verificar(res.html);
  res.avisos.forEach(a => console.log('· ' + a));
  if(prob.length){
    console.error('✗ PLANTILLA SIN ESCRIBIR — ' + prob.length + ' problema(s):');
    prob.forEach(p => console.error('  - ' + p));
    return 1;
  }
  writeFileSync(salida, res.html);
  res.informe.forEach(l => console.log('  ' + l));
  console.log(`✓ ${path.relative(process.cwd(), salida) || salida}: ${Buffer.byteLength(res.html)} B · ${MARCADORES.length} marcadores en cero · storage solo uos · ${scriptsInline(res.html).length} scripts compilan`);
  return 0;
}
if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
