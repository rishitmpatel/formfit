// Pixel-level enhancements on RGBA ImageData-like objects {data:Uint8ClampedArray,width,height}.
// Pure and DOM-free so they can be unit tested in Node.

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

export function luma(r, g, b) { return 0.299 * r + 0.587 * g + 0.114 * b; }

/** brightness, contrast in -100..100 (0 = unchanged). */
export function applyBrightnessContrast(img, brightness = 0, contrast = 0) {
  if (!brightness && !contrast) return img;
  const d = img.data;
  const c = contrast / 100;
  const f = c >= 0 ? 1 + c * 1.5 : 1 + c * 0.8;
  const add = brightness * 1.6;
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) lut[i] = clamp255((i - 128) * f + 128 + add);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]];
  }
  return img;
}

/** Median of a number array (copy). */
function median(a) {
  const s = Float64Array.from(a).sort();
  return s.length ? s[s.length >> 1] : 0;
}

/** Estimate background colour from a thin border strip. Returns {r,g,b,spread}. */
export function estimateBorderColor(img, strip = 0.04) {
  const { data, width: w, height: h } = img;
  const sx = Math.max(2, Math.round(w * strip)), sy = Math.max(2, Math.round(h * strip));
  const R = [], G = [], B = [];
  const take = (x, y) => { const i = (y * w + x) * 4; R.push(data[i]); G.push(data[i + 1]); B.push(data[i + 2]); };
  for (let y = 0; y < sy; y++) for (let x = 0; x < w; x += 2) take(x, y);
  for (let x = 0; x < sx; x++) for (let y = sy; y < h; y += 2) { take(x, y); take(w - 1 - x, y); }
  const r = median(R), g = median(G), b = median(B);
  // spread = how much the border varies (median absolute deviation of luma)
  const L = R.map((v, i) => luma(v, G[i], B[i]));
  const ml = median(L);
  const spread = median(L.map((v) => Math.abs(v - ml)));
  return { r, g, b, spread };
}

/**
 * Conservative "whiten background": a flood fill from the image border through pixels that are
 * close to the border colour (and change slowly), then a feathered blend toward white.
 * Skips the job (returns {applied:false}) if the border is dark or busy.
 */
export function whitenBackground(img, { strength = 1, maxBorderSpread = 18 } = {}) {
  const { data, width: w, height: h } = img;
  const bg = estimateBorderColor(img);
  const bgL = luma(bg.r, bg.g, bg.b);
  if (bgL < 120 || bg.spread > maxBorderSpread) return { applied: false, reason: bgL < 120 ? 'dark' : 'busy', fraction: 0 };

  const n = w * h;
  const mask = new Uint8Array(n);       // 1 = background
  const stack = new Int32Array(n);
  let sp = 0;
  const ABS_TOL = 46;   // max colour distance from the border colour
  const STEP_SUM = 14;  // max summed RGB change between neighbouring pixels (lets gradients through)

  const dist = (i) => {
    const j = i * 4;
    return Math.abs(data[j] - bg.r) + Math.abs(data[j + 1] - bg.g) + Math.abs(data[j + 2] - bg.b);
  };
  const stepDist = (i, k) => {
    const a = i * 4, b = k * 4;
    return Math.abs(data[a] - data[b]) + Math.abs(data[a + 1] - data[b + 1]) + Math.abs(data[a + 2] - data[b + 2]);
  };
  const seed = (x, y) => {
    const i = y * w + x;
    if (!mask[i] && dist(i) <= ABS_TOL) { mask[i] = 1; stack[sp++] = i; }
  };
  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
  for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }
  const tryPush = (i, k) => {
    if (mask[k]) return;
    if (dist(k) <= ABS_TOL && stepDist(i, k) <= STEP_SUM) { mask[k] = 1; stack[sp++] = k; }
  };
  while (sp) {
    const i = stack[--sp];
    const x = i % w, y = (i / w) | 0;
    if (x > 0) tryPush(i, i - 1);
    if (x < w - 1) tryPush(i, i + 1);
    if (y > 0) tryPush(i, i - w);
    if (y < h - 1) tryPush(i, i + w);
  }

  // Erode by 2px so we never eat into hair / shoulders, then feather with a box blur.
  let m = Float32Array.from(mask);
  for (let pass = 0; pass < 2; pass++) m = erode(m, w, h);
  m = boxBlur(boxBlur(m, w, h, 2), w, h, 2);

  let changed = 0;
  for (let i = 0; i < n; i++) {
    const a = m[i] * strength;
    if (a <= 0.003) continue;
    const j = i * 4;
    data[j] = data[j] + (255 - data[j]) * a;
    data[j + 1] = data[j + 1] + (255 - data[j + 1]) * a;
    data[j + 2] = data[j + 2] + (255 - data[j + 2]) * a;
    if (a > 0.5) changed++;
  }
  return { applied: true, fraction: changed / n, bg };
}

function erode(src, w, h) {
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!src[i]) continue;
      // keep image border pixels as they are, so the white reaches the edge
      let ok = 1;
      if (x > 0 && !src[i - 1]) ok = 0;
      else if (x < w - 1 && !src[i + 1]) ok = 0;
      else if (y > 0 && !src[i - w]) ok = 0;
      else if (y < h - 1 && !src[i + w]) ok = 0;
      out[i] = ok;
    }
  }
  return out;
}

function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const k = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / k;
      acc += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / k;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

/**
 * "Clean signature": grayscale + adaptive (local-mean) threshold.
 * Returns {cov: Uint8Array (0..255 ink coverage), width, height}.
 */
export function inkCoverage(img, { window: win, sensitivity = 1 } = {}) {
  const { data, width: w, height: h } = img;
  const gray = new Float32Array(w * h);
  for (let i = 0, j = 0; i < gray.length; i++, j += 4) gray[i] = luma(data[j], data[j + 1], data[j + 2]);

  // integral image for fast local means
  const W1 = w + 1;
  const integ = new Float64Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += gray[y * w + x];
      integ[(y + 1) * W1 + x + 1] = integ[y * W1 + x + 1] + row;
    }
  }
  const r = Math.max(6, Math.round((win || Math.min(w, h) / 10) / 2));
  const cov = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const area = (x1 - x0) * (y1 - y0);
      const sum = integ[y1 * W1 + x1] - integ[y0 * W1 + x1] - integ[y1 * W1 + x0] + integ[y0 * W1 + x0];
      const mean = sum / area;
      // how much darker than the local paper? relative to the paper brightness
      const rel = mean > 1 ? (mean - gray[y * w + x]) / mean : 0;
      const lo = 0.10 / sensitivity, hi = 0.30 / sensitivity;
      let c = (rel - lo) / (hi - lo);
      c = c < 0 ? 0 : c > 1 ? 1 : c;
      cov[y * w + x] = Math.round(c * c * (3 - 2 * c) * 255);
    }
  }
  return { cov, width: w, height: h };
}

/** Bounding box of solid ink (ignores isolated specks). Returns {x,y,w,h} or null. */
export function inkBBox(cov, w, h, { threshold = 128 } = {}) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (cov[i] < threshold) continue;
      // needs an inked neighbour -> filters single-pixel dust
      if (cov[i - 1] < threshold && cov[i + 1] < threshold && cov[i - w] < threshold && cov[i + w] < threshold) continue;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Fraction of pixels that are ink (for "did this find a signature at all?"). */
export function inkFraction(cov, threshold = 128) {
  let n = 0;
  for (let i = 0; i < cov.length; i++) if (cov[i] >= threshold) n++;
  return n / cov.length;
}

/** Turn coverage into a gray RGBA image: white paper, ink colour `ink` (0..255 gray). */
export function coverageToImage(cov, w, h, ink = 24) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, j = 0; i < cov.length; i++, j += 4) {
    const v = 255 - (cov[i] / 255) * (255 - ink);
    data[j] = data[j + 1] = data[j + 2] = v;
    data[j + 3] = 255;
  }
  return { data, width: w, height: h };
}

/**
 * Scanner shadows, paper edges and page corners show up as "ink" along the border of a photo.
 * 1) ignore everything within `band` (fraction of each side) of the frame edge;
 * 2) drop big solid blobs (area > 1% of the frame and more than 30% filled) such as shadow strips;
 * 3) drop thin pieces that lie entirely inside the outer 18% of the frame (paper edges, corners).
 * Mutates and returns cov.
 */
export function suppressEdgeArtifacts(cov, w, h, { band = 0.05 } = {}) {
  const bx = Math.round(w * band), by = Math.round(h * band);
  for (let y = 0; y < h; y++) {
    const edgeY = y < by || y >= h - by;
    for (let x = 0; x < w; x++) if (edgeY || x < bx || x >= w - bx) cov[y * w + x] = 0;
  }
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const kill = new Uint8Array(w * h);
  let anyKill = false;
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || cov[s] < 32) continue;
    let sp = 0, area = 0, minX = w, maxX = 0, minY = h, maxY = 0;
    const members = [];
    stack[sp++] = s; seen[s] = 1;
    while (sp) {
      const i = stack[--sp];
      members.push(i);
      area++;
      const x = i % w, y = (i / w) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const k = ny * w + nx;
        if (!seen[k] && cov[k] >= 32) { seen[k] = 1; stack[sp++] = k; }
      }
    }
    const bboxArea = (maxX - minX + 1) * (maxY - minY + 1);
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    // thin pieces that sit entirely inside the outer 18% of the frame: paper edges, corners, shadows
    const Z = 0.18;
    const inZone = maxX < Z * w || minX > (1 - Z) * w || maxY < Z * h || minY > (1 - Z) * h;
    const thin = Math.min(bw / w, bh / h) < 0.06;
    const vLine = inZone && thin;
    const hLine = false;
    if (vLine || hLine || (area > 0.01 * w * h && area / bboxArea > 0.3)) {
      for (const i of members) kill[i] = 1;
      anyKill = true;
    }
  }
  if (anyKill) {
    // dilate the kill mask by 3px so the soft edge of the blob goes too
    for (let pass = 0; pass < 3; pass++) {
      const next = kill.slice();
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (!kill[i] && (kill[i - 1] || kill[i + 1] || kill[i - w] || kill[i + w])) next[i] = 1;
      }
      kill.set(next);
    }
    for (let i = 0; i < kill.length; i++) if (kill[i]) cov[i] = 0;
  }
  return cov;
}
