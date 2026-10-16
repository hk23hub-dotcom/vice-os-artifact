// Guías interactivas HK23 — motor. Módulo ES puro: corre en el navegador (guia.html) y en Node (tests).
// Una guía = JSON con pasos (una pregunta por pantalla). La salida (spec de diseño para el Builder) se arma con
// plantillas Markdown que usan exactamente tres construcciones:
//   {{id}}            → la respuesta al paso `id` (o su valor por defecto si quedó vacío o "no sé")
//   {{id|texto}}      → igual, pero con ese texto literal como último recurso
//   [[si:id]]…[[/si]] → el bloque se omite si la respuesta a `id` quedó vacía (sin default)
// Las plantillas pagas viven en el servidor (api/_guias.js); este motor solo las renderiza.

export const TIPOS = ['text', 'textarea', 'choice', 'multi'];
export const NO_SE = /^\s*(no\s*s[eé]|n\/a|-|—)?\s*$/i;

/* ¿La respuesta cuenta como vacía? ("no sé", "-", nada) */
export function vacia(v) {
  if (Array.isArray(v)) return v.length === 0;
  return NO_SE.test(String(v == null ? '' : v));
}

/* Valor efectivo de un paso: respuesta, o default, o '' */
export function valor(paso, respuestas) {
  const r = respuestas ? respuestas[paso.id] : undefined;
  if (!vacia(r)) return Array.isArray(r) ? r.join(', ') : String(r).trim();
  return paso.default != null ? String(paso.default) : '';
}

/* Renderiza una plantilla con las respuestas. `pasos` es el array de pasos de la guía. */
export function render(plantilla, respuestas, pasos) {
  const porId = Object.fromEntries((pasos || []).map((p) => [p.id, p]));
  const val = (id) => (porId[id] ? valor(porId[id], respuestas) : '');
  let out = String(plantilla);
  // bloques condicionales (sin anidar): se quitan si la respuesta real está vacía
  out = out.replace(/\[\[si:([a-z0-9_-]+)\]\]([\s\S]*?)\[\[\/si\]\]/g, (_, id, cuerpo) => (vacia(respuestas && respuestas[id]) ? '' : cuerpo));
  out = out.replace(/\{\{([a-z0-9_-]+)(?:\|([^}]*))?\}\}/g, (_, id, fb) => val(id) || (fb != null ? fb : ''));
  return out.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/* Qué ids referencia una plantilla (para validar que existen). */
export function referencias(plantilla) {
  const ids = new Set();
  for (const m of String(plantilla).matchAll(/\{\{([a-z0-9_-]+)/g)) ids.add(m[1]);
  for (const m of String(plantilla).matchAll(/\[\[si:([a-z0-9_-]+)\]\]/g)) ids.add(m[1]);
  return [...ids];
}

/* Valida la parte pública de una guía. Devuelve la lista de errores (vacía = ok). */
export function validarGuia(g) {
  const e = [];
  if (!g || typeof g !== 'object') return ['la guía no es un objeto'];
  for (const k of ['id', 'titulo', 'lema', 'precio', 'tier', 'partes', 'pasos', 'entrega']) if (g[k] == null) e.push('falta ' + k);
  if (g.id && !/^[a-z0-9-]{3,40}$/.test(g.id)) e.push('id inválido');
  const partes = new Set((g.partes || []).map((p) => p.id));
  const ids = new Set();
  for (const p of g.pasos || []) {
    if (!p.id || !/^[a-z0-9_-]+$/.test(p.id)) e.push('paso sin id válido');
    else if (ids.has(p.id)) e.push('id repetido: ' + p.id); else ids.add(p.id);
    if (!TIPOS.includes(p.tipo)) e.push(p.id + ': tipo inválido ' + p.tipo);
    if (!p.parte || !partes.has(p.parte)) e.push(p.id + ': parte desconocida');
    if (!p.titulo) e.push(p.id + ': sin título');
    if ((p.tipo === 'choice' || p.tipo === 'multi') && !(Array.isArray(p.opciones) && p.opciones.length >= 2)) e.push(p.id + ': choice/multi sin opciones');
    if (p.ejemplo == null) e.push(p.id + ': sin ejemplo');
  }
  if (g.vista_previa) for (const id of referencias(g.vista_previa)) if (!ids.has(id)) e.push('vista_previa referencia id inexistente: ' + id);
  return e;
}

/* Valida la parte paga (plantillas) contra los pasos de la guía. */
export function validarSalida(salida, pasos) {
  const e = [];
  const ids = new Set((pasos || []).map((p) => p.id));
  if (!salida || !salida.prompt) e.push('falta prompt');
  if (!Array.isArray(salida?.archivos) || !salida.archivos.length) e.push('faltan archivos');
  const plantillas = [['prompt', salida?.prompt || ''], ...((salida?.archivos || []).map((a) => [a.nombre, a.plantilla || '']))];
  for (const [n, t] of plantillas) for (const id of referencias(t)) if (!ids.has(id)) e.push(n + ' referencia id inexistente: ' + id);
  for (const a of salida?.archivos || []) if (!/^[a-z0-9-]+\.md$/.test(a.nombre || '')) e.push('nombre de archivo inválido: ' + a.nombre);
  return e;
}

/* Arma la salida completa: prompt para el Builder + archivos descargables. */
export function armarSalida(salida, respuestas, pasos) {
  return {
    prompt: render(salida.prompt, respuestas, pasos),
    archivos: (salida.archivos || []).map((a) => ({ nombre: a.nombre, contenido: render(a.plantilla, respuestas, pasos) })),
  };
}

/* Progreso: pasos respondidos (sin contar "no sé") sobre el total. */
export function progreso(g, respuestas) {
  const total = (g.pasos || []).length;
  const hechos = (g.pasos || []).filter((p) => !vacia(respuestas && respuestas[p.id])).length;
  return { hechos, total, pct: total ? Math.round((hechos / total) * 100) : 0 };
}
