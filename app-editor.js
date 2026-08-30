'use strict';
function renderHome() {
  $('homeProjectName').textContent = state.project.name || 'Bez nazwy';
  $('homeShape').textContent = ({circle:'okrąg',square:'kwadrat',rectangle:'prostokąt'})[state.project.shape] || state.project.shape;
  $('homeRounds').textContent = state.rounds.length;
  $('homeManual').textContent = state.manualSymbols.length;
}

function renderProject() {
  const p = state.project;
  const map = { projectName:p.name, projectShape:p.shape, projectUnit:p.unit, hookMm:p.hookMm, yarn:p.yarn, originalSize:p.originalSize, targetSize:p.targetSize, originalWidth:p.originalWidth, originalHeight:p.originalHeight, targetWidth:p.targetWidth, targetHeight:p.targetHeight, projectNotes:p.notes, gaugeSampleWidth:p.gaugeSampleWidth, gaugeSampleHeight:p.gaugeSampleHeight, gaugeStitches:p.gaugeStitches, gaugeRows:p.gaugeRows, targetGaugeSampleWidth:p.targetGaugeSampleWidth, targetGaugeSampleHeight:p.targetGaugeSampleHeight, targetGaugeStitches:p.targetGaugeStitches, targetGaugeRows:p.targetGaugeRows };
  Object.entries(map).forEach(([id,val]) => { if ($(id) && document.activeElement !== $(id)) $(id).value = val ?? ''; });
  $('circleDims').hidden = p.shape !== 'circle';
  $('rectDims').hidden = p.shape === 'circle';
  updateRatios();
}

function rowWord(n = 1) { return state.project.shape === 'rectangle' ? `Rząd ${n}` : `Okrążenie ${n}`; }

function renderRounds() {
  $('roundCount').textContent = `${state.rounds.length}`;
  $('roundList').innerHTML = state.rounds.map(r => {
    const s = symbolById(r.stitchType);
    const manual = state.manualSymbols.filter(m => m.roundId === r.id).length;
    return `<button class="round-item ${r.id===state.activeRoundId?'active':''}" data-round-id="${r.id}"><span class="round-no">${r.n}</span><span class="round-main"><b>${escapeHtml(s.pl)}</b><small>${r.stitchCount} ocz. · raport ${r.rapport} × ${r.repeats}${manual?` · ręczne ${manual}`:''}</small></span><span class="round-chevron">›</span></button>`;
  }).join('') || '<div class="empty-state">Brak okrążeń / rzędów.</div>';
  $$('[data-round-id]').forEach(btn => btn.addEventListener('click', () => selectRound(btn.dataset.roundId)));
}

function selectRound(id) {
  state.activeRoundId = id; selectedManualIds.clear(); save(); renderRounds(); renderInspector(); renderScheme(); updateSelectionInfo();
  if (window.innerWidth <= 900) $('inspector').classList.add('open');
}

function renderInspector() {
  const r = state.rounds.find(x => x.id === state.activeRoundId);
  $('inspectorEmpty').hidden = !!r; $('inspectorForm').hidden = !r;
  if (!r) return;
  $('insStitchType').innerHTML = symbols.map(s => `<option value="${s.id}">${escapeHtml(s.pl)}</option>`).join('');
  $('insRoundNo').value = r.n; $('insStitchType').value = r.stitchType; $('insStitchCount').value = r.stitchCount; $('insRapport').value = r.rapport; $('insRepeats').value = r.repeats; $('insIncrease').value = r.increase; $('insNote').value = r.note||'';
}

function updateActiveRound(key,value) {
  const r = state.rounds.find(x => x.id===state.activeRoundId); if (!r) return;
  mutate(() => { r[key] = value; });
}

function addRound() {
  const prev = state.rounds.at(-1), n = state.rounds.length+1;
  const rapport = prev?.rapport || 6, repeats = prev?.repeats || 8, count = Math.max(1,rapport*repeats);
  const r = { id:cryptoId(), n, stitchType:prev?.stitchType||'double', stitchCount:count, rapport, repeats, increase:count-(prev?.stitchCount||0), note:'' };
  mutate(() => { state.rounds.push(r); state.activeRoundId=r.id; });
  if (window.innerWidth <= 900) $('inspector').classList.add('open');
}

function duplicateRound() {
  const idx = state.rounds.findIndex(x=>x.id===state.activeRoundId); if (idx<0) return;
  const original = state.rounds[idx], copy = {...original,id:cryptoId(),note:(original.note||'')+' (kopia)'};
  mutate(() => {
    state.rounds.splice(idx+1,0,copy); state.activeRoundId=copy.id;
    const extras = state.manualSymbols.filter(m=>m.roundId===original.id).map(m=>({...m,id:cryptoId(),roundId:copy.id,y:clamp(m.y+8,10,630)}));
    state.manualSymbols.push(...extras);
  });
}

function deleteRound() {
  const idx = state.rounds.findIndex(x=>x.id===state.activeRoundId); if (idx<0) return;
  mutate(() => {
    const id = state.rounds[idx].id; state.rounds.splice(idx,1); state.manualSymbols = state.manualSymbols.filter(m=>m.roundId!==id); state.activeRoundId=state.rounds[Math.min(idx,state.rounds.length-1)]?.id||null;
  });
  selectedManualIds.clear();
}

function renderEditorControls() {
  $('editorMode').value = state.editor.mode;
  $('editorSymbol').innerHTML = symbols.map(s=>`<option value="${s.id}">${escapeHtml(s.glyph)} ${escapeHtml(s.pl)}</option>`).join('');
  $('editorSymbol').value = state.editor.symbolId;
  $('multiSelectBtn').textContent = `Wybór wielu: ${state.editor.multiSelect ? 'wł.' : 'wył.'}`;
  $('multiSelectBtn').classList.toggle('active-toggle', state.editor.multiSelect);
  updateSelectionInfo();
}

function updateSelectionInfo() {
  selectedManualIds = new Set([...selectedManualIds].filter(id=>state.manualSymbols.some(m=>m.id===id)));
  $('selectionInfo').textContent = `${selectedManualIds.size} zazn.`;
  $('deleteSymbolsBtn').disabled = selectedManualIds.size===0;
  $('setRapportBtn').disabled = selectedManualIds.size===0;
}

function sceneTransform() {
  const z = state.viewTransform.zoom, r = state.viewTransform.rotation;
  return `translate(320 320) rotate(${r}) scale(${z}) translate(-320 -320)`;
}

function generatedCount(r) { return clamp(Math.round(r.stitchCount)||1,1,120); }

function rectPerimeterPoint(cx,cy,w,h,t) {
  const p = 2*(w+h), d=((t%1)+1)%1*p, left=cx-w/2, top=cy-h/2;
  if (d<w) return {x:left+d,y:top,rot:0};
  if (d<w+h) return {x:left+w,y:top+(d-w),rot:90};
  if (d<2*w+h) return {x:left+w-(d-w-h),y:top+h,rot:180};
  return {x:left,y:top+h-(d-2*w-h),rot:270};
}

function renderCircleGeometry(rounds) {
  const cx=320,cy=320,maxR=270,step=maxR/(rounds.length+.45); let out='';
  rounds.forEach((r,i)=>{
    const radius=Math.max(18,step*(i+1)), active=r.id===state.activeRoundId, glyph=escapeHtml(symbolById(r.stitchType).glyph), count=generatedCount(r);
    out += `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${active?'#7c3aed':'#c9bedc'}" stroke-width="${active?3:1.4}" stroke-dasharray="${r.stitchType==='chain'||r.stitchType==='chainspace'?'5 5':'0'}"/>`;
    for(let k=0;k<count;k++){const a=-Math.PI/2+Math.PI*2*k/count,x=cx+Math.cos(a)*radius,y=cy+Math.sin(a)*radius,rot=a*180/Math.PI+90;out+=`<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" transform="rotate(${rot.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)})" text-anchor="middle" dominant-baseline="central" font-size="${active?15:12}" fill="${active?'#5b21b6':'#786d84'}">${glyph}</text>`;}
    out += `<text x="${cx+8}" y="${cy-radius+12}" font-size="10" fill="${active?'#5b21b6':'#8a8096'}">${r.n}</text>`;
  });
  return out;
}

function renderSquareGeometry(rounds) {
  const cx=320,cy=320,max=520,step=max/(rounds.length+.5); let out='';
  rounds.forEach((r,i)=>{
    const size=Math.max(36,step*(i+1)), active=r.id===state.activeRoundId, glyph=escapeHtml(symbolById(r.stitchType).glyph), count=generatedCount(r);
    out += `<rect x="${cx-size/2}" y="${cy-size/2}" width="${size}" height="${size}" rx="3" fill="none" stroke="${active?'#7c3aed':'#c9bedc'}" stroke-width="${active?3:1.4}"/>`;
    for(let k=0;k<count;k++){const p=rectPerimeterPoint(cx,cy,size,size,k/count);out+=`<text x="${p.x.toFixed(2)}" y="${p.y.toFixed(2)}" transform="rotate(${p.rot} ${p.x.toFixed(2)} ${p.y.toFixed(2)})" text-anchor="middle" dominant-baseline="central" font-size="${active?15:12}" fill="${active?'#5b21b6':'#786d84'}">${glyph}</text>`;}
    out += `<text x="${cx-size/2+6}" y="${cy-size/2+13}" font-size="10" fill="${active?'#5b21b6':'#8a8096'}">${r.n}</text>`;
  });
  return out;
}

function renderRectangleGeometry(rounds) {
  const dims=projectDimsCm(), aspect=clamp(safeRatio(dims.tw,dims.th),.45,2.4), maxW=520, maxH=520;
  let w=maxW,h=w/aspect;if(h>maxH){h=maxH;w=h*aspect;} const left=320-w/2,top=320-h/2; let out=`<rect x="${left}" y="${top}" width="${w}" height="${h}" fill="none" stroke="#d8cfe2" stroke-width="1.5"/>`;
  const gap=rounds.length>1?h/(rounds.length-1):0;
  rounds.forEach((r,i)=>{
    const y=rounds.length===1?320:top+i*gap, active=r.id===state.activeRoundId,glyph=escapeHtml(symbolById(r.stitchType).glyph),count=clamp(Math.round(r.stitchCount)||1,1,120);
    out += `<line x1="${left}" y1="${y}" x2="${left+w}" y2="${y}" stroke="${active?'#7c3aed':'#c9bedc'}" stroke-width="${active?3:1.4}"/>`;
    for(let k=0;k<count;k++){const x=left+(count===1?0:w*k/(count-1));out+=`<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" text-anchor="middle" dominant-baseline="central" font-size="${active?14:11}" fill="${active?'#5b21b6':'#786d84'}">${glyph}</text>`;}
    out += `<text x="${left+5}" y="${y-5}" font-size="10" fill="${active?'#5b21b6':'#8a8096'}">${r.n}</text>`;
  });
  return out;
}

function renderManualSymbols() {
  return state.manualSymbols.map(m=>{
    const s=symbolById(m.symbolId), selected=selectedManualIds.has(m.id), active=m.roundId===state.activeRoundId, grouped=!!m.rapportGroup;
    return `<g class="manual-symbol ${selected?'selected':''}" data-manual-id="${m.id}" transform="translate(${m.x} ${m.y}) rotate(${m.rotation||0})" opacity="${active?1:.62}"><circle class="manual-ring" r="12" fill="${grouped?'#faf2ff':'#fff'}" stroke="${selected?'#7c3aed':grouped?'#bc8cff':'#d6cbe2'}" stroke-width="${selected?2.5:1.2}" ${grouped?'stroke-dasharray="3 2"':''}/><text text-anchor="middle" dominant-baseline="central" font-size="15" fill="#4f3d60">${escapeHtml(s.glyph)}</text></g>`;
  }).join('');
}

function renderScheme() {
  const scene=$('schemeScene'); if(!scene)return;
  if(!state.rounds.length){scene.setAttribute('transform',sceneTransform());scene.innerHTML='<text x="320" y="320" text-anchor="middle" fill="#71697d">Brak wzoru</text>';return;}
  let geometry = state.project.shape==='circle' ? renderCircleGeometry(state.rounds) : state.project.shape==='square' ? renderSquareGeometry(state.rounds) : renderRectangleGeometry(state.rounds);
  scene.setAttribute('transform',sceneTransform());
  scene.innerHTML=`<defs><filter id="soft"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity=".12"/></filter></defs>${geometry}${renderManualSymbols()}`;
  $('zoomLabel').textContent=Math.round(state.viewTransform.zoom*100)+'%';
  updateSelectionInfo();
}

function buildInstruction() {
  return state.rounds.map(r=>{const s=symbolById(r.stitchType);const manual=state.manualSymbols.filter(m=>m.roundId===r.id).length;return `${rowWord(r.n)}: ${r.stitchCount} ocz. — ${s.pl}. Raport ${r.rapport} ocz. × ${r.repeats}.${manual?` Ręczne symbole na schemacie: ${manual}.`:''}${r.note?' '+r.note:''}`.trim();});
}

function renderInstructions() {
  $('instructionWrap').innerHTML=buildInstruction().map((line,i)=>`<div class="instruction-line"><strong>${i+1}.</strong> ${escapeHtml(line.replace(/^(Okrążenie|Rząd) \d+:\s*/,''))}</div>`).join('')||'<div class="empty-state">Brak instrukcji.</div>';
  applyPreviewMode();
}

function applyPreviewMode() {
  const mode=state.previewMode||'scheme';
  $$('[data-preview-mode]').forEach(b=>b.classList.toggle('active',b.dataset.previewMode===mode));
  $('schemeWrap').hidden=mode==='instruction'; $('instructionWrap').hidden=mode==='scheme';
  $('schemeWrap').style.height=mode==='both'?'min(45vh,34rem)':'';
}

function screenToScene(clientX,clientY) {
  const scene=$('schemeScene'),svg=$('schemeSvg');
  const pt=svg.createSVGPoint();pt.x=clientX;pt.y=clientY;
  const ctm=scene.getScreenCTM(); if(!ctm)return{x:320,y:320};
  const p=pt.matrixTransform(ctm.inverse()); return{x:clamp(p.x,0,640),y:clamp(p.y,0,640)};
}

function addManualAt(clientX,clientY) {
  if(!state.activeRoundId)return toast('Najpierw dodaj i wybierz okrążenie / rząd.');
  const p=screenToScene(clientX,clientY),m={id:cryptoId(),roundId:state.activeRoundId,symbolId:state.editor.symbolId,x:p.x,y:p.y,rotation:0,rapportGroup:null};
  mutate(()=>state.manualSymbols.push(m)); selectedManualIds=new Set([m.id]); renderScheme();
}

function deleteSelectedSymbols() {
  if(!selectedManualIds.size)return;
  mutate(()=>{state.manualSymbols=state.manualSymbols.filter(m=>!selectedManualIds.has(m.id));}); selectedManualIds.clear(); updateSelectionInfo();
}

function setSelectedAsRapport() {
  const selected=state.manualSymbols.filter(m=>selectedManualIds.has(m.id) && m.roundId===state.activeRoundId);
  if(!selected.length)return toast('Zaznacz symbole z aktywnego okrążenia / rzędu.');
  const r=state.rounds.find(x=>x.id===state.activeRoundId); if(!r)return;
  const rapport=selected.length;
  if(r.stitchCount % rapport !== 0) {
    const low=Math.max(rapport,Math.floor(r.stitchCount/rapport)*rapport),high=Math.ceil(r.stitchCount/rapport)*rapport;
    return toast(`Nie można ustawić raportu ${rapport}: ${r.stitchCount} oczek nie dzieli się bez reszty. Najbliżej: ${low} lub ${high}.`);
  }
  const group=cryptoId();
  mutate(()=>{selected.forEach(m=>m.rapportGroup=group);r.rapport=rapport;r.repeats=r.stitchCount/rapport;});
  toast(`Raport ustawiony: ${rapport} symboli × ${r.repeats}.`);
}

function setZoom(z) { state.viewTransform.zoom=clamp(z,.35,4); save(); renderScheme(); }
function rotateBy(deg) { state.viewTransform.rotation=(state.viewTransform.rotation+deg)%360; save(); renderScheme(); }
function resetView() { state.viewTransform={zoom:1,rotation:0}; save(); renderScheme(); }
