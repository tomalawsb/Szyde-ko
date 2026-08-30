'use strict';

function toast(message) {
  const el=$('toast'); if(!el)return;
  el.textContent=message; el.classList.add('show');
  clearTimeout(toast._timer); toast._timer=setTimeout(()=>el.classList.remove('show'),2200);
}

function downloadText(name,content,type='text/plain;charset=utf-8') {
  const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
}

function safeFileName(name) {
  return String(name||'projekt').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/gi,'_').replace(/^_+|_+$/g,'')||'projekt';
}

function exportProject() {
  downloadText(`${safeFileName(state.project.name)}.json`,JSON.stringify(state,null,2),'application/json;charset=utf-8');
}

function exportSvg() {
  renderScheme();
  const svg=$('schemeSvg').cloneNode(true);
  const scene=svg.querySelector('#schemeScene');
  if(scene) scene.removeAttribute('transform');
  svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
  svg.setAttribute('width','1600');svg.setAttribute('height','1600');
  const xml=`<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`;
  downloadText(`${safeFileName(state.project.name)}_schemat.svg`,xml,'image/svg+xml;charset=utf-8');
}

async function copyInstruction() {
  const text=buildInstruction().join('\n');
  try { await navigator.clipboard.writeText(text); toast('Instrukcja skopiowana.'); }
  catch { const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast('Instrukcja skopiowana.'); }
}

function printPattern() {
  const previous={...state.viewTransform};
  state.viewTransform={zoom:1,rotation:0};
  renderScheme();
  window.print();
  state.viewTransform=previous;
  renderScheme();
}

function makeEmptyProject() {
  const fresh=emptyState();
  mutate(()=>{
    const uiScale=state.uiScale; state.version=fresh.version;state.project=fresh.project;state.rounds=[];state.manualSymbols=[];state.activeRoundId=null;state.viewTransform=fresh.viewTransform;state.editor=fresh.editor;state.previewMode='scheme';state.activeView='project';state.uiScale=uiScale;
  });
  selectedManualIds.clear();toast('Utworzono pusty projekt.');
}

function handleQuick(action) {
  if(action==='new') { if(confirm('Utworzyć pusty projekt? Bieżący projekt pozostaje w historii cofania.')) makeEmptyProject(); return; }
  if(action==='check') { switchView('analysis');runAnalysis();return; }
  if(action==='gauge') { switchView('project');setTimeout(()=>$('gaugeSampleWidth')?.focus(),0);return; }
  if(action==='grow'||action==='shrink') { switchView('recalc'); return; }
}

function importProject(file) {
  const reader=new FileReader();
  reader.onload=()=>{
    try {
      const parsed=JSON.parse(reader.result); snapshot(); state=migrate(parsed); selectedManualIds.clear(); save(); render(); toast('Projekt wczytany.');
    } catch { toast('Nieprawidłowy plik projektu.'); }
  };
  reader.readAsText(file);
}

function updateCalcModeUi() {
  const isCustom=$('calcMode').value==='motifCount'; $('targetMotifsLabel').hidden=!isCustom; invalidateCalcDraft(true); updateCalcFactors();
}

function pointerDistance(a,b) { return Math.hypot(a.x-b.x,a.y-b.y); }

function startManualDrag(id,e) {
  if(state.editor.mode!=='select')return;
  const m=state.manualSymbols.find(x=>x.id===id);if(!m)return;
  const additive=state.editor.multiSelect||e.ctrlKey||e.metaKey||e.shiftKey;
  if(additive){if(selectedManualIds.has(id)&&state.editor.multiSelect)selectedManualIds.delete(id);else selectedManualIds.add(id);}else if(!selectedManualIds.has(id)){selectedManualIds=new Set([id]);}
  if(!selectedManualIds.has(id)){renderScheme();return;}
  snapshot();
  const start=screenToScene(e.clientX,e.clientY),orig=new Map();
  state.manualSymbols.filter(x=>selectedManualIds.has(x.id)).forEach(x=>orig.set(x.id,{x:x.x,y:x.y}));
  dragState={pointerId:e.pointerId,start,orig,moved:false};
  renderScheme();
}

function onSchemePointerDown(e) {
  const wrap=$('schemeWrap'); wrap.setPointerCapture?.(e.pointerId); pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===2){const [a,b]=[...pointers.values()];pinchState={distance:pointerDistance(a,b),zoom:state.viewTransform.zoom};dragState=null;return;}
  const target=e.target.closest?.('[data-manual-id]');
  if(state.editor.mode==='add'&&!target){addManualAt(e.clientX,e.clientY);return;}
  if(target){startManualDrag(target.dataset.manualId,e);return;}
  if(state.editor.mode==='select'&&!state.editor.multiSelect){selectedManualIds.clear();renderScheme();}
}

function onSchemePointerMove(e) {
  if(pointers.has(e.pointerId))pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pinchState&&pointers.size>=2){const [a,b]=[...pointers.values()];const dist=pointerDistance(a,b);if(pinchState.distance>0){state.viewTransform.zoom=clamp(pinchState.zoom*dist/pinchState.distance,.35,4);renderScheme();}return;}
  if(!dragState||dragState.pointerId!==e.pointerId)return;
  const p=screenToScene(e.clientX,e.clientY),dx=p.x-dragState.start.x,dy=p.y-dragState.start.y;
  if(Math.abs(dx)+Math.abs(dy)>1)dragState.moved=true;
  state.manualSymbols.forEach(m=>{const o=dragState.orig.get(m.id);if(o){m.x=clamp(o.x+dx,0,640);m.y=clamp(o.y+dy,0,640);}});
  renderScheme();
}

function onSchemePointerUp(e) {
  pointers.delete(e.pointerId);
  if(pointers.size<2&&pinchState){pinchState=null;save();}
  if(dragState&&dragState.pointerId===e.pointerId){dragState=null;normalizeState();commitChange(true);}
}

function bindStaticEvents() {
  $$('.nav-item[data-view],.brand-button[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
  $$('[data-quick]').forEach(b=>b.addEventListener('click',()=>handleQuick(b.dataset.quick)));
  $('undoBtn').addEventListener('click',undo);$('redoBtn').addEventListener('click',redo);
  $('uiScale').addEventListener('change',e=>{state.uiScale=Number(e.target.value)||1;save();render();});

  bindProjectInput('projectName','name');bindProjectInput('projectShape','shape');bindProjectInput('hookMm','hookMm',true);bindProjectInput('yarn','yarn');bindProjectInput('projectNotes','notes');
  ['originalSize','targetSize','originalWidth','originalHeight','targetWidth','targetHeight','gaugeSampleWidth','gaugeSampleHeight','gaugeStitches','gaugeRows','targetGaugeSampleWidth','targetGaugeSampleHeight','targetGaugeStitches','targetGaugeRows'].forEach(id=>bindProjectInput(id,id,true));
  $('projectUnit').addEventListener('change',e=>changeUnit(e.target.value));

  $('addRoundBtn').addEventListener('click',addRound);$('duplicateRoundBtn').addEventListener('click',duplicateRound);$('deleteRoundBtn').addEventListener('click',deleteRound);$('closeInspector').addEventListener('click',()=>$('inspector').classList.remove('open'));
  $('insStitchType').addEventListener('change',e=>updateActiveRound('stitchType',e.target.value));
  ['insStitchCount','insRapport','insRepeats','insIncrease'].forEach(id=>$(id).addEventListener('change',e=>updateActiveRound(({insStitchCount:'stitchCount',insRapport:'rapport',insRepeats:'repeats',insIncrease:'increase'})[id],Number(e.target.value)||0)));
  $('insNote').addEventListener('change',e=>updateActiveRound('note',e.target.value));

  $$('[data-preview-mode]').forEach(b=>b.addEventListener('click',()=>{state.previewMode=b.dataset.previewMode;save();applyPreviewMode();}));
  $('editorMode').addEventListener('change',e=>{state.editor.mode=e.target.value;save();renderEditorControls();});
  $('editorSymbol').addEventListener('change',e=>{state.editor.symbolId=e.target.value;save();});
  $('multiSelectBtn').addEventListener('click',()=>{state.editor.multiSelect=!state.editor.multiSelect;if(!state.editor.multiSelect&&selectedManualIds.size>1)selectedManualIds=new Set([[...selectedManualIds][0]]);save();renderEditorControls();renderScheme();});
  $('setRapportBtn').addEventListener('click',setSelectedAsRapport);$('deleteSymbolsBtn').addEventListener('click',deleteSelectedSymbols);
  $('zoomInBtn').addEventListener('click',()=>setZoom(state.viewTransform.zoom*1.2));$('zoomOutBtn').addEventListener('click',()=>setZoom(state.viewTransform.zoom/1.2));$('rotateLeftBtn').addEventListener('click',()=>rotateBy(-15));$('rotateRightBtn').addEventListener('click',()=>rotateBy(15));$('resetViewBtn').addEventListener('click',resetView);
  const wrap=$('schemeWrap');wrap.addEventListener('pointerdown',onSchemePointerDown);wrap.addEventListener('pointermove',onSchemePointerMove);wrap.addEventListener('pointerup',onSchemePointerUp);wrap.addEventListener('pointercancel',onSchemePointerUp);wrap.addEventListener('wheel',e=>{e.preventDefault();setZoom(state.viewTransform.zoom*(e.deltaY<0?1.1:.9));},{passive:false});

  ['calcGaugeSource','calcGaugeTarget','calcRowsSource','calcRowsTarget','targetMotifs'].forEach(id=>$(id).addEventListener('input',onCalcInputChanged));
  $('calcMode').addEventListener('change',updateCalcModeUi);$('calculateBtn').addEventListener('click',calculateAll);$('applyCalcBtn').addEventListener('click',applyCalculation);$('analyzeBtn').addEventListener('click',runAnalysis);

  $('exportJsonBtn').addEventListener('click',exportProject);$('exportSvgBtn').addEventListener('click',exportSvg);$('copyInstructionBtn').addEventListener('click',copyInstruction);$('printBtn').addEventListener('click',printPattern);
  $('importJsonInput').addEventListener('change',e=>{const f=e.target.files?.[0];if(f)importProject(f);e.target.value='';});
  $('newProjectBtn').addEventListener('click',()=>{if(confirm('Utworzyć pusty projekt?'))makeEmptyProject();});
  $('resetDemoBtn').addEventListener('click',()=>{if(!confirm('Przywrócić projekt demonstracyjny?'))return;snapshot();const ui=state.uiScale;state=demo();state.uiScale=ui;selectedManualIds.clear();save();render();toast('Przywrócono projekt demonstracyjny.');});

  window.addEventListener('keydown',e=>{
    const tag=document.activeElement?.tagName;if(['INPUT','TEXTAREA','SELECT'].includes(tag))return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return;}
    if((e.key==='Delete'||e.key==='Backspace')&&selectedManualIds.size){e.preventDefault();deleteSelectedSymbols();}
  });

  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;$('installBtn').hidden=false;});
  $('installBtn').addEventListener('click',async()=>{if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;$('installBtn').hidden=true;});
  window.addEventListener('appinstalled',()=>{$('installBtn').hidden=true;toast('Aplikacja zainstalowana.');});
}

function init() {
  normalizeState();
  bindStaticEvents();
  render();
  updateCalcModeUi();
  if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
}

document.addEventListener('DOMContentLoaded',init);
