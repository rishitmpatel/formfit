// Quality search: find the highest JPEG quality whose file stays at/below maxBytes.
// `sizeAt(q)` is async and returns the FINAL size in bytes at quality q (after DPI patching),
// so the search accounts for every byte we later add.

export const Q_MIN = 0.05;
export const Q_MAX = 0.98;

/**
 * @returns {Promise<{quality:number,size:number,status:'ok'|'below-min'|'too-big',steps:number}>}
 *  ok         : size within [minBytes, maxBytes]
 *  below-min  : even the max quality is smaller than minBytes (caller may pad)
 *  too-big    : even the min quality is larger than maxBytes (caller must reduce dimensions)
 */
export async function searchQuality(sizeAt, { minBytes = 0, maxBytes = Infinity, lo = Q_MIN, hi = Q_MAX, iterations = 9 } = {}) {
  let steps = 0;
  const probe = async (q) => { steps++; return sizeAt(q); };

  const sHi = await probe(hi);
  if (sHi <= maxBytes) {
    return { quality: hi, size: sHi, status: sHi >= minBytes ? 'ok' : 'below-min', steps };
  }
  const sLo = await probe(lo);
  if (sLo > maxBytes) return { quality: lo, size: sLo, status: 'too-big', steps };

  let best = { quality: lo, size: sLo };
  let a = lo, b = hi;
  for (let i = 0; i < iterations; i++) {
    const mid = Math.round(((a + b) / 2) * 1000) / 1000;
    if (mid <= a || mid >= b) break;
    const s = await probe(mid);
    if (s <= maxBytes) { best = { quality: mid, size: s }; a = mid; } else { b = mid; }
  }
  return { ...best, status: best.size >= minBytes ? 'ok' : 'below-min', steps };
}

/** Descending scale factors tried when a file cannot reach maxBytes at the chosen dimensions. */
export function scaleLadder(minScale = 0.25) {
  const all = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.33, 0.25, 0.2];
  return all.filter((s) => s >= minScale - 1e-9);
}
