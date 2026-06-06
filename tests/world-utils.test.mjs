import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const W = require('../world-utils.js');

test('hasWorld knows registered worlds', () => {
  assert.equal(W.hasWorld('vicegolfer'), true);
  assert.equal(W.hasWorld('lore'), false);
  assert.equal(W.hasWorld(undefined), false);
});

test('validateWorldManifest passes a clean manifest', () => {
  const m = { id:'vicegolfer', title:'THE GOLF HOUSE', accent:'#AAFF00',
    ambient:'assets/golfteiner/golfteiner-render-1.png',
    hotspots:[{ x:0.3, y:0.5, label:'BAY', detail:{ title:'X', desc:'y' } }] };
  assert.deepEqual(W.validateWorldManifest(m), []);
});

test('validateWorldManifest flags missing fields + bad coords', () => {
  const m = { id:'', accent:'#fff', hotspots:[
    { x:2, y:0.5, label:'A' },
    { x:0.2, y:0.5, detail:{title:'t',desc:'d'} }
  ] };
  const e = W.validateWorldManifest(m);
  assert.ok(e.some(s=>s.includes('id')));
  assert.ok(e.some(s=>s.includes('title')));
  assert.ok(e.some(s=>s.includes('x out of range')));
  assert.ok(e.some(s=>s.includes('missing label')));
  assert.ok(e.some(s=>s.includes('missing detail')));
});
