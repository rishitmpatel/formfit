// Crop-view geometry (pure maths).
//
// A "view" describes how the source image sits behind a fixed crop frame:
//   cx, cy     : the image point (source pixels) shown at the CENTRE of the frame
//   scale      : screen pixels per source pixel
//   rot90      : 0..3 quarter turns
//   straighten : degrees, -10..10
// theta = rot90*90 + straighten.  screen = scale * R(theta) * (p - c)   (relative to frame centre)

const D2R = Math.PI / 180;
export const MAX_ZOOM_FACTOR = 10; // relative to the "cover" scale

export function theta(view) {
  return (view.rot90 * 90 + view.straighten) * D2R;
}

export function rotate(x, y, t) {
  const c = Math.cos(t), s = Math.sin(t);
  return [x * c - y * s, x * s + y * c];
}

/** Screen offset (from frame centre) -> source image point. */
export function screenToImage(view, qx, qy) {
  const [dx, dy] = rotate(qx, qy, -theta(view));
  return [view.cx + dx / view.scale, view.cy + dy / view.scale];
}

/** Source image point -> screen offset from the frame centre. */
export function imageToScreen(view, px, py) {
  const [x, y] = rotate(px - view.cx, py - view.cy, theta(view));
  return [x * view.scale, y * view.scale];
}

/** Smallest scale at which the (rotated) image still fully covers the frame. */
export function coverScale(frame, W, H, t) {
  const ac = Math.abs(Math.cos(t)), as = Math.abs(Math.sin(t));
  const extX = frame.w * ac + frame.h * as;
  const extY = frame.w * as + frame.h * ac;
  return Math.max(extX / W, extY / H);
}

/** Scale at which the whole (rotated) image fits inside the frame. */
export function containScale(frame, W, H, t) {
  const ac = Math.abs(Math.cos(t)), as = Math.abs(Math.sin(t));
  return Math.min(frame.w / (W * ac + H * as), frame.h / (W * as + H * ac));
}

export function minScale(frame, W, H, t, allowMargins) {
  const cover = coverScale(frame, W, H, t);
  return allowMargins ? Math.min(cover, containScale(frame, W, H, t)) * 0.8 : cover;
}

export function maxScale(frame, W, H, t) {
  return coverScale(frame, W, H, t) * MAX_ZOOM_FACTOR;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Keep the view legal: zoom within limits and (unless margins are allowed) the frame fully inside the image. */
export function clampView(view, frame, W, H, allowMargins = false) {
  const t = theta(view);
  const lo = minScale(frame, W, H, t, allowMargins);
  const hi = Math.max(lo, maxScale(frame, W, H, t));
  const scale = clamp(view.scale, lo, hi);
  let cx = view.cx, cy = view.cy;
  if (allowMargins) {
    cx = clamp(cx, 0, W);
    cy = clamp(cy, 0, H);
  } else {
    // exact: every frame corner must stay inside [0,W]x[0,H]
    let maxDx = -Infinity, maxDy = -Infinity, minDx = Infinity, minDy = Infinity;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const [dx, dy] = rotate((sx * frame.w) / 2, (sy * frame.h) / 2, -t);
      maxDx = Math.max(maxDx, dx / scale); minDx = Math.min(minDx, dx / scale);
      maxDy = Math.max(maxDy, dy / scale); minDy = Math.min(minDy, dy / scale);
    }
    const loX = -minDx, hiX = W - maxDx, loY = -minDy, hiY = H - maxDy;
    cx = loX > hiX ? (loX + hiX) / 2 : clamp(cx, loX, hiX);
    cy = loY > hiY ? (loY + hiY) / 2 : clamp(cy, loY, hiY);
  }
  return { ...view, cx, cy, scale };
}

/** Centre the image and fill the frame. */
export function fitView(view, frame, W, H, allowMargins = false) {
  const t = theta(view);
  const base = { ...view, cx: W / 2, cy: H / 2, scale: coverScale(frame, W, H, t) };
  return clampView(base, frame, W, H, allowMargins);
}

/** Pan by a screen delta (pixels) - dragging moves the image with the finger. */
export function panBy(view, dx, dy) {
  const [ix, iy] = rotate(dx, dy, -theta(view));
  return { ...view, cx: view.cx - ix / view.scale, cy: view.cy - iy / view.scale };
}

/** Zoom by a factor keeping the image point under screen offset (qx,qy) fixed. */
export function zoomAt(view, factor, qx, qy) {
  const [px, py] = screenToImage(view, qx, qy);
  const scale = view.scale * factor;
  const [dx, dy] = rotate(qx, qy, -theta(view));
  return { ...view, scale, cx: px - dx / scale, cy: py - dy / scale };
}

/** View that puts a box (in source pixels) centred in the frame with `fill` of the frame used by the box. */
export function viewForBox(view, frame, box, fill = 0.9) {
  const t = theta(view);
  // size of the box as it appears rotated, at scale 1
  const ac = Math.abs(Math.cos(t)), as = Math.abs(Math.sin(t));
  const bw = box.w * ac + box.h * as, bh = box.w * as + box.h * ac;
  const scale = Math.min((frame.w * fill) / bw, (frame.h * fill) / bh);
  return { ...view, cx: box.x + box.w / 2, cy: box.y + box.h / 2, scale };
}

/**
 * Fit a rectangle of aspect (w:h) inside a container with padding. Returns {x,y,w,h}.
 */
export function frameInContainer(cw, ch, aspect, pad = 16) {
  const aw = Math.max(10, cw - pad * 2), ah = Math.max(10, ch - pad * 2);
  let w = aw, h = aw / aspect;
  if (h > ah) { h = ah; w = ah * aspect; }
  return { x: (cw - w) / 2, y: (ch - h) / 2, w, h };
}

/** Output "scale" (output px per source px) for a given view/frame/out width. */
export function outputScale(view, frame, outW) {
  return view.scale * (outW / frame.w);
}
