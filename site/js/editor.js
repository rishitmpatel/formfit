// Crop editor: a canvas with a fixed-aspect frame. Drag/pinch/wheel/keyboard.
import { clampView, fitView, panBy, zoomAt, frameInContainer, minScale, maxScale, theta, rotate } from './geometry.js';

export class CropEditor {
  constructor(canvas, { onChange } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onChange = onChange || (() => {});
    this.src = null;            // canvas with the picture
    this.aspect = 1;
    this.allowMargins = false;
    this.guide = null;          // 'face' | null
    this.view = { cx: 0, cy: 0, scale: 1, rot90: 0, straighten: 0 };
    this.frame = { x: 0, y: 0, w: 100, h: 100 };
    this.pointers = new Map();
    this.raf = 0;
    this._bind();
    this.resize();
    if (window.ResizeObserver) new ResizeObserver(() => this.resize()).observe(canvas.parentElement || canvas);
  }

  setImage(srcCanvas) {
    this.src = srcCanvas;
    this.view = { cx: srcCanvas.width / 2, cy: srcCanvas.height / 2, scale: 1, rot90: 0, straighten: 0 };
    this.fit();
  }

  setAspect(aspect) { this.aspect = aspect; this.resize(); }
  setAllowMargins(v) { this.allowMargins = v; if (this.src) { this._clamp(); this.draw(); } }
  setGuide(g) { this.guide = g; this.draw(); }

  get frameSize() { return { w: this.frame.w, h: this.frame.h }; }

  resize() {
    const box = (this.canvas.parentElement || this.canvas).getBoundingClientRect();
    const cw = Math.max(120, Math.round(box.width));
    const ch = Math.max(120, Math.round(box.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.dpr = dpr;
    this.cssW = cw; this.cssH = ch;
    this.canvas.width = Math.round(cw * dpr);
    this.canvas.height = Math.round(ch * dpr);
    this.canvas.style.width = cw + 'px';
    this.canvas.style.height = ch + 'px';
    const old = this.frame;
    this.frame = frameInContainer(cw, ch, this.aspect, Math.min(24, Math.round(Math.min(cw, ch) * 0.06)));
    if (this.src && old.w > 0) {
      // keep the same picture portion visible when the frame size changes
      this.view = { ...this.view, scale: this.view.scale * (this.frame.w / old.w) };
      this._clamp();
    }
    this.draw();
  }

  _clamp() {
    if (!this.src) return;
    this.view = clampView(this.view, this.frame, this.src.width, this.src.height, this.allowMargins);
  }

  fit() {
    if (!this.src) return;
    this.view = fitView({ ...this.view, straighten: 0 }, this.frame, this.src.width, this.src.height, this.allowMargins);
    this._changed();
  }

  rotate90() {
    this.view = { ...this.view, rot90: (this.view.rot90 + 1) % 4 };
    this.view = fitView(this.view, this.frame, this.src.width, this.src.height, this.allowMargins);
    this._changed();
  }

  setStraighten(deg) {
    this.view = { ...this.view, straighten: deg };
    this._clamp();
    this._changed();
  }

  /** zoom position 0..1 (log scale between min and max zoom) */
  get zoomPos() {
    if (!this.src) return 0;
    const t = theta(this.view);
    const lo = minScale(this.frame, this.src.width, this.src.height, t, this.allowMargins);
    const hi = maxScale(this.frame, this.src.width, this.src.height, t);
    return Math.log(this.view.scale / lo) / Math.log(hi / lo);
  }
  setZoomPos(p) {
    if (!this.src) return;
    const t = theta(this.view);
    const lo = minScale(this.frame, this.src.width, this.src.height, t, this.allowMargins);
    const hi = maxScale(this.frame, this.src.width, this.src.height, t);
    this.view = { ...this.view, scale: lo * Math.pow(hi / lo, p) };
    this._clamp();
    this._changed();
  }

  zoomBy(f, qx = 0, qy = 0) {
    this.view = zoomAt(this.view, f, qx, qy);
    this._clamp();
    this._changed();
  }

  /** Put a detected face (centre px,py and box height in source px) where the guide oval is. */
  centreOnFace(px, py, faceH) {
    if (!this.src) return;
    const f = this.frame;
    const scale = (0.52 * f.h) / faceH;
    const [dx, dy] = rotate(0, 0.03 * f.h, -theta(this.view));
    this.view = { ...this.view, scale, cx: px - dx / scale, cy: py - dy / scale };
    this._clamp();
    this._changed();
  }

  _changed() { this.draw(); this.onChange(this.view); }

  getState() { return { view: { ...this.view }, frame: { ...this.frame } }; }

  draw() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this._draw(); });
  }

  _draw() {
    const { ctx, canvas, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cs = getComputedStyle(this.canvas);
    ctx.fillStyle = cs.getPropertyValue('--editor-bg').trim() || '#1b2220';
    ctx.fillRect(0, 0, this.cssW, this.cssH);
    const f = this.frame;
    if (this.src) {
      ctx.save();
      ctx.translate(f.x + f.w / 2, f.y + f.h / 2);
      ctx.rotate(theta(this.view));
      ctx.scale(this.view.scale, this.view.scale);
      ctx.translate(-this.view.cx, -this.view.cy);
      ctx.imageSmoothingQuality = 'medium';
      // white paper behind the picture so margins (signature mode) read as the final background
      ctx.drawImage(this.src, 0, 0);
      ctx.restore();
    }
    // dim outside the frame
    ctx.save();
    ctx.fillStyle = 'rgba(8,12,11,0.58)';
    ctx.beginPath();
    ctx.rect(0, 0, this.cssW, this.cssH);
    ctx.rect(f.x, f.y, f.w, f.h);
    ctx.fill('evenodd');
    ctx.restore();
    // frame border + corner marks
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(f.x, f.y, f.w, f.h);
    const L = Math.min(22, f.w / 5, f.h / 5);
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (const [x, y, dx, dy] of [[f.x, f.y, 1, 1], [f.x + f.w, f.y, -1, 1], [f.x, f.y + f.h, 1, -1], [f.x + f.w, f.y + f.h, -1, -1]]) {
      ctx.moveTo(x, y + dy * L); ctx.lineTo(x, y); ctx.lineTo(x + dx * L, y);
    }
    ctx.stroke();
    if (this.guide === 'face') this._drawFaceGuide(ctx, f);
  }

  _drawFaceGuide(ctx, f) {
    const cx = f.x + f.w / 2;
    const ry = f.h * 0.34;
    const rx = Math.min(ry * 0.78, f.w * 0.42);
    const cy = f.y + f.h * 0.46;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    // eye line
    const ey = f.y + f.h * 0.40;
    ctx.beginPath();
    ctx.moveTo(f.x + f.w * 0.18, ey); ctx.lineTo(f.x + f.w * 0.82, ey);
    ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------ input
  _bind() {
    const c = this.canvas;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', (e) => {
      if (!this.src) return;
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this._gesture = null;
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.src || !this.pointers.has(e.pointerId)) return;
      const prev = this.pointers.get(e.pointerId);
      const cur = { x: e.clientX, y: e.clientY };
      if (this.pointers.size === 1) {
        this.view = panBy(this.view, cur.x - prev.x, cur.y - prev.y);
        this.pointers.set(e.pointerId, cur);
      } else if (this.pointers.size === 2) {
        const other = [...this.pointers.entries()].find(([id]) => id !== e.pointerId)[1];
        const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
        const d1 = Math.hypot(cur.x - other.x, cur.y - other.y);
        const m0 = { x: (prev.x + other.x) / 2, y: (prev.y + other.y) / 2 };
        const m1 = { x: (cur.x + other.x) / 2, y: (cur.y + other.y) / 2 };
        const r = c.getBoundingClientRect();
        const qx = m1.x - r.left - (this.frame.x + this.frame.w / 2);
        const qy = m1.y - r.top - (this.frame.y + this.frame.h / 2);
        this.view = panBy(this.view, m1.x - m0.x, m1.y - m0.y);
        if (d0 > 0) this.view = zoomAt(this.view, d1 / d0, qx, qy);
        this.pointers.set(e.pointerId, cur);
      }
      this._clamp();
      this._changed();
    });
    const up = (e) => { this.pointers.delete(e.pointerId); };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => {
      if (!this.src) return;
      e.preventDefault();
      const r = c.getBoundingClientRect();
      const qx = e.clientX - r.left - (this.frame.x + this.frame.w / 2);
      const qy = e.clientY - r.top - (this.frame.y + this.frame.h / 2);
      this.zoomBy(Math.exp(-e.deltaY * 0.0015), qx, qy);
    }, { passive: false });
    c.addEventListener('keydown', (e) => {
      if (!this.src) return;
      const step = e.shiftKey ? 40 : 10;
      let handled = true;
      switch (e.key) {
        case 'ArrowLeft': this.view = panBy(this.view, step, 0); break;
        case 'ArrowRight': this.view = panBy(this.view, -step, 0); break;
        case 'ArrowUp': this.view = panBy(this.view, 0, step); break;
        case 'ArrowDown': this.view = panBy(this.view, 0, -step); break;
        case '+': case '=': this.view = zoomAt(this.view, 1.08, 0, 0); break;
        case '-': case '_': this.view = zoomAt(this.view, 1 / 1.08, 0, 0); break;
        case 'r': case 'R': this.rotate90(); return;
        default: handled = false;
      }
      if (handled) { e.preventDefault(); this._clamp(); this._changed(); }
    });
  }
}
