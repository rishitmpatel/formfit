import { PRESETS, GROUPS, getPreset, CHECKED } from './presets.js';
import { t, setLang, getLang } from './js/i18n.js';
import { icon } from './js/icons.js';
import { targetDims, checkResult, allPass, validatePreset, canStepDown } from './js/validate.js';
import { sizeToPx, formatKB } from './js/units.js';
import { CropEditor } from './js/editor.js';
import { decodeImage, buildOutput, renderCrop, exportToWindow, fileNameFor, faceDetectorAvailable, detectFace } from './js/render.js';
import { screenToImage } from './js/geometry.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

const S = {
  step: 1,
  preset: null,
  groupFilter: 'all',
  query: '',
  openId: null,
  img: null,            // {canvas,w,h}
  aspect: 3 / 4,        // used by free presets
  opts: { brightness: 0, contrast: 0, whiten: false, clean: true, padToMin: true, guide: true },
  result: null,
  made: [],             // [{preset, url, name, bytes}]
  editor: null,
  token: 0,
};

// ------------------------------------------------------------------ helpers
const isInk = (p) => !!p && (p.ink || p.kind === 'signature' || p.kind === 'thumb');
const kindLabel = (k) => t({ photo: 'kindPhoto', signature: 'kindSignature', thumb: 'kindThumb', document: 'kindDocument' }[k]);
const dimStr = (w, h) => `${w} x ${h} px`;

function physText(p) {
  if (!p.mm) return '';
  const cm = (v) => String(+(v / 10).toFixed(2));
  return `${cm(p.mm.w)} x ${cm(p.mm.h)} cm`;
}

function kbText(p) {
  const k = p.kb || {};
  let s;
  if (k.min != null && k.max != null) s = `${k.min}-${k.max} KB`;
  else if (k.max != null) s = `up to ${k.max} KB`;
  else if (k.min != null) s = `at least ${k.min} KB`;
  else s = '';
  if (p.maxCompressionRatio) s += (s ? ', ' : '') + `compression under ${p.maxCompressionRatio}:1`;
  return s;
}

function sizeText(p) {
  if (p.dimsRule === 'free') return t('anyShape');
  const d = targetDims(p);
  const phys = physText(p);
  if (p.dimsRule === 'exact') return dimStr(d.w, d.h) + (phys ? ` (${phys})` : '');
  if (p.dimsRule === 'range') return `${p.minPx.w} x ${p.minPx.h} to ${p.maxPx.w} x ${p.maxPx.h} px` + (p.square ? ', square' : '');
  return dimStr(d.w, d.h) + (phys ? ` (${phys})` : '');
}

function specLine(p) {
  const bits = [kindLabel(p.kind)];
  if (p.dimsRule === 'free') bits.push(t('anyShape'));
  else if (p.dimsRule === 'suggested') bits.push(physText(p) || dimStr(...Object.values(targetDims(p))));
  else bits.push(sizeText(p));
  const kb = kbText(p);
  if (kb) bits.push(kb);
  bits.push(p.format.toUpperCase());
  return bits.join('  ·  ');
}

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null) e.append(kid.nodeType ? kid : document.createTextNode(kid));
  return e;
}

function groupName(g) { return g[getLang()] || g.en; }

// ------------------------------------------------------------------ static text
function applyStaticText() {
  document.documentElement.lang = getLang() === 'hi' ? 'hi' : 'en';
  $('logo').innerHTML = icon('logo', { size: 28 });
  $('privacyChip').innerHTML = icon('lock', { size: 16 }) + ' ' + t('privacy');
  const lb = $('langBtn');
  lb.innerHTML = icon('globe', { size: 18 }) + '<span>' + t('langToggle') + '</span>';
  lb.setAttribute('aria-label', t('langToggleLabel'));
  $('h1').textContent = t('tagline');
  $('privacyLong').innerHTML = icon('shield', { size: 18 }) + ' ' + t('privacy') + ' ' + t('privacyLong');
  $('qLabel').textContent = t('searchLabel');
  $('q').placeholder = t('searchPlaceholder');
  $('searchIcon').innerHTML = icon('search', { size: 22 });
  $('h2').textContent = t('addTitle');
  $('dropIc').innerHTML = icon('image', { size: 44 });
  $('dropHint').textContent = t('addHint');
  $('btnCamera').innerHTML = icon('camera') + '<span>' + t('takePhoto') + '</span>';
  $('btnFile').innerHTML = icon('upload') + '<span>' + t('chooseFile') + '</span>';
  $('pasteHint').textContent = t('pasteHint');
  $('back2').innerHTML = icon('arrowLeft') + '<span>' + t('back') + '</span>';
  $('h3').textContent = t('adjustTitle');
  $('adjustHint').textContent = t('adjustHint');
  $('stage').setAttribute('aria-label', t('editorLabel'));
  $('zoomLabel').textContent = t('zoom');
  $('strLabel').textContent = t('straighten');
  $('btnRotate').innerHTML = icon('rotate') + '<span>' + t('rotate') + '</span>';
  $('btnFit').innerHTML = icon('fit') + '<span>' + t('fit') + '</span>';
  $('btnFace').innerHTML = icon('face') + '<span>' + t('centreFace') + '</span>';
  $('guideLabel').textContent = t('guide');
  $('enhanceTitle').innerHTML = icon('wand', { size: 18 }) + '&nbsp;' + t('enhance');
  $('brLabel').textContent = t('brightness');
  $('coLabel').textContent = t('contrast');
  $('whitenLabel').textContent = t('whiten');
  $('whitenHint').textContent = t('whitenHint');
  $('cleanLabel').textContent = t('clean');
  $('cleanHint').textContent = t('cleanHint');
  $('previewTitle').textContent = t('previewTitle');
  $('back3').innerHTML = icon('arrowLeft') + '<span>' + t('back') + '</span>';
  $('btnMake').innerHTML = '<span>' + t('make') + '</span>' + icon('arrowRight');
  $('h4').textContent = t('resultTitle');
  $('workingText').textContent = t('working');
  $('padLabel').textContent = t('padLabel');
  $('padHint').textContent = t('padHint');
  $('dlIc').innerHTML = icon('download');
  $('dlText').textContent = t('download');
  $('btnShare').innerHTML = icon('share') + '<span>' + t('share') + '</span>';
  $('btnAdjustAgain').textContent = t('adjustAgain');
  $('btnChange').textContent = t('changeForm');
  $('btnStartOver').textContent = t('startOver');
  $('footPrivacy').innerHTML = icon('lock', { size: 16 }) + ' ' + t('footPrivacy');
  $('footSources').textContent = t('footSources', { date: CHECKED });
  document.title = 'formfit - ' + t('tagline');
}

// ------------------------------------------------------------------ steps nav
function renderSteps() {
  const ol = $('steps');
  ol.innerHTML = '';
  const names = [t('step1'), t('step2'), t('step3'), t('step4')];
  const reach = maxReachable();
  names.forEach((n, i) => {
    const num = i + 1;
    const enabled = num <= reach && num !== S.step;
    const b = el('button', {
      type: 'button', class: 'step-btn' + (num < S.step ? ' done' : ''),
      'aria-disabled': enabled || num === S.step ? 'false' : 'true',
      'aria-current': num === S.step ? 'step' : null,
      onclick: () => { if (enabled) go(num); },
    }, el('span', { class: 'step-num', html: num < S.step ? icon('check', { size: 16 }) : String(num) }), el('span', { class: 'step-label' }, n));
    ol.append(el('li', {}, b));
  });
}

function maxReachable() {
  if (!S.preset) return 1;
  if (!S.img) return 2;
  return S.result ? 4 : 3;
}

function go(step, push = true) {
  if (step > maxReachable()) step = maxReachable();
  const changed = step !== S.step;
  S.step = step;
  for (let i = 1; i <= 4; i++) $('step' + i).hidden = i !== step;
  renderSteps();
  if (step === 2) renderStep2();
  if (step === 3) enterStep3();
  if (push && changed) { try { history.pushState({ step }, '', location.pathname + location.search); } catch { /* ignore */ } }
  window.scrollTo(0, 0);
  const head = $('step' + step).querySelector('h1,h2');
  if (head) { head.setAttribute('tabindex', '-1'); head.focus({ preventScroll: true }); }
}
window.addEventListener('popstate', (e) => {
  const st = (e.state && e.state.step) || 1;
  go(st, false);
});

// ------------------------------------------------------------------ step 1: presets
function allEntries() {
  return [...PRESETS, { id: 'custom', group: 'generic', name: t('customTitle'), custom: true, tags: 'custom own size type' }];
}

function matches(p, q) {
  if (!q) return true;
  const hay = (p.name + ' ' + (p.tags || '') + ' ' + (p.custom ? '' : specLine(p)) + ' ' + p.group).toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((tok) => hay.includes(tok));
}

function renderChips() {
  const box = $('groupChips');
  box.innerHTML = '';
  const mk = (id, label) => el('button', {
    type: 'button', class: 'gchip', role: 'tab', 'aria-selected': S.groupFilter === id ? 'true' : 'false',
    onclick: () => { S.groupFilter = id; renderChips(); renderList(); },
  }, label);
  box.append(mk('all', t('all')));
  for (const g of GROUPS) box.append(mk(g.id, groupName(g)));
}

function renderList() {
  const root = $('presetList');
  root.innerHTML = '';
  let any = false;
  for (const g of GROUPS) {
    if (S.groupFilter !== 'all' && S.groupFilter !== g.id) continue;
    const items = allEntries().filter((p) => p.group === g.id && matches(p, S.query));
    if (!items.length) continue;
    any = true;
    root.append(el('h3', { class: 'group-title' }, groupName(g)));
    for (const p of items) root.append(presetNode(p));
  }
  if (!any) root.append(el('p', { class: 'muted' }, t('noResults')));
}

function badge(p) {
  return p.verified
    ? el('span', { class: 'badge badge-ok' }, t('badgeVerified'))
    : el('span', { class: 'badge badge-warn' }, t('badgeUnverified'));
}

function presetNode(p) {
  const open = S.openId === p.id;
  const head = el('button', {
    type: 'button', class: 'preset-head', 'aria-expanded': open ? 'true' : 'false', 'aria-controls': 'pb-' + p.id,
    onclick: () => { S.openId = open ? null : p.id; renderList(); if (!open) scrollToPreset(p.id); },
  },
  el('span', { class: 'preset-title' }, el('span', { class: 'preset-name' }, p.name), p.custom ? el('span', { class: 'preset-spec' }, t('customHint')) : el('span', { class: 'preset-spec' }, specLine(p))),
  p.custom || p.generic ? null : badge(p),
  el('span', { class: 'chev', html: icon('chevron') }));
  const wrap = el('div', { class: 'preset', 'data-open': open ? 'true' : 'false', id: 'preset-' + p.id }, head);
  if (open) wrap.append(p.custom ? customBody() : presetBody(p));
  return wrap;
}

function scrollToPreset(id) {
  requestAnimationFrame(() => { const n = $('preset-' + id); if (n) n.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
}

function rulesDl(p) {
  const dl = el('dl', { class: 'rules' });
  const add = (k, v) => { if (v) dl.append(el('dt', {}, k), el('dd', {}, v)); };
  add(t('ruleSize'), p.dimsRule === 'suggested' ? t('noPixelRule', { size: dimStr(targetDims(p).w, targetDims(p).h) + (physText(p) ? ` (${physText(p)})` : '') }) : sizeText(p));
  add(t('ruleFile'), kbText(p) || '-');
  add(t('ruleFormat'), p.format === 'png' ? 'PNG' : 'JPG');
  add(t('ruleBackground'), p.bg);
  return dl;
}

function verifyBlock(p) {
  const box = el('div');
  if (p.generic) return box;
  if (p.verified) {
    box.append(el('div', { class: 'alert alert-ok', html: icon('shield', { size: 18 }) }, el('span', {}, t('verifiedBadge', { date: p.checked }))));
  } else {
    box.append(el('div', { class: 'alert alert-warn', html: icon('warn', { size: 18 }) }, el('span', {}, t('checkOfficial'))));
  }
  return box;
}

function sourceLine(p) {
  if (p.generic || !p.source) return null;
  const d = el('p', { class: 'srcline' });
  d.append(t('source') + ': ');
  d.append(el('a', { href: p.source.url, target: '_blank', rel: 'noopener noreferrer' }, p.source.label));
  d.append(` (${p.checked}). `);
  if (p.officialUrl) d.append(el('a', { href: p.officialUrl, target: '_blank', rel: 'noopener noreferrer' }, t('officialSite')));
  return d;
}

function presetBody(p) {
  const body = el('div', { class: 'preset-body', id: 'pb-' + p.id });
  body.append(rulesDl(p), verifyBlock(p));
  if (p.alsoCheck) body.append(el('p', { class: 'also' }, el('strong', {}, t('alsoCheck') + ': '), p.alsoCheck));
  const src = sourceLine(p);
  if (src) body.append(src);
  body.append(el('button', { type: 'button', class: 'btn btn-primary btn-lg', onclick: () => choosePreset(p) }, t('useThis'), el('span', { html: icon('arrowRight') })));
  return body;
}

// ---- custom
const CUSTOM_KEY = 'formfit.custom';
function loadCustom() {
  try { return JSON.parse(store.get(CUSTOM_KEY)) || {}; } catch { return {}; }
}
function customBody() {
  const v = Object.assign({ kind: 'photo', unit: 'px', w: '', h: '', dpi: '300', min: '', max: '', format: 'jpg' }, loadCustom());
  const sel = (id, opts, cur) => el('select', { id, class: 'sel' }, opts.map(([val, label]) => el('option', { value: val, ...(val === cur ? { selected: true } : {}) }, label)));
  const field = (label, node, cls = '') => el('div', { class: cls }, el('label', { for: node.id }, label), node);
  const num = (id, val, ph) => el('input', { id, type: 'number', inputmode: 'decimal', min: '0', step: 'any', value: val, placeholder: ph || '' });
  const form = el('form', { class: 'cform', id: 'pb-custom', novalidate: true, onsubmit: (e) => { e.preventDefault(); submitCustom(); } },
    field(t('kind'), sel('c-kind', [['photo', t('kindPhoto')], ['signature', t('kindSignature')], ['thumb', t('kindThumb')], ['document', t('kindDocument')]], v.kind)),
    field(t('format'), sel('c-format', [['jpg', 'JPG'], ['png', 'PNG']], v.format)),
    field(t('width') + ' (' + t('optional') + ')', num('c-w', v.w)),
    field(t('height') + ' (' + t('optional') + ')', num('c-h', v.h)),
    field(t('unit'), sel('c-unit', [['px', t('inPx')], ['mm', t('inMm')], ['cm', t('inCm')], ['in', t('inIn')]], v.unit)),
    field(t('dpi'), num('c-dpi', v.dpi, '300')),
    field(t('minKb') + ' (' + t('optional') + ')', num('c-min', v.min)),
    field(t('maxKb') + ' (' + t('optional') + ')', num('c-max', v.max)),
    el('p', { class: 'err', id: 'c-err', role: 'alert' }),
    el('button', { type: 'submit', class: 'btn btn-primary btn-lg span2' }, t('useThis'), el('span', { html: icon('arrowRight') })));
  return el('div', { class: 'preset-body' }, form);
}

function submitCustom() {
  const g = (id) => $(id).value.trim();
  const v = { kind: g('c-kind'), format: g('c-format'), unit: g('c-unit'), w: g('c-w'), h: g('c-h'), dpi: g('c-dpi'), min: g('c-min'), max: g('c-max') };
  store.set(CUSTOM_KEY, JSON.stringify(v));
  const err = (m) => { $('c-err').textContent = m; };
  const num = (s) => (s === '' ? null : Number(s));
  const w = num(v.w), h = num(v.h), min = num(v.min), max = num(v.max), dpi = num(v.dpi);
  if ((w == null) !== (h == null)) return err('Enter both width and height, or leave both empty.');
  if ([w, h, min, max, dpi].some((x) => x != null && (!Number.isFinite(x) || x < 0))) return err('Numbers must be positive.');
  if (min != null && max != null && min > max) return err('Minimum KB is larger than maximum KB.');
  if (w != null && v.unit !== 'px' && !dpi) return err('Enter the DPI to convert physical sizes to pixels.');
  const p = { id: 'custom', group: 'generic', name: t('customTitle'), kind: v.kind, format: v.format, kb: {}, verified: true, generic: true, checked: CHECKED, alsoCheck: '-', custom: true };
  if (min != null) p.kb.min = min;
  if (max != null) p.kb.max = max;
  if (dpi) p.dpi = dpi;
  if (w != null && w > 0) {
    const px = sizeToPx({ unit: v.unit, w, h, dpi: dpi || 300 });
    if (px.w < 20 || px.h < 20 || px.w > 8000 || px.h > 8000) return err('Size must be between 20 and 8000 pixels.');
    p.px = px; p.dimsRule = 'exact';
    if (v.unit !== 'px') p.mm = null;
  } else {
    p.dimsRule = 'free'; p.maxSide = 1200;
  }
  if (isInk(p)) p.ink = p.kind !== 'photo';
  const errs = validatePreset(p);
  if (errs.length) return err(errs[0]);
  err('');
  choosePreset(p);
}

function choosePreset(p) {
  const prev = S.preset;
  S.preset = p;
  if (!prev || prev.id !== p.id) { S.img = null; S.result = null; }
  S.aspect = p.kind === 'signature' ? 3 : p.kind === 'document' ? 0 : 3 / 4;
  go(2);
}

// ------------------------------------------------------------------ step 2: add picture
function renderStep2() {
  const p = S.preset;
  const card = $('specCard');
  card.innerHTML = '';
  card.append(el('div', { class: 'name' }, p.name, p.generic ? null : badge(p)),
    el('div', { class: 'muted' }, specLine(p)));
  if (!p.verified && !p.generic) card.append(el('div', { class: 'alert alert-warn', html: icon('warn', { size: 18 }) }, el('span', {}, t('checkOfficial'))));
  const chips = $('doneChips');
  chips.innerHTML = '';
  for (const m of S.made) chips.append(el('span', { class: 'chip', html: icon('check', { size: 14 }) + ' ' }, m.preset.name));
  const tip = { photo: 'tipPhoto', signature: 'tipSignature', thumb: 'tipThumb', document: 'tipDocument' }[p.kind];
  $('tip').textContent = t(tip);
  $('inCamera').setAttribute('capture', p.kind === 'photo' ? 'user' : 'environment');
  $('addError').hidden = true;
}

function showAddError(msg) {
  const e = $('addError');
  e.innerHTML = icon('warn', { size: 18 }) + '<span></span>';
  e.querySelector('span').textContent = msg;
  e.hidden = false;
}

async function handleFile(file) {
  if (!file || !S.preset) return;
  $('addError').hidden = true;
  try {
    const img = await decodeImage(file);
    S.img = img; S.result = null;
    go(3);
    if (Math.min(img.origW, img.origH) < 300) {
      const n = $('previewNote');
      n.textContent = t('tooSmall', { w: img.origW, h: img.origH });
      n.hidden = false;
    }
  } catch (e) {
    showAddError(e.code === 'heic' ? t('heicHelp') : t('badImage'));
  }
}

function wireInputs() {
  $('btnCamera').addEventListener('click', () => $('inCamera').click());
  $('btnFile').addEventListener('click', () => $('inFile').click());
  for (const id of ['inCamera', 'inFile']) {
    $(id).addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; handleFile(f); });
  }
  const drop = $('drop');
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
  document.addEventListener('dragover', (e) => { if (S.step === 2) { stop(e); drop.classList.add('over'); } });
  document.addEventListener('dragleave', (e) => { if (S.step === 2 && !e.relatedTarget) drop.classList.remove('over'); });
  document.addEventListener('drop', (e) => {
    if (S.step !== 2) return;
    stop(e); drop.classList.remove('over');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleFile(f);
  });
  document.addEventListener('paste', (e) => {
    if (S.step !== 2 && S.step !== 3) return;
    if (!S.preset) return;
    const files = e.clipboardData && e.clipboardData.files;
    const f = files && files[0];
    if (f && /^image\//.test(f.type)) { e.preventDefault(); handleFile(f); }
  });
  $('back2').addEventListener('click', () => go(1));
}

// ------------------------------------------------------------------ step 3: adjust
const SHAPES = [['orig', 0], ['p', 3 / 4], ['sq', 1], ['l', 4 / 3], ['w', 3]];
const SHAPE_LABEL = { orig: 'Original', p: 'Portrait', sq: 'Square', l: 'Landscape', w: 'Wide' };

function currentAspect() {
  const p = S.preset;
  if (p.dimsRule !== 'free') { const d = targetDims(p); return d.w / d.h; }
  if (S.aspect === 0 && S.img) return S.img.w / S.img.h;
  return S.aspect || 3 / 4;
}

function enterStep3() {
  const p = S.preset;
  if (!S.editor) {
    S.editor = new CropEditor($('stage'), { onChange: onEditorChange });
  }
  const ed = S.editor;
  const photo = p.kind === 'photo';
  const ink = isInk(p);
  $('whitenRow').hidden = !photo; $('whitenHint').hidden = !photo;
  $('cleanRow').hidden = !ink; $('cleanHint').hidden = !ink;
  $('guideRow').hidden = !photo;
  $('btnFace').hidden = !(photo && faceDetectorAvailable());
  S.opts.guide = photo;
  $('chkGuide').checked = photo;
  $('chkWhiten').checked = S.opts.whiten = false;
  $('chkClean').checked = S.opts.clean = true;
  $('brightness').value = 0; $('contrast').value = 0; S.opts.brightness = 0; S.opts.contrast = 0;
  $('straighten').value = 0; $('strOut').textContent = '0°';
  $('previewNote').hidden = true;
  renderShapeRow();
  ed.setAllowMargins(!photo);
  sizeStage();
  ed.setAspect(currentAspect());
  ed.setGuide(photo ? 'face' : null);
  ed.setImage(S.img.canvas);
  syncZoom();
  schedulePreview();
  if (Math.min(S.img.origW, S.img.origH) < 300) {
    const n = $('previewNote'); n.textContent = t('tooSmall', { w: S.img.origW, h: S.img.origH }); n.hidden = false;
  }
}

// Wide frames (signatures) need less vertical room than portraits.
function sizeStage() {
  const stage = document.querySelector('.stage');
  const w = stage.clientWidth || 340;
  const maxH = Math.min(Math.round(window.innerHeight * 0.62), 560);
  const h = Math.round(Math.min(maxH, Math.max(220, w / currentAspect() + 56)));
  stage.style.height = h + 'px';
}

function renderShapeRow() {
  let row = $('shapeRow');
  if (!row) {
    row = el('div', { id: 'shapeRow', class: 'btn-row' });
    $('btnRotate').parentElement.before(row);
  }
  row.innerHTML = '';
  if (S.preset.dimsRule !== 'free') { row.hidden = true; return; }
  row.hidden = false;
  for (const [id, a] of SHAPES) {
    const active = (a === 0 && S.aspect === 0) || (a !== 0 && Math.abs((S.aspect || 0) - a) < 1e-9);
    row.append(el('button', {
      type: 'button', class: 'gchip', 'aria-pressed': active ? 'true' : 'false', 'aria-selected': active ? 'true' : 'false',
      onclick: () => { S.aspect = a; renderShapeRow(); sizeStage(); S.editor.setAspect(currentAspect()); S.editor.fit(); syncZoom(); },
    }, SHAPE_LABEL[id]));
  }
}

function syncZoom() {
  const z = S.editor.zoomPos;
  $('zoom').value = String(Math.round((Number.isFinite(z) ? z : 0) * 1000));
  const deg = S.editor.view.straighten;
  $('straighten').value = String(Math.round(deg * 10));
  $('strOut').textContent = deg.toFixed(1).replace('.0', '') + '°';
}

let previewTimer = 0;
function onEditorChange() { syncZoom(); schedulePreview(); }
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 120);
}

function exportDims() { return targetDims(S.preset, currentAspect()); }

function renderPreview() {
  if (S.step !== 3 || !S.img || !S.editor) return;
  const d = exportDims();
  const k = Math.min(1, 300 / Math.max(d.w, d.h));
  const pw = Math.max(8, Math.round(d.w * k)), ph = Math.max(8, Math.round(d.h * k));
  const { view, frame } = S.editor.getState();
  const { canvas, notes } = buildOutput(S.img.canvas, view, frame.w, pw, ph, { ...S.opts, ink: isInk(S.preset) });
  const img = $('previewImg');
  img.src = canvas.toDataURL('image/png');
  img.width = pw; img.height = ph;
  img.alt = t('previewTitle');
  $('previewInfo').textContent = dimStr(d.w, d.h);
  const n = $('previewNote');
  const msgs = [];
  if (notes.includes('whitenSkipped')) msgs.push(t('whitenSkipped'));
  if (notes.includes('noInk')) msgs.push(t('noInkFound'));
  if (msgs.length) { n.textContent = msgs.join(' '); n.hidden = false; }
  else if (Math.min(S.img.origW, S.img.origH) >= 300) n.hidden = true;
}

function wireAdjust() {
  $('zoom').addEventListener('input', (e) => S.editor.setZoomPos(Number(e.target.value) / 1000));
  $('straighten').addEventListener('input', (e) => { const d = Number(e.target.value) / 10; S.editor.setStraighten(d); });
  $('btnRotate').addEventListener('click', () => S.editor.rotate90());
  $('btnFit').addEventListener('click', () => { S.editor.fit(); });
  $('chkGuide').addEventListener('change', (e) => { S.opts.guide = e.target.checked; S.editor.setGuide(e.target.checked ? 'face' : null); });
  $('brightness').addEventListener('input', (e) => { S.opts.brightness = Number(e.target.value); schedulePreview(); });
  $('contrast').addEventListener('input', (e) => { S.opts.contrast = Number(e.target.value); schedulePreview(); });
  $('chkWhiten').addEventListener('change', (e) => { S.opts.whiten = e.target.checked; schedulePreview(); });
  $('chkClean').addEventListener('change', (e) => { S.opts.clean = e.target.checked; schedulePreview(); });
  $('btnFace').addEventListener('click', autoCentreFace);
  $('back3').addEventListener('click', () => go(2));
  $('btnMake').addEventListener('click', makeFile);
}

async function autoCentreFace() {
  try {
    const src = S.img.canvas;
    const rot = S.editor.view.rot90;
    const rw = rot % 2 ? src.height : src.width, rh = rot % 2 ? src.width : src.height;
    const s0 = Math.min(1, 900 / Math.max(rw, rh));
    const dw = Math.round(rw * s0), dh = Math.round(rh * s0);
    const v0 = { cx: src.width / 2, cy: src.height / 2, scale: s0, rot90: rot, straighten: 0 };
    const c = renderCrop(src, v0, dw, dw, dh);
    const box = await detectFace(c);
    if (!box) return;
    const [px, py] = screenToImage(v0, box.x + box.w / 2 - dw / 2, box.y + box.h / 2 - dh / 2);
    S.editor.centreOnFace(px, py, box.h / s0);
  } catch { /* detector failed: ignore */ }
}

// ------------------------------------------------------------------ step 4: export
let lastBuild = null;

async function makeFile() {
  if (!S.img) return;
  const { view, frame } = S.editor.getState();
  lastBuild = { view: { ...view }, frameW: frame.w, aspect: currentAspect(), opts: { ...S.opts } };
  S.result = { pending: true };
  go(4);
  await runExport();
}

async function runExport() {
  const token = ++S.token;
  const p = S.preset;
  $('working').hidden = false; $('result').hidden = true; $('exportError').hidden = true;
  await new Promise((r) => setTimeout(r, 30));
  try {
    const b = lastBuild;
    const render = (w, h) => buildOutput(S.img.canvas, b.view, b.frameW, w, h, { ...b.opts, ink: isInk(p) }).canvas;
    const r = await exportToWindow(p, b.aspect, render, { padToMin: S.opts.padToMin });
    if (token !== S.token) return;
    S.result = r;
    showResult(r);
  } catch (e) {
    $('working').hidden = true;
    const box = $('exportError');
    box.innerHTML = icon('warn', { size: 18 }) + '<span></span>';
    box.querySelector('span').textContent = t('errorTitle') + ': ' + (e && e.message || e);
    box.hidden = false;
  }
}

let currentUrl = null;
function showResult(r) {
  const p = S.preset;
  $('working').hidden = true; $('result').hidden = false;
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  currentUrl = URL.createObjectURL(r.blob);
  const name = fileNameFor(p, r);
  r.name = name;
  $('resultImg').src = currentUrl;
  $('resultImg').alt = name;
  $('fileName').textContent = name;
  const dl = $('btnDownload');
  dl.href = currentUrl; dl.download = name;

  const rows = checkResult(p, { w: r.w, h: r.h, bytes: r.bytes.length, dpi: r.dpi, format: r.format, quality: r.quality }, t);
  const tickLabel = { format: 'tickFormat', size: 'tickSize', dims: 'tickDims', dpi: 'tickDpi', square: 'tickSquare' };
  const ul = $('ticks');
  ul.innerHTML = '';
  for (const row of rows) {
    const cls = row.ok === true ? 'tick-ok' : row.ok === false ? 'tick-bad' : 'tick-info';
    const ic = row.ok === true ? 'check' : row.ok === false ? 'x' : 'info';
    ul.append(el('li', { class: cls },
      el('span', { class: 'tick-ic', html: icon(ic, { size: 16 }) }),
      el('span', {}, el('span', { class: 'tick-label' }, t(tickLabel[row.id] || row.id)), el('span', { class: 'tick-detail' }, row.detail))));
  }
  const ok = allPass(rows) && r.status !== 'too-big' && r.status !== 'below-min';
  const v = $('verdict');
  v.textContent = ok ? t('allGood') : t('someFail');
  v.className = 'verdict ' + (ok ? 'ok' : 'bad');
  $('resultMeta').textContent = [dimStr(r.w, r.h), formatKB(r.bytes.length) + ' KB', r.dpi + ' DPI', r.format.toUpperCase(), r.format === 'jpg' ? t('quality', { q: Math.round(r.quality * 100) }) : null].filter(Boolean).join('  ·  ');

  const notes = $('resultNotes');
  notes.innerHTML = '';
  const note = (cls, text, ic) => notes.append(el('div', { class: 'alert ' + cls, html: icon(ic, { size: 18 }) }, el('span', {}, text)));
  if (r.padded) note('alert-ok', t('paddedNote', { n: r.padded }), 'info');
  if (r.stepped) note('alert-warn', t('steppedNote', { w: r.w, h: r.h }), 'info');
  if (r.status === 'too-big') {
    const d = targetDims(p, lastBuild.aspect);
    const stepOk = canStepDown(p, d);
    note('alert-bad', t(stepOk ? 'tooBigFlex' : 'tooBigExact', { w: d.w, h: d.h, kb: formatKB(r.bytes.length), max: p.kb.max }), 'warn');
  }
  if (r.status === 'below-min') note('alert-bad', t('belowMinNoPad', { kb: formatKB(r.bytes.length), min: p.kb.min }), 'warn');
  if (!p.verified && !p.generic) note('alert-warn', t('checkOfficial'), 'warn');

  $('chkPad').checked = S.opts.padToMin;

  // share
  const sh = $('btnShare');
  sh.hidden = true;
  try {
    const file = new File([r.blob], name, { type: r.blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      sh.hidden = false;
      sh.onclick = () => navigator.share({ files: [file], title: name }).catch(() => {});
    }
  } catch { /* share unsupported */ }

  // remember for "files made"
  S.made = S.made.filter((m) => m.preset.id !== p.id);
  S.made.push({ preset: p, url: currentUrl, name, kb: formatKB(r.bytes.length) });
  renderMade();

  const nx = p.next && getPreset(p.next);
  const nb = $('btnNext');
  nb.hidden = !nx;
  if (nx) {
    nb.innerHTML = '<span>' + t('nextUp', { name: shortName(nx) }) + '</span>' + icon('arrowRight');
    nb.onclick = () => { S.preset = nx; S.img = null; S.result = null; S.openId = nx.id; go(2); };
  }
  maybeFocusResult();
}

function shortName(p) {
  const i = p.name.indexOf(' - ');
  return (i >= 0 ? p.name.slice(i + 3) : p.name).toLowerCase();
}

function maybeFocusResult() {
  const h = $('h4'); h.setAttribute('tabindex', '-1');
}

function renderMade() {
  const box = $('filesMade');
  if (S.made.length < 2) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = '';
  box.append(el('h3', {}, t('filesMade')));
  for (const m of S.made) {
    box.append(el('p', {}, el('a', { href: m.url, download: m.name }, m.name), ` - ${m.preset.name}`));
  }
}

function wireResult() {
  $('chkPad').addEventListener('change', (e) => { S.opts.padToMin = e.target.checked; runExport(); });
  $('btnAdjustAgain').addEventListener('click', () => go(3));
  $('btnChange').addEventListener('click', () => { S.img = null; S.result = null; go(1); });
  $('btnStartOver').addEventListener('click', () => {
    S.preset = null; S.img = null; S.result = null; S.made = []; S.openId = null; S.query = ''; $('q').value = '';
    renderList(); go(1);
  });
}

// ------------------------------------------------------------------ init
function init() {
  const saved = store.get('formfit.lang');
  setLang(saved || ((navigator.language || '').toLowerCase().startsWith('hi') ? 'hi' : 'en'));
  applyStaticText();
  renderChips();
  renderList();
  renderSteps();
  wireInputs();
  wireAdjust();
  wireResult();
  $('q').addEventListener('input', (e) => { S.query = e.target.value; renderList(); });
  $('langBtn').addEventListener('click', () => {
    setLang(getLang() === 'en' ? 'hi' : 'en');
    store.set('formfit.lang', getLang());
    applyStaticText(); renderChips(); renderList(); renderSteps();
    const oc = $('offlineChip'); if (!oc.hidden) oc.innerHTML = icon('check', { size: 14 }) + ' ' + t('offlineReady');
    if (S.step === 2) renderStep2();
    if (S.step === 3) { renderShapeRow(); schedulePreview(); }
    if (S.step === 4 && S.result) showResult(S.result);
  });
  try { history.replaceState({ step: 1 }, '', location.href); } catch { /* ignore */ }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {});
    navigator.serviceWorker.ready.then(() => {
      const c = $('offlineChip');
      c.hidden = false; c.className = 'chip';
      c.innerHTML = icon('check', { size: 14 }) + ' ' + t('offlineReady');
    }).catch(() => {});
  }
  window.__formfit = { S };
}
init();
