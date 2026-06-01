import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const QU = require('../quote-utils.js');

const here = dirname(fileURLToPath(import.meta.url));
const quotes = JSON.parse(readFileSync(join(here, '..', 'quotes.json'), 'utf8'));

test('quotes.json is a non-empty array', () => {
  assert.ok(Array.isArray(quotes) && quotes.length >= 10);
});

test('quotes.json passes schema + target integrity', () => {
  assert.deepEqual(QU.validateQuotes(quotes), []);
});

test('every quote has header and hashtags', () => {
  for (const q of quotes) {
    assert.equal(typeof q.header, 'string');
    assert.ok(Array.isArray(q.hashtags) && q.hashtags.length > 0);
    assert.equal(typeof q.posted, 'boolean');
  }
});
