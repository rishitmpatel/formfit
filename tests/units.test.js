import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMm, mmToPx, physToPx, sizeToPx, pxToMm, maxBytesFromKB, minBytesFromKB, formatKB } from '../site/js/units.js';

test('mm/cm/in to mm', () => {
  assert.equal(toMm(35, 'mm'), 35);
  assert.equal(toMm(3.5, 'cm'), 35);
  assert.equal(toMm(2, 'in'), 50.8);
  assert.throws(() => toMm(1, 'furlong'));
});

test('physical size to pixels', () => {
  assert.equal(physToPx(35, 'mm', 300), 413);
  assert.equal(physToPx(45, 'mm', 300), 531);
  assert.equal(physToPx(2, 'in', 300), 600);
  assert.equal(physToPx(10, 'cm', 200), 787);
  assert.deepEqual(sizeToPx({ unit: 'cm', w: 3, h: 3, dpi: 200 }), { w: 236, h: 236 });
  assert.deepEqual(sizeToPx({ unit: 'px', w: 200.4, h: 230 }), { w: 200, h: 230 });
  assert.throws(() => sizeToPx({ unit: 'mm', w: 1, h: 1 }));
});

test('px to mm round trip', () => {
  assert.ok(Math.abs(pxToMm(413, 300) - 35) < 0.1);
});

test('KB limits use the strict end on each side', () => {
  assert.equal(maxBytesFromKB(50), 50000);
  assert.equal(minBytesFromKB(20), 20480);
  assert.equal(maxBytesFromKB(null), Infinity);
  assert.equal(minBytesFromKB(undefined), 0);
});

test('formatKB', () => {
  assert.equal(formatKB(38 * 1024), '38');
  assert.equal(formatKB(38 * 1024 + 512), '38.5');
  assert.equal(formatKB(240000), '234');
});
