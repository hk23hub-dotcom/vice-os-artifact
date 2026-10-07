#!/usr/bin/env node
/** Crea la estructura de cada agente: perfil (generado), memoria (crece) y carpeta de partes. */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, reparto, hoy } from './lib.mjs';

const R = reparto();
for (const a of R.agentes){
  const dir = path.join(ROOT, 'ecosistema/agentes', a.code);
  fs.mkdirSync(path.join(dir,'partes'), { recursive: true });

  fs.writeFileSync(path.join(dir,'perfil.md'),
`# ${a.nombre} · ${a.code}

**Puesto:** ${a.rol}
**Le responde a:** ${a.jefe}
**Recibe de:** ${a.recibe}
**Entrega a:** ${a.entrega}

## Lo que no hace nunca
${a.limite}

## De dónde saca la verdad
${a.fuentes.map(f => '- `'+f+'`').join('\n')}

---
_Perfil generado desde \`ecosistema/reparto.json\`. No editar a mano: editar el reparto._
`);

  const mem = path.join(dir,'memoria.md');
  if (!fs.existsSync(mem)) fs.writeFileSync(mem,
`# Memoria de ${a.nombre}

Lo que aprendió y no debe volver a preguntar. Crece sola con cada corrida del parte.
Una línea por hallazgo, con fecha. Nunca se borra sin que lo pida el dueño.

`);
}
console.log(`estructura lista para ${R.agentes.length} agentes · ${hoy()}`);
