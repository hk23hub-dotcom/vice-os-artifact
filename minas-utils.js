// minas-utils.js — DOM-free helpers for the Radar Minero (minas.html).
// Concesiones mineras Chile: patentes, geometría UTM, scoring de oportunidades.
(function (root) {
  'use strict';

  // UTM por hectárea al año (sin trabajo acreditado). Explotación 0,4 (Form 40 TGR);
  // exploración 0,06. Ajustables desde la UI.
  var TASAS = { explotacion: 0.4, exploracion: 0.06 };
  // Recargo por pago fuera de plazo (patente impaga): se paga el doble.
  var RECARGO_MORA = 1.0;

  // Reglas referenciales del pedimento (verificar con abogado minero).
  var PEDIMENTO_LADO_M = 100;
  var PEDIMENTO_MAX_HA = 5000;
  var PERTENENCIA_MAX_HA = 10;

  function round(n, d) { var f = Math.pow(10, d || 0); return Math.round(n * f) / f; }

  function patenteAnual(ha, tipo, utmClp, clpPorUsd, tasas) {
    var t = (tasas || TASAS)[tipo];
    if (t == null) throw new Error('tipo desconocido: ' + tipo);
    var utm = ha * t;
    var clp = utm * utmClp;
    return { utm: round(utm, 2), clp: Math.round(clp), usd: Math.round(clp / clpPorUsd) };
  }

  // Deuda de una concesión con patente impaga: años adeudados × patente × (1 + recargo).
  function deudaImpaga(ha, aniosAdeudados, utmClp, clpPorUsd, tasas) {
    var p = patenteAnual(ha, 'explotacion', utmClp, clpPorUsd, tasas);
    var k = aniosAdeudados * (1 + RECARGO_MORA);
    return { utm: round(p.utm * k, 2), clp: Math.round(p.clp * k), usd: Math.round(p.usd * k) };
  }

  // Rectángulo UTM desde esquinas SW y NE (metros).
  function rect(swE, swN, neE, neN) {
    var w = neE - swE, h = neN - swN;
    if (!(w > 0 && h > 0)) throw new Error('esquinas inválidas');
    return { swE: swE, swN: swN, neE: neE, neN: neN, anchoM: w, altoM: h, ha: (w * h) / 10000 };
  }

  function esquinas(r) {
    return [
      ['SW', r.swE, r.swN], ['SE', r.neE, r.swN],
      ['NE', r.neE, r.neN], ['NW', r.swE, r.neN]
    ];
  }

  function centro(r) { return { e: (r.swE + r.neE) / 2, n: (r.swN + r.neN) / 2 }; }

  function distanciaKm(a, b) {
    var ca = centro(a), cb = centro(b);
    return round(Math.hypot(ca.e - cb.e, ca.n - cb.n) / 1000, 2);
  }

  function seTraslapan(a, b) {
    return a.swE < b.neE && b.swE < a.neE && a.swN < b.neN && b.swN < a.neN;
  }

  // Comparten un borde (no solo una esquina) sin traslaparse.
  function sonContiguos(a, b) {
    if (seTraslapan(a, b)) return false;
    var tocaV = (a.neE === b.swE || b.neE === a.swE) &&
      Math.min(a.neN, b.neN) > Math.max(a.swN, b.swN);
    var tocaH = (a.neN === b.swN || b.neN === a.swN) &&
      Math.min(a.neE, b.neE) > Math.max(a.swE, b.swE);
    return tocaV || tocaH;
  }

  function validarPedimento(r) {
    var errores = [];
    if (r.anchoM % PEDIMENTO_LADO_M || r.altoM % PEDIMENTO_LADO_M)
      errores.push('lados deben ser múltiplos de ' + PEDIMENTO_LADO_M + ' m');
    if (r.ha > PEDIMENTO_MAX_HA) errores.push('máximo ' + PEDIMENTO_MAX_HA + ' ha');
    return { ok: errores.length === 0, errores: errores };
  }

  // Recorta un rectángulo al mayor pedimento válido anclado en SW.
  function ajustarPedimento(r) {
    var w = Math.floor(r.anchoM / PEDIMENTO_LADO_M) * PEDIMENTO_LADO_M;
    var h = Math.floor(r.altoM / PEDIMENTO_LADO_M) * PEDIMENTO_LADO_M;
    if (!w || !h) return null;
    return rect(r.swE, r.swN, r.swE + w, r.swN + h);
  }

  // Grilla mínima de pertenencias iguales: celdas de lados enteros ≥100 m y ≤10 ha.
  function pertenencias(r) {
    var best = null;
    for (var nx = 1; r.anchoM / nx >= 100; nx++) {
      if (r.anchoM % nx) continue;
      for (var ny = 1; r.altoM / ny >= 100; ny++) {
        if (r.altoM % ny) continue;
        var w = r.anchoM / nx, h = r.altoM / ny;
        if (w * h / 10000 > PERTENENCIA_MAX_HA) continue;
        if (!best || nx * ny < best.n) best = { n: nx * ny, haCada: round(w * h / 10000, 2), dimM: [w, h], grilla: [nx, ny] };
        break; // más filas solo agrega celdas
      }
    }
    return best;
  }

  // Score 0–100. Transparente: cada componente se muestra en la UI.
  function score(op) {
    var c = {};
    c.impaga = op.estadoPatente === 'impaga' ? 30 : op.estadoPatente === 'por_verificar' ? 10 : 0;
    c.libre = op.tipo === 'area_libre' ? 20 : 0;
    c.contigua = op.contiguaImpaga ? 20 : 0;
    c.tamano = Math.min(15, Math.round((op.ha || 0) / 20));
    var comp = op.competidorKm;
    c.competencia = comp == null ? 5 : comp >= 2 ? 15 : comp >= 1 ? 8 : 0;
    var total = 0;
    for (var k in c) total += c[k];
    return { total: Math.min(100, total), componentes: c };
  }

  function tier(total) { return total >= 65 ? 'A' : total >= 45 ? 'B' : 'C'; }

  // CSV simple (sin comillas anidadas complejas): primera fila = encabezados.
  function parseCSV(text) {
    var lines = String(text).replace(/\r/g, '').split('\n').filter(function (l) { return l.trim(); });
    if (!lines.length) return [];
    var sep = lines[0].indexOf(';') !== -1 ? ';' : ',';
    var head = lines[0].split(sep).map(function (s) { return s.trim(); });
    return lines.slice(1).map(function (l) {
      var cols = l.split(sep), o = {};
      head.forEach(function (h, i) { o[h] = (cols[i] || '').trim(); });
      return o;
    });
  }

  var api = {
    TASAS: TASAS, RECARGO_MORA: RECARGO_MORA,
    patenteAnual: patenteAnual, deudaImpaga: deudaImpaga,
    rect: rect, esquinas: esquinas, centro: centro, distanciaKm: distanciaKm,
    seTraslapan: seTraslapan, sonContiguos: sonContiguos,
    validarPedimento: validarPedimento, ajustarPedimento: ajustarPedimento,
    pertenencias: pertenencias, score: score, tier: tier, parseCSV: parseCSV
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MinasUtils = api;
})(this);
