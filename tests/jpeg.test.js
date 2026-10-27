import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setJfifDensity, readJfifDensity, padJpegToSize, looksLikeValidJpeg, readJpegSize } from '../site/js/jpeg.js';

const tiny = new Uint8Array(readFileSync(new URL('./fixtures/tiny.jpg', import.meta.url)));

test('fixture is a valid JPEG', () => {
  assert.ok(looksLikeValidJpeg(tiny));
  assert.deepEqual(readJpegSize(tiny), { w: 64, h: 48 });
});

test('setJfifDensity rewrites an existing JFIF header', () => {
  const out = setJfifDensity(tiny, 300);
  assert.equal(out.length, tiny.length);
  assert.deepEqual(readJfifDensity(out), { units: 1, x: 300, y: 300 });
  assert.ok(looksLikeValidJpeg(out));
  // original is untouched
  assert.notDeepEqual(readJfifDensity(tiny), { units: 1, x: 300, y: 300 });
});

test('setJfifDensity inserts a JFIF header when missing', () => {
  // strip the 18-byte APP0 to simulate an Exif-first / header-less file
  const app0Len = 2 + ((tiny[4] << 8) | tiny[5]);
  const stripped = new Uint8Array(tiny.length - app0Len);
  stripped.set(tiny.subarray(0, 2), 0);
  stripped.set(tiny.subarray(2 + app0Len), 2);
  assert.equal(readJfifDensity(stripped), null);
  const out = setJfifDensity(stripped, 200);
  assert.deepEqual(readJfifDensity(out), { units: 1, x: 200, y: 200 });
  assert.equal(out.length, stripped.length + 18);
  assert.ok(looksLikeValidJpeg(out));
  assert.deepEqual(readJpegSize(out), { w: 64, h: 48 });
});

test('padJpegToSize reaches exact target and stays valid', () => {
  for (const extra of [1, 3, 4, 5, 100, 1000, 70000, 200000]) {
    const target = tiny.length + extra;
    const out = padJpegToSize(setJfifDensity(tiny, 96), target);
    assert.ok(out.length >= target, `extra ${extra}`);
    assert.ok(out.length - target <= 3, `overshoot ${out.length - target} for extra ${extra}`);
    assert.ok(looksLikeValidJpeg(out));
    assert.deepEqual(readJpegSize(out), { w: 64, h: 48 });
    assert.deepEqual(readJfifDensity(out), { units: 1, x: 96, y: 96 });
  }
});

test('padJpegToSize leaves big-enough files alone', () => {
  assert.equal(padJpegToSize(tiny, 10), tiny);
});

test('rejects non-JPEG', () => {
  assert.throws(() => setJfifDensity(new Uint8Array([1, 2, 3, 4, 5]), 72));
  assert.equal(looksLikeValidJpeg(new Uint8Array([1, 2, 3])), false);
});
