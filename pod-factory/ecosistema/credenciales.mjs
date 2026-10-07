/**
 * CREDENCIALES · POD FACTORY
 * Una sola definición de qué llaves necesita el sistema, dónde vive cada una
 * y cómo saber si está puesta. Nadie más adivina: ni el parte ni el panel.
 *
 * El valor NUNCA se devuelve ni se imprime. Solo se informa si está o no.
 */
import { readFileSync, writeFileSync, existsSync, chmodSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const VICE = '/Users/hk23neo/vice-os-artifact/vice-seller/config.local.json';
const STOREKIT = '/Users/hk23neo/vice-os-artifact/pod-factory/storekit/config.local.json';

export const CREDENCIALES = {
  printifyToken: {
    label: 'Token de Printify',
    archivo: VICE, clave: 'printifyToken', requerida: true,
    donde: 'https://printify.com/app/account/api',
    porque: 'Sin esto la fábrica no puede crear ni publicar productos.',
  },
  printifyShopId: {
    label: 'ID de tienda en Printify',
    archivo: VICE, clave: 'printifyShopId', requerida: true,
    donde: 'https://printify.com/app/store',
    porque: 'Identifica a qué tienda van los productos.',
  },
  shopifyAdminToken: {
    label: 'Token de Admin API de Shopify',
    archivo: STOREKIT, clave: 'token', requerida: false,
    donde: 'https://admin.shopify.com/store/fcqevq-jr/settings/apps/development',
    porque: 'Deja que storekit aplique diseño y políticas solo, y que Caja lea las órdenes reales.',
  },
  supabaseServiceKey: {
    label: 'Service key de Supabase',
    archivo: VICE, clave: 'supabaseServiceKey', requerida: false,
    donde: 'Panel de Supabase → Project settings → API',
    porque: 'Solo sirve para escribir al universo VICE OS. La tienda no la necesita.',
  },
};

function leer(archivo){
  if (!existsSync(archivo)) return {};
  try { return JSON.parse(readFileSync(archivo, 'utf8')); } catch { return {}; }
}
const valido = v => typeof v === 'string' ? v.trim().length > 0
               : typeof v === 'number' ? true
               : false;

/** Estado de cada credencial. Nunca incluye el valor. */
export function estado(){
  const out = {};
  for (const [id, c] of Object.entries(CREDENCIALES)){
    const v = leer(c.archivo)[c.clave];
    out[id] = { id, label:c.label, requerida:c.requerida, donde:c.donde, porque:c.porque,
                presente: valido(v), largo: valido(v) ? String(v).length : 0,
                archivo: c.archivo.replace('/Users/hk23neo', '~') };
  }
  return out;
}

/** Las que faltan y hacen falta de verdad. */
export const faltantes = (incluirOpcionales = false) =>
  Object.values(estado()).filter(c => !c.presente && (c.requerida || incluirOpcionales));

/** Guarda una credencial. Devuelve solo si quedó guardada, nunca el valor. */
export function guardar(id, valor){
  const c = CREDENCIALES[id];
  if (!c) return { ok:false, error:'credencial desconocida' };
  if (typeof valor !== 'string' || !valor.trim()) return { ok:false, error:'valor vacío' };
  const limpio = valor.trim();
  const data = leer(c.archivo);
  data[c.clave] = limpio;
  mkdirSync(dirname(c.archivo), { recursive: true });
  writeFileSync(c.archivo, JSON.stringify(data, null, 2) + '\n');
  try { chmodSync(c.archivo, 0o600); } catch {}
  return { ok:true, label:c.label, largo: limpio.length, archivo: c.archivo.replace('/Users/hk23neo','~') };
}
