// El Centro — prueba de entrada, del lado del servidor.
// Mismos prompts que la página (vienen de _centro.js): el agente responde dos pedidos reales y uno
// trampa, y un jurado decide. Nadie ve los requisitos antes; si falla, se recomienda un agente de la casa.
import { CASA, CRIT, AYUDA, FN, rules, examGen, examJudge, ckey, clean } from './_centro.js';
import { llm, llmJSON } from './_centro-llm.js';

export async function examinar(a, vecinosComunidad) {
  const g = await llmJSON({ nivel: 'rapido', prompt: examGen(a), maxOutputTokens: 600 });
  const qs = [];
  if (g && Array.isArray(g.reales)) g.reales.slice(0, 2).forEach((x) => { const t = clean(x, 400); if (t) qs.push(t); });
  const trampa = clean(g && g.trampa, 400);
  if (qs.length < 2 || !trampa) { const e = new Error('prueba mal armada'); e.code = 'examen_invalido'; throw e; }
  qs.push(trampa);
  const outs = [];
  for (const q of qs) {
    const r = await llm({
      nivel: a.f === 'acom' ? 'rapido' : 'normal', system: rules(a),
      messages: [{ role: 'user', content: q }], maxOutputTokens: a.f === 'acom' ? 450 : 1200,
    });
    outs.push(r.texto);
  }
  const vec = CASA.concat(vecinosComunidad || [])
    .filter((x) => ckey(x.c) === ckey(a.c) && x.k !== a.k && ckey(x.n) !== ckey(a.n)).slice(0, 40);
  const j = await llmJSON({ nivel: 'normal', prompt: examJudge(a, qs, outs, vec), maxOutputTokens: 700 });
  const c = j && typeof j.criterios === 'object' && j.criterios ? j.criterios : {};
  let ok = true, falla = 'ninguna';
  CRIT.forEach((k) => { if (c[k] !== true) { ok = false; if (falla === 'ninguna') falla = k; } });
  const fp = j && j.falla_principal;
  if (!ok && c.legitimo === true && CRIT.includes(fp) && c[fp] !== true) falla = fp;
  const criterios = {}; CRIT.forEach((k) => { criterios[k] = c[k] === true; });
  return {
    aprobado: ok, falla: ok ? 'ninguna' : falla, motivo: clean(j && j.motivo, 400),
    puntaje: Math.max(0, Math.min(100, Math.round(+(j && j.puntaje) || 0))), criterios, ts: Date.now(),
  };
}

/* a quién recomendar cuando no pasa; si el agente es ilegítimo no se le ofrece ayuda */
export function ayudaPara(a, r) {
  if (r.aprobado || r.falla === 'legitimo') return null;
  const nombre = AYUDA[r.falla] || 'AgenteJusto';
  const h = CASA.find((x) => ckey(x.n) === ckey(nombre)) || CASA.find((x) => x.n === 'AgenteJusto');
  const mensaje = 'Quiero meter mi agente a El Centro y no pasó la prueba de entrada.\n' +
    'Nombre: ' + a.n + '\nMundo: ' + a.c + '\nForma: ' + FN[a.f] + '\nQué hace: ' + a.q + '\n' +
    (r.motivo ? 'Lo que dijo el jurado: ' + r.motivo + '\n' : '') +
    'Ayúdame a dejarlo listo para volver a postular: dame una nueva línea de qué hace y, si corresponde, otro nombre o mundo.';
  return { k: h.k, n: h.n, q: h.q, mensaje };
}
