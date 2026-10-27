// Preset validation, target-size maths and result checking. Pure (no DOM).
import { sizeToPx, minBytesFromKB, maxBytesFromKB, formatKB } from './units.js';

export const KINDS = ['photo', 'signature', 'thumb', 'document'];
export const FORMATS = ['jpg', 'png'];
export const RULES = ['exact', 'range', 'suggested', 'free'];

/** Return a list of problems with a preset definition (empty list = valid). */
export function validatePreset(p) {
  const e = [];
  const need = (cond, msg) => { if (!cond) e.push(`${p && p.id || '?'}: ${msg}`); };
  if (!p || typeof p !== 'object') return ['preset is not an object'];
  need(typeof p.id === 'string' && /^[a-z0-9-]+$/.test(p.id), 'id must be kebab-case');
  need(typeof p.name === 'string' && p.name.length > 2, 'name missing');
  need(KINDS.includes(p.kind), 'bad kind ' + p.kind);
  need(FORMATS.includes(p.format), 'bad format ' + p.format);
  need(RULES.includes(p.dimsRule), 'bad dimsRule ' + p.dimsRule);
  need(typeof p.verified === 'boolean', 'verified must be boolean');
  need(/^\d{4}-\d{2}-\d{2}$/.test(p.checked || ''), 'checked date missing');
  need(['exams', 'govid', 'visas', 'generic'].includes(p.group), 'bad group');
  if (p.dimsRule === 'free') {
    need(Number.isFinite(p.maxSide) && p.maxSide >= 100, 'free preset needs maxSide');
  } else {
    const hasPx = p.px && p.px.w > 0 && p.px.h > 0;
    const hasMm = p.mm && p.mm.w > 0 && p.mm.h > 0 && p.dpi > 0;
    need(hasPx || hasMm, 'needs px or mm+dpi');
  }
  if (p.dimsRule === 'range') {
    need(p.minPx && p.maxPx, 'range needs minPx and maxPx');
    if (p.minPx && p.maxPx) {
      const t = targetDims(p);
      need(t.w >= p.minPx.w && t.h >= p.minPx.h && t.w <= p.maxPx.w && t.h <= p.maxPx.h, 'target outside range');
    }
  }
  if (p.kb) {
    need(p.kb.min == null || p.kb.min >= 0, 'bad kb.min');
    need(p.kb.max == null || p.kb.max > 0, 'bad kb.max');
    if (p.kb.min != null && p.kb.max != null) need(p.kb.min <= p.kb.max, 'kb.min > kb.max');
  }
  need(p.kb !== undefined, 'kb object required (may be empty)');
  if (!p.generic) {
    need(p.source && /^https:\/\//.test(p.source.url || ''), 'source.url (https) required');
    need(p.source && typeof p.source.label === 'string', 'source.label required');
    need(/^https:\/\//.test(p.officialUrl || ''), 'officialUrl required');
  }
  need(typeof p.alsoCheck === 'string' && p.alsoCheck.length > 0, 'alsoCheck text required');
  return e;
}

/** All presets together: unique ids and resolvable `next` links. */
export function validateAll(presets) {
  const errors = [];
  const ids = new Set();
  for (const p of presets) {
    if (ids.has(p.id)) errors.push('duplicate id ' + p.id);
    ids.add(p.id);
    errors.push(...validatePreset(p));
  }
  for (const p of presets) if (p.next && !ids.has(p.next)) errors.push(`${p.id}: next -> unknown ${p.next}`);
  return errors;
}

/** The pixel size formfit aims for. Free presets have no fixed size: pass `aspect` (w/h). */
export function targetDims(p, aspect = 3 / 4) {
  if (p.dimsRule === 'free') {
    const L = p.maxSide;
    return aspect >= 1 ? { w: L, h: Math.max(1, Math.round(L / aspect)) } : { w: Math.max(1, Math.round(L * aspect)), h: L };
  }
  if (p.px) return { w: p.px.w, h: p.px.h };
  return sizeToPx({ unit: 'mm', w: p.mm.w, h: p.mm.h, dpi: p.dpi });
}

/** Smallest dimensions we may step down to when the file is too heavy. null = may not step down. */
export function minAllowedDims(p, target) {
  if (p.dimsRule === 'exact') return null;
  if (p.dimsRule === 'range') return { ...p.minPx };
  // suggested / free: never go below 120px on the short side or 25% of target
  const f = 0.25;
  return { w: Math.max(60, Math.round(target.w * f)), h: Math.max(60, Math.round(target.h * f)) };
}

export function canStepDown(p, target) {
  const m = minAllowedDims(p, target);
  return !!m && (m.w < target.w || m.h < target.h);
}

/** Byte window for the given output size. Applies the "compression ratio no more than N:1" rule. */
export function effectiveLimits(p, w, h) {
  let minBytes = minBytesFromKB(p.kb && p.kb.min);
  const maxBytes = maxBytesFromKB(p.kb && p.kb.max);
  if (p.maxCompressionRatio) {
    const ratioMin = Math.ceil((w * h * 3) / p.maxCompressionRatio) + 1024; // +1 KB safety
    minBytes = Math.max(minBytes, ratioMin);
  }
  return { minBytes, maxBytes };
}

/**
 * Build the tick list for the result screen.
 * result: {w,h,bytes,dpi,format,quality}
 * Returns [{id, ok: true|false|null, label, detail}] where ok:null means "informational".
 */
export function checkResult(p, result, t = (k) => k) {
  const rows = [];
  const target = targetDims(p, result.w / result.h);
  const fmtWant = p.format === 'png' ? 'PNG' : 'JPG';
  const fmtGot = result.format === 'png' ? 'PNG' : 'JPG';
  rows.push({ id: 'format', ok: fmtWant === fmtGot, label: 'Format', detail: `${fmtGot} (needs ${fmtWant})` });

  // Size window
  const { minBytes, maxBytes } = effectiveLimits(p, result.w, result.h);
  const kbWant = [];
  if (p.kb && p.kb.min != null) kbWant.push(`min ${p.kb.min} KB`);
  if (p.kb && p.kb.max != null) kbWant.push(`max ${p.kb.max} KB`);
  if (p.maxCompressionRatio) kbWant.push(`ratio under ${p.maxCompressionRatio}:1`);
  const sizeOk = result.bytes >= minBytes && result.bytes <= maxBytes;
  if (kbWant.length) {
    rows.push({ id: 'size', ok: sizeOk, label: 'File size', detail: `${formatKB(result.bytes)} KB (${kbWant.join(', ')})` });
  } else {
    rows.push({ id: 'size', ok: null, label: 'File size', detail: `${formatKB(result.bytes)} KB (no limit stated)` });
  }

  // Dimensions
  const dimTxt = `${result.w} x ${result.h} px`;
  if (p.dimsRule === 'exact') {
    rows.push({ id: 'dims', ok: result.w === target.w && result.h === target.h, label: 'Dimensions', detail: `${dimTxt} (needs ${target.w} x ${target.h})` });
  } else if (p.dimsRule === 'range') {
    const ok = result.w >= p.minPx.w && result.h >= p.minPx.h && result.w <= p.maxPx.w && result.h <= p.maxPx.h;
    rows.push({ id: 'dims', ok, label: 'Dimensions', detail: `${dimTxt} (allowed ${p.minPx.w}x${p.minPx.h} to ${p.maxPx.w}x${p.maxPx.h})` });
  } else {
    rows.push({ id: 'dims', ok: null, label: 'Dimensions', detail: `${dimTxt} (no pixel size required)` });
  }
  if (p.square) rows.push({ id: 'square', ok: result.w === result.h, label: 'Square', detail: result.w === result.h ? 'Yes' : 'No' });

  // DPI
  if (p.dpi || p.dpiRequired) {
    const want = p.dpi || 72;
    rows.push({ id: 'dpi', ok: p.dpiRequired ? result.dpi === want : null, label: 'DPI', detail: `${result.dpi} (header)` });
  }
  return rows;
}

/** Overall verdict: true if every row with ok !== null is true. */
export function allPass(rows) {
  return rows.every((r) => r.ok !== false);
}
