(() => {
  'use strict';

  const STORAGE_KEY = 'szydelko-studio-v1';
  const MAX_HISTORY = 40;
  let deferredInstallPrompt = null;
  let calcDraft = null;
  let history = [];
  let future = [];
  let isRestoring = false;

  const symbols = [
    { id: 'chain', glyph: '○', pl: 'oczko łańcuszka', short: 'oł', us: 'chain (ch)', uk: 'chain (ch)', flatGrowth: 0 },
    { id: 'slip', glyph: '•', pl: 'oczko ścisłe', short: 'oś', us: 'slip stitch (sl st)', uk: 'slip stitch (ss)', flatGrowth: 0 },
    { id: 'single', glyph: '×', pl: 'półsłupek', short: 'ps', us: 'single crochet (sc)', uk: 'double crochet (dc)', flatGrowth: 6 },
    { id: 'halfdouble', glyph: 'T̄', pl: 'półsłupek nawijany', short: 'psn', us: 'half double crochet (hdc)', uk: 'half treble (htr)', flatGrowth: 8 },
    { id: 'double', glyph: 'T', pl: 'słupek', short: 'sł', us: 'double crochet (dc)', uk: 'treble (tr)', flatGrowth: 12 },
    { id: 'treble', glyph: 'Ŧ', pl: 'słupek podwójny', short: 'sł2', us: 'treble crochet (tr)', uk: 'double treble (dtr)', flatGrowth: 18 },
    { id: 'picot', glyph: '♢', pl: 'pikotek', short: 'pik', us: 'picot', uk: 'picot', flatGrowth: 0 },
    { id: 'cluster', glyph: '⋀', pl: 'grupa / cluster', short: 'grp', us: 'cluster', uk: 'cluster', flatGrowth: 0 },
  ];

  const demo = () => ({
    version: 1,
    uiScale: 1,
    activeView: 'project',
    project: {
      name: 'Serwetka demonstracyjna', shape: 'circle', hookMm: 1.5, yarn: 'Kordonek bawełniany',
      originalSize: 24, targetSize: 36, notes: 'Przykładowy projekt do testowania kalkulatora.',
      gaugeStitches: 24, gaugeRows: 12, targetGaugeStitches: 24, targetGaugeRows: 12
    },
    rounds: [
      { id: cryptoId(), n: 1, stitchType: 'double', stitchCount: 12, rapport: 3, repeats: 4, increase: 12, note: 'Pierścień początkowy.' },
      { id: cryptoId(), n: 2, stitchType: 'double', stitchCount: 24, rapport: 3, repeats: 8, increase: 12, note: '' },
      { id: cryptoId(), n: 3, stitchType: 'chain', stitchCount: 32, rapport: 4, repeats: 8, increase: 8, note: 'Łuki z oczek łańcuszka.' },
      { id: cryptoId(), n: 4, stitchType: 'double', stitchCount: 48, rapport: 6, repeats: 8, increase: 16, note: '' },
      { id: cryptoId(), n: 5, stitchType: 'cluster', stitchCount: 64, rapport: 8, repeats: 8, increase: 16, note: 'Motyw płatkowy.' },
      { id: cryptoId(), n: 6, stitchType: 'chain', stitchCount: 72, rapport: 9, repeats: 8, increase: 8, note: '' },
      { id: cryptoId(), n: 7, stitchType: 'double', stitchCount: 96, rapport: 12, repeats: 8, increase: 24, note: 'Powtarzający się raport 8×.' },
      { id: cryptoId(), n: 8, stitchType: 'picot', stitchCount: 104, rapport: 13, repeats: 8, increase: 8, note: 'Wykończenie.' },
    ],
    activeRoundId: null
  });

  function cryptoId() {
    return (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'r-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return demo();
      const parsed = JSON.parse(raw);
      return parsed && parsed.project && Array.isArray(parsed.rounds) ? parsed : demo();
    } catch { return demo(); }
  }

  let state = loadState();
  if (!state.activeRoundId && state.rounds[0]) state.activeRoundId = state.rounds[0].id;

  const $ = id => document.getElementById(id);
  const $$ = sel => [...document.querySelectorAll(sel)];

  function cloneState() { return JSON.parse(JSON.stringify(state)); }

  function snapshot() {
    if (isRestoring) return;
    history.push(cloneState());
    if (history.length > MAX_HISTORY) history.shift();
    future = [];
    updateUndoRedo();
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    $('saveState').textContent = 'Zapisano lokalnie';
  }

  let saveTimer;
  function commitChange(renderAll = true) {
    clearTimeout(saveTimer);
    $('saveState').textContent = 'Zapisywanie…';
    saveTimer = setTimeout(save, 120);
    if (renderAll) render();
  }

  function mutate(fn, renderAll = true) {
    snapshot();
    fn();
    normalizeRounds();
    commitChange(renderAll);
  }

  function normalizeRounds() {
    state.rounds.forEach((r, i) => {
      r.n = i + 1;
      r.stitchCount = Math.max(1, Math.round(Number(r.stitchCount) || 1));
      r.rapport = Math.max(1, Math.round(Number(r.rapport) || 1));
      r.repeats = Math.max(1, Math.round(Number(r.repeats) || 1));
      r.increase = Math.round(Number(r.increase) || 0);
    });
    if (state.activeRoundId && !state.rounds.some(r => r.id === state.activeRoundId)) {
      state.activeRoundId = state.rounds[0]?.id || null;
    }
  }

  function updateUndoRedo() {
    $('undoBtn').disabled = history.length === 0;
    $('redoBtn').disabled = future.length === 0;
  }

  function undo() {
    if (!history.length) return;
    future.push(cloneState());
    isRestoring = true;
    state = history.pop();
    isRestoring = false;
    save(); render(); updateUndoRedo();
  }

  function redo() {
    if (!future.length) return;
    history.push(cloneState());
    isRestoring = true;
    state = future.pop();
    isRestoring = false;
    save(); render(); updateUndoRedo();
  }

  function switchView(view) {
    state.activeView = view;
    $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
    $$('.nav-item[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    if (view === 'analysis') runAnalysis();
    if (view === 'recalc') syncCalcInputs();
    save();
  }

  function bindProjectInput(id, key, numeric = false) {
    $(id).addEventListener('change', e => mutate(() => {
      state.project[key] = numeric ? (Number(e.target.value) || 0) : e.target.value;
    }));
    $(id).addEventListener('input', e => {
      state.project[key] = numeric ? (Number(e.target.value) || 0) : e.target.value;
      updateRatios();
      clearTimeout(saveTimer); saveTimer = setTimeout(save, 180);
    });
  }

  function updateRatios() {
    const p = state.project;
    const size = safeRatio(p.targetSize, p.originalSize);
    const gauge = safeRatio(p.targetGaugeStitches, p.gaugeStitches);
    $('sizeRatio').textContent = formatNum(size, 2) + '×';
    $('gaugeRatio').textContent = formatNum(gauge, 2) + '×';
  }

  function safeRatio(a, b) { return Number(b) > 0 ? Number(a) / Number(b) : 1; }
  function formatNum(n, digits = 0) { return Number(n).toLocaleString('pl-PL', { minimumFractionDigits: digits, maximumFractionDigits: digits }); }
  function symbolById(id) { return symbols.find(s => s.id === id) || symbols[0]; }

  function renderProject() {
    const p = state.project;
    const map = {
      projectName: p.name, projectShape: p.shape, hookMm: p.hookMm, yarn: p.yarn,
      originalSize: p.originalSize, targetSize: p.targetSize, projectNotes: p.notes,
      gaugeStitches: p.gaugeStitches, gaugeRows: p.gaugeRows,
      targetGaugeStitches: p.targetGaugeStitches, targetGaugeRows: p.targetGaugeRows
    };
    for (const [id, val] of Object.entries(map)) if ($(id) && document.activeElement !== $(id)) $(id).value = val ?? '';
    updateRatios();
  }

  function renderRounds() {
    $('roundCount').textContent = `${state.rounds.length} okr.`;
    $('roundList').innerHTML = state.rounds.map(r => {
      const s = symbolById(r.stitchType);
      return `<button class="round-item ${r.id === state.activeRoundId ? 'active' : ''}" data-round-id="${r.id}">
        <span class="round-no">${r.n}</span><span class="round-main"><b>${escapeHtml(s.pl)}</b><small>${r.stitchCount} ocz. · raport ${r.rapport} × ${r.repeats}</small></span><span class="round-chevron">›</span>
      </button>`;
    }).join('') || '<div class="empty-state">Brak okrążeń.</div>';
    $$('[data-round-id]').forEach(btn => btn.addEventListener('click', () => selectRound(btn.dataset.roundId)));
  }

  function selectRound(id) {
    state.activeRoundId = id; save(); renderRounds(); renderInspector(); renderScheme();
    if (window.innerWidth <= 900) $('inspector').classList.add('open');
  }

  function renderInspector() {
    const r = state.rounds.find(x => x.id === state.activeRoundId);
    $('inspectorEmpty').hidden = !!r;
    $('inspectorForm').hidden = !r;
    if (!r) return;
    $('insStitchType').innerHTML = symbols.map(s => `<option value="${s.id}">${escapeHtml(s.pl)}</option>`).join('');
    $('insRoundNo').value = r.n;
    $('insStitchType').value = r.stitchType;
    $('insStitchCount').value = r.stitchCount;
    $('insRapport').value = r.rapport;
    $('insRepeats').value = r.repeats;
    $('insIncrease').value = r.increase;
    $('insNote').value = r.note || '';
  }

  function updateActiveRound(key, value) {
    const r = state.rounds.find(x => x.id === state.activeRoundId);
    if (!r) return;
    mutate(() => { r[key] = value; });
  }

  function addRound() {
    const prev = state.rounds.at(-1);
    const n = state.rounds.length + 1;
    const rapport = prev?.rapport || 6;
    const repeats = prev?.repeats || 8;
    const count = Math.max(1, rapport * repeats);
    const r = { id: cryptoId(), n, stitchType: prev?.stitchType || 'double', stitchCount: count, rapport, repeats, increase: count - (prev?.stitchCount || 0), note: '' };
    mutate(() => { state.rounds.push(r); state.activeRoundId = r.id; });
    if (window.innerWidth <= 900) $('inspector').classList.add('open');
  }

  function duplicateRound() {
    const idx = state.rounds.findIndex(x => x.id === state.activeRoundId);
    if (idx < 0) return;
    const copy = { ...state.rounds[idx], id: cryptoId(), note: (state.rounds[idx].note || '') + ' (kopia)' };
    mutate(() => { state.rounds.splice(idx + 1, 0, copy); state.activeRoundId = copy.id; });
  }

  function deleteRound() {
    const idx = state.rounds.findIndex(x => x.id === state.activeRoundId);
    if (idx < 0) return;
    mutate(() => {
      state.rounds.splice(idx, 1);
      state.activeRoundId = state.rounds[Math.min(idx, state.rounds.length - 1)]?.id || null;
    });
  }

  function renderScheme() {
    const svg = $('schemeSvg');
    const rounds = state.rounds;
    if (!rounds.length) { svg.innerHTML = '<text x="320" y="320" text-anchor="middle" fill="#71697d">Brak wzoru</text>'; return; }
    const cx = 320, cy = 320, maxR = 275;
    const step = maxR / (rounds.length + 0.35);
    let out = `<defs><filter id="soft"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity=".12"/></filter></defs>`;
    out += `<circle cx="${cx}" cy="${cy}" r="8" fill="#7c3aed"/>`;
    rounds.forEach((r, i) => {
      const radius = Math.max(18, step * (i + 1));
      const active = r.id === state.activeRoundId;
      out += `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${active ? '#7c3aed' : '#c9bedc'}" stroke-width="${active ? 3 : 1.5}" stroke-dasharray="${r.stitchType === 'chain' ? '5 5' : '0'}" />`;
      const count = Math.max(3, Math.min(64, r.repeats || Math.round(r.stitchCount / Math.max(1, r.rapport))));
      const glyph = escapeHtml(symbolById(r.stitchType).glyph);
      for (let k = 0; k < count; k++) {
        const a = -Math.PI / 2 + (Math.PI * 2 * k / count);
        const x = cx + Math.cos(a) * radius;
        const y = cy + Math.sin(a) * radius;
        const rot = a * 180 / Math.PI + 90;
        out += `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rot.toFixed(2)})"><text text-anchor="middle" dominant-baseline="central" font-size="${active ? 16 : 13}" font-family="Arial, sans-serif" fill="${active ? '#5b21b6' : '#7b7089'}">${glyph}</text></g>`;
      }
      out += `<text x="${cx + 8}" y="${cy - radius + 12}" font-size="10" fill="${active ? '#5b21b6' : '#8a8096'}">${r.n}</text>`;
    });
    svg.innerHTML = out;
  }

  function buildInstruction() {
    return state.rounds.map(r => {
      const s = symbolById(r.stitchType);
      const rapportText = r.rapport > 0 ? `Raport ${r.rapport} ocz. × ${r.repeats}.` : '';
      return `Okrążenie ${r.n}: ${r.stitchCount} ocz. — ${s.pl}. ${rapportText}${r.note ? ' ' + r.note : ''}`.trim();
    });
  }

  function renderInstructions() {
    $('instructionWrap').innerHTML = buildInstruction().map((line, i) => `<div class="instruction-line"><strong>${i + 1}.</strong> ${escapeHtml(line.replace(/^Okrążenie \d+:\s*/, ''))}</div>`).join('');
  }

  function syncCalcInputs() {
    const p = state.project;
    const pairs = { calcOriginalSize: p.originalSize, calcTargetSize: p.targetSize, calcGaugeSource: p.gaugeStitches, calcGaugeTarget: p.targetGaugeStitches };
    Object.entries(pairs).forEach(([id, v]) => { if (document.activeElement !== $(id)) $(id).value = v ?? ''; });
    updateCalcFactor();
  }

  function getCalcFactor() {
    const size = safeRatio(Number($('calcTargetSize').value), Number($('calcOriginalSize').value));
    const gauge = safeRatio(Number($('calcGaugeTarget').value), Number($('calcGaugeSource').value));
    return size * gauge;
  }

  function updateCalcFactor() { $('calcFactor').textContent = formatNum(getCalcFactor(), 3) + '×'; }

  function calculateAll() {
    const factor = getCalcFactor();
    if (!Number.isFinite(factor) || factor <= 0) return toast('Nieprawidłowe dane przeliczenia.');
    const mode = $('calcMode').value;
    calcDraft = state.rounds.map(r => {
      const raw = r.stitchCount * factor;
      let target = Math.max(1, Math.round(raw));
      if (mode === 'rapport' && r.rapport > 0) target = Math.max(r.rapport, Math.round(raw / r.rapport) * r.rapport);
      const repeats = r.rapport > 0 ? Math.max(1, Math.round(target / r.rapport)) : r.repeats;
      return { id: r.id, n: r.n, source: r.stitchCount, raw, target, rapport: r.rapport, repeats };
    });
    $('calcResults').classList.remove('empty-state');
    $('calcResults').innerHTML = calcDraft.map(x => `<div class="calc-row"><b>${x.n}</b><span>${x.source} → <strong>${x.target}</strong><br><small>${formatNum(x.raw, 1)} przed korektą · ${x.repeats} raportów</small></span><span>${x.target - x.source >= 0 ? '+' : ''}${x.target - x.source}</span></div>`).join('');
    $('applyCalcBtn').disabled = false;
  }

  function applyCalculation() {
    if (!calcDraft) return;
    mutate(() => {
      for (const c of calcDraft) {
        const r = state.rounds.find(x => x.id === c.id);
        if (!r) continue;
        const prev = state.rounds[r.n - 2];
        r.stitchCount = c.target;
        r.repeats = c.repeats;
        r.increase = c.target - (prev?.stitchCount || 0);
      }
      state.project.originalSize = Number($('calcOriginalSize').value) || state.project.originalSize;
      state.project.targetSize = Number($('calcTargetSize').value) || state.project.targetSize;
      state.project.gaugeStitches = Number($('calcGaugeSource').value) || state.project.gaugeStitches;
      state.project.targetGaugeStitches = Number($('calcGaugeTarget').value) || state.project.targetGaugeStitches;
    });
    toast('Przeliczenie zastosowane.');
  }

  function analyze() {
    const items = [];
    state.rounds.forEach((r, i) => {
      if (r.rapport > 0 && r.stitchCount % r.rapport !== 0) {
        const low = Math.floor(r.stitchCount / r.rapport) * r.rapport;
        const high = Math.ceil(r.stitchCount / r.rapport) * r.rapport;
        items.push({ type: 'error', round: r.n, title: 'Liczba oczek nie pasuje do raportu', text: `${r.stitchCount} nie jest wielokrotnością ${r.rapport}. Najbliższe wartości: ${Math.max(r.rapport, low)} lub ${Math.max(r.rapport, high)}.` });
      }
      if (r.rapport > 0 && r.repeats * r.rapport !== r.stitchCount) {
        items.push({ type: 'warning', round: r.n, title: 'Niespójna liczba powtórzeń', text: `${r.repeats} × ${r.rapport} = ${r.repeats * r.rapport}, a wpisano ${r.stitchCount} oczek.` });
      }
      if (i > 0) {
        const prev = state.rounds[i - 1];
        const delta = r.stitchCount - prev.stitchCount;
        if (delta !== r.increase) items.push({ type: 'warning', round: r.n, title: 'Przyrost nie zgadza się z liczbą oczek', text: `Z liczb oczek wynika ${delta >= 0 ? '+' : ''}${delta}, a zapisany przyrost to ${r.increase >= 0 ? '+' : ''}${r.increase}.` });
        const expected = symbolById(r.stitchType).flatGrowth;
        if (state.project.shape === 'circle' && expected > 0) {
          if (delta > expected * 1.65) items.push({ type: 'warning', round: r.n, title: 'Duży przyrost', text: `Przyrost +${delta} jest znacznie większy od prostego modelu dla „${symbolById(r.stitchType).pl}” (~${expected}). Możliwe falowanie, chyba że wynika to z koronki.` });
          if (delta >= 0 && delta < expected * 0.35) items.push({ type: 'warning', round: r.n, title: 'Mały przyrost', text: `Przyrost +${delta} jest mały względem prostego modelu (~${expected}). Robótka może się podwijać, chyba że taki jest zamysł.` });
        }
      }
    });
    if (!items.length) items.push({ type: 'ok', round: 0, title: 'Brak oczywistych problemów', text: 'Raporty i deklarowane liczby oczek są arytmetycznie spójne.' });
    return items;
  }

  function runAnalysis() {
    const items = analyze();
    $('errorCount').textContent = items.filter(x => x.type === 'error').length;
    $('warningCount').textContent = items.filter(x => x.type === 'warning').length;
    $('analysisRoundCount').textContent = state.rounds.length;
    $('analysisList').innerHTML = items.map(x => `<div class="analysis-item ${x.type}"><b>${x.round ? `Okrążenie ${x.round}: ` : ''}${escapeHtml(x.title)}</b><span>${escapeHtml(x.text)}</span></div>`).join('');
  }

  function renderSymbols() {
    $('symbolGrid').innerHTML = symbols.map(s => `<article class="symbol-card"><div class="symbol-glyph">${escapeHtml(s.glyph)}</div><div><b>${escapeHtml(s.pl)} (${escapeHtml(s.short)})</b><small>US: ${escapeHtml(s.us)}<br>UK: ${escapeHtml(s.uk)}</small></div><button class="secondary" data-symbol-id="${s.id}">Ustaw dla wybranego okrążenia</button></article>`).join('');
    $$('[data-symbol-id]').forEach(b => b.addEventListener('click', () => {
      if (!state.activeRoundId) return toast('Najpierw wybierz okrążenie.');
      updateActiveRound('stitchType', b.dataset.symbolId); toast('Symbol ustawiony.');
    }));
  }

  function render() {
    document.documentElement.style.setProperty('--ui-scale', String(state.uiScale || 1));
    $('uiScale').value = String(state.uiScale || 1);
    renderProject(); renderRounds(); renderInspector(); renderScheme(); renderInstructions(); renderSymbols();
    switchView(state.activeView || 'project'); updateUndoRedo();
  }

  function escapeHtml(v) { return String(v ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c])); }

  function toast(msg) {
    const el = $('toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 1900);
  }

  function downloadBlob(filename, blob) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 500);
  }

  function exportJson() {
    downloadBlob(`${slug(state.project.name || 'projekt')}.szydelko.json`, new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
  }

  function exportSvg() {
    const svg = $('schemeSvg').cloneNode(true);
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    downloadBlob(`${slug(state.project.name || 'schemat')}.svg`, new Blob([svg.outerHTML], { type: 'image/svg+xml;charset=utf-8' }));
  }

  function slug(s) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'projekt'; }

  async function copyInstruction() {
    const text = `${state.project.name}\n\n${buildInstruction().join('\n')}`;
    try { await navigator.clipboard.writeText(text); toast('Instrukcja skopiowana.'); }
    catch { toast('Przeglądarka zablokowała schowek.'); }
  }

  async function importJson(file) {
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed?.project || !Array.isArray(parsed.rounds)) throw new Error('format');
      snapshot(); state = parsed; normalizeRounds(); save(); render(); toast('Projekt wczytany.');
    } catch { toast('Nieprawidłowy plik projektu.'); }
  }

  function initEvents() {
    $$('.nav-item[data-view]').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
    $('undoBtn').addEventListener('click', undo); $('redoBtn').addEventListener('click', redo);
    $('uiScale').addEventListener('change', e => mutate(() => { state.uiScale = Number(e.target.value) || 1; }));

    bindProjectInput('projectName', 'name'); bindProjectInput('projectShape', 'shape'); bindProjectInput('hookMm', 'hookMm', true); bindProjectInput('yarn', 'yarn');
    bindProjectInput('originalSize', 'originalSize', true); bindProjectInput('targetSize', 'targetSize', true); bindProjectInput('projectNotes', 'notes');
    bindProjectInput('gaugeStitches', 'gaugeStitches', true); bindProjectInput('gaugeRows', 'gaugeRows', true); bindProjectInput('targetGaugeStitches', 'targetGaugeStitches', true); bindProjectInput('targetGaugeRows', 'targetGaugeRows', true);

    $('addRoundBtn').addEventListener('click', addRound); $('duplicateRoundBtn').addEventListener('click', duplicateRound); $('deleteRoundBtn').addEventListener('click', deleteRound);
    $('closeInspector').addEventListener('click', () => $('inspector').classList.remove('open'));
    $('insStitchType').addEventListener('change', e => updateActiveRound('stitchType', e.target.value));
    $('insStitchCount').addEventListener('change', e => updateActiveRound('stitchCount', Number(e.target.value)));
    $('insRapport').addEventListener('change', e => updateActiveRound('rapport', Number(e.target.value)));
    $('insRepeats').addEventListener('change', e => updateActiveRound('repeats', Number(e.target.value)));
    $('insIncrease').addEventListener('change', e => updateActiveRound('increase', Number(e.target.value)));
    $('insNote').addEventListener('change', e => updateActiveRound('note', e.target.value));

    $$('[data-preview-mode]').forEach(b => b.addEventListener('click', () => {
      $$('[data-preview-mode]').forEach(x => x.classList.toggle('active', x === b));
      const scheme = b.dataset.previewMode === 'scheme'; $('schemeWrap').hidden = !scheme; $('instructionWrap').hidden = scheme;
    }));

    ['calcOriginalSize','calcTargetSize','calcGaugeSource','calcGaugeTarget'].forEach(id => $(id).addEventListener('input', updateCalcFactor));
    $('calculateBtn').addEventListener('click', calculateAll); $('applyCalcBtn').addEventListener('click', applyCalculation); $('analyzeBtn').addEventListener('click', runAnalysis);
    $('exportJsonBtn').addEventListener('click', exportJson); $('exportSvgBtn').addEventListener('click', exportSvg); $('copyInstructionBtn').addEventListener('click', copyInstruction); $('printBtn').addEventListener('click', () => window.print());
    $('importJsonInput').addEventListener('change', e => e.target.files?.[0] && importJson(e.target.files[0]));
    $('resetDemoBtn').addEventListener('click', () => { snapshot(); state = demo(); state.activeRoundId = state.rounds[0]?.id || null; save(); render(); toast('Przywrócono projekt demonstracyjny.'); });

    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstallPrompt = e; $('installBtn').hidden = false; });
    $('installBtn').addEventListener('click', async () => { if (!deferredInstallPrompt) return; deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; $('installBtn').hidden = true; });
    window.addEventListener('appinstalled', () => { $('installBtn').hidden = true; toast('Aplikacja zainstalowana.'); });
  }

  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  initEvents(); render(); save();
})();
