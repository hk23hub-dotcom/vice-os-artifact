// world-utils.js — DOM-free world registry + manifest validation.
// Consumed by hk23-universe.html, world-engine.js, and node tests.
(function (root) {
  'use strict';

  // Planets that have a bespoke immersive world. Others use the fractal graph.
  var WORLD_IDS = ['vicegolfer', 'arteworld', 'viceai'];

  function hasWorld(id) { return WORLD_IDS.indexOf(id) !== -1; }

  function validateWorldManifest(m) {
    var e = [];
    if (!m || typeof m !== 'object') return ['manifest must be an object'];
    if (!m.id) e.push('manifest missing id');
    if (!m.title) e.push('manifest missing title');
    if (!m.accent) e.push('manifest missing accent');
    // A world is a hotspot scene, a gallery, OR an isometric station.
    var hasHotspots = Array.isArray(m.hotspots);
    var hasGallery = Array.isArray(m.gallery);
    var hasStation = m.station && Array.isArray(m.station.modules);
    if (!hasHotspots && !hasGallery && !hasStation) { e.push('manifest needs hotspots, gallery, or station'); return e; }
    if (hasGallery) {
      if (!m.gallery.length) e.push('gallery is empty');
      m.gallery.forEach(function (g, i) { if (!g.file) e.push('gallery[' + i + '] missing file'); });
    }
    if (hasStation) {
      m.station.modules.forEach(function (s, i) {
        if (typeof s.gx !== 'number' || typeof s.gy !== 'number') e.push('station module[' + i + '] missing gx/gy');
        if (!s.label) e.push('station module[' + i + '] missing label');
      });
    }
    if (!hasHotspots) return e;
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
