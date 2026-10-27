import { test } from 'node:test';
import assert from 'node:assert/strict';
import { theta, screenToImage, imageToScreen, coverScale, containScale, clampView, fitView, panBy, zoomAt, frameInContainer, minScale, viewForBox } from '../site/js/geometry.js';

const frame = { w: 200, h: 230 };
const W = 1000, H = 800;

test('screen <-> image round trip', () => {
  const v = { cx: 400, cy: 300, scale: 0.7, rot90: 1, straighten: 4 };
  const [px, py] = screenToImage(v, 33, -21);
  const [qx, qy] = imageToScreen(v, px, py);
  assert.ok(Math.abs(qx - 33) < 1e-9 && Math.abs(qy + 21) < 1e-9);
});

test('cover scale fills the frame at any rotation', () => {
  for (const st of [-10, -3, 0, 7, 10]) for (const r of [0, 1, 2, 3]) {
    let v = { cx: W / 2, cy: H / 2, scale: 1, rot90: r, straighten: st };
    v = fitView(v, frame, W, H);
    // every frame corner lies inside the image
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const [x, y] = screenToImage(v, (sx * frame.w) / 2, (sy * frame.h) / 2);
      assert.ok(x >= -1e-6 && x <= W + 1e-6 && y >= -1e-6 && y <= H + 1e-6, `corner out for rot ${r} st ${st}: ${x},${y}`);
    }
  }
});

test('clampView keeps the frame inside the image when panning far away', () => {
  let v = fitView({ cx: 0, cy: 0, scale: 1, rot90: 0, straighten: 5 }, frame, W, H);
  v = zoomAt(v, 2, 0, 0);
  v = panBy(v, -99999, 99999);
  v = clampView(v, frame, W, H);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const [x, y] = screenToImage(v, (sx * frame.w) / 2, (sy * frame.h) / 2);
    assert.ok(x >= -1e-6 && x <= W + 1e-6 && y >= -1e-6 && y <= H + 1e-6);
  }
});

test('zoom cannot go below cover or above 10x', () => {
  const base = fitView({ cx: 0, cy: 0, scale: 1, rot90: 0, straighten: 0 }, frame, W, H);
  const lo = clampView({ ...base, scale: 0.0001 }, frame, W, H);
  assert.ok(Math.abs(lo.scale - coverScale(frame, W, H, 0)) < 1e-9);
  const hi = clampView({ ...base, scale: 1e6 }, frame, W, H);
  assert.ok(Math.abs(hi.scale - 10 * coverScale(frame, W, H, 0)) < 1e-9);
});

test('margins mode allows zooming out to the whole image, but auto-fit still fills the frame', () => {
  assert.ok(minScale(frame, W, H, 0, true) < containScale(frame, W, H, 0));
  const v = fitView({ cx: 0, cy: 0, scale: 1, rot90: 0, straighten: 0 }, frame, W, H, true);
  assert.ok(Math.abs(v.scale - coverScale(frame, W, H, 0)) < 1e-9);
});

test('zoomAt keeps the point under the finger fixed', () => {
  const v = { cx: 500, cy: 400, scale: 0.5, rot90: 0, straighten: 3 };
  const before = screenToImage(v, 40, -30);
  const z = zoomAt(v, 1.7, 40, -30);
  const after = screenToImage(z, 40, -30);
  assert.ok(Math.abs(before[0] - after[0]) < 1e-9 && Math.abs(before[1] - after[1]) < 1e-9);
});

test('panBy moves the image with the finger (rotated)', () => {
  const v = { cx: 500, cy: 400, scale: 0.5, rot90: 1, straighten: 0 };
  const pt = screenToImage(v, 0, 0);
  const moved = panBy(v, 10, 0);
  const [sx, sy] = imageToScreen(moved, pt[0], pt[1]);
  assert.ok(Math.abs(sx - 10) < 1e-9 && Math.abs(sy) < 1e-9);
});

test('frameInContainer', () => {
  const f = frameInContainer(400, 600, 200 / 230, 16);
  assert.ok(f.w <= 368 && f.h <= 568);
  assert.ok(Math.abs(f.w / f.h - 200 / 230) < 1e-9);
  assert.equal(f.x, (400 - f.w) / 2);
  const wide = frameInContainer(400, 600, 3, 16);
  assert.ok(Math.abs(wide.w - 368) < 1e-9);
});

test('viewForBox centres and fits a box', () => {
  const v = viewForBox({ cx: 0, cy: 0, scale: 1, rot90: 0, straighten: 0 }, { w: 300, h: 100 }, { x: 100, y: 200, w: 150, h: 30 }, 0.9);
  assert.equal(v.cx, 175); assert.equal(v.cy, 215);
  assert.ok(Math.abs(v.scale - Math.min(270 / 150, 90 / 30)) < 1e-9);
});
