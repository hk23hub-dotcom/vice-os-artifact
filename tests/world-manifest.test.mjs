import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const W = require('../world-utils.js');
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const m = JSON.parse(readFileSync(join(root, 'worlds', 'vicegolfer.json'), 'utf8'));

test('vicegolfer manifest is valid', () => {
  assert.deepEqual(W.validateWorldManifest(m), []);
});

test('every referenced image + blueprint file exists', () => {
  if (m.ambient) assert.ok(existsSync(join(root, m.ambient)), 'missing ambient ' + m.ambient);
  (m.layers || []).forEach(l => assert.ok(existsSync(join(root, l.src)), 'missing layer ' + l.src));
  m.hotspots.forEach(h => {
    if (h.blueprint) assert.ok(existsSync(join(root, h.blueprint)), 'missing blueprint ' + h.blueprint);
  });
});
