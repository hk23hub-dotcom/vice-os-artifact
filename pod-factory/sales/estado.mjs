// estado.mjs — mueve un lead de estado a mano. Es el único lugar donde se
// registra que algo SÍ se envió, y lo hace el dueño, no el agente.
//   node estado.mjs <id|email|empresa> <nuevo|encolado|contactado|respondió|descartado> ["nota"]
import { PATHS, readJSON, norm, today, ESTADOS } from './lib.mjs';
import { guardar } from './normalize.mjs';

const [, , query, estado, nota] = process.argv;

if (!query || !estado) {
  console.log('uso: node estado.mjs <id|email|empresa> <' + ESTADOS.join('|') + '> ["nota"]');
  process.exit(1);
}
if (!ESTADOS.includes(estado)) {
  console.error(`estado inválido: ${estado}\nválidos: ${ESTADOS.join(', ')}`);
  process.exit(1);
}

const store = readJSON(PATHS.leads, null);
if (!store) { console.error('No hay data/leads.json. Corre node normalize.mjs'); process.exit(1); }

const q = norm(query);
const hits = Object.values(store.leads).filter(l =>
  norm(l.id) === q || norm(l.email) === q || norm(l.empresa) === q ||
  norm(`${l.id} ${l.email} ${l.empresa} ${l.nombre}`).includes(q));

if (!hits.length) { console.error(`sin coincidencias para "${query}"`); process.exit(1); }
if (hits.length > 1) {
  console.error(`"${query}" es ambiguo:`);
  for (const h of hits) console.error(`  ${h.id}  ${h.empresa || h.nombre}`);
  process.exit(1);
}

const l = hits[0];
const antes = l.estado;
l.estado = estado;
l.historial = [...(l.historial || []), { fecha: today(), evento: estado, nota: nota || null }];
guardar(store);
console.log(`${l.empresa || l.nombre} [${l.id}]: ${antes} → ${estado}`);
