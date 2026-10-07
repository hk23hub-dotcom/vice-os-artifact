#!/usr/bin/env node
/**
 * DIFUSIÓN · POD FACTORY
 * La fábrica produce y publica, pero nadie trae gente. Esto escribe las piezas
 * que traen gente, con la URL real de un producto que existe.
 *
 * NO PUBLICA NADA. Deja todo escrito en ecosistema/trafico/<fecha>.md
 * y para ahí. Lo aprobado sale por tu mano o por ~/hq/hq.sh execute.
 *
 * Rota: no repite el mismo producto dos días seguidos mientras queden otros.
 */
import { readJSON, writeOut, hoy } from './lib.mjs';

const D = hoy();
const N = (() => { const i = process.argv.indexOf('--n'); const v = parseInt(process.argv[i+1], 10); return Number.isFinite(v) && v > 0 ? v : 3; })();

/* ---------- productos vivos, con URL de verdad ---------- */
const mj = readJSON('midjourney/data/mj-ledger.json', {});
const pf = readJSON('data/printify-ledger.json', {});
const vivos = [
  ...Object.entries(mj).map(([sku, v]) => ({ sku, titulo: v.title, url: v.url, precio: v.price_usd?.[0], kind: v.kind })),
  ...Object.entries(pf).map(([sku, v]) => ({ sku, titulo: sku, url: v.external?.handle, precio: v.price_usd?.[0], kind: v.kind })),
].filter(p => p.url && p.titulo);

if (!vivos.length) { console.log('No hay productos con URL real. Nada que difundir.'); process.exit(0); }

/* ---------- rotación: el que hace más que no sale ---------- */
const hist = readJSON('ecosistema/trafico/historial.json', {});
vivos.sort((a, b) => (hist[a.sku] || '0') .localeCompare(hist[b.sku] || '0'));
const elegidos = vivos.slice(0, N);

/* ---------- lenguaje por colección, no una plantilla para todo ---------- */
const MUNDOS = [
  { k:/neon|synthwave|cyber|circuit/i, col:'NEON DRIVE',
    gancho:'Esto se ve mejor a oscuras.', angulo:'la pared que enciende la pieza' },
  { k:/sacred|geometry|mandala|grid/i, col:'SACRED GRID',
    gancho:'Lo colgué frente al escritorio y dejé de mirar el teléfono.', angulo:'orden visual para un espacio ruidoso' },
  { k:/creature|being|cosmic|surreal|psyched/i, col:'CREATURES',
    gancho:'La gente entra a la pieza y pregunta qué es.', angulo:'la que genera conversación' },
  { k:/golf|field|turf|clubhouse/i, col:'FIELD & TURF',
    gancho:'Para el que juega y no quiere un póster de motivación barato.', angulo:'regalo para golfista que ya tiene todo' },
  { k:/botanic|floral|bloom|folk/i, col:'WILD BLOOM',
    gancho:'Color sin gritar.', angulo:'calidez en un espacio frío' },
  { k:/mono|dark|hard|edge|brutal/i, col:'HARD EDGE',
    gancho:'Blanco y negro, pero no aburrido.', angulo:'minimalismo con carácter' },
];
const mundoDe = t => MUNDOS.find(m => m.k.test(t)) || { col:'OPEN STUDIO', gancho:'No es un póster de decoración. Es una pieza.', angulo:'arte que sostiene la pared solo' };

const nombre = t => (t.split('|')[0] || t).replace(/\bposter\b/i, '').trim();
const estilo = t => (t.split('|')[1] || '').replace(/matte wall art/i, '').trim();

/* ---------- las piezas ---------- */
const piezas = elegidos.map(p => {
  const m = mundoDe(p.titulo);
  const nm = nombre(p.titulo), es = estilo(p.titulo);
  const precio = p.precio ? `US$${p.precio}` : '';
  return {
    sku: p.sku, producto: nm, coleccion: m.col, url: p.url, precio,

    // Pinterest es buscador, no red social: el título manda y el link va en el pin
    pinterest: {
      titulo: `${nm} · lámina mate${es ? ' · ' + es : ''}`,
      descripcion: `${m.angulo}. Impresión mate de museo, papel de archivo sin brillo, enviada en tubo protector. Colección ${m.col} de HK23 STUDIO.`,
      tablero: m.col,
      link: p.url,
    },

    tiktok: {
      gancho: m.gancho,
      guion: [
        `0-2s  «${m.gancho}»`,
        `2-6s  La pieza en la pared, una sola toma fija. Sin música sobre voz.`,
        `6-10s Texto en pantalla: ${m.col} · ${precio}`,
        `10-14s «Link en la bio. Se imprime cuando lo pedís, no hay stock.»`,
      ].join('\n'),
      caption: `${m.gancho} ${nm}, colección ${m.col}. Impresión bajo demanda.`,
      hashtags: ['#wallart','#posterdesign','#artprint','#decoracion','#hk23studio', `#${m.col.toLowerCase().replace(/[^a-z]/g,'')}`],
    },

    instagram: {
      caption: `${m.gancho}\n\n${nm} — ${m.angulo}.\nPapel mate de archivo, sin brillo. Se imprime cuando lo pedís.\n\nColección ${m.col} · ${precio}\nLink en la bio.`,
      hashtags: ['#artprint','#wallart','#posterart','#interiordesign','#decoracioninterior','#laminas','#arteparaparedes','#hk23studio'],
    },

    x: `${m.gancho}\n\n${nm} · ${m.col} · ${precio}\n${p.url}`,
  };
});

elegidos.forEach(p => { hist[p.sku] = D; });
writeOut('ecosistema/trafico/historial.json', JSON.stringify(hist, null, 2));

const md = `# DIFUSIÓN · ${D}

${piezas.length} pieza(s) escritas con URL real. **Nada fue publicado.**
Revisá, y lo que sirva lo publicás vos.

${piezas.map((x, i) => `---

## ${i + 1}. ${x.producto}
\`${x.sku}\` · colección **${x.coleccion}** · ${x.precio}
${x.url}

### Pinterest — el canal que más rinde para láminas
**Título:** ${x.pinterest.titulo}
**Tablero:** ${x.pinterest.tablero}
**Descripción:**
> ${x.pinterest.descripcion}

### TikTok / Reels
**Gancho:** «${x.tiktok.gancho}»
\`\`\`
${x.tiktok.guion}
\`\`\`
**Caption:** ${x.tiktok.caption}
${x.tiktok.hashtags.join(' ')}

### Instagram
${x.instagram.caption.split('\n').map(l => '> ' + l).join('\n')}

${x.instagram.hashtags.join(' ')}

### X
\`\`\`
${x.x}
\`\`\`
`).join('\n')}
---

_Escrito por \`ecosistema/trafico.mjs\`. No publica, no envía, no programa._
`;

writeOut(`ecosistema/trafico/${D}.md`, md);
writeOut(`ecosistema/trafico/${D}.json`, JSON.stringify(piezas, null, 2));

console.log(`\nDIFUSIÓN · ${D}`);
console.log(`  ${piezas.length} piezas escritas · ${vivos.length} productos vivos en rotación`);
piezas.forEach(x => console.log(`  · ${x.producto}  [${x.coleccion}]  ${x.precio}`));
console.log(`\n→ ecosistema/trafico/${D}.md  (nada fue publicado)\n`);
