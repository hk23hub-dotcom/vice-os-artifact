import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const QU = require('../quote-utils.js');

test('quoteDeepLink builds universe URL with quote param', () => {
  assert.equal(
    QU.quoteDeepLink('https://hk23neo.github.io/vice-os', 'q01'),
    'https://hk23neo.github.io/vice-os/hk23-universe.html?quote=q01'
  );
});

test('quoteDeepLink trims trailing slashes on base', () => {
  assert.equal(
    QU.quoteDeepLink('https://x.dev/', 'q02'),
    'https://x.dev/hk23-universe.html?quote=q02'
  );
});

test('resolveTargetKind: planet vs zone', () => {
  assert.equal(QU.resolveTargetKind('vicegolfer'), 'planet');
  assert.equal(QU.resolveTargetKind('projects_pl'), 'planet');
  assert.equal(QU.resolveTargetKind('lore'), 'zone');
  assert.equal(QU.resolveTargetKind('ecosystem'), 'zone');
});

test('validateQuotes flags missing/duplicate/unknown', () => {
  const bad = [
    { id: 'q01', text: 'a', target: 'vicegolfer', rarity: 'common' },
    { id: 'q01', text: 'b', target: 'nope',       rarity: 'common' },
    { id: 'q03', text: '',  target: 'lore',        rarity: 'mythic' },
  ];
  const errs = QU.validateQuotes(bad);
  assert.ok(errs.some(e => e.includes('duplicate id')));
  assert.ok(errs.some(e => e.includes('unknown target')));
  assert.ok(errs.some(e => e.includes('missing text')));
  assert.ok(errs.some(e => e.includes('invalid rarity')));
});

test('validateQuotes passes a clean set', () => {
  const ok = [{ id: 'q01', text: 'a', target: 'vicegolfer', rarity: 'common' }];
  assert.deepEqual(QU.validateQuotes(ok), []);
});
