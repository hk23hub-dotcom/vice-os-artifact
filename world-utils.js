// world-utils.js — DOM-free world registry + manifest validation.
// Consumed by hk23-universe.html, world-engine.js, and node tests.
(function (root) {
  'use strict';

  // Planets that have a bespoke immersive world. Others use the fractal graph.
  var WORLD_IDS = ['vicegolfer'];

  function hasWorld(id) { return WORLD_IDS.indexOf(id) !== -1; }

  function validateWorldManifest(m) {
    var e = [];
    if (!m || typeof m !== 'object') return ['manifest must be an object'];
    if (!m.id) e.push('manifest missing id');
    if (!m.title) e.push('manifest missing title');
    if (!m.accent) e.push('manifest missing accent');
    if (!Array.isArray(m.hotspots)) { e.push('manifest hotspots must be an array'); return e; }
    m.hotspots.forEach(function (h, i) {
      var ref = h && h.label ? h.label : '#' + i;
      if (typeof h.x !== 'number' || h.x < 0 || h.x > 1) e.push('hotspot[' + ref + '] x out of range');
      if (typeof h.y !== 'number' || h.y < 0 || h.y > 1) e.push('hotspot[' + ref + '] y out of range');
      if (!h.label) e.push('hotspot[' + i + '] missing label');
      if (!h.detail || !h.detail.title) e.push('hotspot[' + ref + '] missing detail.title');
    });
    return e;
  }

  var api = { WORLD_IDS: WORLD_IDS, hasWorld: hasWorld, validateWorldManifest: validateWorldManifest };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WorldUtils = api;
})(typeof window !== 'undefined' ? window : this);
