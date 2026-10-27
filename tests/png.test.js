import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { crc32, setPngDpi, readPngDpi, padPngToSize, listChunks, readPngSize } from '../site/js/png.js';

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out, 4, 8 + data.length));
  return out;
}
function makePng(w, h) {
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w); dv.setUint32(4, h); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h, 128);
  for (let y = 0; y < h; y++) raw[y * (w * 3 + 1)] = 0;
  const parts = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', new Uint8Array(deflateSync(raw))), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

test('crc32 known value', () => {
  const b = new TextEncoder().encode('123456789');
  assert.equal(crc32(b), 0xcbf43926);
});

test('pHYs is written and read back (300 dpi)', () => {
  const png = makePng(8, 6);
  assert.equal(readPngDpi(png), null);
  const out = setPngDpi(png, 300);
  const dpi = readPngDpi(out);
  assert.ok(Math.abs(dpi.x - 300) < 0.5 && Math.abs(dpi.y - 300) < 0.5);
  assert.deepEqual(listChunks(out).map((c) => c.type), ['IHDR', 'pHYs', 'IDAT', 'IEND']);
  assert.deepEqual(readPngSize(out), { w: 8, h: 6 });
  // replacing an existing pHYs keeps a single chunk
  const again = setPngDpi(out, 200);
  assert.equal(listChunks(again).filter((c) => c.type === 'pHYs').length, 1);
  assert.ok(Math.abs(readPngDpi(again).x - 200) < 0.5);
});

test('pad PNG with tEXt keeps it parseable and reaches size', () => {
  const png = setPngDpi(makePng(8, 6), 96);
  for (const extra of [1, 19, 20, 21, 5000]) {
    const out = padPngToSize(png, png.length + extra);
    assert.ok(out.length >= png.length + extra);
    const types = listChunks(out).map((c) => c.type);
    assert.equal(types[types.length - 1], 'IEND');
    assert.ok(types.includes('tEXt'));
    // every chunk CRC is valid
    for (const c of listChunks(out)) {
      const dv = new DataView(out.buffer, out.byteOffset);
      assert.equal(dv.getUint32(c.offset + 8 + c.length), crc32(out, c.offset + 4, c.offset + 8 + c.length));
    }
  }
});
