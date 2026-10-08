#!/usr/bin/env python3
"""Regenera api/_centro.js desde la página fuente de El Centro (~/el-centro/centro-src.html).
El catálogo, las reglas de los agentes y los prompts de la prueba de entrada viven en la página;
el servidor usa exactamente el mismo texto. Correr después de cambiar cualquiera de esas cosas:
    python3 centro/extraer.py
"""
import os
SRC = os.path.expanduser("~/el-centro/centro-src.html")
DST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "api", "_centro.js")
src = open(SRC, encoding="utf-8").read()

def grab(a, b):
    i = src.index(a); j = src.index(b, i); return src[i:j].rstrip()

partes = dict(
    cat=grab("var CAT=[", "var FN="), forma=grab("var FORMA={", "function rules("),
    rules=grab("function rules(a){", "/* =============== treemap"), fdesc=grab("var FORMA_DESC=", "var CRIT="),
    crit=grab("var CRIT=", "var AYUDA="), ayuda=grab("var AYUDA=", "function aprobado("),
    gen=grab("function examGen(a){", "function examJudge("), judge=grab("function examJudge(a,qs,outs,vecinos){", "function runExam("),
    apps=grab("var APPS={", "var BASE=CAT.map"), ckey=grab("function ckey(", "var CANON="),
)
out = """// El Centro — catálogo, reglas y prueba de entrada, compartidos por las funciones /api/centro-*.
// GENERADO desde ~/el-centro/centro-src.html con centro/extraer.py: no editar a mano el catálogo ni los prompts,
// cambiarlos en la página fuente y volver a extraer, para que página y servidor digan lo mismo.

export const BLOQUES = [
  { id: 'agentes', nombre: 'Agentes', activo: true },
  { id: 'sistemas', nombre: 'Sistemas', activo: false },
  { id: 'oficinas', nombre: 'Oficinas', activo: false },
  { id: 'agencias', nombre: 'Agencias autónomas', activo: false },
];
export const OLA = { tam: 100, total: 1000 };
/* cuotas por plan: gratis sin reinicio; pase y creador cada 30 días */
export const PLANES = {
  gratis: { tope: 5, periodo: 0 },
  pase: { tope: 300, periodo: 30 },
  creador: { tope: 300, periodo: 30 },
};
export const FN = { caza: 'Caza', hace: 'Hace', acom: 'Acompaña' };

%(cat)s

%(apps)s

export const CASA = CAT.map(function (r, i) {
  return { k: 'c' + i, n: r[0], c: r[1], f: r[2], q: r[3], p: r[4], s: r[5], por: 'HK23', app: APPS[r[0]] || null };
});

export function clean(s, n) { return String(s == null ? '' : s).replace(/\\s+/g, ' ').trim().slice(0, n); }
%(ckey)s
const CANON = Object.create(null);
CASA.forEach(function (a) { CANON[ckey(a.c)] = a.c; });
export function canon(s) { const c = clean(s, 24); if (!c) return 'Comunidad'; return CANON[ckey(c)] || c; }

%(forma)s
%(rules)s

%(fdesc)s
%(crit)s
%(ayuda)s
%(gen)s
%(judge)s

export { CAT, APPS, FORMA, FORMA_DESC, CRIT, AYUDA, rules, examGen, examJudge, ckey };
""" % partes
open(DST, "w", encoding="utf-8").write(out)
print("api/_centro.js regenerado:", len(out), "caracteres")
