#!/usr/bin/env node
/** Genera el mundo visible de la fábrica con los datos reales del parte de hoy. */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, hoy, readJSON, writeOut, listDir } from './lib.mjs';

const datos = readJSON('ecosistema/mundo/datos.json');
if (!datos) { console.error('Falta ecosistema/mundo/datos.json — corré primero: node ecosistema/parte.mjs'); process.exit(1); }
datos.inboxLleno = listDir('inbox').filter(f => !f.startsWith('.')).length > 0;

const plantilla = fs.readFileSync(path.join(ROOT,'ecosistema/mundo/plantilla.html'),'utf8');
const html = plantilla.replace('/*__DATOS__*/ null', JSON.stringify(datos));
writeOut('ecosistema/mundo/fabrica.html', html);
console.log('→ ecosistema/mundo/fabrica.html · ' + hoy() + ' · tienda ' + (datos.tiendaCerrada?'CERRADA':'abierta'));
