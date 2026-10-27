// Browser-only pipeline: decode, render crops, enhance, encode to the exact size window.
import { theta } from './geometry.js';
import { applyBrightnessContrast, whitenBackground, inkCoverage, inkBBox, coverageToImage, suppressEdgeArtifacts } from './enhance.js';
import { setJfifDensity, padJpegToSize } from './jpeg.js';
import { setPngDpi, padPngToSize } from './png.js';
import { searchQuality, scaleLadder } from './search.js';
import { targetDims, minAllowedDims, effectiveLimits, canStepDown } from './validate.js';

const MAX_WORK_SIDE = 4096;

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function isHeic(file) {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name || '');
}

/** Decode a File into a canvas, honouring EXIF orientation and capping the working size. */
export async function decodeImage(file) {
  let bmp = null;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (e) {
    // Older browsers: <img> applies EXIF orientation by itself in modern engines
    try {
      bmp = await imgElementToBitmap(file);
    } catch (e2) {
      const err = new Error(isHeic(file) ? 'heic' : 'bad-image');
      err.code = isHeic(file) ? 'heic' : 'bad-image';
      throw err;
    }
  }
  let w = bmp.naturalWidth || bmp.width, h = bmp.naturalHeight || bmp.height;
  const k = Math.min(1, MAX_WORK_SIDE / Math.max(w, h));
  const c = makeCanvas(w * k, h * k);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  if (bmp.close) bmp.close();
  return { canvas: c, w: c.width, h: c.height, origW: w, origH: h };
}

function imgElementToBitmap(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
}

/**
 * Render the framed region of `src` into a new canvas of outW x outH.
 * `view` is relative to a frame of width frameW (frame aspect == out aspect).
 */
export function renderCrop(src, view, frameW, outW, outH, background = '#ffffff') {
  const out = makeCanvas(outW, outH);
  const ctx = out.getContext('2d');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, out.width, out.height);
  const k = out.width / frameW;
  const ksSrc = view.scale * k;      // output pixels per source pixel
  let cur = src;
  while (ksSrc * (src.width / cur.width) < 0.5 && Math.min(cur.width, cur.height) > 8) {
    const half = makeCanvas(Math.ceil(cur.width / 2), Math.ceil(cur.height / 2));
    const hctx = half.getContext('2d');
    hctx.imageSmoothingQuality = 'high';
    hctx.drawImage(cur, 0, 0, half.width, half.height);
    cur = half;
  }
  const fx = src.width / cur.width, fy = src.height / cur.height;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.save();
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate(theta(view));
  ctx.scale(ksSrc * fx, ksSrc * fy);
  ctx.translate(-view.cx / fx, -view.cy / fy);
  ctx.drawImage(cur, 0, 0);
  ctx.restore();
  return out;
}

/**
 * Full pipeline producing the final canvas at outW x outH.
 * opts: {brightness, contrast, whiten, clean, ink(bool: this preset is ink-on-paper)}
 * Returns {canvas, notes:[]}
 */
export function buildOutput(src, view, frameW, outW, outH, opts = {}) {
  const notes = [];
  if (opts.ink && opts.clean) {
    const workW = Math.min(1600, Math.max(outW * 3, 800));
    const workH = Math.round((workW * outH) / outW);
    const work = renderCrop(src, view, frameW, workW, workH);
    const wctx = work.getContext('2d', { willReadFrequently: true });
    const img = wctx.getImageData(0, 0, work.width, work.height);
    const { cov, width, height } = inkCoverage(img);
    suppressEdgeArtifacts(cov, width, height);
    const bb = inkBBox(cov, width, height);
    if (bb) {
      const covCanvas = makeCanvas(width, height);
      covCanvas.getContext('2d').putImageData(new ImageData(coverageToImage(cov, width, height, 24).data, width, height), 0, 0);
      const out = makeCanvas(outW, outH);
      const ctx = out.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, outW, outH);
      const padOut = Math.max(2, Math.round(Math.min(outW, outH) * 0.08));
      // a little air around the ink inside the work image so strokes are not clipped
      const air = Math.round(Math.max(bb.w, bb.h) * 0.01) + 1;
      const sx = Math.max(0, bb.x - air), sy = Math.max(0, bb.y - air);
      const sw = Math.min(width - sx, bb.w + air * 2), sh = Math.min(height - sy, bb.h + air * 2);
      const availW = outW - padOut * 2, availH = outH - padOut * 2;
      const sc = Math.min(availW / sw, availH / sh);
      const dw = sw * sc, dh = sh * sc;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(covCanvas, sx, sy, sw, sh, (outW - dw) / 2, (outH - dh) / 2, dw, dh);
      return { canvas: out, notes };
    }
    notes.push('noInk');
  }
  const canvas = renderCrop(src, view, frameW, outW, outH);
  const bc = opts.brightness || 0, cc = opts.contrast || 0;
  const wantWhiten = opts.whiten && !opts.ink;
  if (bc || cc || wantWhiten) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    applyBrightnessContrast(img, bc, cc);
    if (wantWhiten) {
      const r = whitenBackground(img);
      if (!r.applied) notes.push('whitenSkipped');
    }
    ctx.putImageData(img, 0, 0);
  }
  return { canvas, notes };
}

const toBlob = (canvas, type, q) => new Promise((resolve, reject) => {
  canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), type, q);
});

/**
 * Hit the exact size window.
 * @param preset      preset (or custom preset) object
 * @param aspect      w/h used for "free" presets
 * @param render      (w,h) => canvas   - renders the final picture at that size
 * @param opts        {padToMin, onProgress(text)}
 */
export async function exportToWindow(preset, aspect, render, opts = {}) {
  const padToMin = opts.padToMin !== false;
  const target = targetDims(preset, aspect);
  const isPng = preset.format === 'png';
  const dpi = preset.dpi || 72;
  const stepOk = canStepDown(preset, target);
  const floor = minAllowedDims(preset, target);
  const ladder = stepOk ? scaleLadder(0.2) : [1];
  let last = null;
  for (let li = 0; li < ladder.length; li++) {
    const s = ladder[li];
    const w = Math.round(target.w * s), h = Math.round(target.h * s);
    if (li > 0 && floor && (w < floor.w || h < floor.h)) break;
    const canvas = render(w, h);
    const { minBytes, maxBytes } = effectiveLimits(preset, w, h);
    let res;
    if (isPng) {
      const blob = await toBlob(canvas, 'image/png');
      const bytes = setPngDpi(new Uint8Array(await blob.arrayBuffer()), dpi);
      res = { bytes, quality: 1, status: bytes.length > maxBytes ? 'too-big' : bytes.length < minBytes ? 'below-min' : 'ok' };
    } else {
      const cache = new Map();
      const sizeAt = async (q) => {
        const blob = await toBlob(canvas, 'image/jpeg', q);
        const bytes = setJfifDensity(new Uint8Array(await blob.arrayBuffer()), dpi);
        cache.set(q, bytes);
        return bytes.length;
      };
      const r = await searchQuality(sizeAt, { minBytes, maxBytes });
      res = { bytes: cache.get(r.quality), quality: r.quality, status: r.status };
    }
    last = { ...res, w, h, dpi, stepped: li > 0, minBytes, maxBytes, format: isPng ? 'png' : 'jpg' };
    if (opts.onProgress) opts.onProgress(`${w} x ${h}`);
    if (res.status !== 'too-big') break;
  }
  // padding
  let padded = 0;
  if (last.status === 'below-min' && padToMin) {
    const goal = Math.min(last.minBytes + 256, last.maxBytes);
    const before = last.bytes.length;
    last.bytes = isPng ? padPngToSize(last.bytes, goal) : padJpegToSize(last.bytes, goal);
    padded = last.bytes.length - before;
    last.status = 'ok';
  }
  last.padded = padded;
  const mime = isPng ? 'image/png' : 'image/jpeg';
  last.blob = new Blob([last.bytes], { type: mime });
  return last;
}

export function fileNameFor(preset, r) {
  const kb = Math.round(r.bytes.length / 1024);
  const base = preset.kind === 'document' ? 'document' : preset.kind;
  return `${base}_${r.w}x${r.h}_${kb}KB.${r.format === 'png' ? 'png' : 'jpg'}`;
}

/** Try the browser FaceDetector API. Returns a bounding box in canvas coords, or null. */
export function faceDetectorAvailable() {
  return typeof window !== 'undefined' && 'FaceDetector' in window;
}
export async function detectFace(canvas) {
  const det = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 3 });
  const faces = await det.detect(canvas);
  if (!faces.length) return null;
  faces.sort((a, b) => b.boundingBox.width * b.boundingBox.height - a.boundingBox.width * a.boundingBox.height);
  const b = faces[0].boundingBox;
  return { x: b.x, y: b.y, w: b.width, h: b.height };
}
