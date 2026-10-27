// Pure byte-level JPEG helpers: JFIF density, COM padding, sanity checks.

const SOI = [0xff, 0xd8];

function isJfif(b, off) {
  // off points at 0xFF of an APP0 marker
  return b[off] === 0xff && b[off + 1] === 0xe0 &&
    b[off + 4] === 0x4a && b[off + 5] === 0x46 && b[off + 6] === 0x49 && b[off + 7] === 0x46 && b[off + 8] === 0x00;
}

function checkSoi(b) {
  if (!(b instanceof Uint8Array) || b.length < 4 || b[0] !== SOI[0] || b[1] !== SOI[1]) {
    throw new Error('Not a JPEG (missing SOI)');
  }
}

/** Return DPI stored in the JFIF APP0 header: {units, x, y} or null. units: 0 none, 1 dpi, 2 dpcm */
export function readJfifDensity(bytes) {
  checkSoi(bytes);
  if (!isJfif(bytes, 2)) return null;
  return {
    units: bytes[13],
    x: (bytes[14] << 8) | bytes[15],
    y: (bytes[16] << 8) | bytes[17],
  };
}

/** Return a copy of the JPEG with JFIF density = dpi (units: dots per inch). */
export function setJfifDensity(bytes, dpi) {
  checkSoi(bytes);
  const d = Math.max(1, Math.min(65535, Math.round(dpi)));
  if (isJfif(bytes, 2)) {
    const out = bytes.slice();
    out[13] = 1;
    out[14] = d >> 8; out[15] = d & 255;
    out[16] = d >> 8; out[17] = d & 255;
    return out;
  }
  // No JFIF header (e.g. Exif-first file). Insert a fresh APP0 right after SOI.
  const app0 = new Uint8Array([
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, // APP0 'JFIF\0'
    0x01, 0x01,                                            // version 1.01
    0x01, d >> 8, d & 255, d >> 8, d & 255,                // units, Xdensity, Ydensity
    0x00, 0x00,                                            // no thumbnail
  ]);
  const out = new Uint8Array(bytes.length + app0.length);
  out.set(bytes.subarray(0, 2), 0);
  out.set(app0, 2);
  out.set(bytes.subarray(2), 2 + app0.length);
  return out;
}

/** Offset where extra segments (COM) may be inserted: right after SOI + JFIF APP0 (if any). */
function insertionOffset(bytes) {
  if (isJfif(bytes, 2)) return 2 + 2 + ((bytes[4] << 8) | bytes[5]);
  return 2;
}

/** Build COM segments totalling exactly `total` bytes (each has 4 bytes of overhead).
 *  total must be >= 4. */
function buildComSegments(total) {
  const MAX_PAYLOAD = 65533;
  const parts = [];
  let left = total;
  while (left > 0) {
    let seg = Math.min(left, MAX_PAYLOAD + 4);
    // never leave a remainder in 1..3 bytes (can't form a segment)
    if (left - seg > 0 && left - seg < 4) seg -= 4;
    parts.push(seg);
    left -= seg;
  }
  const out = new Uint8Array(total);
  const text = 'formfit padding - this comment only adds bytes so the file reaches the minimum size. ';
  let o = 0;
  for (const seg of parts) {
    out[o] = 0xff; out[o + 1] = 0xfe;
    const len = seg - 2;
    out[o + 2] = len >> 8; out[o + 3] = len & 255;
    for (let i = 4; i < seg; i++) out[o + i] = text.charCodeAt((i - 4) % text.length);
    o += seg;
  }
  return out;
}

/** Pad a JPEG with COM segments so it is at least targetBytes long. Returns a new array (or the
 *  same one if it is already big enough). The result is still a valid JPEG. */
export function padJpegToSize(bytes, targetBytes) {
  checkSoi(bytes);
  if (bytes.length >= targetBytes) return bytes;
  const need = Math.max(4, targetBytes - bytes.length);
  const com = buildComSegments(need);
  const at = insertionOffset(bytes);
  const out = new Uint8Array(bytes.length + com.length);
  out.set(bytes.subarray(0, at), 0);
  out.set(com, at);
  out.set(bytes.subarray(at), at + com.length);
  return out;
}

/** Cheap structural sanity check: SOI, EOI, walk segments up to SOS. */
export function looksLikeValidJpeg(bytes) {
  try { checkSoi(bytes); } catch { return false; }
  if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) return false;
  let i = 2;
  while (i < bytes.length - 1) {
    if (bytes[i] !== 0xff) return false;
    const m = bytes[i + 1];
    if (m === 0xda) return true; // reached scan data
    if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { i += 2; continue; }
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (len < 2) return false;
    i += 2 + len;
  }
  return false;
}

/** Read width/height from the SOF marker. */
export function readJpegSize(bytes) {
  checkSoi(bytes);
  let i = 2;
  while (i < bytes.length - 8) {
    if (bytes[i] !== 0xff) { i++; continue; }
    const m = bytes[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { h: (bytes[i + 5] << 8) | bytes[i + 6], w: (bytes[i + 7] << 8) | bytes[i + 8] };
    }
    if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { i += 2; continue; }
    i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
  }
  return null;
}
