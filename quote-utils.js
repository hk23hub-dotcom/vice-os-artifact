// quote-utils.js — DOM-free helpers for the Mindset Engine.
// Consumed by hk23-universe.html, quote-studio.html, daily.html, and node tests.
(function (root) {
  'use strict';

  // Drillable project planets (vs. zone screens reached via goTo()).
  var PLANET_IDS = ['vicegolfer','rugbyvice','laiglesia','arteworld','projects_pl',
                    'cryptovice','hk23hub','teeclub','viceai','marketplace'];
  // Non-planet screens that quotes may target.
  var ZONE_IDS = ['lore','flow','agents','systems','ecosystem','arte','viceos','trap','gates'];

  function quoteDeepLink(baseUrl, quoteId) {
    var base = String(baseUrl).replace(/\/+$/, '');
    return base + '/hk23-universe.html?quote=' + encodeURIComponent(quoteId);
  }

  function resolveTargetKind(targetId, planetIds) {
    var ids = planetIds || PLANET_IDS;
    return ids.indexOf(targetId) !== -1 ? 'planet' : 'zone';
  }

  function validateQuotes(quotes, planetIds) {
    var errors = [];
    if (!Array.isArray(quotes)) return ['quotes must be an array'];
    var ids = planetIds || PLANET_IDS;
    var seen = {};
    quotes.forEach(function (q, i) {
      var ref = q && q.id ? q.id : '#' + i;
      if (!q.id) errors.push('quote[' + i + '] missing id');
      else if (seen[q.id]) errors.push('duplicate id: ' + q.id);
      else seen[q.id] = true;
      if (!q.text) errors.push('quote[' + ref + '] missing text');
      if (!q.target) errors.push('quote[' + ref + '] missing target');
      else if (ids.indexOf(q.target) === -1 && ZONE_IDS.indexOf(q.target) === -1)
        errors.push('quote[' + ref + '] unknown target: ' + q.target);
      if (['common','rare','legendary'].indexOf(q.rarity) === -1)
        errors.push('quote[' + ref + '] invalid rarity: ' + q.rarity);
    });
    return errors;
  }

  var api = { PLANET_IDS: PLANET_IDS, ZONE_IDS: ZONE_IDS,
              quoteDeepLink: quoteDeepLink, resolveTargetKind: resolveTargetKind,
              validateQuotes: validateQuotes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QuoteUtils = api;
})(typeof window !== 'undefined' ? window : this);
