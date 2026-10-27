import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyBrightnessContrast, whitenBackground, inkCoverage, inkBBox, coverageToImage, inkFraction, estimateBorderColor, suppressEdgeArtifacts } from '../site/js/enhance.js';

function makeImg(w, h, fn) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b] = fn(x, y);
    const i = (y * w + x) * 4;
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
  }
  return { data, width: w, height: h };
}
const px = (img, x, y) => Array.from(img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 3));

test('brightness/contrast', () => {
  const img = makeImg(2, 1, () => [100, 100, 100]);
  applyBrightnessContrast(img, 20, 0);
  assert.ok(px(img, 0, 0)[0] > 100);
  const img2 = makeImg(2, 1, () => [100, 100, 100]);
  applyBrightnessContrast(img2, 0, 50);
  assert.ok(px(img2, 0, 0)[0] < 100);
  const same = makeImg(1, 1, () => [10, 20, 30]);
  applyBrightnessContrast(same, 0, 0);
  assert.deepEqual(px(same, 0, 0), [10, 20, 30]);
});

// A grey-ish wall with a gentle gradient and a dark "person" disc
function portrait() {
  return makeImg(120, 150, (x, y) => {
    const d = Math.hypot(x - 60, y - 80);
    if (d < 35) return [170, 110, 85];            // face/skin
    if (y > 135) return [40, 40, 90];             // shirt
    const g = 205 + Math.round((x / 120) * 10);   // wall 205..215, slight gradient
    return [g, g, g - 6];
  });
}

test('whitenBackground pushes the wall to white and leaves the subject alone', () => {
  const img = portrait();
  const res = whitenBackground(img);
  assert.equal(res.applied, true);
  const corner = px(img, 2, 2);
  assert.ok(corner.every((v) => v >= 252), 'corner ' + corner);
  assert.ok(px(img, 118, 40).every((v) => v >= 250));
  assert.deepEqual(px(img, 60, 80), [170, 110, 85]);  // face centre unchanged
  assert.deepEqual(px(img, 60, 145), [40, 40, 90]);   // shirt unchanged
});

test('whitenBackground does nothing on a dark or busy border', () => {
  const dark = makeImg(50, 50, () => [30, 30, 30]);
  assert.equal(whitenBackground(dark).applied, false);
  const busy = makeImg(60, 60, (x, y) => ((x + y) % 2 ? [250, 250, 250] : [140, 140, 140]));
  assert.equal(whitenBackground(busy).applied, false);
});

test('estimateBorderColor', () => {
  const c = estimateBorderColor(portrait());
  assert.ok(c.r > 200 && c.spread < 10);
});

// A "scanned signature": grey uneven paper + dark ink strokes
function sigScan() {
  return makeImg(400, 200, (x, y) => {
    const paper = 150 + Math.round(40 * (x / 400)) + ((x * 7 + y * 13) % 5); // 150..190 + noise
    const onStroke = Math.abs(y - (100 + 30 * Math.sin(x / 25))) < 3 && x > 120 && x < 300;
    return onStroke ? [30, 30, 80] : [paper, paper, paper - 3];
  });
}

test('inkCoverage finds ink on uneven paper and ignores the paper', () => {
  const scan = sigScan();
  const { cov, width, height } = inkCoverage(scan);
  assert.ok(cov[100 * width + 20] < 10, 'paper left is not ink');
  assert.ok(cov[100 * width + 390] < 10, 'paper right (brighter) is not ink');
  const frac = inkFraction(cov);
  assert.ok(frac > 0.01 && frac < 0.2, 'ink fraction ' + frac);
});

test('inkBBox trims to the strokes', () => {
  const scan = sigScan();
  const { cov, width, height } = inkCoverage(scan);
  const bb = inkBBox(cov, width, height);
  assert.ok(bb.x >= 110 && bb.x <= 125 && bb.x + bb.w >= 295 && bb.x + bb.w <= 310, JSON.stringify(bb));
  assert.ok(bb.y > 55 && bb.y + bb.h < 150);
});

test('inkBBox ignores single specks and returns null on blank paper', () => {
  const blank = makeImg(100, 60, () => [200, 200, 200]);
  const { cov, width, height } = inkCoverage(blank);
  assert.equal(inkBBox(cov, width, height), null);
  const speck = makeImg(100, 60, (x, y) => (x === 5 && y === 5 ? [0, 0, 0] : [200, 200, 200]));
  const c2 = inkCoverage(speck);
  assert.equal(inkBBox(c2.cov, c2.width, c2.height), null);
});

test('coverageToImage makes white paper and dark ink', () => {
  const cov = new Uint8Array([0, 255, 128]);
  const img = coverageToImage(cov, 3, 1, 24);
  assert.equal(img.data[0], 255);
  assert.equal(img.data[4], 24);
  assert.ok(img.data[8] > 100 && img.data[8] < 160);
});

test('suppressEdgeArtifacts removes edge shadows but keeps the signature', () => {
  // paper with a dark scanner-shadow strip on the left, thin dark line along the bottom edge, and a stroke in the middle
  const img = makeImg(400, 200, (x, y) => {
    if (x < 40) return [60, 60, 60];
    if (y > 192 && x > 60) return [70, 70, 70];
    const onStroke = Math.abs(y - (100 + 30 * Math.sin(x / 25))) < 3 && x > 120 && x < 300;
    return onStroke ? [30, 30, 80] : [190, 190, 188];
  });
  const { cov, width, height } = inkCoverage(img);
  assert.ok(inkBBox(cov, width, height).x < 60, 'shadow is detected as ink before cleaning');
  suppressEdgeArtifacts(cov, width, height);
  const bb = inkBBox(cov, width, height);
  assert.ok(bb.x >= 110 && bb.x + bb.w <= 310 && bb.y > 55 && bb.y + bb.h < 150, JSON.stringify(bb));
});

test('suppressEdgeArtifacts removes a thin paper-edge line near the border', () => {
  const img = makeImg(400, 200, (x, y) => {
    if (x >= 366 && x <= 368) return [70, 70, 70];          // thin vertical line near the right edge (beyond the 5% band)
    if (y >= 30 && y <= 32 && x > 40 && x < 340) return [70, 70, 70];  // thin horizontal line near the top
    const onStroke = Math.abs(y - (100 + 30 * Math.sin(x / 25))) < 3 && x > 120 && x < 300;
    return onStroke ? [30, 30, 80] : [190, 190, 188];
  });
  const { cov, width, height } = inkCoverage(img);
  suppressEdgeArtifacts(cov, width, height);
  const bb = inkBBox(cov, width, height);
  assert.ok(bb.x >= 110 && bb.x + bb.w <= 310 && bb.y > 55 && bb.y + bb.h < 150, JSON.stringify(bb));
});
