import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchQuality, scaleLadder, Q_MIN, Q_MAX } from '../site/js/search.js';

// A fake encoder: size grows with quality, monotonic, like a real JPEG.
const model = (base, k) => async (q) => Math.round(base + k * Math.pow(q, 2.2));

test('picks the highest quality under the max', async () => {
  const sizeAt = model(2000, 90000);
  const r = await searchQuality(sizeAt, { minBytes: 20 * 1024, maxBytes: 50000 });
  assert.equal(r.status, 'ok');
  assert.ok(r.size <= 50000 && r.size >= 20 * 1024);
  // one hair above would break the limit
  assert.ok((await sizeAt(r.quality + 0.01)) > 50000 || r.quality >= 0.97);
  assert.ok(r.steps <= 12);
});

test('uses max quality when everything fits', async () => {
  const r = await searchQuality(model(30000, 5000), { minBytes: 20000, maxBytes: 50000 });
  assert.equal(r.quality, Q_MAX);
  assert.equal(r.status, 'ok');
});

test('reports below-min when even max quality is too small', async () => {
  const r = await searchQuality(model(1000, 3000), { minBytes: 20 * 1024, maxBytes: 50000 });
  assert.equal(r.status, 'below-min');
  assert.equal(r.quality, Q_MAX);
  assert.ok(r.size < 20 * 1024);
});

test('reports too-big when even min quality is too large', async () => {
  const r = await searchQuality(model(90000, 500000), { minBytes: 0, maxBytes: 20000 });
  assert.equal(r.status, 'too-big');
  assert.equal(r.quality, Q_MIN);
});

test('survives a non-monotonic encoder', async () => {
  const sizeAt = async (q) => Math.round(20000 + 30000 * q + (Math.sin(q * 90) * 600));
  const r = await searchQuality(sizeAt, { minBytes: 0, maxBytes: 40000 });
  assert.ok(r.size <= 40000);
});

test('scale ladder', () => {
  assert.equal(scaleLadder()[0], 1);
  assert.ok(scaleLadder(0.5).every((s) => s >= 0.5));
  assert.ok(scaleLadder(0.5).length < scaleLadder(0.2).length);
});
