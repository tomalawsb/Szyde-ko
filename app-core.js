'use strict';

const STORAGE_KEY = 'szydelko-studio-v2';
const LEGACY_KEY = 'szydelko-studio-v1';
const MAX_HISTORY = 60;
let deferredInstallPrompt = null;
let calcDraft = null;
let history = [];
let future = [];
let isRestoring = false;
let saveTimer = null;
let selectedManualIds = new Set();
let dragState = null;
const pointers = new Map();
let pinchState = null;

const symbols = [
  { id:'chain', glyph:'○', pl:'oczko łańcuszka', short:'oł', us:'chain (ch)', uk:'chain (ch)', flatGrowth:0 },
  { id:'slip', glyph:'•', pl:'oczko ścisłe', short:'oś', us:'slip stitch (sl st)', uk:'slip stitch (ss)', flatGrowth:0 },
  { id:'single', glyph:'×', pl:'półsłupek', short:'ps', us:'single crochet (sc)', uk:'double crochet (dc)', flatGrowth:6 },
  { id:'halfdouble', glyph:'T̄', pl:'półsłupek nawijany', short:'psn', us:'half double crochet (hdc)', uk:'half treble (htr)', flatGrowth:8 },
  { id:'double', glyph:'T', pl:'słupek', short:'sł', us:'double crochet (dc)', uk:'treble (tr)', flatGrowth:12 },
  { id:'treble', glyph:'Ŧ', pl:'słupek podwójny', short:'sł2', us:'treble crochet (tr)', uk:'double treble (dtr)', flatGrowth:18 },
  { id:'doubletreble', glyph:'T‡', pl:'słupek potrójny', short:'sł3', us:'double treble (dtr)', uk:'triple treble (trtr)', flatGrowth:24 },
  { id:'triple', glyph:'T⧧', pl:'słupek poczwórny', short:'sł4', us:'triple treble (trtr)', uk:'quadruple treble', flatGrowth:30 },
  { id:'picot', glyph:'♢', pl:'pikotek', short:'pik', us:'picot', uk:'picot', flatGrowth:0 },
  { id:'cluster', glyph:'⋀', pl:'grupa / cluster', short:'grp', us:'cluster', uk:'cluster', flatGrowth:0 },
  { id:'puff', glyph:'◖', pl:'puff', short:'puff', us:'puff stitch', uk:'puff stitch', flatGrowth:0 },
  { id:'popcorn', glyph:'◉', pl:'popcorn', short:'pop', us:'popcorn stitch', uk:'popcorn stitch', flatGrowth:0 },
  { id:'shell', glyph:'Ϣ', pl:'muszelka', short:'musz', us:'shell', uk:'shell', flatGrowth:0 },
  { id:'vstitch', glyph:'V', pl:'V-stitch', short:'V', us:'V-stitch', uk:'V-stitch', flatGrowth:0 },
  { id:'decrease', glyph:'⋏', pl:'2 oczka razem', short:'2raz', us:'decrease / 2 tog', uk:'decrease / 2 tog', flatGrowth:-1 },
  { id:'increase', glyph:'Y', pl:'2 oczka w jedno', short:'2w1', us:'increase', uk:'increase', flatGrowth:1 },
  { id:'frontpost', glyph:'⫯', pl:'słupek reliefowy od przodu', short:'rel.p', us:'front post dc', uk:'front post tr', flatGrowth:0 },
  { id:'backpost', glyph:'⫰', pl:'słupek reliefowy od tyłu', short:'rel.t', us:'back post dc', uk:'back post tr', flatGrowth:0 },
  { id:'magicring', glyph:'◎', pl:'magiczne kółko', short:'MK', us:'magic ring', uk:'magic ring', flatGrowth:0 },
  { id:'chainspace', glyph:'⌒', pl:'łuk / przestrzeń łańcuszkowa', short:'łuk', us:'chain space', uk:'chain space', flatGrowth:0 },
  { id:'fan', glyph:'⌯', pl:'wachlarz', short:'wach', us:'fan', uk:'fan', flatGrowth:0 }
];

const $ = id => document.getElementById(id);
const $$ = sel => [...document.querySelectorAll(sel)];
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const safeRatio = (a, b) => Number(b) > 0 ? Number(a) / Number(b) : 1;
const formatNum = (n, digits = 0) => Number(n).toLocaleString('pl-PL', { minimumFractionDigits:digits, maximumFractionDigits:digits });
const cryptoId = () => (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
const symbolById = id => symbols.find(s => s.id === id) || symbols[0];
const escapeHtml = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function baseProject() {
  return {
    name:'Nowy projekt', shape:'circle', unit:'cm', hookMm:1.5, yarn:'', notes:'',
    originalSize:24, targetSize:36,
    originalWidth:24, originalHeight:24, targetWidth:36, targetHeight:36,
    gaugeSampleWidth:10, gaugeSampleHeight:10, gaugeStitches:24, gaugeRows:12,
    targetGaugeSampleWidth:10, targetGaugeSampleHeight:10, targetGaugeStitches:24, targetGaugeRows:12
  };
}

function emptyState() {
  return {
    version:2, uiScale:1, activeView:'home', previewMode:'scheme',
    project:baseProject(), rounds:[], manualSymbols:[], activeRoundId:null,
    viewTransform:{ zoom:1, rotation:0 }, editor:{ mode:'select', symbolId:'double', multiSelect:false }
  };
}

function demo() {
  const s = emptyState();
  s.project = { ...baseProject(), name:'Serwetka demonstracyjna', yarn:'Kordonek bawełniany', notes:'Projekt demonstracyjny do testowania przeliczeń.' };
  s.rounds = [
    { id:cryptoId(), n:1, stitchType:'double', stitchCount:12, rapport:3, repeats:4, increase:12, note:'Pierścień początkowy.' },
    { id:cryptoId(), n:2, stitchType:'double', stitchCount:24, rapport:3, repeats:8, increase:12, note:'' },
    { id:cryptoId(), n:3, stitchType:'chainspace', stitchCount:32, rapport:4, repeats:8, increase:8, note:'Łuki z oczek łańcuszka.' },
    { id:cryptoId(), n:4, stitchType:'double', stitchCount:48, rapport:6, repeats:8, increase:16, note:'' },
    { id:cryptoId(), n:5, stitchType:'cluster', stitchCount:64, rapport:8, repeats:8, increase:16, note:'Motyw płatkowy.' },
    { id:cryptoId(), n:6, stitchType:'chain', stitchCount:72, rapport:9, repeats:8, increase:8, note:'' },
    { id:cryptoId(), n:7, stitchType:'double', stitchCount:96, rapport:12, repeats:8, increase:24, note:'Powtarzający się motyw.' },
    { id:cryptoId(), n:8, stitchType:'picot', stitchCount:104, rapport:13, repeats:8, increase:8, note:'Wykończenie.' }
  ];
  s.activeRoundId = s.rounds[0].id;
  return s;
}

function migrate(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const p = { ...baseProject(), ...(src.project || {}) };
  if (!p.unit) p.unit = 'cm';
  if (!p.gaugeSampleWidth) p.gaugeSampleWidth = 10;
  if (!p.gaugeSampleHeight) p.gaugeSampleHeight = 10;
  if (!p.targetGaugeSampleWidth) p.targetGaugeSampleWidth = 10;
  if (!p.targetGaugeSampleHeight) p.targetGaugeSampleHeight = 10;
  if (!p.originalWidth) p.originalWidth = p.originalSize || 24;
  if (!p.originalHeight) p.originalHeight = p.originalSize || 24;
  if (!p.targetWidth) p.targetWidth = p.targetSize || 36;
  if (!p.targetHeight) p.targetHeight = p.targetSize || 36;
  const out = {
    version:2, uiScale:Number(src.uiScale)||1, activeView:src.activeView || 'home', previewMode:src.previewMode || 'scheme',
    project:p,
    rounds:Array.isArray(src.rounds) ? src.rounds.map(r => ({ id:r.id||cryptoId(), n:r.n||1, stitchType:r.stitchType||'double', stitchCount:Number(r.stitchCount)||1, rapport:Number(r.rapport)||1, repeats:Number(r.repeats)||1, increase:Number(r.increase)||0, note:r.note||'' })) : [],
    manualSymbols:Array.isArray(src.manualSymbols) ? src.manualSymbols.map(m => ({ id:m.id||cryptoId(), roundId:m.roundId||null, symbolId:m.symbolId||'double', x:Number(m.x)||320, y:Number(m.y)||320, rotation:Number(m.rotation)||0, rapportGroup:m.rapportGroup||null })) : [],
    activeRoundId:src.activeRoundId || null,
    viewTransform:{ zoom:Number(src.viewTransform?.zoom)||1, rotation:Number(src.viewTransform?.rotation)||0 },
    editor:{ mode:src.editor?.mode || 'select', symbolId:src.editor?.symbolId || 'double', multiSelect:!!src.editor?.multiSelect }
  };
  normalizeState(out);
  return out;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
    return raw ? migrate(JSON.parse(raw)) : demo();
  } catch { return demo(); }
}

let state = loadState();

function cloneState(v = state) { return JSON.parse(JSON.stringify(v)); }

function normalizeState(target = state) {
  target.rounds = Array.isArray(target.rounds) ? target.rounds : [];
  target.rounds.forEach((r,i) => {
    r.n = i + 1;
    r.stitchCount = Math.max(1, Math.round(Number(r.stitchCount)||1));
    r.rapport = Math.max(1, Math.round(Number(r.rapport)||1));
    r.repeats = Math.max(1, Math.round(Number(r.repeats)||1));
    r.increase = Math.round(Number(r.increase)||0);
    r.stitchType = symbolById(r.stitchType).id;
  });
  target.manualSymbols = (target.manualSymbols || []).filter(m => target.rounds.some(r => r.id === m.roundId) && symbolById(m.symbolId));
  if (target.activeRoundId && !target.rounds.some(r => r.id === target.activeRoundId)) target.activeRoundId = target.rounds[0]?.id || null;
  if (!target.activeRoundId && target.rounds[0]) target.activeRoundId = target.rounds[0].id;
  target.viewTransform = target.viewTransform || {zoom:1,rotation:0};
  target.viewTransform.zoom = clamp(Number(target.viewTransform.zoom)||1,.35,4);
  target.viewTransform.rotation = Number(target.viewTransform.rotation)||0;
  target.editor = target.editor || {mode:'select',symbolId:'double',multiSelect:false};
  target.editor.multiSelect = !!target.editor.multiSelect;
}

function snapshot() {
  if (isRestoring) return;
  history.push(cloneState());
  if (history.length > MAX_HISTORY) history.shift();
  future = [];
  updateUndoRedo();
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if ($('saveState')) $('saveState').textContent = 'Zapisano lokalnie';
}

function commitChange(renderAll = true) {
  clearTimeout(saveTimer);
  if ($('saveState')) $('saveState').textContent = 'Zapisywanie…';
  saveTimer = setTimeout(save, 120);
  if (renderAll) render();
}

function mutate(fn, renderAll = true) {
  snapshot(); fn(); normalizeState(); commitChange(renderAll);
}

function undo() {
  if (!history.length) return;
  future.push(cloneState()); isRestoring = true; state = history.pop(); isRestoring = false;
  selectedManualIds.clear(); save(); render(); updateUndoRedo();
}

function redo() {
  if (!future.length) return;
  history.push(cloneState()); isRestoring = true; state = future.pop(); isRestoring = false;
  selectedManualIds.clear(); save(); render(); updateUndoRedo();
}

function updateUndoRedo() {
  if ($('undoBtn')) $('undoBtn').disabled = history.length === 0;
  if ($('redoBtn')) $('redoBtn').disabled = future.length === 0;
}

function unitToCm(v, unit = state.project.unit) { return Number(v) * (unit === 'mm' ? .1 : 1); }
function cmToUnit(v, unit = state.project.unit) { return Number(v) / (unit === 'mm' ? .1 : 1); }

function projectDimsCm(p = state.project) {
  const u = p.unit || 'cm';
  if (p.shape === 'circle') {
    const o = unitToCm(p.originalSize,u), t = unitToCm(p.targetSize,u);
    return { ow:o, oh:o, tw:t, th:t };
  }
  return { ow:unitToCm(p.originalWidth,u), oh:unitToCm(p.originalHeight,u), tw:unitToCm(p.targetWidth,u), th:unitToCm(p.targetHeight,u) };
}

function gaugeInfo(p = state.project) {
  const unit = p.unit || 'cm';
  const sourceWcm = Math.max(.001, unitToCm(p.gaugeSampleWidth,unit));
  const sourceHcm = Math.max(.001, unitToCm(p.gaugeSampleHeight,unit));
  const targetWcm = Math.max(.001, unitToCm(p.targetGaugeSampleWidth,unit));
  const targetHcm = Math.max(.001, unitToCm(p.targetGaugeSampleHeight,unit));
  return {
    sourceStitchPerCm:(Number(p.gaugeStitches)||0)/sourceWcm,
    sourceRowPerCm:(Number(p.gaugeRows)||0)/sourceHcm,
    targetStitchPerCm:(Number(p.targetGaugeStitches)||0)/targetWcm,
    targetRowPerCm:(Number(p.targetGaugeRows)||0)/targetHcm
  };
}

function ratios(p = state.project) {
  const d = projectDimsCm(p), g = gaugeInfo(p);
  return {
    width:safeRatio(d.tw,d.ow), height:safeRatio(d.th,d.oh),
    stitchGauge:safeRatio(g.targetStitchPerCm,g.sourceStitchPerCm), rowGauge:safeRatio(g.targetRowPerCm,g.sourceRowPerCm),
    horizontal:safeRatio(d.tw,d.ow)*safeRatio(g.targetStitchPerCm,g.sourceStitchPerCm),
    vertical:safeRatio(d.th,d.oh)*safeRatio(g.targetRowPerCm,g.sourceRowPerCm)
  };
}

function switchView(view) {
  if (!$(`view-${view}`)) view = 'home';
  state.activeView = view;
  $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
  $$('.nav-item[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  if (view === 'analysis') runAnalysis();
  if (view === 'recalc') syncCalcInputs();
  if (view === 'pattern') { renderScheme(); renderInstructions(); }
  save();
}

function bindProjectInput(id,key,numeric=false) {
  $(id).addEventListener('change', e => mutate(() => { state.project[key] = numeric ? Number(e.target.value)||0 : e.target.value; }));
  $(id).addEventListener('input', e => {
    state.project[key] = numeric ? Number(e.target.value)||0 : e.target.value;
    updateRatios(); clearTimeout(saveTimer); saveTimer = setTimeout(save,180);
  });
}

function changeUnit(newUnit) {
  const old = state.project.unit || 'cm';
  if (old === newUnit) return;
  mutate(() => {
    const keys = ['originalSize','targetSize','originalWidth','originalHeight','targetWidth','targetHeight','gaugeSampleWidth','gaugeSampleHeight','targetGaugeSampleWidth','targetGaugeSampleHeight'];
    keys.forEach(k => { state.project[k] = cmToUnit(unitToCm(state.project[k],old),newUnit); });
    state.project.unit = newUnit;
  });
}

function updateRatios() {
  const r = ratios();
  $('widthRatio').textContent = formatNum(r.width,2)+'×';
  $('heightRatio').textContent = formatNum(r.height,2)+'×';
  $('gaugeRatio').textContent = formatNum(r.stitchGauge,2)+'×';
  $('rowGaugeRatio').textContent = formatNum(r.rowGauge,2)+'×';
}
