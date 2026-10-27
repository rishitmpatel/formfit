// Pure PNG helpers: pHYs (DPI) and ancillary-chunk padding.

const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

let CRC_TABLE = null;
function crcTable() {
  if (CRC_TABLE) return CRC_TABLE;
  CRC_TABLE = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    CRC_TABLE[n] = c >>> 0;
  }
  return CRC_TABLE;
}
export function crc32(bytes, start = 0, end = bytes.length) {
  const t = crcTable();
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = t[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function checkSig(b) {
  if (!(b instanceof Uint8Array) || b.length < 33) throw new Error('Not a PNG');
  for (let i = 0; i < 8; i++) if (b[i] !== SIG[i]) throw new Error('Not a PNG');
}

function u32(b, o) { return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0; }
function w32(b, o, v) { b[o] = v >>> 24; b[o + 1] = (v >>> 16) & 255; b[o + 2] = (v >>> 8) & 255; b[o + 3] = v & 255; }

function makeChunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  w32(out, 0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  w32(out, 8 + data.length, crc32(out, 4, 8 + data.length));
  return out;
}

/** List chunks: [{type, offset, length(data)}] */
export function listChunks(bytes) {
  checkSig(bytes);
  const chunks = [];
  let o = 8;
  while (o + 12 <= bytes.length) {
    const len = u32(bytes, o);
    const type = String.fromCharCode(bytes[o + 4], bytes[o + 5], bytes[o + 6], bytes[o + 7]);
    chunks.push({ type, offset: o, length: len });
    o += 12 + len;
    if (type === 'IEND') break;
  }
  return chunks;
}

/** Return a copy of the PNG with a pHYs chunk set to dpi. */
export function setPngDpi(bytes, dpi) {
  checkSig(bytes);
  const ppm = Math.round(dpi / 0.0254);
  const data = new Uint8Array(9);
  w32(data, 0, ppm); w32(data, 4, ppm); data[8] = 1; // unit = metre
  const chunk = makeChunk('pHYs', data);
  const chunks = listChunks(bytes);
  const ihdr = chunks[0];
  const existing = chunks.find((c) => c.type === 'pHYs');
  const parts = [];
  let cursor = 0;
  if (existing) {
    parts.push(bytes.subarray(0, existing.offset), chunk, bytes.subarray(existing.offset + 12 + existing.length));
  } else {
    const at = ihdr.offset + 12 + ihdr.length;
    parts.push(bytes.subarray(0, at), chunk, bytes.subarray(at));
  }
  void cursor;
  return concat(parts);
}

export function readPngDpi(bytes) {
  checkSig(bytes);
  const c = listChunks(bytes).find((x) => x.type === 'pHYs');
  if (!c) return null;
  const o = c.offset + 8;
  if (bytes[o + 8] !== 1) return null;
  return { x: u32(bytes, o) * 0.0254, y: u32(bytes, o + 4) * 0.0254 };
}

/** Pad a PNG to at least targetBytes with a tEXt chunk placed before IDAT. */
export function padPngToSize(bytes, targetBytes) {
  checkSig(bytes);
  if (bytes.length >= targetBytes) return bytes;
  const need = Math.max(20, targetBytes - bytes.length); // chunk overhead 12 + "Comment\0" 8
  const dataLen = need - 12;
  const data = new Uint8Array(dataLen);
  const key = 'Comment\0';
  for (let i = 0; i < key.length; i++) data[i] = key.charCodeAt(i);
  for (let i = key.length; i < dataLen; i++) data[i] = 0x20;
  const chunk = makeChunk('tEXt', data);
  const idat = listChunks(bytes).find((c) => c.type === 'IDAT');
  const at = idat.offset;
  return concat([bytes.subarray(0, at), chunk, bytes.subarray(at)]);
}

function concat(parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export function readPngSize(bytes) {
  checkSig(bytes);
  return { w: u32(bytes, 16), h: u32(bytes, 20) };
}
