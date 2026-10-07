#!/usr/bin/env node
/**
 * DIFUSIÓN · EL CENTRO
 * 133 agentes, cada uno con una línea que responde algo que la gente busca.
 * Esa línea ya es el post: acá se convierte en pieza por plataforma.
 *
 * NO PUBLICA NADA. Escribe a ecosistema/centro/lotes/<fecha>.md y para ahí.
 *
 *   node ecosistema/centro/difusion.mjs            → 5 piezas
 *   node ecosistema/centro/difusion.mjs --n 14     → una quincena
 *   node ecosistema/centro/difusion.mjs --mundo Dinero
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const N = Math.max(1, parseInt(arg('n', '5'), 10) || 5);
const MUNDO = arg('mundo', null);
const D = new Date().toLocaleDateString('sv-SE');
const URL_CENTRO = 'https://claude.ai/artifact/4i9pCjF6rTmuyM2F6CBJJ1';

// Mismo slug que ckey() en El Centro: minúsculas, sin acentos, solo letras y dígitos.
// Así el link del post cae directo en el agente en vez del mapa entero.
const slugDe = n => String(n||'').toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const linkDe = n => `${URL_CENTRO}#${slugDe(n)}`;

const base = JSON.parse(readFileSync(join(HERE, 'agentes.json'), 'utf8'));
const HIST = join(HERE, 'historial.json');
const hist = existsSync(HIST) ? JSON.parse(readFileSync(HIST, 'utf8')) : {};

let pool = base.agentes.filter(a => !MUNDO || a.mundo.toLowerCase() === MUNDO.toLowerCase());
if (!pool.length) { console.error(`No hay agentes en el mundo "${MUNDO}".`); process.exit(1); }
// el que hace más que no sale, sale primero
pool = pool.sort((a, b) => (hist[a.nombre] || '0').localeCompare(hist[b.nombre] || '0'));
const lote = pool.slice(0, N);

// la línea del agente ya es el gancho; solo hay que rematarla según el tipo
const remate = a => a.tipo === 'hace'
  ? 'Te lo deja escrito. No te da consejos, te da la cosa hecha.'
  : 'No te resuelve el problema de un tirón. Te acompaña hasta que sales.';

const limpia = t => t.replace(/\.$/, '');
const pregunta = a => /^(Cómo|Dónde|Qué|A qué|Cuánto)/.test(a.que_hace)
  ? limpia(a.que_hace) + '?' : null;

const piezas = lote.map(a => {
  const q = pregunta(a);
  const gancho = q ? '¿' + q.charAt(0).toLowerCase() + q.slice(1) : limpia(a.que_hace) + '.';
  return {
    nombre: a.nombre, mundo: a.mundo, para: a.para, tipo: a.tipo, linea: a.que_hace,
    link: linkDe(a.nombre),

    tiktok: {
      gancho,
      guion: [
        `0-2s  «${gancho}»`,
        `2-5s  Pantalla: el nombre del agente. ${a.nombre}.`,
        q ? `5-11s «${limpia(a.que_hace)}. ${remate(a)}»`
          : `5-11s «${remate(a)}»`,
        `11-15s «Está en El Centro. Corre con tu cuenta de Claude, no pagas nada aparte.»`,
      ].join('\n'),
      caption: q ? `${gancho} ${a.nombre} hace exactamente eso. Mundo ${a.mundo}. Link en la bio.`
                 : `${a.nombre}: ${limpia(a.que_hace).toLowerCase()}. Mundo ${a.mundo}. Link en la bio.`,
      hashtags: ['#agentesIA','#claudeai','#inteligenciaartificial','#'+a.mundo.toLowerCase().replace(/[^a-z0-9]/g,''),'#elcentro'],
    },

    instagram: {
      caption: (q ? `${gancho}\n\nHay un agente que hace justo eso: ${a.nombre}.\n${limpia(a.que_hace)}.`
                  : `${a.nombre}\n\n${limpia(a.que_hace)}.`) + `\n\n${remate(a)}\nPara ${a.para || 'cualquiera'} · mundo ${a.mundo}\n\nEstá en El Centro, junto a otros 132. Link en la bio.`,
      hashtags: ['#agentesIA','#claudeai','#productividad','#'+a.mundo.toLowerCase().replace(/[^a-z0-9]/g,''),'#herramientasIA','#elcentro'],
    },

    pinterest: {
      titulo: `${limpia(a.que_hace)} — ${a.nombre}`,
      descripcion: `${remate(a)} Agente de IA del mundo ${a.mundo}, para ${a.para || 'cualquiera'}. Parte de El Centro: 133 agentes que corren con tu propia cuenta de Claude.`,
      tablero: a.mundo,
      link: linkDe(a.nombre),
    },

    x: `${gancho}\n\n${a.nombre} hace eso. Uno de 133 en El Centro.\n${linkDe(a.nombre)}`,
  };
});

lote.forEach(a => { hist[a.nombre] = D; });
writeFileSync(HIST, JSON.stringify(hist, null, 2) + '\n');

const md = `# DIFUSIÓN · EL CENTRO · ${D}

${piezas.length} pieza(s)${MUNDO ? ` del mundo **${MUNDO}**` : ''}. **Nada fue publicado.**

Cada agente responde algo que la gente ya busca. La línea del agente es el post.

${piezas.map((x, i) => `---

## ${i + 1}. ${x.nombre}
mundo **${x.mundo}** · ${x.tipo === 'hace' ? 'hace la cosa' : 'te acompaña'} · para ${x.para || 'cualquiera'}
${x.link}

> ${x.linea}

### TikTok / Reels
**Gancho:** «${x.tiktok.gancho}»
\`\`\`
${x.tiktok.guion}
\`\`\`
**Caption:** ${x.tiktok.caption}
${x.tiktok.hashtags.join(' ')}

### Instagram
${x.instagram.caption.split('\n').map(l => l ? '> ' + l : '>').join('\n')}

${x.instagram.hashtags.join(' ')}

### Pinterest
**Título:** ${x.pinterest.titulo}
**Tablero:** ${x.pinterest.tablero}
**Descripción:** ${x.pinterest.descripcion}

### X
\`\`\`
${x.x}
\`\`\`
`).join('\n')}
---

_Generado por \`ecosistema/centro/difusion.mjs\`. No publica, no envía, no programa._
`;

mkdirSync(join(HERE, 'lotes'), { recursive: true });
writeFileSync(join(HERE, 'lotes', `${D}.md`), md);

const restantes = base.agentes.length - Object.keys(hist).length;
console.log(`\nDIFUSIÓN · EL CENTRO · ${D}`);
console.log(`  ${piezas.length} piezas escritas · ${base.agentes.length} agentes en catálogo · ${restantes} sin usar todavía`);
piezas.forEach(x => console.log(`  · ${x.nombre.padEnd(20)} [${x.mundo}]`));
console.log(`\n→ ecosistema/centro/lotes/${D}.md  (nada fue publicado)\n`);
