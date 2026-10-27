// Unit conversion helpers (pure, no DOM).

export const MM_PER_INCH = 25.4;

// Size limits: sites disagree on whether 1 KB is 1000 or 1024 bytes.
// To pass both kinds of checker we aim for the STRICTER end on each side:
//   maximum  -> KB * 1000   (a file under this is under the limit either way)
//   minimum  -> KB * 1024   (a file over this is over the limit either way)
export const BYTES_PER_KB_MAX = 1000;
export const BYTES_PER_KB_MIN = 1024;

export function maxBytesFromKB(kb) {
  return kb == null ? Infinity : Math.floor(kb * BYTES_PER_KB_MAX);
}
export function minBytesFromKB(kb) {
  return kb == null ? 0 : Math.ceil(kb * BYTES_PER_KB_MIN);
}

/** Convert a length in the given unit to millimetres. unit: mm | cm | in */
export function toMm(value, unit) {
  switch (unit) {
    case 'mm': return value;
    case 'cm': return value * 10;
    case 'in': return value * MM_PER_INCH;
    default: throw new Error('Unknown length unit: ' + unit);
  }
}

export function mmToPx(mm, dpi) {
  return Math.round((mm / MM_PER_INCH) * dpi);
}

export function pxToMm(px, dpi) {
  return (px / dpi) * MM_PER_INCH;
}

/** Physical length (value+unit) -> pixels at dpi. */
export function physToPx(value, unit, dpi) {
  return mmToPx(toMm(value, unit), dpi);
}

/** Resolve a size spec to pixels.
 *  {unit:'px', w, h}  or  {unit:'mm'|'cm'|'in', w, h, dpi} */
export function sizeToPx(spec) {
  if (spec.unit === 'px') return { w: Math.round(spec.w), h: Math.round(spec.h) };
  if (!spec.dpi) throw new Error('dpi required for physical units');
  return { w: physToPx(spec.w, spec.unit, spec.dpi), h: physToPx(spec.h, spec.unit, spec.dpi) };
}

export function formatKB(bytes) {
  const kb = bytes / 1024;
  return (kb >= 100 ? kb.toFixed(0) : kb.toFixed(1)).replace(/\.0$/, '');
}
