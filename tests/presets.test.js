import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { PRESETS, GROUPS } from '../site/presets.js';
import { validatePreset, validateAll, targetDims, effectiveLimits, checkResult, allPass, canStepDown, minAllowedDims } from '../site/js/validate.js';

test('every preset definition is valid', () => {
  assert.deepEqual(validateAll(PRESETS), []);
});

test('presets cover the required forms', () => {
  const ids = PRESETS.map((p) => p.id);
  for (const want of ['jee-main-photo', 'neet-ug-photo', 'gate-photo', 'upsc-photo', 'ssc-cgl-sign', 'ibps-photo', 'sbi-photo', 'rrb-ntpc-photo', 'cuet-ug-photo', 'cat-photo',
    'in-passport', 'pan-photo', 'aadhaar-doc', 'us-visa', 'schengen', 'uk-passport', 'ca-passport-digital', 'au-passport', 'gen-20kb', 'gen-50kb', 'gen-100kb', 'gen-passport']) {
    assert.ok(ids.includes(want), want);
  }
  for (const g of GROUPS) assert.ok(PRESETS.some((p) => p.group === g.id), 'group ' + g.id);
});

test('verified presets carry an official https source and a date', () => {
  for (const p of PRESETS.filter((x) => x.verified && !x.generic)) {
    assert.match(p.source.url, /^https:\/\//);
    assert.equal(p.checked, '2026-10-27');
  }
});

test('validatePreset catches broken entries', () => {
  assert.ok(validatePreset({ id: 'X', kind: 'cat' }).length > 3);
  const good = { ...PRESETS[0] };
  assert.deepEqual(validatePreset(good), []);
  assert.ok(validatePreset({ ...good, kb: { min: 50, max: 10 } }).length > 0);
  assert.ok(validatePreset({ ...good, dimsRule: 'range' }).length > 0);
});

test('target dims', () => {
  assert.deepEqual(targetDims(PRESETS.find((p) => p.id === 'gen-passport')), { w: 413, h: 531 });
  assert.deepEqual(targetDims(PRESETS.find((p) => p.id === 'sbi-photo')), { w: 200, h: 230 });
  assert.deepEqual(targetDims(PRESETS.find((p) => p.id === 'gen-50kb'), 1), { w: 1000, h: 1000 });
  assert.deepEqual(targetDims(PRESETS.find((p) => p.id === 'gen-50kb'), 0.5), { w: 500, h: 1000 });
  assert.deepEqual(targetDims(PRESETS.find((p) => p.id === 'gen-50kb'), 2), { w: 1000, h: 500 });
});

test('step down rules', () => {
  const sbi = PRESETS.find((p) => p.id === 'sbi-photo');
  assert.equal(canStepDown(sbi, targetDims(sbi)), false);
  const us = PRESETS.find((p) => p.id === 'us-visa');
  assert.equal(canStepDown(us, targetDims(us)), true);
  assert.deepEqual(minAllowedDims(us, targetDims(us)), { w: 600, h: 600 });
  const jee = PRESETS.find((p) => p.id === 'jee-main-photo');
  assert.equal(canStepDown(jee, targetDims(jee)), true);
});

test('US visa: compression ratio sets a minimum size', () => {
  const us = PRESETS.find((p) => p.id === 'us-visa');
  const a = effectiveLimits(us, 1000, 1000);
  assert.equal(a.maxBytes, 240000);
  assert.ok(a.minBytes >= 150000 && a.minBytes < 152000);
  const b = effectiveLimits(us, 600, 600);
  assert.ok(b.minBytes >= 54000 && b.minBytes < 56000);
});

test('checkResult ticks', () => {
  const ibps = PRESETS.find((p) => p.id === 'sbi-photo');
  const ok = checkResult(ibps, { w: 200, h: 230, bytes: 38 * 1024, dpi: 200, format: 'jpg', quality: 0.8 });
  assert.ok(allPass(ok));
  const bad = checkResult(ibps, { w: 200, h: 231, bytes: 60 * 1024, dpi: 200, format: 'jpg', quality: 0.8 });
  assert.equal(bad.find((r) => r.id === 'dims').ok, false);
  assert.equal(bad.find((r) => r.id === 'size').ok, false);
  assert.equal(allPass(bad), false);
  const free = PRESETS.find((p) => p.id === 'gen-50kb');
  const r = checkResult(free, { w: 750, h: 1000, bytes: 49000, dpi: 72, format: 'jpg' });
  assert.equal(r.find((x) => x.id === 'dims').ok, null);
  assert.ok(allPass(r));
});

test('site file list in sw.js matches the files on disk', () => {
  const sw = readFileSync(new URL('../site/sw.js', import.meta.url), 'utf8');
  const m = sw.match(/const ASSETS = \[([\s\S]*?)\];/);
  assert.ok(m, 'ASSETS array found');
  const listed = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).filter((x) => x !== './');
  for (const f of listed) assert.ok(existsSync(new URL('../site/' + f, import.meta.url)), 'missing ' + f);
  const walk = (dir, base = '') => readdirSync(new URL('../site/' + dir, import.meta.url), { withFileTypes: true })
    .flatMap((d) => d.isDirectory() ? walk(dir + d.name + '/', base) : [dir + d.name]);
  const onDisk = walk('').filter((f) => f !== 'sw.js');
  for (const f of onDisk) assert.ok(listed.includes(f), 'not precached: ' + f);
});
